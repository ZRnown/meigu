const fs = require("fs");
const path = require("path");
const { startScheduler, runScheduledTask } = require("./scheduler");

// 加载配置
const configPath = path.resolve(__dirname, "config.json");
if (!fs.existsSync(configPath)) {
  console.error("❌ 配置文件不存在: config.json");
  console.log("请先创建 config.json 并配置相关参数");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// 验证配置
const missingWebhooks = config.stockConfigs.filter(c => !c.webhookUrl || c.webhookUrl.startsWith("YOUR_"));
if (missingWebhooks.length > 0) {
  console.error("❌ 请在 config.json 中配置所有股票的 Discord Webhook URL");
  console.error(`   缺少配置的股票: ${missingWebhooks.map(c => c.keywords[0]).join(", ")}`);
  process.exit(1);
}

if (!config.gemini || !config.gemini.apiKey) {
  console.error("❌ 请在 config.json 中配置 Gemini API key");
  process.exit(1);
}

// 主函数
async function main() {
  try {
    // 检查命令行参数
    const args = process.argv.slice(2);
    if (args.includes("--run-now")) {
      // 立即执行一次
      console.log("🚀 立即执行任务...");
      await runScheduledTask(config);
    } else {
      // 启动定时任务
      startScheduler(config);
      console.log("\n💡 提示: 使用 --run-now 参数可以立即执行一次任务");
      console.log("按 Ctrl+C 退出\n");
    }
  } catch (error) {
    console.error("❌ 启动失败:", error.message);
    process.exit(1);
  }
}

// 处理退出信号
process.on("SIGINT", () => {
  console.log("\n👋 程序退出");
  process.exit(0);
});

main();

