const fs = require("fs");
const path = require("path");
const { HistoryManager } = require("./history");
const { extractTvcodeData, isTvcodeFile, isGammaFile } = require("./tvcode");

const DEFAULT_IMAGE_OPTIONS = {
  format: "jpeg",
  scale: 2,
  waitMs: 3000,
  maxFileSizeMB: 7.5
};

function getStockKey(stockConfig) {
  if (stockConfig.stockCode) {
    return String(stockConfig.stockCode).toLowerCase();
  }
  return String(stockConfig.keywords?.[0] || "").toLowerCase();
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractDateFromFilename(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasBoundedKeyword(filenameBaseLower, keyword) {
  const safeKeyword = String(keyword || "").trim().toLowerCase();
  if (!safeKeyword) {
    return false;
  }

  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(safeKeyword)}($|[^a-z0-9])`, "i");
  return pattern.test(filenameBaseLower);
}

function matchStockConfig(filename, stockConfigs) {
  const filenameBaseLower = path.basename(filename, path.extname(filename)).toLowerCase();
  let bestMatch = null;
  let bestKeywordLength = -1;

  for (const stockConfig of stockConfigs) {
    if (!Array.isArray(stockConfig.keywords)) {
      continue;
    }

    for (const keyword of stockConfig.keywords) {
      if (!hasBoundedKeyword(filenameBaseLower, keyword)) {
        continue;
      }

      const keywordLength = String(keyword).trim().length;
      if (keywordLength > bestKeywordLength) {
        bestMatch = stockConfig;
        bestKeywordLength = keywordLength;
      }
    }
  }

  return bestMatch;
}

function normalizeImageOptions(config) {
  return {
    ...DEFAULT_IMAGE_OPTIONS,
    ...(config.imageOptions || {})
  };
}

function scanHtmlFiles(watchDirectory, stockConfigs, historyManager) {
  const files = fs.readdirSync(watchDirectory);
  const htmlFiles = files.filter((file) => file.endsWith(".html"));
  const today = getLocalDateString();
  const toProcess = [];

  console.log(`📅 今天日期: ${today}`);

  for (const htmlFile of htmlFiles) {
    const fileDate = extractDateFromFilename(htmlFile);
    if (!fileDate) {
      console.log(`⚠️  无法从文件名提取日期，跳过: ${htmlFile}`);
      continue;
    }

    if (fileDate !== today) {
      console.log(`⏭️  跳过非今天文件: ${htmlFile} (日期: ${fileDate})`);
      continue;
    }

    const stockConfig = matchStockConfig(htmlFile, stockConfigs);
    if (!stockConfig) {
      console.log(`⚠️  未匹配到股票配置，跳过: ${htmlFile}`);
      continue;
    }

    const fileType = isTvcodeFile(htmlFile) ? "tvcode" : isGammaFile(htmlFile) ? "gamma" : "unknown";
    if (fileType === "unknown") {
      console.log(`⚠️  无法识别文件类型（非tvcode也非gamma），跳过: ${htmlFile}`);
      continue;
    }

    const stockKey = getStockKey(stockConfig);
    const htmlPath = path.resolve(watchDirectory, htmlFile);

    if (historyManager.isProcessed(stockKey, htmlPath, fileType)) {
      console.log(`⏭️  跳过已处理文件: ${htmlFile}`);
      continue;
    }

    toProcess.push({
      htmlFile: htmlPath,
      stockConfig,
      stockKey,
      fileType
    });
  }

  return toProcess;
}

async function processHtmlFile(fileInfo, config, historyManager) {
  const { htmlFile, stockConfig, stockKey, fileType } = fileInfo;
  const date = extractDateFromFilename(path.basename(htmlFile)) || getLocalDateString();

  try {
    console.log(`\n📄 处理文件: ${path.basename(htmlFile)} (类型: ${fileType})`);

    if (fileType === "gamma") {
      const { convertHtmlToImages } = require("./convert");
      const { sendImagesToDiscord } = require("./discord");

      const outputDir = config.imageOutputDirectory || "./images";
      const imagePaths = await convertHtmlToImages(htmlFile, outputDir, normalizeImageOptions(config));

      if (imagePaths.length === 0) {
        console.warn(`⚠️  未生成图片: ${htmlFile}`);
        return;
      }

      await sendImagesToDiscord(
        stockConfig.webhookUrl,
        imagePaths,
        `📊 ${stockConfig.stockName} Gamma Hedging 图表 - ${date}`
      );

      historyManager.recordProcessed(stockKey, htmlFile, imagePaths, date, "gamma");
    } else {
      const tvcodeData = await extractTvcodeData(htmlFile);
      console.log(`✓ 提取tvcode数据: ${tvcodeData.substring(0, 100)}...`);
      historyManager.recordProcessed(stockKey, htmlFile, [], date, "tvcode", tvcodeData);
    }

    console.log(`✓ 处理完成: ${path.basename(htmlFile)}`);
  } catch (error) {
    console.error(`✗ 处理失败 ${htmlFile}:`, error.message);
  }
}

async function runUploadTask(config) {
  console.log(`\n⏰ 执行上传任务: ${new Date().toLocaleString()}`);

  const historyManager = new HistoryManager(config.historyFile);
  const filesToProcess = scanHtmlFiles(config.watchDirectory, config.stockConfigs, historyManager);

  if (filesToProcess.length === 0) {
    console.log("📭 没有需要处理的文件");
    return { processedCount: 0 };
  }

  console.log(`📋 找到 ${filesToProcess.length} 个文件需要处理`);

  for (const fileInfo of filesToProcess) {
    await processHtmlFile(fileInfo, config, historyManager);
  }

  console.log("\n✅ 上传任务完成");
  return { processedCount: filesToProcess.length };
}

function startUploadScheduler(config) {
  const cron = require("node-cron");

  const scheduleTime = config.uploadScheduleTime || config.scheduleTime;
  if (!scheduleTime) {
    throw new Error("缺少 uploadScheduleTime（或兼容字段 scheduleTime）配置");
  }

  const [hour, minute] = scheduleTime.split(":").map(Number);
  const cronExpression = `${minute} ${hour} * * *`;

  console.log(`📅 上传任务已设置: 每天 ${scheduleTime}`);
  console.log("✅ 上传定时任务已启动，等待执行...");

  cron.schedule(cronExpression, async () => {
    console.log(`\n${"=".repeat(50)}`);
    await runUploadTask(config);
    console.log(`${"=".repeat(50)}\n`);
  });
}

module.exports = {
  getStockKey,
  getLocalDateString,
  extractDateFromFilename,
  matchStockConfig,
  scanHtmlFiles,
  processHtmlFile,
  runUploadTask,
  startUploadScheduler
};
