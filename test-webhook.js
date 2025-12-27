const { sendMessageToDiscord, validateWebhookUrl } = require("./discord");
const config = JSON.parse(require("fs").readFileSync("config.json", "utf8"));

async function testWebhook() {
  console.log("🧪 测试Discord Webhook连接...\n");

  const testWebhookUrl = config.stockConfigs[0].webhookUrl; // 使用第一个配置的webhook
  const aiWebhookUrl = config.aiAnalysisWebhookUrl;

  console.log(`📡 测试股票频道: ${config.stockConfigs[0].stockName}`);
  console.log(`   URL: ${testWebhookUrl}`);

  try {
    const isValid = await validateWebhookUrl(testWebhookUrl);
    console.log(`   验证结果: ${isValid ? '✅ 有效' : '❌ 无效'}`);

    // 发送测试消息
    console.log("   发送测试消息...");
    await sendMessageToDiscord(testWebhookUrl, "🧪 **Webhook测试**\n\n这是一条测试消息，验证webhook是否正常工作。");
    console.log("   ✅ 测试消息发送成功");
  } catch (error) {
    console.log(`   ❌ 测试失败: ${error.message}`);
  }

  console.log(`\n🤖 测试AI分析频道:`);
  console.log(`   URL: ${aiWebhookUrl}`);

  try {
    const isValid = await validateWebhookUrl(aiWebhookUrl);
    console.log(`   验证结果: ${isValid ? '✅ 有效' : '❌ 无效'}`);

    // 发送测试消息
    console.log("   发送测试消息...");
    await sendMessageToDiscord(aiWebhookUrl, "🤖 **AI分析频道测试**\n\n这是一条测试消息，验证AI分析webhook是否正常工作。");
    console.log("   ✅ 测试消息发送成功");
  } catch (error) {
    console.log(`   ❌ 测试失败: ${error.message}`);
  }

  console.log("\n🎉 测试完成！");
}

// 运行测试
testWebhook().catch(error => {
  console.error("❌ 测试过程中发生错误:", error);
  process.exit(1);
});
