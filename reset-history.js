const fs = require("fs");
const path = require("path");

console.log("🔄 重置历史记录...\n");

// 备份当前历史记录
const historyFile = "./history.json";
const backupFile = "./history.json.backup";

if (fs.existsSync(historyFile)) {
  fs.copyFileSync(historyFile, backupFile);
  console.log(`✅ 已备份历史记录到: ${backupFile}`);
}

// 删除当前历史记录文件
if (fs.existsSync(historyFile)) {
  fs.unlinkSync(historyFile);
  console.log(`🗑️  已删除历史记录文件`);
}

// 创建空的history.json
fs.writeFileSync(historyFile, "{}", "utf8");
console.log(`📄 已创建新的空历史记录文件`);

console.log("\n📋 接下来的步骤:");
console.log("1. 确保images目录中有你要分析的HTML文件");
console.log("2. 运行: node index.js --run-now");
console.log("3. 系统会重新处理文件并建立正确的历史记录");
console.log("4. 然后AI分析就会正常工作了");

console.log("\n🎉 重置完成！");
