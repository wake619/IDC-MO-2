import type { EChartsOption } from 'echarts'
import { COLORS } from './colors'
import type { TimePoint } from '../types'

/** 生成竖向渐变（用于面积图） */
export function areaGradient(color: string, topOpacity = 0.45, bottomOpacity = 0.02) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: hexToRgba(color, topOpacity) },
      { offset: 1, color: hexToRgba(color, bottomOpacity) },
    ],
  }
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** 时间戳 → HH:mm */
export function fmtTime(t: number): string {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * 平滑面积折线图（时序趋势）
 */
export function trendLineOption(
  series: Array<{ name: string; data: TimePoint[]; color: string; area?: boolean }>,
  opts: { yMax?: number; yUnit?: string; smooth?: boolean; showLegend?: boolean } = {},
): EChartsOption {
  const { yMax, yUnit = '', smooth = true, showLegend = false } = opts
  return {
    tooltip: { trigger: 'axis' },
    legend: showLegend
      ? { show: true, top: 0, right: 0, data: series.map((s) => s.name) }
      : { show: false },
    grid: { left: 8, right: 12, top: showLegend ? 28 : 12, bottom: 4 },
    xAxis: {
      type: 'time',
      axisLabel: { formatter: (v: number) => fmtTime(v) },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      max: yMax,
      axisLabel: { formatter: `{value}${yUnit}` },
      splitLine: { lineStyle: { color: COLORS.gridLine, type: 'dashed' } },
    },
    series: series.map((s) => ({
      name: s.name,
      type: 'line' as const,
      smooth,
      showSymbol: false,
      data: s.data.map((p) => [p.t, +p.v.toFixed(2)]),
      lineStyle: { width: 1.8, color: s.color, shadowBlur: 8, shadowColor: hexToRgba(s.color, 0.5) },
      itemStyle: { color: s.color },
      areaStyle: s.area === false ? undefined : { color: areaGradient(s.color) },
    })),
  }
}

/**
 * 玫瑰/环形饼图
 */
export function rosePieOption(
  data: Array<{ name: string; value: number; color?: string }>,
  opts: { roseType?: boolean; inner?: string; center?: [string, string] } = {},
): EChartsOption {
  const { roseType = false, inner = '48%', center = ['50%', '52%'] } = opts
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { show: false },
    series: [
      {
        type: 'pie',
        radius: [inner, '72%'],
        center,
        roseType: roseType ? 'radius' : undefined,
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#060d1a', borderWidth: 2 },
        label: {
          color: COLORS.axisLabel,
          fontSize: 10,
          formatter: '{b}\n{c}',
        },
        labelLine: { length: 6, length2: 6, lineStyle: { color: 'rgba(34,211,238,0.3)' } },
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: d.color ? { color: d.color } : undefined,
        })),
      },
    ],
  }
}

/**
 * 仪表盘（半环）
 */
export function gaugeOption(
  value: number,
  opts: {
    name?: string
    max?: number
    color?: string
    unit?: string
    zones?: Array<{ to: number; color: string }>
  } = {},
): EChartsOption {
  const { name = '', max = 100, unit = '', zones } = opts
  const axisLine = zones
    ? { lineStyle: { width: 12, color: zones.map((z) => [z.to / max, z.color]) as [number, string][] } }
    : { lineStyle: { width: 12, color: [[1, opts.color ?? COLORS.cyber]] as [number, string][] } }
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max,
        radius: '92%',
        center: ['50%', '58%'],
        progress: { show: !zones, width: 12, itemStyle: { color: opts.color ?? COLORS.cyber } },
        axisLine,
        axisTick: { distance: -14, splitNumber: 5, lineStyle: { color: 'rgba(255,255,255,0.2)' } },
        splitLine: { distance: -16, length: 8, lineStyle: { color: 'rgba(255,255,255,0.3)' } },
        axisLabel: { distance: -10, color: COLORS.axisLabel, fontSize: 9 },
        pointer: { show: true, length: '58%', width: 3, itemStyle: { color: opts.color ?? COLORS.cyber } },
        anchor: { show: true, size: 8, itemStyle: { color: opts.color ?? COLORS.cyber } },
        title: { show: !!name, offsetCenter: [0, '72%'], color: COLORS.axisLabel, fontSize: 11 },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '38%'],
          fontSize: 24,
          fontWeight: 'bolder',
          fontFamily: 'Orbitron, sans-serif',
          color: '#fff',
          formatter: (v: number) => `${v.toFixed(1)}${unit}`,
        },
        data: [{ value: +value.toFixed(2), name }],
      },
    ],
  }
}

/**
 * 堆叠面积图（告警趋势等）
 */
