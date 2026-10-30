import { useMemo } from 'react'
import DataCenterScene from '../components/scene/DataCenterScene'
import { FilterChip } from '../components/ui'
import { useSimStore } from '../stores/simStore'
import { tempToColor, utilToColor, COLORS } from '../theme/colors'
import type { ViewMode } from '../types'

const VIEW_MODES: Array<{ key: ViewMode; label: string; icon: string }> = [
  { key: 'temperature', label: '温度热力', icon: '🌡' },
  { key: 'load', label: '负载视图', icon: '▦' },
  { key: 'alert', label: '告警视图', icon: '⚠' },
  { key: 'topology', label: '线缆拓扑', icon: '⛓' },
]

export default function DataCenter3D() {
  const racks = useSimStore((s) => s.racks)
  const nodes = useSimStore((s) => s.nodes)
  const viewMode = useSimStore((s) => s.viewMode)
  const setViewMode = useSimStore((s) => s.setViewMode)
  const selectedRackId = useSimStore((s) => s.selectedRackId)
  const selectRack = useSimStore((s) => s.selectRack)
  const tourActive = useSimStore((s) => s.tourActive)
  const toggleTour = useSimStore((s) => s.toggleTour)

  const stats = useMemo(() => {
    const critical = nodes.filter((n) => n.status === 'critical').length
    const warning = nodes.filter((n) => n.status === 'warning').length
    const avgTemp = nodes.reduce((s, n) => s + n.temp, 0) / nodes.length
    const avgUtil = nodes.reduce((s, n) => s + n.util, 0) / nodes.length
    const totalPower = racks.reduce((s, r) => s + r.power, 0)
    const hotRacks = racks.filter((r) => r.level !== 'normal').length
    return { critical, warning, avgTemp, avgUtil, totalPower, hotRacks }
  }, [nodes, racks])

  const selectedRack = racks.find((r) => r.id === selectedRackId)

  return (
    <div className="relative h-full w-full">
      {/* 3D 场景全屏铺满 */}
      <div className="absolute inset-0">
        <DataCenterScene
          racks={racks}
          nodes={nodes}
          viewMode={viewMode}
          selectedRackId={selectedRackId}
          onSelectRack={selectRack}
          tourActive={tourActive}
        />
      </div>

      {/* 顶部视图模式切换 */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 panel corner-frame px-3 py-2">
        <span className="hud-label mr-1">视图模式</span>
        {VIEW_MODES.map((m) => (
          <FilterChip
            key={m.key}
            active={viewMode === m.key}
            onClick={() => setViewMode(m.key)}
          >
            <span className="mr-1">{m.icon}</span>
            {m.label}
          </FilterChip>
        ))}
        <div className="w-px h-5 bg-cyber-500/20 mx-1" />
        <FilterChip active={tourActive} onClick={toggleTour} color={COLORS.purple}>
          {tourActive ? '⏸ 停止巡检' : '🎥 自动巡检'}
        </FilterChip>
      </div>

      {/* 左侧统计面板 */}
      <div className="absolute top-3 left-3 z-10 w-52 panel corner-frame p-3 space-y-2.5">
        <div className="panel-title text-[12px]">机房实时态势</div>
        <StatLine label="机柜总数" value={`${racks.length}`} unit="个" color={COLORS.cyber} />
        <StatLine label="GPU 节点" value={`${nodes.length}`} unit="台" color={COLORS.purple} />
        <StatLine label="平均温度" value={stats.avgTemp.toFixed(1)} unit="°C" color={tempToColor(stats.avgTemp)} />
        <StatLine label="平均利用率" value={stats.avgUtil.toFixed(1)} unit="%" color={utilToColor(stats.avgUtil)} />
        <StatLine label="总功耗" value={(stats.totalPower / 1000).toFixed(2)} unit="MW" color={COLORS.amber} />
        <StatLine label="严重节点" value={`${stats.critical}`} unit="台" color={COLORS.alarm} />
        <StatLine label="告警机柜" value={`${stats.hotRacks}`} unit="个" color={COLORS.alarm} />
        {/* 色标图例 */}
        <div className="pt-2 border-t border-cyber-500/10">
          <div className="hud-label mb-1.5">
            {viewMode === 'temperature' ? '温度色标 (°C)' : viewMode === 'load' ? '负载色标 (%)' : '状态图例'}
          </div>
          <Legend mode={viewMode} />
        </div>
      </div>

      {/* 右下角操作提示 */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 text-[10px] text-slate-500 font-mono panel px-3 py-1.5">
        🖱 左键旋转 · 右键平移 · 滚轮缩放 · 点击机柜查看详情
        {selectedRack && <span className="text-cyber-400 ml-2">当前: {selectedRack.id}</span>}
      </div>
    </div>
  )
}

function StatLine({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="font-mono font-semibold text-sm" style={{ color }}>
        {value}
        <span className="text-[9px] ml-0.5 opacity-70">{unit}</span>
      </span>
    </div>
  )
}

function Legend({ mode }: { mode: ViewMode }) {
  if (mode === 'temperature') {
    return (
      <div>
        <div className="h-2 rounded-full w-full" style={{ background: 'linear-gradient(90deg,#2563eb,#06b6d4,#10b981,#f59e0b,#f43f5e)' }} />
        <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
          <span>20</span>
          <span>45</span>
          <span>65</span>
          <span>90</span>
        </div>
      </div>
    )
  }
  if (mode === 'load') {
    return (
      <div>
        <div className="h-2 rounded-full w-full" style={{ background: 'linear-gradient(90deg,#0891b2,#22d3ee,#f59e0b,#f43f5e)' }} />
        <div className="flex justify-between text-[9px] text-slate-500 mt-0.5 font-mono">
          <span>0%</span>
          <span>50%</span>
          <span>85%</span>
          <span>100%</span>
        </div>
      </div>
    )
  }
  const items =
    mode === 'alert'
      ? [
          { c: '#f43f5e', t: '严重告警' },
          { c: '#f59e0b', t: '警告' },
          { c: '#0e7490', t: '正常' },
        ]
      : [
          { c: '#22d3ee', t: 'IB 骨干链路' },
          { c: '#0891b2', t: '机柜' },
        ]
  return (
    <div className="space-y-1">
      {items.map((it) => (
        <div key={it.t} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: it.c, boxShadow: `0 0 6px ${it.c}` }} />
          <span className="text-[10px] text-slate-400">{it.t}</span>
        </div>
      ))}
    </div>
  )
}
