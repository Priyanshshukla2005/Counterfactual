export type TransactionStatus = 'Reconciled' | 'Exception' | 'Review'
export type RiskLevel = 'Low' | 'Medium' | 'High'
export type NavSection = 'Overview' | 'Transactions' | 'Exceptions' | 'Counterfactuals' | 'Reports'

export interface User {
  id: string
  name: string
  email: string
  organization?: string
  role?: string
  created_at?: string
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

export interface SettlementEvent {
  event_id: string
  actual_settlement: number
  settlement_date: string
  settlement_status: string
  is_duplicate_disbursement?: boolean
}

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
  settlementEvents?: SettlementEvent[]
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
  settlement_events?: SettlementEvent[]
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

// Phase 4 & 5: Commercial Counterfactual Simulation Types
export interface SimulationState {
  discount_pct: number
  discount_amount: number
  fee_amount: number
  tax_amount: number
  refund_amount: number
  merchant_settlement: number
  platform_revenue: number
  settlement_timing_days?: number
  settlement_recovery_pct?: number
}

export interface SimulationDeltas {
  merchant_delta: number
  platform_delta: number
  is_merchant_gain: boolean
  is_platform_gain: boolean
}

export interface CounterfactualSimulation {
  transaction_id: string
  gross_amount: number
  current_state: SimulationState
  counterfactual_state: SimulationState
  deltas: SimulationDeltas
  decision_guidance: string
  guidance_type: 'merchant_favorable' | 'platform_favorable' | 'neutral'
  explanation: string
}

export interface ScenarioComparisonItem {
  scenario_id: string
  name: string
  badge: string
  discount_pct: number
  merchant_settlement: number
  platform_revenue: number
  merchant_delta: number
  platform_delta: number
  decision_guidance: string
  guidance_type: string
}

export interface SimulationResponse {
  simulation: CounterfactualSimulation
  multi_scenarios: ScenarioComparisonItem[]
}

// Phase 5: Persistent Saved Simulation Types
export interface SavedSimulationScenario {
  discount: number
  current_discount: number
  gateway_fee: number
  recovery_percentage: number
  settlement_timing: string
}

export interface SavedSimulationFinancialBlock {
  gross_amount: number
  discount: number
  discount_pct?: number
  gateway_fee: number
  fee_pct?: number
  tax: number
  tax_pct?: number
  refund_amount: number
  merchant_payout: number
  platform_revenue: number
  settlement_timing?: string
  recovery_percentage?: number
}

export interface SavedSimulation {
  id: string
  name?: string
  user_id: string
  transaction_id: string
  exception_type: string
  created_at: string
  scenario: SavedSimulationScenario
  baseline: SavedSimulationFinancialBlock
  counterfactual: SavedSimulationFinancialBlock
  financial_delta: SimulationDeltas
  recommendation: string
}

export interface AuditEvent {
  id: string
  user_id: string
  action: 'LOGIN' | 'LOGOUT' | 'REGISTER' | 'SIMULATION_CREATED' | 'SIMULATION_DELETED' | string
  timestamp: string
  transaction_id?: string
  metadata?: Record<string, any>
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