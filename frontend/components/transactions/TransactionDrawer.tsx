'use client'

import React from 'react'
import type { Transaction } from '@/types'
import {
  formatCurrency,
  readableException,
  getExceptionSeverity,
} from '@/lib/api'
import { StatusBadge, RiskBadge, RailBadge, SettlementStatusBadge } from '@/components/common/Badge'
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import {
  Sparkles,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Receipt,
  FileSpreadsheet,
  Layers,
  X,
  Calendar,
} from 'lucide-react'

interface TransactionDrawerProps {
  transaction: Transaction | null
  open: boolean
  onClose: () => void
  onOpenCounterfactual: (transactionId: string) => void
}

export function TransactionDrawer({
  transaction,
  open,
  onClose,
  onOpenCounterfactual,
}: TransactionDrawerProps) {
  if (!transaction) return null

  const isException = transaction.status === 'Exception'
  const variance = Math.abs(transaction.difference ?? 0)
  const severity = getExceptionSeverity(transaction.exceptionType)
  const isDuplicate = transaction.exceptionType === 'DUPLICATE'

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const settlementEvents = transaction.settlementEvents || []

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="drawer-content">
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Transaction Audit & Reconciliation
              </span>
              <RiskBadge risk={severity} />
            </div>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mono-id flex items-center gap-2">
                {transaction.id}
                <button
                  onClick={() => copyToClipboard(transaction.id)}
                  title="Copy Transaction ID"
                  className="text-slate-400 hover:text-slate-700"
                >
                  <Copy size={13} />
                </button>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {transaction.orderId ? `Order Ref: ${transaction.orderId}` : 'Settlement Reference'} • Rail: {transaction.rail}
              </p>
            </div>

            <StatusBadge status={transaction.status} />
          </div>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          {/* Hero Exposure Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Verified Ledger Variance</span>
              <span className="font-semibold text-slate-700">{transaction.date}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                {formatCurrency(variance)}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  isException
                    ? 'text-rose-700 bg-rose-100 border border-rose-200'
                    : 'text-emerald-700 bg-emerald-100 border border-emerald-200'
                }`}
              >
                {isException ? 'Exposure At-Risk' : 'Zero Variance'}
              </span>
            </div>
          </div>

          {/* Multi-event Settlement Breakdown for Duplicates */}
          {settlementEvents.length > 1 && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-lg space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <AlertTriangle size={14} className="text-amber-700" />
                <span>Multiple Settlement Disbursements Detected ({settlementEvents.length} Events)</span>
              </div>
              <p className="text-amber-800 text-[11px]">
                The gateway batch journal recorded repeated settlement credits for this single transaction reference.
              </p>

              <div className="divide-y divide-amber-200/80 bg-white/80 rounded-md border border-amber-200 text-xs">
                {settlementEvents.map((ev, i) => (
                  <div key={ev.event_id || i} className="p-2 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800 mono-id">{ev.event_id}</span>
                      <span className="text-[10px] text-slate-500 block">
                        Date: {ev.settlement_date || transaction.date}
                      </span>
                    </div>
                    <div className="text-right">
                      <strong className="text-slate-900 tabular-nums">
                        {formatCurrency(ev.actual_settlement)}
                      </strong>
                      <span
                        className={`text-[10px] block font-semibold ${
                          i > 0 ? 'text-amber-700' : 'text-slate-600'
                        }`}
                      >
                        {i > 0 ? 'Duplicate Credit' : 'Initial Credit'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual Reconciliation Flow */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Reconciliation Path
            </h3>

            <div className="recon-flow">
              <div className="recon-node">
                <div className="recon-node-label">Expected Settlement</div>
                <div className="recon-node-value tabular-nums">
                  {formatCurrency(transaction.expectedAmount)}
                </div>
              </div>

              <div className="text-slate-400">
                <ArrowRight size={16} />
              </div>

              <div
                className={`recon-node ${
                  variance > 0 ? 'border-rose-300 bg-rose-50/50' : ''
                }`}
              >
                <div className="recon-node-label">Actual Total Settlement</div>
                <div
                  className={`recon-node-value tabular-nums ${
                    variance > 0 ? 'text-rose-700' : 'text-slate-900'
                  }`}
                >
                  {formatCurrency(transaction.actualAmount)}
                </div>
              </div>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Ledger Accounting Details
            </h3>

            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
              <div className="p-2.5 flex justify-between">
                <span className="text-slate-500">Gross Transaction Value:</span>
                <strong className="text-slate-900 tabular-nums">
                  {formatCurrency(transaction.grossAmount || transaction.actualAmount)}
                </strong>
              </div>

              <div className="p-2.5 flex justify-between">
                <span className="text-slate-500">Interchange Fee:</span>
                <span className="text-slate-700 tabular-nums">
                  {formatCurrency(transaction.fee ?? 0)}
                </span>
              </div>

              <div className="p-2.5 flex justify-between">
                <span className="text-slate-500">Applicable GST / Tax:</span>
                <span className="text-slate-700 tabular-nums">
                  {formatCurrency(transaction.tax ?? 0)}
                </span>
              </div>

              <div className="p-2.5 flex justify-between">
                <span className="text-slate-500">Refund Amount Deducted:</span>
                <span className="text-slate-700 tabular-nums">
                  {formatCurrency(transaction.refundAmount ?? 0)}
                </span>
              </div>

              <div className="p-2.5 flex justify-between bg-slate-50 font-semibold">
                <span className="text-slate-700">Settlement Status:</span>
                <SettlementStatusBadge status={transaction.settlementStatus || 'settled'} />
              </div>
            </div>
          </div>

          {/* Root Cause & Diagnostic Findings */}
          {isException && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <AlertTriangle size={15} />
                <span>Deterministic Finding: {readableException(transaction.exceptionType)}</span>
              </div>
              <p className="text-amber-900 leading-relaxed">
                The settlement reconciliation engine detected an imbalance of{' '}
                <strong>{formatCurrency(variance)}</strong> between the expected merchant receivable
                and total recorded processor settlements.
              </p>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer">
          <button
            onClick={() => {
              onOpenCounterfactual(transaction.id)
              onClose()
            }}
            className="btn btn-primary flex-1 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600"
          >
            <Sparkles size={15} />
            <span>Counterfactual Studio & Execution</span>
          </button>

          <button onClick={onClose} className="btn btn-secondary">
            <span>Close</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
