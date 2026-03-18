import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Holding } from '../types'

interface HoldingsEditorProps {
  holdings: Holding[]
  onSave: (holdings: Holding[]) => void
  onClose: () => void
}

const emptyHolding = (): Holding => ({
  symbol: '',
  quantity: 0,
  marketPrice: 0,
  marketValue: 0,
  bookCost: 0,
  currency: 'CAD',
})

export default function HoldingsEditor({ holdings, onSave, onClose }: HoldingsEditorProps) {
  const [rows, setRows] = useState<Holding[]>(
    holdings.length > 0 ? holdings.map((h) => ({ ...h })) : [emptyHolding()],
  )

  const updateRow = (index: number, field: keyof Holding, value: string | number) => {
    setRows((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }

      // Auto-calculate marketValue when quantity or price changes
      if (field === 'quantity' || field === 'marketPrice') {
        const qty = field === 'quantity' ? Number(value) : updated[index].quantity
        const price = field === 'marketPrice' ? Number(value) : updated[index].marketPrice
        updated[index].marketValue = Math.round(qty * price * 100) / 100
      }

      return updated
    })
  }

  const addRow = () => setRows((prev) => [...prev, emptyHolding()])

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    const valid = rows.filter((r) => r.symbol.trim() !== '' && r.marketValue > 0)
    onSave(valid)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#12151f] border border-[#1e2235] rounded-2xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">Edit Holdings</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#1a1e2e] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {rows.map((row, i) => (
            <div key={i} className="bg-[#0a0d14] border border-[#1e2235] rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 mb-0.5">Symbol</label>
                  <input
                    type="text"
                    value={row.symbol}
                    onChange={(e) => updateRow(i, 'symbol', e.target.value.toUpperCase())}
                    placeholder="VFV"
                    className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-app-accent transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 mb-0.5">Currency</label>
                  <select
                    value={row.currency}
                    onChange={(e) => updateRow(i, 'currency', e.target.value)}
                    className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-app-accent transition-colors"
                  >
                    <option value="CAD">CAD</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <button
                  onClick={() => removeRow(i)}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all mt-3"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Quantity</label>
                  <input
                    type="number"
                    value={row.quantity || ''}
                    onChange={(e) => updateRow(i, 'quantity', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    min="0"
                    step="any"
                    className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-app-accent transition-colors tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Price</label>
                  <input
                    type="number"
                    value={row.marketPrice || ''}
                    onChange={(e) => updateRow(i, 'marketPrice', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-app-accent transition-colors tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">Market Value</label>
                  <input
                    type="number"
                    value={row.marketValue || ''}
                    onChange={(e) => updateRow(i, 'marketValue', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-app-accent transition-colors tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Book Cost</label>
                <input
                  type="number"
                  value={row.bookCost || ''}
                  onChange={(e) => updateRow(i, 'bookCost', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full bg-[#12151f] border border-[#1e2235] rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-app-accent transition-colors tabular-nums"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="flex items-center justify-center gap-1.5 w-full mt-3 py-2 rounded-xl border border-dashed border-[#1e2235] text-sm text-gray-500 hover:text-app-accent hover:border-app-accent transition-all"
        >
          <Plus size={14} />
          Add Holding
        </button>

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#1e2235] text-sm text-gray-400 hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 rounded-xl bg-app-accent text-[#0a0d14] text-sm font-semibold hover:bg-app-accent-hover transition-all"
          >
            Save Holdings
          </button>
        </div>
      </div>
    </div>
  )
}
