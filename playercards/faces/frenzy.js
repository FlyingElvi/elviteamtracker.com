// The frenzy face (Oct 19) -- port of PlayerCard.renderFrenzy (the one with
// the Elo), drawn from the API's JSON: the silverware, the career lines, the
// raffle and Mix 'Em Up rows, then the last few tournaments. Same
// coordinates as the Java, y = baseline like drawString.

/** PlayerCard.ordinal(): 1st, 2nd, 3rd, 11th..., a dash when unknown. */
function ordinal(aFinish) {
  if (aFinish <= 0) return '—';
  const lastTwo = aFinish % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${aFinish}th`;
  switch (aFinish % 10) {
    case 1: return `${aFinish}st`;
    case 2: return `${aFinish}nd`;
    case 3: return `${aFinish}rd`;
    default: return `${aFinish}th`;
  }
}

/**
 * drawTicket(): a raffle ticket right-aligned on aRight, gold with the
 * entries or grey with "not eligible". The side notches are CUT (Java
 * subtracts two circles from the round rect), so the path walks a half
 * circle into each short edge and the row's tint shows through.
 */
function ticket(k, aText, anEligible, aRight, aTop) {
  const h = 26;
  const size = anEligible ? 18 : 14;
  const textW = k.measure(aText, size, true);
  const stub = 16;
  const w = stub + 12 + textW + 14;
  const left = aRight - w;
  const r = 5;
  const c = 3; // arc 6 = radius 3
  const cy = aTop + h / 2;
  const bottom = aTop + h;
  const d = `M${left + c},${aTop}H${aRight - c}A${c},${c} 0 0 1 ${aRight},${aTop + c}`
    + `V${cy - r}A${r},${r} 0 0 0 ${aRight},${cy + r}`
    + `V${bottom - c}A${c},${c} 0 0 1 ${aRight - c},${bottom}H${left + c}`
    + `A${c},${c} 0 0 1 ${left},${bottom - c}V${cy + r}A${r},${r} 0 0 0 ${left},${cy - r}`
    + `V${aTop + c}A${c},${c} 0 0 1 ${left + c},${aTop}Z`;
  const gid = `${k.id}-fz-ticket`;
  const [top, bot] = anEligible ? ['#F0C24A', '#C9961C'] : ['#C4C4BE', '#A9A9A3'];
  k.defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${aTop}" x2="0" y2="${bottom}">`
    + `<stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient>`);
  k.out.push(`<path d="${d}" fill="url(#${gid})"/>`);
  // The perforation between the stub and the body, and the stub's star.
  const white = `rgba(255,255,255,${k.al(150)})`;
  k.out.push(`<line x1="${left + stub}" y1="${aTop + 4}" x2="${left + stub}" y2="${bottom - 4}"`
    + ` stroke="${white}" stroke-width="1.5" stroke-dasharray="3 3"/>`);
  k.out.push(k.text('★', left + 4, aTop + Math.floor(h / 2) + 4, { size: 10, bold: true, fill: white }));
  k.out.push(k.text(aText, left + stub + 12, aTop + (anEligible ? 20 : 18),
    { size, bold: true, fill: anEligible ? '#3A2A05' : '#fff' }));
}

