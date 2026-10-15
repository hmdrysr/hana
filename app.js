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
  page: 0,
  basket: store.get("hana.basket", null),
};

async function loadAll() {
  try {
    /* All four files load at once rather than one after another. */
    const [site, rules, areas, index] = await Promise.all([
      fetchJson("site.json").catch(() => ({})), fetchJson("rules.json").catch(() => ({})), fetchJson("areas.json"), fetchJson("index.json")]);
    Object.assign(state.site, site);
    Object.assign(state.rules, rules);
    if (SNAP) Object.assign(state.site, SNAP.site);
    if (Array.isArray(state.rules.image_hosts)) IMAGE_HOSTS = state.rules.image_hosts.slice();
    state.areas = areas.areas || [];
    state.areaById = new Map(state.areas.map((a) => [a.id, a]));
    const a = state.areaById.get(state.area);
    if (state.area && (!a || a.kind !== "zone")) { state.area = ""; store.set("hana.area", ""); }
    const seen = store.get("hana.seen", {});
    state.restaurants = await Promise.all((index.restaurants || []).map(async (row) => {
      const out = { id: row.id, name: row.name, menu: null, raw: null, problem: "" };
      for (const loc of row.locations || []) {
        try {
          const bytes = await fetchBytes(loc);
          const hash = await sha256Hex(bytes);
          if (hash !== row.menu_hash) { out.problem = "The menu file does not match the directory record, so it is not trusted."; continue; }
          const text = new TextDecoder("utf-8").decode(bytes);
          out.menu = JSON.parse(text);
          out.raw = text;
          out.hash = hash;
          out.problem = "";
          break;
        } catch (e) { out.problem = "The menu could not be loaded."; }
      }
      if (out.menu && seen[out.id] && out.menu.version < seen[out.id]) {
        out.problem = "This menu is older than one this phone has already seen (version " + out.menu.version + " after version " + seen[out.id] + "), so it is not trusted.";
        out.menu = null;
      } else if (out.menu) {
        seen[out.id] = Math.max(seen[out.id] || 0, out.menu.version);
      }
      return out;
    }));
    store.set("hana.seen", seen);
    state.restaurants.sort((a, b) => norm(a.name).localeCompare(norm(b.name), "en"));
    state.loaded = true;
  } catch (e) {
    state.loadError = "The directory could not be loaded. " + e.message;
  }
}

function restaurantById(id) { return state.restaurants.find((r) => r.id === id); }

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
  document.title = title ? title + " | Hana" : "Hana: Food in Chittagong";
}

function statusChip(menu) {
  const o = openNow(menu.hours);
  if (o === null) return chip("Hours not stated");
  return o ? chip("Open now", "ok") : chip("Closed now");
}

