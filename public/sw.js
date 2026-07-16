/* Somni minimal service worker.
   Goals:
   - Make the app "installable" (manifest + service worker).
   - Avoid caching authenticated or personalised content.
   - Provide an honest offline fallback for navigations.
*/

const CACHE_NAME = 'somni-static-v1'
const OFFLINE_URL = '/offline.html'
const DEFAULT_NOTIFICATION = {
  title: 'Somni Update',
  body: 'New alert.',
  icon: '/icons/icon-192.png',
  badge: '/icons/icon-192.png',
  url: '/',
}

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

self.addEventListener('push', (event) => {
  const data = readPushPayload(event)

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: {
        url: data.url,
        receivedAt: Date.now(),
      },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data && event.notification.data.url
  const url = typeof targetUrl === 'string' && targetUrl.startsWith('/') ? targetUrl : '/'

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      for (const client of windowClients) {
        const clientUrl = new URL(client.url)
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          if (clientUrl.pathname !== url && 'navigate' in client) {
            await client.navigate(url)
          }
          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })()
  )
})

function readPushPayload(event) {
  if (!event.data) return DEFAULT_NOTIFICATION

  try {
    const parsed = event.data.json()
    return {
      title: typeof parsed.title === 'string' ? parsed.title : DEFAULT_NOTIFICATION.title,
      body: typeof parsed.body === 'string' ? parsed.body : DEFAULT_NOTIFICATION.body,
      icon: typeof parsed.icon === 'string' ? parsed.icon : DEFAULT_NOTIFICATION.icon,
      badge: typeof parsed.badge === 'string' ? parsed.badge : DEFAULT_NOTIFICATION.badge,
      tag: typeof parsed.tag === 'string' ? parsed.tag : undefined,
      url: typeof parsed.url === 'string' ? parsed.url : DEFAULT_NOTIFICATION.url,
    }
  } catch {
    return DEFAULT_NOTIFICATION
  }
}

