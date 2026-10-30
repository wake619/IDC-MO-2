import type { ReactNode } from 'react'

/** 筛选标签按钮 */
export function FilterChip({
  active,
  onClick,
  children,
  color = '#22d3ee',
  count,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  color?: string
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 text-[11px] rounded-sm border transition-all whitespace-nowrap"
      style={
        active
          ? { color, borderColor: `${color}88`, background: `${color}1f`, boxShadow: `0 0 10px ${color}33` }
          : { color: '#94a3b8', borderColor: 'rgba(100,116,139,0.3)', background: 'transparent' }
      }
    >
      {children}
      {count !== undefined && (
        <span className="ml-1 font-mono opacity-70">{count}</span>
      )}
    </button>
  )
}

/** 水位/占比条 */
export function WaterBar({
  percent,
  color = '#22d3ee',
  height = 6,
  label,
  right,
}: {
  percent: number
  color?: string
  height?: number
  label?: string
  right?: string
}) {
  const p = Math.max(0, Math.min(100, percent))
  return (
    <div className="w-full">
      {(label || right) && (
        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
          <span>{label}</span>
          <span className="font-mono" style={{ color }}>
            {right ?? `${p.toFixed(0)}%`}
          </span>
        </div>
      )}
      <div className="w-full rounded-full bg-void-700 overflow-hidden" style={{ height }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${p}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
    </div>
  )
}

/** SVG 环形仪表 */
export function RingGauge({
  value,
  size = 120,
  stroke = 10,
  color = '#22d3ee',
  trackColor = 'rgba(34,211,238,0.1)',
  label,
  unit = '%',
  decimals = 1,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  trackColor?: string
  label?: string
  unit?: string
  decimals?: number
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, value))
  const dash = (p / 100) * c
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 0.7s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="stat-value text-xl leading-none">
          {value.toFixed(decimals)}
          <span className="text-xs ml-0.5">{unit}</span>
        </span>
        {label && <span className="hud-label mt-1">{label}</span>}
      </div>
    </div>
  )
}

/** 排行条目 */
export function RankItem({
  rank,
  label,
  sub,
  value,
  color = '#22d3ee',
  percent,
}: {
  rank: number
  label: string
  sub?: string
  value: string
  color?: string
  percent?: number
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <span
        className="w-5 h-5 shrink-0 flex items-center justify-center rounded-sm text-[10px] font-bold font-mono"
        style={{
          color: rank <= 3 ? '#03070f' : color,
          background: rank <= 3 ? color : 'transparent',
          border: `1px solid ${color}55`,
        }}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-slate-200 truncate">{label}</div>
        {percent !== undefined && (
          <div className="h-0.5 mt-1 rounded-full bg-void-700 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${percent}%`, background: color }} />
          </div>
        )}
        {sub && <div className="text-[9px] text-slate-500 font-mono truncate">{sub}</div>}
      </div>
      <span className="text-[12px] font-mono font-semibold shrink-0" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

/** 空状态 */
export function EmptyState({ text = '暂无数据', icon = '◎' }: { text?: string; icon?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
      <span className="text-3xl opacity-40">{icon}</span>
      <span className="text-xs">{text}</span>
    </div>
  )
}
