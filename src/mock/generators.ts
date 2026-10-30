import type {
  Asset,
  FailurePrediction,
  GpuMetrics,
  GpuModel,
  GpuNode,
  Hall,
  HealthLevel,
  Job,
  QueueType,
  Rack,
} from '../types'

// ============================================================
// 确定性伪随机数生成器（Mulberry32）—— 固定种子保证每次刷新一致
// ============================================================
export function createRng(seed: number) {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = createRng(20261030)

/** [min, max) 区间随机 */
const rand = (min: number, max: number) => min + rng() * (max - min)
/** 整数随机 [min, max] */
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))
/** 从数组随机取 */
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]

// ============================================================
// 机房拓扑常量
// ============================================================
export const HALLS = ['A', 'B']
export const ROWS_PER_HALL = 8
export const COLS_PER_ROW = 12 // 每排 12 个机柜
export const NODES_PER_RACK = 4 // 每机柜 4 台服务器
export const GPUS_PER_NODE = 8

export const GPU_MODELS: GpuModel[] = ['H100', 'A100', '910B']

/** 型号对应的单卡算力（PFLOPS，FP16 稠密） */
export const MODEL_PFLOPS: Record<GpuModel, number> = {
  H100: 0.989,
  A100: 0.312,
  '910B': 0.4,
}

/** 型号对应的单卡功耗上限（W） */
export const MODEL_TDP: Record<GpuModel, number> = {
  H100: 700,
  A100: 400,
  '910B': 400,
}

// ============================================================
// 布局常量（供 3D 场景复用）
// ============================================================
export const RACK_W = 1.2 // 机柜宽
export const RACK_D = 1.6 // 机柜深
export const RACK_H = 4.2 // 机柜高
export const AISLE_GAP = 3.2 // 冷热通道间距
export const ROW_GAP = 2.0 // 排内机柜间距
export const HALL_GAP = 14 // 两机房之间的间隔

/**
 * 计算机柜的世界坐标（x, z）
 * 两机房沿 x 轴左右分开，排沿 z 轴纵深，机柜沿 x 轴排列
 */
export function rackWorldPosition(rack: Rack): { x: number; z: number } {
  const hallOffset = rack.hall === 'A' ? -HALL_GAP : HALL_GAP
  const x = hallOffset + (rack.col - COLS_PER_ROW / 2) * ROW_GAP
  const z = (rack.row - ROWS_PER_HALL / 2) * (RACK_D + AISLE_GAP)
  return { x, z }
}

function healthFromTemp(temp: number, util: number): HealthLevel {
  if (temp >= 88 || util >= 99) return 'critical'
  if (temp >= 78 || util >= 92) return 'warning'
  return 'normal'
}

