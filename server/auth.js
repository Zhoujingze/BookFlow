const fs = require('fs');
const path = require('path');
const usersPath = path.join(__dirname, '../data/users.json');

// 用户注册
function register(username, password, email) {
  const usersData = JSON.parse(fs.readFileSync(usersPath));
  
  // 检查用户名是否已存在
  if (usersData.users.some(user => user.username === username)) {
    return { success: false, message: '用户名已存在' };
  }

  // 添加新用户
  usersData.users.push({
    username,
    password, // 实际项目中应该加密存储
    email
  });

  fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
  return { success: true };
}

// 用户登录
function login(username, password) {
  // 增加空校验
  if (!username || !password) {
    return { success: false, message: '用户名和密码不能为空' };
  }

  const usersData = JSON.parse(fs.readFileSync(usersPath));
  const user = usersData.users.find(u => u.username === username);
  
  if (!user || user.password !== password) {
    return { success: false, message: '用户名或密码错误' };
  }
  
  return { success: true, user };
}


// 重置密码
function resetPassword(username, newPassword) {
  const usersData = JSON.parse(fs.readFileSync(usersPath));
  const user = usersData.users.find(u => u.username === username);
  
  if (!user) {
    return { success: false, message: '用户名不存在' };
  }
  
  user.password = newPassword;
  fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
  return { success: true };
}

module.exports = { register, login, resetPassword };