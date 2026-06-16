// book-visualize.js
document.getElementById('visualizeBtn').addEventListener('click', function() {
    const btn = this;
    const container = document.getElementById('chartContainer');
    
    btn.disabled = true;
    container.innerHTML = '<div class="loading-spinner"></div><p>正在生成图表...</p>';
    
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
        throw new Error(`HTTP错误! 状态码: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if(data.status === 'success') {
        // 直接使用data.result，不再需要JSON.parse
        const results = data.result;
        
        if(!results || Object.keys(results).length === 0) {
          container.innerHTML = '<p class="error">没有可用的数据</p>';
        } else {
          renderChart(results);
        }
      } else {
        container.innerHTML = `<p class="error">${data.message}</p>`;
      }
      btn.disabled = false;
    })
    .catch(error => {
      console.error('请求失败:', error);
      container.innerHTML = `<p class="error">请求失败: ${error.message}</p>`;
      btn.disabled = false;
    });
  });
  
  function renderChart(data) {
    const analysisType = document.getElementById('analysisType').value;
    const container = document.getElementById('chartContainer');
    
    // 创建图表卡片
    const chartCard = document.createElement('div');
    chartCard.className = 'chart-card';
    
    // 添加图表标题
    const titleMap = {
      'publisher': '出版社图书数量',
      'author': '作者图书数量',
      'rating': '图书评分分布'
    };
    const title = titleMap[analysisType] || '图书信息分析';
    
    chartCard.innerHTML = `
      <div class="chart-title">${title}</div>
      <div class="chart-canvas-container">
        <canvas id="bookChart"></canvas>
      </div>
      <div class="chart-summary">
        共统计了 ${Object.values(data).reduce((a, b) => a + b, 0)} 本图书
      </div>
    `;
    
    container.innerHTML = '';
    container.appendChild(chartCard);
    
    // 准备图表数据
    const labels = Object.keys(data);
    const values = Object.values(data);
    
    // 创建图表
    const ctx = document.getElementById('bookChart').getContext('2d');
    new Chart(ctx, {
      type: document.getElementById('chartType').value,
      data: {
        labels: labels,
        datasets: [{
          label: '图书数量',
          data: values,
          backgroundColor: getBackgroundColors(analysisType, labels.length),
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.label}: ${context.raw} 本`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: '图书数量'
            }
          },
          x: {
            title: {
              display: true,
              text: analysisType === 'rating' ? '评分区间' : 
                   analysisType === 'publisher' ? '出版社' : '作者'
            }
          }
        }
      }
    });
  }
  
  function getBackgroundColors(type, count) {
    const colors = [];
    const hueStep = 360 / count;
    
    for(let i = 0; i < count; i++) {
      const hue = Math.floor(i * hueStep);
      colors.push(`hsla(${hue}, 70%, 60%, 0.7)`);
    }
    return colors;
  }