// ============================================================
// 生成 GPU 节点
// ============================================================
function genNode(hall: string, row: number, rack: number, slot: number): GpuNode {
  const model = GPU_MODELS[(row + rack + slot) % GPU_MODELS.length]
  const baseUtil = rand(35, 96)
  const gpus: GpuMetrics[] = []
  let tempSum = 0
  let utilSum = 0
  let memSum = 0
  let powerSum = 0
  const tdp = MODEL_TDP[model]

  for (let i = 0; i < GPUS_PER_NODE; i++) {
    const util = Math.min(100, Math.max(0, baseUtil + rand(-12, 12)))
    const temp = 45 + util * 0.42 + rand(-4, 8)
    const memUtil = Math.min(99, Math.max(5, util + rand(-15, 10)))
    const power = tdp * (0.35 + (util / 100) * 0.6) + rand(-20, 20)
    const level = healthFromTemp(temp, util)
    gpus.push({
      index: i,
      util,
      memUtil,
      temp,
      power,
      nvlink: rand(120, 900),
      eccErrors: rng() > 0.94 ? randInt(1, 40) : 0,
      level,
    })
    tempSum += temp
    utilSum += util
    memSum += memUtil
    powerSum += power
  }

  const avgTemp = tempSum / GPUS_PER_NODE
  const avgUtil = utilSum / GPUS_PER_NODE
  const worst = gpus.reduce<HealthLevel>((acc, g) => {
    const order: HealthLevel[] = ['normal', 'warning', 'critical', 'offline']
    return order.indexOf(g.level) > order.indexOf(acc) ? g.level : acc
  }, 'normal')

  // 少量节点离线
  const offline = rng() > 0.985
  const status: HealthLevel = offline ? 'offline' : worst
  const healthScore = offline
    ? 0
    : Math.round(100 - (avgTemp - 45) * 0.7 - gpus.reduce((s, g) => s + g.eccErrors, 0) * 0.4 - (status === 'critical' ? 15 : status === 'warning' ? 6 : 0))

  return {
    id: `${hall}-R${String(row).padStart(2, '0')}-C${String(rack).padStart(2, '0')}-N${slot + 1}`,
    hall,
    row,
    rack,
    model,
    gpuCount: GPUS_PER_NODE,
    status,
    healthScore: Math.max(0, Math.min(100, healthScore)),
    util: offline ? 0 : avgUtil,
    memUtil: offline ? 0 : memSum / GPUS_PER_NODE,
    temp: offline ? 25 : avgTemp,
    power: offline ? 60 : powerSum,
    ip: `10.${hall === 'A' ? 10 : 20}.${row}.${rack * 4 + slot + 1}`,
    gpus,
  }
}

// ============================================================
// 生成机房 / 机柜 / 节点全量拓扑
// ============================================================
export function generateTopology(): { halls: Hall[]; nodes: GpuNode[]; racks: Rack[] } {
  const halls: Hall[] = []
  const allNodes: GpuNode[] = []
  const allRacks: Rack[] = []

  for (const h of HALLS) {
    const racks: Rack[] = []
    for (let row = 1; row <= ROWS_PER_HALL; row++) {
      for (let col = 1; col <= COLS_PER_ROW; col++) {
        const nodes: GpuNode[] = []
        for (let slot = 0; slot < NODES_PER_RACK; slot++) {
          const n = genNode(h, row, col, slot)
          nodes.push(n)
          allNodes.push(n)
        }
        const rackPower = nodes.reduce((s, n) => s + n.power, 0) / 1000 // kW
        const inlet = rand(18, 24)
        const outlet = inlet + rackPower * 1.4 + rand(4, 9)
        const level: HealthLevel =
          outlet > 42 ? 'critical' : outlet > 36 ? 'warning' : 'normal'
        const rack: Rack = {
          id: `${h}-R${String(row).padStart(2, '0')}-C${String(col).padStart(2, '0')}`,
          hall: h,
          row,
          col,
          nodeCount: NODES_PER_RACK,
          power: rackPower,
          inletTemp: inlet,
          outletTemp: outlet,
          level,
          x: col,
          z: row,
        }
        racks.push(rack)
        allRacks.push(rack)
      }
    }
    halls.push({
      id: h,
      name: `${h} 栋智算机房`,
      rows: ROWS_PER_HALL,
      colsPerRow: COLS_PER_ROW,
      racks,
    })
  }

  return { halls, nodes: allNodes, racks: allRacks }
}

// ============================================================
// 生成 CMDB 资产台账
// ============================================================
const VENDORS = ['NVIDIA', 'Inspur', 'H3C', 'Huawei', 'Supermicro', 'Lenovo']
const BUSINESSES = ['大模型训练', '推理服务', '科学计算', '自动驾驶', '多模态研究', '推荐系统']
const SWITCH_MODELS = ['QS-Q3200 InfiniBand', 'CE8850 64CQ', 'SN3700C', 'RG-N18000-X']
const STORAGE_MODELS = ['OceanStor Pacific', 'DD9900', 'FAS8700', 'Unity XT 880']

