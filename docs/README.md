# Tau 插件开发文档

Tau 插件用 TypeScript 和 React 编写，打包成一个 ZIP，发布到插件中心后，用户在桌面和手机上安装。插件可以给 Tau 加页面和入口，在首页放一块面板，在卡片菜单里加一项操作，在文档里放自定义块，在白板上加元素，给 AI 提供工具，接入第三方存储、语音、视频等服务，或者读写用户的卡片和待办。

一个插件长这样：注册一个页面和它的入口，入口在桌面上出现在侧边栏，在手机上出现在「我的」顶部的功能宫格。

```tsx
import { definePlugin, type PluginPageProps } from "@tau/plugins";
import { Button } from "@tau/ui";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

function HelloPage({ context }: PluginPageProps) {
  return (
    <section>
      <h1>你好，Tau</h1>
      <Button onClick={() => context.storage.set("visited", true)}>记住我来过</Button>
    </section>
  );
}

export default definePlugin({
  ...__PLUGIN_META__,
  create: () => ({
    activate(context) {
      const page = context.pages.register({
        id: "hello",
        title: "你好",
        component: HelloPage,
      });
      context.navigation.registerEntry({ id: "hello", title: "你好", page });
    },
  }),
});
```

## 第一次写插件

1. [快速开始](getting-started.md)：装好环境，跑通模板自带的计数器，在 Tau 里调试，再改成自己的插件。
2. [插件的组成](plugin-basics.md)：manifest、入口、生命周期和 `context`，所有能力都建立在这些概念上。
3. [多端适配](portability.md)：一个插件包怎样同时运行在桌面、Android 和 iOS，以及各平台能用哪些接口。
4. 按你要做的功能，读下表中对应的文档。
5. [发布与更新](release.md)：发布到插件中心，以及之后怎么发新版本。

## 我想……

### 做界面

| 想做的事                                           | 读这篇                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| 先看插件的界面能出现在 Tau 的哪些位置              | [界面概览](ui.md)                                                      |
| 让插件跟随界面语言，配置自己的词典 | [界面组件与样式 · 界面语言](ui-components.md#界面语言) |
| 用 `@tau/ui` 组件、写样式、用 Tailwind             | [界面组件与样式](ui-components.md)                                     |
| 加一个页面，以及打开它的功能入口、桌面侧边栏条目   | [页面与入口](pages.md)                                                 |
| 打开桌面小窗或全屏窗口，和主窗口同步状态或发送消息 | [桌面插件窗口](windows.md)                                             |
| 在插件详情里放设置项，或在桌面命令面板里加命令     | [设置与命令](settings-and-commands.md)                                 |
| 在首页放一块面板                                   | [挂到 Tau 的界面里 · 首页面板](app-surfaces.md#首页面板)               |
| 在卡片、文章、项目文档的「⋯」菜单里加一项操作      | [挂到 Tau 的界面里 · 对象动作](app-surfaces.md#对象动作)               |
| 在卡片、文章、项目文档的详情里放一块内容           | [挂到 Tau 的界面里 · 详情区块](app-surfaces.md#详情区块)               |
| 在 Notebook 的「生成」菜单里加一种产物             | [挂到 Tau 的界面里 · Notebook 输出](app-surfaces.md#notebook-输出)     |
| 发送通知                                           | [通知、语音输入与朗读 · 通知](notifications-and-voice.md#通知)         |
| 让用户按住说话，插件拿到识别出的文字               | [通知、语音输入与朗读 · 语音输入](notifications-and-voice.md#语音输入) |
| 用用户选的语音服务把文字念出来                     | [通知、语音输入与朗读 · 朗读](notifications-and-voice.md#朗读)         |

### 存数据、读写用户的内容

| 想做的事                                                | 读这篇                               |
| ------------------------------------------------------- | ------------------------------------ |
| 保存插件自己的设置和进度、请求网络、建立 WebSocket 连接 | [存储与网络](storage-and-network.md) |
| 让用户挑一张卡片或一篇文章给插件用，或者打开它          | [引用用户的内容](references.md)      |
| 成批查询、修改用户的卡片、文章、项目文档、待办、日程    | [读写用户数据](user-data.md)         |
| 查询待办项目和日历、设置提醒与重复、保存变化进度 | [待办与日程](task-data.md) |
| 申请访问用户数据的权限，处理用户拒绝                    | [权限](permissions.md)               |
| 读取或修改一篇内容的正文，在插件里嵌入正文编辑器        | [正文](document-body.md)             |
| 创建插件自己的内容（如周记）或按字段查询的记录          | [插件内容与记录](plugin-content.md)  |
| 把外部的划线、批注导入 Tau                              | [摘录](excerpts.md)                  |
| 创建闪卡、打开制卡窗口                                  | [闪卡](flashcards.md)                |

### 扩展编辑器和白板

| 想做的事                                             | 读这篇                                        |
| ---------------------------------------------------- | --------------------------------------------- |
| 在文档里添加第一个自定义块                           | [第一个块](editor.md)                         |
| 给块加外框、属性条、菜单、快捷键                     | [块的交互](editor-interactions.md)            |
| 做源码预览块，或在块里显示图片、视频、音频           | [源码块与媒体块](editor-source-media.md)      |
| 让块参与 Markdown、HTML 导出和字数统计               | [导出与字数统计](editor-export.md)            |
| 修改已发布块的数据结构，或支持多人同时编辑块里的源码 | [块的数据版本与协作](editor-collaboration.md) |
| 在白板上添加自定义元素和工具                         | [白板扩展](whiteboard.md)                     |

### AI 与服务

| 想做的事                                                     | 读这篇                            |
| ------------------------------------------------------------ | --------------------------------- |
| 调用用户配置的大模型                                         | [AI](ai.md)                       |
| 给 Tau 的 AI 助手提供工具                                    | [MCP 工具](mcp.md)                |
| 给 AI 提供使用说明，或单独发布一套 Skill                     | [Skill](skills.md)                |
| 编译 Tailwind、转换 Markdown、处理音视频                     | [编译与转换服务](services.md)     |
| 运行 Node.js 代码、调用本机程序                              | [本机后台](backend.md)            |
| 接入同步存储、图床、语音、图片生成、嵌入模型、视频、博客发布 | [服务提供方](providers/README.md) |
| 开发独立博客站点，读取 Tau 发布的数据                        | [站点数据](site-data.md)          |

## 约定

- 插件接口从 `@tau/plugins` 导入，界面组件从 `@tau/ui` 导入。它们由 Tau 在运行时提供，模板的构建配置已经处理好，不需要你打包。
- 文中的 `context` 指 `activate(context)` 收到的插件上下文；代码片段如果没有写出外层结构，默认放在 `activate` 里。
- 所有接口都有完整的 TypeScript 类型。文档讲用法和规则，参数的精确类型以编辑器里的类型提示为准。
- 示例里的 `yourname.xxx` 换成你自己的插件 ID 前缀。

## 给 AI 编程助手

模板根目录的 `AGENTS.md` 是给 AI 编程助手看的项目指引。用 AI 写插件时，让它先读 `AGENTS.md` 和本目录下与任务相关的文档。