function feeSummary(z) {
  if (!z) return "Choose your area to see delivery details";
  const fee = z.fee === null || z.fee === undefined ? "Delivery fee not stated" : "Delivery " + money(z.fee);
  const min = z.min_order === null || z.min_order === undefined ? "minimum order not stated" : "minimum order " + money(z.min_order);
  const eta = z.eta_min === null || z.eta_min === undefined ? "delivery time not stated" : "about " + z.eta_min + " min";
  return fee + " · " + min + " · " + eta;
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

/* Categories that at least one listed restaurant offers, with how many restaurants offer each. */
function availableCategories() {
  const count = {};
  for (const r of state.restaurants) {
    if (!r.menu) continue;
    const keys = new Set((r.menu.items || []).map(itemCat).filter(Boolean));
    const c = cuisineKey(r.menu);
    if (c) keys.add(c);
    r.cats = keys;
    for (const k of keys) count[k] = (count[k] || 0) + 1;
  }
  return FOOD.filter((f) => count[f[0]]).map((f) => ({ key: f[0], label: f[1], count: count[f[0]] }));
}

function viewList() {
  const cats = availableCategories();
  const results = h("div", { id: "results", "aria-live": "polite" });
  const strip = h("nav", { class: "cat-strip", "aria-label": "Categories" });
  const search = h("input", {
    type: "search", id: "q", placeholder: "Search food or restaurants", autocomplete: "off", value: state.query,
    "aria-label": "Search restaurants, dishes or categories",
    on: {
      input: (e) => { state.query = e.target.value; state.page = 0; state.allDishes = false; render(); },
      focus: () => { state.searching = true; render(); },
      blur: () => setTimeout(() => { state.searching = false; render(); }, 200),
      keydown: (e) => { if (e.key === "Escape") { search.value = state.query = ""; search.blur(); } },
    },
  });
  const showAll = h("input", { type: "checkbox", id: "showall", checked: state.showAll, on: { change: (e) => { state.showAll = e.target.checked; render(); } } });

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
      h("span", { class: "small-text muted" }, c.count + (c.count === 1 ? " restaurant" : " restaurants"))))));

  function render() {
    strip.hidden = !!(norm(state.query) || state.searching);
    const FEW = 8;
    const visible = state.moreCats || cats.length <= FEW + 1 ? cats : cats.slice(0, FEW).concat(cats.filter((c, i) => i >= FEW && c.key === state.cat));
    strip.replaceChildren(...visible.map((c) => h("button", {
      type: "button", class: "cat-tile", "aria-pressed": state.cat === c.key ? "true" : "false",
      on: { click: () => pickCategory(c.key) } }, foodIcon(c.key, "large"), h("span", null, c.label))),
      visible.length < cats.length ? h("button", { type: "button", class: "cat-tile", on: { click: () => { state.moreCats = true; render(); } } }, foodIcon("plate", "large"), h("span", null, "More")) : null);
    const q = norm(state.query);
    const kids = [];
    if (!q && state.searching) {
      results.replaceChildren(sectionTitle("Top categories"), catRows(cats));
      return;
    }
    if (q) {
      const matchCats = cats.filter((c) => fuzzyMatches(state.query, c.label));
      if (matchCats.length) kids.push(sectionTitle("Categories"), catRows(matchCats));
    }
    const cards = [], dishes = [];
    let hidden = 0;
    for (const r of state.restaurants) {
      const m = r.menu;
      const zone = m ? zoneFor(m, state.area) : null;
      const delivers = !state.area || !m || !!zone;
      if (!delivers && !state.showAll) { hidden++; continue; }
      if (state.cat && !(r.cats && r.cats.has(state.cat))) continue;
      const nameHit = fuzzyMatches(state.query, r.name + " " + (m ? m.kind || "" : ""));
      const hits = m && q ? (m.items || []).filter((it) => fuzzyMatches(state.query, it.name + " " + (it.category || "") + " " + (it.section || ""))) : [];
      if (q && !nameHit && !hits.length) continue;
      if (q) cards.push(restaurantCard(r, zone, delivers, []));
      else cards.push(restaurantCard(r, zone, delivers, state.cat && m ? (m.items || []).filter((it) => itemCat(it) === state.cat) : []));
      for (const it of hits) dishes.push({ r, it });
    }
    if (state.cat) {
      kids.push(h("nav", { class: "wrap small-space" }, h("button", { type: "button", class: "chip small", "aria-label": "Clear the category filter",
        on: { click: () => pickCategory(state.cat) } }, foodIcon(state.cat), h("span", null, FOOD_BY_KEY[state.cat][1]), icon("close"))));
    }
    if (q && cards.length) kids.push(sectionTitle("Restaurants"));
    const PER = 12;
    const pages = Math.max(1, Math.ceil(cards.length / PER));
    if (state.page >= pages) state.page = pages - 1;
    kids.push(...cards.slice(state.page * PER, state.page * PER + PER));
    if (pages > 1) kids.push(pager(state.page, pages, (n) => { state.page = n; render(); results.scrollIntoView({ block: "start" }); }));
    if (q && dishes.length) {
      const shown = state.allDishes ? dishes : dishes.slice(0, 8);
      kids.push(sectionTitle("Dishes"), h("ul", { class: "list border" }, shown.map(({ r, it }) => h("li", null,
        foodIcon(itemCat(it) || "plate", "large"),
        h("a", { href: "#/r/" + r.id, class: "max" }, h("div", null, it.name), h("div", { class: "small-text muted" }, r.name)),
        h("span", { class: "price" }, fromPrice(it))))));
      if (dishes.length > shown.length) kids.push(h("button", { type: "button", class: "border gap-top", on: { click: () => { state.allDishes = true; render(); } } }, "Show all " + dishes.length + " dishes"));
    }
    if (!cards.length && !dishes.length) kids.push(h("p", { class: "muted" }, state.restaurants.length ? "Nothing matches. Try a shorter search, another category or another zone." : "No restaurants are listed yet."));
    if (state.area && hidden) {
      kids.push(h("p", { class: "small-text muted" }, hidden + (hidden === 1 ? " restaurant does" : " restaurants do") + " not deliver to " + areaName(state.area) + " and " + (hidden === 1 ? "is" : "are") + " hidden."));
    }
    results.replaceChildren(...kids);
  }

  show("list", "",
    pageTitle("Restaurants in Chittagong"),
    h("p", { class: "muted" }, "Listed alphabetically. No listing is featured or paid for."),
    zoneSelect("area", state.area, (v) => { state.area = v; state.page = 0; store.set("hana.area", v); render(); }, "Choose your zone"),
    h("div", { class: "field prefix round fill" }, icon("search"), search),
    strip,
    h("div", { class: "row" }, h("label", { class: "switch" }, showAll, h("span")), h("label", { for: "showall", class: "max" }, "Include restaurants that do not deliver to my zone")),
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
  return it.price !== undefined ? money(it.price) : "from " + money(Math.min(...it.options.map((o) => o.price)));
}

