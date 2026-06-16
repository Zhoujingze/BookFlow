const fs = require('fs');
const path = require('path');

/**
 * 图书数据分析
 *
 * 数据源：清洗产物 books_clean.json（由 Python 清洗管线输出，UTF-8 编码）。
 * 编码检测/转换职责已在清洗阶段完成，此处直接消费标准化 JSON。
 *
 * @param {string} filePath - books_clean.json 文件路径
 * @param {string} type - 分析类型 ('publisher' | 'author' | 'rating' | 'category')
 * @returns {Promise<Object>} 聚合后的统计结果（已排序、限量）
 */
async function analyzeBooks(filePath, type) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf-8', (err, raw) => {
      if (err) return reject(new Error(`读取清洗结果失败: ${err.message}`));

      let books;
      try {
        books = JSON.parse(raw);
      } catch (e) {
        return reject(new Error(`清洗结果 JSON 解析失败: ${e.message}`));
      }
      if (!Array.isArray(books)) return reject(new Error('清洗结果不是数组'));

      const results = {};
      for (const row of books) {
        try {
          switch (type) {
            case 'publisher': {
              const v = (row.publisher || '').toString().trim();
              if (v) results[v] = (results[v] || 0) + 1;
              break;
            }
            case 'author': {
              const v = (row.author || '').toString().trim();
              if (!v) break;
              // 处理多作者（用 / 或 , 分隔）
              v.split(/[\/,]/).forEach((a) => {
                const author = a.trim();
                if (author) results[author] = (results[author] || 0) + 1;
              });
              break;
            }
            case 'rating': {
              const rating = parseFloat(row.rating) || 0;
              // 按 0.5 分间隔分组
              const group = Math.floor(rating * 2) / 2;
              const key = `${group.toFixed(1)}-${(group + 0.5).toFixed(1)}`;
              results[key] = (results[key] || 0) + 1;
              break;
            }
            case 'category': {
              const v = (row.category || '').toString().trim();
              if (v) results[v] = (results[v] || 0) + 1;
              break;
            }
            default:
              break;
          }
        } catch (e) {
          // 单行异常不中断整体分析
        }
      }

      resolve(sortAndLimitResults(results));
    });
  });
}

/**
 * 对结果按值降序排序并限制返回数量
 */
function sortAndLimitResults(results, limit = 20) {
  return Object.entries(results)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
}

module.exports = {
  analyzeBooks,
  sortAndLimitResults,
};