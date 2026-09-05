// Rigenera assets/splash-icon.png: l'arte di icon.png ritagliata nella stessa
// forma che iOS usa per le icone (superellisse, "squircle"), con l'esterno
// trasparente.
// Nessuna dipendenza: decoder/encoder PNG a mano (RGBA 8 bit, non interlacciato).
const { readFileSync, writeFileSync } = require("node:fs");
const { inflateSync, deflateSync } = require("node:zlib");
const path = require("node:path");

// Uso: node assets/brand/icon-v2/splash-source.cjs   (dalla root del repo)
// Sorgente: assets/icon.png (l'arte v2 a tutto campo, 1024x1024 RGBA).
// Uscita:   assets/splash-icon.png + assets/brand/icon-v2/splash-icon.png.
//
// Perche' trasparente e non su campo pieno: il plugin expo-splash-screen
// disegna questa immagine larga 200 pt al centro di DUE fondali diversi,
// #F5F3EF in tema chiaro e #0E1015 in tema scuro (app.json). Un fondale cotto
// dentro il PNG si vedrebbe come una toppa su uno dei due. Fuori dalla forma
// mettiamo alpha 0 e il fondale giusto passa da solo.
//
// Perche' la superellisse e non un rettangolo stondato: e' la silhouette con
// cui iOS ritaglia l'icona sulla home. Cosi' lo splash e' letteralmente la
// stessa figura che l'utente ha appena toccato per aprire l'app.
// Verificato da lib/native-config.test.ts ("lo splash e' l'icona v2").
const ROOT = process.argv[2] ?? path.join(__dirname, "..", "..", "..");
const SIZE = 1024;
// Esponente della superellisse |u|^n + |v|^n <= 1 sul quadrato normalizzato in
// [-1,1]. n=2 sarebbe un cerchio, n->inf il quadrato pieno; iOS sta vicino a 5.
const N = 5;
// Campioni per lato dentro ogni pixel: l'alpha del bordo e' la frazione di
// sotto-campioni dentro la forma. 4x4 basta, la figura e' convessa e liscia.
const SS = 4;

function paeth(a, b, c) {
  const p = a + b - c;
  const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
  if (da <= db && da <= dc) return a;
  return db <= dc ? b : c;
}

function decode(file) {
  const b = readFileSync(file);
  if (b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("non PNG");
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  const depth = b[24], color = b[25], interlace = b[28];
  if (depth !== 8 || color !== 6 || interlace !== 0) throw new Error(`atteso RGBA8, trovato ${depth}/${color}/${interlace}`);
  const idat = [];
  for (let off = 8; off + 8 <= b.length; ) {
    const len = b.readUInt32BE(off);
    const type = b.subarray(off + 4, off + 8).toString("ascii");
    if (type === "IDAT") idat.push(b.subarray(off + 8, off + 8 + len));
    off += 12 + len;
    if (type === "IEND") break;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y += 1) {
    const f = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? px[dst + x - bpp] : 0;
      const up = y > 0 ? px[dst - stride + x] : 0;
      const ul = y > 0 && x >= bpp ? px[dst - stride + x - bpp] : 0;
      const v = raw[src + x];
      let r;
      switch (f) {
        case 0: r = v; break;
        case 1: r = v + left; break;
        case 2: r = v + up; break;
        case 3: r = v + ((left + up) >> 1); break;
        case 4: r = v + paeth(left, up, ul); break;
        default: throw new Error(`filtro ${f}`);
      }
      px[dst + x] = r & 0xff;
    }
  }
  return { w, h, px };
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i += 1) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(CRC(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encode(px, w, h) {
  const stride = w * 4;
  // Filtro "up" (2) su ogni riga tranne la prima: su un campo a tinta unita
  // azzera quasi tutto e comprime molto meglio del filtro 0.
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y += 1) {
    const dst = y * (stride + 1);
    raw[dst] = y === 0 ? 0 : 2;
    for (let x = 0; x < stride; x += 1) {
      const cur = px[y * stride + x];
      raw[dst + 1 + x] = y === 0 ? cur : (cur - px[(y - 1) * stride + x]) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- il lavoro ------------------------------------------------------------
const src = decode(path.join(ROOT, "assets/icon.png"));
if (src.w !== SIZE || src.h !== SIZE) throw new Error(`icon.png ${src.w}x${src.h}`);

/** Copertura del pixel (x,y) dentro la superellisse, da 0 a 1. */
function coverage(x, y) {
  let inside = 0;
  for (let sy = 0; sy < SS; sy += 1) {
    // Centro del sotto-campione, normalizzato in [-1, 1] sul lato.
    const v = ((y + (sy + 0.5) / SS) / SIZE) * 2 - 1;
    const av = Math.abs(v) ** N;
    if (av > 1) continue;
    for (let sx = 0; sx < SS; sx += 1) {
      const u = ((x + (sx + 0.5) / SS) / SIZE) * 2 - 1;
      if (Math.abs(u) ** N + av <= 1) inside += 1;
    }
  }
  return inside / (SS * SS);
}

const out = Buffer.alloc(SIZE * SIZE * 4);
let opachi = 0;
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const i = (y * SIZE + x) * 4;
    const c = coverage(x, y);
    out[i] = src.px[i]; out[i + 1] = src.px[i + 1]; out[i + 2] = src.px[i + 2];
    // L'arte v2 e' gia' opaca ovunque, ma se un giorno non lo fosse le due
    // trasparenze vanno moltiplicate, non sostituite.
    out[i + 3] = Math.round((src.px[i + 3] / 255) * c * 255);
    if (out[i + 3] === 255) opachi += 1;
  }
}

const png = encode(out, SIZE, SIZE);
for (const rel of ["assets/splash-icon.png", "assets/brand/icon-v2/splash-icon.png"]) {
  writeFileSync(path.join(ROOT, rel), png);
  console.log("scritto", rel, png.length, "byte");
}
const pct = ((opachi / (SIZE * SIZE)) * 100).toFixed(1);
console.log(`superellisse n=${N}: ${pct}% dei pixel pienamente opachi (il quadrato pieno sarebbe 100%)`);
