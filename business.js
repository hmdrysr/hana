/* Hana business tools. Needs core.js. Everything runs on this phone or computer:
   nothing is uploaded, and the private key never leaves the device. See SPEC.md,
   sections 4.1 (claims and keys), 5.4 (price changes) and 6.5 (confirmations). */
"use strict";

const main = document.getElementById("main");
const B = {
  site: { repo_url: "", company_url: "https://hamidyasir.com" },
  rules: { max_delivery_fee: 150, payment_methods_on_delivery: { cash: "Cash" } },
  areas: [], areaById: new Map(), index: [], menus: new Map(), key: null, vault: null, loaded: false,
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
  return { jwk: { kty: "OKP", crv: "Ed25519", d: jwk.d, x: jwk.x }, publicRaw: pub, publicB64: b64u(pub), id: await keyId(pub), enc: await createEncKey() };
}
/* The encryption key (P-256) that customers' apps use to seal orders sent in Hana. */
async function createEncKey() {
  const p = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const priv = await crypto.subtle.exportKey("jwk", p.privateKey);
  return { priv: { kty: "EC", crv: "P-256", d: priv.d, x: priv.x, y: priv.y }, pub: { kty: "EC", crv: "P-256", x: priv.x, y: priv.y } };
}

async function loadKey(bytes) {
  const data = JSON.parse(new TextDecoder().decode(bytes));
  const jwk = data.jwk || data;
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.d || !jwk.x) throw new Error("This is not a Hana key file.");
  const pub = unb64u(jwk.x);
  const enc = data.enc && data.enc.priv && data.enc.pub ? data.enc : await createEncKey();
  return { jwk: { kty: "OKP", crv: "Ed25519", d: jwk.d, x: jwk.x }, publicRaw: pub, publicB64: jwk.x, id: await keyId(pub), enc, encAdded: !data.enc };
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

/* Every update on an order sent in Hana is signed with the listing key (SPEC.md, section 21). */
async function postUpdate(o, obj) {
  if (!B.key) throw new Error("Sign in under Connections first.");
  obj = Object.assign({ from: "b", at: new Date().toISOString() }, obj);
  await signUpdate(B.key.jwk, o.code, obj);
  await postSealed(o.reply, o.keyRaw, obj);
}

function keyFileText(key) {
  return JSON.stringify({ about: "Hana business key. Keep this file private and keep a backup. Anyone with it can sign as your business. Hana never asks for it.", key_id: key.id, created: new Date().toISOString(), jwk: key.jwk, enc: key.enc }, null, 2) + "\n";
}

/* Sign-in: the key is unlocked from the listing's vault with a passkey or the recovery phrase
   (vault.js, SPEC.md section 22). A key file still works, under "Other ways". */
