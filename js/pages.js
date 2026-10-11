// 设置标签页：主页，以及从主页进入的二级页面（个人资料、关于）。
// 和 views.js 一样是纯函数：输入状态，输出 HTML 字符串。
import { S } from './store.js';
import { THEMES, CURRENCIES, STALE_OPTIONS, AVATAR_COLORS, AVATAR_EMOJIS, APP_VERSION, REPO_URL } from './config.js';
import { esc } from './dom.js';
import { ROW_GLYPHS, CHEV } from './icons.js';
import { seg } from './ui.js';
import { iconTile } from './views.js';

export const SUB_TITLES = { profile: '个人资料', rates: '汇率', about: '关于' };

const COLOR_NAMES = { blue: '蓝色', teal: '青色', green: '绿色', orange: '橙色', pink: '粉色', purple: '紫色', red: '红色', gray: '灰色' };

/* ---------- 头像 ---------- */

// 头像里显示什么：选了图案就是图案，否则是昵称的第一个字，都没有就是人形图标
export const avatarContent = p => p.emoji || Array.from(p.name.trim())[0]?.toUpperCase() || '';
const personSvg = `<svg viewBox="0 0 24 24" aria-hidden="true">${ROW_GLYPHS.person}</svg>`;

// 头像圆里的内容（文字或人形图标）
export const avatarInner = p => { const ch = avatarContent(p); return ch ? esc(ch) : personSvg; };

// size: sm | md | xl。live：用户正在输入昵称时，头像里的文字会被直接改写（见 main.js 的 refreshProfileLive），
// 'full' 跟着完整资料，'initial' 永远只显示昵称首字（“首字”那个选项）
export function avatarHTML(size, profile = S.profile, live = 'full') {
  const c = AVATAR_COLORS.find(x => x.k === profile.color) || AVATAR_COLORS[0];
  return `<span class="avatar ${size}" data-live="${live}" style="--a:${c.a};--b:${c.b}">${avatarInner(profile)}</span>`;
}

/* ---------- 设置主页 ---------- */

const row = (color, glyph, title, control, tag = 'div') =>
  `<${tag} class="row tl">${iconTile(color, glyph)}<span class="body"><span class="t">${title}</span></span>${control}</${tag}>`;

const select = (pref, value, options, label) =>
  `<select class="sel" data-pref="${pref}" aria-label="${label}">${options.map(([v, text]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select>`;

const toggle = (pref, on) => `<span class="switch"><input type="checkbox" data-pref="${pref}"${on ? ' checked' : ''}><i></i></span>`;

const navRow = (color, glyph, title, sub, attrs) =>
  `<button class="row tl" ${attrs}>${iconTile(color, glyph)}<span class="body"><span class="t">${title}</span>${sub ? `<span class="s">${sub}</span>` : ''}</span>${CHEV}</button>`;

export function settingsHTML() {
  const p = S.profile;
  const profile = `<button class="row prof" data-act="open" data-v="profile">${avatarHTML('md')}<span class="body"><span class="t name">${p.name ? esc(p.name) : '设置你的昵称'}</span><span class="s">个人资料和头像</span></span>${CHEV}</button>`;

  const theme = seg('theme', THEMES, S.theme, { act: 'theme', cls: 'w', label: '外观' });
  const conv = seg('conv', [['red', '红涨绿跌'], ['green', '绿涨红跌']], S.conv, { act: 'conv', cls: 'w', label: '涨跌配色' });
  const display = `<div class="group">
${row('#5856D6', ROW_GLYPHS.appearance, '外观', theme)}
${row('#FF3B30', ROW_GLYPHS.updown, '涨跌配色', conv)}
${navRow('#30B0C7', ROW_GLYPHS.exchange, '汇率', `英镑 ${S.rates.GBP} · 美元 ${S.rates.USD}（折合人民币）`, 'data-act="open" data-v="rates"')}
${row('#8E8E93', ROW_GLYPHS.eyeoff, '隐藏金额', toggle('hide', S.hide), 'label')}
</div>`;

  const remind = `<div class="group">${row('#FF9500', ROW_GLYPHS.bell, '待更新提醒', select('staleDays', S.staleDays, STALE_OPTIONS.map(d => [d, `${d} 天`]), '待更新提醒天数'), 'label')}</div>`;

  const data = `<div class="group">
${navRow('var(--cat1)', ROW_GLYPHS.share, '导出备份', 'JSON，之后可以导入恢复', 'data-act="exp" data-v="json"')}
${navRow('var(--cat3)', ROW_GLYPHS.table, '导出明细', 'CSV，可以用 Excel 打开', 'data-act="exp" data-v="csv"')}
<label class="row tl filebtn">${iconTile('var(--cat2)', ROW_GLYPHS.download)}<span class="body"><span class="t">导入备份</span><span class="s">选择之前导出的 JSON 文件</span></span>${CHEV}<input type="file" id="imp" accept=".json,application/json" hidden></label>
</div>`;

  const about = `<div class="group">
${navRow('#8E8E93', ROW_GLYPHS.info, '关于资产看板', '', 'data-act="open" data-v="about"')}
<a class="row tl" href="${REPO_URL}/issues" target="_blank" rel="noopener">${iconTile('var(--cat1)', ROW_GLYPHS.question)}<span class="body"><span class="t">帮助与反馈</span></span><svg class="ext" viewBox="0 0 24 24" aria-hidden="true">${ROW_GLYPHS.link}</svg></a>
</div>`;

  return `<section class="sec"><div class="group">${profile}</div></section>
<section class="sec"><div class="sec-h"><span>显示</span></div>${display}
<div class="sec-f">国内行情软件习惯红涨绿跌，也可以换成国际习惯，箭头方向始终表示涨跌。总资产等汇总都以人民币显示，英镑、美元账户按「汇率」折算进来。</div></section>
<section class="sec"><div class="sec-h"><span>提醒</span></div>${remind}
<div class="sec-f">超过设定天数没有更新的账户，会在「账户」页标记为「待更新」。</div></section>
<section class="sec"><div class="sec-h"><span>数据</span></div>${data}
<div class="sec-f">数据只保存在当前浏览器里，不会上传。清除浏览器数据或更换设备会丢失，建议每月导出一次备份，存到「文件」或 iCloud。</div><div id="fallback"></div></section>
<section class="sec">${about}</section>
<section class="sec"><div class="group"><button class="row center tint" data-act="reset">恢复默认设置</button></div>
<div class="sec-f">外观、配色、货币、提醒天数回到默认值，不会动你的账户和个人资料。</div></section>
<section class="sec"><div class="group"><button class="row center danger" data-act="clear">清空所有账户</button></div><div class="sec-f">删除全部账户和历史记录，无法恢复。</div></section>
<p class="foot">所有金额都由你手动录入。看板只做汇总和对比。</p>`;
}

