const fs = require("fs");
const path = require("path");
const { HistoryManager } = require("./history");
const { analyzeWithGemini } = require("./gemini");
const { sendMessageToDiscord } = require("./discord");

/**
 * 测试AI分析功能（模拟第二天的场景）
 * 
 * 使用方法：
 * 1. 确保 history.json 中至少有一天的数据
 * 2. 运行: node test-ai.js
 * 
 * 脚本会：
 * - 为每个股票添加一个"昨天"的记录（使用现有图片）
 * - 触发AI分析
 * - 发送分析结果到Discord
 */

// 加载配置
const configPath = path.resolve(__dirname, "config.json");
if (!fs.existsSync(configPath)) {
  console.error("❌ 配置文件不存在: config.json");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// 验证配置
if (!config.gemini || !config.gemini.apiKey) {
  console.error("❌ 请在 config.json 中配置 Gemini API key");
  process.exit(1);
}

async function testAIAnalysis() {
  console.log("🧪 开始测试AI分析功能（模拟第二天场景）\n");

  const historyManager = new HistoryManager(config.historyFile);
  const history = historyManager.history;

  // 检查是否有历史记录
  if (Object.keys(history).length === 0) {
    console.error("❌ history.json 中没有历史记录");
    console.log("💡 提示: 请先运行一次正常流程，生成第一天的数据");
    process.exit(1);
  }

  // 为每个股票添加"昨天"的记录（用于模拟第二天）
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  console.log(`📅 模拟日期: ${yesterdayStr}（昨天）\n`);

  for (const stockKey in history) {
    const records = history[stockKey];
    if (records.length === 0) continue;

    // 获取最新的记录作为"昨天"的数据
    const latestRecord = records[records.length - 1];
    
    // 检查是否已经有昨天的记录
    const hasYesterday = records.some(r => r.date === yesterdayStr);
    if (hasYesterday) {
      console.log(`⏭️  ${stockKey} 已经有 ${yesterdayStr} 的记录，跳过添加`);
      continue;
    }

    // 创建"昨天"的记录（使用现有图片，但日期改为昨天）
    const yesterdayRecord = {
      date: yesterdayStr,
      htmlFile: latestRecord.htmlFile.replace(
        latestRecord.date,
        yesterdayStr
      ),
      imagePaths: latestRecord.imagePaths, // 使用相同的图片
      processedAt: new Date().toISOString()
    };

    // 添加到历史记录
    if (!history[stockKey]) {
      history[stockKey] = [];
    }
    history[stockKey].push(yesterdayRecord);
    history[stockKey].sort((a, b) => a.date.localeCompare(b.date));

    console.log(`✓ 为 ${stockKey} 添加了 ${yesterdayStr} 的记录`);
  }

  // 保存更新后的历史记录
  historyManager.history = history;
  historyManager.saveHistory();
  console.log("\n✅ 历史记录已更新\n");

  // 现在为每个股票执行AI分析
  for (const stockConfig of config.stockConfigs) {
    const stockKey = stockConfig.keywords[0];
    const recentHistory = historyManager.getRecentRecords(stockKey, 2);

    if (recentHistory.length < 2) {
      console.log(`⚠️  ${stockConfig.stockName} (${stockKey}) 只有 ${recentHistory.length} 天的数据，跳过分析`);
      continue;
    }

    console.log(`\n🤖 开始AI分析: ${stockConfig.stockName} (${stockKey})`);
    console.log(`   数据范围: ${recentHistory.map(r => r.date).join(" → ")}`);

    try {
      // 收集最近2天的图片（去重，确保每张图片只发送一次）
      const recentImages = [];
      const timeLabels = [];
      const seenImages = new Set(); // 用于去重

      for (const record of recentHistory) {
        // 检查图片文件是否存在，并去重
        for (const imagePath of record.imagePaths) {
          if (!fs.existsSync(imagePath)) {
            console.warn(`⚠️  警告: ${record.date} 的图片文件不存在: ${imagePath}`);
            continue;
          }

          // 去重：如果图片路径已存在，跳过
          if (seenImages.has(imagePath)) {
            console.warn(`⚠️  检测到重复图片，跳过: ${path.basename(imagePath)}`);
            continue;
          }

          seenImages.add(imagePath);
          recentImages.push(imagePath);
        }
        timeLabels.push(record.date);
      }

      if (recentImages.length === 0) {
        console.error(`❌ ${stockConfig.stockName} 没有可用的图片文件`);
        continue;
      }

      // 确保每个日期至少有一张不同的图片
      if (recentImages.length < recentHistory.length) {
        console.warn(`⚠️  警告: 收集到的图片数量 (${recentImages.length}) 少于日期数量 (${recentHistory.length})`);
        console.warn(`   这可能导致AI无法进行有效的历史趋势分析`);
      }

      console.log(`  📊 分析图片数量: ${recentImages.length}, 时间范围: ${timeLabels.join(" → ")}`);
      console.log(`  📁 图片文件: ${recentImages.map(p => path.basename(p)).join(", ")}`);

      // 调用Gemini分析
      const analysis = await analyzeWithGemini(
        config.gemini.apiKey,
        config.gemini.baseUrl,
        config.gemini.model,
        {
          name: stockConfig.stockName,
          code: stockConfig.stockCode
        },
        recentImages,
        timeLabels
      );

      // 发送分析结果到Discord
      await sendMessageToDiscord(
        stockConfig.webhookUrl,
        `## 🤖 ${stockConfig.stockName} AI分析报告\n\n${analysis}`
      );

      console.log(`✅ ${stockConfig.stockName} AI分析完成并已发送到Discord`);
    } catch (error) {
      console.error(`❌ ${stockConfig.stockName} AI分析失败:`, error.message);
    }
  }

  console.log("\n🎉 测试完成！");
}

// 运行测试
testAIAnalysis().catch(error => {
  console.error("❌ 测试失败:", error);
  process.exit(1);
});

