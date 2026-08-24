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
  ShieldCheck,
  Building2,
  X,
} from 'lucide-react'

interface SidebarProps {
  active: NavSection
  setActive: (section: NavSection) => void
  totalExceptions: number
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export function Sidebar({
  active,
  setActive,
  totalExceptions,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { user } = useAuth()
  const userInitials = getInitials(user?.name)
  const workspaceName = user?.organization || 'Counterfactual Treasury'

  const navItems: { label: NavSection; icon: React.ElementType; badge?: string | number; isAi?: boolean }[] = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Transactions', icon: Activity },
    { label: 'Exceptions', icon: AlertTriangle, badge: totalExceptions > 0 ? totalExceptions : undefined },
    { label: 'Counterfactuals', icon: Sparkles, isAi: true },
    { label: 'Reports', icon: BarChart3 },
  ]

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
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
                <small>Settlement Intelligence</small>
              </div>
            </div>

            {mobileOpen && (
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Workspace selector */}
          <div className="workspace-pill cursor-pointer">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 size={13} className="text-slate-500 shrink-0" />
              <span className="truncate">{workspaceName}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="workspace-status-dot" title="Connected to Settlement Engine" />
              <ChevronDown size={13} className="text-slate-400" />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="sidebar-nav">
          <div className="nav-section-label">Core Platform</div>
          {navItems.map(({ label, icon: Icon, badge, isAi }) => {
            const isActive = active === label
            return (
              <button
                key={label}
                className={`nav-button ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActive(label)
                  if (onCloseMobile) onCloseMobile()
                }}
              >
                <Icon size={17} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                <span>{label}</span>

                {badge !== undefined && (
                  <span className="nav-badge">{badge}</span>
                )}

                {isAi && (
                  <span className="nav-badge-ai">AI ENGINE</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="system-health-chip">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span className="font-medium text-slate-700">Deterministic Engine</span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              100% OK
            </span>
          </div>

          <div className="user-profile-row">
            <div className="user-avatar">{userInitials}</div>
            <div className="user-info min-w-0">
              <strong className="truncate">{user?.name || 'Treasury Operator'}</strong>
              <small className="truncate">{user?.email || 'Authenticated User'}</small>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
