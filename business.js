/* Hana business tools. Needs core.js. Everything runs on this phone or computer:
   nothing is uploaded, and the private key never leaves the device. See SPEC.md,
   sections 4.1 (claims and keys), 5.4 (price changes) and 6.5 (confirmations). */
"use strict";

const main = document.getElementById("main");
const B = {
  site: { repo_url: "", company_url: "https://hamidyasir.com" },
  rules: { max_delivery_fee: 150, payment_methods_on_delivery: { cash: "Cash" } },
  areas: [], areaById: new Map(), index: [], menus: new Map(), key: null, loaded: false,
};
const KINDS = ["Restaurant", "Delivery-only kitchen", "Café", "Bakery", "Sweet shop", "Grocery store", "Supermarket"];
const PLEDGES = {
  rider_identity: "Every courier who delivers for this business uses a mobile number registered in their own name with their own NID. I have checked this myself and will check every new courier before their first delivery.",
  data_handling: "I will give couriers only what they need to deliver: the customer's first name or nickname, the address or landmark, the order code and the amount to collect. I will not keep customer details longer than needed or share them with anyone else.",
  fair_pricing: "Every price I list includes VAT and every other charge. The delivery fee is the only addition, and it never exceeds the Hana limit. I take payment only on delivery or at pickup, and I will never ask a customer to pay in advance.",
  records: "I will confirm or decline every order within 15 minutes. I will keep all communications about orders placed through Hana for at least six months, and for at least twelve months when there is a complaint or dispute, and I will not delete, unsend or alter them.",
};

/* ---------------------------------------------------------------- shared helpers */

function slug(s) { return norm(s).replace(/ /g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "item"; }
function zonesList() { return B.areas.filter((a) => a.kind === "zone").sort((a, b) => a.name.localeCompare(b.name, "en")); }
function areaName(id) { const a = B.areaById.get(id); return a ? a.name : id; }

function repoUrl() {
  const u = B.site.repo_url;
  if (u && u.indexOf("{{") === -1) return u;
  const m = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
  if (m) {
    const repo = location.pathname.split("/").filter(Boolean)[0];
    return "https://github.com/" + m[1] + (repo && !repo.endsWith(".html") ? "/" + repo : "");
  }
  return null;
}

function setActiveNav(name) {
  for (const a of document.querySelectorAll("[data-nav]")) {
    const on = a.getAttribute("data-nav") === name;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
}

function show(nav, title, ...nodes) {
  setActiveNav(nav);
  main.replaceChildren(...nodes.filter(Boolean));
  window.scrollTo(0, 0);
  document.title = (title ? title + " | " : "") + "Hana business tools";
}

function hint(text) { return h("p", { class: "small-text muted" }, text); }
function input(id, attrs) { return h("input", Object.assign({ id, placeholder: " ", autocomplete: "off" }, attrs || {})); }
function select(id, label, options, value) {
  return selectField(id, label, h("select", { id }, options.map(([v, t]) => h("option", { value: v, selected: v === value }, t))));
}
function check(id, label, checked) { return h("label", { class: "checkbox" }, h("input", { type: "checkbox", id, checked: !!checked }), h("span", null, label)); }
function val(id) { const e = document.getElementById(id); return e ? e.value.trim() : ""; }
function checked(id) { const e = document.getElementById(id); return !!(e && e.checked); }

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type: type || "application/json" }));
  const a = h("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readFile(fileInput) {
  return new Promise((resolve, reject) => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) { reject(new Error("Choose a file first.")); return; }
    const r = new FileReader();
    r.onload = () => resolve(new Uint8Array(r.result));
    r.onerror = () => reject(new Error("The file could not be read."));
    r.readAsArrayBuffer(f);
  });
}

const menuBytes = (menu) => utf8(JSON.stringify(menu, null, 2) + "\n");

/* Full Open Location Code (Plus Code) to its centre point. Open algorithm, as in tools/check.py. */
function olcDecode(code) {
  const A = "23456789CFGHJMPQRVWX";
  const c = code.replace("+", "").toUpperCase();
  if (!/^[23456789CFGHJMPQRVWX]{10,11}$/.test(c)) return null;
  let lat = -90, lon = -180, res = 20;
  for (let i = 0; i < 10; i += 2) {
    lat += A.indexOf(c[i]) * res;
    lon += A.indexOf(c[i + 1]) * res;
    if (i + 2 < 10) res /= 20;
  }
  let latres = res, lonres = res;
  for (const ch of c.slice(10)) {
    latres /= 5; lonres /= 4;
    const idx = A.indexOf(ch);
    lat += Math.floor(idx / 4) * latres;
    lon += (idx % 4) * lonres;
  }
  return { lat: Math.round((lat + latres / 2) * 1e6) / 1e6, lon: Math.round((lon + lonres / 2) * 1e6) / 1e6 };
}

/* Every amount a customer relies on, as in tools/check.py (money_map). */
function moneyMap(menu) {
  const m = {};
  for (const it of menu.items || []) {
    if ("price" in it) m["item:" + it.id] = it.price;
    for (const op of it.options || []) m["item:" + it.id + ":" + op.id] = op.price;
  }
  for (const z of (menu.delivery && menu.delivery.zones) || []) {
    m["zone:" + z.id + ":fee"] = z.fee === undefined ? null : z.fee;
    m["zone:" + z.id + ":min_order"] = z.min_order === undefined ? null : z.min_order;
  }
  return m;
}
function moneyLabel(menu, key) {
  const [kind, id, part] = key.split(":");
  if (kind === "zone") {
    const z = ((menu.delivery && menu.delivery.zones) || []).find((x) => x.id === id);
    const where = z ? (z.areas || []).map(areaName).join(", ") : id;
    return (part === "fee" ? "Delivery fee, " : "Minimum order, ") + where;
  }
  const it = (menu.items || []).find((x) => x.id === id);
  if (!it) return id;
  const op = part ? (it.options || []).find((o) => o.id === part) : null;
  return it.name + (op ? " (" + op.label + ")" : "");
}
function diffMoney(oldMenu, newMenu) {
  const a = moneyMap(oldMenu), b = moneyMap(newMenu);
  const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).sort();
  const out = [];
  for (const k of keys) {
    const o = k in a ? a[k] : null, n = k in b ? b[k] : null;
    if (o !== n) out.push({ key: k, label: moneyLabel(n === null ? oldMenu : newMenu, k), old: o, new: n });
  }
  return out;
}

/* ---------------------------------------------------------------- keys (Ed25519 through Web Crypto) */

async function createKey() {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { jwk: { kty: "OKP", crv: "Ed25519", d: jwk.d, x: jwk.x }, publicRaw: pub, publicB64: b64u(pub), id: await keyId(pub) };
}

