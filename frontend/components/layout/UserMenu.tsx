'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useAuth, getInitials } from '@/lib/auth-context'
import {
  LogOut,
  Building,
  Shield,
  Check,
  Settings,
  User as UserIcon,
} from 'lucide-react'

interface UserMenuProps {
  align?: 'left' | 'right'
}

export function UserMenu({ align = 'right' }: UserMenuProps) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials = getInitials(user?.name)

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  if (!user) return null

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-indigo-500/50 transition cursor-pointer"
        aria-label="User account menu"
      >
        <div className="user-avatar">{initials}</div>
      </button>

      {open && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-2 w-68 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-50 overflow-hidden text-xs divide-y divide-slate-800 animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* User Profile Header */}
          <div className="p-4 bg-slate-950/80 space-y-2">
            <div className="flex items-center gap-3">
              <div className="user-avatar">{initials}</div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-white text-sm truncate">
                  {user.name}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {user.email}
                </div>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-300 flex items-center gap-1.5 font-medium border-t border-slate-800/80">
              <Building size={12} className="text-indigo-400 shrink-0" />
              <span className="truncate">{user.organization || 'Counterfactual Treasury'}</span>
            </div>
          </div>

          {/* Menu Actions */}
          <div className="p-1.5 space-y-0.5">
            <div className="px-3 py-2 text-slate-300 hover:bg-slate-800/70 rounded-lg cursor-pointer flex items-center justify-between transition">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-indigo-400" />
                <span>Role: {user.role || 'Treasury Operator'}</span>
              </div>
              <Check size={13} className="text-emerald-400" />
            </div>

            <div
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-slate-300 hover:bg-slate-800/70 rounded-lg cursor-pointer flex items-center gap-2 transition"
            >
              <Settings size={14} className="text-slate-400" />
              <span>Workspace Preferences</span>
            </div>
          </div>

          {/* Logout Action */}
          <div className="p-1.5 bg-slate-950/40">
            <button
              onClick={async () => {
                setOpen(false)
                await logout()
              }}
              className="w-full px-3 py-2 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 rounded-lg flex items-center gap-2 font-bold transition cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
