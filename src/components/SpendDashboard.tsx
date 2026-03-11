import { useState } from 'react'
import { Plus, Upload, Trash2 } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import SpendChart from './SpendChart'
import CreditCardUploadModal from './CreditCardUploadModal'
import DateRangeFilter from './DateRangeFilter'
import { formatCurrencyFull, formatDateLong } from '../utils/formatters'
import { CreditCardAccount } from '../types'
import { DateRange, filterByDateRange } from '../utils/dateRange'

export default function SpendDashboard() {
  const { data, deleteCreditCardAccount } = useFinance()
  const { creditCardAccounts } = data

  const [showUpload, setShowUpload] = useState(false)
  const [uploadForAccount, setUploadForAccount] = useState<CreditCardAccount | undefined>()
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRange>('6mo')

  const openGlobalUpload = () => {
    setUploadForAccount(undefined)
    setShowUpload(true)
  }

  const openAccountUpload = (account: CreditCardAccount) => {
    setUploadForAccount(account)
    setShowUpload(true)
  }

  // Monthly totals bucketed by statement end month
  const allMonths = [
    ...new Set(
      creditCardAccounts.flatMap((a) => a.entries.map((e) => e.statementEndDate.slice(0, 7))),
    ),
  ].sort()

  const allMonthlyRows = allMonths.map((month) => ({
    month,
    total: creditCardAccounts.reduce((sum, a) => {
      const entries = a.entries.filter((e) => e.statementEndDate.startsWith(month))
      entries.sort((x, y) => y.statementEndDate.localeCompare(x.statementEndDate))
      return sum + (entries[0]?.balance ?? 0)
    }, 0),
  }))

  const filteredMonthlyRows = filterByDateRange(allMonthlyRows, dateRange)
  const monthlyTotals = filteredMonthlyRows.map((r) => r.total)

  const avgMonthlySpend =
    monthlyTotals.length > 0
      ? monthlyTotals.reduce((s, v) => s + v, 0) / monthlyTotals.length
      : null

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Avg monthly spend hero */}
      <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-4 md:p-7">
        <p className="text-sm text-gray-400 font-medium mb-2">Avg Monthly Spend</p>
        <div className="flex items-end gap-3 md:gap-4 flex-wrap">
          <span className="text-3xl md:text-5xl font-bold text-white tracking-tight">
            {avgMonthlySpend !== null ? formatCurrencyFull(avgMonthlySpend) : '—'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {monthlyTotals.length > 0
            ? `Based on ${monthlyTotals.length} month${monthlyTotals.length === 1 ? '' : 's'} of statements`
            : 'No statements uploaded yet'}
        </p>
      </div>

      {/* Chart */}
      <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h2 className="text-sm font-semibold text-gray-300">Balance Over Time</h2>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
        <div className="h-48 md:h-72">
          <SpendChart accounts={creditCardAccounts} dateRange={dateRange} />
        </div>
      </div>

      {/* Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300">Credit Cards</h2>
          <button
            onClick={openGlobalUpload}
            className="flex items-center gap-1.5 text-xs text-app-accent hover:text-app-accent-hover transition-colors font-medium"
          >
            <Upload size={12} />
            Upload Statement
          </button>
        </div>

        {creditCardAccounts.length === 0 ? (
          <button
            onClick={openGlobalUpload}
            className="w-full flex flex-col items-center gap-3 py-12 border border-dashed border-[#1e2235] rounded-2xl text-gray-500 hover:border-app-accent hover:text-app-accent transition-all group"
          >
            <Plus size={20} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm">Upload your first credit card statement</span>
          </button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {creditCardAccounts.map((account) => {
              const sorted = [...account.entries].sort((a, b) =>
                b.statementEndDate.localeCompare(a.statementEndDate),
              )
              const latest = sorted[0]
              const previous = sorted[1]
              const pctChange =
                latest && previous
                  ? ((latest.balance - previous.balance) / previous.balance) * 100
                  : null
              const isDeleting = deleteConfirmId === account.id

              return (
                <div
                  key={account.id}
                  className="text-left bg-[#12151f] border border-[#1e2235] rounded-xl p-4 hover:border-[#2a2d4a] hover:bg-[#1a1e2e] transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ background: `${account.color}1a`, color: account.color }}
                    >
                      Credit
                    </div>
                    {pctChange !== null && (
                      <span
                        className={`text-[10px] font-semibold ${pctChange >= 0 ? 'text-red-400' : 'text-emerald-400'}`}
                      >
                        {pctChange >= 0 ? '+' : ''}
                        {pctChange.toFixed(1)}%
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-white truncate">{account.name}</p>
                  <p className="text-xs text-gray-500 mb-3 truncate">{account.institution}</p>

                  <p className="text-lg font-bold text-white font-mono">
                    {latest ? formatCurrencyFull(latest.balance) : '—'}
                  </p>
                  {latest && (
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {formatDateLong(latest.statementEndDate)}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#1e2235]">
                    <button
                      onClick={() => openAccountUpload(account)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium text-gray-400 hover:text-app-accent hover:bg-app-accent-dim transition-all"
                    >
                      <Upload size={10} />
                      Upload
                    </button>

                    {isDeleting ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            deleteCreditCardAccount(account.id)
                            setDeleteConfirmId(null)
                          }}
                          className="px-2 py-1.5 rounded-lg text-[10px] font-medium text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1.5 rounded-lg text-[10px] font-medium text-gray-500 hover:text-white transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(account.id)}
                        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showUpload && (
        <CreditCardUploadModal
          account={uploadForAccount}
          onClose={() => {
            setShowUpload(false)
            setUploadForAccount(undefined)
          }}
        />
      )}
    </div>
  )
}
