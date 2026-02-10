const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

/**
 * 验证Discord Webhook URL是否有效
 * @param {string} webhookUrl - Discord Webhook URL
 * @returns {Promise<boolean>} 是否有效
 */
async function validateWebhookUrl(webhookUrl) {
  try {
    // 发送一个简单的HEAD请求来验证URL
    const response = await axios.head(webhookUrl, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    console.warn(`⚠️  Webhook URL验证失败: ${webhookUrl}`);
    console.warn(`   错误: ${error.message}`);
    console.warn(`   将继续尝试发送消息...`);
    // 不抛出错误，继续尝试发送，这样不会中断整个流程
    return true;
  }
}

/**
 * 发送图片到Discord Webhook
 * @param {string} webhookUrl - Discord Webhook URL
 * @param {string[]} imagePaths - 图片文件路径数组
 * @param {string} message - 可选的消息内容
 */
async function sendImagesToDiscord(webhookUrl, imagePaths, message = "") {
  try {
    // 验证webhook URL
    const isValidUrl = await validateWebhookUrl(webhookUrl);
    if (!isValidUrl) {
      throw new Error(`无效的webhook URL: ${webhookUrl}`);
    }

    // Discord Webhook 支持通过 multipart/form-data 发送文件
    const formData = new FormData();
    
    // 添加消息内容
    formData.append("content", message || "📊 Gamma Hedging 图表更新");

    // 添加图片文件（Discord Webhook 支持 files[] 数组）
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];

      // 检查文件是否存在
      if (!fs.existsSync(imagePath)) {
        throw new Error(`图片文件不存在: ${imagePath}`);
      }

      // 检查文件大小（Discord限制8MB）
      const stats = fs.statSync(imagePath);
      if (stats.size > 8 * 1024 * 1024) {
        throw new Error(`图片文件过大: ${imagePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)，Discord限制8MB`);
      }

      const imageBuffer = fs.readFileSync(imagePath);
      formData.append(`files[${i}]`, imageBuffer, {
        filename: imagePath.split("/").pop(),
        contentType: (imagePath.toLowerCase().endsWith(".jpg") || imagePath.toLowerCase().endsWith(".jpeg")) ? "image/jpeg" : "image/png"
      });

      console.log(`   图片${i + 1}: ${imagePath.split("/").pop()} (${(stats.size / 1024).toFixed(1)}KB)`);
    }

    const response = await axios.post(webhookUrl, formData, {
      headers: formData.getHeaders()
    });

    console.log(`✓ 已发送 ${imagePaths.length} 张图片到 Discord Webhook`);
    return response.data;
  } catch (error) {
    console.error("❌ Discord Webhook 发送失败:");
    console.error(`   URL: ${webhookUrl}`);
    console.error(`   图片数量: ${imagePaths.length}`);
    console.error(`   图片大小: ${imagePaths.map(p => `${p.split('/').pop()}: ${fs.statSync(p).size} bytes`).join(', ')}`);

    if (error.response) {
      console.error(`   状态码: ${error.response.status}`);
      console.error(`   响应:`, error.response.data);
    } else if (error.code) {
      console.error(`   错误代码: ${error.code}`);
      console.error(`   错误信息: ${error.message}`);
    } else {
      console.error(`   错误: ${error.message}`);
    }

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
    const lineWithNewline = line + "\n";
    
    // 如果当前行加上新行会超过限制
    if (currentMessage.length + lineWithNewline.length > maxLength) {
      // 保存当前消息（如果有内容）
      if (currentMessage.trim()) {
        messages.push(currentMessage.trim());
        currentMessage = "";
      }
      
      // 如果单行就超过限制，强制按字符分割
      if (line.length > maxLength) {
        let remaining = line;
        while (remaining.length > maxLength) {
          messages.push(remaining.substring(0, maxLength));
          remaining = remaining.substring(maxLength);
        }
        if (remaining.length > 0) {
          currentMessage = remaining + "\n";
        }
      } else {
        // 单行不超过限制，直接添加
        currentMessage = lineWithNewline;
      }
    } else {
      // 可以添加到当前消息
      currentMessage += lineWithNewline;
    }
  }

  // 添加最后的消息
  if (currentMessage.trim()) {
    messages.push(currentMessage.trim());
  }

  // 验证：确保所有内容都被包含
  const totalLength = messages.reduce((sum, msg) => sum + msg.length, 0);
  if (totalLength < text.length * 0.95) { // 允许5%的差异（换行符等）
    console.warn(`⚠️  警告: 分割后的总长度 (${totalLength}) 明显少于原始长度 (${text.length})`);
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
    // 验证webhook URL
    const isValidUrl = await validateWebhookUrl(webhookUrl);
    if (!isValidUrl) {
      throw new Error(`无效的webhook URL: ${webhookUrl}`);
    }

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
      // 考虑到页码标记的长度，实际内容需要更短
      const pageHeaderLength = 30; // "**第 X/Y 部分**\n\n" 大约30字符
      const actualMaxLength = maxLength - pageHeaderLength;
      const messageParts = splitMessage(message, actualMaxLength);
      const totalParts = messageParts.length;

      console.log(`📝 消息过长 (${message.length} 字符)，分割成 ${totalParts} 条发送`);
      console.log(`   各部分长度: ${messageParts.map((p, idx) => `第${idx+1}部分=${p.length}`).join(", ")}`);

      for (let i = 0; i < messageParts.length; i++) {
        const partNumber = i + 1;
        let partMessage = totalParts > 1 
          ? `**第 ${partNumber}/${totalParts} 部分**\n\n${messageParts[i]}`
          : messageParts[i];

        // 验证消息长度
        if (partMessage.length > 2000) {
          console.error(`❌ 错误: 第 ${partNumber} 条消息仍然超过限制 (${partMessage.length} 字符)`);
          // 强制截断（不应该发生，但作为安全措施）
          partMessage = partMessage.substring(0, 1997) + "...";
        }

        // 添加延迟，避免发送过快
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        try {
          const response = await axios.post(webhookUrl, {
            content: partMessage
          }, {
            headers: {
              "Content-Type": "application/json"
            },
            timeout: 30000 // 30秒超时
          });

          console.log(`✓ 已发送第 ${partNumber}/${totalParts} 条消息 (${partMessage.length} 字符)`);
          
          // 验证响应
          if (!response.data) {
            console.warn(`⚠️  第 ${partNumber} 条消息可能未成功发送（无响应数据）`);
          }
        } catch (error) {
          console.error(`❌ 发送第 ${partNumber}/${totalParts} 条消息失败:`, error.response?.data || error.message);
          // 如果是超时或网络错误，等待更长时间后重试一次
          if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            console.log(`⏳ 等待3秒后重试第 ${partNumber} 条消息...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            try {
              const retryResponse = await axios.post(webhookUrl, {
                content: partMessage
              }, {
                headers: {
                  "Content-Type": "application/json"
                },
                timeout: 30000
              });
              console.log(`✓ 重试成功: 第 ${partNumber}/${totalParts} 条消息`);
            } catch (retryError) {
              console.error(`❌ 重试失败: 第 ${partNumber} 条消息`, retryError.message);
            }
          }
          // 继续发送下一条，不中断整个流程
        }
      }

      console.log(`✅ 已发送全部 ${totalParts} 条消息到 Discord Webhook`);
      return { success: true, parts: totalParts };
    }
  } catch (error) {
    console.error("❌ Discord Webhook 发送失败:");
    console.error(`   URL: ${webhookUrl}`);
    console.error(`   消息长度: ${message.length} 字符`);

    if (error.response) {
      console.error(`   状态码: ${error.response.status}`);
      console.error(`   响应:`, error.response.data);
    } else if (error.code) {
      console.error(`   错误代码: ${error.code}`);
      console.error(`   错误信息: ${error.message}`);
    } else {
      console.error(`   错误: ${error.message}`);
    }

    throw error;
  }
}

module.exports = {
  sendImagesToDiscord,
  sendMessageToDiscord,
  validateWebhookUrl
};