async function loadKey(bytes) {
  const data = JSON.parse(new TextDecoder().decode(bytes));
  const jwk = data.jwk || data;
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.d || !jwk.x) throw new Error("This is not a Hana key file.");
  const pub = unb64u(jwk.x);
  return { jwk: { kty: "OKP", crv: "Ed25519", d: jwk.d, x: jwk.x }, publicRaw: pub, publicB64: jwk.x, id: await keyId(pub) };
}

async function signBytes(key, bytes) {
  const priv = await crypto.subtle.importKey("jwk", Object.assign({ ext: true }, key.jwk), { name: "Ed25519" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, priv, bytes));
}

async function signMenu(menu, key) {
  delete menu.signature;
  menu.signature = b64u(await signBytes(key, menuSigningBytes(menu)));
  return menu;
}

function keyFileText(key) {
  return JSON.stringify({ about: "Hana business key. Keep this file private and keep a backup. Anyone with it can sign as your business. Hana never asks for it.", key_id: key.id, created: new Date().toISOString(), jwk: key.jwk }, null, 2) + "\n";
}

function keyBox(onReady) {
  const status = h("p", { class: "small-text muted" }, B.key ? "Key loaded: " + B.key.id : "No key loaded.");
  const file = h("input", { type: "file", id: "keyfile", accept: ".json,application/json" });
  return h("div", null,
    status,
    h("nav", { class: "wrap" },
      h("button", { type: "button", class: "border", on: { click: async () => {
        try {
          B.key = await createKey();
          download("hana-key-" + B.key.id + ".json", keyFileText(B.key));
          status.textContent = "New key created and downloaded: " + B.key.id + ". Keep the file private and keep a backup. Without it you cannot sign updates.";
          if (onReady) onReady();
        } catch (e) { status.textContent = "This browser cannot create Ed25519 keys. Use an up-to-date Chrome, Firefox or Safari."; }
      } } }, icon("key"), h("span", null, "Create a new key"))),
    textField("keyfile", "Key file", file),
    h("nav", { class: "wrap" }, h("button", { type: "button", class: "border", on: { click: async () => {
      try {
        B.key = await loadKey(await readFile(file));
        status.textContent = "Key loaded: " + B.key.id + ".";
        if (onReady) onReady();
      } catch (e) { status.textContent = e.message; }
    } } }, icon("upload"), h("span", null, "Load my key file"))));
}

/* ---------------------------------------------------------------- loading */

async function loadDirectory() {
  try { Object.assign(B.site, await fetchJson("site.json")); } catch (e) { /* optional */ }
  try { Object.assign(B.rules, await fetchJson("rules.json")); } catch (e) { /* defaults */ }
  try {
    B.areas = (await fetchJson("areas.json")).areas || [];
    B.areaById = new Map(B.areas.map((a) => [a.id, a]));
    B.index = (await fetchJson("index.json")).restaurants || [];
  } catch (e) { /* the forms still work without the directory */ }
  B.loaded = true;
}

/* Every published version of a listing, to match an order's H= prefix. */
async function versionsOf(row) {
  if (B.menus.has(row.id)) return B.menus.get(row.id);
  const out = [];
  for (const loc of row.locations || []) {
    try {
      const bytes = await fetchBytes(loc);
      const menu = JSON.parse(new TextDecoder().decode(bytes));
      out.push({ bytes, menu, hash: await sha256Hex(bytes) });
      const base = loc.replace(/menu\.json$/, "versions/");
      for (let n = 1; n < menu.version; n++) {
        try {
          const vb = await fetchBytes(base + n + ".json");
          out.push({ bytes: vb, menu: JSON.parse(new TextDecoder().decode(vb)), hash: await sha256Hex(vb) });
        } catch (e) { /* an older version may not be hosted */ }
      }
      break;
    } catch (e) { /* try the next location */ }
  }
  B.menus.set(row.id, out);
  return out;
}

/* Finds a listing by its business phone. Owners look up their own listing this way; the
   tools never show a list of unclaimed businesses. */
async function findListingByPhone(phone, unclaimedOnly) {
  const want = String(phone || "").replace(/[\s-]/g, "").replace(/^0/, "+880").replace(/^880/, "+880");
  if (!/^\+8801\d{9}$/.test(want)) return { error: "Enter the business phone in the format +8801XXXXXXXXX." };
  for (const row of B.index) {
    if (unclaimedOnly && row.claimed) continue;
    const vs = await versionsOf(row);
    if (vs.length && vs[0].menu.business_phone === want) return { row, menu: vs[0].menu, versions: vs };
  }
  return { error: "No " + (unclaimedOnly ? "unclaimed " : "") + "listing uses that phone number." };
}

/* ---------------------------------------------------------------- start page */

function viewHome() {
  show("home", "",
    pageTitle("Business tools"),
    h("p", null, "Free tools for restaurants, kitchens and grocery stores in Chittagong. Listing on Hana costs nothing, and Hana takes no commission."),
    h("article", { class: "round border no-elevate" }, h("h2", { class: "card-title" }, "List your business"),
      h("p", null, "Fill in one form. The page prepares your signed menu file and a request for the community to verify you."),
      h("nav", null, h("a", { href: "#/join", class: "button" }, icon("add_business"), h("span", null, "New listing")))),
    h("article", { class: "round border no-elevate" }, h("h2", { class: "card-title" }, "Claim a listing"),
      h("p", null, "If a volunteer has already listed your business, look it up with your business phone and claim it."),
      h("nav", null, h("a", { href: "#/claim", class: "button border" }, icon("verified"), h("span", null, "Claim a listing")))),
    h("article", { class: "round border no-elevate" }, h("h2", { class: "card-title" }, "Confirm an order"),
      h("p", null, "Paste a customer's order. The page checks the prices against your published menu and prepares your confirmation reply."),
      h("nav", null, h("a", { href: "#/confirm", class: "button" }, icon("check_circle"), h("span", null, "Confirm an order")))),
    h("article", { class: "round border no-elevate" }, h("h2", { class: "card-title" }, "Update prices and delivery fees"),
      h("p", null, "Change prices, fees or minimum orders. The change is announced publicly in your menu file automatically."),
      h("nav", null, h("a", { href: "#/update", class: "button" }, icon("edit_note"), h("span", null, "Update prices")))),
    h("article", { class: "round border no-elevate" }, h("h2", { class: "card-title" }, "Your own website"),
      h("p", null, "Make a one-file website for your business that you can put on your own hosting. It stays in step with your Hana listing and carries the line \u201cCreated using Hana by Hamid Yasir & Co.\u201d"),
      h("nav", null, h("a", { href: "#/site", class: "button border" }, icon("storefront"), h("span", null, "Make my website")))),
    sectionTitle("Rules for every business"),
    h("ul", { class: "list border" }, [
      "Take payment only on delivery or at pickup, never in advance.",
      "Every price includes VAT and every other charge. The delivery fee is the only addition.",
      "Set one fixed delivery fee for each area, no higher than " + money(B.rules.max_delivery_fee) + ".",
      "Confirm or decline each order within " + (B.rules.confirmation_window_minutes || 15) + " minutes, in the customer's chat. Unconfirmed orders are cancelled automatically.",
      "Keep all order communications for at least " + (B.rules.record_retention_months || 6) + " months, or " + (B.rules.record_retention_months_when_disputed || 12) + " months if there is a dispute. Do not delete or unsend them.",
      "Two community members check each claim, and claims are reviewed every " + (B.rules.community_review_days || 180) + " days.",
    ].map((x) => h("li", null, icon("check_circle"), h("div", { class: "max" }, x)))));
}

