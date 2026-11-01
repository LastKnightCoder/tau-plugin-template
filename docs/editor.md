# 第一个块

在 Tau 的文档里加一种自己的块：图表、公式、乐谱、可交互的组件。块的数据随文档保存、同步和发布，桌面、手机和用户发布的博客使用同一份渲染代码。

## 第一个块：计数器

### 1. 定义节点和扩展

```tsx
import { useState } from "react";
import {
  definePlugin,
  defineEditorElement,
  defineEditorExtension,
} from "@tau/plugins";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

// 节点的数据结构：除了 type 和 children，其余字段都会随文档保存
interface CounterElement {
  type: "yourname.counter";
  count: number;
  children: { type: "formatted"; text: string }[];
}

// 登记节点类型，让 TypeScript 认识它
declare module "@tau/plugins" {
  interface EditorElementMap {
    "yourname.counter": CounterElement;
  }
}

function Counter({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  return (
    <div className="yourname-counter" contentEditable={false}>
      <button
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setCount((n) => n + 1)}
      >
        计数：{count}
      </button>
    </div>
  );
}

function CounterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 12h10M12 7v10" />
    </svg>
  );
}

export default definePlugin({
  ...__PLUGIN_META__,
  editorExtensions: [
    defineEditorExtension({
      id: "yourname.counter",
      elements: [
        defineEditorElement<CounterElement>({
          type: "yourname.counter",
          dataVersion: 1,
          kind: "block",
          isVoid: true,
          drag: true,
          render: ({ attributes, element, children }) => (
            <div {...attributes}>
              <Counter initial={element.count} />
              {children}
            </div>
          ),
        }),
      ],
      blockPanel: [
        {
          icon: CounterIcon,
          title: "计数器",
          keywords: ["counter", "计数"],
          description: "一个可以点击计数的块",
          onClick: (editor) =>
            editor.insertNode({
              type: "yourname.counter",
              count: 0,
              children: [{ type: "formatted", text: "" }],
            }),
        },
      ],
    }),
  ],
});
```

manifest 的 `categories` 里加上 `"editor"`，插件中心会把它归到「编辑器」分类。`dataVersion` 是节点数据结构的版本，新写的块从 `1` 开始，以后改数据结构时怎么提高见[块的数据版本与协作](editor-collaboration.md)。

### 2. 构建、安装、重启

`pnpm build` 并安装后，**完全退出并重新打开 Tau**。编辑器扩展在启动时装配，启用、停用和更新都要重启才生效。之后在文档里输入 `/计数器`，就能插入这个块。

这个只有编辑器扩展的插件没有写 `create`。如果插件还需要命令、页面或设置，照常提供 `create` 和 `activate`，两者可以共存。

