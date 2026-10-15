/* Hana customer app. Needs core.js. The customer's details stay on this phone. See SPEC.md. */
"use strict";

/* ---------------------------------------------------------------- data */

const state = {
  site: { repo_url: "", company_url: "https://hamidyasir.com" },
  areas: [],
  areaById: new Map(),
  restaurants: [],
  loaded: false,
  loadError: "",
  rules: { max_delivery_fee: 150, payment_methods_on_delivery: { cash: "Cash" }, draft_order_expiry_hours: 24, confirmation_window_minutes: 15, record_retention_months: 6, record_retention_months_when_disputed: 12 },
  area: store.get("hana.area", ""),
  showAll: false,
  query: "",
  cat: "",
  searching: false,
  allDishes: false,
  moreCats: false,
  tab: "all",
  page: 0,
  basket: store.get("hana.basket", null),
};

async function loadAll() {
  try {
    /* All four files load at once rather than one after another. */
    const [site, rules, areas, list] = await Promise.all([
      fetchJson("site.json").catch(() => ({})), fetchJson("rules.json").catch(() => ({})), fetchJson("areas.json"), fetchJson("list.json")]);
    Object.assign(state.site, site);
    fetch(dataUrl("peers.json"), { cache: "no-cache" }).then((r) => r.ok ? r.json() : null).then((p) => {
      if (p) store.set("hana.peers", (p.peers || []).map((x) => (typeof x === "string" ? x : x.url)).filter((u) => /^https:\/\/.+\/$/.test(u || "")).slice(0, 10));
    }).catch(() => {});
    Object.assign(state.rules, rules);
    if (SNAP) Object.assign(state.site, SNAP.site);
    if (Array.isArray(state.rules.image_hosts)) IMAGE_HOSTS = state.rules.image_hosts.slice();
    state.areas = areas.areas || [];
    state.areaById = new Map(state.areas.map((a) => [a.id, a]));
    const a = state.areaById.get(state.area);
    if (state.area && (!a || a.kind !== "zone")) { state.area = ""; store.set("hana.area", ""); }
    /* One small summary file for the whole directory. Full menus load only when needed. */
    state.restaurants = (list.listings || []).map((L) => ({ id: L.id, name: L.name, lite: L, cats: new Set(L.cats || []), hash: L.menu_hash, menu: null, raw: null, problem: "" }));
    state.restaurants.sort((a, b) => norm(a.name).localeCompare(norm(b.name), "en"));
    state.loaded = true;
  } catch (e) {
    state.loadError = "The directory could not be loaded. " + e.message;
  }
}

function restaurantById(id) { return state.restaurants.find((r) => r.id === id); }

/* Loads one listing's full menu, checks it against the directory's hash and refuses a
   version older than one this phone has already seen. Returns the menu, or null. */
async function ensureMenu(r) {
  if (!r || r.menu) return r ? r.menu : null;
  if (r.loading) return r.loading;
  r.loading = (async () => {
    try {
      const bytes = await fetchBytes(r.lite.location);
      const hash = await sha256Hex(bytes);
      if (hash !== r.lite.menu_hash) { r.problem = "The menu file does not match the directory record, so it is not trusted."; return null; }
      const text = new TextDecoder("utf-8").decode(bytes);
      const menu = JSON.parse(text);
      const seen = store.get("hana.seen", {});
      if (seen[r.id] && menu.version < seen[r.id]) { r.problem = "This menu is older than one this phone has already seen (version " + menu.version + " after version " + seen[r.id] + "), so it is not trusted."; return null; }
      seen[r.id] = Math.max(seen[r.id] || 0, menu.version);
      store.set("hana.seen", seen);
      Object.assign(r, { menu, raw: text, hash, problem: "" });
      return menu;
    } catch (e) { r.problem = "The menu could not be loaded. Check your connection and try again."; return null; }
    finally { r.loading = null; }
  })();
  return r.loading;
}
function ensureMenus(list) { return Promise.all(list.map(ensureMenu)); }

/* Item names and prices for dish search, loaded the first time someone searches. */
async function ensureSearch() {
  if (state.search) return state.search;
  if (!state.searchLoading) state.searchLoading = fetchJson("search.json").then((d) => (state.search = d.items || {})).catch(() => (state.search = {}));
  return state.searchLoading;
}
function searchItems(r) {
  return ((state.search || {})[r.id] || []).map(([name, section, category, price, options]) => ({ name, section, category, price: options ? undefined : price, options: options ? [{ price }] : undefined }));
}

/* The selected area and every area it belongs to (ward, then Station, then the city). */
function areaChain(areaId) {
  const out = new Set();
  const walk = (id) => {
    if (!id || out.has(id)) return;
    out.add(id);
    const a = state.areaById.get(id);
    for (const p of (a && a.part_of) || []) walk(p);
  };
  walk(areaId);
  return out;
}

function zoneFor(menu, areaId) {
  if (!areaId) return null;
  const chain = areaChain(areaId);
  for (const z of (menu.delivery && menu.delivery.zones) || []) {
    if (z.shape === "named" && (z.areas || []).some((a) => chain.has(a))) return z;
  }
  return null;
}

function areaName(id) { const a = state.areaById.get(id); return a ? a.name : id; }
function zoneLabel(z) { return z.shape === "named" ? (z.areas || []).map(areaName).join(", ") : (z.name || z.id); }
function onlyZone(menu) { const z = (menu.delivery && menu.delivery.zones) || []; return z.length === 1 ? z[0] : null; }

function toMin(hhmm) { const p = hhmm.split(":"); return Number(p[0]) * 60 + Number(p[1]); }

/* Open now, from the phone's clock. An end earlier than the start means the business closes after midnight. */
function openNow(hours, when) {
  if (!hours) return null;
  const now = when || new Date();
  const idx = (now.getDay() + 6) % 7;
  const mins = now.getHours() * 60 + now.getMinutes();
  for (const [s, e] of hours[DAYS[idx]] || []) {
    const a = toMin(s), b = toMin(e);
    if (b > a ? (mins >= a && mins < b) : mins >= a) return true;
  }
  for (const [s, e] of hours[DAYS[(idx + 6) % 7]] || []) {
    const a = toMin(s), b = toMin(e);
    if (b < a && mins < b) return true;
  }
  return false;
}

/* ---------------------------------------------------------------- shared interface pieces */

