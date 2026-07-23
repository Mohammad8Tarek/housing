/**
 * Generate Android mipmap icons from the existing pwa-512x512.png
 * Uses Canvas API (node-canvas or sharp) or falls back to simple resize
 */
import { execSync } from "child_process";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";

const RES_DIR = join(import.meta.dirname, "../android/app/src/main/res");
const SRC_PNG = join(import.meta.dirname, "../public/pwa-512x512.png");

const sizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

if (!existsSync(SRC_PNG)) {
  console.error("Source PNG not found:", SRC_PNG);
  process.exit(1);
}

// Check if magick/imagemagick is available
let hasMagick = false;
try {
  execSync("magick --version", { stdio: "ignore" });
  hasMagick = true;
} catch {
  try {
    execSync("convert --version", { stdio: "ignore" });
    hasMagick = true;
  } catch {
    // No ImageMagick
  }
}

if (hasMagick) {
  console.log("Using ImageMagick to resize icons...");
  for (const [dir, size] of Object.entries(sizes)) {
    const outDir = join(RES_DIR, dir);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    for (const name of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) {
      const outFile = join(outDir, name);
      try {
        execSync(`magick "${SRC_PNG}" -resize ${size}x${size} "${outFile}"`, { stdio: "ignore" });
        console.log(`  Created ${dir}/${name} (${size}x${size})`);
      } catch (e) {
        console.error(`  Failed: ${dir}/${name}`, e.message);
      }
    }
  }
  console.log("Done!");
} else {
  // No ImageMagick — just copy the source PNG to all directories
  // This won't be correctly sized but is better than default Android icons
  console.log("ImageMagick not found. Copying source PNG as-is to all mipmap directories.");
  console.log("For best results, install ImageMagick: https://imagemagick.org/");
  for (const [dir] of Object.entries(sizes)) {
    const outDir = join(RES_DIR, dir);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    for (const name of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) {
      copyFileSync(SRC_PNG, join(outDir, name));
    }
    console.log(`  Copied to ${dir}/`);
  }
  console.log("Done! (icons may be oversized)");
}
