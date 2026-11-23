/* Incrustation dans le décor (façon Pokémon Smile), tout sur le téléphone.
   Le détourage (MediaPipe Selfie Segmenter, 250 Ko) tourne dans un Web Worker (js/incrustation-worker.js) sur une
   petite image (256 px) ~15 fois par seconde ; ici on ne fait que dessiner, à chaque image de l'écran : la caméra
   en miroir, gardée seulement là où il y a la personne, recentrée (tête au centre en haut, zoom arrière si on est
   trop près), bords de l'image fondus. Tant que le détourage n'est pas prêt, l'appli garde la fenêtre caméra. */
(function () {
  "use strict";
  const SRC = document.currentScript.src;
  const CIBLE_X = .5, CIBLE_HAUT = .12;   // où placer le haut de la tête (fraction de l'image)
  const PERIODE = 66;                     // ms entre deux demandes de détourage (~15 par seconde)
  const LARGEUR = 256;                    // largeur de l'image envoyée au détourage (le modèle travaille en 256)
  const etat = { statut: "eteint", image: false };
  let worker = null, chargement = null, occupe = false, video = null, actif = false, minuteur = 0;
  let cx = .5, haut = .1, z = 1, cadreVu = false, img = null;
  const masque = document.createElement("canvas"), gm = masque.getContext("2d");

  function charger() {
    if (chargement) return chargement;
    etat.statut = "chargement";
    chargement = new Promise(ok => {
      try {
        worker = new Worker(new URL("incrustation-worker.js", SRC).href);
        worker.onmessage = e => {
          const m = e.data;
          if (m.type === "pret") { etat.statut = "pret"; ok(); }
          else if (m.type === "erreur") { etat.statut = "indisponible"; ok(); }
          else if (m.type === "masque") recevoir(m);
          else occupe = false;
        };
        worker.onerror = () => { etat.statut = "indisponible"; ok(); };
        worker.postMessage({ type: "init" });
      } catch (e) { etat.statut = "indisponible"; ok(); }
    });
    return chargement;
  }

  function recevoir(m) {
    occupe = false;
    if (!actif) return;
    if (masque.width !== m.w || masque.height !== m.h || !img) {
      masque.width = m.w; masque.height = m.h; img = gm.createImageData(m.w, m.h);
      for (let i = 0; i < m.w * m.h; i++) img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
    }
    for (let i = 0; i < m.w * m.h; i++) img.data[i * 4 + 3] = m.alpha[i];
    gm.putImageData(img, 0, 0);
    if (m.personne) {
      const k = cadreVu ? .12 : 1; cadreVu = true;
      cx += (m.cx - cx) * k; haut += (m.haut - haut) * k; z += (m.z - z) * k;
    }
    etat.image = true;
  }

  function demander() {
    if (!actif || occupe || etat.statut !== "pret" || !video || video.readyState < 2 || !video.videoWidth) return;
    occupe = true;
    const h = Math.round(LARGEUR * video.videoHeight / video.videoWidth);
    createImageBitmap(video, { resizeWidth: LARGEUR, resizeHeight: h, resizeQuality: "low" })
      .then(bmp => worker.postMessage({ type: "image", bmp, ts: performance.now() }, [bmp]))
      .catch(() => { occupe = false; });
  }

  window.BeufaIncrustation = {
    etat,
    prechauffer: charger,
    demarrer(v) {
      if (new URLSearchParams(location.search).get("incrustation") === "0") return;
      video = v; actif = true; etat.image = false; cadreVu = false; img = null; occupe = false;
      charger().then(() => { if (worker && etat.statut === "pret") worker.postMessage({ type: "reset" }); });
      clearInterval(minuteur); minuteur = setInterval(demander, PERIODE);
    },
    pause(oui) { actif = !oui; },
    arreter() { actif = false; clearInterval(minuteur); video = null; etat.image = false; },
    // point de l'image brute (fractions, non miroir) -> fraction du dessin (après miroir, recentrage et zoom)
    ecran(nx, ny) { return { x: CIBLE_X + z * ((1 - nx) - cx), y: CIBLE_HAUT + z * (ny - haut) }; },
    zoom: () => z,
    // dessine la personne détourée dans le canvas (appelé à chaque image par l'appli)
    dessiner(c) {
      if (!etat.image || !video) return;
      const g = c.getContext("2d"), W = c.width, H = c.height;
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      g.translate(CIBLE_X * W, CIBLE_HAUT * H); g.scale(z, z); g.translate(-cx * W, -haut * H);
      g.save();
      g.translate(W, 0); g.scale(-1, 1);                    // miroir, comme la caméra à l'écran
      g.drawImage(video, 0, 0, W, H);
      g.globalCompositeOperation = "destination-in";        // on ne garde que la personne
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
      fondu(0, H, 0, H - b, 0, H - b, W, b);
      fondu(0, 0, l, 0, 0, 0, l, H);
      fondu(W, 0, W - l, 0, W - l, 0, l, H);
      g.restore();
    }
  };
})();
