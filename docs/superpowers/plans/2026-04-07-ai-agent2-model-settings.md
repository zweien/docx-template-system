# ai-agent2 页面模型设置功能优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现模型编辑、测试连接功能，并修复聊天对话框模型名称显示问题

**Architecture:** 后端新增编辑模型和测试连接 API，前端修改 model-manager 组件增加编辑/测试按钮，修复 chat-area 组件显示模型名称

**Tech Stack:** Next.js Route Handlers, Prisma, React, shadcn/ui

---

## 文件结构

- 修改: `src/lib/services/agent2-model.service.ts` - 新增 updateModel 和 testModelConnection 函数
- 修改: `src/app/api/agent2/models/[id]/route.ts` - 新增 PUT 方法处理模型更新
- 新增: `src/app/api/agent2/models/test/route.ts` - 测试连接 API
- 修改: `src/validators/agent2.ts` - 更新 updateModelSchema 添加 modelId 必填
- 修改: `src/components/agent2/model-manager.tsx` - 增加编辑/测试连接按钮
- 修改: `src/components/agent2/chat-area.tsx` - 显示模型名称而非 ID

---

### Task 1: 后端 - 更新验证器

**Files:**
- Modify: `src/validators/agent2.ts:37-42`

- [ ] **Step 1: 更新 updateModelSchema**

将 modelId 从可选改为必填，因为编辑时需要提供完整的模型信息：

```typescript
export const updateModelSchema = z.object({
  name: z.string().min(1).max(100),
  modelId: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
});
```

- [ ] **Step 2: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/validators/agent2.ts
git commit -m "feat(agent2): update model validation schema"
```

---

### Task 2: 后端 - Service 层添加 updateModel 和 testModelConnection

**Files:**
- Modify: `src/lib/services/agent2-model.service.ts:160-183`

- [ ] **Step 1: 添加 updateModel 函数**

在 `deleteModel` 函数后添加：

```typescript
export async function updateModel(
  id: string,
  userId: string,
  data: {
    name: string;
    modelId: string;
    baseUrl: string;
    apiKey?: string;
  }
): Promise<ServiceResult<Agent2ModelItem>> {
  const existing = await db.agent2ModelConfig.findFirst({
    where: { id, userId, isGlobal: false },
  });

  if (!existing) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "模型配置不存在" },
    };
  }

  const updateData: Record<string, unknown> = {
    name: data.name,
    modelId: data.modelId,
    baseUrl: data.baseUrl,
  };
  if (data.apiKey !== undefined) {
    updateData.apiKeyEncrypted = data.apiKey ? encrypt(data.apiKey) : null;
  }

  const updated = await db.agent2ModelConfig.update({
    where: { id },
    data: updateData,
  });

  return {
    success: true,
    data: mapModelItem(updated),
  };
}
```

- [ ] **Step 2: 添加 testModelConnection 函数**

在 `updateModel` 函数后添加：

```typescript
export async function testModelConnection(data: {
  baseUrl: string;
  apiKey?: string;
  modelId: string;
}): Promise<ServiceResult<{ success: boolean; message: string }>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (data.apiKey) {
      headers["Authorization"] = `Bearer ${data.apiKey}`;
    }

    const response = await fetch(`${data.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: data.modelId,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: { code: "CONNECTION_FAILED", message: `连接失败: ${response.status} ${errorText}` },
      };
    }

    return {
      success: true,
      data: { success: true, message: "连接成功" },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "CONNECTION_FAILED",
        message: error instanceof Error ? error.message : "连接失败",
      },
    };
  }
}
```

- [ ] **Step 3: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/agent2-model.service.ts
git commit -m "feat(agent2): add updateModel and testModelConnection functions"
```

---

### Task 3: 后端 - 编辑模型 API

**Files:**
- Modify: `src/app/api/agent2/models/[id]/route.ts`

首先查看现有代码结构，然后添加 PUT 方法：

- [ ] **Step 1: 查看现有 [id]/route.ts**

```bash
cat src/app/api/agent2/models/\[id\]/route.ts
```

- [ ] **Step 2: 添加 PUT 方法**

在文件末尾添加：

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateModelSchema.parse(body);
    const result = await updateModel(id, session.user.id, {
      name: parsed.name,
      modelId: parsed.modelId,
      baseUrl: parsed.baseUrl,
      apiKey: parsed.apiKey,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "参数校验失败" } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "更新模型配置失败",
        },
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: 添加 import**

在文件顶部添加：

```typescript
import { updateModel } from "@/lib/services/agent2-model.service";
import { updateModelSchema } from "@/validators/agent2";
```

- [ ] **Step 4: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/app/api/agent2/models/\[id\]/route.ts
git commit -m "feat(agent2): add PUT endpoint for model update"
```

---

### Task 4: 后端 - 测试连接 API

**Files:**
- Create: `src/app/api/agent2/models/test/route.ts`

- [ ] **Step 1: 创建测试连接 API**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ZodError } from "zod";
import { testModelConnection } from "@/lib/services/agent2-model.service";
import { z } from "zod";

const testConnectionSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  modelId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = testConnectionSchema.parse(body);
    const result = await testModelConnection({
      baseUrl: parsed.baseUrl,
      apiKey: parsed.apiKey,
      modelId: parsed.modelId,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "连接成功" });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: "参数校验失败" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "测试连接失败",
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/app/api/agent2/models/test/route.ts
git commit -m "feat(agent2): add test connection API endpoint"
```

---

### Task 5: 前端 - ModelManager 增加编辑和测试连接按钮

**Files:**
- Modify: `src/components/agent2/model-manager.tsx`

- [ ] **Step 1: 查看现有 ModelManager 代码**

```typescript
// 现有代码结构：
// - models state
// - addOpen state
// - form state
// - handleAdd / handleDelete 函数
// - 渲染：默认模型选择器、env模型、全局模型、用户模型列表
// - 添加对话框
```

- [ ] **Step 2: 添加编辑状态和函数**

在现有 state 后添加：

```typescript
const [editOpen, setEditOpen] = useState(false)
const [editingModel, setEditingModel] = useState<Model | null>(null)
const [editForm, setEditForm] = useState({ name: "", providerId: "custom", modelId: "", baseUrl: "", apiKey: "" })
const [testingId, setTestingId] = useState<string | null>(null)
const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null)
```

添加编辑和测试函数：

```typescript
const handleEdit = (model: Model) => {
  setEditingModel(model)
  setEditForm({
    name: model.name,
    providerId: model.providerId,
    modelId: model.modelId,
    baseUrl: model.baseUrl,
    apiKey: "",
  })
  setEditOpen(true)
}

