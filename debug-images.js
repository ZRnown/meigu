const fs = require("fs");
const path = require("path");
const { HistoryManager } = require("./history");
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

console.log("🔍 调试图片文件问题...\n");

const historyManager = new HistoryManager(config.historyFile);

// 检查历史记录中的所有图片路径
console.log("📊 检查历史记录中的图片路径:");

for (const stockKey of Object.keys(historyManager.history)) {
  console.log(`\n🗂️  股票: ${stockKey}`);

  for (const date of Object.keys(historyManager.history[stockKey])) {
    const record = historyManager.history[stockKey][date];

    if (record.gamma && record.gamma.imagePaths) {
      console.log(`  📅 ${date}:`);
      for (const imagePath of record.gamma.imagePaths) {
        const exists = fs.existsSync(imagePath);
        const fileName = path.basename(imagePath);
        const dirName = path.dirname(imagePath);

        console.log(`    ${exists ? '✅' : '❌'} ${fileName}`);
        console.log(`       路径: ${imagePath}`);

        if (exists) {
          const stats = fs.statSync(imagePath);
          console.log(`       大小: ${(stats.size / 1024).toFixed(1)}KB`);
          console.log(`       修改时间: ${stats.mtime.toLocaleString()}`);
        }

        // 检查文件名是否包含正确的日期
        const expectedDatePrefix = date.replace(/-/g, '-');
        if (!fileName.startsWith(expectedDatePrefix)) {
          console.log(`       ⚠️  警告: 文件名不匹配期望日期 ${expectedDatePrefix}`);
        }
      }
    }
  }
}

console.log("\n📁 实际存在的图片文件:");
const imageDir = config.imageOutputDirectory || "./images";
if (fs.existsSync(imageDir)) {
  const files = fs.readdirSync(imageDir).filter(f => f.endsWith('.png'));
  console.log(`   目录: ${path.resolve(imageDir)}`);
  console.log(`   文件数量: ${files.length}`);

  for (const file of files) {
    const filePath = path.join(imageDir, file);
    const stats = fs.statSync(filePath);
    console.log(`   📄 ${file} (${(stats.size / 1024).toFixed(1)}KB, ${stats.mtime.toLocaleString()})`);
  }
} else {
  console.log(`   ❌ 目录不存在: ${imageDir}`);
}

console.log("\n🎯 AI分析将使用的图片:");
for (const stockConfig of config.stockConfigs) {
  const stockKey = stockConfig.keywords[0];
  const recentRecords = historyManager.getRecentRecords(stockKey, 2);

  console.log(`\n📈 ${stockConfig.stockName} (${stockKey}):`);

  if (recentRecords.length >= 2) {
    let totalValidImages = 0;

    for (const record of recentRecords) {
      if (record.gamma && record.gamma.imagePaths) {
        console.log(`  📅 ${record.date}:`);
        for (const imagePath of record.gamma.imagePaths) {
          const exists = fs.existsSync(imagePath);
          console.log(`    ${exists ? '✅' : '❌'} ${path.basename(imagePath)}`);
          if (exists) totalValidImages++;
        }
      }
    }

    console.log(`  📊 有效图片总数: ${totalValidImages}`);
  } else {
    console.log(`  ❌ 数据不足`);
  }
}

console.log("\n🎉 调试完成！");
