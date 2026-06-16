document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const username = document.querySelector('input[name="username"]').value.trim();
  const password = document.querySelector('input[name="password"]').value.trim();

  // 前端空校验
  if (!username || !password) {
    alert('用户名和密码不能为空');
    return;
  }

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();
    
    if (result.success) {
      localStorage.setItem('username', result.user.username);
      window.location.href = '/dashboard.html';
    } else {
      alert(result.message || '登录失败');
    }
  } catch (error) {
    console.error('登录请求失败:', error);
    alert('网络错误，请稍后重试');
  }
});