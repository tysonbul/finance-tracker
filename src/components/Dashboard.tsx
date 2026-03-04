import { TrendingUp, TrendingDown, Plus } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import NetWorthChart from './NetWorthChart'
import { formatCurrencyFull, formatCurrency, formatMonth } from '../utils/formatters'

interface DashboardProps {
  onGoToAccounts: () => void
  onGoToAccount: (id: string) => void
}

export default function Dashboard({ onGoToAccounts, onGoToAccount }: DashboardProps) {
  const { data } = useFinance()
  const { accounts } = data

  // Calculate net worth (sum of latest entry per account)
  const latestValues = accounts.map((a) => {
    const sorted = [...a.entries].sort((x, y) => y.yearMonth.localeCompare(x.yearMonth))
    return sorted[0]?.value ?? null
  })
  const netWorth = latestValues.reduce<number>((sum, v) => sum + (v ?? 0), 0)

  // Net worth change vs previous month
  const allMonths = [
    ...new Set(accounts.flatMap((a) => a.entries.map((e) => e.yearMonth))),
  ].sort()

  let changeAmount: number | null = null
  let changePct: number | null = null

  if (allMonths.length >= 2) {
    const latest = allMonths[allMonths.length - 1]
    const previous = allMonths[allMonths.length - 2]
    const latestTotal = accounts.reduce((sum, a) => {
      const e = a.entries.find((x) => x.yearMonth === latest)
      return sum + (e?.value ?? 0)
    }, 0)
    const prevTotal = accounts.reduce((sum, a) => {
      const e = a.entries.find((x) => x.yearMonth === previous)
      return sum + (e?.value ?? 0)
    }, 0)
    if (prevTotal > 0) {
      changeAmount = latestTotal - prevTotal
      changePct = (changeAmount / prevTotal) * 100
    }
  }

  const isPositive = (changeAmount ?? 0) >= 0
  const latestMonth = allMonths[allMonths.length - 1]

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {latestMonth ? `As of ${formatMonth(latestMonth)}` : 'No data yet'}
        </p>
      </div>

      {/* Net Worth Hero */}
      <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-7">
        <p className="text-sm text-gray-400 font-medium mb-2">Total Net Worth</p>
        <div className="flex items-end gap-4 flex-wrap">
          <span className="text-5xl font-bold text-white tracking-tight">
            {formatCurrencyFull(netWorth)}
          </span>
          {changeAmount !== null && changePct !== null && (
            <div
              className={`flex items-center gap-1.5 mb-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                isPositive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {isPositive ? '+' : ''}
              {formatCurrency(changeAmount)} ({isPositive ? '+' : ''}
              {changePct.toFixed(1)}%)
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-6">Portfolio Over Time</h2>
        <div className="h-72">
          <NetWorthChart accounts={accounts} />
        </div>
      </div>

      {/* Account Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300">Accounts</h2>
          <button
            onClick={onGoToAccounts}
            className="text-xs text-app-accent hover:text-app-accent-hover transition-colors font-medium"
          >
            Manage →
          </button>
        </div>

        {accounts.length === 0 ? (
          <button
            onClick={onGoToAccounts}
            className="w-full flex flex-col items-center gap-3 py-12 border border-dashed border-[#1e2235] rounded-2xl text-gray-500 hover:border-app-accent hover:text-app-accent transition-all group"
          >
            <Plus size={20} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm">Add your first account</span>
          </button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {accounts.map((account) => {
              const sorted = [...account.entries].sort((a, b) =>
                b.yearMonth.localeCompare(a.yearMonth),
              )
              const latest = sorted[0]
              const previous = sorted[1]
              const pctChange =
                latest && previous
                  ? ((latest.value - previous.value) / previous.value) * 100
                  : null

              return (
                <button
                  key={account.id}
                  onClick={() => onGoToAccount(account.id)}
                  className="text-left bg-[#12151f] border border-[#1e2235] rounded-xl p-4 hover:border-[#2a2d4a] hover:bg-[#1a1e2e] transition-all group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ background: `${account.color}1a`, color: account.color }}
                    >
                      {account.type}
                    </div>
                    {pctChange !== null && (
                      <span
                        className={`text-[10px] font-semibold ${pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                      >
                        {pctChange >= 0 ? '+' : ''}
                        {pctChange.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white truncate group-hover:text-app-accent transition-colors">
                    {account.name}
                  </p>
                  <p className="text-xs text-gray-500 mb-3 truncate">{account.institution}</p>
                  <p className="text-lg font-bold text-white font-mono">
                    {latest ? formatCurrencyFull(latest.value) : '—'}
                  </p>
                  {latest && (
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {formatMonth(latest.yearMonth)}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
