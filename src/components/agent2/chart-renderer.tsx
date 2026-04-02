"use client"

import type { ReactNode } from "react"

type ChartPoint = {
  label: string
  value: number
}

type PiePoint = {
  name: string
  value: number
}

interface ChartRendererProps {
  option: Record<string, unknown>
  className?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function getTitle(option: Record<string, unknown>): string | null {
  if (!isRecord(option.title)) {
    return null
  }

  return typeof option.title.text === "string" ? option.title.text : null
}

function getSeries(option: Record<string, unknown>): Record<string, unknown> | null {
  return Array.isArray(option.series) && option.series.length > 0 && isRecord(option.series[0])
    ? option.series[0]
    : null
}

function getSeriesType(option: Record<string, unknown>): string | null {
  const series = getSeries(option)
  return series && typeof series.type === "string" ? series.type : null
}

function getCartesianPoints(option: Record<string, unknown>): ChartPoint[] {
  const series = getSeries(option)
  const xAxis = isRecord(option.xAxis) ? option.xAxis : null
  const labels = Array.isArray(xAxis?.data)
    ? xAxis.data.filter((item): item is string => typeof item === "string")
    : []
  const values = Array.isArray(series?.data)
    ? series.data
        .map((item) => toNumber(item))
        .filter((item): item is number => item != null)
    : []

  return values.map((value, index) => ({
    label: labels[index] ?? String(index + 1),
    value,
  }))
}

function getScatterPoints(option: Record<string, unknown>): Array<{ x: number; y: number }> {
  const series = getSeries(option)
  if (!Array.isArray(series?.data)) {
    return []
  }

  return series.data.flatMap((item) => {
    if (!Array.isArray(item) || item.length < 2) {
      return []
    }

    const x = toNumber(item[0])
    const y = toNumber(item[1])
    return x != null && y != null ? [{ x, y }] : []
  })
}

function getPiePoints(option: Record<string, unknown>): PiePoint[] {
  const series = getSeries(option)
  if (!Array.isArray(series?.data)) {
    return []
  }

  return series.data.flatMap((item) => {
    if (!isRecord(item)) {
      return []
    }

    const name = typeof item.name === "string" ? item.name : null
    const value = toNumber(item.value)
    return name && value != null ? [{ name, value }] : []
  })
}

function getColor(option: Record<string, unknown>, fallback: string): string {
  const series = getSeries(option)
  const itemStyle = isRecord(series?.itemStyle) ? series.itemStyle : null
  return typeof itemStyle?.color === "string" ? itemStyle.color : fallback
}

function getDomain(values: number[]) {
  const minValue = values.length > 0 ? Math.min(...values) : 0
  const maxValue = values.length > 0 ? Math.max(...values) : 0
  const domainMin = Math.min(minValue, 0)
  const domainMax = Math.max(maxValue, 0)
  const domainSize = domainMax - domainMin || 1

  return {
    domainMin,
    domainMax,
    domainSize,
  }
}

function toChartY(value: number, domainMin: number, domainMax: number, height: number, padding: number) {
  const plotHeight = height - padding * 2
  const domainSize = domainMax - domainMin || 1
  return padding + ((domainMax - value) / domainSize) * plotHeight
}

function toChartX(value: number, domainMin: number, domainMax: number, width: number, padding: number) {
  const plotWidth = width - padding * 2
  const domainSize = domainMax - domainMin || 1
  return padding + ((value - domainMin) / domainSize) * plotWidth
}

function renderLineChart(points: ChartPoint[], color: string) {
  const width = 640
  const height = 256
  const padding = 36
  const { domainMin, domainMax } = getDomain(points.map((point) => point.value))
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0
  const baselineY = toChartY(0, domainMin, domainMax, height, padding)

  const polyline = points
    .map((point, index) => {
      const x = padding + stepX * index
      const y = toChartY(point.value, domainMin, domainMax, height, padding)
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
      <line x1={padding} y1={baselineY} x2={width - padding} y2={baselineY} stroke="#cbd5e1" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cbd5e1" />
      <polyline
        fill="none"
        points={polyline}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      {points.map((point, index) => {
        const x = padding + stepX * index
        const y = toChartY(point.value, domainMin, domainMax, height, padding)
        return (
          <g key={`${point.label}-${index}`}>
            <circle cx={x} cy={y} fill={color} r="4" />
            <text x={x} y={height - 12} fill="#64748b" fontSize="12" textAnchor="middle">
              {point.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function renderBarChart(points: ChartPoint[], color: string) {
  const width = 640
  const height = 256
  const padding = 36
  const { domainMin, domainMax } = getDomain(points.map((point) => point.value))
  const barWidth = Math.max((width - padding * 2) / Math.max(points.length * 1.8, 1), 18)
  const gap = barWidth * 0.8
  const baselineY = toChartY(0, domainMin, domainMax, height, padding)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
      <line x1={padding} y1={baselineY} x2={width - padding} y2={baselineY} stroke="#cbd5e1" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cbd5e1" />
      {points.map((point, index) => {
        const valueY = toChartY(point.value, domainMin, domainMax, height, padding)
        const barHeight = Math.abs(baselineY - valueY)
        const x = padding + index * (barWidth + gap)
        const y = Math.min(valueY, baselineY)

        return (
          <g key={`${point.label}-${index}`}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx="6" fill={color} />
            <text x={x + barWidth / 2} y={height - 12} fill="#64748b" fontSize="12" textAnchor="middle">
              {point.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function renderScatterChart(points: Array<{ x: number; y: number }>, color: string) {
  const width = 640
  const height = 256
  const padding = 36
  const { domainMin: minX, domainMax: maxX } = getDomain(points.map((point) => point.x))
  const { domainMin: minY, domainMax: maxY } = getDomain(points.map((point) => point.y))
  const baselineY = toChartY(0, minY, maxY, height, padding)
  const baselineX = toChartX(0, minX, maxX, width, padding)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
      <line x1={padding} y1={baselineY} x2={width - padding} y2={baselineY} stroke="#cbd5e1" />
      <line x1={baselineX} y1={padding} x2={baselineX} y2={height - padding} stroke="#cbd5e1" />
      {points.map((point, index) => {
        const x = toChartX(point.x, minX, maxX, width, padding)
        const y = toChartY(point.y, minY, maxY, height, padding)
        return <circle key={`${point.x}-${point.y}-${index}`} cx={x} cy={y} fill={color} r="5" />
      })}
    </svg>
  )
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  }
}

function createPieSlicePath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, radius, startAngle)
  const end = polarToCartesian(cx, cy, radius, endAngle)
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ")
}

function renderPieChart(points: PiePoint[]) {
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const colors = ["#2563eb", "#16a34a", "#f59e0b", "#db2777", "#7c3aed", "#0891b2"]
  const radius = 90
  const cx = 160
  const cy = 128
  let currentAngle = -Math.PI / 2

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center">
      <svg viewBox="0 0 320 256" className="h-64 w-full md:w-80">
        {points.map((point, index) => {
          const angle = total === 0 ? 0 : (point.value / total) * Math.PI * 2
          const path = createPieSlicePath(cx, cy, radius, currentAngle, currentAngle + angle)
          const color = colors[index % colors.length]
          currentAngle += angle
          return <path key={`${point.name}-${index}`} d={path} fill={color} stroke="#fff" strokeWidth="2" />
        })}
      </svg>
      <div className="space-y-2 text-sm">
        {points.map((point, index) => {
          const color = colors[index % colors.length]
          const percent = total === 0 ? 0 : Math.round((point.value / total) * 100)
          return (
            <div key={`${point.name}-${index}`} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
              <span>{point.name}</span>
              <span className="text-muted-foreground">{point.value} ({percent}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function renderFallback(option: Record<string, unknown>) {
  return (
    <pre className="overflow-x-auto rounded-md bg-muted/50 p-4 text-xs">
      {JSON.stringify(option, null, 2)}
    </pre>
  )
}

export function ChartRenderer({ option, className }: ChartRendererProps) {
  const title = getTitle(option)
  const type = getSeriesType(option)
  const color = getColor(option, "#2563eb")

  let content: ReactNode = renderFallback(option)

  if (type === "line") {
    const points = getCartesianPoints(option)
    if (points.length > 0) {
      content = renderLineChart(points, color)
    }
  } else if (type === "bar") {
    const points = getCartesianPoints(option)
    if (points.length > 0) {
      content = renderBarChart(points, color)
    }
  } else if (type === "scatter") {
    const points = getScatterPoints(option)
    if (points.length > 0) {
      content = renderScatterChart(points, color)
    }
  } else if (type === "pie") {
    const points = getPiePoints(option)
    if (points.length > 0) {
      content = renderPieChart(points)
    }
  }

  return (
    <div className={className || "w-full rounded-lg border bg-background p-4"}>
      {title && <div className="mb-4 text-sm font-medium">{title}</div>}
      {content}
    </div>
  )
}