/* ---------------------------------------------------------------- list or claim */

/* Menu lines: "Section / Category | Name | 220 | Description" or "Section | Name | 8 inch: 529; 12 inch: 749" */
function itemsToText(items) {
  return (items || []).map((it) => [
    (it.section || "Menu") + (it.category ? " / " + it.category : ""),
    it.name,
    it.options ? it.options.map((o) => o.label + ": " + o.price).join("; ") : String(it.price),
    it.description || "",
    it.image ? it.image.src : "",
  ].join(" | ").replace(/( \| )+$/, "")).join("\n");
}

function textToItems(text, oldItems) {
  const byName = new Map((oldItems || []).map((it) => [norm(it.name), it]));
  const items = [], errors = [], ids = new Set();
  text.split("\n").map((l) => l.trim()).filter(Boolean).forEach((line, n) => {
    const parts = line.split("|").map((x) => x.trim());
    if (parts.length < 3) { errors.push("Line " + (n + 1) + ": use Section | Name | Price."); return; }
    const pic = parts.length > 3 && /^https?:\/\//i.test(parts[parts.length - 1]) ? parts.pop() : "";
    const [secCat, name, priceText, description] = parts;
    if (pic && !safeImageUrl(pic)) { errors.push("Line " + (n + 1) + ": the picture must be a JPEG, PNG or WebP file on one of the listed hosts."); return; }
    const [section, category] = secCat.split("/").map((x) => x.trim());
    const old = byName.get(norm(name));
    let id = old ? old.id : slug(name);
    while (ids.has(id)) id += "-2";
    ids.add(id);
    const it = { id, name, section: section || "Menu" };
    if (category) it.category = category;
    if (description) it.description = description;
    if (pic) it.image = { src: safeImageUrl(pic) };
    if (/^\d+$/.test(priceText)) it.price = Number(priceText);
    else {
      const opts = priceText.split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
        const m = /^(.+?):\s*(\d+)$/.exec(x);
        return m ? { id: (old && (old.options || []).find((o) => norm(o.label) === norm(m[1])) || {}).id || slug(m[1]), label: m[1].trim(), price: Number(m[2]) } : null;
      });
      if (opts.length < 2 || opts.some((o) => !o)) { errors.push("Line " + (n + 1) + ": a price must be a whole number, or two or more options like 8 inch: 529; 12 inch: 749."); return; }
      it.options = opts;
    }
    items.push(it);
  });
  if (!items.length) errors.push("Add at least one item.");
  return { items, errors };
}

