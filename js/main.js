// 入口：渲染、标签页与二级页面导航、事件委托。
import { S, loadState, setPref, setProfile, setRates, resetPrefs, onChange, clearAccounts } from './store.js';
import { buildModel, convertAccounts } from './model.js';
import { sampleAccounts } from './sample.js';
import { todayStr, diffDays } from './util.js';
import { $, toast, arm } from './dom.js';
import { weekday, num } from './format.js';
import { DEFAULT_RATES, BASE_CCY } from './config.js';
import { ICONS, TAB_ICONS, CHEV_LEFT } from './icons.js';
import { homeHTML, accHTML, bannerHTML, scrubHTML } from './views.js';
import { settingsHTML, subHTML, SUB_TITLES, avatarInner } from './pages.js';
import { drawTrend } from './chart.js';
import { openSheet, closeSheet, requestDismiss, markDirty, isSheetOpen, submitForm, updatePreview, onFormChange, deleteAccount, deleteRecord, toggleBatchFlow } from './sheets.js';
import { snapshotSegs, animateSegs, snapshotSwitches, animateSwitches } from './ui.js';
import { exportData, importFile } from './data-io.js';

const TITLES = { home: '总览', acc: '账户', set: '设置' };
const THEME_COLORS = { light: '#F2F2F7', dark: '#000000' }; // 手动选了外观时，浏览器顶部状态栏的颜色
const DEMO = sampleAccounts(todayStr());
let model = null;

