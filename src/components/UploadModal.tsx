import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, CheckCircle, AlertCircle, ChevronRight,
  Building2, Calendar, Hash, Plus, ChevronDown,
} from 'lucide-react'
import { Account, AccountType, ParsedStatement, ParsedCreditCardStatement, CreditCardAccount } from '../types'
import { useFinance } from '../context/FinanceContext'
import { parseAuto, AutoParseResult } from '../utils/pdfParser'
import { formatCurrencyFull, currentYearMonth, currentISODate } from '../utils/formatters'

const ACCOUNT_TYPES: AccountType[] = [
  'TFSA', 'FHSA', 'RRSP', 'RRIF', 'Non-Registered', 'Pension', 'Cash', 'Other',
]

interface UploadModalProps {
  /** Pre-selected savings account. Omit to allow user to pick/create in the review step. */
  account?: Account
  onClose: () => void
}

type Step = 'pick' | 'parsing' | 'bulk-parsing' | 'review' | 'error'

type QueueItem = {
  file: File
  result: AutoParseResult
}

type QueueErrorItem = {
  file: File
  error: string
}

function findMatchingAccount(accounts: Account[], parsed: ParsedStatement): Account | null {
  if (!parsed.institutionId) return null
  if (parsed.accountNumber) {
    const byNum = accounts.find((a) => a.accountNumber === parsed.accountNumber)
    if (byNum) return byNum
  }
  return accounts.find(
    (a) => a.institutionId === parsed.institutionId && a.type === parsed.accountType,
  ) ?? null
}

function findMatchingCCAccount(accounts: CreditCardAccount[], parsed: ParsedCreditCardStatement): CreditCardAccount | null {
  if (!parsed.institutionId) return null
  if (parsed.accountNumber) {
    const byNum = accounts.find((a) => a.accountNumber === parsed.accountNumber)
    if (byNum) return byNum
  }
  return accounts.find((a) => a.institutionId === parsed.institutionId) ?? null
}

function defaultAccountName(parsed: ParsedStatement): string {
  const inst = parsed.institution ?? 'Unknown'
  const label = parsed.accountTypeLabel ?? parsed.accountType ?? ''
  const shortLabel = label
    .replace(/Self-directed\s+/i, '')
    .replace(/\s+Account$/i, '')
    .trim()
  return shortLabel ? `${inst} ${shortLabel}` : inst
}

function defaultCCAccountName(parsed: ParsedCreditCardStatement): string {
  const inst = parsed.institution ?? 'Unknown'
  if (parsed.accountNumber) {
    const last4 = parsed.accountNumber.replace(/\s/g, '').slice(-4)
    return `${inst} ••••${last4}`
  }
  return `${inst} Credit Card`
}