function keyBox(onReady) {
  const box = h("div", { class: "stack", "aria-live": "polite" });
  const keep = h("input", { type: "checkbox", id: "keepkey", checked: B.keyRemembered || !B.key });
  const remember = async () => { if (keep.checked && B.key) { await KEYSTORE.set(B.key); B.keyRemembered = true; } };
  const say = (tone, text) => notice(tone, h("p", { class: "flush" }, text));
  const label = () => "Hana: " + ((store.get("hana.biz.menu", null) || {}).name || "my business");
  const busy = async (e, fn) => {
    const b = e.currentTarget; b.disabled = true;
    try { await fn(); } catch (err) { draw(say("warn", err.name === "NotAllowedError" ? "The passkey request was cancelled." : err.message)); }
    b.disabled = false;
  };
  const signedIn = async (opened, vault) => {
    const key = await loadKey(new TextEncoder().encode(opened.keyText));
    if (vault.key_id && vault.key_id !== key.id) throw new Error("This vault holds a different key from the one it names.");
    B.key = key; B.vault = { doc: vault, dek: opened.dek };
    await remember();
    draw(say("info", "Signed in."));
    if (onReady) onReady();
  };
  const vaultFor = async (phone) => {
    const found = await findListingByPhone(phone, false);
    if (found.error) throw new Error(found.error);
    try { localStorage.setItem("hana.biz.phone", phone); } catch (e) { /* ignore */ }
    const v = await fetchVault(found.row);
    if (!v) throw new Error("Sign-in has not been set up for this listing yet. Load your key file under Other ways, then set up sign-in.");
    return v;
  };
  const vaultFiles = (extra) => {
    const text = vaultText(B.vault.doc);
    return h("div", { class: "stack" },
      extra || null,
      h("p", { class: "small-text muted" }, "Publish vault.json next to menu.json in your repository. It is encrypted and opens only with your passkey or recovery phrase."),
      h("nav", { class: "wrap" }, publishButton([{ path: "vault.json", text }], "Hana sign-in for key " + B.key.id),
        h("button", { type: "button", class: "border", on: { click: () => download("vault.json", text) } }, icon("download"), h("span", null, "Download vault.json"))));
  };
  const addPk = (e) => busy(e, async () => {
    B.vault.doc = await addPasskey(B.vault.doc, B.vault.dek, label());
    draw(vaultFiles(say("info", "Passkey added for this device. Publish the updated vault.json so it works next time.")));
  });
  function draw(top) {
    const kids = [top || null];
    if (B.key) {
      kids.push(h("p", { class: "small-text muted" }, "Signed in with key " + B.key.id + "."));
      if (B.vault) {
        kids.push(h("nav", { class: "wrap" },
          passkeySupported() ? h("button", { type: "button", class: "border", on: { click: addPk } }, icon("fingerprint"), h("span", null, "Add a passkey on this device")) : null));
      } else {
        kids.push(h("p", { class: "small-text" }, "Set up sign-in, so you never need to carry the key file: you get a five-word recovery phrase, and you can add your phone's fingerprint, face or screen lock as a passkey."),
          h("nav", { class: "wrap" }, h("button", { type: "button", on: { click: (e) => busy(e, async () => {
            const phrase = await newPhrase();
            B.vault = await makeVault(keyFileText(B.key), B.key.id, phrase);
            B.vault = { doc: B.vault.vault, dek: B.vault.dek };
            draw(vaultFiles(h("div", { class: "stack" },
              notice("warn", h("p", { class: "flush" }, "Your recovery phrase:"), h("p", { class: "bold flush", id: "recovery-phrase" }, phrase),
                h("p", { class: "flush" }, "Write these five words on paper and keep them somewhere safe. Anyone with them can sign as your business, and Hana cannot recover them.")),
              passkeySupported() ? h("nav", { class: "wrap" }, h("button", { type: "button", class: "border", on: { click: addPk } }, icon("fingerprint"), h("span", null, "Add a passkey on this device"))) : null)));
          }) } }, icon("key"), h("span", null, "Set up sign-in"))));
      }
    } else {
      let phone0 = ""; try { phone0 = localStorage.getItem("hana.biz.phone") || ""; } catch (e) { /* ignore */ }
      const ph = input("si-phone", { inputmode: "tel", value: phone0 });
      const words = input("si-words", { autocomplete: "off", autocapitalize: "none", spellcheck: "false" });
      kids.push(textField("si-phone", "Business phone", ph),
        passkeySupported() ? h("nav", { class: "wrap" }, h("button", { type: "button", on: { click: (e) => busy(e, async () => { const v = await vaultFor(ph.value); await signedIn(await unlockWithPasskey(v), v); }) } }, icon("fingerprint"), h("span", null, "Sign in with passkey"))) : null,
        textField("si-words", "Recovery phrase (five words)", words),
        h("nav", { class: "wrap" }, h("button", { type: "button", class: "border", on: { click: (e) => busy(e, async () => { const v = await vaultFor(ph.value); await signedIn(await unlockWithPhrase(v, words.value), v); }) } }, icon("key"), h("span", null, "Sign in with recovery phrase"))),
        h("details", null, h("summary", null, "Other ways"),
          h("div", { class: "stack" },
            h("nav", { class: "wrap" }, h("button", { type: "button", class: "border", on: { click: (e) => busy(e, async () => {
              try { B.key = await createKey(); } catch (err) { throw new Error("This browser cannot create Ed25519 keys. Use an up-to-date Chrome, Firefox or Safari."); }
              B.vault = null;
              await remember();
              draw(say("info", "New key created: " + B.key.id + ". Now set up sign-in."));
              if (onReady) onReady();
            }) } }, icon("add"), h("span", null, "Create a new key (new business)"))),
            file,
            h("nav", { class: "wrap" }, h("button", { type: "button", class: "border", on: { click: () => file.click() } }, icon("upload"), h("span", null, "Load my key file"))))));
    }
    if (B.key) kids.push(h("nav", { class: "wrap" }, h("button", { type: "button", class: "border", on: { click: () => download("hana-key-" + B.key.id + ".json", keyFileText(B.key)) } }, icon("download"), h("span", null, "Download a backup key file"))));
    kids.push(h("div", { class: "row" }, h("label", { class: "switch" }, keep, h("span")), h("label", { for: "keepkey", class: "max" }, "Stay signed in on this device")));
    box.replaceChildren(...kids.filter(Boolean));
  }
  const file = h("input", { type: "file", id: "keyfile", accept: ".json,application/json", hidden: true, on: { change: async () => {
    try {
      B.key = await loadKey(await readFile(file));
      B.vault = null;
      await remember();
      draw(say("info", "Key loaded: " + B.key.id + "." + (B.key.encAdded ? " An encryption key for orders sent in Hana was added; set up sign-in or download the backup key file again." : "")));
      if (onReady) onReady();
    } catch (e) { draw(say("warn", e.message)); }
  } } });
  draw();
  return box;
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
  const found = await findListingByPhoneRaw(phone, unclaimedOnly);
  if (!found.error && !unclaimedOnly) store.set("hana.biz.menu", found.menu);
  return found;
}
async function findListingByPhoneRaw(phone, unclaimedOnly) {
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
    h("article", { class: "round border no-elevate" }, h("h2", { class: "card-title" }, "Orders"),
      h("p", null, "Check each order against your published menu, then confirm or decline it with one tap."),
      h("nav", null, h("a", { href: "#/confirm", class: "button" }, icon("inbox"), h("span", null, "Open orders")))),
    h("article", { class: "round border no-elevate" }, h("h2", { class: "card-title" }, "Your menu"),
      h("p", null, "Change items, prices, sizes, delivery fees and delivery times, and publish a signed new version."),
      h("nav", null, h("a", { href: "#/update", class: "button" }, icon("edit_note"), h("span", null, "Edit my menu")))),
    h("article", { class: "round border no-elevate" }, h("h2", { class: "card-title" }, "New to Hana?"),
      h("p", null, "List your business, or claim the listing a volunteer entered. Point of sale, receipts, riders, backups and your own website are under More."),
      h("nav", { class: "wrap" }, h("a", { href: "#/join", class: "button border" }, icon("add_business"), h("span", null, "List my business")),
        h("a", { href: "#/claim", class: "button border" }, icon("verified"), h("span", null, "Claim a listing")),
        h("a", { href: "#/more", class: "button border" }, icon("tune"), h("span", null, "More tools")))),
    notice("info", h("p", { class: "bold flush" }, "What leaves your device"),
      h("p", { class: "flush" }, "Only your menu and your directory listing are published, to your own repository and the Hana directory on GitHub. Orders, sales, receipts, customer details, riders, keys and tokens stay on this device, or go only to services you connect yourself.")),
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
    it.options ? it.options.map((o) => o.label + ": " + (o.price === null ? "?" : o.price)).join("; ") : (it.price === null || it.price === undefined ? "?" : String(it.price)),
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
    if (priceText === "?" || priceText === "") it.price = null;
    else if (/^\d+$/.test(priceText)) it.price = Number(priceText);
    else {
      const opts = priceText.split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
        const m = /^(.+?):\s*(\d+|\?)$/.exec(x);
        return m ? { id: (old && (old.options || []).find((o) => norm(o.label) === norm(m[1])) || {}).id || slug(m[1]), label: m[1].trim(), price: m[2] === "?" ? null : Number(m[2]) } : null;
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
  const itemsEditor = menuEditor([], []);
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
      rows.push(feeRow("fee-home", home ? areaName(home) : "Your zone"));
      rows.push(check("perzone", "Set a different fee for each zone", false));
      rows.push(h("div", { id: "fee-rest" }));
    } else {
      rows.push(h("p", { class: "small-text muted" }, "Tick each zone you deliver to and give its fee."));
      for (const z of zones) {
        rows.push(check("z-" + z.id, "Deliver to " + z.name, z.id === home), feeRow("fee-" + z.id, z.name));
      }
    }
    feeTable.replaceChildren(...rows);
    const per = document.getElementById("perzone");
    const rest = document.getElementById("fee-rest");
    const drawRest = () => {
      if (!rest) return;
      rest.replaceChildren(...(per && per.checked
        ? zones.filter((z) => z.id !== home).map((z) => feeRow("fee-" + z.id, z.name))
        : [feeRow("fee-rest-flat", "Every other zone")]));
    };
    if (per) per.addEventListener("change", drawRest);
    drawRest();
  }
  /* Fee and delivery time for one zone, side by side. */
  function feeRow(id, place) {
    return h("div", { class: "field-row" },
      textField(id, place + ": fee (BDT)", input(id, { type: "number", min: 0, max: B.rules.max_delivery_fee })),
      textField("eta-" + id, "Minutes", input("eta-" + id, { type: "number", min: 5, max: 240 })));
  }
  function textFieldFor(id, label, type) { return textField(id, label, input(id, { type: type || "text", min: type === "number" ? 0 : null, max: type === "number" ? B.rules.max_delivery_fee : null })); }

  function fill(m) {
    existing = m;
    const set = (id, v) => { const e = document.getElementById(id); if (e && v !== undefined && v !== null) e.value = v; };
    set("name", m.name); set("handle", m.handle || ""); set("kind", m.kind); set("phone", m.business_phone); set("address", m.address);
    set("zone", (B.areaById.get(m.neighbourhood) || {}).kind === "zone" ? m.neighbourhood : "");
    set("plus", m.plus_code || "");
    const wa = (m.contact || []).find((c) => c.app === "whatsapp");
    set("whatsapp", wa ? "+" + wa.id : "");
    itemsEditor.load(m.items);
    set("cuisine", (FOOD_BY_KEY[cuisineKey(m)] || [0, ""])[1]);
    renderFees();
    snackbar("Filled in from the existing listing. Check every detail.");
  }

  const form = h("form", { novalidate: true, on: { submit: (e) => { e.preventDefault(); build(); } } },
    claimTarget ? notice("info", h("p", { class: "flush" }, "Claiming the existing listing for " + claimTarget.name + ". Its details are filled in below; check every one.")) : null,
    sectionTitle("1. Your business"),
    textField("name", "Business name", input("name", { maxlength: 80 })),
    textField("handle", "Handle, for your web address", input("handle", { maxlength: 30, autocapitalize: "off", spellcheck: "false" })),
    hint("Lowercase letters and numbers, for example mealmaster. Your page will be at …/restaurants/mealmaster and customers can find you as @mealmaster."),
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
    textField("eta", "Usual delivery time, for zones where you leave Minutes blank", input("eta", { type: "number", min: 5, max: 240 })),
    hint("Customers see your delivery time plus " + (B.rules.confirmation_window_minutes || 15) + " minutes, the time you have to confirm, as the estimated arrival."),
    h("p", { class: "small-text muted" }, "Delivery fees may not exceed " + money(B.rules.max_delivery_fee) + ". You can change fees later with Update prices."),
    check("pickup", "Customers can pick up orders", true),
    check("scheduled", "Customers may schedule orders for later, including while the business is closed", false),
    h("p", { class: "small-text bold" }, "Ways to pay at delivery or pickup (no prepayment)"),
    h("nav", { class: "vertical left-align" }, Object.entries(B.rules.payment_methods_on_delivery || {}).map(([k, label]) => check("pay-" + k, label, k === "cash"))),

    sectionTitle("4. Menu"),
    h("p", { class: "small-text muted" }, "Add your items section by section, for example Starters, Pizza and Drinks. Prices are whole taka and include VAT and every other charge. For an item sold in more than one size, add each size with its price. If you do not know a price, leave it blank: customers then ask the business, which gives the price when it confirms."),
    itemsEditor,

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

    sectionTitle("7. Sign-in"),
    h("p", { class: "small-text muted" }, "Your key signs your menu and your order confirmations, so customers and the community can tell they really came from you. Create it here, then set up sign-in: a five-word recovery phrase and, if your phone supports it, a passkey."),
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
    if (isNaN(common.min_order)) errors.push("Enter the minimum order as a whole number.");
    const home = val("zone");
    if (val("scope") === "ccc") {
      if (home) zonesOut.push({ id: home, shape: "named", areas: [home], fee: fee("fee-home"), _eta: "eta-fee-home" });
      if (checked("perzone")) {
        for (const z of zonesList()) if (z.id !== home) zonesOut.push({ id: z.id, shape: "named", areas: [z.id], fee: fee("fee-" + z.id), _eta: "eta-fee-" + z.id });
      } else zonesOut.push({ id: "ccc", shape: "named", areas: ["ccc"], fee: fee("fee-rest-flat"), _eta: "eta-fee-rest-flat" });
    } else {
      for (const z of zonesList()) if (checked("z-" + z.id)) zonesOut.push({ id: z.id, shape: "named", areas: [z.id], fee: fee("fee-" + z.id), _eta: "eta-fee-" + z.id });
      if (!zonesOut.length) errors.push("Tick at least one zone you deliver to.");
    }
    for (const z of zonesOut) {
      const own = val(z._eta);
      delete z._eta;
      Object.assign(z, common, /^\d+$/.test(own) ? { eta_min: Number(own) } : {});
      if (isNaN(z.eta_min)) errors.push("Enter the delivery time in minutes for " + areaName(z.areas[0]) + ", or a usual delivery time.");
      if (isNaN(z.fee)) errors.push("Enter a delivery fee for " + areaName(z.areas[0]) + ".");
      else if (z.fee > cap) errors.push("The fee for " + areaName(z.areas[0]) + " is above the limit of " + money(cap) + ".");
    }
    const pay = Object.keys(B.rules.payment_methods_on_delivery || {}).filter((k) => checked("pay-" + k));
    if (!pay.length) errors.push("Choose at least one way to pay at delivery.");
    const parsed = itemsEditor.read();
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
    const hd = val("handle").replace(/^@/, "").toLowerCase();
    if (hd && !/^[a-z0-9]{3,30}$/.test(hd)) errors.push("The handle must be 3 to 30 lowercase letters or numbers.");
    if (hd && B.index.some((r) => r.handle === hd && (!existing || r.id !== existing.id))) errors.push("The handle @" + hd + " is already taken.");
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
    if (val("handle")) menu.handle = val("handle").replace(/^@/, "").toLowerCase();
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
        publishButton([{ path: "menu.json", text: new TextDecoder().decode(bytes) }], "Hana listing for " + menu.name),
        h("button", { type: "button", class: "border", on: { click: () => download("menu.json", new TextDecoder().decode(bytes)) } }, icon("download"), h("span", null, "Download menu.json")),
        issueUrl ? h("a", { class: "button border", href: issueUrl, target: "_blank", rel: "noopener" }, icon("open_in_new"), h("span", null, "Submit on GitHub")) : null,
        h("button", { type: "button", class: "border", on: { click: () => copy(issue) } }, icon("content_copy"), h("span", null, "Copy the request"))),
      h("p", { class: "small-text muted" }, "No GitHub account? Copy the request and send it to a volunteer listed in VOLUNTEERS.md, or open it on any mirror of the project."),
      h("details", null, h("summary", { class: "link" }, "Show the request"), h("pre", null, issue)));
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  show("join", "List or claim", pageHeader("List or claim your business", "#/more"),
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
  show("join", "Claim a listing", pageHeader("Claim a listing", "#/more"),
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
  show("home", "Your own website", pageHeader("Your own website", "#/more"),
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
  const code = (/(?:CONFIRMED|Order reference|Order) ([0-9A-HJKMNP-TV-Z]{6})/.exec(text) || [])[1];
  if (!code) return { error: "The order code is missing from the message." };
  const v = versions.find((x) => x.hash.startsWith(m[1]));
  if (!v) return { error: "This order uses a menu version that is not published for this listing." };
  const menu = v.menu;
  const prices = {};
  for (const l of priceLines(menu)) prices[l.key] = l;
  const lines = [], flags = [];
  let sub = 0, unlisted = false;
  for (const part of m[3].split(",")) {
    const [key, q] = part.split("*");
    const qty = Number(q);
    if (!prices[key] || !(qty >= 1 && qty <= 99)) return { error: "The order lists an item that is not on menu version " + menu.version + "." };
    const p = prices[key].price;
    lines.push({ label: prices[key].label, qty, total: p === null || p === undefined ? null : p * qty });
    sub += (p || 0) * qty;
    if (p === null || p === undefined) unlisted = true;
  }
  let fee;
  if (m[2] === "pickup") fee = "0";
  else {
    const z = ((menu.delivery && menu.delivery.zones) || []).find((x) => x.id === m[2]);
    if (!z) return { error: "The order names a delivery area that is not on the menu." };
    fee = z.fee === null || z.fee === undefined ? "?" : String(z.fee);
  }
  if (unlisted) flags.push("Some items have no listed price. When you confirm, tell the customer the price of each item and the total, including the delivery fee.");
  if (Number(m[4]) !== sub) flags.push("The subtotal in the message (" + money(m[4]) + ") does not match the menu (" + money(sub) + "). Charge the menu price.");
  if (m[5] !== fee) flags.push("The delivery fee in the message does not match the menu.");
  const newest = Math.max(...versions.map((x) => x.menu.version));
  if (menu.version !== newest) flags.push("The customer ordered from menu version " + menu.version + "; the current version is " + newest + ". Honour the prices the customer saw, or explain the change.");
  return { check: m[0], code, checkCode: m[6], zone: m[2], lines, sub, fee, menu, flags, fields: m, hash: v.hash };
}

/* The check, the decoded order and the reply, for one order message. */
async function orderPanel(text, found, onDone, direct) {
  const cancel = CANCEL_LINE.exec(text || "");
  if (cancel && !CHECK_LINE.test(text)) return notice("warn", h("p", { class: "flush" }, "This is a cancellation: the customer cancelled order " + cancel[1] + ". Do not prepare it."));
  const d = decodeOrder(text, found.versions);
  if (d.error) return notice("warn", h("p", { class: "flush" }, d.error));
  const expected = await checkCode(d.hash, d.fields[2], d.fields[3], d.fields[4], d.fields[5]);
  if (expected !== d.checkCode) d.flags.push("The check code does not match: the message was edited or mistyped. Use the items and prices shown here.");
  const eta = input("eta-" + d.code, { type: "number", min: 0, max: 999 });
  const reply = h("pre", { hidden: true });
  const owner = d.menu.owner && d.menu.owner.public_key;
  const feed = d.menu.confirmation_feed;
  const finish = async (textOut, label) => {
    reply.hidden = false;
    reply.textContent = textOut;
    if (direct) {
      try {
        await postUpdate({ reply: direct.reply, keyRaw: direct.keyRaw, code: d.code }, { t: /^DECLINED/m.test(textOut) ? "decline" : "confirm", line: textOut });
        snackbar(label + ". The customer's app shows it now.");
      } catch (err) { snackbar("Could not reach the customer's app: " + err.message + " Try again."); return; }
    } else if (feed && (/S=[A-Za-z0-9_-]{86}/.test(textOut) || /^DECLINED/m.test(textOut))) {
      try { await sendDirect(feed, textOut); snackbar(label + " and published. The customer's phone will pick it up."); } catch (err) { snackbar("Could not publish: " + err.message); }
    } else snackbar(label + ". Copy the reply and send it in the customer's chat.");
    if (onDone) onDone(label, /^\d{1,3}$/.test(eta.value) ? Number(eta.value) : null);
  };
  const confirm = async () => {
    const e = /^\d{1,3}$/.test(eta.value) ? eta.value : "?";
    let k = "-", s = "-";
    if (B.key) {
      if (owner && B.key.publicB64 !== owner) { snackbar("This key does not belong to this listing."); return; }
      k = B.key.id;
    }
    const minute = unixMinutes();
    if (B.key) s = b64u(await signBytes(B.key, confirmMessage(d.check, d.code, e, minute)));
    recordBtn.hidden = false;
    finish("Order " + d.code + " is confirmed." + (e !== "?" ? " Expected in about " + e + " minutes." : "") + "\nCONFIRMED hana1 O=" + d.code + " C=" + d.checkCode + " E=" + e + " T=" + minute + " K=" + k + " S=" + s, "Confirmed");
  };
  const recordBtn = h("button", { type: "button", class: "border", hidden: true, on: { click: async () => {
    const sale = await saleFromOrder(d, text);
    location.hash = "#/pos/" + sale.id;
  } } }, icon("receipt_long"), h("span", null, "Record the sale and print a receipt"));
  return h("div", { class: "order-panel" },
    d.flags.length ? notice("warn", h("ul", null, d.flags.map((f) => h("li", null, f)))) : notice("info", h("p", { class: "flush" }, "The order matches your published menu.")),
    h("ul", { class: "list border" }, d.lines.map((l) => h("li", null, h("div", { class: "max" }, l.qty + " × " + l.label), h("span", { class: "price" }, l.total === null ? "Price not listed" : money(l.total)))),
      h("li", null, h("div", { class: "max bold" }, "Items"), h("span", { class: "price bold" }, money(d.sub))),
      h("li", null, h("div", { class: "max" }, d.zone === "pickup" ? "Pickup" : "Delivery fee (" + areaName(d.zone) + ")"), h("span", { class: "price" }, d.fee === "?" ? "Not stated" : money(d.fee)))),
    textField("eta-" + d.code, direct ? "Preparation time in minutes (you are reminded when it runs out)" : "Minutes until delivery or pickup (optional)", eta),
    owner && !B.key ? h("p", { class: "small-text muted" }, "Sign in under Connections to sign the confirmation.") : null,
    !owner ? h("p", { class: "small-text muted" }, "This listing has no key yet, so the confirmation is not signed. Claim the listing to sign confirmations.") : null,
    h("nav", { class: "wrap" },
      h("button", { type: "button", on: { click: confirm } }, icon("check_circle"), h("span", null, "Confirm")),
      h("button", { type: "button", class: "border", on: { click: () => finish("Sorry, we cannot take order " + d.code + " right now.\nDECLINED " + d.code, "Declined") } }, icon("close"), h("span", null, "Decline")),
      h("button", { type: "button", class: "border", on: { click: () => reply.textContent ? copy(reply.textContent) : snackbar("Confirm or decline first.") } }, icon("content_copy"), h("span", null, "Copy reply")),
      recordBtn),
    reply);
}

/* The steps of an accepted order sent in Hana. Each step reaches the customer's app at once. */
const STEP_TEXT = { accepted: "Accepted, being prepared", ready: "Ready", out: "Out for delivery", delivered: "Delivered", picked: "Picked up" };
function progressPanel(o, redraw) {
  const pickup = /Z=pickup /.test(o.text);
  const send = async (step, extra) => {
    try {
      await postUpdate(o, Object.assign({ t: "status", step, text: STEP_TEXT[step] }, extra || {}));
      const l = inboxOrders(); const x = l.find((y) => y.id === o.id);
      if (x) { x.step = step; if (step === "delivered" || step === "picked") x.status = "done"; if (extra && extra.rider) x.rider = extra.rider; saveInbox(l); }
      snackbar(STEP_TEXT[step] + ". The customer's app shows it now.");
      redraw();
    } catch (e) { snackbar("Could not reach the customer's app. Check your connection and try again."); }
  };
  const step = o.step || "accepted";
  const kids = [h("p", { class: "flush" }, "Now: " + STEP_TEXT[step] + (o.rider ? " (rider " + o.rider.name + ", " + o.rider.phone + ")" : "") + ".")];
  if (o.prep && step === "accepted") kids.push(h("p", { class: "small-text muted flush" }, "Preparation time: " + o.prep + " minutes, until about " + clock(new Date(o.accepted_at + o.prep * 60000).toTimeString().slice(0, 5)) + "."));
  if (step === "accepted") kids.push(h("nav", null, h("button", { type: "button", on: { click: () => send("ready") } }, icon("check_circle"), h("span", null, pickup ? "Ready for pickup" : "Ready"))));
  if (!pickup && (step === "accepted" || step === "ready")) {
    const rn = input("rn-" + o.id, { maxlength: 40 }), rp = input("rp-" + o.id, { inputmode: "tel", maxlength: 14 });
    kids.push(h("div", { class: "field-row" }, textField("rn-" + o.id, "Rider's name", rn), textField("rp-" + o.id, "Rider's mobile", rp)),
      h("nav", null, h("button", { type: "button", class: step === "ready" ? "" : "border", on: { click: () => {
        const phone = rp.value.replace(/[\s-]/g, "").replace(/^0/, "+880");
        if (!rn.value.trim() || !/^\+8801\d{9}$/.test(phone)) { snackbar("Enter the rider's name and mobile number before sending the order out."); return; }
        send("out", { rider: { name: rn.value.trim().slice(0, 40), phone } });
      } } }, icon("moped"), h("span", null, "Out for delivery"))));
  }
  if (step === "out" || (pickup && step === "ready")) kids.push(h("nav", null, h("button", { type: "button", on: { click: () => send(pickup ? "picked" : "delivered") } }, icon("check_circle"), h("span", null, pickup ? "Picked up and paid" : "Delivered and paid"))));
  return h("div", { class: "order-panel" }, kids);
}

function bizChat(o, redraw) {
  return h("div", { class: "stack" }, sectionTitle("Messages with the customer"),
    chatBox(o.chat, "b", ["Running about 10 minutes late.", "The rider is outside.", "We cannot find the address. Please call us."], async (text) => {
      try { await postUpdate(o, { t: "chat", text }); } catch (e) { snackbar("Could not send. Check your connection."); return; }
      const l = inboxOrders(); const x = l.find((y) => y.id === o.id);
      if (x) { x.chat = (x.chat || []).concat({ from: "b", text, at: new Date().toISOString() }); saveInbox(l); }
      redraw();
    }));
}

/* Orders that reached this device, kept for 24 hours: { id, time, code, text, reply, keyRaw, status }. */
function inboxOrders() { const cut = Date.now() / 1000 - 86400; return store.get("hana.biz.inbox", []).filter((o) => o.time > cut); }
function saveInbox(list) { store.set("hana.biz.inbox", list.slice(0, 100)); }

/* A short two-tone alert, made by the browser (no sound file). */
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.25 + 0.22);
      o.start(ctx.currentTime + i * 0.25); o.stop(ctx.currentTime + i * 0.25 + 0.23);
    });
  } catch (e) { /* no sound on this device */ }
}

