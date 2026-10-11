// 底部弹层：新增账户 / 编辑账户 / 一键盘点。包含表单 HTML、实时预览、校验与保存。
import { S, upsertAccounts, removeAccounts } from './store.js';
import { CATS, last, newId, groupByPlatform } from './model.js';
import { DATE_RE, r2, todayStr } from './util.js';
import { $, esc, toast, arm } from './dom.js';
import { mny, amt, sgnAmt, sgnHTML, pct, agoText, num } from './format.js';
import { CHEV } from './icons.js';

const SAVE_FAIL = '无法写入本机存储，请先导出备份';
const ferr = msg => { const e = $('#ferr'); if (e) e.textContent = msg; return false; };

function shell(title, save, body) {
  return `<div class="grab"></div><div class="sh-nav"><button type="button" class="txt" data-act="close">取消</button><strong>${title}</strong>${save ? `<button type="submit" form="f" class="txt strong">${save}</button>` : '<span></span>'}</div><div class="sh-body">${body}</div>`;
}
const field = (label, inner) => `<label class="frow"><span>${label}</span>${inner}</label>`;
const catOptions = sel => CATS.map(c => `<option value="${c.k}"${c.k === sel ? ' selected' : ''}>${c.n}</option>`).join('');
function platformList() {
  const set = new Set(['支付宝', '微信', '银行', '券商', '基金平台', '其他']);
  for (const a of S.accounts) set.add(a.platform);
  return [...set].map(p => `<option value="${esc(p)}"></option>`).join('');
}

/* ---------- 表单 HTML ---------- */

function addHTML() {
  const t = todayStr();
  return shell('新增账户', '保存', `<form id="f" data-kind="add" novalidate>
<div class="group">
${field('名称', '<input id="f-nm" name="nm" type="text" maxlength="24" autocomplete="off" placeholder="例如 余额宝">')}
${field('平台', '<input id="f-plat" name="plat" type="text" list="plats" maxlength="12" autocomplete="off" placeholder="例如 支付宝"><datalist id="plats">' + platformList() + '</datalist>')}
${field('类型', '<select id="f-cat" name="cat">' + catOptions('cash') + '</select>')}
</div>
<div class="sec"><div class="group">
${field('当前市值', '<input id="f-val" name="val" inputmode="decimal" autocomplete="off" placeholder="0.00">')}
${field('投入本金', '<input id="f-cost" name="cost" inputmode="decimal" autocomplete="off" placeholder="不填则同市值">')}
${field('记录日期', `<input id="f-date" name="date" type="date" value="${t}" max="${t}">`)}
</div>
<p class="sec-f">股票、美股这类每天波动的资产，按记录当天的市值填就行，美股先折合成人民币。投入本金是你一共投进去多少钱，不确定可以先留空。</p>
<p class="sec-f prev" id="prev"></p><p class="sec-f err" id="ferr" role="alert"></p></div></form>`);
}

function editHTML(id) {
  const a = S.accounts.find(x => x.id === id);
  if (!a) return shell('账户不存在', '', '');
  const l = last(a), t = todayStr(), profit = r2(l.v - l.c);
  const rows = a.hist.slice(-7).reverse().map((h, i) => {
    const p = a.hist[a.hist.length - 2 - i];
    return `<tr><td>${h.d.replace(/-/g, '/')}</td><td>${amt(h.v)}</td><td>${p ? sgnHTML(r2(h.v - p.v), false, 0) : '<span class="flat">首次</span>'}</td></tr>`;
  }).join('');
  return shell(esc(a.name), '保存', `
<div class="group pad kv"><div><span>当前市值</span><b>${mny(l.v, 2)}</b></div><div><span>累计收益</span><b>${sgnHTML(profit, true)}${l.c > 0 ? `<small class="${profit > 0 ? 'up' : profit < 0 ? 'down' : 'flat'}">${pct(profit / l.c, true)}</small>` : ''}</b></div></div>
<form id="f" data-kind="edit" data-id="${esc(a.id)}" novalidate>
<div class="sec"><div class="group">
${field('新的市值', '<input id="f-val" name="val" inputmode="decimal" autocomplete="off" value="' + l.v + '">')}
<div class="frow"><span>资金进出</span><div class="seg" role="radiogroup" aria-label="资金进出">
<label class="rseg"><input type="radio" name="flowk" value="none" checked><span>没有</span></label>
<label class="rseg"><input type="radio" name="flowk" value="in"><span>追加投入</span></label>
<label class="rseg"><input type="radio" name="flowk" value="out"><span>取出</span></label></div></div>
<label class="frow" id="flow-wrap" hidden><span>金额</span><input id="f-flow" name="flow" inputmode="decimal" autocomplete="off" placeholder="元"></label>
${field('记录日期', `<input id="f-date" name="date" type="date" value="${t}" min="${l.d}" max="${t}">`)}
</div><p class="sec-f prev" id="prev"></p><p class="sec-f err" id="ferr" role="alert"></p></div>
<div class="group"><details class="more"><summary class="frow"><span>修改账户信息</span>${CHEV}</summary>
${field('名称', '<input id="f-nm" name="nm" type="text" maxlength="24" autocomplete="off" value="' + esc(a.name) + '">')}
${field('平台', '<input id="f-plat" name="plat" type="text" list="plats" maxlength="12" autocomplete="off" value="' + esc(a.platform) + '"><datalist id="plats">' + platformList() + '</datalist>')}
${field('类型', '<select id="f-cat" name="cat">' + catOptions(a.cat) + '</select>')}
${field('累计本金', '<input id="f-cost" name="cost" inputmode="decimal" autocomplete="off" value="' + l.c + '">')}
</details></div></form>
<div class="sec"><div class="sec-h"><span>最近记录</span></div><div class="group"><div class="tbl"><table><thead><tr><th>日期</th><th>市值</th><th>较上次</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>
<div class="group"><button type="button" class="row center danger" data-act="del" data-id="${esc(a.id)}">删除这个账户</button></div>`);
}

