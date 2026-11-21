"""Retire le fond vert (#00FF00) des images de la mascotte -> PNG transparents.
Usage : python3 tools/detourer.py
"""
import glob, os
import numpy as np
from PIL import Image

SRC = "assets/mascotte"
DST = "assets/mascotte/png"
os.makedirs(DST, exist_ok=True)

def detourer(img):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    vert = g - np.maximum(r, b)              # ~255 sur le fond, faible ailleurs
    alpha = 1.0 - np.clip((vert - 70.0) / (190.0 - 70.0), 0, 1)
    # dé-vert des bords (pixels mélangés au fond)
    bord = (vert > 40) & (alpha > 0)
    g2 = np.where(bord, np.minimum(g, np.maximum(r, b)), g)
    out = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

res = {}
for f in sorted(glob.glob(f"{SRC}/pose-*.jpg")):
    nom = os.path.basename(f)[:-4]
    if "fond-blanc" in nom:
        continue
    im = detourer(Image.open(f))
    res[nom] = im
    print(nom, im.size, im.getbbox())

# boîte commune pour garder la même échelle/position entre poses
boxes = [im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox() for im in res.values()]
x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
pad = 8
box = (max(0, x0 - pad), max(0, y0 - pad), x1 + pad, y1 + pad)
print("boîte commune", box)
for nom, im in res.items():
    c = im.crop(box)
    w, h = c.size
    c = c.resize((w // 2, h // 2), Image.LANCZOS)   # allège pour le web
    c.save(f"{DST}/{nom}.png", optimize=True)
print("ok", c.size)
