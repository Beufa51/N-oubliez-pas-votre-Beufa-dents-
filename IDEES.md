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

### Décisions (session 3)
- **Une seule mascotte**, **6 à 8 poses** (pas de choix d'avatar pour l'instant).
- La pose de la mascotte donne le geste de l'**utilisateur** ; les photos du créateur sont une **réponse complémentaire**, pas une copie.
  Exemples : check de poing, oreilles de lapin avec les doigts derrière la tête de l'utilisateur, high five, main sur la tête, cornes.
- Chaque pose = un **gabarit de montage** : image de la mascotte + photo du créateur détourée (faite une fois, en amont) + zone de placement de l'utilisateur (au bord pour un check de poing, en bas au centre pour des oreilles de lapin) + ordre des calques (créateur devant ou derrière l'utilisateur).
- **Cadre-guide** affiché sur la caméra pendant le 3-2-1 pour aider l'utilisateur à se placer.
- Prise de vue du créateur : même téléphone, distance, éclairage et fond uni pour un détourage propre.
- Détourage de l'utilisateur sur son téléphone (MediaPipe) ; repli sur un simple côte à côte si ça échoue.
- Les poses « au bord de l'image » sont les plus simples ; celles « derrière l'utilisateur » sont les plus drôles mais exigent le détourage.

### Conseils de travail
- /clear après chaque étape terminée et poussée ; mettre IDEES.md à jour avant.
- Opus pour la conception et les parties difficiles (caméra, montage) ; Sonnet pour le courant.

## Ordre de développement suggéré

1. Écran de choix du mode + minuteur 1/2 min + pauses + schéma des zones (mode Classique complet, sans caméra).
2. Affichage caméra frontale en miroir + avatar sur le côté.
3. Avatars Gemini intégrés.
4. Mode Beufa dents : poses de la mascotte, capture photo, montage avec les photos du créateur.
5. Suivi de la bouche (MediaPipe) et effets ludiques.

## Avancement
- [x] Mascotte : 7 poses générées avec Gemini, détourées (`assets/mascotte/png/`).
- [x] Étape 1 : mode Classique (minuteur 1/2 min, zones, pauses 3 s, mascotte).
- [x] Étape 2 : caméra frontale en miroir (option « Miroir » à l'accueil, petite vue schéma/caméra échangeable d'un appui, repli sans caméra si refus).
- [x] Étape 3 : mode Beufa dents (poses, photos, montage avec le créateur).
  - Caméra obligatoire dans ce mode (repli sur le brossage sans photo si refus).
  - À chaque pause (toutes les 30 s) + une **pose finale** : 2 min = 4 photos, 1 min = 2 photos. Poses tirées au hasard parmi 7.
  - Pause photo de 4 s : carte en haut (mascotte + consigne), caméra en grand au format 3:4, cadre-guide « Ta tête ici » + partenaire en transparence, 3-2-1, flash, « Clic ! ».
  - Montage 1080×1440 sur le téléphone : photo miroir + partenaire au bord (photo du créateur si présente dans `assets/createur/`, sinon la mascotte) + bandeau « Brossé avec Beufa » et date.
  - Écran de fin : galerie, agrandissement, Enregistrer / Partager. Rien n'est envoyé sur un serveur.
  - Retour du test (session 4) : mascotte peu visible, pas assez ludique, pas le temps de prendre la pose. Corrigé :
    alerte rose 5 s avant chaque photo, pause photo de 7,3 s (2,5 s pour voir la pose + 3-2-1 + 1,8 s d'aperçu),
    Beufa en grand et opaque qui arrive en sautant, danse pendant le compte, saute au clic, bulle avec la consigne
    puis une réaction (« Quelle star ! »), aperçu façon polaroïd ; sur le montage, Beufa plus grand avec étoiles et bulle.
  - Retour du test (session 5) : caméra trop zoomée, Beufa trop petit, on ne comprend pas la pose. Corrigé par un **studio plein écran** :
    1) 3 s de démonstration : Beufa en très grand sur fond de rayons, « Fais comme moi ! » + consigne ;
    2) caméra plein écran au format réel de la caméra (image entière, plus de recadrage), Beufa grand à côté, gros 3-2-1 ;
    3) aperçu + réaction. La photo n'est plus recadrée et le montage garde le format de la caméra. Vrai plein écran (sans barres du navigateur) en mode Beufa dents.
- [x] Audit « utilisateur régulier » (session 6) et corrections :
  - écran **Installe-toi !** avant le mode Beufa dents (téléphone debout, recule, aperçu caméra, bouton « Je suis prêt ! ») ;
  - **Beufa parle** (voix du téléphone, aucun fichier) : zones, faces, pauses, alerte photo, consigne, 3-2-1, réaction, bravo ;
  - rappel « ✋ Pose ta brosse » pendant la démonstration, « Reprends ta brosse ! » après la photo ;
  - croix **✕** pour quitter pendant l'installation et les poses ;
  - bouton **🔊 / 🔇** (accueil, brossage, studio), mémorisé sur le téléphone ;
  - pauses du mode Classique gardées (choix du créateur).
