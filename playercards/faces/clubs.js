// The clubs face (Oct 19) -- port of PlayerCard.renderClubsFace, drawn from
// the API's JSON (d.payload = MatchRepository.playerClubsFace, each club with
// its `tracked` flag). Same coordinates as the Java; the web always sends the
// All-games lens, but a modeLabel is still honoured if one ever arrives.

/** Java's clean(): drop what the card font can't draw (emoji, ZWJ, variation
 *  selectors -- approximated, the browser has no canDisplay) and collapse the
 *  leftover whitespace ("G L A D  II A T O R S" -> single spaces). */
function clean(aText) {
  if (aText == null) return null;
  const out = String(aText)
    .replace(/[‍️]|\p{Extended_Pictographic}/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return out || null;
}

export default function draw(k, d) {
  const { C, W, text } = k;
  const pay = d.payload ?? {};

  // Header: top stats (or the sticker), panel, banner. aDiscordName is
  // always null on the web, so the banner is the player name.
  k.innerHead();

  let y = 268;
  k.out.push(text('CLUBS', 78, y, { size: 20, bold: true, fill: C.muted }));

  const total = pay.total ?? 0;
  k.out.push(text(`${total} game${total === 1 ? '' : 's'} tracked`, 66, y + 34,
    { size: 26, bold: true, fill: C.ink }));
  // The split by format; under a lens the line names it instead.
  k.out.push(text(pay.modeLabel != null ? `${pay.modeLabel} only`
    : `public 6s ${pay.sixes ?? 0}   ·   3s ${pay.threes ?? 0}   ·   private ${pay.privates ?? 0}`,
  66, y + 60, { size: 16, fill: C.muted }));
  y += 84;

  // ── CLUBS PLAYED: up to 8 rows, striped, ● tracked / ○ not ────────────
  const clubs = Array.isArray(pay.clubs) ? pay.clubs : [];
  k.out.push(text('CLUBS PLAYED', 66, y + 24, { size: 17, bold: true, fill: C.muted }));
  k.out.push(text('● tracked   ○ not tracked', 534, y + 24, { size: 13, fill: C.muted, anchor: 'end' }));
  y += 36;
  if (clubs.length === 0) {
    k.out.push(text('No game tracked yet — track your club with the button below.', 66, y + 22,
      { size: 16, fill: C.muted }));
    y += 30;
  }
  clubs.slice(0, 8).forEach((club, i) => {
    const tracked = club.tracked === true;
    if (i % 2 === 0) {
      k.out.push(`<path d="${k.rr(56, y + 2, W - 112, 26, 4)}" fill="rgba(0,0,0,${k.al(10)})"/>`);
    }
    k.out.push(text(tracked ? '●' : '○', 66, y + 21,
      { size: 16, bold: true, fill: tracked ? C.ink : '#9A9A95' }));
    const name = clean(club.name) ?? '?';
    k.out.push(text(k.trim(name, 17, false, 370), 92, y + 21, { size: 17, fill: C.ink }));
    k.out.push(text(`${club.games ?? 0} GP`, 534, y + 21, { size: 17, bold: true, fill: C.ink, anchor: 'end' }));
    y += 28;
  });
  if (clubs.length > 8) {
    k.out.push(text(`…and ${clubs.length - 8} more`, 92, y + 18, { size: 14, fill: C.muted }));
  }

  // The pitch, above the logo circle (y≈674).
  k.out.push(text('Play for several clubs? Track them all — every game counts.', 66, 656,
    { size: 14, fill: C.muted }));
}
