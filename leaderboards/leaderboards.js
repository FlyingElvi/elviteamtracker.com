// The leaderboards page: one club, one lens, every column sortable.
//
// Reads the PUBLIC API (EASSS PublicApi, through the Cloudflare Tunnel):
//   /clubs?q=            the search box
//   /leaderboard?club=&mode=   the board, aggregated by gamertag
//   /me/player, /me/games      My player (?board=me): your stats, your game log
// The state lives in the URL (?club=&mode=&view=&sort=&dir=&min=) so a board
// can be shared as a link. On localhost, ?api=http://localhost:8781 points
// the page at the lab's API instead.

import { mountAuth } from './auth.js?v=5a872b64f8';

const params = new URLSearchParams(location.search);
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = (LOCAL && params.get('api')) || 'https://api.elviteamtracker.com';
const DEFAULT_CLUB = 2204; // Frosty Furballs — the board people land on

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const MODES = [
  { id: 'all', label: 'All games' },
  { id: '6s', label: 'Public 6s' },
  { id: '3s', label: 'Public 3s' },
  { id: 'p6', label: 'Private 6s' },
  { id: 'lg', label: 'League' },
];
const VIEWS = [{ id: 'skaters', label: 'Skaters' }, { id: 'goalies', label: 'Goalies' }];

const pct = (a, b) => (b > 0 ? (100 * a) / b : null);
const fix = (n) => (v) => (v == null ? '—' : v.toFixed(n));
const int = (v) => (v == null ? '—' : String(v));
const signed = (v) => (v == null ? '—' : v > 0 ? `+${v}` : String(v));

// Each column: key, header, tooltip, value (the sort key), format.
const COLUMNS = {
  skaters: [
    { key: 'gp', head: 'GP', tip: 'Games played as a skater', get: (p) => p.skaterGames, fmt: int },
    { key: 'g', head: 'G', tip: 'Goals', get: (p) => p.goals, fmt: int },
    { key: 'a', head: 'A', tip: 'Assists', get: (p) => p.assists, fmt: int },
    { key: 'p', head: 'P', tip: 'Points', get: (p) => p.points, fmt: int },
    { key: 'ppg', head: 'P/GP', tip: 'Points per game', get: (p) => (p.skaterGames ? p.points / p.skaterGames : null), fmt: fix(2) },
    { key: 'pm', head: '+/-', tip: 'Plus/minus', get: (p) => p.plusMinus, fmt: signed },
    { key: 's', head: 'S', tip: 'Shots', get: (p) => p.shots, fmt: int },
    { key: 'spct', head: 'S%', tip: 'Shooting percentage', get: (p) => p.shootingPct, fmt: fix(1) },
    { key: 'hit', head: 'HIT', tip: 'Hits', get: (p) => p.hits, fmt: int },
    { key: 'tk', head: 'TK', tip: 'Takeaways (interceptions included)', get: (p) => p.takeaways, fmt: int },
    { key: 'gv', head: 'GV', tip: 'Giveaways', get: (p) => p.giveaways, fmt: int },
    { key: 'pass', head: 'PASS%', tip: 'Pass completion', get: (p) => p.passPct, fmt: fix(1) },
    { key: 'fo', head: 'FO%', tip: 'Faceoffs won', get: (p) => pct(p.faceoffWins, p.faceoffWins + p.faceoffLosses), fmt: fix(1) },
    { key: 'blk', head: 'BLK', tip: 'Blocked shots', get: (p) => p.blockedShots, fmt: int },
    { key: 'pim', head: 'PIM', tip: 'Penalty minutes', get: (p) => p.pim, fmt: int },
    { key: 'rtg', head: 'RTG', tip: 'Average game rating, the score post\'s number', get: (p) => p.rtgSkater, fmt: fix(1) },
  ],
  goalies: [
    { key: 'gp', head: 'GP', tip: 'Games played in goal', get: (p) => p.goalieGames, fmt: int },
    { key: 'svpct', head: 'SV%', tip: 'Save percentage', get: (p) => p.goalieSavePct, fmt: fix(2) },
    { key: 'gaa', head: 'GAA', tip: 'Goals against per 60 minutes', get: (p) => (p.goalieToiSeconds ? (3600 * p.goalieGoalsAgainst) / p.goalieToiSeconds : null), fmt: fix(2), asc: true },
    { key: 'sa', head: 'SA', tip: 'Shots against', get: (p) => p.goalieShotsAgainst, fmt: int },
    { key: 'sv', head: 'SV', tip: 'Saves', get: (p) => p.goalieSaves, fmt: int },
    { key: 'ga', head: 'GA', tip: 'Goals against', get: (p) => p.goalieGoalsAgainst, fmt: int, asc: true },
    { key: 'sop', head: 'SO P', tip: 'Shutout periods', get: (p) => p.goalieShutoutPeriods, fmt: int },
    { key: 'rtg', head: 'RTG', tip: 'Average game rating, the score post\'s number', get: (p) => p.rtgGoalie, fmt: fix(1) },
  ],
};

// The boards (Oct 18): Clubs for every member, then Discord's three premium
// boards for the members of a premium server — hidden for the others, the
// same way the premium faces are hidden from the card outside premium.
const BOARDS = [
  { id: 'clubs', label: '📊 Clubs' },
  { id: 'leagues', label: '🏒 Leagues' },
  { id: 'streaks', label: '🔥 Streaks', premium: true },
  { id: 'milestones', label: '🏁 Milestones', premium: true },
  { id: 'elo', label: '🎲 Mix \'Em Up ELO', premium: true },
  { id: 'frenzy', label: '🏆 Furball Frenzy', premium: true },
];
const STREAK_MODES = MODES.slice(0, 4); // streaks have no league reading

