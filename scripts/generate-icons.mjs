import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Icon sizes for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create a simple SVG icon
function createSvgIcon(size) {
  const padding = Math.round(size * 0.15);
  const innerSize = size - padding * 2;
  const cornerRadius = Math.round(size * 0.15);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#grad)"/>
  <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${Math.round(size * 0.4)}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">G</text>
</svg>`;
}

// Generate icons
for (const size of sizes) {
  const svgContent = createSvgIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  const filepath = path.join(iconsDir, filename);

  fs.writeFileSync(filepath, svgContent);
  console.log(`Created: ${filename}`);
}

// Also create a PNG placeholder message
console.log(`
Note: SVG icons have been created as placeholders.
For production, you should convert these to PNG using:
- https://cloudconvert.com/svg-to-png
- Or use sharp/jimp in Node.js

The manifest.json references PNG files, so you'll need to either:
1. Convert the SVGs to PNGs
2. Update manifest.json to use SVGs (limited browser support)
`);

// Create a simple favicon.ico placeholder info
console.log('Remember to also add a favicon.ico to the public folder.');
