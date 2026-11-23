"""Détoure les photos du créateur -> assets/createur/<id>.webp (fond transparent + contour blanc).
Usage : python3 tools/createur.py <photo.jpg> <id> [<photo.jpg> <id> ...]
Demande : pip install rembg onnxruntime scipy (modèle birefnet-general-lite, ~220 Mo, téléchargé une fois).
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
from rembg import remove, new_session

HAUT = 1400        # hauteur finale (px)
CONTOUR = 9        # épaisseur du contour blanc (px, à la hauteur finale)

def nettoyer(rgba):
    a = rgba[..., 3].astype(np.float32) / 255
    a[a < .08] = 0
    # ne garder que la personne (plus grande tache), pas les bouts de décor
    lab, n = ndimage.label(a > .5)
    if n > 1:
        tailles = ndimage.sum(np.ones_like(a), lab, range(1, n + 1))
        garde = ndimage.binary_dilation(lab == 1 + int(np.argmax(tailles)), iterations=6)
        a[~garde] = 0
    rgb = rgba[..., :3].astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # reflet bleu de l'objectif sur la peau : on le ramène vers une teinte neutre/chaude
    lum = .3 * r + .59 * g + .11 * b
    f = np.clip((b - r - 8) / 40, 0, 1) * np.clip((lum - 60) / 50, 0, 1)
    rgb[..., 2] = b * (1 - f) + np.minimum(b, r * .82) * f
    rgb[..., 1] = g * (1 - f) + np.minimum(g, r * .9) * f
    return np.dstack([rgb, a * 255]).clip(0, 255).astype(np.uint8)

def contour(im):
    a = np.asarray(im)[..., 3] > 40
    h, w = a.shape
    # marge seulement là où la personne ne touche pas le bord (le bord coupé reste net)
    m = CONTOUR + 4
    pad = [m * (not a[0].any()), m * (not a[-1].any()), m * (not a[:, 0].any()), m * (not a[:, -1].any())]
    fond = Image.new("RGBA", (w + pad[2] + pad[3], h + pad[0] + pad[1]), (0, 0, 0, 0))
    fond.paste(im, (pad[2], pad[0]))
    al = np.asarray(fond)[..., 3] > 40
    yy, xx = np.mgrid[-CONTOUR:CONTOUR + 1, -CONTOUR:CONTOUR + 1]
    dil = ndimage.binary_dilation(al, structure=(xx * xx + yy * yy) <= CONTOUR * CONTOUR)
    dil = ndimage.gaussian_filter(dil.astype(np.float32), 1.2)
    blanc = np.dstack([np.full(dil.shape + (3,), 255, np.uint8), (dil * 255).astype(np.uint8)])
    out = Image.fromarray(blanc, "RGBA")
    out.alpha_composite(fond)
    return out

import os
sess = new_session(os.environ.get("MODELE", "birefnet-general-lite"))
args = sys.argv[1:]
for src, ident in zip(args[::2], args[1::2]):
    im = Image.open(src).convert("RGB")
    cut = Image.fromarray(nettoyer(np.asarray(remove(im, session=sess))), "RGBA")
    cut = cut.crop(cut.getbbox())
    cut = cut.resize((round(cut.width * HAUT / cut.height), HAUT), Image.LANCZOS)
    out = contour(cut)
    out.save(f"assets/createur/{ident}.webp", quality=84, method=6)
    print(ident, out.size)
