export type DateRange = '3mo' | '6mo' | '1yr' | 'all'

export function getDateRangeCutoff(range: DateRange): string | null {
  if (range === 'all') return null
  const now = new Date()
  const months = range === '3mo' ? 3 : range === '6mo' ? 6 : 12
  now.setMonth(now.getMonth() - months)
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function filterByDateRange<T extends { month: string }>(
  data: T[],
  range: DateRange,
): T[] {
  const cutoff = getDateRangeCutoff(range)
  if (!cutoff) return data
  return data.filter((row) => row.month >= cutoff)
}
