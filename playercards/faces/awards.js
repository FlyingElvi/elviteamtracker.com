// The awards face (Oct 19) -- port of PlayerCard.renderAwards, drawn from the
// API's JSON: d.races = PlayerCard.AwardRace records, held first.

const GREEN = '#35C759';
const GREEN_DARK = '#1B7F3B';
const GREY = '#5A5A55';

export default function draw(k, d) {
  const { C, W, out, defs, text, rr, measure, trim, al } = k;
  const races = Array.isArray(d.races) ? d.races : [];

  // Header, sticker, panel, banner (aDiscordName is always null on the web).
  k.innerHead();

  out.push(text('AWARD RACES', W / 2, 262, { size: 20, bold: true, fill: C.muted, anchor: 'middle' }));

  if (races.length === 0) {
    // Provisional card: say so instead of a blank panel (blank reads as broken).
    out.push(text('Not ranked yet.', W / 2, 430, { size: 24, fill: GREY, anchor: 'middle' }));
    out.push(text('Play more tracked games to', W / 2, 470, { size: 24, fill: GREY, anchor: 'middle' }));
    out.push(text('enter the award races.', W / 2, 502, { size: 24, fill: GREY, anchor: 'middle' }));
  }

  /** A vertical green gradient (Java GradientPaint, held belts). */
  let greens = 0;
  const green = (y1, y2) => {
    const gid = `${k.id}-aw${++greens}`;
    defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${y1}" x2="0" y2="${y2}">`
      + `<stop offset="0" stop-color="${GREEN}"/><stop offset="1" stop-color="${GREEN_DARK}"/></linearGradient>`);
    return `url(#${gid})`;
  };

  // 5 blocks of 82 end at y=666, just above the club disc. An INACTIVE player
  // gives up the fifth block to the notice below.
  const ineligible = races.length > 0 && races[0].eligible === false;
  let y = 270;
  const step = 82;
  for (const race of races.slice(0, ineligible ? 4 : 5)) {
    // Label sticker on the left: shrink 19 -> 13 until the widest line fits 158.
    const lines = race.line2 && race.line2.trim() ? [race.line1 ?? '', race.line2] : [race.line1 ?? ''];
    let size = 19;
    let textW;
    for (;;) {
      textW = Math.round(Math.max(...lines.map((l) => measure(l, size, true))));
      if (textW <= 158 || size <= 13) break;
      size -= 1;
    }
    const boxW = Math.max(120, textW + 28);
    const boxH = 64;
    out.push(`<path d="${rr(59, y + 7, boxW, boxH, 7)}" fill="rgba(0,0,0,${al(60)})"/>`);
    // Held = GREEN (gold read as the roast mustard), else polarity border.
    const border = race.held ? green(y, y + boxH) : (race.negative ? C.stickerNeg : C.stickerPos);
    out.push(`<path d="${rr(56, y + 4, boxW, boxH, 7)}" fill="${C.stickerFill}" stroke="${border}" stroke-width="3.5"/>`);
    const lineH = Math.round(size * 1.15);
    let ty = y + 4 + Math.trunc((boxH - lines.length * lineH) / 2) + Math.round(size) - 2;
    for (const line of lines) {
      out.push(text(line, 56 + boxW / 2, ty, { size, bold: true, fill: C.ink, anchor: 'middle' }));
      ty += lineH;
    }

    // Right side: who to beat / who's chasing, then the progress bar.
    const rx = 56 + Math.max(boxW, 158) + 26;
    const rw = 544 - rx;
    // The unit heads the number column, right-aligned on the holder line.
    const unit = race.unit ?? '';
    const unitW = unit ? Math.round(measure(unit, 14, true)) : 0;
    if (unit) out.push(text(unit, rx + rw, y + 20, { size: 14, bold: true, fill: C.muted, anchor: 'end' }));
    const who = race.targetName == null ? (race.held ? 'Unchallenged' : '')
      : (race.held ? 'Chased by ' : 'Holder: ') + race.targetName;
    out.push(text(trim(who, 16, false, rw - unitW - 12), rx, y + 20, { size: 16, fill: C.muted }));
    out.push(`<path d="${rr(rx, y + 30, rw, 13, 4)}" fill="rgba(0,0,0,${al(25)})"/>`);
    const fillW = Math.round(rw * Math.max(race.held ? 1 : 0.04, race.fill ?? 0));
    // Not eligible = grey: a full coloured bar on an inactive card reads "you won this".
    const barFill = race.eligible === false ? '#B4B1A9'
      : race.held ? green(y, y + 43)
        : (race.negative ? C.stickerNeg : C.stickerPos);
    // Java clamps the arc to the shape; keep the radius within half the width.
    if (fillW > 0) out.push(`<path d="${rr(rx, y + 30, fillW, 13, Math.min(4, fillW / 2), 4)}" fill="${barFill}"/>`);
    out.push(text(`YOU ${race.myText ?? ''}`, rx, y + 66, { size: 17, bold: true, fill: C.ink }));
    if (race.targetText != null) {
      out.push(text(race.targetText, rx + rw, y + 66, { size: 17, bold: true, fill: GREY, anchor: 'end' }));
    }
    y += step;
  }

  if (ineligible) {
    // Two ways out: the count only sees games EASSS has.
    out.push(text('NOT ELIGIBLE FOR AWARDS', W / 2, y + 32, { size: 19, bold: true, fill: C.muted, anchor: 'middle' }));
    out.push(text('Be more active, or track more clubs', W / 2, y + 60, { size: 18, fill: C.muted, anchor: 'middle' }));
  }
}
