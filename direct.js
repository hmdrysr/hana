/* Hana direct orders: orders, replies, cancellations and status updates travel through ntfy
   (free, open source, no account), end-to-end encrypted with the browser's own WebCrypto.
   Needs core.js. See SPEC.md, section 21.

   - A claimed business publishes, in its signed menu, "direct": { topic, enc_key }: an ntfy
     topic address and the public half of a P-256 encryption key.
   - The customer's app makes a one-off key pair, derives a shared AES-GCM key with the
     business's public key (ECDH, then HKDF-SHA-256), and sends the order to the topic as
     "HANA1 <envelope>". The envelope names a fresh, private topic for this order.
   - Everything after that (confirmation, status, chat, cancellation) goes on the order's own
     topic, sealed with the same AES key, as "HANA1R <sealed>".
   - The ntfy server sees only ciphertext. */
"use strict";

const NTFY_DEFAULT = "https://ntfy.sh/";
function randomTopic(prefix) {
  const b = crypto.getRandomValues(new Uint8Array(15));
  return NTFY_DEFAULT + (prefix || "hana-") + b32(b).toLowerCase();
}
function presenceTopic(topic) { return topic.replace(/\/$/, "") + "-online"; }

const dTe = new TextEncoder(), dTd = new TextDecoder();
async function hkdfAes(secretBits, info) {
  const base = await crypto.subtle.importKey("raw", secretBits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: dTe.encode(info) }, base, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}
async function dSeal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, dTe.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return b64u(out);
}
async function dUnseal(key, text) {
  const all = unb64u(text);
  return JSON.parse(dTd.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12) }, key, all.slice(12))));
}
async function aesFromRaw(b64) { return crypto.subtle.importKey("raw", unb64u(b64), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]); }
async function aesToRaw(key) { return b64u(new Uint8Array(await crypto.subtle.exportKey("raw", key))); }

/* Customer: encrypt an order for a business. Returns the envelope to post and the order's
   key and private topic, which the customer's app keeps with the order. */
async function sealOrder(direct, payload) {
  const biz = await crypto.subtle.importKey("jwk", Object.assign({ ext: true }, direct.enc_key), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: biz }, eph.privateKey, 256);
  const key = await hkdfAes(bits, "hana-direct-1");
  const orderTopic = randomTopic("hana-o-");
  const sealed = await dSeal(key, Object.assign({ t: "order", reply: orderTopic }, payload));
  const e = b64u(new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey)));
  return { envelope: "HANA1 " + e + "." + sealed, key: await aesToRaw(key), orderTopic };
}

/* Business: open an order envelope with the business's private encryption key (a JWK). */
async function openOrder(privJwk, text) {
  const m = /^HANA1 ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec((text || "").trim());
  if (!m) return null;
  const priv = await crypto.subtle.importKey("jwk", privJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const eph = await crypto.subtle.importKey("raw", unb64u(m[1]), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const key = await hkdfAes(await crypto.subtle.deriveBits({ name: "ECDH", public: eph }, priv, 256), "hana-direct-1");
  return { key, keyRaw: await aesToRaw(key), order: await dUnseal(key, m[2]) };
}

/* Either side: post a sealed follow-up (confirm, decline, status, chat, cancel) on the order's topic. */
async function postSealed(topic, keyRaw, obj) {
  await ntfyPost(topic, "HANA1R " + await dSeal(await aesFromRaw(keyRaw), Object.assign({ at: new Date().toISOString() }, obj)));
}
async function readSealed(topic, keyRaw, since) {
  const key = await aesFromRaw(keyRaw);
  const out = [];
  for (const m of await ntfyPoll(topic, since || "24h")) {
    const t = /^HANA1R ([A-Za-z0-9_-]+)$/.exec(m.message || "");
    if (!t) continue;
    try { const body = await dUnseal(key, t[1]); out.push(Object.assign({ id: m.id, time: m.time }, body, { body })); } catch (e) { /* not ours, or altered */ }
  }
  return out;
}

async function ntfyPost(topic, text) {
  const r = await fetch(topic, { method: "POST", body: text, cache: "no-store" });
  if (!r.ok) throw new Error("The order service answered " + r.status + ".");
}
async function ntfyPoll(topic, since) {
  const r = await fetch(topic.replace(/\/$/, "") + "/json?poll=1&since=" + encodeURIComponent(since || "12h"), { cache: "no-store" });
  if (!r.ok) throw new Error("The order service answered " + r.status + ".");
  return (await r.text()).split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } })
    .filter((m) => m && m.event === "message");
}
/* A live connection to one or more topics on the same server (Server-Sent Events, which
   reconnect by themselves). Returns a function that closes it. */
function ntfyListen(topics, onMessage) {
  if (!topics.length || typeof EventSource === "undefined") return () => {};
  const base = topics[0].replace(/[^/]+$/, "");
  const names = topics.map((t) => t.slice(base.length)).join(",");
  const es = new EventSource(base + names + "/sse");
  es.onmessage = (e) => { try { const m = JSON.parse(e.data); if (m.event === "message") onMessage(m); } catch (x) { /* ignore */ } };
  return () => es.close();
}

