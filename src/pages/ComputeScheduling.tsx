import { useMemo, useState } from 'react'
import Panel from '../components/Panel'
import ChartBox from '../components/ChartBox'
import { WaterBar } from '../components/ui'
import { JobStatusBadge } from '../components/Badges'
import { useSimStore } from '../stores/simStore'
import { gaugeOption } from '../theme/chartOptions'
import { COLORS, JOB_STATUS_COLOR } from '../theme/colors'
import type { Job, QueueType } from '../types'

// 队列配额（GPU 数）
const QUEUE_QUOTA: Record<QueueType, number> = { 训练: 4096, 推理: 1536, 调试: 512 }
const QUEUE_COLOR: Record<QueueType, string> = { 训练: COLORS.cyber, 推理: COLORS.purple, 调试: COLORS.amber }

export default function ComputeScheduling() {
  const jobs = useSimStore((s) => s.jobs)
  const submitJob = useSimStore((s) => s.submitJob)

  const [form, setForm] = useState({ name: '', queue: '训练' as QueueType, gpuRequest: 64, priority: 5 })

  // 各队列占用
  const queueUse = useMemo(() => {
    const use: Record<QueueType, number> = { 训练: 0, 推理: 0, 调试: 0 }
    jobs.filter((j) => j.status === 'running').forEach((j) => (use[j.queue] += j.gpuRequest))
    return use
  }, [jobs])

  const totalQuota = Object.values(QUEUE_QUOTA).reduce((a, b) => a + b, 0)
  const usedGpu = jobs.filter((j) => j.status === 'running').reduce((s, j) => s + j.gpuRequest, 0)
  const utilRate = (usedGpu / totalQuota) * 100
  // 碎片率：空闲但无法满足大任务的占比（演示算法）
  const fragmentation = Math.max(2, Math.min(38, 100 - utilRate * 0.6 + (jobs.filter((j) => j.status === 'queued').length * 0.8)))

  const counts = {
    running: jobs.filter((j) => j.status === 'running').length,
    queued: jobs.filter((j) => j.status === 'queued').length,
    succeeded: jobs.filter((j) => j.status === 'succeeded').length,
    failed: jobs.filter((j) => j.status === 'failed').length,
  }

  const handleSubmit = () => {
    submitJob({
      name: form.name.trim() || `${form.queue}任务-${Date.now().toString().slice(-4)}`,
      queue: form.queue,
      gpuRequest: form.gpuRequest,
      priority: form.priority,
      model: form.name.trim() || 'Custom-Model',
    })
    setForm({ ...form, name: '' })
  }

  return (
    <div className="h-full w-full flex flex-col gap-2 p-2 overflow-hidden">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        <MiniKpi label="运行中任务" value={counts.running} color={COLORS.cyber} icon="▶" />
        <MiniKpi label="排队中任务" value={counts.queued} color={COLORS.amber} icon="⏳" />
        <MiniKpi label="已分配 GPU" value={usedGpu} color={COLORS.purple} icon="▦" />
        <MiniKpi label="集群配额" value={totalQuota} color={COLORS.online} icon="◲" />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2">
        {/* 左：甘特时间轴 */}
        <Panel
          title="任务调度时间轴"
          subtitle="甘特视图 · 近 8 小时"
          className="col-span-12 lg:col-span-8 min-h-0"
          bodyClassName="p-0 overflow-hidden flex flex-col"
        >
          <Gantt jobs={jobs} />
        </Panel>

        {/* 右：资源池 + 提交 + 建议 */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-2 min-h-0">
          <Panel title="资源池配额水位" className="shrink-0">
            <div className="space-y-2.5">
              {(Object.keys(QUEUE_QUOTA) as QueueType[]).map((q) => (
                <WaterBar
                  key={q}
                  label={`${q}队列`}
                  percent={(queueUse[q] / QUEUE_QUOTA[q]) * 100}
                  color={QUEUE_COLOR[q]}
                  right={`${queueUse[q]} / ${QUEUE_QUOTA[q]} GPU`}
                />
              ))}
            </div>
          </Panel>

          <Panel title="GPU 碎片率" className="shrink-0" bodyClassName="flex items-center gap-2">
            <ChartBox
              className="h-[110px] w-1/2"
              option={gaugeOption(fragmentation, {
                name: '',
                unit: '%',
                zones: [
                  { to: 12, color: COLORS.online },
                  { to: 25, color: COLORS.amber },
                  { to: 40, color: COLORS.alarm },
                ],
              })}
            />
            <div className="flex-1 text-[11px] space-y-1.5">
              <div className="text-slate-400 leading-relaxed">
                当前碎片率 <span className="text-amber-400 font-mono font-bold">{fragmentation.toFixed(1)}%</span>
              </div>
              <Suggestion text="建议合并 3 个 <16GPU 的小任务至调试队列，可释放 128 卡连续资源" />
              <Suggestion text="对训练队列启用 Gang Scheduling，减少资源空转" color={COLORS.purple} />
            </div>
          </Panel>

          <Panel title="提交调度任务" className="flex-1 min-h-0" bodyClassName="flex flex-col gap-2">
            <label className="block">
              <span className="hud-label">任务名称</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如 Qwen3-72B-Pretrain"
                className="mt-1 w-full bg-void-850 border border-cyber-500/20 rounded-sm px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-cyber-400/60"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="hud-label">队列</span>
                <select
                  value={form.queue}
                  onChange={(e) => setForm({ ...form, queue: e.target.value as QueueType })}
                  className="mt-1 w-full bg-void-850 border border-cyber-500/20 rounded-sm px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-cyber-400/60"
                >
                  <option value="训练">训练</option>
                  <option value="推理">推理</option>
                  <option value="调试">调试</option>
                </select>
              </label>
              <label className="block">
                <span className="hud-label">GPU 数量</span>
                <select
                  value={form.gpuRequest}
                  onChange={(e) => setForm({ ...form, gpuRequest: +e.target.value })}
                  className="mt-1 w-full bg-void-850 border border-cyber-500/20 rounded-sm px-2 py-1.5 text-[12px] text-slate-200 outline-none focus:border-cyber-400/60"
                >
                  {[8, 16, 32, 64, 128, 256, 512].map((n) => (
                    <option key={n} value={n}>{n} GPU</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="hud-label">优先级: <span className="text-cyber-400 font-mono">{form.priority}</span></span>
              <input
                type="range"
                min={1}
                max={9}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: +e.target.value })}
                className="mt-1 w-full accent-cyan-400"
              />
            </label>
            <button onClick={handleSubmit} className="btn btn-cyber w-full py-2 text-[13px] mt-1">
              ⧉ 提交任务到调度器
            </button>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              提交后任务进入排队，仿真调度器将按优先级与 Gang Scheduling 策略自动分配 GPU 资源。
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function MiniKpi({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="panel corner-frame px-3 py-2 flex items-center gap-2.5">
      <span className="text-xl" style={{ color }}>{icon}</span>
      <div>
        <div className="hud-label">{label}</div>
        <div className="stat-value text-xl leading-none" style={{ color }}>{value}</div>
      </div>
    </div>
  )
}

function Suggestion({ text, color = COLORS.amber }: { text: string; color?: string }) {
  return (
    <div className="flex items-start gap-1.5 text-[10px] leading-relaxed">
      <span style={{ color }}>◆</span>
      <span className="text-slate-400">{text}</span>
    </div>
  )
}

/** 甘特时间轴 */
function Gantt({ jobs }: { jobs: Job[] }) {
  const now = Date.now()
  const WINDOW = 8 * 3600 * 1000 // 8h
  const start = now - WINDOW
  const visible = useMemo(
    () =>
      jobs
        .filter((j) => (j.startAt ?? j.submitAt) > start - WINDOW)
        .sort((a, b) => (a.startAt ?? a.submitAt) - (b.startAt ?? b.submitAt))
        .slice(0, 40),
    [jobs, start],
  )

  const pct = (t: number) => Math.max(0, Math.min(100, ((t - start) / WINDOW) * 100))

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* 时间刻度 */}
      <div className="flex shrink-0 border-b border-cyber-500/10 pl-40 pr-2 h-5 items-center">
        <div className="flex-1 relative">
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className="absolute text-[9px] text-slate-600 font-mono -translate-x-1/2"
              style={{ left: `${(i / 8) * 100}%` }}
            >
              {new Date(start + (i / 8) * WINDOW).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ))}
        </div>
      </div>
      {/* 行 */}
      <div className="flex-1 overflow-y-auto">
        {visible.map((j) => {
          const s = j.startAt ?? j.submitAt
          const e = j.endAt ?? (j.status === 'running' ? now : s + 20 * 60000)
          const left = pct(s)
          const width = Math.max(1.5, pct(e) - left)
          const color = j.status === 'queued' ? COLORS.amber : JOB_STATUS_COLOR[j.status]
          return (
            <div key={j.id} className="flex items-center h-7 border-b border-cyber-500/5 hover:bg-cyber-500/5 group">
              <div className="w-40 shrink-0 px-2 truncate">
                <div className="text-[11px] text-slate-300 truncate">{j.name}</div>
                <div className="text-[9px] text-slate-600 font-mono">{j.gpuRequest}GPU · {j.queue}</div>
              </div>
              <div className="flex-1 relative h-full pr-2">
                {/* 网格线 */}
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className="absolute top-0 bottom-0 w-px bg-cyber-500/6" style={{ left: `${(i / 8) * 100}%` }} />
                ))}
                {/* 任务条 */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-3.5 rounded-sm flex items-center px-1 overflow-hidden"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: `${color}55`,
                    border: `1px solid ${color}`,
                    boxShadow: `0 0 8px ${color}44`,
                  }}
                  title={`${j.name} · ${j.status}`}
                >
                  {width > 8 && (
                    <span className="text-[8px] text-white/90 truncate font-mono">{j.progress.toFixed(0)}%</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {/* 图例 */}
      <div className="shrink-0 flex items-center gap-3 px-2 py-1 border-t border-cyber-500/10">
        {(['queued', 'running', 'succeeded', 'failed'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1 text-[10px] text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: JOB_STATUS_COLOR[s] }} />
            <JobStatusBadge status={s} />
          </span>
        ))}
        <span className="ml-auto text-[10px] text-slate-600 font-mono">共 {visible.length} 个任务</span>
      </div>
    </div>
  )
}
