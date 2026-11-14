// "Sign in with Discord" in the nav (Oct 18) — shared by every generated
// section of the site (copied next to each page by the exporter).
//
// The public API's /auth routes do the work: Discord sign-in, open to any
// Discord account since Nov 4 (web only players need no server of the bot,
// they link their gamertag on the home page). This shows
// the state — "Sign in", or your picture and name opening a menu (your card's
// web switch, Log out) — and the message a sign-in came back with
// (?login=notmember|cancelled|failed).

const params = new URLSearchParams(location.search);
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = (LOCAL && params.get('api')) || 'https://api.elviteamtracker.com';

// ── The app (Nov 5): the site installed on a phone ───────────────────
// A PWA: /manifest.webmanifest and /sw.js make the site installable; here
// is what the installed app does differently -- a tab bar at the bottom
// instead of the site's nav, and its sign-in handed back by the API in the
// URL's fragment (an iPhone keeps the app's cookies apart from Safari's).
const UA = navigator.userAgent;
/** Running as the installed app (its own window, no browser chrome). */
export const STANDALONE = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  || (LOCAL && params.get('standalone') === '1'); // the lab's way to see the app
/** A phone or a tablet: where "install" means the Home Screen. */
const PHONE = /iPhone|iPad|iPod|Android/i.test(UA) || (/Mac/.test(UA) && navigator.maxTouchPoints > 1);
const IOS = /iPhone|iPad|iPod/i.test(UA) || (/Mac/.test(UA) && navigator.maxTouchPoints > 1);
if (STANDALONE) document.documentElement.classList.add('app');

/** Chrome's own install prompt (Android), kept for the Install button. */
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  document.dispatchEvent(new Event('ett:installable'));
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || LOCAL)) {
  navigator.serviceWorker.register('/sw.js').catch(() => { /* an old browser, a private window */ });
}

/**
 * The sign-in link of a page. The installed app asks for its session back
 * in the URL (app=1): see the API's hand-off.
 *
 * @param aBack the page to come back to (this one)
 */
export function loginUrl(aBack = location.pathname) {
  return `${API}/auth/login?return=${encodeURIComponent(aBack)}${STANDALONE ? '&app=1' : ''}`;
}

const MESSAGES = {
  notmember: 'Sign in is only for people who already have Elvi\'s Team Tracker in one of '
    + 'their Discord servers. Add the bot to your server, or join one that has it, then try again.',
  cancelled: 'Sign in cancelled — nothing was shared.',
  failed: 'Sign in didn\'t work — try again in a minute.',
};

