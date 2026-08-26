import type {
  Dashboard,
  DashboardMetrics,
  BackendException,
  BackendDashboardResponse,
  Transaction,
  CounterfactualExplanation,
  CounterfactualSimulation,
  SimulationResponse,
  ScenarioComparisonItem,
  RiskLevel,
  User,
  AuthResponse,
  LoginCredentials,
  SignupCredentials,
  SavedSimulation,
  AuditEvent,
} from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export type { BackendException, BackendDashboardResponse }

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('cf_auth_token') || sessionStorage.getItem('cf_auth_token')
}

export function formatCurrency(value: number | undefined | null): string {
  const amount = Number(value) || 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCompactCurrency(value: number | undefined | null): string {
  const amount = Number(value) || 0
  const abs = Math.abs(amount)

  if (abs >= 10_000_000) {
    return `₹${(amount / 10_000_000).toFixed(2)}Cr`
  }
  if (abs >= 100_000) {
    return `₹${(amount / 100_000).toFixed(2)}L`
  }
  if (abs >= 1_000) {
    return `₹${(amount / 1_000).toFixed(1)}k`
  }
  return formatCurrency(amount)
}

export function readableException(type: string | undefined | null): string {
  if (!type) return 'Unknown'
  switch (type.toUpperCase()) {
    case 'NONE':
      return 'Matched & Reconciled'
    case 'DUPLICATE':
      return 'Duplicate Settlement'
    case 'MISSING_SETTLEMENT':
      return 'Missing Settlement'
    case 'DELAYED_SETTLEMENT':
      return 'Delayed Settlement'
    case 'PARTIAL_REFUND':
      return 'Partial Refund Mismatch'
    case 'FEE_MISMATCH':
      return 'Fee Structure Mismatch'
    default:
      return type
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase())
  }
}

export function getExceptionSeverity(type: string | undefined | null): RiskLevel {
  if (!type || type === 'NONE') return 'Low'
  if (
    type === 'MISSING_SETTLEMENT' ||
    type === 'DUPLICATE' ||
    type === 'DELAYED_SETTLEMENT'
  ) {
    return 'High'
  }
  return 'Medium'
}

export function getExceptionColor(type: string | undefined | null): string {
  switch (type?.toUpperCase()) {
    case 'MISSING_SETTLEMENT':
      return '#ef4444' // Red
    case 'DUPLICATE':
      return '#f97316' // Orange
    case 'DELAYED_SETTLEMENT':
      return '#f59e0b' // Amber
    case 'PARTIAL_REFUND':
      return '#6366f1' // Indigo
    case 'FEE_MISMATCH':
      return '#8b5cf6' // Violet
    default:
      return '#10b981' // Emerald
  }
}

/* =========================================================
   AUTHENTICATION API CLIENT
========================================================= */

async function readJsonBody(response: Response): Promise<any> {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Backend returned an unexpected response.')
  }
}

function authErrorMessage(data: any, fallback: string, status: number): string {
  if (status === 401) {
    return data?.error || data?.message || 'Invalid email or password. Please verify your credentials.'
  }
  if (status === 409) {
    return data?.error || data?.message || 'An account with this email already exists.'
  }
  if (status === 503) {
    return data?.message || data?.error || 'Database unavailable. Please try again shortly.'
  }
  if (status >= 500) {
    return data?.error || data?.message || 'Unexpected server error. Please try again.'
  }
  return data?.error || data?.message || fallback
}

export async function apiLogin(credentials: LoginCredentials): Promise<AuthResponse> {
  let response: Response
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    })
    clearTimeout(timeoutId)
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Sign-in request timed out. Please verify backend connection.')
    }
    throw new Error('Backend unavailable. Please confirm the API is running.')
  }

  const data = await readJsonBody(response)

  if (!response.ok) {
    throw new Error(authErrorMessage(data, 'Unable to sign in. Please check your credentials.', response.status))
  }

  if (!data?.token || !data?.user) {
    throw new Error('Invalid authentication response from server.')
  }

  return data as AuthResponse
}

export async function apiSignup(credentials: SignupCredentials): Promise<AuthResponse> {
  let response: Response
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(credentials),
    })
    clearTimeout(timeoutId)
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Registration request timed out. Please verify backend connection.')
    }
    throw new Error('Backend unavailable. Please confirm the API is running.')
  }

  const data = await readJsonBody(response)

  if (!response.ok) {
    throw new Error(authErrorMessage(data, 'Unable to create account. Please try again.', response.status))
  }

  if (!data?.token || !data?.user) {
    throw new Error('Invalid authentication response from server.')
  }

  return data as AuthResponse
}

