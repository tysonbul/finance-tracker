import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  CreditCard,
  X,
} from 'lucide-react'
import { useFinance } from '../context/FinanceContext'
import { ExpenseFrequency } from '../types'
import { computeMonthlyCashFlow, normalizeToMonthly } from '../utils/cashFlow'
import { formatCurrencyFull, formatMonth, currentYearMonth } from '../utils/formatters'

const FREQ_LABELS: Record<ExpenseFrequency, string> = {
  'monthly': 'Monthly',
  'bi-weekly': 'Bi-weekly',
  'yearly': 'Yearly',
}

const formatYAxis = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

const CashFlowTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  const value = payload[0].value
  return (
    <div className="bg-[#12151f] border border-[#1e2235] rounded-xl p-4 shadow-xl min-w-[160px]">
      <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
        {label ? formatMonth(label) : ''}
      </p>
      <span
        className={`text-sm font-semibold font-mono ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
      >
        {value >= 0 ? '+' : ''}{formatCurrencyFull(value)}
      </span>
    </div>
  )
}

export default function CashFlowDashboard() {
  const {
    data,
    addIncomeRecord,
    updateIncomeRecord,
    deleteIncomeRecord,
    addFixedExpense,
    updateFixedExpense,
    deleteFixedExpense,
    addCCAdjustment,
    deleteCCAdjustment,
  } = useFinance()
  const { cashFlowConfig, creditCardAccounts } = data
  const { incomeRecords, fixedExpenses, ccAdjustments } = cashFlowConfig

  // Compute default start date from earliest CC statement
  const defaultStartDate = useMemo(() => {
    const allMonths = creditCardAccounts
      .flatMap((a) => a.entries.map((e) => e.statementEndDate.slice(0, 7)))
      .sort()
    return allMonths[0] ?? currentYearMonth()
  }, [creditCardAccounts])

  const monthlyData = useMemo(
    () => computeMonthlyCashFlow(incomeRecords, fixedExpenses, creditCardAccounts, ccAdjustments),
    [incomeRecords, fixedExpenses, creditCardAccounts, ccAdjustments],
  )

  const hasConfig = incomeRecords.length > 0 || fixedExpenses.length > 0
  const [showSetup, setShowSetup] = useState(!hasConfig)
  const [showBreakdown, setShowBreakdown] = useState(false)

  // Income form state
  const [addingIncome, setAddingIncome] = useState(false)
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null)
  const [incomeName, setIncomeName] = useState('')
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeFrequency, setIncomeFrequency] = useState<ExpenseFrequency>('monthly')
  const [incomeStart, setIncomeStart] = useState(currentYearMonth())
  const [incomeEnd, setIncomeEnd] = useState('')

  // Expense form state
  const [addingExpense, setAddingExpense] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [expenseName, setExpenseName] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseFrequency, setExpenseFrequency] = useState<ExpenseFrequency>('monthly')
  const [expenseOnCC, setExpenseOnCC] = useState(false)
  const [expenseStart, setExpenseStart] = useState(defaultStartDate)
  const [expenseEnd, setExpenseEnd] = useState('')

  // Adjustment form state
  const [addingAdjMonth, setAddingAdjMonth] = useState<string | null>(null)
  const [adjName, setAdjName] = useState('')
  const [adjAmount, setAdjAmount] = useState('')

  const resetIncomeForm = () => {
    setAddingIncome(false)
    setEditingIncomeId(null)
    setIncomeName('')
    setIncomeAmount('')
    setIncomeFrequency('monthly')
    setIncomeStart(currentYearMonth())
    setIncomeEnd('')
  }

  const resetExpenseForm = () => {
    setAddingExpense(false)
    setEditingExpenseId(null)
    setExpenseName('')
    setExpenseAmount('')
    setExpenseFrequency('monthly')
    setExpenseOnCC(false)
    setExpenseStart(defaultStartDate)
    setExpenseEnd('')
  }

  const handleSaveIncome = () => {
    const amount = parseFloat(incomeAmount)
    if (!incomeName.trim() || isNaN(amount) || amount <= 0) return
    const record = {
      name: incomeName.trim(),
      amount,
      frequency: incomeFrequency,
      startDate: incomeStart,
      endDate: incomeEnd || null,
    }
    if (editingIncomeId) {
      updateIncomeRecord(editingIncomeId, record)
    } else {
      addIncomeRecord(record)
    }
    resetIncomeForm()
  }

  const handleEditIncome = (id: string) => {
    const r = incomeRecords.find((r) => r.id === id)
    if (!r) return
    setEditingIncomeId(id)
    setIncomeName(r.name)
    setIncomeAmount(String(r.amount))
    setIncomeFrequency(r.frequency)
    setIncomeStart(r.startDate)
    setIncomeEnd(r.endDate ?? '')
    setAddingIncome(true)
  }

  const handleSaveExpense = () => {
    const amount = parseFloat(expenseAmount)
    if (!expenseName.trim() || isNaN(amount) || amount <= 0) return
    const expense = {
      name: expenseName.trim(),
      amount,
      frequency: expenseFrequency,
      isOnCreditCard: expenseOnCC,
      startDate: expenseStart,
      endDate: expenseEnd || null,
    }
    if (editingExpenseId) {
      updateFixedExpense(editingExpenseId, expense)
    } else {
      addFixedExpense(expense)
    }
    resetExpenseForm()
  }

  const handleEditExpense = (id: string) => {
    const e = fixedExpenses.find((e) => e.id === id)
    if (!e) return
    setEditingExpenseId(id)
    setExpenseName(e.name)
    setExpenseAmount(String(e.amount))
    setExpenseFrequency(e.frequency)
    setExpenseOnCC(e.isOnCreditCard)
    setExpenseStart(e.startDate)
    setExpenseEnd(e.endDate ?? '')
    setAddingExpense(true)
  }

  const handleSaveAdjustment = () => {
    const amount = parseFloat(adjAmount)
    if (!adjName.trim() || isNaN(amount) || amount <= 0 || !addingAdjMonth) return
    addCCAdjustment({ month: addingAdjMonth, amount, name: adjName.trim() })
    setAddingAdjMonth(null)
    setAdjName('')
    setAdjAmount('')
  }

  // Hero metric
  const avgNetCashFlow =
    monthlyData.length > 0
      ? monthlyData.reduce((s, m) => s + m.netCashFlow, 0) / monthlyData.length
      : null

  const inputClass =
    'w-full bg-[#0a0d14] border border-[#1e2235] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-app-accent'
  const selectClass =
    'bg-[#0a0d14] border border-[#1e2235] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-app-accent'

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Hero Metric */}
      <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-4 md:p-7">
        <p className="text-sm text-gray-400 font-medium mb-2">Avg Net Cash Flow</p>
        <div className="flex items-end gap-3 md:gap-4 flex-wrap">
          <span
            className={`text-3xl md:text-5xl font-bold tracking-tight ${avgNetCashFlow === null
              ? 'text-white'
              : avgNetCashFlow >= 0
                ? 'text-emerald-400'
                : 'text-red-400'
              }`}
          >
            {avgNetCashFlow !== null
              ? `${avgNetCashFlow >= 0 ? '+' : ''}${formatCurrencyFull(avgNetCashFlow)}`
              : '—'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {monthlyData.length > 0
            ? `Based on ${monthlyData.length} month${monthlyData.length === 1 ? '' : 's'} of data`
            : 'Upload credit card statements to see cash flow'}
        </p>
      </div>

      {/* Chart */}
      {monthlyData.length > 0 && (
        <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl p-4 md:p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 md:mb-6">Net Cash Flow</h2>
          <div className="h-48 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  dx={-4}
                  width={55}
                />
                <Tooltip content={<CashFlowTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="netCashFlow" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.netCashFlow >= 0 ? '#34d399' : '#f87171'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly Breakdown */}
      {monthlyData.length > 0 && (
        <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-between p-4 md:p-6 text-left"
          >
            <div>
              <h2 className="text-sm font-semibold text-white">Monthly Breakdown</h2>
              <p className="text-xs text-gray-500 mt-0.5">{monthlyData.length} month{monthlyData.length !== 1 ? 's' : ''} of data</p>
            </div>
            {showBreakdown ? (
              <ChevronUp size={16} className="text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </button>
          {showBreakdown && (
            <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-3 border-t border-[#1e2235] pt-4">
              {[...monthlyData].reverse().map((m) => {
                const monthAdj = ccAdjustments.filter((a) => a.month === m.month)
                return (
                  <div
                    key={m.month}
                    className="bg-[#12151f] border border-[#1e2235] rounded-xl p-4"
                  >
                    <h3 className="text-sm font-semibold text-white mb-3">{formatMonth(m.month)}</h3>

                    <div className="space-y-1.5 text-xs">
                      <Row label="Income" value={m.income} color="text-emerald-400" />
                      {m.fixedNonCC > 0 && (
                        <Row label="Fixed (non-CC)" value={-m.fixedNonCC} color="text-red-400" />
                      )}
                      <Row
                        label={m.ccAdjustments > 0 ? 'CC Statements (adjusted)' : 'CC Statements'}
                        value={-m.adjustedCCTotal}
                        color="text-red-400"
                      />
                      {m.ccAdjustments > 0 && (
                        <div className="pl-4 space-y-1">
                          <Row label="Raw CC total" value={m.ccStatementTotal} color="text-gray-500" plain />
                          <Row label="Adjustments" value={-m.ccAdjustments} color="text-gray-500" plain />
                        </div>
                      )}
                      {m.fixedCC > 0 && (
                        <div className="pl-4">
                          <Row label="Fixed (on CC)" value={m.fixedCC} color="text-gray-500" plain />
                          <Row label="Variable" value={m.variableCCSpend} color="text-gray-500" plain />
                        </div>
                      )}

                      {/* Adjustment items */}
                      {monthAdj.length > 0 && (
                        <div className="pl-4 space-y-1">
                          {monthAdj.map((a) => (
                            <div key={a.id} className="flex items-center justify-between">
                              <span className="text-gray-500 truncate">{a.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 font-mono">-{formatCurrencyFull(a.amount)}</span>
                                <button
                                  onClick={() => deleteCCAdjustment(a.id)}
                                  className="p-0.5 text-gray-600 hover:text-red-400 transition-colors"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="border-t border-[#1e2235] pt-1.5 mt-1.5">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-gray-300">Net Cash Flow</span>
                          <span
                            className={`font-mono ${m.netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                          >
                            {m.netCashFlow >= 0 ? '+' : ''}{formatCurrencyFull(m.netCashFlow)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Add reimbursement */}
                    {addingAdjMonth === m.month ? (
                      <div className="mt-3 pt-3 border-t border-[#1e2235] space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Description"
                            value={adjName}
                            onChange={(e) => setAdjName(e.target.value)}
                            className={inputClass}
                          />
                          <input
                            type="number"
                            placeholder="Amount"
                            value={adjAmount}
                            onChange={(e) => setAdjAmount(e.target.value)}
                            className={inputClass}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveAdjustment}
                            className="px-3 py-1.5 rounded-lg bg-app-accent text-[#0a0d14] text-[10px] font-semibold hover:bg-app-accent-hover transition-all"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => { setAddingAdjMonth(null); setAdjName(''); setAdjAmount('') }}
                            className="px-3 py-1.5 rounded-lg border border-[#1e2235] text-[10px] text-gray-400 hover:text-white transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingAdjMonth(m.month)}
                        className="mt-3 pt-3 border-t border-[#1e2235] w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium text-gray-500 hover:text-app-accent transition-colors"
                      >
                        <Plus size={10} />
                        Add Adjustment
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Setup Section */}
      <div className="bg-[#12151f] border border-[#1e2235] rounded-2xl">
        <button
          onClick={() => setShowSetup(!showSetup)}
          className="w-full flex items-center justify-between p-4 md:p-6 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-white">Income & Fixed Expenses</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {incomeRecords.length} income source{incomeRecords.length !== 1 ? 's' : ''} · {fixedExpenses.length} fixed expense{fixedExpenses.length !== 1 ? 's' : ''}
            </p>
          </div>
          {showSetup ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </button>

        {showSetup && (
          <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-6 border-t border-[#1e2235]">
            {/* Income Records */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Income</h3>
                {!addingIncome && (
                  <button
                    onClick={() => { resetIncomeForm(); setAddingIncome(true) }}
                    className="flex items-center gap-1 text-xs text-app-accent hover:text-app-accent-hover transition-colors font-medium"
                  >
                    <Plus size={12} />
                    Add Income
                  </button>
                )}
              </div>

              {incomeRecords.length === 0 && !addingIncome && (
                <p className="text-xs text-gray-600">No income sources configured</p>
              )}

              <div className="space-y-2">
                {incomeRecords.map((r) =>
                  editingIncomeId === r.id && addingIncome ? null : (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 p-3 bg-[#0a0d14] rounded-lg"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium truncate">{r.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatCurrencyFull(r.amount)} {FREQ_LABELS[r.frequency].toLowerCase()}
                          {r.frequency !== 'monthly' && (
                            <span className="text-gray-600">
                              {' '}(~{formatCurrencyFull(normalizeToMonthly(r.amount, r.frequency))}/mo)
                            </span>
                          )}
                          {' · '}{formatMonth(r.startDate)} → {r.endDate ? formatMonth(r.endDate) : 'Present'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleEditIncome(r.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-app-accent hover:bg-app-accent-dim transition-all"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => deleteIncomeRecord(r.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>

              {/* Income form */}
              {addingIncome && (
                <div className="mt-2 p-3 bg-[#0a0d14] rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Name (e.g. Salary)"
                      value={incomeName}
                      onChange={(e) => setIncomeName(e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={incomeAmount}
                      onChange={(e) => setIncomeAmount(e.target.value)}
                      className={inputClass}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <select
                      value={incomeFrequency}
                      onChange={(e) => setIncomeFrequency(e.target.value as ExpenseFrequency)}
                      className={`${selectClass} w-full`}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="bi-weekly">Bi-weekly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">Start</label>
                      <input
                        type="month"
                        value={incomeStart}
                        onChange={(e) => setIncomeStart(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">End (blank = ongoing)</label>
                      <input
                        type="month"
                        value={incomeEnd}
                        onChange={(e) => setIncomeEnd(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveIncome}
                      className="px-4 py-2 rounded-lg bg-app-accent text-[#0a0d14] text-xs font-semibold hover:bg-app-accent-hover transition-all"
                    >
                      {editingIncomeId ? 'Update' : 'Add'}
                    </button>
                    <button
                      onClick={resetIncomeForm}
                      className="px-4 py-2 rounded-lg border border-[#1e2235] text-xs text-gray-400 hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Expenses */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fixed Expenses</h3>
                {!addingExpense && (
                  <button
                    onClick={() => { resetExpenseForm(); setAddingExpense(true) }}
                    className="flex items-center gap-1 text-xs text-app-accent hover:text-app-accent-hover transition-colors font-medium"
                  >
                    <Plus size={12} />
                    Add Expense
                  </button>
                )}
              </div>

              {fixedExpenses.length === 0 && !addingExpense && (
                <p className="text-xs text-gray-600">No fixed expenses configured</p>
              )}

              <div className="space-y-2">
                {fixedExpenses.map((e) =>
                  editingExpenseId === e.id && addingExpense ? null : (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 p-3 bg-[#0a0d14] rounded-lg"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-white font-medium truncate">{e.name}</p>
                          {e.isOnCreditCard && (
                            <CreditCard size={12} className="text-gray-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatCurrencyFull(e.amount)} {FREQ_LABELS[e.frequency].toLowerCase()}
                          {e.frequency !== 'monthly' && (
                            <span className="text-gray-600">
                              {' '}(~{formatCurrencyFull(normalizeToMonthly(e.amount, e.frequency))}/mo)
                            </span>
                          )}
                          {' · '}{formatMonth(e.startDate)} → {e.endDate ? formatMonth(e.endDate) : 'Present'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleEditExpense(e.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-app-accent hover:bg-app-accent-dim transition-all"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => deleteFixedExpense(e.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>

              {/* Expense form */}
              {addingExpense && (
                <div className="mt-2 p-3 bg-[#0a0d14] rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Name (e.g. Rent)"
                      value={expenseName}
                      onChange={(e) => setExpenseName(e.target.value)}
                      className={inputClass}
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className={inputClass}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={expenseFrequency}
                      onChange={(e) => setExpenseFrequency(e.target.value as ExpenseFrequency)}
                      className={`${selectClass} w-full`}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="bi-weekly">Bi-weekly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={expenseOnCC}
                        onChange={(e) => setExpenseOnCC(e.target.checked)}
                        className="rounded border-[#1e2235] bg-[#0a0d14] text-app-accent focus:ring-app-accent"
                      />
                      On credit card
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">Start</label>
                      <input
                        type="month"
                        value={expenseStart}
                        onChange={(e) => setExpenseStart(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 mb-1 block">End (blank = ongoing)</label>
                      <input
                        type="month"
                        value={expenseEnd}
                        onChange={(e) => setExpenseEnd(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveExpense}
                      className="px-4 py-2 rounded-lg bg-app-accent text-[#0a0d14] text-xs font-semibold hover:bg-app-accent-hover transition-all"
                    >
                      {editingExpenseId ? 'Update' : 'Add'}
                    </button>
                    <button
                      onClick={resetExpenseForm}
                      className="px-4 py-2 rounded-lg border border-[#1e2235] text-xs text-gray-400 hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  color,
  plain,
}: {
  label: string
  value: number
  color: string
  plain?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={plain ? 'text-gray-500' : 'text-gray-300'}>{label}</span>
      <span className={`font-mono ${plain ? 'text-gray-500' : color}`}>
        {plain ? formatCurrencyFull(value) : `${value >= 0 ? '+' : ''}${formatCurrencyFull(value)}`}
      </span>
    </div>
  )
}
