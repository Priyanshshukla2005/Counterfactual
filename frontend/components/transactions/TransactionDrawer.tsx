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
                Payment Details & Review
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
                  title="Copy Payment ID"
                  className="text-slate-400 hover:text-slate-700"
                >
                  <Copy size={13} />
                </button>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {transaction.orderId ? `Order: ${transaction.orderId}` : 'Payment Reference'} • Method: {transaction.rail}
              </p>
            </div>

            <StatusBadge status={transaction.status} />
          </div>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body space-y-4">
          {/* Hero Exposure Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-bold text-slate-700">
                {isException ? "Payment Doesn't Match" : 'Payment Reconciled'}
              </span>
              <span className="font-semibold text-slate-700">{transaction.date}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Expected Money</span>
                <strong className="text-slate-900 font-mono text-sm">
                  {formatCurrency(transaction.expectedAmount)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Received</span>
                <strong className="text-slate-900 font-mono text-sm">
                  {formatCurrency(transaction.actualAmount)}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Difference</span>
                <strong className={`font-mono text-sm ${variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {formatCurrency(variance)}
                </strong>
              </div>
            </div>
          </div>

          {/* Multi-event Settlement Breakdown for Duplicates */}
          {settlementEvents.length > 1 && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <AlertTriangle size={14} className="text-amber-700" />
                <span>Multiple Payments Received for One Order ({settlementEvents.length} Payments)</span>
              </div>
              <p className="text-amber-800 text-[11px]">
                Your payment provider recorded repeated deposits for this single order reference.
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
                        {i > 0 ? 'Extra Payment' : 'First Payment'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Why is there a difference? */}
          {isException && (
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <AlertTriangle size={15} />
                <span>Why is there a difference?</span>
              </div>
              <p className="text-slate-800 leading-relaxed">
                {readableException(transaction.exceptionType)}: We detected a difference of{' '}
                <strong className="font-mono">{formatCurrency(variance)}</strong> between what was expected
                and what your payment provider sent.
              </p>
            </div>
          )}

          {/* Financial Breakdown Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Payment Calculation Details
            </h3>

            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
              <div className="p-2.5 flex justify-between">
                <span className="text-slate-500">Gross Transaction Amount:</span>
                <strong className="text-slate-900 tabular-nums font-mono">
                  {formatCurrency(transaction.grossAmount || transaction.actualAmount)}
                </strong>
              </div>

              <div className="p-2.5 flex justify-between">
                <span className="text-slate-500">Payment Processing Fee:</span>
                <span className="text-slate-700 tabular-nums font-mono">
                  {formatCurrency(transaction.fee ?? 0)}
                </span>
              </div>

              <div className="p-2.5 flex justify-between">
                <span className="text-slate-500">Tax on Fee (18% GST):</span>
                <span className="text-slate-700 tabular-nums font-mono">
                  {formatCurrency(transaction.tax ?? 0)}
                </span>
              </div>

              <div className="p-2.5 flex justify-between">
                <span className="text-slate-500">Refund Amount Deducted:</span>
                <span className="text-slate-700 tabular-nums font-mono">
                  {formatCurrency(transaction.refundAmount ?? 0)}
                </span>
              </div>

              <div className="p-2.5 flex justify-between bg-slate-50 font-semibold rounded-b-xl">
                <span className="text-slate-700">Payment Status:</span>
                <SettlementStatusBadge status={transaction.settlementStatus || 'settled'} />
              </div>
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer">
          <button
            onClick={() => {
              onOpenCounterfactual(transaction.id)
              onClose()
            }}
            className="btn btn-primary flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
          >
            <Sparkles size={15} />
            <span>Run What-If Analysis</span>
          </button>

          <button onClick={onClose} className="btn btn-secondary">
            <span>Close</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
