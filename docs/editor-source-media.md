# 源码块与媒体块

用户写一段源码、下方实时显示结果的块（图表、公式、乐谱、组件演示），用 `SourceBlockEditor` 套上 Tau 统一的源码编辑外壳，不必从头写编辑交互。块里要显示图片、视频、音频时，用 Tau 的媒体组件，本地文件、远程地址和共享文档里的资源都能正确加载。节点的基本写法见[第一个块](editor.md)。

## 源码预览块

`SourceBlockEditor` 提供源码编辑、错误提示、删除，以及与相邻块之间的光标移动。源码字段经 `field` 绑定，输入即时写入节点并进入撤销记录，协作时按字符合并；插件不需要自己写回源码。

下面是一个格式化显示 JSON 的块：

```tsx
import { Braces } from "lucide-react";
import {
  SourceBlockEditor,
  defineEditorElement,
  defineEditorExtension,
  definePlugin,
  insertSourceBlock,
  sourceBlockParagraphBehavior,
  useReportPreviewError,
  type EditorElementRenderProps,
} from "@tau/plugins";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

interface JsonElement {
  type: "yourname.json";
  content: string;
  children: { type: "formatted"; text: string }[];
}
declare module "@tau/plugins" {
  interface EditorElementMap {
    "yourname.json": JsonElement;
  }
}

function parse(source: string) {
  if (!source.trim()) return { text: "", error: null };
  try {
    return { text: JSON.stringify(JSON.parse(source), null, 2), error: null };
  } catch (error) {
    return { text: "", error: (error as Error).message };
  }
}

function JsonPreview({ source }: { source: string }) {
  const { text, error } = parse(source);
  // 在源码块里由块统一显示错误；返回 false 时（如博客里）自己显示
  const shownByBlock = useReportPreviewError(error);
  if (error) return shownByBlock ? null : <p>{error}</p>;
  return <pre className="yourname-json">{text}</pre>;
}

function JsonBlock({
  attributes,
  element,
  children,
}: EditorElementRenderProps<JsonElement>) {
  return (
    <div {...attributes}>
      <SourceBlockEditor
        element={element}
        field="content"
        mode="javascript"
        title="JSON"
        icon={Braces}
      >
        <JsonPreview source={element.content} />
      </SourceBlockEditor>
      {children}
    </div>
  );
}

export default definePlugin({
  ...__PLUGIN_META__,
  editorExtensions: [
    defineEditorExtension({
      id: "yourname.json",
      elements: [
        defineEditorElement<JsonElement>({
          type: "yourname.json",
          dataVersion: 1,
          // field 绑定的字段必须声明为文本字段
          collaboration: { textFields: ["content"] },
          kind: "block",
          isVoid: true,
          drag: true,
          isEmpty: (element) => !element.content,
          render: JsonBlock,
        }),
      ],
      blockPanel: [
        {
          icon: Braces,
          title: "JSON",
          keywords: ["json"],
          description: "格式化显示一段 JSON",
          onClick: (editor) => {
            insertSourceBlock(editor, {
              type: "yourname.json",
              content: "",
              children: [{ type: "formatted", text: "" }],
            });
          },
        },
      ],
      behaviorsFor: {
        paragraph: sourceBlockParagraphBehavior("yourname.json"),
      },
    }),
  ],
});
```

