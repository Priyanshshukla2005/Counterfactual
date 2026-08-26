'use client'

import React, { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User as UserIcon,
  Building2,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react'

export function AuthScreen() {
  const { login, signup } = useAuth()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [organization, setOrganization] = useState('')
  const [rememberMe, setRememberMe] = useState(true)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid work email address.')
      return
    }

    if (!password) {
      setError('Please enter your password.')
      return
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Please enter your full name.')
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify and try again.')
        return
      }
    }

    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        await login({
          email: trimmedEmail,
          password,
          rememberMe,
        })
      } else {
        await signup({
          name: name.trim(),
          email: trimmedEmail,
          password,
          organization: organization.trim() || 'Counterfactual Treasury',
        })
      }
    } catch (err: any) {
      setError(
        err?.message ||
          (mode === 'login'
            ? 'Unable to sign in. Please check your credentials and try again.'
            : 'Unable to create account. Please try again.')
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 relative z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-sky-600 text-white shadow-[0_0_25px_rgba(99,102,241,0.4)] mx-auto border border-white/20">
          <svg
            width="28"
            height="28"
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

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Counterfactual
          </h1>
          <p className="text-xs text-indigo-400 font-bold tracking-widest uppercase mt-1">
            Settlement Intelligence Platform
          </p>
        </div>
      </div>

      {/* Auth Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="card-panel py-8 px-6 sm:px-10 space-y-6 shadow-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white">
              {mode === 'login' ? 'Sign in to treasury control' : 'Create treasury account'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {mode === 'login'
                ? 'Access your settlement ledger, exception queue, and 3D simulation engine.'
                : 'Get started with intelligent reconciliation and counterfactual analysis.'}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Priyansh Shukla"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 outline-none transition"
                    />
                    <UserIcon size={14} className="absolute left-3 top-2.5 text-slate-500" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Treasury Organization
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. Acme Treasury Corp"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 outline-none transition"
                    />
                    <Building2 size={14} className="absolute left-3 top-2.5 text-slate-500" />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Work Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="operator@company.fi"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 outline-none transition"
                />
                <Mail size={14} className="absolute left-3 top-2.5 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-9 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 outline-none transition"
                />
                <Lock size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-9 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 outline-none transition"
                  />
                  <Lock size={14} className="absolute left-3 top-2.5 text-slate-500" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded accent-indigo-600 bg-slate-950"
                  />
                  <span className="text-slate-400">Remember session</span>
                </label>

                <span className="text-indigo-400 hover:underline cursor-pointer">
                  Default credentials seeded
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full py-2.5 font-bold shadow-lg"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  <span>Authenticating...</span>
                </>
              ) : mode === 'login' ? (
                <>
                  <span>Sign In to Platform</span>
                  <ArrowRight size={14} />
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          {/* Mode Switcher */}
          <div className="text-center pt-2 border-t border-slate-800 text-xs">
            {mode === 'login' ? (
              <p className="text-slate-400">
                Need a treasury account?{' '}
                <button
                  onClick={() => {
                    setMode('signup')
                    setError(null)
                  }}
                  className="text-indigo-400 font-bold hover:underline"
                >
                  Register here
                </button>
              </p>
            ) : (
              <p className="text-slate-400">
                Already registered?{' '}
                <button
                  onClick={() => {
                    setMode('login')
                    setError(null)
                  }}
                  className="text-indigo-400 font-bold hover:underline"
                >
                  Sign in here
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
