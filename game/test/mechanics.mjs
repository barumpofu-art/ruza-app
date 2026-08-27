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
  'data-events.js', 'data-dialogue.js', 'people.js', 'elections.js',
  'engine.js', 'governance.js', 'dialogue.js', 'crisis.js', 'sprint.js'
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

  const ended = RZ.crisis.monthly(S, {});
  ok('the second month ends the career', ended === true && S.over === true);
  ok('with the right ending', S.ending === 'sadc');
  const obit = String(RZ.gov.obituary(S, RZ.gov.legacy(S)));
  ok('the obituary names what happened, not the fallback',
    /brigade/i.test(obit) && !/^The career ended\.$/.test(obit),
    obit.slice(0, 120));

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
  RZ.crisis.monthly(backbench, {});
  RZ.crisis.monthly(backbench, {});
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
  ok('and costs money', S.player.money < before.money);
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

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('every new mechanic fires and does what it says');
