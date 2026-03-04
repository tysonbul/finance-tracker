import { AccountType, ParsedStatement, ParsedCreditCardStatement, PdfCandidate } from '../types'

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
  { pattern: /Self-directed TFSA Account/i, type: 'TFSA', label: 'Self-directed TFSA Account' },
  { pattern: /Self-directed FHSA Account/i, type: 'FHSA', label: 'Self-directed FHSA Account' },
  { pattern: /Self-directed RRSP Account/i, type: 'RRSP', label: 'Self-directed RRSP Account' },
  { pattern: /Self-directed RRIF Account/i, type: 'RRIF', label: 'Self-directed RRIF Account' },
  { pattern: /Crypto Account/i, type: 'Other', label: 'Crypto Account' },
  { pattern: /Non-registered Account/i, type: 'Non-Registered', label: 'Non-registered Account' },
  { pattern: /Chequing (monthly )?statement/i, type: 'Cash', label: 'Chequing Account' },
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

function parseWealthsimple(text: string): ParsedStatement {
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
  }
}

// ─── Rogers credit card parser ────────────────────────────────────────────────

function parseRogers(text: string): ParsedCreditCardStatement {
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

function parseWealthsimpleCredit(text: string): ParsedCreditCardStatement {
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

function isCreditCardText(text: string): boolean {
  return (
    /rogers.*bank/i.test(text) ||
    /rogersbank\.com/i.test(text) ||
    isWealthsimpleCredit(text)
  )
}

export type AutoParseResult =
  | { kind: 'savings'; result: ParsedStatement }
  | { kind: 'credit'; result: ParsedCreditCardStatement }

// ─── Main exported functions ──────────────────────────────────────────────────

async function extractFullText(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

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

  if (/rogers.*bank/i.test(fullText) || /rogersbank\.com/i.test(fullText)) {
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
    if (/rogers.*bank/i.test(fullText) || /rogersbank\.com/i.test(fullText)) {
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
