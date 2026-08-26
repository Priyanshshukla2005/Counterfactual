'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type {
  BackendException,
  CounterfactualExplanation as ExceptionExplanationType,
  SimulationResponse,
  SavedSimulation,
} from '@/types'
import {
  formatCurrency,
  readableException,
  getExceptionSeverity,
  getCounterfactualExplanation,
  calculateLocalSimulation,
  simulateCounterfactual,
  saveSimulationScenario,
  getSavedSimulations,
  deleteSavedSimulation,
} from '@/lib/api'
import { RiskBadge, SettlementStatusBadge } from '@/components/common/Badge'
import { CounterfactualScene } from '@/components/counterfactual/CounterfactualScene'
import { ScenarioControls } from '@/components/counterfactual/ScenarioControls'
import { FinancialImpact } from '@/components/counterfactual/FinancialImpact'
import { ScenarioComparison } from '@/components/counterfactual/ScenarioComparison'
import { CounterfactualExplanation } from '@/components/counterfactual/CounterfactualExplanation'

import {
  Sparkles,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  RotateCcw,
  Sliders,
  DollarSign,
  Scale,
  BrainCircuit,
  Layers,
  Wrench,
  BookmarkPlus,
  Trash2,
  CheckCircle2,
  Clock,
  Database,
  History,
} from 'lucide-react'

interface CounterfactualStudioProps {
  exceptions: BackendException[]
  selectedTxId?: string
  onSelectTxId?: (id: string) => void
  onNavigateToTransactions?: () => void
}

