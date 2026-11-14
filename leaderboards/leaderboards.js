// The leaderboards page: one club, one lens, every column sortable.
//
// Reads the PUBLIC API (EASSS PublicApi, through the Cloudflare Tunnel):
//   /clubs?q=            the search box
//   /leaderboard?club=&mode=   the board, aggregated by gamertag
//   /me/player, /me/games      My player (?board=me): your stats, your game log
// The state lives in the URL (?club=&mode=&view=&sort=&dir=&min=) so a board
// can be shared as a link. On localhost, ?api=http://localhost:8781 points
// the page at the lab's API instead.

import { mountAuth, loginUrl, searchClub, trackClub } from './auth.js?v=9cb01f1a46';

const params = new URLSearchParams(location.search);
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
// Your pages' own routes (Nov 12, elvis): /myplayer/ and /myclubs/ serve
// this same page (Publish-SiteCards copies it there, its <base> keeps every
// relative file on /leaderboards/). The path says the board; ?board= still
// works and saveUrl moves it onto the route.
const ROUTES = { me: '/myplayer/', myclubs: '/myclubs/' };
const routed = Object.keys(ROUTES).find((b) => location.pathname.startsWith(ROUTES[b]));
if (routed && !params.has('board')) params.set('board', routed);
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
    { key: 'w', head: 'W', tip: 'Wins as a skater', get: (p) => p.skaterWins, fmt: int },
    { key: 'l', head: 'L', tip: 'Losses as a skater, OT losses included', get: (p) => p.skaterLosses, fmt: int, asc: true },
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
    { key: 'w', head: 'W', tip: 'Wins in goal', get: (p) => p.goalieWins, fmt: int },
    { key: 'l', head: 'L', tip: 'Losses in goal, OT losses included', get: (p) => p.goalieLosses, fmt: int, asc: true },
    { key: 'svpct', head: 'SV%', tip: 'Save percentage', get: (p) => p.goalieSavePct, fmt: fix(2) },
    { key: 'gaa', head: 'GAA', tip: 'Goals against per 60 minutes', get: (p) => (p.goalieToiSeconds ? (3600 * p.goalieGoalsAgainst) / p.goalieToiSeconds : null), fmt: fix(2), asc: true },
    { key: 'sa', head: 'SA', tip: 'Shots against', get: (p) => p.goalieShotsAgainst, fmt: int },
    { key: 'sv', head: 'SV', tip: 'Saves', get: (p) => p.goalieSaves, fmt: int },
    { key: 'ga', head: 'GA', tip: 'Goals against', get: (p) => p.goalieGoalsAgainst, fmt: int, asc: true },
    { key: 'so', head: 'SO', tip: 'Shutouts: nothing allowed while facing a shot', get: (p) => p.goalieShutouts, fmt: int },
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
  // 'myclubs' (Nov 12): the games of the clubs you played for, the same way.
  board: ['me', 'myclubs'].includes(params.get('board')) || BOARDS.some((b) => b.id === params.get('board'))
    ? params.get('board') : 'clubs',
  // My clubs: the club (null = your busiest), its lens, its page.
  cclub: params.get('board') === 'myclubs' && /^\d{1,12}$/.test(params.get('club') ?? '') ? Number(params.get('club')) : null,
  cmode: params.get('board') === 'myclubs' && wantedMode && (MODES.some((m) => m.id === wantedMode))
    ? wantedMode : 'all',
  cpage: params.get('board') === 'myclubs' && /^\d{1,5}$/.test(params.get('page') ?? '')
    ? Math.max(1, Number(params.get('page'))) : 1,
  // A scouted club holding My clubs (Nov 12): any EA club id.
  cscout: params.get('board') === 'myclubs' && /^\d{1,12}$/.test(params.get('scout') ?? '')
    ? Number(params.get('scout')) : null,
  // My player's lens: a League reading can be one season ("lg23"), as on the boards.
  // 'ea' (Nov 11): EA's own career line, drawn apart from ours.
  pmode: wantedMode && (MODES.some((m) => m.id === wantedMode) || wantedMode === 'ea'
    || /^lg\d+$/.test(wantedMode)) ? wantedMode : 'all',
  ppage: /^\d{1,5}$/.test(params.get('page') ?? '') ? Math.max(1, Number(params.get('page'))) : 1,
  // The game log's positions: 'G', a list of skater slots, or null = the
  // role you play most, whole.
  ppos: params.get('pos') === 'G' ? 'G'
    : (params.get('pos') ?? '').split(',').filter((x) => ['C', 'LW', 'RW', 'LD', 'RD'].includes(x)),
  // My player at one club only (Nov 5): its chip filters the page.
  pclub: params.get('board') === 'me' && /^\d{1,12}$/.test(params.get('pclub') ?? '') ? Number(params.get('pclub')) : null,
  smode: STREAK_MODES.some((m) => m.id === params.get('smode')) ? params.get('smode') : 'all',
  // 'server' (Nov 4): your home server's primary clubs, one board.
  club: params.get('club') === 'server' ? 'server' : Number(params.get('club')) || DEFAULT_CLUB,
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
let myServer = null; // the home server's name when it has a board
let autoView = !params.get('view'); // the first board may pick the view for you
let request = 0;  // drops answers that arrive after a newer pick
let tabs = [];    // the boards this member sees

