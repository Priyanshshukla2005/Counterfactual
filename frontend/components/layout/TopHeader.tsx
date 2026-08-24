'use client'

import React from 'react'
import type { NavSection } from '@/types'
import { UserMenu } from '@/components/layout/UserMenu'
import {
  Search,
  RefreshCw,
  Bell,
  Menu,
  Database,
} from 'lucide-react'

interface TopHeaderProps {
  active: NavSection
  query: string
  setQuery: (q: string) => void
  onSync: () => void
  isSyncing?: boolean
  onOpenMobile?: () => void
}

export function TopHeader({
  active,
  query,
  setQuery,
  onSync,
  isSyncing,
  onOpenMobile,
}: TopHeaderProps) {
  const getSearchPlaceholder = () => {
    switch (active) {
      case 'Transactions':
        return 'Search by Transaction ID, Order, Rail, Customer...'
      case 'Exceptions':
        return 'Search open exceptions by ID, type, or exposure...'
      case 'Counterfactuals':
        return 'Search simulation queue by transaction ID...'
      case 'Reports':
        return 'Filter report metrics and exception audits...'
      default:
        return 'Quick search transactions, exceptions, counterparties...'
    }
  }

  return (
    <header className="topbar">
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-700 rounded-md hover:bg-slate-100"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <div className="search-box">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder={getSearchPlaceholder()}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="search-kbd hidden sm:inline-block">⌘K</kbd>
        </div>
      </div>

      <div className="topbar-actions">
        {/* Settlement Status Chip */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <Database size={13} className="text-emerald-600" />
          <span>Engine Active</span>
        </div>

        {/* Sync Trigger */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="btn btn-secondary btn-sm"
          title="Re-run reconciliation on latest ledger"
        >
          <RefreshCw size={14} className={isSyncing ? 'spin text-indigo-600' : 'text-slate-500'} />
          <span className="hidden sm:inline">{isSyncing ? 'Reconciling...' : 'Sync Engine'}</span>
        </button>

        {/* Notifications */}
        <button
          className="btn-icon relative"
          aria-label="View system notifications"
        >
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
        </button>

        {/* Authenticated User Account Menu */}
        <UserMenu align="right" />
      </div>
    </header>
  )
}
