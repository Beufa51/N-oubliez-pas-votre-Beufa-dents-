/* Détection du brossage (façon Pokémon Smile), tout sur le téléphone.
   - MediaPipe Face Landmarker (assets/vision/, Apache 2.0) repère le visage et la bouche.
   - On mesure le mouvement autour de la bouche (main + brosse qui vont et viennent), moins le mouvement
     du front (la tête qui bouge, la lumière qui change) : beaucoup de mouvement à la bouche = on brosse.
   - Côté : le manche et la main sortent du côté de la bouche qu'on brosse (approximatif).
   Aucune image ne quitte le téléphone. Si le modèle ne charge pas, statut = "indisponible" et le jeu
   marche comme avant. */
(function () {
  "use strict";
  const BASE = new URL("../assets/vision/", document.currentScript.src).href;
  const PERIODE = 80;            // ms entre deux analyses (~12 par seconde)
  /* Réglages selon la brosse :
     - manuelle : va-et-vient rapide -> on compare deux images qui se suivent ;
     - électrique : la main glisse lentement et la vibration des poils est trop rapide et trop fine pour
       la caméra -> on compare avec l'image d'il y a ~0,4 s (RECUL), seuils plus bas, arrêt plus tolérant.
     SEUIL_ON : score lissé au-dessus duquel on brosse ; SEUIL_OFF : en dessous, on ne brosse plus
     (après ARRET_APRES secondes) ; DIFF : écart de gris (0-255) pour qu'un pixel « bouge ». */
  const REGLAGES = {
    manuelle:   { RECUL: 1, DIFF: 22, SEUIL_ON: .06,  SEUIL_OFF: .03,  ARRET_APRES: 1.1 },
    electrique: { RECUL: 5, DIFF: 16, SEUIL_ON: .035, SEUIL_OFF: .018, ARRET_APRES: 2.5 }
  };
  let R = REGLAGES.manuelle;
  const RW = 40, RH = 24;        // taille de l'échantillon de la zone de la bouche

  const etat = {
    statut: "eteint",            // eteint | chargement | pret | indisponible
    visage: false, brosse: false, niveau: 0, cote: null,
    bouche: null,                // { x, y, l } en fraction de l'image brute (non miroir) : centre et largeur du visage
    zones: null,                 // pour le mode debug
    tempsVisible: 0, tempsBrosse: 0
  };
  let landmarker = null, chargement = null, video = null, minuteur = 0, enPause = false;
  let hist = [], lisse = 0, lisseG = 0, lisseD = 0, sousDepuis = 0, dernierVisage = 0, dernier = 0;
  const cv = document.createElement("canvas"); cv.width = RW; cv.height = RH * 2;
  const cx = cv.getContext("2d", { willReadFrequently: true });

  function charger() {
    if (chargement) return chargement;
    etat.statut = "chargement";
    chargement = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import(BASE + "vision_bundle.mjs");
      const fichiers = await FilesetResolver.forVisionTasks(BASE.replace(/\/$/, ""));
      const options = d => ({
        baseOptions: { modelAssetPath: BASE + "face_landmarker.task", delegate: d },
        runningMode: "VIDEO", numFaces: 1,
        minFaceDetectionConfidence: .4, minFacePresenceConfidence: .4, minTrackingConfidence: .4
      });
      try { landmarker = await FaceLandmarker.createFromOptions(fichiers, options("GPU")); }
      catch (e) { landmarker = await FaceLandmarker.createFromOptions(fichiers, options("CPU")); }
      etat.statut = "pret";
    })().catch(e => { console.warn("Détection indisponible", e); etat.statut = "indisponible"; });
    return chargement;
  }

  // échantillon gris d'un rectangle de l'image (coordonnées en pixels de la vidéo)
  function echantillon(r, ligne) {
    cx.drawImage(video, r.x, r.y, r.w, r.h, 0, ligne * RH, RW, RH);
    const d = cx.getImageData(0, ligne * RH, RW, RH).data, g = new Uint8Array(RW * RH);
    for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    return g;
  }
  // part des pixels qui ont bougé (en tout, moitié gauche, moitié droite de l'image brute)
  function bouge(a, b) {
    if (!a || !b) return null;
    let t = 0, g = 0, d = 0;
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const k = y * RW + x;
      if (Math.abs(a[k] - b[k]) > R.DIFF) { t++; if (x < RW / 2) g++; else d++; }
    }
    const n = RW * RH;
    return { t: t / n, g: g / (n / 2), d: d / (n / 2) };
  }

  function analyser() {
    minuteur = setTimeout(analyser, PERIODE);
    if (enPause || !landmarker || !video || video.readyState < 2 || !video.videoWidth) return;
    const maintenant = performance.now(), dt = dernier ? Math.min(.5, (maintenant - dernier) / 1000) : 0;
    dernier = maintenant;
    let res;
    try { res = landmarker.detectForVideo(video, maintenant); } catch (e) { return; }
    const lm = res && res.faceLandmarks && res.faceLandmarks[0];
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!lm) {
      if (maintenant - dernierVisage > 600) { etat.visage = false; etat.brosse = false; etat.bouche = null; hist = []; lisse = 0; }
      return;
    }
    dernierVisage = maintenant; etat.visage = true; etat.tempsVisible += dt;
    const P = i => ({ x: lm[i].x * vw, y: lm[i].y * vh });
    const g = P(234), d = P(454), h = P(13), b = P(14), f = P(151);
    const L = Math.hypot(d.x - g.x, d.y - g.y);                 // largeur du visage
    const M = { x: (h.x + b.x) / 2, y: (h.y + b.y) / 2 };        // centre de la bouche
    const borne = r => {                                         // rectangle dans l'image
      const x = Math.max(0, r.x), y = Math.max(0, r.y);
      return { x, y, w: Math.max(4, Math.min(vw, r.x + r.w) - x), h: Math.max(4, Math.min(vh, r.y + r.h) - y) };
    };
    const zB = borne({ x: M.x - .8 * L, y: M.y - .3 * L, w: 1.6 * L, h: .95 * L });  // bouche, main, manche
    const zF = borne({ x: f.x - .4 * L, y: f.y - .2 * L, w: .8 * L, h: .35 * L });   // front (référence)
    etat.bouche = { x: M.x / vw, y: M.y / vh, l: L / vw };
    etat.zones = { b: zB, f: zF, vw, vh };
    const e = echantillon(zB, 0), r = echantillon(zF, 1);
    hist.push([e, r]); if (hist.length > R.RECUL + 1) hist.shift();
    if (hist.length <= R.RECUL) return;
    const mB = bouge(hist[0][0], e), mF = bouge(hist[0][1], r);
    // la tête qui bouge ou la lumière qui change font aussi bouger la bouche : on l'enlève
    const brut = Math.max(0, mB.t - 1.3 * mF.t);
    lisse += (brut - lisse) * .35;
    lisseG += (Math.max(0, mB.g - 1.3 * mF.t) - lisseG) * .2;
    lisseD += (Math.max(0, mB.d - 1.3 * mF.t) - lisseD) * .2;
    etat.niveau = Math.min(1, lisse / (R.SEUIL_ON * 2.5));
    if (lisse > R.SEUIL_ON) { etat.brosse = true; sousDepuis = 0; }
    else if (lisse < R.SEUIL_OFF) { sousDepuis += dt; if (sousDepuis > R.ARRET_APRES) etat.brosse = false; }
    if (etat.brosse) etat.tempsBrosse += dt;
    // image brute : la gauche de l'image = la droite de la personne
    const fort = Math.max(lisseG, lisseD), faible = Math.min(lisseG, lisseD);
    etat.cote = etat.brosse && fort > R.SEUIL_ON && fort > 1.7 * faible ? (lisseD > lisseG ? "gauche" : "droite") : null;
  }

  window.BeufaDetection = {
    etat,
    // à appeler avec la vidéo de la caméra quand le brossage commence ; brosse = "manuelle" | "electrique"
    demarrer(v, brosse) {
      if (new URLSearchParams(location.search).get("detection") === "0") return;
      R = REGLAGES[brosse] || REGLAGES.manuelle;
      video = v; enPause = false; hist = []; lisse = lisseG = lisseD = 0; sousDepuis = 0; dernier = 0;
      Object.assign(etat, { visage: false, brosse: false, niveau: 0, cote: null, bouche: null, zones: null, tempsVisible: 0, tempsBrosse: 0 });
      clearTimeout(minuteur);
      charger().then(() => { if (video && landmarker) { clearTimeout(minuteur); analyser(); } });
    },
    pause(oui) { enPause = oui; hist = []; if (oui) etat.brosse = false; },
    arreter() { clearTimeout(minuteur); video = null; etat.visage = etat.brosse = false; etat.bouche = null; },
    prechauffer: charger
  };
})();
