# 快速开始

模板使用同一套 SDK：`@tau/plugins` 为 npm 别名 @xiongtao.xt/tau-plugins 0.40.0，`@tau/ui` 为 @xiongtao.xt/tau-ui 0.5.0。移动正式安装要求 Android/iOS 客户端至少 0.2.4；具体支持范围先看 [API 矩阵](api-support.md)。

## 准备与构建

1. 安装 Node.js 22+ 与 pnpm 11.9.0，复制本版本模板到独立目录。
2. 安装已锁定的 npm 依赖并构建：

```sh
pnpm install --frozen-lockfile
pnpm build
```

SDK 0.43.0 已发布到 npm，直接使用上述冻结安装与构建命令，无需本地 tarball。SDK 发布不代表插件或 APP 已发布；客户端要求以清单和支持矩阵为准。

3. 构建生成 `dist/<插件ID>-<版本>.zip`；再次安装可用 `pnpm install --frozen-lockfile`。
4. 在目标宿主验证后按发布指南上传待审；格式 3 普通提交人工审核，具审核权限的作者本人通过已绑定仓库 CI 发布可自动批准。移动用户从应用内中心安装，首次安装保存启用意图，重开应用生效；桌面 0.59.1 支持格式 3 中心安装，首次安装后需在已安装页启用并重启。install:local 不把格式 3 写进旧桌面正式目录。

仅调试未发布 SDK 时运行 `node use-local-sdk.mjs /path/to/plugins.tgz /path/to/ui.tgz` 切换到本地 file 依赖，并重新生成开发锁文件；恢复正式 npm 依赖后重建发布锁文件。不提交 .sdk、node_modules 或 dist，不用旧 tarball 冒充新版 npm 内容。

## 模板结构

| 文件                                | 用途                                        |
| ----------------------------------- | ------------------------------------------- |
| manifest.json                       | 身份、平台、版本与能力声明                  |
| src/index.tsx                       | 共用计数器、页面、功能入口、通用设置/Dialog |
| src/styles.css、src/CounterIcon.tsx | 样式和图标                                  |
| build.mjs                           | 依赖检查、清单校验、暂存产物与 ZIP          |
| use-local-sdk.mjs                   | 准备未发布的 SDK/UI 输入                    |
| README.md                           | 给使用者的说明                              |

计数按工作区保存。跨端页面注册与入口分离；设置与 Dialog 属于公共基础，直接使用。布局使用 CSS 容器查询；只有特殊交互才读取平台或输入，不解析 User-Agent。

## 改成自己的插件

1. 修改 manifest 的 id/name/description/version，package.json 版本保持一致。发布后插件 ID 不变。
2. 先逐项核对 [API 支持矩阵](api-support.md)，再声明 targets、最低版本、必需/可选能力。移动 permissions 必须为空；没有 Node 不等于移动完整兼容。
3. 共用逻辑和模型，差异明显时拆视图，保持节点类型与字段一致。
4. 更新 README，构建后在目标宿主验收启用、保存、停用与恢复。

契约见[跨端开发](portability.md)，生命周期见[插件组成](plugin-basics.md)。仓库外构建只证明作者闭环，不替代宿主和真机验收。

## 开发语音识别插件

ASR 与标准 WebSocket 需要 SDK 0.43.0、桌面 0.59.5 或移动 0.2.7。模板已使用 npm 的 SDK 0.43.0；冻结安装、构建后再在目标宿主验证。接口见 [语音识别](providers/asr.md) 与 [WebSocket](websocket.md)。SDK 可安装不代表客户端已经发行，最低客户端版本与平台分发仍由插件清单控制。
