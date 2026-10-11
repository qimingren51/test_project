// DOM 小工具
export const $ = (sel, root) => (root || document).querySelector(sel);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// 所有写进 innerHTML 的用户输入（账户名、平台名等）都必须先经过它
export const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2800);
}

// 危险操作的“二次确认”：第一次点击把按钮文字换成提示，4 秒内再点一次才执行。
export function arm(btn, label, fn) {
  if (btn.dataset.armed) { fn(); return; }
  btn.dataset.armed = '1';
  btn.dataset.o = btn.textContent;
  btn.textContent = label;
  setTimeout(() => {
    if (btn.isConnected && btn.dataset.armed) {
      delete btn.dataset.armed;
      btn.textContent = btn.dataset.o;
    }
  }, 4000);
}
