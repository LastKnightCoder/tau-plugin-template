# 插件内容与记录

插件可以在用户的资料库里创建属于自己的内容，例如每周一篇周记、看板上的一张卡片、一个待解决的问题。每一项都带一份正文，和卡片正文一样实时保存、随云同步，并出现在 Tau 的搜索、@ 引用和脉络里。用户看不到的结构化数据（分组、操作记录）存成插件记录；把插件内容连到用户的卡片、文章上用插件关联；几处写入要一起成功时用原子提交。**读写本插件自己的内容、记录和关联不需要任何权限。**

## 插件内容

### 一个周记的例子

声明一种「周记」内容，按周次找到或新建，在页面里编辑正文。后文的例子都接着用它：

```tsx
import { useEffect, useState } from "react";
import {
  ContentEditor,
  definePlugin,
  type PluginContext,
  type PluginOwnEntity,
  type PluginPageProps,
} from "@tau/plugins";
import { NotebookPen } from "lucide-react";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

// 按周次找到周记，没有就新建
async function noteOf(context: PluginContext, week: string) {
  return (
    (await context.entities.find("note", week)) ??
    (await context.entities.create({ kind: "note", key: week, title: `${week} 周记` }))
  );
}

function ReviewPage({ context, params }: PluginPageProps) {
  const [note, setNote] = useState<PluginOwnEntity | null>(null);
  const week = String(params.week ?? "2026-W43");
  useEffect(() => {
    void noteOf(context, week).then((value) => {
      if (!context.signal.aborted) setNote(value);
    });
  }, [context, week]);
  if (!note) return null;
  // at 是从搜索结果打开时的命中位置
  const at = typeof params.at === "string" ? params.at : undefined;
  return <ContentEditor contentRef={note.contentRef} at={at} placeholder="这一周想记下什么" />;
}

export default definePlugin({
  ...__PLUGIN_META__,
  create: () => ({
    activate(context) {
      context.pages.register({ id: "review", title: "周记", component: ReviewPage, match: "params" });
      context.entities.registerKind({
        kind: "note",
        label: "周记",
        icon: NotebookPen,
        open: { page: "review", params: (note) => ({ week: note.key }) },
      });
    },
  }),
});
```

