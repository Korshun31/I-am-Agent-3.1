/**
 * Generate app icon from logo-confirmation.svg
 * Output: assets/icon.png (1024x1024)
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '../assets');
const svgPath = path.join(assetsDir, 'logo-confirmation.svg');
const outPath = path.join(assetsDir, 'icon.png');

const W = 1024;
const H = 1024;
const BG = '#F5F2EB';

// Original logo is 80x48. Scale to fit width 1024: scale = 1024/80 = 12.8
// Scaled height = 48 * 12.8 = 614. Center vertically: (1024 - 614) / 2 = 205
const scale = W / 80;
const scaledH = 48 * scale;
const offsetY = (H - scaledH) / 2;

const svgWrapper = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <g transform="translate(0, ${offsetY}) scale(${scale})">
    <rect x="2" y="8" width="12" height="32" rx="3" fill="#D87A5C" transform="rotate(-8 8 24)"/>
    <rect x="18" y="6" width="12" height="32" rx="3" fill="#E5B84A" transform="rotate(-4 24 22)"/>
    <rect x="34" y="4" width="12" height="32" rx="3" fill="#8BA882" transform="rotate(0 40 20)"/>
    <rect x="50" y="6" width="12" height="32" rx="3" fill="#5BA3A8" transform="rotate(4 56 22)"/>
    <rect x="66" y="8" width="12" height="32" rx="3" fill="#3D7D82" transform="rotate(8 72 24)"/>
  </g>
</svg>`;

const buffer = Buffer.from(svgWrapper);
const png = await sharp(buffer)
  .resize(W, H)
  .png()
  .toBuffer();

writeFileSync(outPath, png);
console.log('Created:', outPath, '(' + W + 'x' + H + ')');
