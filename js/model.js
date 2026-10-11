// 纯数据逻辑：账户结构、汇总序列、月度变化、资产配置。不碰 DOM 和存储。
//
// 账户结构：
//   { id, name, platform, cat, createdAt, hist: [{ d, v, c }] }
//   hist 按日期升序，每个日期一条；v 是当天市值，c 是截至当天的累计投入本金。
import { DATE_RE, pad, addDays, r2, todayStr } from './util.js';

export const CATS = [
  { k: 'cash', n: '现金·存款' }, { k: 'bond', n: '债券·固收' }, { k: 'stock', n: '股票·基金' },
  { k: 'gold', n: '黄金·商品' }, { k: 'global', n: '海外资产' }, { k: 'pension', n: '养老·保险' },
  { k: 'other', n: '其他' },
];

const ID_RE = /^[A-Za-z0-9_.~:@+-]{1,100}$/;

export const newId = () => 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const last = a => a.hist[a.hist.length - 1];
export const prevOf = a => (a.hist.length > 1 ? a.hist[a.hist.length - 2] : null);
export const catIdx = k => {
  const i = CATS.findIndex(c => c.k === k);
  return i < 0 ? CATS.length - 1 : i;
};

// 所有账户按日期合并成总资产序列：每个日期取各账户“不晚于该日”的最近一条记录求和。
export function series(accs) {
  const dates = [...new Set(accs.flatMap(a => a.hist.map(h => h.d)))].sort();
  const idx = accs.map(() => -1);
  return dates.map(d => {
    let v = 0, c = 0;
    accs.forEach((a, i) => {
      while (idx[i] + 1 < a.hist.length && a.hist[idx[i] + 1].d <= d) idx[i]++;
      const h = a.hist[idx[i]];
      if (h) { v += h.v; c += h.c; }
    });
    return { d, v: r2(v), c: r2(c) };
  });
}

// 取最近 days 天；窗口起点用起点之前的最后一条记录补齐，days 为 null 表示全部。
export function rangeSeries(pts, days) {
  if (!pts.length) return [];
  if (days == null) return pts;
  const start = addDays(pts[pts.length - 1].d, -days);
  let base = null;
  for (const p of pts) { if (p.d <= start) base = p; else break; }
  const inside = pts.filter(p => p.d > start);
  return base ? [{ d: start, v: base.v, c: base.c }, ...inside] : inside;
}

// 区间变化 = 资产变化(dv) 拆成 追加投入(dc) + 投资收益(dp)
export function rangeChange(pts) {
  if (pts.length < 2) return null;
  const a = pts[0], b = pts[pts.length - 1];
  const dv = r2(b.v - a.v), dc = r2(b.c - a.c);
  return { dv, dc, dp: r2(dv - dc), from: a.d, to: b.d, v0: a.v };
}

// 月度表：每月末资产，以及相对上月的追加投入和投资收益。返回最近 n 个月，新的在前。
export function monthly(pts, n) {
  if (!pts.length) return [];
  let [y, m] = pts[0].d.slice(0, 7).split('-').map(Number);
  const [ly, lm] = pts[pts.length - 1].d.slice(0, 7).split('-').map(Number);
  const rows = [];
  let prev = null, end = null, i = 0;
  while (y < ly || (y === ly && m <= lm)) {
    const mk = y + '-' + pad(m);
    while (i < pts.length && pts[i].d.slice(0, 7) <= mk) end = pts[i++];
    rows.push({
      m: mk, v: end.v, c: end.c,
      dv: prev ? r2(end.v - prev.v) : null,
      dc: prev ? r2(end.c - prev.c) : null,
      dp: prev ? r2((end.v - prev.v) - (end.c - prev.c)) : null,
    });
    prev = end;
    if (++m > 12) { m = 1; y++; }
  }
  return rows.slice(-n).reverse();
}

