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
import { execFileSync } from 'node:child_process';

const ENDPOINT = process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
const PKG_ORIGIN = process.env.PAGE_ORIGIN ?? 'appassets.androidplatform.net';

if (typeof WebSocket === 'undefined') {
  throw new Error('this test needs a Node with a global WebSocket (22+)');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findPage() {
  let lastSeen = '(nothing)';
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const targets = await (await fetch(`${ENDPOINT}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page' && String(t.url).includes(PKG_ORIGIN));
      if (page?.webSocketDebuggerUrl) return page;
      lastSeen = targets.length
        ? targets.map((t) => `${t.type} ${t.url}`).join(', ')
        : '(no targets at all)';
    } catch (err) { lastSeen = `(could not read /json/list: ${err.message})`; }
    await sleep(1000);
  }
  // Say what was actually on the other end — usually this means the forward is
  // pointed at a different WebView process than the one running the app.
  throw new Error(
    `no page on ${PKG_ORIGIN} was exposed by devtools at ${ENDPOINT}; targets seen: ${lastSeen}`);
}

const pending = new Map();
const pageProblems = [];
let socket = null;
let nextId = 0;

function onMessage(event) {
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
}

// Restarting the app gives a new devtools target, so connecting has to be
// repeatable rather than something that happens once at the top.
async function connect(label) {
  const target = await findPage();
  console.log(label, target.title, '|', target.url);
  const sock = new WebSocket(target.webSocketDebuggerUrl);
  sock.addEventListener('message', onMessage);
  await new Promise((resolve, reject) => {
    sock.addEventListener('open', resolve, { once: true });
    sock.addEventListener('error', () => reject(new Error('could not open the devtools socket')), { once: true });
  });
  socket = sock;
  pending.clear();
  await send('Runtime.enable');
  await send('Page.enable');
}

function send(method, params = {}, timeoutMs = 60000) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`${method} timed out`));
    }, timeoutMs);
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, 25000);
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

// Never ask a WebView for Page.captureScreenshot. It does not merely fail: the
// call wedges the renderer and takes the emulator down with it, so every later
// CDP call times out too. adb screencap asks the device instead of the page,
// which costs nothing and always works. 'cdp' is for rehearsing on desktop
// Chromium, where there is no adb.
const PKG = process.env.APP_PKG ?? 'app.kgosi.cadre';

function adbWorks() {
  if (process.env.USE_ADB === 'no') return false;
  try { execFileSync('adb', ['version'], { stdio: 'ignore', timeout: 10000 }); return true; }
  catch { return false; }
}
const useAdb = adbWorks();

const SHOT_MODE = process.env.SHOT_MODE ?? (useAdb ? 'adb' : 'cdp');   // adb | cdp | off
let shotsUnavailable = false;

async function screenshot(name) {
  if (SHOT_MODE === 'off' || shotsUnavailable) return;
  try {
    if (SHOT_MODE === 'cdp') {
      const { data } = await send('Page.captureScreenshot', { format: 'png' }, 8000);
      writeFileSync(`apk-${name}.png`, Buffer.from(data, 'base64'));
      return;
    }
    const png = execFileSync('adb', ['exec-out', 'screencap', '-p'],
      { maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
    if (!png || !png.length) throw new Error('adb returned no image');
    writeFileSync(`apk-${name}.png`, png);
  } catch (err) {
    shotsUnavailable = true;
    console.log(`(screenshots unavailable, continuing without them: ${err.message})`);
  }
}

// The WebView's devtools socket is webview_devtools_remote_<pid>, so it changes
// every time the app restarts. adb forward has to be re-pointed at the new one
// or the endpoint this test talks to is left dangling.
async function forwardDevtools() {
  for (let attempt = 0; attempt < 40; attempt++) {
    let name = null;
    try {
      const pid = execFileSync('adb', ['shell', 'pidof', PKG], { encoding: 'utf8', timeout: 30000 })
        .trim().split(/\s+/)[0];
      if (pid) name = `webview_devtools_remote_${pid}`;
    } catch { /* the app may not be up yet */ }

    if (name) {
      // Confirm the socket is actually listening before pointing the forward at it.
      let listening = false;
      try {
        const unix = execFileSync('adb', ['shell', 'cat', '/proc/net/unix'],
          { encoding: 'utf8', timeout: 30000 });
        listening = unix.includes(name);
      } catch { /* transient */ }

      if (listening) {
        try { execFileSync('adb', ['forward', '--remove', 'tcp:9222'], { stdio: 'ignore', timeout: 30000 }); }
        catch { /* nothing was forwarded, which is fine */ }
        execFileSync('adb', ['forward', 'tcp:9222', `localabstract:${name}`],
          { stdio: 'ignore', timeout: 30000 });
        return name;
      }
    }
    await sleep(1000);
  }
  throw new Error('the restarted app never exposed a devtools socket');
}

// A breadcrumb trail, so a log that ends abruptly still says where it stopped.
let phase = 'connecting';
function step(what) { phase = what; console.log('·', what); }

// A top-level await that rejects otherwise prints a bare stack with no clue
// which assertion was in flight.
process.on('unhandledRejection', (err) => {
  console.error(`\nfailed during: ${phase}`);
  console.error(err instanceof Error ? (err.stack ?? err.message) : err);
  process.exit(1);
});

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

await connect('target:');

step('checking the app origin');
// 1. The shell really loaded the packaged assets over the app's https origin.
const href = await evaluate('location.href');
console.log('url:', href);
if (!href.includes(PKG_ORIGIN)) throw new Error(`the WebView is not on the app's asset origin: ${href}`);

step('checking the title screen');
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

step('opening the country list');
// 3. All ten countries are offered.
await click('[data-act="new-game"]');
await waitFor("!!document.querySelector('.ccard')", 'the country list');
const countries = await count('.ccard');
console.log('countries offered:', countries);
if (countries !== 10) throw new Error(`expected 10 countries, saw ${countries}`);
await screenshot('countries');

step('starting a career');
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

step('taking an action');
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

step('holding a meeting');
// 5b. Some actions open a conversation instead of resolving on a die roll:
//     a named person asks you something and you answer in front of them.
//     Tap through one and check the transcript really builds.
await evaluate("(() => { RZ.ui.UI.S.actionsLeft = 3; RZ.ui.renderGame(); return true; })()");
await click('#pane-desk .act[data-action="walkabout"]');
await waitFor("!!document.querySelector('#modal-inner .talk')", 'a conversation to open');
const speaker = await text('#modal-inner .modal-h');
const askedBy = await text('#modal-inner .talk-role');
console.log('meeting with:', speaker, '|', askedBy);
if (!speaker.trim()) throw new Error('the person across the table has no name');

let exchanges = 0;
for (let round = 0; round < 8; round++) {
  const answers = await count('#modal-inner .choice:not([disabled])');
  if (!answers) break;
  if (answers < 2) throw new Error(`only ${answers} answer on offer — there should be a real choice`);
  const linesBefore = await count('#modal-inner .talk-l');
  await click('#modal-inner .choice:not([disabled])');
  await sleep(200);
  const linesAfter = await count('#modal-inner .talk-l');
  if (!(linesAfter > linesBefore)) throw new Error('answering did not add anything to the transcript');
  exchanges++;
}
console.log('exchanges:', exchanges);
if (exchanges < 2) throw new Error(`the meeting was over in ${exchanges} exchange(s)`);
if (!(await count('#modal-inner .talk-l.closing'))) throw new Error('the meeting ended without a closing line');
if (!(await count('#modal-inner .talk-l.me'))) throw new Error('nothing you said was kept on screen');
await screenshot('meeting');
await clearModal();
if (!(await count('#pane-desk .paper'))) throw new Error('the meeting left no trace in the record');

step('ending the month');
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

step('checking the stat bars');
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

step('restarting the app to check the save');
// 8. The save survives being closed and reopened, which is the whole reason
//    assets are served from an https origin instead of file://.
//
//    This closes and relaunches the app through Android rather than calling
//    Page.reload: it is what a player actually does, and a devtools-driven
//    reload of a WebView is its own source of trouble.
await click('.tab[data-pane="desk"]');
const dateBefore = await text('.hud-month');

if (useAdb) {
  execFileSync('adb', ['shell', 'am', 'force-stop', PKG], { timeout: 30000 });
  await sleep(1000);
  execFileSync('adb', ['shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`],
    { stdio: 'ignore', timeout: 60000 });
  // The devtools socket is named after the app's pid, so a restarted app is
  // behind a different socket and the forward set up before this test ran now
  // points at nothing. Re-point it before trying to reattach.
  const sock = await forwardDevtools();
  console.log('devtools socket after restart:', sock);
  try { socket?.close(); } catch { /* already gone */ }
  await connect('reattached to:');
} else {
  // Desktop rehearsal: reload, then reconnect anyway so this run still covers
  // the reattach path that the emulator depends on.
  await send('Page.reload', { ignoreCache: false });
  await sleep(1500);
  try { socket?.close(); } catch { /* already gone */ }
  await connect('reattached to:');
}

// The continue button is always in the DOM — it is hidden when there is no
// save — so waiting for the element to exist proves nothing. Wait for the title
// screen to be the active one AND that button to be showing.
await waitFor(`(() => {
  const title = document.querySelector('#screen-title.is-active');
  const cont = document.getElementById('btn-continue');
  return !!title && !!cont && !cont.hidden;
})()`, 'the title screen to come back offering the saved career');
await click('[data-act="continue"]');
await waitFor("!!document.querySelector('.hud-name')", 'the restored desk');
const dateAfter = await text('.hud-month');
const whoAfter = await text('.hud-name');
console.log('restored:', whoAfter, '|', dateBefore, '->', dateAfter);
if (dateBefore !== dateAfter || !whoAfter.includes('Emulator Candidate')) {
  throw new Error('the restored career does not match the one that was saved');
}
await screenshot('after-reload');

step('checking the back button');
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
