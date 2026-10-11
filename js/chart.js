// 总资产 / 本金趋势图：手写 SVG，支持点按或拖动查看某一天，键盘左右键逐点查看。
import { S } from './store.js';
import { niceTicks } from './model.js';
import { addDays, diffDays } from './util.js';
import { $ } from './dom.js';
import { mny } from './format.js';

const H = 220;

function axisFmt(v) {
  if (Math.abs(v) >= 1e4) return String(+(v / 1e4).toFixed(2)) + '万';
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

// 趋势图。onScrub(point) 在选中某一天时调用，取消选中时调用 onScrub(null)，
// 外面据此把图上方的读数换成该日期的数值（和苹果「股市」一样）。
export function drawTrend(host, pts, onScrub = () => {}) {
  onScrub(null);
  if (pts.length < 2) {
    host.innerHTML = '<div class="empty">记录两次以上，这里就会画出资产变化曲线。</div>';
    return;
  }
  const W = Math.max(260, Math.floor(host.clientWidth) || 320);
  const m = { t: 22, r: S.hide ? 10 : 44, b: 24, l: 8 };
  const first = pts[0].d;
  const span = Math.max(1, diffDays(first, pts[pts.length - 1].d));
  const X = d => m.l + diffDays(first, d) / span * (W - m.l - m.r);

  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { lo = Math.min(lo, p.v, p.c); hi = Math.max(hi, p.v, p.c); }
  const padv = (hi - lo) * .14 || hi * .04 || 1;
  const ticks = niceTicks(Math.max(0, lo - padv), hi + padv, 4);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const Y = v => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const f = n => n.toFixed(1);

  const line = k => pts.map((p, i) => (i ? 'L' : 'M') + f(X(p.d)) + ' ' + f(Y(p[k]))).join('');
  const band = line('v') + pts.slice().reverse().map(p => 'L' + f(X(p.d)) + ' ' + f(Y(p.c))).join('') + 'Z';

  let grid = '', ylab = '';
  for (const t of ticks) {
    grid += `<line class="g-grid" x1="${m.l}" x2="${W - m.r}" y1="${f(Y(t))}" y2="${f(Y(t))}"/>`;
    if (!S.hide) ylab += `<text class="g-txt" x="${W - m.r + 8}" y="${f(Y(t))}" dy="0.34em" text-anchor="start">${axisFmt(t)}</text>`;
  }
  const k = Math.min(4, span + 1);
  let xlab = '';
  for (let i = 0; i < k; i++) {
    const d = addDays(first, Math.round(span * i / (k - 1 || 1)));
    const txt = span <= 240 ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : `${d.slice(2, 4)}/${+d.slice(5, 7)}`;
    xlab += `<text class="g-txt" x="${f(X(d))}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === k - 1 ? 'end' : 'middle'}">${txt}</text>`;
  }

  const lp = pts[pts.length - 1], ex = X(lp.d), ey = Y(lp.v);
  const endLab = S.hide ? '' : `<text class="g-end" x="${f(ex)}" y="${f(ey - 12)}" text-anchor="end">${mny(lp.v)}</text>`;
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" tabindex="0" aria-label="资产变化曲线，共 ${pts.length} 个记录点，可用左右方向键逐点查看">
${grid}${ylab}${xlab}<path class="g-band" d="${band}"/><path class="g-cost" d="${line('c')}"/><path class="g-tot" d="${line('v')}"/>
<circle class="g-dot" cx="${f(ex)}" cy="${f(ey)}" r="5"/>${endLab}
<g id="xh" hidden><line class="g-xh" x1="0" x2="0" y1="${m.t}" y2="${H - m.b}"/><circle class="g-dot" id="xh1" r="5" cx="0" cy="0"/><circle class="g-dot2" id="xh2" r="4.5" cx="0" cy="0"/></g></svg>`;

  // ---- 竖线、圆点与上方读数 ----
  const svg = host.firstElementChild, xh = $('#xh', svg);
  const line0 = xh.firstElementChild, dotV = $('#xh1', svg), dotC = $('#xh2', svg);
  let cur = -1;

  // 注意：SVG 元素没有会同步到属性的 hidden 属性，必须用 toggleAttribute，
  // 写 xh.hidden = false 不会把 hidden 属性去掉，竖线就永远不显示。
  function show(i) {
    if (i === cur) return;
    cur = i;
    const p = pts[i], x = f(X(p.d));
    line0.setAttribute('x1', x); line0.setAttribute('x2', x);
    dotV.setAttribute('cx', x); dotV.setAttribute('cy', f(Y(p.v)));
    dotC.setAttribute('cx', x); dotC.setAttribute('cy', f(Y(p.c)));
    xh.toggleAttribute('hidden', false);
    onScrub(p);
  }
  function hide() {
    if (cur < 0) return;
    cur = -1;
    xh.toggleAttribute('hidden', true);
    onScrub(null);
  }
  function idxAt(clientX) {
    const r = svg.getBoundingClientRect(), x = (clientX - r.left) * (W / r.width);
    let bi = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(X(p.d) - x); if (d < bd) { bd = d; bi = i; } });
    return bi;
  }

  // 鼠标：悬停即显示，移开收起。
  // 触屏：按住约 90ms 后显示竖线，之后跟着手指横向拖动；抬手后保留，点图表以外的地方收起。
  //   延迟一点是因为纵向滑动想滚页面时，浏览器会很快发 pointercancel 接管；
  //   如果一按下就显示，滚页面时竖线会先闪一下再消失。
  //   一旦出现横向移动（pointermove）或抬手（pointerup）就立刻显示。
  let holdTimer = 0, touchX = 0;
  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = 0; };
  svg.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') { show(idxAt(e.clientX)); return; }
    touchX = e.clientX;
    cancelHold();
    holdTimer = setTimeout(() => show(idxAt(touchX)), 90);
  });
  svg.addEventListener('pointermove', e => {
    touchX = e.clientX;
    cancelHold();
    show(idxAt(e.clientX));
  });
  svg.addEventListener('pointerup', e => {
    if (e.pointerType !== 'touch') return;
    cancelHold();
    show(idxAt(e.clientX));
  });
  svg.addEventListener('pointercancel', () => { cancelHold(); hide(); }); // 手势被浏览器当成页面滚动
  svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', e => {
    const last = pts.length - 1;
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (step) show(Math.max(0, Math.min(last, (cur < 0 ? last : cur) + step)));
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(last);
    else if (e.key === 'Escape') hide();
    else return;
    e.preventDefault();
  });
  dismissOutside = { host, hide };
}

// 点图表以外的任何地方取消选中（触屏上没有“鼠标移开”，也不会触发 blur）
let dismissOutside = null;
document.addEventListener('pointerdown', e => {
  if (dismissOutside && !dismissOutside.host.contains(e.target)) dismissOutside.hide();
});
