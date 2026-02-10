const fs = require("fs");

/**
 * 从 tvcode HTML 文件中提取文本数据
 * @param {string} htmlPath - HTML 文件路径
 * @returns {Promise<string>} 提取的文本数据
 */
async function extractTvcodeData(htmlPath) {
  try {
    const htmlContent = fs.readFileSync(htmlPath, "utf8");

    const textMatch = htmlContent.match(/([A-Z]+:\s*[^<]+)/i);
    if (textMatch) {
      return textMatch[1].trim();
    }

    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      const text = bodyMatch[1]
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (text.length > 10) {
        return text;
      }
    }

    const allText = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return allText || "无法提取tvcode数据";
  } catch (error) {
    console.error(`提取tvcode数据失败: ${htmlPath}`, error.message);
    return "提取失败";
  }
}

function isTvcodeFile(filename) {
  return filename.toLowerCase().includes("tvcode");
}

function isGammaFile(filename) {
  return filename.toLowerCase().includes("gamma");
}

module.exports = {
  extractTvcodeData,
  isTvcodeFile,
  isGammaFile
};