/* Takes in one ntfy message: a new order (sealed, or plain from an older endpoint), or a
   customer's follow-up on an order's own topic. Returns true when something changed. */
async function takeMessage(m) {
  const list = inboxOrders();
  const text = m.message || "";
  if (list.some((o) => o.id === m.id)) return false;
  if (/^HANA1 /.test(text)) {
    if (!B.key || !B.key.enc) { snackbar("A new order arrived. Sign in under Connections to open it."); return false; }
    let opened = null;
    try { opened = await openOrder(B.key.enc.priv, text); } catch (e) { return false; }
    if (!opened || !opened.order || !CHECK_LINE.test(opened.order.message || "")) return false;
    list.unshift({ id: m.id, time: m.time, code: opened.order.code, text: opened.order.message, reply: opened.order.reply, keyRaw: opened.keyRaw, cpub: typeof opened.order.cpub === "string" ? opened.order.cpub : null, status: "new" });
  } else if (CHECK_LINE.test(text)) {
    list.unshift({ id: m.id, time: m.time, code: (/(?:CONFIRMED|Order reference|Order) ([0-9A-HJKMNP-TV-Z]{6})/.exec(text) || [])[1] || "?", text, status: "new" });
  } else if (/^HANA1R /.test(text)) {
    const o = list.find((x) => x.reply && x.reply.endsWith("/" + m.topic));
    if (!o) return false;
    let msg = null;
    try { msg = await dUnseal(await aesFromRaw(o.keyRaw), text.slice(7)); } catch (e) { return false; }
    if (msg.from !== "c") return false;
    /* The customer signs with the key named in the order: a message without a valid signature
       is ignored, so the customer's messages cannot be made up later either. */
    const verified = await checkUpdate(o.cpub, o.code, msg);
    if (o.cpub && verified === false) return false;
    if (msg.t === "cancel") o.status = "cancelled";
    else if (msg.t === "chat") o.chat = (o.chat || []).concat({ from: "c", text: String(msg.text || "").slice(0, 500), at: msg.at, verified, signed: verified ? msg : null });
    else return false;
  } else {
    const cancel = CANCEL_LINE.exec(text);
    const o = cancel && list.find((x) => x.code === cancel[1]);
    if (!o) return false;
    o.status = "cancelled";
  }
  saveInbox(list);
  return true;
}

