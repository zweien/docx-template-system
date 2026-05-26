# 数据表导出/导入附件支持设计

## 背景

当前系统的数据表导出（Excel/JSON/SQL/Bundle）和备份功能仅导出数据库记录，FILE 类型字段只包含文件路径字符串。当用户进行数据迁移或备份恢复时，附件文件不会被一并处理，导致恢复后的记录中 FILE 字段指向不存在的文件。

## 目标

- Bundle 导出时，将附件文件一并打包到 ZIP 中
- 管理员备份/恢复时，附件随数据一起备份和恢复
- 恢复时支持跨环境路径映射（不同服务器的 UPLOAD_DIR 配置可能不同）
- Excel/SQL 导出保持现状（轻量数据交换，不携带附件）

## 方案概述

采用 **ZIP 附件平铺方案**：
- 导出时生成 ZIP，内含 `data.json` + `attachments/` 目录
- `attachments/` 下按原存储路径平铺存放附件文件
- 恢复时解压 ZIP，将附件复制到当前环境的 `UPLOAD_DIR`，并重写 FILE 字段的路径值

## ZIP 文件结构

```
backup_2025-01-15T08-30-00.zip
├── data.json              # 导出的数据（原备份/Bundle JSON）
└── attachments/
    ├── uploads/
    │   └── files/
    │       ├── a1b2c3d4.pdf
    │       ├── e5f6g7h8.png
    │       └── ...
    └── .data/
        └── uploads/
            └── collections/
                └── ...    # 文档收集模块的私有附件
```

### data.json metadata 格式

```json
{
  "version": "2.0",
  "exportedAt": "2025-01-15T08:30:00.000Z",
  "attachments": {
    "pathMapping": {
      "/uploads/files/a1b2c3d4.pdf": "attachments/uploads/files/a1b2c3d4.pdf",
      "/uploads/files/e5f6g7h8.png": "attachments/uploads/files/e5f6g7h8.png"
    },
    "originalUploadDir": "public/uploads"
  },
  "tables": { ... }
}
```

**字段说明：**
- `attachments.pathMapping`：原 FILE 字段值 → ZIP 内相对路径的映射
- `attachments.originalUploadDir`：导出时的 UPLOAD_DIR，用于恢复时计算路径重写规则

## 导出流程

### 核心步骤

1. **获取数据**：复用现有 `exportBundle()` 或 `runBackup()` 获取数据
2. **扫描 FILE 字段**：遍历所有记录，收集 FILE 类型字段的值（文件路径）
3. **构建 pathMapping**：将每个文件路径映射到 ZIP 内的相对路径
4. **注入 metadata**：将 `attachments` 信息写入 data.json
5. **打包 ZIP**：使用 JSZip 将 data.json 和所有附件文件打包

### 附件缺失处理

如果 FILE 字段引用的文件不存在（已被手动删除）：
- 仅记录警告，不阻断导出
- 该附件不包含在 ZIP 中
- 恢复时该 FILE 字段置为空值

### 文件命名安全

当前系统已使用 `randomUUID()` 生成唯一文件名，恢复时直接覆盖同名文件不会破坏其他数据。

## 恢复流程

### 核心步骤

1. **解压 ZIP**：读取 `data.json` 和附件列表
2. **恢复附件**：
   - 读取 `originalUploadDir` 和当前 `UPLOAD_DIR`
   - 计算路径重写规则（替换路径前缀）
   - 将附件从 ZIP 复制到当前环境的对应目录
3. **重写 FILE 字段**：遍历所有记录，将 FILE 字段中的旧路径前缀替换为新路径前缀
4. **恢复记录**：复用现有 `restoreBackup()` 或 `importBundle()` 逻辑插入记录

### 路径重写示例

| 场景 | originalUploadDir | 当前 UPLOAD_DIR | 原路径 | 新路径 |
|------|-------------------|-----------------|--------|--------|
| 同环境 | `public/uploads` | `public/uploads` | `/uploads/files/xxx.pdf` | `/uploads/files/xxx.pdf` |
| 跨环境 | `public/uploads` | `/data/files` | `/uploads/files/xxx.pdf` | `/data/files/xxx.pdf` |

### 跨版本兼容

旧备份文件（无 `attachments` 字段）恢复时：
- 保持现有行为，仅恢复记录数据
- 不报错，向后兼容

## API 变更

### Bundle 导出

`GET /api/data-tables/[id]/export`

- **响应格式**：`application/zip`（原 `application/json`）
- **文件名**：`Content-Disposition: attachment; filename="bundle_{tableName}_{timestamp}.zip"`

### 备份列表/创建

`GET /api/admin/data-tables/backup` — 无变更（列表显示 `.zip` 文件）

`POST /api/admin/data-tables/backup` — 生成 `.zip` 文件

### 备份下载

`GET /api/admin/data-tables/backup/[filename]`

- 返回 `.zip` 文件（原 `.json`）

### 备份恢复

`PUT /api/admin/data-tables/backup`

- **模式 A（保持）**：`{ filename: "backup_xxx.zip" }` — 从备份目录读取 ZIP
- **模式 B（新增）**：支持 `multipart/form-data` 直接上传 ZIP 文件恢复

### Bundle 导入

`POST /api/data-tables/import`

- 接收 ZIP 文件（`multipart/form-data`），先解压再导入

## UI 变更

### 备份配置页面 (BackupConfig)

- **下载备份**：下载 `.zip` 文件
- **恢复备份**：
  - 保留从服务器备份列表恢复
  - 新增"上传备份文件"按钮，支持本机选择 ZIP 恢复
- **立即备份**：生成 `.zip` 文件

### 数据表导出

- Bundle 导出选项下载 `.zip` 文件

## 依赖

- `jszip`：ZIP 打包/解压

## 测试要点

1. 包含 FILE 字段的数据表 Bundle 导出，ZIP 中附件完整
2. 备份导出 ZIP，附件完整
3. 同环境恢复，FILE 字段路径正确，文件可访问
4. 跨环境恢复（不同 UPLOAD_DIR），FILE 字段路径正确重写
5. 旧备份（无 attachments）恢复，保持现有行为
6. 附件缺失场景（文件被删除），导出不报错，恢复时字段置空
