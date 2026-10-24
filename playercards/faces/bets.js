// The bets face (Oct 19) -- port of PlayerCard.renderBetsFace, drawn from the
// API's JSON (ApiServer.webFaceData, case "bets"): balance, consented,
// openCount, openTotal, recent [{status, stake, payout, line}] where `line`
// is PlayerCard.betLine already worded server-side, top [{name, balance}].
//
// The two coins are FlyingElvi's art from the templates volume, exported next
// to the page (art/coin-badge.png, art/coin-stack.png) at the Java boxes.

/** Coins.fmt: exact under 10,000, then three significant figures (45.1K, 538K, 2.7M). */
function fmt(aCoins) {
  const n = Math.trunc(Number(aCoins) || 0);
  if (n > -10000 && n < 10000) return n.toLocaleString('en-US');
  const SUFFIXES = ['K', 'M', 'B', 'T'];
  const sign = n < 0 ? '-' : '';
  let value = Math.abs(n);
  let step = -1;
  while (value >= 1000 && step < SUFFIXES.length - 1) {
    value /= 1000;
    step++;
  }
  // Tenths, so the rounding happens ONCE: 999,999 is "1.0M", never "1000K".
  let tenths = Math.round(value * 10);
  if (tenths >= 10000 && step < SUFFIXES.length - 1) {
    tenths = Math.round(tenths / 1000);
    step++;
  }
  const body = tenths >= 1000 ? String(Math.round(tenths / 10))
    : `${Math.floor(tenths / 10)}.${tenths % 10}`;
  return sign + body + SUFFIXES[step];
}

/** Coins.signed: the same, "+" on anything above zero. */
const signed = (aCoins) => (aCoins > 0 ? '+' : '') + fmt(aCoins);

/** PlayerCard.clean, approximately: no emoji / ZWJ / variation selectors
 *  (DejaVu can't draw them), runs of spaces collapsed. Null when empty. */
function clean(aText) {
  if (aText == null) return null;
  const out = String(aText).replace(/[‍️]|\p{Extended_Pictographic}/gu, '')
    .replace(/\s{2,}/g, ' ').trim();
  return out || null;
}

export default function draw(k, d) {
  const { p, C, W, out, text, al, measure, trim } = k;
  const pay = d.payload ?? {};
  const MUTED = C.muted;            // 0x8A8A85
  const GREEN = '#1F7A33';
  const RED = '#B3362C';
  const GOLD = '#B8860B';
  const balance = Number(pay.balance ?? 0);
  const openCount = Number(pay.openCount ?? 0);
  const openTotal = Number(pay.openTotal ?? 0);

  // ── header: the corner belongs to the coin (no position, no sticker) ──
  k.topStats(null);

  // drawCoinBadge: the 132px art at (30, 6). The chip's solid bounds measured
  // on the Discord render: center (94.5, 69.5), radius 58 -- the count lands there.
  {
    const cx = 94.5;
    const cy = 69.5;
    const r = 58;
    out.push('<image href="art/coin-badge.png" x="30" y="6" width="132" height="132"/>');
    // The open-bet count: fit to 1.4 x (radius x 0.70), shadow then cream.
    const radius = r * 0.70;
    const label = String(openCount);
    let size = 44;
    while (measure(label, size, true) > radius * 1.4 && size > 16) size -= 4;
    const ty = cy + size * 0.928 / 2 - 4;   // ascent / 2 - 4, DejaVu ascent = 0.928 em
    out.push(text(label, cx + 2, ty + 2, { size, bold: true, fill: `rgba(0,0,0,${al(160)})`, anchor: 'middle' }));
    out.push(text(label, cx, ty, { size, bold: true, fill: '#FFF4D6', anchor: 'middle' }));
  }

  k.panel();
  k.banner(p.name || '?', 170);

  let y = 268;
  out.push(text('FURBALL COINS', 78, y, { size: 20, bold: true, fill: MUTED }));
  y += 18;

  // The wallet, big, the coin stack beside it (the 52px art at (62, y - 4)).
  out.push(`<image href="art/coin-stack.png" x="62" y="${y - 4}" width="52" height="50"/>`);
  const textX = 62 + 52 + 14;
  out.push(text(fmt(balance), textX, y + 34, { size: 38, bold: true, fill: C.ink }));
  y += 56;

  // Open bets: the one line, no details (bets stay hidden until they settle).
  out.push(text(openCount === 0 ? 'No bets riding.'
    : `${openCount} bet${openCount > 1 ? 's' : ''} riding — ${fmt(openTotal)} coins in play`,
  66, y + 22, { size: 18, bold: true, fill: MUTED }));
  y += 38;

  const recent = Array.isArray(pay.recent) ? pay.recent : [];
  out.push(text('LAST 5 SETTLED', 66, y + 24, { size: 17, bold: true, fill: MUTED }));
  y += 36;
  if (recent.length === 0) {
    out.push(text('Nothing settled yet.', 66, y + 18, { size: 16, fill: MUTED }));
    y += 34;
  }
  for (const bet of recent) {
    if (y > 560) break;
    const status = bet.status;
    // A cash out paid out early: a win, marked $ (Oct 1).
    const cashed = status === 'cashed';
    const won = status === 'won' || cashed;
    const voided = status === 'void';
    const stake = Number(bet.stake ?? 0);
    const payout = bet.payout == null ? 0 : Number(bet.payout);
    const net = voided ? 0 : won ? payout - stake : -stake;
    const mark = voided ? '~' : cashed ? '$' : won ? 'W' : 'L';
    out.push(text(mark, 66, y + 20, { size: 18, bold: true, fill: voided ? GOLD : won ? GREEN : RED }));
    out.push(text(trim(bet.line ?? '?', 16, false, W - 230), 92, y + 20, { size: 16, fill: C.ink }));
    out.push(text(signed(net), 540, y + 20, { size: 16, bold: true,
      fill: net > 0 ? GREEN : net < 0 ? RED : MUTED, anchor: 'end' }));
    y += 28;
  }
  y += 4;

  const top = Array.isArray(pay.top) ? pay.top : [];
  if (top.length > 0 && y < 610) {
    out.push(text('TOP 3 MONEY PLAYERS', 66, y + 24, { size: 17, bold: true, fill: MUTED }));
    y += 34;
    let rank = 1;
    for (const row of top) {
      if (y > 652) break;
      const who = clean(row.name) ?? '?';
      const fill = rank === 1 ? GOLD : C.ink;
      out.push(text(`${rank}.`, 66, y + 18, { size: 17, bold: true, fill }));
      out.push(text(trim(who, 16, false, W - 260), 92, y + 18, { size: 16, fill }));
      out.push(text(fmt(row.balance), 540, y + 18, { size: 16, bold: true, fill, anchor: 'end' }));
      y += 26;
      rank++;
    }
  }
}