const STYLE = `
.nav-auth {
  margin-left: 18px; font-size: 14px; color: var(--fg); text-decoration: none; white-space: nowrap;
  border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px;
}
.nav-auth:hover { border-color: var(--accent); }
.nav-user { margin-left: 18px; position: relative; }
.nav-user-btn {
  all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
  font-size: 14px; white-space: nowrap; padding: 3px 8px 3px 3px; border-radius: 999px;
  border: 1px solid transparent;
}
.nav-user-btn:hover, .nav-user-btn[aria-expanded="true"] { border-color: var(--line); background: var(--bg-elev); }
.nav-user-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.nav-user img { width: 26px; height: 26px; border-radius: 50%; display: block; background: var(--bg-elev); }
.nav-user-name { color: var(--fg); font-weight: 600; max-width: 14ch; overflow: hidden; text-overflow: ellipsis; }
.nav-user-caret { color: var(--fg-dim); font-size: 10px; }
.nav-menu {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; min-width: 230px;
  margin: 0; padding: 6px; list-style: none; background: var(--bg-elev);
  border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 12px 30px rgba(0,0,0,.35);
}
.nav-menu li > a, .nav-menu li > button {
  all: unset; box-sizing: border-box; display: block; width: 100%; cursor: pointer;
  padding: 8px 10px; border-radius: 8px; font-size: 14px; color: var(--fg); white-space: nowrap;
}
.nav-menu li > a:hover, .nav-menu li > button:hover,
.nav-menu li > a:focus-visible, .nav-menu li > button:focus-visible { background: var(--accent-soft); }
.nav-menu .nav-menu-note { padding: 8px 10px; font-size: 13px; color: var(--fg-dim); white-space: normal; }
.nav-menu .nav-menu-sep { height: 1px; background: var(--line); margin: 4px 2px; }
.nav-menu .nav-menu-icon { display: inline-block; width: 18px; height: 18px; margin-right: 8px; vertical-align: -4px; }
.nav-menu .nav-menu-art { border-radius: 0; background: none; object-fit: contain; }
.nav-links .nav-link-icon { display: inline-block; width: 18px; height: 18px; margin-right: 6px; vertical-align: -4px; object-fit: contain; }
.nav-links a[data-extra] { white-space: nowrap; }
/* The site's pages | YOUR pages (Nov 12, elvis): a group of their own that
   never breaks apart -- short of room, it moves to the next row whole -- with
   a thin line before it while it shares the site's row (.nav-mine-alone off). */
.nav-mine { flex-wrap: nowrap; padding-left: 20px; border-left: 1px solid var(--line); }
.nav-mine.nav-mine-alone { padding-left: 0; border-left: 0; }
/* Your pages + your account chip: one block that wraps whole. */
.nav-me { display: flex; align-items: center; gap: 20px; flex-wrap: nowrap; }
.nav-me .nav-user { margin-left: 0; }
/* Wrapped to a row of its own: on the right, under the site's tabs (elvis). */
.nav-me.nav-me-alone { margin-left: auto; }
/* Phone (Oct 21): the nav wrapped into three rows and left the picture alone
   on the last one, its menu anchored to its right edge and running off the
   screen to the left. The picture now sits at the end of the brand row (the
   brand pushes it right), the links get a row of their own, and the menu
   hangs under the whole (sticky) nav, full width — wherever the picture
   lands, even on a 320 px phone where it wraps under the brand. */
@media (max-width: 640px) {
  .nav .wrap { gap: 8px 16px; padding-top: 8px; padding-bottom: 8px; }
  .nav-links { order: 3; flex-basis: 100%; }
  /* The phone's own layout: the chip back on the brand row, your pages on a
     row of their own under the site's (the row says they are apart). */
  .nav-me { display: contents; }
  .nav-auth, .nav-user { margin-left: 0; }
  .nav-user { position: static; }
  .nav-user-name { max-width: 10ch; }
  .nav-menu { left: 16px; right: 16px; top: calc(100% - 2px); min-width: 0; }
  .nav-menu li > a, .nav-menu li > button { white-space: normal; padding: 11px 12px; }
}
.auth-banner {
  max-width: 900px; margin: 16px auto 0; padding: 12px 16px; border-radius: 10px;
  border: 1px solid var(--line); background: var(--bg-elev); color: var(--fg); font-size: 14px;
}
.auth-banner.warn { border-color: var(--warn); }
/* The installed app (Nov 5): no site nav, no footer, a tab bar at the
   bottom; the sticky nav keeps clear of the phone's status bar. */
html.app .nav-links, html.app footer.foot { display: none; }
html.app .nav { padding-top: env(safe-area-inset-top); }
html.app body { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
.app-tabs {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: flex;
  padding: 6px 0 calc(6px + env(safe-area-inset-bottom));
  background: var(--bg-sunk); border-top: 1px solid var(--line);
}
.app-tabs a {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 4px 0; text-decoration: none; color: var(--fg-dim); font-size: 11px; font-weight: 600;
  -webkit-tap-highlight-color: transparent;
}
.app-tabs a[aria-current="page"] { color: var(--accent); }
.app-tabs .app-ico { font-size: 22px; line-height: 1; width: 24px; height: 24px; display: grid; place-items: center; }
.app-tabs img.app-ico { object-fit: contain; }
/* In the app, what explains a page is read once on the site, never again
   (Nov 5, elvis): no page titles and notes, tight tops, the Picks header
   on one line. */
html.app main { padding-top: 12px; }
html.app .lb-head { display: none; }
html.app .lb-boards { padding-top: 0; }
html.app .pl-head { padding-top: 12px; }
html.app .fc { padding-top: 0; }
html.app .fc-top { padding: 8px 14px; gap: 6px 14px; }
html.app .fc-title { font-size: 15px; }
html.app .fc-balance b { display: inline; font-size: 18px; margin-right: 6px; }
html.app .fc-balance span { font-size: 10px; }
/* The bet slip docks at the bottom of the screen: in the app, above the
   tab bar, not under it (Nov 5, elvis: "the drawer doesn't show"). */
html.app .fc-slip { bottom: calc(68px + env(safe-area-inset-bottom)); }
html.app .fc { padding-bottom: 170px; }
/* "Get the app", on the home page of a phone that has not installed it. */
.install-banner {
  max-width: 900px; margin: 16px auto 0; padding: 12px 16px; border-radius: 10px;
  border: 1px solid var(--accent); background: var(--accent-soft); color: var(--fg); font-size: 14px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px 18px; flex-wrap: wrap;
}
.install-banner p { margin: 0; flex: 1 1 260px; }
.install-banner .install-share { display: inline-block; width: 16px; height: 16px; vertical-align: -3px; margin: 0 2px; }
.install-actions { display: flex; gap: 8px; }
.install-actions button {
  font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; padding: 7px 14px; border-radius: 8px;
  border: 1px solid var(--line); background: var(--bg-elev); color: var(--fg);
}
.install-actions button.install-go { border-color: var(--accent); background: var(--accent); color: #04121c; }
@media (max-width: 900px) { .install-banner, .auth-banner, .notify-panel { margin-left: 16px; margin-right: 16px; } }
/* Notifications (Nov 5): the switch, then one row per category. */
.notify-panel {
  max-width: 900px; margin: 16px auto 0; padding: 16px 18px; border-radius: 12px;
  border: 1px solid var(--line); background: var(--bg-elev); color: var(--fg); font-size: 14px;
}
.notify-panel h2 { margin: 0 0 4px; font-size: 18px; }
.notify-panel .notify-lede { margin: 0 0 12px; color: var(--fg-dim); }
.notify-panel .notify-msg { margin: 10px 0 0; min-height: 1.3em; color: var(--fg-dim); }
.notify-panel .notify-msg.bad { color: var(--warn); }
.notify-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
.notify-actions button {
  font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; padding: 8px 14px; border-radius: 8px;
  border: 1px solid var(--line); background: var(--bg); color: var(--fg);
}
.notify-actions button.notify-go { border-color: var(--accent); background: var(--accent); color: #04121c; }
.notify-actions button:disabled { opacity: .6; cursor: default; }
.notify-rows { list-style: none; margin: 10px 0 0; padding: 0; }
.notify-rows li { display: flex; align-items: center; gap: 14px; padding: 10px 0; border-top: 1px solid var(--line); }
.notify-rows label { flex: 1; cursor: pointer; }
.notify-rows label small { display: block; color: var(--fg-dim); }
.notify-rows input { width: 22px; height: 22px; accent-color: var(--accent); cursor: pointer; flex: none; }
.notify-rows li.notify-head { display: block; padding-bottom: 4px; }
.notify-rows li.notify-follow { display: block; border-top: 0; padding-top: 0; }
.notify-rows .notify-search input {
  width: 100%; max-width: 380px; height: auto; box-sizing: border-box; cursor: text;
  font: inherit; padding: 9px 11px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--fg);
}
.notify-found { max-width: 380px; margin-top: 4px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg-elev); overflow: hidden; }
.notify-found:empty { display: none; }
.notify-found button {
  display: block; width: 100%; text-align: left; font: inherit; font-size: 14px; cursor: pointer;
  padding: 9px 11px; border: 0; border-bottom: 1px solid var(--line); background: none; color: var(--fg);
}
.notify-found button:last-child { border-bottom: 0; }
.notify-found button small { color: var(--fg-dim); margin-left: 6px; }
.notify-found button:hover, .notify-found button:focus-visible { background: var(--bg); }
.notify-found button.notify-more { color: var(--accent); font-size: 13px; }
.notify-found p { margin: 0; padding: 9px 11px; color: var(--fg-dim); font-size: 14px; }
.notify-rows .notify-clubs { list-style: none; margin: 8px 0 0; padding: 0; }
.notify-rows .notify-clubs > li { display: block; padding: 10px 0; border-top: 0; border-bottom: 1px solid var(--line); }
.notify-club-head { display: flex; align-items: center; gap: 12px; }
.notify-club-head label { font-weight: 600; }
.notify-modes { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; }
.notify-rows .notify-modes label {
  flex: none; font-size: 13px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--bg);
}
.notify-rows .notify-modes input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.notify-rows .notify-modes label.on { border-color: var(--accent); background: var(--accent); color: #04121c; font-weight: 600; }
.notify-rows .notify-modes label:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.notify-clubs li.notify-off .notify-club-head label { color: var(--fg-dim); text-decoration: line-through; }
.notify-clubs li.notify-off .notify-modes { display: none; }
`;

