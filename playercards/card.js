// The player card, drawn in SVG from the exported JSON.
//
// A port of PlayerCard.java, coordinate for coordinate: same 600x840 canvas,
// same fonts (DejaVu), and SVG <text> y is the baseline exactly like Java2D's
// drawString, so every number below is the Java one. Colours and tiers come
// from theme.json, which the exporter reads out of the Java constants -- when
// the card changes on Discord, port the change here at the same coordinates.

import awards from './faces/awards.js?v=7796c3622c';
import quests from './faces/quests.js?v=7796c3622c';
import streaks from './faces/streaks.js?v=7796c3622c';
import frenzy from './faces/frenzy.js?v=7796c3622c';
import milestones from './faces/milestones.js?v=7796c3622c';
import bets from './faces/bets.js?v=7796c3622c';
import clubs from './faces/clubs.js?v=7796c3622c';

const FONT = 'EASSCard';
const measureCtx = document.createElement('canvas').getContext('2d');

/** Text width in px, with the card font (must be loaded first). */
export function measure(aText, aSize, aBold) {
  measureCtx.font = `${aBold ? 'bold ' : ''}${aSize}px ${FONT}`;
  return measureCtx.measureText(aText).width;
}

/** Java's shrink loop: step the size down until the text fits. */
function fit(aText, aStart, aMin, aMax) {
  let size = aStart;
  while (measure(aText, size, true) > aMax && size > aMin) size -= 2;
  return size;
}

