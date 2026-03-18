/**
 * Fetches currency→CAD conversion rates from frankfurter.app.
 * Stores rates as a map so any currency can be converted to CAD.
 * Falls back to the most recent known rates from existing entries.
 */

/** Map of currency code → CAD rate (e.g. { USD: 1.37, EUR: 1.52 }) */
export type ConversionRates = Record<string, number>

/**
 * Fetch all currency→CAD rates for a specific date from frankfurter.app.
 * The API returns rates relative to a base currency; we query with base=CAD
 * then invert to get "how many CAD per 1 unit of foreign currency".
 */
export async function fetchConversionRates(date: string): Promise<ConversionRates> {
  const res = await fetch(`https://api.frankfurter.dev/v1/${date}?base=CAD`)
  if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`)
  const data = await res.json()
  // data.rates = { USD: 0.73, EUR: 0.66, ... } (how many foreign per 1 CAD)
  // We want the inverse: how many CAD per 1 foreign unit
  const rates: ConversionRates = {}
  for (const [currency, rate] of Object.entries(data.rates)) {
    rates[currency] = 1 / (rate as number)
  }
  return rates
}

/**
 * Get currency→CAD conversion rates for a statement month.
 * Tries the API first (using end-of-month date), then falls back to
 * the most recent rates from existing account entries.
 */
export async function getConversionRates(
  yearMonth: string,
  existingRates: ConversionRates | undefined,
): Promise<ConversionRates> {
  const [year, month] = yearMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const date = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

  try {
    return await fetchConversionRates(date)
  } catch {
    // Fallback: use the most recent known rates from other entries
    if (existingRates && Object.keys(existingRates).length > 0) {
      return existingRates
    }
    // Last resort: hardcoded approximate rates
    return { USD: 1.44, EUR: 1.52, GBP: 1.76 }
  }
}

/** Convert a value to CAD using the rates map. CAD values pass through unchanged. */
export function toCad(value: number, currency: string, rates?: ConversionRates): number {
  if (currency === 'CAD' || !rates) return value
  const rate = rates[currency]
  if (!rate) return value // unknown currency, return as-is
  return value * rate
}
