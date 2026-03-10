import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { Account, AccountEntry, AccountType, AppData, CreditCardAccount, CreditCardEntry, IncomeRecord, FixedExpense, CCAdjustment } from '../types'
import { loadData, saveData } from '../utils/storage'

const ACCOUNT_COLORS = [
  '#00d395',
  '#5B8AF5',
  '#F5A623',
  '#BD10E0',
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#F8BBD9',
  '#80DEEA',
  '#FFAB91',
]

function pickColor(usedColors: string[], index: number): string {
  return ACCOUNT_COLORS.find((c) => !usedColors.includes(c)) ?? ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]
}

function makeEntry(entry: Omit<AccountEntry, 'id' | 'uploadedAt'>): AccountEntry {
  return { ...entry, id: crypto.randomUUID(), uploadedAt: new Date().toISOString() }
}

function makeCCEntry(entry: Omit<CreditCardEntry, 'id' | 'uploadedAt'>): CreditCardEntry {
  return { ...entry, id: crypto.randomUUID(), uploadedAt: new Date().toISOString() }
}

interface NewAccountData {
  name: string
  type: AccountType
  institution: string
  institutionId?: string
  accountNumber?: string
}

interface NewCreditCardAccountData {
  name: string
  institution: string
  institutionId?: string
  accountNumber?: string
}

interface FinanceContextValue {
  data: AppData
  addAccount: (data: NewAccountData) => void
  deleteAccount: (id: string) => void
  addEntry: (accountId: string, entry: Omit<AccountEntry, 'id' | 'uploadedAt'>) => void
  /** Create a new account and immediately add an entry — atomic single state update */
  addAccountWithEntry: (
    account: NewAccountData,
    entry: Omit<AccountEntry, 'id' | 'uploadedAt'>,
  ) => void
  deleteEntry: (accountId: string, entryId: string) => void
  replaceData: (data: AppData) => void
  // Credit card methods
  addCreditCardAccount: (data: NewCreditCardAccountData) => void
  deleteCreditCardAccount: (id: string) => void
  addCreditCardEntry: (accountId: string, entry: Omit<CreditCardEntry, 'id' | 'uploadedAt'>) => void
  addCreditCardAccountWithEntry: (
    account: NewCreditCardAccountData,
    entry: Omit<CreditCardEntry, 'id' | 'uploadedAt'>,
  ) => void
  deleteCreditCardEntry: (accountId: string, entryId: string) => void
  // Cash flow methods
  addIncomeRecord: (record: Omit<IncomeRecord, 'id'>) => void
  updateIncomeRecord: (id: string, record: Omit<IncomeRecord, 'id'>) => void
  deleteIncomeRecord: (id: string) => void
  addFixedExpense: (expense: Omit<FixedExpense, 'id'>) => void
  updateFixedExpense: (id: string, expense: Omit<FixedExpense, 'id'>) => void
  deleteFixedExpense: (id: string) => void
  addCCAdjustment: (adj: Omit<CCAdjustment, 'id'>) => void
  deleteCCAdjustment: (id: string) => void
  hasUnsavedChanges: boolean
  markExported: () => void
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

const DIRTY_KEY = 'finance-tracker-dirty'

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(loadData)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(() => localStorage.getItem(DIRTY_KEY) === '1')
  const isInitialMount = useRef(true)

  useEffect(() => {
    saveData(data)
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    setHasUnsavedChanges(true)
    localStorage.setItem(DIRTY_KEY, '1')
  }, [data])

  const markExported = useCallback(() => {
    setHasUnsavedChanges(false)
    localStorage.removeItem(DIRTY_KEY)
  }, [])

  const addAccount = useCallback((accountData: NewAccountData) => {
    setData((prev) => {
      const color = pickColor(prev.accounts.map((a) => a.color), prev.accounts.length)
      const account: Account = {
        id: crypto.randomUUID(),
        name: accountData.name,
        type: accountData.type,
        institution: accountData.institution,
        institutionId: accountData.institutionId,
        accountNumber: accountData.accountNumber,
        color,
        entries: [],
      }
      return { ...prev, accounts: [...prev.accounts, account] }
    })
  }, [])