点几下按钮，再刷新或重新打开这篇文档，计数会回到 0：点击只改了组件状态，没有写进文档。下一节说明两者的区别，[修改节点字段](#修改节点字段)把计数改成随文档保存。

## 节点

节点是文档里的一块数据。你定义它的结构，Tau 负责保存、复制、撤销和协作。

### 节点数据与组件状态

- **节点字段**（例子中的 `count`）是文档内容，会随文档保存、同步、发布。
- **组件状态**（例子中的 `useState`）只是这一次显示的状态，刷新后就没了。

需要持久保存的东西放进节点字段。不要把文档内容放进插件的私有存储，那样复制、导出、发布时都会丢失。只想在这台设备上记住的视图状态（折叠、当前标签页），见[不需要同步的状态](editor-collaboration.md#不需要同步的状态)。

### 节点类型的命名

节点 `type` 和扩展 `id` 在所有插件之间必须唯一，建议用你的插件 ID 作前缀，例如 `yourname.counter`、`yourname.chart`。一旦有文档用了这个类型，就不要再改名，否则已有的块会失效。

### 节点的声明

| 字段            | 说明                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `type`          | 节点类型                                                                                                     |
| `kind`          | `"block"`（块级）或 `"inline"`（行内）                                                                       |
| `render`        | 渲染组件，见下文                                                                                             |
| `dataVersion`   | 节点数据结构的版本，正整数，从 `1` 开始，见[块的数据版本与协作](editor-collaboration.md)                     |
| `isVoid`        | 可选。为 `true` 时节点没有可编辑的文字，内容完全由组件渲染（如图表、演示）                                   |
| `drag`          | 可选。为 `true` 时显示拖动手柄，用户可以拖动这个块。不声明就不能拖动                                         |
| `isEmpty`       | 可选。判断节点是否为空。内容保存在自定义字段（如源码）里时，用它告诉 Tau 什么情况下算空块                    |
| `frame`         | 可选。点选、右键菜单、删除这些块的公共交互，见[块的外框](editor-interactions.md#块的外框)                    |
| `behaviors`     | 可选。光标在节点内时，接管回车、退格、输入等行为，见[行为](editor-interactions.md#行为)                      |
| `resources`     | 可选。节点里哪些字段是图片、视频、音频或文件，见[声明资源字段](editor-source-media.md#声明资源字段)          |
| `collaboration` | 可选。需要多人同时编辑的文字字段，见[声明数据版本与文本字段](editor-collaboration.md#声明数据版本与文本字段) |

### 渲染组件

`render` 组件收到三个属性：`attributes`、`element`、`children`。计数器的写法：

```tsx
render: ({ attributes, element, children }) => (
  <div {...attributes}>
    <Counter initial={element.count} />
    {children}
  </div>
),
```

- `attributes` 必须展开到最外层元素上，`children` 必须渲染出来。即使是 `isVoid` 节点也一样，这是编辑器追踪光标所需要的。
- 组件里不可编辑的部分加上 `contentEditable={false}`。
- 组件里的按钮在 `onMouseDown` 中调用 `event.preventDefault()`，避免点击时编辑器失去光标。

### 修改节点字段

让计数随文档保存，就在点击时把新值写回节点。用 `useElement` 返回的 `update`，并把渲染组件换成下面这个：

```tsx
import { useElement, type EditorElementRenderProps } from "@tau/plugins";

function Counter({ element }: { element: CounterElement }) {
  const { readOnly, update } = useElement(element);
  return (
    <div className="yourname-counter" contentEditable={false}>
      <button
        disabled={readOnly}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => update({ count: element.count + 1 })}
      >
        计数：{element.count}
      </button>
    </div>
  );
}

const renderCounter = ({
  attributes,
  element,
  children,
}: EditorElementRenderProps<CounterElement>) => (
  <div {...attributes}>
    <Counter element={element} />
    {children}
  </div>
);
```

节点声明里写 `render: renderCounter`。`update` 把传入的字段合并进节点，这次修改会进入撤销记录并同步给协作者；刷新后计数还在。

`useElement(element)` 返回：

| 字段                 | 说明                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `readOnly`           | 编辑器是否只读。只读时 `update`、`remove` 不会写入                                           |
| `update(properties)` | 把字段合并进节点                                                                             |
| `remove()`           | 删除节点                                                                                     |
| `view`、`updateView` | 只在这台设备上记住的视图状态，见[不需要同步的状态](editor-collaboration.md#不需要同步的状态) |
| `selected`           | 声明了[外框](editor-interactions.md#块的外框)的块是否被点选                                  |
| `select()`           | 选中外框里的块                                                                               |
| `openMenu(position)` | 在指定位置（视口坐标）打开块菜单，条目与右键、块手柄相同；需要外框                           |

请始终传入当前渲染拿到的 `element`。节点被替换或组件卸载后，旧对象上的写入会被忽略，不会改到别的块。

## 块会在哪里显示

- **Tau 桌面和手机**的编辑器。插件声明了 `android`、`ios` 时，手机上安装插件后就能插入和编辑你的块，触摸上的适配见[多端适配 · 编辑器块](portability.md#编辑器块)。
- **用户发布的博客**。博客使用同一个 `render` 组件，你不需要另写一份。

没有安装插件的设备和浏览器扩展里，块的数据原样保留，显示为一个通用的占位。

因为同一份代码要在博客里运行，渲染相关的代码需要满足：

- 模块顶层和渲染组件只使用浏览器能力，不导入 Node.js 模块。
- 不依赖 `activate` 里才赋值的变量，也不使用 `context`：博客里没有插件运行时，存储、页面这些接口都不存在。需要编译服务时，用 [`usePluginServices`](services.md#在编辑器块中使用服务)，并处理拿不到服务的情况。
- JS 和 CSS 自包含：React、`@tau/plugins`、`@tau/ui` 由 Tau 提供，其他依赖会被打进 `main.js`；图片等资源内联。
- 样式用插件自己的类名前缀，不修改 `body` 或 Tau 自身元素的样式。用 Tailwind 时同样要加前缀，见[用 Tailwind 时加前缀](ui-components.md#用-tailwind-时加前缀)；博客模板也是 Tailwind 写的，不加前缀的工具类会让含你的块的页面排版错乱。

博客里的文档是只读的，但组件自身的交互（按钮、缩放图表）照常可用；在只读文档里修改节点字段不会被保存。改成[随文档保存](#修改节点字段)的计数器在博客里按钮是禁用的，只显示发布时的计数。

在博客里，接口的行为有这些不同：

| 接口                                       | 在博客中                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `useElement`                               | `readOnly` 为 `true`；`selected` 始终为 `false`，按它显示的属性条不会出现 |
| `MediaImage` / `MediaVideo` / `MediaAudio` | 与博客里 Tau 自带的图片、视频、音频块显示方式相同                         |
| `useResource`                              | 原样返回节点里的地址                                                      |
| `useResourceUpload`                        | `undefined`，界面里应隐藏上传入口                                         |
| `useMediaAppearance`                       | 取用户在发布设置里配置的图片外观                                          |
| `useMediaViewer`                           | 打开博客里的图片查看器，浏览这篇正文里的全部图片                          |
| `frame` 外框                               | 只保留显示，不能选中、删除，也没有右键菜单和「添加段落」                  |

## 停用与卸载

- 插件停用后，文档里已有的块会保留，显示为「不可用」的占位，不会被删除；重新启用后恢复显示。
- 卸载正在使用的编辑器插件前，需要先停用并重启 Tau。

## 下一步

- [块的交互](editor-interactions.md)：给计数器加上点选、属性条、右键菜单和快捷键。
- [源码块与媒体块](editor-source-media.md)：做「源码 + 预览」的块，或在块里显示图片、视频、音频。
- [导出与字数统计](editor-export.md)：让块参与 Markdown、HTML 导出和字数统计。
