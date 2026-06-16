document.getElementById('cleanBtn').addEventListener('click', function() {
  const btn = this;
  const status = document.getElementById('status');
  
  btn.disabled = true;
  status.innerHTML = `
    <div class="progress-container">
      <div class="progress-info">
        <span id="progress-text">0%</span>
        <span id="book-count">0 本</span>
      </div>
      <div class="progress-bar">
        <div class="progress"></div>
      </div>
    </div>
  `;
  
  // 建立SSE连接获取实时进度
  const eventSource = new EventSource('/api/clean-progress');
  
  eventSource.onmessage = function(e) {
    const progress = JSON.parse(e.data);
    const progressBar = document.querySelector('.progress');
    const progressText = document.getElementById('progress-text');
    const bookCount = document.getElementById('book-count');
    
    progressBar.style.width = `${progress.value}%`;
    progressText.textContent = `${progress.value}%`;
    bookCount.textContent = `${Math.round(progress.value)}% 完成`;
  };
  
  // 触发清洗
  fetch('/api/clean-books', {
    method: 'POST'
  })
  .then(response => response.json())
  .then(data => {
    eventSource.close();
    if(data.status === 'success') {
      status.innerHTML = `<p>清洗完成，共处理 ${data.count} 条图书数据</p>`;
      fetch('/api/get-books')
        .then(res => res.json())
        .then(books => renderBookTable(books))
        .catch(err => console.error('获取图书数据失败:', err));
    } else {
      status.innerHTML = `<p class="error">清洗失败: ${data.message}</p>`;
    }
    btn.disabled = false;
  })
  .catch(error => {
    eventSource.close();
    status.innerHTML = `<p class="error">请求失败: ${error.message}</p>`;
    btn.disabled = false;
  });
});


function renderBookTable(books) {
  const container = document.getElementById('book-table-container');
  if (!books.length) {
    container.innerHTML = '<p>没有可显示的图书数据</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'book-table';
  
  // 创建表头
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['书名', '作者', '出版社', '评分'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // 创建表体
  const tbody = document.createElement('tbody');
  books.forEach(book => {
    const row = document.createElement('tr');
    [book.title, book.author, book.publisher, book.rating].forEach(text => {
      const td = document.createElement('td');
      td.textContent = text;
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  
  container.innerHTML = '';
  container.appendChild(table);
}