function viewJoin() {
  const zones = zonesList();
  const out = h("div", { "aria-live": "polite" });
  const feeTable = h("div");
  let existing = null; // the unclaimed listing being claimed or merged, if any
  const mergeBox = h("div", { "aria-live": "polite" });
  /* Someone listing a new business may not know a volunteer already listed it. If the phone
     number matches an unclaimed listing, offer to merge it so its history is kept. */
  async function checkMerge() {
    if (existing) return;
    const found = await findListingByPhone(val("phone"), true);
    if (found.error) { mergeBox.replaceChildren(); return; }
    mergeBox.replaceChildren(notice("info", h("p", { class: "flush" }, "An unclaimed listing already uses this phone number: " + found.menu.name + ". Merge it into your listing, so its history is kept and there is no duplicate?"),
      h("nav", { class: "wrap" }, h("button", { type: "button", on: { click: () => { fill(found.menu); mergeBox.replaceChildren(notice("info", h("p", { class: "flush" }, "Merged. Your listing will replace " + found.menu.name + "."))); } } }, h("span", null, "Merge")),
        h("button", { type: "button", class: "border", on: { click: () => mergeBox.replaceChildren() } }, h("span", null, "It is a different business")))));
  }

  const zoneOptions = [["", "Choose a zone"]].concat(zones.map((z) => [z.id, z.name]));

  function renderFees() {
    const scope = val("scope");
    const home = val("zone");
    const rows = [];
    if (scope === "ccc") {
      rows.push(h("p", { class: "small-text muted" }, "Set a fee for your own zone and one flat fee for every other zone, or turn on per-zone fees."));
      rows.push(textFieldFor("fee-home", "Delivery fee in " + (home ? areaName(home) : "your zone") + " (BDT)", "number"));
      rows.push(check("perzone", "Set a different fee for each zone", false));
      rows.push(h("div", { id: "fee-rest" }));
    } else {
      rows.push(h("p", { class: "small-text muted" }, "Tick each zone you deliver to and give its fee."));
      for (const z of zones) {
        rows.push(check("z-" + z.id, "Deliver to " + z.name, z.id === home), textFieldFor("fee-" + z.id, "Fee to " + z.name + " (BDT)", "number"));
      }
    }
    feeTable.replaceChildren(...rows);
    const per = document.getElementById("perzone");
    const rest = document.getElementById("fee-rest");
    const drawRest = () => {
      if (!rest) return;
      rest.replaceChildren(...(per && per.checked
        ? zones.filter((z) => z.id !== home).map((z) => textFieldFor("fee-" + z.id, "Fee to " + z.name + " (BDT)", "number"))
        : [textFieldFor("fee-rest-flat", "Delivery fee to every other zone (BDT)", "number")]));
    };
    if (per) per.addEventListener("change", drawRest);
    drawRest();
  }
  function textFieldFor(id, label, type) { return textField(id, label, input(id, { type: type || "text", min: type === "number" ? 0 : null, max: type === "number" ? B.rules.max_delivery_fee : null })); }

  function fill(m) {
    existing = m;
    const set = (id, v) => { const e = document.getElementById(id); if (e && v !== undefined && v !== null) e.value = v; };
    set("name", m.name); set("kind", m.kind); set("phone", m.business_phone); set("address", m.address);
    set("zone", (B.areaById.get(m.neighbourhood) || {}).kind === "zone" ? m.neighbourhood : "");
    set("plus", m.plus_code || "");
    const wa = (m.contact || []).find((c) => c.app === "whatsapp");
    set("whatsapp", wa ? "+" + wa.id : "");
    set("items", itemsToText(m.items));
    set("cuisine", (FOOD_BY_KEY[cuisineKey(m)] || [0, ""])[1]);
    renderFees();
    snackbar("Filled in from the existing listing. Check every detail.");
  }

  const form = h("form", { novalidate: true, on: { submit: (e) => { e.preventDefault(); build(); } } },
    claimTarget ? notice("info", h("p", { class: "flush" }, "Claiming the existing listing for " + claimTarget.name + ". Its details are filled in below; check every one.")) : null,
    sectionTitle("1. Your business"),
    textField("name", "Business name", input("name", { maxlength: 80 })),
    select("kind", "Type of business", KINDS.map((k) => [k, k]), KINDS[0]),
    select("cuisine", "Main cuisine", [["", "Other or mixed"]].concat(FOOD.filter((f) => !["sides", "drink", "combo"].includes(f[0])).map((f) => [f[1], f[1]])), ""),
    hint("Used to choose a stock cover photo until you add your own."),
    textField("phone", "Business phone", input("phone", { inputmode: "tel", maxlength: 14, on: { change: checkMerge } })),
    mergeBox,
    hint("Use the format +8801XXXXXXXXX."),
    textField("whatsapp", "WhatsApp number (if any)", input("whatsapp", { inputmode: "tel", maxlength: 14 })),
    check("sms", "Customers may also send orders by text message to the business phone", true),
    h("details", null, h("summary", { class: "link" }, "Other ways to receive orders (optional)"),
      hint("Only if your business already uses them. WhatsApp and text messages are enough for most businesses."),
      textField("ch-email", "Email address", input("ch-email", { type: "email" })),
      textField("ch-matrix", "Matrix ID, for example @kitchen:matrix.org", input("ch-matrix")),
      textField("ch-xmpp", "XMPP address, for example kitchen@example.org", input("ch-xmpp")),
      textField("ch-signal", "Signal number, for example +8801XXXXXXXXX", input("ch-signal", { inputmode: "tel" })),
      textField("ch-endpoint", "Order endpoint (https)", input("ch-endpoint", { type: "url" })),
      textField("ch-feed", "Confirmation feed (https)", input("ch-feed", { type: "url" })),
      hint("A feed lets customers' phones pick up your signed confirmations by themselves. Use an ntfy topic you control, for example https://ntfy.example.org/kitchen-confirmed; the Confirm page then publishes each confirmation to it."),
      textField("cover", "Cover picture address (optional)", input("cover", { type: "url" })),
      hint("A JPEG, PNG or WebP file on Wikimedia Commons (upload.wikimedia.org), your GitHub, Codeberg or GitLab repository, or i.ibb.co. Other addresses are not shown."),
      hint("An endpoint receives each order as plain text by HTTPS POST and must allow requests from the Hana site (CORS). A self-hosted ntfy topic works, for example https://ntfy.example.org/kitchen-orders. Customers then send orders without opening another app.")),
    textField("address", "Street address", input("address", { maxlength: 200 })),
    select("zone", "Zone (thana) the business is in", zoneOptions, ""),
    textField("plus", "Plus Code (optional)", input("plus", { maxlength: 13 })),
    hint("The full code from a map app, for example 7MJH9R66+7MF."),

    sectionTitle("2. Opening hours"),
    textField("open", "Opens", input("open", { type: "time" })),
    textField("close", "Closes", input("close", { type: "time" })),
    hint("A closing time earlier than the opening time means the business closes after midnight, for example 7:00 p.m. to 3:30 a.m."),
    h("nav", { class: "wrap" }, DAYS.map((d) => check("day-" + d, DAY_NAMES[d], true))),

    sectionTitle("3. Delivery, pickup and payment"),
    select("scope", "Where do you deliver?", [["ccc", "The whole city (all CCC zones)"], ["zones", "Only some zones"]], "ccc"),
    feeTable,
    textField("min", "Minimum order (BDT)", input("min", { type: "number", min: 0 })),
    hint("Enter 0 if there is no minimum."),
    textField("eta", "Usual delivery time (minutes)", input("eta", { type: "number", min: 5, max: 240 })),
    h("p", { class: "small-text muted" }, "Delivery fees may not exceed " + money(B.rules.max_delivery_fee) + ". You can change fees later with Update prices."),
    check("pickup", "Customers can pick up orders", true),
    check("scheduled", "Customers may schedule orders for later, including while the business is closed", false),
    h("p", { class: "small-text bold" }, "Ways to pay at delivery or pickup (no prepayment)"),
    h("nav", { class: "vertical left-align" }, Object.entries(B.rules.payment_methods_on_delivery || {}).map(([k, label]) => check("pay-" + k, label, k === "cash"))),

    sectionTitle("4. Menu"),
    h("p", { class: "small-text muted" }, "One item per line: Section | Name | Price | Description (optional) | Picture address (optional). Items without a picture show a food icon. To add a category, put it after the section with a slash, for example South Asian / Starters. For sizes, write the prices as in 8 inch: 529; 12 inch: 749. Prices are whole taka and include VAT and every other charge."),
    textField("items", "Menu items", h("textarea", { id: "items", rows: 10 })),

    sectionTitle("5. Where your menu file will live"),
    h("p", { class: "small-text muted" }, "A claimed listing is edited from the business's own account on GitHub, Codeberg, GitLab or another open forge, so that only the business can change it. Create a free account and a public repository first."),
    textField("account", "Your account page", input("account", { type: "url" })),
    hint("For example https://github.com/yourbusiness or https://codeberg.org/yourbusiness."),
    textField("source", "Repository for your menu", input("source", { type: "url" })),
    hint("For example https://github.com/yourbusiness/hana-menu."),
    textField("raw", "Direct address of menu.json (optional)", input("raw", { type: "url" })),
    hint("The address of the raw file once uploaded, for example https://raw.githubusercontent.com/yourbusiness/hana-menu/main/menu.json."),

    sectionTitle("6. Pledges"),
    h("nav", { class: "vertical left-align" }, Object.entries(PLEDGES).map(([k, text]) => check("pledge-" + k, text, false))),

    sectionTitle("7. Your key"),
    h("p", { class: "small-text muted" }, "Your key signs your menu and your order confirmations, so customers and the community can tell they really came from you. It stays on your device."),
    keyBox(),
    h("div", { class: "space" }),
    h("nav", null, h("button", { type: "submit", class: "responsive" }, icon("verified"), h("span", null, "Prepare my listing and claim"))));

  async function build() {
    const errors = [];
    const phone = val("phone").replace(/[\s-]/g, "");
    const wa = val("whatsapp").replace(/[\s+-]/g, "");
    if (!val("name")) errors.push("Enter the business name.");
    if (!/^\+8801\d{9}$/.test(phone)) errors.push("Enter the business phone in the format +8801XXXXXXXXX.");
    if (wa && !/^8801\d{9}$/.test(wa)) errors.push("Enter the WhatsApp number in the format +8801XXXXXXXXX.");
    if (!wa && !checked("sms")) errors.push("Give at least one way to receive written orders: WhatsApp or text message.");
    if (!val("address")) errors.push("Enter the street address.");
    if (!val("zone")) errors.push("Choose the zone the business is in.");
    const plus = val("plus").toUpperCase();
    const loc = plus ? olcDecode(plus) : null;
    if (plus && !loc) errors.push("The Plus Code must be a full code, for example 7MJH9R66+7MF.");
    if (!val("open") || !val("close") || val("open") === val("close")) errors.push("Enter different opening and closing times.");
    const cap = B.rules.max_delivery_fee;
    const fee = (id) => { const v = val(id); return /^\d+$/.test(v) ? Number(v) : NaN; };
    const zonesOut = [];
    const common = { min_order: /^\d+$/.test(val("min")) ? Number(val("min")) : NaN, eta_min: /^\d+$/.test(val("eta")) ? Number(val("eta")) : NaN };
    if (isNaN(common.min_order) || isNaN(common.eta_min)) errors.push("Enter the minimum order and the usual delivery time as whole numbers.");
    const home = val("zone");
    if (val("scope") === "ccc") {
      if (home) zonesOut.push({ id: home, shape: "named", areas: [home], fee: fee("fee-home") });
      if (checked("perzone")) {
        for (const z of zonesList()) if (z.id !== home) zonesOut.push({ id: z.id, shape: "named", areas: [z.id], fee: fee("fee-" + z.id) });
      } else zonesOut.push({ id: "ccc", shape: "named", areas: ["ccc"], fee: fee("fee-rest-flat") });
    } else {
      for (const z of zonesList()) if (checked("z-" + z.id)) zonesOut.push({ id: z.id, shape: "named", areas: [z.id], fee: fee("fee-" + z.id) });
      if (!zonesOut.length) errors.push("Tick at least one zone you deliver to.");
    }
    for (const z of zonesOut) {
      Object.assign(z, common);
      if (isNaN(z.fee)) errors.push("Enter a delivery fee for " + areaName(z.areas[0]) + ".");
      else if (z.fee > cap) errors.push("The fee for " + areaName(z.areas[0]) + " is above the limit of " + money(cap) + ".");
    }
    const pay = Object.keys(B.rules.payment_methods_on_delivery || {}).filter((k) => checked("pay-" + k));
    if (!pay.length) errors.push("Choose at least one way to pay at delivery.");
    const parsed = textToItems(document.getElementById("items").value, existing && existing.items);
    errors.push(...parsed.errors);
    const account = val("account"), source = val("source"), raw = val("raw");
    if (!/^https:\/\/\S+$/.test(account) || !/^https:\/\/\S+$/.test(source)) errors.push("Enter your account page and repository as https addresses.");
    if (raw && !/^https:\/\/\S+$/.test(raw)) errors.push("The direct address of menu.json must start with https://.");
    for (const k of Object.keys(PLEDGES)) if (!checked("pledge-" + k)) errors.push("Sign all four pledges to claim a listing.");
    if (!B.key) errors.push("Create or load your key.");
    if (val("ch-email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val("ch-email"))) errors.push("Check the email address.");
    if (val("ch-matrix") && !/^@[^:\s]+:[^\s]+$/.test(val("ch-matrix"))) errors.push("A Matrix ID has the form @name:server.org.");
    if (val("ch-xmpp") && !/^[^@\s]+@[^@\s]+$/.test(val("ch-xmpp"))) errors.push("An XMPP address has the form name@server.org.");
    if (val("ch-signal") && !/^\+?8801\d{9}$/.test(val("ch-signal").replace(/[\s-]/g, ""))) errors.push("Enter the Signal number in the format +8801XXXXXXXXX.");
    if (val("ch-endpoint") && !/^https:\/\/\S+$/.test(val("ch-endpoint"))) errors.push("The order endpoint must start with https://.");
    if (val("ch-feed") && !/^https:\/\/\S+$/.test(val("ch-feed"))) errors.push("The confirmation feed must start with https://.");
    if (val("cover") && !safeImageUrl(val("cover"))) errors.push("The cover picture must be a JPEG, PNG or WebP file on one of the listed hosts.");
    if (errors.length) { out.replaceChildren(notice("warn", h("ul", null, Array.from(new Set(errors)).map((x) => h("li", null, x))))); out.scrollIntoView({ block: "start" }); return; }

    const hours = {};
    for (const d of DAYS) hours[d] = checked("day-" + d) ? [[val("open"), val("close")]] : [];
    const contact = [];
    if (wa) contact.push({ app: "whatsapp", id: wa, preferred: true });
    if (checked("sms")) contact.push({ app: "sms", id: phone.replace(/^\+/, ""), preferred: !wa });
    const extra = [["email", val("ch-email")], ["matrix", val("ch-matrix")], ["xmpp", val("ch-xmpp")],
      ["signal", val("ch-signal").replace(/[\s+-]/g, "")], ["endpoint", val("ch-endpoint")]];
    for (const [app, id] of extra) if (id) contact.push({ app, id });
    const now = new Date();
    const stamp = new Date(now.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 19) + "+06:00";
    const menu = {
      id: await sha256Hex(B.key.publicRaw), claimed: true, version: 1,
      name: val("name"), kind: val("kind"), neighbourhood: home, address: val("address"),
    };
    if (plus) { menu.plus_code = plus; menu.location = loc; }
    Object.assign(menu, {
      business_phone: phone, hours, delivery: { zones: zonesOut }, contact,
      pickup: checked("pickup"), scheduled_orders: checked("scheduled"), payment_on_delivery: pay,
      pledges: Object.fromEntries(Object.keys(PLEDGES).map((k) => [k, { signed: true, date: stamp.slice(0, 10) }])),
      owner: { account, menu_source: source, public_key: B.key.publicB64 },
      items: parsed.items,
    });
    if (val("cuisine")) menu.cuisine = val("cuisine");
    if (val("cover")) menu.cover = { src: safeImageUrl(val("cover")) };
    if (val("ch-feed")) menu.confirmation_feed = val("ch-feed");
    let changes = [];
    if (existing) {
      menu.replaces = existing.id;
      const row = B.index.find((r) => r.id === existing.id);
      const vs = row ? await versionsOf(row) : [];
      menu.replaces_hash = vs.length ? vs[0].hash : "";
      changes = diffMoney(existing, menu);
    }
    const summary = existing ? "Listing claimed and confirmed by the business." + (changes.length ? " Prices and fees updated." : "") : "First listing, published by the business.";
    menu.announcement = { published: stamp, summary, changes };
    menu.price_history = (existing ? (existing.price_history || []) : []).concat(changes.length ? [{ version: 1, published: stamp, summary, changes }] : []);
    await signMenu(menu, B.key);
    const bytes = menuBytes(menu);
    const hash = await sha256Hex(bytes);
    const claimCode = b32(await crypto.subtle.digest("SHA-256", B.key.publicRaw).then((d) => new Uint8Array(d))).slice(0, 8);
    const issue = issueText(menu, hash, claimCode, raw, existing);
    const repo = repoUrl();
    const issueUrl = repo && /github\.com/.test(repo)
      ? repo + "/issues/new?labels=" + encodeURIComponent("claim") + "&title=" + encodeURIComponent((existing ? "Claim: " : "New listing: ") + menu.name) + "&body=" + encodeURIComponent(issue)
      : null;
    out.replaceChildren(
      sectionTitle("Your listing is ready"),
      notice("info", h("p", { class: "bold flush" }, "Claim code: " + claimCode),
        h("p", { class: "flush" }, "Two community members will contact your business phone and ask you to read this code aloud. Keep it until the check is done.")),
      h("ol", null,
        h("li", null, "Download menu.json and upload it to your repository (", source, ")."),
        h("li", null, "Submit the verification request. It contains no private information."),
        h("li", null, "Two community members check your claim (see CLAIMS.md). When they approve, your listing is added and the volunteer-entered listing, if any, is replaced.")),
      h("nav", { class: "wrap" },
        h("button", { type: "button", on: { click: () => download("menu.json", new TextDecoder().decode(bytes)) } }, icon("download"), h("span", null, "Download menu.json")),
        issueUrl ? h("a", { class: "button border", href: issueUrl, target: "_blank", rel: "noopener" }, icon("open_in_new"), h("span", null, "Submit on GitHub")) : null,
        h("button", { type: "button", class: "border", on: { click: () => copy(issue) } }, icon("content_copy"), h("span", null, "Copy the request"))),
      h("p", { class: "small-text muted" }, "No GitHub account? Copy the request and send it to a volunteer listed in VOLUNTEERS.md, or open it on any mirror of the project."),
      h("details", null, h("summary", { class: "link" }, "Show the request"), h("pre", null, issue)));
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  show("join", "List or claim", pageHeader("List or claim your business", "#/"),
    h("p", { class: "muted" }, "Free. Everything is prepared on this device and nothing is sent until you submit the request."),
    form, out);
  if (claimTarget) { fill(claimTarget); claimTarget = null; }
  document.getElementById("scope").addEventListener("change", renderFees);
  document.getElementById("zone").addEventListener("change", renderFees);
  renderFees();
}

function issueText(menu, hash, claimCode, raw, existing) {
  const zones = menu.delivery.zones.map((z) => "- " + z.areas.map(areaName).join(", ") + ": " + money(z.fee) + " delivery, minimum " + money(z.min_order) + ", about " + z.eta_min + " min").join("\n");
  return [
    (existing ? "## Claim of an existing listing\n\nListing being claimed: " + existing.name + " (" + existing.id + ")" : "## New listing"),
    "",
    "Business: " + menu.name + " (" + menu.kind + ")",
    "Zone: " + areaName(menu.neighbourhood),
    "Address: " + menu.address,
    "Business phone: " + menu.business_phone,
    "Ordering: " + menu.contact.map((c) => CHANNELS[c.app].label + " " + contactText(c.app, c.id)).join(", "),
    "Pickup: " + (menu.pickup ? "yes" : "no"),
    "Payment at delivery: " + menu.payment_on_delivery.join(", "),
    "Items: " + menu.items.length,
    "",
    "### Delivery areas and fees",
    zones,
    "",
    "### Owner",
    "Account: " + menu.owner.account,
    "Menu repository: " + menu.owner.menu_source,
    "Direct address of menu.json: " + (raw || "(to be added)"),
    "Public key: " + menu.owner.public_key,
    "Listing ID (SHA-256 of the public key): " + menu.id,
    "SHA-256 of menu.json: " + hash,
    "Claim code: " + claimCode,
    "",
    "### Pledges",
    "The owner signed the courier identity, data handling, fair pricing and record-keeping pledges on " + menu.pledges.fair_pricing.date + ".",
    "",
    "### For the vouchers (CLAIMS.md)",
    "- [ ] Voucher 1 called the business phone, found from an independent source, and heard the claim code",
    "- [ ] Voucher 2 did the same check separately",
    "- [ ] The menu.json in the repository has the hash above and a valid signature (`python3 tools/hana_sign.py verify`)",
    "- [ ] The business exists at the address (visit, or a public listing with the same address and phone)",
    "- [ ] The account and repository belong to the business",
    "- [ ] Prices include all charges; delivery fees are within the limit; no prepayment is asked",
  ].join("\n");
}

/* ---------------------------------------------------------------- claim a listing */

let claimTarget = null;
function viewClaim() {
  const out = h("div", { "aria-live": "polite" });
  const phone = input("claim-phone", { inputmode: "tel", maxlength: 14 });
  show("join", "Claim a listing", pageHeader("Claim a listing", "#/"),
    h("p", { class: "muted" }, "Enter your business phone number. If a volunteer has listed your business, you can claim it. Claims are verified by two community members (CLAIMS.md)."),
    textField("claim-phone", "Business phone", phone),
    h("nav", null, h("button", { type: "button", on: { click: async () => {
      const found = await findListingByPhone(phone.value, true);
      if (found.error) { out.replaceChildren(notice("info", h("p", { class: "flush" }, found.error + " If your business is not listed yet, create a new listing.")), h("nav", null, h("a", { href: "#/join", class: "button border" }, h("span", null, "New listing")))); return; }
      out.replaceChildren(h("article", { class: "round border no-elevate" }, h("h2", { class: "card-title" }, found.menu.name), h("p", { class: "muted" }, found.menu.address),
        h("nav", null, h("button", { type: "button", on: { click: () => { claimTarget = found.menu; location.hash = "#/join"; } } }, icon("verified"), h("span", null, "Claim this listing")))));
    } } }, h("span", null, "Find my listing"))),
    out);
}

/* ---------------------------------------------------------------- your own website */

function viewSite() {
  const out = h("div", { "aria-live": "polite" });
  const phone = input("site-phone", { inputmode: "tel", maxlength: 14 });
  show("home", "Your own website", pageHeader("Your own website", "#/"),
    h("p", null, "This makes one HTML file for your business: your menu, ordering and confirmations, in the Hana design, with the line \u201cCreated using Hana by Hamid Yasir & Co.\u201d It reads your listing from the Hana directory whenever it is online, so your prices and hours stay the same everywhere, and it still works offline."),
    h("ol", null, h("li", null, "Find your listing with your business phone."), h("li", null, "Download the file and upload it as index.html to any web host, for example GitHub Pages or Codeberg Pages in your menu repository."), h("li", null, "Keep your listing on Hana. Your site and the Hana app show the same listing.")),
    textField("site-phone", "Business phone", phone),
    h("nav", null, h("button", { type: "button", on: { click: async (e) => {
      const found = await findListingByPhone(phone.value, false);
      if (found.error) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, found.error))); return; }
      try {
        const html = await buildStandalone({ mode: "business", listingId: found.row.id, site: B.site });
        download("index.html", html, "text/html");
        out.replaceChildren(notice("info", h("p", { class: "flush" }, "Downloaded the website for " + found.menu.name + ". Upload it as index.html.")));
      } catch (err) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, "The website could not be made: " + err.message))); }
    } } }, icon("download"), h("span", null, "Make my website"))),
    out);
}

