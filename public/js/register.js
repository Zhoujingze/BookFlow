document.getElementById('registerForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const formData = {
    username: document.querySelector('input[name="username"]').value,
    password: document.querySelector('input[name="password"]').value,
    confirmPassword: document.querySelector('input[name="confirmPassword"]').value,
    email: document.querySelector('input[name="email"]').value
  };

  // 验证密码是否一致
  if (formData.password !== formData.confirmPassword) {
    alert('两次输入的密码不一致');
    return;
  }

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    const result = await response.json();
    
    if (result.success) {
      alert('注册成功');
      window.location.href = '/login.html';
    } else {
      alert(result.message || '注册失败');
    }
  } catch (error) {
    console.error('注册请求失败:', error);
    alert('网络错误，请稍后重试');
  }
});