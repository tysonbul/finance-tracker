import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw } from 'lucide-react'

export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80">
      <div className="bg-app-surface border border-app-border rounded-lg p-4 shadow-lg flex items-center gap-3">
        <RefreshCw className="w-5 h-5 text-app-accent shrink-0" />
        <p className="text-sm text-gray-300 flex-1">New version available</p>
        <button
          onClick={() => updateServiceWorker(true)}
          className="px-3 py-1.5 text-sm font-medium bg-app-accent text-gray-900 rounded-md hover:bg-app-accent-hover"
        >
          Update
        </button>
      </div>
    </div>
  )
}
