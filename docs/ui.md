# 界面概览

插件的界面可以出现在 Tau 的多个位置：一整个页面，配一个让用户找到它的功能入口；插件详情页里的设置，或者桌面命令面板里的一条命令；也可以挂进 Tau 已有的界面，比如首页上的一块面板、卡片「⋯」菜单里的一项操作、详情正文上方的一小块内容、Notebook「生成」菜单里的一种产物；还能发通知、听用户说话、把文字念出来。这些都在 `activate(context)` 里注册，插件停用时 Tau 自动撤销，不需要你手动清理。

界面都用 React 写，先读[界面组件与样式](ui-components.md)：怎样用 `@tau/ui` 组件、怎样写样式才不会和 Tau 冲突。然后按你想出现的位置查下表。

| 想出现在                                                       | 用                                            | 见                                                       |
| -------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| 一个完整的页面，和 Tau 自己的页面一样前进、后退                | `context.pages`                               | [页面](pages.md#页面)                                    |
| 桌面侧边栏、手机「我的」顶部的功能宫格，点击打开页面           | `context.navigation`                          | [功能入口](pages.md#功能入口)                            |
| 桌面侧边栏的指定分组，带角标和子项                             | `context.sidebar`                             | [侧边栏](pages.md#侧边栏)                                |
| 插件详情页的「设置」                                           | `context.settings`                            | [设置](settings-and-commands.md#设置)                    |
| 桌面的 Ctrl+K 命令面板                                         | `context.commands`                            | [命令](settings-and-commands.md#命令)                    |
| 桌面「今日」首页、手机「今天」页上的一块面板                   | `context.home`                                | [首页面板](app-surfaces.md#首页面板)                     |
| 卡片、文章、项目文档等对象的「⋯」菜单                          | `context.actions`                             | [对象动作](app-surfaces.md#对象动作)                     |
| 卡片、文章、项目文档详情的正文上方                             | `context.views`                               | [详情区块](app-surfaces.md#详情区块)                     |
| Notebook 的「生成」菜单                                        | `context.notebooks`                           | [Notebook 输出](app-surfaces.md#notebook-输出)           |
| 窗口内或独立的通知窗口                                         | `context.notifications`                       | [通知](notifications-and-voice.md#通知)                  |
| 插件自己的按钮：用户按住说话，插件拿到文字                     | `context.speech`                              | [语音输入](notifications-and-voice.md#语音输入)          |
| 用用户选的语音服务把文字念出来                                 | `context.tts`                                 | [朗读](notifications-and-voice.md#朗读)                  |

侧边栏、命令面板、详情区块、Notebook 输出、通知和朗读只在桌面可用，语音输入只在手机可用，其余两端都能用；完整的差异见[多端适配](portability.md#各平台可用的接口)。

第一次做界面，从[页面与入口](pages.md)开始：注册一个页面和它的入口，用户就能在 Tau 里打开你的插件。
