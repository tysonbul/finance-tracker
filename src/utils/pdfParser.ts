import { AccountType, Holding, ParsedStatement, ParsedCreditCardStatement, PdfCandidate } from '../types'

// ─── Generic helpers ──────────────────────────────────────────────────────────

const DOLLAR_REGEX = /\$?\s*([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?)/g

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''))
}

function getContext(text: string, index: number, matchLen: number, radius = 120): string {
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + matchLen + radius)
  return text.slice(start, end).replace(/\s+/g, ' ').trim()
}

function genericCandidates(text: string): PdfCandidate[] {
  const KEYWORDS = [
    'total value', 'total market value', 'portfolio value', 'account value',
    'market value', 'total assets', 'net asset value', 'account balance',
    'closing value', 'ending value', 'ending balance', 'total portfolio',
    'portfolio total', 'total account',
  ]

  const candidates: PdfCandidate[] = []
  const seen = new Set<number>()

  DOLLAR_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = DOLLAR_REGEX.exec(text)) !== null) {
    const value = parseAmount(match[1])
    if (isNaN(value) || value <= 0 || seen.has(value)) continue
    seen.add(value)

    const context = getContext(text, match.index, match[0].length)
    const lower = context.toLowerCase()
    let score = 0
    if (KEYWORDS.some((kw) => lower.includes(kw))) score += 10
    if (value >= 1_000) score += 2
    if (value >= 10_000) score += 3
    if (value >= 100_000) score += 2
    if (value < 100) score -= 5
    if (value > 50_000_000) score -= 3
    candidates.push({ value, context, score })
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, 8)
}

// ─── Date parsing helper ──────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function parseWrittenDate(str: string): string | null {
  const m = str.trim().match(/([a-zA-Z]+)\s+(\d{1,2}),?\s*(\d{4})/)
  if (!m) return null
  const month = MONTH_MAP[m[1].toLowerCase().slice(0, 3)]
  if (!month) return null
  const day = parseInt(m[2])
  const year = parseInt(m[3])
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ─── Wealthsimple savings parser ──────────────────────────────────────────────

const WS_ACCOUNT_TYPES: { pattern: RegExp; type: AccountType; label: string }[] = [
  // Current Wealthsimple statement format: "[Type] SDI Cash Account"
  { pattern: /Tax-Free Savings SDI/i,        type: 'TFSA',           label: 'Tax-Free Savings Account' },
  { pattern: /First Home Savings SDI/i,      type: 'FHSA',           label: 'First Home Savings Account' },
  { pattern: /\bRRSP SDI\b/i,               type: 'RRSP',           label: 'RRSP Account' },
  { pattern: /\bRRIF SDI\b/i,               type: 'RRIF',           label: 'RRIF Account' },
  { pattern: /\bLIRA\b/i,                   type: 'LIRA',           label: 'LIRA Account' },
  { pattern: /Crypto Account/i,             type: 'Other',          label: 'Crypto Account' },
  { pattern: /Non-Registered SDI/i,         type: 'Non-Registered', label: 'Non-Registered Account' },
  { pattern: /Cash\s+monthly\s+statement/i, type: 'Cash',           label: 'Chequing Account' },
  // Legacy patterns (older statement format)
  { pattern: /Self-directed TFSA Account/i, type: 'TFSA',           label: 'Self-directed TFSA Account' },
  { pattern: /Self-directed FHSA Account/i, type: 'FHSA',           label: 'Self-directed FHSA Account' },
  { pattern: /Self-directed RRSP Account/i, type: 'RRSP',           label: 'Self-directed RRSP Account' },
  { pattern: /Self-directed RRIF Account/i, type: 'RRIF',           label: 'Self-directed RRIF Account' },
  { pattern: /Non-registered Account/i,     type: 'Non-Registered', label: 'Non-registered Account' },
  { pattern: /Chequing.*statement/i,        type: 'Cash',           label: 'Chequing Account' },
]

function isWealthsimple(text: string): boolean {
  return (
    /wealthsimple/i.test(text) ||
    (/ORDER EXECUTION ONLY ACCOUNT/i.test(text) && /Spadina/i.test(text))
  )
}

