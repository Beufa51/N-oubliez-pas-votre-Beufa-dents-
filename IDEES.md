# N'oubliez pas votre Beufa dents — Carnet d'idées

> Jeu de mots sur « N'oubliez pas votre brosse à dents ».
> Statut : **idées seulement**, rien n'est développé pour l'instant.

## Concept

Application web de brossage de dents, ludique, utilisée depuis le navigateur
d'un smartphone (Android en priorité, mais tout navigateur mobile récent).
Pas de publication sur le Play Store.

## Fonctionnalités voulues

1. **Caméra frontale** : comme les applis de brossage classiques, l'écran
   indique quelle zone de la bouche brosser (haut/bas, gauche/droite,
   face externe/interne).
2. **Durée au choix** : 1 minute ou 2 minutes.
3. **Avatars brosse à dents** : images rigolotes de brosses à dents dans
   différentes positions, générées avec Gemini. L'utilisateur choisit son avatar.
4. **Pauses guidées** : toutes les X secondes (piste : 30 s), pause de 3 s
   signalée par la petite brosse à dents sur le côté de l'écran.
5. **Photo souvenir finale** : des photos du créateur de l'appli sont prises au
   préalable dans différentes poses. Pendant/à la fin du brossage, l'appli
   prend des photos de l'utilisateur et les juxtapose aux siennes pour donner
   l'impression qu'ils se brossent les dents ensemble.

## Questions encore ouvertes

- Intervalle des pauses : 30 s ? (avec 2 min = 4 zones de 30 s, ça tombe bien :
  une pause = changement de zone).
- Combien de photos du créateur / de poses ?
- Les photos de l'utilisateur sont-elles prises automatiquement ou sur
  déclenchement ? Sauvegarde/partage de la photo finale ?
- Son / musique / voix ?

## Notes de faisabilité (avis de Claude)

| Élément | Faisabilité | Remarque |
|---|---|---|
| Appli web mobile (PWA) | Facile | Installable sur l'écran d'accueil sans Play Store. HTTPS obligatoire pour la caméra (GitHub Pages convient). |
| Minuteur 1/2 min + pauses | Facile | |
| Guidage par zones | Facile | Version simple : le guidage suit le minuteur (zone = tranche de temps), affiché sur un schéma de bouche. |
| Détection réelle de la brosse/bouche par caméra | Moyen à difficile | MediaPipe Face Landmarker (gratuit, tourne dans le navigateur) repère la bouche ; savoir *quelle* zone est réellement brossée est peu fiable. Recommandé : caméra en « miroir » + suivi de la bouche pour placer des effets, sans prétendre vérifier le brossage. |
| Avatars générés par Gemini | Facile | Fond transparent (PNG) à prévoir pour les superposer. Garder un même style pour toutes les poses. |
| Montage photo « ensemble » | Moyen | Détourage de l'utilisateur possible dans le navigateur (MediaPipe Selfie Segmentation) puis composition côte à côte avec les photos du créateur sur un fond commun. Simple côte à côte d'abord, détourage ensuite. |
| Vie privée | À soigner | Tout peut rester sur le téléphone : aucune photo envoyée sur un serveur. |

## Idées bonus

- Petits « monstres à plaque dentaire » qui disparaissent au fil du brossage.
- Série de jours consécutifs (streak) et badges, stockés sur le téléphone.
- La brosse-avatar parle/réagit (« Pause ! », « Côté gauche maintenant ! »).
- Galerie des photos souvenirs « avec le créateur ».
- Mode enfant avec voix et couleurs plus vives.

## Ordre de développement suggéré

1. Minuteur + choix 1/2 min + pauses + schéma des zones (sans caméra).
2. Affichage caméra frontale en miroir + avatar sur le côté.
3. Avatars Gemini intégrés.
4. Capture photo + montage avec les photos du créateur.
5. Suivi de la bouche (MediaPipe) et effets ludiques.
