'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type {
  BackendException,
  CounterfactualExplanation as ExceptionExplanationType,
  SimulationResponse,
  SavedSimulation,
} from '@/types'
import {
  formatCurrency,
  readableException,
  getExceptionSeverity,
  getCounterfactualExplanation,
  calculateLocalSimulation,
  simulateCounterfactual,
  saveSimulationScenario,
  getSavedSimulations,
  deleteSavedSimulation,
  executeDirectPaymentLink,
  executeDirectRefund,
  executeDirectInvoice,
} from '@/lib/api'
import { RiskBadge, SettlementStatusBadge } from '@/components/common/Badge'
import { CounterfactualScene } from '@/components/counterfactual/CounterfactualScene'
import { ScenarioControls } from '@/components/counterfactual/ScenarioControls'
import { FinancialImpact } from '@/components/counterfactual/FinancialImpact'
import { ScenarioComparison } from '@/components/counterfactual/ScenarioComparison'
import { CounterfactualExplanation } from '@/components/counterfactual/CounterfactualExplanation'
import { ExecutionWorkflow } from '@/components/counterfactual/ExecutionWorkflow'

import {
  Sparkles,
  Zap,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  RotateCcw,
  Sliders,
  DollarSign,
  Scale,
  BrainCircuit,
  Layers,
  Wrench,
  BookmarkPlus,
  Trash2,
  CheckCircle2,
  Clock,
  Database,
  History,
  ExternalLink,
  Lock,
  AlertTriangle,
  Receipt,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface CounterfactualStudioProps {
  exceptions: BackendException[]
  selectedTxId?: string
  onSelectTxId?: (id: string) => void
  onNavigateToTransactions?: () => void
}

type StudioMode = 'COMMERCIAL_PRICING' | 'RAZORPAY_EXECUTION' | 'EXCEPTION_RESOLUTION' | 'SAVED_SCENARIOS'
type EntryMode = 'EXISTING_PAYMENT' | 'HYPOTHETICAL_SCENARIO'
type ResolutionScenario =
  | 'GATEWAY_RECOVERY'
  | 'MERCHANT_DEBIT'
  | 'REQUERY_WINDOW'
  | 'FEE_CORRECTION'

const HYPOTHETICAL_PRESETS = [
  {
    name: 'Weekend 20% Flash Sale',
    gross: 50000,
    volume: 100,
    currentDiscount: 5.0,
    newDiscount: 20.0,
    fee: 1.8,
    recovery: 100,
    timing: 1,
    desc: 'Simulate a 20% promo discount on ₹50,000 sales across 100 orders.',
  },
  {
    name: 'Tier-1 Volume Growth',
    gross: 150000,
    volume: 300,
    currentDiscount: 5.0,
    newDiscount: 10.0,
    fee: 1.5,
    recovery: 100,
    timing: 0,
    desc: 'Simulate high volume discount tier with instant settlement.',
  },
  {
    name: 'Zero Fee UPI Promo',
    gross: 25000,
    volume: 50,
    currentDiscount: 2.0,
    newDiscount: 0.0,
    fee: 0.0,
    recovery: 100,
    timing: 1,
    desc: 'Zero discount promo on UPI payments with no processing fee.',
  },
  {
    name: 'High-Margin Promo',
    gross: 100000,
    volume: 200,
    currentDiscount: 10.0,
    newDiscount: 30.0,
    fee: 1.8,
    recovery: 100,
    timing: 1,
    desc: 'Aggressive 30% discount to drive maximum order volume.',
  },
]

export function CounterfactualStudio({
  exceptions,
  selectedTxId,
  onSelectTxId,
  onNavigateToTransactions,
}: CounterfactualStudioProps) {
  // Entry Mode: Existing Payment vs Hypothetical What-If
  const [entryMode, setEntryMode] = useState<EntryMode>('HYPOTHETICAL_SCENARIO')

  // Current active transaction
  const currentException =
    exceptions.find((e) => e.transaction_id === selectedTxId) ||
    exceptions[0] ||
    null

  // Studio Mode
  const [studioMode, setStudioMode] = useState<StudioMode>('COMMERCIAL_PRICING')

  // Commercial Variable Inputs (Live Simulation State)
  const [hypotheticalGross, setHypotheticalGross] = useState<number>(50000)
  const [hypotheticalVolume, setHypotheticalVolume] = useState<number>(100)
  const [showFormulaDetails, setShowFormulaDetails] = useState<boolean>(false)

  const grossBaseline = entryMode === 'HYPOTHETICAL_SCENARIO'
    ? hypotheticalGross
    : currentException
    ? Number(currentException.expected_settlement || currentException.actual_settlement || 10000)
    : 10000

  const [grossAmount, setGrossAmount] = useState<number>(grossBaseline)
  const [currentDiscountPct, setCurrentDiscountPct] = useState<number>(5.0)
  const [newDiscountPct, setNewDiscountPct] = useState<number>(20.0)
  const [feePct, setFeePct] = useState<number>(1.8)
  const [taxPct, setTaxPct] = useState<number>(18.0)
  const [refundAmount, setRefundAmount] = useState<number>(
    entryMode === 'HYPOTHETICAL_SCENARIO' ? 0 : currentException ? Number(currentException.refund_amount || 0) : 0
  )
  const [settlementRecoveryPct, setSettlementRecoveryPct] = useState<number>(100)
  const [settlementTimingDays, setSettlementTimingDays] = useState<number>(1)

  // 3D Scene Active Branch State
  const [active3DBranch, setActive3DBranch] = useState<'current' | 'counterfactual'>('counterfactual')

  // Search filter for queue
  const [queueSearch, setQueueSearch] = useState('')

  // Exception resolution state
  const [resolutionScenario, setResolutionScenario] = useState<ResolutionScenario>('GATEWAY_RECOVERY')
  const [exceptionExplanation, setExceptionExplanation] = useState<ExceptionExplanationType | null>(null)
  const [excLoading, setExcLoading] = useState(false)

  // Phase 5D: Saved Simulations State
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([])
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Phase 6 Execution UI State
  const [execType, setExecType] = useState<'PAYMENT_LINK' | 'REFUND' | 'INVOICE'>('PAYMENT_LINK')

  // Phase 6.2: Payment Link Execution State
  const [isCreatingPaymentLink, setIsCreatingPaymentLink] = useState(false)
  const [paymentLinkResult, setPaymentLinkResult] = useState<{
    success: boolean
    executionId: string
    status: string
    razorpayId: string
    shortUrl: string
    amount: number
  } | null>(null)
  const [paymentLinkError, setPaymentLinkError] = useState<string | null>(null)

  // Phase 6.3: Refund Execution State
  const [refundStep, setRefundStep] = useState<'FORM' | 'CONFIRM'>('FORM')
  const [refundPaymentId, setRefundPaymentId] = useState<string>('pay_sample12345')
  const [refundCustomAmount, setRefundCustomAmount] = useState<number>(500)
  const [isRefunding, setIsRefunding] = useState(false)
  const [refundResult, setRefundResult] = useState<{
    success: boolean
    executionId: string
    status: string
    refundId: string
    paymentId: string
    amount: number
    message?: string
  } | null>(null)
  const [refundError, setRefundError] = useState<string | null>(null)

  // Phase 6.4: Invoice Execution State
  const [invoiceStep, setInvoiceStep] = useState<'FORM' | 'CONFIRM'>('FORM')
  const [invoiceAmount, setInvoiceAmount] = useState<number>(5000)
  const [invoiceCustomerName, setInvoiceCustomerName] = useState<string>('Acme Merchant')
  const [invoiceCustomerEmail, setInvoiceCustomerEmail] = useState<string>('finance@acme.io')
  const [invoiceCustomerContact, setInvoiceCustomerContact] = useState<string>('+91 9876543210')
  const [invoiceDescription, setInvoiceDescription] = useState<string>('Counterfactual Settlement Invoice')
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)
  const [invoiceResult, setInvoiceResult] = useState<{
    success: boolean
    executionId: string
    status: string
    invoiceId: string
    amount: number
    currency: string
    invoiceUrl?: string
    message?: string
  } | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)

  // Fetch user's saved simulations from MongoDB
  const loadSavedSimulations = async () => {
    try {
      setIsLoadingSaved(true)
      const data = await getSavedSimulations()
      setSavedSimulations(data)
    } catch (err) {
      console.warn('Unable to load saved simulations:', err)
    } finally {
      setIsLoadingSaved(false)
    }
  }

  useEffect(() => {
    loadSavedSimulations()
  }, [])

  // Update gross amount when selected exception changes
  useEffect(() => {
    if (currentException) {
      const g = Number(currentException.expected_settlement || currentException.actual_settlement || 10000)
      setGrossAmount(g > 0 ? g : 10000)
      setRefundAmount(Number(currentException.refund_amount || 0))
      setPaymentLinkResult(null)
      setPaymentLinkError(null)

      const pid = currentException.payment_id || currentException.transaction_id || 'pay_sample12345'
      setRefundPaymentId(pid)
      const diff = Math.abs(Number(currentException.difference || 500))
      setRefundCustomAmount(diff > 0 ? diff : 500)
      setRefundResult(null)
      setRefundError(null)
      setRefundStep('FORM')

      setInvoiceAmount(g > 0 ? g : 5000)
      setInvoiceResult(null)
      setInvoiceError(null)
      setInvoiceStep('FORM')

      // Load deterministic exception explanation
      setExcLoading(true)
      getCounterfactualExplanation(currentException.transaction_id)
        .then((res) => {
          setExceptionExplanation(res)
          setExcLoading(false)
        })
        .catch(() => setExcLoading(false))
    }
  }, [currentException?.transaction_id])

  // Live client calculation (instant response on slider change with zero lag)
  const simulationResult: SimulationResponse = useMemo(() => {
    return calculateLocalSimulation({
      grossAmount,
      currentDiscountPct,
      newDiscountPct,
      feePct,
      taxPct,
      refundAmount,
      settlementRecoveryPct,
      settlementTimingDays,
      transactionId: currentException?.transaction_id || 'TXN_SIMULATION',
    })
  }, [
    grossAmount,
    currentDiscountPct,
    newDiscountPct,
    feePct,
    taxPct,
    refundAmount,
    settlementRecoveryPct,
    settlementTimingDays,
    currentException?.transaction_id,
  ])

  // Filtered queue items
  const filteredQueue = useMemo(() => {
    const q = queueSearch.toLowerCase().trim()
    if (!q) return exceptions
    return exceptions.filter(
      (e) =>
        e.transaction_id.toLowerCase().includes(q) ||
        e.exception_type.toLowerCase().includes(q) ||
        (e.settlement_status || '').toLowerCase().includes(q)
    )
  }, [exceptions, queueSearch])

  // Save current active scenario to MongoDB
  const handleSaveSimulation = async () => {
    setIsSaving(true)
    setSaveStatus(null)
    try {
      const targetTx = currentException?.transaction_id || 'TXN_SIMULATION'
      const timingStr = `T+${settlementTimingDays}`

      await saveSimulationScenario({
        name: `Pricing Model (${newDiscountPct}% Disc, ${timingStr})`,
        transaction_id: targetTx,
        exception_type: currentException?.exception_type || 'COMMERCIAL_PRICING',
        gross_amount: grossAmount,
        current_discount_pct: currentDiscountPct,
        new_discount_pct: newDiscountPct,
        fee_pct: feePct,
        tax_pct: taxPct,
        refund_amount: refundAmount,
        settlement_recovery_pct: settlementRecoveryPct,
        settlement_timing: timingStr,
      })

      setSaveStatus({
        type: 'success',
        message: `Simulation scenario for ${targetTx} saved securely to MongoDB.`,
      })
      await loadSavedSimulations()
      setTimeout(() => setSaveStatus(null), 4000)
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: err?.message || 'Unable to save simulation scenario. Please try again.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Delete a saved simulation
  const handleDeleteSimulation = async (id: string) => {
    try {
      await deleteSavedSimulation(id)
      setSavedSimulations((prev) => prev.filter((s) => s.id !== id))
    } catch (err: any) {
      console.warn('Failed to delete simulation:', err)
    }
  }

  // Phase 6.2: Direct Payment Link Execution Handler
  const handleCreatePaymentLink = async () => {
    if (isCreatingPaymentLink) return
    setIsCreatingPaymentLink(true)
    setPaymentLinkError(null)

    const simDelta = sim.deltas.merchant_delta
    const actionAmount =
      refundAmount > 0
        ? refundAmount
        : simDelta !== 0
        ? Math.abs(simDelta)
        : Math.max(500, Math.round(grossAmount * 0.05))

    const targetTx = currentException?.transaction_id || 'TXN_SIMULATION'
    const desc = `Counterfactual approved settlement payment link for ${targetTx}`

    try {
      const res = await executeDirectPaymentLink({
        amount: actionAmount,
        currency: 'INR',
        description: desc,
        simulationId: `sim_${targetTx.toLowerCase()}`,
        recommendationId: `rec_${Date.now().toString(36)}`,
        customerName: 'Merchant Partner',
        customerEmail: 'finance@merchant.io',
      })

      setPaymentLinkResult({
        success: res.success,
        executionId: res.executionId,
        status: res.status,
        razorpayId: res.razorpayId || '',
        shortUrl: res.shortUrl || '',
        amount: actionAmount,
      })
    } catch (err: any) {
      setPaymentLinkError(err?.message || 'Payment Link creation failed. Please check backend configuration.')
    } finally {
      setIsCreatingPaymentLink(false)
    }
  }

  // Phase 6.3: Refund Execution Handlers
  const handleReviewRefund = () => {
    if (!refundPaymentId.trim()) {
      setRefundError('Payment ID is required for issuing refunds.')
      return
    }
    if (refundCustomAmount <= 0) {
      setRefundError('Refund amount must be greater than zero.')
      return
    }
    setRefundError(null)
    setRefundStep('CONFIRM')
  }

  const handleConfirmRefund = async () => {
    if (isRefunding) return
    setIsRefunding(true)
    setRefundError(null)

    const targetTx = currentException?.transaction_id || 'TXN_SIMULATION'
    try {
      const res = await executeDirectRefund({
        paymentId: refundPaymentId.trim(),
        amount: refundCustomAmount,
        simulationId: `sim_${targetTx.toLowerCase()}`,
        recommendationId: `rec_${Date.now().toString(36)}`,
      })

      setRefundResult({
        success: res.success,
        executionId: res.executionId,
        status: res.status,
        refundId: res.refundId || '',
        paymentId: res.paymentId || refundPaymentId,
        amount: refundCustomAmount,
        message: 'Refund executed successfully via Razorpay Sandbox.',
      })
      setRefundStep('FORM')
    } catch (err: any) {
      setRefundError(err?.message || 'Refund execution failed.')
    } finally {
      setIsRefunding(false)
    }
  }

  // Phase 6.4: Invoice Execution Handlers
  const handleReviewInvoice = () => {
    if (!invoiceCustomerName.trim()) {
      setInvoiceError('Customer Name is required.')
      return
    }
    if (!invoiceCustomerEmail.trim() || !invoiceCustomerEmail.includes('@')) {
      setInvoiceError('Valid Customer Email is required.')
      return
    }
    if (invoiceAmount <= 0) {
      setInvoiceError('Invoice amount must be greater than zero.')
      return
    }
    setInvoiceError(null)
    setInvoiceStep('CONFIRM')
  }

  const handleConfirmInvoice = async () => {
    if (isCreatingInvoice) return
    setIsCreatingInvoice(true)
    setInvoiceError(null)

    const targetTx = currentException?.transaction_id || 'TXN_SIMULATION'
    try {
      const res = await executeDirectInvoice({
        customerName: invoiceCustomerName.trim(),
        customerEmail: invoiceCustomerEmail.trim(),
        customerContact: invoiceCustomerContact.trim(),
        description: invoiceDescription.trim() || 'Counterfactual Settlement Invoice',
        amount: invoiceAmount,
        currency: 'INR',
        simulationId: `sim_${targetTx.toLowerCase()}`,
        recommendationId: `rec_${Date.now().toString(36)}`,
      })

      setInvoiceResult({
        success: res.success,
        executionId: res.executionId,
        status: res.status,
        invoiceId: res.invoiceId || '',
        amount: invoiceAmount,
        currency: 'INR',
        invoiceUrl: res.invoiceUrl || '',
        message: 'Invoice created successfully via Razorpay Sandbox.',
      })
      setInvoiceStep('FORM')
    } catch (err: any) {
      setInvoiceError(err?.message || 'Invoice creation failed.')
    } finally {
      setIsCreatingInvoice(false)
    }
  }

  // Apply saved simulation back to interactive sliders
  const handleApplySaved = (saved: SavedSimulation) => {
    if (saved.scenario) {
      if (saved.baseline?.gross_amount) setGrossAmount(saved.baseline.gross_amount)
      if (saved.scenario.current_discount !== undefined) setCurrentDiscountPct(saved.scenario.current_discount)
      if (saved.scenario.discount !== undefined) setNewDiscountPct(saved.scenario.discount)
      if (saved.scenario.gateway_fee !== undefined) setFeePct(saved.scenario.gateway_fee)
      if (saved.scenario.recovery_percentage !== undefined) setSettlementRecoveryPct(saved.scenario.recovery_percentage)
      if (saved.scenario.settlement_timing) {
        const timingMap: Record<string, number> = { 'T+0': 0, 'T+1': 1, 'T+2': 2 }
        setSettlementTimingDays(timingMap[saved.scenario.settlement_timing] ?? 1)
      }
      setStudioMode('COMMERCIAL_PRICING')
    }
  }

  // Reset variables to baseline
  const handleResetVariables = () => {
    setCurrentDiscountPct(5.0)
    setNewDiscountPct(3.0)
    setFeePct(1.8)
    setTaxPct(18.0)
    setSettlementRecoveryPct(100)
    setSettlementTimingDays(1)
  }

  const sim = simulationResult.simulation
  const expected = Number(currentException?.expected_settlement ?? 0)
  const isDuplicate = currentException?.exception_type === 'DUPLICATE'

  return (
    <div className="space-y-6">
      {/* Hero Workspace Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Decision Intelligence</span>
            <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-500/40 px-2 py-0.5 rounded shadow-2xs">
              Simulation Engine
            </span>
          </div>
          <h1 className="page-title">What-If Simulator</h1>
          <p className="page-subhead">
            See what will happen to your money before you make pricing, discount, or payment decisions.
          </p>
        </div>

        {/* Multi-Mode Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setStudioMode('COMMERCIAL_PRICING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              studioMode === 'COMMERCIAL_PRICING'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles size={13} className={studioMode === 'COMMERCIAL_PRICING' ? 'text-white' : 'text-indigo-400'} />
            <span>Pricing What-If</span>
          </button>

          <button
            onClick={() => setStudioMode('RAZORPAY_EXECUTION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              studioMode === 'RAZORPAY_EXECUTION'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap size={13} className={studioMode === 'RAZORPAY_EXECUTION' ? 'text-emerald-300' : 'text-emerald-400'} />
            <span className="flex items-center gap-1">
              <span>Take Action</span>
              <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1 py-0.2 rounded border border-emerald-500/40">
                Sandbox
              </span>
            </span>
          </button>

          <button
            onClick={() => setStudioMode('EXCEPTION_RESOLUTION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              studioMode === 'EXCEPTION_RESOLUTION'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wrench size={13} />
            <span>Payment Fix Strategy</span>
          </button>

          <button
            onClick={() => setStudioMode('SAVED_SCENARIOS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              studioMode === 'SAVED_SCENARIOS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database size={13} className="text-emerald-400" />
            <span>Saved Scenarios ({savedSimulations.length})</span>
          </button>
        </div>
      </div>

      {/* Entry Mode Switcher: Existing Payment vs New What-If Scenario */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEntryMode('HYPOTHETICAL_SCENARIO')
              setGrossAmount(hypotheticalGross)
              setRefundAmount(0)
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              entryMode === 'HYPOTHETICAL_SCENARIO'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
            }`}
          >
            <Sparkles size={14} className={entryMode === 'HYPOTHETICAL_SCENARIO' ? 'text-white' : 'text-indigo-400'} />
            <span>New What-If Scenario</span>
          </button>

          <button
            onClick={() => {
              setEntryMode('EXISTING_PAYMENT')
              if (currentException) {
                setGrossAmount(Number(currentException.expected_settlement || currentException.actual_settlement || 10000))
                setRefundAmount(Number(currentException.refund_amount || 0))
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              entryMode === 'EXISTING_PAYMENT'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-950/60 border border-slate-800'
            }`}
          >
            <Receipt size={14} className={entryMode === 'EXISTING_PAYMENT' ? 'text-white' : 'text-slate-400'} />
            <span>Existing Payment Problem</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-medium hidden sm:flex items-center gap-1.5">
          <Info size={14} className="text-indigo-400" />
          <span>
            {entryMode === 'HYPOTHETICAL_SCENARIO'
              ? 'Test pricing, discounts, and fee changes without selecting an existing payment.'
              : 'Analyze and resolve specific disputed merchant transactions.'}
          </span>
        </div>
      </div>

      {/* Save Notification Feedback Banner */}
      {saveStatus && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs animate-in fade-in duration-200 ${
            saveStatus.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {saveStatus.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <ShieldCheck size={16} className="text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">{saveStatus.message}</span>
          </div>
          <button
            onClick={() => setSaveStatus(null)}
            className="text-[11px] hover:underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2-Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-4 card-panel flex flex-col h-[780px]">
          {entryMode === 'HYPOTHETICAL_SCENARIO' ? (
            <div className="flex flex-col h-full space-y-4 p-4 overflow-y-auto">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Quick Presets
                </span>
                <h3 className="font-bold text-white text-sm">What-If Templates</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click a template to load real business pricing scenarios.
                </p>
              </div>

              <div className="space-y-2.5">
                {HYPOTHETICAL_PRESETS.map((preset) => {
                  const isSelected = grossAmount === preset.gross && newDiscountPct === preset.newDiscount
                  return (
                    <div
                      key={preset.name}
                      onClick={() => {
                        setHypotheticalGross(preset.gross)
                        setGrossAmount(preset.gross)
                        setHypotheticalVolume(preset.volume)
                        setCurrentDiscountPct(preset.currentDiscount)
                        setNewDiscountPct(preset.newDiscount)
                        setFeePct(preset.fee)
                        setSettlementRecoveryPct(preset.recovery)
                        setSettlementTimingDays(preset.timing)
                        setRefundAmount(0)
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-950/70 border-indigo-500 shadow-md ring-1 ring-indigo-500/40'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <strong className="text-xs font-bold text-white">{preset.name}</strong>
                        <span className="text-[10px] font-bold text-indigo-300 bg-indigo-900/60 px-1.5 py-0.5 rounded">
                          {preset.newDiscount}% Disc
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-2">{preset.desc}</p>
                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800 text-slate-300">
                        <span>Sales: <strong className="text-white font-mono">{formatCurrency(preset.gross)}</strong></span>
                        <span>Orders: <strong className="text-white font-mono">{preset.volume}</strong></span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-400 mt-auto">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Info size={13} className="text-indigo-400" />
                  <span>Merchant What-If Tips</span>
                </span>
                <ul className="space-y-1 text-[11px] list-disc list-inside text-slate-400">
                  <li>Compare discount proposals against expected volume lift.</li>
                  <li>Check payment processing fees before signing processor contracts.</li>
                  <li>Simulate Same-Day vs Next-Day payout cashflow effects.</li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <span>Disputed Payment Queue</span>
                    <span className="text-xs text-slate-400 font-normal">
                      ({filteredQueue.length} items)
                    </span>
                  </h3>
                </div>

                <input
                  type="text"
                  placeholder="Search by transaction ID, problem, status..."
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 p-2 space-y-1">
                {filteredQueue.map((item) => {
                  const isSelected = item.transaction_id === currentException?.transaction_id
                  const itemDiff = Math.abs(Number(item.difference ?? 0))
                  const severity = getExceptionSeverity(item.exception_type)
                  const isItemDup = item.exception_type === 'DUPLICATE'

                  return (
                    <div
                      key={item.transaction_id}
                      onClick={() => onSelectTxId && onSelectTxId(item.transaction_id)}
                      className={`p-3 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30'
                          : 'bg-slate-900/40 border-transparent hover:bg-slate-800/60 hover:border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`mono-id font-bold text-xs ${
                            isSelected ? 'text-indigo-300' : 'text-white'
                          }`}
                        >
                          {item.transaction_id}
                        </span>
                        <RiskBadge risk={severity} />
                      </div>

                      <div className="text-xs text-slate-300 font-medium mb-1">
                        {readableException(item.exception_type)}
                        {isItemDup && (
                          <span className="ml-1 text-[10px] text-amber-300 font-bold bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/40">
                            Duplicate Payment
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/80">
                        <span className="text-slate-400">Expected:</span>
                        <span className="font-bold text-slate-200 tabular-nums">
                          {formatCurrency(item.expected_settlement)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <span className="text-slate-400">Difference:</span>
                        <span className="font-bold text-rose-400 tabular-nums">
                          {formatCurrency(itemDiff)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Right Column: Simulation & Decision Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {/* Prominent Simulation Disclaimer */}
          <div className="p-3.5 bg-indigo-950/50 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-indigo-200 shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-indigo-400 shrink-0" />
              <span>
                <strong>Notice:</strong> This is a simulation. It does not change your real payments.
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 bg-indigo-900/60 px-2 py-0.5 rounded">
              {entryMode === 'HYPOTHETICAL_SCENARIO' ? 'Hypothetical Mode' : 'Payment Mode'}
            </span>
          </div>

          {/* Active Entity or Hypothetical Sales Bar */}
          <div className="card-panel p-5 bg-slate-900 border border-slate-800 shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {entryMode === 'HYPOTHETICAL_SCENARIO' ? (
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      Hypothetical Sales Parameters
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-500/40 px-1.5 py-0.2 rounded">
                      Live What-If
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Gross Sales (₹)</label>
                      <input
                        type="number"
                        min="1000"
                        max="10000000"
                        step="1000"
                        value={grossAmount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setGrossAmount(val)
                          setHypotheticalGross(val)
                        }}
                        className="w-full bg-transparent font-mono text-lg font-bold text-white outline-none"
                      />
                    </div>

                    <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Expected Orders / Transactions</label>
                      <input
                        type="number"
                        min="1"
                        max="100000"
                        step="10"
                        value={hypotheticalVolume}
                        onChange={(e) => setHypotheticalVolume(parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-transparent font-mono text-lg font-bold text-white outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Selected Disputed Payment
                    </span>
                    <RiskBadge risk={getExceptionSeverity(currentException?.exception_type)} />
                    {isDuplicate && (
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-1.5 py-0.5 rounded">
                        Duplicate Payment
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-white mono-id">
                    {currentException?.transaction_id}
                  </h2>
                  <p className="text-xs text-slate-300">
                    Order: <strong className="text-white">{currentException?.order_id || 'ORD_2013'}</strong> • Method:{' '}
                    <strong className="text-white">{currentException?.payment_method || 'CARD'}</strong> • Expected:{' '}
                    <strong className="text-indigo-300 font-mono">{formatCurrency(expected)}</strong>
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:items-end gap-2">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Sales</span>
                  <span className="text-2xl font-bold text-white tabular-nums font-mono">
                    {formatCurrency(grossAmount)}
                  </span>
                </div>

                {/* Save Scenario Button */}
                <button
                  onClick={handleSaveSimulation}
                  disabled={isSaving}
                  className="btn btn-primary btn-sm mt-1 shadow-md"
                  title="Save simulation scenario to MongoDB"
                >
                  <BookmarkPlus size={13} className={isSaving ? 'spin' : ''} />
                  <span>{isSaving ? 'Saving...' : 'Save Scenario'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* =========================================================
              MODE 1: COMMERCIAL PRICING SIMULATOR (PHASE 4 PRIMARY)
          ========================================================= */}
          {studioMode === 'COMMERCIAL_PRICING' && (
            <>
              {/* 3D Visual Flow Experience Scene (in payment mode) */}
              {entryMode === 'EXISTING_PAYMENT' && (
                <CounterfactualScene
                  grossAmount={grossAmount}
                  currentSettlement={sim.current_state.merchant_settlement}
                  counterfactualSettlement={sim.counterfactual_state.merchant_settlement}
                  merchantDelta={sim.deltas.merchant_delta}
                  activeScenario={active3DBranch}
                  onSelectScenario={setActive3DBranch}
                />
              )}

              {/* Scenario Controls (Live Sliders) */}
              <ScenarioControls
                grossAmount={grossAmount}
                currentDiscountPct={currentDiscountPct}
                newDiscountPct={newDiscountPct}
                feePct={feePct}
                taxPct={taxPct}
                refundAmount={refundAmount}
                settlementRecoveryPct={settlementRecoveryPct}
                settlementTimingDays={settlementTimingDays}
                onDiscountChange={setNewDiscountPct}
                onFeeChange={setFeePct}
                onRefundChange={setRefundAmount}
                onRecoveryChange={setSettlementRecoveryPct}
                onTimingChange={setSettlementTimingDays}
                onReset={handleResetVariables}
              />

              {/* Side-by-Side Financial Impact */}
              <FinancialImpact simulation={sim} />

              {/* Collapsible Calculation Details Section */}
              <div className="card-panel p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                <button
                  onClick={() => setShowFormulaDetails(!showFormulaDetails)}
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Info size={14} className="text-indigo-400" />
                    <span>Show calculation details</span>
                  </div>
                  {showFormulaDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showFormulaDetails && (
                  <div className="pt-3 border-t border-slate-800 space-y-2 text-xs text-slate-300 font-mono">
                    <div className="p-3 bg-slate-950 rounded-lg space-y-1.5">
                      <div className="text-indigo-300 font-bold">Calculation Formula:</div>
                      <div>Money You Receive = Gross Sales - Customer Discount - Payment Processing Fee - GST - Refunds</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                      <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                        <span className="text-slate-400 text-[10px] uppercase block">Current Plan Calculation</span>
                        <div>Gross: {formatCurrency(grossAmount)}</div>
                        <div>Discount ({currentDiscountPct}%): -{formatCurrency(sim.current_state.discount_amount)}</div>
                        <div>Fee + GST ({feePct}% + 18%): -{formatCurrency(sim.current_state.fee_amount + sim.current_state.tax_amount)}</div>
                        <div className="font-bold text-emerald-400 pt-1">Payout: {formatCurrency(sim.current_state.merchant_settlement)}</div>
                      </div>

                      <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                        <span className="text-slate-400 text-[10px] uppercase block">Proposed Plan Calculation</span>
                        <div>Gross: {formatCurrency(grossAmount)}</div>
                        <div>Discount ({newDiscountPct}%): -{formatCurrency(sim.counterfactual_state.discount_amount)}</div>
                        <div>Fee + GST ({feePct}% + 18%): -{formatCurrency(sim.counterfactual_state.fee_amount + sim.counterfactual_state.tax_amount)}</div>
                        <div className="font-bold text-indigo-400 pt-1">Payout: {formatCurrency(sim.counterfactual_state.merchant_settlement)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Calculated Explanation & Audit Trail */}
              <CounterfactualExplanation simulation={sim} />

              {/* =========================================================
                  PHASE 6: RAZORPAY SANDBOX MULTI-ACTION EXECUTION PANEL
              ========================================================= */}
              <div className="card-panel p-5 bg-gradient-to-br from-slate-900 via-slate-900/95 to-indigo-950/60 border border-indigo-500/30 rounded-xl space-y-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        ACTION CENTER
                      </span>
                      <span className="text-[10px] font-bold bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck size={10} />
                        <span>Razorpay Test Sandbox</span>
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Take Action</span>
                      <span className="mono-id text-xs text-indigo-300">
                        ({entryMode === 'HYPOTHETICAL_SCENARIO' ? 'HYPOTHETICAL_SIMULATION' : currentException?.transaction_id || 'TXN_SIMULATION'})
                      </span>
                    </h3>
                  </div>

                  {/* Action Selector Pills */}
                  <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setExecType('PAYMENT_LINK')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                        execType === 'PAYMENT_LINK'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Payment Link
                    </button>
                    <button
                      onClick={() => setExecType('REFUND')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                        execType === 'REFUND'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Refund
                    </button>
                    <button
                      onClick={() => setExecType('INVOICE')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                        execType === 'INVOICE'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Invoice
                    </button>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* 1. PAYMENT LINK SUB-PANEL (PHASE 6.2) */}
                {/* ------------------------------------------------------------- */}
                {execType === 'PAYMENT_LINK' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Recommended Action
                        </span>
                        <strong className="text-xs font-bold text-indigo-300 block truncate mt-0.5">
                          {refundAmount > 0 ? 'Partial Settlement Refund' : 'Commercial Payment Link'}
                        </strong>
                      </div>

                      <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Execution Amount
                        </span>
                        <strong className="text-base font-bold text-white tabular-nums">
                          {formatCurrency(
                            refundAmount > 0
                              ? refundAmount
                              : sim.deltas.merchant_delta !== 0
                              ? Math.abs(sim.deltas.merchant_delta)
                              : Math.max(500, Math.round(grossAmount * 0.05))
                          )}
                        </strong>
                      </div>

                      <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Gateway Environment
                        </span>
                        <strong className="text-xs font-bold text-slate-300 block mt-0.5">
                          Razorpay Sandbox (Server-Side)
                        </strong>
                      </div>
                    </div>

                    {/* Success Result View */}
                    {paymentLinkResult && paymentLinkResult.success && (
                      <div className="p-4 bg-emerald-950/70 border border-emerald-500/50 rounded-xl space-y-3 animate-in fade-in duration-200 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                            <CheckCircle2 size={18} className="text-emerald-400" />
                            <span>✓ Payment Link Created</span>
                          </div>
                          <span className="text-[10px] font-bold bg-emerald-900/90 text-emerald-200 px-2 py-0.5 rounded border border-emerald-700">
                            Sandbox Verified
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-emerald-900/60">
                            <span className="text-[10px] text-slate-400 block">Amount</span>
                            <strong className="text-white text-xs tabular-nums">
                              {formatCurrency(paymentLinkResult.amount)}
                            </strong>
                          </div>

                          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-emerald-900/60">
                            <span className="text-[10px] text-slate-400 block">Execution ID</span>
                            <strong className="text-indigo-300 font-mono text-xs truncate block">
                              {paymentLinkResult.executionId}
                            </strong>
                          </div>

                          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-emerald-900/60">
                            <span className="text-[10px] text-slate-400 block">Razorpay ID</span>
                            <strong className="text-emerald-300 font-mono text-xs truncate block">
                              {paymentLinkResult.razorpayId || 'plink_Sandbox'}
                            </strong>
                          </div>
                        </div>

                        {paymentLinkResult.shortUrl && (
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-900/50">
                            <span className="text-slate-300 text-xs font-mono truncate max-w-sm">
                              {paymentLinkResult.shortUrl}
                            </span>
                            <a
                              href={paymentLinkResult.shortUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary btn-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                            >
                              <span>Open Payment Link</span>
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {paymentLinkError && (
                      <div className="p-4 bg-rose-950/70 border border-rose-500/50 rounded-xl space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-rose-300 font-bold">
                          <AlertTriangle size={15} className="text-rose-400" />
                          <span>Payment Link Creation Failed</span>
                        </div>
                        <p className="text-rose-200">{paymentLinkError}</p>
                      </div>
                    )}

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
                      <button
                        onClick={handleCreatePaymentLink}
                        disabled={isCreatingPaymentLink}
                        className="btn btn-primary font-bold text-xs py-2.5 px-6 shadow-md cursor-pointer"
                      >
                        <Zap size={14} className={isCreatingPaymentLink ? 'spin' : ''} />
                        <span>
                          {isCreatingPaymentLink
                            ? 'Creating Payment Link in Sandbox...'
                            : 'Create Payment Link'}
                        </span>
                      </button>

                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Lock size={12} className="text-slate-500" />
                        <span>Test Mode • Server-side API Execution</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* 2. REFUND SUB-PANEL (PHASE 6.3) */}
                {/* ------------------------------------------------------------- */}
                {execType === 'REFUND' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      REFUND EXECUTION
                    </div>

                    {refundStep === 'FORM' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block">
                              Refund Amount (INR)
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={refundCustomAmount}
                              onChange={(e) => setRefundCustomAmount(Number(e.target.value))}
                              className="input w-full font-bold text-white text-sm bg-slate-900 border-slate-700"
                            />
                          </div>

                          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block">
                              Payment ID
                            </label>
                            <input
                              type="text"
                              value={refundPaymentId}
                              onChange={(e) => setRefundPaymentId(e.target.value)}
                              placeholder="pay_xxxxx"
                              className="input w-full font-mono text-white text-xs bg-slate-900 border-slate-700"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Recommended Action
                            </span>
                            <strong className="text-indigo-300 font-bold block mt-0.5">
                              Settlement Discrepancy Refund
                            </strong>
                          </div>

                          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Refund Type
                            </span>
                            <strong className="text-slate-200 font-bold block mt-0.5">
                              {refundCustomAmount >= grossAmount ? 'Full Refund' : 'Partial Refund'}
                            </strong>
                          </div>

                          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Risk & Guardrails
                            </span>
                            <span className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                              <ShieldCheck size={13} />
                              <span>Bounds Verified</span>
                            </span>
                          </div>
                        </div>

                        {refundError && (
                          <div className="p-3.5 bg-rose-950/70 border border-rose-500/50 rounded-xl space-y-1 text-xs">
                            <div className="flex items-center gap-2 text-rose-300 font-bold">
                              <AlertTriangle size={15} className="text-rose-400" />
                              <span>Refund Validation Error</span>
                            </div>
                            <p className="text-rose-200">{refundError}</p>
                          </div>
                        )}

                        <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                          <button
                            onClick={handleReviewRefund}
                            className="btn btn-primary font-bold text-xs py-2.5 px-6 shadow-md cursor-pointer"
                          >
                            <span>Review Refund</span>
                          </button>
                          <span className="text-[11px] text-slate-400">
                            Step 1 of 2: Review & Authorization
                          </span>
                        </div>
                      </div>
                    )}

                    {/* CONFIRMATION STEP */}
                    {refundStep === 'CONFIRM' && (
                      <div className="p-4 bg-slate-950/90 border border-indigo-500/40 rounded-xl space-y-4 text-xs animate-in zoom-in-95 duration-200">
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                            REFUND CONFIRMATION
                          </div>
                          <h4 className="text-sm font-bold text-white">
                            Verify Refund Parameters before Razorpay Execution
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Amount</span>
                            <strong className="text-white text-sm font-bold tabular-nums">
                              {formatCurrency(refundCustomAmount)}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Payment ID</span>
                            <strong className="text-indigo-300 font-mono text-xs truncate block">
                              {refundPaymentId}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Refund Type</span>
                            <strong className="text-slate-200 text-xs font-bold block">
                              {refundCustomAmount >= grossAmount ? 'Full Refund' : 'Partial Refund'}
                            </strong>
                          </div>
                        </div>

                        <div className="p-3 bg-amber-950/70 border border-amber-500/50 rounded-lg flex items-center gap-2.5 text-amber-200">
                          <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                          <span className="font-semibold">
                            WARNING: This action will execute a refund through Razorpay Sandbox.
                          </span>
                        </div>

                        {refundError && (
                          <div className="p-3 bg-rose-950/70 border border-rose-500/50 rounded-lg text-rose-200">
                            {refundError}
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={handleConfirmRefund}
                            disabled={isRefunding}
                            className="btn btn-primary font-bold text-xs py-2.5 px-6 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 shadow-lg cursor-pointer"
                          >
                            <Zap size={14} className={isRefunding ? 'spin' : ''} />
                            <span>{isRefunding ? 'Executing Refund in Sandbox...' : 'Confirm Refund'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setRefundStep('FORM')
                              setRefundError(null)
                            }}
                            disabled={isRefunding}
                            className="btn btn-secondary text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SUCCESS RECEIPT VIEW */}
                    {refundResult && refundResult.success && (
                      <div className="p-4 bg-emerald-950/70 border border-emerald-500/50 rounded-xl space-y-3 animate-in fade-in duration-200 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                            <CheckCircle2 size={18} className="text-emerald-400" />
                            <span>✓ Refund Executed</span>
                          </div>
                          <span className="text-[10px] font-bold bg-emerald-900/90 text-emerald-200 px-2 py-0.5 rounded border border-emerald-700">
                            Razorpay Sandbox Settled
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-emerald-900/60">
                            <span className="text-[10px] text-slate-400 block">Refund ID</span>
                            <strong className="text-emerald-300 font-mono text-xs truncate block">
                              {refundResult.refundId || 'rfnd_Sandbox123'}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-emerald-900/60">
                            <span className="text-[10px] text-slate-400 block">Payment ID</span>
                            <strong className="text-indigo-300 font-mono text-xs truncate block">
                              {refundResult.paymentId}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-emerald-900/60">
                            <span className="text-[10px] text-slate-400 block">Amount</span>
                            <strong className="text-white text-xs tabular-nums block">
                              {formatCurrency(refundResult.amount)}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-emerald-900/60">
                            <span className="text-[10px] text-slate-400 block">Status</span>
                            <strong className="text-emerald-400 font-bold text-xs block">
                              EXECUTED
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* 3. INVOICE SUB-PANEL (PHASE 6.4) */}
                {/* ------------------------------------------------------------- */}
                {execType === 'INVOICE' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      INVOICE EXECUTION
                    </div>

                    {invoiceStep === 'FORM' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block">
                              Invoice Amount (INR)
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={invoiceAmount}
                              onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                              className="input w-full font-bold text-white text-sm bg-slate-900 border-slate-700"
                            />
                          </div>

                          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block">
                              Customer Name
                            </label>
                            <input
                              type="text"
                              value={invoiceCustomerName}
                              onChange={(e) => setInvoiceCustomerName(e.target.value)}
                              placeholder="Merchant Name"
                              className="input w-full text-white text-xs bg-slate-900 border-slate-700"
                            />
                          </div>

                          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block">
                              Customer Email
                            </label>
                            <input
                              type="email"
                              value={invoiceCustomerEmail}
                              onChange={(e) => setInvoiceCustomerEmail(e.target.value)}
                              placeholder="finance@merchant.io"
                              className="input w-full text-white text-xs bg-slate-900 border-slate-700"
                            />
                          </div>

                          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400 block">
                              Customer Contact
                            </label>
                            <input
                              type="text"
                              value={invoiceCustomerContact}
                              onChange={(e) => setInvoiceCustomerContact(e.target.value)}
                              placeholder="+91 9876543210"
                              className="input w-full text-white text-xs bg-slate-900 border-slate-700"
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400 block">
                            Description
                          </label>
                          <input
                            type="text"
                            value={invoiceDescription}
                            onChange={(e) => setInvoiceDescription(e.target.value)}
                            className="input w-full text-white text-xs bg-slate-900 border-slate-700"
                          />
                        </div>

                        {invoiceError && (
                          <div className="p-3.5 bg-rose-950/70 border border-rose-500/50 rounded-xl space-y-1 text-xs">
                            <div className="flex items-center gap-2 text-rose-300 font-bold">
                              <AlertTriangle size={15} className="text-rose-400" />
                              <span>Invoice Validation Error</span>
                            </div>
                            <p className="text-rose-200">{invoiceError}</p>
                          </div>
                        )}

                        <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                          <button
                            onClick={handleReviewInvoice}
                            className="btn btn-primary font-bold text-xs py-2.5 px-6 shadow-md cursor-pointer"
                          >
                            <span>Review Invoice</span>
                          </button>
                          <span className="text-[11px] text-slate-400">
                            Step 1 of 2: Review & Authorization
                          </span>
                        </div>
                      </div>
                    )}

                    {/* CONFIRMATION STEP */}
                    {invoiceStep === 'CONFIRM' && (
                      <div className="p-4 bg-slate-950/90 border border-indigo-500/40 rounded-xl space-y-4 text-xs animate-in zoom-in-95 duration-200">
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                            INVOICE CONFIRMATION
                          </div>
                          <h4 className="text-sm font-bold text-white">
                            Verify Invoice Parameters before Creation
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Amount</span>
                            <strong className="text-white text-sm font-bold tabular-nums">
                              {formatCurrency(invoiceAmount)}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Customer</span>
                            <strong className="text-indigo-300 text-xs truncate block">
                              {invoiceCustomerName}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Email</span>
                            <strong className="text-slate-200 text-xs truncate block">
                              {invoiceCustomerEmail}
                            </strong>
                          </div>
                        </div>

                        <div className="p-3 bg-amber-950/70 border border-amber-500/50 rounded-lg flex items-center gap-2.5 text-amber-200">
                          <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                          <span className="font-semibold">
                            WARNING: This action will create an invoice through Razorpay Sandbox.
                          </span>
                        </div>

                        {invoiceError && (
                          <div className="p-3 bg-rose-950/70 border border-rose-500/50 rounded-lg text-rose-200">
                            {invoiceError}
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={handleConfirmInvoice}
                            disabled={isCreatingInvoice}
                            className="btn btn-primary font-bold text-xs py-2.5 px-6 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 shadow-lg cursor-pointer"
                          >
                            <Zap size={14} className={isCreatingInvoice ? 'spin' : ''} />
                            <span>{isCreatingInvoice ? 'Creating Invoice in Sandbox...' : 'Create Invoice'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setInvoiceStep('FORM')
                              setInvoiceError(null)
                            }}
                            disabled={isCreatingInvoice}
                            className="btn btn-secondary text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SUCCESS RECEIPT VIEW */}
                    {invoiceResult && invoiceResult.success && (
                      <div className="p-4 bg-emerald-950/70 border border-emerald-500/50 rounded-xl space-y-3 animate-in fade-in duration-200 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                            <CheckCircle2 size={18} className="text-emerald-400" />
                            <span>✓ Invoice Created</span>
                          </div>
                          <span className="text-[10px] font-bold bg-emerald-900/90 text-emerald-200 px-2 py-0.5 rounded border border-emerald-700">
                            Sandbox Verified
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-emerald-900/60">
                            <span className="text-[10px] text-slate-400 block">Invoice ID</span>
                            <strong className="text-emerald-300 font-mono text-xs truncate block">
                              {invoiceResult.invoiceId || 'inv_Sandbox123'}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-emerald-900/60">
                            <span className="text-[10px] text-slate-400 block">Customer</span>
                            <strong className="text-indigo-300 text-xs truncate block">
                              {invoiceCustomerName}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-emerald-900/60">
                            <span className="text-[10px] text-slate-400 block">Amount</span>
                            <strong className="text-white text-xs tabular-nums block">
                              {formatCurrency(invoiceResult.amount)}
                            </strong>
                          </div>
                          <div className="p-2.5 bg-slate-950/80 rounded-lg border border-emerald-900/60">
                            <span className="text-[10px] text-slate-400 block">Status</span>
                            <strong className="text-emerald-400 font-bold text-xs block">
                              EXECUTED
                            </strong>
                          </div>
                        </div>

                        {invoiceResult.invoiceUrl && (
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-900/50">
                            <span className="text-slate-300 text-xs font-mono truncate max-w-sm">
                              {invoiceResult.invoiceUrl}
                            </span>
                            <a
                              href={invoiceResult.invoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary btn-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                            >
                              <span>Open Invoice</span>
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Multi-Scenario Comparison Matrix */}
              <ScenarioComparison
                scenarios={simulationResult.multi_scenarios}
                activeDiscountPct={newDiscountPct}
                onSelectScenarioDiscount={setNewDiscountPct}
              />
            </>
          )}

          {/* =========================================================
              MODE: RAZORPAY SANDBOX EXECUTION (PHASE 6)
          ========================================================= */}
          {studioMode === 'RAZORPAY_EXECUTION' && (
            <ExecutionWorkflow
              exception={currentException}
              onRefreshReconciliation={loadSavedSimulations}
            />
          )}

          {/* =========================================================
              MODE 2: EXCEPTION RESOLUTION STRATEGY (PHASE 2/3)
          ========================================================= */}
          {studioMode === 'EXCEPTION_RESOLUTION' && (
            <div className="space-y-6">
              {/* Resolution Strategy Selector */}
              <div className="card-panel p-5 space-y-4">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Wrench size={16} className="text-indigo-400" />
                  <span>Treasury Resolution Strategies</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: 'GATEWAY_RECOVERY',
                      title: 'Direct Gateway Recovery',
                      desc: 'Dispatch batch clawback or recovery instruction to processor endpoint',
                      mitigation: '100%',
                    },
                    {
                      id: 'MERCHANT_DEBIT',
                      title: 'Merchant Next-Batch Offset',
                      desc: 'Apply net adjustment against next settlement disbursement batch',
                      mitigation: '100%',
                    },
                    {
                      id: 'REQUERY_WINDOW',
                      title: 'Settlement Window Re-poll',
                      desc: 'Re-query processor ledger for adjacent settlement clearing batch',
                      mitigation: '95%',
                    },
                    {
                      id: 'FEE_CORRECTION',
                      title: 'Fee Schedule Adjustment',
                      desc: 'Recalculate interchange tier deduction and issue credit adjustment',
                      mitigation: '100%',
                    },
                  ].map((st) => (
                    <div
                      key={st.id}
                      onClick={() => setResolutionScenario(st.id as ResolutionScenario)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition ${
                        resolutionScenario === st.id
                          ? 'bg-indigo-950/80 border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-white">{st.title}</span>
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40">
                          {st.mitigation} Recovery
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{st.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exception Counterfactual Narrative Card */}
              {exceptionExplanation && (
                <div className="card-panel p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl shadow-md space-y-3 border border-indigo-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      Deterministic Finding: {exceptionExplanation.title}
                    </span>
                    <span className="text-xs font-bold bg-indigo-900/80 px-2 py-0.5 rounded border border-indigo-700">
                      Confidence: {(exceptionExplanation.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {exceptionExplanation.counterfactual}
                  </p>

                  <div className="p-3 bg-slate-950/80 rounded-lg border border-indigo-900/40 text-xs">
                    <strong className="text-indigo-300 block mb-0.5">Recommended Treasury Action:</strong>
                    <span className="text-slate-300">{exceptionExplanation.recommended_action}</span>
                  </div>
                </div>
              )}

              {/* Direct Execution Workflow Embedded in Resolution */}
              <ExecutionWorkflow
                exception={currentException}
                onRefreshReconciliation={loadSavedSimulations}
              />
            </div>
          )}

          {/* =========================================================
              MODE 3: SAVED SCENARIOS & USER ISOLATION (PHASE 5D)
          ========================================================= */}
          {studioMode === 'SAVED_SCENARIOS' && (
            <div className="card-panel p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Database size={16} className="text-emerald-400" />
                  <h3 className="font-bold text-white text-sm">
                    Persistent Saved Simulations in MongoDB
                  </h3>
                </div>
                <button
                  onClick={loadSavedSimulations}
                  className="btn btn-secondary btn-sm"
                  disabled={isLoadingSaved}
                >
                  <RefreshCw size={12} className={isLoadingSaved ? 'spin text-indigo-400' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              {savedSimulations.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl space-y-3">
                  <BookmarkPlus size={28} className="mx-auto text-slate-500" />
                  <h4 className="text-sm font-bold text-white">No Saved Scenarios Yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Tune commercial discount sliders in the Simulator tab and click &quot;Save Scenario to MongoDB&quot; to persist your models.
                  </p>
                  <button
                    onClick={() => setStudioMode('COMMERCIAL_PRICING')}
                    className="btn btn-primary btn-sm"
                  >
                    <span>Open Commercial Simulator</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedSimulations.map((saved) => {
                    const delta = saved.financial_delta?.merchant_delta ?? 0
                    const timing = saved.scenario?.settlement_timing || 'T+1'
                    const dateFormatted = new Date(saved.created_at).toLocaleString()

                    return (
                      <div
                        key={saved.id}
                        className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700 transition"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-xs">{saved.name || 'Pricing Scenario'}</span>
                              <span className="mono-id text-[11px] text-indigo-400 font-semibold">
                                {saved.transaction_id}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                {timing}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Clock size={10} />
                              <span>{dateFormatted}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApplySaved(saved)}
                              className="btn btn-primary btn-sm text-xs py-1"
                            >
                              <span>Apply to Sliders</span>
                            </button>
                            <button
                              onClick={() => handleDeleteSimulation(saved.id)}
                              className="btn btn-secondary btn-sm text-xs py-1 text-rose-400 hover:text-rose-300 hover:border-rose-800"
                              title="Delete scenario"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-900 text-xs">
                          <div className="p-2 bg-slate-900/80 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Gross Value</span>
                            <strong className="text-white tabular-nums">
                              {formatCurrency(saved.baseline?.gross_amount || 0)}
                            </strong>
                          </div>

                          <div className="p-2 bg-slate-900/80 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Simulated Discount</span>
                            <strong className="text-indigo-400 tabular-nums">
                              {saved.scenario?.discount ?? 3}% (from {saved.scenario?.current_discount ?? 5}%)
                            </strong>
                          </div>

                          <div className="p-2 bg-slate-900/80 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Merchant Payout</span>
                            <strong className="text-emerald-400 tabular-nums">
                              {formatCurrency(saved.counterfactual?.merchant_payout || 0)}
                            </strong>
                          </div>

                          <div className="p-2 bg-slate-900/80 rounded-lg">
                            <span className="text-[10px] text-slate-500 block">Merchant Delta</span>
                            <strong
                              className={`tabular-nums ${
                                delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {delta >= 0 ? '+' : ''}
                              {formatCurrency(delta)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
