'use client'

import React, { useMemo } from 'react'
import type { BackendException, ExceptionBreakdownItem } from '@/types'
import {
  formatCurrency,
  readableException,
  getExceptionSeverity,
  getExceptionColor,
} from '@/lib/api'
import { AlertCircle, ChevronRight, ShieldAlert } from 'lucide-react'

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

  // Generate SVG conic / arc segments for donut chart
  const donutGradient = useMemo(() => {
    if (!breakdown.length || totalExceptions === 0) {
      return 'conic-gradient(#e2e8f0 0deg 360deg)'
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
    <div className="card-panel h-full flex flex-col">
      <div className="card-panel-header">
        <div>
          <h2 className="card-panel-title">Exception Intelligence</h2>
          <p className="card-panel-subtitle">
            {totalExceptions} open items totaling {formatCurrency(totalAtRisk)} exposure
          </p>
        </div>
      </div>

      <div className="card-panel-body flex-1 flex flex-col justify-between gap-6">
        {/* Donut Visualizer and High-Level Stats */}
        <div className="flex items-center justify-around gap-6 py-2">
          <div className="relative flex items-center justify-center shrink-0">
            <div
              className="w-32 h-32 rounded-full transition-all duration-500 shadow-inner"
              style={{ background: donutGradient }}
            />
            {/* Donut Inner Hole */}
            <div className="absolute w-20 h-20 rounded-full bg-white flex flex-col items-center justify-center shadow-xs">
              <span className="text-xl font-bold text-slate-900 leading-none tabular-nums">
                {totalExceptions}
              </span>
              <span className="text-[10px] uppercase font-semibold text-slate-500 mt-0.5 tracking-wider">
                Exceptions
              </span>
            </div>
          </div>

          <div className="space-y-3 flex-1 min-w-[140px]">
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-md">
              <span className="text-[11px] font-medium text-rose-700 block">
                Total At-Risk Exposure
              </span>
              <strong className="text-base font-bold text-rose-900 tabular-nums">
                {formatCurrency(totalAtRisk)}
              </strong>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
              <span className="text-[11px] font-medium text-slate-600 block">
                Dominant Root Cause
              </span>
              <strong className="text-xs font-semibold text-slate-800 truncate block">
                {breakdown[0]?.label || 'None detected'}
              </strong>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown List */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          {breakdown.map((item) => (
            <div
              key={item.type}
              onClick={() => onSelectType && onSelectType(item.type)}
              className={`p-2.5 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition flex items-center justify-between text-xs cursor-pointer ${
                onSelectType ? 'hover:shadow-xs' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 truncate">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {item.count} items ({item.percentage.toFixed(1)}%)
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="font-bold text-slate-900 tabular-nums">
                  {formatCurrency(item.financialImpact)}
                </div>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                    item.severity === 'High'
                      ? 'text-rose-700 bg-rose-50'
                      : 'text-amber-700 bg-amber-50'
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
