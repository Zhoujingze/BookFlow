window.addEventListener('message', (event) => {
  if (event.data.type === 'themeChange') {
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(event.data.theme + '-theme');
  }
});

// 初始化主题
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.classList.add(savedTheme + '-theme');

// 广播主题变更到所有iframe
function broadcastTheme(theme) {
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach(iframe => {
    iframe.contentWindow?.postMessage({
      type: 'themeChange',
      theme: theme
    }, '*');
  });
}

// 监听主题变更并广播
window.addEventListener('storage', (event) => {
  if (event.key === 'theme') {
    const theme = event.newValue || 'light';
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(theme + '-theme');
    broadcastTheme(theme);
  }
});