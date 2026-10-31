# 服务提供方

Tau 的一些功能允许用户选择背后的服务：同步到哪个存储、图片上传到哪个图床、用哪家的语音合成等等。插件可以注册为这些功能的**提供方**，把一个新的服务接入进来。

| 提供方                    | 接入后用户可以                           | 平台       |
| ------------------------- | ---------------------------------------- | ---------- |
| [同步存储](sync.md)       | 把笔记库同步到你接入的存储服务           | 桌面、手机 |
| [资源上传](upload.md)     | 把编辑器里的图片、附件上传到你接入的存储 | 桌面、手机 |
| [语音合成](tts.md)        | 用你接入的服务朗读、生成播客、复刻音色   | 桌面、手机 |
| [语音识别](asr.md)        | 用你接入的服务把语音转成文字             | 桌面、手机 |
| [图片生成](images.md)     | 用你接入的模型生成和编辑图片             | 桌面、手机 |
| [嵌入模型](embeddings.md) | 用你接入的模型为笔记建立语义索引         | 桌面       |
| [视频来源](video.md)      | 从你接入的视频网站或服务添加视频         | 桌面       |
| [博客发布](publish.md)    | 把博客发布到你接入的目标                 | 桌面       |

用户在插件详情的「设置」里填写账号和连接信息，在应用设置里选用哪一个服务。

## 共同的模式

所有提供方都遵循同一套写法，理解了一个，其他的就很容易上手。

### 1. 注册提供方

在 `activate` 中注册，`id` 固定为 `context.pluginId`。每个插件只能注册一个同类提供方。

```ts
context.upload.register({
  id: context.pluginId,
  name: "我的图床",
  async upload(file, config, signal) {
    // ...
  },
});
```

多数提供方用 `create(config)` 根据用户配置创建实例：

```ts
context.sync.register({
  id: context.pluginId,
  name: "我的存储",
  create: config => createStorage(context, parseConfig(config)),
});
```

`create` 是同步的，只根据配置创建对象，**不发起网络请求**。真正的连接在实例的方法被调用时才发生。Tau 在每次任务开始时调用 `create`，同一次任务中配置保持不变。

### 2. 注册配置表单

账号和连接信息用声明式表单收集：你只列出字段，Tau 负责渲染界面、必填校验、保存和测试连接，桌面和手机各自按平台的样式显示。所有提供方都可以声明 `form`，字段写法见[同步存储 · 配置表单](sync.md#配置表单)。

扫码登录、目录授权这类表单表达不了的交互，可以改为提供组件，同样显示在插件详情的「设置」里：

```tsx
import type { PluginSettingsProps } from "@tau/plugins";

function VideoSettings({ videoConfig }: PluginSettingsProps) {
  if (!videoConfig) return null;
  const initial = parseConfig(videoConfig.value);
  // 表单...
  async function save(next: MyConfig) {
    await videoConfig.save(next);
  }
}

context.settings.register({
  id: "video",
  title: "我的视频源",
  target: "video",
  component: VideoSettings,
});
```

| `target`     | 组件收到的配置属性 | 保存方法               |
| ------------ | ------------------ | ---------------------- |
| `sync`       | 只能用 `form`      | Tau 保存               |
| `upload`     | 只能用 `form`      | Tau 保存               |
| `embeddings` | 只能用 `form`      | Tau 保存               |
| `tts`        | `ttsConfig`        | `save(value, models)`  |
| `asr`        | `asrConfig`        | `save(value, modelId)` |
| `images`     | `imageConfig`      | `save(value, modelId)` |
| `video`      | `videoConfig`      | `save(value)`          |
| `publish`    | `publishConfig`    | `save(value)`          |

- 配置属性是可选的，使用前先检查是否存在。
- `value` 是之前保存的 JSON 值，用户还没保存过时可能为空。读取后自己校验结构，缺失的字段用默认值。
- `save` 失败时保留用户的输入，成功后再提示已保存。
- 每个插件的账号单独保存，不和其他插件共享。
- 配置由 Tau 保存，**不要再存一份到 `context.storage`**：`storage` 会随笔记库同步，不适合放凭据。
- `create(config)` 收到的就是这里保存的值。

`register` 返回的句柄的 `open()` 打开该插件的设置分区；保存配置不会自动选用服务。

### 3. 网络请求与取消

- HTTP 请求使用 `context.fetch`，双向连接使用 `context.websocket`，见[存储与网络](../storage-and-network.md)。
- 提供方的方法会收到 `signal`，把它传给 `context.fetch`。重试前的等待、轮询也要响应取消。
- 自己设置超时时，用 `AbortSignal.any([signal, AbortSignal.timeout(ms)])` 组合，不要丢掉 Tau 传入的 `signal`。
- 取消后不要把 `AbortError` 当成可重试的错误。

### 4. 错误处理

- 失败时抛出带可读信息的错误，不要吞掉异常后返回"成功"或空结果，否则 Tau 会误以为操作完成了。
- 错误信息里不要包含 Token、密码等凭据。
- 插件停用时，进行中的请求会被取消，迟到的结果会被丢弃。

### 5. 运行环境

提供方运行在浏览器环境中，可以使用浏览器兼容的 npm 包，但不能使用 Node.js 模块（`fs`、`http`、`Buffer` 等）。很多服务商的 SDK 允许替换 HTTP 实现，把它接到 `context.fetch` 上即可。

### 6. 在 manifest 中选择分类

在 `categories` 中写上对应的分类（`sync`、`upload`、`voice`、`ai`、`video`、`blog-publish`；语音合成和语音识别都用 `voice`，图片生成和嵌入模型都用 `ai`），用户在插件中心按分类筛选时就能找到你的插件。分类只影响展示，注册提供方的是代码。

### 7. 写好 README

提供方插件通常需要用户在服务商那里做一些准备，比如创建存储桶、开放公开读取、生成 Token。把这些步骤和常见错误写进插件的 `README.md`。
