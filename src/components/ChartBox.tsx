import { memo, useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { ensureEchartsTheme } from '../theme/echartsTheme'
import type { EChartsOption } from 'echarts'

interface ChartBoxProps {
  option: EChartsOption
  className?: string
  /** 是否禁用动画（高频刷新场景） */
  noAnimation?: boolean
  onEvents?: Record<string, (params: unknown) => void>
}

/**
 * ECharts 封装：应用驾驶舱主题、自适应尺寸、增量 setOption
 */
function ChartBox({ option, className = '', noAnimation = false, onEvents }: ChartBoxProps) {
  ensureEchartsTheme()
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current, 'cockpit', { renderer: 'canvas' })
    chartRef.current = chart
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.setOption({ animation: !noAnimation, ...option }, { notMerge: false, lazyUpdate: false })
  }, [option, noAnimation])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !onEvents) return
    const entries = Object.entries(onEvents)
    entries.forEach(([evt, fn]) => chart.on(evt, fn))
    return () => {
      entries.forEach(([evt, fn]) => chart.off(evt, fn))
    }
  }, [onEvents])

  // 外层负责尺寸（调用方 className 提供高度，缺省 h-full），
  // 内层绝对定位铺满，避免 h-full 与 h-[Npx] 同元素冲突导致 0 高
  return (
    <div className={`relative w-full ${className || 'h-full'}`}>
      <div ref={ref} className="absolute inset-0" />
    </div>
  )
}

export default memo(ChartBox)
