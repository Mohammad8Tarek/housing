import sharp from "sharp";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const svgBuffer = readFileSync(join(import.meta.dirname, "../public/favicon.svg"));
const RES_DIR = join(import.meta.dirname, "../android/app/src/main/res");

const sizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

// Also generate foreground for adaptive icon (larger, padded)
const foregroundSizes = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432,
};

async function generate() {
  for (const [dir, size] of Object.entries(sizes)) {
    const outDir = join(RES_DIR, dir);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const fgSize = foregroundSizes[dir];

    // Generate launcher icon (with white background + padding for round)
    await sharp(svgBuffer)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(join(outDir, "ic_launcher.png"));

    await sharp(svgBuffer)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(join(outDir, "ic_launcher_round.png"));

    // Generate foreground (larger, for adaptive icon)
    const innerSize = Math.round(fgSize * 0.65);
    const padded = await sharp({ create: { width: fgSize, height: fgSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{
        input: await sharp(svgBuffer).resize(innerSize, innerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
        gravity: "center",
      }])
      .png()
      .toFile(join(outDir, "ic_launcher_foreground.png"));

    console.log(`  ${dir}: ${size}x${size} (fg: ${fgSize}x${fgSize})`);
  }
  console.log("Done! Blue Sunrise icons generated.");
}

generate().catch(console.error);
