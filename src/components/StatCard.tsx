import AnimatedNumber from './AnimatedNumber'

interface StatCardProps {
  label: string
  value: number
  decimals?: number
  unit?: string
  prefix?: string
  icon?: string
  color?: string
  /** 副信息，如 "在线 6100/6144" */
  hint?: string
  /** 进度条百分比 0-100，可选 */
  progress?: number
  trend?: number // 相对变化，正负
}

/**
 * 顶部 KPI 指标卡：大数字 + 单位 + 图标 + 进度条 + 趋势
 */
export default function StatCard({
  label,
  value,
  decimals = 0,
  unit,
  prefix,
  icon,
  color = '#22d3ee',
  hint,
  progress,
  trend,
}: StatCardProps) {
  return (
    <div className="panel corner-frame relative px-3 py-2.5 flex items-center gap-3 overflow-hidden group">
      {/* 背景辉光 */}
      <div
        className="absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-20 blur-xl transition-opacity group-hover:opacity-40"
        style={{ background: color }}
      />
      {icon && (
        <div
          className="text-2xl shrink-0 w-10 h-10 flex items-center justify-center rounded border"
          style={{ color, borderColor: `${color}33`, background: `${color}12` }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="hud-label truncate">{label}</div>
        <div className="flex items-baseline gap-1 mt-0.5">
          <AnimatedNumber
            value={value}
            decimals={decimals}
            prefix={prefix}
            className="stat-value text-2xl leading-none"
          />
          {unit && (
            <span className="text-xs font-semibold" style={{ color }}>
              {unit}
            </span>
          )}
          {trend !== undefined && (
            <span
              className={`text-[10px] ml-auto font-mono ${trend >= 0 ? 'text-online-400' : 'text-alarm-400'}`}
            >
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
        {progress !== undefined && (
          <div className="mt-1.5 h-1 rounded-full bg-void-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, progress)}%`, background: color, boxShadow: `0 0 8px ${color}` }}
            />
          </div>
        )}
        {hint && <div className="text-[10px] text-slate-500 mt-1 truncate font-mono">{hint}</div>}
      </div>
    </div>
  )
}
