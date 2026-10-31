import { renderCard, FACES, PREMIUM_FACES, FACE_ORDER } from './card.js?v=7796c3622c';
import { mountAuth, setWebCard } from './auth.js?v=7796c3622c';

// Who is looking — resolved in parallel with the cards (see "your card" below).
const mePromise = mountAuth();

const $ = (id) => document.getElementById(id);

// The cards' JSON comes LIVE from the public API (a card at most five
// minutes old); when it does not answer — the home server down, the tunnel
// off — the page falls back on the static export published with it. On
// localhost, ?api=http://localhost:8781 points at the lab's API.
const params = new URLSearchParams(location.search);
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = (LOCAL && params.get('api')) || 'https://api.elviteamtracker.com';

async function loadCards() {
  try {
    const r = await fetch(`${API}/cards`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const live = await r.json();
    if (!Array.isArray(live.players)) throw new Error('no players');
    return { ...live, live: true };
  } catch {
    // no-cache = revalidate every load: a refreshed export (a new opt-in, an
    // opt-out) must show at the next visit, not after the browser's whim.
    const r = await fetch('data/cards.json', { cache: 'no-cache' });
    return { ...(await r.json()), live: false };
  }
}

const [theme, cards] = await Promise.all([
  fetch('data/theme.json', { cache: 'no-cache' }).then((r) => r.json()),
  loadCards(),
  // The card measures its text to fit it: the fonts must be there first.
  document.fonts.load('bold 20px EASSCard'),
  document.fonts.load('20px EASSCard'),
]);

const players = cards.players;
const state = { q: '', pos: null, tier: null, sort: 'ovr' };
let shown = [];
const fronts = new Map(); // id -> front SVG, drawn once
const tileFace = new Map(); // id -> the face a grid tile was flipped to

const updated = new Date(cards.generatedAt);
$('sub').textContent = `${players.length} player card${players.length === 1 ? '' : 's'} · `
  + (cards.live ? 'live' : 'snapshot of '
    + updated.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }));

// ── filters ────────────────────────────────────────────────────────────
function chip(aLabel, aOn, aClick, aDot) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.type = 'button';
  b.setAttribute('aria-pressed', String(aOn));
  if (aDot) {
    const d = document.createElement('span');
    d.className = 'dot';
    d.style.background = aDot;
    b.append(d);
  }
  b.append(aLabel);
  b.addEventListener('click', aClick);
  return b;
}

function drawChips() {
  const positions = ['C', 'LW', 'RW', 'LD', 'RD', 'G'].filter((p) => players.some((x) => x.position === p));
  $('positions').replaceChildren(
    chip('All', state.pos === null, () => { state.pos = null; refresh(); }),
    ...positions.map((p) => chip(p, state.pos === p, () => { state.pos = state.pos === p ? null : p; refresh(); },
      theme.positions[p])));
  const tiers = theme.tiers.filter((t) => players.some((x) => x.tier === t.name));
  $('tiers').replaceChildren(...tiers.map((t) => chip(t.name.replace('-', ' '), state.tier === t.name,
    () => { state.tier = state.tier === t.name ? null : t.name; refresh(); },
    `linear-gradient(${t.light}, ${t.dark})`)));
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  const list = players.filter((p) => (!state.pos || p.position === state.pos)
    && (!state.tier || p.tier === state.tier)
    && (!q || p.name.toLowerCase().includes(q) || (p.club.name ?? '').toLowerCase().includes(q)));
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const by = {
    // OVR = the big header number (last 10 games), then the tracked/global
    // one (the small /NN), then the name.
    ovr: (a, b) => b.ovr - a.ovr || b.ovrTracked - a.ovrTracked || byName(a, b),
    games: (a, b) => b.games - a.games || b.ovr - a.ovr,
    name: byName,
  }[state.sort];
  return list.sort(by);
}

function front(p) {
  if (!fronts.has(p.id)) fronts.set(p.id, renderCard(p, 'front', theme));
  return fronts.get(p.id);
}

