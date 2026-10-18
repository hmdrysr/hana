/* Hana: add a place that is not in the directory. Loaded only when the form is opened.
   Needs core.js, direct.js and app.js. See SPEC.md, section 26.

   - A place is kept on this phone only ("hana.myplaces") until the customer chooses to share it.
   - It is ordered from like a community listing: the message asks the business to confirm the
     prices and the total, and payment is only on delivery or at pickup.
   - Sharing sends the business's details and menu (never the customer's own details) to the
     volunteers, sealed for them if the site has a reports address, or as a public suggestion on
     the project page. Volunteers check it with the business before it is listed for everyone
     with "added_by": "customer". */
"use strict";

const MY_MAX_ITEMS = 200;

/* A phone number as Hana stores it: country code and digits, no plus. Bangladeshi mobile numbers
   may be typed as 01XXXXXXXXX. Returns "" for a number that cannot be right. */
function phoneId(v) {
  let d = String(v || "").replace(/[\s()-]/g, "");
  if (!d) return "";
  if (/^01\d{9}$/.test(d)) d = "88" + d;
  d = d.replace(/^\+/, "").replace(/^00/, "");
  return /^\d{8,15}$/.test(d) ? d : null;
}
function slug(s) { return String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item"; }

/* "Chicken biryani, 220" or "Chicken biryani 220" or "Chicken biryani" (price not known). */
function parseMenuLines(text) {
  const items = [], used = new Set(), problems = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(.*?)[,\s]+(?:BDT|Tk\.?|৳)?\s*(\d{1,6})\s*(?:BDT|Tk\.?|৳)?$/i.exec(line);
    const name = (m ? m[1] : line).replace(/[,\s]+$/, "").trim().slice(0, 80);
    if (!name) { problems.push(line); continue; }
    let id = slug(name), n = 2;
    while (used.has(id)) id = slug(name) + "-" + n++;
    used.add(id);
    items.push({ id, name, price: m ? Number(m[2]) : null });
    if (items.length >= MY_MAX_ITEMS) break;
  }
  return { items, problems };
}
function menuLines(items) { return (items || []).map((it) => it.name + (typeof it.price === "number" ? ", " + it.price : "")).join("\n"); }

function newPlaceId() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join(""); }
function savePlaces(list) { const ok = store.set("hana.myplaces", list); mergeMyPlaces(); return ok; }

/* What is shared with the volunteers: the business only, never the customer's own details. */
function placeForSharing(m) {
  return { format: "hana-suggestion-1", name: m.name, kind: m.kind, neighbourhood: m.neighbourhood || null, address: m.address || null,
    contact: m.contact, delivery: m.delivery, pickup: m.pickup === true ? true : null, items: m.items, note: m.listing_note || null, suggested: new Date().toISOString().slice(0, 10) };
}

