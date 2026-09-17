import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// Small, original clock mark. PNG encoder keeps icon generation dependency-free.
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function png(size, template = false, tray = false) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cover = (d) => Math.max(0, Math.min(1, 0.5 - d * size));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size - 0.5,
        v = (y + 0.5) / size - 0.5;
      const qx = Math.abs(u) - 0.31,
        qy = Math.abs(v) - 0.31;
      const rounded =
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 0.15;
      const circle = Math.abs(Math.hypot(u, v) - 0.285) - 0.035;
      const hand1 =
        Math.hypot(u, v + 0.075) < 0.025 || (Math.abs(u) < 0.02 && v < 0.025 && v > -0.16);
      const hand2 = Math.abs(v - u * 0.65) < 0.022 && u >= -0.01 && u <= 0.135;
      const ring = Math.max(cover(circle), hand1 || hand2 ? 1 : 0);
      const bg = template || tray ? 0 : cover(rounded),
        a = Math.max(bg, ring);
      const foreground = template ? [0, 0, 0] : [255, 104, 110];
      const background = [17, 18, 22];
      const i = y * (size * 4 + 1) + 1 + x * 4;
      for (let k = 0; k < 3; k++)
        raw[i + k] = Math.round(
          a ? (foreground[k] * ring + background[k] * bg * (1 - ring)) / a : 0,
        );
      raw[i + 3] = Math.round(a * 255);
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
mkdirSync('assets', { recursive: true });
writeFileSync('assets/icon.png', png(512));
writeFileSync('assets/tray.png', png(32, false, true));
writeFileSync('assets/trayTemplate.png', png(32, true));
const icon = png(256),
  header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(icon.length, 14);
header.writeUInt32LE(22, 18);
writeFileSync('assets/icon.ico', Buffer.concat([header, icon]));
