const fs = require("fs");
const path = require("path");
const { HistoryManager } = require("./history");
const { analyzeWithGemini } = require("./gemini");
const { sendMessageToDiscord } = require("./discord");
const { convertHtmlToImages } = require("./convert");
const { extractTvcodeData, isTvcodeFile, isGammaFile } = require("./tvcode");

/**
 * 测试AI分析功能
 * 
 * 使用方法：
 * 运行: node test-ai.js
 * 
 * 脚本会：
 * - 扫描目录，找到最近两个日期的文件
 * - 对于gamma文件，转换为图片
 * - 对于tvcode文件，提取文本数据
 * - 收集最近两个日期的数据（gamma图片 + tvcode数据）
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

/**
 * 从文件名提取日期
 */
function extractDateFromFilename(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * 从文件名匹配股票配置
 */
function matchStockConfig(filename, stockConfigs) {
  const lowerFilename = filename.toLowerCase();
  for (const config of stockConfigs) {
    if (config.keywords.some(keyword => lowerFilename.includes(keyword.toLowerCase()))) {
      return config;
    }
  }
  return null;
}

/**
 * 扫描目录，找到最近两个日期的文件
 */
function findRecentFiles(watchDirectory, stockConfigs) {
  const files = fs.readdirSync(watchDirectory);
  const htmlFiles = files.filter(f => f.endsWith(".html"));
  
  // 按股票和日期组织文件
  const filesByStock = {};
  
  for (const htmlFile of htmlFiles) {
    const fileDate = extractDateFromFilename(htmlFile);
    if (!fileDate) continue;
    
    const stockConfig = matchStockConfig(htmlFile, stockConfigs);
    if (!stockConfig) continue;
    
    const stockKey = stockConfig.keywords[0];
    const fileType = isTvcodeFile(htmlFile) ? "tvcode" : (isGammaFile(htmlFile) ? "gamma" : null);
    if (!fileType) continue;
    
    if (!filesByStock[stockKey]) {
      filesByStock[stockKey] = {};
    }
    
    if (!filesByStock[stockKey][fileDate]) {
      filesByStock[stockKey][fileDate] = {};
    }
    
    filesByStock[stockKey][fileDate][fileType] = path.resolve(watchDirectory, htmlFile);
  }
  
  // 为每个股票找到最近两个日期
  const result = {};
  for (const stockKey in filesByStock) {
    const dates = Object.keys(filesByStock[stockKey])
      .sort((a, b) => b.localeCompare(a)) // 降序，最新的在前
      .slice(0, 2); // 取最近2个日期
    
    if (dates.length >= 2) {
      result[stockKey] = dates.map(date => ({
        date,
        gamma: filesByStock[stockKey][date].gamma || null,
        tvcode: filesByStock[stockKey][date].tvcode || null
      }));
    }
  }
  
  return result;
}

async function testAIAnalysis() {
  console.log("🧪 开始测试AI分析功能\n");

  const watchDirectory = config.watchDirectory || "./";
  const outputDir = config.imageOutputDirectory || "./images";
  
  // 1. 扫描目录，找到最近两个日期的文件
  console.log("📂 扫描目录，查找最近两个日期的文件...");
  const recentFiles = findRecentFiles(watchDirectory, config.stockConfigs);
  
  if (Object.keys(recentFiles).length === 0) {
    console.error("❌ 未找到最近两个日期的文件");
    console.log("💡 提示: 确保目录中有至少两个日期的gamma和tvcode文件");
    process.exit(1);
  }
  
  console.log(`✓ 找到 ${Object.keys(recentFiles).length} 个股票的数据\n`);
  
  // 2. 为每个股票处理文件并分析
  for (const stockConfig of config.stockConfigs) {
    const stockKey = stockConfig.keywords[0];
    const files = recentFiles[stockKey];
    
    if (!files || files.length < 2) {
      console.log(`⚠️  ${stockConfig.stockName} (${stockKey}) 没有足够的数据（需要2个日期），跳过`);
      continue;
    }
    
    console.log(`\n📊 处理股票: ${stockConfig.stockName} (${stockKey})`);
    console.log(`   日期范围: ${files.map(f => f.date).join(" → ")}`);
    
    try {
      // 收集gamma图片和tvcode数据
      const recentImages = [];
      const tvcodeDataList = [];
      const timeLabels = [];
      
      for (const fileInfo of files) {
        timeLabels.push(fileInfo.date);
        
        // 处理gamma文件：转换为图片
        if (fileInfo.gamma && fs.existsSync(fileInfo.gamma)) {
          console.log(`  📄 处理gamma文件: ${path.basename(fileInfo.gamma)}`);
          const imagePaths = await convertHtmlToImages(fileInfo.gamma, outputDir);
          if (imagePaths.length > 0) {
            recentImages.push(...imagePaths);
            console.log(`    ✓ 生成 ${imagePaths.length} 张图片`);
          }
        } else {
          console.log(`  ⚠️  日期 ${fileInfo.date} 没有gamma文件`);
        }
        
        // 处理tvcode文件：提取文本数据
        if (fileInfo.tvcode && fs.existsSync(fileInfo.tvcode)) {
          console.log(`  📄 处理tvcode文件: ${path.basename(fileInfo.tvcode)}`);
          const tvcodeData = await extractTvcodeData(fileInfo.tvcode);
          tvcodeDataList.push({
            date: fileInfo.date,
            data: tvcodeData
          });
          console.log(`    ✓ 提取tvcode数据: ${tvcodeData.substring(0, 50)}...`);
        } else {
          console.log(`  ⚠️  日期 ${fileInfo.date} 没有tvcode文件`);
        }
      }
      
      // 验证数据
      if (recentImages.length === 0 && tvcodeDataList.length === 0) {
        console.error(`❌ ${stockConfig.stockName} 没有可用的数据（gamma图片或tvcode数据）`);
        continue;
      }
      
      console.log(`\n  📊 Gamma图片数量: ${recentImages.length}`);
      console.log(`  📝 Tvcode数据数量: ${tvcodeDataList.length}`);
      console.log(`  📅 时间范围: ${timeLabels.join(" → ")}`);
      
      // 3. 调用AI分析
      console.log(`\n🤖 开始AI分析: ${stockConfig.stockName}`);
      
      const analysis = await analyzeWithGemini(
        config.gemini.apiKey,
        config.gemini.baseUrl,
        config.gemini.model,
        {
          name: stockConfig.stockName,
          code: stockConfig.stockCode
        },
        recentImages,
        timeLabels,
        tvcodeDataList,
        config.gemini.prompt || "根据tvcode和gamma的变化，用最简短的文字推演今天的走势。"
      );
      
      // 4. 发送分析结果到Discord
      await sendMessageToDiscord(
        stockConfig.webhookUrl,
        `## ${stockConfig.stockName} 分析报告\n\n${analysis}`
      );
      
      console.log(`✅ ${stockConfig.stockName} AI分析完成并已发送到Discord`);
    } catch (error) {
      console.error(`❌ ${stockConfig.stockName} 处理失败:`, error.message);
      console.error(error.stack);
    }
  }
  
  console.log("\n🎉 测试完成！");
}

// 运行测试
testAIAnalysis().catch(error => {
  console.error("❌ 测试失败:", error);
  process.exit(1);
});