// 外观：自动（跟随系统）就不写 data-theme，让 CSS 的 prefers-color-scheme 决定
function applyTheme() {
  const root = document.documentElement;
  if (S.theme === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = S.theme;
  document.querySelectorAll('meta[name=theme-color]').forEach(m => {
    if (!m.dataset.orig) m.dataset.orig = m.content;
    m.content = S.theme === 'system' ? m.dataset.orig : THEME_COLORS[S.theme];
  });
}

// 顶部提示条，同一时间只显示一条：示例数据 > 汇率还是估计值 > 该备份了
function bannerKind(sub) {
  if (sub) return null;
  if (S.demo) return 'demo';
  if (S.tab === 'set') return null;
  if (!S.ratesConfirmed && S.accounts.some(a => a.ccy !== BASE_CCY)) return 'rates';
  // 用了两周以上，且从没备份过或上次备份超过 30 天
  const today = todayStr();
  const first = S.accounts.reduce((m, a) => (a.hist[0].d < m ? a.hist[0].d : m), today);
  if (diffDays(first, today) >= 14 && (!S.lastBackup || diffDays(S.lastBackup, today) >= 30)) return 'backup';
  return null;
}

function render() {
  const before = { segs: snapshotSegs(), switches: snapshotSwitches() };
  S.demo = S.accounts.length === 0;
  const now = new Date();
  const sub = S.tab === 'set' ? S.sub : null; // 设置标签页里打开的二级页面

  applyTheme();
  // 涨跌配色
  if (S.conv === 'green') document.documentElement.dataset.conv = 'gup';
  else document.documentElement.removeAttribute('data-conv');

  // 顶栏：二级页面左边是返回按钮，大标题换成页面名，日期那一行不要
  $('#today').textContent = `${now.getMonth() + 1}月${now.getDate()}日 周${weekday(now)}`;
  $('#today').hidden = !!sub;
  $('#lt').textContent = $('#nt').textContent = sub ? SUB_TITLES[sub] : TITLES[S.tab];
  $('#navl').innerHTML = sub ? `<button class="back" data-act="back" aria-label="返回设置">${CHEV_LEFT}<span>设置</span></button>` : '';
  $('#navr').innerHTML = sub ? '' :
    (S.tab === 'acc' ? `<button class="glass" data-act="add" aria-label="新增账户">${ICONS.plus}</button>` : '') +
    `<button class="glass" data-act="hide" aria-label="${S.hide ? '显示金额' : '隐藏金额'}" aria-pressed="${S.hide}">${S.hide ? ICONS.eyeoff : ICONS.eye}</button>`;
  document.querySelectorAll('.tab').forEach(b => {
    if (b.dataset.v === S.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const banner = bannerKind(sub);
  $('#banner').innerHTML = banner ? bannerHTML(banner) : '';

  // 只渲染当前标签页，其余清空
  // 汇总都折算成基础货币；账户行里显示的是各账户自己币种的原始金额（折算后的账户用 src 指回去）
  model = S.tab === 'set' ? null : buildModel(convertAccounts(S.demo ? DEMO : S.accounts, BASE_CCY, S.rates), S.range);
  const views = { home: () => homeHTML(model), acc: () => accHTML(model), set: () => (sub ? subHTML(sub) : settingsHTML()) };
  for (const key of Object.keys(views)) {
    const panel = $('#v-' + key);
    panel.hidden = key !== S.tab;
    panel.innerHTML = key === S.tab ? views[key]() : '';
  }
  // 进入 / 返回二级页面时播放滑入动画
  const panel = $('#v-' + S.tab);
  panel.classList.remove('push', 'pop');
  if (S.navDir) { void panel.offsetWidth; panel.classList.add(S.navDir); S.navDir = null; }

  if (S.tab === 'home') drawChart();
  animateSegs(before.segs);           // 分段控件的滑块从旧位置滑到新位置
  animateSwitches(before.switches);   // 开关从旧状态拨到新状态
}

// 趋势图 + 选中某一天时把图上方的区间摘要换成该日读数
function drawChart() {
  const sum = $('.chg-sum'), scrub = $('.chg-scrub');
  drawTrend($('#trend'), model.rp, p => {
    sum.hidden = !!p;
    scrub.hidden = !p;
    if (p) scrub.innerHTML = scrubHTML(p);
  });
}

/* ---------- 导航 ---------- */

// 和 iOS 一样：每个标签页记住自己的滚动位置；再点一次当前标签页，回到顶部（在二级页面里则回到设置主页）。
const scrollPos = { home: 0, acc: 0, set: 0 };

function setTab(tab) {
  if (tab === S.tab) {
    if (S.sub) closeSub();
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (!S.sub) scrollPos[S.tab] = window.scrollY; // 二级页面里的滚动位置不记
  if (S.sub) history.replaceState({ sub: null }, '');
  S.sub = null;
  setPref({ tab });
  window.scrollTo(0, scrollPos[tab]);
}

// 二级页面用浏览器历史记录：手机上的返回手势、安卓返回键、浏览器后退按钮都能用
function openSub(name) {
  scrollPos.set = window.scrollY;
  S.sub = name;
  S.navDir = 'push';
  history.pushState({ sub: name }, '');
  render();
  window.scrollTo(0, 0);
}
function closeSub() {
  if (history.state && history.state.sub) history.back(); // 交给 popstate 处理
  else leaveSub();
}
function leaveSub() {
  S.sub = null;
  S.navDir = 'pop';
  render();
  window.scrollTo(0, scrollPos.set || 0);
}
window.addEventListener('popstate', e => {
  const sub = (e.state && e.state.sub) || null;
  if (sub === S.sub) return;
  if (sub) { S.tab = 'set'; S.sub = sub; S.navDir = 'push'; render(); window.scrollTo(0, 0); }
  else leaveSub();
});

/* ---------- 个人资料：输入昵称时直接改写头像，不重绘（重绘会让输入框丢焦点） ---------- */

function refreshProfileLive() {
  document.querySelectorAll('.avatar[data-live]').forEach(el => {
    el.innerHTML = avatarInner(el.dataset.live === 'initial' ? { ...S.profile, emoji: '' } : S.profile);
  });
  const name = $('#pf-name-text');
  if (name) name.textContent = S.profile.name || '未设置昵称';
}

/* ---------- 事件 ---------- */

function onAction(t) {
  const { act, v, id } = t.dataset;
  switch (act) {
    case 'tab': setTab(v); break;
    case 'range': setPref({ range: v }); break;
    case 'alloc': setPref({ allocBy: v }); break;
    case 'accgroup': setPref({ accGroup: v }); break;
    case 'hide': setPref({ hide: !S.hide }); break;
    case 'conv': setPref({ conv: v }); break;
    case 'theme': setPref({ theme: v }); break;
    case 'open': openSub(v); break;
    case 'back': closeSub(); break;
    case 'swatch': setProfile({ color: v }); break;
    case 'emoji': setProfile({ emoji: v }); break;
    case 'add': openSheet('add'); break;
    case 'edit':
    case 'batch':
      if (S.demo) { toast('这是示例数据，先添加你自己的账户'); openSheet('add'); }
      else openSheet(act, id);
      break;
    case 'close': closeSheet(); break;        // “取消”按钮：直接关闭
    case 'dismiss': requestDismiss(); break;  // 点遮罩：有未保存输入时只回弹
    case 'exp': exportData(v); break;
    case 'resetrates': setRates(DEFAULT_RATES, { confirmed: false }); toast('已恢复默认汇率'); break;
    case 'gorates': setTab('set'); openSub('rates'); break;
    case 'flowtoggle': toggleBatchFlow(t); break;
    case 'delrec': arm(t, '确认删除', () => deleteRecord(id, t.dataset.d)); break;
    case 'reset': arm(t, '再点一次，确认恢复', () => { resetPrefs(); toast('已恢复默认设置'); }); break;
    case 'clear':
      arm(t, '再点一次，确认清空', () => toast(clearAccounts() ? '已清空' : '清空失败，请稍后再试'));
      break;
    case 'del': arm(t, '再点一次，确认删除', () => deleteAccount(id)); break;
  }
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (t) onAction(t);
});
document.addEventListener('submit', e => {
  if (e.target.id === 'f') { e.preventDefault(); submitForm(e.target); }
});
document.addEventListener('input', e => {
  if (e.target.dataset && e.target.dataset.rate) {
    // 汇率：填了有效的正数才保存；无效时输入框变红，保持原来的值
    const v = num(e.target.value);
    const ok = v > 0 && v < 1e6;
    e.target.closest('.frow').classList.toggle('bad', !ok);
    if (ok) setRates({ [e.target.dataset.rate]: v }, { silent: true });
  } else if (e.target.id === 'pf-name') { setProfile({ name: e.target.value }, { silent: true }); refreshProfileLive(); }
  else if (e.target.closest('#f')) { markDirty(); updatePreview(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'imp' && t.files && t.files[0]) { importFile(t.files[0]); t.value = ''; }
  else if (t.dataset && t.dataset.rate) { t.value = S.rates[t.dataset.rate]; t.closest('.frow').classList.remove('bad'); } // 填完离开：无效的内容恢复成已保存的汇率
  else if (t.dataset && t.dataset.pref) {
    // 设置页里的下拉和开关
    const k = t.dataset.pref;
    if (t.type === 'checkbox') {
      const on = t.checked;
      t.checked = !on; // 先拨回原状态，重绘后新开关再从原状态拨过去，这样才有动画
      setPref({ [k]: on });
    } else setPref({ [k]: k === 'staleDays' ? Number(t.value) : t.value });
  } else if (t.name === 'flowk') {
    $('#flow-wrap').hidden = t.value === 'none';
    const seg = t.closest('.seg'); // 滑块滑到被选中的那一项
    seg.style.setProperty('--i', [...seg.querySelectorAll('input')].indexOf(t));
    markDirty();
    updatePreview();
  } else if (t.closest('#f')) { onFormChange(t); markDirty(); updatePreview(); }
});
// 配置页里展开的行，重绘后要保持展开（toggle 事件不冒泡，所以用捕获）
document.addEventListener('toggle', e => {
  const d = e.target;
  if (d.matches && d.matches('details.tree')) {
    if (d.open) S.openKeys.add(d.dataset.key);
    else S.openKeys.delete(d.dataset.key);
  }
}, true);
// 金额输入框获得焦点时全选，改数字不用先删掉旧的（iOS 需要等一下才能选中）
document.addEventListener('focusin', e => {
  const t = e.target;
  if (t.matches && t.matches('input[inputmode=decimal]') && t.value) setTimeout(() => t.select(), 0);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && isSheetOpen()) requestDismiss();
  else if (e.key === 'Enter' && e.target.id === 'pf-name') e.target.blur();
});

// 滚动后顶栏变成毛玻璃并显示小标题
const onScroll = () => $('#nav').classList.toggle('scrolled', (window.scrollY || document.documentElement.scrollTop || 0) > 40);
window.addEventListener('scroll', onScroll, { passive: true });

document.querySelectorAll('.tab').forEach(b => b.insertAdjacentHTML('afterbegin', TAB_ICONS[b.dataset.v].o + TAB_ICONS[b.dataset.v].f));

history.replaceState({ sub: null }, '');
onChange(render);
loadState();
render();
onScroll();

// 容器宽度变化（旋转屏幕等）时按新宽度重画趋势图
let lastW = $('#app').clientWidth;
if (window.ResizeObserver) {
  new ResizeObserver(() => {
    const w = $('#app').clientWidth;
    if (w !== lastW) { lastW = w; if (S.tab === 'home') drawChart(); }
  }).observe($('#app'));
}
