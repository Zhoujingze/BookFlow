const fs = require('fs');
const path = require('path');

/**
 * AI推荐助手模块
 * 实现基于内容推荐、协同过滤推荐、热度推荐的混合推荐策略
 *
 * 数据源：清洗产物 books_clean.json（Python 清洗管线输出，UTF-8）。
 * 编码检测/转换已在清洗阶段完成，此处直接消费标准化 JSON。
 */

/**
 * 读取清洗后的图书数据（JSON）
 * @returns {Promise<Array>} 图书列表
 */
function loadBooks() {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, '../data/books_clean.json');

    if (!fs.existsSync(filePath)) {
      reject(new Error('请先进行数据清洗，生成清洗后的图书数据'));
      return;
    }

    fs.readFile(filePath, 'utf-8', (err, raw) => {
      if (err) return reject(new Error(`读取清洗结果失败: ${err.message}`));

      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        return reject(new Error(`清洗结果 JSON 解析失败: ${e.message}`));
      }
      if (!Array.isArray(data)) return reject(new Error('清洗结果不是数组'));

      // 归一化字段并去重（按书名+作者）
      const seen = new Set();
      const books = data
        .map((row) => ({
          title: (row.title || '').toString().trim(),
          author: (row.author || '').toString().trim(),
          publisher: (row.publisher || '').toString().trim(),
          rating: parseFloat(row.rating) || 0,
          category: (row.category || '').toString().trim(),
        }))
        .filter((book) => {
          if (!book.title) return false;
          const key = `${book.title}|${book.author}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      resolve(books);
    });
  });
}

/**
 * 加载用户画像
 * @param {string} username - 用户名
 * @returns {Object} 用户画像数据
 */
function loadUserProfile(username) {
  const filePath = path.join(__dirname, '../data/user_profiles.json');
  if (!fs.existsSync(filePath)) return {};
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data[username] || {};
}

/**
 * 加载用户收藏/行为数据
 * @param {string} username - 用户名
 * @returns {Object} 用户行为数据
 */
function loadUserFavorites(username) {
  const filePath = path.join(__dirname, '../data/user_favorites.json');
  if (!fs.existsSync(filePath)) return { favorites: [], disliked: [] };
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data[username] || { favorites: [], disliked: [] };
}

/**
 * 保存用户收藏数据
 * @param {string} username - 用户名
 * @param {Object} favData - 收藏数据
 */
function saveUserFavorites(username, favData) {
  const filePath = path.join(__dirname, '../data/user_favorites.json');
  let allData = {};
  if (fs.existsSync(filePath)) {
    allData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  allData[username] = favData;
  fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));
}

/**
 * 基于内容的推荐（Content-Based Filtering）
 * 根据用户偏好的作者、出版社、评分区间推荐相似图书
 * 
 * @param {Array} books - 图书列表
 * @param {Object} userProfile - 用户画像
 * @param {Object} userFavorites - 用户收藏数据
 * @param {Object} preferences - 用户设置的偏好参数
 * @returns {Array} 带有内容推荐得分的图书列表
 */
function contentBasedFiltering(books, userProfile, userFavorites, preferences) {
  const favoriteBooks = userFavorites.favorites || [];
  const favoriteSet = new Set(favoriteBooks.map(f => f.title));
  
  // 从用户收藏中提取偏好特征
  const preferredAuthors = {};
  const preferredPublishers = {};
  let ratingSum = 0;
  let ratingCount = 0;
  
  favoriteBooks.forEach(book => {
    // 统计偏好作者
    if (book.author) {
      book.author.split(/[\/,]/).forEach(a => {
        const author = a.trim();
        if (author) preferredAuthors[author] = (preferredAuthors[author] || 0) + 1;
      });
    }
    // 统计偏好出版社
    if (book.publisher) {
      preferredPublishers[book.publisher] = (preferredPublishers[book.publisher] || 0) + 1;
    }
    if (book.rating) {
      ratingSum += book.rating;
      ratingCount++;
    }
  });

  // 结合用户手动设置的偏好
  if (preferences.favoriteAuthors) {
    preferences.favoriteAuthors.split(/[,，、]/).forEach(a => {
      const author = a.trim();
      if (author) preferredAuthors[author] = (preferredAuthors[author] || 0) + 2;
    });
  }
  if (preferences.favoritePublishers) {
    preferences.favoritePublishers.split(/[,，、]/).forEach(p => {
      const publisher = p.trim();
      if (publisher) preferredPublishers[publisher] = (preferredPublishers[publisher] || 0) + 2;
    });
  }

  // 用户偏好的平均评分
  const preferredAvgRating = ratingCount > 0 ? ratingSum / ratingCount : 8.0;
  
  // 用户设置的最低评分偏好
  const minRating = preferences.minRating ? parseFloat(preferences.minRating) : 7.0;

  // 计算每本书的内容推荐得分
  return books
    .filter(book => !favoriteSet.has(book.title)) // 排除已收藏的
    .map(book => {
      let score = 0;

      // 作者匹配得分（权重0.4）
      if (book.author) {
        book.author.split(/[\/,]/).forEach(a => {
          const author = a.trim();
          if (preferredAuthors[author]) {
            score += 0.4 * (preferredAuthors[author] / Math.max(...Object.values(preferredAuthors)));
          }
        });
      }

      // 出版社匹配得分（权重0.3）
      if (book.publisher && preferredPublishers[book.publisher]) {
        score += 0.3 * (preferredPublishers[book.publisher] / Math.max(...Object.values(preferredPublishers)));
      }

      // 评分相似度得分（权重0.3）
      if (book.rating > 0) {
        const ratingDiff = Math.abs(book.rating - preferredAvgRating);
        score += 0.3 * Math.max(0, 1 - ratingDiff / 5);
      }

      // 最低评分过滤
      if (book.rating < minRating) {
        score *= 0.3; // 降低低评分图书的权重
      }

      return {
        ...book,
        contentScore: Math.round(score * 100) / 100
      };
    });
}

/**
 * 协同过滤推荐（Collaborative Filtering）
 * 基于相似用户的行为进行推荐
 * 
 * @param {Array} books - 图书列表
 * @param {string} username - 当前用户
 * @param {Object} userFavorites - 当前用户收藏
 * @returns {Array} 带有协同过滤得分的图书列表
 */
function collaborativeFiltering(books, username, userFavorites) {
  const filePath = path.join(__dirname, '../data/user_favorites.json');
  let allFavorites = {};
  if (fs.existsSync(filePath)) {
    allFavorites = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  const currentUserFavs = new Set((userFavorites.favorites || []).map(f => f.title));
  const currentDisliked = new Set((userFavorites.disliked || []).map(d => d.title));
  
  // 计算与其他用户的相似度（Jaccard相似系数）
  const userSimilarities = {};
  Object.keys(allFavorites).forEach(otherUser => {
    if (otherUser === username) return;
    
    const otherFavs = new Set((allFavorites[otherUser].favorites || []).map(f => f.title));
    
    // 计算交集和并集
    const intersection = new Set([...currentUserFavs].filter(x => otherFavs.has(x)));
    const union = new Set([...currentUserFavs, ...otherFavs]);
    
    if (union.size > 0) {
      userSimilarities[otherUser] = intersection.size / union.size;
    }
  });

  // 基于相似用户的收藏计算推荐得分
  const collabScores = {};
  Object.keys(userSimilarities).forEach(otherUser => {
    const similarity = userSimilarities[otherUser];
    const otherFavs = allFavorites[otherUser].favorites || [];
    
    otherFavs.forEach(book => {
      if (!currentUserFavs.has(book.title) && !currentDisliked.has(book.title)) {
        if (!collabScores[book.title]) {
          collabScores[book.title] = 0;
        }
        collabScores[book.title] += similarity;
      }
    });
  });

  // 计算最高得分用于归一化
  const maxCollabScore = Math.max(...Object.values(collabScores), 0.001);

  return books
    .filter(book => !currentUserFavs.has(book.title))
    .map(book => ({
      ...book,
      collabScore: Math.round((collabScores[book.title] || 0) / maxCollabScore * 100) / 100
    }));
}

/**
 * 热度推荐（Popularity-Based）
 * 基于图书评分和出现频率进行推荐
 * 
 * @param {Array} books - 图书列表
 * @returns {Array} 带有热度得分的图书列表
 */
function popularityBasedFiltering(books) {
  // 计算作者出现频率
  const authorCount = {};
  const publisherCount = {};
  
  books.forEach(book => {
    if (book.author) {
      book.author.split(/[\/,]/).forEach(a => {
        const author = a.trim();
        if (author) authorCount[author] = (authorCount[author] || 0) + 1;
      });
    }
    if (book.publisher) {
      publisherCount[book.publisher] = (publisherCount[book.publisher] || 0) + 1;
    }
  });

  const maxAuthorCount = Math.max(...Object.values(authorCount), 1);
  const maxPublisherCount = Math.max(...Object.values(publisherCount), 1);

  return books.map(book => {
    // 评分得分（权重0.5）
    const ratingScore = book.rating / 10;
    
    // 作者热度得分（权重0.3）
    const authorScore = book.author ? 
      (authorCount[book.author] || 0) / maxAuthorCount : 0;
    
    // 出版社热度得分（权重0.2）
    const publisherScore = book.publisher ? 
      (publisherCount[book.publisher] || 0) / maxPublisherCount : 0;
    
    const popScore = 0.5 * ratingScore + 0.3 * authorScore + 0.2 * publisherScore;
    
    return {
      ...book,
      popularityScore: Math.round(popScore * 100) / 100
    };
  });
}

/**
 * 混合推荐算法
 * 融合基于内容、协同过滤、热度推荐三种策略
 * 
 * Final_Score = α × ContentScore + β × CollabScore + γ × PopularityScore
 * 
 * @param {string} username - 用户名
 * @param {Object} preferences - 用户偏好设置
 * @param {number} topN - 返回推荐数量
 * @returns {Promise<Object>} 推荐结果
 */
async function getRecommendations(username, preferences = {}, topN = 10) {
  // 1. 加载数据
  const books = await loadBooks();
  const userProfile = loadUserProfile(username);
  const userFavorites = loadUserFavorites(username);
  
  if (books.length === 0) {
    return {
      status: 'success',
      totalBooks: 0,
      recommendations: [],
      message: '暂无图书数据，请先进行数据爬取和清洗'
    };
  }

  // 2. 多路召回与评分
  const contentResults = contentBasedFiltering(books, userProfile, userFavorites, preferences);
  const collabResults = collaborativeFiltering(books, username, userFavorites);
  const popularityResults = popularityBasedFiltering(books);

  // 3. 构建图书查找映射
  const contentMap = {};
  contentResults.forEach(b => contentMap[b.title] = b.contentScore || 0);
  
  const collabMap = {};
  collabResults.forEach(b => collabMap[b.title] = b.collabScore || 0);
  
  const popMap = {};
  popularityResults.forEach(b => popMap[b.title] = b.popularityScore || 0);

  // 4. 加权融合
  const alpha = 0.4;   // 基于内容推荐权重
  const beta = 0.3;    // 协同过滤权重  
  const gamma = 0.3;   // 热度推荐权重

  const favoriteSet = new Set((userFavorites.favorites || []).map(f => f.title));
  const dislikedSet = new Set((userFavorites.disliked || []).map(d => d.title));

  // 归一化分数
  const maxContent = Math.max(...Object.values(contentMap), 0.001);
  const maxCollab = Math.max(...Object.values(collabMap), 0.001);
  const maxPop = Math.max(...Object.values(popMap), 0.001);

  const fusedResults = books
    .filter(book => !favoriteSet.has(book.title) && !dislikedSet.has(book.title))
    .map(book => {
      const normContent = (contentMap[book.title] || 0) / maxContent;
      const normCollab = (collabMap[book.title] || 0) / maxCollab;
      const normPop = (popMap[book.title] || 0) / maxPop;
      
      const finalScore = alpha * normContent + beta * normCollab + gamma * normPop;
      
      return {
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        rating: book.rating,
        scores: {
          content: Math.round(normContent * 100),
          collaborative: Math.round(normCollab * 100),
          popularity: Math.round(normPop * 100),
          final: Math.round(finalScore * 100)
        },
        reason: generateRecommendReason(book, preferences, preferredAuthorsFrom(contentMap, book))
      };
    })
    .sort((a, b) => b.scores.final - a.scores.final)
    .slice(0, topN);

  // 5. 返回结果
  return {
    status: 'success',
    totalBooks: books.length,
    algorithm: {
      contentWeight: alpha,
      collaborativeWeight: beta,
      popularityWeight: gamma
    },
    userFavoritesCount: (userFavorites.favorites || []).length,
    recommendations: fusedResults
  };
}

/**
 * 生成推荐理由
 */
function generateRecommendReason(book, preferences, authorMatch) {
  const reasons = [];
  
  if (preferences.favoriteAuthors) {
    const favAuthors = preferences.favoriteAuthors.split(/[,，、]/).map(a => a.trim());
    if (book.author && favAuthors.some(a => book.author.includes(a))) {
      reasons.push(`匹配您喜欢的作者`);
    }
  }
  
  if (preferences.favoritePublishers) {
    const favPubs = preferences.favoritePublishers.split(/[,，、]/).map(p => p.trim());
    if (book.publisher && favPubs.some(p => book.publisher.includes(p))) {
      reasons.push(`匹配您偏好的出版社`);
    }
  }
  
  if (book.rating >= 9.0) {
    reasons.push('高分佳作');
  } else if (book.rating >= 8.5) {
    reasons.push('口碑优秀');
  }
  
  if (reasons.length === 0) {
    reasons.push('综合推荐');
  }
  
  return reasons.join(' · ');
}

/**
 * 辅助函数：检查作者是否在内容偏好中
 */
function preferredAuthorsFrom(contentMap, book) {
  return book.author || '';
}

/**
 * 添加用户收藏
 */
function addFavorite(username, book) {
  const favData = loadUserFavorites(username);
  if (!favData.favorites) favData.favorites = [];
  
  // 检查是否已收藏
  if (favData.favorites.some(f => f.title === book.title)) {
    return { status: 'duplicate', message: '已经收藏过这本书了' };
  }
  
  favData.favorites.push(book);
  saveUserFavorites(username, favData);
  return { status: 'success', message: '收藏成功' };
}

/**
 * 添加用户不感兴趣（用于优化推荐）
 */
function addDislike(username, bookTitle) {
  const favData = loadUserFavorites(username);
  if (!favData.disliked) favData.disliked = [];
  
  if (!favData.disliked.some(d => d.title === bookTitle)) {
    favData.disliked.push({ title: bookTitle, timestamp: new Date().toISOString() });
    saveUserFavorites(username, favData);
  }
  
  return { status: 'success', message: '已记录' };
}

/**
 * 获取用户收藏列表
 */
function getFavorites(username) {
  const favData = loadUserFavorites(username);
  return {
    status: 'success',
    favorites: favData.favorites || [],
    disliked: favData.disliked || []
  };
}

/**
 * 移除收藏
 */
function removeFavorite(username, bookTitle) {
  const favData = loadUserFavorites(username);
  if (favData.favorites) {
    favData.favorites = favData.favorites.filter(f => f.title !== bookTitle);
    saveUserFavorites(username, favData);
  }
  return { status: 'success', message: '已取消收藏' };
}

/**
 * 获取推荐系统统计信息
 */
async function getStats() {
  const books = await loadBooks();
  const profilesPath = path.join(__dirname, '../data/user_profiles.json');
  const favPath = path.join(__dirname, '../data/user_favorites.json');
  
  let userCount = 0;
  if (fs.existsSync(profilesPath)) {
    const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'));
    userCount = Object.keys(profiles).length;
  }
  
  let totalFavorites = 0;
  if (fs.existsSync(favPath)) {
    const favs = JSON.parse(fs.readFileSync(favPath, 'utf-8'));
    Object.values(favs).forEach(f => {
      totalFavorites += (f.favorites || []).length;
    });
  }

  // 统计评分分布
  const ratingDist = { '9.0+': 0, '8.0-9.0': 0, '7.0-8.0': 0, '7.0以下': 0 };
  books.forEach(b => {
    if (b.rating >= 9.0) ratingDist['9.0+']++;
    else if (b.rating >= 8.0) ratingDist['8.0-9.0']++;
    else if (b.rating >= 7.0) ratingDist['7.0-8.0']++;
    else ratingDist['7.0以下']++;
  });

  // Top 作者
  const authorCount = {};
  books.forEach(b => {
    if (b.author) {
      b.author.split(/[\/,]/).forEach(a => {
        const author = a.trim();
        if (author) authorCount[author] = (authorCount[author] || 0) + 1;
      });
    }
  });
  const topAuthors = Object.entries(authorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Top 出版社
  const pubCount = {};
  books.forEach(b => {
    if (b.publisher) pubCount[b.publisher] = (pubCount[b.publisher] || 0) + 1;
  });
  const topPublishers = Object.entries(pubCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    totalBooks: books.length,
    totalUsers: userCount,
    totalFavorites: totalFavorites,
    avgRating: books.length > 0 ? 
      Math.round(books.reduce((sum, b) => sum + b.rating, 0) / books.length * 100) / 100 : 0,
    ratingDist,
    topAuthors,
    topPublishers
  };
}

module.exports = {
  getRecommendations,
  addFavorite,
  addDislike,
  getFavorites,
  removeFavorite,
  getStats
};