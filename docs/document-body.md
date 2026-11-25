# 正文

卡片、文章、项目文档和插件内容各带一份正文。插件可以用 Markdown 或编辑器节点写入正文，读出来改写，或者直接在自己的页面里嵌入和卡片详情一样的编辑器，让用户在插件里写。

下面在一张读书卡片末尾追加一行进度。需要 `cards:read` 与 `cards:write` 权限（见[权限](permissions.md)），`card` 来自 [`context.data.cards`](user-data.md#卡片文章项目文档)：

```ts
const snapshot = await context.content.read(card.contentRef);
if (snapshot) {
  await context.content.edit(
    card.contentRef,
    { op: "append", content: { markdown: "今天读完了第三章。" } },
    { expectedRevision: snapshot.revision },
  );
}
```

## 正文输入

新建卡片、文章、项目文档、插件内容，以及修改正文时，正文都用同一种写法 `content`，从下面几种里选一种：

```ts
// Markdown：适合 AI 生成或外部导入的文字
await context.data.cards.create({ content: { markdown: "# 第三章\n\n读书笔记" } });

// 编辑器节点：与 content.read({ format: "nodes" }) 读到的格式相同，格式完整保留
const source = await context.content.read(card.contentRef, { format: "nodes" });
await context.data.cards.create({
  content: { nodes: source!.nodes!, contracts: source!.contracts },
});

// 复制一份已有正文：Tau 内部整份复制，插件拿不到正文内容
await context.data.articles.create({ title: "读书笔记（副本）", content: { copyOf: card.contentRef } });

// 共用本插件内容的正文：新卡片与插件内容是同一份正文，改一处另一处同步变化
await context.data.cards.create({ content: { shareOf: note.contentRef } });
```

| 写法       | 什么时候用                                                                 | 注意                                                 |
| ---------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| `markdown` | 写入纯文字、AI 输出、外部导入                                              | 高亮、颜色、白板嵌入等 Markdown 表达不了的格式会丢失 |
| `nodes`    | 把读到的正文改写后写回，或在多份正文之间搬运内容                           | 结构不对时报错并给出出错节点的路径                   |
| `copyOf`   | 把一份正文完整复制到新卡片、新文章或插件内容里，例如「把这条笔记存为卡片」 | 只需要目标的写入权限，不需要来源的读取权限           |
| `shareOf`  | 让插件内容同时也是一张卡片、一篇文章或一篇项目文档，在哪里改都是同一份正文 | 只用于新建卡片、文章、项目文档与「插入到项目」       |

- `nodes` 只检查结构：顶层是元素，元素有 `type` 和非空的 `children`，文字节点有 `text`。Tau 不认识的节点类型（例如来自未安装的插件）原样保存，安装对应插件后即可正常显示。
- 原样搬运读到的节点时，把同时读到的 `contracts` 一起传回。它记录了插件块的数据版本，缺了它，其他插件的块可能变成只读，见[块的数据版本与协作](editor-collaboration.md#在插件里搬运正文)。只新建自己插件的块时可以省略。
- `content.read({ format: "nodes" })` 的结果带 `schemaVersion`。节点结构有不兼容的变化时它会增加，插件可以与 `EDITOR_NODE_SCHEMA_VERSION` 比较，判断自己是否认得这些节点。
- 正文中的待办勾选项由 Tau 维护身份，复制或搬运后各自独立，不需要插件处理。
- `copyOf` 的来源可以是卡片、文章、项目文档或任一插件内容的正文。复制的是当前内容，之后两份互不影响。
- `shareOf` 的来源只能是本插件内容的正文。用户在卡片、文章或项目文档里修改，插件内容同步变化，反之亦然；删除其中一处，另一处照常保留。一份正文最多是一张卡片、一篇文章，已经有了再新建会报错，可以先用 `content.read` 返回的 `owners` 判断。插件内容自己（`entities.create`）和修改正文（`content.edit`）不能用 `shareOf`。
- 新建时省略 `content` 得到空正文。
- 正文有大小上限：`markdown` 最多 200 万字；`nodes` 转成 JSON 后最多 800 万字，嵌套最多 30 层。超出时报错，上限可从 `CONTENT_INPUT_LIMITS` 读取。

## 读写正文

正文用 `contentRef` 定位，它来自 [`context.data`](user-data.md) 或[插件内容](plugin-content.md)返回的数据。

### 读取

```ts
const snapshot = await context.content.read(card.contentRef);
console.log(snapshot?.markdown, snapshot?.wordCount);
```

- 需要正文所属实体的读取权限，例如卡片正文需要 `cards:read`；本插件内容的正文不需要权限。正文不存在时返回 `null`。
- 默认返回 Markdown。`{ format: "nodes" }` 返回编辑器节点，可以原样作为 `content: { nodes }` 写回，格式不丢失；同时返回 `schemaVersion`，见[正文输入](#正文输入)。
- 读到的是已保存的内容，用户正在输入的部分最多晚约 1 秒。

### 修改

开头的例子用 `append` 在末尾追加一行。`edit` 的第二个参数选择修改方式：

| `op`          | 参数               | 作用                                                                                                                            |
| ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `append`      | `content`          | 在末尾加入新内容，原有内容不变；`content` 不能为空                                                                              |
| `prepend`     | `content`          | 在开头加入新内容，原有内容不变；`content` 不能为空                                                                              |
| `replaceAll`  | `content`          | 用新内容替换整篇；`content` 为空时清空正文                                                                                      |
| `replaceText` | `find`、`markdown` | 在 Markdown 文本中把 `find` 替换成 `markdown`，`find` 必须恰好出现一次；整篇会经 Markdown 重建，Markdown 表达不了的格式可能丢失 |

```ts
const current = await context.content.read(card.contentRef);
const { revision } = await context.content.edit(
  card.contentRef,
  { op: "replaceText", find: "第三章", markdown: "第四章" },
  { expectedRevision: current!.revision },
);
```

- `content` 的写法见[正文输入](#正文输入)。
- 需要所属实体的写入权限，例如卡片正文需要 `cards:write`；本插件内容的正文不需要权限。
- 正文正在编辑器里打开时，修改会立即出现，协作者也能看到。
- **插件的修改不进入编辑器的撤销记录**，用户无法用撤销键退回。修改前确认这是用户想要的。
- `replaceText` 和 `replaceAll` 会把整篇按 Markdown 重建，Markdown 表达不了的格式可能会被简化。只是添加内容时，用 `append` 或 `prepend`。
- 正文的 `revision` 与卡片自己的 `revision` 是两套版本。每次修改返回正文的新 `revision`，连续修改时传给下一次调用；版本不符时抛出 `PluginConflictError`。

## 嵌入正文编辑器

插件页面里可以直接嵌入 Tau 的正文编辑器，和卡片详情里的编辑器完全一样：实时协作、已安装的编辑器扩展、文档待办都会生效，修改自动保存。比如在读书插件的页面里，左边列出卡片的开头几段，右边编辑选中的那张：

```tsx
import { ContentEditor, ContentPreview, type PluginCard } from "@tau/plugins";

function CardPanel({ card }: { card: PluginCard }) {
  return <ContentEditor contentRef={card.contentRef} placeholder="写点什么" />;
}

function CardRow({ card }: { card: PluginCard }) {
  return <ContentPreview contentRef={card.contentRef} maxBlocks={3} />;
}
```

| 组件             | 属性                                                 | 需要的权限                               |
| ---------------- | ---------------------------------------------------- | ---------------------------------------- |
| `ContentEditor`  | `contentRef`、`readonly`、`placeholder`、`at`、`kit` | 可编辑时需要写入权限，只读时需要读取权限 |
| `ContentPreview` | `contentRef`、`maxBlocks`（默认 3，最多 100）、`kit` | 读取权限                                 |

- 编辑本插件内容的正文不需要权限。
- 组件挂载时不会弹窗。还没授权时显示「允许访问」按钮，用户点击后才询问；已拒绝时提示用户到插件详情页修改。
- 用户在组件里的编辑和在卡片详情里一样，可以撤销，产生的事件 `origin` 为 `app`。这一点和 `context.content.edit` 不同。
- `ContentPreview` 显示已保存的内容，编辑中的改动大约 1 秒后反映出来。
- `at` 是从 Tau 打开插件内容时页面参数里的 `at`，原样传入即可滚动到命中位置，见[内容类型](plugin-content.md#内容类型)。
- 这两个组件只能在插件页面里使用；手机上也可以放在设置区域里。
- `kit` 选编辑器套件：`full`（默认）与卡片详情相同；`compact` 是精简套件，与白板图形文字、PDF 批注等简短内容的编辑器相同，不含内容链接、文件附件、白板块、数据库块和文档待办，适合标题下的一段说明、回答这类简短内容。正文里已有这些块时显示为占位，数据原样保留。编辑和预览同一份内容时请用同一个 `kit`。

想让插件有自己的、带正文的内容（如周记），读[插件内容与记录](plugin-content.md)。

日程备注的 notesRef 也使用这些读写方法，权限为 `calendar:read` 与 `calendar:write`。日程没有备注句柄时先通过 `context.data.calendar.ensureNotes` 建立空正文；元数据和备注分别使用各自的条件写入，见[读写用户数据](user-data.md#待办项目日历与完整字段)。
