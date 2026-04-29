# 预算报告科目字段灵活定制设计

## 背景

当前 `parse_excel_budget.py` 的科目展示逻辑是硬编码的：
- 汇总表格固定为 `名称/规格/单价/数量/经费` 五列
- 每个明细条目固定展示 `购置理由 → 测算依据 → 报价截图`

这无法满足不同科目的差异化需求，例如：
- 设备费有规格型号、购置理由、测算依据、报价截图
- 外部协作费有外协内容、计费依据，不需要报价截图
- 材料费可能有用途说明、采购依据

## 目标

通过扩展 `budget_config.json` 配置格式，让每个 sheet 可以独立声明：
1. 汇总表格显示哪些字段
2. 明细条目展示哪些字段
3. 是否需要展示图片

## 方案：配置声明式扩展

### 配置格式扩展

在原有配置基础上，每个 sheet 新增三个可选字段：

```json
{
  "name": "设备费明细",
  "sheet_name": "设备费",
  "id": "equipment_fee",
  "columns": {
    "name": "名称",
    "spec": "规格型号",
    "unit_price": "单价",
    "quantity": "数量",
    "amount": "经费",
    "reason": "购置理由",
    "basis": "测算依据"
  },
  "table_columns": ["name", "spec", "unit_price", "quantity", "amount"],
  "detail_fields": [
    {"field": "reason", "label": "购置理由"},
    {"field": "basis", "label": "测算依据"}
  ],
  "image_columns": ["报价截图"]
}
```

字段说明：

| 字段 | 必填 | 说明 |
|------|------|------|
| `columns` | 是 | Excel 列名与字段 key 的映射（已有） |
| `table_columns` | 否 | 汇总表格显示的字段 key 列表，按顺序排列。缺省值：`["name", "spec", "unit_price", "quantity", "amount"]` |
| `detail_fields` | 否 | 每个明细条目下方展示的字段列表。缺省值：`[{"field":"reason","label":"购置理由"}, {"field":"basis","label":"测算依据"}]` |
| `image_columns` | 否 | 标识哪些列包含图片。设为空数组 `[]` 则不显示图片区块。缺省值：`["报价截图"]` |

### 不同科目的配置示例

**设备费**（规格齐全，需要截图）：

```json
{
  "name": "设备费明细",
  "sheet_name": "设备费",
  "table_columns": ["name", "spec", "unit_price", "quantity", "amount"],
  "detail_fields": [
    {"field": "reason", "label": "购置理由"},
    {"field": "basis", "label": "测算依据"}
  ],
  "image_columns": ["报价截图"]
}
```

**外部协作费**（无外协规格，不需要截图）：

```json
{
  "name": "外部协作费明细",
  "sheet_name": "外部协作费",
  "table_columns": ["name", "amount"],
  "detail_fields": [
    {"field": "cooperation_content", "label": "外协内容"},
    {"field": "basis", "label": "计费依据"}
  ],
  "image_columns": []
}
```

**材料费**（有规格，截图可选）：

```json
{
  "name": "材料费明细",
  "sheet_name": "材料费",
  "table_columns": ["name", "spec", "unit_price", "quantity", "amount"],
  "detail_fields": [
    {"field": "reason", "label": "用途说明"},
    {"field": "basis", "label": "采购依据"}
  ],
  "image_columns": ["报价截图"]
}
```

### 图片提取行为

`image_columns` 支持三种配置方式：

| 配置值 | 行为 |
|--------|------|
| `[]`（空数组） | 不提取图片，不生成图片相关 block |
| `["报价截图"]` | 从指定列名提取图片，同时收集该行其他列的图片（合并去重） |
| `["*"]` | 收集该行所有图片（不指定具体列） |

核心规则：**属于该数据行的所有图片**（无论位于哪一列）都归属于该明细条目。指定 `image_columns` 列名用于：
1. 精准定位：图片分散在多列时，通过列名确保正确关联
2. 辅助收集：除指定列外，该行其他列的图片也一并收集
3. 开关控制：空数组表示该 sheet 不展示图片

### 向后兼容

缺少新字段时，自动使用旧行为缺省值：
- 无 `table_columns` → 使用 `["name", "spec", "unit_price", "quantity", "amount"]`
- 无 `detail_fields` → 使用 `reason` + `basis`
- 无 `image_columns` → 使用 `["报价截图"]`

现有配置文件无需任何修改即可继续工作。

## 代码改动范围

仅修改 `parse_excel_budget.py` 中的两个函数：

1. **`_build_table_rows()`**
   - 接收 `table_columns` 参数
   - 按 `table_columns` 顺序生成表格列
   - 合计行金额列位置自适应

2. **`_build_section()`**
   - 接收 `detail_fields` 和 `image_columns` 参数
   - 按 `detail_fields` 顺序生成段落 block
   - 根据 `image_columns` 是否为空决定是否生成图片/占位 block
   - 图片 block 仍然使用 `__image_paths__`（已包含该行所有图片）

## 边界情况处理

| 场景 | 行为 |
|------|------|
| `table_columns` 包含 `columns` 中未映射的字段 | 跳过该字段，日志警告 |
| `detail_fields` 中的 `field` 在 `columns` 中不存在 | 生成空值段落，日志警告 |
| 某行 `detail_fields` 中的字段值为空 | 生成 `"label：[未填写]"` 段落 |
| `image_columns` 为空但行中有图片 | 图片不展示（不生成图片 block） |
| `image_columns` 非空但行中无图片 | 生成 `"报价截图：[未上传]"` 段落 |
| `detail_fields` 设为空数组 `[]` | 不生成任何字段段落，直接展示图片（如有） |

## 输出结构变化

生成的简化内容描述（`content.json`）结构不变，仍然是 `sections[].blocks[]` 格式，只是 blocks 的内容随配置变化。

例如外部协作费的 section blocks：

```json
{
  "name": "外部协作费明细",
  "id": "external_cooperation_fee",
  "blocks": [
    {"type": "heading", "text": "外部协作费明细", "level": 2},
    {"type": "table", "title": "表1 外部协作费明细一览", "headers": ["名称", "经费"], "rows": [...]},
    {"type": "heading", "text": "1. XX测试服务", "level": 3},
    {"type": "paragraph", "text": "外协内容：委托XX单位完成性能测试..."},
    {"type": "paragraph", "text": "计费依据：按合同约定，单价XX元/次..."}
  ]
}
```

（无图片 block，因为 `image_columns` 为空）
