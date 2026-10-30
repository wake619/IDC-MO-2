import { useMemo, useState } from 'react'
import Panel from '../components/Panel'
import ChartBox from '../components/ChartBox'
import { FilterChip, EmptyState, WaterBar } from '../components/ui'
import { HealthBadge } from '../components/Badges'
import { useSimStore } from '../stores/simStore'
import { rosePieOption } from '../theme/chartOptions'
import { COLORS } from '../theme/colors'
import type { Asset, AssetType, LifecycleStatus } from '../types'

const TYPES: AssetType[] = ['服务器', 'GPU卡', '交换机', '存储阵列']
const LIFECYCLES: LifecycleStatus[] = ['在保', '过保', '待报废']
const LIFECYCLE_COLOR: Record<LifecycleStatus, string> = {
  在保: COLORS.online,
  过保: COLORS.amber,
  待报废: COLORS.alarm,
}
const PAGE_SIZE = 18

type SortKey = 'id' | 'type' | 'onlineDate' | 'warrantyUntil' | 'repairCount'

export default function AssetCmdb() {
  const assets = useSimStore((s) => s.assets)
  const racks = useSimStore((s) => s.racks)

  const [type, setType] = useState<AssetType | 'all'>('all')
  const [lifecycle, setLifecycle] = useState<LifecycleStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [sortAsc, setSortAsc] = useState(true)
  const [selected, setSelected] = useState<Asset | null>(null)

  const filtered = useMemo(() => {
    const list = assets.filter((a) => {
      if (type !== 'all' && a.type !== type) return false
      if (lifecycle !== 'all' && a.lifecycle !== lifecycle) return false
      if (search && !(`${a.id} ${a.sn} ${a.model} ${a.rackId}`.toLowerCase().includes(search.toLowerCase())))
        return false
      return true
    })
    return list.sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortAsc ? cmp : -cmp
    })
  }, [assets, type, lifecycle, search, sortKey, sortAsc])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageAssets = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  // 资产构成（按类型）
  const typeDist = useMemo(() => {
    const map = new Map<AssetType, number>()
    TYPES.forEach((t) => map.set(t, 0))
    assets.forEach((a) => map.set(a.type, (map.get(a.type) ?? 0) + 1))
    return TYPES.map((t, i) => ({
      name: t,
      value: map.get(t) ?? 0,
      color: [COLORS.cyber, COLORS.purple, COLORS.online, COLORS.amber][i],
    }))
  }, [assets])

  // 生命周期分布
  const lifeDist = useMemo(() => {
    const map = new Map<LifecycleStatus, number>()
    LIFECYCLES.forEach((l) => map.set(l, 0))
    assets.forEach((a) => map.set(a.lifecycle, (map.get(a.lifecycle) ?? 0) + 1))
    return LIFECYCLES.map((l) => ({ name: l, value: map.get(l) ?? 0, color: LIFECYCLE_COLOR[l] }))
  }, [assets])

  // 上架率（服务器 vs 机柜容量）
  const rackFill = useMemo(() => {
    const servers = assets.filter((a) => a.type === '服务器').length
    const capacity = racks.length * 4
    return { servers, capacity, rate: (servers / capacity) * 100 }
  }, [assets, racks])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc)
    else {
      setSortKey(k)
      setSortAsc(true)
    }
  }

  return (
    <div className="h-full w-full flex flex-col gap-2 p-2 overflow-hidden">
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2">
        {/* 左：统计 */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-2 min-h-0">
          <Panel title="资产构成" subtitle={`共 ${assets.length} 项`} className="shrink-0">
            <ChartBox className="h-[160px]" option={rosePieOption(typeDist, { roseType: true })} />
          </Panel>
          <Panel title="生命周期分布" className="shrink-0">
            <ChartBox className="h-[150px]" option={rosePieOption(lifeDist, { inner: '55%' })} />
          </Panel>
          <Panel title="机架上架率" className="flex-1 min-h-0">
            <div className="space-y-3">
              <WaterBar
                label="服务器上架率"
                percent={rackFill.rate}
                color={COLORS.cyber}
                height={8}
                right={`${rackFill.rate.toFixed(1)}%`}
              />
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-void-850/70 rounded-sm p-2 border border-cyber-500/10">
                  <div className="stat-value text-lg">{rackFill.servers}</div>
                  <div className="hud-label">已上架服务器</div>
                </div>
                <div className="bg-void-850/70 rounded-sm p-2 border border-cyber-500/10">
                  <div className="stat-value text-lg" style={{ color: COLORS.amber }}>
                    {rackFill.capacity - rackFill.servers}
                  </div>
                  <div className="hud-label">剩余 U 位</div>
                </div>
              </div>
              <div className="space-y-1.5 pt-1 border-t border-cyber-500/10">
                {lifeDist.map((l) => (
                  <div key={l.name} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-sm" style={{ background: l.color }} />
                    <span className="text-slate-400 flex-1">{l.name}</span>
                    <span className="font-mono" style={{ color: l.color }}>
                      {l.value} ({((l.value / assets.length) * 100).toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* 右：台账表 */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-2 min-h-0">
          {/* 筛选 */}
          <div className="shrink-0 panel corner-frame px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="flex items-center gap-1">
              <span className="hud-label">类型</span>
              <FilterChip active={type === 'all'} onClick={() => { setType('all'); setPage(0) }}>全部</FilterChip>
              {TYPES.map((t) => (
                <FilterChip key={t} active={type === t} onClick={() => { setType(t); setPage(0) }}>
                  {t}
                  <span className="ml-1 opacity-60">{assets.filter((a) => a.type === t).length}</span>
                </FilterChip>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="hud-label">周期</span>
              <FilterChip active={lifecycle === 'all'} onClick={() => { setLifecycle('all'); setPage(0) }} color={COLORS.online}>全部</FilterChip>
              {LIFECYCLES.map((l) => (
                <FilterChip key={l} active={lifecycle === l} onClick={() => { setLifecycle(l); setPage(0) }} color={LIFECYCLE_COLOR[l]}>
                  {l}
                </FilterChip>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="搜索 ID / SN / 型号 / 机柜…"
              className="ml-auto bg-void-850 border border-cyber-500/20 rounded-sm px-2 py-1 text-[11px] text-slate-200 placeholder-slate-600 outline-none focus:border-cyber-400/60 w-52"
            />
          </div>

          <Panel
            title="资产台账"
            subtitle={`${filtered.length} 条记录`}
            className="flex-1 min-h-0"
            bodyClassName="p-0 overflow-hidden flex flex-col"
            actions={
              <div className="flex items-center gap-1">
                <button className="btn btn-ghost px-2" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>‹</button>
                <span className="text-[11px] font-mono text-slate-400 px-1">{safePage + 1}/{pageCount}</span>
                <button className="btn btn-ghost px-2" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>›</button>
              </div>
            }
          >
            {filtered.length === 0 ? (
              <EmptyState text="无匹配资产" />
            ) : (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-void-850/95 backdrop-blur z-10">
                    <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                      <Th onClick={() => toggleSort('id')} active={sortKey === 'id'} asc={sortAsc}>资产编号</Th>
                      <th className="px-2 py-1.5 font-medium">SN</th>
                      <Th onClick={() => toggleSort('type')} active={sortKey === 'type'} asc={sortAsc}>类型</Th>
                      <th className="px-2 py-1.5 font-medium">型号</th>
                      <th className="px-2 py-1.5 font-medium">机柜 / U位</th>
                      <Th onClick={() => toggleSort('onlineDate')} active={sortKey === 'onlineDate'} asc={sortAsc}>上架日期</Th>
                      <Th onClick={() => toggleSort('warrantyUntil')} active={sortKey === 'warrantyUntil'} asc={sortAsc}>保修至</Th>
                      <th className="px-2 py-1.5 font-medium">周期</th>
                      <th className="px-2 py-1.5 font-medium">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageAssets.map((a) => (
                      <tr key={a.id} className="table-row cursor-pointer" onClick={() => setSelected(a)}>
                        <td className="px-2 py-1.5 font-mono text-[11px] text-cyber-400">{a.id}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500">{a.sn}</td>
                        <td className="px-2 py-1.5 text-[11px] text-slate-300">{a.type}</td>
                        <td className="px-2 py-1.5 text-[11px] text-slate-400 truncate max-w-[160px]">{a.model}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500">{a.rackId} · {a.uPosition}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500">{a.onlineDate}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500">{a.warrantyUntil}</td>
                        <td className="px-2 py-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm border" style={{ color: LIFECYCLE_COLOR[a.lifecycle], borderColor: `${LIFECYCLE_COLOR[a.lifecycle]}55`, background: `${LIFECYCLE_COLOR[a.lifecycle]}14` }}>
                            {a.lifecycle}
                          </span>
                        </td>
                        <td className="px-2 py-1.5"><HealthBadge level={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {selected && <AssetDrawer asset={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function Th({ children, onClick, active, asc }: { children: React.ReactNode; onClick: () => void; active: boolean; asc: boolean }) {
  return (
    <th className="px-2 py-1.5 font-medium cursor-pointer hover:text-cyber-400 select-none" onClick={onClick}>
      {children}
      {active && <span className="ml-0.5 text-cyber-400">{asc ? '▲' : '▼'}</span>}
    </th>
  )
}

function AssetDrawer({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-[440px] max-w-full h-full bg-void-900 border-l border-cyber-500/30 shadow-panel overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-display text-lg text-white">{asset.id}</h2>
            <p className="text-[11px] text-slate-500 font-mono">{asset.sn}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost">✕ 关闭</button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <Cell label="资产类型" value={asset.type} />
          <Cell label="厂商" value={asset.vendor} />
          <Cell label="型号" value={asset.model} />
          <Cell label="所属业务" value={asset.business} />
          <Cell label="所在机房" value={`${asset.hall} 栋`} />
          <Cell label="机柜 / U位" value={`${asset.rackId} · ${asset.uPosition}`} mono />
          <Cell label="上架日期" value={asset.onlineDate} mono />
          <Cell label="保修截止" value={asset.warrantyUntil} mono />
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <div className="hud-label mb-1">生命周期</div>
            <span className="text-[13px] font-semibold px-2 py-1 rounded-sm border" style={{ color: LIFECYCLE_COLOR[asset.lifecycle], borderColor: `${LIFECYCLE_COLOR[asset.lifecycle]}55`, background: `${LIFECYCLE_COLOR[asset.lifecycle]}14` }}>
              {asset.lifecycle}
            </span>
          </div>
          <div className="flex-1">
            <div className="hud-label mb-1">运行状态</div>
            <HealthBadge level={asset.status} />
          </div>
        </div>

        <div className="panel-title text-[12px] mb-2">维修记录</div>
        {asset.repairCount === 0 ? (
          <p className="text-[11px] text-slate-500">暂无维修记录，设备运行良好。</p>
        ) : (
          <div className="space-y-1.5">
            {Array.from({ length: asset.repairCount }, (_, i) => (
              <div key={i} className="panel p-2 text-[11px] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-slate-400 flex-1">
                  {['更换 GPU 模组', '电源模块维修', '风扇更换', '内存条重插', '固件升级'][i % 5]}
                </span>
                <span className="font-mono text-slate-600 text-[10px]">
                  {new Date(new Date(asset.onlineDate).getTime() + (i + 1) * 90 * 86400000).toISOString().slice(0, 10)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Cell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-void-850/60 rounded-sm px-2 py-1.5 border border-cyber-500/10">
      <div className="text-[9px] text-slate-500">{label}</div>
      <div className={`text-[11px] text-slate-200 truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  )
}
