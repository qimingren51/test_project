# CLAUDE.md

这个仓库是「资产看板」：一个由 Claude 开发和维护的个人财务看板。纯静态网页，手动录入金额，数据只存在用户自己浏览器的 localStorage 里，部署在 GitHub Pages。界面语言是简体中文，主要在手机上使用（iOS 风格，支持添加到主屏幕）。

## 目录结构

```
index.html          页面骨架，只有容器和标签栏，内容全由 JS 渲染
css/theme.css       设计令牌（颜色变量，浅色/深色，涨跌配色开关）
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
js/icons.js         内联 SVG 图标
assets/icon.png     主屏幕图标
```

依赖方向是单向的：`util → model → store → format → views / chart / sheets / data-io → main`。`model.js` 和 `util.js` 不碰 DOM 和存储，保持纯函数。

## 开发约定

- **不引入构建工具、框架和第三方库，也不加载 CDN 资源。** 浏览器直接跑 ES modules，GitHub Pages 直接托管仓库文件。
- 本地预览：`python3 -m http.server 8000`，打开 `http://localhost:8000`。ES modules 在 `file://` 下不能用，必须走 HTTP。
- 所有拼进 `innerHTML` 的用户输入（账户名、平台名）必须先过 `esc()`。
- 所有展示金额的地方都要走 `format.js` 的函数，这样「隐藏金额」（`S.hide`）才会统一生效。
- 新增 UI 要同时适配浅色和深色，颜色只用 `theme.css` 里的变量，不要写死色值。
- 趋势图（`js/chart.js`）的交互要在三种输入下都验证：鼠标悬停、触屏（点按、横向拖动、从图表上起手的纵向滑动）、键盘（方向键、Home / End、Esc）。约定：触屏抬手后浮窗保留，点图表以外的地方收起；纵向滑动是在滚页面，不能残留浮窗。
- 改完界面要在浏览器里实际看一遍（手机宽度 390px 为准，再看一次深色模式），不要只看代码。仓库没有测试框架；云端会话里预装了 Chromium 和 Playwright，可以用来截图和跑操作流程。

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
