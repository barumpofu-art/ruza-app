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
  'data-events.js', 'data-dialogue.js', 'data-origins.js', 'people.js', 'elections.js',
  'engine.js', 'governance.js', 'dialogue.js', 'crisis.js', 'sprint.js', 'revolt.js', 'constituency.js', 'statecraft.js', 'legislation.js'
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

  // Eight weeks out, the seat is the only thing that matters. Blitz the ward
  // you are losing, and keep the taxis booked.
  if (S.tempo === 'week' && S.sprint) {
    if (S.player.health < 30) {
      const sleep = acts.filter((a) => a.id === 'sleep');
      if (sleep.length) return sleep[0];
    }
    // Fund the campaign before spending it. A week spent raising is a week not
    // spent canvassing, which is the trade the war chest exists to create.
    const api = RZ.engine.mkApi(S);
    const weekly = api.wage(1.2 + api.tier() * 0.35);
    if (RZ.sprint.warFunds(S) < weekly * 2) {
      const fav = acts.filter((a) => a.id === 'favours');
      if (fav.length) return fav[0];
      // Clean money is exhausted and the ballot is close. This is the moment
      // the whole funding design is about, so the policy has to actually face
      // it rather than fundraise its way round it.
      if (S.sprint.week >= 3) {
        const chq = acts.filter((a) => a.id === 'cheque');
        if (chq.length) return chq[0];
      }
      const br = acts.filter((a) => a.id === 'branchraise');
      if (br.length) return br[0];
    }
    const logistics = acts.filter((a) => a.id === 'transport' || a.id === 'agents');
    if (logistics.length && RZ.rnd() < 0.25) return logistics[Math.floor(RZ.rnd() * logistics.length)];
    const blitz = acts.filter((a) => a.id === 'blitz');
    if (blitz.length) return blitz[0];
  }

  // A bill on the order paper owns the four weeks it has. Count once, buy the
  // room that is closest, and drop a clause when the arithmetic will not come.
  if (S.tempo === 'week' && S.bill) {
    const t = RZ.bill.count(S);
    if (!S.bill.counted) {
      const cnt = acts.filter((a) => a.id === 'billcount');
      if (cnt.length) return cnt[0];
    }
    if (t.short && S.bill.weeksLeft <= 1) {
      const con = acts.filter((a) => a.id === 'billconcede');
      if (con.length) return con[0];
    }
    const whip = acts.filter((a) => a.id === 'billwhip');
    if (whip.length) return whip[0];
  }

  // A member with capital and a majority in reach puts their own name on
  // something. It is the only way the record ever says what you were for.
  if (RZ.bill && RZ.bill.canDraft(S) && S.player.capital >= 30 && RZ.rnd() < 0.35) {
    const d = acts.filter((a) => a.id === 'draft');
    if (d.length) return d[0];
  }

  // Go home before the body makes the decision for you.
  if (S.player.health < 34) {
    const rest = acts.filter((a) => a.id === 'rest');
    if (rest.length) return rest[0];
  }

  // A brigade is being discussed on your border. Everything else can wait —
  // this is what the warning window exists for, and a policy that ignores it
  // cannot tell us whether the window is wide enough to survive.
  if (S.flags && S.flags.sadcWarned) {
    const dip = acts.filter((a) => ['summit', 'donors', 'diaspora'].includes(a.id));
    if (dip.length && S.player.standing.intl < 20) return dip[Math.floor(RZ.rnd() * dip.length)];
    const calm = acts.filter((a) => ['address', 'security'].includes(a.id));
    if (calm.length) return calm[Math.floor(RZ.rnd() * calm.length)];
  }

  // The ways past the bottleneck. A competent player takes a revolt when the
  // room is with them, and does not take one when it is not.
  if (RZ.revolt && RZ.revolt.canRevolt(S)) {
    const odds = RZ.revolt.revoltOdds(S);
    const canRevolt = acts.filter((a) => a.id === 'revolt');
    if (odds && odds.pct >= 62 && canRevolt.length) return canRevolt[0];
  }
  // A file is worth more spent on a seat than kept, once the seat is in reach.
  {
    const bm = acts.filter((a) => a.id === 'blackmail');
    if (bm.length && RZ.rnd() < 0.5) return bm[0];
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
    sprints: 0, blitzes: 0, weeklyTurns: 0, bestPoll: 0, swings: [],
    billsTabled: 0, billsPassed: 0, billsLost: 0, billsLapsed: 0,
    blocsWorked: 0, blocsPledged: 0, concessions: 0,
    revolts: 0, revoltsWon: 0, exiled: 0, apologies: 0, blackmails: 0,
    raised: 0, spentOwn: 0, dirtyShares: [], audits: 0, brokeWeeks: 0, cheques: 0, favours: 0,
    sadcWarned: 0,
    mandates: 0, nemesisMoves: 0,
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
      // Blitzing needs a ward chosen before it resolves. A directed player
      // goes where it is losing; a coin goes anywhere.
      if (pick.id === 'blitz') {
        const wards = (S.sprint && S.sprint.wards) || [];
        if (!wards.length) { S.actionsLeft--; continue; }
        const w = policy === 'directed'
          ? wards.slice().sort((a, b) => a.support - b.support)[0]
          : wards[Math.floor(RZ.rnd() * wards.length)];
        RZ.sprint.blitz(S, w.id, RZ.engine.mkApi(S));
        r.blitzes++;
        S.actionsLeft--; S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
        continue;
      }
      // The order paper: tabling picks a bill, whipping picks a room and a
      // lever, conceding picks who the clause is for.
      if (pick.id === 'draft') {
        const bills = RZ.bill.BILLS;
        const b = policy === 'directed'
          ? bills[seed % bills.length]
          : bills[Math.floor(RZ.rnd() * bills.length)];
        RZ.bill.table(S, RZ.engine.mkApi(S), b.id);
        r.billsTabled++;
        say('tabled ' + b.id);
        S.actionsLeft--; S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
        continue;
      }
      if (pick.id === 'billwhip') {
        const blocs = (S.bill && S.bill.blocs) || [];
        const open = blocs.filter((x) => !x.pledged);
        if (!open.length) { S.actionsLeft--; continue; }
        // Directed: the room closest to pledging, bought with whatever is to hand.
        const target = policy === 'directed'
          ? open.slice().sort((a, b) => b.lean - a.lean)[0]
          : open[Math.floor(RZ.rnd() * open.length)];
        const api = RZ.engine.mkApi(S);
        let how = 'charm';
        if (policy === 'directed') {
          if (S.player.capital >= 20) how = 'capital';
        } else {
          how = ['capital', 'charm', 'extort'][Math.floor(RZ.rnd() * 3)];
        }
        const wr = RZ.bill.workBloc(S, api, target.id, how);
        if (wr) { r.blocsWorked++; if (wr.pledged) r.blocsPledged++; }
        S.actionsLeft--; S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
        continue;
      }
      if (pick.id === 'billconcede') {
        const open = ((S.bill && S.bill.blocs) || []).filter((x) => !x.pledged);
        if (!open.length) { S.actionsLeft--; continue; }
        const target = open.slice().sort((a, b) => b.seats - a.seats)[0];
        RZ.bill.concede(S, RZ.engine.mkApi(S), target.id);
        r.concessions++;
        S.actionsLeft--; S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
        continue;
      }
      // A surge needs a ward before it can spend the war chest on one.
      if (pick.id === 'surge') {
        const wards = (S.sprint && S.sprint.wards) || [];
        const open = wards.filter((w) => !w.held);
        if (!open.length) { S.actionsLeft--; continue; }
        const w = open.slice().sort((a, b) => Math.abs(50 - a.support) - Math.abs(50 - b.support))[0];
        RZ.sprint.surge(S, w.id, RZ.engine.mkApi(S));
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
      if (pick.id === 'revolt') { r.revolts++; say('challenged the incumbent'); }
      if (pick.id === 'cheque') r.cheques++;
      if (pick.id === 'favours') r.favours++;
      if (S.sprint && RZ.sprint.warFunds(S) <= 0) r.brokeWeeks++;
      if (pick.id === 'blackmail') { r.blackmails++; say('traded the file for the seat'); }
    }

    // ---- the month turns ----
    let turnOut;
    try { turnOut = RZ.engine.endTurn(S); }
    catch (e) { throw new Error(`endTurn threw in ${cid} at turn ${S.turn}: ${e.message}`); }
    r.turns++;

    if (S.tempo === 'week') r.weeklyTurns++;
    if (turnOut.sprintStarted) { r.sprints++; say('the sprint began'); }
    if (turnOut.billResult) {
      if (turnOut.billResult.passed) { r.billsPassed++; say(turnOut.billResult.name + ' carried'); }
      else { r.billsLost++; say(turnOut.billResult.name + ' lost'); }
    }
    if (turnOut.billLapsed) { r.billsLapsed++; say('a bill fell with the House'); }
    if (turnOut.sprintResult && turnOut.sprintResult.finalTally) {
      r.bestPoll = Math.max(r.bestPoll, turnOut.sprintResult.finalTally.support);
      if (typeof turnOut.sprintResult.swing === 'number') r.swings.push(turnOut.sprintResult.swing);
      const w = turnOut.sprintResult.war;
      if (w) { r.raised += w.raised; r.spentOwn += w.personal; if (w.raised) r.dirtyShares.push(w.dirty / w.raised); }
    }
    if (S.flags.sadcWarned) r.sadcWarned = 1;
    if (turnOut.nemesis && turnOut.nemesis.move) r.nemesisMoves++;
    if (turnOut.collapsed) { r.collapses++; say('medical collapse'); }
    if (turnOut.purge && turnOut.purge.purged) { r.purges++; say('purged from the slate'); }

    // ---- whatever is on the table ----
    if (S.pendingEvent) {
      const ev = S.pendingEvent;
      if (ev.audit) r.audits++;
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
  r.mandates = S.flags.mandates || 0;
  r.exiled = S.flags.exiled ? 1 : 0;
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

// ---- reachability, across every cohort ----
{
  const every = cohorts.flatMap((p) => all[p]);
  const any = (f) => every.some(f);
  if (!any((r) => r.becamePresident)) {
    allWarnings.push('[all] no career in any cohort reached the top office — the ladder may still be capped');
  }
  if (!any((r) => r.amendmentsTried > 0)) {
    allWarnings.push('[all] no amendment attempted in any cohort — president-only, see mechanics.mjs');
  }
  // Reaching the warning is the reachability question. Whether the brigade
  // then crosses is up to the player, and mechanics.mjs proves both endings.
  if (!any((r) => r.sadcWarned)) {
    allWarnings.push('[all] no career ever reached the SADC warning — its trigger may be unreachable');
  }
  const top = every.filter((r) => r.becamePresident).length;
  console.log(`\nACROSS BOTH COHORTS\n  reached the top office   ${top} of ${every.length}` +
    ` (${((100 * top) / every.length).toFixed(1)}%)  ·  best rung seen: tier ${Math.max(...every.map((r) => r.peakTier))}`);
}

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
console.log(`  SADC: warned ${fmt(pct((r) => r.sadcWarned))}% of careers, ended ${fmt(pct((r) => r.ending === 'sadc'))}%  ${
  sadc.length ? `(avg at month ${fmt(sadc.reduce((t, r) => t + (r.sadcTurn ?? r.turns), 0) / sadc.length, 0)})`
              : '— every warned career got out of it'}`);
console.log(`  medical collapse         ${fmt(pct((r) => r.collapses > 0))}% of careers, ${fmt(mean((r) => r.collapses), 2)} per career`);
console.log(`  black swan shock         ${fmt(pct((r) => r.shocks > 0))}% of careers, ${fmt(mean((r) => r.shocks), 2)} per career`);
console.log(`  congress purge           ${fmt(pct((r) => r.purges > 0))}% of careers, ${fmt(mean((r) => r.purges), 2)} per career`);
console.log(`  crossed the floor        ${fmt(pct((r) => r.crossings > 0))}%`);
console.log(`  coalition collapses      ${fmt(mean((r) => r.coalitionCollapses), 2)} per career`);
console.log(`  campaign sprints         ${fmt(mean((r) => r.sprints), 2)} per career, ${fmt(mean((r) => r.weeklyTurns), 1)} weekly turns`);
console.log(`  ward blitzes             ${fmt(mean((r) => r.blitzes), 1)} per career`);
console.log(`  mandates won             ${fmt(mean((r) => r.mandates), 2)} per career`);
console.log(`  caucus revolts           ${fmt(mean((r) => r.revolts), 2)} per career, ${fmt(pct((r) => r.exiled > 0))}% ended in exile`);
console.log(`  files traded for a seat  ${fmt(mean((r) => r.blackmails), 2)} per career`);
console.log(`  nemesis moves            ${fmt(mean((r) => r.nemesisMoves), 1)} per career`);
{
  const ds = results.flatMap((r) => r.dirtyShares);
  ds.sort((a, b) => a - b);
  const perCamp = Math.max(1, sum((r) => r.sprints));
  console.log(`  raised per campaign      ${fmt(sum((r) => r.raised) / perCamp, 0)}`);
  console.log(`  own money per campaign   ${fmt(sum((r) => r.spentOwn) / perCamp, 0)}` +
    `  (${fmt(sum((r) => r.spentOwn) / Math.max(1, sum((r) => r.raised)), 2)}x what was raised)`);
  console.log(`  dirty share of a chest   ${ds.length ? fmt(100 * ds[Math.floor(ds.length / 2)], 1) + '% median, ' + fmt(100 * ds[ds.length - 1], 1) + '% worst' : 'none'}`);
  console.log(`  late cheques / favours   ${fmt(mean((r) => r.cheques), 2)} / ${fmt(mean((r) => r.favours), 2)} per career`);
  console.log(`  commission audits        ${fmt(mean((r) => r.audits), 2)} per career`);
}
console.log(`  campaign poll at close   ${fmt(quantile((r) => r.bestPoll, 0.5), 1)}% median, ${fmt(quantile((r) => r.bestPoll, 0.1), 1)}% p10, ${fmt(quantile((r) => r.bestPoll, 0.9), 1)}% p90`);
{
  const sw = results.flatMap((r) => r.swings).sort((a, b) => a - b);
  console.log(`  swing over the 8 weeks   ${sw.length ? fmt(sw[Math.floor(sw.length / 2)], 1) + ' pts median, ' +
    fmt(sw[0], 1) + ' worst, ' + fmt(sw[sw.length - 1], 1) + ' best' : 'none recorded'}`);
}
console.log(`  bills  tabled ${fmt(mean((r) => r.billsTabled), 2)}/career, carried ${
  sum((r) => r.billsPassed) + sum((r) => r.billsLost)
    ? fmt((100 * sum((r) => r.billsPassed)) / (sum((r) => r.billsPassed) + sum((r) => r.billsLost))) + '%'
    : 'n/a'}${sum((r) => r.billsLapsed) ? ', ' + sum((r) => r.billsLapsed) + ' fell with the House' : ''}`);
if (sum((r) => r.billsTabled)) {
  console.log(`  the whipping             ${fmt(mean((r) => r.blocsWorked), 1)} blocs worked, ${
    fmt(mean((r) => r.blocsPledged), 1)} pledged, ${fmt(mean((r) => r.concessions), 2)} clauses dropped per career`);
}
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
  // Reachability is checked once across every cohort, below: a route that only
  // one policy finds is still a route.
  // At roughly 1-2% of careers, a short run legitimately sees none.
  if (!sadc.length && n * (MAX_TURNS / 480) >= 300) {
    w('SADC intervention never fired in a run large enough to expect it');
  }
}
if (policy === 'random' && pct((r) => r.becamePresident) > 45) {
  w('a coin-flipping player becomes president too often');
}
// Only a concern for a policy that is actively trying to get out of it.
if (pct((r) => r.ending === 'sadc') > 12) w('SADC ends too many careers even for a player who reacts to the warning');
if (mean((r) => r.shocks) < 0.15) w('black swan shocks are too rare to matter');
// A random player never rests, so a high collapse rate there is the mechanic
// working. The bar that matters is whether a player who does rest can hold it.
// One collapse every five or six years for a player who only rests at the very
// last moment is the mechanic working, not misfiring.
if (policy === 'directed' && mean((r) => r.collapses) > 9) {
  w('medical collapse fires often even for a player who rests');
}
if (policy === 'directed' && pct((r) => r.collapses > 0) < 5) {
  w('medical collapse almost never fires — the threshold may be unreachable');
}
if (pct((r) => r.purges > 0) > 85) w('the congress purge hits nearly everybody');
if (mean((r) => r.promisesMade) === 0) w('no promises were ever made — the ledger is unreachable');
if (mean((r) => r.sprints) === 0) w('the campaign sprint never started — its trigger may be unreachable');
if (mean((r) => r.sprints) > 0 && mean((r) => r.blitzes) === 0) w('the sprint runs but no ward was ever blitzed');
if (policy === 'directed' && mean((r) => r.billsTabled) === 0) {
  w('no bill was ever tabled — the order paper may be unreachable');
}
{
  const tried = sum((r) => r.billsPassed) + sum((r) => r.billsLost);
  if (tried >= 20) {
    const rate = sum((r) => r.billsPassed) / tried;
    if (rate > 0.95) w('almost every bill carries — four weeks of whipping is not a real fight');
    if (rate < 0.06) w('almost no bill carries — the House may be unwinnable');
  }
}
}
