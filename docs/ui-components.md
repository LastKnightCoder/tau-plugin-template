# 界面组件与样式

插件的页面、设置、面板都是 React 组件。用 `@tau/ui` 的按钮、弹窗、输入框等组件搭界面，它们会跟随用户的主题切换，在手机上适配触摸、系统返回键和安全区；自己写的样式要加插件专属前缀，用 Tau 的主题变量取颜色，避免和 Tau 或其他插件的样式互相覆盖。所有带界面的插件都会用到这一篇。

```tsx
// src/HelpButton.tsx
import { useState } from "react";
import { Button, Dialog, DialogBody, Panel } from "@tau/ui";
import "./styles.css";

export function HelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <Panel className="yourname-help">
      <Button variant="ghost" onClick={() => setOpen(true)}>
        查看说明
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="使用说明">
        <DialogBody>计数保存在当前资料库里，停用插件后保留。</DialogBody>
      </Dialog>
    </Panel>
  );
}
```

```css
/* src/styles.css */
.yourname-help {
  color: var(--tau-ink-2);
  border-radius: var(--tau-radius-md);
}
```

把 `HelpButton` 放进任意页面或设置组件里即可，页面怎么注册见[页面与入口](pages.md)。

## 界面组件与样式

### 常用组件

| 组件         | 常用属性                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`     | `onClick`、`disabled`、`loading`、`loadingText`；`variant` 可选 `primary`、`secondary`、`soft`、`ghost`、`danger`、`danger-soft`                  |
| `Panel`      | 内容容器                                                                                                                                          |
| `Dialog`     | `open`、`onOpenChange`、`title`，`footer` 放操作按钮                                                                                              |
| `DialogBody` | 弹窗正文                                                                                                                                          |
| `Sortable`   | 拖动排序：`items`、`getKey`、`onMove(from, to)`、`renderItem(item, state)`，把 `state.handleProps` 展开到拖动手柄上；手柄获得焦点时方向键前后移动 |

此外还有 `Input`、`NumberInput`、`Switch`、`Select`、`Menu`、`Drawer`、`Popover`、`Tabs`、`DatePicker` 等，完整的组件列表和属性见 `@tau/ui` 的类型提示。

`Dialog`、`Drawer`、`Popover`、`Select`、`Menu` 自己处理 Esc 和手机的系统返回键；自己画的浮层怎样接 Esc，见[页面显示状态与 Esc](pages.md#页面显示状态与-esc)。

### 自己写样式

自己写的样式放在 CSS 文件里，在入口或组件中 `import`：

- 选择器加上插件专属前缀（如 `.yourname-counter`），不要修改 `body` 或 Tau 自身元素的样式。
- 颜色、圆角等使用 Tau 的主题变量（如 `var(--tau-accent)`），这样会跟随用户的主题切换。
- SVG 图片可以直接在 CSS 里用 `url()` 引用，构建时会内联进样式，不需要额外复制文件。
- 用 Tailwind 时，导入 `@tau/plugins/tailwind.css`，它把 Tau 的主题变量映射成 Tailwind 语义类（如 `bg-surface`、`text-ink-1`）。Tau 不会替插件生成 Tailwind 样式，需要你在构建时自己编译，并按下一节给类名加前缀。

手机和桌面的屏幕宽度不同，布局的适配方法见[多端适配 · 适配不同的屏幕](portability.md#适配不同的屏幕)。

## 用 Tailwind 时加前缀

插件的样式和 Tau、用户的博客模板加载在同一个页面里。Tailwind 的工具类名是通用的：你的 `.flex`、`.hidden` 和 Tau 的同名类是两条规则，插件样式加载得更晚，会把 Tau `hidden md:flex` 这类响应式写法覆盖掉，表现为 Tau 或博客的界面在某些宽度下错乱，而且只在用到你的插件的页面出现。

所以 Tailwind 的类名要加插件专属的前缀，和上面「选择器加插件专属前缀」是同一条规则。Tailwind 4 在导入主题时声明前缀：

```css
/* src/tailwind.css */
@import "tailwindcss/theme.css" layer(theme) prefix(yourname);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
@import "@tau/plugins/tailwind.css";
@source "./";
```

组件里的类名都写成带前缀的形式，前缀写在最前面，变体跟在后面：

```tsx
<div className="yourname:flex yourname:items-center yourname:gap-2 yourname:md:hidden">
  <span className="yourname:text-ink-2 yourname:hover:text-accent">说明</span>
