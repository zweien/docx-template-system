import { describe, expect, it } from "vitest"
import {
  buildChartOptionFromConfig,
  extractChartOptionFromText,
} from "./chart-text-parser"

describe("chart-text-parser", () => {
  it("应从 assistant 文本里的图表 JSON 提取出 ECharts option", () => {
    const text = `## 图表\n\n\`\`\`json
{
  "title": "月度销量",
  "type": "line",
  "xAxis": "月份",
  "yAxis": "销量",
  "data": {
    "labels": ["1月", "2月"],
    "values": [12, 18]
  },
  "color": "#5470C6"
}
\`\`\``

    expect(extractChartOptionFromText(text)).toEqual({
      title: { text: "月度销量" },
      tooltip: {},
      xAxis: { type: "category", data: ["1月", "2月"], name: "月份" },
      yAxis: { type: "value", name: "销量" },
      series: [
        {
          type: "line",
          data: [12, 18],
          itemStyle: { color: "#5470C6" },
        },
      ],
    })
  })

  it("table 类型不应错误地转成 ECharts option", () => {
    expect(
      buildChartOptionFromConfig({
        title: "表格",
        type: "table",
        data: {
          labels: ["A", "B"],
          values: [1, 2],
        },
      })
    ).toBeNull()
  })
})
