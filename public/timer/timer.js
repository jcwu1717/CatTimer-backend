// timer/timer.js
// 可被單元測試的純函式：計算格式化時間與倒數更新下一值
function formatTime(s){
  if (s < 0) s = 0;
  const m = Math.floor(s/60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2,'0');
  return `${pad(m)}:${pad(sec)}`;
}

function tick(remaining){
  // 回傳下一個剩餘秒數（模擬一秒過後）
  return Math.max(0, remaining - 1);
}

module.exports = { formatTime, tick };
