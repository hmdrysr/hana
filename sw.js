/* Hana service worker. Built for slow mobile connections:
   - App files (code, styles, icons) are served at once from this phone. They change only
     with a release: tools/build.py stamps VERSION below from the files themselves, so a new
     release installs a new set in the background and is used from the next visit, all files
     together. No round trip is needed to open Hana.
   - Data (the directory, menus, zones, rules) comes from the network, so prices are current;
     after 2.5 seconds on a slow connection, or offline, the last copy is used while the fresh
     one keeps loading for next time.
   - Customers download only the customer app. The business tools are saved the first time
     they are opened.
   - Customer data (orders, basket, saved details) lives in the browser's local storage,
     which this worker never touches, so updates never remove it. */
"use strict";
const VERSION = "8dbf9c86f0d6";
const CODE_CACHE = "hana-code-" + VERSION, DATA_CACHE = "hana-data";
/* Saved at install: what a customer needs to open Hana, even offline. */
const SHELL = ["./", "index.html", "core.js", "direct.js", "app.js", "logo.svg", "icon.svg", "favicon-32.png", "apple-touch-icon.png", "icons/food.svg", "icon-192.png", "manifest.webmanifest",
  "theme/beer.min.css", "theme/theme.css", "theme/material-symbols-subset.woff2"];
/* Also app files (served from this phone once saved), but saved only when first used. */
const LATER = ["business.html", "business.js", "pos.js", "vault.js", "vault-words.txt", "phonebook.js", "myplaces.js", "i18n/bn.json"];
const DATA = ["list.json", "areas.json", "rules.json", "site.json"];
const CODE = new Set(SHELL.concat(LATER).map((u) => new URL(u, self.location).pathname));
const DATA_PATHS = new Set(DATA.map((u) => new URL(u, self.location).pathname));

self.addEventListener("install", (e) => {
  e.waitUntil(Promise.all([
    caches.open(CODE_CACHE).then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: "no-cache" }).then((r) => r.ok && c.put(u, r)).catch(() => null)))),
    caches.open(DATA_CACHE).then((c) => Promise.all(DATA.map((u) => fetch(u, { cache: "no-cache" }).then((r) => r.ok && c.put(new URL(u, self.location).pathname, r)).catch(() => null)))),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CODE_CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* A page address ("/hana/", "/hana/index.html") is the app file it opens. */
function codeKey(url, req) {
  if (req.mode === "navigate") {
    const p = url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname;
    return CODE.has(p) ? p : null;
  }
  return CODE.has(url.pathname) ? url.pathname : null;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  /* "?fresh=" asks for the network only (the app's check after a menu does not match). */
  if (url.searchParams.has("fresh")) return;
  const key = codeKey(url, req);
  if (key) {
    /* App file: from this phone at once; from the network only the first time. */
    e.respondWith(caches.open(CODE_CACHE).then((c) => c.match(key).then((hit) => hit || fetch(req.mode === "navigate" ? key : req, { cache: "no-cache" }).then((res) => {
      if (res.ok) c.put(key, res.clone());
      return res;
    }).catch(() => caches.match(key).then((any) => any || Response.error())))));
    return;
  }
  /* The directory itself (list, zones, rules, site settings): the saved copy at once, so the
     front page opens without waiting, and a fresh copy in the background for next time. The app
     checks every menu against the directory's hash and fetches the directory afresh if a newer
     menu does not match, so a saved directory can never make it trust a wrong menu. */
  if (DATA_PATHS.has(url.pathname) && !url.search) {
    const fresh = fetch(req, { cache: "no-cache" }).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(DATA_CACHE).then((c) => c.put(url.pathname, copy)); } return res; });
    e.waitUntil(fresh.catch(() => null));
    e.respondWith(caches.match(url.pathname).then((hit) => hit || fresh).catch(() => fresh));
    return;
  }
  /* Other data and generated pages: fresh from the network; the saved copy after 2.5 seconds or offline. */
  const dkey = req.mode === "navigate" ? url.pathname : req;
  const saved = () => caches.match(dkey).then((hit) => hit || caches.match(req, { ignoreSearch: true }))
    .then((hit) => hit || (req.mode === "navigate" ? caches.match(new URL("index.html", self.location).pathname) : undefined));
  const fresh = (req.mode === "navigate" ? fetch(url.href, { cache: "no-cache", credentials: "same-origin" }) : fetch(req, { cache: "no-cache" }))
    .then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(DATA_CACHE).then((c) => c.put(dkey, copy)); }
      return res;
    });
  e.waitUntil(fresh.catch(() => null));
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done && r) { done = true; resolve(r); } };
    const timer = setTimeout(() => saved().then(finish), 2500);
    fresh.then((r) => { clearTimeout(timer); finish(r); })
      .catch(() => { clearTimeout(timer); saved().then((r) => { finish(r); if (!done) { done = true; resolve(Response.error()); } }); });
  }));
});

/* Alerts for businesses while their tools are closed (pushed by ntfy; the order itself stays
   encrypted and is opened in the business tools). */
/* Customers' order topics start with "hana-o-"; the update itself stays encrypted and is read
   in the app. */
self.addEventListener("push", (e) => {
  let topic = "";
  try { const d = e.data.json(); topic = (d.message && d.message.topic) || d.topic || ""; } catch (x) { /* no details */ }
  const customer = topic.startsWith("hana-o-");
  e.waitUntil(self.registration.showNotification(customer ? "Update on your Hana order" : "New Hana order", {
    body: customer ? "Open Hana to see it." : "Open the business tools to confirm it within 15 minutes.",
    icon: "icon-192.png", badge: "favicon-32.png", tag: customer ? "hana-update" : "hana-order", renotify: true, data: { customer } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const customer = e.notification.data && e.notification.data.customer;
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((list) => {
    const open = list.find((c) => customer ? c.url.includes("index.html") || !c.url.includes("business.html") : c.url.includes("business.html"));
    return open ? open.focus() : self.clients.openWindow(customer ? "index.html#/orders" : "business.html#/confirm");
  }));
});
