// 通用 UI 组件：分段控件（胶囊 + 会滑动的滑块）。
import { esc } from './dom.js';

// items: [[key, 文字], ...]；active: 当前 key；act: 点击时触发的 data-act；cls: 额外样式（flat 无底色，w 固定宽度）。
// 滑块的位置由 CSS 变量 --i（第几项）决定，所以切换时只要改 --i 就会有滑动动画。
export function seg(id, items, active, { act, cls = '', label = '' }) {
  const i = Math.max(0, items.findIndex(([k]) => k === active));
  const buttons = items
    .map(([k, text]) => `<button type="button" data-act="${act}" data-v="${esc(k)}" aria-pressed="${k === active}">${esc(text)}</button>`)
    .join('');
  return `<div class="seg ${cls}" role="group" aria-label="${esc(label)}" data-seg="${id}" style="--n:${items.length};--i:${i}"><i class="thumb"></i>${buttons}</div>`;
}

// render() 会整块重绘页面，滑块会直接出现在新位置而不是滑过去。
// 重绘前先记下每个分段控件的位置，重绘后让滑块从旧位置滑到新位置。
export const snapshotSegs = () =>
  new Map([...document.querySelectorAll('[data-seg]')].map(el => [el.dataset.seg, el.style.getPropertyValue('--i')]));

export function animateSegs(before) {
  document.querySelectorAll('[data-seg]').forEach(el => {
    const was = before.get(el.dataset.seg), now = el.style.getPropertyValue('--i');
    if (was == null || was === '' || was === now) return;
    const thumb = el.querySelector('.thumb');
    // 先关掉过渡，把滑块放回旧位置；再打开过渡，改回新位置。
    // 不依赖之前有没有人强制计算过样式（比如画图表时读取布局），所以顺序怎么调都稳。
    thumb.style.transition = 'none';
    el.style.setProperty('--i', was);
    void thumb.offsetWidth;
    thumb.style.transition = '';
    el.style.setProperty('--i', now);
  });
}

// 开关同理：render() 重绘后新开关直接是最终状态。
// 用户点开关时，change 事件里先把它拨回原状态再改偏好（见 main.js），重绘前的快照里就是旧状态，
// 重绘后让新开关从旧状态拨过去。
export const snapshotSwitches = () =>
  new Map([...document.querySelectorAll('input[data-pref][type=checkbox]')].map(el => [el.dataset.pref, el.checked]));

export function animateSwitches(before) {
  document.querySelectorAll('input[data-pref][type=checkbox]').forEach(el => {
    const was = before.get(el.dataset.pref), now = el.checked;
    if (was == null || was === now) return;
    const sw = el.closest('.switch');
    sw.classList.add('nt');      // 暂时关掉过渡，放到旧状态
    el.checked = was;
    void sw.offsetWidth;
    sw.classList.remove('nt');
    el.checked = now;
  });
}
