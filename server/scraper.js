const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function scrapeBooks() {
  return new Promise((resolve, reject) => {
    const scraperPath = path.join(__dirname, '../scraper/douban_spider.py');
    
    const process = exec(`python ${scraperPath}`, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(`爬取失败: ${error.message}`));
      }
      
      // 读取爬取结果
      const dataPath = path.join(__dirname, '../data/books.csv');
      const data = fs.readFileSync(dataPath, 'utf-8');
      const count = data.split('\n').length - 1; // 减去标题行
      
      resolve({ count });
    });
    
    // 实时输出进度
    process.stdout.on('data', (data) => {
    //   console.log('收到进度数据:', data.toString()); // 添加调试日志
      const progress = data.toString().match(/Progress:(\d+)/);
      if (progress && global.scrapeProgressCallback) {
        // console.log('发送进度:', progress[1]); // 添加调试日志
        global.scrapeProgressCallback(parseInt(progress[1]));
      }
    });
  });
}

module.exports = { scrapeBooks };