// The home page (Nov 4): three pages in one, by who is looking.
//   1. not signed in   -> what it is, Sign in with Discord, Add the bot
//   2. signed in, no gamertag linked -> the link form (and, for a gamertag we
//      never saw, the club finder)
//   3. linked          -> your card and your last games
// Any Discord account signs in: no server of the bot needed (web only players).

import { mountAuth, linkGamertag, searchClub, trackClub, API_BASE as API }
  from '/leaderboards/auth.js?v=2';
import { renderCard, FACES, PREMIUM_FACES, FACE_ORDER } from '/playercards/card.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
/** The lab's API rides every link on localhost (?api=). */
const apiQ = (aSep) => (LOCAL && params.get('api') ? `${aSep}api=${encodeURIComponent(params.get('api'))}` : '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function show(aState) {
  for (const s of ['out', 'link', 'mine']) $(`st-${s}`).hidden = s !== aState;
  document.documentElement.classList.remove('signed');
}

$('signin').href = `${API}/auth/login?return=/`;

/** The session, once /auth/me answers (see the bottom of this file). */
let me;

/** Your live card, asked at once with the slug this browser kept from its
 *  last visit -- before /auth/me, not after it (Nov 4, elvis). */
const early = (() => {
  try {
    const slug = JSON.parse(localStorage.getItem('ett-me') || 'null')?.me?.slug;
    if (!slug) return null;
    const card = fetch(`${API}/cards/${encodeURIComponent(slug)}?t=${Math.floor(Date.now() / 15000)}`,
      { signal: AbortSignal.timeout(30000) })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
    card.catch(() => {});
    return { slug, card };
  } catch {
    return null;
  }
})();

// ── 2. link your gamertag ─────────────────────────────────────────────
function say(anId, aText, aBad) {
  const p = $(anId);
  p.textContent = aText;
  p.classList.toggle('bad', !!aBad);
}

function drawLink() {
  $('link-hi').textContent = `Hi ${me.name} — link your gamertag`;
  $('link-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tag = $('link-tag').value.trim();
    if (!tag) return;
    const btn = e.submitter ?? $('link-form').querySelector('button');
    btn.disabled = true;
    say('link-msg', 'Linking…');
    try {
      const r = await linkGamertag(tag);
      say('link-msg', `✅ Linked to ${r.playerName}. Loading your card…`);
      location.replace(`/${apiQ('?')}`);
    } catch (anErr) {
      btn.disabled = false;
      if (anErr.status === 422 && anErr.body?.needClub) {
        say('link-msg', `${anErr.message} Check the spelling first — it has to match the game.`, true);
        $('club').hidden = false;
      } else if (anErr.status === 401) {
        say('link-msg', 'Your sign-in expired — sign in again.', true);
      } else {
        say('link-msg', anErr.message || 'Couldn\'t link right now — try again in a minute.', true);
      }
    }
  });

  $('club-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('club-name').value.trim();
    if (!name) return;
    const list = $('club-list');
    list.replaceChildren();
    say('club-msg', 'Searching EA…');
    let clubs;
    try {
      clubs = await searchClub(name);
    } catch (anErr) {
      say('club-msg', anErr.message || 'The search didn\'t work — try again in a minute.', true);
      return;
    }
    if (!clubs.length) {
      say('club-msg', `No club found starting with "${name}". Type the start of its name.`, true);
      return;
    }
    say('club-msg', clubs.length === 1 ? 'Is this your club?' : 'Pick your club:');
    for (const c of clubs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `${esc(c.name ?? `Club ${c.clubId}`)}${c.division ? `<small>Div ${esc(c.division)}</small>` : ''}`;
      b.addEventListener('click', async () => {
        for (const x of list.querySelectorAll('button')) x.disabled = true;
        say('club-msg', 'One moment…');
        try {
          const r = await trackClub(c.clubId, c.name);
          list.replaceChildren();
          const club = c.name ?? 'your club';
          say('club-msg', r.outcome === 'already'
            ? `We already follow ${club}: its newest games are being pulled from EA now. Give it a few minutes, then link your gamertag again.`
            : `Done — we follow ${club} now and are pulling its games from EA. Give it a few minutes, then link your gamertag again.`);
        } catch (anErr) {
          for (const x of list.querySelectorAll('button')) x.disabled = false;
          say('club-msg', anErr.message || 'Couldn\'t do that right now — try again in a minute.', true);
        }
      });
      list.append(b);
    }
  });
}

