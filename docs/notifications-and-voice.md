# 通知、语音输入与朗读

导入、同步这类在后台跑完的任务，用通知告诉用户结果，还可以带一个「查看」按钮直接跳到结果页。想让用户张口记录时，用语音输入拿到识别好的文字；想把文字念出来（例如把文章改写成对话后逐句合成音频）时，用朗读。语音输入和朗读都沿用用户在 Tau 里选好的语音服务，插件不接触账号和音频设备。最简单的通知不需要权限：

```tsx
// src/index.tsx
import { definePlugin } from "@tau/plugins";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

export default definePlugin({
  ...__PLUGIN_META__,
  create: () => ({
    activate(context) {
      context.commands.register({
        id: "import",
        title: "导入摘录",
        run: async () => {
          // …导入
          context.notifications.send({
            title: "导入完成",
            body: "新增了 12 条摘录。",
            tone: "ok",
          });
          return null;
        },
      });
    },
  }),
});
```

## 通知

| 字段      | 说明                                           |
| --------- | ---------------------------------------------- |
| `title`   | 标题，必填，最多 200 字                        |
| `body`    | 可选。正文，最多 5000 字                       |
| `tone`    | 可选。`neutral`（默认）、`ok`、`danger`        |
| `mode`    | 可选。通知出现的位置，见下表                   |
| `sticky`  | 可选。为 `true` 时一直显示，直到用户处理或关闭 |
| `actions` | 可选。最多两个按钮，其中最多一个主按钮         |

| `mode`         | 出现的位置                                             |
| -------------- | ------------------------------------------------------ |
| `auto`（默认） | Tau 窗口在前台时显示在窗口内，否则显示在独立的通知窗口 |
| `in-app`       | 总是显示在窗口内                                       |
| `system`       | 总是显示在独立的通知窗口                               |

