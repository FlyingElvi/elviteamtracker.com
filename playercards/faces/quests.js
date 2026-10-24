// The quests face (Oct 19) -- port of PlayerCard.renderQuests, drawn from the
// API's JSON. Shown as "Challenges": the community's own word for these (the
// rename of Aug 15); the code and the tables keep saying quest.
//
// d = { questName, questDesc, suggestedBy, progress, target,
//       completed: [[name, 'yyyy-mm-dd'], ...] newest first, questsDone }

/** The badge art (FlyingElvi's cat-eared puck), served next to the frames. */
const BADGE = 'art/quests-badge.png';
/** Its native size (1312x1199): the Java scales it to w=160 keeping the ratio. */
const BADGE_RATIO = 1199 / 1312;

/** Java's wrap(): greedy word wrap into a pixel width. */
function wrap(k, aText, aSize, aBold, aWidth) {
  // Java's split(" ") drops the trailing empty strings, JS's keeps them.
  const words = aText.split(' ');
  while (words.length && words[words.length - 1] === '') words.pop();
  const lines = [];
  let line = '';
  for (const word of words) {
    const probe = line === '' ? word : `${line} ${word}`;
    if (k.measure(probe, aSize, aBold) > aWidth && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = probe;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/**
 * drawQuestsBadge: the completed count on the puck's dark face. Takes the
 * corner the form sticker owns elsewhere -- one or the other, never both.
 */
function badge(k, aCount) {
  const w = 160;
  const h = Math.round(w * BADGE_RATIO);
  const x = 30;
  const y = 6;
  k.out.push(`<image href="${BADGE}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>`);
  // The dark face's center, measured on the source art: 50.7% across, 39.6%
  // down. Fit the number, then a soft shadow sells the engraving.
  const str = String(aCount);
  let size = 54;
  while (k.measure(str, size, true) > w * 0.36 && size > 20) size -= 4;
  const cx = x + w * 0.507;
  const cy = y + h * 0.396;
  // Java centres on getAscent()/2; DejaVu's ascent is 0.928 em.
  const ty = cy + (size * 0.928) / 2 - 4;
  k.out.push(k.text(str, cx + 2, ty + 2, { size, bold: true, fill: `rgba(0,0,0,${k.al(160)})`, anchor: 'middle' }));
  k.out.push(k.text(str, cx, ty, { size, bold: true, fill: '#EAF2FF', anchor: 'middle' }));
}

export default function draw(k, d) {
  const { p, C, W, out } = k;
  const zebra = `rgba(0,0,0,${k.al(10)})`;
  const done = d.questsDone ?? 0;
  const completed = d.completed ?? [];

  // ── the head: the quest badge replaces the sticker once one is done ──
  const showBadge = done > 0;
  k.topStats(!p.award && !showBadge ? p.position : null);
  if (showBadge) badge(k, done);
  else if (p.award) k.sticker(p.award);
  k.panel();
  k.banner(p.name ?? '?', 170);

  // ── CURRENT CHALLENGE ────────────────────────────────────────────────
  let y = 268;
  out.push(k.text('CURRENT CHALLENGE', 78, y, { size: 20, bold: true, fill: '#8A8A85' }));
  y += 20;

  if (d.questName == null) {
    out.push(`<path d="${k.rr(56, y, W - 112, 74, 5)}" fill="${zebra}"/>`);
    out.push(k.text('No challenge right now.', 66, y + 30, { size: 22, bold: true, fill: C.ink }));
    out.push(k.text('Press  Get a challenge  under the card.', 66, y + 58, { size: 18, fill: '#6A6A65' }));
    y += 74 + 30;
  } else {
    // Sized to the content: name, description (wrapped), the bar only when
    // the quest takes more than one game, the credit line only when somebody
    // gets one. A hidden description reads ??? (wrapped in the plain font,
    // drawn bold, like the Java).
    const hidden = d.questDesc == null;
    const target = d.target ?? 0;
    const progress = d.progress ?? 0;
    const suggested = d.suggestedBy != null;
    const desc = wrap(k, hidden ? '???' : d.questDesc, 19, false, W - 112 - 20);
    const boxH = 46 + desc.length * 24 + (target > 1 ? 40 : 10) + (suggested ? 24 : 0);
    out.push(`<path d="${k.rr(56, y, W - 112, boxH, 5)}" fill="${zebra}"/>`);
    out.push(k.text(k.trim(d.questName, 24, true, W - 112 - 20), 66, y + 32,
      { size: 24, bold: true, fill: C.ink }));
    let ty = y + 58;
    for (const line of desc) {
      out.push(k.text(line, 66, ty, { size: 19, bold: hidden, fill: hidden ? '#8A4A9C' : '#4A4A45' }));
      ty += 24;
    }
    if (suggested) {
      out.push(k.text(`suggested by ${d.suggestedBy}`, 66, ty, { size: 15, fill: '#8A8A85' }));
      ty += 24;
    }
    if (target > 1) {
      const barW = W - 112 - 130;
      out.push(`<path d="${k.rr(66, ty, barW, 14, 3.5)}" fill="rgba(0,0,0,${k.al(25)})"/>`);
      // Java int division: barW * min(progress, target) / target, floored.
      const fillW = Math.max(14, Math.floor((barW * Math.min(progress, target)) / target));
      out.push(`<path d="${k.rr(66, ty, fillW, 14, 3.5)}" fill="#1B7F3B"/>`);
      out.push(k.text(`${progress} / ${target}`, 66 + barW + 14, ty + 13, { size: 18, bold: true, fill: C.ink }));
    }
    y += boxH + 30;
  }

  // ── COMPLETED ────────────────────────────────────────────────────────
  out.push(k.text('COMPLETED', 78, y, { size: 20, bold: true, fill: '#8A8A85' }));
  y += 14;
  if (completed.length === 0) {
    out.push(k.text('Nothing yet — the log starts with the first one.', 66, y + 24, { size: 18, fill: '#9A9A95' }));
  }
  for (let i = 0; i < completed.length && y < 630; i++) {
    const [name, date] = completed[i];
    if (i % 2 === 0) out.push(`<path d="${k.rr(56, y, W - 112, 34, 5)}" fill="${zebra}"/>`);
    out.push(k.text('★', 66, y + 23, { size: 16, bold: true, fill: '#B8860B' }));
    // The name yields to the date, not the other way round: 285 is what a
    // "completed 2026-08-12" leaves of the row.
    out.push(k.text(k.trim(name, 19, true, 285), 90, y + 24, { size: 19, bold: true, fill: C.ink }));
    out.push(k.text(`completed ${date}`, 540, y + 24, { size: 16, fill: '#6A6A65', anchor: 'end' }));
    y += 38;
  }
}
