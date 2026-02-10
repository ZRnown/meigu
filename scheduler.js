const {
  matchStockConfig,
  extractDateFromFilename,
  scanHtmlFiles,
  processHtmlFile,
  runUploadTask,
  startUploadScheduler
} = require("./upload-worker");
const { runAIAnalysisTask, startAIScheduler } = require("./ai-worker");

async function runScheduledTask(config) {
  await runUploadTask(config);

  if (config.gemini?.apiKey) {
    await runAIAnalysisTask(config);
  } else {
    console.warn("⚠️  未配置 Gemini，已跳过 AI 分析");
  }
}

function startScheduler(config) {
  startUploadScheduler(config);

  if (config.gemini?.apiKey) {
    startAIScheduler(config);
  } else {
    console.warn("⚠️  未配置 Gemini，已跳过 AI 定时任务");
  }
}

module.exports = {
  extractDateFromFilename,
  matchStockConfig,
  scanHtmlFiles,
  processHtmlFile,
  runScheduledTask,
  startScheduler
};
