/* Hana service worker: lets the app open with no network after the first visit.
   Everything is read from the network first, so price changes show up as soon as
   there is a connection; the saved copy is used only when offline. */
"use strict";
const CACHE = "hana-v2";
const SHELL = ["./", "index.html", "app.js", "site.json", "icon.svg", "manifest.webmanifest",
  "theme/beer.min.css", "theme/theme.css", "theme/material-symbols-subset.woff2", "icon-192.png", "areas.json", "index.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match("index.html"))));
});
