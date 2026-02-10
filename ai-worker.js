const fs = require("fs");
const { HistoryManager } = require("./history");
const { getStockKey } = require("./upload-worker");

function buildAnalysisInput(records, maxDays = 2) {
  const sortedRecords = [...records]
    .filter((record) => record && record.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const selectedRecords = sortedRecords.slice(-Math.max(1, maxDays));

  const recentImages = [];
  const tvcodeDataList = [];
  const timeLabels = [];
  const seenImages = new Set();

  for (const record of selectedRecords) {
    timeLabels.push(record.date);

    if (record.gamma?.imagePaths) {
      for (const imagePath of record.gamma.imagePaths) {
        if (!imagePath || seenImages.has(imagePath)) {
          continue;
        }

        if (fs.existsSync(imagePath)) {
          recentImages.push(imagePath);
          seenImages.add(imagePath);
        }
      }
    }

    if (record.tvcode?.data) {
      tvcodeDataList.push({
        date: record.date,
        data: record.tvcode.data
      });
    }
  }

  return {
    selectedRecords,
    recentImages,
    tvcodeDataList,
    timeLabels
  };
}

async function runAIAnalysisTask(config) {
  console.log(`\n🤖 执行 AI 分析任务: ${new Date().toLocaleString()}`);

  if (!config.gemini?.apiKey) {
    console.warn("⚠️  缺少 Gemini API 配置，跳过 AI 分析");
    return { analyzedCount: 0 };
  }

  const { analyzeWithGemini } = require("./gemini");
  const { sendMessageToDiscord } = require("./discord");

  const historyManager = new HistoryManager(config.historyFile);
  const lookbackDays = Number(config.aiAnalysisLookbackDays || 2);
  let analyzedCount = 0;

  for (const stockConfig of config.stockConfigs) {
    const stockKey = getStockKey(stockConfig);
    const records = historyManager.getRecentRecords(stockKey, lookbackDays);

    console.log(`\n📊 检查股票: ${stockConfig.stockName} (${stockKey})`);
    console.log(`   可用记录: ${records.length}`);

    if (!records.length) {
      console.log("   ⏭️  跳过：暂无历史记录");
      continue;
    }

    const input = buildAnalysisInput(records, lookbackDays);
    const hasAnyInput = input.recentImages.length > 0 || input.tvcodeDataList.length > 0;

    if (!hasAnyInput) {
      console.log("   ⏭️  跳过：没有可用图片或 tvcode 数据");
      continue;
    }

    console.log(`   📅 时间范围: ${input.timeLabels.join(" → ")}`);
    console.log(`   📸 图片数量: ${input.recentImages.length}`);
    console.log(`   📝 Tvcode 数量: ${input.tvcodeDataList.length}`);

    try {
      const analysis = await analyzeWithGemini(
        config.gemini.apiKey,
        config.gemini.baseUrl,
        config.gemini.model,
        {
          name: stockConfig.stockName,
          code: stockConfig.stockCode
        },
        input.recentImages,
        input.timeLabels,
        input.tvcodeDataList,
        config.gemini.prompt || "根据tvcode和gamma的变化，用最简短的文字推演今天的走势。"
      );

      if (config.aiAnalysisWebhookUrl) {
        await sendMessageToDiscord(
          config.aiAnalysisWebhookUrl,
          `## ${stockConfig.stockName} 分析报告\n\n${analysis}`
        );
        console.log(`   ✅ ${stockConfig.stockName} AI 分析已发送`);
      } else {
        console.log("   ⚠️  未配置 aiAnalysisWebhookUrl，跳过发送");
      }

      analyzedCount += 1;
    } catch (error) {
      console.error(`   ❌ ${stockConfig.stockName} AI 分析失败: ${error.message}`);
    }
  }

  console.log(`\n📊 AI 分析完成，共处理 ${analyzedCount} 个股票`);
  return { analyzedCount };
}

function startAIScheduler(config) {
  const cron = require("node-cron");

  const scheduleTime = config.aiScheduleTime || config.scheduleTime;
  if (!scheduleTime) {
    throw new Error("缺少 aiScheduleTime（或兼容字段 scheduleTime）配置");
  }

  const [hour, minute] = scheduleTime.split(":").map(Number);
  const cronExpression = `${minute} ${hour} * * *`;

  console.log(`📅 AI 分析任务已设置: 每天 ${scheduleTime}`);
  console.log("✅ AI 分析定时任务已启动，等待执行...");

  cron.schedule(cronExpression, async () => {
    console.log(`\n${"=".repeat(50)}`);
    await runAIAnalysisTask(config);
    console.log(`${"=".repeat(50)}\n`);
  });
}

module.exports = {
  buildAnalysisInput,
  runAIAnalysisTask,
  startAIScheduler
};
