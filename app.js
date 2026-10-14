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
  basket: store.get("hana.basket", null),
};

async function loadAll() {
  try {
    try { Object.assign(state.site, await fetchJson("site.json")); } catch (e) { /* optional file */ }
    try { Object.assign(state.rules, await fetchJson("rules.json")); } catch (e) { /* the built-in defaults apply */ }
    const areas = await fetchJson("areas.json");
    state.areas = areas.areas || [];
    state.areaById = new Map(state.areas.map((a) => [a.id, a]));
    const a = state.areaById.get(state.area);
    if (state.area && (!a || a.kind !== "zone")) { state.area = ""; store.set("hana.area", ""); }
    const index = await fetchJson("index.json");
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

function viewList() {
  const results = h("div", { id: "results", "aria-live": "polite" });
  const search = h("input", {
    type: "search", id: "q", placeholder: "Search restaurants and dishes", autocomplete: "off", value: state.query,
    "aria-label": "Search restaurants and dishes",
    on: { input: (e) => { state.query = e.target.value; renderResults(); } },
  });
  const showAll = h("input", { type: "checkbox", id: "showall", checked: state.showAll, on: { change: (e) => { state.showAll = e.target.checked; renderResults(); } } });

  function renderResults() {
    const area = state.area;
    const cards = [];
    let hidden = 0;
    for (const r of state.restaurants) {
      const m = r.menu;
      const zone = m ? zoneFor(m, area) : null;
      const delivers = !area || !m || !!zone;
      if (!delivers && !state.showAll) { hidden++; continue; }
      const nameHit = fuzzyMatches(state.query, r.name + " " + (m ? m.kind || "" : ""));
      let dishHits = [];
      if (m && norm(state.query)) {
        dishHits = (m.items || []).filter((it) => fuzzyMatches(state.query, it.name + " " + (it.category || "") + " " + (it.section || "")));
      }
      if (norm(state.query) && !nameHit && !dishHits.length) continue;
      cards.push(restaurantCard(r, zone, delivers, dishHits));
    }
    const kids = [];
    if (cards.length) kids.push(...cards);
    else kids.push(h("p", { class: "muted" }, state.restaurants.length ? "No restaurants match. Try a shorter search or another zone." : "No restaurants are listed yet."));
    if (area && hidden) {
      kids.push(h("p", { class: "small-text muted" }, hidden + (hidden === 1 ? " restaurant does" : " restaurants do") + " not deliver to " + areaName(area) + " and " + (hidden === 1 ? "is" : "are") + " hidden."));
    }
    results.replaceChildren(...kids);
  }

  show("list", "",
    pageTitle("Restaurants in Chittagong"),
    h("p", { class: "muted" }, "Listed alphabetically. No listing is featured or paid for."),
    zoneSelect("area", state.area, (v) => { state.area = v; store.set("hana.area", v); renderResults(); }, "Choose your zone"),
    h("div", { class: "field prefix round fill" }, icon("search"), search),
    h("div", { class: "row" }, h("label", { class: "switch" }, showAll, h("span")), h("label", { for: "showall", class: "max" }, "Include restaurants that do not deliver to my zone")),
    h("div", { class: "space" }),
    results,
    h("article", { class: "round no-elevate surface-container-high gap-top" },
      h("h2", { class: "card-title" }, "Own a restaurant or a delivery-only kitchen?"),
      h("p", null, "Listing is free and Hana takes no commission."),
      h("nav", null, h("a", { href: "business.html#/join", class: "button" }, icon("add_business"), h("span", null, "Add or claim your business")))));
  renderResults();
}

function fromPrice(it) {
  return it.price !== undefined ? money(it.price) : "from " + money(Math.min(...it.options.map((o) => o.price)));
}

function restaurantCard(r, zone, delivers, dishHits) {
  const m = r.menu;
  if (!m) {
    return h("article", { class: "round border no-elevate" }, h("h2", { class: "card-title" }, r.name), h("p", { class: "muted" }, r.problem || "This menu is not available."));
  }
  const chips = [statusChip(m)];
  if (m.claimed === false) chips.push(chip("Not yet confirmed by the business", "warn"));
  if (!delivers) chips.push(chip("Does not deliver to " + areaName(state.area), "warn"));
  const kids = [
    h("a", { href: "#/r/" + r.id, class: "row" },
      h("div", { class: "max" }, h("h2", { class: "card-title" }, r.name), h("div", { class: "muted" }, (m.kind || "Restaurant") + " · " + locatedIn(m)))),
    h("nav", { class: "wrap small-space" }, chips),
  ];
  if (delivers) kids.push(h("p", { class: "small-text muted flush" }, feeSummary(zone || onlyZone(m))));
  if (dishHits.length) {
    kids.push(h("ul", { class: "list" }, dishHits.slice(0, 5).map((it) => h("li", null,
      h("a", { href: "#/r/" + r.id, class: "max" }, it.name), h("span", { class: "price" }, fromPrice(it))))));
    if (dishHits.length > 5) kids.push(h("p", { class: "small-text muted" }, (dishHits.length - 5) + " more on the restaurant page"));
  }
  return h("article", { class: "round border no-elevate" }, ...kids);
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
  if (!r) return show("list", "Not found", pageTitle("Restaurant not found"), h("p", null, h("a", { class: "link", href: "#/" }, "Back to all restaurants")));
  const m = r.menu;
  if (!m) return show("list", r.name, pageTitle(r.name), notice("warn", r.problem || "This menu is not available."));

  const nodes = [
    h("nav", null, h("a", { href: "#/", class: "button circle transparent", "aria-label": "Back to all restaurants" }, icon("arrow_back")), h("h1", { class: "page-title max" }, m.name)),
    h("p", { class: "muted" }, (m.kind || "Restaurant") + " · " + locatedIn(m)),
    h("nav", { class: "wrap small-space" }, statusChip(m)),
  ];
  if (m.claimed === false) nodes.push(notice("warn", h("p", { class: "bold flush" }, "Not yet confirmed by the business"), h("p", { class: "flush" }, m.listing_note || "")));
  nodes.push(h("p", { class: "small-text muted" }, "Prices from version " + m.version + ", published " + longDate(m.announcement && m.announcement.published) + "."));
  if (m.price_history && m.price_history.length) {
    nodes.push(h("details", null, h("summary", { class: "link" }, "Price changes (" + m.price_history.length + ")"),
      m.price_history.slice().reverse().map((p) => h("div", null, h("p", { class: "bold" }, longDate(p.published) + ": " + p.summary),
        h("ul", { class: "list" }, p.changes.map((c) => h("li", null, c.label + ": " + (c.old === null ? "new" : money(c.old)) + " to " + (c.new === null ? "removed" : money(c.new)))))))));
  }

  nodes.push(sectionTitle("Delivery"));
  const zones = (m.delivery && m.delivery.zones) || [];
  nodes.push(h("ul", { class: "list border" }, zones.map((z) => h("li", null, icon("location_on"),
    h("div", { class: "max" }, h("div", null, zoneLabel(z)), h("div", { class: "small-text muted" }, feeSummary(z)))))));
  nodes.push(h("p", { class: "small-text muted" }, "The business sets one fixed delivery charge for each area, up to the Hana limit of " + money(state.rules.max_delivery_fee) + ". Hana adds no fees. The business may still decline an order."));
  nodes.push(h("p", null, "Pickup: " + (m.pickup === true ? "available" : m.pickup === false ? "not offered" : "not stated; ask the business")));

  nodes.push(sectionTitle("Prices and payment"));
  nodes.push(h("ul", { class: "list border" },
    h("li", null, icon("check_circle"), h("div", { class: "max" }, "All prices include VAT and every other charge. The delivery fee is the only addition.")),
    h("li", null, icon("check_circle"), h("div", { class: "max" }, "Pay on delivery or at pickup only: " + paymentText(m) + ".")),
    h("li", null, icon("warning"), h("div", { class: "max" }, "Never pay in advance. Hana does not allow prepayment. If a business asks you to pay before delivery, do not pay, and report the listing."))));
  if (state.area && !zoneFor(m, state.area)) nodes.push(notice("warn", h("p", { class: "flush" }, "This business does not list delivery to " + areaName(state.area) + ". You can still ask.")));

  nodes.push(sectionTitle("Menu"));
  const sections = new Map();
  for (const it of m.items || []) {
    const sec = it.section || "Menu";
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec).push(it);
  }
  for (const [sec, items] of sections) {
    const lis = [];
    let lastCat = null;
    for (const it of items) {
      if (it.category && it.category !== lastCat) { lastCat = it.category; lis.push(h("li", { class: "overline-label" }, it.category)); }
      const lines = it.options ? it.options.map((op) => ({ key: it.id + "." + op.id, label: op.label, price: op.price })) : [{ key: it.id, label: "", price: it.price }];
      lis.push(h("li", { class: "vertical-padding" },
        h("div", { class: "max" },
          h("div", { class: "bold" }, it.name),
          it.description ? h("div", { class: "small-text muted" }, it.description) : null,
          h("nav", { class: "wrap small-space gap-top" }, lines.map((l) => h("button", {
            type: "button", class: "chip medium border",
            "aria-label": "Add " + it.name + (l.label ? ", " + l.label : "") + ", " + money(l.price),
            on: { click: () => addToBasket(r, l.key, it.name + (l.label ? " (" + l.label + ")" : "")) },
          }, icon("add"), h("span", { class: "price" }, (l.label ? l.label + " · " : "") + money(l.price))))))));
    }
    nodes.push(h("h3", { class: "group-title" }, sec), h("ul", { class: "list border" }, lis));
  }
  nodes.push(h("nav", { class: "gap-top" }, h("a", { href: "#/basket", class: "button responsive" }, icon("shopping_bag"), h("span", null, "View basket"))));

  nodes.push(sectionTitle("Contact"));
  nodes.push(h("ul", { class: "list border" },
    (m.contact || []).map((c) => h("li", null, icon((CHANNELS[c.app] || {}).icon || "chat"),
      h("div", { class: "max" }, h("div", null, (CHANNELS[c.app] ? CHANNELS[c.app].label : c.app) + (c.preferred ? " (preferred)" : "")), h("div", { class: "small-text muted" }, phoneText(c.id))))),
    h("li", null, icon("call"), h("div", { class: "max" }, h("div", null, "Business phone"), h("div", { class: "small-text muted" }, m.business_phone))),
    h("li", null, icon("location_on"), h("div", { class: "max" }, h("div", null, "Address"), h("div", { class: "small-text muted" }, m.address)))));

  nodes.push(sectionTitle("Opening hours"));
  if (!m.hours) nodes.push(h("p", { class: "muted" }, "Not stated."));
  else {
    nodes.push(h("ul", { class: "list border" }, DAYS.map((d) => h("li", null, h("div", { class: "max" }, DAY_NAMES[d]), h("span", null, hoursText(m.hours[d]))))));
    nodes.push(h("p", { class: "small-text muted" }, "Open now is based on your phone's clock."));
  }
  show("list", m.name, ...nodes);
}

/* ---------------------------------------------------------------- basket and checkout */

function saveBasket() { store.set("hana.basket", state.basket); updateBasketBadge(); }
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
  const lines = ["Order " + code + " (sent with Hana)", "To: " + menu.name, "", ...text, "",
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
    if (errors.length) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, errors.join(" ")))); return; }
    store.set("hana.me", remember.checked ? { name: name.value.trim(), address: address.value.trim() } : { name: "", address: "" });
    const o = await buildOrder(r, { mode: b.mode, zone: b.zone, ward: b.ward, deliveryZone: z, name: name.value.trim(), address: address.value.trim(), note: note.value.trim() });
    const c = channels[Number((form.querySelector("input[name=channel]:checked") || { value: 0 }).value)];
    const ch = CHANNELS[c.app];
    let sentDirect = false, directError = "";
    if (ch.direct) {
      try { await sendDirect(c.id, o.message); sentDirect = true; } catch (err) { directError = err.message; }
      if (!sentDirect) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, "The order could not be sent directly. " + directError + " Choose another way to send it."))); return; }
    }
    const link = ch.direct ? null : ch.link(c.id, o.message, o.code);
    const created = new Date().toISOString();
    const orders = store.get("hana.orders", []);
    orders.unshift({ code: o.code, status: "awaiting", created, restaurant_id: r.id, restaurant: menu.name,
      claimed: menu.claimed === true, public_key: menu.owner && menu.owner.public_key ? menu.owner.public_key : null,
      menu_hash: r.hash, menu_version: menu.version, mode: b.mode, zone: b.zone, ward: b.ward,
      items: o.keys.map((k) => ({ key: k, label: prices[k].label, qty: b.lines[k], price: prices[k].price })), subtotal: o.sub, fee: o.fee,
      message: o.message, check_line: o.check, channel: c.app, channel_id: c.id, menu_file: r.raw });
    const savedOk = store.set("hana.orders", orders.slice(0, 50));
    log("Prepared order " + o.code + " for " + menu.name + (sentDirect ? "; sent directly to the business." : "."));
    state.basket = null; saveBasket();
    const win = state.rules.confirmation_window_minutes;
    out.replaceChildren(...[
      h("h2", { class: "section-title" }, sentDirect ? "Order " + o.code + " sent" : "Order " + o.code + ": send it now"),
      savedOk ? null : notice("warn", h("p", { class: "flush" }, "This phone could not save a copy of the order. Copy the message below to keep a record.")),
      h("p", null, sentDirect ? "Your order went straight to " + menu.name + "." : (ch.prefill ? "Your app opens with the message ready. Press send there." : "Copy the message, open " + ch.label + " and paste it there.")),
      h("p", null, menu.name + " has " + win + " minutes to confirm. If it does not, the order is cancelled automatically."),
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
    if (o.status === "awaiting" && age > win * 60000) {
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
  const deadline = new Date(new Date(o.created || o.at).getTime() + win * 60000);
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

function viewOrders() {
  expireOrders();
  const orders = store.get("hana.orders", []);
  const nodes = [pageTitle("Orders"), h("p", { class: "muted" }, "Orders are stored only on this phone. An order counts once the business confirms it within " + state.rules.confirmation_window_minutes + " minutes; otherwise it is cancelled automatically.")];
  if (!orders.length) nodes.push(h("p", { class: "muted" }, "No orders yet."));
  for (const o of orders) nodes.push(orderCard(o, orders));
  const entries = store.get("hana.log", []);
  nodes.push(sectionTitle("Activity on this phone"),
    entries.length ? h("details", null, h("summary", { class: "link" }, "Show the record (" + entries.length + ")"),
      h("ul", { class: "list" }, entries.map((e) => h("li", null, h("div", { class: "max" }, h("div", { class: "small-text muted" }, dateTime(e.at)), h("div", null, e.text)))))) :
      h("p", { class: "muted" }, "Nothing recorded yet."),
    sectionTitle("Your data"),
    h("nav", { class: "wrap" },
      h("button", { type: "button", class: "border", on: { click: exportData } }, icon("download"), h("span", null, "Download my data")),
      h("button", { type: "button", class: "border", on: { click: () => document.getElementById("restore-file").click() } }, icon("upload"), h("span", null, "Restore from a download")),
      h("input", { type: "file", id: "restore-file", accept: ".json,application/json", hidden: true, "aria-label": "Restore from a download", on: { change: (e) => importData(e.target) } }),
      h("button", { type: "button", class: "border", on: { click: async () => {
        if (await ask("Delete everything on this phone?", "This removes your orders, saved details, record, area and basket. It cannot be undone. Download your data first if you want a copy.", "Delete")) {
          for (const k of ["hana.orders", "hana.me", "hana.basket", "hana.area", "hana.log"]) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
          state.basket = null; state.area = ""; updateBasketBadge(); viewOrders(); snackbar("Deleted.");
        }
      } } }, icon("delete"), h("span", null, "Delete everything"))));
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
  show("about", "Terms of Use", pageTitle("Terms of Use"), h("p", { class: "muted" }, "Loading…"));
  try {
    const r = await fetch("TERMS.md", { cache: "no-cache" });
    if (!r.ok) throw new Error();
    show("about", "Terms of Use", ...renderMarkdown(await r.text()));
  } catch (e) {
    show("about", "Terms of Use", pageTitle("Terms of Use"), notice("warn", h("p", { class: "flush" }, "The terms could not be loaded. They are also in TERMS.md on the project page.")));
  }
}

/* ---------------------------------------------------------------- routing and start-up */

function route() {
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
  return viewList();
}

function fixFooterLink() {
  const a = document.getElementById("repo-link");
  const u = repoUrl();
  a.setAttribute("href", u || "#/about");
}

for (const i of document.querySelectorAll("i[data-icon]")) i.replaceWith(icon(i.getAttribute("data-icon")));
window.addEventListener("hashchange", route);
updateBasketBadge();
route();
loadAll().then(() => { expireOrders(); fixFooterLink(); updateBasketBadge(); route(); });

setupUpdates(["index.html", "core.js", "app.js", "theme/theme.css"]);
