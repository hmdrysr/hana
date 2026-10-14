/* Hana app. Plain JavaScript, no libraries and no build step. It reads only the
   directory and menu files. Every value from a menu file is shown as plain text
   (textContent), never as HTML. The customer's details stay on this phone.
   See SPEC.md. */
"use strict";

/* Icon outlines from Material Symbols (Outlined, weight 400), package
   @material-symbols/svg-400 version 0.47.5, Apache License 2.0, copyright Google LLC.
   See theme/material-symbols-LICENSE.txt. */
const ICONS = {
  storefront: "M840-519v339q0 24-18 42t-42 18H179q-24 0-42-18t-18-42v-339q-28-24-37-59t2-70l43-135q8-27 28-42t46-15h553q28 0 49 15.5t29 41.5l44 135q11 35 1.5 70T840-519Zm-270-31q29 0 49-19t16-46l-25-165H510v165q0 26 17 45.5t43 19.5Zm-187 0q28 0 47.5-19t19.5-46v-165H350l-25 165q-4 26 14 45.5t44 19.5Zm-182 0q24 0 41.5-16.5T263-607l26-173H189l-46 146q-10 31 8 57.5t50 26.5Zm557 0q32 0 50.5-26t8.5-58l-46-146H671l26 173q3 24 20.5 40.5T758-550ZM179-180h601v-311q1 1-6.5 1H758q-25 0-47.5-10.5T666-533q-16 20-40 31.5T573-490q-30 0-51.5-8.5T480-527q-15 18-38 27.5t-52 9.5q-31 0-55-11t-41-32q-24 21-47 32t-46 11h-13.5q-6.5 0-8.5-1v311Zm601 0H179h601Z",
  shopping_bag: "M220-80q-24 0-42-18t-18-42v-520q0-24 18-42t42-18h110v-10q0-63 43.5-106.5T480-880q63 0 106.5 43.5T630-730v10h110q24 0 42 18t18 42v520q0 24-18 42t-42 18H220Zm0-60h520v-520H630v90q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37v-90H390v90q0 12.75-8.68 21.37-8.67 8.63-21.5 8.63-12.82 0-21.32-8.63-8.5-8.62-8.5-21.37v-90H220v520Zm170-580h180v-10q0-38-26-64t-64-26q-38 0-64 26t-26 64v10ZM220-140v-520 520Z",
  receipt_long: "M222-80q-43.75 0-74.37-30.63Q117-141.25 117-185v-125h127v-570l59.8 60 59.8-60 59.8 60 59.8-60 59.8 60 60-60 60 60 60-60 60 60 60-60v695q0 43.75-30.62 74.37Q781.75-80 738-80H222Zm516-60q20 0 32.5-12.5T783-185v-595H304v470h389v125q0 20 12.5 32.5T738-140ZM357-622v-60h240v60H357Zm0 134v-60h240v60H357Zm333-134q-12 0-21-9t-9-21q0-12 9-21t21-9q12 0 21 9t9 21q0 12-9 21t-21 9Zm0 129q-12 0-21-9t-9-21q0-12 9-21t21-9q12 0 21 9t9 21q0 12-9 21t-21 9ZM221-140h412v-110H177v65q0 20 12.65 32.5T221-140Zm-44 0v-110 110Z",
  info: "M453-280h60v-240h-60v240Zm50.5-323.2q9.5-9.2 9.5-22.8 0-14.45-9.48-24.22-9.48-9.78-23.5-9.78t-23.52 9.78Q447-640.45 447-626q0 13.6 9.48 22.8 9.48 9.2 23.5 9.2t23.52-9.2ZM480.27-80q-82.74 0-155.5-31.5Q252-143 197.5-197.5t-86-127.34Q80-397.68 80-480.5t31.5-155.66Q143-709 197.5-763t127.34-85.5Q397.68-880 480.5-880t155.66 31.5Q709-817 763-763t85.5 127Q880-563 880-480.27q0 82.74-31.5 155.5Q817-252 763-197.68q-54 54.31-127 86Q563-80 480.27-80Zm.23-60Q622-140 721-239.5t99-241Q820-622 721.19-721T480-820q-141 0-240.5 98.81T140-480q0 141 99.5 240.5t241 99.5Zm-.5-340Z",
  search: "M796-121 533-384q-30 26-70 40.5T378-329q-108 0-183-75t-75-181q0-106 75-181t182-75q106 0 180.5 75T632-585q0 43-14 83t-42 75l264 262-44 44ZM377-389q81 0 138-57.5T572-585q0-81-57-138.5T377-781q-82 0-139.5 57.5T180-585q0 81 57.5 138.5T377-389Z",
  add: "M450-450H200v-60h250v-250h60v250h250v60H510v250h-60v-250Z",
  remove: "M200-450v-60h560v60H200Z",
  arrow_back: "m274-450 248 248-42 42-320-320 320-320 42 42-248 248h526v60H274Z",
  arrow_drop_down: "M480-360 280-559h400L480-360Z",
  delete: "M261-120q-24.75 0-42.37-17.63Q201-155.25 201-180v-570h-41v-60h188v-30h264v30h188v60h-41v570q0 24-18 42t-42 18H261Zm438-630H261v570h438v-570ZM367-266h60v-399h-60v399Zm166 0h60v-399h-60v399ZM261-750v570-570Z",
  content_copy: "M300-200q-24 0-42-18t-18-42v-560q0-24 18-42t42-18h440q24 0 42 18t18 42v560q0 24-18 42t-42 18H300Zm0-60h440v-560H300v560ZM180-80q-24 0-42-18t-18-42v-620h60v620h500v60H180Zm120-180v-560 560Z",
  chat: "M240-399h313v-60H240v60Zm0-130h480v-60H240v60Zm0-130h480v-60H240v60ZM80-80v-740q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H240L80-80Zm134-220h606v-520H140v600l74-80Zm-74 0v-520 520Z",
  call: "M795-120q-116 0-236.5-56T335-335Q232-438 176-558.5T120-795q0-19.29 12.86-32.14Q145.71-840 165-840h140q14 0 24 10t14 25l26.93 125.64Q372-665 369.5-653.5t-10.73 19.73L259-533q26 44 55 82t64 72q37 38 78 69.5t86 55.5l95-98q10-11 23.15-15 13.15-4 25.85-2l119 26q15 4 25 16.04 10 12.05 10 26.96v135q0 19.29-12.86 32.14Q814.29-120 795-120ZM229-588l81-82-23-110H180q2 42 13.5 88.5T229-588Zm369 363q41 19 89 31t93 14v-107l-103-21-79 83ZM229-588Zm369 363Z",
  sms: "M334.5-534.5Q346-546 346-563t-11.5-28.5Q323-603 306-603t-28.5 11.5Q266-580 266-563t11.5 28.5Q289-523 306-523t28.5-11.5Zm177 0Q523-546 523-563t-11.5-28.5Q500-603 483-603t-28.5 11.5Q443-580 443-563t11.5 28.5Q466-523 483-523t28.5-11.5Zm170 0Q693-546 693-563t-11.5-28.5Q670-603 653-603t-28.5 11.5Q613-580 613-563t11.5 28.5Q636-523 653-523t28.5-11.5ZM80-80v-740q0-24 18-42t42-18h680q24 0 42 18t18 42v520q0 24-18 42t-42 18H240L80-80Zm134-220h606v-520H140v600l74-80Zm-74 0v-520 520Z",
  location_on: "M529.5-510.5Q550-531 550-560t-20.5-49.5Q509-630 480-630t-49.5 20.5Q410-589 410-560t20.5 49.5Q451-490 480-490t49.5-20.5ZM480-159q133-121 196.5-219.5T740-552q0-118-75.5-193T480-820q-109 0-184.5 75T220-552q0 75 65 173.5T480-159Zm0 79Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z",
  schedule: "m627-287 45-45-159-160v-201h-60v225l174 181ZM480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-82 31.5-155t86-127.5Q252-817 325-848.5T480-880q82 0 155 31.5t127.5 86Q817-708 848.5-635T880-480q0 82-31.5 155t-86 127.5Q708-143 635-111.5T480-80Zm0-400Zm0 340q140 0 240-100t100-240q0-140-100-240T480-820q-140 0-240 100T140-480q0 140 100 240t240 100Z",
  check_circle: "m421-298 283-283-46-45-237 237-120-120-45 45 165 166Zm59 218q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-156t86-127Q252-817 325-848.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 82-31.5 155T763-197.5q-54 54.5-127 86T480-80Zm0-60q142 0 241-99.5T820-480q0-142-99-241t-241-99q-141 0-240.5 99T140-480q0 141 99.5 240.5T480-140Zm0-340Z",
  warning: "m40-120 440-760 440 760H40Zm104-60h672L480-760 144-180Zm361.5-65.68q8.5-8.67 8.5-21.5 0-12.82-8.68-21.32-8.67-8.5-21.5-8.5-12.82 0-21.32 8.68-8.5 8.67-8.5 21.5 0 12.82 8.68 21.32 8.67 8.5 21.5 8.5 12.82 0 21.32-8.68ZM454-348h60v-224h-60v224Zm26-122Z",
  close: "m249-207-42-42 231-231-231-231 42-42 231 231 231-231 42 42-231 231 231 231-42 42-231-231-231 231Z",
  download: "M480-313 287-506l43-43 120 120v-371h60v371l120-120 43 43-193 193ZM220-160q-24 0-42-18t-18-42v-143h60v143h520v-143h60v143q0 24-18 42t-42 18H220Z",
  send: "M120-160v-640l760 320-760 320Zm60-93 544-227-544-230v168l242 62-242 60v167Zm0 0v-457 457Z",
  moped: "M192-234.5Q158-269 158-317H80v-120q0-65 45-110.5T235-593h155v216h161l147-185v-138H575v-60h123q24.75 0 42.38 17.62Q758-724.75 758-700v159L580-317H390q0 48-33.76 82.5-33.77 34.5-82 34.5Q226-200 192-234.5ZM330-377Zm-16.5 100q16.5-17 16.5-40H218q0 23 16.5 40t39.5 17q23 0 39.5-17ZM200-653v-60h190v60H200Zm482 419.24q-34-33.77-34-82Q648-364 681.76-398q33.77-34 82-34Q812-432 846-398.24q34 33.77 34 82Q880-268 846.24-234q-33.77 34-82 34Q716-200 682-233.76Zm121.5-42.74Q820-293 820-316t-16.5-39.5Q787-372 764-372t-39.5 16.5Q708-339 708-316t16.5 39.5Q741-260 764-260t39.5-16.5ZM140-377h190v-156h-95q-40 0-67.5 28.2T140-437v60Z",
};

