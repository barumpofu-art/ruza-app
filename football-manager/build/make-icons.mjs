// Renders the app icons from an inline SVG so no binary assets are hand-made.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(`${execSync('npm root -g').toString().trim()}/playwright`);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Padded so it still reads as a crest inside a maskable circle.
const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#0d1310"/>
  <g transform="translate(50 52) scale(1.08) translate(-50 -52)">
    <path d="M28 22h44v30c0 13.5-13.2 20.5-22 25.5C41.2 72.5 28 65.5 28 52z" fill="#f2c14e" stroke="#0d1310" stroke-width="2.5"/>
    <path d="M28 22h44v9H28z" fill="#2f9e6b"/>
    <circle cx="50" cy="50" r="11" fill="#0d1310"/>
    <path d="M50 42l6.5 4.7-2.5 7.6h-8l-2.5-7.6z" fill="#f2c14e"/>
  </g>
</svg>`;

// PWA icons at the root, launcher icons for the Android wrapper.
const targets = [
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
  [48, 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png'],
  [72, 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png'],
  [96, 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png'],
  [144, 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png'],
  [192, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'],
];

const browser = await chromium.launch();
for (const [size, out] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg(size)}</body>`);
  await page.screenshot({ path: join(root, out) });
  await page.close();
  console.log(out);
}
await browser.close();
