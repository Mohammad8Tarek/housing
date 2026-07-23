// gen-icons.mjs — Generate PNG icons for PWA from SVG
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "artifacts", "employee-portal", "public");

// Minimal PNG generator for a simple icon (golden circle on dark bg)
function createPNG(size) {
  // Create RGBA pixel data
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2, r = size * 0.4;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;

      // Background: dark
      pixels[i] = 13;     // R
      pixels[i + 1] = 15; // G
      pixels[i + 2] = 20; // B
      pixels[i + 3] = 255; // A

      // Circle: golden accent (#f0a500)
      if (dist <= r) {
        const edge = r * 0.85;
        if (dist <= edge) {
          pixels[i] = 240; pixels[i + 1] = 165; pixels[i + 2] = 0; pixels[i + 3] = 255;
        } else {
          // Anti-aliased edge
          const alpha = Math.max(0, Math.min(1, (r - dist) / (r - edge)));
          pixels[i] = Math.round(13 + (240 - 13) * alpha);
          pixels[i + 1] = Math.round(15 + (165 - 15) * alpha);
          pixels[i + 2] = Math.round(20 + (0 - 20) * alpha);
          pixels[i + 3] = 255;
        }
      }
    }
  }

  // Convert to raw rows (filter byte 0 at start of each row)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const compressed = deflateSync(raw);

  // PNG chunks
  function crc32(buf) {
    let c = 0xffffffff;
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let cc = n;
      for (let k = 0; k < 8; k++) cc = cc & 1 ? 0xedb88320 ^ (cc >>> 1) : cc >>> 1;
      table[n] = cc;
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type, "ascii");
    const crcData = Buffer.concat([typeB, data]);
    const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc32(crcData));
    return Buffer.concat([len, typeB, data, crcB]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);   // width
  ihdr.writeUInt32BE(size, 4);   // height
  ihdr[8] = 8;                    // bit depth
  ihdr[9] = 6;                    // color type: RGBA
  ihdr[10] = 0;                   // compression
  ihdr[11] = 0;                   // filter
  ihdr[12] = 0;                   // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);

  return png;
}

// Generate icons
for (const size of [192, 512]) {
  const png = createPNG(size);
  writeFileSync(resolve(OUT, `pwa-${size}x${size}.png`), png);
  console.log(`  ✓ pwa-${size}x${size}.png generated`);
}
