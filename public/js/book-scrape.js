document.getElementById('scrapeBtn').addEventListener('click', function() {
  const btn = this;
  const status = document.getElementById('status');
  
  btn.disabled = true;
  status.innerHTML = `
    <div class="progress-container">
      <div class="progress-info">
        <span id="progress-text">0%</span>
        <span id="book-count">0/1000 本</span>
      </div>
      <div class="progress-bar">
        <div class="progress"></div>
      </div>
    </div>
  `;
  
  // 建立SSE连接获取实时进度
  const eventSource = new EventSource('/api/scrape-progress');
  
  eventSource.onmessage = function(e) {
    const progress = JSON.parse(e.data);
    const progressBar = document.querySelector('.progress');
    const progressText = document.getElementById('progress-text');
    const bookCount = document.getElementById('book-count');
    
    progressBar.style.width = `${progress.value}%`;
    progressText.textContent = `${progress.value}%`;
    bookCount.textContent = `${Math.round(progress.value/100*300)}/1000 本`;
    
    if (progress.value === 100) {
      // 获取最终数据统计
      fetch('/api/scrape-books', {  // 添加method: 'POST'
        method: 'POST'
      })
        .then(response => response.json())
        .then(data => {
          eventSource.close();
          status.innerHTML = `<p>爬取完成，共获取 ${data.count} 条图书数据</p>`;
          btn.disabled = false;
          
          // 获取并显示表格数据
          fetch('/api/get-books')
            .then(res => {
              if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
              }
              return res.json();
            })
            .then(books => {
              console.log('Received books data:', books); // 调试日志
              renderBookTable(books);
            })
            .catch(error => {
              console.error('Error fetching books:', error);
              document.getElementById('book-table').innerHTML = 
                `<p class="error">加载图书数据失败: ${error.message}</p>`;
            });
        });
    }
  };
  
  // 触发爬取
  fetch('/api/scrape-books', {
    method: 'POST'
  }).catch(error => {
    eventSource.close();
    status.innerHTML = `<p class="error">请求失败: ${error.message}</p>`;
    btn.disabled = false;
  });
});


function renderBookTable(books) {
  const table = document.getElementById('book-table');
  if (!books || books.length === 0) {
    table.innerHTML = '<p>没有获取到图书数据</p>';
    return;
  }
  
  table.innerHTML = `
    <table class="book-table">
      <thead>
        <tr>
          <th>书名</th>
          <th>作者</th>
          <th>出版社</th>
          <th>评分</th>
        </tr>
      </thead>
      <tbody>
        ${books.map(book => `
          <tr>
            <td>${book.title || '未知'}</td>
            <td>${book.author || '未知'}</td>
            <td>${book.publisher || '未知'}</td>
            <td>${book.rating || '未知'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}