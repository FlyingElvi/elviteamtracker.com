// The duels face (Nov 5) -- port of PlayerCard.renderDuelsFace, drawn from
// the API's JSON (ApiServer.webDuelsFace), already worded server-side:
//
// d = { wins, losses, draws, sent, received,
//       live: null | { subject, line, invited, iChallenge, windowGames,
//                      me: {total, games} | undefined, others: [{name, total, games}] },
//       recent: [{ mark: 'W'|'L'|'D', line }] }
//
// The badge is FlyingElvi's art (art/duel-badge.png, square): the two rings
// carry the counters, duels SENT on the left, RECEIVED on the right.

const BADGE = 'art/duel-badge.png';

/** PlayerCard.n(): a number, or a dash for "nothing yet". */
const n = (v) => (v == null ? '–' : String(v));

/** drawDuelsBadge + ringNumber: the art, then one dark coin and a light
 *  number in each ring, at the centres measured on the art. */
function badge(k, aSent, aReceived) {
  const w = 132;
  const x = 30;
  const y = 6;
  const h = w; // the art is square
  k.out.push(`<image href="${BADGE}" x="${x}" y="${y}" width="${w}" height="${h}"/>`);
  const ring = (aText, aCx, aCy) => {
    const r = w * 0.172;
    k.out.push(`<circle cx="${aCx}" cy="${aCy}" r="${r}" fill="#14161B"/>`);
    let size = 24;
    while (k.measure(aText, size, true) > r * 1.5 && size > 11) size -= 2;
    // Java centres on getAscent()/2 - 3; DejaVu's ascent is 0.928 em.
    const ty = aCy + (size * 0.928) / 2 - 3;
    k.out.push(k.text(aText, aCx, ty, { size, bold: true, fill: '#EAF2FF', anchor: 'middle' }));
  };
  ring(String(aSent), x + w * 0.2952, y + h * 0.4393);
  ring(String(aReceived), x + w * 0.7008, y + h * 0.4393);
}

export default function draw(k, d) {
  const { p, C, W, out, text } = k;
  const MUTED = '#8A8A85';
  const PURPLE = '#7A3FB5';
  const sent = d.sent ?? 0;
  const received = d.received ?? 0;

  // ── the head: the duel badge owns the corner on this face ────────────
  k.topStats(null);
  badge(k, sent, received);
  k.panel();
  k.banner(p.name ?? '?', 170);

  let y = 268;
  out.push(text('DUELS', 78, y, { size: 20, bold: true, fill: MUTED }));
  y += 16;
  out.push(text(`Duel record  ${d.wins ?? 0}-${d.losses ?? 0}-${d.draws ?? 0}`, 66, y + 34,
    { size: 26, bold: true, fill: C.ink }));
  out.push(text(`${sent} sent · ${received} received`, 540, y + 34, { size: 15, fill: MUTED, anchor: 'end' }));
  y += 62;

  // ── the live duel, or the invitation ─────────────────────────────────
  const live = d.live;
  if (live) {
    const titled = !!(live.subject && String(live.subject).trim());
    out.push(`<path d="${k.rr(56, y, W - 112, titled ? 140 : 118, 10)}" fill="rgba(0,0,0,${k.al(10)})"/>`);
    if (titled) {
      out.push(text(k.trim(`“${live.subject}”`, 18, true, W - 140), 66, y + 24, { size: 18, bold: true, fill: PURPLE }));
      y += 26;
    }
    out.push(text(k.trim(live.line ?? '', 20, true, W - 140), 66, y + 28, { size: 20, bold: true, fill: C.ink }));
    const wg = live.windowGames ?? 0;
    if (live.invited) {
      out.push(text(live.iChallenge ? 'invitation sent — waiting on them'
        : 'they challenged YOU — answer on the duel post', 66, y + 58, { size: 17, fill: MUTED }));
    } else {
      const me = live.me;
      const opp = (live.others ?? []).map((s) => `${s.name}  ${n(s.total)} (${n(s.games)}/${wg})`).join('   ·   ');
      out.push(text(`you   ${me ? n(me.total) : '?'}   (${me ? n(me.games) : '?'}/${wg} games)`, 66, y + 60,
        { size: 18, bold: true, fill: PURPLE }));
      out.push(text(k.trim(opp, 18, true, W - 140), 66, y + 88, { size: 18, bold: true, fill: '#6A6A65' }));
      out.push(text(`${(live.others ?? []).length > 1 ? 'all three' : 'both'} windows full = the duel settles on the next sweep`,
        66, y + 110, { size: 14, fill: MUTED }));
    }
    y += 132;
  } else {
    out.push(text('No live duel.', 66, y + 26, { size: 18, bold: true, fill: MUTED }));
    out.push(text('Challenge someone with the button under the card.', 66, y + 52, { size: 16, fill: MUTED }));
    y += 76;
  }

  // ── RECENT DUELS ─────────────────────────────────────────────────────
  const recent = Array.isArray(d.recent) ? d.recent : [];
  if (recent.length) {
    out.push(text('RECENT DUELS', 66, y + 24, { size: 17, bold: true, fill: MUTED }));
    y += 36;
    for (const r of recent) {
      if (y > 640) break;
      const fill = r.mark === 'D' ? '#B8860B' : r.mark === 'W' ? '#1F7A33' : '#B3362C';
      out.push(text(r.mark, 66, y + 20, { size: 18, bold: true, fill }));
      out.push(text(k.trim(r.line ?? '', 16, false, W - 170), 92, y + 20, { size: 16, fill: C.ink }));
      y += 30;
    }
  }
}
