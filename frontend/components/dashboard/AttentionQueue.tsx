'use client'

import React from 'react'
import type { BackendException } from '@/types'
import {
  formatCurrency,
  readableException,
  getExceptionSeverity,
} from '@/lib/api'
import { RiskBadge, SettlementStatusBadge } from '@/components/common/Badge'
import { AlertTriangle, ArrowUpRight, Sparkles } from 'lucide-react'

interface AttentionQueueProps {
  exceptions: BackendException[]
  onInspect: (exception: BackendException) => void
  onSimulate: (transactionId: string) => void
  onViewAll: () => void
}

export function AttentionQueue({
  exceptions,
  onInspect,
  onSimulate,
  onViewAll,
}: AttentionQueueProps) {
  // Sort by highest difference (financial impact) first
  const highPriority = [...exceptions]
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, 5)

  if (!highPriority.length) return null

  return (
    <div className="card-panel">
      <div className="card-panel-header">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
            <AlertTriangle size={15} />
          </div>
          <div>
            <h2 className="card-panel-title">What Needs Attention</h2>
            <p className="card-panel-subtitle">
              Highest-exposure discrepancies requiring urgent treasury review
            </p>
          </div>
        </div>

        <button onClick={onViewAll} className="btn btn-secondary btn-sm">
          <span>View All Exceptions ({exceptions.length})</span>
          <ArrowUpRight size={14} />
        </button>
      </div>

      <div className="p-0 divide-y divide-slate-100">
        {highPriority.map((item, idx) => {
          const impact = Math.abs(item.difference)
          const severity = getExceptionSeverity(item.exception_type)

          return (
            <div
              key={`${item.transaction_id}-${idx}`}
              className="p-4 hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              {/* Left Details */}
              <div
                className="flex items-start sm:items-center gap-3.5 cursor-pointer flex-1"
                onClick={() => onInspect(item)}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="mono-id font-bold text-slate-900 group-hover:text-indigo-600 transition">
                      {item.transaction_id}
                    </span>
                    <RiskBadge risk={severity} />
                    <SettlementStatusBadge status={item.settlement_status} />
                  </div>
                  <div className="text-xs text-slate-600 font-medium">
                    {readableException(item.exception_type)}
                    <span className="text-slate-400 font-normal">
                      {' '}• Expected: {formatCurrency(item.expected_settlement)} | Actual: {formatCurrency(item.actual_settlement)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Impact & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                <div className="text-left sm:text-right">
                  <div className="text-xs text-slate-500 font-medium">At Risk</div>
                  <div className="text-sm font-bold text-rose-600 tabular-nums">
                    {formatCurrency(impact)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSimulate(item.transaction_id)}
                    className="btn btn-secondary btn-sm text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300"
                    title="Simulate Counterfactual Resolution"
                  >
                    <Sparkles size={13} className="text-indigo-600" />
                    <span className="text-xs">Counterfactual</span>
                  </button>

                  <button
                    onClick={() => onInspect(item)}
                    className="btn btn-secondary btn-sm"
                  >
                    <span>Investigate</span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
