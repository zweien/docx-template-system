import unittest
import sys
import types

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

fastapi_stub = types.ModuleType("fastapi")


class _FastAPI:
    def __init__(self, *args, **kwargs):
        pass

    def get(self, *args, **kwargs):
        def decorator(func):
            return func
        return decorator

    def post(self, *args, **kwargs):
        def decorator(func):
            return func
        return decorator


class _HTTPException(Exception):
    pass


fastapi_stub.FastAPI = _FastAPI
fastapi_stub.HTTPException = _HTTPException
sys.modules.setdefault("fastapi", fastapi_stub)

responses_stub = types.ModuleType("fastapi.responses")
responses_stub.FileResponse = object
sys.modules.setdefault("fastapi.responses", responses_stub)

pydantic_stub = types.ModuleType("pydantic")


class _BaseModel:
    pass


pydantic_stub.BaseModel = _BaseModel
sys.modules.setdefault("pydantic", pydantic_stub)

from main import process_table_block


def set_vertical_merge(cell, value: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    v_merge = OxmlElement("w:vMerge")
    v_merge.set(qn("w:val"), value)
    tc_pr.append(v_merge)


def get_vertical_merge_from_row(row, cell_index: int = 0) -> str | None:
    tc_pr = row._tr.tc_lst[cell_index].tcPr
    if tc_pr is None or tc_pr.vMerge is None:
        return None
    return tc_pr.vMerge.val or "continue-empty"


class ProcessTableBlockTest(unittest.TestCase):
    def test_inserts_rows_before_following_section_and_preserves_merge_chain(self) -> None:
        doc = Document()
        table = doc.add_table(rows=5, cols=2)

        table.cell(0, 0).text = "左侧合并标题"
        table.cell(0, 1).text = "表头"
        set_vertical_merge(table.cell(0, 0), "restart")

        table.cell(1, 0).text = ""
        table.cell(1, 1).text = "{{#工作计划及完成情况}}"
        set_vertical_merge(table.cell(1, 0), "continue")

        table.cell(2, 0).text = ""
        table.cell(2, 1).text = "{{计划任务}}"
        set_vertical_merge(table.cell(2, 0), "continue")

        table.cell(3, 0).text = ""
        table.cell(3, 1).text = "{{/工作计划及完成情况}}"
        set_vertical_merge(table.cell(3, 0), "continue")

        table.cell(4, 0).text = "下一节"
        table.cell(4, 1).text = "后续内容"

        process_table_block(
            table,
            "工作计划及完成情况",
            [{"计划任务": "第一行"}, {"计划任务": "第二行"}],
            {},
        )

        self.assertEqual(len(table.rows), 4)
        self.assertEqual(table.rows[0].cells[1].text, "表头")
        self.assertEqual(table.rows[1].cells[1].text, "第一行")
        self.assertEqual(table.rows[2].cells[1].text, "第二行")
        self.assertEqual(table.rows[3].cells[0].text, "下一节")

        self.assertEqual(get_vertical_merge_from_row(table.rows[0]), "restart")
        self.assertEqual(get_vertical_merge_from_row(table.rows[1]), "continue")
        self.assertEqual(get_vertical_merge_from_row(table.rows[2]), "continue")
        self.assertIsNone(get_vertical_merge_from_row(table.rows[3]))


if __name__ == "__main__":
    unittest.main()
