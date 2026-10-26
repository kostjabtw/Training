const CACHE = 'team-progress-shell-v5';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './features.js', './sync.js', './account.js', './plan.js', './domain.js', './storage.js', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png', './manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    // Do not cache an authentication redirect as the application shell.
    for (const path of ASSETS) {
      const response = await fetch(path, { redirect: 'error' });
      if (!response.ok) throw new Error('App shell unavailable');
      await cache.put(path, response);
    }
  }));
});
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('team-progress-shell-') && k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const path = new URL(event.request.url).pathname;
  if (!ASSETS.some(asset => new URL(asset, self.location).pathname === path)) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(cached => cached || Response.error())));
});
