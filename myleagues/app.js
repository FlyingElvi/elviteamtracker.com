// My leagues (Nov 21, elvis). See MyLeaguesRepository; the lab it came from is design/rolodex.html.
// My leagues (Nov 21). Static files of the site (GitHub Pages); the API only sends JSON (and takes his answers).
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = (LOCAL && new URLSearchParams(location.search).get('api')) || 'https://api.elviteamtracker.com';
const root = document.querySelector('#members .wrap');
const STEP = () => 150;
async function get(aPath) {
  const r = await fetch(`${API}${aPath}`, { credentials: 'include', cache: 'no-store' });
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
  return r.json();
}
root.innerHTML = `<div class="mlg"><div class="top"><h1>My leagues</h1><div class="chips" id="chips"></div><div class="rec" id="rec"></div></div>
  <div class="scroller" id="sc"><div id="track"><div class="stage"><div class="deck" id="deck"></div></div></div></div>
  <div class="mlnav"><button id="prev">&#9664; Earlier</button><button id="today">Today</button><button id="next">Later &#9654;</button></div>
  <div class="posl" id="pos"></div><div class="toast" id="mltoast"></div></div>`;
async function post(aPath, aBody) {
  const r = await fetch(`${API}${aPath}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-ETT': '1' }, body: JSON.stringify(aBody) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(body.error || `HTTP ${r.status}`), { status: r.status });
  return body;
}
let toastT;
function toast(aMsg) { const t = document.getElementById('mltoast'); t.textContent = aMsg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }
const $ = (i) => document.getElementById(i);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const POS = { center: 'C', leftWing: 'LW', rightWing: 'RW', defenseMen: 'D', goalie: 'G' };
const init = (s) => String(s || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
// Short names: the same rules as the Manage page (manage/app.js, Nov 19) so a lineup reads the same everywhere.
const SHORT = new Map();
function autoShort(aName) {
  const clean = (x) => String(x).replace(/[^A-Za-z0-9]+/g, ' ').replace(/\b(I{2,}|l{2,}|x{2,})\b/gi, ' ').trim()
    .replace(/(?<=[A-Za-z])\d+$/, '').replace(/^\d+(?=[A-Za-z])/, '').trim();
  const m = /^(.*?)\s*[(\[](.+?)[)\]]\s*$/.exec(String(aName).trim());
  const cands = (m ? [m[1], m[2]] : [aName]).map(clean).filter((x) => x.length >= 2);
  if (!cands.length) return String(aName);
  let pick = cands.sort((a, b) => a.length - b.length)[0];
  // words: spaces, then camelCase (FlyingElvi), never inside an all-caps run
  const words = pick.split(' ').flatMap((w) => w.split(/(?<=[a-z0-9])(?=[A-Z])/)).filter(Boolean);
  const is = words.findIndex((w, i) => i > 0 && /^(is|was|da|tha)$/i.test(w));
  if (pick.replace(/ /g, '').length <= 7) pick = words.join('');          // short enough already: BigMac, TeeKnee
  else if (is > 0) pick = words.slice(0, is).join('');                  // CamIsHeated -> Cam (who, not how)
  else if (words.length > 1 && words[words.length - 1].length >= 3) pick = words[words.length - 1];
  else if (words.length > 1) pick = words.join('');
  pick = pick.replace(/\d+$/, '') || pick;
  if (pick.length >= 5 && pick === pick.toUpperCase()) pick = pick[0] + pick.slice(1).toLowerCase();
  if (pick.length > 9) pick = pick.slice(0, 4);
  return pick;
}
function sn(aName) {
  if (!aName) return '';
  const k = String(aName);
  if (!SHORT.has(k)) SHORT.set(k, autoShort(k));
  return SHORT.get(k);
}
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let items = [], els = [], D = null, BOX = {};

function crest(logo, name) {
  return `<span class="cr">${logo ? `<img src="${esc(logo)}" alt="">` : esc(init(name))}</span>`;
}
const logoOf = (box, us) => ((box && box.clubs) || []).find((c) => (c.clubId === D.club) === us)?.logo || null;
function starsOf(box) {
  return ((box && box.stars) || []).slice(0, 3).map((s, i) => `<span class="s${i + 1}">&#9733; ${esc(s.name)} <em>${esc(s.detail)}</em></span>`).join('');
}
const PO = { LW: 0, C: 1, RW: 2, LD: 3, RD: 4, D: 5 };
function sheet(g, box, side) {
  const cl = (box?.clubs || []).find((c) => (side === 'us') === (c.clubId === D.club));
  if (!cl) return `<div class="sh"><table><tr><td>${box && box.clubs ? 'No box score' : 'Loading the box score...'}</td></tr></table></div>`;
  const sk = cl.skaters.slice().sort((x, y) => (PO[x.position] ?? 9) - (PO[y.position] ?? 9));
  const sg = (v) => (v > 0 ? '+' + v : v);
  const rows = sk.map((x) => `<tr><td>${esc(x.name)}</td><td class="pos">${esc(x.position)}</td><td>${x.rating}</td><td>${x.goals}</td><td>${x.assists}</td><td class="p">${x.points}</td><td>${sg(x.plusMinus)}</td><td>${x.pim}</td><td>${x.shots}</td><td>${x.hits}</td><td>${x.blocks}</td><td>${x.takeaways}</td><td>${x.giveaways}</td><td>${x.passes}</td></tr>`).join('');
  const t = cl.totals || {};
  const gk = (cl.goalies || []).map((x) => `<tr><td>${esc(x.name)}</td><td>${x.rating}</td><td class="p hl">${x.savePct}%</td><td>${(+x.gaa).toFixed(2)}</td><td>${x.saves}</td><td>${x.shots}</td><td>${x.ga}</td><td>${x.breakawaySaves}/${x.breakawayShots}</td><td>${x.penaltyShotSaves}/${x.penaltyShots}</td></tr>`).join('');
  return `<div class="sh"><table><thead><tr><th>Player</th><th>POS</th><th>RTG</th><th>G</th><th>A</th><th>P</th><th>+/-</th><th>PIM</th><th>S</th><th>H</th><th>B</th><th>TK</th><th>GV</th><th>PAS</th></tr></thead>
    <tbody>${rows}<tr class="tot"><td>TOTALS</td><td></td><td></td><td>${t.goals}</td><td>${t.assists}</td><td>${t.points}</td><td></td><td>${t.pim}</td><td>${t.shots}</td><td>${t.hits}</td><td>${t.blocks}</td><td>${t.takeaways}</td><td>${t.giveaways}</td><td>${t.passes}</td></tr></tbody></table></div>
    ${gk ? `<div class="sh"><table><thead><tr><th>Goalie</th><th>RTG</th><th>SV%</th><th>GAA</th><th>SV</th><th>SA</th><th>GA</th><th>BRK</th><th>PS</th></tr></thead><tbody>${gk}</tbody></table></div>` : ''}`;
}
function gameCard(g, box) {
  const top = starsOf(box);
  const pct = g.sf && g.sa ? Math.round(100 * g.sf / (g.sf + g.sa)) : 50;
  const oppName = (box?.clubs || []).find((c) => c.clubId !== D.club)?.name || g.opp;
  return `<div class="in"><div class="strip"><span><b>${g.dow.toUpperCase()} ${g.mon.toUpperCase()} ${g.day}</b> &middot; ${esc(g.time)}</span><span>${g.me ? `<span class="you">YOU &middot; ${esc(POS[g.me] || g.me)}</span>` : ''}WEEK ${g.week ?? '?'} &middot; G${g.gameNo ?? ''}</span></div>
    <div class="mu"><div class="tm">${crest(logoOf(box, true), D.clubName)}${esc(D.clubName)}</div>
      <div class="sc"><span class="${g.gf > g.ga ? '' : 'lo'}">${g.gf}</span><span class="fl">${g.ot ? 'FINAL/OT' : 'FINAL'}</span><span class="${g.gf > g.ga ? 'lo' : ''}">${g.ga}</span></div>
      <div class="tm">${crest(logoOf(box, false), oppName)}${esc(oppName)}</div></div>
    <div class="sog"><span>SOG ${g.sf ?? '-'}</span><span>${g.res === 'W' ? 'WIN' : g.res === 'OTL' ? 'OT LOSS' : 'LOSS'}</span><span>SOG ${g.sa ?? '-'}</span></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="stars">${top}</div>
    <div class="tt"><button class="on" data-side="us">${esc(D.clubName)}</button><button data-side="them">${esc(oppName)}</button></div>
    <div class="body" data-mid="${g.matchId}">${sheet(g, box, 'us')}</div>
    <div class="ft"><span>Post-game notes</span><a href="/leaderboards/?game=${g.matchId}" target="_blank" rel="noopener">Game page &#8599;</a></div></div>`;
}
// Week separator (elvis, Nov 21): the first night of a week has a bigger tab that names the week.
const wkTab = (o, dt) => (o.wkStart ? `<span class="tab wk">${esc(o.wkText)} &middot; ${dt}</span>` : `<span class="tab">${dt}</span>`);
const weekOfLabel = (t) => (String(t || '').split(/ - | \u00b7 /)[0].trim() || 'Coming up').toUpperCase();
function divCard(n) {
  const w = n.games.filter((g) => g.res === 'W').length, l = n.games.length - w;
  const pills = n.games.map((g) => `<i class="${g.res}">${g.gf}-${g.ga}</i>`).join('');
  return `${wkTab(n, `${n.dow.toUpperCase()} ${n.mon.toUpperCase()} ${n.day}`)}<div class="in dv"><div class="big">${n.dow.toUpperCase()} ${n.mon.toUpperCase()} ${n.day}</div>
    <div class="d2">${n.games.length} GAME${n.games.length > 1 ? 'S' : ''}</div>
    <div class="r2">${w}-${l}</div><div class="gms">${pills}</div></div>`;
}
const wk = (t) => String(t || '').replace(/[^ -~]+/g, ' · ');
const AVL = { in: '&#10003; In &mdash; all times', out: '&#10005; Out', maybe: '&#9995; Maybe' };
const CFL = { yes: "&#10003; I'm In + Warmups", game: '&#9719; Game Time', no: "&#10005; Can't" };
const isOn = (u, a) => u.answer === a;
const avLabel = (u, a) => (a === 'in' && u.answer === 'in' && u.hours.some((x) => x.out) ? '&#10003; In &mdash; partial' : AVL[a]);
const isOnC = (u, c) => u.confirm === c;
function lineupGrid(u) {
  if (!u.lineup || !u.lineup.length) return '';
  return `<div class="lg">${['LW', 'C', 'RW', 'LD', 'G', 'RD'].map((p) => {
    const x = u.lineup.find((l) => l.pos === p);
    return `<div class="lt ${p}${x && x.me ? ' me' : ''}"><b${x ? ` title="${esc(x.name)}"` : ''}>${x ? esc(sn(x.name)) : '&mdash;'}</b></div>`;
  }).join('')}</div>`;
}
function nightCard(u) {
  const dt = `${u.dow.toUpperCase()} ${u.mon.toUpperCase()} ${u.day}`;
  const pub = u.status === 'published';
  const lu = pub ? (u.pos ? `<div class="lu yes">YOU'RE IN THE LINEUP &middot; ${esc(POS[u.pos] || u.pos)}</div>` : `<div class="lu no">LINEUP PUBLISHED &middot; YOU'RE NOT IN</div>`) : '<div class="lu open">AVAILABILITY OPEN</div>';
  return `${wkTab(u, dt)}<div class="in nt"><div class="strip"><span><b>${dt}</b></span><span>${u.status === 'published' && u.pos ? `<span class="you">YOU &middot; ${esc(POS[u.pos] || u.pos)}</span>` : ''}${u.phase === 'playoffs' ? 'PLAYOFFS' : 'COMING UP'}</span></div>
    <div class="nb"><div class="nk">${esc(wk(u.weekLabel)).toUpperCase()}</div><div class="vs">${u.opp ? 'vs ' + esc(u.opp) : 'Opponent TBD'}</div>
    <div class="hrs">${u.hours.map((x, i) => (pub ? `<i class="st">${esc(x.h)}</i>` : `<button data-i="${i}" class="${x.out ? 'off' : ''}">${esc(x.h)}</button>`)).join('')}</div>${lu}
    ${lineupGrid(u)}
    <div class="av" data-nid="${u.nightId}">${pub
      ? ['yes', 'game', 'no'].map((c) => `<button data-c="${c}" class="${isOnC(u, c) ? 'on' : ''}">${CFL[c]}</button>`).join('')
      : ['in', 'out', 'maybe'].map((a) => `<button data-a="${a}" class="${isOn(u, a) ? 'on' : ''}">${avLabel(u, a)}</button>`).join('')}</div></div></div>`;
}
const LONG = { Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday' };
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
function myLines() {
  const m = D.my || {}, o = [];
  if (m.goalie) { const g = m.goalie; o.push(`<b>G</b>${g.gp} GP &middot; ${g.w}-${g.l} &middot; SV% ${g.sa ? (g.sv / g.sa).toFixed(3).replace(/^0/, '') : '-'} &middot; GAA ${g.gaa ?? '-'}`); }
  if (m.skater) { const k = m.skater; o.push(`<b>Skater</b>${k.gp} GP &middot; ${k.g} G &middot; ${k.a} A &middot; ${k.g + k.a} P &middot; ${k.pm > 0 ? '+' : ''}${k.pm}`); }
  return o.map((x) => `<div class="ml">${x}</div>`).join('') || '<div class="ml">No league games yet</div>';
}
function seasonCard() {
  const ups = D.upcoming || [], t = D.team || {};
  const chips = IDX.seasons.filter((x) => x.league === D.league).map((x) => `<button class="ss${x.seasonId === D.season ? ' on' : ''}" data-sid="${x.seasonId}">${esc(x.label)}</button>`).join('');
  let al = '';
  if (D.active) {
    for (const u of ups.filter((x) => x.status === 'published' && x.pos)) {
      al += `<div class="al pl"><div><b>You're playing ${LONG[u.dow]} ${u.mon} ${ord(u.day)} at ${esc((u.playing && u.playing.length ? u.playing : u.hours.map((x) => x.h)).join(' / '))}</b><span>${esc(POS[u.pos] || u.pos)}${u.opp ? ' vs ' + esc(u.opp) : ''}</span></div><button data-go="${u.nightId}">View</button></div>`;
    }
    if (D.managed === false) al += `<div class="al nm2"><div class="nm">${NOT_MANAGED}</div></div>`;
    const un = ups.filter((x) => x.answer == null);
    if (un.length) al += `<div class="al todo"><div><b>Enter your availability</b><span>${un.length} night${un.length > 1 ? 's' : ''} still need${un.length > 1 ? '' : 's'} your answer</span></div><button data-go="${un[0].nightId}">Set it now</button></div>`;
    else if (ups.length) al += `<div class="al ok"><div><b>Availability set</b><span>${ups.length} night${ups.length > 1 ? 's' : ''} answered</span></div><button data-go="${ups[0].nightId}">Review</button></div>`;
  }
  return `<span class="tab">SEASON</span><div class="in sn"><div class="sschips">${chips}${D.manage ? `<a class="mg" href="${esc(D.manage)}" target="_blank" rel="noopener">Manage &#8599;</a>` : ''}</div>
    <div class="sx"><div class="d2">${esc(D.league).toUpperCase()} &middot; ${esc(D.seasonLabel).toUpperCase()}</div><div class="tn">${esc(D.clubName)}</div>
      <div class="rc">${t.w}-${t.l}-${t.otl}</div><div class="d2">${D.games.length} GP &middot; GF ${t.gf} &middot; GA ${t.ga}</div></div>
    <div class="mine"><div class="mh">YOUR SEASON</div>${myLines()}</div>
    <div class="slogo a${Math.min(2, (al.match(/class="al /g) || []).length)}">${crest(D.logo, D.clubName)}</div>
    <div class="als">${al}</div></div>`;
}
function refreshSeason() { if (els[0]) els[0].innerHTML = seasonCard() + backCard(items[0]); }
// a team our bot does not manage: the imported calendar only, nothing to answer
// (elvis, Nov 21) the bot's name on a line of its own, with its logo
const NOT_MANAGED = `Availability and lineup are not managed by<span class="ett"><img src="/assets/logo-64.png" alt="">Elvi's Team Tracker</span>for this team. You may want to contact your team to use it.`;
function calNightCard(n) {
  const dt = `${n.dow.toUpperCase()} ${n.mon.toUpperCase()} ${n.day}`;
  return `${wkTab(n, dt)}<div class="in dv"><div class="big">${dt}</div><div class="d2">${n.games.length} GAME${n.games.length > 1 ? 'S' : ''} SCHEDULED</div>
    <div class="gms">${n.games.map((g) => `<i class="cl">${esc(g.time || 'TBD')}</i>`).join('')}</div></div>`;
}
function calCard(c) {
  const dt = `${c.dow.toUpperCase()} ${c.mon.toUpperCase()} ${c.day}`;
  return `<div class="in nt"><div class="strip"><span><b>${dt}</b>${c.time ? ` &middot; ${esc(c.time)}` : ''}</span><span>${c.phase === 'playoffs' ? 'PLAYOFFS' : c.week ? `WEEK ${c.week}` : 'COMING UP'}</span></div>
    <div class="nb"><div class="nk">${esc(D.league).toUpperCase()}</div><div class="vs">${c.home ? 'vs' : '@'} ${esc(c.opp)}</div>
      <div class="hrs"><i class="st">${esc(c.time || 'Time to be set')}</i></div><div class="lu no">SCHEDULED</div>
      <div class="nm">${NOT_MANAGED}</div></div></div>`;
}
function phaseCard(ph) {
  const gs = D.games.filter((g) => g.phase === ph);
  const w = gs.filter((g) => g.res === 'W').length, ot = gs.filter((g) => g.res === 'OTL').length;
  const nights = new Set(gs.map((g) => g.night)).size;
  const po = ph === 'playoffs';
  const ss = '';
  return `<span class="tab" style="${po ? 'background:#3a2a12;border-color:#9a6a22;color:#ffd48a' : ''}">${po ? 'PLAYOFFS' : 'SEASON'}</span><div class="in dv ph">${ss}<div class="d2">${esc(D.seasonLabel).toUpperCase()}</div>
    <div class="big">${po ? 'PLAYOFFS' : 'REGULAR SEASON'}</div>
    <div class="r2">${gs.length ? `${w}-${gs.length - w - ot}${ot ? '-' + ot : ''}` : ''}</div><div class="d2">${gs.length ? `${gs.length} GAMES &middot; ${nights} NIGHTS` : esc(wk(((D.upcoming || []).find((x) => x.phase === ph) || {}).weekLabel)).toUpperCase()}</div></div>`;
}
function backCard(it) {
  let l, r, big = '', sub = '';
  if (it.kind === 'game') {
    const g = it.g;
    l = `${g.me ? '&#9733; ' : ''}${g.dow.toUpperCase()} ${g.mon.toUpperCase()} ${g.day} &middot; ${esc(g.time)}`; r = `${g.gf}-${g.ga} ${g.res}`;
    big = `${g.dow.toUpperCase()} ${g.mon.toUpperCase()} ${g.day}`; sub = `${esc(g.time)} &middot; vs ${esc(g.opp)}`;
  } else if (it.kind === 'div') {
    const n = it.n, w = n.games.filter((x) => x.res === 'W').length;
    l = `${n.dow.toUpperCase()} ${n.mon.toUpperCase()} ${n.day}`; r = `${w}-${n.games.length - w}`;
    big = l; sub = `${n.games.length} game${n.games.length > 1 ? 's' : ''}`;
  } else if (it.kind === 'calnight') {
    const n = it.n;
    l = `${n.dow.toUpperCase()} ${n.mon.toUpperCase()} ${n.day}`; r = `${n.games.length} SCHEDULED`; big = l; sub = n.games.map((g) => g.time).join(' \u00b7 ');
  } else if (it.kind === 'cal') {
    const c = it.c;
    l = `${c.dow.toUpperCase()} ${c.mon.toUpperCase()} ${c.day}${c.time ? ` \u00b7 ${esc(c.time)}` : ''}`; r = 'SCHEDULED'; big = `${c.dow.toUpperCase()} ${c.mon.toUpperCase()} ${c.day}`; sub = `vs ${esc(c.opp)}`;
  } else if (it.kind === 'season') {
    l = 'SEASON'; r = esc(D.seasonLabel).toUpperCase(); big = esc(D.clubName);
  } else if (it.kind === 'night') {
    const u = it.u;
    l = `${u.dow.toUpperCase()} ${u.mon.toUpperCase()} ${u.day}`; r = u.status === 'published' ? ({ yes: 'IN + WARMUPS', game: 'GAME TIME', no: "CAN'T" }[u.confirm] || 'CONFIRM?') : ({ in: 'IN', out: 'OUT', maybe: 'MAYBE' }[u.answer] || 'NO ANSWER');
    big = l; sub = u.hours.map((x) => x.h).join(' · ');
  } else {
    l = it.ph === 'playoffs' ? 'PLAYOFFS' : 'REGULAR SEASON'; r = esc(D.seasonLabel).toUpperCase(); big = l;
  }
  return `<div class="back"><div class="bs"><b>${l}</b><span>${r}</span></div><div class="bb"><div class="bt">${big}</div><div class="bu">${sub}</div></div></div>`;
}
function renderItem(it) {
  if (it.kind === 'calnight') return calNightCard(it.n);
  if (it.kind === 'cal') return calCard(it.c);
  return it.kind === 'game' ? gameCard(it.g, BOX[it.g.matchId]) : it.kind === 'div' ? divCard(it.n) : it.kind === 'night' ? nightCard(it.u) : it.kind === 'season' ? seasonCard() : phaseCard(it.ph);
}
// the box scores: /game/{id}, two at a time, the cards nearest the active one first (the Manage page's way)
const BOXQ = []; let boxBusy = 0;
function wantBox(mid) { if (BOX[mid] !== undefined || BOXQ.includes(mid)) return; BOXQ.push(mid); pumpBox(); }
function pumpBox() {
  while (boxBusy < 2 && BOXQ.length) {
    const mid = BOXQ.shift(); boxBusy++; BOX[mid] = 'loading';
    get(`/game/${mid}`).then((b) => { BOX[mid] = b; }).catch(() => { BOX[mid] = { error: true }; })
      .finally(() => { boxBusy--; refreshGame(mid); pumpBox(); });
  }
}
function refreshGame(mid) {
  const i = items.findIndex((it) => it.kind === 'game' && String(it.g.matchId) === String(mid));
  if (i >= 0 && els[i]) els[i].innerHTML = renderItem(items[i]) + backCard(items[i]);
}
// only the cards around the active one (a season is 60 games: never all of them)
function queueBoxes() {
  const c = cur();
  for (let i = Math.max(0, c - 2); i <= Math.min(items.length - 1, c + 3); i++) {
    if (items[i] && items[i].kind === 'game') wantBox(items[i].g.matchId);
  }
}
// the app and a small phone: the whole page must fit (cards, Today, Earlier / Later), so the deck is scaled down
function fit() {
  const g = document.querySelector('.mlg'); if (!g) return;
  const top = $('sc').getBoundingClientRect().top + scrollY;
  const under = document.querySelector('.mlg .mlnav').offsetHeight + $('pos').offsetHeight + 14;
  const tabs = document.querySelector('.app-tabs');
  const room = innerHeight - top - under - (tabs ? tabs.getBoundingClientRect().height + 6 : 16);
  g.style.setProperty('--s', Math.max(0.5, Math.min(1, room / 740)).toFixed(3));
}
// the header can still grow after the first draw (the css arrives after this file, a league note wraps):
// fit again whenever it changes, and keep the scroll track the deck's height
function refit() {
  if (!$('sc')) return;
  fit();
  $('track').style.height = (Math.max(0, items.length - 1) * STEP() + $('sc').clientHeight) + 'px';
  if (els.length) paint();
}
new ResizeObserver(() => refit()).observe(document.querySelector('.mlg .top'));
addEventListener('load', refit);
function build() {
  fit();
  const nights = [];
  for (const g of D.games) {
    let n = nights[nights.length - 1];
    if (!n || n.night !== g.night) { n = { night: g.night, dow: g.dow, mon: g.mon, day: g.day, phase: g.phase, games: [] }; nights.push(n); }
    n.games.push(g);
  }
  items = [{ kind: 'season' }]; let ph = 'regular'; let lastWeek = null;
  const mark = (o, key, text) => { o.wkStart = key !== lastWeek; o.wkText = text; lastWeek = key; };
  for (const n of nights) {
    if (n.phase !== ph) { ph = n.phase; items.push({ kind: 'phase', ph }); }
    mark(n, 'w' + n.games[0].week, n.games[0].week ? `WEEK ${n.games[0].week}` : 'WEEK');
    items.push({ kind: 'div', n });
    for (const g of n.games) items.push({ kind: 'game', g });
  }
  for (const u of (D.upcoming || [])) {
    if (u.phase !== ph) { ph = u.phase; items.push({ kind: 'phase', ph }); }
    mark(u, 'l' + u.weekLabel, weekOfLabel(u.weekLabel));
    items.push({ kind: 'night', u });
  }
  let cn = null;
  for (const c of (D.calendar || [])) {
    if (c.phase !== ph) { ph = c.phase; items.push({ kind: 'phase', ph }); }
    if (!cn || cn.night !== c.night) { cn = { night: c.night, dow: c.dow, mon: c.mon, day: c.day, games: [] }; mark(cn, 'w' + c.week, c.week ? `WEEK ${c.week}` : 'WEEK'); items.push({ kind: 'calnight', n: cn }); }
    cn.games.push(c);
    items.push({ kind: 'cal', c });
  }
  const deck = $('deck'); deck.innerHTML = '';
  els = items.map((it) => {
    const e = document.createElement('div');
    e.className = 'it ' + (it.kind === 'game' ? it.g.res : it.kind === 'night' ? (it.u.status === 'published' && it.u.pos ? 'IN' : 'UP') : '');
    e.innerHTML = renderItem(it) + backCard(it);
    deck.appendChild(e); return e;
  });
  const sc = $('sc'), track = $('track');
  track.style.height = ((items.length - 1) * STEP() + sc.clientHeight) + 'px';
  sc.querySelectorAll('.snap').forEach((x) => x.remove());
  items.forEach((_, i) => { const x = document.createElement('div'); x.className = 'snap'; x.style.top = ((items.length - 1 - i) * STEP()) + 'px'; track.appendChild(x); });
  const w = D.games.filter((g) => g.res === 'W').length, ot = D.games.filter((g) => g.res === 'OTL').length;
  $('rec').innerHTML = `<b>${esc(D.clubName)}</b> &middot; ${w}-${D.games.length - w - ot}-${ot} &middot; ${D.games.length} games &middot; ${nights.length} nights${(D.upcoming || []).length + (D.calendar || []).length ? ` &middot; ${(D.upcoming || []).length + (D.calendar || []).length} coming` : ''}`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.tt button'); if (!b) return;
  const card = b.closest('.in'), body = card.querySelector('.body'), mid = body.dataset.mid;
  card.querySelectorAll('.tt button').forEach((x) => x.classList.toggle('on', x === b));
  const g = D.games.find((x) => String(x.matchId) === mid);
  body.innerHTML = sheet(g, BOX[mid], b.dataset.side);
});
function paint() {
  const sc = $('sc'), step = STEP();
  const p = Math.max(0, Math.min(items.length - 1, items.length - 1 - sc.scrollTop / step));
  els.forEach((e, i) => {
    const d = i - p;
    let tf, op = 1, z = 1000 - Math.round(Math.abs(d) * 10) + (d < 0 ? -2000 : 0);
    if (d >= 0) {
      const dd = Math.min(d, 6);
      tf = `translate3d(0,${-dd * 24}px,${-dd * 38}px) scale(${1 - dd * 0.035})`;
      op = d > 5 ? Math.max(0, 6 - d) : 1;
      e.style.transformOrigin = '50% 0%';
      e.classList.remove('fl');
    } else {
      const t = Math.min(1, -d), k = Math.max(0, -d - 1);
      tf = `translate3d(${k * 10}px,${k * 16}px,${Math.sin(t * Math.PI) * 70 - k * 3}px) rotateX(${-t * 180}deg)`;
      e.classList.toggle('fl', t > 0.5);
      e.classList.toggle('ld', t > 0.9);
      const sq = Math.max(0, Math.min(1, (t - 0.55) / 0.45));
      e.style.setProperty('--bf', 1);
      e.style.transformOrigin = '50% 100%';
      op = k > 2.4 ? 0 : 1;
      z = 3000 + Math.round(-d * -10);
    }
    e.style.transform = tf; e.style.opacity = op; e.style.zIndex = d < 0 ? 1100 - Math.round(-d * 10) : 1000 - Math.round(d * 10);
    e.style.visibility = op <= 0.01 ? 'hidden' : 'visible';
  });
  const cur = Math.round(p), it = items[cur];
  queueBoxes();
  $('pos').textContent = it ? (it.kind === 'game' ? `${it.g.dow} ${it.g.mon} ${it.g.day} - ${it.g.res} ${it.g.gf}-${it.g.ga}` : it.kind === 'div' ? `${it.n.dow} ${it.n.mon} ${it.n.day}` : it.kind === 'night' ? `${it.u.dow} ${it.u.mon} ${it.u.day} - coming up` : it.kind === 'calnight' ? `${it.n.dow} ${it.n.mon} ${it.n.day} - scheduled` : it.kind === 'cal' ? `${it.c.dow} ${it.c.mon} ${it.c.day} - vs ${it.c.opp}` : it.kind === 'season' ? 'Season' : (it.ph === 'playoffs' ? 'Playoffs' : 'Regular season')) : '';
}
let tk = false;
$('sc').addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(() => { paint(); tk = false; }); } });
function go(i) { $('sc').scrollTo({ top: (items.length - 1 - Math.max(0, Math.min(items.length - 1, i))) * STEP(), behavior: 'smooth' }); }
const cur = () => Math.round(items.length - 1 - $('sc').scrollTop / STEP());
const itemDate = (it) => (it.kind === 'game' ? it.g.night : it.kind === 'div' ? it.n.night : it.kind === 'night' ? it.u.night : it.kind === 'calnight' ? it.n.night : it.kind === 'cal' ? it.c.night : null);
const todayIso = () => new URLSearchParams(location.search).get('today') || new Date().toLocaleDateString('en-CA');
function todayIdx() { const t = todayIso(); const i = items.findIndex((it) => { const d = itemDate(it); return d && d >= t; }); return i < 0 ? items.length - 1 : i; }
$('today').onclick = () => go(todayIdx());
function syncNight(card, u) {
  card.querySelectorAll('.av button').forEach((x) => { x.classList.toggle('on', x.dataset.c ? isOnC(u, x.dataset.c) : isOn(u, x.dataset.a)); if (x.dataset.a) x.innerHTML = avLabel(u, x.dataset.a); });
  card.querySelectorAll('.hrs button').forEach((x, i) => x.classList.toggle('off', u.hours[i].out));
}
document.addEventListener('click', (e) => {
  const card = e.target.closest('.nt'); if (!card) return;
  const u = D.upcoming.find((x) => x.nightId === +card.querySelector('.av').dataset.nid);
  const b = e.target.closest('.av button'), h = e.target.closest('.hrs button');
  if (b) {
    if (b.dataset.c) u.confirm = b.dataset.c;
    else {
      const a = b.dataset.a;
      u.answer = a;
      if (a === 'in') u.hours.forEach((x) => { x.out = false; });
      if (a === 'out') u.hours.forEach((x) => { x.out = true; });
      if (a === 'maybe' && u.hours.every((x) => x.out)) u.hours.forEach((x) => { x.out = false; });
    }
  } else if (h) {
    const x = u.hours[+h.dataset.i]; x.out = !x.out;
    if (u.hours.every((y) => y.out)) u.answer = 'out'; else if (u.answer !== 'maybe') u.answer = 'in';
  } else return;
  syncNight(card, u); refreshSeason();
  save(u, b && b.dataset.c ? 'confirm' : 'answer');
  // every night needs his answer: after a button he is taken to the next night still waiting for one
  if (b && !b.dataset.c) advanceFrom(u);
});
// what he taps is saved at once (a burst of hour taps = one save, the last picture)
const saving = new Map();
function save(u, what) {
  clearTimeout(saving.get(u.nightId + what));
  saving.set(u.nightId + what, setTimeout(async () => {
    try {
      if (what === 'confirm') await post('/me/league/confirm', { nightId: u.nightId, answer: u.confirm });
      else await post('/me/league/answer', { nightId: u.nightId, answer: u.answer, out: u.hours.map((x) => !!x.out) });
    } catch (e) {
      toast(e.status === 403 ? 'You answer for this team in Discord first.' : 'Not saved. Try again in a moment.');
    }
  }, 350));
}
// auto-advance (Nov 21, elvis): a short beat, then the next night with no answer; none left = he is done
function advanceFrom(u) {
  setTimeout(() => {
    const here = items.findIndex((it) => it.kind === 'night' && it.u.nightId === u.nightId);
    const needs = (it) => it.kind === 'night' && it.u.status !== 'published' && it.u.answer == null;
    let i = items.findIndex((it, k) => k > here && needs(it));
    if (i < 0) i = items.findIndex(needs);
    if (i >= 0) go(i); else toast('All your availability is in. Thanks!');
  }, 900);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]'); if (!b) return;
  const i = items.findIndex((it) => it.kind === 'night' && it.u.nightId === +b.dataset.go);
  if (i >= 0) go(i);
});
// The mouse wheel (elvis, Nov 21): wheel DOWN drops the cards, like a finger pulling down on the phone. The
// native wheel would go the other way now that the deck reads the scroll reversed, so the wheel steps the
// deck itself, one card per notch (a trackpad's small deltas add up), the box score's sideways scroll untouched.
let wheelAcc = 0, wheelLock = 0, wheelTarget = null, wheelIdle;
$('sc').addEventListener('wheel', (e) => {
  if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  e.preventDefault();
  wheelAcc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
  clearTimeout(wheelIdle);
  wheelIdle = setTimeout(() => { wheelTarget = null; wheelAcc = 0; }, 450);
  const now = Date.now();
  if (now < wheelLock || Math.abs(wheelAcc) < 40) return;
  wheelTarget = Math.max(0, Math.min(items.length - 1, (wheelTarget ?? cur()) + (wheelAcc > 0 ? 1 : -1)));
  wheelAcc = 0;
  wheelLock = now + 220;
  go(wheelTarget);
}, { passive: false });
$('prev').onclick = () => go(cur() - 1); $('next').onclick = () => go(cur() + 1);
addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { go(cur() + 1); e.preventDefault(); } if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { go(cur() - 1); e.preventDefault(); } });
addEventListener('resize', () => { build(); paint(); });
let IDX = null, curSeason = null;
function leaguesOf() {
  const m = new Map();
  for (const x of IDX.seasons) if (!m.has(x.league)) m.set(x.league, x);
  return [...m.values()];
}
// The LG leagues (LG AHL, LG CHL, LG NHL...) share one pill with a sub-menu (elvis, Nov 21), but only when he
// plays in more than one of them: with a single LG league its own pill is enough.
const isLg = (x) => /^LG\b/i.test(x.league);
let famOpen = false;
function pillGroups() {
  const all = leaguesOf(), lg = all.filter(isLg);
  if (lg.length < 2) return all.map((x) => ({ x }));
  const out = []; let placed = false;
  for (const x of all) {
    if (!isLg(x)) out.push({ x });
    else if (!placed) { placed = true; out.push({ fam: 'LG', items: lg }); }
  }
  return out;
}
const lgImg = (x) => (x.leagueLogo ? `<img class="lgl" src="${esc(x.leagueLogo)}" alt="">` : '');
function renderPicker() {
  const sel = IDX.seasons.find((x) => x.seasonId === curSeason);
  const pill = (x) => `<button class="chip${x.league === sel.league ? ' on' : ''}" data-sid="${x.seasonId}">${lgImg(x)}${esc(x.league)}</button>`;
  const groups = pillGroups();
  const fam = groups.find((g) => g.fam);
  const inFam = !!fam && fam.items.some((x) => x.league === sel.league);
  $('chips').innerHTML = `<div class="pk">${groups.map((g) => (g.fam
      ? `<button class="chip fam${inFam ? ' on' : ''}" data-fam="${g.fam}">${lgImg(g.items[0])}${g.fam} <span class="caret">&#9662;</span></button>`
      : pill(g.x))).join('')}</div>`
    + (fam && (famOpen || inFam) ? `<div class="pk sub">${fam.items.map(pill).join('')}</div>` : '')
    + (sel.otherTeams.length ? `<div class="alt">Also played for ${sel.otherTeams.map((t) => esc(t.name)).join(', ')} this season &mdash; see My teams</div>` : '');
}
document.addEventListener('click', (e) => {
  const f = e.target.closest('.chip[data-fam]'); if (!f) return;
  famOpen = !famOpen; renderPicker();
});
async function pick(sid, front, focusNight) {
  curSeason = sid;
  BOXQ.length = 0;
  D = await get(`/me/league?season=${sid}`);
  $('today').style.display = D.active ? '' : 'none';
  renderPicker(); document.querySelector('.chip.on')?.scrollIntoView({ inline: 'center', block: 'nearest' }); build();
  const sc = $('sc'); sc.style.scrollSnapType = 'none';
  const at = focusNight ? items.findIndex((it) => it.kind === 'night' && it.u.nightId === focusNight) : -1;
  sc.scrollTop = (items.length - 1 - (at >= 0 ? at : (front || !D.active) ? 0 : todayIdx())) * STEP();
  paint();
  queueBoxes();
  requestAnimationFrame(() => { sc.style.scrollSnapType = 'y mandatory'; });
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.chip[data-sid], .ss[data-sid]'); if (!b) return;
  // the pill already on (or this season's own pill): back to the front page of the deck (elvis, Nov 21)
  if (b.classList.contains('on') || +b.dataset.sid === curSeason) { go(items.length ? 0 : 0); return; }
  const target = IDX.seasons.find((x) => x.seasonId === +b.dataset.sid);
  if (target && !isLg(target)) famOpen = false;
  pick(+b.dataset.sid, true);
});
// a notification's link: ?night=<id> opens the season of that night's league, on that night
const wantNight = new URLSearchParams(location.search).get('night');
get('/me/leagues' + (wantNight && /^\d{1,12}$/.test(wantNight) ? `?night=${wantNight}` : '')).then((ix) => {
  IDX = ix;
  if (!IDX.seasons.length) { $('rec').textContent = 'No league games yet this era.'; $('today').style.display = 'none'; return; }
  return ix.focus ? pick(ix.focus, false, ix.focusNight) : pick(IDX.seasons[0].seasonId);
}).catch(() => { $('rec').textContent = 'Could not load your leagues. Try again in a minute.'; });
