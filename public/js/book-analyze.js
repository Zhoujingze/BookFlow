document.getElementById('analyzeBtn').addEventListener('click', function() {
  const btn = this;
  const status = document.getElementById('status');
  
  btn.disabled = true;
  status.innerHTML = '<p>正在分析数据...</p>';
  
  fetch('/api/analyze-books', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
      type: document.getElementById('analysisType').value 
    })
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`服务器返回 ${response.status}: ${text || '无详细错误信息'}`);
      });
    }
    return response.json();
  })
  .then(data => {
    if(data.status === 'success') {
      const results = data.result;
      displayAnalysisResults(results, document.getElementById('analysisType').value);
    } else {
      status.innerHTML = `<p class="error">分析失败: ${data.message}</p>`;
    }
    btn.disabled = false;
  })
  .catch(error => {
    status.innerHTML = `<p class="error">请求失败: ${error.message}</p>`;
    btn.disabled = false;
  });
});

function displayAnalysisResults(results, analysisType) {
  const status = document.getElementById('status');
  let resultHTML = `<div class="analysis-results"><h3>分析结果</h3><table class="result-table"><thead><tr>`;
  
  if (analysisType === 'rating') {
    resultHTML += `<th>评分区间</th><th>图书数量</th></tr></thead><tbody>`;
    for (const [rating, count] of Object.entries(results)) {
      resultHTML += `<tr><td>${rating}星</td><td>${count}本</td></tr>`;
    }
  } else if (analysisType === 'publisher') {
    resultHTML += `<th>出版社</th><th>图书数量</th></tr></thead><tbody>`;
    for (const [publisher, count] of Object.entries(results)) {
      resultHTML += `<tr><td>${publisher}</td><td>${count}本</td></tr>`;
    }
  } else if (analysisType === 'category') {
    resultHTML += `<th>图书品类</th><th>图书数量</th></tr></thead><tbody>`;
    for (const [category, count] of Object.entries(results)) {
      resultHTML += `<tr><td>${category}</td><td>${count}本</td></tr>`;
    }
  } else {
    resultHTML += `<th>作者</th><th>图书数量</th></tr></thead><tbody>`;
    for (const [author, count] of Object.entries(results)) {
      resultHTML += `<tr><td>${author}</td><td>${count}本</td></tr>`;
    }
  }
  
  status.innerHTML = resultHTML + `</tbody></table></div>`;
}