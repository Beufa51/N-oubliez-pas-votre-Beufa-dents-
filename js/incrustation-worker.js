/* Détourage de la personne en arrière-plan (Web Worker « classique »), pour l'incruster dans le décor.
   Reçoit une petite image de la caméra (ImageBitmap), renvoie le masque (transparence 0-255, prêt à dessiner)
   et le cadrage (où est la tête, zoom). L'affichage (js/incrustation.js) ne fait que dessiner : rien ne bloque. */
"use strict";
const BASE = new URL("../assets/vision/", self.location.href).href;
const SEUIL_BAS = .55, SEUIL_HAUT = .85;   // confiance « personne » : en dessous transparent, au-dessus opaque
const LISSAGE = .55;                       // part de la nouvelle image dans le masque (bords qui ne clignotent pas)
const LARGEUR_MAX = .42;                   // largeur max de la tête en haut de l'image : au-delà, zoom arrière
let seg = null, conf = null, dernierTs = 0;

self.onmessage = async e => {
  const m = e.data;
  if (m.type === "init") {
    try {
      const { FilesetResolver, ImageSegmenter } = await import(BASE + "vision_bundle.mjs");
      const fichiers = await FilesetResolver.forVisionTasks(BASE.replace(/\/$/, ""));
      seg = await ImageSegmenter.createFromOptions(fichiers, {
        baseOptions: { modelAssetPath: BASE + "selfie_segmenter.tflite", delegate: "CPU" },
        runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false
      });
      self.postMessage({ type: "pret" });
    } catch (err) { self.postMessage({ type: "erreur", message: String(err && err.message || err) }); }
  } else if (m.type === "reset") conf = null;
  else if (m.type === "image") {
    let r = null;
    try { r = detourer(m.bmp, m.ts); } catch (err) {}
    m.bmp.close();
    if (r) self.postMessage(r, [r.alpha.buffer]); else self.postMessage({ type: "rien" });
  }
};

function detourer(bmp, ts) {
  ts = Math.max(ts, dernierTs + 1); dernierTs = ts;
  const res = seg.segmentForVideo(bmp, ts), ms = res && res.confidenceMasks;
  if (!ms || !ms.length) return null;
  const mk = ms[0], w = mk.width, h = mk.height, d = mk.getAsFloat32Array();
  if (!conf || conf.length !== w * h) conf = Float32Array.from(d);
  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    const c = conf[i] = conf[i] + (d[i] - conf[i]) * LISSAGE;
    const a = (c - SEUIL_BAS) / (SEUIL_HAUT - SEUIL_BAS);
    alpha[i] = a <= 0 ? 0 : a >= 1 ? 255 : a * 255;
  }
  if (res.close) res.close();
  return Object.assign({ type: "masque", w, h, alpha }, cadrer(alpha, w, h));
}

/* cadrage : haut et centre de la tête (dans l'image en miroir), et zoom arrière si on est trop près */
function cadrer(px, w, h) {
  let y0 = -1;
  for (let y = 0; y < h && y0 < 0; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (px[y * w + x] > 128) n++;
    if (n > w * .03) y0 = y;
  }
  if (y0 < 0) return { personne: false };
  let sx = 0, n = 0;
  const fin = Math.min(h, y0 + Math.round(h * .15));
  for (let y = y0; y < fin; y++) for (let x = 0; x < w; x++) if (px[y * w + x] > 128) { sx += x; n++; }
  if (!n) return { personne: false };
  const yl = Math.min(h - 1, y0 + Math.round(h * .12));
  let g = w, d = -1;
  for (let x = 0; x < w; x++) if (px[yl * w + x] > 128) { if (x < g) g = x; d = x; }
  const larg = d >= g ? (d - g + 1) / w : 0;
  return { personne: true, cx: 1 - sx / n / w, haut: y0 / h, z: larg > LARGEUR_MAX ? Math.max(.55, LARGEUR_MAX / larg) : 1 };
}
