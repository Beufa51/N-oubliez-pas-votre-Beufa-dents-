// Cache simple pour pouvoir utiliser l'appli hors ligne.
const VERSION = "beufa-v16";
const FICHIERS = [
  "./", "index.html", "css/style.css", "js/jeu.js", "js/app.js", "manifest.webmanifest",
  "icons/icon-192.png", "assets/fonts/fredoka.woff2", "assets/titre.webp", "assets/intro.mp3", "icons/icon-512.png",
  "assets/mascotte/png/pose-mains-hanches.png",
  "assets/mascotte/png/pose-pouce.png",
  "assets/mascotte/png/pose-coeur.png",
  "assets/mascotte/png/pose-main-levee.png",
  "assets/mascotte/png/pose-pensif.png",
  "assets/mascotte/png/pose-pointe-du-doigt.png",
  "assets/mascotte/png/pose-bras-croises.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
