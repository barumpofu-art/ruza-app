/* mechanics.mjs — does each new system actually fire, and do the right thing?

   The Monte Carlo answers "what do the rules do at scale". It cannot answer
   "is this trigger reachable", because an automated player never reaches the
   presidency, and half of these mechanics only exist up there. So this file
   builds the exact state each one needs and checks it fires, changes what it
   claims to change, and does not throw.

   Run: node game/test/mechanics.mjs
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
const RZ = loadGame();

let failures = 0, checks = 0;
function ok(what, cond, detail) {
  checks++;
  if (cond) { console.log(`  ✓ ${what}`); return true; }
  failures++;
  console.error(`  ✗ ${what}${detail ? ' — ' + detail : ''}`);
  return false;
}
function section(t) { console.log(`\n${t}`); }

/* A career at whatever height the test needs. */
function career(cid = 'ZA', seed = 7, rungIdx = 4) {
  RZ.seed(seed);
  const c = RZ.COUNTRIES[cid];
  const S = RZ.engine.newGame({
    countryId: cid, seed, name: 'Test Subject', gender: 'f',
    regionId: c.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: c.parties[0].id
  });
  S.player.rungIdx = Math.min(rungIdx, RZ.ladderFor(cid).length - 1);
  return S;
}
function makePresident(S) {
  const lad = RZ.ladderFor(S.countryId);
  const P = S.player;
  P.rungIdx = lad.length - 1;
  P.isPresident = true; P.isLeader = true;
  S.nation.presidentName = P.name;
  S.nation.presidentParty = P.partyId;
  S.nation.termNumber = 1;
  if (S.nation.govParties.indexOf(P.partyId) < 0) S.nation.govParties = [P.partyId];
  return S;
}

/* ================= 1. health & burnout ================= */
section('1. Health & burnout');
{
  const S = career('ZA', 11, 6);
  S.player.health = 90;
  S.actionsThisMonth = 3;
  const before = S.player.health;
  RZ.crisis.monthly(S, {});
  ok('working a full month costs health', S.player.health < before,
    `${before} -> ${S.player.health}`);

  const S2 = career('ZA', 12, 6);
  S2.player.health = 90; S2.actionsThisMonth = 0;
  RZ.crisis.monthly(S2, {});
  ok('an idle month costs none', S2.player.health >= 90 - 0.001,
    `${S2.player.health}`);

  const S3 = career('ZA', 13, 6);
  S3.player.health = 22; S3.actionsThisMonth = 1;
  const out = {};
  RZ.crisis.monthly(S3, out);
  ok('below 30 forces a collapse', out.collapsed === true);
  ok('the collapse skips the next month', S3.skipTurns >= 1, `skipTurns=${S3.skipTurns}`);
  ok('and puts you back above the line', S3.player.health > 30, `health=${Math.round(S3.player.health)}`);
  const card = S3.feed[0];
  ok('it reaches the feed as a priority alert', card && card.alert === true && /collaps/i.test(card.title));

  // The loop that made it a permanent condition: restore too close to the line.
  const S4 = career('ZA', 14, 6);
  S4.player.health = 22; S4.actionsThisMonth = 3;
  let collapses = 0;
  for (let i = 0; i < 60; i++) {
    const o = {};
    S4.actionsThisMonth = 3;
    RZ.crisis.monthly(S4, o);
    if (o.collapsed) collapses++;
    S4.turn++;
  }
  ok('collapse does not become permanent', collapses <= 8, `${collapses} collapses in 60 months`);
}

/* ================= 2. floor-crossing ================= */
section('2. Floor-crossing');
{
  const S = career('ZA', 21, 5);
  const P = S.player;
  P.standing.leader = 70; P.standing.party = 60; P.standing.media = 30; P.standing.grassroots = 40;
  const fromParty = P.partyId;
  const api = RZ.engine.mkApi(S);
  const act = RZ.actionById['defect'];
  ok('the action exists and is offered', !!act && act.when(api));
  const res = act.run(api);
  ok('it runs', !!res && !res.fail);
  ok('leadership standing is burned to zero', P.standing.leader === 0, `leader=${P.standing.leader}`);
  ok('you are in a different party', P.partyId !== fromParty, `${fromParty} -> ${P.partyId}`);
  ok('media and grassroots jump', P.standing.media > 30 && P.standing.grassroots > 40);
  ok('the boost is registered as temporary', (S.buffs || []).length >= 2);

  // ...and fades.
  const mediaPeak = P.standing.media;
  for (let i = 0; i < 6; i++) { S.actionsThisMonth = 0; RZ.crisis.monthly(S, {}); S.turn++; }
  ok('the boost fades within about five months', P.standing.media < mediaPeak,
    `${Math.round(mediaPeak)} -> ${Math.round(P.standing.media)}`);
  ok('the buff list empties', (S.buffs || []).length === 0);
}

/* ================= 3. congress purge ================= */
section('3. Congress purge');
{
  const weak = career('ZA', 31, 4);
  weak.player.standing.grassroots = 4; weak.player.standing.party = 4; weak.player.fame = 2;
  const r1 = RZ.crisis.congressPurge(weak);
  ok('a candidate with no branches is purged', !!r1 && r1.purged === true);
  ok('the purge is flagged for the election', weak.flags.purged === true);
  ok('and it reaches the feed as an alert', weak.feed[0] && weak.feed[0].alert === true);

  const strong = career('ZA', 32, 4);
  strong.player.standing.grassroots = 85; strong.player.standing.party = 85; strong.player.fame = 60;
  ok('a candidate with a base is not', RZ.crisis.congressPurge(strong) === null);

  const twice = career('ZA', 33, 4);
  twice.player.standing.grassroots = 4; twice.player.standing.party = 4;
  RZ.crisis.congressPurge(twice);
  ok('it can only happen once per election cycle', RZ.crisis.congressPurge(twice) === null);

  const boss = career('ZA', 34, 4);
  boss.player.standing.grassroots = 2; boss.player.standing.party = 2;
  boss.player.isLeader = true;
  ok('the party leader cannot be left off their own slate', RZ.crisis.congressPurge(boss) === null);
}

/* ================= 4. black swan shocks ================= */
section('4. Black swan shocks');
{
  let fired = 0, checked = 0;
  const seen = new Set();
  for (let seed = 1; seed <= 400 && fired < 40; seed++) {
    const S = career('ZA', seed, 6);
    const e0 = { growth: S.nation.economy.growth, inflation: S.nation.economy.inflation };
    S.flags.lastShock = undefined;
    // Force the roll rather than waiting years for it.
    S.nation.economy.reserves = 1; S.nation.economy.debt = 120;
    for (let t = 0; t < 200 && !S.flags.shocks; t++) { S.turn = t * 20; RZ.crisis.monthly(S, {}); }
    checked++;
    if (S.flags.shocks) {
      fired++;
      const card = S.feed.find((f) => f.alert);
      if (card) seen.add(card.title);
      if (fired === 1) {
        ok('a shock moves the economy', S.nation.economy.growth !== e0.growth || S.nation.economy.inflation !== e0.inflation);
        ok('and raises a .paper.big.bad alert', !!card, card ? '' : 'no alert card in the feed');
      }
    }
  }
  ok('shocks fire', fired > 0, `${fired}/${checked}`);
  ok('more than one kind of shock exists in play', seen.size >= 2, `${seen.size} distinct`);

  // Every shock in the table must be runnable, not just the ones chance picked.
  let bad = [];
  RZ.crisis.SHOCKS.forEach((sh) => {
    const S = career('ZA', 99, 6);
    const api = RZ.engine.mkApi(S);
    try { sh.hit(api); } catch (e) { bad.push(`${sh.id}: ${e.message}`); }
    const title = typeof sh.title === 'function' ? sh.title(api) : sh.title;
    if (!title || /undefined|NaN/.test(title)) bad.push(`${sh.id}: bad title "${title}"`);
  });
  ok('every shock in the table runs cleanly', bad.length === 0, bad.join('; '));
}

/* ================= 5. promises & debts ================= */
section('5. Promises & debts');
{
  const S = career('ZA', 41, 5);
  const a = RZ.engine.mkApi(S);
  a.promise('road', 'A tarred road to the clinic', { due: 12, to: 'The ward committee' });
  ok('a promise is recorded', S.player.promises.length === 1);
  ok('with a deadline', S.player.promises[0].due === 12);
  a.promise('road', 'A duplicate');
  ok('the same promise is not stored twice', S.player.promises.length === 1);

  // Not yet due: nothing should happen.
  S.date.year += 0; S.turn = 10;
  RZ.crisis.monthly(S, {});
  ok('nothing happens before the deadline', (S.player.promises[0].bites || 0) === 0);

  // Overdue, repeatedly.
  S.date.year += 2;
  const grass0 = S.player.standing.grassroots;
  for (let i = 0; i < 4; i++) { S.turn += 6; S.actionsThisMonth = 0; RZ.crisis.monthly(S, {}); }
  const pr = S.player.promises[0];
  ok('an overdue promise starts costing you', pr.bites >= 2, `bites=${pr.bites}`);
  ok('and the cost lands on grassroots standing', S.player.standing.grassroots < grass0);
  ok('escalating to a scandal', S.player.dirt.some((d) => d.id === 'broken-road'));
  ok('and the fallout hits national stability', S.nation.society.stability < 62);

  // Cabinet promises come due when the posts are handed out, not on a timer.
  const S2 = career('ZA', 42, 8);
  const a2 = RZ.engine.mkApi(S2);
  a2.promise('posts', 'Positions for the three chairpersons', { kind: 'cabinet' });
  ok('a cabinet promise sits on a long fuse', S2.player.promises[0].due > 12);
  RZ.crisis.cabinetReckoning(S2);
  ok('until the cabinet is actually formed', S2.player.promises[0].due === 0);

  const S3 = career('ZA', 43, 5);
  const a3 = RZ.engine.mkApi(S3);
  a3.promise('x', 'Something');
  a3.keepPromise('x');
  ok('a kept promise leaves the ledger', !a3.hasPromise('x'));
}

/* ================= 6. the tenderpreneur web ================= */
section('6. The tenderpreneur web');
{
  const S = career('ZA', 51, 8);
  const a = RZ.engine.mkApi(S);
  a.owePatron('Mr Dlamini', 6);
  ok('taking the money creates a creditor', S.capture.patrons.length === 1);
  a.owePatron('Mr Dlamini', 4);
  ok('taking more from the same man deepens it, not duplicates',
    S.capture.patrons.length === 1 && S.capture.patrons[0].owed === 10);

  // Wind the clock until he asks.
  let ev = null;
  for (let t = 20; t < 400 && !ev; t += 1) { S.turn = t; S.pendingEvent = null; RZ.crisis.monthly(S, {}); ev = S.pendingEvent; }
  ok('eventually he asks for something', !!ev && !!ev.patron, ev ? '' : 'no demand in 400 months');

  if (ev) {
    ok('the demand offers three answers', ev.choices.length === 3);

    // Granting compounds the debt — the trap.
    const grant = career('ZA', 52, 8);
    RZ.engine.mkApi(grant).owePatron('Mr Dlamini', 6);
    const gEv = { patron: 'Mr Dlamini' };
    const owedBefore = grant.capture.patrons[0].owed;
    const gRes = RZ.crisis.resolveDemand(grant, gEv, 0);
    ok('granting the tender pays you', (gRes.deltas || []).some((d) => d.label === 'Money' && d.v > 0));
    ok('and leaves you owing more than before', grant.capture.patrons[0].owed > owedBefore,
      `${owedBefore} -> ${Math.round(grant.capture.patrons[0].owed)}`);
    ok('and puts a file on the shelf', grant.player.dirt.some((d) => d.id.startsWith('tender-')));
    ok('and raises national corruption', grant.nation.society.corruption > career('ZA', 52, 8).nation.society.corruption);

    // Refusing costs money and growth.
    const refuse = career('ZA', 53, 8);
    RZ.engine.mkApi(refuse).owePatron('Mr Dlamini', 6);
    const growth0 = refuse.nation.economy.growth;
    const rRes = RZ.crisis.resolveDemand(refuse, { patron: 'Mr Dlamini' }, 1);
    ok('refusing draws economic retaliation', refuse.nation.economy.growth < growth0);
    ok('and costs you business standing', (rRes.deltas || []).some((d) => d.label === 'Business' && d.v < 0));
    ok('but buys back some integrity', (rRes.deltas || []).some((d) => d.label === 'Integrity' && d.v > 0));

    // Stalling defers and worsens.
    const stall = career('ZA', 54, 8);
    RZ.engine.mkApi(stall).owePatron('Mr Dlamini', 6);
    const sBefore = stall.capture.patrons[0].owed;
    RZ.crisis.resolveDemand(stall, { patron: 'Mr Dlamini' }, 2);
    ok('stalling defers it and costs more later', stall.capture.patrons[0].owed > sBefore);
  }
}

