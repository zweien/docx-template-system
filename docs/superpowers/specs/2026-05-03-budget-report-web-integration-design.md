# 预算报告 Web 集成设计

> 将 Desktop 应用的预算报告功能集成到 Web 模板系统中，复用 report-engine Python 代码，Desktop 和 Web 共享同一份解析逻辑。

## 决策记录

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 用户流程 | 上传 Excel + 选模板 → 自动生成报告 | 与 Desktop 保持一致 |
| Python 代码归属 | 迁入 report-engine，统一维护 | 避免两份代码，一处改两处生效 |
| Desktop 策略 | 保留独立 UI，共享 report-engine budget 模块 | Desktop 用户不受影响 |
| 配置管理 | JSON 文件，暂不做 Web 配置编辑 | MVP 先跑通流程 |
| 前端路由 | 新建 `/budget`，独立向导页 | 预算报告是独立工作流 |
| 架构方案 | 前端直连 report-engine | 与现有报告导出模式一致 |
| Desktop 构建 | build-sidecar.sh 自动从 report-engine/ 同步代码 | 保证 Desktop 打包用最新代码 |

## report-engine 端变更

### 新增模块

```
report-engine/src/report_engine/
├── budget/                       # 新增模块
│   ├── __init__.py
│   ├── parse_excel.py            # 从 sidecar/scripts/parse_excel_budget.py 迁入
│   ├── validate_excel.py         # 从 sidecar/scripts/validate_excel.py 迁入
│   ├── build_payload.py          # 从 sidecar/scripts/build_payload.py 迁入
│   └── models.py                 # Pydantic 模型（BudgetConfig, ReportContent 等）
├── renderer.py                   # 已有，不改动
└── ...
```

### 新增 HTTP 端点

| 端点 | 方法 | 用途 | 请求格式 | 响应格式 |
|------|------|------|---------|---------|
| `/parse-excel` | POST | 解析 Excel 提取数据+图片 | multipart/form-data: file + config(JSON string) | `{content: ReportContent, warnings: string[]}` |
| `/validate-excel` | POST | 校验 Excel 数据完整性 | multipart/form-data: file + config(JSON string) | `{valid, errors, warnings, sheet_details}` |
| `/render-budget` | POST | 组装 payload 并渲染 DOCX | JSON: `{content, template_path, config, session_id}` | .docx 文件流 |

### 新增依赖

`openpyxl>=3.1.0` 加入 report-engine 的 requirements.txt。

### 临时文件管理

- parse-excel 提取的图片保存在 `report-engine/temp/{session_id}/`
- session_id 由前端生成（UUID），贯穿 parse-excel 和 render-budget 两次请求
- render-budget 完成后清理对应临时目录
- 启动时自动删除 > 24h 的临时文件

## Web 前端

### 路由结构

```
/budget              → 向导入口（自动跳到 step 1）
/budget?step=1       → 选择模板 + 配置
/budget?step=2       → 上传 Excel + 校验
/budget?step=3       → 预览数据 + 生成报告
```

用 URL query param 控制步骤，支持浏览器前进/后退。

### Step 1：选择模板 + 配置

- 从 `public/budget-templates/` 列出可用的 .docx 模板
- 从 `public/budget-configs/` 列出可用的 budget config JSON 文件
- 提供下载示例 Excel 和示例配置的链接

### Step 2：上传 Excel + 校验

- 拖拽或点击上传 .xlsx 文件
- 上传后自动调用 `POST /validate-excel` 预检
- 展示校验结果：
  - 通过：绿色标记，可进入下一步
  - 警告：警告列表，用户确认后可继续
  - 错误：错误详情，阻止继续
- 校验通过后自动调用 `POST /parse-excel` 解析数据

### Step 3：预览数据 + 生成报告

- 展示解析后的结构化内容概览（各 Section 表格、汇总信息、图片数量、警告）
- 点击「生成报告」调用 `POST /render-budget`
- 成功后下载 .docx 文件，失败显示错误详情

### 页面布局

复用 `(dashboard)` 布局（侧边栏 + 顶栏），侧边栏添加「预算报告」入口。向导区域用 Stepper 组件展示进度。

### 静态文件

```
public/
├── budget-templates/        # 预算报告 .docx 模板
│   └── budget_report.docx
└── budget-configs/          # BudgetConfig JSON 文件
    └── default.json
```

## 数据流

```
前端 (/budget)                     report-engine (8066)
    │                                    │
    │  GET /budget-templates             │
    │  GET /budget-configs               │
    │───────────────────────────────────>│ (静态文件服务)
    │                                    │
    │  POST /validate-excel              │
    │  (file + config)                   │
    │───────────────────────────────────>│
    │  {valid, errors, warnings}         │
    │<───────────────────────────────────│
    │                                    │
    │  POST /parse-excel                 │
    │  (file + config + session_id)      │
    │───────────────────────────────────>│
    │  {content, warnings}               │
    │<───────────────────────────────────│
    │                                    │
    │  POST /render-budget               │
    │  (content + template + session_id) │
    │───────────────────────────────────>│
    │  .docx 文件流                      │
    │<───────────────────────────────────│
```

## Desktop 适配

### 代码同步

`build-sidecar.sh` 新增步骤：构建前从 `report-engine/src/report_engine/` 自动拷贝到 `sidecar/report_engine/`。

```bash
# build-sidecar.sh 新增
cp -r ../../../report-engine/src/report_engine/ ./sidecar/report_engine/
```

### 导入路径

sidecar 的 API 模块改为从 `report_engine.budget` 导入：

```python
# 改造前
from scripts.parse_excel_budget import parse_excel_budget

# 改造后
from report_engine.budget.parse_excel import parse_excel_budget
```

Desktop UI 和用户流程不变。

## 错误处理

### 校验失败场景

| 场景 | 严重级别 | 处理 |
|------|---------|------|
| Excel 缺少配置中的 Sheet | 错误 | 阻止继续 |
| 必填列不存在 | 错误 | 阻止继续 |
| 数字列含非数字内容 | 警告 | 可继续 |
| 必填字段有空单元格 | 警告 | 展示空单元格位置 |
| Excel 中无图片但配置要求图片 | 警告 | 报告中显示 `[未上传]` |
| Excel 公式无法计算 | 警告 | 用缓存值，无则为空 |

### 超时设置

- parse-excel：60s
- render-budget：120s（含图片处理）
- 前端展示上传/解析进度条

### 并发隔离

每次预算报告生成使用独立 session_id 临时目录，多用户互不影响。

## 不做的事情（YAGNI）

- 不做 BudgetConfig 的 Web 编辑器（先用 JSON 文件）
- 不做生成报告的数据库持久化（直接下载）
- 不做报告历史记录
- 不做 Desktop sidecar 的完全移除

## 实施顺序

1. report-engine：新增 budget 模块 + HTTP 端点 + openpyxl 依赖
2. Web 前端：/budget 向导页 3 个步骤
3. 侧边栏添加入口
4. Desktop：构建脚本同步 + 导入路径更新
5. 静态文件：预算模板和默认配置
