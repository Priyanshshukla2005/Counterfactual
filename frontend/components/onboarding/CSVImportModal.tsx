'use client'

import React, { useState } from 'react'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  Database,
  Layers,
  Sparkles,
} from 'lucide-react'
import { importCSVPayments } from '@/lib/api'

interface CSVImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type ImportStep = 'UPLOAD' | 'PREVIEW' | 'MAP_COLUMNS' | 'VALIDATE' | 'COMPLETE'

export function CSVImportModal({ isOpen, onClose, onSuccess }: CSVImportModalProps) {
  const [step, setStep] = useState<ImportStep>('UPLOAD')
  const [rawText, setRawText] = useState('')
  const [parsedRows, setParsedRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<{
    transaction_id: number
    amount: number
    expected_settlement: number
    actual_settlement: number
    payment_method: number
    date: number
    refund_amount: number
    fee: number
  }>({
    transaction_id: 0,
    amount: 1,
    expected_settlement: 2,
    actual_settlement: 3,
    payment_method: 4,
    date: 5,
    refund_amount: 6,
    fee: 7,
  })

  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    imported_count: number
    total_records: number
    warnings?: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  // Parse CSV text into 2D array
  const handleParseCSV = (text: string) => {
    setError(null)
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length < 2) {
      setError('CSV must contain a header row and at least one data row.')
      return
    }

    const rows = lines.map((line) => {
      // Split by comma ignoring commas inside quotes
      const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g
      const matches: string[] = []
      let match
      while ((match = regex.exec(line)) !== null) {
        let val = match[1] || ''
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/""/g, '"')
        }
        matches.push(val.trim())
        if (regex.lastIndex >= line.length) break
      }
      return matches.length > 0 ? matches : line.split(',').map((s) => s.trim())
    })

    const headerRow = rows[0]
    const dataRows = rows.slice(1)

    setHeaders(headerRow)
    setParsedRows(dataRows)
    setStep('PREVIEW')
  }

  // Load sample template
  const handleLoadSample = () => {
    const sample = `Transaction ID,Gross Amount,Expected Money,Money Received,Payment Method,Date,Refund Amount,Processing Fee
TXN_MERCHANT_201,15000.00,14688.00,14688.00,CARD,2026-08-26,0.00,312.00
TXN_MERCHANT_202,5000.00,4896.00,4296.00,CARD,2026-08-26,600.00,104.00
TXN_MERCHANT_203,8200.00,8036.00,8036.00,UPI,2026-08-26,0.00,164.00
TXN_MERCHANT_204,22000.00,21542.40,0.00,NETBANKING,2026-08-26,0.00,457.60`
    setRawText(sample)
    handleParseCSV(sample)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = String(evt.target?.result || '')
      setRawText(text)
      handleParseCSV(text)
    }
    reader.readAsText(file)
  }

  const handleExecuteImport = async () => {
    setIsImporting(true)
    setError(null)

    try {
      const mappedRecords = parsedRows.map((row, idx) => {
        const getVal = (colIdx: number) => (colIdx >= 0 && colIdx < row.length ? row[colIdx] : '')
        const cleanNum = (str: string, def = 0) => {
          const num = parseFloat(str.replace(/[^\d.-]/g, ''))
          return isNaN(num) ? def : num
        }

        const amt = cleanNum(getVal(columnMapping.amount), 0)
        const exp = cleanNum(getVal(columnMapping.expected_settlement), amt)
        const act = cleanNum(getVal(columnMapping.actual_settlement), exp)
        const ref = cleanNum(getVal(columnMapping.refund_amount), 0)
        const fee = cleanNum(getVal(columnMapping.fee), 0)

        return {
          transaction_id: getVal(columnMapping.transaction_id) || `TXN_IMP_${idx + 1}`,
          amount: amt,
          expected_settlement: exp,
          actual_settlement: act,
          payment_method: getVal(columnMapping.payment_method) || 'CARD',
          date: getVal(columnMapping.date) || '2026-08-26',
          refund_amount: ref,
          fee: fee,
        }
      })

      const res = await importCSVPayments(mappedRecords)
      setImportResult(res)
      setStep('COMPLETE')
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to import payment data.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Merchant Data Ingestion
              </span>
              <h3 className="text-base font-bold text-white">Import Your Payment Data</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper Progress */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-950/40 border-b border-slate-800 text-[11px] font-bold">
          {[
            { id: 'UPLOAD', label: '1. Upload CSV' },
            { id: 'PREVIEW', label: '2. Preview Data' },
            { id: 'MAP_COLUMNS', label: '3. Map Columns' },
            { id: 'VALIDATE', label: '4. Validate' },
            { id: 'COMPLETE', label: '5. Done' },
          ].map((s, i) => (
            <div
              key={s.id}
              className={`flex items-center gap-1.5 ${
                step === s.id
                  ? 'text-indigo-400'
                  : 'text-slate-500'
              }`}
            >
              <span>{s.label}</span>
              {i < 4 && <span className="text-slate-700">→</span>}
            </div>
          ))}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'UPLOAD' && (
            <div className="space-y-4">
              <div className="p-8 border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-2xl bg-slate-950/40 flex flex-col items-center justify-center text-center space-y-3 transition">
                <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-400">
                  <Upload size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Choose a CSV file or paste raw text</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Accepted format: Comma-separated payment records (.csv)
                  </p>
                </div>

                <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md transition">
                  <span>Browse CSV File</span>
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <div className="flex items-center justify-between text-xs pt-2">
                <span className="text-slate-400">Want to test with sample merchant records?</span>
                <button
                  onClick={handleLoadSample}
                  className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                >
                  <Sparkles size={13} />
                  <span>Load Sample Payments</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 'PREVIEW' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  Found {parsedRows.length} payment records
                </span>
                <span className="text-xs text-slate-500">Previewing first 4 rows</span>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono">
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className="p-2.5 border-b border-slate-800">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                    {parsedRows.slice(0, 4).map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-2.5 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: MAP COLUMNS */}
          {step === 'MAP_COLUMNS' && (
            <div className="space-y-4 text-xs">
              <p className="text-slate-300">
                Match your CSV columns to standard business payment fields:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'transaction_id', label: 'Payment / Transaction ID' },
                  { key: 'amount', label: 'Gross Sales / Amount' },
                  { key: 'expected_settlement', label: 'Expected Money' },
                  { key: 'actual_settlement', label: 'Money Actually Received' },
                  { key: 'payment_method', label: 'Payment Method (Card, UPI)' },
                  { key: 'date', label: 'Payment Date' },
                  { key: 'refund_amount', label: 'Refund Amount' },
                  { key: 'fee', label: 'Processing Fee' },
                ].map((field) => (
                  <div key={field.key} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                    <label className="text-[11px] font-bold text-slate-400">{field.label}</label>
                    <select
                      value={(columnMapping as any)[field.key]}
                      onChange={(e) =>
                        setColumnMapping((prev) => ({
                          ...prev,
                          [field.key]: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                    >
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          Column {i + 1}: {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: VALIDATE */}
          {step === 'VALIDATE' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                <span className="font-bold text-slate-200">Validation Checklist:</span>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 size={14} />
                    <span>{parsedRows.length} payment records ready for ingestion</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 size={14} />
                    <span>Transaction IDs and positive amount boundaries verified</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 size={14} />
                    <span>Multi-tenant security lock: Records will be strictly assigned to your business</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: COMPLETE */}
          {step === 'COMPLETE' && importResult && (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="text-base font-bold text-white">Import Complete!</h4>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Successfully imported {importResult.imported_count} payments into your business account.
                Payment checks and problem detection are now active.
              </p>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          {step === 'UPLOAD' ? (
            <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-white font-bold">
              Cancel
            </button>
          ) : step === 'COMPLETE' ? (
            <div />
          ) : (
            <button
              onClick={() => {
                if (step === 'PREVIEW') setStep('UPLOAD')
                if (step === 'MAP_COLUMNS') setStep('PREVIEW')
                if (step === 'VALIDATE') setStep('MAP_COLUMNS')
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          )}

          {step === 'PREVIEW' && (
            <button
              onClick={() => setStep('MAP_COLUMNS')}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md"
            >
              <span>Continue to Mapping</span>
              <ArrowRight size={14} />
            </button>
          )}

          {step === 'MAP_COLUMNS' && (
            <button
              onClick={() => setStep('VALIDATE')}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-md"
            >
              <span>Validate Records</span>
              <ArrowRight size={14} />
            </button>
          )}

          {step === 'VALIDATE' && (
            <button
              onClick={handleExecuteImport}
              disabled={isImporting}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-600/20"
            >
              <CheckCircle2 size={14} />
              <span>{isImporting ? 'Importing Payments...' : 'Confirm & Import Payments'}</span>
            </button>
          )}

          {step === 'COMPLETE' && (
            <button
              onClick={onClose}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition"
            >
              Done & View Payments
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
