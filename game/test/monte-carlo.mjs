/* monte-carlo.mjs — a thousand careers, played badly, to see what the rules do.

   The point is not that a random player is a good player. It is that a
   thousand of them expose distributions a designer cannot hold in their head:
   how often the regional brigade actually crosses, whether anybody ever
   reaches the top office, whether a mechanic fires so rarely it may as well
   not exist, or so often it is the whole game.

   Careers are seeded, so any line in the report can be replayed exactly:
       node game/test/monte-carlo.mjs --replay 417

   Usage:
       node game/test/monte-carlo.mjs [--runs 1000] [--turns 600] [--json out.json]
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'core.js', 'data-countries.js', 'data-ladder.js', 'data-actions.js',
  'data-events.js', 'data-dialogue.js', 'people.js', 'elections.js',
  'engine.js', 'governance.js', 'dialogue.js', 'crisis.js'
];

function loadGame() {
  const store = new Map();
  const sandbox = {
    console,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of FILES) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), sandbox, { filename: `js/${f}` });
  }
  return sandbox.RZ;
}

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const RUNS = Number(arg('runs', 1000));
const MAX_TURNS = Number(arg('turns', 600));
const REPLAY = argv.indexOf('--replay') >= 0 ? Number(arg('replay', 0)) : null;
const JSON_OUT = arg('json', null);
// both (default) runs each cohort at half the total, so --runs 1000 is 1000.
const POLICY = arg('policy', 'both');
const FAIL_ON_WARN = argv.includes('--strict');

const RZ = loadGame();

/* ---------- how the automated player chooses ----------

   "random" is a coin: it exposes what the rules do to somebody with no plan.
   It is the honest null hypothesis, and it almost never reaches high office —
   which means it cannot measure anything that only happens up there.

   "directed" is the least clever competent player I can write: it spends its
   month on whatever standing the next rung is actually short of, and contests
   whenever the rules allow. It is not optimal play. It exists so the late-game
   mechanics — amendments, SADC, the presidency — get exercised at all.

   This map is a property of the test, not of the game: it is one line of
   opinion about what each action mostly builds.
*/
const BUILDS = {
  walkabout: ['grassroots'], funerals: ['grassroots'], church: ['grassroots'],
  radio: ['grassroots', 'media'], social: ['media', 'fame'], youth: ['fame', 'grassroots'],
  union: ['grassroots', 'party'], factions: ['party'], delegates: ['party'],
  courtleader: ['leader'], lobbyList: ['leader'], securocrats: ['security'],
  media: ['media'], book: ['media', 'fame'], policy: ['intellect', 'media'],
  parliament: ['media', 'party'], fundraise: ['business'], patron: ['business', 'leader'],
  tender: ['business'], donors: ['intl'], diaspora: ['intl'], study: ['intellect'],
  campaign: ['grassroots', 'fame'], rest: [], oppo: [], leak: [], bury: [], rehab: []
};

// Actions that reliably leave a file behind. The appointment score subtracts
// up to 34 points for exposed scandal, which is more than the requirements are
// worth — so a player who wants a cabinet post cannot take these at all.
const DIRTY = new Set(['patron', 'tender', 'leak', 'oppo']);

function chooseAction(RZ, S, acts, policy) {
  if (policy === 'random') return acts[Math.floor(RZ.rnd() * acts.length)];

  // Go home before the body makes the decision for you.
  if (S.player.health < 34) {
    const rest = acts.filter((a) => a.id === 'rest');
    if (rest.length) return rest[0];
  }

  // Clean up before building, or the building is wasted.
  const exposed = S.player.dirt.filter((d) => d.exposed).length;
  if (exposed >= 2) {
    const clean = acts.filter((a) => a.id === 'bury' || a.id === 'rehab');
    if (clean.length && RZ.rnd() < 0.5) return clean[Math.floor(RZ.rnd() * clean.length)];
  }
  acts = acts.filter((a) => !DIRTY.has(a.id));
  if (!acts.length) return null;

  const rung = RZ.engine.nextRung(S);
  const missing = rung ? RZ.engine.meetsRequirements(S, rung).missing.map((m) => m.k) : [];
  if (!missing.length) return acts[Math.floor(RZ.rnd() * acts.length)];

  const useful = acts.filter((a) => (BUILDS[a.id] || []).some((k) => missing.includes(k)));
  const pool = useful.length ? useful : acts;
  // Still a coin, but a coin thrown at the right wall.
  return pool[Math.floor(RZ.rnd() * pool.length)];
}

