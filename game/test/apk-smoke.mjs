// Plays the game inside the real Android WebView, over the devtools socket
// forwarded from the emulator by test/apk-smoke.sh. This is the only test that
// covers the packaged APK; everything else runs in desktop Chromium.
//
// It speaks CDP directly rather than through Playwright: WebView implements
// only part of the protocol, and Playwright's connectOverCDP needs
// Browser.setDownloadBehavior, which WebView does not have.
//
// Rehearse it against desktop Chromium by serving game/ and running:
//   PAGE_ORIGIN=127.0.0.1 CDP_ENDPOINT=http://127.0.0.1:9222 node test/apk-smoke.mjs

import { writeFileSync } from 'node:fs';

const ENDPOINT = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const PKG_ORIGIN = process.env.PAGE_ORIGIN ?? 'appassets.androidplatform.net';

if (typeof WebSocket === 'undefined') {
  throw new Error('this test needs a Node with a global WebSocket (22+)');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findPage() {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const targets = await (await fetch(`${ENDPOINT}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page' && String(t.url).includes(PKG_ORIGIN));
      if (page?.webSocketDebuggerUrl) return page;
    } catch { /* the socket may not be up yet */ }
    await sleep(1000);
  }
  throw new Error('no page on the app origin was exposed by devtools');
}

const target = await findPage();
console.log('target:', target.title, '|', target.url);

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const pageProblems = [];
let nextId = 0;

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id != null) {
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    const d = message.params.exceptionDetails;
    pageProblems.push(d.exception?.description ?? d.text);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    pageProblems.push(message.params.args.map((a) => a.value ?? a.description).join(' '));
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', () => reject(new Error('could not open the devtools socket')), { once: true });
});

function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`${method} timed out`));
    }, 60000);
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) {
    throw new Error(`in the page: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
  }
  return result.result.value;
}

async function waitFor(expression, what, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  for (;;) {
    try {
      const value = await evaluate(expression);
      if (value) return value;
    } catch (err) {
      // A reload tears the execution context down mid-poll; keep trying.
      lastError = err;
    }
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${what}${lastError ? ` (last error: ${lastError.message})` : ''}`);
    }
    await sleep(400);
  }
}

const click = (selector) => evaluate(
  `(() => { const el = document.querySelector(${JSON.stringify(selector)});
     if (!el) throw new Error('nothing to click: ' + ${JSON.stringify(selector)});
     el.click(); return true; })()`);

const text = (selector) => evaluate(
  `((document.querySelector(${JSON.stringify(selector)}) || {}).textContent || '').trim()`);

const count = (selector) => evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);

async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`apk-${name}.png`, Buffer.from(data, 'base64'));
}

// Dismiss whatever sheet is showing — an outcome, an event, a rigging offer —
// and keep going until the screen is genuinely clear. A sheet left open
// swallows every later tap, so this must not give up early.
async function clearModal(settleMs = 500) {
  for (let round = 0; round < 8; round++) {
    await drainModals();
    await sleep(settleMs);
    const stillOpen = await evaluate("(() => { const m = document.getElementById('modal'); return m && !m.hidden; })()");
    if (!stillOpen) return;
  }
  throw new Error('a sheet is still open after repeated attempts to dismiss it');
}

async function drainModals() {
  for (let i = 0; i < 8; i++) {
    const open = await evaluate("(() => { const m = document.getElementById('modal'); return m && !m.hidden; })()");
    if (!open) return;
    const closed = await evaluate(
      `(() => { const b = document.querySelector('#modal-inner [data-close]')
          || document.querySelector('#modal-inner [data-i]')
          || document.querySelector('#modal-inner [data-r="0"]');
        if (!b) return false; b.click(); return true; })()`);
    if (!closed) throw new Error('a modal is open with nothing to dismiss it');
    await sleep(250);
  }
}

await send('Runtime.enable');
await send('Page.enable');

// 1. The shell really loaded the packaged assets over the app's https origin.
const href = await evaluate('location.href');
console.log('url:', href);
if (!href.includes(PKG_ORIGIN)) throw new Error(`the WebView is not on the app's asset origin: ${href}`);

// 2. The title screen. App data is cleared by apk-smoke.sh before launch, so
//    there must be no career to continue.
await waitFor("!!document.querySelector('[data-act=\"new-game\"]')", 'the title screen');
if (!(await evaluate("document.getElementById('btn-continue').hidden"))) {
  throw new Error('a career is already in progress — this test needs clean app data');
}

// A hidden modal scrim once covered the whole page and swallowed every tap.
// Prove the top button is genuinely the thing under its own centre.
const reachable = await evaluate(`(() => {
  const b = document.querySelector('[data-act="new-game"]');
  const r = b.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!hit && (hit === b || b.contains(hit));
})()`);
if (!reachable) throw new Error('something invisible is covering the title screen and eating taps');
await screenshot('title');

// 3. All ten countries are offered.
await click('[data-act="new-game"]');
await waitFor("!!document.querySelector('.ccard')", 'the country list');
const countries = await count('.ccard');
console.log('countries offered:', countries);
if (countries !== 10) throw new Error(`expected 10 countries, saw ${countries}`);
await screenshot('countries');

// 4. A career starts.
await click('[data-country="BW"]');
await waitFor("!!document.querySelector('#btn-begin')", 'character creation');
await evaluate(`(() => { const i = document.getElementById('in-name');
  i.value = 'Emulator Candidate';
  i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
await click('[data-b="teacher"]');
await click('#btn-begin');
await waitFor("!!document.querySelector('.hud-name')", 'the desk');
const who = await text('.hud-name');
const office = await text('.hud-office');
console.log('player:', who, '|', office);
if (!who.includes('Emulator Candidate')) throw new Error(`wrong name in the HUD: ${who}`);
if (!office.toLowerCase().includes('activist')) throw new Error(`expected to start as an activist, got: ${office}`);

// 5. There are actions to take, and taking one produces an outcome.
const actions = await count('#pane-desk .act');
console.log('actions available:', actions);
if (actions < 4) throw new Error(`too few actions on the desk: ${actions}`);
const feedBefore = await count('#pane-desk .paper');
await click('#pane-desk .act:not([disabled])');
await waitFor("(() => { const m = document.getElementById('modal'); return m && !m.hidden; })()", 'the outcome sheet');
await screenshot('action');
await clearModal();
const feedAfter = await count('#pane-desk .paper');
console.log('feed entries:', feedBefore, '->', feedAfter);
if (!(feedAfter > feedBefore)) throw new Error('taking an action did not add anything to the record');

// 6. A month passes.
const monthBefore = await text('.hud-month');
await click('[data-act="end-turn"]');
await sleep(600);
await clearModal();
await waitFor(`(() => document.querySelector('.hud-month').textContent.trim() !== ${JSON.stringify(monthBefore)})()`,
  'the month to turn');
// An event may have arrived while the month turned; clear it before tapping on.
await clearModal();
console.log('date:', monthBefore, '->', await text('.hud-month'));

// 7. The stat bars have real height. They once rendered as zero-height inline
//    spans, so every stat looked identical on every screen.
await click('.tab[data-pane="self"]');
await waitFor("!!document.querySelector('#pane-self .bar-f')", 'the stats pane');
const barHeights = await evaluate(
  `Array.from(document.querySelectorAll('#pane-self .bar-f')).map(b => b.getBoundingClientRect().height)`);
const flat = barHeights.filter((h) => h < 2).length;
console.log('stat bars:', barHeights.length, '| collapsed:', flat);
if (!barHeights.length || flat) throw new Error(`${flat} of ${barHeights.length} stat bars have no height`);
const widths = await evaluate(
  `new Set(Array.from(document.querySelectorAll('#pane-self .bar-f')).map(b => Math.round(b.getBoundingClientRect().width))).size`);
if (widths < 3) throw new Error(`every stat bar is the same width (${widths} distinct) — they are not being filled`);
await screenshot('stats');

// 8. The save survives, which is the whole reason assets are served from an
//    https origin instead of file://.
await click('.tab[data-pane="desk"]');
const dateBefore = await text('.hud-month');
await send('Page.reload', { ignoreCache: false });
await sleep(1500);
await waitFor("!!document.querySelector('[data-act=\"continue\"]')", 'the title screen after reload');
if (await evaluate("document.getElementById('btn-continue').hidden")) {
  throw new Error('the career did not survive a reload inside the WebView');
}
await click('[data-act="continue"]');
await waitFor("!!document.querySelector('.hud-name')", 'the restored desk');
const dateAfter = await text('.hud-month');
const whoAfter = await text('.hud-name');
console.log('restored:', whoAfter, '|', dateBefore, '->', dateAfter);
if (dateBefore !== dateAfter || !whoAfter.includes('Emulator Candidate')) {
  throw new Error('the restored career does not match the one that was saved');
}
await screenshot('after-reload');

// 9. The hardware back button hook exists and refuses to quit from a sub-pane.
const backHandled = await evaluate(`(() => {
  if (typeof window.__androidBack !== 'function') return 'missing';
  RZ.ui.UI.pane = 'party'; RZ.ui.renderGame();
  return window.__androidBack() === true ? 'handled' : 'not handled';
})()`);
console.log('back button from a sub-pane:', backHandled);
if (backHandled !== 'handled') throw new Error(`the back button hook is ${backHandled}`);

socket.close();

if (pageProblems.length) {
  console.error('errors reported by the page:');
  for (const problem of pageProblems) console.error(' -', problem);
  process.exit(1);
}
console.log('\nAPK smoke test passed inside the emulator');
