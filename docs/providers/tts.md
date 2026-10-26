# 语音合成

语音提供方让用户用你接入的服务朗读文字、生成播客，以及复刻音色。

先读[服务提供方](README.md)了解共同的写法。

## 注册

```ts
context.tts.register({
  id: context.pluginId,
  name: "我的语音服务",
  create: (config, modelId) => createVoiceService(context, parseConfig(config), modelId),
});
```

`create(config, modelId)` 用用户的一个账号配置和所选模型创建实例，不发起网络请求。

**用户可以为同一个插件添加多个账号**，每个账号是一份独立的配置。所以不要把"当前的 API Key"存在模块级变量里，一切都从 `create` 收到的 `config` 读取。

## 实例

| 成员                                                | 说明                                                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `getVoices(signal)`                                 | 返回音色列表：`{ id, name, type, description? }`，`type` 为 `system`（预置）、`cloned`（复刻）或 `custom` |
| `synthesize({ text, voiceId, options }, signal)`    | 合成语音，返回 `{ audio: Uint8Array, mime }`。`options` 包含可选的 `speed`、`volume`、`pitch`             |
| `cloneVoice({ file, requestedId?, name? }, signal)` | 可选。用一个参考音频文件复刻音色，返回新建的音色                                                          |
| `textInstructions`                                  | 可选。当前模型支持的文本标记规则（如停顿、语气标签），Tau 生成播客脚本时会参考                            |

- 网络请求使用 `context.fetch`，并传入方法收到的 `signal`。
- `cloneVoice` 的 `file` 是 `{ name, mimeType, content }`，每次一个文件。返回实际创建的音色，不要返回上传文件的 ID。

## 配置表单

```ts
context.settings.register({
  id: "tts", title: "我的语音服务", target: "tts",
  models: [{ id: "speech-model" }],
  form: { groups: [{ title: "账号", fields: [
    { key: "apiKey", label: "API Key", type: "secret" },
    { key: "baseUrl", label: "服务地址", type: "url", optional: true },
  ] }] },
});
```

桌面与移动均由宿主在插件页管理多个账号、凭据与模型。models 只提供新账号的初始目录，不覆盖已保存的自定义模型。应用语音设置选择当前账号、模型与音色并提供试听；保存配置不改变当前服务。字段、校验与 beforeSave 用法见[同步配置](sync.md)。

特殊交互可继续使用 component，接收 ttsConfig（instanceId、value、models、save）；组件只编辑当前账号，不能改其他账号或默认服务。
