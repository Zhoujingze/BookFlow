const express = require('express');
const path = require('path');
const fs = require('fs');
const auth = require('./auth');
const { scrapeBooks } = require('./scraper');
const { cleanBooks } = require('./cleaner');
const { analyzeBooks } = require('./analyzer');
const recommender = require('./recommender');

const app = express();

// API路由应该放在静态文件路由之前
app.use(express.json());

// server.js (修改后的部分)
app.post('/api/analyze-books', async (req, res) => {
  try {
    console.log('收到分析请求，类型:', req.body.type);
    const { type } = req.body;
    // 清洗产物已由 Python 管线输出为 JSON（books_clean.json）
    const filePath = path.join(__dirname, '../data/books_clean.json');
    
    // 直接返回分析结果，不需要JSON.parse
    const results = await analyzeBooks(filePath, type);
    
    res.status(200).json({ 
      status: 'success',
      result: results // 直接返回结果对象
    });
  } catch (error) {
    console.error('分析错误:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// 静态文件路由
app.use(express.static(path.join(__dirname, '../public')));

// 添加SSE路由
app.get('/api/scrape-progress', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // 设置全局回调函数
  global.scrapeProgressCallback = (progress) => {
    res.write(`data: ${JSON.stringify({value: progress})}\n\n`);
  };
  
  // 客户端断开连接时清理
  req.on('close', () => {
    global.scrapeProgressCallback = null;
  });
});

// 添加根路径路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// 登录路由
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const result = auth.login(username, password);
  res.json(result);
});

app.post('/api/register', (req, res) => {
  const { username, password, email } = req.body;
  const result = auth.register(username, password, email);
  res.json(result);
});

app.post('/api/reset-password', (req, res) => {
  const { username, newPassword } = req.body;
  const result = auth.resetPassword(username, newPassword);
  res.json(result);
});

app.post('/api/logout', (req, res) => {
  res.json({ success: true, message: '退出成功' });
});

// 确保这个路由在express.json()之后定义
app.post('/api/save-profile', (req, res) => {
  const { username, ...profileData } = req.body;  // 修改这里，使用username代替userId
  try {
    const filePath = path.join(__dirname, '../data/user_profiles.json');
    let userData = {};
    if(fs.existsSync(filePath)) {
      userData = JSON.parse(fs.readFileSync(filePath));
    }
    
    userData[username] = {  // 修改这里，使用username作为键
      ...userData[username],
      ...profileData,
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});

app.get('/api/get-profile/:userId', (req, res) => {
  try {
    const filePath = path.join(__dirname, '../data/user_profiles.json');
    
    if(!fs.existsSync(filePath)) {
      return res.status(200).json({}); // Return empty object with 200 status
    }
    
    const userData = JSON.parse(fs.readFileSync(filePath));
    const profile = userData[req.params.userId] || {};
    res.status(200).json(profile);
  } catch (error) {
    console.error('Error getting profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
});
app.post('/api/scrape-books', async (req, res) => {
  try {
    const result = await scrapeBooks();
    res.json({ 
      status: 'success',
      count: result.count,
      message: '图书数据爬取完成'
    });
  } catch (error) {
    res.status(500).json({  // 添加状态码
      status: 'error',
      message: error.message
    });
  }
});

// 添加清洗进度SSE路由
app.get('/api/clean-progress', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  global.cleanProgressCallback = (progress) => {
    res.write(`data: ${JSON.stringify({value: progress})}\n\n`);
  };
  
  req.on('close', () => {
    global.cleanProgressCallback = null;
  });
});

// 添加数据清洗路由
app.post('/api/clean-books', async (req, res) => {
  try {
    const result = await cleanBooks();
    res.json({ 
      status: 'success',
      count: result.count,
      message: '图书数据清洗完成'
    });
  } catch (error) {
    res.json({
      status: 'error',
      message: error.message
    });
  }
});

// ========== AI推荐助手系统路由 ==========

// 获取推荐
app.post('/api/recommend', async (req, res) => {
  try {
    const { username, preferences, topN } = req.body;
    if (!username) {
      return res.status(400).json({ status: 'error', message: '请先登录' });
    }
    const result = await recommender.getRecommendations(username, preferences || {}, topN || 10);
    res.json(result);
  } catch (error) {
    console.error('推荐错误:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 获取推荐系统统计
app.get('/api/recommend/stats', async (req, res) => {
  try {
    const stats = await recommender.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 添加收藏
app.post('/api/recommend/favorite', (req, res) => {
  try {
    const { username, book } = req.body;
    if (!username || !book) {
      return res.status(400).json({ status: 'error', message: '参数不完整' });
    }
    const result = recommender.addFavorite(username, book);
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 取消收藏
app.delete('/api/recommend/favorite', (req, res) => {
  try {
    const { username, bookTitle } = req.body;
    if (!username || !bookTitle) {
      return res.status(400).json({ status: 'error', message: '参数不完整' });
    }
    const result = recommender.removeFavorite(username, bookTitle);
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 不感兴趣
app.post('/api/recommend/dislike', (req, res) => {
  try {
    const { username, bookTitle } = req.body;
    if (!username || !bookTitle) {
      return res.status(400).json({ status: 'error', message: '参数不完整' });
    }
    const result = recommender.addDislike(username, bookTitle);
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 获取用户收藏列表
app.get('/api/recommend/favorites/:username', (req, res) => {
  try {
    const result = recommender.getFavorites(req.params.username);
    res.json(result);
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.get('/api/get-books', (req, res) => {
  try {
    const filePath = path.join(__dirname, '../data/books.csv');
    const data = fs.readFileSync(filePath, 'utf-8');
    
    const books = data.split('\n')
      .slice(1) // 跳过标题行
      .filter(line => line.trim())
      .map(line => {
        const [title, author, publisher, rating, category] = line.split(',');
        return { title, author, publisher, rating, category };
      });
    
    res.json(books);
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});