function refresh() {
  tileFace.clear(); // the grid redraws on the fronts
  drawChips();
  shown = filtered();
  $('count').textContent = `${shown.length} card${shown.length === 1 ? '' : 's'}`;
  if (!shown.length) {
    $('grid').innerHTML = players.length
      ? '<p class="empty">No card matches.</p>'
      : '<p class="empty">No cards yet — be the first: press 🌐 Web under your card in Discord.</p>';
    return;
  }
  $('grid').innerHTML = shown.map((p, i) =>
    `<button class="tile${p.id === mySlug ? ' tile-me' : ''}" type="button" data-i="${i}" aria-label="${p.name.replace(/[&<>"]/g, '')}, ${p.ovr} OVR">${front(p)}</button>`).join('');
}

// A click flips the tile in place to its next face; a double click opens
// the card on its front (FlyingElvi, Oct 19). The single click waits a beat
// to know it is not the first half of a double. Enter (no pointer) opens.
let clickTimer = 0;
$('grid').addEventListener('click', (e) => {
  const tile = e.target.closest('.tile');
  if (!tile) return;
  if (e.detail === 0) { open(+tile.dataset.i); return; }
  if (e.detail > 1) return; // the dblclick below has it
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => flipTile(tile), 250);
});
$('grid').addEventListener('dblclick', (e) => {
  const tile = e.target.closest('.tile');
  if (!tile) return;
  clearTimeout(clickTimer);
  open(+tile.dataset.i);
});
$('q').addEventListener('input', (e) => { state.q = e.target.value; refresh(); });
$('sort').addEventListener('change', (e) => { state.sort = e.target.value; refresh(); });

// ── viewer ─────────────────────────────────────────────────────────────
const viewer = { i: 0, face: 'front' };

// The premium faces (Oct 19): a premium member looking at a premium member's
// card gets Discord's other faces. The API says which (per card), then sends
// each face's DATA on first look; the page draws it like the three others.
const faceData = new Map();     // `${slug}/${face}` -> Promise<face JSON>

// A 15-second bucket on every refreshable URL: past the browser's own cache
// after a refresh, and the same URL for every click inside one bucket --
// the server's cache answers those anyway (one computation per 15 s).
const bucket = () => Math.floor(Date.now() / 15000);

