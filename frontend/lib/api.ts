import type { Dashboard, Transaction } from '@/types'

const API_BASE_URL = 'http://localhost:5000'

export interface BackendException {
  transaction_id: string
  exception_type: string
  difference: number
  expected_settlement: number
  actual_settlement: number
  refund_amount: number
  settlement_status: string
  fee?: number
  tax?: number
}

export interface BackendDashboardResponse {
  metrics: {
    total_records?: number
    matched_records?: number
    exception_records?: number
    match_rate?: number
    exception_rate?: number
    expected_total?: number
    actual_total?: number
    unreconciled_amount?: number
  }

  exceptions: BackendException[]
}

export async function getDashboard(): Promise<Dashboard> {
  const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Dashboard API failed: ${response.status}`)
  }

  const data: BackendDashboardResponse = await response.json()

  const metrics = data.metrics

  return {
    netVolume: metrics.expected_total ?? 0,
    reconciledPercent: metrics.match_rate ?? 0,
    openExceptions: metrics.exception_records ?? 0,
    atRiskCapital: Math.abs(metrics.unreconciled_amount ?? 0),
  }
}

export async function getDashboardData(): Promise<BackendDashboardResponse> {
  const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Dashboard API failed: ${response.status}`)
  }

  return response.json()
}

export async function getTransactions(): Promise<Transaction[]> {
  const response = await fetch(`${API_BASE_URL}/api/transactions`, {
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Transactions API failed: ${response.status}`)
  }

  const data = await response.json()

  return data.map((transaction: any): Transaction => ({
    id: transaction.transaction_id,

    amount: `$${Number(transaction.actual_settlement ?? 0).toFixed(2)}`,

    counterparty: transaction.counterparty ?? 'Settlement processor',

    rail: transaction.rail ?? 'Settlement',

    status:
      transaction.exception_type === 'NONE'
        ? 'Reconciled'
        : 'Exception',

    reason:
      transaction.exception_type === 'NONE'
        ? '—'
        : transaction.exception_type,

    date: transaction.date ?? 'Today',

    risk:
      transaction.exception_type === 'NONE'
        ? 'Low'
        : transaction.exception_type === 'MISSING_SETTLEMENT' ||
            transaction.exception_type === 'DUPLICATE' ||
            transaction.exception_type === 'DELAYED_SETTLEMENT'
          ? 'High'
          : 'Medium',

    expectedAmount: Number(transaction.expected_settlement ?? 0),
    actualAmount: Number(transaction.actual_settlement ?? 0),
    difference: Number(transaction.difference ?? 0),
    refundAmount: Number(transaction.refund_amount ?? 0),
    fee: Number(transaction.fee ?? 0),
    tax: Number(transaction.tax ?? 0),

    exceptionType: transaction.exception_type ?? 'NONE',

    settlementStatus:
      transaction.settlement_status ?? 'unknown',
  }))
}

export async function getExceptions(): Promise<Transaction[]> {
  const transactions = await getTransactions()

  return transactions.filter(
    (transaction) => transaction.status === 'Exception'
  )
}

export async function getTransaction(
  id: string
): Promise<Transaction | undefined> {
  const transactions = await getTransactions()

  return transactions.find(
    (transaction) => transaction.id === id
  )
}

export async function getCounterfactualExplanation(
  transactionId?: string
) {
  return {
    confidence: 0.94,
    recommendation:
      'Review remittance details, then reconcile manually.',
  }
}