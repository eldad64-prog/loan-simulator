self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.registration.unregister()));
self.addEventListener("fetch",event=>event.respondWith(fetch(event.request)));