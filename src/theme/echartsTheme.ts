import * as echarts from 'echarts'
import { COLORS } from './colors'

// ============================================================
// 注册 ECharts 深色驾驶舱主题
// ============================================================
const cockpitTheme = {
  color: [
    COLORS.cyber,
    COLORS.purple,
    COLORS.online,
    COLORS.amber,
    COLORS.alarm,
    COLORS.blue,
    '#f472b6',
    '#facc15',
  ],
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: 'Rajdhani, JetBrains Mono, sans-serif',
    color: COLORS.axisLabel,
  },
  title: {
    textStyle: { color: '#e2e8f0', fontSize: 13, fontWeight: 600 },
    subtextStyle: { color: COLORS.axisLabel, fontSize: 11 },
  },
  legend: {
    textStyle: { color: COLORS.axisLabel, fontSize: 11 },
    itemWidth: 10,
    itemHeight: 8,
  },
  grid: {
    borderColor: COLORS.gridLine,
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '16%',
    containLabel: true,
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: 'rgba(34,211,238,0.2)' } },
    axisTick: { show: false },
    axisLabel: { color: COLORS.axisLabel, fontSize: 10 },
    splitLine: { show: false, lineStyle: { color: COLORS.gridLine } },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: COLORS.axisLabel, fontSize: 10 },
    splitLine: { lineStyle: { color: COLORS.gridLine, type: 'dashed' } },
  },
  tooltip: {
    backgroundColor: 'rgba(6,13,26,0.92)',
    borderColor: 'rgba(34,211,238,0.3)',
    borderWidth: 1,
    textStyle: { color: '#e2e8f0', fontSize: 12 },
    axisPointer: {
      lineStyle: { color: 'rgba(34,211,238,0.4)' },
      crossStyle: { color: 'rgba(34,211,238,0.4)' },
    },
  },
}

let registered = false
export function ensureEchartsTheme() {
  if (registered) return
  echarts.registerTheme('cockpit', cockpitTheme as never)
  registered = true
}

export { echarts }
