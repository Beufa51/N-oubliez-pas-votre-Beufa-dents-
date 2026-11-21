(() => {
  "use strict";

  /* ---------- réglages ---------- */
  const PAUSE_TOUTES_LES = 30;   // secondes de brossage entre deux pauses
  const PAUSE_DUREE = 3;         // secondes de pause
  // ?vitesse=10 accélère le temps (pratique pour tester)
  const VITESSE = Math.max(1, Number(new URLSearchParams(location.search).get("vitesse")) || 1);

  const ZONES = ["Haut gauche", "Haut droite", "Bas droite", "Bas gauche"];
  const FACES = ["Face extérieure", "Face intérieure", "Surface de mastication"];
  const IMG = p => `assets/mascotte/png/pose-${p}.png`;
  const ASTUCES = [
    "Petits cercles doux sur le devant des dents",
    "Passe derrière les dents, tout doucement",
    "Petits va-et-vient sur le dessus des dents"
  ];
  const POSES_PAUSE = ["pouce", "coeur", "main-levee", "pointe-du-doigt", "pensif", "bras-croises"];

  /* ---------- éléments ---------- */
  const $ = s => document.querySelector(s);
  const ecrans = { accueil: $("#ecran-accueil"), brossage: $("#ecran-brossage"), fin: $("#ecran-fin") };
  const elTemps = $("#temps"), elAnneau = $("#anneau"), elZone = $("#zone-nom"), elFace = $("#face-nom");
  const elPoints = [...document.querySelectorAll("#points i")];
    const elMascotte = $("#mascotte"), elAstuce = $("#astuce"), elBouche = $("#bouche");
  const elPause = $("#pause"), elPauseCompte = $("#pause-compte"), elPauseSuite = $("#pause-suite");
  const CIRC = 2 * Math.PI * 52;

  /* ---------- état ---------- */
  let duree = 120;
  let phase = "accueil";           // accueil | brosse | pause | fin
  let ecoule = 0, tPause = 0, prochainePause = PAUSE_TOUTES_LES;
  let derniereZone = -1, dernierPoint = -1, derniere = 0, raf = 0, verrou = null, poseIdx = 0;

  function montrer(nom) {
    Object.entries(ecrans).forEach(([k, el]) => el.classList.toggle("actif", k === nom));
  }

  /* ---------- sons & vibration ---------- */
  let audio;
  function bip(freq = 660, dur = .12, delai = 0) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + delai;
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.25, t + .02);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + .02);
    } catch (e) { /* pas de son, tant pis */ }
  }
  const vibrer = m => { try { navigator.vibrate && navigator.vibrate(m); } catch (e) {} };

  /* ---------- écran qui reste allumé ---------- */
  async function garderEcran() {
    try { if ("wakeLock" in navigator) verrou = await navigator.wakeLock.request("screen"); } catch (e) {}
  }
  function lacherEcran() { try { verrou && verrou.release(); } catch (e) {} verrou = null; }

  /* ---------- accueil ---------- */
  function choisir(groupe, bouton) {
    groupe.querySelectorAll(".option").forEach(b => b.classList.toggle("actif", b === bouton));
  }
  $("#choix-duree").addEventListener("click", e => {
    const b = e.target.closest(".option"); if (!b) return;
    choisir($("#choix-duree"), b); duree = Number(b.dataset.duree);
  });
  $("#choix-mode").addEventListener("click", e => {
    const b = e.target.closest(".option"); if (!b || b.disabled) return;
    choisir($("#choix-mode"), b);
  });


  /* ---------- dessin de la bouche ---------- */
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const RX = 100, RY = 108, CX = 150, CY_HAUT = 162, CY_BAS = 178, PAS = (Math.PI / 2) / 6;
  const DENT_L = [22, 22, 23, 25, 26, 26], DENT_H = [34, 33, 31, 29, 28, 28];
  // zone -> arcade, angle de la dent la plus proche du centre, sens vers le fond
  const QUARTS = [
    { cy: CY_HAUT, t0: 1.5 * Math.PI, sens: -1 },   // haut gauche
    { cy: CY_HAUT, t0: 1.5 * Math.PI, sens: +1 },   // haut droite
    { cy: CY_BAS,  t0: .5 * Math.PI,  sens: -1 },   // bas droite
    { cy: CY_BAS,  t0: .5 * Math.PI,  sens: +1 }    // bas gauche
  ];
  const pt = (q, theta, dr = 0) => {
    const cy = QUARTS[q].cy, nx = Math.cos(theta) / RX, ny = Math.sin(theta) / RY, nn = Math.hypot(nx, ny);
    const n = { x: nx / nn, y: ny / nn };
    return { x: CX + RX * Math.cos(theta) + n.x * dr, y: cy + RY * Math.sin(theta) + n.y * dr, n };
  };
  const dents = [[], [], [], []], halos = [];
  let brosse;

  function dessinerBouche() {
    const sv = elBouche;
    const defs = el("defs", {}, sv);
    const g1 = el("radialGradient", { id: "gBouche", cx: "50%", cy: "50%", r: "55%" }, defs);
    el("stop", { offset: "0", "stop-color": "#ff8fb1" }, g1); el("stop", { offset: "1", "stop-color": "#d63a72" }, g1);
    const g2 = el("radialGradient", { id: "gLangue", cx: "50%", cy: "40%", r: "60%" }, defs);
    el("stop", { offset: "0", "stop-color": "#ffb3c7" }, g2); el("stop", { offset: "1", "stop-color": "#f0709a" }, g2);

    el("ellipse", { cx: CX, cy: 170, rx: 144, ry: 150, fill: "url(#gBouche)", stroke: "#b82a5d", "stroke-width": 3 }, sv);
    // gencives
    [CY_HAUT, CY_BAS].forEach((cy, k) => {
      const a = k === 0 ? Math.PI : 0, b = k === 0 ? 2 * Math.PI : Math.PI;
      el("path", { d: `M${CX + RX * Math.cos(a)} ${cy + RY * Math.sin(a)} A${RX} ${RY} 0 0 1 ${CX + RX * Math.cos(b)} ${cy + RY * Math.sin(b)}`,
        fill: "none", stroke: "#ff6b98", "stroke-width": 46, "stroke-linecap": "round" }, sv);
    });
    // langue
    el("ellipse", { cx: CX, cy: 218, rx: 56, ry: 50, fill: "url(#gLangue)" }, sv);
    el("path", { d: "M150 176 L150 212", stroke: "#e0507f", "stroke-width": 2.5, "stroke-linecap": "round", opacity: .6 }, sv);

    // halos (zone active)
    QUARTS.forEach((Q, q) => {
      const a = pt(q, Q.t0), b = pt(q, Q.t0 + Q.sens * Math.PI / 2);
      const d = Q.sens > 0 ? `M${a.x} ${a.y} A${RX} ${RY} 0 0 1 ${b.x} ${b.y}` : `M${b.x} ${b.y} A${RX} ${RY} 0 0 1 ${a.x} ${a.y}`;
      halos.push(el("path", { d, class: "halo" }, sv));
    });

    // dents + plaque
    QUARTS.forEach((Q, q) => {
      for (let i = 0; i < 6; i++) {
        const th = Q.t0 + Q.sens * (i + .5) * PAS, P = pt(q, th);
        const w = DENT_L[i], h = DENT_H[i];
        const g = el("g", { class: "dent", transform: `translate(${P.x.toFixed(1)} ${P.y.toFixed(1)}) rotate(${(Math.atan2(P.n.y, P.n.x) * 180 / Math.PI).toFixed(1)})` }, sv);
        el("rect", { x: -h / 2, y: -w / 2, width: h, height: w, rx: 8 }, g);
        const pl = el("g", { class: "plaque" }, g);
        [[-.12, -.22, 4.6], [.12, .2, 4.1], [-.3, .12, 3.2], [.28, -.15, 3]].forEach(([fx, fy, r]) =>
          el("circle", { cx: (fx * h).toFixed(1), cy: (fy * w).toFixed(1), r }, pl));
        const ec = el("path", { class: "eclat", d: "M0 -5 L1.6 -1.6 L5 0 L1.6 1.6 L0 5 L-1.6 1.6 L-5 0 L-1.6 -1.6Z",
          transform: `translate(${(-.18 * h).toFixed(1)} ${(-.2 * w).toFixed(1)})` }, g);
        dents[q].push({ pl, ec, c: -1 });
      }
    });

    // brosse (manche vers +x, poils côté -y)
    brosse = el("g", { id: "brosse" }, sv);
    el("rect", { x: 8, y: -4, width: 70, height: 8, rx: 4, fill: "#1d2329" }, brosse);
    el("rect", { x: 10, y: -2.5, width: 60, height: 2, rx: 1, fill: "#4a5560", opacity: .7 }, brosse);
    el("circle", { cx: 52, cy: 0, r: 2, fill: "#7fdde5" }, brosse);
    el("rect", { x: -16, y: -5, width: 30, height: 10, rx: 5, fill: "#1d2329" }, brosse);
    el("rect", { x: -15, y: -17, width: 28, height: 13, rx: 3, fill: "#fff", stroke: "#8aa7b0", "stroke-width": 1 }, brosse);
    el("rect", { x: -15, y: -17, width: 9, height: 13, rx: 3, fill: "#3aa7e8" }, brosse);
    el("path", { d: "M-1 -17 V-4 M5 -17 V-4 M11 -17 V-4", stroke: "#cfe3ea", "stroke-width": 1 }, brosse);
  }

  function majBouche(z, zp, face) {
    const lisse = (a, b, x) => Math.max(0, Math.min(1, (x - a) / (b - a)));
    for (let q = 0; q < 4; q++) {
      halos[q].classList.toggle("actif", q === z);
      for (let i = 0; i < 6; i++) {
        const c = q < z ? 1 : q > z ? 0 : lisse(0, 1, zp * 1.3 - i * .06);
        const d = dents[q][i], cr = Math.round(c * 20) / 20;
        if (d.c !== cr) { d.c = cr; d.pl.style.opacity = 1 - cr; d.ec.style.opacity = cr > .85 ? 1 : 0; }
      }
    }
    // la brosse balaie la zone active
    const Q = QUARTS[z];
    const v = .06 + .88 * (.5 + .5 * Math.sin(ecoule * 2.4));
    const th = Q.t0 + Q.sens * v * (Math.PI / 2);
    const dr = face === 0 ? 26 : face === 1 ? -26 : 4;
    const P = pt(z, th, dr);
    const sgn = face === 1 ? 1 : -1;                       // poils vers les dents
    const bx = P.n.x * sgn, by = P.n.y * sgn;
    const a = Math.atan2(bx, -by) * 180 / Math.PI + Math.sin(ecoule * 45) * 3;
    brosse.setAttribute("transform", `translate(${P.x.toFixed(1)} ${P.y.toFixed(1)}) rotate(${a.toFixed(1)})`);
  }

  dessinerBouche();

  /* ---------- brossage ---------- */
  function demarrer() {
    ecoule = 0; tPause = 0; prochainePause = PAUSE_TOUTES_LES; derniereZone = -1; dernierPoint = -1; poseIdx = 0;
    elMascotte.src = IMG("mains-hanches");
    elPause.hidden = true;
    phase = "brosse";
    montrer("brossage");
    garderEcran();
    bip(523, .15); bip(784, .2, .16);
    derniere = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(boucle);
    majAffichage();
  }

  function arreter() {
    cancelAnimationFrame(raf); lacherEcran(); phase = "accueil"; elPause.hidden = true; montrer("accueil");
  }

  function boucle(now) {
    const dt = Math.max(0, Math.min(.25, (now - derniere) / 1000)) * VITESSE;
    derniere = now;
    if (phase === "brosse") {
      ecoule += dt;
      if (ecoule >= duree) return terminer();
      if (prochainePause < duree && ecoule >= prochainePause) commencerPause();
    } else if (phase === "pause") {
      tPause += dt;
      if (tPause >= PAUSE_DUREE) finirPause();
    }
    majAffichage();
    raf = requestAnimationFrame(boucle);
  }

  function indexZone() { return Math.max(0, Math.min(3, Math.floor(ecoule / (duree / 4)))); }

  function majAffichage() {
    const reste = Math.max(0, Math.ceil(duree - ecoule));
    elTemps.textContent = `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")}`;
    elAnneau.style.strokeDashoffset = String(CIRC * (ecoule / duree));

    const z = indexZone();
    const dureeZone = duree / 4;
    const p = Math.min(2, Math.floor(((ecoule - z * dureeZone) / dureeZone) * 3));
    elZone.textContent = ZONES[z];
    elFace.textContent = FACES[p];
    elPoints.forEach((d, i) => d.classList.toggle("on", i <= p));
    elAstuce.textContent = ASTUCES[p];
    majBouche(z, Math.max(0, Math.min(1, (ecoule - z * dureeZone) / dureeZone)), p);

    if (z !== derniereZone) {
      if (derniereZone !== -1 && phase === "brosse") { bip(740, .12); vibrer(120); }
      derniereZone = z;
    }
    if (p !== dernierPoint) {
      if (dernierPoint !== -1 && phase === "brosse" && z === derniereZone) bip(520, .06);
      dernierPoint = p;
    }
    if (phase === "pause") {
      elPauseCompte.textContent = String(Math.max(1, Math.ceil(PAUSE_DUREE - tPause)));
    }
  }

  function commencerPause() {
    phase = "pause"; tPause = 0; prochainePause += PAUSE_TOUTES_LES;
    const pose = POSES_PAUSE[poseIdx++ % POSES_PAUSE.length];
    const z = indexZone();
    elPause.querySelectorAll(".pause-img").forEach(n => n.remove());
    const img = new Image(); img.src = IMG(pose); img.alt = ""; img.className = "pause-img";
    elPause.querySelector(".pause-boite").insertBefore(img, elPauseCompte);
    elPauseSuite.textContent = `Prochaine zone : ${ZONES[z].toLowerCase()}`;
    elPause.hidden = false;
    bip(880, .15); bip(660, .15, .17); vibrer([150, 80, 150]);
  }

  function finirPause() {
    phase = "brosse"; elPause.hidden = true;
    bip(523, .1); bip(784, .15, .12);
  }

  function terminer() {
    cancelAnimationFrame(raf); lacherEcran(); phase = "fin";
    [523, 659, 784, 1047].forEach((f, i) => bip(f, .2, i * .13));
    vibrer([200, 100, 200, 100, 400]);
    confettis(); montrer("fin");
  }

  function confettis() {
    const c = $("#confettis"); c.innerHTML = "";
    const couleurs = ["#14b8c4", "#ff7aa2", "#ffd166", "#8fe3ea", "#ffffff"];
    for (let i = 0; i < 40; i++) {
      const s = document.createElement("i");
      s.style.left = Math.random() * 100 + "%";
      s.style.background = couleurs[i % couleurs.length];
      s.style.animationDuration = 2.2 + Math.random() * 2.2 + "s";
      s.style.animationDelay = Math.random() * 1.2 + "s";
      c.appendChild(s);
    }
  }

  $("#btn-demarrer").addEventListener("click", demarrer);
  $("#btn-arreter").addEventListener("click", arreter);
  $("#btn-recommencer").addEventListener("click", () => { phase = "accueil"; montrer("accueil"); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && (phase === "brosse" || phase === "pause")) garderEcran();
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
