// Rigenera assets/adaptive-icon.png: l'arte di icon.png rimpicciolita nella
// zona sicura dell'adaptive icon Android (il 66,7% centrale = 72dp su 108dp)
// su un campo pieno #F8D2C4, lo stesso colore di android.adaptiveIcon.backgroundColor.
// Nessuna dipendenza: decoder/encoder PNG a mano (RGBA 8 bit, non interlacciato).
const { readFileSync, writeFileSync } = require("node:fs");
const { inflateSync, deflateSync } = require("node:zlib");
const path = require("node:path");

// Uso: node assets/brand/icon-v2/adaptive-inset.source.cjs   (dalla root del repo)
// Sorgente: assets/icon.png (l'arte v2 a tutto campo, 1024x1024 RGBA).
// Uscita:   assets/adaptive-icon.png + assets/brand/icon-v2/adaptive-icon.png.
// Verificato da lib/native-config.test.ts ("il foreground adattivo sta tutto
// nella zona sicura"). Niente sharp: il file gira con il solo Node.
const ROOT = process.argv[2] ?? path.join(__dirname, "..", "..", "..");
const SIZE = 1024;
// Zona sicura dell'adaptive icon: il sistema mostra solo i 72dp centrali dei
// 108dp del foreground, cioe' il 66,7%. Su 1024 px sono 171..853; ci si sta
// dentro con 682 px a partire da 171 (ultimo pixel 852).
const BG = [0xf8, 0xd2, 0xc4, 0xff]; // = android.adaptiveIcon.backgroundColor

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

/** Downscale per media d'area (box filter): la scelta giusta per rimpicciolire. */
function boxResize(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    const y0 = (y * sh) / dh, y1 = ((y + 1) * sh) / dh;
    for (let x = 0; x < dw; x += 1) {
      const x0 = (x * sw) / dw, x1 = ((x + 1) * sw) / dw;
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy += 1) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        if (wy <= 0) continue;
        for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx += 1) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          if (wx <= 0) continue;
          const w = wx * wy;
          const i = (sy * sw + sx) * 4;
          const al = src[i + 3] / 255;
          // Premoltiplicato: senza, i bordi trasparenti sporcherebbero il colore.
          r += src[i] * al * w; g += src[i + 1] * al * w; b += src[i + 2] * al * w;
          a += src[i + 3] * w; wsum += w;
        }
      }
      const o = (y * dw + x) * 4;
      const alpha = a / wsum;
      const un = alpha > 0 ? 255 / alpha : 0;
      out[o] = Math.min(255, Math.round((r / wsum) * un));
      out[o + 1] = Math.min(255, Math.round((g / wsum) * un));
      out[o + 2] = Math.min(255, Math.round((b / wsum) * un));
      out[o + 3] = Math.round(alpha);
    }
  }
  return out;
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

// Zona sicura: 171..853 su 1024 (bordi inclusi) = 683 px. Si sta DENTRO,
// quindi 682 con offset 171: l'ultimo pixel cade a 852.
const inner = 682;
const off = 171;
const art = boxResize(src.px, SIZE, SIZE, inner, inner);

const out = Buffer.alloc(SIZE * SIZE * 4);
for (let i = 0; i < out.length; i += 4) {
  out[i] = BG[0]; out[i + 1] = BG[1]; out[i + 2] = BG[2]; out[i + 3] = BG[3];
}
for (let y = 0; y < inner; y += 1) {
  for (let x = 0; x < inner; x += 1) {
    const s = (y * inner + x) * 4;
    const d = ((y + off) * SIZE + (x + off)) * 4;
    const a = art[s + 3] / 255;
    if (a <= 0) continue;
    out[d] = Math.round(art[s] * a + out[d] * (1 - a));
    out[d + 1] = Math.round(art[s + 1] * a + out[d + 1] * (1 - a));
    out[d + 2] = Math.round(art[s + 2] * a + out[d + 2] * (1 - a));
    out[d + 3] = 255;
  }
}

const png = encode(out, SIZE, SIZE);
for (const rel of ["assets/adaptive-icon.png", "assets/brand/icon-v2/adaptive-icon.png"]) {
  writeFileSync(path.join(ROOT, rel), png);
  console.log("scritto", rel, png.length, "byte");
}
console.log(`INNER=${inner} OFFSET=${off} (contenuto in ${off}..${off + inner - 1})`);
