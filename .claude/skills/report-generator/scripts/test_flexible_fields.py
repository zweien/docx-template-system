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
    section = _build_section(
        data_rows, config, columns_config,
        detail_fields=detail_fields, image_columns=[]
    )

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
    section = _build_section(
        data_rows, config, columns_config,
        detail_fields=detail_fields, image_columns=[]
    )

    blocks = section["blocks"]
    assert blocks[3] == {"type": "paragraph", "text": "购置理由：[未填写]"}


def test_build_section_with_images():
    """测试有图片时正确生成 image blocks。"""
    columns_config = {"name": "名称"}
    data_rows = [
        {"name": "设备A", "__image_paths__": ["/tmp/img1.png", "/tmp/img2.png"]},
    ]
    config = {"name": "设备费", "sheet_name": "设备费"}
    section = _build_section(
        data_rows, config, columns_config,
        detail_fields=[], image_columns=["报价截图"]
    )

    blocks = section["blocks"]
    # 0: heading, 1: table, 2: heading(1. 设备A), 3: image1, 4: image2
    assert blocks[3]["type"] == "image"
    assert blocks[3]["path"] == "/tmp/img1.png"
    assert blocks[4]["type"] == "image"
    assert blocks[4]["path"] == "/tmp/img2.png"


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

    test_build_section_with_images()
    print("PASS: test_build_section_with_images")

    print("\nAll tests passed!")