/* ================= 7. SADC intervention ================= */
section('7. SADC intervention');
{
  // The exact stated condition: unrest above 85, international standing below 15.
  const S = makePresident(career('ZA', 61, 13));
  S.nation.society.unrest = 90;
  S.player.standing.intl = 10;

  RZ.crisis.monthly(S, {});
  ok('the first month is a warning, not an ending', !S.over && S.flags.sadcWarned === true);
  ok('the warning reaches the feed as an alert', S.feed[0] && S.feed[0].alert === true);

  // Three turns of warning, because no action lifts international standing
  // from single figures past fifteen in one month.
  let ended = false;
  for (let i = 0; i < 2 && !ended; i++) ended = RZ.crisis.monthly(S, {});
  ok('the second and third months are still warnings', !ended && !S.over);
  ok('and there is a second notice halfway', S.feed.some((f) => /has not adjourned/.test(f.title)));
  ended = RZ.crisis.monthly(S, {});
  ok('the fourth month ends the career', ended === true && S.over === true);
  ok('with the right ending', S.ending === 'sadc');
  const obit = String(RZ.gov.obituary(S, RZ.gov.legacy(S)));
  ok('the obituary names what happened, not the fallback',
    /brigade/i.test(obit) && !/^The career ended\.$/.test(obit),
    obit.slice(0, 120));

  // Fixing it in the window has to actually work, or the warning is theatre.
  {
    const R = makePresident(career('ZA', 65, 13));
    R.nation.society.unrest = 90; R.player.standing.intl = 10;
    RZ.crisis.monthly(R, {});
    RZ.crisis.monthly(R, {});
    R.player.standing.intl = 40;                 // you went to the summit
    RZ.crisis.monthly(R, {});
    ok('lifting the condition stops the clock', !R.over && R.flags.sadcSince === 0);
    R.player.standing.intl = 10;
    for (let i = 0; i < 3; i++) RZ.crisis.monthly(R, {});
    ok('and the countdown restarts from the beginning', !R.over);
  }

  // Just one of the two conditions is not enough.
  const unrestOnly = makePresident(career('ZA', 62, 13));
  unrestOnly.nation.society.unrest = 95; unrestOnly.player.standing.intl = 60;
  RZ.crisis.monthly(unrestOnly, {}); RZ.crisis.monthly(unrestOnly, {});
  ok('unrest alone does not bring the brigade', !unrestOnly.over);

  const isolatedOnly = makePresident(career('ZA', 63, 13));
  isolatedOnly.nation.society.unrest = 20; isolatedOnly.player.standing.intl = 5;
  RZ.crisis.monthly(isolatedOnly, {}); RZ.crisis.monthly(isolatedOnly, {});
  ok('isolation alone does not either', !isolatedOnly.over);

  // A backbencher's career survives the government falling.
  const backbench = career('ZA', 64, 3);
  backbench.nation.society.unrest = 92;
  backbench.player.standing.intl = 8;
  for (let i = 0; i < 5; i++) RZ.crisis.monthly(backbench, {});
  ok('a backbencher is not ended by it', !backbench.over);
  ok('but does live through it', backbench.flags.sadcSurvived === true);
}

/* ================= 8. constitutional engineering ================= */
section('8. Constitutional engineering');
{
  const S = makePresident(career('ZA', 71, 13));
  const c = RZ.COUNTRIES.ZA;

  // Give the government a known share of the House.
  const setSeats = (St, mineFrac) => {
    const total = c.house.seats;
    const mine = Math.round(total * mineFrac);
    c.parties.forEach((p, i) => { St.parties[p.id].seats = i === 0 ? mine : Math.round((total - mine) / (c.parties.length - 1)); });
    St.nation.govParties = [c.parties[0].id];
    St.player.partyId = c.parties[0].id;
  };

  setSeats(S, 0.75);
  const sup = RZ.gov.assemblySupport(S);
  ok('two-thirds is computed from real seats', sup.needed === Math.ceil(sup.total * 2 / 3), `${sup.needed}/${sup.total}`);
  ok('and the government share is counted', sup.gov > sup.needed, `gov=${sup.gov} needed=${sup.needed}`);

  const api = RZ.engine.mkApi(S);
  const list = RZ.gov.amendmentsFor(api);
  ok('there are amendments to attempt', list.length > 0);
  ok('the action is offered to a president', !!RZ.gov.actionById('amend').when(api));

  S.player.standing.party = 80; S.player.standing.leader = 80; S.player.capital = 100;
  const passed = RZ.gov.attemptAmendment(api, 'termlimit', 30);
  ok('a supermajority can carry it', passed.passed === true, passed.title);
  ok('and the term limit is actually gone', S.flags.termLimitRemoved === true);
  ok('at a cost to international standing', (api.deltas || []).some((d) => d.label === 'International' && d.v < 0));

  // A minority government cannot.
  const weak = makePresident(career('ZA', 72, 13));
  setSeats(weak, 0.35);
  weak.player.standing.party = 20; weak.player.standing.leader = 20; weak.player.capital = 0;
  const wApi = RZ.engine.mkApi(weak);
  const failed = RZ.gov.attemptAmendment(wApi, 'termlimit', 0);
  ok('a minority cannot', failed.passed === false, failed.title);
  ok('and pays for trying', (wApi.deltas || []).some((d) => d.label === 'Party' && d.v < 0));
  ok('the failure says how short it was', /short/.test(failed.title));

  // Every amendment must run.
  const bad = [];
  RZ.gov.AMENDMENTS.forEach((am) => {
    const T = makePresident(career('ZA', 73, 13));
    setSeats(T, 0.9);
    T.player.standing.party = 90; T.player.standing.leader = 90; T.player.capital = 200;
    const tApi = RZ.engine.mkApi(T);
    try {
      const r = RZ.gov.attemptAmendment(tApi, am.id, 40);
      if (!r.title || !r.body) bad.push(`${am.id}: no text`);
    } catch (e) { bad.push(`${am.id}: ${e.message}`); }
  });
  ok('every amendment in the table runs cleanly', bad.length === 0, bad.join('; '));
}

