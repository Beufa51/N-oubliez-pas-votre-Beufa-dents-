/* Incrustation dans le décor (façon Pokémon Smile), tout sur le téléphone.
   MediaPipe Selfie Segmenter (assets/vision/selfie_segmenter.tflite, 250 Ko) détoure la personne en direct ;
   on dessine l'image de la caméra (en miroir) seulement là où il y a la personne, sur un canvas transparent :
   le décor de l'écran se voit derrière. Si le modèle ne charge pas, statut = "indisponible" et l'appli
   garde la caméra normale.
   - masque strict (évite les bouts de mur) et lissé d'une image à l'autre (bords qui ne clignotent pas) ;
   - cadrage automatique : tête ramenée au centre en haut, et zoom arrière si on est trop près ;
   - cadence qui baisse toute seule si le téléphone peine. */
(function () {
  "use strict";
  const BASE = new URL("../assets/vision/", document.currentScript.src).href;
  const SEUIL_BAS = .55, SEUIL_HAUT = .85;   // confiance « personne » : en dessous transparent, au-dessus opaque
  const LISSAGE = .55;                       // part de la nouvelle image dans le masque (le reste = images d'avant)
  const CIBLE_X = .5, CIBLE_HAUT = .12;      // où placer le haut de la tête (fraction de l'image)
  const LARGEUR_MAX = .42;                   // largeur max de la tête en haut de l'image : au-delà, zoom arrière
  let PERIODE = 80;                          // ms entre deux détourages (~12 par seconde), rallongé si besoin
  const etat = { statut: "eteint", image: false, personne: 0 };   // personne : indice du masque « personne »
  let moyenne = 0, seg = null, chargement = null, video = null, sortie = null, actif = false, raf = 0, dernier = 0;
  let img = null, conf = null;
  const masque = document.createElement("canvas"), gm = masque.getContext("2d", { willReadFrequently: true });

  function charger() {
    if (chargement) return chargement;
    etat.statut = "chargement";
    chargement = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import(BASE + "vision_bundle.mjs");
      const fichiers = await FilesetResolver.forVisionTasks(BASE.replace(/\/$/, ""));
      // petit modèle (250 Ko) : le processeur suffit et évite de relire le masque depuis la carte graphique
      seg = await ImageSegmenter.createFromOptions(fichiers, {
        baseOptions: { modelAssetPath: BASE + "selfie_segmenter.tflite", delegate: "CPU" },
        runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false
      });
      etat.statut = "pret";
    })().catch(e => { console.warn("Incrustation indisponible", e); etat.statut = "indisponible"; });
    return chargement;
  }

  /* cadrage : (cx, haut) = centre et haut de la tête dans l'image en miroir, z = zoom ; lissés */
  let cx = .5, haut = .1, z = 1, cadreVu = false;
  function cadrer(px, w, h) {
    let y0 = -1;
    for (let y = 0; y < h && y0 < 0; y++) {
      let n = 0;
      for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 128) n++;
      if (n > w * .03) y0 = y;
    }
    if (y0 < 0) return;                                  // personne : on garde le dernier cadrage
    let sx = 0, n = 0;
    const fin = Math.min(h, y0 + Math.round(h * .15));   // le haut de la tête
    for (let y = y0; y < fin; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 128) { sx += x; n++; }
    if (!n) return;
    // largeur de la personne un peu sous le haut de la tête (visage) : trop large = trop près
    const yl = Math.min(h - 1, y0 + Math.round(h * .12));
    let g = w, d = -1;
    for (let x = 0; x < w; x++) if (px[(yl * w + x) * 4 + 3] > 128) { if (x < g) g = x; d = x; }
    const larg = d >= g ? (d - g + 1) / w : 0;
    const zz = larg > LARGEUR_MAX ? Math.max(.55, LARGEUR_MAX / larg) : 1;
    const ncx = 1 - sx / n / w, nh = y0 / h;              // à l'écran, l'image est en miroir
    const k = cadreVu ? .12 : 1; cadreVu = true;
    cx += (ncx - cx) * k; haut += (nh - haut) * k; z += (zz - z) * k;
  }

  function dessiner() {
    const c = sortie, g = c.getContext("2d"), W = c.width, H = c.height;
    g.save();
    g.clearRect(0, 0, W, H);
    // la tête (cx, haut) va en (CIBLE_X, CIBLE_HAUT), avec le zoom z
    g.translate(CIBLE_X * W, CIBLE_HAUT * H); g.scale(z, z); g.translate(-cx * W, -haut * H);
    g.save();
    g.translate(W, 0); g.scale(-1, 1);                    // miroir, comme la caméra à l'écran
    g.drawImage(video, 0, 0, W, H);
    g.globalCompositeOperation = "destination-in";        // on ne garde que la personne
    g.imageSmoothingEnabled = true;
    g.drawImage(masque, 0, 0, W, H);
    g.restore();
    // bords de l'image de la caméra fondus (le corps coupé par le cadre se fond dans le décor)
    g.globalCompositeOperation = "destination-out";
    const fondu = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
    };
    const b = H * .22, l = W * .08;
    fondu(0, H, 0, H - b, 0, H - b, W, b);         // bas
    fondu(0, 0, l, 0, 0, 0, l, H);                 // gauche
    fondu(W, 0, W - l, 0, W - l, 0, l, H);         // droite
    g.restore();
    etat.image = true;
  }

  function boucle(t) {
    raf = requestAnimationFrame(boucle);
    if (!actif || !seg || !video || !sortie || video.readyState < 2 || !video.videoWidth || !sortie.width) return;
    if (t - dernier < PERIODE) return;
    dernier = t;
    const t0 = performance.now();
    try {
      seg.segmentForVideo(video, performance.now(), res => {
        const ms = res.confidenceMasks;
        if (!ms || !ms.length) return;
        const m = ms[Math.min(etat.personne, ms.length - 1)], w = m.width, h = m.height, d = m.getAsFloat32Array();
        if (masque.width !== w || masque.height !== h || !img) {
          masque.width = w; masque.height = h; img = gm.createImageData(w, h); conf = new Float32Array(w * h);
          for (let i = 0; i < w * h; i++) img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
          conf.set(d);
        }
        for (let i = 0; i < w * h; i++) {
          const c = conf[i] = conf[i] + (d[i] - conf[i]) * LISSAGE;
          const a = (c - SEUIL_BAS) / (SEUIL_HAUT - SEUIL_BAS);
          img.data[i * 4 + 3] = a <= 0 ? 0 : a >= 1 ? 255 : a * 255;
        }
        gm.putImageData(img, 0, 0);
        cadrer(img.data, w, h);
        dessiner();
        // téléphone lent : si un détourage prend plus de 25 ms, on en fait moins souvent (jusqu'à ~5 par seconde)
        const duree = performance.now() - t0;
        moyenne = moyenne ? moyenne * .9 + duree * .1 : duree;
        PERIODE = moyenne > 25 ? Math.min(200, PERIODE + 10) : Math.max(80, PERIODE - 5);
      });
    } catch (e) {}
  }

  window.BeufaIncrustation = {
    etat,
    prechauffer: charger,
    // video : la caméra ; canvas : là où dessiner la personne détourée (dimensionné par l'appli)
    demarrer(v, canvas) {
      if (new URLSearchParams(location.search).get("incrustation") === "0") return;
      video = v; sortie = canvas; actif = true; etat.image = false; cadreVu = false; img = null;
      charger();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(boucle);
    },
    pause(oui) { actif = !oui; },
    arreter() { actif = false; cancelAnimationFrame(raf); video = null; etat.image = false; }
  };
})();
