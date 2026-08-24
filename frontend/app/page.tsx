'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type {
  NavSection,
  Transaction,
  BackendDashboardResponse,
  BackendException,
  TransactionFilters as FilterType,
} from '@/types'
import {
  getDashboardData,
  getTransactions,
  formatCurrency,
  formatCompactCurrency,
  readableException,
} from '@/lib/api'
import { AuthProvider, useAuth, getGreeting } from '@/lib/auth-context'
import { AuthScreen } from '@/components/auth/AuthScreen'

import { Sidebar } from '@/components/layout/Sidebar'
import { TopHeader } from '@/components/layout/TopHeader'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { SettlementChart } from '@/components/dashboard/SettlementChart'
import { ExceptionBreakdown } from '@/components/dashboard/ExceptionBreakdown'
import { AttentionQueue } from '@/components/dashboard/AttentionQueue'
import { TransactionFilters } from '@/components/transactions/TransactionFilters'
import { TransactionTable } from '@/components/transactions/TransactionTable'
import { TransactionDrawer } from '@/components/transactions/TransactionDrawer'
import { CounterfactualStudio } from '@/components/counterfactual/CounterfactualStudio'
import { ReportAnalytics } from '@/components/reports/ReportAnalytics'
import { DashboardSkeleton } from '@/components/common/LoadingSkeleton'
import { EmptyState } from '@/components/common/EmptyState'