export function stackedAreaOption(
  categories: string[],
  series: Array<{ name: string; data: number[]; color: string }>,
): EChartsOption {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { show: true, top: 0, right: 0, itemWidth: 10, itemHeight: 8 },
    grid: { left: 8, right: 12, top: 28, bottom: 4 },
    xAxis: { type: 'category', boundaryGap: false, data: categories },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: COLORS.gridLine, type: 'dashed' } } },
    series: series.map((s) => ({
      name: s.name,
      type: 'line' as const,
      stack: 'total',
      smooth: true,
      showSymbol: false,
      data: s.data,
      lineStyle: { width: 1, color: s.color },
      itemStyle: { color: s.color },
      areaStyle: { color: areaGradient(s.color, 0.5, 0.08) },
    })),
  }
}

/**
 * 水平条形图（排行）
 */
export function hBarOption(
  data: Array<{ name: string; value: number; color?: string }>,
  opts: { unit?: string; max?: number } = {},
): EChartsOption {
  const { unit = '' } = opts
  const sorted = [...data].sort((a, b) => a.value - b.value)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: `{b}: {c}${unit}` },
    grid: { left: 8, right: 30, top: 8, bottom: 4 },
    xAxis: { type: 'value', max: opts.max, splitLine: { lineStyle: { color: COLORS.gridLine } } },
    yAxis: {
      type: 'category',
      data: sorted.map((d) => d.name),
      axisLabel: { fontSize: 10, color: COLORS.axisLabel },
    },
    series: [
      {
        type: 'bar',
        barWidth: '55%',
        data: sorted.map((d) => ({
          value: +d.value.toFixed(1),
          itemStyle: {
            color: areaGradient(d.color ?? COLORS.cyber, 0.9, 0.4),
            borderRadius: [0, 3, 3, 0],
          },
        })),
        label: { show: true, position: 'right', color: COLORS.axisLabel, fontSize: 10, formatter: `{c}${unit}` },
      },
    ],
  }
}

/**
 * 热力图（GPU 温度-利用率矩阵）
 */
export function heatmapOption(
  xLabels: string[],
  yLabels: string[],
  data: Array<[number, number, number]>,
  opts: { max?: number; unit?: string; visualColors?: string[] } = {},
): EChartsOption {
  const { max = 100, unit = '', visualColors } = opts
  return {
    tooltip: {
      position: 'top',
      formatter: (p: unknown) => {
        const e = p as { data: [number, number, number] }
        return `${yLabels[e.data[1]]} / ${xLabels[e.data[0]]}<br/>值: <b>${e.data[2].toFixed(1)}${unit}</b>`
      },
    },
    grid: { left: 8, right: 8, top: 8, bottom: 40 },
    xAxis: { type: 'category', data: xLabels, splitArea: { show: true }, axisLabel: { fontSize: 9 } },
    yAxis: { type: 'category', data: yLabels, splitArea: { show: true }, axisLabel: { fontSize: 9 } },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 10,
      itemHeight: 90,
      textStyle: { color: COLORS.axisLabel, fontSize: 9 },
      inRange: {
        color: visualColors ?? ['#0891b2', '#22d3ee', '#34d399', '#f59e0b', '#f43f5e'],
      },
    },
    series: [
      {
        type: 'heatmap',
        data,
        progressive: 1000,
        itemStyle: { borderColor: '#060d1a', borderWidth: 0.5 },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(34,211,238,0.6)' } },
      },
    ],
  }
}

/**
 * 桑基图（能耗流向）
 */
export function sankeyOption(
  nodes: Array<{ name: string }>,
  links: Array<{ source: string; target: string; value: number }>,
): EChartsOption {
  return {
    tooltip: { trigger: 'item', triggerOn: 'mousemove', formatter: '{b}: {c} kW' },
    series: [
      {
        type: 'sankey',
        left: 12,
        right: 90,
        top: 12,
        bottom: 12,
        nodeWidth: 14,
        nodeGap: 12,
        data: nodes,
        links,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.4 },
        itemStyle: { borderWidth: 0 },
        label: { color: '#cbd5e1', fontSize: 11 },
      },
    ],
  }
}

export { COLORS }

/** 直方图分布 */
export function histogramOption(
  bins: string[],
  values: number[],
  color = COLORS.cyber,
  unit = '个',
): EChartsOption {
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: `{b}<br/>节点数: {c} ${unit}` },
    grid: { left: 8, right: 12, top: 16, bottom: 4 },
    xAxis: { type: 'category', data: bins, axisLabel: { fontSize: 9, interval: 0 } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: COLORS.gridLine, type: 'dashed' } } },
    series: [
      {
        type: 'bar',
        barWidth: '62%',
        data: values,
        itemStyle: { color: areaGradient(color, 0.9, 0.25), borderRadius: [3, 3, 0, 0] },
      },
    ],
  }
}
