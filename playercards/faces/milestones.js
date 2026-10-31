// The milestones face (Oct 19) -- port of PlayerCard.renderMilestonesFace,
// drawn from the API's JSON (ApiServer.webFaceData: rows = MilestoneEngine.faceRows,
// hiddenCount = MilestoneEngine.hiddenCount). The player's DISCOVERED families
// only, each row a chase: the counter, a purple bar toward the next rung, and
// who leads the family. Same coordinates as the Java.

/** Java String.format("%,d", n). */
const num = (n) => Math.trunc(Number(n) || 0).toLocaleString('en-US');

export default function draw(k, d) {
  const { C, W, out, text, rr, measure, trim, al } = k;
  const rows = Array.isArray(d.rows) ? d.rows : [];
  const hidden = Number(d.hiddenCount) || 0;

  // Header: the Discord display name is always null on the web, so the
  // banner is the EA name -- exactly innerHead().
  k.innerHead();

  let y = 268;
  out.push(text('MILESTONES', 78, y, { size: 20, bold: true, fill: '#8A8A85' }));
  y += 16;

  if (rows.length === 0) {
    // Day one of an era: ghost rows -- "???" names nothing.
    out.push(text('No pay to win here — you must play to unlock.', 66, y + 30,
      { size: 18, bold: true, fill: C.ink }));
    let gy = y + 52;
    // Four ghosts, not five: the "... and N more" line needs its air.
    const ghosts = Math.min(hidden, 4);
    for (let i = 0; i < ghosts; i++) {
      out.push(`<path d="${rr(56, gy, W - 112, 58, 5)}" fill="rgba(0,0,0,${al(10)})"/>`);
      out.push(text('? ? ?', 66, gy + 24, { size: 19, bold: true, fill: '#9A9A95' }));
      out.push(`<path d="${rr(340, gy + 12, 140, 12, 3)}" fill="rgba(0,0,0,${al(25)})"/>`);
      out.push(text(i === 0 ? 'be the first to reach it — it unlocks for everyone' : 'not reached yet',
        66, gy + 47, { size: 15, fill: '#8A8A85' }));
      gy += 66;
    }
    if (hidden > ghosts) {
      out.push(text(`… and ${hidden - ghosts} more, somewhere.`, 66, gy + 24,
        { size: 16, fill: '#8A8A85' }));
    }
  }

  for (let i = 0; i < rows.length && y < 636; i++) {
    const row = rows[i] ?? {};
    const total = Math.trunc(Number(row.total) || 0);
    const target = Math.max(1, Math.trunc(Number(row.targetValue) || 0));
    const mine = row.leaderIsMe === true;
    out.push(`<path d="${rr(56, y, W - 112, 58, 5)}" fill="rgba(0,0,0,${al(10)})"/>`);
    out.push(text(trim(row.label ?? '', 19, true, 268), 66, y + 24, { size: 19, bold: true, fill: C.ink }));

    // The counter, right-aligned at 540; the bar fills the gap before it.
    const count = `${num(total)} / ${num(target)}`;
    const countW = measure(count, 18, true);
    out.push(text(count, 540, y + 24, { size: 18, bold: true, fill: C.ink, anchor: 'end' }));
    const barX = 340;
    const barW = Math.trunc(540 - barX - countW - 14);
    out.push(`<path d="${rr(barX, y + 12, barW, 12, 3)}" fill="rgba(0,0,0,${al(25)})"/>`);
    if (total > 0) {
      const fillW = Math.max(12, Math.trunc(barW * Math.min(1, total / target)));
      out.push(`<path d="${rr(barX, y + 12, fillW, 12, 3)}" fill="#7A3FB5"/>`);
    }

    // The chase line: the rung above (a server mate marked as ours), or the
    // crown when the player IS the top of this family.
    const targetName = row.targetName;
    const ours = row.targetKind === 'tracked' ? ' (ours)' : '';
    let sub;
    if (targetName == null) {
      sub = '★ past every name on the list';
    } else if (mine) {
      sub = `★ you lead · next: ${targetName}${ours} — ${num(row.targetValue)}`;
    } else {
      // NBSPs: SVG collapses the Java's three-space gaps around the dot.
      sub = `next: ${targetName}${ours} — ${num(row.targetValue)}`
        + `   ·   leader: ${row.leaderName ?? '?'}`;
    }
    out.push(text(trim(sub, 15, false, 468), 66, y + 47,
      { size: 15, fill: mine ? '#B8860B' : '#6A6A65' }));
    y += 66;
  }

  // The tease under the real rows: a count, never a name.
  if (rows.length > 0 && hidden > 0 && y < 660) {
    out.push(text(`${hidden} more milestone${hidden > 1 ? 's' : ''} still locked on this bench…`,
      66, y + 24, { size: 16, fill: '#8A8A85' }));
  }
}