const handleEditSubmit = async () => {
  if (!editingModel) return
  const res = await fetch(`/api/agent2/models/${editingModel.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(editForm),
  })
  const data = await res.json()
  if (data.success) {
    setEditOpen(false)
    setEditingModel(null)
    setEditForm({ name: "", providerId: "custom", modelId: "", baseUrl: "", apiKey: "" })
    loadModels().then(setModels)
  }
}

const handleTestConnection = async (model: Model) => {
  setTestingId(model.id)
  setTestResult(null)
  try {
    const res = await fetch("/api/agent2/models/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: model.baseUrl,
        modelId: model.modelId,
      }),
    })
    const data = await res.json()
    setTestResult({ id: model.id, success: data.success, message: data.message || data.error?.message })
  } catch (error) {
    setTestResult({ id: model.id, success: false, message: error instanceof Error ? error.message : "测试失败" })
  } finally {
    setTestingId(null)
    setTimeout(() => setTestResult(null), 3000)
  }
}
```

- [ ] **Step 3: 修改用户模型列表渲染**

在用户模型卡片中添加编辑和测试按钮：

```typescript
// 现有代码：
{userModels.map(m => (
  <div key={m.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
    <div>
      <p className="font-medium">{m.name}</p>
      <p className="text-xs text-muted-foreground">{m.baseUrl}</p>
    </div>
    <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(m.id)}>
      <Trash2 className="size-3 text-destructive" />
    </Button>
  </div>
))}

// 修改为：
{userModels.map(m => (
  <div key={m.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
    <div>
      <p className="font-medium">{m.name}</p>
      <p className="text-xs text-muted-foreground">{m.baseUrl}</p>
    </div>
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => handleTestConnection(m)}
        disabled={testingId === m.id}
        title="测试连接"
      >
        {testingId === m.id ? (
          <span className="size-3 animate-spin">⟳</span>
        ) : testResult?.id === m.id ? (
          testResult.success ? (
            <CheckCircle className="size-3 text-green-500" />
          ) : (
            <XCircle className="size-3 text-destructive" />
          )
        ) : (
          <Wifi className="size-3" />
        )}
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(m)}>
        <Pencil className="size-3" />
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(m.id)}>
        <Trash2 className="size-3 text-destructive" />
      </Button>
    </div>
  </div>
))}
```

- [ ] **Step 4: 添加编辑对话框**

在添加对话框后添加编辑对话框：

```typescript
<Dialog open={editOpen} onOpenChange={setEditOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>编辑自定义模型</DialogTitle>
    </DialogHeader>
    <div className="space-y-3">
      <Input placeholder="模型名称" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
      <Input placeholder="模型 ID (如 gpt-4o)" value={editForm.modelId} onChange={e => setEditForm(f => ({ ...f, modelId: e.target.value }))} />
      <Input placeholder="Base URL (如 https://api.openai.com/v1)" value={editForm.baseUrl} onChange={e => setEditForm(f => ({ ...f, baseUrl: e.target.value }))} />
      <Input type="password" placeholder="API Key (留空则不修改)" value={editForm.apiKey} onChange={e => setEditForm(f => ({ ...f, apiKey: e.target.value }))} />
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
      <Button variant="outline" onClick={async () => {
        if (!editingModel) return
        setTestingId(editingModel.id)
        try {
          const res = await fetch("/api/agent2/models/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              baseUrl: editForm.baseUrl,
              modelId: editForm.modelId,
              apiKey: editForm.apiKey || undefined,
            }),
          })
          const data = await res.json()
          setTestResult({ id: editingModel.id, success: data.success, message: data.message || "测试失败" })
        } catch (error) {
          setTestResult({ id: editingModel.id, success: false, message: error instanceof Error ? error.message : "测试失败" })
        } finally {
          setTestingId(null)
        }
      }} disabled={testingId !== null}>
        {testingId === editingModel?.id ? "测试中..." : "测试连接"}
      </Button>
      <Button onClick={handleEditSubmit} disabled={!editForm.name || !editForm.modelId || !editForm.baseUrl}>保存</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 5: 添加缺失的 import**

添加需要的图标组件：

```typescript
import { Trash2, Plus, Pencil, Wifi, CheckCircle, XCircle } from "lucide-react"
```

- [ ] **Step 6: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 7: Commit**

```bash
git add src/components/agent2/model-manager.tsx
git commit -m "feat(agent2): add edit and test connection buttons to model manager"
```

---

### Task 6: 前端 - 修复聊天对话框显示模型名称

**Files:**
- Modify: `src/components/agent2/chat-area.tsx`

- [ ] **Step 1: 添加获取模型名称的函数**

在 ChatArea 组件中添加 state 和 effect：

```typescript
const [modelName, setModelName] = useState("MiniMax-M2.5")
const [model, setModel] = useState("MiniMax-M2.5")
```

修改 useEffect 获取设置和模型列表：

```typescript
useEffect(() => {
  fetch("/api/agent2/settings")
    .then((res) => res.json())
    .then((data) => {
      if (data.success && data.data.defaultModel) {
        setModel(data.data.defaultModel)
        // 获取模型名称
        return fetch("/api/agent2/models")
      }
      return null
    })
    .then((res) => {
      if (!res) return res.json()
      return res.json()
    })
    .then((data) => {
      if (data?.success && data?.data) {
        const models = data.data
        const currentModel = models.find((m: { id: string }) => m.id === model)
        if (currentModel) {
          setModelName(currentModel.name)
        }
      }
    })
    .catch(() => {
      // Use fallback model
    })
}, [model])
```

- [ ] **Step 2: 修改显示**

在 header 中显示 modelName：

```typescript
// 原来：
<span className="text-xs text-muted-foreground">{model}</span>

// 修改为：
<span className="text-xs text-muted-foreground">{modelName}</span>
```

- [ ] **Step 3: 运行类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/components/agent2/chat-area.tsx
git commit -m "fix(agent2): display model name instead of id in chat header"
```

---

### Task 7: 验证和测试

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 测试添加模型**

访问 ai-agent2 页面，添加新模型

- [ ] **Step 3: 测试编辑模型**

点击编辑按钮，修改模型信息并保存

- [ ] **Step 4: 测试连接**

点击测试连接按钮，验证连接功能

- [ ] **Step 5: 验证聊天框显示**

在聊天框标题旁确认显示模型名称

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: verify model settings feature"
```