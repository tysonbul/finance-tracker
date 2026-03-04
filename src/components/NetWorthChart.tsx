import { useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Account } from '../types'
import { formatCurrency, formatMonth } from '../utils/formatters'

interface NetWorthChartProps {
  accounts: Account[]
}

interface ChartRow {
  month: string
  total: number
  [key: string]: number | string
}

interface DeltaRow {
  month: string
  delta: number
}

function lastSeenValue(account: Account, upToMonth: string): number | null {
  const entry = [...account.entries]
    .filter((e) => e.yearMonth <= upToMonth)
    .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0]
  return entry?.value ?? null
}

function buildChartData(accounts: Account[]): ChartRow[] {
  const allMonths = [
    ...new Set(accounts.flatMap((a) => a.entries.map((e) => e.yearMonth))),
  ].sort()

  return allMonths.map((month) => {
    const row: ChartRow = { month, total: 0 }
    for (const account of accounts) {
      const val = lastSeenValue(account, month)
      if (val !== null) {
        row[account.id] = val
        row.total = (row.total as number) + val
      }
    }
    return row
  })
}

function buildDeltaData(chartData: ChartRow[]): DeltaRow[] {
  return chartData.slice(1).map((row, i) => ({
    month: row.month,
    delta: (row.total as number) - (chartData[i].total as number),
  }))
}

const formatYAxis = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

const TotalTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#12151f] border border-[#1e2235] rounded-xl p-4 shadow-xl min-w-[160px]">
      <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">
        {label ? formatMonth(label) : ''}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
              <span className="text-xs text-gray-300 truncate max-w-[90px]">{entry.name}</span>
            </div>
            <span className="text-xs font-semibold font-mono" style={{ color: entry.color }}>
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const DeltaTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  const delta = payload[0].value
  const isPos = delta >= 0
  return (
    <div className="bg-[#12151f] border border-[#1e2235] rounded-xl p-4 shadow-xl min-w-[140px]">
      <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
        {label ? formatMonth(label) : ''}
      </p>
      <p className={`text-sm font-bold font-mono ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPos ? '+' : ''}{formatCurrency(delta)}
      </p>
    </div>
  )
}

export default function NetWorthChart({ accounts }: NetWorthChartProps) {
  const [mode, setMode] = useState<'total' | 'delta'>('total')
  const data = buildChartData(accounts)
  const deltaData = buildDeltaData(data)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-44 text-gray-500 text-sm">
        Upload statements to see your portfolio over time
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex justify-end">
        <div className="flex gap-1 p-0.5 bg-[#0a0d14] border border-[#1e2235] rounded-lg">
          <button
            onClick={() => setMode('total')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              mode === 'total' ? 'bg-[#1a1e2e] text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Total
          </button>
          <button
            onClick={() => setMode('delta')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              mode === 'delta' ? 'bg-[#1a1e2e] text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Monthly Change
          </button>
        </div>
      </div>

      <div className="h-80">
        {mode === 'total' ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                dy={8}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                dx={-4}
                width={45}
              />
              <Tooltip content={<TotalTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: '#9ca3af' }}
                iconType="circle"
                iconSize={8}
              />
              {accounts.map((account) => (
                <Line
                  key={account.id}
                  type="monotone"
                  dataKey={account.id}
                  name={account.name}
                  stroke={account.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                />
              ))}
              <Line
                type="monotone"
                dataKey="total"
                name="Net Worth"
                stroke="#ffffff"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: '#ffffff' }}
                strokeDasharray={accounts.length > 1 ? undefined : '0'}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deltaData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                dy={8}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                dx={-4}
                width={45}
              />
              <Tooltip content={<DeltaTooltip />} />
              <Bar dataKey="delta" radius={[3, 3, 0, 0]}>
                {deltaData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.delta >= 0 ? '#00d395' : '#f87171'}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