import {
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react'

function DashboardApp() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  const [active, setActive] = useState<NavSection>('Overview')
  const [dashboard, setDashboard] = useState<BackendDashboardResponse | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Drawer & Selection state
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [counterfactualTargetId, setCounterfactualTargetId] = useState<string | undefined>()

  // Search & Filter state
  const [globalQuery, setGlobalQuery] = useState('')
  const [filters, setFilters] = useState<FilterType>({
    query: '',
    status: 'ALL',
    risk: 'ALL',
    exceptionType: 'ALL',
    rail: 'ALL',
  })

  // Load backend data
  async function loadData(showSkeleton = true) {
    try {
      if (showSkeleton) setLoading(true)
      else setIsSyncing(true)
      setError(null)

      const [dashboardData, transactionData] = await Promise.all([
        getDashboardData(),
        getTransactions(),
      ])

      setDashboard(dashboardData)
      setTransactions(transactionData)
    } catch (err) {
      console.error('Failed to load settlement data:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to connect to reconciliation engine'
      )
    } finally {
      setLoading(false)
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadData()
    }
  }, [isAuthenticated])

  // Derived metrics
  const metrics = dashboard?.metrics ?? {}
  const exceptions = dashboard?.exceptions ?? []
  const totalExceptions = metrics.exception_records ?? exceptions.length
  const totalRecords = metrics.total_records ?? transactions.length
  const matchRate = metrics.match_rate ?? 0
  const expectedTotal = metrics.expected_total ?? 0
  const actualTotal = metrics.actual_total ?? 0
  const unreconciledAmount = Math.abs(metrics.unreconciled_amount ?? 0)

  // Filtered transactions for Transactions tab
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const q = (filters.query || globalQuery).toLowerCase().trim()
      if (q) {
        const searchable = `${t.id} ${t.orderId || ''} ${t.counterparty} ${t.rail} ${
          t.reason
        } ${t.exceptionType || ''} ${t.settlementStatus || ''}`.toLowerCase()
        if (!searchable.includes(q)) return false
      }

      if (filters.status !== 'ALL') {
        if (filters.status === 'Reconciled' && t.status !== 'Reconciled') return false
        if (filters.status === 'Exception' && t.status !== 'Exception') return false
      }

      if (filters.risk !== 'ALL' && t.risk !== filters.risk) {
        return false
      }

      if (
        filters.exceptionType !== 'ALL' &&
        t.exceptionType !== filters.exceptionType
      ) {
        return false
      }

      if (filters.rail !== 'ALL' && t.rail !== filters.rail) {
        return false
      }

      return true
    })
  }, [transactions, filters, globalQuery])

  // Filtered exceptions for Exceptions tab
  const filteredExceptionsList = useMemo(() => {
    return transactions.filter((t) => {
      if (t.status !== 'Exception') return false
      const q = globalQuery.toLowerCase().trim()
      if (q) {
        const searchable = `${t.id} ${t.orderId || ''} ${t.rail} ${t.reason} ${
          t.exceptionType || ''
        }`.toLowerCase()
        if (!searchable.includes(q)) return false
      }
      return true
    })
  }, [transactions, globalQuery])

  // Handlers
  const handleOpenTransaction = (tx: Transaction) => {
    setSelectedTransaction(tx)
  }

  const handleOpenException = (exc: BackendException) => {
    const fullTx = transactions.find((t) => t.id === exc.transaction_id)
    if (fullTx) {
      setSelectedTransaction(fullTx)
    } else {
      // Synthesize transaction record if not found
      setSelectedTransaction({
        id: exc.transaction_id,
        amount: formatCurrency(exc.actual_settlement),
        expectedAmount: exc.expected_settlement,
        actualAmount: exc.actual_settlement,
        difference: exc.difference,
        refundAmount: exc.refund_amount,
        fee: exc.fee,
        tax: exc.tax,
        counterparty: `${exc.payment_method || 'Payment'} Processor`,
        rail: exc.payment_method || 'CARD',
        status: 'Exception',
        reason: readableException(exc.exception_type),
        date: exc.payment_date || 'Today',
        paymentDate: exc.payment_date,
        settlementDate: exc.settlement_date,
        risk: exc.exception_type === 'DUPLICATE' || exc.exception_type === 'MISSING_SETTLEMENT' ? 'High' : 'Medium',
        exceptionType: exc.exception_type,
        settlementStatus: exc.settlement_status,
      })
    }
  }

  const handleSimulateCounterfactual = (transactionId: string) => {
    setCounterfactualTargetId(transactionId)
    setActive('Counterfactuals')
  }

  // Dynamic settlement status health summary for Overview
  const settlementHealthSummary = useMemo(() => {
    if (matchRate >= 90) {
      return `Settlement health is optimal — ${matchRate.toFixed(1)}% match rate across ${totalRecords} records.`
    }
    if (matchRate >= 50) {
      return `Settlement health is stable — ${matchRate.toFixed(1)}% match rate with ${formatCurrency(unreconciledAmount)} at-risk capital across ${totalExceptions} items requiring action.`
    }
    return `Settlement attention required — ${totalExceptions} exceptions identified representing ${formatCurrency(unreconciledAmount)} financial exposure.`
  }, [matchRate, totalRecords, unreconciledAmount, totalExceptions])

  // If authenticating, show clean loading skeleton
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Verifying treasury session...</p>
        </div>
      </div>
    )
  }

  // If unauthenticated, show enterprise Login / Signup screen
  if (!isAuthenticated || !user) {
    return <AuthScreen />
  }

  const dynamicGreeting = getGreeting(user?.name)

  return (
    <div className="app-shell">
      {/* Persistent Enterprise Sidebar */}
      <Sidebar
        active={active}
        setActive={(s) => {
          setActive(s)
          setGlobalQuery('')
        }}
        totalExceptions={totalExceptions}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="main-wrapper">
        {/* Top Command & Search Bar */}
        <TopHeader
          active={active}
          query={globalQuery}
          setQuery={setGlobalQuery}
          onSync={() => loadData(false)}
          isSyncing={isSyncing}
          onOpenMobile={() => setMobileOpen(true)}
        />

        {/* Main Content Workspace */}
        <main className="content-container">
          {loading ? (
            <DashboardSkeleton />
          ) : error ? (
            <EmptyState
              type="error"
              title="Unable to connect to reconciliation engine"
              description={error}
              actionLabel="Retry Connection"
              onAction={() => loadData(true)}
            />
          ) : (
            <>
              {/* =========================================================
                  TAB 1: OVERVIEW
              ========================================================= */}
              {active === 'Overview' && (
                <div className="space-y-6">
                  {/* Hero Header */}
                  <div className="page-header">
                    <div>
                      <span className="eyebrow">Settlement Operations</span>
                      <h1 className="page-title">{dynamicGreeting}</h1>
                      <p className="page-subhead">{settlementHealthSummary}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadData(false)}
                        disabled={isSyncing}
                        className="btn btn-primary"
                      >
                        <RefreshCw size={15} className={isSyncing ? 'spin' : ''} />
                        <span>{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 Enterprise KPI Cards */}
                  <div className="kpi-grid">
                    <MetricCard
                      label="Net Settlement Volume"
                      value={formatCurrency(expectedTotal)}
                      subtitle="Total expected settlement volume"
                      badgeText="Live Engine Feed"
                      badgeTone="positive"
                      tone="indigo"
                      tooltip="Total expected settlement calculated from all processed transactions"
                    />

                    <MetricCard
                      label="Reconciliation Rate"
                      value={`${matchRate.toFixed(1)}%`}
                      subtitle={`${metrics.matched_records ?? 0} of ${totalRecords} matched`}
                      badgeText="Batch Reconciled"
                      badgeTone="positive"
                      tone="green"
                      tooltip="Percentage of transactions matching expected bank settlement"
                    />

                    <MetricCard
                      label="Open Exceptions"
                      value={String(totalExceptions)}
                      subtitle="Items requiring resolution"
                      badgeText="Requires Attention"
                      badgeTone="negative"
                      tone="amber"
                      tooltip="Transactions with missing, delayed, duplicate, or fee discrepancies"
                    />

                    <MetricCard
                      label="At-Risk Capital"
                      value={formatCurrency(unreconciledAmount)}
                      subtitle="Cumulative variance exposure"
                      badgeText="Unreconciled"
                      badgeTone="negative"
                      tone="red"
                      tooltip="Net financial exposure across all unmatched records"
                    />
                  </div>

                  {/* Chart + Exception Breakdown Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7">
                      <SettlementChart
                        transactions={transactions}
                        expectedTotal={expectedTotal}
                        actualTotal={actualTotal}
                        unreconciledAmount={unreconciledAmount}
                      />
                    </div>

                    <div className="lg:col-span-5">
                      <ExceptionBreakdown
                        exceptions={exceptions}
                        totalExceptions={totalExceptions}
                        onSelectType={(type) => {
                          setFilters((prev) => ({ ...prev, exceptionType: type, status: 'Exception' }))
                          setActive('Transactions')
                        }}
                      />
                    </div>
                  </div>

                  {/* What Needs Attention Queue */}
                  <AttentionQueue
                    exceptions={exceptions}
                    onInspect={handleOpenException}
                    onSimulate={handleSimulateCounterfactual}
                    onViewAll={() => setActive('Exceptions')}
                  />

                  {/* Counterfactual Callout Banner */}
                  <div className="p-6 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-indigo-300" />
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                          AI Counterfactual Intelligence
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">
                        Understand the financial consequences of every resolution decision
                      </h3>
                      <p className="text-xs text-slate-300 max-w-xl">
                        Simulate gateway batch recoveries, excess duplicate clawbacks, and timing reconciliations with deterministic AI explanations.
                      </p>
                    </div>

                    <button
                      onClick={() => setActive('Counterfactuals')}
                      className="btn bg-white text-indigo-900 hover:bg-indigo-50 border-none font-bold text-xs shrink-0"
                    >
                      <span>Open Counterfactual Studio</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* =========================================================
                  TAB 2: TRANSACTIONS
              ========================================================= */}
              {active === 'Transactions' && (
                <div className="space-y-6">
                  <div className="page-header">
                    <div>
                      <span className="eyebrow">Ledger Operations</span>
                      <h1 className="page-title">Transactions Workspace</h1>
                      <p className="page-subhead">
                        Inspect all payment rails, verify expected amounts, and track settlement credits.
                      </p>
                    </div>

                    <button
                      onClick={() => loadData(false)}
                      disabled={isSyncing}
                      className="btn btn-primary"
                    >
                      <RefreshCw size={15} className={isSyncing ? 'spin' : ''} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync Engine'}</span>
                    </button>
                  </div>

                  {/* Multi-facet Filter Bar */}
                  <TransactionFilters
                    filters={filters}
                    setFilters={setFilters}
                    totalCount={transactions.length}
                    filteredCount={filteredTransactions.length}
                  />

                  {/* Enterprise Table */}
                  <TransactionTable
                    transactions={filteredTransactions}
                    onSelect={handleOpenTransaction}
                    onSimulate={handleSimulateCounterfactual}
                    pageSize={12}
                  />
                </div>
              )}

              {/* =========================================================
                  TAB 3: EXCEPTIONS
              ========================================================= */}
              {active === 'Exceptions' && (
                <div className="space-y-6">
                  <div className="page-header">
                    <div>
                      <span className="eyebrow">Reconciliation Exceptions</span>
                      <h1 className="page-title">Exception Queue</h1>
                      <p className="page-subhead">
                        {totalExceptions} transactions with identified discrepancies requiring treasury operator review.
                      </p>
                    </div>

                    <button
                      onClick={() => loadData(false)}
                      disabled={isSyncing}
                      className="btn btn-primary"
                    >
                      <RefreshCw size={15} className={isSyncing ? 'spin' : ''} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync Engine'}</span>
                    </button>
                  </div>

                  {/* KPI Bar for Exceptions */}
                  <div className="kpi-grid">
                    <div className="kpi-card tone-red">
                      <div className="kpi-label">Open Exceptions</div>
                      <div className="kpi-value tabular-nums">{totalExceptions}</div>
                      <div className="kpi-footer">
                        <span className="kpi-badge-negative">
                          Requires Action
                        </span>
                      </div>
                    </div>

                    <div className="kpi-card tone-red">
                      <div className="kpi-label">At-Risk Capital</div>
                      <div className="kpi-value tabular-nums text-rose-600">
                        {formatCurrency(unreconciledAmount)}
                      </div>
                      <div className="kpi-footer">
                        <span className="kpi-badge-negative">Net discrepancy</span>
                      </div>
                    </div>

                    <div className="kpi-card tone-amber">
                      <div className="kpi-label">High Severity Items</div>
                      <div className="kpi-value tabular-nums">
                        {
                          exceptions.filter(
                            (e) =>
                              e.exception_type === 'MISSING_SETTLEMENT' ||
                              e.exception_type === 'DUPLICATE' ||
                              e.exception_type === 'DELAYED_SETTLEMENT'
                          ).length
                        }
                      </div>
                      <div className="kpi-footer">
                        <span className="kpi-badge-neutral">High priority</span>
                      </div>
                    </div>

                    <div className="kpi-card tone-indigo">
                      <div className="kpi-label">Exception Rate</div>
                      <div className="kpi-value tabular-nums">
                        {(metrics.exception_rate ?? 0).toFixed(1)}%
                      </div>
                      <div className="kpi-footer">
                        <span className="kpi-badge-neutral">Of total batch volume</span>
                      </div>
                    </div>
                  </div>

                  {/* Exception Table */}
                  <TransactionTable
                    transactions={filteredExceptionsList}
                    onSelect={handleOpenTransaction}
                    onSimulate={handleSimulateCounterfactual}
                    pageSize={12}
                  />
                </div>
              )}

              {/* =========================================================
                  TAB 4: COUNTERFACTUALS (HERO FEATURE)
              ========================================================= */}
              {active === 'Counterfactuals' && (
                <CounterfactualStudio
                  exceptions={exceptions}
                  selectedTxId={counterfactualTargetId}
                  onSelectTxId={setCounterfactualTargetId}
                  onNavigateToTransactions={() => setActive('Transactions')}
                />
              )}

              {/* =========================================================
                  TAB 5: REPORTS & AUDIT
              ========================================================= */}
              {active === 'Reports' && (
                <ReportAnalytics
                  metrics={metrics}
                  exceptions={exceptions}
                  transactions={transactions}
                  onRefresh={() => loadData(false)}
                  isSyncing={isSyncing}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Slide-out Financial Investigation Drawer */}
      <TransactionDrawer
        transaction={selectedTransaction}
        open={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onOpenCounterfactual={handleSimulateCounterfactual}
      />
    </div>
  )
}

export default function Page() {
  return (
    <AuthProvider>
      <DashboardApp />
    </AuthProvider>
  )
}