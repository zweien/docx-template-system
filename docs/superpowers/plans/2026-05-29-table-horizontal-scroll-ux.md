# 数据表横向滚动体验优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改善数据表列数多时的横向滚动体验——添加 Shift+滚轮横向滚动、浮动横向滚动条、冻结列引导提示。

**Architecture:** 三个独立的增量式改进，全部在 `grid-view.tsx` 和 `globals.css` 中实现。Shift+滚轮是纯事件处理；浮动滚动条是一个 sticky 定位的自定义 div + scroll 事件同步；冻结列提示是一个条件渲染的气泡。

**Tech Stack:** React hooks (useState, useEffect, useRef, useCallback, useMemo), CSS sticky positioning, ResizeObserver

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/data/views/grid-view.tsx` | Modify | Shift+滚轮事件、浮动滚动条组件、冻结列提示 |
| `src/app/globals.css` | Modify | 浮动滚动条样式、隐藏原生横向滚动条 |

---

### Task 1: Shift+滚轮 + 表头区域横向滚动

**Files:**
- Modify: `src/components/data/views/grid-view.tsx:2125` (scroll container div)

- [ ] **Step 1: 在 scroll container 上添加 onWheel handler**

在 `grid-view.tsx` 的 `GridView` 函数体内（约 line 440 附近，其他 ref/hook 定义区域）添加 `handleWheel` callback：

```tsx
const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
  const container = e.currentTarget;
  const hasHorizontalOverflow = container.scrollWidth > container.clientWidth;
  if (!hasHorizontalOverflow) return;

  const isShiftScroll = e.shiftKey;
  const isInThead = (e.target as HTMLElement).closest("thead") !== null;

  if (isShiftScroll || isInThead) {
    e.preventDefault();
    container.scrollBy({ left: e.deltaY || e.deltaX });
  }
}, []);
```

- [ ] **Step 2: 将 handler 绑定到 scroll container div**

修改 line 2125 的 scroll container div，添加 `onWheel={handleWheel}`：

```tsx
<div
  className="flex-1 min-h-0 overflow-auto relative hide-horizontal-scrollbar"
  ref={scrollRef}
  style={{ WebkitOverflowScrolling: "touch" }}
  onWheel={handleWheel}
>
```

注意 class 中添加了 `hide-horizontal-scrollbar`（Task 2 中定义样式）。

- [ ] **Step 3: 手动验证**

启动 `npm run dev`，打开一个列数较多的数据表：
1. 按住 Shift + 滚轮 → 表格应横向滚动
2. 在表头区域直接滚轮（不按 Shift） → 表格应横向滚动
3. 在表格数据区域滚轮（不按 Shift） → 表格应正常纵向滚动

- [ ] **Step 4: Commit**

```bash
git add src/components/data/views/grid-view.tsx
git commit -m "feat: add Shift+wheel and header-area horizontal scrolling for data table"
```

---

### Task 2: 浮动横向滚动条 — 样式

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 在 globals.css 末尾添加浮动滚动条样式和原生滚动条隐藏**

在 `globals.css` 的 `.frozen-last-col::after` 规则后面追加：

```css
/* Floating horizontal scrollbar for grid views */
.hide-horizontal-scrollbar {
  scrollbar-width: none;
}
.hide-horizontal-scrollbar::-webkit-scrollbar {
  display: none;
}