- 通知的来源固定显示为你的插件名称。
- 发送通知不需要权限，也不需要用户操作触发，适合在异步任务完成时提醒用户。返回句柄只表示通知已经发出，不代表用户已经看到。
- 通知只在桌面，手机上调用 `send` 会抛错；两端都运行的插件在手机上把结果显示在页面里，见[多端适配](portability.md#各平台可用的接口)。

### 带按钮的通知

```ts
// activate 内；report 为 context.pages.register 返回的页面句柄
context.notifications.send({
  title: "扫描完成",
  body: "发现 3 处断开的链接。",
  sticky: true,
  actions: [
    {
      label: "查看",
      primary: true,
      onClick: async () => {
        await report.open();
      },
    },
  ],
});
```

| 按钮字段       | 说明                                                      |
| -------------- | --------------------------------------------------------- |
| `label`        | 按钮文字，最多 100 字                                     |
| `onClick`      | 点击时执行，可以是异步的；执行期间按钮显示加载状态        |
| `primary`      | 可选。是否为主按钮                                        |
| `resolvedText` | 可选。`onClick` 成功后在通知里显示的结果文字，最多 500 字 |

`onClick` 失败时，错误显示在通知里。插件停用后，旧通知上的按钮不再可用。

### 撤销通知

`send` 返回一个 `Disposable`，调用 `dispose()` 撤销这一条通知，例如任务被用户取消后撤掉「正在导入」：

```ts
const progress = context.notifications.send({ title: "正在导入…", sticky: true });
try {
  // …导入
} finally {
  progress.dispose();
}
```

插件停用时，它发出的通知会自动撤销。

## 语音输入

插件可以让用户按住说话，拿到识别后的文字。识别方式沿用用户在 Tau「语音 › 语音输入」里的设置（系统识别或识别插件），插件不接触音频。在 manifest 的 `permissions` 里声明 `speech:input`（写法见[权限 · 声明](permissions.md#声明)），第一次调用 `start` 时 Tau 询问用户：

```json
{ "permissions": ["speech:input"] }
```

下面是一个「按住说话」按钮，松手后把文字交给调用方：

```tsx
import { useRef, useState } from "react";
import type { PluginContext, PluginSpeechSession } from "@tau/plugins";
import { Button } from "@tau/ui";

export function DictateButton({
  context,
  onText,
}: {
  context: PluginContext;
  onText: (text: string) => void;
}) {
  const pending = useRef<Promise<PluginSpeechSession> | null>(null);
  const [preview, setPreview] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const begin = () => {
    const reason = context.speech.unavailableReason();
    if (reason) return setHint(reason);
    setHint(null);
    const starting = context.speech.start({ onPreview: setPreview });
    starting.catch((error: Error) => setHint(error.message));
    pending.current = starting;
  };

  const end = async () => {
    const starting = pending.current;
    pending.current = null;
    if (!starting) return;
    try {
      const session = await starting;
      await session.stop();
      onText(await session.result);
    } catch (error) {
      setHint((error as Error).message);
    } finally {
      setPreview("");
    }
  };

  return (
    <div>
      <Button onPointerDown={begin} onPointerUp={() => void end()}>
        按住说话
      </Button>
      {preview && <p>{preview}</p>}
      {hint && <p role="alert">{hint}</p>}
    </div>
  );
}
```

| 接口                           | 说明                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `unavailableReason()`          | 当前不能录音的原因（如识别插件的账号还没配置），可以录音时为 `null`；不会询问授权     |
| `start({ signal, onPreview })` | 开始录音，返回录音会话。`onPreview` 收到识别中的整段文字；同一时间只能有一次录音；用户拒绝授权时抛错 |
| `session.stop()`               | 停止录音，`result` 随后给出最终文字                                                  |
| `session.cancel()`             | 放弃这次录音，`result` 以 `AbortError` 失败                                          |
| `session.result`               | 最终识别的文字；`cancel` 或识别出错时失败                                            |

- 录音只在 `start` 与 `stop` / `cancel` 之间进行，最长 120 秒，到时自动停止。插件停用或 `signal` 取消时录音随之中止。
- 「按住说话、上滑取消」这类手势由插件自己实现；`unavailableReason` 可以在按下前判断，给出提示。
- 语音输入只在手机。桌面上 `unavailableReason` 返回不可用的原因，`start` 抛出以 `SPEECH_UNAVAILABLE` 开头的错误，所以两端都运行的插件先判断再显示按钮，见[多端适配](portability.md#各平台可用的接口)。

## 朗读

插件可以把文字念出来，拿到音频字节，例如把文章改写成对话后逐句合成。用的是用户在 Tau「设置 › 语音」里选的语音服务与模型，费用计入该服务；插件不接触账号。在 manifest 的 `permissions` 里声明 `tts:synthesize`，第一次调用 `open` 时 Tau 询问用户：

```json
{ "permissions": ["tts:synthesize"] }
```

```ts
import type { PluginContext, TTSAudio } from "@tau/plugins";

export async function speak(
  context: PluginContext,
  lines: string[],
  signal: AbortSignal,
): Promise<TTSAudio[]> {
  const reason = context.tts.unavailableReason();
  if (reason) throw new Error(reason);
  const session = await context.tts.open({ signal });
  try {
    const [voice] = await session.getVoices({ signal });
    if (!voice) throw new Error(`「${session.providerName}」没有可用的音色`);
    const clips: TTSAudio[] = [];
    for (const text of lines)
      clips.push(await session.synthesize({ text, voiceId: voice.id }, { signal }));
    return clips;
  } finally {
    await session.close();
  }
}
```

| 接口                                             | 说明                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `unavailableReason()`                            | 当前不能朗读的原因（如还没有选语音服务），可以朗读时为 `null`；不会询问授权             |
| `open({ signal })`                               | 打开一次会话，固定当时选的服务与模型                                                    |
| `session.providerName`                           | 服务的显示名                                                                            |
| `session.textInstructions`                       | 可选。服务对朗读文字的要求（如可用的停顿标签），可以写进给 AI 的提示词                  |
| `session.getVoices({ signal })`                  | 可用音色，含用户克隆的音色                                                              |
| `session.synthesize({ text, voiceId, options })` | 合成一段，返回 `{ audio: Uint8Array, mime }`；`options` 可带 `speed`、`volume`、`pitch` |
| `session.close()`                                | 用完关闭；插件停用时会自动关闭                                                          |

- 一次会话里连续合成多段，比每段都 `open` 快，所以示例只 `open` 一次。用户在会话打开期间改了语音设置，已打开的会话仍用原来的服务。
- 音色克隆不对插件开放，引导用户到「设置 › 语音」克隆后，克隆的音色会出现在 `getVoices` 里。
- 合成好的音频用[保存资源文件](plugin-content.md#保存资源文件)存进用户的资料库。
- 朗读只在桌面。手机上 `unavailableReason` 返回不可用的原因，`open` 抛出以 `TTS_UNAVAILABLE` 开头的错误，见[多端适配](portability.md#各平台可用的接口)。

要把合成结果做成 Notebook 里的一种产物（如播客），见 [Notebook 输出](app-surfaces.md#notebook-输出)。