/* Presence: open business tools post a signed status every 5 minutes and "offline" when closed.
   Each message is "presence1 <json>" with {s: "online" | "offline", at, sold, busy, pickup_only,
   sig}, signed with the listing key (or a staff key) over the presence topic and the body.
   A customer's app accepts only messages that:
   - carry a valid signature from a key in the signed menu (owner or staff);
   - reached the relay in the last 12 minutes, with a signing time within 15 minutes of that
     (an old message posted again gets a new relay time but keeps its old signing time).
   Of those, the one signed last wins, so a replayed "offline" cannot hide a newer "online".
   The result is one of three states, never a guess:
   - "online": a valid, fresh signal says the business is taking orders;
   - "offline": no valid signal, or the latest one says offline;
   - "unknown": the relay could not be reached, or only unsigned or uncheckable signals arrived.
   Sold-out items, busy time and pickup only are used only from a verified "online" signal. */
const PRESENCE_EVERY_MS = 5 * 60000;
function presenceBytes(topic, body) {
  const b = JSON.parse(JSON.stringify(body));
  delete b.sig;
  return dTe.encode("hana-presence-1\n" + presenceTopic(topic) + "\n" + canonicalJSON(b));
}
/* Business: the text to post, signed with the listing (or staff) key. */
async function signPresence(jwk, topic, s, today, when) {
  const t = today || {};
  const body = { s, at: (when || new Date()).toISOString(), sold: Array.isArray(t.sold) ? t.sold.map(String) : [], busy: Math.min(120, Math.max(0, Number(t.busy) || 0)), pickup_only: t.pickup_only === true };
  const priv = await crypto.subtle.importKey("jwk", Object.assign({ ext: true }, jwk), { name: "Ed25519" }, false, ["sign"]);
  body.sig = b64u(new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, priv, presenceBytes(topic, body))));
  return "presence1 " + JSON.stringify(body);
}
const NO_LIVE = { sold: [], busy: 0, pickup_only: false };
/* Customer: keys are the base64url public keys from the signed menu (owner, then staff). */
async function presence(direct, keys) {
  let msgs;
  try { msgs = await ntfyPoll(presenceTopic(direct.topic), "12m"); } catch (e) { return Object.assign({ state: "unknown", online: false, reason: "unreachable" }, NO_LIVE); }
  const ks = (keys || []).filter((k) => typeof k === "string" && k);
  let best = null, unverified = false;
  for (const m of msgs) {
    const text = String(m.message || "");
    if (text.length > 4096) continue;
    const pm = /^presence1 (\{.*\})$/.exec(text);
    if (!pm) { if (/^online\b/.test(text)) unverified = true; continue; }
    let b; try { b = JSON.parse(pm[1]); } catch (e) { continue; }
    if (!b || (b.s !== "online" && b.s !== "offline") || typeof b.sig !== "string") continue;
    const at = Date.parse(b.at);
    if (!Number.isFinite(at) || !Number.isFinite(m.time) || Math.abs(m.time * 1000 - at) > 15 * 60000) continue;
    let ok = false, cannot = false;
    for (const k of ks) {
      let r = null;
      try { r = await ed25519Verify(unb64u(k), presenceBytes(direct.topic, b), unb64u(b.sig)); } catch (e) { r = false; }
      if (r === true) { ok = true; break; }
      if (r === null) cannot = true;
    }
    if (!ok) { if (cannot || !ks.length) unverified = true; continue; }
    if (!best || at > best.at) best = { at, b };
  }
  if (best && best.b.s === "online") {
    const d = best.b;
    return { state: "online", online: true, sold: Array.isArray(d.sold) ? d.sold.map(String).slice(0, 500) : [], busy: Math.min(120, Math.max(0, Number(d.busy) || 0)), pickup_only: d.pickup_only === true };
  }
  if (best) return Object.assign({ state: "offline", online: false }, NO_LIVE);
  if (unverified) return Object.assign({ state: "unknown", online: false, reason: "unverified" }, NO_LIVE);
  return Object.assign({ state: "offline", online: false }, NO_LIVE);
}
async function isOnline(direct, keys) { return (await presence(direct, keys)).online; }

/* Browser alerts through ntfy's own web push, for the given topic addresses on one server. */
async function ntfyPush(topics) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("This browser cannot show alerts while Hana is closed. On an iPhone, add Hana to the home screen first.");
  const base = topics[0].replace(/[^/]+$/, "");
  const cfg = await (await fetch(base + "config.js", { cache: "no-store" })).text();
  const key = (/"?web_push_public_key"?\s*:\s*"([A-Za-z0-9_-]+)"/.exec(cfg) || [])[1];
  if (!key) throw new Error("This ntfy server does not offer browser alerts.");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Alerts are blocked in this browser's settings.");
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("sw.js"));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) }));
  const j = sub.toJSON();
  const r = await fetch(base + "v1/webpush", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: j.endpoint, auth: j.keys.auth, p256dh: j.keys.p256dh, topics: topics.map((t) => t.split("/").pop()) }) });
  if (!r.ok) throw new Error("ntfy answered " + r.status + ".");
}
