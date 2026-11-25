/* Dents « méga blanches » : blanchit seulement les dents, à l'intérieur du contour intérieur des lèvres
   (repéré par le modèle du visage), et seulement les pixels clairs et peu colorés (pas la langue ni le fond
   de la bouche). Le contour est resserré d'un poil et adouci : rien ne déborde sur les lèvres. */
(function () {
  "use strict";
  // contour intérieur des lèvres (Face Landmarker), dans l'ordre
  const LEVRES = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  window.BeufaDents = {
    // points du contour (fractions de l'image) à partir des repères du visage
    contour: lm => LEVRES.map(i => [lm[i].x, lm[i].y]),
    // blanchit sur le contexte g (image W×H) ; poly en fractions ; force 0..1
    blanchir(g, poly, W, H, force = .85) {
      if (!poly || poly.length < 6) return;
      const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
      const pts = poly.map(([x, y]) => [(cx + (x - cx) * .86) * W, (cy + (y - cy) * (y > cy ? .72 : .9)) * H]);   // resserré (surtout en bas : reflet de la lèvre)
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 2), y0 = Math.max(0, Math.floor(Math.min(...ys)) - 2);
      const x1 = Math.min(W, Math.ceil(Math.max(...xs)) + 2), y1 = Math.min(H, Math.ceil(Math.max(...ys)) + 2);
      const w = x1 - x0, h = y1 - y0;
      if (w < 4 || h < 3) return;                                       // bouche fermée : rien
      // masque adouci de l'ouverture de la bouche
      const m = document.createElement("canvas"); m.width = w; m.height = h;
      const gm = m.getContext("2d", { willReadFrequently: true });
      gm.filter = `blur(${Math.max(.6, h * .04)}px)`;
      gm.beginPath(); pts.forEach(([x, y], k) => k ? gm.lineTo(x - x0, y - y0) : gm.moveTo(x - x0, y - y0)); gm.closePath();
      gm.fillStyle = "#fff"; gm.fill();
      const ma = gm.getImageData(0, 0, w, h).data;
      const id = g.getImageData(x0, y0, w, h), d = id.data;
      // niveau des dents dans cette bouche (les pixels les plus clairs) pour s'adapter à la lumière
      // référence = les pixels les plus clairs de la bouche (les dents) : leur luminosité et leur teinte
      const px = [];
      for (let i = 0; i < d.length; i += 4) if (ma[i] > 128) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        px.push([(r + gg + b) / 3, (r - gg) / Math.max(1, r)]);
      }
      if (px.length < 8) return;
      px.sort((p, q) => p[0] - q[0]);
      const clairs = px.slice(Math.floor(px.length * .85));
      const lumRef = clairs[Math.floor(clairs.length / 2)][0];
      const teinteRef = clairs.map(p => p[1]).sort((p, q) => p - q)[Math.floor(clairs.length / 2)];
      const seuil = Math.max(55, lumRef * .62);
      // 1) force du blanchiment pour chaque pixel ; 2) lissée (pas de mouchetis) ; 3) appliquée
      const P = new Float32Array(w * h);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        const a = ma[i] / 255; if (!a) continue;
        const r = d[i], gg = d[i + 1], b = d[i + 2], L = (r + gg + b) / 3;
        const ecart = (r - gg) / Math.max(1, r) - teinteRef;               // plus rouge que les dents = lèvre, langue
        const rose = (r - gg) / Math.max(1, r);
        P[j] = a * lisse(seuil, seuil + 25, L) * (1 - lisse(.06, .14, ecart)) * (1 - lisse(.3, .4, rose)) * force;
      }
      const Q = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let sm = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; sm += P[yy * w + xx]; n++;
        }
        Q[y * w + x] = Math.min(P[y * w + x] * 1.3, sm / n);           // un point isolé s'efface, une dent reste
      }
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        const p = Q[j]; if (p <= .02) continue;
        const r = d[i], gg = d[i + 1], b = d[i + 2], L = (r + gg + b) / 3;
        // blanc froid qui garde le relief (les creux entre les dents restent un peu plus sombres)
        const t = Math.min(255, L * 1.12 + 62);
        d[i] = r + (t - 6 - r) * p; d[i + 1] = gg + (t - 3 - gg) * p; d[i + 2] = b + (t - b) * p;
      }
      g.putImageData(id, x0, y0);
    }
  };
})();