  const deleteAccount = useCallback((id: string) => {
    setData((prev) => ({ ...prev, accounts: prev.accounts.filter((a) => a.id !== id) }))
  }, [])

  const addEntry = useCallback(
    (accountId: string, entry: Omit<AccountEntry, 'id' | 'uploadedAt'>) => {
      setData((prev) => ({
        ...prev,
        accounts: prev.accounts.map((a) => {
          if (a.id !== accountId) return a
          const filtered = a.entries.filter((e) => e.yearMonth !== entry.yearMonth)
          return {
            ...a,
            entries: [...filtered, makeEntry(entry)].sort((x, y) =>
              x.yearMonth.localeCompare(y.yearMonth),
            ),
          }
        }),
      }))
    },
    [],
  )

  const addAccountWithEntry = useCallback(
    (accountData: NewAccountData, entry: Omit<AccountEntry, 'id' | 'uploadedAt'>) => {
      setData((prev) => {
        const color = pickColor(prev.accounts.map((a) => a.color), prev.accounts.length)
        const newAccount: Account = {
          id: crypto.randomUUID(),
          name: accountData.name,
          type: accountData.type,
          institution: accountData.institution,
          institutionId: accountData.institutionId,
          accountNumber: accountData.accountNumber,
          color,
          entries: [makeEntry(entry)],
        }
        return { ...prev, accounts: [...prev.accounts, newAccount] }
      })
    },
    [],
  )

  const deleteEntry = useCallback((accountId: string, entryId: string) => {
    setData((prev) => ({
      ...prev,
      accounts: prev.accounts.map((a) => {
        if (a.id !== accountId) return a
        return { ...a, entries: a.entries.filter((e) => e.id !== entryId) }
      }),
    }))
  }, [])

  const replaceData = useCallback((newData: AppData) => {
    setData(newData)
  }, [])

  // ─── Credit card methods ───────────────────────────────────────────────────

  const addCreditCardAccount = useCallback((accountData: NewCreditCardAccountData) => {
    setData((prev) => {
      const allColors = [
        ...prev.accounts.map((a) => a.color),
        ...prev.creditCardAccounts.map((a) => a.color),
      ]
      const color = pickColor(allColors, prev.creditCardAccounts.length)
      const account: CreditCardAccount = {
        id: crypto.randomUUID(),
        name: accountData.name,
        institution: accountData.institution,
        institutionId: accountData.institutionId,
        accountNumber: accountData.accountNumber,
        color,
        entries: [],
      }
      return { ...prev, creditCardAccounts: [...prev.creditCardAccounts, account] }
    })
  }, [])

