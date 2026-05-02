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

> **v0.7.4**

模板驱动的办公自动化系统。用户上传带有 `{{ placeholder }}` 标记的 `.docx` 模板，配置占位符后通过动态表单填写数据，自动生成文档。

## 功能特性

### 模板与文档

- **模板管理** — 上传、编辑、发布、归档 Word 模板，支持版本历史
- **智能解析** — 自动从 DOCX 文件中提取占位符，支持简单字段和动态表格块
- **动态表单** — 根据模板占位符自动生成填写表单，支持文本、多行文本、明细表
- **文档生成** — Python 服务替换模板占位符，保留原始格式（含合并单元格）
- **批量生成** — 上传 Excel 数据批量生成文档，支持字段自动映射
- **草稿系统** — 表单数据自动保存，随时恢复编辑

### 主数据管理

- **自定义数据表** — 创建数据表，配置多种字段类型
- **15 种字段类型** — 文本、数字、日期、单选/多选（彩色标签）、邮箱、电话、附件、URL、勾选框、关联、关系子表格、自动编号、创建/修改时间、创建/修改人、公式
- **5 种视图** — 表格（Grid）、看板（Kanban）、画廊（Gallery）、时间线（Timeline）、表单（Form）
- **Excel 导入导出** — Excel 导入主数据（支持字段映射和去重），记录数据导出为 Excel
- **数据表备份** — 完整导出/导入数据表结构（字段配置）和数据记录

### 表格视图高级功能

- **单元格编辑** — 双击编辑、批量填充、拖拽复制、撤销/重做
- **查找替换** — Ctrl+F 搜索单元格内容，支持替换
- **排序筛选** — 多字段排序、条件筛选、字段筛选器
- **条件格式** — 基于规则自动设置行/单元格背景色和文字颜色
- **列冻结** — 固定左侧列不随横向滚动
- **行高调整** — 紧凑/标准/宽松三种行高模式
- **分组折叠** — 按字段值分组显示，支持折叠/展开

### 公式引擎

- **26 个内置函数** — 数学（SUM, AVERAGE, MIN, MAX, ROUND, ABS, CEILING, FLOOR）、逻辑（IF, AND, OR, NOT）、文本（CONCAT, LEN, LEFT, RIGHT, MID, UPPER, LOWER, TRIM）、日期（NOW, YEAR, MONTH, DAY, DATE_DIFF）、类型转换（NUMBER, TEXT）
- **公式编辑器** — 字段引用补全（输入 `{` 触发）、函数自动补全、函数参考面板（语法+参数+示例）、实时预览、语法错误提示、循环引用检测
- **可扩展设计** — 统一函数元数据（参数类型、返回值、示例），新增函数只需编辑 catalog + evaluator 两个文件

### 表单视图与分享

- **可视化表单构建** — 拖拽排序字段、字段分组、自定义标题/描述/提交按钮文字
- **公开分享链接** — 生成带过期时间的公开表单 URL，支持提交次数统计
- **公开表单提交** — 无需登录即可填写提交，字段类型安全校验

### AI 智能助手

- **AI 对话** — 多模型聊天界面，流式响应，支持附件上传和文本提取
- **AI 填充助手** — 对话式表单填写，AI 智能推荐字段值，支持模型选择
- **工具调用** — MCP (Model Context Protocol) 集成，支持工具确认工作流
- **对话管理** — 历史记录、收藏、建议系统

### 自动化引擎（一期）

- **多种触发器** — 支持记录创建、记录更新、记录删除、字段变更、定时触发、手动触发
- **条件分支** — 支持单条件节点下的 `AND/OR` 组合判断，并根据结果走 `Then/Else` 分支
- **动作执行** — 当前支持更新字段、创建记录、更新关联记录、调用 Webhook、给当前记录添加评论、发送模板邮件
- **运行日志与告警** — 为每次自动化执行落库 `run/step` 记录，保留执行状态、耗时、错误信息；运行失败时向创建者推送站内通知
- **受限画布编辑器** — 提供触发器 → 条件 → 分支动作的结构化画布，避免自由拖拽带来的拓扑失控

