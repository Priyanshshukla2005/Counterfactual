'use client'

import React from 'react'
import { Sliders, RotateCcw, Zap, Sparkles, Percent, Clock, RefreshCw } from 'lucide-react'

interface ScenarioControlsProps {
  grossAmount: number
  currentDiscountPct: number
  newDiscountPct: number
  feePct: number
  taxPct: number
  refundAmount: number
  settlementRecoveryPct: number
  settlementTimingDays: number
  onDiscountChange: (val: number) => void
  onFeeChange: (val: number) => void
  onRefundChange: (val: number) => void
  onRecoveryChange: (val: number) => void
  onTimingChange: (val: number) => void
  onReset: () => void
}

export function ScenarioControls({
  grossAmount,
  currentDiscountPct,
  newDiscountPct,
  feePct,
  taxPct,
  refundAmount,
  settlementRecoveryPct,
  settlementTimingDays,
  onDiscountChange,
  onFeeChange,
  onRefundChange,
  onRecoveryChange,
  onTimingChange,
  onReset,
}: ScenarioControlsProps) {
  const presets = [
    { label: 'Baseline', pct: 5.0, desc: 'Default 5.0%' },
    { label: 'Growth Incentive', pct: 3.0, desc: 'Reduced 3.0%' },
    { label: 'Zero Discount', pct: 0.0, desc: 'Raw 0.0%' },
    { label: 'Volume Tier', pct: 2.0, desc: 'Tiered 2.0%' },
    { label: 'High Margin', pct: 7.5, desc: 'Elevated 7.5%' },
  ]

  return (
    <div className="card-panel p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-indigo-600" />
          <h3 className="font-bold text-slate-900 text-sm">Commercial Scenario Variables</h3>
        </div>

        <button
          onClick={onReset}
          className="btn btn-secondary btn-sm text-xs py-1 px-2.5"
          title="Reset variables to baseline"
        >
          <RotateCcw size={12} />
          <span>Reset Baseline</span>
        </button>
      </div>

      {/* Scenario Presets Quick-Select */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
          Scenario Presets
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {presets.map((preset) => {
            const isSelected = Math.abs(newDiscountPct - preset.pct) < 0.05
            return (
              <button
                key={preset.label}
                onClick={() => onDiscountChange(preset.pct)}
                className={`p-2 rounded-lg border text-left transition ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-100 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold text-slate-900 truncate">{preset.label}</div>
                <div className="text-[10px] text-slate-500 font-medium">{preset.desc}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Primary Variable 1: Commercial Discount Slider */}
      <div className="space-y-2 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
              <Percent size={13} className="text-indigo-600" />
              Hypothetical Commercial Discount
            </span>
            <span className="text-[11px] text-slate-500 block">
              Baseline: {currentDiscountPct.toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-indigo-200 shadow-2xs">
            <input
              type="number"
              min="0"
              max="15"
              step="0.1"
              value={newDiscountPct}
              onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
              className="w-12 text-right font-bold text-indigo-900 text-sm outline-none"
            />
            <span className="text-xs font-bold text-indigo-700">%</span>
          </div>
        </div>

        {/* Live Slider */}
        <input
          type="range"
          min="0"
          max="15"
          step="0.1"
          value={newDiscountPct}
          onChange={(e) => onDiscountChange(parseFloat(e.target.value))}
          className="w-full accent-indigo-600 cursor-pointer h-2 bg-indigo-200 rounded-lg"
        />

        <div className="flex justify-between text-[10px] font-semibold text-slate-400">
          <span>0.0% (Zero Fee)</span>
          <span>5.0% (Baseline)</span>
          <span>10.0%</span>
          <span>15.0% (High Margin)</span>
        </div>
      </div>

      {/* Secondary Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Gateway Fee % */}
        <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">Gateway Fee Rate</span>
            <strong className="text-slate-900 tabular-nums">{feePct.toFixed(1)}%</strong>
          </div>
          <input
            type="range"
            min="0.5"
            max="4.0"
            step="0.1"
            value={feePct}
            onChange={(e) => onFeeChange(parseFloat(e.target.value))}
            className="w-full accent-slate-700 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>0.5% UPI</span>
            <span>1.8% Card</span>
            <span>4.0% International</span>
          </div>
        </div>

        {/* Settlement Recovery */}
        <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800">Settlement Recovery</span>
            <strong className="text-emerald-700 tabular-nums">{settlementRecoveryPct}%</strong>
          </div>
          <input
            type="range"
            min="50"
            max="100"
            step="5"
            value={settlementRecoveryPct}
            onChange={(e) => onRecoveryChange(parseInt(e.target.value, 10))}
            className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-emerald-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>50% Partial</span>
            <span>85% Reserve</span>
            <span>100% Full</span>
          </div>
        </div>
      </div>

      {/* Settlement Timing Option */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
          Settlement Velocity & Timing
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { days: 0, label: 'Instant T+0', desc: 'Real-time Net' },
            { days: 1, label: 'Standard T+1', desc: 'Next Business Day' },
            { days: 2, label: 'Batch T+2', desc: 'Extended Audit' },
          ].map((t) => (
            <button
              key={t.days}
              onClick={() => onTimingChange(t.days)}
              className={`p-2.5 rounded-lg border text-left text-xs transition ${
                settlementTimingDays === t.days
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="font-bold">{t.label}</div>
              <div className={`text-[10px] ${settlementTimingDays === t.days ? 'text-slate-300' : 'text-slate-500'}`}>
                {t.desc}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
