'use client'

import React from 'react'
import type { RiskLevel, TransactionStatus } from '@/types'
import { CheckCircle2, AlertTriangle, Clock, AlertCircle } from 'lucide-react'

export function StatusBadge({ status }: { status: TransactionStatus | string }) {
  const normalized = (status || '').toLowerCase()

  if (normalized === 'reconciled' || normalized === 'matched' || normalized === 'settled') {
    return (
      <span className="fintech-badge badge-reconciled">
        <CheckCircle2 size={11} className="text-emerald-400" />
        <span>Reconciled</span>
      </span>
    )
  }

  if (normalized === 'missing' || normalized === 'exception') {
    return (
      <span className="fintech-badge badge-exception">
        <AlertTriangle size={11} className="text-rose-400" />
        <span>Exception</span>
      </span>
    )
  }

  if (normalized === 'delayed') {
    return (
      <span className="fintech-badge bg-amber-950/80 border border-amber-500/40 text-amber-300">
        <Clock size={11} className="text-amber-400" />
        <span>Delayed</span>
      </span>
    )
  }

  return (
    <span className="fintech-badge bg-slate-800 text-slate-300 border border-slate-700">
      {status}
    </span>
  )
}

export function RiskBadge({ risk }: { risk: RiskLevel | string }) {
  const level = (risk || 'low').toLowerCase()

  if (level === 'high') {
    return (
      <span className="fintech-badge bg-rose-950/80 border border-rose-500/40 text-rose-300 shadow-2xs">
        <AlertCircle size={10} className="text-rose-400" />
        <span>High Risk</span>
      </span>
    )
  }

  if (level === 'medium') {
    return (
      <span className="fintech-badge bg-amber-950/80 border border-amber-500/40 text-amber-300">
        <AlertTriangle size={10} className="text-amber-400" />
        <span>Medium Risk</span>
      </span>
    )
  }

  return (
    <span className="fintech-badge bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
      <CheckCircle2 size={10} className="text-emerald-400" />
      <span>Low Risk</span>
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
    return <span className="fintech-badge bg-amber-950/80 border border-amber-500/40 text-amber-300">Delayed</span>
  }
  return <span className="fintech-badge bg-slate-800 text-slate-300 border border-slate-700">{status}</span>
}