/* ---------------------------------------------------------------- confirm an order */

function decodeOrder(text, versions) {
  const m = CHECK_LINE.exec(text || "");
  if (!m) return { error: "No check line found. Paste the whole order message, including the last line that starts with CHECK." };
  const code = (/Order ([0-9A-HJKMNP-TV-Z]{6})/.exec(text) || [])[1];
  if (!code) return { error: "The order code is missing from the message." };
  const v = versions.find((x) => x.hash.startsWith(m[1]));
  if (!v) return { error: "This order uses a menu version that is not published for this listing." };
  const menu = v.menu;
  const prices = {};
  for (const l of priceLines(menu)) prices[l.key] = l;
  const lines = [], flags = [];
  let sub = 0;
  for (const part of m[3].split(",")) {
    const [key, q] = part.split("*");
    const qty = Number(q);
    if (!prices[key] || !(qty >= 1 && qty <= 99)) return { error: "The order lists an item that is not on menu version " + menu.version + "." };
    lines.push({ label: prices[key].label, qty, total: prices[key].price * qty });
    sub += prices[key].price * qty;
  }
  let fee;
  if (m[2] === "pickup") fee = "0";
  else {
    const z = ((menu.delivery && menu.delivery.zones) || []).find((x) => x.id === m[2]);
    if (!z) return { error: "The order names a delivery area that is not on the menu." };
    fee = z.fee === null || z.fee === undefined ? "?" : String(z.fee);
  }
  if (Number(m[4]) !== sub) flags.push("The subtotal in the message (" + money(m[4]) + ") does not match the menu (" + money(sub) + "). Charge the menu price.");
  if (m[5] !== fee) flags.push("The delivery fee in the message does not match the menu.");
  const newest = Math.max(...versions.map((x) => x.menu.version));
  if (menu.version !== newest) flags.push("The customer ordered from menu version " + menu.version + "; the current version is " + newest + ". Honour the prices the customer saw, or explain the change.");
  return { check: m[0], code, checkCode: m[6], zone: m[2], lines, sub, fee, menu, flags, fields: m, hash: v.hash };
}

