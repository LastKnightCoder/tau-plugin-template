# 语音识别

语音识别提供方把用户说的话转成文字。接入后，用户在「设置 › 语音 › 语音输入」（手机上是「我的 › 语音 › 语音输入」）里可以选用你的服务。

先读[服务提供方](README.md)了解共同的写法。录音、重采样和把文字填进输入框都由 Tau 负责，插件只负责把音频送到识别服务、把结果交回来。不要在插件里调用 `getUserMedia` 或使用 Node.js 的音频模块。

完整的参考实现是[豆包语音识别插件](https://github.com/LastKnightCoder/tau-plugin-asr-seed)。

## 注册

```ts
context.asr.register({
  id: context.pluginId,
  name: "我的语音识别",
  create: (config, modelId) =>
    createRecognizer(context.websocket, config, modelId),
});

context.settings.register({
  id: "asr",
  title: "识别账号",
  target: "asr",
  models: [{ id: "recognition-model" }],
  form: {
    groups: [
      {
        title: "账号",
        link: { label: "控制台", url: "https://example.com/console" },
        fields: [{ key: "apiKey", label: "API Key", type: "secret" }],
      },
    ],
  },
});
```

`create(config, modelId)` 用用户保存的账号和所选模型创建一个识别实例。它是同步的，只保存配置，不联网、不录音。表单字段的写法见[同步存储 · 配置表单](sync.md#配置表单)；`models` 是新账号的初始模型列表。

## 识别实例

```ts
function createRecognizer(
  websocket: PluginWebSocket,
  config: JsonValue,
  modelId: string,
): ASRInstance {
  return {
    async probe(request, signal) {
      // 返回当前能否识别，以及支持的音频格式
    },
    async openStream(request, options) {
      // 实时识别：边说边出文字
    },
    // async transcribeFile(request, options) { ... }  可选：识别一段录好的音频
  };
}
```

| 方法                               | 说明                                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| `probe(request, signal)`           | Tau 开始录音前调用，返回服务现在能不能用、支持什么。不要在这里联网下载或申请麦克风 |
| `openStream(request, options)`     | 可选。实时识别，返回一个识别会话                                                   |
| `transcribeFile(request, options)` | 可选。识别一个音频文件                                                             |

只实现服务真正支持的方法。只支持录完再识别的服务，不要实现 `openStream` 再在内部攒起来一次性识别。

### probe 的返回值

| 字段            | 说明                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `state`         | `ready` 可用；`needs-config` 账号没填好；`unsupported` 不支持这种语言或输入；`unavailable` 暂时不可用       |
| `reason`        | 可选。不可用时给用户看的原因，例如「请填写 API Key」                                                        |
| `execution`     | `remote`（云端）或 `device`（本机）                                                                         |
| `textUpdates`   | `partial`：边说边更新；`segments`：一句一句出；`final-only`：结束后才有结果                                 |
| `timestamps`    | `none`、`segment` 或 `word`                                                                                 |
| `speakerLabels` | 是否区分说话人                                                                                              |
| `acceptedAudio` | 可选。支持的音频格式，如 `{ streamFormats: [{ encoding: "pcm-s16le", sampleRateHz: 16000, channels: 1 }] }` |
| `maxDurationMs` | 可选。单次最长时长                                                                                          |

`request` 里有 `language`（如 `zh-CN`）和 `input`（`stream` 或 `file`）。不支持时返回 `unsupported`，不要抛异常。

## 实时识别

Tau 按 `acceptedAudio` 里的格式把麦克风音频转成单声道、小端 16 位 PCM，一帧一帧交给会话。用 `createASRStreamSession` 创建会话，它负责帧的排队、结束、取消和超时，你只写和服务通信的三个函数：

```ts
import { createASRStreamSession, ASRError } from "@tau/plugins";

async openStream(request, options) {
  const socket = websocket.connect("wss://api.example.com/asr", [], {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: options.signal,
  });
  socket.binaryType = "arraybuffer";

  return createASRStreamSession(options, request.format, async (signal, emit) => {
    await waitForOpen(socket);
    socket.send(JSON.stringify({ type: "start", language: request.language }));
    const final = receiveResults(socket, emit); // 解析服务端消息，调用 emit 更新文字

    return {
      async write(frame) {
        socket.send(frame.data);
      },
      async finish() {
        socket.send(JSON.stringify({ type: "end" })); // 按服务协议发送结束标记
        return final; // 等服务端返回最终结果
      },
      async dispose() {
        socket.close();
      },
    };
  });
}
```

| 函数      | 何时调用                       | 要做的事                                                       |
| --------- | ------------------------------ | -------------------------------------------------------------- |
| `write`   | 每收到一帧音频                 | 把 `frame.data` 发给服务                                       |
| `finish`  | 用户停止说话，剩余的帧都发完后 | 发送服务的结束标记，等最终结果返回，返回 `{ text, segments? }` |
| `dispose` | 结束、失败或取消时             | 关闭连接，释放资源                                             |

- 识别过程中用 `emit` 更新文字：`{ type: "segments", ... }` 替换某一段范围内的句子。还没确定的句子可以反复改写，标了 `final: true` 的句子不能再改。
- `finish` 只在拿到服务端的最终结果后返回。某一句是 final 不等于整个识别结束，要等服务明确表示结束。
- 断线、服务返回错误、被取消时抛出 `ASRError` 或普通错误，不要返回空结果或半截文字假装成功。
- 用户停止说话后最多等 10 秒最终结果，超时视为失败。

WebSocket 的用法见[存储与网络 · WebSocket](../storage-and-network.md#websocket)。`send` 是同步的，发送排队由 Tau 处理，不需要自己做流量控制。`socket.close()` 不是识别结束的信号，正常结束一定先走 `finish`。

## 测试

- 中文边说边出文字，停顿后已确定的句子不再变化。
- 说完立刻停止，最后一个字也能识别出来。
- 没有说话直接停止、连接中途取消、录音时停用插件。
- 断网、账号错误、额度用完时，提示可读的错误。
- 在桌面和手机上分别试一遍；只声明了的平台才需要。