- [x] Audit « fun » n°1 (session 6), points 1 à 5 faits :
  - **prénom** facultatif (gardé sur le téléphone) : « C'est parti Léo ! », « Bravo Léo ! », sur les photos ;
  - **Beufa vivant** : change de pose et saute à chaque zone/face, **mini-défi** à chaque zone (« Brosse sur un seul pied ! »), encouragements ;
  - **pauses Classique** = « Fais comme moi ! » (pose de Beufa, sans photo) ;
  - **planche BD** « Les aventures de Léo & Beufa » qui réunit toutes les photos ;
  - **fête de fin** : fanfare, Beufa qui danse, les 4 zones validées une à une.
- [x] Audit « fun » n°2 (inspiré de Disney Magic Timer, Pokémon Smile, Colgate Magik, Sonicare Kids, Brush DJ), points 1 à 3 faits :
  - **microbes à chasser** : un microbe par dent (24), qui éclate (« POP ! ») quand la dent est propre ; le dernier de chaque zone est un **chef** couronné (« CHEF K.O. ! ») ; compteur 🦠 ;
  - **carte surprise** : une carte cachée sous 4 tuiles « ? », une tuile tombe à chaque zone terminée, la carte est gagnée à la fin ;
  - **album** de 21 cartes (Beufa + chapeau + objet, ex. Beufa Magicien, Roi Beufa, Beufa et le Dino), dont **3 rares** gagnées tous les **7 jours d'affilée** ;
  - **calendrier** matin / soir (14 jours), **série de jours**, record, total de brossages et de microbes ; barre de suivi sur l'accueil.
  - Tout est enregistré sur le téléphone (rien sur un serveur). Une carte n'est gagnée que si le brossage va jusqu'au bout.
- [x] Rappels par notification : **abandonnés** (décision du créateur, peu fiables dans une appli web).
- [x] Concept photo précisé (session 7) : la **mascotte guide** (elle montre le geste), le **créateur est la surprise**.
  - Pendant la photo : Beufa en petit dans la consigne en haut, et une **place gardée** en pointillés (« Place gardée pour une surprise ») là où le créateur apparaîtra ; sa photo n'est jamais montrée avant.
  - Après le brossage : écran **« Surprise ! »** pour chaque photo : la photo de l'utilisateur, roulement de tambour, puis la photo du créateur glisse et vient la compléter. Ensuite seulement : carte gagnée, planche BD.
  - Tant que les photos du créateur ne sont pas déposées dans `assets/createur/`, c'est Beufa qui arrive à leur place.
  - L'utilisateur peut être un **adulte** (le premier en sera un).
- [x] **Utilisateurs** (session 7) : on choisit « Qui se brosse les dents ? » sur l'accueil (prénom + âge, bouton « Ajouter »,
  ✏️ pour modifier ou supprimer). Chaque utilisateur a **son album, sa série et son calendrier**.
  - **Au-dessus de 16 ans, ton adulte** : défis plus « pub de dentifrice / yoga / agent secret » que « gros yeux / robot »,
    encouragements sobres (« Impeccable. », « Ton dentiste serait fier. »), « bactéries éliminées » au lieu de « microbes vaincus ».
  - L'âge est demandé avant le premier brossage. Reprise automatique du prénom et de l'album de la version précédente.
