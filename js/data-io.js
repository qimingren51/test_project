// 备份导出（JSON / CSV）与导入。
import { S, upsertAccounts } from './store.js';
import { CATS, catIdx, normAcc } from './model.js';
import { todayStr } from './util.js';
import { $, toast } from './dom.js';

// 优先用系统分享面板（手机上可直接存到「文件」），不支持时回退为浏览器下载。
// 用户在分享面板里取消时抛出 { code: 'declined' }，不当作错误。
function saveFile(filename, data) {
  const type = /\.csv$/.test(filename) ? 'text/csv' : 'application/json';
  try {
    const file = new File([data], filename, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file] })
        .catch(e => { throw (e && e.name === 'AbortError') ? { code: 'declined' } : e; });
    }
  } catch (e) { /* 构造 File 失败时走下载 */ }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return Promise.resolve();
}

// 自动保存失败时，把内容放进文本框让用户手动复制
function showFallback(text) {
  const h = $('#fallback');
  if (!h) return;
  h.innerHTML = '<p class="sec-f" style="margin-bottom:6px">无法自动保存或复制，请手动全选并复制下面的内容，粘贴到备忘录里。</p><textarea readonly></textarea>';
  const ta = h.querySelector('textarea');
  ta.value = text;
  ta.focus();
  ta.select();
}

// 以 = + - @ 开头的单元格在 Excel 里会被当成公式，前面补一个单引号
const csvCell = s => {
  const t = String(s);
  return '"' + (/^[=+\-@\t\r]/.test(t) ? "'" : '') + t.replace(/"/g, '""') + '"';
};

export function exportData(kind) {
  const accs = S.accounts;
  if (!accs.length) { toast('还没有可导出的数据'); return; }
  const day = todayStr();
  let name, data;
  if (kind === 'json') {
    name = 'zichan-backup-' + day + '.json';
    data = JSON.stringify({
      app: 'zichan-kanban', v: 1, exportedAt: day,
      accounts: accs.map(a => ({ id: a.id, name: a.name, platform: a.platform, cat: a.cat, createdAt: a.createdAt, hist: a.hist })),
    }, null, 1);
  } else {
    name = 'zichan-history-' + day + '.csv';
    const rows = ['账户,平台,类型,日期,市值,本金'];
    for (const a of accs) {
      for (const h of a.hist) rows.push([csvCell(a.name), csvCell(a.platform), csvCell(CATS[catIdx(a.cat)].n), h.d, h.v, h.c].join(','));
    }
    data = '﻿' + rows.join('\n'); // BOM 让 Excel 正确识别 UTF-8
  }
  saveFile(name, data)
    .then(() => toast('已保存'))
    .catch(e => { if (!(e && e.code === 'declined')) showFallback(data); });
}

// 导入 exportData 导出的 JSON；同 id 的账户会被覆盖，其余追加。
export async function importFile(file) {
  try {
    const j = JSON.parse(await file.text());
    const list = Array.isArray(j) ? j : j.accounts;
    if (!Array.isArray(list)) throw new Error('bad');
    const accs = list.map(normAcc).filter(Boolean);
    if (!accs.length) { toast('文件里没有可用的账户'); return; }
    if (!upsertAccounts(accs)) { toast('无法写入本机存储，请稍后再试'); return; }
    toast(`已导入 ${accs.length} 个账户`);
  } catch (e) {
    toast('读取失败，请选择之前导出的 JSON 备份');
  }
}