/* ---------- one career ---------- */
function playCareer(seed, { trace = false, policy = 'random' } = {}) {
  const cid = RZ.COUNTRY_ORDER[seed % RZ.COUNTRY_ORDER.length];
  const c = RZ.COUNTRIES[cid];
  RZ.seed(seed);

  const S = RZ.engine.newGame({
    countryId: cid,
    seed,
    name: 'Subject ' + seed,
    gender: seed % 2 ? 'm' : 'f',
    regionId: c.regions[seed % c.regions.length].id,
    bgId: RZ.BACKGROUNDS[seed % RZ.BACKGROUNDS.length].id,
    partyId: c.parties[seed % Math.min(2, c.parties.length)].id
  });

  const r = {
    seed, policy, country: cid, turns: 0, peakTier: 0, peakRung: 0,
    becamePresident: false, monthsAsPresident: 0,
    ending: null, sadcTurn: null, collapses: 0, shocks: 0,
    crossings: 0, purges: 0, amendmentsTried: 0, amendmentsPassed: 0,
    coalitionCollapses: 0, elections: 0, promisesMade: 0, promisesBroken: 0,
    tendersGranted: 0, tendersRefused: 0, patronsAtEnd: 0,
    capital: 0, integrity: 0, money: 0, dirt: 0, health: 0, age: 0,
    log: []
  };
  const say = (t) => { if (trace) r.log.push(`t${S.turn} ${t}`); };

  const govBefore = () => (S.nation.govParties || []).slice().sort().join(',');
  let lastGov = govBefore();

  while (!S.over && r.turns < MAX_TURNS) {
    // ---- spend the month ----
    let guard = 0;
    while (S.actionsLeft > 0 && guard++ < 12) {
      const acts = RZ.engine.availableActions(S);
      if (!acts.length) break;
      const pick = chooseAction(RZ, S, acts, policy);
      if (!pick) { S.actionsLeft--; continue; }

      // The two special sheets need their own resolution; a random player
      // picks a random amendment and a random amount of whipping.
      if (pick.id === 'amend') {
        const api = RZ.engine.mkApi(S);
        const list = RZ.gov.amendmentsFor(api);
        if (!list.length) { S.actionsLeft--; continue; }
        const am = list[Math.floor(RZ.rnd() * list.length)];
        const res = RZ.gov.attemptAmendment(api, am.id, Math.floor(RZ.rnd() * 40));
        r.amendmentsTried++;
        if (res.passed) { r.amendmentsPassed++; say(`amendment ${am.id} carried`); }
        S.actionsLeft--; S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
        continue;
      }
      if (pick.id === 'budget') {
        const b = { health: 14, education: 16, infra: 14, security: 13, social: 13, debtsvc: 14, admin: 16 };
        RZ.gov.applyBudget(S, b);
        S.actionsLeft--; S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
        continue;
      }

      let out;
      try { out = RZ.engine.doAction(S, pick.id); }
      catch (e) { throw new Error(`action "${pick.id}" threw in ${cid}: ${e.message}`); }
      if (!out) { S.actionsLeft--; continue; }
      if (out.fail) { S.actionsLeft--; continue; }

      if (out.dialogue) {
        const cv = out.dialogue;
        let g2 = 0;
        while (!cv.done && g2++ < 12) {
          const usable = RZ.dialogue.options(cv).filter((o) => o.ok);
          if (!usable.length) break;
          RZ.dialogue.choose(cv, usable[Math.floor(RZ.rnd() * usable.length)].i);
        }
        RZ.engine.finishDialogue(S, cv);
      }
      if (pick.id === 'defect') { r.crossings++; say('crossed the floor'); }
    }

    // ---- the month turns ----
    let turnOut;
    try { turnOut = RZ.engine.endTurn(S); }
    catch (e) { throw new Error(`endTurn threw in ${cid} at turn ${S.turn}: ${e.message}`); }
    r.turns++;

    if (turnOut.collapsed) { r.collapses++; say('medical collapse'); }
    if (turnOut.purge && turnOut.purge.purged) { r.purges++; say('purged from the slate'); }

    // ---- whatever is on the table ----
    if (S.pendingEvent) {
      const ev = S.pendingEvent;
      const ok = (ev.choices || []).filter((x) => x.ok);
      if (ok.length) {
        const ch = ok[Math.floor(RZ.rnd() * ok.length)];
        const before = S.capture ? S.capture.granted : 0;
        try { RZ.engine.resolveEvent(S, ch.i); }
        catch (e) { throw new Error(`event "${ev.id}" choice ${ch.i} threw: ${e.message}`); }
        if (S.capture && S.capture.granted > before) say('granted a tender');
      } else {
        S.pendingEvent = null;
      }
    }

    if (turnOut.election) {
      r.elections++;
      try {
        RZ.gov.runElection(S, { rig: false });
      } catch (e) { throw new Error(`election threw in ${cid}: ${e.message}`); }
    }

    // ---- a random player contests whenever it is offered ----
    const st = RZ.engine.contestStatus(S);
    if (st.available && RZ.rnd() < (policy === 'random' ? 0.75 : 1)) {
      try { RZ.engine.contest(S); } catch (e) { /* the rules said no */ }
    }

    // ---- observations ----
    const nowGov = govBefore();
    if (nowGov !== lastGov && lastGov) r.coalitionCollapses++;
    lastGov = nowGov;

    if (S.player.isPresident) { r.becamePresident = true; r.monthsAsPresident++; }
    const tier = RZ.ladderFor(cid)[S.player.rungIdx].tier || 0;
    if (tier > r.peakTier) r.peakTier = tier;
    if (S.player.rungIdx > r.peakRung) r.peakRung = S.player.rungIdx;
  }

  const P = S.player;
  r.ending = S.ending || (r.turns >= MAX_TURNS ? 'ranout' : 'unknown');
  r.sadcTurn = S.flags.sadcTurn ?? null;
  r.shocks = S.flags.shocks || 0;
  r.collapses = Math.max(r.collapses, S.flags.collapses || 0);
  r.amendmentsTried = Math.max(r.amendmentsTried, S.flags.amendmentsTried || 0);
  r.promisesMade = (P.promises || []).length;
  r.promisesBroken = (P.promises || []).filter((x) => (x.bites || 0) > 0).length;
  r.tendersGranted = S.capture ? S.capture.granted : 0;
  r.tendersRefused = S.capture ? S.capture.refused : 0;
  r.patronsAtEnd = S.capture ? S.capture.patrons.filter((x) => x.owed > 0.5).length : 0;
  r.capital = Math.round(P.capital);
  r.integrity = Math.round(P.stats.integrity);
  r.money = Math.round(P.money);
  r.dirt = P.dirt.length;
  r.health = Math.round(P.health);
  r.age = P.age;
  r.rungTitle = RZ.ladderFor(cid)[r.peakRung].title;
  return r;
}

