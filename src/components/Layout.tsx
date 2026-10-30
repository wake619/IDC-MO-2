import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { SideNav, NAV_ITEMS } from './nav'
import { useSimStore } from '../stores/simStore'

/** 实时时钟 */
function Clock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
  return (
    <div className="flex items-center gap-3 font-mono">
      <span className="text-[11px] text-slate-500">{date} {week}</span>
      <span className="text-lg text-cyber-glow tracking-widest text-glow tabular-nums">{time}</span>
    </div>
  )
}

export default function Layout() {
  const location = useLocation()
  const activeAlerts = useSimStore((s) => s.kpi.activeAlerts)
  const started = useSimStore((s) => s.started)
  const [isFull, setIsFull] = useState(false)

  const current = NAV_ITEMS.find((n) =>
    n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path),
  )

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFull(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFull(false)
    }
  }

  return (
    <div className="relative z-10 h-screen w-screen flex bg-void-950 overflow-hidden">
      {/* 侧边栏 */}
      <aside className="w-[196px] shrink-0 border-r border-cyber-500/12 bg-void-900/60 backdrop-blur flex flex-col">
        {/* Logo */}
        <div className="px-3 h-14 flex items-center gap-2 border-b border-cyber-500/12">
          <div className="w-8 h-8 rounded flex items-center justify-center border border-cyber-500/40 bg-cyber-500/10 shadow-glow-sm">
            <span className="text-cyber-glow text-lg text-glow animate-flicker">◈</span>
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-[13px] text-white leading-tight tracking-wide">
              IDC·智算透视
            </div>
            <div className="text-[9px] text-cyber-500/70 tracking-[0.15em] uppercase">
              AI Infra Ops
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SideNav />
        </div>
        {/* 底部状态 */}
        <div className="px-3 py-2 border-t border-cyber-500/12 text-[10px] space-y-1">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${started ? 'bg-online-400 animate-pulseGlow' : 'bg-slate-600'}`}
            />
            <span className="text-slate-500">
              仿真引擎 <span className={started ? 'text-online-400' : 'text-slate-500'}>
                {started ? 'RUNNING' : 'IDLE'}
              </span>
            </span>
          </div>
          <div className="text-slate-600 font-mono">v1.0.0 · DEMO</div>
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 顶栏 */}
        <header className="h-14 shrink-0 px-4 flex items-center justify-between border-b border-cyber-500/12 bg-void-900/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[15px] font-semibold text-white tracking-wide">
              {current?.label ?? '超级智算数据中心运维透视平台'}
            </h1>
            <span className="hidden md:inline text-[10px] px-2 py-0.5 rounded-sm border border-cyber-500/30 text-cyber-400/80 bg-cyber-500/5">
              超级智算数据中心 · AI 基础设施
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Clock />
            {/* 全局告警角标 */}
            <div className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-alarm-500/40 bg-alarm-500/10">
              <span className="text-alarm-400 text-sm">⚠</span>
              <span className="text-alarm-400 font-mono font-bold text-sm tabular-nums">
                {activeAlerts}
              </span>
              <span className="text-[10px] text-alarm-400/70">活跃告警</span>
              {activeAlerts > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-alarm-500 animate-pulseGlow" />
              )}
            </div>
            <button
              onClick={toggleFullscreen}
              className="btn btn-ghost"
              title="全屏大屏模式"
            >
              {isFull ? '⤢ 退出全屏' : '⛶ 大屏模式'}
            </button>
          </div>
        </header>

        {/* 内容区 */}
        <main className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
