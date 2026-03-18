import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Holding } from '../types'
import { formatCurrencyFull } from '../utils/formatters'
import { toCad, ConversionRates } from '../utils/exchangeRate'

interface HoldingsBreakdownProps {
  holdings: Holding[]
  /** When true, show which accounts hold each symbol (aggregate view) */
  accountLabels?: Record<string, string[]>
  /** Currency→CAD conversion rates for calculating CAD-equivalent totals/percentages */
  conversionRates?: ConversionRates
}

const COLORS = [
  '#00d395', '#5B8AF5', '#F5A623', '#E85D75', '#9B6FE3',
  '#00B8D4', '#FF8A65', '#66BB6A', '#AB47BC', '#29B6F6',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const { name, value, pct } = payload[0].payload
  return (
    <div className="bg-app-hover border border-app-border rounded-lg px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-white">{name}</p>
      <p className="text-gray-400">{formatCurrencyFull(value)} ({pct.toFixed(1)}%)</p>
    </div>
  )
}

export default function HoldingsBreakdown({ holdings, accountLabels, conversionRates }: HoldingsBreakdownProps) {
  /** Convert a holding's market value to CAD */
  const toCAD = (h: Holding) => toCad(h.marketValue, h.currency, conversionRates)

  // Sort by CAD-equivalent market value descending
  const sorted = [...holdings].sort((a, b) => toCAD(b) - toCAD(a))
  const total = sorted.reduce((sum, h) => sum + toCAD(h), 0)

  const pieData = sorted.map((h) => ({
    name: h.symbol,
    value: toCAD(h),
    pct: total > 0 ? (toCAD(h) / total) * 100 : 0,
  }))

  return (
    <div>
      {/* Donut chart */}
      <div className="h-48 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="85%"
              strokeWidth={0}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Holdings table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-app-border">
              <th className="text-left py-2 pr-4">Symbol</th>
              <th className="text-right py-2 pr-4">Qty</th>
              <th className="text-right py-2 pr-4">Price</th>
              <th className="text-right py-2 pr-4">Value</th>
              <th className="text-right py-2">%</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h, i) => {
              const cadValue = toCAD(h)
              const pct = total > 0 ? (cadValue / total) * 100 : 0
              const isForeign = h.currency !== 'CAD' && conversionRates?.[h.currency]
              const rate = conversionRates?.[h.currency]
              return (
                <tr key={h.symbol} className="border-b border-app-border/50">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="font-medium text-white">{h.symbol}</span>
                    </div>
                    {accountLabels?.[h.symbol] && (
                      <div className="text-xs text-gray-500 ml-[18px] mt-0.5">
                        {accountLabels[h.symbol].join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="text-right py-2.5 pr-4 text-gray-300 tabular-nums">
                    {h.quantity.toLocaleString('en-CA', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 1,
                    })}
                  </td>
                  <td className="text-right py-2.5 pr-4 text-gray-400 tabular-nums">
                    {formatCurrencyFull(h.marketPrice)} <span className="text-xs">{h.currency}</span>
                  </td>
                  <td className="text-right py-2.5 pr-4 text-white font-medium tabular-nums">
                    {formatCurrencyFull(h.marketValue)}
                    <span className="text-[10px] text-gray-500 ml-1">{h.currency}</span>
                    {isForeign && (
                      <div className="text-[10px] text-gray-600 mt-0.5">
                        ≈ {formatCurrencyFull(cadValue)} CAD
                        <span className="text-gray-700 ml-1">@ {rate!.toFixed(4)}</span>
                      </div>
                    )}
                  </td>
                  <td className="text-right py-2.5 text-gray-400 tabular-nums">
                    {pct.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
