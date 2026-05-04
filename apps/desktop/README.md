# 预算报告生成器 — 桌面版

> **v0.7.5**

基于 Tauri 2.0 的离线预算报告生成桌面应用。将 report-engine 的 DOCX 模板渲染能力打包为独立桌面工具，无需联网即可使用。

## 技术栈

- **Tauri 2.0** — Rust 后端 + 系统 WebView
- **React 18** + **TypeScript 5** — 前端 UI
- **Zustand** — 状态管理
- **Tailwind CSS v4** — 样式
- **Python sidecar** — FastAPI 报告渲染引擎（PyInstaller 打包）

## 功能

- **模板管理** — 导入、重命名、删除 .docx 模板
- **Excel 解析** — 导入 Excel 数据源，配置 Sheet 映射
- **配置管理** — 多配置方案持久化、绑定 xlsx、导入导出 JSON/ZIP
- **可视化配置编辑器** — 汇总页（table/cell_map 模式）、列映射、图片列
- **报告生成** — 四步向导：选模板 → 导入数据 → 配置预览 → 生成 .docx
- **数据校验** — 独立校验工具：根据配置检查 Excel 数据完整性
- **日志面板** — 实时操作日志

## 开发

```bash
# 安装依赖
npm install

# 启动 sidecar（需先启动 Python 环境）
cd sidecar && python main.py

# 启动开发模式
npm run tauri:dev
```

### 前置条件

- Node.js 18+
- Rust 1.70+
- Python 3.10+（开发模式 sidecar）
- Tauri CLI: `cargo install tauri-cli`

## 构建

```bash
# 打包 sidecar
./scripts/build-sidecar.sh

# 完整构建
./scripts/build-all.sh

# 仅构建前端 + Tauri
npm run tauri:build
```

产出物：
- Linux: `.AppImage`, `.deb`
- Windows: `.msi`

## 项目结构

```
apps/desktop/
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   │   ├── wizard/         # 向导步骤
│   │   ├── ConfigEditor.tsx
│   │   ├── ConfigSelector.tsx
│   │   └── ...
│   ├── stores/             # Zustand 状态
│   ├── services/           # API + Tauri 命令封装
│   └── types/              # TypeScript 类型
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── commands.rs     # Tauri 命令（模板/配置/文件操作）
│   │   └── sidecar.rs      # Sidecar 生命周期管理
│   └── Cargo.toml
├── sidecar/                # Python 报告引擎
│   ├── main.py             # FastAPI 入口
│   ├── api/                # API 路由
│   └── report_engine/      # DOCX 渲染引擎
└── scripts/                # 构建脚本
    ├── build-sidecar.sh
    └── build-all.sh
```

## 四步向导流程

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1. 选择模板  │ →  │ 2. 导入数据  │ →  │ 3. 配置预览  │ →  │ 4. 生成报告  │
│              │    │              │    │              │    │              │
│ 选择/导入     │    │ 选择 Excel   │    │ 配置方案选择  │    │ 生成 .docx   │
│ .docx 模板   │    │ 配置映射规则  │    │ 数据预览     │    │ 另存为/打开   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## 配置系统

配置方案以 JSON 文件存储在应用数据目录（`$APPDATA/configs/`），支持：

- **多配置方案** — 下拉切换，独立保存
- **可视化编辑** — 三标签页编辑器（基础/汇总页/Sheet 映射）
- **导入导出** — JSON 文件导入导出，方便团队共享

## 版本历史

### v0.7.5

- 修复 Windows 打包版 Sidecar 启动失败：添加缺失的 report_engine/budget 模块文件

### v0.7.4

- 修复 Windows 打包版 Sidecar 启动失败（ModuleNotFoundError: report_engine.budget）

### v0.7.3

- 捕获 Sidecar stderr 输出，显示崩溃详情

### v0.7.2

- 修复 Sidecar 启动诊断：显示具体错误信息

### v0.7.1

- 更新应用图标为全新紫色 Lab Logo

### v0.7.0

- 独立数据校验功能：根据配置校验 Excel 数据完整性
- 校验报告：缺失 sheet/列、空单元格明细、数值违规、填充率统计
- 支持已保存配置和导入 JSON 两种配置来源
- 文件校验系统：导入前模板/Excel/配置自动校验

### v0.6.0

- 响应式布局增强：窄窗口自动折叠侧边栏、卡片网格自适应、模态框自适应宽度
- 配置方案管理页面：卡片式管理、绑定 xlsx、导出为 ZIP（JSON + xlsx）
- 内容页面居中显示，与向导页面风格统一
- 卡片信息统一：文件大小、日期、双击重命名
- 示例文件下载（Excel/配置），使用原生保存对话框
- 修复配置编辑器双重 JSON 序列化导致内容消失的问题

### v0.5.0

- Sidecar 生命周期优化：健康检查通过后才设置端口，避免误报
- 进程存活检测与自动重启：sidecar 崩溃后自动恢复
- API 请求重试机制：最多 3 次重试，共享 HTTP 客户端
- 生产模式移除 PYTHONPATH，修复 PyInstaller 导入冲突
- Windows NSIS 单文件安装包支持

### v0.4.0

- GitHub Actions CI/CD：desktop-v* tag 自动构建 Windows MSI
- 应用图标：使用 favicon.png 作为 Logo
- 关于信息：显示 IDRL 开发团队
- 修复 sidecar 在 Windows 上的可执行文件兼容性

### v0.3.0

- Linear 风格深色优先设计系统，Inter 字体
- 设置视图：字体大小控制（12-28px 快捷选项 + 滑块）
- 深色/浅色主题切换，侧边栏快捷按钮
- 可收缩侧边栏，图标模式
- 帮助文档、更新日志、关于弹窗
- 可拖拽调整大小的日志面板

### v0.2.0

- 配置管理系统：多方案持久化、可视化编辑器、导入导出
- 增强配置编辑器：汇总页 table/cell_map 模式切换、列映射、图片列编辑
- 配置选择器组件：向导中切换配置方案

### v0.1.0

- 初始版本
- 四步向导 UI（模板选择、Excel 导入、配置预览、报告生成）
- 模板管理（导入、重命名、删除）
- Python sidecar 集成
- 报告另存为、打开
