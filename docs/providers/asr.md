# 语音识别

语音识别提供方把用户说的话转成文字。接入后，用户在「设置 › 语音 › 语音输入」（手机上是「我的 › 语音 › 语音输入」）里可以选用你的服务。

先读[服务提供方](README.md)了解共同的写法。录音、重采样和把文字填进输入框都由 Tau 负责，插件只负责把音频送到识别服务、把结果交回来。不要在插件里调用 `getUserMedia` 或使用 Node.js 的音频模块。

完整的参考实现是[豆包语音识别插件](https://github.com/LastKnightCoder/tau-plugin-asr-seed)。

## 注册

```ts
import type { ASRInstance, JsonValue, PluginContext } from "@tau/plugins";

context.asr.register({
  id: context.pluginId,
  name: "我的语音识别",
  create: (config, modelId) => createRecognizer(context, parseConfig(config), modelId),
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

`create(config, modelId)` 用用户保存的账号和所选模型创建一个识别实例。它是同步的，只保存配置，不联网、不录音。表单字段的写法见[服务提供方 · 配置表单](README.md#配置表单)；`models` 是新账号的初始模型列表。

`parseConfig` 把保存的 JSON 读成你自己的配置结构，下文的示例都从 `config.apiKey` 读 API Key：

```ts
interface RecognizerConfig {
  apiKey: string;
}

function parseConfig(config: JsonValue): RecognizerConfig {
  const value = config && typeof config === "object" && !Array.isArray(config) ? config : {};
  return { apiKey: typeof value.apiKey === "string" ? value.apiKey : "" };
}
```

## 识别实例

```ts
function createRecognizer(
  context: PluginContext,
  config: RecognizerConfig,
  modelId: string,
): ASRInstance {
  return {
    async probe(request, signal) {
      // 返回当前能否识别，以及支持的音频格式，见下文
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

```ts
async probe(request, signal) {
  if (!config.apiKey)
    return {
      state: "needs-config",
      reason: "请填写 API Key",
      execution: "remote",
      textUpdates: "partial",
      timestamps: "segment",
      speakerLabels: false,
    };
  return {
    state: "ready",
    execution: "remote",
    textUpdates: "partial",
    timestamps: "segment",
    speakerLabels: false,
    acceptedAudio: {
      streamFormats: [{ encoding: "pcm-s16le", sampleRateHz: 16000, channels: 1 }],
    },
  };
},
```

## 实时识别

Tau 按 `acceptedAudio` 里的格式把麦克风音频转成单声道、小端 16 位 PCM，一帧一帧交给会话。用 `createASRStreamSession` 创建会话，它负责帧的排队、结束、取消和超时，你只写和服务通信的三个函数：

```ts
import { createASRStreamSession, ASRError } from "@tau/plugins";

async openStream(request, options) {
  const socket = context.websocket.connect("wss://api.example.com/asr", [], {
    headers: { Authorization: `Bearer ${config.apiKey}` },
    signal: options.signal,
  });
  socket.binaryType = "arraybuffer";

  return createASRStreamSession(options, request.format, async (signal, emit) => {
    await waitForOpen(socket, signal);
    socket.send(JSON.stringify({ type: "start", model: modelId, language: request.language }));
    // 按服务协议解析消息：边识别边调用 emit 更新文字，服务表示结束时 resolve 最终结果
    const final = receiveResults(socket, emit);

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

`waitForOpen`（等连接打开，`signal` 中止时抛错）和 `receiveResults` 按你的服务协议自己写，可以参考豆包语音识别插件。

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

## 文件识别

用户对一段录好的音频点「转文字」时，Tau 调 `transcribeFile`。`probe` 收到的 `input` 是 `file`。

```ts
import { ASRError, createASRTask } from "@tau/plugins";

async transcribeFile(request, options) {
  return createASRTask(options, async (signal, emit) => {
    const { audio } = request;
    const headers = { Authorization: `Bearer ${config.apiKey}` };
    emit({ type: "progress", stage: audio.url ? "recognizing" : "uploading" });
    const response = audio.url
      ? // 有公网地址：交给服务自己下载
        await context.fetch("https://api.example.com/asr/file", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ model: modelId, language: request.language, url: audio.url }),
          signal,
        })
      : // 没有：读出字节直接上传
        await context.fetch(`https://api.example.com/asr/upload?model=${encodeURIComponent(modelId)}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": audio.mimeType },
          body: await new Response(await audio.open(signal)).arrayBuffer(),
          signal,
        });
    if (!response.ok) throw new ASRError("unavailable", `识别失败：${response.status}`);
    return parseTranscript(await response.json()); // 把服务的返回读成 { text, segments? }
  });
}
```

`parseTranscript` 同样按服务的返回格式自己写。

| 字段                 | 说明                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `audio.name`         | 文件名                                                                                                       |
| `audio.mimeType`     | 格式。声明了 `fileMimeTypes` 时一定是其中一种；没声明时是原文件的真实类型，识别不出为 `application/octet-stream` |
| `audio.sizeBytes`    | 字节数                                                                                                       |
| `audio.url`          | 可选。`open()` 读出的同一份音频的公网可下载地址，用户的资源存在远程存储时才有。可能下载不到（私有桶），要能退回读 `open()` |
| `audio.open(signal)` | 返回 `ReadableStream<Uint8Array>`，按需读取，不要求整个文件进内存                                             |

**格式**：不声明 `acceptedAudio.fileMimeTypes`，Tau 把原文件交给你。声明了，Tau 只交列表里的格式，原文件不在列表时先转换；Tau 转不出时提示用户换服务，不会调用 `transcribeFile`。

**时长**：`maxDurationMs` 填你能接受的最长音频，Tau 在知道时长时提前拦截。上限要看这次怎么传（比如有地址和上传字节不一样）就不要填，在 `transcribeFile` 里判断，不符合时抛 `new ASRError("invalid-input", "给用户看的原因")`。

**结果**：只要求 `text`。服务能分句就给 `segments`（都要 `final: true`），能给时间才填 `startMs` / `endMs`，不要补假时间；`probe` 的 `timestamps` 如实写 `none`、`segment` 或 `word`。Tau 有分段时每段一个段落，所有段都有开始时间时才在段首标时间。

**进度**：要排队或轮询的服务，用 `emit({ type: "progress", stage: "uploading" | "recognizing", fraction? })` 报进度，Tau 显示在音频块上。`createASRTask` 负责取消与结束，传给它的函数返回最终结果即可。

## 测试

- 中文边说边出文字，停顿后已确定的句子不再变化。
- 说完立刻停止，最后一个字也能识别出来。
- 没有说话直接停止、连接中途取消、录音时停用插件。
- 断网、账号错误、额度用完时，提示可读的错误。
- 实现了 `transcribeFile` 时，对录好的音频点「转文字」，资源在本地和在远程存储时各试一次。
- 在桌面和手机上分别试一遍；只声明了的平台才需要。
