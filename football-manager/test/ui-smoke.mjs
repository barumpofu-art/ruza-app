// Drives the real app in Chromium: start a career, play a match, visit every
// screen, sign a player, and fail on any console error.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

// Playwright is installed globally in this environment, not in the project.
const require = createRequire(import.meta.url);
const globalRoot = execSync('npm root -g').toString().trim();
const { chromium } = require(`${globalRoot}/playwright`);
import fs from 'node:fs';

const OUT = process.env.SHOT_DIR ?? '/tmp/kalahari-shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const step = async (label, fn) => { await fn(); console.log('✓', label); };

await page.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'networkidle' });

await step('start screen', async () => {
  await page.waitForSelector('.clubpick');
  await shot('01-start');
  await page.fill('#mgr', 'B. Rumpofu');
  await page.click('[data-club="ser"]');
  await shot('02-club-picked');
  await page.click('[data-start]');
  await page.waitForSelector('.topbar-name');
});

await step('dashboard', async () => {
  const club = await page.textContent('.topbar-name');
  if (!club.includes('Serowe')) throw new Error(`wrong club: ${club}`);
  await shot('03-home');
});

await step('squad selection', async () => {
  await page.click('[data-action="tab:squad"]');
  await page.waitForSelector('.pitch .slot');
  const slots = await page.locator('.pitch .slot').count();
  if (slots !== 11) throw new Error(`expected 11 slots, got ${slots}`);
  // Swap two players and confirm the shirts change places.
  const before = await page.locator('.pitch .slot').nth(9).textContent();
  await page.locator('.pitch .slot').nth(9).click();
  await page.locator('.pitch .slot').nth(10).click();
  const after = await page.locator('.pitch .slot').nth(10).textContent();
  if (before !== after) throw new Error(`swap failed: ${before} -> ${after}`);
  await shot('04-squad-pitch');
  await page.click('[data-action="squad-view:list"]');
  await page.waitForSelector('.prow');
  await shot('05-squad-list');
  await page.locator('.prow').first().click();
  await page.waitForSelector('.sheet h2');
  await shot('06-player');
  await page.click('[data-sheet-close]');
});

await step('tactics', async () => {
  await page.click('[data-action="tab:tactics"]');
  await page.waitForSelector('[data-action="formation:4-3-3"]');
  await page.click('[data-action="formation:4-3-3"]');
  await page.click('[data-action="mentality:attacking"]');
  await page.click('[data-action="pressing:high"]');
  await shot('07-tactics');
});

await step('league', async () => {
  await page.click('[data-action="tab:league"]');
  await page.waitForSelector('table.grid');
  const rows = await page.locator('table.grid tbody tr').count();
  if (rows !== 12) throw new Error(`expected 12 clubs, got ${rows}`);
  await shot('08-table');
  await page.click('[data-action="league-tab:fixtures"]');
  await page.waitForSelector('.fixture');
  await shot('09-fixtures');
});

await step('office and transfers', async () => {
  await page.click('[data-action="tab:club"]');
  await page.waitForSelector('[data-action="market"]');
  await shot('10-office');
  await page.click('[data-action="market"]');
  await page.waitForSelector('.sheet .prow');
  await shot('11-market');
  const signable = page.locator('.sheet [data-action^="sign:"]:not([disabled])').first();
  if (await signable.count()) {
    await signable.click();
    await page.waitForTimeout(300);
  }
  await page.click('[data-sheet-close]');
});

await step('play a match', async () => {
  await page.click('[data-action="tab:home"]');
  await page.click('[data-action="play-match"]');
  await page.waitForSelector('.match .feed .ev');
  await page.waitForTimeout(1200);
  await shot('12-match-live');
  await page.click('[data-match="subs"]');
  await page.waitForSelector('.sheet [data-sub-out]');
  await page.locator('.sheet [data-sub-out]').nth(6).click();
  const benchOption = page.locator('.sheet [data-sub-in]').first();
  if (await benchOption.count()) await benchOption.click();
  await page.waitForTimeout(300);
  await shot('13-match-subs');
  if (await page.locator('#overlay:not([hidden])').count()) await page.click('[data-sheet-close]');
  await page.click('[data-match="skip"]').catch(() => {});
  await page.waitForSelector('[data-match="continue"]', { timeout: 15000 });
  await shot('14-fulltime');
  const score = await page.textContent('[data-goals]');
  console.log('   result:', score);
  await page.click('[data-match="continue"]');
  await page.waitForSelector('.topbar-name');
  await shot('15-after-match');
});

await step('season progresses', async () => {
  for (let i = 0; i < 6; i++) {
    await page.click('[data-action="quick-match"]');
    await page.waitForTimeout(120);
  }
  await page.click('[data-action="tab:league"]');
  await page.click('[data-action="league-tab:table"]');
  await page.waitForSelector('table.grid');
  await shot('16-table-later');
  const played = await page.locator('table.grid tbody tr td:nth-child(3)').first().textContent();
  if (Number(played) < 7) throw new Error(`expected 7+ matches played, saw ${played}`);
});

await step('save survives a reload', async () => {
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.topbar-name');
  const sub = await page.textContent('.topbar-sub');
  if (!/MD 8\/22/.test(sub)) throw new Error(`save did not restore matchday: ${sub}`);
  await shot('17-reloaded');
});

await browser.close();

if (errors.length) {
  console.error('\nconsole errors:');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log('\nUI smoke test passed. Screenshots in', OUT);
