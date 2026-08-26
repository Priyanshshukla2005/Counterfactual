'use client'

import React, { useMemo, useState } from 'react'
import type { Transaction, SettlementTimelinePoint } from '@/types'
import { formatCurrency, formatCompactCurrency } from '@/lib/api'
import {
  TrendingUp,
  BarChart2,
  Calendar,
  Layers,
  Sparkles,
  Filter,
} from 'lucide-react'

interface SettlementChartProps {
  transactions: Transaction[]
  expectedTotal: number
  actualTotal: number
  unreconciledAmount: number
}

export function SettlementChart({
  transactions,
  expectedTotal,
  actualTotal,
  unreconciledAmount,
}: SettlementChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'daily' | 'rail'>('daily')

  // Calculate real time-series aggregation from actual transaction data
  const timelineData: SettlementTimelinePoint[] = useMemo(() => {
    if (!transactions.length) return []

    const dateMap = new Map<string, { expected: number; actual: number; count: number }>()

    transactions.forEach((tx) => {
      const dateKey = tx.paymentDate || (tx.date && tx.date !== 'Today' ? tx.date : null)
      if (!dateKey) return

      const current = dateMap.get(dateKey) || { expected: 0, actual: 0, count: 0 }
      current.expected += tx.expectedAmount ?? 0
      current.actual += tx.actualAmount ?? 0
      current.count += 1
      dateMap.set(dateKey, current)
    })

    // Sort chronologically by date
    const sorted = Array.from(dateMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))

    return sorted.map(([date, values]) => {
      const parsed = new Date(date)
      const label = isNaN(parsed.getTime())
        ? date
        : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      return {
        date,
        label,
        expected: Math.round(values.expected * 100) / 100,
        actual: Math.round(values.actual * 100) / 100,
        variance: Math.round(Math.abs(values.expected - values.actual) * 100) / 100,
        count: values.count,
      }
    })
  }, [transactions])

  // Real Rail aggregation from actual transaction records
  const railData = useMemo(() => {
    const railMap = new Map<string, { expected: number; actual: number; count: number }>()
    transactions.forEach((tx) => {
      const rail = tx.rail || 'CARD'
      const current = railMap.get(rail) || { expected: 0, actual: 0, count: 0 }
      current.expected += tx.expectedAmount ?? 0
      current.actual += tx.actualAmount ?? 0
      current.count += 1
      railMap.set(rail, current)
    })
    return Array.from(railMap.entries()).map(([rail, v]) => ({
      rail,
      expected: Math.round(v.expected * 100) / 100,
      actual: Math.round(v.actual * 100) / 100,
      variance: Math.round(Math.abs(v.expected - v.actual) * 100) / 100,
      count: v.count,
    }))
  }, [transactions])

  // SVG Chart dimensions
  const width = 640
  const height = 220
  const padding = { top: 25, right: 25, bottom: 35, left: 55 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const maxVal = useMemo(() => {
    if (!timelineData.length) return 1000
    const max = Math.max(...timelineData.map((d) => Math.max(d.expected, d.actual)))
    return max > 0 ? max * 1.15 : 1000
  }, [timelineData])

  const getX = (index: number) => {
    if (timelineData.length <= 1) return padding.left + chartWidth / 2
    return padding.left + (index / (timelineData.length - 1)) * chartWidth
  }

  const getY = (value: number) => {
    return padding.top + chartHeight - (value / maxVal) * chartHeight
  }

  // Generate SVG path for Expected line
  const expectedPath = useMemo(() => {
    if (!timelineData.length) return ''
    return timelineData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.expected)}`)
      .join(' ')
  }, [timelineData, maxVal])

  // Generate SVG path for Actual line
  const actualPath = useMemo(() => {
    if (!timelineData.length) return ''
    return timelineData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.actual)}`)
      .join(' ')
  }, [timelineData, maxVal])

  // Generate Area Fill for expected
  const expectedArea = useMemo(() => {
    if (!timelineData.length) return ''
    const firstX = getX(0)
    const lastX = getX(timelineData.length - 1)
    const bottomY = padding.top + chartHeight
    return `${expectedPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`
  }, [expectedPath, timelineData])

  const hoveredPoint = hoveredIndex !== null ? timelineData[hoveredIndex] : null

  return (
    <div className="card-panel h-full flex flex-col justify-between">
      <div className="card-panel-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Settlement Telemetry</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          </div>
          <h2 className="card-panel-title text-base font-bold">Settlement Performance Dynamics</h2>
          <p className="card-panel-subtitle">
            Expected receivable vs actual bank credit across batch cycles
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-0.5 bg-slate-900/90 rounded-lg text-xs font-medium border border-slate-800">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-2.5 py-1 rounded-md transition ${
                viewMode === 'daily'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Timeline View
            </button>
            <button
              onClick={() => setViewMode('rail')}
              className={`px-2.5 py-1 rounded-md transition ${
                viewMode === 'rail'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Rail Matrix
            </button>
          </div>
        </div>
      </div>

      <div className="card-panel-body flex-1 flex flex-col justify-between gap-4">
        {viewMode === 'daily' ? (
          <>
            {/* Legend & Hover Info */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800/80 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-indigo-400 rounded-full" />
                  <span className="text-slate-400">Expected Settlement</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-emerald-400 rounded-full" />
                  <span className="text-slate-400">Actual Bank Credit</span>
                </div>
              </div>

              {hoveredPoint ? (
                <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 px-3 py-1 rounded-lg text-xs">
                  <span className="font-bold text-white">{hoveredPoint.label}:</span>
                  <span className="text-indigo-300">Exp: {formatCurrency(hoveredPoint.expected)}</span>
                  <span className="text-emerald-400">Act: {formatCurrency(hoveredPoint.actual)}</span>
                  {hoveredPoint.variance > 0 && (
                    <span className="text-rose-400 font-bold">
                      Δ -{formatCurrency(hoveredPoint.variance)}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-500 text-[11px] font-medium hidden sm:inline">
                  Hover points on chart for granular audit details
                </span>
              )}
            </div>

            {/* SVG Interactive Chart */}
            <div className="relative w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto overflow-visible select-none"
              >
                <defs>
                  {/* Glowing 3D Area Gradient */}
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
                    <stop offset="70%" stopColor="#6366f1" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                  </linearGradient>

                  <linearGradient id="lineGradExpected" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>

                  <linearGradient id="lineGradActual" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = padding.top + chartHeight * (1 - ratio)
                  const val = maxVal * ratio
                  return (
                    <g key={ratio}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={width - padding.right}
                        y2={y}
                        stroke="rgba(255, 255, 255, 0.06)"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padding.left - 8}
                        y={y + 3}
                        textAnchor="end"
                        fill="#64748b"
                        fontSize="9"
                        fontWeight="600"
                      >
                        {formatCompactCurrency(val)}
                      </text>
                    </g>
                  )
                })}

                {/* Area Fill */}
                <path d={expectedArea} fill="url(#areaGradient)" />

                {/* Expected Line */}
                <path
                  d={expectedPath}
                  fill="none"
                  stroke="url(#lineGradExpected)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Actual Line */}
                <path
                  d={actualPath}
                  fill="none"
                  stroke="url(#lineGradActual)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="4 2"
                />

                {/* Data Points and Hover Target Hitboxes */}
                {timelineData.map((d, idx) => {
                  const cx = getX(idx)
                  const cyExpected = getY(d.expected)
                  const cyActual = getY(d.actual)
                  const isHovered = hoveredIndex === idx

                  return (
                    <g
                      key={d.date}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className="cursor-pointer"
                    >
                      {/* Vertical crosshair line on hover */}
                      {isHovered && (
                        <line
                          x1={cx}
                          y1={padding.top}
                          x2={cx}
                          y2={padding.top + chartHeight}
                          stroke="rgba(99, 102, 241, 0.6)"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                        />
                      )}

                      {/* Expected Dot */}
                      <circle
                        cx={cx}
                        cy={cyExpected}
                        r={isHovered ? 5 : 3.5}
                        fill="#818cf8"
                        stroke="#0f172a"
                        strokeWidth="2"
                        className="transition-all duration-150"
                      />

                      {/* Actual Dot */}
                      <circle
                        cx={cx}
                        cy={cyActual}
                        r={isHovered ? 5 : 3}
                        fill="#34d399"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        className="transition-all duration-150"
                      />

                      {/* X-axis Labels */}
                      <text
                        x={cx}
                        y={height - 12}
                        textAnchor="middle"
                        fill={isHovered ? '#ffffff' : '#64748b'}
                        fontSize="9"
                        fontWeight={isHovered ? '700' : '500'}
                      >
                        {d.label}
                      </text>

                      {/* Invisible Large Hitbox for ease of hover */}
                      <rect
                        x={cx - chartWidth / (timelineData.length * 2)}
                        y={padding.top}
                        width={chartWidth / timelineData.length}
                        height={chartHeight}
                        fill="transparent"
                      />
                    </g>
                  )
                })}
              </svg>
            </div>
          </>
        ) : (
          /* Rail Breakdown Matrix View */
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {railData.map((item) => (
                <div
                  key={item.rail}
                  className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="fintech-badge badge-rail">{item.rail}</span>
                    <span className="text-xs font-bold text-slate-400">
                      {item.count} Transactions
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Expected Payout</span>
                      <strong className="text-white tabular-nums">
                        {formatCurrency(item.expected)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Actual Settled</span>
                      <strong className="text-emerald-400 tabular-nums">
                        {formatCurrency(item.actual)}
                      </strong>
                    </div>
                  </div>

                  {item.variance > 0 && (
                    <div className="text-[11px] text-rose-400 font-semibold pt-1 border-t border-slate-800 flex justify-between">
                      <span>Variance Exposure:</span>
                      <span className="tabular-nums">-{formatCurrency(item.variance)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Summary Bar */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80 text-xs text-center">
          <div className="p-2 bg-slate-900/60 rounded-lg">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Expected Total</span>
            <strong className="text-indigo-300 font-bold tabular-nums">
              {formatCurrency(expectedTotal)}
            </strong>
          </div>

          <div className="p-2 bg-slate-900/60 rounded-lg">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Actual Settled</span>
            <strong className="text-emerald-400 font-bold tabular-nums">
              {formatCurrency(actualTotal)}
            </strong>
          </div>

          <div className="p-2 bg-slate-900/60 rounded-lg">
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Net Discrepancy</span>
            <strong className="text-rose-400 font-bold tabular-nums">
              {formatCurrency(unreconciledAmount)}
            </strong>
          </div>
        </div>
      </div>
    </div>
  )
}
