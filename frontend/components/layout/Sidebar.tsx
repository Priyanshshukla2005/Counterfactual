'use client'

import React from 'react'
import type { NavSection } from '@/types'
import { useAuth, getInitials } from '@/lib/auth-context'
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Sparkles,
  BarChart3,
  ChevronDown,
  Building2,
  X,
  Cpu,
} from 'lucide-react'

interface SidebarProps {
  active: NavSection
  onNavigate: (section: NavSection) => void
  totalExceptions: number
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export function Sidebar({
  active,
  onNavigate,
  totalExceptions,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { user } = useAuth()
  const userInitials = getInitials(user?.name)
  const workspaceName = user?.organization || 'Counterfactual Treasury'

  const handleNavClick = (section: NavSection) => {
    onNavigate(section)
    if (onCloseMobile) onCloseMobile()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`sidebar transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } fixed lg:sticky top-0 z-50`}
      >
        {/* Brand Header */}
        <div className="sidebar-header">
          <div className="flex items-center justify-between">
            <div className="brand-row">
              <div className="brand-icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M19 6.5C17.5 4.5 15.2 3.5 12.5 3.5C7.8 3.5 4 7.3 4 12C4 16.7 7.8 20.5 12.5 20.5C15.2 20.5 17.5 19.5 19 17.5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M14 12H21"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="brand-text">
                <strong>Counterfactual</strong>
                <small>Fintech Intelligence</small>
              </div>
            </div>

            {mobileOpen && (
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1 text-slate-400 hover:text-white rounded"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Workspace selector */}
          <div className="workspace-pill mt-3 cursor-pointer hover:border-slate-600 transition">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 size={13} className="text-indigo-400 shrink-0" />
              <span className="truncate text-slate-200">{workspaceName}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <ChevronDown size={12} className="text-slate-400" />
            </div>
          </div>
        </div>

        {/* Section Navigator */}
        <div className="sidebar-nav space-y-4">
          {/* Group 1: Ledger Operations */}
          <div>
            <div className="nav-group-label">Ledger Operations</div>
            <button
              className={`nav-item cursor-pointer ${active === 'Overview' ? 'active' : ''}`}
              onClick={() => handleNavClick('Overview')}
              title="Jump to Overview & Settlement Performance"
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard size={16} className="nav-icon" />
                <span>Overview</span>
              </div>
              {active === 'Overview' && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
              )}
            </button>

            <button
              className={`nav-item cursor-pointer ${active === 'Transactions' ? 'active' : ''}`}
              onClick={() => handleNavClick('Transactions')}
              title="Jump to Transactions Workspace"
            >
              <div className="flex items-center gap-2.5">
                <Activity size={16} className="nav-icon" />
                <span>Transactions</span>
              </div>
              {active === 'Transactions' && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
              )}
            </button>

            <button
              className={`nav-item cursor-pointer ${active === 'Exceptions' ? 'active' : ''}`}
              onClick={() => handleNavClick('Exceptions')}
              title="Jump to Exceptions Queue"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={16} className="nav-icon text-amber-500" />
                <span>Exceptions</span>
              </div>
              {totalExceptions > 0 ? (
                <span className="kpi-badge-negative px-1.5 py-0.2 text-[10px]">
                  {totalExceptions}
                </span>
              ) : active === 'Exceptions' ? (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
              ) : null}
            </button>
          </div>

          {/* Group 2: Decision Intelligence */}
          <div>
            <div className="nav-group-label">Decision Intelligence</div>
            <button
              className={`nav-item cursor-pointer ${active === 'Counterfactuals' ? 'active' : ''}`}
              onClick={() => handleNavClick('Counterfactuals')}
              title="Jump to Counterfactual Studio & 3D Simulator"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className="nav-icon text-indigo-400" />
                <span>Counterfactuals</span>
              </div>
              <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-500/40 px-1.5 py-0.5 rounded shadow-2xs">
                3D STUDIO
              </span>
            </button>
          </div>

          {/* Group 3: Executive Audit */}
          <div>
            <div className="nav-group-label">Executive Audit</div>
            <button
              className={`nav-item cursor-pointer ${active === 'Reports' ? 'active' : ''}`}
              onClick={() => handleNavClick('Reports')}
              title="Jump to Reports & Analytics"
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 size={16} className="nav-icon" />
                <span>Reports & Analytics</span>
              </div>
              {active === 'Reports' && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="sidebar-footer space-y-3">
          {/* Live Engine Status */}
          <div className="engine-status-pill">
            <span className="status-beacon" />
            <div className="flex items-center justify-between flex-1">
              <span>ENGINE ACTIVE</span>
              <span className="text-[10px] font-mono text-emerald-400">100 ENTITIES</span>
            </div>
          </div>

          {/* Authenticated User */}
          <div className="flex items-center gap-2.5 pt-2 border-t border-slate-800/80">
            <div className="user-avatar">{userInitials}</div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-100 text-xs truncate">
                {user?.name || 'Treasury Operator'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {user?.email || 'authenticated@counterfactual.fi'}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
