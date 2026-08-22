'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Transaction } from '@/types'
import { getTransactions } from '@/lib/api'
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

import {
  getDashboardData,
  type BackendException,
  type BackendDashboardResponse,
} from '@/lib/api'


/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatCompactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `₹${(value / 1_000_000).toFixed(2)}M`
  }

  if (Math.abs(value) >= 1_000) {
    return `₹${(value / 1_000).toFixed(1)}K`
  }

  return formatCurrency(value)
}

function readableException(type: string) {
  switch (type) {
    case 'DUPLICATE':
      return 'Duplicate settlement'

    case 'MISSING_SETTLEMENT':
      return 'Missing settlement'

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

function statusLabel(status: string) {
  if (status === 'settled') {
    return 'Exception'
  }

  if (status === 'missing') {
    return 'Missing'
  }

  return status
}


/* -------------------------------------------------------
   STATUS
------------------------------------------------------- */

function Status({
  children,
}: {
  children: string
}) {
  const value = children.toLowerCase()

  const tone =
    value === 'reconciled'
      ? 'success'
      : value === 'missing'
        ? 'danger'
        : 'warning'

  return (
    <span className={`status ${tone}`}>
      {children}
    </span>
  )
}


/* -------------------------------------------------------
   CHART
------------------------------------------------------- */

function MiniBars({
  exceptions,
}: {
  exceptions: BackendException[]
}) {
  const baseValues = [42, 58, 35, 67, 54, 78, 64, 88, 72, 94, 82, 100]

  const multiplier =
    exceptions.length > 0
      ? Math.min(1.15, Math.max(0.75, exceptions.length / 30))
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
            height: `${Math.min(100, height * multiplier)}%`,
          }}
        />
      ))}
    </div>
  )
}


