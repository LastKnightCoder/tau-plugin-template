# 多端适配

同一个插件包可以同时运行在 Tau 桌面端、Android 和 iOS 上：写一份代码、发布一个 ZIP，用户在哪个平台安装，就在哪个平台运行。其他文档里的接口，手机上能不能用，以这里的[接口表](#各平台可用的接口)为准。

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
- `minAppVersion` 填你实际测试过的最低 Tau 版本，写完整的版本号，不写范围。用户的 Tau 低于这个版本时，插件中心不会向他们提供这一版。
- 列出一个平台，表示插件的**全部功能**都已在这个平台上适配并测试过。只有部分功能能用的平台，先不要列。
- 用到下表中只有桌面支持的接口时，只写 `desktop`。

你不需要在 manifest 里声明用到了哪些接口：Tau 根据平台和版本判断能否安装，接口本身由代码注册。

## 各平台可用的接口

| 接口                                                   | 桌面 | Android / iOS | 说明                                                       |
| ------------------------------------------------------ | ---- | ------------- | ---------------------------------------------------------- |
| `pages`、`navigation`                                  | ✓    | ✓             | 桌面的功能入口在侧边栏，手机在「我的 › 插件功能」          |
| `settings`、`storage`、`fetch`、`websocket`            | ✓    | ✓             |                                                            |
| `commands`                                             | ✓    | 部分          | 手机上可以注册，但没有命令面板，主要功能要另外注册功能入口 |
| `environment`、`register`、`signal`                    | ✓    | ✓             |                                                            |
| 编辑器块（`editorExtensions`、`editorCodecs`）         | ✓    | ✓             | 见[编辑器块](#编辑器块)                                    |
| `sync`、`upload`、`tts`、`asr` 提供方                  | ✓    | ✓             | 配置表单两端都由 Tau 渲染                                  |
| `images`、`video`、`publish` 提供方                    | ✓    |               |                                                            |
| `sidebar`、`home`、`actions`、`views`、`notifications` | ✓    |               | 跨平台的入口用 `navigation`                                |
| `data`、`content`、`events`、`app`、`permissions`      | ✓    |               | 用户数据，见[用户数据](user-data.md)                       |
| `entities`、`records`、`links`、`transaction`          | ✓    |               | 插件自己的内容也只在桌面可用                               |
| `ai`、`mcp`、`chat`、`flashcards`                      | ✓    |               |                                                            |
| `excerpts`、`materials`、`services`                    | ✓    |               |                                                            |
| 白板扩展（`whiteboardExtensions`）                     | ✓    |               |                                                            |
| `backend`（本机后台）                                  | ✓    |               | 需要单独的包格式，见[本机后台](backend.md)                 |
| 随插件附带的 Skill                                     | ✓    |               | 手机上会保留，但不使用                                     |

- 声明了 `android` 或 `ios` 的插件，`permissions` 必须为空。手机还不支持用户数据授权，构建和插件中心都会拒绝这样的包。
- 类型里能导入，不代表这个平台能用。以上表为准，不确定时在真机上试。

## 页面与入口

页面和入口分开注册。同一份代码在桌面上出现在侧边栏，在手机上出现在「我的 › 插件功能」：

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

## 编辑器块

编辑器块在桌面和手机上使用同一份 `editorExtensions` 和 `editorCodecs`：节点类型、数据和渲染都相同，不要为手机另建一套节点。

- 手机上，插入、上下移动、删除等标准操作由 Tau 提供；用 `SourceBlockEditor` 的源码块，编辑时会打开全屏的源码页。见[编辑器扩展 · 源码预览块](editor.md#源码预览块)。
- 块里自定义的操作（如图册排序、画图）要自己适配触摸：保留能点击的按钮，拖拽只作为增强。

## 服务提供方

同步存储、资源上传、语音合成、语音识别四类提供方，在桌面和手机上使用同一套注册接口和配置表单。配置界面由 Tau 按平台渲染，你不需要写两套。同步的分块、校验和重组也由 Tau 处理，不需要手机专用的分支。写法见[服务提供方](providers/README.md)。

## 测试

声明一个平台之前，在这个平台上完整走一遍：安装、启用、使用每项功能、保存、取消、停用，以及完全退出后重新打开。手机上额外检查软键盘、中文输入法、系统返回键和横竖屏切换。模拟器能发现大部分问题，但上架前最好在真机上再试一次。

本地安装与调试的方法见[快速开始 · 在 Tau 里调试](getting-started.md#在-tau-里调试)。
