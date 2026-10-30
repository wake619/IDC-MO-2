import { useMemo, useState } from 'react'
import Panel from '../components/Panel'
import ChartBox from '../components/ChartBox'
import { WaterBar } from '../components/ui'
import { useSimStore } from '../stores/simStore'
import { COLORS } from '../theme/colors'
import type { EChartsOption } from 'echarts'

// 资源基线
const GPU_TOTAL = 6144
const STORAGE_TOTAL_PB = 240
const NET_TOTAL_TB = 512

export default function CapacityPlanning() {
  const jobs = useSimStore((s) => s.jobs)
  const nodes = useSimStore((s) => s.nodes)
  const [growth, setGrowth] = useState(8) // 月增长率 %

  const usedGpu = useMemo(
    () => jobs.filter((j) => j.status === 'running').reduce((s, j) => s + j.gpuRequest, 0),
    [jobs],
  )
  // 存储已用（随在线节点数轻微波动）
  const usedStorage = useMemo(() => 150 + nodes.filter((n) => n.status !== 'offline').length * 0.02, [nodes])
  const usedNet = useMemo(() => 180 + (usedGpu / GPU_TOTAL) * 220, [usedGpu])

  const resources = [
    { key: 'gpu', name: 'GPU 算力', used: usedGpu, total: GPU_TOTAL, unit: '卡', color: COLORS.cyber },
    { key: 'storage', name: '存储容量', used: usedStorage, total: STORAGE_TOTAL_PB, unit: 'PB', color: COLORS.purple },
    { key: 'net', name: '网络带宽', used: usedNet, total: NET_TOTAL_TB, unit: 'Tb/s', color: COLORS.online },
  ]

  // 剩余可用天数（线性外推：当前用量按 growth 月增长）
  const withDays = resources.map((r) => {
    const dailyGrowth = (r.used * (growth / 100)) / 30
    const remain = r.total - r.used
    const days = dailyGrowth > 0 ? remain / dailyGrowth : Infinity
    return { ...r, percent: (r.used / r.total) * 100, remainDays: Math.min(9999, Math.round(days)) }
  })

  // 增长预测曲线（12 月历史 + 6 月预测，带置信区间）
  const forecast = useMemo(() => buildForecast(usedGpu, growth), [usedGpu, growth])

  // 采购建议：覆盖未来 12 个月需求
  const suggestion = useMemo(() => {
    const demandIn12 = usedGpu * Math.pow(1 + growth / 100, 12)
    const gap = Math.max(0, demandIn12 - GPU_TOTAL)
    const servers = Math.ceil(gap / 8) // 每台 8 卡
    const racks = Math.ceil(servers / 4) // 每机柜 4 台
    const capex = servers * 220 // 万元/台（H100 服务器约 220 万）
    return { demandIn12, gap, servers, racks, capex }
  }, [usedGpu, growth])

  return (
    <div className="h-full w-full overflow-y-auto p-2 space-y-2">
      {/* 容量水位 */}
      <div className="grid grid-cols-12 gap-2">
        {withDays.map((r) => (
          <Panel key={r.key} title={`${r.name}容量水位`} className="col-span-12 md:col-span-4 h-[168px]">
            <div className="flex items-baseline justify-between mb-2">
              <div>
                <span className="stat-value text-3xl" style={{ color: r.color }}>
                  {r.used.toFixed(r.key === 'gpu' ? 0 : 1)}
                </span>
                <span className="text-xs text-slate-500 ml-1">/ {r.total} {r.unit}</span>
              </div>
              <span className="text-lg font-mono font-bold" style={{ color: r.color }}>
                {r.percent.toFixed(1)}%
              </span>
            </div>
            <WaterBar percent={r.percent} color={r.color} height={8} />
            <div className="flex items-center justify-between mt-3 text-[11px]">
              <span className="text-slate-400">
                剩余可用 <span className="font-mono font-bold" style={{ color: r.remainDays < 90 ? COLORS.alarm : r.remainDays < 180 ? COLORS.amber : COLORS.online }}>{r.remainDays >= 9999 ? '∞' : r.remainDays}</span> 天
              </span>
              <span className="text-slate-500 font-mono">
                空闲 {(r.total - r.used).toFixed(r.key === 'gpu' ? 0 : 1)} {r.unit}
              </span>
            </div>
          </Panel>
        ))}
      </div>

      {/* 预测 + 情景模拟 */}
      <div className="grid grid-cols-12 gap-2">
        <Panel
          title="算力需求增长趋势与预测"
          subtitle="历史 12 月（实线）+ 预测 6 月（虚线带置信区间）"
          className="col-span-12 lg:col-span-8 h-[340px]"
        >
          <ChartBox option={forecast} />
        </Panel>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-2">
          <Panel title="扩容情景模拟" className="shrink-0">
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="hud-label">业务月增长率</span>
                <span className="stat-value text-xl" style={{ color: COLORS.cyber }}>{growth}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                value={growth}
                onChange={(e) => setGrowth(+e.target.value)}
                className="w-full accent-cyan-400"
              />
              <div className="flex justify-between text-[9px] text-slate-600 font-mono mt-0.5">
                <span>0%</span><span>10%</span><span>20%</span><span>30%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <SimStat label="12月后需求" value={`${Math.round(suggestion.demandIn12)} 卡`} color={COLORS.purple} />
              <SimStat
                label="资源缺口"
                value={suggestion.gap > 0 ? `${Math.round(suggestion.gap)} 卡` : '充足'}
                color={suggestion.gap > 0 ? COLORS.alarm : COLORS.online}
              />
            </div>
          </Panel>

          <Panel title="采购与扩容建议" className="flex-1 min-h-0" bodyClassName="space-y-2">
            {suggestion.gap > 0 ? (
              <>
                <BuyRow icon="🖥" label="GPU 服务器" value={`${suggestion.servers} 台`} note="8 卡 H100 SXM5" color={COLORS.cyber} />
                <BuyRow icon="🗄" label="新增机柜" value={`${suggestion.racks} 个`} note="含液冷改造" color={COLORS.purple} />
                <BuyRow icon="⇄" label="IB 交换机" value={`${Math.ceil(suggestion.racks / 2)} 台`} note="Q3200 骨干" color={COLORS.online} />
                <BuyRow icon="💰" label="预计投资" value={`${(suggestion.capex / 10000).toFixed(2)} 亿元`} note="CAPEX 估算" color={COLORS.amber} />
                <p className="text-[10px] text-slate-500 leading-relaxed pt-1 border-t border-cyber-500/10">
                  建议分批采购：首期 40% 于 Q1 交付，二期 60% 于 Q3 交付，匹配业务增长曲线，降低闲置风险。
                </p>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <span className="text-4xl text-online-400">✓</span>
                <p className="text-[12px] text-slate-400">当前增长率下，12 个月内资源充足</p>
                <p className="text-[10px] text-slate-600">建议在利用率持续高于 85% 时启动扩容评估</p>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function SimStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-void-850/70 rounded-sm p-2 border border-cyber-500/10 text-center">
      <div className="text-[15px] font-mono font-bold" style={{ color }}>{value}</div>
      <div className="hud-label mt-0.5">{label}</div>
    </div>
  )
}

function BuyRow({ icon, label, value, note, color }: { icon: string; label: string; value: string; note: string; color: string }) {
  return (
    <div className="flex items-center gap-2 panel p-2">
      <span className="text-lg" style={{ color }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-slate-200">{label}</div>
        <div className="text-[10px] text-slate-500">{note}</div>
      </div>
      <span className="text-[13px] font-mono font-bold shrink-0" style={{ color }}>{value}</span>
    </div>
  )
}

/** 构造增长预测 ECharts 配置（历史实线 + 预测虚线 + 置信区间带） */
function buildForecast(currentGpu: number, growthPct: number): EChartsOption {
  const months: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // 历史：反推 12 个月，按增长率回退 + 噪声
  const g = growthPct / 100
  const history: number[] = []
  for (let i = 11; i >= 0; i--) {
    const base = currentGpu / Math.pow(1 + g, i)
    history.push(Math.round(base * (0.96 + ((i * 13) % 7) / 100)))
  }
  // 预测：向后外推 6 个月
  const forecast: number[] = []
  const upper: number[] = []
  const lower: number[] = []
  for (let i = 1; i <= 6; i++) {
    const v = currentGpu * Math.pow(1 + g, i)
    forecast.push(Math.round(v))
    upper.push(Math.round(v * (1 + 0.04 * i)))
    lower.push(Math.round(v * (1 - 0.035 * i)))
  }

  const splitIdx = 11 // 历史最后一个点索引
  // 置信带：下界作为透明堆叠基，(upper-lower) 作为可见区间
  const bandBase = months.map((_, i) => (i <= splitIdx ? 0 : lower[i - splitIdx - 1]))
  const bandRange = months.map((_, i) => (i <= splitIdx ? 0 : upper[i - splitIdx - 1] - lower[i - splitIdx - 1]))

  const historyData = months.map((_, i) => (i <= splitIdx ? history[i] : null)) as Array<number | null>
  const forecastData = months.map((_, i) =>
    i === splitIdx ? history[splitIdx] : i > splitIdx ? forecast[i - splitIdx - 1] : null,
  ) as Array<number | null>

  return {
    tooltip: { trigger: 'axis' },
    legend: { show: true, top: 0, right: 0, data: ['历史用量', '预测需求'] },
    grid: { left: 10, right: 16, top: 30, bottom: 24 },
    xAxis: { type: 'category', data: months, axisLabel: { fontSize: 9, rotate: 45 }, boundaryGap: false },
    yAxis: {
      type: 'value',
      name: 'GPU 卡',
      nameTextStyle: { color: '#7c93b0', fontSize: 10 },
      axisLabel: { fontSize: 9 },
      splitLine: { lineStyle: { color: 'rgba(34,211,238,0.08)', type: 'dashed' } },
    },
    series: [
      // 置信区间带
      { name: 'band-base', type: 'line', data: bandBase, stack: 'ci', symbol: 'none', lineStyle: { opacity: 0 }, silent: true, tooltip: { show: false } },
      {
        name: '置信区间',
        type: 'line',
        data: bandRange,
        stack: 'ci',
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: { color: 'rgba(34,211,238,0.14)' },
        silent: true,
        tooltip: { show: false },
      },
      // 历史实线
      {
        name: '历史用量',
        type: 'line',
        data: historyData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2, color: COLORS.cyber },
        itemStyle: { color: COLORS.cyber },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(34,211,238,0.3)' }, { offset: 1, color: 'rgba(34,211,238,0.02)' }] },
        },
      },
      // 预测虚线
      {
        name: '预测需求',
        type: 'line',
        data: forecastData,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2, color: COLORS.amber, type: 'dashed' },
        itemStyle: { color: COLORS.amber },
      },
      // 容量上限参考线
      {
        name: '装机上限',
        type: 'line',
        data: months.map(() => GPU_TOTAL),
        symbol: 'none',
        lineStyle: { width: 1, color: COLORS.alarm, type: 'dotted' },
        tooltip: { show: false },
      },
    ],
  }
}
