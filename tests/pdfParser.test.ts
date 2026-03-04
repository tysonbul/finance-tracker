/**
 * PDF Parser Integration Tests
 *
 * Uses real PDF files from samples/ to verify institution detection and
 * field extraction. Tests are skipped gracefully when samples/ is absent
 * (the directory is gitignored — add your own PDFs to run these tests).
 *
 * Directory layout expected:
 *   samples/Rogers/CreditMC/       — Rogers Bank Mastercard statements
 *   samples/Wealthsimple/Credit/   — Wealthsimple credit card statements
 *   samples/Wealthsimple/TFSA/
 *   samples/Wealthsimple/FHSA/
 *   samples/Wealthsimple/RRSP/
 *   samples/Wealthsimple/LIRA/
 *   samples/Wealthsimple/Non-Registered/
 *   samples/Wealthsimple/Chequing/
 *   samples/Wealthsimple/Crypto/
 */

import { describe, test, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractTextFromPdf } from './helpers/extractText'
import {
  isCreditCardText,
  isWealthsimple,
  isWealthsimpleCredit,
  parseRogers,
  parseWealthsimple,
  parseWealthsimpleCredit,
} from '../src/utils/pdfParser'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const SAMPLES = join(ROOT, 'samples')

const hasSamples = existsSync(SAMPLES)

/** Returns absolute paths to all PDFs in a sub-directory of samples/. */
function pdfs(subdir: string): string[] {
  const dir = join(SAMPLES, subdir)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((f) => join(dir, f))
    .sort()
}

/** Short display name for test.each labels. */
function label(filePath: string): string {
  return filePath.replace(SAMPLES + '/', '')
}

// ─── Rogers Bank Credit Card ──────────────────────────────────────────────────

describe.skipIf(!hasSamples)('Rogers Bank — Credit Card (CreditMC)', () => {
  const files = pdfs('Rogers/CreditMC')

  test.each(files.map((f) => [label(f), f]))(
    '%s',
    async (_label, filePath) => {
      const text = await extractTextFromPdf(filePath)

      // Institution detection
      expect(isCreditCardText(text), 'should be detected as credit card').toBe(true)
      expect(isWealthsimple(text), 'should NOT be detected as Wealthsimple').toBe(false)

      // Parser output
      const result = parseRogers(text)
      expect(result.institutionId).toBe('rogers')
      expect(result.institutionConfidence).toBe('high')

      expect(
        result.statementEndDate,
        `statementEndDate is null — check "Statement Period" pattern in: ${filePath}`,
      ).not.toBeNull()
      expect(result.statementEndDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      expect(
        result.balance,
        `balance is null — check "New Balance" / "Amount Due" pattern in: ${filePath}`,
      ).not.toBeNull()
      expect(result.balance).toBeGreaterThan(0)
    },
  )
})

// ─── Rogers Bank — batch consistency ─────────────────────────────────────────
//
// All statements for the same card must parse the same accountNumber so that
// findMatchingCCAccount() can de-duplicate them during a bulk upload.
// A mismatch here is what causes multiple CC account records to be created.

describe.skipIf(!hasSamples)('Rogers Bank — account number consistency', () => {
  const files = pdfs('Rogers/CreditMC')

  test.skipIf(files.length < 2)(
    'all statements share the same non-null accountNumber',
    async () => {
      const results = await Promise.all(
        files.map(async (filePath) => {
          const text = await extractTextFromPdf(filePath)
          return parseRogers(text)
        }),
      )

      const accountNumbers = results.map((r) => r.accountNumber)
      expect(
        accountNumbers.every((n) => n !== null),
        `Expected all statements to have a parseable accountNumber.\n` +
          `Got: ${JSON.stringify(accountNumbers)}\n` +
          `Check the "Account Number" regex in parseRogers().`,
      ).toBe(true)

      const unique = new Set(accountNumbers)
      expect(
        unique.size,
        `Expected 1 unique accountNumber across all statements, got ${unique.size}: ` +
          `[${[...unique].join(', ')}]\n` +
          `Mismatched account numbers will cause duplicate CC accounts on bulk upload.`,
      ).toBe(1)
    },
  )
})

// ─── Wealthsimple Credit Card ─────────────────────────────────────────────────

describe.skipIf(!hasSamples)('Wealthsimple — Credit Card', () => {
  const files = pdfs('Wealthsimple/Credit')

  test.each(files.map((f) => [label(f), f]))(
    '%s',
    async (_label, filePath) => {
      const text = await extractTextFromPdf(filePath)

      // Institution detection
      expect(isCreditCardText(text), 'should be detected as credit card').toBe(true)
      expect(isWealthsimpleCredit(text), 'should be detected as Wealthsimple credit').toBe(true)

      // Parser output
      const result = parseWealthsimpleCredit(text)
      expect(result.institutionId).toBe('wealthsimple-credit')
      expect(result.institutionConfidence).toBe('high')

      expect(
        result.statementEndDate,
        `statementEndDate is null — check period range pattern in: ${filePath}`,
      ).not.toBeNull()
      expect(result.statementEndDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)

      expect(
        result.balance,
        `balance is null — check "STATEMENT BALANCE" / "New balance" pattern in: ${filePath}`,
      ).not.toBeNull()
      expect(result.balance).toBeGreaterThan(0)
    },
  )
})

// ─── Wealthsimple Investment / Cash Accounts ─────────────────────────────────

/**
 * Generic helper for all Wealthsimple savings/investment statement tests.
 * expectedType: the AccountType string we expect the parser to return.
 */
function wsAccountSuite(
  subdir: string,
  expectedType: string,
) {
  describe.skipIf(!hasSamples)(`Wealthsimple — ${subdir}`, () => {
    const files = pdfs(`Wealthsimple/${subdir}`)

    test.each(files.map((f) => [label(f), f]))(
      '%s',
      async (_label, filePath) => {
        const text = await extractTextFromPdf(filePath)

        // Institution detection — must be Wealthsimple savings, not credit
        expect(isWealthsimple(text), 'should be detected as Wealthsimple').toBe(true)
        expect(isCreditCardText(text), 'should NOT be detected as credit card').toBe(false)

        // Parser output
        const result = parseWealthsimple(text)
        expect(result.institutionId).toBe('wealthsimple')
        expect(result.institutionConfidence).toBe('high')

        expect(
          result.accountType,
          `accountType is null (expected "${expectedType}") — ` +
            `no WS_ACCOUNT_TYPES pattern matched. Check text in: ${filePath}`,
        ).toBe(expectedType)

        expect(
          result.yearMonth,
          `yearMonth is null — check period pattern in: ${filePath}`,
        ).not.toBeNull()
        expect(result.yearMonth).toMatch(/^\d{4}-\d{2}$/)

        expect(
          result.value,
          `value is null — check "Total Portfolio" / balance pattern in: ${filePath}`,
        ).not.toBeNull()
        expect(result.value).toBeGreaterThanOrEqual(0) // $0 balance is valid (e.g. new account)
      },
    )
  })
}

wsAccountSuite('TFSA', 'TFSA')
wsAccountSuite('FHSA', 'FHSA')
wsAccountSuite('RRSP', 'RRSP')
wsAccountSuite('LIRA', 'LIRA')           // will fail if AccountType / WS_ACCOUNT_TYPES lacks LIRA
wsAccountSuite('Non-Registered', 'Non-Registered')
wsAccountSuite('Chequing', 'Cash')
wsAccountSuite('Crypto', 'Other')
