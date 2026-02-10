const test = require("node:test");
const assert = require("node:assert/strict");

const { matchStockConfig } = require("../upload-worker");

const stockConfigs = [
  { stockName: "V", keywords: ["v"] },
  { stockName: "VZ", keywords: ["vz"] },
  { stockName: "XPEV", keywords: ["xpev"] }
];

test("matchStockConfig should use token boundaries and avoid partial matches", () => {
  const matchXpev = matchStockConfig("2026-02-10_03;34_xpev_gamma.html", stockConfigs);
  assert.equal(matchXpev.stockName, "XPEV");

  const matchVz = matchStockConfig("2026-02-10_03;34_vz_gamma.html", stockConfigs);
  assert.equal(matchVz.stockName, "VZ");

  const matchV = matchStockConfig("2026-02-10_03;34_v_gamma.html", stockConfigs);
  assert.equal(matchV.stockName, "V");
});