/* ---------------------------------------------------------------- dark mode follows the phone */

(function followPhoneTheme() {
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const apply = () => document.body.classList.toggle("dark", !!(mq && mq.matches));
  apply();
  if (mq && mq.addEventListener) mq.addEventListener("change", apply);
})();

/* ---------------------------------------------------------------- helpers */

function h(tag, attrs) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "on") for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of Array.prototype.slice.call(arguments, 2).flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return e;
}

const SVGNS = "http://www.w3.org/2000/svg";
function icon(name) {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", "0 -960 960 960");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const p = document.createElementNS(SVGNS, "path");
  p.setAttribute("d", ICONS[name] || "");
  p.setAttribute("fill", "currentColor");
  svg.append(p);
  const i = document.createElement("i");
  i.append(svg);
  return i;
}

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  },
};

/* Money in Bangladeshi taka, written with the ISO code and Canadian digit grouping. */
const money = (n) => "BDT " + Number(n).toLocaleString("en-CA");

/* 24-hour "19:00" to "7 p.m.", "03:30" to "3:30 a.m.", "00:00" to "midnight", "12:00" to "noon". */
function clock(hhmm) {
  const [H, M] = hhmm.split(":").map(Number);
  if (H === 0 && M === 0) return "midnight";
  if (H === 12 && M === 0) return "noon";
  const h12 = H % 12 === 0 ? 12 : H % 12;
  return h12 + (M ? ":" + String(M).padStart(2, "0") : "") + (H < 12 ? " a.m." : " p.m.");
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? MONTHS[Number(m[2]) - 1] + " " + Number(m[3]) + ", " + m[1] : "date not stated";
}
function dateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const hh = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() + ", " + clock(hh);
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const CHANNELS = {
  whatsapp: { label: "WhatsApp", icon: "chat", link: (id, text) => "https://wa.me/" + id + "?text=" + encodeURIComponent(text) },
  sms: { label: "Text message", icon: "sms", link: (id, text) => "sms:+" + id + "?body=" + encodeURIComponent(text) },
  phone: { label: "Phone call", icon: "call", link: (id) => "tel:+" + id },
  messenger: { label: "Messenger", icon: "chat", link: (id) => "https://m.me/" + encodeURIComponent(id) },
  telegram: { label: "Telegram", icon: "send", link: (id) => "https://t.me/" + encodeURIComponent(id) },
};
const phoneText = (id) => "+" + String(id).replace(/^\+/, "");

