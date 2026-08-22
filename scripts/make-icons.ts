/**
 * Draws Piper's home-screen icons.
 *
 *   npx tsx scripts/make-icons.ts
 *
 * Written by hand rather than pulled from a design tool so the icons live in
 * the repository as code: the brand gradient is the one in globals.css, and
 * changing it here regenerates every size. PNG is encoded directly — zlib is
 * in Node, and a solid-colour icon needs nothing an image library would give.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const OUT = path.join(process.cwd(), "public");

/** The accent gradient from the stylesheet: purple into pink. */
const FROM = [0x6d, 0x4a, 0xff];
const TO = [0xff, 0x7a, 0xc6];

/**
 * A capital P on a 12x16 grid, drawn as a bitmap because there is no font to
 * lean on and one letter does not justify one.
 */
const GLYPH = [
  "111111110000",
  "111111111000",
  "110000011100",
  "110000001100",
  "110000001100",
  "110000011100",
  "111111111000",
  "111111110000",
  "110000000000",
  "110000000000",
  "110000000000",
  "110000000000",
  "110000000000",
  "110000000000",
  "110000000000",
  "110000000000",
];

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size: number, rounded: boolean): Buffer {
  // One byte per channel, RGBA, with the mandatory filter byte per row.
  const row = size * 4 + 1;
  const raw = Buffer.alloc(row * size);

  const radius = rounded ? size * 0.22 : 0;
  const glyphW = Math.round(size * 0.42);
  const glyphH = Math.round((glyphW / GLYPH[0].length) * GLYPH.length);
  const glyphX = Math.round((size - glyphW) / 2);
  const glyphY = Math.round((size - glyphH) / 2);

  for (let y = 0; y < size; y++) {
    raw[y * row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const i = y * row + 1 + x * 4;

      // Gradient runs corner to corner, like the CSS 135deg.
      const t = (x + y) / (2 * (size - 1));
      raw[i] = Math.round(FROM[0] + (TO[0] - FROM[0]) * t);
      raw[i + 1] = Math.round(FROM[1] + (TO[1] - FROM[1]) * t);
      raw[i + 2] = Math.round(FROM[2] + (TO[2] - FROM[2]) * t);
      raw[i + 3] = 255;

      // A rounded square for the maskable-free icon; Android masks its own.
      if (rounded) {
        const cx = Math.min(x, size - 1 - x);
        const cy = Math.min(y, size - 1 - y);
        if (cx < radius && cy < radius) {
          const dx = radius - cx;
          const dy = radius - cy;
          if (Math.hypot(dx, dy) > radius) raw[i + 3] = 0;
        }
      }

      // The letter, in white.
      const gx = Math.floor(((x - glyphX) / glyphW) * GLYPH[0].length);
      const gy = Math.floor(((y - glyphY) / glyphH) * GLYPH.length);
      if (gy >= 0 && gy < GLYPH.length && gx >= 0 && gx < GLYPH[0].length) {
        if (GLYPH[gy][gx] === "1") {
          raw[i] = 255;
          raw[i + 1] = 255;
          raw[i + 2] = 255;
        }
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT, { recursive: true });

// 192 and 512 for Android, 180 for Apple's home screen. Apple ignores
// transparency and composites on black, so its icon is square.
const icons: [string, number, boolean][] = [
  ["icon-192.png", 192, true],
  ["icon-512.png", 512, true],
  ["icon-maskable-512.png", 512, false],
  ["apple-touch-icon.png", 180, false],
];

for (const [name, size, rounded] of icons) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, png(size, rounded));
  console.log(`${name}  ${size}x${size}  ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
}
