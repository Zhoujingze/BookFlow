document.addEventListener('DOMContentLoaded', async () => {
  // 从URL获取username
  const urlParams = new URLSearchParams(window.location.search);
  const username = urlParams.get('username') || localStorage.getItem('username');
  
  if (!username) {
    alert('请先登录');
    window.location.href = 'login.html';
    return;
  }

  // 加载用户信息
  try {
    const response = await fetch(`/api/get-profile/${username}`);
    if (!response.ok) throw new Error('获取用户信息失败');
    
    const profile = await response.json();
    if (profile && profile.username) {
      // 更新界面显示
      document.querySelector('.profile-section h2').textContent = `${profile.username}的个人信息`;
      // 填充表单
      document.getElementById('name').value = profile.name || '';
      document.getElementById('age').value = profile.age || '';
      document.getElementById('gender').value = profile.gender || '';
      document.getElementById('email').value = profile.email || '';
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
    alert('加载用户信息失败，请刷新重试');
  }

  // 保存表单
  document.getElementById('saveProfile').addEventListener('click', async () => {
    const profileData = {
      name: document.getElementById('name').value,
      age: document.getElementById('age').value,
      gender: document.getElementById('gender').value,
      email: document.getElementById('email').value
    };

    try {
      const response = await fetch('/api/save-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          ...profileData
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('个人信息保存成功');
      } else {
        alert('保存失败: ' + (result.message || '未知错误'));
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    }
  });
});