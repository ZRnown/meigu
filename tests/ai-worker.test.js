const test = require("node:test");
const assert = require("node:assert/strict");

const { buildAnalysisInput } = require("../ai-worker");

function makeRecord(date, withGamma = true, withTvcode = true) {
  return {
    date,
    gamma: withGamma ? { imagePaths: [`/tmp/${date}-gamma.png`] } : null,
    tvcode: withTvcode ? { data: `${date} tvcode` } : null
  };
}

test("buildAnalysisInput should allow day-1 analysis with same-day data", () => {
  const records = [makeRecord("2026-02-10")];
  const input = buildAnalysisInput(records, 2);

  assert.equal(input.timeLabels.length, 1);
  assert.equal(input.timeLabels[0], "2026-02-10");
});

test("buildAnalysisInput should include latest 2 days starting from day-2", () => {
  const records = [
    makeRecord("2026-02-08"),
    makeRecord("2026-02-09"),
    makeRecord("2026-02-10")
  ];

  const input = buildAnalysisInput(records, 2);
  assert.deepEqual(input.timeLabels, ["2026-02-09", "2026-02-10"]);
});
