import { AppData, Account, AccountEntry, CreditCardAccount, CreditCardEntry, Holding } from '../types'

const ACCOUNT_COLORS = [
  '#00d395', '#5B8AF5', '#F5A623', '#BD10E0', '#FF6B6B', '#4ECDC4',
]

/** Returns an array of 6 yearMonth strings ending at the current month */
function recentMonths(): string[] {
  const now = new Date()
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

/** Returns an array of 6 statement-end dates (15th of each month) ending at the current month */
function recentStatementDates(): string[] {
  const now = new Date()
  const dates: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 15)
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    )
  }
  return dates
}

/** Demo conversion rates (approximate) */
const DEMO_CONVERSION_RATES: Record<string, number> = { USD: 1.37, EUR: 1.52, GBP: 1.76 }

function makeEntries(
  months: string[],
  baseValue: number,
  increments: number[],
  /** If provided, attached to the latest (last) entry */
  latestHoldings?: Holding[],
): AccountEntry[] {
  let value = baseValue
  return months.map((yearMonth, i) => {
    if (i > 0) value += increments[i - 1]
    const entry: AccountEntry = {
      id: crypto.randomUUID(),
      yearMonth,
      value: Math.round(value * 100) / 100,
      uploadedAt: new Date().toISOString(),
      sourceFilename: 'demo-data',
    }
    if (latestHoldings && i === months.length - 1) {
      entry.holdings = latestHoldings
      // Add conversion rates if any holdings are in a non-CAD currency
      if (latestHoldings.some((h) => h.currency !== 'CAD')) {
        entry.conversionRates = DEMO_CONVERSION_RATES
      }
    }
    return entry
  })
}

function makeCCEntries(
  dates: string[],
  balances: number[],
): CreditCardEntry[] {
  return dates.map((statementEndDate, i) => ({
    id: crypto.randomUUID(),
    statementEndDate,
    balance: balances[i],
    uploadedAt: new Date().toISOString(),
    sourceFilename: 'demo-data',
  }))
}

