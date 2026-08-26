'use client'

import React from 'react'
import type { ScenarioComparisonItem } from '@/types'
import { formatCurrency } from '@/lib/api'
import { Table, Check, Sparkles, TrendingUp, TrendingDown, Layers } from 'lucide-react'

interface ScenarioComparisonProps {
  scenarios: ScenarioComparisonItem[]
  activeDiscountPct: number
  onSelectScenarioDiscount?: (pct: number) => void
}

export function ScenarioComparison({
  scenarios,
  activeDiscountPct,
  onSelectScenarioDiscount,
}: ScenarioComparisonProps) {
  return (
    <div className="card-panel">
      <div className="card-panel-header">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-indigo-600" />
          <div>
            <h3 className="card-panel-title">Multi-Scenario Pricing Matrix</h3>
            <p className="card-panel-subtitle">
              Compare merchant settlement payout, platform margin, and relative financial risk across commercial tiers
            </p>
          </div>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Commercial Scenario</th>
              <th>Discount Rate</th>
              <th>Merchant Payout</th>
              <th>Platform Revenue</th>
              <th>Financial Delta</th>
              <th className="text-right">Scenario Assessment</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((sc) => {
              const isSelected = Math.abs(activeDiscountPct - sc.discount_pct) < 0.05
              const isGain = sc.merchant_delta > 0
              const isLoss = sc.merchant_delta < 0

              return (
                <tr
                  key={sc.scenario_id}
                  onClick={() => onSelectScenarioDiscount && onSelectScenarioDiscount(sc.discount_pct)}
                  className={`cursor-pointer transition ${
                    isSelected ? 'bg-indigo-50/70 font-semibold' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      {isSelected && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                      <span className="font-bold text-slate-900 text-xs">{sc.name}</span>
                      <span className="fintech-badge bg-slate-100 text-slate-600 text-[10px]">
                        {sc.badge}
                      </span>
                    </div>
                  </td>

                  <td className="tabular-nums font-bold text-slate-800">
                    {sc.discount_pct.toFixed(1)}%
                  </td>

                  <td className="tabular-nums font-bold text-slate-900">
                    {formatCurrency(sc.merchant_settlement)}
                  </td>

                  <td className="tabular-nums font-medium text-slate-700">
                    {formatCurrency(sc.platform_revenue)}
                  </td>

                  <td className="tabular-nums">
                    {isGain ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-xs">
                        +{formatCurrency(sc.merchant_delta)}
                      </span>
                    ) : isLoss ? (
                      <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-xs">
                        {formatCurrency(sc.merchant_delta)}
                      </span>
                    ) : (
                      <span className="text-slate-500 font-medium text-xs">Parity (₹0.00)</span>
                    )}
                  </td>

                  <td className="text-right">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        sc.guidance_type === 'merchant_favorable'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : sc.guidance_type === 'platform_favorable'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {sc.decision_guidance}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