/**
 * Mounts the nav's sign-in link and the sign-in message.
 *
 * @returns the /auth/me answer ({signedIn, name, premium, gamertag}) plus
 *          available: true; {signedIn: false, available: false} when the API
 *          does not answer or sign-in is off
 */
export async function mountAuth() {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);

  const login = params.get('login');
  if (login && MESSAGES[login]) {
    const banner = document.createElement('p');
    banner.className = `auth-banner${login === 'notmember' ? ' warn' : ''}`;
    banner.setAttribute('role', 'status');
    banner.textContent = MESSAGES[login];
    document.querySelector('nav.nav')?.after(banner);
    params.delete('login');
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : ''));
  }

  // The last signed-in answer draws the menu at once (Oct 23, elvis: it
  // vanished between pages, for the API's round trip, and for a whole
  // minute while the server restarted). Only what /auth/me gave THIS
  // browser, and only while it was signed in; the live answer then wins.
  const cached = readMe();
  if (cached) drawAuth(cached);
  // A card switched on or off here keeps the kept answer true.
  document.addEventListener('ett:webcard', (e) => {
    const c = readMe();
    if (c) writeMe({ ...c, webCard: e.detail });
  });
  let me = { signedIn: false, available: false };
  // The installed app's session, handed back in the fragment by the sign-in
  // it asked for (see the API's hand-off): claimed once, into its own jar.
  const token = location.hash.match(/^#app=([A-Za-z0-9_-]{32})$/)?.[1];
  if (token) {
    history.replaceState(null, '', location.pathname + location.search);
    try {
      const r = await fetch(`${API}/auth/claim`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-ETT': '1' },
        body: JSON.stringify({ token }),
      });
      if (r.ok) {
        me = { ...(await r.json()), available: true };
        writeMe(me);
        drawAuth(me);
        drawApp(me);
        return me;
      }
    } catch { /* the regular /auth/me follows */ }
  }
  try {
    // 10 s: a server just restarted can be slow for a moment, and that must
    // not read as "down".
    const r = await fetch(`${API}/auth/me`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      me = { ...(await r.json()), available: true };
    } else if (r.status >= 500) {
      // The API is down (a restart, the tunnel): keep what was drawn.
      if (cached) drawApp(cached);
      return cached ? { ...cached, available: false } : me;
    } else {
      // Sign-in is off: no link at all.
      writeMe(null);
      clearAuth();
      return me;
    }
  } catch {
    // The API is down: keep what was drawn; a fresh Sign in would lead nowhere.
    if (cached) drawApp(cached);
    return cached ? { ...cached, available: false } : me;
  }
  writeMe(me);
  if (!cached || JSON.stringify(slim(cached)) !== JSON.stringify(slim(me))) drawAuth(me);
  drawApp(me);
  return me;
}

/** What the app adds to a page: its tab bar, or the nudge to install it. */
function drawApp(aMe) {
  drawAppBar(aMe);
  drawInstallBanner(aMe);
  drawNotifyPanel(aMe);
  // The installed app says hello once a day (Nov 5): the admin's 📱.
  if (STANDALONE && aMe.signedIn && !LOCAL) {
    try {
      const last = Number(localStorage.getItem('ett-app-seen') || 0);
      if (Date.now() - last > 20 * 3600 * 1000) {
        localStorage.setItem('ett-app-seen', String(Date.now()));
        siteWrite('/me/app').catch(() => { try { localStorage.removeItem('ett-app-seen'); } catch { /* nothing */ } });
      }
    } catch { /* private window */ }
  }
  // Outside the app (Nov 11): a phone's browser or a desktop, once a day --
  // who signs in on a phone and never installs. A measure only: never
  // awaited, every failure swallowed, nothing on the page depends on it.
  if (!STANDALONE && aMe.signedIn && !LOCAL) {
    try {
      const kind = (navigator.userAgentData?.mobile ?? /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent))
        ? 'mobile' : 'desktop';
      const key = `ett-device-seen-${kind}`;
      const last = Number(localStorage.getItem(key) || 0);
      if (Date.now() - last > 20 * 3600 * 1000) {
        localStorage.setItem(key, String(Date.now()));
        siteWrite('/me/device', { kind }).catch(() => { /* a measure, nothing to do */ });
      }
    } catch { /* private window, old browser: nothing */ }
  }
}

