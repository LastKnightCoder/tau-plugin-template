# 块的交互

让你的块用起来和 Tau 自带的图片块一样：点一下选中并描边，上方浮出属性条，右键打开块菜单，按 Delete 删除；再给它配上 `/` 菜单条目、快捷键和快捷语法。整块由组件渲染的块（`isVoid: true`）都应该这样做。

下面接着[第一个块](editor.md)里的计数器：选中后属性条里有「减一」「加一」「更多」，选中时按 `0` 重置，块菜单里有「重置计数」，`Mod+Shift+0` 插入新的计数器，在空段落里输入 `::counter` 回车也能插入。

```tsx
import { Minus, MoreHorizontal, Plus, RotateCcw } from "lucide-react";
import {
  BlockToolbar,
  BlockToolbarButton,
  BlockToolbarGap,
  defineEditorElement,
  defineEditorExtension,
  definePlugin,
  useElement,
  type EditorElementRenderProps,
} from "@tau/plugins";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

interface CounterElement {
  type: "yourname.counter";
  count: number;
  children: { type: "formatted"; text: string }[];
}
declare module "@tau/plugins" {
  interface EditorElementMap {
    "yourname.counter": CounterElement;
  }
}

function Counter({ element }: EditorElementRenderProps<CounterElement>) {
  const { selected, readOnly, update, openMenu } = useElement(element);
  return (
    // 属性条相对最近的定位祖先摆放，所以外层要设 position: relative
    <div className="yourname-counter" style={{ position: "relative" }}>
      {selected && !readOnly && (
        <BlockToolbar label="计数器属性">
          <BlockToolbarButton
            title="减一"
            icon={<Minus size={15} />}
            onClick={() => update({ count: element.count - 1 })}
          />
          <BlockToolbarButton
            title="加一"
            icon={<Plus size={15} />}
            onClick={() => update({ count: element.count + 1 })}
          />
          <BlockToolbarGap />
          <BlockToolbarButton
            title="更多"
            icon={<MoreHorizontal size={15} />}
            onClick={event => {
              const rect = event.currentTarget.getBoundingClientRect();
              openMenu({ x: rect.left, y: rect.bottom + 6 });
            }}
          />
        </BlockToolbar>
      )}
      计数：{element.count}
    </div>
  );
}

export const counterExtension = defineEditorExtension({
  id: "yourname.counter",
  elements: [
    defineEditorElement<CounterElement>({
      type: "yourname.counter",
      dataVersion: 1,
      kind: "block",
      isVoid: true,
      drag: true,
      frame: { keys: { "0": "yourname.counter.reset" } },
      render: Counter,
    }),
  ],
  commands: [
    {
      id: "yourname.counter.insert",
      title: "插入计数器",
      run: editor =>
        editor.insertNode({
          type: "yourname.counter",
          count: 0,
          children: [{ type: "formatted", text: "" }],
        }),
    },
    {
      id: "yourname.counter.reset",
      title: "重置计数",
      // 从菜单或外框按键触发时才有目标块的 path
      run: (editor, { path }) => {
        if (path) editor.setNodes({ count: 0 }, { at: path });
      },
    },
  ],
  hotkeys: [{ key: "mod+shift+0", command: "yourname.counter.insert" }],
  menu: [
    {
      id: "yourname.counter.reset",
      title: "重置计数",
      icon: <RotateCcw size={16} />,
      command: "yourname.counter.reset",
    },
  ],
  behaviorsFor: {
    paragraph: {
      // 段落里只有「::counter」时按回车，换成计数器
      insertBreak: (editor, [, path]) => {
        if (editor.string(path).trim() !== "::counter") return false;
        editor.removeNodes({ at: path });
        editor.insertNodes(
          {
            type: "yourname.counter",
            count: 0,
            children: [{ type: "formatted", text: "" }],
          },
          { at: path }
        );
        return true;
      },
    },
  },
});

export default definePlugin({
  ...__PLUGIN_META__,
  editorExtensions: [counterExtension],
});
```

图标来自 lucide-react，先 `pnpm add lucide-react`。`/` 菜单里的「计数器」条目沿用[第一个块](editor.md)的 `blockPanel`，这里省略了。

## 块的外框

