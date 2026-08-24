'use client'

import React, { useState, useEffect } from 'react'
import type { BackendException, CounterfactualExplanation, Transaction } from '@/types'
import {
  formatCurrency,
  readableException,
  getExceptionSeverity,
  getCounterfactualExplanation,
} from '@/lib/api'
import { RiskBadge, SettlementStatusBadge } from '@/components/common/Badge'
import {
  Sparkles,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sliders,
  DollarSign,
  Scale,
  BrainCircuit,
} from 'lucide-react'

interface CounterfactualStudioProps {
  exceptions: BackendException[]
  selectedTxId?: string
  onSelectTxId?: (id: string) => void
  onNavigateToTransactions?: () => void
}

type ResolutionScenario =
  | 'GATEWAY_RECOVERY'
  | 'MERCHANT_DEBIT'
  | 'REQUERY_WINDOW'
  | 'FEE_CORRECTION'

export function CounterfactualStudio({
  exceptions,
  selectedTxId,
  onSelectTxId,
  onNavigateToTransactions,
}: CounterfactualStudioProps) {
  // Current active exception in queue
  const currentException =
    exceptions.find((e) => e.transaction_id === selectedTxId) ||
    exceptions[0] ||
    null

  const [aiLoading, setAiLoading] = useState(false)
  const [explanation, setExplanation] = useState<CounterfactualExplanation | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<ResolutionScenario>('GATEWAY_RECOVERY')
  const [appliedSimulation, setAppliedSimulation] = useState<boolean>(false)
  const [queueSearch, setQueueSearch] = useState('')

  // Load explanation whenever selected transaction changes
  useEffect(() => {
    if (!currentException) return

    let isMounted = true
    setAiLoading(true)
    setAppliedSimulation(false)

    // Load from backend API
    getCounterfactualExplanation(currentException.transaction_id)
      .then((res) => {
        if (isMounted) {
          setExplanation(res)
          setAiLoading(false)
        }
      })
      .catch((err) => {
        console.error('Counterfactual load failed:', err)
        if (isMounted) setAiLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [currentException?.transaction_id])

  if (!exceptions.length) {
    return (
      <div className="card-panel p-12 text-center space-y-3">
        <ShieldCheck size={32} className="text-emerald-600 mx-auto" />
        <h3 className="text-base font-bold text-slate-900">Zero Reconciliation Exceptions</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          All transactions are fully matched against bank records. Counterfactual intelligence activates when discrepancies are detected.
        </p>
      </div>
    )
  }

  const filteredQueue = exceptions.filter((e) => {
    const q = queueSearch.toLowerCase().trim()
    if (!q) return true
    return (
      e.transaction_id.toLowerCase().includes(q) ||
      e.exception_type.toLowerCase().includes(q) ||
      e.settlement_status.toLowerCase().includes(q)
    )
  })

  const expected = Number(currentException?.expected_settlement ?? 0)
  const actual = Number(currentException?.actual_settlement ?? 0)
  const difference = Math.abs(Number(currentException?.difference ?? 0))
  const exceptionType = currentException?.exception_type || 'UNKNOWN'
  const isDuplicate = exceptionType === 'DUPLICATE'

  // Resolution simulation calculations
  const getSimulationResult = () => {
    switch (selectedScenario) {
      case 'GATEWAY_RECOVERY':
        return {
          title: 'Direct Gateway Recovery Batch',
          recoveredAmount: isDuplicate ? 0 : difference,
          adjustedBalance: expected,
          riskMitigation: '100%',
          actionPlan: 'Dispatch missing settlement batch instruction to payment gateway endpoint. Funds credit within 24h cycle.',
        }
      case 'MERCHANT_DEBIT':
        return {
          title: 'Excess Duplicate Settlement Clawback',
          recoveredAmount: isDuplicate ? difference : 0,
          adjustedBalance: expected,
          riskMitigation: '100%',
          actionPlan: 'Issue reversal debit on merchant next settlement batch for duplicated amount of ' + formatCurrency(difference) + '.',
        }
      case 'REQUERY_WINDOW':
        return {
          title: 'Gateway Settlement Window Re-poll',
          recoveredAmount: difference * 0.95,
          adjustedBalance: expected * 0.95,
          riskMitigation: '95%',
          actionPlan: 'Re-query processor webhook ledger to confirm if batch settlement cleared in adjacent time window.',
        }
      case 'FEE_CORRECTION':
        return {
          title: 'Fee Schedule Adjustment & Credit',
          recoveredAmount: difference,
          adjustedBalance: expected,
          riskMitigation: '100%',
          actionPlan: 'Recalculate interchange tier deduction based on contract schedule and apply credit memo for discrepancy.',
        }
    }
  }

  const simulation = getSimulationResult()

  return (
    <div className="space-y-6">
      {/* Hero Workspace Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Counterfactual Studio</span>
            <span className="fintech-badge bg-indigo-50 text-indigo-700 border border-indigo-200">
              <BrainCircuit size={12} />
              AI-Native Intelligence
            </span>
          </div>
          <h1 className="page-title">Counterfactual Intelligence</h1>
          <p className="page-subhead">
            Model the financial consequences of every resolution strategy before executing treasury actions.
          </p>
        </div>
      </div>

      {/* 2-Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Exception Selection Queue */}
        <div className="lg:col-span-4 card-panel flex flex-col h-[740px]">
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span>Exception Queue</span>
                <span className="text-xs text-slate-500 font-normal">
                  ({filteredQueue.length} items)
                </span>
              </h3>
            </div>

            <input
              type="text"
              placeholder="Search queue..."
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {filteredQueue.map((item) => {
              const isSelected = item.transaction_id === currentException?.transaction_id
              const itemDiff = Math.abs(Number(item.difference ?? 0))
              const severity = getExceptionSeverity(item.exception_type)

              return (
                <div
                  key={item.transaction_id}
                  onClick={() => onSelectTxId && onSelectTxId(item.transaction_id)}
                  className={`p-3 rounded-lg border transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                      : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`mono-id font-bold text-xs ${
                        isSelected ? 'text-indigo-900' : 'text-slate-900'
                      }`}
                    >
                      {item.transaction_id}
                    </span>
                    <RiskBadge risk={severity} />
                  </div>

                  <div className="text-xs text-slate-600 font-medium mb-1">
                    {readableException(item.exception_type)}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-slate-500">Discrepancy:</span>
                    <span className="font-bold text-rose-600 tabular-nums">
                      {formatCurrency(itemDiff)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Simulation & AI Analysis Canvas */}
        <div className="lg:col-span-8 space-y-6">
          {/* Selected Transaction Summary Card */}
          <div className="card-panel p-6 bg-white space-y-6 border border-indigo-100 shadow-xs">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Analyzing Discrepancy
                  </span>
                  <RiskBadge risk={getExceptionSeverity(exceptionType)} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mono-id">
                  {currentException?.transaction_id}
                </h2>
                <p className="text-xs text-slate-600">
                  {readableException(exceptionType)} • Settlement Status: <strong>{currentException?.settlement_status}</strong>
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-500 block">Identified Exposure</span>
                <span className="text-2xl font-bold text-rose-600 tabular-nums">
                  {formatCurrency(difference)}
                </span>
              </div>
            </div>

            {/* Current vs Counterfactual State Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CURRENT ACTUAL STATE */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    1. Current Verified State
                  </span>
                  <span className="fintech-badge badge-exception">Discrepant</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Actual Settlement:</span>
                    <strong className="text-slate-900 tabular-nums">{formatCurrency(actual)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expected Settlement:</span>
                    <span className="text-slate-700 tabular-nums">{formatCurrency(expected)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 text-rose-600 font-semibold">
                    <span>Unreconciled Variance:</span>
                    <span className="tabular-nums">-{formatCurrency(difference)}</span>
                  </div>
                </div>
              </div>

              {/* COUNTERFACTUAL STATE */}
              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-indigo-600" />
                    2. Counterfactual Baseline
                  </span>
                  <span className="fintech-badge badge-reconciled">Target State</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">If Settled Normally:</span>
                    <strong className="text-indigo-900 tabular-nums">{formatCurrency(expected)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Recoverable Value:</span>
                    <span className="text-emerald-700 font-bold tabular-nums">+{formatCurrency(difference)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-indigo-200 text-indigo-800 font-semibold">
                    <span>Target Balance Delta:</span>
                    <span className="tabular-nums">₹0.00 Variance</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Explanation Section */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-lg space-y-4 shadow-md">
              <div className="flex items-center justify-between border-b border-indigo-900/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                    <Sparkles size={14} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                    Deterministic AI Synthesis
                  </span>
                </div>

                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-900/80 border border-indigo-700 text-indigo-200">
                  Confidence: {Math.round((explanation?.confidence ?? 0.98) * 100)}%
                </span>
              </div>

              {aiLoading ? (
                <div className="py-6 text-center space-y-2">
                  <RefreshCw className="spin text-indigo-400 mx-auto" size={20} />
                  <p className="text-xs text-indigo-200">
                    Analyzing ledger rules and counterfactual outcomes...
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-xs leading-relaxed">
                  <div>
                    <span className="text-indigo-300 font-semibold block mb-0.5">
                      Root Cause Finding:
                    </span>
                    <p className="text-slate-200">
                      {explanation?.summary ||
                        `The reconciliation engine verified an expected settlement of ${formatCurrency(
                          expected
                        )} against actual settlement of ${formatCurrency(actual)}.`}
                    </p>
                  </div>

                  <div>
                    <span className="text-indigo-300 font-semibold block mb-0.5">
                      Counterfactual Outcome:
                    </span>
                    <p className="text-slate-200">
                      {explanation?.counterfactual ||
                        `If resolved normally, the treasury reserve would be credited by ${formatCurrency(
                          difference
                        )}.`}
                    </p>
                  </div>

                  <div className="p-3 bg-indigo-900/50 border border-indigo-700/50 rounded-md">
                    <span className="text-amber-300 font-semibold block mb-1">
                      Recommended Treasury Action:
                    </span>
                    <p className="text-slate-100">
                      {explanation?.recommended_action ||
                        `Verify the payment processor batch journal and submit a settlement recovery batch.`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Resolution Scenario Simulator */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders size={16} className="text-indigo-600" />
                  <span>Interactive Resolution Simulator</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Select a strategy to project balance outcomes
                </span>
              </div>

              {/* Scenario Selector Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'GATEWAY_RECOVERY', label: '1. Gateway Batch Recovery', icon: DollarSign },
                  { id: 'MERCHANT_DEBIT', label: '2. Excess Settlement Clawback', icon: Scale },
                  { id: 'REQUERY_WINDOW', label: '3. Re-query Timing Window', icon: RotateCcw },
                  { id: 'FEE_CORRECTION', label: '4. Fee Schedule Re-calc', icon: Sliders },
                ].map(({ id, label, icon: Icon }) => {
                  const isSelected = selectedScenario === id
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        setSelectedScenario(id as ResolutionScenario)
                        setAppliedSimulation(true)
                      }}
                      className={`p-3 text-left rounded-lg border flex items-center gap-2.5 transition ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-semibold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={14} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Simulation Result Projection Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-900">{simulation.title}</span>
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold text-[11px]">
                    Risk Mitigation: {simulation.riskMitigation}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block">Projected Capital Recovered:</span>
                    <strong className="text-base font-bold text-emerald-700 tabular-nums">
                      {formatCurrency(simulation.recoveredAmount)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Target Merchant Credit:</span>
                    <strong className="text-base font-bold text-slate-900 tabular-nums">
                      {formatCurrency(simulation.adjustedBalance)}
                    </strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-600 font-semibold block mb-0.5">Execution Step:</span>
                  <p className="text-slate-600 leading-normal">{simulation.actionPlan}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
