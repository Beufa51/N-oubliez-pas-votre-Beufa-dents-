/* Analyse du brossage en arrière-plan (Web Worker « classique ») : l'appli reste fluide pendant que le modèle
   du visage travaille. Reçoit une image réduite de la caméra (ImageBitmap), renvoie la position de la bouche,
   du visage, et la part de pixels qui ont bougé autour de la bouche et sur le front (référence).
   La décision « on brosse / on ne brosse pas » (lissage, seuils) reste dans js/detection.js. */
"use strict";
const BASE = new URL("../assets/vision/", self.location.href).href;
const RW = 40, RH = 24;                 // taille de l'échantillon de la zone de la bouche
let modele = null, cv = null, g = null, hist = [], recul = 1, diff = 22, dernierTs = 0;

self.onmessage = async e => {
  const m = e.data;
  if (m.type === "init") {
    try {
      const { FilesetResolver, FaceLandmarker } = await import(BASE + "vision_bundle.mjs");
      const fichiers = await FilesetResolver.forVisionTasks(BASE.replace(/\/$/, ""));
      modele = await FaceLandmarker.createFromOptions(fichiers, {
        baseOptions: { modelAssetPath: BASE + "face_landmarker.task", delegate: "CPU" },
        runningMode: "VIDEO", numFaces: 1,
        minFaceDetectionConfidence: .4, minFacePresenceConfidence: .4, minTrackingConfidence: .4
      });
      cv = new OffscreenCanvas(RW, RH * 2); g = cv.getContext("2d", { willReadFrequently: true });
      self.postMessage({ type: "pret" });
    } catch (err) { self.postMessage({ type: "erreur", message: String(err && err.message || err) }); }
  } else if (m.type === "reglages") { recul = m.recul; diff = m.diff; hist = []; }
  else if (m.type === "reset") hist = [];
  else if (m.type === "image") {
    let r = { type: "resultat", visage: false };
    try { r = analyser(m.bmp, m.ts); } catch (err) {}
    m.bmp.close();
    self.postMessage(r);
  }
};

function echantillon(bmp, z, ligne) {
  g.drawImage(bmp, z.x, z.y, z.w, z.h, 0, ligne * RH, RW, RH);
  const d = g.getImageData(0, ligne * RH, RW, RH).data, s = new Uint8Array(RW * RH);
  for (let i = 0, j = 0; j < s.length; i += 4, j++) s[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  return s;
}
// part des pixels qui ont bougé (en tout, moitié gauche, moitié droite de l'image brute)
function bouge(a, b) {
  let t = 0, gg = 0, dd = 0;
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    const k = y * RW + x;
    if (Math.abs(a[k] - b[k]) > diff) { t++; if (x < RW / 2) gg++; else dd++; }
  }
  const n = RW * RH;
  return { t: t / n, g: gg / (n / 2), d: dd / (n / 2) };
}

function analyser(bmp, ts) {
  ts = Math.max(ts, dernierTs + 1); dernierTs = ts;
  const res = modele.detectForVideo(bmp, ts), lm = res && res.faceLandmarks && res.faceLandmarks[0];
  if (!lm) { hist = []; return { type: "resultat", visage: false }; }
  const vw = bmp.width, vh = bmp.height, P = i => ({ x: lm[i].x * vw, y: lm[i].y * vh });
  const gq = P(234), dq = P(454), h = P(13), b = P(14), f = P(151);
  const L = Math.hypot(dq.x - gq.x, dq.y - gq.y);              // largeur du visage
  const M = { x: (h.x + b.x) / 2, y: (h.y + b.y) / 2 };         // centre de la bouche
  const borne = r => {
    const x = Math.max(0, r.x), y = Math.max(0, r.y);
    return { x, y, w: Math.max(4, Math.min(vw, r.x + r.w) - x), h: Math.max(4, Math.min(vh, r.y + r.h) - y) };
  };
  const zB = borne({ x: M.x - .8 * L, y: M.y - .3 * L, w: 1.6 * L, h: .95 * L });   // bouche, main, manche
  const zF = borne({ x: f.x - .4 * L, y: f.y - .2 * L, w: .8 * L, h: .35 * L });    // front (référence)
  const front = lm[10].y, menton = lm[152].y, haut = front - .22 * (menton - front);
  const out = {
    type: "resultat", visage: true,
    bouche: { x: M.x / vw, y: M.y / vh, l: L / vw },
    cadre: { cx: (lm[234].x + lm[454].x) / 2, haut, h: menton - haut },
    zones: { b: zB, f: zF, vw, vh }
  };
  const e = echantillon(bmp, zB, 0), r = echantillon(bmp, zF, 1);
  hist.push([e, r]); if (hist.length > recul + 1) hist.shift();
  if (hist.length > recul) out.mouv = { b: bouge(hist[0][0], e), f: bouge(hist[0][1], r) };
  return out;
}
