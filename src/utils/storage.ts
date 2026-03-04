import { AppData } from '../types'

const STORAGE_KEY = 'finance-tracker-v1'

export const loadData = (): AppData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { accounts: [], creditCardAccounts: [], version: 1 }
    const parsed = JSON.parse(raw) as AppData
    // Migrate legacy data that predates creditCardAccounts
    if (!parsed.creditCardAccounts) parsed.creditCardAccounts = []
    return parsed
  } catch {
    return { accounts: [], creditCardAccounts: [], version: 1 }
  }
}

export const saveData = (data: AppData): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
