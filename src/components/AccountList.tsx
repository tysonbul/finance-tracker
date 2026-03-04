import { useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { formatCurrencyFull, formatMonth } from '../utils/formatters'
import AddAccountModal from './AddAccountModal'
import UploadModal from './UploadModal'
import { Account } from '../types'

interface AccountListProps {
  onGoToAccount: (id: string) => void
}

export default function AccountList({ onGoToAccount }: AccountListProps) {
  const { data } = useFinance()
  const { accounts } = data
  const [showAdd, setShowAdd] = useState(false)
  const [uploadingAccount, setUploadingAccount] = useState<Account | null>(null)

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-app-accent text-[#0a0d14] text-sm font-semibold hover:bg-app-accent-hover transition-all"
        >
          <Plus size={15} />
          Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#12151f] border border-[#1e2235] flex items-center justify-center">
            <Plus size={20} className="text-gray-500" />
          </div>
          <div>
            <p className="text-base font-medium text-white">No accounts yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Add your financial accounts to start tracking
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-5 py-2.5 rounded-xl bg-app-accent text-[#0a0d14] text-sm font-semibold hover:bg-app-accent-hover transition-all"
          >
            Add Account
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => {
            const sorted = [...account.entries].sort((a, b) =>
              b.yearMonth.localeCompare(a.yearMonth),
            )
            const latest = sorted[0]
            const previous = sorted[1]
            const pctChange =
              latest && previous
                ? ((latest.value - previous.value) / previous.value) * 100
                : null

            return (
              <div
                key={account.id}
                className="flex items-center gap-4 p-5 bg-[#12151f] border border-[#1e2235] rounded-2xl hover:bg-[#1a1e2e] hover:border-[#2a3050] transition-all group cursor-pointer"
                onClick={() => onGoToAccount(account.id)}
              >
                {/* Color dot */}
                <div
                  className="w-1 h-10 rounded-full shrink-0"
                  style={{ background: account.color }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ background: `${account.color}1a`, color: account.color }}
                    >
                      {account.type}
                    </span>
                    <span className="text-xs text-gray-500">{account.institution}</span>
                  </div>
                  <p className="text-sm font-semibold text-white truncate group-hover:text-app-accent transition-colors">
                    {account.name}
                  </p>
                </div>

                {/* Stats */}
                <div className="text-right shrink-0">
                  {latest ? (
                    <>
                      <p className="text-sm font-bold font-mono text-white">
                        {formatCurrencyFull(latest.value)}
                      </p>
                      <div className="flex items-center justify-end gap-2 mt-0.5">
                        {pctChange !== null && (
                          <span
                            className={`text-[10px] font-semibold ${
                              pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {pctChange >= 0 ? '+' : ''}
                            {pctChange.toFixed(1)}%
                          </span>
                        )}
                        <span className="text-[10px] text-gray-600">
                          {formatMonth(latest.yearMonth)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-gray-600">No data</span>
                  )}
                </div>

                {/* Upload shortcut */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setUploadingAccount(account)
                  }}
                  className="p-2 rounded-lg border border-[#1e2235] text-gray-500 hover:text-app-accent hover:border-app-accent/40 hover:bg-app-accent-dim transition-all opacity-0 group-hover:opacity-100 shrink-0"
                  title="Upload statement"
                >
                  <Upload size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} />}
      {uploadingAccount && (
        <UploadModal account={uploadingAccount} onClose={() => setUploadingAccount(null)} />
      )}
    </div>
  )
}