/* -------------------------------------------------------
   PAGE
------------------------------------------------------- */

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

  const [error, setError] = useState<string | null>(null)

  const [aiLoading, setAiLoading] = useState(false)

  const [aiDone, setAiDone] = useState(false)


  /* -------------------------------------------------------
     LOAD BACKEND DATA
  ------------------------------------------------------- */

  async function loadDashboard() {
    try {
      setLoading(true)
      setError(null)
  
      const [dashboardData, transactionData] = await Promise.all([
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


  /* -------------------------------------------------------
     DATA
  ------------------------------------------------------- */

  const exceptions = dashboard?.exceptions ?? []

  const metrics = dashboard?.metrics ?? {}


  /* -------------------------------------------------------
     SEARCH
  ------------------------------------------------------- */

  const filteredTransactions = useMemo(() => {
    const search = query.toLowerCase().trim()
  
    if (!search) {
      return transactions
    }
  
    return transactions.filter((transaction) => {
      const text = `
        ${transaction.id}
        ${transaction.exceptionType}
        ${transaction.status}
        ${transaction.settlementStatus}
      `.toLowerCase()
  
      return text.includes(search)
    })
  }, [transactions, query])


  /* -------------------------------------------------------
     EXCEPTION BREAKDOWN
  ------------------------------------------------------- */

  const exceptionBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}

    exceptions.forEach((exception) => {
      const label = readableException(
        exception.exception_type
      )

      counts[label] = (counts[label] || 0) + 1
    })

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        count,
      }))
  }, [exceptions])


  const totalExceptions = exceptions.length


  /* -------------------------------------------------------
     DONUT
  ------------------------------------------------------- */

  const donutBackground = useMemo(() => {
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

    const segments = exceptionBreakdown.map(
      (item, index) => {
        const degree =
          (item.count / totalExceptions) * 360

        const start = currentDegree

        const end = currentDegree + degree

        currentDegree = end

        return `${colors[index % colors.length]} ${start}deg ${end}deg`
      }
    )

    return `conic-gradient(${segments.join(', ')})`
  }, [exceptionBreakdown, totalExceptions])


  /* -------------------------------------------------------
     COUNTERFACTUAL
  ------------------------------------------------------- */

  const openExplanation = () => {
    setAiLoading(true)

    setTimeout(() => {
      setAiLoading(false)
      setAiDone(true)
    }, 800)
  }


  /* -------------------------------------------------------
     LOADING
  ------------------------------------------------------- */

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
          <div style={{ textAlign: 'center' }}>
            <RefreshCw
              className="spin"
              size={32}
            />

            <p style={{ marginTop: 12 }}>
              Loading reconciliation data...
            </p>
          </div>
        </main>
      </div>
    )
  }


  /* -------------------------------------------------------
     ERROR
  ------------------------------------------------------- */

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
              style={{ marginBottom: 15 }}
            />

            <h2>Backend disconnected</h2>

            <p style={{ margin: '10px 0 20px' }}>
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


  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  return (
    <div className="app-shell">

      {/* SIDEBAR */}

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
    <strong>Counterfactual</strong>
    <small>Settlement intelligence</small>
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
                onClick={() =>
                  setActive(label)
                }
              >
                <Icon size={18} />

                {label}

                {label === 'Exceptions' && (
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

            <MoreHorizontal size={17} />

          </button>

        </div>

      </aside>


      {/* MAIN */}

      <main className="main">

        {/* TOPBAR */}

        <header className="topbar">

          <button className="mobile-menu">
            <Menu size={20} />
          </button>


          <div className="search">

            <Search size={17} />

            <input
              placeholder="Search transactions, counterparties..."
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
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

            <button aria-label="Notifications">
              <Bell size={19} />
              <i />
            </button>

            <div className="avatar">
              AM
            </div>

          </div>

        </header>


        {/* CONTENT */}

        <div className="content">

          {/* HEADING */}

          <div className="page-heading">

            <div>

              <p className="eyebrow">
                MONDAY, MAY 6, 2025
              </p>

              <h1>
                Good morning, Alex
              </h1>

              <p className="subhead">
                Monitor settlement health and resolve
                exceptions before they become losses.
              </p>

            </div>


            <button
              className="primary"
              onClick={loadDashboard}
            >
              <RefreshCw size={16} />
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
                  metrics.expected_total ?? 0
                )}
              </strong>

              <em>
                <TrendingUp size={14} />

                Live data

                <small>
                  from reconciliation engine
                </small>
              </em>

            </div>


            <div className="metric">

              <span>
                Reconciled today
              </span>

              <strong>
                {(metrics.match_rate ?? 0).toFixed(1)}%
              </strong>

              <em>
                <TrendingUp size={14} />

                Reconciliation rate
              </em>

            </div>


            <div className="metric">

              <span>
                Open exceptions
              </span>

              <strong>
                {metrics.exception_records ?? totalExceptions}
              </strong>

              <em className="negative">
                <AlertTriangle size={14} />

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
                    metrics.unreconciled_amount ?? 0
                  )
                )}
              </strong>

              <em className="negative">
                <AlertTriangle size={14} />

                Unreconciled amount
              </em>

            </div>

          </section>


          {/* CHART + BREAKDOWN */}

          <section className="grid-two">

            {/* SETTLEMENT PERFORMANCE */}

            <div className="panel chart-panel">

              <div className="panel-head">

                <div>

                  <h2>
                    Settlement performance
                  </h2>

                  <p>
                    Expected vs actual settlement volume
                  </p>

                </div>

                <button className="select">
                  Last 14 days
                  <ChevronDown size={15} />
                </button>

              </div>


              <div className="chart-meta">

                <strong>
                  {formatCompactCurrency(
                    metrics.expected_total ?? 0
                  )}
                </strong>

                <span>
                  Expected volume
                </span>

                <strong className="muted-value">
                  {formatCompactCurrency(
                    metrics.actual_total ?? 0
                  )}
                </strong>

                <span>
                  Actual volume
                </span>

              </div>


              <MiniBars
                exceptions={exceptions}
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


            {/* EXCEPTION BREAKDOWN */}

            <div className="panel">

              <div className="panel-head">

                <div>

                  <h2>
                    Exception breakdown
                  </h2>

                  <p>
                    {totalExceptions} open items
                  </p>

                </div>

                <button
                  className="icon-btn"
                  aria-label="Filter"
                >
                  <Filter size={17} />
                </button>

              </div>


              <div className="donut-wrap">

                <div
                  className="donut"
                  style={{
                    background: donutBackground,
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
                    (item, index) => {

                      const dotClasses = [
                        'red',
                        'orange',
                        'blue',
                        'purple',
                        'green',
                      ]

                      return (
                        <span
                          key={item.label}
                        >

                          <i
                            className={`dot ${
                              dotClasses[
                                index %
                                dotClasses.length
                              ]
                            }`}
                          />

                          {item.label}

                          <b>
                            {item.count}
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
  Transactions processed by the reconciliation engine
</p>

              </div>


              <button className="secondary">
                <SlidersHorizontal size={16} />
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
                      (transaction) => (

                        <tr
  key={transaction.id}
  onClick={() => {
    const exception = exceptions.find(
      (item) => item.transaction_id === transaction.id
    )

    if (exception) {
      setSelected(exception)
    }
  }}
>
  <td>
    <strong>{transaction.id}</strong>

    <small>
  {transaction.exceptionType === 'NONE'
    ? 'Successfully reconciled'
    : readableException(transaction.exceptionType ?? 'UNKNOWN')}
</small>
  </td>

  <td>
    Settlement processor
  </td>

  <td className="amount">
  {formatCompactCurrency(
    Number(transaction.amount.replace(/[$,]/g, ''))
  )}
</td>

  <td>
    <span className="rail">
      Settlement
    </span>
  </td>

  <td>
    <Status>
      {transaction.status}
    </Status>
  </td>

  <td className="date">
  {formatCurrency(
    Math.abs(Number(transaction.difference ?? 0))
  )}
</td>

  <td>
    <MoreHorizontal size={17} />
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
                {exceptions.length}{' '}
                exceptions
              </span>

              <button
                onClick={() =>
                  setActive('Exceptions')
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
                <Sparkles size={18} />
              </div>

              <div>

                <p className="eyebrow">
                  COUNTERFACTUAL INSIGHT
                </p>

                <h2>
                  Resolve exceptions with confidence
                </h2>

                <p>
                  See the financial impact of every
                  decision before you take action.
                  Counterfactual analysis is ready for{' '}
                  {totalExceptions} open exceptions.
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
                  <Database size={15} />
                  Bank connections
                </span>

                <b>
                  18 / 18
                </b>

              </div>


              <div className="health-row">

                <span>
                  <ShieldCheck size={15} />
                  Reconciliation engine
                </span>

                <b>
                  99.98%
                </b>

              </div>

            </div>

          </section>

        </div>

      </main>


      {/* INVESTIGATION PANEL */}

      <Sheet
        open={!!selected}
        onOpenChange={() => {
          setSelected(null)
          setAiDone(false)
        }}
      >

        <SheetContent className="investigation">

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
                    selected.expected_settlement
                  )}
                </strong>

                <small>
                  Actual:{' '}
                  {formatCurrency(
                    selected.actual_settlement
                  )}
                </small>

              </div>


              <div className="why">

                <div className="why-head">

                  <AlertTriangle size={18} />

                  <strong>
                    Why this was flagged
                  </strong>

                </div>

                <p>
                  {
                    readableException(
                      selected.exception_type
                    )
                  }
                  . The reconciliation engine
                  detected a difference of{' '}
                  {formatCurrency(
                    Math.abs(
                      selected.difference
                    )
                  )}
                  between the expected and
                  actual settlement.
                </p>

              </div>


              <div className="cf-card">

                <div className="cf-title">

                  <Sparkles size={17} />

                  Counterfactual analysis

                </div>


                <div className="cf-row">

                  <span>
                    Expected settlement
                  </span>

                  <strong>
                    {formatCurrency(
                      selected.expected_settlement
                    )}
                  </strong>

                </div>


                <div className="cf-row">

                  <span>
                    Actual settlement
                  </span>

                  <strong>
                    {formatCurrency(
                      selected.actual_settlement
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
                        selected.difference
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
                      selected.refund_amount
                    )}
                  </strong>

                </div>


                {aiDone && (

                  <div className="cf-row">

                    <span>
                      Recommended action
                    </span>

                    <strong>
                      Review remittance details,
                      then reconcile manually.
                    </strong>

                  </div>

                )}

              </div>


              <button
                className="primary full"
                onClick={
                  openExplanation
                }
                disabled={aiLoading}
              >

                {aiLoading ? (
                  <>
                    <RefreshCw
                      className="spin"
                      size={16}
                    />

                    Generating explanation...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />

                    {aiDone
                      ? 'Explanation generated'
                      : 'Generate AI explanation'}
                  </>
                )}

              </button>


              <button className="secondary full">
                Open transaction details
              </button>

            </div>

          )}

        </SheetContent>

      </Sheet>

    </div>
  )
}