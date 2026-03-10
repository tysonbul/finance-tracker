import { AppData, Account, AccountEntry, CreditCardAccount, CreditCardEntry } from '../types'

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

function makeEntries(
  months: string[],
  baseValue: number,
  increments: number[],
): AccountEntry[] {
  let value = baseValue
  return months.map((yearMonth, i) => {
    if (i > 0) value += increments[i - 1]
    return {
      id: crypto.randomUUID(),
      yearMonth,
      value: Math.round(value * 100) / 100,
      uploadedAt: new Date().toISOString(),
      sourceFilename: 'demo-data',
    }
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

  const accounts: Account[] = [
    {
      id: crypto.randomUUID(),
      name: 'TFSA',
      type: 'TFSA',
      institution: 'Wealthsimple',
      color: ACCOUNT_COLORS[0],
      entries: makeEntries(months, 42000, [980, 1150, 870, 1220, 1050]),
    },
    {
      id: crypto.randomUUID(),
      name: 'RRSP',
      type: 'RRSP',
      institution: 'Wealthsimple',
      color: ACCOUNT_COLORS[1],
      entries: makeEntries(months, 28000, [1680, 1520, 1890, 1750, 1620]),
    },
    {
      id: crypto.randomUUID(),
      name: 'FHSA',
      type: 'FHSA',
      institution: 'Wealthsimple',
      color: ACCOUNT_COLORS[2],
      entries: makeEntries(months, 5000, [420, 510, 480, 550, 460]),
    },
    {
      id: crypto.randomUUID(),
      name: 'Non-Registered',
      type: 'Non-Registered',
      institution: 'Questrade',
      color: ACCOUNT_COLORS[3],
      entries: makeEntries(months, 15000, [380, 620, 450, 710, 530]),
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