.floating-scrollbar-track {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  height: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  margin: 0 8px 4px;
  z-index: 6;
  cursor: pointer;
  transition: height 0.15s ease;
}
.floating-scrollbar-track:hover {
  height: 12px;
}
.floating-scrollbar-thumb {
  height: 100%;
  min-width: 30px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  transition: background 0.15s ease;
}
.floating-scrollbar-track:hover .floating-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.35);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add floating scrollbar styles and hide native horizontal scrollbar"
```

---

### Task 3: 浮动横向滚动条 — 组件逻辑

**Files:**
- Modify: `src/components/data/views/grid-view.tsx`

- [ ] **Step 1: 添加 state 和 ref**

在 `GridView` 函数体中（约 line 440 附近，其他 ref 定义区域）添加：

```tsx
const [scrollRatio, setScrollRatio] = useState(0);
const [thumbRatio, setThumbRatio] = useState(1);
const [hasHScroll, setHasHScroll] = useState(false);
const isDraggingThumb = useRef(false);
const dragStartX = useRef(0);
const dragStartScrollLeft = useRef(0);
```

- [ ] **Step 2: 添加 scroll 同步和 ResizeObserver effect**

在 state/ref 定义之后添加：

```tsx
// Floating scrollbar sync
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;

  const update = () => {
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setHasHScroll(maxScroll > 0);
    if (maxScroll > 0) {
      setScrollRatio(scrollLeft / maxScroll);
      setThumbRatio(clientWidth / scrollWidth);
    }
  };

  update();
  el.addEventListener("scroll", update, { passive: true });

  const ro = new ResizeObserver(update);
  ro.observe(el);

  return () => {
    el.removeEventListener("scroll", update);
    ro.disconnect();
  };
}, [scrollRef]);
```

- [ ] **Step 3: 添加拖动处理函数**

```tsx
const handleThumbMouseDown = useCallback((e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  isDraggingThumb.current = true;
  dragStartX.current = e.clientX;
  const container = scrollRef.current;
  if (container) {
    dragStartScrollLeft.current = container.scrollLeft;
  }

  const handleMouseMove = (ev: MouseEvent) => {
    if (!isDraggingThumb.current) return;
    const container = scrollRef.current;
    if (!container) return;
    const maxScroll = container.scrollWidth - container.clientWidth;
    const trackWidth = container.clientWidth - 16; // minus margin
    const dx = ev.clientX - dragStartX.current;
    const scrollDelta = (dx / (trackWidth * thumbRatio)) * maxScroll;
    container.scrollLeft = dragStartScrollLeft.current + scrollDelta;
  };

  const handleMouseUp = () => {
    isDraggingThumb.current = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
}, [scrollRef, thumbRatio]);

const handleTrackClick = useCallback((e: React.MouseEvent) => {
  if (isDraggingThumb.current) return;
  const container = scrollRef.current;
  if (!container) return;
  const trackEl = e.currentTarget as HTMLDivElement;
  const rect = trackEl.getBoundingClientRect();
  const clickRatio = (e.clientX - rect.left) / rect.width;
  const maxScroll = container.scrollWidth - container.clientWidth;
  container.scrollLeft = clickRatio * maxScroll;
}, [scrollRef]);
```

- [ ] **Step 4: 在 `</table>` 和 `</div>` 之间渲染浮动滚动条**

找到 scroll container 的闭合标签位置（`</table>` 在约 line 2325，`</div>` 在约 line 2326）。在 `</table>` 之后、`</div>` 之前插入：

```tsx
        </table>
        {hasHScroll && (
          <div
            className="floating-scrollbar-track"
            onClick={handleTrackClick}
          >
            <div
              className="floating-scrollbar-thumb"
              style={{
                width: `${thumbRatio * 100}%`,
                marginLeft: `calc(${scrollRatio} * (100% - ${thumbRatio * 100}%))`,
              }}
              onMouseDown={handleThumbMouseDown}
            />
          </div>
        )}
      </div>
```

- [ ] **Step 5: 手动验证**

打开列数较多的数据表：
1. 浮动滚动条应显示在表格底部（固定在视口内）
2. 拖动浮动滚动条 → 表格横向同步滚动
3. 点击轨道空白处 → 跳到对应位置
4. 表格内容不溢出时 → 浮动滚动条隐藏
5. hover 浮动滚动条 → 高度膨胀

- [ ] **Step 6: Commit**

```bash
git add src/components/data/views/grid-view.tsx
git commit -m "feat: add floating horizontal scrollbar to data table grid view"
```

---

### Task 4: 冻结列引导提示

**Files:**
- Modify: `src/components/data/views/grid-view.tsx`

- [ ] **Step 1: 添加 dismiss state**

在 `GridView` 函数体中（其他 state 定义区域）添加：

```tsx
const [frozenHintDismissed, setFrozenHintDismissed] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("table-frozen-hint-dismissed") === "true";
});
```

- [ ] **Step 2: 在表头区域渲染提示气泡**

找到 `<thead>` 区域内的最后一个表头单元格（`<th>` with ACTION_COL_WIDTH）之后、`</tr>` 之前。或者更简单地：在 `<thead>` 的 `</tr>` 之后、`</thead>` 之前插入。

实际上，最简单的位置是在 `<table>` 和 `<colgroup>` 之间，用 `position: absolute` 定位。但 `<table>` 内不允许非表格元素。

**更好的方案**：在 scroll container div 内部、`<table>` 之前渲染提示（作为表格容器的子元素，绝对定位在右上角）。

在 `grid-view.tsx` 中找到 `<table` 标签（约 line 2135），在其前面插入：

```tsx
        {orderedVisibleFields.length >= 6 && frozenFieldCountValue === 0 && !frozenHintDismissed && (
          <div
            className="absolute top-10 right-4 z-20 px-3 py-1.5 rounded-md bg-muted/80 text-xs text-muted-foreground pointer-events-none animate-in fade-in duration-500"
            style={{ pointerEvents: "none" }}
          >
            💡 右键列头可冻结列，固定关键列方便查看
            <span
              className="ml-2 pointer-events-auto cursor-pointer hover:text-foreground"
              onClick={() => {
                setFrozenHintDismissed(true);
                localStorage.setItem("table-frozen-hint-dismissed", "true");
              }}
            >
              ✕
            </span>
          </div>
        )}
```

注意：`pointer-events: none` 在外层 div 上防止阻挡操作，但 ✕ 按钮通过 `pointer-events-auto` 保持可点击。

- [ ] **Step 3: 手动验证**

1. 打开一个有 6 列以上的数据表，未设置冻结列 → 应在右上角看到提示
2. 点击 ✕ → 提示消失，刷新后也不显示
3. 右键冻结某列 → 提示应消失（因为 `frozenFieldCountValue > 0`）
4. 列数 < 6 的表 → 不显示提示

- [ ] **Step 4: Commit**

```bash
git add src/components/data/views/grid-view.tsx
git commit -m "feat: add frozen column discoverability hint for wide tables"
```

---

### Task 5: 集成验证

- [ ] **Step 1: 完整流程验证**

在 dev 环境下测试：
1. 创建/打开一个 10+ 列的数据表
2. 按 Shift + 滚轮 → 横向滚动正常
3. 在表头区域滚轮 → 横向滚动正常
4. 浮动滚动条可见且可拖动
5. 冻结列提示可见，点击 ✕ 或冻结列后消失
6. 列数少的表（< 6 列）→ 无提示、无异常
7. 冻结列后横向滚动 → 冻结列固定正常

- [ ] **Step 2: 运行 lint 和 type check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 3: Final commit if needed**

```bash
git push
```