// ── Notifications (Nov 5) ─────────────────────────────────────────────
// The browser's push subscription, kept by the API with the categories
// this browser wants (/me/push). The permission is asked on the click,
// never on load: Safari and Firefox refuse it otherwise.
const PUSH_OK = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const b64ToBytes = (aText) => {
  const pad = '='.repeat((4 - (aText.length % 4)) % 4);
  const raw = atob((aText + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** The page's service worker, once active -- or an error after five seconds. */
const swReady = () => Promise.race([
  navigator.serviceWorker.ready,
  new Promise((_, reject) => setTimeout(() => reject(new Error('no service worker')), 5000)),
]);

/** This browser's subscription, or null. */
async function pushSubscription() {
  try {
    const reg = await swReady();
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** Tells the API what this browser wants. */
async function pushSave(aSub, aCats) {
  const j = aSub.toJSON();
  return siteWrite('/me/push', { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, cats: aCats });
}

/**
 * The Notifications panel of the home page (?notify=1, from the account
 * menu): Turn on, then one switch per category; Send me a test; Turn off.
 */
async function drawNotifyPanel(aMe) {
  if (location.pathname !== '/' || params.get('notify') !== '1' || !aMe.signedIn) return;
  if (document.querySelector('.notify-panel')) return;
  const box = document.createElement('section');
  box.className = 'notify-panel';
  box.setAttribute('aria-labelledby', 'notify-title');
  const h = document.createElement('h2');
  h.id = 'notify-title';
  h.textContent = '🔔 Notifications';
  const lede = document.createElement('p');
  lede.className = 'notify-lede';
  const msg = document.createElement('p');
  msg.className = 'notify-msg';
  msg.setAttribute('role', 'status');
  const tell = (aText, aBad) => { msg.textContent = aText; msg.classList.toggle('bad', !!aBad); };
  const actions = document.createElement('div');
  actions.className = 'notify-actions';
  const rows = document.createElement('ul');
  rows.className = 'notify-rows';
  box.append(h, lede, actions, rows, msg);
  document.querySelector('nav.nav')?.after(box);
  // A phone that is here from the menu scrolls to the panel, not the card.
  box.scrollIntoView({ block: 'start' });

  const button = (aLabel, aPrimary, anOnClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = aLabel;
    if (aPrimary) b.className = 'notify-go';
    b.addEventListener('click', async () => {
      b.disabled = true;
      try { await anOnClick(); } finally { b.disabled = false; }
    });
    return b;
  };

  if (!PUSH_OK) {
    lede.textContent = IOS && !STANDALONE
      ? 'On an iPhone, notifications need the app installed: tap Share, then Add to Home Screen, and come back here from the app.'
      : 'This browser doesn\'t do notifications. Try Chrome, Firefox, Edge or Safari.';
    return;
  }
  lede.textContent = 'On your phone, as they happen: your picks, your duels, your challenges — each kind its own switch.';

  let info;
  try {
    const sub = await pushSubscription();
    const r = await fetch(`${API}/me/push${sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : ''}`,
      { credentials: 'include', cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    info = { ...(await r.json()), sub };
  } catch {
    tell('Couldn\'t reach the server — try again in a minute.', true);
    return;
  }
  if (!info.key) {
    lede.textContent = 'Notifications aren\'t switched on server side yet.';
    return;
  }

  const draw = () => {
    actions.replaceChildren();
    rows.replaceChildren();
    const on = info.sub && Array.isArray(info.cats);
    if (Notification.permission === 'denied') {
      tell('Notifications are blocked for this site in your browser\'s settings — allow them there first.', true);
      return;
    }
    if (!on) {
      actions.append(button('Turn on notifications', true, async () => {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { tell('No permission, no notifications — you can change your mind in your browser\'s settings.', true); draw(); return; }
        let sub;
        try {
          const reg = await swReady();
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(info.key) });
        } catch (anErr) {
          tell(`Couldn't set it up here (${anErr.message}). Reload the page and try again.`, true);
          return;
        }
        const j = await pushSave(sub, info.defaults);
        info.sub = sub;
        info.cats = j.cats;
        tell('On. Pick what you want to hear about:');
        draw();
      }));
      return;
    }
    // One switch = one category on or off, the rest kept as they are.
    const flip = async (aKey, aOn, aLabel, anInput) => {
      const cats = info.cats.filter((k) => k !== aKey);
      if (aOn) cats.push(aKey);
      anInput.disabled = true;
      try {
        info.cats = (await pushSave(info.sub, cats)).cats;
        tell(aOn ? `${aLabel}: on.` : `${aLabel}: off.`);
      } catch {
        anInput.checked = !aOn;
        tell('Couldn\'t save that — try again.', true);
      } finally {
        anInput.disabled = false;
      }
    };
    const row = (aKey, aLabel, aWhat, aInto, aSmallRow) => {
      const li = document.createElement('li');
      if (aSmallRow) li.className = 'notify-sub';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `notify-${aKey.replace(/[^a-z0-9]/gi, '-')}`;
      input.checked = info.cats.includes(aKey);
      const label = document.createElement('label');
      label.htmlFor = input.id;
      label.append(aLabel);
      if (aWhat) {
        const small = document.createElement('small');
        small.textContent = aWhat;
        label.append(small);
      }
      input.addEventListener('change', () => flip(aKey, input.checked, aLabel, input));
      li.append(label, input);
      aInto.append(li);
      return li;
    };
    for (const c of info.categories) row(c.key, c.label, c.what, rows);
    // Game scores (Nov 6, elvis: "simple, clair et evident"): type a club,
    // pick it, choose how much of it. A tick per club to stop (traded!).
    const MODES = [['all', 'All'], ['league', 'League'], ['out', 'When not in lineup']];
    const SAID = { all: 'every game', league: 'league games', out: 'games you sit out' };
    const head = document.createElement('li');
    head.className = 'notify-head';
    head.innerHTML = '<label>Game scores<small>Type a club, then pick how much of it. Untick to stop.</small></label>';
    rows.append(head);
    const fol = document.createElement('li');
    fol.className = 'notify-follow';
    const search = document.createElement('div');
    search.className = 'notify-search';
    const q = document.createElement('input');
    q.type = 'search';
    q.placeholder = 'Type a club name';
    q.maxLength = 40;
    q.autocomplete = 'off';
    q.setAttribute('aria-label', 'Club name');
    const found = document.createElement('div');
    found.className = 'notify-found';
    search.append(q, found);
    const list = document.createElement('ul');
    list.className = 'notify-clubs';
    fol.append(search, list);
    rows.append(fol);
    const clubs = info.clubs || [];
    // One club's mode on the server (off = stop); the answer is the club row.
    const save = async (aClubId, aName, aMode) => {
      const j = await siteWrite('/me/push/club',
        { endpoint: info.sub.endpoint, clubId: String(aClubId), clubName: aName, mode: aMode });
      info.cats = j.cats;
      return j.club;
    };
    const drawClub = (c) => {
      const li = document.createElement('li');
      li.classList.toggle('notify-off', c.mode === 'off');
      const top = document.createElement('div');
      top.className = 'notify-club-head';
      const tick = document.createElement('input');
      tick.type = 'checkbox';
      tick.id = `notify-club-${c.clubId}`;
      tick.checked = c.mode !== 'off';
      const name = document.createElement('label');
      name.htmlFor = tick.id;
      name.textContent = c.name;
      top.append(tick, name);
      const modes = document.createElement('div');
      modes.className = 'notify-modes';
      modes.setAttribute('role', 'radiogroup');
      modes.setAttribute('aria-label', `${c.name}: which games`);
      const pills = [];
      const show = (aMode) => {
        for (const [p, r] of pills) { r.checked = r.value === aMode; p.classList.toggle('on', r.checked); }
      };
      for (const [mode, label] of MODES) {
        if (mode === 'league' && !c.league) continue; // a league club only
        const pill = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `notify-mode-${c.clubId}`;
        radio.value = mode;
        pill.append(radio, label);
        pills.push([pill, radio]);
        radio.addEventListener('change', async () => {
          if (!radio.checked) return;
          const was = c.mode;
          show(mode);
          for (const [, r] of pills) r.disabled = true;
          try {
            await save(c.clubId, c.name, mode);
            c.mode = mode;
            tell(`${c.name}: ${SAID[mode]}.`);
          } catch (anErr) {
            show(was);
            tell(anErr.message || 'Couldn\'t save that — try again.', true);
          } finally {
            for (const [, r] of pills) r.disabled = false;
          }
        });
        modes.append(pill);
      }
      show(c.mode);
      tick.addEventListener('change', async () => {
        const mode = tick.checked ? (c.was || 'all') : 'off';
        tick.disabled = true;
        try {
          await save(c.clubId, c.name, mode);
          if (mode === 'off') c.was = c.mode;
          c.mode = mode;
          li.classList.toggle('notify-off', mode === 'off');
          show(mode);
          tell(mode === 'off' ? `${c.name}: no more scores.` : `${c.name}: ${SAID[mode]}.`);
        } catch (anErr) {
          tick.checked = !tick.checked;
          tell(anErr.message || 'Couldn\'t save that — try again.', true);
        } finally {
          tick.disabled = false;
        }
      });
      li.append(top, modes);
      return li;
    };
    const drawClubs = () => list.replaceChildren(...clubs.map(drawClub));
    drawClubs();
    let asked = 0;
    // A pick: followed in All (tracked on the way in when nobody polls it).
    const pick = async (aClubId, aName, aButton) => {
      aButton.disabled = true;
      try {
        const club = await save(aClubId, aName, 'all');
        const at = clubs.findIndex((x) => String(x.clubId) === String(club.clubId));
        if (at >= 0) clubs[at] = club; else clubs.push(club);
        drawClubs();
        asked++;
        found.replaceChildren();
        q.value = '';
        tell(`${club.name}: every game. ${club.league ? 'League or' : 'Or'} When not in lineup, if you'd rather.`);
      } catch (anErr) {
        aButton.disabled = false;
        tell(anErr.message || 'Couldn\'t add that club — try again.', true);
      }
    };
    const following = (anId) => clubs.some((x) => String(x.clubId) === String(anId) && x.mode !== 'off');
    const choice = (aClubId, aName, aNote) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.append(aName);
      if (aNote) {
        const small = document.createElement('small');
        small.textContent = aNote;
        b.append(small);
      }
      b.addEventListener('click', () => pick(aClubId, aName, b));
      return b;
    };
    // EA's own index: a club the bot never saw. Tracked when picked.
    const searchEa = async (aName) => {
      const mine = ++asked;
      const wait = document.createElement('p');
      wait.textContent = 'Asking EA…';
      found.replaceChildren(wait);
      try {
        const r = await fetch(`${API}/me/clubsearch?name=${encodeURIComponent(aName)}`, { credentials: 'include' });
        const j = await r.json();
        if (mine !== asked) return;
        const hits = (j.clubs || []).filter((c) => !following(c.clubId)).slice(0, 8);
        if (!hits.length) {
          wait.textContent = `No club called "${aName}" at EA either.`;
          return;
        }
        found.replaceChildren(...hits.map((c) => choice(c.clubId, c.name,
          c.division ? `EA · division ${c.division}` : 'EA')));
      } catch {
        if (mine === asked) wait.textContent = 'EA didn\'t answer — try again in a moment.';
      }
    };
    // As you type: the clubs we know first; none, and EA is asked.
    const searchHere = async (aName) => {
      const mine = ++asked;
      try {
        const r = await fetch(`${API}/clubs?q=${encodeURIComponent(aName)}`, { credentials: 'include' });
        const j = await r.json();
        if (mine !== asked) return;
        const hits = (j.clubs || []).filter((c) => !following(c.clubId)).slice(0, 8);
        if (!hits.length) { searchEa(aName); return; }
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'notify-more';
        more.textContent = `Not there? Search EA for "${aName}"`;
        more.addEventListener('click', () => searchEa(aName));
        found.replaceChildren(...hits.map((c) => choice(c.clubId, c.name,
          c.games ? `${c.games} game${c.games === 1 ? '' : 's'}` : '')), more);
      } catch {
        if (mine === asked) found.replaceChildren();
      }
    };
    let timer = 0;
    q.addEventListener('input', () => {
      clearTimeout(timer);
      const name = q.value.trim();
      if (name.length < 2) { asked++; found.replaceChildren(); return; }
      timer = setTimeout(() => searchHere(name), 300);
    });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); found.querySelector('button')?.click(); }
      if (e.key === 'Escape') { asked++; found.replaceChildren(); }
    });
    actions.append(
      button('Send me a test', false, async () => {
        try {
          await siteWrite('/me/push/test', { endpoint: info.sub.endpoint });
          tell('Sent — it should show up in a moment.');
        } catch (anErr) {
          tell(anErr.message || 'Couldn\'t send it.', true);
        }
      }),
      button('Turn off', false, async () => {
        try { await siteWrite('/me/push/off', { endpoint: info.sub.endpoint }); } catch { /* the row may be gone already */ }
        await info.sub.unsubscribe().catch(() => {});
        info.sub = null;
        info.cats = null;
        tell('Off. This browser gets nothing until you turn it on again.');
        draw();
      }),
    );
  };
  draw();
}

