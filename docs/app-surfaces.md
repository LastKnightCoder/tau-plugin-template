# 挂到 Tau 的界面里

插件不必让用户先打开自己的页面：可以在首页放一块每天会看一眼的面板，在卡片、文章的「⋯」菜单里加一项操作，在详情正文上方显示和这项内容有关的信息，或者在 Notebook 的「生成」菜单里加一种产物。下面的「问题」插件让用户在卡片上点「转为问题」，记下一个待解决的问题，之后在首页和卡片详情里都能看到它：

```tsx
// src/index.tsx
import { definePlugin, type PluginPageProps } from "@tau/plugins";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

function QuestionPage({ params }: PluginPageProps) {
  return <h1>问题 {String(params.id)}</h1>;
}

export default definePlugin({
  ...__PLUGIN_META__,
  create: () => ({
    activate(context) {
      const questionPage = context.pages.register({
        id: "question",
        title: "问题",
        component: QuestionPage,
        match: "params",
      });
      context.entities.registerKind({
        kind: "question",
        label: "问题",
        open: { page: "question", params: (question) => ({ id: question.id }) },
        indexes: { source: "string", status: "string" },
      });
      context.actions.register({
        id: "to-question",
        title: "转为问题",
        targets: ["card", "article", "document"],
        run: async (target) => {
          const [info] = await context.app.describe([target]);
          const question = await context.entities.create({
            kind: "question",
            key: crypto.randomUUID(),
            title: info?.status === "ok" ? `关于「${info.title}」` : "新问题",
            meta: { source: `${target.kind}:${target.id}`, status: "open" },
          });
          await context.links.add(question.id, target, { role: "source" });
          await questionPage.open({ id: question.id });
        },
      });
    },
  }),
});
```

问题存成插件自己的内容，`registerKind`、`create`、`links` 的用法见[插件内容与记录](plugin-content.md)。

## 首页面板

在首页（桌面的「今日」页、手机的「今天」页）放一块面板，适合展示进度、待处理的条目这类每天会看一眼的内容。接着上面的例子，列出还没解决的问题数：

```tsx
import { useEffect, useState } from "react";
import type { PluginHomePanelProps } from "@tau/plugins";

function OpenQuestionsPanel({ context }: PluginHomePanelProps) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    void context.entities
      .count({ kind: "question", where: { status: "open" } })
      .then(setCount);
  }, [context]);
  if (!count) return null;
  return <p className="yourname:text-ink-2">还有 {count} 个问题没想清楚</p>;
}

// activate 内；questionList 为问题列表页的句柄
context.home.registerPanel({
  id: "open-questions",
  title: "待解决的问题",
  component: OpenQuestionsPanel,
  size: "compact",
  action: { title: "查看全部", run: () => questionList.open() },
});
```

| 字段        | 说明                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `id`        | 局部 ID                                                                       |
| `title`     | 面板标题，由 Tau 显示在面板顶部                                               |
| `component` | 面板正文，收到 `context` 与 `registerDismiss`；返回 `null` 时整块不显示       |
| `size`      | 可选。`wide`（默认）占整行；`compact` 宽度足够时与其他紧凑面板并排显示        |
| `action`    | 可选。`{ title, run }`，Tau 画在标题行右侧（如「查看全部」），点击调用 `run`  |

