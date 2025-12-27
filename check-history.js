const { HistoryManager } = require("./history");
const config = JSON.parse(require("fs").readFileSync("config.json", "utf8"));

console.log("🔍 检查历史记录状态...\n");

const historyManager = new HistoryManager(config.historyFile);

// 显示当前历史记录
console.log("📊 当前历史记录:");
for (const stockKey of Object.keys(historyManager.history)) {
  console.log(`\n🗂️  股票: ${stockKey}`);
  const stockData = historyManager.history[stockKey];

  if (Array.isArray(stockData)) {
    console.log(`   格式: 旧格式(数组)`);
    console.log(`   记录数: ${stockData.length}`);
    for (const record of stockData) {
      console.log(`   📅 ${record.date}: ${record.imagePaths ? record.imagePaths.length : 0} 张图片`);
    }
  } else {
    console.log(`   格式: 新格式(对象)`);
    const dates = Object.keys(stockData);
    console.log(`   记录数: ${dates.length}`);
    for (const date of dates) {
      const record = stockData[date];
      const hasGamma = record.gamma && record.gamma.imagePaths && record.gamma.imagePaths.length > 0;
      const hasTvcode = record.tvcode && record.tvcode.data;
      console.log(`   📅 ${date}: Gamma=${hasGamma ? '✅' : '❌'}, Tvcode=${hasTvcode ? '✅' : '❌'}`);
    }
  }

  // 测试getRecentRecords
  console.log(`   🔍 测试getRecentRecords(2):`);
  const recentRecords = historyManager.getRecentRecords(stockKey, 2);
  console.log(`   返回 ${recentRecords.length} 条记录`);

  if (recentRecords.length > 0) {
    for (const record of recentRecords) {
      const hasGamma = record.gamma && record.gamma.imagePaths && record.gamma.imagePaths.length > 0;
      const hasTvcode = record.tvcode && record.tvcode.data;
      console.log(`     📅 ${record.date}: Gamma=${hasGamma ? '✅' : '❌'}, Tvcode=${hasTvcode ? '✅' : '❌'}`);
    }
  }
}

// 强制保存以转换格式
console.log("\n💾 强制保存历史记录（转换格式）...");
historyManager.saveHistory();
console.log("✅ 格式转换完成");

console.log("\n🎯 AI分析条件检查:");
for (const stockConfig of config.stockConfigs) {
  const stockKey = stockConfig.keywords[0];
  const recentRecords = historyManager.getRecentRecords(stockKey, 2);

  console.log(`\n📈 ${stockConfig.stockName} (${stockKey}):`);
  console.log(`   历史记录: ${recentRecords.length} 条`);

  if (recentRecords.length >= 2) {
    console.log(`   ✅ 满足AI分析条件`);

    // 检查数据完整性
    let gammaCount = 0;
    let tvcodeCount = 0;

    for (const record of recentRecords) {
      if (record.gamma && record.gamma.imagePaths && record.gamma.imagePaths.length > 0) {
        gammaCount++;
      }
      if (record.tvcode && record.tvcode.data) {
        tvcodeCount++;
      }
    }

    console.log(`   📊 Gamma图片: ${gammaCount}/${recentRecords.length} 天`);
    console.log(`   📝 Tvcode数据: ${tvcodeCount}/${recentRecords.length} 天`);

    if (gammaCount === 0 && tvcodeCount === 0) {
      console.log(`   ⚠️  警告: 该股票没有可用的数据`);
    }
  } else {
    console.log(`   ❌ 不满足AI分析条件（需要至少2天的历史数据）`);
  }
}

console.log("\n🎉 检查完成！");
