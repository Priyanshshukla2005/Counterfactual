'use client'

import React, { useMemo, useState } from 'react'
import type { Transaction, SettlementTimelinePoint } from '@/types'
import { formatCurrency, formatCompactCurrency } from '@/lib/api'

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
  const height = 200
  const padding = { top: 20, right: 20, bottom: 30, left: 45 }
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
    <div className="card-panel">
      <div className="card-panel-header">
        <div>
          <h2 className="card-panel-title">Settlement Performance</h2>
          <p className="card-panel-subtitle">
            Expected vs actual settlement aggregated by transaction date
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-0.5 bg-slate-100 rounded-md text-xs font-medium border border-slate-200">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-2.5 py-1 rounded transition ${
                viewMode === 'daily'
                  ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Date ({timelineData.length} Days)
            </button>
            <button
              onClick={() => setViewMode('rail')}
              className={`px-2.5 py-1 rounded transition ${
                viewMode === 'rail'
                  ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              By Rail
            </button>
          </div>
        </div>
      </div>

      <div className="card-panel-body">
        {/* Metric summary banner */}
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 pb-4 mb-4 border-b border-slate-100">
          <div>
            <span className="text-xs text-slate-500 block">Expected Total</span>
            <strong className="text-xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(expectedTotal)}
            </strong>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Actual Total</span>
            <strong className="text-xl font-bold text-indigo-600 tabular-nums">
              {formatCurrency(actualTotal)}
            </strong>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Net Discrepancy</span>
            <strong className="text-xl font-bold text-rose-600 tabular-nums">
              {formatCurrency(unreconciledAmount)}
            </strong>
          </div>

          {/* Legend */}
          <div className="ml-auto flex items-center gap-4 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-indigo-600 rounded-full" />
              <span>Actual Settlement</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-slate-400 rounded-full border-dashed" />
              <span>Expected Settlement</span>
            </div>
          </div>
        </div>

        {viewMode === 'daily' ? (
          <div className="relative w-full overflow-hidden">
            {/* SVG Visualizer */}
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto overflow-visible select-none"
              style={{ minHeight: '190px' }}
            >
              <defs>
                <linearGradient id="settlementGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
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
                      stroke="#f1f5f9"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding.left - 6}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="9.5"
                      fill="#94a3b8"
                      fontFamily="sans-serif"
                    >
                      {formatCompactCurrency(val)}
                    </text>
                  </g>
                )
              })}

              {/* Area Fill */}
              {expectedArea && (
                <path d={expectedArea} fill="url(#settlementGrad)" />
              )}

              {/* Baseline Expected line */}
              {expectedPath && (
                <path
                  d={expectedPath}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                  strokeLinecap="round"
                />
              )}

              {/* Actual Settled line */}
              {actualPath && (
                <path
                  d={actualPath}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Interactive Data points */}
              {timelineData.map((d, i) => {
                const x = getX(i)
                const yActual = getY(d.actual)
                const isHovered = hoveredIndex === i

                return (
                  <g
                    key={d.date}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="cursor-pointer"
                  >
                    {/* Hover vertical line */}
                    {isHovered && (
                      <line
                        x1={x}
                        y1={padding.top}
                        x2={x}
                        y2={padding.top + chartHeight}
                        stroke="#6366f1"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Point on actual line */}
                    <circle
                      cx={x}
                      cy={yActual}
                      r={isHovered ? 5 : 3.5}
                      fill="#ffffff"
                      stroke="#4f46e5"
                      strokeWidth={isHovered ? 2.5 : 2}
                    />

                    {/* Invisible hit area */}
                    <rect
                      x={x - 15}
                      y={padding.top}
                      width={30}
                      height={chartHeight}
                      fill="transparent"
                    />

                    {/* X-axis date labels */}
                    {(i === 0 ||
                      i === timelineData.length - 1 ||
                      i % Math.ceil(timelineData.length / 5) === 0) && (
                      <text
                        x={x}
                        y={height - 8}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#64748b"
                        fontWeight={isHovered ? '600' : '400'}
                      >
                        {d.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredPoint && hoveredIndex !== null && (
              <div
                className="absolute pointer-events-none bg-slate-900 text-white rounded-md p-3 shadow-xl text-xs z-20 border border-slate-700 transition-all"
                style={{
                  left: `${Math.min(
                    85,
                    Math.max(15, (getX(hoveredIndex) / width) * 100)
                  )}%`,
                  top: '10px',
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="font-semibold text-slate-200 border-b border-slate-700 pb-1.5 mb-1.5 flex items-center justify-between gap-3">
                  <span>Date: {hoveredPoint.label}</span>
                  <span className="text-[10px] text-slate-400">
                    {hoveredPoint.count} records
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Actual Settlement:</span>
                    <span className="font-bold text-emerald-400 tabular-nums">
                      {formatCurrency(hoveredPoint.actual)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-400">Expected Settlement:</span>
                    <span className="font-bold text-slate-300 tabular-nums">
                      {formatCurrency(hoveredPoint.expected)}
                    </span>
                  </div>
                  {hoveredPoint.variance > 0 && (
                    <div className="flex justify-between gap-4 pt-1 border-t border-slate-800 text-rose-400">
                      <span>Discrepancy:</span>
                      <span className="font-bold tabular-nums">
                        {formatCurrency(hoveredPoint.variance)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Rail Breakdown View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-2">
            {railData.map((item) => (
              <div
                key={item.rail}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="fintech-badge badge-rail">{item.rail}</span>
                  <span className="text-[11px] text-slate-500">{item.count} records</span>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Actual Settlement</div>
                  <div className="text-base font-bold text-slate-900 tabular-nums">
                    {formatCurrency(item.actual)}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-slate-500 pt-1 border-t border-slate-200">
                  <span>Variance:</span>
                  <span
                    className={
                      item.variance > 0
                        ? 'text-rose-600 font-semibold'
                        : 'text-emerald-600 font-semibold'
                    }
                  >
                    {formatCurrency(item.variance)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
