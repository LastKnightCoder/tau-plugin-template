# 块的数据版本与协作

用户的文档会同步到多台设备，也可能和别人一起编辑。你的块发布出去以后，旧数据会一直留在用户的文档里，新旧两版插件也可能同时打开同一篇文档。给节点声明数据版本和文本字段，两个人同时改同一段源码时会按字符合并；以后改了数据结构，旧文档里的块也照样能显示和编辑。

## 声明数据版本与文本字段

下面的图表块把源码 `source` 和说明 `caption` 声明为文本字段，封面图 `cover` 声明为资源字段：

```tsx
import { Code } from "lucide-react";
import {
  SourceBlockEditor,
  defineEditorElement,
  defineEditorExtension,
  definePlugin,
  type EditorElementRenderProps,
} from "@tau/plugins";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

interface DiagramElement {
  type: "yourname.diagram";
  source: string;
  caption: string;
  cover?: string;
  children: { type: "formatted"; text: string }[];
}
declare module "@tau/plugins" {
  interface EditorElementMap {
    "yourname.diagram": DiagramElement;
  }
}

function DiagramBlock({
  attributes,
  element,
  children,
}: EditorElementRenderProps<DiagramElement>) {
  return (
    <div {...attributes}>
      <SourceBlockEditor
        element={element}
        field="source"
        mode="text"
        title="图表"
        icon={Code}
      >
        <pre className="yourname-diagram">{element.source}</pre>
      </SourceBlockEditor>
      {children}
    </div>
  );
}

export const diagram = defineEditorElement<DiagramElement>({
  type: "yourname.diagram",
  dataVersion: 1,
  kind: "block",
  isVoid: true,
  collaboration: { textFields: ["source", "caption"] },
  resources: [{ path: "cover", kind: "image" }],
  render: DiagramBlock,
});

export default definePlugin({
  ...__PLUGIN_META__,
  editorExtensions: [
    defineEditorExtension({ id: "yourname.diagram", elements: [diagram] }),
  ],
});
```

