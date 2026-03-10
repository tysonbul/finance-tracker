import { CreditCardAccount, FixedExpense, IncomeRecord, CCAdjustment, ExpenseFrequency } from '../types'

export interface MonthlyCashFlow {
  month: string
  income: number
  fixedNonCC: number
  fixedCC: number
  ccStatementTotal: number
  ccAdjustments: number
  adjustedCCTotal: number
  variableCCSpend: number
  totalOutflow: number
  netCashFlow: number
}

export function normalizeToMonthly(amount: number, frequency: ExpenseFrequency): number {
  switch (frequency) {
    case 'monthly': return amount
    case 'bi-weekly': return (26 * amount) / 12
    case 'yearly': return amount / 12
  }
}

export function isActiveForMonth(record: { startDate: string; endDate: string | null }, month: string): boolean {
  return record.startDate <= month && (record.endDate === null || record.endDate >= month)
}

export function computeMonthlyCashFlow(
  incomeRecords: IncomeRecord[],
  fixedExpenses: FixedExpense[],
  creditCardAccounts: CreditCardAccount[],
  ccAdjustments: CCAdjustment[],
): MonthlyCashFlow[] {
  const allMonths = [
    ...new Set(
      creditCardAccounts.flatMap((a) =>
        a.entries.map((e) => e.statementEndDate.slice(0, 7)),
      ),
    ),
  ].sort()

  if (allMonths.length === 0) return []

  return allMonths.map((month) => {
    // Income: sum of active income records (normalized to monthly)
    const income = incomeRecords
      .filter((r) => isActiveForMonth(r, month))
      .reduce((sum, r) => sum + normalizeToMonthly(r.amount, r.frequency), 0)

    // CC statement total (same logic as SpendDashboard)
    const ccStatementTotal = creditCardAccounts.reduce((sum, a) => {
      const entries = a.entries.filter((e) => e.statementEndDate.startsWith(month))
      entries.sort((x, y) => y.statementEndDate.localeCompare(x.statementEndDate))
      return sum + (entries[0]?.balance ?? 0)
    }, 0)

    // CC adjustments (reimbursements) for this month
    const adjustments = ccAdjustments
      .filter((a) => a.month === month)
      .reduce((sum, a) => sum + a.amount, 0)

    const adjustedCCTotal = Math.max(0, ccStatementTotal - adjustments)

    // Fixed expenses active this month
    const activeExpenses = fixedExpenses.filter((e) => isActiveForMonth(e, month))
    const fixedNonCC = activeExpenses
      .filter((e) => !e.isOnCreditCard)
      .reduce((sum, e) => sum + normalizeToMonthly(e.amount, e.frequency), 0)
    const fixedCC = activeExpenses
      .filter((e) => e.isOnCreditCard)
      .reduce((sum, e) => sum + normalizeToMonthly(e.amount, e.frequency), 0)

    const variableCCSpend = Math.max(0, adjustedCCTotal - fixedCC)
    const totalOutflow = fixedNonCC + adjustedCCTotal
    const netCashFlow = income - totalOutflow

    return {
      month,
      income,
      fixedNonCC,
      fixedCC,
      ccStatementTotal,
      ccAdjustments: adjustments,
      adjustedCCTotal,
      variableCCSpend,
      totalOutflow,
      netCashFlow,
    }
  })
}
