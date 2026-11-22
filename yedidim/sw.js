// Minimal service worker so Android can install the page as a real app (no Chrome badge).
// It stores nothing and changes no request: every request goes to the network as usual.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () {});