type StudioMode = 'COMMERCIAL_PRICING' | 'EXCEPTION_RESOLUTION' | 'SAVED_SCENARIOS'
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
  // Current active transaction
  const currentException =
    exceptions.find((e) => e.transaction_id === selectedTxId) ||
    exceptions[0] ||
    null

  // Studio Mode
  const [studioMode, setStudioMode] = useState<StudioMode>('COMMERCIAL_PRICING')

  // Commercial Variable Inputs (Live Simulation State)
  const grossBaseline = currentException
    ? Number(currentException.expected_settlement || currentException.actual_settlement || 10000)
    : 10000

  const [grossAmount, setGrossAmount] = useState<number>(grossBaseline)
  const [currentDiscountPct, setCurrentDiscountPct] = useState<number>(5.0)
  const [newDiscountPct, setNewDiscountPct] = useState<number>(3.0)
  const [feePct, setFeePct] = useState<number>(1.8)
  const [taxPct, setTaxPct] = useState<number>(18.0)
  const [refundAmount, setRefundAmount] = useState<number>(
    currentException ? Number(currentException.refund_amount || 0) : 0
  )
  const [settlementRecoveryPct, setSettlementRecoveryPct] = useState<number>(100)
  const [settlementTimingDays, setSettlementTimingDays] = useState<number>(1)

  // 3D Scene Active Branch State
  const [active3DBranch, setActive3DBranch] = useState<'current' | 'counterfactual'>('counterfactual')

  // Search filter for queue
  const [queueSearch, setQueueSearch] = useState('')

  // Exception resolution state
  const [resolutionScenario, setResolutionScenario] = useState<ResolutionScenario>('GATEWAY_RECOVERY')
  const [exceptionExplanation, setExceptionExplanation] = useState<ExceptionExplanationType | null>(null)
  const [excLoading, setExcLoading] = useState(false)

  // Phase 5D: Saved Simulations State
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([])
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Fetch user's saved simulations from MongoDB
  const loadSavedSimulations = async () => {
    try {
      setIsLoadingSaved(true)
      const data = await getSavedSimulations()
      setSavedSimulations(data)
    } catch (err) {
      console.warn('Unable to load saved simulations:', err)
    } finally {
      setIsLoadingSaved(false)
    }
  }

  useEffect(() => {
    loadSavedSimulations()
  }, [])

  // Update gross amount when selected exception changes
  useEffect(() => {
    if (currentException) {
      const g = Number(currentException.expected_settlement || currentException.actual_settlement || 10000)
      setGrossAmount(g > 0 ? g : 10000)
      setRefundAmount(Number(currentException.refund_amount || 0))

      // Load deterministic exception explanation
      setExcLoading(true)
      getCounterfactualExplanation(currentException.transaction_id)
        .then((res) => {
          setExceptionExplanation(res)
          setExcLoading(false)
        })
        .catch(() => setExcLoading(false))
    }
  }, [currentException?.transaction_id])

  // Live client calculation (instant response on slider change with zero lag)
  const simulationResult: SimulationResponse = useMemo(() => {
    return calculateLocalSimulation({
      grossAmount,
      currentDiscountPct,
      newDiscountPct,
      feePct,
      taxPct,
      refundAmount,
      settlementRecoveryPct,
      settlementTimingDays,
      transactionId: currentException?.transaction_id || 'TXN_SIMULATION',
    })
  }, [
    grossAmount,
    currentDiscountPct,
    newDiscountPct,
    feePct,
    taxPct,
    refundAmount,
    settlementRecoveryPct,
    settlementTimingDays,
    currentException?.transaction_id,
  ])

  // Filtered queue items
  const filteredQueue = useMemo(() => {
    const q = queueSearch.toLowerCase().trim()
    if (!q) return exceptions
    return exceptions.filter(
      (e) =>
        e.transaction_id.toLowerCase().includes(q) ||
        e.exception_type.toLowerCase().includes(q) ||
        (e.settlement_status || '').toLowerCase().includes(q)
    )
  }, [exceptions, queueSearch])

  // Save current active scenario to MongoDB
  const handleSaveSimulation = async () => {
    setIsSaving(true)
    setSaveStatus(null)
    try {
      const targetTx = currentException?.transaction_id || 'TXN_SIMULATION'
      const timingStr = `T+${settlementTimingDays}`

      await saveSimulationScenario({
        name: `Pricing Model (${newDiscountPct}% Disc, ${timingStr})`,
        transaction_id: targetTx,
        exception_type: currentException?.exception_type || 'COMMERCIAL_PRICING',
        gross_amount: grossAmount,
        current_discount_pct: currentDiscountPct,
        new_discount_pct: newDiscountPct,
        fee_pct: feePct,
        tax_pct: taxPct,
        refund_amount: refundAmount,
        settlement_recovery_pct: settlementRecoveryPct,
        settlement_timing: timingStr,
      })

      setSaveStatus({
        type: 'success',
        message: `Simulation scenario for ${targetTx} saved securely to MongoDB.`,
      })
      await loadSavedSimulations()
      setTimeout(() => setSaveStatus(null), 4000)
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: err?.message || 'Unable to save simulation scenario. Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Delete a saved simulation
  const handleDeleteSimulation = async (id: string) => {
    try {
      await deleteSavedSimulation(id)
      setSavedSimulations((prev) => prev.filter((s) => s.id !== id))
    } catch (err: any) {
      alert(err?.message || 'Unable to remove saved simulation.')
    }
  }

  // Apply saved simulation back to interactive sliders
  const handleApplySaved = (saved: SavedSimulation) => {
    if (saved.scenario) {
      if (saved.baseline?.gross_amount) setGrossAmount(saved.baseline.gross_amount)
      if (saved.scenario.current_discount !== undefined) setCurrentDiscountPct(saved.scenario.current_discount)
      if (saved.scenario.discount !== undefined) setNewDiscountPct(saved.scenario.discount)
      if (saved.scenario.gateway_fee !== undefined) setFeePct(saved.scenario.gateway_fee)
      if (saved.scenario.recovery_percentage !== undefined) setSettlementRecoveryPct(saved.scenario.recovery_percentage)
      if (saved.scenario.settlement_timing) {
        const timingMap: Record<string, number> = { 'T+0': 0, 'T+1': 1, 'T+2': 2 }
        setSettlementTimingDays(timingMap[saved.scenario.settlement_timing] ?? 1)
      }
      setStudioMode('COMMERCIAL_PRICING')
    }
  }

  // Reset variables to baseline
  const handleResetVariables = () => {
    setCurrentDiscountPct(5.0)
    setNewDiscountPct(3.0)
    setFeePct(1.8)
    setTaxPct(18.0)
    setSettlementRecoveryPct(100)
    setSettlementTimingDays(1)
  }

  const sim = simulationResult.simulation
  const expected = Number(currentException?.expected_settlement ?? 0)
  const isDuplicate = currentException?.exception_type === 'DUPLICATE'

  return (
    <div className="space-y-6">
      {/* Hero Workspace Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Decision Intelligence</span>
            <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-500/40 px-2 py-0.5 rounded shadow-2xs">
              Phase 5 Production Verified
            </span>
          </div>
          <h1 className="page-title">Counterfactual Financial Simulation Engine</h1>
          <p className="page-subhead">
            Model the financial consequences of commercial pricing, discount adjustments, and treasury resolution strategies before executing decisions.
          </p>
        </div>

        {/* Multi-Mode Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setStudioMode('COMMERCIAL_PRICING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              studioMode === 'COMMERCIAL_PRICING'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles size={13} className={studioMode === 'COMMERCIAL_PRICING' ? 'text-white' : 'text-indigo-400'} />
            <span>Commercial Pricing Simulator</span>
          </button>

          <button
            onClick={() => setStudioMode('EXCEPTION_RESOLUTION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              studioMode === 'EXCEPTION_RESOLUTION'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wrench size={13} />
            <span>Resolution Strategy</span>
          </button>

          <button
            onClick={() => setStudioMode('SAVED_SCENARIOS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              studioMode === 'SAVED_SCENARIOS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database size={13} className="text-emerald-400" />
            <span>Saved Scenarios ({savedSimulations.length})</span>
          </button>
        </div>
      </div>

      {/* Save Notification Feedback Banner */}
      {saveStatus && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200 ${
            saveStatus.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {saveStatus.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <ShieldCheck size={16} className="text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">{saveStatus.message}</span>
          </div>
          <button
            onClick={() => setSaveStatus(null)}
            className="text-[11px] hover:underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2-Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Transaction / Exception Queue */}
        <div className="lg:col-span-4 card-panel flex flex-col h-[780px]">
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <span>Simulation Target Queue</span>
                <span className="text-xs text-slate-400 font-normal">
                  ({filteredQueue.length} items)
                </span>
              </h3>
            </div>

            <input
              type="text"
              placeholder="Search by transaction ID, exception, status..."
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 p-2 space-y-1">
            {filteredQueue.map((item) => {
              const isSelected = item.transaction_id === currentException?.transaction_id
              const itemDiff = Math.abs(Number(item.difference ?? 0))
              const severity = getExceptionSeverity(item.exception_type)
              const isItemDup = item.exception_type === 'DUPLICATE'

              return (
                <div
                  key={item.transaction_id}
                  onClick={() => onSelectTxId && onSelectTxId(item.transaction_id)}
                  className={`p-3 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30'
                      : 'bg-slate-900/40 border-transparent hover:bg-slate-800/60 hover:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`mono-id font-bold text-xs ${
                        isSelected ? 'text-indigo-300' : 'text-white'
                      }`}
                    >
                      {item.transaction_id}
                    </span>
                    <RiskBadge risk={severity} />
                  </div>

                  <div className="text-xs text-slate-300 font-medium mb-1">
                    {readableException(item.exception_type)}
                    {isItemDup && (
                      <span className="ml-1 text-[10px] text-amber-300 font-bold bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/40">
                        Duplicate Settlement
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/80">
                    <span className="text-slate-400">Expected:</span>
                    <span className="font-bold text-slate-200 tabular-nums">
                      {formatCurrency(item.expected_settlement)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="text-slate-400">Exposure Variance:</span>
                    <span className="font-bold text-rose-400 tabular-nums">
                      {formatCurrency(itemDiff)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Simulation & Decision Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {/* Target Transaction Header Info */}
          <div className="card-panel p-5 bg-slate-900 border border-slate-800 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Active Target Entity
                  </span>
                  <RiskBadge risk={getExceptionSeverity(currentException?.exception_type)} />
                  {isDuplicate && (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded">
                      Duplicate Settlement Identified
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white mono-id">
                  {currentException?.transaction_id}
                </h2>
                <p className="text-xs text-slate-300">
                  Order ID: <strong className="text-white">{currentException?.order_id || 'ORD_2013'}</strong> • Rail:{' '}
                  <strong className="text-white">{currentException?.payment_method || 'CARD'}</strong> • Expected Settlement:{' '}
                  <strong className="text-indigo-300">{formatCurrency(expected)}</strong>
                </p>
              </div>

              <div className="flex flex-col sm:items-end gap-2">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Gross Value</span>
                  <span className="text-2xl font-bold text-white tabular-nums">
                    {formatCurrency(grossAmount)}
                  </span>
                </div>

                {/* Save Scenario Button */}
                <button
                  onClick={handleSaveSimulation}
                  disabled={isSaving}
                  className="btn btn-primary btn-sm mt-1 shadow-md"
                  title="Persist simulation scenario to MongoDB"
                >
                  <BookmarkPlus size={13} className={isSaving ? 'spin' : ''} />
                  <span>{isSaving ? 'Saving to DB...' : 'Save Scenario to MongoDB'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* =========================================================
              MODE 1: COMMERCIAL PRICING SIMULATOR (PHASE 4 PRIMARY)
          ========================================================= */}
          {studioMode === 'COMMERCIAL_PRICING' && (
            <>
              {/* 3D Visual Flow Experience Scene */}
              <CounterfactualScene
                grossAmount={grossAmount}
                currentSettlement={sim.current_state.merchant_settlement}
                counterfactualSettlement={sim.counterfactual_state.merchant_settlement}
                merchantDelta={sim.deltas.merchant_delta}
                activeScenario={active3DBranch}
                onSelectScenario={setActive3DBranch}
              />

              {/* Scenario Controls (Live Sliders) */}
              <ScenarioControls
                grossAmount={grossAmount}
                currentDiscountPct={currentDiscountPct}
                newDiscountPct={newDiscountPct}
                feePct={feePct}
                taxPct={taxPct}
                refundAmount={refundAmount}
                settlementRecoveryPct={settlementRecoveryPct}
                settlementTimingDays={settlementTimingDays}
                onDiscountChange={setNewDiscountPct}
                onFeeChange={setFeePct}
                onRefundChange={setRefundAmount}
                onRecoveryChange={setSettlementRecoveryPct}
                onTimingChange={setSettlementTimingDays}
                onReset={handleResetVariables}
              />

              {/* Side-by-Side Financial Impact */}
              <FinancialImpact simulation={sim} />

              {/* Dynamic Calculated Explanation & Audit Trail */}
              <CounterfactualExplanation simulation={sim} />

              {/* Multi-Scenario Comparison Matrix */}
              <ScenarioComparison
                scenarios={simulationResult.multi_scenarios}
                activeDiscountPct={newDiscountPct}
                onSelectScenarioDiscount={setNewDiscountPct}
              />
            </>
          )}

          {/* =========================================================
              MODE 2: EXCEPTION RESOLUTION STRATEGY (PHASE 2/3)
          ========================================================= */}
          {studioMode === 'EXCEPTION_RESOLUTION' && (
            <div className="space-y-6">
              {/* Resolution Strategy Selector */}
              <div className="card-panel p-5 space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Wrench size={16} className="text-indigo-400" />
                  <span>Treasury Resolution Strategies</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: 'GATEWAY_RECOVERY',
                      title: 'Direct Gateway Recovery',
                      desc: 'Dispatch batch clawback or recovery instruction to processor endpoint',
                      mitigation: '100%',
                    },
                    {
                      id: 'MERCHANT_DEBIT',
                      title: 'Merchant Next-Batch Offset',
                      desc: 'Apply net adjustment against next settlement disbursement batch',
                      mitigation: '100%',
                    },
                    {
                      id: 'REQUERY_WINDOW',
                      title: 'Settlement Window Re-poll',
                      desc: 'Re-query processor ledger for adjacent settlement clearing batch',
                      mitigation: '95%',
                    },
                    {
                      id: 'FEE_CORRECTION',
                      title: 'Fee Schedule Adjustment',
                      desc: 'Recalculate interchange tier deduction and issue credit adjustment',
                      mitigation: '100%',
                    },
                  ].map((st) => (
                    <div
                      key={st.id}
                      onClick={() => setResolutionScenario(st.id as ResolutionScenario)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition ${
                        resolutionScenario === st.id
                          ? 'bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-white">{st.title}</span>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40">
                          {st.mitigation} Recovery
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{st.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exception Counterfactual Narrative Card */}
              {exceptionExplanation && (
                <div className="card-panel p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl shadow-md space-y-3 border border-indigo-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      Deterministic Finding: {exceptionExplanation.title}
                    </span>
                    <span className="text-xs font-bold bg-indigo-900/80 px-2 py-0.5 rounded border border-indigo-700">
                      Confidence: {(exceptionExplanation.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {exceptionExplanation.counterfactual}
                  </p>

                  <div className="p-3 bg-slate-950/80 rounded-lg border border-indigo-900/40 text-xs">
                    <strong className="text-indigo-300 block mb-0.5">Recommended Treasury Action:</strong>
                    <span className="text-slate-300">{exceptionExplanation.recommended_action}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              MODE 3: SAVED SCENARIOS & USER ISOLATION (PHASE 5D)
          ========================================================= */}
          {studioMode === 'SAVED_SCENARIOS' && (
            <div className="card-panel p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-emerald-400" />
                  <h3 className="font-bold text-white text-sm">
                    Persistent Saved Simulations in MongoDB
                  </h3>
                </div>
                <button
                  onClick={loadSavedSimulations}
                  className="btn btn-secondary btn-sm"
                  disabled={isLoadingSaved}
                >
                  <RefreshCw size={12} className={isLoadingSaved ? 'spin text-indigo-400' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              {savedSimulations.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl space-y-3">
                  <BookmarkPlus size={28} className="mx-auto text-slate-500" />
                  <h4 className="text-sm font-bold text-white">No Saved Scenarios Yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Tune commercial discount sliders in the Simulator tab and click &quot;Save Scenario to MongoDB&quot; to persist your models.
                  </p>
                  <button
                    onClick={() => setStudioMode('COMMERCIAL_PRICING')}
                    className="btn btn-primary btn-sm"
                  >
                    <span>Open Commercial Simulator</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedSimulations.map((saved) => {
                    const delta = saved.financial_delta?.merchant_delta ?? 0
                    const timing = saved.scenario?.settlement_timing || 'T+1'
                    const dateFormatted = new Date(saved.created_at).toLocaleString()

                    return (
                      <div
                        key={saved.id}
                        className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700 transition"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{saved.name || 'Pricing Scenario'}</span>
                              <span className="mono-id text-[11px] text-indigo-400 font-semibold">
                                {saved.transaction_id}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                {timing}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Clock size={10} />
                              <span>{dateFormatted}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApplySaved(saved)}
                              className="btn btn-primary btn-sm text-xs py-1"
                            >
                              <span>Apply to Sliders</span>
                            </button>
                            <button
                              onClick={() => handleDeleteSimulation(saved.id)}
                              className="btn btn-secondary btn-sm text-xs py-1 text-rose-400 hover:text-rose-300 hover:border-rose-800"
                              title="Delete scenario"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-900 text-xs">
                          <div className="p-2 bg-slate-900/80 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Gross Value</span>
                            <strong className="text-white tabular-nums">
                              {formatCurrency(saved.baseline?.gross_amount || 0)}
                            </strong>
                          </div>

                          <div className="p-2 bg-slate-900/80 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Simulated Discount</span>
                            <strong className="text-indigo-400 tabular-nums">
                              {saved.scenario?.discount ?? 3}% (from {saved.scenario?.current_discount ?? 5}%)
                            </strong>
                          </div>

                          <div className="p-2 bg-slate-900/80 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Merchant Payout</span>
                            <strong className="text-emerald-400 tabular-nums">
                              {formatCurrency(saved.counterfactual?.merchant_payout || 0)}
                            </strong>
                          </div>

                          <div className="p-2 bg-slate-900/80 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Merchant Delta</span>
                            <strong
                              className={`tabular-nums ${
                                delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {delta >= 0 ? '+' : ''}
                              {formatCurrency(delta)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