function restaurantCard(r, zone, delivers, dishHits) {
  const m = r.menu;
  if (!m) {
    return h("article", { class: "round border no-elevate" }, h("h2", { class: "card-title" }, r.name), h("p", { class: "muted" }, r.problem || "This menu is not available."));
  }
  const chips = [statusChip(m)];
  if (m.claimed === false) chips.push(chip("Not confirmed by the business", "warn"));
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
      h("div", { class: "max" }, op.label), h("span", { class: "price" }, money(op.price)),
      h("button", { type: "button", class: "circle", "aria-label": "Add " + it.name + ", " + op.label + ", " + money(op.price),
        on: { click: () => { d.close(); addToBasket(r, it.id + "." + op.id, it.name + " (" + op.label + ")"); } } }, icon("add"))))),
    h("nav", { class: "right-align" }, h("button", { type: "button", class: "border", on: { click: () => d.close() } }, "Cancel")));
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  if (d.showModal) d.showModal(); else d.setAttribute("open", "");
}

function dishRow(r, it, canOrder) {
  const add = () => {
    if (!canOrder) return;
    if (it.options) chooseOption(r, it); else addToBasket(r, it.id, it.name);
  };
  return h("li", { class: "dish", on: { click: add } },
    h("div", { class: "max dish-text" },
      h("div", { class: "bold" }, it.name),
      it.description ? h("div", { class: "small-text muted" }, it.description) : null,
      h("div", { class: "price" }, fromPrice(it))),
    h("div", { class: "dish-side" },
      settings().pictures ? itemPicture(it) : null,
      h("button", { type: "button", class: "circle dish-add", disabled: !canOrder,
        "aria-label": "Add " + it.name + (it.options ? ", choose an option" : ", " + money(it.price)) }, icon("add"))));
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
  if (!r) return show("list", "Not found", pageHeader("Restaurant not found", "#/"), h("p", null, h("a", { class: "link", href: "#/" }, "All restaurants")));
  const m = r.menu;
  if (!m) return show("list", r.name, pageHeader(r.name, "#/"), notice("warn", r.problem || "This menu is not available."));
  const os = orderingState(m);
  const myZone = state.area ? zoneFor(m, state.area) : onlyZone(m);
  const cover = coverFor(m);

  const chips = [os.closed && os.next ? chip("Closed · opens " + whenText(os.next)) : statusChip(m)];
  if (m.claimed === false) chips.push(chip("Not confirmed by the business", "warn"));
  if (state.area && !zoneFor(m, state.area)) chips.push(chip("Does not list delivery to " + areaName(state.area), "warn"));
  const nodes = [
    pageHeader(m.name, "#/"),
    h("figure", { class: "flush hero" }, picture(cover, "cover", "", cuisineKey(m)), cover ? h("figcaption", { class: "credit" }, cover.page ? h("a", { href: cover.page, class: "link", rel: "noopener", target: "_blank" }, cover.credit) : cover.credit) : null),
    h("p", { class: "muted flush" }, (m.kind || "Restaurant") + " · " + locatedIn(m)),
    h("nav", { class: "wrap small-space" }, chips),
    h("p", { class: "small-text muted flush" }, feeSummary(myZone) + (m.pickup === true ? " · Pickup available" : "") +
      ". Pay on delivery or at pickup; never in advance." + (os.closed && os.canOrder ? " You can schedule an order for when it opens." : "")),
  ];
  nodes.push(restaurantInfo(m));

  const sections = new Map();
  for (const it of m.items || []) {
    const sec = it.section || "Menu";
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec).push(it);
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
  show("list", m.name, ...nodes);
  updateBasketBar();
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
    h("p", { class: "small-text muted" }, "The business sets one fixed delivery charge for each area, up to the Hana limit of " + money(state.rules.max_delivery_fee) + ". Hana adds no fees. Pickup: " + (m.pickup === true ? "available" : m.pickup === false ? "not offered" : "not stated; ask the business") + "."));
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
  kids.push(h("p", { class: "small-text muted" }, "Prices from version " + m.version + ", published " + longDate(m.announcement && m.announcement.published) + ". Open now is based on your phone's clock."));
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

async function buildOrder(r, f) {
  const menu = r.menu;
  const prices = {};
  for (const l of priceLines(menu)) prices[l.key] = l;
  const keys = Object.keys(state.basket.lines).filter((k) => prices[k]).sort();
  let sub = 0;
  const parts = [], text = [];
  for (const k of keys) {
    const q = state.basket.lines[k];
    sub += prices[k].price * q;
    parts.push(k + "*" + q);
    text.push(q + " × " + prices[k].label + ": " + money(prices[k].price * q));
  }
  const pickup = f.mode === "pickup";
  const zone = pickup ? null : f.deliveryZone;
  const fee = pickup ? 0 : (zone && zone.fee !== null && zone.fee !== undefined ? zone.fee : null);
  const feeStr = fee === null ? "?" : String(fee);
  const zoneId = pickup ? "pickup" : zone.id;
  const items = parts.join(",");
  const code = newCode();
  const check = "CHECK hana1 H=" + r.hash.slice(0, 12) + " Z=" + zoneId + " I=" + items + " S=" + sub + " F=" + feeStr + " C=" + await checkCode(r.hash, zoneId, items, sub, feeStr);
  const where = pickup ? ["Pickup: I will collect the order"] :
    ["Delivery to: " + f.address, "Zone: " + areaName(f.zone) + (f.ward ? ", " + areaName(f.ward) : "")];
  const lines = ["Order " + code + " (sent with Hana)", "To: " + menu.name,
    f.scheduled ? "Scheduled for: " + longDate(f.scheduled.slice(0, 10)) + ", " + clock(f.scheduled.slice(11, 16)) : null, "", ...text, "",
    "Items: " + money(sub),
    pickup ? "Pickup: no delivery fee" : (fee === null ? "Delivery fee: not stated; please confirm" : "Delivery fee: " + money(fee)),
    fee === null ? null : "Total: " + money(sub + fee),
    "Payment: cash on delivery" + (pickup ? " (at pickup)" : "") + ". I will not pay in advance.", "",
    "Name: " + f.name, ...where,
    f.note ? "Note: " + f.note : null, "",
    "To confirm, reply: CONFIRMED " + code, "", check].filter((l) => l !== null);
  const message = lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  return { code, message, check, sub, fee, keys, zoneId, prices };
}

