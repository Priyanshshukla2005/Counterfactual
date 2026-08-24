'use client'

import React from 'react'
import type { TransactionFilters as FilterType } from '@/types'
import { Filter, X, Search, SlidersHorizontal } from 'lucide-react'

interface TransactionFiltersProps {
  filters: FilterType
  setFilters: React.Dispatch<React.SetStateAction<FilterType>>
  totalCount: number
  filteredCount: number
  availableRails?: string[]
}

export function TransactionFilters({
  filters,
  setFilters,
  totalCount,
  filteredCount,
  availableRails = ['CARD', 'UPI', 'WALLET', 'NETBANKING'],
}: TransactionFiltersProps) {
  const isFiltered =
    filters.query !== '' ||
    filters.status !== 'ALL' ||
    filters.risk !== 'ALL' ||
    filters.exceptionType !== 'ALL' ||
    filters.rail !== 'ALL'

  const resetFilters = () => {
    setFilters({
      query: '',
      status: 'ALL',
      risk: 'ALL',
      exceptionType: 'ALL',
      rail: 'ALL',
    })
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5 shadow-xs mb-4">
      {/* Top row: Status Tabs & Quick Counts */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-md">
          {(['ALL', 'Reconciled', 'Exception'] as const).map((st) => {
            const isActive = filters.status === st
            return (
              <button
                key={st}
                onClick={() => setFilters((prev) => ({ ...prev, status: st }))}
                className={`px-3 py-1 text-xs font-semibold rounded transition ${
                  isActive
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All Transactions' : st === 'Reconciled' ? 'Matched' : 'Exceptions Only'}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-900">{filteredCount}</strong> of{' '}
            {totalCount} records
          </span>
          {isFiltered && (
            <button
              onClick={resetFilters}
              className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
            >
              <X size={12} />
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Bottom Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
        {/* Risk Filter */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">
            Risk Tier
          </label>
          <select
            value={filters.risk}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, risk: e.target.value as any }))
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="High">High Risk</option>
            <option value="Medium">Medium Risk</option>
            <option value="Low">Low Risk</option>
          </select>
        </div>

        {/* Exception Type */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">
            Exception Class
          </label>
          <select
            value={filters.exceptionType}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, exceptionType: e.target.value }))
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
          >
            <option value="ALL">All Exception Types</option>
            <option value="MISSING_SETTLEMENT">Missing Settlement</option>
            <option value="DUPLICATE">Duplicate Settlement</option>
            <option value="DELAYED_SETTLEMENT">Delayed Settlement</option>
            <option value="PARTIAL_REFUND">Partial Refund Mismatch</option>
            <option value="FEE_MISMATCH">Fee Mismatch</option>
          </select>
        </div>

        {/* Payment Rail */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">
            Payment Rail
          </label>
          <select
            value={filters.rail}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, rail: e.target.value }))
            }
            className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-indigo-500 outline-none"
          >
            <option value="ALL">All Payment Rails</option>
            {availableRails.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Search */}
        <div>
          <label className="text-[11px] font-semibold text-slate-500 block mb-1">
            Ledger Search
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Filter by ID or Reason..."
              value={filters.query}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, query: e.target.value }))
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-md pl-7 pr-2.5 py-1.5 text-slate-800 focus:bg-white focus:border-indigo-500 outline-none text-xs"
            />
            <Search size={13} className="absolute left-2 top-2.5 text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  )
}