function isWealthsimpleCredit(text: string): boolean {
  return /wealthsimple/i.test(text) && /credit card statement/i.test(text)
}

// ─── Holdings parsers ─────────────────────────────────────────────────────────

/** Parse holdings from "Portfolio Assets" / "Portfolio Equities" table (investment accounts) */
export function parseInvestmentHoldings(text: string): Holding[] {
  // Newer format uses "Portfolio Assets", older uses "Portfolio Equities"
  let portfolioStart = text.indexOf('Portfolio Assets')
  if (portfolioStart === -1) portfolioStart = text.indexOf('Portfolio Equities')
  if (portfolioStart === -1) return []

  const endCandidates = ['*Book Cost', 'Stock Lending'].map(m => text.indexOf(m, portfolioStart + 20)).filter(i => i !== -1)
  const portfolioEnd = endCandidates.length > 0 ? Math.min(...endCandidates) : undefined
  const section = text.slice(portfolioStart, portfolioEnd)

  // Format variations across statement eras:
  //   Newest (Oct 2025+): SYMBOL qty(4dp) qty(4dp) qty(4dp) $price CURRENCY $value CURRENCY $cost CURRENCY
  //   Mid-2025:           SYMBOL qty(4dp) qty(4dp) qty(4dp) $price CURRENCY $value          $cost
  //   Oldest (early 2025): SYMBOL qty(4dp) qty(4dp)          $price CURRENCY $value          $cost
  // Strategy: match symbol + first qty(4dp), then flexibly consume remaining columns
  const regex = /\b([A-Z]{2,5})\s+([\d,]+\.\d{4})\s+[\d,]+\.\d{4}(?:\s+[\d,]+\.\d{4})?\s+\$?([\d,]+\.?\d*)\s*(CAD|USD)\s+\$?([\d,]+\.?\d*)\s*(?:CAD|USD)?\s+\$?([\d,]+\.?\d*)\s*(?:CAD|USD)?/g

  const holdings: Holding[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(section)) !== null) {
    const symbol = match[1]
    if (!/^[A-Z]{2,5}$/.test(symbol)) continue
    holdings.push({
      symbol,
      quantity: parseAmount(match[2]),
      marketPrice: parseAmount(match[3]),
      marketValue: parseAmount(match[5]),
      bookCost: parseAmount(match[6]),
      currency: match[4],
    })
  }
  return holdings
}

/** Parse holdings from "Crypto Portfolio" table (Crypto accounts) */
export function parseCryptoHoldings(text: string): Holding[] {
  const cryptoStart = text.indexOf('Crypto Portfolio')
  if (cryptoStart === -1) return []

  const endCandidates = ['*Book Cost', 'Activity'].map(m => text.indexOf(m, cryptoStart + 20)).filter(i => i !== -1)
  const portfolioEnd = endCandidates.length > 0 ? Math.min(...endCandidates) : undefined
  const section = text.slice(cryptoStart, portfolioEnd)

  // SYMBOL totalQty(10dp) segregatedQty(10dp) stakedQty(10dp) $price CURRENCY $value $cost
  const regex = /\b([A-Z]{2,6})\s+([\d,]+\.\d{10})\s+([\d,]+\.\d{10})\s+([\d,]+\.\d{10})\s+\$?([\d,]+\.?\d*)\s*(CAD|USD)\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)/g

  const holdings: Holding[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(section)) !== null) {
    const symbol = match[1]
    if (!/^[A-Z]{2,6}$/.test(symbol)) continue
    holdings.push({
      symbol,
      quantity: parseFloat(match[2].replace(/,/g, '')),
      marketPrice: parseAmount(match[5]),
      marketValue: parseAmount(match[7]),
      bookCost: parseAmount(match[8]),
      // Price currency (match[6]) is the asset's trading denomination (e.g. USD for ETH),
      // but Wealthsimple converts marketValue and bookCost to CAD for display
      currency: 'CAD',
    })
  }
  return holdings
}