/**
 * A section icon (Nov 11, elvis): the hand-made art, pre-sized and moire-free
 * (lab/icons/make-icons.py), in /playercards/art/face-<art>-48|72.png (2x, 3x
 * of 24 css px). A missing file falls back to the emoji. card.js faceIcon's
 * twin: this module does not import card.js.
 */
const MENU_ICON = 'nav-menu-icon nav-menu-art';
function sectionIcon(aArt, aEmoji, aClass) {
  const img = document.createElement('img');
  img.src = `/playercards/art/face-${aArt}-48.png`;
  img.srcset = `/playercards/art/face-${aArt}-48.png 2x, /playercards/art/face-${aArt}-72.png 3x`;
  img.alt = '';
  img.decoding = 'async';
  if (aClass) img.className = aClass;
  img.addEventListener('error', () => {
    const span = document.createElement('span');
    span.textContent = aEmoji;
    span.className = img.className;
    span.setAttribute('aria-hidden', 'true');
    img.replaceWith(span);
  }, { once: true });
  return img;
}

/** A page's link, with the lab's API on localhost. */
// Your pages' routes (Nov 12, elvis): the Leaderboards page under paths of
// their own; the old ?board= links still land.
const MINE_ROUTES = { me: '/myplayer/', myclubs: '/myclubs/' };
function onMine(anId) {
  const board = location.pathname.startsWith('/leaderboards/') ? params.get('board') : null;
  return location.pathname.startsWith(MINE_ROUTES[anId])
    ? !params.get('board') || params.get('board') === anId : board === anId;
}

function pageHref(aHref) {
  const api = LOCAL && params.get('api')
    ? `${aHref.includes('?') ? '&' : '?'}api=${encodeURIComponent(params.get('api'))}` : '';
  return `${aHref}${api}`;
}

/**
 * The installed app's tab bar (Nov 5), once signed in with a gamertag
 * linked: My card (the home page), My player, and the API's own ways in
 * (My Picks) when you have them.
 */
