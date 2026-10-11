// 金额、百分比、日期的展示格式。隐藏金额（S.hide）时所有金额一律显示成 ••••。
import { S } from './store.js';
import { diffDays, parseDate, todayStr } from './util.js';
import { TRI_UP, TRI_DOWN } from './icons.js';
import { CURRENCIES, BASE_CCY } from './config.js';

export const MASK = '••••';
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
export const weekday = d => WEEKDAYS[d.getDay()];

// 千分位；整数或 ≥1000 的金额不带小数，否则保留两位
export const fmtN = (n, dec) => {
  const a = Math.abs(n);
  const d = dec != null ? dec : (a >= 1000 || Math.abs(a - Math.round(a)) < .005 ? 0 : 2);
  return a.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
};
// 币种符号。不传币种就用人民币（总资产等汇总都以人民币计）
export const sym = ccy => CURRENCIES[ccy || BASE_CCY].sym;
export const mny = (n, dec, ccy) => (S.hide ? MASK : sym(ccy) + (n < 0 ? '−' : '') + fmtN(n, dec));
export const amt = n => (S.hide ? MASK : (n < 0 ? '−' : '') + fmtN(n));

// 带正负号的金额；cur 为 true 时加基础货币符号，cur 是币种代码（如 'GBP'）时加那个币种的符号，dec 为 0 时取整
export const sgnAmt = (n, cur, dec) => {
  const s = cur ? (cur === true ? sym() : sym(cur)) : '';
  if (S.hide) return MASK;
  const a = dec === 0 ? Math.round(Math.abs(n)) : Math.abs(n);
  if (a < .005) return s + '0';
  return (n > 0 ? '+' : '−') + s + fmtN(a, dec);
};
// 同上，并按涨跌着色
export const sgnHTML = (n, cur, dec) => {
  const zero = dec === 0 ? Math.round(Math.abs(n)) === 0 : Math.abs(n) < .005;
  return `<span class="${zero ? 'flat' : n > 0 ? 'up' : 'down'}">${sgnAmt(n, cur, dec)}</span>`;
};

export const pct = (x, sign) =>
  x == null || !Number.isFinite(x) ? '—' : (x < 0 ? '−' : (sign && x > 0 ? '+' : '')) + Math.abs(x * 100).toFixed(2) + '%';

// ▲/▼ 加变化量和百分比；箭头方向永远表示涨跌，与配色无关
export function chgHTML(n, p) {
  if (Math.abs(n) < .005) return '<span class="flat">— 0</span>';
  const up = n > 0, r = Math.round(Math.abs(n));
  const body = S.hide ? MASK : (r === 0 ? '&lt;1' : fmtN(r, 0));
  const ratio = p != null && Number.isFinite(p) ? ` (${Math.abs(p * 100).toFixed(2)}%)` : '';
  return `<span class="${up ? 'up' : 'down'}">${up ? TRI_UP : TRI_DOWN}${body}${ratio}</span>`;
}

const fmtMD = d => `${+d.slice(5, 7)}月${+d.slice(8, 10)}日`;

// 选中某一天时图上方显示的日期，如「2026年9月27日 周日」
export const fmtFullDate = d => `${+d.slice(0, 4)}年${+d.slice(5, 7)}月${+d.slice(8, 10)}日 周${weekday(parseDate(d))}`;

// 区间两端跨年、或不在今年时带上年份，避免出现「10月11日 到 10月11日」这种看不出是哪一年的写法
export const fmtRange = (a, b) => {
  const withYear = a.slice(0, 4) !== b.slice(0, 4) || +a.slice(0, 4) !== new Date().getFullYear();
  const f = d => (withYear ? `${+d.slice(0, 4)}年` : '') + fmtMD(d);
  return `${f(a)} 到 ${f(b)}`;
};

export function agoText(d) {
  const n = diffDays(d, todayStr());
  if (n <= 0) return '今天';
  if (n === 1) return '昨天';
  if (n < 30) return n + '天前';
  if (n < 365) return Math.floor(n / 30) + '个月前';
  return Math.floor(n / 365) + '年前';
}

// 解析用户输入的金额：允许千分位逗号、空格和各种货币符号；无法解析或非有限数时返回 NaN
export const num = s => {
  const t = String(s).replace(/HK\$|[,，\s¥￥$€£]/g, '');
  const n = t === '' ? NaN : Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export const colOf = ci => (ci >= 1 && ci <= 6 ? `var(--cat${ci})` : 'var(--cat0)');
