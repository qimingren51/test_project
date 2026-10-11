# CLAUDE.md

这个仓库是「资产看板」：一个由 Claude 开发和维护的个人财务看板。纯静态网页，手动录入金额，数据只存在用户自己浏览器的 localStorage 里，部署在 GitHub Pages。界面语言是简体中文，主要在手机上使用（iOS 风格，支持添加到主屏幕）。

## 目录结构

```
index.html          页面骨架，只有容器和标签栏，内容全由 JS 渲染
css/theme.css       设计令牌：颜色（浅色/深色）、圆角、动效曲线、文字样式、字体栈，涨跌配色开关
css/app.css         组件样式
js/main.js          入口：渲染、标签页切换、事件委托
js/model.js         纯数据逻辑：汇总序列、月度变化、资产配置、账户清洗
js/views.js         总览 / 账户 / 设置三个页面的 HTML 生成
js/sheets.js        底部弹层：新增 / 编辑 / 一键盘点（表单、预览、校验、保存）
js/chart.js         趋势图（手写 SVG）
js/store.js         全局状态 S、偏好和账户的 localStorage 读写
js/format.js        金额、百分比、日期的展示格式
js/data-io.js       JSON / CSV 导出与 JSON 导入
js/sample.js        账户为空时展示的示例数据（固定随机种子）
js/util.js          日期与数值工具
js/dom.js           $、esc、toast、二次确认 arm
js/icons.js         内联 SVG 图标（自己画的，造型参照 SF Symbols）
js/ui.js            分段控件 seg()（会滑动的滑块）
assets/icon.png     主屏幕图标
assets/fonts/       自托管的 Inter（拉丁字母，非苹果设备的备选字体）及其 OFL 授权文件
```

依赖方向是单向的：`util → model → store → icons / dom → format → ui → views / chart / sheets / data-io → main`。`model.js` 和 `util.js` 不碰 DOM 和存储，保持纯函数。

## 开发约定

- **不引入构建工具、框架和第三方库，也不加载 CDN 资源。** 浏览器直接跑 ES modules，GitHub Pages 直接托管仓库文件。
- 本地预览：`python3 -m http.server 8000`，打开 `http://localhost:8000`。ES modules 在 `file://` 下不能用，必须走 HTTP。
- 所有拼进 `innerHTML` 的用户输入（账户名、平台名）必须先过 `esc()`。
- 所有展示金额的地方都要走 `format.js` 的函数，这样「隐藏金额」（`S.hide`）才会统一生效。
- 新增 UI 要同时适配浅色和深色，颜色只用 `theme.css` 里的变量，不要写死色值。
- 趋势图（`js/chart.js`）的交互参照苹果「股市」：按住或拖动时出现竖线和圆点，图上方的区间摘要换成所选日期的读数（`scrubHTML`），不用遮挡曲线的浮窗。触屏抬手后保留，点图表以外的地方收起；纵向滑动是在滚页面，不能残留竖线。要在三种输入下都验证：鼠标悬停、触屏（按住、横向拖动、点按、从图表上起手的纵向滑动）、键盘（方向键、Home / End、Esc），并且要用截图确认竖线真的画出来了，不要只检查文字。
- SVG 元素没有会同步到属性的 `hidden` 属性：对 `<g>`、`<circle>` 等写 `el.hidden = false` 不会生效，要用 `el.toggleAttribute('hidden', …)`。（图表的竖线曾因此从来没显示出来。）
- 改完界面要在浏览器里实际看一遍（手机宽度 390px 为准，再看一次深色模式），不要只看代码。仓库没有测试框架；云端会话里预装了 Chromium 和 Playwright，可以用来截图和跑操作流程。

## 设计规范（苹果风格）

目标是看起来和用起来都像 iOS 原生应用。新增或修改界面时按下面来：

