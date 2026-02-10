const fs = require("fs");
const { runAIAnalysisTask } = require("./ai-worker");

async function main() {
  const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
  console.log("🧪 立即执行 AI 分析测试...");
  const result = await runAIAnalysisTask(config);
  console.log(`🎉 完成，成功分析 ${result.analyzedCount} 个股票`);
}

main().catch((error) => {
  console.error("❌ AI 分析测试失败:", error.message);
  process.exit(1);
});
