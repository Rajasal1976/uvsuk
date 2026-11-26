// Lets phones install the back office as an app. It doesn't keep copies of anything:
// every screen and record always comes fresh from the website.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
