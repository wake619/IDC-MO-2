import type { AlertLevel, AlertStatus, HealthLevel, JobStatus } from '../types'
import {
  HEALTH_COLOR,
  HEALTH_LABEL,
  JOB_STATUS_COLOR,
  JOB_STATUS_LABEL,
  LEVEL_COLOR,
  LEVEL_LABEL,
} from '../theme/colors'

/** 告警等级徽章 P0-P3 */
export function LevelBadge({ level, size = 'sm' }: { level: AlertLevel; size?: 'xs' | 'sm' }) {
  const color = LEVEL_COLOR[level]
  return (
    <span
      className={`inline-flex items-center justify-center font-bold rounded-sm border ${
        size === 'xs' ? 'text-[9px] px-1 py-px min-w-[22px]' : 'text-[10px] px-1.5 py-0.5 min-w-[26px]'
      }`}
      style={{ color, borderColor: `${color}66`, background: `${color}1a`, boxShadow: `0 0 6px ${color}44` }}
    >
      {level}
    </span>
  )
}

/** 告警等级完整标签 */
export function LevelTag({ level }: { level: AlertLevel }) {
  return (
    <span className="text-[11px] font-semibold" style={{ color: LEVEL_COLOR[level] }}>
      {LEVEL_LABEL[level]}
    </span>
  )
}

/** 健康状态点 + 文字 */
export function HealthBadge({ level, showLabel = true }: { level: HealthLevel; showLabel?: boolean }) {
  const color = HEALTH_COLOR[level]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`w-1.5 h-1.5 rounded-full ${level === 'critical' ? 'animate-pulseGlow' : ''}`}
        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
      />
      {showLabel && (
        <span className="text-[11px] font-medium" style={{ color }}>
          {HEALTH_LABEL[level]}
        </span>
      )}
    </span>
  )
}

/** 告警状态徽章 */
export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const map: Record<AlertStatus, { label: string; cls: string }> = {
    active: { label: '活跃', cls: 'text-alarm-400 border-alarm-500/40 bg-alarm-500/10' },
    acked: { label: '已确认', cls: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
    silenced: { label: '已静默', cls: 'text-slate-400 border-slate-500/40 bg-slate-500/10' },
    resolved: { label: '已恢复', cls: 'text-online-400 border-online-500/40 bg-online-500/10' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-sm border ${cls}`}>
      {label}
    </span>
  )
}

/** 任务状态徽章 */
export function JobStatusBadge({ status }: { status: JobStatus }) {
  const color = JOB_STATUS_COLOR[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded-sm border"
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
    >
      {status === 'running' && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulseGlow" style={{ background: color }} />
      )}
      {JOB_STATUS_LABEL[status]}
    </span>
  )
}
