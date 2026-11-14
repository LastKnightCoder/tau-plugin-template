# 快速开始

模板自带一个能直接运行的计数器插件：点「增加并保存」，数字存进当前工作区，下次打开还在。它同时声明了桌面、Android 和 iOS，是一个最小的多端插件。先把它构建出来、装进 Tau 跑通，再改成你自己的插件。

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

`pnpm build` 会先做类型检查，再打包并校验 manifest。构建通过只说明代码能编译、包格式正确，功能是否正常要装进 Tau 里试。只想检查类型时运行 `pnpm check`，比完整构建快。

## 模板里有什么

| 文件                                    | 用途                                                              |
| --------------------------------------- | ----------------------------------------------------------------- |
| `manifest.json`                         | 插件的身份和支持的平台，见[插件的组成](plugin-basics.md#manifest) |
| `src/index.tsx`                         | 插件入口：一个计数器页面、功能入口、设置和一条命令                |
| `src/styles.css`、`src/CounterIcon.tsx` | 样式和图标                                                        |
| `examples/editor.tsx`                   | 一个最小的编辑器块示例，见[第一个块](editor.md)                   |
| `build.mjs`                             | 构建脚本：类型检查、打包、校验 manifest、生成 ZIP                 |
| `install-local.mjs`                     | `pnpm install:local` 用的安装脚本，见[本地安装](#本地安装)        |
| `README.md`、`CHANGELOG.md`             | 写给使用者的说明和更新日志，会显示在插件详情页                    |
| `AGENTS.md`                             | 给 AI 编程助手的项目指引                                          |
| `.github/workflows/release.yml`         | 推送版本 tag 后自动发布，见[发布与更新](release.md)               |

## 在 Tau 里调试

从应用商店或官网下载的正式版 Tau 只安装插件中心审核通过的插件。开发阶段，把自己构建的 ZIP 装进**从源码运行的 Tau 开发版**。开发版只需要准备一次，之后一直开着，每次改完代码重新装一次 ZIP 即可。

### 桌面

准备开发版（只做一次）：

```sh
git clone https://github.com/LastKnightCoder/editor.git tau
cd tau
pnpm install
pnpm dev
```

第一次安装：

1. 在 Tau 打开侧边栏的「插件」，点右上角的「⋯」，选择「从 ZIP 安装…」，选中 `dist/` 下的 ZIP。
2. 从 ZIP 安装的插件默认停用。在「已安装」里打开它的开关，侧边栏就会出现「计数器」。

改代码、看效果：

1. 把 `manifest.json` 的 `version` 提高一点。同一个插件再次安装时，版本必须比已安装的高，调试期间可以用预发布号逐次递增，如 `1.2.5-dev.1`、`1.2.5-dev.2`。
2. 运行 `pnpm build`。
3. 再用「从 ZIP 安装…」选中新的 ZIP。插件保持原来的启用状态，旧版本被替换。

只有页面、设置、命令的插件，装完立即生效，切回插件页面就能看到改动。带[编辑器块](editor.md)或[白板扩展](whiteboard.md)的插件，安装、启停和更新后要完全退出并重新打开 Tau 才生效，插件页会提示「立即重启」。

调试完准备发布时，把版本改回正式版本号（如 `1.2.5`），它比所有 `1.2.5-dev.*` 都高。

开发版和正式版共用 `~/.editor` 下的数据，调试会读写真实的资料库。建议先新建一个工作区专门用来测试。

### Android 与 iOS

在 Tau 源码的 `apps/mobile` 下运行 `pnpm dev:android` 或 `pnpm dev:ios`，启动手机开发版。手机从网络下载 ZIP，所以先在插件目录的 `dist/` 下开一个本机文件服务：

```sh
cd dist && python3 -m http.server 8000
```

Android 模拟器或真机还要执行一次 `adb reverse tcp:8000 tcp:8000`，让手机上的 `127.0.0.1:8000` 连到你的电脑；iOS 模拟器可以直接访问。

然后在插件目录生成一段包描述：

```sh
node -e 'const m=require("./manifest.json"),f=`${m.id}-${m.version}.zip`,b=require("fs").readFileSync("dist/"+f);console.log(JSON.stringify({id:m.id,version:m.version,url:"http://127.0.0.1:8000/"+f,sha256:require("crypto").createHash("sha256").update(b).digest("hex"),size:b.length}))'
```

输出类似：

```json
{
  "id": "example.external-counter",
  "version": "1.2.4",
  "url": "http://127.0.0.1:8000/example.external-counter-1.2.4.zip",
  "sha256": "<ZIP 的 SHA-256>",
  "size": 22422
}
```

在手机开发版打开「我的 › 插件中心 › 已安装」，把这段描述粘贴到底部的「受控开发安装」，点「校验并安装」。

- `url` 必须是 HTTPS，或者本机的 `http://127.0.0.1` / `localhost`。
- 开发安装的插件默认停用。在「已安装」里打开开关，页面顶部会出现「插件变更等待生效」的横幅，点「立即生效」，不用重新打开应用。插件的入口出现在「我的」顶部的功能宫格里。
- 改完代码后提高版本、重新构建、重新生成描述并安装，再点一次「立即生效」。

### 本地安装

`pnpm install:local` 把构建好的 ZIP 直接解压到本机的插件目录 `~/.editor/plugins/<插件ID>/`，再在 Tau 插件页的「⋯」里点「重新扫描」就能看到它。它不经过插件中心，所以正式版桌面 Tau 也能用，但只接受**manifest 里没有 `targets` 声明、只装在桌面**的两类包：

- [本机后台](backend.md)插件：它的 manifest 不写 `targets`，用顶层的 `minAppVersion`。
- 只写 `"platform": "desktop"` 和顶层 `minAppVersion` 的[独立 Skill 包](skills.md#独立的-skill-包)。

manifest 里有 `targets` 的包（包括模板自带的计数器，以及声明了 `android`、`ios` 的 Skill 包）运行 `pnpm install:local` 会直接报错，这类包按上面的[桌面](#桌面)或 [Android 与 iOS](#android-与-ios) 的方法装进开发版。

两种方式怎么选：

| 你的插件                              | 怎么装                                         |
| ------------------------------------- | ---------------------------------------------- |
| manifest 里有 `targets`（大多数插件） | Tau 开发版的「从 ZIP 安装…」或「受控开发安装」 |
| 本机后台插件、只装桌面的 Skill 包     | `pnpm install:local`，正式版和开发版都可以     |

`pnpm install:local` 只用于第一次安装，插件目录里已经有同 ID 的插件时会拒绝覆盖。之后的更新改用开发版的「从 ZIP 安装…」并提高版本；或者在 Tau 里停用插件，备份并移走 `~/.editor/plugins/<插件ID>/` 后再运行一次。插件 ID 不变，已保存的数据就会保留。

## 改成自己的插件

1. 修改 `manifest.json` 的 `id`、`name`、`description` 和 `version`，并让 `package.json` 的 `version` 与它一致。插件 ID 一旦发布就不要再改，改了 ID 用户的数据就找不回来了。
2. 读一遍[多端适配](portability.md)，确认你要用的接口在哪些平台可用，再决定 `targets` 里保留哪些平台。比如用到了只有桌面能用的[详情区块](app-surfaces.md#详情区块)，就只保留 `desktop`。
3. 改写 `src/index.tsx`。各项能力的写法见[文档首页](README.md#我想)的对照表。
4. 重写 `README.md`，写给第一次使用这个插件的用户：能做什么、怎么开始、常见问题。
5. 构建并在 Tau 里验证：启用、使用每项功能、保存数据、停用、重启后再用。

动手改之前，先读[插件的组成](plugin-basics.md)，了解 manifest、入口和 `context` 是怎么配合的。
