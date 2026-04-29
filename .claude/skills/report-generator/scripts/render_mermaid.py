#!/usr/bin/env python3
"""渲染 Mermaid 图表为 PNG 图片。

用法:
    python render_mermaid.py --input diagram.mmd --output figures/diagram.png
    python render_mermaid.py --code "graph TD; A-->B; B-->C;" --output figures/diagram.png

依赖:
    npm install -g @mermaid-js/mermaid-cli
    或使用在线 API（默认）
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path


def render_via_api(mermaid_code: str, output: str) -> bool:
    """通过 mermaid.ink API 渲染（无需本地安装）。"""
    import base64
    encoded = base64.urlsafe_b64encode(mermaid_code.encode()).decode()
    url = f"https://mermaid.ink/img/{encoded}"

    try:
        urllib.request.urlretrieve(url, output)
        print(f"Mermaid 图已生成: {output}")
        return True
    except Exception as e:
        print(f"API 渲染失败: {e}", file=sys.stderr)
        return False


def render_via_cli(mermaid_code: str, output: str) -> bool:
    """通过本地 mermaid-cli 渲染。"""
    import subprocess
    import tempfile

    with tempfile.NamedTemporaryFile(mode="w", suffix=".mmd", delete=False) as f:
        f.write(mermaid_code)
        input_file = f.name

    try:
        result = subprocess.run(
            ["mmdc", "-i", input_file, "-o", output, "-b", "transparent"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            print(f"Mermaid 图已生成: {output}")
            return True
        else:
            print(f"CLI 渲染失败: {result.stderr}", file=sys.stderr)
            return False
    except FileNotFoundError:
        print("mmdc 未安装，尝试使用在线 API", file=sys.stderr)
        return False
    except Exception as e:
        print(f"CLI 渲染失败: {e}", file=sys.stderr)
        return False
    finally:
        Path(input_file).unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="渲染 Mermaid 图表")
    parser.add_argument("--input", help="Mermaid 文件路径 (.mmd)")
    parser.add_argument("--code", help="Mermaid 代码字符串")
    parser.add_argument("--output", required=True, help="输出图片路径")
    parser.add_argument("--api", action="store_true", default=True,
                        help="使用在线 API（默认）")
    parser.add_argument("--cli", action="store_true",
                        help="使用本地 mermaid-cli")
    args = parser.parse_args()

    if args.input:
        mermaid_code = Path(args.input).read_text(encoding="utf-8")
    elif args.code:
        mermaid_code = args.code
    else:
        parser.error("需要 --input 或 --code 参数")

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)

    if args.cli:
        success = render_via_cli(mermaid_code, args.output)
        if not success:
            print("回退到在线 API...")
            render_via_api(mermaid_code, args.output)
    else:
        render_via_api(mermaid_code, args.output)


if __name__ == "__main__":
    main()
