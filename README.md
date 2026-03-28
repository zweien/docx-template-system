# DOCX Template System

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![License](https://img.shields.io/badge/License-MIT-green)

模板驱动的办公自动化系统。用户上传带有 `{{ placeholder }}` 标记的 `.docx` 模板，配置占位符后通过动态表单填写数据，自动生成文档。

当前开发环境已接入 `authentik` 统一认证，默认不再使用本地账号密码登录。

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
| 前端框架 | Next.js 16 (App Router) |
| UI 组件 | shadcn/ui v4 (Base UI), Tailwind CSS 4 |
| 数据库 | PostgreSQL + Prisma 7 (Driver Adapter) |
| 认证 | NextAuth v4 + authentik OIDC |
| 文档生成 | Python FastAPI + python-docx |
| 验证 | Zod |
| 测试 | Vitest + Testing Library |

## 快速开始

### 前置要求

- Node.js >= 20
- Python >= 3.10
- PostgreSQL
- 本地 `authentik` 统一认证实例，默认使用 `http://127.0.0.1:9000`

### 环境变量

项目当前没有提供 `.env.example`。请直接创建 `.env.local` 并填写：

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/docx_template_system"
NEXTAUTH_SECRET="your-random-secret"
NEXTAUTH_URL="http://localhost:8060"
UPLOAD_DIR="public/uploads"
PYTHON_SERVICE_URL="http://localhost:8065"
AUTHENTIK_ISSUER="http://127.0.0.1:9000/application/o/docx-template-system"
AUTHENTIK_CLIENT_ID="从 authentik 复制"
AUTHENTIK_CLIENT_SECRET="从 authentik 复制"
AUTHENTIK_LOGOUT_REDIRECT_URL="http://127.0.0.1:8081"
AUTHENTIK_ADMIN_EMAILS="admin@example.com,asfd@qqc.co"
```

关键说明：

- `AUTHENTIK_ISSUER` 必须指向 authentik 中对应应用的 issuer，例如 `http://127.0.0.1:9000/application/o/docx-template-system`
- `AUTHENTIK_CLIENT_ID` 和 `AUTHENTIK_CLIENT_SECRET` 只能从 authentik 后台复制
- `AUTHENTIK_ADMIN_EMAILS` 只用于首次统一登录时自动赋予本地 `ADMIN` 角色
- 本地 `User.role` 仍然保留，统一认证只负责“是谁”，业务权限仍由本系统负责

### 安装与运行

```bash
# 1. 安装 Node.js 依赖
npm install

# 2. 初始化数据库结构和基础数据
npx prisma db push
npx prisma generate
npx prisma db seed

# 3. 安装 Python 文档生成服务依赖
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

说明：

- `npm run dev` 和 `npm run build` 默认使用 `webpack`
- 原因是当前开发环境下，Next.js 16 默认 Turbopack 会受到系统 file watch limit 和 `python-service/.venv` 符号链接问题影响
- `next.config.ts` 已显式改成开发态轮询监听，并排除了 `.venv`、`.git`、`.next`、`.worktrees` 等大目录
- 访问入口为 `http://localhost:8060`

打开 http://localhost:8060/login ，点击“前往统一登录”：

- `akadmin`
- 密码使用当前 authentik 实例中的管理员密码

如果 `authentik` 中用户邮箱与本地用户邮箱一致，会自动认领本地角色：

- `admin@example.com` -> `ADMIN`
- `asfd@qqc.co` -> `ADMIN`
- 其它首次登录用户默认会创建为 `USER`

如果你需要先在本地库里准备角色映射，可直接在“用户管理”中新增邮箱和角色。该页面不再维护本地密码，只维护本地业务身份映射。

### 常用命令

```bash
npm run dev          # 启动开发服务器 (webpack, 端口 8060)
npm run build        # 生产构建 (webpack)
npm run start        # 启动生产服务
npm run lint         # ESLint 检查
npm run test         # 运行测试 (watch 模式)
npm run test:run     # 运行测试 (单次)
npx prisma db push   # 同步数据库 schema
npx prisma generate  # 生成 Prisma Client
npx prisma studio    # 数据库可视化工具
```

## 文档索引

- [认证接入说明](./docs/authentication.md)
- [开发运行说明](./docs/development.md)
- [故障排查](./docs/troubleshooting.md)

## 模板语法

### 简单占位符

在 Word 文档中使用 `{{ key }}` 标记需要替换的字段：

```
合同编号：{{ contractNo }}
甲方名称：{{ partyA }}
签订日期：{{ signDate }}
```

### 动态表格块

动态表格用于生成可变行的明细表（如材料清单、费用明细、人员列表等）。在 Word 表格中用 `{{#blockName}}` 和 `{{/blockName}}` 标记循环区域。

#### Word 模板写法

在 Word 中创建一个表格，将起始标记和结束标记分别放在独立的行中，中间的行作为模板行：

```
┌──────────┬──────────────┬──────────┐
│ 序号     │ 名称         │ 数量     │
├──────────┼──────────────┼──────────┤
│ {{#材料}} │              │          │  ← 起始标记行
├──────────┼──────────────┼──────────┤
│ {{序号}}  │ {{名称}}     │ {{数量}} │  ← 模板行（会被复制）
├──────────┼──────────────┼──────────┤
│ {{/材料}} │              │          │  ← 结束标记行
└──────────┴──────────────┴──────────┘
```

对应在 Word 中的实际输入：

| 单元格      | 内容          |
|------------|---------------|
| A2         | `{{#材料}}`    |
| B3         | `{{名称}}`     |
| C3         | `{{数量}}`     |
| A3         | `{{序号}}`     |
| A4         | `{{/材料}}`    |

#### 规则

- **块名** 支持中文、英文和下划线（如 `材料`、`items`、`费用明细`）
- 每个块名只能出现一对 `{{#name}}` / `{{/name}}` 标记
- 起始标记和结束标记必须在**同一个 Word 表格**中
- 起始标记行和结束标记行之间的 `{{ key }}` 会被识别为列定义
- 列定义的 key 同样支持中文（如 `{{名称}}`、`{{数量}}`）

#### 使用流程

1. **上传模板** — 上传包含动态表格标记的 `.docx` 文件
2. **解析占位符** — 系统自动识别简单字段和表格块，表格块的输入类型为「明细表」
3. **配置占位符** — 在模板编辑页可修改标签、备注、是否必填
4. **填写表单** — 表格块呈现为可编辑的明细表，支持添加/删除行
5. **生成文档** — Python 服务将每行数据复制模板行，替换占位符后输出

#### 生成效果

假设用户填写了两行数据：

| 序号 | 名称   | 数量 |
|------|--------|------|
| 1    | 钢材   | 100  |
| 2    | 水泥   | 200  |

生成的文档中，模板行会被复制为两行，标记行被移除：

```
┌──────────┬──────────────┬──────────┐
│ 序号     │ 名称         │ 数量     │
├──────────┼──────────────┼──────────┤
│ 1        │ 钢材         │ 100      │
├──────────┼──────────────┼──────────┤
│ 2        │ 水泥         │ 200      │
└──────────┴──────────────┴──────────┘
```

#### 多个表格块

同一个模板可以包含多个独立的表格块，只要块名不同即可：

```
{{#材料}} ... {{/材料}}
{{#设备}} ... {{/设备}}
```

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

## 认证边界

- `authentik` 负责统一登录、OIDC 授权、退出登录
- `NextAuth` 负责把 OIDC 用户映射为本地 Session
- 本地数据库 `User` 表继续保留 `role`
- 页面和 API 权限判断仍以本地 `role` 为准

也就是说，这次改造只替换了“登录来源”，没有把业务权限搬到统一认证中心。

## License

MIT
