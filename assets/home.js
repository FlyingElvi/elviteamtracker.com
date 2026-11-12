// The home page (Nov 4): three pages in one, by who is looking.
//   1. not signed in   -> what it is, Sign in with Discord, Add the bot
//   2. signed in, no gamertag linked -> the link form (and, for a gamertag we
//      never saw, the club finder)
//   3. linked          -> your card and your last games
// Any Discord account signs in: no server of the bot needed (web only players).

import { mountAuth, linkGamertag, searchClub, trackClub, loginUrl, API_BASE as API }
  from '/leaderboards/auth.js?v=20';
import * as cardJs from '/playercards/card.js';
const { renderCard, FACES, PREMIUM_FACES, FACE_ORDER } = cardJs;
// Absent until the server's card.js has it (Nov 11): the emoji meanwhile.
const faceIcon = cardJs.faceIcon;

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

$('signin').href = loginUrl('/');

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
  $('log-all').href = `/myplayer/${apiQ('?')}`;

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
  // Your card's own faces (Nov 5): asked of the server by its owner's rules
  // -- a card just linked is not in the list yet, and a web only player's
  // Clubs face is where he tracks a club. They win over the list's.
  const own = fetch(`${API}/cards/${encodeURIComponent(slug)}/faces`, { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null)).then((j) => j?.faces ?? null).catch(() => null);
  let ownDone = false;
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
  // A notification's button lands on its face (Nov 5): /?face=quests after
  // "Get my next challenge" shows the one just drawn.
  const want = params.get('face');
  if (want && [...FACES, ...PREMIUM_FACES].some((f) => f.id === want)) view.face = want;
  paint(false);
  $('card').addEventListener('click', () => {
    const at = view.faces.findIndex((f) => f.id === view.face);
    turn(view.faces[(at + 1) % view.faces.length].id);
  });
  own.then((f) => {
    if (!f) return;
    ownDone = true;
    view.faces = facesFrom({ faces: f });
    redraw();
    preloadFaces(); // the redraw skips a premium face on screen: the new faces still load
  });
  listed.then((x) => {
    if (!x || ownDone) return;
    view.faces = facesFrom(x);
    redraw();
  });
  live.then((fresh) => {
    Object.assign(view.p, fresh);
    redraw();
  }).catch(() => {});
}

/** The faces of your card: the three, plus its extra ones -- all of them,
 *  it is yours (Challenges alone until the server answers). */
/** The chips' order on the home page (Nov 5, elvis): Discord's, with Frenzy
 *  and Duels swapped so the eleven fit three rows of a phone (335 px). */
const HOME_ORDER = ['front', 'back', 'awards', 'last10', 'quests', 'streaks', 'frenzy', 'duels',
  'milestones', 'bets', 'clubs'];

function facesFrom(aListed) {
  const extra = aListed?.faces ?? ['quests'];
  const rank = (aId) => (HOME_ORDER.includes(aId) ? HOME_ORDER.indexOf(aId) : 100 + FACE_ORDER.indexOf(aId));
  return [...FACES, ...PREMIUM_FACES.filter((f) => extra.includes(f.id))]
    .sort((a, b) => rank(a.id) - rank(b.id));
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

// Preload (Nov 7, elvis): once your card is drawn, its other faces load in
// the background -- ONE at a time, when the browser is idle -- so a flip is
// instant instead of a cold read. Every face goes through the server's DB
// lock: never all at once.
const idle = (aFn) => (window.requestIdleCallback
  ? requestIdleCallback(aFn, { timeout: 2000 }) : setTimeout(aFn, 300));
let preloadKey = null;
function preloadFaces() {
  const ids = view.faces.filter((f) => PREMIUM_FACES.some((x) => x.id === f.id)).map((f) => f.id);
  const key = `${view.p.id}:${ids.join()}`;
  if (preloadKey === key) return;
  preloadKey = key;
  const next = () => {
    if (preloadKey !== key) return; // the face list changed: a newer run took over
    const face = ids.shift();
    if (face) faceData(face).catch(() => {}).finally(() => idle(next));
  };
  idle(next);
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
      if (f.art && faceIcon) {
        // The section icons (Nov 11): card, clubs.
        b.append(faceIcon(f.art, f.icon, 'width:1.15em;height:1.15em;vertical-align:-0.2em;margin-right:4px'),
          f.label);
      } else if (f.img) {
        // The Furball Coin art, not the emoji (relative to /playercards/).
        const img = document.createElement('img');
        img.src = `/playercards/${f.img}`;
        img.alt = '';
        img.style.cssText = 'width:1.15em;height:1.15em;vertical-align:-0.2em;margin-right:4px';
        b.append(img, f.label);
      } else {
        // "Frenzy" alone on the chip (Nov 5): the row has no room for
        // the first name, and the trophy says the rest.
        b.textContent = `${f.icon} ${f.id === 'frenzy' ? 'Frenzy' : f.label}`;
      }
      b.addEventListener('click', () => turn(f.id));
      return b;
    }));
    drawAction(aFresh);
    preloadFaces();
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

