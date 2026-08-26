'use client'

import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  Zap,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Cpu,
  Layers,
  FileText,
  DollarSign,
  ExternalLink,
  Info,
  X,
  Lock,
  Building2,
  History,
  Check,
} from 'lucide-react'
import { getDemoScenario, initializeDemo, resetDemo } from '@/lib/api'

interface DemoStudioModalProps {
  isOpen: boolean
  onClose: () => void
}

type StageId =
  | 'PREDICT'
  | 'RECOMMEND'
  | 'APPROVE'
  | 'EXECUTE'
  | 'OBSERVE'
  | 'COMPARE'
  | 'EXPLAIN'
  | 'LEARN'

export function DemoStudioModal({ isOpen, onClose }: DemoStudioModalProps) {
  const [hasStarted, setHasStarted] = useState(false)
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [approvalStatus, setApprovalStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [isLoading, setIsLoading] = useState(false)
  const [scenarioData, setScenarioData] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadScenario()
    }
  }, [isOpen])

  const loadScenario = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const data = await getDemoScenario()
      setScenarioData(data)
    } catch (err: any) {
      console.warn('Demo scenario loaded with offline fallback:', err)
      // Fallback deterministic scenario structure
      setScenarioData({
        story: {
          hook_title: 'Every merchant makes decisions with incomplete information.',
          hook_subhead: 'What if you could see the consequences before you acted?',
          merchant_request: 'I want to run a 20% discount this weekend.',
          scenario_name: 'Weekend Flash Sale 20% Commercial Discount',
          transaction_id: 'DEMO_TXN_001',
          gross_amount: 50000.0,
        },
        simulation: {
          gross_amount: 50000.0,
          baseline: {
            gross_amount: 50000.0,
            discount: 2500.0,
            discount_pct: 5.0,
            gateway_fee: 900.0,
            tax: 162.0,
            merchant_payout: 46438.0,
            platform_revenue: 3400.0,
          },
          counterfactual: {
            gross_amount: 50000.0,
            discount: 10000.0,
            discount_pct: 20.0,
            gateway_fee: 900.0,
            tax: 162.0,
            merchant_payout: 38938.0,
            platform_revenue: 10900.0,
          },
          deltas: {
            merchant_delta: -7500.0,
            platform_delta: 7500.0,
          },
          decision_guidance: 'Platform Favorable',
          guidance_type: 'platform_favorable',
        },
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = async () => {
    setIsLoading(true)
    try {
      await resetDemo()
    } catch (err) {
      // offline reset safe
    }
    setApprovalStatus('PENDING')
    setCurrentStageIndex(0)
    setHasStarted(false)
    setIsLoading(false)
  }

  const handleApprove = () => {
    setApprovalStatus('APPROVED')
    setCurrentStageIndex(3) // Jump to Stage 4 (EXECUTE)
  }

  const handleReject = () => {
    setApprovalStatus('REJECTED')
  }

  if (!isOpen) return null

  const stages: { id: StageId; title: string; subtitle: string }[] = [
    { id: 'PREDICT', title: '1. Predict', subtitle: 'Baseline vs 20% Discount' },
    { id: 'RECOMMEND', title: '2. Recommend', subtitle: 'Decision Guidance' },
    { id: 'APPROVE', title: '3. Approve', subtitle: 'Human Gate' },
    { id: 'EXECUTE', title: '4. Execute', subtitle: 'Razorpay Sandbox' },
    { id: 'OBSERVE', title: '5. Observe', subtitle: 'Actual Settlement' },
    { id: 'COMPARE', title: '6. Compare', subtitle: 'Delta & Accuracy' },
    { id: 'EXPLAIN', title: '7. Explain', subtitle: 'Root Cause' },
    { id: 'LEARN', title: '8. Learn', subtitle: 'Closed-Loop Feedback' },
  ]

  const sim = scenarioData?.simulation || {
    baseline: { discount: 2500, merchant_payout: 46438, platform_revenue: 3400 },
    counterfactual: { discount: 10000, merchant_payout: 38938, platform_revenue: 10900 },
    deltas: { merchant_delta: -7500, platform_delta: 7500 },
    decision_guidance: 'Platform Favorable',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Studio Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Zap size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  COUNTERFACTUAL DEMO STUDIO
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  DETERMINISTIC 8-STAGE STORY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Primary Scenario: 20% Weekend Commercial Discount on ₹50,000 Gross Transaction
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
              title="Reset demo back to opening hook"
            >
              <RotateCcw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>Reset Demo</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              aria-label="Close demo"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Studio Body */}
        {!hasStarted ? (
          /* OPENING STORY HOOK */
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center my-auto space-y-6 animate-fadeIn">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-xs font-medium text-indigo-400">
              <Sparkles size={14} />
              <span>Fintech Intelligence Proposition</span>
            </div>

            <div className="space-y-3 max-w-3xl">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                &ldquo;Every merchant makes decisions with incomplete information.&rdquo;
              </h1>
              <p className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400">
                What if you could see the consequences before you acted?
              </p>
            </div>

            <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-xl max-w-xl text-left space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Live Scenario Premise
              </div>
              <p className="text-sm text-slate-200">
                Merchant proposes: <span className="font-semibold text-amber-300">&ldquo;I want to run a 20% discount this weekend.&rdquo;</span>
              </p>
              <p className="text-xs text-slate-400">
                Counterfactual models the settlement reduction, generates decision guidance, coordinates Razorpay Sandbox execution with human approval, and tracks the closed-loop outcome.
              </p>
            </div>

            <button
              onClick={() => setHasStarted(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition transform hover:scale-[1.02]"
            >
              <span>Start Counterfactual Demo</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          /* INTERACTIVE 8-STAGE WORKSPACE */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Timeline Stepper Ribbon */}
            <div className="px-6 py-3 bg-slate-950/50 border-b border-slate-800/80 overflow-x-auto">
              <div className="flex items-center justify-between min-w-[700px] gap-2">
                {stages.map((st, idx) => {
                  const isActive = currentStageIndex === idx
                  const isCompleted = currentStageIndex > idx

                  return (
                    <button
                      key={st.id}
                      onClick={() => setCurrentStageIndex(idx)}
                      className={`flex-1 flex flex-col items-center p-2 rounded-xl border text-center transition ${
                        isActive
                          ? 'bg-indigo-950/60 border-indigo-500/60 text-white shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/30'
                          : isCompleted
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                          : 'bg-slate-900/50 border-slate-800/80 text-slate-500 hover:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        {isCompleted ? (
                          <CheckCircle2 size={13} className="text-emerald-400" />
                        ) : (
                          <span
                            className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                              isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {idx + 1}
                          </span>
                        )}
                        <span>{st.title.split('. ')[1]}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 truncate max-w-[90px]">
                        {st.subtitle}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Stage Content Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {/* STAGE 1: PREDICT */}
              {currentStageIndex === 0 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        Stage 1 of 8 — Predictive Financial Engine
                      </span>
                      <h3 className="text-xl font-bold text-white">
                        Baseline vs Proposed 20% Commercial Discount
                      </h3>
                    </div>
                    <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg">
                      Transaction: DEMO_TXN_001
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Baseline */}
                    <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-slate-400" />
                          <h4 className="text-sm font-bold text-white">Baseline (Current 5% Discount)</h4>
                        </div>
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-bold rounded">
                          CURRENT
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Gross Transaction:</span>
                          <span className="font-semibold text-slate-200">₹50,000.00</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Commercial Discount (5%):</span>
                          <span className="font-semibold text-slate-200">₹2,500.00</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Gateway Fee & Tax (1.8% + 18% GST):</span>
                          <span className="font-semibold text-slate-200">₹1,062.00</span>
                        </div>
                        <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-bold text-emerald-400">
                          <span>Merchant Settlement:</span>
                          <span>₹46,438.00</span>
                        </div>
                      </div>
                    </div>

                    {/* Counterfactual */}
                    <div className="p-5 bg-indigo-950/30 border border-indigo-500/40 rounded-xl space-y-4 shadow-lg shadow-indigo-950/30">
                      <div className="flex items-center justify-between pb-3 border-b border-indigo-500/30">
                        <div className="flex items-center gap-2">
                          <Cpu size={16} className="text-indigo-400" />
                          <h4 className="text-sm font-bold text-white">Counterfactual (Proposed 20% Discount)</h4>
                        </div>
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold rounded">
                          PREDICTED
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Gross Transaction:</span>
                          <span className="font-semibold text-slate-200">₹50,000.00</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Commercial Discount (20%):</span>
                          <span className="font-semibold text-amber-300">₹10,000.00</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Gateway Fee & Tax (1.8% + 18% GST):</span>
                          <span className="font-semibold text-slate-200">₹1,062.00</span>
                        </div>
                        <div className="pt-2 border-t border-indigo-500/30 flex justify-between text-sm font-bold text-amber-300">
                          <span>Predicted Merchant Settlement:</span>
                          <span>₹38,938.00</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 2: RECOMMEND */}
              {currentStageIndex === 1 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Stage 2 of 8 — Decision Intelligence & Guidance
                    </span>
                    <h3 className="text-xl font-bold text-white">
                      Actionable Guidance & Financial Delta
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <div className="text-xs text-slate-400 font-medium">Merchant Payout Delta</div>
                      <div className="flex items-center gap-2 text-2xl font-bold text-rose-400">
                        <TrendingDown size={22} />
                        <span>-₹7,500.00</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Merchant receives 16.15% less net settlement due to the 20% discount.
                      </p>
                    </div>

                    <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <div className="text-xs text-slate-400 font-medium">Platform Margin Delta</div>
                      <div className="flex items-center gap-2 text-2xl font-bold text-emerald-400">
                        <TrendingUp size={22} />
                        <span>+₹7,500.00</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Platform retains ₹10,900.00 total commercial margin.
                      </p>
                    </div>

                    <div className="p-5 bg-indigo-950/40 border border-indigo-500/40 rounded-xl space-y-2">
                      <div className="text-xs text-indigo-300 font-medium">Decision Guidance</div>
                      <div className="text-lg font-bold text-indigo-300">
                        Platform Favorable
                      </div>
                      <p className="text-xs text-slate-300">
                        Requires operator sign-off before generating settlement execution link.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      <FileText size={14} className="text-indigo-400" />
                      <span>RECOMMENDED RESOLUTION ACTION</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Issue Payment Link of <strong>₹38,938.00</strong> to settle the 20% promotional pricing tier.
                    </p>
                  </div>
                </div>
              )}

              {/* STAGE 3: APPROVE */}
              {currentStageIndex === 2 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Stage 3 of 8 — Human-in-the-Loop Sign-Off
                    </span>
                    <h3 className="text-xl font-bold text-white">
                      Explicit Human Approval Gate
                    </h3>
                  </div>

                  <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-xl space-y-5">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                          <Lock size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">
                            Stage Action: Create Razorpay Payment Link
                          </h4>
                          <p className="text-xs text-slate-400">
                            Execution ID: <span className="font-mono text-slate-300">DEMO_EXEC_001</span>
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-md text-xs font-bold ${
                          approvalStatus === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : approvalStatus === 'REJECTED'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {approvalStatus === 'APPROVED'
                          ? 'STATUS: APPROVED'
                          : approvalStatus === 'REJECTED'
                          ? 'STATUS: REJECTED'
                          : 'STATUS: PENDING_APPROVAL'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-900 rounded-lg">
                        <span className="text-slate-500">Action:</span>
                        <div className="font-bold text-slate-200">PAYMENT_LINK</div>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-lg">
                        <span className="text-slate-500">Target Amount:</span>
                        <div className="font-bold text-emerald-400">₹38,938.00</div>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-lg">
                        <span className="text-slate-500">Guardrails:</span>
                        <div className="font-bold text-emerald-400">VERIFIED SAFE</div>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-lg">
                        <span className="text-slate-500">Gateway:</span>
                        <div className="font-bold text-indigo-400">RAZORPAY TEST</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleApprove}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition"
                      >
                        <Check size={15} />
                        <span>Approve Action & Proceed to Execute</span>
                      </button>
                      <button
                        onClick={handleReject}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition"
                      >
                        <X size={15} />
                        <span>Reject Action</span>
                      </button>
                    </div>

                    {approvalStatus === 'REJECTED' && (
                      <p className="text-xs text-rose-400 bg-rose-950/30 p-3 rounded-lg border border-rose-500/20">
                        Action has been rejected by operator. Safe execution is blocked and no API call will be dispatched.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* STAGE 4: EXECUTE */}
              {currentStageIndex === 3 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Stage 4 of 8 — Razorpay Sandbox Execution
                    </span>
                    <h3 className="text-xl font-bold text-white">
                      Dispatched Through Razorpay Sandbox Test Mode
                    </h3>
                  </div>

                  <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-xl space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={18} className="text-emerald-400" />
                        <span className="text-sm font-bold text-white">
                          Execution Confirmed
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-md">
                        EXECUTED (SANDBOX)
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Razorpay Payment Link ID:</span>
                        <span className="font-mono text-indigo-400 font-bold">plink_demo_test_rzp20pct</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Target Amount:</span>
                        <span className="font-bold text-slate-200">₹38,938.00 INR</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Short URL:</span>
                        <span className="font-mono text-cyan-400">https://rzp.io/i/demo20pct</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Mode Safety:</span>
                        <span className="font-bold text-emerald-400">TEST MODE ONLY (No live funds moved)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 5: OBSERVE */}
              {currentStageIndex === 4 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Stage 5 of 8 — Actual Financial Observation
                    </span>
                    <h3 className="text-xl font-bold text-white">
                      Observed Clearing Settlement vs Prediction
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-3">
                      <span className="text-xs font-bold text-indigo-400 uppercase">Predicted Settlement</span>
                      <div className="text-3xl font-extrabold text-white">₹38,938.00</div>
                      <p className="text-xs text-slate-400">
                        Predicted under 20% discount policy + 1.8% gateway fee schedule.
                      </p>
                    </div>

                    <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                      <span className="text-xs font-bold text-cyan-400 uppercase">Observed Actual Settlement</span>
                      <div className="text-3xl font-extrabold text-cyan-400">₹38,688.00</div>
                      <p className="text-xs text-slate-400">
                        Observed from Clearing Settlement Ledger #ORD_DEMO_9981.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 6: COMPARE */}
              {currentStageIndex === 5 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Stage 6 of 8 — Prediction vs Actual Delta Engine
                    </span>
                    <h3 className="text-xl font-bold text-white">
                      Mathematical Delta & Accuracy Score
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                      <span className="text-xs text-slate-400">Deviation Delta</span>
                      <div className="text-xl font-bold text-rose-400">-₹250.00</div>
                    </div>
                    <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                      <span className="text-xs text-slate-400">Deviation %</span>
                      <div className="text-xl font-bold text-slate-200">0.64%</div>
                    </div>
                    <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                      <span className="text-xs text-slate-400">Accuracy Score</span>
                      <div className="text-xl font-bold text-emerald-400">99.36%</div>
                    </div>
                    <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
                      <span className="text-xs text-slate-400">Severity Tier</span>
                      <div className="text-sm font-bold text-emerald-400">ON_TARGET</div>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 7: EXPLAIN */}
              {currentStageIndex === 6 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        Stage 7 of 8 — Grounded Root Cause & RAG Evidence Retrieval
                      </span>
                      <h3 className="text-xl font-bold text-white">
                        Zero-Hallucination Diagnostic with Policy Citations
                      </h3>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-md flex items-center gap-1">
                      <ShieldCheck size={13} />
                      <span>NUMERICAL TRUTH LOCKED</span>
                    </span>
                  </div>

                  <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-xl space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Authoritative Root Cause</span>
                        <h4 className="text-base font-bold text-amber-300">
                          FEE_SCHEDULE_DISCREPANCY
                        </h4>
                      </div>
                      <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-md">
                        Confidence: 98.5% (High)
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Deterministic Financial Grounding:</span>
                        <p className="text-slate-200 mt-1 bg-slate-900/60 p-3 rounded-lg border border-slate-800/60 leading-relaxed font-mono">
                          Predicted settlement of ₹38,938.00 vs observed clearing of ₹38,688.00 | Variance: ₹250.00 (0.64% deviation).
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">RAG-Retrieved Policy Evidence & Citations:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-1.5">
                          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                              <span>Gateway Fee & Interchange Schedule (v4)</span>
                              <span className="text-[9px] px-1.5 py-0.2 bg-indigo-950 text-indigo-400 border border-indigo-500/30 rounded">95% match</span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2">
                              Interchange fee tier variance applies when premium corporate debit cards incur tier interchange different from standard domestic 1.8% pricing.
                            </p>
                          </div>

                          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-lg space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                              <span>Commercial Discount Policy (v3)</span>
                              <span className="text-[9px] px-1.5 py-0.2 bg-indigo-950 text-indigo-400 border border-indigo-500/30 rounded">88% match</span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2">
                              Authorizes 20% commercial discount on ₹50,000 gross. Platform retains ₹7,500 additional margin.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-1">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Recommended Investigation:</span>
                        <p className="text-slate-300 mt-1">
                          Review card interchange rate agreement for corporate cards. No fund clawback necessary.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 8: LEARN */}
              {currentStageIndex === 7 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                      Stage 8 of 8 — Closed-Loop Historical Feedback & RAG Knowledge Evolution
                    </span>
                    <h3 className="text-xl font-bold text-white">
                      Continuous Intelligence from Stored Precedents
                    </h3>
                  </div>

                  <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
                      <History size={16} />
                      <span>RAG-POWERED CLOSED-LOOP INTELLIGENCE</span>
                    </div>

                    <p className="text-sm font-semibold text-slate-200">
                      &ldquo;The system does not stop at prediction. It retrieves stored knowledge and learns from what actually happened.&rdquo;
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                      <div className="p-3 bg-slate-900 rounded-lg">
                        <span className="text-slate-500">Historical Precedents:</span>
                        <div className="font-bold text-slate-200">4 Matching Cases</div>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-lg">
                        <span className="text-slate-500">Average Historical Variance:</span>
                        <div className="font-bold text-emerald-400">0.82% Average</div>
                      </div>
                      <div className="p-3 bg-slate-900 rounded-lg">
                        <span className="text-slate-500">Policy Adherence:</span>
                        <div className="font-bold text-indigo-400">96.4% Compliance</div>
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 space-y-1">
                      <span className="font-bold">Next-Cycle Intelligence Guidance:</span>
                      <p>
                        High commercial discounts (&gt;15%) should trigger an automated merchant cash-flow warning before promotion activation.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Stepper Footer Controls */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/70">
              <button
                onClick={() => setCurrentStageIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentStageIndex === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-bold rounded-xl transition"
              >
                <ArrowLeft size={14} />
                <span>Previous Stage</span>
              </button>

              <div className="flex items-center gap-1.5">
                {stages.map((_, i) => (
                  <span
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      currentStageIndex === i
                        ? 'bg-indigo-400 w-6'
                        : i < currentStageIndex
                        ? 'bg-emerald-400'
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              {currentStageIndex < stages.length - 1 ? (
                <button
                  onClick={() => setCurrentStageIndex((prev) => Math.min(stages.length - 1, prev + 1))}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/25 transition"
                >
                  <span>Next Stage</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/25 transition"
                >
                  <RotateCcw size={14} />
                  <span>Restart Demo</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