/* ---------- replay one seed loudly ---------- */
if (REPLAY !== null) {
  const r = playCareer(REPLAY, { trace: true, policy: POLICY === 'both' ? 'directed' : POLICY });
  console.log(`seed ${r.seed} · ${RZ.COUNTRIES[r.country].name}`);
  console.log(`peaked at: ${r.rungTitle} (tier ${r.peakTier})`);
  console.log(`ended: ${r.ending} after ${r.turns} months, age ${r.age}`);
  console.log(`president: ${r.becamePresident ? r.monthsAsPresident + ' months' : 'no'}`);
  console.log(`collapses ${r.collapses} · shocks ${r.shocks} · purges ${r.purges} · crossings ${r.crossings}`);
  console.log(`promises ${r.promisesMade} (${r.promisesBroken} broken) · tenders ${r.tendersGranted}/${r.tendersRefused}`);
  console.log(`capital ${r.capital} · integrity ${r.integrity} · dirt ${r.dirt}`);
  if (r.log.length) console.log('\n' + r.log.join('\n'));
  process.exit(0);
}

/* ---------- the run ---------- */
const t0 = Date.now();
const cohorts = POLICY === 'both' ? ['random', 'directed'] : [POLICY];
const per = Math.max(1, Math.floor(RUNS / cohorts.length));
const all = {};
let threw = 0;
const firstErrors = [];
let done = 0;

