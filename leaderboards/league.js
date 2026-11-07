// A league portal (Oct 24, CVHL first): one league's own public page —
// standings, results, the calendar and the scoring leaders.
//
// Served on {slug}.elviteamtracker.com by the Cloudflare Worker, which reads
// this page from the main site: the subdomain names the league. On the main
// site or on localhost, ?l={slug} does (and ?api= on localhost points at
// the lab's API). PUBLIC: no sign-in, the API answers without credentials.
//   /portal/{slug}                the league and its seasons
//   /portal/{slug}/season/{id}    standings + calendar with results
//   /portal/{slug}/leaders?mode=  skaters and goalies, a season or all of them

const params = new URLSearchParams(location.search);
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = (LOCAL && params.get('api')) || 'https://api.elviteamtracker.com';
const HOST = location.hostname.match(/^([a-z0-9-]+)\.elviteamtracker\.com$/);
const SLUG = HOST && !['www', 'api'].includes(HOST[1]) ? HOST[1] : (params.get('l') ?? '').toLowerCase();

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fix = (n) => (v) => (v == null ? '—' : v.toFixed(n));
const int = (v) => (v == null ? '—' : String(v));
const signed = (v) => (v == null ? '—' : v > 0 ? `+${v}` : String(v));

const SECTIONS = [
  { id: 'standings', label: 'Standings' },
  { id: 'results', label: 'Results' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'leaders', label: 'Leaders' },
];
const VIEWS = [{ id: 'skaters', label: 'Skaters' }, { id: 'goalies', label: 'Goalies' }];

const COLUMNS = {
  skaters: [
    { key: 'gp', head: 'GP', tip: 'Games played as a skater', get: (p) => p.skaterGames, fmt: int },
    { key: 'g', head: 'G', tip: 'Goals', get: (p) => p.goals, fmt: int },
    { key: 'a', head: 'A', tip: 'Assists', get: (p) => p.assists, fmt: int },
    { key: 'p', head: 'P', tip: 'Points', get: (p) => p.points, fmt: int },
    { key: 'ppg', head: 'P/GP', tip: 'Points per game', get: (p) => (p.skaterGames ? p.points / p.skaterGames : null), fmt: fix(2) },
    { key: 'pm', head: '+/-', tip: 'Plus/minus', get: (p) => p.plusMinus, fmt: signed },
    { key: 's', head: 'S', tip: 'Shots', get: (p) => p.shots, fmt: int },
    { key: 'hit', head: 'HIT', tip: 'Hits', get: (p) => p.hits, fmt: int },
    { key: 'pim', head: 'PIM', tip: 'Penalty minutes', get: (p) => p.pim, fmt: int },
    { key: 'rtg', head: 'RTG', tip: 'Average game rating', get: (p) => p.rtgSkater, fmt: fix(1) },
  ],
  goalies: [
    { key: 'gp', head: 'GP', tip: 'Games played in goal', get: (p) => p.goalieGames, fmt: int },
    { key: 'svpct', head: 'SV%', tip: 'Save percentage', get: (p) => p.goalieSavePct, fmt: fix(2) },
    { key: 'gaa', head: 'GAA', tip: 'Goals against per 60 minutes', get: (p) => (p.goalieToiSeconds ? (3600 * p.goalieGoalsAgainst) / p.goalieToiSeconds : null), fmt: fix(2), asc: true },
    { key: 'sv', head: 'SV', tip: 'Saves', get: (p) => p.goalieSaves, fmt: int },
    { key: 'ga', head: 'GA', tip: 'Goals against', get: (p) => p.goalieGoalsAgainst, fmt: int, asc: true },
    { key: 'sop', head: 'SO P', tip: 'Shutout periods', get: (p) => p.goalieShutoutPeriods, fmt: int },
    { key: 'rtg', head: 'RTG', tip: 'Average game rating', get: (p) => p.rtgGoalie, fmt: fix(1) },
  ],
};

const state = {
  section: SECTIONS.some((s) => s.id === params.get('s')) ? params.get('s') : 'standings',
  season: params.get('season'), // a season's mode, "lg27"; the leaders also take the league's own
  view: params.get('view') === 'goalies' ? 'goalies' : 'skaters',
  min: 1,
  sort: null,
  dir: 'desc',
};
let league = null; // /portal/{slug}
let data = null;   // the current section's answer
let request = 0;

async function api(aPath) {
  const r = await fetch(`${API}${aPath}`);
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.json();
}

