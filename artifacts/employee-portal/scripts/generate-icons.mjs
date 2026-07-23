import { createCanvas } from 'canvas';
import fs from 'fs';

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#f0a500');
  gradient.addColorStop(1, '#e05c2a');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.25);
  ctx.fill();

  // Draw house icon
  const scale = size / 192;
  const offset = size * 0.25;

  ctx.fillStyle = 'white';
  ctx.globalAlpha = 0.95;

  // Roof
  const roofPoints = [
    [offset, offset + 36 * scale],
    [size - offset, offset + 36 * scale],
    [size * 0.5, offset]
  ];

  ctx.beginPath();
  ctx.moveTo(roofPoints[2][0], roofPoints[2][1]);
  ctx.lineTo(roofPoints[1][0], roofPoints[1][1]);
  ctx.lineTo(roofPoints[0][0], roofPoints[0][1]);
  ctx.closePath();
  ctx.fill();

  // House body
  ctx.fillRect(offset, offset + 36 * scale, size - offset * 2, size - offset - 36 * scale);

  // Door
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#0d0f14';
  ctx.fillRect(size * 0.42, size * 0.58, size * 0.16, size * 0.24);

  // Door knob
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(size * 0.56, size * 0.7, 2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Window
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = 'white';
  ctx.fillRect(size * 0.25, size * 0.52, size * 0.12, size * 0.12);

  return canvas.toBuffer('image/png');
}

// Create icons
const sizes = [192, 512];
sizes.forEach(size => {
  const buffer = createIcon(size);
  fs.writeFileSync(`public/pwa-${size}x${size}.png`, buffer);
  console.log(`✓ Created pwa-${size}x${size}.png`);
});
