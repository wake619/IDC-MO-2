import { NavLink } from 'react-router-dom'

export interface NavItem {
  path: string
  label: string
  icon: string
  group: string
}

/** 侧边导航配置（分组） */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '总览驾驶舱', icon: '◈', group: '监控透视' },
  { path: '/gpu', label: 'GPU 集群', icon: '▦', group: '监控透视' },
  { path: '/dc3d', label: '3D 机房透视', icon: '⬢', group: '监控透视' },
  { path: '/alerts', label: '告警中心', icon: '⚠', group: '监控透视' },
  { path: '/performance', label: '性能分析', icon: '∿', group: '监控透视' },
  { path: '/scheduling', label: '算力调度', icon: '⧉', group: 'AI 能力' },
  { path: '/aiops', label: 'AIOps 智能运维', icon: '✦', group: 'AI 能力' },
  { path: '/cmdb', label: '资产 CMDB', icon: '▤', group: '运维管理' },
  { path: '/energy', label: '能耗与 PUE', icon: '⚡', group: '运维管理' },
  { path: '/capacity', label: '容量规划', icon: '◲', group: '运维管理' },
]

export const NAV_GROUPS = ['监控透视', 'AI 能力', '运维管理']

export function SideNav() {
  return (
    <nav className="flex flex-col gap-3 py-3">
      {NAV_GROUPS.map((group) => (
        <div key={group}>
          <div className="px-3 pb-1 text-[9px] tracking-[0.2em] text-slate-600 uppercase font-semibold">
            {group}
          </div>
          <div className="flex flex-col gap-0.5">
            {NAV_ITEMS.filter((n) => n.group === group).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `relative flex items-center gap-2.5 px-3 py-2 text-[13px] transition-all group ${
                    isActive
                      ? 'text-cyber-glow bg-cyber-500/10'
                      : 'text-slate-400 hover:text-cyber-glow hover:bg-cyber-500/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 transition-all ${
                        isActive ? 'h-6 bg-cyber-400 shadow-glow' : 'group-hover:h-3 bg-cyber-500/50'
                      }`}
                    />
                    <span className={`text-base w-5 text-center ${isActive ? 'text-glow' : ''}`}>
                      {item.icon}
                    </span>
                    <span className="font-medium tracking-wide">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