// 按平台分组，组内、组间都按市值降序
export function groupByPlatform(accs) {
  const m = new Map();
  for (const a of accs) {
    if (!m.has(a.platform)) m.set(a.platform, []);
    m.get(a.platform).push(a);
  }
  return [...m.entries()]
    .map(([p, arr]) => ({
      p,
      arr: arr.slice().sort((x, y) => last(y).v - last(x).v),
      sum: arr.reduce((s, a) => s + last(a).v, 0),
    }))
    .sort((x, y) => y.sum - x.sum);
}

// 资产配置占比。by = 'cat'（按类型）或 'platform'（按平台，前 6 个平台各占一色，其余合并）。
export function allocation(accs, by) {
  let order = [];
  if (by === 'platform') {
    const first = new Map();
    for (const a of accs) {
      if (!first.has(a.platform) || a.createdAt < first.get(a.platform)) first.set(a.platform, a.createdAt);
    }
    order = [...first.entries()]
      .sort((x, y) => (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : x[0] < y[0] ? -1 : 1))
      .map(e => e[0]);
  }
  const m = new Map();
  for (const a of accs) {
    const l = last(a);
    if (!l || l.v <= 0) continue;
    let key, label, ci;
    if (by === 'cat') {
      const i = catIdx(a.cat);
      key = CATS[i].k; label = CATS[i].n; ci = i < 6 ? i + 1 : 0;
    } else {
      const r = order.indexOf(a.platform);
      if (r < 6) { key = 'p:' + a.platform; label = a.platform; ci = r + 1; }
      else { key = 'p:*'; label = '其他平台'; ci = 0; }
    }
    const e = m.get(key) || { key, label, ci, v: 0 };
    e.v = r2(e.v + l.v);
    m.set(key, e);
  }
  const arr = [...m.values()].sort((x, y) => y.v - x.v);
  const tot = arr.reduce((s, x) => s + x.v, 0);
  arr.forEach(x => { x.pct = tot ? x.v / tot : 0; });
  return arr;
}

// 视图所需的全部派生数据，一次算好
export function buildModel(list, range) {
  const pts = series(list);
  return {
    L: list,
    pts,
    lastP: pts[pts.length - 1] || { d: todayStr(), v: 0, c: 0 },
    prevP: pts.length > 1 ? pts[pts.length - 2] : null,
    rp: rangeSeries(pts, range === 'all' ? null : +range),
  };
}

// 图表纵轴的“整齐”刻度
export function niceTicks(lo, hi, n) {
  if (!(hi > lo)) hi = lo + 1;
  const raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const a = Math.floor(lo / step + 1e-9), b = Math.ceil(hi / step - 1e-9), out = [];
  for (let i = a; i <= b; i++) out.push(i * step);
  return out;
}

// 校验并清洗一个账户（来自本机存储或导入文件）；无有效记录时返回 null。
export function normAcc(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const src = Array.isArray(raw.hist) ? raw.hist : [];
  const list = src
    .map(h => ({ d: String(h && h.d), v: Number(h && h.v), c: Number(h && h.c) }))
    .filter(h => DATE_RE.test(h.d) && Number.isFinite(h.v) && Number.isFinite(h.c) && h.v >= 0 && h.c >= 0)
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const hist = [];
  for (const h of list) {
    if (hist.length && hist[hist.length - 1].d === h.d) hist[hist.length - 1] = h; // 同一天以后者为准
    else hist.push(h);
  }
  if (!hist.length) return null;
  return {
    id: ID_RE.test(String(raw.id)) ? String(raw.id) : newId(),
    name: String(raw.name || '未命名').slice(0, 24),
    platform: String(raw.platform || '其他').slice(0, 12),
    cat: CATS.some(c => c.k === raw.cat) ? raw.cat : 'other',
    createdAt: DATE_RE.test(String(raw.createdAt)) ? raw.createdAt : hist[0].d,
    hist,
  };
}