const wantedMode = params.get('mode');
const state = {
  // 'me' is My player (Oct 19): no tab of its own — the nav menu and your
  // row on a club board open it.
  board: params.get('board') === 'me' || BOARDS.some((b) => b.id === params.get('board'))
    ? params.get('board') : 'clubs',
  // My player's lens: a League reading can be one season ("lg23"), as on the boards.
  pmode: wantedMode && (MODES.some((m) => m.id === wantedMode) || /^lg\d+$/.test(wantedMode))
    ? wantedMode : 'all',
  ppage: /^\d{1,5}$/.test(params.get('page') ?? '') ? Math.max(1, Number(params.get('page'))) : 1,
  // The game log's positions: 'G', a list of skater slots, or null = the
  // role you play most, whole.
  ppos: params.get('pos') === 'G' ? 'G'
    : (params.get('pos') ?? '').split(',').filter((x) => ['C', 'LW', 'RW', 'LD', 'RD'].includes(x)),
  smode: STREAK_MODES.some((m) => m.id === params.get('smode')) ? params.get('smode') : 'all',
  club: Number(params.get('club')) || DEFAULT_CLUB,
  // "lg" every league game, "lg23" one league season — the API's lenses.
  mode: wantedMode && (MODES.some((m) => m.id === wantedMode) || /^lg\d+$/.test(wantedMode))
    ? wantedMode : 'all',
  view: params.get('view') === 'goalies' ? 'goalies' : 'skaters',
  sort: params.get('sort') || null,
  dir: params.get('dir') === 'asc' ? 'asc' : 'desc',
  // null = automatic (Oct 18): 3 — at 1 the board fills with one-game
  // passers-by — but 1 under League, where a season is a handful of games.
  min: ['1', '3', '5', '10', '20'].includes(params.get('min')) ? Number(params.get('min')) : null,
  // Furball Frenzy: 'all' (the all-time table) or one tournament's id.
  ft: /^\d+$/.test(params.get('t') ?? '') ? params.get('t') : 'all',
  fview: ['standings', 'skaters', 'goalies'].includes(params.get('fview')) ? params.get('fview') : null,
  fsort: null,
  fdir: 'desc',
  // Leagues (Oct 24): one of your leagues, read whole ("lgl3") or one
  // season ("lg27"). null = the first league, the whole of it.
  league: Number(params.get('league')) || null,
  lmode: params.get('board') === 'leagues' && /^lgl?\d+$/.test(wantedMode ?? '') ? wantedMode : null,
};
const onLeagues = () => state.board === 'leagues';
/** The lens the table reads: the club board's, or the league board's. */
const lensNow = () => (onLeagues() ? state.lmode ?? 'lg' : state.mode);
const minGp = () => state.min ?? (lensNow().startsWith('lg') ? 1 : 3);
let board = null; // the last /leaderboard answer
let myClubs = [];  // the signed-in member's clubs, the quick picks
let autoView = !params.get('view'); // the first board may pick the view for you
let request = 0;  // drops answers that arrive after a newer pick
let tabs = [];    // the boards this member sees

function saveUrl() {
  const q = new URLSearchParams();
  if (state.board === 'me') {
    q.set('board', 'me');
    if (state.pmode !== 'all') q.set('mode', state.pmode);
    if (state.ppos === 'G') q.set('pos', 'G');
    else if (state.ppos?.length) q.set('pos', state.ppos.join(','));
    if (state.ppage > 1) q.set('page', state.ppage);
  } else if (onLeagues()) {
    q.set('board', 'leagues');
    if (state.league) q.set('league', state.league);
    if (state.lmode) q.set('mode', state.lmode);
    if (state.view !== 'skaters') q.set('view', state.view);
    if (state.sort) { q.set('sort', state.sort); q.set('dir', state.dir); }
    if (state.min != null) q.set('min', state.min);
  } else if (state.board !== 'clubs') {
    q.set('board', state.board);
    if (state.board === 'streaks' && state.smode !== 'all') q.set('smode', state.smode);
    if (state.board === 'frenzy') {
      if (state.ft !== 'all') q.set('t', state.ft);
      if (state.fview) q.set('fview', state.fview);
    }
  } else {
    q.set('club', state.club);
    if (state.mode !== 'all') q.set('mode', state.mode);
    if (state.view !== 'skaters') q.set('view', state.view);
    if (state.sort) { q.set('sort', state.sort); q.set('dir', state.dir); }
    if (state.min != null) q.set('min', state.min);
  }
  if (LOCAL && params.get('api')) q.set('api', params.get('api'));
  history.replaceState(null, '', `?${q}`);
}

function chips(aEl, aItems, aCurrent, aPick) {
  aEl.replaceChildren(...aItems.map((it) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lb-chip';
    b.textContent = it.label;
    b.setAttribute('aria-pressed', String(it.id === aCurrent));
    b.addEventListener('click', () => aPick(it.id));
    return b;
  }));
}

function drawControls() {
  // The Leagues tab shares the table, the views and Min. GP; the club's
  // search, quick picks and lenses give way to the league and season picks.
  const leagues = onLeagues();
  $('searchbox').hidden = leagues;
  $('modes').hidden = leagues;
  if (leagues) $('myclubs').hidden = true;
  drawLeagueControls();
  const lenses = board?.lenses;
  const modes = MODES.filter((m) => m.id === 'all' || !lenses || (lenses[m.id] ?? 0) > 0
    || (m.id === 'lg' ? state.mode.startsWith('lg') : m.id === state.mode));
  chips($('modes'), modes, state.mode.startsWith('lg') ? 'lg' : state.mode, (id) => {
    if (id === 'lg' && state.mode.startsWith('lg')) return; // already a League reading
    state.mode = id;
    state.min = null; // each lens its own default
    load();
  });
  chips($('views'), VIEWS, state.view, (id) => { state.view = id; state.sort = null; draw(); });
  $('min').value = String(minGp());
  drawSeasons();
}

// ── the League lens' season pick ────────────────────────────────────────
// "All league games", then every league season the club played (newest
// first, same list as Discord's season menu), fetched once per club.
const seasonsByClub = new Map();

async function drawSeasons() {
  const wrap = $('seasonwrap');
  if (onLeagues() || !state.mode.startsWith('lg')) { wrap.hidden = true; return; }
  const club = state.club;
  if (!seasonsByClub.has(club)) {
    seasonsByClub.set(club, []);
    try {
      seasonsByClub.set(club, (await api(`/seasons?club=${encodeURIComponent(club)}`)).seasons ?? []);
    } catch {
      // no season pick; "every league game" still reads
    }
    if (club !== state.club) return;
  }
  const seasons = seasonsByClub.get(club);
  if (!seasons.length) { wrap.hidden = true; return; }
  const select = $('season');
  select.replaceChildren(new Option('All league games', 'lg'),
    ...seasons.map((s) => new Option(`${s.label} (${s.games})`, s.mode)));
  select.value = state.mode;
  wrap.hidden = false;
}
$('season').addEventListener('change', (e) => { state.mode = e.target.value; load(); });

// ── the Leagues tab (Oct 24) ────────────────────────────────────────────
// The leagues YOU played (a club you played for is on its team list), each
// read whole or one season at a time. Every team of the league is on the
// board, league games only.
let myLeagues = null; // /leagues, fetched once

function drawLeagueControls() {
  const leagues = onLeagues() ? myLeagues ?? [] : [];
  const league = leagues.find((l) => l.leagueId === state.league);
  $('leaguewrap').hidden = !leagues.length;
  $('lseasonwrap').hidden = !league?.seasons?.length;
  if (!leagues.length) return;
  $('league').replaceChildren(...leagues.map((l) => new Option(l.name, String(l.leagueId))));
  $('league').value = String(state.league);
  if (!league) return;
  $('lseason').replaceChildren(new Option('Every season', league.mode),
    ...league.seasons.map((s) => new Option(s.label, s.mode)));
  $('lseason').value = state.lmode ?? league.mode;
}
$('league').addEventListener('change', (e) => {
  state.league = Number(e.target.value);
  state.lmode = null;
  state.sort = null;
  load();
});
$('lseason').addEventListener('change', (e) => { state.lmode = e.target.value; load(); });

