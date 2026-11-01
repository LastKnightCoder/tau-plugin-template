# 导出与字数统计

用户把文档导出为 Markdown、HTML、EPUB，复制为 Markdown 或 HTML，或者查看正文字数时，Tau 不知道你的块该变成什么。在插件定义上声明转换规则，你的块就能以自己的格式导出、从 Markdown 导入，块里的文字也计入字数。不声明时块的数据照样保留，只是其他工具未必认识。

下面接着[第一个块](editor.md)里的计数器，让它导出为 Markdown 指令 `::yourname-counter{count=3}` 和一段静态 HTML：

```tsx
import {
  defineEditorElement,
  defineEditorExtension,
  definePlugin,
  type EditorElementRenderProps,
  type EditorMarkdownCodec,
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

const Counter = ({
  attributes,
  element,
  children,
}: EditorElementRenderProps<CounterElement>) => (
  <div {...attributes}>
    <span contentEditable={false}>计数：{element.count}</span>
    {children}
  </div>
);

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const counterExtension = defineEditorExtension({
  id: "yourname.counter",
  elements: [
    defineEditorElement<CounterElement>({
      type: "yourname.counter",
      dataVersion: 1,
      kind: "block",
      isVoid: true,
      render: Counter,
    }),
  ],
  htmlSerializers: [
    {
      type: "yourname.counter",
      toHtml: (element) => `<p>计数：${escapeHtml(String(element.count))}</p>`,
    },
  ],
});

const counterCodec: EditorMarkdownCodec = {
  type: "yourname.counter",
  isVoid: true,
  // 导出：节点 → Markdown
  serializer: {
    toMarkdown: (element: CounterElement) =>
      `::yourname-counter{count=${element.count}}`,
  },
  // 导入：Markdown → 节点
  directives: {
    "yourname-counter": (attributes) => ({
      type: "yourname.counter",
      count: Number(attributes.count) || 0,
      children: [{ type: "formatted", text: "" }],
    }),
  },
};

export default definePlugin({
  ...__PLUGIN_META__,
  editorExtensions: [counterExtension],
  editorCodecs: [counterCodec],
});
```

## Markdown 导入导出

在插件定义上提供 `editorCodecs`，你的块就能参与 Markdown 导入导出、复制为 Markdown 和搜索摘要。没有 codec 的块在导出 Markdown 时会以 Tau 的扩展格式保留，其他工具未必认识。

| 字段         | 说明                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| `type`       | 对应的节点类型，只能是本插件声明的类型                                                                  |
| `serializer` | 导出。`toMarkdown(element, childrenMarkdown)` 返回 Markdown 字符串                                      |
| `directives` | 导入。按 directive 名（`::name{...}`、`:::name`、`:name[...]`）解析成节点，返回 `null` 表示丢弃         |
| `fence`      | 导入。把指定语言的代码围栏（如 `mermaid` 代码块）认领为节点，源码放进 `property` 字段（默认 `content`） |
| `isVoid`     | 节点是 void 时设为 `true`                                                                               |

- 导入和导出要成对设计：只写 `serializer` 不会自动获得导入能力。
- `editorCodecs` 会在没有界面的环境中单独加载，必须是纯函数。模块顶层不要访问 `window`、`document`。
- 源码类的块（如[源码预览块](editor-source-media.md#源码预览块)）适合导出为代码围栏，再用 `fence` 认领同一种语言，导入导出就对上了。
- [编译与转换服务](services.md#自定义节点)转换 Markdown 时，也可以传入同样格式的 codec。
- 修改过数据结构的块，可以为每个版本分别写导出，见[块的数据版本与协作 · Markdown 与 HTML 导出](editor-collaboration.md#markdown-与-html-导出)。

## HTML 导出

用户把文档导出为 HTML、EPUB 或复制为 HTML 时，你的块默认按未知节点处理，交互组件不会执行。需要更好的导出效果时，在扩展上提供 `htmlSerializers`，如上例的计数器导出为一段 `<p>`。

- `toHtml(element)` 返回 HTML 字符串。节点里的文字要自己转义，上例的 `escapeHtml` 就是做这个的。
- 它只用于静态导出，博客里的显示仍然使用 `render`。

## 字数统计

Tau 统计正文字数时，会自动计入普通段落和 `children` 里的文字。块的文字存在自定义字段里（如题目、源码）时，在插件定义上用 `editorMetrics` 声明哪些字段计入字数。计数器没有文字，写 `textFields: []`；一个题目块把题干和答案计入字数：

```ts
import type { EditorMetricRule } from "@tau/plugins";

const editorMetrics = [
  { type: "yourname.quiz", textFields: ["question", "answers[].text"] },
  { type: "yourname.counter", textFields: [] },
] as const satisfies readonly EditorMetricRule[];

// 加进上例的插件定义
export default definePlugin({
  ...__PLUGIN_META__,
  editorExtensions: [counterExtension, quizExtension],
  editorCodecs: [counterCodec],
  editorMetrics,
});
```

- `textFields` 里写字段路径，`answers[].text` 表示 `answers` 数组每一项的 `text`。缺失或不是字符串的字段不计数。题目「天空是什么颜色」、答案「蓝色」合计 9 字。
- 只声明正文，不声明 ID、地址、编译结果这类字段。纯图片这类没有文字的块写 `textFields: []`。
- `children` 里的文字已经自动计入，不要再声明 `children[].text`，否则会重复统计。
- 只能声明本插件的节点类型，每个类型声明一次。规则是纯数据，不能写函数。

正文不在 `children` 里、而在别的字段里放着一组子节点时（如折叠列表把隐藏的内容放在 `allContent`），用 `additionalChildren` 告诉 Tau 去哪里找：

```ts
{
  type: "yourname.folded-list",
  textFields: [],
  additionalChildren: [{ path: "allContent", when: "isFold", skip: 1 }],
}
```

`path` 是子节点或子节点数组所在的字段；`when` 指定一个布尔字段，为 `true` 时才计入；`skip` 跳过开头几项。新设计的块尽量把正文都放进 `children`，用不到这项。

字数为 0 不代表文档是空的：只有图片、分割线的文档字数也是 0。不要用字数判断一篇正文能否删除或复用。块内按退格、方向键时怎样算「空块」，由节点声明的 `isEmpty` 决定，与字数统计无关。

## 下一步

发布后要改块的数据结构，或让多人同时编辑块里的文字，读[块的数据版本与协作](editor-collaboration.md)。
