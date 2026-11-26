# 服务提供方

Tau 的一些功能允许用户选择背后的服务：同步到哪个存储、图片上传到哪个图床、用哪家的语音合成等等。插件可以注册为这些功能的**提供方**，把一个新的服务接入进来。

| 提供方                    | 接入后用户可以                           |
| ------------------------- | ---------------------------------------- |
| [同步存储](sync.md)       | 把资料库同步到你接入的存储服务           |
| [资源上传](upload.md)     | 把编辑器里的图片、附件上传到你接入的存储 |
| [语音合成](tts.md)        | 用你接入的服务朗读、生成播客、复刻音色   |
| [语音识别](asr.md)        | 用你接入的服务把语音转成文字             |
| [图片生成](images.md)     | 用你接入的模型生成和编辑图片             |
| [嵌入模型](embeddings.md) | 用你接入的模型为笔记建立语义索引         |
| [视频来源](video.md)      | 从你接入的视频网站或服务添加视频         |
| [博客发布](publish.md)    | 把博客发布到你接入的目标                 |

同步存储、资源上传、语音合成、语音识别和图片生成在桌面和手机上都能用，嵌入模型、视频来源和博客发布只在桌面可用，见[多端适配](../portability.md)。

用户在插件详情的「设置」里填写账号和连接信息，在 Tau 的设置里选用哪一个服务。

## 注册提供方

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

## 配置表单

账号和连接信息用声明式表单收集：你只列出字段，Tau 负责渲染界面、必填校验、保存和测试连接。所有提供方都可以声明 `form`，用 `context.settings.register` 注册，`target` 写提供方的种类：

```ts
import { ProviderFieldError } from "@tau/plugins";

context.settings.register({
  id: "storage",
  title: "我的存储",
  target: "sync",
  form: {
    groups: [
      {
        title: "账号",
        link: { label: "控制台", url: "https://console.example.com" },
        fields: [
          { key: "accessKey", label: "Access Key", type: "text" },
          { key: "secretKey", label: "Secret Key", type: "secret" },
        ],
      },
      {
        title: "存储位置",
        fields: [
          { key: "bucket", label: "Bucket", type: "text", summary: true },
          { key: "prefix", label: "目录", type: "text", optional: true, placeholder: "sync" },
          {
            key: "style",
            label: "地址模式",
            type: "choice",
            default: "path",
            options: [
              { value: "path", label: "路径模式" },
              { value: "host", label: "虚拟主机模式", description: "Bucket 写在域名里" },
            ],
          },
          { key: "customDomain", label: "自定义域名", type: "switch" },
          {
            key: "domain",
            label: "域名",
            type: "url",
            visibleWhen: { key: "customDomain", equals: "true" },
          },
        ],
      },
    ],
    async beforeSave(values, signal) {
      if (values.bucket !== values.bucket.toLowerCase())
        throw new ProviderFieldError("bucket", "Bucket 名称只能用小写字母");
      return values;
    },
  },
});
```

桌面上，表单是插件详情「设置」里的一张设置卡片，每个分组是卡片里的一节；手机上，每个分组是一组设置行，选项在推入的选择页里挑。保存按钮和离开前的确认都由 Tau 提供。

### 跟随界面语言

