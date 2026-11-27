// Lets phones install the back office as an app and shows its notifications.
// It doesn't keep copies of anything: every screen and record always comes fresh from the website.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'UVS Office', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'UVS Office', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: '/office/icon-192.png', badge: '/office/icon-192.png', data: { url: d.url || '/office/#home' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/office/#home', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.includes('/office/')) { await w.focus(); return w.navigate(url).catch(() => w.postMessage({ go: url })); }
    }
    return self.clients.openWindow(url);
  })());
});