</div>
```

- 前缀只能用小写字母，取插件名的简写即可，如图册用 `ig`。
- 没写前缀的类名不会生成样式，开发时就能看出来。
- 传给 `@tau/ui` 组件的 `className` 也写带前缀的类名；组件自身的样式由 Tau 提供，不受影响。
- 不在 JSX 里的字符串（如 `style={{ overflow: "hidden" }}`、字段名 `kind: "block"`）不会再被当成类名生成多余的样式。

建议在构建脚本里检查编译结果：Tailwind 产物里出现不带前缀的类选择器就报错，避免漏改的配置把通用类名发布出去。

接下来读[页面与入口](pages.md)，把组件放进一个用户能打开的页面。


## 界面语言

为插件提供自己的词典，Tau 会自动传入当前界面语言。组件里的文案用 `t`，交给 Tau 显示的页面、命令和入口标题用 `messages.ref`；用户切换语言时两者都会更新。

创建 `src/locales/zh-CN.json`、`src/locales/zh-TW.json` 和 `src/locales/en-US.json`，文件内容分别为：

```json
{ "title": "阅读列表", "empty": "还没有阅读记录" }
```

```json
{ "title": "閱讀清單", "empty": "還沒有閱讀紀錄" }
```

```json
{ "title": "Reading list", "empty": "No reading history yet" }
```

在入口导入这些文件：

```tsx
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";
import enUS from "./locales/en-US.json";
import { defineI18n, definePlugin, useI18n } from "@tau/plugins";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

const messages = defineI18n({
  fallbackLocale: "zh-CN",
  resources: { "zh-CN": zhCN, "zh-TW": zhTW, "en-US": enUS },
});

function ReadingList() {
  const { t } = useI18n(messages);
  return <p>{t("empty")}</p>;
}

export default definePlugin({
  ...__PLUGIN_META__,
  i18n: messages,
  create: () => ({
    activate(context) {
      const page = context.pages.register({
        id: "reading", title: messages.ref("title"), component: ReadingList,
      });
      context.navigation.registerEntry({ id: "reading", title: messages.ref("title"), page });
    },
  }),
});
```

- `resources` 是语言标签到已导入 JSON 文件的映射。文案放在独立文件中，TypeScript 只负责导入和注册。繁体中文可以使用 `zh-TW`；`zh-HK`、`zh-MO`、`zh-Hant` 会按繁体文字体系匹配。词典使用扁平的字符串 key，key 中的点是普通字符。
- TypeScript 配置启用 `resolveJsonModule`；JSON 会随插件代码打包，用户不需要额外下载词典。
- 词典由插件作者提供，至少包含 `fallbackLocale` 对应的非空词典。缺少用户所选语言或某条文案时，使用插件的默认语言。
- 在文案中写 `{{name}}`，调用 `t("greeting", { name: "Tau" })` 传值。英文数量形式可写 `item_one` 和 `item_other`，调用 `t("item", { count: 2 })`。
- 非 React 动作用 `context.i18n.t(key, values)`。在组件中使用 Hook，使文案随语言刷新；不要在模块顶层把译文存为常量。
- 标题引用支持命令、页面、功能入口、侧栏、设置分区、首页面板及桌面窗口标题。已有字符串表示字面文案。
- `Dialog`、`ConfirmDialog` 和 `Select` 的默认按钮与提示由 Tau 按界面语言提供。显式传入的文案优先使用，插件作者需自行调用 `t` 翻译这些自定义文案。
- 静态编辑器组件同样可以使用 `useI18n(messages)`，无需 activate。插件不必安装翻译库或创建 Provider。
- 文案按文本渲染，不传给 HTML 注入接口。已有笔记、用户自定义名称和协议字段保持原样。

需要使用自己的翻译库时，通过 `usePluginEnvironment().locale` 读取语言，或在非 React 逻辑中使用 `context.environment.locale` 和 `context.environmentChanges.subscribe`。后者返回可手动 dispose 的订阅，也会在插件停用后自动回收。
