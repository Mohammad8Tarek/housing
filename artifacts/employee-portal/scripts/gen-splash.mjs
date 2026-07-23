import sharp from "sharp";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const svgBuffer = readFileSync(join(import.meta.dirname, "../public/favicon.svg"));
const RES_DIR = join(import.meta.dirname, "../android/app/src/main/res");

const splashScreens = {
  "drawable": { w: 320, h: 480 },
  "drawable-port-mdpi": { w: 320, h: 480 },
  "drawable-port-hdpi": { w: 480, h: 720 },
  "drawable-port-xhdpi": { w: 640, h: 960 },
  "drawable-port-xxhdpi": { w: 960, h: 1440 },
  "drawable-port-xxxhdpi": { w: 1280, h: 1920 },
  "drawable-land-mdpi": { w: 480, h: 320 },
  "drawable-land-hdpi": { w: 720, h: 480 },
  "drawable-land-xhdpi": { w: 960, h: 640 },
  "drawable-land-xxhdpi": { w: 1440, h: 960 },
  "drawable-land-xxxhdpi": { w: 1920, h: 1280 },
};

async function generate() {
  for (const [dir, { w, h }] of Object.entries(splashScreens)) {
    const outDir = join(RES_DIR, dir);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const logoSize = Math.round(Math.min(w, h) * 0.35);
    const logoBuffer = await sharp(svgBuffer)
      .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Create white background with centered logo
    await sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{
        input: logoBuffer,
        gravity: "center",
      }])
      .png()
      .toFile(join(outDir, "splash.png"));

    console.log(`  ${dir}: ${w}x${h}`);
  }
  console.log("Done! Splash screens generated.");
}

generate().catch(console.error);
