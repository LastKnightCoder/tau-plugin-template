# 页面与入口

插件需要一块完整的界面时（书架、统计、看板），注册一个页面：它和 Tau 自己的页面一样前进、后退，切走后保留状态。页面本身不会出现在任何地方，再注册一个功能入口，用户才能在桌面侧边栏或手机「我的」里找到它。下面是一个读书插件的书架页：

```tsx
// src/index.tsx
import { definePlugin, type PluginPageProps } from "@tau/plugins";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

function ShelfPage({ context }: PluginPageProps) {
  return <h1>书架</h1>;
}

export default definePlugin({
  ...__PLUGIN_META__,
  create: () => ({
    activate(context) {
      const shelf = context.pages.register({
        id: "shelf",
        title: "书架",
        component: ShelfPage,
      });
      context.navigation.registerEntry({
        id: "shelf",
        title: "书架",
        page: shelf,
      });
    },
  }),
});
```

## 页面

`context.pages.register` 声明一个页面：

| 字段        | 说明                                                                       |
| ----------- | -------------------------------------------------------------------------- |
| `id`        | 局部 ID，见 [ID 规则](plugin-basics.md#id-规则)                            |
| `title`     | 页面标题                                                                   |
| `component` | React 组件，收到 `context`、`params`、`pageContext` 三个属性               |
| `match`     | 可选。默认 `"single"`，页面只有一个实例；`"params"` 表示按参数区分多个实例 |
| `getId`     | 可选。`match: "params"` 时，用它从参数算出实例身份；默认按全部参数区分     |

`register` 返回页面句柄，提供 `open(params?)` 和 `dispose()`。在命令、按钮或其他页面里用 `shelf.open()` 打开页面，不要自己操作浏览器地址或历史记录。

只是从别的页面打开的详情页可以不注册入口；用户要能直接找到的页面，注册一个[功能入口](#功能入口)。

### 手机页面的布局边界

Tau 提供的页面容器已经避开顶部导航和底部系统安全区，底部安全区固定在滚动区外；键盘弹出时，容器自动缩小到键盘上方，底部安全区预留归零。所有插件默认遵守这一边界，不需要额外注册选项。

- 普通内容由 Tau 滚动。页面根节点可用 `min-height: 100%` 铺满容器，需要吸底的操作条用 `position: sticky; bottom: 0`，放在页面内容末尾。
- 页面与底栏只添加自身的间距，不再读取 `env(safe-area-inset-bottom)`，也不追加系统安全区占位。
- 高度相对于页面容器计算，不用 `100vh`、`100dvh` 或 `position: fixed` 把页面撑到整个屏幕。
- 全屏浮层不属于页面内容容器，优先使用 `@tau/ui` 的 `Dialog`、`Drawer`，由组件处理安全区和系统返回。

### 带参数的页面

同一个页面需要展示不同对象（例如书架上不同的书）时，使用 `match: "params"`：

```tsx
import type { PluginPageProps } from "@tau/plugins";

function BookPage({ params }: PluginPageProps) {
  return <h1>书籍：{String(params.bookId)}</h1>;
}

// activate 内
const book = context.pages.register({
  id: "book",
  title: "书籍",
  component: BookPage,
  match: "params",
  getId: (params) => String(params.bookId),
});

await book.open({ bookId: "42" });
```

- 参数是一个扁平对象，值只能是字符串、有限数字或布尔值，不支持数组、嵌套对象和 `null`。
- 已经打开的同一实例会被复用，不会重复打开。
- 有了 `getId`，`{ bookId: "42", tab: "notes" }` 和 `{ bookId: "42" }` 会打开同一个实例；没有 `getId` 时它们是两个实例。
- 定位用的参数（如要滚动到的章节）不要参与 `getId`。同一实例需要重复定位时，打开时另传一个新的请求标识（如 `{ bookId: "42", chapter: 3, seek: Date.now() }`），让定位的 effect 同时依赖目标和请求标识；记下已处理过的请求标识，用户返回这个页面时就不会再定位一次、把滚动位置重置。

### 打开外部链接

打开网页用 `window.open(url, "_blank", "noopener,noreferrer")`，或真实的 `<a href={url} target="_blank" rel="noopener noreferrer">`，Tau 会用系统浏览器打开。自己画的浮层不要拦截链接的点击事件，否则 Tau 收不到。手机上同样用系统浏览器打开，打开失败时 Tau 会提示用户。

### 向 AI 提供页面上下文

用户在你的页面上和 AI 对话时，AI 可以通过 Tau 内置的「获取当前上下文」工具了解用户正在看什么。用 `pageContext.register` 告诉 AI 当前页面的状态：

```tsx
import { useEffect, useState } from "react";
import type { PluginPageProps } from "@tau/plugins";

function BookPage({ params, pageContext }: PluginPageProps) {
  const [chapter, setChapter] = useState(1);

  useEffect(() => {
    const registration = pageContext.register(() => ({
      bookId: String(params.bookId),
      chapter,
    }));
    return () => {
      registration.dispose();
    };
  }, [pageContext, params.bookId, chapter]);

  return (
    <button type="button" onClick={() => setChapter(chapter + 1)}>
      下一章（当前第 {chapter} 章）
    </button>
  );
}
```

- 提供函数返回任意 JSON 值，内容和形状完全由你决定。它应该只读取现有状态，不发起请求，也不修改数据。
- 状态变化时像示例一样重新注册，避免提供函数读到旧值。
- 每个页面实例同一时间只有一个提供函数。页面隐藏、卸载或插件停用时会自动清理。
- 只有当前显示的页面实例会被读取。

页面上下文只是让 AI 知道用户在看什么。需要让 AI 能对页面执行操作，另外用 [MCP 工具](mcp.md)提供。

### 离开前确认

页面有未保存的编辑时，用 `pageContext.registerLeaveGuard` 拦下离开：返回 `false` 或解析为 `false` 的 Promise 时，留在当前页面。

```tsx
import { useEffect, useState } from "react";
import type { PluginPageProps } from "@tau/plugins";

function NotePage({ pageContext }: PluginPageProps) {
  const [draft, setDraft] = useState("");
  const dirty = draft !== "";

  useEffect(() => {
    if (!dirty) return;
    const guard = pageContext.registerLeaveGuard(() =>
      window.confirm("放弃未保存的修改？"),
    );
    return () => {
      guard.dispose();
    };
  }, [dirty, pageContext]);

  return <textarea value={draft} onChange={(event) => setDraft(event.target.value)} />;
}
```

守卫不能代替保存：应用被关闭、手机系统结束进程时不会调用它，数据要在用户操作时就保存。

### 页面显示状态与 Esc

页面切走后会保留状态，回来时原样恢复。页面隐藏时组件的 effect 会被清理，回到前台时重新执行，所以把键盘监听、轮询和订阅写在 effect 里，就会自动随页面暂停与恢复。

在 effect 之外的回调里（例如插件命令被执行时），用 `pageContext.isActive()` 判断这个页面是不是当前显示的那一个。

页面里自己做的浮层（非模态抽屉、弹出面板等）要接 Esc 关闭时，用 `pageContext.registerDismiss` 登记，不要自己监听 Esc：

```tsx
import { useEffect, useState } from "react";
import type { PluginPageProps } from "@tau/plugins";

function BookPage({ pageContext }: PluginPageProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const registration = pageContext.registerDismiss(() => setDrawerOpen(false));
    return () => {
      registration.dispose();
    };
  }, [drawerOpen, pageContext]);

  return (
    <>
      <button type="button" onClick={() => setDrawerOpen(true)}>
        目录
      </button>
      {drawerOpen && <aside className="yourname-toc">……</aside>}
    </>
  );
}
```

- 用户按 Esc 时，Tau 先关最后登记的浮层，再依次往前；没有浮层时 Esc 不做任何事，不会后退页面。
- 只在页面显示时生效：页面切走后，它登记的浮层不会响应 Esc；回来后自动恢复。插件停用时全部清除。
- `@tau/ui` 的模态 `Dialog`、`Drawer` 和 `Popover`、`Select`、`Menu` 已经自己处理 Esc，不需要登记。

## 功能入口

功能入口让用户找到你的页面。桌面上它出现在侧边栏的「插件」分组，手机上出现在「我的」顶部的功能宫格，和任务、文章等内置功能放在一起；同一份代码，位置由 Tau 决定。开头例子里的 `registerEntry` 就是它，加上图标：

```ts
import { ShelfIcon } from "./ShelfIcon";

// activate 内，shelf 为 context.pages.register 返回的句柄
context.navigation.registerEntry({
  id: "shelf",
  title: "书架",
  icon: ShelfIcon,
  page: shelf,
});
```

| 字段     | 说明                                                |
| -------- | --------------------------------------------------- |
| `id`     | 局部 ID                                             |
| `title`  | 入口名称                                            |
| `page`   | 本次启用中注册的页面句柄                            |
| `params` | 可选。点击时传给页面的参数                          |
| `icon`   | 可选。图标组件，见[图标](#图标)；省略时使用默认图标 |

- 页面被撤销时，指向它的入口也会一起撤销。
- 桌面上要放进其他分组、显示角标或子项时，改用下一节的[侧边栏](#侧边栏)。
- 手机宫格里插件入口排在内置功能之后，按启用顺序排列，超过两行时收进「更多」；`icon` 在宫格里显示为图标，省略时显示插件名首字。手机上没有命令面板，主要功能一定要有入口，见[多端适配 · 页面与入口](portability.md#页面与入口)。

## 侧边栏

桌面插件可以直接控制侧边栏条目：放进指定分组、显示角标和子项。条目关联一个已注册的页面，点击时打开它，并在该页面显示时高亮。侧边栏只在桌面，只在桌面运行的插件可以用它代替功能入口；也要在手机上运行时，用[功能入口](#功能入口)。

```ts
import { SIDEBAR_GROUPS } from "@tau/plugins";
import { ShelfIcon } from "./ShelfIcon";

// activate 内
context.sidebar.registerItem({
  id: "shelf",
  title: "书架",
  icon: ShelfIcon,
  group: SIDEBAR_GROUPS.learning,
  page: shelf,
});
```

| 字段     | 说明                                   |
| -------- | -------------------------------------- |
| `id`     | 局部 ID                                |
| `title`  | 入口名称                               |
| `page`   | 本次启用中注册的页面句柄               |
| `params` | 可选。点击时传给页面的参数             |
| `icon`   | 可选。图标组件，省略时使用默认插件图标 |
| `group`  | 可选。所在分组，省略时放进「插件」分组 |

### 分组

放进 Tau 已有的分组时，使用 `SIDEBAR_GROUPS` 常量：

| 常量                       | 分组 |
| -------------------------- | ---- |
| `SIDEBAR_GROUPS.daily`     | 日常 |
| `SIDEBAR_GROUPS.knowledge` | 知识 |
| `SIDEBAR_GROUPS.learning`  | 学习 |
| `SIDEBAR_GROUPS.ai`        | AI   |
| `SIDEBAR_GROUPS.sharing`   | 分享 |
| `SIDEBAR_GROUPS.plugins`   | 插件 |

也可以创建自己的分组，它会显示在 Tau 的分组之后：

```ts
const group = context.sidebar.registerGroup({ id: "reading", title: "阅读" });
context.sidebar.registerItem({
  id: "shelf",
  title: "书架",
  group: group.id,
  page: shelf,
});
```

引用自建分组时使用返回的 `group.id`，不要直接写 `"reading"`。没有条目的分组不显示；分组被撤销后，其中的条目移到「插件」分组。

同一个带参数的页面可以注册多个条目，分别传不同的 `params`。

### 角标与子项

`registerItem` 返回的句柄有 `update`，用来显示角标和条目下方的子项。只改传入的字段，可以随时调用。下面把书架按书单分成子项：

```ts
// activate 内；shelf 为书架页的句柄，lists、removeList、moveBook 是插件自己的数据与函数
const item = context.sidebar.registerItem({
  id: "shelf",
  title: "书架",
  page: shelf,
});

item.update({
  badge: 3,
  children: lists.map((list) => ({
    id: list.id,
    title: list.title,
    params: { list: list.id },
    tone: "blue",
    count: list.unread,
    menu: [
      { title: "编辑书单", run: () => shelf.open({ list: list.id, edit: true }) },
      { title: "删除书单", danger: true, run: () => removeList(list.id) },
    ],
    onDrop: { type: "book", run: (bookId) => moveBook(bookId, list.id) },
  })),
  action: { title: "新建书单", run: () => shelf.open({ create: true }) },
});
```

| 字段       | 说明                                                   |
| ---------- | ------------------------------------------------------ |
| `badge`    | 条目右侧的数字，`0` 或 `null` 隐藏；侧栏收起时不显示   |
| `children` | 子项列表，最多 200 个；传 `[]` 清空                    |
| `action`   | 子项列表末尾的一行动作，缺省图标为加号；传 `null` 移除 |

子项的字段：

| 字段     | 说明                                                                      |
| -------- | ------------------------------------------------------------------------- |
| `id`     | 在同一条目内唯一                                                          |
| `title`  | 名称                                                                      |
| `params` | 点击时用这组参数打开条目的页面                                            |
| `tone`   | 可选。色点：`rose`、`orange`、`yellow`、`green`、`blue`、`purple`、`gray` |
| `count`  | 可选。右侧的计数，`0` 不显示                                              |
| `menu`   | 可选。右键菜单，最多 8 条；`danger: true` 显示为红色，并与前面的条目隔开  |
| `onDrop` | 可选。接收拖放：`type` 是拖拽类型，`run` 收到拖拽数据                     |

- 子项只在条目的页面显示、并且侧栏展开时出现。当前页面参数包含子项的 `params` 时，子项显示为选中；再点一次选中的子项，回到条目本身的 `params`。
- 回调出错时，Tau 显示一条通知，侧栏照常工作。插件停用后，回调不会再被调用。
- 拖放只接收本插件拖出的数据。在页面里拖起时，用 `context.sidebar.dragType` 生成拖拽类型：

```tsx
<div
  draggable
  onDragStart={(event) =>
    event.dataTransfer.setData(context.sidebar.dragType("book"), book.id)
  }
>
  {book.title}
</div>
```

`dragType` 的参数是局部 ID，大小写不敏感，要和子项 `onDrop.type` 一致。

### 图标

`icon` 接收组件本身（`icon: ShelfIcon`），不是 `<ShelfIcon />`，也不是图片地址。图标是一个线性单色的 SVG 组件：

```tsx
// src/ShelfIcon.tsx
import type { PluginIconProps } from "@tau/plugins";

export function ShelfIcon({ size = 24, strokeWidth = 2, ...props }: PluginIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 19V5M9 19V5M14 19l3-14 3 .6-3 14M3 19h18" />
    </svg>
  );
}
```

- Tau 会传入 `size`、`strokeWidth`、`className` 和 `aria-hidden`，图标要把它们透传给 `<svg>`。
- 颜色用 `currentColor`，这样会跟随明暗主题和选中状态。不要写死宽高和颜色。
- 也可以直接使用 [lucide-react](https://lucide.dev) 等图标库的组件（先 `pnpm add lucide-react`）。
- 同一套图标也用在[对象动作](app-surfaces.md#对象动作)、[Notebook 输出](app-surfaces.md#notebook-输出)和[插件内容类型](plugin-content.md#内容类型)上。

页面里要保存用户的偏好，接着读[设置与命令](settings-and-commands.md)；想让插件出现在首页或卡片菜单里，读[挂到 Tau 的界面里](app-surfaces.md)。
