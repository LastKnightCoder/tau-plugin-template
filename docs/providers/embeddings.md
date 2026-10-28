# 嵌入模型

嵌入提供方把文本转成向量，Tau 用它为笔记建立知识库索引，支撑语义搜索、相关内容和 AI 检索。

先读[服务提供方](README.md)了解共同的写法。

## 注册

```ts
context.embeddings.register({
  id: context.pluginId,
  name: "我的嵌入服务",
  maxBatchSize: 64,
  create: (config, modelId) => ({
    async embed(texts, signal) {
      // 调用服务商接口，返回与 texts 等长、同序的向量
      return vectors;
    },
  }),
});
```

`create(config, modelId)` 用保存的配置和用户选用的模型创建实例，不发起网络请求。

| 字段           | 说明                                                       |
| -------------- | ---------------------------------------------------------- |
| `maxBatchSize` | 单次 `embed` 最多接收的文本条数，Tau 按它分批；省略时为 32 |
| `embed`        | 返回 `number[][]`，条数与输入一致、顺序相同、维度一致      |

Tau 会校验返回结果：条数不符、向量为空、维度不一致或含非有限数字都会视为失败。服务商返回的结果带序号时，按序号排好再返回。

## 配置表单

```ts
context.settings.register({
  id: "connection",
  title: "我的嵌入服务",
  target: "embeddings",
  models: [
    { id: "embed-small", label: "Embed Small", dimensions: 1024 },
    { id: "embed-large", label: "Embed Large", dimensions: 3072 },
  ],
  form: {
    groups: [
      {
        title: "连接",
        fields: [
          { key: "apiKey", label: "API Key", type: "secret" },
          {
            key: "baseUrl",
            label: "服务地址",
            type: "url",
            default: "https://api.example.com/v1",
            summary: true,
          },
        ],
      },
    ],
  },
});
```

每个插件保存一份连接配置。`models` 列出可选模型，`dimensions` 只用于展示；用户在 设置 › 嵌入模型 里点「设为当前」时，Tau 先调用一次 `embed` 验证连接，并以实际返回的维度为准。嵌入提供方只能用 `form`，不支持组件。

## 用户如何使用

- 保存配置不会改变当前使用的模型；只有在 设置 › 嵌入模型 中「设为当前」并确认后才会生效。
- 不同模型的向量不能混用，切换模型会清除现有索引并重建。
- 插件模型不会自动建立索引，用户需要手动发起；索引会按文本量产生调用费用，在 README 里说明。

## 职责划分

协议、鉴权、超时和重试由插件负责；分批、进度、写入索引和维度一致性检查由 Tau 负责。嵌入请求由 Tau 在后台发起，插件需要保持启用并且主窗口打开；不可用时 Tau 暂停索引，恢复后自动继续。

## 平台

只在桌面可用，`manifest.json` 的 `targets` 只声明 `desktop`。
