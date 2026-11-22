# 引用用户的内容

插件的页面要用到用户已有的卡片、文章、日记、待办时，让用户在 Tau 的搜索窗口里亲手挑选，插件只保存引用；显示交给 `EntityRef`，点击由 Tau 打开。**这不需要任何权限**：用户亲手选择，就等于同意插件引用这些内容，之后也能随时读到它们的最新标题。导出、全屏演示、新建卡片这类自带界面的功能，也可以直接交给 Tau 完成，同样不需要权限。

下面是一个「阅读清单」页面：用户点「添加」挑几张卡片或文章，清单存进[私有存储](storage-and-network.md#私有存储)，每一项显示为可点击打开的引用：

```tsx
import { useEffect, useState } from "react";
import {
  EntityRef,
  PLUGIN_ENTITY_KINDS,
  type JsonValue,
  type PluginEntityKind,
  type PluginPageProps,
} from "@tau/plugins";
import { Button } from "@tau/ui";

// 存进私有存储的引用：只保留 kind 和 id
type SavedRef = { kind: PluginEntityKind; id: string };

// 存储里读出的是外部数据，先校验再用
function isSavedRef(value: JsonValue): value is SavedRef {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const { kind, id } = value;
  return typeof id === "string" && PLUGIN_ENTITY_KINDS.some((item) => item === kind);
}

export function ReadingListPage({ context }: PluginPageProps) {
  const [items, setItems] = useState<SavedRef[]>([]);

  useEffect(() => {
    void context.storage.get("reading-list").then((value) => {
      if (!context.signal.aborted && Array.isArray(value)) setItems(value.filter(isSavedRef));
    });
  }, [context]);

  async function add() {
    const picked = await context.app.pick({ kinds: ["card", "article"], multiple: true });
    // 用户取消时 picked 为空数组
    const next = [...items, ...picked.map(({ ref }) => ({ kind: ref.kind, id: ref.id }))];
    await context.storage.set("reading-list", next);
    setItems(next);
  }

  return (
    <section>
      <Button onClick={() => void add()}>添加</Button>
      <ul>
        {items.map((ref) => (
          <li key={`${ref.kind}:${ref.id}`}>
            <EntityRef target={ref} />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

页面的注册写法见[页面与入口](pages.md#页面)。

## 选择并打开已有内容

`context.app.pick` 打开 Tau 的搜索窗口，返回用户选中的 `[{ ref, title }]`；`ref` 交给 `<EntityRef>` 显示，交给 `context.app.open` 打开。上例里点击 `EntityRef` 就会打开，自己画按钮时这样写：

```ts
await context.app.open(ref);
```

| `kind`          | 内容                             | `open` 打开的位置                                                    |
| --------------- | -------------------------------- | -------------------------------------------------------------------- |
| `card`          | 卡片                             | 卡片详情                                                             |
| `article`       | 文章                             | 文章详情                                                             |
| `document`      | 项目文档                         | 所在项目，并选中该文档                                               |
| `diary`         | 日记里的一条片段                 | 当天日记，并定位到这条片段                                           |
| `whiteboard`    | 白板                             | 白板                                                                 |
| `todo`          | 待办                             | 待办详情；正文里的勾选项会打开所在文档并定位                         |
| `event`         | 日程                             | 日程详情                                                             |
| `project`       | 项目                             | 项目                                                                 |
| `notebook`      | Notebook                         | Notebook                                                             |
| `material`      | 划线、PDF 标注、剪藏             | 原处：书中位置、PDF 页面或网页                                       |
| `chat-session`  | AI 对话                          | 对话页；PDF、视频笔记和 Notebook 里的对话不能单独打开，`open` 会抛错 |
| `plugin-entity` | 插件创建的内容（包括其他插件的） | 创建它的插件页面                                                     |

- `pick` 的 `kinds` 决定可选的类型，顺序就是弹窗里的分组顺序；`multiple` 默认 `false`，点选一项即确认；`title` 可以自定义弹窗标题。
- `pick` 和 `open` 都只能在用户操作（点击、按键）之后调用。在定时器或事件回调里调用会抛错。
- 插件拿到的只有引用和选择时的标题，以及之后用 `describe` 读到的最新标题。要读取正文，仍然需要对应的[读取权限](permissions.md)。
- 日记按片段选择，同一天的多条日记可以分别选。选择后能读到的只有这条片段的标题，读不到日记正文；片段被删除后，旧的选择不会自动指向之后新建的片段，需要用户重新选择。
- `ref` 是普通对象，可以存进插件自己的数据；它的 `id` 与 [`context.data`](user-data.md) 中同类内容的 `id` 一致，不要解析或自己拼接。
- `calendar.query` 返回的日程如果来自待办（带 `todoId`），打开时用 `{ kind: "todo", id: todoId }`，不要用这条日程自己的 ID。
- 目标被删除后，`open` 会抛出「内容不存在」，可以据此提示用户从清单里移除这一项。
- 其他插件的内容，在那个插件停用时只能显示，不能打开。

手机上能选择和打开的类型更少，几处打开位置也不同，见[多端适配](portability.md#各平台可用的接口)。

### 打开位置与定位

`open` 的第二个参数可以指定打开在哪里、滚动到正文哪一处。比如让用户在独立窗口里读清单中的一篇文章：

```ts
await context.app.open(ref, { placement: "window" }); // 在独立窗口打开
await context.app.open(chatRef, { placement: "dock" }); // 在右侧停靠栏打开对话
await context.app.open(ref, { at: { block: 3 } }); // 打开并滚动到第 4 块
```

| 选项        | 取值                                 | 支持的内容                                                                 |
| ----------- | ------------------------------------ | -------------------------------------------------------------------------- |
| `placement` | `page`（默认）：主窗口的页面         | 全部                                                                       |
|             | `window`：独立编辑窗口，已打开时聚焦 | 卡片、文章、项目文档                                                       |
|             | `dock`：右侧停靠栏，不离开当前页面   | 主对话                                                                     |
| `at`        | `{ block }`：第几个顶层块，从 0 开始 | 卡片、文章、项目文档、日记、插件内容；不能与 `window` 同用，越界时停在开头 |

- `block` 与 [`content.read({ format: "nodes" })`](document-body.md#读取) 返回的 `nodes` 下标一致。
- 打开后滚动到那一块并短暂高亮，不会改变选区。
- 不支持的组合直接抛错，不会悄悄改用别的位置。手机上只有 `page`。
- 打开插件内容并定位时，你的插件页面会收到页面参数 `at`，原样传给 `<ContentEditor at={params.at}>` 即可，见[嵌入正文编辑器](document-body.md#嵌入正文编辑器)。

要打开普通网址，在用户点击时调用 `await context.app.openWeb(url)`。要打开插件自己的页面，使用页面句柄。两种用法见[在右栏打开页面和网页](pages.md#在右栏打开页面和网页)。

### 显示引用

清单里直接放 `<EntityRef>`：图标、类型名、最新标题与「已删除」都由 Tau 显示，同一次渲染的引用会合并成一次查询。需要自己排版或排序，例如把已删除的项排到最后时，用 `describe` 批量读取当前状态，每次最多 200 项：

```ts
const states = await context.app.describe(items);
// [{ ref, status: "ok", title }, { ref, status: "missing" }, { ref, status: "denied", permission }]
const missing = states.filter((state) => state.status === "missing");
```

| `status`  | 含义                                                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `ok`      | `title` 为最新标题                                                                                                                              |
| `missing` | 内容已删除                                                                                                                                      |
| `denied`  | 用户没有为这个插件选择过这项内容，插件也没有 `permission` 这项读取权限；`permission` 为 `null` 的类型（日记、其他插件的内容）只能经用户选择获得 |

- 用户选择过的内容、请 Tau 新建的内容（下文 `app.run` 的新建类动作）、本插件自己创建的内容不需要权限。其他内容需要对应类型的读取权限，对照表是导出的常量 `PLUGIN_ENTITY_READ_PERMISSIONS`。
- `describe` 不会弹窗。遇到 `denied` 时，可以提示用户，由用户点击后再调用 `context.permissions.request([permission])`，见[权限](permissions.md#处理拒绝)。`EntityRef` 在这种情况下自带「允许访问」按钮。
- 不想让用户点击打开时，传 `openable={false}`。`EntityRef` 只能在插件页面里使用。
- 用户卸载插件并选择清除数据时，Tau 会忘记这些选择，私有存储也一起清除。

## Tau 的界面动作

导出、全屏演示、协作共享、新建卡片这类自带界面的功能，用 `context.app.run` 交给 Tau 完成，界面与 Tau 中的相同。比如在阅读清单里加一个「记一张卡片」按钮，用户保存后把新卡片也放进清单：

```ts
async function addNote(quote: string) {
  const ref = await context.app.run("card.create", {
    content: { markdown: `> ${quote}\n\n` },
    tags: ["摘抄"],
  });
  if (!ref) return; // 用户取消
  const next = [...items, { kind: ref.kind, id: ref.id }];
  await context.storage.set("reading-list", next);
  setItems(next);
}
```

导出、演示和共享要传正文引用 `contentRef`，它来自 [`context.data`](user-data.md) 或[插件内容](plugin-content.md)返回的数据：

```tsx
<Button onClick={() => void context.app.run("content.export", { ref: card.contentRef, format: "pdf" })}>
  导出 PDF
</Button>
```

| 动作                     | 参数                                                                      | 效果                                                           | 结果                                       |
| ------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `content.export`         | `ref`，`format`：`markdown`、`image`、`pdf`、`epub`                       | Markdown 直接保存文件，其余打开导出窗口                        | 无                                         |
| `content.present`        | `ref`                                                                     | 全屏演示                                                       | 无                                         |
| `content.share`          | `ref`                                                                     | 打开「内容协作」窗口，由用户确认发起共享；已共享时打开成员管理 | 无                                         |
| `card.create`            | `content?`（见[正文输入](document-body.md#正文输入)）、`tags?`            | 打开新建卡片窗口并预填，用户可修改后保存                       | 新卡片的引用 `{ kind: "card", id }`        |
| `project.insertDocument` | `content`、`title?`（默认「未命名文档」）                                 | 打开「插入到项目」窗口，用户选择项目与位置后新建文档           | 新文档的引用 `{ kind: "document", id }`    |
| `notebook.create`        | `title`、`sources?`（最多 200 项）、`from?`                               | 确认后新建 Notebook，`sources` 作为资料带入，`from` 记为来源   | Notebook 的引用 `{ kind: "notebook", id }` |
| `chat.start`             | `prompt?`、`context?`（最多 20 项）、`placement?`：`page`（默认）、`dock` | 在对话页或右侧停靠栏开一个新对话，预填输入框与引用，由用户发送 | 对话的引用 `{ kind: "chat-session", id }`  |

- 不需要数据权限：界面和确认都由 Tau 提供，用户在界面里确认即同意。插件拿不到正文。新建类返回的引用和用户在 `pick` 中选择的一样：不需要权限就能用 `describe` 读标题、用 `<EntityRef>` 显示、`open` 打开、用 [`links.add`](plugin-content.md#插件关联) 关联；读取正文仍需要对应的读取权限（如 `cards:read`）。
- 用户关闭界面后才返回：导出、演示、协作在窗口关闭或演示结束时返回；新建类在保存后返回新内容的引用，用户取消时返回 `null`。插件停用时界面会被撤下。
- 只能在用户操作之后调用；同一时间只能打开一个，前一个还没关闭时抛错。内容已删除时抛出「内容不存在」。
- `copyOf` 只复制正文，不会改动来源。`project.insertDocument` 的 `content` 用 `shareOf` 时，新文档与插件内容共用正文；其他写法都是新的一份正文。`card.create` 的窗口里用户可以修改预填内容，不接受 `shareOf`。
- `notebook.create` 的资料一次性带入，之后原内容的修改不会同步：卡片、文章、项目文档、日记和插件内容成为笔记资料；划线与 PDF 标注合并为一份，剪藏各一份；其他类型和已删除的内容不带入，确认框里会告诉用户数量。
- `from` 是这个 Notebook 由什么立项，显示在 Notebook 页顶部，用户点击可以打开。可以是卡片、文章、项目文档、日记、材料、对话、Notebook 或插件内容（`PLUGIN_NOTEBOOK_FROM_KINDS`），不存在时抛出「来源不存在」。
- `chat.start` 不会替用户发送：`prompt` 进入输入框，`context` 作为引用插在后面，用户可以修改。用户发出第一条消息后才返回对话的引用；没发送就切到别的对话、离开对话页、收起停靠栏或插件停用时返回 `null`。`context` 只支持卡片、文章、项目文档（`PLUGIN_CHAT_CONTEXT_KINDS`），其他内容请写进 `prompt`。
- 手机上只有 `card.create`、`project.insertDocument` 和 `content.share`，其他动作会抛错。

需要读取正文、按条件查询或修改用户的内容时，先读[权限](permissions.md)，再读[读写用户数据](user-data.md)。