- Tau 画面板的外框、标题和标题行右侧的入口，组件只负责正文，不要再套一层卡片，也不要在正文里另放「查看全部」这类入口。
- 新面板排在首页末尾。用户点首页右上角的「调整首页」后可以拖动面板调整位置或隐藏，布局随资料库保存；插件停用后面板消失，重新启用后回到原来的位置。
- 正文渲染出错时，这块面板显示错误和「重试」，不影响首页其他内容。
- 首页只在主窗口显示，打开首页时组件才会渲染；需要随时更新的数据在组件里订阅（如 `context.events`），卸载时取消。
- 面板里自己画的浮层（底部面板等）用 props 里的 `registerDismiss(close)` 登记，按 Esc 或手机系统返回时先关浮层，用法与页面的 [`pageContext.registerDismiss`](pages.md#页面显示状态与-esc) 相同。它在类型上是可选属性，调用时写 `registerDismiss?.(close)`。
- 需要按平台显示不同的正文时，在组件里读 `usePluginEnvironment()`，见[多端适配 · 读取运行环境](portability.md#读取运行环境)。

手机上面板显示在「今天」页的问答条下面、日程上面，`compact` 面板两个一行排成小卡（约 160 × 130），没有「调整首页」，按插件启用顺序排列；小卡里放一个大数字加一两个按钮最合适，记录类操作用按钮跳到插件页面。声明了 `action` 时，手机上点击卡片标题、正文或空白处都会执行它，所以正文里的按钮、链接和输入控件要在自己的事件处理里调用 `event.stopPropagation()`；自绘浮层即使挂在 Portal 里，事件也会沿 React 组件树冒泡，同样要处理。

## 对象动作

在卡片、文章、项目文档、材料（划线、PDF 标注、剪藏）、对话消息与命令面板里加一项操作，用户点击时插件收到这个对象。开头例子里的「转为问题」就是对象动作：

| 字段      | 说明                                                                |
| --------- | ------------------------------------------------------------------- |
| `id`      | 局部 ID                                                             |
| `title`   | 菜单里显示的名称                                                    |
| `icon`    | 可选。图标组件（同[侧边栏图标](pages.md#图标)），省略时使用默认图标 |
| `targets` | 挂在哪类对象上，见下表                                              |
| `run`     | 用户点击时调用，收到这个对象；参数类型随 `targets` 收窄             |

| 目标           | 出现在                                                           | `run` 收到                                                  |
| -------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `card`         | 卡片的「⋯」菜单（卡面、列表、预览、详情）                        | `{ kind: "card", id }`                                      |
| `article`      | 文章的「⋯」菜单（列表、详情）                                    | `{ kind: "article", id }`                                   |
| `document`     | 项目文档树里文档的「⋯」菜单                                      | `{ kind: "document", id }`                                  |
| `material`     | PDF 标注的工具条与标注列表、网页剪藏的「⋯」菜单                  | `{ kind: "material", id }`                                  |
| `chat-message` | 对话消息动作行末尾的「⋯」（主对话、PDF、视频笔记、Notebook）     | `{ kind: "chat-message", session, messageIds, role, text }` |
| `text`         | 命令面板：输入任何文字后，「记录」组末尾出现「标题：输入的文字」 | `{ kind: "text", text }`                                    |

- 插件动作排在 Tau 自己的操作之后、删除之前，几个插件的动作按启用顺序排列。只有图标按钮的地方（PDF 标注、对话消息）由 Tau 加一个「⋯」，插件动作收在里面。
- 用户点过的对象和 [`pick` 选中的](references.md#选择并打开已有内容)一样：之后不需要读取权限就能用 `describe` 取标题、用 `EntityRef` 显示、用 `links` 关联；读正文仍需要对应的读取权限。
- 对话消息登记的是所在会话 `session`。消息正文 `text` 由用户亲手交给插件，不需要权限；`messageIds` 是这条消息在会话里的记录 ID，一条回答可能有多条。消息还在生成时不列插件动作。
- 引用了卡片或文章的项目文档，收到的是被引用的卡片或文章。
- 命令面板里的文字由用户亲手输入，不需要权限，也不会登记为引用。
- 只在主窗口出现，独立编辑窗口不列插件动作。`run` 出错时 Tau 显示一条通知。
- `context.materials.actions` 只给 Tau 自己的材料操作，不包含其他插件注册的对象动作。

手机上只有卡片、文章和项目文档详情页的「更多」菜单，其他位置和 `material`、`chat-message`、`text` 目标只在桌面，见[多端适配](portability.md#各平台可用的接口)。

## 详情区块

在卡片、文章、项目文档详情的正文上方放一小块内容。接着上面的例子，列出从这张卡片转出的问题数：

```tsx
import { useEffect, useState } from "react";
import type { PluginEntityPanelProps } from "@tau/plugins";

function RelatedQuestions({ context, target }: PluginEntityPanelProps) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    void context.entities
      .count({ kind: "question", where: { source: `${target.kind}:${target.id}` } })
      .then(setCount);
  }, [context, target.kind, target.id]);
  if (!count) return null;
  return <p className="yourname:text-ink-2">由它引出了 {count} 个问题</p>;
}

// activate 内
context.views.registerEntityPanel({
  id: "related-questions",
  kinds: ["card", "article", "document"],
  component: RelatedQuestions,
});
```

| 字段        | 说明                                                               |
| ----------- | ------------------------------------------------------------------ |
| `id`        | 局部 ID                                                            |
| `kinds`     | 挂在哪类对象的详情里：`card`、`article`、`document`（项目文档）    |
| `component` | 收到 `context` 与 `target`（`{ kind, id }`）；返回 `null` 时不占位 |

- 区块渲染在 AI 洞见报告之后、正文之前，几个插件的区块按启用顺序排列。Tau 不加外框和标题，区块宜小而轻。
- `target` 只是引用：读标题、正文仍按[权限](permissions.md)，挂在详情里不会自动获得读取权限。引用了卡片或文章的项目文档，收到的是被引用的卡片或文章。
- 用户在详情页之间切换时，组件不会重新挂载，只换 `target`；按 `target` 取数据的 effect 要把它放进依赖。
- 渲染出错时这一块显示错误和「重试」，不影响详情页其他内容。只在主窗口出现，独立编辑窗口不显示。
- 详情区块只在桌面，见[多端适配](portability.md#各平台可用的接口)。

## Notebook 输出

在 Notebook 的「生成」菜单（产物组的 ＋ 与资料页的「基于这份资料」）里加一种产物。对话框、资料勾选、AI 生成和执行过程页都由 Tau 负责，AI 会按需检索、补读用户勾选的资料；插件只说明要什么，拿到生成的正文后自己处理。接着上面的例子，让 AI 从资料里提出一组值得追问的问题：

```tsx
import type { PluginNotebookOutputViewProps } from "@tau/plugins";

function QuestionSetView({ entity }: PluginNotebookOutputViewProps) {
  const questions = Array.isArray(entity.meta.questions) ? entity.meta.questions : [];
  if (entity.meta.status === "failed") return <p>生成失败：{String(entity.meta.error)}</p>;
  return (
    <ol>
      {questions.map((question, index) => (
        <li key={index}>{String(question)}</li>
      ))}
    </ol>
  );
}

// activate 内
context.entities.registerKind({
  kind: "question-set",
  label: "问题清单",
  open: { page: "question", params: (set) => ({ id: set.id }) },
});
context.notebooks.registerOutput({
  id: "questions",
  title: "问题清单",
  description: "从资料里提出值得追问的问题",
  kind: "question-set",
  view: QuestionSetView,
  async prepare({ notebook }) {
    const set = await context.entities.create({
      kind: "question-set",
      key: crypto.randomUUID(),
      title: `${notebook.title} · 问题清单`,
      meta: { status: "generating" },
    });
    return {
      entity: set.id,
      title: "提出问题",
      instructions: "读完资料后提出 5 到 10 个值得继续追问的问题，每行一个，不加编号。",
      reminders: ["不要输出标题或说明"],
    };
  },
  async complete({ entity, text, task }) {
    task.phase("整理问题");
    const questions = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const set = await context.entities.get(entity);
    if (!set) return;
    await context.entities.update(
      entity,
      { meta: { status: "done", questions } },
      { expectedRevision: set.revision },
    );
  },
  async fail({ entity, reason, message }) {
    const set = await context.entities.get(entity);
    if (!set) return;
    if (reason === "cancelled") {
      await context.entities.delete(entity, { expectedRevision: set.revision });
      return;
    }
    await context.entities.update(
      entity,
      { meta: { status: "failed", error: message } },
      { expectedRevision: set.revision },
    );
  },
});
```

| 字段          | 说明                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| `id`          | 局部 ID                                                                                   |
| `title`       | 菜单、对话框与执行过程页里的名称                                                          |
| `icon`        | 可选。图标组件（同[侧边栏图标](pages.md#图标)）                                           |
| `description` | 可选。对话框标题下的一句话                                                                |
| `kind`        | 产物对应的插件内容类型，须先用 `registerKind` 声明                                        |
| `options`     | 可选。放在对话框中间的选项区组件，收到 `{ context, target, value, onChange, setBlocker }` |
| `view`        | 产物在 Notebook 阅读区里的显示，收到 `{ context, entity, notebook }`                      |
| `prepare`     | 用户点「开始生成」时调用：建好产物占位，返回 `{ entity, title, instructions, reminders? }` |
| `complete`    | 生成完成后调用：收到最终正文 `text` 与 `task`（`phase(text)`、`progress(done, total)`）   |
| `fail`        | 可选。生成失败、`complete` 抛错或用户停止时调用，收到 `{ entity, reason, message }`        |

- `prepare` 收到 `{ notebook, resources, userPrompt, options, signal }`：`notebook` 是 `{ id, title }`，`resources` 是用户勾选的资料，只有 `{ id, name }`；`userPrompt` 是用户在「额外要求」里写的话，可能为空。
- `prepare` 返回的 `entity` 必须是本插件 `kind` 类型的内容，否则这次生成失败。`title` 显示在执行过程页上。
- `instructions` 只写这一种产物的要求与输出格式。资料清单、检索工具的用法和「先读资料再写」等通用规则由 Tau 补上，不要重复。
- 选项区的 `value` 由插件定义（JSON），Tau 原样保存并在 `prepare` 时交回；`setBlocker(原因)` 让「开始生成」不可用，并在对话框底部显示原因，`setBlocker(null)` 解除。
- `complete` 期间用 `task.phase` 写当前阶段（如「合成语音」），用 `task.progress(done, total)` 显示进度条，`total` 为 `0` 时不显示进度条。耗时的处理把 `signal` 传下去，用户停止时及时退出。
- `fail` 的 `reason` 为 `cancelled`（用户停止）或 `failed`（生成或 `complete` 出错）；`message` 是给用户看的原因，用户停止时为「已停止」，出错时为错误信息。可以像示例一样把它存进产物，在 `view` 里显示。
- 插件读不到资料内容，只拿到资料名称和生成的正文。用户在对话框里勾选资料并点「开始」即视为同意，不需要另外申请权限。
- `prepare` 成功后，产物就出现在这个 Notebook 的产物列表里，点开时显示 `view`，插件不需要自己建关联。插件停用后，它的产物不在列表里显示。
- 生成用的是用户在 Notebook 里选的模型，不需要声明 `ai:` 权限，也不占插件的 [AI 额度](ai.md#用量与额度)；用量在 Tau 的用量统计里记在「Notebook · 插件名」名下。
- 失败或停止时，Tau 等 `fail` 完成后才允许重试。「重新生成」时，产物还在就沿用同一份任务说明重跑生成与 `complete`；插件已经删掉了产物，就重新调用 `prepare`，生成一个新产物。
- Notebook 输出只在桌面主窗口，见[多端适配](portability.md#各平台可用的接口)。

产物要配音频时，用[朗读](notifications-and-voice.md#朗读)合成、用[保存资源文件](plugin-content.md#保存资源文件)存起来；生成完要提醒用户，发一条[通知](notifications-and-voice.md#通知)。