`lucide-react` 需要先 `pnpm add lucide-react`，图标的要求见[页面与入口 · 图标](pages.md#图标)。

### 内容类型

先用 `registerKind` 声明类型，才能创建这种内容。在 `activate` 中声明，停用时自动撤销。

| 字段          | 说明                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `kind`        | 类型 ID，插件内唯一                                                                            |
| `label`       | 显示的类型名，如「周记」                                                                       |
| `icon`        | 可选。类型图标，写法与[侧边栏图标](pages.md#图标)相同                                          |
| `open`        | 用户在 Tau 中打开这项内容时进入的插件页面：`page` 是页面的局部 ID，`params` 从内容算出页面参数 |
| `mentionable` | 可选。为 `true` 时，用户可以在正文里用 @ 引用这类内容，默认不可以                              |
| `indexes`     | 可选。可用于查询筛选与排序的 `meta` 字段及类型，见[按字段查询](#按字段查询)                    |

插件内容会出现在 Tau 的全局搜索、AI 检索、@ 面板、正文中的引用以及脉络与漫步里，并以你声明的 `label` 和 `icon` 显示：

- 用户点击时，Tau 按 `open` 打开你的插件页面。如果命中的是正文中间某处，页面参数会额外带上 `at`，把它原样传给 `<ContentEditor at={params.at}>` 就能滚动到命中位置。
- 插件停用时，桌面上 Tau 用自带的只读页显示这项内容；手机上仍能在搜索和引用里看到，但不能打开。
- 图标在声明时渲染一次并随资料库保存，所以插件停用后、在其他设备上也能正常显示。图标必须是单个 `<svg>`，不超过 16 KB，只按形状显示，颜色跟随主题，多色、渐变和位图不会保留。

### 接口

| 方法                                                                  | 说明                                                                                                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `create({ kind, key, title?, meta?, content? })`                      | 新建一项，`content` 为初始正文（写法见[正文输入](document-body.md#正文输入)），省略时为空。同一类型下 `key` 已存在时抛出 `PluginConflictError` |
| `get(id)`、`find(kind, key)`                                          | 读取一项，不存在时为 `null`                                                                                                                  |
| `query({ kind?, where?, titleContains?, orderBy?, cursor?, limit? })` | 分页查询，默认按创建时间倒序，默认 50 条，最多 200 条，见[按字段查询](#按字段查询)                                                           |
| `count({ kind?, where?, titleContains? })`                            | 符合条件的数量                                                                                                                               |
| `update(id, { title?, meta? }, { expectedRevision })`                 | 修改标题或 `meta`                                                                                                                            |
| `delete(id, { expectedRevision })`                                    | 删除一项及其正文                                                                                                                             |
| `backlinks(id)`                                                       | 哪些卡片、文章、项目文档引用了这项内容                                                                                                       |

- `key` 由你决定，用来找回同一项内容，例如周记用周次 `2026-W43`。
- `meta` 保存少量结构化信息，是不超过 64 KB 的 JSON 对象。大段内容放在正文里。
- 正文用 `ContentEditor` 编辑，或用 [`context.content`](document-body.md#读写正文) 读写，不需要权限。
- 修改和删除要传回读到的 `revision`，规则与[用户数据](user-data.md#用-revision-避免覆盖别人的修改)相同。
- `delete` 不会弹出确认，需要确认时由插件自己询问用户。删除后，用户可以在插件详情页的「最近删除」中 7 天内恢复，恢复后 ID、`key` 和正文都不变；如果这期间插件用同一个 `key` 新建了内容，则无法恢复。
- `backlinks` 返回 `{ items: [{ ref, title, snippets }], omitted }`。它只列出插件已获准读取的类型（如有 `cards:read` 才列出卡片），不会弹窗询问，其余来源只计入 `omitted`。`ref` 可以直接交给 `context.app.open`。
- 变化时发 `entity.created`、`entity.updated`、`entity.deleted` 事件，只发给本插件，见[订阅变化](user-data.md#订阅变化)。
- 桌面卸载插件后，它创建的内容保留 7 天，期间重新安装就能找回，超过 7 天后删除。手机上卸载不删除这些内容（它们可能还在其他设备上使用），重新安装后直接接着用。

### 按字段查询

在 `registerKind` 里用 `indexes` 声明哪些 `meta` 字段要用来筛选或排序，类型是 `string`、`number` 或 `boolean`。比如给周记记下年份、心情、是否回顾过，以及用户拖动排出的顺序：

```ts
context.entities.registerKind({
  kind: "note",
  label: "周记",
  icon: NotebookPen,
  open: { page: "review", params: (note) => ({ week: note.key }) },
  indexes: { year: "number", mood: "string", reviewed: "boolean", sortIndex: "number" },
});

const page = await context.entities.query({
  kind: "note",
  where: { year: 2026, mood: { ne: "low" } },
  orderBy: [{ field: "sortIndex" }, { field: "createdAt", direction: "desc" }],
});
const pending = await context.entities.count({ kind: "note", where: { reviewed: false } });
```

- 用 `where` 时必须同时给出 `kind`，字段须在这个类型的 `indexes` 里。
- 条件的写法：
  - 直接给值表示等于，`null` 表示没有值（字段缺失或为 `null`）。
  - 也可以写 `{ eq, ne, in, gt, gte, lt, lte }`，同一字段的多个运算符要同时满足，不同字段之间也是同时满足。
  - `ne` 把没有值的项也算作不等于；`in` 可以包含 `null`。
  - 大小比较只用于字符串和数字。
- `orderBy` 最多两项，可以用 `createdAt`、`updatedAt`、`title` 或声明的字段，`direction` 默认 `asc`。升序时没有值的项排在最前，降序时排在最后；排序值相同的按 ID 定序，翻页不会重复或遗漏。
- `titleContains` 按标题包含查找，英文字母不区分大小写。
- `cursor` 只能接着同一组条件和排序使用，换了条件要从第一页开始。
- 写入时，声明过的字段的值必须是声明的类型或 `null`，否则抛错。类型不符的旧数据（例如声明之前写入的）在查询里按没有值处理。
- `indexes` 是 `meta` 的顶层字段，最多 16 个。声明只在插件运行时生效，修改声明不需要迁移数据。

### 保存资源文件

插件生成的音频、图片等文件用 `context.upload.save` 存进用户的资源存储：用户选的是本地存储就存进资料库的资源目录，选了资源上传插件就上传到那里，与在正文里插入图片走同一条路径。不需要权限。比如把一段周记朗读存成音频，地址记进周记的 `meta`：

```ts
const url = await context.upload.save(
  { name: "2026-W43.mp3", mimeType: "audio/mpeg", content: bytes },
  { signal: context.signal },
);
await context.entities.update(
  note.id,
  { meta: { ...note.meta, audioUrl: url } },
  { expectedRevision: note.revision },
);
```

- 返回的地址可以写进插件内容的 `meta` 或正文，播放、显示时交给 `useResource` 或 `MediaAudio`、`MediaImage`，由 Tau 解析成可加载的地址。
- 文件名由 Tau 改成不重名的名字，扩展名保留。
- 删除插件内容不会删除已保存的文件。
- 只有桌面支持，手机上抛出以 `UPLOAD_UNAVAILABLE` 开头的错误。

上传文件还有另外两个接口，按场景选：

| 场景                                                       | 用                         | 见                                                                 |
| ---------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| 插件生成或拿到的文件，存进用户的资源存储，本地保存也可以   | `context.upload.save`      | 本节                                                               |
| 必须拿到公网地址（例如交给外部服务的参考音频），本地保存不行 | `context.upload.uploadRemote` | [资源上传](providers/upload.md)                                  |
| 编辑器块里让用户选文件插入，地址写进节点                   | `useResourceUpload()`      | [块里的图片、视频与音频](editor-source-media.md#图片视频与音频)，地址字段还要[声明资源字段](editor-source-media.md#声明资源字段) |

## 插件记录

`context.records` 保存插件内部使用的结构化数据，例如分组、操作轨迹、看板的列。记录用户看不到，也不会出现在搜索里；需要用户能看见、能打开的内容，用上面的「插件内容」。**读写自己的记录不需要任何权限。**

比如周记页面顶部有几条用户自己定的回顾问题，按顺序显示：

```ts
// activate 内：声明集合
context.records.registerCollection({ name: "prompts", indexes: { sortIndex: "number" } });

const prompt = await context.records.insert("prompts", { text: "这周最大的收获？", sortIndex: 1024 });
const { items } = await context.records.query("prompts", { orderBy: { field: "sortIndex" } });
await context.records.update(
  "prompts",
  prompt.id,
  { ...prompt.data, text: "这周学到了什么？" },
  { expectedRevision: prompt.revision },
);
```

| 方法                                                       | 说明                                                                 |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| `registerCollection({ name, indexes? })`                   | 声明集合，只能读写已声明的集合。在 `activate` 中声明，停用时自动撤销 |
| `insert(collection, data)`                                 | 新建一条，ID 由 Tau 生成                                             |
| `get(collection, id)`                                      | 读取一条，不存在时为 `null`                                          |
| `query(collection, { where?, orderBy?, cursor?, limit? })` | 分页查询，默认按创建时间升序，默认 50 条，最多 200 条                |
| `count(collection, { where? })`                            | 符合条件的数量                                                       |
| `update(collection, id, data, { expectedRevision })`       | 整体替换 `data`                                                      |
| `delete(collection, id, { expectedRevision })`             | 删除一条                                                             |

- 每条记录是 `{ id, collection, data, createdAt, updatedAt, revision }`。`data` 是不超过 64 KB 的 JSON 对象。
- `indexes`、`where`、`orderBy` 的写法与[按字段查询](#按字段查询)相同，字段取 `data` 的顶层键；自带的排序列是 `createdAt` 和 `updatedAt`。
- 删除是直接删除，**不进「最近删除」**，用户无法恢复。删除插件内容时，与它相关的记录由插件自己删除，可以放进同一个[原子提交](#原子提交)。
- 记录随资料库保存与同步。卸载插件后的保留规则和插件内容相同：桌面保留 7 天，手机不删除。
- 变化时发 `record.created`、`record.updated`、`record.deleted` 事件，事件带 `collection`，只发给本插件，见[订阅变化](user-data.md#订阅变化)。
- 设置、进度这类按键存取的小块数据，用[私有存储](storage-and-network.md#私有存储)更简单。

## 插件关联

`context.links` 把插件内容连到其他内容上，例如周记关联这周读过的卡片、问题关联探究材料。关联是有序的，可以带角色。被关联的卡片、文章、项目文档会在脉络的「被关联」里列出你的内容，按你声明的类型名与图标显示，点击打开你的插件页面；插件停用后照样显示，插件卸载后不再显示。

```ts
const picked = await context.app.pick({ kinds: ["card", "article", "material"], multiple: true });
for (const item of picked) await context.links.add(note.id, item.ref, { role: "read" });

const reads = await context.links.list(note.id, { role: "read" });
for (const state of await context.app.describe(reads.map((link) => link.to)))
  if (state.status === "missing") console.log("这一项已删除");
```

| 方法                              | 说明                                                                    |
| --------------------------------- | ----------------------------------------------------------------------- |
| `add(from, to, { role?, data? })` | 添加一条，排在同一角色的末尾。已经关联过时返回已有的那条，不修改 `data` |
| `list(from, { role? })`           | 按角色、再按顺序列出                                                    |
| `remove(id)`                      | 删除一条，已不存在时不报错                                              |
| `reorder(from, ids)`              | 重排同一角色的关联：`ids` 须恰好是这一角色当前的全部关联                |

- 每条关联是 `{ id, from, to, role, data, createdAt }`。`from` 是本插件内容的 ID，`to` 是任意引用（与 [`pick`、`open`](references.md#选择并打开已有内容) 相同）。
- `role` 由插件定义，与类型 ID 的写法相同，缺省为空字符串。`data` 是不超过 4 KB 的 JSON 对象，用来存少量附加信息，例如对话里的消息位置。一项内容最多 1000 条关联。
- **能关联的目标**与 `describe` 能读到标题的范围相同：用户选择过的、请 Tau 新建的、本插件自己的内容，或插件已获准读取的类型。其余目标会抛错，错误里不透露它是否存在。关联不弹窗申请权限。手机上还要求目标是手机能引用的类型。
- 目标被删除时关联保留，`describe` 返回 `missing`，`<EntityRef>` 显示为已删除；需要清理时由插件 `remove`。
- 删除插件内容时，它发出的关联一起删除；用户从「最近删除」恢复后，这些关联一起恢复。卸载后的保留规则与插件内容相同。
- 关联的增删和重排算作来源内容的变化，发 `entity.updated` 事件。

## 原子提交

一个操作要同时改几处数据时（例如新建周记并关联这周的卡片，或删除周记时一并删除它的记录），用 `context.transaction` 把这些写入作为一个整体提交：全部生效，或者全部不生效。

```ts
await context.transaction(async (tx) => {
  const { id } = await tx.entities.create({ kind: "note", key: week, title: `${week} 周记` });
  for (const item of picked) await tx.links.add(id, item.ref, { role: "read" });
  await tx.records.insert("events", { noteId: id, type: "create" }); // events 集合已声明
});

// 重排：不带 revision 即不论当前版本直接写入
await context.transaction(async (tx) => {
  for (const [index, note] of ordered.entries())
    await tx.entities.update(note.id, { meta: { ...note.meta, sortIndex: index } });
});
```

| `tx` 上的方法                                                                                | 说明                                      |
| -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `entities.create(input)`                                                                     | 立即返回 `{ id }`，同一事务里可以接着使用 |
| `entities.update(id, patch, options?)`、`entities.delete(id, options?)`                      | 同 `context.entities`                     |
| `records.insert(collection, data)`                                                           | 立即返回 `{ id }`                         |
| `records.update(collection, id, data, options?)`、`records.delete(collection, id, options?)` | 同 `context.records`                      |
| `links.add(from, to, options?)`、`links.remove(id)`、`links.reorder(from, ids)`              | 同 `context.links`，`add` 不返回关联      |

- 回调结束后才提交，`transaction` 返回回调的返回值。回调抛错，或任何一条写入失败（参数无效、revision 不符、目标不能关联、`key` 重复等），所有写入都不生效，`transaction` 抛出第一个错误。
- 每个写入方法都要 `await`。没有 `await` 的写入失败同样会让整个事务不提交。回调结束后再调用 `tx` 会抛错。
- 修改和删除的 `options.expectedRevision` 可以省略：给了就核对，不符时整个事务失败；省略就不论当前版本直接写入。事务之外的单条修改仍然必须带 revision。
- 回调里用 `context` 读到的是已提交的数据，看不到本事务还没提交的写入。
- `entities.create` 返回的 ID 在提交失败时作废，不会再分配给其他内容。`links.add` 已经关联过时什么也不做；需要关联的 ID 时，提交后用 `links.list` 读取。
- 一个事务最多 500 条写入。只能写本插件的内容、记录与关联。

用户的卡片、文章等内容的读写见[读写用户数据](user-data.md)。