/** Parse cash balance from the asset allocation summary at the top of the statement */
export function parseCashHolding(text: string): Holding | null {
  // Pattern: "Cash   $7,003.00   2.90   $7,003.00   4.84"
  // The first dollar amount after "Cash" is the market value
  const match = text.match(/\bCash\s+\$([\d,]+\.?\d*)\s+[\d.]+\s+\$([\d,]+\.?\d*)/)
  if (!match) return null
  const marketValue = parseAmount(match[1])
  if (marketValue <= 0) return null
  return {
    symbol: 'Cash',
    quantity: 1,
    marketPrice: marketValue,
    marketValue,
    bookCost: parseAmount(match[2]),
    currency: 'CAD',
  }
}

/** Try both investment and crypto holdings parsers, return whichever finds results */
function parseHoldings(text: string, accountType: AccountType | null, accountTypeLabel: string | null): Holding[] | undefined {
  try {
    // Skip Cash/Chequing — no holdings
    if (accountType === 'Cash') return undefined

    // Crypto accounts use a different table format
    if (accountType === 'Other' && /Crypto/i.test(accountTypeLabel ?? '')) {
      const holdings = parseCryptoHoldings(text)
      return holdings.length > 0 ? holdings : undefined
    }

    // Investment accounts
    const holdings = parseInvestmentHoldings(text)

    // Also parse the cash balance from the asset allocation summary
    const cashHolding = parseCashHolding(text)
    if (cashHolding) holdings.push(cashHolding)

    return holdings.length > 0 ? holdings : undefined
  } catch {
    // Holdings failure should never break value parsing
    return undefined
  }
}

export function parseWealthsimple(text: string): ParsedStatement {
  let accountType: AccountType | null = null
  let accountTypeLabel: string | null = null
  for (const { pattern, type, label } of WS_ACCOUNT_TYPES) {
    if (pattern.test(text)) {
      accountType = type
      accountTypeLabel = label
      break
    }
  }

  let accountNumber: string | null = null
  const investAcctMatch = text.match(/Account No\.\s+([A-Z0-9]{6,})/i)
  const cashAcctMatch = text.match(/Account number:\s+(\d{6,})/i)
  accountNumber = (investAcctMatch?.[1] ?? cashAcctMatch?.[1]) ?? null

  let yearMonth: string | null = null
  let periodLabel: string | null = null

  const isoPeriodMatch = text.match(/(\d{4}-\d{2})-\d{2}\s*-\s*(\d{4}-\d{2})-(\d{2})/)
  if (isoPeriodMatch) {
    yearMonth = isoPeriodMatch[2]
    const [y, m] = yearMonth.split('-')
    const d = new Date(parseInt(y), parseInt(m) - 1, 1)
    periodLabel = d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
  }

  if (!yearMonth) {
    const writtenPeriodMatch = text.match(
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^-]+-\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*(\d{4})/i,
    )
    if (writtenPeriodMatch) {
      const endPart = writtenPeriodMatch[0].split('-').pop()!.trim()
      const d = new Date(endPart)
      if (!isNaN(d.getTime())) {
        yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        periodLabel = d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
      }
    }
  }

  let value: number | null = null
  let valueContext: string | null = null

  const totalPortfolioMatch = text.match(/Total Portfolio\s+\$([\d,]+\.?\d*)/)
  if (totalPortfolioMatch) {
    value = parseAmount(totalPortfolioMatch[1])
    valueContext = getContext(text, totalPortfolioMatch.index!, totalPortfolioMatch[0].length, 150)
  }

  if (value === null) {
    const allMatches = [
      ...text.matchAll(
        /(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2}\s+BALANCE\s+\$([\d,]+\.?\d*)/gi,
      ),
    ]
    const lastMatch = allMatches[allMatches.length - 1]
    if (lastMatch) {
      value = parseAmount(lastMatch[1])
      valueContext = getContext(text, lastMatch.index!, lastMatch[0].length, 150)
    }
  }

  return {
    institution: 'Wealthsimple',
    institutionId: 'wealthsimple',
    institutionConfidence: 'high',
    accountType,
    accountTypeLabel,
    accountNumber,
    yearMonth,
    periodLabel,
    value,
    valueContext,
    candidates: genericCandidates(text),
    holdings: parseHoldings(text, accountType, accountTypeLabel),
  }
}

// ─── Rogers credit card parser ────────────────────────────────────────────────

