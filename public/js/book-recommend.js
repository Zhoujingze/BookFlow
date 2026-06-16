// book-recommend.js - AI图书推荐助手前端逻辑

document.addEventListener('DOMContentLoaded', function() {
  const username = localStorage.getItem('username');
  if (!username) return;

  // 加载统计数据
  loadStats();
  loadFavorites();

  // Tab切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('tab-' + this.dataset.tab).classList.add('active');
      
      if (this.dataset.tab === 'favorites') {
        loadFavorites();
      }
    });
  });

  // 推荐按钮
  document.getElementById('recommendBtn').addEventListener('click', function() {
    getRecommendations();
  });

  // 加载统计数据
  function loadStats() {
    fetch('/api/recommend/stats')
      .then(res => res.json())
      .then(data => {
        document.getElementById('statBooks').textContent = data.totalBooks || 0;
        document.getElementById('statAvgRating').textContent = data.avgRating || '-';
        document.getElementById('statUsers').textContent = data.totalUsers || 0;
        document.getElementById('statFavorites').textContent = data.totalFavorites || 0;
      })
      .catch(err => {
        console.error('加载统计数据失败:', err);
      });
  }

  // 获取推荐
  function getRecommendations() {
    const btn = document.getElementById('recommendBtn');
    const container = document.getElementById('recommendResults');
    
    btn.disabled = true;
    btn.textContent = '⏳ AI正在分析中...';
    container.innerHTML = '<div class="loading-spinner"></div><p style="text-align:center;color:#888;">正在运行推荐算法，请稍候...</p>';

    const preferences = {
      favoriteAuthors: document.getElementById('prefAuthors').value.trim(),
      favoritePublishers: document.getElementById('prefPublishers').value.trim(),
      minRating: document.getElementById('prefMinRating').value,
      topN: parseInt(document.getElementById('prefTopN').value)
    };

    fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: username,
        preferences: preferences,
        topN: preferences.topN
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        renderRecommendations(data);
      } else {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>${data.message || '推荐失败，请稍后重试'}</p></div>`;
      }
    })
    .catch(err => {
      console.error('推荐请求失败:', err);
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>请求失败: ${err.message}</p></div>`;
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = '🚀 获取AI推荐';
    });
  }

  // 渲染推荐结果
  function renderRecommendations(data) {
    const container = document.getElementById('recommendResults');
    const books = data.recommendations || [];
    
    if (books.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <p>${data.message || '暂无推荐结果，请先爬取并清洗图书数据'}</p>
        </div>`;
      return;
    }

    let html = `
      <div class="result-header">
        <h3>📊 为您推荐 ${books.length} 本图书</h3>
        <span class="algo-info">
          内容(${Math.round(data.algorithm.contentWeight * 100)}%) + 
          协同(${Math.round(data.algorithm.collaborativeWeight * 100)}%) + 
          热度(${Math.round(data.algorithm.popularityWeight * 100)}%)
          | 数据集: ${data.totalBooks}本 | 已收藏: ${data.userFavoritesCount}本
        </span>
      </div>
    `;

    books.forEach((book, index) => {
      const rank = index + 1;
      const ratingClass = book.rating >= 8.5 ? 'high' : '';
      html += `
        <div class="book-card">
          <div class="book-rank ${rank <= 3 ? 'top3' : ''}">${rank}</div>
          <div class="book-info">
            <div class="book-title-row">
              <span class="title">${escapeHtml(book.title)}</span>
              <span class="book-rating ${ratingClass}">⭐ ${book.rating}</span>
            </div>
            <div class="book-meta">
              <span>✍️ ${escapeHtml(book.author || '未知作者')}</span>
              <span>🏢 ${escapeHtml(book.publisher || '未知出版社')}</span>
            </div>
            <div class="book-reason">💡 ${escapeHtml(book.reason)}</div>
            <div class="book-scores">
              <div class="score-bar bar-content">
                <span>内容</span>
                <div class="bar"><div class="bar-fill" style="width:${book.scores.content}%"></div></div>
                <span>${book.scores.content}%</span>
              </div>
              <div class="score-bar bar-collab">
                <span>协同</span>
                <div class="bar"><div class="bar-fill" style="width:${book.scores.collaborative}%"></div></div>
                <span>${book.scores.collaborative}%</span>
              </div>
              <div class="score-bar bar-pop">
                <span>热度</span>
                <div class="bar"><div class="bar-fill" style="width:${book.scores.popularity}%"></div></div>
                <span>${book.scores.popularity}%</span>
              </div>
              <div class="score-bar bar-final">
                <span>综合</span>
                <div class="bar"><div class="bar-fill" style="width:${book.scores.final}%"></div></div>
                <span>${book.scores.final}%</span>
              </div>
            </div>
          </div>
          <div class="book-actions">
            <button class="btn-fav" onclick="addFavorite('${escapeJs(book.title)}', '${escapeJs(book.author)}', '${escapeJs(book.publisher)}', ${book.rating})">⭐ 收藏</button>
            <button class="btn-dislike" onclick="addDislike('${escapeJs(book.title)}')">不感兴趣</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // 加载收藏列表
  function loadFavorites() {
    fetch(`/api/recommend/favorites/${username}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          renderFavorites(data.favorites || []);
        }
      })
      .catch(err => console.error('加载收藏失败:', err));
  }

  // 渲染收藏列表
  function renderFavorites(favorites) {
    const container = document.getElementById('favoritesList');
    
    if (favorites.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⭐</div>
          <p>暂无收藏图书，快去获取推荐并收藏喜欢的书吧！</p>
        </div>`;
      return;
    }

    let html = `<h3 style="margin-bottom:15px;">我的收藏（${favorites.length}本）</h3>`;
    favorites.forEach(book => {
      html += `
        <div class="fav-item">
          <div>
            <div class="fav-info">📖 ${escapeHtml(book.title)}</div>
            <div class="fav-meta">✍️ ${escapeHtml(book.author || '未知')} | 🏢 ${escapeHtml(book.publisher || '未知')} | ⭐ ${book.rating || '-'}</div>
          </div>
          <button class="btn-remove" onclick="removeFavorite('${escapeJs(book.title)}')">取消收藏</button>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  // 全局函数：添加收藏
  window.addFavorite = function(title, author, publisher, rating) {
    fetch('/api/recommend/favorite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, book: { title, author, publisher, rating } })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        alert('⭐ 收藏成功！收藏数据将优化后续推荐');
        // 刷新统计数据
        loadStats();
      } else if (data.status === 'duplicate') {
        alert('已经收藏过这本书了');
      }
    })
    .catch(err => alert('收藏失败: ' + err.message));
  };

  // 全局函数：不感兴趣
  window.addDislike = function(title) {
    fetch('/api/recommend/dislike', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, bookTitle: title })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        alert('已记录您的偏好，后续推荐将优化');
        // 从列表中移除该书
        const cards = document.querySelectorAll('.book-card');
        cards.forEach(card => {
          if (card.querySelector('.title') && card.querySelector('.title').textContent === title) {
            card.style.opacity = '0.3';
            card.querySelector('.btn-dislike').textContent = '已标记';
            card.querySelector('.btn-dislike').disabled = true;
          }
        });
      }
    })
    .catch(err => alert('操作失败: ' + err.message));
  };

  // 全局函数：取消收藏
  window.removeFavorite = function(title) {
    fetch('/api/recommend/favorite', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, bookTitle: title })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        loadFavorites();
        loadStats();
      }
    })
    .catch(err => alert('取消收藏失败: ' + err.message));
  };

  // HTML转义
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // JS字符串转义
  function escapeJs(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
  }
});