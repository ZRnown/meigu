# Plotly 图表自动转换与 Discord 推送系统

自动将 Plotly HTML 图表转换为图片，并发送到指定的 Discord 频道。支持定时任务和 AI 分析功能。

## 功能特性

- ✅ 自动扫描目录中的 HTML 文件
- ✅ 根据文件名关键词（如 "spx", "tsm"）路由到不同 Discord 频道
- ✅ 定时任务：每天指定时间自动处理
- ✅ AI 分析：从第二天开始，自动将最近 2 天的图表发送给 DeepSeek 分析
- ✅ 历史记录：避免重复处理同一文件

## 安装

```bash
# 安装依赖
pnpm install
# 或
npm install
```

## 配置

编辑 `config.json` 文件：

```json
{
  "watchDirectory": "./",
  "scheduleTime": "08:00",
  "stockConfigs": [
    {
      "keywords": ["spx"],
      "webhookUrl": "https://discord.com/api/webhooks/YOUR_SPX_WEBHOOK_URL",
      "stockName": "SPX",
      "stockCode": "SPX"
    },
    {
      "keywords": ["tsm"],
      "webhookUrl": "https://discord.com/api/webhooks/YOUR_TSM_WEBHOOK_URL",
      "stockName": "TSM",
      "stockCode": "TSM"
    }
  ],
  "deepseek": {
    "apiKey": "YOUR_DEEPSEEK_API_KEY",
    "baseUrl": "https://api.deepseek.com/v1/chat/completions",
    "model": "deepseek-chat"
  },
  "historyFile": "./history.json"
}
```

### 配置说明

- `watchDirectory`: 监控的目录路径
- `scheduleTime`: 定时任务执行时间（格式：HH:MM，如 "08:00"）
- `stockConfigs`: 股票配置数组
  - `keywords`: 文件名中包含的关键词（不区分大小写），用于匹配 HTML 文件
  - `webhookUrl`: Discord Webhook URL（每个股票一个独立的 Webhook）
  - `stockName`: 股票名称（用于 AI 分析提示词中显示，如 "SPX"）
  - `stockCode`: 股票代码（用于 AI 分析提示词中显示，如 "SPX"）
- `deepseek`: DeepSeek API 配置
- `historyFile`: 历史记录文件路径

### 获取 Discord Webhook URL

1. 在 Discord 频道中，进入 **频道设置** → **整合** → **Webhook**
2. 点击 **新 Webhook** 或 **编辑** 现有 Webhook
3. 复制 Webhook URL（格式：`https://discord.com/api/webhooks/...`）
4. 为每个股票（SPX、TSM 等）创建独立的 Webhook

**注意**：`stockName` 和 `stockCode` 用于在 AI 分析报告的开头显示股票信息，例如：
- 提示词中会显示："我给你 SPX (SPX) 最近 2 份按时间顺序排列的 Gamma Hedging 图表"
- 你可以根据实际需要修改这两个字段

## 使用方法

### 启动定时任务

```bash
npm start
# 或
node index.js
```

程序会在每天指定时间（如 08:00）自动执行任务。

### 立即执行一次

```bash
npm run run-now
# 或
node index.js --run-now
```

## 工作流程

1. **第一天**：扫描 HTML 文件 → 转换为图片 → 发送到 Discord
2. **第二天**：处理新文件 → 发送图片 → **开始 AI 分析**（使用最近 2 天的数据，**按股票分组，不会混合**）
3. **第三天及以后**：处理新文件 → 发送图片 → **AI 分析**（使用最近 2 天的数据，**按股票分组，不会混合**）

**重要**：系统会按股票关键词（如 "spx"、"tsm"）分组处理，确保：
- 每个股票的历史记录独立存储
- AI 分析时只使用同一股票的数据，不会混合不同股票
- 每个股票发送到对应的 Discord Webhook

## 文件结构

```
.
├── config.json          # 配置文件
├── index.js            # 主入口文件
├── convert.js          # 图片转换模块
├── discord.js          # Discord 集成模块
├── deepseek.js         # DeepSeek API 集成模块
├── history.js          # 历史记录管理模块
├── scheduler.js        # 定时任务模块
├── main.js             # 原始转换脚本（保留）
└── history.json        # 历史记录文件（自动生成）
```

## 注意事项

1. 确保 Chrome 浏览器已安装（用于 Puppeteer）
2. HTML 文件名应包含日期格式：`YYYY-MM-DD_*_关键词_*.html`
3. 历史记录保存在 `history.json`，删除该文件可重置历史
4. 程序需要持续运行才能执行定时任务

## 故障排除

### 图片转换失败

- 检查 HTML 文件是否包含 Plotly 图表
- 确保 Chrome 浏览器路径正确（macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`）

### Discord 发送失败

- 检查 Webhook URL 是否正确
- 确认 Webhook 未被删除或禁用
- 检查网络连接

### AI 分析失败

- 检查 DeepSeek API Key 是否正确
- 确认 API 余额充足
- 检查网络连接

# shenzhen
