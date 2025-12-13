const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

/**
 * 发送图片到Discord Webhook
 * @param {string} webhookUrl - Discord Webhook URL
 * @param {string[]} imagePaths - 图片文件路径数组
 * @param {string} message - 可选的消息内容
 */
async function sendImagesToDiscord(webhookUrl, imagePaths, message = "") {
  try {
    // Discord Webhook 支持通过 multipart/form-data 发送文件
    const formData = new FormData();
    
    // 添加消息内容
    formData.append("content", message || "📊 Gamma Hedging 图表更新");

    // 添加图片文件（Discord Webhook 支持 files[] 数组）
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      const imageBuffer = fs.readFileSync(imagePath);
      formData.append(`files[${i}]`, imageBuffer, {
        filename: imagePath.split("/").pop(),
        contentType: "image/png"
      });
    }

    const response = await axios.post(webhookUrl, formData, {
      headers: formData.getHeaders()
    });

    console.log(`✓ 已发送 ${imagePaths.length} 张图片到 Discord Webhook`);
    return response.data;
  } catch (error) {
    console.error("Discord Webhook 发送失败:", error.response?.data || error.message);
    throw error;
  }
}

/**
 * 发送文本消息到Discord Webhook
 * @param {string} webhookUrl - Discord Webhook URL
 * @param {string} message - 消息内容
 */
async function sendMessageToDiscord(webhookUrl, message) {
  try {
    const response = await axios.post(webhookUrl, {
      content: message
    }, {
      headers: {
        "Content-Type": "application/json"
      }
    });

    console.log(`✓ 已发送消息到 Discord Webhook`);
    return response.data;
  } catch (error) {
    console.error("Discord Webhook 发送失败:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  sendImagesToDiscord,
  sendMessageToDiscord
};