在节点声明上加 `frame`，块就有了 Tau 块的公共交互：点击选中并描边、点到别处取消、右键打开块菜单、选中时 Delete / Backspace 删除块并留下空段落、Esc 取消选中，以及块末尾的「添加段落」。外框只用于 `isVoid: true` 的块。

| 字段              | 说明                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `keys`            | 可选。选中时的按键对应的命令 ID，键名同 `KeyboardEvent.key`（如 `Enter`、`" "`、`"0"`）。命令收到这个节点的 `element` 和 `path`，同菜单里的命令 |
| `appendParagraph` | 可选。为 `false` 时不显示末尾的「添加段落」                                                                                                     |

声明外框后，`render` 只渲染内容：收到的 `attributes` 是空对象、`children` 为空，交给外框处理，所以上例的 `Counter` 不需要展开 `attributes`。组件里用 `useElement(element).selected` 决定是否显示属性条。

外框会接管块内的单击用于选中。块里自己的按钮放进属性条，或者像图册那样只在只读时响应单击、编辑时改用双击。

## 块的属性条

选中块后浮在块上方的属性条，用 `BlockToolbar`、`BlockToolbarButton`、`BlockToolbarGap` 组成，外观和 Tau 自带的图片块一致。上方放不下时自动翻到下方，点击按钮不会让编辑器失去光标。

