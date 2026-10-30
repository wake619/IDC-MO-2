import { useMemo, useState } from 'react'
import Panel from '../components/Panel'
import ChartBox from '../components/ChartBox'
import { FilterChip, WaterBar, EmptyState } from '../components/ui'
import { HealthBadge } from '../components/Badges'
import { useSimStore } from '../stores/simStore'
import { heatmapOption } from '../theme/chartOptions'
import { COLORS, HEALTH_COLOR, tempToColor, utilToColor } from '../theme/colors'
import type { GpuModel, GpuNode, HealthLevel } from '../types'

const PAGE_SIZE = 24

export default function GpuCluster() {
  const nodes = useSimStore((s) => s.nodes)
  const [hall, setHall] = useState<'全部' | 'A' | 'B'>('全部')
  const [model, setModel] = useState<'全部' | GpuModel>('全部')
  const [statuses, setStatuses] = useState<HealthLevel[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<GpuNode | null>(null)
  const [heatMetric, setHeatMetric] = useState<'temp' | 'util'>('temp')

  const toggleStatus = (s: HealthLevel) =>
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const filtered = useMemo(() => {
    return nodes.filter((n) => {
      if (hall !== '全部' && n.hall !== hall) return false
      if (model !== '全部' && n.model !== model) return false
      if (statuses.length && !statuses.includes(n.status)) return false
      if (search && !n.id.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [nodes, hall, model, statuses, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageNodes = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  // 热力图：采样 48 个节点 x 8 GPU
  const heat = useMemo(() => {
    const sample = filtered.length ? filtered : nodes
    const step = Math.max(1, Math.floor(sample.length / 48))
    const cols = sample.filter((_, i) => i % step === 0).slice(0, 48)
    const xLabels = cols.map((c) => c.id.slice(-6))
    const yLabels = Array.from({ length: 8 }, (_, i) => `GPU${i}`)
    const data: Array<[number, number, number]> = []
    cols.forEach((c, xi) => {
      c.gpus.forEach((g, yi) => {
        data.push([xi, yi, heatMetric === 'temp' ? g.temp : g.util])
      })
    })
    return { xLabels, yLabels, data }
  }, [filtered, nodes, heatMetric])

  // 实时刷新选中节点
  const liveSelected = selected ? nodes.find((n) => n.id === selected.id) ?? selected : null

  return (
    <div className="h-full w-full flex flex-col gap-2 p-2 overflow-hidden">
      {/* 筛选栏 */}
      <div className="shrink-0 panel corner-frame px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1.5">
          <span className="hud-label">机房</span>
          {(['全部', 'A', 'B'] as const).map((h) => (
            <FilterChip key={h} active={hall === h} onClick={() => { setHall(h); setPage(0) }}>
              {h === '全部' ? '全部' : `${h} 栋`}
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hud-label">型号</span>
          {(['全部', 'H100', 'A100', '910B'] as const).map((m) => (
            <FilterChip key={m} active={model === m} onClick={() => { setModel(m); setPage(0) }} color={COLORS.purple}>
              {m}
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hud-label">状态</span>
          {(['normal', 'warning', 'critical', 'offline'] as HealthLevel[]).map((s) => (
            <FilterChip key={s} active={statuses.includes(s)} onClick={() => { toggleStatus(s); setPage(0) }} color={HEALTH_COLOR[s]}>
              {s === 'normal' ? '正常' : s === 'warning' ? '警告' : s === 'critical' ? '严重' : '离线'}
              <span className="ml-1 opacity-60">{nodes.filter((n) => n.status === s).length}</span>
            </FilterChip>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="搜索节点 ID…"
          className="ml-auto bg-void-850 border border-cyber-500/20 rounded-sm px-2 py-1 text-[11px] text-slate-200 placeholder-slate-600 outline-none focus:border-cyber-400/60 w-40"
        />
        <span className="text-[11px] text-slate-400 font-mono">
          共 <span className="text-cyber-glow font-bold">{filtered.length}</span> 节点 / {filtered.length * 8} GPU
        </span>
      </div>

      {/* 主体：卡片墙 + 热力图 */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2">
        {/* 节点卡片墙 */}
        <Panel
          title="GPU 节点卡片墙"
          className="col-span-12 xl:col-span-8 min-h-0"
          bodyClassName="overflow-y-auto"
          actions={
            <div className="flex items-center gap-1">
              <button className="btn btn-ghost px-2" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                ‹
              </button>
              <span className="text-[11px] font-mono text-slate-400 px-1">
                {safePage + 1}/{pageCount}
              </span>
              <button className="btn btn-ghost px-2" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
                ›
              </button>
            </div>
          }
        >
          {pageNodes.length === 0 ? (
            <EmptyState text="无匹配节点" />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2">
              {pageNodes.map((n) => (
                <NodeCard key={n.id} node={n} onClick={() => setSelected(n)} />
              ))}
            </div>
          )}
        </Panel>

        {/* 热力图 */}
        <Panel
          title={`GPU ${heatMetric === 'temp' ? '温度' : '利用率'}热力图`}
          subtitle="采样节点 × 8 卡位"
          className="col-span-12 xl:col-span-4 min-h-0"
          bodyClassName="p-1"
          actions={
            <div className="flex gap-1">
              <FilterChip active={heatMetric === 'temp'} onClick={() => setHeatMetric('temp')} color={COLORS.alarm}>温度</FilterChip>
              <FilterChip active={heatMetric === 'util'} onClick={() => setHeatMetric('util')}>利用率</FilterChip>
            </div>
          }
        >
          <ChartBox
            className="h-full min-h-[300px]"
            option={heatmapOption(heat.xLabels, heat.yLabels, heat.data, {
              max: heatMetric === 'temp' ? 95 : 100,
              unit: heatMetric === 'temp' ? '°C' : '%',
              visualColors:
                heatMetric === 'temp'
                  ? ['#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e']
                  : ['#0e7490', '#22d3ee', '#a78bfa', '#f59e0b', '#f43f5e'],
            })}
          />
        </Panel>
      </div>

      {/* 节点详情抽屉 */}
      {liveSelected && <NodeDrawer node={liveSelected} onClose={() => setSelected(null)} />}
    </div>
  )
}

/** 单个节点卡片：8 个 GPU 小格 */
function NodeCard({ node, onClick }: { node: GpuNode; onClick: () => void }) {
  const border = HEALTH_COLOR[node.status]
  return (
    <button
      onClick={onClick}
      className="text-left panel p-2 transition-all hover:border-cyber-400/50 group relative overflow-hidden"
      style={{ borderColor: `${border}44` }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[11px] text-slate-200 truncate">{node.id}</span>
        <HealthBadge level={node.status} showLabel={false} />
      </div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] px-1 py-px rounded-sm border border-cyber-500/30 text-cyber-400/80 font-mono">
          {node.model}
        </span>
        <span className="text-[10px] text-slate-500 font-mono">{node.ip}</span>
        <span className="ml-auto text-[10px] font-mono" style={{ color: border }}>
          健康 {node.healthScore}
        </span>
      </div>
      {/* 8 GPU 格子 */}
      <div className="grid grid-cols-8 gap-0.5">
        {node.gpus.map((g) => (
          <div
            key={g.index}
            className="h-6 rounded-sm flex items-end justify-center relative overflow-hidden"
            title={`GPU${g.index}: ${g.util.toFixed(0)}% / ${g.temp.toFixed(0)}°C`}
            style={{ background: `${utilToColor(g.util)}22`, border: `1px solid ${utilToColor(g.util)}55` }}
          >
            <div
              className="w-full transition-all duration-700"
              style={{ height: `${g.util}%`, background: utilToColor(g.util), opacity: 0.7 }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono">
        <span className="text-slate-400">
          利用率 <span style={{ color: utilToColor(node.util) }}>{node.util.toFixed(0)}%</span>
        </span>
        <span className="text-slate-400">
          温度 <span style={{ color: tempToColor(node.temp) }}>{node.temp.toFixed(0)}°C</span>
        </span>
        <span className="text-slate-400">
          功耗 <span className="text-amber-400">{(node.power / 1000).toFixed(2)}kW</span>
        </span>
      </div>
    </button>
  )
}

/** 节点详情抽屉 */
function NodeDrawer({ node, onClose }: { node: GpuNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-[560px] max-w-full h-full bg-void-900 border-l border-cyber-500/30 shadow-panel overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-lg text-white tracking-wide">{node.id}</h2>
            <p className="text-[11px] text-slate-500 font-mono">
              {node.model} · {node.ip} · {node.hall} 栋 R{node.row} C{node.rack}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost">✕ 关闭</button>
        </div>

        {/* 概览 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Metric label="平均利用率" value={`${node.util.toFixed(1)}%`} color={utilToColor(node.util)} />
          <Metric label="平均温度" value={`${node.temp.toFixed(1)}°C`} color={tempToColor(node.temp)} />
          <Metric label="整机功耗" value={`${(node.power / 1000).toFixed(2)}kW`} color={COLORS.amber} />
          <Metric label="健康评分" value={`${node.healthScore}`} color={HEALTH_COLOR[node.status]} />
        </div>

        {/* 每卡详情表 */}
        <div className="panel-title text-[12px] mb-2">8 卡实时指标</div>
        <div className="space-y-1.5 mb-4">
          {node.gpus.map((g) => (
            <div key={g.index} className="panel p-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[11px] text-cyber-glow w-12">GPU{g.index}</span>
                <HealthBadge level={g.level} />
                <span className="ml-auto text-[10px] font-mono text-slate-400">
                  NVLink {g.nvlink.toFixed(0)} GB/s · ECC {g.eccErrors}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Bar label="利用率" value={g.util} max={100} unit="%" color={utilToColor(g.util)} />
                <Bar label="显存" value={g.memUtil} max={100} unit="%" color={COLORS.purple} />
                <Bar label="温度" value={g.temp} max={95} unit="°C" color={tempToColor(g.temp)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="panel p-2 text-center">
      <div className="text-lg font-mono font-bold" style={{ color }}>
        {value}
      </div>
      <div className="hud-label mt-0.5">{label}</div>
    </div>
  )
}

function Bar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  return (
    <div>
      <WaterBar percent={(value / max) * 100} color={color} height={4} label={label} right={`${value.toFixed(0)}${unit}`} />
    </div>
  )
}
