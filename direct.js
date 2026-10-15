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
    try { out.push(Object.assign({ id: m.id, time: m.time }, await dUnseal(key, t[1]))); } catch (e) { /* not ours, or altered */ }
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

/* Presence: open business tools post "online" every 5 minutes and "offline" when closed. A
   business counts as available if it posted "online" within the last 12 minutes. */
const PRESENCE_EVERY_MS = 5 * 60000;
async function isOnline(direct) {
  try {
    const msgs = await ntfyPoll(presenceTopic(direct.topic), "12m");
    const last = msgs[msgs.length - 1];
    return !!last && last.message === "online";
  } catch (e) { return true; /* the service itself is unreachable: do not blame the business */ }
}
