import { AppData } from '../types'

const STORAGE_KEY = 'finance-tracker-v1'

const DEFAULT_CASH_FLOW_CONFIG: AppData['cashFlowConfig'] = {
  incomeRecords: [],
  fixedExpenses: [],
  ccAdjustments: [],
}

export const loadData = (): AppData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { accounts: [], creditCardAccounts: [], cashFlowConfig: DEFAULT_CASH_FLOW_CONFIG, version: 1 }
    const parsed = JSON.parse(raw) as AppData
    // Migrate legacy data
    if (!parsed.creditCardAccounts) parsed.creditCardAccounts = []
    if (!parsed.cashFlowConfig) parsed.cashFlowConfig = { ...DEFAULT_CASH_FLOW_CONFIG }
    if (!parsed.cashFlowConfig.ccAdjustments) parsed.cashFlowConfig.ccAdjustments = []
    return parsed
  } catch {
    return { accounts: [], creditCardAccounts: [], cashFlowConfig: DEFAULT_CASH_FLOW_CONFIG, version: 1 }
  }
}

export const saveData = (data: AppData): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
