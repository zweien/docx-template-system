# Airtable 风格数据表增强 - 实施计划索引

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将主数据表系统升级为 Airtable 风格的多视图交互体验

**Architecture:** 基于 React hooks 的统一数据层，所有视图（Grid/Kanban/Gallery/Timeline）共享 `useTableData` hook 进行数据获取、CRUD、乐观更新和视图配置管理。后端通过 Prisma schema 扩展 ViewType enum 和 DataView 列，新增 PATCH 和 reorder API。

**Tech Stack:** Next.js v16, Prisma v7 + PostgreSQL JSONB, React 19, `@dnd-kit/react`, shadcn/ui v4 (Base UI), zod, vitest

**Spec:** `docs/superpowers/specs/2026-04-04-airtable-data-table-enhancement-design.md`

---

## 子计划拆分

本 spec 覆盖 6 个独立子系统，拆分为 4 个子计划文件。每个子计划可独立实施、测试和提交。

| 子计划 | 文件 | 范围 | 依赖 |
|--------|------|------|------|
| Phase 1 | `2026-04-04-phase1-data-model-and-hooks.md` | 数据模型更新、统一数据 hook、共享格式化工具 | 无 |
| Phase 2 | `2026-04-04-phase2-grid-enhancements.md` | 内联编辑、多字段排序、分组、列拖拽、行拖拽排序 | Phase 1 |
| Phase 3 | `2026-04-04-phase3-view-switcher-and-drawer.md` | 视图切换器、记录详情抽屉、table-detail-content 集成 | Phase 1 |
| Phase 4 | `2026-04-04-phase4-new-views.md` | 看板视图、画廊视图、时间线视图 | Phase 1 + Phase 3 |

### 执行顺序

```
Phase 1 (基础) ─┬─> Phase 2 (Grid 增强)
                ├─> Phase 3 (视图切换 + 抽屉) ─> Phase 4 (新视图)
                └─────────────────────────────────> Phase 4
```

Phase 1 是所有后续 phase 的基础。Phase 2 和 Phase 3 可并行开发。Phase 4 依赖 Phase 3 的视图切换器和记录详情抽屉。

### 安装新依赖

在开始 Phase 1 之前，安装 `@dnd-kit/react`：

```bash
npm install @dnd-kit/react
```

---

## 各子计划详细内容见对应文件