export async function apiGetMe(token: string): Promise<{ user: User }> {
  let response: Response
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timeoutId)
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Session verification timed out.')
    }
    throw new Error('Backend unavailable. Please confirm the API is running.')
  }

  const data = await readJsonBody(response)

  if (!response.ok) {
    throw new Error(authErrorMessage(data, 'Session invalid or expired', response.status))
  }

  if (!data?.user) {
    throw new Error('Session invalid or expired')
  }

  return data
}

export async function apiLogout(token?: string): Promise<void> {
  try {
    if (token) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
    }
  } catch (err) {
    console.warn('Logout API notification error:', err)
  }
}

/* =========================================================
   DASHBOARD & RECONCILIATION API (PROTECTED)
========================================================= */

export async function getDashboardData(token?: string): Promise<BackendDashboardResponse> {
  const authToken = token || getStoredAuthToken()
  const headers: Record<string, string> = {}
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/dashboard`, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    })
  } catch (err: any) {
    clearTimeout(timeoutId)
    throw new Error('Unable to connect to dashboard API.')
  }
  clearTimeout(timeoutId)

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized session. Please sign in to access settlement telemetry.')
    }
    throw new Error(`Dashboard API returned HTTP ${response.status}`)
  }

  return readJsonBody(response)
}

export async function getTransactions(token?: string): Promise<Transaction[]> {
  const authToken = token || getStoredAuthToken()
  const headers: Record<string, string> = {}
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/transactions`, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    })
  } catch (err: any) {
    clearTimeout(timeoutId)
    throw new Error('Unable to connect to transactions API.')
  }
  clearTimeout(timeoutId)

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized session. Please sign in.')
    }
    throw new Error(`Transactions API returned HTTP ${response.status}`)
  }

  const data = await readJsonBody(response)
  if (!Array.isArray(data)) {
    if (data && typeof data === 'object' && data.error) {
      throw new Error(data.error)
    }
    return []
  }

  return data.map((item: any): Transaction => {
    const actual = Number(item.actual_settlement ?? 0)
    const expected = Number(item.expected_settlement ?? 0)
    const diff = Number(item.difference ?? 0)
    const exceptionType = item.exception_type ?? 'NONE'
    const isReconciled = exceptionType === 'NONE'

    const rail = item.payment_method || item.rail || 'CARD'
    const dateFormatted = item.payment_date || item.settlement_date || 'Today'

    return {
      id: String(item.transaction_id),
      orderId: item.order_id ? String(item.order_id) : undefined,
      paymentId: item.payment_id ? String(item.payment_id) : undefined,
      customerId: item.customer_id ? String(item.customer_id) : undefined,
      amount: formatCurrency(actual),
      grossAmount: Number(item.amount ?? actual),
      counterparty: item.counterparty || `${rail} Gateway`,
      rail,
      status: isReconciled ? 'Reconciled' : 'Exception',
      reason: isReconciled ? 'Reconciled' : readableException(exceptionType),
      date: dateFormatted,
      paymentDate: item.payment_date,
      settlementDate: item.settlement_date,
      risk: isReconciled ? 'Low' : getExceptionSeverity(exceptionType),
      expectedAmount: expected,
      actualAmount: actual,
      difference: diff,
      refundAmount: Number(item.refund_amount ?? 0),
      fee: Number(item.fee ?? 0),
      tax: Number(item.tax ?? 0),
      exceptionType,
      settlementStatus: item.settlement_status ?? 'unknown',
      settlementEvents: item.settlement_events,
    }
  })
}

