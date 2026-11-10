import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource/cairo/400.css'
import '@fontsource/cairo/600.css'
import '@fontsource/cairo/700.css'
import '@/i18n'
import '@/index.css'
import { PrintProvider } from '@/shared/print/PrintProvider'
import { ToastProvider } from '@/shared/toast/ToastProvider'
import App from '@/App'
import { ENV } from '@/config/env'

if (ENV.isDev) document.title += ' [DEV]'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ToastProvider>
        <PrintProvider>
          <App />
        </PrintProvider>
      </ToastProvider>
    </HashRouter>
  </React.StrictMode>
)
