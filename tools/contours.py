"""Contours de la pose de l'utilisateur = photo du créateur retournée en miroir (high five, check, V, dos à dos).
Crée assets/createur/contour-<id>.webp : trait blanc + intérieur très léger, fond transparent.
Usage : python3 tools/contours.py
"""
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

IDS = ["high-five", "check-poing", "pouce", "pointe", "pensif", "bras-croises"]
TRAIT = 11  # épaisseur du trait (px, pour une image de 1400 px de haut)

for i in IDS:
    im = ImageOps.mirror(Image.open(f"assets/createur/{i}.webp").convert("RGBA"))
    a = np.asarray(im)[..., 3] > 100
    a = ndimage.binary_opening(a, iterations=2)
    yy, xx = np.mgrid[-TRAIT:TRAIT + 1, -TRAIT:TRAIT + 1]
    disque = (xx * xx + yy * yy) <= TRAIT * TRAIT
    bord = a & ~ndimage.binary_erosion(a, structure=disque)
    h, w = a.shape
    # le bord coupé par l'image (bas, côtés) n'est pas tracé
    for sl in [(slice(h - 2 * TRAIT, h), slice(None)), (slice(None), slice(0, 2 * TRAIT)), (slice(None), slice(w - 2 * TRAIT, w))]:
        bord[sl] = False
    alpha = np.where(bord, 255, np.where(a, 45, 0)).astype(np.uint8)
    alpha = ndimage.gaussian_filter(alpha.astype(np.float32), .8).clip(0, 255).astype(np.uint8)
    out = np.dstack([np.full(a.shape + (3,), 255, np.uint8), alpha])
    Image.fromarray(out, "RGBA").save(f"assets/createur/contour-{i}.webp", quality=80)
    print(i, im.size)
