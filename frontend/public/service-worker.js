const CACHE = 'lucro-real-v2'
const ASSETS = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

// Rede primeiro para API/dados; cache como fallback só para assets estáticos
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (url.origin !== location.origin || e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
        return res
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match('/')))
  )
})

// ===================== Web Push =====================
// Recebe a notificação enviada pela Edge Function e exibe no sistema.
self.addEventListener('push', (e) => {
  let dados = {}
  try {
    dados = e.data ? e.data.json() : {}
  } catch {
    dados = { title: 'MacacoFy', body: e.data ? e.data.text() : '' }
  }
  const title = dados.title || 'MacacoFy'
  const options = {
    body: dados.body || '',
    icon: dados.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: dados.tag || undefined,          // notificações com mesma tag se substituem
    renotify: !!dados.tag,
    data: { url: dados.url || '/' },
    vibrate: [80, 40, 80],
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

// Ao tocar na notificação, foca uma aba aberta do app ou abre uma nova.
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const destino = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ('focus' in c) {
          c.navigate(destino)
          return c.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino)
    })
  )
})
