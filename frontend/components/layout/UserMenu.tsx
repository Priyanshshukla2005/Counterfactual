'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useAuth, getInitials } from '@/lib/auth-context'
import {
  LogOut,
  User as UserIcon,
  Building,
  Shield,
  Check,
  ChevronDown,
  Settings,
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
        className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-indigo-100 transition"
        aria-label="User account menu"
      >
        <div className="user-avatar">{initials}</div>
      </button>

      {open && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-xs divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* User Profile Header */}
          <div className="p-4 bg-slate-50 space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="user-avatar">{initials}</div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 truncate">
                  {user.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {user.email}
                </div>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-600 flex items-center gap-1.5 font-medium">
              <Building size={12} className="text-slate-400" />
              <span className="truncate">{user.organization || 'Counterfactual Treasury'}</span>
            </div>
          </div>

          {/* Menu Actions */}
          <div className="p-1 space-y-0.5">
            <div className="px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md cursor-pointer flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-slate-400" />
                <span>Role: Treasury Operator</span>
              </div>
              <Check size={12} className="text-emerald-600" />
            </div>

            <div
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-md cursor-pointer flex items-center gap-2"
            >
              <Settings size={14} className="text-slate-400" />
              <span>Workspace Preferences</span>
            </div>
          </div>

          {/* Logout Action */}
          <div className="p-1">
            <button
              onClick={async () => {
                setOpen(false)
                await logout()
              }}
              className="w-full px-3 py-2 text-rose-700 hover:bg-rose-50 rounded-md flex items-center gap-2 font-semibold transition"
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