function viewConfirm() {
  const c = conn();
  const out = h("div", { "aria-live": "polite" });
  const inbox = h("div", { class: "stack", "aria-live": "polite" });
  const msg = h("textarea", { id: "order-text", rows: 6, placeholder: " " });
  const phone = () => { try { return localStorage.getItem("hana.biz.phone") || ""; } catch (e) { return ""; } };
  const listing = async () => {
    const found = await findListingByPhone(val("listing-phone"), false);
    if (!found.error) { try { localStorage.setItem("hana.biz.phone", val("listing-phone")); } catch (e) { /* ignore */ } }
    return found;
  };
  let found = null, stop = () => {};
  async function draw() {
    if (!document.body.contains(inbox)) { stop(); return; }
    if (!found || found.error) found = await listing();
    if (found.error) { inbox.replaceChildren(h("p", { class: "small-text muted" }, "Enter your business phone above to see new orders.")); return; }
    const list = inboxOrders();
    if (!list.length) { inbox.replaceChildren(h("p", { class: "muted" }, "No orders in the last 24 hours. New orders appear here by themselves, with a sound.")); return; }
    inbox.replaceChildren(...list.map((o) => {
      const body = h("div");
      const label = o.status === "cancelled" ? "cancelled by the customer" : o.status === "answered" ? "answered" : o.status === "accepted" ? STEP_TEXT[o.step || "accepted"].toLowerCase() : o.status === "done" ? "completed" : "new";
      const det = h("details", { class: "info-list", open: o.status === "new" },
        h("summary", { class: "row" }, icon(o.status === "new" ? "inbox" : o.status === "cancelled" ? "close" : "check_circle"),
          h("span", { class: "max" }, "Order " + o.code + ", " + clock(new Date(o.time * 1000).toTimeString().slice(0, 5)) + " (" + label + ")"), icon("expand_more")),
        body);
      if (o.status === "cancelled") body.replaceChildren(notice("warn", h("p", { class: "flush" }, "The customer cancelled this order. Do not prepare it.")));
      else if (o.reply && (o.status === "accepted" || o.status === "done")) body.replaceChildren(progressPanel(o, draw), bizChat(o, draw));
      else orderPanel(o.text, found, (label, eta) => {
        const l = inboxOrders(); const x = l.find((y) => y.id === o.id);
        if (x) { Object.assign(x, label === "Confirmed" ? { status: "accepted", accepted_at: Date.now(), prep: eta, step: "accepted" } : { status: "answered" }); saveInbox(l); }
        if (o.reply && label === "Confirmed") setTimeout(draw, 600);
      }, o.reply ? { reply: o.reply, keyRaw: o.keyRaw } : null).then((p) => body.replaceChildren(p));
      return det;
    }));
  }
  async function listen() {
    stop();
    if (!c.orders) return;
    const topics = [c.orders].concat(inboxOrders().filter((o) => o.reply && o.status !== "cancelled").map((o) => o.reply)).slice(0, 30);
    for (const t of topics) { try { for (const m of await ntfyPoll(t, "12h")) await takeMessage(Object.assign({ topic: t.split("/").pop() }, m)); } catch (e) { /* offline */ } }
    draw();
    stop = ntfyListen(topics, async (m) => {
      if (!(await takeMessage(m))) return;
      const isNew = /^HANA1 |CHECK hana1/.test(m.message || "");
      if (isNew) {
        chime();
        if ("Notification" in window && Notification.permission === "granted") { try { new Notification("New Hana order", { body: "Open Orders to confirm it within 15 minutes.", icon: "icon-192.png" }); } catch (e) { /* ignore */ } }
        listen();
      } else draw();
    });
  }
  show("confirm", "Orders", pageHeader("Orders", "#/"),
    textField("listing-phone", "Your business phone", input("listing-phone", { inputmode: "tel", maxlength: 14, value: phone() })),
    c.orders ? [
      sectionTitle("New orders"),
      c.paused ? notice("warn", h("p", { class: "flush" }, "New orders are paused. Customers see you as temporarily unavailable. Resume under Connections.")) : null,
      "Notification" in window && Notification.permission === "default" ? h("nav", null, h("button", { type: "button", class: "border", on: { click: () => Notification.requestPermission().then(() => viewConfirm()) } }, icon("inbox"), h("span", null, "Turn on order alerts"))) : null,
      inbox]
      : notice("info", h("p", { class: "flush" }, "Customers can send orders straight to this page, with a sound when one arrives. Set up orders in Hana under Connections.")),
    sectionTitle("Check a pasted order"),
    h("p", { class: "small-text muted" }, "For orders that came by WhatsApp, text message or email: paste the customer's whole message. Nothing leaves this device."),
    textField("order-text", "Customer's order message", msg),
    h("nav", null, h("button", { type: "button", on: { click: async () => {
      const f = await listing();
      out.replaceChildren(f.error ? notice("warn", h("p", { class: "flush" }, f.error)) : await orderPanel(msg.value, f));
    } } }, icon("check_circle"), h("span", null, "Check the order"))),
    out,
    h("p", { class: "small-text muted" }, "Take payment only on delivery or at pickup."));
  document.getElementById("listing-phone").addEventListener("change", () => { found = null; draw(); });
  if (c.orders) {
    listen();
    /* Remind when a preparation time runs out before the order is marked ready. */
    const timer = setInterval(() => {
      if (!document.body.contains(inbox)) { clearInterval(timer); return; }
      const l = inboxOrders();
      const due = l.filter((o) => o.status === "accepted" && (o.step || "accepted") === "accepted" && o.prep && !o.reminded && Date.now() > o.accepted_at + o.prep * 60000);
      if (!due.length) return;
      for (const o of due) o.reminded = true;
      saveInbox(l);
      chime();
      snackbar("Preparation time is up for order " + due.map((o) => o.code).join(", ") + ". Mark it ready, or tell the customer.");
    }, 60000);
  }
}

