'use client'

import React from 'react'
import type { BackendException } from '@/types'
import {
  formatCurrency,
  readableException,
  getExceptionSeverity,
} from '@/lib/api'
import { RiskBadge, SettlementStatusBadge } from '@/components/common/Badge'
import { AlertTriangle, ArrowUpRight, Sparkles, ArrowRight, ShieldAlert } from 'lucide-react'

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
          <div className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-800/60 text-rose-400 flex items-center justify-center shadow-2xs">
            <AlertTriangle size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow text-rose-400">Needs Attention</span>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            </div>
            <h2 className="card-panel-title text-base font-bold">Payments That Need Attention</h2>
            <p className="card-panel-subtitle">
              Payments with the largest difference between expected and received money
            </p>
          </div>
        </div>

        <button onClick={onViewAll} className="btn btn-secondary btn-sm">
          <span>View All Problems ({exceptions.length})</span>
          <ArrowUpRight size={13} />
        </button>
      </div>

      <div className="p-0 divide-y divide-slate-800/80">
        {highPriority.map((item) => {
          const impact = Math.abs(item.difference)
          const severity = getExceptionSeverity(item.exception_type)
          const isDuplicate = item.exception_type === 'DUPLICATE'

          return (
            <div
              key={item.transaction_id}
              className="p-4 hover:bg-slate-900/60 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
            >
              {/* Left Details with Linear Flow */}
              <div
                className="flex items-start sm:items-center gap-3.5 cursor-pointer flex-1"
                onClick={() => onInspect(item)}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="mono-id font-bold text-white group-hover:text-indigo-400 transition text-sm">
                      {item.transaction_id}
                    </span>
                    <RiskBadge risk={severity} />
                    <SettlementStatusBadge status={item.settlement_status} />
                    {isDuplicate && (
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded">
                        Duplicate Payment
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-300 font-medium">
                    <span className="text-rose-400 font-bold">
                      {readableException(item.exception_type)}
                    </span>
                    <span className="text-slate-400 font-normal">
                      {' '}• Expected: <strong className="text-slate-200">{formatCurrency(item.expected_settlement)}</strong> | Received: <strong className="text-slate-200">{formatCurrency(item.actual_settlement)}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Exposure & Tactical Action Triggers */}
              <div className="flex items-center justify-between lg:justify-end gap-5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                <div className="text-left lg:text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Money at Risk</div>
                  <div className="text-base font-bold text-rose-400 tabular-nums">
                    {formatCurrency(impact)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSimulate(item.transaction_id)}
                    className="btn btn-primary btn-sm"
                    title="Run What-If Analysis on this payment"
                  >
                    <Sparkles size={13} />
                    <span>What-If Analysis</span>
                  </button>

                  <button
                    onClick={() => onInspect(item)}
                    className="btn btn-secondary btn-sm"
                  >
                    <span>View</span>
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
