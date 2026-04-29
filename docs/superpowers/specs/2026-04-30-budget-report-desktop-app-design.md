# 预算报告桌面应用设计方案

**日期**: 2026-04-30  
**目标**: 将预算报告自动生成流程封装为跨平台桌面应用（Windows + Linux）  
**用户**: 技术人员，团队环境使用  
**状态**: 待实现

---

## 1. 项目概述

### 1.1 背景

现有预算报告生成流程为命令行三步走：

1. `parse_excel_budget.py` — 解析 Excel 数据和图片
2. `build_payload.py` — 构建完整 payload
3. `report-engine render` — 渲染 Word 报告

该流程对技术人员可行，但存在以下痛点：
- 需要记忆命令行参数和文件路径
- JSON 配置文件手写容易出错
- 没有图形化反馈（解析警告、进度、预览）
- 团队协作时模板和配置难以统一管理

### 1.2 目标

构建一个**跨平台桌面应用**，将上述流程封装为图形化界面，同时提供：
- **三步向导**：选择 Excel → 选择配置/模板 → 生成报告
- **配置编辑器**：图形化编辑 JSON 配置文件（Sheet 映射、列映射、汇总页设置）
- **实时反馈**：解析结果预览、警告列表、生成进度
- **团队支持**：工作区管理、模板共享

### 1.3 非目标

- 不替换现有的命令行工具（CLI 仍然可用）
- 不内嵌 Word 编辑器（报告生成后用系统默认程序打开）
- 不支持 macOS（首期仅 Windows + Linux）
- 不实现云端同步/多用户实时协作（本地团队共享即可）

---

## 2. 架构设计

### 2.1 技术选型

采用 **Tauri + Python Sidecar** 架构：

| 层级 | 技术 | 职责 |
|---|---|---|
| 前端 UI | React + TypeScript + shadcn/ui | 界面渲染、用户交互、状态管理 |
| 原生层 | Tauri (Rust) | 窗口管理、文件系统 API、Sidecar 生命周期 |
| 业务层 | Python (FastAPI) | Excel 解析、Payload 构建、报告渲染 |

**选型理由**:
- Tauri 打包体积小（前端 < 10MB），优于 Electron
- React 与现有 Next.js 前端技术栈一致，组件可复用
- Python Sidecar 直接复用现有 `parse_excel_budget.py`、`report-engine` 等代码，零迁移成本

### 2.2 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Tauri 桌面应用                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   React UI   │  │  Rust 核心层  │  │  Python Sidecar  │  │
│  │              │  │              │  │  (FastAPI HTTP)  │  │
│  │ - 文件选择    │◄─┤ - 窗口管理    │◄─┤                  │  │
│  │ - 配置表单    │  │ - 文件系统    │  │ - parse_excel    │  │
│  │ - 进度展示    │  │ - Sidecar    │  │ - build_payload  │  │
│  │ - 报告预览    │  │   生命周期    │  │ - report-engine  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│           │                │                      │          │
│           └────────────────┴──────────────────────┘          │
│                         HTTP API                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 通信方式

Python Sidecar 内嵌 **FastAPI HTTP 服务**，前端通过 `fetch` 调用本地 API。

**不选 STDIO 的原因**:
- HTTP 支持 multipart 文件传输（Excel、图片、docx）
- SSE（Server-Sent Events）可推送实时进度
- Python 进程保持运行，避免每次命令重新启动解释器

**端口管理**:
- Rust 启动时扫描空闲端口（如 `localhost:51234`）
- 通过环境变量 `SIDECAR_PORT` 传给 Python
- 前端通过 Tauri 的 `invoke` 获取实际端口

---

## 3. 界面设计

### 3.1 布局结构

**主界面**: 侧边栏 + 主内容区

```
┌──────────────────────────────────────────────┐
│ 预算报告生成器 — XX项目                        │
├──────────┬───────────────────────────────────┤
│ 📁 工作区  │  ┌──────┐ ┌──────┐ ┌──────┐     │
│ ▸ 项目A   │  │ 步骤1 │ │ 步骤2 │ │ 步骤3 │     │
│   项目B   │  │导入Excel│ │选择配置│ │生成报告│     │
│   项目C   │  └──────┘ └──────┘ └──────┘     │
│          │                                    │
│ ⚙ 配置管理 │         [主内容区域]               │
│ 📄 模板管理 │                                    │
└──────────┴───────────────────────────────────┘
```

**侧边栏**:
- 工作区列表（当前项目高亮）
- 底部功能入口：配置管理、模板管理

**主内容区**:
- 顶部步骤指示器（3 步向导）
- 下方动态内容：根据当前步骤显示不同面板

### 3.2 三步向导

#### 步骤 1: 导入 Excel

- 文件选择（拖拽或浏览）
- 解析结果展示：
  - 检测到的 Sheet 列表（✓/✗）
  - 汇总页信息
  - 警告列表（留空字段、缺失列等）
