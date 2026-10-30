import { useMemo, useRef } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Grid, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Rack, ViewMode, GpuNode } from '../../types'
import {
  RACK_D,
  RACK_H,
  RACK_W,
  rackWorldPosition,
} from '../../mock/generators'
import { tempToColor, utilToColor, HEALTH_COLOR } from '../../theme/colors'

// ============================================================
// 3D 机房透视场景（可复用：整页 / 总览缩略图）
// ============================================================

interface RackStat {
  util: number
  temp: number
  level: Rack['level']
  critical: number
}

function computeRackStats(racks: Rack[], nodes: GpuNode[]): Record<string, RackStat> {
  const acc: Record<string, { util: number; temp: number; n: number; critical: number }> = {}
  for (const n of nodes) {
    const key = `${n.hall}-R${String(n.row).padStart(2, '0')}-C${String(n.rack).padStart(2, '0')}`
    if (!acc[key]) acc[key] = { util: 0, temp: 0, n: 0, critical: 0 }
    acc[key].util += n.util
    acc[key].temp += n.temp
    acc[key].n++
    if (n.status === 'critical') acc[key].critical++
  }
  const out: Record<string, RackStat> = {}
  for (const r of racks) {
    const a = acc[r.id]
    out[r.id] = a
      ? {
          util: a.util / a.n,
          temp: a.temp / a.n,
          level: a.critical > 0 ? 'critical' : r.level,
          critical: a.critical,
        }
      : { util: 0, temp: 25, level: 'normal', critical: 0 }
  }
  return out
}

function rackColor(stat: RackStat, mode: ViewMode): string {
  switch (mode) {
    case 'temperature':
      return tempToColor(stat.temp)
    case 'load':
      return utilToColor(stat.util)
    case 'alert':
      return stat.critical > 0 ? '#f43f5e' : stat.level === 'warning' ? '#f59e0b' : '#0e7490'
    case 'topology':
      return '#0891b2'
  }
}

