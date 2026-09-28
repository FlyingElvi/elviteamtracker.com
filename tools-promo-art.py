"""Promotional art for Elvi's Team Tracker: the fake 95 card on a dark bed,
sized for whichever Discord slot needs filling."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, sys

CARD  = r"S:\Web\elviteamtracker.com\img\card-elvi-95.png"
LOGO  = r"S:\Web\elviteamtracker.com\assets\logo-512.png"
FONTB = r"S:\cheese\EASSS\EASSServer\src\main\resources\fonts\DejaVuSans-Bold.ttf"
FONTR = r"S:\cheese\EASSS\EASSServer\src\main\resources\fonts\DejaVuSans.ttf"
OUTDIR = r"S:\Web\elviteamtracker.com\img"

HEAD = ["EA NHL Pro Clubs scores,", "posted in your Discord."]
BULLETS = ["Automatic box scores, the real final score",
           "Player cards, leaderboards, head-to-head",
           "Free, no ads, no premium tier"]


def build(out_w, out_h, name, bullets=False, S=2):
    W, H = out_w * S, out_h * S
    card = Image.open(CARD).convert("RGBA")

    # base: dark steel, a shade warmer on the left, darker toward the bottom
    bg = Image.new("RGB", (W, H))
    px = bg.load()
    for x in range(W):
        t = x / (W - 1)
        r, g, b = 26 + 10 * (1 - t), 30 + 6 * (1 - t), 38 + 4 * (1 - t)
        for y in range(H):
            v = 1 - 0.22 * (y / (H - 1))
            px[x, y] = (int(r * v), int(g * v), int(b * v))

    # a fire glow behind the card only, so the card keeps its own edge
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gcx, gcy = int(W * 0.18), H // 2
    rad0 = int(H * 0.44)
    for i in range(26, 0, -1):
        f = i / 26.0
        rad = int(rad0 * f)
        gd.ellipse([gcx - rad, gcy - int(rad * 1.25), gcx + rad, gcy + int(rad * 1.25)],
                   fill=(int(255 * (1 - f) ** 1.5), int(96 * (1 - f) ** 2.2),
                         int(20 * (1 - f) ** 3)))
    glow = glow.filter(ImageFilter.GaussianBlur(int(H * 0.07)))
    bg = Image.blend(bg, glow, 0.42)
    banner = bg.convert("RGBA")

    # the card, full height inside a margin
    pad = int(H * 0.068)
    target_h = H - pad * 2
    target_w = round(card.width * target_h / card.height)
    card_s = card.resize((target_w, target_h), Image.LANCZOS)
    cx, cy = int(W * 0.044), pad

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shadow.paste(Image.new("RGBA", card_s.size, (0, 0, 0, 200)),
                 (cx + 4 * S, cy + 8 * S), card_s)
    banner = Image.alpha_composite(banner, shadow.filter(
        ImageFilter.GaussianBlur(int(H * 0.023))))
    banner.paste(card_s, (cx, cy), card_s)

    d = ImageDraw.Draw(banner)
    tx = cx + target_w + int(W * 0.05)
    avail = W - tx - int(W * 0.038)

    def fit(lines, path, start, room=None, minimum=10):
        """Largest size at which every line clears the right margin.

        `room` is the width actually left for THAT line — the brand sits after
        the logo, so it has less of it than the rest of the block.
        """
        room = avail if room is None else room
        size = start
        while size > minimum:
            f = ImageFont.truetype(path, size)
            if max(d.textlength(t, font=f) for t in lines) <= room:
                return f
            size -= 1
        return ImageFont.truetype(path, minimum)

    logo_px = int(H * 0.15)
    brand_gap = int(W * 0.018)

    f_head = fit(HEAD, FONTB, int(H * 0.15))
    f_brand = fit(["ELVI'S TEAM TRACKER"], FONTB, int(H * 0.105),
                  room=avail - logo_px - brand_gap)
    f_url = fit(["elviteamtracker.com"], FONTB, int(H * 0.062))
    f_bul = fit(BULLETS, FONTR, int(H * 0.048)) if bullets else None

    def shadowed(xy, text, font, fill):
        d.text((xy[0] + 2 * S, xy[1] + 2 * S), text, font=font, fill=(0, 0, 0, 200))
        d.text(xy, text, font=font, fill=fill)

    logo = Image.open(LOGO).convert("RGBA").resize((logo_px, logo_px), Image.LANCZOS)

    line_h = int(f_head.size * 1.22)
    gap = int(H * 0.09)
    block = logo_px + gap + line_h * 2
    if bullets:
        block += int(H * 0.055) + int(f_bul.size * 1.75) * len(BULLETS)
    block += int(H * 0.055) + int(f_url.size * 1.2)
    top = (H - block) // 2

    banner.paste(logo, (tx, top), logo)
    shadowed((tx + logo_px + brand_gap, top + (logo_px - f_brand.size) // 2 - 2 * S),
             "ELVI'S TEAM TRACKER", f_brand, (255, 255, 255, 255))

    y = top + logo_px + gap
    for line in HEAD:
        shadowed((tx, y), line, f_head, (255, 255, 255, 255))
        y += line_h

    if bullets:
        y += int(H * 0.04)
        for b in BULLETS:
            d.ellipse([tx + 2 * S, y + f_bul.size // 2 - 2 * S,
                       tx + 8 * S, y + f_bul.size // 2 + 4 * S], fill=(255, 122, 40, 255))
            shadowed((tx + int(W * 0.022), y), b, f_bul, (205, 214, 224, 255))
            y += int(f_bul.size * 1.75)

    shadowed((tx, y + int(H * 0.035)), "elviteamtracker.com", f_url, (96, 200, 255, 255))

    out = os.path.join(OUTDIR, name)
    banner.convert("RGB").resize((out_w, out_h), Image.LANCZOS).save(out, "PNG", optimize=True)
    print("wrote %s  %dx%d  %d bytes" % (out, out_w, out_h, os.path.getsize(out)))


build(680, 240, "banner-680x240.png")
build(1024, 576, "invite-1024x576.png", bullets=True)
