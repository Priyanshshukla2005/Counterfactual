export type TransactionStatus = 'Reconciled' | 'Exception' | 'Review'
export type RiskLevel = 'Low' | 'Medium' | 'High'
export type NavSection = 'Overview' | 'Transactions' | 'Exceptions' | 'Counterfactuals' | 'Reports'

export interface User {
  id: string
  name: string
  email: string
  organization?: string
}

export interface AuthResponse {
  user: User
  token: string
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface SignupCredentials {
  name: string
  email: string
  password: string
  organization?: string
}

export type ExceptionType =
  | 'NONE'
  | 'MISSING_SETTLEMENT'
  | 'DUPLICATE'
  | 'DELAYED_SETTLEMENT'
  | 'PARTIAL_REFUND'
  | 'FEE_MISMATCH'
  | string

export interface Transaction {
  id: string
  orderId?: string
  paymentId?: string
  customerId?: string
  amount: string
  grossAmount?: number
  counterparty: string
  rail: string
  status: TransactionStatus
  reason: string
  date: string
  paymentDate?: string
  settlementDate?: string
  risk: RiskLevel

  // Backend reconciliation fields
  expectedAmount?: number
  actualAmount?: number
  difference?: number
  refundAmount?: number
  fee?: number
  tax?: number
  exceptionType?: ExceptionType
  settlementStatus?: string
}

export interface DashboardMetrics {
  total_records?: number
  matched_records?: number
  exception_records?: number
  match_rate?: number
  exception_rate?: number
  expected_total?: number
  actual_total?: number
  unreconciled_amount?: number
}

export interface BackendException {
  transaction_id: string
  exception_type: string
  difference: number
  expected_settlement: number
  actual_settlement: number
  refund_amount: number
  settlement_status: string
  order_id?: string
  payment_id?: string
  customer_id?: string
  payment_date?: string
  settlement_date?: string
  payment_method?: string
  fee?: number
  tax?: number
  confidence?: number
}

export interface BackendDashboardResponse {
  metrics: DashboardMetrics
  exceptions: BackendException[]
}

export interface CounterfactualExplanation {
  transaction_id: string
  title: string
  summary: string
  counterfactual: string
  recommended_action: string
  financial_impact: number
  confidence: number
}

export interface Dashboard {
  netVolume: number
  reconciledPercent: number
  openExceptions: number
  atRiskCapital: number
}

export interface ExceptionBreakdownItem {
  type: string
  label: string
  count: number
  percentage: number
  financialImpact: number
  severity: RiskLevel
  color: string
}

export interface SettlementTimelinePoint {
  date: string
  label: string
  expected: number
  actual: number
  variance: number
  count: number
}

export interface TransactionFilters {
  query: string
  status: 'ALL' | 'Reconciled' | 'Exception'
  risk: 'ALL' | 'High' | 'Medium' | 'Low'
  exceptionType: 'ALL' | string
  rail: 'ALL' | string
}