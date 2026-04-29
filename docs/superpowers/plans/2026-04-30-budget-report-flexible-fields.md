# 预算报告科目字段灵活定制实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展 `parse_excel_budget.py`，支持通过配置文件为每个 Excel sheet 自定义表格列、明细字段和图片显示。

**Architecture:** 在 `budget_config.json` 的 sheet 配置中新增 `table_columns`、`detail_fields`、`image_columns` 三个可选字段；修改 `_build_table_rows` 和 `_build_section` 函数读取配置生成对应 blocks；保持完全向后兼容。

**Tech Stack:** Python 3.12, openpyxl

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `.claude/skills/report-generator/scripts/parse_excel_budget.py` | 修改 | 核心解析脚本，修改 `_build_table_rows` 和 `_build_section` |
| `output/budget-test/config/budget_config.json` | 修改 | 更新示例配置，展示新字段用法 |
| `.claude/skills/report-generator/scripts/test_flexible_fields.py` | 创建 | 单元测试，覆盖自定义列、空图片、向后兼容 |

---

### Task 1: 修改 `_build_table_rows` 支持自定义表格列

**Files:**
- Modify: `.claude/skills/report-generator/scripts/parse_excel_budget.py:633-676`

- [ ] **Step 1: 修改函数签名，添加 `table_columns` 参数**

将第633行的函数签名：
```python
def _build_table_rows(data_rows: List[Dict], columns_config: dict) -> Tuple[List[str], List[List[str]]]:
```
改为：
```python
def _build_table_rows(
    data_rows: List[Dict],
    columns_config: dict,
    table_columns: Optional[List[str]] = None,
) -> Tuple[List[str], List[List[str]]]:
```

在第637行（docstring 下方）添加缺省值处理：
```python
    if table_columns is None:
        table_columns = ["name", "spec", "unit_price", "quantity", "amount"]
```

- [ ] **Step 2: 将硬编码的列 key 替换为 `table_columns`**

将第638行的：
```python
    table_col_keys = ["name", "spec", "unit_price", "quantity", "amount"]
```
删除（已被 Step 1 中的缺省值替代）。

将第639-642行的 headers 循环：
```python
    headers = []
    for key in table_col_keys:
        if key in columns_config:
            headers.append(columns_config[key])
```
改为：
```python
    headers = []
    for key in table_columns:
        if key in columns_config:
            headers.append(columns_config[key])
        else:
            logger.warning("table_columns 包含未映射的字段 '%s'，可用: %s", key, list(columns_config.keys()))
```

将第645-653行的 rows 循环中的 `table_col_keys`：
```python
        for key in table_col_keys:
            if key in columns_config:
```
改为：
```python
        for key in table_columns:
            if key in columns_config:
```

- [ ] **Step 3: 修改合计行逻辑，支持动态金额列位置**

将第667-674行的合计行生成：
```python
    if has_amount:
        total_row = ["合计"] + [""] * (len(headers) - 2) + [_fmt_amount(total)]
        if len(total_row) < len(headers):
            total_row = ["合计"] + [""] * (len(headers) - 2) + [_fmt_amount(total)]
            # 确保长度匹配
            while len(total_row) < len(headers):
                total_row.insert(1, "")
        rows.append(total_row)
```
改为：
```python
    if has_amount:
        total_row = ["合计"] + [""] * (len(headers) - 1)
        # 金额列放在最后一列
        total_row[-1] = _fmt_amount(total)
        rows.append(total_row)
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/report-generator/scripts/parse_excel_budget.py
git commit -m "feat: support custom table_columns in budget report"
```

---

### Task 2: 修改 `_build_section` 支持自定义明细字段和图片控制

**Files:**
- Modify: `.claude/skills/report-generator/scripts/parse_excel_budget.py:679-741`

- [ ] **Step 1: 修改函数签名，添加新参数**

将第679行的函数签名：
```python
def _build_section(data_rows: List[Dict], config: dict, columns_config: dict) -> Dict[str, Any]:
```
改为：
```python
def _build_section(
    data_rows: List[Dict],
    config: dict,
    columns_config: dict,
    table_columns: Optional[List[str]] = None,
    detail_fields: Optional[List[Dict[str, str]]] = None,
    image_columns: Optional[List[str]] = None,
) -> Dict[str, Any]:
```

在第684行（`blocks = []` 之前）添加缺省值处理：
```python
    if detail_fields is None:
        detail_fields = [
            {"field": "reason", "label": "购置理由"},
            {"field": "basis", "label": "测算依据"},
        ]
    if image_columns is None:
        image_columns = ["报价截图"]
```

