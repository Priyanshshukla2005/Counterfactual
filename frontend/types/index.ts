export type TransactionStatus = 'Reconciled' | 'Exception' | 'Review'

export type Transaction = {
  id: string
  amount: string
  counterparty: string
  rail: string
  status: TransactionStatus
  reason: string
  date: string
  risk: 'Low' | 'Medium' | 'High'

  // Backend reconciliation fields
  expectedAmount?: number
  actualAmount?: number
  difference?: number
  refundAmount?: number
  fee?: number
  tax?: number
  exceptionType?: string
  settlementStatus?: string
}

export type Dashboard = {
  netVolume: number
  reconciledPercent: number
  openExceptions: number
  atRiskCapital: number
}