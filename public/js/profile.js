document.addEventListener('DOMContentLoaded', () => {
  // 加载保存的主题
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.getElementById('themeSelect').value = savedTheme;
  applyTheme(savedTheme);

  // 处理主题切换
  document.getElementById('themeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const theme = document.getElementById('themeSelect').value;
    localStorage.setItem('theme', theme);
    applyTheme(theme);
    alert('主题已切换为' + (theme === 'light' ? '亮色' : '暗色') + '模式');
  });
});

// 全局应用主题
function applyTheme(theme) {
  // 更新当前页面
  document.body.classList.remove('light-theme', 'dark-theme');
  document.body.classList.add(theme + '-theme');
  
  // 强制刷新iframe内容并应用主题
  const iframe = document.querySelector('iframe[name="content-frame"]');
  if (iframe && iframe.contentDocument) {
    iframe.contentDocument.body.classList.remove('light-theme', 'dark-theme');
    iframe.contentDocument.body.classList.add(theme + '-theme');
  }
  
  // 更新所有打开的页面
  window.postMessage({ type: 'themeChange', theme: theme }, '*');
}