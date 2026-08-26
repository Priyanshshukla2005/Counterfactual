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
  Cpu,
  Sparkles,
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
        return 'Search ledger by Transaction ID, Order, Rail, Customer...'
      case 'Exceptions':
        return 'Filter open exception records by exposure, type, status...'
      case 'Counterfactuals':
        return 'Search simulation targets by transaction ID or rail...'
      case 'Reports':
        return 'Filter executive audit analytics...'
      default:
        return 'Quick search ledger records, counterparties, or exceptions...'
    }
  }

  return (
    <header className="topbar">
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <div className="search-box">
          <Search size={15} className="text-slate-400 shrink-0" />
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
        {/* Real-time Status Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-950/80 border border-emerald-500/30 rounded-lg text-xs font-bold text-emerald-400 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
          <Cpu size={13} className="text-emerald-400" />
          <span>ENGINE ACTIVE</span>
        </div>

        {/* Sync Trigger */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="btn btn-secondary btn-sm"
          title="Re-run reconciliation engine on latest settlement feed"
        >
          <RefreshCw size={13} className={isSyncing ? 'spin text-indigo-400' : 'text-slate-400'} />
          <span className="hidden sm:inline">{isSyncing ? 'Reconciling...' : 'Sync Engine'}</span>
        </button>

        {/* Notifications */}
        <button
          className="btn-icon relative"
          aria-label="System alerts & notifications"
          title="System notifications"
        >
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-slate-900" />
        </button>

        {/* Authenticated User Account Menu */}
        <UserMenu align="right" />
      </div>
    </header>
  )
}
