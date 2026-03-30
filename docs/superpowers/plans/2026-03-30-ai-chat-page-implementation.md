# AI 助手对话页面实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 创建 AI 助手对话页面，支持自然语言查询和编辑数据库记录

**架构:** 独立页面 (`/ai-agent`) + 可复用抽屉组件 (数据表页面内嵌)

**技术栈:** Next.js 16, React, shadcn/ui (Sheet, Button, Input, ScrollArea), SSE 流式响应

---

## 文件结构

```
src/app/(dashboard)/ai-agent/
├── page.tsx              # 独立 AI 助手页面 (服务端)

src/components/ai-chat/
├── ai-chat-client.tsx   # 对话核心组件 (客户端，"use client")
├── message-list.tsx     # 消息列表组件
├── chat-input.tsx       # 输入框组件
└── confirm-action.tsx   # 确认执行按钮组件

src/app/(dashboard)/data/[tableId]/
├── page.tsx             # 添加 AI 助手按钮入口

src/components/layout/
└── sidebar.tsx          # 添加 AI 助手导航项
```

---

### Task 1: 创建 AI 助手核心组件

**Files:**
- Create: `src/components/ai-chat/ai-chat-client.tsx`
- Create: `src/components/ai-chat/message-list.tsx`
- Create: `src/components/ai-chat/chat-input.tsx`
- Create: `src/components/ai-chat/confirm-action.tsx`

- [ ] **Step 1: 创建 confirm-action.tsx (确认按钮)**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface ConfirmActionProps {
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmAction({ onConfirm, isLoading }: ConfirmActionProps) {
  return (
    <div className="flex justify-center py-4">
      <Button
        onClick={onConfirm}
        disabled={isLoading}
        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
      >
        <CheckCircle2 className="h-4 w-4 mr-2" />
        {isLoading ? "执行中..." : "确认执行"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: 创建 message-list.tsx (消息列表)**

```tsx
"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.role === "user"
                  ? "bg-blue-100 text-blue-900"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 3: 创建 chat-input.tsx (输入框)**

```tsx
"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 p-4 border-t">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入消息..."
        disabled={disabled}
        className="flex-1"
      />
      <Button onClick={handleSend} disabled={disabled || !input.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: 创建 ai-chat-client.tsx (核心组件)**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ConfirmAction } from "./confirm-action";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface PendingConfirm {
  confirmToken: string;
  preview: string;
}

interface AIChatClientProps {
  initialTableId?: string;
}

export function AIChatClient({ initialTableId }: AIChatClientProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "你好！我是 AI 助手，可以通过自然语言查询和编辑数据表。请告诉我你想做什么？",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (content: string) => {
    // 添加用户消息
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          tableId: initialTableId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "请求失败");
      }

      // 读取 SSE 流
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let confirmToken: string | undefined;
      let preview: string | undefined;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text") {
                assistantContent += data.content;
              } else if (data.type === "confirm") {
                confirmToken = data.confirmToken;
                preview = data.content;
              } else if (data.type === "error") {
                throw new Error(data.content);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 添加助手消息
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: assistantContent,
        },
      ]);

      // 如果有确认码，显示确认按钮
      if (confirmToken) {
        setPendingConfirm({ confirmToken, preview: preview || "确认执行此操作" });
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingConfirm) return;

    setIsConfirming(true);
    try {
      const response = await fetch("/api/ai-agent/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmToken: pendingConfirm.confirmToken }),
      });

      const result = await response.json();

      if (result.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: "✅ 操作执行成功！",
          },
        ]);
      } else {
        throw new Error(result.error?.message || "执行失败");
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `❌ 执行失败: ${error instanceof Error ? error.message : "未知错误"}`,
        },
      ]);
    } finally {
      setIsConfirming(false);
      setPendingConfirm(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">AI 助手</h2>
        <p className="text-sm text-muted-foreground">通过自然语言查询和编辑数据</p>
      </div>

      <MessageList messages={messages} />

      {pendingConfirm && (
        <ConfirmAction onConfirm={handleConfirm} isLoading={isConfirming} />
      )}

      <ChatInput onSend={handleSend} disabled={isLoading} />

      <div ref={messagesEndRef} />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ai-chat/
git commit -m "feat(ai-chat): add AI chat components

- Add confirm-action, message-list, chat-input, ai-chat-client components
- Support SSE streaming and confirm flow"
```

---

### Task 2: 创建独立 AI 助手页面

**Files:**
- Create: `src/app/(dashboard)/ai-agent/page.tsx`

- [ ] **Step 1: 创建页面**

```tsx
import { AIChatClient } from "@/components/ai-chat/ai-chat-client";

export default function AIPage() {
  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="h-[calc(100vh-8rem)] border rounded-lg overflow-hidden">
        <AIChatClient />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/ai-agent/
git commit -m "feat(ai-agent): add AI assistant page at /ai-agent"
```

---

### Task 3: 添加侧边栏导航入口

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: 添加导航项**

在 navItems 数组中添加:
```tsx
{
  title: "AI 助手",
  href: "/ai-agent",
  icon: <Bot className="h-4 w-4" />,
},
```

需要导入 Bot 图标:
```tsx
import { Bot } from "lucide-react";
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(sidebar): add AI assistant navigation item"
```

---

### Task 4: 数据表页面添加 AI 助手入口 (抽屉模式)

**Files:**
- Modify: `src/app/(dashboard)/data/[tableId]/page.tsx`

- [ ] **Step 1: 添加抽屉组件和按钮**

在页面顶部添加:
```tsx
"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { AIChatClient } from "@/components/ai-chat/ai-chat-client";

// 在组件内:
const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
```

在页面标题区域添加按钮:
```tsx
<Sheet open={aiDrawerOpen} onOpenChange={setAiDrawerOpen}>
  <SheetTrigger asChild>
    <Button variant="outline" size="sm">
      <Bot className="h-4 w-4 mr-2" />
      AI 助手
    </Button>
  </SheetTrigger>
  <SheetContent side="right" className="w-[400px] sm:w-[540px]">
    <div className="h-full">
      <AIChatClient initialTableId={tableId} />
    </div>
  </SheetContent>
</Sheet>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/data/\[tableId\]/page.tsx
git commit -m "feat(data-table): add AI assistant drawer entry"
```

---

### Task 5: 测试

**Testing:**

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

- [ ] **Step 2: 测试独立页面**

访问 http://localhost:8060/ai-agent，验证:
- 页面加载正常
- 可以发送消息
- AI 返回流式响应

- [ ] **Step 3: 测试抽屉模式**

访问 http://localhost:8060/data/cmn4pes9k0001fhbmioud7pz5，验证:
- 页面有"AI 助手"按钮
- 点击打开右侧抽屉
- 对话功能正常

- [ ] **Step 4: 测试确认执行流程**

1. 发送 "在员工表中创建一条记录，姓名测试，部门研发部"
2. 等待 AI 返回确认码
3. 验证显示"确认执行"按钮
4. 点击确认，验证操作成功

---

### Task 6: 最终提交

```bash
git push
```

---

## 验收标准

- [ ] `/ai-agent` 页面可访问
- [ ] 侧边栏有"AI 助手"入口
- [ ] 数据表页面有"AI 助手"按钮
- [ ] 右侧抽屉模式正常工作
- [ ] 可发送消息并接收 AI 流式响应
- [ ] 编辑操作显示"确认执行"按钮
- [ ] 点击确认按钮可成功执行操作