/**
 * The face's own gestures, in the panel under Last games (Nov 4, elvis):
 * Challenges = get the next one / abandon it (Discord's rule), Clubs = track
 * an EA club. The other faces have none: the panel hides. A redraw of the
 * same face keeps the panel (and what is typed in it) unless forced.
 */
async function drawAction(aForce) {
  const box = $('cardact');
  const face = view.face;
  if (!aForce && box.dataset.face === face) return;
  box.dataset.face = face;
  if (face === 'quests') {
    await questAction(box);
  } else if (face === 'clubs') {
    clubAction(box);
  } else if (face === 'duels') {
    await duelAction(box);
  } else {
    box.hidden = true;
    box.replaceChildren();
  }
}

/** The panel's frame: a title, a line, then the controls. */
function panel(aBox, aTitle, aText, ...aNodes) {
  const h = document.createElement('h2');
  h.textContent = aTitle;
  const p = document.createElement('p');
  p.className = 'home-acts-text';
  p.textContent = aText;
  aBox.replaceChildren(h, p, ...aNodes);
  aBox.hidden = false;
}

async function questAction(aBox) {
  let st;
  try {
    const r = await fetch(`${API}/me/quest`, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    st = await r.json();
  } catch {
    aBox.hidden = true;
    return;
  }
  if (view.face !== 'quests') return;
  const draw = !st.hasActive;
  const skip = st.hasActive && st.skippable;
  if (!draw && !skip) {
    panel(aBox, 'Your challenge', 'It\'s running: every game counts toward it. Ten games '
      + 'without finishing it and you can abandon it for another.');
    return;
  }
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn ${skip ? 'home-danger' : 'btn-primary'}`;
  b.textContent = draw ? 'Get a challenge' : 'Abandon this challenge';
  const note = document.createElement('p');
  note.className = 'home-msg';
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
  panel(aBox, draw ? 'Next challenge' : 'Your challenge',
    draw ? 'Draw one: it fills up with your games, one after the other.'
      : 'Ten games without finishing it: you can abandon it and draw another.', b, note);
}

/**
 * Duels (Nov 5): the composer, on the Duels face -- Discord's, on the web.
 * A Face-off (most X in N games, a third seat makes it a truel) or Repeat
 * the feat (one of your recent exploits to match). The server creates it
 * like the bot's and the bot posts the challenge in the Furballs' channel,
 * where Accept / Decline live.
 */
async function duelAction(aBox) {
  let opt;
  try {
    const r = await fetch(`${API}/me/duel`, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    opt = await r.json();
  } catch {
    aBox.hidden = true;
    return;
  }
  if (view.face !== 'duels') return;
  if (opt.live) {
    panel(aBox, 'Your duel', 'One at a time: it settles when the windows fill (or they answer), then you can send another.');
    return;
  }
  const form = document.createElement('form');
  form.className = 'home-duel';
  const field = (aLabel, aControl) => {
    const l = document.createElement('label');
    l.append(aLabel, aControl);
    return l;
  };
  const select = (aOptions, aValue) => {
    const s = document.createElement('select');
    for (const o of aOptions) {
      const op = document.createElement('option');
      op.value = o.value;
      op.textContent = o.label;
      if (o.disabled) op.disabled = true;
      s.append(op);
    }
    if (aValue != null) s.value = aValue;
    return s;
  };
  const kind = select([{ value: 'faceoff', label: 'Face-off — most X in N games' },
    { value: 'repeat', label: 'Repeat the feat — match one of my recent exploits' }]);
  const stats = opt.stats ?? [];
  const stat = select(stats.map((s) => ({ value: s.key, label: s.lowest ? `fewest ${s.label}` : `most ${s.label}` })));
  const windowSel = select([1, 2, 3, 4, 5].map((w) => ({ value: String(w), label: `${w} game${w === 1 ? '' : 's'}` })), '3');
  const feats = opt.feats ?? [];
  const feat = select(feats.length
    ? feats.map((f, i) => ({ value: String(i), label: `${f.total} ${f.statLabel} in ${f.window} game${f.window === 1 ? '' : 's'}` }))
    : [{ value: '', label: 'No recent feat to repeat yet — play a few games', disabled: true }]);
  const roster = opt.roster ?? [];
  const who = (aNone) => select([{ value: '', label: aNone }, ...roster.map((r) => ({
    value: r.slug, label: r.busy ? `${r.name} — in a duel` : r.name, disabled: !!r.busy }))]);
  const opponent = who('Pick an opponent');
  const third = who('Nobody — a plain duel');
  const subject = document.createElement('input');
  subject.type = 'text';
  subject.maxLength = 80;
  subject.placeholder = 'The stakes, if any (“loser buys the pizza”)';
  subject.setAttribute('aria-label', 'The stakes');
  const send = document.createElement('button');
  send.type = 'submit';
  send.className = 'btn btn-primary';
  send.textContent = 'Send the challenge';
  const note = document.createElement('p');
  note.className = 'home-msg';
  note.setAttribute('role', 'status');
  const fStat = field('Stat', stat);
  const fWindow = field('Window', windowSel);
  const fFeat = field('Feat to repeat', feat);
  const fThird = field('Third player (truel)', third);
  const mode = () => {
    const repeat = kind.value === 'repeat';
    fStat.hidden = repeat;
    fWindow.hidden = repeat;
    fFeat.hidden = !repeat;
    fThird.hidden = repeat;
  };
  kind.addEventListener('change', mode);
  mode();
  form.append(field('Kind', kind), fStat, fWindow, fFeat, field('Opponent', opponent), fThird,
    field('Stakes', subject), send, note);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const repeat = kind.value === 'repeat';
    if (!opponent.value) { note.textContent = 'Pick an opponent.'; return; }
    if (repeat && !feats.length) { note.textContent = 'No feat to repeat yet.'; return; }
    const body = { challenged: opponent.value, subject: subject.value.trim() || null };
    if (repeat) {
      const f = feats[Number(feat.value)];
      Object.assign(body, { stat: f.stat, windowGames: f.window, target: f.total });
    } else {
      Object.assign(body, { stat: stat.value, windowGames: Number(windowSel.value), third: third.value || null });
    }
    send.disabled = true;
    note.textContent = 'Sending…';
    try {
      const r = await fetch(`${API}/me/duel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-ETT': '1' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      note.textContent = 'Challenge sent — the bot posts it in the Furballs\' channel within a minute. They answer there, or from their phone.';
      await paint(false, true);
    } catch (anErr) {
      send.disabled = false;
      note.textContent = `Couldn't send it: ${anErr.message}`;
    }
  });
  panel(aBox, 'Challenge someone', 'A duel between Furballs: pick the stat and the window, name your opponent — '
    + 'a third one makes it a truel. Or dare them to repeat one of your feats.', form);
}