### 系统管理

- **审计日志** — 记录数据创建/更新/删除、表单分享/提交等关键操作
- **用户管理** — 管理员/普通用户角色，邮箱身份映射
- **系统设置** — AI 模型配置、MCP 服务器管理

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 16 (App Router, Turbopack) |
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
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="bot@example.com"
SMTP_PASS="smtp-password"
SMTP_FROM="DOCX Template System <bot@example.com>"
```

关键说明：

- `AUTHENTIK_ISSUER` 必须指向 authentik 中对应应用的 issuer，例如 `http://127.0.0.1:9000/application/o/docx-template-system`
- `AUTHENTIK_CLIENT_ID` 和 `AUTHENTIK_CLIENT_SECRET` 只能从 authentik 后台复制
- `AUTHENTIK_ADMIN_EMAILS` 只用于首次统一登录时自动赋予本地 `ADMIN` 角色
- `SMTP_*` 为自动化邮件动作的可选配置；未配置时，“发送邮件”动作会执行失败，并触发自动化失败告警
- 本地 `User.role` 仍然保留，统一认证只负责"是谁"，业务权限仍由本系统负责

### 开发模式绕过认证

设置 `DEV_BYPASS_AUTH=true` 和 `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` 后，登录页显示管理员/普通用户快捷登录按钮，无需启动 Authentik。使用种子用户账号（`npx prisma db seed` 初始化）：

- 管理员：`admin@example.com` / `admin123`
- 普通用户：`user@example.com` / `user123`

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

打开 http://localhost:8060/login ，使用 authentik 登录或开发模式快捷登录。

### 常用命令

```bash
npm run dev          # 启动开发服务器 (Turbopack, 端口 8060)
npm run build        # 生产构建 (Turbopack)
npm run start        # 启动生产服务
npm run lint         # ESLint 检查
npm run test:run     # 运行测试 (单次)
npx tsc --noEmit     # 类型检查
npx prisma db push   # 同步数据库 schema
npx prisma generate  # 生成 Prisma Client
npx prisma studio    # 数据库可视化工具
npm run release      # 发布新版本 (自动 bump + CHANGELOG + git tag)
```

## 内网离线部署

适用于办公内网无法访问公网、但可使用 Docker 的场景。

### 交付文件

- `docker-compose.offline.yml`：离线部署专用 Compose（只使用本地镜像，不拉取公网）
- `.env.offline.example`：离线环境变量模板（可复用内网 PostgreSQL）
- `scripts/deploy-offline.sh`：一键部署脚本（可选加载镜像包 + 启动 + Prisma 同步 + 健康检查）

### 1. 准备环境变量

```bash
cp .env.offline.example .env.offline
```

至少需要正确配置：

- `DATABASE_URL`（指向内网 PostgreSQL）
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

如果是纯内网本地登录，建议：

```bash
DEV_BYPASS_AUTH=true
NEXT_PUBLIC_DEV_BYPASS_AUTH=true
```

### 2. 准备离线镜像包（在有网环境）

```bash
docker compose build
docker save \
  docx-template-system-app:v0.7.4 \
  docx-template-system-python-service:v0.7.4 \
  -o docx-template-system-offline.tar
```

将 `docx-template-system-offline.tar`、项目代码和 `.env.offline` 拷贝到内网服务器。

### 3. 一键部署（在内网服务器）

```bash
chmod +x scripts/deploy-offline.sh
./scripts/deploy-offline.sh --image-tar /path/to/docx-template-system-offline.tar
```

如果镜像已提前 `docker load` 过，可直接执行：

```bash
./scripts/deploy-offline.sh
```

### 4. 直接使用 Compose（可选）

```bash
docker compose -f docker-compose.offline.yml --env-file .env.offline up -d --remove-orphans
docker compose -f docker-compose.offline.yml --env-file .env.offline run --rm --user root app npx prisma db push
```

