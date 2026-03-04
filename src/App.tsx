import { useState } from 'react'
import { FinanceProvider, useFinance } from './context/FinanceContext'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import AccountList from './components/AccountList'
import AccountDetail from './components/AccountDetail'
import DataManagement from './components/DataManagement'
import UploadModal from './components/UploadModal'

type View =
  | { type: 'dashboard' }
  | { type: 'accounts' }
  | { type: 'account-detail'; accountId: string }
  | { type: 'data' }

type NavView = 'dashboard' | 'accounts' | 'data'

function AppContent() {
  const [view, setView] = useState<View>({ type: 'dashboard' })
  const [showGlobalUpload, setShowGlobalUpload] = useState(false)
  const { data } = useFinance()

  const navView: NavView =
    view.type === 'account-detail' ? 'accounts' : (view.type as NavView)

  const handleGoToAccount = (accountId: string) => {
    setView({ type: 'account-detail', accountId })
  }

  const account =
    view.type === 'account-detail'
      ? data.accounts.find((a) => a.id === view.accountId)
      : null

  return (
    <Layout
      view={navView}
      onNavigate={(v) => setView({ type: v })}
      onUpload={() => setShowGlobalUpload(true)}
    >
      {view.type === 'dashboard' && (
        <Dashboard
          onGoToAccounts={() => setView({ type: 'accounts' })}
          onGoToAccount={handleGoToAccount}
        />
      )}
      {view.type === 'accounts' && <AccountList onGoToAccount={handleGoToAccount} />}
      {view.type === 'account-detail' && account && (
        <AccountDetail account={account} onBack={() => setView({ type: 'accounts' })} />
      )}
      {view.type === 'account-detail' && !account && (
        <div className="p-8 text-gray-500">Account not found.</div>
      )}
      {view.type === 'data' && <DataManagement />}

      {showGlobalUpload && <UploadModal onClose={() => setShowGlobalUpload(false)} />}
    </Layout>
  )
}

export default function App() {
  return (
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  )
}
