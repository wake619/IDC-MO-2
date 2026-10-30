import { useMemo } from 'react'
import Panel from '../components/Panel'
import ChartBox from '../components/ChartBox'
import AnimatedNumber from '../components/AnimatedNumber'
import { RankItem } from '../components/ui'
import { useSimStore } from '../stores/simStore'
import { gaugeOption, sankeyOption, heatmapOption, trendLineOption } from '../theme/chartOptions'
import { COLORS } from '../theme/colors'
import type { TimePoint } from '../types'

export default function EnergyPue() {
  const kpi = useSimStore((s) => s.kpi)
  const racks = useSimStore((s) => s.racks)

  // 30 天 PUE 趋势（确定性演示 + 实时末点）
  const pue30 = useMemo<TimePoint[]>(() => {
    const now = Date.now()
    const arr: TimePoint[] = []
    for (let i = 30; i > 0; i--) {
      const t = now - i * 86400000
      const v = 1.16 + Math.sin(i / 4) * 0.035 + Math.cos(i / 2.1) * 0.012
      arr.push({ t, v })
    }
    arr.push({ t: now, v: kpi.pue })
    return arr
  }, [kpi.pue])

  // 能耗桑基
  const sankey = useMemo(() => {
    const it = kpi.itPowerKw
    const total = kpi.totalPowerKw
    const overhead = Math.max(0, total - it)
    const cooling = overhead * 0.72
    const loss = overhead * 0.28
    return sankeyOption(
      [{ name: '市电输入' }, { name: 'IT 设备' }, { name: '制冷系统' }, { name: '供电损耗' }, { name: 'GPU 计算' }, { name: '存储' }, { name: '网络' }],
      [
        { source: '市电输入', target: 'IT 设备', value: +it.toFixed(0) },
        { source: '市电输入', target: '制冷系统', value: +cooling.toFixed(0) },
        { source: '市电输入', target: '供电损耗', value: +loss.toFixed(0) },
        { source: 'IT 设备', target: 'GPU 计算', value: +(it * 0.78).toFixed(0) },
        { source: 'IT 设备', target: '存储', value: +(it * 0.12).toFixed(0) },
        { source: 'IT 设备', target: '网络', value: +(it * 0.1).toFixed(0) },
      ],
    )
  }, [kpi])

  // 机柜功耗 Top10
  const topRacks = useMemo(
    () => [...racks].sort((a, b) => b.power - a.power).slice(0, 10),
    [racks],
  )

  // 温湿度热力图（采样机柜 冷/热通道温度）
  const heat = useMemo(() => {
    const step = Math.max(1, Math.floor(racks.length / 40))
    const cols = racks.filter((_, i) => i % step === 0).slice(0, 40)
    const xLabels = cols.map((c) => c.id.slice(-6))
    const yLabels = ['冷通道', '热通道']
    const data: Array<[number, number, number]> = []
    cols.forEach((c, xi) => {
      data.push([xi, 0, +c.inletTemp.toFixed(1)])
      data.push([xi, 1, +c.outletTemp.toFixed(1)])
    })
    return { xLabels, yLabels, data }
  }, [racks])

  const avgInlet = racks.reduce((s, r) => s + r.inletTemp, 0) / racks.length
  const avgOutlet = racks.reduce((s, r) => s + r.outletTemp, 0) / racks.length
  const dailyKwh = kpi.totalPowerKw * 24

  return (
    <div className="h-full w-full overflow-y-auto p-2 space-y-2">
      {/* 顶部指标 */}
      <div className="grid grid-cols-12 gap-2">
        <Panel title="实时 PUE" className="col-span-12 lg:col-span-3 h-[220px]" bodyClassName="flex flex-col items-center justify-center">
          <ChartBox
            className="h-[150px] w-full"
            option={gaugeOption(kpi.pue, {
              max: 2,
              name: '能源使用效率',
              zones: [
                { to: 1.3, color: COLORS.online },
                { to: 1.6, color: COLORS.amber },
                { to: 2.0, color: COLORS.alarm },
              ],
            })}
          />
          <div className="text-[10px] text-slate-500 mt-1">行业先进 ≤ 1.25 · 国标新建 ≤ 1.3</div>
        </Panel>

        <Panel title="PUE 30 天趋势" className="col-span-12 lg:col-span-4 h-[220px]">
          <ChartBox
            option={trendLineOption([{ name: 'PUE', data: pue30, color: COLORS.online }], { yUnit: '' })}
          />
        </Panel>

        <Panel title="能耗构成流向" subtitle="桑基图 · 实时功率 kW" className="col-span-12 lg:col-span-5 h-[220px]">
          <ChartBox option={sankey} />
        </Panel>
      </div>

      {/* 功率与能耗指标条 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <EnergyKpi label="总功率" value={kpi.totalPowerKw / 1000} decimals={2} unit="MW" color={COLORS.alarm} />
        <EnergyKpi label="IT 负载功率" value={kpi.itPowerKw / 1000} decimals={2} unit="MW" color={COLORS.cyber} />
        <EnergyKpi label="制冷功率" value={kpi.coolingPowerKw / 1000} decimals={2} unit="MW" color={COLORS.blue} />
        <EnergyKpi label="日耗电量" value={dailyKwh / 10000} decimals={2} unit="万kWh" color={COLORS.amber} />
      </div>

      {/* 下部：排行 + 热力 + 建议 */}
      <div className="grid grid-cols-12 gap-2">
        <Panel title="机柜功耗 Top10" className="col-span-12 lg:col-span-3 h-[280px]" bodyClassName="overflow-y-auto">
          {topRacks.map((r, i) => (
            <RankItem
              key={r.id}
              rank={i + 1}
              label={r.id}
              sub={`热通道 ${r.outletTemp.toFixed(0)}°C`}
              value={`${r.power.toFixed(1)}kW`}
              color={i < 3 ? COLORS.alarm : COLORS.amber}
              percent={(r.power / (topRacks[0]?.power || 1)) * 100}
            />
          ))}
        </Panel>

        <Panel title="机柜温度传感热力图" subtitle="冷/热通道 · 采样机柜" className="col-span-12 lg:col-span-5 h-[280px]" bodyClassName="p-1">
          <ChartBox
            option={heatmapOption(heat.xLabels, heat.yLabels, heat.data, {
              max: 50,
              unit: '°C',
              visualColors: ['#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e'],
            })}
          />
        </Panel>

        <Panel title="AI 节能优化建议" className="col-span-12 lg:col-span-4 h-[280px]" bodyClassName="overflow-y-auto space-y-2">
          <SuggestionCard
            icon="❄"
            title="冷通道温度上调"
            detail={`当前平均冷通道 ${avgInlet.toFixed(1)}°C，建议上调至 24°C，预计制冷能耗下降 6.5%`}
            saving="≈ 12.4 万kWh/月"
            color={COLORS.blue}
          />
          <SuggestionCard
            icon="🌡"
            title="热点机柜气流优化"
            detail={`热通道均温 ${avgOutlet.toFixed(1)}°C，${racks.filter((r) => r.outletTemp > 40).length} 个机柜超 40°C，建议加装盲板/调整风机转速`}
            saving="PUE -0.02"
            color={COLORS.alarm}
          />
          <SuggestionCard
            icon="⚡"
            title="错峰调度"
            detail="将非紧急训练任务调度至电价低谷时段（23:00-07:00）"
            saving="≈ 8.2% 电费"
            color={COLORS.amber}
          />
          <SuggestionCard
            icon="♻"
            title="余热回收"
            detail="液冷回路出水温度 45°C，可接入园区供暖余热回收系统"
            saving="年减碳 320t"
            color={COLORS.online}
          />
        </Panel>
      </div>
    </div>
  )
}

function EnergyKpi({ label, value, decimals, unit, color }: { label: string; value: number; decimals: number; unit: string; color: string }) {
  return (
    <div className="panel corner-frame px-3 py-2.5">
      <div className="hud-label">{label}</div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <AnimatedNumber value={value} decimals={decimals} className="stat-value text-2xl leading-none" />
        <span className="text-xs font-semibold" style={{ color }}>{unit}</span>
      </div>
    </div>
  )
}

function SuggestionCard({ icon, title, detail, saving, color }: { icon: string; title: string; detail: string; saving: string; color: string }) {
  return (
    <div className="panel p-2.5 relative overflow-hidden" style={{ borderColor: `${color}33` }}>
      <div className="absolute -right-3 -top-3 w-12 h-12 rounded-full opacity-15 blur-lg" style={{ background: color }} />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base" style={{ color }}>{icon}</span>
        <span className="text-[12px] text-slate-200 font-semibold">{title}</span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-sm font-mono" style={{ color, background: `${color}18`, border: `1px solid ${color}44` }}>
          {saving}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">{detail}</p>
    </div>
  )
}
