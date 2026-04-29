#!/usr/bin/env python3
"""生成图表（柱状图、折线图、饼图、散点图）。

用法:
    python generate_chart.py --type bar --title "项目进度" \
      --data '{"labels":["Q1","Q2","Q3","Q4"],"values":[25,50,75,100]}' \
      --output figures/progress.png

    python generate_chart.py --type pie --title "资源分配" \
      --data '{"labels":["人力","设备","材料"],"values":[40,35,25]}' \
      --output figures/allocation.png
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.font_manager as fm
except ImportError:
    print("错误: 需要安装 matplotlib。运行: pip install matplotlib", file=sys.stderr)
    sys.exit(1)


# 尝试使用中文字体
def setup_chinese_font():
    """设置中文字体。"""
    # 直接使用系统已安装的中文字体路径
    import os
    font_paths = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
        "/usr/share/fonts/truetype/arphic/uming.ttc",
    ]
    for font_path in font_paths:
        if os.path.exists(font_path):
            fm.fontManager.addfont(font_path)
            prop = fm.FontProperties(fname=font_path)
            font_name = prop.get_name()
            plt.rcParams["font.sans-serif"] = [font_name] + plt.rcParams["font.sans-serif"]
            plt.rcParams["axes.unicode_minus"] = False
            return
    # 回退：尝试按名称查找
    for font_name in ["Noto Sans CJK SC", "AR PL UMing TW MBE", "WenQuanYi Micro Hei"]:
        try:
            fm.findfont(font_name, fallback_to_default=False)
            plt.rcParams["font.sans-serif"] = [font_name] + plt.rcParams["font.sans-serif"]
            plt.rcParams["axes.unicode_minus"] = False
            return
        except Exception:
            continue
    plt.rcParams["axes.unicode_minus"] = False


def generate_bar(data: dict, title: str, output: str):
    """生成柱状图。"""
    fig, ax = plt.subplots(figsize=(10, 6))
    labels = data["labels"]
    values = data["values"]
    colors = data.get("colors", plt.cm.Set3.colors[:len(labels)])

    bars = ax.bar(labels, values, color=colors)
    ax.set_title(title, fontsize=14, fontweight="bold")
    ax.set_ylabel(data.get("ylabel", ""))

    # 在柱子上显示数值
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max(values) * 0.02,
                str(val), ha="center", va="bottom", fontsize=10)

    plt.tight_layout()
    plt.savefig(output, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"柱状图已生成: {output}")


def generate_line(data: dict, title: str, output: str):
    """生成折线图。"""
    fig, ax = plt.subplots(figsize=(10, 6))
    labels = data["labels"]
    values = data["values"]

    ax.plot(labels, values, "o-", linewidth=2, markersize=8)
    ax.set_title(title, fontsize=14, fontweight="bold")
    ax.set_ylabel(data.get("ylabel", ""))
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(output, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"折线图已生成: {output}")


def generate_pie(data: dict, title: str, output: str):
    """生成饼图。"""
    fig, ax = plt.subplots(figsize=(8, 8))
    labels = data["labels"]
    values = data["values"]
    colors = data.get("colors", plt.cm.Set3.colors[:len(labels)])

    wedges, texts, autotexts = ax.pie(values, labels=labels, colors=colors,
                                       autopct="%1.1f%%", startangle=90)
    ax.set_title(title, fontsize=14, fontweight="bold")

    plt.tight_layout()
    plt.savefig(output, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"饼图已生成: {output}")


def generate_scatter(data: dict, title: str, output: str):
    """生成散点图。"""
    fig, ax = plt.subplots(figsize=(10, 6))
    x = data["x"]
    y = data["y"]

    ax.scatter(x, y, s=100, alpha=0.6)
    ax.set_title(title, fontsize=14, fontweight="bold")
    ax.set_xlabel(data.get("xlabel", ""))
    ax.set_ylabel(data.get("ylabel", ""))
    ax.grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(output, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"散点图已生成: {output}")


CHART_TYPES = {
    "bar": generate_bar,
    "line": generate_line,
    "pie": generate_pie,
    "scatter": generate_scatter,
}


def main():
    parser = argparse.ArgumentParser(description="生成图表")
    parser.add_argument("--type", required=True, choices=CHART_TYPES.keys(),
                        help="图表类型: bar, line, pie, scatter")
    parser.add_argument("--title", required=True, help="图表标题")
    parser.add_argument("--data", required=True, help="数据 JSON 字符串")
    parser.add_argument("--output", required=True, help="输出图片路径")
    args = parser.parse_args()

    setup_chinese_font()

    data = json.loads(args.data)
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    CHART_TYPES[args.type](data, args.title, args.output)


if __name__ == "__main__":
    main()
