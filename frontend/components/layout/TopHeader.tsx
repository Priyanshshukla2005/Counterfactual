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
  onOpenDemo?: () => void
  onOpenImport?: () => void
}

export function TopHeader({
  active,
  query,
  setQuery,
  onSync,
  isSyncing,
  onOpenMobile,
  onOpenDemo,
  onOpenImport,
}: TopHeaderProps) {
  const getSearchPlaceholder = () => {
    switch (active) {
      case 'Transactions':
        return 'Search payments by ID, Order, Method, Customer...'
      case 'Exceptions':
        return 'Search payments that need attention...'
      case 'Counterfactuals':
        return 'Search what-if scenarios by ID or payment method...'
      case 'Reports':
        return 'Filter reports and payment reviews...'
      default:
        return 'Search your payments, customers, or problems...'
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
        {/* CSV Payment Importer */}
        {onOpenImport && (
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
            title="Import custom merchant payment records (CSV)"
          >
            <Database size={13} className="text-indigo-400" />
            <span className="hidden sm:inline">Import Payments</span>
          </button>
        )}

        {/* Live Demo Experience Launcher */}
        {onOpenDemo && (
          <button
            onClick={onOpenDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/20 transition transform hover:scale-[1.02] cursor-pointer"
            title="Launch Interactive 8-Stage Story Demo"
          >
            <Sparkles size={13} className="animate-pulse" />
            <span>LIVE DEMO</span>
          </button>
        )}

        {/* Real-time Status Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-emerald-950/80 border border-emerald-500/30 rounded-lg text-xs font-bold text-emerald-400 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
          <span>PAYMENT CHECK ACTIVE</span>
        </div>

        {/* Sync Trigger */}
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="btn btn-secondary btn-sm"
          title="Re-check payments and calculate differences"
        >
          <RefreshCw size={13} className={isSyncing ? 'spin text-indigo-400' : 'text-slate-400'} />
          <span className="hidden sm:inline">{isSyncing ? 'Checking...' : 'Check Payments'}</span>
        </button>

        {/* Notifications */}
        <button
          className="btn-icon relative"
          aria-label="Alerts & problems"
          title="Payment alerts"
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