// ── 3. your card, your games ──────────────────────────────────────────
async function drawMine() {
  $('me-tag').textContent = me.gamertag;
  $('me-club').textContent = me.club?.name ? `${me.club.name} · signed in as ${me.name}` : `Signed in as ${me.name}`;
  $('log-all').href = `/leaderboards/?board=me${apiQ('&')}`;

  // The ways on (My player, Leaderboards, Furball Coins) live in the nav
  // since Nov 4 -- no second row of them here.
  drawGames();
  if (!me.webCard) {
    // A member whose card is only in Discord: one click puts it here too.
    $('card').classList.add('home-offweb');
    $('card').innerHTML = '<p>Your card isn\'t on the web yet.</p>'
      + `<a class="btn btn-primary" href="/playercards/?consent=1${apiQ('&')}">Put my card on the web</a>`;
    return;
  }
  await drawCard();
}

/** A 15-second bucket: past the browser's cache after a game, one URL per click burst. */
const bucket = () => Math.floor(Date.now() / 15000);

const view = { p: null, face: 'front', faces: FACES, theme: null, data: new Map() };

async function drawCard() {
  const slug = me.slug;
  // Two ways to the same card, raced (Nov 4): the live one (recomputed at the
  // origin -- warmed by /auth/me, but seconds when cold) and the full list
  // (edge-cached, built in the background; a card just linked is not in it
  // yet). The first to answer draws; the other completes it after: the list
  // brings the card's extra faces, the live one the newest game.
  const live = early?.slug === slug ? early.card
    : fetch(`${API}/cards/${encodeURIComponent(slug)}?t=${bucket()}`, { signal: AbortSignal.timeout(30000) })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
  const listed = fetch(`${API}/cards`, { signal: AbortSignal.timeout(20000) })
    .then((r) => r.json()).then((j) => j.players?.find((x) => x.id === slug) ?? null).catch(() => null);
  live.catch(() => {});
  const redraw = () => { if (view.p && !PREMIUM_FACES.some((f) => f.id === view.face)) paint(false); };
  try {
    const [theme, card] = await Promise.all([
      fetch('/playercards/data/theme.json', { cache: 'no-cache' }).then((r) => r.json()),
      Promise.any([listed.then((x) => x ?? Promise.reject(new Error('not listed'))), live]),
      document.fonts.load('bold 20px EASSCard'),
      document.fonts.load('20px EASSCard'),
    ]);
    view.theme = theme;
    view.p = { ...card };
    view.faces = facesFrom(null);
  } catch (anErr) {
    console.warn('home: card', anErr);
    // Just linked: the card's first drawing can take a moment.
    $('card').innerHTML = '<p class="home-wait">Your card is being drawn — refresh in a minute.</p>';
    return;
  }
  paint(false);
  $('card').addEventListener('click', () => {
    const at = view.faces.findIndex((f) => f.id === view.face);
    turn(view.faces[(at + 1) % view.faces.length].id);
  });
  listed.then((x) => {
    if (!x) return;
    view.faces = facesFrom(x);
    redraw();
  });
  live.then((fresh) => {
    Object.assign(view.p, fresh);
    redraw();
  }).catch(() => {});
}

/** The faces of your card: the three, plus its extra ones from the list
 *  (Challenges alone until the list answers, or for a card just linked). */
function facesFrom(aListed) {
  const extra = (aListed?.faces ?? ['quests'])
    .filter((f) => me.premium || aListed?.openFaces || f === 'quests');
  return [...FACES, ...PREMIUM_FACES.filter((f) => extra.includes(f.id))]
    .map((f) => (f.id === 'bets' && aListed?.openFaces ? { ...f, label: 'Picks' } : f))
    .sort((a, b) => FACE_ORDER.indexOf(a.id) - FACE_ORDER.indexOf(b.id));
}

