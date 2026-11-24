"""Ombres animées du créateur (studio photo) à partir de courtes vidéos : chaque image détourée est calée sur la tête
de la photo fixe (même taille, même place), puis toutes sont mises côte à côte dans une planche
assets/createur/anim-<id>.webp (transparence seulement : l'appli l'affiche en ombre noire).
Usage : python3 tools/animations.py <dossier_images> <visages.json>
  <dossier_images>/<id>/cut/NN.png : images détourées (RGBA), déjà dans le bon sens ;
  <visages.json> : { id: [[haut, menton, centre_x] ou null, ...] } mesurés avec le modèle du visage de l'appli.
"""
import sys, json, os
import numpy as np
from PIL import Image

HAUT = 420
TETES = {  # [haut, menton, centre] de la photo fixe (POSES_BEUFA dans js/app.js)
    "check-poing": [.069, .476, .691], "pouce": [.028, .406, .781], "mains-hanches": [.061, .462, .868],
    "bras-croises": [.05, .357, .265], "pensif": [.05, .397, .265]}

dossier, visages = sys.argv[1], json.load(open(sys.argv[2]))
for pid, faces in visages.items():
    still = Image.open(f"assets/createur/{pid}.webp")
    ws = round(HAUT * still.width / still.height)
    tp, mp, cp = TETES[pid]
    imgs = [Image.open(f"{dossier}/{pid}/cut/{k:02d}.png") for k in range(len(faces))]
    W0, H0 = imgs[0].size
    echelles = [(mp - tp) * HAUT / ((f[1] - f[0]) * H0) for f in faces if f]
    k = float(np.median(echelles))
    planche = Image.new("RGBA", (ws * len(imgs), HAUT), (0, 0, 0, 0))
    der = None
    for n, (im, f) in enumerate(zip(imgs, faces)):
        f = f or der; der = f
        a = im.getchannel("A").resize((round(W0 * k), round(H0 * k)), Image.LANCZOS)
        ox = cp * ws - f[2] * W0 * k; oy = tp * HAUT - f[0] * H0 * k
        cadre = Image.new("L", (ws, HAUT), 0); cadre.paste(a, (round(ox), round(oy)))
        planche.paste(Image.merge("RGBA", [Image.new("L", (ws, HAUT), 255)] * 3 + [cadre]), (n * ws, 0))
    planche.save(f"assets/createur/anim-{pid}.webp", quality=80)
    print(pid, len(imgs), "images", planche.size)
