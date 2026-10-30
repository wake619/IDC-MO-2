import { create } from 'zustand'
import type {
  AlertItem,
  Asset,
  FailurePrediction,
  GpuNode,
  Hall,
  HealingAction,
  Job,
  KpiSnapshot,
  Rack,
  SlowNode,
  TimePoint,
  ViewMode,
} from '../types'
import {
  generateAssets,
  generateFailurePredictions,
  generateJobs,
  generateTopology,
} from '../mock/generators'
import {
  buildBaselines,
  computeKpi,
  detectSlowNodes,
  maybeAddJob,
  maybeHeal,
  maybeInjectAlert,
  pushSeries,
  startSimulator,
  stepAlerts,
  stepJobs,
  stepNodes,
  stepRacks,
  type BaselineMap,
  type SimDriverHandle,
} from '../mock/simulator'

// ============================================================
// 初始化静态数据（模块加载时一次性生成，确定性种子）
// ============================================================
const topology = generateTopology()
const initialAssets = generateAssets(topology.racks, topology.nodes)
const initialJobs = generateJobs(topology.nodes)
const initialPredictions = generateFailurePredictions(topology.nodes)
const baselines: BaselineMap = buildBaselines(topology.nodes)

/** 构造 24h 历史算力利用率曲线（演示用，1 分钟粒度取 120 点） */
function seedSeries(base: number, amp: number, noise: number, points = 120): TimePoint[] {
  const now = Date.now()
  const arr: TimePoint[] = []
  for (let i = points; i > 0; i--) {
    const t = now - i * 60000
    const wave = Math.sin(i / 9) * amp + Math.sin(i / 3.3) * (amp / 2)
    arr.push({ t, v: Math.max(0, base + wave + (Math.random() - 0.5) * noise) })
  }
  return arr
}

const seedAlerts = (): AlertItem[] => {
  const now = Date.now()
  const list: AlertItem[] = []
  const samples: Array<Partial<AlertItem> & { title: string; level: AlertItem['level']; source: AlertItem['source'] }> = [
    { level: 'P0', source: 'GPU', title: 'GPU 温度严重过高', target: 'A-R03-C07-N2', value: '91.3°C 超过阈值 88°C' },
    { level: 'P1', source: '节点', title: '计算节点心跳丢失', target: 'B-R05-C11-N1', value: '节点已离线 42s' },
    { level: 'P2', source: '网络', title: 'InfiniBand 链路抖动', target: 'A-R02-C01', value: '误码率 3.2e-5' },
    { level: 'P1', source: 'GPU', title: 'ECC 错误累积超阈值', target: 'A-R07-C04-N3', value: '可纠正错误 486 次/小时' },
    { level: 'P3', source: '制冷', title: '热通道温度偏高', target: 'B-R01-C08', value: '回风温度 41.5°C' },
    { level: 'P2', source: '存储', title: '存储时延升高', target: 'STG-00003', value: 'P99 时延 22.4ms' },
  ]
  samples.forEach((s, i) => {
    list.push({
      id: `ALT-SEED-${i}`,
      level: s.level,
      source: s.source,
      title: s.title,
      target: s.target!,
      status: i < 2 ? 'active' : i < 4 ? 'acked' : 'active',
      value: s.value!,
      timestamp: now - (i + 1) * 90000,
      ackAt: i >= 2 && i < 4 ? now - i * 60000 : undefined,
    })
  })
  return list
}

const seedHealing = (): HealingAction[] => {
  const now = Date.now()
  return [
    { id: 'HEAL-S1', timestamp: now - 240000, action: '自动隔离故障节点', target: 'B-R05-C11-N1', reason: '节点心跳丢失超 30s', status: 'success', latencyMs: 1840 },
    { id: 'HEAL-S2', timestamp: now - 180000, action: 'GPU 降频保护', target: 'A-R03-C07-N2', reason: '核心温度超过 85°C', status: 'success', latencyMs: 620 },
    { id: 'HEAL-S3', timestamp: now - 90000, action: '任务热迁移', target: 'A-R07-C04-N3', reason: '预测 25min 内 HBM 故障', status: 'success', latencyMs: 3200 },
  ]
}

// ============================================================
// Store 定义
// ============================================================
export interface SimState {
  started: boolean
  tick: number
  halls: Hall[]
  racks: Rack[]
  nodes: GpuNode[]
  alerts: AlertItem[]
  jobs: Job[]
  assets: Asset[]
  kpi: KpiSnapshot
  failurePredictions: FailurePrediction[]
  healingActions: HealingAction[]
  slowNodes: SlowNode[]
  // 时序
  utilSeries: TimePoint[]
  powerSeries: TimePoint[]
  pueSeries: TimePoint[]
  alertSeries: TimePoint[]
  pue: number
  // UI
  viewMode: ViewMode
  selectedRackId: string | null
  tourActive: boolean