const main = document.getElementById("main");
function setActiveNav(name) {
  for (const a of document.querySelectorAll("[data-nav]")) {
    const on = a.getAttribute("data-nav") === name;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
}

function show(navName, title, ...nodes) {
  setActiveNav(navName);
  main.replaceChildren(...nodes);
  window.scrollTo(0, 0);
  document.title = title ? title + " | Hana" : "Hana: food and groceries in Chittagong";
}

function statusChip(menu) {
  const o = openNow(menu.hours);
  if (o === null) return chip("Hours not stated");
  /* Volunteer-entered hours may be out of date, so they say so. */
  const unsure = menu.claimed === false && menu.demo !== true ? " (hours not confirmed)" : "";
  return o ? chip("Open now" + unsure, "ok") : chip("Closed now" + unsure);
}

/* Estimated minutes from ordering to arrival: the business's own delivery time for the zone,
   plus the confirmation window it is allowed before it starts. */
function arrivalMinutes(z, rid) { return z && z.eta_min !== null && z.eta_min !== undefined ? Number(z.eta_min) + (Number(state.rules.confirmation_window_minutes) || 15) + liveOf(rid).busy : null; }
/* Today's details a business shares with its presence signal (SPEC.md, section 21). */
function liveOf(rid) { return (state.live && state.live[rid]) || { sold: [], busy: 0, pickup_only: false }; }
function clockAt(d) { return clock(String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0")); }

/* One or two plain sentences, for example "Delivery fee BDT 60, minimum order BDT 300, about
   40 minutes." or "The delivery fee, minimum order and delivery time are not stated." */
function feeSummary(z) {
  if (!z) return "Choose your zone to see the delivery fee.";
  const given = (v) => v !== null && v !== undefined;
  const known = [], unknown = [];
  if (given(z.fee)) known.push("Delivery fee " + money(z.fee)); else unknown.push("delivery fee");
  if (given(z.min_order)) known.push((known.length ? "minimum order " : "Minimum order ") + (z.min_order ? money(z.min_order) : "none")); else unknown.push("minimum order");
  if (given(z.eta_min)) known.push((known.length ? "arrives in about " : "Arrives in about ") + arrivalMinutes(z) + " minutes"); else unknown.push("delivery time");
  const list = unknown.length > 1 ? unknown.slice(0, -1).join(", ") + " and " + unknown[unknown.length - 1] : unknown[0];
  return [known.length ? known.join(", ") + "." : "", unknown.length ? "The " + list + (unknown.length > 1 ? " are" : " is") + " not stated." : ""].filter(Boolean).join(" ");
}

function zones() { return state.areas.filter((a) => a.kind === "zone").sort((a, b) => a.name.localeCompare(b.name, "en")); }
function wardsIn(zoneId) { return state.areas.filter((a) => a.kind === "ward" && (a.part_of || []).includes(zoneId)).sort((a, b) => a.number - b.number); }

/* Customers choose a zone (thana). The whole city is a delivery area for businesses, not a customer choice. */
function zoneSelect(id, value, onChange, firstLabel, label) {
  return selectField(id, label || "Your zone (thana)",
    h("select", { id, on: { change: (e) => onChange(e.target.value) } },
      h("option", { value: "" }, firstLabel),
      zones().map((a) => h("option", { value: a.id, selected: a.id === value }, a.name))));
}

function wardSelect(id, zoneId, value, onChange) {
  const ws = wardsIn(zoneId);
  return selectField(id, "Ward (optional)",
    h("select", { id, disabled: !ws.length, on: { change: (e) => onChange(e.target.value) } },
      h("option", { value: "" }, ws.length ? "Not specified" : "No wards listed for this zone"),
      ws.map((a) => h("option", { value: a.id, selected: a.id === value }, a.name))));
}

function locatedIn(m) {
  const a = state.areaById.get(m.neighbourhood);
  return a && a.kind === "zone" ? a.name : "Zone not stated";
}

/* ---------------------------------------------------------------- views */

/* Which listings a tab shows. */
const KIND_TABS = [["all", "All"], ["food", "Restaurants"], ["grocery", "Groceries"]];
function inTab(m) { return state.tab === "all" || !m || (state.tab === "grocery") === isGrocery(m); }

/* Categories that at least one listing in the current tab offers, with how many listings offer each. */
function availableCategories() {
  const count = {};
  for (const r of state.restaurants) {
    if (!inTab(r.lite)) continue;
    for (const k of r.cats) count[k] = (count[k] || 0) + 1;
  }
  const list = state.tab === "grocery" ? GROCERY : state.tab === "food" ? FOOD : FOOD.concat(GROCERY.filter((g) => !FOOD.some((f) => f[0] === g[0])));
  return list.filter((f) => count[f[0]]).map((f) => ({ key: f[0], label: f[1], count: count[f[0]] }));
}

/* Finds the customer's zone from their position: the browser gives the position, and
   OpenStreetMap's free Nominatim service (no key, no account) names the area. The position is
   rounded to about 100 metres before it is sent. Runs only when the customer asks. */
async function locateZone(onFound) {
  if (!navigator.geolocation) { snackbar("This browser cannot share your location. Choose your zone from the list."); return; }
  snackbar("Finding your zone…");
  const pos = await new Promise((res) => navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 15000, maximumAge: 600000 }));
  if (!pos) { snackbar("Your location was not shared. Choose your zone from the list."); return; }
  const zone = await zoneAt(pos.coords.latitude, pos.coords.longitude);
  if (zone === undefined) { snackbar("Your zone could not be looked up just now. Choose it from the list."); return; }
  if (!zone) { snackbar("Your location could not be matched to a zone. Choose it from the list."); return; }
  onFound(zone.id);
  snackbar("Zone set to " + zone.name + ". You can change it at any time.");
}
/* The zone at a position: the zone, null (no match) or undefined (lookup unavailable). */
async function zoneAt(latitude, longitude) {
  const lat = Number(latitude).toFixed(3), lon = Number(longitude).toFixed(3);
  let addr = null;
  try {
    const r = await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1&accept-language=en&lat=" + lat + "&lon=" + lon);
    addr = (await r.json()).address || null;
  } catch (e) { /* offline or unavailable */ }
  if (!addr) return undefined;
  const words = Object.values(addr).map((v) => norm(String(v)).replace(/\b(thana|police station|ward no|ward)\b/g, "").trim()).filter(Boolean);
  const named = (name) => { const n = norm(name).replace(/\(.*\)/, "").trim(); return words.some((w) => w === n || w.includes(n) || (w.length > 4 && n.includes(w))); };
  let zone = zones().find((z) => named(z.name));
  if (!zone) {
    const ward = state.areas.find((a) => a.kind === "ward" && named(a.name.replace(/^Ward \d+,\s*/, "")));
    if (ward) zone = state.areaById.get((ward.part_of || [])[0]);
  }
  return zone && zone.kind === "zone" ? zone : null;
}

function viewList() {
  const results = h("div", { id: "results", class: "stack", "aria-live": "polite" });
  const strip = h("nav", { class: "cat-strip", "aria-label": "Categories" });
  const catHead = sectionTitle("Categories");
  const listHead = h("div", { class: "stack" });
  const tabs = h("nav", { class: "kind-tabs", "aria-label": "Type of business" });
  const search = h("input", {
    type: "search", id: "q", placeholder: "Search Hana", autocomplete: "off", value: state.query,
    "aria-label": "Search food, groceries or places",
    on: {
      input: (e) => { state.query = e.target.value; state.page = 0; state.allDishes = false; render(); },
      focus: () => { state.searching = true; render(); },
      blur: () => setTimeout(() => { state.searching = false; render(); }, 200),
      keydown: (e) => { if (e.key === "Escape") { search.value = state.query = ""; search.blur(); } },
    },
  });
  const showAll = h("input", { type: "checkbox", id: "showall", checked: state.showAll, on: { change: (e) => { state.showAll = e.target.checked; render(); } } });
  const setZone = (v) => { state.area = v; state.page = 0; store.set("hana.area", v); const sel = document.getElementById("area"); if (sel) sel.value = v; render(); };

  const pickCategory = (key) => {
    state.cat = state.cat === key ? "" : key;
    state.query = search.value = "";
    state.page = 0;
    state.searching = false;
    search.blur();
    render();
  };
  const catRows = (list) => h("ul", { class: "list cat-list" }, list.map((c) => h("li", null,
    h("a", { href: "#/", class: "row max", on: { pointerdown: (e) => e.preventDefault(), click: (e) => { e.preventDefault(); pickCategory(c.key); } } },
      foodIcon(c.key, "large"), h("span", { class: "max" }, c.label),
      h("span", { class: "small-text muted" }, c.count + (c.count === 1 ? " place" : " places"))))));

  if (state.openOnly === undefined) Object.assign(state, store.get("hana.filters", { openOnly: false, favOnly: false }));
  function render() {
    const cats = availableCategories();
    if (state.cat && !cats.some((c) => c.key === state.cat)) state.cat = "";
    tabs.replaceChildren(...KIND_TABS.map(([k, label]) => h("button", { type: "button", "aria-pressed": state.tab === k ? "true" : "false",
      on: { click: () => { state.tab = k; state.cat = ""; state.page = 0; state.moreCats = false; render(); } } }, label)));
    const q = norm(state.query);
    strip.hidden = catHead.hidden = !!(q || state.searching) || !cats.length;
    const FEW = 7;
    const visible = state.moreCats || cats.length <= FEW ? cats : cats.slice(0, FEW).concat(cats.filter((c, i) => i >= FEW && c.key === state.cat));
    strip.replaceChildren(...visible.map((c) => h("button", {
      type: "button", class: "cat-tile", "aria-pressed": state.cat === c.key ? "true" : "false",
      on: { click: () => pickCategory(c.key) } }, foodIcon(c.key, "large"), h("span", null, c.label))),
      visible.length < cats.length ? h("button", { type: "button", class: "cat-tile", on: { click: () => { state.moreCats = true; render(); } } }, foodIcon("plate", "large"), h("span", null, "More")) : null);

    if (!q && state.searching) {
      listHead.replaceChildren();
      results.replaceChildren(sectionTitle("Top categories"), cats.length ? catRows(cats) : h("p", { class: "muted" }, "No categories yet."));
      return;
    }
    const kids = [];
    if (q) {
      const matchCats = cats.filter((c) => fuzzyMatches(state.query, c.label));
      if (matchCats.length) kids.push(sectionTitle("Categories"), catRows(matchCats));
    }
    const cards = [], dishes = [];
    let hidden = 0;
    if ((q || state.cat) && !state.search) { ensureSearch().then(render); }
    for (const r of state.restaurants) {
      const m = r.lite;
      if (!inTab(m)) continue;
      const zone = m ? zoneFor(m, state.area) : null;
      const delivers = !state.area || !m || !!zone;
      if (!delivers && !state.showAll) { hidden++; continue; }
      if (state.cat && !(r.cats && r.cats.has(state.cat))) continue;
      if (state.favOnly && !favourites().includes(r.id)) continue;
      if (state.openOnly && m && openNow(m.hours) === false) continue;
      const nameHit = fuzzyMatches(state.query.replace(/^@/, ""), r.name + " " + (m ? (m.kind || "") + " " + (m.handle || "") : ""));
      const hits = q ? searchItems(r).filter((it) => fuzzyMatches(state.query, it.name + " " + (it.category || "") + " " + (it.section || ""))) : [];
      if (q && !nameHit && !hits.length) continue;
      /* While searching, a place appears under Places only when its own name matches; places
         that sell a matching item are listed under the item instead. */
      if (!q || nameHit) cards.push([r, zone, delivers]);
      for (const it of hits) dishes.push({ r, it });
    }

    const label = state.tab === "grocery" ? "Grocery stores" : state.tab === "food" ? "Restaurants" : "All places";
    const head = q ? [] : [sectionTitle(label + " (" + cards.length + ")")];
    if (!q) head.push(h("p", { class: "small-text muted flush" }, "Listed alphabetically. No listing is featured or paid for."));
    if (state.cat) {
      head.push(h("nav", { class: "wrap small-space" }, h("button", { type: "button", class: "chip small", "aria-label": "Clear the category filter",
        on: { click: () => pickCategory(state.cat) } }, foodIcon(state.cat), h("span", null, FOOD_BY_KEY[state.cat][1]), icon("close"))));
    }
    if (state.area && (hidden || state.showAll)) {
      head.push(h("div", { class: "row" }, h("label", { class: "switch" }, showAll, h("span")),
        h("label", { for: "showall", class: "max small-text" }, "Also show places that do not deliver to " + areaName(state.area) + (hidden ? " (" + hidden + " hidden)" : ""))));
    }
    const toggle = (key, text) => h("button", { type: "button", class: "chip small" + (state[key] ? "" : " border"), "aria-pressed": String(!!state[key]),
      on: { click: () => { state[key] = !state[key]; store.set("hana.filters", { openOnly: state.openOnly, favOnly: state.favOnly }); state.page = 0; render(); } } }, h("span", null, text));
    head.push(h("nav", { class: "wrap small-space" }, toggle("openOnly", "Open now"), favourites().length || state.favOnly ? toggle("favOnly", "Favourites") : null));
    listHead.replaceChildren(...(q && !cards.length ? [] : head));

    const PER = 12;
    const pages = Math.max(1, Math.ceil(cards.length / PER));
    if (state.page >= pages) state.page = pages - 1;
    /* Cards are built only for the page on screen. */
    if (q && dishes.length) {
      /* What is available where: one line per place with its first matching item, then every
         match in every place on request. Places stay in alphabetical order. */
      const by = new Map();
      for (const d of dishes) { if (!by.has(d.r)) by.set(d.r, []); by.get(d.r).push(d.it); }
      const word = state.tab === "grocery" ? "Products" : "Dishes";
      /* Tapping an item opens the place at that item. */
      const open = (r, it) => { state.focusItem = it.name; location.hash = "#/r/" + r.id; };
      const row = (r, it, extra) => h("li", null, foodIcon(itemCat(it, r.lite) || "plate", "large"),
        h("a", { href: "#/r/" + r.id, class: "max dish-hit", on: { click: (e) => { e.preventDefault(); open(r, it); } } },
          h("div", null, it.name), h("div", { class: "small-text muted" }, r.name + (extra ? " · " + extra : ""))),
        h("span", { class: "price" }, fromPrice(it)));
      const list = state.allDishes
        ? Array.from(by, ([r, its]) => [h("li", null, h("div", { class: "max bold" }, r.name)), ...its.map((it) => row(r, it))]).flat()
        : Array.from(by, ([r, its]) => row(r, its[0], its.length > 1 ? its.length - 1 + " more" : ""));
      kids.push(sectionTitle(word + " (" + dishes.length + " at " + by.size + (by.size === 1 ? " place)" : " places)")), h("ul", { class: "list border" }, list));
      if (dishes.length > by.size || state.allDishes) kids.push(h("nav", null, h("button", { type: "button", class: "border", on: { click: () => { state.allDishes = !state.allDishes; render(); } } },
        h("span", null, state.allDishes ? "Show one per place" : "Show every match (" + dishes.length + ")"))));
    }
    if (q && cards.length) kids.push(sectionTitle("Places"));
    kids.push(...cards.slice(state.page * PER, state.page * PER + PER).map(([r, zone, delivers]) =>
      restaurantCard(r, zone, delivers, !q && state.cat ? searchItems(r).filter((it) => itemCat(it, r.lite) === state.cat) : [])));
    if (pages > 1) kids.push(pager(state.page, pages, (n) => { state.page = n; render(); listHead.scrollIntoView({ block: "start" }); }));
    if (!cards.length && !dishes.length) {
      kids.push(h("p", { class: "muted" }, state.tab === "grocery" && !state.restaurants.some((r) => isGrocery(r.lite))
        ? "No grocery stores are listed yet. A store can be added from About, under For businesses."
        : "Nothing matches. Try a shorter search, another category or another zone."));
    }
    results.replaceChildren(...kids);
  }

  show("list", "",
    pageTitle("Food and groceries in Chittagong"),
    installCard(true),
    h("div", { class: "zone-row" },
      zoneSelect("area", state.area, setZone, "Choose your zone"),
      h("button", { type: "button", class: "border", on: { click: () => locateZone(setZone) } }, icon("location_on"), h("span", null, "Use my location"))),
    h("div", { class: "field prefix round fill has-clear" }, icon("search"), search, clearButton(search)),
    tabs,
    catHead,
    strip,
    listHead,
    results);
  render();
}

/* Page navigation for long lists: previous, "Page 2 of 5", next. */
function pager(page, pages, go) {
  return h("nav", { class: "wrap gap-top", "aria-label": "Pages" },
    h("button", { type: "button", class: "border", disabled: page === 0, on: { click: () => go(page - 1) } }, icon("arrow_back"), h("span", null, "Previous")),
    h("span", { class: "max center-align" }, "Page " + (page + 1) + " of " + pages),
    h("button", { type: "button", class: "border", disabled: page >= pages - 1, on: { click: () => go(page + 1) } }, h("span", null, "Next")));
}

/* Ordering state for a business right now: open, closed with scheduled orders, or closed. */
function orderingState(m) {
  const open = openNow(m.hours);
  if (open !== false) return { canOrder: true, closed: false };
  const next = nextOpening(m.hours);
  return { canOrder: m.scheduled_orders === true && !!next, closed: true, next };
}
/* Times a scheduled order can be placed for: every 30 minutes while open, over the next two days. */
function scheduleSlots(m) {
  if (m.scheduled_orders !== true || !m.hours) return [];
  const out = [];
  const now = Date.now() + 30 * 60000;
  const base = new Date();
  for (let d = 0; d < 3 && out.length < 48; d++) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d);
    for (const [s, e] of m.hours[DAYS[(day.getDay() + 6) % 7]] || []) {
      let a = hhmmToMin(s), b = hhmmToMin(e);
      if (b <= a) b += 24 * 60;
      for (let t = Math.ceil(a / 30) * 30; t < b && out.length < 48; t += 30) {
        const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, t);
        if (when.getTime() < now) continue;
        const iso = when.getFullYear() + "-" + String(when.getMonth() + 1).padStart(2, "0") + "-" + String(when.getDate()).padStart(2, "0") + "T" + String(when.getHours()).padStart(2, "0") + ":" + String(when.getMinutes()).padStart(2, "0");
        out.push({ value: iso, label: whenText(when) + ", " + longDate(iso) });
      }
    }
  }
  return out;
}
function whenText(d) { return DAY_NAMES[DAYS[(d.getDay() + 6) % 7]] + ", " + clock(String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0")); }

function fromPrice(it) {
  if (!it.options) return priceOrAsk(it.price);
  const known = it.options.map((o) => o.price).filter((p) => p !== null && p !== undefined);
  return known.length ? "from " + money(Math.min(...known)) : NO_PRICE;
}

function restaurantCard(r, zone, delivers, dishHits) {
  const m = r.lite;
  if (!m) {
    return h("article", { class: "round border no-elevate" }, h("h2", { class: "card-title" }, r.name), h("p", { class: "muted" }, r.problem || "This menu is not available."));
  }
  const chips = [statusChip(m)];
  if (m.demo === true) chips.push(chip("Demo, just for fun: not a real place", "warn"));
  else if (m.claimed === false) chips.push(chip("Not confirmed by the business", "warn"));
  if (!delivers) chips.push(chip("Does not deliver to " + areaName(state.area), "warn"));
  const body = [
    h("h2", { class: "card-title" }, h("a", { href: "#/r/" + r.id }, r.name)),
    h("div", { class: "small-text muted" }, (m.kind || "Restaurant") + " · " + locatedIn(m)),
    h("nav", { class: "wrap small-space" }, chips),
  ];
  if (delivers) body.push(h("p", { class: "small-text muted flush" }, feeSummary(zone || onlyZone(m))));
  if (dishHits.length) {
    body.push(h("ul", { class: "list" }, dishHits.slice(0, 5).map((it) => h("li", null,
      h("a", { href: "#/r/" + r.id, class: "max" }, it.name), h("span", { class: "price" }, fromPrice(it))))));
    if (dishHits.length > 5) body.push(h("p", { class: "small-text muted flush" }, (dishHits.length - 5) + " more on the restaurant page"));
  }
  return h("article", { class: "round border no-elevate rcard" },
    h("a", { href: "#/r/" + r.id, tabindex: "-1", "aria-hidden": "true" }, picture(coverFor(m), "cover", "", cuisineKey(m))),
    h("div", { class: "rcard-body" }, body));
}

/* Lets the customer pick a size or option, as food delivery apps do, instead of listing
   every option on the menu page. */
function chooseOption(r, it) {
  const d = h("dialog", { "aria-label": it.name },
    h("h5", null, it.name),
    it.description ? h("p", { class: "small-text muted" }, it.description) : null,
    h("ul", { class: "list border" }, it.options.map((op) => h("li", null,
      h("div", { class: "max" }, op.label), h("span", { class: "price" }, priceOrAsk(op.price)),
      h("button", { type: "button", class: "circle", "aria-label": "Add " + it.name + ", " + op.label + ", " + priceOrAsk(op.price),
        on: { click: () => { d.close(); addToBasket(r, it.id + "." + op.id, it.name + " (" + op.label + ")"); } } }, icon("add"))))),
    h("nav", { class: "right-align" }, h("button", { type: "button", class: "border", on: { click: () => d.close() } }, "Cancel")));
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  if (d.showModal) d.showModal(); else d.setAttribute("open", "");
}

/* Before adding from a closed business: say when it opens and, if it takes scheduled
   orders, let the customer choose a time while it is open. Resolves true to go ahead. */
function readyToOrder(r) {
  const m = r.menu, os = orderingState(m);
  if (state.offline && state.offline.has(r.id)) {
    return ask(m.name + " is temporarily unavailable", "Its staff are busy and are not taking new orders at the moment. Please check back shortly.", "OK").then(() => false);
  }
  if (!os.closed) return Promise.resolve(true);
  if (state.basket && state.basket.rid === r.id && state.basket.scheduled) return Promise.resolve(true);
  const slots = scheduleSlots(m);
  return new Promise((resolve) => {
    const when = h("select", { id: "closed-when" }, slots.map((x) => h("option", { value: x.value }, x.label)));
    const done = (v) => { d.close(); resolve(v); };
    const d = h("dialog", { "aria-labelledby": "closed-title" },
      h("h5", { id: "closed-title" }, m.name + " is closed now"),
      h("p", null, os.next ? "It opens again " + whenText(os.next) + ", " + longDate(os.next.toISOString().slice(0, 10)) + "." : "Its opening hours are not stated."),
      slots.length ? [h("p", null, "It takes scheduled orders. Choose a time while it is open, and your order goes in for then."), selectField("closed-when", "Deliver or ready at", when)]
        : h("p", null, "It does not take orders while closed. Please come back when it is open."),
      h("nav", { class: "right-align" },
        h("button", { type: "button", class: "border", on: { click: () => done(false) } }, slots.length ? "Not now" : "OK"),
        slots.length ? h("button", { type: "button", on: { click: () => {
          if (!state.basket || state.basket.rid !== r.id) state.basket = { rid: r.id, version: m.version, mode: "delivery", zone: state.area || "", ward: "", lines: {} };
          state.basket.scheduled = when.value;
          saveBasket();
          done(true);
        } } }, "Schedule") : null));
    d.addEventListener("close", () => { d.remove(); resolve(false); });
    document.body.append(d);
    if (d.showModal) d.showModal(); else d.setAttribute("open", "");
  });
}

function dishRow(r, it, canOrder) {
  const add = async () => {
    if (liveOf(r.id).sold.includes(it.id)) { snackbar(it.name + " is sold out today."); return; }
    if (!(await readyToOrder(r))) return;
    if (it.options) chooseOption(r, it); else addToBasket(r, it.id, it.name);
  };
  return h("li", { class: "dish", "data-id": it.id, on: { click: add } },
    h("div", { class: "max dish-text" },
      h("div", { class: "bold" }, it.name),
      it.description ? h("div", { class: "small-text muted" }, it.description) : null,
      h("div", { class: "price" }, fromPrice(it))),
    h("div", { class: "dish-side" },
      settings().pictures ? itemPicture(it, r.menu) : null,
      h("button", { type: "button", class: "circle dish-add",
        "aria-label": "Add " + it.name + (it.options ? ", choose an option" : ", " + priceOrAsk(it.price)) }, icon("add"))));
}

async function addToBasket(r, key, label) {
  if (state.basket && state.basket.rid !== r.id && basketCount() > 0) {
    const other = restaurantById(state.basket.rid);
    const ok = await ask("Start a new order?",
      "Your basket contains items from " + (other ? other.name : "another restaurant") + ". Each order is placed with one restaurant. Empty the basket and start an order from " + r.name + "?",
      "Empty and start");
    if (!ok) return;
    state.basket = null;
  }
  if (!state.basket) {
    state.basket = { rid: r.id, version: r.menu.version, mode: "delivery", zone: state.area || "", ward: "", lines: {} };
  }
  state.basket.lines[key] = Math.min(99, (state.basket.lines[key] || 0) + 1);
  saveBasket();
  snackbar("Added " + label + ". Basket: " + basketCount() + (basketCount() === 1 ? " item" : " items") + ".");
}

function hoursText(list) {
  return list && list.length ? list.map((p) => clock(p[0]) + " to " + clock(p[1])).join(", ") : "Closed";
}

function viewRestaurant(id) {
  const r = restaurantById(id);
  if (r && !r.menu && !r.problem) {
    show("list", r.name, pageHeader(r.name, "#/"), h("p", { class: "muted" }, "Loading the menu…"));
    ensureMenu(r).then(() => route());
    return;
  }
  if (!r) return show("list", "Not found", pageHeader("Listing not found", "#/"), h("p", null, h("a", { class: "link", href: "#/" }, "All restaurants")));
  const m = r.menu;
  if (!m) return show("list", r.name, pageHeader(r.name, "#/"), notice("warn", r.problem || "This menu is not available."));
  const os = orderingState(m);
  const myZone = state.area ? zoneFor(m, state.area) : onlyZone(m);
  const cover = coverFor(m);

  const chips = [os.closed && os.next ? chip("Closed · opens " + whenText(os.next) + (m.claimed === false ? " (hours not confirmed)" : "")) : statusChip(m)];
  const when = m.announcement && m.announcement.published ? longDate(m.announcement.published) : "";
  if (m.demo === true) chips.push(chip("Demo, just for fun: not a real place", "warn"));
  else if (m.claimed === false) chips.push(chip("Not confirmed by the business" + (when ? " · entered " + when : ""), "warn"));
  else if (when) chips.push(chip("Prices confirmed " + when));
  if (state.area && !zoneFor(m, state.area)) chips.push(chip("Does not list delivery to " + areaName(state.area), "warn"));
  const nodes = [
    pageHeader(m.name, "#/"),
    h("figure", { class: "flush hero" }, picture(cover, "cover", "", cuisineKey(m)), cover ? h("figcaption", { class: "credit" }, cover.page ? h("a", { href: cover.page, class: "link", rel: "noopener", target: "_blank" }, cover.credit) : cover.credit) : null),
    h("div", { class: "row" },
      h("p", { class: "muted flush max" }, (m.handle ? "@" + m.handle + " · " : "") + (m.kind || "Restaurant") + " · " + locatedIn(m)),
      m.business_phone && m.demo !== true ? h("a", { href: "tel:" + m.business_phone, class: "button circle transparent", "aria-label": "Call " + m.name, title: "Call" }, icon("call")) : null,
      favButton(r),
      m.handle ? h("button", { type: "button", class: "circle transparent", "aria-label": "Share this listing", title: "Share", on: { click: () => shareListing(m) } }, icon("share")) : null),
    h("nav", { class: "wrap small-space" }, chips),
    h("p", { class: "small-text muted flush" }, feeSummary(myZone) + (m.pickup !== false ? " Pickup is available." : "") +
      " Pay on delivery or at pickup, never in advance." + (os.closed && os.canOrder ? " You can schedule an order for when it opens." : "")),
  ];
  if (m.demo === true) nodes.push(demoNotice());
  nodes.push(restaurantInfo(m));

  const sections = new Map();
  for (const it of m.items || []) {
    const sec = it.section || "Menu";
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec).push(it);
  }
  /* Fuzzy search inside this menu: matching dishes stay, the rest are hidden. */
  if ((m.items || []).length > 1) {
    const box = h("input", { type: "search", id: "menu-search", autocomplete: "off", placeholder: " " });
    const none = h("p", { class: "muted", hidden: true }, "Nothing on this menu matches. Try a shorter word.");
    const byId = new Map((m.items || []).map((it) => [it.id, it]));
    const filter = () => {
      const q = box.value.trim();
      let any = false;
      for (const ul of document.querySelectorAll("main ul.list.border")) {
        const dishesHere = ul.querySelectorAll("li.dish");
        if (!dishesHere.length) continue;
        let shown = 0;
        for (const li of dishesHere) {
          const it = byId.get(li.dataset.id);
          const hit = !q || (it && fuzzyMatches(q, [it.name, it.description, it.section, it.category, ...((it.options || []).map((o) => o.label))].filter(Boolean).join(" ")));
          li.hidden = !hit; if (hit) shown++;
        }
        for (const lab of ul.querySelectorAll("li.overline-label")) lab.hidden = !!q;
        ul.hidden = !shown;
        const title = ul.previousElementSibling;
        if (title && title.classList.contains("group-title")) title.hidden = !shown;
        if (shown) any = true;
      }
      none.hidden = any;
      const tabs = document.querySelector("main nav.dish-tabs");
      if (tabs) tabs.hidden = !!q;
    };
    box.addEventListener("input", filter);
    const tf = textField("menu-search", "Search this menu", box);
    const fieldEl = tf.querySelector(".field"); fieldEl.classList.add("has-clear"); fieldEl.append(clearButton(box));
    nodes.push(tf, none);
  }
  if (sections.size > 1) {
    nodes.push(h("nav", { class: "dish-tabs", "aria-label": "Menu sections" },
      Array.from(sections.keys()).map((sec, i) => h("a", { href: "#/r/" + r.id, class: "chip small border",
        on: { click: (e) => { e.preventDefault(); const t = document.getElementById("sec-" + i); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); } } }, foodIcon(foodCat(sec) || "plate"), h("span", null, sec)))));
  }
  let secIndex = 0;
  for (const [sec, items] of sections) {
    const lis = [];
    let lastCat = null;
    for (const it of items) {
      if (it.category && it.category !== lastCat) { lastCat = it.category; lis.push(h("li", { class: "overline-label" }, it.category)); }
      lis.push(dishRow(r, it, os.canOrder));
    }
    nodes.push(h("h2", { class: "group-title", id: "sec-" + secIndex++ }, sec), h("ul", { class: "list border" }, lis));
  }
  nodes.push(h("a", { href: "#/basket", class: "button responsive basket-bar", id: "basket-bar", hidden: !(state.basket && state.basket.rid === r.id && basketCount()) },
    icon("shopping_bag"), h("span", { id: "basket-bar-text" }, "View basket")));
  if (state.site.reports && state.site.reports.topic && state.site.reports.enc_key) {
    const rt = h("textarea", { id: "report-text", rows: 3, maxlength: 600, placeholder: " " });
    nodes.splice(nodes.length - 1, 0, h("details", { class: "gap-top" }, h("summary", { class: "link" }, "Report a problem with this listing"),
      h("div", { class: "stack" }, h("p", { class: "small-text muted" }, "Wrong price, closed for good, wrong phone number? The volunteers read it. Nothing identifies you unless you write it."),
        textField("report-text", "What is wrong?", rt),
        h("nav", null, h("button", { type: "button", class: "border", on: { click: async (e) => {
          if (!rt.value.trim()) { snackbar("Write what is wrong first."); return; }
          e.currentTarget.disabled = true;
          try { const s = await sealOrder(state.site.reports, { t: "report", listing: r.id, listing_name: m.name, text: rt.value.trim().slice(0, 600) }); await ntfyPost(state.site.reports.topic, s.envelope); rt.value = ""; snackbar("Thank you. The volunteers will check it."); }
          catch (err) { snackbar("The report could not be sent. Check your connection."); }
          e.currentTarget.disabled = false;
        } } }, icon("send"), h("span", null, "Send the report"))))));
  }
  show("list", m.name, ...nodes);
  if (state.focusItem) {
    const li = Array.from(document.querySelectorAll("main li.dish")).find((x) => { const t = x.querySelector(".bold"); return t && t.textContent === state.focusItem; });
    if (li) { state.focusItem = ""; li.tabIndex = -1; li.scrollIntoView({ block: "center" }); li.focus({ preventScroll: true }); }
  }
  updateBasketBar();
  /* A business that takes orders in Hana is available only while its business tools are open. */
  if (m.direct && m.claimed !== false) presence(m.direct).then((p) => {
    state.offline = state.offline || new Set();
    state.live = state.live || {};
    state.live[r.id] = p;
    const head = document.querySelector("main .page-head");
    if (p.online) {
      state.offline.delete(r.id);
      for (const id of p.sold) {
        const li = document.querySelector('main li.dish[data-id="' + CSS.escape(id) + '"]');
        if (li) { li.querySelector(".price").textContent = "Sold out today"; li.querySelector("button.dish-add").disabled = true; }
      }
      const notes = [p.busy ? "Busy today: deliveries take about " + p.busy + " minutes longer." : "", p.pickup_only ? "Pickup only right now: no deliveries." : ""].filter(Boolean);
      if (head && notes.length) head.after(notice("info", h("p", { class: "flush" }, notes.join(" "))));
      return;
    }
    state.offline.add(r.id);
    if (head) head.after(notice("warn", h("p", { class: "bold flush" }, "Temporarily unavailable"), h("p", { class: "flush" }, "Its staff are busy and are not taking new orders at the moment. Please check back shortly.")));
  });
}

