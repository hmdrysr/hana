/* Hana sign-in for businesses. The business key file never has to be carried around: it is kept,
   encrypted, as vault.json next to menu.json in the business's repository, and unlocked with a
   passkey (fingerprint, face or screen lock) or with a five-word recovery phrase.
   Needs core.js. See SPEC.md, section 22.

   - A random data key (AES-GCM, 256 bits) encrypts the key file.
   - The data key is wrapped once per way in: with the recovery phrase (PBKDF2-SHA-256, 600,000
     rounds) and with each passkey (the WebAuthn "prf" extension gives a secret that only that
     passkey can reproduce; HKDF-SHA-256 turns it into a wrapping key).
   - The phrase is five words from the BIP-39 English list (2,048 words, about 55 bits), chosen by
     the browser's own random generator. Nobody but the owner ever sees it. */
"use strict";

const VAULT_ROUNDS = 600000;
let vaultWords = null;
async function vaultWordList() {
  if (!vaultWords) vaultWords = (await (await fetch("vault-words.txt")).text()).split(/\s+/).filter(Boolean);
  return vaultWords;
}
async function newPhrase() {
  const w = await vaultWordList();
  const r = crypto.getRandomValues(new Uint16Array(5));
  return Array.from(r, (n) => w[n % 2048]).join(" ");
}
/* Accepts any case and spacing, and each word's first four letters (they are unique in the list). */
async function normalPhrase(text) {
  const w = await vaultWordList();
  const parts = String(text || "").toLowerCase().trim().split(/[\s,.-]+/).filter(Boolean);
  if (parts.length !== 5) return null;
  const out = parts.map((p) => w.find((x) => x === p || (p.length >= 4 && x.startsWith(p.slice(0, 4)))));
  return out.every(Boolean) ? out.join(" ") : null;
}

const vTe = new TextEncoder();
async function aesEnc(key, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv: b64u(iv), ct: b64u(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes))) };
}
async function aesDec(key, box) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(box.iv) }, key, unb64u(box.ct)));
}
async function phraseKek(phrase, salt, rounds) {
  const base = await crypto.subtle.importKey("raw", vTe.encode(phrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function prfKek(secret) {
  const base = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: vTe.encode("hana-vault-passkey-1") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function rawDek(dek) { return new Uint8Array(await crypto.subtle.exportKey("raw", dek)); }
async function importDek(raw) { return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]); }

/* A new vault for a key file (its text) and a recovery phrase. Returns { vault, dek }. */
async function makeVault(keyText, keyId, phrase) {
  const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapped = await aesEnc(await phraseKek(phrase, salt, VAULT_ROUNDS), await rawDek(dek));
  const vault = { hana_vault: 1, about: "The Hana business key, encrypted. It opens only with the owner's passkey or recovery phrase.", key_id: keyId,
    data: await aesEnc(dek, vTe.encode(keyText)),
    unlock: [Object.assign({ type: "phrase", kdf: "PBKDF2-SHA-256", rounds: VAULT_ROUNDS, salt: b64u(salt) }, wrapped)] };
  return { vault, dek };
}
async function openWith(vault, kek, entry) {
  const dek = await importDek(await aesDec(kek, entry));
  return { keyText: new TextDecoder().decode(await aesDec(dek, vault.data)), dek };
}
async function unlockWithPhrase(vault, text) {
  const phrase = await normalPhrase(text);
  if (!phrase) throw new Error("Enter the five words of your recovery phrase.");
  const e = (vault.unlock || []).find((x) => x.type === "phrase");
  if (!e) throw new Error("This vault has no recovery phrase.");
  try { return await openWith(vault, await phraseKek(phrase, unb64u(e.salt), e.rounds), e); }
  catch (err) { throw new Error("That recovery phrase does not open this vault. Check the words and try again."); }
}

function passkeySupported() { return !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext); }
/* Adds a passkey on this device to an open vault (needs its data key). */
async function addPasskey(vault, dek, label) {
  if (!passkeySupported()) throw new Error("This browser cannot use passkeys. Use your recovery phrase.");
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.create({ publicKey: {
    rp: { name: "Hana business tools", id: location.hostname },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: label, displayName: label },
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    pubKeyCredParams: [{ type: "public-key", alg: -8 }, { type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    extensions: { prf: { eval: { first: salt } } } } });
  const ext = cred.getClientExtensionResults().prf;
  if (!ext || ext.enabled === false) throw new Error("Passkeys on this device cannot unlock keys. Use your recovery phrase here, or try another device.");
  const id = b64u(new Uint8Array(cred.rawId));
  let secret = ext.results && ext.results.first;
  if (!secret) secret = (await passkeySecret([{ credential: id, prf_salt: b64u(salt) }])).secret;
  const entry = Object.assign({ type: "passkey", rp: location.hostname, label, credential: id, prf_salt: b64u(salt), added: new Date().toISOString() },
    await aesEnc(await prfKek(new Uint8Array(secret)), await rawDek(dek)));
  const next = Object.assign({}, vault, { unlock: (vault.unlock || []).concat(entry) });
  return next;
}
async function passkeySecret(entries) {
  const eval1 = {};
  for (const e of entries) eval1[e.credential] = { first: unb64u(e.prf_salt) };
  const a = await navigator.credentials.get({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: location.hostname, userVerification: "required",
    allowCredentials: entries.map((e) => ({ type: "public-key", id: unb64u(e.credential) })),
    extensions: { prf: { evalByCredential: eval1 } } } });
  const res = a.getClientExtensionResults().prf;
  if (!res || !res.results || !res.results.first) throw new Error("This passkey did not give an unlock secret. Use your recovery phrase.");
  return { id: b64u(new Uint8Array(a.rawId)), secret: res.results.first };
}
async function unlockWithPasskey(vault) {
  if (!passkeySupported()) throw new Error("This browser cannot use passkeys. Use your recovery phrase.");
  const mine = (vault.unlock || []).filter((x) => x.type === "passkey" && x.rp === location.hostname);
  if (!mine.length) throw new Error("No passkey has been added for this address yet. Sign in with your recovery phrase, then add one.");
  const got = await passkeySecret(mine);
  const e = mine.find((x) => x.credential === got.id);
  if (!e) throw new Error("That passkey is not one of this business's.");
  return openWith(vault, await prfKek(new Uint8Array(got.secret)), e);
}

/* Where a listing's vault is published: next to its menu. */
async function fetchVault(row) {
  for (const loc of row.locations || []) {
    try {
      const r = await fetch(loc.replace(/menu\.json$/, "vault.json"), { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch (e) { /* try the next location */ }
  }
  return null;
}
function vaultText(vault) { return JSON.stringify(vault, null, 2) + "\n"; }