- "下一步"按钮（有错误时禁用）

#### 步骤 2: 选择配置与模板

- 配置选择：下拉框选择已有配置，或点击"编辑配置"
- 模板选择：下拉框选择已有模板
- 配置编辑器入口（弹窗/侧边抽屉）

#### 步骤 3: 生成报告

- 生成按钮
- 实时进度条（SSE 推送）
  - 解析 Excel... ✓
  - 提取图片... 3/10
  - 构建 Payload... ✓
  - 渲染报告... 进行中
- 完成：显示输出路径 + "打开文件"按钮

### 3.3 配置编辑器

图形化编辑 `budget_config.json`，无需手写 JSON。

**Sheet 映射表格**:

| Excel Sheet | 报告章节 | Section ID | 操作 |
|---|---|---|---|
| 设备费 | 设备费明细 | equipment_fee | 编辑 / 删除 |
| 材料费 | 材料费明细 | material_fee | 编辑 / 删除 |
| + 添加行 | | | |

**列映射表格**:

| 字段键 | Excel 列名 | 说明 |
|---|---|---|
| name | 名称 | 项目名称 |
| spec | 规格 | 规格型号 |
| unit_price | 单价 | 单价（数值） |
| amount | 经费 | 总价 |
| reason | 购置理由 | 文字说明 |
| basis | 测算依据 | 文字说明 |

**汇总页设置**:

- 模式选择：table 模式 / cell_map 模式（单选）
- table 模式：表头行、关键列、数值列、前缀输入框
- cell_map 模式：键值对表格（占位符 → 单元格坐标）

---

## 4. 数据流

### 4.1 启动流程

```
Tauri App 启动
    │
    ├──► Rust 层扫描空闲端口
    │      │
    │      ├──► 启动 Python Sidecar 子进程
    │      │      命令: python sidecar/main.py --port {port}
    │      │      环境变量: PYTHONPATH=./report-engine:./skills
    │      │
    │      └──► 轮询 /health 直到返回 200
    │
    └──► React 前端加载
           通过 invoke("get_sidecar_port") 获取端口
           后续 API 调用: fetch(`http://localhost:${port}/api/...`)
```

### 4.2 核心操作：生成报告

```
用户选择 Excel 文件
    │
    ├──► Rust: dialog.open() → 绝对路径
    │
    ├──► POST /api/parse-excel
    │      请求: { input_path: "/abs/path/budget.xlsx", config: {...} }
    │      │
    │      ├──► Python: parse_excel_budget()
    │      │      - 读取 Excel 数据和图片
    │      │      - 公式计算回退（data_only=True + eval 回退）
    │      │      - 保存图片到临时目录
    │      │
    │      └──► 响应: { content, warnings, images }
    │
    ├──► 前端: 展示解析结果（表格预览 + 警告列表）
    │
    ├──► 用户选择模板 + 确认/编辑配置
    │
    ├──► POST /api/render
    │      请求: { content, template_path, output_dir, config }
    │      │
    │      ├──► Python: build_payload() → payload.json
    │      ├──► Python: report-engine render → report.docx
    │      │
    │      └──► 响应: { output_path: "/abs/path/report.docx" }
    │
    └──► Rust: shell.openPath(output_path) 打开报告
```

### 4.3 文件系统职责划分

| 操作 | Rust 层 | Python Sidecar |
|---|---|---|
| 文件选择对话框 | ✅ `dialog.open()` | |
| 读取/写入用户目录 | ✅ `fs.*` API | |
| 临时目录操作（图片、中间文件） | | ✅（绝对路径） |
| 执行 Python 脚本、report-engine | | ✅ |
| 打开生成的文件 | ✅ `shell.openPath()` | |

**关键原则**: Python sidecar 只通过**绝对路径**读写文件，不依赖工作目录。

### 4.4 实时进度（SSE）

长耗时操作（大量图片提取、报告渲染）通过 SSE 推送进度：

```
前端: GET /api/progress?task_id=abc123

Python 推送事件流:
event: progress
data: {"step":"extract_images","current":3,"total":10,"message":"提取图片 设备费_3_1.png"}

event: progress
data: {"step":"render","current":2,"total":3,"message":"渲染 Word 文档..."}

event: complete
data: {"output_path":"/abs/path/report.docx"}
```

---

## 5. API 设计

### 5.1 Python Sidecar (FastAPI)

```
GET  /health                    健康检查
POST /api/parse-excel           解析 Excel
POST /api/build-payload         构建 Payload
POST /api/render                渲染报告
GET  /api/progress              SSE 进度流
GET  /api/templates             列出可用模板
GET  /api/configs               列出可用配置
POST /api/validate-config       验证配置格式
```

### 5.2 Rust Commands (Tauri)

```rust
// 获取 sidecar 端口
#[tauri::command]
fn get_sidecar_port(state: State<AppState>) -> u16;