  const deleteCreditCardAccount = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      creditCardAccounts: prev.creditCardAccounts.filter((a) => a.id !== id),
    }))
  }, [])

  const addCreditCardEntry = useCallback(
    (accountId: string, entry: Omit<CreditCardEntry, 'id' | 'uploadedAt'>) => {
      setData((prev) => ({
        ...prev,
        creditCardAccounts: prev.creditCardAccounts.map((a) => {
          if (a.id !== accountId) return a
          // Replace entry with same statementEndDate
          const filtered = a.entries.filter((e) => e.statementEndDate !== entry.statementEndDate)
          return {
            ...a,
            entries: [...filtered, makeCCEntry(entry)].sort((x, y) =>
              x.statementEndDate.localeCompare(y.statementEndDate),
            ),
          }
        }),
      }))
    },
    [],
  )

  const addCreditCardAccountWithEntry = useCallback(
    (accountData: NewCreditCardAccountData, entry: Omit<CreditCardEntry, 'id' | 'uploadedAt'>) => {
      setData((prev) => {
        const allColors = [
          ...prev.accounts.map((a) => a.color),
          ...prev.creditCardAccounts.map((a) => a.color),
        ]
        const color = pickColor(allColors, prev.creditCardAccounts.length)
        const newAccount: CreditCardAccount = {
          id: crypto.randomUUID(),
          name: accountData.name,
          institution: accountData.institution,
          institutionId: accountData.institutionId,
          accountNumber: accountData.accountNumber,
          color,
          entries: [makeCCEntry(entry)],
        }
        return { ...prev, creditCardAccounts: [...prev.creditCardAccounts, newAccount] }
      })
    },
    [],
  )

  const deleteCreditCardEntry = useCallback((accountId: string, entryId: string) => {
    setData((prev) => ({
      ...prev,
      creditCardAccounts: prev.creditCardAccounts.map((a) => {
        if (a.id !== accountId) return a
        return { ...a, entries: a.entries.filter((e) => e.id !== entryId) }
      }),
    }))
  }, [])

  // ─── Cash flow methods ────────────────────────────────────────────────────

  const addIncomeRecord = useCallback((record: Omit<IncomeRecord, 'id'>) => {
    setData((prev) => ({
      ...prev,
      cashFlowConfig: {
        ...prev.cashFlowConfig,
        incomeRecords: [...prev.cashFlowConfig.incomeRecords, { ...record, id: crypto.randomUUID() }],
      },
    }))
  }, [])

  const updateIncomeRecord = useCallback((id: string, record: Omit<IncomeRecord, 'id'>) => {
    setData((prev) => ({
      ...prev,
      cashFlowConfig: {
        ...prev.cashFlowConfig,
        incomeRecords: prev.cashFlowConfig.incomeRecords.map((r) =>
          r.id === id ? { ...record, id } : r,
        ),
      },
    }))
  }, [])

  const deleteIncomeRecord = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      cashFlowConfig: {
        ...prev.cashFlowConfig,
        incomeRecords: prev.cashFlowConfig.incomeRecords.filter((r) => r.id !== id),
      },
    }))
  }, [])

  const addFixedExpense = useCallback((expense: Omit<FixedExpense, 'id'>) => {
    setData((prev) => ({
      ...prev,
      cashFlowConfig: {
        ...prev.cashFlowConfig,
        fixedExpenses: [...prev.cashFlowConfig.fixedExpenses, { ...expense, id: crypto.randomUUID() }],
      },
    }))
  }, [])

  const updateFixedExpense = useCallback((id: string, expense: Omit<FixedExpense, 'id'>) => {
    setData((prev) => ({
      ...prev,
      cashFlowConfig: {
        ...prev.cashFlowConfig,
        fixedExpenses: prev.cashFlowConfig.fixedExpenses.map((e) =>
          e.id === id ? { ...expense, id } : e,
        ),
      },
    }))
  }, [])

  const deleteFixedExpense = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      cashFlowConfig: {
        ...prev.cashFlowConfig,
        fixedExpenses: prev.cashFlowConfig.fixedExpenses.filter((e) => e.id !== id),
      },
    }))
  }, [])

  const addCCAdjustment = useCallback((adj: Omit<CCAdjustment, 'id'>) => {
    setData((prev) => ({
      ...prev,
      cashFlowConfig: {
        ...prev.cashFlowConfig,
        ccAdjustments: [...prev.cashFlowConfig.ccAdjustments, { ...adj, id: crypto.randomUUID() }],
      },
    }))
  }, [])

  const deleteCCAdjustment = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      cashFlowConfig: {
        ...prev.cashFlowConfig,
        ccAdjustments: prev.cashFlowConfig.ccAdjustments.filter((a) => a.id !== id),
      },
    }))
  }, [])

  return (
    <FinanceContext.Provider
      value={{
        data,
        addAccount,
        deleteAccount,
        addEntry,
        addAccountWithEntry,
        deleteEntry,
        replaceData,
        addCreditCardAccount,
        deleteCreditCardAccount,
        addCreditCardEntry,
        addCreditCardAccountWithEntry,
        deleteCreditCardEntry,
        addIncomeRecord,
        updateIncomeRecord,
        deleteIncomeRecord,
        addFixedExpense,
        updateFixedExpense,
        deleteFixedExpense,
        addCCAdjustment,
        deleteCCAdjustment,
        hasUnsavedChanges,
        markExported,
      }}
    >
      {children}
    </FinanceContext.Provider>
  )
}

export const useFinance = (): FinanceContextValue => {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider')
  return ctx
}