/* ---------------------------------------------------------------- hashing, order check line (SPEC 6.4) */

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.prototype.map.call(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

function b32(bytes) {
  const bits = bytes.length * 8;
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  const pad = (5 - (bits % 5)) % 5;
  n <<= BigInt(pad);
  let out = "";
  for (let shift = bits + pad - 5; shift >= 0; shift -= 5) out += CROCKFORD[Number((n >> BigInt(shift)) & 31n)];
  return out;
}

async function checkCode(fullHash, zoneId, items, sub, fee) {
  const text = "hana1|" + fullHash + "|" + zoneId + "|" + items + "|" + sub + "|" + fee;
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return b32(d).slice(0, 8);
}

/* ---------------------------------------------------------------- fuzzy search (SPEC 5.1, Search) */

function norm(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/* Edit distance in which swapping two neighbouring letters counts as one edit. */
function editDistance(a, b) {
  const d = [];
  for (let i = 0; i <= a.length; i++) d.push([i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

function wordMatches(q, w) {
  if (w.startsWith(q)) return true;
  const max = q.length <= 2 ? 0 : q.length <= 7 ? 1 : 2;
  if (!max) return false;
  for (const len of [q.length - 1, q.length, q.length + 1]) {
    if (len > 0 && editDistance(q, w.slice(0, len)) <= max) return true;
  }
  return false;
}

function fuzzyMatches(query, text) {
  const qs = norm(query).split(" ").filter(Boolean);
  if (!qs.length) return true;
  const words = norm(text).split(" ").filter(Boolean);
  return qs.every((q) => words.some((w) => wordMatches(q, w)));
}

/* ---------------------------------------------------------------- data */

const state = {
  site: { repo_url: "", company_url: "https://hamidyasir.com" },
  areas: [],
  areaById: new Map(),
  restaurants: [],
  loaded: false,
  loadError: "",
  area: store.get("hana.area", ""),
  showAll: false,
  query: "",
  basket: store.get("hana.basket", null),
};

async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(url + " returned " + r.status);
  return r.json();
}

async function fetchBytes(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(url + " returned " + r.status);
  return new Uint8Array(await r.arrayBuffer());
}

async function loadAll() {
  try {
    try { Object.assign(state.site, await fetchJson("site.json")); } catch (e) { /* optional file */ }
    const areas = await fetchJson("areas.json");
    state.areas = areas.areas || [];
    state.areaById = new Map(state.areas.map((a) => [a.id, a]));
    if (state.area && !state.areaById.has(state.area)) state.area = "";
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

function priceLines(menu) {
  const out = [];
  for (const it of menu.items || []) {
    if (it.options) for (const op of it.options) out.push({ key: it.id + "." + op.id, item: it, label: it.name + " (" + op.label + ")", option: op.label, price: op.price });
    else out.push({ key: it.id, item: it, label: it.name, option: "", price: it.price });
  }
  return out;
}

/* ---------------------------------------------------------------- shared interface pieces */

const main = document.getElementById("main");
let snackTimer = null;

function snackbar(text) {
  const s = document.getElementById("snackbar");
  s.textContent = text;
  s.classList.add("active");
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => s.classList.remove("active"), 2500);
}

function ask(title, text, okLabel) {
  const d = document.getElementById("dialog");
  document.getElementById("dialog-title").textContent = title;
  document.getElementById("dialog-text").textContent = text;
  const ok = document.getElementById("dialog-ok");
  const cancel = document.getElementById("dialog-cancel");
  ok.textContent = okLabel || "OK";
  return new Promise((resolve) => {
    if (!d.showModal) { resolve(window.confirm(title + "\n\n" + text)); return; }
    const done = (v) => { d.close(); ok.onclick = cancel.onclick = null; d.oncancel = null; resolve(v); };
    ok.onclick = () => done(true);
    cancel.onclick = () => done(false);
    d.oncancel = (e) => { e.preventDefault(); done(false); };
    d.showModal();
    cancel.focus();
  });
}

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

/* A notice card. tone: "info" (neutral) or "warn" (needs attention). */
function notice(tone, ...kids) {
  return h("article", { class: "round no-elevate " + (tone === "warn" ? "tertiary-container" : "surface-container-high"), role: tone === "warn" ? "note" : null },
    h("div", { class: "row top-align" }, icon(tone === "warn" ? "warning" : "info"), h("div", { class: "max" }, ...kids)));
}

function chip(text, tone) {
  const cls = tone === "ok" ? "primary-container" : tone === "warn" ? "tertiary-container" : "surface-container-highest";
  return h("span", { class: "chip small no-border " + cls }, text);
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

function sectionTitle(text) { return h("h2", { class: "section-title" }, text); }
function pageTitle(text) { return h("h1", { class: "page-title" }, text); }

function areaSelect(id, value, onChange, firstLabel) {
  const stations = state.areas.filter((a) => a.kind === "station").sort((a, b) => a.name.localeCompare(b.name, "en"));
  const wards = state.areas.filter((a) => a.kind === "ward").sort((a, b) => a.number - b.number);
  const city = state.areas.find((a) => a.kind === "city");
  const stationOf = (w) => (w.part_of || []).map((s) => areaName(s).replace(/ Station$/, "")).join(" / ");
  return h("div", { class: "field label suffix border round" },
    h("select", { id, on: { change: (e) => onChange(e.target.value) } },
      h("option", { value: "" }, firstLabel),
      city ? h("option", { value: city.id, selected: value === city.id }, city.name + ", anywhere in the city") : null,
      h("optgroup", { label: "Stations" }, stations.map((a) => h("option", { value: a.id, selected: a.id === value }, a.name))),
      h("optgroup", { label: "Wards" }, wards.map((a) => h("option", { value: a.id, selected: a.id === value }, a.name + " (" + stationOf(a) + ")")))),
    h("label", { for: id, class: "active" }, "Your area"),
    icon("arrow_drop_down"));
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
    else kids.push(h("p", { class: "muted" }, state.restaurants.length ? "No restaurants match. Try a shorter search or another area." : "No restaurants are listed yet."));
    if (area && hidden) {
      kids.push(h("p", { class: "small-text muted" }, hidden + (hidden === 1 ? " restaurant does" : " restaurants do") + " not deliver to " + areaName(area) + " and " + (hidden === 1 ? "is" : "are") + " hidden."));
    }
    results.replaceChildren(...kids);
  }

  show("list", "",
    pageTitle("Restaurants in Chittagong"),
    h("p", { class: "muted" }, "Listed alphabetically. No listing is featured or paid for."),
    areaSelect("area", state.area, (v) => { state.area = v; store.set("hana.area", v); renderResults(); }, "Choose your area"),
    h("div", { class: "field prefix round fill" }, icon("search"), search),
    h("div", { class: "row" }, h("label", { class: "switch" }, showAll, h("span")), h("label", { for: "showall", class: "max" }, "Include restaurants that do not deliver to my area")),
    h("div", { class: "space" }),
    results);
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
      h("div", { class: "max" }, h("h2", { class: "card-title" }, r.name), h("div", { class: "muted" }, (m.kind || "Restaurant") + " · " + areaName(m.neighbourhood)))),
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
    const zone = zoneFor(r.menu, state.area) || onlyZone(r.menu);
    state.basket = { rid: r.id, version: r.menu.version, zone: zone ? zone.id : "", lines: {} };
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
    h("p", { class: "muted" }, (m.kind || "Restaurant") + " · " + areaName(m.neighbourhood)),
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
  nodes.push(h("p", { class: "small-text muted" }, "Each delivery area has one fixed charge set by the business. Hana adds no fees. The business may still decline an order."));
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
  const zone = (menu.delivery.zones || []).find((z) => z.id === f.zone);
  const fee = zone && zone.fee !== null && zone.fee !== undefined ? zone.fee : null;
  const feeStr = fee === null ? "?" : String(fee);
  const items = parts.join(",");
  const code = newCode();
  const check = "CHECK hana1 H=" + r.hash.slice(0, 12) + " Z=" + f.zone + " I=" + items + " S=" + sub + " F=" + feeStr + " C=" + await checkCode(r.hash, f.zone, items, sub, feeStr);
  const lines = ["Order " + code + " (sent with Hana)", "To: " + menu.name, "", ...text, "",
    "Items: " + money(sub),
    fee === null ? "Delivery: fee not stated; please confirm" : "Delivery: " + money(fee),
    fee === null ? null : "Total: " + money(sub + fee),
    "Payment: on delivery, in cash or by Bangla QR", "",
    "Name: " + f.name, "Address: " + f.address + (zone ? " (" + zoneLabel(zone) + ")" : ""),
    f.note ? "Note: " + f.note : null, "", check].filter((l) => l !== null);
  const kitchen = lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
  const courier = ["DELIVERY SLIP " + code, "Name: " + f.name.split(" ")[0], "Address: " + f.address,
    "Amount to collect: " + (fee === null ? money(sub) + " plus delivery (fee not stated)" : money(sub + fee))].join("\n");
  return { code, kitchen, courier, sub, fee, keys, zone: f.zone };
}

function textField(id, label, input) {
  return h("div", { class: "field label border round" + (input.tagName === "TEXTAREA" ? " textarea" : "") }, input, h("label", { for: id }, label));
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
  const prices = {};
  for (const l of priceLines(menu)) prices[l.key] = l;
  const dropped = Object.keys(state.basket.lines).filter((k) => !prices[k]);
  for (const k of dropped) delete state.basket.lines[k];
  if (dropped.length) saveBasket();
  if (!basketCount()) return viewBasket();

  const nodes = [pageTitle("Basket"), h("p", { class: "muted" }, "From ", h("a", { class: "link", href: "#/r/" + r.id }, menu.name))];
  if (dropped.length) nodes.push(notice("warn", h("p", { class: "flush" }, dropped.length + (dropped.length === 1 ? " item is" : " items are") + " no longer on the menu and " + (dropped.length === 1 ? "was" : "were") + " removed.")));
  if (state.basket.version !== menu.version) {
    nodes.push(notice("warn", h("p", { class: "bold flush" }, "Prices have changed"),
      h("p", { class: "flush" }, "You added items from version " + state.basket.version + " of the menu. It is now version " + menu.version + ", and the current prices are shown. " + (menu.announcement ? menu.announcement.summary : ""))));
  }
  if (menu.claimed === false) nodes.push(notice("warn", h("p", { class: "flush" }, "This listing is not yet confirmed by the business. Confirm the prices when you send your order.")));

  const zones = (menu.delivery && menu.delivery.zones) || [];
  const list = h("ul", { class: "list border" });
  const totals = h("article", { class: "round no-elevate surface-container-high" });

  function refresh() {
    let sub = 0;
    list.replaceChildren(...Object.keys(state.basket.lines).sort().map((k) => {
      const q = state.basket.lines[k];
      sub += prices[k].price * q;
      return h("li", null,
        h("div", { class: "max" }, h("div", { class: "bold" }, prices[k].label), h("div", { class: "small-text muted price" }, money(prices[k].price) + " each")),
        h("nav", { class: "no-space", role: "group", "aria-label": "Quantity of " + prices[k].label },
          h("button", { type: "button", class: "circle transparent", "aria-label": "Remove one " + prices[k].label, on: { click: () => change(k, -1) } }, icon(q === 1 ? "delete" : "remove")),
          h("span", { class: "bold price", style: null }, String(q)),
          h("button", { type: "button", class: "circle transparent", "aria-label": "Add one " + prices[k].label, on: { click: () => change(k, 1) } }, icon("add"))));
    }));
    const z = zones.find((x) => x.id === state.basket.zone);
    const rows = [h("nav", null, h("span", { class: "max" }, "Items"), h("span", { class: "price" }, money(sub))),
      h("nav", null, h("span", { class: "max" }, "Delivery"), h("span", { class: "price" }, z ? (z.fee === null ? "Not stated" : money(z.fee)) : "Choose an area"))];
    if (z && z.fee !== null) rows.push(h("hr"), h("nav", null, h("span", { class: "max bold" }, "Total"), h("span", { class: "price bold" }, money(sub + z.fee))));
    if (z && z.min_order && sub < z.min_order) rows.push(h("p", { class: "small-text flush" }, "Below the minimum order of " + money(z.min_order) + "."));
    rows.push(h("p", { class: "small-text muted flush" }, "Prices from version " + menu.version + ", published " + longDate(menu.announcement && menu.announcement.published) + ". The delivery charge is fixed by the business."));
    totals.replaceChildren(...rows);
  }
  function change(k, d) {
    const q = (state.basket.lines[k] || 0) + d;
    if (q <= 0) delete state.basket.lines[k]; else state.basket.lines[k] = Math.min(99, q);
    saveBasket();
    if (!basketCount()) { state.basket = null; saveBasket(); viewBasket(); return; }
    refresh();
  }
  nodes.push(list, totals);

  const saved = store.get("hana.me", { name: "", address: "" });
  const zoneSel = h("div", { class: "field label suffix border round" },
    h("select", { id: "zone", on: { change: (e) => { state.basket.zone = e.target.value; saveBasket(); refresh(); } } },
      h("option", { value: "" }, "Choose a delivery area"),
      zones.map((z) => h("option", { value: z.id, selected: z.id === state.basket.zone }, zoneLabel(z)))),
    h("label", { for: "zone", class: "active" }, "Delivery area"), icon("arrow_drop_down"));
  const name = h("input", { type: "text", id: "name", value: saved.name, autocomplete: "off", maxlength: 60, placeholder: " " });
  const address = h("textarea", { id: "address", rows: 3, maxlength: 300, placeholder: " " }, saved.address);
  const note = h("input", { type: "text", id: "note", maxlength: 200, autocomplete: "off", placeholder: " " });
  const remember = h("input", { type: "checkbox", id: "remember", checked: !!saved.name });
  const contacts = (menu.contact || []).filter((c) => c.app);
  const anyPreferred = contacts.some((x) => x.preferred);
  const channelRadios = contacts.map((c, i) => h("label", { class: "radio" },
    h("input", { type: "radio", name: "channel", value: String(i), checked: c.preferred || (i === 0 && !anyPreferred) }),
    h("span", null, (CHANNELS[c.app] ? CHANNELS[c.app].label : c.app) + " · " + phoneText(c.id))));
  const out = h("div", { "aria-live": "polite" });

  const form = h("form", { novalidate: true, on: { submit: async (e) => {
    e.preventDefault();
    const errors = [];
    if (!state.basket.zone) errors.push("Choose a delivery area.");
    if (!name.value.trim()) errors.push("Enter a first name or nickname.");
    if (!address.value.trim()) errors.push("Enter an address or landmark.");
    if (errors.length) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, errors.join(" ")))); return; }
    store.set("hana.me", remember.checked ? { name: name.value.trim(), address: address.value.trim() } : { name: "", address: "" });
    const o = await buildOrder(r, { name: name.value.trim(), address: address.value.trim(), note: note.value.trim(), zone: state.basket.zone });
    const idx = Number((form.querySelector("input[name=channel]:checked") || { value: 0 }).value);
    const c = contacts[idx];
    const ch = c && CHANNELS[c.app];
    const link = ch ? ch.link(String(c.id).replace(/^\+/, ""), o.kitchen) : null;
    const orders = store.get("hana.orders", []);
    orders.unshift({ code: o.code, at: new Date().toISOString(), restaurant_id: r.id, restaurant: menu.name, menu_hash: r.hash, menu_version: menu.version,
      zone: o.zone, items: o.keys.map((k) => ({ key: k, label: prices[k].label, qty: state.basket.lines[k], price: prices[k].price })), subtotal: o.sub, fee: o.fee,
      kitchen_message: o.kitchen, channel: c ? c.app : null, menu_file: r.raw });
    const savedOk = store.set("hana.orders", orders.slice(0, 50));
    out.replaceChildren(...[
      h("h2", { class: "section-title" }, "Order " + o.code + " is ready"),
      savedOk ? h("p", { class: "muted" }, "A copy is saved on this phone under Orders.") : notice("warn", h("p", { class: "flush" }, "This phone could not save a copy of the order. Copy the message below to keep a record.")),
      sectionTitle("Message to the business"), h("pre", null, o.kitchen),
      h("nav", { class: "wrap gap-top" },
        link ? h("a", { href: link, class: "button", rel: "noopener", target: "_blank" }, icon(ch.icon), h("span", null, c.app === "phone" ? "Call the business" : "Open " + ch.label)) : null,
        h("button", { type: "button", class: "border", on: { click: () => copy(o.kitchen) } }, icon("content_copy"), h("span", null, "Copy message"))),
      c && c.app === "phone" ? h("p", { class: "small-text muted" }, "A phone call cannot carry text. Call the business and read the message aloud.") : null,
      h("p", { class: "small-text muted" }, "Hana does not send anything. You send the message from your own app."),
      sectionTitle("Delivery slip"),
      h("p", { class: "small-text muted" }, "Share this with the delivery person once the business tells you who is coming. It contains no phone number or full name."),
      h("pre", null, o.courier),
      h("nav", { class: "wrap gap-top" },
        h("button", { type: "button", class: "border", on: { click: () => copy(o.courier) } }, icon("content_copy"), h("span", null, "Copy slip")),
        h("button", { type: "button", on: { click: () => { state.basket = null; saveBasket(); location.hash = "#/orders"; } } }, h("span", null, "Done")))].filter(Boolean));
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  } } },
    sectionTitle("Checkout"),
    zoneSel,
    textField("name", "First name or nickname", name),
    textField("address", "Address or landmark", address),
    textField("note", "Note for the business (optional)", note),
    h("p", { class: "small-text bold" }, "Send the order by"),
    h("nav", { class: "vertical left-align" }, channelRadios),
    h("div", { class: "space" }),
    h("label", { class: "checkbox" }, remember, h("span", null, "Remember my name and address on this phone only")),
    h("div", { class: "space" }),
    h("nav", null, h("button", { type: "submit", class: "responsive" }, icon("send"), h("span", null, "Prepare my order"))));

  nodes.push(form, out, h("div", { class: "space" }),
    h("nav", null, h("button", { type: "button", class: "border", on: { click: async () => {
      if (await ask("Empty the basket?", "This removes every item from your basket.", "Empty basket")) { state.basket = null; saveBasket(); viewBasket(); }
    } } }, icon("delete"), h("span", null, "Empty basket"))));
  show("basket", "Basket", ...nodes);
  refresh();
}

