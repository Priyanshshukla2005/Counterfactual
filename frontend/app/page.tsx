'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Transaction } from '@/types'

import {
  getTransactions,
  getDashboardData,
  type BackendException,
  type BackendDashboardResponse,
} from '@/lib/api'

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Database,
  Filter,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'


/* =========================================================
   HELPERS
========================================================= */

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function formatCompactCurrency(value: number) {
  const amount = Number(value) || 0

  if (Math.abs(amount) >= 1_000_000) {
    return `₹${(amount / 1_000_000).toFixed(2)}M`
  }

  if (Math.abs(amount) >= 1_000) {
    return `₹${(amount / 1_000).toFixed(1)}K`
  }

  return formatCurrency(amount)
}

function readableException(type: string) {
  switch (type) {
    case 'DUPLICATE':
      return 'Duplicate settlement'

    case 'MISSING_SETTLEMENT':
      return 'Missing settlement'

    case 'DELAYED_SETTLEMENT':
      return 'Delayed settlement'

    case 'PARTIAL_REFUND':
      return 'Partial refund'

    case 'FEE_MISMATCH':
      return 'Fee mismatch'

    default:
      return type
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
  }
}

function transactionAmount(transaction: Transaction) {
  const value = (transaction as any).actualAmount

  if (typeof value === 'number') {
    return value
  }

  const amount = (transaction as any).amount

  if (typeof amount === 'number') {
    return amount
  }

  if (typeof amount === 'string') {
    const parsed = Number(
      amount.replace(/[₹$,]/g, '').trim()
    )

    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function transactionExpectedAmount(transaction: Transaction) {
  const value = (transaction as any).expectedAmount

  return typeof value === 'number'
    ? value
    : transactionAmount(transaction)
}


/* =========================================================
   STATUS
========================================================= */

function Status({
  children,
}: {
  children: string
}) {
  const value = children.toLowerCase()

  const tone =
    value === 'reconciled'
      ? 'success'
      : value === 'missing' ||
          value === 'exception'
        ? 'danger'
        : 'warning'

  return (
    <span className={`status ${tone}`}>
      {children}
    </span>
  )
}


/* =========================================================
   MINI CHART
========================================================= */

function MiniBars({
  exceptions,
}: {
  exceptions: BackendException[]
}) {
  const baseValues = [
    42,
    58,
    35,
    67,
    54,
    78,
    64,
    88,
    72,
    94,
    82,
    100,
  ]

  const multiplier =
    exceptions.length > 0
      ? Math.min(
          1.15,
          Math.max(0.75, exceptions.length / 30)
        )
      : 0.75

  return (
    <div
      className="mini-bars"
      aria-label="Settlement performance chart"
    >
      {baseValues.map((height, index) => (
        <span
          key={index}
          style={{
            height: `${Math.min(
              100,
              height * multiplier
            )}%`,
          }}
        />
      ))}
    </div>
  )
}


/* =========================================================
   PAGE
========================================================= */

export default function Page() {
  const [active, setActive] = useState('Overview')

  const [dashboard, setDashboard] =
    useState<BackendDashboardResponse | null>(null)

  const [transactions, setTransactions] =
    useState<Transaction[]>([])

  const [selected, setSelected] =
    useState<BackendException | null>(null)

  const [query, setQuery] = useState('')

  const [loading, setLoading] = useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [aiLoading, setAiLoading] =
    useState(false)

  const [aiDone, setAiDone] =
    useState(false)


  /* =======================================================
     LOAD BACKEND
  ======================================================= */

  async function loadDashboard() {
    try {
      setLoading(true)
      setError(null)

      const [
        dashboardData,
        transactionData,
      ] = await Promise.all([
        getDashboardData(),
        getTransactions(),
      ])

      setDashboard(dashboardData)
      setTransactions(transactionData)
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load dashboard'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])


  /* =======================================================
     DATA
  ======================================================= */

  const exceptions =
    dashboard?.exceptions ?? []

  const metrics =
    dashboard?.metrics ?? {}

  const totalExceptions =
    exceptions.length


  /* =======================================================
     SEARCH
  ======================================================= */

  const filteredTransactions =
    useMemo(() => {
      const search =
        query.toLowerCase().trim()

      if (!search) {
        return transactions
      }

      return transactions.filter(
        (transaction) => {
          const text = `
            ${transaction.id}
            ${transaction.exceptionType}
            ${transaction.status}
            ${transaction.reason}
            ${(transaction as any).settlementStatus}
          `.toLowerCase()

          return text.includes(search)
        }
      )
    }, [transactions, query])


  const filteredExceptions =
    useMemo(() => {
      const search =
        query.toLowerCase().trim()

      if (!search) {
        return exceptions
      }

      return exceptions.filter(
        (exception) => {
          const text = `
            ${exception.transaction_id}
            ${exception.exception_type}
            ${exception.settlement_status}
          `.toLowerCase()

          return text.includes(search)
        }
      )
    }, [exceptions, query])


  /* =======================================================
     EXCEPTION BREAKDOWN
  ======================================================= */

  const exceptionBreakdown =
    useMemo(() => {
      const counts: Record<
        string,
        number
      > = {}

      exceptions.forEach(
        (exception) => {
          const label =
            readableException(
              exception.exception_type
            )

          counts[label] =
            (counts[label] || 0) + 1
        }
      )

      return Object.entries(counts)
        .sort(
          (a, b) => b[1] - a[1]
        )
        .map(
          ([label, count]) => ({
            label,
            count,
          })
        )
    }, [exceptions])


  /* =======================================================
     DONUT
  ======================================================= */

  const donutBackground =
    useMemo(() => {
      if (totalExceptions === 0) {
        return 'conic-gradient(#e5e7eb 0deg 360deg)'
      }

      const colors = [
        '#ef6262',
        '#f5a742',
        '#647eea',
        '#9b7aea',
        '#36b37e',
      ]

      let currentDegree = 0

      const segments =
        exceptionBreakdown.map(
          (item, index) => {
            const degree =
              (item.count /
                totalExceptions) *
              360

            const start =
              currentDegree

            const end =
              currentDegree + degree

            currentDegree = end

            return `${colors[index % colors.length]} ${start}deg ${end}deg`
          }
        )

      return `conic-gradient(${segments.join(', ')})`
    }, [
      exceptionBreakdown,
      totalExceptions,
    ])


  /* =======================================================
     AI / COUNTERFACTUAL
  ======================================================= */

  function openExplanation() {
    setAiLoading(true)

    setTimeout(() => {
      setAiLoading(false)
      setAiDone(true)
    }, 800)
  }


  function openTransaction(
    transactionId: string
  ) {
    const exception =
      exceptions.find(
        (item) =>
          item.transaction_id ===
          transactionId
      )

    if (exception) {
      setSelected(exception)
      return
    }

    const transaction =
      transactions.find(
        (item) =>
          item.id === transactionId
      )

    if (transaction) {
      const syntheticException =
        {
          transaction_id:
            transaction.id,

          exception_type:
            (transaction as any)
              .exceptionType ?? 'NONE',

          difference:
            Number(
              (transaction as any)
                .difference ?? 0
            ),

          expected_settlement:
            Number(
              (transaction as any)
                .expectedAmount ??
                transactionExpectedAmount(
                  transaction
                )
            ),

          actual_settlement:
            Number(
              (transaction as any)
                .actualAmount ??
                transactionAmount(
                  transaction
                )
            ),

          refund_amount:
            Number(
              (transaction as any)
                .refundAmount ?? 0
            ),

          settlement_status:
            (transaction as any)
              .settlementStatus ??
            'unknown',
        }

      setSelected(
        syntheticException
      )
    }
  }


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="app-shell">
        <main
          className="main"
          style={{
            display: 'grid',
            placeItems: 'center',
            minHeight: '100vh',
          }}
        >
          <div
            style={{
              textAlign: 'center',
            }}
          >
            <RefreshCw
              className="spin"
              size={32}
            />

            <p
              style={{
                marginTop: 12,
              }}
            >
              Loading reconciliation
              data...
            </p>
          </div>
        </main>
      </div>
    )
  }


  /* =======================================================
     ERROR
  ======================================================= */

  if (error) {
    return (
      <div className="app-shell">
        <main
          className="main"
          style={{
            display: 'grid',
            placeItems: 'center',
            minHeight: '100vh',
          }}
        >
          <div
            className="panel"
            style={{
              padding: 40,
              textAlign: 'center',
            }}
          >
            <AlertTriangle
              size={40}
              style={{
                marginBottom: 15,
              }}
            />

            <h2>
              Backend disconnected
            </h2>

            <p
              style={{
                margin:
                  '10px 0 20px',
              }}
            >
              {error}
            </p>

            <button
              className="primary"
              onClick={loadDashboard}
            >
              <RefreshCw size={16} />
              Retry connection
            </button>
          </div>
        </main>
      </div>
    )
  }


  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="app-shell">

      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-mark">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M18.5 7.5C17.15 5.8 15.05 4.75 12.7 4.75C8.65 4.75 5.5 7.95 5.5 12C5.5 16.05 8.65 19.25 12.7 19.25C15.05 19.25 17.15 18.2 18.5 16.5"
                stroke="white"
                strokeWidth="2.4"
                strokeLinecap="round"
              />

              <path
                d="M14.5 12H20"
                stroke="white"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div>
            <strong>
              Counterfactual
            </strong>

            <small>
              Settlement intelligence
            </small>
          </div>

        </div>


        <button className="workspace">
          Acme Treasury
          <ChevronDown size={15} />
        </button>


        <nav>
          {[
            {
              label: 'Overview',
              icon: LayoutDashboard,
            },
            {
              label: 'Transactions',
              icon: Activity,
            },
            {
              label: 'Exceptions',
              icon: AlertTriangle,
            },
            {
              label: 'Counterfactuals',
              icon: Sparkles,
            },
            {
              label: 'Reports',
              icon: BarChart3,
            },
          ].map(
            ({
              label,
              icon: Icon,
            }) => (
              <button
                key={label}
                className={
                  active === label
                    ? 'nav-item active'
                    : 'nav-item'
                }
                onClick={() => {
                  setActive(label)
                  setQuery('')
                }}
              >
                <Icon size={18} />

                {label}

                {label ===
                  'Exceptions' && (
                  <b>
                    {totalExceptions}
                  </b>
                )}
              </button>
            )
          )}
        </nav>


        <div className="side-bottom">

          <button className="nav-item">
            <Settings size={18} />
            Settings
          </button>

          <button className="user">

            <span>
              AM
            </span>

            <div>
              <strong>
                Alex Morgan
              </strong>

              <small>
                Administrator
              </small>
            </div>

            <MoreHorizontal
              size={17}
            />

          </button>

        </div>

      </aside>


      {/* ===================================================
          MAIN
      =================================================== */}

      <main className="main">

        {/* TOPBAR */}

        <header className="topbar">

          <button className="mobile-menu">
            <Menu size={20} />
          </button>


          <div className="search">

            <Search size={17} />

            <input
              placeholder={
                active ===
                'Transactions'
                  ? 'Search transactions...'
                  : active ===
                      'Exceptions'
                    ? 'Search exceptions...'
                    : 'Search transactions, counterparties...'
              }
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value
                )
              }
            />

            <kbd>
              ⌘ K
            </kbd>

          </div>


          <div className="top-actions">

            <button aria-label="Help">
              <CircleHelp size={19} />
            </button>

            <button
              aria-label="Notifications"
            >
              <Bell size={19} />
              <i />
            </button>

            <div className="avatar">
              AM
            </div>

          </div>

        </header>


        {/* =================================================
            CONTENT
        ================================================= */}

        <div className="content">


          {/* =================================================
              OVERVIEW
          ================================================= */}

          {active ===
            'Overview' && (
            <>

              <div className="page-heading">

                <div>

                  <p className="eyebrow">
                    MONDAY, MAY 6, 2025
                  </p>

                  <h1>
                    Good morning, Alex
                  </h1>

                  <p className="subhead">
                    Monitor settlement
                    health and resolve
                    exceptions before
                    they become losses.
                  </p>

                </div>


                <button
                  className="primary"
                  onClick={
                    loadDashboard
                  }
                >
                  <RefreshCw
                    size={16}
                  />
                  Sync data
                </button>

              </div>


              {/* KPI CARDS */}

              <section className="kpis">

                <div className="metric">

                  <span>
                    Net settlement volume
                  </span>

                  <strong>
                    {formatCurrency(
                      metrics.expected_total ??
                        0
                    )}
                  </strong>

                  <em>
                    <TrendingUp
                      size={14}
                    />
                    Live data

                    <small>
                      from reconciliation
                      engine
                    </small>
                  </em>

                </div>


                <div className="metric">

                  <span>
                    Reconciled today
                  </span>

                  <strong>
                    {(
                      metrics.match_rate ??
                      0
                    ).toFixed(1)}
                    %
                  </strong>

                  <em>
                    <TrendingUp
                      size={14}
                    />
                    Reconciliation rate
                  </em>

                </div>


                <div className="metric">

                  <span>
                    Open exceptions
                  </span>

                  <strong>
                    {metrics.exception_records ??
                      totalExceptions}
                  </strong>

                  <em className="negative">
                    <AlertTriangle
                      size={14}
                    />
                    Requires attention
                  </em>

                </div>


                <div className="metric">

                  <span>
                    At-risk capital
                  </span>

                  <strong>
                    {formatCurrency(
                      Math.abs(
                        metrics.unreconciled_amount ??
                          0
                      )
                    )}
                  </strong>

                  <em className="negative">
                    <AlertTriangle
                      size={14}
                    />
                    Unreconciled amount
                  </em>

                </div>

              </section>


              {/* CHART + BREAKDOWN */}

              <section className="grid-two">

                <div className="panel chart-panel">

                  <div className="panel-head">

                    <div>
                      <h2>
                        Settlement performance
                      </h2>

                      <p>
                        Expected vs actual
                        settlement volume
                      </p>
                    </div>

                    <button className="select">
                      Last 14 days
                      <ChevronDown
                        size={15}
                      />
                    </button>

                  </div>


                  <div className="chart-meta">

                    <strong>
                      {formatCompactCurrency(
                        metrics.expected_total ??
                          0
                      )}
                    </strong>

                    <span>
                      Expected volume
                    </span>

                    <strong className="muted-value">
                      {formatCompactCurrency(
                        metrics.actual_total ??
                          0
                      )}
                    </strong>

                    <span>
                      Actual volume
                    </span>

                  </div>


                  <MiniBars
                    exceptions={
                      exceptions
                    }
                  />


                  <div className="chart-axis">
                    <span>
                      Apr 23
                    </span>
                    <span>
                      Apr 27
                    </span>
                    <span>
                      May 1
                    </span>
                    <span>
                      May 6
                    </span>
                  </div>

                </div>


                <div className="panel">

                  <div className="panel-head">

                    <div>

                      <h2>
                        Exception breakdown
                      </h2>

                      <p>
                        {totalExceptions}{' '}
                        open items
                      </p>

                    </div>

                    <button
                      className="icon-btn"
                      aria-label="Filter"
                    >
                      <Filter
                        size={17}
                      />
                    </button>

                  </div>


                  <div className="donut-wrap">

                    <div
                      className="donut"
                      style={{
                        background:
                          donutBackground,
                      }}
                    >
                      <div>

                        <strong>
                          {totalExceptions}
                        </strong>

                        <span>
                          open
                        </span>

                      </div>
                    </div>


                    <div className="legend">

                      {exceptionBreakdown.map(
                        (
                          item,
                          index
                        ) => {

                          const dots = [
                            'red',
                            'orange',
                            'blue',
                            'purple',
                            'green',
                          ]

                          return (
                            <span
                              key={
                                item.label
                              }
                            >
                              <i
                                className={`dot ${
                                  dots[
                                    index %
                                      dots.length
                                  ]
                                }`}
                              />

                              {
                                item.label
                              }

                              <b>
                                {
                                  item.count
                                }
                              </b>
                            </span>
                          )
                        }
                      )}

                    </div>

                  </div>

                </div>

              </section>


              {/* RECENT ACTIVITY */}

              <section className="panel table-panel">

                <div className="panel-head">

                  <div>

                    <h2>
                      Recent activity
                    </h2>

                    <p>
                      Transactions processed
                      by the reconciliation
                      engine
                    </p>

                  </div>


                  <button className="secondary">
                    <SlidersHorizontal
                      size={16}
                    />
                    Filters
                  </button>

                </div>


                <div className="table-wrap">

                  <table>

                    <thead>

                      <tr>
                        <th>
                          Transaction
                        </th>

                        <th>
                          Counterparty
                        </th>

                        <th>
                          Amount
                        </th>

                        <th>
                          Type
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Difference
                        </th>

                        <th />
                      </tr>

                    </thead>


                    <tbody>

                      {filteredTransactions
                        .slice(0, 10)
                        .map(
                          (
                            transaction
                          ) => (

                            <tr
                              key={
                                transaction.id
                              }
                              onClick={() =>
                                openTransaction(
                                  transaction.id
                                )
                              }
                              style={{
                                cursor:
                                  'pointer',
                              }}
                            >

                              <td>

                                <strong>
                                  {
                                    transaction.id
                                  }
                                </strong>

                                <small>
                                  {transaction.exceptionType ===
                                  'NONE'
                                    ? 'Successfully reconciled'
                                    : readableException(
                                        transaction.exceptionType ??
                                          'UNKNOWN'
                                      )}
                                </small>

                              </td>


                              <td>
                                Settlement
                                processor
                              </td>


                              <td className="amount">

                                {formatCurrency(
                                  transactionAmount(
                                    transaction
                                  )
                                )}

                              </td>


                              <td>

                                <span className="rail">
                                  Settlement
                                </span>

                              </td>


                              <td>

                                <Status>
                                  {
                                    transaction.status
                                  }
                                </Status>

                              </td>


                              <td className="date">

                                {formatCurrency(
                                  Math.abs(
                                    Number(
                                      (transaction as any)
                                        .difference ??
                                        0
                                    )
                                  )
                                )}

                              </td>


                              <td>
                                <MoreHorizontal
                                  size={17}
                                />
                              </td>

                            </tr>

                          )
                        )}

                    </tbody>

                  </table>

                </div>


                <div className="table-foot">

                  <span>
                    Showing{' '}
                    {Math.min(
                      filteredTransactions.length,
                      10
                    )}{' '}
                    of{' '}
                    {transactions.length}{' '}
                    transactions
                  </span>

                  <button
                    onClick={() =>
                      setActive(
                        'Transactions'
                      )
                    }
                  >
                    View all transactions →
                  </button>

                </div>

              </section>


              {/* BOTTOM GRID */}

              <section className="bottom-grid">

                <div className="panel insight">

                  <div className="insight-icon">
                    <Sparkles
                      size={18}
                    />
                  </div>

                  <div>

                    <p className="eyebrow">
                      COUNTERFACTUAL INSIGHT
                    </p>

                    <h2>
                      Resolve exceptions
                      with confidence
                    </h2>

                    <p>
                      See the financial
                      impact of every
                      decision before you
                      take action.
                      Counterfactual
                      analysis is ready
                      for{' '}
                      {totalExceptions}{' '}
                      open exceptions.
                    </p>

                    <button
                      className="text-button"
                      onClick={() =>
                        setActive(
                          'Counterfactuals'
                        )
                      }
                    >
                      Explore analysis →
                    </button>

                  </div>

                </div>


                <div className="panel health">

                  <div className="panel-head">

                    <div>

                      <h2>
                        System health
                      </h2>

                      <p>
                        All systems operational
                      </p>

                    </div>

                    <CheckCircle2
                      className="check"
                      size={20}
                    />

                  </div>


                  <div className="health-row">

                    <span>
                      <Database
                        size={15}
                      />
                      Bank connections
                    </span>

                    <b>
                      18 / 18
                    </b>

                  </div>


                  <div className="health-row">

                    <span>
                      <ShieldCheck
                        size={15}
                      />
                      Reconciliation
                      engine
                    </span>

                    <b>
                      99.98%
                    </b>

                  </div>

                </div>

              </section>

            </>
          )}


          {/* =================================================
              TRANSACTIONS
          ================================================= */}

          {active ===
            'Transactions' && (
            <>

              <div className="page-heading">

                <div>

                  <p className="eyebrow">
                    RECONCILIATION
                  </p>

                  <h1>
                    Transactions
                  </h1>

                  <p className="subhead">
                    View all transactions
                    processed by the
                    reconciliation engine.
                  </p>

                </div>


                <button
                  className="primary"
                  onClick={
                    loadDashboard
                  }
                >
                  <RefreshCw
                    size={16}
                  />
                  Sync data
                </button>

              </div>


              <section className="kpis">

                <div className="metric">
                  <span>
                    Total transactions
                  </span>

                  <strong>
                    {transactions.length}
                  </strong>

                  <em>
                    <Activity
                      size={14}
                    />
                    Backend records
                  </em>
                </div>


                <div className="metric">
                  <span>
                    Reconciled
                  </span>

                  <strong>
                    {
                      transactions.filter(
                        (item) =>
                          item.status ===
                          'Reconciled'
                      ).length
                    }
                  </strong>

                  <em>
                    <CheckCircle2
                      size={14}
                    />
                    Successfully matched
                  </em>
                </div>


                <div className="metric">
                  <span>
                    Exceptions
                  </span>

                  <strong>
                    {totalExceptions}
                  </strong>

                  <em className="negative">
                    <AlertTriangle
                      size={14}
                    />
                    Requires attention
                  </em>
                </div>


                <div className="metric">
                  <span>
                    Expected volume
                  </span>

                  <strong>
                    {formatCompactCurrency(
                      metrics.expected_total ??
                        0
                    )}
                  </strong>

                  <em>
                    Settlement volume
                  </em>
                </div>

              </section>


              <section className="panel table-panel">

                <div className="panel-head">

                  <div>

                    <h2>
                      All transactions
                    </h2>

                    <p>
                      {filteredTransactions.length}{' '}
                      matching records
                    </p>

                  </div>


                  <button className="secondary">
                    <SlidersHorizontal
                      size={16}
                    />
                    Filters
                  </button>

                </div>


                <div className="table-wrap">

                  <table>

                    <thead>

                      <tr>

                        <th>
                          Transaction
                        </th>

                        <th>
                          Amount
                        </th>

                        <th>
                          Expected
                        </th>

                        <th>
                          Difference
                        </th>

                        <th>
                          Exception
                        </th>

                        <th>
                          Status
                        </th>

                        <th />

                      </tr>

                    </thead>


                    <tbody>

                      {filteredTransactions.map(
                        (
                          transaction, index
                        ) => (

                          <tr
                            key={
                              `${transaction.id}-${index}`
                            }
                            onClick={() =>
                              openTransaction(
                                transaction.id
                              )
                            }
                            style={{
                              cursor:
                                'pointer',
                            }}
                          >

                            <td>

                              <strong>
                                {
                                  transaction.id
                                }
                              </strong>

                              <small>
                                {
                                  transaction.reason ??
                                  'Settlement transaction'
                                }
                              </small>

                            </td>


                            <td className="amount">

                              {formatCurrency(
                                transactionAmount(
                                  transaction
                                )
                              )}

                            </td>


                            <td className="amount">

                              {formatCurrency(
                                transactionExpectedAmount(
                                  transaction
                                )
                              )}

                            </td>


                            <td className="amount">

                              {formatCurrency(
                                Math.abs(
                                  Number(
                                    (transaction as any)
                                      .difference ??
                                      0
                                  )
                                )
                              )}

                            </td>


                            <td>

                              {transaction.exceptionType ===
                              'NONE'
                                ? '—'
                                : readableException(
                                    transaction.exceptionType ??
                                      'UNKNOWN'
                                  )}

                            </td>


                            <td>

                              <Status>
                                {
                                  transaction.status
                                }
                              </Status>

                            </td>


                            <td>
                              <MoreHorizontal
                                size={17}
                              />
                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>


                <div className="table-foot">

                  <span>
                    Showing{' '}
                    {
                      filteredTransactions.length
                    }{' '}
                    of{' '}
                    {transactions.length}{' '}
                    transactions
                  </span>

                  <button
                    onClick={() =>
                      setQuery('')
                    }
                  >
                    Clear search
                  </button>

                </div>

              </section>

            </>
          )}


          {/* =================================================
              EXCEPTIONS
          ================================================= */}

          {active ===
            'Exceptions' && (
            <>

              <div className="page-heading">

                <div>

                  <p className="eyebrow">
                    RECONCILIATION
                  </p>

                  <h1>
                    Exceptions
                  </h1>

                  <p className="subhead">
                    Review and resolve
                    transactions that could
                    not be reconciled.
                  </p>

                </div>


                <button
                  className="primary"
                  onClick={
                    loadDashboard
                  }
                >
                  <RefreshCw
                    size={16}
                  />
                  Sync data
                </button>

              </div>


              <section className="kpis">

                <div className="metric">

                  <span>
                    Open exceptions
                  </span>

                  <strong>
                    {totalExceptions}
                  </strong>

                  <em className="negative">
                    <AlertTriangle
                      size={14}
                    />
                    Requires attention
                  </em>

                </div>


                <div className="metric">

                  <span>
                    High priority
                  </span>

                  <strong>
                    {
                      exceptions.filter(
                        (exception) =>
                          exception.exception_type ===
                            'MISSING_SETTLEMENT' ||
                          exception.exception_type ===
                            'DUPLICATE' ||
                          exception.exception_type ===
                            'DELAYED_SETTLEMENT'
                      ).length
                    }
                  </strong>

                  <em className="negative">
                    High risk
                  </em>

                </div>


                <div className="metric">

                  <span>
                    Exception rate
                  </span>

                  <strong>
                    {(
                      metrics.exception_rate ??
                      0
                    ).toFixed(1)}
                    %
                  </strong>

                  <em>
                    Reconciliation exceptions
                  </em>

                </div>


                <div className="metric">

                  <span>
                    At-risk capital
                  </span>

                  <strong>
                    {formatCurrency(
                      Math.abs(
                        metrics.unreconciled_amount ??
                          0
                      )
                    )}
                  </strong>

                  <em className="negative">
                    <AlertTriangle
                      size={14}
                    />
                    Financial exposure
                  </em>

                </div>

              </section>


              <section className="panel table-panel">

                <div className="panel-head">

                  <div>

                    <h2>
                      Open exceptions
                    </h2>

                    <p>
                      {
                        filteredExceptions.length
                      }{' '}
                      transactions require
                      attention
                    </p>

                  </div>

                </div>


                <div className="table-wrap">

                  <table>

                    <thead>

                      <tr>

                        <th>
                          Transaction
                        </th>

                        <th>
                          Exception
                        </th>

                        <th>
                          Expected
                        </th>

                        <th>
                          Actual
                        </th>

                        <th>
                          Difference
                        </th>

                        <th>
                          Settlement
                        </th>

                        <th />

                      </tr>

                    </thead>


                    <tbody>

                      {filteredExceptions.map(
                        (
                          exception
                        ) => (

                          <tr
                            key={
                              exception.transaction_id
                            }
                            onClick={() =>
                              setSelected(
                                exception
                              )
                            }
                            style={{
                              cursor:
                                'pointer',
                            }}
                          >

                            <td>

                              <strong>
                                {
                                  exception.transaction_id
                                }
                              </strong>

                              <small>
                                Click to investigate
                              </small>

                            </td>


                            <td>

                              <Status>
                                Exception
                              </Status>

                              <div
                                style={{
                                  marginTop:
                                    6,
                                }}
                              >
                                {readableException(
                                  exception.exception_type
                                )}
                              </div>

                            </td>


                            <td className="amount">

                              {formatCurrency(
                                Number(
                                  exception.expected_settlement ??
                                    0
                                )
                              )}

                            </td>


                            <td className="amount">

                              {formatCurrency(
                                Number(
                                  exception.actual_settlement ??
                                    0
                                )
                              )}

                            </td>


                            <td className="amount">

                              {formatCurrency(
                                Math.abs(
                                  Number(
                                    exception.difference ??
                                      0
                                  )
                                )
                              )}

                            </td>


                            <td>
                              {
                                exception.settlement_status
                              }
                            </td>


                            <td>
                              <MoreHorizontal
                                size={17}
                              />
                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </section>

            </>
          )}


          {/* =================================================
              COUNTERFACTUALS
          ================================================= */}

          {active ===
            'Counterfactuals' && (
            <>

              <div className="page-heading">

                <div>

                  <p className="eyebrow">
                    AI ANALYSIS
                  </p>

                  <h1>
                    Counterfactuals
                  </h1>

                  <p className="subhead">
                    Understand what would have
                    happened if each exception
                    had settled normally.
                  </p>

                </div>

              </div>


              <section className="kpis">

                <div className="metric">

                  <span>
                    Exceptions analyzed
                  </span>

                  <strong>
                    {totalExceptions}
                  </strong>

                  <em>
                    <Sparkles
                      size={14}
                    />
                    Ready for analysis
                  </em>

                </div>


                <div className="metric">

                  <span>
                    Unreconciled amount
                  </span>

                  <strong>
                    {formatCurrency(
                      Math.abs(
                        metrics.unreconciled_amount ??
                          0
                      )
                    )}
                  </strong>

                  <em className="negative">
                    Financial exposure
                  </em>

                </div>


                <div className="metric">

                  <span>
                    Exception rate
                  </span>

                  <strong>
                    {(
                      metrics.exception_rate ??
                      0
                    ).toFixed(1)}
                    %
                  </strong>

                  <em>
                    Current reconciliation
                    rate
                  </em>

                </div>

              </section>


              <section className="panel table-panel">

                <div className="panel-head">

                  <div>

                    <h2>
                      Counterfactual analysis
                    </h2>

                    <p>
                      Select an exception to
                      inspect its financial
                      impact.
                    </p>

                  </div>

                </div>


                <div className="table-wrap">

                  <table>

                    <thead>

                      <tr>

                        <th>
                          Transaction
                        </th>

                        <th>
                          Exception
                        </th>

                        <th>
                          Expected settlement
                        </th>

                        <th>
                          Actual settlement
                        </th>

                        <th>
                          Financial impact
                        </th>

                        <th />

                      </tr>

                    </thead>


                    <tbody>

                      {exceptions.map(
                        (
                          exception
                        ) => (

                          <tr
                            key={
                              exception.transaction_id
                            }
                            onClick={() =>
                              setSelected(
                                exception
                              )
                            }
                            style={{
                              cursor:
                                'pointer',
                            }}
                          >

                            <td>

                              <strong>
                                {
                                  exception.transaction_id
                                }
                              </strong>

                            </td>


                            <td>
                              {
                                readableException(
                                  exception.exception_type
                                )
                              }
                            </td>


                            <td className="amount">

                              {formatCurrency(
                                Number(
                                  exception.expected_settlement ??
                                    0
                                )
                              )}

                            </td>


                            <td className="amount">

                              {formatCurrency(
                                Number(
                                  exception.actual_settlement ??
                                    0
                                )
                              )}

                            </td>


                            <td className="amount">

                              {formatCurrency(
                                Math.abs(
                                  Number(
                                    exception.difference ??
                                      0
                                  )
                                )
                              )}

                            </td>


                            <td>
                              <Sparkles
                                size={17}
                              />
                            </td>

                          </tr>

                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </section>

            </>
          )}


          {/* =================================================
              REPORTS
          ================================================= */}

          {active ===
            'Reports' && (
            <>

              <div className="page-heading">

                <div>

                  <p className="eyebrow">
                    ANALYTICS
                  </p>

                  <h1>
                    Reports
                  </h1>

                  <p className="subhead">
                    Reconciliation performance
                    and exception analytics.
                  </p>

                </div>


                <button
                  className="primary"
                  onClick={
                    loadDashboard
                  }
                >
                  <RefreshCw
                    size={16}
                  />
                  Refresh report
                </button>

              </div>


              <section className="kpis">

                <div className="metric">

                  <span>
                    Total records
                  </span>

                  <strong>
                    {metrics.total_records ??
                      transactions.length}
                  </strong>

                  <em>
                    Processed
                  </em>

                </div>


                <div className="metric">

                  <span>
                    Matched records
                  </span>

                  <strong>
                    {metrics.matched_records ??
                      0}
                  </strong>

                  <em>
                    <CheckCircle2
                      size={14}
                    />
                    Reconciled
                  </em>

                </div>


                <div className="metric">

                  <span>
                    Match rate
                  </span>

                  <strong>
                    {(
                      metrics.match_rate ??
                      0
                    ).toFixed(2)}
                    %
                  </strong>

                  <em>
                    Reconciliation quality
                  </em>

                </div>


                <div className="metric">

                  <span>
                    Unreconciled amount
                  </span>

                  <strong>
                    {formatCurrency(
                      Math.abs(
                        metrics.unreconciled_amount ??
                          0
                      )
                    )}
                  </strong>

                  <em className="negative">
                    At-risk capital
                  </em>

                </div>

              </section>


              <section className="grid-two">

                <div className="panel">

                  <div className="panel-head">

                    <div>

                      <h2>
                        Exception distribution
                      </h2>

                      <p>
                        Breakdown of detected
                        reconciliation issues.
                      </p>

                    </div>

                  </div>


                  <div className="legend">

                    {exceptionBreakdown.length ===
                    0 ? (
                      <span>
                        No exceptions detected.
                      </span>
                    ) : (
                      exceptionBreakdown.map(
                        (item) => (
                          <span
                            key={
                              item.label
                            }
                          >
                            {item.label}

                            <b>
                              {item.count}
                            </b>
                          </span>
                        )
                      )
                    )}

                  </div>

                </div>


                <div className="panel">

                  <div className="panel-head">

                    <div>

                      <h2>
                        Settlement totals
                      </h2>

                      <p>
                        Expected versus actual
                        settlement volume.
                      </p>

                    </div>

                  </div>


                  <div className="chart-meta">

                    <strong>
                      {formatCurrency(
                        metrics.expected_total ??
                          0
                      )}
                    </strong>

                    <span>
                      Expected
                    </span>

                    <strong className="muted-value">
                      {formatCurrency(
                        metrics.actual_total ??
                          0
                      )}
                    </strong>

                    <span>
                      Actual
                    </span>

                  </div>


                  <MiniBars
                    exceptions={
                      exceptions
                    }
                  />

                </div>

              </section>


              <section className="panel table-panel">

                <div className="panel-head">

                  <div>

                    <h2>
                      Report summary
                    </h2>

                    <p>
                      Current reconciliation
                      engine results.
                    </p>

                  </div>

                </div>


                <div className="table-wrap">

                  <table>

                    <tbody>

                      <tr>
                        <td>
                          Total records
                        </td>

                        <td>
                          {metrics.total_records ??
                            transactions.length}
                        </td>
                      </tr>


                      <tr>
                        <td>
                          Matched records
                        </td>

                        <td>
                          {metrics.matched_records ??
                            0}
                        </td>
                      </tr>


                      <tr>
                        <td>
                          Exception records
                        </td>

                        <td>
                          {metrics.exception_records ??
                            totalExceptions}
                        </td>
                      </tr>


                      <tr>
                        <td>
                          Expected total
                        </td>

                        <td>
                          {formatCurrency(
                            metrics.expected_total ??
                              0
                          )}
                        </td>
                      </tr>


                      <tr>
                        <td>
                          Actual total
                        </td>

                        <td>
                          {formatCurrency(
                            metrics.actual_total ??
                              0
                          )}
                        </td>
                      </tr>


                      <tr>
                        <td>
                          Unreconciled amount
                        </td>

                        <td>
                          {formatCurrency(
                            Math.abs(
                              metrics.unreconciled_amount ??
                                0
                            )
                          )}
                        </td>
                      </tr>

                    </tbody>

                  </table>

                </div>

              </section>

            </>
          )}

        </div>

      </main>


      {/* ===================================================
          INVESTIGATION PANEL
      =================================================== */}

      <Sheet
        open={!!selected}
        onOpenChange={() => {
          setSelected(null)
          setAiDone(false)
        }}
      >

        <SheetContent
          className="investigation"
        >

          <SheetHeader>

            <div className="sheet-kicker">

              <span>
                EXCEPTION
              </span>

              <Status>
                Exception
              </Status>

            </div>


            <SheetTitle>
              Investigate transaction
            </SheetTitle>


            <SheetDescription>
              {selected?.transaction_id}
            </SheetDescription>

          </SheetHeader>


          {selected && (
            <div className="sheet-body">

              <div className="amount-hero">

                <span>
                  Expected settlement
                </span>

                <strong>
                  {formatCurrency(
                    Number(
                      selected.expected_settlement ??
                        0
                    )
                  )}
                </strong>

                <small>
                  Actual:{' '}
                  {formatCurrency(
                    Number(
                      selected.actual_settlement ??
                        0
                    )
                  )}
                </small>

              </div>


              <div className="why">

                <div className="why-head">

                  <AlertTriangle
                    size={18}
                  />

                  <strong>
                    Why this was flagged
                  </strong>

                </div>


                <p>

                  {readableException(
                    selected.exception_type
                  )}

                  . The reconciliation
                  engine detected a
                  difference of{' '}

                  {formatCurrency(
                    Math.abs(
                      Number(
                        selected.difference ??
                          0
                      )
                    )
                  )}

                  {' '}between the expected
                  and actual settlement.

                </p>

              </div>


              <div className="cf-card">

                <div className="cf-title">

                  <Sparkles
                    size={17}
                  />

                  Counterfactual analysis

                </div>


                <div className="cf-row">

                  <span>
                    Expected settlement
                  </span>

                  <strong>
                    {formatCurrency(
                      Number(
                        selected.expected_settlement ??
                          0
                      )
                    )}
                  </strong>

                </div>


                <div className="cf-row">

                  <span>
                    Actual settlement
                  </span>

                  <strong>
                    {formatCurrency(
                      Number(
                        selected.actual_settlement ??
                          0
                      )
                    )}
                  </strong>

                </div>


                <div className="cf-row">

                  <span>
                    Financial impact
                  </span>

                  <strong className="negative-text">

                    {formatCurrency(
                      Math.abs(
                        Number(
                          selected.difference ??
                            0
                        )
                      )
                    )}

                    {' '}exposure

                  </strong>

                </div>


                <div className="cf-row">

                  <span>
                    Refund amount
                  </span>

                  <strong>
                    {formatCurrency(
                      Number(
                        selected.refund_amount ??
                          0
                      )
                    )}
                  </strong>

                </div>


                {aiDone && (
                  <div className="cf-row">

                    <span>
                      Recommended action
                    </span>

                    <strong>
                      Review remittance
                      details, then
                      reconcile manually.
                    </strong>

                  </div>
                )}

              </div>


              <button
                className="primary full"
                onClick={
                  openExplanation
                }
                disabled={
                  aiLoading
                }
              >

                {aiLoading ? (
                  <>
                    <RefreshCw
                      className="spin"
                      size={16}
                    />

                    Generating
                    explanation...
                  </>
                ) : (
                  <>
                    <Sparkles
                      size={16}
                    />

                    {aiDone
                      ? 'Explanation generated'
                      : 'Generate AI explanation'}
                  </>
                )}

              </button>


              <button
                className="secondary full"
                onClick={() => {
                  setActive(
                    'Transactions'
                  )
                  setSelected(null)
                }}
              >
                Open transaction details
              </button>

            </div>
          )}

        </SheetContent>

      </Sheet>

    </div>
  )
}