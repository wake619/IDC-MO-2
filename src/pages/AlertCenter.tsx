import { useMemo, useState } from 'react'
import Panel from '../components/Panel'
import ChartBox from '../components/ChartBox'
import Sparkline from '../components/Sparkline'
import { FilterChip, RankItem, EmptyState } from '../components/ui'
import { LevelBadge, AlertStatusBadge, LevelTag } from '../components/Badges'
import { useSimStore } from '../stores/simStore'
import { stackedAreaOption } from '../theme/chartOptions'
import { COLORS, LEVEL_COLOR } from '../theme/colors'
import type { AlertItem, AlertLevel, AlertSource, AlertStatus } from '../types'

const LEVELS: AlertLevel[] = ['P0', 'P1', 'P2', 'P3']
const SOURCES: AlertSource[] = ['GPU', '节点', '网络', '存储', '供电', '制冷']
const STATUSES: Array<{ key: AlertStatus | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '活跃' },
  { key: 'acked', label: '已确认' },
  { key: 'silenced', label: '已静默' },
  { key: 'resolved', label: '已恢复' },
]

export default function AlertCenter() {
  const alerts = useSimStore((s) => s.alerts)
  const utilSeries = useSimStore((s) => s.utilSeries)
  const ackAlert = useSimStore((s) => s.ackAlert)
  const silenceAlert = useSimStore((s) => s.silenceAlert)
  const resolveAlert = useSimStore((s) => s.resolveAlert)

  const [level, setLevel] = useState<AlertLevel | 'all'>('all')
  const [source, setSource] = useState<AlertSource | 'all'>('all')
  const [status, setStatus] = useState<AlertStatus | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      alerts.filter((a) => {
        if (level !== 'all' && a.level !== level) return false
        if (source !== 'all' && a.source !== source) return false
        if (status !== 'all' && a.status !== status) return false
        return true
      }),
    [alerts, level, source, status],
  )

  const selected = alerts.find((a) => a.id === selectedId) ?? filtered[0] ?? null

  // 24h 告警趋势（按等级堆叠，确定性演示数据 + 实时增量）
  const trend = useMemo(() => buildTrend(alerts), [alerts])

  // Top 告警源
  const topSources = useMemo(() => {
    const map = new Map<string, number>()
    alerts.forEach((a) => map.set(a.source, (map.get(a.source) ?? 0) + 1))
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [alerts])

  // MTTA / MTTR
  const mttaMttr = useMemo(() => {
    const acked = alerts.filter((a) => a.ackAt)
    const resolved = alerts.filter((a) => a.resolveAt)
    const mtta = acked.length
      ? acked.reduce((s, a) => s + ((a.ackAt ?? 0) - a.timestamp), 0) / acked.length / 1000
      : 42
    const mttr = resolved.length
      ? resolved.reduce((s, a) => s + ((a.resolveAt ?? 0) - a.timestamp), 0) / resolved.length / 1000
      : 186
    return { mtta: mtta || 42, mttr: mttr || 186 }
  }, [alerts])

  const activeCount = alerts.filter((a) => a.status === 'active').length

  return (
    <div className="h-full w-full flex flex-col gap-2 p-2 overflow-hidden">
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2">
        {/* 左栏：统计 */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2 min-h-0">
          <Panel title="告警概览" className="shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <BigStat label="活跃告警" value={activeCount} color={COLORS.alarm} />
              <BigStat label="今日累计" value={alerts.length} color={COLORS.cyber} />
              <BigStat label="MTTA" value={mttaMttr.mtta.toFixed(0)} unit="s" color={COLORS.amber} />
              <BigStat label="MTTR" value={mttaMttr.mttr.toFixed(0)} unit="s" color={COLORS.purple} />
            </div>
          </Panel>

          <Panel title="24h 告警趋势" subtitle="按等级堆叠" className="shrink-0">
            <ChartBox className="h-[150px]" option={trend} />
          </Panel>

          <Panel title="Top 告警源" className="flex-1 min-h-0" bodyClassName="overflow-y-auto">
            {topSources.map((s, i) => (
              <RankItem
                key={s.name}
                rank={i + 1}
                label={s.name}
                value={`${s.value}`}
                color={i < 2 ? COLORS.alarm : COLORS.cyber}
                percent={(s.value / (topSources[0]?.value || 1)) * 100}
              />
            ))}
          </Panel>
        </div>

        {/* 中栏：告警流 */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-2 min-h-0">
          {/* 筛选 */}
          <div className="shrink-0 panel corner-frame px-3 py-2 flex flex-wrap gap-x-3 gap-y-1.5 items-center">
            <div className="flex items-center gap-1">
              <span className="hud-label">等级</span>
              <FilterChip active={level === 'all'} onClick={() => setLevel('all')}>全部</FilterChip>
              {LEVELS.map((l) => (
                <FilterChip key={l} active={level === l} onClick={() => setLevel(l)} color={LEVEL_COLOR[l]}>
                  {l}
                </FilterChip>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="hud-label">状态</span>
              {STATUSES.map((s) => (
                <FilterChip key={s.key} active={status === s.key} onClick={() => setStatus(s.key)} color={COLORS.online}>
                  {s.label}
                </FilterChip>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="hud-label">来源</span>
              <FilterChip active={source === 'all'} onClick={() => setSource('all')} color={COLORS.purple}>全部</FilterChip>
              {SOURCES.map((s) => (
                <FilterChip key={s} active={source === s} onClick={() => setSource(s)} color={COLORS.purple}>
                  {s}
                </FilterChip>
              ))}
            </div>
          </div>

          <Panel
            title="实时告警流"
            subtitle={`${filtered.length} 条`}
            className="flex-1 min-h-0"
            bodyClassName="p-0 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <EmptyState text="当前筛选无告警" icon="✓" />
            ) : (
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-void-850/95 backdrop-blur z-10">
                  <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="px-2 py-1.5 font-medium">等级</th>
                    <th className="px-2 py-1.5 font-medium">告警内容</th>
                    <th className="px-2 py-1.5 font-medium">对象</th>
                    <th className="px-2 py-1.5 font-medium">来源</th>
                    <th className="px-2 py-1.5 font-medium">时间</th>
                    <th className="px-2 py-1.5 font-medium">状态</th>
                    <th className="px-2 py-1.5 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={`table-row cursor-pointer ${selected?.id === a.id ? 'bg-cyber-500/10' : ''}`}
                    >
                      <td className="px-2 py-1.5"><LevelBadge level={a.level} size="xs" /></td>
                      <td className="px-2 py-1.5">
                        <div className="text-[12px] text-slate-200">{a.title}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{a.value}</div>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[11px] text-cyber-400/90">{a.target}</td>
                      <td className="px-2 py-1.5 text-[11px] text-slate-400">{a.source}</td>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500">{fmtAgo(a.timestamp)}</td>
                      <td className="px-2 py-1.5"><AlertStatusBadge status={a.status} /></td>
                      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          {a.status === 'active' && (
                            <button className="btn btn-ghost px-1.5 py-0.5 text-[10px]" onClick={() => ackAlert(a.id)}>
                              确认
                            </button>
                          )}
                          {(a.status === 'active' || a.status === 'acked') && (
                            <>
                              <button className="btn btn-ghost px-1.5 py-0.5 text-[10px]" onClick={() => silenceAlert(a.id)}>
                                静默
                              </button>
                              <button className="btn btn-cyber px-1.5 py-0.5 text-[10px]" onClick={() => resolveAlert(a.id)}>
                                恢复
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        {/* 右栏：告警详情 */}
        <div className="col-span-12 lg:col-span-3 min-h-0">
          <Panel title="告警详情" className="h-full min-h-0" bodyClassName="overflow-y-auto">
            {selected ? (
              <AlertDetail alert={selected} utilSeries={utilSeries.map((p) => p.v)} />
            ) : (
              <EmptyState text="选择一条告警查看详情" />
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function BigStat({ label, value, unit, color }: { label: string; value: number | string; unit?: string; color: string }) {
  return (
    <div className="bg-void-850/70 rounded-sm p-2 border border-cyber-500/10 text-center">
      <div className="text-xl font-mono font-bold" style={{ color }}>
        {value}
        {unit && <span className="text-[10px] ml-0.5 opacity-70">{unit}</span>}
      </div>
      <div className="hud-label mt-0.5">{label}</div>
    </div>
  )
}

/** 告警详情：时间线 + 指标快照 + 根因拓扑 */
function AlertDetail({ alert, utilSeries }: { alert: AlertItem; utilSeries: number[] }) {
  const timeline = [
    { t: alert.timestamp, label: '告警触发', color: COLORS.alarm },
    ...(alert.ackAt ? [{ t: alert.ackAt, label: '运维确认', color: COLORS.amber }] : []),
    ...(alert.resolveAt ? [{ t: alert.resolveAt, label: '告警恢复', color: COLORS.online }] : []),
  ]
  const chain = [
    { name: 'GPU 卡', icon: '▦', active: alert.source === 'GPU' },
    { name: '计算节点', icon: '🖥', active: alert.source === '节点' },
    { name: 'IB 交换机', icon: '⇄', active: alert.source === '网络' },
    { name: '并行存储', icon: '▤', active: alert.source === '存储' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <LevelBadge level={alert.level} />
        <div className="min-w-0">
          <div className="text-[13px] text-white font-semibold">{alert.title}</div>
          <LevelTag level={alert.level} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <InfoCell label="告警对象" value={alert.target} mono />
        <InfoCell label="来源类别" value={alert.source} />
        <InfoCell label="触发值" value={alert.value} mono />
        <InfoCell label="当前状态" value={statusLabel(alert.status)} />
      </div>

      {/* 关联指标快照 */}
      <div>
        <div className="hud-label mb-1">关联指标快照（近 60s）</div>
        <div className="panel p-2">
          <Sparkline data={utilSeries.slice(-60)} width={240} height={54} color={LEVEL_COLOR[alert.level]} />
        </div>
      </div>

      {/* 时间线 */}
      <div>
        <div className="hud-label mb-1.5">处置时间线</div>
        <div className="relative pl-4">
          <div className="absolute left-1 top-1 bottom-1 w-px bg-cyber-500/20" />
          {timeline.map((e, i) => (
            <div key={i} className="relative mb-2.5">
              <span
                className="absolute -left-3.5 top-0.5 w-2 h-2 rounded-full"
                style={{ background: e.color, boxShadow: `0 0 6px ${e.color}` }}
              />
              <div className="text-[11px] text-slate-300">{e.label}</div>
              <div className="text-[10px] text-slate-500 font-mono">{new Date(e.t).toLocaleTimeString('zh-CN')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 根因拓扑链路 */}
      <div>
        <div className="hud-label mb-1.5">根因定位链路</div>
        <div className="flex items-center justify-between gap-1">
          {chain.map((c, i) => (
            <div key={c.name} className="flex items-center gap-1 flex-1">
              <div
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-sm border"
                style={{
                  borderColor: c.active ? `${COLORS.alarm}88` : 'rgba(34,211,238,0.15)',
                  background: c.active ? `${COLORS.alarm}18` : 'rgba(6,13,26,0.5)',
                  boxShadow: c.active ? `0 0 12px ${COLORS.alarm}44` : 'none',
                }}
              >
                <span className="text-base" style={{ color: c.active ? COLORS.alarm : COLORS.cyber }}>
                  {c.icon}
                </span>
                <span className={`text-[9px] ${c.active ? 'text-alarm-400' : 'text-slate-400'}`}>{c.name}</span>
              </div>
              {i < chain.length - 1 && <span className="text-cyber-500/40 text-[10px]">→</span>}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
          AI 根因分析：告警定位于 <span className="text-cyber-400">{alert.source}</span> 层，建议优先排查
          <span className="text-alarm-400"> {alert.target}</span> 及其上游依赖链路。
        </p>
      </div>
    </div>
  )
}

function InfoCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-void-850/60 rounded-sm px-2 py-1.5 border border-cyber-500/10">
      <div className="text-[9px] text-slate-500">{label}</div>
      <div className={`text-[11px] text-slate-200 truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}

function statusLabel(s: AlertStatus): string {
  return { active: '活跃', acked: '已确认', silenced: '已静默', resolved: '已恢复' }[s]
}

function fmtAgo(t: number): string {
  const diff = Math.max(0, Date.now() - t) / 1000
  if (diff < 60) return `${diff.toFixed(0)}s 前`
  if (diff < 3600) return `${(diff / 60).toFixed(0)}m 前`
  return `${(diff / 3600).toFixed(1)}h 前`
}

/** 构造 24h 分级堆叠趋势（确定性演示 + 实时活跃数微调） */
function buildTrend(alerts: AlertItem[]) {
  const nowHour = new Date().getHours()
  const labels = Array.from({ length: 24 }, (_, i) =>
    `${String((nowHour - 23 + i + 24) % 24).padStart(2, '0')}:00`,
  )
  const activeNow = alerts.filter((a) => a.status === 'active').length
  const mk = (base: number, amp: number, phase: number, extraLast = 0) =>
    labels.map((_, i) => {
      const v = Math.max(0, Math.round(base + Math.sin((i + phase) / 3.2) * amp + ((i * 7) % 3)))
      return i === labels.length - 1 ? v + extraLast : v
    })
  return stackedAreaOption(labels, [
    { name: 'P0', data: mk(1, 1, 0, Math.min(3, Math.floor(activeNow / 4))), color: LEVEL_COLOR.P0 },
    { name: 'P1', data: mk(4, 2, 2, Math.min(5, activeNow)), color: LEVEL_COLOR.P1 },
    { name: 'P2', data: mk(8, 3, 4, 0), color: LEVEL_COLOR.P2 },
    { name: 'P3', data: mk(12, 4, 6, 0), color: LEVEL_COLOR.P3 },
  ])
}
