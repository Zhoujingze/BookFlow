const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

/**
 * 清洗薄封装：调用 Python 清洗脚本（scraper/cleaner.py）
 *
 * 设计说明：
 *   - 真正的"离线清洗管线 / 规则引擎 / 编码检测"实现在 Python 侧，对应简历描述。
 *   - 这里只是 Node 侧的进程调度 + 进度回传，风格与 scraper.js 保持一致。
 *   - 清洗产出为 JSON（books_clean.json），供 analyzer / recommender 消费。
 */
async function cleanBooks() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../scraper/cleaner.py');
    const child = exec(`python ${scriptPath}`, (error) => {
      if (error) {
        return reject(new Error(`清洗失败: ${error.message}`));
      }
      // 读取清洗产物 JSON 统计条数
      const outPath = path.join(__dirname, '../data/books_clean.json');
      try {
        const data = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
        resolve({ count: Array.isArray(data) ? data.length : 0 });
      } catch (err) {
        reject(new Error(`读取清洗结果失败: ${err.message}`));
      }
    });

    // 实时解析进度协议 Progress:数字 并回传前端（SSE）
    child.stdout.on('data', (chunk) => {
      const m = chunk.toString().match(/Progress:(\d+)/);
      if (m && global.cleanProgressCallback) {
        global.cleanProgressCallback(parseInt(m[1], 10));
      }
    });
  });
}

module.exports = { cleanBooks };