- [x] **Interface plus fun** (session 8) : police ronde Fredoka (intégrée, licence OFL, marche hors ligne), fond « mousse »
  avec des bulles qui montent, titre façon logo, Beufa qui salue avec une bulle (selon l'heure, le prénom et le ton),
  choix en grosses pastilles colorées avec emojis et coche, boutons « bonbon » roses, minuteur en dégradé,
  pauses et titres dans l'ambiance du studio.
- [x] **Panneau-titre** fourni par le créateur (« N'oubliez votre ~~brosse~~ Beufa dents », style néon et paillettes) en haut de l'accueil :
  recadré sur le panneau (coins arrondis transparents), `assets/titre.webp`, léger halo néon qui pulse.
- [x] **Thème « plateau télé »** accordé au panneau-titre : nuit bleue / violette avec halos magenta et cyan, paillettes qui
  tombent et étoiles qui scintillent, panneaux en verre sombre bordés de néon, boutons dorés façon enseigne, titres dorés
  lumineux, sélections qui s'allument en néon ; halo blanc autour de Beufa pour qu'il ressorte ; bulles de BD gardées blanches.
- [x] Retours du test (session 9) : caméra du brossage en image entière (plus de zoom), ovale « Ta tête ici » toujours debout,
  caméra demandée sans format imposé. **Tampon du jour** « BROSSÉ ! + date + matin/soir » sur la dernière photo (coup de tampon
  pendant la révélation) : pas besoin d'une image par jour. Les 21 cartes de l'album marchent avec les emojis, les images Gemini restent facultatives.
- [x] **Intro en musique** (session 9) : panneau-titre en grand qui bat au rythme, projecteurs, bouton
  « Appuie pour continuer ». Générique « Votre plus beau sourire » (Suno, `assets/intro.mp3`) joué **une seule fois**
  (la boucle sans paroles a été retirée à la demande du créateur, ainsi que Beufa qui dansait sur l'intro).
  Si le téléphone bloque le son, « Touche l'écran pour lancer la musique » ; 🔊/🔇 respecté ;
  fondu à la sortie ; pause si l'appli passe en arrière-plan.
  - Avant l'intro, un écran **« Appuyez sur l'écran »** (doigt qui tapote, texte doré lumineux) : cet appui autorise le son
    sur les téléphones, l'intro s'ouvre et la musique démarre aussitôt.
- [x] **Musique de fond de l'interface** (session 9) : « Game Show Groove » (Suno, sans paroles, `assets/fond.mp3`, réencodée
  en 112 kb/s). Démarre avec son intro puis boucle sur 85 mesures de groove (3,516 s → 161,652 s, 129 BPM ; points trouvés
  par ressemblance du son). Joue sur l'accueil et l'album, fondu d'entrée, s'arrête pendant le brossage et reprend où elle
  en était ; 🔊/🔇 respecté ; pause si l'appli passe en arrière-plan.
- [x] **Mises à jour visibles tout de suite** (session 9) : la copie hors ligne prend désormais toujours la dernière version
  en ligne des pages, scripts et styles quand il y a du réseau (la copie ne sert qu'hors ligne), télécharge sans passer par
  le cache du navigateur, et l'appli se recharge seule quand une nouvelle version s'installe (jamais en plein brossage).
- [x] Retours du test (session 10) : pendant le brossage avec la caméra, **schéma en petit en bas à gauche** (la caméra du
  téléphone est en haut, le visage aussi), Beufa plus petit, carte surprise à droite. Studio photo : **4 s pour se placer**
  (ovale doré qui clignote, « Place-toi ! », « Mets ta tête dans l'ovale, et fais la pose ! ») avant le 3-2-1 : on voit la
  caméra environ 7 s avant la photo au lieu de 3.
- [x] **Audit fun / pratique / envie** (session 10, note 6/10) — points 2, 3, 4 et 9 faits :
  - **réglages retenus par utilisateur** (mode, durée, caméra, photos) ; le générique passe **à chaque ouverture**
    (choix du créateur, on le passe avec « Appuie pour continuer ») ;
  - **musique de fond tout bas pendant le brossage** (sous la voix de Beufa), arrêtée pour la fanfare de fin ;
  - mode Beufa dents **« 2 photos » (rapide) ou « 4 photos » (le grand show)** : la rubrique Photos remplace Caméra dans ce mode ;
  - **« tu » partout** (« Appuie sur l'écran ») et textes clés plus gros pour être lus de loin.
- [ ] Reste de l'audit (session 10) : tes photos (priorité 1), journal photo (planche BD du jour gardée dans l'album),
  progression après les 21 cartes, défi famille / récompenses des parents, ta voix enregistrée.
- [ ] Audit fun n°2, reste : Beufa qui évolue (porte ses déguisements, content / boudeur), autocollants sur les photos,
  récompenses fixées par les parents, musique de 2 min, masques/chapeaux sur le visage (étape 5).
- [ ] Petits restes du 1er audit (séries, matin/soir, réglages retenus et planche BD déjà faits) : accueil qui défile un peu
  sur très petit écran (iPhone SE) ; téléphone couché pendant les poses ; rappel « 2 min recommandé » ; accessibilité des choix.
- [ ] Photos du créateur à prendre et détourer (voir `assets/createur/LISEZMOI.md`).
- [ ] Images Gemini facultatives : Beufa déguisé pour les 21 cartes (fond vert #00FF00, même style que les poses),
  icône de l'appli dans le style du panneau néon (carrée, sans texte), pose « check de poing ».
- À vérifier sur le téléphone du créateur : affichage de la caméra (image entière ou bande étroite si elle filme à
  l'horizontale), raccord de la boucle de la musique de fond.
- [ ] Plus tard : détourage de l'utilisateur (MediaPipe) pour les poses « créateur derrière » (oreilles de lapin, main sur la tête, cornes).
- Poses à ajouter plus tard : check de poing (à refaire quand Gemini sera de nouveau disponible).