function drawAppBar(aMe) {
  document.querySelector('.app-tabs')?.remove();
  if (!STANDALONE || !aMe.signedIn || !aMe.gamertag) return;
  const tabs = [
    { href: '/', icon: '🃏', art: 'card', label: 'My card', on: location.pathname === '/' },
    { href: MINE_ROUTES.me, icon: '📊', art: 'player', label: 'My player', on: onMine('me') },
    // My clubs (Nov 12): every game of your clubs, yours or not.
    { href: MINE_ROUTES.myclubs, icon: '🏒', art: 'clubs', label: 'My clubs', on: onMine('myclubs') },
  ];
  for (const link of aMe.links ?? []) {
    tabs.push({ href: link.href, icon: link.icon ?? '•', label: String(link.label).replace(/^My /, ''),
      on: location.pathname.startsWith(link.href) });
  }
  const bar = document.createElement('nav');
  bar.className = 'app-tabs';
  bar.setAttribute('aria-label', 'App');
  for (const t of tabs) {
    const a = document.createElement('a');
    a.href = pageHref(t.href);
    let ico;
    if (t.art) {
      ico = sectionIcon(t.art, t.icon);
    } else if (t.icon.startsWith('/')) {
      ico = document.createElement('img');
      ico.src = t.icon;
      ico.alt = '';
    } else {
      ico = document.createElement('span');
      ico.textContent = t.icon;
      ico.setAttribute('aria-hidden', 'true');
    }
    ico.className = 'app-ico';
    const label = document.createElement('span');
    label.textContent = t.label;
    a.append(ico, label);
    if (t.on) a.setAttribute('aria-current', 'page');
    bar.append(a);
  }
  document.body.append(bar);
}

const INSTALL_KEY = 'ett-install-no';
const SHARE_ICON = '<svg class="install-share" viewBox="0 0 16 16" aria-hidden="true"><path fill="none" '
  + 'stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" '
  + 'd="M8 1.5v9M5 4.5l3-3 3 3M3.5 7.5h-1v7h11v-7h-1"/></svg>';

/**
 * "Get the app" on the home page of a phone that has not installed it (Nov
 * 5, elvis): Chrome's Install button where it offers one, the two taps on
 * an iPhone. Not now hides it a month; the account menu's Install the app
 * (?install=1) brings it back.
 */
function drawInstallBanner(aMe) {
  if (location.pathname !== '/' || STANDALONE || !PHONE || !aMe.signedIn || !aMe.gamertag) return;
  if (document.querySelector('.install-banner')) return;
  const asked = params.get('install') === '1';
  if (asked) {
    params.delete('install');
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : ''));
  }
  try {
    if (!asked && Date.now() - Number(localStorage.getItem(INSTALL_KEY) || 0) < 30 * 864e5) return;
  } catch { /* private window */ }
  const box = document.createElement('div');
  box.className = 'install-banner';
  box.setAttribute('role', 'status');
  const text = document.createElement('p');
  const actions = document.createElement('div');
  actions.className = 'install-actions';
  const no = document.createElement('button');
  no.type = 'button';
  no.textContent = 'Not now';
  no.addEventListener('click', () => {
    try { localStorage.setItem(INSTALL_KEY, String(Date.now())); } catch { /* private window */ }
    box.remove();
  });
  const draw = () => {
    actions.replaceChildren();
    if (installPrompt) {
      text.innerHTML = '<strong>Get the app.</strong> Your card, your stats and your picks, one tap from your Home Screen.';
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'install-go';
      go.textContent = 'Install';
      go.addEventListener('click', async () => {
        const prompt = installPrompt;
        installPrompt = null;
        prompt.prompt();
        const choice = await prompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
        if (choice.outcome === 'accepted') box.remove(); else draw();
      });
      actions.append(go);
    } else if (IOS) {
      text.innerHTML = `<strong>Get the app:</strong> tap Share ${SHARE_ICON} then <strong>Add to Home Screen</strong>. `
        + 'Your card, your stats and your picks, one tap away.';
    } else {
      // Chrome hands out its prompt only after a tap on the page (elvis,
      // Nov 5: "not one tap away if there's no button"): the Install tap IS
      // that tap, so wait a moment for the prompt before falling back.
      text.innerHTML = '<strong>Get the app.</strong> Your card, your stats and your picks, one tap from your Home Screen.';
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'install-go';
      go.textContent = 'Install';
      go.addEventListener('click', async () => {
        go.disabled = true;
        go.textContent = 'One moment…';
        const deadline = Date.now() + 2500;
        while (!installPrompt && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
        if (installPrompt) { draw(); actions.querySelector('.install-go')?.click(); return; }
        text.innerHTML = '<strong>Almost:</strong> open Chrome\'s menu ⋮ and choose <strong>Install app</strong> '
          + '(or Add to Home screen). If it says <strong>Open app</strong>, the app is still installed.';
        actions.replaceChildren(no);
      });
      actions.append(go);
    }
    actions.append(no);
  };
  document.addEventListener('ett:installable', draw);
  draw();
  box.append(text, actions);
  document.querySelector('nav.nav')?.after(box);
}

const ME_KEY = 'ett-me';
const ME_MAX_AGE = 12 * 3600 * 1000;

/** The fields a header is drawn from. */
const slim = (aMe) => ({ signedIn: !!aMe.signedIn, name: aMe.name, avatarUrl: aMe.avatarUrl,
  webCard: aMe.webCard ?? null, links: aMe.links ?? [], gamertag: aMe.gamertag ?? null,
  webOnly: !!aMe.webOnly });

/** The last signed-in /auth/me answer this browser got, if recent. */
function readMe() {
  try {
    const c = JSON.parse(localStorage.getItem(ME_KEY) || 'null');
    if (c && c.me?.signedIn && Date.now() - c.at < ME_MAX_AGE) return c.me;
  } catch { /* private window, or a bad value */ }
  return null;
}

/** Keeps a signed-in answer, forgets anything else. */
function writeMe(aMe) {
  try {
    if (aMe?.signedIn) localStorage.setItem(ME_KEY, JSON.stringify({ at: Date.now(), me: aMe }));
    else localStorage.removeItem(ME_KEY);
  } catch { /* private window */ }
}

/** Takes the header's sign-in state off: menu, Sign in, the server's links. */
function clearAuth() {
  document.querySelectorAll('.nav .nav-user, .nav .nav-auth, .nav-links a[data-extra], .nav .nav-me')
    .forEach((el) => el.remove());
}

/** The line before your pages only while they share the site's row: alone
 *  on a row of their own, the row itself says they are apart. */
