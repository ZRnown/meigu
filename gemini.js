const axios = require("axios");
const fs = require("fs");

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
  // 构建tvcode数据文本
  let tvcodeText = "";
  if (tvcodeDataList.length > 0) {
    tvcodeText = "\n\n**Tvcode数据**:\n";
    for (const item of tvcodeDataList) {
      tvcodeText += `\n日期 ${item.date}:\n${item.data}\n`;
    }
  }

  // 构建完整的提示词
  let prompt;
  if (customPrompt) {
    // 使用自定义提示词
    prompt = `${customPrompt}\n\n**股票**: ${stock.name} (${stock.code})\n**时间顺序**: ${timeLabels.join(", ")}${tvcodeText}`;
  } else {
    // 使用默认提示词
    prompt = `你是一位资深的量化交易专家和期权分析师，擅长分析 Gamma Hedging 图表的时间序列变化。

我给你 ${stock.name} (${stock.code}) 最近 ${timeLabels.length} 个日期按时间顺序排列的数据：

**时间顺序**: ${timeLabels.join(", ")}${tvcodeText}

请深入分析这些数据的**历史演变趋势**，并基于趋势做出预测：

## 📊 一、历史趋势分析

### 1. **Gamma 分布的时间演变**

- 观察 Dealer Gamma 在各个价位的变化趋势

- Call Gamma (右侧) 和 Put Gamma (左侧) 的力量对比如何演变？

- 哪些价位的 Gamma 持续增强或减弱？

- Gamma 集中度是增加还是分散？

### 2. **关键价位的迁移轨迹**

- **Gamma Flip 点**（正负转换点）的移动趋势

- **Gamma Field** 线（支撑/阻力）的位置变化

- **高 Gamma 集中区域**的漂移方向

- 现货价格（Spot Price）相对于 Gamma 分布的位置变化

### 3. **市场情绪的演化**

- Put/Call 比率的变化趋势（看多/看空情绪）

- 交易量和持仓量的变化

- 从历史数据推断市场参与者的行为模式

### 4. **波动性特征**

- Gamma 分布的波动幅度变化

- 价格区间的收缩或扩张趋势

- 市场稳定性或不稳定性的演变

## 🔮 二、基于趋势的预测

### 1. **短期预测（1-3 天）**

- 基于最近趋势，预测下一个交易日的走势

- 给出可能的价格区间和概率

- 识别关键的触发点位

### 2. **中期预测（1-2 周）**

- 基于整体趋势，预测未来 1-2 周的方向

- 给出目标价位和时间框架

- 说明趋势延续或反转的条件

### 3. **关键风险点**

- 识别可能导致趋势反转的价位

- 说明需要警惕的市场信号

- 给出风险管理建议

## 💼 三、交易策略建议

### 1. **趋势跟随策略**

- 如何利用当前趋势进行交易

- 具体的进场点位和时机

- 止损和止盈设置

### 2. **反转捕捉策略**

- 在哪些位置可能出现反转

- 如何提前布局

- 风险控制措施

### 3. **期权策略**

- 基于 Gamma 分布的期权策略建议

- 具体的 strike 选择和到期日

- 预期收益和风险

## 📈 四、关键观察指标

列出下次更新时需要重点关注的指标和价位。

---

**输出要求**：

1. 使用清晰的中文和 Discord Markdown 格式

2. 用 **粗体** 强调关键结论

3. 用 \`代码\` 标注具体数字和价位

4. 用 > 引用重要观点

5. 逻辑清晰，结论明确

6. 基于数据说话，避免模糊表述`;
  }

  // 构建 Gemini API 的请求内容
  // Gemini 使用 parts 数组，每个 part 可以是 text 或 inline_data (图片)
  const parts = [
    { text: prompt }
  ];

  // 添加图片（Gemini 使用 inline_data 格式）
  for (const imagePath of imagePaths) {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    parts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64Image
      }
    });
  }

  try {
    // Gemini API URL 格式: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
    const url = `${baseUrl}/${model}:generateContent?key=${apiKey}`;
    
    const response = await axios.post(
      url,
      {
        contents: [
          {
            parts: parts
          }
        ],
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

    // Gemini API 响应格式
    const text = response.data.candidates[0].content.parts[0].text;
    return text;
  } catch (error) {
    console.error("Gemini API 调用失败:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { analyzeWithGemini };