/* Alerts while these tools are closed: ntfy's own browser-push support, subscribed straight
   from this page (no ntfy app or account). Renewed each time the tools open. */
async function enablePush(quiet) {
  const c = conn();
  try {
    if (!c.orders) throw new Error("Set up orders in Hana first.");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser cannot show alerts while Hana is closed. On an iPhone, add Hana to the home screen first.");
    const base = c.orders.replace(/[^/]+$/, "");
    const cfg = await (await fetch(base + "config.js", { cache: "no-store" })).text();
    const key = (/"?web_push_public_key"?\s*:\s*"([A-Za-z0-9_-]+)"/.exec(cfg) || [])[1];
    if (!key) throw new Error("This ntfy server does not offer browser alerts.");
    if ((await Notification.requestPermission()) !== "granted") throw new Error("Alerts are blocked in this browser's settings.");
    const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("sw.js"));
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) }));
    const j = sub.toJSON();
    const r = await fetch(base + "v1/webpush", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: j.endpoint, auth: j.keys.auth, p256dh: j.keys.p256dh, topics: [c.orders.split("/").pop()] }) });
    if (!r.ok) throw new Error("ntfy answered " + r.status + ".");
    saveConn(Object.assign(conn(), { push: true }));
    if (!quiet) snackbar("Alerts are on. New orders now show on this device even while Hana is closed.");
  } catch (e) { if (!quiet) snackbar(e.message); }
}

/* Presence: while these tools are open and orders are not paused, tell customers' apps that
   the business is available (SPEC.md, section 21). */
function presenceBeat(state) {
  const c = conn();
  if (!c.orders) return;
  const word = state || (c.paused ? "offline" : "online");
  fetch(presenceTopic(c.orders), { method: "POST", body: word, keepalive: true }).catch(() => {});
}
function startPresence() {
  if (!conn().orders) return;
  presenceBeat();
  setInterval(() => presenceBeat(), PRESENCE_EVERY_MS);
  window.addEventListener("pagehide", () => presenceBeat("offline"));
}

