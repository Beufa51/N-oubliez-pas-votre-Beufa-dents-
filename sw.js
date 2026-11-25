// Copie hors ligne de l'appli.
// - Pages, scripts et styles : on prend TOUJOURS la dernière version en ligne quand il y a du réseau
//   (la copie ne sert qu'hors ligne) -> une mise en ligne se voit tout de suite.
// - Images, sons, police : copie locale d'abord (lourds et ils changent rarement).
// - Les fichiers sont toujours téléchargés en contournant le cache du navigateur ({ cache: "reload" }),
//   sinon une copie vieille de quelques minutes pourrait être gardée par erreur.
const VERSION = "beufa-v57";
// détection du brossage (~18 Mo) : gardée à part, téléchargée seulement au premier brossage avec caméra,
// et pas re-téléchargée à chaque nouvelle version de l'appli (changer ce nom si on change de modèle)
const VISION = "beufa-vision-1.2.2";
const FICHIERS = [
  "./", "index.html", "css/style.css", "js/jeu.js", "js/detection.js", "js/detection-worker.js", "js/incrustation.js", "js/incrustation-worker.js", "js/app.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "assets/fonts/fredoka.woff2", "assets/titre.webp",
  "assets/intro.mp3", "assets/fond.mp3",
  "assets/mascotte/png/pose-mains-hanches.png",
  "assets/mascotte/png/pose-pouce.png",
  "assets/mascotte/png/pose-coeur.png",
  "assets/mascotte/png/pose-main-levee.png",
  "assets/mascotte/png/pose-pensif.png",
  "assets/mascotte/png/pose-pointe-du-doigt.png",
  "assets/mascotte/png/pose-bras-croises.png",
  "assets/createur/high-five.webp", "assets/createur/check-poing.webp", "assets/createur/pouce.webp",
  "assets/createur/pointe.webp", "assets/createur/bras-croises.webp", "assets/createur/mains-hanches.webp",
  "assets/createur/pensif.webp", "assets/createur/cool.webp", "assets/createur/coeur.webp", "assets/createur/tada.webp"
];
const LOURD = /\.(png|jpe?g|webp|mp3|woff2)$/i;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(FICHIERS.map(u => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== VISION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (new URL(req.url).pathname.includes("/assets/vision/")) {
    e.respondWith(caches.open(VISION).then(c => c.match(req).then(r => r || fetch(req).then(rep => {
      if (rep.ok) c.put(req, rep.clone());
      return rep;
    }))));
    return;
  }
  if (new URL(req.url).pathname.includes("/assets/decors/")) {   // décors : gardés après le 1er affichage
    e.respondWith(caches.open(VERSION).then(c => c.match(req).then(r => r || fetch(req).then(rep => {
      if (rep.ok) c.put(req, rep.clone());
      return rep;
    }))));
    return;
  }
  if (LOURD.test(new URL(req.url).pathname)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }
  // réseau d'abord (sans cache du navigateur), copie locale si hors ligne
  e.respondWith(
    fetch(req, { cache: "no-cache" })
      .then(r => {
        if (r.ok) { const copie = r.clone(); caches.open(VERSION).then(c => c.put(req, copie)); }
        return r;
      })
      .catch(() => caches.match(req).then(r => r || caches.match("index.html")))
  );
});
