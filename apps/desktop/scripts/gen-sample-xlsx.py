"""Generate sample-budget.xlsx for desktop app download."""
from openpyxl import Workbook

wb = Workbook()

# ── Sheet 1: 汇总页 ──
ws_summary = wb.active
ws_summary.title = "汇总页"
ws_summary.append(["科目", "金额（元）"])
ws_summary.append(["设备费", 150000])
ws_summary.append(["材料费", 50000])
ws_summary.append(["测试化验加工费", 30000])
ws_summary.append(["差旅费", 20000])
ws_summary.append(["合计", "=SUM(B2:B5)"])

# ── Sheet 2: 设备费 ──
ws_equip = wb.create_sheet("设备费")
ws_equip.append(["名称", "规格", "单价", "数量", "经费", "购置理由", "测算依据", "报价截图"])
ws_equip.append([
    "高性能工作站", "CPU:i9-14900K / RAM:128GB / SSD:4TB", 35000, 2,
    "=C2*D2", "项目计算需求，需高性能计算环境", "参考市场报价，单价约35000元",
])
ws_equip.append([
    "便携式笔记本电脑", "CPU:i7-13700H / RAM:32GB / SSD:1TB", 12000, 3,
    "=C3*D3", "项目组成员外出调研使用", "参考市场报价，单价约12000元",
])
ws_equip.append([
    "打印机", "彩色激光/A3幅面/网络打印", 15000, 1,
    "=C4*D4", "项目报告打印需求", "参考市场报价，单价约15000元",
])

# Column widths
for ws in [ws_summary, ws_equip]:
    for col in ws.columns:
        ws.column_dimensions[col[0].column_letter].width = 18

out = "public/samples/sample-budget.xlsx"
wb.save(out)
print(f"Generated: {out}")