export function generateAssets(_racks: Rack[], nodes: GpuNode[]): Asset[] {
  const assets: Asset[] = []
  let seq = 1

  const mkDate = (yearAgo: number) => {
    const d = new Date(2026, 9, 30)
    d.setFullYear(d.getFullYear() - yearAgo)
    return d.toISOString().slice(0, 10)
  }

  // 服务器资产
  for (const n of nodes) {
    const ageYears = rand(0, 5)
    const online = mkDate(ageYears)
    const warrantyYears = 3
    const warrantyDate = new Date(online)
    warrantyDate.setFullYear(warrantyDate.getFullYear() + warrantyYears)
    const warrantyUntil = warrantyDate.toISOString().slice(0, 10)
    const lifecycle =
      ageYears > 5 ? '待报废' : warrantyUntil < '2026-10-30' ? '过保' : '在保'
    assets.push({
      id: `SRV-${String(seq++).padStart(5, '0')}`,
      sn: `SN${randInt(100000, 999999)}${n.hall}`,
      type: '服务器',
      model: `${pick(['NF5688', 'NF5488', 'Atlas 800', 'SR675 V3', 'DGX'])} ${n.model}`,
      vendor: n.model === '910B' ? 'Huawei' : pick(VENDORS),
      hall: n.hall,
      rackId: `${n.hall}-R${String(n.row).padStart(2, '0')}-C${String(n.rack).padStart(2, '0')}`,
      uPosition: `U${randInt(1, 40)}-U${randInt(1, 40) + 3}`,
      onlineDate: online,
      warrantyUntil,
      lifecycle,
      business: pick(BUSINESSES),
      status: n.status,
      repairCount: rng() > 0.85 ? randInt(1, 5) : 0,
    })
  }

  // 交换机资产（每排 2 台）
  for (const h of HALLS) {
    for (let row = 1; row <= ROWS_PER_HALL; row++) {
      for (let k = 0; k < 2; k++) {
        const ageYears = rand(0, 4)
        const online = mkDate(ageYears)
        assets.push({
          id: `NET-${String(seq++).padStart(5, '0')}`,
          sn: `SW${randInt(100000, 999999)}`,
          type: '交换机',
          model: pick(SWITCH_MODELS),
          vendor: pick(['H3C', 'Huawei', 'NVIDIA', 'Ruijie']),
          hall: h,
          rackId: `${h}-R${String(row).padStart(2, '0')}-C01`,
          uPosition: `U${randInt(40, 44)}`,
          onlineDate: online,
          warrantyUntil: mkDate(Math.max(0, ageYears - 3)),
          lifecycle: ageYears > 4 ? '过保' : '在保',
          business: 'RDMA 计算网络',
          status: rng() > 0.96 ? 'warning' : 'normal',
          repairCount: 0,
        })
      }
    }
  }

  // 存储阵列（每机房若干）
  for (const h of HALLS) {
    for (let k = 0; k < 6; k++) {
      const ageYears = rand(0, 5)
      const online = mkDate(ageYears)
      assets.push({
        id: `STG-${String(seq++).padStart(5, '0')}`,
        sn: `ST${randInt(100000, 999999)}`,
        type: '存储阵列',
        model: pick(STORAGE_MODELS),
        vendor: pick(['Huawei', 'Dell', 'NetApp', 'Dell EMC']),
        hall: h,
        rackId: `${h}-R0${k + 1}-C${COLS_PER_ROW}`,
        uPosition: `U1-U20`,
        onlineDate: online,
        warrantyUntil: mkDate(Math.max(0, ageYears - 3)),
        lifecycle: ageYears > 5 ? '待报废' : ageYears > 3 ? '过保' : '在保',
        business: '并行文件存储',
        status: rng() > 0.93 ? 'warning' : 'normal',
        repairCount: rng() > 0.9 ? randInt(1, 3) : 0,
      })
    }
  }

  // 备件 GPU 卡（库存资产）
  for (let k = 0; k < 160; k++) {
    const model = pick(GPU_MODELS)
    const ageYears = rand(0, 3)
    const online = mkDate(ageYears)
    assets.push({
      id: `GPU-${String(seq++).padStart(5, '0')}`,
      sn: `GP${randInt(100000, 999999)}`,
      type: 'GPU卡',
      model: `${model} ${model === 'H100' ? 'SXM5 80GB' : model === 'A100' ? 'SXM4 80GB' : '64GB'}`,
      vendor: model === '910B' ? 'Huawei' : 'NVIDIA',
      hall: pick(HALLS),
      rackId: '备件库',
      uPosition: `BIN-${randInt(1, 40)}`,
      onlineDate: online,
      warrantyUntil: mkDate(Math.max(0, ageYears - 3)),
      lifecycle: ageYears > 2.5 ? '过保' : '在保',
      business: '备件库存',
      status: rng() > 0.97 ? 'warning' : 'normal',
      repairCount: 0,
    })
  }

  return assets
}

