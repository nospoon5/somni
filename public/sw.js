/* Somni minimal service worker.
   Goals:
   - Make the app "installable" (manifest + service worker).
   - Avoid caching authenticated or personalised content.
   - Provide an honest offline fallback for navigations.
*/

const CACHE_NAME = 'somni-static-v1'
const OFFLINE_URL = '/offline.html'

function isLocalhost() {
  const host = self.location && self.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

self.addEventListener('install', (event) => {
  // On localhost, still install so dev can test installability,
  // but we do not try to cache anything.
  if (isLocalhost()) return

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting())
      .catch(() => {})
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(
          keys.map((key) => (key === CACHE_NAME ? Promise.resolve() : caches.delete(key)))
        )
      } catch {
        // ignore
      }

      // Take control quickly in production so offline fallback works.
      try {
        await self.clients.claim()
      } catch {
        // ignore
      }
    })()
  )
})

self.addEventListener('fetch', (event) => {
  if (isLocalhost()) return

  const { request } = event

  // Only provide an offline fallback for full page navigations.
  if (request.mode !== 'navigate') return

  event.respondWith(
    (async () => {
      try {
        return await fetch(request)
      } catch {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(OFFLINE_URL)
        return (
          cached ||
          new Response('You are offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        )
      }
    })()
  )
})

