# Tau 插件模板

这是 [Tau](https://taunote.app) 官方的插件模板。用 TypeScript 和 React 写插件，构建成一个 ZIP，发布到插件中心后，用户在桌面、Android 和 iOS 上安装使用。插件可以给 Tau 加页面和入口、在首页放面板、在文档里放自定义块、在白板上加元素、给 AI 提供工具、接入第三方存储和语音服务，或者读写用户的卡片和待办。

模板自带一个能直接运行的计数器：点「增加并保存」，数字按工作区保存，下次打开继续使用。装好后，桌面在侧边栏、手机在「我的」顶部的功能宫格里找到「计数器」。

## 三步跑起来

1. 在 GitHub 上点「Use this template」创建自己的仓库，克隆到本地。
2. 安装依赖并构建，`dist/` 下会生成插件 ZIP：

   ```sh
   pnpm install --frozen-lockfile
   pnpm build
   ```

3. 把 ZIP 装进 Tau 开发版，启用后打开「计数器」。步骤见[快速开始 · 在 Tau 里调试](docs/getting-started.md#在-tau-里调试)。

## 文档

- 在线阅读：<https://taunote.app/developers/>
- 仓库里的 [docs/](docs/README.md)：和官网同一份内容，从[快速开始](docs/getting-started.md)读起。
- 用 AI 编程助手写插件时，让它先读 [AGENTS.md](AGENTS.md)。

## 发布自己的插件

这份 README 会随插件包显示在插件详情页的「说明」里。改成自己的插件后，把它重写成给用户看的说明：插件能做什么、怎么开始、常见问题。写法见[发布与更新](docs/release.md)。
