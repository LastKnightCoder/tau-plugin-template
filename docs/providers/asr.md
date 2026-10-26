# 语音识别提供方

使用 SDK 0.43.0，目标最低桌面 0.59.5、Android/iOS 0.2.7。宿主版本与 SDK 的正式发布状态分开检查。模板当前依赖与正式安装流程见[快速开始](/docs/getting-started.md)。

账号配置在应用的语音输入设置中由宿主按 form 渲染（桌面 设置 › 语音 › 语音输入，手机 我的 › 语音 › 语音输入），选用也在同一页；插件详情 › 设置 只给跳转。语音输入按钮的接入与真实设备验收独立进行。Windows 保留 NSIS，本轮不开放系统原生识别；插件通过相同宿主接口接入，不能把接口存在当作真实账号识别已验收。

## 注册与配置

```ts
context.asr.register({
  id: context.pluginId,
  name: "我的语音识别",
  create: (config, modelId) => createRecognition(context.websocket, config, modelId),
});
context.settings.register({
  id: "asr",
  title: "识别账号",
  target: "asr",
  models: [{ id: "recognition-model" }],
  form: {
    groups: [{
      title: "账号",
      link: { label: "控制台", url: "https://example.com/console" },
      fields: [{ key: "apiKey", label: "API Key", type: "secret" }],
    }],
  },
});
```

`createRecognition` 返回 `ASRInstance`，同步固定配置，不联网、不录音。插件页由宿主渲染 form，并保存账号与模型；models 声明初始候选目录。保存不等于选用，用户需在宿主设置中明确选择，失败不回退到云端或其他账号。凭据不要写入 `context.storage`。

## 引擎契约

- `probe({ input, language, ... }, signal)` 返回真实可用性与能力；不下载资源、不申请麦克风。状态包括 ready、needs-config、needs-assets、unsupported、unavailable。
- 实时引擎实现 `openStream(request, options)`，返回 `write(frame)`、`endInput()`、`cancel()`、`result`。文件引擎实现 `transcribeFile`；未实现的方法不声明支持，不能把停止后转录包装成实时结果。
- 输入是协商采样率、单声道、显式小端 PCM Int16。每帧 seq 与 startSample 连续递增；宿主负责采集和重采样。不要在插件访问 getUserMedia 或使用 Node 音频模块。
- 事件通过 options.onEvent 交付；使用 `createASRStreamSession` 管理任务序号、有限队列、结束、取消与尾句超时。临时文字是当前快照的修订，不是追加片段；已确认段不得再次改写。
- `endInput()` 停止接受新音频并排空已排队帧；驱动 finish 发送厂商结束标记，然后等待服务器最终结果。`result` 只在确认最终文本后成功。分句 final 与任务完成是不同状态。
- `cancel()` 中止音频和网络并清理资源；插件停用同样取消进行中任务。不把断线或取消包装成成功、空结果或不完整草稿。
- 麦克风授权、单会话互斥、页面离开、草稿冲突、最终文字写入由宿主负责。插件只识别，不自动发送聊天或执行搜索。

## 网络与背压

使用 [WebSocket](/docs/websocket.md) 的标准事件接口。`send()` 返回 void，`close()` 发起关闭握手，二者均不是识别任务的完成信号。插件在 open 后发送，在 message 中解析并校验厂商协议，在 error/非预期 close 时令任务失败。设置 binaryType = "arraybuffer" 处理二进制协议。

每个会话传入任务 signal，宿主自动合并插件生命周期。背压由宿主负责；插件不引入 send Promise、receive 拉取接口或额外流控协议。JSON、压缩包、序号与时戳仍需插件自己校验。

## 验证清单

类型检查、插件构建、中文临时修订、结束尾帧、空音频、服务器最终标记、连接中取消、录音中停用、断线与额度错误。分别记录桌面、Android、iOS 的设备验证与未验证范围；仅声明平台和通过编译不能替代真实设备及账号验证。
