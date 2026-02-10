const fs = require("fs");
const path = require("path");

class HistoryManager {
  constructor(historyFile) {
    this.historyFile = path.resolve(historyFile);
    this.history = this.loadHistory();
  }

  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, "utf8");
        const rawHistory = JSON.parse(data);

        const convertedHistory = {};
        for (const [stockKey, records] of Object.entries(rawHistory)) {
          if (Array.isArray(records)) {
            convertedHistory[stockKey] = {};
            for (const record of records) {
              convertedHistory[stockKey][record.date] = {
                date: record.date,
                gamma: record.imagePaths
                  ? {
                      htmlFile: record.htmlFile,
                      imagePaths: record.imagePaths
                    }
                  : null,
                tvcode: null,
                processedAt: record.processedAt
              };
            }
          } else {
            convertedHistory[stockKey] = records;
          }
        }

        return convertedHistory;
      }
    } catch (error) {
      console.warn("加载历史记录失败，将创建新记录:", error.message);
    }

    return {};
  }

  saveHistory() {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2), "utf8");
    } catch (error) {
      console.error("保存历史记录失败:", error.message);
    }
  }

  recordProcessed(stockKey, htmlFile, imagePaths, date, fileType = "gamma", tvcodeData = null) {
    if (!this.history[stockKey]) {
      this.history[stockKey] = {};
    }

    if (!this.history[stockKey][date]) {
      this.history[stockKey][date] = {
        date,
        gamma: null,
        tvcode: null,
        processedAt: new Date().toISOString()
      };
    }

    if (fileType === "gamma") {
      this.history[stockKey][date].gamma = {
        htmlFile,
        imagePaths
      };
    } else if (fileType === "tvcode") {
      this.history[stockKey][date].tvcode = {
        htmlFile,
        data: tvcodeData
      };
    }

    this.saveHistory();
  }

  getRecentRecords(stockKey, count = 2) {
    if (!this.history[stockKey]) {
      return [];
    }

    const dates = Object.keys(this.history[stockKey])
      .filter((date) => {
        const record = this.history[stockKey][date];
        return record && (record.gamma || record.tvcode);
      })
      .sort((a, b) => a.localeCompare(b));

    const recentDates = dates.slice(-count);
    return recentDates.map((date) => this.history[stockKey][date]);
  }

  isProcessed(stockKey, htmlFile, fileType = "gamma") {
    if (!this.history[stockKey]) {
      return false;
    }

    const htmlPath = path.resolve(htmlFile);
    const dates = Object.keys(this.history[stockKey]);

    for (const date of dates) {
      const record = this.history[stockKey][date];
      if (fileType === "gamma" && record.gamma) {
        if (path.resolve(record.gamma.htmlFile) === htmlPath) {
          return true;
        }
      } else if (fileType === "tvcode" && record.tvcode) {
        if (path.resolve(record.tvcode.htmlFile) === htmlPath) {
          return true;
        }
      }
    }

    return false;
  }
}

module.exports = { HistoryManager };
