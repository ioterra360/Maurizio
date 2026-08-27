"""Compose 1080x1920 Google Play phone screenshots from the raw web captures in raw/.

    python scripts/store-screenshots/compose.py              # -> docs/store-assets/screenshots/phone/
    python scripts/store-screenshots/compose.py specs.json out_dir

Design: warm canvas (or navy for the opener), kicker + headline + subline on top,
device frame with an Android-style status strip, screen bleeding off the bottom."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import json, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "..", "..", "node_modules", "@expo-google-fonts", "inter")
def font(w, size):
    return ImageFont.truetype(f"{FONTS}/{w}/Inter_{w}.ttf", size)
NAVY=(26,44,79); CANVAS=(245,243,239); MID=(138,138,136); WHITE=(255,255,255)
W,H=1080,1920

def status_strip(shot):
    """Add a 40dp (120px @3x) status strip above the screenshot, same colour as its top row."""
    top = shot.getpixel((shot.width//2, 2))[:3]
    strip = Image.new("RGB", (shot.width, 120), top)
    d = ImageDraw.Draw(strip)
    d.text((72, 36), "9:41", font=font("600SemiBold", 42), fill=NAVY)
    x = shot.width - 72
    # battery
    d.rounded_rectangle((x-78, 42, x-8, 78), radius=8, outline=NAVY, width=5)
    d.rounded_rectangle((x-72, 48, x-14, 72), radius=4, fill=NAVY)
    d.rectangle((x-6, 54, x, 66), fill=NAVY)
    # wifi (three arcs)
    cx = x-130
    for r,wd in ((36,6),(24,6),(12,6)):
        d.arc((cx-r, 40, cx+r, 40+2*r), start=225, end=315, fill=NAVY, width=wd)
    d.ellipse((cx-5, 72, cx+5, 82), fill=NAVY)
    # signal bars
    bx = x-230
    for i,hh in enumerate((14,22,30,38)):
        d.rounded_rectangle((bx+i*16, 80-hh, bx+i*16+10, 80), radius=2, fill=NAVY)
    out = Image.new("RGB", (shot.width, shot.height+120), top)
    out.paste(strip, (0,0)); out.paste(shot.convert("RGB"), (0,120))
    return out

def wrap(d, text, f, maxw):
    words=text.split(); lines=[]; cur=""
    for w_ in words:
        t=(cur+" "+w_).strip()
        if d.textlength(t, font=f) <= maxw: cur=t
        else: lines.append(cur); cur=w_
    if cur: lines.append(cur)
    return lines

def compose(spec, out_path):
    dark = spec.get("dark", False)
    bg = NAVY if dark else CANVAS
    fg = WHITE if dark else NAVY
    sub = (205,212,228) if dark else MID
    accent = tuple(int(spec.get("accent","#6DA8E5").lstrip("#")[i:i+2],16) for i in (0,2,4))
    im = Image.new("RGB", (W,H), bg); d = ImageDraw.Draw(im)
    # kicker
    kf = font("600SemiBold", 26); kick = spec["kicker"].upper()
    # letter-spaced kicker
    x = W/2 - (sum(d.textlength(c, font=kf) for c in kick) + 4*(len(kick)-1))/2
    for c in kick:
        d.text((x, 150), c, font=kf, fill=accent if not dark else (150,185,235)); x += d.textlength(c, font=kf) + 4
    # headline
    hf = font("700Bold", 66); lines = wrap(d, spec["headline"], hf, 940)
    y = 205
    for ln in lines:
        d.text((W/2, y), ln, font=hf, fill=fg, anchor="ma"); y += 78
    # subline
    sf = font("400Regular", 32); slines = wrap(d, spec["subline"], sf, 860); y += 16
    for ln in slines:
        d.text((W/2, y), ln, font=sf, fill=sub, anchor="ma"); y += 44
    # device
    shot = status_strip(Image.open(spec["file"]))
    sw = 820; sh = int(shot.height * sw / shot.width)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    top = 560  # fixed so every board shows the phone at the same height
    bezel = 18; r_out = 72; r_in = 54
    fx0 = (W - sw)//2 - bezel; fy0 = top - bezel
    # shadow
    sh_layer = Image.new("RGBA", (W,H), (0,0,0,0)); sd = ImageDraw.Draw(sh_layer)
    sd.rounded_rectangle((fx0+10, fy0+40, fx0+sw+2*bezel-10, H+200), radius=r_out, fill=(15,23,48,110 if not dark else 160))
    sh_layer = sh_layer.filter(ImageFilter.GaussianBlur(40)); im.paste(sh_layer, (0,0), sh_layer); d = ImageDraw.Draw(im)
    d.rounded_rectangle((fx0, fy0, fx0+sw+2*bezel, H+200), radius=r_out, fill=(16,24,48))
    # screen with rounded corners
    mask = Image.new("L", (sw, sh), 0); ImageDraw.Draw(mask).rounded_rectangle((0,0,sw-1,sh-1), radius=r_in, fill=255)
    im.paste(shot, (fx0+bezel, fy0+bezel), mask)
    im.save(out_path, optimize=True); print("wrote", out_path, im.size)

if __name__ == "__main__":
    spec_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "specs.json")
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "..", "docs", "store-assets", "screenshots", "phone")
    specs = json.load(open(spec_path, encoding="utf-8"))
    os.makedirs(out_dir, exist_ok=True)
    for i, sp in enumerate(specs, 1):
        sp = dict(sp); sp["file"] = os.path.join(HERE, "raw", sp["file"])
        compose(sp, os.path.join(out_dir, f"{i:02d}-{sp['slug']}.png"))
