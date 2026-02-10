const fs = require("fs");
const path = require("path");

const DEFAULT_CONVERT_OPTIONS = {
  format: "jpeg",
  scale: 2,
  waitMs: 3000,
  maxFileSizeMB: 7.5
};

function normalizeConvertOptions(options = {}) {
  const normalized = {
    ...DEFAULT_CONVERT_OPTIONS,
    ...options
  };

  const format = String(normalized.format || "jpeg").toLowerCase();
  normalized.format = format === "png" ? "png" : "jpeg";
  normalized.scale = Math.max(1, Number(normalized.scale) || DEFAULT_CONVERT_OPTIONS.scale);
  normalized.waitMs = Math.max(0, Number(normalized.waitMs) || DEFAULT_CONVERT_OPTIONS.waitMs);
  normalized.maxFileSizeMB = Math.max(1, Number(normalized.maxFileSizeMB) || DEFAULT_CONVERT_OPTIONS.maxFileSizeMB);

  return normalized;
}

function loadPuppeteerModule() {
  try {
    return {
      puppeteer: require("puppeteer"),
      executablePath: null
    };
  } catch (_) {
    const puppeteerCore = require("puppeteer-core");
    const executablePath =
      process.env.CHROME_EXECUTABLE_PATH ||
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

    return {
      puppeteer: puppeteerCore,
      executablePath
    };
  }
}

function buildFilename(baseName, plotId, format) {
  const extension = format === "png" ? "png" : "jpg";
  return `${baseName}_${plotId}.${extension}`;
}

async function exportPlot(page, plotId, options) {
  return page.evaluate(
    async (elementId, exportOptions) => {
      if (!window.Plotly) {
        throw new Error("页面中未找到 Plotly 对象");
      }

      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`找不到图表元素: ${elementId}`);
      }

      const width = Math.round(exportOptions.width || element.clientWidth || 1200);
      const height = Math.round(exportOptions.height || element.clientHeight || 800);

      return Plotly.toImage(element, {
        format: exportOptions.format,
        width,
        height,
        scale: exportOptions.scale
      });
    },
    plotId,
    options
  );
}

async function exportWithSizeGuard(page, plotId, options) {
  const maxBytes = options.maxFileSizeMB * 1024 * 1024;
  const attempts = [
    { format: options.format, scale: options.scale },
    { format: "jpeg", scale: options.scale },
    { format: "jpeg", scale: 1 }
  ];

  const seen = new Set();
  let fallbackResult = null;

  for (const attempt of attempts) {
    const key = `${attempt.format}:${attempt.scale}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const dataUrl = await exportPlot(page, plotId, {
      format: attempt.format,
      scale: attempt.scale
    });

    const base64Payload = dataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
    const buffer = Buffer.from(base64Payload, "base64");
    const result = {
      format: attempt.format,
      buffer
    };

    if (buffer.length <= maxBytes) {
      return result;
    }

    fallbackResult = result;
  }

  return fallbackResult;
}

/**
 * 将HTML文件中的Plotly图导出为图片（本地完成压缩后再上传）
 * @param {string} htmlPath - HTML文件路径
 * @param {string} outputDirectory - 图片输出目录
 * @param {Object} options - 输出选项
 * @returns {Promise<string[]>}
 */
async function convertHtmlToImages(htmlPath, outputDirectory = "./", options = {}) {
  const settings = normalizeConvertOptions(options);
  const absPath = path.resolve(htmlPath);
  const fileUrl = `file://${absPath}`;
  const baseName = path.basename(absPath, path.extname(absPath));
  const outputImages = [];

  console.log(`📄 处理文件: ${baseName}`);

  const outputDir = path.resolve(outputDirectory);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 创建输出目录: ${outputDir}`);
  }

  const { puppeteer, executablePath } = loadPuppeteerModule();
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: executablePath || undefined,
    defaultViewport: { width: 1600, height: 2200 }
  });

  try {
    const page = await browser.newPage();
    await page.goto(fileUrl, { waitUntil: ["domcontentloaded", "networkidle0"] });

    if (settings.waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, settings.waitMs));
    }

    const plotIds = await page.$$eval(".plotly-graph-div", (nodes) => nodes.map((node) => node.id).filter(Boolean));

    if (!plotIds.length) {
      console.warn(`未找到 Plotly 图：${htmlPath}`);
      await page.close();
      return outputImages;
    }

    for (const plotId of plotIds) {
      try {
        const imageResult = await exportWithSizeGuard(page, plotId, settings);
        if (!imageResult) {
          console.warn(`⚠️  图表导出为空，跳过: ${plotId}`);
          continue;
        }

        const filename = buildFilename(baseName, plotId, imageResult.format);
        const outputPath = path.join(outputDir, filename);

        fs.writeFileSync(outputPath, imageResult.buffer);
        outputImages.push(outputPath);

        const kb = (imageResult.buffer.length / 1024).toFixed(1);
        console.log(`✓ 导出成功：${filename} (${kb} KB, ${imageResult.format.toUpperCase()})`);
      } catch (error) {
        console.error(`✗ 导出失败 ${plotId}: ${error.message}`);
      }
    }

    await page.close();
  } finally {
    await browser.close();
  }

  return outputImages;
}

module.exports = {
  convertHtmlToImages,
  normalizeConvertOptions
};
