import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { validateEnv } from './lib/env'

// Validate environment variables on startup
try {
  validateEnv()
} catch (error) {
  // If validation fails, show error message in the UI
  const rootElement = document.getElementById('root')
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; font-family: system-ui, -apple-system, sans-serif;">
        <div style="max-width: 600px; background: #fee; border: 2px solid #fcc; border-radius: 8px; padding: 24px;">
          <h1 style="color: #c33; margin-top: 0;">⚠️ Configuration Error</h1>
          <p style="color: #333; line-height: 1.6;">
            ${error instanceof Error ? error.message : 'Missing required environment variables'}
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 16px;">
            Please check your .env file and ensure all required variables are set.
          </p>
        </div>
      </div>
    `
  }
  throw error
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