/* ---------------------------------------------------------------- edit the menu (new version) */

function viewUpdate() {
  const out = h("div", { "aria-live": "polite" });
  const editorBox = h("div");
  const file = h("input", { type: "file", id: "menufile", accept: ".json,application/json", hidden: true, on: { change: async () => {
    try { start(await readFile(file)); } catch (e) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, e.message))); }
  } } });
  let prevBytes = null, prev = null, editor = null;

  function renderEditor() {
    editor = menuEditor(prev.items, prev.items);
    const zrows = ((prev.delivery && prev.delivery.zones) || []).map((z) => h("div", { class: "field-row" },
      textField("zf-" + z.id, "Fee, " + z.areas.map(areaName).join(", "), input("zf-" + z.id, { type: "number", min: 0, max: B.rules.max_delivery_fee, value: z.fee })),
      textField("zm-" + z.id, "Minimum order", input("zm-" + z.id, { type: "number", min: 0, value: z.min_order })),
      textField("ze-" + z.id, "Minutes", input("ze-" + z.id, { type: "number", min: 5, max: 240, value: z.eta_min }))));
    editorBox.replaceChildren(
      notice("info", h("p", { class: "flush" }, "Editing " + prev.name + ", version " + prev.version + ". Changes stay on this device until you publish them.")),
      sectionTitle("Menu"), editor,
      sectionTitle("Delivery fees, minimum orders and delivery times"), ...zrows,
      sectionTitle("Pickup"), check("pickup", "Customers can pick up orders", prev.pickup !== false),
      sectionTitle("Publish"),
      textField("summary", "Short public note about the change", input("summary", { maxlength: 200 })),
      B.key ? h("p", { class: "small-text muted" }, "Signing with key " + B.key.id + ".") : keyBox(),
      h("nav", null, h("button", { type: "button", class: "responsive", on: { click: publish } }, icon("verified"), h("span", null, "Prepare the new version"))));
  }

  async function publish() {
    const next = JSON.parse(new TextDecoder().decode(prevBytes));
    const num = (id) => { const v = val(id); return /^\d+$/.test(v) ? Number(v) : NaN; };
    const read = editor.read();
    const errors = read.errors.slice();
    next.items = read.items;
    next.pickup = checked("pickup");
    if (conn().orders && B.key && B.key.enc) next.direct = { topic: conn().orders, enc_key: B.key.enc.pub };
    for (const z of (next.delivery && next.delivery.zones) || []) {
      z.fee = num("zf-" + z.id); z.min_order = num("zm-" + z.id); z.eta_min = num("ze-" + z.id);
      if (isNaN(z.fee) || isNaN(z.min_order) || isNaN(z.eta_min)) errors.push("Enter every delivery fee, minimum order and delivery time as a whole number.");
      else if (z.fee > B.rules.max_delivery_fee) errors.push("A delivery fee is above the limit of " + money(B.rules.max_delivery_fee) + ".");
    }
    if (!B.key) errors.push("Sign in first.");
    else if (!next.owner || next.owner.public_key !== B.key.publicB64) errors.push("This key does not belong to this listing.");
    const changes = errors.length ? [] : diffMoney(prev, next);
    const otherChange = JSON.stringify(prev.items) !== JSON.stringify(next.items) || prev.pickup !== next.pickup || JSON.stringify(prev.direct || null) !== JSON.stringify(next.direct || null);
    if (!errors.length && !changes.length && !otherChange) errors.push("Nothing has changed.");
    if (!val("summary")) errors.push("Write a short public note about the change.");
    if (errors.length) { out.replaceChildren(notice("warn", h("ul", null, Array.from(new Set(errors)).map((x) => h("li", null, x))))); out.scrollIntoView({ block: "nearest" }); return; }
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
      changes.length ? h("ul", { class: "list border" }, changes.map((c) => h("li", null, h("div", { class: "max" }, c.label), h("span", { class: "price" }, (c.old === null ? "new" : money(c.old)) + " to " + (c.new === null ? "removed" : money(c.new)))))) : null,
      h("p", null, "Publish both files to your repository: versions/" + next.version + ".json and menu.json (they are identical). Keep every older version file. The change is announced to customers automatically."),
      h("nav", { class: "wrap" },
        publishButton([{ path: "versions/" + next.version + ".json", text }, { path: "menu.json", text }], "Hana menu version " + next.version + ": " + val("summary")),
        h("button", { type: "button", class: "border", on: { click: () => download(next.version + ".json", text) } }, icon("download"), h("span", null, "Download versions/" + next.version + ".json")),
        h("button", { type: "button", class: "border", on: { click: () => download("menu.json", text) } }, icon("download"), h("span", null, "Download menu.json"))));
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const start = (bytes) => {
    prevBytes = bytes;
    prev = JSON.parse(new TextDecoder().decode(bytes));
    if (!prev.claimed) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, "This listing is not claimed yet. Claim it first."))); return; }
    out.replaceChildren();
    renderEditor();
  };
  show("update", "Edit your menu", pageHeader("Edit your menu", "#/"),
    h("p", { class: "muted" }, "For claimed listings. Find your listing, change items, prices, sizes and fees, and sign the new version with your key. Every price change is published in the menu's price history."),
    textField("listing-phone", "Your business phone", input("listing-phone", { inputmode: "tel", maxlength: 14, value: (() => { try { return localStorage.getItem("hana.biz.phone") || ""; } catch (e) { return ""; } })() })),
    h("nav", { class: "wrap" },
      h("button", { type: "button", on: { click: async () => {
        const found = await findListingByPhone(val("listing-phone"), false);
        if (found.error) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, found.error))); return; }
        try { localStorage.setItem("hana.biz.phone", val("listing-phone")); } catch (e) { /* ignore */ }
        start(found.versions[0].bytes);
      } } }, icon("search"), h("span", null, "Find my listing"))),
    file,
    h("nav", { class: "wrap" }, h("button", { type: "button", class: "border", on: { click: () => file.click() } }, icon("upload"), h("span", null, "Or open a menu.json file"))),
    out, editorBox);
}

/* ---------------------------------------------------------------- visual menu editor */

/* Edits menu items as sections of rows: name, price or sizes, and optional description,
   category and picture. Nothing leaves the device. read() returns { items, errors }. */
