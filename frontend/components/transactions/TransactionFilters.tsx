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
    <div className="card-panel p-4 space-y-4 mb-4">
      {/* Top row: Status Tabs & Quick Counts */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-lg border border-slate-800">
          {(['ALL', 'Reconciled', 'Exception'] as const).map((st) => {
            const isActive = filters.status === st
            return (
              <button
                key={st}
                onClick={() => setFilters((prev) => ({ ...prev, status: st }))}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'All Transactions' : st === 'Reconciled' ? 'Matched' : 'Exceptions Only'}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>
            Displaying <strong className="text-white tabular-nums">{filteredCount}</strong> of{' '}
            <strong className="text-slate-300 tabular-nums">{totalCount}</strong> ledger records
          </span>
          {isFiltered && (
            <button
              onClick={resetFilters}
              className="text-xs text-indigo-400 font-bold hover:text-indigo-300 flex items-center gap-1 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30 transition"
            >
              <X size={12} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {/* Risk Filter */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Risk Tier
          </label>
          <select
            value={filters.risk}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, risk: e.target.value as any }))
            }
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 focus:border-indigo-500 outline-none transition"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="High">High Risk Tier</option>
            <option value="Medium">Medium Risk Tier</option>
            <option value="Low">Low Risk Tier</option>
          </select>
        </div>

        {/* Exception Type */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Exception Class
          </label>
          <select
            value={filters.exceptionType}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, exceptionType: e.target.value }))
            }
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 focus:border-indigo-500 outline-none transition"
          >
            <option value="ALL">All Exception Classes</option>
            <option value="MISSING_SETTLEMENT">Missing Settlement</option>
            <option value="DUPLICATE">Duplicate Settlement</option>
            <option value="DELAYED_SETTLEMENT">Delayed Settlement</option>
            <option value="PARTIAL_REFUND">Partial Refund Mismatch</option>
            <option value="FEE_MISMATCH">Fee Mismatch</option>
          </select>
        </div>

        {/* Payment Rail */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Payment Rail
          </label>
          <select
            value={filters.rail}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, rail: e.target.value }))
            }
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-2 text-slate-200 focus:border-indigo-500 outline-none transition"
          >
            <option value="ALL">All Payment Rails</option>
            {availableRails.map((r) => (
              <option key={r} value={r}>
                {r} Instrument
              </option>
            ))}
          </select>
        </div>

        {/* Quick Search */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Ledger Search
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search reference, order, ID..."
              value={filters.query}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, query: e.target.value }))
              }
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg pl-8 pr-3 py-2 text-slate-200 focus:border-indigo-500 outline-none text-xs transition"
            />
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
          </div>
        </div>
      </div>
    </div>
  )
}
