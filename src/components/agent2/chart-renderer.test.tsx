import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ChartRenderer } from "./chart-renderer"

describe("ChartRenderer", () => {
  it("应渲染折线图标题和 svg", () => {
    render(
      <ChartRenderer
        option={{
          title: { text: "月度销量" },
          xAxis: { type: "category", data: ["1月", "2月"] },
          yAxis: { type: "value" },
          series: [{ type: "line", data: [12, 18] }],
        }}
      />
    )

    expect(screen.getByText("月度销量")).toBeInTheDocument()
    expect(document.querySelector("svg")).not.toBeNull()
    expect(screen.getByText("1月")).toBeInTheDocument()
  })

  it("应正确渲染包含负值的柱状图", () => {
    const { container } = render(
      <ChartRenderer
        option={{
          title: { text: "盈亏" },
          xAxis: { type: "category", data: ["收入", "退款"] },
          yAxis: { type: "value" },
          series: [{ type: "bar", data: [120, -40] }],
        }}
      />
    )

    const rects = Array.from(container.querySelectorAll("svg rect"))
    const barRects = rects.filter((rect) => rect.getAttribute("rx") === "6")

    expect(screen.getByText("盈亏")).toBeInTheDocument()
    expect(barRects).toHaveLength(2)
    for (const rect of barRects) {
      expect(Number(rect.getAttribute("height"))).toBeGreaterThanOrEqual(0)
      expect(Number(rect.getAttribute("y"))).toBeGreaterThanOrEqual(0)
    }
  })
})
