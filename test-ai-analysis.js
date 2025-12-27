const { HistoryManager } = require("./history");
const { analyzeWithGemini } = require("./gemini");
const { sendMessageToDiscord } = require("./discord");
const config = JSON.parse(require("fs").readFileSync("config.json", "utf8"));

async function testAIAnalysis() {
  console.log("🧪 测试AI分析功能...\n");

  const historyManager = new HistoryManager(config.historyFile);

  for (const stockConfig of config.stockConfigs) {
    const stockKey = stockConfig.keywords[0];
    const recentHistory = historyManager.getRecentRecords(stockKey, 2);

    console.log(`📊 检查股票: ${stockConfig.stockName} (${stockKey})`);
    console.log(`   历史记录数量: ${recentHistory.length}`);

    if (recentHistory.length >= 2) {
      console.log(`   ✅ 开始分析...`);

      // 收集数据
      const recentImages = [];
      const tvcodeDataList = [];
      const timeLabels = [];

      for (const record of recentHistory) {
        timeLabels.push(record.date);

        // 收集gamma图片
        if (record.gamma && record.gamma.imagePaths) {
          for (const imagePath of record.gamma.imagePaths) {
            if (require("fs").existsSync(imagePath)) {
              recentImages.push(imagePath);
              console.log(`   📸 找到图片: ${imagePath.split('/').pop()}`);
            } else {
              console.log(`   ❌ 图片不存在: ${imagePath}`);
            }
          }
        }

        // 收集tvcode数据
        if (record.tvcode && record.tvcode.data) {
          tvcodeDataList.push({
            date: record.date,
            data: record.tvcode.data
          });
          console.log(`   📝 找到tvcode数据: ${record.date}`);
        }
      }

      console.log(`   📊 数据汇总: ${recentImages.length} 张图片, ${tvcodeDataList.length} 条tvcode数据`);

      if (recentImages.length > 0 || tvcodeDataList.length > 0) {
        try {
          console.log(`   🤖 调用Gemini API...`);

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

          console.log(`   ✅ AI分析完成，长度: ${analysis.length} 字符`);
          console.log(`   📄 分析结果预览: ${analysis.substring(0, 100)}...`);

          // 发送到Discord
          if (config.aiAnalysisWebhookUrl) {
            await sendMessageToDiscord(
              config.aiAnalysisWebhookUrl,
              `## ${stockConfig.stockName} 分析报告\n\n${analysis}`
            );
            console.log(`   ✅ 已发送到统一频道`);
          } else {
            console.log(`   ⚠️ 未配置AI分析频道`);
          }

        } catch (error) {
          console.error(`   ❌ AI分析失败: ${error.message}`);
        }
      } else {
        console.log(`   ⚠️ 没有可用的数据进行分析`);
      }
    } else {
      console.log(`   ❌ 历史数据不足（需要至少2天）`);
    }

    console.log(); // 空行分隔
  }

  console.log("🎉 测试完成！");
}

// 运行测试
testAIAnalysis().catch(error => {
  console.error("❌ 测试失败:", error);
  process.exit(1);
});