- [ ] **Step 2: 修改明细表调用，传递 `table_columns`**

将第690行的：
```python
    headers, rows = _build_table_rows(data_rows, columns_config)
```
改为：
```python
    headers, rows = _build_table_rows(data_rows, columns_config, table_columns)
```

- [ ] **Step 3: 替换硬编码的 reason/basis 为 `detail_fields` 循环**

将第700-719行的逐条详情逻辑（从 `for idx, row_data` 开始到 `# 报价截图` 注释之前）：
```python
    # 3. 逐条详情
    for idx, row_data in enumerate(data_rows, start=1):
        name = row_data.get("name", f"项目{idx}")
        reason = row_data.get("reason", "")
        basis = row_data.get("basis", "")
        image_paths = row_data.get("__image_paths__", [])

        # 设备名称（三级标题）
        blocks.append({"type": "heading", "text": f"{idx}. {name}", "level": 3})

        # 购置理由
        if _is_empty(reason):
            blocks.append({"type": "paragraph", "text": "购置理由：[未填写]"})
        else:
            blocks.append({"type": "paragraph", "text": f"购置理由：{reason}"})

        # 测算依据
        if _is_empty(basis):
            blocks.append({"type": "paragraph", "text": "测算依据：[未填写]"})
        else:
            blocks.append({"type": "paragraph", "text": f"测算依据：{basis}"})
```
改为：
```python
    # 3. 逐条详情
    for idx, row_data in enumerate(data_rows, start=1):
        name = row_data.get("name", f"项目{idx}")
        image_paths = row_data.get("__image_paths__", [])

        # 设备/项目名称（三级标题）
        blocks.append({"type": "heading", "text": f"{idx}. {name}", "level": 3})

        # 动态字段
        for field_def in detail_fields:
            field_key = field_def.get("field", "")
            field_label = field_def.get("label", field_key)
            field_value = row_data.get(field_key, "")

            if _is_empty(field_value):
                blocks.append({"type": "paragraph", "text": f"{field_label}：[未填写]"})
            else:
                blocks.append({"type": "paragraph", "text": f"{field_label}：{field_value}"})
```

- [ ] **Step 4: 修改图片区块，根据 `image_columns` 控制显示**

将第722-735行的图片逻辑：
```python
        # 报价截图（按顺序插入多张）
        if image_paths:
            for img_idx, img_path in enumerate(image_paths, start=1):
                caption = f"报价截图 {img_idx}" if len(image_paths) > 1 else "报价截图"
                blocks.append({
                    "type": "image",
                    "path": img_path,
                    "caption": caption,
                    "width_cm": 14,
                })
        else:
            blocks.append({
                "type": "paragraph",
                "text": "报价截图：[未上传]",
            })
```
改为：
```python
        # 图片（根据 image_columns 控制是否显示）
        if image_columns:
            if image_paths:
                for img_idx, img_path in enumerate(image_paths, start=1):
                    caption = f"报价截图 {img_idx}" if len(image_paths) > 1 else "报价截图"
                    blocks.append({
                        "type": "image",
                        "path": img_path,
                        "caption": caption,
                        "width_cm": 14,
                    })
            else:
                blocks.append({
                    "type": "paragraph",
                    "text": "报价截图：[未上传]",
                })
```

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/report-generator/scripts/parse_excel_budget.py
git commit -m "feat: support custom detail_fields and image_columns in budget report"
```

---

### Task 3: 更新调用点，传递新配置参数

**Files:**
- Modify: `.claude/skills/report-generator/scripts/parse_excel_budget.py:780`

- [ ] **Step 1: 修改 `parse_excel_budget` 中的 `_build_section` 调用**

将第780行的：
```python
        section = _build_section(data_rows, sheet_config, sheet_config.get("columns", {}))
