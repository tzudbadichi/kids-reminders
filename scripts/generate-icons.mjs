// Generates the PWA icons (purple gradient + friendly smiley) into src/.
// Pure Node (zlib only) PNG encoder - no external image libraries needed.
// Run: node scripts/generate-icons.mjs

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

// ---- minimal PNG encoder (8-bit RGBA) ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // bit depth 8, color type 6 (RGBA)
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- draw the icon, supersampled 4x for smooth edges ----
const lerp = (a, b, t) => a + (b - a) * t;
function render(size, contentScale) {
  const SS = 4, W = size * SS;
  const big = Buffer.alloc(W * W * 4);
  const cx = W / 2, cy = W / 2;
  const faceR = 0.30 * W * (contentScale / 0.92);
  const eyeDX = 0.40 * faceR, eyeDY = 0.20 * faceR, eyeR = 0.12 * faceR;
  const mouthCY = cy - 0.06 * faceR, mouthR = 0.56 * faceR, mouthTh = 0.13 * faceR;
  const purpleR = 0x55, purpleG = 0x46, purpleB = 0xd6; // eyes/mouth on the white face

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const t = (x + y) / (2 * W);
      let r = lerp(0x6c, 0x8f, t), g = lerp(0x5c, 0x7b, t), b = lerp(0xe7, 0xff, t);
      if (Math.hypot(x - cx, y - cy) <= faceR) {
        r = 255; g = 255; b = 255; // white face
        const leftEye = Math.hypot(x - (cx - eyeDX), y - (cy - eyeDY)) <= eyeR;
        const rightEye = Math.hypot(x - (cx + eyeDX), y - (cy - eyeDY)) <= eyeR;
        const d = Math.hypot(x - cx, y - mouthCY);
        const mouth = Math.abs(d - mouthR) <= mouthTh / 2 && y > mouthCY + 0.04 * faceR;
        if (leftEye || rightEye || mouth) { r = purpleR; g = purpleG; b = purpleB; }
      }
      const i = (y * W + x) * 4;
      big[i] = r; big[i + 1] = g; big[i + 2] = b; big[i + 3] = 255;
    }
  }

  // downsample SSxSS -> size
  const out = Buffer.alloc(size * size * 4);
  const n = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let R = 0, G = 0, B = 0, A = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * W + (x * SS + dx)) * 4;
          R += big[i]; G += big[i + 1]; B += big[i + 2]; A += big[i + 3];
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(R / n); out[o + 1] = Math.round(G / n);
      out[o + 2] = Math.round(B / n); out[o + 3] = Math.round(A / n);
    }
  }
  return out;
}

function write(name, size, contentScale) {
  writeFileSync(join(SRC, name), encodePNG(size, render(size, contentScale)));
  console.log("wrote", name);
}

write("icon-192.png", 192, 0.92);
write("icon-512.png", 512, 0.92);
write("icon-maskable-512.png", 512, 0.66); // content inside the maskable safe zone
write("apple-touch-icon.png", 180, 0.86);
