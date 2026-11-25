# 读写用户数据

插件可以按条件查询用户的卡片、文章、项目文档、白板、项目、待办和日程，修改或删除它们，并在它们变化时收到通知。适合做周报、看板、统计、批量整理这类要成批处理用户内容的功能。只需要让用户挑一项来用时不必走这里，用[引用用户的内容](references.md)，不需要权限；正文的读写见[正文](document-body.md)，插件自己的数据见[插件内容与记录](plugin-content.md)。

下面的「每周回顾」读出最近一周修改过的卡片和还没完成的待办，用户点「开始回顾」时调用。先在 manifest 里声明权限，第一次调用时 Tau 会询问用户，没有授权时的处理见[权限](permissions.md)：

```json
{ "permissions": ["cards:read", "todos:read", "todos:write"] }
```

```ts
const weekAgo = Date.now() - 7 * 86_400_000;

async function loadWeek() {
  const cards = await context.data.cards.query({ updatedAfter: weekAgo, limit: 50 });
  const todos = await context.data.todos.query({ completed: false, limit: 20 });
  return { cards: cards.items, todos: todos.items };
}
```

手机上可以读写卡片、文章、项目、项目文档、待办和日程；白板、Notebook、材料与对话只有桌面能读，见[多端适配](portability.md#各平台可用的接口)。

## 读取

### 卡片、文章、项目文档

`context.data.cards`、`context.data.articles`、`context.data.documents` 都提供 `get(id)` 和 `query(query)`。一页读不完时，把返回的 `cursor` 原样传回读下一页：

```ts
const page = await context.data.cards.query({ updatedAfter: weekAgo, limit: 50 });
for (const card of page.items) console.log(card.title, card.tags);

if (page.cursor) {
  const next = await context.data.cards.query({ updatedAfter: weekAgo, cursor: page.cursor });
}

const article = await context.data.articles.get(id); // 不存在时为 null
```

| 查询参数                        | 说明                                                          |
| ------------------------------- | ------------------------------------------------------------- |
| `createdAfter`、`createdBefore` | 创建时间范围，毫秒时间戳，包含起点、不包含终点                |
| `updatedAfter`、`updatedBefore` | 修改时间范围，正文的修改也计入                                |
| `tag`                           | 按标签筛选。层级标签按前缀匹配，「读书」也会匹配「读书/小说」 |
| `sort`                          | `updated`（默认）或 `created`，都是倒序                       |
| `limit`                         | 每页 1 至 200 条，默认 50                                     |
| `cursor`                        | 上一页返回的 `cursor`，原样传回即可读取下一页                 |

返回的每一项都有：

| 字段                     | 说明                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| `id`                     | 标识                                                                          |
| `revision`               | 版本号，修改和删除时要传回，见[修改与删除](#修改与删除)                       |
| `title`                  | 标题。卡片本身没有标题字段，这里是 AI 生成的标题或正文开头                    |
| `tags`                   | 标签                                                                          |
| `wordCount`              | 字数                                                                          |
| `createdAt`、`updatedAt` | 创建、修改时间（毫秒）                                                        |
| `contentRef`             | 正文的引用，用于[读写正文](document-body.md#读写正文)。非富文本的项目文档为 `null` |
| `pinned`                 | 卡片和文章：是否置顶                                                          |
| `kind`、`projectIds`     | 项目文档：文档类型（如 `document`）、所属项目                                 |

`id` 和 `contentRef` 是不透明的字符串，只用于传回 Tau，不要解析或自己拼接。

列表只需要展示几条时，用 `limit` 和时间范围控制读取量，不要一次读完全部数据再筛选。

### 白板与项目

`context.data.whiteboards`、`context.data.projects` 同样提供 `get(id)` 和 `query(query)`，查询参数与上表相同；项目没有标签，不能按 `tag` 查询。

```ts
const boards = await context.data.whiteboards.query({ tag: "课题", limit: 20 });
const projects = await context.data.projects.query({ sort: "created" });
```

| 类型 | 字段                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------- |
| 白板 | `id`、`revision`、`title`、`description`、`tags`、`pageCount`（画板页数）、`createdAt`、`updatedAt`        |
| 项目 | `id`、`revision`、`title`、`archived`、`pinned`、`documentCount`（根目录文档数）、`createdAt`、`updatedAt` |

- 画板内容不开放读写，由用户在 Tau 中编辑；白板的 `revision` 只随标题、说明和标签变化。
- 项目的 `revision` 在改名、归档、置顶以及增删文档时都会变化。
- 读取需要 `whiteboards:read`、`projects:read`。

### 项目目录

`projects.tree(id)` 返回项目的文档目录，项目不存在时为 `null`。比如把这周的回顾写成项目里的一篇文档：

```ts
const tree = await context.data.projects.tree(projectId);
// [{ documentId, revision, title, kind, ref?, children: [...] }, ...]

// 新建一篇文档，挂在某篇文档下；省略 parentId 时挂在根目录末尾
const doc = await context.data.documents.create({
  projectId,
  parentId: tree![0].documentId,
  title: "本周回顾",
  content: { markdown: "这一周读了……" },
});

// 把它移到根目录第一位
await context.data.documents.move(
  doc.id,
  { projectId, from: tree![0].documentId, to: null, index: 0 },
  { expectedRevision: doc.revision },
);
```

- 同一篇文档可以挂在多处（多个父文档或多个项目下），这时它在目录里出现多次，`documentId` 相同。`move` 用 `from` 指明移动的是哪一处，`from`、`to` 为父文档 ID，`null` 表示根目录。
- 一篇文档挂在多个项目下时，它的子目录也是同一份：在任何一处给它增删子文档，其他挂载处都会跟着变。
- `move` 只在同一项目内移动；不能移到自己或自己的子文档下。`index` 是移动后的序号，从 0 开始，省略时放在末尾。返回文档的新 `revision`。
- 引用卡片或文章的条目带 `ref`，它的正文归被引用的卡片或文章，`documents.get` 读不到这一项，但可以移动。
- `content` 的写法见[正文输入](document-body.md#正文输入)。
- 读目录需要 `projects:read`，新建与移动需要 `documents:write`。

### Notebook、材料与对话

`context.data.notebooks`、`context.data.materials`、`context.data.chats` 只能读取，提供 `get(id)` 和 `query(query)`。查询参数与卡片相同，但不能按 `tag` 查询。

```ts
const notebooks = await context.data.notebooks.query({ limit: 20 });
const resources = await context.data.notebooks.resources(notebooks.items[0].id);
const material = await context.data.materials.get(ref.id); // ref 来自 pick 选中的划线
const chats = await context.data.chats.query({ updatedAfter: weekAgo });
```

| 类型     | 字段                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Notebook | `id`、`title`、`archived`、`pinned`、`resourceCount`（资料数）、`createdAt`、`updatedAt`                                      |
| 资料     | `id`、`name`、`type`（`pdf`、`video`、`md` 等）、`source`、`url?`、`from?`、`size`、`duration`（秒）、`createdAt`             |
| 材料     | `id`、`kind`（`excerpt`、`pdf-annotation`、`web-clip`）、`title`、`quote`、`note`、`source`、`url?`、`createdAt`、`updatedAt` |
| 对话     | `id`、`title`、`scene`（`main`、`pdf`、`video-note`、`notebook`）、`messageCount`、`archived`、`createdAt`、`updatedAt`       |

- `notebooks.resources(id)` 按 Notebook 中的顺序返回资料清单，Notebook 不存在时为 `null`。资料的 `source` 是 `local`（本机文件）、`remote`（网络链接，带 `url`）、`note`（加入时的笔记快照）、`material`（材料快照）或 `online-video`（在线视频）；来自笔记或材料的资料带 `from`，是原内容的引用，原内容可能已被删除。
- 不开放：Notebook 的说明、资料的本机路径和转换后的文字、Notebook 里的笔记与测验，以及对话的消息内容。
- 材料的 `id` 与 `pick` 得到的 `material` 引用 ID 相同。`quote` 是划下或标注的原文，剪藏为空；`source` 是给人看的出处，如「PDF · 文件名 · 第 3 页」。已删除的材料不返回。
- 未命名的对话 `title` 为空字符串。
- 读取需要 `notebooks:read`、`materials:read`、`chats:read`。

### 待办与日程

`context.data.todos` 读取普通待办、重复系列和正文里的勾选项，`context.data.calendar` 读取日程。两者都提供 get 和分页 query；目录、提醒、重复规则、实例状态及备注的完整用法见[待办与日程](task-data.md)。

```ts
const todos = await context.data.todos.query({ completed: false, limit: 20 });
const events = await context.data.calendar.query({ start: "2026-12-01", end: "2026-12-07" });
```

### 按游标读取变化

需要离线续读或发现删除时，使用 `context.data.changes.query`。处理成功后再保存游标，完整流程和失败处理见[待办与日程 · 按游标读取变化](task-data.md#按游标读取变化)。

## 修改与删除

回顾时用户勾掉一条待办，或者把一张卡片置顶：

```ts
import { PluginConflictError } from "@tau/plugins";

await context.data.todos.setCompleted(todo.id, true, { expectedRevision: todo.revision });

try {
  await context.data.cards.update(card.id, { pinned: true }, { expectedRevision: card.revision });
} catch (error) {
  if (error instanceof PluginConflictError) {
    // 用户刚在别处改过这张卡片：重新读取，再决定要不要重试
  } else throw error;
}
```

| 接口                                                      | 可以写的字段                                                                                         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `cards.create` / `cards.update`                           | 新建：`content`、`tags`、`pinned`；修改：`tags`、`pinned`                                            |
| `articles.create` / `articles.update`                     | 新建：`title`（必填）、`content`、`tags`；修改：`title`、`tags`、`pinned`                            |
| `documents.create` / `documents.update`                   | 新建：`projectId`、`parentId`（省略时挂在根目录）、`title`、`content`、`tags`；修改：`title`、`tags` |
| `documents.move(id, { projectId, from, to, index }, ...)` | 在同一项目内移动，见[项目目录](#项目目录)                                                            |
| `whiteboards.create` / `whiteboards.update`               | `title`（新建时必填）、`description`、`tags`；新建的白板带一张空白画板页                             |
| `projects.create` / `projects.update`                     | 新建：`title`（必填），得到空项目；修改：`title`、`archived`、`pinned`                               |
| `todos.create` / `todos.update` | 标题、截止日期、待办项目与提醒，见[待办与日程](task-data.md#创建带提醒的待办) |
| `todos.setCompleted(id, completed, ...)`                  | 标记完成或未完成                                                                                     |
| `calendar.create` / `calendar.update` | 时段、日历、提醒与备注，见[安排日程与编辑备注](task-data.md#安排日程与编辑备注) |
| `*.delete(id, ...)`                                       | 删除卡片、文章、白板、项目、项目文档、待办、日程，限制见下                                           |

- `content` 是新建时的正文，写法见[正文输入](document-body.md#正文输入)；修改已有正文用 [`context.content.edit`](document-body.md#修改)。
- 新建、修改需要对应的 `:write` 权限，删除需要 `:delete` 权限。
- 有截止日期的待办会在日历里显示为一条日程。这类日程只能通过待办接口修改：`calendar.update` 不能改它的标题，也不能把它移到别的日历。
- 全天日程的 `start`、`end` 用 `YYYY-MM-DD`，且 `end` 不包含当天：一个只占 10 月 21 日的全天日程，`end` 是 `2026-10-22`。定时日程用带时区的 ISO 时间。

### 待办项目、日历与完整字段

待办项目、日历发现、提醒、重复与实例、日程备注以及创建请求重试，见[待办与日程](task-data.md)。

### 用 revision 避免覆盖别人的修改

每一项数据都带有 `revision`。修改和删除时必须把读到的 `revision` 作为 `expectedRevision` 传回。如果这期间用户或其他插件改过这一项，调用会抛出 `PluginConflictError`，而不是悄悄覆盖。遇到冲突时重新读取，再决定是否重试。修改返回的新对象带有新的 `revision`，连续修改时用它。

卡片、文章和项目文档的正文有独立版本，修改正文不改变它们的元数据 revision，见[正文](document-body.md#修改)。日程的聚合 revision 还覆盖备注正文和完整提醒列表；版本只用于比较相等，不能按大小或时间戳选择覆盖哪一方。

### 写入后

- 打开中的页面、其他窗口、搜索和云同步都会自动更新，插件不需要做任何通知。
- 插件新建的卡片、文章、项目文档、白板和项目，和用户在 `pick` 中选择的一样：之后不需要读取权限也能用 `describe` 读标题、用 `<EntityRef>` 显示、`open` 打开、`links.add` 关联，见[引用用户的内容](references.md)。
- 插件删除的内容，用户可以在 7 天内从插件详情页的「权限 → 最近删除」中恢复。
- 项目只能删除空项目，里面还有文档时会被拒绝。
- 项目文档会从它挂载的所有位置删除，有子文档时会被拒绝，视频笔记不能由插件删除。恢复时挂回仍然存在的原位置。
- 有子待办的待办不能删除。

## 订阅变化

回顾页面开着时，用户在别处改了卡片或待办，页面应该跟着刷新：

```ts
context.events.on(["card.created", "card.updated", "card.deleted", "todos.changed"], () => {
  void loadWeek().then(render);
});
```

| 事件                                           | 说明                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `card.created`、`card.updated`、`card.deleted` | 带 `id`。正文修改也算 `updated`                                              |
| `article.*`、`document.*`                      | 同上。文章移入回收站算 `deleted`                                             |
| `whiteboard.*`、`project.*`                    | 同上。白板的画板内容修改不算                                                 |
| `notebook.*`                                   | 同上。增删、修改资料也算 `updated`                                           |
| `material.*`、`chat.*`                         | 同上。划线删除算 `deleted`；对话收到新消息也算 `updated`                     |
| `entity.*`                                     | 本插件的内容，带 `id` 和 `kind`，见[插件内容](plugin-content.md#插件内容)    |
| `record.*`                                     | 本插件的记录，带 `id` 和 `collection`，见[插件记录](plugin-content.md#插件记录) |
| `todos.changed`、`calendar.changed`            | 待办、日程有变化，不带 `id`，需要时重新查询                                  |
| `workspace.reset`                              | 资料库被整个替换（例如从云端恢复），应全部重新读取                           |

- 事件只说明哪一项变了，不携带数据，需要时用 `context.data` 重新读取。
- `origin` 表示变化的来源：`{ kind: "plugin", pluginId }` 表示由插件写入，可以用它忽略自己写入引起的事件；其他情况是 `{ kind: "app" }`。待办与日程的事件总是 `app`。
- 同一项在短时间内的多次变化会合并成一次；用户持续输入时，最多每 2 秒一次。
- 接收事件需要对应的读取权限（`entity.*`、`record.*` 与 `workspace.reset` 除外）。还没获得授权时事件不会送达，也不会因此弹窗。
- `entity.created`、`entity.updated`、`entity.deleted` 只发给创建这项内容的插件，不需要权限。正文修改也算 `updated`；`kind` 是内容类型，删除后 `get` 读不到时可以据此判断是哪类内容。从「最近删除」恢复、卸载后重新安装找回，都算 `created`。适合在其他设备同步过来或 AI 通过 MCP 写入后刷新页面。
- 订阅在插件停用时自动注销。

要读改正文或在页面里嵌入编辑器，接着读[正文](document-body.md)。