for (const policy of cohorts) {
  const rows = [];
  for (let i = 0; i < per; i++) {
    try {
      rows.push(playCareer(i + 1, { policy }));
    } catch (e) {
      threw++;
      if (firstErrors.length < 5) firstErrors.push(`${policy} seed ${i + 1}: ${e.message}`);
    }
    done++;
    if (RUNS >= 100 && done % Math.max(1, Math.floor(RUNS / 20)) === 0) {
      process.stdout.write(`\r  ${done}/${per * cohorts.length} careers…`);
    }
  }
  all[policy] = rows;
}
process.stdout.write('\r' + ' '.repeat(34) + '\r');

// A career that throws is a bug, whatever the balance looks like.
if (threw) {
  console.error(`\n${threw} careers threw:`);
  firstErrors.forEach((e) => console.error('  ' + e));
  console.error('\nA rules change has broken something. Replay one with --replay <seed>.');
  process.exit(1);
}

/* ---------- the report ---------- */
const allWarnings = [];
for (const policy of cohorts) report(policy, all[policy]);

console.log('');
if (allWarnings.length) {
  console.log('WORTH LOOKING AT');
  allWarnings.forEach((w) => console.log('  ! ' + w));
} else {
  console.log('Nothing out of range.');
}

if (JSON_OUT) {
  fs.writeFileSync(JSON_OUT, JSON.stringify({ runs: RUNS, maxTurns: MAX_TURNS, cohorts: all }, null, 2));
  console.log(`\nwrote ${JSON_OUT}`);
}
if (FAIL_ON_WARN && allWarnings.length) process.exit(1);

function report(policy, results) {
const n = results.length;
const sum = (f) => results.reduce((t, r) => t + f(r), 0);
const mean = (f) => sum(f) / n;
const pct = (f) => (100 * results.filter(f).length) / n;
const quantile = (f, q) => {
  const v = results.map(f).sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(v.length * q))];
};
const fmt = (x, d = 1) => Number(x).toFixed(d);
const bar = (p, w = 24) => '█'.repeat(Math.round((p / 100) * w)).padEnd(w, '·');

console.log(`\n${'='.repeat(58)}\n${policy.toUpperCase()} — ${n} careers, up to ${MAX_TURNS} months each\n${'='.repeat(58)}\n`);

