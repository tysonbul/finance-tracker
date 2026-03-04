import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Account, AccountEntry, AccountType, AppData } from '../types'
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

interface NewAccountData {
  name: string
  type: AccountType
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
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<AppData>(loadData)

  useEffect(() => {
    saveData(data)
  }, [data])

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

  return (
    <FinanceContext.Provider
      value={{ data, addAccount, deleteAccount, addEntry, addAccountWithEntry, deleteEntry, replaceData }}
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
