import { useState } from 'react'
import { ArrowLeft, Upload, Trash2, TrendingUp, TrendingDown, PenLine, PieChart } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Account } from '../types'
import { useFinance } from '../context/FinanceContext'
import { formatCurrencyFull, formatMonth } from '../utils/formatters'
import UploadModal from './UploadModal'
import HoldingsBreakdown from './HoldingsBreakdown'
import HoldingsEditor from './HoldingsEditor'

interface AccountDetailProps {
  account: Account
  onBack: () => void
}

const formatY = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

export default function AccountDetail({ account, onBack }: AccountDetailProps) {
  const { deleteAccount, deleteEntry, addEntry, updateEntryHoldings } = useFinance()
  const [showUpload, setShowUpload] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [chartView, setChartView] = useState<'value' | 'holdings'>('value')
  const [showHoldingsEditor, setShowHoldingsEditor] = useState(false)
  const [manualMonth, setManualMonth] = useState('')
  const [manualValue, setManualValue] = useState('')

  const handleManualSave = () => {
    if (!manualMonth || !manualValue) return
    addEntry(account.id, { yearMonth: manualMonth, value: parseFloat(manualValue), sourceFilename: 'Manual entry' })
    setShowManualEntry(false)
    setManualMonth('')
    setManualValue('')
  }

  const sorted = [...account.entries].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
  const latest = sorted[sorted.length - 1]

  const chartData = sorted.map((e) => ({ month: e.yearMonth, value: e.value }))

  const handleDeleteAccount = () => {
    deleteAccount(account.id)
    onBack()
  }

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl border border-[#1e2235] text-gray-400 hover:text-white hover:bg-[#1a1e2e] transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                style={{ background: `${account.color}1a`, color: account.color }}
              >
                {account.type}
              </span>
              <span className="text-xs text-gray-500">{account.institution}</span>
            </div>
            <h1 className="text-xl font-bold text-white">{account.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 md:shrink-0">
          <button
            onClick={() => setShowHoldingsEditor(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1e2235] text-sm font-semibold text-gray-300 hover:text-white hover:bg-[#1a1e2e] transition-all"
          >
            <PieChart size={14} />
            <span className="hidden sm:inline">Edit Holdings</span>
          </button>
          <button
            onClick={() => setShowManualEntry(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1e2235] text-sm font-semibold text-gray-300 hover:text-white hover:bg-[#1a1e2e] transition-all"
          >
            <PenLine size={14} />
            <span className="hidden sm:inline">Manual Entry</span>
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-app-accent text-[#0a0d14] text-sm font-semibold hover:bg-app-accent-hover transition-all"
          >
            <Upload size={14} />
            Upload Statement
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2.5 rounded-xl border border-[#1e2235] text-gray-500 hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/5 transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Latest value */}
      {latest && (
        <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-6">
          <p className="text-xs text-gray-500 mb-1">Latest Value</p>
          <p className="text-3xl md:text-4xl font-bold text-white">{formatCurrencyFull(latest.value)}</p>
          <p className="text-xs text-gray-600 mt-1">{formatMonth(latest.yearMonth)}</p>
        </div>
      )}

      {/* Chart / Holdings toggle */}
      {(sorted.length > 1 || (latest?.holdings && latest.holdings.length > 0)) && (
        <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-4 md:p-6">
          {latest?.holdings && latest.holdings.length > 0 && sorted.length > 1 ? (
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-sm font-semibold text-gray-300">
                {chartView === 'value' ? 'Value Over Time' : 'Holdings'}
              </h2>
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
            </div>
          ) : (
            <h2 className="text-sm font-semibold text-gray-300 mb-4 md:mb-6">
              {latest?.holdings && latest.holdings.length > 0 ? 'Holdings' : 'Value Over Time'}
            </h2>
          )}

          {chartView === 'value' && sorted.length > 1 && (
            <div className="h-40 md:h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonth}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    tickFormatter={formatY}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    dx={-4}
                    width={55}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-[#12151f] border border-[#1e2235] rounded-xl p-3 shadow-xl">
                          <p className="text-xs text-gray-400 mb-1">{formatMonth(label as string)}</p>
                          <p className="text-sm font-bold font-mono" style={{ color: account.color }}>
                            {formatCurrencyFull(payload[0].value as number)}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={account.color}
                    strokeWidth={2.5}
                    dot={{ fill: account.color, strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {chartView === 'holdings' && latest?.holdings && latest.holdings.length > 0 && (
            <HoldingsBreakdown holdings={latest.holdings} conversionRates={latest.conversionRates} />
          )}

          {/* If only holdings exist (no chart data), force show holdings */}
          {chartView === 'value' && sorted.length <= 1 && latest?.holdings && latest.holdings.length > 0 && (
            <HoldingsBreakdown holdings={latest.holdings} conversionRates={latest.conversionRates} />
          )}
        </div>
      )}

      {/* Entry History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          History
          <span className="text-gray-600 font-normal ml-2">({sorted.length} entries)</span>
        </h2>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 border border-dashed border-[#1e2235] rounded-2xl text-gray-500">
            <p className="text-sm">No statements uploaded yet</p>
            <button
              onClick={() => setShowUpload(true)}
              className="text-xs text-app-accent hover:text-app-accent-hover transition-colors"
            >
              Upload your first statement →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {[...sorted].reverse().map((entry, idx, arr) => {
              const prev = arr[idx + 1]
              const change = prev ? entry.value - prev.value : null
              const pct = prev ? (change! / prev.value) * 100 : null

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 p-4 bg-[#12151f] border border-[#1e2235] rounded-xl hover:bg-[#1a1e2e] transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{formatMonth(entry.yearMonth)}</p>
                    <p className="text-[10px] text-gray-600 truncate mt-0.5">
                      {entry.sourceFilename}
                    </p>
                  </div>

                  {change !== null && pct !== null && (
                    <div
                      className={`flex items-center gap-1 text-xs font-medium shrink-0 ${
                        change >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {change >= 0 ? '+' : ''}
                      {pct.toFixed(1)}%
                    </div>
                  )}

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold font-mono text-white">
                      {formatCurrencyFull(entry.value)}
                    </p>
                  </div>

                  <button
                    onClick={() => deleteEntry(account.id, entry.id)}
                    className="opacity-100 sm:opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowManualEntry(false)}
          />
          <div className="relative bg-[#12151f] border border-[#1e2235] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-white mb-5">Add Manual Entry</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Month</label>
                <input
                  type="date"
                  value={manualMonth ? `${manualMonth}-01` : ''}
                  onChange={(e) => setManualMonth(e.target.value.slice(0, 7))}
                  className="w-full bg-[#0a0d14] border border-[#1e2235] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-app-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Value</label>
                <input
                  type="number"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full bg-[#0a0d14] border border-[#1e2235] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-app-accent transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowManualEntry(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#1e2235] text-sm text-gray-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleManualSave}
                disabled={!manualMonth || !manualValue}
                className="flex-1 px-4 py-2.5 rounded-xl bg-app-accent text-[#0a0d14] text-sm font-semibold hover:bg-app-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Holdings Editor */}
      {showHoldingsEditor && latest && (
        <HoldingsEditor
          holdings={latest.holdings ?? []}
          onSave={(holdings) => updateEntryHoldings(account.id, latest.id, holdings)}
          onClose={() => setShowHoldingsEditor(false)}
        />
      )}

      {/* Upload Modal */}
      {showUpload && <UploadModal account={account} onClose={() => setShowUpload(false)} />}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-[#12151f] border border-[#1e2235] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold text-white mb-2">Delete Account?</h3>
            <p className="text-sm text-gray-400 mb-6">
              This will permanently delete <strong className="text-white">{account.name}</strong>{' '}
              and all its history.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-[#1e2235] text-sm text-gray-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
