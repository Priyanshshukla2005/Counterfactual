'use client'

import React, { useState } from 'react'
import type { Transaction } from '@/types'
import { formatCurrency, readableException } from '@/lib/api'
import { StatusBadge, RiskBadge, RailBadge, SettlementStatusBadge } from '@/components/common/Badge'
import { EmptyState } from '@/components/common/EmptyState'
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowUpDown,
  MoreHorizontal,
  ExternalLink,
} from 'lucide-react'

interface TransactionTableProps {
  transactions: Transaction[]
  onSelect: (transaction: Transaction) => void
  onSimulate?: (transactionId: string) => void
  pageSize?: number
}

type SortField = 'id' | 'expectedAmount' | 'actualAmount' | 'difference' | 'date'
type SortOrder = 'asc' | 'desc'

export function TransactionTable({
  transactions,
  onSelect,
  onSimulate,
  pageSize = 12,
}: TransactionTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('id')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Sorted list
  const sortedTransactions = [...transactions].sort((a, b) => {
    let aVal: any = a[sortField] ?? 0
    let bVal: any = b[sortField] ?? 0

    if (sortField === 'difference') {
      aVal = Math.abs(a.difference ?? 0)
      bVal = Math.abs(b.difference ?? 0)
    }

    if (typeof aVal === 'string') {
      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
  })

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedTransactions.length / pageSize))
  const startIndex = (currentPage - 1) * pageSize
  const paginatedTransactions = sortedTransactions.slice(
    startIndex,
    startIndex + pageSize
  )

  if (transactions.length === 0) {
    return <EmptyState type="no-results" />
  }

  return (
    <div className="card-panel overflow-hidden">
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th
                onClick={() => handleSort('id')}
                className="cursor-pointer hover:text-slate-900 select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Transaction / Reference</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>

              <th>Payment Rail</th>

              <th
                onClick={() => handleSort('expectedAmount')}
                className="cursor-pointer hover:text-slate-900 select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Expected Settlement</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>

              <th
                onClick={() => handleSort('actualAmount')}
                className="cursor-pointer hover:text-slate-900 select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Actual Settlement</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>

              <th
                onClick={() => handleSort('difference')}
                className="cursor-pointer hover:text-slate-900 select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Variance</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>

              <th>Exception Class</th>
              <th>Risk Tier</th>
              <th>Settlement</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginatedTransactions.map((tx, index) => {
              const variance = Math.abs(tx.difference ?? 0)
              const hasDiscrepancy = variance > 0.01

              return (
                <tr
                  key={`${tx.id}-${index}-${startIndex}`}
                  onClick={() => onSelect(tx)}
                  className="cursor-pointer group"
                >
                  <td>
                    <div className="font-semibold text-slate-900 mono-id group-hover:text-indigo-600 transition">
                      {tx.id}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                      {tx.orderId ? `Order: ${tx.orderId}` : tx.reason}
                    </div>
                  </td>

                  <td>
                    <RailBadge rail={tx.rail} />
                  </td>

                  <td className="tabular-nums font-medium text-slate-700">
                    {formatCurrency(tx.expectedAmount)}
                  </td>

                  <td className="tabular-nums font-bold text-slate-900">
                    {formatCurrency(tx.actualAmount)}
                  </td>

                  <td className="tabular-nums font-semibold">
                    {hasDiscrepancy ? (
                      <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-xs">
                        {formatCurrency(variance)}
                      </span>
                    ) : (
                      <span className="text-emerald-700 text-xs">—</span>
                    )}
                  </td>

                  <td>
                    <div className="text-xs font-medium text-slate-800">
                      {tx.exceptionType && tx.exceptionType !== 'NONE' ? (
                        <span className="text-rose-700 font-semibold">
                          {readableException(tx.exceptionType)}
                        </span>
                      ) : (
                        <span className="text-emerald-700">None (Reconciled)</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <RiskBadge risk={tx.risk} />
                  </td>

                  <td>
                    <SettlementStatusBadge status={tx.settlementStatus || 'settled'} />
                  </td>

                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {onSimulate && tx.status === 'Exception' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onSimulate(tx.id)
                          }}
                          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md transition"
                          title="Run Counterfactual Analysis"
                        >
                          <Sparkles size={15} />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelect(tx)
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition"
                        title="Investigate Transaction"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="data-table-foot">
        <div>
          Showing <strong className="text-slate-900">{startIndex + 1}</strong> to{' '}
          <strong className="text-slate-900">
            {Math.min(startIndex + pageSize, sortedTransactions.length)}
          </strong>{' '}
          of <strong className="text-slate-900">{sortedTransactions.length}</strong>{' '}
          records
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="btn btn-secondary btn-sm disabled:opacity-40 disabled:cursor-not-allowed p-1.5"
            aria-label="Previous Page"
          >
            <ChevronLeft size={15} />
          </button>

          <span className="text-xs font-semibold text-slate-700 px-2">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="btn btn-secondary btn-sm disabled:opacity-40 disabled:cursor-not-allowed p-1.5"
            aria-label="Next Page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
