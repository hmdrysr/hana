/* Hana: a printable directory in the style of a telephone book, written as a PDF file in the
   browser with no library. Uses the PDF standard fonts (Helvetica), so the file is small and
   opens anywhere. Text outside the Western European character set is replaced with "?".

   book = { title, subtitle, generated, intro: [text], entries: [{ name, letter, lines: [{ text, weight }],
            sections: [{ name, items: [{ name, price }] }] }] }
   weight: "plain", "bold" or "italic". Returns a Uint8Array. */
"use strict";

function makePhoneBookPdf(book) {
  const W = 595.28, H = 841.89, M = 36, GUT = 18, COLW = (W - 2 * M - GUT) / 2;
  /* Helvetica advance widths (1/1000 em) for ASCII 32 to 126, from the standard font metrics. */
  const HW = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
    278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722,
    667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556,
    333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const WIN = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99 };
  const enc = (s) => Array.from(String(s)).map((ch) => {
    const c = ch.codePointAt(0);
    if (c >= 32 && c < 127) return ch;
    if (WIN[ch]) return String.fromCharCode(WIN[ch]);
    if (c >= 160 && c < 256) return ch;
    return "?";
  }).join("");
  const width = (s, size, style) => {
    let w = 0;
    for (const ch of enc(s)) { const c = ch.charCodeAt(0); w += c >= 32 && c < 127 ? HW[c - 32] : 556; }
    return w * size / 1000 * (style === "bold" ? 1.07 : 1);
  };
  const esc = (s) => enc(s).replace(/[\\()]/g, (x) => "\\" + x);
  const FONT = { plain: "F1", bold: "F2", italic: "F3" };
  const wrap = (text, size, style, maxW) => {
    const out = [];
    let line = "";
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
      const t = line ? line + " " + word : word;
      if (width(t, size, style) <= maxW || !line) line = t;
      else { out.push(line); line = word; }
    }
    if (line) out.push(line);
    return out;
  };

  const pages = [];
  let ops = [], col = 0, y = 0, top = 0;
  const text = (x, yy, s, size, style) => ops.push("BT /" + FONT[style || "plain"] + " " + size + " Tf " + x.toFixed(2) + " " + yy.toFixed(2) + " Td (" + esc(s) + ") Tj ET");
  const rule = (x1, yy, x2, grey) => ops.push((grey || 0.6) + " G 0.5 w " + x1.toFixed(2) + " " + yy.toFixed(2) + " m " + x2.toFixed(2) + " " + yy.toFixed(2) + " l S");
  const box = (x, yy, w, hh, grey) => ops.push(grey + " g " + x.toFixed(2) + " " + yy.toFixed(2) + " " + w.toFixed(2) + " " + hh.toFixed(2) + " re f 0 g");
  const colX = () => M + col * (COLW + GUT);

  function newPage() {
    if (ops.length) pages.push(ops);
    ops = [];
    const n = pages.length + 1;
    text(M, H - M + 8, book.title, 8, "bold");
    const right = book.generated;
    text(W - M - width(right, 8), H - M + 8, right, 8);
    rule(M, H - M + 4, W - M);
    const foot = "Page " + n;
    text((W - width(foot, 8)) / 2, M - 18, foot, 8);
    col = 0;
    top = H - M - 10;
    y = top;
  }
  function need(h) {
    if (y - h >= M) return;
    if (col === 0) { col = 1; y = top; return; }
    newPage();
  }
  function line(s, size, style, indent) {
    const lead = size * 1.25;
    for (const part of wrap(s, size, style, COLW - (indent || 0))) {
      need(lead);
      y -= lead;
      text(colX() + (indent || 0), y, part, size, style);
    }
  }
  function priced(name, price, size) {
    const lead = size * 1.25;
    const pw = width(price, size);
    const parts = wrap(name, size, "plain", COLW - pw - 12);
    parts.forEach((p, i) => {
      need(lead);
      y -= lead;
      text(colX() + 6, y, p, size);
      if (i === parts.length - 1) {
        const start = colX() + 6 + width(p, size) + 3, end = colX() + COLW - pw - 3;
        const dot = width(".", size);
        if (end - start > dot * 2) text(start, y, ".".repeat(Math.floor((end - start) / dot)), size);
        text(colX() + COLW - pw, y, price, size);
      }
    });
  }

  newPage();
  /* Title block across both columns on the first page. */
  y -= 22;
  text(M, y, book.title, 20, "bold");
  y -= 16;
  text(M, y, book.subtitle, 11);
  for (const para of book.intro || []) {
    for (const part of wrap(para, 8.5, "plain", W - 2 * M)) { y -= 11; text(M, y, part, 8.5); }
    y -= 3;
  }
  y -= 6;
  rule(M, y, W - M);
  top = y - 4;
  y = top;

  let letter = null;
  for (const e of book.entries) {
    if (e.letter !== letter) {
      letter = e.letter;
      need(30);
      y -= 20;
      box(colX(), y - 4, COLW, 18, 0.88);
      text(colX() + 6, y, letter, 12, "bold");
      y -= 6;
    }
    need(40);
    y -= 6;
    line(e.name, 11, "bold");
    for (const l of e.lines) line(l.text, 8, l.weight);
    for (const s of e.sections) {
      need(20);
      y -= 3;
      line(s.name.toUpperCase(), 7, "bold");
      for (const it of s.items) priced(it.name, it.price, 7.5);
    }
    need(8);
    y -= 5;
    rule(colX(), y, colX() + COLW, 0.8);
  }
  pages.push(ops);

  /* Assemble the file: catalogue, page tree, three fonts, then each page and its content. */
  const objs = [];
  const add = (s) => { objs.push(s); return objs.length; };
  const catalog = add(""), tree = add("");
  const fontObj = (name) => add("<< /Type /Font /Subtype /Type1 /BaseFont /" + name + " /Encoding /WinAnsiEncoding >>");
  const f1 = fontObj("Helvetica"), f2 = fontObj("Helvetica-Bold"), f3 = fontObj("Helvetica-Oblique");
  const kids = [];
  for (const p of pages) {
    const body = p.join("\n");
    const content = add("<< /Length " + body.length + " >>\nstream\n" + body + "\nendstream");
    kids.push(add("<< /Type /Page /Parent " + tree + " 0 R /MediaBox [0 0 " + W + " " + H + "] /Contents " + content + " 0 R /Resources << /Font << /F1 " + f1 + " 0 R /F2 " + f2 + " 0 R /F3 " + f3 + " 0 R >> >> >>"));
  }
  objs[catalog - 1] = "<< /Type /Catalog /Pages " + tree + " 0 R >>";
  objs[tree - 1] = "<< /Type /Pages /Kids [" + kids.map((k) => k + " 0 R").join(" ") + "] /Count " + kids.length + " >>";
  const info = add("<< /Title (" + esc(book.title + ": " + book.subtitle) + ") /Producer (Hana) >>");
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
  const xref = out.length;
  out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += "trailer\n<< /Size " + (objs.length + 1) + " /Root " + catalog + " 0 R /Info " + info + " 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}
