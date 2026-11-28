// The stream overlay's score ticker (Nov 17, elvis) -- see scores.html.
//
// /stream/scores every 2 minutes; the reel holds the games twice (or more,
// to fill the bar) and slides left by one set, then jumps back: a seamless
// loop. A new list is swapped in at the jump, never mid-screen.

const params = new URLSearchParams(location.search);
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = (LOCAL && params.get('api')) || 'https://api.elviteamtracker.com';
const SPEED = Math.max(5, Number(params.get('speed')) || 70); // px per second
const REFRESH_MS = 20 * 1000; // 20 s: a finished game is announced within ~half a minute

// ?c=<code> : a ticker built on the web (ticker.html) -- its discord, clubs and
// leagues live on the server. No code = the Furballs' original ticker.
const CODE = (params.get('c') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);

const reel = document.getElementById('reel');
const view = reel.parentElement;
// ?fs=<px> : text size (default 19) ; the other sizes scale with it.
const FS = Number(params.get('fs'));
if (FS >= 8 && FS <= 60) document.documentElement.style.setProperty('--k', String(FS / 19));
// ?bg=transparent = no backdrop ; ?bg=true = the dark backdrop (the default) ;
// ?bg=<hex, e.g. 0a1428> = a backdrop of that colour.
const BG = params.get('bg');
if (BG === 'transparent') document.body.classList.add('clear');
else if (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(BG || '')) document.body.style.background = '#' + BG;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function when(aTs) {
  const d = new Date(aTs * 1000);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return Date.now() - d.getTime() < 20 * 3600 * 1000
    ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

async function load() {
  try {
    const r = await fetch(`${API}/stream/scores${CODE ? `?c=${CODE}` : ''}`,
      { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (anErr) {
    console.warn('stream scores:', anErr);
    return null;
  }
}

// One club: its name, then its last games (up to 3, newest first).
const game = (g) => `<span class="g">${g.result ? `<span class="r ${g.result}">${g.result}</span>` : ''}`
  + `<span class="s">${g.gf}-${g.ga}</span><span class="opp">${esc(g.opp ?? '')}</span>`
  + `<span class="t">${when(g.ts)}</span></span>`;
// The ETT's remarks on a game (feats), right after its score.
const notes = (g) => (g.notes || []).map((n) =>
  `<span class="g note"><span class="elvi"><i></i></span><span class="txt">${esc(n)}</span></span>`).join('');
// A league's chip opens its group of clubs (clubs arrive grouped by league).
// When fewer than 3 games are live, last night's league results follow
// (c.prev), under a LAST NIGHT chip.
const item = (c, i, all) => ((c.prev && !all[i - 1]?.prev) ? '<span class="lg night">Last night</span>' : '')
  + ((c.league && (c.league !== all[i - 1]?.league || c.prev !== !!all[i - 1]?.prev))
    ? `<span class="lg">${esc(c.league)}</span>` : '')
  + `<span class="club${c.kind === 'primary' ? ' primary' : ''}">${esc(c.club)}</span>`
  + c.games.map((g) => game(g) + notes(g)).join('');

// The "around the league" block (Nov 25, elvis liked it): the day's finals of the
// other teams of the followed leagues, closing each loop of the reel, by league.
const aroundItem = (o) => `<span class="g"><span class="us">${esc(o.a)}</span>`
  + `<span class="s">${o.as}-${o.bs}</span><span class="opp">${esc(o.b)}</span>`
  + `<span class="t">${when(o.ts)}</span></span>`;
function around(aOthers) {
  const list = aOthers.slice(0, 14);
  if (!list.length) return '';
  const byLeague = new Map();
  for (const o of list) byLeague.set(o.league, [...(byLeague.get(o.league) ?? []), o]);
  return '<span class="lg night">Around the league</span>'
    + [...byLeague].map(([lg, rows]) => `<span class="lg">${esc(lg)}</span>${rows.map(aroundItem).join('')}`).join('');
}

let games = null;
let pending = null;
let setWidth = 0;
let offset = 0;
let last = performance.now();

function build(aData) {
  games = aData;
  const clubs = aData.clubs ?? [];
  const others = aData.others ?? [];
  offset = 0;
  if (!clubs.length && !others.length) {
    reel.innerHTML = '<span class="empty">No recent games</span>';
    setWidth = 0;
    return;
  }
  const one = clubs.map(item).join('') + around(others);
  reel.innerHTML = one;
  setWidth = reel.scrollWidth;
  // One set plus enough copies to cover the bar while it slides.
  reel.innerHTML = one.repeat(1 + Math.ceil(view.clientWidth / setWidth));
}

function frame(aNow) {
  const dt = Math.min(0.1, (aNow - last) / 1000);
  last = aNow;
  if (setWidth > 0) {
    offset += SPEED * dt;
    if (offset >= setWidth) {
      offset -= setWidth;
      if (pending) { build(pending); pending = null; }
    }
    reel.style.transform = `translateX(${-offset}px)`;
  } else if (pending) {
    build(pending);
    pending = null;
  }
  requestAnimationFrame(frame);
}

await document.fonts.ready;
const first = await load();
build(first ?? {});
requestAnimationFrame(frame);

// SCORE ALERT (Nov 25, elvis): a game that has just finished takes over the bar
// for a few seconds. A game is "new" when it was not in an earlier load and
// finished in the last 20 minutes (a late link or a backfill never alerts).
// Our own games alert one by one; the OTHER teams of the leagues (j.others) come
// as "AROUND THE LEAGUE" passes -- up to 4 results a pass, 2 passes at most, then
// 3 minutes of quiet -- so a league night's cluster of finals never floods the bar.
// The first load only learns what is there. ?alert=test plays one of each.
const alertEl = document.getElementById('alert');
const seen = new Set();
const queue = [];
const pool = [];          // other-league results waiting for their pass
let lastPass = 0;
let showing = false;
const key = (c, g) => `${c.club}|${g.ts}`;
const okey = (o) => `o|${o.ts}|${o.a}|${o.b}`;
const flat = (aClubs) => aClubs.flatMap((c) => c.games.map((g) => ({ c, g })));
const fresh = (aTs) => Date.now() / 1000 - aTs < 20 * 60;

function learn(aJson, aAlert) {
  for (const { c, g } of flat(aJson.clubs ?? [])) {
    const k = key(c, g);
    if (seen.has(k)) continue;
    seen.add(k);
    if (aAlert && !c.prev && fresh(g.ts)) queue.push({ own: true, c, g });
  }
  for (const o of aJson.others ?? []) {
    const k = okey(o);
    if (seen.has(k)) continue;
    seen.add(k);
    if (aAlert && fresh(o.ts)) pool.push(o);
  }
}

// Collect the pool into at most 2 passes of 4, once the quiet time is over.
function schedulePasses() {
  if (!pool.length || Date.now() - lastPass < 3 * 60 * 1000) return;
  pool.sort((x, y) => y.ts - x.ts);
  queue.push({ pass: pool.splice(0, 12), left: 2 });
  pool.length = 0;
  lastPass = Date.now();
}

const ownHtml = ({ c, g }) => {
  const win = g.result === 'W';
  return '<span class="al-tag">SCORE ALERT</span><span class="al-fin">FINAL</span>'
    + (c.league ? `<span class="lg">${esc(c.league)}</span>` : '')
    + `<span class="al-club">${esc(c.club)}</span>`
    + (g.result ? `<span class="r ${g.result}">${g.result}</span>` : '')
    + `<span class="al-sc">${g.gf}-${g.ga}</span>`
    + `<span class="al-opp">${win ? 'over' : 'vs'} ${esc(g.opp ?? '')}</span>`
    + (g.notes?.length ? `<span class="al-note">${esc(g.notes[0])}</span>` : '');
};
const resHtml = (o) => `<span class="al-res"><span class="lg">${esc(o.league)}</span>`
  + `<span class="al-w">${esc(o.a)}</span><span class="al-sc">${o.as}-${o.bs}</span>`
  + `<span class="al-opp">${esc(o.b)}</span></span>`;
// Puts as many results on the strip as fit (never a cut-off name); returns how many.
function fillPass(aList) {
  alertEl.innerHTML = '<span class="al-tag pass">AROUND THE LEAGUE</span>';
  let n = 0;
  for (const o of aList) {
    alertEl.insertAdjacentHTML('beforeend', resHtml(o));
    if (alertEl.scrollWidth > alertEl.clientWidth + 1 && n > 0) {
      alertEl.lastElementChild.remove();
      break;
    }
    n++;
  }
  return n;
}

async function playAlerts() {
  if (showing) return;
  showing = true;
  while (queue.length) {
    const item = queue.shift();
    alertEl.classList.toggle('pass', !item.own);
    if (item.own) {
      alertEl.innerHTML = ownHtml(item);
    } else {
      // What did not fit goes to a second pass (never more than 2 in all).
      const n = fillPass(item.pass);
      if (item.pass.length > n && item.left > 1) queue.unshift({ pass: item.pass.slice(n), left: item.left - 1 });
    }
    alertEl.classList.add('on');
    await new Promise((r) => setTimeout(r, item.own ? 10000 : 12000));
    alertEl.classList.remove('on');
    await new Promise((r) => setTimeout(r, 700));
  }
  showing = false;
}

learn(first ?? {}, false);
if (params.get('alert') === 'test') {
  const t = flat(first?.clubs ?? [])[0];
  if (t) queue.push({ own: true, ...t });
  if (first?.others?.length) queue.push({ pass: first.others.slice(0, 12), left: 2 });
  playAlerts();
}

setInterval(async () => {
  const next = await load();
  if (!next) return;
  learn(next, true);
  schedulePasses();
  playAlerts();
  if (JSON.stringify(next) !== JSON.stringify(games)) pending = next;
}, REFRESH_MS);
