# 资源上传

资源上传提供方让用户把编辑器里的图片、附件上传到你接入的存储（图床、对象存储、Git 仓库等），正文中直接引用返回的地址。

先读[服务提供方](README.md)了解共同的写法。资源上传与[同步存储](sync.md)是两套独立的接口。

## 注册

```ts
context.upload.register({
  id: context.pluginId,
  name: "我的图床",
  async upload(file, config, signal) {
    const settings = parseConfig(config);
    const response = await context.fetch(
      `${settings.endpoint}/${encodeURIComponent(file.name)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": file.mimeType,
          Authorization: `Bearer ${settings.token}`,
        },
        body: file.content,
        signal,
      },
    );
    if (!response.ok) throw new Error(`上传失败：${response.status}`);
    return `${settings.publicBaseUrl}/${encodeURIComponent(file.name)}`;
  },
});
```

`upload(file, config, signal)`：

| 参数     | 说明                                                                               |
| -------- | ---------------------------------------------------------------------------------- |
| `file`   | `{ name, mimeType, content }`。`name` 已由 Tau 唯一命名，`content` 是 `Uint8Array` |
| `config` | 用户保存的配置                                                                     |
| `signal` | 取消信号，传给 `context.fetch`                                                     |

返回资源的 HTTP(S) 地址。

## 返回的地址

- 地址会写进正文，必须**长期有效**。不要返回有过期时间的签名地址。
- 上传成功不等于任何人都能访问：存储桶或仓库的公开读取需要用户自己设置。不要自动修改用户的存储权限，在 README 里说明怎么配置。
- 需要自定义公开域名时，在配置表单中声明一个可选的 `url` 字段，按对象路径拼出完整地址。

## 配置表单

同步与上传的配置表单只声明字段，不写界面。Tau 在插件详情 › 设置里按平台渲染（桌面为设置行，手机为分组行与推入式选择页），负责保存、必填校验、连接测试和服务选用；设置 › 同步 / 资源存储只列出各服务的摘要与状态。

```ts
context.settings.register({
  id: "upload",
  title: "我的存储",
  target: "upload",
  form: {
    groups: [
      {
        title: "账号",
        fields: [
          { key: "accessKey", label: "Access Key", type: "text" },
          { key: "secretKey", label: "Secret Key", type: "secret" },
        ],
      },
      {
        title: "存储位置",
        fields: [
          { key: "bucket", label: "Bucket", type: "text", summary: true },
          {
            key: "prefix",
            label: "目录",
            type: "text",
            optional: true,
            placeholder: "uploads",
          },
          {
            key: "style",
            label: "地址模式",
            type: "choice",
            default: "path",
            options: [
              { value: "path", label: "路径模式" },
              { value: "host", label: "虚拟主机模式" },
            ],
          },
        ],
      },
    ],
    // 可选：保存前补全或校验，抛出的错误原样显示给用户
    beforeSave: async (values, signal) => values,
  },
});
```

| 字段类型        | 用途                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| `text`          | 普通文本                                                               |
| `secret`        | 密钥、令牌、密码；不能作摘要                                           |
| `url`           | 地址                                                                   |
| `choice`        | 固定选项，`default` 为缺省值                                           |
| `remote-choice` | 按已填的值远程加载选项（如仓库、分支），`dependsOn` 中的字段变化时清空 |

- 未标 `optional` 的字段都是必填，空值时 Tau 拒绝保存并标在字段上；「可选」由 Tau 显示，不要写进 label。
- `summary: true` 的字段按顺序拼成服务列表里的摘要，例如「tau-sync · ap-southeast-1」。
- 配置值一律是字符串；保存时与已存配置合并，未声明的键原样保留。
- 保存不会改变用户当前选用的服务；选用由用户在设置页或插件设置页单独操作。

## 职责划分

Tau 负责图片压缩、文件命名、本地保存和多窗口之间的转发；插件只负责把文件传到远端并返回地址。插件拿不到用户的文件路径，也不修改笔记内容。

## 在其他功能中使用上传

插件自己需要上传文件时（例如上传参考音频），调用 `context.upload.uploadRemote`，它使用用户当前选择的远端上传配置：

```ts
const url = await context.upload.uploadRemote(
  { name: "sample.mp3", mimeType: "audio/mpeg", content: bytes },
  { signal },
);
```

用户选择的是本地存储时，`uploadRemote` 会明确报错，不会自动换成其他存储。取消只是停止等待，不会撤回已经上传的文件。

## 测试清单

- 用户选择本地存储时，插件不会被调用。
- 上传成功、失败（认证错误、网络错误）都有正确的结果和提示。
- 保存配置、停用插件、在独立窗口中上传、重启后再上传。
