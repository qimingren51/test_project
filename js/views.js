// 总览和账户两个标签页的 HTML 生成（设置标签页在 pages.js）。纯函数，输入状态和派生数据，输出字符串。
// 界面里没有表格：所有“多列数据”都做成 iOS 风格的两行列表行（左边标题和说明，右边数值和变化）。
import { S, RANGES, RANGE_LABELS } from './store.js';
import { CATS, catIdx, last, prevOf, rangeChange, monthly, allocation, groupByPlatformGroup, groupByCat } from './model.js';
import { NO_SUB, BASE_CCY, CURRENCIES } from './config.js';
import { diffDays, r2, todayStr } from './util.js';
import { esc } from './dom.js';
import { MASK, sym, mny, amt, sgnAmt, sgnHTML, pct, chgHTML, fmtRange, fmtFullDate, agoText, colOf } from './format.js';
import { ICONS, CAT_GLYPHS, ROW_GLYPHS, CHEV } from './icons.js';
import { seg } from './ui.js';

const catOf = a => CATS[catIdx(a.cat)];
const catColor = a => { const i = catIdx(a.cat); return i < 6 ? i + 1 : 0; };
const isStale = a => diffDays(last(a).d, todayStr()) >= S.staleDays; // 超过设定天数没更新就提示“待更新”
const staleCount = L => L.filter(isStale).length;

export const iconTile = (color, glyph) => `<span class="tile" style="--c:${color}"><svg viewBox="0 0 24 24">${glyph}</svg></span>`;
const catTile = (k, ci) => iconTile(colOf(ci), CAT_GLYPHS[k] || CAT_GLYPHS.other);
const platTile = (label, ci) => `<span class="tile tx" style="--c:${colOf(ci)}">${esc(Array.from(label)[0] || '·')}</span>`;

function batchRow(lastP, stale) {
  return `<button class="row tl" data-act="batch">${iconTile('var(--tint)', ROW_GLYPHS.batch)}<span class="body"><span class="t">一键盘点</span><span class="s">上次盘点 ${agoText(lastP.d)}${stale ? ` · ${stale} 个账户待更新` : ''}</span></span>${CHEV}</button>`;
}

export const bannerHTML = () =>
  `<div class="banner">${ICONS.info}<span>示例数据，不是你的资产</span><button class="txt" data-act="add">开始记录</button></div>`;

/* ---------- 总览 ---------- */

function heroHTML(M) {
  const { lastP, prevP } = M;
  const profit = r2(lastP.v - lastP.c);
  const ret = lastP.c > 0 ? profit / lastP.c : null;
  const dv = prevP ? r2(lastP.v - prevP.v) : null;
  const dp = prevP && prevP.v > 0 ? dv / prevP.v : null;
  let total;
  if (S.hide) total = `<span class="cur">${sym()}</span>${MASK}`;
  else {
    const s = lastP.v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const i = s.lastIndexOf('.');
    total = `<span class="cur">${sym()}</span>${s.slice(0, i)}<span class="dec">${s.slice(i)}</span>`;
  }
  const retCls = ret == null ? 'flat' : ret > 0 ? 'up' : ret < 0 ? 'down' : 'flat';
  return `<div class="hero-wrap"><section class="hero"><div class="k">总资产</div><div class="total">${total}</div>
<div class="delta">${dv == null ? '<span class="lab">再记录一次，就能看到变化</span>' : `${chgHTML(dv, dp)}<span class="lab">较上次记录</span>`}</div></section>
<div class="group stats">
<div><div class="k">本金</div><div class="v">${mny(lastP.c)}</div></div>
<div><div class="k">累计收益</div><div class="v">${sgnHTML(profit, true)}</div></div>
<div><div class="k">收益率</div><div class="v ${retCls}">${pct(ret, true)}</div></div>
</div></div>`;
}

// 一条“日期 + 市值 + 本金/收益”的明细行
const detailRow = p => `<div class="row"><div class="body"><span class="t num">${p.d.replace(/-/g, '/')}</span></div><div class="r"><b>${mny(p.v)}</b><span class="c mut">本金 ${amt(p.c)} · 收益 ${sgnHTML(r2(p.v - p.c), false, 0)}</span></div></div>`;

