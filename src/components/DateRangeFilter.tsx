import { DateRange } from '../utils/dateRange'

interface DateRangeFilterProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

const OPTIONS: { value: DateRange; label: string }[] = [
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1yr', label: '1Y' },
  { value: 'all', label: 'All' },
]

export default function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex gap-1 p-0.5 bg-[#0a0d14] border border-[#1e2235] rounded-lg">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            value === opt.value ? 'bg-[#1a1e2e] text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
