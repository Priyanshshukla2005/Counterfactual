'use client'

import React from 'react'
import type { CounterfactualSimulation } from '@/types'
import { formatCurrency } from '@/lib/api'
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sparkles,
  Building,
  Landmark,
  Scale,
  CheckCircle2,
} from 'lucide-react'

interface FinancialImpactProps {
  simulation: CounterfactualSimulation
}

export function FinancialImpact({ simulation }: FinancialImpactProps) {
  const { current_state, counterfactual_state, deltas, gross_amount } = simulation
  const isMerchantGain = deltas.merchant_delta > 0
  const isPlatformGain = deltas.platform_delta > 0

  return (
    <div className="space-y-6">
      {/* 2-Column Side-by-Side Settlement Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CURRENT VERIFIED STATE */}
        <div className="card-panel p-5 bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                1. Baseline Commercial State
              </h4>
            </div>
            <span className="fintech-badge bg-slate-100 text-slate-700 font-semibold">
              {current_state.discount_pct.toFixed(1)}% Discount
            </span>
          </div>

          {/* Hero Payout Value */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
              <Landmark size={13} className="text-slate-400" />
              <span>Merchant Settlement Payout</span>
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(current_state.merchant_settlement)}
            </div>
          </div>

          {/* Accounting Breakdown */}
          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex justify-between py-1 text-slate-600">
              <span>Gross Order Volume:</span>
              <strong className="text-slate-900 tabular-nums">{formatCurrency(gross_amount)}</strong>
            </div>

            <div className="flex justify-between py-1 text-slate-600">
              <span>Commercial Discount ({current_state.discount_pct.toFixed(1)}%):</span>
              <span className="text-rose-600 tabular-nums">
                -{formatCurrency(current_state.discount_amount)}
              </span>
            </div>

            <div className="flex justify-between py-1 text-slate-600">
              <span>Gateway Fees & GST:</span>
              <span className="text-slate-700 tabular-nums">
                -{formatCurrency(current_state.fee_amount + current_state.tax_amount)}
              </span>
            </div>

            <div className="flex justify-between py-1.5 pt-2 font-semibold text-slate-700 bg-slate-50/50 px-2 rounded">
              <span>Platform Revenue Retained:</span>
              <strong className="text-indigo-900 tabular-nums">
                {formatCurrency(current_state.platform_revenue)}
              </strong>
            </div>
          </div>
        </div>

        {/* COUNTERFACTUAL SIMULATION STATE */}
        <div className="card-panel p-5 bg-gradient-to-b from-indigo-50/40 via-white to-white border border-indigo-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                2. Counterfactual Simulation
              </h4>
            </div>
            <span className="fintech-badge bg-indigo-100 text-indigo-800 font-bold border border-indigo-200">
              {counterfactual_state.discount_pct.toFixed(1)}% Discount
            </span>
          </div>

          {/* Hero Simulated Payout Value */}
          <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-indigo-900 flex items-center gap-1.5">
                <Landmark size={13} className="text-indigo-600" />
                <span>Simulated Merchant Payout</span>
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isMerchantGain
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : deltas.merchant_delta < 0
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {isMerchantGain ? (
                  <>
                    <TrendingUp size={12} />
                    <span>+{formatCurrency(deltas.merchant_delta)}</span>
                  </>
                ) : deltas.merchant_delta < 0 ? (
                  <>
                    <TrendingDown size={12} />
                    <span>{formatCurrency(deltas.merchant_delta)}</span>
                  </>
                ) : (
                  <span>Parity (₹0.00)</span>
                )}
              </span>
            </div>
            <div className="text-2xl font-bold text-indigo-950 tabular-nums">
              {formatCurrency(counterfactual_state.merchant_settlement)}
            </div>
          </div>

          {/* Accounting Breakdown */}
          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex justify-between py-1 text-slate-600">
              <span>Gross Order Volume:</span>
              <strong className="text-slate-900 tabular-nums">{formatCurrency(gross_amount)}</strong>
            </div>

            <div className="flex justify-between py-1 text-slate-600">
              <span>Commercial Discount ({counterfactual_state.discount_pct.toFixed(1)}%):</span>
              <span className="text-indigo-700 font-semibold tabular-nums">
                -{formatCurrency(counterfactual_state.discount_amount)}
              </span>
            </div>

            <div className="flex justify-between py-1 text-slate-600">
              <span>Gateway Fees & GST:</span>
              <span className="text-slate-700 tabular-nums">
                -{formatCurrency(counterfactual_state.fee_amount + counterfactual_state.tax_amount)}
              </span>
            </div>

            <div className="flex justify-between py-1.5 pt-2 font-semibold text-slate-700 bg-indigo-50/50 px-2 rounded">
              <span>Platform Revenue Retained:</span>
              <div className="flex items-center gap-1.5">
                <strong className="text-indigo-950 tabular-nums">
                  {formatCurrency(counterfactual_state.platform_revenue)}
                </strong>
                <span
                  className={`text-[10px] font-bold ${
                    isPlatformGain ? 'text-emerald-700' : deltas.platform_delta < 0 ? 'text-amber-700' : 'text-slate-500'
                  }`}
                >
                  ({deltas.platform_delta >= 0 ? `+${formatCurrency(deltas.platform_delta)}` : formatCurrency(deltas.platform_delta)})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Financial Impact Delta Summary Banner */}
      <div className="p-4 bg-slate-900 text-white rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Scale size={15} className="text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Net Financial Delta & Exposure
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Shift in capital distribution between merchant payout and platform retained margin.
          </p>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <div className="text-left sm:text-right">
            <div className="text-[11px] text-slate-400">Merchant Payout Delta</div>
            <div
              className={`text-base font-bold tabular-nums ${
                isMerchantGain ? 'text-emerald-400' : deltas.merchant_delta < 0 ? 'text-rose-400' : 'text-slate-300'
              }`}
            >
              {isMerchantGain ? `+${formatCurrency(deltas.merchant_delta)}` : formatCurrency(deltas.merchant_delta)}
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="text-[11px] text-slate-400">Platform Revenue Delta</div>
            <div
              className={`text-base font-bold tabular-nums ${
                isPlatformGain ? 'text-emerald-400' : deltas.platform_delta < 0 ? 'text-amber-400' : 'text-slate-300'
              }`}
            >
              {deltas.platform_delta >= 0 ? `+${formatCurrency(deltas.platform_delta)}` : formatCurrency(deltas.platform_delta)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
