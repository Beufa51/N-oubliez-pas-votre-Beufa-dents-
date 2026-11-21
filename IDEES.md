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

## Précisions (session 2)

### Mascotte = avatar + guide + modèle de pose
- Mascotte en forme de brosse à dents, générée avec Gemini (PNG fond transparent, même style pour toutes les poses).
- Pendant la pause de 3 s, la mascotte prend une pose à imiter, compte à rebours 3-2-1, puis photo de l'utilisateur.
- Chaque pose = une image de mascotte + une photo du créateur dans la même pose.
- Nombre de poses selon la durée : 2 min -> 3 ou 4 poses ; 1 min -> 1 ou 2 poses.
- Poses bouche libre (l'utilisateur ne brosse pas pendant la pause).
- Pas de vérification automatique de la pose : compte à rebours + photo, sans jamais bloquer.

### Deux modes au démarrage
- **Mode Classique** : minuteur, zones, pauses, mascotte. Sans pose ni photo, caméra facultative.
- **Mode Beufa dents** : poses, photos et montage avec le créateur.
- Parcours : choix du mode -> durée (1/2 min) -> avatar -> brossage.

### Conseils de travail
- /clear après chaque étape terminée et poussée ; mettre IDEES.md à jour avant.
- Opus pour la conception et les parties difficiles (caméra, montage) ; Sonnet pour le courant.

## Ordre de développement suggéré

1. Écran de choix du mode + minuteur 1/2 min + pauses + schéma des zones (mode Classique complet, sans caméra).
2. Affichage caméra frontale en miroir + avatar sur le côté.
3. Avatars Gemini intégrés.
4. Mode Beufa dents : poses de la mascotte, capture photo, montage avec les photos du créateur.
5. Suivi de la bouche (MediaPipe) et effets ludiques.
