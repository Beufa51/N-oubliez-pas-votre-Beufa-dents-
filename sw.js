// Cache simple pour pouvoir utiliser l'appli hors ligne.
const VERSION = "beufa-v3";
const FICHIERS = [
  "./", "index.html", "css/style.css", "js/app.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png",
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
