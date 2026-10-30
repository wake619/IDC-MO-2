import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Panel from '../components/Panel'
import StatCard from '../components/StatCard'
import ChartBox from '../components/ChartBox'
import Sparkline from '../components/Sparkline'
import { RankItem } from '../components/ui'
import { LevelBadge } from '../components/Badges'
import DataCenterScene from '../components/scene/DataCenterScene'
import { useSimStore } from '../stores/simStore'
import { rosePieOption, trendLineOption, gaugeOption } from '../theme/chartOptions'
import { COLORS, LEVEL_COLOR, utilToColor } from '../theme/colors'
import type { AlertLevel } from '../types'

export default function DashboardOverview() {
  const kpi = useSimStore((s) => s.kpi)
  const nodes = useSimStore((s) => s.nodes)
  const alerts = useSimStore((s) => s.alerts)
  const jobs = useSimStore((s) => s.jobs)
  const utilSeries = useSimStore((s) => s.utilSeries)
  const racks = useSimStore((s) => s.racks)
  const viewMode = useSimStore((s) => s.viewMode)
  const navigate = useNavigate()

  // 集群健康度
  const health = useMemo(() => {
    const w = { normal: 1, warning: 0.72, critical: 0.32, offline: 0 }
    const sum = nodes.reduce((s, n) => s + w[n.status], 0)
    return (sum / nodes.length) * 100
  }, [nodes])

  // Top5 高负载节点
  const top5 = useMemo(
    () => [...nodes].filter((n) => n.status !== 'offline').sort((a, b) => b.util - a.util).slice(0, 6),
    [nodes],
  )

  // 告警等级分布（活跃 + 已确认）
  const alertDist = useMemo(() => {
    const counts: Record<AlertLevel, number> = { P0: 0, P1: 0, P2: 0, P3: 0 }
    alerts
      .filter((a) => a.status === 'active' || a.status === 'acked')
      .forEach((a) => (counts[a.level] += 1))
    return (Object.keys(counts) as AlertLevel[]).map((lv) => ({
      name: lv,
      value: counts[lv],
      color: LEVEL_COLOR[lv],
    }))
  }, [alerts])

  // 任务队列概览
  const jobStat = useMemo(() => {
    const q = jobs.filter((j) => j.status === 'queued')
    const r = jobs.filter((j) => j.status === 'running')
    const s = jobs.filter((j) => j.status === 'succeeded')
    return {
      queued: q.length,
      running: r.length,
      succeeded: s.length,
      gpuDemand: r.reduce((sum, j) => sum + j.gpuRequest, 0),
      gpuQueued: q.reduce((sum, j) => sum + j.gpuRequest, 0),
    }
  }, [jobs])

  const utilSpark = utilSeries.slice(-40).map((p) => p.v)
  const recentAlerts = alerts.slice(0, 12)

  return (
    <div className="h-full w-full flex flex-col gap-2 p-2 overflow-hidden">
      {/* KPI 条 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 shrink-0">
        <StatCard
          label="实时总算力"
          value={kpi.totalPflops / 1000}
          decimals={2}
          unit="EFLOPS"
          icon="⚡"
          color={COLORS.cyber}
          hint={`FP16 有效算力 · 峰值 ${(kpi.gpuOnline * 0.989 / 1000).toFixed(2)} EF`}
        />
        <StatCard
          label="GPU 在线率"
          value={kpi.onlineRate}
          decimals={1}
          unit="%"
          icon="▦"
          color={COLORS.online}
          progress={kpi.onlineRate}
          hint={`在线 ${kpi.gpuOnline} / ${kpi.gpuTotal} 卡`}
        />
        <StatCard
          label="平均利用率"
          value={kpi.avgUtil}
          decimals={1}
          unit="%"
          icon="∿"
          color={COLORS.purple}
          progress={kpi.avgUtil}
          hint="全集群 GPU 平均负载"
        />
        <StatCard
          label="活跃告警"
          value={kpi.activeAlerts}
          decimals={0}
          unit="条"
          icon="⚠"
          color={COLORS.alarm}
          hint={`P0/P1 ${alerts.filter((a) => (a.status === 'active' || a.status === 'acked') && (a.level === 'P0' || a.level === 'P1')).length} 条待处理`}
        />
        <StatCard
          label="数据中心 PUE"
          value={kpi.pue}
          decimals={3}
          icon="⌁"
          color={COLORS.amber}
          progress={Math.min(100, ((kpi.pue - 1) / 0.5) * 100)}
          hint={`总功率 ${(kpi.totalPowerKw / 1000).toFixed(1)} MW`}
        />
        <StatCard
          label="运行任务"
          value={kpi.runningJobs}
          decimals={0}
          unit="个"
          icon="⧉"
          color={COLORS.blue}
          hint={`排队 ${jobStat.queued} · 占用 ${jobStat.gpuDemand} GPU`}
        />
      </div>

      {/* 主体三栏 */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2">
        {/* 左栏 */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2 min-h-0">
          <Panel title="集群健康度" className="shrink-0" delay={0.05}>
            <div className="flex items-center justify-center">
              <ChartBox
                className="h-[132px]"
                option={gaugeOption(health, {
                  name: '综合健康评分',
                  unit: '',
                  zones: [
                    { to: 50, color: COLORS.alarm },
                    { to: 75, color: COLORS.amber },
                    { to: 100, color: COLORS.online },
                  ],
                })}
              />
            </div>
            <div className="grid grid-cols-3 gap-1 mt-1 text-center">
              <MiniStat label="正常" value={nodes.filter((n) => n.status === 'normal').length} color={COLORS.online} />
              <MiniStat label="警告" value={nodes.filter((n) => n.status === 'warning').length} color={COLORS.amber} />
              <MiniStat label="严重" value={nodes.filter((n) => n.status === 'critical').length} color={COLORS.alarm} />
            </div>
          </Panel>

          <Panel title="Top 高负载节点" className="flex-1 min-h-0" bodyClassName="overflow-y-auto" delay={0.1}>
            <div className="flex flex-col">
              {top5.map((n, i) => (
                <RankItem
                  key={n.id}
                  rank={i + 1}
                  label={n.id}
                  sub={`${n.model} · ${n.temp.toFixed(0)}°C · 健康 ${n.healthScore}`}
                  value={`${n.util.toFixed(1)}%`}
                  color={utilToColor(n.util)}
                  percent={n.util}
                />
              ))}
            </div>
          </Panel>
        </div>

        {/* 中栏 */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-2 min-h-0">
          <Panel
            title="全域机房 3D 透视"
            subtitle="点击机柜查看详情 · 自动环绕巡检"
            className="flex-1 min-h-0"
            bodyClassName="p-0 overflow-hidden rounded-b-md"
            delay={0.15}
            actions={
              <button className="btn btn-cyber" onClick={() => navigate('/dc3d')}>
                进入大屏 →
              </button>
            }
          >
            <div className="relative w-full h-full">
              <DataCenterScene
                racks={racks}
                nodes={nodes}
                viewMode={viewMode}
                selectedRackId={null}
                onSelectRack={() => {}}
                tourActive={false}
                compact
              />
              {/* HUD 角标 */}
              <div className="absolute top-2 left-2 text-[10px] text-cyber-400/70 font-mono pointer-events-none">
                HALL A/B · {racks.length} 机柜 · {kpi.gpuTotal} GPU
              </div>
            </div>
          </Panel>

          {/* 告警滚动播报条 */}
          <div className="shrink-0 panel corner-frame h-9 flex items-center overflow-hidden">
            <span className="shrink-0 px-2 py-1 bg-alarm-500/20 text-alarm-400 text-[11px] font-bold border-r border-alarm-500/30 h-full flex items-center">
              ⚠ 实时告警
            </span>
            <div className="relative flex-1 overflow-hidden h-full">
              <div className="absolute whitespace-nowrap flex items-center h-full gap-8 animate-marquee pl-4">
                {[...recentAlerts, ...recentAlerts].map((a, i) => (
                  <span key={`${a.id}-${i}`} className="flex items-center gap-1.5 text-[11px]">
                    <LevelBadge level={a.level} size="xs" />
                    <span className="text-slate-300">{a.target}</span>
                    <span className="text-slate-500">{a.title}</span>
                    <span className="text-cyber-400/70 font-mono">{a.value}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右栏 */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2 min-h-0">
          <Panel title="告警等级分布" className="shrink-0" delay={0.2}>
            <ChartBox className="h-[140px]" option={rosePieOption(alertDist, { roseType: true })} />
          </Panel>

          <Panel
            title="算力利用率趋势"
            subtitle="近 60 分钟"
            className="shrink-0"
            delay={0.25}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="stat-value text-xl">{kpi.avgUtil.toFixed(1)}%</span>
              <Sparkline data={utilSpark} color={COLORS.cyber} width={110} height={30} />
            </div>
            <ChartBox
              className="h-[90px]"
              noAnimation
              option={trendLineOption(
                [{ name: '集群利用率', data: utilSeries.slice(-60), color: COLORS.cyber }],
                { yMax: 100, yUnit: '%' },
              )}
            />
          </Panel>

          <Panel title="任务队列概览" className="flex-1 min-h-0" delay={0.3} bodyClassName="overflow-y-auto">
            <div className="space-y-2">
              <QueueRow label="运行中" value={jobStat.running} color={COLORS.cyber} icon="▶" />
              <QueueRow label="排队中" value={jobStat.queued} color={COLORS.amber} icon="⏳" />
              <QueueRow label="已完成" value={jobStat.succeeded} color={COLORS.online} icon="✓" />
              <div className="pt-1 border-t border-cyber-500/10 grid grid-cols-2 gap-2 text-center">
                <div>
                  <div className="text-lg stat-value" style={{ color: COLORS.purple }}>
                    {jobStat.gpuDemand}
                  </div>
                  <div className="hud-label">占用 GPU</div>
                </div>
                <div>
                  <div className="text-lg stat-value" style={{ color: COLORS.amber }}>
                    {jobStat.gpuQueued}
                  </div>
                  <div className="hud-label">排队需求 GPU</div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-void-850/60 rounded-sm py-1 border border-cyber-500/10">
      <div className="text-base font-mono font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] text-slate-500">{label}</div>
    </div>
  )
}

function QueueRow({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base" style={{ color }}>
        {icon}
      </span>
      <span className="text-[12px] text-slate-300 flex-1">{label}</span>
      <span className="font-mono font-bold text-lg" style={{ color }}>
        {value}
      </span>
    </div>
  )
}
