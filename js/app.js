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
  const POSES_PAUSE = ["pouce", "coeur", "main-levee", "pointe-du-doigt", "pensif", "bras-croises"];

  /* ---------- éléments ---------- */
  const $ = s => document.querySelector(s);
  const ecrans = { accueil: $("#ecran-accueil"), brossage: $("#ecran-brossage"), fin: $("#ecran-fin") };
  const elTemps = $("#temps"), elAnneau = $("#anneau"), elZone = $("#zone-nom"), elFace = $("#face-nom");
  const elPoints = [...document.querySelectorAll("#points i")];
  const elChemins = [...document.querySelectorAll("#bouche path")];
  const elMascotte = $("#mascotte");
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
    const dt = Math.min(.25, (now - derniere) / 1000) * VITESSE;
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

  function indexZone() { return Math.min(3, Math.floor(ecoule / (duree / 4))); }

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
    elChemins.forEach((c, i) => { c.classList.toggle("actif", i === z); c.classList.toggle("fait", i < z); });

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
