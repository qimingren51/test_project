// 三个标签页的 HTML 生成：总览 / 账户 / 设置。纯函数，输入状态和派生数据，输出字符串。
import { S, RANGES, RANGE_LABELS } from './store.js';
import { CATS, catIdx, last, prevOf, rangeChange, monthly, allocation, groupByPlatform } from './model.js';
import { diffDays, r2, todayStr } from './util.js';
import { esc } from './dom.js';
import { MASK, mny, amt, sgnAmt, sgnHTML, pct, chgHTML, fmtMD, agoText, colOf } from './format.js';
import { ICONS, CAT_GLYPHS, CHEV } from './icons.js';

const STALE_DAYS = 14; // 超过这么多天没更新就提示“待更新”

const catOf = a => CATS[catIdx(a.cat)];
const catColor = a => { const i = catIdx(a.cat); return i < 6 ? i + 1 : 0; };
const isStale = a => diffDays(last(a).d, todayStr()) >= STALE_DAYS;
const staleCount = L => L.filter(isStale).length;

const catTile = (k, ci) =>
  `<span class="tile" style="--c:${colOf(ci)}"><svg viewBox="0 0 24 24">${CAT_GLYPHS[k] || CAT_GLYPHS.other}</svg></span>`;
const platTile = (label, ci) =>
  `<span class="tile tx" style="--c:${colOf(ci)}">${esc(Array.from(label)[0] || '·')}</span>`;