export function parseRogers(text: string): ParsedCreditCardStatement {
  // End date from "Statement Period Dec 9, 2025 - Jan 8, 2026"
  let statementEndDate: string | null = null
  let statementEndDateLabel: string | null = null
  const periodMatch = text.match(
    /Statement Period\s+[A-Za-z]+\s+\d{1,2},?\s+\d{4}\s*[-–]\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
  )
  if (periodMatch) {
    statementEndDate = parseWrittenDate(periodMatch[1])
    statementEndDateLabel = periodMatch[1].trim()
  }

  // Balance: "New Balance   $1,627.49" or "Amount Due   $1,627.49"
  let balance: number | null = null
  let balanceContext: string | null = null
  const newBalanceMatch = text.match(/New Balance\s+\$?([\d,]+\.?\d*)/i)
  if (newBalanceMatch) {
    balance = parseAmount(newBalanceMatch[1])
    balanceContext = getContext(text, newBalanceMatch.index!, newBalanceMatch[0].length, 120)
  }
  if (balance === null) {
    const amtDueMatch = text.match(/Amount Due\s+\$?([\d,]+\.?\d*)/i)
    if (amtDueMatch) {
      balance = parseAmount(amtDueMatch[1])
      balanceContext = getContext(text, amtDueMatch.index!, amtDueMatch[0].length, 120)
    }
  }

  // Account number: "Account Number   XXXX XXXX XXXX 2616"
  let accountNumber: string | null = null
  const acctMatch = text.match(/Account Number\s+([X\d][\sX\d]{10,}[\d]{4})/i)
  if (acctMatch) {
    accountNumber = acctMatch[1].trim().replace(/\s+/g, ' ')
  }

  return {
    institution: 'Rogers Bank',
    institutionId: 'rogers',
    institutionConfidence: 'high',
    accountNumber,
    statementEndDate,
    statementEndDateLabel,
    balance,
    balanceContext,
    candidates: genericCandidates(text),
  }
}

// ─── Wealthsimple credit card parser ─────────────────────────────────────────

export function parseWealthsimpleCredit(text: string): ParsedCreditCardStatement {
  // End date from "Dec 25 — Jan 24, 2026" (em dash or en dash)
  let statementEndDate: string | null = null
  let statementEndDateLabel: string | null = null
  const periodMatch = text.match(
    /[A-Za-z]+\s+\d{1,2}\s*[—–-]+\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/,
  )
  if (periodMatch) {
    statementEndDate = parseWrittenDate(periodMatch[1])
    statementEndDateLabel = periodMatch[1].trim()
  }

  // Balance: "STATEMENT BAL ANCE  $2,086.31" (OCR space) or "New balance $2,086.31"
  let balance: number | null = null
  let balanceContext: string | null = null
  const stmtBalMatch = text.match(/STATEMENT\s+BAL\s*ANCE\s+\$?([\d,]+\.?\d*)/i)
  if (stmtBalMatch) {
    balance = parseAmount(stmtBalMatch[1])
    balanceContext = getContext(text, stmtBalMatch.index!, stmtBalMatch[0].length, 120)
  }
  if (balance === null) {
    const newBalMatch = text.match(/New\s+balance\s+\$?([\d,]+\.?\d*)/i)
    if (newBalMatch) {
      balance = parseAmount(newBalMatch[1])
      balanceContext = getContext(text, newBalMatch.index!, newBalMatch[0].length, 120)
    }
  }

  // Account number: "4126 50** **** 3956"
  let accountNumber: string | null = null
  const acctMatch = text.match(/(\d{4}\s+\d{2}\*\*\s+\*\*\*\*\s+\d{4})/)
  if (acctMatch) {
    accountNumber = acctMatch[1].trim()
  }

  return {
    institution: 'Wealthsimple',
    institutionId: 'wealthsimple-credit',
    institutionConfidence: 'high',
    accountNumber,
    statementEndDate,
    statementEndDateLabel,
    balance,
    balanceContext,
    candidates: genericCandidates(text),
  }
}

// ─── Auto-detect helper ───────────────────────────────────────────────────────

export { isWealthsimple, isWealthsimpleCredit }

function isRogersBank(text: string): boolean {
  // Require rogersbank.com domain OR "rogers bank" combined with a CC-specific phrase.
  // Plain "Rogers Bank" can appear as a bill-payment payee in chequing statements.
  return (
    /rogersbank\.com/i.test(text) ||
    (/rogers.*bank/i.test(text) && /new balance|statement period|minimum payment/i.test(text))
  )
}