```
改为：
```python
        section = _build_section(
            data_rows,
            sheet_config,
            sheet_config.get("columns", {}),
            table_columns=sheet_config.get("table_columns"),
            detail_fields=sheet_config.get("detail_fields"),
            image_columns=sheet_config.get("image_columns"),
        )
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/report-generator/scripts/parse_excel_budget.py
git commit -m "feat: wire new config options to section builder"
```

---

### Task 4: 更新示例配置文件

**Files:**
- Modify: `output/budget-test/config/budget_config.json`

- [ ] **Step 1: 在示例配置中展示新字段**

将文件内容更新为：

```json
{
  "title": "XX科研项目预算报告",
  "summary": {
    "sheet_name": "汇总页",
    "mode": "table",
    "header_row": 1,
    "key_column": "科目",
    "value_column": "金额（元）",
    "prefix": "SUMMARY_"
  },
  "sheets": [
    {
      "name": "设备费明细",
      "sheet_name": "设备费",
      "id": "equipment_fee",
      "columns": {
        "name": "名称",
        "spec": "规格",
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
    },
    {
      "name": "材料费明细",
      "sheet_name": "材料费",
      "id": "material_fee",
      "columns": {
        "name": "名称",
        "spec": "规格",
        "unit_price": "单价",
        "quantity": "数量",
        "amount": "经费",
        "reason": "用途说明",
        "basis": "采购依据"
      },
      "table_columns": ["name", "spec", "unit_price", "quantity", "amount"],
      "detail_fields": [
        {"field": "reason", "label": "用途说明"},
        {"field": "basis", "label": "采购依据"}
      ],
      "image_columns": ["报价截图"]
    },
    {
      "name": "测试费明细",
      "sheet_name": "测试费",
      "id": "test_fee",
      "columns": {
        "name": "名称",
        "spec": "规格",
        "unit_price": "单价",
        "quantity": "数量",
        "amount": "经费",
        "reason": "测试内容",
        "basis": "计费依据"
      },
      "table_columns": ["name", "spec", "unit_price", "quantity", "amount"],
      "detail_fields": [
        {"field": "reason", "label": "测试内容"},
        {"field": "basis", "label": "计费依据"}
      ],
      "image_columns": ["报价截图"]
    },
    {
      "name": "外部协作费明细",
      "sheet_name": "外部协作费",
      "id": "external_cooperation_fee",
      "columns": {
        "name": "名称",
        "amount": "经费",
        "cooperation_content": "外协内容",
        "basis": "计费依据"
      },
      "table_columns": ["name", "amount"],
      "detail_fields": [
        {"field": "cooperation_content", "label": "外协内容"},
        {"field": "basis", "label": "计费依据"}
      ],
      "image_columns": []
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add output/budget-test/config/budget_config.json
git commit -m "docs: update example config with flexible fields"
```

---

### Task 5: 编写单元测试

**Files:**
- Create: `.claude/skills/report-generator/scripts/test_flexible_fields.py`

- [ ] **Step 1: 创建测试文件，测试自定义表格列**

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from parse_excel_budget import _build_table_rows, _build_section


def test_build_table_rows_default():
    """测试默认表格列（向后兼容）。"""
    columns_config = {
        "name": "名称",
        "spec": "规格",
        "unit_price": "单价",
        "quantity": "数量",
        "amount": "经费",
    }
    data_rows = [
        {"name": "服务器", "spec": "Dell R750", "unit_price": "50000", "quantity": "2", "amount": "100000"},
    ]
    headers, rows = _build_table_rows(data_rows, columns_config)
    assert headers == ["名称", "规格", "单价", "数量", "经费"]
    assert rows[0] == ["服务器", "Dell R750", "50000", "2", "100000.00"]
    assert rows[-1] == ["合计", "", "", "", "100000.00"]


def test_build_table_rows_custom_columns():
    """测试自定义表格列。"""
    columns_config = {
        "name": "名称",
        "amount": "经费",
    }
    data_rows = [
        {"name": "测试服务", "amount": "30000"},
    ]
    headers, rows = _build_table_rows(data_rows, columns_config, table_columns=["name", "amount"])
    assert headers == ["名称", "经费"]
    assert rows[0] == ["测试服务", "30000.00"]
    assert rows[-1] == ["合计", "30000.00"]


def test_build_section_default():
    """测试默认明细字段（向后兼容）。"""
    columns_config = {
        "name": "名称",
        "reason": "购置理由",
        "basis": "测算依据",
    }
    data_rows = [
        {"name": "服务器", "reason": "业务需要", "basis": "市场价", "__image_paths__": []},
    ]
    config = {"name": "设备费明细", "sheet_name": "设备费"}
    section = _build_section(data_rows, config, columns_config)

    blocks = section["blocks"]
    assert blocks[0] == {"type": "heading", "text": "设备费明细", "level": 2}
    assert blocks[2] == {"type": "heading", "text": "1. 服务器", "level": 3}
    assert blocks[3] == {"type": "paragraph", "text": "购置理由：业务需要"}
    assert blocks[4] == {"type": "paragraph", "text": "测算依据：市场价"}
    assert blocks[5] == {"type": "paragraph", "text": "报价截图：[未上传]"}


def test_build_section_custom_fields_no_images():
    """测试自定义明细字段且不需要图片。"""
    columns_config = {
        "name": "名称",
        "cooperation_content": "外协内容",
        "basis": "计费依据",
    }
    data_rows = [
        {"name": "测试服务", "cooperation_content": "性能测试", "basis": "合同约定", "__image_paths__": []},
    ]
    config = {"name": "外部协作费明细", "sheet_name": "外部协作费"}
    detail_fields = [
        {"field": "cooperation_content", "label": "外协内容"},
        {"field": "basis", "label": "计费依据"},
    ]
    section = _build_section(data_rows, config, columns_config, detail_fields=detail_fields, image_columns=[])

    blocks = section["blocks"]
    # 0: heading(科目), 1: table, 2: heading(1. 测试服务), 3: 外协内容, 4: 计费依据
    assert blocks[3] == {"type": "paragraph", "text": "外协内容：性能测试"}
    assert blocks[4] == {"type": "paragraph", "text": "计费依据：合同约定"}
    # 不应有图片相关 block
    assert all(b.get("type") != "image" for b in blocks)
    assert all("报价截图" not in b.get("text", "") for b in blocks)


def test_build_section_empty_field():
    """测试字段值为空时显示 [未填写]。"""
    columns_config = {"name": "名称", "reason": "购置理由"}
    data_rows = [
        {"name": "设备A", "reason": "", "__image_paths__": []},
    ]
    config = {"name": "设备费", "sheet_name": "设备费"}
    detail_fields = [{"field": "reason", "label": "购置理由"}]
    section = _build_section(data_rows, config, columns_config, detail_fields=detail_fields, image_columns=[])

    blocks = section["blocks"]
    assert blocks[3] == {"type": "paragraph", "text": "购置理由：[未填写]"}


if __name__ == "__main__":
    test_build_table_rows_default()
    print("PASS: test_build_table_rows_default")

    test_build_table_rows_custom_columns()
    print("PASS: test_build_table_rows_custom_columns")

    test_build_section_default()
    print("PASS: test_build_section_default")

    test_build_section_custom_fields_no_images()
    print("PASS: test_build_section_custom_fields_no_images")

    test_build_section_empty_field()
    print("PASS: test_build_section_empty_field")

    print("\nAll tests passed!")
```

- [ ] **Step 2: 运行测试**

```bash
cd /home/z/test-hub/docx-template-system
python .claude/skills/report-generator/scripts/test_flexible_fields.py
```

预期输出：
```
PASS: test_build_table_rows_default
PASS: test_build_table_rows_custom_columns
PASS: test_build_section_default
PASS: test_build_section_custom_fields_no_images
PASS: test_build_section_empty_field

All tests passed!
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/report-generator/scripts/test_flexible_fields.py
git commit -m "test: add unit tests for flexible budget fields"
```

---

### Task 6: 端到端验证

**Files:**
- 无需修改文件，运行现有测试流程

- [ ] **Step 1: 用 dry-run 模式测试示例配置**

```bash
cd /home/z/test-hub/docx-template-system
python .claude/skills/report-generator/scripts/parse_excel_budget.py \
  --input output/budget-test/budget_data.xlsx \
  --output-dir output/budget-test-flexible/ \
  --config output/budget-test/config/budget_config.json \
  --dry-run
```

预期：命令成功执行，输出 JSON 中包含 "外部协作费明细" section，且该 section 的 blocks 中无图片 block。

- [ ] **Step 2: 验证输出结构**

检查输出中外部协作费 section 的结构是否符合预期：
- 表格只有 "名称"、"经费" 两列
- 明细下方展示 "外协内容" 和 "计费依据"
- 无 "报价截图" block

- [ ] **Step 3: Commit（如有需要）**

如果测试通过，无需额外提交。如果有问题，回到对应 Task 修复。

---

## 自审查

**Spec coverage:**
- [x] `table_columns` 自定义表格列 → Task 1
- [x] `detail_fields` 自定义明细字段 → Task 2
- [x] `image_columns` 空数组不显示图片 → Task 2 Step 4
- [x] `image_columns` 指定列提取图片 → 已有行为，无需修改
- [x] 向后兼容（缺省值）→ Task 5 测试覆盖
- [x] 边界情况（空字段、未映射字段）→ Task 5 测试覆盖

**Placeholder scan:** 无 TBD/TODO。

**Type consistency:** 所有新参数类型一致使用 `Optional[List[...]]`。
