/**
 * Process icon-sum.png: make black transparent, trim edges
 * Run: npm install sharp --save-dev && node scripts/process-sum-icon.mjs
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(__dirname, '../assets/icon-sum.png');
const outputPath = path.join(__dirname, '../assets/icon-sum-processed.png');

const img = sharp(inputPath);
const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const THRESHOLD = 40;

for (let i = 0; i < data.length; i += channels) {
  const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
  if (r < THRESHOLD && g < THRESHOLD && b < THRESHOLD) {
    data[i + 3] = 0;
  }
}

let minX = width, minY = height, maxX = 0, maxY = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    if (data[i + 3] > 0) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
}

const pad = 1;
const left = Math.max(0, minX - pad);
const top = Math.max(0, minY - pad);
const cropW = Math.min(width - left, maxX - minX + 1 + pad * 2);
const cropH = Math.min(height - top, maxY - minY + 1 + pad * 2);

const cropped = await sharp(Buffer.from(data), { raw: { width, height, channels } })
  .extract({ left, top, width: cropW, height: cropH })
  .png()
  .toBuffer();

writeFileSync(outputPath, cropped);
console.log('Saved:', outputPath);
