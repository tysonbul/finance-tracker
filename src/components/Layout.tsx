import { LayoutDashboard, Wallet, Database, Upload, type LucideIcon } from 'lucide-react'
import { useFinance } from '../context/FinanceContext'

type View = 'dashboard' | 'accounts' | 'data'

interface LayoutProps {
  view: View
  onNavigate: (view: View) => void
  onUpload: () => void
  children: React.ReactNode
}

const NAV_ITEMS: { view: View; label: string; Icon: LucideIcon }[] = [
  { view: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { view: 'accounts', label: 'Accounts', Icon: Wallet },
  { view: 'data', label: 'Data', Icon: Database },
]

export default function Layout({ view, onNavigate, onUpload, children }: LayoutProps) {
  const { hasUnsavedChanges } = useFinance()
  return (
    <div className="flex min-h-screen md:h-screen">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-[#1e2235] bg-[#0d1018]">
        {/* Brand */}
        <div className="px-5 py-6 border-b border-[#1e2235]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-app-accent flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 10 L5 6 L8 8 L12 3"
                  stroke="#0a0d14"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">Finance Tracker</span>
          </div>
        </div>

        {/* Upload CTA */}
        <div className="px-3 pt-4">
          <button
            onClick={onUpload}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-app-accent text-[#0a0d14] text-sm font-semibold hover:bg-app-accent-hover transition-all"
          >
            <Upload size={14} />
            Upload Statement
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ view: v, label, Icon }) => {
            const active = view === v
            return (
              <button
                key={v}
                onClick={() => onNavigate(v)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-app-accent-dim text-app-accent'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1e2e]'
                }`}
              >
                <span className="relative">
                  <Icon size={16} className={active ? 'text-app-accent' : ''} />
                  {v === 'data' && hasUnsavedChanges && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-app-accent" />
                  )}
                </span>
                {label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 md:overflow-auto bg-[#0a0d14] pb-20 md:pb-0">{children}</main>

      {/* Bottom nav — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden border-t border-[#1e2235] bg-[#0d1018]">
        {NAV_ITEMS.slice(0, 2).map(({ view: v, label, Icon }) => {
          const active = view === v
          return (
            <button
              key={v}
              onClick={() => onNavigate(v)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-all ${
                active ? 'text-app-accent' : 'text-gray-500'
              }`}
            >
              <Icon size={20} />
              {label}
            </button>
          )
        })}

        {/* Upload CTA — center */}
        <button
          onClick={onUpload}
          className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold text-app-accent"
        >
          <div className="w-8 h-8 rounded-xl bg-app-accent flex items-center justify-center -mt-1">
            <Upload size={16} className="text-[#0a0d14]" />
          </div>
          Upload
        </button>

        {NAV_ITEMS.slice(2).map(({ view: v, label, Icon }) => {
          const active = view === v
          return (
            <button
              key={v}
              onClick={() => onNavigate(v)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-all ${
                active ? 'text-app-accent' : 'text-gray-500'
              }`}
            >
              <span className="relative">
                <Icon size={20} />
                {v === 'data' && hasUnsavedChanges && (
                  <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-app-accent" />
                )}
              </span>
              {label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
