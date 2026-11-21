// The stream overlay's score ticker (Nov 17, elvis) -- see scores.html.
//
// /stream/scores every 2 minutes; the reel holds the games twice (or more,
// to fill the bar) and slides left by one set, then jumps back: a seamless
// loop. A new list is swapped in at the jump, never mid-screen.

const params = new URLSearchParams(location.search);
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = (LOCAL && params.get('api')) || 'https://api.elviteamtracker.com';
const SPEED = Math.max(5, Number(params.get('speed')) || 70); // px per second
const REFRESH_MS = 2 * 60 * 1000;

const reel = document.getElementById('reel');
const view = reel.parentElement;
if (params.get('bg') === 'transparent') document.body.classList.add('clear');

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
    const r = await fetch(`${API}/stream/scores`, { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()).clubs;
  } catch (anErr) {
    console.warn('stream scores:', anErr);
    return null;
  }
}

// One club: its name, then its last games (up to 3, newest first).
const game = (g) => `<span class="g">${g.result ? `<span class="r ${g.result}">${g.result}</span>` : ''}`
  + `<span class="s">${g.gf}-${g.ga}</span><span class="opp">${esc(g.opp ?? '')}</span>`
  + `<span class="t">${when(g.ts)}</span></span>`;
const item = (c) => `<span class="club${c.kind === 'primary' ? ' primary' : ''}">${esc(c.club)}</span>`
  + c.games.map(game).join('');

let games = null;
let pending = null;
let setWidth = 0;
let offset = 0;
let last = performance.now();

function build(aList) {
  games = aList;
  offset = 0;
  if (!games.length) {
    reel.innerHTML = '<span class="empty">No recent games</span>';
    setWidth = 0;
    return;
  }
  const one = games.map(item).join('');
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
build((await load()) ?? []);
requestAnimationFrame(frame);

setInterval(async () => {
  const next = await load();
  if (next && JSON.stringify(next) !== JSON.stringify(games)) pending = next;
}, REFRESH_MS);
