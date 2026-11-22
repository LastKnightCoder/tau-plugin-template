# 设置与命令

插件有用户可调的偏好（步长、默认书单、账号）时，注册一块设置：它显示在插件详情页的「设置」里，桌面和手机都有。需要一个随手执行的操作（重置计数、立即同步）时，注册一条命令，用户在桌面的 Ctrl+K 命令面板里搜到它。下面的计数插件有一个「步长」设置和一条重置命令：

```tsx
// src/index.tsx
import { useEffect, useState } from "react";
import { definePlugin, type PluginSettingsProps } from "@tau/plugins";
import { NumberInput } from "@tau/ui";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

function Preferences({ context }: PluginSettingsProps) {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    void context.storage.get("step").then((value) => {
      setStep(typeof value === "number" ? value : 1);
    });
  }, [context]);

  if (step === null) return <p>正在读取…</p>;
  return (
    <label>
      每次增加
      <NumberInput
        value={step}
        min={1}
        onValueChange={(value) => {
          const next = value ?? 1;
          setStep(next);
          void context.storage.set("step", next);
        }}
      />
    </label>
  );
}

export default definePlugin({
  ...__PLUGIN_META__,
  create: () => ({
    activate(context) {
      const preferences = context.settings.register({
        id: "preferences",
        title: "计数设置",
        description: "调整计数的步长",
        component: Preferences,
      });
      context.commands.register({
        id: "reset-count",
        title: "重置计数",
        run: async () => {
          await context.storage.set("count", 0);
          return null;
        },
      });
      context.commands.register({
        id: "open-preferences",
        title: "打开计数设置",
        run: async () => {
          await preferences.open();
          return null;
        },
      });
    },
  }),
});
```

## 设置

`context.settings.register` 声明一块设置：

| 字段          | 说明                                                            |
| ------------- | --------------------------------------------------------------- |
| `id`          | 局部 ID                                                         |
| `title`       | 设置区域的标题                                                  |
| `description` | 可选。说明文字                                                  |
| `component`   | React 组件，收到 `context`                                      |
| `target`      | 服务提供方的配置表单才需要，见[服务提供方](providers/README.md) |

- Tau 把组件放进一张带标题的设置卡片，组件直接写内容即可，不要再套 `Panel` 或自己画卡片边框。
- `register` 返回的句柄提供 `open()`，可以像上面的「打开计数设置」命令一样，从命令或页面里跳转过去。
- 设置值不会自动保存，组件需要自己用 [`context.storage`](storage-and-network.md#私有存储) 读写。
- 页面和设置同时显示同一份数据时，保存后要刷新另一处的状态，`storage` 本身不会通知变化。模板的 `src/index.tsx` 用 React Query 管理读取、保存和失败状态，可以照着写。

### 保存与离开确认

开关、单选、上面的步长这类改了就该生效的偏好，直接在 `onChange` 里保存。需要校验、几项要一起提交、或保存有副作用（比如删除书单会移动其中的书）时，先在草稿里编辑，用 `useSettingsDraft` 告诉 Tau 草稿的状态，不要自己画保存按钮：

```tsx
import { useState } from "react";
import { useSettingsDraft, type PluginSettingsProps } from "@tau/plugins";
import { Button, NumberInput } from "@tau/ui";

type Profile = { height: number };

function ProfileSettings({ context, saved }: PluginSettingsProps & { saved: Profile }) {
  const [committed, setCommitted] = useState(saved);
  const [draft, setDraft] = useState(saved);
  const invalid = draft.height < 50 || draft.height > 250;

  const settings = useSettingsDraft({
    dirty: draft.height !== committed.height,
    errors: invalid ? 1 : 0,
    changes: [{ label: "身高", from: `${committed.height} cm`, to: `${draft.height} cm` }],
    save: async () => {
      await context.storage.set("profile", draft);
      setCommitted(draft);
    },
    reset: () => setDraft(committed),
  });

  return (
    <>
      <NumberInput
        aria-invalid={invalid}
        value={draft.height}
        onValueChange={(height) => setDraft({ height: height ?? 0 })}
      />
      {/* 不在设置页里（如放进插件页面）时没有保存条，自己给保存按钮 */}
      {!settings && (
        <Button onClick={() => void context.storage.set("profile", draft).then(() => setCommitted(draft))}>
          保存
        </Button>
      )}
    </>
  );
}
```

`saved` 是读取到的已保存值，由外层组件读完 `context.storage` 后传进来。有改动时，设置页底部会出现保存条，⌘S（Windows 上 Ctrl+S）也能保存。用户切换页面、标签、设置分组或关闭窗口前，Tau 会列出 `changes` 并询问「保存并离开 / 继续编辑 / 放弃修改」。

| 字段         | 说明                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- |
| `dirty`      | 草稿与已保存的值不同                                                                     |
| `errors`     | 可选。填写有误的项数，大于 0 时不能保存。把出错的输入框设为 `aria-invalid`，Tau 会滚过去 |
| `changes`    | 可选。修改清单，`from`、`to` 省略时只显示名称（适合密钥）                                |
| `save`       | 写入草稿。返回的文字显示在「已保存」位置；抛错时保存条显示错误信息，草稿保留             |
| `reset`      | 回到已保存的值                                                                           |
| `onInvalid`  | 可选。有错误时用户仍点了保存，可以在这里把所有错误标出来                                 |
| `saveLabel`  | 可选。保存按钮文字，默认「保存」                                                         |
| `savingText` | 可选。保存中的文字，默认「正在保存…」                                                    |

`useSettingsDraft` 返回 `{ saving, save }`：

- `saving` 为 `true` 时正在保存。
- `save()` 和点保存条的效果相同，返回 `Promise<boolean>`：保存成功为 `true`；还有填写错误（此时会调用 `onInvalid`）或你的 `save` 抛错时为 `false`，错误信息照常显示在保存条上。需要「先保存再测试连接」这类连续操作时，用它的返回值决定要不要继续。
- 同一个组件放在插件页面里用时，页面没有保存条，它返回 `null`，这时像示例一样自己显示保存按钮。

离开确认只覆盖应用内的离开和关闭窗口，应用被系统结束时不会询问。

## 命令

要把插件页面作为一条右栏命令，在 `run` 中调用 `await page.open({}, { placement: "dock" })` 并返回 `null`。注册和调用的完整示例见[在右栏打开页面和网页](pages.md#在右栏打开页面和网页)。


命令是一个有名字的操作，开头例子里的「重置计数」就是一条命令：

| 字段    | 说明                                                                |
| ------- | ------------------------------------------------------------------- |
| `id`    | 局部 ID，见 [ID 规则](plugin-basics.md#id-规则)                     |
| `title` | 命令标题，用户在命令面板里按它搜索                                  |
| `run`   | 执行函数，可以是异步的。返回值必须是 JSON 值，没有结果时返回 `null` |

- 注册时不会执行命令，用户选中它时才调用 `run`。
- `run` 的参数 `input` 不保证有内容，命令面板执行时不会传自定义参数。需要用户输入时，打开一个页面或设置让用户填写。
- `run` 抛出异常表示执行失败。耗时较长的命令应该在界面上给出进度，或完成后发一条[通知](notifications-and-voice.md#通知)。
- 手机上没有命令面板，命令可以注册但用户找不到，主要功能要另外注册[功能入口](pages.md#功能入口)。

设置和命令都需要一个页面来承载主要功能时，见[页面与入口](pages.md)；想在任务完成后提醒用户，见[通知、语音输入与朗读](notifications-and-voice.md)。
