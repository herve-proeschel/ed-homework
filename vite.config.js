import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function resolveBase() {
  const configuredBase = process.env.VITE_BASE_URL

  if (!configuredBase) {
    return '/'
  }

  try {
    const pathname = new URL(configuredBase).pathname
    return pathname.endsWith('/') ? pathname : `${pathname}/`
  } catch {
    return configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBase(),
  plugins: [react()],
})