图标来自 lucide-react，先 `pnpm add lucide-react`。`SourceBlockEditor` 的用法见[源码预览块](editor-source-media.md#源码预览块)。

| 字段                       | 说明                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `dataVersion`              | 节点数据结构的版本，正整数，从 `1` 开始。和插件的版本号无关                            |
| `collaboration.textFields` | 需要多人同时编辑的字符串字段。两个人同时改源码时按字符合并，而不是后保存的覆盖先保存的 |
| `resources`                | 图片、附件等地址字段，见[声明资源字段](editor-source-media.md#声明资源字段)            |

- `textFields` 只能写节点上的顶层字符串字段，不能和 `resources` 里的字段重叠。
- 没有列进 `textFields` 的字段照常同步，但按整个值更新：对象、数组被同时修改时，后写的覆盖先写的。
- 写了 `collaboration` 或 `previousVersions` 就必须写 `dataVersion`。新写的块从一开始就声明 `dataVersion: 1`。

## 编辑文本字段

列进 `textFields` 的字段，要通过文本句柄修改，不要用 `useElement(element).update` 整段覆盖。

源码字段直接交给 `SourceBlockEditor` 的 `element` + `field`，输入会即时写入并同步，插件不需要自己写回。

自己做输入框时（如上例的说明 `caption`），用 `useTextField` 拿到这个字段的句柄，把 `inputRef` 交给原生的 `<input>` 或 `<textarea>`：

```tsx
import { useTextField } from "@tau/plugins";

function Caption({ element }: { element: DiagramElement }) {
  const caption = useTextField(element, "caption");
  return (
    <>
      <textarea
        ref={caption.inputRef}
        defaultValue={caption.value}
        readOnly={caption.readOnly}
        placeholder="图表说明"
      />
      {caption.error && <p role="alert">说明没有保存：{caption.error}</p>}
    </>
  );
}
```

- `inputRef` 会处理中文输入法、协作者的修改、光标位置、撤销和卸载前保存。不要再给这个输入框传受控的 `value` 和 `onChange`。
- 用的不是原生输入框时，调用 `edit({ offset, remove, text })` 或 `editBatch([...])` 按位置修改。
- `error` 不为空表示修改没有保存成功。这时保留用户的输入并提示，不要关闭编辑界面。
- 预览和编译可以防抖，写入不要防抖。

## 不需要同步的状态

不是所有状态都该写进文档：

| 状态                                       | 放在哪里                                               |
| ------------------------------------------ | ------------------------------------------------------ |
| 文档内容（源码、参数、标题）               | 节点字段                                               |
| 只在本机记住的视图状态（折叠、当前标签页） | `useElement(element)` 的 `view` 和 `updateView(patch)` |
| 临时状态（弹窗是否打开）                   | 组件的 `useState`                                      |
| 编译结果（渲染出的 SVG）                   | 组件内缓存，随时能从源码重新生成                       |

`view` 只保存在这台设备上，重启后还在，但不会同步给协作者，也不会被导出。

## 修改数据结构

只改渲染、菜单或修复 bug 时，不需要提高 `dataVersion`。只新增可选字段（旧数据没有这个字段也能正常显示）时，也不需要提高。

字段改名、源码字段或资源字段变了、已有字段的含义变了时，把 `dataVersion` 加一，并把上一版的声明放进 `previousVersions`。比如图表块把源码字段从 `source` 改名为 `code`：

```tsx
interface DiagramV2 {
  type: "yourname.diagram";
  code: string;
  caption: string;
  cover?: string;
  children: { type: "formatted"; text: string }[];
}

// 文档里两版节点并存，登记为联合类型（替换上文只有 DiagramElement 的登记）
declare module "@tau/plugins" {
  interface EditorElementMap {
    "yourname.diagram": DiagramElement | DiagramV2;
  }
}

function DiagramV2View({
  attributes,
  element,
  children,
}: EditorElementRenderProps<DiagramV2>) {
  return (
    <div {...attributes}>
      <SourceBlockEditor
        element={element}
        field="code"
        mode="text"
        title="图表"
        icon={Code}
      >
        <pre className="yourname-diagram">{element.code}</pre>
      </SourceBlockEditor>
      {children}
    </div>
  );
}

const diagramV2 = defineEditorElement<DiagramV2>({
  type: "yourname.diagram",
  dataVersion: 2,
  kind: "block",
  isVoid: true,
  collaboration: { textFields: ["code", "caption"] },
  resources: [{ path: "cover", kind: "image" }],
  render: DiagramV2View,
  // 上文的 diagram 就是第 1 版
  previousVersions: [{ element: diagram, access: "edit" }],
});

// editorExtensions 里只注册当前版本，第 1 版通过 previousVersions 带上
defineEditorExtension({ id: "yourname.diagram", elements: [diagramV2] });
```

- Tau 不会转换已有的数据。旧文档里的第 1 版节点仍然有 `source` 字段，用 `diagram` 的声明和 `DiagramBlock` 渲染；新插入的节点用第 2 版。
- `access` 决定旧节点能做什么：`edit` 可以继续编辑，`read` 只能看，`none` 只保留数据、显示占位。
- 没有列进 `previousVersions` 的旧版本，数据原样保留，块变成只读的占位，不会交给新版的组件去猜。
- 同一个类型在 `elements` 里只注册当前版本一次，不要把两版并列注册。

块菜单插入新节点时，按当前版本的结构写字段（上例里写 `code` 而不是 `source`）。

### Markdown 与 HTML 导出

`editorCodecs` 和 `htmlSerializers` 的每一项可以带 `dataVersion`，为不同版本的节点分别导出。codec 的写法见[Markdown 导入导出](editor-export.md#markdown-导入导出)：

````ts
import type { EditorMarkdownCodec } from "@tau/plugins";

const fenced = (code: string) => "```diagram\n" + code + "\n```";

const editorCodecs: EditorMarkdownCodec[] = [
  {
    type: "yourname.diagram",
    dataVersion: 1,
    isVoid: true,
    serializer: {
      toMarkdown: (element: DiagramElement) => fenced(element.source),
    },
  },
  {
    type: "yourname.diagram",
    dataVersion: 2,
    isVoid: true,
    serializer: { toMarkdown: (element: DiagramV2) => fenced(element.code) },
    fence: { language: "diagram", property: "code" },
  },
];
````

省略 `dataVersion` 时对应当前版本。导入只用当前版本的语法，旧版本的 codec 只写导出。某个版本没有导出器时，Tau 用自己的扩展格式完整保留这个块。

## 在插件里搬运正文

用[读写正文](document-body.md#读写正文)的接口读写正文时，`context.content.read(ref, { format: "nodes" })` 会同时返回 `nodes` 和 `contracts`。原样写回或复制到别处时，两者一起传回，否则其他插件的块可能变成只读。

读到不认识或读不了的节点时，保留原样，不要用空节点替换。

## 测试

- 新旧两版插件分别打开同一篇文档，旧节点按 `access` 正常显示或只读。
- 两台设备同时编辑同一个源码字段，中文和 emoji 都能正确合并。
- 编辑中切换文档、关闭窗口，输入没有丢失。
- 卸载插件后再装回来，块恢复显示。

白板元素的数据版本与文本字段写法类似，见[白板扩展](whiteboard.md#数据版本)。
