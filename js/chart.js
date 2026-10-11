// 总资产 / 本金趋势图：手写 SVG，支持点按或拖动查看某一天，键盘左右键逐点查看。
import { S } from './store.js';
import { niceTicks } from './model.js';
import { addDays, diffDays, r2 } from './util.js';
import { $ } from './dom.js';
import { mny, sgnAmt } from './format.js';

const H = 220;

function axisFmt(v) {
  if (Math.abs(v) >= 1e4) return String(+(v / 1e4).toFixed(2)) + '万';
  return v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

export function drawTrend(host, pts) {
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

  // ---- 十字光标与浮窗 ----
  const svg = host.firstElementChild, xh = $('#xh', svg);
  const tt = document.createElement('div');
  tt.className = 'tt';
  tt.hidden = true;
  host.appendChild(tt);
  let cur = -1;

  function show(i) {
    if (i === cur && !tt.hidden) return;
    cur = i;
    const p = pts[i], x = X(p.d);
    const l = xh.firstElementChild;
    l.setAttribute('x1', f(x)); l.setAttribute('x2', f(x));
    const c1 = $('#xh1', svg), c2 = $('#xh2', svg);
    c1.setAttribute('cx', f(x)); c1.setAttribute('cy', f(Y(p.v)));
    c2.setAttribute('cx', f(x)); c2.setAttribute('cy', f(Y(p.c)));
    xh.hidden = false;
    tt.innerHTML = `<div class="d">${p.d.replace(/-/g, '/')}</div><div class="r"><i></i><span>总资产</span><b>${mny(p.v)}</b></div><div class="r"><i class="c"></i><span>本金</span><b>${mny(p.c)}</b></div><div class="r"><i class="n"></i><span>累计收益</span><b>${sgnAmt(r2(p.v - p.c), true)}</b></div>`;
    tt.hidden = false;
    const px = x * host.clientWidth / W, w = tt.offsetWidth;
    tt.style.left = Math.max(0, Math.min(host.clientWidth - w, px > host.clientWidth / 2 ? px - w - 12 : px + 12)) + 'px';
  }
  function hide() { cur = -1; xh.hidden = true; tt.hidden = true; }
  function idxAt(clientX) {
    const r = svg.getBoundingClientRect(), x = (clientX - r.left) * (W / r.width);
    let bi = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(X(p.d) - x); if (d < bd) { bd = d; bi = i; } });
    return bi;
  }
  // 鼠标：悬停即显示，移开收起。
  // 触屏：点按、或横向拖动时显示，抬手后保留（方便读数），点图表以外的地方收起。
  // 触屏在 pointerdown 时先不显示：纵向滑动想滚页面时，浏览器会发 pointercancel 接管，
  // 如果一按下就显示，滚动时浮窗会先闪一下再消失。
  svg.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') show(idxAt(e.clientX)); });
  svg.addEventListener('pointermove', e => show(idxAt(e.clientX)));
  svg.addEventListener('pointerup', e => { if (e.pointerType === 'touch') show(idxAt(e.clientX)); });
  svg.addEventListener('pointercancel', hide); // 手势被浏览器当成页面滚动
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

// 点图表以外的任何地方收起浮窗（触屏上没有“鼠标移开”，也不会触发 blur）
let dismissOutside = null;
document.addEventListener('pointerdown', e => {
  if (dismissOutside && !dismissOutside.host.contains(e.target)) dismissOutside.hide();
});