/* The clean web address of a listing, built from its handle. */
function listingUrl(m) { return m.handle ? new URL((isGrocery(m) ? "groceries/" : "restaurants/") + m.handle + "/", document.baseURI).href : null; }
/* Favourites and the "Open now" filter: kept on this phone only. */
function favourites() { return store.get("hana.favourites", []); }
function favButton(r) {
  const b = h("button", { type: "button", class: "circle transparent" });
  const draw = () => { const on = favourites().includes(r.id); b.setAttribute("aria-label", on ? "Remove from favourites" : "Add to favourites"); b.setAttribute("aria-pressed", String(on)); b.replaceChildren(icon(on ? "favorite_fill" : "favorite")); };
  b.addEventListener("click", () => {
    const on = favourites().includes(r.id);
    store.set("hana.favourites", on ? favourites().filter((x) => x !== r.id) : favourites().concat(r.id));
    draw(); snackbar(on ? "Removed from favourites." : "Added to favourites.");
  });
  draw();
  return b;
}
async function shareListing(m) {
  const url = listingUrl(m);
  if (navigator.share) { try { await navigator.share({ title: m.name + " on Hana", url }); return; } catch (e) { if (e.name === "AbortError") return; } }
  copy(url);
}

function updateBasketBar() {
  const bar = document.getElementById("basket-bar");
  if (!bar) return;
  const n = basketCount();
  bar.hidden = !n;
  document.getElementById("basket-bar-text").textContent = "View basket · " + n + (n === 1 ? " item" : " items");
}

/* Everything a customer may want to check but should not have to scroll past. */
function restaurantInfo(m) {
  const kids = [];
  if (m.claimed === false) kids.push(notice("warn", h("p", { class: "bold flush" }, "Not yet confirmed by the business"), h("p", { class: "flush" }, m.listing_note || "")));
  const zones = (m.delivery && m.delivery.zones) || [];
  kids.push(h("h3", { class: "overline-label" }, "Delivery"),
    h("ul", { class: "list border" }, zones.map((z) => h("li", null, icon("location_on"),
      h("div", { class: "max" }, h("div", null, zoneLabel(z)), h("div", { class: "small-text muted" }, feeSummary(z)))))),
    h("p", { class: "small-text muted" }, "The business sets one fixed delivery charge for each area, up to the Hana limit of " + money(state.rules.max_delivery_fee) + ". Hana adds no fees. " + (m.pickup !== false ? "Pickup is available." : "Pickup is not offered.")));
  kids.push(h("h3", { class: "overline-label" }, "Payment"),
    h("p", { class: "small-text" }, "All prices include VAT and every other charge. The delivery fee is the only addition. Pay on delivery or at pickup only: " + paymentText(m) + ". If a business asks you to pay before delivery, do not pay, and report the listing."));
  kids.push(h("h3", { class: "overline-label" }, "Contact"),
    h("ul", { class: "list border" },
      (m.contact || []).map((c) => h("li", null, icon((CHANNELS[c.app] || {}).icon || "chat"),
        h("div", { class: "max" }, h("div", null, (CHANNELS[c.app] ? CHANNELS[c.app].label : c.app) + (c.preferred ? " (preferred)" : "")), h("div", { class: "small-text muted" }, contactText(c.app, c.id))))),
      h("li", null, icon("call"), h("div", { class: "max" }, h("div", null, "Business phone"), h("div", { class: "small-text muted" }, m.business_phone))),
      h("li", null, icon("location_on"), h("div", { class: "max" }, h("div", null, "Address"), h("div", { class: "small-text muted" }, m.address)))));
  kids.push(h("h3", { class: "overline-label" }, "Opening hours"),
    m.hours ? h("ul", { class: "list border" }, DAYS.map((d) => h("li", null, h("div", { class: "max" }, DAY_NAMES[d]), h("span", null, hoursText(m.hours[d])))))
      : h("p", { class: "muted" }, "Not stated."));
  kids.push(h("p", { class: "small-text muted" }, "Prices from version " + m.version + ", published " + longDate(m.announcement && m.announcement.published) + ". Opening times are checked against your phone's clock."));
  if (m.price_history && m.price_history.length) {
    kids.push(h("details", null, h("summary", { class: "link" }, "Price changes (" + m.price_history.length + ")"),
      m.price_history.slice().reverse().map((p) => h("div", null, h("p", { class: "bold" }, longDate(p.published) + ": " + p.summary),
        h("ul", { class: "list" }, p.changes.map((c) => h("li", null, c.label + ": " + (c.old === null ? "new" : money(c.old)) + " to " + (c.new === null ? "removed" : money(c.new)))))))));
  }
  return h("details", { class: "info-list" }, h("summary", { class: "row" }, icon("info"), h("span", { class: "max" }, "Delivery areas, payment, contact and hours"), icon("expand_more")), kids);
}

/* ---------------------------------------------------------------- basket and checkout */

function saveBasket() { store.set("hana.basket", state.basket); updateBasketBadge(); updateBasketBar(); }
function basketCount() { return state.basket ? Object.values(state.basket.lines).reduce((a, b) => a + b, 0) : 0; }

function updateBasketBadge() {
  const n = basketCount();
  for (const a of document.querySelectorAll('[data-nav="basket"]')) {
    const i = a.querySelector("i");
    const old = i.querySelector(".badge");
    if (old) old.remove();
    if (n) i.append(h("span", { class: "badge" }, String(n)));
    a.setAttribute("aria-label", n ? "Basket, " + n + (n === 1 ? " item" : " items") : "Basket");
  }
}

function newCode() {
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  return b32(b).slice(0, 6);
}

/* Orders saved by older versions, or damaged by hand, must never stop the app. */
(function cleanOrders() {
  const o = store.get("hana.orders", []);
  /* Keep the newest 300 orders (newest first), so the record never fills the phone's storage. */
  const c = (Array.isArray(o) ? o : []).filter((x) => x && typeof x === "object" && typeof x.code === "string" && x.code).slice(0, 300)
    .map((x) => Object.assign(x, { items: Array.isArray(x.items) ? x.items.filter((i) => i && typeof i === "object") : [] }));
  if (!Array.isArray(o) || c.length !== o.length || c.some((x, i) => x !== o[i])) store.set("hana.orders", c);
})();
/* A small map of the pin, drawn from OpenStreetMap tiles (free, no key, about six small
   images). Tapping the map moves the pin there. The tile host is allowed in the page's
   Content-Security-Policy (index.html). */
function pinMap(pin, onMove) {
  const W = 640, H = 320, Z = 17, T = 256, N = T * Math.pow(2, Z);
  const cv = h("canvas", { class: "map-pin", width: W, height: H, role: "img", "aria-label": "Map with your pin. Tap the map to move the pin." });
  const toPx = (p) => ({ x: (p.lon + 180) / 360 * N, y: (1 - Math.log(Math.tan(p.lat * Math.PI / 180) + 1 / Math.cos(p.lat * Math.PI / 180)) / Math.PI) / 2 * N });
  const toLL = (x, y) => ({ lat: Number((Math.atan(Math.sinh(Math.PI * (1 - 2 * y / N))) * 180 / Math.PI).toFixed(5)), lon: Number((x / N * 360 - 180).toFixed(5)) });
  let gen = 0;
  const draw = () => {
    const my = ++gen, c = cv.getContext("2d"), g = toPx(pin), left = g.x - W / 2, top = g.y - H / 2;
    const pinDraw = () => {
      c.fillStyle = "#b3261e"; c.strokeStyle = "#fff"; c.lineWidth = 4;
      c.beginPath(); c.arc(W / 2, H / 2 - 34, 20, Math.PI, 0); c.lineTo(W / 2, H / 2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = "#fff"; c.beginPath(); c.arc(W / 2, H / 2 - 34, 7, 0, 2 * Math.PI); c.fill();
    };
    c.fillStyle = "#e5e3df"; c.fillRect(0, 0, W, H);
    for (let tx = Math.floor(left / T); tx * T < left + W; tx++) for (let ty = Math.floor(top / T); ty * T < top + H; ty++) {
      const img = new Image();
      img.onload = () => { if (my === gen) { c.drawImage(img, tx * T - left, ty * T - top); pinDraw(); } };
      img.src = "https://tile.openstreetmap.org/" + Z + "/" + tx + "/" + ty + ".png";
    }
    pinDraw();
  };
  cv.addEventListener("click", (e) => {
    const r = cv.getBoundingClientRect(), g = toPx(pin);
    pin = toLL(g.x + ((e.clientX - r.left) * W / r.width - W / 2), g.y + ((e.clientY - r.top) * H / r.height - H / 2));
    draw(); onMove(pin);
  });
  draw();
  return h("div", null, cv, h("p", { class: "small-text muted flush" }, "Tap the map to move the pin to your door. Map © ",
    h("a", { href: "https://www.openstreetmap.org/copyright", class: "link", target: "_blank", rel: "noopener" }, "OpenStreetMap contributors"), "."))
}
function pinLink(p) { return "https://www.openstreetmap.org/?mlat=" + p.lat + "&mlon=" + p.lon + "#map=18/" + p.lat + "/" + p.lon; }
/* Saved delivery addresses, on this phone only (up to five). */
function savedAddresses() { return store.get("hana.addresses", []); }
function saveAddress(a) {
  const list = savedAddresses().filter((x) => x.label.toLowerCase() !== a.label.toLowerCase());
  store.set("hana.addresses", [a].concat(list).slice(0, 5));
}
async function buildOrder(r, f) {
  const menu = r.menu;
  const prices = {};
  for (const l of priceLines(menu)) prices[l.key] = l;
  const keys = Object.keys(state.basket.lines).filter((k) => prices[k]).sort();
  let sub = 0, unpriced = 0;
  const parts = [], text = [];
  for (const k of keys) {
    const q = state.basket.lines[k], p = prices[k].price;
    parts.push(k + "*" + q);
    const n = state.basket.notes && state.basket.notes[k] ? " (note: " + state.basket.notes[k] + ")" : "";
    if (p === null || p === undefined) { unpriced++; text.push(q + " × " + prices[k].label + n); }
    else { sub += p * q; text.push(q + " × " + prices[k].label + n + ": " + money(p * q)); }
  }
  const pickup = f.mode === "pickup";
  const zone = pickup ? null : f.deliveryZone;
  const fee = pickup ? 0 : (zone && zone.fee !== null && zone.fee !== undefined ? zone.fee : null);
  const feeStr = fee === null ? "?" : String(fee);
  const zoneId = pickup ? "pickup" : zone.id;
  const items = parts.join(",");
  const code = newCode();
  const check = "CHECK hana1 H=" + r.hash.slice(0, 12) + " Z=" + zoneId + " I=" + items + " S=" + sub + " F=" + feeStr + " C=" + await checkCode(r.hash, zoneId, items, sub, feeStr);
  /* A plain, polite message. Claimed listings also get a short reference and the check line
     the business tools read; volunteer-entered listings get none of that. */
  const formal = menu.claimed === true;
  const zoneName = pickup ? "" : areaName(f.zone) + (f.ward ? " (" + areaName(f.ward) + ")" : "");
  const ask = [];
  if (unpriced) ask.push(keys.length - unpriced ? "the prices of the items without a listed price" : "the item prices");
  else if (!formal) ask.push("the item prices");
  if (!pickup && fee === null) ask.push("the delivery charge to " + zoneName);
  else if (!pickup && !formal) ask.push("the delivery charge to " + zoneName);
  if (ask.length) ask.push("the total amount");
  const askLine = ask.length ? "Could you please confirm " + ask.slice(0, -1).join(", ") + " and " + ask[ask.length - 1] + "?" : null;
  const lines = ["Hello, I'd like to order from " + menu.name + ".", "",
    "Order:", ...text, "",
    sub && (!unpriced || keys.length - unpriced) ? (unpriced ? "Subtotal of listed prices: " : "Subtotal: ") + money(sub) : null,
    !pickup && fee !== null ? "Delivery charge to " + zoneName + ": " + money(fee) : null,
    !unpriced && fee !== null ? "Total: " + money(sub + fee) : null,
    askLine ? "" : null, askLine, "",
    "Name: " + f.name, f.phone ? "Phone: " + f.phone : null,
    pickup ? "Pickup: I'll collect the order myself." : "Delivery address: " + f.address + ", " + zoneName,
    !pickup && f.pin ? "Map pin: " + pinLink(f.pin) : null,
    f.scheduled ? (pickup ? "Pickup time: " : "Delivery time: ") + longDate(f.scheduled.slice(0, 10)) + ", " + clock(f.scheduled.slice(11, 16)) : null,
    f.note ? "Note: " + f.note : null, "",
    pickup ? "I'll pay at pickup. No advance payment, please." : "I'll pay by cash on delivery. No advance payment, please.", "",
    formal ? "To confirm, please reply: CONFIRMED " + code : null,
    "Thank you!",
    formal ? "" : null, formal ? "Order reference " + code + " (Hana): " + check : null].filter((l) => l !== null);
  const message = lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim();
  return { code, message, check, sub, fee, keys, zoneId, prices, unpriced };
}

/* Ordering channels at checkout: an order is a written message, so a phone number is offered as a text message, never as a call. */
function orderChannels(menu) {
  const out = [];
  const seen = new Set();
  if (menu.claimed !== false && menu.direct && menu.direct.topic && menu.direct.enc_key) out.push({ app: "hana", id: menu.direct.topic, preferred: true });
  for (const c of menu.contact || []) {
    const app = c.app === "phone" ? "sms" : c.app;
    if (!CHANNELS[app]) continue;
    const id = CHANNEL_IDS_ARE_PHONES.includes(app) ? String(c.id).replace(/^\+/, "") : String(c.id);
    const k = app + ":" + id;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ app, id, preferred: !out.some((x) => x.app === "hana") && !!c.preferred });
  }
  return out;
}