function menuEditor(items, oldItems) {
  const byName = new Map((oldItems || []).map((it) => [norm(it.name), it]));
  const root = h("div", { class: "menu-editor" });
  const secBox = h("div");
  const field = (label, attrs) => h("div", { class: "field label border round small" }, h("input", Object.assign({ placeholder: " " }, attrs)), h("label", null, label));
  const iconBtn = (name, label, fn) => h("button", { type: "button", class: "circle transparent small", "aria-label": label, title: label, on: { click: fn } }, icon(name));

  function sizeRow(o) {
    const row = h("div", { class: "size-row" },
      field("Size or option", { value: (o && o.label) || "", maxlength: 40, "data-k": "label" }),
      field("Price", { type: "number", min: 0, inputmode: "numeric", value: o && o.price !== undefined ? o.price : "", "data-k": "price" }),
      iconBtn("close", "Remove this size", () => row.remove()));
    row._id = o && o.id;
    return row;
  }
  function itemRow(it) {
    it = it || {};
    const sizes = h("div", { class: "size-list" }, (it.options || []).map(sizeRow));
    const price = field("Price (BDT)", { type: "number", min: 0, inputmode: "numeric", value: it.price !== undefined ? it.price : "", "data-k": "price" });
    const toggle = () => { price.hidden = sizes.children.length > 0; };
    const li = h("li", { class: "edit-item" },
      h("div", { class: "edit-main" },
        field("Item name", { value: it.name || "", maxlength: 80, "data-k": "name" }),
        price,
        h("nav", { class: "edit-tools" },
          iconBtn("arrow_upward", "Move up", () => { if (li.previousElementSibling) li.parentNode.insertBefore(li, li.previousElementSibling); }),
          iconBtn("arrow_downward", "Move down", () => { if (li.nextElementSibling) li.parentNode.insertBefore(li.nextElementSibling, li); }),
          iconBtn("delete", "Remove this item", () => li.remove()))),
      sizes,
      h("nav", { class: "wrap small-space" },
        h("button", { type: "button", class: "chip small border", on: { click: () => { sizes.append(sizeRow()); toggle(); } } }, icon("add"), h("span", null, "Add a size or option"))),
      h("details", null, h("summary", { class: "link small-text" }, "Description, category and picture"),
        field("Description (optional)", { value: it.description || "", maxlength: 200, "data-k": "description" }),
        field("Category within the section (optional)", { value: it.category || "", maxlength: 40, "data-k": "category" }),
        field("Picture address (optional)", { type: "url", value: (it.image && it.image.src) || "", "data-k": "image" })));
    sizes.addEventListener("click", () => setTimeout(toggle, 0));
    toggle();
    li._id = it.id;
    return li;
  }
  function sectionBox(name, list) {
    const ul = h("ul", { class: "list border" }, (list || []).map(itemRow));
    const box = h("section", { class: "edit-section" },
      h("div", { class: "edit-main" },
        field("Section", { value: name || "", maxlength: 40, "data-k": "section" }),
        h("nav", { class: "edit-tools" }, iconBtn("delete", "Remove this section", async () => {
          if (!ul.children.length || await ask("Remove this section?", "The section and every item in it will be removed from the draft.", "Remove")) box.remove();
        }))),
      ul,
      h("nav", null, h("button", { type: "button", class: "border small", on: { click: () => { const r = itemRow(); ul.append(r); r.querySelector("input").focus(); } } }, icon("add"), h("span", null, "Add an item"))));
    return box;
  }
  function load(list) {
    const secs = new Map();
    for (const it of list || []) { const s = it.section || "Menu"; if (!secs.has(s)) secs.set(s, []); secs.get(s).push(it); }
    if (!secs.size) secs.set("", []);
    secBox.replaceChildren(...Array.from(secs, ([s, l]) => sectionBox(s, l)));
  }
  function read() {
    const out = [], errors = [], ids = new Set();
    const get = (el, k) => { const e = el.querySelector(':scope > .edit-main [data-k="' + k + '"], :scope > details [data-k="' + k + '"]'); return e ? e.value.trim() : ""; };
    for (const sec of secBox.querySelectorAll(".edit-section")) {
      const secName = (sec.querySelector(':scope > .edit-main [data-k="section"]').value || "").trim() || "Menu";
      for (const li of sec.querySelectorAll(":scope > ul > .edit-item")) {
        const name = get(li, "name");
        if (!name) { errors.push("An item in " + secName + " has no name."); continue; }
        const old = byName.get(norm(name));
        let id = li._id || (old && old.id) || slug(name);
        while (ids.has(id)) id += "-2";
        ids.add(id);
        const it = { id, name, section: secName };
        const cat = get(li, "category"), desc = get(li, "description"), pic = get(li, "image");
        if (cat) it.category = cat;
        if (desc) it.description = desc;
        if (pic) { if (safeImageUrl(pic)) it.image = { src: safeImageUrl(pic) }; else errors.push(name + ": the picture must be a JPEG, PNG or WebP file on one of the listed hosts."); }
        const sizes = Array.from(li.querySelectorAll(".size-row")).map((r) => ({ id: r._id, label: r.querySelector('[data-k="label"]').value.trim(), price: r.querySelector('[data-k="price"]').value.trim() }));
        if (sizes.length >= 2) {
          if (sizes.some((s) => !s.label || !/^\d*$/.test(s.price))) { errors.push(name + ": give every size a name and a whole-number price, or leave the price blank."); continue; }
          const oids = new Set();
          it.options = sizes.map((s) => { let oid = s.id || slug(s.label); while (oids.has(oid)) oid += "-2"; oids.add(oid); return { id: oid, label: s.label, price: s.price === "" ? null : Number(s.price) }; });
        } else {
          const p = sizes.length ? sizes[0].price : get(li, "price");
          if (!/^\d*$/.test(p)) { errors.push(name + ": enter the price as a whole number of taka, or leave it blank."); continue; }
          it.price = p === "" ? null : Number(p);
        }
        out.push(it);
      }
    }
    if (!out.length && !errors.length) errors.push("Add at least one item.");
    return { items: out, errors };
  }
  const text = h("textarea", { rows: 8, placeholder: " ", "aria-label": "Menu as text" });
  load(items);
  root.append(secBox,
    h("nav", { class: "wrap small-space" }, h("button", { type: "button", class: "border", on: { click: () => { const b = sectionBox("", []); secBox.append(b); b.querySelector("input").focus(); } } }, icon("add"), h("span", null, "Add a section"))),
    h("details", null, h("summary", { class: "link small-text" }, "Paste or copy the menu as text"),
      h("p", { class: "small-text muted" }, "One item per line: Section | Name | Price | Description | Picture address. For sizes, write 8 inch: 529; 12 inch: 749 as the price. Write ? for a price that is not known."),
      text,
      h("nav", { class: "wrap small-space" },
        h("button", { type: "button", class: "border", on: { click: () => { const p = textToItems(text.value, read().items); if (p.errors.length) snackbar(p.errors[0]); else { load(p.items); snackbar("The menu was replaced with the pasted text."); } } } }, h("span", null, "Use this text")),
        h("button", { type: "button", class: "border", on: { click: () => { text.value = itemsToText(read().items); } } }, h("span", null, "Show the current menu as text")))));
  root.read = read;
  root.load = load;
  return root;
}

/* ---------------------------------------------------------------- key memory and connections */

/* The business key can be kept in this browser's own database, so signing needs no file.
   Anyone using this browser profile could then sign as the business. */
