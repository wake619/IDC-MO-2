import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { useSimStore } from './stores/simStore'
import { ensureEchartsTheme } from './theme/echartsTheme'

import DashboardOverview from './pages/DashboardOverview'
import GpuCluster from './pages/GpuCluster'
import DataCenter3D from './pages/DataCenter3D'
import AlertCenter from './pages/AlertCenter'
import PerformanceAnalysis from './pages/PerformanceAnalysis'
import ComputeScheduling from './pages/ComputeScheduling'
import AiOps from './pages/AiOps'
import AssetCmdb from './pages/AssetCmdb'
import EnergyPue from './pages/EnergyPue'
import CapacityPlanning from './pages/CapacityPlanning'

export default function App() {
  const start = useSimStore((s) => s.start)
  const stop = useSimStore((s) => s.stop)

  useEffect(() => {
    ensureEchartsTheme()
    start()
    return () => stop()
  }, [start, stop])

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardOverview />} />
          <Route path="/gpu" element={<GpuCluster />} />
          <Route path="/dc3d" element={<DataCenter3D />} />
          <Route path="/alerts" element={<AlertCenter />} />
          <Route path="/performance" element={<PerformanceAnalysis />} />
          <Route path="/scheduling" element={<ComputeScheduling />} />
          <Route path="/aiops" element={<AiOps />} />
          <Route path="/cmdb" element={<AssetCmdb />} />
          <Route path="/energy" element={<EnergyPue />} />
          <Route path="/capacity" element={<CapacityPlanning />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
