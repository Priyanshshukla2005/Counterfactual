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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Hydrate session on initial client load
  useEffect(() => {
    async function restoreSession() {
      try {
        const savedToken =
          localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)

        if (savedToken) {
          const res = await apiGetMe(savedToken)
          setUser(res.user)
          setToken(savedToken)
        }
      } catch (err) {
        console.warn('Session restoration expired or failed:', err)
        localStorage.removeItem(TOKEN_KEY)
        sessionStorage.removeItem(TOKEN_KEY)
      } finally {
        setIsLoading(false)
      }
    }

    restoreSession()
  }, [])

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true)
    try {
      const res = await apiLogin(credentials)
      setUser(res.user)
      setToken(res.token)

      if (credentials.rememberMe) {
        localStorage.setItem(TOKEN_KEY, res.token)
        localStorage.setItem(REMEMBER_KEY, 'true')
      } else {
        sessionStorage.setItem(TOKEN_KEY, res.token)
        localStorage.removeItem(TOKEN_KEY)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (credentials: SignupCredentials) => {
    setIsLoading(true)
    try {
      const res = await apiSignup(credentials)
      setUser(res.user)
      setToken(res.token)
      sessionStorage.setItem(TOKEN_KEY, res.token)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    const currentToken = token
    setUser(null)
    setToken(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REMEMBER_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    await apiLogout(currentToken || undefined)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
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
