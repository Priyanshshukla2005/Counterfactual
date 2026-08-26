export type TransactionStatus = 'Reconciled' | 'Exception' | 'Review'
export type RiskLevel = 'Low' | 'Medium' | 'High'
export type NavSection = 'Overview' | 'Transactions' | 'Exceptions' | 'Counterfactuals' | 'Reports' | 'Monitoring'

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

// Phase 6: Razorpay Execution Types
export type ExecutionStatus =
  | 'RECOMMENDED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'FAILED'
  | 'REJECTED'

export type ExecutionActionType = 'PAYMENT_LINK' | 'REFUND' | 'INVOICE'

export interface RazorpayPublicConfig {
  configured: boolean
  mode: string
  key_id_masked: string
  sdk_available: boolean
  supported_actions: string[]
}

export interface ExecutionRecord {
  id: string
  execution_id: string
  user_id: string
  tenant_id: string
  simulation_id?: string
  recommendation_id?: string
  target_transaction_id?: string
  action_type: ExecutionActionType
  amount: number
  currency: string
  status: ExecutionStatus
  description: string
  idempotency_key?: string
  requested_at: string
  approved_at?: string | null
  approved_by?: string | null
  executed_at?: string | null
  rejected_at?: string | null
  rejection_reason?: string | null
  razorpay_id?: string | null
  razorpay_reference?: string | null
  short_url?: string | null
  error_code?: string | null
  error_message?: string | null
  metadata?: Record<string, any>
}

export interface ExecutionFilterOptions {
  status: 'ALL' | ExecutionStatus
  actionType: 'ALL' | ExecutionActionType
}

// Phase 7: Closed-Loop Monitoring & Outcome Types
export type DeviationSeverity =
  | 'ON_TARGET'
  | 'MINOR_DEVIATION'
  | 'SIGNIFICANT_DEVIATION'
  | 'CRITICAL_DEVIATION'
  | 'INSUFFICIENT_DATA'

export interface OutcomePrediction {
  predicted_amount: number
  predicted_settlement: number
  predicted_revenue: number
  predicted_refund: number
  recommended_action: string
  predicted_at: string
}

export interface OutcomeActual {
  actual_amount: number
  actual_settlement: number
  actual_revenue: number
  actual_refund: number
  observed_status: string
  observed_at: string
  source: string
}

export interface OutcomeComparison {
  predicted: number
  actual: number
  deviation_amount: number
  absolute_deviation: number
  deviation_percentage: number
  direction: 'EXACT' | 'UNDERPERFORMED' | 'OVERPERFORMED'
  severity: DeviationSeverity
  status: string
  accuracy_score: number
}

export interface OutcomeRootCause {
  likely_cause: string
  confidence: number
  evidence: string
  explanation: string
  recommended_investigation: string
}

export interface OutcomeRecord {
  id: string
  outcome_id: string
  tenant_id: string
  user_id: string
  simulation_id?: string
  recommendation_id?: string
  execution_id?: string
  transaction_id: string
  razorpay_id?: string
  action_type: string
  prediction: OutcomePrediction
  actual: OutcomeActual
  comparison: OutcomeComparison
  root_cause: OutcomeRootCause
  created_at: string
  updated_at?: string
  metadata?: Record<string, any>
}

export interface MonitoringOverviewMetrics {
  total_predictions: number
  total_executions: number
  successful_executions: number
  failed_executions: number
  total_executed_amount: number
  total_refunds: number
  total_invoices: number
  total_payment_links: number
  prediction_accuracy_rate: number
  average_deviation_pct: number
  median_deviation_pct: number
  critical_deviations_count: number
}

export interface SeverityDistribution {
  on_target: number
  on_target_pct: number
  minor: number
  minor_pct: number
  significant: number
  significant_pct: number
  critical: number
  critical_pct: number
}

export interface MonitoringOverviewResponse {
  metrics: MonitoringOverviewMetrics
  severity_distribution: SeverityDistribution
  critical_alerts: OutcomeRecord[]
  thresholds: Record<string, number>
}

export interface HistoricalPattern {
  cause: string
  occurrences: number
  percentage: number
  insight: string
}

export interface HistoricalFeedbackResponse {
  historical_feedback: {
    total_analyzed_cycles: number
    recurring_patterns: HistoricalPattern[]
    action_performance: {
      payment_link_success_rate: number
      refund_settlement_rate: number
      invoice_payment_rate: number
      average_reconciliation_variance_pct: number
    }
    decision_intelligence_guidance: string
  }
}

// ====================================================================
// PHASE 11: RAG FINANCIAL INTELLIGENCE LAYER TYPES
// ====================================================================

export interface RAGSourceCitation {
  chunk_id: string
  document_id: string
  title: string
  source_type: string
  relevance_score: number
  snippet: string
}

export interface RAGHistoricalCase {
  outcome_id: string
  transaction_id: string
  action_type: string
  predicted: number
  actual: number
  likely_cause: string
  deviation_pct: number
}

export interface RAGNumericalSourceOfTruth {
  predicted_amount: number
  actual_amount: number
  deviation_amount: number
  deviation_pct: number
  accuracy_score: number
}

export interface RAGExplanation {
  transaction_id: string
  is_grounded: boolean
  confidence: 'High' | 'Medium' | 'Low'
  likely_cause: string
  grounded_explanation: string
  retrieved_evidence: RAGSourceCitation[]
  historical_similar_cases: RAGHistoricalCase[]
  relevant_policies: string[]
  recommended_investigation: string
  numerical_source_of_truth: RAGNumericalSourceOfTruth
}

export interface RAGExplanationResponse {
  success: boolean
  explanation: RAGExplanation
}

export interface RAGSearchResult {
  chunk_id: string
  document_id: string
  source_type: string
  title: string
  chunk_text: string
  metadata: Record<string, any>
  relevance_score: number
  vector_similarity: number
  tenant_id: string
}

export interface RAGSearchResponse {
  success: boolean
  enabled: boolean
  query: string
  results: RAGSearchResult[]
  total_found: number
}