`icon` 需要一个 lucide-react 图标，先 `pnpm add lucide-react`。`attributes` 展开在最外层，`children` 渲染在 `SourceBlockEditor` 外面，规则同[渲染组件](editor.md#渲染组件)。

| `SourceBlockEditor` 属性 | 说明                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `element`                | 当前节点                                                                                            |
| `field`                  | 存源码的字段名，需在节点的 `collaboration.textFields` 中声明                                        |
| `mode`                   | 源码的语言，用于语法高亮，如 `javascript`、`htmlmixed`、`stex`、`typst`；没有对应语法时按纯文本显示 |
| `title`、`icon`          | 块的名称和图标，显示在编辑标题、空块占位和手机配件栏上                                              |
| `center`、`extend`       | 可选。预览内容居中；预览区上下多留一点空间                                                          |
| `children`               | 预览内容                                                                                            |

桌面上，点块上的「编辑」在块内展开源码，下方实时预览。手机上，正文只显示预览：点一下选中块，配件栏给出「编辑」「复制」和块操作，「编辑」打开上方预览、下方源码的源码页；预览比屏幕宽时在块内横向滚动。两端的交互都由 Tau 提供，插件只需提供预览，不要在块上自己放编辑按钮。

相关工具：

| 接口                                        | 用途                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useSourceBlock(element)`                   | 返回 `update`（修改节点字段）、`theme`（当前主题）和 `compiler`（Tailwind 编译器，可能为空）                                                                 |
| `useReportPreviewError(message, { stale })` | 预览出错时上报错误，传 `null` 清除；`stale` 表示是否保留了上一次成功的预览。在源码预览块内由块统一显示错误，返回 `false`（不在块内，如博客）时预览需自己显示 |
| `insertSourceBlock(editor, element, line?)` | 插入节点并打开源码编辑（桌面在块内，手机打开源码页），适合在块菜单的 `onClick` 中使用                                                                        |
| `sourceBlockParagraphBehavior(type)`        | 放进 `behaviorsFor.paragraph`，让用户在段首按退格时进入上方的源码块                                                                                          |

`theme.isDark` 表示当前是否为暗色主题，`theme.token(word)` 读取主题色值，预览应随主题变化。`compiler` 只在桌面编辑器中可用，在博客里为空，此时配合下文的 `styleSources` 使用预先生成的样式。

不要在插件里打包自己的编辑器、Slate 或源码编辑器，直接使用这些组件。

## 行内源码

行内的源码节点（如行内公式）声明 `kind: "inline"`，类型登记在 `EditorInlineElementMap` 里，并使用另一组接口：

| 接口                                  | 用途                                                          |
| ------------------------------------- | ------------------------------------------------------------- |
| `useInlineSource(element)`            | 返回 `readOnly`、`compiler`、`update(properties)`、`remove()` |
| `insertInlineSource(editor, element)` | 插入行内节点，适合在菜单中使用                                |
| `InlineSourceBoundary`                | 渲染在行内节点组件里，处理光标进出节点的边界                  |

行内的源码输入弹层由你用 `@tau/ui` 组件实现。只读时只显示预览，不打开编辑弹层；只读状态下 `update` 和 `remove` 不会写入文档。

## 动态 Tailwind 样式

如果节点的源码里写了 Tailwind 类名（比如用户写的组件演示），在扩展上声明哪个字段是源码：

```ts
defineEditorExtension({
  id: "yourname.demo",
  elements: [demoElement],
  styleSources: [{ type: "yourname.demo", field: "content", language: "tsx" }],
});
```

桌面编辑器里用 `useSourceBlock(element).compiler` 实时编译；在博客等不能实时编译样式的地方，Tau 会读取这些字段，提前生成对应的样式。

- 字段的值必须是字符串，`language` 为 `html` 或 `tsx`，只能登记本插件的节点类型。
- 类名要完整地写在源码里。拼接出来的类名（如 `` `bg-${color}` ``）扫描不到。

这里说的是用户写在节点里的类名。插件自己组件里的 Tailwind 类名由你在构建时编译，并要加前缀，见[用 Tailwind 时加前缀](ui-components.md#用-tailwind-时加前缀)。

## 图片、视频与音频

节点里存的图片、视频、音频地址可能是本地路径、远程地址或共享文档里的资源，不能直接交给 `<img>`。用 Tau 提供的媒体组件显示，解析方式与 Tau 自带的图片块相同：本地路径转成可加载的地址，远程资源按用户的缓存设置下载，共享文档里的资源照常加载。

下面的照片块显示一张图片，没有图片时让用户选择文件上传，双击打开图片查看器：

```tsx
import type { ChangeEvent } from "react";
import {
  MediaImage,
  defineEditorElement,
  useElement,
  useMediaAppearance,
  useMediaViewer,
  useResourceUpload,
  type EditorElementRenderProps,
  type MediaAppearancePreset,
} from "@tau/plugins";

interface PhotoElement {
  type: "yourname.photo";
  url: string;
  caption: string;
  borderRadius?: MediaAppearancePreset;
  children: { type: "formatted"; text: string }[];
}
declare module "@tau/plugins" {
  interface EditorElementMap {
    "yourname.photo": PhotoElement;
  }
}

const RADIUS: Record<MediaAppearancePreset, string> = {
  none: "0",
  sm: "var(--tau-radius-sm)",
  md: "var(--tau-radius-md)",
  lg: "var(--tau-radius-lg)",
};

function Photo({
  attributes,
  element,
  children,
}: EditorElementRenderProps<PhotoElement>) {
  const { update } = useElement(element);
  const appearance = useMediaAppearance();
  const openViewer = useMediaViewer(element);
  const upload = useResourceUpload();
  // 节点自己的设置优先，其次是用户的默认外观，都没有时不加圆角
  const radius = element.borderRadius ?? appearance?.borderRadius ?? "none";

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (upload && file) update({ url: await upload(file) });
  };

  return (
    <div {...attributes}>
      <figure contentEditable={false} className="yourname-photo">
        {element.url ? (
          <MediaImage
            url={element.url}
            alt={element.caption}
            style={{ borderRadius: RADIUS[radius] }}
            onDoubleClick={() => openViewer(0)}
          />
        ) : (
          // 只读编辑器和博客里拿不到上传函数，不显示选择文件
          upload && <input type="file" accept="image/*" onChange={choose} />
        )}
        {element.caption && <figcaption>{element.caption}</figcaption>}
      </figure>
      {children}
    </div>
  );
}

