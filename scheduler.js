const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const { convertHtmlToImages } = require("./convert");
const { sendImagesToDiscord, sendMessageToDiscord } = require("./discord");
const { analyzeWithDeepSeek } = require("./deepseek");
const { HistoryManager } = require("./history");

/**
 * 从文件名提取日期
 * @param {string} filename - 文件名
 * @returns {string|null} 日期字符串（YYYY-MM-DD）
 */
function extractDateFromFilename(filename) {
  // 匹配格式：2025-12-12_03;34_SPX_gamma.html
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * 从文件名提取股票标识（关键词识别）
 * 通过文件名中的关键词匹配股票配置
 * 例如：文件名包含 "spx" → 匹配 SPX 配置
 * 
 * @param {string} filename - 文件名（如 "2025-12-12_03;34_SPX_gamma.html"）
 * @param {Array} stockConfigs - 股票配置数组
 * @returns {Object|null} 匹配的股票配置，如果未匹配返回 null
 */
function matchStockConfig(filename, stockConfigs) {
  const lowerFilename = filename.toLowerCase();
  for (const config of stockConfigs) {
    // 检查文件名是否包含配置中的任一关键词（不区分大小写）
    if (config.keywords.some(keyword => lowerFilename.includes(keyword.toLowerCase()))) {
      return config;
    }
  }
  return null;
}

/**
 * 扫描目录中的HTML文件
 * @param {string} watchDirectory - 监控目录
 * @param {Array} stockConfigs - 股票配置数组
 * @param {HistoryManager} historyManager - 历史记录管理器
 * @returns {Array} 需要处理的文件列表，每个元素包含 {htmlFile, stockConfig, stockKey}
 */
function scanHtmlFiles(watchDirectory, stockConfigs, historyManager) {
  const files = fs.readdirSync(watchDirectory);
  const htmlFiles = files.filter(f => f.endsWith(".html"));
  const toProcess = [];

  // 获取今天的日期（格式：YYYY-MM-DD）
  const today = new Date().toISOString().split("T")[0];
  console.log(`📅 今天日期: ${today}`);

  for (const htmlFile of htmlFiles) {
    // 步骤1：从文件名提取日期
    const fileDate = extractDateFromFilename(htmlFile);
    if (!fileDate) {
      console.log(`⚠️  无法从文件名提取日期，跳过: ${htmlFile}`);
      continue;
    }

    // 步骤2：只处理今天的文件
    if (fileDate !== today) {
      console.log(`⏭️  跳过非今天文件: ${htmlFile} (日期: ${fileDate})`);
      continue;
    }

    // 步骤3：通过关键词识别股票配置
    const stockConfig = matchStockConfig(htmlFile, stockConfigs);
    if (!stockConfig) {
      // 文件名中不包含任何配置的关键词，跳过
      console.log(`⚠️  未匹配到股票配置，跳过: ${htmlFile}`);
      continue;
    }

    // 步骤4：使用第一个关键词作为股票标识（用于分组）
    const stockKey = stockConfig.keywords[0];
    const htmlPath = path.resolve(watchDirectory, htmlFile);

    // 步骤5：检查是否已处理（避免重复处理）
    if (historyManager.isProcessed(stockKey, htmlPath)) {
      console.log(`⏭️  跳过已处理文件: ${htmlFile}`);
      continue;
    }

    // 步骤6：添加到待处理列表
    toProcess.push({
      htmlFile: htmlPath,
      stockConfig,
      stockKey
    });
  }

  return toProcess;
}

/**
 * 处理单个HTML文件
 * @param {Object} fileInfo - 文件信息
 * @param {Object} config - 配置对象
 * @param {HistoryManager} historyManager - 历史记录管理器
 */
async function processHtmlFile(fileInfo, config, historyManager) {
  const { htmlFile, stockConfig, stockKey } = fileInfo;
  const date = extractDateFromFilename(path.basename(htmlFile)) || 
               new Date().toISOString().split("T")[0];

  try {
    console.log(`\n📄 处理文件: ${path.basename(htmlFile)}`);

    // 1. 转换为图片（使用配置的输出目录）
    const outputDir = config.imageOutputDirectory || "./";
    const imagePaths = await convertHtmlToImages(htmlFile, outputDir);
    if (imagePaths.length === 0) {
      console.warn(`⚠️  未生成图片: ${htmlFile}`);
      return;
    }

    // 2. 发送到Discord
    await sendImagesToDiscord(
      stockConfig.webhookUrl,
      imagePaths,
      `📊 ${stockConfig.stockName} Gamma Hedging 图表 - ${date}`
    );

    // 3. 记录历史（按股票分组，确保不会混合不同股票的数据）
    historyManager.recordProcessed(stockKey, htmlFile, imagePaths, date);

    // 4. 检查是否需要AI分析（从第二天开始）
    // 
    // 逻辑说明：
    // - 第一天：只有 1 天数据，不执行分析
    // - 第二天开始：有 2 天数据，执行分析
    // - 重要：使用 stockKey 确保只获取同一股票的历史数据，不会混合不同股票
    const recentHistory = historyManager.getRecentHistory(stockKey, 2);
    
    // 触发条件：该股票至少有 2 天的历史数据
    if (recentHistory.length >= 2) {
      console.log(`\n🤖 开始AI分析: ${stockConfig.stockName} (${stockKey}, 最近${recentHistory.length}天)`);

      // 收集最近2天的图片（确保都是同一股票的）
      const recentImages = [];
      const timeLabels = [];

      for (const record of recentHistory) {
        // 验证：确保所有记录都是同一股票（通过 stockKey 已经保证）
        recentImages.push(...record.imagePaths);
        timeLabels.push(record.date);
      }

      console.log(`  📊 分析图片数量: ${recentImages.length}, 时间范围: ${timeLabels.join(" → ")}`);

      // 调用DeepSeek分析
      // stockName 和 stockCode 用于在 AI 提示词中显示股票信息
      const analysis = await analyzeWithDeepSeek(
        config.deepseek.apiKey,
        config.deepseek.baseUrl,
        config.deepseek.model,
        {
          name: stockConfig.stockName,  // 用于显示：如 "SPX"
          code: stockConfig.stockCode    // 用于显示：如 "SPX"（可以是代码）
        },
        recentImages,
        timeLabels
      );

      // 发送分析结果到Discord
      await sendMessageToDiscord(
        stockConfig.webhookUrl,
        `## 🤖 ${stockConfig.stockName} AI分析报告\n\n${analysis}`
      );
    }

    console.log(`✓ 处理完成: ${path.basename(htmlFile)}`);
  } catch (error) {
    console.error(`✗ 处理失败 ${htmlFile}:`, error.message);
  }
}

/**
 * 执行定时任务
 * @param {Object} config - 配置对象
 */
async function runScheduledTask(config) {
  console.log(`\n⏰ 执行定时任务: ${new Date().toLocaleString()}`);

  const historyManager = new HistoryManager(config.historyFile);

  // 扫描需要处理的文件
  const filesToProcess = scanHtmlFiles(
    config.watchDirectory,
    config.stockConfigs,
    historyManager
  );

  if (filesToProcess.length === 0) {
    console.log("📭 没有需要处理的文件");
    return;
  }

  console.log(`📋 找到 ${filesToProcess.length} 个文件需要处理`);

  // 逐个处理
  for (const fileInfo of filesToProcess) {
    await processHtmlFile(fileInfo, config, historyManager);
  }

  console.log(`\n✅ 定时任务完成`);
}

/**
 * 启动定时任务
 * 
 * 功能：
 * 1. 解析配置中的时间（如 "23:00"）
 * 2. 设置 cron 定时任务，每天在指定时间执行
 * 3. 执行时会自动：识别关键词 → 转换图片 → 发送Discord → AI分析
 * 
 * @param {Object} config - 配置对象
 */
function startScheduler(config) {
  // 解析时间（格式：HH:MM，如 "23:00"）
  const [hour, minute] = config.scheduleTime.split(":").map(Number);
  const cronExpression = `${minute} ${hour} * * *`; // 每天指定时间执行

  console.log(`📅 定时任务已设置: 每天 ${config.scheduleTime}`);
  console.log(`   将在每天 ${config.scheduleTime} 自动执行以下操作：`);
  console.log(`   1. 扫描目录中的 HTML 文件`);
  console.log(`   2. 通过关键词识别股票（spx/tsm）`);
  console.log(`   3. 转换为图片并发送到 Discord`);
  console.log(`   4. 从第二天开始，执行 AI 分析`);

  // 立即执行一次（可选，用于测试）
  // runScheduledTask(config).catch(console.error);

  // 设置定时任务
  cron.schedule(cronExpression, async () => {
    console.log(`\n${"=".repeat(50)}`);
    await runScheduledTask(config);
    console.log(`${"=".repeat(50)}\n`);
  });

  console.log("✅ 定时任务已启动，等待执行...");
}

module.exports = {
  runScheduledTask,
  startScheduler,
  scanHtmlFiles,
  processHtmlFile
};

