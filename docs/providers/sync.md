# 同步存储

同步存储提供方让用户把笔记库同步到你接入的存储服务（对象存储、网盘等）。你只需要实现"读写远端文件"的几个基本操作；同步什么、怎么命名、版本与冲突、断点恢复都由 Tau 负责。

先读[服务提供方](README.md)了解共同的写法。

## 注册

```ts
import type { SyncProvider } from "@tau/plugins/sync";

context.sync.register({
  id: context.pluginId,
  name: "我的存储",
  create: (config) => createStorage(context, parseConfig(config)),
});

function createStorage(context: PluginContext, config: MyConfig): SyncProvider {
  return {
    async uploadFile(name, bytes) {
      /* ... */ return true;
    },
    async downloadFile(name) {
      /* ... */ return new Uint8Array();
    },
    async fileExists(name) {
      /* ... */ return false;
    },
    async listFiles(prefix) {
      /* ... */ return [];
    },
    async createFileIfAbsent(name, bytes) {
      /* ... */ return true;
    },
  };
}
```

类型 `SyncProvider`、`SyncProviderDefinition`、`RemoteFileInfo` 从 `@tau/plugins/sync` 导入。

## 需要实现的方法

| 方法                              | 返回                        | 说明                                                         |
| --------------------------------- | --------------------------- | ------------------------------------------------------------ |
| `uploadFile(name, bytes)`         | `Promise<boolean>`          | 上传对象，已存在时覆盖                                       |
| `downloadFile(name)`              | `Promise<Uint8Array>`       | 下载对象                                                     |
| `fileExists(name)`                | `Promise<boolean>`          | 对象是否存在                                                 |
| `listFiles(prefix?)`              | `Promise<RemoteFileInfo[]>` | 列出前缀下的全部对象，**分页由你在内部处理完**，返回完整列表 |
| `createFileIfAbsent(name, bytes)` | `Promise<boolean>`          | 只在对象不存在时创建，已存在时返回 `false`                   |

`RemoteFileInfo` 包含 `name`、`path`（相对路径）、`size`，以及可选的 `lastModified`、`hash`。

### createFileIfAbsent 必须是原子的

Tau 用它来保证多台设备同时同步时不会互相覆盖。它必须使用存储服务本身的条件写入能力（如 S3 的 `If-None-Match: *`），**不能用"先查是否存在、再上传"来模拟**，那样在并发时会出错。

请求失败、无法确定结果时直接抛出错误，Tau 会按自己的规则核实。

## 配置表单

同步与上传的配置表单只声明字段，不写界面。Tau 在插件详情 › 设置里按平台渲染（桌面为设置行，手机为分组行与推入式选择页），负责保存、必填校验、连接测试和服务选用；设置 › 同步 / 资源存储只列出各服务的摘要与状态。

```ts
context.settings.register({
  id: "sync",
  title: "我的存储",
  target: "sync",
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
            placeholder: "sync",
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

| 字段类型         | 用途                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `text`           | 普通文本                                                                                                               |
| `secret`         | 密钥、令牌、密码；不能作摘要                                                                                           |
| `url`            | 地址                                                                                                                   |
| `choice`         | 固定选项，`default` 为缺省值                                                                                           |
| `remote-choice`  | 按已填的值远程加载选项（如仓库、分支），`dependsOn` 中的字段变化时清空                                                 |
| `switch`         | 开关，值为 `"true"` / `"false"`，`default` 为布尔；不参与必填校验                                                      |
| `service-choice` | 由 Tau 弹出选择（目前只有 `git.cacheDirectory`，选择本机目录，仅桌面），值与 `labelKey` 显示名一起保存；留空用默认位置 |

- 未标 `optional` 的字段都是必填，空值时 Tau 拒绝保存并标在字段上；「可选」由 Tau 显示，不要写进 label。
- 选项可带 `description`：手机上少量（≤3）带说明的选项平铺为整行单选，桌面在字段说明里显示当前选项的说明。
- 分组可带 `link: { label, url }`（仅 https），用于服务商控制台等外部链接。
- 字段可带 `visibleWhen: { key, equals }`，只在另一字段取该值时显示；隐藏时不参与必填校验，已存值保留。
- `beforeSave` 抛出 `ProviderFieldError(key, message)` 时，错误标在对应字段；其他错误显示在保存结果中。
- `summary: true` 的字段按顺序拼成服务列表里的摘要，例如「tau-sync · ap-southeast-1」。
- 配置值一律是字符串；保存时与已存配置合并，未声明的键原样保留。
- 保存不会改变用户当前选用的服务；选用由用户在设置页或插件设置页单独操作。

- 每次同步任务开始时，Tau 用当时的配置调用 `create`，任务过程中配置不变。
- 关闭设置页不影响进行中的同步。
- 同步进行中，插件不能被停用或卸载。
- 停用插件后，配置会保留。