export const photoElement = defineEditorElement<PhotoElement>({
  type: "yourname.photo",
  dataVersion: 1,
  kind: "block",
  isVoid: true,
  drag: true,
  render: Photo,
  resources: [
    { path: "url", kind: "image", alt: "caption", caption: "caption" },
  ],
});
```

`photoElement` 放进扩展的 `elements`，写法同[第一个块](editor.md#1-定义节点和扩展)。

| 接口                         | 用途                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `MediaImage`                 | 显示图片，参数为 `url`、`alt`、`className`、`style`、`loading`、`onLoadError` 等                                         |
| `MediaVideo` / `MediaAudio`  | Tau 的视频、音频播放器，参数为 `src` 与原生媒体属性                                                                      |
| `useResource(url, { kind })` | 自己绘制时使用：返回 `src`、`status`（`loading` / `ready` / `error`）与 `retry()`，元素加载失败时调用 `retry` 重新解析   |
| `useResourceUpload()`        | 返回上传函数，把用户选的文件存进当前的资源存储并返回可写入节点的地址；只读编辑器和博客里为 `undefined`                   |
| `useMediaAppearance()`       | 用户设置的媒体默认外观：`borderRadius`（`none` / `sm` / `md` / `lg`）与 `shadow`（同样四档，或布尔值）；博客里取发布设置 |
| `useMediaViewer(element)`    | 返回打开图片查看器的函数，见[查看图片](#查看图片)                                                                        |

`useMediaAppearance()` 可能返回 `undefined`：Tau 还没有读到用户的默认外观设置，或者组件不在 Tau 的编辑器和博客正文里渲染（比如插件页面里），都拿不到。返回了对象，其中的 `borderRadius`、`shadow` 也可能缺省。所以按上例的顺序取值：节点自己的设置，其次 `appearance?.borderRadius`，最后是你的默认值。

`kind` 取 `image`、`video`、`audio`、`file`，决定远程资源的缓存方式。上传的文件不需要自己判断本地还是远端存储，也不要把文件内容写进节点。

### 查看图片

`useMediaViewer(element)` 返回一个函数，调用后打开 Tau 的图片查看器，浏览文档里的全部图片，并定位到这个节点的第 `index` 张（按[声明的资源字段](#声明资源字段)计，从 0 开始）。照片块只有一张图，所以传 `0`：

```tsx
const openViewer = useMediaViewer(element);
<MediaImage url={element.url} onDoubleClick={() => openViewer(0)} />;
```

### 声明资源字段

节点里存了图片、视频、音频或文件地址时，在节点声明上用 `resources` 写明是哪些字段。Tau 只按这份声明找资源：导出打包、共享给协作者时上传本地文件、图片查看器里浏览图片、导出 EPUB 时取图，都靠它。没有声明的字段按普通文字原样保留，本地图片不会随内容导出，也不会上传给协作者。

照片块的图片在 `url` 字段；一个节点里有一组图片时，用 `[]` 指向数组的每一项：

```ts
resources: [
  { path: "images[].url", kind: "image", alt: "desc", caption: "desc" },
],
```

| 字段      | 说明                                                                                     |
| --------- | ---------------------------------------------------------------------------------------- |
| `path`    | 资源字段的路径。`url` 是节点上的字段，`images[].url` 表示 `images` 数组每一项的 `url`    |
| `kind`    | `image`、`video`、`audio` 或 `file`                                                      |
| `preview` | 可选。同一资源的显示版本（如裁剪结果）所在的字段，与 `path` 末段同层，同样会被导出和上传 |
| `alt`     | 可选。替代文字所在的字段，与 `path` 末段同层，图片查看器里显示                           |
| `caption` | 可选。说明文字所在的字段，与 `path` 末段同层，图片查看器里显示                           |

声明会随资料库保存，插件停用或在没装插件的设备上，这些资源照样能导出和共享。已经有文档用了的字段不要改名；新增资源字段时补进声明即可。资源字段不能同时列进 `collaboration.textFields`。

### 完整示例：图册

[图册插件](https://github.com/LastKnightCoder/tau-plugin-image-gallery)把这些能力和[块的交互](editor-interactions.md)组合成了一个完整的媒体块，可以对照它的源码写自己的块：

| 需要                       | 图册的做法                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| 点选、删除、右键菜单       | 节点声明 `frame`，Enter 绑定「编辑图册」命令，空格绑定「全屏预览」                                      |
| 选中后的属性条             | `useElement(element).selected` 为真时渲染 `BlockToolbar`，切换布局用 `update({ mode })`                 |
| 显示图片                   | 每张图用 `MediaImage`，圆角与阴影在节点没设置时取 `useMediaAppearance()`，两者都没有时用 `"none"`       |
| 添加图片                   | 编辑弹窗里调用 `useResourceUpload()` 返回的函数，拿到地址写进 `images`；返回 `undefined` 时隐藏上传按钮 |
| 调整顺序                   | 编辑弹窗里的图片列表用 `@tau/ui` 的 `Sortable`                                                          |
| 看大图                     | 只读时单击、编辑时双击图片，调用 `useMediaViewer(element)(index)`；编辑时单击留给外框选中               |
| 导出、协作、查看器找到图片 | `resources: [{ path: "images[].url", kind: "image", alt: "desc", caption: "desc" }]`                    |
| Markdown 与 HTML 导出      | `editorCodecs` 每张图导出一行图片链接，`htmlSerializers` 输出静态的横向滚动图片组                       |
| 样式                       | Tailwind 类名统一加 `ig:` 前缀，见[用 Tailwind 时加前缀](ui-components.md#用-tailwind-时加前缀)         |

命令和外框按键只知道节点，打开弹窗却要用组件里的状态。图册的做法是：组件把「打开编辑」登记到以节点对象为键的 `WeakMap` 里，命令收到 `context.element` 后从这里取出来调用。节点被替换后旧键自然失效，不会打开别的图册。

```tsx
import { useEffect, useState } from "react";
import {
  defineEditorElement,
  defineEditorExtension,
  useElement,
  type EditorElementRenderProps,
} from "@tau/plugins";

