// The stream overlay's card strip (Nov 16, elvis) -- see stream.html.
//
// Which cards: /stream/furballs (the opted-in Furballs members who played in
// the last 14 days), drawn from /cards like the grid, by OVR. The reel holds
// the list twice and scrolls up by one list's height, then jumps back: a
// seamless loop. The data is asked again every 10 minutes and swapped in at
// the jump, so a new card never pops mid-screen.

import { renderCard } from './card.js?v=9883a712ed';

const params = new URLSearchParams(location.search);
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = (LOCAL && params.get('api')) || 'https://api.elviteamtracker.com';
const SPEED = Math.max(5, Number(params.get('speed')) || 40); // px per second
const WIDTH = Number(params.get('w')) || 256; // elvis' pick (Nov 16): the game 1664x936 beside it
const GAP = 18;
const REFRESH_MS = 10 * 60 * 1000;

const strip = document.getElementById('strip');
const reel = document.getElementById('reel');
strip.style.width = `${WIDTH}px`;
if (params.get('bg') === 'transparent') document.body.classList.add('clear');

const getJson = async (aUrl, aMs = 8000) => {
  const r = await fetch(aUrl, { cache: 'no-cache', signal: AbortSignal.timeout(aMs) });
  if (!r.ok) throw new Error(`${aUrl}: HTTP ${r.status}`);
  return r.json();
};

const theme = await getJson('data/theme.json');
await Promise.all([document.fonts.load('bold 20px EASSCard'), document.fonts.load('20px EASSCard')]);

/** The strip's players, by OVR -- or null when the API does not answer. */
async function loadPlayers() {
  try {
    const [cards, stream] = await Promise.all([getJson(`${API}/cards`), getJson(`${API}/stream/furballs`)]);
    const keep = new Set(stream.players.map((s) => s.id));
    return cards.players.filter((p) => keep.has(p.id))
      .sort((a, b) => b.ovr - a.ovr || b.ovrTracked - a.ovrTracked || a.name.localeCompare(b.name));
  } catch (anErr) {
    console.warn('stream cards:', anErr);
    return null;
  }
}

const cardW = WIDTH - 2 * 10;
const cardH = Math.round(cardW * theme.height / theme.width);
const step = cardH + GAP;

let players = [];
let pending = null; // the next list, swapped in at the loop's jump
let offset = 0;
let last = performance.now();

function build(aList) {
  players = aList;
  reel.replaceChildren();
  if (!players.length) {
    reel.innerHTML = '<div class="empty">No cards yet</div>';
    return;
  }
  // Twice the list, and at least a screen and a card more, for the loop.
  // A list that fits the screen stands still, once.
  const loop = players.length * step;
  const copies = loop <= innerHeight ? 1 : Math.max(2, Math.ceil((innerHeight + step) / loop) + 1);
  for (let c = 0; c < copies; c++) {
    for (const p of players) {
      const div = document.createElement('div');
      div.className = 'card';
      div.style.width = `${cardW}px`;
      div.style.marginBottom = `${GAP}px`;
      div.innerHTML = renderCard(p, 'front', theme);
      reel.append(div);
    }
  }
  reel.style.paddingTop = `${GAP}px`;
}

function frame(aNow) {
  const dt = Math.min(0.1, (aNow - last) / 1000);
  last = aNow;
  const loop = players.length * step;
  if (loop > 0) {
    // Only scroll when the cards are more than the screen holds.
    if (loop > innerHeight) offset += SPEED * dt;
    if (offset >= loop) {
      offset -= loop;
      if (pending) {
        build(pending);
        pending = null;
        offset = 0;
      }
    }
    reel.style.transform = `translateY(${-offset}px)`;
  } else if (pending) {
    build(pending);
    pending = null;
  }
  requestAnimationFrame(frame);
}

build((await loadPlayers()) ?? []);
requestAnimationFrame(frame);

setInterval(async () => {
  const next = await loadPlayers();
  if (!next) return; // the API down: keep scrolling what we have
  const same = next.length === players.length && next.every((p, i) => p.id === players[i].id
    && p.ovr === players[i].ovr && p.games === players[i].games);
  if (!same) pending = next;
}, REFRESH_MS);
