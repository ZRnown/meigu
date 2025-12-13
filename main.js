const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");

/**
 * 将页面中所有 Plotly 图导出为图片（最简单直接的方法）
 * @param {import("puppeteer").Page} page
 * @param {string} htmlPath - 原始 html 绝对路径
 */
async function exportPlotlyDivs(page, htmlPath) {
  // 等待页面加载完成
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 拿到所有 Plotly 图的 id
  const plotIds = await page.$$eval(".plotly-graph-div", nodes => 
    nodes.map(n => n.id).filter(Boolean)
  );
  
  if (!plotIds.length) {
    console.warn(`未找到 Plotly 图：${htmlPath}`);
    return;
  }

  // 逐个导出（使用 Plotly.toImage，最可靠的方法）
  const baseName = path.basename(htmlPath, path.extname(htmlPath));
  for (const id of plotIds) {
    try {
      // 直接使用 Plotly.toImage，它会自动等待渲染完成
      const dataUrl = await page.evaluate(async (elementId) => {
        const el = document.getElementById(elementId);
        if (!el) throw new Error(`找不到元素: ${elementId}`);
        return await Plotly.toImage(el, { format: "png" });
      }, id);
      
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
      const pngName = `${baseName}_${id}.png`;
      fs.writeFileSync(pngName, base64, "base64");
      console.log(`✓ 导出成功：${pngName}`);
    } catch (error) {
      console.error(`✗ 导出失败 ${id}:`, error.message);
    }
  }
}

(async () => {
  const htmlArgs = process.argv.slice(2);
  const targets = htmlArgs.length
    ? htmlArgs
    : ["./2025-12-12_03;34_SPX_gamma.html"];

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    defaultViewport: { width: 1600, height: 2200 }
  });
  
  for (const htmlFile of targets) {
    const absPath = path.resolve(htmlFile);
    const fileUrl = "file://" + absPath;
  const page = await browser.newPage();
    await page.goto(fileUrl, { waitUntil: ["domcontentloaded", "networkidle0"] });
    await exportPlotlyDivs(page, absPath);
    await page.close();
  }

  await browser.close();
})();
