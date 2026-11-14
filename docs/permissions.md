# 权限

读取或修改用户的卡片、文章、待办这类数据，使用 Tau 的大模型或语音，都要先在 manifest 里声明权限，第一次调用时由用户决定是否允许。用户亲手选择的内容、插件自己创建的内容不需要权限，见[引用用户的内容](references.md)与[插件内容与记录](plugin-content.md)。

下面的页面列出最近修改的卡片。没有授权时先显示说明和「允许访问」按钮，用户点击后才弹窗询问：

```json
{ "permissions": ["cards:read"] }
```

```tsx
import { useEffect, useState } from "react";
import {
  PluginPermissionError,
  type PluginCard,
  type PluginPageProps,
  type PluginPermissionState,
} from "@tau/plugins";
import { Button } from "@tau/ui";

export function RecentCardsPage({ context }: PluginPageProps) {
  const [access, setAccess] = useState<PluginPermissionState>();
  const [cards, setCards] = useState<PluginCard[]>([]);

  useEffect(() => {
    void context.permissions.query("cards:read").then((state) => {
      if (!context.signal.aborted) setAccess(state);
    });
  }, [context]);

  useEffect(() => {
    if (access !== "granted") return;
    context.data.cards.query({ limit: 20 }).then(
      (page) => {
        if (!context.signal.aborted) setCards(page.items);
      },
      (error: unknown) => {
        // 用户可能已在插件详情页撤销授权
        if (error instanceof PluginPermissionError) setAccess("denied");
        else throw error;
      },
    );
  }, [context, access]);

  async function allow() {
    const granted = await context.permissions.request(["cards:read"]);
    setAccess(granted ? "granted" : "denied");
  }

  if (access === "prompt")
    return (
      <section>
        <p>列出最近修改的卡片，需要允许读取你的卡片。</p>
        <Button onClick={() => void allow()}>允许访问</Button>
      </section>
    );
  if (access === "denied") return <p>没有读取卡片的权限，可以在插件详情页的「权限」中修改。</p>;
  return (
    <ul>
      {cards.map((card) => (
        <li key={card.id}>{card.title}</li>
      ))}
    </ul>
  );
}
```

## 声明

在 manifest 中列出插件可能用到的权限。这是插件能申请的上限，没有声明的权限永远无法获得：

```json
{ "permissions": ["cards:read", "todos:read", "todos:write"] }
```

| 权限                                                  | 允许                                                 |
| ----------------------------------------------------- | ---------------------------------------------------- |
| `cards:read`、`articles:read`、`documents:read`       | 读取卡片、文章、项目文档及其正文，接收它们的变化事件 |
| `cards:write`、`articles:write`、`documents:write`    | 新建、修改，以及修改正文；项目文档还包括在项目内移动 |
| `cards:delete`、`articles:delete`、`documents:delete` | 删除                                                 |
| `todos:read`、`todos:write`、`todos:delete`           | 读取、新建与修改、删除待办                           |
| `calendar:read`、`calendar:write`、`calendar:delete`  | 读取、新建与修改、删除日程                           |
| `whiteboards:read`、`projects:read`                   | 读取白板、项目的信息                                 |
| `whiteboards:write`、`projects:write`                 | 新建和修改白板、项目（不含画板内容）                 |
| `whiteboards:delete`、`projects:delete`               | 删除白板、空项目                                     |
| `notebooks:read`                                      | 读取 Notebook 的信息和资料清单                       |
| `materials:read`                                      | 读取划线、PDF 标注和剪藏的原文、想法与出处           |
| `chats:read`                                          | 读取 AI 对话的信息，不含消息内容                     |
| `flashcards:read`、`flashcards:write`                 | 闪卡，见[闪卡](flashcards.md)                        |
| `ai:<能力名>`                                         | 使用 Tau 已配置的大模型，见 [AI](ai.md)              |
| `speech:input`、`tts:synthesize`                      | 语音输入、朗读，见[通知、语音输入与朗读](notifications-and-voice.md#语音输入) |

- 声明的权限必须是上表中的值，写错时构建会报错。SDK 导出了全部权限 ID 的列表 `PLUGIN_PERMISSIONS` 和判断函数 `isPluginPermission`，插件需要把权限 ID 存进自己的数据或从配置里读出时，用它校验。
- 手机上能申请的权限更少，声明了 `android` 或 `ios` 的插件如果申请了手机不支持的权限，构建和插件中心都会拒绝，见[多端适配](portability.md#各平台可用的接口)。
- 只申请功能确实需要的权限。

## 用户如何授权

插件第一次调用需要权限的接口时，Tau 会弹窗询问用户：

- **仅这次**：在插件停用或 Tau 重启前有效。
- **始终允许**：一直有效，直到用户撤销。
- **拒绝**：本次运行内不再询问。连续拒绝 3 次后转为「已阻止」，需要用户到插件详情页手动解除。

Tau 不在前台时不会弹窗，请求会记在插件详情页的「权限」中，等用户回来处理。用户也可以随时在那里撤销授权。

权限限制的是这些接口，不是安全隔离：读到的数据插件可以通过网络发送出去，Tau 在授权弹窗中也会如实告诉用户这一点。

## 处理拒绝

没有获得授权时，接口抛出 `PluginPermissionError`，`permission` 是缺少的那项权限，`reason` 说明原因：

| `reason`      | 含义                                   |
| ------------- | -------------------------------------- |
| `undeclared`  | manifest 没有声明这项权限              |
| `denied`      | 用户拒绝了                             |
| `blocked`     | 用户已阻止，需要到插件详情页解除       |
| `unavailable` | 当前无法询问用户，请求已记入插件详情页 |

推荐的做法就是开头的例子：在页面里显示说明和「允许访问」按钮，由用户点击后再申请，而不是在启动时连续申请。

- `context.permissions.query(permission)` 查询当前状态，不会弹窗：`granted` 可以直接调用；`prompt` 调用时会询问用户；`denied` 本次运行已拒绝或已被阻止，再申请也不会弹窗。
- `context.permissions.request([...])` 可以一次申请多项，全部获准时返回 `true`，已获准的不会重复询问；有一项被拒绝、已阻止或无法询问时返回 `false`，不抛错。
- 遇到 `denied` 或 `blocked`，提示用户到插件详情页的「权限」中修改，不要反复申请。

拿到权限后，读写数据的写法见[读写用户数据](user-data.md)。
