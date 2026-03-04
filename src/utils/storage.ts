import { AppData } from '../types'

const STORAGE_KEY = 'finance-tracker-v1'

export const loadData = (): AppData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { accounts: [], version: 1 }
    return JSON.parse(raw) as AppData
  } catch {
    return { accounts: [], version: 1 }
  }
}

export const saveData = (data: AppData): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
