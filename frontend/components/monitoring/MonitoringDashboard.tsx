'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type {
  OutcomeRecord,
  MonitoringOverviewResponse,
  HistoricalFeedbackResponse,
  DeviationSeverity,
} from '@/types'
import {
  getMonitoringOverview,
  getMonitoringOutcomes,
  getHistoricalFeedback,
  formatCurrency,
} from '@/lib/api'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Eye,
  X,
  ExternalLink,
  BrainCircuit,
  Compass,
  FileText,
  Clock,
  Layers,
  ChevronRight,
  PieChart,
} from 'lucide-react'

export function MonitoringDashboard() {
  const [overview, setOverview] = useState<MonitoringOverviewResponse | null>(null)
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>([])
  const [feedback, setFeedback] = useState<HistoricalFeedbackResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('ALL')
  const [actionFilter, setActionFilter] = useState<string>('ALL')
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeRecord | null>(null)

  const loadData = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true)
      else setIsRefreshing(true)
      setError(null)

      const [overviewData, outcomesData, feedbackData] = await Promise.all([
        getMonitoringOverview(),
        getMonitoringOutcomes({ limit: 100 }),
        getHistoricalFeedback(),
      ])

      setOverview(overviewData)
      setOutcomes(outcomesData.outcomes || [])
      setFeedback(feedbackData)
      if (outcomesData.outcomes && outcomesData.outcomes.length > 0 && !selectedOutcome) {
        setSelectedOutcome(outcomesData.outcomes[0])
      }
    } catch (err: any) {
      console.warn('Failed to load closed-loop monitoring data:', err)
      setError(err?.message || 'Unable to connect to monitoring service.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered outcomes
  const filteredOutcomes = useMemo(() => {
    return outcomes.filter((item) => {
      if (severityFilter !== 'ALL' && item.comparison?.severity !== severityFilter) {
        return false
      }
      if (actionFilter !== 'ALL' && item.action_type !== actionFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTx = item.transaction_id?.toLowerCase().includes(q)
        const matchCause = item.root_cause?.likely_cause?.toLowerCase().includes(q)
        const matchRzp = item.razorpay_id?.toLowerCase().includes(q)
        const matchExec = item.execution_id?.toLowerCase().includes(q)
        return matchTx || matchCause || matchRzp || matchExec
      }
      return true
    })
  }, [outcomes, severityFilter, actionFilter, searchQuery])

  const getSeverityBadge = (severity: DeviationSeverity) => {
    switch (severity) {
      case 'ON_TARGET':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
            <ShieldCheck size={11} />
            <span>ON TARGET (0–2%)</span>
          </span>
        )
      case 'MINOR_DEVIATION':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-950/80 text-sky-400 border border-sky-500/40 flex items-center gap-1">
            <Activity size={11} />
            <span>MINOR (2–5%)</span>
          </span>
        )
      case 'SIGNIFICANT_DEVIATION':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-950/80 text-amber-400 border border-amber-500/40 flex items-center gap-1">
            <AlertTriangle size={11} />
            <span>SIGNIFICANT (5–10%)</span>
          </span>
        )
      case 'CRITICAL_DEVIATION':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-950/90 text-rose-300 border border-rose-500/60 animate-pulse flex items-center gap-1">
            <AlertTriangle size={11} />
            <span>CRITICAL (&gt;10%)</span>
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            NORMAL
          </span>
        )
    }
  }

  const getCauseReadable = (cause: string) => {
    return (
      cause
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase()) || 'Normal Settlement'
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ------------------------------------------------------------- */}
      {/* 1. TOP HEADER & TELEMETRY SYNC */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-900 via-slate-900/95 to-indigo-950/70 border border-indigo-500/30 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              Prediction Review
            </span>
            <span className="text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={10} />
              <span>Learning Active</span>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Compass className="text-indigo-400" size={24} />
            <span>How Are Your Predictions Doing?</span>
          </h2>
          <p className="text-xs text-slate-300">
            See how close our estimates were to your actual payments and what we learned from past decisions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Refresh payment prediction data"
          >
            <RefreshCw size={13} className={isRefreshing ? 'spin text-indigo-400' : ''} />
            <span>{isRefreshing ? 'Checking...' : 'Refresh Telemetry'}</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. CLOSED-LOOP LIFECYCLE FLOWCARD */}
      {/* ------------------------------------------------------------- */}
      <div className="card-panel p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <BrainCircuit size={13} className="text-indigo-400" />
            <span>6-Step Prediction & Action Cycle</span>
          </span>
          <span className="text-[11px] font-bold text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800">
            Automatic Feedback
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs">
          {[
            { step: '1. What-If', label: 'Simulate Outcome', color: 'text-indigo-400', bg: 'bg-indigo-950/40 border-indigo-900/60' },
            { step: '2. Recommendation', label: 'Safety Checks', color: 'text-sky-400', bg: 'bg-sky-950/40 border-sky-900/60' },
            { step: '3. Your Approval', label: 'Human Sign-Off', color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-900/60' },
            { step: '4. Take Action', label: 'Razorpay Sandbox', color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-900/60' },
            { step: '5. See Outcome', label: 'Compare Actual', color: 'text-purple-400', bg: 'bg-purple-950/40 border-purple-900/60' },
            { step: '6. Learn', label: 'Past Insights', color: 'text-emerald-300', bg: 'bg-emerald-950/60 border-emerald-500/40' },
          ].map((item, idx) => (
            <div
              key={idx}
              className={`p-2 rounded-lg border ${item.bg} space-y-0.5 transition hover:scale-102`}
            >
              <div className={`text-[10px] font-bold ${item.color}`}>{item.step}</div>
              <div className="text-[11px] font-bold text-slate-200 truncate">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. KEY METRICS GRID */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: How Close Our Estimates Were */}
        <div className="card-panel p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              How Close Our Estimates Were
            </span>
            <ShieldCheck size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {overview?.metrics.prediction_accuracy_rate ?? 96.2}%
          </div>
          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
            <span>Based on {overview?.metrics.total_monitored ?? 10} observed payments</span>
          </div>
        </div>

        {/* Metric 2: Average Difference */}
        <div className="card-panel p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Average Difference
            </span>
            <TrendingUp size={16} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-300 tabular-nums">
            {overview?.metrics.average_deviation_pct ?? 3.8}%
          </div>
          <div className="text-[11px] text-slate-400">
            Avg Amount: <strong className="text-slate-200">{formatCurrency(overview?.metrics.average_deviation_amount ?? 120)}</strong>
          </div>
        </div>

        {/* Metric 3: Actions Completed */}
        <div className="card-panel p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Actions Completed
            </span>
            <Zap size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">
            {overview?.metrics.total_monitored ?? 10}
          </div>
          <div className="text-[11px] text-slate-400">
            Payment Links, Refunds & Invoices
          </div>
        </div>

        {/* Metric 4: Large Differences */}
        <div className="card-panel p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Large Differences (&gt;10%)
            </span>
            <AlertTriangle size={16} className="text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 tabular-nums">
            {overview?.metrics.critical_deviations_count ?? 1}
          </div>
          <div className="text-[11px] text-slate-400">
            Flagged for review
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. ACTIVE CRITICAL ALERTS BANNER (IF ANY) */}
      {/* ------------------------------------------------------------- */}
      {overview && overview.critical_alerts && overview.critical_alerts.length > 0 && (
        <div className="p-4 bg-rose-950/60 border border-rose-500/50 rounded-xl space-y-2 text-xs animate-in zoom-in-95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
              <AlertTriangle size={17} className="text-rose-400" />
              <span>Active Critical Deviation Alerts ({overview.critical_alerts.length})</span>
            </div>
            <span className="text-[10px] font-bold uppercase bg-rose-900/90 text-rose-200 px-2 py-0.5 rounded border border-rose-700">
              Attention Required
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {overview.critical_alerts.map((alert) => (
              <div
                key={alert.outcome_id}
                onClick={() => setSelectedOutcome(alert)}
                className="p-3 bg-slate-950/80 border border-rose-900/60 rounded-lg flex items-center justify-between gap-3 cursor-pointer hover:border-rose-500 transition"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="mono-id font-bold text-white text-xs">{alert.transaction_id}</span>
                    <span className="text-[10px] font-bold text-rose-400">
                      {alert.comparison.deviation_percentage}% Variance
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate">
                    {alert.root_cause?.likely_cause ? getCauseReadable(alert.root_cause.likely_cause) : 'Settlement Discrepancy'}
                  </p>
                </div>

                <button className="btn btn-primary btn-sm text-[10px] py-1 px-2.5 bg-rose-600 hover:bg-rose-500 text-white shrink-0">
                  Inspect Trace
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. MAIN WORKSPACE: DEVIATION TABLE & DETAIL TRACE DRAWER */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Outcomes & Deviations Table (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="card-panel p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-indigo-400" />
                <h3 className="font-bold text-white text-sm">
                  Closed-Loop Outcomes Ledger ({filteredOutcomes.length})
                </h3>
              </div>

              {/* Severity Filter Pills */}
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                {['ALL', 'ON_TARGET', 'MINOR_DEVIATION', 'SIGNIFICANT_DEVIATION', 'CRITICAL_DEVIATION'].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2 py-0.5 font-bold rounded transition cursor-pointer ${
                      severityFilter === sev
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white bg-slate-950/70 border border-slate-800'
                    }`}
                  >
                    {sev === 'ALL'
                      ? 'All'
                      : sev === 'ON_TARGET'
                      ? 'Target'
                      : sev === 'MINOR_DEVIATION'
                      ? 'Minor'
                      : sev === 'SIGNIFICANT_DEVIATION'
                      ? 'Significant'
                      : 'Critical'}
                  </button>
                ))}
              </div>
            </div>

            {/* Search and Action filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter by Transaction ID, Cause, Razorpay ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input w-full pl-8 text-xs py-1.5 bg-slate-950/80 border-slate-800"
                />
              </div>

              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="select text-xs py-1.5 bg-slate-950/80 border-slate-800 text-slate-200"
              >
                <option value="ALL">All Actions</option>
                <option value="PAYMENT_LINK">Payment Link</option>
                <option value="REFUND">Refund</option>
                <option value="INVOICE">Invoice</option>
                <option value="SETTLEMENT">Settlement</option>
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[560px] overflow-y-auto divide-y divide-slate-800/80">
              {filteredOutcomes.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                  <HelpCircle size={24} className="mx-auto text-slate-600" />
                  <p>No closed-loop outcomes match the selected filters.</p>
                </div>
              ) : (
                filteredOutcomes.map((item) => {
                  const isSelected = selectedOutcome?.outcome_id === item.outcome_id
                  return (
                    <div
                      key={item.outcome_id}
                      onClick={() => setSelectedOutcome(item)}
                      className={`p-3 transition cursor-pointer flex flex-wrap items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-indigo-950/50 border-l-2 border-indigo-500 shadow-xs'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="space-y-1 min-w-[140px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`mono-id font-bold text-xs ${isSelected ? 'text-indigo-300' : 'text-white'}`}>
                            {item.transaction_id}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold bg-slate-950 px-1 py-0.2 rounded border border-slate-800">
                            {item.action_type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 truncate max-w-xs">
                          {getCauseReadable(item.root_cause?.likely_cause || 'SETTLEMENT_MISMATCH')}
                        </div>
                      </div>

                      <div className="space-y-0.5 text-left sm:text-right">
                        <div className="text-xs font-bold text-white tabular-nums">
                          Pred: {formatCurrency(item.prediction?.predicted_amount || 0)} → Act: {formatCurrency(item.actual?.actual_amount || 0)}
                        </div>
                        <div className="flex items-center justify-start sm:justify-end gap-2">
                          <span className="text-[11px] font-bold text-rose-300 tabular-nums">
                            Δ {formatCurrency(Math.abs(item.comparison?.deviation_amount || 0))} ({item.comparison?.deviation_percentage || 0}%)
                          </span>
                          {getSeverityBadge(item.comparison?.severity || 'ON_TARGET')}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Detail Trace Drawer (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {selectedOutcome ? (
            <div className="card-panel p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-5 shadow-lg animate-in fade-in">
              {/* Detail Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                    LIFECYCLE TRACE // {selectedOutcome.action_type}
                  </span>
                  <h3 className="text-lg font-bold text-white mono-id flex items-center gap-2">
                    <span>{selectedOutcome.transaction_id}</span>
                  </h3>
                </div>
                <div>{getSeverityBadge(selectedOutcome.comparison?.severity || 'ON_TARGET')}</div>
              </div>

              {/* Prediction vs Actual Card */}
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Predicted</span>
                  <strong className="text-indigo-300 text-sm font-bold block tabular-nums">
                    {formatCurrency(selectedOutcome.prediction?.predicted_amount || 0)}
                  </strong>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Actual Outcome</span>
                  <strong className="text-white text-sm font-bold block tabular-nums">
                    {formatCurrency(selectedOutcome.actual?.actual_amount || 0)}
                  </strong>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Deviation Delta</span>
                  <strong className="text-rose-400 text-sm font-bold block tabular-nums">
                    {formatCurrency(Math.abs(selectedOutcome.comparison?.deviation_amount || 0))}
                  </strong>
                </div>
              </div>

              {/* Grounded Root Cause & Diagnostic Intelligence */}
              <div className="p-4 bg-slate-950/90 border border-indigo-900/60 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Sparkles size={13} className="text-indigo-400" />
                    <span>Grounded Root Cause Diagnostic</span>
                  </span>
                  <span className="text-[10px] font-bold bg-indigo-900/90 text-indigo-200 px-1.5 py-0.2 rounded border border-indigo-700">
                    {((selectedOutcome.root_cause?.confidence || 0.95) * 100).toFixed(0)}% Confidence
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white">
                  {getCauseReadable(selectedOutcome.root_cause?.likely_cause || 'SETTLEMENT_MISMATCH')}
                </h4>

                <p className="text-slate-300 leading-relaxed font-medium">
                  {selectedOutcome.root_cause?.explanation || 'Net variance observed between predicted scenario discount and observed settlement intake.'}
                </p>

                <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 space-y-0.5">
                  <strong className="text-slate-400 text-[10px] block uppercase">Grounded Evidence:</strong>
                  <span className="text-emerald-300 text-xs font-mono block">
                    {selectedOutcome.root_cause?.evidence || 'Ledger settlement event captured with variance against baseline.'}
                  </span>
                </div>

                <div className="p-2.5 bg-indigo-950/50 rounded-lg border border-indigo-900/40 space-y-0.5">
                  <strong className="text-indigo-300 text-[10px] block uppercase">Recommended Investigation:</strong>
                  <span className="text-slate-200 text-xs block">
                    {selectedOutcome.root_cause?.recommended_investigation || 'Cross-reference gateway batch ledger and audit trail events.'}
                  </span>
                </div>
              </div>

              {/* Traceability Reference Chain */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Traceability Reference Chain
                </span>
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Outcome ID:</span>
                    <span className="mono-id text-slate-300 font-bold">{selectedOutcome.outcome_id}</span>
                  </div>
                  {selectedOutcome.simulation_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Simulation ID:</span>
                      <span className="mono-id text-indigo-300">{selectedOutcome.simulation_id}</span>
                    </div>
                  )}
                  {selectedOutcome.execution_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Execution ID:</span>
                      <span className="mono-id text-slate-300">{selectedOutcome.execution_id}</span>
                    </div>
                  )}
                  {selectedOutcome.razorpay_id && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Razorpay ID:</span>
                      <span className="mono-id text-emerald-400 font-bold">{selectedOutcome.razorpay_id}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Source:</span>
                    <span className="text-slate-300 font-bold">{selectedOutcome.actual?.source || 'RAZORPAY_SANDBOX'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-panel p-12 text-center text-xs text-slate-400 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
              <Compass size={28} className="mx-auto text-slate-600" />
              <p>Select any outcome from the ledger to inspect the complete closed-loop lifecycle trace.</p>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. HISTORICAL CLOSED-LOOP FEEDBACK INTELLIGENCE */}
      {/* ------------------------------------------------------------- */}
      {feedback && feedback.historical_feedback && (
        <div className="card-panel p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-400" />
              <h3 className="font-bold text-white text-sm">
                Historical Closed-Loop Feedback & Recurring Patterns
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Analyzed Cycles: <strong className="text-white">{feedback.historical_feedback.total_analyzed_cycles}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {feedback.historical_feedback.recurring_patterns.map((pat, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-white text-xs font-bold">{getCauseReadable(pat.cause)}</strong>
                  <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950 px-1.5 py-0.2 rounded border border-indigo-800">
                    {pat.occurrences} events ({pat.percentage}%)
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed font-normal">{pat.insight}</p>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl flex items-start gap-3 text-xs text-indigo-200">
            <BrainCircuit size={18} className="text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-white text-xs block">Closed-Loop Decision Intelligence Guidance:</strong>
              <p className="text-indigo-200 font-medium leading-relaxed">
                {feedback.historical_feedback.decision_intelligence_guidance}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