const KEYSTORE = {
  db() { return new Promise((res, rej) => { const r = indexedDB.open("hana-business", 1); r.onupgradeneeded = () => r.result.createObjectStore("keys"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async run(mode, fn) { const db = await this.db(); return new Promise((res) => { const t = db.transaction("keys", mode); const q = fn(t.objectStore("keys")); t.oncomplete = () => res(q && q.result); t.onerror = () => res(null); }); },
  get() { return this.run("readonly", (s) => s.get("key")).catch(() => null); },
  set(k) { return this.run("readwrite", (s) => s.put(k, "key")).catch(() => null); },
  clear() { return this.run("readwrite", (s) => s.delete("key")).catch(() => null); },
};

function conn() { return store.get("hana.biz.connections", { provider: "", host: "codeberg.org", repo: "", branch: "main", token: "", orders: "", poll: false }); }
function saveConn(c) { store.set("hana.biz.connections", c); }

function utf8b64(text) {
  const b = new TextEncoder().encode(text);
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

/* Writes files to the business's own repository through its forge's API (GitHub, or Forgejo
   and Gitea, which Codeberg runs). The token stays on this device. */
async function forgeWrite(files, message) {
  const c = conn();
  if (!c.provider || !c.repo || !c.token) throw new Error("Set up a repository connection first, under Connections.");
  const gh = c.provider === "github";
  const base = gh ? "https://api.github.com/repos/" + c.repo + "/contents/" : "https://" + c.host + "/api/v1/repos/" + c.repo + "/contents/";
  const headers = gh ? { Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" } : { Authorization: "token " + c.token };
  for (const f of files) {
    const url = base + f.path.split("/").map(encodeURIComponent).join("/");
    let sha = null;
    const cur = await fetch(url + "?ref=" + encodeURIComponent(c.branch || "main"), { headers, cache: "no-store" });
    if (cur.ok) sha = (await cur.json()).sha || null;
    const body = { message, content: utf8b64(f.text), branch: c.branch || "main" };
    if (sha) body.sha = sha;
    const r = await fetch(url, { method: gh || sha ? "PUT" : "POST", headers: Object.assign({ "Content-Type": "application/json" }, headers), body: JSON.stringify(body) });
    if (!r.ok) throw new Error(f.path + ": the forge answered " + r.status + ".");
  }
}

function publishButton(files, message) {
  const c = conn();
  if (!c.provider || !c.token) return h("p", { class: "small-text muted" }, "To publish with one tap next time, connect your repository under Connections.");
  return h("button", { type: "button", on: { click: async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try { await forgeWrite(files, message); snackbar("Published to " + c.repo + "."); }
    catch (err) { snackbar(err.message); }
    b.disabled = false;
  } } }, icon("cloud_upload"), h("span", null, "Publish to my repository"));
}

function viewConnect() {
  const c = conn();
  const prov = h("select", { id: "c-provider" }, [["", "Not connected"], ["github", "GitHub"], ["forgejo", "Codeberg, Forgejo or Gitea"]].map(([v, t]) => h("option", { value: v, selected: c.provider === v }, t)));
  const out = h("div", { "aria-live": "polite" });
  const keyStatus = h("p", { class: "small-text muted" }, B.keyRemembered ? "You stay signed in on this device (key " + (B.key && B.key.id) + ")." : "You are not kept signed in on this device.");
  show("more", "Connections", pageHeader("Connections", "#/more"),
    h("p", { class: "muted" }, "Optional. Everything here is kept on this device only. With these set up, the tools publish your menu and handle orders with one tap. Without them, you download files and upload them yourself."),
    sectionTitle("Orders sent in Hana"),
    h("p", { class: "small-text muted" }, "Customers send orders straight to these tools, encrypted so that only you can read them, and your confirmations reach their app at once. It uses ntfy.sh, a free service that needs no account. Keep these tools open while you are open: customers see you as temporarily unavailable when they are closed."),
    c.orders ? h("p", { class: "small-text" }, "Your order address: " + c.orders) : null,
    h("nav", { class: "wrap" },
      h("button", { type: "button", on: { click: () => {
        const n = conn(); n.orders = randomTopic(); saveConn(n);
        snackbar("Order address created. Publish a new menu version under Menu to start receiving orders in Hana.");
        viewConnect();
      } } }, h("span", null, c.orders ? "Make a new order address" : "Set up orders in Hana")),
      c.orders ? h("button", { type: "button", class: "border", on: { click: () => { const n = conn(); n.paused = !n.paused; saveConn(n); presenceBeat(); viewConnect(); } } }, h("span", null, c.paused ? "Resume taking orders" : "Pause new orders")) : null,
      c.orders ? h("button", { type: "button", class: "border", on: { click: () => enablePush(false) } }, icon("inbox"), h("span", null, c.push ? "Renew alerts while closed" : "Alerts while Hana is closed")) : null),
    sectionTitle("Your repository"),
    h("p", { class: "small-text muted" }, "Create a token on your forge that can write to your menu repository only. GitHub: Settings, Developer settings, Fine-grained tokens, with Contents: read and write. Codeberg: Settings, Applications, with repository write access."),
    selectField("c-provider", "Forge", prov),
    textField("c-host", "Forge address (Codeberg, Forgejo or Gitea only)", input("c-host", { value: c.host || "codeberg.org" })),
    textField("c-repo", "Repository, as owner/name", input("c-repo", { value: c.repo || "", placeholder: " " })),
    textField("c-branch", "Branch", input("c-branch", { value: c.branch || "main" })),
    textField("c-token", "Access token", input("c-token", { type: "password", value: c.token || "" })),
    h("nav", { class: "wrap gap-top" },
      h("button", { type: "button", on: { click: () => {
        const n = Object.assign(conn(), { provider: prov.value, host: val("c-host").replace(/^https?:\/\//, "").replace(/\/.*$/, ""), repo: val("c-repo").replace(/^\/|\/$/g, ""), branch: val("c-branch") || "main", token: val("c-token") });
        if (n.provider && !/^[\w.-]+\/[\w.-]+$/.test(n.repo)) { snackbar("Write the repository as owner/name."); return; }
        saveConn(n);
        snackbar("Saved on this device.");
      } } }, h("span", null, "Save")),
      h("button", { type: "button", class: "border", on: { click: async () => {
        const n = conn();
        if (!n.provider) { out.replaceChildren(notice("info", h("p", { class: "flush" }, "Choose a forge and save first."))); return; }
        const url = n.provider === "github" ? "https://api.github.com/repos/" + n.repo : "https://" + n.host + "/api/v1/repos/" + n.repo;
        try {
          const r = await fetch(url, { headers: n.provider === "github" ? { Authorization: "Bearer " + n.token } : { Authorization: "token " + n.token } });
          out.replaceChildren(notice(r.ok ? "info" : "warn", h("p", { class: "flush" }, r.ok ? "Connected to " + n.repo + "." : "The forge answered " + r.status + ". Check the repository name and the token.")));
        } catch (e) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, "The forge could not be reached."))); }
      } } }, h("span", null, "Test the connection")),
      h("button", { type: "button", class: "border", on: { click: () => { store.set("hana.biz.connections", null); viewConnect(); snackbar("Connections removed from this device."); } } }, h("span", null, "Remove all"))),
    out,
    sectionTitle("Sign-in"),
    keyStatus,
    keyBox(() => viewConnect()),
    B.key ? h("nav", null, h("button", { type: "button", class: "border", on: { click: async () => { await KEYSTORE.clear(); B.keyRemembered = false; B.key = null; B.vault = null; viewConnect(); } } }, icon("logout"), h("span", null, "Sign out on this device"))) : null);
}

/* ---------------------------------------------------------------- more tools */

function viewMore() {
  const card = (href, ic, title, text) => h("li", null, h("a", { href, class: "row max" }, icon(ic), h("div", { class: "max" }, h("div", { class: "bold" }, title), h("div", { class: "small-text muted" }, text))));
  show("more", "More tools", pageTitle("More tools"),
    notice("info", h("p", { class: "flush" }, "Everything here is optional. Only your menu and listing are ever published; sales, customers, riders, keys and backups stay on this device or go only to services you connect.")),
    sectionTitle("Your listing"),
    h("ul", { class: "list border more-list" },
      card("#/join", "add_business", "List a new business", "Prepare a signed listing and ask the community to verify it."),
      card("#/claim", "verified", "Claim a listing", "Find a listing a volunteer entered, by your business phone."),
      card("#/site", "storefront", "Your own website", "A one-file site for your own hosting, which also carries a full copy of the directory.")),
    sectionTitle("Point of sale"),
    h("ul", { class: "list border more-list" },
      card("#/pos", "receipt_long", "Sales and receipts", "Ring up counter, pickup and delivery sales, and print standard receipts."),
      card("#/statements", "edit_note", "Statements", "Daily and monthly totals by payment method and item, as PDF or CSV."),
      card("#/riders", "moped", "Riders", "Send delivery jobs to your riders by WhatsApp, or to your own dispatch system.")),
    sectionTitle("Data and connections"),
    h("ul", { class: "list border more-list" },
      card("#/backup", "cloud_upload", "Records and backups", "Receipt details, backup files, and optional encrypted backup to Supabase or CouchDB."),
      card("#/connect", "tune", "Connections", "Publish your menu and receive orders automatically.")));
}

/* ---------------------------------------------------------------- orders inbox */

const CANCEL_LINE = /^CANCEL ([0-9A-HJKMNP-TV-Z]{6})\s*$/m;
async function inboxFetch() {
  const c = conn();
  if (!c.orders) return [];
  const r = await fetch(c.orders.replace(/\/$/, "") + "/json?poll=1&since=12h", { cache: "no-store" });
  if (!r.ok) throw new Error("The order topic answered " + r.status + ".");
  return (await r.text()).split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } })
    .filter((m) => m && m.event === "message" && (CHECK_LINE.test(m.message || "") || CANCEL_LINE.test(m.message || ""))).reverse();
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
  if (hash === "#/connect") return viewConnect();
  if (hash === "#/more") return viewMore();
  if (hash === "#/pos") return viewPos();
  if (hash.startsWith("#/pos/")) return viewReceipt(hash.slice(6));
  if (hash === "#/statements") return viewStatements();
  if (hash === "#/riders") return viewRiders();
  if (hash === "#/backup") return viewBackup();
  return viewHome();
}

applyIcon();
startPresence();
if (conn().push) enablePush(true);
for (const i of document.querySelectorAll("i[data-icon]")) i.replaceWith(icon(i.getAttribute("data-icon")));
window.addEventListener("hashchange", route);
Promise.all([loadDirectory(), ("indexedDB" in window ? KEYSTORE.get() : Promise.resolve(null)).then((k) => { if (k) { B.key = k; B.keyRemembered = true; } })]).then(() => {
  const a = document.getElementById("repo-link");
  const u = repoUrl();
  a.setAttribute("href", u || "index.html#/about");
  route();
});
setupUpdates(["business.html", "core.js", "business.js", "theme/theme.css"]);