export function generateDemoData(): AppData {
  const months = recentMonths()
  const stmtDates = recentStatementDates()
  const startMonth = months[0]

  // Demo holdings for investment accounts
  const tfsaHoldings: Holding[] = [
    { symbol: 'XQQ', quantity: 120.0000, marketPrice: 142.35, marketValue: 17082.00, bookCost: 14850.00, currency: 'CAD' },
    { symbol: 'VFV', quantity: 95.0000, marketPrice: 128.60, marketValue: 12217.00, bookCost: 10640.00, currency: 'CAD' },
    { symbol: 'XEQT', quantity: 210.0000, marketPrice: 32.45, marketValue: 6814.50, bookCost: 6120.00, currency: 'CAD' },
    { symbol: 'XUS', quantity: 180.0000, marketPrice: 56.20, marketValue: 10116.00, bookCost: 9250.00, currency: 'USD' },
    { symbol: 'TDB900', quantity: 42.0000, marketPrice: 25.18, marketValue: 1057.56, bookCost: 1040.00, currency: 'CAD' },
    { symbol: 'Cash', quantity: 1, marketPrice: 2340.50, marketValue: 2340.50, bookCost: 2340.50, currency: 'CAD' },
  ]
  const rrspHoldings: Holding[] = [
    { symbol: 'VFV', quantity: 150.0000, marketPrice: 128.60, marketValue: 19290.00, bookCost: 16500.00, currency: 'CAD' },
    { symbol: 'XQQ', quantity: 65.0000, marketPrice: 142.35, marketValue: 9252.75, bookCost: 8100.00, currency: 'CAD' },
    { symbol: 'ZAG', quantity: 200.0000, marketPrice: 14.92, marketValue: 2984.00, bookCost: 3050.00, currency: 'CAD' },
    { symbol: 'VUN', quantity: 55.0000, marketPrice: 72.80, marketValue: 4004.00, bookCost: 3600.00, currency: 'CAD' },
    { symbol: 'Cash', quantity: 1, marketPrice: 815.20, marketValue: 815.20, bookCost: 815.20, currency: 'CAD' },
  ]
  const fhsaHoldings: Holding[] = [
    { symbol: 'XEQT', quantity: 120.0000, marketPrice: 32.45, marketValue: 3894.00, bookCost: 3550.00, currency: 'CAD' },
    { symbol: 'XQQ', quantity: 25.0000, marketPrice: 142.35, marketValue: 3558.75, bookCost: 3200.00, currency: 'CAD' },
    { symbol: 'Cash', quantity: 1, marketPrice: 42.15, marketValue: 42.15, bookCost: 42.15, currency: 'CAD' },
  ]
  const nonRegHoldings: Holding[] = [
    { symbol: 'AAPL', quantity: 15.0000, marketPrice: 242.50, marketValue: 3637.50, bookCost: 2850.00, currency: 'USD' },
    { symbol: 'MSFT', quantity: 10.0000, marketPrice: 425.80, marketValue: 4258.00, bookCost: 3500.00, currency: 'USD' },
    { symbol: 'GOOGL', quantity: 20.0000, marketPrice: 178.30, marketValue: 3566.00, bookCost: 2900.00, currency: 'USD' },
    { symbol: 'SHOP', quantity: 30.0000, marketPrice: 105.40, marketValue: 3162.00, bookCost: 2750.00, currency: 'CAD' },
  ]

  const accounts: Account[] = [
    {
      id: crypto.randomUUID(),
      name: 'TFSA',
      type: 'TFSA',
      institution: 'Wealthsimple',
      color: ACCOUNT_COLORS[0],
      entries: makeEntries(months, 42000, [980, 1150, 870, 1220, 1050], tfsaHoldings),
    },
    {
      id: crypto.randomUUID(),
      name: 'RRSP',
      type: 'RRSP',
      institution: 'Wealthsimple',
      color: ACCOUNT_COLORS[1],
      entries: makeEntries(months, 28000, [1680, 1520, 1890, 1750, 1620], rrspHoldings),
    },
    {
      id: crypto.randomUUID(),
      name: 'FHSA',
      type: 'FHSA',
      institution: 'Wealthsimple',
      color: ACCOUNT_COLORS[2],
      entries: makeEntries(months, 5000, [420, 510, 480, 550, 460], fhsaHoldings),
    },
    {
      id: crypto.randomUUID(),
      name: 'Non-Registered',
      type: 'Non-Registered',
      institution: 'Questrade',
      color: ACCOUNT_COLORS[3],
      entries: makeEntries(months, 15000, [380, 620, 450, 710, 530], nonRegHoldings),
    },
    {
      id: crypto.randomUUID(),
      name: 'Chequing',
      type: 'Cash',
      institution: 'Wealthsimple',
      color: ACCOUNT_COLORS[4],
      entries: makeEntries(months, 4200, [1800, -1200, 2100, -600, 1500]),
    },
  ]

  const creditCardAccounts: CreditCardAccount[] = [
    {
      id: crypto.randomUUID(),
      name: 'Visa Infinite',
      institution: 'TD',
      color: ACCOUNT_COLORS[4],
      entries: makeCCEntries(stmtDates, [1842, 2210, 1567, 2680, 1935, 2105]),
    },
    {
      id: crypto.randomUUID(),
      name: 'World Elite',
      institution: 'Rogers Bank',
      color: ACCOUNT_COLORS[5],
      entries: makeCCEntries(stmtDates, [623, 480, 715, 890, 542, 678]),
    },
  ]

  return {
    accounts,
    creditCardAccounts,
    cashFlowConfig: {
      incomeRecords: [
        {
          id: crypto.randomUUID(),
          name: 'Salary — Acme Corp',
          amount: 5200,
          frequency: 'monthly',
          startDate: startMonth,
          endDate: null,
        },
      ],
      fixedExpenses: [
        {
          id: crypto.randomUUID(),
          name: 'Rent',
          amount: 1850,
          frequency: 'monthly',
          isOnCreditCard: false,
          startDate: startMonth,
          endDate: null,
        },
        {
          id: crypto.randomUUID(),
          name: 'Car Insurance',
          amount: 180,
          frequency: 'monthly',
          isOnCreditCard: true,
          startDate: startMonth,
          endDate: null,
        },
      ],
      ccAdjustments: [
        {
          id: crypto.randomUUID(),
          month: months[2],
          amount: 340,
          name: 'Toronto work trip',
        },
        {
          id: crypto.randomUUID(),
          month: months[4],
          amount: 580,
          name: 'Holiday gifts',
        },
      ],
    },
    version: 1,
  }
}