function saveUrl() {
  const q = new URLSearchParams();
  if (state.board === 'me') {
    if (state.pmode !== 'all') q.set('mode', state.pmode);
    if (state.ppos === 'G') q.set('pos', 'G');
    else if (state.ppos?.length) q.set('pos', state.ppos.join(','));
    if (state.pclub) q.set('pclub', state.pclub);
    if (state.ppage > 1) q.set('page', state.ppage);
  } else if (state.board === 'myclubs') {
    if (state.cclub) q.set('club', state.cclub);
    if (state.cmode !== 'all') q.set('mode', state.cmode);
    if (state.cpage > 1) q.set('page', state.cpage);
    if (state.cscout) q.set('scout', state.cscout);
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
  // Absolute: the page's <base> is /leaderboards/, the route is the board's.
  const qs = q.toString();
  history.replaceState(null, '', `${ROUTES[state.board] ?? '/leaderboards/'}${qs ? `?${qs}` : ''}`);
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
  // Seasons are per club: the server board reads every league game.
  if (onLeagues() || !state.mode.startsWith('lg') || state.club === 'server') { wrap.hidden = true; return; }
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
  // Your home server's board first (Nov 4): Discord's /leaderboard server.
  // Worded as a SERVER, not one more club (its name read like a club's).
  const picks = myServer
    ? [{ clubId: 'server', name: '🏠 My server', tag: myServer, server: true }, ...(aClubs ?? [])] : aClubs;
  if (!picks?.length) { el.hidden = true; return; }
  el.replaceChildren(...picks.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = c.server ? 'lb-chip lb-server' : 'lb-chip';
    if (c.server) b.title = `Every primary club of ${myServer}, combined`;
    b.setAttribute('aria-pressed', String(c.clubId === state.club));
    b.append(c.name);
    const n = document.createElement('small');
    n.textContent = c.tag ?? `${c.games} GP`;
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
  // The head's first-paint guesses (index.html) hand over: the sign-in
  // gate keeps its title and its pitch.
  if (aWhich === 'gate') document.documentElement.classList.remove('lb-own', 'lb-signed');
  $('board').hidden = aWhich !== 'board';
  $('gate').hidden = aWhich !== 'gate';
  $('down').hidden = aWhich !== 'down';
  $('gameui').hidden = aWhich !== 'game';
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
    $('club').textContent = board.club.clubId === 'server' ? `🏠 ${board.club.name}` : board.club.name;
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

/** The header's underline follows the view (Nov 12): My player / My clubs
 *  when one of them shows, Leaderboards otherwise -- your row on a club
 *  board opens My player without leaving the page. */
function syncNav() {
  const id = ['me', 'myclubs'].includes(state.board) ? state.board : null;
  document.querySelectorAll('.nav a[aria-current]').forEach((a) => a.removeAttribute('aria-current'));
  const on = id ? document.querySelector(`.nav a[data-extra="${id}"]`)
    : [...document.querySelectorAll('.nav-links a')].find((a) => a.getAttribute('href')?.startsWith('/leaderboards/')
      && !a.dataset.extra);
  on?.setAttribute('aria-current', 'page');
}

/** Clubs, one of the premium boards, or My player. */
function render() {
  const clubs = state.board === 'clubs' || onLeagues(); // the same table
  const me = state.board === 'me';
  const mine = state.board === 'myclubs';
  $('clubui').hidden = !clubs;
  $('pcontrols').hidden = clubs || (state.board !== 'streaks' && state.board !== 'frenzy');
  $('fwrap').hidden = state.board !== 'frenzy';
  $('boardout').hidden = me || mine;
  $('playerui').hidden = !me;
  $('clubsui').hidden = !mine;
  // My player and My clubs are not boards (Nov 12, elvis): no Clubs /
  // Leagues / ... tabs there -- they are your pages, the Leaderboards are
  // the Leaderboards link's.
  $('boards').hidden = mine || me;
  syncNav();
  // Signed in (render() only ever runs signed in), Nov 12, elvis: the boards
  // keep their title but not the explanation and its sign-in pitch -- like
  // the Cards page; YOUR pages (My player, My clubs) have neither.
  document.querySelector('.lb-head').hidden = mine || me;
  document.querySelector('.lb-note').hidden = true;
  document.documentElement.classList.remove('lb-own');
  if (mine) { ++request; ++playerRequest; loadClubGames(); return; }
  ++clubGamesRequest; // a My clubs answer still on its way is dropped
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
// All but the record (Nov 5): a Frenzy line carries no W/L, the standings do.
const noRecord = (cols) => cols.filter((c) => c.key !== 'w' && c.key !== 'l');
const FRENZY_COLS = {
  allskaters: [...CAREER, ...noRecord(COLUMNS.skaters)],
  allgoalies: [...CAREER, ...noRecord(COLUMNS.goalies)],
  skaters: noRecord(COLUMNS.skaters),
  goalies: noRecord(COLUMNS.goalies),
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

const clubParam = () => (state.pclub ? `&club=${state.pclub}` : '');

async function loadPlayer() {
  saveUrl();
  const mine = ++playerRequest;
  $('pl-sub').textContent = 'Loading…';
  try {
    // Positions only when YOU picked some: else the server reads the role
    // you play most, and says which.
    // EA's line (Nov 11) rides the All games answer: no lens, no club,
    // no position of ours applies to it.
    const onEa = state.pmode === 'ea';
    const asked = onEa ? null
      : state.ppos === 'G' ? 'G' : state.ppos?.length ? state.ppos.join(',') : null;
    const data = await api(`/me/player?mode=${onEa ? 'all' : state.pmode}${asked ? `&pos=${asked}` : ''}${onEa ? '' : clubParam()}`);
    if (mine !== playerRequest) return;
    if (!data.linked) {
      drawUnlinked();
      return;
    }
    // A lens you never played (an old link, the board's lens), or EA's line
    // before the daily pass fetched it: All games.
    const lensKey = state.pmode.startsWith('lg') ? 'lg' : state.pmode;
    if (onEa ? !data.ea : state.pmode !== 'all' && !(data.lenses?.[lensKey] > 0)) {
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
    if (!onEa) loadGames();
  } catch (anErr) {
    if (mine !== playerRequest) return;
    if (anErr instanceof SignedOut) { show('gate'); return; }
    $('pl-sub').textContent = 'Your stats are unavailable right now — try again in a few minutes.';
  }
}

function drawUnlinked() {
  $('pl-name').textContent = 'My player';
  $('pl-sub').textContent = 'Link your gamertag on the home page to see your stats here.';
  for (const id of ['pl-clubs', 'pl-modes', 'pl-tiles', 'pl-log']) $(id).replaceChildren();
  $('pl-logstatus').textContent = '';
  $('pl-pager').hidden = true;
}

// The League lens' season pick on My player (Oct 20): "All league games",
// then every league season you played (newest first), fetched once.
let playerSeasons = null;
let lastPlayer = null; // the last /me/player answer drawn
// Held by reference: the pick rides the lens chips' row, whose redraw takes
// it out of the page for a moment (getElementById would lose it).
const seasonWrap = $('pl-seasonwrap');
const seasonSelect = $('pl-season');

async function drawPlayerSeasons() {
  const wrap = seasonWrap;
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
    // Another lens picked while the list came (EA, Nov 12): no season pick.
    if (!state.pmode.startsWith('lg')) { wrap.hidden = true; return; }
  }
  if (!playerSeasons.length) { wrap.hidden = true; return; }
  const select = seasonSelect;
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
  // EA's own line (Nov 11): the same tiles, its numbers instead of ours --
  // never mixed. No clubs, no positions, no game log: EA keeps none of it.
  const onEa = state.pmode === 'ea' && !!aData.ea;
  const p = onEa ? aData.ea : aData.player;
  const season = (playerSeasons ?? []).find((s) => s.mode === state.pmode);
  const lens = onEa ? 'EA' : season ? season.label
    : (MODES.find((m) => m.id === state.pmode) ?? MODES.find((m) => m.id === 'lg')).label;
  const name = aData.player?.name ?? me.gamertag ?? 'My player';
  $('pl-name').textContent = name;
  document.title = `${name} · My player — Elvi's Team Tracker`;
  for (const el of [$('pl-clubstitle'), $('pl-clubs'), $('pl-roles'), ...document.querySelectorAll('.pl-loghead'),
    $('pl-logstatus'), $('pl-log').closest('.lb-scroll')]) el.hidden = onEa;
  if (onEa) $('pl-pager').hidden = true;
  const clubs = aData.clubs ?? [];
  // The positions the whole page reads -- the tiles and the game log.
  playerRoles = { skater: aData.roles?.skater ?? 0, goalie: aData.roles?.goalie ?? 0 };
  serverPos = aData.pos === 'G' ? 'G' : aData.pos && aData.pos !== 'skater'
    ? SKATER_POS.filter((x) => aData.pos.split(',').includes(x)) : SKATER_POS;
  const on = logPos();
  const where = on === 'G' ? 'In net' : on.length === SKATER_POS.length ? 'Skater' : on.join(', ');
  const atClub = state.pclub ? clubs.find((c) => c.clubId === state.pclub) : null;
  $('pl-sub').textContent = onEa
    ? `EA's own numbers · ${p.gamesPlayed ?? 0} GP · every club's public games + drop-ins, no privates`
      + (p.light ? ' · short line (EA gives no club for you, so only its search totals)' : '')
      + ` · as of ${new Date(p.fetchedAt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : `${atClub ? atClub.name : clubs.length > 1 ? 'All clubs combined' : (clubs[0]?.name ?? '')}`
      + ` · ${p?.gamesPlayed ?? 0} GP · ${lens} · ${where}`;

  // The clubs you played for, busiest first: each FILTERS the page to its
  // games (Nov 5, elvis), a second click lets go. A long career folds
  // behind "+N more" — 40 chips would bury the stats; on a phone ONE
  // swiping line holds them all, its count in the title (Nov 12).
  const FOLD = matchMedia(SWIPE).matches ? Infinity : 8;
  const picked = clubs.findIndex((c) => c.clubId === state.pclub);
  const shown = state.allClubs || picked >= FOLD ? clubs : clubs.slice(0, FOLD);
  $('pl-clubstitle').hidden = onEa || !clubs.length;
  $('pl-clubstitle').textContent = clubs.length > 1 ? `CLUBS · ${clubs.length}` : 'CLUBS';
  const keptLeft = $('pl-clubs').scrollLeft;
  $('pl-clubs').replaceChildren(...shown.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lb-chip';
    b.title = c.clubId === state.pclub ? 'Back to every club' : `Your games at ${c.name} only`;
    b.setAttribute('aria-pressed', String(c.clubId === state.pclub));
    b.append(c.name);
    const n = document.createElement('small');
    n.textContent = `${c.games} GP`;
    b.append(n);
    b.addEventListener('click', () => {
      state.pclub = state.pclub === c.clubId ? null : c.clubId;
      state.ppage = 1;
      loadPlayer();
    });
    return b;
  }));
  if (clubs.length > FOLD && picked < FOLD) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'lb-chip';
    more.textContent = state.allClubs ? 'Show fewer' : `+${clubs.length - FOLD} more`;
    more.addEventListener('click', () => { state.allClubs = !state.allClubs; drawPlayer(aData); });
    $('pl-clubs').append(more);
  }
  settleSwipe($('pl-clubs'), keptLeft);

  const lenses = aData.lenses ?? {};
  const onLeague = state.pmode.startsWith('lg');
  chips($('pl-modes'), MODES.filter((m) => m.id === 'all' || (lenses[m.id] ?? 0) > 0),
    onLeague ? 'lg' : state.pmode, (id) => {
      if (id === state.pmode || (id === 'lg' && onLeague)) return; // already a League reading
      state.pmode = id;
      state.ppage = 1;
      loadPlayer();
    });
  // The EA chip, last and set apart: EA's logo, a blue of its own.
  if (aData.ea) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lb-chip lb-ea';
    b.title = "EA's own career numbers: every club's public games and your drop-ins, no privates. Shown apart from ours, never mixed in.";
    b.setAttribute('aria-pressed', String(onEa));
    const logo = document.createElement('img');
    logo.src = 'https://cdn.discordapp.com/emojis/1008411424957145139.png?size=32';
    logo.alt = '';
    logo.width = 18;
    logo.height = 18;
    b.append(logo, 'EA');
    b.addEventListener('click', () => {
      if (onEa) return;
      state.pmode = 'ea';
      state.ppage = 1;
      loadPlayer();
    });
    $('pl-modes').append(b);
  }
  // The season pick right after the League chip, before EA (Nov 12, elvis).
  // Put back in the row at every draw: the chips' redraw lets it go.
  const league = [...$('pl-modes').children].find((x) => x.textContent === 'League');
  if (league) league.after(seasonWrap);
  drawPlayerSeasons();

  // The position chips (the tiles AND the game log): the skater slots when
  // you skated in this lens, G when you played in net.
  const offered = [...(playerRoles.skater > 0 ? SKATER_POS : []), ...(playerRoles.goalie > 0 ? ['G'] : [])];
  $('pl-roles').hidden = onEa || !offered.length;
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
    grid.className = 'pl-tiles pl-tiles-more';
    // EA has no rating: its tiles stop before RTG. Then the second tier.
    grid.append(...[...COLUMNS[role.view].filter((c) => !onEa || c.key !== 'rtg'),
      ...TILE_MORE[role.view].filter((c) => c.get(p) != null)].map((c) => {
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
    settleTiles(grid);
  }
}

// My player's second tier (Nov 12, elvis: "more boxes with my totals"):
// after the boards' columns, behind the grid's three-row scroll. A tile
// whose number the line does not carry (EA's light line, EA-only totals
// on ours) is left out, never a dash.
const ofTot = (a, b) => (a == null || b == null ? null : `${a}/${b}`);
const perGp = (v, gp) => (v == null || !(gp > 0) ? null : v / gp);
const clock = (v) => (v == null ? '—' : `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`);
const TILE_MORE = {
  skaters: [
    { key: 'ppg', head: 'PPG', tip: 'Power-play goals', get: (p) => p.ppGoals, fmt: int },
    { key: 'shg', head: 'SHG', tip: 'Short-handed goals', get: (p) => p.shGoals, fmt: int },
    { key: 'gwg', head: 'GWG', tip: 'Game-winning goals', get: (p) => p.gwGoals, fmt: int },
    { key: 'hat', head: 'HAT', tip: 'Hat tricks', get: (p) => p.hatTricks, fmt: int },
    { key: 'gpg', head: 'G/GP', tip: 'Goals per game', get: (p) => perGp(p.goals, p.skaterGames), fmt: fix(2) },
    { key: 'spg', head: 'S/GP', tip: 'Shots per game', get: (p) => perGp(p.shots, p.skaterGames), fmt: fix(1) },
    { key: 'sat', head: 'SAT', tip: 'Shot attempts', get: (p) => p.shotAttempts, fmt: int },
    { key: 'sog', head: 'SOG%', tip: 'Shots on net, of the shot attempts', get: (p) => (p.shotAttempts == null ? null : pct(p.shots, p.shotAttempts)), fmt: fix(1) },
    { key: 'dfl', head: 'DFL', tip: 'Deflections', get: (p) => p.deflections, fmt: int },
    { key: 'pas', head: 'PASSES', tip: 'Completed passes', get: (p) => p.passes, fmt: int },
    { key: 'pa', head: 'PA', tip: 'Pass attempts', get: (p) => p.passAttempts, fmt: int },
    { key: 'sau', head: 'SAU', tip: 'Saucer passes', get: (p) => p.saucerPasses, fmt: int },
    { key: 'hpg', head: 'HIT/GP', tip: 'Hits per game', get: (p) => perGp(p.hits, p.skaterGames), fmt: fix(1) },
    { key: 'fow', head: 'FOW', tip: 'Faceoffs won', get: (p) => p.faceoffWins, fmt: int },
    { key: 'fol', head: 'FOL', tip: 'Faceoffs lost', get: (p) => p.faceoffLosses, fmt: int },
    { key: 'pd', head: 'PD', tip: 'Penalties drawn', get: (p) => p.penaltiesDrawn, fmt: int },
    { key: 'pkc', head: 'PKC', tip: 'Penalty-kill zone clears', get: (p) => p.pkClears, fmt: int },
    { key: 'poss', head: 'POSS/GP', tip: 'Time with the puck, per game', get: (p) => perGp(p.possessionSecs, p.skaterGames), fmt: clock },
    { key: 'toi', head: 'TOI/GP', tip: 'Time on ice, per game', get: (p) => perGp(p.skaterToiSeconds, p.skaterGames), fmt: clock },
    // EA counts these, we do not.
    { key: 'brk', head: 'BRK G', tip: 'Breakaway goals / breakaways (EA)', get: (p) => ofTot(p.breakawayGoals, p.breakaways), fmt: String },
    { key: 'scr', head: 'SCRN G', tip: 'Screen goals / screen chances (EA)', get: (p) => ofTot(p.screenGoals, p.screenChances), fmt: String },
    { key: 'psg', head: 'PS G', tip: 'Penalty shot goals / attempts (EA)', get: (p) => ofTot(p.penaltyShotGoals, p.penaltyShotAttempts), fmt: String },
    { key: 'dek', head: 'DEKES', tip: 'Dekes made (EA)', get: (p) => p.dekesMade, fmt: int },
    { key: 'ofs', head: 'OFFSIDES', tip: 'Offsides (EA)', get: (p) => p.offsides, fmt: int },
    { key: 'fgt', head: 'FIGHTS', tip: 'Fights won / fights (EA)', get: (p) => ofTot(p.fightsWon, p.fights), fmt: String },
  ],
  goalies: [
    { key: 'sapg', head: 'SA/GP', tip: 'Shots faced per game', get: (p) => perGp(p.goalieShotsAgainst, p.goalieGames), fmt: fix(1) },
    { key: 'brk', head: 'BRK', tip: 'Breakaway saves / breakaway shots', get: (p) => ofTot(p.goalieBreakawaySaves, p.goalieBreakawayShots), fmt: String },
    { key: 'brkp', head: 'BRK%', tip: 'Breakaway save percentage', get: (p) => (p.goalieBreakawayShots == null ? null : pct(p.goalieBreakawaySaves, p.goalieBreakawayShots)), fmt: fix(1) },
    { key: 'ps', head: 'PS', tip: 'Penalty shot saves / penalty shots', get: (p) => ofTot(p.goaliePenaltyShotSaves, p.goaliePenaltyShots), fmt: String },
    { key: 'psp', head: 'PS%', tip: 'Penalty shot save percentage', get: (p) => (p.goaliePenaltyShots == null ? null : pct(p.goaliePenaltyShotSaves, p.goaliePenaltyShots)), fmt: fix(1) },
    { key: 'dsv', head: 'DSV', tip: 'Desperation saves', get: (p) => p.goalieDesperationSaves, fmt: int },
    { key: 'pok', head: 'POK', tip: 'Poke checks', get: (p) => p.goaliePokechecks, fmt: int },
    { key: 'ppga', head: 'PPGA', tip: 'Power-play goals against', get: (p) => p.goaliePpGoalsAgainst, fmt: int },
    { key: 'gpkc', head: 'PKC', tip: 'Penalty-kill zone clears', get: (p) => p.goaliePkClears, fmt: int },
    // EA counts this one, we do not.
    { key: 'sos', head: 'SHOOTOUT', tip: 'Shootout saves / shootout shots (EA)', get: (p) => (p.goalieShootoutShots ? ofTot(p.goalieShootoutSaves, p.goalieShootoutShots) : null), fmt: String },
  ],
};

/** The grid's three rows (Nov 12): a fade at the bottom while more waits below. */
function settleTiles(aGrid) {
  const hints = () => {
    aGrid.classList.toggle('scrolls', aGrid.scrollHeight > aGrid.clientHeight + 4);
    aGrid.classList.toggle('more-down', aGrid.scrollTop + aGrid.clientHeight < aGrid.scrollHeight - 4);
  };
  aGrid.scrollTop = 0;
  if (!aGrid.dataset.tiles) { // a grid redrawn in place (My clubs) is wired once
    aGrid.dataset.tiles = '1';
    aGrid.addEventListener('scroll', hints, { passive: true });
    new ResizeObserver(hints).observe(aGrid);
  }
  hints();
}

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const svPct = (g) => (g.shots > 0 ? (g.saves >= g.shots ? '1.000' : (g.saves / g.shots).toFixed(3).slice(1)) : '—');
const pctInt = (v) => (v == null ? '—' : `${v}`);
const mmss = (s) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

/** a out of b as a whole percent, a dash when there was nothing to count. */
const pctOf = (a, b) => (a == null || !(b > 0) ? '—' : `${Math.round((100 * a) / b)}%`);
/** One of EA's per-game grades (0-100), a dash when EA sent none. */
const grade = (v) => (v == null ? '—' : `${v}%`);

// The columns EVERY skater surface shares beyond the post's (Nov 11): the web
// and the app have the room the score post never had, so everything EA hands
// over per game goes in -- the narrow screen scrolls sideways, the name stays.
// Shared by the game log and the game sheet; "total: false" stays out of the
// sheet's TOTALS row (a grade or a ratio does not add up).
const SKATER_MORE = [
  { head: 'PPG', tip: 'Power-play goals', cell: (g) => int(g.ppg) },
  { head: 'SHG', tip: 'Short-handed goals', cell: (g) => int(g.shg) },
  { head: 'GWG', tip: 'Game-winning goals', cell: (g) => int(g.gwg) },
  { head: 'SAT', tip: 'Shot attempts', cell: (g) => int(g.shotAttempts) },
  // Not totalled: the team's shots are EA's club line (bots in), the
  // attempts only the players' -- the ratio would mix the two.
  { head: 'SOG%', tip: 'Shots on net, of the shot attempts', cell: (g) => pctOf(g.shots, g.shotAttempts), total: false },
  { head: 'S%', tip: 'Shooting percentage (goals / shots)', cell: (g) => pctOf(g.goals, g.shots) },
  { head: 'DFL', tip: 'Deflections', cell: (g) => int(g.deflections) },
  { head: 'PA', tip: 'Pass attempts', cell: (g) => int(g.passAttempts) },
  { head: 'SAU', tip: 'Saucer passes', cell: (g) => int(g.saucerPasses) },
  { head: 'FOW', tip: 'Faceoffs won', cell: (g) => int(g.fow) },
  { head: 'FOL', tip: 'Faceoffs lost', cell: (g) => int(g.fol) },
  { head: 'FO%', tip: 'Faceoff percentage', cell: (g) => pctOf(g.fow, (g.fow ?? 0) + (g.fol ?? 0)) },
  { head: 'PD', tip: 'Penalties drawn', cell: (g) => int(g.penaltiesDrawn) },
  { head: 'PKC', tip: 'Penalty-kill zone clears', cell: (g) => int(g.pkClears) },
];
/** EA's own grades for the game, offense / defense / teamplay (0-100). */
const EA_GRADES = [
  { head: 'OFF', tip: 'EA\'s offense grade for the game (0-100)', cell: (g) => grade(g.ratingOffense), total: false },
  { head: 'DEF', tip: 'EA\'s defense grade for the game (0-100)', cell: (g) => grade(g.ratingDefense), total: false },
  { head: 'TEAM', tip: 'EA\'s teamplay grade for the game (0-100)', cell: (g) => grade(g.ratingTeamplay), total: false },
];
const GOALIE_MORE = [
  { head: 'PPGA', tip: 'Power-play goals against', cell: (g) => int(g.ppGoalsAgainst) },
  { head: 'BRK%', tip: 'Breakaway save percentage', cell: (g) => pctOf(g.breakawaySaves, g.breakawayShots) },
  { head: 'PS%', tip: 'Penalty shot save percentage', cell: (g) => pctOf(g.penaltyShotSaves, g.penaltyShots) },
];

// The game log's columns, per role — a game's box-score line ("shots" is the
// skater's shots, or the shots the goalie faced).
const GAME_COLS = {
  skater: [
    { head: 'Pos', tip: 'Position played', cell: (g) => esc(g.position ?? '—') },
    // OUR number up front (Nov 11): with the wide log it sat behind a scroll.
    { head: 'RTG', tip: 'Game rating, the score post\'s number', cell: (g) => int(g.rating) },
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
    ...SKATER_MORE,
    { head: 'TOI', tip: 'Time on ice', cell: (g) => mmss(g.toiSeconds) },
    ...EA_GRADES,
  ],
  goalie: [
    { head: 'RTG', tip: 'Game rating, the score post\'s number', cell: (g) => int(g.rating) },
    { head: 'SV', tip: 'Saves', cell: (g) => int(g.saves), on: true },
    { head: 'SA', tip: 'Shots against', cell: (g) => int(g.shots) },
    { head: 'GA', tip: 'Goals against', cell: (g) => (g.shots == null ? '—' : String(g.shots - g.saves)) },
    { head: 'SV%', tip: 'Save percentage', cell: svPct },
    { head: 'GAA', tip: 'Goals against average', cell: (g) => (g.gaa == null ? '—' : Number(g.gaa).toFixed(2)) },
    { head: 'SO P', tip: 'Shutout periods', cell: (g) => int(g.soPeriods) },
    { head: 'BRK', tip: 'Breakaway saves / breakaway shots', cell: (g) => (g.breakawayShots ? `${g.breakawaySaves}/${g.breakawayShots}` : '—') },
    { head: 'PS', tip: 'Penalty shot saves / penalty shots', cell: (g) => (g.penaltyShots ? `${g.penaltyShotSaves}/${g.penaltyShots}` : '—') },
    ...GOALIE_MORE,
    { head: 'DSV', tip: 'Desperation saves', cell: (g) => int(g.desperationSaves) },
    { head: 'POK', tip: 'Poke checks', cell: (g) => int(g.pokechecks) },
    { head: 'TOI', tip: 'Time on ice', cell: (g) => mmss(g.toiSeconds) },
    ...EA_GRADES,
  ],
};

async function loadGames() {
  const mine = ++gamesRequest;
  $('pl-logstatus').textContent = 'Loading…';
  try {
    const pos = logPos();
    const log = await api(`/me/games?mode=${state.pmode}&pos=${pos === 'G' ? 'G' : pos.join(',')}&page=${state.ppage}${clubParam()}`);
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
    // A league game says League, its league on hover (Nov 12).
    const kind = g.league ? `<span title="${esc(g.league)}">League</span>`
      : g.private ? 'Private' : (g.threes ? '3s' : '6s');
    const res = { W: 'pl-w', L: 'pl-l', OTL: 'pl-otl' }[g.result] ?? '';
    // A game opens its box score (Nov 6): the row, the result a real link.
    const href = g.matchId ? gameHref(g.matchId) : null;
    const result = `${esc(g.result)} ${esc(g.score)}`;
    return `<tr${href ? ` class="pl-game" data-href="${esc(href)}"` : ''}>`
      + `<td class="lb-left">${esc(DATE.format(new Date(g.ts * 1000)))}</td>`
      + `<td class="lb-left lb-dim">${kind}</td><td class="lb-left">${esc(g.club)}</td>`
      + `<td class="lb-left pl-opp" title="${esc(g.opp)}" data-n="${esc(g.opp)}">`
      + `<span class="pl-oppn">${esc(g.opp)}${g.oppRecord ? ` <span class="mc-rec" title="EA record (ranked games)">`
        + `${esc(g.oppRecord)}${g.oppWinPct != null ? ` · ${esc(g.oppWinPct)}%` : ''}</span>` : ''}</span></td>`
      + `<td class="${res}">${href ? `<a class="pl-glink" href="${esc(href)}">${result}</a>` : result}</td>`
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

// A game log row anywhere it is clicked (the result is the keyboard's link).
$('pl-log').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const row = e.target.closest('tr.pl-game');
  if (row) location.href = row.dataset.href;
});

/** A game's page, the lab's API kept on localhost. */
function gameHref(aMatchId) {
  const lab = LOCAL && params.get('api') ? `&api=${encodeURIComponent(params.get('api'))}` : '';
  return `?game=${encodeURIComponent(aMatchId)}${lab}`;
}

// ── One game (Nov 6): the score post's data for the web and the phone ──
// The NHL box score's shape: crests and score up top, then the game sheet,
// a team at a time on a phone, every column of the post, the name stuck left.

const GM_SKATER = [
  { head: 'POS', tip: 'Position', cell: (p) => esc(p.position ?? '—') },
  // OUR number up front (Nov 11): with the wide sheet it sat behind a scroll.
  { head: 'RTG', tip: 'Game rating', cell: (p) => int(p.rating), total: false },
  { head: 'G', tip: 'Goals', cell: (p) => int(p.goals) },
  { head: 'A', tip: 'Assists', cell: (p) => int(p.assists) },
  { head: 'P', tip: 'Points', cell: (p) => int(p.points), on: true },
  { head: '+/-', tip: 'Plus/minus', cell: (p) => signed(p.plusMinus), total: false },
  { head: 'PIM', tip: 'Penalty minutes', cell: (p) => int(p.pim) },
  { head: 'S', tip: 'Shots', cell: (p) => int(p.shots) },
  { head: 'H', tip: 'Hits', cell: (p) => int(p.hits) },
  { head: 'B', tip: 'Blocked shots', cell: (p) => int(p.blocks) },
  { head: 'TK', tip: 'Takeaways', cell: (p) => int(p.takeaways) },
  { head: 'GV', tip: 'Giveaways', cell: (p) => int(p.giveaways) },
  { head: 'PAS', tip: 'Passes completed', cell: (p) => int(p.passes) },
  { head: 'P%', tip: 'Pass completion', cell: (p) => (p.passPct == null ? '—' : `${p.passPct}%`) },
  { head: 'TOP', tip: 'Time on puck', cell: (p) => mmss(p.possessionSecs) },
  ...SKATER_MORE,
  { head: 'TOI', tip: 'Time on ice', cell: (p) => mmss(p.toiSeconds), total: false },
  ...EA_GRADES,
];
const GM_GOALIE = [
  { head: 'RTG', tip: 'Game rating', cell: (g) => int(g.rating) },
  { head: 'SV%', tip: 'Save percentage', cell: (g) => (g.savePct == null ? '—' : `${g.savePct}%`), on: true },
  { head: 'GAA', tip: 'Goals against average', cell: (g) => (g.gaa == null ? '—' : Number(g.gaa).toFixed(2)) },
  { head: 'SV', tip: 'Saves', cell: (g) => int(g.saves) },
  { head: 'SA', tip: 'Shots against', cell: (g) => int(g.shots) },
  { head: 'GA', tip: 'Goals against', cell: (g) => int(g.ga) },
  { head: 'BRK', tip: 'Breakaway saves / shots', cell: (g) => `${g.breakawaySaves ?? 0}/${g.breakawayShots ?? 0}` },
  { head: 'PS', tip: 'Penalty shot saves / shots', cell: (g) => `${g.penaltyShotSaves ?? 0}/${g.penaltyShots ?? 0}` },
  ...GOALIE_MORE,
  { head: 'DSV', tip: 'Desperation saves', cell: (g) => int(g.desperationSaves) },
  { head: 'SOP', tip: 'Shutout periods', cell: (g) => int(g.soPeriods) },
  { head: 'POK', tip: 'Poke checks', cell: (g) => int(g.pokechecks) },
  { head: 'TOI', tip: 'Time on ice', cell: (g) => mmss(g.toiSeconds) },
  ...EA_GRADES,
];
const GM_WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const RES = { Win: ['WIN', 'w'], Loss: ['LOSS', 'l'], 'OT Loss': ['OT LOSS', 'o'] };

/** A club's crest, or its initials on a disc. */
function gmLogo(aClub) {
  if (aClub.logo) return `<img class="gm-logo" src="${esc(aClub.logo)}" alt="">`;
  const init = String(aClub.name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('');
  return `<span class="gm-init" aria-hidden="true">${esc(init.toUpperCase())}</span>`;
}

function gmTeam(aClub) {
  const [label, cls] = RES[aClub.result] ?? [String(aClub.result ?? '').toUpperCase(), ''];
  return `<div class="gm-team">${gmLogo(aClub)}<span class="gm-name">${esc(aClub.name)}</span>`
    + (aClub.record ? `<span class="gm-rec" title="EA record (ranked games)">${esc(aClub.record)}`
      + (aClub.winPct != null ? ` · ${int(aClub.winPct)}%` : '') + '</span>' : '')
    + `<span class="gm-sog">SOG ${int(aClub.totals?.shots)}</span>`
    + `<span class="gm-res ${cls}">${esc(label)}</span></div>`;
}

/** One club's sheet: its skaters, its totals, its goalie(s). */
function gmSheet(aClub, aMe) {
  const lower = (aMe ?? '').toLowerCase();
  const mine = (p) => (lower && String(p.name).toLowerCase() === lower ? ' class="lb-me"' : '');
  const pp = aClub.ppo != null ? ` · PP ${aClub.ppg ?? 0}/${aClub.ppo}` : '';
  const head = (aFirst, aCols) => `<thead><tr><th class="lb-name">${aFirst}</th>`
    + aCols.map((c) => `<th title="${esc(c.tip)}">${esc(c.head)}</th>`).join('') + '</tr></thead>';
  const row = (p, aCols) => `<tr${mine(p)}><td class="lb-name">${esc(p.name)}</td>`
    + aCols.map((c) => `<td${c.on ? ' class="lb-on"' : ''}>${c.cell(p)}</td>`).join('') + '</tr>';
  const t = aClub.totals;
  const foot = t ? `<tfoot><tr><td class="lb-name">TOTALS</td>${GM_SKATER.map((c) => `<td>${
    c.head === 'POS' || c.total === false ? '' : c.cell(t)}</td>`).join('')}</tr></tfoot>` : '';
  const [, cls] = RES[aClub.result] ?? ['', ''];
  return `<div class="gm-sheettop"><h4 class="${cls}">${esc(aClub.name)}</h4>`
    + `<span>TOA ${mmss(aClub.toa)}${pp}</span></div>`
    + `<div class="lb-scroll"><table class="lb-table">${head('Player', GM_SKATER)}`
    + `<tbody>${(aClub.skaters ?? []).map((p) => row(p, GM_SKATER)).join('')}</tbody>${foot}</table></div>`
    + ((aClub.goalies ?? []).length
      ? `<div class="lb-scroll"><table class="lb-table">${head('Goalie', GM_GOALIE)}`
        + `<tbody>${aClub.goalies.map((g) => row(g, GM_GOALIE)).join('')}</tbody></table></div>`
      : '');
}

/** The all-time line, from whoever leads (the post's wording). */
function gmH2h(aGame) {
  const h = aGame.h2h;
  const [away, home] = aGame.clubs;
  if (!h || !(h.games >= 2)) return '';
  const tail = h.t > 0 ? `-${h.t}` : '';
  if (h.w === h.l) return `even ${h.w}-${h.l}${tail} all-time`;
  return h.w > h.l ? `${away.name} ${h.w}-${h.l}${tail} all-time` : `${home.name} ${h.l}-${h.w}${tail} all-time`;
}

async function loadGame(aMatchId, aMe) {
  document.querySelector('.lb-head').hidden = true;
  // Back where we came from when it is this site; else My games.
  const back = $('gm-back');
  if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) {
    back.textContent = '‹ Back';
    back.addEventListener('click', (e) => { e.preventDefault(); history.back(); });
  } else {
    back.href = `/myplayer/${LOCAL && params.get('api') ? `?api=${encodeURIComponent(params.get('api'))}` : ''}`;
  }
  $('gm-status').textContent = 'Loading…';
  let game;
  try {
    game = await api(`/game/${encodeURIComponent(aMatchId)}`);
  } catch (anErr) {
    if (anErr instanceof SignedOut) { show('gate'); return; }
    $('gm-status').textContent = String(anErr.message).includes('404')
      ? 'We don\'t have that game.' : 'The game can\'t be reached right now — try again in a few minutes.';
    return;
  }
  const clubs = game.clubs ?? [];
  if (clubs.length !== 2) { $('gm-status').textContent = 'We don\'t have that game.'; return; }
  $('gm-status').textContent = '';
  $('gm-body').hidden = false;
  const [a, b] = clubs;
  const ga = a.totals?.goals ?? 0;
  const gb = b.totals?.goals ?? 0;
  document.title = `${a.name} ${ga}–${gb} ${b.name} — Elvi's Team Tracker`;
  $('gm-title').textContent = `${a.name} ${ga}, ${b.name} ${gb}`;
  $('gm-head').innerHTML = gmTeam(a)
    + `<div class="gm-mid"><div class="gm-score"><span class="gm-goals${ga < gb ? ' lost' : ''}">${ga}</span>`
    + `<span class="gm-final">${game.overtime ? 'FINAL/OT' : 'FINAL'}</span>`
    + `<span class="gm-goals${gb < ga ? ' lost' : ''}">${gb}</span></div>`
    + `<span class="gm-when">${esc(game.type)}<br>${esc(GM_WHEN.format(new Date(game.ts * 1000)))}</span></div>`
    + gmTeam(b);
  const h2h = gmH2h(game);
  $('gm-stars').innerHTML = (game.stars ?? []).map((s, i) =>
    `<span class="s${i + 1}">★ ${esc(s.name)} (${esc(s.detail)})</span>`).join('');
  if (h2h) $('gm-stars').insertAdjacentHTML('afterend', `<p class="gm-h2h">${esc(h2h)}</p>`);
  // A team at a time on a phone: yours first when you played.
  const lower = (aMe ?? '').toLowerCase();
  const playedFor = clubs.findIndex((c) => [...(c.skaters ?? []), ...(c.goalies ?? [])]
    .some((p) => lower && String(p.name).toLowerCase() === lower));
  let on = playedFor >= 0 ? playedFor : 0;
  $('gm-sheets').innerHTML = clubs.map((c, i) =>
    `<section class="gm-sheet" id="gm-sheet-${i}" role="tabpanel">${gmSheet(c, aMe)}</section>`).join('');
  const pick = (i) => {
    on = i;
    // A class, not [hidden]: the site's sheet makes [hidden] !important, and
    // a wide screen shows both teams.
    clubs.forEach((_, j) => { $(`gm-sheet-${j}`).classList.toggle('off', j !== i); });
    for (const btn of $('gm-toggle').children) btn.setAttribute('aria-selected', String(Number(btn.dataset.i) === i));
  };
  $('gm-toggle').replaceChildren(...clubs.map((c, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.dataset.i = String(i);
    btn.textContent = c.name;
    btn.addEventListener('click', () => pick(i));
    return btn;
  }));
  pick(on);
  loadNotes(aMatchId);
}

// ── Post-game notes (Nov 13) ────────────────────────────────────────────
// What won or lost a game, for the next time we meet that opponent: the
// same notes as the score post's 📝. The server answers the reader's own
// side only, and the section stays hidden for anyone off both rosters.
const GM_NOTE_WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function gmNotesHtml(aNotes) {
  if (!aNotes.length) {
    return '<p class="gm-note-empty">No notes yet. What won or lost this one? '
      + 'Your team reads it the next time you play them.</p>';
  }
  return aNotes.map((n) => `<article class="gm-note"><p>${esc(n.body)}</p>`
    + `<footer>${esc(n.userName ?? '?')} · ${esc(GM_NOTE_WHEN.format(new Date(n.createdAt * 1000)))}</footer>`
    + '</article>').join('');
}

function drawNotes(aNotes) {
  const club = aNotes.clubs?.[0]?.name;
  $('gm-notes-who').textContent = club ? `${club} only` : 'Your team only';
  $('gm-notes-list').innerHTML = gmNotesHtml(aNotes.notes ?? []);
}

async function loadNotes(aMatchId) {
  let notes;
  try {
    notes = await api(`/game/${encodeURIComponent(aMatchId)}/notes`);
  } catch {
    return; // notes are a bonus: the game page stands without them
  }
  if (!notes.allowed) return;
  drawNotes(notes);
  $('gm-notes').hidden = false;
  const form = $('gm-note-form');
  const text = $('gm-note-text');
  const status = $('gm-note-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = text.value.trim();
    if (!body) { status.textContent = 'Write something first.'; return; }
    $('gm-note-send').disabled = true;
    status.textContent = 'Saving…';
    try {
      const r = await fetch(`${API}/game/${encodeURIComponent(aMatchId)}/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-ETT': '1' },
        body: JSON.stringify({ body }),
      });
      const answer = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(answer.error ?? `HTTP ${r.status}`);
      drawNotes(answer);
      text.value = '';
      status.textContent = 'Saved.';
    } catch (anErr) {
      status.textContent = `Not saved: ${anErr.message}`;
    } finally {
      $('gm-note-send').disabled = false;
    }
  });
}

// ── My clubs (Nov 12, elvis) ────────────────────────────────────────────
// Every game of a club you played for this season -- yours or not -- the
// club as a chip (your busiest first), a lens, 20 games a page; a row opens
// the game's page. "You" says where you played, a dash when you sat out.
let clubGamesRequest = 0;
let showAllMyClubs = false;
/** A phone: the clubs on one swiping line (leaderboards.css, same query). */
const SWIPE = '(max-width: 700px)';
// Crossing it redraws (Nov 12, elvis: a narrow window widened kept the
// swiping line's every club, 49 chips wrapped) -- the fold is the draw's.
matchMedia(SWIPE).addEventListener('change', () => {
  if (state.board === 'myclubs' && lastClubData) drawClubGames(lastClubData);
  else if (state.board === 'me' && lastPlayer) drawPlayer(lastPlayer);
});

/**
 * A redrawn swiping line (My clubs, My player): it stays where the thumb
 * left it, the picked chip is brought into sight only when it is not, and
 * its edges fade where there is more to swipe to.
 *
 * @param aRow the line
 * @param aKeptLeft its scroll before the redraw
 */
function settleSwipe(aRow, aKeptLeft) {
  if (!matchMedia(SWIPE).matches) { aRow.classList.remove('more-left', 'more-right'); return; }
  aRow.scrollLeft = aKeptLeft;
  const on = aRow.querySelector('[aria-pressed="true"]');
  if (on) {
    const x = on.offsetLeft - aRow.offsetLeft;
    if (x < aRow.scrollLeft || x + on.offsetWidth > aRow.scrollLeft + aRow.clientWidth) {
      aRow.scrollLeft = Math.max(0, x - 16);
    }
  }
  const hints = () => {
    aRow.classList.toggle('more-left', aRow.scrollLeft > 4);
    aRow.classList.toggle('more-right', aRow.scrollLeft + aRow.clientWidth < aRow.scrollWidth - 4);
  };
  if (!aRow.dataset.swipe) {
    aRow.dataset.swipe = '1';
    aRow.addEventListener('scroll', hints, { passive: true });
    window.addEventListener('resize', hints);
  }
  hints();
}

async function loadClubGames() {
  saveUrl();
  const mine = ++clubGamesRequest;
  $('mc-logstatus').textContent = 'Loading…';
  try {
    const data = await api(`/me/clubgames?mode=${state.cmode}&page=${state.cpage}`
      + (state.cclub ? `&club=${state.cclub}` : ''));
    if (mine !== clubGamesRequest || state.board !== 'myclubs') return;
    // Tracking a club counts on YOUR card: a gamertag first.
    $('mc-track-open').hidden = !data.linked;
    if (!data.linked) $('mc-track').hidden = true;
    if (!data.linked) {
      drawCrest($('mc-crest'), null, null);
      drawClubTiles(null);
      $('mc-sub').textContent = 'Link your gamertag on the home page to see your clubs here.';
      for (const id of ['mc-clubs', 'mc-modes', 'mc-log']) $(id).replaceChildren();
      $('mc-logstatus').textContent = '';
      $('mc-pager').hidden = true;
      return;
    }
    // A lens the club never played (an old link): All games.
    if (state.cmode !== 'all' && !(data.lenses?.[state.cmode] > 0)) {
      state.cmode = 'all';
      state.cpage = 1;
      loadClubGames();
      return;
    }
    state.cclub = data.club ?? null;
    state.cpage = data.page ?? 1;
    saveUrl();
    drawClubGames(data);
    // A scouted club holds the page (a link, Back): its own load draws it.
    if (state.cscout) loadScout(state.cscout);
  } catch (anErr) {
    if (mine !== clubGamesRequest) return;
    if (anErr instanceof SignedOut) { show('gate'); return; }
    $('mc-logstatus').textContent = 'Your clubs\' games are unavailable right now — try again in a few minutes.';
  }
}

/** An opponent's cell: its name, then its EA record when we have it (Nov 12). */
function oppCell(g) {
  const rec = g.oppRecord
    ? ` <span class="mc-rec" title="EA record (ranked games)">${esc(g.oppRecord)}`
      + `${g.oppWinPct != null ? ` · ${esc(g.oppWinPct)}%` : ''}</span>` : '';
  return `<td class="lb-left" title="${esc(g.opp ?? '')}">${esc(g.opp ?? '?')}${rec}</td>`;
}

/** A crest in its slot: the club's logo, or its initials on a disc. */
function drawCrest(aSlot, aLogo, aName) {
  aSlot.replaceChildren();
  aSlot.hidden = !aName;
  if (!aName) return;
  if (aLogo) {
    const img = document.createElement('img');
    img.src = aLogo;
    img.alt = '';
    aSlot.append(img);
  } else {
    aSlot.textContent = String(aName).split(/\s+/).filter(Boolean).slice(0, 2)
      .map((w) => w[0]).join('').toUpperCase();
  }
}

/** Tiles: [value, label, tip, cls] -- My player's look. */
function tiles(aEl, aItems) {
  aEl.replaceChildren(...aItems.map(([v, k, tip, cls]) => {
    const t = document.createElement('div');
    t.className = `pl-tile${cls ? ` ${cls}` : ''}`;
    if (tip) t.title = tip;
    const b = document.createElement('b');
    b.textContent = v;
    const s = document.createElement('span');
    s.textContent = k;
    t.append(b, s);
    return t;
  }));
}

/** The club's numbers in the lens (Nov 12, elvis: put them forward). */
function drawClubTiles(aData) {
  const el = $('mc-tiles');
  el.hidden = !aData;
  if (!aData) return;
  const r = aData.record ?? {};
  const gp = aData.games ?? 0;
  const decided = (r.w ?? 0) + (r.l ?? 0) + (r.otl ?? 0);
  const f = aData.last10 ?? {};
  const streak = aData.streak;
  tiles(el, [
    [String(gp), 'GP', 'Games this season, in this lens'],
    [`${r.w ?? 0}-${r.l ?? 0}-${r.otl ?? 0}`, 'W-L-OTL', 'Record', 'mc-wide'],
    [decided ? `${Math.round((100 * (r.w ?? 0)) / decided)}%` : '—', 'WIN %', 'Wins, of the games decided'],
    [gp ? (aData.gf / gp).toFixed(2) : '—', 'GF / GP', 'Goals for per game'],
    [gp ? (aData.ga / gp).toFixed(2) : '—', 'GA / GP', 'Goals against per game'],
    [gp ? signed(aData.gf - aData.ga) : '—', 'DIFF', 'Goal differential'],
    [`${f.w ?? 0}-${f.l ?? 0}-${f.otl ?? 0}`, 'LAST 10', 'The last ten games, W-L-OTL'],
    [streak ?? '—', 'STREAK', 'The current run', streak?.startsWith('W') ? 'mc-hot' : streak ? 'mc-cold' : ''],
    ...clubMore(aData.more),
  ]);
  // Three rows, the rest behind the scroll (Nov 12, as on My player).
  el.classList.toggle('pl-tiles-more', !!aData.more);
  if (aData.more) settleTiles(el);
}

/** The club's second tier (Nov 12, elvis: more boxes on My clubs too). */
function clubMore(m) {
  if (!m) return [];
  const per = (v, n, d = 1) => (n > 0 && v != null ? (v / n).toFixed(d) : '—');
  const pc = (a, b) => (b > 0 && a != null ? ((100 * a) / b).toFixed(1) : '—');
  const pg = m.playerGames;
  return [
    [per(m.sf, m.shotGames), 'SF / GP', 'Shots for per game (the club line, bots in)'],
    [per(m.sa, m.shotGames), 'SA / GP', 'Shots against per game'],
    [pc(m.shotGf, m.sf), 'SH%', 'Shooting percentage: goals, of the shots'],
    [m.sa > 0 ? (100 - (100 * m.shotGa) / m.sa).toFixed(1) : '—', 'SV%', 'Save percentage: shots against stopped'],
    [pc(m.ppg, m.ppo), 'PP%', `Power play: ${m.ppg ?? 0} goals on ${m.ppo ?? 0} chances`],
    [m.pko > 0 ? (100 - (100 * m.ppga) / m.pko).toFixed(1) : '—', 'PK%', `Penalty kill: ${m.ppga ?? 0} goals against on ${m.pko ?? 0} short-handed`],
    [String(m.ppg ?? 0), 'PPG', 'Power-play goals'],
    [String(m.shutouts ?? 0), 'SO', 'Shutouts: games with nothing against'],
    [String(m.blanked ?? 0), 'BLANKED', 'Games without a goal'],
    [`${m.oneGoalW ?? 0}-${m.oneGoalL ?? 0}`, '1-GOAL', 'Record in one-goal games, OT losses in the L'],
    [m.toaGames > 0 ? clock(m.toa / m.toaGames) : '—', 'TOA / GP', 'Time on attack per game'],
    [pc(m.passes, m.passAttempts), 'PASS%', 'Pass completion (the club line)'],
    [per(m.hits, pg), 'HIT / GP', 'Hits per game'],
    [per(m.shotAttempts, pg), 'SAT / GP', 'Shot attempts per game (the players)'],
    [per(m.blocks, pg), 'BLK / GP', 'Blocked shots per game'],
    [per(m.takeaways, pg), 'TK / GP', 'Takeaways per game (interceptions included)'],
    [per(m.giveaways, pg), 'GV / GP', 'Giveaways per game'],
    [pc(m.fow, (m.fow ?? 0) + (m.fol ?? 0)), 'FO%', 'Faceoffs won'],
    [per(m.pim, pg), 'PIM / GP', 'Penalty minutes per game'],
  ];
}

let lastClubData = null; // the last /me/clubgames answer drawn

function drawClubGames(aData) {
  lastClubData = aData;
  const clubs = aData.clubs ?? [];
  // Scouting holds the page (Nov 12, elvis): none of your clubs is picked.
  // cscout 0 = the search is open and nothing is picked yet -- an empty
  // page, just the search; a club id = that club's (drawScout).
  const scouting = state.cscout !== null;
  const club = scouting ? null : clubs.find((c) => c.clubId === aData.club);
  $('mc-scoutmore').hidden = !state.cscout;
  $('mc-track').hidden = state.cscout !== 0;
  $('mc-games').hidden = state.cscout === 0;
  $('mc-track-open').setAttribute('aria-expanded', String(state.cscout === 0));
  if (state.cscout === 0) {
    ++scoutRequest;
    $('mc-scoutfoot').replaceChildren();
    drawCrest($('mc-crest'), null, null);
    drawClubTiles(null);
    $('mc-name').textContent = 'Scout or track a club';
    document.title = 'Scout — Elvi\'s Team Tracker';
    $('mc-sub').textContent = 'Any club, tracked or not: its record, its last games and who dresses. '
      + 'Looking tracks nothing.';
  }
  if (!scouting) {
    ++scoutRequest; // a scout still on its way is dropped
    $('mc-scoutfoot').replaceChildren();
    $('mc-name').textContent = club ? club.name : 'My clubs';
    document.title = `${club ? `${club.name} · ` : ''}My clubs — Elvi's Team Tracker`;
    $('mc-gamestitle').textContent = 'Games';
  }
  const lens = MODES.find((m) => m.id === state.cmode)?.label ?? 'All games';
  if (!scouting) {
    $('mc-sub').textContent = club ? `This season · ${lens} · you: ${club.games} GP`
      : 'No club yet — your clubs show up here once we have a game of yours.';
    drawCrest($('mc-crest'), aData.logo, club?.name);
    drawClubTiles(club ? aData : null);
  }

  // The clubs, busiest first, folded behind "+N more" like My player's --
  // but on a phone ONE swiping line holds them all (leaderboards.css).
  const swipe = matchMedia(SWIPE).matches;
  const FOLD = swipe ? Infinity : 8;
  const picked = clubs.findIndex((c) => c.clubId === aData.club);
  const shown = showAllMyClubs || picked >= FOLD ? clubs : clubs.slice(0, FOLD);
  $('mc-clubs').hidden = clubs.length < 2;
  const keptLeft = $('mc-clubs').scrollLeft;
  $('mc-clubs').replaceChildren(...shown.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lb-chip';
    b.title = `Every game of ${c.name} this season`;
    b.setAttribute('aria-pressed', String(!scouting && c.clubId === aData.club));
    b.append(c.name);
    const n = document.createElement('small');
    n.textContent = `${c.games} GP`;
    b.append(n);
    b.addEventListener('click', () => {
      if (c.clubId === state.cclub && !state.cscout) return;
      state.cscout = null; // back to your clubs
      state.cclub = c.clubId;
      state.cmode = 'all';
      state.cpage = 1;
      loadClubGames();
    });
    return b;
  }));
  if (clubs.length > FOLD && picked < FOLD) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'lb-chip';
    more.textContent = showAllMyClubs ? 'Show fewer' : `+${clubs.length - FOLD} more`;
    more.addEventListener('click', () => { showAllMyClubs = !showAllMyClubs; drawClubGames(aData); });
    $('mc-clubs').append(more);
  }
  settleSwipe($('mc-clubs'), keptLeft);

  const lenses = aData.lenses ?? {};
  $('mc-modes').hidden = !club;
  if (scouting) return; // the scout draws the rest
  chips($('mc-modes'), MODES.filter((m) => m.id === 'all' || (lenses[m.id] ?? 0) > 0), state.cmode, (id) => {
    if (id === state.cmode) return;
    state.cmode = id;
    state.cpage = 1;
    loadClubGames();
  });

  const rows = aData.rows ?? [];
  $('mc-logstatus').textContent = club && !rows.length ? `No games here yet · ${lens}` : '';
  if (!rows.length) {
    $('mc-log').replaceChildren();
    $('mc-pager').hidden = true;
    return;
  }
  // The result right after the date: on a phone it is what fits first.
  const head = '<thead><tr><th class="lb-left">Date</th><th>Result</th>'
    + '<th class="lb-left">Opponent</th>'
    + '<th title="Shots on goal, for - against">SOG</th>'
    + '<th title="Where you played, a dash when you sat out">You</th>'
    + '<th class="lb-left">Game</th></tr></thead>';
  const body = rows.map((g) => {
    // A league game says League, its league on hover (Nov 12).
    const kind = g.league ? `<span title="${esc(g.league)}">League</span>`
      : g.private ? 'Private' : (g.threes ? '3s' : '6s');
    const res = { W: 'pl-w', L: 'pl-l', OTL: 'pl-otl' }[g.result] ?? '';
    const href = g.matchId ? gameHref(g.matchId) : null;
    const result = `${esc(g.result)} ${esc(g.score)}`;
    const sog = g.sf == null && g.sa == null ? '—' : `${int(g.sf)}-${int(g.sa)}`;
    return `<tr${href ? ` class="pl-game" data-href="${esc(href)}"` : ''}>`
      + `<td class="lb-left">${esc(DATE.format(new Date(g.ts * 1000)))}</td>`
      + `<td class="${res}">${href ? `<a class="pl-glink" href="${esc(href)}">${result}</a>` : result}</td>`
      + oppCell(g)
      + `<td>${sog}</td>`
      + `<td${g.you ? ' class="lb-on"' : ' class="lb-dim"'}>${g.you ? esc(g.you) : '—'}</td>`
      + `<td class="lb-left lb-dim">${kind}</td></tr>`;
  }).join('');
  $('mc-log').innerHTML = head + `<tbody>${body}</tbody>`;
  const pages = aData.pages ?? 1;
  $('mc-pager').hidden = pages <= 1;
  $('mc-page').textContent = `Page ${aData.page} / ${pages}`;
  $('mc-prev').disabled = aData.page <= 1;
  $('mc-next').disabled = aData.page >= pages;
}

// Track an EA club (Nov 12, elvis): the home page's search, here too --
// quiet, a link that opens it in place. Same API (/me/clubsearch, then
// /me/trackclub): the club is followed, posted nowhere.
// The button empties the page into the search at once (Nov 12, elvis: no
// Frosty Furballs left under it); a second click goes back to your club.
$('mc-track-open').addEventListener('click', () => {
  if (state.cscout === 0) {
    state.cscout = null;
  } else {
    state.cscout = 0;
    $('mc-track-msg').textContent = '';
    $('mc-track-hits').replaceChildren();
  }
  saveUrl();
  if (lastClubData) drawClubGames(lastClubData);
  if (state.cscout === 0) $('mc-track-q').focus();
});
$('mc-track-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('mc-track-q').value.trim();
  if (!name) return;
  const msg = $('mc-track-msg');
  const hits = $('mc-track-hits');
  const tell = (aText) => { msg.textContent = aText; };
  hits.replaceChildren();
  tell('Searching EA…');
  let clubs;
  try {
    clubs = await searchClub(name);
  } catch (anErr) {
    tell(anErr.message || 'The search didn\'t work — try again in a minute.');
    return;
  }
  if (!clubs.length) { tell(`No club found starting with "${name}".`); return; }
  tell(clubs.length === 1 ? 'This one?' : 'Pick the club:');
  hits.replaceChildren(...clubs.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lb-chip';
    b.append(c.name ?? `Club ${c.clubId}`);
    if (c.division) {
      const d = document.createElement('small');
      d.textContent = ` Div ${c.division}`;
      b.append(d);
    }
    b.addEventListener('click', () => {
      for (const x of hits.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      // The club takes the page over; the search folds away. One of YOUR
      // clubs opens as itself (its lenses, your games), not as a scout.
      $('mc-track').hidden = true;
      $('mc-track-open').setAttribute('aria-expanded', 'false');
      const id = Number(c.clubId);
      if ((lastClubData?.clubs ?? []).some((x) => x.clubId === id)) {
        state.cscout = null;
        state.cclub = id;
        state.cmode = 'all';
        state.cpage = 1;
        loadClubGames();
      } else {
        state.cscout = id;
        saveUrl();
        if (lastClubData) drawClubGames(lastClubData);
        loadScout(c.clubId, c.name);
      }
      $('clubsui').scrollIntoView({ block: 'start' });
    });
    return b;
  }));
  // One hit: straight to its card.
  if (clubs.length === 1) hits.firstChild.click();
});

// ── Scout a club (Nov 12, elvis) ────────────────────────────────────────
// "Je matche contre le club ABC, j'ouvre l'app pour voir s'ils sont bons, et
// APRÈS j'ai l'option Track it." The card: crest, EA's division and record,
// the last games, who dresses -- and Track it at the bottom.
const EA_POS = { center: 'C', leftWing: 'LW', rightWing: 'RW', defenseMen: 'D', leftDefense: 'LD',
  rightDefense: 'RD', goalie: 'G' };
const EA_TYPE = { gameType5: '6s', gameType10: '6s', club_private: 'Private', gameType200: '3s',
  gameType206: '3s' };
let scoutRequest = 0;

async function loadScout(aClubId, aName) {
  const mine = ++scoutRequest;
  // The page empties into the scout's while EA answers.
  $('mc-name').textContent = aName ?? 'Scouting…';
  drawCrest($('mc-crest'), null, aName);
  $('mc-sub').textContent = 'A club we don\'t follow is read live from EA…';
  $('mc-tiles').replaceChildren();
  for (const id of ['mc-log', 'mc-roster', 'mc-scoutfoot']) $(id).replaceChildren();
  $('mc-pager').hidden = true;
  $('mc-gamestitle').textContent = 'Last games';
  $('mc-logstatus').textContent = 'Loading…';
  let s;
  try {
    s = await api(`/me/clubscout?club=${encodeURIComponent(aClubId)}`);
  } catch (anErr) {
    if (mine !== scoutRequest) return;
    if (anErr instanceof SignedOut) { show('gate'); return; }
    $('mc-logstatus').textContent = String(anErr.message).includes('429')
      ? 'One moment — try again in a few seconds.'
      : 'That club can\'t be reached right now — try again in a minute.';
    return;
  }
  if (mine !== scoutRequest || !state.cscout) return;
  drawScout(s);
}

/** A scouted club, drawn into My clubs' own slots (Nov 12, elvis). */
function drawScout(aS) {
  const name = aS.name ?? `Club ${aS.clubId}`;
  $('mc-name').textContent = name;
  document.title = `${name} · Scout — Elvi's Team Tracker`;
  drawCrest($('mc-crest'), aS.logo, name);
  $('mc-sub').textContent = [aS.division ? `Division ${aS.division}` : null,
    aS.tracked ? 'tracked — its games are in our books' : 'not tracked — read live from EA'].filter(Boolean).join(' · ');
  $('mc-tiles').hidden = false;
  $('mc-games').hidden = false;
  $('mc-gamestitle').textContent = 'Last games';
  $('mc-pager').hidden = true;
  $('mc-scoutmore').hidden = false;

  // EA's record, and the form of the games shown.
  const m = /^(\d+)-(\d+)-(\d+)/.exec(aS.record ?? '');
  const games = aS.games ?? [];
  const form = { W: 0, L: 0, OTL: 0 };
  let gf = 0;
  let ga = 0;
  for (const g of games) {
    form[g.result] = (form[g.result] ?? 0) + 1;
    const [a, b] = String(g.score).split('-').map(Number);
    gf += a || 0;
    ga += b || 0;
  }
  const ew = m ? Number(m[1]) : null;
  const eAll = m ? Number(m[1]) + Number(m[2]) + Number(m[3]) : 0;
  tiles($('mc-tiles'), [
    [m ? `${m[1]}-${m[2]}-${m[3]}` : '—', 'EA RECORD', 'EA\'s own record (ranked games), W-L-OTL', 'mc-wide'],
    [eAll ? `${Math.round((100 * ew) / eAll)}%` : '—', 'WIN %', 'Of EA\'s record'],
    [games.length ? `${form.W}-${form.L}-${form.OTL}` : '—', `LAST ${games.length || ''}`.trim(), 'The games below, W-L-OTL'],
    [games.length ? (gf / games.length).toFixed(1) : '—', 'GF / GP', 'Goals for per game, the games below'],
    [games.length ? (ga / games.length).toFixed(1) : '—', 'GA / GP', 'Goals against per game, the games below'],
  ]);

  // The last games, in the games' own table.
  $('mc-logstatus').textContent = games.length ? '' : 'No recent game from EA for this club.';
  $('mc-log').innerHTML = !games.length ? ''
    : '<thead><tr><th class="lb-left">Date</th><th>Result</th>'
      + '<th class="lb-left">Opponent</th><th class="lb-left">Game</th></tr></thead><tbody>'
      + games.map((g) => {
        const res = { W: 'pl-w', L: 'pl-l', OTL: 'pl-otl' }[g.result] ?? '';
        const href = g.matchId ? gameHref(g.matchId) : null;
        const result = `${esc(g.result)} ${esc(g.score)}${g.dnf ? ' <span class="lb-dim">DNF</span>' : ''}`;
        return `<tr${href ? ` class="pl-game" data-href="${esc(href)}"` : ''}>`
          + `<td class="lb-left">${esc(DATE.format(new Date(g.ts * 1000)))}</td>`
          + `<td class="${res}">${href ? `<a class="pl-glink" href="${esc(href)}">${result}</a>` : result}</td>`
          + oppCell(g)
          + `<td class="lb-left lb-dim">${esc(EA_TYPE[g.type] ?? g.type ?? '')}</td></tr>`;
      }).join('') + '</tbody>';

  // Who dresses, from those games.
  const roster = aS.roster ?? [];
  $('mc-roster').closest('.lb-scroll').hidden = !roster.length;
  $('mc-scoutmore').querySelector('.pl-loghead').hidden = !roster.length;
  $('mc-roster').innerHTML = !roster.length ? ''
    : '<thead><tr><th class="lb-left">Player</th><th>Pos</th>'
      + '<th title="Games, of the ones above">GP</th><th>G</th><th>A</th><th>P</th>'
      + '<th title="Save percentage, in net">SV%</th></tr></thead><tbody>'
      + roster.map((p) => {
        const goalie = p.pos === 'goalie';
        return `<tr><td class="lb-left lb-name">${esc(p.name)}</td><td>${esc(EA_POS[p.pos] ?? p.pos ?? '')}</td>`
          + `<td>${int(p.games)}</td><td>${int(p.g)}</td><td>${int(p.a)}</td>`
          + `<td class="lb-on">${int((p.g ?? 0) + (p.a ?? 0))}</td>`
          + `<td>${goalie && p.shots ? `${((100 * p.sv) / p.shots).toFixed(1)}%` : '—'}</td></tr>`;
      }).join('') + '</tbody>';

  // Track it, in the head right under the club's line (Nov 12, elvis) --
  // a tracked club says so in that line already.
  const foot = $('mc-scoutfoot');
  foot.replaceChildren();
  const note = document.createElement('span');
  note.className = 'lb-status';
  if (!aS.tracked) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lb-chip mc-trackit';
    btn.textContent = '＋ Track it';
    btn.title = 'Its games count on your card from then on. Nothing gets posted anywhere.';
    note.textContent = 'Nothing gets posted anywhere.';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      note.textContent = 'One moment…';
      try {
        const r = await trackClub(aS.clubId, aS.name);
        btn.remove();
        note.textContent = r.outcome === 'already'
          ? `${name} is already tracked — its newest games are being pulled now.`
          : `Done — ${name} is tracked now. Its games show up within a few minutes.`;
      } catch (anErr) {
        btn.disabled = false;
        note.textContent = anErr.message || 'Couldn\'t do that right now — try again in a minute.';
      }
    });
    foot.append(btn, note);
  }
}

