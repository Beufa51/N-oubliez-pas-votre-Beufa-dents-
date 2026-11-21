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

  /* ---------- mode Beufa dents : gabarits de montage ----------
     Chaque pose = image de la mascotte (le geste à faire) + photo détourée du créateur
     (facultative : assets/createur/<id>.png, sinon la mascotte prend sa place)
     + côté où se tient le partenaire (l'utilisateur se place de l'autre côté). */
  const POSE_COMPTE = 3;          // 3-2-1 avant la photo
  const POSE_DUREE = 4;           // durée totale de la pause photo (s)
  const POSES_BEUFA = [
    { id: "high-five",     mascotte: "main-levee",      cote: "droite", consigne: "Lève la main : high five !" },
    { id: "pouce",         mascotte: "pouce",           cote: "gauche", consigne: "Pouce en l'air !" },
    { id: "coeur",         mascotte: "coeur",           cote: "droite", consigne: "Fais un cœur avec tes mains" },
    { id: "pointe",        mascotte: "pointe-du-doigt", cote: "droite", consigne: "Montre Beufa du doigt" },
    { id: "pensif",        mascotte: "pensif",          cote: "gauche", consigne: "Prends l'air pensif…" },
    { id: "bras-croises",  mascotte: "bras-croises",    cote: "gauche", consigne: "Croise les bras, l'air sûr de toi" },
    { id: "mains-hanches", mascotte: "mains-hanches",   cote: "droite", consigne: "Mains sur les hanches, en super-héros !" }
  ];
  // proportions communes au cadre-guide (CSS) et au montage (canvas)
  const PART = { mascotteH: .6, createurH: .9, bas: .046, marge: .02 };
  POSES_BEUFA.forEach(p => {
    p.imgMascotte = new Image(); p.imgMascotte.src = IMG(p.mascotte);
    const c = new Image();
    c.onload = () => { p.createur = c; };
    c.src = `assets/createur/${p.id}.png`;
  });

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
  let mode = "classique", poses = [], photos = [], poseActuelle = null, cliche = false, finale = false;

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
    choisir($("#choix-mode"), b); mode = b.dataset.mode;
    // le mode Beufa dents a besoin de la caméra
    const sans = $('#choix-camera [data-camera="0"]');
    sans.disabled = mode === "beufa";
    if (mode === "beufa") { choisir($("#choix-camera"), $('#choix-camera [data-camera="1"]')); cameraVoulue = true; }
  });


  /* ---------- caméra miroir ---------- */
  const elScene = $("#scene"), elCamera = $("#camera"), elToast = $("#toast");
  let cameraVoulue = false, flux = null, toastT = 0;

  $("#choix-camera").addEventListener("click", e => {
    const b = e.target.closest(".option"); if (!b) return;
    choisir($("#choix-camera"), b); cameraVoulue = b.dataset.camera === "1";
  });

  function toast(msg) {
    elToast.textContent = msg; elToast.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { elToast.hidden = true; }, 5000);
  }

  async function lancerCamera() {
    elToast.hidden = true;
    if (!cameraVoulue) return;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("indisponible");
      flux = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 1280 } }, audio: false
      });
      elCamera.srcObject = flux;
      await elCamera.play().catch(() => {});
      elScene.classList.add("avec-camera", "vue-miroir"); elScene.classList.remove("vue-schema");
    } catch (e) {
      stopperCamera();
      toast(mode === "beufa"
        ? "Caméra indisponible ou refusée : pas de photos cette fois, on brosse quand même !"
        : "Caméra indisponible ou refusée : on brosse sans caméra.");
    }
  }

  function stopperCamera() {
    if (flux) flux.getTracks().forEach(t => t.stop());
    flux = null; elCamera.srcObject = null;
    elScene.classList.remove("avec-camera", "vue-miroir", "vue-schema", "en-pose");
  }

  // appui sur la petite vue = on l'agrandit
  function echanger(e) {
    if (!elScene.classList.contains("avec-camera")) return;
    const petite = elScene.classList.contains("vue-miroir") ? elBouche : elCamera;
    if (e.currentTarget !== petite) return;
    elScene.classList.toggle("vue-miroir"); elScene.classList.toggle("vue-schema");
  }
  elBouche.addEventListener("click", echanger);
  elCamera.addEventListener("click", echanger);

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
  const dents = [[], [], [], []];
  let brosse;

  function dessinerBouche() {
    const sv = elBouche;
    el("rect", { x: 2, y: 8, width: 296, height: 324, rx: 34, class: "carte-bouche" }, sv);

    // dents : contour bleu, fond blanc
    QUARTS.forEach((Q, q) => {
      for (let i = 0; i < 6; i++) {
        const th = Q.t0 + Q.sens * (i + .5) * PAS, P = pt(q, th);
        const w = DENT_L[i], h = DENT_H[i];
        const g = el("g", { class: "dent", transform: `translate(${P.x.toFixed(1)} ${P.y.toFixed(1)}) rotate(${(Math.atan2(P.n.y, P.n.x) * 180 / Math.PI).toFixed(1)})` }, sv);
        const r = el("rect", { x: -h / 2, y: -w / 2, width: h, height: w, rx: 7 }, g);
        if (i >= 3) el("rect", { x: -4.5, y: -4.5, width: 9, height: 9, rx: 2.5, class: "motif" }, g);   // dessus des molaires
        dents[q].push({ r, etat: "" });
      }
    });
    el("text", { x: 150, y: 176, "text-anchor": "middle", class: "bouche-txt" }, sv).textContent = "comme dans un miroir";

    // brosse bleue (manche vers +x, poils côté -y)
    brosse = el("g", { id: "brosse" }, sv);
    el("rect", { x: 10, y: -4.5, width: 72, height: 9, rx: 4.5, class: "br-corps" }, brosse);
    el("rect", { x: -17, y: -5.5, width: 32, height: 11, rx: 5, class: "br-corps" }, brosse);
    for (let k = 0; k < 6; k++) el("rect", { x: -15 + k * 5.2, y: -16, width: 3.2, height: 11, rx: 1.6, class: "br-poil" }, brosse);
  }

  function majBouche(z, zp, face) {
    for (let q = 0; q < 4; q++) {
      for (let i = 0; i < 6; i++) {
        const c = q < z ? 1 : q > z ? 0 : Math.max(0, Math.min(1, zp * 1.3 - i * .06));
        const etat = c >= .98 ? "fait" : q === z ? "actif" : "";
        const d = dents[q][i];
        if (d.etat !== etat) { d.etat = etat; d.r.setAttribute("class", etat); }
      }
    }
    // la brosse balaie la zone active
    const Q = QUARTS[z];
    const v = .06 + .88 * (.5 + .5 * Math.sin(ecoule * 2.4));
    const th = Q.t0 + Q.sens * v * (Math.PI / 2);
    const dr = face === 0 ? 27 : face === 1 ? -27 : 4;
    const P = pt(z, th, dr);
    const sgn = face === 1 ? 1 : -1;                       // poils vers les dents
    const bx = P.n.x * sgn, by = P.n.y * sgn;
    const a = Math.atan2(bx, -by) * 180 / Math.PI + Math.sin(ecoule * 45) * 3;
    brosse.setAttribute("transform", `translate(${P.x.toFixed(1)} ${P.y.toFixed(1)}) rotate(${a.toFixed(1)})`);
  }

  dessinerBouche();

  /* ---------- brossage ---------- */
  async function demarrer() {
    $("#btn-demarrer").disabled = true;
    stopperCamera(); await lancerCamera();
    $("#btn-demarrer").disabled = false;
    ecoule = 0; tPause = 0; prochainePause = PAUSE_TOUTES_LES; derniereZone = -1; dernierPoint = -1; poseIdx = 0;
    finale = false; poseActuelle = null; photos = []; viderGalerie();
    poses = melanger(POSES_BEUFA.slice());
    elMascotte.src = IMG("mains-hanches");
    fermerPose(); elPause.hidden = true;
    phase = "brosse";
    montrer("brossage");
    garderEcran();
    bip(523, .15); bip(784, .2, .16);
    derniere = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(boucle);
    majAffichage();
  }

  function arreter() {
    cancelAnimationFrame(raf); lacherEcran(); stopperCamera(); phase = "accueil";
    fermerPose(); elPause.hidden = true; montrer("accueil");
  }

  const avecPhotos = () => mode === "beufa" && !!flux;

  function boucle(now) {
    const dt = Math.max(0, Math.min(.25, (now - derniere) / 1000)) * VITESSE;
    derniere = now;
    if (phase === "brosse") {
      ecoule += dt;
      if (ecoule >= duree) {
        if (!avecPhotos() || finale) return terminer();
        ecoule = duree; finale = true; commencerPause();     // pose finale
      } else if (prochainePause < duree && ecoule >= prochainePause) commencerPause();
    } else if (phase === "pause") {
      tPause += dt;
      if (poseActuelle && !cliche && tPause >= POSE_COMPTE) prendrePhoto();
      if (tPause >= (poseActuelle ? POSE_DUREE : PAUSE_DUREE)) {
        if (finale) return terminer();
        finirPause();
      }
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
      if (poseActuelle) {
        const n = Math.ceil(POSE_COMPTE - tPause);
        elPauseCompte.textContent = n > 0 ? String(n) : "Clic !";
        if (n !== dernierCompte) { dernierCompte = n; if (n > 0) bip(600, .08); }
      } else {
        elPauseCompte.textContent = String(Math.max(1, Math.ceil(PAUSE_DUREE - tPause)));
      }
    }
  }
  let dernierCompte = 0;

  function commencerPause() {
    phase = "pause"; tPause = 0;
    if (!finale) prochainePause += PAUSE_TOUTES_LES;
    const z = indexZone();
    elPause.querySelectorAll(".pause-img").forEach(n => n.remove());
    const img = new Image(); img.alt = ""; img.className = "pause-img";
    if (avecPhotos()) {
      poseActuelle = poses[poseIdx++ % poses.length]; cliche = false; dernierCompte = 0;
      img.src = IMG(poseActuelle.mascotte);
      elPauseTitre.textContent = finale ? "Pose finale !" : "Pose photo !";
      elPauseSuite.textContent = poseActuelle.consigne;
      ouvrirPose(poseActuelle);
    } else {
      img.src = IMG(POSES_PAUSE[poseIdx++ % POSES_PAUSE.length]);
      elPauseTitre.textContent = "Pause !";
      elPauseSuite.textContent = `Prochaine zone : ${ZONES[z].toLowerCase()}`;
    }
    elPause.querySelector(".pause-boite").insertBefore(img, elPauseCompte);
    elPause.hidden = false;
    bip(880, .15); bip(660, .15, .17); vibrer([150, 80, 150]);
  }

  function finirPause() {
    phase = "brosse"; fermerPose(); elPause.hidden = true;
    bip(523, .1); bip(784, .15, .12);
  }

  /* ---------- pose photo : cadre-guide, capture ---------- */
  const elPauseTitre = $("#pause-titre"), elCadre = $("#cadre"), elFantome = $("#fantome"), elFlash = $("#flash");
  let vueAvantPose = "";

  function ouvrirPose(p) {
    // la caméra passe en grand, au format 3:4 du montage
    vueAvantPose = elScene.classList.contains("vue-schema") ? "vue-schema" : "vue-miroir";
    elScene.classList.remove("vue-schema"); elScene.classList.add("vue-miroir", "en-pose");
    elPause.classList.add("pause-pose");
    const partenaire = p.createur || p.imgMascotte;
    elFantome.src = partenaire.src;
    elFantome.style.height = (p.createur ? PART.createurH : PART.mascotteH) * 100 + "%";
    elFantome.style.bottom = (p.createur ? 0 : PART.bas * 100) + "%";
    elCadre.className = `cadre cote-${p.cote}${p.createur ? " avec-createur" : ""}`;
    elCadre.hidden = false;
  }

  function fermerPose() {
    elCadre.hidden = true; elPause.classList.remove("pause-pose");
    if (elScene.classList.contains("en-pose")) {
      elScene.classList.remove("en-pose", "vue-miroir"); elScene.classList.add(vueAvantPose || "vue-miroir");
    }
    poseActuelle = null;
  }

  function prendrePhoto() {
    cliche = true;
    const v = elCamera, vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh) return;
    // recadrage 3:4 centré, en miroir (comme ce que l'utilisateur voit)
    let cw = vw, ch = vh;
    if (vw / vh > 3 / 4) cw = vh * 3 / 4; else ch = vw * 4 / 3;
    const c = document.createElement("canvas");
    c.width = Math.round(cw); c.height = Math.round(ch);
    const x = c.getContext("2d");
    x.translate(c.width, 0); x.scale(-1, 1);
    x.drawImage(v, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, c.width, c.height);
    photos.push({ pose: poseActuelle, img: c });
    elFlash.classList.remove("go"); void elFlash.offsetWidth; elFlash.classList.add("go");
    bip(1200, .05); bip(900, .08, .05); vibrer(60);
  }

  /* ---------- montage avec le créateur (ou la mascotte) ---------- */
  const W = 1080, H = 1440, BANDE = 110;

  function composer({ pose, img }) {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0, W, H);
    const estCreateur = !!pose.createur, part = pose.createur || pose.imgMascotte;
    if (part.naturalWidth) {
      const h = H * (estCreateur ? PART.createurH : PART.mascotteH);
      const w = h * part.naturalWidth / part.naturalHeight;
      const m = estCreateur ? 0 : W * PART.marge;
      const px = pose.cote === "droite" ? W - w - m : m;
      const py = H - h - (estCreateur ? 0 : H * PART.bas);
      x.save();
      x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 30; x.shadowOffsetY = 10;
      x.drawImage(part, px, py, w, h);
      x.restore();
    }
    // bandeau souvenir
    x.fillStyle = "rgba(255,255,255,.88)"; x.fillRect(0, H - BANDE, W, BANDE);
    x.fillStyle = "#0b8f9a"; x.textBaseline = "middle";
    x.font = "800 46px ui-rounded, Nunito, system-ui, sans-serif";
    x.fillText("Brossé avec Beufa ✨", 36, H - BANDE / 2);
    x.font = "700 34px ui-rounded, Nunito, system-ui, sans-serif"; x.textAlign = "right";
    x.fillText(new Date().toLocaleDateString("fr-FR"), W - 36, H - BANDE / 2);
    return new Promise(r => c.toBlob(b => r(b), "image/jpeg", .9));
  }

  /* ---------- galerie de fin ---------- */
  const elMontages = $("#montages"), elGalerie = $("#galerie"), elVision = $("#visionneuse"), elVisionImg = $("#vision-img");
  let souvenirs = [], souvenirVu = null;

  function viderGalerie() {
    souvenirs.forEach(s => URL.revokeObjectURL(s.url));
    souvenirs = []; elGalerie.innerHTML = ""; elMontages.hidden = true;
    ecrans.fin.classList.remove("avec-photos"); elVision.hidden = true;
  }

  async function afficherMontages() {
    if (!photos.length) return;
    elMontages.hidden = false; ecrans.fin.classList.add("avec-photos");
    for (const [i, ph] of photos.entries()) {
      const blob = await composer(ph);
      if (!blob) continue;
      const s = { blob, url: URL.createObjectURL(blob), nom: `beufa-dents-${Date.now()}-${i + 1}.jpg` };
      souvenirs.push(s);
      const b = document.createElement("button"); b.type = "button"; b.className = "vignette";
      const im = new Image(); im.src = s.url; im.alt = `Photo souvenir ${i + 1} avec Beufa`;
      b.appendChild(im); b.addEventListener("click", () => ouvrirVision(s));
      elGalerie.appendChild(b);
    }
    photos = [];   // les canvas bruts ne servent plus
  }

  function ouvrirVision(s) {
    souvenirVu = s; elVisionImg.src = s.url;
    const a = $("#btn-enregistrer"); a.href = s.url; a.download = s.nom;
    const f = new File([s.blob], s.nom, { type: "image/jpeg" });
    $("#btn-partager").hidden = !(navigator.canShare && navigator.canShare({ files: [f] }));
    elVision.hidden = false;
  }
  $("#btn-partager").addEventListener("click", async () => {
    if (!souvenirVu) return;
    const f = new File([souvenirVu.blob], souvenirVu.nom, { type: "image/jpeg" });
    try { await navigator.share({ files: [f], title: "Brossé avec Beufa" }); } catch (e) { /* annulé */ }
  });
  $("#btn-fermer").addEventListener("click", () => { elVision.hidden = true; });

  function melanger(t) {
    for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
    return t;
  }

  function terminer() {
    cancelAnimationFrame(raf); lacherEcran(); fermerPose(); elPause.hidden = true;
    stopperCamera(); phase = "fin";
    [523, 659, 784, 1047].forEach((f, i) => bip(f, .2, i * .13));
    vibrer([200, 100, 200, 100, 400]);
    confettis(); montrer("fin");
    afficherMontages();
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
  $("#btn-recommencer").addEventListener("click", () => { phase = "accueil"; viderGalerie(); montrer("accueil"); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && (phase === "brosse" || phase === "pause")) garderEcran();
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
