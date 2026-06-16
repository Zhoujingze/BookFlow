document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const username = document.querySelector('input[name="username"]').value.trim();
  const newPassword = document.querySelector('input[name="newPassword"]').value.trim();
  const confirmPassword = document.querySelector('input[name="confirmPassword"]').value.trim();

  if (!username || !newPassword || !confirmPassword) {
    alert('所有字段不能为空');
    return;
  }

  if (newPassword !== confirmPassword) {
    alert('两次输入的密码不一致');
    return;
  }

  try {
    const response = await fetch('/api/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, newPassword })
    });

    const result = await response.json();
    
    if (result.success) {
      alert('密码修改成功');
      window.location.href = '/login.html';
    } else {
      alert(result.message || '密码修改失败');
    }
  } catch (error) {
    console.error('密码修改请求失败:', error);
    alert('网络错误，请稍后重试');
  }
});