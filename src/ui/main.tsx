import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './App'
import { loadSavedOffset } from './hooks/useCalibration'
import { initIo } from './io'
import './styles.css'

loadSavedOffset()
void initIo()
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
