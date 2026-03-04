import { useState } from 'react'
import { X } from 'lucide-react'
import { AccountType } from '../types'
import { useFinance } from '../context/FinanceContext'

const ACCOUNT_TYPES: AccountType[] = [
  'TFSA',
  'FHSA',
  'RRSP',
  'RRIF',
  'Non-Registered',
  'Pension',
  'Cash',
  'Other',
]

interface AddAccountModalProps {
  onClose: () => void
}

export default function AddAccountModal({ onClose }: AddAccountModalProps) {
  const { addAccount } = useFinance()
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('TFSA')
  const [institution, setInstitution] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !institution.trim()) return
    addAccount({ name: name.trim(), type, institution: institution.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#12151f] border border-[#1e2235] rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e2235]">
          <h2 className="text-base font-semibold text-white">Add Account</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1e2235]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Questrade TFSA"
              className="w-full bg-[#0a0d14] border border-[#1e2235] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-app-accent transition-colors"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Account Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full bg-[#0a0d14] border border-[#1e2235] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-app-accent transition-colors appearance-none cursor-pointer"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Institution</label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. Questrade, Wealthsimple, TD"
              className="w-full bg-[#0a0d14] border border-[#1e2235] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-app-accent transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#1e2235] text-sm text-gray-400 hover:text-white hover:bg-[#1a1e2e] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !institution.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-app-accent text-[#0a0d14] text-sm font-semibold hover:bg-app-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add Account
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
