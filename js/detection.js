/* Détection du brossage (façon Pokémon Smile), tout sur le téléphone.
   - MediaPipe Face Landmarker (assets/vision/, Apache 2.0) repère le visage et la bouche.
   - On mesure le mouvement autour de la bouche (main + brosse qui vont et viennent), moins le mouvement
     du front (la tête qui bouge, la lumière qui change) : beaucoup de mouvement à la bouche = on brosse.
   - Côté : le manche et la main sortent du côté de la bouche qu'on brosse (approximatif).
   PERFORMANCE (audit) :
   - le modèle tourne sur le processeur (CPU) : sur la carte graphique, relire chaque résultat (readPixels)
     bloquait l'affichage (85 % du temps mesuré) ;
   - l'analyse continue du brossage tourne dans un Web Worker (js/detection-worker.js) sur une image réduite
     (480 px) : rien ne bloque l'affichage. Si le worker est impossible, repli sur le fil principal ;
   - les mesures ponctuelles des photos (visage, mains) ont leur propre modèle, chargé seulement en mode photos.
   Aucune image ne quitte le téléphone. Si le modèle ne charge pas, statut = "indisponible" et le jeu
   marche comme avant. */
(function () {
  "use strict";
  const SRC = document.currentScript.src;
  const BASE = new URL("../assets/vision/", SRC).href;
  const PERIODE = 110;           // ms entre deux analyses (~9 par seconde)
  const LARGEUR_ANALYSE = 480;   // l'image est réduite avant l'analyse (le modèle travaille en 192 px de toute façon)
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

  const etat = {
    statut: "eteint",            // eteint | chargement | pret | indisponible (analyse du brossage)
    photos: false,               // modèle des photos prêt (visage + placement)
    visage: false, brosse: false, niveau: 0, cote: null,
    bouche: null,                // { x, y, l } en fraction de l'image brute (non miroir) : centre et largeur du visage
    cadre: null,                 // { cx, haut, h } : le visage (fractions), pour recentrer la fenêtre caméra
    zones: null,                 // pour le mode debug
    tempsVisible: 0, tempsBrosse: 0
  };
  let worker = null, occupe = false, video = null, minuteur = 0, enPause = false, chargement = null;
  let lisse = 0, lisseG = 0, lisseD = 0, sousDepuis = 0, dernierVisage = 0, dernier = 0;
  let secours = null;            // analyse sur le fil principal si le worker est impossible

  // décision à partir d'un résultat d'analyse (worker ou secours)
  function traiter(r) {
    const maintenant = performance.now(), dt = dernier ? Math.min(.5, (maintenant - dernier) / 1000) : 0;
    dernier = maintenant;
    if (!r.visage) {
      if (maintenant - dernierVisage > 600) { etat.visage = false; etat.brosse = false; etat.bouche = null; lisse = 0; }
      return;
    }
    dernierVisage = maintenant; etat.visage = true; etat.tempsVisible += dt;
    etat.bouche = r.bouche; etat.cadre = r.cadre; etat.zones = r.zones;
    if (!r.mouv) return;
    const mB = r.mouv.b, mF = r.mouv.f;
    // la tête qui bouge ou la lumière qui change font aussi bouger la bouche : on l'enlève
    lisse += (Math.max(0, mB.t - 1.3 * mF.t) - lisse) * .35;
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

  function charger() {
    if (chargement) return chargement;
    etat.statut = "chargement";
    chargement = new Promise(ok => {
      try {
        worker = new Worker(new URL("detection-worker.js", SRC).href);
        const delai = setTimeout(() => repli("délai"), 45000);
        worker.onmessage = e => {
          const m = e.data;
          if (m.type === "pret") { clearTimeout(delai); etat.statut = "pret"; ok(); }
          else if (m.type === "erreur") { clearTimeout(delai); repli(m.message); }
          else if (m.type === "resultat") { occupe = false; if (!enPause && video) traiter(m); }
        };
        worker.onerror = () => { clearTimeout(delai); repli("worker"); };
        worker.postMessage({ type: "init" });
      } catch (e) { repli(e.message); }
      // secours : même analyse, sur le fil principal
      let repliFait = false;
      function repli(raison) {
        if (repliFait) return;
        repliFait = true;
        console.warn("Détection : repli sur le fil principal", raison);
        try { worker && worker.terminate(); } catch (e) {}
        worker = null;
        chargerSecours().then(() => { etat.statut = "pret"; ok(); })
          .catch(err => { console.warn("Détection indisponible", err); etat.statut = "indisponible"; ok(); });
      }
    });
    return chargement;
  }

  async function chargerSecours() {
    const { FilesetResolver, FaceLandmarker } = await import(BASE + "vision_bundle.mjs");
    const fichiers = await FilesetResolver.forVisionTasks(BASE.replace(/\/$/, ""));
    const modele = await FaceLandmarker.createFromOptions(fichiers, {
      baseOptions: { modelAssetPath: BASE + "face_landmarker.task", delegate: "CPU" },
      runningMode: "VIDEO", numFaces: 1, minFaceDetectionConfidence: .4, minFacePresenceConfidence: .4, minTrackingConfidence: .4
    });
    const RW = 40, RH = 24, cv = document.createElement("canvas"); cv.width = RW; cv.height = RH * 2;
    const g = cv.getContext("2d", { willReadFrequently: true });
    let hist = [], ts0 = 0;
    const ech = (src, z, l) => {
      g.drawImage(src, z.x, z.y, z.w, z.h, 0, l * RH, RW, RH);
      const d = g.getImageData(0, l * RH, RW, RH).data, s = new Uint8Array(RW * RH);
      for (let i = 0, j = 0; j < s.length; i += 4, j++) s[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
      return s;
    };
    const bouge = (a, b) => {
      let t = 0, gg = 0, dd = 0;
      for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) { const k = y * RW + x; if (Math.abs(a[k] - b[k]) > R.DIFF) { t++; if (x < RW / 2) gg++; else dd++; } }
      const n = RW * RH; return { t: t / n, g: gg / (n / 2), d: dd / (n / 2) };
    };
    secours = {
      reset() { hist = []; },
      analyser(src) {
        const ts = Math.max(performance.now(), ts0 + 1); ts0 = ts;
        const lm = (modele.detectForVideo(src, ts).faceLandmarks || [])[0];
        if (!lm) { hist = []; return { visage: false }; }
        const vw = src.videoWidth, vh = src.videoHeight, P = i => ({ x: lm[i].x * vw, y: lm[i].y * vh });
        const gq = P(234), dq = P(454), h = P(13), b = P(14), f = P(151), L = Math.hypot(dq.x - gq.x, dq.y - gq.y);
        const M = { x: (h.x + b.x) / 2, y: (h.y + b.y) / 2 };
        const borne = r => { const x = Math.max(0, r.x), y = Math.max(0, r.y); return { x, y, w: Math.max(4, Math.min(vw, r.x + r.w) - x), h: Math.max(4, Math.min(vh, r.y + r.h) - y) }; };
        const zB = borne({ x: M.x - .8 * L, y: M.y - .3 * L, w: 1.6 * L, h: .95 * L }), zF = borne({ x: f.x - .4 * L, y: f.y - .2 * L, w: .8 * L, h: .35 * L });
        const front = lm[10].y, menton = lm[152].y, haut = front - .22 * (menton - front);
        const out = { visage: true, bouche: { x: M.x / vw, y: M.y / vh, l: L / vw }, cadre: { cx: (lm[234].x + lm[454].x) / 2, haut, h: menton - haut }, zones: { b: zB, f: zF, vw, vh } };
        const e = ech(src, zB, 0), r = ech(src, zF, 1);
        hist.push([e, r]); if (hist.length > R.RECUL + 1) hist.shift();
        if (hist.length > R.RECUL) out.mouv = { b: bouge(hist[0][0], e), f: bouge(hist[0][1], r) };
        return out;
      }
    };
  }

  function analyser() {
    minuteur = setTimeout(analyser, PERIODE);
    if (enPause || !video || video.readyState < 2 || !video.videoWidth) return;
    if (worker && etat.statut === "pret") {
      if (occupe) return;                                    // une analyse à la fois : jamais de file d'attente
      occupe = true;
      const w = Math.min(LARGEUR_ANALYSE, video.videoWidth), h = Math.round(w * video.videoHeight / video.videoWidth);
      createImageBitmap(video, { resizeWidth: w, resizeHeight: h, resizeQuality: "low" })
        .then(bmp => worker.postMessage({ type: "image", bmp, ts: performance.now() }, [bmp]))
        .catch(() => { occupe = false; });
    } else if (secours) {
      try { traiter(secours.analyser(video)); } catch (e) {}
    }
  }

  /* modèles des photos (fil principal, seulement en mode photos) : visage en mode image + mains */
  let photosModele = null, photosChargement = null, mainsModele = null, mainsChargement = null;
  function chargerPhotos() {
    if (photosChargement) return photosChargement;
    photosChargement = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import(BASE + "vision_bundle.mjs");
      const fichiers = await FilesetResolver.forVisionTasks(BASE.replace(/\/$/, ""));
      photosModele = await FaceLandmarker.createFromOptions(fichiers, {
        baseOptions: { modelAssetPath: BASE + "face_landmarker.task", delegate: "CPU" }, runningMode: "IMAGE", numFaces: 1
      });
      etat.photos = true;
    })().catch(e => console.warn("Visage (photos) indisponible", e));
    return photosChargement;
  }
  function chargerMains() {
    if (mainsChargement) return mainsChargement;
    mainsChargement = (async () => {
      const { FilesetResolver, HandLandmarker } = await import(BASE + "vision_bundle.mjs");
      const fichiers = await FilesetResolver.forVisionTasks(BASE.replace(/\/$/, ""));
      mainsModele = await HandLandmarker.createFromOptions(fichiers, {
        baseOptions: { modelAssetPath: BASE + "hand_landmarker.task", delegate: "CPU" }, runningMode: "IMAGE", numHands: 2
      });
    })().catch(e => console.warn("Mains indisponibles", e));
    return mainsChargement;
  }

  function reglerWorker() {
    if (worker) worker.postMessage({ type: "reglages", recul: R.RECUL, diff: R.DIFF });
    if (secours) secours.reset();
  }

  window.BeufaDetection = {
    etat,
    prechauffer: charger,
    // mode photos : visage (placement, taille) et mains (contact)
    prechaufferPhotos() { chargerPhotos(); chargerMains(); },
    prechaufferMains: chargerMains,
    // à appeler avec la vidéo de la caméra quand le brossage commence ; brosse = "manuelle" | "electrique"
    demarrer(v, brosse) {
      if (new URLSearchParams(location.search).get("detection") === "0") return;
      R = REGLAGES[brosse] || REGLAGES.manuelle;
      video = v; enPause = false; lisse = lisseG = lisseD = 0; sousDepuis = 0; dernier = 0; occupe = false;
      Object.assign(etat, { visage: false, brosse: false, niveau: 0, cote: null, bouche: null, cadre: null, zones: null, tempsVisible: 0, tempsBrosse: 0 });
      clearTimeout(minuteur);
      charger().then(() => { if (video && etat.statut === "pret") { reglerWorker(); clearTimeout(minuteur); analyser(); } });
    },
    /* visage sur une image ou une vidéo (studio photo) : { cx, haut, h } en fraction de la source
       (cx = centre ; haut = haut de la tête, cheveux compris à peu près ; h = hauteur de la tête), ou null */
    visage(source) {
      if (!photosModele) return null;
      try {
        const lm = (photosModele.detect(source).faceLandmarks || [])[0];
        if (!lm) return null;
        const front = lm[10].y, menton = lm[152].y, haut = front - .22 * (menton - front);
        return { cx: (lm[234].x + lm[454].x) / 2, haut, h: menton - haut };
      } catch (e) { return null; }
    },
    /* mains sur une image : [{ x, y, taille }] en fraction de l'image (x, y = centre de la main ;
       taille = poignet -> milieu de la main, en fraction de la HAUTEUR : dépend peu de l'orientation) */
    mains(source) {
      if (!mainsModele) return [];
      try {
        const r = mainsModele.detect(source), W = source.width || source.videoWidth, H = source.height || source.videoHeight;
        return (r.landmarks || []).map(l => ({
          x: l.reduce((a, p) => a + p.x, 0) / l.length, y: l.reduce((a, p) => a + p.y, 0) / l.length,
          taille: Math.hypot((l[0].x - l[9].x) * W, (l[0].y - l[9].y) * H) / H
        }));
      } catch (e) { return []; }
    },
    pause(oui) {
      enPause = oui; occupe = false;
      if (worker) worker.postMessage({ type: "reset" });
      if (secours) secours.reset();
      if (oui) etat.brosse = false;
    },
    arreter() { clearTimeout(minuteur); video = null; etat.visage = etat.brosse = false; etat.bouche = null; etat.cadre = null; }
  };
})();
