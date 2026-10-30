import type { AlertLevel, HealthLevel, JobStatus } from '../types'

// ============================================================
// 共享色板与状态颜色映射
// ============================================================
export const COLORS = {
  cyber: '#22d3ee',
  cyberGlow: '#67e8f9',
  cyan600: '#0891b2',
  alarm: '#f43f5e',
  amber: '#f59e0b',
  online: '#34d399',
  purple: '#a78bfa',
  blue: '#3b82f6',
  slate: '#64748b',
  gridLine: 'rgba(34,211,238,0.08)',
  axisLabel: '#7c93b0',
  panelBg: 'rgba(6,13,26,0.4)',
}

/** 健康等级 → 颜色 */
export const HEALTH_COLOR: Record<HealthLevel, string> = {
  normal: COLORS.online,
  warning: COLORS.amber,
  critical: COLORS.alarm,
  offline: COLORS.slate,
}

export const HEALTH_LABEL: Record<HealthLevel, string> = {
  normal: '正常',
  warning: '警告',
  critical: '严重',
  offline: '离线',
}

/** 告警等级 → 颜色 */
export const LEVEL_COLOR: Record<AlertLevel, string> = {
  P0: '#e11d48',
  P1: '#f43f5e',
  P2: '#f59e0b',
  P3: '#22d3ee',
}

export const LEVEL_LABEL: Record<AlertLevel, string> = {
  P0: 'P0 灾难',
  P1: 'P1 严重',
  P2: 'P2 警告',
  P3: 'P3 提示',
}

/** 任务状态 → 颜色/中文 */
export const JOB_STATUS_COLOR: Record<JobStatus, string> = {
  queued: COLORS.amber,
  running: COLORS.cyber,
  succeeded: COLORS.online,
  failed: COLORS.alarm,
}

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  queued: '排队中',
  running: '运行中',
  succeeded: '已完成',
  failed: '已失败',
}

/** 温度 → 热力颜色（蓝→青→绿→黄→红） */
export function tempToColor(temp: number): string {
  const stops: Array<[number, [number, number, number]]> = [
    [20, [37, 99, 235]],
    [40, [6, 182, 212]],
    [60, [16, 185, 129]],
    [75, [245, 158, 11]],
    [90, [244, 63, 94]],
  ]
  const t = Math.max(20, Math.min(90, temp))
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i]
    const [p1, c1] = stops[i + 1]
    if (t >= p0 && t <= p1) {
      const f = (t - p0) / (p1 - p0)
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f)
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f)
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f)
      return `rgb(${r},${g},${b})`
    }
  }
  return 'rgb(244,63,94)'
}

/** 利用率 0-100 → 颜色 */
export function utilToColor(util: number): string {
  if (util >= 95) return COLORS.alarm
  if (util >= 85) return COLORS.amber
  if (util >= 40) return COLORS.cyber
  return COLORS.cyan600
}