function saveUrl() {
  const q = new URLSearchParams();
  if (!HOST && SLUG) q.set('l', SLUG);
  if (state.section !== 'standings') q.set('s', state.section);
  if (state.season) q.set('season', state.season);
  if (state.section === 'leaders' && state.view !== 'skaters') q.set('view', state.view);
  if (LOCAL && params.get('api')) q.set('api', params.get('api'));
  history.replaceState(null, '', q.toString() ? `?${q}` : location.pathname);
}

function drawTabs() {
  $('boards').replaceChildren(...SECTIONS.map((s) => {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'lb-tab';
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', String(s.id === state.section));
    t.append(s.label);
    t.addEventListener('click', () => {
      if (s.id === state.section) return;
      state.section = s.id;
      // A season is a calendar: off the leaders, "every season" is not one.
      if (s.id !== 'leaders' && state.season === league.mode) state.season = null;
      state.sort = null;
      drawTabs();
      load();
    });
    return t;
  }));
}

function drawControls() {
  const leaders = state.section === 'leaders';
  const seasons = league.seasons ?? [];
  if (!state.season || (state.season === league.mode ? !leaders : !seasons.some((s) => s.mode === state.season))) {
    state.season = seasons[0]?.mode ?? (leaders ? league.mode : null);
  }
  const options = seasons.map((s) => new Option(s.label, s.mode));
  if (leaders) options.unshift(new Option('Every season', league.mode));
  $('season').replaceChildren(...options);
  $('season').value = state.season ?? '';
  $('seasonwrap').hidden = !options.length;
  $('views').hidden = !leaders;
  $('minwrap').hidden = !leaders;
  if (leaders) chips($('views'), VIEWS, state.view, (id) => { state.view = id; state.sort = null; draw(); });
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

$('season').addEventListener('change', (e) => { state.season = e.target.value; load(); });
$('min').addEventListener('change', (e) => { state.min = Number(e.target.value); draw(); });

async function load() {
  drawControls();
  saveUrl();
  const mine = ++request;
  data = null;
  $('table').replaceChildren();
  $('status').textContent = 'Loading…';
  if (state.section !== 'leaders' && !state.season) {
    $('status').textContent = 'No season on the calendar yet.';
    return;
  }
  try {
    const answer = state.section === 'leaders'
      ? await api(`/portal/${SLUG}/leaders?mode=${encodeURIComponent(state.season)}`)
      : await api(`/portal/${SLUG}/season/${state.season.replace(/^lg/, '')}`);
    if (mine !== request) return;
    data = answer;
    draw();
  } catch {
    if (mine !== request) return;
    $('status').textContent = 'This page is unavailable right now — try again in a few minutes.';
  }
}

function draw() {
  saveUrl();
  if (!data) return;
  if (state.section === 'standings') drawStandings();
  else if (state.section === 'results') drawGames(true);
  else if (state.section === 'calendar') drawGames(false);
  else drawLeaders();
}

function drawStandings() {
  const rows = data.standings ?? [];
  $('status').textContent = rows.length
    ? `${rows.length} teams · 2 points a win, 1 an overtime loss · games matched to the calendar`
    : 'No team on this calendar yet.';
  $('table').innerHTML = `<thead><tr><th class="lb-rank">#</th><th class="lb-name">Team</th>`
    + ['GP', 'W', 'L', 'OTL', 'PTS', 'GF', 'GA', 'DIFF'].map((h) => `<th scope="col">${h}</th>`).join('')
    + `</tr></thead><tbody>${rows.map((t, i) => `<tr><td class="lb-rank">${i + 1}</td>`
    + `<td class="lb-name">${esc(t.team)}</td><td>${t.gp}</td><td>${t.w}</td><td>${t.l}</td>`
    + `<td>${t.otl}</td><td class="lb-on">${t.pts}</td><td>${t.gf}</td><td>${t.ga}</td>`
    + `<td>${signed(t.gf - t.ga)}</td></tr>`).join('')}</tbody>`;
}

/** "Mon Oct 19 · 20:00", or "Week of Oct 19" for a negotiated game. */
function when(aGame) {
  const d = new Date(`${aGame.date}T12:00:00`);
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return aGame.time
    ? `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${day} · ${aGame.time}`
    : `Week of ${day}`;
}

/** A local ISO date, n days from today. */
function isoDay(aOffset) {
  const d = new Date();
  d.setDate(d.getDate() + aOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function drawGames(aPlayed) {
  // The calendar is what is still ahead: today on, and the current week
  // for a negotiated game (its date is the week's first day). A past game
  // never matched to an EA one is neither a result nor ahead.
  const today = isoDay(0);
  const weekAgo = isoDay(-6);
  let games = (data.games ?? []).filter((g) => (aPlayed ? g.played
    : !g.played && g.date >= (g.time ? today : weekAgo)));
  if (aPlayed) games = games.slice().reverse(); // newest first
  $('status').textContent = games.length
    ? `${games.length} game${games.length === 1 ? '' : 's'}${aPlayed ? ' · newest first' : ' · still to play'}`
    : aPlayed ? 'No result yet.' : 'Nothing left on the calendar.';
  $('table').innerHTML = `<thead><tr><th class="lb-name">When</th><th class="lb-name">Home</th>`
    + `<th scope="col">${aPlayed ? 'Score' : ''}</th><th class="lb-name">Away</th></tr></thead>`
    + `<tbody>${games.map((g) => {
      const score = aPlayed
        ? `${g.homeGoals} – ${g.awayGoals}${g.ot ? ' OT' : ''}` : 'vs';
      const hw = aPlayed && g.homeGoals > g.awayGoals;
      const aw = aPlayed && g.awayGoals > g.homeGoals;
      return `<tr><td class="lb-name">${esc(when(g))}</td>`
        + `<td class="lb-name">${hw ? '<strong>' : ''}${esc(g.home)}${hw ? '</strong>' : ''}</td>`
        + `<td>${score}</td>`
        + `<td class="lb-name">${aw ? '<strong>' : ''}${esc(g.away)}${aw ? '</strong>' : ''}</td></tr>`;
    }).join('')}</tbody>`;
}

function drawLeaders() {
  const cols = COLUMNS[state.view];
  const gp = cols[0].get;
  const sortCol = cols.find((c) => c.key === state.sort)
    ?? (state.view === 'goalies' ? cols.find((c) => c.key === 'svpct') : cols.find((c) => c.key === 'p'));
  const dir = state.sort ? state.dir : (sortCol.asc ? 'asc' : 'desc');
  const sign = dir === 'asc' ? 1 : -1;
  const rows = (data.players ?? []).filter((p) => (gp(p) ?? 0) >= state.min).sort((a, b) => {
    const x = sortCol.get(a);
    const y = sortCol.get(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return sign * (x - y) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  $('status').textContent = rows.length
    ? `${rows.length} ${state.view === 'goalies' ? 'goalie' : 'skater'}${rows.length === 1 ? '' : 's'} · ${$('season').selectedOptions[0]?.text ?? ''}`
    : `Nobody here with ${state.min}+ games.`;
  $('table').innerHTML = `<thead><tr><th class="lb-rank">#</th><th class="lb-name">Player</th>${cols.map((c) =>
    `<th scope="col" title="${esc(c.tip)}" aria-sort="${c === sortCol ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}">`
    + `<button type="button" data-key="${c.key}">${esc(c.head)}${c === sortCol ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>`
    + `<tbody>${rows.map((p, i) => `<tr><td class="lb-rank">${i + 1}</td><td class="lb-name">${esc(p.name)}</td>${cols.map((c) =>
      `<td${c === sortCol ? ' class="lb-on"' : ''}>${c.fmt(c.get(p))}</td>`).join('')}</tr>`).join('')}</tbody>`;
}

$('table').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-key]');
  if (!btn || state.section !== 'leaders') return;
  const col = COLUMNS[state.view].find((c) => c.key === btn.dataset.key);
  if (state.sort === col.key) state.dir = state.dir === 'desc' ? 'asc' : 'desc';
  else { state.sort = col.key; state.dir = col.asc ? 'asc' : 'desc'; }
  draw();
});

function down(aTitle, aText) {
  $('down-title').textContent = aTitle;
  $('down-text').textContent = aText;
  $('down').hidden = false;
}

if (!SLUG) {
  down('No league here', 'This address does not name a league.');
} else {
  try {
    league = await api(`/portal/${encodeURIComponent(SLUG)}`);
    $('lg-name').textContent = league.name;
    if (league.logo) {
      $('lg-logo').src = `${API}/portal/${encodeURIComponent(SLUG)}/logo`;
      $('lg-logo').hidden = false;
    }
    document.title = `${league.name} — Elvi's Team Tracker`;
    $('board').hidden = false;
    drawTabs();
    load();
  } catch (anErr) {
    if (anErr.status === 404) down('No league here', 'No league has a page at this address.');
    else down('Unavailable right now', 'This league page can\'t be reached at the moment — try again in a few minutes.');
  }
}
