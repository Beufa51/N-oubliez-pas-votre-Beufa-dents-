# N'oubliez pas votre Beufa dents

Appli web (PWA) de brossage de dents ludique, avec une mascotte brosse à dents espiègle.
Voir `IDEES.md` pour le carnet d'idées et la feuille de route.

## État
- ✅ Mode **Classique** : choix 1 ou 2 min, minuteur, 4 zones, 3 faces par zone, pause de 3 s toutes les 30 s, mascotte, sons/vibrations, écran qui reste allumé.
- ⏳ Mode **Beufa dents** (poses + photos + montage) : à venir.

## Lancer en local
```
python3 -m http.server 8000
```
Puis ouvrir http://localhost:8000. Astuce de test : `?vitesse=10` accélère le temps.

## Mettre en ligne (gratuit)
GitHub Pages (Settings > Pages > branche choisie, dossier `/`) : le HTTPS est fourni, indispensable pour la caméra plus tard.
Sur le téléphone : ouvrir l'adresse puis « Ajouter à l'écran d'accueil ».

## Images
`assets/mascotte/*.jpg` : originaux (fond vert). `assets/mascotte/png/` : détourés (générés par `python3 tools/detourer.py`).
