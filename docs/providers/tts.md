# 语音合成

语音提供方让用户用你接入的服务朗读文字、生成播客，以及复刻音色。

先读[服务提供方](README.md)了解共同的写法。

## 注册

```ts
context.tts.register({
  id: context.pluginId,
  name: "我的语音服务",
  create: (config, modelId) =>
    createVoiceService(context, parseConfig(config), modelId),
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
  id: "tts",
  title: "我的语音服务",
  target: "tts",
  models: [{ id: "speech-model" }],
  form: {
    groups: [
      {
        title: "账号",
        fields: [
          { key: "apiKey", label: "API Key", type: "secret" },
          { key: "baseUrl", label: "服务地址", type: "url", optional: true },
        ],
      },
    ],
  },
});
```

用户可以在插件详情的「设置」里添加多个账号，每个账号有自己的凭据和模型列表；`models` 是新账号的初始模型列表，不会覆盖用户已经添加的模型。在「设置 › 语音」里选用哪个账号、模型和音色，并试听。字段写法见[同步存储 · 配置表单](sync.md#配置表单)。

需要特殊交互时改用组件，组件收到 `ttsConfig`（`instanceId`、`value`、`models`、`save`），只能编辑当前这一个账号。

## 复刻音色需要公网地址时

有些服务复刻音色时要求提供参考音频的公网地址。用 `context.upload.uploadRemote(file, signal)` 把文件上传到用户当前选用的远端存储，拿到地址。用户的资源存储是「本地保存」时它会报错，把这个错误提示给用户，不要伪造地址。