let mineObserver = null;
function watchMine(aGroup, aLinks) {
  const check = () => {
    // Measured without the right push, which would not change the row.
    const alone = aGroup.getBoundingClientRect().top > aLinks.getBoundingClientRect().top + 4;
    aGroup.classList.toggle('nav-mine-alone', alone);
    aGroup.parentElement.classList.toggle('nav-me-alone', alone);
  };
  mineObserver?.disconnect();
  // The row and the group itself (it is filled right after this call).
  mineObserver = new ResizeObserver(check);
  mineObserver.observe(aLinks.parentElement); // the header's row: a resize
  mineObserver.observe(aGroup);
}

/** Draws the header's sign-in state from an /auth/me answer. */
function drawAuth(aMe) {
  clearAuth();
  const me = aMe;
  const back = encodeURIComponent(location.pathname);
  const nav = document.querySelector('.nav .wrap');
  if (me.signedIn) {
    const user = userMenu(me, back);
    // The server's extra ways in, in the header too (Oct 23, elvis), after
    // the page's own links. Worded by /auth/me for whom they exist: the page
    // names none, a visitor gets none.
    const links = document.querySelector('.nav-links');
    // My player in the header (Nov 4, elvis): your own stats, one click from
    // any page, for whoever has a gamertag linked.
    // Their section art in the header too (Nov 12, elvis), like My Picks' coin.
    const mine = me.gamertag
      ? [{ id: 'me', label: 'My player', href: MINE_ROUTES.me, art: 'player', emoji: '📊' },
        { id: 'myclubs', label: 'My clubs', href: MINE_ROUTES.myclubs, art: 'clubs', emoji: '🏒' }] : [];
    // My player and My clubs: the Leaderboards page, on routes of their own.
    const onBoard = onMine;
    // YOUR pages -- the app's tabs -- are a group of their own after every
    // page of the site (Nov 12, elvis): a line between the two, and they wrap
    // WHOLE to the next row, your account chip with them, when the header
    // runs out of room -- the signed-in side together, never split.
    const extras = [...mine, ...(me.links ?? [])];
    const group = document.createElement('div');
    group.className = 'nav-links nav-mine';
    if (links && extras.length) {
      const side = document.createElement('div');
      side.className = 'nav-me';
      side.append(group, user);
      links.after(side);
      watchMine(group, links);
    } else {
      nav?.append(user);
    }
    for (const link of extras) {
      if (!links || group.querySelector(`[data-extra="${CSS.escape(String(link.id))}"]`)) continue;
      const a = document.createElement('a');
      a.dataset.extra = link.id;
      if (link.art) {
        a.append(sectionIcon(link.art, link.emoji, 'nav-link-icon'));
      } else if (link.icon) {
        const img = document.createElement('img');
        img.className = 'nav-link-icon';
        img.src = link.icon;
        img.alt = '';
        a.append(img);
      }
      a.append(link.label);
      const api = LOCAL && params.get('api')
        ? `${link.href.includes('?') ? '&' : '?'}api=${encodeURIComponent(params.get('api'))}` : '';
      a.href = `${link.href}${api}`;
      const board = link.id === 'me' || link.id === 'myclubs';
      if (board ? onBoard(link.id) : location.pathname.startsWith(link.href)) {
        // A board of the Leaderboards page: its tab, not both.
        if (board) {
          links.querySelectorAll('a[aria-current]').forEach((x) => x.removeAttribute('aria-current'));
        }
        a.setAttribute('aria-current', 'page');
      }
      group.append(a);
    }
  } else {
    const a = document.createElement('a');
    a.className = 'nav-auth';
    a.textContent = 'Sign in';
    a.href = loginUrl();
    a.title = 'With your Discord account';
    nav?.append(a);
  }
}

/**
 * Puts the signed-in user's card on the web, or takes it off — the site's one
 * write (see the API's /me/webcard), on their own card only. Tells the page
 * through an "ett:webcard" event so a "your card" bar can follow.
 */
