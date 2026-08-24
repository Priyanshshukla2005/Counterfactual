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
      <div className="text-center py-16 px-6 bg-white border border-slate-200 rounded-lg">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={24} />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          {title || 'All Settlements Clean'}
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
          {description || 'No reconciliation exceptions require immediate attention. All payment gateway batches match bank records.'}
        </p>
        {actionLabel && onAction && (
          <button onClick={onAction} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} />
            {actionLabel}
          </button>
        )}
      </div>
    )
  }

  if (type === 'error') {
    return (
      <div className="text-center py-16 px-6 bg-white border border-rose-200 rounded-lg">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={24} />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          {title || 'Unable to Connect to Reconciliation Engine'}
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
          {description || 'Verify the Flask settlement service is running at localhost:5000 and try again.'}
        </p>
        {onAction && (
          <button onClick={onAction} className="btn btn-primary btn-sm">
            <RefreshCw size={14} />
            {actionLabel || 'Retry Connection'}
          </button>
        )}
      </div>
    )
  }

  // type === 'no-results'
  return (
    <div className="text-center py-12 px-6 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
        <SearchX size={20} />
      </div>
      <h3 className="text-sm font-semibold text-slate-800 mb-1">
        {title || 'No Matching Transactions'}
      </h3>
      <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
        {description || 'Try adjusting your search criteria, rail filters, or exception status filters.'}
      </p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn btn-secondary btn-sm">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