/** 单个机柜 mesh（自发光 + 负载灯带 + 告警脉冲） */
function RackMesh({
  rack,
  stat,
  mode,
  selected,
  onSelect,
}: {
  rack: Rack
  stat: RackStat
  mode: ViewMode
  selected: boolean
  onSelect: (id: string) => void
}) {
  const { x, z } = rackWorldPosition(rack)
  const color = rackColor(stat, mode)
  const emissiveRef = useRef<THREE.MeshStandardMaterial>(null)
  const stripRef = useRef<THREE.MeshBasicMaterial>(null)
  const pulse = stat.critical > 0 || selected

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (emissiveRef.current) {
      const base = mode === 'topology' ? 0.5 : 0.35 + (stat.util / 100) * 0.9
      emissiveRef.current.emissiveIntensity = pulse
        ? base + Math.sin(t * 6) * 0.6 + 0.6
        : base
    }
    if (stripRef.current) {
      stripRef.current.opacity = 0.5 + (stat.util / 100) * 0.5
    }
  })

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect(rack.id)
  }

  return (
    <group position={[x, 0, z]} onClick={handleClick}>
      {/* 机柜主体 */}
      <mesh position={[0, RACK_H / 2, 0]}>
        <boxGeometry args={[RACK_W, RACK_H, RACK_D]} />
        <meshStandardMaterial
          ref={emissiveRef}
          color="#0a1424"
          emissive={color}
          emissiveIntensity={0.5}
          metalness={0.6}
          roughness={0.35}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* 顶部发光灯条（负载指示） */}
      <mesh position={[0, RACK_H + 0.06, 0]}>
        <boxGeometry args={[RACK_W * 0.9, 0.08, RACK_D * 0.9]} />
        <meshBasicMaterial ref={stripRef} color={color} transparent opacity={0.8} />
      </mesh>
      {/* 正面 GPU 节点灯带 */}
      <mesh position={[0, RACK_H / 2, RACK_D / 2 + 0.01]}>
        <planeGeometry args={[RACK_W * 0.7, RACK_H * 0.82]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* 选中/告警描边框 */}
      {selected && (
        <lineSegments position={[0, RACK_H / 2, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(RACK_W + 0.1, RACK_H + 0.1, RACK_D + 0.1)]} />
          <lineBasicMaterial color="#67e8f9" transparent opacity={0.9} />
        </lineSegments>
      )}
      {/* 告警脉冲球 */}
      {stat.critical > 0 && (
        <mesh position={[0, RACK_H + 0.5, 0]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshBasicMaterial color={HEALTH_COLOR.critical} transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  )
}

/** 相机巡检巡游 */
function TourRig({ active }: { active: boolean }) {
  useFrame(({ camera, clock }) => {
    if (!active) return
    const t = clock.getElapsedTime() * 0.15
    const r = 34
    camera.position.x = Math.cos(t) * r
    camera.position.z = Math.sin(t) * r
    camera.position.y = 16 + Math.sin(t * 0.8) * 6
    camera.lookAt(0, 2, 0)
  })
  return null
}

/** InfiniBand 骨干拓扑连线（topology 模式显示） */
function TopologyLinks({ racks }: { racks: Rack[] }) {
  const lines = useMemo(() => {
    const segs: Array<[number, number, number][]> = []
    // 每排机柜顶部串联到排汇聚点，再连到机房核心
    const halls = ['A', 'B']
    const coreY = 6
    halls.forEach((h) => {
      const hallRacks = racks.filter((r) => r.hall === h)
      const corePos: [number, number, number] = [
        h === 'A' ? -14 : 14,
        coreY + 3,
        0,
      ]
      for (let row = 1; row <= 8; row++) {
        const rowRacks = hallRacks.filter((r) => r.row === row)
        if (!rowRacks.length) continue
        const pts = rowRacks.map((r) => {
          const p = rackWorldPosition(r)
          return [p.x, RACK_H + 0.4, p.z] as [number, number, number]
        })
        // 排内串联
        segs.push(pts)
        // 排汇聚点 → 机房核心
        const mid = pts[Math.floor(pts.length / 2)]
        segs.push([mid, corePos])
      }
    })
    return segs
  }, [racks])

  return (
    <group>
      {lines.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color="#22d3ee"
          lineWidth={1}
          transparent
          opacity={0.4}
          dashed={false}
        />
      ))}
    </group>
  )
}

interface SceneProps {
  racks: Rack[]
  nodes: GpuNode[]
  viewMode: ViewMode
  selectedRackId: string | null
  onSelectRack: (id: string | null) => void
  tourActive: boolean
  /** 紧凑模式（缩略图）：更小画布、自动旋转、无网格文字 */
  compact?: boolean
}

