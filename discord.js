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
 * 将长消息分割成多个部分（Discord 限制 2000 字符）
 * @param {string} text - 要分割的文本
 * @param {number} maxLength - 每条消息的最大长度（默认 1900，留出安全边距）
 * @returns {string[]} 分割后的消息数组
 */
function splitMessage(text, maxLength = 1900) {
  if (text.length <= maxLength) {
    return [text];
  }

  const messages = [];
  let currentMessage = "";
  const lines = text.split("\n");

  for (const line of lines) {
    // 如果当前行加上新行会超过限制
    if (currentMessage.length + line.length + 1 > maxLength) {
      if (currentMessage.trim()) {
        messages.push(currentMessage.trim());
        currentMessage = "";
      }
      
      // 如果单行就超过限制，强制分割
      if (line.length > maxLength) {
        // 按字符分割
        let remaining = line;
        while (remaining.length > maxLength) {
          messages.push(remaining.substring(0, maxLength));
          remaining = remaining.substring(maxLength);
        }
        currentMessage = remaining;
      } else {
        currentMessage = line + "\n";
      }
    } else {
      currentMessage += line + "\n";
    }
  }

  if (currentMessage.trim()) {
    messages.push(currentMessage.trim());
  }

  return messages;
}

/**
 * 发送文本消息到Discord Webhook
 * 如果消息太长，会自动分割成多条消息发送
 * @param {string} webhookUrl - Discord Webhook URL
 * @param {string} message - 消息内容
 */
async function sendMessageToDiscord(webhookUrl, message) {
  try {
    // Discord 消息限制是 2000 字符，我们使用 1900 作为安全边距
    const maxLength = 1900;
    
    if (message.length <= maxLength) {
      // 消息不长，直接发送
      const response = await axios.post(webhookUrl, {
        content: message
      }, {
        headers: {
          "Content-Type": "application/json"
        }
      });

      console.log(`✓ 已发送消息到 Discord Webhook`);
      return response.data;
    } else {
      // 消息太长，需要分割
      const messageParts = splitMessage(message, maxLength);
      const totalParts = messageParts.length;

      console.log(`📝 消息过长，分割成 ${totalParts} 条发送`);

      for (let i = 0; i < messageParts.length; i++) {
        const partNumber = i + 1;
        const partMessage = totalParts > 1 
          ? `**第 ${partNumber}/${totalParts} 部分**\n\n${messageParts[i]}`
          : messageParts[i];

        // 添加延迟，避免发送过快
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const response = await axios.post(webhookUrl, {
          content: partMessage
        }, {
          headers: {
            "Content-Type": "application/json"
          }
        });

        console.log(`✓ 已发送第 ${partNumber}/${totalParts} 条消息`);
      }

      console.log(`✅ 已发送全部 ${totalParts} 条消息到 Discord Webhook`);
      return { success: true, parts: totalParts };
    }
  } catch (error) {
    console.error("Discord Webhook 发送失败:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  sendImagesToDiscord,
  sendMessageToDiscord
};

