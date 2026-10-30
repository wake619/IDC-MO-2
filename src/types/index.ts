// ============================================================
// 领域模型定义 —— 超级智算数据中心运维透视平台
// ============================================================

/** GPU 型号 */
export type GpuModel = 'H100' | 'A100' | '910B'

/** 设备健康/状态分级 */
export type HealthLevel = 'normal' | 'warning' | 'critical' | 'offline'

/** 告警等级 */
export type AlertLevel = 'P0' | 'P1' | 'P2' | 'P3'

/** 告警状态 */
export type AlertStatus = 'active' | 'acked' | 'silenced' | 'resolved'

/** 告警来源类别 */
export type AlertSource = 'GPU' | '节点' | '网络' | '存储' | '供电' | '制冷'

/** 单张 GPU 卡的实时指标 */
export interface GpuMetrics {
  index: number
  util: number // 利用率 %
  memUtil: number // 显存占用 %
  temp: number // 温度 °C
  power: number // 功耗 W
  nvlink: number // NVLink 带宽 GB/s
  eccErrors: number // ECC 错误计数
  level: HealthLevel
}

/** GPU 计算节点（一台服务器，含 8 卡） */
export interface GpuNode {
  id: string // 如 A-R03-C07-N2
  hall: string // 机房 A / B
  row: number // 排
  rack: number // 机柜
  model: GpuModel
  gpuCount: number
  status: HealthLevel
  healthScore: number // 0-100
  util: number // 节点平均利用率
  memUtil: number
  temp: number
  power: number // 整机功耗 W
  ip: string
  gpus: GpuMetrics[]
}

/** 机柜 */
export interface Rack {
  id: string // A-R03-C07
  hall: string
  row: number
  col: number
  nodeCount: number
  power: number // 机柜功耗 kW
  inletTemp: number // 冷通道温度
  outletTemp: number // 热通道温度
  level: HealthLevel
  // 3D 布局坐标（网格索引）
  x: number
  z: number
}

/** 机房 */
export interface Hall {
  id: string // A / B
  name: string
  rows: number
  colsPerRow: number
  racks: Rack[]
}

/** 告警事件 */
export interface AlertItem {
  id: string
  level: AlertLevel
  source: AlertSource
  title: string
  target: string // 关联对象 id
  status: AlertStatus
  value: string // 触发值描述
  timestamp: number
  ackAt?: number
  resolveAt?: number
}

/** 调度任务状态 */
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

/** 资源队列类型 */
export type QueueType = '训练' | '推理' | '调试'

/** 计算任务 */
export interface Job {
  id: string
  name: string
  owner: string
  queue: QueueType
  gpuRequest: number
  status: JobStatus
  progress: number // 0-100
  submitAt: number
  startAt?: number
  endAt?: number
  priority: number
  model: string // 训练模型名
  loss: number
  throughput: number // tokens/s
  mfu: number // 模型算力利用率 %
  assignedNodes: string[]
}

/** 资产类型 */
export type AssetType = '服务器' | 'GPU卡' | '交换机' | '存储阵列'

/** 生命周期状态 */
export type LifecycleStatus = '在保' | '过保' | '待报废'

/** CMDB 资产条目 */
export interface Asset {
  id: string
  sn: string
  type: AssetType
  model: string
  vendor: string
  hall: string
  rackId: string
  uPosition: string
  onlineDate: string
  warrantyUntil: string
  lifecycle: LifecycleStatus
  business: string
  status: HealthLevel
  repairCount: number
}

/** KPI 汇总 */
export interface KpiSnapshot {
  totalPflops: number
  gpuTotal: number
  gpuOnline: number
  onlineRate: number
  avgUtil: number
  activeAlerts: number
  pue: number
  runningJobs: number
  totalPowerKw: number
  itPowerKw: number
  coolingPowerKw: number
}

/** 时序数据点 */
export interface TimePoint {
  t: number
  v: number
}

/** 3D 视图模式 */
export type ViewMode = 'temperature' | 'load' | 'alert' | 'topology'

/** 故障预测条目 */
export interface FailurePrediction {
  id: string
  target: string
  component: string // 磁盘 / GPU / 电源 / 风扇
  probability: number // 故障概率 %
  rul: number // 剩余寿命（天）
  confidence: number
}

/** 自愈动作日志 */
export interface HealingAction {
  id: string
  timestamp: number
  action: string // 自动隔离 / 降频 / 任务迁移 / 重启服务
  target: string
  reason: string
  status: 'success' | 'running' | 'failed'
  latencyMs: number
}

/** 慢节点检测结果 */
export interface SlowNode {
  nodeId: string
  job: string
  deviation: number // 相对集群均值偏差 %
  metric: string
  suggestion: string
}
