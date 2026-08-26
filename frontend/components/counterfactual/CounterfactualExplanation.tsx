'use client'

import React from 'react'
import type { CounterfactualSimulation } from '@/types'
import { formatCurrency } from '@/lib/api'
import {
  BrainCircuit,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react'

interface CounterfactualExplanationProps {
  simulation: CounterfactualSimulation
}

export function CounterfactualExplanation({ simulation }: CounterfactualExplanationProps) {
  const {
    explanation,
    decision_guidance,
    guidance_type,
    current_state,
    counterfactual_state,
    deltas,
    gross_amount,
  } = simulation

  return (
    <div className="card-panel p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl shadow-lg space-y-4">
      {/* Header with Assessment Guidance Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-indigo-900/60">
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} className="text-indigo-400" />
          <h3 className="font-bold text-white text-sm">Deterministic Counterfactual Analysis</h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-medium">Decision Guidance:</span>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              guidance_type === 'merchant_favorable'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                : guidance_type === 'platform_favorable'
                ? 'bg-indigo-900/80 text-indigo-200 border-indigo-400/50'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {decision_guidance}
          </span>
        </div>
      </div>

      {/* Natural Language Narrative (Computed from actual figures) */}
      <div className="p-3.5 bg-slate-950/70 rounded-lg border border-indigo-900/40 space-y-2">
        <p className="text-xs text-slate-200 leading-relaxed font-medium">
          {explanation}
        </p>
      </div>

      {/* Audit Calculation Formula Trail */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
        <div className="p-2.5 bg-slate-950/50 border border-slate-800 rounded-lg space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">1. Input Assumptions</span>
          <div className="text-slate-300">
            Discount: <strong>{current_state.discount_pct.toFixed(1)}%</strong> →{' '}
            <strong className="text-indigo-300">{counterfactual_state.discount_pct.toFixed(1)}%</strong>
          </div>
          <div className="text-slate-400 text-[11px]">Gross: {formatCurrency(gross_amount)}</div>
        </div>

        <div className="p-2.5 bg-slate-950/50 border border-slate-800 rounded-lg space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">2. Applied Formula</span>
          <div className="text-slate-300 font-mono text-[11px]">
            Gross × (1 - {counterfactual_state.discount_pct.toFixed(1)}%) - Fees
          </div>
          <div className="text-slate-400 text-[11px]">
            Total Deductions: {formatCurrency(counterfactual_state.discount_amount + counterfactual_state.fee_amount + counterfactual_state.tax_amount)}
          </div>
        </div>

        <div className="p-2.5 bg-slate-950/50 border border-slate-800 rounded-lg space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">3. Net Settlement Outcome</span>
          <div className="font-bold text-emerald-400">
            {formatCurrency(counterfactual_state.merchant_settlement)}
          </div>
          <div className="text-[11px] text-slate-400">
            Net Delta: {deltas.merchant_delta >= 0 ? `+${formatCurrency(deltas.merchant_delta)}` : formatCurrency(deltas.merchant_delta)}
          </div>
        </div>
      </div>
    </div>
  )
}