export default function DataCenterScene({
  racks,
  nodes,
  viewMode,
  selectedRackId,
  onSelectRack,
  tourActive,
  compact = false,
}: SceneProps) {
  const stats = useMemo(() => computeRackStats(racks, nodes), [racks, nodes])
  const selectedRack = racks.find((r) => r.id === selectedRackId) ?? null

  return (
    <Canvas
      dpr={compact ? 1 : [1, 1.8]}
      camera={{ position: compact ? [26, 20, 26] : [30, 22, 34], fov: compact ? 42 : 46, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => onSelectRack(null)}
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #071a2e 0%, #03070f 70%)' }}
    >
      <fog attach="fog" args={['#03070f', 45, 130]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[20, 40, 20]} intensity={0.5} color="#7dd3fc" />
      <pointLight position={[0, 20, 0]} intensity={0.6} color="#22d3ee" distance={80} />

      {/* 地面网格 */}
      <Grid
        position={[0, -0.01, 0]}
        args={[140, 140]}
        cellSize={2}
        cellThickness={0.4}
        cellColor="#0e2a44"
        sectionSize={10}
        sectionThickness={0.9}
        sectionColor="#155e75"
        fadeDistance={compact ? 70 : 120}
        fadeStrength={1.2}
        infiniteGrid
      />

      {/* 冷热通道色带 */}
      <AisleBands compact={compact} />

      {/* 机柜阵列 */}
      <group>
        {racks.map((r) => (
          <RackMesh
            key={r.id}
            rack={r}
            stat={stats[r.id]}
            mode={viewMode}
            selected={selectedRackId === r.id}
            onSelect={onSelectRack}
          />
        ))}
      </group>

      {/* 机房标识 */}
      {!compact && (
        <>
          <Html position={[-14, 8, 0]} center distanceFactor={40} style={{ pointerEvents: 'none' }}>
            <div className="font-display text-cyan-300/80 text-sm tracking-[0.3em] whitespace-nowrap">
              A 栋机房
            </div>
          </Html>
          <Html position={[14, 8, 0]} center distanceFactor={40} style={{ pointerEvents: 'none' }}>
            <div className="font-display text-cyan-300/80 text-sm tracking-[0.3em] whitespace-nowrap">
              B 栋机房
            </div>
          </Html>
        </>
      )}

      {/* 拓扑连线 */}
      {viewMode === 'topology' && <TopologyLinks racks={racks} />}

      {/* 选中机柜信息浮层 */}
      {selectedRack && !compact && (
        <Html
          position={[
            rackWorldPosition(selectedRack).x,
            RACK_H + 1.2,
            rackWorldPosition(selectedRack).z,
          ]}
          center
          distanceFactor={26}
        >
          <RackPopup
            rack={selectedRack}
            stat={stats[selectedRack.id]}
            onClose={() => onSelectRack(null)}
          />
        </Html>
      )}

      <TourRig active={tourActive} />
      <OrbitControls
        enablePan={!compact}
        autoRotate={compact && !tourActive}
        autoRotateSpeed={0.6}
        enabled={!tourActive}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={10}
        maxDistance={compact ? 60 : 90}
        target={[0, 2, 0]}
      />
    </Canvas>
  )
}

/** 冷热通道地面色带 */
function AisleBands({ compact }: { compact: boolean }) {
  const bands = useMemo(() => {
    const arr: Array<{ z: number; cold: boolean }> = []
    for (let row = 1; row <= 8; row++) {
      const z = (row - 4.5) * (RACK_D + 3.2)
      arr.push({ z, cold: row % 2 === 0 })
    }
    return arr
  }, [])
  return (
    <group>
      {bands.map((b, i) => (
        <mesh key={i} position={[0, 0.005, b.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[compact ? 60 : 62, 1.1]} />
          <meshBasicMaterial
            color={b.cold ? '#0891b2' : '#7c2d12'}
            transparent
            opacity={b.cold ? 0.16 : 0.12}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  )
}

/** 机柜信息浮层 */
function RackPopup({
  rack,
  stat,
  onClose,
}: {
  rack: Rack
  stat: RackStat
  onClose: () => void
}) {
  return (
    <div className="w-52 panel corner-frame p-2.5 text-left pointer-events-auto">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-display text-cyan-300 text-xs tracking-wider">{rack.id}</span>
        <button onClick={onClose} className="text-slate-500 hover:text-alarm-400 text-xs leading-none">
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <Info label="平均利用率" value={`${stat.util.toFixed(1)}%`} color="#22d3ee" />
        <Info label="平均温度" value={`${stat.temp.toFixed(1)}°C`} color={tempToColor(stat.temp)} />
        <Info label="机柜功耗" value={`${rack.power.toFixed(1)}kW`} color="#a78bfa" />
        <Info label="节点数" value={`${rack.nodeCount}`} color="#34d399" />
        <Info label="冷通道" value={`${rack.inletTemp.toFixed(1)}°C`} color="#38bdf8" />
        <Info label="热通道" value={`${rack.outletTemp.toFixed(1)}°C`} color="#fb923c" />
      </div>
      {stat.critical > 0 && (
        <div className="mt-1.5 text-[10px] text-alarm-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-alarm-500 animate-pulseGlow" />
          {stat.critical} 个节点严重告警
        </div>
      )}
    </div>
  )
}

function Info({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-void-850/80 rounded-sm px-1.5 py-1 border border-cyber-500/10">
      <div className="text-slate-500 text-[9px]">{label}</div>
      <div className="font-mono font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  )
}
