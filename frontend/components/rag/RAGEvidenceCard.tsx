'use client'

import React, { useState } from 'react'
import type { RAGExplanation, RAGSourceCitation } from '@/types'
import {
  Sparkles,
  ShieldCheck,
  FileText,
  History,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
} from 'lucide-react'
import { getRAGSource } from '@/lib/api'

interface RAGEvidenceCardProps {
  explanation: RAGExplanation
  className?: string
}

export function RAGEvidenceCard({ explanation, className = '' }: RAGEvidenceCardProps) {
  const [selectedSource, setSelectedSource] = useState<RAGSourceCitation | null>(null)
  const [sourceDetail, setSourceDetail] = useState<any>(null)
  const [loadingSource, setLoadingSource] = useState(false)

  const handleOpenSource = async (citation: RAGSourceCitation) => {
    setSelectedSource(citation)
    setLoadingSource(true)
    try {
      const res = await getRAGSource(citation.chunk_id)
      setSourceDetail(res.source)
    } catch (err) {
      setSourceDetail({
        title: citation.title,
        source_type: citation.source_type,
        chunk_text: citation.snippet,
        metadata: { category: citation.source_type },
      })
    } finally {
      setLoadingSource(false)
    }
  }

  const numTruth = explanation.numerical_source_of_truth

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Grounded Analysis Card */}
      <div className="p-6 bg-slate-950/80 border border-slate-800 rounded-xl space-y-4 shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
              <Sparkles size={16} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Supporting Information & Analysis
              </span>
              <h4 className="text-sm font-bold text-white">
                {explanation.likely_cause.replace(/_/g, ' ')}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 text-xs font-bold rounded-md border ${
                explanation.confidence === 'High'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : explanation.confidence === 'Medium'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              Confidence: {explanation.confidence}
            </span>
          </div>
        </div>

        {/* Locked Numerical Source of Truth */}
        {numTruth && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-500 uppercase">Estimated Money</span>
              <div className="font-mono font-bold text-slate-200">
                ₹{numTruth.predicted_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-500 uppercase">Actual Money Received</span>
              <div className="font-mono font-bold text-slate-200">
                ₹{numTruth.actual_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-500 uppercase">Difference</span>
              <div
                className={`font-mono font-bold ${
                  numTruth.deviation_amount === 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ₹{numTruth.deviation_amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-500 uppercase">Accuracy Rating</span>
              <div className="font-mono font-bold text-emerald-400">
                {numTruth.accuracy_score}%
              </div>
            </div>
          </div>
        )}

        {/* Narrative */}
        <div className="space-y-2 text-xs">
          <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            Why This Happened & What We Found:
          </div>
          <p className="text-slate-200 leading-relaxed bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/60">
            {explanation.grounded_explanation}
          </p>
        </div>

        {/* Supporting Evidence Sources & Citations */}
        {explanation.retrieved_evidence && explanation.retrieved_evidence.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <BookOpen size={13} className="text-indigo-400" />
              <span>Supporting Information ({explanation.retrieved_evidence.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {explanation.retrieved_evidence.map((cit) => (
                <div
                  key={cit.chunk_id}
                  className="p-3 bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-lg flex flex-col justify-between space-y-2 transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-white truncate">{cit.title}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30">
                        {Math.round(cit.relevance_score * 100)}% match
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{cit.snippet}</p>
                  </div>

                  <button
                    onClick={() => handleOpenSource(cit)}
                    className="self-start flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition"
                  >
                    <ExternalLink size={11} />
                    <span>View Stored Source</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Investigation */}
        {explanation.recommended_investigation && (
          <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-lg text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-[10px] uppercase">
              <ShieldCheck size={13} />
              <span>Recommended Operator Investigation:</span>
            </div>
            <p className="text-slate-300">{explanation.recommended_investigation}</p>
          </div>
        )}
      </div>

      {/* Source Viewer Modal */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-white">{selectedSource.title}</h3>
              </div>
              <button
                onClick={() => setSelectedSource(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <span>Source Type:</span>
                <span className="font-bold text-slate-200">{selectedSource.source_type}</span>
                <span className="text-slate-600">•</span>
                <span>Chunk ID:</span>
                <span className="font-mono text-indigo-400">{selectedSource.chunk_id}</span>
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-slate-300 font-mono text-xs max-h-60 overflow-y-auto whitespace-pre-wrap">
                {loadingSource
                  ? 'Loading stored document...'
                  : sourceDetail?.chunk_text || selectedSource.snippet}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedSource(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition"
              >
                Close Source View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
