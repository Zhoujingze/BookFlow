function showProfileSection(sectionId) {
  // 隐藏所有内容区
  document.querySelectorAll('.profile-section').forEach(el => {
    el.style.display = 'none';
  });
  
  // 显示选中的内容区
  document.getElementById(sectionId).style.display = 'block';
  
  // 添加加载用户数据逻辑
  const username = localStorage.getItem('username');
  if (username && sectionId === 'profile-basic') {
    window.location.href = `profile.html?username=${username}`;
  }
}