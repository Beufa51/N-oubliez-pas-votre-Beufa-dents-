# Photos du créateur (mode Beufa dents)

Photos **détourées** (WebP à fond transparent, contour blanc déjà inclus), une par pose :

| Fichier | Geste de l'utilisateur (montré par Beufa) | Réponse du créateur | Côté du créateur |
|---|---|---|---|
| `high-five.webp` | lève la main | tend la main : high five | droite |
| `check-poing.webp` | tend son poing (👊) | tend son poing : check | droite |
| `pouce.webp` | pouce en l'air | V de la victoire, main sur la hanche | gauche |
| `pointe.webp` | montre du doigt la place gardée | le montre du doigt en retour | gauche |
| `bras-croises.webp` | croise les bras | croise les bras aussi (duo de choc) | droite |
| `mains-hanches.webp` | mains sur les hanches, en champion | le présente des deux mains (« ta-da ! ») | droite |

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
