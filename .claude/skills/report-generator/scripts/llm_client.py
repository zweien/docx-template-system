#!/usr/bin/env python3
"""LLM 客户端，封装 OpenAI-compatible API 调用。

用法:
    from llm_client import generate_content

    content = generate_content(
        system_prompt="你是一位专业报告撰写助手",
        user_prompt="请撰写研究目标部分",
        context={"PROJECT_NAME": "XXX项目"},
    )
"""

import json
import os
import time
from typing import Any, Dict, Optional

import urllib.request
import urllib.error


DEFAULT_SYSTEM_PROMPT = """你是一位专业的科研报告撰写助手。用户会给你：
1. 当前章节的写作要求（prompt）
2. 报告上下文变量（如项目名称、申请单位等）
3. 整篇报告的结构

你的任务是根据写作要求，生成高质量的 Markdown 格式内容。

规则：
- 使用标准 Markdown：# 表示标题，- 表示列表，**粗体** 等
- 内容要与上下文变量中的信息保持一致
- 只输出 Markdown 内容，不要输出任何解释或 meta 信息
- 不要输出 ```markdown 代码块包裹，直接输出纯 Markdown"""


def _get_env(key: str, default: Optional[str] = None) -> str:
    """从环境变量读取，支持从项目根目录的 .env.local 加载。"""
    value = os.environ.get(key)
    if value is not None:
        return value

    # 尝试从项目根目录的 .env.local 读取
    # script_dir: .../report-generator/scripts
    # 项目根目录在 scripts 的上 4 层
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_paths = [
        os.path.join(script_dir, "..", "..", "..", "..", ".env.local"),
        os.path.join(script_dir, "..", "..", "..", "..", ".env"),
        os.path.join(script_dir, "..", "..", "..", ".env.local"),
        os.path.join(script_dir, "..", "..", "..", ".env"),
    ]

    for env_path in env_paths:
        env_path = os.path.abspath(env_path)
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k == key:
                            return v
            break  # 只读第一个找到的 env 文件

    if default is not None:
        return default
    raise ValueError(f"环境变量 {key} 未设置，且未在 .env.local 中找到")


def generate_content(
    user_prompt: str,
    system_prompt: Optional[str] = None,
    context: Optional[Dict[str, str]] = None,
    document_structure: Optional[list] = None,
    temperature: float = 0.7,
) -> str:
    """调用 LLM API 生成内容。

    Args:
        user_prompt: 用户的写作要求
        system_prompt: 自定义系统提示（默认使用科研报告撰写助手）
        context: 上下文变量（PROJECT_NAME, APPLICANT_ORG 等）
        document_structure: 报告结构 [{id, title}, ...]
        temperature: 生成温度

    Returns:
        LLM 生成的 Markdown 字符串
    """
    base_url = _get_env("AI_BASE_URL", "http://localhost:3000/v1")
    api_key = _get_env("AI_API_KEY", "")
    model = _get_env("AI_MODEL", "gpt-4o")

    # 构建用户消息
    parts = []
    parts.append(f"## 写作要求\n{user_prompt}")

    if context:
        parts.append("\n## 上下文变量")
        for key, value in context.items():
            parts.append(f"- {key}: {value}")

    if document_structure:
        parts.append("\n## 报告结构")
        for sec in document_structure:
            title = sec.get("title") or sec.get("id", "")
            parts.append(f"- {title}")

    user_message = "\n".join(parts)

    # 构建请求
    messages = [
        {"role": "system", "content": system_prompt or DEFAULT_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": False,
    }

    headers = {
        "Content-Type": "application/json",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    # 重试机制：最多3次，500错误时等待后重试
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                # 去除可能的 markdown 代码块包裹
                content = content.strip()
                if content.startswith("```markdown"):
                    content = content[len("```markdown"):].strip()
                elif content.startswith("```"):
                    content = content[len("```"):].strip()
                if content.endswith("```"):
                    content = content[:-len("```")].strip()
                return content
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8")
            if e.code >= 500 and attempt < max_retries - 1:
                wait = 2 ** attempt  # 指数退避：1, 2, 4 秒
                print(f"    LLM API {e.code} 错误，{wait}秒后重试 ({attempt + 1}/{max_retries})...")
                time.sleep(wait)
                continue
            raise RuntimeError(f"LLM API 错误 ({e.code}): {body}") from e
        except Exception as e:
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                print(f"    LLM 调用失败，{wait}秒后重试 ({attempt + 1}/{max_retries})...")
                time.sleep(wait)
                continue
            raise RuntimeError(f"LLM 调用失败: {e}") from e

    raise RuntimeError("LLM 调用失败：超过最大重试次数")


def generate_section_content(
    prompt: str,
    target: str,
    context: Optional[Dict[str, str]] = None,
    document_structure: Optional[list] = None,
) -> str:
    """为特定 section 生成内容（便捷包装）。"""
    user_prompt = f"章节：{target}\n\n要求：{prompt}"
    return generate_content(
        user_prompt=user_prompt,
        context=context,
        document_structure=document_structure,
    )


if __name__ == "__main__":
    # 简单测试
    import sys

    if len(sys.argv) < 2:
        print("用法: python llm_client.py '写作要求'")
        sys.exit(1)

    result = generate_content(user_prompt=sys.argv[1])
    print(result)