function paymentText(m) {
  const names = state.rules.payment_methods_on_delivery || {};
  if (!Array.isArray(m.payment_on_delivery)) return "cash; other ways to pay at delivery are not stated";
  return m.payment_on_delivery.map((p) => (names[p] || p).toLowerCase().replace(/^bangla qr/, "Bangla QR")).join(", ");
}

function viewBasket() {
  if (!state.basket || !basketCount()) {
    return show("basket", "Basket", pageTitle("Basket"), h("p", { class: "muted" }, "Your basket is empty."),
      h("nav", null, h("a", { href: "#/", class: "button" }, icon("storefront"), h("span", null, "Browse the directory"))));
  }
  const r = restaurantById(state.basket.rid);
  if (r && !r.menu && !r.problem) { show("basket", "Basket", pageTitle("Basket"), h("p", { class: "muted" }, "Loading…")); ensureMenu(r).then(() => route()); return; }
  if (!r || !r.menu) {
    return show("basket", "Basket", pageTitle("Basket"), notice("warn", h("p", { class: "flush" }, "The business for this basket is not available. " + (r && r.problem ? r.problem : ""))),
      h("button", { type: "button", class: "border", on: { click: () => { state.basket = null; saveBasket(); viewBasket(); } } }, "Empty basket"));
  }
  const menu = r.menu;
  const b = state.basket;
  if (!b.mode) b.mode = "delivery";
  const prices = {};
  for (const l of priceLines(menu)) prices[l.key] = l;
  const dropped = Object.keys(b.lines).filter((k) => !prices[k]);
  for (const k of dropped) delete b.lines[k];
  if (dropped.length) saveBasket();
  if (!basketCount()) return viewBasket();

  const nodes = [pageTitle("Basket"), h("p", { class: "muted" }, "From ", h("a", { class: "link", href: "#/r/" + r.id }, menu.name))];
  if (dropped.length) nodes.push(notice("warn", h("p", { class: "flush" }, dropped.length + (dropped.length === 1 ? " item is" : " items are") + " no longer on the menu and " + (dropped.length === 1 ? "was" : "were") + " removed.")));
  if (b.version !== menu.version) {
    nodes.push(notice("warn", h("p", { class: "bold flush" }, "Prices have changed"),
      h("p", { class: "flush" }, "You added items from version " + b.version + " of the menu. It is now version " + menu.version + ", and the current prices are shown. " + (menu.announcement ? menu.announcement.summary : ""))));
  }
  if (menu.demo === true) nodes.push(demoNotice());
  else if (menu.claimed === false) nodes.push(notice("warn", h("p", { class: "flush" }, "This listing is not yet confirmed by the business. Check the prices when the business confirms your order.")));

  const list = h("ul", { class: "list border" });
  const totals = h("article", { class: "round no-elevate surface-container-high stack" });
  const deliveryBox = h("div");
  const out = h("div", { "aria-live": "polite" });
  const pickupOffered = menu.pickup !== false;
  const os = orderingState(menu);
  const slots = scheduleSlots(menu);
  const when = h("select", { id: "when" },
    os.closed ? null : h("option", { value: "" }, "As soon as possible"),
    slots.map((s) => h("option", { value: s.value, selected: b.scheduled === s.value }, s.label)));
  const whenBox = (os.closed && os.canOrder) || (!os.closed && menu.scheduled_orders === true && slots.length) ? selectField("when", os.closed ? "Schedule for later (the business is closed now)" : "When", when) : null;

  const deliveryZone = () => (b.mode === "delivery" && b.zone ? zoneFor(menu, b.zone) : null);

  /* A short note for one item, such as "no onion", carried into the order message. */
  const itemNote = (k) => {
    const cur = (b.notes && b.notes[k]) || "";
    const inp = h("input", { type: "text", id: "note-" + k, maxlength: 80, autocomplete: "off", placeholder: " ", value: cur,
      on: { change: () => { b.notes = Object.assign({}, b.notes, { [k]: inp.value.trim() }); if (!b.notes[k]) delete b.notes[k]; saveBasket(); refresh(); } } });
    return h("details", { class: "item-note" }, h("summary", { class: "link small-text" }, cur ? "Note: " + cur : "Add a note for this item"),
      textField("note-" + k, "Note, for example no onion", inp));
  };
  function refresh() {
    let sub = 0, unpriced = 0;
    list.replaceChildren(...Object.keys(b.lines).sort().map((k) => {
      const q = b.lines[k], p = prices[k].price;
      if (p === null || p === undefined) unpriced++; else sub += p * q;
      return h("li", null,
        h("div", { class: "max" }, h("div", { class: "bold" }, prices[k].label),
          h("div", { class: "small-text muted price" }, p === null || p === undefined ? "Price on request" : q + " × " + money(p) + " = " + money(p * q))),
        h("nav", { class: "no-space", role: "group", "aria-label": "Quantity of " + prices[k].label },
          h("button", { type: "button", class: "circle transparent", "aria-label": "Remove one " + prices[k].label, on: { click: () => change(k, -1) } }, icon(q === 1 ? "delete" : "remove")),
          h("span", { class: "bold price" }, String(q)),
          h("button", { type: "button", class: "circle transparent", "aria-label": "Add one " + prices[k].label, on: { click: () => change(k, 1) } }, icon("add"))),
        itemNote(k));
    }));
    const z = deliveryZone();
    let feeText;
    if (b.mode === "pickup") feeText = "None (pickup)";
    else if (!b.zone) feeText = "Choose your zone";
    else if (!z) feeText = "No delivery to your zone";
    else feeText = z.fee === null ? "Not stated" : money(z.fee);
    const fee = b.mode === "pickup" ? 0 : (z && z.fee !== null ? z.fee : null);
    const rows = [h("nav", null, h("span", { class: "max" }, unpriced ? "Subtotal of listed prices" : "Subtotal (items)"), h("span", { class: "price" }, unpriced && !sub ? "Not listed" : money(sub))),
      h("nav", null, h("span", { class: "max" }, b.mode === "pickup" ? "Pickup" : "Delivery fee"), h("span", { class: "price" }, feeText))];
    if (unpriced) rows.push(h("hr"), h("p", { class: "small-text flush" }, (unpriced === 1 ? "One item has" : unpriced + " items have") + " no listed price. Your order message asks the business for each price and the total" + (b.mode === "pickup" ? "" : ", including delivery,") + " when it confirms."));
    else if (fee !== null && (b.mode === "pickup" || z)) rows.push(h("hr"), h("nav", null, h("span", { class: "max bold" }, "Total to pay at " + (b.mode === "pickup" ? "pickup" : "delivery") + (b.mode === "pickup" ? "" : ", including delivery")), h("span", { class: "price bold" }, money(sub + fee))));
    else if (b.mode !== "pickup" && z) rows.push(h("hr"), h("p", { class: "small-text flush" }, "Total: " + money(sub) + " plus the delivery fee, which the business confirms."));
    if (b.mode !== "pickup" && z && arrivalMinutes(z) && !when.value) {
      const start = os.closed && os.next ? os.next : new Date();
      rows.push(h("p", { class: "small-text flush" }, "Estimated arrival: about " + clockAt(new Date(start.getTime() + arrivalMinutes(z, r.id) * 60000)) + ". That is the business's delivery time of " + z.eta_min + " minutes" + (liveOf(r.id).busy ? ", " + liveOf(r.id).busy + " extra minutes because it is busy today," : "") + " plus up to " + state.rules.confirmation_window_minutes + " minutes for it to confirm."));
    }
    if (z && z.min_order && sub < z.min_order) rows.push(h("p", { class: "small-text flush" }, "This order is below the minimum order of " + money(z.min_order) + "."));
    rows.push(h("p", { class: "small-text muted flush" }, "All prices include VAT and every other charge. Prices from version " + menu.version + ", published " + longDate(menu.announcement && menu.announcement.published) + "."));
    totals.replaceChildren(...rows);
  }
  function change(k, d) {
    const q = (b.lines[k] || 0) + d;
    if (q <= 0) delete b.lines[k]; else b.lines[k] = Math.min(99, q);
    saveBasket();
    if (!basketCount()) { state.basket = null; saveBasket(); viewBasket(); return; }
    refresh();
  }

  const saved = store.get("hana.me", { name: "", address: "" });
  const name = h("input", { type: "text", id: "name", value: saved.name, autocomplete: "off", maxlength: 60, placeholder: " " });
  const phone = h("input", { type: "tel", id: "phone", value: saved.phone || "", autocomplete: "off", maxlength: 14, inputmode: "tel", placeholder: " " });
  const address = h("textarea", { id: "address", rows: 3, maxlength: 300, placeholder: " " }, saved.address);
  const note = h("input", { type: "text", id: "note", maxlength: 200, autocomplete: "off", placeholder: " ", value: (state.basket && state.basket.note) || "" });
  const remember = h("input", { type: "checkbox", id: "remember", checked: !!saved.name });
  const label = h("input", { type: "text", id: "addr-label", maxlength: 20, autocomplete: "off", placeholder: " " });
  let pin = b.pin || null;
  const pinBox = h("div");
  const drawPin = () => pinBox.replaceChildren(pin
    ? h("div", null, pinMap(pin, (p2) => { pin = p2; b.pin = pin; saveBasket(); zoneFromPin(); }),
      h("nav", { class: "wrap" }, h("a", { href: pinLink(pin), target: "_blank", rel: "noopener", class: "button border" }, icon("open_in_new"), h("span", null, "Open in a map app")),
        h("button", { type: "button", class: "border", on: { click: () => { pin = null; b.pin = null; saveBasket(); drawPin(); } } }, icon("close"), h("span", null, "Remove the pin"))))
    : h("nav", null, h("button", { type: "button", class: "border", on: { click: () => {
        if (!navigator.geolocation) { snackbar("This browser cannot share your location."); return; }
        navigator.geolocation.getCurrentPosition((p) => {
          pin = { lat: Number(p.coords.latitude.toFixed(5)), lon: Number(p.coords.longitude.toFixed(5)) };
          b.pin = pin; saveBasket(); drawPin(); zoneFromPin();
        }, () => snackbar("Your location could not be read. Type your address instead."), { timeout: 15000, maximumAge: 60000, enableHighAccuracy: true });
      } } }, icon("location_on"), h("span", null, "Add a map pin for the rider"))));
  /* The zone follows the pin, so the customer does not have to pick it as well. */
  const zoneFromPin = async () => {
    if (!pin) return;
    const z = await zoneAt(pin.lat, pin.lon);
    if (z && z.id !== b.zone) { b.zone = z.id; b.ward = ""; state.area = z.id; store.set("hana.area", z.id); saveBasket(); renderDelivery(); refresh(); snackbar("Zone set to " + z.name + " from your pin."); }
  };
  drawPin();
  const useSaved = (a) => { address.value = a.address; b.zone = a.zone; b.ward = a.ward || ""; pin = a.pin || null; b.pin = pin; label.value = a.label; saveBasket(); renderDelivery(); refresh(); };

  function renderDelivery() {
    if (b.mode === "pickup") {
      deliveryBox.replaceChildren(
        null,
        h("p", { class: "small-text muted" }, "Address: " + menu.address));
      return;
    }
    const z = deliveryZone();
    deliveryBox.replaceChildren(
      zoneSelect("zone", b.zone, (v) => { b.zone = v; b.ward = ""; if (v) { state.area = v; store.set("hana.area", v); } saveBasket(); renderDelivery(); refresh(); }, "Choose your zone"),
      b.zone ? wardSelect("ward", b.zone, b.ward, (v) => { b.ward = v; saveBasket(); }) : "",
      b.zone && !z ? notice("warn", h("p", { class: "flush" }, menu.name + " does not deliver to " + areaName(b.zone) + ". Choose pickup, or order from another restaurant.")) : "",
      savedAddresses().length ? h("nav", { class: "wrap" }, savedAddresses().map((a) => h("button", { type: "button", class: "chip border", on: { click: () => useSaved(a) } }, h("span", null, a.label)))) : null,
      textField("address", "Address or landmark", address),
      pinBox,
      textField("addr-label", "Save this address as, for example Home (optional)", label));
    drawPin();
  }

  const modeRadios = h("nav", { class: "vertical left-align" },
    h("label", { class: "radio" }, h("input", { type: "radio", name: "mode", value: "delivery", checked: b.mode === "delivery", on: { change: () => { b.mode = "delivery"; saveBasket(); renderDelivery(); refresh(); } } }), h("span", null, "Delivery")),
    pickupOffered ? h("label", { class: "radio" }, h("input", { type: "radio", name: "mode", value: "pickup", checked: b.mode === "pickup", on: { change: () => { b.mode = "pickup"; saveBasket(); renderDelivery(); refresh(); } } }), h("span", null, "Pickup")) : null);
  if (!pickupOffered && b.mode === "pickup") b.mode = "delivery";

  const channels = orderChannels(menu);
  const anyPreferred = channels.some((x) => x.preferred);
  const channelRadios = channels.map((c, i) => h("label", { class: "radio" },
    h("input", { type: "radio", name: "channel", value: String(i), checked: c.preferred || (i === 0 && !anyPreferred) }),
    h("span", null, CHANNELS[c.app].label + (c.app === "hana" || c.app === "demo" ? "" : c.app === "endpoint" ? " (" + contactText(c.app, c.id) + ")" : " · " + contactText(c.app, c.id)))));

  let sending = false;
  const form = h("form", { novalidate: true, on: { submit: async (e) => {
    e.preventDefault();
    /* One order per tap: repeated taps while it is being prepared are ignored. */
    if (sending) return;
    sending = true;
    setTimeout(() => { sending = false; }, 2000);
    const errors = [];
    const z = deliveryZone();
    if (b.mode === "delivery" && liveOf(r.id).pickup_only) errors.push("This business is taking pickup orders only right now.");
    if (b.mode === "delivery" && !b.zone) errors.push("Choose your zone.");
    if (b.mode === "delivery" && b.zone && !z) errors.push("This business does not deliver to your zone.");
    if (!name.value.trim()) errors.push("Enter a first name or nickname.");
    const chosen = channels[Number((form.querySelector("input[name=channel]:checked") || { value: 0 }).value)];
    const ph = phone.value.replace(/[\s-]/g, "").replace(/^0/, "+880").replace(/^880/, "+880");
    if (chosen && chosen.app === "hana" && !/^\+8801\d{9}$/.test(ph)) errors.push("Enter your mobile number in the format 01XXXXXXXXX, so the business and its rider can reach you.");
    if (chosen && chosen.app === "hana" && state.offline && state.offline.has(r.id)) errors.push("This business is temporarily unavailable. Please try again shortly.");
    if (b.mode === "delivery" && !address.value.trim()) errors.push("Enter an address or landmark.");
    if (!channels.length) errors.push("This listing has no way to send a written order.");
    if (os.closed && !os.canOrder) errors.push("This business is closed and does not take scheduled orders.");
    if (os.closed && os.canOrder && !when.value) errors.push("Choose a time for your scheduled order.");
    const waiting = store.get("hana.orders", []).filter((x) => x.status === "awaiting" && !x.informal && !x.demo);
    if (waiting.some((x) => x.restaurant_id === r.id)) errors.push("You already have an order waiting for this business's reply. Wait for it, or cancel it on the Orders page.");
    else if (waiting.length >= 3) errors.push("You have three orders waiting for replies. Wait for them, or cancel one, before placing another.");
    if (errors.length) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, errors.join(" ")))); return; }
    store.set("hana.me", remember.checked ? { name: name.value.trim(), address: address.value.trim(), phone: phone.value.trim() } : { name: "", address: "", phone: "" });
    const scheduled = when.value || null;
    const o = await buildOrder(r, { mode: b.mode, zone: b.zone, ward: b.ward, deliveryZone: z, name: name.value.trim(), phone: /^\+8801\d{9}$/.test(ph) ? ph : "", address: address.value.trim(), pin: b.mode === "delivery" ? pin : null, note: note.value.trim(), scheduled });
    if (b.mode === "delivery" && label.value.trim()) saveAddress({ label: label.value.trim(), address: address.value.trim(), zone: b.zone, ward: b.ward || "", pin });
    const c = channels[Number((form.querySelector("input[name=channel]:checked") || { value: 0 }).value)];
    const ch = CHANNELS[c.app];
    let sentDirect = false, directError = "";
    let sealedInfo = null;
    let orderKey = null;
    if (c.app === "hana") {
      orderKey = await makeOrderKey();
      try { sealedInfo = await sealOrder(menu.direct, { message: o.message, code: o.code, cpub: orderKey ? orderKey.pub : null }); await ntfyPost(c.id, sealedInfo.envelope); sentDirect = true; } catch (err) { directError = err.message; }
      if (!sentDirect) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, "The order could not be sent in Hana. " + directError + " Choose another way to send it."))); return; }
    } else if (c.app === "demo") {
      sentDirect = true; /* a demo order stays on this phone */
    } else if (ch.direct) {
      try { await sendDirect(c.id, o.message); sentDirect = true; } catch (err) { directError = err.message; }
      if (!sentDirect) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, "The order could not be sent directly. " + directError + " Choose another way to send it."))); return; }
    }
    const link = ch.direct ? null : ch.link(c.id, o.message, o.code);
    const created = new Date().toISOString();
    const windowStart = os.closed && os.next ? os.next.toISOString() : created;
    const orders = store.get("hana.orders", []);
    orders.unshift({ code: o.code, status: "awaiting", created, restaurant_id: r.id, restaurant: menu.name,
      claimed: menu.claimed === true && !!(menu.owner && menu.owner.public_key), public_key: menu.owner && menu.owner.public_key ? menu.owner.public_key : null, staff_keys: ((menu.owner && menu.owner.staff) || []).map((x) => x.public_key).filter(Boolean),
      menu_hash: r.hash, menu_version: menu.version, mode: b.mode, zone: b.zone, ward: b.ward,
      items: o.keys.map((k) => ({ key: k, label: prices[k].label, qty: b.lines[k], price: prices[k].price, note: (b.notes && b.notes[k]) || undefined })), subtotal: o.sub, fee: o.fee,
      message: o.message, check_line: o.check, channel: c.app, channel_id: c.id, menu_file: r.raw,
      window_start: windowStart, scheduled, business_phone: menu.demo === true ? null : menu.business_phone, informal: menu.claimed !== true && menu.demo !== true, demo: menu.demo === true || undefined,
      order_topic: sealedInfo ? sealedInfo.orderTopic : null, order_key: sealedInfo ? sealedInfo.key : null, sign_key: sealedInfo && orderKey ? orderKey.jwk : null, eta_min: z && z.eta_min !== undefined ? z.eta_min : null,
      arrive_at: b.mode === "pickup" || menu.demo === true ? null : scheduled ? new Date(scheduled).toISOString() : arrivalMinutes(z) ? new Date(new Date(windowStart).getTime() + arrivalMinutes(z) * 60000).toISOString() : null,
      feed: menu.claimed === true && menu.confirmation_feed ? menu.confirmation_feed : null });
    const savedOk = store.set("hana.orders", orders.slice(0, 50));
    log("Prepared order " + o.code + " for " + menu.name + (sentDirect ? "; sent directly to the business." : "."));
    state.basket = null; saveBasket();
    /* The order is placed: the basket is gone, and the customer goes straight to the order. For
       an order sent from the customer's own app, the top of Orders shows the message and the
       button that opens that app. */
    const win = state.rules.confirmation_window_minutes;
    state.justPlaced = menu.demo === true ? { code: o.code, nodes: [] } : { code: o.code, nodes: [
      h("h2", { class: "section-title" }, sentDirect ? "Order " + o.code + " sent" : "Order " + o.code + ": send it now"),
      savedOk ? null : notice("warn", h("p", { class: "flush" }, "This phone could not save a copy of the order. Copy the message below to keep a record.")),
      h("p", null, sentDirect ? "Your order went straight to " + menu.name + "." : (ch.prefill ? "Your app opens with the message ready. Press send there." : "Copy the message, open " + ch.label + " and send it to " + contactText(c.app, c.id) + ".")),
      h("p", null, menu.name + " has " + win + " minutes to confirm" + (windowStart !== created ? " once it opens (" + whenText(new Date(windowStart)) + ")" : "") + ". If it does not, the order is cancelled automatically."),
      h("pre", null, o.message),
      h("nav", { class: "wrap gap-top" },
        link ? h("a", { href: link, class: "button", rel: "noopener", target: "_blank", on: { click: () => { if (!ch.prefill) copy(o.message); } } }, icon(ch.icon), h("span", null, ch.prefill ? "Open " + ch.label : "Copy and open " + ch.label)) : null,
        h("button", { type: "button", class: "border", on: { click: () => copy(o.message) } }, icon("content_copy"), h("span", null, "Copy message")))].filter(Boolean) };
    form.remove();
    location.hash = "#/orders";
  } } },
    sectionTitle("Checkout"),
    whenBox,
    modeRadios,
    deliveryBox,
    textField("name", "First name or nickname", name),
    textField("phone", "Mobile number (needed for orders sent in Hana)", phone),
    textField("note", "Note for the business (optional)", note),
    h("p", { class: "small-text bold" }, "Send the order by"),
    h("nav", { class: "vertical left-align" }, channelRadios),
    notice("info", h("p", { class: "bold flush" }, "Pay on delivery"),
      h("p", { class: "flush" }, "Pay when you receive the order: " + paymentText(menu) + ". Never pay in advance. If anyone asks for payment before delivery, do not pay, and report the listing.")),
    h("div", { class: "space" }),
    h("label", { class: "checkbox" }, remember, h("span", null, "Remember my name and address on this phone only")),
    h("div", { class: "space" }),
    h("nav", null, h("button", { type: "submit", class: "responsive" }, icon("send"), h("span", null, "Prepare my order"))));

  nodes.push(list, totals, form, out, h("div", { class: "space" }),
    h("nav", null, h("button", { type: "button", class: "border", on: { click: async () => {
      if (await ask("Empty the basket?", "This removes every item from your basket.", "Empty basket")) { state.basket = null; saveBasket(); viewBasket(); }
    } } }, icon("delete"), h("span", null, "Empty basket"))));
  show("basket", "Basket", ...nodes);
  renderDelivery();
  when.addEventListener("change", () => { b.scheduled = when.value || null; saveBasket(); refresh(); });
  refresh();
}

