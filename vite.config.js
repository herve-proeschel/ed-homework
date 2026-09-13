import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
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

function createServiceWorkerSource(version, urlsToPrecache, scope) {
  return `const CACHE_NAME = 'ed-homework-${version}'
const APP_SHELL_URL = ${JSON.stringify(scope)}
const INDEX_URL = ${JSON.stringify(`${scope}index.html`)}
const PRECACHE_URLS = ${JSON.stringify(urlsToPrecache, null, 2)}
const PRECACHE_URL_SET = new Set(PRECACHE_URLS)

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const assetUrl of PRECACHE_URLS) {
        const response = await fetch(assetUrl, { cache: 'no-cache' })
        if (!response.ok) {
          throw new Error(\`Failed to precache \${assetUrl}\`)
        }
        await cache.put(assetUrl, response)
      }

      const indexResponse = await cache.match(INDEX_URL)
      if (indexResponse) {
        await cache.put(APP_SHELL_URL, indexResponse)
      }

      self.skipWaiting()
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const requestUrl = new URL(event.request.url)

  if (requestUrl.origin !== self.location.origin) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches
        .match(APP_SHELL_URL)
        .then((cachedAppShell) => cachedAppShell || caches.match(INDEX_URL))
        .then((cachedResponse) => cachedResponse || fetch(event.request)),
    )
    return
  }

  if (PRECACHE_URL_SET.has(requestUrl.pathname)) {
    event.respondWith(
      caches.match(requestUrl.pathname).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse

        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse.ok) return networkResponse

          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(requestUrl.pathname, networkResponse.clone())
            return networkResponse
          })
        })
      }),
    )
    return
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  )
})
`
}

async function listDistFiles(directoryPath, relativeDirectoryPath = '') {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = relativeDirectoryPath
        ? `${relativeDirectoryPath}/${entry.name}`
        : entry.name
      const absolutePath = path.join(directoryPath, entry.name)

      if (entry.isDirectory()) {
        return listDistFiles(absolutePath, relativePath)
      }

      return [relativePath]
    }),
  )

  return nestedFiles.flat()
}

function serviceWorkerPlugin(scope) {
  let outDirectory = ''

  return {
    name: 'generate-service-worker',
    apply: 'build',
    configResolved(config) {
      outDirectory = path.resolve(config.root, config.build.outDir)
    },
    async writeBundle() {
      const distFiles = (await listDistFiles(outDirectory))
        .filter((filePath) => filePath !== 'sw.js')
        .sort()

      const urlsToPrecache = distFiles.map((filePath) => `${scope}${filePath}`)
      const versionHash = createHash('sha256')

      for (const filePath of distFiles) {
        versionHash.update(filePath)
        versionHash.update(await fs.readFile(path.join(outDirectory, filePath)))
      }

      await fs.writeFile(
        path.join(outDirectory, 'sw.js'),
        createServiceWorkerSource(
          versionHash.digest('hex').slice(0, 16),
          urlsToPrecache,
          scope,
        ),
      )
    },
  }
}

const basePath = resolveBase()

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
  plugins: [react(), serviceWorkerPlugin(basePath)],
})
