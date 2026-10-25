// Dev server over HTTPS with a self-signed certificate.
// Web MIDI requires a secure context; see README "Running on the tablet" for the options.
import { defineConfig, mergeConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import base from './vite.config'

export default mergeConfig(
  base,
  defineConfig({
    plugins: [basicSsl()],
  }),
)