/* ---------------------------------------------------------------- orders, confirmation and complaints */

/* A small record, kept on this phone only, of every order added, confirmed, cancelled or removed. */
function log(text) {
  const entries = store.get("hana.log", []);
  entries.unshift({ at: new Date().toISOString(), text });
  store.set("hana.log", entries.slice(0, 500));
}

/* Orders that the business never confirmed are removed after the expiry time, so an unsent or
   unconfirmed order cannot be kept and used for a complaint. */
/* Demo listings (TONG and DUWAN): orders move through every step on their own, for fun, like
   the pretend-shopping sites people use for a small dopamine hit. Nothing is ever sent. */
const DEMO_RIDER = { name: "Rice Uddin", phone: "012RICEUDDIN" };
const DEMO_DONE_S = 75;
const DEMO_STEPS = {
  delivery: [[4, "confirm"], [6, "accepted", "Accepted. A pretend cook is on it."], [20, "ready", "Ready, and smelling imaginary-good."], [35, "out", "Out for delivery with Rice Uddin."], [DEMO_DONE_S, "delivered", "Delivered! Hope you enjoyed your dopamine hit."]],
  pickup: [[4, "confirm"], [6, "accepted", "Accepted. A pretend cook is on it."], [20, "ready", "Ready for pickup (in your imagination)."], [45, "picked", "Picked up! Hope you enjoyed your dopamine hit."]],
};
function demoNotice() {
  return notice("info", h("p", { class: "bold flush" }, "Demo, just for fun"), h("p", { class: "flush" }, "Not a real place. Nothing is sent, cooked or delivered, and nobody will come to your door. Enjoy the ride."));
}
function demoAdvance(orders) {
  let changed = false;
  for (const o of orders) {
    if (!o || !o.demo || o.status === "cancelled") continue;
    const start = new Date(o.created).getTime(), t = (Date.now() - start) / 1000;
    for (const [at, step, text] of DEMO_STEPS[o.mode === "pickup" ? "pickup" : "delivery"]) {
      if (t < at) break;
      const when = new Date(start + at * 1000).toISOString();
      if (step === "confirm") {
        if (o.status === "awaiting") { Object.assign(o, { status: "confirmed_demo", confirmed_at: when, confirmation: "Confirmed automatically (demo)" }); changed = true; }
      } else if (!(o.progress || []).some((p) => p.step === step)) {
        o.progress = (o.progress || []).concat({ step, at: when, text, rider: step === "out" ? DEMO_RIDER : null });
        changed = true;
      }
    }
  }
  return changed;
}
/* Live countdowns on the Orders page: each element with data-until (a time in milliseconds)
   counts down every second. Demo orders show one per upcoming step. */
function mmss(ms) { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); }
function countdowns(o) {
  if (!o || o.status === "cancelled" || o.status === "declined" || o.status === "expired") return null;
  const rows = [];
  const done = (step) => (o.progress || []).some((p) => p.step === step);
  if (o.demo) {
    const start = new Date(o.created).getTime();
    for (const [at, step, text] of DEMO_STEPS[o.mode === "pickup" ? "pickup" : "delivery"]) {
      if (step === "confirm" ? o.status !== "awaiting" : done(step)) continue;
      rows.push([start + at * 1000, step === "confirm" ? "Confirmed" : DEMO_LABEL[step]]);
    }
  } else if (o.status === "awaiting" && !o.informal) {
    const win = Number(state.rules.confirmation_window_minutes) || 15;
    rows.push([new Date(o.window_start || o.created).getTime() + win * 60000, "Time left for the business to confirm"]);
  } else if (o.status.startsWith("confirmed") && o.arrive_at && !done("delivered") && !done("picked")) {
    rows.push([new Date(o.arrive_at).getTime() + (o.progress || []).filter((p) => p.step === "late").length * 15 * 60000, "Estimated arrival"]);
  }
  if (!rows.length) return null;
  return h("ul", { class: "list border countdowns" }, rows.map(([until, label]) => h("li", null, icon("schedule"),
    h("div", { class: "max" }, label), h("span", { class: "price bold", "data-until": String(until) }, mmss(until - Date.now())))));
}
const DEMO_LABEL = { accepted: "Accepted", ready: "Ready", out: "Out for delivery", delivered: "Delivered", picked: "Picked up" };
let ordersTimer = null;
function ordersTicker() {
  clearInterval(ordersTimer);
  ordersTimer = setInterval(() => {
    if (location.hash !== "#/orders") { clearInterval(ordersTimer); return; }
    const orders = store.get("hana.orders", []);
    if (demoAdvance(orders)) { store.set("hana.orders", orders); viewOrders(); return; }
    for (const el of document.querySelectorAll("[data-until]")) el.textContent = mmss(Number(el.dataset.until) - Date.now());
  }, 1000);
}

function expireOrders() {
  const win = Number(state.rules.confirmation_window_minutes) || 15;
  const keepHours = Number(state.rules.draft_order_expiry_hours) || 24;
  const now = Date.now();
  const orders = store.get("hana.orders", []);
  let changed = false;
  const keep = orders.filter((o) => {
    if (!o.status) { o.status = o.confirmation ? "confirmed_unsigned" : "awaiting"; changed = true; }
    const age = now - new Date(o.created || o.at).getTime();
    const sinceStart = now - new Date(o.window_start || o.created || o.at).getTime();
    if (o.status === "awaiting" && !o.informal && !o.demo && sinceStart > win * 60000) {
      o.status = "expired";
      o.closed_at = new Date().toISOString();
      changed = true;
      log("Order " + o.code + " for " + o.restaurant + " was cancelled automatically: no confirmation within " + win + " minutes.");
    }
    if (["expired", "declined", "cancelled"].includes(o.status) && age > keepHours * 3600000) {
      log("Removed the record of unconfirmed order " + o.code + " for " + o.restaurant + " after " + keepHours + " hours.");
      changed = true;
      return false;
    }
    return true;
  });
  if (changed) store.set("hana.orders", keep);
}

const STATUS_TEXT = {
  awaiting: ["Waiting for the business to confirm", "warn"],
  expired: ["Cancelled automatically: not confirmed in time", "info"],
  declined: ["Declined by the business", "info"],
  cancelled: ["Cancelled by you", "info"],
  confirmed_signed: ["Confirmed by the business (signature checked)", "ok"],
  confirmed_unsigned: ["Confirmed by message (not signed)", "info"],
  confirmed_demo: ["Confirmed automatically (demo)", "info"],
  confirmed_unchecked: ["Confirmed (this browser cannot check the signature)", "info"],
};

/* The customer's own messages on an order sent in Hana, signed with the order's key. */
async function customerUpdate(o, obj) {
  obj = Object.assign({ from: "c", at: new Date().toISOString() }, obj);
  if (o.sign_key) { try { await signUpdate(o.sign_key, o.code, obj); } catch (e) { /* this browser cannot sign; sent unsigned */ } }
  return obj;
}

function signedRecords(o) {
  return [...(o.progress || []), ...(o.chat || [])].filter((x) => x.signed).map((x) => canonicalJSON(x.signed));
}
function complaintText(o) {
  return ["COMPLAINT SUMMARY (prepared on the customer's phone with Hana)",
    "Order code: " + o.code, "Order prepared: " + dateTime(o.created || o.at), "Business: " + o.restaurant,
    "Order type: " + (o.mode === "pickup" ? "pickup" : "delivery"),
    "Confirmation by the business: " + (STATUS_TEXT[o.status] || [o.status])[0],
    "Confirmation received: " + dateTime(o.confirmed_at), "Confirmation text: " + o.confirmation,
    "Menu version: " + o.menu_version, "Menu file SHA-256: " + o.menu_hash,
    ...(o.progress || []).map((p) => "Update " + dateTime(p.at) + ": " + (p.text || p.step) + (p.rider ? " (rider " + p.rider.name + ", " + p.rider.phone + ")" : "") + (p.verified === true ? " (signed by the business)" : p.verified === false ? " (not verified)" : "")),
    ...(o.chat || []).map((m) => "Message " + dateTime(m.at) + " from the " + (m.from === "c" ? "customer" : "business") + ": " + m.text + (m.from === "b" && m.verified === true ? " (signed by the business)" : m.from === "b" && m.verified === false ? " (not verified)" : "")),
    "Items: " + o.items.map((i) => i.qty + " × " + (i.label || i.key)).join("; "),
    "Items subtotal: " + money(o.subtotal) + (o.items.some((i) => i.price === null || i.price === undefined) ? " (some prices not listed)" : ""), "Delivery fee: " + (o.mode === "pickup" ? "none (pickup)" : o.fee === null ? "not stated" : money(o.fee)),
    "", "Message sent to the business:", o.message || o.kitchen_message, "",
    ...(signedRecords(o).length ? ["", "Signed records (each can be checked against the business's public key " + o.public_key + "; SPEC.md, section 21):", ...signedRecords(o)] : []),
    "", "Attach a screenshot of the chat showing the order and the business's confirmation.",
    "Under the Hana Terms of Use, the business must keep its communications about this order for at least " + state.rules.record_retention_months + " months, or " + state.rules.record_retention_months_when_disputed + " months once a dispute is raised.",
    "", "Description of the problem:", "", "Amount in dispute (BDT):", ""].join("\n");
}