function faceData(aFace, aFresh) {
  if (aFresh) view.data.delete(aFace);
  if (!view.data.has(aFace)) {
    const t = aFresh ? `${bucket()}-${Date.now()}` : bucket();
    view.data.set(aFace, fetch(`${API}/cards/${encodeURIComponent(view.p.id)}/face/${aFace}?t=${t}`,
      { credentials: 'include' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .catch((anErr) => { view.data.delete(aFace); throw anErr; }));
  }
  return view.data.get(aFace);
}

let ticket = 0;
async function paint(anAnimate, aFresh) {
  const mine = ++ticket;
  let data;
  if (PREMIUM_FACES.some((f) => f.id === view.face)) {
    try {
      data = await faceData(view.face, aFresh);
    } catch {
      view.face = 'front';
    }
    if (mine !== ticket) return;
  }
  const draw = () => {
    // The card's art (frames/, logos/, avatars/, art/) is relative to the
    // Cards section: from here, it lives under /playercards/.
    $('card').innerHTML = renderCard(view.p, view.face, view.theme, data)
      .replace(/href="(?!https?:|\/|#|data:)/g, 'href="/playercards/');
    $('faces').replaceChildren(...view.faces.map((f) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(f.id === view.face));
      if (f.img) {
        // The Furball Coin art, not the emoji (relative to /playercards/).
        const img = document.createElement('img');
        img.src = `/playercards/${f.img}`;
        img.alt = '';
        img.style.cssText = 'width:1.15em;height:1.15em;vertical-align:-0.2em;margin-right:4px';
        b.append(img, f.label);
      } else {
        b.textContent = `${f.icon} ${f.label}`;
      }
      b.addEventListener('click', () => turn(f.id));
      return b;
    }));
    drawAction();
  };
  if (!anAnimate) { draw(); return; }
  $('card').classList.add('turning');
  setTimeout(() => { draw(); requestAnimationFrame(() => $('card').classList.remove('turning')); }, 160);
}

function turn(aFace) {
  if (aFace === view.face) return;
  view.face = aFace;
  paint(true);
}

/** Under the Challenges face: Get a challenge, or Abandon it (Discord's rule). */
async function drawAction() {
  const box = $('cardact');
  if (view.face !== 'quests') { box.hidden = true; box.replaceChildren(); return; }
  let st;
  try {
    const r = await fetch(`${API}/me/quest`, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    st = await r.json();
  } catch {
    box.hidden = true;
    return;
  }
  if (view.face !== 'quests') return;
  const draw = !st.hasActive;
  const skip = st.hasActive && st.skippable;
  if (!draw && !skip) { box.hidden = true; box.replaceChildren(); return; }
  const b = document.createElement('button');
  b.type = 'button';
  b.className = skip ? 'danger' : '';
  b.textContent = draw ? '🗺️ Get a challenge' : '⏭️ Abandon this challenge';
  const note = document.createElement('p');
  note.setAttribute('role', 'status');
  b.addEventListener('click', async () => {
    if (skip && !confirm('Abandon this challenge?\n\nIt unlocks nothing — its sequel waits for a real completion.')) return;
    b.disabled = true;
    try {
      const r = await fetch(`${API}/me/quest`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-ETT': '1' },
        body: JSON.stringify({ action: draw ? 'draw' : 'skip' }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      await paint(false, true);
    } catch (anErr) {
      b.disabled = false;
      note.textContent = `Couldn't do that: ${anErr.message}`;
    }
  });
  box.replaceChildren(b, note);
  box.hidden = false;
}

const DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

async function drawGames() {
  let log;
  try {
    const r = await fetch(`${API}/me/games`, { credentials: 'include', signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    log = await r.json();
  } catch {
    $('log-msg').textContent = 'Your games can\'t be reached right now — try again in a minute.';
    return;
  }
  const rows = (log.rows ?? []).slice(0, 10);
  if (!rows.length) {
    $('log-msg').textContent = 'No games yet this season. Your next one shows up here a few minutes after it ends.';
    return;
  }
  const head = '<thead><tr><th class="l">Date</th><th class="l">Opponent</th><th>Result</th>'
    + '<th title="Goals-assists, or saves in net">Line</th><th title="Game rating">RTG</th></tr></thead>';
  const body = rows.map((g) => {
    const kind = g.private ? 'Private' : (g.threes ? '3s' : '6s');
    const res = { W: 'w', L: 'x', OTL: 'o' }[g.result] ?? '';
    const line = g.goalie
      ? `${g.saves ?? 0} SV`
      : `${g.goals ?? 0}G ${g.assists ?? 0}A`;
    const rtg = g.rating == null ? '—' : Number(g.rating).toFixed(1);
    return `<tr><td class="l dim">${esc(DATE.format(new Date(g.ts * 1000)))}</td>`
      + `<td class="l opp">${esc(g.opp)} <span class="dim">· ${kind}</span></td>`
      + `<td class="${res}">${esc(g.result)} ${esc(g.score)}</td>`
      + `<td>${esc(line)}</td><td>${esc(rtg)}</td></tr>`;
  }).join('');
  $('log').innerHTML = head + `<tbody>${body}</tbody>`;
}

// ── which page: last, once every declaration above exists ─────────────
me = await mountAuth();
if (!me.signedIn) {
  show('out');
} else if (!me.gamertag) {
  show('link');
  drawLink();
} else {
  show('mine');
  drawMine();
}