function batchHTML() {
  const t = todayStr();
  const rows = groupByPlatform(S.accounts).map(g => `<div class="sec"><div class="sec-h"><span>${esc(g.p)}</span></div><div class="group">${g.arr.map(a => {
    const l = last(a);
    return `<div class="row"><div class="body"><span class="t">${esc(a.name)}</span><span class="s">${mny(l.v)} · ${agoText(l.d)}</span></div><input class="bi" data-id="${esc(a.id)}" inputmode="decimal" autocomplete="off" placeholder="${S.hide ? '新市值' : l.v}" aria-label="${esc(a.name)} 的新市值"></div>`;
  }).join('')}</div></div>`).join('');
  return shell('一键盘点', '保存', `<form id="f" data-kind="batch" novalidate>
<div class="sec"><div class="group">
${field('盘点日期', `<input id="f-date" name="date" type="date" value="${t}" max="${t}">`)}
<label class="frow carry"><span>沿用未填账户的上次市值</span><span class="switch"><input type="checkbox" name="carry" checked><i></i></span></label>
</div><p class="sec-f">只填有变化的账户。开启沿用后，没填的账户也会按上次市值记一笔，每次盘点的总资产就是同一天的快照。股票、美股按今天的市值填，美股先折合成人民币。</p></div>
${rows}
<p class="sec-f err" id="ferr" role="alert"></p></form>`);
}

/* ---------- 打开 / 关闭 ---------- */

let opener = null; // 关闭弹层后把焦点还给触发它的元素

