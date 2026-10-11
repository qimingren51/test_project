// 示例数据：账户为空时用来展示界面。固定随机种子，同一天打开结果一致。
import { addDays, r2 } from './util.js';

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function gauss(r) {
  let u = 0, v = 0;
  while (!u) u = r();
  while (!v) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// 每个账户：初始市值 v0、本金/市值比 cr、周均收益 mu、周波动 sd、记录周数 weeks，
// 以及每 every 周追加 amt 元（every 为 0 表示不追加）。
const DEFS = [
  { name: '余额宝', platform: '支付宝', cat: 'cash', v0: 36800, cr: 1, mu: .0003, sd: .00004, weeks: 30, stopK: 0, every: 6, amt: 1500 },
  { name: '稳健债基', platform: '支付宝', cat: 'bond', v0: 118000, cr: .985, mu: .0006, sd: .0012, weeks: 30, stopK: 0, every: 4, amt: 3000 },
  { name: '个人养老金', platform: '支付宝', cat: 'pension', v0: 8000, cr: 1, mu: .0008, sd: .006, weeks: 18, stopK: 0, every: 4, amt: 1000 },
  { name: '零钱通', platform: '微信', cat: 'cash', v0: 12500, cr: 1, mu: .0003, sd: .00003, weeks: 30, stopK: 0, every: 8, amt: 500 },
  { name: '定期存款', platform: '银行', cat: 'cash', v0: 90000, cr: 1, mu: .0005, sd: .00001, weeks: 30, stopK: 0, every: 0, amt: 0 },
  { name: '积存金', platform: '银行', cat: 'gold', v0: 28000, cr: .94, mu: .002, sd: .02, weeks: 30, stopK: 3, every: 6, amt: 1000 },
  { name: '沪深300 ETF', platform: '券商', cat: 'stock', v0: 64000, cr: .93, mu: .0015, sd: .022, weeks: 30, stopK: 0, every: 4, amt: 2000 },
  { name: '个股组合', platform: '券商', cat: 'stock', v0: 41000, cr: 1.04, mu: .001, sd: .035, weeks: 30, stopK: 0, every: 0, amt: 0 },
  { name: '美股指数基金', platform: '券商', cat: 'global', v0: 33000, cr: .9, mu: .0025, sd: .024, weeks: 30, stopK: 0, every: 4, amt: 1000 },
];

export function sampleAccounts(today) {
  const r = rng(20261011);
  return DEFS.map((d, i) => {
    let v = d.v0, c = Math.round(d.v0 * d.cr);
    const hist = [];
    for (let k = d.weeks, s = 0; k >= d.stopK; k--, s++) {
      if (s > 0) {
        v = v * (1 + d.mu + d.sd * gauss(r));
        if (d.every && s % d.every === 0) { v += d.amt; c += d.amt; }
      }
      hist.push({ d: addDays(today, -(7 * k)), v: r2(v), c });
    }
    return { id: 'demo' + i, name: d.name, platform: d.platform, cat: d.cat, createdAt: hist[0].d, hist };
  });
}
