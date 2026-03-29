# AI Agent 数据查询能力实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为系统添加通过 LLM 调用数据库的能力，支持自然语言查询、筛选、统计

**Architecture:** 使用 Vercel AI SDK 工具函数模式，预定义安全工具（search/aggregate/getSchema），通过流式响应返回结果

**Tech Stack:** Vercel AI SDK (`ai`), Zod, 现有 Prisma + PostgreSQL

---

## 文件结构

```
src/lib/ai-agent/
├── types.ts           # 类型定义
├── tools.ts           # 工具函数
├── context-builder.ts # 上下文构建
├── query-validator.ts # 查询验证
└── service.ts         # LLM 服务

src/app/api/ai-agent/
├── chat/route.ts      # 聊天接口
├── aggregate/route.ts # 统计接口
└── confirm/route.ts   # 确认接口

src/validators/
└── ai-agent.ts        # 请求验证
```

---

## Task 1: 创建类型定义

- [ ] **Step 1: 创建 src/lib/ai-agent/types.ts**
- [ ] **Step 2: Commit**

---

## Task 2: 实现工具函数层

- [ ] **Step 1: 创建 src/lib/ai-agent/tools.test.ts**
- [ ] **Step 2: 运行测试验证失败**
- [ ] **Step 3: 实现 src/lib/ai-agent/tools.ts**
- [ ] **Step 4: 运行测试验证通过**
- [ ] **Step 5: Commit**

---

## Task 3: 实现 Context Builder

- [ ] **Step 1: 创建 src/lib/ai-agent/context-builder.test.ts**
- [ ] **Step 2: 运行测试验证失败**
- [ ] **Step 3: 实现 src/lib/ai-agent/context-builder.ts**
- [ ] **Step 4: 运行测试验证通过**
- [ ] **Step 5: Commit**

---

## Task 4: 实现 Query Validator

- [ ] **Step 1: 创建 src/lib/ai-agent/query-validator.test.ts**
- [ ] **Step 2: 运行测试验证失败**
- [ ] **Step 3: 实现 src/lib/ai-agent/query-validator.ts**
- [ ] **Step 4: 运行测试验证通过**
- [ ] **Step 5: Commit**

---

## Task 5: 实现 AI Agent Service

- [ ] **Step 1: 安装 AI SDK (npm install ai @ai-sdk/openai zod)**
- [ ] **Step 2: 实现 src/lib/ai-agent/service.ts**
- [ ] **Step 3: Commit**

---

## Task 6: 创建验证 Schema

- [ ] **Step 1: 创建 src/validators/ai-agent.ts**
- [ ] **Step 2: Commit**

---

## Task 7: 实现 API 路由

- [ ] **Step 1: 创建 src/app/api/ai-agent/chat/route.ts**
- [ ] **Step 2: 创建 src/app/api/ai-agent/aggregate/route.ts**
- [ ] **Step 3: 创建 src/app/api/ai-agent/confirm/route.ts**
- [ ] **Step 4: Commit**

---

## Task 8: 集成测试与验证

- [ ] **Step 1: TypeScript 类型检查 (npx tsc --noEmit)**
- [ ] **Step 2: 运行所有测试 (npm run test:run)**
- [ ] **Step 3: Commit**