# 模板截图功能设计

## 概述

为模板添加截图功能，支持在上传模板时添加截图，并在"我要填表"页面卡片中显示缩略图。

## 功能需求

1. 上传模板时可添加截图（可选项）
2. 支持文件选择和剪贴板粘贴两种方式
3. "我要填表"页面卡片显示缩略图，点击可放大查看
4. 模板详情页也显示截图

## 数据库设计

在 `Template` 模型添加 `screenshot` 字段：

```prisma
screenshot String?  // 截图文件路径，相对于 public/uploads
```

## 页面设计

### 1. 上传模板页面 (Step 1)

在现有文件上传区域下方添加截图上传区域：

- 虚线边框区域，支持拖拽、点击选择、Ctrl+V 粘贴
- 接受图片格式：png, jpg, jpeg, webp, gif
- 上传后显示预览缩略图
- 可点击删除已上传的截图
- 为可选项，不上传也能继续

### 2. "我要填表"页面

模板卡片布局调整：

- 卡片顶部显示截图缩略图（如有），无截图则不显示该区域
- 缩略图尺寸：宽度 100%，高度 120px，object-cover
- 点击缩略图弹出 Modal 显示大图
- Modal 支持点击外部关闭，ESC 键关闭

### 3. 模板详情页

在模板信息区域显示截图：

- 截图显示在名称/描述下方
- 点击可查看大图

## API 设计

### 上传截图

```
POST /api/templates/{id}/screenshot
Content-Type: multipart/form-data

Body: screenshot (File)

Response: { success: true, data: { path: "uploads/templates/xxx.png" } }
```

### 删除截图

```
DELETE /api/templates/{id}/screenshot
```

### 获取模板（含截图）

现有 `/api/templates/{id}` 接口已返回 Template 完整数据，包含 screenshot 字段。

## 文件存储

截图保存在 `public/uploads/templates/` 目录，文件名格式：`{templateId}_screenshot_{timestamp}.{ext}`

## 实施步骤

1. 数据库：Template 模型添加 screenshot 字段
2. 后端：新增截图上传/删除 API
3. 前端：上传模板页面添加截图上传组件
4. 前端："我要填表"页面卡片显示缩略图 + 弹窗
5. 前端：模板详情页显示截图
6. 测试验证