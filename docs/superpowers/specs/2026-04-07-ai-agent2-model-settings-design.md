# ai-agent2 页面模型设置功能优化设计

**日期:** 2026-04-07
**Issue:** #6

## 需求概述

在 ai-agent2 页面进行模型设置时，增加以下功能：
1. 自定义模型配置修改
2. 模型连通性测试
3. 聊天对话框显示模型名称

## 设计方案

### 1. 自定义模型配置修改

在模型管理器中增加编辑功能：

- 每行自定义模型卡片增加"编辑"图标按钮（使用 Pencil 图标）
- 点击编辑按钮弹出对话框，对话框布局与添加对话框相同
- 对话框标题改为"编辑自定义模型"
- 支持修改：模型名称、模型 ID、Base URL、API Key
- API 端点：PUT `/api/agent2/models/[id]`

### 2. 模型连通性测试

在两处位置提供测试连接功能：

**位置A: 编辑模型对话框**
- 对话框底部"测试连接"按钮（位于"取消"和"保存"之间）
- 点击后发送测试请求到 `/api/agent2/models/test`
- 显示 loading 状态（按钮显示 spinner）
- 测试成功：按钮区域显示绿色勾选图标 + "连接成功"
- 测试失败：按钮区域显示红色叉图标 + 错误信息

**位置B: 模型列表中**
- 每行模型卡片增加"测试连接"图标按钮（使用 Wifi 或 ConnectionTest 图标）
- 点击后显示短暂的 loading 状态
- 成功：显示绿色 toast 提示"连接成功"
- 失败：显示红色 toast 提示错误信息

**测试连接 API:**
- 端点: `POST /api/agent2/models/test`
- 请求体: `{ baseUrl: string, apiKey?: string, modelId: string }`
- 响应: `{ success: boolean, message: string }`

### 3. 聊天对话框显示模型名称

修复当前显示模型 ID 的问题：

- 当前代码: `setModel(data.data.defaultModel)` 设置的是模型 ID
- 修改为: 获取 defaultModel 后，根据 ID 查询模型名称
- 在模型管理器中同时获取模型列表，根据 ID 查找对应的模型名称
- 聊天框标题旁显示：模型名称（而非 ID）
- 如果是 env 模型，显示环境变量中的模型名称

### 数据结构

```typescript
interface Model {
  id: string
  name: string
  providerId: string
  modelId: string
  baseUrl: string
  isGlobal: boolean
  // 新增: API Key 仅在用户模型中存在
  apiKey?: string
}
```

### API 变更

1. **编辑模型** - `PUT /api/agent2/models/[id]`
   - 请求体: `{ name: string, modelId: string, baseUrl: string, apiKey?: string }`
   - 响应: `{ success: boolean, data?: Model, error?: { code, message } }`

2. **测试连接** - `POST /api/agent2/models/test`
   - 请求体: `{ baseUrl: string, apiKey?: string, modelId: string }`
   - 响应: `{ success: boolean, message: string }`