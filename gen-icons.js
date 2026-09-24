// Generates the PWA icons for Game Boy Fishing with no external dependencies.
// Draws directly into an RGBA pixel buffer and encodes a valid PNG using only
// Node's built-in zlib. Produces:
//   icons/icon-192.png, icons/icon-512.png  (normal, transparent bg)
//   icons/icon-maskable-512.png             (full-bleed bg for Android masks)
//   icons/apple-touch-icon.png (180)        (iOS home screen)
//   favicon.png (64)
//
// Run: node tools/gen-icons.js
"use strict";
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ---- tiny PNG encoder (truecolor + alpha, 8-bit) ----
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // add filter byte (0) per row
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- simple pixel drawing on an RGBA buffer ----
function makeCanvas(size) {
  const buf = Buffer.alloc(size * size * 4, 0); // transparent
  const px = (x, y, r, g, b, a = 255) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    // simple alpha over
    const ia = a / 255, na = 1 - ia;
    buf[i]     = Math.round(r * ia + buf[i] * na);
    buf[i + 1] = Math.round(g * ia + buf[i + 1] * na);
    buf[i + 2] = Math.round(b * ia + buf[i + 2] * na);
    buf[i + 3] = Math.max(buf[i + 3], a);
  };
  const rect = (x, y, w, h, c) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(xx, yy, c[0], c[1], c[2], c[3] ?? 255);
  };
  const roundRect = (x, y, w, h, rad, c) => {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      let inside = true;
      // clip the four corners
      const corners = [[rad, rad], [w - rad, rad], [rad, h - rad], [w - rad, h - rad]];
      if (xx < rad && yy < rad) inside = (xx - rad) ** 2 + (yy - rad) ** 2 <= rad * rad;
      else if (xx > w - rad && yy < rad) inside = (xx - (w - rad)) ** 2 + (yy - rad) ** 2 <= rad * rad;
      else if (xx < rad && yy > h - rad) inside = (xx - rad) ** 2 + (yy - (h - rad)) ** 2 <= rad * rad;
      else if (xx > w - rad && yy > h - rad) inside = (xx - (w - rad)) ** 2 + (yy - (h - rad)) ** 2 <= rad * rad;
      if (inside) px(x + xx, y + yy, c[0], c[1], c[2], c[3] ?? 255);
    }
  };
  const ellipse = (cx, cy, rx, ry, c) => {
    for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) {
      if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) <= 1) px(cx + xx, cy + yy, c[0], c[1], c[2], c[3] ?? 255);
    }
  };
  const line = (x0, y0, x1, y1, c, thick = 1) => {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    for (;;) {
      for (let t = 0; t < thick; t++) for (let u = 0; u < thick; u++) px(x + t, y + u, c[0], c[1], c[2], c[3] ?? 255);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  };
  return { buf, size, px, rect, roundRect, ellipse, line };
}

// ---- draw the icon artwork ----
function drawIcon(size, { maskable = false } = {}) {
  const c = makeCanvas(size);
  const s = size / 512; // scale factor from a 512 design grid
  const S = n => Math.round(n * s);

  // background
  if (maskable) {
    // full-bleed lilac gradient-ish (flat) so Android masks never clip content
    c.rect(0, 0, size, size, [0xc3, 0xb3, 0xd9, 255]);
  }

  // Game Boy device body (rounded lilac) — inset a bit for non-maskable
  const inset = maskable ? S(70) : S(28);
  c.roundRect(inset, inset, size - inset * 2, size - inset * 2, S(60), [0xd7, 0xc9, 0xe8, 255]);
  c.roundRect(inset + S(8), inset + S(8), size - inset * 2 - S(16), size - inset * 2 - S(16), S(52), [0xc9, 0xba, 0xe0, 255]);

  // Screen bezel (dark) in the upper portion
  const bx = inset + S(40), by = inset + S(48), bw = size - inset * 2 - S(80), bh = S(230);
  c.roundRect(bx, by, bw, bh, S(24), [0x4a, 0x3f, 0x5e, 255]);
  // Green LCD
  const gx = bx + S(20), gy = by + S(24), gw = bw - S(40), gh = bh - S(48);
  c.rect(gx, gy, gw, gh, [0x9b, 0xbc, 0x0f, 255]);       // classic GB green
  c.rect(gx, gy, gw, Math.round(gh * 0.55), [0x8b, 0xac, 0x0f, 255]); // sky/water band

  // water line
  const waterY = gy + Math.round(gh * 0.5);
  c.rect(gx, waterY, gw, gh - (waterY - gy), [0x30, 0x62, 0x30, 255]);

  // a fish
  const fx = gx + Math.round(gw * 0.5), fy = waterY + Math.round((gh - (waterY - gy)) * 0.45);
  c.ellipse(fx, fy, S(46), S(26), [0x0f, 0x38, 0x0f, 255]);
  // tail
  c.line(fx + S(40), fy, fx + S(70), fy - S(26), [0x0f, 0x38, 0x0f, 255], S(6));
  c.line(fx + S(40), fy, fx + S(70), fy + S(26), [0x0f, 0x38, 0x0f, 255], S(6));
  c.rect(fx + S(64), fy - S(26), S(8), S(52), [0x0f, 0x38, 0x0f, 255]);
  // eye
  c.ellipse(fx - S(24), fy - S(6), S(5), S(5), [0x9b, 0xbc, 0x0f, 255]);

  // fishing line + hook from top-right into the water
  c.line(gx + Math.round(gw * 0.78), gy + S(6), fx + S(2), fy - S(30), [0x0f, 0x38, 0x0f, 255], S(3));

  // D-pad (dark) bottom-left
  const dcx = inset + S(120), dcy = size - inset - S(140);
  c.rect(dcx - S(14), dcy - S(46), S(28), S(92), [0x2c, 0x2c, 0x3a, 255]);
  c.rect(dcx - S(46), dcy - S(14), S(92), S(28), [0x2c, 0x2c, 0x3a, 255]);

  // A/B buttons (magenta) bottom-right
  const bcx = size - inset - S(120), bcy = size - inset - S(150);
  c.ellipse(bcx, bcy, S(34), S(34), [0x9b, 0x2c, 0x6f, 255]);
  c.ellipse(bcx - S(80), bcy + S(40), S(34), S(34), [0x9b, 0x2c, 0x6f, 255]);

  return encodePNG(size, size, c.buf);
}

// ---- write files ----
const outDir = path.resolve(__dirname, "..");
const iconsDir = path.join(outDir, "icons");
fs.mkdirSync(iconsDir, { recursive: true });

const jobs = [
  ["icons/icon-192.png", 192, {}],
  ["icons/icon-512.png", 512, {}],
  ["icons/icon-maskable-512.png", 512, { maskable: true }],
  ["icons/apple-touch-icon.png", 180, { maskable: true }],
  ["favicon.png", 64, {}],
];
for (const [rel, size, opts] of jobs) {
  const png = drawIcon(size, opts);
  fs.writeFileSync(path.join(outDir, rel), png);
  console.log("wrote", rel, "(" + size + "x" + size + ", " + png.length + " bytes)");
}
console.log("Done.");