/** Java's trim(): cut with an ellipsis until it fits. */
function trim(aText, aSize, aBold, aMax) {
  let out = aText ?? '';
  while (measure(out, aSize, aBold) > aMax && out.length > 2) {
    out = out.slice(0, -2).trim() + '…';
  }
  return out;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** A Java alpha (0-255) as a CSS one. */
const al = (n) => +(n / 255).toFixed(3);

/** Java RoundRectangle2D (arc = diameter) as a path. */
function rr(x, y, w, h, rx, ry = rx) {
  return `M${x + rx},${y}H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}`
    + `V${y + h - ry}A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}H${x + rx}`
    + `A${rx},${ry} 0 0 1 ${x},${y + h - ry}V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`;
}

let uid = 0;

/**
 * One face of a card as an SVG string.
 *
 * @param p the player (cards.json)
 * @param aFace 'front' | 'back' | 'last10', or a premium face (PREMIUM_FACES)
 * @param T the theme (theme.json)
 * @param aData a premium face's JSON (the API's /cards/{slug}/face/{side})
 */
export function renderCard(p, aFace, T, aData) {
  const id = `card${++uid}`;
  const C = T.colors;
  const W = T.width;
  const H = T.height;
  const tier = T.tiers.find((t) => t.name === p.tier) ?? T.tiers.find((t) => t.name === 'bronze');
  const defs = [];
  const out = [];

  /** A vertical tier-metal gradient between two y's (Java GradientPaint). */
  let metals = 0;
  const metal = (y1, y2) => {
    const gid = `${id}-m${++metals}`;
    defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${y1}" x2="0" y2="${y2}">`
      + `<stop offset="0" stop-color="${tier.light}"/><stop offset="1" stop-color="${tier.dark}"/></linearGradient>`);
    return `url(#${gid})`;
  };

  const text = (str, x, y, o) => {
    const halo = o.halo
      ? ` stroke="rgba(0,0,0,${al(165)})" stroke-width="4.5" stroke-linejoin="round" paint-order="stroke"` : '';
    return `<text x="${x}" y="${y}" font-size="${o.size}"${o.bold ? ' font-weight="bold"' : ''}`
      + ` fill="${o.fill}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${halo}>${esc(str)}</text>`;
  };

  // ── chrome: the frame PNG is the Java template itself ──────────────
  defs.push(`<clipPath id="${id}-card"><path d="${rr(0, 0, W, H, 17)}"/></clipPath>`);
  out.push(`<image href="frames/tier-${tier.name}.png" width="${W}" height="${H}" clip-path="url(#${id}-card)"/>`);
  const halo = p.halo;

  // ── drawTopStats ─────────────────────────────────────────────────────
  const topStats = (aPosition) => {
    if (aPosition) out.push(text('POS', 44, 62, { size: 22, fill: C.soft, halo }));
    out.push(text('OVR', W - 44, 62, { size: 22, fill: C.soft, anchor: 'end', halo }));
    if (aPosition) out.push(text(aPosition, 42, 122, { size: 64, bold: true, fill: '#fff', halo }));
    const big = String(p.ovr);
    const small = `/${p.ovrTracked}`;
    const bigW = measure(big, 64, true);
    const smallW = measure(small, 28, true);
    const ratingX = W - 42 - bigW - smallW - 4;
    out.push(text(big, ratingX, 122, { size: 64, bold: true, fill: '#fff', halo }));
    out.push(text(small, ratingX + bigW + 4, 122, { size: 28, bold: true, fill: C.soft, halo }));
    if (p.trend === 'up' || p.trend === 'down') {
      const up = p.trend === 'up';
      const ax = ratingX - 34;
      const pts = up ? `${ax},100 ${ax + 22},100 ${ax + 11},78` : `${ax},78 ${ax + 22},78 ${ax + 11},100`;
      out.push(`<polygon points="${pts}" fill="${up ? C.trendUp : C.trendDown}"/>`);
    }
  };

  // ── the inner panel ──────────────────────────────────────────────────
  const panel = () => {
    defs.push(`<linearGradient id="${id}-paper" gradientUnits="userSpaceOnUse" x1="0" y1="150" x2="0" y2="716">`
      + `<stop offset="0" stop-color="${C.paper}"/><stop offset="1" stop-color="${C.paperShade}"/></linearGradient>`);
    out.push(`<path d="${rr(34, 150, W - 68, 566, 11)}" fill="url(#${id}-paper)"/>`);
  };

  // ── drawNameBanner ───────────────────────────────────────────────────
  const banner = (aName, aTop) => {
    out.push(`<polygon points="64,${aTop} 536,${aTop - 14} 536,${aTop + 58} 64,${aTop + 72}" fill="${C.ink}"/>`);
    const size = fit(aName, 38, 18, 420);
    out.push(text(aName, W / 2, aTop + 42, { size, bold: true, fill: '#fff', anchor: 'middle' }));
  };

  // ── drawSticker (every inner face) ───────────────────────────────────
  const sticker = (aw) => {
    const lines = aw.line2 ? [aw.line1, aw.line2] : [aw.line1];
    let size = 34;
    let textW;
    for (;;) {
      textW = Math.max(...lines.map((l) => measure(l, size, true)));
      if (textW <= 290 || size <= 20) break;
      size -= 2;
    }
    const lineH = Math.round(size * 1.12);
    const w = Math.round(textW) + 48;
    const h = lines.length * lineH + 26;
    const cx = 42 + Math.floor(w / 2);
    const cy = 84;
    const border = aw.tier ? metal(cy - h / 2, cy + h / 2) : (aw.negative ? C.stickerNeg : C.stickerPos);
    let ty = cy - h / 2 + 13 + Math.round(size);
    const words = lines.map((l) => {
      const t = text(l, cx, ty, { size, bold: true, fill: C.ink, anchor: 'middle' });
      ty += lineH;
      return t;
    }).join('');
    out.push(`<g transform="rotate(-8 ${cx} ${cy})">`
      + `<path d="${rr(cx - w / 2 + 5, cy - h / 2 + 6, w, h, 9)}" fill="rgba(0,0,0,${al(90)})"/>`
      + `<path d="${rr(cx - w / 2, cy - h / 2, w, h, 9)}" fill="${C.stickerFill}" stroke="${border}" stroke-width="5"/>`
      + `${words}</g>`);
  };

  // ── drawBottom ───────────────────────────────────────────────────────
  const bottom = () => {
    const code = p.club.code ?? '?';
    if (p.club.logo) {
      // White disc, the logo inset 5px and stretched to the box like
      // drawImage(logo, x, y, w, h), clipped to the circle.
      defs.push(`<clipPath id="${id}-logo"><circle cx="128" cy="744" r="70"/></clipPath>`);
      out.push(`<circle cx="128" cy="744" r="70" fill="#fff"/>`);
      out.push(`<image href="${esc(p.club.logo)}" x="63" y="679" width="130" height="130"`
        + ` preserveAspectRatio="none" clip-path="url(#${id}-logo)"/>`);
    } else {
      out.push(`<circle cx="128" cy="744" r="70" fill="${C.ink}"/>`);
      out.push(text(code, 128, 744 + (code.length >= 3 ? 14 : 18),
        { size: code.length >= 3 ? 40 : 50, bold: true, fill: '#fff', anchor: 'middle' }));
    }
    out.push(`<circle cx="128" cy="744" r="70" fill="none" stroke="#fff" stroke-width="6"/>`);
    const club = p.club.name ?? 'Free agent';
    out.push(text(club, 216, 762, { size: fit(club, 36, 20, 330), bold: true, fill: '#fff', halo }));
    out.push(text(`${p.games} GP`, 216, 796, { size: 25, fill: C.soft, halo }));
    if (p.games < 10) {
      out.push(text('Awards & rank unlock after 10 games', W - 44, 730,
        { size: 17, fill: C.unlockNote, anchor: 'end', halo }));
    }
    out.push(text("ELVI'S TEAM TRACKER", W - 44, H - 30,
      { size: 16, fill: `rgba(255,255,255,${al(110)})`, anchor: 'end', halo }));
  };

  /** Inner faces: header + sticker + panel + banner at the top. */
  const innerHead = () => {
    topStats(p.award ? null : p.position);
    if (p.award) sticker(p.award);
    panel();
    banner(p.name, 170);
  };

  if (aFace === 'front') {
    topStats(p.position);
    panel();
    // The rink in broadcast perspective (see render() in PlayerCard.java).
    defs.push(`<clipPath id="${id}-panel"><path d="${rr(34, 150, W - 68, 566, 11)}"/></clipPath>`);
    const glass = rr(6, 218, W - 12, 900, 130, 75);
    const ice = rr(26, 246, W - 52, 900, 115, 65);
    out.push(`<g clip-path="url(#${id}-panel)">`
      + `<path d="${rr(34, 150, W - 68, 566, 11)} ${glass}" fill-rule="evenodd" fill="rgba(0,0,0,${al(13)})"/>`
      + `<path d="${glass} ${ice}" fill-rule="evenodd" fill="rgba(255,255,255,${al(155)})"/>`
      + `<path d="${ice}" fill="none" stroke="rgba(232,185,46,${al(130)})" stroke-width="5"/>`
      + [150, 210, 270, 330, 390, 450].map((x) =>
        `<line x1="${x}" y1="219" x2="${x}" y2="245" stroke="rgba(0,0,0,${al(75)})" stroke-width="2.5"/>`).join('')
      + `<rect x="34" y="300" width="${W - 68}" height="5" fill="rgba(200,16,46,${al(60)})"/>`
      + `<rect x="34" y="528" width="${W - 68}" height="9" fill="rgba(46,95,183,${al(60)})"/>`
      + `<ellipse cx="143" cy="356" rx="95" ry="36" fill="none" stroke="rgba(200,16,46,${al(55)})" stroke-width="4"/>`
      + `<ellipse cx="468" cy="354" rx="100" ry="38" fill="none" stroke="rgba(200,16,46,${al(55)})" stroke-width="4"/>`
      + `<ellipse cx="143" cy="356" rx="8" ry="4" fill="rgba(200,16,46,${al(45)})"/>`
      + `<ellipse cx="468" cy="354" rx="8" ry="4" fill="rgba(200,16,46,${al(45)})"/>`
      + `</g>`);

    // Award teaser: the sealed "?" the back's sticker answers.
    if (p.award) {
      const cx = 82;
      const cy = 190;
      out.push(`<g transform="rotate(-8 ${cx} ${cy})">`
        + `<path d="${rr(cx - 26, cy - 25, 60, 60, 8)}" fill="rgba(0,0,0,${al(80)})"/>`
        + `<path d="${rr(cx - 30, cy - 30, 60, 60, 8)}" fill="${C.stickerFill}" stroke="${metal(cy - 30, cy + 30)}" stroke-width="4.5"/>`
        + text('?', cx, cy + 38 * 0.928 / 2 - 4, { size: 38, bold: true, fill: C.ink, anchor: 'middle' })
        + `<line x1="${cx - 18}" y1="${cy - 24}" x2="${cx - 24}" y2="${cy - 16}" stroke="rgba(255,255,255,${al(150)})" stroke-width="3" stroke-linecap="round"/>`
        + `</g>`);
    }

    // Position ring at the feet, avatar, tier ring, front half of the ring.
    const posc = T.positions[p.position] ?? T.positions.C;
    const [acx, acy, ar] = [W / 2, 386, 155];
    const [gcy, grx, gry] = [acy + ar - 26, ar + 28, 54];
    out.push(`<ellipse cx="${acx}" cy="${gcy}" rx="${grx}" ry="${gry}" fill="rgba(0,0,0,${al(22)})"/>`);
    out.push(`<path d="M${acx + grx},${gcy} A${grx},${gry} 0 0 0 ${acx - grx},${gcy}" fill="none"`
      + ` stroke="${posc}" stroke-opacity="${al(120)}" stroke-width="15" stroke-linecap="round"/>`);
    if (p.avatar) {
      defs.push(`<clipPath id="${id}-avatar"><circle cx="${acx}" cy="${acy}" r="${ar}"/></clipPath>`);
      out.push(`<image href="${esc(p.avatar)}" x="${acx - ar}" y="${acy - ar}" width="${ar * 2}"`
        + ` height="${ar * 2}" preserveAspectRatio="none" clip-path="url(#${id}-avatar)"/>`);
    } else {
      out.push(`<circle cx="${acx}" cy="${acy}" r="${ar}" fill="#2B2D31"/>`);
      out.push(text((p.name || '?').charAt(0).toUpperCase(), acx, acy + 52,
        { size: 150, bold: true, fill: '#fff', anchor: 'middle' }));
    }
    out.push(`<circle cx="${acx}" cy="${acy}" r="${ar}" fill="none" stroke="${metal(acy - ar, acy + ar)}" stroke-width="9"/>`);
    out.push(`<path d="M${acx - grx},${gcy} A${grx},${gry} 0 0 0 ${acx + grx},${gcy}" fill="none"`
      + ` stroke="${posc}" stroke-width="15" stroke-linecap="round"/>`);

    banner(p.name, 588);
  } else if (aFace === 'back') {
    innerHead();
    const back = p.back ?? { rows: [], ovrLast10: p.ovr, ovrTracked: p.ovrTracked };
    const rows = [['OVR', String(back.ovrLast10), String(back.ovrTracked)], ...back.rows];
    out.push(text('LAST 10', 380, 274, { size: 20, bold: true, fill: C.muted, anchor: 'end' }));
    out.push(text('TRACKED', 540, 274, { size: 20, bold: true, fill: C.muted, anchor: 'end' }));
    let y = 284;
    const step = rows.length > 11 ? 32 : rows.length > 10 ? 36 : rows.length > 9 ? 38 : 44;
    const rowH = step - 6;
    rows.forEach((row, i) => {
      if (i % 2 === 0) out.push(`<path d="${rr(56, y, W - 112, rowH, 5)}" fill="rgba(0,0,0,${al(10)})"/>`);
      const ty = y + rowH - 10;
      out.push(text(row[0], 78, ty, { size: 23, fill: '#5A5A55' }));
      out.push(text(row[1], 380, ty, { size: 24, bold: true, fill: C.ink, anchor: 'end' }));
      out.push(text(row[2], 540, ty, { size: 24, bold: true, fill: C.ink, anchor: 'end' }));
      y += step;
    });
  } else if (DRAWERS[aFace]) {
    // A premium face (Oct 19): its own module draws between the frame and the
    // bottom, with the same pieces the faces above use.
    DRAWERS[aFace]({
      p, T, C, W, H, out, defs, id, tier,
      text, rr, metal, measure, fit, trim, al, esc,
      topStats, panel, banner, sticker, innerHead,
    }, aData ?? {});
  } else if (aFace === 'last10') {
    innerHead();
    const games = (p.last10 ?? []).slice(0, 10);
    out.push(text(`LAST ${games.length} GAMES`, 78, 268, { size: 20, bold: true, fill: C.muted }));
    out.push(text('RTG · most recent first', 540, 268, { size: 15, fill: C.muted, anchor: 'end' }));
    let y = 274;
    games.forEach((g, i) => {
      if (i % 2 === 0) out.push(`<path d="${rr(56, y, W - 112, 34, 5)}" fill="rgba(0,0,0,${al(10)})"/>`);
      const ty = y + 24;
      out.push(text(g.rtg, 66, ty, { size: 26, bold: true,
        fill: g.hot > 0 ? C.win : g.hot < 0 ? C.loss : C.ink }));
      out.push(text(g.result, 118, ty - 1, { size: 18, bold: true,
        fill: g.result === 'W' ? C.win : g.result === 'OTL' ? C.otl : C.loss }));
      out.push(text(trim(`${g.score} vs ${g.opp ?? '?'}`, 20, false, 225), 172, ty, { size: 20, fill: C.ink }));
      out.push(text(g.statLine, 540, ty, { size: 20, bold: true, fill: C.ink, anchor: 'end' }));
      y += 40;
    });
  }

  bottom();

  return `<svg class="card-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"`
    + ` font-family="${FONT}, DejaVu Sans, sans-serif" role="img" aria-label="${esc(p.name)} card">`
    + `<defs>${defs.join('')}</defs>${out.join('')}</svg>`;
}