export function openSheet(kind, id) {
  closeSheet();
  opener = document.activeElement;
  const html = kind === 'add' ? addHTML() : kind === 'edit' ? editHTML(id) : batchHTML();
  $('#sheet-root').innerHTML = `<div class="sheet-bd" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
  document.documentElement.style.overflow = 'hidden';
  $('.sheet').focus({ preventScroll: true });
  updatePreview();
}

export function closeSheet() {
  $('#sheet-root').innerHTML = '';
  document.documentElement.style.overflow = '';
  if (opener && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
  opener = null;
}

export const isSheetOpen = () => !!$('.sheet');

/* ---------- 保存前预览 ---------- */

export function updatePreview() {
  const f = $('#f');
  if (!f || f.dataset.kind === 'batch') return;
  const el = f.elements, v = num(el.val.value);
  let c = NaN;
  if (f.dataset.kind === 'edit') {
    const l = last(S.accounts.find(x => x.id === f.dataset.id)), co = el.cost.value.trim();
    if (co !== '' && num(co) !== l.c) c = num(co); // 手动改了累计本金，以它为准
    else {
      const k = el.flowk.value, x = k === 'none' ? 0 : (num(el.flow.value) || 0);
      c = l.c + (k === 'in' ? x : k === 'out' ? -x : 0);
    }
  } else {
    const co = el.cost.value.trim();
    c = co === '' ? v : num(co);
  }
  const p = $('#prev');
  if (!(v >= 0) || !(c >= 0)) { p.textContent = ''; return; }
  const pr = r2(v - c);
  p.innerHTML = `保存后：本金 ${mny(Math.max(0, r2(c)))} · 收益 ${sgnHTML(pr, true)}${c > 0 ? `（${pct(pr / c, true)}）` : ''}`;
}

/* ---------- 提交 ---------- */

function submitAdd(el, td) {
  const nm = el.nm.value.trim();
  if (!nm) return ferr('请填写账户名称');
  const v = num(el.val.value);
  if (!(v >= 0)) return ferr('请填写当前市值，数字即可');
  const co = el.cost.value.trim(), c = co === '' ? v : num(co);
  if (!(c >= 0)) return ferr('投入本金要填数字');
  const date = el.date.value || td;
  if (!DATE_RE.test(date) || date > td) return ferr('日期不能晚于今天');
  const acc = {
    id: newId(), name: nm.slice(0, 24), platform: (el.plat.value.trim() || '其他').slice(0, 12),
    cat: el.cat.value, createdAt: date, hist: [{ d: date, v: r2(v), c: r2(c) }],
  };
  if (!upsertAccounts([acc])) return ferr(SAVE_FAIL);
  closeSheet();
  toast('已添加 ' + acc.name);
}

function submitEdit(f, el, td) {
  const a = S.accounts.find(x => x.id === f.dataset.id);
  if (!a) return ferr('账户不存在');
  const l = last(a), v = num(el.val.value);
  if (!(v >= 0)) return ferr('请填写新的市值，数字即可');
  const date = el.date.value || td;
  if (!DATE_RE.test(date) || date < l.d || date > td) return ferr('日期要在上次记录（' + l.d.replace(/-/g, '/') + '）和今天之间');
  let c;
  const co = el.cost.value.trim();
  if (co !== '' && num(co) !== l.c) {
    c = num(co);
    if (!(c >= 0)) return ferr('累计本金要填数字');
  } else {
    const k = el.flowk.value;
    let x = 0;
    if (k !== 'none') {
      x = num(el.flow.value);
      if (!(x >= 0)) return ferr('请填写资金进出的金额');
    }
    c = l.c + (k === 'in' ? x : k === 'out' ? -x : 0);
  }
  c = Math.max(0, r2(c));
  const hist = a.hist.slice(), entry = { d: date, v: r2(v), c };
  if (date === l.d) hist[hist.length - 1] = entry; else hist.push(entry);
  const next = Object.assign({}, a, {
    name: (el.nm.value.trim() || a.name).slice(0, 24),
    platform: (el.plat.value.trim() || a.platform).slice(0, 12),
    cat: el.cat.value, hist,
  });
  if (!upsertAccounts([next])) return ferr(SAVE_FAIL);
  closeSheet();
  toast('已更新 ' + next.name);
}

function submitBatch(f, el, td) {
  const date = el.date.value || td;
  if (!DATE_RE.test(date) || date > td) return ferr('日期不能晚于今天');
  const carry = el.carry.checked, inputs = new Map();
  f.querySelectorAll('input.bi').forEach(i => inputs.set(i.dataset.id, i.value.trim()));
  const jobs = [];
  let up = 0, keep = 0, skip = 0;
  for (const a of S.accounts) {
    const l = last(a), raw = inputs.get(a.id) || '';
    if (date < l.d) { if (raw !== '') skip++; continue; } // 早于上次记录的不改历史
    let entry = null;
    if (raw !== '') {
      const v = num(raw);
      if (!(v >= 0)) return ferr('「' + a.name + '」的市值不是数字');
      if (!(r2(v) === l.v && date === l.d)) { entry = { d: date, v: r2(v), c: l.c }; up++; }
    } else if (carry && date !== l.d) {
      entry = { d: date, v: l.v, c: l.c };
      keep++;
    }
    if (entry) {
      const hist = a.hist.slice();
      if (date === l.d) hist[hist.length - 1] = entry; else hist.push(entry);
      jobs.push(Object.assign({}, a, { hist }));
    }
  }
  if (!jobs.length) return ferr(skip ? '所选日期早于这些账户的上次记录' : '没有需要保存的变化');
  if (!upsertAccounts(jobs)) return ferr(SAVE_FAIL);
  closeSheet();
  toast(`盘点完成：更新 ${up} 项${keep ? `，沿用 ${keep} 项` : ''}${skip ? `，跳过 ${skip} 项` : ''}`);
}

export function submitForm(f) {
  ferr('');
  const el = f.elements, td = todayStr();
  if (f.dataset.kind === 'add') submitAdd(el, td);
  else if (f.dataset.kind === 'edit') submitEdit(f, el, td);
  else submitBatch(f, el, td);
}

export function deleteAccount(id) {
  if (!removeAccounts([id])) return ferr(SAVE_FAIL);
  closeSheet();
  toast('已删除');
}
