# 快速开始

模板自带一个能直接运行的计数器插件。先把它构建出来、装进 Tau 跑通，再改成你自己的插件。

## 准备环境

- Node.js 22 或更高版本。
- pnpm 11.9.0（`npm install -g pnpm@11.9.0`）。
- 在 GitHub 上用 [插件模板](https://github.com/LastKnightCoder/tau-plugin-template) 创建自己的仓库（「Use this template」），再克隆到本地。

## 构建

```sh
pnpm install --frozen-lockfile
pnpm build
```

构建成功后，`dist/` 下会生成 `<插件ID>-<版本>.zip`，这就是要安装和发布的插件包。

`pnpm build` 会先做类型检查，再打包并校验 manifest。构建通过只说明代码能编译、包格式正确，功能是否正常要装进 Tau 里试。

## 模板里有什么

| 文件                                    | 用途                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| `manifest.json`                         | 插件的身份、支持的平台和最低客户端版本，见[插件的组成](plugin-basics.md#manifest) |
| `src/index.tsx`                         | 插件入口：一个计数器页面、功能入口、设置和一条命令                                |
| `src/styles.css`、`src/CounterIcon.tsx` | 样式和图标                                                                        |
| `examples/editor.tsx`                   | 一个最小的编辑器块示例，见[编辑器扩展](editor.md)                                 |
| `build.mjs`                             | 构建脚本：类型检查、打包、校验 manifest、生成 ZIP                                 |
| `README.md`、`CHANGELOG.md`             | 写给使用者的说明和更新日志，会显示在插件详情页                                    |
| `AGENTS.md`                             | 给 AI 编程助手的项目指引                                                          |
| `.github/workflows/release.yml`         | 推送版本 tag 后自动发布，见[发布与更新](release.md)                               |

计数器点击「增加并保存」后把数字存进当前工作区，下次打开继续使用。它同时声明了桌面、Android 和 iOS 三个平台，是一个最小的多端插件。

## 在 Tau 里调试

正式版 Tau 只安装插件中心审核通过的插件。开发阶段要在**从源码运行的 Tau 开发版**里安装自己构建的 ZIP。

### 桌面

1. 克隆 [Tau 源码](https://github.com/LastKnightCoder/editor)，在仓库根目录运行 `pnpm install`，再运行 `pnpm dev` 启动开发版。
2. 打开侧边栏的「插件」，点右上角的「⋯」，选择「从 ZIP 安装…」，选中 `dist/` 下的 ZIP。
3. 从 ZIP 安装的插件默认停用。在「已安装」里打开它的开关。
4. 改完代码后重新 `pnpm build`，再用「从 ZIP 安装…」装一次即可覆盖旧版本。

带[编辑器扩展](editor.md)或[白板扩展](whiteboard.md)的插件，安装、启停和更新后要完全退出并重新打开 Tau 才生效；只有页面、命令、设置的插件即时生效。

开发版和正式版共用 `~/.editor` 下的数据。调试会读写真实的笔记库，建议先新建一个工作区专门用来测试。

### Android 与 iOS

在 Tau 源码的 `apps/mobile` 下运行 `pnpm dev:android` 或 `pnpm dev:ios` 启动开发版。开发版的「我的 › 插件中心 › 已安装」底部有「受控开发安装」，粘贴一段包描述即可安装：

```json
{
  "id": "example.external-counter",
  "version": "1.2.3",
  "url": "http://127.0.0.1:8000/example.external-counter-1.2.3.zip",
  "sha256": "<ZIP 的 SHA-256>",
  "size": 12345
}
```

- `url` 必须是 HTTPS，或者本机的 `http://127.0.0.1` / `localhost`。可以在 `dist/` 下运行 `python3 -m http.server 8000` 提供文件；Android 模拟器或真机先执行 `adb reverse tcp:8000 tcp:8000`。
- `sha256` 和 `size` 是 ZIP 的摘要和字节数，用 `shasum -a 256 <文件>` 和 `wc -c < <文件>` 得到。
- 开发安装的插件默认停用。在「已安装」里启用后，重新打开应用生效。

## 改成自己的插件

1. 修改 `manifest.json` 的 `id`、`name`、`description` 和 `version`，并让 `package.json` 的 `version` 与它一致。插件 ID 一旦发布就不要再改，改了 ID 用户的数据就找不回来了。
2. 读一遍[多端适配](portability.md)，确认你要用的接口在哪些平台可用，再决定 `targets` 里保留哪些平台。比如用到了[用户数据](user-data.md)，就只保留 `desktop`。
3. 改写 `src/index.tsx`。各项能力的写法见[文档首页](README.md#我想)的对照表。
4. 重写 `README.md`，写给第一次使用这个插件的用户：能做什么、怎么开始、常见问题。
5. 构建并在 Tau 里验证：启用、使用每项功能、保存数据、停用、重启后再用。

准备好之后，按[发布与更新](release.md)发布到插件中心。