// ============================================================
// 生成初始计算任务
// ============================================================
const JOB_MODELS = [
  'Qwen3-72B-Pretrain',
  'LLaMA4-405B-SFT',
  'GPT-Vision-MoE',
  'DeepSeek-R2-RLHF',
  'Multimodal-CLIP',
  'RecSys-DLRM-v3',
  'AlphaFold-MSA',
  'StableVideo-DiT',
]
const OWNERS = ['张伟', '李娜', '王强', '刘洋', '陈明', 'AI-Lab', '智算平台组', '自动驾驶组']

export function generateJobs(nodes: GpuNode[]): Job[] {
  const jobs: Job[] = []
  const now = Date.now()
  const queues: QueueType[] = ['训练', '推理', '调试']

  for (let i = 0; i < 42; i++) {
    const queue = queues[i % 3 === 0 ? 0 : i % 5 === 0 ? 2 : 1]
    const gpuRequest = queue === '训练' ? pick([64, 128, 256, 512]) : queue === '推理' ? pick([8, 16, 32]) : pick([1, 2, 4, 8])
    const r = rng()
    const status: Job['status'] = r > 0.72 ? 'queued' : r > 0.12 ? 'running' : 'succeeded'
    const submitAt = now - randInt(1, 400) * 60000
    const startAt = status !== 'queued' ? submitAt + randInt(1, 30) * 60000 : undefined
    const assigned =
      status === 'running'
        ? nodes
          .slice(randInt(0, nodes.length - 8), randInt(0, nodes.length - 8) + Math.ceil(gpuRequest / 8))
          .map((n) => n.id)
          .slice(0, Math.ceil(gpuRequest / 8))
        : []
    jobs.push({
      id: `JOB-${String(1000 + i)}`,
      name: `${pick(JOB_MODELS)}-${randInt(1, 99)}`,
      owner: pick(OWNERS),
      queue,
      gpuRequest,
      status,
      progress: status === 'succeeded' ? 100 : status === 'running' ? rand(2, 96) : 0,
      submitAt,
      startAt,
      endAt: status === 'succeeded' ? (startAt ?? submitAt) + randInt(30, 600) * 60000 : undefined,
      priority: randInt(1, 9),
      model: pick(JOB_MODELS),
      loss: rand(0.4, 3.6),
      throughput: rand(2000, 48000),
      mfu: rand(32, 58),
      assignedNodes: assigned,
    })
  }
  return jobs
}

// ============================================================
// 生成故障预测条目
// ============================================================
export function generateFailurePredictions(nodes: GpuNode[]): FailurePrediction[] {
  const preds: FailurePrediction[] = []
  const components = ['GPU', 'NVMe磁盘', '电源模块', '风扇', '内存条', 'HBM']
  const candidates = [...nodes].sort((a, b) => a.healthScore - b.healthScore).slice(0, 24)
  candidates.forEach((n, i) => {
    const probability = Math.min(97, Math.max(12, 100 - n.healthScore + rand(-8, 12)))
    preds.push({
      id: `PRED-${String(i + 1).padStart(3, '0')}`,
      target: n.id,
      component: pick(components),
      probability,
      rul: Math.round((100 - probability) * rand(2, 6) + 3),
      confidence: rand(72, 96),
    })
  })
  return preds.sort((a, b) => b.probability - a.probability)
}

export { healthFromTemp }