/* Ordering channels at checkout: an order is a written message, so a phone number is offered as a text message, never as a call. */
function orderChannels(menu) {
  const out = [];
  const seen = new Set();
  for (const c of menu.contact || []) {
    const app = c.app === "phone" ? "sms" : c.app;
    if (!CHANNELS[app]) continue;
    const id = CHANNEL_IDS_ARE_PHONES.includes(app) ? String(c.id).replace(/^\+/, "") : String(c.id);
    const k = app + ":" + id;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ app, id, preferred: !!c.preferred });
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
      h("nav", null, h("a", { href: "#/", class: "button" }, icon("storefront"), h("span", null, "Browse restaurants"))));
  }
  const r = restaurantById(state.basket.rid);
  if (!r || !r.menu) {
    return show("basket", "Basket", pageTitle("Basket"), notice("warn", h("p", { class: "flush" }, "The restaurant for this basket is not available. " + (r && r.problem ? r.problem : ""))),
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
  if (menu.claimed === false) nodes.push(notice("warn", h("p", { class: "flush" }, "This listing is not yet confirmed by the business. Check the prices when the business confirms your order.")));

  const list = h("ul", { class: "list border" });
  const totals = h("article", { class: "round no-elevate surface-container-high" });
  const deliveryBox = h("div");
  const out = h("div", { "aria-live": "polite" });
  const pickupOffered = menu.pickup !== false;
  const os = orderingState(menu);
  const slots = scheduleSlots(menu);
  const when = h("select", { id: "when" },
    os.closed ? null : h("option", { value: "" }, "As soon as possible"),
    slots.map((s) => h("option", { value: s.value }, s.label)));
  const whenBox = (os.closed && os.canOrder) || (!os.closed && menu.scheduled_orders === true && slots.length) ? selectField("when", os.closed ? "Schedule for (the business is closed now)" : "When", when) : null;

  const deliveryZone = () => (b.mode === "delivery" && b.zone ? zoneFor(menu, b.zone) : null);

  function refresh() {
    let sub = 0;
    list.replaceChildren(...Object.keys(b.lines).sort().map((k) => {
      const q = b.lines[k];
      sub += prices[k].price * q;
      return h("li", null,
        h("div", { class: "max" }, h("div", { class: "bold" }, prices[k].label), h("div", { class: "small-text muted price" }, money(prices[k].price) + " each")),
        h("nav", { class: "no-space", role: "group", "aria-label": "Quantity of " + prices[k].label },
          h("button", { type: "button", class: "circle transparent", "aria-label": "Remove one " + prices[k].label, on: { click: () => change(k, -1) } }, icon(q === 1 ? "delete" : "remove")),
          h("span", { class: "bold price" }, String(q)),
          h("button", { type: "button", class: "circle transparent", "aria-label": "Add one " + prices[k].label, on: { click: () => change(k, 1) } }, icon("add"))));
    }));
    const z = deliveryZone();
    let feeText;
    if (b.mode === "pickup") feeText = "None (pickup)";
    else if (!b.zone) feeText = "Choose your zone";
    else if (!z) feeText = "Not available to your zone";
    else feeText = z.fee === null ? "Not stated" : money(z.fee);
    const fee = b.mode === "pickup" ? 0 : (z && z.fee !== null ? z.fee : null);
    const rows = [h("nav", null, h("span", { class: "max" }, "Items"), h("span", { class: "price" }, money(sub))),
      h("nav", null, h("span", { class: "max" }, b.mode === "pickup" ? "Pickup" : "Delivery"), h("span", { class: "price" }, feeText))];
    if (fee !== null && (b.mode === "pickup" || z)) rows.push(h("hr"), h("nav", null, h("span", { class: "max bold" }, "Total to pay at " + (b.mode === "pickup" ? "pickup" : "delivery")), h("span", { class: "price bold" }, money(sub + fee))));
    if (z && z.min_order && sub < z.min_order) rows.push(h("p", { class: "small-text flush" }, "Below the minimum order of " + money(z.min_order) + "."));
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
  const address = h("textarea", { id: "address", rows: 3, maxlength: 300, placeholder: " " }, saved.address);
  const note = h("input", { type: "text", id: "note", maxlength: 200, autocomplete: "off", placeholder: " " });
  const remember = h("input", { type: "checkbox", id: "remember", checked: !!saved.name });

  function renderDelivery() {
    if (b.mode === "pickup") {
      deliveryBox.replaceChildren(
        menu.pickup === null || menu.pickup === undefined ? notice("info", h("p", { class: "flush" }, "This business has not stated whether it offers pickup. Ask when it confirms your order.")) : "",
        h("p", { class: "small-text muted" }, "Address: " + menu.address));
      return;
    }
    const z = deliveryZone();
    deliveryBox.replaceChildren(
      zoneSelect("zone", b.zone, (v) => { b.zone = v; b.ward = ""; if (v) { state.area = v; store.set("hana.area", v); } saveBasket(); renderDelivery(); refresh(); }, "Choose your zone"),
      b.zone ? wardSelect("ward", b.zone, b.ward, (v) => { b.ward = v; saveBasket(); }) : "",
      b.zone && !z ? notice("warn", h("p", { class: "flush" }, menu.name + " does not deliver to " + areaName(b.zone) + ". Choose pickup, or order from another restaurant.")) : "",
      textField("address", "Address or landmark", address));
  }

  const modeRadios = h("nav", { class: "vertical left-align" },
    h("label", { class: "radio" }, h("input", { type: "radio", name: "mode", value: "delivery", checked: b.mode === "delivery", on: { change: () => { b.mode = "delivery"; saveBasket(); renderDelivery(); refresh(); } } }), h("span", null, "Delivery")),
    pickupOffered ? h("label", { class: "radio" }, h("input", { type: "radio", name: "mode", value: "pickup", checked: b.mode === "pickup", on: { change: () => { b.mode = "pickup"; saveBasket(); renderDelivery(); refresh(); } } }), h("span", null, "Pickup")) : null);
  if (!pickupOffered && b.mode === "pickup") b.mode = "delivery";

  const channels = orderChannels(menu);
  const anyPreferred = channels.some((x) => x.preferred);
  const channelRadios = channels.map((c, i) => h("label", { class: "radio" },
    h("input", { type: "radio", name: "channel", value: String(i), checked: c.preferred || (i === 0 && !anyPreferred) }),
    h("span", null, CHANNELS[c.app].label + (c.app === "endpoint" ? " (" + contactText(c.app, c.id) + ")" : " · " + contactText(c.app, c.id)))));

  const form = h("form", { novalidate: true, on: { submit: async (e) => {
    e.preventDefault();
    const errors = [];
    const z = deliveryZone();
    if (b.mode === "delivery" && !b.zone) errors.push("Choose your zone.");
    if (b.mode === "delivery" && b.zone && !z) errors.push("This business does not deliver to your zone.");
    if (!name.value.trim()) errors.push("Enter a first name or nickname.");
    if (b.mode === "delivery" && !address.value.trim()) errors.push("Enter an address or landmark.");
    if (!channels.length) errors.push("This listing has no way to send a written order.");
    if (os.closed && !os.canOrder) errors.push("This business is closed and does not take scheduled orders.");
    if (os.closed && os.canOrder && !when.value) errors.push("Choose a time for your scheduled order.");
    const waiting = store.get("hana.orders", []).filter((x) => x.status === "awaiting");
    if (waiting.some((x) => x.restaurant_id === r.id)) errors.push("You already have an order waiting for this business's reply. Wait for it, or cancel it on the Orders page.");
    else if (waiting.length >= 3) errors.push("You have three orders waiting for replies. Wait for them, or cancel one, before placing another.");
    if (errors.length) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, errors.join(" ")))); return; }
    store.set("hana.me", remember.checked ? { name: name.value.trim(), address: address.value.trim() } : { name: "", address: "" });
    const scheduled = when.value || null;
    const o = await buildOrder(r, { mode: b.mode, zone: b.zone, ward: b.ward, deliveryZone: z, name: name.value.trim(), address: address.value.trim(), note: note.value.trim(), scheduled });
    const c = channels[Number((form.querySelector("input[name=channel]:checked") || { value: 0 }).value)];
    const ch = CHANNELS[c.app];
    let sentDirect = false, directError = "";
    if (ch.direct) {
      try { await sendDirect(c.id, o.message); sentDirect = true; } catch (err) { directError = err.message; }
      if (!sentDirect) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, "The order could not be sent directly. " + directError + " Choose another way to send it."))); return; }
    }
    const link = ch.direct ? null : ch.link(c.id, o.message, o.code);
    const created = new Date().toISOString();
    const windowStart = os.closed && os.next ? os.next.toISOString() : created;
    const orders = store.get("hana.orders", []);
    orders.unshift({ code: o.code, status: "awaiting", created, restaurant_id: r.id, restaurant: menu.name,
      claimed: menu.claimed === true, public_key: menu.owner && menu.owner.public_key ? menu.owner.public_key : null,
      menu_hash: r.hash, menu_version: menu.version, mode: b.mode, zone: b.zone, ward: b.ward,
      items: o.keys.map((k) => ({ key: k, label: prices[k].label, qty: b.lines[k], price: prices[k].price })), subtotal: o.sub, fee: o.fee,
      message: o.message, check_line: o.check, channel: c.app, channel_id: c.id, menu_file: r.raw,
      window_start: windowStart, scheduled, feed: menu.claimed === true && menu.confirmation_feed ? menu.confirmation_feed : null });
    const savedOk = store.set("hana.orders", orders.slice(0, 50));
    log("Prepared order " + o.code + " for " + menu.name + (sentDirect ? "; sent directly to the business." : "."));
    state.basket = null; saveBasket();
    const win = state.rules.confirmation_window_minutes;
    out.replaceChildren(...[
      h("h2", { class: "section-title" }, sentDirect ? "Order " + o.code + " sent" : "Order " + o.code + ": send it now"),
      savedOk ? null : notice("warn", h("p", { class: "flush" }, "This phone could not save a copy of the order. Copy the message below to keep a record.")),
      h("p", null, sentDirect ? "Your order went straight to " + menu.name + "." : (ch.prefill ? "Your app opens with the message ready. Press send there." : "Copy the message, open " + ch.label + " and paste it there.")),
      h("p", null, menu.name + " has " + win + " minutes to confirm" + (windowStart !== created ? " once it opens (" + whenText(new Date(windowStart)) + ")" : "") + ". If it does not, the order is cancelled automatically." + (menu.confirmation_feed && menu.claimed ? " Its confirmation will appear on the Orders page by itself." : "")),
      h("pre", null, o.message),
      h("nav", { class: "wrap gap-top" },
        link ? h("a", { href: link, class: "button", rel: "noopener", target: "_blank", on: { click: () => { if (!ch.prefill) copy(o.message); } } }, icon(ch.icon), h("span", null, ch.prefill ? "Open " + ch.label : "Copy and open " + ch.label)) : null,
        h("button", { type: "button", class: "border", on: { click: () => copy(o.message) } }, icon("content_copy"), h("span", null, "Copy message"))),
      h("p", { class: "small-text muted" }, "When the business replies, paste its reply on the Orders page."),
      h("nav", null, h("a", { href: "#/orders", class: "button border" }, icon("receipt_long"), h("span", null, "Go to Orders")))].filter(Boolean));
    form.remove();
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  } } },
    sectionTitle("Checkout"),
    whenBox,
    modeRadios,
    deliveryBox,
    textField("name", "First name or nickname", name),
    textField("note", "Note for the business (optional)", note),
    h("p", { class: "small-text bold" }, "Send the order by"),
    h("nav", { class: "vertical left-align" }, channelRadios),
    notice("info", h("p", { class: "bold flush" }, "Cash on delivery only"),
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
    if (o.status === "awaiting" && sinceStart > win * 60000) {
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
  confirmed_unchecked: ["Confirmed (this browser cannot check the signature)", "info"],
};

function complaintText(o) {
  return ["COMPLAINT SUMMARY (prepared on the customer's phone with Hana)",
    "Order code: " + o.code, "Order prepared: " + dateTime(o.created || o.at), "Business: " + o.restaurant,
    "Order type: " + (o.mode === "pickup" ? "pickup" : "delivery"),
    "Confirmation by the business: " + (STATUS_TEXT[o.status] || [o.status])[0],
    "Confirmation received: " + dateTime(o.confirmed_at), "Confirmation text: " + o.confirmation,
    "Menu version: " + o.menu_version, "Menu file SHA-256: " + o.menu_hash,
    "Items: " + o.items.map((i) => i.qty + " × " + (i.label || i.key)).join("; "),
    "Items subtotal: " + money(o.subtotal), "Delivery fee: " + (o.mode === "pickup" ? "none (pickup)" : o.fee === null ? "not stated" : money(o.fee)),
    "", "Message sent to the business:", o.message || o.kitchen_message, "",
    "Attach a screenshot of the chat showing the order and the business's confirmation.",
    "Under the Hana Terms of Use, the business must keep its communications about this order for at least " + state.rules.record_retention_months + " months, or " + state.rules.record_retention_months_when_disputed + " months once a dispute is raised.",
    "", "Description of the problem:", "", "Amount in dispute (BDT):", ""].join("\n");
}

function orderCard(o, orders) {
  const st = STATUS_TEXT[o.status] || [o.status, "info"];
  const out = h("div", { "aria-live": "polite" });
  const kids = [
    h("h2", { class: "card-title" }, o.restaurant),
    h("p", { class: "muted flush" }, "Order " + o.code + " · " + dateTime(o.created || o.at)),
    h("p", { class: "flush" }, money(o.subtotal) + (o.mode === "pickup" ? " (pickup)" : o.fee === null ? " plus delivery (fee not stated)" : " plus " + money(o.fee) + " delivery")),
    h("nav", { class: "wrap small-space" }, chip(st[0], st[1])),
  ];
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
  if (o.status === "awaiting" || o.status === "expired") {
    const reply = h("textarea", { id: "reply-" + o.code, rows: 3, placeholder: " " });
    const left = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 60000));
    kids.push(
      o.status === "awaiting"
        ? h("p", { class: "small-text" }, "The business must confirm by " + clock(String(deadline.getHours()).padStart(2, "0") + ":" + String(deadline.getMinutes()).padStart(2, "0")) + " (" + left + (left === 1 ? " minute" : " minutes") + " left). If it does not, this order is cancelled automatically.")
        : h("p", { class: "small-text" }, "No confirmation arrived within " + win + " minutes, so this order was cancelled. If the business did confirm in time, paste its reply below. This record is removed after " + state.rules.draft_order_expiry_hours + " hours."),
      textField("reply-" + o.code, "Business's reply", reply),
      h("nav", { class: "wrap" },
        h("button", { type: "button", on: { click: async () => {
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
        o.status === "awaiting" ? h("button", { type: "button", class: "border", on: { click: reminder } }, icon("send"), h("span", null, "Send a reminder")) : null,
        o.status === "awaiting" ? h("button", { type: "button", class: "border", on: { click: async () => {
          if (!(await ask("Cancel this order?", "Tell the business that you are cancelling. The order will be marked as cancelled on this phone.", "Cancel order"))) return;
          o.status = "cancelled";
          o.closed_at = new Date().toISOString();
          save();
          log("Cancelled order " + o.code + " for " + o.restaurant + " before confirmation.");
          viewOrders();
        } } }, icon("close"), h("span", null, "Cancel order")) : null),
      out);
  } else if (o.status === "declined" || o.status === "cancelled") {
    kids.push(h("p", { class: "small-text muted" }, "This record is removed after " + state.rules.draft_order_expiry_hours + " hours."));
  } else {
    if (o.eta && o.eta !== "?") kids.push(h("p", { class: "small-text" }, "Expected in about " + o.eta + " minutes from confirmation."));
    kids.push(h("details", { class: "gap-top" }, h("summary", { class: "link" }, "Problem with this order?"),
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
  if (changed) { store.set("hana.orders", orders); if (location.hash === "#/orders") viewOrders(); snackbar("An order was confirmed."); }
}
function startFeedPolling() {
  clearInterval(feedTimer);
  feedTimer = setInterval(() => { if (document.visibilityState === "visible") pollFeeds(); }, 30000);
  pollFeeds();
}

function viewOrders() {
  expireOrders();
  const orders = store.get("hana.orders", []);
  const nodes = [pageTitle("Orders"), h("p", { class: "muted" }, "Orders are stored only on this phone. An order counts once the business confirms it within " + state.rules.confirmation_window_minutes + " minutes; otherwise it is cancelled automatically.")];
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
  show("orders", "Orders", ...nodes);
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
    h("p", null, "Hana is the Chittagonian word for food. It is a free directory of restaurants in Chittagong and a tool for preparing orders."),
    h("p", null, "Built by ", link(state.site.company_url || "https://hamidyasir.com", "Hamid Yasir & Co."), " for the people of Chittagong. Managed by the ", link(repo, "Hana Community"), "."),
    h("p", { class: "small-text muted" }, "Food icons: ", link("https://github.com/jdecked/twemoji", "Twemoji"), ", by Twitter, Inc. and contributors, licensed under CC BY 4.0."),
    sectionTitle("How it works"),
    h("p", null, "Hana lists restaurants and prepares your order message. You send the message yourself, from your own phone, through the app the business uses. The order counts once the business confirms it in the same chat. Hana does not take payments, prepare food or make deliveries."),
    sectionTitle("Rules for every listing"),
    h("ul", { class: "list border" }, [
      "Cash on delivery only. You pay the business when you receive the order, or at pickup: in cash, by Bangla QR, by card on a POS terminal or by mobile wallet transfer, as the business accepts. No business may ask for payment in advance.",
      "Every price includes VAT and every other charge. The delivery fee is the only addition.",
      "Each business sets one fixed delivery fee for each area it serves, up to " + money(state.rules.max_delivery_fee) + ".",
      "A business may offer pickup, with no delivery fee.",
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
      "No commission and no listing fee.",
      "No featured listings. Every list is alphabetical and the same for everyone.",
      "No exclusivity. A business can list elsewhere and leave at any time.",
      "Businesses set their own prices, fees, delivery areas and hours.",
      "Customers choose the business, how to order and what to share.",
      "No accounts, no tracking and no collection of customer data.",
      "Open-source code and open formats.",
      "The creator is credited.",
      "Every price change is public, announced in the menu file and kept in its history.",
      "One fixed delivery charge per area, set by the business. Hana adds no fees.",
      "Cash on delivery only, with all charges included in the prices. No prepayment.",
    ].map((x) => h("li", null, x))),
    sectionTitle("Privacy"),
    h("p", null, "Your area, basket, name, address and orders stay on this phone. Hana has no server and sends no information about you. You can download or delete all of it from the Orders page."),
    sectionTitle("Terms and disputes"),
    h("p", null, "Hana is a directory and an order-preparation tool. Each order is a contract between the customer and the business alone; Hamid Yasir & Co. and the Hana Community are not parties to it and do not handle payments, food or deliveries. Disputes are for the parties and the competent authorities, starting with the Directorate of National Consumer Rights Protection (16121)."),
    h("nav", null, h("a", { href: "#/terms", class: "button border" }, h("span", null, "Read the Terms of Use"))),
    sectionTitle("Get involved"),
    h("p", null, repo ? ["The code, the directory and every decision are public on the ", link(repo, "project page"), ". Report a problem or suggest a change there."] : "The project page is not linked on this host."));
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
    h("p", { class: "muted" }, "Settings are kept on this device only."),
    sectionTitle("Colour scheme"),
    radios("scheme", SCHEMES, st.scheme, (k) => saveSettings(Object.assign(settings(), { scheme: k }))),
    sectionTitle("Light or dark"),
    radios("mode", { system: "Follow my phone", light: "Light", dark: "Dark" }, themeMode(), (k) => { try { localStorage.setItem("hana.theme", k); } catch (e) { /* ignore */ } applyTheme(); }),
    sectionTitle("Text size"),
    radios("text", TEXT_SIZES, st.text, (k) => saveSettings(Object.assign(settings(), { text: k }))),
    sectionTitle("Pictures"),
    h("div", { class: "row" }, h("label", { class: "switch" }, pictures, h("span")), h("label", { for: "pictures", class: "max" }, "Show pictures of food")),
    h("p", { class: "small-text muted" }, "Pictures come from the business. Listings without a cover show a stock photo for their cuisine from Wikimedia Commons, an openly licensed library; loading it lets Wikimedia see your network address, as any website you visit would. Food icons are Twemoji, by Twitter, Inc. and contributors, CC BY 4.0."),
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
          for (const k of ["hana.orders", "hana.me", "hana.basket", "hana.area", "hana.log", "hana.settings", "hana.theme"]) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
          state.basket = null; state.area = ""; applyTheme(); updateBasketBadge(); viewSettings(); snackbar("Deleted.");
        }
      } } }, icon("delete"), h("span", null, "Delete everything"))),
    sectionTitle("Other regions"),
    h("p", { class: "small-text muted" }, "Hana may run in other cities, each as its own community-run directory. Your phone can check which one covers where you are. Your position is compared on this phone only and is never sent anywhere."),
    h("nav", null, h("button", { type: "button", class: "border", on: { click: findRegion } }, icon("location_on"), h("span", null, "Find the Hana for my area"))),
    h("div", { id: "region-out", "aria-live": "polite" }),
    sectionTitle("Offline copy"),
    h("p", { class: "small-text muted" }, "Download Hana as a single file. Open it from your phone's files at any time; it works without a connection and brings itself up to date whenever you are online."),
    h("nav", null, h("button", { type: "button", class: "border", on: { click: async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try { downloadText("hana-offline.html", await buildStandalone({ mode: "directory", site: state.site }), "text/html"); snackbar("Offline copy downloaded."); }
      catch (err) { snackbar("The offline copy could not be made: " + err.message); }
      btn.disabled = false;
    } } }, icon("download"), h("span", null, "Download offline copy"))),
    h("nav", { class: "gap-top" }, h("button", { type: "button", class: "border", on: { click: () => { try { localStorage.removeItem("hana.settings"); localStorage.removeItem("hana.theme"); } catch (e) { /* ignore */ } applyTheme(); viewSettings(); } } }, h("span", null, "Reset appearance"))));
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
    const here = new URL(".", location.href).href;
    if (!hit) out.replaceChildren(notice("info", h("p", { class: "flush" }, "No Hana directory covers your position yet. ADOPTING.md explains how a community can start one.")));
    else if (!/^https:\/\//.test(hit.url) || hit.url === here) out.replaceChildren(notice("info", h("p", { class: "flush" }, "You are in the " + hit.name + " area, which this directory covers.")));
    else out.replaceChildren(notice("info", h("p", { class: "flush" }, "You are in the " + hit.name + " area. "), h("a", { class: "link", href: hit.url, rel: "noopener" }, "Open Hana " + hit.name)));
  }, () => out.replaceChildren(notice("info", h("p", { class: "flush" }, "Your position was not shared, so nothing was checked."))), { timeout: 15000, maximumAge: 600000 });
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
      h("a", { class: "link", href: "#/terms" }, "Terms"), " ", h("a", { class: "link", href: main, rel: "noopener" }, "All restaurants on Hana"));
    for (const n of document.querySelectorAll('[data-nav="list"] span')) n.textContent = "Menu";
  }
}

for (const i of document.querySelectorAll("i[data-icon]")) i.replaceWith(icon(i.getAttribute("data-icon")));
window.addEventListener("hashchange", route);
updateBasketBadge();
route();
loadAll().then(() => { expireOrders(); fixFooterLink(); updateBasketBadge(); route(); startFeedPolling(); });

if (!SNAP) setupUpdates(["index.html", "core.js", "app.js", "theme/theme.css"]);