### 增量升级建议

- 推荐在内网搭私有 Registry（Harbor/registry:2），镜像按层增量传输
- 版本升级时仅更新镜像 tag（如 `v0.7.5`），再执行：

```bash
docker compose -f docker-compose.offline.yml --env-file .env.offline up -d --remove-orphans
```

### 数据迁移

#### 关系子表格字段迁移

如果数据库中存在旧的 `RELATION` 类型字段，需运行迁移脚本将其升级为 `RELATION_SUBTABLE` 模式：

```bash
# 预览迁移（不写入数据库）
npx tsx scripts/migrate-relation-fields.ts --dry-run

# 执行迁移
npx tsx scripts/migrate-relation-fields.ts
```

迁移内容：
1. 将 `RELATION` 字段类型改为 `RELATION_SUBTABLE`
2. 为缺失反向字段的字段自动生成系统反向字段
3. 从 `DataRecord.data` 中回填 `DataRelationRow` 关系行
4. 刷新正反 JSONB 快照

**注意：** 执行前务必先运行 `--dry-run` 检查数据完整性。

## 键盘快捷键

### 导航

| 快捷键 | 功能 |
|--------|------|
| 方向键 | 移动单元格 |
| Ctrl + 方向键 | 跳转到边缘（首/末行、行首/末） |
| Tab / Shift+Tab | 右移 / 左移 |
| Space | 展开/折叠分组行 |

### 编辑

| 快捷键 | 功能 |
|--------|------|
| Enter / F2 | 编辑单元格 |
| Esc | 退出编辑 |
| Delete / Backspace | 清除单元格 |
| Shift+Enter | 插入新行 |

### 剪贴板与操作

| 快捷键 | 功能 |
|--------|------|
| Ctrl+C / X / V | 复制 / 剪切 / 粘贴 |
| Ctrl+D | 复制行 |
| Ctrl+Z / Y | 撤销 / 重做 |

### 搜索与特殊

| 快捷键 | 功能 |
|--------|------|
| Ctrl+F | 查找替换 |
| Ctrl+; | 填入当前日期 |
| Shift+方向键 | 扩展选区 |

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

#### 规则

- **块名** 支持中文、英文和下划线（如 `材料`、`items`、`费用明细`）
- 每个块名只能出现一对 `{{#name}}` / `{{/name}}` 标记
- 起始标记和结束标记必须在**同一个 Word 表格**中
- 起始标记行和结束标记行之间的 `{{ key }}` 会被识别为列定义
- 列定义的 key 同样支持中文

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
│   ├── agent2/           # AI 智能助手组件
│   ├── forms/            # 动态表单组件 + AI 填充助手
│   ├── templates/        # 模板管理组件
│   ├── data/             # 主数据组件
│   │   ├── views/        # 5 种视图 (Grid/Kanban/Gallery/Timeline/Form)
│   │   └── formula-editor.tsx  # 公式编辑器
│   └── ui/               # shadcn/ui 基础组件
├── lib/
│   ├── services/         # 业务逻辑层 (ServiceResult 模式)
│   ├── formula/          # 公式引擎 (tokenizer/AST/evaluator)
│   ├── docx-parser.ts    # DOCX 占位符解析
│   └── db.ts             # Prisma 客户端单例
├── types/                # TypeScript 接口
└── validators/           # Zod schemas

python-service/
└── main.py               # FastAPI 文档生成服务
```

三层后端模式：`types/` → `validators/` → `services/` → API Routes。

## 文档索引

- [认证接入说明](./docs/authentication.md)
- [开发运行说明](./docs/development.md)
- [故障排查](./docs/troubleshooting.md)

## 认证边界

- `authentik` 负责统一登录、OIDC 授权、退出登录
- `NextAuth` 负责把 OIDC 用户映射为本地 Session
- 本地数据库 `User` 表继续保留 `role`
- 页面和 API 权限判断仍以本地 `role` 为准

## License

MIT
