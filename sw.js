// The service worker (Nov 5): what lets a phone install the site as an app.
//
// It never touches the API (another origin, api.elviteamtracker.com): a
// card, a board, a game log, a pick is always live. On this origin, pages
// and data go to the network first and fall back to the last copy seen when
// there is none -- scripts and sheets included, so a deploy shows at the
// next open; the site's art and fonts come from the cache first and refresh
// behind.
//
// Bump CACHE to drop everything kept so far.
const CACHE = 'ett-1';
const ASSET = /\.(png|jpg|webp|svg|ico|ttf|woff2?)$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, true));
  } else if (ASSET.test(url.pathname)) {
    e.respondWith(cacheFirst(req));
  } else {
    e.respondWith(networkFirst(req, false));
  }
});

async function networkFirst(aReq, aPage) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(aReq);
    if (fresh.ok) cache.put(aReq, fresh.clone());
    return fresh;
  } catch (anErr) {
    const kept = await cache.match(aReq, { ignoreSearch: aPage });
    if (kept) return kept;
    if (!aPage) throw anErr;
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
      + '<title>Offline</title><body style="font-family:system-ui;background:#0b0f14;color:#e6edf3;'
      + 'display:grid;place-items:center;min-height:100vh;margin:0;text-align:center">'
      + '<div><h1>You\'re offline</h1><p>Elvi\'s Team Tracker needs a connection.<br>'
      + '<a style="color:#4cc2ff" href="">Try again</a></p></div>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function cacheFirst(aReq) {
  const cache = await caches.open(CACHE);
  const kept = await cache.match(aReq);
  const refresh = fetch(aReq).then((fresh) => {
    if (fresh.ok) cache.put(aReq, fresh.clone());
    return fresh;
  });
  if (kept) {
    refresh.catch(() => {});
    return kept;
  }
  return refresh;
}
