'use client'

import React from 'react'
import type { RiskLevel, TransactionStatus } from '@/types'
import { CheckCircle2, AlertTriangle, Clock, AlertCircle } from 'lucide-react'

export function StatusBadge({ status }: { status: TransactionStatus | string }) {
  const normalized = status.toLowerCase()

  if (normalized === 'reconciled' || normalized === 'matched' || normalized === 'settled') {
    return (
      <span className="fintech-badge badge-reconciled">
        <CheckCircle2 size={12} className="text-emerald-600" />
        Reconciled
      </span>
    )
  }

  if (normalized === 'missing' || normalized === 'exception') {
    return (
      <span className="fintech-badge badge-exception">
        <AlertTriangle size={12} className="text-rose-600" />
        Exception
      </span>
    )
  }

  if (normalized === 'delayed') {
    return (
      <span className="fintech-badge badge-risk-medium">
        <Clock size={12} className="text-amber-600" />
        Delayed
      </span>
    )
  }

  return (
    <span className="fintech-badge bg-slate-100 text-slate-700 border border-slate-200">
      {status}
    </span>
  )
}

export function RiskBadge({ risk }: { risk: RiskLevel | string }) {
  const level = (risk || 'low').toLowerCase()

  if (level === 'high') {
    return (
      <span className="fintech-badge badge-risk-high">
        <AlertCircle size={11} />
        High Risk
      </span>
    )
  }

  if (level === 'medium') {
    return (
      <span className="fintech-badge badge-risk-medium">
        <AlertTriangle size={11} />
        Medium Risk
      </span>
    )
  }

  return (
    <span className="fintech-badge badge-risk-low">
      <CheckCircle2 size={11} />
      Low Risk
    </span>
  )
}

export function RailBadge({ rail }: { rail: string }) {
  return (
    <span className="fintech-badge badge-rail">
      {rail || 'CARD'}
    </span>
  )
}

export function SettlementStatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase()
  if (s === 'settled') {
    return <span className="fintech-badge badge-reconciled">Settled</span>
  }
  if (s === 'missing') {
    return <span className="fintech-badge badge-exception">Missing</span>
  }
  if (s === 'delayed') {
    return <span className="fintech-badge badge-risk-medium">Delayed</span>
  }
  return <span className="fintech-badge bg-slate-100 text-slate-600 border border-slate-200">{status}</span>
}
