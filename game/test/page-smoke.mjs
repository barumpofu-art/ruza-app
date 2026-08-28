/* Drives the real page in a real browser, over devtools.

   Both other simulations load the game's modules into a Node sandbox, which
   means neither of them ever loads ui.js or main.js — the two files a player
   actually touches. This one serves game/ , opens it in headless Chromium, and
   plays: it renders every pane, spends months, sits through meetings and event
   rooms, reloads the page and resumes the saved career through the Continue
   button, and ends the career to render the obituary. Any exception or console
   error anywhere in that is a failure.

   Run: bash game/test/page-smoke.sh
   Or, against a browser you started yourself on port 9222:
     node game/test/page-smoke.mjs
*/
const PORT = process.env.CDP_PORT || '9222';
const base = 'http://127.0.0.1:' + PORT;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WANT = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();

const list = await (await fetch(base + '/json/list')).json();
const page = list.find((t) => t.type === 'page' && t.url.includes('index.html'));
if (!page) { console.error('no page target on ' + base + ' — is the browser up?'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const errors = [];

ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  }
});
await new Promise((r) => ws.addEventListener('open', r));

function send(method, params) {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params: params || {} }));
  return new Promise((r) => pending.set(n, r));
}
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) {
    throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  }
  return r.result?.result?.value;
}

