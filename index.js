const fs = require("fs");
const path = require("path");
const { startUploadScheduler, runUploadTask } = require("./upload-worker");
const { startAIScheduler, runAIAnalysisTask } = require("./ai-worker");

const configPath = path.resolve(__dirname, "config.json");

if (!fs.existsSync(configPath)) {
  console.error("❌ 配置文件不存在: config.json");
  process.exit(1);
}

function loadConfig() {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function isPlaceholderWebhook(url) {
  return !url || String(url).startsWith("YOUR_");
}

function validateUploadConfig(config) {
  const missingWebhooks = (config.stockConfigs || []).filter((stock) => isPlaceholderWebhook(stock.webhookUrl));
  if (missingWebhooks.length > 0) {
    const symbols = missingWebhooks.map((stock) => stock.stockCode || stock.keywords?.[0] || "unknown").join(", ");
    throw new Error(`请在 config.json 中配置上传 webhook，缺少: ${symbols}`);
  }

  if (!config.watchDirectory) {
    throw new Error("缺少 watchDirectory 配置");
  }

  if (!config.historyFile) {
    throw new Error("缺少 historyFile 配置");
  }
}

function hasAIConfig(config) {
  return Boolean(config.gemini?.apiKey && config.gemini?.baseUrl && config.gemini?.model);
}

function isExplicitAIRequest(args) {
  return args.includes("--ai-only") || args.includes("--run-ai-now");
}

async function runNow(mode, config) {
  if (mode === "upload") {
    validateUploadConfig(config);
    await runUploadTask(config);
    return;
  }

  if (mode === "ai") {
    if (!hasAIConfig(config)) {
      throw new Error("缺少 Gemini 配置，无法执行 AI 分析");
    }
    await runAIAnalysisTask(config);
    return;
  }

  validateUploadConfig(config);
  await runUploadTask(config);

  if (hasAIConfig(config)) {
    await runAIAnalysisTask(config);
  } else {
    console.warn("⚠️  未配置 Gemini，已跳过 AI 分析");
  }
}

async function main() {
  const args = process.argv.slice(2);
  const config = loadConfig();

  const runUploadOnly = args.includes("--upload-only");
  const runAIOnly = args.includes("--ai-only");
  const runUploadNowFlag = args.includes("--run-upload-now");
  const runAINowFlag = args.includes("--run-ai-now");
  const runNowFlag = args.includes("--run-now");

  if (runUploadOnly && runAIOnly) {
    throw new Error("--upload-only 和 --ai-only 不能同时使用");
  }

  if (runUploadNowFlag && runAINowFlag) {
    await runNow("both", config);
    return;
  }

  if (runUploadNowFlag) {
    await runNow("upload", config);
    return;
  }

  if (runAINowFlag) {
    await runNow("ai", config);
    return;
  }

  if (runNowFlag) {
    if (runUploadOnly) {
      await runNow("upload", config);
      return;
    }
    if (runAIOnly) {
      await runNow("ai", config);
      return;
    }
    await runNow("both", config);
    return;
  }

  const shouldStartUpload = !runAIOnly;
  const shouldStartAI = !runUploadOnly;

  if (shouldStartUpload) {
    validateUploadConfig(config);
    startUploadScheduler(config);
  }

  if (shouldStartAI) {
    if (hasAIConfig(config)) {
      startAIScheduler(config);
    } else if (isExplicitAIRequest(args)) {
      throw new Error("缺少 Gemini 配置，无法启动 AI 分析任务");
    } else {
      console.warn("⚠️  未配置 Gemini，已跳过 AI 定时任务");
    }
  }

  if (!shouldStartUpload && !shouldStartAI) {
    console.log("没有可执行的任务，请检查参数");
    return;
  }

  console.log("\n💡 常用命令：");
  console.log("   node index.js --run-upload-now   # 立即执行上传");
  console.log("   node index.js --run-ai-now       # 立即执行 AI 分析");
  console.log("   node index.js --upload-only      # 仅启动上传定时任务");
  console.log("   node index.js --ai-only          # 仅启动 AI 定时任务");
  console.log("按 Ctrl+C 退出\n");
}

process.on("SIGINT", () => {
  console.log("\n👋 程序退出");
  process.exit(0);
});

main().catch((error) => {
  console.error("❌ 启动失败:", error.message);
  process.exit(1);
});
