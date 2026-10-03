const CACHE_NAME = "loan-simulator-runtime-v4";
const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function injectCloudSync(response) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;

  const text = await response.text();
  if (text.includes("supabase-sync.js")) {
    return new Response(text, { status: response.status, headers: response.headers });
  }

  const injection =
    '<script src="' + SUPABASE_CDN + '"></script>' +
    '<script src="./supabase-sync.js?v=anon-fix-20261003"></script>';

  const html = text.replace(/<\/body>/i, injection + "</body>");
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (event.request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(injectCloudSync)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./", copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match("./"))
    );
  }
});