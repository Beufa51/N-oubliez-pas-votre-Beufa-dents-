# Photos du créateur (mode Beufa dents)

Photos **détourées** (WebP à fond transparent, contour blanc déjà inclus), une par pose :

| Fichier | Ta photo | Ce que fait l'utilisateur | Ton côté | Contact |
|---|---|---|---|---|
| `high-five.webp` | main levée vers lui | tape dans ta main | droite | paume |
| `check-poing.webp` | poing tendu | son poing contre le tien | droite | poing |
| `pouce.webp` | V + grand sourire | V + sourire, toutes dents dehors (pose finale) | droite | — |
| `pointe.webp` | tu le montres du doigt | il te montre du doigt | droite | — |
| `mains-hanches.webp` | paume vers le haut | tape dans tes mains (par-dessus) | droite | dessous |
| `bras-croises.webp` | de profil, bras croisés | dos à dos | droite | — |
| `pensif.webp` | main au menton | pensif aussi | gauche | — |

Photos refaites (session 12) : de près, téléphone à hauteur de visage, fond uni. `anim-<id>.webp` = ombres animées tirées
de courtes vidéos (`tools/animations.py`), montrées sur l'écran « Voilà la photo qu'on va faire ! ».

Pendant la photo, l'utilisateur voit **ton ombre** à ta vraie place (avec un « ? », la photo reste une surprise)
et une **cible dorée** là où doit aller sa main (`cible` dans `POSES_BEUFA`, en fraction de ta photo).

Pas de photo pour « cœur » et « pensif » : Beufa prend la place du créateur (rien ne casse).
Les poses avec une photo du créateur passent en premier.

## Ajouter ou refaire une photo
1. Photo verticale, le corps coupé par le bas de l'image, le geste vers l'utilisateur (de l'autre côté).
   Idéal : téléphone à hauteur des yeux, sans lampe du plafond dans le champ (reflet bleu sur le visage).
2. Détourage : `pip install rembg onnxruntime scipy` puis
   `python3 tools/createur.py ma-photo.jpg <id>` (crée `assets/createur/<id>.webp`).
3. Dans `js/app.js` (`POSES_BEUFA`), donner à la pose un `photo: { tete, hh, top, dx }` :
   - `tete` = [haut des cheveux, menton, centre du visage] en fraction de l'image détourée ;
   - `hh` = taille de sa tête, `top` = hauteur de sa tête, `dx` = distance de son visage au bord,
     en fraction de la hauteur de la photo de l'utilisateur (≈ .27, .15, .2).
4. Ajouter le fichier dans `sw.js` (copie hors ligne).

## Contours de la pose de l'utilisateur
Pour les gestes « en miroir » (high five, check, V, dos à dos), le contour de ce que doit faire l'utilisateur est ta photo
retournée : `python3 tools/contours.py` crée `contour-<id>.webp`. Il apparaît sur l'aperçu « Voilà la photo qu'on va faire ! »
et sur la caméra, calé sur l'ovale de la tête. Pour une nouvelle pose en miroir : ajouter son id dans `tools/contours.py`
et `contour: true` dans `POSES_BEUFA`.

## Rendu réaliste et contact des mains
- Les détourages n'ont plus de contour blanc (`CONTOUR = 0` dans `tools/createur.py`, bord adouci).
- Dans l'appli, le créateur est un calque : couleurs accordées à la photo de l'utilisateur, léger flou et grain, ombre douce.
- `tete` = mesurée avec le modèle du visage de l'appli (haut estimé, menton, centre), comme pour l'utilisateur.
- `main` (high five, check, tape dans les mains) = centre de la main et taille (poignet -> milieu de la main, en fraction
  de la hauteur), mesurés avec le modèle des mains. Sur la photo de l'utilisateur, sa main est mesurée de la même façon :
  le créateur prend la même taille de main et les deux mains se touchent.

## Mode créateur (pour refaire les photos)
Sur l'accueil : bouton ⚙️ (en haut à gauche) > « 📸 Prendre mes photos de pose » (ouvert à tous les utilisateurs).
Choisir la pose, poser le téléphone debout à hauteur de visage (caméra avant), à la distance de l'utilisateur ;
tête dans l'ovale doré (ton côté), l'ovale gris = la place de l'utilisateur. « Photo dans 10 s », puis « Enregistrer ».
La photo est en miroir, comme celles de l'utilisateur. L'envoyer à Claude : détourage (`tools/createur.py`), mesures
(visage, main) et mise à jour de `POSES_BEUFA`.

## Vidéos (il entre, fait le geste, se fige)
`python3 tools/videos.py <video.mp4> <id> <début_s> <fin_s>` : images détourées (12/s) dans `video/<id>/`, et la dernière
image en grand comme photo fixe `<id>.webp`. Ensuite : mesurer tête/main sur la photo fixe, `video: N` dans `POSES_BEUFA`,
`python3 tools/contours.py`. Vidéos en place : check, V (double), cool (nouvelle pose), cœur, pensif (le créateur est à droite).
Filmer : téléphone posé, entrer par la droite, faire le geste, rester figé ~1 s ; éviter la lampe juste derrière la tête.

## Session 13 : que des vidéos
Toutes les poses sont des vidéos (tournées de plus loin, sans la lampe derrière la tête) : high five, check, double V
(photo finale), cool, cœur, montre du doigt, pensif, bras croisés (il surgit du bas), tape dans mes mains, ta-da (il saute
dans l'image). High five, check et montre du doigt : vidéos retournées (`miroir`) ; tape dans mes mains et pensif retournés
ensuite, pour qu'il soit tourné vers l'utilisateur. Les anciennes photos et ombres animées sont remplacées.