/* ---------- 个人资料 ---------- */

export function profileHTML() {
  const p = S.profile;
  const swatches = AVATAR_COLORS.map(c =>
    `<button type="button" class="sw" style="--a:${c.a};--b:${c.b}" data-act="swatch" data-v="${c.k}" aria-label="${COLOR_NAMES[c.k]}" aria-pressed="${p.color === c.k}"></button>`).join('');
  const initial = `<button type="button" class="em" data-act="emoji" data-v="" aria-label="首字" aria-pressed="${p.emoji === ''}">${avatarHTML('sm', { ...p, emoji: '' }, 'initial')}</button>`;
  const emojis = AVATAR_EMOJIS.map(e =>
    `<button type="button" class="em" data-act="emoji" data-v="${e}" aria-label="${e}" aria-pressed="${p.emoji === e}">${e}</button>`).join('');
  return `<div class="pf-hero">${avatarHTML('xl')}<div class="pf-name" id="pf-name-text">${p.name ? esc(p.name) : '未设置昵称'}</div></div>
<section class="sec"><div class="group"><label class="frow"><span>昵称</span><input id="pf-name" type="text" maxlength="12" autocomplete="nickname" enterkeyhint="done" placeholder="例如 小明" value="${esc(p.name)}"></label></div>
<div class="sec-f">昵称最多 12 个字，只在这台设备上显示，不会上传。</div></section>
<section class="sec"><div class="sec-h"><span>头像颜色</span></div><div class="group pad"><div class="swatches">${swatches}</div></div></section>
<section class="sec"><div class="sec-h"><span>头像图案</span></div><div class="group pad"><div class="emojis">${initial}${emojis}</div></div>
<div class="sec-f">选「首字」会显示昵称的第一个字。</div></section>`;
}

/* ---------- 关于 ---------- */

export function aboutHTML() {
  return `<div class="about-hero"><img class="app-icon" src="assets/icon.png" alt="" width="84" height="84"><div class="ab-name">资产看板</div><div class="ab-ver">版本 ${APP_VERSION}</div></div>
<section class="sec"><div class="group">
<div class="row"><span class="t">数据存储</span><span class="val">本机浏览器</span></div>
<a class="row" href="${REPO_URL}" target="_blank" rel="noopener"><span class="t">源代码</span><span class="val">GitHub</span><svg class="ext" viewBox="0 0 24 24" aria-hidden="true">${ROW_GLYPHS.link}</svg></a>
<div class="row"><span class="t">字体</span><span class="val">Inter · SIL OFL</span></div>
</div>
<div class="sec-f">所有金额都由你手动录入，数据只保存在这台设备的浏览器里，不会上传到任何服务器，也没有任何统计或追踪。苹果设备上使用系统自带的字体，其他设备使用开源字体 Inter。</div></section>`;
}

/* ---------- 汇率 ---------- */

export function ratesHTML() {
  const rows = ['GBP', 'USD'].map(c =>
    `<label class="frow"><span>1 ${CURRENCIES[c].name} =</span><input data-rate="${c}" type="text" inputmode="decimal" autocomplete="off" value="${S.rates[c]}" aria-label="1 ${CURRENCIES[c].name}折合多少人民币"><span class="unit">人民币</span></label>`).join('');
  return `<section class="sec"><div class="group">${rows}</div>
<div class="sec-f">汇率由你自己填写和维护，不会联网更新。英镑、美元账户的金额按这里的汇率折算成基础货币，再汇总到总资产里。历史记录也按当前汇率折算，不单独记录汇率的变动。</div></section>
<section class="sec"><div class="sec-f warn">默认值只是估计，请改成你自己的汇率。</div></section>
<section class="sec"><div class="group"><button class="row center tint" data-act="resetrates">恢复默认汇率</button></div></section>`;
}

export const subHTML = name => (name === 'profile' ? profileHTML() : name === 'rates' ? ratesHTML() : aboutHTML());
