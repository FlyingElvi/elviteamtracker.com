// The ticker builder (Nov 25, elvis) -- see ticker.html.
//
// Signed in: the user's tickers, one editor (name, discord, extra teams,
// leagues) and the OBS url a save gives (scores.html?c=CODE). Everything is
// kept by the API (/me/tickers); the page only draws it. Names come from the
// database, so they only ever reach the DOM as text.

import { mountAuth, loginUrl, API_BASE } from './auth.js?v=9883a712ed';

const app = document.getElementById('app');

/** A tiny element builder: h('div', {class: 'x'}, 'text', child...). */
function h(aTag, aProps, ...aKids) {
  const el = document.createElement(aTag);
  for (const [k, v] of Object.entries(aProps ?? {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of aKids.flat()) if (kid != null) el.append(kid);
  return el;
}

async function call(aPath, aBody) {
  const init = aBody === undefined
    ? { credentials: 'include', cache: 'no-store' }
    : {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-ETT': '1' },
      body: JSON.stringify(aBody),
    };
  const r = await fetch(`${API_BASE}${aPath}`, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

const me = await mountAuth();

if (!me.signedIn) {
  app.replaceChildren(h('div', { class: 'tk-gate' },
    h('p', null, me.available === false
      ? 'Sign-in isn\'t available right now — try again in a minute.'
      : 'Sign in with Discord to build your ticker.'),
    me.available === false ? null : h('a', { class: 'tk-btn primary', href: loginUrl() }, 'Sign in with Discord')));
} else {
  await run();
}

async function run() {
  let data;
  try {
    data = await call('/me/tickers');
  } catch (anErr) {
    app.replaceChildren(h('p', { class: 'tk-note' }, `Couldn't load your tickers: ${anErr.message}`));
    return;
  }
  const state = { tickers: data.tickers, sel: data.tickers[0]?.code ?? null, draft: null };

  const blank = () => ({ code: null, name: '', guildId: null, teams: [], leagues: [] });
  const current = () => state.draft ?? state.tickers.find((t) => t.code === state.sel) ?? null;

  function draw() {
    const list = h('div', { class: 'tk-list' },
      state.tickers.map((t) => h('button', {
        type: 'button', class: 'tk-item', 'aria-current': String(!state.draft && t.code === state.sel),
        onclick: () => { state.sel = t.code; state.draft = null; draw(); },
      }, t.name || 'Untitled ticker', h('small', null, summary(t)))),
      state.tickers.length < data.max
        ? h('button', { type: 'button', class: 'tk-btn', onclick: () => { state.draft = blank(); draw(); } }, '+ New ticker')
        : h('p', { class: 'tk-note' }, `Limit of ${data.max} tickers.`));
    const t = current();
    app.replaceChildren(h('div', { class: 'tk-grid' }, list,
      t ? editor(t) : h('div', { class: 'tk-edit' }, h('p', { class: 'tk-note' },
        'No ticker yet — start with “New ticker”.'))));
  }

  const summary = (t) => {
    const bits = [];
    if (t.guildName) bits.push(t.guildName);
    if (t.teams.length) bits.push(`${t.teams.length} team${t.teams.length > 1 ? 's' : ''}`);
    if (t.leagues.length) bits.push(`${t.leagues.length} league${t.leagues.length > 1 ? 's' : ''}`);
    return bits.join(' · ') || 'empty';
  };

  function editor(t) {
    // Work on a copy: nothing is saved until Save.
    const f = { code: t.code, name: t.name, guildId: t.guildId, teams: [...t.teams], leagues: [...t.leagues] };
    const note = h('p', { class: 'tk-note', role: 'status' });
    const chips = h('div', { class: 'tk-chips' });
    const found = h('div', { class: 'tk-found' });
    const drawChips = () => chips.replaceChildren(...f.teams.map((c) => h('span', { class: 'tk-chip' }, c.name,
      h('button', {
        type: 'button', 'aria-label': `Remove ${c.name}`,
        onclick: () => { f.teams = f.teams.filter((x) => x.id !== c.id); drawChips(); },
      }, '×'))));
    drawChips();

    let timer = 0;
    const search = h('input', {
      type: 'search', placeholder: 'Search a club by name…', autocomplete: 'off',
      oninput: () => {
        clearTimeout(timer);
        const q = search.value.trim();
        if (q.length < 2) { found.replaceChildren(); return; }
        timer = setTimeout(async () => {
          try {
            const j = await call(`/me/ticker/clubs?q=${encodeURIComponent(q)}`);
            if (search.value.trim() !== q) return;
            const fresh = j.clubs.filter((c) => !f.teams.some((x) => x.id === c.id));
            found.replaceChildren(...(fresh.length
              ? fresh.map((c) => h('button', {
                type: 'button',
                onclick: () => {
                  if (f.teams.length >= 20) { note.textContent = 'Up to 20 teams.'; return; }
                  f.teams.push(c); drawChips(); found.replaceChildren(); search.value = '';
                },
              }, c.name))
              : [h('p', { class: 'tk-note' }, 'No tracked club with that name.')]));
          } catch (anErr) {
            found.replaceChildren(h('p', { class: 'tk-note' }, anErr.message));
          }
        }, 250);
      },
    });

    const guildSel = h('select', { onchange: () => { f.guildId = guildSel.value || null; } },
      h('option', { value: '' }, '— none —'),
      data.guilds.map((g) => h('option', { value: g.guildId, selected: g.guildId === f.guildId }, g.name || g.guildId)));

    const leagueBoxes = h('div', { class: 'tk-leagues' }, data.leagues.map((name) => {
      const box = h('input', {
        type: 'checkbox', checked: f.leagues.includes(name),
        onchange: () => { f.leagues = box.checked ? [...f.leagues, name] : f.leagues.filter((x) => x !== name); },
      });
      return h('label', null, box, name);
    }));

    const urlBox = h('div', { class: 'tk-url' });
    const drawUrl = (code) => {
      if (!code) { urlBox.replaceChildren(); return; }
      const url = `${location.origin}/playercards/scores.html?c=${code}`;
      const copy = h('button', {
        type: 'button', class: 'tk-btn',
        onclick: async () => {
          try { await navigator.clipboard.writeText(url); copy.textContent = 'Copied ✓'; }
          catch { copy.textContent = 'Select it and copy'; }
          setTimeout(() => { copy.textContent = 'Copy the URL'; }, 2000);
        },
      }, 'Copy the URL');
      urlBox.replaceChildren(
        h('div', { class: 'lbl', style: 'font-weight:600' }, 'Your OBS URL'),
        h('code', null, url), copy,
        h('ul', null,
          h('li', null, 'In OBS: add a Browser source with this URL — 1664 × 40 along the bottom (or 1920 × 40 full width).'),
          h('li', null, 'Custom CSS: ', h('code', { style: 'display:inline;padding:2px 6px' },
            'body { margin: 0 auto; overflow: hidden; }')),
          h('li', null, 'Options to add at the end: ', h('code', { style: 'display:inline;padding:2px 6px' },
            '&fs=24'), ' text size, ', h('code', { style: 'display:inline;padding:2px 6px' },
            '&bg=transparent'), ' no backdrop, ', h('code', { style: 'display:inline;padding:2px 6px' },
            '&speed=90'), ' scroll speed.'),
          h('li', null, 'The code stays the same when you change the settings here — no need to touch OBS.')));
    };
    drawUrl(f.code);

    const save = h('button', { type: 'button', class: 'tk-btn primary' }, f.code ? 'Save changes' : 'Create ticker');
    const nameInput = h('input', { type: 'text', maxlength: '40', value: f.name, placeholder: 'e.g. Main scene',
      oninput: () => { f.name = nameInput.value; } });
    save.addEventListener('click', async () => {
      save.disabled = true;
      note.textContent = '';
      try {
        const saved = await call('/me/tickers', {
          code: f.code, name: f.name, guildId: f.guildId,
          teams: f.teams.map((c) => c.id), leagues: f.leagues,
        });
        const i = state.tickers.findIndex((x) => x.code === saved.code);
        if (i >= 0) state.tickers[i] = saved; else state.tickers.push(saved);
        state.sel = saved.code;
        state.draft = null;
        draw();
      } catch (anErr) {
        note.textContent = `Couldn't save: ${anErr.message}`;
        save.disabled = false;
      }
    });

    const del = f.code ? h('button', {
      type: 'button', class: 'tk-btn danger',
      onclick: async () => {
        if (!confirm('Delete this ticker?\n\nThe OBS source using its URL will show nothing.')) return;
        try {
          await call('/me/tickers/delete', { code: f.code });
          state.tickers = state.tickers.filter((x) => x.code !== f.code);
          state.sel = state.tickers[0]?.code ?? null;
          draw();
        } catch (anErr) {
          note.textContent = `Couldn't delete: ${anErr.message}`;
        }
      },
    }, 'Delete') : null;

    return h('div', { class: 'tk-edit' },
      h('h2', null, f.code ? 'Edit ticker' : 'New ticker'),
      h('div', { class: 'tk-field' }, h('label', null, 'Name'),
        h('p', { class: 'hint' }, 'Only for you — one ticker per OBS scene, say.'), nameInput),
      h('div', { class: 'tk-field' }, h('label', null, 'Your discord'),
        h('p', { class: 'hint' }, 'Its primary and affiliate clubs fill the bar, with their games posted there.'), guildSel),
      h('div', { class: 'tk-field' }, h('label', null, 'More teams'),
        h('p', { class: 'hint' }, 'Any club the bot tracks: its games show on the bar and its finals raise a score alert.'),
        search, found, chips),
      h('div', { class: 'tk-field' }, h('span', { class: 'lbl' }, 'Leagues'),
        h('p', { class: 'hint' }, 'The other teams’ finals of these leagues come as “Around the league”.'), leagueBoxes),
      h('div', { class: 'tk-actions' }, save, del, note),
      urlBox);
  }

  draw();
}
