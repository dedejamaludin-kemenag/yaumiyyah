const CACHE_NAME = 'yaumiyyah-cache-v11';
const CORE_ASSETS = [
  './',
  './index.html',
  './config.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);
    } catch (e) {}
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isHttpHttps(req) {
  try {
    const url = new URL(req.url);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function isSameOrigin(req) {
  try {
    const url = new URL(req.url);
    return url.origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // IMPORTANT: Cache API hanya mendukung GET. Selain GET, langsung fetch saja.
  if (req.method !== 'GET') {
    event.respondWith(fetch(req));
    return;
  }

  // Jangan cache request non http/https (mis. chrome-extension://)
  if (!isHttpHttps(req)) {
    event.respondWith(fetch(req));
    return;
  }

  // Cross-origin: jangan cache (hindari error opaque/extension)
  if (!isSameOrigin(req)) {
    event.respondWith(fetch(req));
    return;
  }

  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');

  if (isHTML) {
    // network-first untuk HTML (biar index tidak basi)
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        try { await cache.put(req, fresh.clone()); } catch (e) {}
        return fresh;
      } catch (e) {
        const cached = await caches.match(req)
          || await caches.match('./index.html')
          || await caches.match('/index.html');
        return cached || new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // Asset lain: cache-first
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      if (fresh && (fresh.status === 200 || fresh.type === 'opaque')) {
        try { await cache.put(req, fresh.clone()); } catch (e) {}
      }
      return fresh;
    } catch (e) {
      return cached || new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});

// --- Push handlers (keep working) ---
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}

  const title = data.title || "Pesan Harian";
  const options = {
    body: data.body || "Buka aplikasi untuk membaca.",
    // Repo ini menyimpan ikon di root (192x192.png / 512x512.png).
    // Hindari path /icons/* yang tidak ada agar notifikasi tidak memunculkan 404.
    icon: data.icon || "/192x192.png",
    badge: data.badge || "/192x192.png",
    data: { url: data.url || "/rekap.html" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "/rekap.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(target);
          return w.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});


// Network-first for HTML navigations (prevents stale index.html)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const accept = req.headers.get('accept') || '';
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        return cached || caches.match('/index.html');
      }
    })());
  }
});
