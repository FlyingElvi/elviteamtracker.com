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

// Push notifications (Nov 5): the API sends {title, body, url, tag} --
// shown as is; a tap opens the page in the app's window when one is open.
self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : '' };
  }
  const actions = Array.isArray(d.actions) ? d.actions.filter((a) => a && a.action && a.title).slice(0, 2) : [];
  const opts = {
    body: d.body || '',
    icon: '/assets/logo-192.png',
    badge: '/assets/badge-96.png',
    data: { url: d.url || '/', actions },
    // Buttons on the notification (Android, desktop Chrome; an iPhone
    // shows none and the tap opens the url).
    actions: actions.map((a) => ({ action: a.action, title: a.title })),
  };
  // Game over and the weekly coins replace their last one; the rest stack.
  if (d.tag === 'games' || d.tag === 'coins') opts.tag = d.tag;
  e.waitUntil(self.registration.showNotification(d.title || 'Elvi\'s Team Tracker', opts));
});

// What a button does before the page opens: the API call it stands for,
// with this device's session (same-site, so the cookie rides along).
const API = 'https://api.elviteamtracker.com';
const DOES = {
  'quest-draw': ['/me/quest', { action: 'draw' }],
  'coins-claim': ['/fc/claim', {}],
};

async function act(aName) {
  const call = DOES[aName];
  if (!call) return;
  try {
    await fetch(`${API}${call[0]}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-ETT': '1' },
      body: JSON.stringify(call[1]),
    });
  } catch { /* the page opens anyway, the gesture is there too */ }
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  const action = (data.actions || []).find((a) => a.action === e.action);
  const url = new URL((action && action.url) || data.url || '/', self.location.origin).href;
  e.waitUntil((async () => {
    if (e.action) await act(e.action);
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find((c) => c.url.startsWith(self.location.origin));
    if (open) {
      if ('navigate' in open) await open.navigate(url).catch(() => {});
      return open.focus();
    }
    return self.clients.openWindow(url);
  })());
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