export default function UploadModal({ account: preselectedAccount, onClose }: UploadModalProps) {
  const { data, addEntry, addAccountWithEntry, addCreditCardEntry, addCreditCardAccountWithEntry } = useFinance()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('pick')
  const [filename, setFilename] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [showAllCandidates, setShowAllCandidates] = useState(false)

  // Bulk queue state
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [queueErrors, setQueueErrors] = useState<QueueErrorItem[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [parsedCount, setParsedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Detected mode after parsing
  const [isCreditCard, setIsCreditCard] = useState(false)

  // Savings state
  const [parsed, setParsed] = useState<ParsedStatement | null>(null)
  const [manualValue, setManualValue] = useState('')
  const [yearMonth, setYearMonth] = useState(currentYearMonth())
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'new' | null>(null)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountType, setNewAccountType] = useState<AccountType>('TFSA')
  const [newAccountInstitution, setNewAccountInstitution] = useState('')

  // Credit card state
  const [ccParsed, setCCParsed] = useState<ParsedCreditCardStatement | null>(null)
  const [manualBalance, setManualBalance] = useState('')
  const [statementEndDate, setStatementEndDate] = useState(currentISODate())
  const [selectedCCAccountId, setSelectedCCAccountId] = useState<string | 'new' | null>(null)
  const [newCCAccountName, setNewCCAccountName] = useState('')
  const [newCCAccountInstitution, setNewCCAccountInstitution] = useState('')

  const loadResultIntoState = useCallback((result: AutoParseResult, file: File) => {
    setFilename(file.name)
    if (result.kind === 'credit') {
      const r = result.result
      setIsCreditCard(true)
      setCCParsed(r)
      setManualBalance(r.balance !== null ? String(r.balance) : '')
      setStatementEndDate(r.statementEndDate ?? currentISODate())

      const match = findMatchingCCAccount(data.creditCardAccounts, r)
      if (match) {
        setSelectedCCAccountId(match.id)
      } else {
        setSelectedCCAccountId('new')
        setNewCCAccountName(defaultCCAccountName(r))
        setNewCCAccountInstitution(r.institution ?? '')
      }
    } else {
      const r = result.result
      setIsCreditCard(false)
      setParsed(r)
      setManualValue(r.value !== null ? String(r.value) : '')
      setYearMonth(r.yearMonth ?? currentYearMonth())

      if (preselectedAccount) {
        setSelectedAccountId(preselectedAccount.id)
      } else {
        const match = findMatchingAccount(data.accounts, r)
        if (match) {
          setSelectedAccountId(match.id)
        } else {
          setSelectedAccountId('new')
          setNewAccountName(defaultAccountName(r))
          setNewAccountType(r.accountType ?? 'Other')
          setNewAccountInstitution(r.institution ?? '')
        }
      }
    }
  }, [data.accounts, data.creditCardAccounts, preselectedAccount])

  const processFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setErrorMsg('Please select a PDF file.')
      setStep('error')
      return
    }
    setFilename(file.name)
    setStep('parsing')
    try {
      const autoResult = await parseAuto(file)
      loadResultIntoState(autoResult, file)
      setStep('review')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse PDF')
      setStep('error')
    }
  }, [loadResultIntoState])

  const processFilesBulk = useCallback(async (files: File[]) => {
    const pdfs = Array.from(files).filter((f) => f.type === 'application/pdf')
    if (pdfs.length === 0) {
      setErrorMsg('Please select PDF files.')
      setStep('error')
      return
    }
    if (pdfs.length === 1) {
      processFile(pdfs[0])
      return
    }

    setTotalCount(pdfs.length)
    setParsedCount(0)
    setStep('bulk-parsing')

    const successes: QueueItem[] = []
    const errors: QueueErrorItem[] = []

    await Promise.all(pdfs.map(async (file) => {
      try {
        const result = await parseAuto(file)
        successes.push({ file, result })
      } catch (err) {
        errors.push({ file, error: err instanceof Error ? err.message : 'Failed to parse PDF' })
      }
      setParsedCount((c) => c + 1)
    }))

    // Sort successes to match original file order
    const orderedSuccesses = pdfs
      .map((f) => successes.find((s) => s.file === f))
      .filter((s): s is QueueItem => s !== undefined)

    setQueueErrors(errors)

    if (orderedSuccesses.length === 0) {
      setErrorMsg(`All ${pdfs.length} files failed to parse.`)
      setStep('error')
      return
    }

    setQueue(orderedSuccesses)
    setQueueIndex(0)
    loadResultIntoState(orderedSuccesses[0].result, orderedSuccesses[0].file)
    setShowAllCandidates(false)
    setStep('review')
  }, [processFile, loadResultIntoState])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (files.length === 1) {
      processFile(files[0])
    } else {
      processFilesBulk(Array.from(files))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return
    if (files.length === 1) {
      processFile(files[0])
    } else {
      processFilesBulk(Array.from(files))
    }
  }

  const isBulkMode = queue.length > 1
  const isLastItem = !isBulkMode || queueIndex >= queue.length - 1

  const advanceQueue = useCallback(() => {
    const next = queueIndex + 1
    if (next >= queue.length) {
      onClose()
    } else {
      setQueueIndex(next)
      loadResultIntoState(queue[next].result, queue[next].file)
      setShowAllCandidates(false)
    }
  }, [queueIndex, queue, onClose, loadResultIntoState])

  const handleConfirm = () => {
    if (isCreditCard) {
      const balance = parseFloat(manualBalance.replace(/,/g, ''))
      if (isNaN(balance) || balance < 0 || !statementEndDate) return
      const entryData = { statementEndDate, balance, sourceFilename: filename }
      if (selectedCCAccountId === 'new') {
        addCreditCardAccountWithEntry(
          {
            name: newCCAccountName.trim(),
            institution: newCCAccountInstitution.trim(),
            institutionId: ccParsed?.institutionId ?? undefined,
            accountNumber: ccParsed?.accountNumber ?? undefined,
          },
          entryData,
        )
      } else if (selectedCCAccountId) {
        addCreditCardEntry(selectedCCAccountId, entryData)
      } else {
        return
      }
    } else {
      const value = parseFloat(manualValue.replace(/,/g, ''))
      if (isNaN(value) || value <= 0 || !yearMonth) return
      const entryData = { yearMonth, value, sourceFilename: filename }
      if (preselectedAccount) {
        addEntry(preselectedAccount.id, entryData)
      } else if (selectedAccountId === 'new') {
        addAccountWithEntry(
          {
            name: newAccountName.trim(),
            type: newAccountType,
            institution: newAccountInstitution.trim(),
            institutionId: parsed?.institutionId ?? undefined,
            accountNumber: parsed?.accountNumber ?? undefined,
          },
          entryData,
        )
      } else if (selectedAccountId) {
        addEntry(selectedAccountId, entryData)
      } else {
        return
      }
    }

    if (isBulkMode) {
      advanceQueue()
    } else {
      onClose()
    }
  }

  const handleSkip = () => advanceQueue()

  const canConfirm = (() => {
    if (isCreditCard) {
      const balance = parseFloat(manualBalance.replace(/,/g, ''))
      const validBalance = !isNaN(balance) && balance >= 0
      const validDate = statementEndDate.length === 10
      const validAccount = selectedCCAccountId === 'new'
        ? !!(newCCAccountName.trim() && newCCAccountInstitution.trim())
        : !!selectedCCAccountId
      return validBalance && validDate && validAccount
    } else {
      const value = parseFloat(manualValue.replace(/,/g, ''))
      const validValue = !isNaN(value) && value > 0
      const validMonth = yearMonth.length === 7
      const validAccount = preselectedAccount
        ? true
        : selectedAccountId === 'new'
        ? !!(newAccountName.trim() && newAccountInstitution.trim())
        : !!selectedAccountId
      return validValue && validMonth && validAccount
    }
  })()

  const confirmLabel = (() => {
    if (isBulkMode) return isLastItem ? 'Save & Finish' : 'Save & Next'
    return isCreditCard
      ? selectedCCAccountId === 'new' ? 'Add Card & Save Statement' : 'Save Statement'
      : selectedAccountId === 'new' ? 'Create Account & Save Entry' : 'Save Entry'
  })()

  const activeParsed = isCreditCard ? ccParsed : parsed
  const activeValue = isCreditCard ? ccParsed?.balance : parsed?.value
  const activeContext = isCreditCard ? ccParsed?.balanceContext : parsed?.valueContext

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#12151f] border border-[#1e2235] rounded-2xl shadow-2xl w-full max-w-lg max-h-[85svh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e2235] shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">Upload Statement</h2>
            {isBulkMode && step === 'review' ? (
              <p className="text-xs text-gray-500 mt-0.5">
                {queueIndex + 1} of {queue.length}
                {queueErrors.length > 0 && ` · ${queueErrors.length} failed`}
              </p>
            ) : preselectedAccount ? (
              <p className="text-xs text-gray-500 mt-0.5">{preselectedAccount.name}</p>
            ) : null}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1e2235]">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">

          {/* Pick */}
          {step === 'pick' && (
            <div className="p-4 md:p-6">
              <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={handleFileChange} />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 md:p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                  isDragging ? 'border-app-accent bg-app-accent-dim' : 'border-[#1e2235] hover:border-[#2a3050] hover:bg-[#1a1e2e]'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-[#1a1e2e] flex items-center justify-center">
                  <Upload size={20} className="text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-white">Drop PDFs here or click to browse</p>
                  <p className="text-xs text-gray-500 mt-1">Select one or multiple statement files</p>
                </div>
              </div>
            </div>
          )}

          {/* Single-file parsing */}
          {step === 'parsing' && (
            <div className="p-6 flex flex-col items-center gap-4 py-14">
              <div className="w-10 h-10 border-2 border-app-accent border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">Reading statement…</p>
                <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">{filename}</p>
              </div>
            </div>
          )}

          {/* Bulk parsing */}
          {step === 'bulk-parsing' && (
            <div className="p-6 flex flex-col items-center gap-4 py-14">
              <div className="w-10 h-10 border-2 border-app-accent border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">Parsing statements…</p>
                <p className="text-xs text-gray-500 mt-1">{parsedCount} of {totalCount} done</p>
              </div>
              {/* Progress bar */}
              <div className="w-48 h-1 bg-[#1e2235] rounded-full overflow-hidden">
                <div
                  className="h-full bg-app-accent rounded-full transition-all duration-300"
                  style={{ width: totalCount > 0 ? `${(parsedCount / totalCount) * 100}%` : '0%' }}
                />
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
              <button onClick={() => setStep('pick')} className="w-full px-4 py-2.5 rounded-xl border border-[#1e2235] text-sm text-gray-400 hover:text-white transition-all">
                Try Again
              </button>
            </div>
          )}

          {/* Review */}
          {step === 'review' && activeParsed && (
            <div className="p-4 md:p-6 space-y-5">

              {/* Filename in bulk mode */}
              {isBulkMode && (
                <div className="flex items-center gap-2 p-3 bg-[#0a0d14] border border-[#1e2235] rounded-xl">
                  <Upload size={12} className="text-gray-500 shrink-0" />
                  <p className="text-xs text-gray-400 truncate font-mono">{filename}</p>
                </div>
              )}

              {/* Institution badge */}
              {activeParsed.institutionConfidence === 'high' && activeParsed.institution && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">{activeParsed.institution}</span>
                    <CheckCircle size={11} className="text-emerald-400" />
                  </div>
                  {isCreditCard ? (
                    <span className="text-xs text-gray-400">Credit Card</span>
                  ) : (
                    parsed?.accountTypeLabel && <span className="text-xs text-gray-400">{parsed.accountTypeLabel}</span>
                  )}
                </div>
              )}

              {/* Period / Date + account number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  {isCreditCard ? (
                    <>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Calendar size={11} /> Statement End Date
                      </label>
                      <input
                        type="date"
                        value={statementEndDate}
                        onChange={(e) => setStatementEndDate(e.target.value)}
                        className="w-full bg-[#0a0d14] border border-[#1e2235] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-app-accent transition-colors"
                      />
                    </>
                  ) : (
                    <>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                        <Calendar size={11} /> Statement Period
                      </label>
                      <input
                        type="month"
                        value={yearMonth}
                        onChange={(e) => setYearMonth(e.target.value)}
                        className="w-full bg-[#0a0d14] border border-[#1e2235] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-app-accent transition-colors"
                      />
                    </>
                  )}
                </div>
                {activeParsed.accountNumber && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
                      <Hash size={11} /> {isCreditCard ? 'Card Number' : 'Account No.'}
                    </label>
                    <div className="w-full bg-[#0a0d14] border border-[#1e2235] rounded-xl px-3 py-2 text-sm text-gray-400 font-mono truncate">
                      {activeParsed.accountNumber}
                    </div>
                  </div>
                )}
              </div>

              {/* Value / Balance */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  {isCreditCard ? 'Balance / Amount Due' : 'Account Value'}
                </label>
                <div className="relative mb-3">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    value={isCreditCard ? manualBalance : manualValue}
                    onChange={(e) => isCreditCard ? setManualBalance(e.target.value) : setManualValue(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full bg-[#0a0d14] border border-[#1e2235] rounded-xl pl-7 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-app-accent transition-colors font-mono"
                  />
                </div>

                {/* Context quote */}
                {activeContext && (() => {
                  const valStr = activeValue !== null && activeValue !== undefined
                    ? activeValue.toLocaleString('en-CA', { minimumFractionDigits: 2 })
                    : null
                  const idx = valStr ? activeContext.indexOf(valStr) : -1
                  return (
                    <div className="bg-[#0a0d14] border border-[#1e2235] rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide mb-1.5">
                        Source — from statement
                      </p>
                      <p className="text-xs text-gray-400 leading-relaxed font-mono break-words">
                        {idx === -1 ? (
                          activeContext
                        ) : (
                          <>
                            {activeContext.slice(0, idx)}
                            <span className="bg-app-accent/20 text-app-accent rounded px-0.5">
                              ${valStr}
                            </span>
                            {activeContext.slice(idx + valStr!.length)}
                          </>
                        )}
                      </p>
                    </div>
                  )
                })()}

                {/* Other candidates */}
                {activeParsed.candidates.length > 1 && (
                  <button
                    onClick={() => setShowAllCandidates((s) => !s)}
                    className="flex items-center gap-1 mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <ChevronDown size={12} className={`transition-transform ${showAllCandidates ? 'rotate-180' : ''}`} />
                    {showAllCandidates ? 'Hide' : 'Show'} other detected values
                  </button>
                )}
                {showAllCandidates && (
                  <div className="mt-2 space-y-1.5">
                    {activeParsed.candidates.filter((c) => c.value !== activeValue).map((c, i) => (
                      <button
                        key={i}
                        onClick={() => isCreditCard ? setManualBalance(String(c.value)) : setManualValue(String(c.value))}
                        className="w-full text-left p-2.5 rounded-xl border border-[#1e2235] hover:border-[#2a3050] hover:bg-[#1a1e2e] transition-all"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-bold font-mono text-white">{formatCurrencyFull(c.value)}</span>
                          <span className="text-[10px] text-gray-600">tap to use</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 font-mono">{c.context}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Account picker */}
              {isCreditCard ? (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
                    <Building2 size={11} /> Add to Card
                  </label>
                  <div className="space-y-1.5">
                    {data.creditCardAccounts.map((acc) => {
                      const isSelected = selectedCCAccountId === acc.id
                      return (
                        <button
                          key={acc.id}
                          onClick={() => setSelectedCCAccountId(acc.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            isSelected ? 'border-app-accent bg-app-accent-dim' : 'border-[#1e2235] hover:border-[#2a3050] hover:bg-[#1a1e2e]'
                          }`}
                        >
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: acc.color }} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>{acc.name}</p>
                            <p className="text-[10px] text-gray-600">{acc.institution}</p>
                          </div>
                          {isSelected && <CheckCircle size={14} className="text-app-accent shrink-0" />}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setSelectedCCAccountId('new')}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        selectedCCAccountId === 'new' ? 'border-app-accent bg-app-accent-dim' : 'border-dashed border-[#1e2235] hover:border-[#2a3050] hover:bg-[#1a1e2e]'
                      }`}
                    >
                      <Plus size={14} className={selectedCCAccountId === 'new' ? 'text-app-accent' : 'text-gray-500'} />
                      <span className={`text-sm font-medium ${selectedCCAccountId === 'new' ? 'text-app-accent' : 'text-gray-400'}`}>
                        Add new card
                      </span>
                    </button>
                  </div>
                  {selectedCCAccountId === 'new' && (
                    <div className="mt-3 space-y-3 p-4 bg-[#0a0d14] border border-[#1e2235] rounded-xl">
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Card Name</label>
                        <input
                          type="text"
                          value={newCCAccountName}
                          onChange={(e) => setNewCCAccountName(e.target.value)}
                          placeholder="e.g. Rogers Mastercard ••••2616"
                          className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-app-accent transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Institution</label>
                        <input
                          type="text"
                          value={newCCAccountInstitution}
                          onChange={(e) => setNewCCAccountInstitution(e.target.value)}
                          placeholder="e.g. Rogers Bank"
                          className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-app-accent transition-colors"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                !preselectedAccount && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
                      <Building2 size={11} /> Add to Account
                    </label>
                    <div className="space-y-1.5">
                      {data.accounts.map((acc) => {
                        const isSelected = selectedAccountId === acc.id
                        return (
                          <button
                            key={acc.id}
                            onClick={() => setSelectedAccountId(acc.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                              isSelected ? 'border-app-accent bg-app-accent-dim' : 'border-[#1e2235] hover:border-[#2a3050] hover:bg-[#1a1e2e]'
                            }`}
                          >
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: acc.color }} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>{acc.name}</p>
                              <p className="text-[10px] text-gray-600">{acc.type} · {acc.institution}</p>
                            </div>
                            {isSelected && <CheckCircle size={14} className="text-app-accent shrink-0" />}
                          </button>
                        )
                      })}
                      <button
                        onClick={() => setSelectedAccountId('new')}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                          selectedAccountId === 'new' ? 'border-app-accent bg-app-accent-dim' : 'border-dashed border-[#1e2235] hover:border-[#2a3050] hover:bg-[#1a1e2e]'
                        }`}
                      >
                        <Plus size={14} className={selectedAccountId === 'new' ? 'text-app-accent' : 'text-gray-500'} />
                        <span className={`text-sm font-medium ${selectedAccountId === 'new' ? 'text-app-accent' : 'text-gray-400'}`}>
                          Create new account
                        </span>
                      </button>
                    </div>
                    {selectedAccountId === 'new' && (
                      <div className="mt-3 space-y-3 p-4 bg-[#0a0d14] border border-[#1e2235] rounded-xl">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Account Name</label>
                          <input
                            type="text"
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                            placeholder="e.g. Wealthsimple TFSA"
                            className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-app-accent transition-colors"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Type</label>
                            <select
                              value={newAccountType}
                              onChange={(e) => setNewAccountType(e.target.value as AccountType)}
                              className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-app-accent transition-colors appearance-none"
                            >
                              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Institution</label>
                            <input
                              type="text"
                              value={newAccountInstitution}
                              onChange={(e) => setNewAccountInstitution(e.target.value)}
                              placeholder="e.g. Wealthsimple"
                              className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-app-accent transition-colors"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {step === 'review' && (
          <div className="px-6 py-4 border-t border-[#1e2235] shrink-0 flex gap-3">
            {isBulkMode && (
              <button
                onClick={handleSkip}
                className="flex-1 px-4 py-3 rounded-xl border border-[#1e2235] text-sm text-gray-400 hover:text-white hover:border-[#2a3050] hover:bg-[#1a1e2e] transition-all font-medium"
              >
                Skip
              </button>
            )}
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-app-accent text-[#0a0d14] text-sm font-semibold hover:bg-app-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {confirmLabel}
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
