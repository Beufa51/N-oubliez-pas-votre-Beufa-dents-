# Décors du brossage

Déposer ici une image par décor, avec ces noms exacts (WebP ou à convertir en WebP) :

| Fichier | Décor |
|---|---|
| `champignons.webp` | Pays des champignons (style original, pas un jeu ou un film existant) |
| `volcan.webp` | Volcan |
| `neige.webp` | Village enneigé |
| `montagne.webp` | Montagne |
| `lagon.webp` | Lagon |

- Format **portrait**, environ **1080 × 1920** (l'écran du téléphone), sinon l'image est floue ou très recadrée.
- Le centre de l'image est caché par le schéma ou la caméra : les détails jolis sur les **bords** et en **haut/bas**.
- Seuls les décors dont l'image existe apparaissent dans le choix « 🎨 Décor » de l'accueil (sinon rien ne change).
- Images **à nous** (Gemini, photos perso) : pas d'images de films, de jeux ou de banques d'images payantes,
  l'appli est publique sur GitHub Pages.
- Ajouter un autre décor : une ligne dans `DECORS` (`js/app.js`) + son image ici.
- Conversion : `python3 -c "from PIL import Image; Image.open('photo.jpg').save('assets/decors/lagon.webp', quality=80)"`