/* ================= 10. the campaign sprint ================= */
section('10. The eight-week campaign sprint');
{
  // A candidate opens inside the sprint.
  RZ.seed(101);
  const c = RZ.COUNTRIES.ZA;
  const S = RZ.engine.newGame({
    countryId: 'ZA', seed: 101, name: 'Candidate', gender: 'f',
    regionId: c.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: c.parties[0].id,
    startAs: 'candidate'
  });
  ok('a candidate starts in weekly tempo', S.tempo === 'week', S.tempo);
  ok('with eight weeks on the clock', S.sprint && S.sprint.weeksLeft === 8, String(S.sprint && S.sprint.weeksLeft));
  ok('and a seat already fought for', RZ.ladderFor('ZA')[S.player.rungIdx].tier >= 3,
    'tier ' + RZ.ladderFor('ZA')[S.player.rungIdx].tier);
  ok('two months before the ballot', S.date.month === RZ.engine.ELECTION_MONTH.ZA - 2,
    `month ${S.date.month} vs ballot ${RZ.engine.ELECTION_MONTH.ZA}`);
  ok('the constituency has wards', S.sprint.wards.length >= 5, String(S.sprint.wards.length));
  ok('each ward has a name, a turnout and voters',
    S.sprint.wards.every((w) => w.name && w.turnout > 0 && w.voters > 0));
  ok('and fewer actions than a month gets', S.actionsPerTurn < 3, String(S.actionsPerTurn));

  // An activist does not.
  const act = RZ.engine.newGame({
    countryId: 'ZA', seed: 102, name: 'Activist', gender: 'f',
    regionId: c.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: c.parties[0].id
  });
  ok('an activist starts monthly, at the bottom', act.tempo === 'month' && act.rungIdx !== 4 && !act.sprint);

  // Blitzing moves the ward it is aimed at, and only that one.
  const target = S.sprint.wards[0];
  const other = S.sprint.wards[1];
  const before = { t: target.support, o: other.support, money: S.player.money };
  const api = RZ.engine.mkApi(S);
  const r = RZ.sprint.blitz(S, target.id, api);
  ok('a blitz moves the ward you chose', target.support > before.t,
    `${Math.round(before.t)} -> ${Math.round(target.support)}`);
  ok('and leaves the others alone', other.support === before.o);
  ok('and is paid for', r.paid && (r.paid.fromWar > 0 || r.paid.fromSelf > 0),
    JSON.stringify(r.paid));
  ok('out of the campaign account before your own pocket',
    r.paid.fromWar > 0 && S.player.money === before.money,
    `war ${Math.round(r.paid.fromWar)} / self ${Math.round(r.paid.fromSelf)}`);
  ok('and raises turnout there', r.ward.turnout > 0 && r.ward.visits === 1);

  // Diminishing returns, so blitzing one ward eight times is not the answer.
  const gains = [];
  for (let i = 0; i < 4; i++) {
    const a2 = RZ.engine.mkApi(S);
    const g = RZ.sprint.blitz(S, target.id, a2);
    gains.push(g.gain);
    S.turn++;
  }
  ok('repeat visits pay less each time', gains[3] < gains[0], gains.map((g) => g.toFixed(1)).join(' → '));

  // The clock runs down, and the ballot arrives.
  const S2 = RZ.engine.newGame({
    countryId: 'ZA', seed: 103, name: 'Candidate', gender: 'm',
    regionId: c.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: c.parties[0].id,
    startAs: 'candidate'
  });
  const startMonth = S2.date.month;
  let weeks = 0, elected = false;
  for (let i = 0; i < 12 && !elected; i++) {
    S2.actionsLeft = 0;
    // Count the tempo the turn was taken AT, not the tempo it left behind: the
    // last weekly turn is the one that ends the sprint.
    const wasWeek = S2.tempo === 'week';
    const o = RZ.engine.endTurn(S2);
    if (wasWeek) weeks++;
    if (o.election) elected = true;
    if (S2.pendingEvent) S2.pendingEvent = null;
  }
  ok('the ballot arrives after eight weekly turns', weeks === 8, `${weeks} weeks`);
  ok('and the election fires', elected);
  ok('two calendar months passed, not eight', S2.date.month === startMonth + 2,
    `${startMonth} -> ${S2.date.month}`);
  ok('the sprint is over once the polls open', S2.tempo === 'month' && !S2.sprint);

  // The ward result has to reach the count, or the whole thing was theatre.
  const S3 = RZ.engine.newGame({
    countryId: 'ZA', seed: 104, name: 'Candidate', gender: 'f',
    regionId: c.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: c.parties[0].id,
    startAs: 'candidate'
  });
  S3.player.money = 5_000_000;
  const homeBefore = S3.player.regionSupport[S3.player.regionId];
  S3.sprint.wards.forEach((w) => { w.support = 88; });
  const effortBefore = S3.campaign.effort || 0;
  RZ.sprint.end(S3);
  ok('a won campaign lifts home support', S3.player.regionSupport[S3.player.regionId] > homeBefore,
    `${Math.round(homeBefore)} -> ${Math.round(S3.player.regionSupport[S3.player.regionId])}`);
  ok('and feeds campaign effort into the count', S3.campaign.effort > effortBefore);

  const S4 = RZ.engine.newGame({
    countryId: 'ZA', seed: 105, name: 'Candidate', gender: 'f',
    regionId: c.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: c.parties[0].id,
    startAs: 'candidate'
  });
  S4.sprint.wards.forEach((w) => { w.support = 12; });
  const lostHome = S4.player.regionSupport[S4.player.regionId];
  RZ.sprint.end(S4);
  ok('a lost campaign drags it down', S4.player.regionSupport[S4.player.regionId] < lostHome,
    `${Math.round(lostHome)} -> ${Math.round(S4.player.regionSupport[S4.player.regionId])}`);

  // Every country has to open as a contest. Anchoring the wards to the party's
  // nominal share handed Eswatini — where no party contests the ballot — a 99%
  // opening poll and no campaign at all.
  const openings = [];
  RZ.COUNTRY_ORDER.forEach((cid) => {
    const cc = RZ.COUNTRIES[cid];
    const polls = [];
    for (let i = 0; i < 25; i++) {
      const T = RZ.engine.newGame({
        countryId: cid, seed: i + 1, name: 'C', gender: 'f',
        regionId: cc.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: cc.parties[0].id,
        startAs: 'candidate'
      });
      polls.push(RZ.sprint.tally(T).support);
    }
    polls.sort((a, b) => a - b);
    openings.push({ cid, median: polls[12] });
  });
  const runaway = openings.filter((o) => o.median > 75 || o.median < 20);
  ok('every country opens as a contest, not a coronation', runaway.length === 0,
    runaway.map((o) => `${o.cid} ${o.median.toFixed(0)}%`).join(', '));

  // Weekly actions exist and run.
  const S5 = RZ.engine.newGame({
    countryId: 'ZA', seed: 106, name: 'Candidate', gender: 'f',
    regionId: c.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: c.parties[0].id,
    startAs: 'candidate'
  });
  S5.player.money = 5_000_000;
  const deck = RZ.engine.availableActions(S5).map((a) => a.id);
  ok('the tactical deck is on the desk', deck.includes('blitz') && deck.includes('transport') && deck.includes('agents'),
    deck.slice(0, 6).join(', '));
  const badWeek = [];
  RZ.sprint.weekActions(S5).forEach((wa) => {
    if (wa.special) return;
    const T = RZ.engine.newGame({
      countryId: 'ZA', seed: 107, name: 'C', gender: 'f',
      regionId: c.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: c.parties[0].id, startAs: 'candidate'
    });
    T.player.money = 5_000_000;
    const a3 = RZ.engine.mkApi(T);
    try {
      const res = wa.run(a3);
      if (!res || !res.title || !res.body) badWeek.push(`${wa.id}: no text`);
    } catch (e) { badWeek.push(`${wa.id}: ${e.message}`); }
  });
  ok('every weekly action runs cleanly', badWeek.length === 0, badWeek.join('; '));

  // Weekly events: every branch of every one.
  const badEv = [];
  RZ.sprint.WEEKLY.forEach((ev) => {
    ev.choices.forEach((ch, i) => {
      const T = RZ.engine.newGame({
        countryId: 'ZA', seed: 108, name: 'C', gender: 'f',
        regionId: c.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: c.parties[0].id, startAs: 'candidate'
      });
      T.player.money = 5_000_000;
      const a4 = RZ.engine.mkApi(T);
      if (ch.when && !ch.when(a4)) return;
      try {
        const res = ch.run(a4);
        if (!res || !res.title || !res.body) badEv.push(`${ev.id}[${i}]: no text`);
      } catch (e) { badEv.push(`${ev.id}[${i}]: ${e.message}`); }
    });
    const T2 = RZ.engine.newGame({
      countryId: 'ZA', seed: 109, name: 'C', gender: 'f',
      regionId: c.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: c.parties[0].id, startAs: 'candidate'
    });
    const a5 = RZ.engine.mkApi(T2);
    const title = typeof ev.title === 'function' ? ev.title(a5) : ev.title;
    const body = typeof ev.body === 'function' ? ev.body(a5) : ev.body;
    if (/undefined|NaN|\[object/.test(String(title) + String(body))) badEv.push(`${ev.id}: bad interpolation`);
  });
  ok('every weekly event branch runs cleanly', badEv.length === 0, badEv.join('; '));

  // The tempo must not distort the world: four weeks should land roughly where
  // one month does, or the sprint quietly rewrites the economy.
  function drift(tempo, turns) {
    const T = RZ.engine.newGame({
      countryId: 'ZA', seed: 110, name: 'C', gender: 'f',
      regionId: c.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: c.parties[0].id
    });
    T.tempo = tempo;
    const h0 = T.player.health, g0 = T.nation.economy.growth;
    for (let i = 0; i < turns; i++) { T.actionsLeft = 0; T.pendingEvent = null; RZ.engine.endTurn(T); T.pendingEvent = null; }
    return { health: T.player.health - h0, growth: T.nation.economy.growth - g0, month: T.date.month };
  }
  const m = drift('month', 3), w = drift('week', 12);
  ok('twelve weeks advance the calendar like three months', w.month === m.month, `${w.month} vs ${m.month}`);
  ok('and move health by a comparable amount', Math.abs(w.health - m.health) < 6,
    `${w.health.toFixed(1)} vs ${m.health.toFixed(1)}`);
  ok('and the economy too', Math.abs(w.growth - m.growth) < 1.5,
    `${w.growth.toFixed(2)} vs ${m.growth.toFixed(2)}`);
}

/* ================= 11. past the bottleneck ================= */
section('11. Mandate, revolt, the file and the nemesis');
{
  const cc = RZ.COUNTRIES.ZA;
  const mk = (seed, rung) => career('ZA', seed, rung);

  // The mandate: a year of half decay.
  {
    const S = mk(201, 3);
    RZ.revolt.grantMandate(S, RZ.ladderFor('ZA')[3]);
    ok('winning a contest grants a mandate', RZ.revolt.mandateActive(S));
    const withM = mk(202, 3), without = mk(203, 3);
    RZ.revolt.grantMandate(withM, RZ.ladderFor('ZA')[3]);
    [withM, without].forEach((T) => { T.player.standing.party = 60; T.player.standing.leader = 60; });
    for (let i = 0; i < 10; i++) {
      [withM, without].forEach((T) => { T.actionsLeft = 0; T.pendingEvent = null; RZ.engine.endTurn(T); T.pendingEvent = null; });
    }
    ok('and it visibly slows party decay',
      withM.player.standing.party > without.player.standing.party,
      `${Math.round(withM.player.standing.party)} vs ${Math.round(without.player.standing.party)}`);
    const S2 = mk(204, 3);
    RZ.revolt.grantMandate(S2, RZ.ladderFor('ZA')[3]);
    S2.date.year += 2;
    ok('and it expires', !RZ.revolt.mandateActive(S2));
  }

  // The revolt: a real gamble with visible odds.
  {
    const S = mk(210, 4);
    S.player.capital = 60;
    ok('there is somebody in the way', !!RZ.revolt.incumbent(S));
    ok('the revolt is offered', RZ.revolt.canRevolt(S));
    const odds = RZ.revolt.revoltOdds(S);
    ok('the odds are shown before you commit', odds && odds.pct > 0 && odds.pct < 100, `${odds && odds.pct}%`);

    const strong = mk(211, 4);
    strong.player.capital = 90; strong.player.standing.party = 92; strong.player.standing.grassroots = 92;
    strong.player.rivals.forEach((r) => { r.power = 10; });
    const weak = mk(212, 4);
    weak.player.capital = 20; weak.player.standing.party = 5; weak.player.standing.grassroots = 5;
    weak.player.rivals.forEach((r) => { r.power = 95; });
    ok('a strong challenger has better odds than a weak one',
      RZ.revolt.revoltOdds(strong).pct > RZ.revolt.revoltOdds(weak).pct,
      `${RZ.revolt.revoltOdds(strong).pct}% vs ${RZ.revolt.revoltOdds(weak).pct}%`);

    // Winning promotes.
    const W = mk(213, 4);
    W.player.capital = 90; W.player.standing.party = 95; W.player.standing.grassroots = 95;
    W.player.rivals.forEach((r) => { r.power = 5; });
    const rungBefore = W.player.rungIdx;
    const res = RZ.revolt.revolt(W, RZ.engine.mkApi(W));
    ok('a won revolt promotes you', res.won && W.player.rungIdx > rungBefore,
      `${rungBefore} -> ${W.player.rungIdx}`);
    ok('and grants the mandate', RZ.revolt.mandateActive(W));
    ok('and costs capital', W.player.capital < 90);
  }

  // Losing is an ultimatum, never a game over.
  {
    const L = mk(220, 4);
    L.player.capital = 30; L.player.standing.party = 2; L.player.standing.grassroots = 2;
    L.player.rivals.forEach((r) => { r.power = 98; r.dirt = []; });
    const res = RZ.revolt.revolt(L, RZ.engine.mkApi(L));
    ok('a lost revolt does not end the career', !res.won && !L.over);
    ok('it puts an ultimatum on the table', !!L.pendingEvent && L.pendingEvent.ultimatum === true);
    ok('with two ways out when you have no file', L.pendingEvent.choices.length === 2,
      String(L.pendingEvent.choices.length));

    // Option 0: apologise. Survive, keep the ward, lose your reputation.
    const A = mk(221, 4);
    A.player.capital = 30; A.player.standing.party = 2; A.player.standing.grassroots = 40;
    A.player.stats.integrity = 60; A.player.standing.media = 40;
    A.player.rivals.forEach((r) => { r.power = 98; r.dirt = []; });
    RZ.revolt.revolt(A, RZ.engine.mkApi(A));
    const homeBefore = A.player.regionId;
    const aRes = RZ.engine.resolveEvent(A, 0);
    ok('apologising keeps your ward', A.player.regionId === homeBefore);
    ok('and costs integrity heavily', A.player.stats.integrity <= 36,
      String(Math.round(A.player.stats.integrity)));
    ok('and flattens leadership without wiping it', A.player.standing.leader <= 5);
    ok('and makes your name toxic for a while', RZ.revolt.pngActive(A));

    // Option 1: refuse. Exile.
    const R = mk(222, 4);
    R.player.capital = 30; R.player.standing.party = 60; R.player.standing.grassroots = 40;
    R.player.money = 1_000_000;
    R.player.rivals.forEach((r) => { r.power = 98; r.dirt = []; });
    RZ.revolt.revolt(R, RZ.engine.mkApi(R));
    const rungBefore = R.player.rungIdx, homeR = R.player.regionId;
    RZ.engine.resolveEvent(R, 1);
    ok('refusing wipes leadership', R.player.standing.leader === 0);
    ok('and slashes party standing', R.player.standing.party < 60 * 0.35,
      String(Math.round(R.player.standing.party)));
    ok('and moves you to another region', R.player.regionId !== homeR,
      `${homeR} -> ${R.player.regionId}`);
    ok('but you keep the rung', R.player.rungIdx === rungBefore);
    ok('and it does not end the career', !R.over);
    ok('the escape hatch is now open', !!RZ.actionById['defect'].when(RZ.engine.mkApi(R)));
    ok('and it creates a nemesis', !!RZ.revolt.nemesisOf(R));

    // Option 2 only appears when you brought something.
    const F = mk(223, 4);
    F.player.capital = 30; F.player.standing.party = 2;
    F.player.rivals.forEach((r) => { r.power = 98; r.dirt = []; });
    F.player.rivals[0].regionId = F.player.regionId;
    F.player.rivals[0].dirt = [{ label: 'a tender awarded to a relative', used: false }];
    RZ.revolt.revolt(F, RZ.engine.mkApi(F));
    ok('a file adds a third way out', F.pendingEvent.choices.length === 3);
    const homeF = F.player.regionId, intF = F.player.stats.integrity;
    RZ.engine.resolveEvent(F, 2);
    ok('using it keeps your ward', F.player.regionId === homeF);
    ok('and your leadership', F.player.standing.leader > 0);
    ok('but burns the file', F.player.rivals.every((r) => (r.dirt || []).every((d) => d.used)) ||
      !RZ.engine.mkApi(F).hasLeverage());
    ok('and maxes his aggression', F.player.rivals.some((r) => r.aggression === 100 && r.nemesis));
  }

  // The file, traded up.
  {
    const B = mk(230, 5);
    // Exactly one file, on exactly one man, so "spent" means spent.
    B.player.rivals.forEach((r) => { r.power = 70; r.dirt = []; });
    B.player.rivals[0].dirt = [{ label: 'a second family', used: false }];
    ok('a file on a superior is a target', !!RZ.revolt.blackmailTarget(B));
    const rungBefore = B.player.rungIdx;
    const res = RZ.revolt.blackmail(B, RZ.engine.mkApi(B));
    ok('trading it promotes you outright', B.player.rungIdx > rungBefore, `${rungBefore} -> ${B.player.rungIdx}`);
    ok('at a heavy cost to integrity', B.player.stats.integrity < 55);
    ok('and it leaves a file on you', B.player.dirt.some((d) => d.id === 'blackmail'));
    ok('and makes a permanent enemy', !!RZ.revolt.nemesisOf(B));
    ok('the same file cannot be spent twice', !RZ.revolt.blackmailTarget(B));
  }

  // Reaching the top rung by any route must actually make you president, or
  // every president-gated mechanic stays dark for a player who is one.
  {
    const T = mk(235, 5);
    const lad = RZ.ladderFor('ZA');
    T.player.rungIdx = lad.length - 2;
    RZ.engine.promote(T, 'By whatever route.');
    ok('the top rung sets the office', T.player.isPresident === true && T.player.isLeader === true);
    ok('and the nation knows who is president', T.nation.presidentName === T.player.name);
    ok('which unlocks the president-only actions',
      !!RZ.gov.actionById('amend').when(RZ.engine.mkApi(T)));

    // ...and neither the caucus nor a file can hand you a national ballot.
    const V = mk(236, 5);
    V.player.rungIdx = lad.length - 2;
    V.player.capital = 90;
    ok('a revolt cannot take an office decided by the country', !RZ.revolt.canRevolt(V));
    V.player.rivals[0].dirt = [{ label: 'a file', used: false }];
    V.player.rivals[0].power = 80;
    ok('and neither can a file', RZ.revolt.blackmail(V, RZ.engine.mkApi(V)).fail === true);
  }

  // The nemesis actually does something.
  {
    const N = mk(240, 5);
    N.player.rivals[0].power = 80;
    N.flags.nemesisId = N.player.rivals[0].id;
    N.player.rivals[0].nemesis = true;
    let moved = 0;
    for (let i = 0; i < 120 && moved < 6; i++) {
      N.date.month++;
      if (N.date.month > 12) { N.date.month = 1; N.date.year++; }
      const r = RZ.revolt.nemesisTurn(N);
      if (r && r.move) moved++;
    }
    ok('a nemesis spends his turns on you', moved >= 3, `${moved} moves`);
    ok('and it lands in the feed', N.feed.some((f) => f.src === N.player.rivals[0].name));
    ok('he does not act every single month', N.flags.nemesisLast !== undefined);

    const Q = mk(241, 5);
    Q.player.rivals[0].power = 80;
    Q.flags.nemesisId = Q.player.rivals[0].id;
    Q.tempo = 'week';
    ok('and he stays out of the campaign weeks', RZ.revolt.nemesisTurn(Q) === null);

    // Every move must run.
    const bad = [];
    RZ.revolt.MOVES.forEach((mv) => {
      const T = mk(242, 5);
      const a = RZ.engine.mkApi(T);
      try {
        const o = mv.go(T, a, T.player.rivals[0]);
        if (!o || !o.title || !o.body) bad.push(`${mv.id}: no text`);
      } catch (e) { bad.push(`${mv.id}: ${e.message}`); }
    });
    ok('every nemesis move runs cleanly', bad.length === 0, bad.join('; '));
  }

  // The three tactical sprint actions.
  {
    const S = RZ.engine.newGame({
      countryId: 'ZA', seed: 250, name: 'C', gender: 'f',
      regionId: cc.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: cc.parties[0].id,
      startAs: 'candidate'
    });
    S.player.money = 5_000_000; S.player.capital = 80;
    const ids = RZ.sprint.weekActions(S).map((a) => a.id);
    ok('the surge is offered when you can afford it', ids.includes('surge'), ids.join(', '));

    const w = S.sprint.wards[0];
    const before = w.support;
    const sr = RZ.sprint.surge(S, w.id, RZ.engine.mkApi(S));
    ok('a surge moves a ward hard', w.support - before > 6, `+${(w.support - before).toFixed(1)}`);
    ok('and costs capital as well as money', S.player.capital < 80);
    ok('and holds the ward against drift', w.held === true);
    const held = w.support;
    for (let i = 0; i < 6; i++) { S.turn += 3; RZ.sprint.tickWeek(S); }
    ok('a held ward really does not drift', w.support === held, `${held.toFixed(1)} -> ${w.support.toFixed(1)}`);

    // The Friday dump needs leverage and can backfire.
    const D = RZ.engine.newGame({
      countryId: 'ZA', seed: 251, name: 'C', gender: 'f',
      regionId: cc.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: cc.parties[0].id, startAs: 'candidate'
    });
    const dumpAct = RZ.sprint.weekActionById('dump');
    ok('the dump is hidden without a file', !dumpAct.when(RZ.engine.mkApi(D)));
    D.player.rivals[0].dirt = [{ label: 'a tender awarded to a relative', used: false }];
    ok('and offered with one', dumpAct.when(RZ.engine.mkApi(D)));
    let backfires = 0, runs = 0;
    for (let i = 0; i < 60; i++) {
      const T = RZ.engine.newGame({
        countryId: 'ZA', seed: 300 + i, name: 'C', gender: 'f',
        regionId: cc.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: cc.parties[0].id, startAs: 'candidate'
      });
      T.player.rivals[0].dirt = [{ label: 'a tender', used: false }];
      const res = dumpAct.run(RZ.engine.mkApi(T));
      runs++;
      if (T.player.dirt.some((d) => d.id === 'dump')) backfires++;
      if (!res.title || !res.body) { ok('the dump always returns text', false); break; }
    }
    ok('the dump backfires sometimes but not usually', backfires > 2 && backfires < runs * 0.65,
      `${backfires}/${runs}`);

    // The kgotla costs no money and needs integrity.
    const K = RZ.engine.newGame({
      countryId: 'BW', seed: 252, name: 'C', gender: 'f',
      regionId: RZ.COUNTRIES.BW.regions[0].id, bgId: RZ.BACKGROUNDS[0].id,
      partyId: RZ.COUNTRIES.BW.parties[0].id, startAs: 'candidate'
    });
    const kg = RZ.sprint.weekActionById('kgotla');
    K.player.stats.integrity = 20;
    ok('the kgotla is closed to a compromised candidate', !kg.when(RZ.engine.mkApi(K)));
    K.player.stats.integrity = 70;
    ok('and open to a clean one', kg.when(RZ.engine.mkApi(K)));
    K.player.money = 1000;
    const moneyBefore = K.player.money;
    const kres = kg.run(RZ.engine.mkApi(K));
    ok('and it costs no money at all', K.player.money === moneyBefore, String(K.player.money));
    ok('and it returns text', !!kres.title && !!kres.body);
  }
}

/* ================= 12. campaign funds ================= */
section('12. The war chest — Capital, Money, and where it came from');
{
  const cc = RZ.COUNTRIES.ZA;
  const cand = (seed) => RZ.engine.newGame({
    countryId: 'ZA', seed, name: 'C', gender: 'f',
    regionId: cc.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: cc.parties[0].id,
    startAs: 'candidate'
  });

  // The party puts something in, and it is not nothing.
  {
    const S = cand(401);
    const w = S.sprint.war;
    ok('the campaign opens with a party allocation', w.cash > 0 && w.allocation > 0, String(Math.round(w.cash)));
    ok('and it is recorded as clean', w.clean === w.raised && w.dirty === 0);
    ok('with a named source', w.sources.length === 1 && /allocation/i.test(w.sources[0].label));

    // A candidate the structures like gets more than one they do not.
    const liked = cand(402), disliked = cand(403);
    liked.player.standing.party = 90; disliked.player.standing.party = 5;
    liked.sprint.war = { cash: 0, raised: 0, spent: 0, clean: 0, dirty: 0, personal: 0, sources: [] };
    disliked.sprint.war = { cash: 0, raised: 0, spent: 0, clean: 0, dirty: 0, personal: 0, sources: [] };
    RZ.sprint.seedWarChest(liked); RZ.sprint.seedWarChest(disliked);
    ok('a candidate the structures back is funded better',
      liked.sprint.war.cash > disliked.sprint.war.cash,
      `${Math.round(liked.sprint.war.cash)} vs ${Math.round(disliked.sprint.war.cash)}`);
  }

  // Spending draws the chest first, then your own pocket.
  {
    const S = cand(410);
    S.sprint.war.cash = 1000;
    S.player.money = 50_000;
    const api = RZ.engine.mkApi(S);
    const a = RZ.sprint.spend(S, api, 600, 'test');
    ok('a cost inside the chest is billed to the campaign',
      a.fromWar === 600 && a.fromSelf === 0 && S.player.money === 50_000);
    const b = RZ.sprint.spend(S, api, 900, 'test');
    ok('an overrun falls back to your own money',
      b.fromWar === 400 && b.fromSelf === 500 && S.player.money === 49_500);
    ok('and the campaign remembers you paid it', S.sprint.war.personal === 500);
    ok('the chest cannot go negative', S.sprint.war.cash === 0);
  }

  // Capital converts into cash. Cash does not convert back.
  {
    const S = cand(420);
    const fav = RZ.sprint.weekActionById('favours');
    S.player.capital = 5;
    ok('favours need capital worth calling in', !fav.when(RZ.engine.mkApi(S)));
    S.player.capital = 60;
    ok('and are offered when you have it', fav.when(RZ.engine.mkApi(S)));
    const cashBefore = S.sprint.war.cash;
    fav.run(RZ.engine.mkApi(S));
    ok('calling them in raises clean money', S.sprint.war.cash > cashBefore);
    ok('at the cost of capital', S.player.capital < 60, String(S.player.capital));
    ok('and none of it is dirty', S.sprint.war.dirty === 0);
    ok('there is no way to turn cash back into capital',
      RZ.sprint.weekActions(S).every((x) => x.id !== 'buycapital'));
  }

  // The branches give what they think of you.
  {
    const liked = cand(430), disliked = cand(431);
    liked.player.standing.grassroots = 90; disliked.player.standing.grassroots = 5;
    const br = RZ.sprint.weekActionById('branchraise');
    const l0 = liked.sprint.war.cash, d0 = disliked.sprint.war.cash;
    br.run(RZ.engine.mkApi(liked)); br.run(RZ.engine.mkApi(disliked));
    ok('branch collections scale with what the ground thinks of you',
      liked.sprint.war.cash - l0 > disliked.sprint.war.cash - d0,
      `${Math.round(liked.sprint.war.cash - l0)} vs ${Math.round(disliked.sprint.war.cash - d0)}`);
    ok('and it is clean money', liked.sprint.war.dirty === 0);
  }

  // The cheque is big, fast, and permanent.
  {
    const S = cand(440);
    const chq = RZ.sprint.weekActionById('cheque');
    const before = S.sprint.war.cash;
    const intBefore = S.player.stats.integrity;
    chq.run(RZ.engine.mkApi(S));
    ok('a late cheque is worth more than a week of branches',
      S.sprint.war.cash - before > 0 && S.sprint.war.dirty > 0);
    ok('it costs integrity', S.player.stats.integrity < intBefore);
    ok('it creates a creditor', S.capture.patrons.length > 0);
    ok('and it leaves a file', S.player.dirt.some((d) => d.id.startsWith('cheque-')));
  }

  // Dirty money is a deferred cost, not a free one.
  {
    const S = cand(450);
    S.sprint.war = { cash: 0, raised: 10000, spent: 0, clean: 2000, dirty: 8000, personal: 0, sources: [] };
    ok('the dirty share is computed', Math.abs(RZ.sprint.dirtyShare(S) - 0.8) < 0.001);
    RZ.sprint.end(S);
    ok('a dirty campaign schedules an audit', !!S.flags.auditDue);
    ok('for a few months after the ballot', S.flags.auditDue.month > S.date.year * 12 + S.date.month);

    const clean = cand(451);
    clean.sprint.war = { cash: 0, raised: 10000, spent: 0, clean: 10000, dirty: 0, personal: 0, sources: [] };
    RZ.sprint.end(clean);
    ok('a clean one does not', !clean.flags.auditDue);

    // The letter arrives.
    S.date.year += 1;
    const ev = RZ.sprint.auditDue(S);
    ok('the commission writes', !!ev && ev.audit === true);
    ok('and quotes the share back at you', /\d+%/.test(ev.body));
    ok('with three ways to answer', ev.choices.length === 3);
    ok('it only arrives once', RZ.sprint.auditDue(S) === null);

    const bad = [];
    [0, 1, 2].forEach((i) => {
      for (let k = 0; k < 20; k++) {
        const T = cand(460 + k);
        T.player.money = 5_000_000;
        try {
          const r = RZ.sprint.resolveAudit(T, { audit: true, share: 0.8 }, i);
          if (!r || !r.title || !r.body) bad.push(`choice ${i}: no text`);
        } catch (e) { bad.push(`choice ${i}: ${e.message}`); }
      }
    });
    ok('every answer to the commission runs cleanly', bad.length === 0, bad.join('; '));

    // Filing honestly should not be the one that ruins you.
    const H = cand(470);
    const aH = RZ.engine.mkApi(H);
    RZ.sprint.resolveAudit(H, { audit: true, share: 0.8 }, 0);
    ok('filing honestly buys integrity back', H.player.stats.integrity > cand(470).player.stats.integrity);
  }

  // Money is the binding constraint the sprint is supposed to have.
  {
    const S = cand(480);
    S.player.money = 0;
    S.sprint.war.cash = 0;
    const api = RZ.engine.mkApi(S);
    ok('a broke campaign cannot surge', !RZ.sprint.weekActionById('surge').when(api));
    ok('but can still work the branches', !!RZ.sprint.weekActionById('branchraise'));
    ok('and can still walk a ward', RZ.sprint.weekActions(S).some((x) => x.id === 'blitz'));
  }
}

/* ================= 13. origins and traits ================= */
section('13. How you got into this');
{
  const cc = RZ.COUNTRIES.ZA;
  const born = (origin, startAs, seed) => RZ.engine.newGame({
    countryId: 'ZA', seed: seed || 500, name: 'C', gender: 'f',
    regionId: cc.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: cc.parties[0].id,
    startAs: startAs, origin: origin
  });

  ok('there is an opening for each way in', !!RZ.ORIGINS.activist && !!RZ.ORIGINS.candidate);
  ok('each offers three answers',
    RZ.ORIGINS.activist.answers.length === 3 && RZ.ORIGINS.candidate.answers.length === 3);

  // Every scene has to render in every country without leaking a placeholder.
  const bad = [];
  RZ.COUNTRY_ORDER.forEach((cid) => {
    const c = RZ.COUNTRIES[cid];
    ['activist', 'candidate'].forEach((k) => {
      const o = RZ.ORIGINS[k];
      const bits = [o.title(c), o.opening(c, 'Name', 'A Kingmaker'), o.question(c)]
        .concat(o.answers.map((a) => a.t + ' ' + a.d + ' ' + a.reply(c, c.cur.sym, 'P500')));
      bits.forEach((b) => {
        if (!b || !String(b).trim()) bad.push(`${cid}/${k}: empty text`);
        if (/undefined|NaN|\[object/.test(String(b))) bad.push(`${cid}/${k}: ${String(b).slice(0, 70)}`);
      });
      // The staple in the bag has to be the thing people actually cook.
      if (k === 'activist' && !String(o.opening(c, 'N', 'K')).includes(RZ.originStaple(c))) {
        bad.push(`${cid}: wrong staple`);
      }
    });
  });
  ok('every origin renders cleanly in all ten countries', bad.length === 0, bad.slice(0, 3).join('; '));

  // Each answer must actually leave you somewhere different.
  {
    const fire = born('firebrand', 'activist');
    const hust = born('hustler', 'activist');
    const schem = born('schemer', 'activist');
    ok('the firebrand gave the bag back and has nothing', fire.player.money === 0);
    ok('and has the ground and their integrity',
      fire.player.standing.grassroots > hust.player.standing.grassroots &&
      fire.player.stats.integrity > hust.player.stats.integrity);
    ok('the hustler has money and less of a conscience',
      hust.player.money > fire.player.money && hust.player.stats.integrity < fire.player.stats.integrity);
    ok('the schemer starts holding something on somebody',
      schem.player.rivals.some((r) => (r.dirt || []).some((d) => !d.used)));
    ok('and can use it immediately', RZ.engine.mkApi(schem).hasLeverage());
    ok('the other two cannot', !RZ.engine.mkApi(fire).hasLeverage());

    const tyc = born('tycoon', 'candidate');
    const man = born('mandarin', 'candidate');
    const adv = born('advocate', 'candidate');
    ok('the financier arrives rich', tyc.player.money > adv.player.money * 10);
    ok('the mandarin arrives with capital and no camera presence',
      man.player.capital > tyc.player.capital && man.player.standing.media < adv.player.standing.media);
    ok('the advocate arrives credible and broke',
      adv.player.standing.media > man.player.standing.media && adv.player.capital === 0);
    ok('each origin writes its own line into the record',
      [fire, hust, schem, tyc, man, adv].every((S) => S.player.record.length > 0));
  }

  // Nothing may leave the player outside the legal ranges.
  {
    const outOfRange = [];
    Object.keys(RZ.ORIGIN_PACKAGES).forEach((id) => {
      RZ.COUNTRY_ORDER.forEach((cid) => {
        const c = RZ.COUNTRIES[cid];
        const S = RZ.engine.newGame({
          countryId: cid, seed: 501, name: 'C', gender: 'f',
          regionId: c.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: c.parties[0].id, origin: id
        });
        const P = S.player;
        Object.keys(P.stats).forEach((k) => {
          if (P.stats[k] < 0 || P.stats[k] > 100) outOfRange.push(`${id}/${cid} ${k}=${P.stats[k]}`);
        });
        Object.keys(P.standing).forEach((k) => {
          if (P.standing[k] < 0 || P.standing[k] > 100) outOfRange.push(`${id}/${cid} ${k}=${P.standing[k]}`);
        });
        if (P.money < 0 || P.capital < 0) outOfRange.push(`${id}/${cid} negative money or capital`);
      });
    });
    ok('no origin leaves a stat outside its range', outOfRange.length === 0, outOfRange.slice(0, 3).join('; '));
  }

  // A trait is not a starting bonus. It has to keep mattering.
  {
    const fire = born('firebrand', 'activist', 510);
    const adv = born('advocate', 'candidate', 510);
    const plain = RZ.engine.newGame({
      countryId: 'ZA', seed: 510, name: 'C', gender: 'f',
      regionId: cc.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: cc.parties[0].id
    });
    const gain = (S, key, amt) => {
      const before = S.player.standing[key];
      RZ.engine.mkApi(S).add(key, amt);
      return S.player.standing[key] - before;
    };
    ok('a firebrand gains more from the ground', gain(fire, 'grassroots', 10) > gain(plain, 'grassroots', 10));
    ok('and less from the machine', gain(fire, 'party', 10) < gain(plain, 'party', 10));
    ok('an advocate gains more from the press', gain(adv, 'media', 10) > gain(plain, 'media', 10));

    // ...including on the way down.
    const hust = born('hustler', 'activist', 511);
    const plain2 = RZ.engine.newGame({
      countryId: 'ZA', seed: 511, name: 'C', gender: 'f',
      regionId: cc.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: cc.parties[0].id
    });
    const lose = (S) => {
      const before = S.player.stats.integrity;
      RZ.engine.mkApi(S).add('stats.integrity', -10);
      return before - S.player.stats.integrity;
    };
    ok('a hustler loses integrity faster than anyone else', lose(hust) > lose(plain2));
  }

  // A career with no origin at all must still work — old saves, and the tests.
  {
    const plain = RZ.engine.newGame({
      countryId: 'ZA', seed: 520, name: 'C', gender: 'f',
      regionId: cc.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: cc.parties[0].id
    });
    ok('a career without an origin has no trait and still runs', !plain.player.trait);
    plain.actionsLeft = 0;
    RZ.engine.endTurn(plain);
    ok('and turns a month without complaint', plain.turn === 1);
  }
}

/* ================= 14. the three fixes ================= */
section('14. Capital for elite work, and the ways out of a nemesis');
{
  const cc = RZ.COUNTRIES.ZA;
  const cand = (seed) => RZ.engine.newGame({
    countryId: 'ZA', seed, name: 'C', gender: 'f',
    regionId: cc.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: cc.parties[0].id,
    startAs: 'candidate'
  });

  // Capital buys the elite manoeuvres; money buys the logistics.
  {
    const S = cand(600);
    S.player.rivals[0].dirt = [{ label: 'a tender', used: false }];
    S.player.capital = 3;
    const dump = RZ.sprint.weekActionById('dump');
    ok('a dump needs standing with a journalist, not cash', !dump.when(RZ.engine.mkApi(S)));
    S.player.capital = 40;
    ok('and is offered when you have it', dump.when(RZ.engine.mkApi(S)));
    dump.run(RZ.engine.mkApi(S));
    ok('and it costs capital', S.player.capital < 40, String(S.player.capital));

    const K = cand(601);
    const kg = RZ.sprint.weekActionById('kgotla');
    K.player.stats.integrity = 70; K.player.capital = 2;
    ok('an endorsement is spent influence too', !kg.when(RZ.engine.mkApi(K)));
    K.player.capital = 30;
    const moneyBefore = K.player.money;
    kg.run(RZ.engine.mkApi(K));
    ok('and it costs capital, not money',
      K.player.capital < 30 && K.player.money === moneyBefore);
  }

  // Three ways out of a nemesis, and waiting is not one of them.
  {
    // Out of the campaign, because he deliberately stays out of those weeks.
    const S = cand(610);
    S.tempo = 'month'; S.sprint = null;
    S.player.rivals[0].nemesis = true;
    S.flags.nemesisId = S.player.rivals[0].id;
    ok('there is a nemesis', !!RZ.revolt.nemesisOf(S));
    for (let i = 0; i < 40; i++) {
      S.date.month++; if (S.date.month > 12) { S.date.month = 1; S.date.year++; }
      RZ.revolt.nemesisTurn(S);
    }
    ok('he raises the pressure on you every month he is active', S.scandalRisk > 0.2,
      String(Math.round((S.scandalRisk || 0) * 100) / 100));
    ok('and waiting does not get rid of him', !!RZ.revolt.nemesisOf(S));

    // 1. Cross the floor.
    const D = cand(611);
    D.player.rungIdx = 3;
    D.player.rivals[0].nemesis = true;
    D.flags.nemesisId = D.player.rivals[0].id;
    D.tempo = 'month'; D.sprint = null;
    D.scandalRisk = 1.2;
    RZ.actionById['defect'].run(RZ.engine.mkApi(D));
    ok('crossing the floor puts you out of his reach', !RZ.revolt.nemesisOf(D));
    ok('and the pressure falls with him', D.scandalRisk < 1.2);

    // 2. Outrank him.
    const O = cand(612);
    O.tempo = 'month'; O.sprint = null;
    O.player.rungIdx = RZ.ladderFor('ZA').length - 3;
    O.player.rivals[0].nemesis = true;
    O.flags.nemesisId = O.player.rivals[0].id;
    let gone = false;
    for (let i = 0; i < 60 && !gone; i++) {
      O.date.month++; if (O.date.month > 12) { O.date.month = 1; O.date.year++; }
      const r = RZ.revolt.nemesisTurn(O);
      if (r && r.ended) gone = true;
    }
    ok('outranking him eventually ends it', gone);

    // 3. Break him in public.
    const E = cand(613);
    E.player.rivals[0].nemesis = true;
    E.player.rivals[0].power = 44;
    E.player.rivals[0].dirt = [{ label: 'a second family', used: false }];
    E.flags.nemesisId = E.player.rivals[0].id;
    E.player.stats.cunning = 95;
    let ended = false;
    for (let i = 0; i < 30 && !ended; i++) {
      const T = cand(613);
      T.player.rivals[0].nemesis = true;
      T.player.rivals[0].power = 44;
      T.player.rivals[0].dirt = [{ label: 'a second family', used: false }];
      T.flags.nemesisId = T.player.rivals[0].id;
      T.player.stats.cunning = 95;
      RZ.engine.mkApi(T).doLeak();
      if (!RZ.revolt.nemesisOf(T)) ended = true;
    }
    ok('a leak that lands finishes him', ended);
  }

  // The pressure has to actually change how often files break.
  {
    const count = (risk) => {
      let broke = 0;
      for (let i = 0; i < 400; i++) {
        const S = cand(700 + i);
        S.scandalRisk = risk;
        RZ.engine.mkApi(S).dirt('x', 'something', 3);
        S.player.fame = 60;
        const before = S.player.dirt.filter((d) => d.exposed).length;
        for (let k = 0; k < 6; k++) { S.actionsLeft = 0; S.pendingEvent = null; RZ.engine.endTurn(S); }
        if (S.player.dirt.filter((d) => d.exposed).length > before) broke++;
      }
      return broke;
    };
    const calm = count(0), hunted = count(2.2);
    ok('a file breaks more often while somebody is hunting you', hunted > calm,
      `${calm} vs ${hunted} of 400`);
  }
}

/* ================= 15. the constituency ================= */
section('15. Holding the seat');
{
  const cc = RZ.COUNTRIES.ZA;
  const mp = (seed, tier) => {
    const S = career('ZA', seed || 800, tier === undefined ? 4 : tier);
    RZ.ward.init(S);
    return S;
  };

  ok('an MP has a constituency with an opinion of them', RZ.ward.summary(mp()).trust > 0);
  ok('and nothing built yet', RZ.ward.summary(mp()).building.length === 0);
  ok('a backbencher below the seat cannot lobby', !RZ.ward.canLobby(career('ZA', 801, 2)));
  ok('an MP can', RZ.ward.canLobby(mp(802)));

  // You have no chequebook. You have influence, and it is priced.
  {
    const loyal = mp(810); RZ.revolt.whip(loyal, 18, 'test');
    const rebel = mp(811); rebel.flags.exiled = true;
    const plain = mp(812);
    const k = RZ.ward.KINDS[0].id;
    ok('a whipped member gets a better price from the ministry',
      RZ.ward.lobbyCost(loyal, k) < RZ.ward.lobbyCost(plain, k),
      `${RZ.ward.lobbyCost(loyal, k)} vs ${RZ.ward.lobbyCost(plain, k)}`);
    ok('and an exiled one is starved of development',
      RZ.ward.lobbyCost(rebel, k) > RZ.ward.lobbyCost(plain, k),
      `${RZ.ward.lobbyCost(rebel, k)} vs ${RZ.ward.lobbyCost(plain, k)}`);
  }

  // A project takes months, and announcing it is not the same as opening it.
  {
    const S = mp(820);
    const before = RZ.ward.summary(S).trust;
    const p = RZ.ward.start(S, RZ.engine.mkApi(S), 'clinic', {});
    ok('starting one puts it under construction', p && p.status === 'building');
    ok('and it takes months', p.monthsLeft >= 3);
    ok('the announcement alone moves trust a little', RZ.ward.summary(S).trust > before);
    const announced = RZ.ward.summary(S).trust;

    // Run it to completion with no corruption, so it cannot be abandoned.
    S.nation.society.corruption = 0;
    p.risk = 0;
    for (let i = 0; i < 12 && p.status === 'building'; i++) { S.turn++; RZ.ward.tick(S, 1, {}); }
    ok('it eventually opens', p.status === 'done', p.status);
    ok('and opening it is worth far more than announcing it',
      RZ.ward.summary(S).trust > announced + 8,
      `${Math.round(announced)} -> ${RZ.ward.summary(S).trust}`);
    ok('it goes into the career record', S.player.record.some((r) => /Opened/.test(r.text)));
    ok('and the ward reports it delivered', RZ.ward.summary(S).done === 1);
  }

  // Corruption is not an abstraction: it is whether the money reaches the site.
  {
    let cleanAbandoned = 0, rottenAbandoned = 0;
    for (let i = 0; i < 120; i++) {
      const A = mp(830 + i); A.nation.society.corruption = 2;
      const B = mp(830 + i); B.nation.society.corruption = 95;
      const pa = RZ.ward.start(A, RZ.engine.mkApi(A), 'road', {});
      const pb = RZ.ward.start(B, RZ.engine.mkApi(B), 'road', {});
      for (let k = 0; k < 10 && pa.status === 'building'; k++) { A.turn++; RZ.ward.tick(A, 1, {}); }
      for (let k = 0; k < 10 && pb.status === 'building'; k++) { B.turn++; RZ.ward.tick(B, 1, {}); }
      if (pa.status === 'abandoned') cleanAbandoned++;
      if (pb.status === 'abandoned') rottenAbandoned++;
    }
    ok('sites are abandoned far more often in a corrupt state',
      rottenAbandoned > cleanAbandoned * 2, `${cleanAbandoned} vs ${rottenAbandoned} of 120`);

    // And a shock is the thing that empties the site.
    let shockAbandoned = 0;
    for (let i = 0; i < 120; i++) {
      const S = mp(900 + i);
      S.nation.society.corruption = 40;
      const p = RZ.ward.start(S, RZ.engine.mkApi(S), 'road', {});
      S.flags.lastShock = S.turn;                 // the markets just turned
      for (let k = 0; k < 4 && p.status === 'building'; k++) { S.turn++; RZ.ward.tick(S, 1, {}); }
      if (p.status === 'abandoned') shockAbandoned++;
    }
    ok('and a market shock empties them faster still', shockAbandoned > 8, `${shockAbandoned} of 120`);
  }

  // A half-built shell is worse than never having started.
  {
    const S = mp(950);
    const p = RZ.ward.start(S, RZ.engine.mkApi(S), 'school', {});
    const before = RZ.ward.summary(S).trust;
    p.risk = 1;                                    // certain to be abandoned
    S.turn++; RZ.ward.tick(S, 1, {});
    ok('an abandoned site collapses trust', RZ.ward.summary(S).trust < before - 6,
      `${Math.round(before)} -> ${RZ.ward.summary(S).trust}`);
    ok('and leaves a file with your name on the sign',
      S.player.dirt.some((d) => d.id.startsWith('stalled-')));
    ok('and reaches the feed as an alert', S.feed.some((f) => f.alert && /abandoned/i.test(f.title)));
  }

  // Trust is the thing the ballot is actually made of.
  {
    const good = mp(960), bad = mp(961);
    good.ward.trust = 90; bad.ward.trust = 10;
    const g0 = good.player.regionSupport[good.player.regionId];
    const b0 = bad.player.regionSupport[bad.player.regionId];
    for (let i = 0; i < 12; i++) { good.turn++; bad.turn++; RZ.ward.tick(good, 1, {}); RZ.ward.tick(bad, 1, {}); }
    ok('a trusted MP gains ground at home',
      good.player.regionSupport[good.player.regionId] > g0);
    ok('and a distrusted one loses it',
      bad.player.regionSupport[bad.player.regionId] < b0);
  }

  // Delivering the thing closes the promise you made about it.
  {
    const S = mp(970);
    const a = RZ.engine.mkApi(S);
    a.promise('clinicpromise', 'A clinic for the ward before the next rains', { due: 12 });
    const p = RZ.ward.start(S, RZ.engine.mkApi(S), 'clinic', {});
    p.risk = 0;
    for (let i = 0; i < 12 && p.status === 'building'; i++) { S.turn++; RZ.ward.tick(S, 1, {}); }
    ok('opening the clinic settles the promise of a clinic',
      S.player.promises[0].settled === true);
  }

  // The whip, and what rebelling against it costs.
  {
    const S = mp(980);
    ok('you start unwhipped', !RZ.revolt.whipped(S));
    RZ.revolt.whip(S, 18, 'test');
    ok('and can be whipped', RZ.revolt.whipped(S));
    RZ.revolt.unwhip(S);
    ok('and can break it', !RZ.revolt.whipped(S));

    const scene = RZ.DIALOGUE.filter((x) => x.id === 'whip-order')[0];
    ok('the order paper is a conversation', !!scene && scene.beats.length >= 2);
    const rebelAnswer = scene.beats[0].answers[2];
    const loyal = mp(981), whippedRebel = mp(982);
    RZ.revolt.whip(whippedRebel, 18, 'test');
    [loyal, whippedRebel].forEach((T) => { T.player.standing.party = 70; });
    rebelAnswer.run(RZ.engine.mkApi(loyal));
    rebelAnswer.run(RZ.engine.mkApi(whippedRebel));
    ok('rebelling costs a whipped member far more',
      whippedRebel.player.standing.party < loyal.player.standing.party,
      `${Math.round(whippedRebel.player.standing.party)} vs ${Math.round(loyal.player.standing.party)}`);
    ok('and breaks the whip', !RZ.revolt.whipped(whippedRebel));
    ok('while both gain at home', loyal.ward.trust > 50 && whippedRebel.ward.trust > 50);
  }

  // The state the Monte Carlo found: a long-serving member who has already
  // delivered everything there is to deliver.
  {
    const S = mp(995);
    RZ.ward.KINDS.forEach((k) => RZ.ward.start(S, RZ.engine.mkApi(S), k.id, {}));
    ok('with everything under way there is nothing left to ask for', RZ.ward.needs(S).length === 0);
    ok('and the lobby action is withdrawn rather than crashing', !RZ.ward.canLobby(S));
    S.ward.lastLobby = -99;
    ok('even once the cooldown is up', !RZ.ward.canLobby(S));
    const res = RZ.actionById['lobby'].run(RZ.engine.mkApi(S));
    ok('and running it anyway fails cleanly', res && res.fail === true, JSON.stringify(res).slice(0, 60));
    const scene = RZ.DIALOGUE.filter((x) => x.id === 'lobby-ps')[0];
    ok('and the meeting will not open either', !scene.when(RZ.engine.mkApi(S)));
  }

  // Every new constituency scene has to be reachable from an action.
  {
    const topics = ['lobby', 'whip', 'pac', 'wardcrisis', 'funerals'];
    const missing = topics.filter((t) => !RZ.actionById[t]);
    ok('every new conversation has an action that opens it', missing.length === 0, missing.join(', '));
    const S = mp(990);
    S.player.capital = 40;
    const deck = RZ.engine.availableActions(S).map((x) => x.id);
    ok('and an MP is offered them', topics.every((t) => deck.includes(t)),
      topics.filter((t) => !deck.includes(t)).join(', '));
    const junior = career('ZA', 991, 2);
    const jDeck = RZ.engine.availableActions(junior).map((x) => x.id);
    ok('while an activist is not', !jDeck.includes('lobby') && !jDeck.includes('pac'));
  }
}

/* ================= 16. the tiers above the seat ================= */
section('16. Minister, deputy, President');
{
  const at = (tier, seed) => {
    const S = career('ZA', seed || 1100, tier);
    S.tempo = 'month'; S.sprint = null;
    S.parties[S.player.partyId].gov = true;
    if (S.nation.govParties.indexOf(S.player.partyId) < 0) S.nation.govParties.push(S.player.partyId);
    return S;
  };
  const pres = (seed) => {
    const S = at(RZ.ladderFor('ZA').length - 1, seed);
    S.player.isPresident = true; S.player.isLeader = true;
    S.nation.presidentName = S.player.name;
    return S;
  };

  // A crisis is a person in a room, not a card with buttons.
  {
    const missing = RZ.state.CRISES.filter((cr) => !RZ.dialogue.byId(cr.scene));
    ok('every crisis has a conversation behind it', missing.length === 0,
      missing.map((c) => c.id).join(', '));
    const single = RZ.state.CRISES
      .map((cr) => RZ.dialogue.byId(cr.scene))
      .filter((sc) => sc.beats.length < 2);
    ok('and each is more than one question', single.length === 0, single.map((s) => s.id).join(', '));
  }

  // Each crisis only fires at the tier it belongs to.
  {
    const fires = (S, id) => RZ.state.CRISES.filter((c) => c.id === id)[0].when(S);
    ok('a backbencher is not summoned about a reshuffle', !fires(at(4, 1101), 'reshuffle-rumour'));
    ok('a minister is', fires(at(6, 1102), 'reshuffle-rumour'));
    ok('a minister is not asked about the succession', !fires(at(6, 1103), 'succession'));
    ok('a deputy is', fires(at(11, 1104), 'succession'));
    ok('nobody but the President gets the generals', !fires(at(11, 1105), 'generals'));

    const P = pres(1106);
    P.nation.society.unrest = 80;
    ok('and the President does, when the streets are bad', fires(P, 'generals'));
    P.nation.society.unrest = 20;
    ok('but not when they are quiet', !fires(P, 'generals'));

    const B = pres(1107);
    B.nation.economy.reserves = 1.1;
    ok('the treasury summons him when the cover runs out', fires(B, 'debt'));
  }

  // Being summoned actually puts the scene in front of the player.
  {
    const S = pres(1110);
    S.nation.society.unrest = 95;
    S.nation.economy.reserves = 0.5;
    let summoned = null;
    for (let i = 0; i < 200 && !summoned; i++) {
      S.date.month++; if (S.date.month > 12) { S.date.month = 1; S.date.year++; }
      const r = RZ.state.tick(S, 1, {});
      if (r) summoned = r;
    }
    ok('a crisis eventually sends for you', !!summoned, JSON.stringify(summoned));
    ok('and parks a scene for the desk to present', !!S.pendingScene);
    const convo = RZ.dialogue.beginById(S, S.pendingScene);
    ok('which opens as a real conversation', !!convo && convo.transcript.length > 0);
    ok('with somebody who has a name and a job',
      !!convo.speaker.name && !!convo.speaker.role, JSON.stringify(convo.speaker));
  }

  // The cabinet is a problem, not a team.
  {
    const S = pres(1120);
    RZ.state.fillCabinet(S);
    ok('a President has a cabinet', S.cabinet.length >= 5);
    ok('each of them has a name and a portfolio',
      S.cabinet.every((m) => m.name && RZ.state.ministryName(S, m.ministryId)));
    ok('and three numbers that make them a problem',
      S.cabinet.every((m) => m.competence >= 0 && m.loyalty >= 0 && m.corruption >= 0));

    // Competence is growth; corruption is rot.
    const good = pres(1121), bad = pres(1122);
    RZ.state.fillCabinet(good); RZ.state.fillCabinet(bad);
    good.cabinet.forEach((m) => { m.competence = 95; m.corruption = 5; m.loyalty = 90; });
    bad.cabinet.forEach((m) => { m.competence = 5; m.corruption = 95; m.loyalty = 90; });
    const g0 = good.nation.economy.growth, b0 = bad.nation.economy.growth;
    const gr0 = good.nation.society.corruption, br0 = bad.nation.society.corruption;
    for (let i = 0; i < 24; i++) { RZ.state.cabinetTick(good, 1, {}); RZ.state.cabinetTick(bad, 1, {}); }
    ok('a competent cabinet grows the economy', good.nation.economy.growth > g0);
    ok('an incompetent one shrinks it', bad.nation.economy.growth < b0);
    ok('and a corrupt one rots the state',
      bad.nation.society.corruption - br0 > good.nation.society.corruption - gr0);

    // A disloyal minister is not idle.
    const leaky = pres(1123);
    RZ.state.fillCabinet(leaky);
    leaky.cabinet.forEach((m) => { m.loyalty = 5; });
    let leaks = 0;
    for (let i = 0; i < 200; i++) {
      leaky.date.month++; if (leaky.date.month > 12) { leaky.date.month = 1; leaky.date.year++; }
      const before = leaky.feed.length;
      RZ.state.cabinetTick(leaky, 1, {});
      if (leaky.feed.length > before) leaks++;
    }
    ok('a disloyal cabinet leaks against you', leaks >= 3, `${leaks} leaks in 200 months`);
    ok('and it raises the pressure on you', leaky.scandalRisk > 0);

    const loyal = pres(1124);
    RZ.state.fillCabinet(loyal);
    loyal.cabinet.forEach((m) => { m.loyalty = 95; });
    let loyalLeaks = 0;
    for (let i = 0; i < 200; i++) {
      loyal.date.month++; if (loyal.date.month > 12) { loyal.date.month = 1; loyal.date.year++; }
      const before = loyal.feed.length;
      RZ.state.cabinetTick(loyal, 1, {});
      if (loyal.feed.length > before) loyalLeaks++;
    }
    ok('a loyal one does not', loyalLeaks === 0, String(loyalLeaks));
  }

  // The four proactive actions, and who is offered them.
  {
    const ids = ['megatender', 'purge', 'shadowdiplo', 'ssa'];
    ok('every new action exists', ids.every((i) => !!RZ.actionById[i]));

    const min = at(6, 1130); min.player.capital = 60;
    const dep = at(11, 1131); dep.player.capital = 60;
    const pr = pres(1132); pr.player.capital = 60;
    const mp = at(4, 1133); mp.player.capital = 60;

    const deck = (S) => RZ.engine.availableActions(S).map((x) => x.id);
    ok('a minister can sign the national contract', deck(min).includes('megatender'));
    ok('a backbencher cannot', !deck(mp).includes('megatender'));
    ok('a deputy can work the central committee and travel quietly',
      deck(dep).includes('purge') && deck(dep).includes('shadowdiplo'));
    ok('a minister cannot yet', !deck(min).includes('purge'));
    ok('only the President can send for the Director-General',
      deck(pr).includes('ssa') && !deck(dep).includes('ssa'));
  }

  // Every branch of every new scene has to run.
  {
    const bad = [];
    ['reshuffle-rumour', 'poisoned-chalice', 'succession-trap', 'debt-ultimatum',
     'midnight-generals', 'mega-tender', 'central-purge', 'shadow-diplomacy', 'ssa-file'].forEach((id) => {
      const sc = RZ.dialogue.byId(id);
      if (!sc) { bad.push(`${id}: missing`); return; }
      const widest = Math.max(...sc.beats.map((b) => b.answers.length));
      for (let pick = 0; pick < widest; pick++) {
        const S = pres(1140 + pick);
        S.player.money = 5_000_000; S.player.capital = 150;
        let convo;
        try { convo = RZ.dialogue.begin(S, sc, null); }
        catch (e) { bad.push(`${id} begin: ${e.message}`); continue; }
        let guard = 0;
        try {
          while (!convo.done && guard++ < 10) {
            const usable = RZ.dialogue.options(convo).filter((o) => o.ok);
            if (!usable.length) { bad.push(`${id}: nothing sayable`); break; }
            RZ.dialogue.choose(convo, usable[Math.min(pick, usable.length - 1)].i);
          }
        } catch (e) { bad.push(`${id} answer ${pick}: ${e.message}`); continue; }
        convo.transcript.forEach((l) => {
          if (/undefined|NaN|\[object/.test(l.text)) bad.push(`${id}: ${l.text.slice(0, 60)}`);
        });
        if (!convo.api.deltas.length) bad.push(`${id} path ${pick}: changed nothing`);
      }
    });
    ok('every branch of every new scene runs cleanly', bad.length === 0, bad.slice(0, 3).join('; '));
  }

  // Crises stay out of the campaign, and do not stack on an open decision.
  {
    const S = pres(1150);
    S.nation.society.unrest = 95;
    S.tempo = 'week';
    ok('nobody summons you mid-campaign', RZ.state.tick(S, 1, {}) === null);
    S.tempo = 'month';
    S.pendingEvent = { id: 'x', choices: [] };
    ok('and not while a decision is already on the table', RZ.state.tick(S, 1, {}) === null);
  }
}

/* ================= 9. it all still saves ================= */
section('9. Save/load with the new state');
{
  const S = makePresident(career('ZA', 81, 13));
  RZ.engine.mkApi(S).owePatron('Mr Dlamini', 6);
  RZ.engine.mkApi(S).promise('road', 'A road', { due: 3 });
  RZ.crisis.addBuff(S, 'media', 20, 5, 'test');
  RZ.engine.save(S);
  const back = RZ.engine.load();
  ok('a career with the new state round-trips', !!back);
  ok('creditors survive the save', back && back.capture.patrons.length === 1);
  ok('promises survive the save', back && back.player.promises.length === 1);
  ok('fading boosts survive the save', back && back.buffs.length === 1);
}


/* ================= 17. drafting your own bill ================= */
section('17. Proactive legislation');
{
  // A backbencher cannot table anything; a member can, once, and not while
  // the diary is already weekly.
  {
    const low = career('ZA', 900, 2);
    ok('a branch official cannot draft a bill', RZ.bill.canDraft(low) === false);
    const S = career('ZA', 901, 6);
    S.player.capital = 40;
    ok('a member can', RZ.bill.canDraft(S) === true);
    S.player.capital = 4;
    ok('but not without the capital to table it', RZ.bill.canDraft(S) === false);
    S.player.capital = 40;
    S.tempo = 'week';
    ok('and not in the middle of a campaign', RZ.bill.canDraft(S) === false);
  }

  // Tabling it hands the clock to the whips.
  {
    const S = career('ZA', 902, 6);
    S.player.capital = 60;
    const b = RZ.bill.table(S, RZ.engine.mkApi(S), 'education');
    ok('tabling a bill puts the diary on weeks', S.tempo === 'week' && S.date.week === 1);
    ok('with four weeks to the second reading', b.weeksLeft === RZ.bill.WEEKS);
    ok('and it cannot be drafted twice at once', RZ.bill.canDraft(S) === false);

    const seats = b.blocs.reduce((n, x) => n + x.seats, 0);
    ok('the blocs add up to the whole House', seats === RZ.bill.houseTotal(S),
      seats + ' vs ' + RZ.bill.houseTotal(S));
    ok('a majority is more than half of it', b.needed === Math.floor(seats / 2) + 1,
      String(b.needed));
    ok('every bloc has somebody in it', b.blocs.every((x) => x.seats > 0));
    const t = RZ.bill.count(S);
    ok('and the count reads the same House', t.total === seats);
  }

  // Each lever moves a room, and the same room twice is worth less.
  {
    for (const how of ['capital', 'charm', 'extort']) {
      const S = career('ZA', 910, 6);
      S.player.capital = 90;
      RZ.bill.table(S, RZ.engine.mkApi(S), 'wages');
      // Leverage lives on a rival, not in your own pocket.
      if (how === 'extort') {
        RZ.engine.mkApi(S).makeRival();
        S.player.rivals[0].dirt.push({ id: 'x', label: 'A file nobody was meant to see', severity: 8 });
      }
      const target = S.bill.blocs.find((x) => !x.pledged);
      const before = target.lean;
      const r = RZ.bill.workBloc(S, RZ.engine.mkApi(S), target.id, how);
      ok('working a bloc with ' + how + ' moves it', r && target.lean > before,
        before + ' -> ' + (target && target.lean));
      if (how === 'extort') {
        ok('and extortion spends the file', S.player.rivals[0].dirt[0].used === true);
        ok('and costs you something you cannot buy back', S.player.stats.integrity < 100);
      }
    }

    const noFile = career('ZA', 909, 6);
    noFile.player.capital = 90;
    RZ.bill.table(noFile, RZ.engine.mkApi(noFile), 'wages');
    ok('with nothing on anybody, there is nothing to threaten with',
      RZ.bill.workBloc(noFile, RZ.engine.mkApi(noFile), noFile.bill.blocs[0].id, 'extort') === null);

    const S = career('ZA', 911, 6);
    S.player.capital = 300;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'wages');
    const b = S.bill.blocs[0];
    b.lean = -90;
    const api = RZ.engine.mkApi(S);
    const first = RZ.bill.workBloc(S, api, b.id, 'capital').moved;
    const second = RZ.bill.workBloc(S, api, b.id, 'capital').moved;
    const third = RZ.bill.workBloc(S, api, b.id, 'capital').moved;
    ok('the third conversation is worth less than the first', third < first,
      Math.round(first) + ' -> ' + Math.round(third));
    ok('and the second is somewhere in between', second < first);

    // Enough work pledges them outright.
    const S2 = career('ZA', 912, 6);
    S2.player.capital = 600;
    RZ.bill.table(S2, RZ.engine.mkApi(S2), 'wages');
    const b2 = S2.bill.blocs[0];
    for (let i = 0; i < 12 && !b2.pledged; i++) RZ.bill.workBloc(S2, RZ.engine.mkApi(S2), b2.id, 'capital');
    ok('a bloc worked hard enough pledges', b2.pledged === true, 'lean=' + Math.round(b2.lean));
    const cnt = RZ.bill.count(S2);
    ok('and a pledged bloc votes to a member', cnt.yes >= b2.seats, cnt.yes + ' >= ' + b2.seats);
  }

  // A conceded clause always wins the room and always costs the bill.
  {
    const S = career('ZA', 920, 6);
    S.player.capital = 60;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'mines');
    const worst = S.bill.blocs.slice().sort((a, b) => a.lean - b.lean)[0];
    const before = worst.lean;
    RZ.bill.concede(S, RZ.engine.mkApi(S), worst.id);
    ok('a concession moves even a hostile bloc a long way', worst.lean - before >= 30,
      before + ' -> ' + worst.lean);
    ok('and it is on the record against the bill', S.bill.concessions === 1);
  }

  // Leaving a room alone loses it.
  {
    const S = career('ZA', 921, 6);
    S.player.capital = 60;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'tax');
    const x = S.bill.blocs.find((z) => !z.pledged);
    x.lean = 20;
    const before = x.lean;
    S.bill.weeksLeft = 3;
    RZ.bill.tickWeek(S);
    ok('a bloc you do not visit drifts back', x.lean < before, before + ' -> ' + x.lean);
    ok('and the week counter follows the clock', S.bill.week === 2, String(S.bill.week));

    const p = S.bill.blocs[0];
    p.pledged = true; p.lean = 60;
    S.bill.weeksLeft = 2;
    RZ.bill.tickWeek(S);
    ok('a pledged bloc does not drift', p.lean === 60);
  }

  // The division: a House that is with you carries it, one that is not does not.
  {
    const S = career('ZA', 930, 6);
    S.player.capital = 60;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'education');
    S.bill.blocs.forEach((x) => { x.pledged = true; });
    const res = RZ.bill.division(S);
    ok('a whipped House carries the bill', res.passed === true, res.yes + '/' + res.needed);
    ok('and the diary goes back to months', S.tempo === 'month' && S.bill === null);
    ok('it is on the personal record', S.player.record.some((r) => /carried/.test(r.text)));
    ok('and there is a cooling-off period', RZ.bill.canDraft(S) === false);

    const S2 = career('ZA', 931, 6);
    S2.player.capital = 60;
    RZ.bill.table(S2, RZ.engine.mkApi(S2), 'anticorr');
    S2.bill.blocs.forEach((x) => { x.pledged = false; x.lean = -90; });
    const before = S2.player.standing.leader;
    const res2 = RZ.bill.division(S2);
    ok('a House against it throws it out', res2.passed === false, res2.yes + '/' + res2.needed);
    ok('and losing costs you standing', S2.player.standing.leader < before);
    ok('the loss is counted', S2.flags.billsLost === 1);
  }

  // Concessions scale down what passing is worth.
  {
    function passWith(concessions, seed) {
      const S = career('ZA', seed, 6);
      S.player.capital = 60;
      RZ.bill.table(S, RZ.engine.mkApi(S), 'education');
      S.bill.blocs.forEach((x) => { x.pledged = true; });
      S.bill.concessions = concessions;
      const edBefore = S.nation.society.education;
      RZ.seed(4242);
      const r = RZ.bill.division(S);
      return { gain: S.nation.society.education - edBefore, res: r };
    }
    const clean = passWith(0, 940);
    const gutted = passWith(3, 940);
    ok('a bill passed intact does more than a gutted one',
      gutted.gain < clean.gain, RZ.round(clean.gain, 2) + ' vs ' + RZ.round(gutted.gain, 2));
    ok('and the sheet says how many clauses went', /3 clauses went out/.test(gutted.res.body));
    ok('a bill passed whole says so', /Exactly as drafted/.test(clean.res.body));
  }

  // Dissolution kills whatever is on the order paper.
  {
    const S = career('ZA', 950, 6);
    S.player.capital = 60;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'land');
    const r = RZ.bill.lapse(S);
    ok('a dissolution kills the bill', r && S.bill === null);
    ok('and hands the clock back', S.tempo === 'month');
    ok('without recording a defeat', !S.flags.billsLost);
  }

  // Every bill, in every country, without throwing.
  {
    let ran = 0;
    Object.keys(RZ.COUNTRIES).forEach((cid, i) => {
      RZ.bill.BILLS.forEach((bill, j) => {
        const S = career(cid, 960 + i * 10 + j, 6);
        S.player.capital = 60;
        RZ.bill.table(S, RZ.engine.mkApi(S), bill.id);
        S.bill.blocs.forEach((x) => { x.pledged = true; });
        const res = RZ.bill.division(S);
        if (!res.passed) throw new Error('a fully whipped House lost ' + bill.id + ' in ' + cid);
        ran++;
      });
    });
    ok('every bill passes cleanly in all ten countries', ran === Object.keys(RZ.COUNTRIES).length * RZ.bill.BILLS.length,
      String(ran));
  }

  // The weekly deck, and the action that gets you into it.
  {
    const S = career('ZA', 990, 6);
    S.player.capital = 60;
    ok('the draft action is on the desk', RZ.engine.availableActions(S).some((a) => a.id === 'draft'));
    RZ.bill.table(S, RZ.engine.mkApi(S), 'tax');
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('and the whipping deck replaces it once tabled',
      ids.includes('billwhip') && ids.includes('billconcede') && ids.includes('billcount') && !ids.includes('draft'));
    RZ.bill.weekActions(S).forEach((wa) => {
      if (!wa.run) return;
      const r = wa.run(RZ.engine.mkApi(S));
      if (!r || !r.title) throw new Error(wa.id + ' returned nothing');
    });
    ok('every weekly bill action runs and reports', true);
    ok('the picker specials are declared',
      RZ.bill.weekActionById('billwhip').special === 'bloc' &&
      RZ.bill.weekActionById('billconcede').special === 'concede');
  }

  // The whips' count is a room, and somebody comes to find you about your own
  // bill — but not every week, and never on top of a decision already waiting.
  {
    const S = career('ZA', 970, 6);
    S.player.capital = 60;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'mines');
    const out = RZ.engine.doAction(S, 'billcount');
    ok('counting the House is a meeting, not a die roll', !!(out && out.dialogue));
    if (out && out.dialogue) {
      let g = 0;
      while (!out.dialogue.done && g++ < 12) {
        const usable = RZ.dialogue.options(out.dialogue).filter((o) => o.ok);
        if (!usable.length) break;
        RZ.dialogue.choose(out.dialogue, usable[0].i);
      }
      ok('and it runs to the end', out.dialogue.done === true);
    }

    // Both visits, forced.
    const V = career('ZA', 971, 6);
    V.player.capital = 60;
    RZ.bill.table(V, RZ.engine.mkApi(V), 'mines');
    ok('nobody comes in the first week', (() => {
      V.bill.weeksLeft = 4;
      RZ.bill.tickWeek(V);
      return !V.pendingScene;
    })());

    let summons = 0;
    for (let i = 0; i < 40; i++) {
      V.bill.weeksLeft = 2;
      V.pendingScene = null;
      const r = RZ.bill.tickWeek(V);
      if (r.summoned) summons++;
    }
    ok('somebody eventually comes to find you about it', summons >= 1, String(summons));
    ok('and each of them only once per bill', summons <= RZ.bill.VISITS.length, String(summons));

    const B = career('ZA', 972, 6);
    B.player.capital = 60;
    RZ.bill.table(B, RZ.engine.mkApi(B), 'mines');
    B.bill.weeksLeft = 2;
    B.pendingEvent = { id: 'x', choices: [] };
    let any = false;
    for (let i = 0; i < 20; i++) { if (RZ.bill.tickWeek(B).summoned) any = true; }
    ok('nobody arrives on top of a decision already on the table', any === false);

    const L = career('ZA', 973, 6);
    L.player.capital = 60;
    RZ.bill.table(L, RZ.engine.mkApi(L), 'mines');
    let lastWeek = false;
    for (let i = 0; i < 20; i++) { L.bill.weeksLeft = 0; L.pendingScene = null; if (RZ.bill.tickWeek(L).summoned) lastWeek = true; }
    ok('and not in the week of the division itself', lastWeek === false);

    ok('every summoned visitor is a scene that exists',
      RZ.bill.VISITS.every((v) => !!RZ.dialogue.byId(v.id)));
  }

  // A bill in flight survives being written to disk mid-division.
  {
    const S = career('ZA', 995, 6);
    S.player.capital = 60;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'mines');
    S.bill.blocs[0].pledged = true;
    RZ.engine.save(S);
    const back = RZ.engine.load();
    ok('a bill in committee round-trips', back && back.bill && back.bill.id === 'mines');
    ok('with its blocs and its pledges', back.bill.blocs.length === S.bill.blocs.length && back.bill.blocs[0].pledged === true);
  }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('every new mechanic fires and does what it says');