function copy(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => snackbar("Copied."), () => snackbar("Could not copy. Select the text and copy it manually."));
  else snackbar("Could not copy. Select the text and copy it manually.");
}

/* ---------------------------------------------------------------- orders and complaints */

function complaintText(o) {
  return ["COMPLAINT SUMMARY (prepared on the customer's phone with Hana)",
    "Order code: " + o.code, "Date and time of order: " + dateTime(o.at), "Business: " + o.restaurant,
    "Menu version: " + o.menu_version, "Menu file SHA-256: " + o.menu_hash,
    "Items: " + o.items.map((i) => i.qty + " × " + (i.label || i.key)).join("; "),
    "Items subtotal: " + money(o.subtotal), "Delivery fee: " + (o.fee === null ? "not stated" : money(o.fee)),
    "", "Message sent to the business:", o.kitchen_message, "",
    "Description of the problem:", "", "Amount in dispute (BDT):", ""].join("\n");
}

function viewOrders() {
  const orders = store.get("hana.orders", []);
  const nodes = [pageTitle("Orders"), h("p", { class: "muted" }, "Orders are stored only on this phone. No one else has a copy.")];
  if (!orders.length) nodes.push(h("p", { class: "muted" }, "No orders yet."));
  for (const o of orders) {
    nodes.push(h("article", { class: "round border no-elevate" },
      h("h2", { class: "card-title" }, o.restaurant),
      h("p", { class: "muted flush" }, "Order " + o.code + " · " + dateTime(o.at)),
      h("p", { class: "flush" }, money(o.subtotal) + (o.fee === null ? " plus delivery (fee not stated)" : " plus " + money(o.fee) + " delivery")),
      h("details", { class: "gap-top" }, h("summary", { class: "link" }, "Problem with this order?"),
        h("p", null, "Hana does not resolve disputes. For a problem involving money, contact the Directorate of National Consumer Rights Protection (DNCRP) at 16121 within 30 days, and include the summary below."),
        h("pre", null, complaintText(o)),
        h("nav", { class: "gap-top" }, h("button", { type: "button", class: "border", on: { click: () => copy(complaintText(o)) } }, icon("content_copy"), h("span", null, "Copy summary"))))));
  }
  nodes.push(sectionTitle("Your data"),
    h("nav", { class: "wrap" },
      h("button", { type: "button", class: "border", on: { click: exportData } }, icon("download"), h("span", null, "Download my data")),
      h("button", { type: "button", class: "border", on: { click: async () => {
        if (await ask("Delete everything on this phone?", "This removes your orders, saved details, area and basket. It cannot be undone. Download your data first if you want a copy.", "Delete")) {
          for (const k of ["hana.orders", "hana.me", "hana.basket", "hana.area"]) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
          state.basket = null; state.area = ""; updateBasketBadge(); viewOrders(); snackbar("Deleted.");
        }
      } } }, icon("delete"), h("span", null, "Delete everything"))));
  show("orders", "Orders", ...nodes);
}

