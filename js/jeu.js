/* Collection de cartes, journal des brossages (matin / soir, séries) et rendu des cartes.
   Tout reste sur le téléphone (localStorage). Exposé sur window.BeufaJeu. */
(() => {
  "use strict";

  /* ---------- les cartes à collectionner ----------
     Beufa + un chapeau (sur la tête de la brosse) + un objet + un fond.
     Les cartes rares se gagnent tous les 7 jours d'affilée. */
  const CARTES = [
    { id: "magicien",   nom: "Beufa Magicien",        pose: "pointe-du-doigt", chapeau: "🎩", objet: "🪄", deco: "✨", c1: "#7c4dff", c2: "#d1b3ff" },
    { id: "roi",        nom: "Roi Beufa",             pose: "mains-hanches",   chapeau: "👑", objet: "💎", deco: "✨", c1: "#f5a623", c2: "#ffe39a" },
    { id: "pirate",     nom: "Beufa le Pirate",       pose: "pointe-du-doigt", chapeau: "🏴‍☠️", objet: "🦜", deco: "🌊", c1: "#1e6091", c2: "#8fd3ff" },
    { id: "astronaute", nom: "Beufa Astronaute",      pose: "main-levee",      chapeau: "",   objet: "🚀", deco: "🪐", c1: "#1b1f5e", c2: "#5b6cff" },
    { id: "rockstar",   nom: "Beufa Rockstar",        pose: "main-levee",      chapeau: "🕶️", objet: "🎸", deco: "⚡", c1: "#e0457a", c2: "#ffb0c8" },
    { id: "foot",       nom: "Beufa Footballeur",     pose: "pouce",           chapeau: "🧢", objet: "⚽", deco: "🏆", c1: "#2e9d4f", c2: "#a6eab8" },
    { id: "dino",       nom: "Beufa et le Dino",      pose: "pensif",          chapeau: "",   objet: "🦖", deco: "🌋", c1: "#5a8f29", c2: "#cdeb8b" },
    { id: "licorne",    nom: "Beufa Licorne",         pose: "coeur",           chapeau: "🦄", objet: "🌈", deco: "💖", c1: "#ff7aa2", c2: "#c9b6ff" },
    { id: "cuisinier",  nom: "Chef Beufa",            pose: "mains-hanches",   chapeau: "",   objet: "🍕", deco: "🧁", c1: "#ff8c42", c2: "#ffd6a5" },
    { id: "pompier",    nom: "Beufa Pompier",         pose: "bras-croises",    chapeau: "⛑️", objet: "🚒", deco: "💧", c1: "#d62828", c2: "#ff9b9b" },
    { id: "plongeur",   nom: "Beufa Plongeur",        pose: "main-levee",      chapeau: "🤿", objet: "🐠", deco: "🐙", c1: "#0077b6", c2: "#90e0ef" },
    { id: "heros",      nom: "Super Beufa",           pose: "mains-hanches",   chapeau: "",   objet: "⚡", deco: "💥", c1: "#e63946", c2: "#ffd166" },
    { id: "explorateur",nom: "Beufa Explorateur",     pose: "pointe-du-doigt", chapeau: "👒", objet: "🧭", deco: "🗺️", c1: "#8d6e3f", c2: "#e9d5a7" },
    { id: "savant",     nom: "Professeur Beufa",      pose: "pensif",          chapeau: "🎓", objet: "📚", deco: "💡", c1: "#3a506b", c2: "#b8c7da" },
    { id: "musicien",   nom: "Beufa Musicien",        pose: "coeur",           chapeau: "",   objet: "🎺", deco: "🎵", c1: "#9d4edd", c2: "#e0aaff" },
    { id: "dragon",     nom: "Dompteur de Dragon",    pose: "bras-croises",    chapeau: "",   objet: "🐉", deco: "🔥", c1: "#bc3908", c2: "#ffb703" },
    { id: "neige",      nom: "Beufa des Neiges",      pose: "pouce",           chapeau: "🎅", objet: "⛄", deco: "❄️", c1: "#48cae4", c2: "#e0fbfc" },
    { id: "jardinier",  nom: "Beufa Jardinier",       pose: "coeur",           chapeau: "",   objet: "🌻", deco: "🐝", c1: "#4f772d", c2: "#d8f3a6" },
    // rares : 7 jours d'affilée
    { id: "or",         nom: "Beufa d'Or",            pose: "pouce",           chapeau: "👑", objet: "🏆", deco: "🌟", c1: "#b8860b", c2: "#fff1a8", rare: true },
    { id: "arcenciel",  nom: "Beufa Arc-en-ciel",     pose: "main-levee",      chapeau: "🌈", objet: "🦄", deco: "⭐", c1: "#ff5c8a", c2: "#7bdff2", rare: true },
    { id: "galaxie",    nom: "Beufa Galactique",      pose: "mains-hanches",   chapeau: "🪐", objet: "🌠", deco: "✨", c1: "#240046", c2: "#9d4edd", rare: true }
  ];
  const IMG = p => `assets/mascotte/png/pose-${p}.png`;

  /* ---------- journal ---------- */
  const CLE = "beufa-journal";
  function lire() {
    let j = null;
    try { j = JSON.parse(localStorage.getItem(CLE)); } catch (e) {}
    j = j && typeof j === "object" ? j : {};
    j.jours = j.jours || {}; j.cartes = j.cartes || {};
    j.microbes = j.microbes || 0; j.brossages = j.brossages || 0; j.record = j.record || 0;
    return j;
  }
  function ecrire(j) { try { localStorage.setItem(CLE, JSON.stringify(j)); } catch (e) {} }

  const cleJour = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const veille = d => { const x = new Date(d); x.setDate(x.getDate() - 1); return x; };
  const moment = (d = new Date()) => (d.getHours() >= 4 && d.getHours() < 15 ? "matin" : "soir");

  // nombre de jours d'affilée avec au moins un brossage (aujourd'hui compris, ou jusqu'à hier)
  function serie(j = lire(), auj = new Date()) {
    let d = j.jours[cleJour(auj)] ? auj : veille(auj), n = 0;
    while (j.jours[cleJour(d)]) { n++; d = veille(d); }
    return n;
  }
  // la série qu'on aura après le brossage en cours
  function serieApres(j = lire(), auj = new Date()) {
    return j.jours[cleJour(auj)] ? serie(j, auj) : (j.jours[cleJour(veille(auj))] ? serie(j, auj) : 0) + 1;
  }

  const hasard = t => t[Math.floor(Math.random() * t.length)];
  function choisirCarte(j = lire()) {
    const s = serieApres(j);
    const rare = s > 0 && s % 7 === 0;
    const lot = CARTES.filter(c => !!c.rare === rare);
    const neuves = lot.filter(c => !j.cartes[c.id]);
    return hasard(neuves.length ? neuves : lot);
  }

  // enregistre un brossage terminé ; renvoie ce qu'il y a à fêter
  function enregistrer({ carte, microbes }) {
    const j = lire(), auj = new Date(), k = cleJour(auj);
    const jour = j.jours[k] = j.jours[k] || {};
    jour[moment(auj)] = true;
    j.brossages++; j.microbes += microbes || 0;
    const nouvelle = !j.cartes[carte.id];
    j.cartes[carte.id] = (j.cartes[carte.id] || 0) + 1;
    const s = serie(j, auj);
    j.record = Math.max(j.record, s);
    ecrire(j);
    return { nouvelle, serie: s, exemplaires: j.cartes[carte.id], deuxFois: jour.matin && jour.soir };
  }

  /* ---------- rendu d'une carte ---------- */
  function carteEl(c, { cachee = false, compte = 0 } = {}) {
    const d = document.createElement("div");
    d.className = "carte-beufa" + (c.rare ? " rare" : "") + (cachee ? " cachee" : "");
    d.style.setProperty("--c1", c.c1); d.style.setProperty("--c2", c.c2);
    const fig = document.createElement("div"); fig.className = "beufa-fig";
    const im = new Image(); im.src = IMG(c.pose); im.alt = ""; fig.appendChild(im);
    if (c.chapeau && !cachee) { const h = document.createElement("span"); h.className = "chapeau"; h.textContent = c.chapeau; fig.appendChild(h); }
    d.appendChild(fig);
    if (!cachee) {
      const o = document.createElement("span"); o.className = "objet"; o.textContent = c.objet; d.appendChild(o);
      const e = document.createElement("span"); e.className = "deco"; e.textContent = c.deco; d.appendChild(e);
    }
    const n = document.createElement("div"); n.className = "carte-nom"; n.textContent = cachee ? "?" : c.nom; d.appendChild(n);
    if (c.rare) { const r = document.createElement("span"); r.className = "carte-rare"; r.textContent = "⭐ RARE"; d.appendChild(r); }
    if (compte > 1) { const x = document.createElement("span"); x.className = "carte-compte"; x.textContent = "×" + compte; d.appendChild(x); }
    d.setAttribute("role", "img"); d.setAttribute("aria-label", cachee ? "Carte pas encore gagnée" : c.nom);
    return d;
  }

  window.BeufaJeu = { CARTES, lire, serie, serieApres, choisirCarte, enregistrer, carteEl, cleJour, moment };
})();
