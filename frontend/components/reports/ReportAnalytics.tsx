'use client'

import React from 'react'
import type { DashboardMetrics, BackendException, Transaction } from '@/types'
import {
  formatCurrency,
  readableException,
  getExceptionSeverity,
  getExceptionColor,
} from '@/lib/api'
import {
  FileText,
  Download,
  Printer,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Layers,
  CreditCard,
  Building,
} from 'lucide-react'

interface ReportAnalyticsProps {
  metrics: DashboardMetrics
  exceptions: BackendException[]
  transactions: Transaction[]
  onRefresh: () => void
  isSyncing?: boolean
}

export function ReportAnalytics({
  metrics,
  exceptions,
  transactions,
  onRefresh,
  isSyncing,
}: ReportAnalyticsProps) {
  const total = metrics.total_records ?? transactions.length
  const matched = metrics.matched_records ?? 0
  const totalExceptions = metrics.exception_records ?? exceptions.length
  const matchRate = metrics.match_rate ?? 0
  const expectedTotal = metrics.expected_total ?? 0
  const actualTotal = metrics.actual_total ?? 0
  const unreconciled = Math.abs(metrics.unreconciled_amount ?? 0)

  // Rail breakdown stats
  const railStats = React.useMemo(() => {
    const map = new Map<string, { count: number; matched: number; volume: number; variance: number }>()

    transactions.forEach((tx) => {
      const rail = tx.rail || 'CARD'
      const cur = map.get(rail) || { count: 0, matched: 0, volume: 0, variance: 0 }
      cur.count += 1
      if (tx.status === 'Reconciled') cur.matched += 1
      cur.volume += tx.actualAmount ?? 0
      cur.variance += Math.abs(tx.difference ?? 0)
      map.set(rail, cur)
    })

    return Array.from(map.entries()).map(([rail, data]) => ({
      rail,
      count: data.count,
      matched: data.matched,
      rate: data.count > 0 ? (data.matched / data.count) * 100 : 0,
      volume: data.volume,
      variance: data.variance,
    }))
  }, [transactions])

  const handlePrint = () => {
    window.print()
  }

  const handleExportCSV = () => {
    const headers = [
      'Transaction ID',
      'Rail',
      'Expected Settlement',
      'Actual Settlement',
      'Variance',
      'Exception Type',
      'Settlement Status',
    ]
    const rows = transactions.map((t) => [
      t.id,
      t.rail,
      t.expectedAmount ?? 0,
      t.actualAmount ?? 0,
      t.difference ?? 0,
      t.exceptionType ?? 'NONE',
      t.settlementStatus ?? 'unknown',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `counterfactual_settlement_audit_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="page-header">
        <div>
          <span className="eyebrow">Executive Treasury Audit</span>
          <h1 className="page-title">Settlement Analytics & Reports</h1>
          <p className="page-subhead">
            Comprehensive audit breakdown of ledger records, reconciliation fidelity, and capital exposure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="btn btn-secondary btn-sm">
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button onClick={handlePrint} className="btn btn-secondary btn-sm">
            <Printer size={14} />
            <span>Print Audit</span>
          </button>
        </div>
      </div>

      {/* Top 4 Key Summary Metrics */}
      <div className="kpi-grid">
        <div className="kpi-card tone-indigo">
          <div className="kpi-label">Reconciliation Rate</div>
          <div className="kpi-value tabular-nums">{matchRate.toFixed(2)}%</div>
          <div className="kpi-footer">
            <span className="kpi-badge-positive">
              <ShieldCheck size={12} />
              {matched} of {total} matched
            </span>
          </div>
        </div>

        <div className="kpi-card tone-green">
          <div className="kpi-label">Expected Settlement Volume</div>
          <div className="kpi-value tabular-nums">{formatCurrency(expectedTotal)}</div>
          <div className="kpi-footer">
            <span className="kpi-badge-neutral">Sum of expected settlements</span>
          </div>
        </div>

        <div className="kpi-card tone-amber">
          <div className="kpi-label">Actual Bank Settlement</div>
          <div className="kpi-value tabular-nums">{formatCurrency(actualTotal)}</div>
          <div className="kpi-footer">
            <span className="kpi-badge-neutral">Sum of actual settlements</span>
          </div>
        </div>

        <div className="kpi-card tone-red">
          <div className="kpi-label">Total At-Risk Exposure</div>
          <div className="kpi-value tabular-nums text-rose-600">{formatCurrency(unreconciled)}</div>
          <div className="kpi-footer">
            <span className="kpi-badge-negative">
              <AlertTriangle size={12} />
              {totalExceptions} open exceptions
            </span>
          </div>
        </div>
      </div>

      {/* Grid 2: Rail Quality Matrix & Executive Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Rail Quality Matrix */}
        <div className="lg:col-span-7 card-panel">
          <div className="card-panel-header">
            <div>
              <h2 className="card-panel-title">Rail Performance Matrix</h2>
              <p className="card-panel-subtitle">
                Reconciliation accuracy and discrepancy distribution by payment rail
              </p>
            </div>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Payment Rail</th>
                  <th>Total Transactions</th>
                  <th>Match Fidelity</th>
                  <th>Settled Volume</th>
                  <th className="text-right">Variance Exposure</th>
                </tr>
              </thead>
              <tbody>
                {railStats.map((item) => (
                  <tr key={item.rail}>
                    <td>
                      <span className="fintech-badge badge-rail">{item.rail}</span>
                    </td>
                    <td className="text-slate-700">{item.count}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full"
                            style={{ width: `${item.rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-900 tabular-nums">
                          {item.rate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(item.volume)}
                    </td>
                    <td className="text-right font-bold tabular-nums">
                      {item.variance > 0 ? (
                        <span className="text-rose-600">
                          {formatCurrency(item.variance)}
                        </span>
                      ) : (
                        <span className="text-emerald-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit Verification Summary */}
        <div className="lg:col-span-5 card-panel">
          <div className="card-panel-header">
            <div>
              <h2 className="card-panel-title">Audit Ledger Summary</h2>
              <p className="card-panel-subtitle">Verified by deterministic rules engine</p>
            </div>
          </div>

          <div className="card-panel-body space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex justify-between">
              <span className="text-slate-600">Reconciliation Engine:</span>
              <strong className="text-slate-900">Deterministic v3.2</strong>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex justify-between">
              <span className="text-slate-600">Primary Data Source:</span>
              <strong className="text-slate-900">Gateway Batch CSV Ledger</strong>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex justify-between">
              <span className="text-slate-600">Ledger Records Analyzed:</span>
              <strong className="text-slate-900">{total} rows</strong>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex justify-between">
              <span className="text-slate-600">Overall Settlement Match Rate:</span>
              <strong className="text-emerald-700 font-bold">{matchRate.toFixed(2)}%</strong>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex justify-between text-rose-900">
              <span>Unreconciled Financial Exposure:</span>
              <strong className="font-bold tabular-nums">{formatCurrency(unreconciled)}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