- 属性条按最近的定位祖先摆放，渲染它的容器要设 `position: relative`。上例写在 `style` 里；用 Tailwind 时写带前缀的类名（如 `yourname:relative`），不带前缀的 `relative` 不会生成样式，见[用 Tailwind 时加前缀](ui-components.md#用-tailwind-时加前缀)。
- `BlockToolbar` 的 `label` 是属性条的无障碍名称。
- `BlockToolbarButton` 的 `title` 是按钮名称（纯图标按钮悬停时显示），`label` 是显示在图标旁的文字，`shortcut` 在提示里显示快捷键，`active` 表示当前选中的选项。
- `BlockToolbarGap` 在按钮之间加一道分隔。
- 「更多」按钮调用 `openMenu`，打开的就是右键时的块菜单，条目来自下文的 `menu`。

## 扩展能声明的内容

`defineEditorExtension` 接收：

| 字段              | 说明                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `id`              | 扩展 ID，全局唯一                                                                             |
| `elements`        | 节点声明，至少一个                                                                            |
| `blockPanel`      | 块菜单（`/` 菜单）中的条目                                                                    |
| `commands`        | 编辑器命令                                                                                    |
| `hotkeys`         | 快捷键，绑定到命令                                                                            |
| `menu`            | 块的手柄菜单和右键菜单中的条目                                                                |
| `behaviorsFor`    | 挂在其他节点类型上的行为，用来实现快捷语法                                                    |
| `styleSources`    | 节点里的 Tailwind 源码字段，见[动态 Tailwind 样式](editor-source-media.md#动态-tailwind-样式) |
| `htmlSerializers` | 静态 HTML 导出，见 [HTML 导出](editor-export.md#html-导出)                                    |

只能写以上字段。写了其他字段，类型检查会报错，Tau 也不会读取它们。

### 块菜单

`blockPanel` 的每一项会出现在用户输入 `/` 后弹出的菜单里：

| 字段          | 说明                                                                |
| ------------- | ------------------------------------------------------------------- |
| `id`          | 可选。条目的稳定身份，使用插件命名空间，如 `example.counter.insert` |
| `group`       | 可选。要并入的顶层条目 id，分组与标题和界面语言无关                 |
| `icon`        | 图标组件，接收 `className`                                          |
| `title`       | 标题                                                                |
| `description` | 说明                                                                |
| `keywords`    | 搜索关键词，用户输入这些词时会匹配到这一项                          |
| `onClick`     | 选中时调用，收到当前编辑器，通常用来插入节点                        |
| `children`    | 可选。子菜单                                                        |

`onClick` 收到的 `editor` 提供 `insertNode`、`setNodes`、`removeNodes` 等编辑器方法。插入后需要立即编辑的源码类块，用 `insertSourceBlock`，见[源码预览块](editor-source-media.md#源码预览块)。

`blockPanel` 也可以是一个函数 `(editor) => items`，每次打开菜单时求值。

要把插入项放到内置「图片」菜单，把它的 `group` 配置为 `"tau.image"`。自己的分组可以先声明一个带 `id` 和 `children` 的父条目，再让其他条目的 `group` 指向它。父条目本身也有插入动作时，这个动作会保留为分组内的一个子项。分组目标未安装、id 重复或分组关系成环时，条目保持独立显示，不按标题猜测归属；重复 id 会记录诊断。未配置 `group` 的条目按原声明显示。

### 命令与快捷键

命令是编辑器里的动作，快捷键、菜单和外框按键都通过命令 ID 触发它。上例的「插入计数器」由快捷键触发，「重置计数」由菜单和选中时的 `0` 键触发。

| 命令字段 | 说明                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`     | 命令 ID，全局唯一，建议以扩展 ID 作前缀                                                                                                                       |
| `title`  | 可选。显示名称                                                                                                                                                |
| `when`   | 可选。`(editor) => boolean`，返回 `false` 时快捷键跳过、菜单项变灰                                                                                            |
| `run`    | `(editor, context) => void`。`context` 包含触发它的 `event`、调用方的 `payload`；从菜单或外框按键触发时还有目标节点 `element` 和它的 `path`，快捷键触发时没有 |

| 快捷键字段 | 说明                                                                             |
| ---------- | -------------------------------------------------------------------------------- |
| `key`      | 按键组合，如 `"mod+shift+k"`，`mod` 在 macOS 上是 ⌘，其他系统是 Ctrl；可以传数组 |
| `command`  | 要执行的命令 ID                                                                  |
| `fallback` | 可选。为 `true` 时只在其他扩展的快捷键都没有处理时才尝试                         |

快捷键针对的是光标位置，不知道是哪个块。要对某个块操作的命令，交给菜单或外框按键触发，或者在命令里根据光标位置自己查找节点。

命令执行出错时，Tau 会隔离错误，不影响编辑器的其他功能。异步命令返回 Promise 即可。

### 菜单

`menu` 中的条目出现在你的块的手柄菜单和右键菜单里：

| 字段             | 说明                                                           |
| ---------------- | -------------------------------------------------------------- |
| `id`             | 条目 ID，同一份菜单内唯一                                      |
| `title`          | 标题，可以是函数 `(ctx) => string`，打开菜单时求值             |
| `icon`           | 可选。图标元素（如 `<RotateCcw size={16} />`），同样可以是函数 |
| `command`        | 点击时执行的命令 ID；只有子菜单的父条目可以省略                |
| `payload`        | 可选。传给命令的参数，命令在 `context.payload` 中读取          |
| `when`           | 可选。返回 `false` 时不显示这一项                              |
| `disabled`       | 可选。返回 `true` 时这一项变灰                                 |
| `group`、`order` | 可选。分组与排序                                               |
| `danger`         | 可选。危险操作，以警示色显示                                   |
| `children`       | 可选。子菜单                                                   |

函数形式的字段收到 `{ editor, element, path }`，即菜单针对的块。

### 行为

`behaviors` 写在节点声明里，在光标位于该节点内时接管按键：

| 行为                                         | 时机               |
| -------------------------------------------- | ------------------ |
| `insertBreak(editor, [node, path])`          | 按回车             |
| `deleteBackward(editor, [node, path], unit)` | 按退格             |
| `insertText(editor, [node, path], text)`     | 输入文字           |
| `normalize(editor, [node, path])`            | 编辑器规范化节点时 |

每个函数返回 `true` 表示已经处理，返回 `false` 交给外层节点和默认行为。

`behaviorsFor` 写在扩展上，把行为挂到**其他**节点类型上。典型用途是快捷语法：上例在段落上挂了 `insertBreak`，段落文字是 `::counter` 时按回车，把段落换成计数器。

`editor` 上的 `string`、`removeNodes`、`insertNodes`、`setNodes` 等方法直接可用，不需要另外安装或打包编辑器库。

## 在正文中标出文字

桌面主窗口提供 `context.textDecorations`。在插件的 `activate(context)` 中注册，旧版或其他宿主可用可选链判断支持情况。下面的示例把文章里的「回顾」标出来，点击后打开最近更新的一篇带「复盘」标签的文章。先在 manifest 的 `permissions` 声明 `articles:read`。

```ts
if (!context.textDecorations) return;
const { items } = await context.data.articles.query({ tag: "复盘", limit: 1 });
const target = items[0];
if (!target) return;

const marks = await context.textDecorations.register({
  sources: ["article"],
  getDecorations({ text, source }) {
    if (source.id === target.id) return [];
    return Array.from(text.matchAll(/回顾/g), hit => ({
      start: hit.index,
      end: hit.index + hit[0].length,
      appearance: "reference" as const,
      key: target.id,
      label: `打开文章《${target.title}》`,
    }));
  },
  getPreview({ key }) {
    return { ref: { kind: "article", id: key } };
  },
  async onActivate({ key }) {
    await context.app.open({ kind: "article", id: key });
  },
});
```

在 `sources` 里选择卡片（`card`）、文章（`article`）、项目文档（`document`），并声明各来源的读取权限。每个返回项用 `appearance` 选择外观，按打扰程度从低到高：

| 外观        | 样子                               | 适合                     |
| ----------- | ---------------------------------- | ------------------------ |
| `dot`       | 文字不变，末尾一个小圆点           | 极简、行距紧             |
| `ghost`     | 点线很淡，悬停或按住 ⌘/Ctrl 才显出 | 识别量很大、不想打扰阅读 |
| `reference` | 正文色文字加点线，悬停变成实线     | 引用、跳转，推荐默认     |
| `tint`      | 只改字色                           | 表格、密集文本           |
| `marker`    | 文字下沿的荧光笔底色，悬停铺满     | 想一眼扫出结果           |
| `wavy`      | 波浪下划线                         | 提醒、待确认             |

`dot`、`ghost`、`reference` 表示可以点击，必须提供字符串 `key` 和 `onActivate`，否则不显示。其余外观省略 `key` 即可只用于阅读。外观都用背景或伪元素绘制，用户自己加的下划线、删除线保持不变（`wavy` 除外）。

`tone` 选择颜色：`accent`（默认，跟随主题强调色）、`info`、`warn`、`muted`。颜色取自当前主题，深浅模式自动适配，不能传自定义颜色。`label` 是悬停约 0.4 秒后出现的提示，Tau 会在后面附上插件名。

可选的 `getPreview({ key, source, choice }, signal)` 在指针停留约 450 毫秒后调用，可以同步或异步返回 `{ ref: { kind, id }, at?: { block } }`。其中 `kind` 支持 `card`、`article` 和 `document`。Tau 校验目标读取权限并显示与内容引用相同的只读预览卡；提供 `at` 时从该顶层块开始预览，「打开」也会定位到它。插件需要预先声明并获得目标类型的读取权限。

单一目标可直接返回。命中多个目标时，首次悬停返回 `undefined`，使用 `label` 提示；用户点击打开候选菜单，再悬停某一项时，`choice` 是该项的 key。离开、切换目标、注销或内容失效会取消旧请求。悬停与点击分别处理，预览不会执行 `onActivate`。

`onActivate` 返回候选数组 `[{ key, title, description? }]` 时，Tau 在文字旁弹出菜单。用户选中后再次调用 `onActivate`，并在 `choice` 中传入选中的 `key`。处理中文字会变淡，抛出的错误以提示条显示。

`getDecorations({ source, blockType, text }, signal)` 可以返回范围数组或 Promise。偏移按 JavaScript 字符串下标计算，包含起点、排除终点。同一块内相邻的普通文字与粗体连续传入，链接、行内代码、嵌套块等会切断文本。请自行消解本次结果中的重叠；同一批存在重叠时，这个提供方的该批结果会被忽略。不同插件发生冲突时优先起点较前的范围，同起点按注册顺序。

主窗口按需计算靠近视口的正文并在编辑停顿后更新，移动光标和普通重绘复用结果。可以直接返回与当前来源、正文和配置一致的预计算结果，或在 Worker 中匹配并响应取消信号。文字变化、资料库切换和插件停用会使旧请求失效。

插件的匹配规则、词表或外观设置变化时，调用 `marks.invalidate()`；只影响一篇时调用 `marks.invalidate({ source })`。主动移除这组装饰用 `marks.dispose()`。

## 下一步

- [源码块与媒体块](editor-source-media.md)：做「源码 + 预览」的块，或在块里显示图片、视频、音频。
- [导出与字数统计](editor-export.md)：让计数器参与 Markdown、HTML 导出。
