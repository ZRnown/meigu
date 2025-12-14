const fs = require("fs");
const path = require("path");

/**
 * 从tvcode HTML文件中提取文本数据
 * @param {string} htmlPath - HTML文件路径
 * @returns {Promise<string>} 提取的文本数据
 */
async function extractTvcodeData(htmlPath) {
  try {
    const htmlContent = fs.readFileSync(htmlPath, "utf8");
    
    // 尝试从HTML中提取文本内容
    // tvcode文件通常包含类似这样的数据：
    // "MU: Implied Movement -σ, 217.64, Implied Movement -2σ, 206.55, ..."
    
    // 方法1: 查找包含股票代码和数据的文本
    const textMatch = htmlContent.match(/([A-Z]+:\s*[^<]+)/i);
    if (textMatch) {
      return textMatch[1].trim();
    }
    
    // 方法2: 提取body中的所有文本内容
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      // 移除HTML标签，只保留文本
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
    
    // 方法3: 如果都找不到，返回整个HTML的文本部分
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

/**
 * 判断文件是否为tvcode类型
 * @param {string} filename - 文件名
 * @returns {boolean}
 */
function isTvcodeFile(filename) {
  return filename.toLowerCase().includes("tvcode");
}

/**
 * 判断文件是否为gamma类型
 * @param {string} filename - 文件名
 * @returns {boolean}
 */
function isGammaFile(filename) {
  return filename.toLowerCase().includes("gamma");
}

module.exports = {
  extractTvcodeData,
  isTvcodeFile,
  isGammaFile
};

