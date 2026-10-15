/* Hana business tools: optional point of sale, receipts, statements, riders and backups.
   Needs core.js; used by business.js. Everything here is stored in this browser's own
   database (IndexedDB) and leaves the device only to services the business connects itself.
   Nothing here is published to GitHub or to the Hana directory. See SPEC.md, section 17. */
"use strict";

/* ---------------------------------------------------------------- local database */

const POSDB = {
  open() {
    if (!this.p) this.p = new Promise((res, rej) => {
      const r = indexedDB.open("hana-pos", 1);
      r.onupgradeneeded = () => { for (const s of ["sales", "riders", "meta"]) r.result.createObjectStore(s, { keyPath: "id" }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this.p;
  },
  async tx(store, mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const q = fn(t.objectStore(store));
      t.oncomplete = () => res(q && q.result);
      t.onerror = () => rej(t.error);
    });
  },
  all(store) { return this.tx(store, "readonly", (s) => s.getAll()); },
  get(store, id) { return this.tx(store, "readonly", (s) => s.get(id)); },
  put(store, rec) { rec.updated = new Date().toISOString(); return this.tx(store, "readwrite", (s) => s.put(rec)); },
  raw(store, rec) { return this.tx(store, "readwrite", (s) => s.put(rec)); },
  del(store, id) { return this.tx(store, "readwrite", (s) => s.delete(id)); },
};

async function posProfile() {
  return Object.assign({ id: "profile", name: "", address: "", phone: "", bin: "", footer: "Thank you!", next: 1, auto_backup: false }, (await POSDB.get("meta", "profile")) || {});
}
function uid() { const b = new Uint8Array(10); crypto.getRandomValues(b); return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(""); }
const PAY_METHODS = [["cash", "Cash"], ["qr", "Bangla QR"], ["card", "Card on a POS terminal"], ["wallet", "Mobile wallet transfer"]];
const PAY_LABEL = Object.fromEntries(PAY_METHODS.concat([["unpaid", "To be paid on delivery or at pickup"]]));
function saleTotal(s) { return s.subtotal + (s.delivery_fee || 0); }
function receiptNo(n) { return "R-" + String(n).padStart(6, "0"); }

/* Saves a new sale with the next receipt number. */
async function addSale(sale) {
  const p = await posProfile();
  sale.id = uid();
  sale.no = receiptNo(p.next);
  sale.at = sale.at || new Date().toISOString();
  p.next += 1;
  await POSDB.put("meta", p);
  await POSDB.put("sales", sale);
  if (p.auto_backup) backupNow(true);
  return sale;
}

/* A sale from a confirmed Hana order (business.js decodeOrder result). */
async function saleFromOrder(d, text) {
  const pick = (re) => ((re.exec(text || "") || [])[1] || "").trim();
  return addSale({
    source: "hana", order_code: d.code, type: d.zone === "pickup" ? "pickup" : "delivery",
    items: d.lines.map((l) => ({ name: l.label, qty: l.qty, price: l.total === null ? null : l.total / l.qty })),
    subtotal: d.sub, delivery_fee: d.fee === "?" ? 0 : Number(d.fee), payment: "unpaid", status: "open",
    customer: { name: pick(/^Name: (.+)$/m), address: pick(/^Delivery address: (.+)$/m), phone: pick(/^Phone: (.+)$/m) },
  });
}

/* ---------------------------------------------------------------- new sale */

async function viewPos() {
  const listing = store.get("hana.biz.menu", null);
  const lines = {};
  const cart = h("ul", { class: "list border" });
  const totalLine = h("p", { class: "bold flush" });
  const free = { name: input("free-name", { maxlength: 60 }), price: input("free-price", { type: "number", min: 0 }) };
  const type = h("select", { id: "sale-type" }, [["counter", "At the counter"], ["pickup", "Pickup"], ["delivery", "Delivery"]].map(([v, t]) => h("option", { value: v }, t)));
  const pay = h("select", { id: "sale-pay" }, PAY_METHODS.concat([["unpaid", "Not paid yet (pay on delivery)"]]).map(([v, t]) => h("option", { value: v }, t)));
  const fee = input("sale-fee", { type: "number", min: 0, value: 0 });
  const prices = listing ? priceLines(listing) : [];
  const recent = h("div", { class: "stack" });
  function draw() {
    let sub = 0;
    const keys = Object.keys(lines);
    cart.replaceChildren(...keys.map((k) => {
      const l = lines[k];
      sub += l.price * l.qty;
      return h("li", null, h("div", { class: "max" }, l.qty + " × " + l.name), h("span", { class: "price" }, money(l.price * l.qty)),
        h("button", { type: "button", class: "circle transparent", "aria-label": "Remove one " + l.name, on: { click: () => { if (--l.qty <= 0) delete lines[k]; draw(); } } }, icon("remove")));
    }));
    if (!keys.length) cart.replaceChildren(h("li", null, h("div", { class: "max muted" }, "No items yet.")));
    totalLine.textContent = "Total: " + money(sub + (Number(fee.value) || 0));
  }
  const addLine = (k, name, price) => { lines[k] = lines[k] || { name, price, qty: 0 }; lines[k].qty++; draw(); };
  fee.addEventListener("input", draw);
  draw();
  show("more", "New sale", pageHeader("Point of sale", "#/more"),
    posNote(),
    sectionTitle("New sale"),
    listing ? h("details", { class: "info-list", open: true }, h("summary", { class: "row" }, icon("edit_note"), h("span", { class: "max" }, "Add from your menu"), icon("expand_more")),
      h("ul", { class: "list border" }, prices.map((l) => h("li", null, h("div", { class: "max" }, l.label), h("span", { class: "price" }, money(l.price)),
        h("button", { type: "button", class: "circle", "aria-label": "Add " + l.label, on: { click: () => addLine(l.key, l.label, l.price) } }, icon("add"))))))
      : h("p", { class: "small-text muted" }, "Open Menu and find your listing once to add items from your menu here."),
    h("div", { class: "field-row" }, textField("free-name", "Other item", free.name), textField("free-price", "Price", free.price),
      h("button", { type: "button", class: "circle border", "aria-label": "Add this item", on: { click: () => {
        if (!free.name.value.trim() || !/^\d+$/.test(free.price.value)) { snackbar("Give the item a name and a whole-number price."); return; }
        addLine("x-" + uid(), free.name.value.trim(), Number(free.price.value)); free.name.value = ""; free.price.value = "";
      } } }, icon("add"))),
    cart,
    h("div", { class: "field-row" }, selectField("sale-type", "Type", type), textField("sale-fee", "Delivery fee", fee)),
    selectField("sale-pay", "Payment", pay),
    h("details", null, h("summary", { class: "link small-text" }, "Customer details (optional)"),
      textField("c-name", "Name", input("c-name", { maxlength: 60 })),
      textField("c-phone", "Phone", input("c-phone", { inputmode: "tel", maxlength: 14 })),
      textField("c-address", "Address or landmark", input("c-address", { maxlength: 160 }))),
    totalLine,
    h("nav", { class: "wrap" }, h("button", { type: "button", on: { click: async () => {
      const items = Object.values(lines).map((l) => ({ name: l.name, qty: l.qty, price: l.price }));
      if (!items.length) { snackbar("Add at least one item."); return; }
      const sale = await addSale({ source: "counter", type: type.value, items, subtotal: items.reduce((a, l) => a + l.price * l.qty, 0),
        delivery_fee: type.value === "delivery" ? Number(fee.value) || 0 : 0, payment: pay.value, status: pay.value === "unpaid" ? "open" : "paid",
        paid_at: pay.value === "unpaid" ? null : new Date().toISOString(),
        customer: { name: val("c-name"), phone: val("c-phone"), address: val("c-address") } });
      location.hash = "#/pos/" + sale.id;
    } } }, icon("check_circle"), h("span", null, "Save and show the receipt"))),
    sectionTitle("Today's sales"), recent,
    h("nav", { class: "wrap" }, h("a", { href: "#/statements", class: "button border" }, h("span", null, "Statements")), h("a", { href: "#/riders", class: "button border" }, h("span", null, "Riders"))));
  const today = new Date().toDateString();
  const sales = (await POSDB.all("sales")).filter((s) => new Date(s.at).toDateString() === today).sort((a, b) => b.at.localeCompare(a.at));
  recent.replaceChildren(sales.length ? h("ul", { class: "list border" }, sales.map((s) => h("li", null,
    h("a", { href: "#/pos/" + s.id, class: "max" }, h("div", null, s.no + (s.order_code ? " · Hana " + s.order_code : "")), h("div", { class: "small-text muted" }, clockOf(s.at) + " · " + PAY_LABEL[s.payment] + (s.status === "void" ? " · void" : ""))),
    h("span", { class: "price" }, money(saleTotal(s)))))) : h("p", { class: "muted" }, "No sales yet today."));
}
function clockOf(iso) { const d = new Date(iso); return clock(String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0")); }
function posNote() {
  return notice("info", h("p", { class: "flush" }, "Sales, receipts, customer details and riders are kept only on this device, and in any backup you connect yourself. Only your menu and listing are ever published."));
}

/* ---------------------------------------------------------------- receipt */

function receiptLines(s, p) {
  const row = (a, b, cls) => h("div", { class: "receipt-row" + (cls ? " " + cls : "") }, h("span", null, a), h("span", null, b));
  return [
    h("p", { class: "receipt-head" }, h("strong", null, p.name || "Your business"), p.address ? h("br") : null, p.address || null, p.phone ? h("br") : null, p.phone ? "Phone " + p.phone : null, p.bin ? h("br") : null, p.bin ? "BIN " + p.bin : null),
    h("p", { class: "receipt-title" }, "RECEIPT"),
    row("Receipt", s.no), row("Date", dateTime(s.at)), s.order_code ? row("Hana order", s.order_code) : null,
    row("Type", s.type === "delivery" ? "Delivery" : s.type === "pickup" ? "Pickup" : "Counter"),
    s.customer && s.customer.name ? row("Customer", s.customer.name) : null,
    s.customer && s.customer.address ? h("p", { class: "receipt-small" }, "Deliver to: " + s.customer.address + (s.customer.zone ? ", " + s.customer.zone : "")) : null,
    h("hr"),
    ...s.items.map((l) => row(l.qty + " × " + l.name + (l.price === null ? "" : " at " + money(l.price)), l.price === null ? "price to add" : money(l.qty * l.price))),
    h("hr"),
    row("Items", money(s.subtotal)), s.delivery_fee ? row("Delivery fee", money(s.delivery_fee)) : null,
    row("TOTAL", money(saleTotal(s)), "receipt-total"),
    h("p", { class: "receipt-small" }, "All prices include VAT and every other charge."),
    row("Payment", s.status === "void" ? "VOID" : PAY_LABEL[s.payment]),
    s.status === "void" ? h("p", { class: "receipt-small" }, "Voided: " + (s.void_reason || "")) : null,
    h("p", { class: "receipt-foot" }, p.footer || ""),
    h("p", { class: "receipt-small" }, "Customer receipt; not a VAT tax invoice (Mushak-6.3). Prepared with Hana."),
  ];
}

async function viewReceipt(id) {
  const s = await POSDB.get("sales", id);
  if (!s) { show("more", "Receipt", pageHeader("Receipt not found", "#/pos")); return; }
  const p = await posProfile();
  const paper = h("article", { class: "receipt", id: "receipt" }, receiptLines(s, p));
  const printAs = (size) => { document.documentElement.classList.toggle("print-a4", size === "a4"); paper.classList.add("print-me"); window.print(); paper.classList.remove("print-me"); };
  const payBox = h("div", { class: "field-row" },
    selectField("pay-now", "Paid by", h("select", { id: "pay-now" }, PAY_METHODS.map(([v, t]) => h("option", { value: v }, t)))),
    h("button", { type: "button", on: { click: async () => { s.payment = val("pay-now"); s.status = "paid"; s.paid_at = new Date().toISOString(); await POSDB.put("sales", s); viewReceipt(id); } } }, h("span", null, "Mark as paid")));
  const text = [p.name, "Receipt " + s.no + ", " + dateTime(s.at)].concat(s.items.map((l) => l.qty + " × " + l.name + ": " + (l.price === null ? "price to be confirmed" : money(l.qty * l.price))),
    [s.delivery_fee ? "Delivery fee: " + money(s.delivery_fee) : null, "Total: " + money(saleTotal(s)), "Payment: " + PAY_LABEL[s.payment]]).filter(Boolean).join("\n");
  show("more", s.no, pageHeader("Receipt " + s.no, "#/pos"),
    paper,
    h("nav", { class: "wrap" },
      h("button", { type: "button", on: { click: () => printAs("80") } }, icon("download"), h("span", null, "Print receipt (80 mm)")),
      h("button", { type: "button", class: "border", on: { click: () => printAs("a4") } }, h("span", null, "Print or save as PDF (A4)")),
      h("button", { type: "button", class: "border", on: { click: () => copy(text) } }, icon("content_copy"), h("span", null, "Copy as text")),
      s.customer && /^\+?8801\d{9}$/.test((s.customer.phone || "").replace(/^0/, "+880")) ? h("a", { class: "button border", target: "_blank", rel: "noopener",
        href: "https://wa.me/" + s.customer.phone.replace(/^0/, "880").replace(/^\+/, "") + "?text=" + encodeURIComponent(text) }, icon("send"), h("span", null, "Send by WhatsApp")) : null),
    s.items.some((l) => l.price === null) && s.status !== "void" ? [sectionTitle("Prices to add"),
      h("p", { class: "small-text muted" }, "These items have no listed price. Enter the price you told the customer."),
      ...s.items.map((l, i) => l.price === null ? textField("np-" + i, l.name + " (each)", input("np-" + i, { type: "number", min: 0 })) : null),
      h("nav", null, h("button", { type: "button", on: { click: async () => {
        for (const [i, l] of s.items.entries()) if (l.price === null && /^\d+$/.test(val("np-" + i))) l.price = Number(val("np-" + i));
        s.subtotal = s.items.reduce((n, l) => n + (l.price || 0) * l.qty, 0);
        await POSDB.put("sales", s); viewReceipt(id);
      } } }, h("span", null, "Save prices")))] : null,
    s.status === "open" ? [sectionTitle("Payment"), payBox] : null,
    s.type === "delivery" && s.status !== "void" ? [sectionTitle("Rider"), await riderPicker(s, p)] : null,
    s.status !== "void" ? h("details", null, h("summary", { class: "link small-text" }, "Void this sale"),
      textField("void-why", "Reason", input("void-why", { maxlength: 120 })),
      h("nav", null, h("button", { type: "button", class: "border", on: { click: async () => {
        if (!val("void-why")) { snackbar("Give a reason."); return; }
        s.status = "void"; s.void_reason = val("void-why"); await POSDB.put("sales", s); viewReceipt(id);
      } } }, h("span", null, "Void")))) : null);
}

/* ---------------------------------------------------------------- statements */

async function viewStatements() {
  const out = h("div", { class: "stack" });
  const today = new Date();
  const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const from = input("st-from", { type: "date", value: iso(today) });
  const to = input("st-to", { type: "date", value: iso(today) });
  const preset = (a, b) => () => { from.value = iso(a); to.value = iso(b); run(); };
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastStart = new Date(today.getFullYear(), today.getMonth() - 1, 1), lastEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  let rows = [];
  async function run() {
    const a = new Date(from.value + "T00:00"), b = new Date(to.value + "T23:59:59");
    rows = (await POSDB.all("sales")).filter((s) => { const t = new Date(s.at); return t >= a && t <= b; }).sort((x, y) => x.at.localeCompare(y.at));
    const live = rows.filter((s) => s.status !== "void");
    const sum = (f) => live.reduce((n, s) => n + f(s), 0);
    const byPay = {}, byItem = {};
    for (const s of live) {
      byPay[s.payment] = (byPay[s.payment] || 0) + saleTotal(s);
      for (const l of s.items) { byItem[l.name] = byItem[l.name] || { qty: 0, amount: 0 }; byItem[l.name].qty += l.qty; byItem[l.name].amount += l.qty * l.price; }
    }
    const p = await posProfile();
    const line = (a2, b2, bold) => h("li", null, h("div", { class: "max" + (bold ? " bold" : "") }, a2), h("span", { class: "price" + (bold ? " bold" : "") }, b2));
    out.replaceChildren(h("article", { class: "receipt receipt-wide", id: "statement" },
      h("p", { class: "receipt-head" }, h("strong", null, p.name || "Your business"), h("br"), "Sales statement, " + longDate(from.value) + (to.value !== from.value ? " to " + longDate(to.value) : "")),
      h("ul", { class: "list" },
        line("Sales", String(live.length)), line("Items sold", String(sum((s) => s.items.reduce((n, l) => n + l.qty, 0)))),
        line("Item sales", money(sum((s) => s.subtotal))), line("Delivery fees", money(sum((s) => s.delivery_fee || 0))),
        line("Total", money(sum(saleTotal)), true),
        ...Object.entries(byPay).map(([k, v]) => line(PAY_LABEL[k], money(v))),
        line("Voided sales (not counted)", String(rows.length - live.length))),
      h("p", { class: "bold" }, "Items"),
      h("ul", { class: "list" }, Object.entries(byItem).sort((x, y) => y[1].amount - x[1].amount).map(([k, v]) => line(v.qty + " × " + k, money(v.amount)))),
      h("p", { class: "receipt-small" }, "Prices include VAT and every other charge. Prepared with Hana from the records on this device.")));
  }
  const csv = () => {
    const q = (v) => '"' + String(v === null || v === undefined ? "" : v).replace(/"/g, '""') + '"';
    const head = ["receipt", "date", "time", "type", "hana_order", "items", "item_total", "delivery_fee", "total", "payment", "status"];
    const body = rows.map((s) => [s.no, s.at.slice(0, 10), clockOf(s.at), s.type, s.order_code || "", s.items.map((l) => l.qty + " x " + l.name).join("; "), s.subtotal, s.delivery_fee || 0, saleTotal(s), PAY_LABEL[s.payment], s.status].map(q).join(","));
    download("hana-sales-" + from.value + "-to-" + to.value + ".csv", [head.join(",")].concat(body).join("\r\n") + "\r\n", "text/csv");
  };
  show("more", "Statements", pageHeader("Statements", "#/more"),
    h("nav", { class: "wrap small-space" },
      h("button", { type: "button", class: "chip small border", on: { click: preset(today, today) } }, "Today"),
      h("button", { type: "button", class: "chip small border", on: { click: preset(new Date(Date.now() - 86400000), new Date(Date.now() - 86400000)) } }, "Yesterday"),
      h("button", { type: "button", class: "chip small border", on: { click: preset(new Date(Date.now() - 6 * 86400000), today) } }, "Last 7 days"),
      h("button", { type: "button", class: "chip small border", on: { click: preset(monthStart, today) } }, "This month"),
      h("button", { type: "button", class: "chip small border", on: { click: preset(lastStart, lastEnd) } }, "Last month")),
    h("div", { class: "field-row" }, textField("st-from", "From", from), textField("st-to", "To", to)),
    h("nav", { class: "wrap" }, h("button", { type: "button", on: { click: run } }, h("span", null, "Show"))),
    out,
    h("nav", { class: "wrap" },
      h("button", { type: "button", class: "border", on: { click: () => { const st = document.getElementById("statement"); if (st) { document.documentElement.classList.add("print-a4"); st.classList.add("print-me"); window.print(); st.classList.remove("print-me"); } } } }, h("span", null, "Print or save as PDF")),
      h("button", { type: "button", class: "border", on: { click: csv } }, icon("download"), h("span", null, "Download CSV (spreadsheets)"))));
  from.addEventListener("change", run); to.addEventListener("change", run);
  run();
}

/* ---------------------------------------------------------------- riders */

/* Riders are the business's own couriers. A job goes to a rider as a ready-made WhatsApp or
   text message (no cost), or, optionally, as JSON to a dispatch address the business runs
   (for example Node-RED, or its own server that talks to a courier company's merchant API). */
function riderJob(s, p) {
  const c = s.customer || {};
  return ["Delivery for " + (p.name || "us") + ": " + s.no + (s.order_code ? " (Hana " + s.order_code + ")" : ""),
    "Customer: " + ((c.name || "").split(" ")[0] || "see order"),
    "Address or landmark: " + (c.address || "ask the business") + (c.zone ? ", " + c.zone : ""),
    s.status === "paid" ? "Already paid." : "Collect " + money(saleTotal(s)) + " on delivery (cash, Bangla QR, card or wallet).",
    "Business phone: " + (p.phone || "")].join("\n");
}
async function riderPicker(s, p) {
  const riders = await POSDB.all("riders");
  const hook = store.get("hana.biz.dispatch", { url: "", token: "" });
  if (!riders.length && !hook.url) return h("p", { class: "small-text muted" }, h("a", { href: "#/riders", class: "link" }, "Add your riders"), " to send them delivery jobs with one tap.");
  const job = riderJob(s, p);
  return h("div", { class: "stack" },
    s.rider ? h("p", { class: "small-text" }, "Sent to " + s.rider.name + " at " + clockOf(s.rider.at) + ".") : null,
    h("nav", { class: "wrap small-space" }, riders.map((r) => h("a", { class: "button border", target: "_blank", rel: "noopener",
      href: "https://wa.me/" + r.phone.replace(/^\+/, "") + "?text=" + encodeURIComponent(job),
      on: { click: async () => { s.rider = { name: r.name, phone: r.phone, at: new Date().toISOString() }; await POSDB.put("sales", s); } } }, icon("moped"), h("span", null, r.name)))),
    hook.url ? h("button", { type: "button", class: "border", on: { click: async () => {
      try {
        const res = await fetch(hook.url, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, hook.token ? { Authorization: "Bearer " + hook.token } : {}),
          body: JSON.stringify({ hana: 1, receipt: s.no, order_code: s.order_code || null, pickup: { name: p.name, address: p.address, phone: p.phone },
            drop: { name: ((s.customer || {}).name || "").split(" ")[0], address: (s.customer || {}).address || "", zone: (s.customer || {}).zone || "" },
            collect: s.status === "paid" ? 0 : saleTotal(s), text: job }) });
        snackbar(res.ok ? "Sent to your dispatch address." : "The dispatch address answered " + res.status + ".");
      } catch (e) { snackbar("The dispatch address could not be reached."); }
    } } }, icon("send"), h("span", null, "Send to my dispatch address")) : null);
}
async function viewRiders() {
  const list = h("div");
  const hook = store.get("hana.biz.dispatch", { url: "", token: "" });
  async function draw() {
    const riders = await POSDB.all("riders");
    list.replaceChildren(riders.length ? h("ul", { class: "list border" }, riders.map((r) => h("li", null, icon("moped"), h("div", { class: "max" }, h("div", null, r.name), h("div", { class: "small-text muted" }, r.phone)),
      h("button", { type: "button", class: "circle transparent", "aria-label": "Remove " + r.name, on: { click: async () => { await POSDB.del("riders", r.id); draw(); } } }, icon("delete"))))) : h("p", { class: "muted" }, "No riders yet."));
  }
  show("more", "Riders", pageHeader("Riders", "#/more"),
    h("p", { class: "small-text muted" }, "Optional. Jobs go to riders as a WhatsApp message with only what they need: the customer's first name, the address or landmark and the amount to collect. Riders' numbers stay on this device."),
    list,
    h("div", { class: "field-row" }, textField("r-name", "Rider's name", input("r-name", { maxlength: 40 })), textField("r-phone", "Mobile number", input("r-phone", { inputmode: "tel", maxlength: 14 }))),
    h("nav", null, h("button", { type: "button", on: { click: async () => {
      const ph = val("r-phone").replace(/[\s-]/g, "").replace(/^0/, "+880");
      if (!val("r-name") || !/^\+8801\d{9}$/.test(ph)) { snackbar("Enter a name and a mobile number in the format +8801XXXXXXXXX."); return; }
      await POSDB.put("riders", { id: uid(), name: val("r-name"), phone: ph });
      document.getElementById("r-name").value = ""; document.getElementById("r-phone").value = "";
      draw();
    } } }, icon("add"), h("span", null, "Add rider"))),
    h("details", null, h("summary", { class: "link small-text" }, "Dispatch to another system (optional)"),
      h("p", { class: "small-text muted" }, "Jobs can also be sent as JSON to an address you run, such as a Node-RED flow or your own server, which can pass them to a courier company's merchant service. Courier services' secret keys belong on that server, never in this app."),
      textField("d-url", "Dispatch address (https)", input("d-url", { type: "url", value: hook.url })),
      textField("d-token", "Access token (optional)", input("d-token", { type: "password", value: hook.token })),
      h("nav", null, h("button", { type: "button", class: "border", on: { click: () => {
        if (val("d-url") && !/^https:\/\//.test(val("d-url"))) { snackbar("The address must start with https://."); return; }
        store.set("hana.biz.dispatch", { url: val("d-url"), token: val("d-token") }); snackbar("Saved on this device.");
      } } }, h("span", null, "Save")))));
  draw();
}

/* ---------------------------------------------------------------- receipt details and backups */

/* Backups: a file on this device, and optionally Supabase (hosted or self-hosted) or any
   CouchDB-compatible server. With a passphrase, records are encrypted on this device
   (AES-GCM, key from PBKDF2-SHA-256) before they leave it. */
async function cryptoKey(pass, salt) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function seal(obj, key) {
  if (!key) return { plain: obj };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
  return { iv: b64u(iv), ct: b64u(ct) };
}
async function unseal(box, key) {
  if (box.plain) return box.plain;
  if (!key) throw new Error("These records are encrypted. Enter the passphrase.");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(box.iv) }, key, unb64u(box.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
function backupCfg() { return store.get("hana.biz.backup", { kind: "", url: "", key: "", table: "hana_backup", user: "", password: "", salt: "", last: "" }); }

async function allRecords() {
  const out = [];
  for (const st of ["sales", "riders", "meta"]) for (const r of await POSDB.all(st)) out.push({ id: st + ":" + r.id, store: st, updated: r.updated || "", data: r });
  return out;
}
async function mergeRecords(recs) {
  let n = 0;
  for (const r of recs) {
    const cur = await POSDB.get(r.store, r.data.id);
    if (!cur || (r.data.updated || "") > (cur.updated || "")) { await POSDB.raw(r.store, r.data); n++; }
  }
  return n;
}

/* The salt for the passphrase travels with the backup as one unencrypted record, so a new
   device can restore with the passphrase alone. */
async function remote(cfg, pass) {
  const key = pass && cfg.salt ? await cryptoKey(pass, unb64u(cfg.salt)) : null;
  const saltRec = { id: "hana:salt", data: { plain: { salt: cfg.salt } } };
  const openAll = async (rows) => {
    const s = rows.find((r) => r.id === "hana:salt");
    const k = pass && s && s.data && s.data.plain ? await cryptoKey(pass, unb64u(s.data.plain.salt)) : key;
    return Promise.all(rows.filter((r) => r.id !== "hana:salt").map((r) => unseal(r.data, k)));
  };
  if (cfg.kind === "supabase") {
    const base = cfg.url.replace(/\/$/, "") + "/rest/v1/" + encodeURIComponent(cfg.table || "hana_backup");
    const hd = { apikey: cfg.key, Authorization: "Bearer " + cfg.key, "Content-Type": "application/json" };
    return {
      async push(recs) {
        const rows = [{ id: saltRec.id, updated_at: new Date().toISOString(), data: saltRec.data }].concat(await Promise.all(recs.map(async (r) => ({ id: r.id, updated_at: r.updated || new Date().toISOString(), data: await seal(r, key) }))));
        const res = await fetch(base + "?on_conflict=id", { method: "POST", headers: Object.assign({ Prefer: "resolution=merge-duplicates,return=minimal" }, hd), body: JSON.stringify(rows) });
        if (!res.ok) throw new Error("Supabase answered " + res.status + ".");
      },
      async pull() {
        const res = await fetch(base + "?select=id,data", { headers: hd });
        if (!res.ok) throw new Error("Supabase answered " + res.status + ".");
        return openAll(await res.json());
      },
    };
  }
  if (cfg.kind === "couchdb") {
    const db = cfg.url.replace(/\/$/, "");
    const hd = { "Content-Type": "application/json" };
    if (cfg.user) hd.Authorization = "Basic " + btoa(cfg.user + ":" + cfg.password);
    return {
      async push(recs) {
        recs = [{ id: saltRec.id, plainData: saltRec.data }].concat(recs);
        const have = await fetch(db + "/_all_docs", { method: "POST", headers: hd, body: JSON.stringify({ keys: recs.map((r) => r.id) }) });
        if (!have.ok) throw new Error("The server answered " + have.status + ".");
        const revs = {};
        for (const row of (await have.json()).rows || []) if (row.value && !row.value.deleted) revs[row.key] = row.value.rev;
        const docs = await Promise.all(recs.map(async (r) => Object.assign({ _id: r.id, data: r.plainData || await seal(r, key) }, revs[r.id] ? { _rev: revs[r.id] } : {})));
        const res = await fetch(db + "/_bulk_docs", { method: "POST", headers: hd, body: JSON.stringify({ docs }) });
        if (!res.ok) throw new Error("The server answered " + res.status + ".");
      },
      async pull() {
        const res = await fetch(db + "/_all_docs?include_docs=true", { headers: hd });
        if (!res.ok) throw new Error("The server answered " + res.status + ".");
        return openAll(((await res.json()).rows || []).filter((r) => r.doc && r.doc.data).map((r) => ({ id: r.id, data: r.doc.data })));
      },
    };
  }
  throw new Error("Choose a backup service first.");
}

let backupPass = "";
async function backupNow(quiet) {
  const cfg = backupCfg();
  if (!cfg.kind) return;
  try {
    const recs = (await allRecords()).filter((r) => !cfg.last || r.updated > cfg.last);
    if (recs.length) await (await remote(cfg, backupPass)).push(recs);
    cfg.last = new Date().toISOString();
    store.set("hana.biz.backup", cfg);
    if (!quiet) snackbar(recs.length ? "Backed up " + recs.length + " records." : "Everything was already backed up.");
  } catch (e) { if (!quiet) snackbar(e.message); }
}

async function viewBackup() {
  const cfg = backupCfg();
  const p = await posProfile();
  const kind = h("select", { id: "b-kind" }, [["", "No online backup"], ["supabase", "Supabase (hosted or self-hosted)"], ["couchdb", "CouchDB server (self-hosted)"]].map(([v, t]) => h("option", { value: v, selected: cfg.kind === v }, t)));
  const file = h("input", { type: "file", accept: ".json,application/json", hidden: true, on: { change: async () => {
    try {
      const data = JSON.parse(new TextDecoder().decode(await readFile(file)));
      if (data.format !== "hana-pos-backup-1") throw new Error("This is not a Hana point-of-sale backup.");
      snackbar("Restored " + await mergeRecords(data.records) + " records. Newer records on this device were kept.");
    } catch (e) { snackbar(e.message); }
  } } });
  show("more", "Records and backups", pageHeader("Records and backups", "#/more"),
    notice("info", h("p", { class: "bold flush" }, "What leaves this device"),
      h("p", { class: "flush" }, "Only your menu and your directory listing are published, to your own repository and the Hana directory. Orders, sales, receipts, customer details, riders, keys and tokens stay on this device. Backups go only where you send them below.")),
    sectionTitle("Receipt details"),
    textField("p-name", "Business name on receipts", input("p-name", { value: p.name, maxlength: 80 })),
    textField("p-address", "Address", input("p-address", { value: p.address, maxlength: 160 })),
    textField("p-phone", "Phone", input("p-phone", { value: p.phone, maxlength: 14 })),
    textField("p-bin", "BIN, if registered for VAT (optional)", input("p-bin", { value: p.bin, maxlength: 20 })),
    textField("p-footer", "Line at the bottom", input("p-footer", { value: p.footer, maxlength: 80 })),
    h("p", { class: "small-text muted" }, "Hana's receipts are customer receipts. A business that must issue VAT tax invoices (Mushak-6.3) or use an NBR electronic fiscal device must keep doing so."),
    h("nav", null, h("button", { type: "button", on: { click: async () => {
      Object.assign(p, { name: val("p-name"), address: val("p-address"), phone: val("p-phone"), bin: val("p-bin"), footer: val("p-footer") });
      await POSDB.put("meta", p); snackbar("Saved on this device.");
    } } }, h("span", null, "Save"))),
    sectionTitle("Backup file"),
    h("p", { class: "small-text muted" }, "Download everything as one file and keep it somewhere safe, such as a USB drive or your own cloud storage. Restoring never deletes anything."),
    file,
    h("nav", { class: "wrap" },
      h("button", { type: "button", on: { click: async () => download("hana-pos-backup-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify({ format: "hana-pos-backup-1", exported: new Date().toISOString(), records: await allRecords() }, null, 1), "application/json") } }, icon("download"), h("span", null, "Download a backup")),
      h("button", { type: "button", class: "border", on: { click: () => file.click() } }, icon("upload"), h("span", null, "Restore from a file"))),
    sectionTitle("Online backup (optional)"),
    h("p", { class: "small-text muted" }, "Use a service you control. For Supabase, create a table with: create table hana_backup (id text primary key, updated_at timestamptz, data jsonb); then enable row level security with a policy for your key. For CouchDB, create a database and allow this site in its CORS settings."),
    selectField("b-kind", "Service", kind),
    textField("b-url", "Address (Supabase project URL, or CouchDB database URL)", input("b-url", { type: "url", value: cfg.url })),
    textField("b-key", "Supabase API key", input("b-key", { type: "password", value: cfg.key })),
    textField("b-table", "Supabase table", input("b-table", { value: cfg.table || "hana_backup" })),
    h("div", { class: "field-row" }, textField("b-user", "CouchDB user", input("b-user", { value: cfg.user })), textField("b-pass", "CouchDB password", input("b-pass", { type: "password", value: cfg.password }))),
    textField("b-phrase", "Encryption passphrase (kept in memory only; strongly recommended)", input("b-phrase", { type: "password" })),
    h("div", { class: "row" }, h("label", { class: "switch" }, h("input", { type: "checkbox", id: "b-auto", checked: p.auto_backup }), h("span")), h("label", { for: "b-auto", class: "max" }, "Back up after every sale while this page is open")),
    h("nav", { class: "wrap" },
      h("button", { type: "button", on: { click: async () => {
        const n = Object.assign(backupCfg(), { kind: kind.value, url: val("b-url"), key: val("b-key"), table: val("b-table") || "hana_backup", user: val("b-user"), password: val("b-pass") });
        if (n.kind && !/^https:\/\//.test(n.url)) { snackbar("The address must start with https://."); return; }
        if (!n.salt) n.salt = b64u(crypto.getRandomValues(new Uint8Array(16)));
        if (val("b-phrase")) backupPass = val("b-phrase");
        store.set("hana.biz.backup", n);
        p.auto_backup = checked("b-auto"); await POSDB.put("meta", p);
        await backupNow(false);
      } } }, icon("cloud_upload"), h("span", null, "Save and back up now")),
      h("button", { type: "button", class: "border", on: { click: async () => {
        try { if (val("b-phrase")) backupPass = val("b-phrase"); snackbar("Restored " + await mergeRecords(await (await remote(backupCfg(), backupPass)).pull()) + " records."); }
        catch (e) { snackbar(e.message); }
      } } }, h("span", null, "Restore from the service"))),
    cfg.last ? h("p", { class: "small-text muted" }, "Last backup: " + dateTime(cfg.last) + ".") : null,
    h("p", { class: "small-text muted" }, "To restore on a new device, enter the same service details and passphrase, then tap Restore. Without the passphrase, encrypted backups cannot be read by anyone, including you."));
}