/** Clubs: a club you play for that we don't follow yet -- find it, track it. */
function clubAction(aBox) {
  const form = document.createElement('form');
  form.className = 'home-form';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 40;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'Start of the club\'s name';
  input.setAttribute('aria-label', 'Start of the club\'s name');
  const find = document.createElement('button');
  find.type = 'submit';
  find.className = 'btn';
  find.textContent = 'Find';
  form.append(input, find);
  const msg = document.createElement('p');
  msg.className = 'home-msg';
  msg.setAttribute('role', 'status');
  const list = document.createElement('div');
  list.className = 'home-clubs';
  const tell = (aText, aBad) => { msg.textContent = aText; msg.classList.toggle('bad', !!aBad); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    list.replaceChildren();
    tell('Searching EA…');
    let clubs;
    try {
      clubs = await searchClub(name);
    } catch (anErr) {
      tell(anErr.message || 'The search didn\'t work — try again in a minute.', true);
      return;
    }
    if (!clubs.length) {
      tell(`No club found starting with "${name}".`, true);
      return;
    }
    tell(clubs.length === 1 ? 'This one?' : 'Pick the club:');
    for (const c of clubs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `${esc(c.name ?? `Club ${c.clubId}`)}${c.division ? `<small>Div ${esc(c.division)}</small>` : ''}`;
      b.addEventListener('click', async () => {
        for (const x of list.querySelectorAll('button')) x.disabled = true;
        tell('One moment…');
        try {
          const r = await trackClub(c.clubId, c.name);
          list.replaceChildren();
          input.value = '';
          const club = c.name ?? 'That club';
          tell(r.outcome === 'already'
            ? `${club} is already tracked — its newest games are being pulled now.`
            : `Done — ${club} is tracked now. Its games show up on your card within a few minutes.`);
        } catch (anErr) {
          for (const x of list.querySelectorAll('button')) x.disabled = false;
          tell(anErr.message || 'Couldn\'t do that right now — try again in a minute.', true);
        }
      });
      list.append(b);
    }
  });
  panel(aBox, 'Track an EA club', 'Play for a club that isn\'t tracked? Find it: its games '
    + 'count on your card from then on. Nothing gets posted anywhere.', form, msg, list);
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
    // A league game says League, its league on hover (Nov 12).
    const kind = g.league ? `<span title="${esc(g.league)}">League</span>`
      : g.private ? 'Private' : (g.threes ? '3s' : '6s');
    const res = { W: 'w', L: 'x', OTL: 'o' }[g.result] ?? '';
    const line = g.goalie
      ? `${g.saves ?? 0} SV`
      : `${g.goals ?? 0}G ${g.assists ?? 0}A`;
    const rtg = g.rating == null ? '—' : Number(g.rating).toFixed(1);
    // A game opens its box score (Nov 6): the row, the result a real link.
    const href = g.matchId ? `/leaderboards/?game=${encodeURIComponent(g.matchId)}${apiQ('&')}` : null;
    const result = `${esc(g.result)} ${esc(g.score)}`;
    return `<tr${href ? ` class="go" data-href="${esc(href)}"` : ''}>`
      + `<td class="l dim">${esc(DATE.format(new Date(g.ts * 1000)))}</td>`
      + `<td class="l opp">${esc(g.opp)} <span class="dim">· ${kind}</span></td>`
      + `<td class="${res}">${href ? `<a href="${esc(href)}">${result}</a>` : result}</td>`
      + `<td>${esc(line)}</td><td>${esc(rtg)}</td></tr>`;
  }).join('');
  $('log').innerHTML = head + `<tbody>${body}</tbody>`;
}

$('log').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const row = e.target.closest('tr.go');
  if (row) location.href = row.dataset.href;
});

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