interface GalleryElement {
  type: "yourname.gallery";
  images: { url: string; desc: string }[];
  children: { type: "formatted"; text: string }[];
}
declare module "@tau/plugins" {
  interface EditorElementMap {
    "yourname.gallery": GalleryElement;
  }
}

// 以节点对象为键：节点被替换后旧键自然失效
const galleryActions = new WeakMap<object, { openSettings(): void }>();

function Gallery({ element }: EditorElementRenderProps<GalleryElement>) {
  const { readOnly } = useElement(element);
  const [editing, setEditing] = useState(false);

  // 每次渲染登记当前节点，卸载或换节点时移除
  useEffect(() => {
    galleryActions.set(element, {
      openSettings: () => {
        if (!readOnly) setEditing(true);
      },
    });
    return () => void galleryActions.delete(element);
  });

  return <div>{editing ? "编辑中" : `${element.images.length} 张图片`}</div>;
}

export const galleryExtension = defineEditorExtension({
  id: "yourname.gallery",
  elements: [
    defineEditorElement<GalleryElement>({
      type: "yourname.gallery",
      dataVersion: 1,
      kind: "block",
      isVoid: true,
      frame: { keys: { Enter: "yourname.gallery.edit" } },
      render: Gallery,
      resources: [
        { path: "images[].url", kind: "image", alt: "desc", caption: "desc" },
      ],
    }),
  ],
  commands: [
    {
      id: "yourname.gallery.edit",
      title: "编辑图册",
      run: (_editor, { element }) => {
        if (element) galleryActions.get(element)?.openSettings();
      },
    },
  ],
});
```

## 下一步

- [导出与字数统计](editor-export.md)：让块参与 Markdown、HTML 导出，块里的文字计入字数。
- [块的数据版本与协作](editor-collaboration.md)：多人同时编辑源码字段，以及发布后修改数据结构。
