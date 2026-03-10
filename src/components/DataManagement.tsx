import { useState, useRef } from 'react'
import { Download, Upload, AlertTriangle, CheckCircle, Trash2, Play } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { exportData, parseImportFile } from '../utils/exportImport'
import { generateDemoData } from '../utils/demoData'
import { AppData } from '../types'

export default function DataManagement() {
  const { data, replaceData, markExported, hasUnsavedChanges } = useFinance()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [importMsg, setImportMsg] = useState('')
  const [pendingImport, setPendingImport] = useState<AppData | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDemo, setConfirmDemo] = useState(false)

  const handleClearData = () => {
    replaceData({ accounts: [], creditCardAccounts: [], cashFlowConfig: { incomeRecords: [], fixedExpenses: [], ccAdjustments: [] }, version: 1 })
    setConfirmClear(false)
  }

  const handleExport = () => {
    exportData(data)
    markExported()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    try {
      const parsed = await parseImportFile(file)
      setPendingImport(parsed)
    } catch (err) {
      setImportStatus('error')
      setImportMsg(err instanceof Error ? err.message : 'Failed to read file')
    }
  }

  const handleConfirmImport = () => {
    if (!pendingImport) return
    replaceData(pendingImport)
    setPendingImport(null)
    setImportStatus('success')
    setImportMsg(
      `Imported ${pendingImport.accounts.length} account${pendingImport.accounts.length !== 1 ? 's' : ''}`,
    )
    setTimeout(() => setImportStatus('idle'), 4000)
  }

  const totalEntries = data.accounts.reduce((sum, a) => sum + a.entries.length, 0)

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">Data</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {data.accounts.length} accounts · {totalEntries} entries
        </p>
      </div>

      {/* Local storage info */}
      <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-1">Storage</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          All data is stored locally in your browser and is never sent to any server.
          This means your data can be lost if you clear your browser data or switch devices.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          To keep your data safe, regularly export it and save the file to cloud storage
          (e.g. iCloud, Google Drive, Dropbox). You can re-import the file at any time to
          restore your data.
        </p>
      </div>

      {/* Demo Data */}
      <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Demo Data</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Load sample data to explore the app. This will{' '}
              <strong className="text-yellow-400">replace</strong> all current data.
            </p>
          </div>
          {!confirmDemo ? (
            <button
              onClick={() => setConfirmDemo(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1e2235] text-sm text-gray-300 hover:text-white hover:bg-[#1a1e2e] transition-all self-start sm:self-auto sm:shrink-0"
            >
              <Play size={14} />
              Load Demo Data
            </button>
          ) : (
            <div className="flex gap-2 self-start sm:self-auto sm:shrink-0">
              <button
                onClick={() => setConfirmDemo(false)}
                className="px-3 py-2 rounded-lg border border-[#1e2235] text-xs text-gray-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  replaceData(generateDemoData())
                  setConfirmDemo(false)
                }}
                className="px-3 py-2 rounded-lg bg-yellow-500 text-[#0a0d14] text-xs font-semibold hover:bg-yellow-400 transition-all"
              >
                Replace &amp; Load Demo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Export */}
      <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Export Data</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Download all your accounts and history as a JSON file. Use this to back up your
              data or transfer it to another device.
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={data.accounts.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-app-accent text-[#0a0d14] text-sm font-semibold hover:bg-app-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed self-start sm:self-auto sm:shrink-0"
          >
            <Download size={14} />
            Export
          </button>
        </div>
        {hasUnsavedChanges && (
          <div className="flex items-center gap-2 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400/90">
            <AlertTriangle size={13} className="shrink-0" />
            Data has changed since your last export. Export to keep your backup up to date.
          </div>
        )}
      </div>

      {/* Import */}
      <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Import Data</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Load a previously exported JSON file. This will{' '}
              <strong className="text-yellow-400">replace</strong> all current data.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1e2235] text-sm text-gray-300 hover:text-white hover:bg-[#1a1e2e] transition-all self-start sm:self-auto sm:shrink-0"
          >
            <Upload size={14} />
            Choose File
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Status messages */}
        {importStatus === 'success' && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-sm text-emerald-400">
            <CheckCircle size={14} />
            {importMsg}
          </div>
        )}
        {importStatus === 'error' && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            <AlertTriangle size={14} />
            {importMsg}
          </div>
        )}

        {/* Pending import confirmation */}
        {pendingImport && (
          <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-400">Ready to Import</p>
                <p className="text-xs text-yellow-400/70 mt-0.5">
                  Found {pendingImport.accounts.length} accounts with{' '}
                  {pendingImport.accounts.reduce((s, a) => s + a.entries.length, 0)} entries.
                  This will replace your current data.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingImport(null)}
                className="flex-1 px-3 py-2 rounded-lg border border-[#1e2235] text-xs text-gray-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                className="flex-1 px-3 py-2 rounded-lg bg-yellow-500 text-[#0a0d14] text-xs font-semibold hover:bg-yellow-400 transition-all"
              >
                Confirm Import
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Clear Data */}
      <div className="bg-[#12151f] border border-red-500/20 rounded-2xl p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Clear All Data</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Permanently delete all accounts and history. Export first if you want a backup.
            </p>
          </div>
          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              disabled={data.accounts.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-sm text-red-400 hover:bg-red-500/10 transition-all self-start sm:self-auto sm:shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} />
              Clear
            </button>
          ) : (
            <div className="flex gap-2 self-start sm:self-auto sm:shrink-0">
              <button
                onClick={() => setConfirmClear(false)}
                className="px-3 py-2 rounded-lg border border-[#1e2235] text-xs text-gray-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleClearData}
                className="px-3 py-2 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-400 transition-all"
              >
                Delete Everything
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
