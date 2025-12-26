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
        const rawHistory = JSON.parse(data);

        // 转换旧格式（数组）到新格式（对象）
        const convertedHistory = {};
        for (const [stockKey, records] of Object.entries(rawHistory)) {
          if (Array.isArray(records)) {
            // 旧格式：数组转换为对象格式
            convertedHistory[stockKey] = {};
            for (const record of records) {
              convertedHistory[stockKey][record.date] = {
                date: record.date,
                gamma: record.imagePaths ? {
                  htmlFile: record.htmlFile,
                  imagePaths: record.imagePaths
                } : null,
                tvcode: null, // 旧格式没有tvcode
                processedAt: record.processedAt
              };
            }
          } else {
            // 已经是新格式
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
   * @param {string[]} imagePaths - 生成的图片路径（gamma文件）
   * @param {string} date - 日期字符串（YYYY-MM-DD）
   * @param {string} fileType - 文件类型（"gamma" 或 "tvcode"）
   * @param {string} tvcodeData - tvcode文件的文本数据（可选）
   */
  recordProcessed(stockKey, htmlFile, imagePaths, date, fileType = "gamma", tvcodeData = null) {
    if (!this.history[stockKey]) {
      this.history[stockKey] = {};
    }

    // 按日期组织数据，每个日期可以有gamma和tvcode两种类型
    if (!this.history[stockKey][date]) {
      this.history[stockKey][date] = {
        date,
        gamma: null,
        tvcode: null,
        processedAt: new Date().toISOString()
      };
    }

    // 更新对应类型的数据
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
   * @param {number} count - 获取最近几个日期（默认2个）
   * @returns {Array} 返回格式: [{date, gamma: {...}, tvcode: {...}}, ...]
   */
  getRecentRecords(stockKey, count = 2) {
    if (!this.history[stockKey]) {
      return [];
    }

    // 获取所有日期，按日期排序
    const dates = Object.keys(this.history[stockKey])
      .filter(date => {
        const record = this.history[stockKey][date];
        // 只返回有gamma或tvcode数据的日期
        return record && (record.gamma || record.tvcode);
      })
      .sort((a, b) => a.localeCompare(b));

    // 返回最近N个日期
    const recentDates = dates.slice(-count);
    return recentDates.map(date => this.history[stockKey][date]);
  }

  /**
   * 检查文件是否已处理
   * @param {string} stockKey - 股票标识
   * @param {string} htmlFile - HTML文件路径
   * @param {string} fileType - 文件类型（"gamma" 或 "tvcode"）
   * @returns {boolean}
   */
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

