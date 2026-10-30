import type {
  AlertItem,
  AlertLevel,
  AlertSource,
  GpuNode,
  HealingAction,
  Job,
  KpiSnapshot,
  Rack,
  SlowNode,
  TimePoint,
} from '../types'
import { GPUS_PER_NODE, MODEL_PFLOPS, createRng, healthFromTemp } from './generators'

// ============================================================
// 仿真引擎 —— 纯函数 + 心跳驱动
// 不直接依赖 store，避免循环引用；由 store 注入 getState/setState
// ============================================================

const simRng = createRng(88123)
const sRand = (min: number, max: number) => min + simRng() * (max - min)
const sPick = <T,>(arr: T[]): T => arr[Math.floor(simRng() * arr.length)]

export interface NodeBaseline {
  util: number
  temp: number
  power: number
  phase: number
  speed: number
}

/** 节点基线索引 */
export type BaselineMap = Record<string, NodeBaseline>

export function buildBaselines(nodes: GpuNode[]): BaselineMap {
  const map: BaselineMap = {}
  for (const n of nodes) {
    map[n.id] = {
      util: n.util,
      temp: n.temp,
      power: n.power,
      phase: sRand(0, Math.PI * 2),
      speed: sRand(0.02, 0.08),
    }
  }
  return map
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * 推进节点实时指标：围绕基线做正弦漂移 + 噪声
 */
export function stepNodes(nodes: GpuNode[], baselines: BaselineMap, t: number): GpuNode[] {
  return nodes.map((n) => {
    const b = baselines[n.id]
    if (!b) return n
    if (n.status === 'offline') return n
    const wave = Math.sin(t * b.speed + b.phase)
    const util = clamp(b.util + wave * 9 + sRand(-3, 3), 2, 100)
    const temp = clamp(b.temp + wave * 4 + sRand(-1.5, 1.5) + (util - b.util) * 0.15, 28, 96)
    const power = clamp(b.power + (util - b.util) * 3 + sRand(-15, 15), 80, 6200)
    const status = healthFromTemp(temp, util)
    const healthScore = clamp(
      Math.round(100 - (temp - 45) * 0.7 - (status === 'critical' ? 15 : status === 'warning' ? 6 : 0)),
      0,
      100,
    )
    return { ...n, util, temp, power, status, healthScore }
  })
}

/**
 * 推进机柜聚合指标（功耗/温度/等级）
 */
export function stepRacks(racks: Rack[], nodes: GpuNode[]): Rack[] {
  const byRack = new Map<string, GpuNode[]>()
  for (const n of nodes) {
    const key = `${n.hall}-R${String(n.row).padStart(2, '0')}-C${String(n.rack).padStart(2, '0')}`
    const arr = byRack.get(key)
    if (arr) arr.push(n)
    else byRack.set(key, [n])
  }
  return racks.map((r) => {
    const ns = byRack.get(r.id)
    if (!ns) return r
    const power = ns.reduce((s, n) => s + n.power, 0) / 1000
    const outlet = r.inletTemp + power * 1.4 + sRand(-0.5, 0.5)
    const level = outlet > 42 ? 'critical' : outlet > 36 ? 'warning' : 'normal'
    return { ...r, power, outletTemp: outlet, level }
  })
}

/**
 * 计算 KPI 汇总
 */
export function computeKpi(
  nodes: GpuNode[],
  jobs: Job[],
  alerts: AlertItem[],
  pue: number,
): KpiSnapshot {
  let gpuTotal = 0
  let gpuOnline = 0
  let utilSum = 0
  let utilCount = 0
  let itPowerKw = 0
  let pflops = 0

  for (const n of nodes) {
    gpuTotal += n.gpuCount
    if (n.status !== 'offline') {
      gpuOnline += n.gpuCount
      utilSum += n.util
      utilCount++
      itPowerKw += n.power / 1000
      pflops += MODEL_PFLOPS[n.model] * n.gpuCount * (n.util / 100)
    } else {
      pflops += 0
    }
  }

  const totalPowerKw = itPowerKw * pue
  const coolingPowerKw = totalPowerKw - itPowerKw

  return {
    totalPflops: pflops,
    gpuTotal,
    gpuOnline,
    onlineRate: gpuTotal ? (gpuOnline / gpuTotal) * 100 : 0,
    avgUtil: utilCount ? utilSum / utilCount : 0,
    activeAlerts: alerts.filter((a) => a.status === 'active' || a.status === 'acked').length,
    pue,
    runningJobs: jobs.filter((j) => j.status === 'running').length,
    totalPowerKw,
    itPowerKw,
    coolingPowerKw,
  }
}

// ============================================================
// 告警注入
// ============================================================
interface AlertTemplate {
  level: AlertLevel
  source: AlertSource
  title: string
  value: (n: GpuNode) => string
}

const ALERT_TEMPLATES: AlertTemplate[] = [
  { level: 'P0', source: 'GPU', title: 'GPU 温度严重过高', value: (n) => `${n.temp.toFixed(1)}°C 超过阈值 88°C` },
  { level: 'P1', source: 'GPU', title: 'ECC 错误累积超阈值', value: () => `可纠正错误 ${(sRand(120, 900) | 0)} 次/小时` },
  { level: 'P1', source: '节点', title: '计算节点心跳丢失', value: (n) => `节点 ${n.id} 已离线 ${sRand(2, 30) | 0}s` },
  { level: 'P2', source: '网络', title: 'InfiniBand 链路抖动', value: () => `误码率 ${(sRand(1e-6, 9e-5)).toExponential(1)}` },
  { level: 'P2', source: 'GPU', title: 'GPU 利用率持续打满', value: (n) => `利用率 ${n.util.toFixed(0)}% 持续 15min` },
  { level: 'P3', source: '供电', title: '机柜功耗异常波动', value: () => `瞬时功率偏移 ${(sRand(8, 25)).toFixed(1)}%` },
  { level: 'P2', source: '制冷', title: '热通道温度偏高', value: () => `回风温度 ${(sRand(38, 46)).toFixed(1)}°C` },
  { level: 'P3', source: '存储', title: '存储时延升高', value: () => `P99 时延 ${(sRand(8, 40)).toFixed(1)}ms` },
  { level: 'P1', source: 'GPU', title: 'HBM 显存降频', value: (n) => `${n.id} 显存频率下降 20%` },
]

let alertSeq = 0

export function maybeInjectAlert(nodes: GpuNode[], now: number): AlertItem | null {
  // 每秒有一定概率产生新告警
  if (simRng() > 0.28) return null
  const hotNodes = nodes.filter((n) => n.status === 'critical' || n.status === 'warning')
  const target = hotNodes.length && simRng() > 0.3 ? sPick(hotNodes) : sPick(nodes)
  const tpl = sPick(ALERT_TEMPLATES)
  alertSeq++
  return {
    id: `ALT-${Date.now().toString(36)}-${alertSeq}`,
    level: tpl.level,
    source: tpl.source,
    title: tpl.title,
    target: target.id,
    status: 'active',
    value: tpl.value(target),
    timestamp: now,
  }
}

/**
 * 告警状态自然流转：部分 active 告警自动恢复
 */
export function stepAlerts(alerts: AlertItem[], now: number): AlertItem[] {
  return alerts.map((a) => {
    if (a.status === 'active' && simRng() > 0.94) {
      return { ...a, status: 'resolved', resolveAt: now }
    }
    return a
  })
}

// ============================================================
// 任务状态机流转
// ============================================================
export function stepJobs(jobs: Job[], nodes: GpuNode[], now: number): Job[] {
  const runningCount = jobs.filter((j) => j.status === 'running').length
  const capacity = 40 // 并发运行上限（演示）
  return jobs.map((j) => {
    if (j.status === 'queued') {
      // 排队任务按优先级尝试启动
      if (runningCount < capacity && simRng() > 0.85) {
        const free = nodes.filter((n) => n.status === 'normal').slice(0, Math.ceil(j.gpuRequest / GPUS_PER_NODE))
        return {
          ...j,
          status: 'running',
          startAt: now,
          progress: 0.5,
          assignedNodes: free.map((n) => n.id),
        }
      }
      return j
    }
    if (j.status === 'running') {
      const inc = sRand(0.05, 0.9) * (j.queue === '调试' ? 2 : 1)
      const progress = clamp(j.progress + inc, 0, 100)
      const loss = clamp(j.loss - sRand(-0.02, 0.05), 0.05, 5)
      const throughput = clamp(j.throughput + sRand(-800, 800), 1000, 60000)
      const mfu = clamp(j.mfu + sRand(-1.5, 1.5), 20, 62)
      if (progress >= 100) {
        return { ...j, status: 'succeeded', progress: 100, endAt: now, loss, throughput, mfu }
      }
      // 极小概率失败
      if (simRng() > 0.998) {
        return { ...j, status: 'failed', endAt: now, progress }
      }
      return { ...j, progress, loss, throughput, mfu }
    }
    return j
  })
}

/**
 * 补充新任务，维持队列活跃度
 */
export function maybeAddJob(jobs: Job[], now: number): Job | null {
  if (jobs.length > 60 || simRng() > 0.06) return null
  const queue = sPick(['训练', '推理', '调试'] as const)
  const gpuRequest = queue === '训练' ? sPick([64, 128, 256]) : queue === '推理' ? sPick([8, 16]) : sPick([2, 4, 8])
  return {
    id: `JOB-${now.toString(36).toUpperCase()}`,
    name: `${sPick(['Qwen3-72B', 'LLaMA4-405B', 'DeepSeek-R2', 'GPT-Vision'])}-${(simRng() * 99) | 0}`,
    owner: sPick(['张伟', '李娜', '王强', 'AI-Lab', '平台组']),
    queue,
    gpuRequest,
    status: 'queued',
    progress: 0,
    submitAt: now,
    priority: ((simRng() * 9) | 0) + 1,
    model: sPick(['Qwen3-72B-Pretrain', 'LLaMA4-405B-SFT', 'GPT-Vision-MoE']),
    loss: sRand(1.5, 4),
    throughput: sRand(5000, 40000),
    mfu: sRand(30, 55),
    assignedNodes: [],
  }
}

// ============================================================
// 时序数据推进
// ============================================================
export function pushSeries(series: TimePoint[], t: number, v: number, maxLen = 60): TimePoint[] {
  const next = series.length >= maxLen ? series.slice(1) : series.slice()
  next.push({ t, v })
  return next
}

// ============================================================
// 自愈动作日志
// ============================================================
let healSeq = 0
const HEAL_ACTIONS = [
  { action: '自动隔离故障节点', reason: 'GPU ECC 错误超阈值' },
  { action: 'GPU 降频保护', reason: '核心温度超过 85°C' },
  { action: '任务热迁移', reason: '预测节点 30min 内故障' },
  { action: '重启 NCCL 通信服务', reason: '集合通信超时' },
  { action: '切换备用 InfiniBand 链路', reason: '主链路误码率升高' },
  { action: '触发存储快照', reason: 'checkpoint 保护' },
]

export function maybeHeal(nodes: GpuNode[], now: number): HealingAction | null {
  const critical = nodes.filter((n) => n.status === 'critical')
  if (!critical.length || simRng() > 0.2) return null
  const target = sPick(critical)
  const tpl = sPick(HEAL_ACTIONS)
  healSeq++
  return {
    id: `HEAL-${now.toString(36)}-${healSeq}`,
    timestamp: now,
    action: tpl.action,
    target: target.id,
    reason: tpl.reason,
    status: simRng() > 0.15 ? 'success' : 'running',
    latencyMs: (sRand(120, 4800)) | 0,
  }
}

// ============================================================
// 慢节点检测
// ============================================================
export function detectSlowNodes(nodes: GpuNode[], jobs: Job[]): SlowNode[] {
  const running = nodes.filter((n) => n.status !== 'offline')
  const avgUtil = running.reduce((s, n) => s + n.util, 0) / (running.length || 1)
  return running
    .map((n) => ({ n, dev: ((n.util - avgUtil) / (avgUtil || 1)) * 100 }))
    .filter((x) => x.dev < -18)
    .sort((a, b) => a.dev - b.dev)
    .slice(0, 8)
    .map(({ n, dev }) => ({
      nodeId: n.id,
      job: jobs.find((j) => j.assignedNodes.includes(n.id))?.name ?? '未分配',
      deviation: Math.abs(dev),
      metric: dev < -30 ? '通信同步耗时偏高' : '算力利用率低于集群均值',
      suggestion: dev < -30 ? '建议排查 NIC 链路 / 重调度' : '建议观察或热迁移',
    }))
}

// ============================================================
// 心跳驱动
// ============================================================
export interface SimDriverHandle {
  stop: () => void
}

export function startSimulator(step: () => void, intervalMs = 1000): SimDriverHandle {
  const id = window.setInterval(step, intervalMs)
  return { stop: () => window.clearInterval(id) }
}