  // actions
  step: () => void
  start: () => void
  stop: () => void
  ackAlert: (id: string) => void
  silenceAlert: (id: string) => void
  resolveAlert: (id: string) => void
  submitJob: (job: Partial<Job>) => void
  setViewMode: (m: ViewMode) => void
  selectRack: (id: string | null) => void
  toggleTour: () => void
}

let driver: SimDriverHandle | null = null

const initialNodes = topology.nodes
const initialRacks = topology.racks
const initialKpi = computeKpi(initialNodes, initialJobs, seedAlerts(), 1.18)

export const useSimStore = create<SimState>((set, get) => ({
  started: false,
  tick: 0,
  halls: topology.halls,
  racks: initialRacks,
  nodes: initialNodes,
  alerts: seedAlerts(),
  jobs: initialJobs,
  assets: initialAssets,
  kpi: initialKpi,
  failurePredictions: initialPredictions,
  healingActions: seedHealing(),
  slowNodes: detectSlowNodes(initialNodes, initialJobs),
  utilSeries: seedSeries(68, 12, 6),
  powerSeries: seedSeries(initialKpi.totalPowerKw, 400, 200),
  pueSeries: seedSeries(1.18, 0.03, 0.02),
  alertSeries: seedSeries(6, 3, 2),
  pue: 1.18,
  viewMode: 'temperature',
  selectedRackId: null,
  tourActive: false,

  step: () => {
    const s = get()
    const now = Date.now()
    const t = s.tick + 1

    // 1. 节点指标漂移
    const nodes = stepNodes(s.nodes, baselines, t)
    // 2. 机柜聚合（每 3 tick 更新一次，降低开销）
    const racks = t % 3 === 0 ? stepRacks(s.racks, nodes) : s.racks
    // 3. 告警：注入 + 流转
    let alerts = stepAlerts(s.alerts, now)
    const injected = maybeInjectAlert(nodes, now)
    if (injected) alerts = [injected, ...alerts].slice(0, 120)
    // 4. 任务流转
    let jobs = stepJobs(s.jobs, nodes, now)
    const nj = maybeAddJob(jobs, now)
    if (nj) jobs = [nj, ...jobs].slice(0, 80)
    // 5. PUE 缓慢波动
    const pue = Math.min(1.32, Math.max(1.09, s.pue + (Math.random() - 0.5) * 0.006))
    // 6. KPI
    const kpi = computeKpi(nodes, jobs, alerts, pue)
    // 7. 自愈日志
    let healingActions = s.healingActions
    const heal = maybeHeal(nodes, now)
    if (heal) healingActions = [heal, ...healingActions].slice(0, 40)
    // 8. 慢节点（每 5 tick）
    const slowNodes = t % 5 === 0 ? detectSlowNodes(nodes, jobs) : s.slowNodes

    set({
      tick: t,
      nodes,
      racks,
      alerts,
      jobs,
      kpi,
      pue,
      healingActions,
      slowNodes,
      utilSeries: pushSeries(s.utilSeries, now, kpi.avgUtil),
      powerSeries: pushSeries(s.powerSeries, now, kpi.totalPowerKw),
      pueSeries: pushSeries(s.pueSeries, now, pue),
      alertSeries: pushSeries(s.alertSeries, now, kpi.activeAlerts),
    })
  },

  start: () => {
    if (get().started) return
    driver = startSimulator(() => get().step(), 1000)
    set({ started: true })
  },

  stop: () => {
    driver?.stop()
    driver = null
    set({ started: false })
  },

  ackAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, status: 'acked', ackAt: Date.now() } : a,
      ),
    })),

  silenceAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, status: 'silenced' } : a)),
    })),

  resolveAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, status: 'resolved', resolveAt: Date.now() } : a,
      ),
    })),

  submitJob: (job) =>
    set((s) => {
      const now = Date.now()
      const full: Job = {
        id: `JOB-${now.toString(36).toUpperCase()}`,
        name: job.name ?? '未命名任务',
        owner: job.owner ?? '平台用户',
        queue: job.queue ?? '训练',
        gpuRequest: job.gpuRequest ?? 8,
        status: 'queued',
        progress: 0,
        submitAt: now,
        priority: job.priority ?? 5,
        model: job.model ?? 'Custom-Model',
        loss: 3.2,
        throughput: 12000,
        mfu: 40,
        assignedNodes: [],
      }
      return { jobs: [full, ...s.jobs] }
    }),

  setViewMode: (m) => set({ viewMode: m }),
  selectRack: (id) => set({ selectedRackId: id }),
  toggleTour: () => set((s) => ({ tourActive: !s.tourActive })),
}))

/** 便捷选择器：按 id 取节点 */
export const selectNodeById = (id: string) => (s: SimState) =>
  s.nodes.find((n) => n.id === id)
