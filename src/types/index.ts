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

export interface AppData {
  accounts: Account[]
  creditCardAccounts: CreditCardAccount[]
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
