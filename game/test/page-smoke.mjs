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

// An appointment you kept must not take its action off the desk. The diary card
// becomes an unclickable "kept" line, so if the grid also hides it the action is
// gone for the rest of the month with no explanation — which is exactly what the
// emulator run walked into when it went looking for `walkabout` afterwards.
const afterKeeping = await evaluate(`(function(){
  RZ.ui.UI.pane = 'desk';
  var S = RZ.ui.UI.S;
  S.actionsLeft = 3;
  RZ.ui.renderGame();
  var host = document.getElementById('pane-desk');
  var out = { kept: [], reachable: [], stale: [] };
  (S.docket ? S.docket.entries : []).forEach(function (e) {
    if (!e.kept) return;
    out.kept.push(e.actionId);
    // Still offered by the engine? Then it must still be clickable on the desk.
    var offered = RZ.engine.availableActions(S).some(function (a) { return a.id === e.actionId; });
    var el = host.querySelector('.act[data-action="' + e.actionId + '"]');
    if (offered && el) out.reachable.push(e.actionId);
    if (offered && !el) out.stale.push(e.actionId);
  });
  return out;
})()`);
console.log('after keeping:', JSON.stringify(afterKeeping));
if (afterKeeping.stale.length) {
  throw new Error('keeping an appointment removed its action from the desk: ' + afterKeeping.stale.join(', '));
}

console.log('diary:', JSON.stringify(diary));
if (diary.entries < 1) throw new Error('the month opened with nothing in the diary');
if (!diary.board) throw new Error('the diary board never rendered');
if (!diary.rows) throw new Error('the diary rendered no appointments to keep');
if (!diary.cancelled) throw new Error('cancelling an appointment did not remove it');
if (!diary.kept) throw new Error('keeping an appointment was never recorded');
if (diary.bad) throw new Error('the diary board renders undefined/NaN');

// The pause is the only thing in the game that is purely a matter of timing, so
// it is the only thing that has to be tested in a browser. Hold a question, and
// check three things: the answers are veiled but reachable, the silence reads
// like a sentence, and a tap ends it early.
const held = await evaluate(`(async function(){
  RZ.ui.setPause(900);
  var S = RZ.ui.UI.S;
  var out = { armed: false };
  // Find a topic with a room behind it and open it the way an action does.
  var sc = null, act = null;
  var avail = RZ.engine.availableActions(S);
  for (var i = 0; i < avail.length && !sc; i++) {
    var pool = RZ.dialogue.scenesFor(S, avail[i].id);
    if (pool.length) { sc = pool[0]; act = avail[i]; }
  }
  if (!sc) return out;
  var cv = RZ.dialogue.begin(S, sc, RZ.actionById[act.id]);
  RZ.ui.showDialogue(cv, function(){});
  out.armed = true;
  out.line = cv.pause;

  var box = document.querySelector('#modal-inner .choices');
  var hold = document.querySelector('#modal-inner .talk-hold');
  out.veiled = !!(box && box.classList.contains('veiled'));
  out.shown = !!hold && hold.textContent.length > 15;
  out.reachable = !!(box && box.querySelectorAll('.choice').length);
  // Computed style, not just the class: a veil that does not actually block a
  // tap is not a veil.
  out.blocked = !!(box && getComputedStyle(box).pointerEvents === 'none');

  // A tap anywhere ends it, and it must not consume the question.
  document.querySelector('#modal-inner').click();
  await new Promise(function (r) { setTimeout(r, 60); });
  box = document.querySelector('#modal-inner .choices');
  out.released = !!(box && !box.classList.contains('veiled'));
  out.beatHeld = cv.beat === 0 && !cv.done;

  // And answering afterwards works, and the next question holds again.
  var opts = document.querySelectorAll('#modal-inner .choice:not([disabled])');
  out.options = opts.length;
  if (opts.length) opts[0].click();
  await new Promise(function (r) { setTimeout(r, 60); });
  out.nextHeld = cv.done || !!document.querySelector('#modal-inner .talk-hold');

  // Leave the room in whatever state it is in; the career carries on below.
  var g = 0;
  while (!cv.done && g++ < 12) {
    var o = RZ.dialogue.options(cv).filter(function (z) { return z.ok; });
    if (!o.length) break;
    RZ.dialogue.choose(cv, o[0].i);
  }
  RZ.engine.finishDialogue(S, cv);
  RZ.ui.closeModal();
  RZ.ui.setPause(0);          // the rest of this run plays at simulation speed
  return out;
})()`);
console.log('pause:', JSON.stringify(held));
if (!held.armed) throw new Error('no room could be opened to test the pause');
if (!held.shown) throw new Error('the silence was never rendered');
if (!held.veiled) throw new Error('the answers were on the table straight away');
if (!held.reachable) throw new Error('the answers are not in the DOM during the pause');
if (!held.blocked) throw new Error('the veil does not actually block a tap');
if (!held.released) throw new Error('tapping did not end the pause');
if (!held.beatHeld) throw new Error('the tap that ended the pause also answered the question');
if (!held.options) throw new Error('no answers were selectable once the pause ended');
if (!held.nextHeld) throw new Error('the next question did not hold');

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

