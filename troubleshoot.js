const fs = require("fs");
const path = require("path");
const { sendImagesToDiscord } = require("./discord");
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

/**
 * 故障排除工具
 * 帮助诊断Discord发送失败的问题
 */
async function troubleshoot() {
  console.log("🔧 Discord发送故障排除工具\n");

  // 1. 检查配置文件
  console.log("1️⃣ 检查配置文件...");
  if (!config.stockConfigs || config.stockConfigs.length === 0) {
    console.error("❌ 没有找到股票配置");
    return;
  }
  console.log(`✅ 找到 ${config.stockConfigs.length} 个股票配置`);

  // 2. 检查图片目录
  console.log("\n2️⃣ 检查图片目录...");
  const imageDir = config.imageOutputDirectory || "./images";
  if (!fs.existsSync(imageDir)) {
    console.error(`❌ 图片目录不存在: ${imageDir}`);
    return;
  }

  const imageFiles = fs.readdirSync(imageDir).filter(f => f.endsWith('.png'));
  console.log(`✅ 找到 ${imageFiles.length} 张PNG图片`);

  if (imageFiles.length === 0) {
    console.log("⚠️  没有图片文件，跳过发送测试");
  } else {
    // 3. 测试图片发送
    console.log("\n3️⃣ 测试图片发送...");

    for (const stockConfig of config.stockConfigs.slice(0, 2)) { // 只测试前2个配置
      console.log(`\n📊 测试 ${stockConfig.stockName} (${stockConfig.keywords.join(', ')})`);

      // 选择一张图片进行测试
      const testImage = path.join(imageDir, imageFiles[0]);
      if (!fs.existsSync(testImage)) {
        console.error(`❌ 测试图片不存在: ${testImage}`);
        continue;
      }

      const stats = fs.statSync(testImage);
      console.log(`   图片: ${testImage.split('/').pop()}`);
      console.log(`   大小: ${(stats.size / 1024).toFixed(1)}KB`);

      try {
        await sendImagesToDiscord(
          stockConfig.webhookUrl,
          [testImage],
          `🔧 **故障排除测试**\n\n${stockConfig.stockName} - 图片发送测试`
        );
        console.log(`✅ ${stockConfig.stockName} 发送成功`);
      } catch (error) {
        console.error(`❌ ${stockConfig.stockName} 发送失败: ${error.message}`);
        console.error(`   请检查webhook URL是否正确`);
        console.error(`   URL: ${stockConfig.webhookUrl}`);
      }
    }
  }

  // 4. 检查网络连接
  console.log("\n4️⃣ 检查网络连接...");
  try {
    const axios = require("axios");
    const response = await axios.get("https://discord.com/api/v10/users/@me", {
      headers: { "Authorization": "Bot fake_token" },
      timeout: 5000,
      validateStatus: () => true // 接受任何状态码
    });
    console.log(`✅ 网络连接正常 (响应状态: ${response.status})`);
  } catch (error) {
    console.error(`❌ 网络连接问题: ${error.message}`);
    console.error(`   请检查网络连接`);
  }

  // 5. 显示系统信息
  console.log("\n5️⃣ 系统信息:");
  console.log(`   Node.js版本: ${process.version}`);
  console.log(`   平台: ${process.platform}`);
  console.log(`   工作目录: ${process.cwd()}`);
  console.log(`   图片目录: ${path.resolve(imageDir)}`);

  console.log("\n🎉 故障排除完成！");
  console.log("\n💡 建议:");
  console.log("   1. 确保所有webhook URL都是有效的");
  console.log("   2. 检查图片文件是否损坏");
  console.log("   3. 确保网络连接正常");
  console.log("   4. 如果仍有问题，请检查Discord服务器设置");
}

// 运行故障排除
troubleshoot().catch(error => {
  console.error("❌ 故障排除过程中发生错误:", error);
  process.exit(1);
});
