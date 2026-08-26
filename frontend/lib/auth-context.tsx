'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, LoginCredentials, SignupCredentials } from '@/types'
import { apiLogin, apiSignup, apiGetMe, apiLogout } from '@/lib/api'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  signup: (credentials: SignupCredentials) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'cf_auth_token'
const REMEMBER_KEY = 'cf_remember_me'

export function getInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function getGreeting(name?: string | null): string {
  const hour = new Date().getHours()
  let period = 'Good morning'
  if (hour >= 12 && hour < 17) {
    period = 'Good afternoon'
  } else if (hour >= 17) {
    period = 'Good evening'
  }

  if (!name || !name.trim()) return period

  const firstName = name.trim().split(/\s+/)[0]
  return `${period}, ${firstName}`
}

function persistToken(token: string, rememberMe?: boolean) {
  if (rememberMe) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(REMEMBER_KEY, 'true')
    sessionStorage.removeItem(TOKEN_KEY)
  } else {
    sessionStorage.setItem(TOKEN_KEY, token)
    localStorage.removeItem(TOKEN_KEY)
  }
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REMEMBER_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(true)

  // Hydrate session on initial client load only — never reuse this flag for login/signup.
  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        const savedToken =
          localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)

        if (!savedToken) {
          return
        }

        const res = await apiGetMe(savedToken)
        if (cancelled) return

        if (!res?.user) {
          clearStoredToken()
          return
        }

        setToken(savedToken)
        setUser(res.user)
      } catch (err) {
        console.warn('Session restoration expired or failed:', err)
        clearStoredToken()
      } finally {
        if (!cancelled) {
          setIsRestoring(false)
        }
      }
    }

    restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  const login = async (credentials: LoginCredentials) => {
    const res = await apiLogin(credentials)
    if (!res?.token || !res?.user) {
      throw new Error('Invalid authentication response from server.')
    }
    persistToken(res.token, credentials.rememberMe)
    setToken(res.token)
    setUser(res.user)
  }

  const signup = async (credentials: SignupCredentials) => {
    const res = await apiSignup(credentials)
    if (!res?.token || !res?.user) {
      throw new Error('Invalid authentication response from server.')
    }
    persistToken(res.token, false)
    setToken(res.token)
    setUser(res.user)
  }

  const logout = async () => {
    const currentToken = token
    setUser(null)
    setToken(null)
    clearStoredToken()
    await apiLogout(currentToken || undefined)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading: isRestoring,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
