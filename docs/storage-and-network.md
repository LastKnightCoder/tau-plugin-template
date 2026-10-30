# 存储与网络

保存插件自己的设置和进度、请求网络、和服务器保持长连接。这些接口在桌面和手机上用法相同。

## 私有存储

`context.storage` 是插件自己的键值存储，适合保存设置、进度、缓存等小块数据。

```ts
const saved = await context.storage.get("count");
const count = typeof saved === "number" ? saved : 0;
await context.storage.set("count", count + 1);
```

| 方法              | 说明                           |
| ----------------- | ------------------------------ |
| `get(key)`        | 读取，不存在时返回 `undefined` |
| `set(key, value)` | 保存或覆盖                     |
| `delete(key)`     | 删除                           |

### 数据保存在哪里

- 按插件和工作区隔离：同一个插件在不同工作区读到的是各自的数据，也读不到其他插件的数据。
- 保存在工作区的笔记库里，随云同步。用户换一台设备，也能读到同样的数据。
- 停用、重启、更新插件都不会删除数据。用户卸载插件时可以选择是否一并删除。
- 数据跟随插件 ID。改了 ID，就成了另一个插件，读不到原来的数据。

### 能存什么

值必须是 JSON：`null`、布尔值、字符串、有限数字，以及由它们组成的数组和普通对象。不能存 `undefined`、函数、`Date`、`Map`、`NaN`、`Infinity` 或循环引用；日期先转成字符串或时间戳。

单个值不超过 1 MB。更大的内容（比如一篇长文）放进[插件内容](user-data.md#插件内容)的正文里。需要按字段筛选、排序的成批数据（比如分组、操作记录），用[插件记录](user-data.md#插件记录)。

### 使用要点

- **读取后校验**。`get` 返回的是 `JsonValue`，不带类型保证。数据可能来自旧版本的插件，也可能在其他设备上被修改过，使用前先检查结构，不符合时用默认值或提示错误。
- **改了要保存**。修改 `get` 返回的对象不会自动写回，必须再调用 `set`。
- **读写不是原子的**。"先 `get` 再 `set`"之间如果有另一次写入，后写的会覆盖先写的。保存期间禁用重复提交，模板的计数器按钮就是这样做的。
- **兼顾新旧版本**。用户可以把插件恢复到上一版，但数据不会跟着回退。改变数据结构时，让新版本能读懂旧数据，也尽量让旧版本读到新数据时不出错（例如只新增字段，不改已有字段的含义）。
- **不要存凭据**。账号、Token 这类配置会随笔记库同步，不应放在这里。服务提供方的账号配置使用专门的配置保存接口，见[服务提供方](providers/README.md)。

## 网络请求

用 `context.fetch` 发起网络请求。它的参数和返回值与标准的 `fetch` 相同：

```ts
const response = await context.fetch("https://api.example.com/status", {
  headers: { Authorization: `Bearer ${token}` },
});
if (!response.ok) throw new Error(`请求失败：${response.status}`);
const data: unknown = await response.json();
```

- 请求由 Tau 代为发出，不受浏览器跨域（CORS）限制，也不会携带浏览器的 Cookie。需要认证时，自己在请求头里提供。
- 插件停用时，进行中的请求会被自动取消。你也可以照常传入自己的 `signal`，两者任一中止都会取消请求，包括读取响应体的阶段。
- 支持流式读取请求和响应。应用切到后台或被系统结束后，请求不会继续。

- 和标准 `fetch` 一样，HTTP 4xx、5xx 不会抛出异常，要检查 `response.ok`。
- 响应数据先校验再使用，尤其是写入存储之前。
- 不要把私人的 API Key 写进源码。需要用户自己的凭据时，让用户在设置中填写。
- 能读到的用户数据都可以通过网络发送出去。只在功能确实需要时这样做，并在 README 里向用户说明。

## WebSocket

需要与服务器保持双向连接时（如实时语音识别、推送），用 `context.websocket.connect`。它返回一个和浏览器 `WebSocket` 用法相同的连接，事件、状态、`send`、`close` 都按标准工作：

```ts
const socket = context.websocket.connect("wss://api.example.com/stream", [], {
  headers: { Authorization: `Bearer ${token}` },
  signal,
});
socket.binaryType = "arraybuffer";
socket.addEventListener("open", () =>
  socket.send(JSON.stringify({ type: "start" })),
);
socket.addEventListener("message", (event) => handle(event.data));
socket.addEventListener("error", () => fail(new Error("连接失败")));
socket.addEventListener("close", (event) => finish(event.code, event.reason));
```

| 参数        | 说明                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------- |
| `url`       | `wss://` 地址；`ws://` 只允许连本机。地址里不能带用户名密码和 `#` 片段                      |
| `protocols` | 子协议，与标准构造函数的第二个参数相同                                                      |
| `headers`   | 可选。握手请求头，常用于鉴权。不能设置 `Host`、`Connection`、`Upgrade` 和 `Sec-WebSocket-*` |
| `signal`    | 可选。中止时关闭这条连接                                                                    |

- 连接由 Tau 代为建立，不携带浏览器 Cookie，不自动重连，不跟随重定向。不要用 `instanceof WebSocket` 判断它。
- `send` 和 `close` 都是同步的，发送顺序和排队由 Tau 处理，不需要自己做流量控制。`bufferedAmount` 只表示还没发出去的字节，不代表服务器已经收到。
- 插件停用或切换工作区时，所有连接自动关闭。这时未发完的数据会被丢弃，不保证送达；正常结束时，先按服务的协议发送结束消息、等到最终结果，再调用 `close()`。
- 连接失败、断线或超出限制时，先触发 `error`，再触发一次 `close`（关闭码 1006）。宿主桥的 `error` 事件携带 `message`，可包含握手 HTTP 状态码、TLS 失败、网络连接失败或超时；没有诊断时返回通用连接失败。只传递固定错误类别，不包含原始错误、请求头或响应正文。

限制：单条消息最多 1 MiB；发送和接收各自最多排队 2 MiB、256 条；每个窗口最多同时 32 条连接；握手和关闭各最多等 10 秒。超出时连接失败，不会悄悄丢消息。