在插件自己的 JSON 词典中声明表单文案，并将该词典挂到 `definePlugin` 的 `i18n`，做法见[界面语言](/docs/ui-components.md#界面语言)。表单使用 `ProviderFormDeclaration`，文字字段填 `messages.ref()`，不用重新登记或为语言变化重新请求远程选项：

```ts
import type { PluginContext, ProviderFormDeclaration } from "@tau/plugins";
import { messages } from "./i18n";

export function registerSettings(context: PluginContext) {
  const form = {
    groups: [
      {
        title: messages.ref("account.title"),
        fields: [{ key: "token", type: "secret", label: messages.ref("account.token") }],
      },
    ],
  } satisfies ProviderFormDeclaration;
  context.settings.register({
    id: "account",
    title: messages.ref("settings.title"),
    target: "publish",
    form,
  });
}
```

示例中的 `messages` 按界面语言指南导入独立 JSON 文件，并声明 `account.title`、`account.token`、`settings.title`。分组标题、说明和链接名称，字段的标签、说明和占位，以及静态或远程选项的标签、说明都接受引用；纯字符串保持原文。远程 `load` 的返回选项也可以使用 `messages.ref()`，语言变化只更新展示，不再调用 `load`。

`key`、`value`、`default`、`labelKey`、依赖条件与 URL 是业务值，保持普通值。`ProviderForm` 仍表示宿主已解析的字符串表单；验证、摘要和保存逻辑继续使用它。

### 字段类型

| `type`           | 用途                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| `text`           | 普通文本                                                                                                      |
| `secret`         | 密钥、令牌、密码。输入时隐藏，不能作摘要                                                                      |
| `url`            | 地址                                                                                                          |
| `choice`         | 固定选项，`options` 至少一项，`default` 为缺省值                                                              |
| `remote-choice`  | 按已填的值远程加载选项（如仓库、分支）：`load(values, signal)` 返回选项；`dependsOn` 中的字段变化时清空本字段 |
| `switch`         | 开关，值为 `"true"` / `"false"`，`default` 写布尔值；不参与必填校验，不能作摘要                               |
| `service-choice` | 由 Tau 弹出选择，用户不直接输入。`service` 目前只能写 `git.cacheDirectory`（选择本机目录，只能在桌面上改）    |

`service-choice` 的值存在 `key`，显示名存在 `labelKey`（必须是另一个没被占用的键）；留空表示用 Tau 的默认位置，`placeholder` 写默认时的说明。

### 字段与分组的属性

| 属性           | 说明                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| `key`、`label` | 必填。`key` 在整张表单内不能重复                                                      |
| `description`  | 字段下方的说明                                                                        |
| `placeholder`  | 输入框的占位文字                                                                      |
| `optional`     | 不写就是必填，空值时 Tau 拒绝保存并标在字段上。「可选」由 Tau 显示，不要写进 `label`  |
| `summary`      | 按声明顺序拼成服务列表里的摘要，例如「tau-sync · ap-southeast-1」                     |
| `visibleWhen`  | `{ key, equals }`：只在另一字段取这个值时显示。隐藏的字段不参与必填校验，已存的值保留 |

- 选项可以带 `description`。手机上，不超过三个、带说明的选项直接平铺成整行单选；桌面在字段说明里显示当前选项的说明。
- 分组有 `title`（必填）、`description`，以及可选的 `link: { label, url }`，用于服务商控制台等外部链接，只接受 `https://` 地址。
- 表单写错（分组为空、`key` 重复、`visibleWhen` 指向不存在的字段等）时，`register` 直接抛错。

### 保存

- `beforeSave(values, signal)` 可选，在保存前补全或校验，例如按令牌查出用户名填进去。抛出 `ProviderFieldError(key, message)` 时错误标在对应字段上，其他错误显示在保存结果里。
- 配置值一律是字符串。保存时和已存的配置合并，表单里没声明的键原样保留。
- 同步存储和博客发布保存后会测试连接，测试失败时配置已保存，并提示连接失败的原因。
- 保存不会改变用户当前选用的服务，选用由用户在设置里单独操作。
- 配置由 Tau 保存，**不要再存一份到 `context.storage`**：`storage` 会随资料库同步，不适合放凭据。
- 每个插件的配置单独保存，不和其他插件共享。`create(config)` 收到的就是这里保存的值。

`register` 返回的句柄的 `open()` 打开该插件的设置分区。

## 自定义设置组件

扫码登录、目录授权这类表单表达不了的交互，可以改为提供组件，同样显示在插件详情的「设置」里。组件用 `@tau/ui` 的 `SettingRow` 排列设置项，用 `useSettingsDraft` 接入 Tau 的悬浮保存条：你报告有没有改动、怎么保存、怎么还原，保存按钮、⌘S 和离开前的确认都由 Tau 提供。

```tsx
import { useState } from "react";
import {
  useSettingsDraft,
  type JsonValue,
  type PluginContext,
  type PluginSettingsProps,
} from "@tau/plugins";
import { Input, SettingRow } from "@tau/ui";

function readCookie(value: JsonValue | undefined) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.cookie === "string"
    ? value.cookie
    : "";
}

function VideoSettings({ videoConfig }: PluginSettingsProps) {
  const saved = readCookie(videoConfig?.value);
  const [cookie, setCookie] = useState(saved);

  useSettingsDraft({
    dirty: cookie !== saved,
    changes: [{ label: "Cookie" }],
    save: () => videoConfig?.save({ cookie }),
    reset: () => setCookie(saved),
  });

  if (!videoConfig) return null;
  return (
    <SettingRow title="Cookie" description="登录网页版后从浏览器复制">
      <Input type="password" value={cookie} onChange={event => setCookie(event.target.value)} />
    </SettingRow>
  );
}

export function activate(context: PluginContext) {
  context.settings.register({
    id: "video",
    title: "我的视频站",
    target: "video",
    component: VideoSettings,
  });
}
```

`useSettingsDraft` 的参数、保存失败与离开确认的行为见[设置与命令 · 保存与离开确认](../settings-and-commands.md#保存与离开确认)。

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
- `save` 抛错时 Tau 在保存条上显示错误信息，草稿保留，用户可以改了再存。

## 网络请求与取消

- HTTP 请求使用 `context.fetch`，双向连接使用 `context.websocket`，见[存储与网络](../storage-and-network.md)。
- 提供方的方法会收到 `signal`，把它传给 `context.fetch`。重试前的等待、轮询也要响应取消。
- 自己设置超时时，用 `AbortSignal.any([signal, AbortSignal.timeout(ms)])` 组合，不要丢掉 Tau 传入的 `signal`。
- 取消后不要把 `AbortError` 当成可重试的错误。

## 错误处理

- 失败时抛出带可读信息的错误，不要吞掉异常后返回"成功"或空结果，否则 Tau 会误以为操作完成了。
- 错误信息里不要包含 Token、密码等凭据。
- 插件停用时，进行中的请求会被取消，迟到的结果会被丢弃。

## 运行环境

提供方运行在浏览器环境中，可以使用浏览器兼容的 npm 包，但不能使用 Node.js 模块（`fs`、`http`、`Buffer` 等）。很多服务商的 SDK 允许替换 HTTP 实现，把它接到 `context.fetch` 上即可。

## 在 manifest 中选择分类

在 `categories` 中写上对应的分类（`sync`、`upload`、`voice`、`ai`、`video`、`blog-publish`；语音合成和语音识别都用 `voice`，图片生成和嵌入模型都用 `ai`），用户在插件中心按分类筛选时就能找到你的插件。分类只影响展示，注册提供方的是代码。

## 写好 README

提供方插件通常需要用户在服务商那里做一些准备，比如创建存储桶、开放公开读取、生成 Token。把这些步骤和常见错误写进插件的 `README.md`。

接下来按你要接入的服务，读上面表格里对应的一篇。
