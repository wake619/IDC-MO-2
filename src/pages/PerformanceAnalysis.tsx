import { useMemo, useState } from 'react'
import Panel from '../components/Panel'
import ChartBox from '../components/ChartBox'
import { RankItem, EmptyState } from '../components/ui'
import { JobStatusBadge } from '../components/Badges'
import { useSimStore } from '../stores/simStore'
import { histogramOption, trendLineOption } from '../theme/chartOptions'
import { COLORS, utilToColor } from '../theme/colors'
import type { Job, TimePoint } from '../types'

// 简易字符串哈希 → 种子
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function seededSeries(seed: number, n: number, fn: (r: () => number, i: number) => number): number[] {
  let a = seed >>> 0
  const r = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return Array.from({ length: n }, (_, i) => fn(r, i))
}

export default function PerformanceAnalysis() {
  const nodes = useSimStore((s) => s.nodes)
  const jobs = useSimStore((s) => s.jobs)
  const utilSeries = useSimStore((s) => s.utilSeries)
  const slowNodes = useSimStore((s) => s.slowNodes)

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  // 利用率分布直方图
  const utilHist = useMemo(() => {
    const bins = ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100']
    const counts = new Array(10).fill(0)
    nodes.forEach((n) => {
      if (n.status === 'offline') return
      const idx = Math.min(9, Math.floor(n.util / 10))
      counts[idx]++
    })
    return { bins, counts }
  }, [nodes])

  // 显存分布直方图
  const memHist = useMemo(() => {
    const bins = ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100']
    const counts = new Array(10).fill(0)
    nodes.forEach((n) => {
      if (n.status === 'offline') return
      counts[Math.min(9, Math.floor(n.memUtil / 10))]++
    })
    return { bins, counts }
  }, [nodes])

  const runningJobs = useMemo(() => jobs.filter((j) => j.status === 'running'), [jobs])
  const selectedJob = runningJobs.find((j) => j.id === selectedJobId) ?? runningJobs[0] ?? null

  // MFU 趋势（由利用率派生，系数 0.5）
  const mfuSeries: TimePoint[] = useMemo(
    () => utilSeries.slice(-60).map((p) => ({ t: p.t, v: p.v * 0.52 })),
    [utilSeries],
  )
  // RDMA 吞吐（Gb/s，由利用率派生）
  const rdmaSeries: TimePoint[] = useMemo(
    () => utilSeries.slice(-60).map((p) => ({ t: p.t, v: p.v * 3.4 })),
    [utilSeries],
  )
  // 存储 IOPS 与时延
  const storageIops: TimePoint[] = useMemo(
    () => utilSeries.slice(-60).map((p) => ({ t: p.t, v: p.v * 1400 })),
    [utilSeries],
  )
  const latencyP50: TimePoint[] = useMemo(
    () => utilSeries.slice(-60).map((p) => ({ t: p.t, v: 1.5 + p.v * 0.06 })),
    [utilSeries],
  )
  const latencyP99: TimePoint[] = useMemo(
    () => utilSeries.slice(-60).map((p) => ({ t: p.t, v: 6 + p.v * 0.32 })),
    [utilSeries],
  )

  // 网络拥塞热点（按利用率排序取节点）
  const hotspots = useMemo(
    () =>
      [...nodes]
        .filter((n) => n.status !== 'offline')
        .sort((a, b) => b.util - a.util)
        .slice(0, 7)
        .map((n) => ({
          id: n.id,
          congestion: Math.min(99, n.util * 0.9 + (n.temp - 50) * 0.3),
          gbps: n.util * 3.4,
        })),
    [nodes],
  )

  return (
    <div className="h-full w-full overflow-y-auto p-2 space-y-2">
      {/* 集群维度 */}
      <div className="grid grid-cols-12 gap-2">
        <Panel title="GPU 利用率分布" subtitle="全集群节点" className="col-span-12 lg:col-span-4 h-[240px]">
          <ChartBox option={histogramOption(utilHist.bins, utilHist.counts, COLORS.cyber)} />
        </Panel>
        <Panel title="显存占用分布" subtitle="全集群节点" className="col-span-12 lg:col-span-4 h-[240px]">
          <ChartBox option={histogramOption(memHist.bins, memHist.counts, COLORS.purple)} />
        </Panel>
        <Panel title="MFU 模型算力利用率" subtitle="近 60 分钟趋势" className="col-span-12 lg:col-span-4 h-[240px]">
          <ChartBox
            noAnimation
            option={trendLineOption([{ name: 'MFU', data: mfuSeries, color: COLORS.online }], {
              yUnit: '%',
            })}
          />
        </Panel>
      </div>

      {/* 网络与存储维度 */}
      <div className="grid grid-cols-12 gap-2">
        <Panel title="RDMA / InfiniBand 吞吐" subtitle="集群聚合 Gb/s" className="col-span-12 lg:col-span-4 h-[240px]">
          <ChartBox
            noAnimation
            option={trendLineOption([{ name: '吞吐', data: rdmaSeries, color: COLORS.cyber }], {
              yUnit: '',
            })}
          />
        </Panel>
        <Panel title="网络拥塞热点 Top7" className="col-span-12 lg:col-span-4 h-[240px]" bodyClassName="overflow-y-auto">
          {hotspots.map((h, i) => (
            <RankItem
              key={h.id}
              rank={i + 1}
              label={h.id}
              sub={`${h.gbps.toFixed(0)} Gb/s`}
              value={`${h.congestion.toFixed(0)}%`}
              color={utilToColor(h.congestion)}
              percent={h.congestion}
            />
          ))}
        </Panel>
        <Panel title="存储 IOPS 与时延" subtitle="并行文件系统" className="col-span-12 lg:col-span-4 h-[240px]">
          <ChartBox
            noAnimation
            option={trendLineOption(
              [
                { name: 'IOPS', data: storageIops, color: COLORS.purple, area: true },
                { name: 'P99 时延(ms)', data: latencyP99, color: COLORS.alarm, area: false },
                { name: 'P50 时延(ms)', data: latencyP50, color: COLORS.amber, area: false },
              ],
              { showLegend: true },
            )}
          />
        </Panel>
      </div>

      {/* 训练任务视角 */}
      <div className="grid grid-cols-12 gap-2">
        <Panel
          title="运行中训练任务"
          subtitle={`${runningJobs.length} 个`}
          className="col-span-12 lg:col-span-4 h-[320px]"
          bodyClassName="overflow-y-auto p-1"
        >
          {runningJobs.length === 0 ? (
            <EmptyState text="暂无运行任务" />
          ) : (
            runningJobs.slice(0, 30).map((j) => (
              <button
                key={j.id}
                onClick={() => setSelectedJobId(j.id)}
                className={`w-full text-left px-2 py-1.5 rounded-sm transition-colors border-b border-cyber-500/8 ${
                  selectedJob?.id === j.id ? 'bg-cyber-500/12' : 'hover:bg-cyber-500/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-slate-200 truncate flex-1">{j.name}</span>
                  <JobStatusBadge status={j.status} />
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-500">
                  <span>{j.gpuRequest} GPU</span>
                  <span>MFU {j.mfu.toFixed(0)}%</span>
                  <span className="ml-auto">{j.progress.toFixed(0)}%</span>
                </div>
              </button>
            ))
          )}
        </Panel>

        <Panel
          title={selectedJob ? `任务性能曲线 · ${selectedJob.name}` : '任务性能曲线'}
          className="col-span-12 lg:col-span-5 h-[320px]"
          bodyClassName="flex flex-col gap-1"
        >
          {selectedJob ? (
            <JobCurves job={selectedJob} />
          ) : (
            <EmptyState text="选择左侧任务" />
          )}
        </Panel>

        <Panel title="慢节点检测" subtitle="AI 自动识别" className="col-span-12 lg:col-span-3 h-[320px]" bodyClassName="overflow-y-auto">
          {slowNodes.length === 0 ? (
            <EmptyState text="未检测到慢节点" icon="✓" />
          ) : (
            slowNodes.map((s) => (
              <div key={s.nodeId} className="panel p-2 mb-1.5" style={{ borderColor: `${COLORS.amber}33` }}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-mono text-[11px] text-amber-400">{s.nodeId}</span>
                  <span className="text-[10px] font-mono text-alarm-400">-{s.deviation.toFixed(0)}%</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">任务: {s.job}</div>
                <div className="text-[10px] text-slate-500">{s.metric}</div>
                <div className="text-[10px] text-cyber-400/80 mt-0.5">→ {s.suggestion}</div>
              </div>
            ))
          )}
        </Panel>
      </div>
    </div>
  )
}

/** 单任务 Loss / 吞吐 / Checkpoint 曲线 */
function JobCurves({ job }: { job: Job }) {
  const seed = hashSeed(job.id)
  const steps = Math.max(8, Math.round(job.progress / 4))

  const loss = seededSeries(seed, steps, (r, i) =>
    Math.max(0.08, job.loss * Math.exp(-i / (steps * 0.9)) * 2.4 + r() * 0.12 - i * 0.005),
  )
  const throughput = seededSeries(seed + 7, steps, (r) => job.throughput * (0.85 + r() * 0.3))
  const ckpt = seededSeries(seed + 13, Math.min(12, steps), (r) => 20 + r() * 60)
  const xLabels = loss.map((_, i) => `${i * 100}`)

  return (
    <div className="flex flex-col gap-1 h-full">
      <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 shrink-0">
        <span>模型 <span className="text-cyber-400">{job.model}</span></span>
        <span>进度 <span className="text-online-400">{job.progress.toFixed(1)}%</span></span>
        <span>Loss <span className="text-amber-400">{job.loss.toFixed(3)}</span></span>
        <span>吞吐 <span className="text-purple-400">{(job.throughput / 1000).toFixed(1)}k tok/s</span></span>
      </div>
      <div className="flex-1 min-h-0 grid grid-rows-3 gap-1">
        <ChartBox
          noAnimation
          option={miniLine('Loss', xLabels, loss, COLORS.amber)}
        />
        <ChartBox
          noAnimation
          option={miniLine('吞吐 tok/s', xLabels, throughput, COLORS.purple)}
        />
        <ChartBox
          noAnimation
          option={miniLine('Checkpoint 时长(s)', xLabels, ckpt, COLORS.cyber)}
        />
      </div>
    </div>
  )
}

function miniLine(name: string, x: string[], data: number[], color: string) {
  return {
    grid: { left: 40, right: 12, top: 18, bottom: 16 },
    title: { text: name, textStyle: { color: '#7c93b0', fontSize: 10, fontWeight: 400 }, left: 6, top: 2 },
    tooltip: { trigger: 'axis' as const },
    xAxis: { type: 'category' as const, data: x, axisLabel: { fontSize: 8, color: '#5b7089' }, axisLine: { lineStyle: { color: 'rgba(34,211,238,0.15)' } } },
    yAxis: { type: 'value' as const, scale: true, axisLabel: { fontSize: 8, color: '#5b7089' }, splitLine: { lineStyle: { color: 'rgba(34,211,238,0.06)' } } },
    series: [
      {
        type: 'line' as const,
        smooth: true,
        showSymbol: false,
        data: data.map((v) => +v.toFixed(2)),
        lineStyle: { width: 1.5, color },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${color}66` },
              { offset: 1, color: `${color}05` },
            ],
          },
        },
      },
    ],
  }
}
