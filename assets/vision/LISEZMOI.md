# Détection du brossage

- `vision_bundle.mjs`, `vision_wasm_internal.js`, `vision_wasm_internal.wasm` : MediaPipe Tasks Vision 1.2.2
  (Google, licence Apache 2.0, paquet npm `@mediapipe/tasks-vision`).
- `face_landmarker.task` : modèle Face Landmarker de Google (float16, version 1).

Copiés ici pour que la détection marche hors ligne et sans dépendre d'un autre site.
Ils ne sont téléchargés par le téléphone qu'au premier brossage avec caméra (~18 Mo), puis gardés
(cache `beufa-vision-1.2.2` de `sw.js`, à renommer si on change de version).
Le code qui les utilise : `js/detection.js`.
