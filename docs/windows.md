# 桌面插件窗口

窗口 API 仅在 Tau 桌面端可用。依赖独立窗口的插件只声明桌面目标，平台声明见[多端适配](portability.md)。

## 声明与打开窗口

在 `definePlugin({ windows })` 里声明 React 组件、窗口 ID、标题和选项。下面的插件注册一条桌面命令，用户可以从命令面板打开预览窗口。

```tsx
import { definePlugin, type PluginWindowProps } from "@tau/plugins";
import { Button } from "@tau/ui";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

function Preview({ params, close }: PluginWindowProps) {
  return (
    <section className="yourname-preview">
      <h2>{String(params.title ?? "预览")}</h2>
      <Button onClick={() => void close()}>关闭</Button>
    </section>
  );
}

export default definePlugin({
  ...__PLUGIN_META__,
  windows: [
    {
      id: "preview",
      title: "预览",
      options: { kind: "normal", width: 720, height: 480 },
      component: Preview,
    },
  ],
  create: () => ({
    activate(context) {
      context.commands.register({
        id: "open-preview",
        title: "打开预览",
        async run() {
          await context.windows?.open("preview", { title: "本次预览" });
          return null;
        },
      });
    },
  }),
});
```

- 在用户点击或按键时调用 `open(id, params?)`。参数接受字符串、有限数字和布尔值。重复打开同一 ID 会聚焦窗口并整体替换参数，组件保持挂载。
- 普通窗用 `kind: "normal"`，可调整尺寸。小窗用 `kind: "compact"`，尺寸固定，可声明 `alwaysOnTop: true`。全屏用 `kind: "fullscreen"`，宿主处理显示器与退出操作。
- `open()` 返回可关闭这次物理窗口的句柄。组件内用 `props.close()` 关闭自己。关窗重开会挂载新组件。用 `props.signal` 取消随窗口结束的工作。
- 窗口组件在独立渲染环境中运行，应用级 `activate()` 在主窗口执行。需要在两端共享的值通过下文接口传递。

## 外观自动跟随 Tau

宿主在组件挂载前应用主题、明暗、用户字体与字号，并在设置变化时更新已打开的窗口。用 `@tau/ui` 或现有语义 token 就能继承外观，按[界面组件与样式](ui-components.md)编译插件自己的 CSS。

```css
.yourname-preview {
  background: var(--tau-bg-page);
  color: var(--tau-ink-1);
  font: var(--tau-text-body) var(--tau-font);
}
```

全屏等场景可以在窗口选项里声明 `theme: "dark"`。窗口仍跟随用户选择的主题族和字体。

画布等自绘组件可用只读的 `system.get("system.appearance")` 读初值，再用 `system.subscribe("system.appearance", redraw)` 监听变化。快照包含 `themeId`、全局明暗偏好 `appearance`、本窗口生效的 `mode`，以及 `font` 里的 `chineseFont`、`englishFont`、`codeFont` 和 `fontSize`。

## 同步状态与发送消息

主窗口通过 `context.windows.communication`，独立窗口通过 `props.communication` 访问同一插件和工作区的通信。插件定义自己的键、消息名和 JSON 值，`system.` 前缀由 Tau 保留。

| 接口                                         | 用法                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state.get(key)` / `state.set(key, value)`   | 读取或整体替换当前值。未设置时读到 `undefined`。                                                                                                        |
| `await state.subscribe(key, listener)`       | 先收到当前值，再接收变化。返回可调用 `dispose()` 的订阅。                                                                                               |
| `messages.on(name, listener)`                | 监听即时消息。回调收到 JSON 载荷和发送窗口类型。                                                                                                        |
| `await messages.send(name, payload, target)` | `"main"` 发给其他在线主窗口端点，`"all"` 发给同插件的其他在线端点，`{ windowId: "preview" }` 发给指定窗口。返回实际提交投递的端点数，无目标时返回 `0`。 |

例如主窗口用 `state.set("selection", { id: "draft" })` 保存选中项。预览窗稍后打开，订阅 `selection` 时会拿到这份当前值。预览窗也可在用户操作完成时调用 `messages.send("refresh", null, "main")`，让在线主窗口刷新。状态在当前插件会话内保留，消息发送后不会回放。跨重启数据用[插件私有存储](storage-and-network.md)。

组件移除监听时调用 `dispose()`。插件停用、切库或窗口关闭时，宿主会清理相关端点。消息发送结果表示宿主提交了投递，接收窗口的业务处理有无完成由插件自行判断。
