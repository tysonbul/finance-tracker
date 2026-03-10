export type AccountType =
  | 'TFSA'
  | 'FHSA'
  | 'RRSP'
  | 'RRIF'
  | 'LIRA'
  | 'Non-Registered'
  | 'Pension'
  | 'Cash'
  | 'Other'

export interface AccountEntry {
  id: string
  yearMonth: string // 'YYYY-MM'
  value: number
  uploadedAt: string // ISO timestamp
  sourceFilename: string
}

export interface Account {
  id: string
  name: string
  type: AccountType
  institution: string
  institutionId?: string  // normalized e.g. 'wealthsimple'
  accountNumber?: string  // for matching across uploads
  color: string
  entries: AccountEntry[]
}

export interface CreditCardEntry {
  id: string
  statementEndDate: string // 'YYYY-MM-DD'
  balance: number
  uploadedAt: string // ISO timestamp
  sourceFilename: string
}

export interface CreditCardAccount {
  id: string
  name: string
  institution: string
  institutionId?: string
  accountNumber?: string
  color: string
  entries: CreditCardEntry[]
}

export type ExpenseFrequency = 'monthly' | 'bi-weekly' | 'yearly'

export interface IncomeRecord {
  id: string
  name: string              // e.g. "Salary - Acme Corp"
  amount: number            // raw amount at the given frequency
  frequency: ExpenseFrequency
  startDate: string         // 'YYYY-MM'
  endDate: string | null    // 'YYYY-MM' or null = ongoing
}

export interface FixedExpense {
  id: string
  name: string
  amount: number            // raw amount at the given frequency
  frequency: ExpenseFrequency
  isOnCreditCard: boolean
  startDate: string         // 'YYYY-MM'
  endDate: string | null    // 'YYYY-MM' or null = ongoing
}

export interface CCAdjustment {
  id: string
  month: string             // 'YYYY-MM'
  amount: number            // positive = amount to subtract from CC total
  name: string              // e.g. "Toronto work trip"
}

export interface CashFlowConfig {
  incomeRecords: IncomeRecord[]
  fixedExpenses: FixedExpense[]
  ccAdjustments: CCAdjustment[]
}

export interface AppData {
  accounts: Account[]
  creditCardAccounts: CreditCardAccount[]
  cashFlowConfig: CashFlowConfig
  version: number
}

export interface PdfCandidate {
  value: number
  context: string
  score: number
}

/** Result of smart PDF parsing — institution-specific when detected */
export interface ParsedStatement {
  institution: string | null
  institutionId: string | null       // 'wealthsimple' etc.
  institutionConfidence: 'high' | 'low'
  accountType: AccountType | null
  accountTypeLabel: string | null    // e.g. "Self-directed TFSA Account"
  accountNumber: string | null
  yearMonth: string | null           // 'YYYY-MM'
  periodLabel: string | null         // e.g. "January 2026"
  value: number | null
  valueContext: string | null        // surrounding text for user to verify
  candidates: PdfCandidate[]         // all dollar amounts found, for fallback
}

/** Result of credit card PDF parsing */
export interface ParsedCreditCardStatement {
  institution: string | null
  institutionId: string | null
  institutionConfidence: 'high' | 'low'
  accountNumber: string | null
  statementEndDate: string | null    // 'YYYY-MM-DD'
  statementEndDateLabel: string | null
  balance: number | null             // amount due / new balance
  balanceContext: string | null
  candidates: PdfCandidate[]
}
