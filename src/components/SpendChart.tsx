import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { CreditCardAccount } from '../types'
import { formatCurrency, formatCurrencyFull, formatMonth } from '../utils/formatters'

interface SpendChartProps {
  accounts: CreditCardAccount[]
}

interface ChartRow {
  month: string // 'YYYY-MM'
  [key: string]: number | string
}

function buildChartData(accounts: CreditCardAccount[]): ChartRow[] {
  const allMonths = [
    ...new Set(accounts.flatMap((a) => a.entries.map((e) => e.statementEndDate.slice(0, 7)))),
  ].sort()

  return allMonths.map((month) => {
    const row: ChartRow = { month }
    for (const account of accounts) {
      const entries = account.entries.filter((e) => e.statementEndDate.startsWith(month))
      entries.sort((a, b) => b.statementEndDate.localeCompare(a.statementEndDate))
      if (entries[0]) row[account.id] = entries[0].balance
    }
    return row
  })
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, e) => s + (e.value ?? 0), 0)
  return (
    <div className="bg-[#12151f] border border-[#1e2235] rounded-xl p-4 shadow-xl min-w-[180px]">
      <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">
        {label ? formatMonth(label) : ''}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
              <span className="text-xs text-gray-300 truncate max-w-[100px]">{entry.name}</span>
            </div>
            <span className="text-xs font-semibold font-mono" style={{ color: entry.color }}>
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
        {payload.length > 1 && (
          <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-[#1e2235]">
            <span className="text-xs text-gray-400">Total</span>
            <span className="text-xs font-semibold font-mono text-white">
              {formatCurrencyFull(total)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const formatYAxis = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

export default function SpendChart({ accounts }: SpendChartProps) {
  const data = buildChartData(accounts)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Upload credit card statements to see spending over time
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
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
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Legend
          wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: '#9ca3af' }}
          iconType="circle"
          iconSize={8}
        />
        {accounts.map((account) => (
          <Bar
            key={account.id}
            dataKey={account.id}
            name={account.name}
            fill={account.color}
            stackId="total"
            radius={[0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
