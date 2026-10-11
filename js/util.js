// 日期与数值的基础工具。日期统一用 "YYYY-MM-DD" 字符串，按本地时区解析。
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const pad = n => String(n).padStart(2, '0');
export const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parseDate = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const todayStr = () => ymd(new Date());

export const addDays = (s, n) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
// 两个日期相差的天数；round 用来消除夏令时造成的小时偏差
export const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);

// 金额统一保留两位小数
export const r2 = x => Math.round(x * 100) / 100;