// 打开文件选择对话框
#[tauri::command]
async fn select_excel(app: AppHandle) -> Result<Option<String>, String>;

// 打开文件保存对话框
#[tauri::command]
async fn select_output_dir(app: AppHandle) -> Result<Option<String>, String>;

// 打开生成的报告
#[tauri::command]
fn open_report(path: String) -> Result<(), String>;

// 读取应用配置
#[tauri::command]
fn get_app_config() -> AppConfig;

// 保存应用配置
#[tauri::command]
fn save_app_config(config: AppConfig) -> Result<(), String>;
```

---

## 6. 错误处理

### 6.1 Python Sidecar 故障

| 场景 | 检测方式 | 处理策略 |
|---|---|---|
| 启动失败 | 启动命令 exit code ≠ 0 | 弹窗提示检查 Python 依赖 |
| 启动超时 | /health 30s 未返回 | 提示 sidecar 启动超时，查看日志 |
| 运行中崩溃 | 心跳检测 /health 连续失败 | Rust 自动重启 sidecar，保留错误日志 |
| 端口冲突 | 启动时绑定端口失败 | 自动扫描下一个空闲端口重试 |

### 6.2 API 错误响应

统一错误格式：

```json
{
  "success": false,
  "error": {
    "code": "EXCEL_PARSE_ERROR",
    "message": "Sheet '设备费' 不存在",
    "details": { "available_sheets": ["汇总页", "材料费"] }
  }
}
```

前端统一拦截：显示错误弹窗 + 记录日志面板 + 提供"复制错误信息"按钮。

### 6.3 解析警告 vs 错误

- **错误**（阻断）：Excel 格式不合法、模板缺失必要占位符 → 禁用"生成"按钮
- **警告**（非阻断）：字段为空、图片缺失 → 允许生成，报告中自动标记 `[未填写]`

---

## 7. 打包与分发

### 7.1 目录结构

```
BudgetReport-App/
├── BudgetReport.exe          # Tauri 主程序（Rust + WebView）
├── sidecar/
│   ├── python/               # 内嵌 Python 运行时
│   ├── report-engine/        # Python 服务代码
│   ├── skills/               # report-generator 脚本
│   └── main.py               # FastAPI 入口
├── templates/                # 默认模板（budget_report.docx）
└── resources/                # 图标、默认配置
```

### 7.2 打包方案

**Windows**:
- Tauri: `tauri build` → `.msi` 安装包
- Python sidecar: `PyInstaller --onedir` 打包为目录
- 安装程序将 sidecar 解压到安装目录

**Linux**:
- Tauri: `tauri build` → `.AppImage` 或 `.deb`
- Python sidecar: PyInstaller 打包
- 首次启动自动解压 sidecar 到 `~/.local/share/budget-report/sidecar/`

### 7.3 体积预估

| 组件 | 大小 |
|---|---|
| Tauri 前端（WebView） | ~5 MB |
| Python sidecar（PyInstaller，含 openpyxl、docxtpl、Pillow） | ~80-120 MB |
| **总计** | **~100-130 MB** |

---

## 8. 技术栈汇总

| 领域 | 技术 |
|---|---|
| 桌面框架 | Tauri 2.x (Rust) |
| 前端 UI | React 18 + TypeScript |
| UI 组件 | shadcn/ui + Tailwind CSS |
| HTTP 客户端 | TanStack Query + fetch |
| Python 服务 | FastAPI |
| Python 打包 | PyInstaller |
| Excel 解析 | openpyxl（已有） |
| 报告渲染 | report-engine（已有） |
| 状态管理 | Zustand |
| 构建工具 | Vite |

---

## 9. 实现顺序

1. **Phase 1**: 搭建 Tauri + React 项目骨架，实现 Python sidecar 启动/通信
2. **Phase 2**: 实现步骤 1（Excel 导入 + 解析结果展示）
3. **Phase 3**: 实现配置编辑器（Sheet 映射、列映射、汇总页设置）
4. **Phase 4**: 实现步骤 2-3（模板选择 + 报告生成 + 进度反馈）
5. **Phase 5**: 工作区管理、模板管理、日志面板
6. **Phase 6**: Windows/Linux 打包、安装程序、文档

---

## 10. 风险与应对

| 风险 | 应对 |
|---|---|
| PyInstaller 打包体积过大 | 使用 `--exclude-module` 剔除无用依赖；考虑 `uv` 或 `conda-standalone` 替代方案 |
| Tauri + Python 跨平台差异 | 在 CI 中分别构建 Windows 和 Linux 版本 |
| Sidecar 启动慢 | 添加启动画面（Splash Screen），异步初始化 |
| 文件路径含中文/空格 | 全程使用绝对路径，URL 编码处理 |
