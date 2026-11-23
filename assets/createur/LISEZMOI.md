# Photos du créateur (mode Beufa dents)

Photos **détourées** (WebP à fond transparent, contour blanc déjà inclus), une par pose :

| Fichier | Ta photo | L'autre moitié du geste (consigne à l'utilisateur) | Côté | Cible |
|---|---|---|---|---|
| `high-five.webp` | main levée vers lui | « Tape dans la main de l'ombre : high five ! » | droite | ta main ici |
| `check-poing.webp` | poing tendu | « Ton poing contre le sien : check ! » | droite | ton poing ici |
| `pouce.webp` | V + main sur la hanche | « Fais le V de la victoire, comme l'ombre ! » | gauche | — |
| `pointe.webp` | tu montres la caméra | « Montre l'ombre du doigt : c'est toi ! » | gauche | — |
| `bras-croises.webp` | de profil, bras croisés (photo 2) | « De profil, bras croisés, ton dos contre son dos ! » | droite | ton dos ici |
| `mains-hanches.webp` | paumes vers le haut, en bas | « Mains à plat au-dessus des siennes : tape dedans ! » | droite | tes mains ici |

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

