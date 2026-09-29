import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

function resolveBase(configuredBase = process.env.VITE_BASE_URL) {
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

function resolveProxyOrigin(configuredProxy = process.env.VITE_PROXY_BASE_URL) {
  if (!configuredProxy) {
    return null
  }

  try {
    return new URL(configuredProxy).origin
  } catch {
    return null
  }
}

function createProxyUrlPattern(proxyOrigin) {
  if (!proxyOrigin) {
    return /^$/
  }

  const escapedOrigin = proxyOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escapedOrigin}/`)
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const basePath = resolveBase(env.VITE_BASE_URL)
  const proxyOrigin = resolveProxyOrigin(env.VITE_PROXY_BASE_URL)
  const proxyUrlPattern = createProxyUrlPattern(proxyOrigin)

  return {
    base: basePath,
    plugins: [
      react(),
      VitePWA({
        base: basePath,
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          name: 'Cahier de Texte - ÉcoleDirecte',
          short_name: 'Cahier de Texte',
          description: 'Consultation et impression du cahier de texte ÉcoleDirecte.',
          lang: 'fr',
          dir: 'ltr',
          id: basePath,
          start_url: basePath,
          scope: basePath,
          display: 'standalone',
          orientation: 'any',
          background_color: '#f8fafc',
          theme_color: '#0b4e84',
          icons: [
            {
              src: `${basePath}pwa-64x64.png`,
              sizes: '64x64',
              type: 'image/png',
            },
            {
              src: `${basePath}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${basePath}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${basePath}maskable-icon-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: `${basePath}app-icon.svg`,
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: `${basePath}favicon.svg`,
              sizes: '48x48 32x32 16x16',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: `${basePath}index.html`,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        runtimeCaching: proxyOrigin
          ? [
              {
                urlPattern: proxyUrlPattern,
                handler: 'NetworkOnly',
                method: 'GET',
                options: { cacheName: 'ed-homework-session-api' },
              },
              {
                urlPattern: proxyUrlPattern,
                handler: 'NetworkOnly',
                method: 'POST',
                options: { cacheName: 'ed-homework-session-api' },
              },
            ]
          : [],
      },
      }),
    ],
  }
})
