// The streaks face (Oct 19) -- port of PlayerCard.renderStreaks, drawn from
// the API's JSON: d.rows = StreakComputer.faceRows ({label, current, best,
// gray, recordCount, recordHolder, holderIsMe}), d.modeLabel = the format lens.
// LIVE runs chase the era record with a green bar; a gray row is a broken
// streak whose record the player still holds.

/** Java's (Integer) row.get(...), forgiving a missing value. */
const int = (v) => (Number.isFinite(+v) ? Math.trunc(+v) : 0);

/** SVG collapses runs of spaces; Java keeps them. NBSP has the same advance. */
const keep = (s) => s.replace(/ {2,}/g, (m) => ' '.repeat(m.length));

export default function draw(k, d) {
  const { C, W, out, text, rr, measure, trim, al } = k;
  // Header: sticker or POS, OVR, panel, banner (aDiscordName is null on the web).
  k.innerHead();

  let y = 268;
  out.push(text(`GAME STREAKS (${d.modeLabel ?? 'All modes'})`, 78, y,
    { size: 20, bold: true, fill: C.muted }));
  y += 16;

  const rows = Array.isArray(d.rows) ? d.rows : [];
  if (rows.length === 0) {
    out.push(text('No live streak right now.', 66, y + 34, { size: 22, bold: true, fill: C.ink }));
    out.push(text('Two in a row starts one — go get it.', 66, y + 62, { size: 18, fill: '#6A6A65' }));
  }
  for (let i = 0; i < rows.length && y < 636; i++) {
    const row = rows[i];
    const gray = row.gray === true;
    const mine = row.holderIsMe === true;
    const best = int(row.best);
    const shown = gray ? best : int(row.current);
    const record = Math.max(1, int(row.recordCount));
    out.push(`<path d="${rr(56, y, W - 112, 58, 5)}" fill="rgba(0,0,0,${al(10)})"/>`);

    // Label + the count, then the chase bar, then whose record it is.
    out.push(text(trim(row.label ?? '', 19, true, 268), 66, y + 24,
      { size: 19, bold: true, fill: gray ? C.muted : C.ink }));
    const count = `${shown} / ${record}`;
    const countW = Math.round(measure(count, 18, true));
    out.push(text(count, 540, y + 24, { size: 18, bold: true, fill: gray ? C.muted : C.ink, anchor: 'end' }));
    const barX = 340;
    const barW = 540 - barX - countW - 14;
    out.push(`<path d="${rr(barX, y + 12, barW, 12, 3)}" fill="rgba(0,0,0,${al(25)})"/>`);
    if (shown > 0) {
      const fillW = Math.max(12, Math.trunc(barW * Math.min(1, shown / record)));
      out.push(`<path d="${rr(barX, y + 12, fillW, 12, 3)}" fill="${gray ? '#9A9A95' : C.win}"/>`);
    }

    // The personal-best notch on the bar: where YOUR high-water mark sits on
    // the road to the record (only when it isn't either end).
    if (best > shown && best < record) {
      const notchX = barX + Math.trunc(barW * (best / record));
      out.push(`<rect x="${notchX - 1}" y="${y + 8}" width="3" height="20" fill="#4A4A45"/>`);
    }

    // "era" stays backstage vocabulary -- players just see "record".
    let sub = mine ? '★ record is YOURS' : `record ${record} — ${row.recordHolder ?? '?'}`;
    if (!mine && best > shown) sub += `   ·   your best ${best}`;
    out.push(text(keep(sub), 66, y + 47, { size: 15, fill: mine ? C.gold : '#6A6A65' }));
    y += 66;
  }
}
