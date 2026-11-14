# 桌面插件窗口

窗口 API 仅在 Tau 桌面端可用。依赖独立窗口的插件，在平台声明里只声明桌面端即可，见[多端适配](portability.md)。

## 声明与打开窗口

在 `definePlugin({ windows })` 中声明每个窗口的 ID、标题、选项和渲染用的 React 组件。下面的插件注册了一条桌面命令，用户可以从命令面板打开预览窗口：

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

- `open(id, params?)` 要在用户点击或按键时调用。参数值只支持字符串、有限数字和布尔值。重复打开同一个 ID 不会新建窗口，而是聚焦已有窗口并整体替换参数，组件保持挂载。
- 窗口有三种形态：`kind: "normal"` 是可调整尺寸的普通窗口；`kind: "compact"` 是尺寸固定的小窗，可以声明 `alwaysOnTop: true` 置顶；`kind: "fullscreen"` 是全屏窗口，显示器适配与退出操作由宿主处理。
- `open()` 返回本次窗口的句柄，用它关闭这个窗口；组件内部则用 `props.close()` 关闭自己。窗口关闭后再打开会挂载新的组件。`props.signal` 会随窗口结束而中止，用它取消随窗口进行的工作。
- 窗口组件运行在独立的渲染环境中，插件的 `activate()` 只在主窗口执行。需要在两端共享的值，通过下面介绍的通信接口传递。

## 外观自动跟随 Tau

组件挂载前，宿主会先把 Tau 的主题、明暗和用户设置的字体、字号应用到窗口；这些设置变化时，已打开的窗口也会同步更新。界面用 `@tau/ui` 或语义 token 编写即可继承外观，CSS 的编译方式见[界面组件与样式](ui-components.md)。

```css
.yourname-preview {
  background: var(--tau-bg-page);
  color: var(--tau-ink-1);
  font: var(--tau-text-body) var(--tau-font);
}
```

全屏等场景可以在窗口选项里声明 `theme: "dark"`，把窗口固定为深色；主题族和字体仍跟随用户的选择。

画布等自绘组件可以用只读快照获取外观：`system.get("system.appearance")` 读初值，`system.subscribe("system.appearance", redraw)` 监听变化。快照中 `themeId` 是当前主题，`appearance` 是用户的全局明暗偏好，`mode` 是本窗口实际生效的明暗，`font` 提供 `chineseFont`、`englishFont`、`codeFont` 和 `fontSize`。

## 同步状态与发送消息

主窗口代码从 `context.windows.communication` 取通信接口，独立窗口组件从 `props.communication` 取，两边访问的是同一插件在当前工作区的通道。键、消息名和 JSON 值的格式由插件自己定义，`system.` 前缀保留给 Tau。

| 接口                                         | 用法                                                                                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state.get(key)` / `state.set(key, value)`   | 读取或整体替换键的值。未设置过的键读到 `undefined`。                                                                                                                        |
| `await state.subscribe(key, listener)`       | 订阅时先回调一次当前值，之后每次变化再回调。返回的订阅调用 `dispose()` 即可取消。                                                                                           |
| `messages.on(name, listener)`                | 监听即时消息，回调收到 JSON 载荷和发送方的窗口类型。                                                                                                                        |
| `await messages.send(name, payload, target)` | 发送即时消息。`"main"` 发给其他在线的主窗口端点，`"all"` 发给同插件的其他在线端点，`{ windowId: "preview" }` 发给指定窗口。返回已受理投递的端点数，没有在线目标时返回 `0`。 |

例如主窗口用 `state.set("selection", { id: "draft" })` 保存当前选中项，预览窗稍后才打开也不要紧——订阅 `selection` 时会先收到这份值。反过来，预览窗在用户完成操作后可以调用 `messages.send("refresh", null, "main")`，让在线的主窗口刷新。状态只在当前插件会话内保留；消息即时投递、不回放。要在重启后保留的数据，用[插件私有存储](storage-and-network.md)。

组件卸载时记得调用 `dispose()` 取消订阅。插件停用、切换工作区或窗口关闭时，宿主会统一清理相关端点。注意 `send()` 的返回值只代表宿主已受理投递，接收窗口是否处理完成，要由插件自己确认。
