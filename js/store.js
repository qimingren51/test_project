// 全局状态 S 与本机存储（localStorage）。数据只保存在当前浏览器，不上传。
// 任何写入成功后会通知订阅者（main.js 订阅后重绘界面）。
import { normAcc } from './model.js';

const PREFS_KEY = 'zck.prefs.v1';
const DATA_KEY = 'zck.data.v1';

export const RANGES = { '30': '近1个月', '90': '近3个月', '180': '近6个月', '365': '近1年', all: '全部记录' };
export const RANGE_LABELS = { '30': '1月', '90': '3月', '180': '6月', '365': '1年', all: '全部' };
const TABS = ['home', 'acc', 'set'];

export const S = {
  tab: 'home',        // 当前标签页
  range: '90',        // 趋势图时间范围
  allocBy: 'cat',     // 资产配置分组：cat | platform
  hide: false,        // 隐藏金额
  conv: 'red',        // 涨跌配色：red = 红涨绿跌
  accounts: [],
  demo: false,        // 账户为空时展示示例数据
};

const jget = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

const listeners = new Set();
export const onChange = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => fn());

export function loadState() {
  const p = jget(PREFS_KEY) || {};
  if (TABS.includes(p.tab)) S.tab = p.tab;
  if (RANGES[p.range]) S.range = p.range;
  if (p.allocBy === 'cat' || p.allocBy === 'platform') S.allocBy = p.allocBy;
  S.hide = p.hide === true;
  S.conv = p.conv === 'green' ? 'green' : 'red';
  const d = jget(DATA_KEY);
  S.accounts = (d && Array.isArray(d.accounts) ? d.accounts : []).map(normAcc).filter(Boolean);
}

export function setPref(patch) {
  Object.assign(S, patch);
  jset(PREFS_KEY, { tab: S.tab, range: S.range, allocBy: S.allocBy, hide: S.hide, conv: S.conv });
  emit();
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
