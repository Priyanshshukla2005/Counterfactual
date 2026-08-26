'use client'

import React from 'react'
import { CheckCircle2, SearchX, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react'

interface EmptyStateProps {
  type: 'no-exceptions' | 'no-results' | 'error' | 'reconciled-all'
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  type,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  if (type === 'no-exceptions' || type === 'reconciled-all') {
    return (
      <div className="card-panel text-center py-16 px-6 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg">
          <ShieldCheck size={28} />
        </div>
        <h3 className="text-base font-bold text-white mb-1">
          {title || 'All Settlements Clean & Reconciled'}
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          {description || 'Zero open exceptions requiring immediate action. All gateway batches align with bank records.'}
        </p>
        {actionLabel && onAction && (
          <button onClick={onAction} className="btn btn-secondary btn-sm mx-auto">
            <RefreshCw size={13} />
            <span>{actionLabel}</span>
          </button>
        )}
      </div>
    )
  }

  if (type === 'error') {
    return (
      <div className="card-panel text-center py-16 px-6 border-rose-800/40 bg-rose-950/20 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-950/80 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto shadow-lg">
          <AlertTriangle size={28} />
        </div>
        <h3 className="text-base font-bold text-white mb-1">
          {title || 'Reconciliation Engine Connectivity Issue'}
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          {description || 'Verify backend settlement service at localhost:5000 and retry.'}
        </p>
        {onAction && (
          <button onClick={onAction} className="btn btn-primary btn-sm mx-auto">
            <RefreshCw size={13} />
            <span>{actionLabel || 'Retry Connection'}</span>
          </button>
        )}
      </div>
    )
  }

  // type === 'no-results'
  return (
    <div className="card-panel text-center py-14 px-6 border-dashed border-slate-700 bg-slate-900/40 space-y-3">
      <div className="w-12 h-12 rounded-xl bg-slate-800/80 text-slate-400 border border-slate-700 flex items-center justify-center mx-auto">
        <SearchX size={22} />
      </div>
      <h3 className="text-sm font-bold text-white mb-1">
        {title || 'No Matching Ledger Records Found'}
      </h3>
      <p className="text-xs text-slate-400 max-w-sm mx-auto">
        {description || 'Adjust your search parameters, rail instruments, or risk filters.'}
      </p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn btn-secondary btn-sm mx-auto">
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  )
}
