# 待办与日程

插件可以读取待办项目和日历，创建带提醒的待办与日程，修改重复任务的某一次，并把变化接入外部服务。下面用「评审准备」说明：先让用户选好待办项目和日历，再创建任务、安排评审，最后保存同步进度。

先在 manifest 声明需要的权限；只读插件只保留 `:read`，需要删除时再加 `todos:delete` 或 `calendar:delete`：

```json
{
  "permissions": [
    "todos:read", "todos:write",
    "calendar:read", "calendar:write"
  ]
}
```

权限的申请与拒绝处理见[权限](permissions.md)。各平台及客户端支持范围见[多端适配](portability.md#待办与日程接口)。

## 选择待办项目和日历

`todoLists` 列出 Tau 界面里的待办项目，`calendars` 列出日历。把返回的项目展示给用户选择，保存它的 id，不要根据名称猜编号：

```ts
import type { PluginContext } from "@tau/plugins";

async function loadTargets(context: PluginContext) {
  const lists = await context.data.todoLists.query({ archived: false, limit: 100 });
  const calendars = await context.data.calendars.query({ archived: false, limit: 100 });
  return { lists, calendars };
}
```

两类目录都提供 `get(id)` 和 `query({ archived?, limit?, cursor? })`。默认包含归档项目，每页 1 至 100 项，默认 50；还有 cursor 时，保持筛选条件继续读取。

| 返回字段 | 含义 |
| --- | --- |
| `id`、`revision`、`title` | 身份、版本和名称 |
| `archived` | 是否归档 |
| `writable`、`readonlyReason?` | 能否写入；不能写时给出原因 |
| `color`、`visible` | 只有日历提供：颜色和显示状态 |

选择写入位置时检查 writable。日历 visible 只表示是否显示，不表示能否写入。插件能选择已有目录，不能通过这些接口新建、改名或删除目录。

## 读取待办与日程

`todos.get(id)`、`calendar.get(id)` 读取当前对象，不存在时返回 null。id 是不透明字符串，只能保存和传回，不能解析或拼接。

```ts
import type { PluginContext } from "@tau/plugins";

async function loadReviews(context: PluginContext, listId: string) {
  const tasks = await context.data.todos.query({
    source: "all", listId, completed: false, limit: 50,
  });
  const events = await context.data.calendar.query({
    view: "stored", limit: 50,
  });
  return { tasks, events };
}
```

| todos.query 参数 | 含义 |
| --- | --- |
| `source` | all（默认）包含独立待办和正文勾选项；todo 只读独立待办，document 只读正文待办 |
| `view` | tasks（默认）返回普通任务或重复系列；occurrences 返回重复任务的每一次，必须给 start、end |
| `listId`、`archived`、`completed` | 按待办项目、归档和完成状态筛选；archived 默认 false |
| `keyword` | 按关键词筛选 |
| `start`、`end` | YYYY-MM-DD 的日期窗口，须同时提供，窗口不超过 366 天 |
| `limit`、`cursor` | 每页 1 至 100 项，默认 50；cursor 原样传回 |

普通待办按截止日期筛选；实例按安排后的日期进入窗口，改期不改变原始身份。列表分页用于浏览；需要离线续读或发现删除时用[按游标读取变化](#按游标读取变化)。

calendar.query 的 display 视图需要 start、end；stored 视图可以省略日期窗口，只列实际保存的日程，可用 calendarIds 筛选。每页最多 100 项；日期窗口可以用 YYYY-MM-DD 或带时区的 ISO 时间。

| 对象字段 | 含义 |
| --- | --- |
| 待办 `listId`、`reminders` | 所属待办项目和提醒；没有归属时 listId 为 null |
| 待办 `source?` | 正文勾选项所在的卡片、文章、项目文档或日记 |
| 待办 `recurrence` | 分段重复规则；没有配置时为 null，停止后保留历史分段 |
| 实例 `occurrence` | taskId、seriesId、originalDate 和 state；originalDate 是原始日期 |
| 日程 `kind` | event 为独立日程，todo-schedule 来自待办安排，virtual 是虚拟标记 |
| 日程 `notesRef` | 备注正文的引用，没有备注时为 null |
| `writable`、`readonlyReason?` | 修改前检查可写性，再使用刚读到的 revision |

正文待办被排除或提升为独立待办后，不再作为正文待办返回。修改正文待办会回到原文，不会另建独立任务。系统只读日程和虚拟标记不能按普通日程修改；关联待办的标题跟随待办，改标题应使用待办接口。

## 创建带提醒的待办

把用户选中的待办项目 id 传入，为「评审准备」设置截止时刻和提前五分钟提醒：

```ts
import type { PluginContext } from "@tau/plugins";

async function createReviewTask(
  context: PluginContext, listId: string, requestId: string,
) {
  return context.data.todos.create({
    title: "评审准备", listId,
    dueAt: "2026-12-04T10:00:00+08:00",
    reminders: [{ offsetMs: 300000 }],
  }, { requestId });
}
```

requestId 在调用前保存；重试复用，不能每次生成新值。同一插件、同一资料库、同一请求与输入返回原对象的当前值；更换输入会拒绝。原结果被删除或撤销后，旧请求不会再创建对象。它保护 Tau 侧创建，不包含外部网络事务或多台设备同时执行的互斥。

todos.update 可修改 title、dueAt、listId、reminders。省略字段保持原值，dueAt: null 清除截止日期，reminders: [] 清空提醒。普通任务的完成状态用 setCompleted；删除用 delete，有子待办时会拒绝。修改与删除都要传 expectedRevision，冲突处理见[读写用户数据](user-data.md#用-revision-避免覆盖别人的修改)。

### 提醒的两种写法

偏移 offsetMs 等于基准时刻减提醒时刻，单位毫秒。正值表示提前，负值表示基准之后。绝对时刻 at 必须带时区，两种写法不能放在同一条提醒里。

| 来源 | 提醒写法 | 限制 |
| --- | --- | --- |
| 普通独立待办 | `[{ offsetMs: 300000 }]` | 最多三条，需要截止时间 |
| 重复独立待办 | `[{ offsetMs: -32400000 }]` | 一条，以实例所在日零点为基准，限定当日偏移 |
| 普通正文待办 | `[{ at: "2026-12-04T09:00:00+08:00" }]` | 一条，无截止日期也能设置；改截止日期不会移动此提醒 |
| 重复正文待办 | `[{ offsetMs: -32400000 }]` | 一条，以实例所在日零点为基准，限定当日偏移 |
| 定时日程 | `[{ offsetMs: 300000 }]` | 最多三条，以开始时刻为基准 |
| 全天日程 | `[{ offsetMs: -32400000 }]` | 最多三条，以当天零点为基准 |

当日偏移可表示零点到当天末尾；跨日、无法无歧义表达的夏令时情况会拒绝，不截断或取模。日程只接受 offsetMs。已有重复独立待办的追加提醒会完整读出，写入不能无声删去它们。

待办提醒的类型为 PluginTodoReminder，读取时用 `"at" in reminder` 区分。reminders 为 null 表示该来源没有开放提醒能力，空数组才表示没有提醒。

选择一个普通正文待办，为它设置绝对提醒：

```ts
import type { PluginContext } from "@tau/plugins";

async function remindDocumentTask(context: PluginContext, taskId: string) {
  const task = await context.data.todos.get(taskId);
  if (!task?.source || task.recurrence) throw new Error("请选择普通正文待办");
  if (!task.writable) throw new Error(task.readonlyReason ?? "这个待办不能修改");
  return context.data.todos.update(task.id, {
    reminders: [{ at: "2026-12-04T09:00:00+08:00" }],
  }, { expectedRevision: task.revision });
}
```

## 重复规则与单次实例

创建每周五的「评审准备」，仍然使用已选待办项目：

```ts
import type { PluginContext } from "@tau/plugins";

async function createWeeklyReview(
  context: PluginContext, listId: string, requestId: string,
) {
  return context.data.todos.create({
    title: "评审准备", listId,
    recurrence: {
      type: "weekly", interval: 1,
      startDate: "2026-12-01", weekdays: [5],
    },
  }, { requestId });
}
```

| 规则字段 | 含义 |
| --- | --- |
| `type` | daily、weekdays、weekly、monthly、yearly 或 custom |
| `interval`、`startDate` | 间隔与开始日期，必填；间隔为 1 至 1000，日期为 YYYY-MM-DD |
| `endDate`、`maxOccurrences` | 结束日期与最多次数，省略或 null 表示不设对应限制 |
| `weekdays` | 星期集合，0 是周日，6 是周六；读回时去重排序 |
| `monthDay`、`yearMonth`、`yearDay` | 对应规则的月日、年中月份和日期 |
| `excludeHolidays` | 是否排除节假日；实例所需日期资料无法取得时会报错 |

只支持 Tau 能表达的结构化规则，不接受任意 RRULE。改为重复任务会改变提醒含义时，先显式清空提醒，再设置规则和提醒。

setRecurrence 用根任务 id 和最新 revision，指定从哪一天开始生效。rule: null 表示从当天起停止：

```ts
import type { PluginContext } from "@tau/plugins";

async function stopReview(context: PluginContext, taskId: string, effectiveFrom: string) {
  const task = await context.data.todos.get(taskId);
  if (!task?.recurrence || task.occurrence) throw new Error("请选择重复任务的系列");
  if (!task.writable) throw new Error(task.readonlyReason ?? "这个待办不能修改");
  return context.data.todos.setRecurrence(task.id, {
    effectiveFrom, rule: null,
  }, { expectedRevision: task.revision });
}
```

rule 也可以是完整的新规则。生效日之前的分段和已存实例状态保留；已有更晚生效分段时不能越过它改写历史。原样重设同一生效日的规则不改变版本。

用 occurrences 视图取得实例，再通过该实例的 id 改期。不要把系列 id 和日期拼成实例 id：

```ts
import type { PluginContext } from "@tau/plugins";

async function postponeReview(context: PluginContext, instanceId: string) {
  const instance = await context.data.todos.get(instanceId);
  if (!instance?.occurrence) throw new Error("请选择评审的某一次");
  if (!instance.writable) throw new Error(instance.readonlyReason ?? "这个实例不能修改");
  return context.data.todos.setOccurrenceState(instance.id, {
    scheduledAt: "2026-12-07",
  }, { expectedRevision: instance.revision });
}
```

| 实例补丁 | 结果 |
| --- | --- |
| `completed: true / false` | 完成或取消完成；完成会取消跳过 |
| `skipped: true / false` | 跳过或恢复；跳过会取消完成 |
| `scheduledAt: 日期或带时区的时刻` | 仅改期这一例 |
| `scheduledAt: null` | 清除改期，恢复原日期 |

省略的状态保持，completed 和 skipped 不能同时为 true。一次补丁整体提交，不会留下半笔状态。setCompleted 也能操作实例；根系列不能整系列完成。

改期不改变 originalDate 和实例 id。get 能读取跳过或改出原窗口的实例；规则使旧实例失效时返回 null。实例 update 只支持改期，实例 delete 表示跳过；标题和待办项目跟随系列。

### 分页读取已保存的实例状态

同步完成、跳过或改期记录时，用 occurrenceStates.query，避免展开无限重复序列：

```ts
import type { PluginContext, PluginTodoOccurrenceState } from "@tau/plugins";

async function loadReviewStates(context: PluginContext, taskId: string) {
  const items: PluginTodoOccurrenceState[] = [];
  let cursor: string | undefined;
  do {
    const page = await context.data.todos.occurrenceStates.query({ taskId, cursor, limit: 100 });
    items.push(...page.items);
    cursor = page.cursor;
  } while (cursor);
  return items;
}
```

返回 items、taskRevision 和可选 cursor。每项包含 taskId、seriesId、originalDate、state、active；state 含 completedAt、skipped、scheduledAt。不存储的默认状态不返回，失效旧实例的状态仍可读，但 active=false。

页间数据变化会抛 PluginConflictError，须重新读取根任务并从头枚举。用于修改的实例 id 从 occurrences 查询或此前保存的实例取得，不根据状态项拼接。这种分页游标与变化流的消费检查点用途不同。

## 安排日程与编辑备注

创建日程时可以同时写入提醒和备注：

```ts
import type { PluginContext } from "@tau/plugins";

async function createReviewEvent(
  context: PluginContext, calendarId: string, requestId: string,
) {
  return context.data.calendar.create({
    title: "评审", calendarId, allDay: false,
    start: "2026-12-04T10:00:00+08:00",
    end: "2026-12-04T11:00:00+08:00",
    reminders: [{ offsetMs: 300000 }],
    notes: { markdown: "议题：评审准备\n\n- 进度\n- 风险" },
  }, { requestId });
}
```

calendar.update 可修改 title、start、end、allDay、calendarId、reminders。定时日程用带时区的 ISO 时间，精确到分钟；全天日程用 YYYY-MM-DD，end 不包含当天，例如当天全天的 end 是次日。

编辑已有备注用 notesRef。如果还没有备注，ensureNotes 显式建立空正文，读取日程本身不会创建备注：

```ts
import type { PluginContext } from "@tau/plugins";

async function addReviewAgenda(context: PluginContext, eventId: string) {
  let event = await context.data.calendar.get(eventId);
  if (!event?.writable) throw new Error(event?.readonlyReason ?? "这个日程不能修改");
  if (!event.notesRef) {
    event = await context.data.calendar.ensureNotes(event.id, { expectedRevision: event.revision });
  }
  if (!event.notesRef) throw new Error("没有取得备注引用");
  const notes = await context.content.read(event.notesRef);
  if (!notes) throw new Error("备注已不存在");
  return context.content.edit(event.notesRef, {
    op: "append", content: { markdown: "\n\n补充：确认下一步负责人。" },
  }, { expectedRevision: notes.revision });
}
```

备注使用 calendar:read / calendar:write，不借用卡片权限。备注编辑与日程属性更新是分别提交的条件操作；编辑后重新读取日程再使用它的 revision。正文输入和编辑方式见[正文](document-body.md)。

## 按游标读取变化

changes.query 返回上次检查点之后新增、修改或删除的身份，再用 get 读当前对象。第一次不传 cursor，会读取全量并补查期间变化；之后传回游标续读。

| domains 中的值 | 读取当前对象 | 权限 |
| --- | --- | --- |
| `todo` | todos.get(id) | todos:read |
| `todo-list` | todoLists.get(id) | todos:read |
| `event` | calendar.get(id) | calendar:read |
| `calendar` | calendars.get(id) | calendar:read |

todoSource 缺省 todo，只读独立待办；document 只读正文待办，all 包含两类。它与 todos.query 的 source 默认 all 不同。请求多个域时需要全部读取权限，缺一项就整体失败。

下面消费全部待办的变化。回调须保存本项的处理结果并允许重放，成功后才保存本页游标：

```ts
import {
  PluginSyncResetRequiredError,
  type PluginContext, type PluginTodo, type PluginDataChange, type PluginChangesPage,
} from "@tau/plugins";

async function consumeTaskChanges(
  context: PluginContext,
  consume: (change: PluginDataChange, current: PluginTodo | null) => Promise<void>,
) {
  const key = `todo-sync:${context.workspaceId}`;
  const saved = await context.storage.get(key);
  let cursor = typeof saved === "string" ? saved : undefined;
  for (;;) {
    let page: PluginChangesPage;
    try {
      page = await context.data.changes.query({ domains: ["todo"], todoSource: "all", cursor });
    } catch (error) {
      if (error instanceof PluginSyncResetRequiredError && error.reason !== "protocol-changed") {
        await context.storage.set(key, null);
      }
      throw error;
    }
    for (const change of page.items) {
      await consume(change, await context.data.todos.get(change.id));
    }
    await context.storage.set(key, page.cursor);
    if (!page.hasMore) return page.checkpoint;
    cursor = page.cursor;
  }
}
```

返回 `{ mode, items, cursor, hasMore, checkpoint? }`。items 每项为 `{ domain, id, operation }`，operation 是 upsert/delete。首次全量及其补查的 mode 为 snapshot，之后为 changes；整轮结束才有 checkpoint。

- 返回身份，不返回历史内容。同一身份可能重复，get 可以看到更新的状态。历史删除也可能已恢复，删除外部对象前同样用 get 复验；get 为 null 才按不存在处理。
- 全量包含已完成、归档和无截止日对象，不包含虚拟日历标记。不按日期、待办项目或完成状态过滤，避免移出筛选范围的对象悄悄消失。
- 发生冲突或外部调用失败时，不推进游标。映射与处理结果适合存入 records，保存方式见[插件记录](plugin-content.md#插件记录)。
- 示例不根据「本轮没出现」删除已有对象。需要缺失对账时，把本轮出现的身份集合也一起保存，等全量和补查成功结束再比较；恢复半轮游标时也要恢复这份集合。
- 换资料库、换设备、授权或查询范围变化、历史过期、游标损坏会抛 PluginSyncResetRequiredError。保留映射，丢弃游标，再完整读取；protocol-changed 需要先核对客户端支持，见[多端适配](portability.md#待办与日程接口)。
- 在插件启动、恢复前台以及收到 todos.changed / calendar.changed 时续读。事件用来唤醒读取，不承担离线历史；它们也不保证每次变化只通知一次。

日程备注和正文待办的编辑保存后会进入变化流；读取不会强行停止打开中的编辑器。外部冲突策略、无法表达的重复或时区数据以及多设备执行协调，由插件明确处理，不能把不支持的数据静默展开后宣称可无损回写。
