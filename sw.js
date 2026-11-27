/*
 * Service worker: keeps the app itself (page, scripts, styles, icons, fonts) available offline.
 * Own files: network first, so a new version is used as soon as there is a connection;
 * the cached copy is only used when the network fails.
 * Font files and the QR library: cache first (their names never change).
 * Round data (Supabase) and exchange rates are never cached here.
 * Raise VERSION only when SHELL changes.
 */
const VERSION = 'wichteln-v2';
const SHELL = ['./', 'index.html', 'app.js', 'i18n.js', 'styles.css', 'fonts/fonts.css',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
const IMMUTABLE = /\/(fonts\/[^/]+\.woff2|vendor\/[^/]+\.js)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, exchange rates, WhatsApp … go straight to the network
  e.respondWith(IMMUTABLE.test(url.pathname) ? cacheFirst(req) : networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const page = await cache.match('index.html');
      if (page) return page;
    }
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

/* Push notifications from the edge function "wichteln-push". The text never contains names. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Wichteln', {
    body: d.body || '', tag: d.tag, renotify: !!d.tag,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.location.href).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === new URL(url).origin && 'focus' in w) {
        await w.focus();
        if ('navigate' in w) await w.navigate(url).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
