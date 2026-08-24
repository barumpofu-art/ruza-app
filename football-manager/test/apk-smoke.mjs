// Plays the game inside the real Android WebView, over the devtools socket
// forwarded from the emulator by test/apk-smoke.sh. This is the only test that
// covers the packaged APK; everything else runs in desktop Chromium.
//
// It speaks CDP directly rather than through Playwright: WebView implements
// only part of the protocol, and Playwright's connectOverCDP needs
// Browser.setDownloadBehavior, which WebView does not have.

import { writeFileSync } from 'node:fs';

const ENDPOINT = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
// Overridable so the same script can be rehearsed against desktop Chromium.
const PKG_ORIGIN = process.env.PAGE_ORIGIN ?? 'appassets.androidplatform.net';

if (typeof WebSocket === 'undefined') {
  throw new Error('this test needs a Node with a global WebSocket (22+)');
}

// Find the game's page among the app's devtools targets.
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  for (;;) {
    const value = await evaluate(expression);
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(400);
  }
}

const click = (selector) => evaluate(
  `(() => { const el = document.querySelector(${JSON.stringify(selector)});
     if (!el) throw new Error('nothing to click: ' + ${JSON.stringify(selector)});
     el.click(); return true; })()`);

const text = (selector) => evaluate(
  `(document.querySelector(${JSON.stringify(selector)}) || {}).textContent || ''`);

const count = (selector) => evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);

async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`apk-${name}.png`, Buffer.from(data, 'base64'));
}

await send('Runtime.enable');
await send('Page.enable');

// 1. The shell really loaded the packaged assets over the app's https origin.
const href = await evaluate('location.href');
console.log('url:', href);
if (!href.includes(PKG_ORIGIN)) throw new Error(`the WebView is not on the app's asset origin: ${href}`);

// 2. Start from a clean slate: a re-run (or a rehearsal against a dev server)
//    can arrive with a save, a cached shell and a live service worker.
await evaluate(`(async () => {
  try { localStorage.clear(); } catch (e) { /* no storage, nothing to clear */ }
  if (navigator.serviceWorker) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  if (self.caches) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
  location.reload();
  return true;
})()`);
await sleep(2000);

// The start screen offers the whole division.
await waitFor("!!document.querySelector('.clubpick')", 'the start screen');
const clubs = await count('.clubopt');
console.log('clubs offered:', clubs);
if (clubs !== 12) throw new Error(`expected 12 clubs on the start screen, saw ${clubs}`);
await screenshot('start');

// 3. A career starts.
await click('[data-club="gab"]');
await click('[data-start]');
await waitFor("!!document.querySelector('.topbar-name')", 'the dashboard');
const club = (await text('.topbar-name')).trim();
console.log('club:', club);
if (!club.includes('Gaborone')) throw new Error(`wrong club: ${club}`);

// 4. The pitch lays out. An old WebView without aspect-ratio would collapse it
//    and make team selection unusable.
await click('[data-action="tab:squad"]');
await waitFor("!!document.querySelector('.pitch .slot')", 'the pitch');
const pitchHeight = await evaluate("document.querySelector('.pitch').getBoundingClientRect().height");
console.log('pitch height:', pitchHeight);
if (!(pitchHeight > 200)) throw new Error(`the pitch did not lay out: height ${pitchHeight}`);
await screenshot('squad');

// 5. A full match runs in the live match view.
await click('[data-action="tab:home"]');
await click('[data-action="play-match"]');
await waitFor("!!document.querySelector('.match .feed .ev')", 'kick-off');
await click('[data-match="skip"]');
await waitFor("!!document.querySelector('[data-match=\"continue\"]')", 'full time', 90000);
console.log('full time:', (await text('[data-goals]')).trim());
await screenshot('fulltime');
await click('[data-match="continue"]');
await waitFor("!!document.querySelector('.topbar-name')", 'the dashboard again');

// 6. The save survives, which is the whole reason assets are served from an
//    https origin instead of file://.
const before = (await text('.topbar-sub')).trim();
await evaluate('location.reload()');
await sleep(1500);
await waitFor("!!document.querySelector('.topbar-name')", 'the reloaded dashboard');
const after = (await text('.topbar-sub')).trim();
console.log('before reload:', before, '| after:', after);
if (before !== after) throw new Error('the save did not survive a reload inside the WebView');
await screenshot('after-reload');

socket.close();

if (pageProblems.length) {
  console.error('errors reported by the page:');
  for (const problem of pageProblems) console.error(' -', problem);
  process.exit(1);
}
console.log('\nAPK smoke test passed inside the emulator');