export async function setWebCard(aOn) {
  const r = await fetch(`${API}/me/webcard`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-ETT': '1' },
    body: JSON.stringify({ on: aOn }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  document.dispatchEvent(new CustomEvent('ett:webcard', { detail: aOn }));
}

/** The API's address (the lab's on localhost with ?api=). */
export const API_BASE = API;

/** A write of the site, for the session's own user: JSON in, JSON out. */
async function siteWrite(aPath, aBody) {
  const r = await fetch(`${API}${aPath}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-ETT': '1' },
    body: JSON.stringify(aBody ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j.error || `HTTP ${r.status}`);
    err.status = r.status;
    err.body = j;
    throw err;
  }
  return j;
}

/**
 * Links the signed-in user's gamertag (Nov 4) — the site's /trackme. The
 * card goes on the web with it: the form says so before the click.
 */
export async function linkGamertag(aGamertag) {
  const j = await siteWrite('/me/link', { gamertag: aGamertag });
  writeMe(null); // the kept header is stale now
  return j;
}

/** The club of a gamertag we never saw: EA's index, by the start of its name. */
export async function searchClub(aName) {
  const r = await fetch(`${API}/me/clubsearch?name=${encodeURIComponent(aName)}`,
    { credentials: 'include', cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j.clubs ?? [];
}

/** Starts following that club (an orphan: posted nowhere). */
export const trackClub = (aClubId, aName) => siteWrite('/me/trackclub', { clubId: aClubId, clubName: aName });

/**
 * Remove card (Nov 4). A web only player: the right to be forgotten — his
 * Discord unlinked from his gamertag and the card off the web (his games
 * stay, EA's public data). Anybody else: the card off the web.
 */
export async function removeCard() {
  const j = await siteWrite('/me/remove');
  writeMe(null);
  document.dispatchEvent(new CustomEvent('ett:webcard', { detail: false }));
  return j;
}

/**
 * The signed-in menu: your Discord picture and name (straight from Discord's
 * CDN, in YOUR browser only), opening onto your card's web switch, My player
 * and Log out.
 * Putting a card ON the web always goes through the consent box of the Cards
 * page; taking it off is a confirm away.
 */
function userMenu(aMe, aBack) {
  const wrap = document.createElement('div');
  wrap.className = 'nav-user';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-user-btn';
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');
  const img = document.createElement('img');
  img.src = aMe.avatarUrl;
  img.alt = '';
  img.width = 26;
  img.height = 26;
  img.referrerPolicy = 'no-referrer';
  const name = document.createElement('span');
  name.className = 'nav-user-name';
  name.textContent = aMe.name;
  const caret = document.createElement('span');
  caret.className = 'nav-user-caret';
  caret.textContent = '▾';
  caret.setAttribute('aria-hidden', 'true');
  btn.append(img, name, caret);

  const menu = document.createElement('ul');
  menu.className = 'nav-menu';
  menu.setAttribute('role', 'menu');
  menu.hidden = true;

  const item = (aNode) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'none');
    if (aNode.tagName === 'A' || aNode.tagName === 'BUTTON') aNode.setAttribute('role', 'menuitem');
    li.append(aNode);
    menu.append(li);
    return li;
  };
  const note = (aText) => {
    const p = document.createElement('div');
    p.className = 'nav-menu-note';
    p.textContent = aText;
    return p;
  };

  // My player (Oct 19): your stats and game log, on the Leaderboards page.
  const myPlayer = () => {
    const a = document.createElement('a');
    a.setAttribute('role', 'menuitem');
    // the app's tab icons, in the menu too (Nov 5, elvis) -- the art since Nov 11
    a.append(sectionIcon('player', '📊', MENU_ICON), 'My player');
    a.href = pageHref(MINE_ROUTES.me);
    return a;
  };
  // My clubs (Nov 12): every game of your clubs, next to My player.
  const myClubsItem = () => {
    const a = document.createElement('a');
    a.setAttribute('role', 'menuitem');
    a.append(sectionIcon('clubs', '🏒', MENU_ICON), 'My clubs');
    a.href = pageHref(MINE_ROUTES.myclubs);
    return a;
  };

  // The card's web switch, redrawn when it flips (here or on the Cards page).
  const cardItem = document.createElement('li');
  cardItem.setAttribute('role', 'none');
  menu.append(cardItem);
  // Remove sits apart, under the line with Log out (Nov 4, elvis): the
  // pages first, the gestures that undo things last.
  const removeItem = document.createElement('li');
  removeItem.setAttribute('role', 'none');
  const drawCard = () => {
    cardItem.replaceChildren();
    removeItem.replaceChildren();
    if (!aMe.gamertag) {
      // The home page links it (Nov 4) — no Discord server needed.
      const link = document.createElement('a');
      link.setAttribute('role', 'menuitem');
      link.textContent = 'Link my gamertag';
      const api = LOCAL && params.get('api') ? `?api=${encodeURIComponent(params.get('api'))}` : '';
      link.href = `/${api}`;
      cardItem.append(link);
    } else if (aMe.webCard) {
      const mine = document.createElement('a');
      mine.setAttribute('role', 'menuitem');
      mine.append(sectionIcon('card', '🃏', MENU_ICON), 'My card');
      const api = LOCAL && params.get('api') ? `?api=${encodeURIComponent(params.get('api'))}` : '';
      mine.href = `/playercards/${api}#${aMe.slug}`;
      mine.addEventListener('click', () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); });
      const off = document.createElement('button');
      off.type = 'button';
      off.setAttribute('role', 'menuitem');
      off.textContent = aMe.webOnly ? 'Remove my card' : 'Remove my card from the web';
      off.addEventListener('click', async () => {
        // A web only player's Remove is the whole right to be forgotten.
        const ask = aMe.webOnly
          ? 'Remove your card?\n\nYour Discord account is unlinked from your gamertag and your '
            + 'card leaves ElviTeamTracker.com within a few minutes, avatar included.\n\nYour '
            + 'games themselves stay: they are EA\'s public match data, not ours to erase. You can '
            + 'link again anytime.'
          : 'Take your card off ElviTeamTracker.com?\n\nIt leaves the Cards page, avatar '
            + 'included, within a few minutes. You can put it back anytime.';
        if (!confirm(ask)) return;
        try {
          if (aMe.webOnly) {
            await removeCard();
            location.href = '/';
            return;
          }
          await setWebCard(false);
          removeItem.replaceChildren(note('Done — your card comes off the web in a few minutes.'));
        } catch {
          removeItem.replaceChildren(note('Couldn\'t do that right now — try again in a minute.'));
        }
      });
      cardItem.append(mine, myPlayer(), myClubsItem());
      removeItem.append(off);
    } else {
      const on = document.createElement('a');
      on.setAttribute('role', 'menuitem');
      on.textContent = 'Put my card on the web';
      const api = LOCAL && params.get('api') ? `&api=${encodeURIComponent(params.get('api'))}` : '';
      on.href = `/playercards/?consent=1${api}`;
      cardItem.append(on, myPlayer(), myClubsItem());
    }
  };
  drawCard();
  document.addEventListener('ett:webcard', (e) => { aMe.webCard = e.detail; drawCard(); });

  // The server's extra ways in (Oct 21), worded by /auth/me for whom they
  // exist; the page itself names none of them.
  for (const link of aMe.links ?? []) {
    const a = document.createElement('a');
    // Its own art, when the server names one (the Furball Coins coin).
    if (link.icon) {
      const img = document.createElement('img');
      img.className = 'nav-menu-icon';
      img.src = link.icon;
      img.alt = '';
      a.append(img);
    }
    a.append(link.label);
    const api = LOCAL && params.get('api') ? `?api=${encodeURIComponent(params.get('api'))}` : '';
    a.href = `${link.href}${api}`;
    item(a);
  }

  // Notifications (Nov 5): the panel on the home page.
  const bell = document.createElement('a');
  bell.textContent = '🔔 Notifications';
  bell.href = pageHref('/?notify=1');
  item(bell);

  // Install the app (Nov 5): on a phone that has not, the way back to the
  // home page's banner after a Not now -- or Chrome's own prompt outright.
  if (PHONE && !STANDALONE) {
    const a = document.createElement('a');
    a.textContent = '📲 Install the app';
    a.href = pageHref('/?install=1');
    a.addEventListener('click', (e) => {
      if (!installPrompt) return;
      e.preventDefault();
      const prompt = installPrompt;
      installPrompt = null;
      prompt.prompt();
    });
    item(a);
  }

  const sep = document.createElement('div');
  sep.className = 'nav-menu-sep';
  sep.setAttribute('role', 'separator');
  menu.append(sep, removeItem);

  const out = document.createElement('a');
  out.textContent = 'Log out';
  out.href = `${API}/auth/logout?return=${aBack}`;
  // Signed out: the next page must not draw the kept menu, even for a blink.
  out.addEventListener('click', () => writeMe(null));
  item(out);

  const setOpen = (aOpen) => {
    menu.hidden = !aOpen;
    btn.setAttribute('aria-expanded', String(aOpen));
    if (aOpen) menu.querySelector('[role="menuitem"]')?.focus();
  };
  btn.addEventListener('click', () => setOpen(menu.hidden));
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); }
  });

  wrap.append(btn, menu);
  return wrap;
}