async function loadLeague() {
  saveUrl();
  const mine = ++request;
  $('status').textContent = 'Loading…';
  $('table').replaceChildren();
  try {
    if (!myLeagues) myLeagues = (await api('/leagues')).leagues ?? [];
    if (mine !== request) return;
    if (!myLeagues.length) {
      board = null;
      drawControls();
      $('club').textContent = 'Leagues';
      $('status').textContent = 'No league here yet: this tab lists the leagues your clubs play in.';
      return;
    }
    let league = myLeagues.find((l) => l.leagueId === state.league);
    if (!league) {
      league = myLeagues[0];
      state.league = league.leagueId;
      state.lmode = null;
    }
    // A season of another league (an old link) reads as this league, whole.
    if (state.lmode !== league.mode && !league.seasons.some((s) => s.mode === state.lmode)) {
      state.lmode = league.mode;
    }
    $('club').textContent = league.name;
    drawControls();
    saveUrl();
    $('status').textContent = 'Loading… a whole league takes a few seconds the first time.';
    const answer = await api(`/league-board?league=${league.leagueId}&mode=${encodeURIComponent(state.lmode)}`);
    if (mine !== request) return;
    board = answer;
    document.title = `${league.name} · Leaderboards — Elvi's Team Tracker`;
    draw();
  } catch (anErr) {
    if (mine !== request) return;
    board = null;
    $('table').replaceChildren();
    if (anErr instanceof SignedOut) { show('gate'); return; }
    $('status').textContent = 'This league is unavailable right now — try again in a few minutes.';
  }
}

// ── your clubs (signed in) ──────────────────────────────────────────────
function drawMyClubs(aClubs) {
  const el = $('myclubs');
  if (!aClubs?.length) { el.hidden = true; return; }
  el.replaceChildren(...aClubs.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lb-chip';
    b.setAttribute('aria-pressed', String(c.clubId === state.club));
    b.append(c.name);
    const n = document.createElement('small');
    n.textContent = `${c.games} GP`;
    b.append(n);
    b.addEventListener('click', () => {
      state.club = c.clubId;
      state.sort = null;
      if (state.mode.startsWith('lg')) state.mode = 'lg'; // a season is per club
      load();
    });
    return b;
  }));
  el.hidden = false;
}

// Members only (phase B): every call carries the sign-in cookie, and a 401
// (never signed in, or the session ran out) brings the sign-in screen back.
class SignedOut extends Error {}

