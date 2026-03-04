import { AccountType, ParsedStatement, PdfCandidate } from '../types'

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

// ─── Wealthsimple parser ──────────────────────────────────────────────────────

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

// ─── Main exported function ───────────────────────────────────────────────────

export async function parseStatement(file: File): Promise<ParsedStatement> {
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
  const fullText = pageParts.join('\n')

  if (isWealthsimple(fullText)) {
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
