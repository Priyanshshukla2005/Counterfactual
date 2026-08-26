'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { formatCurrency } from '@/lib/api'
import { Sparkles, ArrowRight, Layers, Maximize2 } from 'lucide-react'

interface CounterfactualSceneProps {
  grossAmount: number
  currentSettlement: number
  counterfactualSettlement: number
  merchantDelta: number
  activeScenario?: 'current' | 'counterfactual' | string
  onSelectScenario?: (sc: 'current' | 'counterfactual') => void
  className?: string
}

export function CounterfactualScene({
  grossAmount,
  currentSettlement,
  counterfactualSettlement,
  merchantDelta,
  activeScenario = 'counterfactual',
  onSelectScenario,
  className = '',
}: CounterfactualSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [hasWebGL, setHasWebGL] = useState<boolean>(true)
  const [isHovered, setIsHovered] = useState<boolean>(false)
  const [isVisible, setIsVisible] = useState<boolean>(true)

  // Check WebGL availability
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas')
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      if (!gl) setHasWebGL(false)
    } catch {
      setHasWebGL(false)
    }
  }, [])

  // Visibility observer: pause 3D animation loop when off-screen for performance
  useEffect(() => {
    if (!mountRef.current) return
    const el = mountRef.current

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Three.js 3D Interactive Flow Visualizer
  useEffect(() => {
    if (!hasWebGL || !mountRef.current) return

    const container = mountRef.current
    const width = container.clientWidth || 640
    const height = container.clientHeight || 320

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(0, 0, 14)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.replaceChildren(renderer.domElement)

    // 2. Lighting (Fintech subtle ambiance)
    const ambientLight = new THREE.AmbientLight(0x818cf8, 0.9)
    scene.add(ambientLight)

    const pointLight = new THREE.PointLight(0x38bdf8, 2, 50)
    pointLight.position.set(2, 4, 8)
    scene.add(pointLight)

    const fillLight = new THREE.DirectionalLight(0x6366f1, 1.2)
    fillLight.position.set(-5, -3, 6)
    scene.add(fillLight)

    // 3. Node Coordinates (Isometric Flow)
    const nodes = {
      payment: new THREE.Vector3(-4.8, 0, 0),
      gateway: new THREE.Vector3(-1.6, 0, 0),
      settlement: new THREE.Vector3(1.2, 0, 0),
      branchCurrent: new THREE.Vector3(4.8, 1.6, 0),
      branchCounterfactual: new THREE.Vector3(4.8, -1.6, 0),
    }

    // 4. Create Node Meshes
    const nodeGroup = new THREE.Group()

    const createNodeMesh = (pos: THREE.Vector3, color: number, size = 0.35) => {
      const geom = new THREE.SphereGeometry(size, 32, 32)
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.8,
      })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.copy(pos)

      // Soft glow ring
      const ringGeom = new THREE.RingGeometry(size * 1.3, size * 1.6, 32)
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(ringGeom, ringMat)
      mesh.add(ring)

      return mesh
    }

    const paymentNode = createNodeMesh(nodes.payment, 0x6366f1, 0.4) // Indigo
    const gatewayNode = createNodeMesh(nodes.gateway, 0x38bdf8, 0.35) // Cyan
    const settlementNode = createNodeMesh(nodes.settlement, 0xa855f7, 0.38) // Purple
    const currentBranchNode = createNodeMesh(nodes.branchCurrent, 0x64748b, 0.32) // Slate
    const cfBranchNode = createNodeMesh(nodes.branchCounterfactual, 0x10b981, 0.42) // Emerald

    nodeGroup.add(paymentNode, gatewayNode, settlementNode, currentBranchNode, cfBranchNode)
    scene.add(nodeGroup)

    // 5. Connecting Spline Flow Paths
    const createPathCurve = (v1: THREE.Vector3, v2: THREE.Vector3, ctrlY?: number) => {
      const mid = new THREE.Vector3((v1.x + v2.x) / 2, ctrlY ?? (v1.y + v2.y) / 2, 0)
      return new THREE.QuadraticBezierCurve3(v1, mid, v2)
    }

    const curves = {
      path1: createPathCurve(nodes.payment, nodes.gateway),
      path2: createPathCurve(nodes.gateway, nodes.settlement),
      pathCurrent: createPathCurve(nodes.settlement, nodes.branchCurrent, 1.2),
      pathCounterfactual: createPathCurve(nodes.settlement, nodes.branchCounterfactual, -1.2),
    }

    // Render tube lines
    const lineGroup = new THREE.Group()

    const makeTube = (curve: THREE.Curve<THREE.Vector3>, color: number, opacity = 0.6) => {
      const geom = new THREE.TubeGeometry(curve, 32, 0.04, 8, false)
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity,
        roughness: 0.3,
      })
      return new THREE.Mesh(geom, mat)
    }

    const isCF = activeScenario !== 'current'
    const tube1 = makeTube(curves.path1, 0x6366f1, 0.7)
    const tube2 = makeTube(curves.path2, 0x38bdf8, 0.7)
    const tubeCurrent = makeTube(curves.pathCurrent, isCF ? 0x475569 : 0x6366f1, isCF ? 0.35 : 0.9)
    const tubeCF = makeTube(curves.pathCounterfactual, isCF ? 0x10b981 : 0x475569, isCF ? 0.95 : 0.35)

    lineGroup.add(tube1, tube2, tubeCurrent, tubeCF)
    scene.add(lineGroup)

    // 6. Flowing Energy Pulse Particles
    const particleGeom = new THREE.SphereGeometry(0.08, 16, 16)
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const particle = new THREE.Mesh(particleGeom, particleMat)
    scene.add(particle)

    let progress = 0
    let mouseX = 0
    let mouseY = 0
    let targetCameraX = 0
    let targetCameraY = 0

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseX = ((e.clientX - rect.left) / width) * 2 - 1
      mouseY = -(((e.clientY - rect.top) / height) * 2 - 1)
      targetCameraX = mouseX * 0.8
      targetCameraY = mouseY * 0.5
    }

    container.addEventListener('mousemove', handleMouseMove)

    // 7. Animation Loop with Visibility Guard
    let animId: number
    const animate = () => {
      if (isVisible) {
        // Smooth camera parallax
        camera.position.x += (targetCameraX - camera.position.x) * 0.05
        camera.position.y += (targetCameraY - camera.position.y) * 0.05
        camera.lookAt(0, 0, 0)

        // Particle pulse movement along active branch
        progress = (progress + 0.008) % 1
        let pt: THREE.Vector3

        if (progress < 0.33) {
          pt = curves.path1.getPoint(progress * 3)
        } else if (progress < 0.66) {
          pt = curves.path2.getPoint((progress - 0.33) * 3)
        } else {
          const subP = (progress - 0.66) * 3
          pt = isCF
            ? curves.pathCounterfactual.getPoint(subP)
            : curves.pathCurrent.getPoint(subP)
        }
        particle.position.copy(pt)

        // Gentle floating nodes
        const time = Date.now() * 0.0015
        nodeGroup.rotation.z = Math.sin(time * 0.5) * 0.02

        renderer.render(scene, camera)
      }
      animId = requestAnimationFrame(animate)
    }

    animate()

    // 8. Responsive Resize
    const handleResize = () => {
      if (!container) return
      const nw = container.clientWidth
      const nh = container.clientHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      cancelAnimationFrame(animId)
      container.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      scene.clear()
    }
  }, [hasWebGL, activeScenario, grossAmount, counterfactualSettlement, isVisible])

  const isMerchantGain = merchantDelta > 0

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-800/80 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white shadow-xl ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top Header Overlay */}
      <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
            3D Financial Decision Architecture
          </span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => onSelectScenario && onSelectScenario('current')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer ${
              activeScenario === 'current'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            Baseline Flow
          </button>
          <button
            onClick={() => onSelectScenario && onSelectScenario('counterfactual')}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
              activeScenario !== 'current'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles size={11} />
            <span>Counterfactual Branch</span>
          </button>
        </div>
      </div>

      {/* 3D Canvas Mount */}
      {hasWebGL ? (
        <div
          ref={mountRef}
          className="w-full h-72 sm:h-80 md:h-88 cursor-grab active:cursor-grabbing"
          title="Interactive 3D Flow: Move mouse to tilt isometric view"
        />
      ) : (
        /* High-Quality 2D SVG Fallback */
        <div className="w-full h-72 sm:h-80 flex items-center justify-center p-6">
          <svg className="w-full h-full max-w-lg" viewBox="0 0 500 240">
            <defs>
              <linearGradient id="gradFlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <path
              d="M 50 120 L 170 120 L 290 120 C 350 120, 370 60, 450 60"
              fill="none"
              stroke="#475569"
              strokeWidth="3"
            />
            <path
              d="M 50 120 L 170 120 L 290 120 C 350 120, 370 180, 450 180"
              fill="none"
              stroke="url(#gradFlow)"
              strokeWidth="4"
            />
            <circle cx="50" cy="120" r="10" fill="#6366f1" />
            <circle cx="170" cy="120" r="8" fill="#38bdf8" />
            <circle cx="290" cy="120" r="10" fill="#a855f7" />
            <circle cx="450" cy="60" r="8" fill="#64748b" />
            <circle cx="450" cy="180" r="12" fill="#10b981" />
          </svg>
        </div>
      )}

      {/* Floating Node Metric Callouts */}
      <div className="absolute bottom-3 left-4 right-4 z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pointer-events-none">
        <div className="p-2 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg">
          <div className="text-[10px] text-slate-400 uppercase font-medium">1. Order Gross</div>
          <div className="font-bold text-white tabular-nums">{formatCurrency(grossAmount)}</div>
        </div>

        <div className="p-2 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg">
          <div className="text-[10px] text-slate-400 uppercase font-medium">2. Gateway Deductions</div>
          <div className="font-bold text-sky-400">Fees + GST</div>
        </div>

        <div
          className={`p-2 backdrop-blur rounded-lg border transition ${
            activeScenario === 'current'
              ? 'bg-indigo-950/90 border-indigo-500/80 text-white'
              : 'bg-slate-900/70 border-slate-800/80 text-slate-400'
          }`}
        >
          <div className="text-[10px] uppercase font-medium">3A. Baseline Payout</div>
          <div className="font-bold tabular-nums">{formatCurrency(currentSettlement)}</div>
        </div>

        <div
          className={`p-2 backdrop-blur rounded-lg border transition ${
            activeScenario !== 'current'
              ? 'bg-emerald-950/90 border-emerald-500/80 text-white'
              : 'bg-slate-900/70 border-slate-800/80 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-medium text-emerald-300">3B. Counterfactual</span>
            <span
              className={`text-[10px] font-bold px-1 rounded ${
                isMerchantGain ? 'bg-emerald-500/30 text-emerald-200' : 'bg-rose-500/30 text-rose-200'
              }`}
            >
              {isMerchantGain ? `+${formatCurrency(merchantDelta)}` : formatCurrency(merchantDelta)}
            </span>
          </div>
          <div className="font-bold text-emerald-400 tabular-nums">
            {formatCurrency(counterfactualSettlement)}
          </div>
        </div>
      </div>
    </div>
  )
}
