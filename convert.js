const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");

/**
 * 将HTML文件中的Plotly图导出为图片
 * @param {string} htmlPath - HTML文件路径
 * @param {string} outputDirectory - 图片输出目录（可选，默认为当前目录）
 * @returns {Promise<string[]>} 返回生成的图片文件路径数组
 */
async function convertHtmlToImages(htmlPath, outputDirectory = "./") {
  const absPath = path.resolve(htmlPath);
  const fileUrl = "file://" + absPath;
  const baseName = path.basename(absPath, path.extname(absPath));
  const outputImages = [];

  // 确保文件名包含日期前缀，避免文件覆盖
  // 例如: 2025-12-13_03;32_tsm_gamma -> 2025-12-13_03;32_tsm_gamma
  console.log(`📄 处理文件: ${baseName}`);

  // 确保输出目录存在
  const outputDir = path.resolve(outputDirectory);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 创建输出目录: ${outputDir}`);
  }

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    defaultViewport: { width: 1600, height: 2200 }
  });

  try {
    const page = await browser.newPage();
    await page.goto(fileUrl, { waitUntil: ["domcontentloaded", "networkidle0"] });

    // 等待页面加载完成
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 拿到所有 Plotly 图的 id
    const plotIds = await page.$$eval(".plotly-graph-div", nodes => 
      nodes.map(n => n.id).filter(Boolean)
    );
    
    if (!plotIds.length) {
      console.warn(`未找到 Plotly 图：${htmlPath}`);
      return outputImages;
    }

    // 逐个导出
    for (const id of plotIds) {
      try {
        const dataUrl = await page.evaluate(async (elementId) => {
          const el = document.getElementById(elementId);
          if (!el) throw new Error(`找不到元素: ${elementId}`);
          return await Plotly.toImage(el, { format: "png" });
        }, id);
        
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        const pngName = `${baseName}_${id}.png`;
        const pngPath = path.join(outputDir, pngName);
        fs.writeFileSync(pngPath, base64, "base64");
        outputImages.push(pngPath);
        console.log(`✓ 导出成功：${pngPath}`);
      } catch (error) {
        console.error(`✗ 导出失败 ${id}:`, error.message);
      }
    }

    await page.close();
  } finally {
    await browser.close();
  }

  return outputImages;
}

module.exports = { convertHtmlToImages };

