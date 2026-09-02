/* ui-sim.mjs — career-sim, but through the actual screen.

   The four Node harnesses never load ui.js or main.js. They load the engine
   into a sandbox and drive it directly, which is why they are fast and why they
   have twice now been green while the emulator was red: a bug that only exists
   between the engine and the DOM is invisible to all of them.

   page-smoke covers that gap with one scripted career. One career sees one
   diary, one set of scenes and one set of rungs, so it catches a rendering bug
   only if that career happens to walk into it — the kept-appointment bug took
   fourteen careers in a hundred, and page-smoke plays one.

   This plays many, at random, in a real browser, and asserts after every render
   the things that were actually wrong the last two times:

     · the desk offers every action the engine says is available, and offers
       nothing the engine does not  (a kept diary entry used to remove one)
     · an open sheet always has something enabled to dismiss it  (a disabled
       answer used to hang the emulator for sixty-four clicks)
     · nothing anywhere renders undefined, NaN or [object Object]
     · rendering never throws, and the page logs no errors

   Run: bash game/test/ui-sim.sh    (CAREERS=n MONTHS=n to change the size)
*/
const PORT = process.env.CDP_PORT || '9222';
const base = 'http://127.0.0.1:' + PORT;
const CAREERS = parseInt(process.env.CAREERS || '40', 10);
const MONTHS = parseInt(process.env.MONTHS || '90', 10);

const targets = await (await fetch(base + '/json/list')).json();
const page = targets.find((t) => t.type === 'page' && t.url.includes('index.html'));
if (!page) { console.error('no page target on ' + base + ' — is the browser up?'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const pageErrors = [];

ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') {
    pageErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    pageErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
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

// The whole career runs inside the page in one call. Round-tripping per action
// would be correct and would also take an hour; what matters is that every
// render is a real render into a real document, and it is.
const CAREER = (seed, months) => `(function(){
  var out = { seed: ${seed}, months: 0, renders: 0, actions: 0, meetings: 0,
              violations: [], reached: null, ended: null };
  function note(what, detail) {
    if (out.violations.length < 12) out.violations.push(what + (detail ? ': ' + detail : ''));
  }
  var BAD = /undefined|NaN|\\[object Object\\]/;

  try {
    RZ.seed(${seed});
    RZ.ui.setPause(0); RZ.ui.setCount(0);
    var cids = Object.keys(RZ.COUNTRIES);
    var cid = cids[${seed} % cids.length];
    var c = RZ.COUNTRIES[cid];
    RZ.ui.UI.draft = { countryId: cid, name: RZ.makeName(c), gender: ${seed} % 2 ? 'f' : 'm',
      regionId: RZ.pick(c.regions).id, bgId: RZ.pick(RZ.BACKGROUNDS).id,
      partyId: RZ.pick(c.parties).id, startAs: ${seed} % 5 === 0 ? 'candidate' : 'activist' };
    RZ.main.begin();
    var ans = document.querySelectorAll('#modal-inner .choice:not([disabled])');
    if (ans.length) ans[Math.floor(RZ.rnd() * ans.length)].click();
    var go = document.querySelector('#modal-inner [data-go]');
    if (go) go.click();

    var S = RZ.ui.UI.S;
    if (!S) { note('begin() produced no career'); return out; }

    function drain() {
      // Whatever is on screen, clear it the way a player would: only enabled
      // controls, and never more clicks than a person would tolerate.
      for (var i = 0; i < 40; i++) {
        var m = document.getElementById('modal');
        if (!m || m.hidden) return true;
        var pick = function (sel) { return document.querySelector('#modal-inner ' + sel + ':not([disabled])'); };
        var b = pick('[data-close]') || pick('[data-i]') || pick('[data-r="0"]') ||
                pick('[data-go]') || pick('[data-final]') || pick('[data-skip]') ||
                pick('[data-cancel]') || pick('button');
        if (!b) {
          var all = Array.from(document.querySelectorAll('#modal-inner button'))
            .map(function (x) { return x.className + (x.disabled ? '[disabled]' : ''); }).join(',');
          note('a sheet is open with nothing enabled to dismiss it', all || '(no buttons at all)');
          m.hidden = true; return false;
        }
        b.click();
      }
      note('a sheet would not close in forty clicks');
      document.getElementById('modal').hidden = true;
      return false;
    }

    function checkDesk() {
      var host = document.getElementById('pane-desk');
      if (!host) { note('there is no desk'); return; }
      out.renders++;
      if (BAD.test(host.textContent)) note('the desk renders undefined/NaN', host.textContent.slice(0, 90));
      // Everything the engine offers has to be reachable, and everything
      // reachable has to be something the engine offers.
      var offered = {};
      RZ.engine.availableActions(S).forEach(function (a) { offered[a.id] = true; });
      var onScreen = {};
      host.querySelectorAll('[data-action]').forEach(function (b) { onScreen[b.getAttribute('data-action')] = true; });
      Object.keys(offered).forEach(function (k) {
        if (!onScreen[k]) note('the engine offers an action the desk does not show', k);
      });
      Object.keys(onScreen).forEach(function (k) {
        if (!offered[k]) note('the desk shows an action the engine does not offer', k);
      });
    }

    for (var m2 = 0; m2 < ${months} && !S.over; m2++) {
      RZ.ui.UI.pane = 'desk';
      RZ.ui.renderGame();
      checkDesk();

      var guard = 0;
      while (S.actionsLeft > 0 && guard++ < 8) {
        var btns = document.querySelectorAll('#pane-desk .act[data-action]:not([disabled])');
        if (!btns.length) break;
        var pickBtn = btns[Math.floor(RZ.rnd() * btns.length)];
        var before = S.actionsLeft;
        pickBtn.click();
        out.actions++;
        if (document.getElementById('modal') && !document.getElementById('modal').hidden) {
          if (document.querySelector('#modal-inner .talk')) out.meetings++;
          if (!drain()) break;
        }
        RZ.ui.UI.pane = 'desk'; RZ.ui.renderGame(); checkDesk();
        if (S.actionsLeft === before) break;   // nothing was spent; stop pushing
      }

      // Every pane, every few months — the ones nobody clicks are where a
      // rendering fault sits for a release.
      if (m2 % 5 === 0) {
        ['country', 'party', 'self'].forEach(function (p) {
          RZ.ui.UI.pane = p; RZ.ui.renderGame();
          var el = document.getElementById('pane-' + p);
          out.renders++;
          if (!el) { note('there is no ' + p + ' pane'); return; }
          if (BAD.test(el.textContent)) note('the ' + p + ' pane renders undefined/NaN', el.textContent.slice(0, 90));
        });
        RZ.ui.UI.pane = 'desk';
      }

      RZ.main.endTurn();
      drain();
      out.months++;
      S = RZ.ui.UI.S;
      if (!S) { note('the career vanished at the turn'); break; }
    }

    var lad = RZ.ladderFor(S.countryId);
    out.reached = lad[S.player.rungIdx].tier;
    out.ended = S.ending || (S.over ? 'over' : null);
    out.country = S.countryId;
  } catch (e) {
    note('threw', String((e && e.stack) || e).split('\\n').slice(0, 2).join(' | '));
  }
  return out;
})()`;

console.log(`playing ${CAREERS} careers of up to ${MONTHS} months, through the real screen`);
const totals = { months: 0, renders: 0, actions: 0, meetings: 0 };
const problems = [];
const tiers = {};
// A fixed sleep after navigate is a race: on a slow round the scripts have not
// finished loading and the career starts against a half-built RZ. Wait for the
// page to actually be ready instead.
async function ready(ms = 8000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      if (await evaluate("!!(window.RZ && RZ.ui && RZ.ui.setPause && RZ.main && RZ.engine && RZ.COUNTRIES)")) return true;
    } catch { /* the context is still being replaced */ }
    await new Promise((r) => setTimeout(r, 120));
  }
  return false;
}