function orderCard(o, orders) {
  const st = STATUS_TEXT[o.status] || [o.status, "info"];
  const out = h("div", { "aria-live": "polite" });
  const kids = [
    h("h2", { class: "card-title" }, o.restaurant),
    h("p", { class: "muted flush" }, "Order " + o.code + " · " + dateTime(o.created || o.at)),
    h("p", { class: "flush" }, (o.items.some((i) => i.price === null || i.price === undefined) ? "Prices to be confirmed by the business" : money(o.subtotal)) + (o.mode === "pickup" ? " (pickup)" : o.fee === null ? " plus delivery (fee not stated)" : " plus " + money(o.fee) + " delivery")),
    h("nav", { class: "wrap small-space" }, chip(st[0], st[1])),
    o.demo ? demoNotice() : null,
    countdowns(o),
  ].filter(Boolean);
  const save = () => store.set("hana.orders", orders);
  const win = Number(state.rules.confirmation_window_minutes) || 15;
  const deadline = new Date(new Date(o.window_start || o.created || o.at).getTime() + win * 60000);
  const reminder = () => {
    const ch = CHANNELS[o.channel];
    const text = "Reminder: order " + o.code + " is waiting for your confirmation. To confirm, reply: CONFIRMED " + o.code;
    if (!ch || !o.channel_id) { copy(text); return; }
    if (ch.direct) { sendDirect(o.channel_id, text).then(() => snackbar("Reminder sent."), () => snackbar("Could not send the reminder.")); return; }
    if (!ch.prefill) copy(text);
    window.open(ch.link(o.channel_id, text, o.code), "_blank", "noopener");
  };
  if (o.arrive_at && (o.status === "awaiting" || o.status.startsWith("confirmed"))) {
    kids.push(h("p", { class: "small-text bold" }, (o.scheduled ? "Scheduled for " : "Estimated arrival: about ") + clockAt(new Date(o.arrive_at)) + (new Date(o.arrive_at).toDateString() !== new Date().toDateString() ? ", " + longDate(o.arrive_at.slice(0, 10)) : "") + "."));
  }
  if (o.progress && o.progress.length) {
    const last = o.progress[o.progress.length - 1];
    kids.push(h("ul", { class: "list border" }, o.progress.map((p) => h("li", null, icon("check_circle"),
      h("div", { class: "max" }, h("div", null, p.text || p.step), h("div", { class: "small-text muted" }, dateTime(p.at) + (p.rider ? " · Rider " + p.rider.name + ", " + p.rider.phone : "")))))));
    const lastStep = o.progress.filter((p) => p.step !== "late").pop() || last;
    if (o.demo && lastStep.rider && lastStep.step === "out") kids.push(h("nav", null, h("button", { type: "button", class: "border", on: { click: () => snackbar("Rice Uddin (" + DEMO_RIDER.phone + ") is pretend, but he says thank you for calling.") } }, icon("call"), h("span", null, "Call Rice Uddin"))));
    else if (lastStep.rider && lastStep.step === "out") kids.push(h("nav", null, h("a", { href: "tel:" + lastStep.rider.phone, class: "button border" }, icon("call"), h("span", null, "Call the rider"))));
  }
  /* Check before you pay: tick each item when the order arrives, then hand over the money. */
  if (o.status.startsWith("confirmed") && (o.items || []).length && !(o.progress || []).some((p) => p.step === "delivered" || p.step === "picked")) {
    const done = new Set(o.checked || []);
    const all = () => o.items.every((i) => done.has(i.key));
    const msg = h("p", { class: "small-text flush" + (all() ? " bold" : " muted") }, all() ? "Everything is here. You can pay now." : "Tick each item as you check it. Pay only when everything is here.");
    kids.push(h("details", { class: "gap-top", open: o.items.length > 0 && done.size > 0 }, h("summary", { class: "link" }, "Check before you pay"),
      h("div", { class: "stack" }, msg, h("nav", { class: "vertical left-align" }, o.items.map((i) => h("label", { class: "checkbox" },
        h("input", { type: "checkbox", checked: done.has(i.key), on: { change: (e) => {
          if (e.target.checked) done.add(i.key); else done.delete(i.key);
          o.checked = Array.from(done); save();
          msg.textContent = all() ? "Everything is here. You can pay now." : "Tick each item as you check it. Pay only when everything is here.";
          msg.className = "small-text flush" + (all() ? " bold" : " muted");
        } } }), h("span", null, i.qty + " × " + (i.label || i.key) + (i.note ? " (" + i.note + ")" : ""))))))));
  }
  if (o.channel === "hana" && o.order_topic && !o.alerts && (o.status === "awaiting" || o.status.startsWith("confirmed")) && !(o.progress || []).some((p) => p.step === "delivered" || p.step === "picked"))
    kids.push(h("nav", null, h("button", { type: "button", class: "border", on: { click: async () => {
      try {
        const open = store.get("hana.orders", []).filter((x) => x.order_topic && (x.status === "awaiting" || x.status.startsWith("confirmed")));
        await ntfyPush(open.map((x) => x.order_topic));
        o.alerts = true; save(); viewOrders();
        snackbar("Alerts are on. This phone shows each update, even while Hana is closed.");
      } catch (e) { snackbar(e.message); }
    } } }, icon("inbox"), h("span", null, "Alert me about this order"))));
  const chatOpen = o.channel === "hana" && o.order_topic && (o.status === "awaiting" || o.status.startsWith("confirmed")) && !(o.progress || []).some((p) => p.step === "delivered" || p.step === "picked");
  if (chatOpen || (o.chat && o.chat.length)) {
    kids.push(h("details", { class: "info-list", open: !!(o.chat && o.chat.length) }, h("summary", { class: "row" }, icon("chat"), h("span", { class: "max" }, "Messages with the business" + (o.chat && o.chat.length ? " (" + o.chat.length + ")" : "")), icon("expand_more")),
      chatOpen ? chatBox(o.chat, "c", ["Where is my order?", "Please call me.", "I am at the gate."], async (text) => {
        try { await postSealed(o.order_topic, o.order_key, await customerUpdate(o, { t: "chat", text })); } catch (e) { snackbar("Could not send. Check your connection."); return; }
        o.chat = (o.chat || []).concat({ from: "c", text, at: new Date().toISOString() }); save(); viewOrders();
      }) : h("ul", { class: "list border" }, o.chat.map((m) => h("li", null, h("div", { class: "max" }, (m.from === "c" ? "You: " : "Business: ") + m.text))))));
  }
  const phoneOf = o.business_phone || ((restaurantById(o.restaurant_id) || {}).lite || {}).business_phone;
  if (phoneOf && o.status !== "cancelled" && o.status !== "expired") kids.push(h("nav", null, h("a", { href: "tel:" + phoneOf, class: "button border" }, icon("call"), h("span", null, "Call the business"))));
    if (o.restaurant_id && (o.items || []).length && o.status !== "awaiting") kids.push(h("nav", null, h("a", { class: "button border", href: "#/order?r=" + encodeURIComponent(o.restaurant_id) + "&items=" + o.items.map((i) => encodeURIComponent(i.key) + "*" + i.qty).join(",") + "&mode=" + (o.mode === "pickup" ? "pickup" : "delivery") + (o.mode !== "pickup" && o.zone ? "&zone=" + encodeURIComponent(o.zone) : "") }, icon("shopping_bag"), h("span", null, "Order again"))));
  const cancelOpen = !o.informal && (o.status === "awaiting" || (o.status.startsWith("confirmed") && Date.now() < deadline.getTime() && !(o.progress || []).some((p) => p.step === "out" || p.step === "delivered" || p.step === "picked")));
  const cancelButton = cancelOpen ? h("button", { type: "button", class: "border", on: { click: async () => {
    const ch = CHANNELS[o.channel];
    const how = ch && ch.direct ? "The cancellation is sent to the business automatically." : "Your messaging app opens with the cancellation filled in; send it in the same chat as the order.";
    if (!(await ask("Cancel order " + o.code + "?", "You can cancel within " + win + " minutes of ordering. " + how, "Cancel order"))) return;
    const text = "Hello, I'd like to cancel order " + o.code + ", please. Sorry for the trouble, and thank you.\nCANCEL " + o.code;
    if (o.channel === "hana" && o.order_topic) { try { await postSealed(o.order_topic, o.order_key, await customerUpdate(o, { t: "cancel", code: o.code })); snackbar("Cancellation sent to the business."); } catch (e) { snackbar("Could not send the cancellation. Check your connection and try again."); return; } }
    else if (ch && ch.direct) { try { await sendDirect(o.channel_id, text); snackbar("Cancellation sent to the business."); } catch (e) { copy(text); snackbar("Could not send it directly. The cancellation was copied; send it to the business."); } }
    else if (ch && o.channel_id) { if (!ch.prefill) copy(text); window.open(ch.link(o.channel_id, text, o.code), "_blank", "noopener"); }
    else copy(text);
    o.status = "cancelled";
    o.closed_at = new Date().toISOString();
    save();
    log("Cancelled order " + o.code + " for " + o.restaurant + ".");
    viewOrders();
  } } }, icon("close"), h("span", null, "Cancel order")) : null;
  if (o.informal && o.status === "awaiting") {
    /* Volunteer-entered listings: no codes or timers. The customer and the business arrange
       the order in their chat, and the customer notes the outcome here. */
    const ch = CHANNELS[o.channel];
    kids.push(h("p", { class: "small-text" }, "Arrange the details with " + o.restaurant + " in your chat. When it confirms, note it here."),
      h("nav", { class: "wrap" },
        h("button", { type: "button", on: { click: () => { Object.assign(o, { status: "confirmed_unsigned", confirmed_at: new Date().toISOString(), confirmation: "Confirmed in the chat" }); save(); viewOrders(); } } }, icon("check_circle"), h("span", null, "The business confirmed")),
        h("button", { type: "button", class: "border", on: { click: () => {
          const text = "Hello, I'd like to cancel my order, please. Sorry for the trouble, and thank you.";
          if (ch && o.channel_id && !ch.direct) { if (!ch.prefill) copy(text); window.open(ch.link(o.channel_id, text, o.code), "_blank", "noopener"); }
          Object.assign(o, { status: "cancelled", closed_at: new Date().toISOString() }); save(); viewOrders();
        } } }, icon("close"), h("span", null, "Cancel the order"))));
  } else if (o.status === "awaiting" || o.status === "expired") {
    const reply = h("textarea", { id: "reply-" + o.code, rows: 3, placeholder: " " });
    const left = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 60000));
    kids.push(
      o.status === "awaiting"
        ? h("p", { class: "small-text" }, "The business must confirm by " + clock(String(deadline.getHours()).padStart(2, "0") + ":" + String(deadline.getMinutes()).padStart(2, "0")) + " (" + left + (left === 1 ? " minute" : " minutes") + " left). If it does not, this order is cancelled automatically.")
        : h("p", { class: "small-text" }, "No confirmation arrived within " + win + " minutes, so this order was cancelled. If the business did confirm in time, paste its reply below. This record is removed after " + state.rules.draft_order_expiry_hours + " hours."),
      o.channel === "hana" ? h("p", { class: "small-text muted" }, "The business's reply arrives here by itself while Hana is open.") : textField("reply-" + o.code, "Business's reply", reply),
      h("nav", { class: "wrap" },
        o.channel === "hana" ? null : h("button", { type: "button", on: { click: async () => {
          const res = await readConfirmation(reply.value, o, o.public_key, win);
          if (res.error) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, res.error))); return; }
          o.status = res.status === "declined" ? "declined" : "confirmed_" + res.status;
          o.confirmation = res.line;
          o.eta = res.eta;
          o.confirmed_at = new Date().toISOString();
          if (res.minute) o.confirmed_minute = res.minute;
          save();
          log("Order " + o.code + ": " + STATUS_TEXT[o.status][0] + ".");
          viewOrders();
        } } }, icon("check_circle"), h("span", null, "Save the reply")),
        o.status === "awaiting" && o.channel !== "hana" ? h("button", { type: "button", class: "border", on: { click: reminder } }, icon("send"), h("span", null, "Send a reminder")) : null,
        o.status === "awaiting" ? cancelButton : null),
      out);
  } else if (o.status === "declined" || o.status === "cancelled") {
    kids.push(h("p", { class: "small-text muted" }, "This record is removed after " + state.rules.draft_order_expiry_hours + " hours."));
  } else {
    if (o.eta && o.eta !== "?") kids.push(h("p", { class: "small-text" }, "The business expects to deliver about " + o.eta + " minutes after confirming" + (o.confirmed_at ? ", around " + clockAt(new Date(new Date(o.confirmed_at).getTime() + Number(o.eta) * 60000)) : "") + "."));
    if (cancelButton) kids.push(h("nav", null, cancelButton));
    if (!o.demo) kids.push(h("details", { class: "gap-top" }, h("summary", { class: "link" }, "Problem with this order?"),
      h("p", null, "Hana does not resolve disputes. For a problem involving money, contact the Directorate of National Consumer Rights Protection (DNCRP) at 16121 within 30 days, and include the summary below with a screenshot of the chat."),
      o.status === "confirmed_unsigned" ? notice("info", h("p", { class: "flush" }, "This confirmation is not signed, so the chat screenshot is the main evidence.")) : null,
      h("pre", null, complaintText(o)),
      h("nav", { class: "gap-top" }, h("button", { type: "button", class: "border", on: { click: () => copy(complaintText(o)) } }, icon("content_copy"), h("span", null, "Copy summary")))));
  }
  return h("article", { class: "round border no-elevate" }, ...kids);
}

/* Businesses that publish signed confirmations to their own feed (for example a self-hosted
   ntfy topic) confirm orders without the customer doing anything. Only signed confirmations
   are accepted from a feed, so nobody else can confirm an order by posting to it. */
let feedTimer = null;
async function pollFeeds() {
  const orders = store.get("hana.orders", []);
  const win = Number(state.rules.confirmation_window_minutes) || 15;
  let changed = false;
  for (const o of orders.filter((x) => x.status === "awaiting" && x.feed && x.public_key)) {
    try {
      const since = Math.floor(new Date(o.window_start || o.created).getTime() / 1000) - 120;
      const r = await fetch(o.feed.replace(/\/$/, "") + "/json?poll=1&since=" + since, { cache: "no-store" });
      if (!r.ok) continue;
      for (const line of (await r.text()).split("\n")) {
        let msg = "";
        try { msg = (JSON.parse(line) || {}).message || ""; } catch (e) { continue; }
        if (msg.indexOf("O=" + o.code) < 0) continue;
        const res = await readConfirmation(msg, o, o.public_key, win);
        if (res.status === "signed") {
          Object.assign(o, { status: "confirmed_signed", confirmation: res.line, eta: res.eta, confirmed_at: new Date().toISOString(), confirmed_minute: res.minute });
          log("Order " + o.code + " confirmed automatically through the business's confirmation feed.");
          changed = true;
          break;
        }
      }
    } catch (e) { /* the feed is unreachable; try again later */ }
  }
  /* Orders sent in Hana: replies arrive sealed on the order's own topic. */
  let note = "";
  for (const o of orders.filter((x) => x.order_topic && x.order_key && (x.status === "awaiting" || x.status.startsWith("confirmed")))) {
    try {
      for (const m of await readSealed(o.order_topic, o.order_key, "24h")) {
        if (m.from !== "b" || (o.seen_msgs || []).includes(m.id)) continue;
        o.seen_msgs = (o.seen_msgs || []).concat(m.id).slice(-200);
        /* Only the business holds its listing key: an update without a valid signature did not come
           from it (anyone holding this order's key could have written it), so it is ignored. */
        let verified = false;
        for (const k of [o.public_key].concat(o.staff_keys || [])) { const v = await checkUpdate(k, o.code, m.body); if (v) { verified = true; break; } if (v === null) verified = null; }
        if (o.public_key && verified === false) { changed = true; continue; }
        const signed = verified ? m.body : null;
        if (m.t === "confirm" && o.status === "awaiting") {
          const res = await readConfirmation(m.line || "", o, o.public_key, win);
          if (!res.error) { Object.assign(o, { status: res.status === "declined" ? "declined" : "confirmed_" + res.status, confirmation: res.line, eta: res.eta, confirmed_at: new Date().toISOString(), confirmed_minute: res.minute }); note = "Your order was confirmed."; }
        } else if (m.t === "decline" && o.status === "awaiting") {
          Object.assign(o, { status: "declined", closed_at: new Date().toISOString() }); note = "The business declined your order.";
        } else if (m.t === "status") {
          o.progress = (o.progress || []).concat({ step: m.step, at: m.at, text: m.text || "", rider: m.rider || null, verified, signed }); note = "Order update: " + (m.text || m.step) + ".";
        } else if (m.t === "chat") {
          o.chat = (o.chat || []).concat({ from: "b", text: String(m.text || "").slice(0, 500), at: m.at, verified, signed }); note = "New message from the business.";
        } else continue;
        changed = true;
      }
    } catch (e) { /* offline; try again later */ }
  }
  if (changed) { store.set("hana.orders", orders); if (location.hash === "#/orders") viewOrders(); snackbar(note || "An order was confirmed."); }
}
function startFeedPolling() {
  clearInterval(feedTimer);
  feedTimer = setInterval(() => { if (document.visibilityState === "visible") pollFeeds(); }, 15000);
  pollFeeds();
}