// Election day is four screens and an animated count, none of which the Node
// harnesses ever render. Drive the whole night through the DOM.
const night = await evaluate(`(function(){
  RZ.ui.setCount(0);                 // no waiting; the stagger is tested elsewhere
  var S = RZ.ui.UI.S;
  S.player.rungIdx = 8;              // somebody a general election is about
  var out = { phases: [], errors: [] };
  try {
    var done = false;
    RZ.ui.showElectionDay(function () { done = true; });
    out.phases.push(document.querySelector('#modal-inner .modal-h').textContent);
    out.groundChoices = document.querySelectorAll('#modal-inner .choice').length;
    document.querySelectorAll('#modal-inner .choice')[1].click();

    out.phases.push(document.querySelector('#modal-inner .modal-h').textContent);
    out.pollRows = document.querySelectorAll('#modal-inner .eres-row').length;
    out.countedYet = !!(S.eday && S.eday.result);
    document.querySelector('#modal-inner [data-go]').click();

    out.phases.push(document.querySelector('#modal-inner .modal-h').textContent);
    out.shiftChoices = document.querySelectorAll('#modal-inner .choice').length;
    document.querySelectorAll('#modal-inner .choice')[0].click();

    // The rig offer sits between the afternoon and the count, where it always did.
    var rig = document.querySelector('#modal-inner [data-r]');
    if (rig) { out.rigOffered = true; rig.click(); }

    out.phases.push(document.querySelector('#modal-inner .modal-h').textContent);
    out.counted = !!(S.eday && S.eday.result);
    // With the stagger off the night resolves at once and offers the full result.
    var fin = document.querySelector('#modal-inner [data-final]');
    out.finalOffered = !!fin;
    if (fin) fin.click();
    out.resultSheet = !!document.querySelector('#modal-inner .eres-row');
    var close = document.querySelector('#modal-inner [data-close]');
    if (close) close.click();
    out.done = done;
    out.bad = /undefined|NaN|\\[object Object\\]/.test(document.body.textContent);
  } catch (e) { out.errors.push(String(e && e.stack || e)); }
  RZ.ui.setCount(900);
  return out;
})()`);
console.log('election night:', JSON.stringify(night));
if (night.errors.length) throw new Error('election day threw: ' + night.errors[0]);
if (night.phases.length !== 4) throw new Error('election day did not run four phases');
if (!night.groundChoices) throw new Error('the ground game offered nothing');
if (!night.pollRows) throw new Error('the exit poll rendered no parties');
if (night.countedYet) throw new Error('the count ran before the player had intervened');
if (!night.shiftChoices) throw new Error('the afternoon offered no intervention');
if (!night.counted) throw new Error('the count never ran');
if (!night.finalOffered) throw new Error('the night never reached a declaration');
if (!night.resultSheet) throw new Error('the full result sheet did not render');
if (!night.done) throw new Error('election day never handed control back');
if (night.bad) throw new Error('election day renders undefined/NaN');

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