function exportData() {
  const data = { exported: new Date().toISOString(), orders: store.get("hana.orders", []), saved_details: store.get("hana.me", {}), area: state.area };
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
    h("p", null, "Built by ", link(state.site.company_url || "https://hamidyasir.com", "Hamid Yasir & Co."), " for the people of Chittagong. Created by Hamid Yasir. Managed by the ", link(repo, "Hana Community"), "."),
    sectionTitle("Responsibility"),
    notice("warn", h("p", { class: "bold flush" }, "Hamid Yasir & Co. assumes no responsibility for anything."),
      h("p", { class: "flush" }, "All transactions and relationships are between the customer and the restaurant. All disputes are handled by the appropriate local government authority and the community.")),
    h("p", null, "For a problem involving money, contact the Directorate of National Consumer Rights Protection (DNCRP) at 16121. The Orders page prepares a complaint summary for you."),
    sectionTitle("How it works"),
    h("p", null, "Hana lists restaurants and prepares your order message. You send the message yourself, from your own phone, through the app the business uses. Hana does not take payments, prepare food or make deliveries. You pay the business directly, in cash or by Bangla QR."),
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
    ].map((t) => h("li", null, t))),
    sectionTitle("Privacy"),
    h("p", null, "Your area, basket, name, address and orders stay on this phone. Hana has no server and sends no information about you. You can download or delete all of it from the Orders page."),
    sectionTitle("Get involved"),
    h("p", null, repo ? link(repo, "View the code, report a problem or add a restaurant on the project page.") : "The project page is not linked on this host."));
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
loadAll().then(() => { fixFooterLink(); updateBasketBadge(); route(); });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* the app still works online */ });
}