function viewOrders() {
  expireOrders();
  const orders = store.get("hana.orders", []);
  if (demoAdvance(orders)) store.set("hana.orders", orders);
  ordersTicker();
  const placed = state.justPlaced;
  const nodes = [pageTitle("Orders"), placed && placed.nodes.length ? h("article", { class: "round border no-elevate" }, ...placed.nodes) : null, h("p", { class: "muted" }, "Orders are stored only on this phone. An order counts once the business confirms it within " + state.rules.confirmation_window_minutes + " minutes; otherwise it is cancelled automatically.")];
  if (!orders.length) nodes.push(h("p", { class: "muted" }, "No orders yet."));
  const PER = 10;
  const pages = Math.max(1, Math.ceil(orders.length / PER));
  state.ordersPage = Math.min(state.ordersPage || 0, pages - 1);
  for (const o of orders.slice(state.ordersPage * PER, state.ordersPage * PER + PER)) nodes.push(orderCard(o, orders));
  if (pages > 1) nodes.push(pager(state.ordersPage, pages, (n) => { state.ordersPage = n; viewOrders(); }));
  const entries = store.get("hana.log", []);
  nodes.push(sectionTitle("Activity on this phone"),
    entries.length ? h("details", null, h("summary", { class: "link" }, "Show the record (" + entries.length + ")"),
      h("ul", { class: "list" }, entries.map((e) => h("li", null, h("div", { class: "max" }, h("div", { class: "small-text muted" }, dateTime(e.at)), h("div", null, e.text)))))) :
      h("p", { class: "muted" }, "Nothing recorded yet."));
  show("orders", "Orders", ...nodes.filter(Boolean));
}

/* Adds orders and records from a downloaded copy. Nothing on this phone is overwritten or removed. */
function importData(fileInput) {
  const f = fileInput.files && fileInput.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const orders = store.get("hana.orders", []);
      const have = new Set(orders.map((o) => o.code));
      const added = (data.orders || []).filter((o) => o && o.code && !have.has(o.code));
      store.set("hana.orders", orders.concat(added));
      const entries = store.get("hana.log", []);
      const seen = new Set(entries.map((e) => e.at + e.text));
      store.set("hana.log", entries.concat((data.record || []).filter((e) => e && !seen.has(e.at + e.text))).sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, 500));
      log("Restored " + added.length + (added.length === 1 ? " order" : " orders") + " from a downloaded copy.");
      viewOrders();
      snackbar("Restored " + added.length + (added.length === 1 ? " order." : " orders."));
    } catch (e) { snackbar("This file is not a Hana download."); }
  };
  reader.readAsText(f);
}

function exportData() {
  const data = { exported: new Date().toISOString(), orders: store.get("hana.orders", []), record: store.get("hana.log", []), saved_details: store.get("hana.me", {}), area: state.area };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = h("a", { href: url, download: "hana-my-data.json" });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------------------------------------------------------- about */

function repoUrl() {
  const u = state.site.repo_url;
  if (u && u.indexOf("{{") === -1) return u;
  const m = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
  if (m) {
    const repo = location.pathname.split("/").filter(Boolean)[0];
    return "https://github.com/" + m[1] + (repo ? "/" + repo : "");
  }
  return null;
}

function viewAbout() {
  const repo = repoUrl();
  const link = (href, text) => href ? h("a", { class: "link", href, rel: "noopener" }, text) : text;
  show("about", "About",
    pageTitle("About Hana"),
    h("p", null, "Hana is the Chittagonian word for food. It is a free directory of restaurants and grocery stores in Chittagong and a tool for preparing orders."),
    h("p", null, "Built by ", link(state.site.company_url || "https://hamidyasir.com", "Hamid Yasir & Co."), " for the people of Chittagong. Managed by the ", link(repo, "Hana Community"), "."),
    sectionTitle("How it works"),
    h("p", null, "Hana lists restaurants and grocery stores and prepares your order message. You send the message yourself, from your own phone, through the app the business uses. The order counts once the business confirms it in the same chat. Hana does not take payments, prepare food or make deliveries."),
    sectionTitle("Rules for every listing"),
    h("ul", { class: "list border" }, [
      "Payment is on delivery only. You pay the business when you receive the order, or at pickup: in cash, by Bangla QR, by card on a POS terminal or by mobile wallet transfer, as the business accepts. No business may ask for payment in advance.",
      "Every price includes VAT and every other charge. The delivery fee is the only addition.",
      "Each business sets one fixed delivery fee for each area it serves, up to " + money(state.rules.max_delivery_fee) + ".",
      "Every business offers pickup, with no delivery fee, unless its listing says otherwise.",
      "Businesses confirm or decline each order within " + state.rules.confirmation_window_minutes + " minutes. Otherwise the order is cancelled automatically.",
      "Businesses keep all order communications for at least " + state.rules.record_retention_months + " months, or " + state.rules.record_retention_months_when_disputed + " months if there is a dispute.",
      "Claimed listings are checked by community members when claimed and reviewed regularly after that.",
    ].map((x) => h("li", null, icon("check_circle"), h("div", { class: "max" }, x)))),
    sectionTitle("For businesses"),
    h("p", null, "Listing is free. Use the business tools to add or claim your business, confirm orders and publish price changes. Two community members verify each claim."),
    h("nav", { class: "wrap" },
      h("a", { href: "business.html#/join", class: "button" }, icon("add_business"), h("span", null, "Add or claim your business")),
      h("a", { href: "business.html", class: "button border" }, icon("storefront"), h("span", null, "All business tools"))),
    sectionTitle("Why Hana exists"),
    h("p", null, "Large delivery platforms sit between restaurants and their customers. With that much market power, they set the fees and the terms, and neither side has much say. Hana is an alternative: it takes no commission and leaves the choices with customers and businesses. This is the reason the project exists; it is not an assessment of any particular company."),
    sectionTitle("Commitments"),
    h("ol", null, [
      "Hana charges no commission and no listing fee.",
      "There are no featured listings. Every list is alphabetical and the same for everyone.",
      "There is no exclusivity. A business can list elsewhere and leave at any time.",
      "Businesses set their own prices, fees, delivery areas and hours.",
      "Customers choose the business, how to order and what to share.",
      "There are no accounts, no tracking and no collection of customer data.",
      "Hana uses open-source code and open formats.",
      "The creator is credited on every page.",
      "Every price change is public, announced in the menu file and kept in its history.",
      "Each business sets one fixed delivery charge for each area. Hana adds no fees.",
      "Payment is on delivery only, and prices include all charges. Prepayment is never allowed.",
    ].map((x) => h("li", null, x))),
    sectionTitle("Privacy"),
    h("p", null, "Your area, basket, name, address and orders stay on this phone. Hana has no server. An order sent in Hana is encrypted on this phone so that only the business can read it; the relay service that carries it sees only encrypted text. You can download or delete all of it in Settings."),
    sectionTitle("Terms and disputes"),
    h("p", null, "Hana is a directory and an order-preparation tool. Each order is a contract between the customer and the business alone; Hamid Yasir & Co. and the Hana Community are not parties to it and do not handle payments, food or deliveries. Disputes are for the parties and the competent authorities, starting with the Directorate of National Consumer Rights Protection (16121)."),
    h("nav", null, h("a", { href: "#/terms", class: "button border" }, h("span", null, "Read the Terms of Use"))),
    sectionTitle("Get involved"),
    h("p", null, repo ? ["The code, the directory and every decision are public on the ", link(repo, "project page"), ". Report a problem or suggest a change there."] : "The project page is not linked on this host."),
    sectionTitle("Credits"),
    h("p", { class: "small-text muted" }, "Food icons: ", link("https://github.com/jdecked/twemoji", "Twemoji"), ", by Twitter, Inc. and contributors, licensed under CC BY 4.0. Interface icons: Material Symbols, by Google, Apache License 2.0. Styles: Beer CSS, MIT License."));
}

/* ---------------------------------------------------------------- terms */

async function viewTerms() {
  show("about", "Terms of Use", pageHeader("Terms of Use", "#/about"), h("p", { class: "muted" }, "Loading…"));
  try {
    show("about", "Terms of Use", ...renderMarkdown(await getText("TERMS.md")));
  } catch (e) {
    show("about", "Terms of Use", pageHeader("Terms of Use", "#/about"), notice("warn", h("p", { class: "flush" }, "The terms could not be loaded. They are also in TERMS.md on the project page.")));
  }
}

/* ---------------------------------------------------------------- settings */

const SWATCH_CLASS = { "#F7F5F2": "swatch-f7f5f2", "#40E0D0": "swatch-40e0d0", "#9A3412": "swatch-9a3412", "#0F766E": "swatch-0f766e", "#3730A3": "swatch-3730a3", "#15803D": "swatch-15803d",
  "#7E22CE": "swatch-7e22ce", "#FACC15": "swatch-facc15", "#FFFFFF": "swatch-ffffff", "#111827": "swatch-111827" };
/* Background colour and picture for the app icon, with a live preview. */
function iconPicker() {
  const preview = h("img", { class: "icon-preview", alt: "Preview of the app icon", width: 72, height: 72 });
  const set = (patch) => {
    store.set("hana.icon", Object.assign(iconChoice(), patch));
    applyIcon();
    draw();
  };
  const swatches = h("nav", { class: "wrap small-space", "aria-label": "Icon background" });
  const custom = h("input", { type: "color", id: "icon-colour", "aria-label": "Any colour", on: { input: (e) => set({ bg: e.target.value }) } });
  function draw() {
    const ch = iconChoice();
    drawIcon(144, 0.86, 32, ch).then((src) => { preview.src = src; }, () => { preview.src = "icon-192.png"; });
    custom.value = ch.bg;
    swatches.replaceChildren(...ICON_BGS.map(([c, name]) => h("button", { type: "button", class: "swatch " + SWATCH_CLASS[c], title: name, "aria-label": name,
      "aria-pressed": ch.bg.toUpperCase() === c ? "true" : "false", on: { click: () => set({ bg: c }) } })),
      h("label", { class: "swatch swatch-any", title: "Any colour" }, custom));
  }
  draw();
  return h("div", { class: "stack" },
    h("div", { class: "row" }, preview, h("p", { class: "small-text muted max" }, "Choose the background of the app icon. It is used in the browser tab and when you install Hana. If Hana is already installed, remove it and install it again to see the change.")),
    swatches,
    h("nav", null, h("button", { type: "button", class: "border", on: { click: () => { store.set("hana.icon", null); location.reload(); } } }, h("span", null, "Use the standard icon"))));
}

function viewSettings() {
  const st = settings();
  const radios = (name, options, value, onPick) => h("nav", { class: "vertical left-align" },
    Object.entries(options).map(([k, label]) => h("label", { class: "radio" },
      h("input", { type: "radio", name, value: k, checked: k === value, on: { change: () => onPick(k) } }), h("span", null, label))));
  const me = store.get("hana.me", { name: "", address: "" });
  const pname = h("input", { type: "text", id: "p-name", value: me.name || "", maxlength: 60, autocomplete: "off" });
  const paddr = h("textarea", { id: "p-address", rows: 3, maxlength: 300 }, me.address || "");
  const pictures = h("input", { type: "checkbox", id: "pictures", checked: st.pictures, on: { change: (e) => saveSettings(Object.assign(settings(), { pictures: e.target.checked })) } });
  show("settings", "Settings", pageHeader("Settings", "#/"),
    sectionTitle("Install the app"),
    isInstalled() ? h("p", null, "Hana is installed on this device.") : [
      h("p", { class: "small-text muted" }, "Install Hana to open it from your home screen or app list. It works offline and updates itself."),
      h("nav", null, h("button", { type: "button", on: { click: installApp } }, icon("download"), h("span", null, "Install Hana"))),
      h("p", { class: "small-text muted" }, "If nothing happens: " + installSteps())],
    h("p", { class: "muted" }, "Settings are kept on this device only."),
    sectionTitle("App icon"),
    iconPicker(),
    sectionTitle("Language"),
    radios("lang", { en: "English", bn: "বাংলা" }, language(), (k) => setLanguage(k)),
    sectionTitle("Colour scheme"),
    radios("scheme", SCHEMES, st.scheme, (k) => saveSettings(Object.assign(settings(), { scheme: k }))),
    sectionTitle("Light or dark"),
    radios("mode", { system: "Follow my phone", light: "Light", dark: "Dark" }, themeMode(), (k) => { try { localStorage.setItem("hana.theme", k); } catch (e) { /* ignore */ } applyTheme(); }),
    sectionTitle("Text size"),
    radios("text", TEXT_SIZES, st.text, (k) => saveSettings(Object.assign(settings(), { text: k }))),
    sectionTitle("Pictures"),
    h("div", { class: "row" }, h("label", { class: "switch" }, pictures, h("span")), h("label", { for: "pictures", class: "max" }, "Show pictures of food")),
    h("p", { class: "small-text muted" }, "Pictures come from the business. Listings without a cover show a stock photo for their cuisine from Wikimedia Commons, an openly licensed library; loading it lets Wikimedia see your network address, as any website you visit would. Food icons are Twemoji, by Twitter, Inc. and contributors, CC BY 4.0."),
    h("nav", { class: "gap-top" }, h("button", { type: "button", class: "border", on: { click: () => { try { localStorage.removeItem("hana.settings"); localStorage.removeItem("hana.theme"); } catch (e) { /* ignore */ } applyTheme(); viewSettings(); } } }, h("span", null, "Reset appearance"))),
    sectionTitle("Profile (optional)"),
    h("p", { class: "small-text muted" }, "Filled in at checkout so you do not have to type it each time. Kept on this phone only."),
    textField("p-name", "First name or nickname", pname),
    textField("p-address", "Address or landmark", paddr),
    zoneSelect("p-zone", state.area, (v) => { state.area = v; store.set("hana.area", v); }, "Not set", "Usual zone (thana)"),
    h("nav", { class: "wrap gap-top" },
      h("button", { type: "button", on: { click: () => { store.set("hana.me", { name: pname.value.trim(), address: paddr.value.trim() }); log("Profile saved."); snackbar("Profile saved."); } } }, h("span", null, "Save profile")),
      h("button", { type: "button", class: "border", on: { click: () => { store.set("hana.me", { name: "", address: "" }); pname.value = ""; paddr.value = ""; log("Profile cleared."); snackbar("Profile cleared."); } } }, h("span", null, "Clear profile"))),
    sectionTitle("Your data"),
    h("p", { class: "small-text muted" }, "Updates to Hana never touch your orders. Clearing your browser's site data does, so download a copy first if you need one."),
    h("nav", { class: "wrap" },
      h("button", { type: "button", class: "border", on: { click: exportData } }, icon("download"), h("span", null, "Download my data")),
      h("button", { type: "button", class: "border", on: { click: () => document.getElementById("restore-file").click() } }, icon("upload"), h("span", null, "Restore from a download")),
      h("input", { type: "file", id: "restore-file", accept: ".json,application/json", hidden: true, "aria-label": "Restore from a download", on: { change: (e) => importData(e.target) } }),
      h("button", { type: "button", class: "border", on: { click: async () => {
        if (await ask("Delete everything on this phone?", "This removes your orders, profile, record, area, basket and settings. It cannot be undone. Download your data first if you want a copy.", "Delete")) {
          for (const k of ["hana.orders", "hana.me", "hana.addresses", "hana.favourites", "hana.filters", "hana.basket", "hana.area", "hana.log", "hana.settings", "hana.theme"]) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
          state.basket = null; state.area = ""; applyTheme(); updateBasketBadge(); viewSettings(); snackbar("Deleted.");
        }
      } } }, icon("delete"), h("span", null, "Delete everything"))),
    sectionTitle("Download the directory"),
    h("p", { class: "small-text muted" }, "Choose which businesses and which details to include, as data (JSON) or as a printable book (PDF)."),
    h("nav", null, h("a", { href: "#/download", class: "button border" }, icon("download"), h("span", null, "Download the directory"))),
    sectionTitle("Offline copy"),
    h("p", { class: "small-text muted" }, "Download Hana as a single file. Open it from your phone's files at any time; it works without a connection and brings itself up to date whenever you are online."),
    h("nav", null, h("button", { type: "button", class: "border", on: { click: async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try { downloadText("hana-offline.html", await buildStandalone({ mode: "directory", site: state.site }), "text/html"); snackbar("Offline copy downloaded."); }
      catch (err) { snackbar("The offline copy could not be made: " + err.message); }
      btn.disabled = false;
    } } }, icon("download"), h("span", null, "Download offline copy"))),
    sectionTitle("Other regions"),
    h("p", { class: "small-text muted" }, "Hana may run in other cities, each as its own community-run directory. Your phone can check which one covers where you are. Your position is compared on this phone only and is never sent anywhere."),
    h("nav", null, h("button", { type: "button", class: "border", on: { click: findRegion } }, icon("location_on"), h("span", null, "Find the Hana for my area"))),
    h("div", { id: "region-out", "aria-live": "polite" }));
}

