// "Sign in with Discord" in the nav (Oct 18) — shared by every generated
// section of the site (copied next to each page by the exporter).
//
// The public API's /auth routes do the work: Discord sign-in, for the people
// who already have Elvi's Team Tracker in one of their servers. This shows
// the state — "Sign in", or your picture and name opening a menu (your card's
// web switch, Log out) — and the message a sign-in came back with
// (?login=notmember|cancelled|failed).

const params = new URLSearchParams(location.search);
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = (LOCAL && params.get('api')) || 'https://api.elviteamtracker.com';

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
.nav-links .nav-link-icon { display: inline-block; width: 18px; height: 18px; margin-right: 6px; vertical-align: -4px; }
.nav-links a[data-extra] { white-space: nowrap; }
/* Phone (Oct 21): the nav wrapped into three rows and left the picture alone
   on the last one, its menu anchored to its right edge and running off the
   screen to the left. The picture now sits at the end of the brand row (the
   brand pushes it right), the links get a row of their own, and the menu
   hangs under the whole (sticky) nav, full width — wherever the picture
   lands, even on a 320 px phone where it wraps under the brand. */
@media (max-width: 640px) {
  .nav .wrap { gap: 8px 16px; padding-top: 8px; padding-bottom: 8px; }
  .nav-links { order: 3; flex-basis: 100%; }
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
  try {
    // 10 s: a server just restarted can be slow for a moment, and that must
    // not read as "down".
    const r = await fetch(`${API}/auth/me`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      me = { ...(await r.json()), available: true };
    } else if (r.status >= 500) {
      // The API is down (a restart, the tunnel): keep what was drawn.
      return cached ? { ...cached, available: false } : me;
    } else {
      // Sign-in is off: no link at all.
      writeMe(null);
      clearAuth();
      return me;
    }
  } catch {
    // The API is down: keep what was drawn; a fresh Sign in would lead nowhere.
    return cached ? { ...cached, available: false } : me;
  }
  writeMe(me);
  if (!cached || JSON.stringify(slim(cached)) !== JSON.stringify(slim(me))) drawAuth(me);
  return me;
}

const ME_KEY = 'ett-me';
const ME_MAX_AGE = 12 * 3600 * 1000;

/** The fields a header is drawn from. */
const slim = (aMe) => ({ signedIn: !!aMe.signedIn, name: aMe.name, avatarUrl: aMe.avatarUrl,
  webCard: aMe.webCard ?? null, links: aMe.links ?? [] });

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
  document.querySelectorAll('.nav .nav-user, .nav .nav-auth, .nav-links a[data-extra]').forEach((el) => el.remove());
}

/** Draws the header's sign-in state from an /auth/me answer. */
function drawAuth(aMe) {
  clearAuth();
  const me = aMe;
  const back = encodeURIComponent(location.pathname);
  const nav = document.querySelector('.nav .wrap');
  if (me.signedIn) {
    nav?.append(userMenu(me, back));
    // The server's extra ways in, in the header too (Oct 23, elvis), after
    // the page's own links. Worded by /auth/me for whom they exist: the page
    // names none, a visitor gets none.
    const links = document.querySelector('.nav-links');
    for (const link of me.links ?? []) {
      if (!links || links.querySelector(`[data-extra="${CSS.escape(String(link.id))}"]`)) continue;
      const a = document.createElement('a');
      a.dataset.extra = link.id;
      if (link.icon) {
        const img = document.createElement('img');
        img.className = 'nav-link-icon';
        img.src = link.icon;
        img.alt = '';
        a.append(img);
      }
      a.append(link.label);
      const api = LOCAL && params.get('api') ? `?api=${encodeURIComponent(params.get('api'))}` : '';
      a.href = `${link.href}${api}`;
      if (location.pathname.startsWith(link.href)) a.setAttribute('aria-current', 'page');
      links.append(a);
    }
  } else {
    const a = document.createElement('a');
    a.className = 'nav-auth';
    a.textContent = 'Sign in';
    a.href = `${API}/auth/login?return=${back}`;
    a.title = 'With Discord — for people who already have the bot in one of their servers';
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
    a.textContent = 'My player';
    const api = LOCAL && params.get('api') ? `&api=${encodeURIComponent(params.get('api'))}` : '';
    a.href = `/leaderboards/?board=me${api}`;
    return a;
  };

  // The card's web switch, redrawn when it flips (here or on the Cards page).
  const cardItem = document.createElement('li');
  cardItem.setAttribute('role', 'none');
  menu.append(cardItem);
  const drawCard = () => {
    cardItem.replaceChildren();
    if (!aMe.gamertag) {
      cardItem.append(note('Link your gamertag with /trackme in Discord to get a card.'));
    } else if (aMe.webCard) {
      const mine = document.createElement('a');
      mine.setAttribute('role', 'menuitem');
      mine.textContent = 'My card';
      const api = LOCAL && params.get('api') ? `?api=${encodeURIComponent(params.get('api'))}` : '';
      mine.href = `/playercards/${api}#${aMe.slug}`;
      mine.addEventListener('click', () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); });
      const off = document.createElement('button');
      off.type = 'button';
      off.setAttribute('role', 'menuitem');
      off.textContent = 'Remove my card from the web';
      off.addEventListener('click', async () => {
        if (!confirm('Take your card off ElviTeamTracker.com?\n\nIt leaves the Cards page, avatar '
            + 'included, within a few minutes. You can put it back anytime.')) return;
        try {
          await setWebCard(false);
          cardItem.replaceChildren(note('Done — your card comes off the web in a few minutes.'));
        } catch {
          cardItem.replaceChildren(note('Couldn\'t do that right now — try again in a minute.'));
        }
      });
      cardItem.append(mine, myPlayer(), off);
    } else {
      const on = document.createElement('a');
      on.setAttribute('role', 'menuitem');
      on.textContent = 'Put my card on the web';
      const api = LOCAL && params.get('api') ? `&api=${encodeURIComponent(params.get('api'))}` : '';
      on.href = `/playercards/?consent=1${api}`;
      cardItem.append(on, myPlayer());
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

  const sep = document.createElement('div');
  sep.className = 'nav-menu-sep';
  sep.setAttribute('role', 'separator');
  menu.append(sep);

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
