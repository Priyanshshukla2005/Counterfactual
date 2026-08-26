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
  Compass,
} from 'lucide-react'

interface SidebarProps {
  active: NavSection
  onNavigate: (section: NavSection) => void
  totalExceptions: number
  mobileOpen?: boolean
  onCloseMobile?: () => void
  onOpenDemo?: () => void
}

export function Sidebar({
  active,
  onNavigate,
  totalExceptions,
  mobileOpen,
  onCloseMobile,
  onOpenDemo,
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
          {/* Group 1: Payment Operations */}
          <div>
            <div className="nav-group-label">Payment Operations</div>
            <button
              className={`nav-item cursor-pointer ${active === 'Overview' ? 'active' : ''}`}
              onClick={() => handleNavClick('Overview')}
              title="Jump to Overview & Payment Performance"
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
              title="Jump to Payments Ledger"
            >
              <div className="flex items-center gap-2.5">
                <Activity size={16} className="nav-icon" />
                <span>Payments</span>
              </div>
              {active === 'Transactions' && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
              )}
            </button>

            <button
              className={`nav-item cursor-pointer ${active === 'Exceptions' ? 'active' : ''}`}
              onClick={() => handleNavClick('Exceptions')}
              title="Jump to Payments That Need Attention"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={16} className="nav-icon text-amber-500" />
                <span>Problems to Review</span>
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

          {/* Group 2: Business Impact & Simulation */}
          <div>
            <div className="nav-group-label">Impact & Simulation</div>
            <button
              className={`nav-item cursor-pointer ${active === 'Counterfactuals' ? 'active' : ''}`}
              onClick={() => handleNavClick('Counterfactuals')}
              title="Jump to What-If Simulator & 3D Impact Viewer"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className="nav-icon text-indigo-400" />
                <span>What-If Simulator</span>
              </div>
              <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-500/40 px-1.5 py-0.5 rounded shadow-2xs">
                SIMULATE
              </span>
            </button>

            <button
              className={`nav-item cursor-pointer ${active === 'Monitoring' ? 'active' : ''}`}
              onClick={() => handleNavClick('Monitoring')}
              title="Jump to Prediction Performance & Outcome Review"
            >
              <div className="flex items-center gap-2.5">
                <Compass size={16} className="nav-icon text-emerald-400" />
                <span>Prediction Review</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.5 rounded shadow-2xs">
                FEEDBACK
              </span>
            </button>
          </div>

          {/* Group 3: Reports & Review */}
          <div>
            <div className="nav-group-label">Reports & Review</div>
            <button
              className={`nav-item cursor-pointer ${active === 'Reports' ? 'active' : ''}`}
              onClick={() => handleNavClick('Reports')}
              title="Jump to Reports & Payment Review"
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 size={16} className="nav-icon" />
                <span>Reports & Review</span>
              </div>
              {active === 'Reports' && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
              )}
            </button>
          </div>

          {/* Group 4: Interactive Demo Mode */}
          {onOpenDemo && (
            <div>
              <div className="nav-group-label">Interactive Story Demo</div>
              <button
                className="w-full flex items-center justify-between p-2.5 bg-gradient-to-r from-indigo-950/60 to-slate-900 border border-indigo-500/40 hover:border-indigo-400 text-indigo-200 hover:text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-950/40 transition group cursor-pointer"
                onClick={onOpenDemo}
                title="Launch Interactive 8-Stage Story Demo"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-indigo-400 group-hover:scale-110 transition animate-pulse" />
                  <span>Interactive Demo</span>
                </div>
                <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
                  8-STAGE
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sidebar-footer space-y-3">
          {/* Live Engine Status */}
          <div className="engine-status-pill">
            <span className="status-beacon" />
            <div className="flex items-center justify-between flex-1">
              <span>PAYMENTS CHECKED</span>
              <span className="text-[10px] font-mono text-emerald-400">100 RECORDS</span>
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
