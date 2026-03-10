/**
 * Trim icon edges - remove transparent/empty padding to match icon-sum style.
 * Run: node scripts/trim-icon-edges.mjs
 */
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '../assets');

const ICONS = [
  { in: 'icon-property-house.png', out: 'icon-property-house-stats.png' },
  { in: 'icon-property-resort.png', out: 'icon-property-resort-stats.png' },
  { in: 'icon-property-condo.png', out: 'icon-property-condo-stats.png' },
];

const ALPHA_THRESHOLD = 30;
const PAD = 1;

async function trimIcon(inputPath, outputPath) {
  const img = sharp(inputPath);
  const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const alpha = data[i + 3];
      if (alpha > ALPHA_THRESHOLD) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const left = Math.max(0, minX - PAD);
  const top = Math.max(0, minY - PAD);
  const cropW = Math.min(width - left, maxX - minX + 1 + PAD * 2);
  const cropH = Math.min(height - top, maxY - minY + 1 + PAD * 2);

  const cropped = await sharp(inputPath)
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();

  writeFileSync(outputPath, cropped);
}

for (const { in: name, out: outName } of ICONS) {
  await trimIcon(path.join(ASSETS, name), path.join(ASSETS, outName));
  console.log('Created:', outName);
}