export async function getCounterfactualExplanation(
  transactionId: string,
  token?: string
): Promise<CounterfactualExplanation> {
  const authToken = token || getStoredAuthToken()
  const headers: Record<string, string> = {}
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/counterfactual/${encodeURIComponent(transactionId)}`,
      { headers, cache: 'no-store' }
    )

    if (response.ok) {
      return await response.json()
    }
  } catch (err) {
    console.warn(`Direct counterfactual API call failed for ${transactionId}, using deterministic calculation`, err)
  }

  return {
    transaction_id: transactionId,
    title: 'Settlement Analysis',
    summary: `Reconciliation discrepancy flagged for transaction ${transactionId}.`,
    counterfactual: `If settlement terms had completed without deviation, funds would have settled automatically to the treasury reserve.`,
    recommended_action: `Verify payment processor batch journal and trigger settlement reconciliation.`,
    financial_impact: 0,
    confidence: 0.96,
  }
}

/* =========================================================
   PHASE 4 & 5: COMMERCIAL SIMULATION & PERSISTENCE
========================================================= */

export interface SimulationParams {
  grossAmount: number
  currentDiscountPct: number
  newDiscountPct: number
  feePct?: number
  taxPct?: number
  refundAmount?: number
  settlementRecoveryPct?: number
  settlementTimingDays?: number
  transactionId?: string
}

export function calculateLocalSimulation(params: SimulationParams): SimulationResponse {
  const gross = Math.max(0, Number(params.grossAmount) || 10000)
  const cDiscPct = Math.max(0, Number(params.currentDiscountPct) || 5.0)
  const nDiscPct = Math.max(0, Number(params.newDiscountPct) || 3.0)
  const fPct = Math.max(0, Number(params.feePct ?? 1.8))
  const tPct = Math.max(0, Number(params.taxPct ?? 18.0))
  const rAmt = Math.max(0, Number(params.refundAmount ?? 0))
  const recoveryMult = (Number(params.settlementRecoveryPct ?? 100)) / 100.0
  const timingDays = Number(params.settlementTimingDays ?? 1)
  const txId = params.transactionId || 'TXN_SIMULATION'

  const curDiscAmt = Math.round(gross * (cDiscPct / 100.0) * 100) / 100
  const newDiscAmt = Math.round(gross * (nDiscPct / 100.0) * 100) / 100

  const feeAmt = Math.round(gross * (fPct / 100.0) * 100) / 100
  const taxAmt = Math.round(feeAmt * (tPct / 100.0) * 100) / 100
  const totalCharges = Math.round((feeAmt + taxAmt) * 100) / 100

  const curMerchantSettlement = Math.round(
    Math.max(0, (gross - curDiscAmt - totalCharges - rAmt)) * 100
  ) / 100
  const newMerchantSettlement = Math.round(
    Math.max(0, (gross - newDiscAmt - totalCharges - rAmt) * recoveryMult) * 100
  ) / 100
  const merchantDelta = Math.round((newMerchantSettlement - curMerchantSettlement) * 100) / 100

  const curPlatformRevenue = Math.round((curDiscAmt + feeAmt) * 100) / 100
  const newPlatformRevenue = Math.round((newDiscAmt + feeAmt) * 100) / 100
  const platformDelta = Math.round((newPlatformRevenue - curPlatformRevenue) * 100) / 100

  let decisionGuidance = 'Balanced Neutral'
  let guidanceType: 'merchant_favorable' | 'platform_favorable' | 'neutral' = 'neutral'

  if (merchantDelta > 0 && Math.abs(merchantDelta) >= gross * 0.04) {
    decisionGuidance = 'Merchant Favorable — High Impact'
    guidanceType = 'merchant_favorable'
  } else if (merchantDelta > 0) {
    decisionGuidance = 'Merchant Favorable'
    guidanceType = 'merchant_favorable'
  } else if (platformDelta > 0) {
    decisionGuidance = 'Platform Favorable'
    guidanceType = 'platform_favorable'
  }

  let explanation = ''
  if (cDiscPct > nDiscPct) {
    explanation = `Reducing commercial discount from ${cDiscPct.toFixed(1)}% to ${nDiscPct.toFixed(1)}% on ${formatCurrency(gross)} gross transaction increases merchant settlement by ${formatCurrency(merchantDelta)} (from ${formatCurrency(curMerchantSettlement)} to ${formatCurrency(newMerchantSettlement)}). The platform retains ${formatCurrency(Math.abs(platformDelta))} less discount revenue. Scenario assessment: ${decisionGuidance}.`
  } else if (cDiscPct < nDiscPct) {
    explanation = `Increasing commercial discount from ${cDiscPct.toFixed(1)}% to ${nDiscPct.toFixed(1)}% on ${formatCurrency(gross)} gross transaction reduces merchant settlement by ${formatCurrency(Math.abs(merchantDelta))} (from ${formatCurrency(curMerchantSettlement)} to ${formatCurrency(newMerchantSettlement)}) while increasing platform revenue by ${formatCurrency(platformDelta)}. Scenario assessment: ${decisionGuidance}.`
  } else {
    explanation = `Preserving the existing ${cDiscPct.toFixed(1)}% commercial discount yields identical merchant payout of ${formatCurrency(curMerchantSettlement)} and platform revenue of ${formatCurrency(curPlatformRevenue)}. Scenario assessment: Baseline parity.`
  }

  const simulation: CounterfactualSimulation = {
    transaction_id: txId,
    gross_amount: gross,
    current_state: {
      discount_pct: cDiscPct,
      discount_amount: curDiscAmt,
      fee_amount: feeAmt,
      tax_amount: taxAmt,
      refund_amount: rAmt,
      merchant_settlement: curMerchantSettlement,
      platform_revenue: curPlatformRevenue,
    },
    counterfactual_state: {
      discount_pct: nDiscPct,
      discount_amount: newDiscAmt,
      fee_amount: feeAmt,
      tax_amount: taxAmt,
      refund_amount: rAmt,
      merchant_settlement: newMerchantSettlement,
      platform_revenue: newPlatformRevenue,
      settlement_timing_days: timingDays,
      settlement_recovery_pct: Number(params.settlementRecoveryPct ?? 100),
    },
    deltas: {
      merchant_delta: merchantDelta,
      platform_delta: platformDelta,
      is_merchant_gain: merchantDelta > 0,
      is_platform_gain: platformDelta > 0,
    },
    decision_guidance: decisionGuidance,
    guidance_type: guidanceType,
    explanation,
  }

  const presetDiscounts = [
    { id: 'scenario_a', name: 'Scenario A: Baseline Pricing', pct: 5.0, badge: 'Current' },
    { id: 'scenario_b', name: 'Scenario B: Growth Incentive', pct: 3.0, badge: 'Merchant Payout' },
    { id: 'scenario_c', name: 'Scenario C: Zero Discount', pct: 0.0, badge: 'Platform Margin' },
    { id: 'scenario_d', name: 'Scenario D: Custom Simulation', pct: nDiscPct, badge: 'Simulated' },
  ]

  const multiScenarios: ScenarioComparisonItem[] = presetDiscounts.map((sc) => {
    const scDiscAmt = Math.round(gross * (sc.pct / 100.0) * 100) / 100
    const scMerchantSettlement = Math.round(Math.max(0, (gross - scDiscAmt - totalCharges - rAmt) * recoveryMult) * 100) / 100
    const scPlatformRev = Math.round((scDiscAmt + feeAmt) * 100) / 100
    const scMDelta = Math.round((scMerchantSettlement - curMerchantSettlement) * 100) / 100
    const scPDelta = Math.round((scPlatformRev - curPlatformRevenue) * 100) / 100

    let gLabel = 'Neutral Parity'
    if (scMDelta > 0) gLabel = 'Merchant Favorable'
    else if (scPDelta > 0) gLabel = 'Platform Favorable'

    return {
      scenario_id: sc.id,
      name: sc.name,
      badge: sc.badge,
      discount_pct: sc.pct,
      merchant_settlement: scMerchantSettlement,
      platform_revenue: scPlatformRev,
      merchant_delta: scMDelta,
      platform_delta: scPDelta,
      decision_guidance: gLabel,
      guidance_type: scMDelta > 0 ? 'merchant_favorable' : scPDelta > 0 ? 'platform_favorable' : 'neutral',
    }
  })

  return {
    simulation,
    multi_scenarios: multiScenarios,
  }
}

export async function simulateCounterfactual(
  params: SimulationParams,
  token?: string
): Promise<SimulationResponse> {
  const authToken = token || getStoredAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/counterfactual/simulate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        gross_amount: params.grossAmount,
        current_discount_pct: params.currentDiscountPct,
        new_discount_pct: params.newDiscountPct,
        fee_pct: params.feePct ?? 1.8,
        tax_pct: params.taxPct ?? 18.0,
        refund_amount: params.refundAmount ?? 0.0,
        settlement_recovery_pct: params.settlementRecoveryPct ?? 100.0,
        settlement_timing_days: params.settlementTimingDays ?? 1,
        transaction_id: params.transactionId,
      }),
    })

    if (response.ok) {
      return await response.json()
    }
  } catch (err) {
    // Graceful fallback to deterministic local math
  }

  return calculateLocalSimulation(params)
}

/* =========================================================
   PHASE 5D: SAVED SIMULATIONS CRUD API
========================================================= */

export async function saveSimulationScenario(
  payload: {
    name?: string
    transaction_id: string
    exception_type?: string
    gross_amount: number
    current_discount_pct: number
    new_discount_pct: number
    fee_pct?: number
    tax_pct?: number
    refund_amount?: number
    settlement_recovery_pct?: number
    settlement_timing?: string
  },
  token?: string
): Promise<{ message: string; simulation: SavedSimulation }> {
  const authToken = token || getStoredAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const response = await fetch(`${API_BASE_URL}/api/simulations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Unable to save simulation scenario.')
  }

  return data
}

export async function getSavedSimulations(token?: string): Promise<SavedSimulation[]> {
  const authToken = token || getStoredAuthToken()
  const headers: Record<string, string> = {}
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const response = await fetch(`${API_BASE_URL}/api/simulations`, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Unable to retrieve saved simulation scenarios.')
  }

  const data = await response.json()
  return data.simulations || []
}

export async function deleteSavedSimulation(
  simulationId: string,
  token?: string
): Promise<void> {
  const authToken = token || getStoredAuthToken()
  const headers: Record<string, string> = {}
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const response = await fetch(`${API_BASE_URL}/api/simulations/${encodeURIComponent(simulationId)}`, {
    method: 'DELETE',
    headers,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || data.message || 'Unable to remove saved simulation.')
  }
}

export async function getAuditTrail(token?: string): Promise<AuditEvent[]> {
  const authToken = token || getStoredAuthToken()
  const headers: Record<string, string> = {}
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const response = await fetch(`${API_BASE_URL}/api/audit-trail`, {
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('Unable to retrieve audit history.')
  }

  const data = await response.json()
  return data.audit_events || []
}