import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

window.addEventListener('error', (e) =>
  console.error('[Space Sentinel] Global error:', e.error || e.message)
)
window.addEventListener('unhandledrejection', (e) =>
  console.error('[Space Sentinel] Unhandled rejection:', e.reason)
)

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('[Space Sentinel] Root element #root not found in index.html')
}
createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
