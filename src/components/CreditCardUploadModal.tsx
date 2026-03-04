import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, CheckCircle, AlertCircle, ChevronRight,
  Building2, Calendar, Hash, Plus, ChevronDown,
} from 'lucide-react'
import { CreditCardAccount, ParsedCreditCardStatement } from '../types'
import { useFinance } from '../context/FinanceContext'
import { parseCreditCardStatement } from '../utils/pdfParser'
import { formatCurrencyFull, currentISODate } from '../utils/formatters'

interface CreditCardUploadModalProps {
  /** Pre-selected credit card account. Omit to allow user to pick/create. */
  account?: CreditCardAccount
  onClose: () => void
}

type Step = 'pick' | 'parsing' | 'review' | 'error'

function findMatchingAccount(
  accounts: CreditCardAccount[],
  parsed: ParsedCreditCardStatement,
): CreditCardAccount | null {
  if (!parsed.institutionId) return null
  if (parsed.accountNumber) {
    const byNum = accounts.find((a) => a.accountNumber === parsed.accountNumber)
    if (byNum) return byNum
  }
  return accounts.find((a) => a.institutionId === parsed.institutionId) ?? null
}

function defaultAccountName(parsed: ParsedCreditCardStatement): string {
  const inst = parsed.institution ?? 'Unknown'
  if (parsed.accountNumber) {
    const last4 = parsed.accountNumber.replace(/\s/g, '').slice(-4)
    return `${inst} ••••${last4}`
  }
  return `${inst} Credit Card`
}

