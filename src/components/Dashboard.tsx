import { useState } from 'react'
import { TrendingUp, TrendingDown, Plus } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { Holding } from '../types'
import NetWorthChart from './NetWorthChart'
import SpendDashboard from './SpendDashboard'
import CashFlowDashboard from './CashFlowDashboard'
import HoldingsBreakdown from './HoldingsBreakdown'
import { formatCurrencyFull, formatCurrency, formatMonth } from '../utils/formatters'

interface DashboardProps {
  onGoToAccounts: () => void
  onGoToAccount: (id: string) => void
}

type DashTab = 'save' | 'spend' | 'cash-flow'

const CASH_ACCOUNT_TYPES = new Set(['Cash', 'Other'])

export default function Dashboard({ onGoToAccounts, onGoToAccount }: DashboardProps) {
  const { data } = useFinance()
  const { accounts } = data
  const [tab, setTab] = useState<DashTab>('save')
  const [chartView, setChartView] = useState<'value' | 'holdings'>('value')

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
    const lastSeen = (a: typeof accounts[0], upTo: string) =>
      [...a.entries]
        .filter((e) => e.yearMonth <= upTo)
        .sort((x, y) => y.yearMonth.localeCompare(x.yearMonth))[0]?.value ?? 0
    const latestTotal = accounts.reduce((sum, a) => sum + lastSeen(a, latest), 0)
    const prevTotal = accounts.reduce((sum, a) => sum + lastSeen(a, previous), 0)
    if (prevTotal > 0) {
      changeAmount = latestTotal - prevTotal
      changePct = (changeAmount / prevTotal) * 100
    }
  }

  const isPositive = (changeAmount ?? 0) >= 0
  const latestMonth = allMonths[allMonths.length - 1]

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      {/* Header + tabs */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white mb-4">Dashboard</h1>
        <div className="flex gap-1 p-1 bg-[#12151f] border border-[#1e2235] rounded-xl w-fit">
          <button
            onClick={() => setTab('save')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'save'
                ? 'bg-app-accent text-[#0a0d14]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Save
          </button>
          <button
            onClick={() => setTab('spend')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'spend'
                ? 'bg-app-accent text-[#0a0d14]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Spend
          </button>
          <button
            onClick={() => setTab('cash-flow')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'cash-flow'
                ? 'bg-app-accent text-[#0a0d14]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Cash Flow
          </button>
        </div>
      </div>

      {/* Spend tab */}
      {tab === 'spend' && <SpendDashboard />}

      {/* Cash Flow tab */}
      {tab === 'cash-flow' && <CashFlowDashboard />}

      {/* Save tab content */}
      {tab === 'save' && <>
      <p className="text-sm text-gray-500 -mt-4">
        {latestMonth ? `As of ${formatMonth(latestMonth)}` : 'No data yet'}
      </p>

      {/* Net Worth Hero */}
      <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-4 md:p-7">
        <p className="text-sm text-gray-400 font-medium mb-2">Total Net Worth</p>
        <div className="flex items-end gap-3 md:gap-4 flex-wrap">
          <span className="text-3xl md:text-5xl font-bold text-white tracking-tight">
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

      {/* Chart / Portfolio Distribution toggle */}
      {(() => {
        // Compute aggregate holdings for the distribution view
        interface AggregateHolding extends Holding { accounts: string[] }
        const symbolMap = new Map<string, AggregateHolding>()
        let cashTotal = 0
        const cashAccountNames: string[] = []

        for (const account of accounts) {
          const sorted = [...account.entries].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))
          const latest = sorted[0]
          if (!latest) continue

          // Only treat as cash if it's a Cash/Other type AND has no holdings
          // (e.g. Crypto accounts are type 'Other' but have holdings)
          const hasHoldingsData = sorted.some((e) => e.holdings && e.holdings.length > 0)
          if (CASH_ACCOUNT_TYPES.has(account.type) && !hasHoldingsData) {
            cashTotal += latest.value
            cashAccountNames.push(account.name)
            continue
          }

          const latestWithHoldings = sorted.find((e) => e.holdings && e.holdings.length > 0)
          if (latestWithHoldings?.holdings) {
            for (const h of latestWithHoldings.holdings) {
              const existing = symbolMap.get(h.symbol)
              if (existing) {
                existing.quantity += h.quantity
                existing.marketValue += h.marketValue
                existing.bookCost += h.bookCost
                existing.marketPrice = existing.marketValue / existing.quantity
                if (!existing.accounts.includes(account.name)) {
                  existing.accounts.push(account.name)
                }
              } else {
                symbolMap.set(h.symbol, { ...h, accounts: [account.name] })
              }
            }
          }
        }

        // Merge Cash-type account values into the "Cash" symbol from holdings
        if (cashTotal > 0) {
          const existingCash = symbolMap.get('Cash')
          if (existingCash) {
            existingCash.marketValue += cashTotal
            existingCash.bookCost += cashTotal
            existingCash.marketPrice = existingCash.marketValue
            for (const name of cashAccountNames) {
              if (!existingCash.accounts.includes(name)) existingCash.accounts.push(name)
            }
          } else {
            symbolMap.set('Cash', {
              symbol: 'Cash',
              quantity: 1,
              marketPrice: cashTotal,
              marketValue: cashTotal,
              bookCost: cashTotal,
              currency: 'CAD',
              accounts: cashAccountNames,
            })
          }
        }

        const aggregated = [...symbolMap.values()]

        // Find the most recent conversionRates from any entry
        const latestRates = accounts
          .flatMap((a) => a.entries)
          .filter((e) => e.conversionRates)
          .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0]?.conversionRates

        const hasHoldings = aggregated.length > 0
        const accountLabels: Record<string, string[]> = {}
        for (const h of aggregated) {
          if ((h as AggregateHolding).accounts.length > 0) {
            accountLabels[h.symbol] = (h as AggregateHolding).accounts
          }
        }

        return (
          <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-sm font-semibold text-gray-300">
                {chartView === 'value' ? 'Portfolio Over Time' : 'Portfolio Distribution'}
              </h2>
              {hasHoldings && (
                <div className="flex gap-1 p-0.5 bg-[#0a0d14] border border-[#1e2235] rounded-lg">
                  <button
                    onClick={() => setChartView('value')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      chartView === 'value' ? 'bg-app-accent text-[#0a0d14]' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Value
                  </button>
                  <button
                    onClick={() => setChartView('holdings')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      chartView === 'holdings' ? 'bg-app-accent text-[#0a0d14]' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Holdings
                  </button>
                </div>
              )}
            </div>

            {chartView === 'value' && <NetWorthChart accounts={accounts} />}
            {chartView === 'holdings' && hasHoldings && (
              <HoldingsBreakdown holdings={aggregated} accountLabels={accountLabels} conversionRates={latestRates} />
            )}
          </div>
        )
      })()}

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
      </>}
    </div>
  )
}
