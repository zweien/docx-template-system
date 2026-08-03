# DOCX Template System

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql)
![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)
![License](https://img.shields.io/badge/License-MIT-green)
[![Version](https://img.shields.io/github/v/tag/zweien/docx-template-system?label=Version&color=blue)](https://github.com/zweien/docx-template-system/releases)
[![Documentation](https://img.shields.io/badge/Documentation-Online_blue)](https://zweien.github.io/docx-template-system/)

> **v0.11.0** · [Online Documentation](https://zweien.github.io/docx-template-system/)

The DOCX Template System is a template-driven office automation solution. It supports two types of templates: **fill-in generation** (upload a .docx file with `{{ placeholder }}` markers, configure placeholders, and fill in data through a dynamic form to automatically generate documents) and **file download** (upload a set of files for teams to download directly). The system also includes modules for report writing, document collection, and budget reporting.

## Interface Preview

<p align="center">
  <img src="docs/screenshots/workspace.png" alt="Workspace" width="720" />
</p>

## Features

### Templates and Documents

- **Template Management** — Upload, edit, publish, and archive Word templates, with version history support
- **Two Template Types** — Fill-in generation (online form to generate docx) and file download (upload a set of files for teams to download directly), choose as needed
- **Document Online Preview** — Based on file-viewer, templates, historical versions, and generated documents can be previewed online without downloading
- **Smart Parsing** — Automatically extract placeholders from DOCX files, supporting simple fields and dynamic table blocks
- **Dynamic Form** — Automatically generate filling forms based on template placeholders, supporting text, multi-line text, and detail tables
- **Document Generation** — report-engine CLI rendering engine, supporting rich text blocks (headings/lists/tables/formulas/images), conditional paragraphs, and sub-document references
- **Batch Generation** — Upload Excel data for batch document generation, supporting automatic field mapping
- **Draft System** — Automatically save form data, allowing for easy recovery of editing sessions

### Report Writing

- **Report Templates** — Upload .docx templates, automatically parse chapter structure, context variables, style requirements, and AI writing prompts
- **Rich Text Editor** — Based on BlockNote, supporting paragraphs, headings, lists, tables, formulas, Mermaid charts, images, and attachments
- **AI Smart Writing** — Chapter-level AI generation (streaming output), AI dialogue sidebar, custom AI actions (writing/translation/analysis)
- **Real-time Collaboration** — Based on y-websocket + Yjs CRDT, multi-person simultaneous editing, cursor synchronization, online status display
- **Export .docx** — report-engine rendering engine export, supporting rich text blocks, conditional paragraphs, and sub-document references
- **Attachment Management** — Attachment upload and management, batch package export

### Document Collection

- **Task Management** — Create file collection tasks, specify deadlines and collector lists
- **File Submission** — Collectors upload files, the system automatically renames files according to configured rules
- **Version Tracking** — Multiple version submission history, view and download historical versions anytime
- **Batch Download** — One-click package download of all submitted files (ZIP format)

### Budget Report

- **Excel Data Validation** — Upload Excel files, real-time validation of worksheets, columns, data formats, and fill rates
- **Three-Step Wizard** — Select template and configure → upload Excel for validation → preview and generate DOCX
- **Configuration Management** — Customize validation rules and field mappings, support JSON configuration import and export

### Desktop Application

- **Standalone Operation** — Based on Tauri 2.0 desktop application, built-in Python sidecar, no internet required
- **Offline Generation** — Complete Excel validation and report generation locally, suitable for intranet environments
- **Configuration Management** — Visual configuration editor, multiple configuration schemes, JSON import and export
- **Cross-platform** — Windows (NSIS installer), Linux (AppImage/deb)

### Master Data Management

- **Custom Data Tables** — Create data tables, configure multiple field types
- **15 Field Types** — Text, number, date, single/multiple choice (color labels), email, phone, attachment, URL, checkbox, association, relationship sub-table, auto number, creation/modification time, creation/modification person, formula
- **5 Views** — Table (Grid), Kanban, Gallery, Timeline, Form
- **Excel Import/Export** — Import master data via Excel (support field mapping and deduplication), export record data as Excel
- **Data Table Backup** — Complete export/import of data table structure (field configuration) and data records

### Advanced Table View Features

- **Cell Editing** — Double-click to edit, batch fill, drag and copy, undo/redo
- **Find and Replace** — Ctrl+F search cell content, support replacement
- **Sort and Filter** — Multi-field sorting, conditional filtering, field filter
- **Conditional Formatting** — Automatically set row/cell background color and text color based on rules
- **Column Freeze** — Fix left columns not to move with horizontal scrolling
- **Row Height Adjustment** — Three modes: compact/standard/loose
- **Group Folding** — Display grouped by field values, support folding/unfolding

### Formula Engine

- **26 Built-in Functions** — Mathematical (SUM, AVERAGE, MIN, MAX, ROUND, ABS, CEILING, FLOOR), logical (IF, AND, OR, NOT), text (CONCAT, LEN, LEFT, RIGHT, MID, UPPER, LOWER, TRIM), date (NOW, YEAR, MONTH, DAY, DATE_DIFF), type conversion (NUMBER, TEXT)
- **Formula Editor** — Field reference completion (press `{` to trigger), function auto-completion, function reference panel (syntax+parameters+examples), real-time preview, syntax error prompts, circular reference detection
- **Extensible Design** — Unified function metadata (parameter types, return value, examples), adding new functions only requires editing catalog + evaluator two files

### Form View and Sharing

- **Visual Form Building** — Drag and sort fields, field grouping, custom title/description/submit button text
- **Public Sharing Link** — Generate public form URL with expiration time, support submission count statistics
- **Public Form Submission** — Fill and submit without login, field type security validation

### AI Smart Assistant

- **Multi-model Dialogue** — Dynamic model selection, streaming response, support attachment upload and text extraction
- **AI Fill Assistant** — Dialogue-based form filling, AI intelligent recommendation of field values; support tool calls to query master data tables, use real data for automatic filling instead of fabrication
- **MCP Tool Call** — Model Context Protocol integration, support tool confirmation workflow
- **Dialogue Management** — History records, favorites, recommendation system
- **AI Action Management** — Administrators can create global AI actions (writing/translation/analysis), users can build personal actions, support variable templates

### Automation Engine

- **Multiple Triggers** — Support record creation, record update, record deletion, field change, scheduled trigger, manual trigger
- **Conditional Branching** — Support single condition node under `AND/OR` combination judgment, and follow `Then/Else` branches based on results
- **Action Execution** — Currently support update field, create record, update associated record, call Webhook, add comment to current record, send template email
- **Run Logs and Alarms** — Record `run/step` for each automation execution, retain execution status, duration, error information; push in-site notification to creator when execution fails
- **Constrained Canvas Editor** — Provide trigger → condition → branch action structured canvas, avoid topology loss caused by free dragging

### System Management

- **Audit Log** — Record all key operations, covering template management, document generation, data table operations, user management, report system (template/draft/export/collaboration) etc.
- **User Management** — Administrator/regular user roles, email identity mapping
- **AI Configuration** — Centralized management of global AI models and editor AI operation templates
- **System Settings** — Dialogue suggestion configuration, data table automatic backup, API Token management, MCP server management

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend Framework | Next.js 16 (App Router, Turbopack) |
| UI Components | shadcn/ui v4 (Base UI), Tailwind CSS 4 |
| Database | PostgreSQL + Prisma 7 (Driver Adapter) |
| Authentication | NextAuth v4 + authentik OIDC |
| Report Editor | BlockNote 0.49 + @blocknote/xl-ai |
| Real-time Collaboration | Yjs + y-websocket + y-leveldb |
| Desktop Application | Tauri 2.0 (Rust + React) |
| AI Integration | @ai-sdk (OpenAI/MCP) |
| State Management | Zustand |
| Document Generation | report-engine (Python, python-docx + docxtpl) |
| Simple Document Replacement | python-service (Python FastAPI, python-docx) |
| Validation | Zod |
| Testing | Vitest + Testing Library |

## Quick Start

### Prerequisites

- Node.js >= 20
- Python >= 3.10
- PostgreSQL
- Local `authentik` unified authentication instance, default using `http://127.0.0.1:9000`

### Environment Variables

The project currently does not provide `.env.example`. Please create `.env.local` directly and fill in:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/docx_template_system"
NEXTAUTH_SECRET="your-random-secret"
NEXTAUTH_URL="http://localhost:8060"
UPLOAD_DIR="public/uploads"
PYTHON_SERVICE_URL="http://localhost:8065"
REPORT_ENGINE_URL="http://localhost:8066"
AUTHENTIK_ISSUER="http://127.0.0.1:9000/application/o/docx-template-system"
AUTHENTIK_CLIENT_ID="copy from authentik"
AUTHENTIK_CLIENT_SECRET="copy from authentik"
AUTHENTIK_LOGOUT_REDIRECT_URL="http://127.0.0.1:8081"
AUTHENTIK_ADMIN_EMAILS="admin@example.com,asfd@qqc.co"
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="bot@example.com"
SMTP_PASS="smtp-password"
SMTP_FROM="DOCX Template System <bot@example.com>"
```

Key notes:

- `AUTHENTIK_ISSUER` must point to the corresponding application issuer in authentik, e.g., `http://127.0.0.1:9000/application/o/docx-template-system`
- `AUTHENTIK_CLIENT_ID` and `AUTHENTIK_CLIENT_SECRET` can only be copied from the authentik backend
- `AUTHENTIK_ADMIN_EMAILS` is only used to automatically grant local `ADMIN` role during the first unified login
- `REPORT_ENGINE_URL` is the address of the rendering engine used by the report writing module
- `SMTP_*` are optional configurations for automation email actions; if not configured, the "send email" action will fail and trigger automation failure alarm
- Local `User.role` is still retained, unified authentication only handles "who", business permissions are still handled by this system

### Development Mode Bypass Authentication

Set `DEV_BYPASS_AUTH=true` and `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` to display administrator/regular user shortcut login buttons on the login page, no need to start Authentik. Use seed user account (initialize with `npx prisma db seed`):

- Administrator: `admin@example.com` / `admin123`
- Regular user: `user@example.com` / `user123`

### Installation and Running

```bash
# 1. Install Node.js dependencies
npm install

# 2. Initialize database structure and basic data
npx prisma db push
npx prisma generate
npx prisma db seed

# 3. Install Python document generation service dependencies
cd python-service
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ..

# 4. Install report-engine (HTTP service + CLI)
cd report-engine
python -m venv .venv
.venv/bin/pip install -e .
cd ..

# 5. Start Python document generation service (port 8065)
cd python-service && .venv/bin/python main.py &
cd ..

# 6. Start report-engine HTTP service (port 8066, used by report writing page)
cd report-engine && .venv/bin/python main.py &
cd ..

# 7. Start collaboration WebSocket server (port 8072, used by report collaboration editing)
npm run dev:collab &

# 8. Start Next.js development server
npm run dev
```

Open http://localhost:8060/login, use authentik login or development mode shortcut login.

### Common Commands

```bash
npm run dev          # Start development server (Turbopack, port 8060)
npm run dev:collab   # Start collaboration WebSocket server (port 8072)
npm run build        # Production build (Turbopack)
npm run start        # Start production service
npm run lint         # ESLint check
npm run test:run     # Run tests (single time)
npx tsc --noEmit     # Type check
npx prisma db push   # Sync database schema
npx prisma generate  # Generate Prisma Client
npx prisma studio    # Database visualization tool
npm run release      # Publish new version (automatic bump + CHANGELOG + git tag)

# report-engine CLI
report-engine validate --payload data.json             # Validate payload
report-engine check-template --template tpl.docx --payload data.json  # Check template contract
report-engine render --template tpl.docx --payload data.json --output out.docx  # Render report
```

## Intranet Offline Deployment

This section is applicable to intranet office environments without access to the public network but with Docker support.

### Deliverables

- `docker-compose.offline.yml`: Offline deployment dedicated Compose (only use local images, no pull from public network)
- `.env.offline.example`: Offline environment variable template (can reuse intranet PostgreSQL)
- `scripts/deploy-offline.sh`: One-click deployment script (optional load image package + start + Prisma sync + health check)

### 1. Prepare Environment Variables

```bash
cp .env.offline.example .env.offline
```

At least need to correctly configure:

- `DATABASE_URL` (pointing to intranet PostgreSQL)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

If it's a pure intranet local login, it's recommended:

```bash
DEV_BYPASS_AUTH=true
NEXT_PUBLIC_DEV_BYPASS_AUTH=true
```

### 2. Prepare Offline Image Package (in a network environment)

```bash
docker compose build
docker save \
  docx-template-system-app:v0.9.1 \
  docx-template-system-python-service:v0.9.1 \
  -o docx-template-system-offline.tar
```

Copy `docx-template-system-offline.tar`, project code, and `.env.offline` to the intranet server.

### 3. One-click Deployment (on intranet server)

```bash
chmod +x scripts/deploy-offline.sh
./scripts/deploy-offline.sh --image-tar /path/to/docx-template-system-offline.tar
```

If the image has been previously `docker load`ed, you can directly execute:

```bash
./scripts/deploy-offline.sh
```

### 4. Direct Use of Compose (optional)

```bash
docker compose -f docker-compose.offline.yml --env-file .env.offline up -d --remove-orphans
docker compose -f docker-compose.offline.yml --env-file .env.offline run --rm --user root app npx prisma db push
```

### Incremental Upgrade Suggestions

- It is recommended to set up a private Registry (Harbor/registry:2) on the intranet, with images transmitted by layer increment
- When upgrading versions, only update the image tag (e.g., `v0.9.1`), then execute:

```bash
docker compose -f docker-compose.offline.yml --env-file .env.offline up -d --remove-orphans
```

### Data Migration

#### Relationship Sub-Table Field Migration

If there are old `RELATION` type fields in the database, you need to run the migration script to upgrade them to `RELATION_SUBTABLE` mode:

```bash
# Preview migration (not write to database)
npx tsx scripts/migrate-relation-fields.ts --dry-run

# Execute migration
npx tsx scripts/migrate-relation-fields.ts
```

Migration content:
1. Change `RELATION` field type to `RELATION_SUBTABLE`
2. Automatically generate system reverse fields for fields missing reverse fields
3. Backfill `DataRelationRow` relationship rows from `DataRecord.data`
4. Refresh positive and negative JSONB snapshots

**Note:** Before executing, be sure to run `--dry-run` to check data integrity.

## Keyboard Shortcuts

### Navigation

| Shortcut | Function |
|----------|----------|
| Arrow keys | Move cell |
| Ctrl + Arrow keys | Jump to edge (start/end of line, start/end of row) |
| Tab / Shift+Tab | Right move / Left move |
| Space | Expand/collapse grouped row |

### Editing

| Shortcut | Function |
|----------|----------|
| Enter / F2 | Edit cell |
| Esc | Exit edit |
| Delete / Backspace | Clear cell |
| Shift+Enter | Insert new row |

### Clipboard and Operations

| Shortcut | Function |
|----------|----------|
| Ctrl+C / X / V | Copy / Cut / Paste |
| Ctrl+D | Copy row |
| Ctrl+Z / Y | Undo / Redo |

### Search and Special

| Shortcut | Function |
|----------|----------|
| Ctrl+F | Find and replace |
| Ctrl+; | Fill current date |
| Shift+Arrow keys | Extend selection |

## Template Syntax

### Simple Placeholder

Use `{{ key }}` in Word documents to mark fields that need to be replaced:

```
Contract number: {{ contractNo }}
Party A name: {{ partyA }}
Signing date: {{ signDate }}
```

### Dynamic Table Block

Dynamic tables are used to generate variable row detail tables (such as material lists, expense details, personnel lists, etc.). In Word tables, use `{{#blockName}}` and `{{/blockName}}` to mark loop areas.

#### Word Template Writing

In Word, create a table, place the start marker and end marker in separate rows, with the middle rows as template rows:

```
┌──────────┬──────────────┬──────────┐
│ 序号     │ 名称         │ 数量     │
├──────────┼──────────────┼──────────┤
│ {{#材料}} │              │          │  ← Start marker row
├──────────┼──────────────┼──────────┤
│ {{序号}}  │ {{名称}}     │ {{数量}} │  ← Template row (will be copied)
├──────────┼──────────────┼──────────┤
│ {{/材料}} │              │          │  ← End marker row
└──────────┴──────────────┴──────────┘
```

#### Rules

- **Block Name** supports Chinese, English, and underscores (e.g., `材料`, `items`, `费用明细`)
- Each block name can only appear once as a pair of `{{#name}}` / `{{/name}}` markers
- The start marker and end marker must be in the same Word table
- `{{ key }}` between the start marker and end marker will be recognized as column definitions
- Column definition keys also support Chinese

#### Multiple Table Blocks

The same template can contain multiple independent table blocks, as long as the block names are different:

```
{{#材料}} ... {{/材料}}
{{#设备}} ... {{/设备}}
```

## Architecture

```
src/
├── app/              # Route Handlers (thin wrappers)
│   ├── api/
│   ├── (auth)/       # Login page
│   └── (dashboard)/  # Main application page
├── components/
│   ├── agent2/           # AI smart assistant components
│   ├── budget/           # Budget report components
│   ├── forms/            # Dynamic form components + AI fill assistant
│   ├── templates/        # Template management components
│   ├── data/             # Main data components
│   │   ├── views/        # 5 views (Grid/Kanban/Gallery/Timeline/Form)
│   │   └── formula-editor.tsx  # Formula editor
│   └── ui/               # shadcn/ui basic components
├── lib/
│   ├── services/         # Business logic layer (ServiceResult mode)
│   ├── formula/          # Formula engine (tokenizer/AST/evaluator)
│   ├── docx-parser.ts    # DOCX placeholder parser
│   └── db.ts             # Prisma client singleton
├── modules/
│   └── reports/          # Report writing module
│       ├── components/   # Editor, AI sidebar, collaboration
│       ├── converter/    # BlockNote → report-engine format conversion
│       ├── schema/       # BlockNote custom schema
│       └── services/     # Report template/draft/export services
├── types/                # TypeScript interfaces
└── validators/           # Zod schemas

apps/
└── desktop/              # Tauri 2.0 desktop application
    ├── src/              # React frontend
    ├── src-tauri/        # Rust backend
    └── sidecar/          # Python sidecar (report-engine)

y-websocket-server/       # Collaboration WebSocket server (port 8072)
├── server.mjs            # y-websocket server (JWT authentication + LevelDB persistence)

python-service/
└── main.py               # FastAPI simple document replacement service (port 8065)

report-engine/
├── main.py               # FastAPI HTTP service (port 8066)
├── src/report_engine/    # Template-driven DOCX rendering engine
│   ├── cli.py            # CLI entry (validate/check-template/render)
│   ├── renderer.py       # Core rendering logic
│   ├── blocks.py         # Rich text block registry (headings/lists/tables/images/formulas/etc.)
│   ├── budget/           # Budget report module (Excel parsing/validation/building)
│   ├── schema.py         # Payload data model
│   ├── validator.py      # Payload validation
│   ├── template_checker.py  # Template contract checking
│   ├── template_parser.py  # Template placeholder parser
│   ├── style_checker.py  # Style checking
│   ├── converter.py      # Frontend BlockNote → report-engine conversion
│   └── subdoc.py         # Sub-document building
└── tests/                # Unit tests
```

The three-tier backend mode: `types/` → `validators/` → `services/` → API Routes.

## Documentation Index

**Online Documentation**: https://zweien.github.io/docx-template-system/

Local documentation (`docs/` directory):

- [Authentication Integration Guide](./docs/authentication.md)
- [Development and Running Guide](./docs/development.md)
- [Troubleshooting](./docs/troubleshooting.md)
- [Desktop Application Guide](./apps/desktop/README.md)

## Authentication Boundary

- `authentik` handles unified login, OIDC authorization, and logout
- `NextAuth` maps OIDC users to local Session
- Local database `User` table still retains `role`
- Page and API permission judgments still rely on local `role`

## License

MIT