function viewAddPlace(id) {
  const list = myPlaces();
  const old = id ? list.find((m) => m.id === id) : null;
  if (id && !old) return show("list", "Not found", pageHeader("This place is not on this phone", "#/"), h("p", { class: "muted" }, "It may have been deleted, or added on another phone."));
  const o = old || {};
  const val = (k) => (o.contact || []).find((c) => c.app === k);
  const out = h("div", { "aria-live": "polite" });
  const f = (fid, attrs) => h("input", Object.assign({ id: fid, placeholder: " ", autocomplete: "off" }, attrs || {}));
  const name = f("mp-name", { maxlength: 80, value: o.name || "" });
  const kind = h("select", { id: "mp-kind" }, [["Restaurant", "Restaurant or café"], ["Grocery store", "Grocery store"]].map(([v, t]) => h("option", { value: v, selected: (o.kind || "Restaurant") === v }, t)));
  let zone = o.neighbourhood || state.area || "";
  const address = f("mp-address", { maxlength: 160, value: o.address || "" });
  const wa = f("mp-wa", { inputmode: "tel", maxlength: 18, value: val("whatsapp") ? "+" + val("whatsapp").id : "" });
  const sms = f("mp-sms", { inputmode: "tel", maxlength: 18, value: val("sms") ? "+" + val("sms").id : "" });
  const tel = f("mp-tel", { inputmode: "tel", maxlength: 18, value: val("phone") ? "+" + val("phone").id : "" });
  const otherOld = (o.contact || []).find((c) => ["email", "telegram", "messenger", "signal"].includes(c.app));
  const otherApp = h("select", { id: "mp-other-app" }, [["", "None"], ["email", "Email"], ["telegram", "Telegram username"], ["messenger", "Messenger page name"], ["signal", "Signal number"]].map(([v, t]) => h("option", { value: v, selected: (otherOld ? otherOld.app : "") === v }, t)));
  const otherId = f("mp-other-id", { maxlength: 80, value: otherOld ? otherOld.id : "" });
  const z0 = ((o.delivery || {}).zones || [])[0];
  const delivers = h("input", { type: "checkbox", id: "mp-delivers", checked: !!z0 });
  const fee = f("mp-fee", { type: "number", min: 0, max: 999, inputmode: "numeric", value: z0 && typeof z0.fee === "number" ? String(z0.fee) : "" });
  const pickup = h("input", { type: "checkbox", id: "mp-pickup", checked: o.pickup === true });
  const items = h("textarea", { id: "mp-items", rows: 8, placeholder: " " }, menuLines(o.items));
  const note = f("mp-note", { maxlength: 300, value: o.listing_note || "" });

  const read = () => {
    const errors = [];
    const contact = [];
    const add = (app, raw, label) => { const p = phoneId(raw); if (p === null) errors.push("Check the " + label + " number."); else if (p) contact.push({ app, id: p }); };
    add("whatsapp", wa.value, "WhatsApp"); add("sms", sms.value, "text message"); add("phone", tel.value, "phone");
    if (otherApp.value) {
      const v = otherId.value.trim();
      if (!v) errors.push("Enter the " + otherApp.selectedOptions[0].textContent.toLowerCase() + ", or choose None.");
      else if (otherApp.value === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors.push("Check the email address.");
      else if (otherApp.value === "signal") add("signal", v, "Signal");
      else contact.push({ app: otherApp.value, id: v.replace(/^@/, "") });
    }
    if (contact.length) contact[0].preferred = true;
    if (!name.value.trim()) errors.push("Enter the name of the place.");
    if (!contact.length) errors.push("Add at least one way to reach it, such as WhatsApp or a phone number.");
    if (!contact.some((c) => c.app !== "phone")) errors.push("A phone number for calls alone cannot take a written order: add WhatsApp, a text-message number or another way to write.");
    if (delivers.checked && !zone) errors.push("Choose the zone it delivers to, or untick delivery.");
    const feeVal = fee.value.trim() === "" ? null : Number(fee.value);
    if (feeVal !== null && !(Number.isInteger(feeVal) && feeVal >= 0 && feeVal <= 999)) errors.push("Enter the delivery fee as a whole number of taka, or leave it empty.");
    if (!delivers.checked && !pickup.checked) errors.push("Tick delivery, pickup or both.");
    const menu = parseMenuLines(items.value);
    const firstPhone = contact.find((c) => ["whatsapp", "sms", "phone", "signal"].includes(c.app));
    return { errors, place: {
      id: o.id || newPlaceId(), local: true, added_by: "customer", claimed: false, version: (o.version || 0) + 1,
      name: name.value.trim(), kind: kind.value, neighbourhood: zone || null, address: address.value.trim() || null,
      business_phone: firstPhone ? "+" + firstPhone.id : null, contact,
      delivery: { zones: delivers.checked && zone ? [{ id: zone, shape: "named", areas: [zone], fee: feeVal, min_order: null, eta_min: null }] : [] },
      pickup: pickup.checked, items: menu.items, listing_note: note.value.trim() || null,
      created: o.created || new Date().toISOString(), updated: new Date().toISOString(), shared_at: o.shared_at || null } };
  };
  const save = () => {
    const { errors, place } = read();
    if (errors.length) { out.replaceChildren(notice("warn", h("ul", null, errors.map((e) => h("li", null, e))))); return null; }
    const rest = myPlaces().filter((m) => m.id !== place.id);
    if (!savePlaces([place].concat(rest))) { out.replaceChildren(notice("warn", h("p", { class: "flush" }, "This phone's storage is full or blocked, so the place could not be saved."))); return null; }
    log((old ? "Updated" : "Added") + " my place " + place.name + ".");
    return place;
  };

  const share = async () => {
    const place = save();
    if (!place) return;
    const what = placeForSharing(place);
    const ok = await ask("Share " + place.name + " for everyone?", "Hana sends the place's name, area, contact details and menu to the volunteers, but nothing about you. They check it with the business before listing it for everyone under Added by customers, tagged as added by a customer. Until then it stays only on your phone.", "Share");
    if (!ok) return;
    let sent = false;
    const rep = state.site.reports;
    if (rep && rep.topic && rep.enc_key) {
      try { const s = await sealOrder(rep, { t: "suggest", place: what }); await ntfyPost(rep.topic, s.envelope); sent = true; } catch (e) { sent = false; }
    }
    const repo = state.site.repo_url && /^https:\/\//.test(state.site.repo_url) ? state.site.repo_url.replace(/\/$/, "") : "";
    if (!sent && !repo) { copy(JSON.stringify(what, null, 1)); out.replaceChildren(notice("warn", h("p", { class: "flush" }, "This copy of Hana has no way to reach the volunteers. The place's details were copied: send them to a volunteer you know."))); return; }
    if (!sent) {
      const body = "A customer suggests adding this place to Hana. Volunteers: please check it with the business before listing it, with \"added_by\": \"customer\".\n\n```json\n" + JSON.stringify(what, null, 1) + "\n```";
      window.open(repo + "/issues/new?title=" + encodeURIComponent("Suggested place: " + place.name) + "&body=" + encodeURIComponent(body.slice(0, 6000)), "_blank", "noopener");
    }
    place.shared_at = new Date().toISOString();
    savePlaces([place].concat(myPlaces().filter((m) => m.id !== place.id)));
    log("Shared my place " + place.name + " with the volunteers.");
    out.replaceChildren(notice("info", h("p", { class: "flush" }, sent ? "Sent to the volunteers. They will check it with the business; it stays on your phone meanwhile." : "The project page opened with the suggestion filled in. Submitting it there makes it public, so the volunteers can check it.")));
  };

  show("list", old ? "Edit " + o.name : "Add a place", pageHeader(old ? "Edit " + o.name : "Add a place", old ? "#/r/" + o.id : "#/"),
    h("p", { class: "muted" }, "Add a restaurant, café or shop you order from that is not on Hana yet. It is kept on this phone only, and you can order from it here by WhatsApp, text message or another app. You can choose to share it for everyone later."),
    textField("mp-name", "Name", name),
    selectField("mp-kind", "Type", kind),
    zoneSelect("mp-zone", zone, (v) => { zone = v; }, "Not known", "Zone (thana)"),
    textField("mp-address", "Address or landmark (optional)", address),
    sectionTitle("How to reach it"),
    h("p", { class: "small-text muted" }, "At least one way to write to it. Numbers can be typed as 01XXXXXXXXX."),
    textField("mp-wa", "WhatsApp number", wa),
    textField("mp-sms", "Text-message number", sms),
    textField("mp-tel", "Phone number for calls", tel),
    selectField("mp-other-app", "Another way (optional)", otherApp),
    textField("mp-other-id", "Address, username or number for that way", otherId),
    sectionTitle("Delivery and pickup"),
    h("div", { class: "row" }, h("label", { class: "switch" }, delivers, h("span")), h("label", { for: "mp-delivers", class: "max" }, "Delivers to the zone above")),
    textField("mp-fee", "Delivery fee in taka, if you know it (optional)", fee),
    h("div", { class: "row" }, h("label", { class: "switch" }, pickup, h("span")), h("label", { for: "mp-pickup", class: "max" }, "Pickup is possible")),
    sectionTitle("Menu (optional)"),
    h("p", { class: "small-text muted" }, "One item per line, with the price after a comma if you know it, for example: Chicken biryani, 220. Without a menu, you can still send a written order in your own words."),
    textField("mp-items", "Items", items),
    textField("mp-note", "A note for yourself (optional)", note),
    out,
    h("nav", { class: "wrap gap-top" },
      h("button", { type: "button", on: { click: () => { const p = save(); if (p) { snackbar(old ? "Saved." : p.name + " was added to your places."); location.hash = "#/r/" + p.id; } } } }, icon("check_circle"), h("span", null, old ? "Save changes" : "Save on this phone")),
      h("button", { type: "button", class: "border", on: { click: share } }, icon("share"), h("span", null, old && o.shared_at ? "Share again for everyone" : "Save and share for everyone")),
      old ? h("button", { type: "button", class: "border", on: { click: async () => {
        if (!(await ask("Delete " + o.name + "?", "It is removed from this phone. Your past orders from it are kept. A copy already shared with the volunteers is not affected.", "Delete"))) return;
        savePlaces(myPlaces().filter((m) => m.id !== o.id));
        log("Deleted my place " + o.name + ".");
        snackbar("Deleted.");
        location.hash = "#/";
      } } }, icon("delete"), h("span", null, "Delete")) : null));
}
