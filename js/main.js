// 入口：渲染、标签页切换、事件委托。
import { S, loadState, setPref, onChange, clearAccounts } from './store.js';
import { buildModel } from './model.js';
import { sampleAccounts } from './sample.js';
import { todayStr } from './util.js';
import { $, toast, arm } from './dom.js';
import { weekday } from './format.js';
import { ICONS, TAB_ICONS } from './icons.js';
import { homeHTML, accHTML, setHTML, bannerHTML, scrubHTML } from './views.js';
import { drawTrend } from './chart.js';
import { openSheet, closeSheet, requestDismiss, markDirty, isSheetOpen, submitForm, updatePreview, deleteAccount } from './sheets.js';
import { snapshotSegs, animateSegs } from './ui.js';
import { exportData, importFile } from './data-io.js';

const TITLES = { home: '总览', acc: '账户', set: '设置' };
const DEMO = sampleAccounts(todayStr());
let model = null;

function render() {
  const segsBefore = snapshotSegs();
  S.demo = S.accounts.length === 0;
  const now = new Date();

  // 涨跌配色
  if (S.conv === 'green') document.documentElement.dataset.conv = 'gup';
  else document.documentElement.removeAttribute('data-conv');

  // 顶栏
  $('#today').textContent = `${now.getMonth() + 1}月${now.getDate()}日 周${weekday(now)}`;
  $('#lt').textContent = $('#nt').textContent = TITLES[S.tab];
  $('#navr').innerHTML =
    (S.tab === 'acc' ? `<button class="glass" data-act="add" aria-label="新增账户">${ICONS.plus}</button>` : '') +
    `<button class="glass" data-act="hide" aria-label="${S.hide ? '显示金额' : '隐藏金额'}" aria-pressed="${S.hide}">${S.hide ? ICONS.eyeoff : ICONS.eye}</button>`;
  document.querySelectorAll('.tab').forEach(b => {
    if (b.dataset.v === S.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('#banner').innerHTML = S.demo ? bannerHTML() : '';

  // 只渲染当前标签页，其余清空
  model = S.tab === 'set' ? null : buildModel(S.demo ? DEMO : S.accounts, S.range);
  const views = { home: () => homeHTML(model), acc: () => accHTML(model), set: setHTML };
  for (const key of Object.keys(views)) {
    const panel = $('#v-' + key);
    panel.hidden = key !== S.tab;
    panel.innerHTML = key === S.tab ? views[key]() : '';
  }
  if (S.tab === 'home') drawChart();
  animateSegs(segsBefore); // 分段控件的滑块从旧位置滑到新位置
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

// 和 iOS 一样：每个标签页记住自己的滚动位置；再点一次当前标签页，回到顶部。
const scrollPos = { home: 0, acc: 0, set: 0 };
function setTab(tab) {
  if (tab === S.tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  scrollPos[S.tab] = window.scrollY;
  setPref({ tab });
  window.scrollTo(0, scrollPos[tab]);
}

function onAction(t) {
  const { act, v, id } = t.dataset;
  switch (act) {
    case 'tab': setTab(v); break;
    case 'range': setPref({ range: v }); break;
    case 'alloc': setPref({ allocBy: v }); break;
    case 'hide': setPref({ hide: !S.hide }); break;
    case 'conv': setPref({ conv: v }); break;
    case 'add': openSheet('add'); break;
    case 'edit':
    case 'batch':
      if (S.demo) { toast('这是示例数据，先添加你自己的账户'); openSheet('add'); }
      else openSheet(act, id);
      break;
    case 'close': closeSheet(); break;        // “取消”按钮：直接关闭
    case 'dismiss': requestDismiss(); break;  // 点遮罩：有未保存输入时只回弹
    case 'exp': exportData(v); break;
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
  if (e.target.closest('#f')) { markDirty(); updatePreview(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'imp' && t.files && t.files[0]) { importFile(t.files[0]); t.value = ''; }
  else if (t.name === 'flowk') {
    $('#flow-wrap').hidden = t.value === 'none';
    const seg = t.closest('.seg'); // 滑块滑到被选中的那一项
    seg.style.setProperty('--i', [...seg.querySelectorAll('input')].indexOf(t));
    markDirty();
    updatePreview();
  } else if (t.closest('#f')) { markDirty(); updatePreview(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && isSheetOpen()) requestDismiss();
});

// 滚动后顶栏变成毛玻璃并显示小标题
const onScroll = () => $('#nav').classList.toggle('scrolled', (window.scrollY || document.documentElement.scrollTop || 0) > 40);
window.addEventListener('scroll', onScroll, { passive: true });

document.querySelectorAll('.tab').forEach(b => b.insertAdjacentHTML('afterbegin', TAB_ICONS[b.dataset.v].o + TAB_ICONS[b.dataset.v].f));

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
