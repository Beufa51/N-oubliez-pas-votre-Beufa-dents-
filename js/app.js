(() => {
  "use strict";

  /* ---------- réglages ---------- */
  const PAUSE_TOUTES_LES = 30;   // secondes de brossage entre deux pauses
  const PAUSE_DUREE = 3;         // secondes de pause
  // ?vitesse=10 accélère le temps (pratique pour tester)
  const VITESSE = Math.max(1, Number(new URLSearchParams(location.search).get("vitesse")) || 1);
  const DET = window.BeufaDetection;   // détection du brossage (js/detection.js)

  const ZONES = ["Haut gauche", "Haut droite", "Bas droite", "Bas gauche"];
  const FACES = ["Face extérieure", "Face intérieure", "Surface de mastication"];
  const IMG = p => `assets/mascotte/png/pose-${p}.png`;
  const ASTUCES = [
    "Petits cercles doux sur le devant des dents",
    "Passe derrière les dents, tout doucement",
    "Petits va-et-vient sur le dessus des dents"
  ];
  const TOUTES_POSES = ["pouce", "coeur", "main-levee", "pointe-du-doigt", "pensif", "bras-croises", "mains-hanches"];
  /* ---------- deux tons : enfant, et adulte (au-dessus de 16 ans) ---------- */
  const TONS = {
    enfant: {
      // mini-défis lancés à chaque changement de zone (faisables en brossant)
      defis: [
        "Brosse en faisant les gros yeux !", "Brosse sur un seul pied !", "Petits cercles comme un robot : bip, bip !",
        "Brosse en dansant !", "Brosse en faisant un clin d'œil !", "Brosse au ralenti, tout doux !",
        "Lève les sourcils en brossant !", "Brosse en marchant sur place !", "Brosse en faisant le dos rond comme un chat !"
      ],
      bravos: ["Super !", "Bien joué !", "Continue comme ça !", "Tu gères !", "Ça brille déjà !"],
      reactions: ["Trop bien !", "Magnifique !", "Quelle star !", "Top photo !", "On est trop beaux !"],
      bulles: ["Dents de star !", "Équipe Beufa !", "On brille !", "Trop stylé !", "Sourire XXL !"],
      microbes: "microbes vaincus",
      fin: (n, carte, nouvelle) => ` Tu as vaincu ${n} microbes, et tu gagnes la carte ${carte}${nouvelle ? "" : ", encore elle"} !`,
      serie: n => ` ${n} jours d'affilée, continue !`
    },
    adulte: {
      defis: [
        "Brosse avec ta main gauche… ou droite, l'autre quoi !", "Brosse comme dans une pub de dentifrice, regard caméra.",
        "Équilibre sur un pied, version yoga.", "Lève un sourcil, façon agent secret.", "Quelques squats en brossant, pourquoi pas ?",
        "Petits cercles lents : c'est ta méditation du jour.", "Dos droit, épaules basses : posture de champion.",
        "Brosse en fredonnant ta chanson préférée dans ta tête.", "Fixe ton reflet avec un air très sérieux."
      ],
      bravos: ["Impeccable.", "Belle technique.", "Rien à redire.", "Travail de pro.", "Ton dentiste serait fier."],
      reactions: ["Photo de couverture !", "Classe.", "On dirait une pub !", "Parfait.", "Celle-là, on l'encadre."],
      bulles: ["Sourire de pub !", "Duo de choc", "Brossage validé", "La classe", "Team Beufa"],
      microbes: "bactéries éliminées",
      fin: (n, carte, nouvelle) => ` ${n} bactéries éliminées. ${nouvelle ? "Nouvelle carte" : "Encore une fois la carte"} : ${carte}.`,
      serie: n => ` ${n} jours d'affilée, belle régularité.`
    }
  };
  const ton = () => TONS[window.BeufaJeu.estAdulte() ? "adulte" : "enfant"];
  const hasard = t => t[Math.floor(Math.random() * t.length)];

  /* ---------- mode Beufa dents : gabarits de montage ----------
     Chaque pose = image de la mascotte (le geste à faire) + photo détourée du créateur
     (facultative : assets/createur/<id>.png, sinon la mascotte prend sa place)
     + côté où se tient le partenaire (l'utilisateur se place de l'autre côté). */
  const POSE_PREP = 3;            // Beufa montre la pose en plein écran (s)
  const POSE_PLACEMENT = 4;       // caméra visible : on met sa tête dans l'ovale, sans compte à rebours (s)
  const POSE_COMPTE = 3;          // 3-2-1 avant la photo (s)
  const POSE_APRES = 1.8;         // aperçu de la photo + réaction de Beufa (s)
  const POSE_CLIC = POSE_PREP + POSE_PLACEMENT + POSE_COMPTE;
  const POSE_DUREE = POSE_CLIC + POSE_APRES;
  /* photo : où est la tête du créateur sur sa photo détourée (assets/createur/<id>.webp)
       tete = [haut des cheveux, menton, centre horizontal] en fraction de l'image ;
     et comment la placer sur la photo de l'utilisateur (unités = hauteur de la photo) :
       hh = hauteur de sa tête, top = haut de sa tête, dx = distance du bord à son visage.
     Sa photo est toujours collée en bas (le corps est coupé par le bord, comme sur une vraie photo).
     Avec une photo du créateur, l'utilisateur fait l'AUTRE MOITIÉ du geste (consigne), guidé par l'ombre
     du créateur et une cible (cible = point de sa photo où l'utilisateur doit mettre la main, en fraction).
     geste = consigne sans le créateur (pauses du mode Classique, ou photo absente). */
  const POSES_BEUFA = [
    { id: "high-five",     mascotte: "main-levee",      cote: "droite", emoji: "✋",
      consigne: "Tape dans la main de l'ombre : high five !", geste: "Lève la main : high five !",
      cible: { x: .06, y: .19, texte: "ta main ici" },
      photo: { tete: [.01, .34, .55], hh: .24, top: .17, dx: .15 } },
    { id: "check-poing",   mascotte: "main-levee",      cote: "droite", emoji: "👊",
      consigne: "Ton poing contre le sien : check !", geste: "Tends ton poing : check !",
      cible: { x: .06, y: .39, texte: "ton poing ici" },
      photo: { tete: [.01, .30, .61], hh: .27, top: .15, dx: .2 } },
    { id: "pouce",         mascotte: "pouce",           cote: "gauche", emoji: "✌️",
      consigne: "Fais le V de la victoire, comme l'ombre !", geste: "Pouce en l'air !",
      photo: { tete: [.07, .30, .565], hh: .21, top: .2, dx: .28 } },
    { id: "coeur",         mascotte: "coeur",           cote: "droite", consigne: "Fais un cœur avec tes mains" },
    { id: "pointe",        mascotte: "pointe-du-doigt", cote: "gauche", emoji: "👉",
      consigne: "Montre l'ombre du doigt : c'est toi !", geste: "Montre-moi du doigt !",
      photo: { tete: [.06, .26, .43], hh: .22, top: .2, dx: .22 } },
    { id: "pensif",        mascotte: "pensif",          cote: "gauche", consigne: "Prends l'air pensif…" },
    { id: "bras-croises",  mascotte: "bras-croises",    cote: "droite", emoji: "🔙",
      consigne: "De profil, bras croisés, ton dos contre son dos !", geste: "Croise les bras, l'air sûr de toi",
      cible: { x: .02, y: .3, texte: "ton dos ici" },
      photo: { tete: [.01, .28, .38], hh: .27, top: .15, dx: .2 } },
    { id: "mains-hanches", mascotte: "mains-hanches",   cote: "droite", emoji: "🙌",
      consigne: "Mains à plat au-dessus des siennes : tape dedans !", geste: "Mains sur les hanches, en champion !",
      cible: { x: .2, y: .6, texte: "tes mains ici" },
      photo: { tete: [.01, .28, .60], hh: .27, top: .15, dx: .2 } }
  ];
  // la consigne à donner : l'autre moitié du geste s'il y a la photo du créateur, sinon le geste simple
  const consigneDe = p => p.createur ? p.consigne : (p.geste || p.consigne);
  // proportions communes au cadre-guide (CSS) et au montage (canvas)
  const PART = { mascotteH: .76, bas: .08, marge: .02 };
  POSES_BEUFA.forEach(p => {
    p.imgMascotte = new Image(); p.imgMascotte.src = IMG(p.mascotte);
    if (!p.photo) return;
    const c = new Image();
    c.onload = () => { p.createur = c; };
    c.src = `assets/createur/${p.id}.webp`;
  });
  // place du créateur sur une photo W×H (en px) : sa tête à peu près à la taille de celle de l'utilisateur
  function placeCreateur(p, W, H) {
    const c = p.createur, [t, m, cx] = p.photo.tete;
    let h = p.photo.hh * H / (m - t), y = p.photo.top * H - t * h;
    if (y + h < H) y = H - h;                       // toujours collé en bas
    const w = h * c.naturalWidth / c.naturalHeight;
    const tx = p.cote === "droite" ? W - p.photo.dx * H : p.photo.dx * H;
    return { x: tx - cx * w, y, w, h, tx, ty: y + t * h, th: (m - t) * h };
  }
  // même place, en % d'une scène au format de la photo (studio, révélation)
  function stylePlace(p, ratio) {
    const r = placeCreateur(p, ratio, 1);
    return `left:${r.x / ratio * 100}%;top:${r.y * 100}%;width:${r.w / ratio * 100}%;height:${r.h * 100}%;right:auto;bottom:auto`;
  }

  /* ---------- éléments ---------- */
  const $ = s => document.querySelector(s);
  const ecrans = { demarrage: $("#ecran-demarrage"), intro: $("#ecran-intro"), accueil: $("#ecran-accueil"), brossage: $("#ecran-brossage"), fin: $("#ecran-fin"), album: $("#ecran-album") };
  const JEU = window.BeufaJeu;
  const elTemps = $("#temps"), elAnneau = $("#anneau"), elZone = $("#zone-nom"), elFace = $("#face-nom");
  const elPoints = [...document.querySelectorAll("#points i")];
    const elMascotte = $("#mascotte"), elAstuce = $("#astuce"), elBouche = $("#bouche");
  const elPause = $("#pause"), elPauseCompte = $("#pause-compte"), elPauseSuite = $("#pause-suite");
  const CIRC = 2 * Math.PI * 52;

  /* ---------- état ---------- */
  let duree = 120;
  let phase = "demarrage";         // demarrage | intro | accueil | prepa | brosse | pause | fin
  let ecoule = 0, tPause = 0, pauses = [], iPause = 0, nbPhotos = 4, typeBrosse = "manuelle";
  let derniereZone = -1, dernierPoint = -1, derniere = 0, raf = 0, verrou = null, poseIdx = 0;
  let mode = "classique", poses = [], photos = [], poseActuelle = null, cliche = false, finale = false;

  function montrer(nom) {
    Object.entries(ecrans).forEach(([k, el]) => el.classList.toggle("actif", k === nom));
  }

  /* ---------- réglages gardés sur le téléphone ---------- */
  function lireReglage(cle, defaut) {
    try { const v = localStorage.getItem("beufa-" + cle); return v === null ? defaut : JSON.parse(v); } catch (e) { return defaut; }
  }
  function ecrireReglage(cle, v) { try { localStorage.setItem("beufa-" + cle, JSON.stringify(v)); } catch (e) {} }

  /* ---------- sons, voix & vibration ---------- */
  let audio, sonActif = lireReglage("son", true);
  function bip(freq = 660, dur = .12, delai = 0) {
    if (!sonActif) return;
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

  // Beufa parle avec la voix du téléphone (aucun fichier son, rien n'est envoyé)
  const synthese = window.speechSynthesis;
  let voixFr = null;
  function choisirVoix() {
    try {
      const v = synthese.getVoices();
      voixFr = v.find(x => /^fr[-_]FR/i.test(x.lang)) || v.find(x => /^fr/i.test(x.lang)) || null;
    } catch (e) {}
  }
  if (synthese) { choisirVoix(); synthese.addEventListener && synthese.addEventListener("voiceschanged", choisirVoix); }
  function parler(texte, urgent = true) {
    if (!sonActif || !synthese || !texte) return;
    if (phase === "prepa" || phase === "brosse" || phase === "pause" || phase === "fin") return;   // pas de voix pendant le brossage ni à la fin (demande du créateur)
    try {
      if (urgent) synthese.cancel();
      const u = new SpeechSynthesisUtterance(texte.replace(/…/g, "."));
      u.lang = "fr-FR"; if (voixFr) u.voice = voixFr;
      u.rate = 1.05; u.pitch = 1.25;
      synthese.speak(u);
    } catch (e) {}
  }
  function taire() { try { synthese && synthese.cancel(); } catch (e) {} }
  // à appeler pendant un appui : débloque le son et la voix (iPhone)
  function debloquerSon() {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume && audio.resume(); } catch (e) {}
    try { if (synthese && sonActif) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; synthese.speak(u); } } catch (e) {}
  }

  function majBoutonsSon() {
    document.querySelectorAll(".btn-son").forEach(b => {
      b.textContent = sonActif ? "🔊" : "🔇";
      b.setAttribute("aria-pressed", String(sonActif));
      b.setAttribute("aria-label", sonActif ? "Couper le son" : "Remettre le son");
    });
  }
  document.addEventListener("click", e => {
    if (!e.target.closest(".btn-son")) return;
    sonActif = !sonActif; ecrireReglage("son", sonActif); majBoutonsSon();
    if (sonActif) { debloquerSon(); bip(660, .1); } else taire();
    majMusique();
  });
  majBoutonsSon();

  /* ---------- utilisateurs : prénom + âge, gardés sur le téléphone ---------- */
  let prenom = "";
  const COULEURS = ["#14b8c4", "#ff7aa2", "#f5a623", "#7c4dff", "#2e9d4f", "#e63946"];
  function majProfils() {
    const P = window.BeufaJeu.profils(), act = window.BeufaJeu.profilActif();
    prenom = act ? act.prenom : "";
    const box = $("#profils"); box.innerHTML = "";
    P.liste.forEach((x, i) => {
      const b = document.createElement("button"); b.type = "button";
      b.className = "profil" + (x.id === P.actif ? " actif" : ""); b.dataset.id = x.id;
      b.setAttribute("aria-pressed", String(x.id === P.actif));
      const a = document.createElement("span"); a.className = "avatar"; a.style.background = COULEURS[i % COULEURS.length];
      a.textContent = (x.prenom[0] || "?").toUpperCase();
      const n = document.createElement("span"); n.className = "profil-nom"; n.textContent = x.prenom;
      const g = document.createElement("small"); g.textContent = x.age ? `${x.age} ans` : "âge ?";
      b.append(a, n, g);
      if (x.id === P.actif) { const e = document.createElement("span"); e.className = "profil-edit"; e.textContent = "✏️"; e.setAttribute("aria-hidden", "true"); b.append(e); }
      box.appendChild(b);
    });
    const plus = document.createElement("button"); plus.type = "button"; plus.className = "profil ajouter";
    plus.innerHTML = '<span class="avatar">+</span><span class="profil-nom">Ajouter</span>';
    box.appendChild(plus);
    if (typeof majSuivi === "function") majSuivi();
    majSalut(act); appliquerReglages();
  }
  function majSalut(act) {
    const h = new Date().getHours(), nom = act ? " " + act.prenom : "";
    const adulte = window.BeufaJeu.estAdulte(act);
    const moment = h < 11 ? (adulte ? `Bonjour${nom} ! Un brossage pour bien démarrer ?` : `Coucou${nom} ! On réveille ces dents ?`)
      : h < 18 ? (adulte ? `Salut${nom} ! Deux minutes de brillance ?` : `Salut${nom} ! On chasse les microbes ?`)
      : (adulte ? `Bonsoir${nom} ! Le brossage du soir, et au lit.` : `Bonsoir${nom} ! On brosse avant dodo ?`);
    $("#salut").textContent = moment.replace(/ ([?!])/g, "\u00a0$1");
  }
  $("#profils").addEventListener("click", e => {
    const b = e.target.closest(".profil"); if (!b) return;
    if (b.classList.contains("ajouter")) return ouvrirFiche(null);
    if (b.classList.contains("actif")) return ouvrirFiche(window.BeufaJeu.profilActif());
    window.BeufaJeu.choisirProfil(b.dataset.id); majProfils(); bip(660, .06);
  });

  // fiche : prénom + âge ; au-dessus de 16 ans, le ton change
  const elFiche = $("#fiche"), elFichePrenom = $("#fiche-prenom"), elFicheAge = $("#fiche-age");
  let ficheId = null, apresFiche = null;
  function majTon() {
    const a = parseInt(elFicheAge.value, 10);
    $("#fiche-ton").textContent = !a ? "" : a > 16 ? "🎩 Beufa prendra un ton adulte." : "🎈 Beufa prendra un ton rigolo pour enfant.";
  }
  function ouvrirFiche(x, suite = null) {
    ficheId = x ? x.id : null; apresFiche = suite;
    const aucun = !window.BeufaJeu.profils().liste.length;
    $("#fiche-titre").textContent = x ? `Profil de ${x.prenom}` : aucun ? "Qui se brosse les dents ?" : "Nouveau brosseur";
    elFichePrenom.value = x ? x.prenom : "";
    elFicheAge.value = x && x.age ? x.age : "";
    $("#fiche-supprimer").hidden = !x;
    $("#fiche-annuler").hidden = aucun;
    $("#fiche-erreur").hidden = true;
    majTon(); elFiche.hidden = false;
    setTimeout(() => (x && !x.age ? elFicheAge : elFichePrenom).focus(), 50);
  }
  function fermerFiche() { elFiche.hidden = true; }
  elFicheAge.addEventListener("input", majTon);
  [elFichePrenom, elFicheAge].forEach(i => i.addEventListener("input", () => { $("#fiche-erreur").hidden = true; }));
  $("#age-moins").addEventListener("click", () => { elFicheAge.value = Math.max(1, (parseInt(elFicheAge.value, 10) || 8) - 1); majTon(); });
  $("#age-plus").addEventListener("click", () => { elFicheAge.value = Math.min(120, (parseInt(elFicheAge.value, 10) || 7) + 1); majTon(); });
  $("#fiche-annuler").addEventListener("click", fermerFiche);
  $("#fiche-supprimer").addEventListener("click", () => {
    const x = window.BeufaJeu.profilActif();
    if (!x || !confirm(`Supprimer le profil de ${x.prenom}, avec son album et ses séries ?`)) return;
    window.BeufaJeu.supprimerProfil(x.id); fermerFiche(); majProfils();
    if (!window.BeufaJeu.profils().liste.length) ouvrirFiche(null);
  });
  $("#fiche-form").addEventListener("submit", e => {
    e.preventDefault();
    const nom = elFichePrenom.value.trim(), age = parseInt(elFicheAge.value, 10);
    const err = !nom ? "Il manque le prénom." : !(age >= 1 && age <= 120) ? "Il manque l'âge." : "";
    if (err) { const p = $("#fiche-erreur"); p.textContent = err; p.hidden = false; return; }
    window.BeufaJeu.enregistrerProfil({ id: ficheId, prenom: nom, age });
    fermerFiche(); majProfils(); bip(784, .08);
    if (apresFiche) { const f = apresFiche; apresFiche = null; f(); }
  });

  const avecPrenom = (debut, fin = "") => prenom ? `${debut} ${prenom}${fin}` : `${debut}${fin}`;

  const ZONES_VOIX = ["en haut à gauche", "en haut à droite", "en bas à droite", "en bas à gauche"];
  const FACES_VOIX = ["le devant des dents", "derrière les dents", "le dessus des dents"];

  /* ---------- écran qui reste allumé ---------- */
  async function garderEcran() {
    try { if ("wakeLock" in navigator) verrou = await navigator.wakeLock.request("screen"); } catch (e) {}
  }
  function lacherEcran() { try { verrou && verrou.release(); } catch (e) {} verrou = null; }

  /* ---------- accueil ---------- */
  function choisir(groupe, bouton) {
    groupe.querySelectorAll(".option").forEach(b => b.classList.toggle("actif", b === bouton));
  }
  function retenir(r) { const x = window.BeufaJeu.profilActif(); if (x) window.BeufaJeu.reglerProfil(x.id, r); }
  $("#choix-duree").addEventListener("click", e => {
    const b = e.target.closest(".option"); if (!b) return;
    choisir($("#choix-duree"), b); duree = Number(b.dataset.duree); retenir({ duree });
  });
  $("#choix-mode").addEventListener("click", e => {
    const b = e.target.closest(".option"); if (!b || b.disabled) return;
    choisir($("#choix-mode"), b); mode = b.dataset.mode; retenir({ mode }); majModeCamera();
  });
  /* ---------- décor du brossage ----------
     Images dans assets/decors/<id>.webp (portrait, ~1080×1920). Un décor n'apparaît dans le choix que si
     son image existe : on peut en ajouter ou en retirer sans toucher au reste. */
  const DECORS = [
    { id: "plateau",     nom: "Plateau télé" },     // le décor de base (pas d'image)
    { id: "champignons", nom: "Pays des champignons" },
    { id: "volcan",      nom: "Volcan" },
    { id: "neige",       nom: "Village enneigé" },
    { id: "montagne",    nom: "Montagne" },
    { id: "lagon",       nom: "Lagon" }
  ];
  let decor = "plateau";
  const elChoixDecor = $("#choix-decor");
  function majDecors() {
    const dispo = DECORS.filter(d => d.id === "plateau" || d.ok);
    $("#bloc-decor").hidden = dispo.length < 2;
    elChoixDecor.innerHTML = "";
    dispo.forEach(d => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "option decor" + (d.id === decor ? " actif" : "");
      b.dataset.decor = d.id; b.title = d.nom; b.setAttribute("aria-label", "Décor : " + d.nom);
      if (d.ok) b.style.backgroundImage = `url(assets/decors/${d.id}.webp)`;
      else b.textContent = "📺";
      elChoixDecor.appendChild(b);
    });
    appliquerDecor();
  }
  function appliquerDecor() {
    const d = DECORS.find(x => x.id === decor && (x.ok || x.id === "plateau")) || DECORS[0];
    ecrans.brossage.style.backgroundImage = d.ok
      ? `linear-gradient(180deg, rgba(13,18,80,.25), rgba(13,18,80,.55)), url(assets/decors/${d.id}.webp)` : "";
    ecrans.brossage.classList.toggle("avec-decor", !!d.ok);
  }
  DECORS.forEach(d => {
    if (d.id === "plateau") return;
    const i = new Image(); i.onload = () => { d.ok = true; majDecors(); }; i.src = `assets/decors/${d.id}.webp`;
  });
  elChoixDecor.addEventListener("click", e => {
    const b = e.target.closest(".option"); if (!b) return;
    choisir(elChoixDecor, b); decor = b.dataset.decor; retenir({ decor }); appliquerDecor();
  });

  // la brosse ne compte que pour la détection (donc avec la caméra)
  $("#choix-brosse").addEventListener("click", e => {
    const b = e.target.closest(".option"); if (!b) return;
    choisir($("#choix-brosse"), b); typeBrosse = b.dataset.brosse; retenir({ brosse: typeBrosse });
  });
  $("#choix-photos").addEventListener("click", e => {
    const b = e.target.closest(".option"); if (!b) return;
    choisir($("#choix-photos"), b); nbPhotos = Number(b.dataset.photos); retenir({ photos: nbPhotos });
  });
  // le mode Beufa dents a toujours besoin de la caméra : la rubrique Caméra laisse place au nombre de photos
  let cameraChoisie = false;
  function majModeCamera() {
    const beufa = mode === "beufa";
    $("#bloc-camera").hidden = beufa; $("#bloc-photos").hidden = !beufa;
    cameraVoulue = beufa || cameraChoisie;
    $("#bloc-brosse").hidden = !cameraVoulue;
  }
  // remet les derniers choix de l'utilisateur actif
  function appliquerReglages() {
    const x = window.BeufaJeu.profilActif(), r = (x && x.reglages) || {};
    mode = r.mode === "beufa" ? "beufa" : "classique";
    duree = r.duree === 60 ? 60 : 120;
    cameraChoisie = !!r.camera;
    nbPhotos = r.photos === 2 ? 2 : 4;
    typeBrosse = r.brosse === "electrique" ? "electrique" : "manuelle";
    decor = r.decor || "plateau"; majDecors();
    choisir($("#choix-brosse"), $(`#choix-brosse [data-brosse="${typeBrosse}"]`));
    choisir($("#choix-mode"), $(`#choix-mode [data-mode="${mode}"]`));
    choisir($("#choix-duree"), $(`#choix-duree [data-duree="${duree}"]`));
    choisir($("#choix-camera"), $(`#choix-camera [data-camera="${cameraChoisie ? 1 : 0}"]`));
    choisir($("#choix-photos"), $(`#choix-photos [data-photos="${nbPhotos}"]`));
    majModeCamera();
  }


  /* ---------- caméra miroir ---------- */
  const elScene = $("#scene"), elCamera = $("#camera"), elToast = $("#toast");
  let cameraVoulue = false, flux = null, toastT = 0;

  $("#choix-camera").addEventListener("click", e => {
    const b = e.target.closest(".option"); if (!b) return;
    choisir($("#choix-camera"), b); cameraChoisie = b.dataset.camera === "1"; retenir({ camera: cameraChoisie }); majModeCamera();
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
        // pas de format imposé : le téléphone donne son image entière, dans le sens où on le tient
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false
      });
      elCamera.srcObject = flux;
      await elCamera.play().catch(() => {});
      elScene.classList.add("avec-camera", "vue-miroir"); elScene.classList.remove("vue-schema");
      DET.prechauffer();   // le modèle se charge pendant qu'on s'installe
    } catch (e) {
      stopperCamera();
      toast(mode === "beufa"
        ? "Caméra indisponible ou refusée : pas de photos cette fois, on brosse quand même !"
        : "Caméra indisponible ou refusée : on brosse sans caméra.");
    }
  }

  function stopperCamera() {
    if (flux) flux.getTracks().forEach(t => t.stop());
    flux = null; elCamera.srcObject = null; DET.arreter();
    elScene.classList.remove("avec-camera", "vue-miroir", "vue-schema");
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
        dents[q].push({ r, etat: "", P });
      }
    });
    // un microbe sur chaque dent ; le dernier de chaque zone (molaire du fond) est le chef
    const calque = el("g", { class: "microbes" }, sv);
    QUARTS.forEach((Q, q) => dents[q].forEach((d, i) => {
      const chef = i === 5;
      const g = el("g", { transform: `translate(${d.P.x.toFixed(1)} ${d.P.y.toFixed(1)})` }, calque);
      const m = el("g", { class: "microbe" + (chef ? " chef" : "") }, g);
      m.style.animationDelay = (-Math.random() * 1.2).toFixed(2) + "s";
      const r = chef ? 11 : 8;
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3 + .3;
        el("circle", { cx: (Math.cos(a) * r).toFixed(1), cy: (Math.sin(a) * r).toFixed(1), r: chef ? 3.4 : 2.6, class: "m-pic" }, m);
      }
      el("circle", { r, class: "m-corps" }, m);
      [-1, 1].forEach(sx => {
        el("circle", { cx: sx * r * .36, cy: -r * .18, r: r * .3, class: "m-oeil" }, m);
        el("circle", { cx: sx * r * .36 + .6, cy: -r * .12, r: r * .14, class: "m-pupille" }, m);
      });
      el("path", { d: `M${-r * .35} ${r * .32} Q0 ${r * .62} ${r * .35} ${r * .32}`, class: "m-bouche" }, m);
      if (chef) el("path", { d: "M-8 -10 L-8 -17 L-4 -13 L0 -19 L4 -13 L8 -17 L8 -10 Z", class: "m-couronne" }, m);
      d.m = m; d.g = g;
    }));
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
        if (d.etat !== etat) {
          d.etat = etat; d.r.setAttribute("class", etat);
          if (etat === "fait" && (phase === "brosse" || phase === "pause")) tuerMicrobe(d, i === 5);
        }
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

  /* ---------- microbes vaincus ---------- */
  const elScore = $("#score");
  let microbes = 0;
  function remettreMicrobes() {
    microbes = 0; elScore.textContent = "🦠 0";
    dents.forEach(z => z.forEach(d => { d.m.classList.remove("mort"); d.g.querySelectorAll(".m-pop").forEach(n => n.remove()); }));
  }
  function tuerMicrobe(d, chef) {
    if (d.m.classList.contains("mort")) return;
    d.m.classList.add("mort"); microbes++;
    elScore.textContent = "🦠 " + microbes;
    elScore.classList.remove("bump"); void elScore.offsetWidth; elScore.classList.add("bump");
    const t = el("text", { y: -14, "text-anchor": "middle", class: "m-pop" + (chef ? " chef" : "") }, d.g);
    t.textContent = chef ? "CHEF K.O. !" : "POP !";
    if (chef) { bip(988, .08); bip(1319, .08, .08); bip(1568, .14, .16); vibrer(80); }
    else { bip(1300, .04); bip(650, .05, .03); }
  }

  /* ---------- brossage ---------- */
  async function demarrer() {
    const qui = window.BeufaJeu.profilActif();
    if (!qui || !qui.age) return ouvrirFiche(qui, demarrer);
    $("#btn-demarrer").disabled = true;
    debloquerSon();
    if (mode === "beufa") pleinEcran(true);
    stopperCamera(); await lancerCamera();
    $("#btn-demarrer").disabled = false;
    if (avecPhotos()) return ouvrirPrepa();
    lancerBrossage();
  }

  /* ---------- installation (mode Beufa dents) ---------- */
  const elPrepa = $("#prepa"), elPrepaVideo = $("#prepa-video"), elPrepaCadre = $("#prepa-cadre");
  function ouvrirPrepa() {
    phase = "prepa"; montrer("brossage"); volumeFond(); jouerFond();
    elPrepaVideo.srcObject = flux; elPrepaVideo.play().catch(() => {});
    elPrepa.hidden = false; placer(elPrepa, elPrepaVideo, elPrepaCadre); garderEcran();
    parler("Pose ton téléphone debout devant toi, et recule un peu, pour qu'on voie ta tête et tes deux mains. Quand tu es prêt, appuie sur le bouton !");
  }
  function fermerPrepa() { elPrepa.hidden = true; elPrepaVideo.srcObject = null; }
  elPrepaVideo.addEventListener("loadedmetadata", () => placer(elPrepa, elPrepaVideo, elPrepaCadre));
  $("#btn-pret").addEventListener("click", () => { debloquerSon(); fermerPrepa(); lancerBrossage(); });

  function lancerBrossage() {
    ecoule = 0; tPause = 0; iPause = 0; derniereZone = -1;
    // pauses : toutes les 30 s ; en mode Beufa dents « 2 photos », une seule au milieu (+ la pose finale)
    pauses = avecPhotos() && nbPhotos === 2 ? [duree / 2]
      : [1, 2, 3].map(k => k * PAUSE_TOUTES_LES).filter(t => t < duree); dernierPoint = -1; poseIdx = 0;
    finale = false; poseActuelle = null; photos = []; viderGalerie();
    // les poses avec une photo du créateur passent d'abord (c'est la surprise), les autres ensuite
    poses = melanger(POSES_BEUFA.filter(p => p.photo)).concat(melanger(POSES_BEUFA.filter(p => !p.photo)));
    elMascotte.src = IMG("mains-hanches");
    fermerPose(); elPause.hidden = true;
    phase = "brosse";
    montrer("brossage");
    garderEcran();
    bip(523, .15); bip(784, .2, .16);
    parler(`${avecPrenom("C'est parti", " !")} On commence ${ZONES_VOIX[0]}, ${FACES_VOIX[0]}.`);
    volumeFond(); jouerFond();
    defiJusqua = 0; elMascotte.classList.remove("saute");
    remettreMicrobes(); preparerMystere();
    if (flux) DET.demarrer(elCamera, typeBrosse);
    attente = sansVisage = mauvaisCote = 0; coteDit = -1; relanceA = 2; visageA = 3;
    derniere = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(boucle);
    majAffichage();
  }

  function pleinEcran(oui) {
    try {
      const d = document, el = d.documentElement;
      if (oui && !d.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
      if (!oui && d.fullscreenElement && d.exitFullscreen) d.exitFullscreen().catch(() => {});
    } catch (e) {}
  }

  function arreter() {
    pleinEcran(false);
    cancelAnimationFrame(raf); lacherEcran(); stopperCamera(); phase = "accueil"; taire();
    fermerPose(); fermerPrepa(); elPause.hidden = true; montrer("accueil"); volumeFond(); jouerFond();
  }

  const avecPhotos = () => mode === "beufa" && !!flux;

  function boucle(now) {
    const dtR = Math.max(0, Math.min(.25, (now - derniere) / 1000)), dt = dtR * VITESSE;
    derniere = now;
    suivreDetection(dtR);
    if (phase === "brosse") {
      ecoule += dt * vitesseBrossage();   // façon Pokémon Smile : le temps n'avance que si on brosse
      if (ecoule >= duree) {
        if (!avecPhotos() || finale) return terminer();
        ecoule = duree; finale = true; commencerPause();     // pose finale
      } else if (iPause < pauses.length && ecoule >= pauses[iPause]) commencerPause();
    } else if (phase === "pause") {
      tPause += dt;
      if (poseActuelle && !cliche && tPause >= POSE_CLIC) prendrePhoto();
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
    // en mode Beufa dents, on prévient avant chaque photo
    const avantPhoto = avecPhotos() && phase === "brosse" &&
      ((iPause < pauses.length && pauses[iPause] - ecoule < 5) || (!finale && duree - ecoule < 5));
    const enDefi = !avantPhoto && ecoule < defiJusqua;
    elAstuce.textContent = avantPhoto ? "📸 Prépare-toi : photo avec Beufa dans un instant !" : enDefi ? "⭐ Défi : " + defiActuel : ASTUCES[p];
    elAstuce.classList.toggle("alerte", avantPhoto);
    elAstuce.classList.toggle("defi", enDefi);
    if (avantPhoto && !alerteDite) { alerteDite = true; parler("Prépare-toi, photo avec moi dans 5 secondes !"); }
    if (!avantPhoto && phase === "brosse") alerteDite = false;
    majBouche(z, Math.max(0, Math.min(1, (ecoule - z * dureeZone) / dureeZone)), p);

    let zoneAnnoncee = false;
    if (z !== derniereZone) {
      zoneAnnoncee = derniereZone !== -1;
      for (let k = 0; k < z; k++) devoiler(k);
      if (derniereZone !== -1 && phase === "brosse") {
        bip(740, .12); vibrer(120);
        defiActuel = hasard(ton().defis); defiJusqua = ecoule + Math.min(8, duree / 12);
        parler(`Maintenant, ${ZONES_VOIX[z]} ! Défi : ${defiActuel}`);
        animerMascotte();
      }
      derniereZone = z;
    }
    if (p !== dernierPoint) {
      if (dernierPoint !== -1 && phase === "brosse" && z === derniereZone) {
        bip(520, .06);
        if (!zoneAnnoncee && !avantPhoto) parler(`${hasard(ton().bravos)} ${FACES_VOIX[p][0].toUpperCase() + FACES_VOIX[p].slice(1)} !`);
        if (!zoneAnnoncee) animerMascotte();
      }
      dernierPoint = p;
    }
    if (phase === "pause") {
      if (poseActuelle) {
        if (tPause >= POSE_PREP && etapePose === "demo") passerEnPhoto();
        const n = tPause < POSE_PREP + POSE_PLACEMENT ? 0 : Math.ceil(POSE_CLIC - tPause);
        if (n !== dernierCompte) {
          dernierCompte = n;
          elStudioCompte.textContent = n > 0 ? String(n) : "";
          if (n > 0) elCadre.classList.remove("placement");
          if (n > 0) {
            bip(600, .08); vibrer(40); parler(String(n));
            elStudioCompte.classList.remove("pop"); void elStudioCompte.offsetWidth; elStudioCompte.classList.add("pop");
            rejouer(elPartenaire, "battement");
          }
        }
      } else {
        elPauseCompte.textContent = String(Math.max(1, Math.ceil(PAUSE_DUREE - tPause)));
      }
    }
  }
  let dernierCompte = 0, alerteDite = false, defiActuel = "", defiJusqua = 0;

  /* ---------- détection du brossage (js/detection.js), façon Pokémon Smile ----------
     Le chrono s'arrête si Beufa voit ton visage mais pas de brossage (après 1,2 s de tolérance) ;
     au bout de 8 s il repart doucement, pour ne jamais bloquer si la détection se trompe.
     Visage introuvable ou détection indisponible : le chrono avance normalement. */
  const DEBUG = new URLSearchParams(location.search).has("debug");
  const elDet = $("#detecteur"), elMousse = $("#mousse-bouche"), gM = elMousse.getContext("2d");
  let attente = 0, sansVisage = 0, mauvaisCote = 0, coteDit = -1, relanceA = 2, visageA = 3, conseilJusqua = 0, conseil = "";
  const bulles = [];
  const RELANCES = {
    enfant: ["Hé ! Je ne te vois pas brosser !", "Allez, la brosse bouge !", "Les microbes en profitent, brosse !", "Le temps s'arrête si tu ne brosses pas !"],
    adulte: ["Le chrono attend que tu brosses.", "On reprend le brossage ?", "Pas de brossage, pas de chrono."]
  };
  const detActive = () => flux && DET.etat.statut === "pret";
  function vitesseBrossage() {
    if (!detActive() || attente < 1.2) return 1;
    return attente > 8 ? .5 : 0;
  }
  function suivreDetection(dtR) {
    const d = DET.etat, actif = phase === "brosse" && detActive();
    if (actif) {
      attente = d.visage && !d.brosse ? attente + dtR : 0;
      sansVisage = d.visage ? 0 : sansVisage + dtR;
      if (attente < 1.2) relanceA = 2;
      else if (attente >= relanceA) { relanceA = attente + 7; parler(hasard(RELANCES[window.BeufaJeu.estAdulte() ? "adulte" : "enfant"]), false); vibrer(60); }
      if (sansVisage < 1) visageA = 3;
      else if (sansVisage >= visageA) { visageA = sansVisage + 12; parler("Je ne vois pas ta bouche ! Mets ta tête bien face au téléphone.", false); }
      // côté brossé (approximatif) : seulement face extérieure et dessus des dents, et sans insister
      const z = indexZone(), p = Math.min(2, Math.floor(((ecoule - z * duree / 4) / (duree / 4)) * 3));
      const attendu = ZONES[z].includes("gauche") ? "gauche" : "droite";
      if (d.brosse && d.cote && p !== 1) mauvaisCote = d.cote !== attendu ? mauvaisCote + dtR : Math.max(0, mauvaisCote - dtR);
      if (mauvaisCote > 3 && coteDit !== z * 3 + p) {
        coteDit = z * 3 + p; mauvaisCote = 0;
        conseil = `👉 Plutôt à ${attendu} !`; conseilJusqua = performance.now() + 3500;
        parler(`Plutôt à ${attendu} !`, false);
      }
    }
    // pastille : ce que Beufa voit
    const montrerPastille = flux && phase === "brosse" && d.statut !== "eteint" && d.statut !== "indisponible";
    let txt = "", cls = "detecteur";
    if (montrerPastille) {
      if (d.statut === "chargement") txt = "👁️ Beufa ouvre l'œil…";
      else if (performance.now() < conseilJusqua) { txt = conseil; cls += " conseil"; }
      else if (sansVisage > 1) { txt = "🙈 Je ne vois pas ta bouche"; cls += " perdu"; }
      else if (attente >= 1.2) { txt = "⏸ Brosse pour avancer !"; cls += " attend"; }
      else if (d.visage) { txt = "🪥 Je te vois brosser !"; cls += " ok"; }
      else txt = "👁️ Beufa te cherche…";
    }
    elDet.hidden = !txt;
    if (elDet.textContent !== txt) elDet.textContent = txt;
    if (elDet.className !== cls) elDet.className = cls;
    dessinerMousse(dtR, actif);
  }
  // bulles de mousse sur la bouche quand on brosse (+ zones analysées en mode ?debug)
  function dessinerMousse(dtR, actif) {
    const d = DET.etat, v = elCamera, miroir = elScene.classList.contains("vue-miroir");
    const voir = actif && miroir && v.videoWidth;
    elMousse.hidden = !voir;
    if (!voir) { bulles.length = 0; return; }
    const ew = v.offsetWidth, eh = v.offsetHeight, k = Math.min(2, window.devicePixelRatio || 1);
    if (elMousse.width !== Math.round(ew * k) || elMousse.height !== Math.round(eh * k)) { elMousse.width = Math.round(ew * k); elMousse.height = Math.round(eh * k); }
    elMousse.style.cssText = `left:${v.offsetLeft}px;top:${v.offsetTop}px;width:${ew}px;height:${eh}px`;
    // image entière (contain) collée en haut, en miroir
    const sc = Math.min(ew / v.videoWidth, eh / v.videoHeight), dw = v.videoWidth * sc, ox = (ew - dw) / 2;
    const ecran = (nx, ny) => ({ x: ox + (1 - nx) * dw, y: ny * v.videoHeight * sc });
    gM.setTransform(k, 0, 0, k, 0, 0); gM.clearRect(0, 0, ew, eh);
    if (d.brosse && d.bouche) {
      const c = ecran(d.bouche.x, d.bouche.y), L = d.bouche.l * dw;
      for (let i = 0; i < 2; i++) bulles.push({ x: c.x + (Math.random() - .5) * L * .7, y: c.y + (Math.random() - .3) * L * .25,
        r: L * (.03 + Math.random() * .06), vx: (Math.random() - .5) * L * .6, vy: -L * (.3 + Math.random() * .5), vie: 1 });
    }
    for (let i = bulles.length - 1; i >= 0; i--) {
      const b = bulles[i]; b.vie -= dtR * 1.1; b.x += b.vx * dtR; b.y += b.vy * dtR;
      if (b.vie <= 0) { bulles.splice(i, 1); continue; }
      gM.globalAlpha = Math.min(1, b.vie * 1.5);
      gM.fillStyle = "rgba(255,255,255,.55)"; gM.strokeStyle = "rgba(143,227,234,.95)"; gM.lineWidth = 1.5;
      gM.beginPath(); gM.arc(b.x, b.y, b.r, 0, 7); gM.fill(); gM.stroke();
      gM.fillStyle = "#fff"; gM.beginPath(); gM.arc(b.x - b.r * .35, b.y - b.r * .35, b.r * .25, 0, 7); gM.fill();
    }
    gM.globalAlpha = 1;
    if (bulles.length > 120) bulles.splice(0, bulles.length - 120);
    if (DEBUG && d.zones) {
      const z = d.zones, rect = (r, coul) => {
        const a = ecran((r.x + r.w) / z.vw, r.y / z.vh), b = ecran(r.x / z.vw, (r.y + r.h) / z.vh);
        gM.strokeStyle = coul; gM.lineWidth = 2; gM.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      };
      rect(z.b, d.brosse ? "#3ddc84" : "#ff5c8a"); rect(z.f, "#ffd166");
      gM.fillStyle = "rgba(0,0,0,.6)"; gM.fillRect(0, 48, 210, 44);
      gM.fillStyle = "#fff"; gM.font = "bold 13px system-ui";
      gM.fillText(`niveau ${(d.niveau * 100).toFixed(0)}  brosse ${d.brosse ? "OUI" : "non"}  côté ${d.cote || "-"}`, 8, 66);
      gM.fillText(`attente ${attente.toFixed(1)} s  vu ${d.tempsBrosse.toFixed(0)}/${d.tempsVisible.toFixed(0)} s`, 8, 84);
    }
  }

  // carte surprise : un quart se dévoile à chaque zone terminée
  const elMystere = $("#mystere");
  let carteSession = null;
  function preparerMystere() {
    carteSession = JEU.choisirCarte();
    elMystere.innerHTML = "";
    elMystere.appendChild(JEU.carteEl(carteSession));
    const t = document.createElement("div"); t.className = "tuiles";
    for (let i = 0; i < 4; i++) { const u = document.createElement("i"); u.textContent = "?"; t.appendChild(u); }
    elMystere.appendChild(t);
  }
  function devoiler(k) {
    const u = elMystere.querySelectorAll(".tuiles i")[k];
    if (u && !u.classList.contains("partie")) { u.classList.add("partie"); bip(1046, .08); bip(1568, .1, .08); }
  }

  // Beufa change de pose et saute
  function animerMascotte() {
    elMascotte.src = IMG(hasard(TOUTES_POSES.filter(x => !elMascotte.src.endsWith(`pose-${x}.png`))));
    elMascotte.classList.remove("saute"); void elMascotte.offsetWidth; elMascotte.classList.add("saute");
  }
  elMascotte.addEventListener("animationend", e => { if (e.animationName === "saute-m") elMascotte.classList.remove("saute"); });

  function commencerPause() {
    phase = "pause"; tPause = 0;
    if (!finale) iPause++;
    bip(880, .15); bip(660, .15, .17); vibrer([150, 80, 150]);
    DET.pause(true);
    if (avecPhotos()) {
      poseActuelle = poses[poseIdx++ % poses.length]; cliche = false; dernierCompte = 0;
      return ouvrirPose(poseActuelle);
    }
    elPause.querySelectorAll(".pause-img").forEach(n => n.remove());
    const img = new Image(); img.alt = ""; img.className = "pause-img";
    const pose = poses[poseIdx++ % poses.length];
    img.src = IMG(pose.mascotte);
    elPauseTitre.textContent = "Fais comme moi\u00a0!";
    elPauseSuite.innerHTML = "";
    elPauseSuite.append(pose.geste || pose.consigne, Object.assign(document.createElement("small"), { textContent: `Ensuite : ${ZONES[indexZone()].toLowerCase()}` }));
    parler(`Pause ! Fais comme moi : ${pose.geste || pose.consigne}`);
    elPause.querySelector(".pause-boite").insertBefore(img, elPauseCompte);
    elPause.hidden = false;
  }

  function finirPause() {
    const apresPhoto = !!poseActuelle;
    phase = "brosse"; fermerPose(); elPause.hidden = true; DET.pause(false); attente = 0;
    bip(523, .1); bip(784, .15, .12);
    parler(apresPhoto ? `Reprends ta brosse ! On continue ${ZONES_VOIX[indexZone()]}.` : `C'est reparti, ${ZONES_VOIX[indexZone()]} !`);
  }

  /* ---------- studio photo plein écran ----------
     1) Beufa montre la pose en très grand ; 2) caméra plein écran (image entière, sans zoom)
     avec Beufa à côté, 3-2-1, photo ; 3) aperçu + réaction. */
  const elPauseTitre = $("#pause-titre"), elStudio = $("#studio"), elStudioVideo = $("#studio-video");
  const elCadre = $("#cadre"), elPartenaire = $("#partenaire"), elBulle = $("#bulle"), elApercu = $("#apercu"), elFlash = $("#flash");
  const elStudioHaut = $("#studio-haut"), elStudioCompte = $("#studio-compte");
  const elDemoTitre = $("#demo-titre"), elDemoImg = $("#demo-img"), elDemoConsigne = $("#demo-consigne");
  let etapePose = "";

  // la vidéo et le cadre prennent exactement le format de la caméra, le plus grand possible
  function placer(boite, video, cadre) {
    const vw = video.videoWidth || 3, vh = video.videoHeight || 4;
    const sw = boite.clientWidth, sh = boite.clientHeight;
    let w = sw, h = sw * vh / vw;
    if (h > sh) { h = sh; w = sh * vw / vh; }
    const st = `left:${(sw - w) / 2}px;top:${(sh - h) / 2}px;width:${w}px;height:${h}px`;
    video.style.cssText = st; cadre.style.cssText = st;
  }
  const placerCadre = () => { placer(elStudio, elStudioVideo, elCadre); placeGardee(); };
  // la place gardée (pointillés) : là où le créateur (ou Beufa) apparaîtra après le brossage
  let poseStudio = null;
  function placeGardee() {
    const p = poseStudio; if (!p) return;
    const st = elPartenaire.style;
    const elCible = $("#cible");
    elCible.hidden = true;
    if (p.createur) {
      // son ombre, à sa vraie place (la photo reste une surprise) + la cible où mettre la main
      const v = elStudioVideo, ratio = v.videoWidth ? v.videoWidth / v.videoHeight : 3 / 4;
      st.cssText = stylePlace(p, ratio);
      if (p.cible) {
        const r = placeCreateur(p, ratio, 1);
        elCible.style.left = Math.max(6, Math.min(94, (r.x + p.cible.x * r.w) / ratio * 100)) + "%";
        elCible.style.top = Math.max(6, Math.min(94, (r.y + p.cible.y * r.h) * 100)) + "%";
        elCible.querySelector("small").textContent = p.cible.texte;
        elCible.hidden = false;
      }
    } else {
      const m = p.imgMascotte;
      st.cssText = `height:${PART.mascotteH * 100}%;bottom:${PART.bas * 100}%;aspect-ratio:${m.naturalWidth ? `${m.naturalWidth} / ${m.naturalHeight}` : "305 / 738"}`;
    }
  }
  window.addEventListener("resize", () => {
    if (!elStudio.hidden) placerCadre();
    if (!elPrepa.hidden) placer(elPrepa, elPrepaVideo, elPrepaCadre);
  });
  document.addEventListener("click", e => { if (e.target.closest(".btn-fermer-studio")) arreter(); });
  elStudioVideo.addEventListener("loadedmetadata", placerCadre);

  function rejouer(n, cls) { n.classList.remove(cls); void n.offsetWidth; n.classList.add(cls); }

  function ouvrirPose(p) {
    elStudioVideo.srcObject = flux; elStudioVideo.play().catch(() => {});
    elDemoTitre.textContent = finale ? "Pose finale\u00a0!" : "Fais comme moi\u00a0!";
    elDemoImg.src = IMG(p.mascotte);
    const elEmoji = $("#demo-emoji"), em = p.createur || p.id === "check-poing" ? p.emoji : ""; elEmoji.hidden = !em; elEmoji.textContent = em || "";
    const cons = consigneDe(p);
    elDemoTitre.textContent = p.createur ? (finale ? "Pose finale\u00a0!" : "À toi de jouer\u00a0!") : elDemoTitre.textContent;
    elDemoConsigne.textContent = cons;
    elStudioHaut.textContent = (p.createur && p.emoji ? p.emoji + " " : "") + cons;
    $("#studio-guide").src = IMG(p.mascotte);
    elStudioCompte.textContent = "";
    // la place du partenaire reste vide : sa photo n'apparaîtra qu'après le brossage (surprise)
    elPartenaire.className = p.createur ? "zone-surprise ombre" : "zone-surprise";
    elPartenaire.innerHTML = p.createur ? `<img src="${p.createur.src}" alt=""><b>?</b>` : "<span>✨</span>Place gardée<br>pour une surprise";
    poseStudio = p; placeGardee();
    elBulle.textContent = p.createur ? "Qui est-ce ? Fais la pose avec lui !" : "Laisse cette place libre !"; elBulle.classList.remove("reaction");
    elApercu.hidden = true;
    elCadre.className = `cadre cote-${p.cote}${p.createur ? " avec-createur" : ""}`;
    etapePose = "demo"; elStudio.className = "studio etape-demo"; elStudio.hidden = false;
    placerCadre();
    rejouer(elDemoImg, "montre"); rejouer(elDemoTitre, "pop"); rejouer(elDemoConsigne, "pop");
    bip(392, .08, .25); bip(523, .08, .35); bip(659, .12, .45);
    parler(`${finale ? "Pose finale ! " : ""}Pose ta brosse : ${cons}`);
  }

  function passerEnPhoto() {
    etapePose = "photo"; elStudio.className = "studio etape-photo"; placerCadre();
    rejouer(elPartenaire, "entre"); rejouer(elBulle, "pop");
    // d'abord le temps de se placer (ovale qui clignote), ensuite seulement le 3-2-1
    elCadre.classList.add("placement");
    elStudioCompte.textContent = "Place-toi !"; rejouer(elStudioCompte, "pop");
    bip(784, .1);
    parler("Mets ta tête dans l'ovale, et fais la pose !");
  }

  function fermerPose() {
    elStudio.hidden = true; elStudioVideo.srcObject = null; etapePose = ""; poseActuelle = null;
  }

  function prendrePhoto() {
    cliche = true;
    const v = elStudioVideo, vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh) return;
    // image entière de la caméra (pas de recadrage), en miroir comme à l'écran
    const k = Math.min(1, 1280 / Math.max(vw, vh));
    const c = document.createElement("canvas");
    c.width = Math.round(vw * k); c.height = Math.round(vh * k);
    const x = c.getContext("2d");
    x.translate(c.width, 0); x.scale(-1, 1);
    x.drawImage(v, 0, 0, c.width, c.height);
    photos.push({ pose: poseActuelle, img: c, bulle: hasard(ton().bulles) });
    // aperçu façon polaroïd + réaction de Beufa
    elApercu.src = c.toDataURL("image/jpeg", .6); elApercu.hidden = false;
    elBulle.textContent = hasard(ton().reactions);
    parler("Clic ! " + (Math.random() < .5 ? avecPrenom(elBulle.textContent.replace(/ ?[!.]$/, ""), " !") : elBulle.textContent));
    elBulle.classList.add("reaction"); rejouer(elBulle, "pop");
    elPartenaire.classList.remove("battement");
    rejouer(elFlash, "go");
    bip(1200, .05); bip(900, .08, .05); vibrer(60);
  }

  /* ---------- montage avec le créateur (ou la mascotte) ---------- */
  let W = 1080, H = 1440;
  const BANDE = 110;

  function bulleCanvas(x, texte, cx, cy, versCote) {
    x.save();
    x.font = "900 50px ui-rounded, Nunito, system-ui, sans-serif";
    const tw = x.measureText(texte).width, bw = tw + 64, bh = 96;
    const bx = Math.max(16, Math.min(W - bw - 16, cx - bw / 2)), by = cy - bh / 2;
    x.shadowColor = "rgba(0,0,0,.25)"; x.shadowBlur = 18; x.shadowOffsetY = 6;
    x.fillStyle = "#fff";
    x.beginPath(); x.roundRect(bx, by, bw, bh, 48); x.fill();
    // petite queue vers la mascotte
    const qx = Math.max(bx + 50, Math.min(bx + bw - 50, cx + versCote * 60));
    x.beginPath(); x.moveTo(qx - 22, by + bh - 4); x.lineTo(qx + 22, by + bh - 4); x.lineTo(qx + versCote * 30, by + bh + 34); x.fill();
    x.shadowColor = "transparent";
    x.fillStyle = "#ff5c8a"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(texte, bx + bw / 2, by + bh / 2 + 2);
    x.restore();
  }

  function etoile(x, cx, cy, r, coul) {
    x.save(); x.fillStyle = coul; x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, rr = i % 2 ? r * .38 : r;
      x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.closePath(); x.fill(); x.restore();
  }

  // tampon « BROSSÉ ! » avec la date, façon coup de tampon encreur
  function infosTampon() {
    const d = new Date();
    return {
      date: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }).replace(".", "").toUpperCase(),
      moment: window.BeufaJeu.moment(d) === "matin" ? "★ MATIN ★" : "★ SOIR ★"
    };
  }
  function tamponCanvas(x, cx, cy, r) {
    const t = infosTampon(), k = Math.ceil(r * 2 + 24);
    const o = document.createElement("canvas"); o.width = o.height = k;
    const g = o.getContext("2d"), m = k / 2;
    g.strokeStyle = g.fillStyle = "#e0243c";
    g.lineWidth = r * .07; g.beginPath(); g.arc(m, m, r, 0, 7); g.stroke();
    g.lineWidth = r * .025; g.beginPath(); g.arc(m, m, r * .82, 0, 7); g.stroke();
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `900 ${r * .34}px Fredoka, ui-rounded, system-ui, sans-serif`; g.fillText("BROSSÉ !", m, m - r * .3);
    g.fillRect(m - r * .62, m - r * .07, r * 1.24, r * .03);
    g.font = `800 ${r * .2}px Fredoka, ui-rounded, system-ui, sans-serif`; g.fillText(t.date, m, m + r * .14);
    g.font = `800 ${r * .15}px Fredoka, ui-rounded, system-ui, sans-serif`; g.fillText(t.moment, m, m + r * .44);
    // encre irrégulière
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 260; i++) { g.globalAlpha = Math.random() * .6; g.beginPath(); g.arc(Math.random() * k, Math.random() * k, Math.random() * r * .035 + 1, 0, 7); g.fill(); }
    x.save(); x.translate(cx, cy); x.rotate(-.2); x.globalAlpha = .9; x.drawImage(o, -m, -m); x.restore();
  }

  // luminosité de la photo de l'utilisateur -> on assombrit un peu le créateur dans une pièce sombre
  // (ses photos sont prises dans une salle de bain très claire), jamais beaucoup
  function eclairage(img) {
    try {
      const c = document.createElement("canvas"); c.width = c.height = 24;
      const g = c.getContext("2d"); g.drawImage(img, 0, 0, 24, 24);
      const d = g.getImageData(0, 0, 24, 24).data; let l = 0;
      for (let i = 0; i < d.length; i += 4) l += .3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2];
      return Math.min(1.08, Math.max(.8, Math.sqrt(l / (d.length / 4) / 150)));
    } catch (e) { return 1; }
  }

  function composer({ pose, img, bulle, tampon }) {
    W = 1080; H = Math.round(W * img.height / img.width);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0, W, H);
    const estCreateur = !!pose.createur, part = pose.createur || pose.imgMascotte;
    if (estCreateur) {
      // le créateur, à la taille de l'utilisateur, accordé à la lumière de sa photo, halo néon
      const r = placeCreateur(pose, W, H);
      x.save();
      if ("filter" in x) x.filter = `brightness(${eclairage(img).toFixed(2)})`;
      x.shadowColor = "rgba(255,60,200,.7)"; x.shadowBlur = 28;
      x.drawImage(part, r.x, r.y, r.w, r.h);
      x.restore();
      [[-.2, .05, 24, "#ffd166"], [.22, .3, 18, "#fff"], [-.24, .55, 16, "#8fe3ea"], [.25, .85, 22, "#ff7aa2"]]
        .forEach(([dx, dy, rr, c]) => etoile(x, r.tx + dx * H, r.ty + dy * r.th, rr, c));
      if (bulle) bulleCanvas(x, bulle, pose.cote === "droite" ? W * .66 : W * .34, Math.max(70, r.ty - 70), pose.cote === "droite" ? 1 : -1);
    } else if (part.naturalWidth) {
      const h = H * PART.mascotteH;
      const w = h * part.naturalWidth / part.naturalHeight;
      const m = W * PART.marge;
      const px = pose.cote === "droite" ? W - w - m : m;
      const py = H - h - H * PART.bas;  // même place que dans le studio
      x.save();
      x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 30; x.shadowOffsetY = 10;
      x.drawImage(part, px, py, w, h);
      x.restore();
      // étincelles autour de Beufa + bulle
      const cx = px + w / 2;
      [[-.55, .1, 26, "#ffd166"], [.5, .02, 20, "#fff"], [-.35, .35, 16, "#8fe3ea"], [.55, .4, 24, "#ff7aa2"]]
        .forEach(([dx, dy, r, c]) => etoile(x, cx + dx * w, py + dy * h, r, c));
      if (bulle) bulleCanvas(x, bulle, pose.cote === "droite" ? W * .66 : W * .34, Math.max(70, py - 70), pose.cote === "droite" ? 1 : -1);
    }
    if (tampon) {   // côté utilisateur, en bas
      const r = Math.max(W, H) * .12;
      tamponCanvas(x, pose.cote === "droite" ? r + W * .06 : W - r - W * .06, H - BANDE - r - H * .03, r);
    }
    // bandeau souvenir
    x.fillStyle = "rgba(255,255,255,.88)"; x.fillRect(0, H - BANDE, W, BANDE);
    x.fillStyle = "#0b8f9a"; x.textBaseline = "middle";
    x.font = "800 46px ui-rounded, Nunito, system-ui, sans-serif";
    x.fillText(prenom ? `${prenom} & Beufa ✨` : "Brossé avec Beufa ✨", 36, H - BANDE / 2);
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
    if (typeof elRev !== "undefined") { elRev.hidden = true; clearTimeout(revT); revFin = null; }
    ecrans.fin.classList.remove("avec-photos"); elVision.hidden = true;
  }

  function ajouterVignette(s, alt, classe = "") {
    const b = document.createElement("button"); b.type = "button"; b.className = "vignette " + classe;
    const im = new Image(); im.src = s.url; im.alt = alt;
    b.appendChild(im); b.addEventListener("click", () => ouvrirVision(s));
    elGalerie.appendChild(b);
  }

  // toutes les photos réunies en une planche de bande dessinée
  async function planche(blobs) {
    const imgs = [];
    for (const b of blobs) { try { imgs.push(await createImageBitmap(b)); } catch (e) {} }
    if (!imgs.length) return null;
    const PW = 1080, M = 36, G = 26, HAUT = 190, BAS = 110;
    const cols = imgs.length === 1 ? 1 : 2;
    const cw = (PW - 2 * M - (cols - 1) * G) / cols, ch = cw * imgs[0].height / imgs[0].width;
    const lignes = Math.ceil(imgs.length / cols);
    const PH = Math.round(HAUT + lignes * ch + (lignes - 1) * G + BAS);
    const c = document.createElement("canvas"); c.width = PW; c.height = PH;
    const x = c.getContext("2d");
    // fond jaune à petits points façon BD
    x.fillStyle = "#ffd166"; x.fillRect(0, 0, PW, PH);
    x.fillStyle = "rgba(255,122,162,.28)";
    for (let yy = 0; yy < PH; yy += 22) for (let xx = (yy / 22) % 2 ? 11 : 0; xx < PW; xx += 22) { x.beginPath(); x.arc(xx, yy, 4, 0, 7); x.fill(); }
    // titre
    x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
    const titre = prenom ? `LES AVENTURES DE ${prenom.toUpperCase()} & BEUFA` : "LES AVENTURES DE BEUFA";
    let taille = 66; x.font = `900 ${taille}px ui-rounded, Nunito, system-ui, sans-serif`;
    while (x.measureText(titre).width > PW - 2 * M && taille > 30) { taille -= 2; x.font = `900 ${taille}px ui-rounded, Nunito, system-ui, sans-serif`; }
    x.lineWidth = 14; x.strokeStyle = "#12343b"; x.strokeText(titre, PW / 2, HAUT / 2);
    x.fillStyle = "#fff"; x.fillText(titre, PW / 2, HAUT / 2);
    // cases
    imgs.forEach((im, i) => {
      const l = Math.floor(i / cols), k = i % cols;
      const seule = cols === 2 && i === imgs.length - 1 && imgs.length % 2 === 1;
      const cx = seule ? (PW - cw) / 2 : M + k * (cw + G), cy = HAUT + l * (ch + G);
      x.save();
      x.translate(cx + cw / 2, cy + ch / 2); x.rotate((i % 2 ? 1 : -1) * .012 * (1 + l));
      x.fillStyle = "#12343b"; x.fillRect(-cw / 2 - 8, -ch / 2 - 8, cw + 16, ch + 16);
      x.drawImage(im, -cw / 2, -ch / 2, cw, ch);
      // numéro de case
      x.fillStyle = "#ff5c8a"; x.beginPath(); x.arc(-cw / 2 + 34, -ch / 2 + 34, 26, 0, 7); x.fill();
      x.lineWidth = 5; x.strokeStyle = "#fff"; x.stroke();
      x.fillStyle = "#fff"; x.font = "900 32px ui-rounded, Nunito, system-ui, sans-serif"; x.fillText(String(i + 1), -cw / 2 + 34, -ch / 2 + 36);
      x.restore();
    });
    // bas de page
    x.fillStyle = "#12343b"; x.font = "800 38px ui-rounded, Nunito, system-ui, sans-serif";
    x.fillText(`Dents brillantes ✨  ·  ${new Date().toLocaleDateString("fr-FR")}`, PW / 2, PH - BAS / 2);
    return new Promise(r => c.toBlob(b => r(b), "image/jpeg", .9));
  }

  async function afficherMontages() {
    if (!photos.length) return;
    elMontages.hidden = false; ecrans.fin.classList.add("avec-photos");
    const blobs = [];
    for (const ph of photos) { const b = await composer(ph); if (b) blobs.push(b); }
    photos = [];   // les canvas bruts ne servent plus
    const t = Date.now();
    const bd = await planche(blobs);
    if (bd) {
      const s = { blob: bd, url: URL.createObjectURL(bd), nom: `beufa-dents-bd-${t}.jpg` };
      souvenirs.push(s); ajouterVignette(s, "Ta planche BD avec Beufa", "bd");
    }
    blobs.forEach((blob, i) => {
      const s = { blob, url: URL.createObjectURL(blob), nom: `beufa-dents-${t}-${i + 1}.jpg` };
      souvenirs.push(s); ajouterVignette(s, `Photo souvenir ${i + 1} avec Beufa`);
    });
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
    if (phase === "brosse" || phase === "pause") { ecoule = duree; majBouche(3, 1, 2); }   // derniers microbes
    cancelAnimationFrame(raf); lacherEcran(); fermerPose(); elPause.hidden = true;
    pleinEcran(false); arreterFond();   // place à la fanfare
    stopperCamera(); phase = "fin";
    vibrer([200, 100, 200, 100, 400]);
    $("#fin-titre").textContent = avecPrenom("Bravo", "\u00a0!");
    const res = carteSession ? JEU.enregistrer({ carte: carteSession, microbes }) : null;
    const avecPh = photos.length > 0;
    if (avecPh) photos[photos.length - 1].tampon = true;   // le tampon du jour, sur la dernière photo
    const revs = photos.map(ph => ({ url: ph.img.toDataURL("image/jpeg", .85), ratio: ph.img.width / ph.img.height, pose: ph.pose, tampon: !!ph.tampon }));
    const recompense = () => { montrerCarteGagnee(res); feter(avecPh, res); confettis(); };
    montrerCarteGagnee(null); $("#fin-zones").innerHTML = "";
    montrer("fin");
    afficherMontages();
    if (avecPh) lancerRevelation(revs, recompense); else recompense();
  }

  // petite fanfare, Beufa qui danse, les 4 zones validées une à une
  let danseT = 0;
  /* ---------- révélation : la photo du créateur complète celle de l'utilisateur ---------- */
  const elRev = $("#revelation"), elRevUser = $("#rev-user"), elRevPart = $("#rev-part"), elRevScene = $("#rev-scene");
  let revs = [], revI = 0, revT = 0, revFin = null;
  function lancerRevelation(liste, fin) {
    revs = liste; revI = 0; revFin = fin; elRev.hidden = false;
    const pts = $("#rev-points"); pts.innerHTML = "";
    liste.forEach(() => pts.appendChild(document.createElement("i")));
    montrerRev();
  }
  function montrerRev() {
    clearTimeout(revT);
    const r = revs[revI], createur = !!r.pose.createur, part = r.pose.createur || r.pose.imgMascotte;
    $("#rev-titre").textContent = revI === 0 ? "Surprise\u00a0!" : "Et là\u00a0?";
    $("#rev-sous").textContent = revI === 0 ? "Quelqu'un a gardé ta photo pour la compléter…" : "Photo " + (revI + 1) + " sur " + revs.length;
    document.querySelectorAll("#rev-points i").forEach((p, i) => p.classList.toggle("on", i <= revI));
    elRevScene.style.aspectRatio = String(r.ratio);
    elRevScene.style.width = `min(92vw, 470px, calc(58dvh * ${r.ratio}))`;
    elRevUser.src = r.url;
    elRevPart.src = part.src;
    elRevPart.style.cssText = createur ? stylePlace(r.pose, r.ratio) : `height:${PART.mascotteH * 100}%;bottom:${PART.bas * 100}%`;
    elRevPart.className = `rev-part cote-${r.pose.cote}${createur ? " createur" : ""}`;
    elRevScene.className = "rev-scene"; rejouer(elRevScene, "apparait");
    const elT = $("#rev-tampon"); elT.hidden = true; elT.className = `rev-tampon cote-${r.pose.cote}`;
    if (r.tampon) { const t = infosTampon(); $("#rev-tampon-date").textContent = t.date; $("#rev-tampon-moment").textContent = t.moment; }
    $("#rev-suite").textContent = revI < revs.length - 1 ? "Photo suivante" : "Voir ma récompense";
    // roulement de tambour… puis le partenaire arrive
    for (let k = 0; k < 8; k++) bip(180 + k * 12, .05, k * .11);
    revT = setTimeout(() => {
      elRevPart.classList.add("arrive");
      bip(784, .12); bip(1047, .12, .12); bip(1319, .2, .24); vibrer([60, 40, 120]);
      if (revI === 0) parler(createur ? "Surprise ! On s'est brossé les dents ensemble !" : "Surprise ! C'est moi, Beufa !");
      if (r.tampon) revT = setTimeout(() => {
        const elT = $("#rev-tampon"); elT.hidden = false; rejouer(elT, "pan");
        bip(90, .18); bip(140, .1, .02); vibrer(90);
      }, 1300);
    }, 1100);
  }
  $("#rev-suite").addEventListener("click", () => {
    if (++revI < revs.length) return montrerRev();
    clearTimeout(revT); elRev.hidden = true; taire();
    if (revFin) { const f = revFin; revFin = null; f(); }
  });

  function montrerCarteGagnee(res) {
    const boite = $("#fin-carte-boite"), bloc = $("#fin-carte");
    boite.innerHTML = ""; bloc.hidden = !res;
    $("#fin-mascotte").hidden = !!res;
    const st = $("#fin-stats"); st.innerHTML = "";
    if (!res) return;
    $("#fin-carte-titre").textContent = res.nouvelle ? (carteSession.rare ? "Carte RARE\u00a0!" : "Nouvelle carte\u00a0!") : `Encore elle\u00a0! (×${res.exemplaires})`;
    const c = JEU.carteEl(carteSession); c.classList.add("retourne"); boite.appendChild(c);
    [`🦠 ${microbes} ${ton().microbes}`, `🔥 ${res.serie} jour${res.serie > 1 ? "s" : ""} d'affilée`]
      .concat(res.deuxFois ? ["☀️🌙 Matin et soir !"] : [])
      .concat(DET.etat.tempsVisible > 10 ? [`🪥 Brossage vu : ${Math.round(100 * Math.min(1, DET.etat.tempsBrosse / DET.etat.tempsVisible))} %`] : [])
      .forEach((t, i) => { const b = document.createElement("span"); b.textContent = t; b.style.animationDelay = (.6 + i * .25) + "s"; st.appendChild(b); });
  }

  function feter(avecPhotos, res) {
    const air = [[523, 0], [659, .14], [784, .28], [1047, .42], [784, .62], [1047, .76], [1319, .9]];
    air.forEach(([f, t]) => bip(f, .18, t));
    const elZ = $("#fin-zones"); elZ.innerHTML = "";
    ZONES.forEach((z, i) => {
      const d = document.createElement("span"); d.textContent = "✓ " + z; d.style.animationDelay = (1.1 + i * .35) + "s";
      elZ.appendChild(d); bip(880 + i * 110, .1, 1.1 + i * .35);
    });
    const carte = res ? ton().fin(microbes, carteSession.nom, res.nouvelle) : "";
    const serie = res && res.serie > 1 ? ton().serie(res.serie) : "";
    setTimeout(() => parler(avecPrenom("Bravo", " !") + carte + serie + (avecPhotos ? " Et regarde notre bande dessinée !" : "")), 900);
    const el = $("#fin-mascotte"), danse = ["pouce", "main-levee", "coeur", "mains-hanches"];
    let k = 0; clearInterval(danseT);
    danseT = setInterval(() => {
      if (phase !== "fin") return clearInterval(danseT);
      el.src = IMG(danse[k++ % danse.length]);
    }, 650);
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

  /* ---------- suivi (accueil) et album ---------- */
  function majSuivi() {
    const j = JEU.lire(), s = JEU.serie(j), auj = j.jours[JEU.cleJour(new Date())] || {};
    $("#serie").textContent = `🔥 ${s} jour${s > 1 ? "s" : ""}`;
    $("#serie").classList.toggle("eteinte", s === 0);
    $("#m-matin").classList.toggle("fait", !!auj.matin);
    $("#m-soir").classList.toggle("fait", !!auj.soir);
    const n = JEU.CARTES.filter(c => j.cartes[c.id]).length;
    $("#album-compte").textContent = `${n}/${JEU.CARTES.length}`;
  }
  function ouvrirAlbum() {
    const j = JEU.lire();
    $("#album-stats").innerHTML = "";
    [`🪥 ${j.brossages} brossage${j.brossages > 1 ? "s" : ""}`, `🦠 ${j.microbes} microbes`, `🔥 record ${j.record} j`]
      .forEach(t => { const b = document.createElement("span"); b.textContent = t; $("#album-stats").appendChild(b); });
    const cal = $("#calendrier"); cal.innerHTML = "";
    const jours = ["D", "L", "M", "M", "J", "V", "S"];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const e = j.jours[JEU.cleJour(d)] || {};
      const c = document.createElement("div"); c.className = "jour" + (i === 0 ? " auj" : "");
      c.innerHTML = `<small>${jours[d.getDay()]}</small><i class="${e.matin ? "ok" : ""}">☀️</i><i class="${e.soir ? "ok" : ""}">🌙</i>`;
      c.title = d.toLocaleDateString("fr-FR");
      cal.appendChild(c);
    }
    const g = $("#album-grille"); g.innerHTML = "";
    JEU.CARTES.forEach(c => {
      const n = j.cartes[c.id] || 0;
      const k = JEU.carteEl(c, { cachee: !n, compte: n });
      if (!n && c.rare) k.querySelector(".carte-nom").textContent = "7 jours d'affilée";
      g.appendChild(k);
    });
    montrer("album"); ecrans.album.scrollTop = 0;
  }
  $("#btn-album").addEventListener("click", ouvrirAlbum);
  $("#btn-album-retour").addEventListener("click", () => { majSuivi(); montrer("accueil"); });
  majProfils();

  /* ---------- intro : le générique « Votre plus beau sourire », joué une seule fois ---------- */
  const musique = { tampon: null, source: null, gain: null, lancee: false };
  let chargementMusique = null;
  function chargerMusique() {
    if (!chargementMusique) chargementMusique = fetch("assets/intro.mp3")
      .then(r => r.arrayBuffer())
      .then(ab => {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        return new Promise((ok, ko) => audio.decodeAudioData(ab, ok, ko));
      })
      .then(t => (musique.tampon = t))
      .catch(() => null);
    return chargementMusique;
  }
  function brancher() {
    const src = audio.createBufferSource(); src.buffer = musique.tampon; src.connect(musique.gain);
    src.start();
    src.onended = () => { if (musique.source === src) musique.source = null; };   // fin de la chanson : silence
    musique.source = src;
  }
  function jouerMusique() {
    if (!sonActif || phase !== "intro" || !musique.tampon || musique.source) return;
    if (audio.state !== "running") return;
    musique.gain = audio.createGain(); musique.gain.gain.value = .85; musique.gain.connect(audio.destination);
    brancher(); musique.lancee = true; $("#intro-son").hidden = true;
  }
  function arreterMusique(fondu = .6) {
    const src = musique.source, g = musique.gain;
    if (!src) return;
    musique.source = null; src.onended = null;
    try { g.gain.setTargetAtTime(0, audio.currentTime, fondu / 3); src.stop(audio.currentTime + fondu); } catch (e) {}
  }
  function majMusique() {
    if (PHASES_FOND.includes(phase)) return sonActif ? jouerFond() : arreterFond(.3);
    if (phase !== "intro") return;
    if (sonActif) { if (audio && audio.state !== "running") audio.resume().then(jouerMusique).catch(() => {}); else jouerMusique(); }
    else { arreterMusique(.3); $("#intro-son").hidden = true; }
  }
  // la chanson se charge pendant l'écran « Appuie sur l'écran », puis la musique de fond
  chargerMusique().then(() => chargerFond());
  // l'appui autorise le son (règle des téléphones) : on passe à l'intro et la musique démarre
  function lancerIntro() {
    if (phase !== "demarrage") return;
    debloquerSon();
    try { localStorage.removeItem("beufa-intro-vue"); } catch (e) {}   // ancien réglage « une fois par jour », plus utilisé
    phase = "intro"; montrer("intro");
    if (!sonActif) return;
    Promise.all([audio.resume().catch(() => {}), chargerMusique()]).then(() => {
      if (phase !== "intro") return;
      jouerMusique();
      // filet de sécurité : si le téléphone bloque encore, un toucher sur l'intro relancera la musique
      setTimeout(() => { if (phase === "intro" && sonActif && !musique.lancee) $("#intro-son").hidden = false; }, 400);
    });
  }
  ecrans.demarrage.addEventListener("click", lancerIntro);
  ecrans.demarrage.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); lancerIntro(); } });
  /* ---------- musique de fond de l'interface : « Game Show Groove » (sans paroles) ----------
     Elle démarre avec son intro, puis tourne en boucle sur 85 mesures de groove (129 BPM),
     de 3,516 s à 161,652 s : on ne rejoue jamais l'intro ni la coupure de la fin.
     Elle joue sur l'accueil et l'album, s'arrête pendant le brossage et reprend où elle en était. */
  const FOND = { debut: 3.516, fin: 161.652, volume: .38, volumeBrossage: .13 };
  const PHASES_FOND = ["accueil", "prepa", "brosse", "pause"];
  const volumeVoulu = () => (phase === "accueil" ? FOND.volume : FOND.volumeBrossage);
  // pendant le brossage, la musique continue tout bas (sous la voix de Beufa)
  function volumeFond() { if (fond.gain && fond.source) fond.gain.gain.setTargetAtTime(volumeVoulu(), audio.currentTime, .5); }
  const fond = { tampon: null, source: null, gain: null, depart: 0, pos: 0 };
  let chargementFond = null;
  function chargerFond() {
    if (!chargementFond) chargementFond = fetch("assets/fond.mp3")
      .then(r => r.arrayBuffer())
      .then(ab => {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        return new Promise((ok, ko) => audio.decodeAudioData(ab, ok, ko));
      })
      .then(t => (fond.tampon = t))
      .catch(() => null);
    return chargementFond;
  }
  function positionFond() {
    let p = audio.currentTime - fond.depart;
    if (p > FOND.fin) p = FOND.debut + ((p - FOND.debut) % (FOND.fin - FOND.debut));
    return p;
  }
  function jouerFond() {
    if (!sonActif || !PHASES_FOND.includes(phase) || fond.source || !audio) return;
    if (!fond.tampon) { chargerFond().then(() => { if (fond.tampon) jouerFond(); }); return; }
    if (audio.state !== "running") { audio.resume().then(() => { if (audio.state === "running") jouerFond(); }).catch(() => {}); return; }
    const g = audio.createGain(); g.gain.value = 0; g.connect(audio.destination);
    g.gain.setTargetAtTime(volumeVoulu(), audio.currentTime, .4);        // fondu d'entrée
    const src = audio.createBufferSource(); src.buffer = fond.tampon;
    src.loop = true; src.loopStart = FOND.debut; src.loopEnd = FOND.fin;
    src.connect(g); src.start(0, fond.pos);
    fond.depart = audio.currentTime - fond.pos; fond.source = src; fond.gain = g;
  }
  function arreterFond(fondu = .6) {
    const src = fond.source, g = fond.gain;
    if (!src) return;
    fond.pos = positionFond(); fond.source = null;
    try { g.gain.setTargetAtTime(0, audio.currentTime, fondu / 3); src.stop(audio.currentTime + fondu); } catch (e) {}
  }

  function quitterIntro() {
    arreterMusique(); phase = "accueil"; montrer("accueil");
    jouerFond();
    if (!window.BeufaJeu.profils().liste.length) ouvrirFiche(null);
  }
  ecrans.intro.addEventListener("click", e => {
    if (e.target.closest(".btn-son")) return;
    const surBouton = !!e.target.closest("#btn-intro");
    // premier toucher alors que la musique était bloquée : on la lance et on reste sur l'intro
    if (sonActif && !musique.lancee && musique.tampon) {
      debloquerSon();
      audio.resume().then(jouerMusique).catch(() => {});
      if (surBouton && $("#intro-son").hidden && audio.state === "running") return quitterIntro();
      return;
    }
    if (surBouton) quitterIntro();
  });
  document.addEventListener("visibilitychange", () => {
    if ((phase !== "intro" && phase !== "accueil") || !audio) return;
    if (document.hidden) audio.suspend().catch(() => {}); else audio.resume().catch(() => {});
  });

  $("#btn-demarrer").addEventListener("click", demarrer);
  $("#btn-arreter").addEventListener("click", arreter);
  $("#btn-recommencer").addEventListener("click", () => { phase = "accueil"; viderGalerie(); majSuivi(); montrer("accueil"); jouerFond(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) taire();
    if (!document.hidden && (phase === "brosse" || phase === "pause")) garderEcran();
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    // nouvelle version installée : on recharge tout seul, mais jamais en plein brossage
    const avaitUnControleur = !!navigator.serviceWorker.controller;
    let rechargee = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!avaitUnControleur || rechargee) return;
      const recharger = () => { if (!rechargee) { rechargee = true; location.reload(); } };
      if (phase === "demarrage" || phase === "intro" || phase === "accueil") return recharger();
      const attente = setInterval(() => { if (phase === "accueil") { clearInterval(attente); recharger(); } }, 2000);
    });
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then(r => r.update())
      .catch(() => {});
  }
})();
