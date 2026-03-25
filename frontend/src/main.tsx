import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setWasmUrl } from '@lottiefiles/dotlottie-react'
import dotlottieWasmUrl from '@lottiefiles/dotlottie-web/dotlottie-player.wasm?url'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth.tsx'
import { applyTheme, resolveInitialTheme } from './lib/theme'

setWasmUrl(dotlottieWasmUrl)

applyTheme(resolveInitialTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