export default function CreditCardUploadModal({
  account: preselectedAccount,
  onClose,
}: CreditCardUploadModalProps) {
  const { data, addCreditCardEntry, addCreditCardAccountWithEntry } = useFinance()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('pick')
  const [filename, setFilename] = useState('')
  const [parsed, setParsed] = useState<ParsedCreditCardStatement | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const [manualBalance, setManualBalance] = useState('')
  const [statementEndDate, setStatementEndDate] = useState(currentISODate())
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'new' | null>(null)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountInstitution, setNewAccountInstitution] = useState('')
  const [showAllCandidates, setShowAllCandidates] = useState(false)

  const processFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setErrorMsg('Please select a PDF file.')
        setStep('error')
        return
      }
      setFilename(file.name)
      setStep('parsing')
      try {
        const result = await parseCreditCardStatement(file)
        setParsed(result)
        setManualBalance(result.balance !== null ? String(result.balance) : '')
        setStatementEndDate(result.statementEndDate ?? currentISODate())

        if (preselectedAccount) {
          setSelectedAccountId(preselectedAccount.id)
        } else {
          const match = findMatchingAccount(data.creditCardAccounts, result)
          if (match) {
            setSelectedAccountId(match.id)
          } else {
            setSelectedAccountId('new')
            setNewAccountName(defaultAccountName(result))
            setNewAccountInstitution(result.institution ?? '')
          }
        }
        setStep('review')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to parse PDF')
        setStep('error')
      }
    },
    [data.creditCardAccounts, preselectedAccount],
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleConfirm = () => {
    const balance = parseFloat(manualBalance.replace(/,/g, ''))
    if (isNaN(balance) || balance < 0 || !statementEndDate) return

    const entryData = { statementEndDate, balance, sourceFilename: filename }

    if (preselectedAccount) {
      addCreditCardEntry(preselectedAccount.id, entryData)
    } else if (selectedAccountId === 'new') {
      addCreditCardAccountWithEntry(
        {
          name: newAccountName.trim(),
          institution: newAccountInstitution.trim(),
          institutionId: parsed?.institutionId ?? undefined,
          accountNumber: parsed?.accountNumber ?? undefined,
        },
        entryData,
      )
    } else if (selectedAccountId) {
      addCreditCardEntry(selectedAccountId, entryData)
    } else {
      return
    }
    onClose()
  }

  const effectiveBalance = parseFloat(manualBalance.replace(/,/g, ''))
  const newAccountValid = !!(newAccountName.trim() && newAccountInstitution.trim())
  const accountValid = preselectedAccount
    ? true
    : selectedAccountId === 'new'
    ? newAccountValid
    : !!selectedAccountId
  const canConfirm =
    !isNaN(effectiveBalance) && effectiveBalance >= 0 && statementEndDate.length === 10 && accountValid

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#12151f] border border-[#1e2235] rounded-2xl shadow-2xl w-full max-w-lg max-h-[85svh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e2235] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">Upload Credit Card Statement</h2>
            {preselectedAccount && (
              <p className="text-xs text-gray-500 mt-0.5">{preselectedAccount.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1e2235]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">

          {/* Pick */}
          {step === 'pick' && (
            <div className="p-4 md:p-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 md:p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                  isDragging
                    ? 'border-app-accent bg-app-accent-dim'
                    : 'border-[#1e2235] hover:border-[#2a3050] hover:bg-[#1a1e2e]'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#1a1e2e] flex items-center justify-center">
                  <Upload size={20} className="text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">Drop PDF here or click to browse</p>
                  <p className="text-xs text-gray-500 mt-1">Credit card statement</p>
                </div>
              </div>
            </div>
          )}

          {/* Parsing */}
          {step === 'parsing' && (
            <div className="p-6 flex flex-col items-center gap-4 py-14">
              <div className="w-10 h-10 border-2 border-app-accent border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">Reading statement…</p>
                <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">{filename}</p>
              </div>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Could not read PDF</p>
                  <p className="text-xs text-red-400/70 mt-0.5">{errorMsg}</p>
                </div>
              </div>
              <button
                onClick={() => setStep('pick')}
                className="w-full px-4 py-2.5 rounded-xl border border-[#1e2235] text-sm text-gray-400 hover:text-white transition-all"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Review */}
          {step === 'review' && parsed && (
            <div className="p-4 md:p-6 space-y-5">

              {/* Institution badge */}
              {parsed.institutionConfidence === 'high' && parsed.institution && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">{parsed.institution}</span>
                    <CheckCircle size={11} className="text-emerald-400" />
                  </div>
                  <span className="text-xs text-gray-400">Credit Card</span>
                </div>
              )}

              {/* Statement end date + account number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                    <Calendar size={11} /> Statement End Date
                  </label>
                  <input
                    type="date"
                    value={statementEndDate}
                    onChange={(e) => setStatementEndDate(e.target.value)}
                    className="w-full bg-[#0a0d14] border border-[#1e2235] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-app-accent transition-colors"
                  />
                </div>
                {parsed.accountNumber && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                      <Hash size={11} /> Card Number
                    </label>
                    <div className="w-full bg-[#0a0d14] border border-[#1e2235] rounded-xl px-3 py-2 text-sm text-gray-400 font-mono truncate">
                      {parsed.accountNumber}
                    </div>
                  </div>
                )}
              </div>

              {/* Balance */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Balance / Amount Due
                </label>
                <div className="relative mb-3">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    value={manualBalance}
                    onChange={(e) => setManualBalance(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full bg-[#0a0d14] border border-[#1e2235] rounded-xl pl-7 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-app-accent transition-colors font-mono"
                  />
                </div>

                {/* Context quote */}
                {parsed.balanceContext && (() => {
                  const valStr = parsed.balance !== null
                    ? parsed.balance.toLocaleString('en-CA', { minimumFractionDigits: 2 })
                    : null
                  const idx = valStr ? parsed.balanceContext.indexOf(valStr) : -1
                  return (
                    <div className="bg-[#0a0d14] border border-[#1e2235] rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1.5">
                        Source — from statement
                      </p>
                      <p className="text-xs text-gray-400 leading-relaxed font-mono break-words">
                        {idx === -1 ? (
                          parsed.balanceContext
                        ) : (
                          <>
                            {parsed.balanceContext.slice(0, idx)}
                            <span className="bg-app-accent/20 text-app-accent rounded px-0.5">
                              ${valStr}
                            </span>
                            {parsed.balanceContext.slice(idx + valStr!.length)}
                          </>
                        )}
                      </p>
                    </div>
                  )
                })()}

                {/* Other candidates */}
                {parsed.candidates.length > 1 && (
                  <button
                    onClick={() => setShowAllCandidates((s) => !s)}
                    className="flex items-center gap-1 mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${showAllCandidates ? 'rotate-180' : ''}`}
                    />
                    {showAllCandidates ? 'Hide' : 'Show'} other detected values
                  </button>
                )}
                {showAllCandidates && (
                  <div className="mt-2 space-y-1.5">
                    {parsed.candidates
                      .filter((c) => c.value !== parsed.balance)
                      .map((c, i) => (
                        <button
                          key={i}
                          onClick={() => setManualBalance(String(c.value))}
                          className="w-full text-left p-2.5 rounded-xl border border-[#1e2235] hover:border-[#2a3050] hover:bg-[#1a1e2e] transition-all"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold font-mono text-white">
                              {formatCurrencyFull(c.value)}
                            </span>
                            <span className="text-[10px] text-gray-600">tap to use</span>
                          </div>
                          <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 font-mono">
                            {c.context}
                          </p>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Account picker (global upload only) */}
              {!preselectedAccount && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
                    <Building2 size={11} /> Add to Card
                  </label>
                  <div className="space-y-1.5">
                    {data.creditCardAccounts.map((acc) => {
                      const isSelected = selectedAccountId === acc.id
                      return (
                        <button
                          key={acc.id}
                          onClick={() => setSelectedAccountId(acc.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-app-accent bg-app-accent-dim'
                              : 'border-[#1e2235] hover:border-[#2a3050] hover:bg-[#1a1e2e]'
                          }`}
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: acc.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}
                            >
                              {acc.name}
                            </p>
                            <p className="text-[10px] text-gray-600">{acc.institution}</p>
                          </div>
                          {isSelected && <CheckCircle size={14} className="text-app-accent shrink-0" />}
                        </button>
                      )
                    })}

                    <button
                      onClick={() => setSelectedAccountId('new')}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        selectedAccountId === 'new'
                          ? 'border-app-accent bg-app-accent-dim'
                          : 'border-dashed border-[#1e2235] hover:border-[#2a3050] hover:bg-[#1a1e2e]'
                      }`}
                    >
                      <Plus
                        size={14}
                        className={selectedAccountId === 'new' ? 'text-app-accent' : 'text-gray-500'}
                      />
                      <span
                        className={`text-sm font-medium ${selectedAccountId === 'new' ? 'text-app-accent' : 'text-gray-400'}`}
                      >
                        Add new card
                      </span>
                    </button>
                  </div>

                  {selectedAccountId === 'new' && (
                    <div className="mt-3 space-y-3 p-4 bg-[#0a0d14] border border-[#1e2235] rounded-xl">
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1.5">
                          Card Name
                        </label>
                        <input
                          type="text"
                          value={newAccountName}
                          onChange={(e) => setNewAccountName(e.target.value)}
                          placeholder="e.g. Rogers Mastercard ••••2616"
                          className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-app-accent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1.5">
                          Institution
                        </label>
                        <input
                          type="text"
                          value={newAccountInstitution}
                          onChange={(e) => setNewAccountInstitution(e.target.value)}
                          placeholder="e.g. Rogers Bank"
                          className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-app-accent transition-colors"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {step === 'review' && (
          <div className="px-6 py-4 border-t border-[#1e2235] shrink-0">
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-app-accent text-[#0a0d14] text-sm font-semibold hover:bg-app-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {selectedAccountId === 'new' ? 'Add Card & Save Statement' : 'Save Statement'}
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
