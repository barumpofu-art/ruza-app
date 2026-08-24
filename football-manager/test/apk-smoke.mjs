// Drives the game inside the real Android WebView, over devtools forwarded
// from the emulator by test/apk-smoke.sh. This is the only test that proves
// the packaged APK works: everything else runs in desktop Chromium.
import { chromium } from 'playwright-core';

const shot = (name) => `apk-${name}.png`;
const errors = [];

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];

let page = context.pages()[0];
for (let i = 0; !page && i < 20; i++) {
  await new Promise((r) => setTimeout(r, 500));
  page = context.pages()[0];
}
if (!page) throw new Error('devtools exposed no page');

page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

console.log('url:', page.url());
if (!page.url().includes('appassets.androidplatform.net')) {
  throw new Error(`the WebView is not on the app's asset origin: ${page.url()}`);
}

await page.waitForSelector('.clubpick', { timeout: 30000 });
const clubs = await page.locator('.clubopt').count();
console.log('clubs offered:', clubs);
if (clubs !== 12) throw new Error(`expected 12 clubs on the start screen, saw ${clubs}`);
await page.screenshot({ path: shot('start') });

await page.click('[data-club="gab"]');
await page.click('[data-start]');
await page.waitForSelector('.topbar-name', { timeout: 20000 });
const club = await page.textContent('.topbar-name');
console.log('club:', club);
if (!club.includes('Gaborone')) throw new Error(`wrong club: ${club}`);

// The pitch must have real height: an old WebView without aspect-ratio would
// collapse it, and the selection screen would be unusable.
await page.click('[data-action="tab:squad"]');
await page.waitForSelector('.pitch .slot');
const pitch = await page.locator('.pitch').boundingBox();
console.log('pitch box:', pitch);
if (!pitch || pitch.height < 200) throw new Error(`the pitch did not lay out: ${JSON.stringify(pitch)}`);
await page.screenshot({ path: shot('squad') });

// Play one properly, through the live match view.
await page.click('[data-action="tab:home"]');
await page.click('[data-action="play-match"]');
await page.waitForSelector('.match .feed .ev', { timeout: 20000 });
await page.click('[data-match="skip"]');
await page.waitForSelector('[data-match="continue"]', { timeout: 60000 });
console.log('full time:', await page.textContent('[data-goals]'));
await page.screenshot({ path: shot('fulltime') });
await page.click('[data-match="continue"]');
await page.waitForSelector('.topbar-name');

// The save has to survive, which is the whole reason assets are served from an
// https origin rather than file://.
const before = await page.textContent('.topbar-sub');
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.topbar-name', { timeout: 20000 });
const after = await page.textContent('.topbar-sub');
console.log('before reload:', before, '| after:', after);
if (before !== after) throw new Error('the save did not survive a reload inside the WebView');
await page.screenshot({ path: shot('after-reload') });

await browser.close();

if (errors.length) {
  console.error('errors from the page:');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log('\nAPK smoke test passed inside the emulator');
