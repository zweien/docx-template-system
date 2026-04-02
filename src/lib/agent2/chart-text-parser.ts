type SimpleChartConfig = {
  title?: string
  type?: "bar" | "line" | "pie" | "scatter" | "table"
  xAxis?: string
  yAxis?: string
  color?: string
  data?: {
    labels?: string[]
    values?: number[]
  }
}

const JSON_CODE_BLOCK_PATTERN = /```json\s*([\s\S]*?)```/gi

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function toNumberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : []
}

export function buildChartOptionFromConfig(
  config: SimpleChartConfig
): Record<string, unknown> | null {
  const labels = toStringArray(config.data?.labels)
  const values = toNumberArray(config.data?.values)

  if (!config.type || labels.length === 0 || values.length === 0) {
    return null
  }

  const baseOption: Record<string, unknown> = {
    title: config.title ? { text: config.title } : undefined,
    tooltip: {},
  }

  switch (config.type) {
    case "bar":
      return {
        ...baseOption,
        xAxis: { type: "category", data: labels, name: config.xAxis },
        yAxis: { type: "value", name: config.yAxis },
        series: [{ type: "bar", data: values, itemStyle: config.color ? { color: config.color } : undefined }],
      }
    case "line":
      return {
        ...baseOption,
        xAxis: { type: "category", data: labels, name: config.xAxis },
        yAxis: { type: "value", name: config.yAxis },
        series: [{ type: "line", data: values, itemStyle: config.color ? { color: config.color } : undefined }],
      }
    case "pie":
      return {
        ...baseOption,
        series: [{
          type: "pie",
          radius: "50%",
          data: labels.map((label, index) => ({
            name: label,
            value: values[index],
          })),
        }],
      }
    case "scatter":
      return {
        ...baseOption,
        xAxis: { type: "value", name: config.xAxis },
        yAxis: { type: "value", name: config.yAxis },
        series: [{
          type: "scatter",
          data: values.map((value, index) => [index, value]),
          itemStyle: config.color ? { color: config.color } : undefined,
        }],
      }
    default:
      return null
  }
}

export function extractChartOptionFromText(
  text: string
): Record<string, unknown> | null {
  for (const match of text.matchAll(JSON_CODE_BLOCK_PATTERN)) {
    const rawJson = match[1]?.trim()
    if (!rawJson) {
      continue
    }

    try {
      const parsed = JSON.parse(rawJson) as unknown
      if (!isRecord(parsed)) {
        continue
      }

      if (Array.isArray(parsed.series)) {
        return parsed
      }

      const option = buildChartOptionFromConfig({
        title: typeof parsed.title === "string" ? parsed.title : undefined,
        type: parsed.type as SimpleChartConfig["type"],
        xAxis: typeof parsed.xAxis === "string" ? parsed.xAxis : undefined,
        yAxis: typeof parsed.yAxis === "string" ? parsed.yAxis : undefined,
        color: typeof parsed.color === "string" ? parsed.color : undefined,
        data: isRecord(parsed.data)
          ? {
              labels: toStringArray(parsed.data.labels),
              values: toNumberArray(parsed.data.values),
            }
          : undefined,
      })

      if (option) {
        return option
      }
    } catch {
      continue
    }
  }

  return null
}
