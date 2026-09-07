"""Da raw/<lingua>-<tema>/<nome>.png a assets/tutorial/<nome>-<lingua>-<tema>.webp.

Ridimensiona a 720 px di larghezza (da 1236 @3x: sul telefono la cornice del
tutorial e' larga ~55% dello schermo, quindi 720 px bastano anche a 3x) e
salva in WebP: 48 immagini in ~1,5 MB invece dei ~10 MB dei PNG (il test
fissa il tetto a 4 MB). Metro impacchetta solo i file richiesti da
lib/tutorial-shot-sources.ts.
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
OUT = HERE.parent.parent / "assets" / "tutorial"
WIDTH = 720
QUALITY = 78

OUT.mkdir(parents=True, exist_ok=True)
total = 0
count = 0
for folder in sorted(RAW.iterdir()):
    if not folder.is_dir():
        continue
    lang, theme = folder.name.split("-")
    for png in sorted(folder.glob("*.png")):
        img = Image.open(png).convert("RGB")
        ratio = WIDTH / img.width
        img = img.resize((WIDTH, round(img.height * ratio)), Image.LANCZOS)
        target = OUT / f"{png.stem}-{lang}-{theme}.webp"
        img.save(target, "WEBP", quality=QUALITY, method=6)
        size = target.stat().st_size
        total += size
        count += 1
        print(f"{target.name:34} {img.width}x{img.height} {size // 1024} KB")
print(f"{count} file, {total / 1024 / 1024:.2f} MB")
