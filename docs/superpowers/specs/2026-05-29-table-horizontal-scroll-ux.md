# 数据表横向滚动体验优化

**日期**：2026-05-29
**状态**：已批准

## 背景

数据表的表格视图（如论文表）列数较多时，横向滚动体验差：
1. 原生横向滚动条在容器底部，表格行数多时不可见
2. 没有快捷横向滚动方式（如 Shift+滚轮）
3. 已有冻结列功能，但用户不知道

## 目标

改善数据表横向滚动的可发现性和操作性，让用户无需滚到表格底部就能横向导航。

## 改动范围

仅涉及 `src/components/data/views/grid-view.tsx` 及少量全局样式。

## 设计

### 1. Shift+滚轮横向滚动

在表格容器（`overflow-auto` 的 `div`）上添加 `onWheel` 事件处理：

- **Shift+滚轮**：`e.shiftKey === true` 时，将 `e.deltaY` 映射为横向滚动 `scrollLeft`
- **表头区域滚轮**：当 `e.target` 位于 `<thead>` 内时，同样转为横向滚动（表头区域纵向滚动无意义）
- 两种情况均调用 `e.preventDefault()` 阻止默认行为
- 不按 Shift 且不在表头区域时，保持原生纵向滚动

### 2. 浮动横向滚动条

在表格可视区域底部固定一个同步的迷你滚动条：

- **定位**：`position: sticky; bottom: 0`，始终固定在表格区域底部视口内
- **同步**：
  - 监听表格容器 `scroll` 事件 → 更新浮动条滑块位置
  - 浮动条拖动 → 更新表格 `scrollLeft`
- **可见性**：
  - 使用 `ResizeObserver` + `scroll` 事件计算 `scrollWidth - clientWidth`
  - 无横向溢出时 `display: none`
- **样式**：
  - 高度 8px，半透明背景 + 圆角滑块
  - `z-index` 低于冻结列（避免遮挡），高于普通单元格
  - hover 时高度膨胀至 12px，增强可操作性
- 隐藏表格容器原生横向滚动条（`scrollbar-width: none` 及 `-webkit-scrollbar { display: none }`），统一使用浮动滚动条

### 3. 冻结列引导提示

当列数较多且未设置冻结列时，提示用户该功能存在：

- **触发条件**：`orderedFields.length >= 6` 且 `frozenFieldCount === 0`
- **显示**：表头右侧区域绝对定位的淡色气泡，文字："右键列头可冻结列，固定关键列方便查看"
- **dismiss**：用户首次冻结列后，将 `table-frozen-hint-dismissed` 写入 `localStorage`，之后不再显示
- **样式**：`pointer-events: none`，不阻挡正常操作，淡色文字 + 半透明背景

## 不做的事

- 不替换现有表格库或引入新依赖
- 不改变冻结列功能的实现逻辑
- 不涉及移动端触屏滚动（已通过 `WebkitOverflowScrolling: "touch"` 支持）

## 涉及文件

- `src/components/data/views/grid-view.tsx` — 主要改动
- `src/app/globals.css` — 浮动滚动条样式、隐藏原生滚动条