// Labels and emoji are Discord's (PlayerCardListener.SIDES).
export const FACES = [
  { id: 'front', label: 'Card', icon: '🃏' },
  { id: 'back', label: 'Stats', icon: '📊' },
  { id: 'last10', label: 'Last 10', icon: '🗒️' },
];

// The premium faces (Oct 19): what Discord shows, for a premium member
// looking at a premium member's card. Each is a port of its
// PlayerCard.render* and draws from the JSON the API sends for it.
// `draw(k, data)`: k = this file's pieces (see renderCard), data = the face's JSON.
const DRAWERS = { awards, quests, streaks, frenzy, milestones, bets, clubs };

export const PREMIUM_FACES = [
  { id: 'awards', label: 'Awards', icon: '🏷️' },
  { id: 'quests', label: 'Challenges', icon: '🗺️' },
  { id: 'streaks', label: 'Streaks', icon: '🔥' },
  { id: 'frenzy', label: 'Furball Frenzy', icon: '🏆' },
  { id: 'milestones', label: 'Milestones', icon: '🏁' },
  { id: 'bets', label: 'Bets', icon: '🪙' },
  { id: 'clubs', label: 'Clubs', icon: '🏒' },
];

/** Discord's navigation order, the base faces and the premium ones mixed. */
export const FACE_ORDER = ['front', 'back', 'awards', 'last10', 'quests', 'streaks', 'frenzy',
  'milestones', 'bets', 'clubs'];