function trendHTML(M) {
  const { rp } = M;
  const ch = rangeChange(rp);
  const ranges = seg('range', Object.entries(RANGE_LABELS), S.range, { act: 'range', cls: 'flat ranges', label: '时间范围' });
  const chgBlock = ch
    ? `<div class="lead">${RANGES[S.range]} · ${fmtRange(ch.from, ch.to)}</div>
<div class="main">${sgnAmt(ch.dv, true)}</div>
<div class="parts"><span>追加投入<b>${sgnAmt(ch.dc, true)}</b></span><span>投资收益<b>${sgnHTML(ch.dp, true)}</b></span></div>`
    : `<div class="lead">${RANGES[S.range]}</div><div class="s" style="margin-top:4px">记录满两次后，这里显示总资产的变化，并拆成追加投入和投资收益。</div>`;
  const rows = rp.slice().reverse().slice(0, 80).map(detailRow).join('');
  return `<section class="sec"><div class="sec-h big"><span>资产变化</span></div><div class="group chartcard"><div class="pad cc">
<div class="chg"><div class="chg-sum">${chgBlock}</div><div class="chg-scrub" hidden></div></div>
<div class="chart" id="trend"></div>
${ranges}
<div class="legend"><span><i class="ln" style="background:var(--tint)"></i>总资产</span><span><i class="ln" style="background:var(--cost)"></i>本金</span><span><i class="bd"></i>两线之间是累计收益</span></div>
</div>
<details class="disc"><summary class="row"><span class="t tint">查看数据明细</span>${CHEV}</summary><div class="tscroll">${rows}</div></details>
</div></section>`;
}

// 在趋势图上选中某一天时，图上方显示的读数（替换区间摘要）
export function scrubHTML(p) {
  return `<div class="lead">${fmtFullDate(p.d)}</div>
<div class="main">${mny(p.v)}</div>
<div class="parts"><span>本金<b>${mny(p.c)}</b></span><span>累计收益<b>${sgnHTML(r2(p.v - p.c), true)}</b></span></div>`;
}

// 配置页的一项。有子项（子类 / 具体机构）可看时是可展开的一行，否则是普通的一行。
function allocItem(x, by, tile) {
  const expandable = x.kids.length > 1 || (x.kids.length === 1 && x.kids[0].label !== NO_SUB && x.kids[0].label !== x.label);
  // 说明行：外币显示原币种金额；否则写有几个子类 / 机构
  const note = by === 'ccy' && x.ccy !== BASE_CCY ? mny(x.native, undefined, x.ccy) : expandable ? `${x.kids.length} 个${by === 'cat' ? '子类' : '机构'}` : '';
  const head = `${tile}<div class="body"><span class="t">${esc(x.label)}</span>${note ? `<span class="s">${note}</span>` : ''}</div><div class="r"><b>${mny(x.v)}</b><span class="c mut">${(x.pct * 100).toFixed(1)}%</span></div>`;
  if (!expandable) return `<div class="row tl">${head}</div>`;
  const kids = x.kids.map(k => `<div class="row kid"><div class="body"><span class="t">${esc(k.label)}</span>${k.foreign.length ? `<span class="s">${k.foreign.map(f => mny(f.native, undefined, f.ccy)).join(' · ')}</span>` : ''}</div><div class="r"><b>${mny(k.v)}</b><span class="c mut">${(k.pct * 100).toFixed(1)}%</span></div></div>`).join('');
  const key = by + ':' + x.key;
  return `<details class="tree" data-key="${esc(key)}"${S.openKeys.has(key) ? ' open' : ''}><summary class="row tl">${head}${CHEV}</summary><div class="kids">${kids}</div></details>`;
}

const ALLOC_HINT = { cat: '点一行可以展开，看它下面的子类。', platform: '点一行可以展开，看具体是哪家银行、券商。', ccy: '按币种汇总，金额都已折算成人民币。' };

function allocHTML(M) {
  const by = S.allocBy;
  const al = allocation(M.L, by);
  const tile = x => (by === 'cat' ? catTile(x.key, x.ci)
    : by === 'ccy' ? `<span class="tile tx" style="--c:${colOf(x.ci)}">${CURRENCIES[x.ccy].sym}</span>`
    : platTile(x.label, x.ci));
  const bar = al.map(x => `<i style="flex:${x.v};--c:${colOf(x.ci)}"></i>`).join('');
  const rows = al.map(x => allocItem(x, by, tile(x))).join('');
  const pick = seg('alloc', [['cat', '按类型'], ['platform', '按平台'], ['ccy', '按币种']], by, { act: 'alloc', label: '分组方式' });
  return `<section class="sec"><div class="sec-h big"><span>资产配置</span></div><div class="group"><div class="pad dgap">
${pick}
${al.length ? `<div class="bar" role="img" aria-label="资产配置占比">${bar}</div>` : ''}</div>
${al.length ? rows : '<div class="empty">还没有市值大于 0 的账户</div>'}</div>
${al.length ? `<div class="sec-f">${ALLOC_HINT[by]}</div>` : ''}</section>`;
}

