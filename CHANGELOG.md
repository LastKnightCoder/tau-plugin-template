# Changelog

## 更新到 SDK 0.30.0 (2024-10-21)

### 依赖更新
- 升级 `@tau/plugins` 到 0.30.0
- 升级 `@tau/ui` 到 0.2.0

### 新功能
- `@tau/ui` 现在导出 `SettingRow` 和 `ROW_DIVIDER`
- 插件设置表单可以使用 `SettingRow` 保持与桌面端一致的布局

### 使用示例

如果你的插件需要提供设置表单（同步/上传/TTS等），可以使用 `SettingRow`：

```tsx
import { SettingRow, Input, Button } from '@tau/ui';

function MySettings({ syncConfig }) {
  return (
    <>
      <SettingRow title="字段标题" description="可选的说明文字">
        <Input 
          className="w-[260px]"
          aria-label="字段标题"
          value={config.field} 
          onChange={...} 
        />
      </SettingRow>
      
      <SettingRow title="">
        <Button onClick={handleSave}>保存配置</Button>
      </SettingRow>
    </>
  );
}
```

### 向后兼容
- 旧的写法仍然可以工作
- 建议迁移到 `SettingRow` 以获得更好的视觉一致性

## SDK 0.29.0

### 新功能
- 页面组件支持 `pageContext.register(provider)`
- 通知能力开放

详见 SDK 文档中的 NOTIFICATIONS.md
