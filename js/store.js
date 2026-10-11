// 全局状态 S 与本机存储（localStorage）。数据只保存在当前浏览器，不上传。
// 任何写入成功后会通知订阅者（main.js 订阅后重绘界面）。
import { normAcc } from './model.js';
import { THEMES, STALE_OPTIONS, AVATAR_COLORS, AVATAR_EMOJIS, DEFAULT_RATES } from './config.js';

const PREFS_KEY = 'zck.prefs.v1';
const DATA_KEY = 'zck.data.v1';
const PROFILE_KEY = 'zck.profile.v1';

export const RANGES = { '30': '近1个月', '90': '近3个月', '180': '近6个月', '365': '近1年', all: '全部记录' };
export const RANGE_LABELS = { '30': '1月', '90': '3月', '180': '6月', '365': '1年', all: '全部' };
const TABS = ['home', 'acc', 'set'];

// 偏好的默认值。“恢复默认设置”会把这些重置回来（不包括当前标签页）。
const DEFAULTS = {
  range: '90',        // 趋势图时间范围
  allocBy: 'cat',     // 资产配置分组：cat | platform
  accGroup: 'platform', // 账户页分组：platform | cat
  hide: false,        // 隐藏金额
  conv: 'red',        // 涨跌配色：red = 红涨绿跌
  theme: 'system',    // 外观：system | light | dark
  staleDays: 14,      // 超过这么多天没更新的账户标记“待更新”
};

export const S = {
  tab: 'home',        // 当前标签页
  ...DEFAULTS,
  accounts: [],
  demo: false,        // 账户为空时展示示例数据
  openKeys: new Set(), // 配置页里已展开的行（不保存）
  sub: null,          // 设置标签页里打开的二级页面：profile | about（不保存）
  navDir: null,       // 刚发生的页面切换方向：push | pop，用来播放转场动画（不保存）
  ratesConfirmed: false, // 用户是否亲自填过汇率；没有的话，有外币账户时首页会提醒
  lastBackup: '',     // 上次导出 JSON 备份的日期（YYYY-MM-DD），用来提醒备份
  rates: { ...DEFAULT_RATES }, // 汇率：1 单位该币种 = 多少人民币。属于用户填的数据，“恢复默认设置”不会重置它
  profile: { name: '', color: 'blue', emoji: '' },
};

const jget = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

const listeners = new Set();
export const onChange = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => fn());

const PREF_KEYS = ['tab', 'rates', 'ratesConfirmed', 'lastBackup', ...Object.keys(DEFAULTS)];
const savePrefs = () => jset(PREFS_KEY, Object.fromEntries(PREF_KEYS.map(k => [k, S[k]])));

// 资料来自本机存储或导入的备份，都不可信，统一清洗
export function cleanProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    name: String(p.name || '').replace(/[\u0000-\u001f]/g, '').slice(0, 12),
    color: AVATAR_COLORS.some(c => c.k === p.color) ? p.color : 'blue',
    emoji: AVATAR_EMOJIS.includes(p.emoji) ? p.emoji : '',
  };
}

// 汇率来自本机存储或导入的备份，必须是正的有限数，否则用默认值
export function cleanRates(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const ok = x => Number.isFinite(x) && x > 0 && x < 1e6;
  return { GBP: ok(Number(r.GBP)) ? Number(r.GBP) : DEFAULT_RATES.GBP, USD: ok(Number(r.USD)) ? Number(r.USD) : DEFAULT_RATES.USD };
}

export function loadState() {
  const p = jget(PREFS_KEY) || {};
  if (TABS.includes(p.tab)) S.tab = p.tab;
  if (RANGES[p.range]) S.range = p.range;
  if (p.allocBy === 'cat' || p.allocBy === 'platform') S.allocBy = p.allocBy;
  S.accGroup = p.accGroup === 'cat' ? 'cat' : 'platform';
  S.hide = p.hide === true;
  S.conv = p.conv === 'green' ? 'green' : 'red';
  S.theme = THEMES.some(([k]) => k === p.theme) ? p.theme : DEFAULTS.theme;
  S.rates = cleanRates(p.rates);
  S.ratesConfirmed = p.ratesConfirmed === true;
  S.lastBackup = /^\d{4}-\d{2}-\d{2}$/.test(p.lastBackup) ? p.lastBackup : '';
  S.staleDays = STALE_OPTIONS.includes(p.staleDays) ? p.staleDays : DEFAULTS.staleDays;
  S.profile = cleanProfile(jget(PROFILE_KEY));
  const d = jget(DATA_KEY);
  S.accounts = (d && Array.isArray(d.accounts) ? d.accounts : []).map(normAcc).filter(Boolean);
}

export function setPref(patch) {
  Object.assign(S, patch);
  savePrefs();
  emit();
}

// 修改汇率。silent 为 true 时只保存不重绘（用户正在输入时重绘会让输入框丢焦点）
export function setRates(patch, { silent = false, confirmed = true } = {}) {
  S.rates = cleanRates({ ...S.rates, ...patch });
  S.ratesConfirmed = confirmed; // 恢复默认汇率时传 false：又回到了估计值
  savePrefs();
  if (!silent) emit();
}

// 恢复默认设置：外观、配色、提醒天数等回到默认值，不动账户数据、个人资料和汇率
export function resetPrefs() {
  Object.assign(S, DEFAULTS);
  savePrefs();
  emit();
}

// silent 为 true 时只保存，不触发重绘（用户正在输入昵称时，重绘会让输入框丢失焦点）
export function setProfile(patch, { silent = false } = {}) {
  S.profile = cleanProfile({ ...S.profile, ...patch });
  const ok = jset(PROFILE_KEY, S.profile);
  if (!silent) emit();
  return ok;
}

// 写入失败（存储已满或被禁用）时回滚并返回 false，调用方负责提示用户。
function commit(next) {
  const prev = S.accounts;
  S.accounts = next;
  if (!jset(DATA_KEY, { v: 1, accounts: next })) { S.accounts = prev; return false; }
  emit();
  return true;
}

// 同 id 的账户替换，新 id 的追加。一次调用只写一次存储。
export function upsertAccounts(list) {
  const byId = new Map(list.map(a => [a.id, a]));
  const next = S.accounts.map(a => {
    const n = byId.get(a.id);
    byId.delete(a.id);
    return n || a;
  });
  return commit([...next, ...byId.values()]);
}

export const removeAccounts = ids => commit(S.accounts.filter(a => !ids.includes(a.id)));
export const clearAccounts = () => commit([]);
