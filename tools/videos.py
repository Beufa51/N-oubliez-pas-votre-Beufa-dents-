"""Vidéos du créateur -> images détourées pour l'appli (il entre, fait le geste, se fige).
Usage : python3 tools/videos.py <video.mp4> <id> <debut_s> <fin_s> [miroir]
Crée assets/createur/video/<id>/NN.webp (12 images/s, toutes au même cadrage) et assets/createur/<id>.webp
(la dernière image, en grand : c'est elle qui sert sur la photo).
Demande : pip install rembg onnxruntime scipy ; ffmpeg.
"""
import sys, os, subprocess, tempfile, shutil
import numpy as np
from PIL import Image
from scipy import ndimage
from rembg import remove, new_session

FPS, LARGEUR = 12, 540
src, ident, t0, t1 = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
MIROIR = ",hflip" if len(sys.argv) > 5 and sys.argv[5] == "miroir" else ""   # geste tourné vers l'utilisateur
tmp = tempfile.mkdtemp()
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(t0), "-to", str(t1), "-i", src,
                "-vf", f"fps={FPS},scale={LARGEUR}:-2{MIROIR}", f"{tmp}/%03d.png"], check=True)
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(t1 - .02), "-i", src, "-frames:v", "1"] + (["-vf", "hflip"] if MIROIR else []) + [f"{tmp}/fin.png"], check=True)
sess = new_session("birefnet-general-lite")

def detourer(im):
    a = np.asarray(remove(im, session=sess)).copy()
    al = a[..., 3].astype(np.float32) / 255
    # garder seulement ce qui touche le bas de l'image (la personne) : pas la fenêtre avant qu'il entre
    # la personne = le plus grand morceau qui descend dans le bas de l'image (pas la fenêtre ni la rampe)
    lab, n = ndimage.label(al > .5)
    garde = np.zeros_like(al, bool)
    if n:
        tailles = ndimage.sum(np.ones_like(al), lab, range(1, n + 1))
        bas = set(np.unique(lab[int(al.shape[0] * .85):, :])) - {0}
        ok = [k for k in range(1, n + 1) if k in bas and tailles[k - 1] > al.size * .01]
        if ok: garde = lab == max(ok, key=lambda k: tailles[k - 1])
    al[~ndimage.binary_dilation(garde, iterations=4)] = 0
    al = ndimage.gaussian_filter(ndimage.grey_erosion(al, size=(3, 3)), .8)
    a[..., 3] = (al * 255).clip(0, 255).astype(np.uint8)
    return Image.fromarray(a, "RGBA")

noms = sorted(f for f in os.listdir(tmp) if f[0].isdigit())
imgs = [detourer(Image.open(f"{tmp}/{f}").convert("RGB")) for f in noms]
fin = detourer(Image.open(f"{tmp}/fin.png").convert("RGB"))
# même cadrage pour toutes : la boîte qui contient la personne sur toutes les images (bas et droite gardés)
W, H = imgs[0].size
x0, y0 = W, H
for im in imgs + [fin.resize((W, H))]:
    b = im.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    if b: x0, y0 = min(x0, b[0]), min(y0, b[1])
x0, y0 = max(0, x0 - 6), max(0, y0 - 6)
dossier = f"assets/createur/video/{ident}"
shutil.rmtree(dossier, ignore_errors=True); os.makedirs(dossier)
for k, im in enumerate(imgs):
    im.crop((x0, y0, W, H)).save(f"{dossier}/{k:02d}.webp", quality=72, method=6)
k2 = fin.width / W
fin.crop((round(x0 * k2), round(y0 * k2), fin.width, fin.height)).save(f"assets/createur/{ident}.webp", quality=84, method=6)
print(ident, len(imgs), "images", (W - x0, H - y0))
shutil.rmtree(tmp)
