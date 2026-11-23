/* Incrustation dans le décor (façon Pokémon Smile), tout sur le téléphone.
   MediaPipe Selfie Segmenter (assets/vision/selfie_segmenter.tflite, 250 Ko) détoure la personne en direct ;
   on dessine l'image de la caméra (en miroir) seulement là où il y a la personne, sur un canvas transparent :
   le décor de l'écran se voit derrière. Si le modèle ne charge pas, statut = "indisponible" et l'appli
   garde la caméra normale. */
(function () {
  "use strict";
  const BASE = new URL("../assets/vision/", document.currentScript.src).href;
  let PERIODE = 66;              // ms entre deux détourages (~15 par seconde), rallongé si le téléphone peine
  const etat = { statut: "eteint", image: false, personne: 0 };   // personne : indice du masque « personne »
  let moyenne = 0, seg = null, chargement = null, video = null, sortie = null, actif = false, raf = 0, dernier = 0, img = null;
  const masque = document.createElement("canvas"), gm = masque.getContext("2d", { willReadFrequently: true });

  function charger() {
    if (chargement) return chargement;
    etat.statut = "chargement";
    chargement = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import(BASE + "vision_bundle.mjs");
      const fichiers = await FilesetResolver.forVisionTasks(BASE.replace(/\/$/, ""));
      const options = d => ({
        baseOptions: { modelAssetPath: BASE + "selfie_segmenter.tflite", delegate: d },
        runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false
      });
      // petit modèle (250 Ko) : le processeur suffit et évite de relire le masque depuis la carte graphique
      // (lent sur téléphone) ; la carte graphique reste libre pour la détection du visage
      seg = await ImageSegmenter.createFromOptions(fichiers, options("CPU"));
      etat.statut = "pret";
    })().catch(e => { console.warn("Incrustation indisponible", e); etat.statut = "indisponible"; });
    return chargement;
  }

  function dessiner() {
    const c = sortie, g = c.getContext("2d");
    g.save();
    g.clearRect(0, 0, c.width, c.height);
    g.translate(c.width, 0); g.scale(-1, 1);              // miroir, comme la caméra à l'écran
    g.drawImage(video, 0, 0, c.width, c.height);
    g.globalCompositeOperation = "destination-in";        // on ne garde que la personne
    g.imageSmoothingEnabled = true;
    g.drawImage(masque, 0, 0, c.width, c.height);
    g.restore();
    // bords de l'image de la caméra fondus (le corps coupé par le cadre se fond dans le décor)
    g.save(); g.globalCompositeOperation = "destination-out";
    const fondu = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
    };
    const W = c.width, H = c.height, b = H * .22, l = W * .08;
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
          masque.width = w; masque.height = h; img = gm.createImageData(w, h);
          for (let i = 0; i < w * h; i++) img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
        }
        // bord adouci : en dessous de 35 % de confiance transparent, au-dessus de 70 % opaque
        for (let i = 0; i < w * h; i++) {
          const a = (d[i] - .35) / .35;
          img.data[i * 4 + 3] = a <= 0 ? 0 : a >= 1 ? 255 : a * 255;
        }
        gm.putImageData(img, 0, 0);
        dessiner();
        // téléphone lent : si un détourage prend plus de 25 ms, on en fait moins souvent (jusqu'à ~6 par seconde)
        const duree = performance.now() - t0;
        moyenne = moyenne ? moyenne * .9 + duree * .1 : duree;
        PERIODE = moyenne > 25 ? Math.min(160, PERIODE + 10) : Math.max(66, PERIODE - 5);
      });
    } catch (e) {}
  }

  window.BeufaIncrustation = {
    etat,
    prechauffer: charger,
    // video : la caméra ; canvas : là où dessiner la personne détourée (dimensionné par l'appli)
    demarrer(v, canvas) {
      if (new URLSearchParams(location.search).get("incrustation") === "0") return;
      video = v; sortie = canvas; actif = true; etat.image = false;
      charger();
      cancelAnimationFrame(raf); raf = requestAnimationFrame(boucle);
    },
    pause(oui) { actif = !oui; },
    arreter() { actif = false; cancelAnimationFrame(raf); video = null; etat.image = false; }
  };
})();
