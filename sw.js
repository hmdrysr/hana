/* Hana service worker.
   - Online: every file is fetched fresh. "no-cache" makes the browser ask the server
     whether a file changed (a quick 304 reply when it has not), so a new release shows on
     the next visit without clearing anything.
   - Offline: the last copy that was fetched is used.
   - Customer data (orders, basket, saved details) lives in the browser's local storage,
     which this worker never touches, so updates never remove it. */
"use strict";
const CACHE = "hana-shell";
const SHELL = ["./", "index.html", "core.js", "app.js", "business.html", "business.js", "rules.json", "site.json",
  "TERMS.md", "icon.svg", "icon-192.png", "manifest.webmanifest", "areas.json", "index.json",
  "theme/beer.min.css", "theme/theme.css", "theme/material-symbols-subset.woff2"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: "no-cache" }).then((r) => r.ok && c.put(u, r)).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  const fresh = req.mode === "navigate"
    ? fetch(url.href, { cache: "no-cache", credentials: "same-origin" })
    : fetch(req, { cache: "no-cache" });
  e.respondWith(fresh.then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req.mode === "navigate" ? url.pathname : req, copy));
    }
    return res;
  }).catch(() => caches.match(req.mode === "navigate" ? url.pathname : req)
    .then((hit) => hit || caches.match(req, { ignoreSearch: true }))
    .then((hit) => hit || caches.match("index.html"))));
});
