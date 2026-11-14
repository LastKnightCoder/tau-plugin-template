# 多端适配

同一个插件包可以同时运行在 Tau 桌面、Android 和 iOS 上：写一份代码、发布一个 ZIP，用户在哪个平台安装，就在哪个平台运行。各平台的差异都集中在这一篇；其他文档里的接口在手机上能不能用，以这里的[接口表](#各平台可用的接口)为准。

## 声明支持的平台

在 manifest 的 `targets` 里列出支持的平台，以及每个平台的最低客户端版本：

```json
{
  "targets": {
    "desktop": { "minAppVersion": "0.59.4" },
    "android": { "minAppVersion": "0.2.4" },
    "ios": { "minAppVersion": "0.2.4" }
  }
}
```

- 没有列出的平台不能安装这个插件。至少要列一个平台。
- `minAppVersion` 必填，填你实际测试过的 Tau 版本（桌面在「设置 › 关于与更新」里查看，手机在「我的」页底部的「关于」里查看），写完整的版本号，不写范围。用户的 Tau 低于这个版本时，插件中心不会向他们提供这一版。
- 列出一个平台，表示插件的**全部功能**都已在这个平台上适配并测试过。只有部分功能能用的平台，不要列。
- 用到下表中只有桌面支持的接口时，只写 `desktop`。

你不需要在 manifest 里声明用到了哪些接口：Tau 根据平台和版本判断能否安装，接口本身由代码注册。

## 各平台可用的接口

| 接口                                                           | 桌面 | Android / iOS | 说明                                                                                                                      |
| -------------------------------------------------------------- | ---- | ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pages`、`navigation`                                          | ✓    | ✓             | 桌面的功能入口在侧边栏，手机在「我的」顶部功能宫格，见[页面与入口](pages.md)                                              |
| `windows`                                                      | ✓    |               | 独立窗口、自动外观与同插件跨窗口通信，见[桌面插件窗口](windows.md)                                                        |
| `settings`、`storage`、`fetch`、`websocket`                    | ✓    | ✓             |                                                                                                                           |
| `environment`、`register`、`signal`、`pluginId`、`workspaceId` | ✓    | ✓             |                                                                                                                           |
| `commands`                                                     | ✓    | 部分          | 手机上可以注册，但没有命令面板，用户找不到；主要功能要另外注册功能入口                                                    |
| `home`                                                         | ✓    | ✓             | 手机上显示在「今天」页，见[挂到 Tau 的界面里 · 首页面板](app-surfaces.md#首页面板)                                        |
| `actions`                                                      | ✓    | 部分          | 手机只有卡片、文章、项目文档详情页的「更多」菜单，见[挂到 Tau 的界面里 · 对象动作](app-surfaces.md#对象动作)              |
| `sidebar`、`views`、`notebooks`、`notifications`               | ✓    |               | 跨平台的入口用 `navigation`，结果显示在页面里                                                                             |
| `speech`                                                       |      | ✓             | 见[通知、语音输入与朗读 · 语音输入](notifications-and-voice.md#语音输入)                                                  |
| `tts.open`                                                     | ✓    |               | 见[通知、语音输入与朗读 · 朗读](notifications-and-voice.md#朗读)                                                          |
| `upload.save`                                                  | ✓    |               | 见[插件内容与记录 · 保存资源文件](plugin-content.md#保存资源文件)                                                         |
| 编辑器块（`editorExtensions`、`editorCodecs`）                 | ✓    | ✓             | 见[编辑器块](#编辑器块)                                                                                                   |
| `sync`、`upload`、`tts`、`asr`、`images` 提供方                | ✓    | ✓             | 见[服务提供方](#服务提供方)                                                                                               |
| `embeddings`、`video`、`publish` 提供方                        | ✓    |               |                                                                                                                           |
| `permissions`、`data`、`content`、`events`                     | ✓    | 部分          | 手机能读写卡片、文章、项目、项目文档、待办和日程；白板、Notebook、材料与对话只有桌面能读，见[读写用户数据](user-data.md)  |
| `app`                                                          | ✓    | 部分          | 手机可以选择、描述和打开上述内容与插件内容，`run` 只有新建卡片、插入项目文档和协作共享，见[引用用户的内容](references.md) |
| `ContentEditor`、`ContentPreview`、`EntityRef`                 | ✓    | 部分          | 手机上在插件页面与设置里可用，能引用的类型与 `app` 相同，见[正文](document-body.md#嵌入正文编辑器)                        |
| `entities`、`records`、`links`、`transaction`                  | ✓    | ✓             | 插件停用后，手机上不能打开它的内容，见[插件内容与记录](plugin-content.md)                                                 |
| `excerpts`                                                     | ✓    | 部分          | 手机上插件可以注册、写入和读回摘录，但用户不能在手机上引用摘录，见[摘录](excerpts.md)                                     |
| `materials`                                                    | ✓    | 部分          | 手机上只能把本插件写入的摘录转为卡片，其他材料返回空的动作列表                                                            |
| `flashcards`                                                   | ✓    | 部分          | 手机可以查询和创建卡组与闪卡、打开手动制卡；AI 生成只有桌面，见[闪卡](flashcards.md)                                      |
| `ai`                                                           | ✓    | 部分          | 手机支持文本、图片和流式调用，但没有给插件 AI 功能选模型的入口，见[AI](ai.md)                                             |
| `mcp`、`chat`                                                  | ✓    | 部分          | 手机上可以注册，但工具不会出现在手机的对话里，见[MCP 工具](mcp.md)                                                        |
| `services`                                                     | ✓    |               |                                                                                                                           |
| 白板扩展（`whiteboardExtensions`）                             | ✓    |               |                                                                                                                           |
| `backend`（本机后台）                                          | ✓    |               | 需要单独的包格式，见[本机后台](backend.md)                                                                                |
| 随插件附带的 Skill                                             | ✓    | ✓             | 只能附带 Markdown，不能带脚本；手机上 AI 同样能读，见[Skill](skills.md)                                                   |
| 独立 Skill 包                                                  | ✓    | ✓             | 可以带脚本，脚本只在桌面执行，手机上 AI 只读说明，见[Skill · 独立的 Skill 包](skills.md#独立的-skill-包)                  |

代码里能导入某个接口，不代表它在当前平台可用。以上表为准，不确定时在真机上试。

### 手机上能申请的权限

- 用户数据：`cards`、`articles`、`projects`、`documents`、`todos`、`calendar` 各自的 `:read`、`:write`、`:delete`，以及 `flashcards:read`、`flashcards:write`。
- AI：[AI](ai.md) 里列出的 `ai:<能力名>`。
- 语音输入：`speech:input`。

声明了 `android` 或 `ios` 的插件如果申请了上面之外的权限，构建和插件中心都会拒绝。`minAppVersion` 填得太低、低于某个权限要求的手机版本时，`pnpm build` 会报错并给出需要的版本，按提示改高即可。和桌面一样，安装不等于授权，第一次访问时由用户决定，见[权限](permissions.md)。

## 页面与入口

页面和入口分开注册。同一份代码在桌面上出现在侧边栏，在手机上出现在「我的」顶部的功能宫格：

```tsx
const page = context.pages.register({
  id: "tasks",
  title: "任务管理",
  component: TasksPage,
});
context.navigation.registerEntry({
  id: "tasks",
  title: "任务管理",
  icon: TasksIcon,
  page,
});
context.settings.register({
  id: "preferences",
  title: "设置",
  component: Settings,
});
```

- 只是从别的页面打开的详情页，可以不注册入口。
- 手机上没有命令面板，主要功能一定要有入口。
- 页面容器默认已避开系统安全区，布局与吸底规则见[页面与入口 · 手机页面的布局边界](pages.md#手机页面的布局边界)。
- `@tau/ui` 的 `Dialog`、`Drawer` 在手机上会处理系统返回键和安全区，直接使用即可。
- 手机系统可能随时结束应用进程，不保证调用离开守卫或 `deactivate`。数据在用户操作时就保存。

## 适配不同的屏幕

布局按容器宽度决定，不按平台。手机横屏、平板、桌面窄窗口都可能出现，同一个平台的宽度也不固定：

```css
.yourname-board {
  container-type: inline-size;
}
@container (min-width: 640px) {
  .yourname-board {
    display: grid;
    grid-template-columns: 240px 1fr;
  }
}
```

- 用 CSS 容器查询或媒体查询切换布局，不要根据平台名推断屏幕大小，也不要解析 User-Agent。
- 触摸屏上没有悬停和右键。所有操作都要有能点击的按钮，悬停、右键、拖拽只作为增强。
- 屏幕旋转或分屏时布局会变，正在编辑的内容不能丢。

### 读取运行环境

大部分插件不需要读取环境。确实需要按平台区分交互时，在组件里用 `usePluginEnvironment()`，在组件外读 `context.environment`：

```tsx
import { usePluginEnvironment } from "@tau/plugins";

function Toolbar() {
  const { platform, input } = usePluginEnvironment();
  const touch = input.coarsePointer && !input.finePointer;
  // ...
}
```

| 字段                  | 说明                                                                    |
| --------------------- | ----------------------------------------------------------------------- |
| `platform`            | `desktop`、`android`、`ios`，在博客里为 `web`。平板沿用所在系统的平台名 |
| `input.coarsePointer` | 设备有触摸屏这类粗指针                                                  |
| `input.finePointer`   | 设备有鼠标、触控板这类细指针                                            |

两种指针可以同时存在，比如接了鼠标的平板。它们说的是设备有什么，不是这一次操作来自哪里；判断某次手势的来源，看 `PointerEvent.pointerType`。接入鼠标时增加便捷操作，不要因此删掉触摸按钮。

### App 回到前台

用户切到别的应用再回来（手机），或者切到别的窗口再回到 Tau（桌面），Tau 会在 `window` 上派发 `tau:app-foreground`；离开时派发 `tau:app-background`。适合回到前台时静默刷新一次外部数据，比如同步阅读进度：

```ts
let running: Promise<void> | undefined;
// 「立即同步」按钮也调用它，两处共用同一个进行中的请求
const syncQuietly = () =>
  (running ??= syncReadingProgress(context).finally(() => {
    running = undefined;
  }));

const onForeground = () => void syncQuietly().catch(() => undefined);
window.addEventListener("tau:app-foreground", onForeground);
context.register({
  dispose: () => window.removeEventListener("tau:app-foreground", onForeground),
});
```

- 短时间内反复切换只会收到一次 `tau:app-foreground`（约 500 毫秒内合并）。刚打开应用、一直停在前台时不会收到。
- Tau 内部切换页面不算离开前台；页面切走、切回用组件的 effect 处理，见[页面与入口](pages.md#页面显示状态与-esc)。
- 自动刷新不要弹提示，结果直接更新到界面上。和手动刷新共用同一个进行中的请求，不要同时发出两次。
- 用防抖、定时器推迟的刷新，在收到 `tau:app-background` 时取消。网络请求用 `context.fetch`，插件停用时会自动取消，停用后不要再补跑。

## 编辑器块

编辑器块在桌面和手机上使用同一份 `editorExtensions` 和 `editorCodecs`：节点类型、数据和渲染都相同，不要为手机另建一套节点。

- 手机上，插入、上下移动、删除等标准操作由 Tau 提供；用 `SourceBlockEditor` 的源码块，编辑时会打开全屏的源码页。见[源码块与媒体块 · 源码预览块](editor-source-media.md#源码预览块)。
- 块里自定义的操作（如图册排序、画图）要自己适配触摸：保留能点击的按钮，拖拽只作为增强。

## 服务提供方

同步存储、资源上传、语音合成、语音识别、图片生成这几类提供方，在桌面和手机上使用同一套注册接口和配置表单。配置界面由 Tau 按平台渲染，你不需要写两套。同步的分块、校验和重组也由 Tau 处理，不需要为手机另写分支。嵌入模型、视频来源和博客发布只在桌面。写法见[服务提供方](providers/README.md)。

## 测试

声明一个平台之前，在这个平台上完整走一遍：安装、启用、使用每项功能、保存、取消、停用，以及完全退出后重新打开。手机上额外检查软键盘、中文输入法、系统返回键和横竖屏切换。模拟器能发现大部分问题，但上架前最好在真机上再试一次。

本地安装与调试的方法见[快速开始 · 在 Tau 里调试](getting-started.md#在-tau-里调试)。
