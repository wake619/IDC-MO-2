import { useEffect, useMemo, useRef, useState } from 'react'
import Panel from '../components/Panel'
import ChartBox from '../components/ChartBox'
import { EmptyState } from '../components/ui'
import { useSimStore } from '../stores/simStore'
import { COLORS } from '../theme/colors'
import type { EChartsOption } from 'echarts'
import type { TimePoint } from '../types'

interface Msg {
  id: number
  role: 'user' | 'ai'
  text: string
  time: string
}

const QUICK_QS = ['节点温度过高怎么排查？', '训练任务变慢的原因', 'GPU 利用率偏低如何优化', '网络链路抖动诊断']

export default function AiOps() {
  const utilSeries = useSimStore((s) => s.utilSeries)
  const predictions = useSimStore((s) => s.failurePredictions)
  const healing = useSimStore((s) => s.healingActions)
  const kpi = useSimStore((s) => s.kpi)

  // 异常检测：基于滑动均值的标准差
  const anomalies = useMemo(() => {
    const vals = utilSeries.map((p) => p.v)
    const out: TimePoint[] = []
    for (let i = 5; i < vals.length; i++) {
      const win = vals.slice(i - 5, i)
      const mean = win.reduce((a, b) => a + b, 0) / win.length
      const std = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / win.length)
      if (Math.abs(vals[i] - mean) > Math.max(3.5, std * 2.2)) {
        out.push(utilSeries[i])
      }
    }
    return out.slice(-8)
  }, [utilSeries])

  const anomalyOption = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: 'axis' },
      grid: { left: 10, right: 16, top: 24, bottom: 20 },
      xAxis: { type: 'time', axisLabel: { fontSize: 9, formatter: (v: number) => new Date(v).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) } },
      yAxis: { type: 'value', name: '利用率 %', nameTextStyle: { fontSize: 10, color: '#7c93b0' }, max: 100, axisLabel: { fontSize: 9 }, splitLine: { lineStyle: { color: 'rgba(34,211,238,0.08)', type: 'dashed' } } },
      series: [
        {
          name: '集群利用率',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: utilSeries.slice(-60).map((p) => [p.t, +p.v.toFixed(2)]),
          lineStyle: { width: 1.8, color: COLORS.cyber },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(34,211,238,0.3)' }, { offset: 1, color: 'rgba(34,211,238,0.02)' }] } },
          markPoint: {
            symbol: 'pin',
            symbolSize: 34,
            itemStyle: { color: COLORS.alarm },
            label: { color: '#fff', fontSize: 9, formatter: '!' },
            data: anomalies.map((a, i) => ({ name: `anomaly-${i}`, coord: [a.t, +a.v.toFixed(2)], value: 'AI' })),
          },
        },
      ],
    }),
    [utilSeries, anomalies],
  )

  return (
    <div className="h-full w-full flex flex-col gap-2 p-2 overflow-hidden">
      <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
        {/* 异常检测 */}
        <Panel
          title="AI 实时异常检测"
          subtitle={`基于滑动窗口 3σ · 检出 ${anomalies.length} 个异常点`}
          className="col-span-12 lg:col-span-8 min-h-0"
          bodyClassName="p-1 flex flex-col"
        >
          <div className="flex-1 min-h-[180px]">
            <ChartBox noAnimation option={anomalyOption} />
          </div>
          <div className="shrink-0 grid grid-cols-4 gap-2 mt-1">
            <AiKpi label="检测指标流" value="1,248" unit="路" color={COLORS.cyber} />
            <AiKpi label="模型准确率" value="98.6" unit="%" color={COLORS.online} />
            <AiKpi label="误报率" value="0.8" unit="%" color={COLORS.amber} />
            <AiKpi label="检出延迟" value="1.2" unit="s" color={COLORS.purple} />
          </div>
        </Panel>

        {/* 故障预测 */}
        <Panel
          title="设备故障预测"
          subtitle="RUL 剩余寿命预测 · Top 风险"
          className="col-span-12 lg:col-span-4 min-h-0"
          bodyClassName="overflow-y-auto"
        >
          {predictions.slice(0, 12).map((p) => (
            <div key={p.id} className="panel p-2 mb-1.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[11px] text-cyber-400 truncate">{p.target}</span>
                <span className="text-[9px] px-1 py-px rounded-sm border border-cyber-500/30 text-slate-400">{p.component}</span>
                <span
                  className="ml-auto text-[12px] font-mono font-bold"
                  style={{ color: p.probability > 70 ? COLORS.alarm : p.probability > 40 ? COLORS.amber : COLORS.online }}
                >
                  {p.probability.toFixed(0)}%
                </span>
              </div>
              {/* 概率条 */}
              <div className="h-1.5 rounded-full bg-void-700 overflow-hidden mb-1">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${p.probability}%`,
                    background: p.probability > 70 ? COLORS.alarm : p.probability > 40 ? COLORS.amber : COLORS.online,
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-slate-500">
                <span>RUL 剩余寿命 <span className="text-slate-300">{p.rul} 天</span></span>
                <span>置信度 {p.confidence.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </Panel>
      </div>

      <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
        {/* 智能诊断对话 */}
        <DiagnosticChat kpiUtil={kpi.avgUtil} kpiAlerts={kpi.activeAlerts} />

        {/* 自愈动作日志 */}
        <Panel
          title="自愈动作执行日志"
          subtitle="自动化闭环处置"
          className="col-span-12 lg:col-span-6 min-h-0"
          bodyClassName="overflow-y-auto p-1"
        >
          {healing.length === 0 ? (
            <EmptyState text="暂无自愈动作" />
          ) : (
            healing.map((h) => (
              <div key={h.id} className="flex items-start gap-2 px-2 py-1.5 border-b border-cyber-500/8">
                <span
                  className="mt-1 w-2 h-2 rounded-full shrink-0"
                  style={{
                    background: h.status === 'success' ? COLORS.online : h.status === 'running' ? COLORS.amber : COLORS.alarm,
                    boxShadow: `0 0 6px ${h.status === 'success' ? COLORS.online : COLORS.amber}`,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-200">{h.action}</span>
                    <span className="font-mono text-[10px] text-cyber-400/80">{h.target}</span>
                    <span
                      className="ml-auto text-[9px] px-1.5 py-px rounded-sm font-mono"
                      style={{
                        color: h.status === 'success' ? COLORS.online : h.status === 'running' ? COLORS.amber : COLORS.alarm,
                        background: `${h.status === 'success' ? COLORS.online : h.status === 'running' ? COLORS.amber : COLORS.alarm}18`,
                      }}
                    >
                      {h.status === 'success' ? '成功' : h.status === 'running' ? '执行中' : '失败'} · {h.latencyMs}ms
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    触发原因: {h.reason} · {new Date(h.timestamp).toLocaleTimeString('zh-CN')}
                  </div>
                </div>
              </div>
            ))
          )}
        </Panel>
      </div>
    </div>
  )
}

function AiKpi({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="bg-void-850/70 rounded-sm px-2 py-1.5 border border-cyber-500/10 text-center">
      <div className="text-[15px] font-mono font-bold" style={{ color }}>
        {value}<span className="text-[9px] ml-0.5 opacity-70">{unit}</span>
      </div>
      <div className="hud-label mt-0.5 text-[9px]">{label}</div>
    </div>
  )
}

// ============================================================
// 智能诊断对话面板（规则问答）
// ============================================================
function diagnose(q: string, util: number, alerts: number): string {
  const text = q.toLowerCase()
  if (/温度|过温|热|散热|制冷/.test(text)) {
    return `【根因分析链路】GPU 温度异常 → ①检查机柜热通道回风温度 → ②核查液冷回路流量/进水温度 → ③检查风扇转速与灰尘堵塞 → ④排查相邻机柜热点干扰。\n【当前态势】集群平均利用率 ${util.toFixed(1)}%，活跃告警 ${alerts} 条。\n【建议动作】1) 对过温节点自动降频保护；2) 上调冷通道风机转速；3) 若持续 >88°C 触发任务热迁移并隔离节点。`
  }
  if (/慢|延迟|卡顿|性能下降|变慢/.test(text)) {
    return `【根因分析链路】训练变慢 → ①慢节点检测（straggler）→ ②NCCL 集合通信耗时 → ③IB 链路拥塞/误码 → ④存储 checkpoint I/O 瓶颈。\n【诊断结论】最可能为个别慢节点拖累 AllReduce 同步（木桶效应）。\n【建议动作】1) 定位偏差 >18% 的慢节点并隔离；2) 启用通信/计算 overlap；3) 检查 NIC 固件与链路质量。`
  }
  if (/利用率|负载|空闲|算力/.test(text)) {
    return `【根因分析链路】GPU 利用率偏低 → ①数据加载 I/O 等待 → ②batch size 过小 → ③通信占比过高 → ④任务碎片化调度。\n【当前态势】集群平均利用率 ${util.toFixed(1)}%。\n【建议动作】1) 增大数据预取并行度；2) 提升 batch size / 启用梯度累积；3) 碎片整理，合并小任务，启用 Gang Scheduling。`
  }
  if (/故障|宕机|离线|挂了|不可用/.test(text)) {
    return `【根因分析链路】节点故障 → ①心跳丢失确认 → ②BMC/IPMI 带外日志 → ③硬件诊断（GPU/内存/电源/磁盘）→ ④dmesg & XID 错误码。\n【诊断结论】结合故障预测模型，优先排查高故障概率部件（HBM/电源模块）。\n【建议动作】1) 自动隔离并摘除调度；2) 迁移在跑任务；3) 触发带外硬件自检并生成工单。`
  }
  if (/网络|链路|ib|infiniband|rdma|丢包|抖动/.test(text)) {
    return `【根因分析链路】网络抖动 → ①IB 端口误码率/符号错误 → ②光模块光衰 → ③交换机缓冲拥塞 → ④路由/子网管理器(SM)异常。\n【诊断结论】多因光模块老化或链路拥塞导致 PFC 触发。\n【建议动作】1) 切换备用链路；2) 更换高误码光模块；3) 调整 QoS 与拥塞控制参数。`
  }
  if (/pue|能耗|电费|节能|功率/.test(text)) {
    return `【根因分析链路】能耗偏高 → ①制冷系统效率(COP) → ②冷通道温度设定 → ③IT 负载率 → ④供配电损耗。\n【建议动作】1) 上调冷通道温度至 24°C；2) 优化气流组织，加装盲板；3) 非紧急任务错峰至电价低谷；4) 评估余热回收。`
  }
  return `我已收到你的问题。当前集群平均利用率 ${util.toFixed(1)}%，活跃告警 ${alerts} 条。\n我可以帮你诊断：GPU 过温、训练变慢、利用率优化、节点故障、网络抖动、能耗 PUE 等场景。\n请描述具体现象或提供节点/任务 ID，我会给出【根因分析链路 + 建议动作】。`
}

function DiagnosticChat({ kpiUtil, kpiAlerts }: { kpiUtil: number; kpiAlerts: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: 0,
      role: 'ai',
      text: '你好，我是智算运维 AI 诊断助手 ✦。我可以基于实时集群数据为你分析 GPU 过温、训练变慢、利用率优化、节点故障、网络抖动等问题。请描述你的故障现象～',
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(1)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, typing])

  const send = (q: string) => {
    const question = q.trim()
    if (!question || typing) return
    const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    setMsgs((m) => [...m, { id: idRef.current++, role: 'user', text: question, time: now() }])
    setInput('')
    setTyping(true)
    setTimeout(() => {
      setMsgs((m) => [...m, { id: idRef.current++, role: 'ai', text: diagnose(question, kpiUtil, kpiAlerts), time: now() }])
      setTyping(false)
    }, 700)
  }

  return (
    <Panel
      title="智能诊断助手"
      subtitle="AIOps 根因分析 · 规则 + 实时数据"
      className="col-span-12 lg:col-span-6 min-h-0"
      bodyClassName="p-0 flex flex-col overflow-hidden"
      actions={<span className="text-[10px] text-online-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-online-400 animate-pulseGlow" />在线</span>}
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-md px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-cyber-500/20 text-cyan-100 border border-cyber-500/30'
                  : 'bg-void-850 text-slate-300 border border-cyber-500/12'
              }`}
            >
              {m.role === 'ai' && <div className="text-[10px] text-cyber-400 mb-1 font-semibold">✦ AI 诊断</div>}
              {m.text}
              <div className="text-[9px] text-slate-600 mt-1 text-right font-mono">{m.time}</div>
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-void-850 border border-cyber-500/12 rounded-md px-3 py-2 text-[12px] text-cyber-400 flex items-center gap-1">
              <span className="animate-pulseGlow">分析中</span>
              <span className="flex gap-0.5">
                <Dot delay="0s" /><Dot delay="0.2s" /><Dot delay="0.4s" />
              </span>
            </div>
          </div>
        )}
      </div>
      {/* 快捷问题 */}
      <div className="shrink-0 px-3 pb-1.5 flex flex-wrap gap-1.5">
        {QUICK_QS.map((q) => (
          <button key={q} onClick={() => send(q)} className="text-[10px] px-2 py-1 rounded-sm border border-cyber-500/25 text-cyber-400/80 hover:bg-cyber-500/10 transition-colors">
            {q}
          </button>
        ))}
      </div>
      {/* 输入框 */}
      <div className="shrink-0 p-2 border-t border-cyber-500/12 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(input)}
          placeholder="描述故障现象，如「A-R03 节点温度过高」…"
          className="flex-1 bg-void-850 border border-cyber-500/20 rounded-sm px-2.5 py-1.5 text-[12px] text-slate-200 placeholder-slate-600 outline-none focus:border-cyber-400/60"
        />
        <button onClick={() => send(input)} className="btn btn-cyber px-4">发送 ➤</button>
      </div>
    </Panel>
  )
}

function Dot({ delay }: { delay: string }) {
  return <span className="w-1 h-1 rounded-full bg-cyber-400 animate-pulseGlow" style={{ animationDelay: delay }} />
}