function batchRow(lastP, stale) {
  return `<button class="row" data-act="batch" style="--c:var(--tint)"><span class="tile"><svg viewBox="0 0 24 24"><path d="M4 7.5l2 2 3.5-3.5M4 16.5l2 2 3.5-3.5M13.5 8h6.5M13.5 17h6.5"/></svg></span><span class="body"><span class="t">一键盘点</span><span class="s">上次盘点 ${agoText(lastP.d)}${stale ? ` · ${stale} 个账户待更新` : ''}</span></span>${CHEV}</button>`;
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
  if (S.hide) total = `<span class="cur">¥</span>${MASK}`;
  else {
    const s = lastP.v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const i = s.lastIndexOf('.');
    total = `<span class="cur">¥</span>${s.slice(0, i)}<span class="dec">${s.slice(i)}</span>`;
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

function trendHTML(M) {
  const { rp } = M;
  const ch = rangeChange(rp);
  const ranges = Object.keys(RANGE_LABELS)
    .map(k => `<button data-act="range" data-v="${k}" aria-pressed="${S.range === k}">${RANGE_LABELS[k]}</button>`).join('');
  const chgBlock = ch
    ? `<div class="chg"><div class="lead">${RANGES[S.range]} · ${fmtMD(ch.from)} 到 ${fmtMD(ch.to)}</div>
<div class="main">${sgnAmt(ch.dv, true)}</div>
<div class="parts"><span>追加投入<b>${sgnAmt(ch.dc, true)}</b></span><span>投资收益<b>${sgnHTML(ch.dp, true)}</b></span></div></div>`
    : `<div class="chg"><div class="lead">${RANGES[S.range]}</div><div class="s" style="margin-top:4px">记录满两次后，这里显示总资产的变化，并拆成追加投入和投资收益。</div></div>`;
  const rows = rp.slice().reverse().slice(0, 80)
    .map(p => `<tr><td>${p.d.replace(/-/g, '/')}</td><td>${amt(p.v)}</td><td>${amt(p.c)}</td><td>${sgnHTML(r2(p.v - p.c), false, 0)}</td></tr>`).join('');
  return `<section class="sec"><div class="sec-h big"><span>资产变化</span></div><div class="group pad chartcard">
${chgBlock}
<div class="chart" id="trend"></div>
<div class="ranges" role="group" aria-label="时间范围">${ranges}</div>
<div class="legend"><span><i class="ln" style="background:var(--tint)"></i>总资产</span><span><i class="ln" style="background:var(--cost)"></i>本金</span><span><i class="bd"></i>两线之间是累计收益</span></div>
<details><summary class="dsum"><span>查看数据表</span>${CHEV}</summary><div class="tscroll"><table><thead><tr><th>日期</th><th>总资产</th><th>本金</th><th>累计收益</th></tr></thead><tbody>${rows}</tbody></table></div></details>
</div></section>`;
}

function allocHTML(M) {
  const al = allocation(M.L, S.allocBy);
  const tile = x => (S.allocBy === 'cat' ? catTile(x.key, x.ci) : platTile(x.label, x.ci));
  const bar = al.map(x => `<i style="flex:${x.v};--c:${colOf(x.ci)}"></i>`).join('');
  const rows = al.map(x => `<div class="row" style="--inset:58px">${tile(x)}<div class="body"><span class="t">${esc(x.label)}</span></div><div class="r"><b>${mny(x.v)}</b><span class="c mut">${(x.pct * 100).toFixed(1)}%</span></div></div>`).join('');
  return `<section class="sec"><div class="sec-h big"><span>资产配置</span></div><div class="group"><div class="pad dgap">
<div class="seg" role="group" aria-label="分组方式"><button data-act="alloc" data-v="cat" aria-pressed="${S.allocBy === 'cat'}">按类型</button><button data-act="alloc" data-v="platform" aria-pressed="${S.allocBy === 'platform'}">按平台</button></div>
${al.length ? `<div class="bar" role="img" aria-label="资产配置占比">${bar}</div>` : ''}</div>
${al.length ? rows : '<div class="empty">还没有市值大于 0 的账户</div>'}</div></section>`;
}

function monthHTML(M) {
  const thisMonth = todayStr().slice(0, 7);
  const rows = monthly(M.pts, 6).map(r => `<tr><td>${r.m.slice(0, 4)}年${+r.m.slice(5)}月${r.m === thisMonth ? ' <span class="mut">至今</span>' : ''}</td><td>${amt(r.v)}</td><td>${r.dc == null ? '—' : sgnAmt(r.dc, false, 0)}</td><td>${r.dp == null ? '<span class="flat">起点</span>' : sgnHTML(r.dp, false, 0)}</td></tr>`).join('');
  return `<section class="sec"><div class="sec-h big"><span>月度变化</span></div><div class="group"><div class="tbl"><table><thead><tr><th>月份</th><th>月末资产</th><th>追加投入</th><th>投资收益</th></tr></thead><tbody>${rows}</tbody></table></div></div>
<div class="sec-f">投资收益 = 资产变化 − 追加投入。新增账户首次录入的盈亏计入当月。</div></section>`;
}

export function homeHTML(M) {
  const cta = `<div class="group">${batchRow(M.lastP, staleCount(M.L))}</div>`;
  return heroHTML(M) + cta + trendHTML(M) + allocHTML(M) + monthHTML(M);
}

/* ---------- 账户 ---------- */

export function accHTML(M) {
  const groups = groupByPlatform(M.L);
  const total = groups.reduce((s, g) => s + g.sum, 0);
  const body = groups.map(g => `<section class="sec"><div class="sec-h"><span>${esc(g.p)}</span><span class="num">${mny(g.sum)} · ${total ? (g.sum / total * 100).toFixed(0) : 0}%</span></div><div class="group">${
    g.arr.map(a => {
      const l = last(a), pv = prevOf(a), dv = pv ? r2(l.v - pv.v) : null;
      return `<button class="row acc" data-act="edit" data-id="${esc(a.id)}">${catTile(a.cat, catColor(a))}<span class="body"><span class="t">${esc(a.name)}</span><span class="s">${catOf(a).n} · ${agoText(l.d)}${isStale(a) ? '<span class="pill">待更新</span>' : ''}</span></span><span class="r"><b>${mny(l.v)}</b><span class="c">${dv == null ? '<span class="flat">首次记录</span>' : chgHTML(dv)}</span></span>${CHEV}</button>`;
    }).join('')}</div></section>`).join('');
  const add = `<div class="group"><button class="row" data-act="add" style="--c:var(--tint)"><span class="tile"><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg></span><span class="body"><span class="t tint">新增账户</span></span></button></div>`;
  return `<div class="group">${batchRow(M.lastP, staleCount(M.L))}</div>` + body + add;
}

/* ---------- 设置 ---------- */

export function setHTML() {
  return `<section class="sec"><div class="sec-h"><span>显示</span></div><div class="group"><div class="row"><span class="t">涨跌配色</span><div class="seg w" role="group" aria-label="涨跌配色"><button data-act="conv" data-v="red" aria-pressed="${S.conv === 'red'}">红涨绿跌</button><button data-act="conv" data-v="green" aria-pressed="${S.conv === 'green'}">绿涨红跌</button></div></div></div>
<div class="sec-f">国内行情软件习惯红涨绿跌，也可以换成国际习惯。箭头方向始终表示涨跌。</div></section>
<section class="sec"><div class="sec-h"><span>数据</span></div><div class="group">
<button class="row" data-act="exp" data-v="json"><span class="t tint">导出备份（JSON）</span></button>
<button class="row" data-act="exp" data-v="csv"><span class="t tint">导出明细（CSV）</span></button>
<label class="row filebtn"><span class="t tint">导入备份</span><input type="file" id="imp" accept=".json,application/json" hidden></label></div>
<div class="sec-f">数据只保存在当前浏览器里，不会上传。清除浏览器数据或更换设备会丢失，建议每月导出一次备份，存到「文件」或 iCloud。</div><div id="fallback"></div></section>
<section class="sec"><div class="group"><button class="row center danger" data-act="clear">清空所有账户</button></div><div class="sec-f">删除全部账户和历史记录，无法恢复。</div></section>
<p class="foot">所有金额都由你手动录入。看板只做汇总和对比。</p>`;
}
