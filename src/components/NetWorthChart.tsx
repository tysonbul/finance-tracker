import {
  LineChart,
  Line,
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

function buildChartData(accounts: Account[]): ChartRow[] {
  const allMonths = [
    ...new Set(accounts.flatMap((a) => a.entries.map((e) => e.yearMonth))),
  ].sort()

  return allMonths.map((month) => {
    const row: ChartRow = { month, total: 0 }
    for (const account of accounts) {
      const entry = account.entries.find((e) => e.yearMonth === month)
      if (entry) {
        row[account.id] = entry.value
        row.total = (row.total as number) + entry.value
      }
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
  return (
    <div className="bg-[#12151f] border border-[#1e2235] rounded-xl p-4 shadow-xl min-w-[160px]">
      <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">
        {label ? formatMonth(label) : ''}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: entry.color }}
              />
              <span className="text-xs text-gray-300 truncate max-w-[90px]">{entry.name}</span>
            </div>
            <span
              className="text-xs font-semibold font-mono"
              style={{ color: entry.color }}
            >
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const formatYAxis = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

export default function NetWorthChart({ accounts }: NetWorthChartProps) {
  const data = buildChartData(accounts)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Upload statements to see your portfolio over time
      </div>
    )
  }

  return (
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
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ paddingTop: '16px', fontSize: '12px', color: '#9ca3af' }}
          iconType="circle"
          iconSize={8}
        />

        {/* Per-account lines */}
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

        {/* Net worth total line */}
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
  )
}