function viewConfirm() {
  const out = h("div", { "aria-live": "polite" });
  const msg = h("textarea", { id: "order-text", rows: 8, placeholder: " " });
  show("confirm", "Confirm an order", pageHeader("Confirm an order", "#/"),
    h("p", { class: "muted" }, "Paste the customer's whole message. Nothing leaves this device."),
    textField("listing-phone", "Your business phone", input("listing-phone", { inputmode: "tel", maxlength: 14, value: (() => { try { return localStorage.getItem("hana.biz.phone") || ""; } catch (e) { return ""; } })() })),
    textField("order-text", "Customer's order message", msg),
    h("nav", null, h("button", { type: "button", on: { click: async () => {
      const found = await findListingByPhone(val("listing-phone"), false);
      if (found.error) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, found.error))); return; }
      try { localStorage.setItem("hana.biz.phone", val("listing-phone")); } catch (e) { /* ignore */ }
      const versions = found.versions;
      const d = decodeOrder(msg.value, versions);
      if (d.error) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, d.error))); return; }
      const expected = await checkCode(d.hash, d.fields[2], d.fields[3], d.fields[4], d.fields[5]);
      if (expected !== d.checkCode) d.flags.push("The check code does not match: the message was edited or mistyped. Use the items and prices shown here.");
      const eta = input("eta-min", { type: "number", min: 0, max: 999 });
      const reply = h("pre");
      const owner = d.menu.owner && d.menu.owner.public_key;
      const makeReply = async () => {
        const e = /^\d{1,3}$/.test(eta.value) ? eta.value : "?";
        let k = "-", s = "-";
        if (B.key) {
          if (owner && B.key.publicB64 !== owner) { snackbar("This key does not belong to this listing."); return; }
          k = B.key.id;
        }
        const minute = unixMinutes();
        if (B.key) s = b64u(await signBytes(B.key, confirmMessage(d.check, d.code, e, minute)));
        reply.textContent = "Order " + d.code + " is confirmed." + (e !== "?" ? " Expected in about " + e + " minutes." : "") + "\nCONFIRMED hana1 O=" + d.code + " C=" + d.checkCode + " E=" + e + " T=" + minute + " K=" + k + " S=" + s;
      };
      out.replaceChildren(
        sectionTitle("Order " + d.code),
        d.flags.length ? notice("warn", h("ul", null, d.flags.map((f) => h("li", null, f)))) : notice("info", h("p", { class: "flush" }, "The order matches your published menu.")),
        h("ul", { class: "list border" }, d.lines.map((l) => h("li", null, h("div", { class: "max" }, l.qty + " × " + l.label), h("span", { class: "price" }, money(l.total)))),
          h("li", null, h("div", { class: "max bold" }, "Items"), h("span", { class: "price bold" }, money(d.sub))),
          h("li", null, h("div", { class: "max" }, d.zone === "pickup" ? "Pickup" : "Delivery fee (" + areaName(d.zone) + ")"), h("span", { class: "price" }, d.fee === "?" ? "Not stated" : money(d.fee)))),
        textField("eta-min", "Minutes until delivery or pickup (optional)", eta),
        owner ? h("div", null, h("p", { class: "small-text muted" }, "Load your key to sign the confirmation."), keyBox(makeReply)) :
          h("p", { class: "small-text muted" }, "This listing has no key yet, so the confirmation is not signed. Claim the listing to sign confirmations."),
        h("nav", { class: "wrap" },
          h("button", { type: "button", on: { click: makeReply } }, icon("check_circle"), h("span", null, "Prepare a confirmation")),
          h("button", { type: "button", class: "border", on: { click: () => { reply.textContent = "Sorry, we cannot take order " + d.code + " right now.\nDECLINED " + d.code; } } }, icon("close"), h("span", null, "Prepare a decline"))),
        reply,
        h("nav", { class: "wrap" }, h("button", { type: "button", class: "border", on: { click: () => reply.textContent ? copy(reply.textContent) : snackbar("Prepare the reply first.") } }, icon("content_copy"), h("span", null, "Copy reply")),
          d.menu.confirmation_feed ? h("button", { type: "button", class: "border", on: { click: async () => {
            if (!/S=[A-Za-z0-9_-]{86}/.test(reply.textContent)) { snackbar("Prepare a signed confirmation first."); return; }
            try { await sendDirect(d.menu.confirmation_feed, reply.textContent); snackbar("Published. The customer's phone will pick it up."); } catch (err) { snackbar("Could not publish: " + err.message); }
          } } }, icon("send"), h("span", null, "Publish to my confirmation feed")) : null),
        h("p", { class: "small-text muted" }, "Send the reply in the same chat as the order. The customer pastes it into Hana, and only then does the order count. Take payment only on delivery or at pickup."));
    } } }, icon("check_circle"), h("span", null, "Check the order"))),
    out);
}