function monthHTML(M) {
  const thisMonth = todayStr().slice(0, 7);
  const rows = monthly(M.pts, 6).map(r => `<div class="row"><div class="body"><span class="t">${+r.m.slice(5)}月</span><span class="s">${r.m.slice(0, 4)}年${r.m === thisMonth ? ' · 至今' : ''}</span></div><div class="r"><b>${mny(r.v)}</b><span class="c mut">${r.dc == null ? '起点' : `投入 ${sgnAmt(r.dc, false, 0)} · 收益 ${sgnHTML(r.dp, false, 0)}`}</span></div></div>`).join('');
  return `<section class="sec"><div class="sec-h big"><span>月度变化</span></div><div class="group">${rows}</div>
<div class="sec-f">每行是月末资产。投资收益 = 资产变化 − 追加投入。新增账户首次录入的盈亏计入当月。</div></section>`;
}

export function homeHTML(M) {
  const cta = `<div class="group">${batchRow(M.lastP, staleCount(M.L))}</div>`;
  return heroHTML(M) + cta + trendHTML(M) + allocHTML(M) + monthHTML(M);
}

/* ---------- 账户 ---------- */

export function accHTML(M) {
  const by = S.accGroup;
  // 说明行：按平台分组时写类型和子类，按类型分组时写平台和子类
  const detail = a => (by === 'cat' ? esc(a.platform) : catOf(a).n) + (a.sub ? ` · ${esc(a.sub)}` : '');
  // 行里显示账户自己币种的金额；外币账户再写上折合人民币多少
  const accRow = a => {
    const src = a.src, l = last(src), pv = prevOf(src), dv = pv ? r2(l.v - pv.v) : null;
    const approx = src.ccy !== BASE_CCY ? ` · ≈\u00A0${mny(last(a).v)}` : ''; // 用不换行空格，免得在窄屏上从“≈”后面断开
    return `<button class="row acc" data-act="edit" data-id="${esc(a.id)}">${catTile(a.cat, catColor(a))}<span class="body"><span class="t">${esc(a.name)}</span><span class="s">${detail(a)} · ${agoText(l.d)}${approx}${isStale(a) ? '<span class="pill">待更新</span>' : ''}</span></span><span class="r"><b>${mny(l.v, undefined, src.ccy)}</b><span class="c">${dv == null ? '<span class="flat">首次记录</span>' : chgHTML(dv)}</span></span>${CHEV}</button>`;
  };
  const share = (sum, total) => (total ? (sum / total * 100).toFixed(0) : 0);
  let body;
  if (by === 'cat') {
    const groups = groupByCat(M.L);
    const total = groups.reduce((s, g) => s + g.sum, 0);
    body = groups.map(g => `<section class="sec"><div class="sec-h"><span>${esc(g.label)}</span><span class="num">${mny(g.sum)} · ${share(g.sum, total)}%</span></div><div class="group">${g.arr.map(accRow).join('')}</div></section>`).join('');
  } else {
    // 三层：机构大类（支付方式 / 银行 / 券商…）→ 具体机构 → 账户
    const groups = groupByPlatformGroup(M.L);
    const total = groups.reduce((s, g) => s + g.sum, 0);
    body = groups.map(g => `<section class="sec"><div class="sec-h"><span>${esc(g.name)}</span><span class="num">${mny(g.sum)} · ${share(g.sum, total)}%</span></div><div class="group">${
      g.platforms.map(pl => `<div class="subhead"><span>${esc(pl.p)}</span><span class="num">${mny(pl.sum)}</span></div>${pl.arr.map(accRow).join('')}`).join('')}</div></section>`).join('');
  }
  const pick = seg('accgroup', [['platform', '按平台'], ['cat', '按类型']], by, { act: 'accgroup', label: '分组方式' });
  const add = `<div class="group"><button class="row tl" data-act="add">${iconTile('var(--tint)', ROW_GLYPHS.add)}<span class="body"><span class="t tint">新增账户</span></span></button></div>`;
  return `<section class="sec"><div class="group">${batchRow(M.lastP, staleCount(M.L))}</div>${pick}</section>` + body + add;
}