function loadFace(aSlug, aFace, aFresh) {
  const key = `${aSlug}/${aFace}`;
  if (aFresh) faceData.delete(key);
  if (!faceData.has(key)) {
    // Fresh = right after YOUR gesture changed the face: past the browser's
    // cache of the same bucket (the server recomputes on its own).
    const t = aFresh ? `${bucket()}-${Date.now()}` : bucket();
    faceData.set(key, fetch(`${API}/cards/${encodeURIComponent(aSlug)}/face/${aFace}?t=${t}`, { credentials: 'include' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .catch((anErr) => { faceData.delete(key); throw anErr; }));
  }
  return faceData.get(key);
}

/** The faces this card shows here: the three for everyone, plus the premium ones offered. */
let faces = FACES;

/** The extra faces any signed-in member sees on every card (Oct 21). */
const OPEN_FACES = ['quests'];

/** Who is looking, from the session (/auth/me): set once it answers. */
let viewerMe = { signedIn: false, premium: false, links: [] };

/** The faces a card offers here, Discord's order. Each card carries its
 *  extra faces in /cards (Oct 21); the viewer's own premium flag decides
 *  which of them show -- no call of its own. */
function facesOf(p) {
  // A card whose owner has no premium server (openFaces, Oct 30) offers HIS
  // faces -- his home's awards and streaks, his picks -- to every member.
  const offered = !viewerMe.signedIn ? []
    : (p.faces ?? []).filter((f) => viewerMe.premium || p.openFaces || OPEN_FACES.includes(f));
  return [...FACES, ...PREMIUM_FACES.filter((f) => offered.includes(f.id))]
    .map((f) => (f.id === 'bets' && p.openFaces ? { ...f, label: 'Picks' } : f))
    .sort((a, b) => FACE_ORDER.indexOf(a.id) - FACE_ORDER.indexOf(b.id));
}

/** A grid tile to its next face, in place (a premium face loads its data first). */
async function flipTile(aTile) {
  const p = shown[+aTile.dataset.i];
  if (!p || aTile.classList.contains('loading')) return; // one flip at a time
  const ids = facesOf(p).map((f) => f.id);
  const next = ids[(ids.indexOf(tileFace.get(p.id) ?? 'front') + 1) % ids.length];
  let data;
  if (PREMIUM_FACES.some((f) => f.id === next)) {
    // A face read for the first time in a while can take seconds: the tile
    // says it heard the click.
    aTile.classList.add('loading');
    try {
      data = await loadFace(p.id, next);
    } catch {
      return; // the face does not answer: the tile stays as it is
    } finally {
      aTile.classList.remove('loading');
    }
  }
  tileFace.set(p.id, next);
  aTile.classList.add('turning');
  setTimeout(() => {
    aTile.innerHTML = next === 'front' ? front(p) : renderCard(p, next, theme, data);
    requestAnimationFrame(() => aTile.classList.remove('turning'));
  }, 160);
}

let drawTicket = 0; // drops a face's data that lands after a newer pick

async function drawViewer(aAnimate, aFresh) {
  const p = shown[viewer.i];
  const ticket = ++drawTicket;
  faces = facesOf(p);
  let data;
  if (PREMIUM_FACES.some((f) => f.id === viewer.face)) {
    try {
      data = await loadFace(p.id, viewer.face, aFresh);
    } catch {
      viewer.face = 'front'; // a face that does not answer: back to the card
    }
    if (ticket !== drawTicket) return; // another card or face was picked meanwhile
  }
  const paint = () => {
    $('flip').innerHTML = renderCard(p, viewer.face, theme, data);
    $('faces').replaceChildren(...faces.map((f) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'face-tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(f.id === viewer.face));
      const icon = document.createElement('span');
      icon.className = 'face-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = f.icon;
      b.append(icon, f.label);
      b.addEventListener('click', () => turn(f.id));
      return b;
    }));
    // On a phone the row scrolls: keep the face being shown in view.
    const row = $('faces');
    const on = row.querySelector('[aria-selected="true"]');
    if (on && row.scrollWidth > row.clientWidth) {
      row.scrollLeft = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
    }
    history.replaceState(null, '', `#${p.id}`);
    drawAction(p);
  };
  if (!aAnimate) { paint(); return; }
  $('flip').classList.add('turning');
  setTimeout(() => { paint(); requestAnimationFrame(() => $('flip').classList.remove('turning')); }, 160);
}

/**
 * Your own card's challenge button (Oct 21), Discord's rule: no challenge
 * running = Get a challenge; one running for ten games without a completion
 * = Abandon it; else nothing. The card redraws after, fresh.
 */
async function drawAction(p) {
  const box = $('cardact');
  const own = mySlug && p.id === mySlug;
  // Last 10 on YOUR card, for a premium member (Oct 21): the full game log
  // is My player's, on the Leaderboards page.
  if (own && viewer.face === 'last10' && viewerMe.premium) {
    const a = document.createElement('a');
    a.className = 'card-act-btn';
    a.textContent = '📜 Full game log';
    const api = LOCAL && params.get('api') ? `&api=${encodeURIComponent(params.get('api'))}` : '';
    a.href = `/leaderboards/?board=me${api}`;
    box.replaceChildren(a);
    box.hidden = false;
    return;
  }
  // The Bets face of YOUR card (Oct 21): the way into the server's own
  // section, when /auth/me hands one over (label and address are its).
  const fc = viewerMe.links.find((l) => l.id === 'fc');
  if (own && viewer.face === 'bets' && fc) {
    const a = document.createElement('a');
    a.className = 'card-act-btn';
    if (fc.icon) {
      const img = document.createElement('img');
      img.src = fc.icon;
      img.alt = '';
      img.width = 18;
      img.height = 18;
      img.style.cssText = 'display:inline-block;vertical-align:-4px;margin-right:8px';
      a.append(img);
    }
    a.append(fc.cardLabel ?? fc.label);
    const api = LOCAL && params.get('api') ? `?api=${encodeURIComponent(params.get('api'))}` : '';
    a.href = `${fc.href}${api}`;
    box.replaceChildren(a);
    box.hidden = false;
    return;
  }
  const mine = viewer.face === 'quests' && own;
  if (!mine) {
    box.hidden = true;
    box.replaceChildren();
    return;
  }
  let st;
  try {
    const r = await fetch(`${API}/me/quest`, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    st = await r.json();
  } catch {
    box.hidden = true;
    return;
  }
  if (shown[viewer.i] !== p || viewer.face !== 'quests') return; // moved on meanwhile
  const draw = !st.hasActive;
  const skip = st.hasActive && st.skippable;
  if (!draw && !skip) {
    box.hidden = true;
    box.replaceChildren();
    return;
  }
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `card-act-btn${skip ? ' danger' : ''}`;
  b.textContent = draw ? '🗺️ Get a challenge' : '⏭️ Abandon this challenge';
  const note = document.createElement('p');
  note.className = 'card-act-note';
  note.setAttribute('role', 'status');
  b.addEventListener('click', async () => {
    if (skip && !confirm('Abandon this challenge?\n\nIt unlocks nothing — its sequel waits '
        + 'for a real completion.')) return;
    b.disabled = true;
    note.textContent = '';
    try {
      const r = await fetch(`${API}/me/quest`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-ETT': '1' },
        body: JSON.stringify({ action: draw ? 'draw' : 'skip' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      await drawViewer(false, true); // the face reads fresh, the button follows
    } catch (anErr) {
      b.disabled = false;
      note.textContent = `Couldn't do that: ${anErr.message}`;
    }
  });
  box.replaceChildren(b, note);
  box.hidden = false;
}

function turn(aFace) {
  if (aFace === viewer.face) return;
  viewer.face = aFace;
  drawViewer(true);
}

function open(i) {
  viewer.i = i;
  viewer.face = 'front';
  drawViewer(false);
  if (!$('viewer').open) $('viewer').showModal();
}

function step(d) {
  viewer.i = (viewer.i + d + shown.length) % shown.length;
  drawViewer(false);
}

$('flip').addEventListener('click', () => {
  const at = faces.findIndex((f) => f.id === viewer.face);
  turn(faces[(at + 1) % faces.length].id);
});
// ↻ (Oct 19): after a game, the open card -- and its faces -- read fresh.
// The button rests 15 s after each use; the server caches the same way.
async function refreshCard() {
  const btn = $('refresh');
  if (btn.disabled) return;
  const p = shown[viewer.i];
  btn.disabled = true;
  btn.classList.add('loading');
  try {
    const r = await fetch(`${API}/cards/${encodeURIComponent(p.id)}?t=${bucket()}`,
      { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const fresh = await r.json();
    const keep = p.faces; // the one-card answer carries no face list
    Object.assign(p, fresh, { faces: keep });
    fronts.delete(p.id);
    for (const key of [...faceData.keys()]) if (key.startsWith(`${p.id}/`)) faceData.delete(key);
    refresh();
    viewer.i = Math.max(0, shown.indexOf(p));
    await drawViewer(false);
    btn.title = 'Updated just now';
  } catch {
    btn.title = 'Couldn\'t refresh right now — try again in a minute';
  } finally {
    btn.classList.remove('loading');
    setTimeout(() => { btn.disabled = false; }, 15000);
  }
}
$('refresh').addEventListener('click', refreshCard);
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('close').addEventListener('click', () => $('viewer').close());
$('viewer').addEventListener('click', (e) => { if (e.target === $('viewer')) $('viewer').close(); });
$('viewer').addEventListener('close', () => history.replaceState(null, '', location.pathname));
document.addEventListener('keydown', (e) => {
  if (!$('viewer').open) return;
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const at = faces.findIndex((f) => f.id === viewer.face);
    turn(faces[(at + (e.key === 'ArrowDown' ? 1 : faces.length - 1)) % faces.length].id);
    e.preventDefault();
  }
});

let mySlug = null; // the signed-in member's card id, once known

// The session decides the extra faces (see facesOf): a card already open
// when /auth/me answers grows them right away.
mePromise.then((m) => {
  viewerMe = { signedIn: !!m.signedIn, premium: !!m.premium, links: m.links ?? [] };
  if (m.signedIn) mySlug = m.slug ?? null; // before the redraw: the buttons read it
  if ($('viewer').open) drawViewer(false);
});

refresh();
// A #slug opens that card — on load, and when the menu's My card is clicked
// while already on this page.
const openHash = () => {
  const deep = players.find((p) => `#${p.id}` === location.hash);
  const i = deep ? shown.indexOf(deep) : -1;
  if (i >= 0) open(i);
};
openHash();
window.addEventListener('hashchange', openHash);

// ── your card (phase C) ────────────────────────────────────────────────
// Signed in, a bar says where YOUR card stands and lets you put it on the
// web (the same consent as Discord's) or take it off — the site's one write,
// on your own card only. Your tile, when it is here, stands out.
function mineBar(aMe, aNote) {
  const bar = $('mine');
  bar.hidden = false;
  bar.replaceChildren();
  const text = document.createElement('span');
  const button = (aLabel, aClass, aClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = aClass;
    b.textContent = aLabel;
    b.addEventListener('click', aClick);
    return b;
  };
  if (aNote) {
    text.textContent = aNote;
    bar.append(text);
    return;
  }
  if (!aMe.gamertag) {
    text.textContent = 'Link your gamertag with /trackme in Discord to get a card.';
    bar.append(text);
  } else if (aMe.webCard) {
    text.textContent = 'Your card is on the web.';
    const here = players.find((p) => p.id === aMe.slug);
    const see = document.createElement('a');
    see.href = `#${aMe.slug}`;
    see.textContent = 'See it';
    see.className = 'mine-link';
    see.addEventListener('click', (e) => {
      const i = shown.indexOf(here);
      if (i >= 0) { e.preventDefault(); open(i); }
    });
    // Putting it on is one click; taking it off is the long way, in your
    // menu (FlyingElvi, Oct 18) — no Remove button sitting next to See it.
    bar.append(text, ...(here ? [see] : []));
  } else {
    text.textContent = 'Your card isn\'t on the web.';
    bar.append(text, button('Put my card on the web', 'mine-on', () => $('consent').showModal()));
    $('consent-no').onclick = () => $('consent').close();
    $('consent-yes').onclick = async () => {
      $('consent').close();
      try {
        await setWebCard(true);
        mineBar(aMe, '✅ You\'re in! Your card shows up on this page in a few minutes.');
      } catch {
        mineBar(aMe, 'Couldn\'t do that right now — try again in a minute.');
      }
    };
  }
}

const me = await mePromise;
if (me.signedIn) {
  mySlug = me.slug;
  refresh();
  mineBar(me);
  // The nav menu flipped your card: the bar follows (its own message
  // already says what happened).
  document.addEventListener('ett:webcard', (e) => {
    me.webCard = e.detail;
    mineBar(me, e.detail
      ? '✅ You\'re in! Your card shows up on this page in a few minutes.'
      : 'Done — your card comes off this page in a few minutes, avatar included.');
  });
  // "Put my card on the web" in the nav menu lands here with ?consent=1:
  // the consent box, as always before a yes.
  if (params.get('consent') === '1' && me.gamertag && !me.webCard) $('consent').showModal();
  if (params.has('consent')) {
    params.delete('consent');
    const rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
  }
}