async function api(aPath) {
  const r = await fetch(`${API}${aPath}`, { credentials: 'include' });
  if (r.status === 401) throw new SignedOut();
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Which of the three the page shows: the board, the sign-in, or "down". */
function show(aWhich) {
  $('board').hidden = aWhich !== 'board';
  $('gate').hidden = aWhich !== 'gate';
  $('down').hidden = aWhich !== 'down';
}

async function load() {
  if (onLeagues()) { loadLeague(); return; }
  drawControls();
  drawMyClubs(myClubs);
  saveUrl();
  const mine = ++request;
  $('status').textContent = 'Loading…';
  try {
    const answer = await api(`/leaderboard?club=${encodeURIComponent(state.club)}&mode=${state.mode}`);
    if (mine !== request) return;
    // A lens this club never played (another club's pick, an old link):
    // back to All games rather than an empty board under a hidden chip.
    const lens = state.mode.startsWith('lg') ? 'lg' : state.mode;
    if (lens !== 'all' && answer.lenses && !(answer.lenses[lens] > 0)) {
      board = answer;
      state.mode = 'all';
      load();
      return;
    }
    board = answer;
    // A goalie lands on the Goalies view — once, and only when the link did
    // not ask for a view.
    if (autoView) {
      autoView = false;
      const you = board.players.find((p) => p.me);
      if (you && (you.goalieGames ?? 0) > (you.skaterGames ?? 0)) state.view = 'goalies';
    }
    $('club').textContent = board.club.name;
    document.title = `${board.club.name} · Leaderboards — Elvi's Team Tracker`;
    draw();
  } catch (anErr) {
    if (mine !== request) return;
    board = null;
    $('table').replaceChildren();
    if (anErr instanceof SignedOut) { show('gate'); return; }
    $('status').textContent = 'The stats are unavailable right now — try again in a few minutes.';
  }
}

function draw() {
  drawControls();
  saveUrl();
  if (!board) return;
  const cols = COLUMNS[state.view];
  const gp = cols[0].get;
  let rows = board.players.filter((p) => (gp(p) ?? 0) >= minGp());
  const sortCol = cols.find((c) => c.key === state.sort)
    ?? (state.view === 'goalies' ? cols.find((c) => c.key === 'svpct') : cols.find((c) => c.key === 'p'));
  const dir = state.sort ? state.dir : (sortCol.asc ? 'asc' : 'desc');
  const sign = dir === 'asc' ? 1 : -1;
  rows = rows.slice().sort((a, b) => {
    const x = sortCol.get(a);
    const y = sortCol.get(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;   // the blanks always sink
    if (y == null) return -1;
    return sign * (x - y) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const season = onLeagues()
    ? { label: $('lseason').selectedOptions[0]?.text ?? 'League' }
    : (seasonsByClub.get(state.club) ?? []).find((s) => s.mode === state.mode);
  const lens = season ? season.label
    : (MODES.find((m) => m.id === state.mode) ?? MODES.find((m) => m.id === 'lg')).label;
  const mine = rows.findIndex((p) => p.me);
  $('status').textContent = (rows.length
    ? `${rows.length} ${state.view === 'goalies' ? 'goalie' : 'skater'}${rows.length === 1 ? '' : 's'} · ${lens}`
    : `Nobody here with ${minGp()}+ games · ${lens}`)
    + (mine >= 0 ? ` · you're #${mine + 1}` : '');

  const head = `<thead><tr><th class="lb-rank">#</th><th class="lb-name">Player</th>${cols.map((c) =>
    `<th scope="col" title="${esc(c.tip)}" aria-sort="${c === sortCol ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}">`
    + `<button type="button" data-key="${c.key}">${esc(c.head)}${c === sortCol ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>`;
  // Your row opens My player (Oct 19).
  const body = `<tbody>${rows.map((p, i) => `<tr${p.me ? ' class="lb-me lb-open" tabindex="0" title="Open My player"' : ''}><td class="lb-rank">${i + 1}</td><td class="lb-name">${esc(p.name)}${p.me ? ' <span class="lb-you">you</span>' : ''}</td>${cols.map((c) =>
    `<td${c === sortCol ? ' class="lb-on"' : ''}>${c.fmt(c.get(p))}</td>`).join('')}</tr>`).join('')}</tbody>`;
  $('table').innerHTML = head + body;
}

function openMe() {
  state.board = 'me';
  // The board's lens follows you, a league season included (a whole
  // league reads as every league game: My player has no league pick).
  state.pmode = lensNow().startsWith('lgl') ? 'lg' : lensNow();
  state.ppage = 1;
  drawTabs(tabs);
  render();
  window.scrollTo({ top: 0 });
}

$('table').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.closest('tr.lb-open')) openMe();
});
$('table').addEventListener('click', (e) => {
  if ((state.board === 'clubs' || onLeagues()) && e.target.closest('tr.lb-open')) { openMe(); return; }
  const btn = e.target.closest('button[data-key]');
  if (!btn) return;
  const key = btn.dataset.key;
  if (state.board === 'frenzy') {
    const col = frenzyCols().find((c) => c.key === key);
    if (state.fsort === key) state.fdir = state.fdir === 'desc' ? 'asc' : 'desc';
    else { state.fsort = key; state.fdir = col.asc ? 'asc' : 'desc'; }
    drawFrenzy();
    return;
  }
  const col = COLUMNS[state.view].find((c) => c.key === key);
  if (state.sort === key) state.dir = state.dir === 'desc' ? 'asc' : 'desc';
  else { state.sort = key; state.dir = col.asc ? 'asc' : 'desc'; }
  draw();
});
$('min').addEventListener('change', (e) => { state.min = Number(e.target.value); draw(); });

// ── club search ─────────────────────────────────────────────────────────
let typing = 0;
$('q').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  clearTimeout(typing);
  if (q.length < 2) { hideHits(); return; }
  typing = setTimeout(async () => {
    try {
      const { clubs } = await api(`/clubs?q=${encodeURIComponent(q)}`);
      showHits(clubs);
    } catch (anErr) {
      if (anErr instanceof SignedOut) { hideHits(); show('gate'); return; }
      showHits([]);
    }
  }, 250);
});
$('q').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideHits();
  if (e.key === 'Enter') $('hits').querySelector('li')?.click();
});
document.addEventListener('click', (e) => { if (!e.target.closest('.lb-search')) hideHits(); });

function showHits(aClubs) {
  const ul = $('hits');
  ul.replaceChildren(...(aClubs.length ? aClubs : [null]).map((c) => {
    const li = document.createElement('li');
    if (!c) {
      li.className = 'lb-nohit';
      li.textContent = 'No club by that name.';
      return li;
    }
    li.setAttribute('role', 'option');
    li.tabIndex = 0;
    li.innerHTML = `<span>${esc(c.name)}</span><small>${c.games} games</small>`;
    const pick = () => {
      state.club = c.clubId;
      state.sort = null;
      if (state.mode.startsWith('lg')) state.mode = 'lg'; // a season is per club
      $('q').value = '';
      hideHits();
      load();
    };
    li.addEventListener('click', pick);
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') pick(); });
    return li;
  }));
  ul.hidden = false;
  $('q').setAttribute('aria-expanded', 'true');
}

function hideHits() {
  $('hits').hidden = true;
  $('q').setAttribute('aria-expanded', 'false');
}

// ── who is looking ──────────────────────────────────────────────────────
// Signed in: the board. Signed out: the members-only screen, its button
// coming back to this very board. The API down: say so — a Sign in button
// that leads nowhere would be worse.
// ── the tabs, and the premium boards ────────────────────────────────────
function drawTabs(aBoards) {
  $('boards').replaceChildren(...aBoards.map((b) => {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'lb-tab';
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', String(b.id === state.board));
    t.append(b.label);
    t.addEventListener('click', () => {
      if (b.id === state.board) return;
      state.board = b.id;
      drawTabs(aBoards);
      render();
    });
    return t;
  }));
}

/** Clubs, one of the premium boards, or My player. */
function render() {
  const clubs = state.board === 'clubs' || onLeagues(); // the same table
  const me = state.board === 'me';
  $('clubui').hidden = !clubs;
  $('pcontrols').hidden = clubs || (state.board !== 'streaks' && state.board !== 'frenzy');
  $('fwrap').hidden = state.board !== 'frenzy';
  $('boardout').hidden = me;
  $('playerui').hidden = !me;
  if (me) { ++request; loadPlayer(); return; }
  ++playerRequest; // a My player answer still on its way is dropped
  if (clubs) { load(); return; }
  if (state.board === 'frenzy') { loadFrenzy(); return; }
  loadPremium();
}

const groupOf = { skater: 'SKATERS', goalie: 'GOALTENDING', team: 'BOTH BENCHES' };

async function loadPremium() {
  saveUrl();
  const which = state.board;
  const mine = ++request;
  $('status').textContent = 'Loading… a board read for the first time in a while can take a few seconds.';
  $('table').replaceChildren();
  if (which === 'streaks') {
    chips($('pmodes'), STREAK_MODES, state.smode, (id) => { state.smode = id; loadPremium(); });
  }
  try {
    const path = which === 'streaks' ? `/boards/streaks?mode=${state.smode}` : `/boards/${which}`;
    const data = await api(path);
    if (mine !== request) return;
    if (which === 'streaks') drawStreaks(data.rows);
    else if (which === 'milestones') drawMilestones(data);
    else drawElo(data.rows);
  } catch (anErr) {
    if (mine !== request) return;
    if (anErr instanceof SignedOut) { show('gate'); return; }
    $('status').textContent = 'This board is unavailable right now — try again in a few minutes.';
  }
}

/** Rows grouped by bench, a header row per group, in the book's order. */
function grouped(aRows, aCols, aRow) {
  let html = '';
  for (const audience of ['skater', 'goalie', 'team']) {
    const rows = aRows.filter((r) => r.audience === audience);
    if (!rows.length) continue;
    html += `<tr class="lb-section"><th colspan="${aCols}">${groupOf[audience]}</th></tr>`;
    html += rows.map(aRow).join('');
  }
  return html;
}

function drawStreaks(aRows) {
  const lens = STREAK_MODES.find((m) => m.id === state.smode).label;
  const held = aRows.filter((r) => r.holderIsMe).length;
  const live = aRows.filter((r) => r.myCurrent >= 2).length;
  $('status').textContent = `${aRows.length} streaks · ${lens} · you: ${live} live run${live === 1 ? '' : 's'}, `
    + `${held} record${held === 1 ? '' : 's'} held`;
  const head = '<thead><tr><th class="lb-left">Streak</th><th>Record</th><th class="lb-left">Held by</th>'
    + '<th>Your current</th><th>Your best</th><th>Your rank</th></tr></thead>';
  const body = grouped(aRows, 6, (r) => `<tr${r.holderIsMe ? ' class="lb-me"' : ''}>`
    + `<td class="lb-left lb-name">${esc(r.label)}</td><td class="lb-on">${int(r.record)}</td>`
    + `<td class="lb-left">${r.holderIsMe ? '<span class="lb-star">★</span> you' : esc(r.holder ?? '—')}</td>`
    + `<td>${r.myCurrent >= 2 ? `🔥 ${r.myCurrent}` : int(r.myCurrent)}</td><td>${int(r.myBest)}</td>`
    + `<td>${r.myRank > 0 ? `#${r.myRank} of ${r.contenders}` : '—'}</td></tr>`);
  $('table').innerHTML = head + `<tbody>${body}</tbody>`;
}

function drawMilestones(aData) {
  const rows = aData.rows ?? [];
  const leads = rows.filter((r) => r.leaderIsMe).length;
  $('status').textContent = rows.length
    ? `${rows.length} unlocked · you lead ${leads}` + (aData.hidden > 0 ? ` · ${aData.hidden} still hidden, somewhere` : '')
    : 'Nothing discovered yet' + (aData.hidden > 0 ? ` · ${aData.hidden} hidden, somewhere` : '');
  const num = (v) => (v == null ? '—' : Number(v).toLocaleString('en-US'));
  const head = '<thead><tr><th class="lb-left">Milestone</th><th class="lb-left">Leader</th><th>Total</th>'
    + '<th>You</th><th>Your rank</th><th class="lb-left">Next mark</th><th class="lb-left">NHL summit</th>'
    + '<th class="lb-left">Found by</th></tr></thead>';
  const body = grouped(rows, 8, (r) => `<tr${r.leaderIsMe ? ' class="lb-me"' : ''}>`
    + `<td class="lb-left lb-name">${esc(r.label)}</td>`
    + `<td class="lb-left">${r.leaderIsMe ? '<span class="lb-star">★</span> you' : esc(r.leader ?? '—')}</td>`
    + `<td class="lb-on">${num(r.leaderTotal)}</td><td>${num(r.myTotal)}</td>`
    + `<td>${r.myRank > 0 ? `#${r.myRank} of ${r.contenders}` : '—'}</td>`
    + `<td class="lb-left">${r.next ? `${esc(r.next.name)} · ${num(r.next.value)}` : '—'}</td>`
    + `<td class="lb-left">${r.summit ? `${esc(r.summit.name)} · ${num(r.summit.value)}` : '—'}</td>`
    + `<td class="lb-left">${esc(r.foundBy ?? '—')}</td></tr>`);
  $('table').innerHTML = head + `<tbody>${body}</tbody>`;
}

function drawElo(aRows) {
  if (!aRows.length) {
    $('status').textContent = 'Nobody has played a rated Mix \'Em Up game yet.';
    $('table').replaceChildren();
    return;
  }
  const you = aRows.find((r) => r.me);
  $('status').textContent = `${aRows.length} rated player${aRows.length === 1 ? '' : 's'} · 1500 to start, K = 32`
    + (you ? ` · you're #${you.rank}` : '');
  const head = '<thead><tr><th class="lb-rank">#</th><th class="lb-name">Player</th><th>ELO</th>'
    + '<th>GP</th><th>W-L</th><th>W%</th></tr></thead>';
  const body = aRows.map((r) => `<tr${r.me ? ' class="lb-me"' : ''}><td class="lb-rank">${r.rank}</td>`
    + `<td class="lb-name">${esc(r.name)}${r.me ? ' <span class="lb-you">you</span>' : ''}</td>`
    + `<td class="lb-on">${int(r.rating)}</td><td>${int(r.games)}</td><td>${r.w}-${r.l}</td>`
    + `<td>${r.games > 0 ? Math.round((100 * r.w) / r.games) : 0}%</td></tr>`).join('');
  $('table').innerHTML = head + `<tbody>${body}</tbody>`;
}

// ── Furball Frenzy (Oct 18) ─────────────────────────────────────────────
// All-time: one row per player ever drafted — tournaments, titles, MVPs and
// the career lines. One tournament: its table, its skaters, its goalies.
const FRENZY_VIEWS = [
  { id: 'standings', label: 'Standings' },
  { id: 'skaters', label: 'Skaters' },
  { id: 'goalies', label: 'Goalies' },
];
const CAREER = [
  { key: 't', head: 'T', tip: 'Tournaments played', get: (p) => p.tournaments, fmt: int },
  { key: 'won', head: '🏆', tip: 'Titles', get: (p) => p.titles, fmt: int },
  { key: 'mvp', head: 'MVP', tip: 'Tournament MVPs', get: (p) => p.mvps, fmt: int },
];
// Every column of the club boards (Oct 18: the web is where there is room
// for them) -- the API sends Frenzy rows under the club boards' field names.
const FRENZY_COLS = {
  allskaters: [...CAREER, ...COLUMNS.skaters],
  allgoalies: [...CAREER, ...COLUMNS.goalies],
  skaters: COLUMNS.skaters,
  goalies: COLUMNS.goalies,
};
const FRENZY_DEFAULT = { allskaters: 'won', allgoalies: 'won', skaters: 'p', goalies: 'svpct' };
let frenzy = null;              // /boards/frenzy, fetched once per visit
const frenzyOne = new Map();   // /boards/frenzy/{id}, by id

const frenzyKey = () => (state.ft === 'all' ? `all${state.fview}` : state.fview);
const frenzyCols = () => FRENZY_COLS[frenzyKey()] ?? [];

async function loadFrenzy() {
  const views = state.ft === 'all' ? FRENZY_VIEWS.slice(1) : FRENZY_VIEWS;
  if (!views.some((v) => v.id === state.fview)) state.fview = state.ft === 'all' ? 'skaters' : 'standings';
  chips($('pmodes'), views, state.fview, (id) => { state.fview = id; state.fsort = null; loadFrenzy(); });
  saveUrl();
  const mine = ++request;
  const cached = state.ft === 'all' ? frenzy : frenzyOne.get(state.ft);
  if (!cached) {
    $('status').textContent = 'Loading…';
    $('table').replaceChildren();
  }
  try {
    if (!frenzy) frenzy = await api('/boards/frenzy');
    if (mine !== request) return;
    if (state.ft !== 'all' && !frenzy.tournaments.some((t) => String(t.id) === state.ft)) {
      state.ft = 'all'; // an old link: back to the all-time table
      loadFrenzy();
      return;
    }
    drawFrenzySelect();
    if (state.ft !== 'all' && !frenzyOne.has(state.ft)) {
      frenzyOne.set(state.ft, await api(`/boards/frenzy/${state.ft}`));
      if (mine !== request) return;
    }
    drawFrenzy();
  } catch (anErr) {
    if (mine !== request) return;
    if (anErr instanceof SignedOut) { show('gate'); return; }
    $('status').textContent = 'This board is unavailable right now — try again in a few minutes.';
  }
}

function drawFrenzySelect() {
  const select = $('ftour');
  select.replaceChildren(new Option(`All-time (${frenzy.tournaments.length})`, 'all'),
    ...frenzy.tournaments.map((t) => new Option(t.title, String(t.id))));
  select.value = state.ft;
}
$('ftour').addEventListener('change', (e) => {
  state.ft = e.target.value;
  state.fsort = null;
  state.fview = null; // all-time opens on Skaters, a tournament on its Standings
  loadFrenzy();
});

const team = (aLabel, aCaptain) => `Team ${esc(aLabel)}${aCaptain ? ` <small class="lb-dim">${esc(aCaptain)}</small>` : ''}`;

function drawFrenzy() {
  const one = state.ft === 'all' ? null : frenzyOne.get(state.ft);
  if (one && state.fview === 'standings') {
    drawFrenzyHead(one);
    const head = '<thead><tr><th class="lb-rank">#</th><th class="lb-name">Team</th><th>GP</th><th>W</th>'
      + '<th>L</th><th>OTL</th><th>PTS</th><th>GF</th><th>GA</th><th>DIFF</th></tr></thead>';
    const champ = one.champion?.label;
    const body = one.standings.map((r) => `<tr><td class="lb-rank">${r.rank}</td>`
      + `<td class="lb-name">${team(r.label, r.captain)}${r.label === champ ? ' <span class="lb-star">🏆</span>' : ''}</td>`
      + `<td>${int(r.gp)}</td><td>${int(r.w)}</td><td>${int(r.l)}</td><td>${int(r.otl)}</td>`
      + `<td class="lb-on">${int(r.pts)}</td><td>${int(r.gf)}</td><td>${int(r.ga)}</td><td>${signed(r.diff)}</td></tr>`).join('');
    $('table').innerHTML = head + `<tbody>${body}</tbody>`;
    return;
  }
  const key = frenzyKey();
  const cols = frenzyCols();
  let rows;
  rows = (one ? one.players : frenzy.players)
    .filter((p) => (state.fview === 'goalies' ? p.goalieGames : p.skaterGames) > 0);
  const sortCol = cols.find((c) => c.key === state.fsort) ?? cols.find((c) => c.key === FRENZY_DEFAULT[key]);
  const dir = state.fsort ? state.fdir : (sortCol.asc ? 'asc' : 'desc');
  const sign = dir === 'asc' ? 1 : -1;
  // Ties fall to points (skaters) or saves (goalies), then the name.
  const tie = cols.find((c) => c.key === (state.fview === 'goalies' ? 'sv' : 'p'));
  rows = rows.slice().sort((a, b) => {
    const x = sortCol.get(a);
    const y = sortCol.get(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return sign * (x - y) || (tie.get(b) ?? 0) - (tie.get(a) ?? 0)
      || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  if (one) {
    drawFrenzyHead(one);
  } else {
    const at = rows.findIndex((p) => p.me);
    $('status').textContent = `${frenzy.tournaments.length} Furball Frenzies · ${rows.length} `
      + `${state.fview === 'goalies' ? 'goalie' : 'skater'}${rows.length === 1 ? '' : 's'}`
      + (at >= 0 ? ` · you're #${at + 1}` : '');
  }
  const head = `<thead><tr><th class="lb-rank">#</th><th class="lb-name">Player</th>${cols.map((c) =>
    `<th scope="col" title="${esc(c.tip)}" aria-sort="${c === sortCol ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}">`
    + `<button type="button" data-key="${c.key}">${esc(c.head)}${c === sortCol ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>`;
  const body = rows.map((p, i) => `<tr${p.me ? ' class="lb-me"' : ''}><td class="lb-rank">${i + 1}</td>`
    + `<td class="lb-name">${esc(p.name)}${p.mvp ? ' <span class="lb-star" title="Tournament MVP">⭐</span>' : ''}`
    + `${p.me ? ' <span class="lb-you">you</span>' : ''}</td>${cols.map((c) =>
      `<td${c === sortCol ? ' class="lb-on"' : ''}>${c.fmt(c.get(p))}</td>`).join('')}</tr>`).join('');
  $('table').innerHTML = head + `<tbody>${body}</tbody>`;
}

/** One tournament's line: champion and MVP. */
function drawFrenzyHead(aOne) {
  const parts = [aOne.date ? esc(aOne.date) : null];
  if (aOne.champion) parts.push(`🏆 ${team(aOne.champion.label, aOne.champion.captain)}`);
  if (aOne.mvp) parts.push(`⭐ MVP ${esc(aOne.mvp)}`);
  $('status').innerHTML = parts.filter(Boolean).join(' · ');
}

// ── who is looking ──────────────────────────────────────────────────────
// Signed in: the board. Signed out: the members-only screen, its button
// coming back to this very board. The API down: say so — a Sign in button
// that leads nowhere would be worse.
// ── My player (Oct 19) ──────────────────────────────────────────────────
// Your own line, every club combined, as tiles — the board's columns — then
// your game log, 20 games a page. The API reads WHO from the sign-in: no
// player id ever travels.
let playerRequest = 0;
let gamesRequest = 0;
let playerRoles = { skater: 0, goalie: 0 }; // games per role in the lens
// The game log's positions (Oct 19): the Cards page's chips, their colours
// (theme.json). Skater slots mix freely; G stands alone.
const SKATER_POS = ['C', 'LW', 'RW', 'LD', 'RD'];
const POS_COLOR = { C: '#E5352B', LW: '#35C759', RW: '#2F7CF6', LD: '#19BDC2', RD: '#F2C21B', G: '#9B4DE0' };
/** What the server read last: 'G' or skater slots (its default = your main role). */
let serverPos = SKATER_POS;
/** 'G', or the skater slots shown (all five = every skater game). Yours
 *  when picked and played, else what the server read. */
const logPos = () => {
  if (state.ppos === 'G' && playerRoles.goalie > 0) return 'G';
  if (Array.isArray(state.ppos) && state.ppos.length && playerRoles.skater > 0) return state.ppos;
  return serverPos;
};

/** A pick: G alone; from "every skater" (or G) a slot picks just that
 *  one, then the slots toggle -- the last one off is every skater again.
 *  G toggles too (Oct 21): off again is every skater, the way a skater slot
 *  turns G off -- when there are skater games to show. */
function pickPos(aPos) {
  const cur = logPos();
  if (aPos === 'G') {
    state.ppos = cur === 'G' && playerRoles.skater > 0 ? [...SKATER_POS] : 'G';
  } else if (cur === 'G' || cur.length === SKATER_POS.length) {
    state.ppos = [aPos];
  } else {
    const set = new Set(cur);
    if (set.has(aPos)) set.delete(aPos); else set.add(aPos);
    state.ppos = set.size ? SKATER_POS.filter((p) => set.has(p)) : [...SKATER_POS];
  }
}

async function loadPlayer() {
  saveUrl();
  const mine = ++playerRequest;
  $('pl-sub').textContent = 'Loading…';
  try {
    // Positions only when YOU picked some: else the server reads the role
    // you play most, and says which.
    const asked = state.ppos === 'G' ? 'G' : state.ppos?.length ? state.ppos.join(',') : null;
    const data = await api(`/me/player?mode=${state.pmode}${asked ? `&pos=${asked}` : ''}`);
    if (mine !== playerRequest) return;
    if (!data.linked) {
      drawUnlinked();
      return;
    }
    // A lens you never played (an old link, the board's lens): All games.
    const lensKey = state.pmode.startsWith('lg') ? 'lg' : state.pmode;
    if (state.pmode !== 'all' && !(data.lenses?.[lensKey] > 0)) {
      state.pmode = 'all';
      loadPlayer();
      return;
    }
    // A role you never played in this lens: back to your main one.
    if (asked && !((asked === 'G' ? data.roles?.goalie : data.roles?.skater) > 0)) {
      state.ppos = null;
      loadPlayer();
      return;
    }
    drawPlayer(data);
    loadGames();
  } catch (anErr) {
    if (mine !== playerRequest) return;
    if (anErr instanceof SignedOut) { show('gate'); return; }
    $('pl-sub').textContent = 'Your stats are unavailable right now — try again in a few minutes.';
  }
}

function drawUnlinked() {
  $('pl-name').textContent = 'My player';
  $('pl-sub').textContent = 'Link your gamertag with /trackme in Discord to see your stats here.';
  for (const id of ['pl-clubs', 'pl-modes', 'pl-tiles', 'pl-log']) $(id).replaceChildren();
  $('pl-logstatus').textContent = '';
  $('pl-pager').hidden = true;
}

// The League lens' season pick on My player (Oct 20): "All league games",
// then every league season you played (newest first), fetched once.
let playerSeasons = null;
let lastPlayer = null; // the last /me/player answer drawn

async function drawPlayerSeasons() {
  const wrap = $('pl-seasonwrap');
  if (!state.pmode.startsWith('lg')) { wrap.hidden = true; return; }
  if (!playerSeasons) {
    playerSeasons = [];
    try {
      playerSeasons = (await api('/me/seasons')).seasons ?? [];
    } catch {
      // no season pick; "every league game" still reads
    }
    // A season link drew "League" before the list came: once more, named.
    if (lastPlayer && playerSeasons.some((s) => s.mode === state.pmode)) {
      drawPlayer(lastPlayer);
      return;
    }
  }
  if (!playerSeasons.length) { wrap.hidden = true; return; }
  const select = $('pl-season');
  select.replaceChildren(new Option('All league games', 'lg'),
    ...playerSeasons.map((s) => new Option(`${s.label} (${s.games})`, s.mode)));
  select.value = playerSeasons.some((s) => s.mode === state.pmode) ? state.pmode : 'lg';
  wrap.hidden = false;
}
$('pl-season').addEventListener('change', (e) => {
  state.pmode = e.target.value;
  state.ppage = 1;
  loadPlayer();
});

function drawPlayer(aData) {
  lastPlayer = aData;
  const p = aData.player;
  const season = (playerSeasons ?? []).find((s) => s.mode === state.pmode);
  const lens = season ? season.label
    : (MODES.find((m) => m.id === state.pmode) ?? MODES.find((m) => m.id === 'lg')).label;
  const name = p?.name ?? me.gamertag ?? 'My player';
  $('pl-name').textContent = name;
  document.title = `${name} · My player — Elvi's Team Tracker`;
  const clubs = aData.clubs ?? [];
  // The positions the whole page reads -- the tiles and the game log.
  playerRoles = { skater: aData.roles?.skater ?? 0, goalie: aData.roles?.goalie ?? 0 };
  serverPos = aData.pos === 'G' ? 'G' : aData.pos && aData.pos !== 'skater'
    ? SKATER_POS.filter((x) => aData.pos.split(',').includes(x)) : SKATER_POS;
  const on = logPos();
  const where = on === 'G' ? 'In net' : on.length === SKATER_POS.length ? 'Skater' : on.join(', ');
  $('pl-sub').textContent = `${clubs.length > 1 ? 'All clubs combined' : (clubs[0]?.name ?? '')}`
    + ` · ${p?.gamesPlayed ?? 0} GP · ${lens} · ${where}`;

  // The clubs you played for, busiest first: each opens its board. A long
  // career folds behind "+N more" — 40 chips would bury the stats.
  const FOLD = 8;
  const shown = state.allClubs ? clubs : clubs.slice(0, FOLD);
  $('pl-clubstitle').hidden = !clubs.length;
  $('pl-clubs').replaceChildren(...shown.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lb-chip';
    b.title = `Open the ${c.name} board`;
    b.append(c.name);
    const n = document.createElement('small');
    n.textContent = `${c.games} GP`;
    b.append(n);
    b.addEventListener('click', () => {
      state.board = 'clubs';
      state.club = c.clubId;
      state.mode = 'all';
      state.sort = null;
      state.min = null;
      drawTabs(tabs);
      render();
    });
    return b;
  }));
  if (clubs.length > FOLD) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'lb-chip';
    more.textContent = state.allClubs ? 'Show fewer' : `+${clubs.length - FOLD} more`;
    more.addEventListener('click', () => { state.allClubs = !state.allClubs; drawPlayer(aData); });
    $('pl-clubs').append(more);
  }

  const lenses = aData.lenses ?? {};
  const onLeague = state.pmode.startsWith('lg');
  chips($('pl-modes'), MODES.filter((m) => m.id === 'all' || (lenses[m.id] ?? 0) > 0),
    onLeague ? 'lg' : state.pmode, (id) => {
      if (id === state.pmode || (id === 'lg' && onLeague)) return; // already a League reading
      state.pmode = id;
      state.ppage = 1;
      loadPlayer();
    });
  drawPlayerSeasons();

  // The position chips (the tiles AND the game log): the skater slots when
  // you skated in this lens, G when you played in net.
  const offered = [...(playerRoles.skater > 0 ? SKATER_POS : []), ...(playerRoles.goalie > 0 ? ['G'] : [])];
  $('pl-roles').hidden = !offered.length;
  $('pl-roles').replaceChildren(...offered.map((pos) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lb-chip lb-pos';
    b.setAttribute('aria-pressed', String(pos === 'G' ? on === 'G' : on !== 'G' && on.includes(pos)));
    const dot = document.createElement('span');
    dot.className = 'lb-dot';
    dot.style.background = POS_COLOR[pos];
    b.append(dot, pos);
    b.addEventListener('click', () => {
      pickPos(pos);
      state.ppage = 1;
      loadPlayer(); // the tiles read the new positions, then the game log
    });
    return b;
  }));

  const tiles = $('pl-tiles');
  tiles.replaceChildren();
  if (!p) {
    const empty = document.createElement('p');
    empty.className = 'pl-empty';
    empty.textContent = `No games here yet · ${lens}`;
    tiles.append(empty);
    return;
  }
  // The role you play most comes first.
  const roles = [
    { view: 'skaters', label: 'SKATER', gp: p.skaterGames ?? 0 },
    { view: 'goalies', label: 'GOALIE', gp: p.goalieGames ?? 0 },
  ].filter((r) => r.gp > 0).sort((a, b) => b.gp - a.gp);
  for (const role of roles) {
    const h = document.createElement('h3');
    h.className = 'pl-role';
    h.textContent = role.label;
    const grid = document.createElement('div');
    grid.className = 'pl-tiles';
    grid.append(...COLUMNS[role.view].map((c) => {
      const t = document.createElement('div');
      t.className = 'pl-tile';
      t.title = c.tip;
      const v = document.createElement('b');
      v.textContent = c.fmt(c.get(p));
      const k = document.createElement('span');
      k.textContent = c.head;
      t.append(v, k);
      return t;
    }));
    tiles.append(h, grid);
  }
}

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const svPct = (g) => (g.shots > 0 ? (g.saves >= g.shots ? '1.000' : (g.saves / g.shots).toFixed(3).slice(1)) : '—');
const pctInt = (v) => (v == null ? '—' : `${v}`);
const mmss = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

// The game log's columns, per role — a game's box-score line ("shots" is the
// skater's shots, or the shots the goalie faced).
const GAME_COLS = {
  skater: [
    { head: 'Pos', tip: 'Position played', cell: (g) => esc(g.position ?? '—') },
    { head: 'G', tip: 'Goals', cell: (g) => int(g.goals) },
    { head: 'A', tip: 'Assists', cell: (g) => int(g.assists) },
    { head: 'P', tip: 'Points', cell: (g) => int(g.points), on: true },
    { head: '+/-', tip: 'Plus/minus', cell: (g) => signed(g.plusMinus) },
    { head: 'S', tip: 'Shots', cell: (g) => int(g.shots) },
    { head: 'HIT', tip: 'Hits', cell: (g) => int(g.hits) },
    { head: 'TK', tip: 'Takeaways (interceptions included)', cell: (g) => int(g.takeaways) },
    { head: 'GV', tip: 'Giveaways', cell: (g) => int(g.giveaways) },
    { head: 'PASS%', tip: 'Pass completion', cell: (g) => pctInt(g.passPct) },
    { head: 'BLK', tip: 'Blocked shots', cell: (g) => int(g.blocks) },
    { head: 'PIM', tip: 'Penalty minutes', cell: (g) => int(g.pim) },
    { head: 'POSS', tip: 'Time with the puck', cell: (g) => mmss(g.possessionSecs) },
    { head: 'RTG', tip: 'Game rating, the score post\'s number', cell: (g) => int(g.rating) },
  ],
  goalie: [
    { head: 'SV', tip: 'Saves', cell: (g) => int(g.saves), on: true },
    { head: 'SA', tip: 'Shots against', cell: (g) => int(g.shots) },
    { head: 'GA', tip: 'Goals against', cell: (g) => (g.shots == null ? '—' : String(g.shots - g.saves)) },
    { head: 'SV%', tip: 'Save percentage', cell: svPct },
    { head: 'SO P', tip: 'Shutout periods', cell: (g) => int(g.soPeriods) },
    { head: 'BRK', tip: 'Breakaway saves / breakaway shots', cell: (g) => (g.breakawayShots ? `${g.breakawaySaves}/${g.breakawayShots}` : '—') },
    { head: 'DSV', tip: 'Desperation saves', cell: (g) => int(g.desperationSaves) },
    { head: 'POK', tip: 'Poke checks', cell: (g) => int(g.pokechecks) },
    { head: 'RTG', tip: 'Game rating, the score post\'s number', cell: (g) => int(g.rating) },
  ],
};

async function loadGames() {
  const mine = ++gamesRequest;
  $('pl-logstatus').textContent = 'Loading…';
  try {
    const pos = logPos();
    const log = await api(`/me/games?mode=${state.pmode}&pos=${pos === 'G' ? 'G' : pos.join(',')}&page=${state.ppage}`);
    if (mine !== gamesRequest || state.board !== 'me') return;
    state.ppage = log.page ?? 1;
    saveUrl();
    drawGames(log);
  } catch (anErr) {
    if (mine !== gamesRequest) return;
    if (anErr instanceof SignedOut) { show('gate'); return; }
    $('pl-logstatus').textContent = 'The game log is unavailable right now — try again in a few minutes.';
  }
}

function drawGames(aLog) {
  const rows = aLog.rows ?? [];
  const pos = logPos();
  const where = aLog.role === 'goalie' ? 'in net'
    : pos === 'G' || pos.length === SKATER_POS.length ? 'as a skater' : `at ${pos.join(', ')}`;
  $('pl-logstatus').textContent = aLog.games
    ? `${aLog.games} game${aLog.games === 1 ? '' : 's'} ${where} this season · newest first`
    : `No games ${where} yet.`;
  if (!rows.length) {
    $('pl-log').replaceChildren();
    $('pl-pager').hidden = true;
    return;
  }
  // One role per page (Oct 19, the players' ask): its own full set of columns.
  const cols = GAME_COLS[aLog.role === 'goalie' ? 'goalie' : 'skater'];
  const head = '<thead><tr><th class="lb-left">Date</th><th class="lb-left">Game</th>'
    + '<th class="lb-left">Club</th>'
    + '<th class="lb-left pl-opp" data-n="Opponent"><span class="pl-oppn">Opponent</span></th>'
    + '<th>Result</th>'
    + `${cols.map((c) => `<th title="${esc(c.tip)}">${esc(c.head)}</th>`).join('')}</tr></thead>`;
  const body = rows.map((g) => {
    const kind = g.private ? 'Private' : (g.threes ? '3s' : '6s');
    const res = { W: 'pl-w', L: 'pl-l', OTL: 'pl-otl' }[g.result] ?? '';
    return `<tr><td class="lb-left">${esc(DATE.format(new Date(g.ts * 1000)))}</td>`
      + `<td class="lb-left lb-dim">${kind}</td><td class="lb-left">${esc(g.club)}</td>`
      + `<td class="lb-left pl-opp" title="${esc(g.opp)}" data-n="${esc(g.opp)}">`
      + `<span class="pl-oppn">${esc(g.opp)}</span></td>`
      + `<td class="${res}">${esc(g.result)} ${esc(g.score)}</td>`
      + cols.map((c) => `<td${c.on ? ' class="lb-on"' : ''}>${c.cell(g)}</td>`).join('') + '</tr>';
  }).join('');
  $('pl-log').innerHTML = head + `<tbody>${body}</tbody>`;
  stickOpponent($('pl-log'));
  const pages = aLog.pages ?? 1;
  $('pl-pager').hidden = pages <= 1;
  $('pl-page').textContent = `Page ${aLog.page} / ${pages}`;
  $('pl-prev').disabled = aLog.page <= 1;
  $('pl-next').disabled = aLog.page >= pages;
}

/**
 * The game log's Opponent while it is stuck to the left edge (Oct 21): the
 * whole name at rest; once Date / Game / Club have scrolled under it, the
 * table gets .pl-stuck and the column shows 161px of it, a longer name
 * losing its START (see the CSS — the column itself never changes width).
 *
 * @param aTable the rendered game log table
 */
function stickOpponent(aTable) {
  if (!aTable.querySelector('thead th.pl-opp')) return;
  aTable.classList.remove('pl-stuck');
  // 161px = the stuck column's room for a name (leaderboards.css).
  for (const n of aTable.querySelectorAll('.pl-oppn')) {
    n.parentElement.classList.toggle('pl-long', n.offsetWidth > 161);
  }
  const scroller = aTable.closest('.lb-scroll');
  // Stuck = scrolled past where the column would naturally start: the right
  // edge of Club, the cell before it. Not the sticky cell's own offsetLeft,
  // which travels with it once it sticks.
  const follow = () => {
    const t = scroller.querySelector('table');
    const prev = t?.querySelector('thead th.pl-opp')?.previousElementSibling;
    if (prev) t.classList.toggle('pl-stuck', scroller.scrollLeft > prev.offsetLeft + prev.offsetWidth);
  };
  if (!scroller.dataset.stick) {
    scroller.dataset.stick = '1';
    scroller.addEventListener('scroll', follow, { passive: true });
  }
  follow();
}

const turnPage = (aStep) => {
  state.ppage = Math.max(1, state.ppage + aStep);
  loadGames();
  $('pl-log').closest('.lb-scroll').scrollIntoView({ block: 'nearest' });
};
$('pl-prev').addEventListener('click', () => turnPage(-1));
$('pl-next').addEventListener('click', () => turnPage(1));

$('signin').href = `${API}/auth/login?return=${encodeURIComponent(location.pathname)}`;
const me = await mountAuth();
if (me.signedIn) {
  // Phase C: signed in, the board opens on YOUR club — unless the link
  // asks for another one.
  if (!params.get('club') && me.club) state.club = me.club.clubId;
  myClubs = me.clubs ?? [];
  tabs = BOARDS.filter((b) => !b.premium || me.premium);
  // A premium link, not premium. My player is anyone's.
  if (state.board !== 'me' && !tabs.some((b) => b.id === state.board)) state.board = 'clubs';
  drawTabs(tabs);
  show('board');
  render();
} else {
  show(me.available ? 'gate' : 'down');
}
