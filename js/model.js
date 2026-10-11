// 纯数据逻辑：账户结构、汇总序列、月度变化、资产配置。不碰 DOM 和存储。
//
// 账户结构：
//   { id, name, platform, cat, sub, ccy, createdAt, hist: [{ d, v, c }] }
//   ccy 是币种（CNY / GBP / USD），hist 里的金额都是这个币种的原始金额；汇总时才折算（见 convertAccounts）。
//   cat 是资产类型（见 CATS），sub 是类型下的子类（自由文字，可为空）；platform 是银行、券商等具体平台。
//   hist 按日期升序，每个日期一条；v 是当天市值，c 是截至当天的累计投入本金。
import { DATE_RE, pad, addDays, r2, todayStr } from './util.js';
import { platformGroupOf, PLATFORM_GROUP_ORDER, NO_SUB, CURRENCIES, LEGACY_CATS, BASE_CCY } from './config.js';

export const CATS = [
  { k: 'cash', n: '现金·存款' }, { k: 'stock', n: '股票' }, { k: 'fund', n: '基金' },
  { k: 'wealth', n: '理财产品' }, { k: 'gold', n: '黄金·商品' }, { k: 'pension', n: '养老·保险' },
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

// 汇率：rates[币种] = 1 单位该币种值多少人民币，人民币是 1
const toCny = (ccy, rates) => (ccy === 'CNY' ? 1 : rates[ccy] || 1);

// 把所有账户的金额折算成基础货币 base，用来做汇总。折算后的账户用 src 指回原来的账户（显示原币种金额时用）。
// 历史记录统一按当前汇率折算，不单独记录汇率的变动。
export function convertAccounts(accs, base, rates) {
  return accs.map(a => {
    const k = toCny(a.ccy, rates) / toCny(base, rates);
    if (k === 1) return { ...a, src: a };
    return { ...a, src: a, hist: a.hist.map(h => ({ d: h.d, v: r2(h.v * k), c: r2(h.c * k) })) };
  });
}

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

// 按机构大类（支付方式 / 银行 / 券商…）→ 具体机构分组，账户页“按平台”用。
// 返回 [{ name, ci, sum, platforms: [{ p, arr, sum }] }]，大类和机构都按市值降序
export function groupByPlatformGroup(accs) {
  const groups = new Map();
  for (const g of groupByPlatform(accs)) {
    const name = platformGroupOf(g.p);
    if (!groups.has(name)) groups.set(name, { name, ci: Math.min(PLATFORM_GROUP_ORDER.indexOf(name) + 1, 6), sum: 0, platforms: [] });
    const e = groups.get(name);
    e.sum += g.sum;
    e.platforms.push(g);
  }
  return [...groups.values()].sort((x, y) => y.sum - x.sum);
}

// 按资产类型分组（账户页“按类型”用），组间、组内都按市值降序
export function groupByCat(accs) {
  const m = new Map();
  for (const a of accs) {
    const i = catIdx(a.cat);
    if (!m.has(i)) m.set(i, []);
    m.get(i).push(a);
  }
  return [...m.entries()]
    .map(([i, arr]) => ({
      k: CATS[i].k, label: CATS[i].n, ci: i < 6 ? i + 1 : 0,
      arr: arr.slice().sort((x, y) => last(y).v - last(x).v),
      sum: arr.reduce((s, a) => s + last(a).v, 0),
    }))
    .sort((x, y) => y.sum - x.sum);
}

// 资产配置占比，两级：by = 'cat'（类型 → 子类）、'platform'（机构大类 → 具体机构）或 'ccy'（币种 → 具体机构）。
// 金额都是折算成人民币后的；币种这一项另带 ccy 和该币种的原始金额 native。
// 每一项：{ key, label, ci(颜色序号), v, pct, kids: [{ label, v, pct, foreign }] }
// foreign 是该子项里外币账户的原币种金额：[{ ccy, native }]，比如“美股”里有 $2,000
const CCY_ORDER = Object.keys(CURRENCIES); // 配置图里每种币种固定一个颜色

export function allocation(accs, by) {
  const top = new Map();
  let total = 0;
  for (const a of accs) {
    const l = last(a);
    if (!l || l.v <= 0) continue;
    let key, label, ci, kid, ccy;
    if (by === 'ccy') {
      ccy = a.ccy;
      key = 'c:' + ccy; label = CURRENCIES[ccy].name; ci = CCY_ORDER.indexOf(ccy) + 1; kid = a.platform;
    } else if (by === 'cat') {
      const i = catIdx(a.cat);
      key = CATS[i].k; label = CATS[i].n; ci = i < 6 ? i + 1 : 0; kid = a.sub || NO_SUB;
    } else {
      const g = platformGroupOf(a.platform);
      key = 'g:' + g; label = g; ci = Math.min(PLATFORM_GROUP_ORDER.indexOf(g) + 1, 6); kid = a.platform;
    }
    const e = top.get(key) || { key, label, ci, ccy, v: 0, native: 0, kids: new Map() };
    e.v = r2(e.v + l.v);
    e.native = r2(e.native + last(a.src || a).v);
    const k = e.kids.get(kid) || { v: 0, foreign: new Map() };
    k.v = r2(k.v + l.v);
    const src = a.src || a;
    if (src.ccy !== BASE_CCY) k.foreign.set(src.ccy, r2((k.foreign.get(src.ccy) || 0) + last(src).v));
    e.kids.set(kid, k);
    top.set(key, e);
    total += l.v;
  }
  const pct = v => (total ? v / total : 0);
  return [...top.values()]
    .sort((x, y) => y.v - x.v)
    .map(e => ({
      key: e.key, label: e.label, ci: e.ci, ccy: e.ccy, native: e.native, v: e.v, pct: pct(e.v),
      kids: [...e.kids].sort((x, y) => y[1].v - x[1].v).map(([label, k]) => ({ label, v: k.v, pct: pct(k.v), foreign: [...k.foreign].map(([ccy, native]) => ({ ccy, native })) })),
    }));
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
  const legacy = LEGACY_CATS[raw.cat] || {}; // 旧版本的类型（债券·固收、海外资产）换成新的
  const cat = legacy.cat || raw.cat;
  return {
    id: ID_RE.test(String(raw.id)) ? String(raw.id) : newId(),
    name: String(raw.name || '未命名').slice(0, 24),
    platform: String(raw.platform || '其他').slice(0, 12),
    cat: CATS.some(c => c.k === cat) ? cat : 'other',
    sub: String(raw.sub || legacy.sub || '').replace(/[\u0000-\u001f]/g, '').slice(0, 12),
    ccy: raw.ccy in CURRENCIES ? raw.ccy : 'CNY',
    createdAt: DATE_RE.test(String(raw.createdAt)) ? raw.createdAt : hist[0].d,
    hist,
  };
}