$('mc-log').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const row = e.target.closest('tr.pl-game');
  if (row) location.href = row.dataset.href;
});
const turnClubPage = (aStep) => {
  state.cpage = Math.max(1, state.cpage + aStep);
  loadClubGames();
  $('mc-log').closest('.lb-scroll').scrollIntoView({ block: 'nearest' });
};
$('mc-prev').addEventListener('click', () => turnClubPage(-1));
$('mc-next').addEventListener('click', () => turnClubPage(1));

const turnPage = (aStep) => {
  state.ppage = Math.max(1, state.ppage + aStep);
  loadGames();
  $('pl-log').closest('.lb-scroll').scrollIntoView({ block: 'nearest' });
};
$('pl-prev').addEventListener('click', () => turnPage(-1));
$('pl-next').addEventListener('click', () => turnPage(1));

$('signin').href = loginUrl();
const me = await mountAuth();
const gameId = /^\d{1,20}$/.test(params.get('game') ?? '') ? params.get('game') : null;
if (me.signedIn && gameId) {
  // One game (Nov 6): the page is its box score, nothing else.
  show('game');
  loadGame(gameId, me.gamertag);
} else if (me.signedIn) {
  // Phase C: signed in, the board opens on YOUR club — unless the link
  // asks for another one.
  if (!params.get('club') && me.club) state.club = me.club.clubId;
  myClubs = me.clubs ?? [];
  myServer = me.server ?? null;
  if (state.club === 'server' && !myServer) state.club = me.club?.clubId ?? DEFAULT_CLUB;
  tabs = BOARDS.filter((b) => !b.premium || me.premium);
  // A premium link, not premium. My player and My clubs are anyone's.
  if (!['me', 'myclubs'].includes(state.board) && !tabs.some((b) => b.id === state.board)) state.board = 'clubs';
  drawTabs(tabs);
  show('board');
  render();
} else {
  show(me.available ? 'gate' : 'down');
}
