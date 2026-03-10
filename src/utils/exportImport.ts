import { AppData } from '../types'

export const exportData = (data: AppData): void => {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finance-tracker-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const parseImportFile = (file: File): Promise<AppData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target!.result as string) as AppData
        if (!data.accounts || !Array.isArray(data.accounts)) {
          throw new Error('Invalid file format: missing accounts array')
        }
        // Migrate legacy exports
        if (!data.creditCardAccounts) data.creditCardAccounts = []
        if (!data.cashFlowConfig) data.cashFlowConfig = { incomeRecords: [], fixedExpenses: [], ccAdjustments: [] }
        if (!data.cashFlowConfig.ccAdjustments) data.cashFlowConfig.ccAdjustments = []
        resolve(data)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
