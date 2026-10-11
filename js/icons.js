// 内联 SVG 图标。造型参照 SF Symbols（圆角线条、统一线宽），但全部是自己画的：
// SF Symbols 的授权不允许放进网页里分发。所有图标都是 24×24 画布，线宽、描边样式由 CSS 统一控制。
const svg = (inner, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;

// 顶栏、横幅里用的图标
const EYE = '<path d="M2.4 12c2.3-4.3 5.7-6.6 9.6-6.6s7.3 2.3 9.6 6.6c-2.3 4.3-5.7 6.6-9.6 6.6S4.7 16.3 2.4 12z"/><circle cx="12" cy="12" r="3"/>';
export const ICONS = {
  eye: svg(EYE),
  eyeoff: svg(EYE + '<path d="M4.6 4.6l14.8 14.8"/>'),
  plus: svg('<path d="M12 5.5v13M5.5 12h13"/>'),
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.4M12 7.9v.1"/></svg>',
};

// 标签栏：每个标签两个版本，未选中是线条，选中是实心（和 iOS 一样）
export const TAB_ICONS = {
  home: { // chart.pie
    o: svg('<path d="M10.4 6.4A7.2 7.2 0 1017.6 13.6H10.4z"/><path d="M13.6 10.4V3.2A7.2 7.2 0 0120.8 10.4z"/>', 'ic ic-o'),
    f: svg('<path d="M10.4 6.4A7.2 7.2 0 1017.6 13.6H10.4z" fill="currentColor"/><path d="M13.6 10.4V3.2A7.2 7.2 0 0120.8 10.4z" fill="currentColor"/>', 'ic ic-f'),
  },
  acc: { // creditcard
    o: svg('<rect x="2.6" y="5.2" width="18.8" height="13.6" rx="3.2"/><path d="M2.6 9.9h18.8M6.4 14.6h3.6"/>', 'ic ic-o'),
    f: svg('<path fill-rule="evenodd" stroke="none" fill="currentColor" d="M5.8 5.2h12.4a3.2 3.2 0 013.2 3.2v1H2.6v-1a3.2 3.2 0 013.2-3.2zM2.6 11h18.8v4.6a3.2 3.2 0 01-3.2 3.2H5.8a3.2 3.2 0 01-3.2-3.2zM6.2 14.2h3.9a.9.9 0 010 1.8H6.2a.9.9 0 010-1.8z"/>', 'ic ic-f'),
  },
  set: { // slider.horizontal.3
    o: svg('<path d="M3.5 6.5h6.2M14.3 6.5h6.2M3.5 12h2.2M10.3 12h10.2M3.5 17.5h8.2M16.3 17.5h4.2"/><circle cx="12" cy="6.5" r="2.3"/><circle cx="8" cy="12" r="2.3"/><circle cx="14" cy="17.5" r="2.3"/>', 'ic ic-o'),
    f: svg('<path d="M3.5 6.5h6.2M14.3 6.5h6.2M3.5 12h2.2M10.3 12h10.2M3.5 17.5h8.2M16.3 17.5h4.2"/><circle cx="12" cy="6.5" r="2.3" fill="currentColor"/><circle cx="8" cy="12" r="2.3" fill="currentColor"/><circle cx="14" cy="17.5" r="2.3" fill="currentColor"/>', 'ic ic-f'),
  },
};

// 涨跌小三角（arrowtriangle.up.fill / down.fill）。用矢量图形，不用 ▲▼ 文字字符：
// 文字字符在不同系统、不同字体里大小和位置都不一样。
export const TRI_UP = '<svg class="tri" viewBox="0 0 10 9" aria-hidden="true"><path d="M5 1.3L9 7.7H1z"/></svg>';
export const TRI_DOWN = '<svg class="tri" viewBox="0 0 10 9" aria-hidden="true"><path d="M5 7.7L1 1.3h8z"/></svg>';

// 资产类型的图标路径，key 与 model.js 的 CATS 对应
export const CAT_GLYPHS = {
  cash: '<rect x="2.5" y="6.5" width="19" height="11" rx="2.6"/><circle cx="12" cy="12" r="2.5"/><path d="M6.2 12h.01M17.8 12h.01"/>', // banknote
  wealth: '<path d="M12 3.3l7.3 2.6v5.6c0 4.3-3 7.5-7.3 9.2-4.3-1.7-7.3-4.9-7.3-9.2V5.9z"/><path d="M8.8 12.1l2.3 2.3 4.2-4.6"/>', // checkmark.shield（理财产品）
  stock: '<path d="M3.6 4.4v13.6a1.8 1.8 0 001.8 1.8h15"/><path d="M7.4 15.2l3.8-4.2 3 2.7 4.8-5.9"/><path d="M15.9 7.8h3.2V11"/>', // chart.line.uptrend.xyaxis
  gold: '<path d="M3.4 18.4l2.4-6.2h12.4l2.4 6.2z"/><path d="M5.8 12.2l1.7-4.6h9l1.7 4.6"/>', // 金条
  fund: '<path d="M10.4 6.4A7.2 7.2 0 1017.6 13.6H10.4z"/><path d="M13.6 10.4V3.2A7.2 7.2 0 0120.8 10.4z"/>', // chart.pie（基金）
  pension: '<path d="M3.2 12.2a8.8 8.8 0 0117.6 0z"/><path d="M12 12.2v6.2a2.1 2.1 0 01-4.2 0"/>', // umbrella
  other: '<circle cx="6.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="17.5" cy="12" r="1.3" fill="currentColor"/>', // ellipsis
};

// 列表行首的图标块里的路径
export const ROW_GLYPHS = {
  batch: '<path d="M3.6 7.4l1.8 1.8 3.2-3.4M3.6 16.6l1.8 1.8 3.2-3.4M12.6 8h8M12.6 17.2h8"/>', // checklist
  add: '<path d="M12 5.5v13M5.5 12h13"/>',
  share: '<path d="M8.6 9H7.2A2.2 2.2 0 005 11.2v7.1a2.2 2.2 0 002.2 2.2h9.6a2.2 2.2 0 002.2-2.2v-7.1A2.2 2.2 0 0016.8 9h-1.4"/><path d="M12 14.6V3.6M8.4 7.2L12 3.6l3.6 3.6"/>', // square.and.arrow.up
  table: '<rect x="3.6" y="5" width="16.8" height="14" rx="2.6"/><path d="M3.6 9.7h16.8M3.6 14.3h16.8M9.2 5v14"/>', // tablecells
  download: '<path d="M13.6 3.5H8a2.2 2.2 0 00-2.2 2.2v12.6A2.2 2.2 0 008 20.5h8a2.2 2.2 0 002.2-2.2V8.1z"/><path d="M13.6 3.5v3.2a1.4 1.4 0 001.4 1.4h3.2"/><path d="M12 11v5.2M9.8 14.1l2.2 2.2 2.2-2.2"/>', // arrow.down.doc,
  // 设置页
  appearance: '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4v17.2a8.6 8.6 0 000-17.2z" fill="currentColor"/>', // circle.lefthalf.filled
  updown: '<path d="M8 19.5V5M4.6 8.4L8 5l3.4 3.4M16 4.5V19M12.6 15.6L16 19l3.4-3.4"/>', // arrow.up.arrow.down
  dollar: '<path d="M12 3.4v17.2M16.2 7.7c-.6-1.4-2.2-2.2-4.2-2.2-2.4 0-4 1.2-4 3 0 4.3 8.3 2.4 8.3 6.5 0 1.9-1.8 3.2-4.3 3.2-2.2 0-3.9-.9-4.5-2.4"/>', // dollarsign
  eyeoff: EYE + '<path d="M4.6 4.6l14.8 14.8"/>',
  exchange: '<path d="M4 8h14M14.5 4.5L18 8l-3.5 3.5M20 16H6M9.5 12.5L6 16l3.5 3.5"/>', // arrow.left.arrow.right
  bell: '<path d="M5 18.2l1.5-2V11a5.5 5.5 0 0111 0v5.2l1.5 2z"/><path d="M10 20.6a2.2 2.2 0 004 0"/>', // bell
  info: '<circle cx="12" cy="12" r="8.8"/><path d="M12 11v5.2M12 7.9v.1"/>', // info.circle
  question: '<circle cx="12" cy="12" r="8.8"/><path d="M9.7 9.7a2.4 2.4 0 114 1.9c-.8.6-1.7 1.1-1.7 2.3M12 16.9v.1"/>', // questionmark.circle
  reset: '<path d="M4.5 12a7.5 7.5 0 107.5-7.5H8"/><path d="M8 4.5L5.8 6.7 8 9"/>', // arrow.counterclockwise
  link: '<path d="M8 16l8.5-8.5M9.5 7.5h7v7"/>', // arrow.up.right
  person: '<circle cx="12" cy="8.8" r="3.6"/><path d="M4.8 19.6c.9-3.6 3.8-5.6 7.2-5.6s6.3 2 7.2 5.6"/>', // person
};

// 返回按钮用的向左箭头
export const CHEV_LEFT = '<svg class="chev-l" viewBox="0 0 9 15" aria-hidden="true"><path d="M7.5 1.5L1.5 7.5l6 6"/></svg>';

export const CHEV = '<svg class="chev" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6"/></svg>';