export function isCreditCardText(text: string): boolean {
  return isRogersBank(text) || isWealthsimpleCredit(text)
}

export type AutoParseResult =
  | { kind: 'savings'; result: ParsedStatement }
  | { kind: 'credit'; result: ParsedCreditCardStatement }

// ─── Main exported functions ──────────────────────────────────────────────────

async function extractFullText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  const workerModule = await import('pdfjs-dist/build/pdf.worker.min.js?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pageParts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pageParts.push(content.items.map((item: any) => item.str).join(' '))
  }
  return pageParts.join('\n')
}

export async function parseStatement(file: File): Promise<ParsedStatement> {
  const fullText = await extractFullText(file)

  if (isWealthsimple(fullText) && !isWealthsimpleCredit(fullText)) {
    return parseWealthsimple(fullText)
  }

  const candidates = genericCandidates(fullText)
  const topCandidate = candidates[0] ?? null

  let yearMonth: string | null = null
  let periodLabel: string | null = null
  const monthMatch = fullText.match(
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
  )
  if (monthMatch) {
    const d = new Date(monthMatch[0])
    if (!isNaN(d.getTime())) {
      yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      periodLabel = d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
    }
  }

  return {
    institution: null,
    institutionId: null,
    institutionConfidence: 'low',
    accountType: null,
    accountTypeLabel: null,
    accountNumber: null,
    yearMonth,
    periodLabel,
    value: topCandidate?.value ?? null,
    valueContext: topCandidate?.context ?? null,
    candidates,
  }
}

export async function parseCreditCardStatement(file: File): Promise<ParsedCreditCardStatement> {
  const fullText = await extractFullText(file)

  if (isRogersBank(fullText)) {
    return parseRogers(fullText)
  }

  if (isWealthsimpleCredit(fullText)) {
    return parseWealthsimpleCredit(fullText)
  }

  // Generic fallback: try to find a statement period end date and top amount
  const candidates = genericCandidates(fullText)
  let statementEndDate: string | null = null
  let statementEndDateLabel: string | null = null

  const periodMatch = fullText.match(
    /[A-Za-z]+\s+\d{1,2},?\s+\d{4}\s*[-–—]+\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/,
  )
  if (periodMatch) {
    statementEndDate = parseWrittenDate(periodMatch[1])
    statementEndDateLabel = periodMatch[1].trim()
  }

  const topCandidate = candidates[0] ?? null
  return {
    institution: null,
    institutionId: null,
    institutionConfidence: 'low',
    accountNumber: null,
    statementEndDate,
    statementEndDateLabel,
    balance: topCandidate?.value ?? null,
    balanceContext: topCandidate?.context ?? null,
    candidates,
  }
}

/** Auto-detects statement type and parses accordingly. Use this for the global upload flow. */
export async function parseAuto(file: File): Promise<AutoParseResult> {
  const fullText = await extractFullText(file)

  if (isCreditCardText(fullText)) {
    if (isRogersBank(fullText)) {
      return { kind: 'credit', result: parseRogers(fullText) }
    }
    return { kind: 'credit', result: parseWealthsimpleCredit(fullText) }
  }

  if (isWealthsimple(fullText)) {
    return { kind: 'savings', result: parseWealthsimple(fullText) }
  }

  // Generic savings fallback
  const candidates = genericCandidates(fullText)
  const topCandidate = candidates[0] ?? null
  let yearMonth: string | null = null
  let periodLabel: string | null = null
  const monthMatch = fullText.match(
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}/i,
  )
  if (monthMatch) {
    const d = new Date(monthMatch[0])
    if (!isNaN(d.getTime())) {
      yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      periodLabel = d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
    }
  }
  return {
    kind: 'savings',
    result: {
      institution: null,
      institutionId: null,
      institutionConfidence: 'low',
      accountType: null,
      accountTypeLabel: null,
      accountNumber: null,
      yearMonth,
      periodLabel,
      value: topCandidate?.value ?? null,
      valueContext: topCandidate?.context ?? null,
      candidates,
    },
  }
}