- **圆角**：卡片 `--r-card` 20px，横幅和小面板 `--r-md` 14px，图标块 `--r-tile` 9px，弹层顶部 `--r-sheet` 32px，分段控件和按钮是胶囊形。支持 `corner-shape: squircle` 的浏览器会自动用苹果那种连续曲率圆角（见 `app.css` 的 `@supports`）。
- **字体**：`--font` 先写 `-apple-system`，苹果设备上直接用系统自带的 SF Pro 和苹方；其他设备回退到自托管的 `Inter Web`（只含拉丁字母和数字，浏览器用到才下载），汉字用各系统自带的中文字体。**不要把 SF 字体文件放进仓库**（授权不允许），也不要加 `font-synthesis: none`（只有单一字重中文字体的系统会因此丢掉标题粗细）。
- **字号**只用 `theme.css` 里的文字样式令牌：`--fs-large` 34、`--fs-title1` 28、`--fs-title2` 22、`--fs-body` 17、`--fs-sub` 15、`--fs-foot` 13、`--fs-cap` 12、`--fs-cap2` 11，对应 iOS 默认字号下的 Large Title / Title / Body / Footnote / Caption。数字一律 `tabular-nums`。
- **图标**都在 `js/icons.js`，24×24 画布，线宽由 CSS 统一控制，造型参照 SF Symbols（圆角、统一线宽），但全部自己画，因为 SF Symbols 不允许在网页里分发。标签栏每个图标有线条和实心两个版本，选中时用实心。涨跌的小三角是矢量图形（`TRI_UP` / `TRI_DOWN`），不要用 `▲▼` 文字字符，不同系统里它们大小和位置都不一样。
- **没有表格**：多列数据都做成两行式列表行（左边标题和说明，右边数值和变化），不要用 `<table>`。
- **分段控件**用 `ui.js` 的 `seg()`，滑块位置由 `--i` 决定。`render()` 整块重绘页面时，`animateSegs()` 会让滑块从旧位置滑到新位置；新写的页面只要用 `seg()` 就自带这个效果。
- **动效**：弹层、滑动用 `--ease-ios`，带轻微回弹的用 `--spring`。按压反馈：列表行变灰，按钮缩到 0.92，松手时缓慢恢复。所有动画都要尊重 `prefers-reduced-motion`。
- **底部弹层**（`sheets.js`）：从底部升起，关闭时有收起动画。顶部灰条和标题栏可以往下拖，内容滚到顶后在内容区往下拖也能关闭。用户已经输入过内容时，下拉、点遮罩、按 Esc 只会回弹，不会关闭；点「取消」按钮才直接放弃（`data-act="close"` 是直接关闭，`data-act="dismiss"` 是带保护的关闭）。
- **标签页**：每个标签页记住自己的滚动位置，再点一次当前标签页回到顶部（和 iOS 一样）。

## 数据模型

账户结构：`{ id, name, platform, cat, createdAt, hist: [{ d, v, c }] }`

- `hist` 按日期升序，每个日期一条。`d` 是 `YYYY-MM-DD` 字符串（按本地时区解析），`v` 是当天市值，`c` 是截至当天的累计投入本金。
- 总资产序列（`series`）：每个日期取各账户「不晚于该日」的最近一条记录求和。
- **投资收益 = 资产变化 − 追加投入。** 区间变化和月度表都按这个口径拆分，改统计逻辑时不要破坏这条等式。
- 金额统一用 `r2()` 保留两位小数。用户输入统一用 `format.js` 的 `num()` 解析，它会拒绝 `NaN` 和 `Infinity`。
- 导入的文件和 localStorage 里的数据都不可信，一律经过 `normAcc()` 清洗。
- 涨跌配色默认红涨绿跌（`--up` 是红色），可在设置里反转。箭头方向永远表示涨跌，与配色无关。

## 隐私

这是用户的真实财务工具，仓库和页面都是公开的：

- **不要把任何真实的金额、账户名、备份文件提交进仓库。** 调试用的数据一律用 `js/sample.js` 里的示例数据或临时造的假数据。
- 备份文件（`zichan-backup-*.json`、`zichan-history-*.csv`）已在 `.gitignore` 里。
- 不要加任何会把数据发到外部服务的代码（统计、日志、云同步）。数据只留在用户本机。

## 部署

GitHub Pages 从分支根目录直接发布，没有构建步骤。推送到发布分支后一两分钟生效。图标等静态资源用相对路径，因为站点地址是 `用户名.github.io/仓库名/`，不是域名根。
