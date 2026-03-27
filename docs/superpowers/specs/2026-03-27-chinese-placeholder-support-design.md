# 占位符支持中文字符

## 背景

当前 docx 模板占位符使用 `{{\w+}}` 正则提取，`\w` 仅匹配 `[a-zA-Z0-9_]`，导致中文占位符如 `{{项目类型}}` 无法被识别。用户需要在 Word 模板中直接使用中文作为占位符键名。

## 方案

扩展 TypeScript 端正则，增加 CJK 字符范围：

```
\w+  →  [\w\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]+
```

覆盖范围：
- `\u4e00-\u9fff`：CJK 统一汉字基本区（约 20,000 字，涵盖日常中文）
- `\u3400-\u4dbf`：CJK 统一汉字扩展 A 区
- `\uf900-\ufaff`：CJK 兼容汉字区

Python 端无需改动——Python 3 的 `\w` 默认已匹配 Unicode 字符（含中文）。

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/lib/docx-parser.ts` | `matchPlaceholders` 函数的正则表达式 |
| `src/lib/utils/file-name-builder.ts` | 文件名变量替换中的占位符正则 |

## 不涉及的文件

- `python-service/main.py` — Python 3 `\w` 已支持中文，无需修改
- 数据库 — PostgreSQL 原生支持 Unicode，无需 schema 变更
- API 层、前端组件 — 仅传递和展示占位符字符串，无正则依赖

## 验证

1. 创建含 `{{项目类型}}`、`{{合同编号}}` 等中文占位符的 .docx 模板
2. 上传模板，验证解析结果包含中文键名
3. 填写表单生成文档，验证中文占位符被正确替换
