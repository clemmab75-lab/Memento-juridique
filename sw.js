/* Répertoire Juridique — service worker
   Rôle : rendre l'application disponible hors ligne.
   Changez VERSION à chaque mise à jour de index.html pour forcer le
   rafraîchissement du cache sur les appareils déjà installés.        */

const VERSION = "rj-2026-08-12";
const CACHE_APP = "app-" + VERSION;
const CACHE_POLICES = "polices-" + VERSION;

// Fichiers indispensables au fonctionnement hors ligne.
const COQUILLE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_APP)
      .then((c) => c.addAll(COQUILLE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(
        noms.filter((n) => n !== CACHE_APP && n !== CACHE_POLICES)
            .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "passer-a-la-suite") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Navigation : on sert l'application depuis le cache, réseau en secours.
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match("./index.html").then((rep) => rep || fetch(req))
    );
    return;
  }

  // Polices Google : cache d'abord, mise à jour en arrière-plan.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(CACHE_POLICES).then(async (c) => {
        const enCache = await c.match(req);
        const reseau = fetch(req)
          .then((rep) => { if (rep && rep.ok) c.put(req, rep.clone()); return rep; })
          .catch(() => null);
        return enCache || reseau || new Response("", { status: 504 });
      })
    );
    return;
  }

  // Même origine : cache d'abord, sinon réseau (et on mémorise).
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((rep) => rep || fetch(req).then((r) => {
        if (r && r.ok && r.type === "basic") {
          const copie = r.clone();
          caches.open(CACHE_APP).then((c) => c.put(req, copie));
        }
        return r;
      }).catch(() => caches.match("./index.html")))
    );
  }
});
