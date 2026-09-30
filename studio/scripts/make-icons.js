// Generates placeholder icons (512 PNG -> .ico and .icns) with no dependencies. Replace the files in build/ with the final icons once they exist.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'build');

function crc32(buf) {
  let c, crc = ~0;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const r = size * 0.22;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const dx = Math.max(r - x, 0, x - (size - 1 - r)), dy = Math.max(r - y, 0, y - (size - 1 - r));
      const inside = dx * dx + dy * dy <= r * r;
      const t = (x + y) / (2 * size);
      // Indigo -> violet gradient, with a bright dot in the middle as a simple marker.
      const cx = x - size / 2, cy = y - size / 2;
      const dot = cx * cx + cy * cy < (size * 0.18) ** 2;
      const [R, G, B] = dot ? [255, 255, 255] : [Math.round(79 + 70 * t), Math.round(70 + 30 * t), Math.round(229 - 20 * t)];
      raw[o] = R; raw[o + 1] = G; raw[o + 2] = B; raw[o + 3] = inside ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ICO with PNG entries (supported on Windows Vista+): 16..256.
const sizes = [16, 32, 48, 64, 128, 256];
const pngs = sizes.map(png);
const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const dir = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12); offset += pngs[i].length;
  return e;
});
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon.ico'), Buffer.concat([head, ...dir, ...pngs]));

// ICNS: a single ic10 entry (PNG 512@2x/1024 is unnecessary for a placeholder).
const p512 = png(512);
const ent = Buffer.concat([Buffer.from('ic09'), Buffer.from([0, 0, 0, 0]), p512]);
ent.writeUInt32BE(p512.length + 8, 4);
const icnsHead = Buffer.from('icns\0\0\0\0', 'latin1'); icnsHead.writeUInt32BE(8 + ent.length, 4);
fs.writeFileSync(path.join(out, 'icon.icns'), Buffer.concat([icnsHead, ent]));
fs.writeFileSync(path.join(out, 'icon.png'), p512);
console.log('icons written to', out);