await send('Runtime.enable');
await send('Page.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise((r) => setTimeout(r, 1500));

const boot = await evaluate(`({
  version: RZ.VERSION,
  build: document.getElementById('build-line').textContent,
  title: document.querySelector('.title-main').textContent,
  countries: Object.keys(RZ.COUNTRIES).length,
  scenes: RZ.DIALOGUE.length,
  hasField: typeof RZ.field.populate === 'function'
})`);
console.log('booted:', JSON.stringify(boot));

// New career → country list → creation screen → into the game.
await evaluate(`document.querySelector('[data-act="new-game"]').click()`);
const countryCards = await evaluate(`document.querySelectorAll('#country-list [data-country]').length ||
  document.querySelectorAll('#country-list > *').length`);
console.log('country cards rendered:', countryCards);

// Skip the click-through of creation and start a career directly, then render
// every pane and the contest card, which is where the field surfaces.
// begin() opens the origin scene first — the afternoon that got you into this
// — and only creates the career once an answer has been given. Play it, the
// way a player would, rather than expecting a game to exist synchronously.
const origin = await evaluate(`(function(){
  RZ.ui.UI.draft = { countryId: 'ZA', name: 'Test Candidate', gender: 'f',
    regionId: RZ.COUNTRIES.ZA.regions[0].id, bgId: RZ.BACKGROUNDS[0].id,
    partyId: RZ.COUNTRIES.ZA.parties[0].id, startAs: 'activist' };
  RZ.main.begin();
  var answers = document.querySelectorAll('#modal-inner [data-i]');
  if (answers.length) answers[0].click();
  var go = document.querySelector('#modal-inner [data-go]');
  if (go) go.click();
  return { answers: answers.length, started: !!(RZ.ui.UI.S && RZ.ui.UI.S.player),
           trait: RZ.ui.UI.S ? RZ.ui.UI.S.player.trait : null };
})()`);
if (!origin.answers) throw new Error('the origin scene offered no answers');
if (!origin.started) throw new Error('answering the origin scene did not start a career');
if (!origin.trait) throw new Error('the origin answer left no trait on the career');
console.log('origin scene:', JSON.stringify(origin));

const panes = [];
for (const p of ['desk', 'country', 'party', 'self']) {
  const info = await evaluate(`(function(){
    RZ.ui.UI.pane = '${p}';
    RZ.ui.renderGame();
    var el = document.getElementById('pane-${p}');
    return { pane: '${p}', chars: el.innerHTML.length,
             bad: /undefined|NaN|\\[object Object\\]/.test(el.textContent) };
  })()`);
  panes.push(info);
}
console.log('panes:', JSON.stringify(panes));

// The diary is the one board that is rendered before anything is clicked, and
// both of its buttons go through main.js. Click each of them the way a player
// does, and drive whatever modal comes back through the DOM.
const diary = await evaluate(`(function(){
  RZ.ui.UI.pane = 'desk';
  RZ.ui.renderGame();
  var S = RZ.ui.UI.S;
  var host = document.getElementById('pane-desk');
  var out = {
    entries: S.docket ? S.docket.entries.length : -1,
    rows: host.querySelectorAll('.dk-row').length,
    board: host.textContent.indexOf('In the diary') >= 0,
    cancelled: false, kept: false
  };
  out.bad = /undefined|NaN|\\[object Object\\]/.test(host.textContent);

  // Cancel one, which costs no action and must not open anything.
  var x = host.querySelector('[data-decline]');
  if (x) {
    var cancelId = x.getAttribute('data-decline');
    x.click();
    out.cancelled = !RZ.docket.entryFor(S, cancelId);
    out.feed = S.feed.length;
  }

  // Keep another. It may open a meeting; play it out through the buttons.
  host = document.getElementById('pane-desk');
  var b = host.querySelector('.dk[data-action]');
  if (b) {
    var keepId = b.getAttribute('data-action');
    b.click();
    var g = 0;
    while (g++ < 12) {
      var choices = document.querySelectorAll('#modal-inner .choice:not([disabled])');
      if (!choices.length) break;
      choices[0].click();
    }
    var close = document.querySelector('#modal-inner [data-close]');
    if (close) close.click();
    out.kept = RZ.docket.summary(S).kept > 0;
    out.keptId = keepId;
  }
  out.left = S.actionsLeft;
  return out;
})()`);
console.log('diary:', JSON.stringify(diary));
if (diary.entries < 1) throw new Error('the month opened with nothing in the diary');
if (!diary.board) throw new Error('the diary board never rendered');
if (!diary.rows) throw new Error('the diary rendered no appointments to keep');
if (!diary.cancelled) throw new Error('cancelling an appointment did not remove it');
if (!diary.kept) throw new Error('keeping an appointment was never recorded');
if (diary.bad) throw new Error('the diary board renders undefined/NaN');

// Play a year: spend actions, take any meeting, end the month, answer any event.
const played = await evaluate(`(function(){
  var log = { months: 0, meetings: 0, events: 0, contests: 0, errors: [] };
  try {
    for (var m = 0; m < 14; m++) {
      var S = RZ.ui.UI.S;
      var guard = 0;
      while (S.actionsLeft > 0 && guard++ < 8) {
        var avail = RZ.engine.availableActions(S);
        if (!avail.length) break;
        var a = avail[Math.floor(Math.random() * avail.length)];
        if (a.id === 'budget') { S.actionsLeft--; continue; }
        var out = RZ.engine.doAction(S, a.id);
        if (!out || out.fail) continue;
        if (out.dialogue) {
          log.meetings++;
          var cv = out.dialogue, b = 0;
          while (!cv.done && b++ < 10) {
            var o = RZ.dialogue.options(cv).filter(function (x) { return x.ok; });
            if (!o.length) break;
            RZ.dialogue.choose(cv, o[0].i);
          }
          RZ.engine.finishDialogue(S, cv);
        }
      }
      var cs = RZ.engine.contestStatus(S);
      if (cs.available) { RZ.engine.contest(S); log.contests++; }
      RZ.engine.endTurn(S);
      log.months++;
      if (S.pendingEvent) {
        log.events++;
        if (S.pendingEvent.talk) {
          var ec = RZ.dialogue.beginEvent(S, { beat: S.pendingEvent.talkBeat, mood: S.pendingEvent.talkMood });
          var g2 = 0;
          while (ec && !ec.done && g2++ < 10) {
            var eo = RZ.dialogue.options(ec).filter(function (x) { return x.ok; });
            if (!eo.length) break;
            RZ.dialogue.choose(ec, eo[0].i);
          }
          if (ec && ec.done) RZ.engine.finishEventDialogue(S, ec);
        } else {
          RZ.engine.resolveEvent(S, S.pendingEvent.choices.filter(function (c) { return c.ok; })[0].i);
        }
      }
      RZ.ui.renderGame();
    }
  } catch (e) { log.errors.push(String(e && e.stack || e)); }
  return log;
})()`);
console.log('played:', JSON.stringify(played));

// The save has to survive a real reload through main.js's continue path.
await send('Page.reload', { ignoreCache: false });
await new Promise((r) => setTimeout(r, 1200));
const resumed = await evaluate(`(function(){
  var visible = !document.getElementById('btn-continue').hidden;
  document.querySelector('[data-act="continue"]').click();
  var S = RZ.ui.UI.S;
  return { continueShown: visible, turn: S && S.turn, rung: S && S.player.rungIdx,
           field: S && S.field.length, leader: S && S.parties[S.player.partyId].leaderName };
})()`);
console.log('resumed:', JSON.stringify(resumed));

// The end screen and the obituary render through ui.js too.
const ended = await evaluate(`(function(){
  RZ.engine.endGame(RZ.ui.UI.S, 'retire');
  RZ.ui.showEnd();
  var el = document.getElementById('screen-end');
  return { chars: el.innerHTML.length, bad: /undefined|NaN|\\[object Object\\]/.test(el.textContent) };
})()`);
console.log('end screen:', JSON.stringify(ended));

const problems = [];
if (!boot.hasField) problems.push('field module missing in the page');
if (boot.version !== WANT) problems.push(`page says ${boot.version}, game/VERSION says ${WANT}`);
if (boot.build.indexOf('Version ' + WANT) < 0) problems.push('build line reads "' + boot.build + '"');
if (countryCards < 10) problems.push('only ' + countryCards + ' countries rendered');
for (const p of panes) {
  if (p.chars < 200) problems.push(p.pane + ' pane rendered almost nothing');
  if (p.bad) problems.push(p.pane + ' pane shows undefined/NaN');
}
if (played.errors.length) problems.push('playing threw: ' + played.errors[0].slice(0, 200));
if (played.months < 14) problems.push('only played ' + played.months + ' months');
if (!resumed.continueShown) problems.push('Continue Career was not offered after a reload');
if (!resumed.field) problems.push('the field did not survive the save');
if (!resumed.leader) problems.push('the party leader did not survive the save');
if (ended.bad || ended.chars < 200) problems.push('the end screen did not render');
if (errors.length) problems.push('console errors: ' + errors.slice(0, 3).join(' | '));

if (problems.length) {
  console.error('\n' + problems.map((p) => '  ✗ ' + p).join('\n'));
  process.exit(1);
}
console.log('\nthe page holds up');
ws.close();
