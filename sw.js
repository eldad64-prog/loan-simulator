// גרסה לביטול: לא שומרת דפים ולא מחזירה תוכן ישן.
// בהתקנה מוחקת את כל המטמון, מבטלת את עצמה, ומרעננת את הכרטיסיות הפתוחות.
self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(c => c.navigate(c.url));
  })());
});
