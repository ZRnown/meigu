const axios = require("axios");
const fs = require("fs");

const DEFAULT_ANALYSIS_PROMPT = "根据tvcode和gamma图的变化，用简洁中文分析当天走势并给出关键价位。";

function buildPrompt(stock, timeLabels, tvcodeDataList, customPrompt = "") {
  const promptPrefix = String(customPrompt || "").trim() || DEFAULT_ANALYSIS_PROMPT;

  let prompt = `${promptPrefix}\n\n股票: ${stock.name} (${stock.code || "N/A"})\n时间顺序: ${timeLabels.join(", ")}`;

  if (tvcodeDataList.length > 0) {
    prompt += "\n\nTvcode数据:";
    for (const item of tvcodeDataList) {
      prompt += `\n\n日期 ${item.date}:\n${item.data}`;
    }
  }

  return prompt;
}

/**
 * 调用Gemini API分析图片和tvcode数据
 * @param {string} apiKey - Gemini API密钥
 * @param {string} baseUrl - API基础URL
 * @param {string} model - 模型名称
 * @param {Object} stock - 股票信息 {name, code}
 * @param {string[]} imagePaths - 图片路径数组（gamma图表）
 * @param {string[]} timeLabels - 时间标签数组
 * @param {Array} tvcodeDataList - tvcode数据数组 [{date, data}, ...]
 * @param {string} customPrompt - 自定义提示词
 * @returns {Promise<string>} 分析结果
 */
async function analyzeWithGemini(apiKey, baseUrl, model, stock, imagePaths, timeLabels, tvcodeDataList = [], customPrompt = "") {
  const prompt = buildPrompt(stock, timeLabels, tvcodeDataList, customPrompt);
  const parts = [{ text: prompt }];

  for (const imagePath of imagePaths) {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = imagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64Image
      }
    });
  }

  try {
    const url = `${baseUrl}/${model}:generateContent?key=${apiKey}`;

    const response = await axios.post(
      url,
      {
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000
        }
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Gemini API 调用失败:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  analyzeWithGemini
};
