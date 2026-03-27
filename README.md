# DOCX Template System

模板驱动的办公自动化系统。用户上传带有 `{{ placeholder }}` 标记的 `.docx` 模板，配置占位符后通过动态表单填写数据，自动生成文档。

## 功能特性

- **模板管理** — 上传、编辑、发布、归档 Word 模板，支持版本历史
- **智能解析** — 自动从 DOCX 文件中提取占位符，支持简单字段和动态表格块
- **动态表单** — 根据模板占位符自动生成填写表单，支持文本、多行文本、明细表
- **文档生成** — Python 服务替换模板占位符，保留原始格式（含合并单元格）
- **主数据管理** — 自定义数据表与字段，支持数据选择器绑定
- **批量生成** — 上传 Excel 数据批量生成文档，支持字段自动映射
- **草稿系统** — 表单数据自动保存，随时恢复编辑
- **导入导出** — Excel 导入主数据，记录数据导出为 Excel

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router, Turbopack) |
| UI 组件 | shadcn/ui v4 (Base UI), Tailwind CSS 4 |
| 数据库 | PostgreSQL + Prisma 7 (Driver Adapter) |
| 认证 | NextAuth v4 (JWT) |
| 文档生成 | Python FastAPI + python-docx |
| 验证 | Zod |
| 测试 | Vitest + Testing Library |

## 快速开始

### 前置要求

- Node.js >= 20
- Python >= 3.10
- PostgreSQL

### 环境变量

复制 `.env.example` 为 `.env.local` 并填写：

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/docx_template_system"
NEXTAUTH_SECRET="your-random-secret"
NEXTAUTH_URL="http://localhost:8060"
UPLOAD_DIR="public/uploads"
PYTHON_SERVICE_URL="http://localhost:8065"
```

### 安装与运行

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库
npx prisma db push
npx prisma generate
npx prisma db seed

# 3. 安装 Python 服务依赖
cd python-service
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ..

# 4. 启动 Python 文档生成服务
cd python-service && .venv/bin/python main.py &
cd ..

# 5. 启动 Next.js 开发服务器
npm run dev
```

打开 http://localhost:8060 ，使用以下账号登录：

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@example.com | admin123 |
| 用户 | user@example.com | user123 |

### 常用命令

```bash
npm run dev          # 启动开发服务器 (端口 8060)
npm run build        # 生产构建
npm run start        # 启动生产服务
npm run lint         # ESLint 检查
npm run test         # 运行测试 (watch 模式)
npm run test:run     # 运行测试 (单次)
npx prisma db push   # 同步数据库 schema
npx prisma generate  # 生成 Prisma Client
npx prisma studio    # 数据库可视化工具
```

## 模板语法

### 简单占位符

在 Word 文档中使用 `{{ key }}` 标记需要替换的字段：

```
合同编号：{{ contractNo }}
甲方名称：{{ partyA }}
签订日期：{{ signDate }}
```

### 动态表格块

使用 `{{#blockName}}` 和 `{{/blockName}}` 标记表格中的循环行：

```
| 序号 | 课题名称       | 负责人    |
|------|--------------|-----------|
| {{#研究计划}} |          |           | {{/研究计划}} |
```

表格块内的 `{{ key }}` 会被自动识别为列定义，生成表单时呈现为可编辑的明细表。

## 架构

```
src/
├── app/
│   ├── api/              # Route Handlers (thin wrappers)
│   ├── (auth)/           # 登录页面
│   └── (dashboard)/      # 主应用页面
├── components/
│   ├── forms/            # 动态表单组件
│   ├── templates/        # 模板管理组件
│   ├── data/             # 主数据组件
│   └── ui/               # shadcn/ui 基础组件
├── lib/
│   ├── services/         # 业务逻辑层 (ServiceResult 模式)
│   ├── docx-parser.ts    # DOCX 占位符解析
│   └── db.ts             # Prisma 客户端单例
├── types/                # TypeScript 接口
└── validators/           # Zod schemas

python-service/
└── main.py               # FastAPI 文档生成服务
```

三层后端模式：`types/` → `validators/` → `services/` → API Routes。

## License

MIT
