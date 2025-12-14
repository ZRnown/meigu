const fs = require("fs");
const path = require("path");

/**
 * 历史记录管理
 */
class HistoryManager {
  constructor(historyFile) {
    this.historyFile = path.resolve(historyFile);
    this.history = this.loadHistory();
  }

  /**
   * 加载历史记录
   */
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn("加载历史记录失败，将创建新记录:", error.message);
    }
    return {};
  }

  /**
   * 保存历史记录
   */
  saveHistory() {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2), "utf8");
    } catch (error) {
      console.error("保存历史记录失败:", error.message);
    }
  }

  /**
   * 记录已处理的文件
   * @param {string} stockKey - 股票标识（如 "spx", "tsm"）
   * @param {string} htmlFile - HTML文件路径
   * @param {string[]} imagePaths - 生成的图片路径
   * @param {string} date - 日期字符串（YYYY-MM-DD）
   */
  recordProcessed(stockKey, htmlFile, imagePaths, date) {
    if (!this.history[stockKey]) {
      this.history[stockKey] = [];
    }

    this.history[stockKey].push({
      date,
      htmlFile,
      imagePaths,
      processedAt: new Date().toISOString()
    });

    // 按日期排序
    this.history[stockKey].sort((a, b) => a.date.localeCompare(b.date));
    this.saveHistory();
  }

  /**
   * 获取指定股票的历史记录（按天数）
   * @param {string} stockKey - 股票标识
   * @param {number} days - 获取最近几天的记录
   * @returns {Array}
   */
  getRecentHistory(stockKey, days = 2) {
    if (!this.history[stockKey]) {
      return [];
    }

    const records = this.history[stockKey];
    return records.slice(-days);
  }

  /**
   * 获取指定股票的最近N条记录（跳过周末，获取最近两次有数据的日期）
   * @param {string} stockKey - 股票标识
   * @param {number} count - 获取最近几条记录（默认2条）
   * @returns {Array}
   */
  getRecentRecords(stockKey, count = 2) {
    if (!this.history[stockKey]) {
      return [];
    }

    const records = this.history[stockKey];
    // 直接返回最后N条记录（已经按日期排序）
    return records.slice(-count);
  }

  /**
   * 检查文件是否已处理
   * @param {string} stockKey - 股票标识
   * @param {string} htmlFile - HTML文件路径
   * @returns {boolean}
   */
  isProcessed(stockKey, htmlFile) {
    if (!this.history[stockKey]) {
      return false;
    }

    return this.history[stockKey].some(
      record => path.resolve(record.htmlFile) === path.resolve(htmlFile)
    );
  }

  /**
   * 获取指定日期的记录
   * @param {string} stockKey - 股票标识
   * @param {string} date - 日期字符串（YYYY-MM-DD）
   * @returns {Object|null}
   */
  getByDate(stockKey, date) {
    if (!this.history[stockKey]) {
      return null;
    }

    return this.history[stockKey].find(record => record.date === date) || null;
  }
}

module.exports = { HistoryManager };

