// Checks the single-file build the way a phone would use it: opened straight
// from the filesystem, no server, with progress surviving a reload.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(`${execSync('npm root -g').toString().trim()}/playwright`);
const file = `file://${join(dirname(fileURLToPath(import.meta.url)), '..', 'kalahari-manager.html')}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(file);
await page.waitForSelector('.clubpick');
await page.click('[data-club="mau"]');
await page.click('[data-start]');
await page.waitForSelector('.topbar-name');

await page.click('[data-action="quick-match"]');
await page.click('[data-action="quick-match"]');
await page.waitForTimeout(200);

const before = await page.textContent('.topbar-sub');
await page.reload();
await page.waitForSelector('.topbar-name');
const after = await page.textContent('.topbar-sub');
const club = await page.textContent('.topbar-name');

console.log('before reload:', before);
console.log('after reload: ', after, '|', club);
if (before !== after) throw new Error('save did not survive a reload from file://');
if (!club.includes('Maun')) throw new Error('wrong club restored');

// The match view must work here too — it is the whole point of the game.
await page.click('[data-action="play-match"]');
await page.waitForSelector('.match .feed .ev');
await page.click('[data-match="skip"]');
await page.waitForSelector('[data-match="continue"]', { timeout: 20000 });
console.log('match played offline:', await page.textContent('[data-goals]'));
await page.click('[data-match="continue"]');
await page.waitForSelector('.topbar-name');

await browser.close();
if (errors.length) {
  console.error('console errors:', errors);
  process.exit(1);
}
console.log('\noffline single-file build works from file://');