console.log('OUTCOMES');
const endings = {};
results.forEach((r) => { endings[r.ending] = (endings[r.ending] || 0) + 1; });
Object.entries(endings).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k.padEnd(14)} ${String(v).padStart(5)}  ${fmt((100 * v) / n)}%  ${bar((100 * v) / n)}`);
});

console.log('\nHOW FAR THEY GOT');
console.log(`  reached the top office   ${fmt(pct((r) => r.becamePresident))}%`);
console.log(`  peak tier  median ${quantile((r) => r.peakTier, 0.5)}  p90 ${quantile((r) => r.peakTier, 0.9)}  max ${quantile((r) => r.peakTier, 1)}`);
console.log(`  months in office (of those who got there): ${
  results.some((r) => r.becamePresident)
    ? fmt(sum((r) => r.monthsAsPresident) / results.filter((r) => r.becamePresident).length, 0)
    : 'n/a'}`);
console.log(`  career length  median ${quantile((r) => r.turns, 0.5)} months  p90 ${quantile((r) => r.turns, 0.9)}`);

console.log('\nTHE NEW MECHANICS  (how often each one actually fires)');
const sadc = results.filter((r) => r.ending === 'sadc');
console.log(`  SADC intervention        ${fmt(pct((r) => r.ending === 'sadc'))}%  ${
  sadc.length ? `avg at month ${fmt(sadc.reduce((t, r) => t + (r.sadcTurn ?? r.turns), 0) / sadc.length, 0)}` : '(never fired)'}`);
console.log(`  medical collapse         ${fmt(pct((r) => r.collapses > 0))}% of careers, ${fmt(mean((r) => r.collapses), 2)} per career`);
console.log(`  black swan shock         ${fmt(pct((r) => r.shocks > 0))}% of careers, ${fmt(mean((r) => r.shocks), 2)} per career`);
console.log(`  congress purge           ${fmt(pct((r) => r.purges > 0))}% of careers, ${fmt(mean((r) => r.purges), 2)} per career`);
console.log(`  crossed the floor        ${fmt(pct((r) => r.crossings > 0))}%`);
console.log(`  coalition collapses      ${fmt(mean((r) => r.coalitionCollapses), 2)} per career`);
console.log(`  amendments  tried ${fmt(mean((r) => r.amendmentsTried), 2)}/career, carried ${
  sum((r) => r.amendmentsTried) ? fmt((100 * sum((r) => r.amendmentsPassed)) / sum((r) => r.amendmentsTried)) + '%' : 'n/a'}`);
console.log(`  promises made ${fmt(mean((r) => r.promisesMade), 2)}, broken ${fmt(mean((r) => r.promisesBroken), 2)} per career`);
console.log(`  tenders  granted ${fmt(mean((r) => r.tendersGranted), 2)}  refused ${fmt(mean((r) => r.tendersRefused), 2)} per career`);
console.log(`  still owing somebody at the end: ${fmt(pct((r) => r.patronsAtEnd > 0))}%`);

console.log('\nWHAT THEY ENDED UP AS');
console.log(`  capital    median ${quantile((r) => r.capital, 0.5)}  p90 ${quantile((r) => r.capital, 0.9)}`);
console.log(`  integrity  median ${quantile((r) => r.integrity, 0.5)}  p10 ${quantile((r) => r.integrity, 0.1)}  p90 ${quantile((r) => r.integrity, 0.9)}`);
console.log(`  dirt       median ${quantile((r) => r.dirt, 0.5)}  p90 ${quantile((r) => r.dirt, 0.9)}`);

console.log('\nBY COUNTRY  (reached top office / SADC)');
RZ.COUNTRY_ORDER.forEach((cid) => {
  const rows = results.filter((r) => r.country === cid);
  if (!rows.length) return;
  const top = (100 * rows.filter((r) => r.becamePresident).length) / rows.length;
  const sd = (100 * rows.filter((r) => r.ending === 'sadc').length) / rows.length;
  console.log(`  ${cid}  n=${String(rows.length).padStart(4)}  top ${fmt(top).padStart(5)}%  sadc ${fmt(sd).padStart(5)}%`);
});

/* ---------- things that would be bugs, not taste ----------
   Only the directed cohort is held to the reachability bars: a coin-flipping
   player failing to become president is the expected result, not a defect.
*/
const w = (t) => allWarnings.push(`[${policy}] ${t}`);
if (policy === 'directed') {
  // These two are downstream of the same thing: no automated policy in this
  // harness reaches the presidency, so anything gated on holding it is never
  // exercised here. mechanics.mjs builds those states directly and proves the
  // triggers work; this is a note about the harness, not a failing assertion.
  if (pct((r) => r.becamePresident) < 1) {
    w('no career reached the top office — the late game is unmeasured here (see mechanics.mjs)');
  }
  if (sum((r) => r.amendmentsTried) === 0) {
    w('no amendment attempted — president-only, so unreachable in this harness (see mechanics.mjs)');
  }
  // At roughly 1-2% of careers, a short run legitimately sees none.
  if (!sadc.length && n * (MAX_TURNS / 480) >= 300) {
    w('SADC intervention never fired in a run large enough to expect it');
  }
}
if (policy === 'random' && pct((r) => r.becamePresident) > 45) {
  w('a coin-flipping player becomes president too often');
}
if (pct((r) => r.ending === 'sadc') > 12) w('SADC intervention is ending too many careers');
if (mean((r) => r.shocks) < 0.15) w('black swan shocks are too rare to matter');
// A random player never rests, so a high collapse rate there is the mechanic
// working. The bar that matters is whether a player who does rest can hold it.
if (policy === 'directed' && mean((r) => r.collapses) > 4) {
  w('medical collapse fires often even for a player who rests');
}
if (policy === 'directed' && pct((r) => r.collapses > 0) < 5) {
  w('medical collapse almost never fires — the threshold may be unreachable');
}
if (pct((r) => r.purges > 0) > 85) w('the congress purge hits nearly everybody');
if (mean((r) => r.promisesMade) === 0) w('no promises were ever made — the ledger is unreachable');
}
