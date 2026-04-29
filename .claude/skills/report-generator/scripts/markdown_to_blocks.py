#!/usr/bin/env python3
"""将 Markdown 文本转换为 report-engine 的 blocks 数组。

用法:
    from markdown_to_blocks import markdown_to_blocks

    blocks = markdown_to_blocks("# 标题\n\n这是一段文字\n\n- 列表项1\n- 列表项2")
    # => [{"type": "heading", "text": "标题", "level": 1}, ...]
"""

import re
from typing import Any, Dict, List


def _parse_inline_formatting(text: str) -> List[Dict[str, Any]]:
    """解析行内格式（粗体、斜体），返回 rich_paragraph 的 segments。"""
    segments = []
    # 匹配 **bold**, *italic*, _italic_
    pattern = r'(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)'
    last_end = 0

    for match in re.finditer(pattern, text):
        # 添加前面的普通文本
        if match.start() > last_end:
            segments.append({"text": text[last_end:match.start()]})

        raw = match.group(0)
        if raw.startswith('**'):
            segments.append({"text": match.group(2), "bold": True})
        elif raw.startswith('*'):
            segments.append({"text": match.group(3), "italic": True})
        elif raw.startswith('_'):
            segments.append({"text": match.group(4), "italic": True})

        last_end = match.end()

    if last_end < len(text):
        segments.append({"text": text[last_end:]})

    if not segments:
        segments.append({"text": text})

    return segments


def markdown_to_blocks(markdown: str) -> List[Dict[str, Any]]:
    """将 Markdown 文本转换为 report-engine blocks 数组。"""
    blocks = []
    lines = markdown.split('\n')
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # 标题: # ## ### #### #####
        heading_match = re.match(r'^(#{1,5})\s+(.+)$', stripped)
        if heading_match:
            level = len(heading_match.group(1))
            text = heading_match.group(2).strip()
            blocks.append({"type": "heading", "text": text, "level": min(level, 5)})
            i += 1
            continue

        # 分隔线: ---, ***, ___
        if re.match(r'^([-*_])\1{2,}$', stripped):
            blocks.append({"type": "horizontal_rule"})
            i += 1
            continue

        # 引用: > text
        if stripped.startswith('>'):
            quote_text = stripped[1:].strip()
            blocks.append({"type": "quote", "text": quote_text})
            i += 1
            continue

        # 表格
        if '|' in stripped and i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            if re.match(r'^\|?[-:|\s]+\|?$', next_line):
                # 开始解析表格
                headers = [c.strip() for c in stripped.split('|') if c.strip()]
                i += 2  # 跳过表头行和分隔行
                rows = []
                while i < len(lines) and '|' in lines[i]:
                    row_text = lines[i].strip()
                    if not row_text:
                        break
                    cells = [c.strip() for c in row_text.split('|') if c.strip()]
                    if cells:
                        rows.append(cells)
                    i += 1
                blocks.append({
                    "type": "table",
                    "headers": headers,
                    "rows": rows,
                })
                continue

        # 有序列表: 1. text
        ordered_match = re.match(r'^(\d+)\.\s+(.+)$', stripped)
        if ordered_match:
            items = []
            while i < len(lines):
                ol_match = re.match(r'^(\d+)\.\s+(.+)$', lines[i].strip())
                if not ol_match:
                    break
                items.append(ol_match.group(2).strip())
                i += 1
            blocks.append({"type": "numbered_list", "items": items})
            continue

        # 代码块: ```lang ... ```
        if stripped.startswith('```'):
            lang = stripped[3:].strip() or "text"
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith('```'):
                code_lines.append(lines[i])
                i += 1
            i += 1  # 跳过 ```
            code = '\n'.join(code_lines).strip()
            if lang.lower() == 'mermaid':
                blocks.append({"type": "mermaid", "code": code})
            else:
                blocks.append({"type": "code_block", "code": code, "language": lang})
            continue

        # 无序列表: - text, * text
        if re.match(r'^[-*+]\s+', stripped):
            items = []
            while i < len(lines):
                ul_match = re.match(r'^[-*+]\s+(.+)$', lines[i].strip())
                if not ul_match:
                    break
                items.append(ul_match.group(1).strip())
                i += 1
            blocks.append({"type": "bullet_list", "items": items})
            continue

        # 检查多行段落（下一个非空行不是特殊格式）
        para_lines = [stripped]
        i += 1
        while i < len(lines):
            next_stripped = lines[i].strip()
            if not next_stripped:
                break
            # 如果下一行是特殊格式，结束段落
            if (re.match(r'^#{1,5}\s', next_stripped) or
                re.match(r'^[-*+]\s+', next_stripped) or
                re.match(r'^\d+\.\s+', next_stripped) or
                next_stripped.startswith('>') or
                re.match(r'^([-*_])\1{2,}$', next_stripped) or
                ('|' in next_stripped and i + 1 < len(lines) and
                 re.match(r'^\|?[-:|\s]+\|?$', lines[i + 1].strip()))):
                break
            para_lines.append(next_stripped)
            i += 1

        para_text = ' '.join(para_lines)

        # 检查是否有行内格式
        segments = _parse_inline_formatting(para_text)
        if len(segments) == 1 and not any(k in segments[0] for k in ("bold", "italic")):
            blocks.append({"type": "paragraph", "text": para_text})
        else:
            blocks.append({"type": "rich_paragraph", "segments": segments})

    return blocks


def split_by_headings(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """将 blocks 按一级/二级标题分组，为每个 section 创建子列表。

    返回 [{"heading": "...", "level": 1, "blocks": [...]}, ...]
    """
    sections = []
    current_section = None

    for block in blocks:
        if block.get("type") == "heading":
            current_section = {
                "heading": block.get("text", ""),
                "level": block.get("level", 1),
                "blocks": [],
            }
            sections.append(current_section)
        elif current_section is not None:
            current_section["blocks"].append(block)
        else:
            # 在第一个标题之前的 blocks，放到默认 section
            if not sections:
                sections.append({"heading": "", "level": 1, "blocks": []})
            sections[0]["blocks"].append(block)

    return sections


if __name__ == "__main__":
    import json
    import sys

    md = sys.argv[1] if len(sys.argv) > 1 else "# 测试标题\n\n这是一段**粗体**和*斜体*的文字。\n\n- 列表1\n- 列表2\n\n| 列1 | 列2 |\n| --- | --- |\n| A | B |"

    blocks = markdown_to_blocks(md)
    print(json.dumps(blocks, ensure_ascii=False, indent=2))
