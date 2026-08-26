'use client'

import React, { useMemo } from 'react'
import type { BackendException, ExceptionBreakdownItem } from '@/types'
import {
  formatCurrency,
  readableException,
  getExceptionSeverity,
  getExceptionColor,
} from '@/lib/api'
import { AlertCircle, ChevronRight, ShieldAlert, Sparkles } from 'lucide-react'

interface ExceptionBreakdownProps {
  exceptions: BackendException[]
  totalExceptions: number
  onSelectType?: (type: string) => void
}

export function ExceptionBreakdown({
  exceptions,
  totalExceptions,
  onSelectType,
}: ExceptionBreakdownProps) {
  // Aggregate real exception counts and financial differences
  const breakdown: ExceptionBreakdownItem[] = useMemo(() => {
    if (!exceptions.length) return []

    const map = new Map<string, { count: number; impact: number }>()

    exceptions.forEach((exc) => {
      const type = exc.exception_type || 'UNKNOWN'
      const current = map.get(type) || { count: 0, impact: 0 }
      current.count += 1
      current.impact += Math.abs(Number(exc.difference ?? 0))
      map.set(type, current)
    })

    return Array.from(map.entries())
      .map(([type, data]) => ({
        type,
        label: readableException(type),
        count: data.count,
        percentage: totalExceptions > 0 ? (data.count / totalExceptions) * 100 : 0,
        financialImpact: Math.round(data.impact * 100) / 100,
        severity: getExceptionSeverity(type),
        color: getExceptionColor(type),
      }))
      .sort((a, b) => b.financialImpact - a.financialImpact)
  }, [exceptions, totalExceptions])

  // Generate SVG conic gradient
  const donutGradient = useMemo(() => {
    if (!breakdown.length || totalExceptions === 0) {
      return 'conic-gradient(#1e293b 0deg 360deg)'
    }

    let currentDeg = 0
    const segments: string[] = []

    breakdown.forEach((item) => {
      const deg = (item.count / totalExceptions) * 360
      const start = currentDeg
      const end = currentDeg + deg
      currentDeg = end
      segments.push(`${item.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`)
    })

    return `conic-gradient(${segments.join(', ')})`
  }, [breakdown, totalExceptions])

  const totalAtRisk = useMemo(() => {
    return breakdown.reduce((sum, item) => sum + item.financialImpact, 0)
  }, [breakdown])

  return (
    <div className="card-panel h-full flex flex-col justify-between">
      <div className="card-panel-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Risk Classification</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          </div>
          <h2 className="card-panel-title text-base font-bold">Exception Intelligence</h2>
          <p className="card-panel-subtitle">
            Discrepancy taxonomy across {totalExceptions} flagged entities
          </p>
        </div>
      </div>

      <div className="card-panel-body flex-1 flex flex-col justify-between gap-5">
        {/* Radial Visualizer and High-Level Stats */}
        <div className="flex flex-col sm:flex-row items-center justify-around gap-5 py-1">
          {/* 3D Radial Donut */}
          <div className="relative flex items-center justify-center shrink-0">
            <div
              className="w-32 h-32 rounded-full transition-all duration-500 shadow-2xl p-1"
              style={{
                background: donutGradient,
                boxShadow: '0 0 20px rgba(0, 0, 0, 0.5), inset 0 0 10px rgba(0, 0, 0, 0.4)',
              }}
            />
            {/* Donut Inner Hole */}
            <div className="absolute w-20 h-20 rounded-full bg-slate-900 flex flex-col items-center justify-center border border-slate-800 shadow-inner">
              <span className="text-xl font-bold text-white leading-none tabular-nums">
                {totalExceptions}
              </span>
              <span className="text-[9px] uppercase font-bold text-slate-400 mt-1 tracking-wider">
                Exceptions
              </span>
            </div>
          </div>

          <div className="space-y-2.5 flex-1 min-w-[140px] w-full sm:w-auto">
            <div className="p-3 bg-rose-950/40 border border-rose-800/40 rounded-xl">
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider block">
                Total At-Risk Capital
              </span>
              <strong className="text-base font-bold text-rose-400 tabular-nums">
                {formatCurrency(totalAtRisk)}
              </strong>
            </div>

            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Dominant Root Cause
              </span>
              <strong className="text-xs font-semibold text-slate-200 truncate block mt-0.5">
                {breakdown[0]?.label || 'None detected'}
              </strong>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown List */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          {breakdown.map((item) => (
            <div
              key={item.type}
              onClick={() => onSelectType && onSelectType(item.type)}
              className={`p-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-800/60 hover:border-indigo-500/40 transition flex items-center justify-between text-xs cursor-pointer group ${
                onSelectType ? 'hover:shadow-xs' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <div className="font-bold text-slate-200 group-hover:text-indigo-300 transition truncate">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {item.count} items ({item.percentage.toFixed(1)}%)
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-bold text-white tabular-nums">
                  {formatCurrency(item.financialImpact)}
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    item.severity === 'High'
                      ? 'text-rose-300 bg-rose-950/60 border border-rose-800/40'
                      : 'text-amber-300 bg-amber-950/60 border border-amber-800/40'
                  }`}
                >
                  {item.severity} Risk
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
