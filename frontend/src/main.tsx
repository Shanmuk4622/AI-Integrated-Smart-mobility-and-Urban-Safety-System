import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { EnvValidator } from './lib/envValidator'

// Validate environment variables on startup
try {
  EnvValidator.validateOrThrow()
} catch (error) {
  // Error is already logged, app won't render properly
  console.error('Failed to start application due to configuration errors')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
