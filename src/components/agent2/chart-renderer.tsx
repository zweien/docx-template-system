"use client"

import { useEffect, useRef } from "react"
import * as echarts from "echarts"

interface ChartRendererProps {
  option: Record<string, unknown>
  className?: string
}

export function ChartRenderer({ option, className }: ChartRendererProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    const instance = echarts.init(chartRef.current)
    instanceRef.current = instance
    instance.setOption(option)

    const handleResize = () => instance.resize()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      instance.dispose()
    }
  }, [option])

  return <div ref={chartRef} className={className || "w-full h-64"} />
}