export default function draw(k, d) {
  const { C, W, out, text, rr, al } = k;
  // aDiscordName is always null on the web: the banner is the player's name.
  k.innerHead();
  const tint = `rgba(0,0,0,${al(10)})`;

  // 268 clears the name banner.
  let y = 268;
  // The silverware first, and only what they actually hold.
  const champs = d.championships ?? 0;
  const mvps = d.mvps ?? 0;
  if (champs > 0 || mvps > 0) {
    const titles = [];
    if (champs > 0) titles.push(`${champs > 1 ? `${champs}× ` : ''}FRENZY CHAMPION`);
    if (mvps > 0) titles.push(`${mvps > 1 ? `${mvps}× ` : ''}FRENZY MVP`);
    titles.forEach((title) => {
      // A drawn disc with a star, not an emoji (fillOval(66, y - 19, 22, 22)).
      out.push(`<circle cx="77" cy="${y - 8}" r="11" fill="#B8860B"/>`);
      out.push(text('★', 71, y - 3, { size: 14, bold: true, fill: C.paper }));
      out.push(text(title, 100, y, { size: 24, bold: true, fill: C.ink }));
      y += 36;
    });
    y += 14;
  }

  out.push(text('ALL TOURNAMENTS', 78, y, { size: 20, bold: true, fill: '#8A8A85' }));
  y += 14;
  (d.totals ?? []).forEach((total) => {
    out.push(`<path d="${rr(56, y, W - 112, 34, 5)}" fill="${tint}"/>`);
    out.push(text(total[0], 66, y + 24, { size: 19, bold: true, fill: C.ink }));
    out.push(text(total[1], 540, y + 24, { size: 20, bold: true, fill: C.ink, anchor: 'end' }));
    y += 38;
  });

  // The raffle, one row under the career: played, bonus, since when, and the
  // entries on a ticket.
  const raffle = d.raffle;
  if (raffle) {
    out.push(`<path d="${rr(56, y, W - 112, 34, 5)}" fill="${tint}"/>`);
    const played = raffle.played ?? 0;
    const bonus = Math.floor(played / 5);
    const counts = [[played, 'played'], [bonus, 'bonus']];
    if (raffle.since != null) counts.push(['', `since ${raffle.since}`]);
    let x = 66;
    counts.forEach(([n, label], i) => {
      if (i > 0) {
        out.push(text('·', x + 2, y + 24, { size: 17, fill: '#B0B0AA' }));
        x += 16;
      }
      const num = String(n);
      out.push(text(num, x, y + 24, { size: 19, bold: true, fill: C.ink }));
      x += k.measure(num, 19, true) + 5;
      out.push(text(label, x, y + 24, { size: 16, fill: '#6A6A65' }));
      x += k.measure(label, 16, false) + 6;
    });
    ticket(k, raffle.eligible ? String(played + bonus) : 'not eligible', !!raffle.eligible, 540, y + 4);
    y += 38;
  }

  // The Mix 'Em Up ELO, one row like the raffle's -- only once they have one.
  const elo = d.elo;
  if (elo) {
    out.push(`<path d="${rr(56, y, W - 112, 34, 5)}" fill="${tint}"/>`);
    out.push(text("MIX 'EM UP ELO", 66, y + 24, { size: 19, bold: true, fill: C.ink }));
    out.push(text(`${elo.games} GP  ·  ${elo.w}-${elo.l}`, 66 + 170, y + 24, { size: 16, fill: '#6A6A65' }));
    out.push(text(String(elo.rating), 540, y + 25, { size: 24, bold: true, fill: '#1B5E8A', anchor: 'end' }));
    y += 38;
  }

  y += 26;
  out.push(text('RECENT', 78, y, { size: 20, bold: true, fill: '#8A8A85' }));
  out.push(text('RTG · newest first', 540, y, { size: 15, fill: '#8A8A85', anchor: 'end' }));
  y += 14;

  // However many fit in what the titles and totals left, capped at five.
  const room = Math.max(0, Math.trunc((664 - y) / 38));
  const tourneys = (d.tourneys ?? []).slice(0, Math.min(5, room));
  tourneys.forEach((line, i) => {
    if (i % 2 === 0) out.push(`<path d="${rr(56, y, W - 112, 34, 5)}" fill="${tint}"/>`);
    const ty = y + 24;
    out.push(text(String(line.rtg), 66, ty, { size: 26, bold: true,
      fill: line.hot > 0 ? '#1B7F3B' : line.hot < 0 ? '#B3261E' : C.ink }));
    // Gold for a win, silver for the lost final, grey otherwise.
    out.push(text(ordinal(line.finish), 118, ty - 1, { size: 18, bold: true,
      fill: line.finish === 1 ? '#B8860B' : line.finish === 2 ? '#7A7A75' : '#9A9A95' }));
    // Four columns on one row, so the title gets a hard width.
    out.push(text(k.trim(line.title, 18, false, 132), 168, ty, { size: 18, fill: C.ink }));
    out.push(text(line.record, 306, ty, { size: 16, fill: '#6A6A65' }));
    out.push(text(line.statLine, 540, ty, { size: 18, bold: true, fill: C.ink, anchor: 'end' }));
    y += 38;
  });
}