/* ---------------------------------------------------------------- update prices */

function viewUpdate() {
  const out = h("div", { "aria-live": "polite" });
  const editor = h("div");
  const file = h("input", { type: "file", id: "menufile", accept: ".json,application/json" });
  let prevBytes = null, prev = null;

  function renderEditor() {
    const rows = [];
    for (const it of prev.items || []) {
      const lines = it.options ? it.options.map((o) => ({ id: "p-" + it.id + "--" + o.id, label: it.name + " (" + o.label + ")", value: o.price })) : [{ id: "p-" + it.id, label: it.name, value: it.price }];
      for (const l of lines) rows.push(textField(l.id, l.label, input(l.id, { type: "number", min: 0, value: l.value })));
    }
    const zrows = ((prev.delivery && prev.delivery.zones) || []).map((z) => h("div", null,
      textField("zf-" + z.id, "Delivery fee, " + z.areas.map(areaName).join(", "), input("zf-" + z.id, { type: "number", min: 0, max: B.rules.max_delivery_fee, value: z.fee })),
      textField("zm-" + z.id, "Minimum order, " + z.areas.map(areaName).join(", "), input("zm-" + z.id, { type: "number", min: 0, value: z.min_order }))));
    editor.replaceChildren(
      sectionTitle("Prices (BDT, including every charge)"), ...rows,
      sectionTitle("Delivery fees and minimum orders"), ...zrows,
      textField("summary", "Short public note about the change", input("summary", { maxlength: 200 })),
      sectionTitle("Sign"), keyBox(),
      h("nav", null, h("button", { type: "button", class: "responsive", on: { click: publish } }, icon("verified"), h("span", null, "Prepare the new version"))));
  }

  async function publish() {
    const next = JSON.parse(new TextDecoder().decode(prevBytes));
    const num = (id) => { const v = val(id); return /^\d+$/.test(v) ? Number(v) : NaN; };
    const errors = [];
    for (const it of next.items || []) {
      if (it.options) for (const o of it.options) { o.price = num("p-" + it.id + "--" + o.id); if (isNaN(o.price)) errors.push(it.name + ": enter a whole number."); }
      else { it.price = num("p-" + it.id); if (isNaN(it.price)) errors.push(it.name + ": enter a whole number."); }
    }
    for (const z of (next.delivery && next.delivery.zones) || []) {
      z.fee = num("zf-" + z.id); z.min_order = num("zm-" + z.id);
      if (isNaN(z.fee) || isNaN(z.min_order)) errors.push("Enter every delivery fee and minimum order as a whole number.");
      else if (z.fee > B.rules.max_delivery_fee) errors.push("A delivery fee is above the limit of " + money(B.rules.max_delivery_fee) + ".");
    }
    if (!B.key) errors.push("Load your key.");
    else if (!next.owner || next.owner.public_key !== B.key.publicB64) errors.push("This key does not belong to this listing.");
    const changes = errors.length ? [] : diffMoney(prev, next);
    if (!errors.length && !changes.length) errors.push("Nothing has changed.");
    if (!val("summary") && changes.length) errors.push("Write a short public note about the change.");
    if (errors.length) { out.replaceChildren(notice("warn", h("ul", null, Array.from(new Set(errors)).map((x) => h("li", null, x))))); return; }
    const stamp = new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 19) + "+06:00";
    next.version = prev.version + 1;
    next.previous = await sha256Hex(prevBytes);
    delete next.replaces; delete next.replaces_hash;
    next.announcement = { published: stamp, summary: val("summary"), changes };
    next.price_history = (prev.price_history || []).concat([{ version: next.version, published: stamp, summary: val("summary"), changes }]);
    await signMenu(next, B.key);
    const text = new TextDecoder().decode(menuBytes(next));
    out.replaceChildren(
      sectionTitle("Version " + next.version + " is ready"),
      h("ul", { class: "list border" }, changes.map((c) => h("li", null, h("div", { class: "max" }, c.label), h("span", { class: "price" }, (c.old === null ? "new" : money(c.old)) + " to " + (c.new === null ? "removed" : money(c.new)))))),
      h("p", null, "Upload both files to your repository: versions/" + next.version + ".json and menu.json (they are identical). Keep every older version file. The change is announced to customers automatically."),
      h("nav", { class: "wrap" },
        h("button", { type: "button", on: { click: () => download(next.version + ".json", text) } }, icon("download"), h("span", null, "Download versions/" + next.version + ".json")),
        h("button", { type: "button", class: "border", on: { click: () => download("menu.json", text) } }, icon("download"), h("span", null, "Download menu.json"))));
  }

  show("update", "Update prices", pageHeader("Update prices and delivery fees", "#/"),
    h("p", { class: "muted" }, "For claimed listings. Load your current published menu.json, change what you need and sign the new version with your key. Every change is published in the menu's price history."),
    textField("menufile", "Current menu.json", file),
    h("nav", null, h("button", { type: "button", class: "border", on: { click: async () => {
      try {
        prevBytes = await readFile(file);
        prev = JSON.parse(new TextDecoder().decode(prevBytes));
        if (!prev.claimed) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, "This listing is not claimed yet. Claim it first."))); return; }
        renderEditor();
      } catch (e) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, e.message))); }
    } } }, icon("upload"), h("span", null, "Load menu.json"))),
    editor, out);
}

/* ---------------------------------------------------------------- start */

function route() {
  trackPage();
  const hash = location.hash || "#/";
  if (hash === "#/join") return viewJoin();
  if (hash === "#/confirm") return viewConfirm();
  if (hash === "#/update") return viewUpdate();
  if (hash === "#/claim") return viewClaim();
  if (hash === "#/site") return viewSite();
  return viewHome();
}

for (const i of document.querySelectorAll("i[data-icon]")) i.replaceWith(icon(i.getAttribute("data-icon")));
window.addEventListener("hashchange", route);
loadDirectory().then(() => {
  const a = document.getElementById("repo-link");
  const u = repoUrl();
  a.setAttribute("href", u || "index.html#/about");
  route();
});
setupUpdates(["business.html", "core.js", "business.js", "theme/theme.css"]);
