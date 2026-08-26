'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
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
import { MonitoringDashboard } from '@/components/monitoring/MonitoringDashboard'
import { ReportAnalytics } from '@/components/reports/ReportAnalytics'
import { DemoStudioModal } from '@/components/demo/DemoStudioModal'
import { DashboardSkeleton } from '@/components/common/LoadingSkeleton'
import { EmptyState } from '@/components/common/EmptyState'

import {
  RefreshCw,
  Sparkles,
  ArrowRight,
  Activity,
  AlertTriangle,
  BarChart3,
  Layers,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react'

function DashboardApp() {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth()

  const [active, setActive] = useState<NavSection>('Overview')
  const [dashboard, setDashboard] = useState<BackendDashboardResponse | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDemoOpen, setIsDemoOpen] = useState(false)
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

  // Smooth scroll helper
  const scrollToSection = (section: NavSection) => {
    const sectionMap: Record<NavSection, string> = {
      Overview: 'overview',
      Transactions: 'transactions',
      Exceptions: 'exceptions',
      Counterfactuals: 'counterfactuals',
      Monitoring: 'monitoring',
      Reports: 'reports',
    }

    const id = sectionMap[section]
    if (id) {
      const el = document.getElementById(id)
      if (el) {
        const yOffset = -80
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
        window.scrollTo({ top: y, behavior: 'smooth' })

        if (window.history.pushState) {
          window.history.pushState(null, '', `#${id}`)
        }
      }
    }
  }

  // Load backend data
  async function loadData(showSkeleton = true) {
    try {
      if (showSkeleton) setLoading(true)
      else setIsSyncing(true)
      setError(null)

      const [dashboardData, transactionData] = await Promise.all([
        getDashboardData(token || undefined),
        getTransactions(token || undefined),
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
    if (isAuthenticated && token) {
      loadData()
    }
  }, [isAuthenticated, token])

  // Continuous IntersectionObserver to update active navigation state during vertical scroll
  useEffect(() => {
    if (loading || authLoading || !isAuthenticated) return

    const sections: { id: string; section: NavSection }[] = [
      { id: 'overview', section: 'Overview' },
      { id: 'transactions', section: 'Transactions' },
      { id: 'exceptions', section: 'Exceptions' },
      { id: 'counterfactuals', section: 'Counterfactuals' },
      { id: 'monitoring', section: 'Monitoring' },
      { id: 'reports', section: 'Reports' },
    ]

    const observerOptions: IntersectionObserverInit = {
      root: null,
      rootMargin: '-20% 0px -45% 0px',
      threshold: [0.05, 0.2, 0.5],
    }

    const observer = new IntersectionObserver((entries) => {
      const intersecting = entries.filter((e) => e.isIntersecting)
      if (intersecting.length > 0) {
        intersecting.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const topVisible = intersecting[0]
        const match = sections.find((s) => s.id === topVisible.target.id)
        if (match) {
          setActive(match.section)
        }
      }
    }, observerOptions)

    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    // Handle initial URL hash on mount
    const hash = window.location.hash.replace('#', '')
    if (hash) {
      const targetEl = document.getElementById(hash)
      if (targetEl) {
        setTimeout(() => {
          const yOffset = -80
          const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset
          window.scrollTo({ top: y, behavior: 'smooth' })
        }, 250)
      }
    }

    return () => {
      observer.disconnect()
    }
  }, [loading, authLoading, isAuthenticated])

  // Derived metrics
  const metrics = dashboard?.metrics ?? {}
  const exceptions = dashboard?.exceptions ?? []
  const totalExceptions = metrics.exception_records ?? exceptions.length
  const totalRecords = metrics.total_records ?? transactions.length
  const matchRate = metrics.match_rate ?? 0
  const expectedTotal = metrics.expected_total ?? 0
  const actualTotal = metrics.actual_total ?? 0
  const unreconciledAmount = Math.abs(metrics.unreconciled_amount ?? 0)

  // Filtered transactions for Transactions section
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

  // Filtered exceptions for Exceptions section
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
    scrollToSection('Counterfactuals')
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Verifying treasury session...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <AuthScreen />
  }

  const dynamicGreeting = getGreeting(user?.name)

  return (
    <div className="app-shell">
      {/* Sticky Section Navigator Sidebar */}
      <Sidebar
        active={active}
        onNavigate={scrollToSection}
        totalExceptions={totalExceptions}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onOpenDemo={() => setIsDemoOpen(true)}
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
          onOpenDemo={() => setIsDemoOpen(true)}
        />

        {/* Continuous Vertically Scrollable Workspace */}
        <main className="content-container space-y-16">
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
                  SECTION 1: OVERVIEW & SETTLEMENT PERFORMANCE
              ========================================================= */}
              <section id="overview" className="scroll-mt-24 space-y-6">
                {/* Hero Header */}
                <div className="page-header">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="eyebrow">Settlement Operations // Section 01</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    </div>
                    <h1 className="page-title">{dynamicGreeting}</h1>
                    <p className="page-subhead">{settlementHealthSummary}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadData(false)}
                      disabled={isSyncing}
                      className="btn btn-primary"
                    >
                      <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync Engine'}</span>
                    </button>
                  </div>
                </div>

                {/* 4 3D KPI Cards */}
                <div className="kpi-grid">
                  <MetricCard
                    label="Net Settlement Volume"
                    value={formatCurrency(expectedTotal)}
                    subtitle="Total expected receivable batch"
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
                    badgeText="Requires Action"
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
                        scrollToSection('Transactions')
                      }}
                    />
                  </div>
                </div>

                {/* Priority Attention Queue */}
                <AttentionQueue
                  exceptions={exceptions}
                  onInspect={handleOpenException}
                  onSimulate={handleSimulateCounterfactual}
                  onViewAll={() => scrollToSection('Exceptions')}
                />

                {/* Quick Simulation Discovery Banner */}
                <div className="p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-500/30 text-white rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-indigo-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                        Scroll to explore the complete intelligence layers
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">
                      From real-time ledger tracking to 3D counterfactual commercial modeling
                    </h3>
                    <p className="text-xs text-slate-300 max-w-2xl">
                      Scroll continuously through the transactions ledger, exception queue, 3D counterfactual studio, commercial simulator, and executive audit reports below.
                    </p>
                  </div>

                  <button
                    onClick={() => scrollToSection('Counterfactuals')}
                    className="btn btn-primary font-bold text-xs shrink-0"
                  >
                    <span>Jump to 3D Studio</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </section>

              {/* =========================================================
                  SECTION 2: TRANSACTIONS WORKSPACE
              ========================================================= */}
              <section id="transactions" className="scroll-mt-24 pt-10 border-t border-slate-800/80 space-y-6">
                <div className="page-header">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="eyebrow">Ledger Operations // Section 02</span>
                      <Activity size={14} className="text-indigo-400" />
                    </div>
                    <h2 className="page-title text-xl font-bold">Transactions Workspace</h2>
                    <p className="page-subhead">
                      Granular payment ledger across all rails (Card, UPI, Wallet, NetBanking) with verified settlement timestamps.
                    </p>
                  </div>

                  <button
                    onClick={() => loadData(false)}
                    disabled={isSyncing}
                    className="btn btn-secondary btn-sm"
                  >
                    <RefreshCw size={13} className={isSyncing ? 'spin text-indigo-400' : 'text-slate-400'} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Feed'}</span>
                  </button>
                </div>

                {/* Multi-facet Filter Bar */}
                <TransactionFilters
                  filters={filters}
                  setFilters={setFilters}
                  totalCount={transactions.length}
                  filteredCount={filteredTransactions.length}
                />

                {/* Enterprise Ledger Table */}
                <TransactionTable
                  transactions={filteredTransactions}
                  onSelect={handleOpenTransaction}
                  onSimulate={handleSimulateCounterfactual}
                  pageSize={12}
                />
              </section>

              {/* =========================================================
                  SECTION 3: EXCEPTIONS INVESTIGATION QUEUE
              ========================================================= */}
              <section id="exceptions" className="scroll-mt-24 pt-10 border-t border-slate-800/80 space-y-6">
                <div className="page-header">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="eyebrow text-rose-400">Reconciliation Audit // Section 03</span>
                      <AlertTriangle size={14} className="text-rose-400" />
                    </div>
                    <h2 className="page-title text-xl font-bold">Exception Investigation Queue</h2>
                    <p className="page-subhead">
                      {totalExceptions} flagged discrepancy entities requiring operational review, clawback, or timing reconciliation.
                    </p>
                  </div>

                  <button
                    onClick={() => loadData(false)}
                    disabled={isSyncing}
                    className="btn btn-secondary btn-sm"
                  >
                    <RefreshCw size={13} className={isSyncing ? 'spin text-indigo-400' : 'text-slate-400'} />
                    <span>{isSyncing ? 'Syncing...' : 'Sync Exceptions'}</span>
                  </button>
                </div>

                {/* KPI Bar for Exceptions */}
                <div className="kpi-grid">
                  <div className="kpi-card tone-red">
                    <div className="kpi-label">Open Exceptions</div>
                    <div className="kpi-value tabular-nums">{totalExceptions}</div>
                    <div className="kpi-footer">
                      <span className="kpi-badge-negative">Requires Action</span>
                    </div>
                  </div>

                  <div className="kpi-card tone-red">
                    <div className="kpi-label">At-Risk Capital</div>
                    <div className="kpi-value tabular-nums text-rose-400">
                      {formatCurrency(unreconciledAmount)}
                    </div>
                    <div className="kpi-footer">
                      <span className="kpi-badge-negative">Net Discrepancy</span>
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
                      <span className="kpi-badge-neutral">High Priority</span>
                    </div>
                  </div>

                  <div className="kpi-card tone-indigo">
                    <div className="kpi-label">Exception Rate</div>
                    <div className="kpi-value tabular-nums">
                      {(metrics.exception_rate ?? 0).toFixed(1)}%
                    </div>
                    <div className="kpi-footer">
                      <span className="kpi-badge-neutral">Batch Percentage</span>
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
              </section>

              {/* =========================================================
                  SECTION 4: COUNTERFACTUAL STUDIO & COMMERCIAL SIMULATOR
              ========================================================= */}
              <section id="counterfactuals" className="scroll-mt-24 pt-10 border-t border-slate-800/80 space-y-6">
                <div className="page-header">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="eyebrow text-indigo-400">Decision Intelligence // Section 04</span>
                      <Sparkles size={14} className="text-indigo-400" />
                    </div>
                    <h2 className="page-title text-xl font-bold">Counterfactual Studio & 3D Financial Simulator</h2>
                    <p className="page-subhead">
                      Simulate pricing adjustments, commercial discounts, gateway interchange fee variations, and treasury recovery strategies in real time.
                    </p>
                  </div>
                </div>

                <CounterfactualStudio
                  exceptions={exceptions}
                  selectedTxId={counterfactualTargetId}
                  onSelectTxId={setCounterfactualTargetId}
                  onNavigateToTransactions={() => scrollToSection('Transactions')}
                />
              </section>

              {/* =========================================================
                  SECTION 5: CLOSED-LOOP MONITORING & OUTCOME TRACKING
              ========================================================= */}
              <section id="monitoring" className="scroll-mt-24 pt-10 border-t border-slate-800/80 space-y-6">
                <MonitoringDashboard />
              </section>

              {/* =========================================================
                  SECTION 6: EXECUTIVE REPORTS & AUDIT
              ========================================================= */}
              <section id="reports" className="scroll-mt-24 pt-10 border-t border-slate-800/80 space-y-6">
                <div className="page-header">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="eyebrow text-emerald-400">Executive Audit // Section 06</span>
                      <BarChart3 size={14} className="text-emerald-400" />
                    </div>
                    <h2 className="page-title text-xl font-bold">Executive Reports & Audit Trail</h2>
                    <p className="page-subhead">
                      Portfolio reconciliation fidelity, rail settlement quality index, and exportable audit documentation.
                    </p>
                  </div>
                </div>

                <ReportAnalytics
                  metrics={metrics}
                  exceptions={exceptions}
                  transactions={transactions}
                  onRefresh={() => loadData(false)}
                  isSyncing={isSyncing}
                  onNavigateToCounterfactual={() => scrollToSection('Counterfactuals')}
                />
              </section>
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

      {/* Interactive 8-Stage Demo Studio Modal */}
      <DemoStudioModal
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
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