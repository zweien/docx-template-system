import { describe, expect, it } from "vitest"

import { parseThinkTaggedText } from "./think-parser"

describe("parseThinkTaggedText", () => {
  it("应把 think 内容和正文拆分开", () => {
    expect(
      parseThinkTaggedText("<think>先查时间</think>\n\n现在是 **13:00**")
    ).toEqual([
      { type: "reasoning", text: "先查时间" },
      { type: "text", text: "现在是 **13:00**" },
    ])
  })

  it("没有 think 标签时应保留正文", () => {
    expect(parseThinkTaggedText("正常正文")).toEqual([
      { type: "text", text: "正常正文" },
    ])
  })
})