for (let i = 0; i < CAREERS; i++) {
  await send('Page.navigate', { url: page.url });
  if (!(await ready())) { problems.push(`career ${i}: the page never finished loading`); continue; }
  let r;
  try { r = await evaluate(CAREER(2000 + i * 7, MONTHS)); }
  catch (e) { problems.push(`career ${i}: the page itself threw — ${e.message}`); continue; }
  totals.months += r.months; totals.renders += r.renders;
  totals.actions += r.actions; totals.meetings += r.meetings;
  if (r.reached !== null) tiers[r.reached] = (tiers[r.reached] || 0) + 1;
  r.violations.forEach((v) => problems.push(`${r.country || '??'}/${r.seed}: ${v}`));
}

console.log(`  ${totals.months} months, ${totals.renders} renders, ${totals.actions} actions, ${totals.meetings} meetings`);
console.log('  tiers reached: ' + Object.keys(tiers).sort((a, b) => a - b)
  .map((t) => 't' + t + ' ' + tiers[t]).join('  '));

if (pageErrors.length) {
  const seen = [...new Set(pageErrors)];
  console.error(`\n${pageErrors.length} console errors, ${seen.length} distinct:`);
  seen.slice(0, 8).forEach((e) => console.error('  ✗ ' + String(e).split('\n')[0]));
}
if (problems.length) {
  const seen = [...new Set(problems.map((p) => p.replace(/^[A-Z?]{2}\/\d+: /, '')))];
  console.error(`\n${problems.length} problems, ${seen.length} distinct:`);
  seen.slice(0, 12).forEach((p) => console.error('  ✗ ' + p));
  console.error(`\nexample: ${problems[0]}`);
}
if (problems.length || pageErrors.length) process.exit(1);
console.log('\nthe screen holds up across every one of them');
process.exit(0);