/* Matches the phone's position against regions.json on the phone itself (browser Geolocation only). */
function findRegion() {
  const out = document.getElementById("region-out");
  if (!navigator.geolocation) { out.replaceChildren(notice("info", h("p", { class: "flush" }, "This browser cannot read your position."))); return; }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    let regions = [];
    try { regions = (await fetchJson("regions.json")).regions || []; } catch (e) { /* none listed */ }
    const { latitude: lat, longitude: lon } = pos.coords;
    const hit = regions.find((r) => Array.isArray(r.bbox) && lon >= r.bbox[0] && lat >= r.bbox[1] && lon <= r.bbox[2] && lat <= r.bbox[3]);
    const here = new URL(".", document.baseURI).href;
    if (!hit) out.replaceChildren(notice("info", h("p", { class: "flush" }, "No Hana directory covers your position yet. ADOPTING.md explains how a community can start one.")));
    else if (!/^https:\/\//.test(hit.url) || hit.url === here) out.replaceChildren(notice("info", h("p", { class: "flush" }, "You are in the " + hit.name + " area, which this directory covers.")));
    else out.replaceChildren(notice("info", h("p", { class: "flush" }, "You are in the " + hit.name + " area. "), h("a", { class: "link", href: hit.url, rel: "noopener" }, "Open Hana " + hit.name)));
  }, () => out.replaceChildren(notice("info", h("p", { class: "flush" }, "Your position was not shared, so nothing was checked."))), { timeout: 15000, maximumAge: 600000 });
}

/* ---------------------------------------------------------------- directory downloads */

function hoursSummary(hours) {
  if (!hours) return "Hours not stated";
  const groups = [];
  for (const d of DAYS) {
    const t = hoursText(hours[d]);
    const last = groups[groups.length - 1];
    if (last && last.t === t) last.to = d; else groups.push({ from: d, to: d, t });
  }
  return groups.map((g) => DAY_NAMES[g.from].slice(0, 3) + (g.to !== g.from ? " to " + DAY_NAMES[g.to].slice(0, 3) : "") + ": " + g.t).join("; ");
}

/* What a directory download contains. Name, type and zone are always included. */
const DL_PARTS = [["contact", "Phone, ordering apps and web address"], ["address", "Address"], ["cuisine", "Cuisine"],
  ["hours", "Opening hours"], ["delivery", "Delivery areas, fees and minimum orders"], ["menu", "Menu or products, with prices"]];
const DL_PRESETS = [["Names and phone numbers", ["contact"]], ["Contact details and hours", ["contact", "address", "cuisine", "hours"]], ["Everything", DL_PARTS.map((p) => p[0])]];

function downloadOptions() {
  return Object.assign({ format: "pdf", type: "all", zone: "", cat: "", parts: ["contact", "address", "cuisine", "hours", "delivery", "menu"] }, store.get("hana.download", {}));
}

function chosenListings(o) {
  return state.restaurants.filter((r) => {
    const m = r.lite;
    if (o.type !== "all" && (o.type === "grocery") !== isGrocery(m)) return false;
    if (o.zone && !zoneFor(m, o.zone)) return false;
    if (o.cat && !(r.cats && r.cats.has(o.cat))) return false;
    return true;
  });
}

/* One listing as plain data, with only the parts asked for. */
function listingRecord(r, parts) {
  const m = r.menu || r.lite, has = (p) => parts.includes(p);
  const out = { id: r.id, name: m.name, handle: m.handle || undefined, kind: m.kind || "Restaurant", type: isGrocery(m) ? "grocery" : "food", zone: locatedIn(m), claimed: m.claimed !== false };
  if (has("contact")) Object.assign(out, { business_phone: m.business_phone, contact: m.contact || [], url: listingUrl(m) || undefined });
  if (has("address")) out.address = m.address;
  if (has("cuisine")) out.cuisine = (FOOD_BY_KEY[cuisineKey(m)] || [0, null])[1];
  if (has("hours")) Object.assign(out, { hours: m.hours || null, hours_text: hoursSummary(m.hours), scheduled_orders: m.scheduled_orders === true });
  if (has("delivery")) Object.assign(out, { pickup: m.pickup !== false, delivery: ((m.delivery && m.delivery.zones) || []).map((z) => ({ id: z.id, areas: zoneLabel(z), fee: z.fee, min_order: z.min_order, eta_min: z.eta_min })) });
  if (has("menu") && r.menu) out.items = priceLines(m).map((l) => ({ key: l.key, name: l.item.name, option: l.option || undefined, section: l.item.section, category: l.item.category, price: l.price }));
  return out;
}

function directoryData(o) {
  o = o || downloadOptions();
  return {
    format: "hana-directory-1",
    region: "Chittagong",
    generated: new Date().toISOString(),
    source: new URL(".", document.baseURI).href,
    selection: { type: o.type, delivers_to_zone: o.zone || null, category: o.cat || null, parts: o.parts },
    how_to_order: "See AGENTS.md in the project repository. Orders are messages sent by the customer; payment is on delivery or at pickup only.",
    rules: { prices_include_all_charges: true, prepayment_allowed: false, max_delivery_fee: state.rules.max_delivery_fee, confirmation_window_minutes: state.rules.confirmation_window_minutes },
    listings: chosenListings(o).map((r) => listingRecord(r, o.parts)),
  };
}

async function downloadPhoneBook(o) {
  o = o || downloadOptions();
  try {
    if (typeof makePhoneBookPdf !== "function") {
      await new Promise((res, rej) => { const sc = h("script", { src: "phonebook.js" }); sc.onload = res; sc.onerror = () => rej(new Error("the PDF maker could not be loaded")); document.head.append(sc); });
    }
    const has = (p) => o.parts.includes(p);
    const today = longDate(new Date().toISOString().slice(0, 10));
    if (has("menu")) await ensureMenus(chosenListings(o));
    const entries = chosenListings(o).map((r) => {
      const m = r.menu || r.lite;
      const lines = [{ text: (m.handle ? "@" + m.handle + " · " : "") + (m.kind || "Restaurant") + " · " + locatedIn(m) + (has("cuisine") && FOOD_BY_KEY[cuisineKey(m)] ? " · " + FOOD_BY_KEY[cuisineKey(m)][1] : "") }];
      if (has("contact")) {
        lines.push({ text: "Phone: " + m.business_phone, weight: "bold" });
        for (const c of m.contact || []) lines.push({ text: (CHANNELS[c.app] ? CHANNELS[c.app].label : c.app) + ": " + contactText(c.app, c.id) + (c.preferred ? " (preferred)" : "") });
        if (listingUrl(m)) lines.push({ text: listingUrl(m) });
      }
      if (has("address") && m.address) lines.push({ text: m.address });
      if (has("hours")) lines.push({ text: hoursSummary(m.hours) });
      if (has("delivery")) {
        for (const z of (m.delivery && m.delivery.zones) || []) lines.push({ text: "Delivery to " + zoneLabel(z) + ". " + feeSummary(z) });
        lines.push({ text: (m.pickup !== false ? "Pickup is available. " : "Pickup is not offered. ") + "Pay on delivery or at pickup: " + paymentText(m) + "." });
      }
      if (m.claimed === false) lines.push({ text: "Not confirmed by the business." + (has("menu") ? " Prices are as printed and may have changed." : ""), weight: "italic" });
      const secs = new Map();
      if (has("menu") && r.menu) for (const l of priceLines(m)) {
        const sec = l.item.section || "Menu";
        if (!secs.has(sec)) secs.set(sec, []);
        secs.get(sec).push({ name: l.option ? l.item.name + ", " + l.option : l.item.name, price: priceOrAsk(l.price) });
      }
      return { name: m.name, letter: norm(m.name).charAt(0).toUpperCase() || "#", lines, sections: Array.from(secs, ([name, items]) => ({ name, items })) };
    });
    if (!entries.length) { snackbar("No business matches these choices."); return; }
    const scope = [o.type === "grocery" ? "Grocery stores" : o.type === "food" ? "Restaurants" : "Food and groceries",
      o.zone ? "delivering to " + areaName(o.zone) : "", o.cat && FOOD_BY_KEY[o.cat] ? "(" + FOOD_BY_KEY[o.cat][1] + ")" : ""].filter(Boolean).join(" ");
    const pdf = makePhoneBookPdf({
      title: "Hana Directory", subtitle: scope + " in Chittagong", generated: "Printed " + today,
      intro: [
        "Listings are in alphabetical order. No listing is featured or paid for. Prices include VAT and every other charge; the delivery fee is the only addition, and it is never more than " + money(state.rules.max_delivery_fee) + ".",
        "To order, send your order in writing to the business. Pay on delivery or at pickup only, and never in advance. The business must confirm within " + state.rules.confirmation_window_minutes + " minutes; otherwise, the order is cancelled. The live directory, with current prices, is at " + new URL(".", document.baseURI).href + ".",
      ],
      entries,
    });
    const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
    const a = h("a", { href: url, download: "hana-directory.pdf" });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    snackbar("Directory downloaded as a PDF book.");
  } catch (e) { snackbar("The PDF could not be made: " + e.message); }
}

function viewDownload() {
  availableCategories();
  const o = downloadOptions();
  const radios = (name, list, value) => h("nav", { class: "vertical left-align" }, list.map(([v, t]) =>
    h("label", { class: "radio" }, h("input", { type: "radio", name, value: v, checked: v === value }), h("span", null, t))));
  const partBoxes = DL_PARTS.map(([k, t]) => h("label", { class: "checkbox" }, h("input", { type: "checkbox", name: "part", value: k, checked: o.parts.includes(k) }), h("span", null, t)));
  const cats = FOOD.concat(GROCERY.filter((g) => !FOOD.some((f) => f[0] === g[0])));
  const count = h("p", { class: "small-text muted" });
  const read = () => {
    const q = (sel) => (document.querySelector(sel) || {}).value || "";
    return { format: q('input[name="dl-format"]:checked'), type: q('input[name="dl-type"]:checked'), zone: q("#dl-zone"), cat: q("#dl-cat"),
      parts: Array.from(document.querySelectorAll('input[name="part"]:checked')).map((x) => x.value) };
  };
  const update = () => { const n = chosenListings(read()).length; count.textContent = n + (n === 1 ? " business matches." : " businesses match."); };
  show("settings", "Download the directory", pageHeader("Download the directory", "#/settings"),
    h("p", { class: "muted" }, "Choose the businesses and the details you want. Every file lists businesses alphabetically, with their name, type and zone."),
    sectionTitle("Format"),
    radios("dl-format", [["pdf", "PDF, laid out like a telephone book, for printing"], ["json", "JSON, for spreadsheets, programs and AI assistants"]], o.format),
    sectionTitle("Which businesses"),
    radios("dl-type", [["all", "All"], ["food", "Restaurants only"], ["grocery", "Grocery stores only"]], o.type),
    zoneSelect("dl-zone", o.zone, () => update(), "Any zone", "Delivers to"),
    selectField("dl-cat", "Category", h("select", { id: "dl-cat" }, [h("option", { value: "" }, "Any category")].concat(cats.map((f) => h("option", { value: f[0], selected: f[0] === o.cat }, f[1]))))),
    count,
    sectionTitle("Details to include"),
    h("nav", { class: "wrap small-space" }, DL_PRESETS.map(([t, parts]) => h("button", { type: "button", class: "chip small border", on: { click: () => {
      for (const b of document.querySelectorAll('input[name="part"]')) b.checked = parts.includes(b.value);
    } } }, t))),
    h("nav", { class: "vertical left-align" }, partBoxes),
    h("nav", { class: "gap-top" }, h("button", { type: "button", class: "responsive", on: { click: async () => {
      const n = read();
      store.set("hana.download", n);
      if (n.format === "json") {
        if (n.parts.includes("menu")) { snackbar("Loading menus…"); await ensureMenus(chosenListings(n)); }
        const data = directoryData(n);
        if (!data.listings.length) { snackbar("No business matches these choices."); return; }
        downloadText("hana-directory.json", JSON.stringify(data, null, 2), "application/json");
        snackbar("Directory downloaded as JSON.");
      } else await downloadPhoneBook(n);
    } } }, icon("download"), h("span", null, "Download"))));
  for (const el of main.querySelectorAll("input, select")) el.addEventListener("change", update);
  update();
}

function downloadText(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type: type || "text/plain" }));
  const a = h("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------------------------------------------------------- routing and start-up */

function route() {
  trackPage();
  if (!state.loaded) {
    return show("list", "", pageTitle("Hana"), state.loadError ? notice("warn", h("p", { class: "flush" }, state.loadError)) : h("p", { class: "muted" }, "Loading the directory…"));
  }
  const hash = location.hash || "#/";
  if (hash.startsWith("#/order?")) return openOrderLink(hash.slice(8));
  const hm = hash.match(/^#\/@([a-z0-9]{3,30})$/);
  if (hm) { const r = state.restaurants.find((x) => x.lite.handle === hm[1]); return r ? viewRestaurant(r.id) : show("list", "Not found", pageHeader("No listing is called @" + hm[1], "#/")); }
  const own = document.querySelector('meta[name="hana-listing"]');
  if (own && (hash === "#/" || hash === "")) return viewRestaurant(own.content);
  if (hash === "#/download") return viewDownload();
  const m = hash.match(/^#\/r\/([0-9a-f]{64})$/);
  if (m) return viewRestaurant(m[1]);
  if (hash === "#/basket") return viewBasket();
  if (hash === "#/orders") return viewOrders();
  if (hash === "#/about") return viewAbout();
  if (hash === "#/terms") return viewTerms();
  if (hash === "#/settings") return viewSettings();
  if (state.site.mode === "business" && state.site.listing_id) return viewRestaurant(state.site.listing_id);
  return viewList();
}

/* A prepared order link, for example from an AI assistant:
   #/order?r=<listing id>&items=<item key>*<quantity>,...&mode=delivery|pickup&zone=<zone id>&note=<text>
   It fills the basket and opens checkout. The customer still checks it, adds their details and sends it. */
async function openOrderLink(query) {
  const p = new URLSearchParams(query);
  const r = restaurantById(p.get("r") || "");
  await ensureMenu(r);
  if (!r || !r.menu) { snackbar("That order link names a listing that is not in the directory."); location.replace("#/"); return; }
  const valid = new Set(priceLines(r.menu).map((l) => l.key));
  const lines = {};
  for (const part of (p.get("items") || "").split(",")) {
    const m = /^([a-z0-9.-]+)\*(\d{1,2})$/.exec(part.trim());
    if (m && valid.has(m[1]) && Number(m[2]) >= 1) lines[m[1]] = Math.min(99, Number(m[2]));
  }
  if (!Object.keys(lines).length) { snackbar("That order link has no items from this menu."); location.replace("#/r/" + r.id); return; }
  if (state.basket && state.basket.rid !== r.id && basketCount() > 0 &&
    !(await ask("Replace your basket?", "Your basket contains items from another business. Replace them with the items in this link?", "Replace"))) { location.replace("#/basket"); return; }
  const zone = p.get("zone") || state.area || "";
  state.basket = { rid: r.id, version: r.menu.version, mode: p.get("mode") === "pickup" ? "pickup" : "delivery", zone: state.areaById.has(zone) ? zone : "", ward: "", lines, note: (p.get("note") || "").slice(0, 200) };
  saveBasket();
  snackbar("Order prepared. Check it, add your details and send it.");
  location.replace("#/basket");
}

function fixFooterLink() {
  const a = document.getElementById("repo-link");
  const u = repoUrl();
  a.setAttribute("href", u || "#/about");
  /* A business's own site carries the Hana credit and a link to the full directory. */
  if (state.site.mode === "business") {
    const main = state.site.main_app_url || "https://hmdrysr.github.io/hana/";
    const p = document.querySelector("footer p");
    p.replaceChildren("Created using ", h("a", { class: "link", href: main, rel: "noopener" }, "Hana"), " by ",
      h("a", { class: "link", href: "https://hamidyasir.com", rel: "noopener" }, "Hamid Yasir & Co."), " ",
      h("a", { class: "link", href: "#/terms" }, "Terms"), " ", h("a", { class: "link", href: main, rel: "noopener" }, "All businesses on Hana"));
    for (const n of document.querySelectorAll('[data-nav="list"] span')) n.textContent = "Menu";
  }
}

for (const i of document.querySelectorAll("i[data-icon]")) i.replaceWith(icon(i.getAttribute("data-icon")));
window.addEventListener("hashchange", () => { if (location.hash !== "#/orders") state.justPlaced = null; });
window.addEventListener("hashchange", route);
updateBasketBadge();
route();
loadAll().then(() => { expireOrders(); fixFooterLink(); updateBasketBadge(); route(); startFeedPolling(); });

applyIcon();
if (!SNAP) setupUpdates(["index.html", "core.js", "app.js", "theme/theme.css"]);
