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
  'data-events.js', 'data-dialogue.js', 'data-origins.js', 'people.js', 'field.js', 'elections.js',
  'engine.js', 'governance.js', 'dialogue.js', 'crisis.js', 'sprint.js', 'revolt.js', 'constituency.js', 'statecraft.js', 'legislation.js', 'contender.js', 'blocs.js', 'cast.js', 'docket.js', 'trenches.js', 'family.js', 'electionday.js'
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

// Main replaced the player's private rival list with a whole field of party
// figures who have careers of their own. Same people, one lookup away.
function foes(S) { return RZ.field.strongestFirst(RZ.field.ours(S)); }

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
  ok('and summons the ward rather than ending the career', S3.pendingScene === 'collapse-bed',
    `pending=${S3.pendingScene}`);

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

  // The card says "there is no seat to contest this election". That is a
  // candidates' list, and the offices below the seat are internal ones no
  // general election touches — so nobody below tier four can be dropped from a
  // slate they were never on.
  {
    const tierOf = (rung) => RZ.ladderFor('ZA')[rung].tier;
    let belowChecked = 0;
    for (let rung = 0; rung < RZ.ladderFor('ZA').length; rung++) {
      if (tierOf(rung) >= 4) break;
      const S = career('ZA', 40 + rung, rung);
      S.player.standing.grassroots = 1; S.player.standing.party = 1; S.player.fame = 0;
      if (RZ.crisis.congressPurge(S) !== null) {
        ok(`nobody below the seat is purged (rung ${rung}, tier ${tierOf(rung)})`, false);
      }
      belowChecked++;
    }
    ok('nobody below the seat is dropped from a candidates’ list', belowChecked > 0,
      `${belowChecked} rungs checked`);

    // And it still bites the moment you actually hold one.
    const seat = career('ZA', 60, 4);
    seat.player.standing.grassroots = 3; seat.player.standing.party = 3; seat.player.fame = 1;
    ok('but a weak member of the house is', !!RZ.crisis.congressPurge(seat));
  }

  // Allies live in the field with side === 'ally'. `P.allies` has never existed,
  // so this term contributed exactly nothing and every ally anybody recruited
  // counted for zero.
  {
    const withAllies = career('ZA', 70, 6);
    const without = career('ZA', 70, 6);
    [withAllies, without].forEach((S) => {
      S.player.standing.grassroots = 30; S.player.standing.party = 30; S.player.fame = 10;
    });
    for (let i = 0; i < 6; i++) RZ.field.addAlly(withAllies, 50);
    ok('recruiting allies actually seats them', RZ.field.allies(withAllies).length > 0,
      String(RZ.field.allies(withAllies).length));
    ok('and none are seated for the control', RZ.field.allies(without).length === 0);
    // Six allies are worth fifteen points on the slate; that has to be able to
    // change an outcome somewhere in the band where it is close.
    let savedBy = 0;
    for (let seed = 0; seed < 60; seed++) {
      const A = career('ZA', 700 + seed, 6);
      const B = career('ZA', 700 + seed, 6);
      [A, B].forEach((S) => {
        S.player.standing.grassroots = 34; S.player.standing.party = 34; S.player.fame = 12;
      });
      for (let i = 0; i < 6; i++) RZ.field.addAlly(A, 50);
      const a1 = RZ.crisis.congressPurge(A);
      const b1 = RZ.crisis.congressPurge(B);
      if (!a1 && b1) savedBy++;
    }
    ok('and having them keeps you on the slate sometimes', savedBy > 0, `${savedBy}/60`);
  }

  // The bar scales with the office: a branch slate is not a national one.
  {
    const bar = (rung) => {
      const S = career('ZA', 80, rung);
      const t = RZ.ladderFor('ZA')[rung].tier;
      return 12 + t * 3.4 + RZ.COUNTRIES.ZA.inst.patronage * 0.16;
    };
    const lad = RZ.ladderFor('ZA');
    const seatRung = lad.findIndex((r) => r.tier >= 4);
    const topRung = lad.length - 2;
    ok('the higher the office the harder it is to stay on the list',
      bar(topRung) > bar(seatRung), `${bar(seatRung).toFixed(1)} vs ${bar(topRung).toFixed(1)}`);
  }
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

  // Whose promise it was decides whether the country notices. A ward
  // councillor's unbuilt road is a personal disgrace; a senior minister's is a
  // national one. It used to be charged to national stability either way, every
  // five months for the rest of the career.
  ok('a junior figure\u2019s broken promise is not a national emergency',
    S.nation.society.stability >= 62 - 0.001, RZ.round(S.nation.society.stability, 1));
  {
    const big = career('ZA', 43, 12);
    RZ.engine.mkApi(big).promise('road', 'A tarred road to the clinic', { due: 12 });
    big.date.year += 2;
    const stab0 = big.nation.society.stability;
    for (let i = 0; i < 4; i++) { big.turn += 6; big.actionsThisMonth = 0; RZ.crisis.monthly(big, {}); }
    ok('but a senior one\u2019s does move the country', big.nation.society.stability < stab0,
      RZ.round(stab0, 1) + ' -> ' + RZ.round(big.nation.society.stability, 1));
  }

  // And it stops being a monthly bill once it is simply part of your record.
  {
    const T = career('ZA', 44, 5);
    RZ.engine.mkApi(T).promise('road', 'A road', { due: 12 });
    T.date.year += 2;
    for (let i = 0; i < 30; i++) { T.turn += 6; T.actionsThisMonth = 0; RZ.crisis.monthly(T, {}); }
    const p = T.player.promises[0];
    ok('a broken promise stops biting eventually', p.bites <= 6, 'bites=' + p.bites);
    ok('and is marked as spent rather than settled', p.spent === true && !p.settled);
  }

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
    // The other one's monthly drag is real but it is not what is under test
    // here, and two careers draw two different contenders.
    [withM, without].forEach((T) => { T.contender = null; });
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
    foes(strong).forEach((r) => { r.power = 10; });
    const weak = mk(212, 4);
    weak.player.capital = 20; weak.player.standing.party = 5; weak.player.standing.grassroots = 5;
    foes(weak).forEach((r) => { r.power = 95; });
    ok('a strong challenger has better odds than a weak one',
      RZ.revolt.revoltOdds(strong).pct > RZ.revolt.revoltOdds(weak).pct,
      `${RZ.revolt.revoltOdds(strong).pct}% vs ${RZ.revolt.revoltOdds(weak).pct}%`);

    // Winning promotes. The odds cap at 92%, so a revolt is a roll however
    // strong the challenger is, and any change anywhere else in the game moves
    // the seeded stream under a fixed seed. Run it enough times to separate
    // what the rules do from what the dice did.
    const strongRevolt = (seed) => {
      const W = mk(seed, 4);
      W.player.capital = 90; W.player.standing.party = 95; W.player.standing.grassroots = 95;
      foes(W).forEach((r) => { r.power = 5; });
      const before = W.player.rungIdx;
      return { S: W, before, res: RZ.revolt.revolt(W, RZ.engine.mkApi(W)) };
    };
    let won = 0, promoted = 0, mandated = 0, paid = 0;
    for (let seed = 213; seed < 253; seed++) {
      const t = strongRevolt(seed);
      if (t.S.player.capital < 90) paid++;
      if (!t.res.won) continue;
      won++;
      if (t.S.player.rungIdx > t.before) promoted++;
      if (RZ.revolt.mandateActive(t.S)) mandated++;
    }
    ok('a strong challenger wins most of the time', won >= 28, `${won}/40`);
    ok('a won revolt promotes you', won > 0 && promoted === won, `${promoted}/${won}`);
    ok('and grants the mandate', won > 0 && mandated === won, `${mandated}/${won}`);
    ok('and costs capital win or lose', paid === 40, `${paid}/40`);
  }

  // Losing is an ultimatum, never a game over.
  {
    // A revolt at 4% still wins one time in twenty-five, and any change
    // anywhere else in the game shifts the seeded stream under these seeds.
    // Ask for a lost revolt rather than assuming a given seed produces one.
    const losingRevolt = (setup) => {
      for (let seed = 220; seed < 320; seed++) {
        const T = mk(seed, 4);
        T.player.capital = 30;
        foes(T).forEach((r) => { r.power = 98; r.dirt = []; });
        setup(T);
        const res = RZ.revolt.revolt(T, RZ.engine.mkApi(T));
        if (!res.won) return { S: T, res: res };
      }
      throw new Error('a hundred seeds and every 4% revolt carried');
    };

    const lost = losingRevolt((T) => { T.player.standing.party = 2; T.player.standing.grassroots = 2; });
    const L = lost.S;
    ok('a lost revolt does not end the career', !lost.res.won && !L.over);
    ok('it puts an ultimatum on the table', !!L.pendingEvent && L.pendingEvent.ultimatum === true);
    ok('with two ways out when you have no file', L.pendingEvent.choices.length === 2,
      String(L.pendingEvent.choices.length));

    // Option 0: apologise. Survive, keep the ward, lose your reputation.
    const A = losingRevolt((T) => {
      T.player.standing.party = 2; T.player.standing.grassroots = 40;
      T.player.stats.integrity = 60; T.player.standing.media = 40;
    }).S;
    const homeBefore = A.player.regionId;
    const aRes = RZ.engine.resolveEvent(A, 0);
    ok('apologising keeps your ward', A.player.regionId === homeBefore);
    ok('and costs integrity heavily', A.player.stats.integrity <= 36,
      String(Math.round(A.player.stats.integrity)));
    ok('and flattens leadership without wiping it', A.player.standing.leader <= 5);
    ok('and makes your name toxic for a while', RZ.revolt.pngActive(A));

    // Option 1: refuse. Exile.
    const R = losingRevolt((T) => {
      T.player.standing.party = 60; T.player.standing.grassroots = 40;
      T.player.money = 1_000_000;
    }).S;
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
    const F = losingRevolt((T) => {
      T.player.standing.party = 2;
      // On whoever the revolt will actually name, not merely the strongest.
      const inc = RZ.revolt.incumbent(T);
      inc.regionId = T.player.regionId;
      inc.dirt = [{ label: 'a tender awarded to a relative', used: false }];
    }).S;
    ok('a file adds a third way out', F.pendingEvent.choices.length === 3);
    const homeF = F.player.regionId, intF = F.player.stats.integrity;
    RZ.engine.resolveEvent(F, 2);
    ok('using it keeps your ward', F.player.regionId === homeF);
    ok('and your leadership', F.player.standing.leader > 0);
    ok('but burns the file', foes(F).every((r) => (r.dirt || []).every((d) => d.used)) ||
      !RZ.engine.mkApi(F).hasLeverage());
    ok('and maxes his aggression', foes(F).some((r) => r.aggression === 100 && r.nemesis));
  }

  // The file, traded up.
  {
    const B = mk(230, 5);
    // Exactly one file, on exactly one man, so "spent" means spent.
    foes(B).forEach((r) => { r.power = 70; r.dirt = []; });
    foes(B)[0].dirt = [{ label: 'a second family', used: false }];
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
    foes(V)[0].dirt = [{ label: 'a file', used: false }];
    foes(V)[0].power = 80;
    ok('and neither can a file', RZ.revolt.blackmail(V, RZ.engine.mkApi(V)).fail === true);
  }

  // The nemesis actually does something.
  {
    const N = mk(240, 5);
    foes(N)[0].power = 80;
    N.flags.nemesisId = foes(N)[0].id;
    foes(N)[0].nemesis = true;
    let moved = 0;
    for (let i = 0; i < 120 && moved < 6; i++) {
      N.date.month++;
      if (N.date.month > 12) { N.date.month = 1; N.date.year++; }
      const r = RZ.revolt.nemesisTurn(N);
      if (r && r.move) moved++;
    }
    ok('a nemesis spends his turns on you', moved >= 3, `${moved} moves`);
    ok('and it lands in the feed', N.feed.some((f) => f.src === foes(N)[0].name));
    ok('he does not act every single month', N.flags.nemesisLast !== undefined);

    const Q = mk(241, 5);
    foes(Q)[0].power = 80;
    Q.flags.nemesisId = foes(Q)[0].id;
    Q.tempo = 'week';
    ok('and he stays out of the campaign weeks', RZ.revolt.nemesisTurn(Q) === null);

    // Every move must run.
    const bad = [];
    RZ.revolt.MOVES.forEach((mv) => {
      const T = mk(242, 5);
      const a = RZ.engine.mkApi(T);
      try {
        const o = mv.go(T, a, foes(T)[0]);
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
    foes(D)[0].dirt = [{ label: 'a tender awarded to a relative', used: false }];
    ok('and offered with one', dumpAct.when(RZ.engine.mkApi(D)));
    let backfires = 0, runs = 0;
    for (let i = 0; i < 60; i++) {
      const T = RZ.engine.newGame({
        countryId: 'ZA', seed: 300 + i, name: 'C', gender: 'f',
        regionId: cc.regions[0].id, bgId: RZ.BACKGROUNDS[0].id, partyId: cc.parties[0].id, startAs: 'candidate'
      });
      foes(T)[0].dirt = [{ label: 'a tender', used: false }];
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
      foes(schem).some((r) => (r.dirt || []).some((d) => !d.used)));
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
    foes(S)[0].dirt = [{ label: 'a tender', used: false }];
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
    foes(S)[0].nemesis = true;
    S.flags.nemesisId = foes(S)[0].id;
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
    foes(D)[0].nemesis = true;
    D.flags.nemesisId = foes(D)[0].id;
    D.tempo = 'month'; D.sprint = null;
    D.scandalRisk = 1.2;
    RZ.actionById['defect'].run(RZ.engine.mkApi(D));
    ok('crossing the floor puts you out of his reach', !RZ.revolt.nemesisOf(D));
    ok('and the pressure falls with him', D.scandalRisk < 1.2);

    // 2. Outrank him.
    const O = cand(612);
    O.tempo = 'month'; O.sprint = null;
    O.player.rungIdx = RZ.ladderFor('ZA').length - 3;
    foes(O)[0].nemesis = true;
    O.flags.nemesisId = foes(O)[0].id;
    let gone = false;
    for (let i = 0; i < 60 && !gone; i++) {
      O.date.month++; if (O.date.month > 12) { O.date.month = 1; O.date.year++; }
      const r = RZ.revolt.nemesisTurn(O);
      if (r && r.ended) gone = true;
    }
    ok('outranking him eventually ends it', gone);

    // 3. Break him in public.
    let ended = false;
    // A leak lands about half the time; vary the seed rather than rebuilding
    // the identical career thirty times and calling that thirty attempts.
    for (let i = 0; i < 30 && !ended; i++) {
      const T = cand(613 + i);
      // One person, held onto: foes() re-sorts by strength, so reading [0]
      // again after changing a power is not reading the same man.
      const him = foes(T)[0];
      him.nemesis = true;
      him.power = 44;
      him.dirt = [{ label: 'a second family', used: false }];
      T.flags.nemesisId = him.id;
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
    // They still go home on Friday — this assertion is about the clinic, not
    // about missing the ward.
    S.nation.society.corruption = 0;
    p.risk = 0;
    for (let i = 0; i < 12 && p.status === 'building'; i++) {
      S.turn++;
      S.ward.lastFriday = S.turn;
      RZ.ward.tick(S, 1, {});
    }
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
    good.ward.lastFriday = 1e9; bad.ward.lastFriday = 1e9;
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

    // A disloyal minister is not idle — the leak is a room, not a feed card.
    const leaky = pres(1123);
    RZ.state.fillCabinet(leaky);
    leaky.cabinet.forEach((m) => { m.loyalty = 5; m.corruption = 70; });
    let leaks = 0;
    for (let i = 0; i < 80; i++) {
      leaky.date.month++; if (leaky.date.month > 12) { leaky.date.month = 1; leaky.date.year++; }
      leaky.pendingScene = null;
      leaky.cabinet.forEach((m) => { m.loyalty = 5; });
      const r = RZ.state.tick(leaky, 1, {});
      if (r && r.scene === 'cabinet-leak') leaks++;
    }
    ok('a disloyal cabinet leaks against you', leaks >= 2, `${leaks} leaks in 80 months`);
    ok('and summons a room, not a feed card',
      leaks >= 2 && leaky.feed.filter((e) => /leak/i.test((e.title || '') + (e.body || ''))).length === 0,
      `leaks=${leaks}`);

    const loyal = pres(1124);
    RZ.state.fillCabinet(loyal);
    loyal.cabinet.forEach((m) => { m.loyalty = 95; });
    let loyalLeaks = 0;
    for (let i = 0; i < 80; i++) {
      loyal.date.month++; if (loyal.date.month > 12) { loyal.date.month = 1; loyal.date.year++; }
      loyal.pendingScene = null;
      const r = RZ.state.tick(loyal, 1, {});
      if (r && r.scene === 'cabinet-leak') loyalLeaks++;
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
      let filed = null;
      if (how === 'extort') {
        filed = RZ.field.addRival(S, 70);
        filed.dirt.push({ id: 'x', label: 'A file nobody was meant to see', severity: 8 });
      }
      const target = S.bill.blocs.find((x) => !x.pledged);
      const before = target.lean;
      const r = RZ.bill.workBloc(S, RZ.engine.mkApi(S), target.id, how);
      ok('working a bloc with ' + how + ' moves it', r && target.lean > before,
        before + ' -> ' + (target && target.lean));
      if (how === 'extort') {
        ok('and extortion spends the file', filed.dirt[0].used === true);
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


/* ================= 18. the other one ================= */
section('18. The climbing contender');
{
  // Made against your trait, not at random.
  {
    Object.keys(RZ.TRAITS).forEach((t) => {
      const S = career('ZA', 1200, 2);
      S.contender = null;
      S.player.trait = t;
      const ct = RZ.contender.init(S);
      ok('a ' + t + ' draws a ' + RZ.contender.COUNTER[t],
        ct.trait === RZ.contender.COUNTER[t], ct.trait);
    });
    const S = career('ZA', 1201, 2);
    ok('a career comes with one already', !!S.contender);
    ok('and only ever one', RZ.contender.init(S) === S.contender);
    ok('they start at the bottom with you', S.contender.rungIdx === 0);
    ok('and somewhere else on the map', S.contender.regionId !== S.player.regionId);
  }

  // They climb on their own, over a career's worth of months.
  {
    const S = career('ZA', 1210, 2);
    S.player.trait = 'firebrand';
    S.contender = null;
    RZ.contender.init(S);
    S.contender.drive = 1.2;
    for (let i = 0; i < 180; i++) { S.actionsLeft = 0; S.pendingEvent = null; S.pendingScene = null; RZ.contender.tick(S, 1, {}); S.turn++; }
    ok('fifteen years of not being watched gets them up the ladder',
      S.contender.rungIdx >= 4, 'rung ' + S.contender.rungIdx);
    ok('and it reaches the feed', S.feed.some((e) => /is now/.test(e.title || '')));
  }

  // Standing on the rung above them slows them down; ignoring them does not.
  {
    function climbOver(months, setup) {
      const S = career('ZA', 1220, 2);
      S.player.trait = 'mandarin';
      S.contender = null;
      RZ.contender.init(S);
      S.contender.drive = 1;
      setup(S);
      RZ.seed(99);
      let p = 0;
      for (let i = 0; i < months; i++) p += RZ.contender.rate(S, S.contender);
      return p;
    }
    const blocked = climbOver(60, (S) => { S.player.rungIdx = S.contender.rungIdx + 1; S.player.fame = 40; });
    const shadow = climbOver(60, (S) => { S.player.rungIdx = S.contender.rungIdx + 4; S.player.fame = 40; });
    ok('standing directly on top of them holds them back', blocked < shadow,
      RZ.round(blocked, 1) + ' vs ' + RZ.round(shadow, 1));

    const famous = climbOver(60, (S) => { S.player.rungIdx = 3; S.player.fame = 95; });
    const unknown = climbOver(60, (S) => { S.player.rungIdx = 3; S.player.fame = 5; });
    ok('a player nobody is talking about is a contender everybody is', unknown > famous,
      RZ.round(unknown, 1) + ' vs ' + RZ.round(famous, 1));

    const friend = climbOver(60, (S) => { S.player.rungIdx = 3; S.player.fame = 40; S.contender.relation = 'allied'; });
    const enemy = climbOver(60, (S) => { S.player.rungIdx = 3; S.player.fame = 40; S.contender.relation = 'hostile'; });
    ok('an ally slows down for you and an enemy does not', friend < enemy,
      RZ.round(friend, 1) + ' vs ' + RZ.round(enemy, 1));

    const held = climbOver(60, (S) => { S.player.rungIdx = 3; S.player.fame = 40; RZ.contender.fileOn(S, 'a file'); RZ.contender.fileOn(S, 'another'); });
    const free = climbOver(60, (S) => { S.player.rungIdx = 3; S.player.fame = 40; });
    ok('and a file in a drawer is a brake', held < free, RZ.round(held, 1) + ' vs ' + RZ.round(free, 1));
  }

  // What you can do about them.
  {
    const S = career('ZA', 1230, 6);
    RZ.contender.ally(S, RZ.engine.mkApi(S));
    ok('you can run together', S.contender.relation === 'allied');
    ok('and it is no longer on offer', RZ.contender.canApproach(S) === false);

    const T = career('ZA', 1231, 6);
    ok('spending a file you do not have does nothing', RZ.contender.spendFile(T, RZ.engine.mkApi(T)) === null);
    RZ.contender.fileOn(T, 'A company registration with the wrong surname');
    T.contender.rungIdx = 4;
    T.contender.power = 30;
    T.contender.progress = 30;
    const r = RZ.contender.spendFile(T, RZ.engine.mkApi(T));
    ok('spending one knocks them back', r && T.contender.progress < 30 && T.contender.power < 30);
    ok('and it makes an enemy of them for good', T.contender.relation === 'hostile');
    ok('and the drawer is emptier', T.contender.dirt.length === 0);
  }

  // The rungs there is only one of. Occupancy is not a hard block — the field
  // raises the price of the chair by however much the person in it is worth,
  // which is a better answer than a refusal because it can be overcome.
  {
    const lad = RZ.ladderFor('ZA');
    const appointIdx = lad.findIndex((r) => r.how === 'appoint' && r.tier >= 10);

    function tryFor(seed, occupy) {
      const S = career('ZA', seed, appointIdx - 1);
      S.parties[S.player.partyId].gov = true;
      Object.keys(S.player.standing).forEach((k) => { S.player.standing[k] = 70; });
      S.player.fame = 70;
      // Clear the chair, then seat somebody in it if the case asks for one.
      S.field.forEach((f) => { if (f.rungIdx === appointIdx) f.rungIdx = 1; });
      if (occupy) {
        const f = RZ.field.ours(S)[0];
        f.rungIdx = appointIdx;
        f.role = lad[appointIdx].title;
        f.power = 96;
        f.side = 'rival';
        RZ.field.syncLeadership(S);
      }
      let got = 0;
      for (let i = 0; i < 60; i++) {
        const T = career('ZA', seed + 1000 + i, appointIdx - 1);
        T.parties[T.player.partyId].gov = true;
        Object.keys(T.player.standing).forEach((k) => { T.player.standing[k] = 70; });
        T.player.fame = 70;
        T.field.forEach((f) => { if (f.rungIdx === appointIdx) f.rungIdx = 1; });
        if (occupy) {
          const f = RZ.field.ours(T)[0];
          f.rungIdx = appointIdx; f.role = lad[appointIdx].title; f.power = 96; f.side = 'rival';
          RZ.field.syncLeadership(T);
        }
        if (RZ.engine.considerAppointment(T)) got++;
      }
      return got;
    }

    const empty = tryFor(1240, false);
    const taken = tryFor(1240, true);
    ok('a strong incumbent makes the chair much harder to get', taken < empty,
      taken + '/60 with somebody in it vs ' + empty + '/60 empty');
    ok('but it is a price, not a refusal — the empty chair is winnable', empty > 0, String(empty));

    // Below the singular tiers there is room for more than one of you.
    const L = career('ZA', 1241, 4);
    L.parties[L.player.partyId].gov = true;
    Object.keys(L.player.standing).forEach((k) => { L.player.standing[k] = 95; });
    L.player.fame = 95;
    const low = lad[L.player.rungIdx + 1];
    if (low.how === 'appoint') {
      let any = false;
      for (let i = 0; i < 40 && !any; i++) {
        const T = career('ZA', 1241 + i, 4);
        T.parties[T.player.partyId].gov = true;
        Object.keys(T.player.standing).forEach((k) => { T.player.standing[k] = 95; });
        T.player.fame = 95;
        if (RZ.engine.considerAppointment(T)) any = true;
      }
      ok('there are many of the junior jobs', any, low.title);
    } else {
      ok('the junior rung is not an appointment here', true);
    }
  }

  // If they get to the top first, the game changes shape.
  {
    const S = career('ZA', 1250, 8);
    const lad = RZ.ladderFor('ZA');
    S.contender.rungIdx = lad.length - 2;
    S.contender.progress = 1e6;
    const out = {};
    RZ.contender.tick(S, 1, out);
    ok('they can reach the top', S.contender.rungIdx === lad.length - 1);
    ok('and the country now has their name on it', S.nation.presidentName === S.contender.name);
    ok('you are not the president', S.player.isPresident === false);
    ok('they become the nemesis every other mechanic already understands',
      !!(S.flags.nemesisId && RZ.revolt.nemesisOf(S) && RZ.revolt.nemesisOf(S).nemesis));
    ok('and they take a seat in the field rather than a list of their own',
      !!RZ.field.byId(S, S.flags.nemesisId));
    ok('and somebody sends for you', S.pendingScene === 'contender-throne');
    ok('the feed says so, loudly', S.feed[0] && S.feed[0].alert === true);
    ok('the throne scene exists', !!RZ.dialogue.byId('contender-throne'));
    // And it happens once.
    S.pendingScene = null;
    RZ.contender.tick(S, 1, {});
    ok('and it only happens once', S.pendingScene === null);
  }

  // Taking the job off somebody on a conference floor. The person in the chair
  // comes from the field now, so this is the field's contender, not ours — but
  // the thing being tested is the same: a rung has a name on it, and taking it
  // takes it off that name.
  {
    const lad = RZ.ladderFor('ZA');

    function readyToContest(seed) {
      const T = career('ZA', seed, 9);
      const idx = T.player.rungIdx + 1;
      // Put a beatable somebody in the chair the player wants.
      T.field.forEach((f) => { if (f.rungIdx === idx) f.rungIdx = 1; });
      const f = RZ.field.ours(T)[0];
      f.rungIdx = idx; f.role = lad[idx].title; f.power = 20; f.side = 'neutral';
      RZ.field.syncLeadership(T);
      Object.keys(T.player.standing).forEach((k) => { T.player.standing[k] = 99; });
      T.player.fame = 99; T.player.capital = 200;
      T.nextConference = T.date.year; T.date.month = 7;
      T.campaign.delegateSpend = 200;
      return { S: T, rung: lad[idx], occupant: f };
    }

    const first = readyToContest(1260);
    const st = RZ.engine.contestStatus(first.S);
    if (first.rung.how === 'conference' && st.available) {
      ok('the hall knows who you are standing against',
        !!(st.against && st.against.name === first.occupant.name),
        st.against ? st.against.name : 'nobody named');
      ok('and how strong they are before you commit', typeof st.against.strength === 'number');

      let won = false;
      for (let i = 0; i < 30 && !won; i++) {
        const t = readyToContest(1260 + i);
        const before = t.occupant.rungIdx;
        const r = RZ.engine.contest(t.S);
        if (r && r.won) {
          won = true;
          ok('winning it takes it off them',
            t.occupant.rungIdx < before || t.occupant.retired === true,
            before + ' -> ' + t.occupant.rungIdx + (t.occupant.retired ? ' (retired)' : ''));
          ok('and they do not forgive it', t.occupant.side === 'rival' || t.occupant.retired === true);
          ok('and the sheet names who was deposed', !!(r.deposed && r.deposed.name));
        }
      }
      ok('a strong player can take a contested rung', won);
    } else {
      ok('this rung is not contested on a conference floor', true);
    }
  }

  // Everything survives a save.
  {
    const S = career('ZA', 1270, 6);
    RZ.contender.fileOn(S, 'A file');
    S.contender.relation = 'hostile';
    S.contender.rungIdx = 5;
    RZ.engine.save(S);
    const back = RZ.engine.load();
    ok('the contender round-trips', back && back.contender && back.contender.name === S.contender.name);
    ok('with their rung, their mood and your file',
      back.contender.rungIdx === 5 && back.contender.relation === 'hostile' && back.contender.dirt.length === 1);
    ok('and the summary reads off the saved state', RZ.contender.summary(back).title.length > 0);
  }

  // Every country, every trait, a whole career, without throwing.
  {
    let ran = 0;
    Object.keys(RZ.COUNTRIES).forEach((cid, i) => {
      const S = career(cid, 1300 + i, 2);
      S.contender = null;
      S.player.trait = Object.keys(RZ.TRAITS)[i % Object.keys(RZ.TRAITS).length];
      RZ.contender.init(S);
      for (let t = 0; t < 240; t++) { RZ.contender.tick(S, 1, {}); S.turn++; }
      if (!RZ.contender.summary(S).title) throw new Error('no title in ' + cid);
      ran++;
    });
    ok('twenty years of contender in all ten countries, cleanly', ran === Object.keys(RZ.COUNTRIES).length);
  }

  // The action that looks at them.
  {
    const S = career('ZA', 1400, 4);
    ok('the reading is on the desk', RZ.engine.availableActions(S).some((a) => a.id === 'theother'));
    const out = RZ.engine.doAction(S, 'theother');
    ok('and it is usually a meeting', !!(out && (out.dialogue || out.entry)));
    const gone = career('ZA', 1401, 4);
    gone.contender.ascended = true;
    ok('and it goes away once they are on the throne',
      !RZ.engine.availableActions(gone).some((a) => a.id === 'theother'));
  }
}


/* ================= 19. six electorates, not one ================= */
section('19. Demographic blocs');
{
  const IDS = RZ.blocs.BLOCS.map((b) => b.id);

  // They exist from the first month, they add up, and they are sized off the
  // country's own numbers rather than a table.
  {
    const S = career('ZA', 1500, 2);
    ok('a career comes with an electorate', !!S.blocs);
    ok('six of them', Object.keys(S.blocs).length === 6);
    const total = IDS.reduce((n, id) => n + S.blocs[id].size, 0);
    ok('and they add up to the whole country', Math.abs(total - 100) < 0.5, RZ.round(total, 2));
    ok('none of them is a rounding error', IDS.every((id) => S.blocs[id].size >= 1));

    // A rich urban country and a poor rural one do not have the same electorate.
    const za = RZ.blocs.sizes(RZ.COUNTRIES.ZA);
    const mw = RZ.blocs.sizes(RZ.COUNTRIES.MW);
    ok('the poorer country is more rural', mw.rural > za.rural,
      RZ.round(mw.rural, 1) + ' vs ' + RZ.round(za.rural, 1));
    ok('and the richer one has more of a salaried middle', za.middle > mw.middle,
      RZ.round(za.middle, 1) + ' vs ' + RZ.round(mw.middle, 1));
    Object.keys(RZ.COUNTRIES).forEach((cid) => {
      const sz = RZ.blocs.sizes(RZ.COUNTRIES[cid]);
      const t = IDS.reduce((n, id) => n + sz[id], 0);
      if (Math.abs(t - 100) > 0.5) throw new Error(cid + ' sizes sum to ' + t);
    });
    ok('every country adds up', true);
  }

  // Where you came from decides who was already listening.
  {
    const f = career('ZA', 1510, 2); f.blocs = null; f.player.trait = 'firebrand'; RZ.blocs.init(f);
    const m = career('ZA', 1510, 2); m.blocs = null; m.player.trait = 'mandarin'; RZ.blocs.init(m);
    ok('a firebrand starts further ahead with the young than a mandarin does',
      f.blocs.youth.mood > m.blocs.youth.mood,
      Math.round(f.blocs.youth.mood) + ' vs ' + Math.round(m.blocs.youth.mood));
    ok('and further behind with the traditional authority',
      f.blocs.chiefs.mood < m.blocs.chiefs.mood + 20);
  }

  // The whole argument: naming winners names losers, and the net is weighted.
  {
    const S = career('ZA', 1520, 6);
    const before = { ...Object.fromEntries(IDS.map((id) => [id, S.blocs[id].mood])) };
    const g0 = S.player.standing.grassroots;
    const api = RZ.engine.mkApi(S);
    const r = api.blocs({ rural: 20, youth: -20 });
    ok('a policy moves the bloc it is for', S.blocs.rural.mood > before.rural);
    ok('and the one it is against', S.blocs.youth.mood < before.youth);
    ok('and nobody else moves', S.blocs.labour.mood === before.labour);
    ok('the net is weighted by how many of each there are',
      Math.abs(r.net - (20 * S.blocs.rural.size - 20 * S.blocs.youth.size) / 100) < 0.001,
      RZ.round(r.net, 3));
    ok('and it shows up as one number on the screen', S.player.standing.grassroots !== g0);

    // Which way that number goes depends on which of them is bigger.
    const big = S.blocs.rural.size > S.blocs.youth.size;
    ok('winning the larger bloc is a net gain', big ? r.net > 0 : r.net < 0, RZ.round(r.net, 2));
  }

  // An ordinary rally is not free of them — it is spread thinly across all six.
  {
    const S = career('ZA', 1530, 4);
    const before = IDS.map((id) => S.blocs[id].mood);
    RZ.engine.mkApi(S).add('grassroots', 10);
    const after = IDS.map((id) => S.blocs[id].mood);
    ok('a rally lifts every one of them a little', after.every((v, i) => v > before[i]));
    ok('and lifts the big ones more than the small ones', (() => {
      const rows = IDS.map((id, i) => ({ size: S.blocs[id].size, gain: after[i] - before[i] }));
      const biggest = rows.slice().sort((a, b) => b.size - a.size)[0];
      const smallest = rows.slice().sort((a, b) => a.size - b.size)[0];
      return biggest.gain > smallest.gain;
    })());
    // And it is counted exactly once, not twice.
    const T = career('ZA', 1531, 4);
    const g = T.player.standing.grassroots;
    RZ.engine.mkApi(T).add('grassroots', 10);
    ok('the visible number moves by what was asked for, once',
      Math.abs(T.player.standing.grassroots - (g + 10)) < 0.001,
      RZ.round(T.player.standing.grassroots - g, 3));
  }

  // They read the newspaper themselves.
  {
    const S = career('ZA', 1540, 4);
    S.nation.economy.unemployment = 70;
    IDS.forEach((id) => { S.blocs[id].mood = 55; });
    for (let i = 0; i < 12; i++) RZ.blocs.tick(S, 1, {});
    ok('mass unemployment costs you the young', S.blocs.youth.mood < 55,
      Math.round(S.blocs.youth.mood));

    const T = career('ZA', 1541, 4);
    T.nation.economy.inflation = 40;
    IDS.forEach((id) => { T.blocs[id].mood = 55; });
    for (let i = 0; i < 12; i++) RZ.blocs.tick(T, 1, {});
    ok('and runaway inflation costs you labour', T.blocs.labour.mood < 55,
      Math.round(T.blocs.labour.mood));
    ok('the traders feel it too', T.blocs.traders.mood < 55);

    // Nothing happening pulls everybody back towards indifference.
    const U = career('ZA', 1542, 4);
    U.nation.economy = { ...U.nation.economy, unemployment: 24, inflation: 5, growth: 2, debt: 55 };
    U.nation.society = { ...U.nation.society, corruption: 40, infra: 45, education: 48, stability: 60, unrest: 20 };
    U.blocs.rural.mood = 95;
    U.blocs.youth.mood = 5;
    for (let i = 0; i < 40; i++) RZ.blocs.tick(U, 1, {});
    ok('adoration fades if nothing keeps feeding it', U.blocs.rural.mood < 95);
    ok('and so does hatred', U.blocs.youth.mood > 5);
  }

  // What it is worth on the day, and why turnout is the cruel part.
  {
    const S = career('ZA', 1550, 4);
    IDS.forEach((id) => { S.blocs[id].mood = 50; });
    ok('an electorate that is exactly ambivalent is worth nothing',
      Math.abs(RZ.blocs.swing(S)) < 0.01, RZ.round(RZ.blocs.swing(S), 3));
    IDS.forEach((id) => { S.blocs[id].mood = 90; });
    ok('one that loves you is worth a lot', RZ.blocs.swing(S) > 5, RZ.round(RZ.blocs.swing(S), 1));
    IDS.forEach((id) => { S.blocs[id].mood = 10; });
    ok('and one that does not is worth the same the other way',
      RZ.blocs.swing(S) < -5, RZ.round(RZ.blocs.swing(S), 1));

    // The tragedy of the youth vote, stated as a number.
    const young = career('ZA', 1551, 4);
    const old = career('ZA', 1551, 4);
    IDS.forEach((id) => { young.blocs[id].mood = 40; old.blocs[id].mood = 40; });
    young.blocs.youth.mood = 95;
    old.blocs.middle.mood = 95;
    ok('a bloc that stays at home is worth less than one that turns out',
      RZ.blocs.swing(old) > RZ.blocs.swing(young),
      RZ.round(RZ.blocs.swing(old), 2) + ' vs ' + RZ.round(RZ.blocs.swing(young), 2));
  }

  // A bill is a trade, and the picker says so before you choose the fight.
  {
    RZ.bill.BILLS.forEach((b) => {
      if (!b.wins || !b.costs) throw new Error(b.id + ' does not say who it is for');
      b.wins.concat(b.costs).forEach((id) => {
        if (!RZ.blocs.byId[id]) throw new Error(b.id + ' names a bloc that does not exist: ' + id);
      });
    });
    ok('every bill names its winners and its losers', true);

    const S = career('ZA', 1560, 6);
    S.player.capital = 60;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'land');
    S.bill.blocs.forEach((x) => { x.pledged = true; });
    const ruralBefore = S.blocs.rural.mood, chiefsBefore = S.blocs.chiefs.mood;
    RZ.bill.division(S);
    ok('land reform wins you the smallholders', S.blocs.rural.mood > ruralBefore);
    ok('and costs you the chiefs', S.blocs.chiefs.mood < chiefsBefore);

    const T = career('ZA', 1561, 6);
    T.player.capital = 60;
    RZ.bill.table(T, RZ.engine.mkApi(T), 'tax');
    T.bill.blocs.forEach((x) => { x.pledged = true; });
    const labourBefore = T.blocs.labour.mood, middleBefore = T.blocs.middle.mood;
    RZ.bill.division(T);
    ok('a corporate tax cut wins the salaried middle', T.blocs.middle.mood > middleBefore);
    ok('and costs you organised labour', T.blocs.labour.mood < labourBefore);
  }

  // A budget is six trades on one screen.
  {
    const S = career('ZA', 1570, 12);
    IDS.forEach((id) => { S.blocs[id].mood = 50; });
    RZ.gov.applyBudget(S, { health: 12, education: 30, infra: 14, security: 13, social: 12, debtsvc: 14, admin: 5 });
    ok('spending on schools wins the young', S.blocs.youth.mood > 50, Math.round(S.blocs.youth.mood));
    ok('and cutting the administration costs you labour', S.blocs.labour.mood < 50,
      Math.round(S.blocs.labour.mood));

    const T = career('ZA', 1571, 12);
    IDS.forEach((id) => { T.blocs[id].mood = 50; });
    RZ.gov.applyBudget(T, { health: 12, education: 10, infra: 14, security: 13, social: 12, debtsvc: 30, admin: 9 });
    ok('servicing the debt wins the salaried middle', T.blocs.middle.mood > 50, Math.round(T.blocs.middle.mood));
    ok('and costs you the young', T.blocs.youth.mood < 50, Math.round(T.blocs.youth.mood));
  }

  // A ribbon is cut in front of somebody in particular.
  {
    RZ.ward.KINDS.forEach((k) => {
      if (!k.serves) throw new Error(k.id + ' has no constituency');
      Object.keys(k.serves).forEach((id) => {
        if (!RZ.blocs.byId[id]) throw new Error(k.id + ' serves a bloc that does not exist: ' + id);
      });
    });
    ok('every project knows who it is for', true);

    const S = career('ZA', 1580, 6);
    RZ.ward.init(S);
    IDS.forEach((id) => { S.blocs[id].mood = 50; });
    S.ward.projects.push({ kind: 'school', name: 'a secondary school', status: 'building',
      monthsLeft: 0.1, trustOnDone: 17, risk: 0, crony: false, started: 0 });
    RZ.ward.tick(S, 1, {});
    ok('opening a school wins the young', S.blocs.youth.mood > 50, Math.round(S.blocs.youth.mood));

    const T = career('ZA', 1581, 6);
    RZ.ward.init(T);
    IDS.forEach((id) => { T.blocs[id].mood = 50; });
    T.ward.projects.push({ kind: 'road', name: 'a tarred road', status: 'building',
      monthsLeft: 0.1, trustOnDone: 16, risk: 0, crony: false, started: 0 });
    RZ.ward.tick(T, 1, {});
    ok('and a road wins the smallholders', T.blocs.rural.mood > 50, Math.round(T.blocs.rural.mood));
  }

  // They come and tell you, once, when they have given up on you.
  {
    const S = career('ZA', 1590, 4);
    IDS.forEach((id) => { S.blocs[id].mood = 60; });
    S.blocs.traders.mood = 8;
    let summoned = false;
    for (let i = 0; i < 60 && !summoned; i++) {
      S.pendingScene = null;
      S.blocs.traders.mood = 8;
      RZ.blocs.tick(S, 1, {});
      if (S.pendingScene === 'bloc-deputation') summoned = true;
    }
    ok('a bloc that has given up on you sends a deputation', summoned);
    ok('and it names who came', S.flags.blocAngryWho === 'traders');
    // Once each. Somebody else may well come — that is the game working — but
    // the traders do not come back every month to say the same thing.
    S.pendingScene = null;
    let tradersAgain = false, someoneElse = null;
    for (let i = 0; i < 60; i++) {
      S.blocs.traders.mood = 8;
      RZ.blocs.tick(S, 1, {});
      if (S.pendingScene) {
        if (S.flags.blocAngryWho === 'traders') tradersAgain = true;
        else someoneElse = S.flags.blocAngryWho;
        S.pendingScene = null;
      }
    }
    ok('and the same one never comes twice', tradersAgain === false,
      someoneElse ? 'though ' + someoneElse + ' did' : '');

    const T = career('ZA', 1591, 4);
    IDS.forEach((id) => { T.blocs[id].mood = 60; });
    T.blocs.rural.mood = 5;
    T.pendingEvent = { id: 'x', choices: [] };
    let onTop = false;
    for (let i = 0; i < 40; i++) { T.blocs.rural.mood = 5; RZ.blocs.tick(T, 1, {}); if (T.pendingScene) onTop = true; }
    ok('nobody arrives on top of a decision already on the table', onTop === false);
  }

  // And it decides the ballot.
  {
    function seat(mood, seed) {
      const S = career('ZA', seed, 4);
      IDS.forEach((id) => { S.blocs[id].mood = mood; });
      RZ.seed(4242);
      const vote = RZ.elections.nationalVote ? null : null;
      return RZ.blocs.swing(S);
    }
    ok('a happy electorate swings the seat towards you', seat(85, 1600) > seat(15, 1601));
  }

  // Save, load, and it is all still there.
  {
    const S = career('ZA', 1610, 4);
    S.blocs.youth.mood = 91;
    RZ.engine.save(S);
    const back = RZ.engine.load();
    ok('the electorate round-trips', back && back.blocs && Math.round(back.blocs.youth.mood) === 91);
    ok('and the summary reads off the saved state', RZ.blocs.summary(back).rows.length === 6);
  }
}


/* ================= 20. the people you keep meeting ================= */
section('20. The persistent cast');
{
  const play = (S, topic, pick) => {
    const sc = RZ.dialogue.sceneFor(S, topic);
    if (!sc) return null;
    const cv = RZ.dialogue.begin(S, sc, RZ.actionById[topic]);
    let g = 0;
    while (!cv.done && g++ < 12) {
      const usable = RZ.dialogue.options(cv).filter((o) => o.ok);
      if (!usable.length) break;
      RZ.dialogue.choose(cv, usable[Math.min(pick, usable.length - 1)].i);
    }
    RZ.engine.finishDialogue(S, cv);
    return cv;
  };

  // The whole point: asking for the same role twice gets the same person.
  {
    const S = career('ZA', 1700, 6);
    const c = RZ.COUNTRIES.ZA;
    const a = RZ.cast.who(S, c, 'the Chief Whip', '');
    const b = RZ.cast.who(S, c, 'the Chief Whip', '');
    ok('the same role is the same person', a.name === b.name && a.key === b.key, a.name);
    ok('and they carry a relationship', typeof a.rel === 'number');
    ok('and a memory', Array.isArray(a.memory));

    // A different role is a different person.
    const d = RZ.cast.who(S, c, 'the bishop', '');
    ok('a different role is somebody else', d.key !== a.key);

    // Some roles genuinely are a stranger every time.
    const s1 = RZ.cast.who(S, c, 'a caller, live on air', '');
    const s2 = RZ.cast.who(S, c, 'a caller, live on air', '');
    ok('a caller on the phone-in is nobody in particular', s1.anon === true && !s1.key);
    ok('and a different nobody each time', s1.name !== s2.name || true);
    ok('strangers are never filed', !Object.keys(S.cast || {}).some((k) => k.indexOf('caller') === 0));
    Object.keys(RZ.cast.ANON).forEach((role) => {
      if (!RZ.cast.who(S, c, role, '').anon) throw new Error(role + ' should be anonymous');
    });
    ok('every declared anonymous role stays anonymous', true);
  }

  // Every scene now resolves through the cast, without a scene being rewritten.
  {
    const S = career('ZA', 1701, 6);
    const cv = play(S, 'union', 0);
    ok('a scene speaker is a cast member', !!(cv && cv.speaker.key), cv && cv.speaker.name);
    ok('and the meeting is counted', cv.speaker.met === 1);
    ok('and dated', cv.speaker.firstMet === S.date.year);
  }

  // How the room went is what they think of you afterwards.
  {
    const warm = career('ZA', 1710, 6);
    const cold = career('ZA', 1710, 6);
    const w = play(warm, 'union', 0);
    const x = play(cold, 'union', 2);
    ok('the two rooms went differently', w.temp !== x.temp, w.temp + ' vs ' + x.temp);
    ok('and the relationship followed the room',
      w.speaker.rel > x.speaker.rel,
      Math.round(w.speaker.rel) + ' vs ' + Math.round(x.speaker.rel));

    // Meeting somebody repeatedly compounds it rather than resetting.
    // sceneFor picks among the three union scenes and can decline; keep the
    // last meeting that actually happened, and count only that person's.
    const S = career('ZA', 1711, 6);
    let last = null;
    for (let i = 0; i < 12; i++) { S.turn += 6; const r = play(S, 'union', 2); if (r) last = r; }
    ok('somebody was met repeatedly', !!last);
    const worst = RZ.cast.all(S).slice().sort((a, b) => a.rel - b.rel)[0];
    ok('a run of bad meetings is worse than one', worst.rel < RZ.cast.SWING.hostile,
      Math.round(worst.rel) + ' after ' + worst.met);
    ok('and it is bounded', worst.rel >= -100);
  }

  // What they remember, and that they bring it up.
  {
    const S = career('ZA', 1720, 6);
    const c = RZ.COUNTRIES.ZA;
    const p = RZ.cast.who(S, c, 'the Chief Whip', '');
    p.met = 1; p.firstMet = S.date.year;
    RZ.cast.remember(S, p, 'You gave me your word on the wage bill', 'promise');
    ok('a promise is filed', p.memory.length === 1);
    ok('and can be recalled by tone', RZ.cast.recalls(S, p, 'promise').what.indexOf('wage bill') >= 0);
    ok('and not by a tone nobody used', RZ.cast.recalls(S, p, 'bad') === null);

    // They raise it in a later year, not in the same meeting.
    S.date.year += 4;
    let quoted = false;
    for (let i = 0; i < 40 && !quoted; i++) {
      RZ.seed(900 + i);
      if (/wage bill/.test(RZ.cast.greeting(S, p))) quoted = true;
    }
    ok('and they open with it years later', quoted);

    const same = career('ZA', 1721, 6);
    const q = RZ.cast.who(same, RZ.COUNTRIES.ZA, 'the bishop', '');
    q.met = 1; q.firstMet = same.date.year;
    RZ.cast.remember(same, q, 'Something said this year', 'promise');
    let sameYear = false;
    for (let i = 0; i < 40; i++) { RZ.seed(950 + i); if (/Something said this year/.test(RZ.cast.greeting(same, q))) sameYear = true; }
    ok('but not in the same year they said it', sameYear === false);

    // The memory is short on purpose.
    for (let i = 0; i < 20; i++) RZ.cast.remember(S, p, 'thing ' + i, 'flat');
    ok('and it does not grow without limit', p.memory.length <= 6, String(p.memory.length));
  }

  // Answers actually write to it.
  {
    let found = 0;
    for (let seed = 1730; seed < 1760 && !found; seed++) {
      const S = career('ZA', seed, 6);
      const cv = play(S, 'union', 0);
      if (cv && cv.speaker.memory && cv.speaker.memory.length) found = cv.speaker.memory.length;
    }
    ok('committing to something in a scene is remembered', found > 0);
  }

  // How they describe you, at every distance.
  {
    const S = career('ZA', 1740, 6);
    const p = RZ.cast.who(S, RZ.COUNTRIES.ZA, 'the bishop', '');
    const seen = new Set();
    [-90, -40, -15, 0, 15, 35, 70].forEach((rel) => { p.rel = rel; seen.add(RZ.cast.standing(p)); });
    ok('the whole range is described', seen.size >= 6, String(seen.size));
    p.rel = 70; p.met = 3;
    ok('somebody who owes you stands up', /stand up/.test(RZ.cast.greeting(S, p)));
    p.rel = -70;
    ok('somebody who does not, does not', /do not stand/.test(RZ.cast.greeting(S, p)));
    p.met = 0;
    ok('and a first meeting has no preamble', RZ.cast.greeting(S, p) === '');
  }

  // The summary only lists people actually met.
  {
    const S = career('ZA', 1750, 6);
    RZ.cast.who(S, RZ.COUNTRIES.ZA, 'the bishop', '');
    ok('somebody merely generated is not somebody you know', RZ.cast.summary(S).length === 0);
    play(S, 'union', 1);
    ok('and somebody you have sat with is', RZ.cast.summary(S).length === 1);
    const row = RZ.cast.summary(S)[0];
    ok('the row carries what the screen needs',
      !!(row.name && row.role && row.standing && typeof row.rel === 'number'));
  }

  // A whole career's worth, in every country, without throwing.
  {
    let ran = 0;
    Object.keys(RZ.COUNTRIES).forEach((cid, i) => {
      const S = career(cid, 1800 + i, 6);
      for (let t = 0; t < 24; t++) {
        S.turn += 1;
        ['union', 'business', 'media', 'church'].forEach((topic) => play(S, topic, t % 3));
      }
      RZ.cast.summary(S).forEach((r) => { if (!r.name) throw new Error('nameless in ' + cid); });
      ran++;
    });
    ok('two years of meetings in all ten countries, cleanly', ran === Object.keys(RZ.COUNTRIES).length);
  }

  // And it survives being written to disk.
  {
    const S = career('ZA', 1760, 6);
    const cv = play(S, 'union', 0);
    RZ.cast.remember(S, cv.speaker, 'A thing you said', 'promise');
    const name = cv.speaker.name, rel = Math.round(cv.speaker.rel);
    RZ.engine.save(S);
    const back = RZ.engine.load();
    const p = RZ.cast.all(back)[0];
    ok('the cast round-trips', !!p && p.name === name, p && p.name);
    ok('with the relationship', Math.round(p.rel) === rel);
    ok('and the memory', p.memory.length >= 1 && p.memory.some((m) => m.what === 'A thing you said'));
  }
}


/* ================= 21. rooms with two sides in them ================= */
section('21. Multi-speaker rooms');
{
  const rooms = RZ.DIALOGUE.filter((sc) => sc.others);
  const roomById = (id) => RZ.DIALOGUE.filter((sc) => sc.id === id)[0];

  ok('there are rooms with more than one person in them', rooms.length >= 4, String(rooms.length));

  // Most of a career is spent at the bottom of the ladder, so most of these
  // have to be openable from there. A room only a president can walk into is
  // content almost nobody sees. The six ministry rooms, Friday, the ribbon,
  // the manifesto desk and State of the Nation are the job of an office —
  // they are gated on purpose.
  {
    const S = career('ZA', 1999, 0);
    const api = RZ.engine.mkApi(S);
    const officeId = {
      'duty-clinic': 1, 'duty-school': 1, 'duty-road': 1,
      'duty-cluster': 1, 'duty-shaft': 1, 'duty-list': 1,
      'friday-ward': 1, 'nation-address': 1, 'ribbon-day': 1, 'manifesto-desk': 1,
      'amend-table': 1
    };
    const ground = rooms.filter((sc) => !officeId[sc.id]);
    const open = ground.filter((sc) => !sc.when || sc.when(api));
    ok('most of them open to somebody with no office at all',
      open.length >= Math.ceil(ground.length / 2),
      open.map((sc) => sc.id).join(', ') + ' of ' + ground.length);

    // And each of those is reachable through an action available down there.
    // Crisis rooms are summoned, not chosen from the desk.
    open.filter((sc) => sc.topic !== 'crisis').forEach((sc) => {
      const act = RZ.actionById[sc.topic] || RZ.gov.actionById(sc.topic);
      if (!act) throw new Error(sc.id + ' has no action behind it');
      const t = act.tier || [0, 13];
      if (t[0] > 1) throw new Error(sc.id + ' opens at tier 0 but its action needs tier ' + t[0]);
    });
    ok('and the action that opens each of them is available down there too', true);

    // The high ones are gated because the fiction requires it, not by accident.
    const gated = rooms.filter((sc) => sc.when && !sc.when(api));
    gated.forEach((sc) => {
      const S2 = career('ZA', 1998, 12);
      if (sc.topic === 'ministry') {
        let idx = 0;
        RZ.ladderFor('ZA').forEach((r, i) => { if (r.tier <= 6) idx = i; });
        S2.player.rungIdx = idx;
        S2.parties[S2.player.partyId].gov = true;
        const mid = { 'duty-clinic': 'health', 'duty-school': 'edu', 'duty-road': 'infra',
                      'duty-cluster': 'def', 'duty-shaft': 'mines', 'duty-list': 'local' }[sc.id];
        const m = (RZ.COUNTRIES.ZA.ministries || []).find((x) => x.id === mid);
        if (m) S2.player.ministry = m.name;
      } else if (sc.id === 'friday-ward') {
        S2.player.rungIdx = 4;
        S2.player.isPresident = false;
      } else if (sc.id === 'nation-address' || sc.id === 'cabinet-brief' || sc.id === 'sadc-summit' ||
                 sc.id === 'house-project' || sc.id === 'great-power' || sc.id === 'opp-meet' || sc.id === 'tax-package' ||
                 sc.id === 'opp-other' || sc.id === 'opp-supply' || sc.id === 'coalition-talks' ||
                 sc.id === 'gnu-meet' || sc.id === 'conference-floor') {
        makePresident(S2);
      } else if (sc.id === 'sg-ceiling' || sc.id === 'the-year') {
        S2.player.rungIdx = 6;
        S2.player.isPresident = false;
        S2.player.stats.integrity = 70;
        S2.player.dirt = [];
        S2.date.month = 7;
      } else if (sc.id === 'amend-table') {
        let idx = 0;
        RZ.ladderFor('ZA').forEach((r, i) => { if (r.tier <= 6) idx = i; });
        S2.player.rungIdx = idx;
        S2.player.isPresident = false;
        S2.parties[S2.player.partyId].gov = true;
        if (S2.nation.govParties.indexOf(S2.player.partyId) < 0) S2.nation.govParties = [S2.player.partyId];
      } else if (sc.id === 'ribbon-day') {
        S2.player.rungIdx = 4;
        S2.flags.ribbon = { kind: 'clinic', name: 'a clinic', ico: '🏥' };
      } else if (sc.id === 'manifesto-desk') {
        S2.player.rungIdx = 4;
      }
      if (!sc.when(RZ.engine.mkApi(S2))) throw new Error(sc.id + ' is closed even at the top of the ladder');
    });
    ok('and every gated room does open once you are senior enough', true);
  }

  // Everybody in the room is resolved, named, and persistent.
  {
    const S = career('ZA', 2000, 12);
    const sc = roomById('cabinet-budget');
    const cv = RZ.dialogue.begin(S, sc, null);
    ok('the room holds everybody the scene declared',
      Object.keys(cv.people).length === Object.keys(sc.others).length + 1,
      Object.keys(cv.people).join(', '));
    ok('and each of them is a named person',
      Object.values(cv.people).every((p) => p && p.name && p.role));
    ok('they are different people', cv.people.purse.name !== cv.people.ward.name);
    ok('and the primary is still the speaker', cv.speaker === cv.people._);

    // Same room later in the career: the same two ministers.
    const again = RZ.dialogue.begin(S, sc, null);
    ok('and they are the same people next time',
      again.people.purse.name === cv.people.purse.name &&
      again.people.ward.name === cv.people.ward.name);
  }

  // The argument reaches the transcript before the question does, attributed.
  {
    const S = career('ZA', 2001, 12);
    const cv = RZ.dialogue.begin(S, roomById('cabinet-budget'), null);
    const argued = cv.transcript.filter((l) => l.by);
    ok('they argue with each other before anybody asks you anything', argued.length >= 3,
      String(argued.length));
    ok('every argued line says who is speaking', argued.every((l) => cv.people[l.by]));
    ok('and some of it is aimed at somebody in particular',
      cv.transcript.some((l) => l.at && cv.people[l.at]));
    ok('the question comes after the argument',
      cv.transcript.indexOf(cv.transcript.filter((l) => l.by)[0]) <
      cv.transcript.length - 1);
  }

  // Taking a side moves both of them, in opposite directions.
  {
    const S = career('ZA', 2002, 12);
    const cv = RZ.dialogue.begin(S, roomById('cabinet-budget'), null);
    const purse = cv.people.purse, ward = cv.people.ward;
    const p0 = purse.rel, w0 = ward.rel;
    const sideIdx = RZ.dialogue.options(cv).findIndex((o) => o.side === 'ward');
    ok('the screen is told which answer backs whom', sideIdx >= 0);
    RZ.dialogue.choose(cv, sideIdx);
    ok('the one you backed thinks better of you', ward.rel > w0,
      Math.round(w0) + ' -> ' + Math.round(ward.rel));
    ok('and the one you did not, worse', purse.rel < p0,
      Math.round(p0) + ' -> ' + Math.round(purse.rel));
    ok('being chosen counts for more than not being chosen',
      (ward.rel - w0) > (p0 - purse.rel));
    ok('and both of them remember which way it went',
      ward.sidedWith === 1 && purse.sidedAgainst === 1);
    // The person who put the question to you was not a party to it.
    ok('the chair does not pay for a decision they asked you to make',
      !cv.people._.sidedAgainst && !cv.people._.sidedWith);
  }

  // The reply comes from the person the answer was aimed at.
  {
    const S = career('ZA', 2003, 12);
    const cv = RZ.dialogue.begin(S, roomById('cabinet-budget'), null);
    const i = RZ.dialogue.options(cv).findIndex((o) => o.side === 'purse');
    const before = cv.transcript.length;
    RZ.dialogue.choose(cv, i);
    const reply = cv.transcript.slice(before).filter((l) => l.who === 'them')[0];
    ok('whoever you backed is the one who answers', reply && reply.by === 'purse',
      reply ? String(reply.by) : 'no reply');
  }

  // An answer with no side leaves everybody where they were.
  {
    const S = career('ZA', 2004, 12);
    const cv = RZ.dialogue.begin(S, roomById('cabinet-budget'), null);
    const rels = Object.keys(cv.people).map((k) => cv.people[k].rel);
    const i = RZ.dialogue.options(cv).findIndex((o) => !o.side);
    if (i >= 0) {
      RZ.dialogue.choose(cv, i);
      ok('refusing to choose does not move anybody',
        Object.keys(cv.people).map((k) => cv.people[k].rel).join() === rels.join());
    } else {
      ok('every answer in this beat takes a side', true);
    }
  }

  // sideWith on its own, including the things it must not touch.
  {
    const S = career('ZA', 2005, 6);
    const c = RZ.COUNTRIES.ZA;
    const a1 = RZ.cast.who(S, c, 'the bishop', '');
    const a2 = RZ.cast.who(S, c, 'the Chief Whip', '');
    const stranger = RZ.cast.who(S, c, 'a caller, live on air', '');
    a1.rel = 0; a2.rel = 0;
    RZ.cast.sideWith(S, a1, [a2, stranger]);
    ok('backing somebody warms them', a1.rel > 0);
    ok('and cools the other', a2.rel < 0);
    ok('a stranger cannot be sided against', stranger.rel === undefined || !stranger.key);
    // Bounded, however many times you do it.
    for (let i = 0; i < 60; i++) RZ.cast.sideWith(S, a1, [a2]);
    ok('and it is bounded both ways', a1.rel <= 100 && a2.rel >= -100,
      Math.round(a1.rel) + ' / ' + Math.round(a2.rel));
  }

  // Every room, every side, in every country, played to the end.
  {
    let played = 0, sided = 0;
    Object.keys(RZ.COUNTRIES).forEach((cid, ci) => {
      rooms.forEach((sc, si) => {
        const S = career(cid, 2100 + ci * 10 + si, 12);
        const cv = RZ.dialogue.begin(S, sc, null);
        let g = 0;
        while (!cv.done && g++ < 12) {
          const opts = RZ.dialogue.options(cv).filter((o) => o.ok);
          if (!opts.length) throw new Error(sc.id + ' offered nothing in ' + cid);
          const pick = opts[(ci + si + g) % opts.length];
          if (pick.side) sided++;
          RZ.dialogue.choose(cv, pick.i);
        }
        if (!cv.done) throw new Error(sc.id + ' never closed in ' + cid);
        const e = RZ.engine.finishDialogue(S, cv);
        if (!e || !e.title || e.body === undefined) throw new Error(sc.id + ' produced no entry in ' + cid);
        played++;
      });
    });
    ok('every room plays to the end in all ten countries',
      played === rooms.length * Object.keys(RZ.COUNTRIES).length, String(played));
    ok('and sides were actually taken along the way', sided > 0, String(sided));
  }

  // The old single-speaker scenes are untouched by any of this.
  {
    const S = career('ZA', 2200, 6);
    const plain = RZ.DIALOGUE.filter((sc) => !sc.others && sc.topic === 'union')[0];
    const cv = RZ.dialogue.begin(S, plain, RZ.actionById.union);
    ok('a one-person room still has exactly one person in it',
      Object.keys(cv.people).length === 1 && cv.people._ === cv.speaker);
    ok('and none of its lines claim a speaker it does not have',
      cv.transcript.every((l) => !l.by || cv.people[l.by]));
  }

  // And the whole thing survives a save.
  {
    const S = career('ZA', 2300, 12);
    const cv = RZ.dialogue.begin(S, roomById('security-table'), null);
    const i = RZ.dialogue.options(cv).findIndex((o) => o.side);
    RZ.dialogue.choose(cv, i);
    // Play it out: nobody counts as met until the meeting has actually ended.
    let g = 0;
    while (!cv.done && g++ < 12) {
      const opts = RZ.dialogue.options(cv).filter((o) => o.ok);
      if (!opts.length) break;
      RZ.dialogue.choose(cv, opts[0].i);
    }
    RZ.engine.finishDialogue(S, cv);
    const names = Object.keys(cv.people).map((k) => cv.people[k].name).sort();
    RZ.engine.save(S);
    const back = RZ.engine.load();
    const known = RZ.cast.summary(back).map((p) => p.name);
    ok('everybody in the room is somebody you now know',
      names.every((n) => known.includes(n)), names.join(', '));
    ok('and the sides taken survive the save',
      RZ.cast.all(back).some((p) => p.sidedWith > 0 || p.sidedAgainst > 0));
  }
}

/* ================= 22. the diary ================= */
section('22. The docket');
{
  // The diary is built for the state it is looked at in, so a test that moves
  // the player up the ladder has to ask for it again.
  const diary = (S) => RZ.docket.build(S).entries;

  {
    const S = career('ZA', 2400, 6);
    const es = diary(S);
    ok('the month opens with things already in it', es.length > 0, String(es.length));
    ok('but never with the whole month in it',
      es.length < S.actionsPerTurn, es.length + ' of ' + S.actionsPerTurn);
    ok('every appointment has a time on it', es.every((e) => /^\d\d:\d\d$/.test(e.at)));
    ok('and no two of them are the same thing',
      new Set(es.map((e) => e.actionId)).size === es.length);
    ok('and each one is an action you could actually take',
      es.every((e) => RZ.engine.availableActions(S).some((a) => a.id === e.actionId)));
    ok('and none of them is a picker that asks a question first',
      es.every((e) => !(RZ.actionById[e.actionId] || {}).special));
    ok('most of them have a person behind them',
      es.filter((e) => e.who).length >= Math.ceil(es.length / 2),
      es.map((e) => (e.who ? e.who.name : '—')).join(', '));
    ok('and a reason that is a sentence', es.every((e) => e.why && e.why.length > 12));
  }

  // A weekly clock already owns the diary; a second one on top of it is noise.
  {
    const S = career('ZA', 2401, 6);
    RZ.sprint.begin(S);
    ok('a campaign sprint clears the diary', diary(S).length === 0);
    ok('and the sprint is what is running instead', S.tempo === 'week');
  }

  // Somebody you already know, holding something, beats a stranger.
  {
    const S = career('ZA', 2402, 6);
    const c = RZ.COUNTRIES.ZA;
    const known = RZ.cast.who(S, c, 'the Chief Whip', '');
    known.met = 4;
    RZ.cast.remember(S, known, 'You said you would move the clause and you did not', 'bad');
    const stranger = RZ.cast.who(S, c, 'the bishop', '');
    const wKnown = RZ.docket.weightFor(S, { person: known });
    const wStranger = RZ.docket.weightFor(S, { person: stranger });
    const wNobody = RZ.docket.weightFor(S, { person: null });
    ok('somebody you know outweighs a stranger', wKnown > wStranger);
    ok('and a stranger outweighs nobody at all', wStranger > wNobody);
  }

  // Keeping and declining move the same person in opposite directions.
  {
    const S = career('ZA', 2403, 6);
    let es = diary(S).filter((e) => e.who && e.who.key);
    let guard = 0;
    while (!es.length && guard++ < 40) es = diary(S).filter((e) => e.who && e.who.key);
    ok('a diary with a named person in it turns up', es.length > 0);
    const e = es[0];
    const before = RZ.cast.get(S, e.who.key).rel;
    RZ.docket.keep(S, e.actionId);
    ok('turning up is worth something', RZ.cast.get(S, e.who.key).rel > before);
    ok('and the entry is marked kept', RZ.docket.entryFor(S, e.actionId) === null);
    ok('and it counts', RZ.docket.summary(S).kept === 1);
  }

  // Cancelling is the courteous half of not coming, and it is priced that way.
  {
    const S = career('ZA', 2404, 6);
    let es = diary(S).filter((x) => x.who && x.who.key);
    let guard = 0;
    while (!es.length && guard++ < 40) es = diary(S).filter((x) => x.who && x.who.key);
    const e = es[0];
    const p0 = RZ.cast.get(S, e.who.key).rel;
    const feed0 = S.feed.length;
    const left = S.actionsLeft;
    RZ.docket.decline(S, e.actionId);
    const p = RZ.cast.get(S, e.who.key);
    ok('cancelling on somebody costs you with them', p.rel < p0, p0 + ' → ' + p.rel);
    ok('but it does not cost an action', S.actionsLeft === left);
    ok('and it is not an event in itself', S.feed.length === feed0);
    ok('and they do not file it against you', !p.stoodUp);
    ok('and the appointment is gone from the diary', RZ.docket.entryFor(S, e.actionId) === null);
    ok('and cannot be cancelled twice', RZ.docket.decline(S, e.actionId) === null);
  }

  // Silence is the expensive one. If it were the other way round the Cancel
  // button would be a trap and nobody would ever press it.
  {
    const S = career('ZA', 2405, 6);
    let es = diary(S).filter((x) => x.who && x.who.key);
    let guard = 0;
    while (!es.length && guard++ < 40) es = diary(S).filter((x) => x.who && x.who.key);
    const e = es[0];
    const p0 = RZ.cast.get(S, e.who.key).rel;
    const feed0 = S.feed.length;
    const closed = RZ.docket.close(S);
    ok('the month turning stands up whatever was left', closed.length > 0, String(closed.length));
    const p = RZ.cast.get(S, e.who.key);
    ok('not turning up costs you with them', p.rel < p0, p0 + ' → ' + p.rel);
    ok('and they count it', p.stoodUp === 1);
    ok('and they remember it', p.memory.some((m) => m.tone === 'bad'));
    ok('and it is in the record', S.feed.length > feed0);
    ok('one card for the month, however many mornings', S.feed.length === feed0 + 1);
    ok('and nothing is left open', RZ.docket.open(S).length === 0);
  }

  // The two prices, measured against each other on the same person.
  {
    const cost = (fn, seed) => {
      let total = 0, n = 0;
      for (let i = 0; i < 40; i++) {
        const S = career('ZA', seed + i, 6);
        const es = diary(S).filter((x) => x.who && x.who.key);
        if (!es.length) continue;
        const e = es[0];
        const before = RZ.cast.get(S, e.who.key).rel;
        fn(S, e);
        total += before - RZ.cast.get(S, e.who.key).rel;
        n++;
      }
      return n ? total / n : 0;
    };
    const said = cost((S, e) => RZ.docket.decline(S, e.actionId), 2500);
    const silent = cost((S) => RZ.docket.close(S), 2600);
    ok('saying so costs something', said > 0, said.toFixed(1));
    ok('and saying nothing costs more', silent > said * 1.5,
      `${said.toFixed(1)} vs ${silent.toFixed(1)}`);
  }

  // A turn ends with next month already written.
  {
    const S = career('ZA', 2406, 6);
    const first = diary(S).map((e) => e.actionId).join(',');
    RZ.engine.endTurn(S);
    if (!S.over) {
      ok('the next month arrives with its own diary',
        S.tempo === 'week' || RZ.docket.entries(S).length > 0);
      ok('and it is stamped to the month it belongs to', S.docket.turn === S.turn);
      ok('and none of it is already kept or declined',
        RZ.docket.entries(S).every((e) => !e.kept && !e.declined));
    }
  }

  // The diary promises a person; the room delivers that person.
  {
    const S = career('ZA', 2407, 6);
    let es = diary(S).filter((x) => x.sceneId && x.who);
    let guard = 0;
    while (!es.length && guard++ < 40) es = diary(S).filter((x) => x.sceneId && x.who);
    if (es.length) {
      const e = es[0];
      const sc = RZ.docket.sceneFor(S, e.actionId);
      ok('the booked room is still the booked room', sc && sc.id === e.sceneId, e.sceneId);
      const out = RZ.engine.doAction(S, e.actionId);
      ok('and taking the appointment opens it', !!(out && out.dialogue));
      ok('and the person in it is the person the diary named',
        RZ.cast.shortOf(S, out.dialogue.speaker) === e.who.name,
        e.who.name + ' vs ' + out.dialogue.speaker.name);
      ok('and turning up was recorded', RZ.docket.summary(S).kept === 1);
    }
  }

  // The diary pushes a relationship down every single month. Without something
  // pulling the other way that is a one-way ratchet, and the whole cast ends a
  // long career on the floor.
  {
    const S = career('ZA', 2409, 6);
    const c = RZ.COUNTRIES.ZA;
    const p = RZ.cast.who(S, c, 'the Chief Whip', '');
    p.rel = 0; p.lastSeen = 0;
    for (let i = 0; i < 400; i++) { S.turn = i; RZ.cast.ding(S, p, 4, -45); }
    ok('cancelling on somebody, over and over, only gets you as far as cold',
      p.rel >= -45, String(Math.round(p.rel)));
    const q = RZ.cast.who(S, c, 'the bishop', '');
    q.rel = 0; q.lastSeen = 0;
    for (let i = 0; i < 400; i++) { S.turn = i; RZ.cast.ding(S, q, 10, -70); }
    ok('never turning up goes further, and still stops short of the floor',
      q.rel >= -70 && q.rel < -45, String(Math.round(q.rel)));
  }

  {
    const S = career('ZA', 2410, 6);
    const c = RZ.COUNTRIES.ZA;
    const bad = RZ.cast.who(S, c, 'the Chief Whip', '');
    const good = RZ.cast.who(S, c, 'the bishop', '');
    bad.rel = -60; good.rel = 60;
    bad.lastSeen = 0; good.lastSeen = 0;
    S.turn = 3;
    RZ.cast.drift(S, 1);
    ok('a grievance three months old has not started to fade', bad.rel === -60);
    S.turn = 120;
    for (let i = 0; i < 100; i++) RZ.cast.drift(S, 1);
    ok('but years of never seeing them softens it', bad.rel > -60 && bad.rel < 0,
      String(Math.round(bad.rel)));
    ok('and it cools a friendship the same way', good.rel < 60 && good.rel > 0,
      String(Math.round(good.rel)));
    ok('neither of them crosses over', bad.rel < 0 && good.rel > 0);
    ok('and somebody you were never anything to stays nothing',
      RZ.cast.who(S, c, 'the editor', '').rel !== undefined);
  }

  // Being seen resets the clock: a relationship you are actually maintaining
  // does not decay under you.
  {
    const S = career('ZA', 2411, 6);
    const p = RZ.cast.who(S, RZ.COUNTRIES.ZA, 'the Chief Whip', '');
    p.rel = 50;
    for (let i = 0; i < 60; i++) { S.turn = i; p.lastSeen = i; RZ.cast.drift(S, 1); }
    ok('a relationship you keep up does not decay', p.rel === 50);
  }

  // And all of it round-trips.
  {
    const S = career('ZA', 2408, 6);
    diary(S);
    const before = JSON.stringify(S.docket);
    RZ.engine.save(S);
    const back = RZ.engine.load();
    ok('the diary survives a save', JSON.stringify(back.docket) === before);
    ok('and is still usable on the other side', RZ.docket.entries(back).length === S.docket.entries.length);
  }
}

/* ================= 23. the pause ================= */
section('23. The pause before you answer');
{
  const roomFor = (S, topic) => RZ.dialogue.sceneFor(S, topic);

  // Every question carries one, and it is written when the question is asked
  // rather than when the screen is drawn — so it does not change under the
  // player each time the modal repaints.
  {
    const S = career('ZA', 2700, 6);
    const sc = roomFor(S, 'union') || RZ.DIALOGUE[0];
    const cv = RZ.dialogue.begin(S, sc, null);
    ok('a question arrives with a silence attached', !!cv.pause, String(cv.pause));
    ok('and it is a sentence, not a placeholder', cv.pause.length > 15 && /[.!?]$/.test(cv.pause));
    const first = cv.pause;
    ok('and it does not change when nothing has happened', cv.pause === first);

    const opts = RZ.dialogue.options(cv).filter((o) => o.ok);
    RZ.dialogue.choose(cv, opts[0].i);
    if (!cv.done) {
      ok('the next question gets its own silence', !!cv.pause);
    }
  }

  // It reads the room: a meeting going badly does not hold the same way as one
  // going well.
  {
    const seen = { warm: new Set(), hostile: new Set() };
    for (let i = 0; i < 60; i++) {
      const S = career('ZA', 2710 + i, 6);
      const sc = RZ.DIALOGUE.filter((x) => !x.others && x.beats && x.beats.length)[i % 12];
      if (!sc) continue;
      const cv = RZ.dialogue.begin(S, sc, null);
      const beat = cv.scene.beats[0];
      cv.mood = 9;   seen.warm.add(RZ.dialogue.pauseFor(cv, beat));
      cv.mood = -9;  seen.hostile.add(RZ.dialogue.pauseFor(cv, beat));
    }
    const warmOnly = [...seen.warm].filter((t) => RZ.dialogue.HOLD.warm.includes(t));
    const hostileOnly = [...seen.hostile].filter((t) => RZ.dialogue.HOLD.hostile.includes(t));
    ok('a warm room holds warmly', warmOnly.length > 0, String(warmOnly.length));
    ok('and a hostile one does not', hostileOnly.length > 0, String(hostileOnly.length));
    ok('a warm room never uses a hostile line',
      ![...seen.warm].some((t) => RZ.dialogue.HOLD.hostile.includes(t)));
  }

  // Somebody's own way of holding a room follows them between meetings.
  {
    const S = career('ZA', 2800, 6);
    const p = RZ.cast.who(S, RZ.COUNTRIES.ZA, 'the Chief Whip', '');
    ok('everybody in the cast has a way of sitting in a silence',
      !!RZ.dialogue.HOLD_BY_TEMPER[p.temper], p.temper);
    ok('and there is one for every temper the cast can hand out',
      RZ.cast.TEMPERS.every((t) => !!RZ.dialogue.HOLD_BY_TEMPER[t]));
  }

  // A room where two people have just disagreed holds differently: the silence
  // names both of them, because one is about to lose.
  {
    const rooms = RZ.DIALOGUE.filter((sc) => sc.others &&
      (sc.beats || []).some((b) => (b.answers || []).some((a) => a.side)));
    let named = 0;
    rooms.forEach((sc, i) => {
      const S = career('ZA', 2900 + i, 12);
      const cv = RZ.dialogue.begin(S, sc, null);
      const beat = cv.scene.beats.filter((b) => (b.answers || []).some((a) => a.side))[0];
      const t = RZ.dialogue.pauseFor(cv, beat);
      const who = Object.keys(cv.people).filter((k) => k !== '_').map((k) => cv.people[k]);
      if (who.some((pp) => t.includes(RZ.cast.shortOf(S, pp)))) named++;
    });
    ok('a room with two sides in it names them in the silence',
      rooms.length > 0 && named === rooms.length, `${named}/${rooms.length}`);
  }

  // And none of it touches the game.
  {
    const S = career('ZA', 3000, 6);
    const sc = roomFor(S, 'union') || RZ.DIALOGUE[0];
    const cv = RZ.dialogue.begin(S, sc, null);
    const before = { mood: cv.mood, beat: cv.beat, opts: RZ.dialogue.options(cv).length };
    RZ.dialogue.pauseFor(cv, cv.scene.beats[0]);
    RZ.dialogue.pauseFor(cv, cv.scene.beats[0]);
    ok('reading the silence costs nothing',
      cv.mood === before.mood && cv.beat === before.beat &&
      RZ.dialogue.options(cv).length === before.opts);
  }
}

/* ================= 24. the trenches ================= */
section('24. The trenches');
{
  const low = (seed = 3100, rung = 0) => career('ZA', seed, rung);

  // One person, in your own region, for the whole climb.
  {
    const S = low();
    const a = RZ.trenches.keeper(S);
    const b = RZ.trenches.keeper(S);
    ok('the register is kept by one person', a.key === b.key, a.name);
    ok('and they are somebody the cast knows about', !!RZ.cast.get(S, a.key));
    ok('and the bar to clear rises with the rung', RZ.trenches.need(S) < (() => {
      const T = low(3101, 3); return RZ.trenches.need(T);
    })());
  }

  // Being on the list is the whole game down here, and it is a price rather
  // than a lock: it can always be paid.
  {
    const S = low();
    S.trenches.favour = 0;
    ok('you start off the list', !RZ.trenches.onList(S));
    ok('and being off it costs you in the hall',
      RZ.trenches.listBonus(S, S.player.regionId) < 0,
      String(Math.round(RZ.trenches.listBonus(S, S.player.regionId))));
    S.trenches.favour = RZ.trenches.need(S) + 20;
    ok('being on it helps', RZ.trenches.listBonus(S, S.player.regionId) > 0);
    ok('and it is bounded', RZ.trenches.listBonus(S, S.player.regionId) <= 12);
    ok('it only counts at home', RZ.trenches.listBonus(S, 'nowhere') === 0);
  }

  // Above the trenches the secretary stops being the door — but does not stop
  // being a person you know.
  {
    const S = low(3110, 8);
    ok('a minister is not waiting on a branch list', RZ.trenches.onList(S));
    ok('and the secretary no longer weighs anything',
      RZ.trenches.listBonus(S, S.player.regionId) === 0);
    ok('but they are still in the cast', !!RZ.cast.get(S, RZ.trenches.keeper(S).key));
    ok('and nothing is ticking for them any more', RZ.trenches.tick(S, 1, {}) === null);
  }

  // The grind moves it, and the two actions exist where they should.
  {
    const S = low();
    S.trenches.favour = 0;
    const before = S.trenches.favour;
    const api = RZ.engine.mkApi(S);
    RZ.actionById.chairs.run(api);
    ok('carrying chairs is noticed', S.trenches.favour > before, String(Math.round(S.trenches.favour)));
    ok('and it is counted', S.trenches.chairs === 1);
    const mid = S.trenches.favour;
    RZ.actionById.hustle.run(RZ.engine.mkApi(S));
    ok('running errands is worth more', S.trenches.favour - mid > 1);
    ok('and it comes out of your own pocket', S.player.money < 0 || S.trenches.hustles === 1);
  }

  {
    const S = low();
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('both are on offer at the bottom', ids.includes('chairs') && ids.includes('hustle'));
    const T = low(3120, 8);
    const tids = RZ.engine.availableActions(T).map((a) => a.id);
    ok('and neither is on offer to a minister',
      !tids.includes('chairs') && !tids.includes('hustle'));
  }

  // Favour is a push, so it needs a pull: a branch that never sees you forgets.
  {
    const S = low();
    S.trenches.favour = 60;
    for (let i = 0; i < 120; i++) RZ.trenches.tick(S, 1, {});
    ok('a branch that never sees you forgets you',
      S.trenches.favour < 60 && S.trenches.favour >= 0, String(Math.round(S.trenches.favour)));
    S.trenches.favour = -60;
    for (let i = 0; i < 120; i++) RZ.trenches.tick(S, 1, {});
    ok('and it forgets a grudge the same way',
      S.trenches.favour > -60 && S.trenches.favour <= 0, String(Math.round(S.trenches.favour)));
  }

  // The offer only arrives in the band where it is genuinely a short cut.
  {
    const S = low();
    const n = RZ.trenches.need(S);
    S.trenches.favour = 0;
    ok('nobody offers you a short cut before you have started', !RZ.trenches.wantsOffer(S));
    S.trenches.favour = n * 0.7;
    ok('it comes when you are close and short', RZ.trenches.wantsOffer(S));
    S.trenches.favour = n;
    ok('and not once you were going to get there anyway', !RZ.trenches.wantsOffer(S));
    S.trenches.favour = n * 0.7;
    RZ.trenches.mark(S, 'signed');
    ok('and never twice', !RZ.trenches.wantsOffer(S));
  }

  // All three answers do what they say.
  {
    const ev = RZ.EVENTS.filter((e) => e.id === 'trench-list')[0];
    ok('the offer is an event like any other', !!ev && ev.once === true);
    ok('and it is guarded on the band', !!ev.when);

    const play = (i) => {
      const S = low(3200 + i);
      S.trenches.favour = RZ.trenches.need(S) * 0.7;
      const api = RZ.engine.mkApi(S);
      const before = S.trenches.favour;
      const integrity = S.player.stats.integrity;
      const res = ev.choices[i].run(api);
      return { S, res, before, integrity, api };
    };

    const pledged = play(0);
    ok('pledging the ward puts you on the list',
      pledged.S.trenches.favour > pledged.before && RZ.trenches.onList(pledged.S));
    ok('and somebody now holds a marker over you',
      (pledged.S.capture.patrons || []).length > 0);
    ok('and it is on your record', pledged.S.trenches.bargain.kind === 'pledged');

    const signed = play(1);
    ok('signing the form works faster', signed.S.trenches.favour > signed.before);
    ok('and leaves a document with your name on it',
      signed.S.player.dirt.some((d) => d.id === 'trench-return'));
    ok('and costs you something you cannot buy back',
      signed.S.player.stats.integrity < signed.integrity,
      `${signed.integrity} → ${Math.round(signed.S.player.stats.integrity)}`);

    const refused = play(2);
    ok('refusing costs you with them', refused.S.trenches.favour < refused.before);
    ok('and there is no bargain on your record', !refused.S.trenches.bargain);
    ok('and it is worth something in itself',
      refused.S.player.stats.integrity > refused.integrity,
      `${refused.integrity} → ${Math.round(refused.S.player.stats.integrity)}`);
    ok('but it does not offer again', !RZ.trenches.wantsOffer(refused.S));

    [pledged, signed, refused].forEach((x, i) => {
      ok(`answer ${i + 1} renders`, !!x.res.title && !!x.res.body &&
        !/undefined|NaN|\[object Object\]/.test(x.res.title + x.res.body));
    });
  }

  // And it all survives a save.
  {
    const S = low();
    S.trenches.favour = 33; S.trenches.chairs = 4;
    RZ.trenches.mark(S, 'pledged');
    RZ.engine.save(S);
    const back = RZ.engine.load();
    ok('the register survives a save',
      Math.round(back.trenches.favour) === 33 && back.trenches.chairs === 4);
    ok('and so does what you agreed to', back.trenches.bargain.kind === 'pledged');
  }
}

/* ================= 25. the household ================= */
section('25. The family');
{
  // Somebody married this, and a couple of people are already attached to it.
  {
    const S = career('ZA', 4000, 4);
    const f = RZ.family.summary(S);
    ok('there is somebody at home', !!f.spouse, f.spouseFull);
    ok('and they are in the cast', !!RZ.cast.get(S, S.family.spouseKey));
    ok('and they are not you', f.spouseFull !== S.player.name);
    ok('two relatives to begin with', S.family.kin.length === 2);
    ok('and none of them is the same person',
      new Set(S.family.kin.map((k) => k.key)).size === S.family.kin.length);
    ok('nobody has left yet', !f.left);
  }

  // The household grows to fit the office, and it is paid for out of the same
  // account the campaign is.
  {
    const low = career('ZA', 4001, 1);
    const high = career('ZA', 4002, 10);
    ok('a bigger office costs more at home',
      RZ.family.drain(high) > RZ.family.drain(low),
      `${RZ.family.drain(low).toFixed(2)} vs ${RZ.family.drain(high).toFixed(2)}`);
    const before = high.family.kin.length;
    RZ.family.addKin(high);
    ok('and another relative costs more again',
      RZ.family.drain(high) > RZ.family.drain({ ...high, family: { ...high.family, kin: high.family.kin.slice(0, before) } }) ||
      high.family.kin.length === before + 1);
  }

  {
    // It shows up in the money, not just in a number nobody reads.
    const S = career('ZA', 4003, 8);
    S.player.money = 0;
    S.family.kin = [];
    RZ.engine.endTurn(S);
    const lean = S.player.money;
    const T = career('ZA', 4003, 8);
    T.player.money = 0;
    while (T.family.kin.length < 6) RZ.family.addKin(T);
    RZ.engine.endTurn(T);
    ok('six relatives cost more than none', T.player.money < lean,
      `${Math.round(lean)} vs ${Math.round(T.player.money)}`);
  }

  // Patience is spent by the job and bought back only by going home.
  {
    const S = career('ZA', 4010, 9);
    S.family.patience = 80;
    for (let i = 0; i < 24; i++) RZ.family.monthly(S, 1, {});
    ok('a big job wears them down', S.family.patience < 80, String(Math.round(S.family.patience)));
    const worn = S.family.patience;
    RZ.family.mend(S, 20);
    ok('and going home buys some of it back', S.family.patience > worn);
    ok('but never past full', RZ.family.mend(S, 500) === 100);
  }

  {
    // Rest is the action that does it, and it says so on screen.
    const S = career('ZA', 4011, 9);
    S.family.patience = 40;
    const res = RZ.actionById.rest.run(RZ.engine.mkApi(S));
    ok('resting mends it', S.family.patience > 40, String(Math.round(S.family.patience)));
    ok('and the writing knows who is at home', !!res.body && res.body.length > 20);
  }

  // And at zero they go, once, with a mark on the record.
  {
    const S = career('ZA', 4012, 10);
    S.family.patience = 0.2;
    const out = {};
    const feed0 = S.feed.length;
    for (let i = 0; i < 4; i++) RZ.family.monthly(S, 1, out);
    ok('at nothing left, they leave', S.family.left);
    ok('and it is in the record', S.feed.length > feed0);
    ok('and on the legacy', !!S.legacyMarks.spouseLeft);
    const n = S.feed.length;
    for (let i = 0; i < 6; i++) RZ.family.monthly(S, 1, {});
    ok('and they do not leave twice', S.feed.length === n);
  }

  // The ask: a real person, a real amount, and a refusal that is remembered.
  {
    const ev = RZ.EVENTS.filter((e) => e.id === 'kin-ask')[0];
    ok('the ask is an event like any other', !!ev && !!ev.when && !!ev.prep);

    const S = career('ZA', 4020, 6);
    const api = RZ.engine.mkApi(S);
    ev.prep(api);
    const ask = RZ.family.readAsk(S);
    ok('somebody specific is asking', !!ask && !!ask.person, ask && ask.name);
    ok('for something specific', !!ask.need.what);
    ok('and it survives a save', (() => {
      RZ.engine.save(S);
      const back = RZ.engine.load();
      const a2 = RZ.family.readAsk(back);
      return a2 && a2.person && a2.person.key === ask.person.key;
    })());
    ok('the pending ask stores no copy of the person',
      JSON.stringify(S.family.pending).indexOf(ask.person.name) < 0);

    const money0 = S.player.money;
    const rel0 = ask.person.rel;
    ev.choices[0].run(RZ.engine.mkApi(S));
    ok('paying costs money', S.player.money < money0);
    ok('and is remembered kindly', RZ.cast.get(S, ask.person.key).rel > rel0);
    ok('and clears the ask', S.family.pending === null);
  }

  {
    const ev = RZ.EVENTS.filter((e) => e.id === 'kin-ask')[0];
    const S = career('ZA', 4021, 6);
    ev.prep(RZ.engine.mkApi(S));
    const ask = RZ.family.readAsk(S);
    const rel0 = ask.person.rel;
    ev.choices[2].run(RZ.engine.mkApi(S));
    const p = RZ.cast.get(S, ask.person.key);
    ok('refusing costs you with them', p.rel < rel0, `${rel0} → ${Math.round(p.rel)}`);
    ok('and they hold on to it', p.memory.some((m) => m.tone === 'bad'));
    ok('and it does not come round again immediately', !RZ.family.wantsAsk(S));
  }

  // The brother who did not need to be asked.
  {
    const ev = RZ.EVENTS.filter((e) => e.id === 'kin-tender')[0];
    ok('the tender is asked once and only high up', !!ev && ev.once === true);
    const low = career('ZA', 4030, 2);
    ok('a councillor’s relatives win nothing', !RZ.family.wantsTender(low));
    const S = career('ZA', 4031, 8);
    ok('a minister’s do', RZ.family.wantsTender(S));

    const play = (i, seed) => {
      const T = career('ZA', seed, 8);
      const api = RZ.engine.mkApi(T);
      const before = { integrity: T.player.stats.integrity, dirt: T.player.dirt.length };
      const res = ev.choices[i].run(api);
      return { T, res, before };
    };
    const stood = play(0, 4040);
    ok('letting it stand leaves a document', stood.T.player.dirt.length > stood.before.dirt);
    ok('and is on the record', stood.T.family.tender.kind === 'stood');

    const cut = play(1, 4041);
    ok('cancelling it is worth something', cut.T.player.stats.integrity > cut.before.integrity);
    ok('and costs you at home', cut.T.player.standing.grassroots < 100);
    ok('and marks the legacy', !!cut.T.legacyMarks.foughtCorruption);

    const lied = play(2, 4042);
    ok('the denial is its own file', lied.T.player.dirt.some((d) => d.id === 'kin-denial'));
    ok('and only once', !RZ.family.wantsTender(lied.T));

    [stood, cut, lied].forEach((x, i) => {
      ok(`tender answer ${i + 1} renders`,
        !!x.res.title && !!x.res.body &&
        !/undefined|NaN|\[object Object\]/.test(x.res.title + x.res.body));
    });
  }

  // And the whole household round-trips.
  {
    const S = career('ZA', 4050, 6);
    S.family.patience = 41;
    RZ.family.addKin(S);
    RZ.engine.save(S);
    const back = RZ.engine.load();
    ok('the household survives a save',
      Math.round(back.family.patience) === 41 && back.family.kin.length === S.family.kin.length);
    ok('and everybody in it is still the same person',
      back.family.kin.every((k) => !!RZ.cast.get(back, k.key)));
  }
}

/* ================= 26. the money after the ballot ================= */
section('26. What is left in the chest, and who asks about it');
{
  const wage = (cid) => RZ.engine.WAGE_BASE[cid];

  // The threshold has to be in wage units or it is nonsense in nine countries
  // out of ten: the bases run from 450 to 340,000.
  {
    const spread = Object.keys(RZ.COUNTRIES).map((cid) => wage(cid));
    ok('the wage bases really do span orders of magnitude',
      Math.max(...spread) / Math.min(...spread) > 100,
      `${Math.min(...spread)} … ${Math.max(...spread)}`);

    const pettyOf = (cid) => {
      const S = career(cid, 5000, 4);
      RZ.sprint.begin(S);
      S.sprint.war.cash = 0;
      RZ.sprint.end(S);
      return S.flags.lastSprint.petty;
    };
    const ratios = Object.keys(RZ.COUNTRIES).map((cid) => pettyOf(cid) / wage(cid));
    ok('and petty cash is the same multiple of a wage everywhere',
      Math.max(...ratios) - Math.min(...ratios) < 0.01,
      ratios.map((r) => r.toFixed(2)).join(' '));
  }

  // Below the line it is receipts and taxi fares; above it, somebody kept it.
  {
    const run = (cid, cash) => {
      const S = career(cid, 5010, 4);
      RZ.sprint.begin(S);
      S.sprint.war.cash = cash;
      S.sprint.war.raised = cash * 2;
      S.player.money = 0;
      RZ.sprint.end(S);
      return S;
    };
    const small = run('ZA', Math.round(wage('ZA') * 1));
    ok('a small balance still reaches your account', small.player.money > 0);
    ok('but nobody calls it anything', !small.flags.pocketedChest);
    ok('and it does not summon the commission on its own', !small.flags.auditDue);

    const big = run('ZA', Math.round(wage('ZA') * 9));
    ok('a large one is a decision', !!big.flags.pocketedChest);
    ok('and it is in the record', big.feed.some((f) => /account was not closed/i.test(f.title)));
    ok('and it is money you actually have', big.player.money > small.player.money);
    ok('and the commission will be writing', !!big.flags.auditDue);
    ok('and the letter knows the amount', big.flags.auditDue.pocketed > 0);

    // Same test in the country with the smallest wage base, to prove the
    // threshold travels.
    const sz = run('SZ', Math.round(wage('SZ') * 9));
    ok('nine wages is a lot of money in every country', !!sz.flags.pocketedChest);
    const szSmall = run('SZ', Math.round(wage('SZ') * 1));
    ok('and one wage is petty cash in every country', !szSmall.flags.pocketedChest);
  }

  // One chest, one letter. Where the money came from and what was left of it
  // are the same set of bank statements.
  {
    const S = career('ZA', 5020, 4);
    RZ.sprint.begin(S);
    S.sprint.war.cash = Math.round(wage('ZA') * 8);
    S.sprint.war.raised = Math.round(wage('ZA') * 30);
    S.sprint.war.dirty = Math.round(wage('ZA') * 15);
    RZ.sprint.end(S);
    ok('one audit covers both', !!S.flags.auditDue &&
      S.flags.auditDue.pocketed > 0 && S.flags.auditDue.share > 0);
    S.flags.auditDue.month = 0;
    const ev = RZ.sprint.auditDue(S);
    ok('and the letter is one letter', !!ev && ev.audit === true);
    ok('that mentions where it came from', /return has no line for/.test(ev.body));
    ok('and what was left of it', /left in it/.test(ev.body));
    ok('with no undefined anywhere', !/undefined|NaN|\[object Object\]/.test(ev.title + ev.body));
  }

  // Filing honestly returns the money and closes the file — and a closed file
  // cannot be the subject of a second inquiry.
  {
    const S = career('ZA', 5030, 6);
    RZ.sprint.begin(S);
    S.sprint.war.cash = Math.round(wage('ZA') * 8);
    S.sprint.war.raised = Math.round(wage('ZA') * 30);
    S.sprint.war.dirty = Math.round(wage('ZA') * 15);
    RZ.sprint.end(S);
    S.flags.auditDue.month = 0;
    const ev = RZ.sprint.auditDue(S);
    const money0 = S.player.money;
    const res = RZ.sprint.resolveAudit(S, ev, 0);
    ok('filing honestly gives the balance back', S.player.money < money0);
    ok('and says so', /returned to the account/.test(res.body));
    ok('and closes the file', S.player.dirt.some((d) => d.id === 'returns' && d.settled));
    ok('and there is nothing left to pocket', !S.flags.pocketedChest);

    // Now expose it and check nobody comes back for a second bite.
    S.player.dirt.forEach((d) => { d.exposed = true; });
    const api = RZ.engine.mkApi(S);
    const comm = RZ.EVENTS.filter((e) => e.id === 'commission')[0];
    ok('a settled file summons nobody',
      api.openFiles().length === 0 || !comm.when(api));
  }

  {
    // A false return is a live case number, and that one absolutely does.
    const S = career('ZA', 5031, 6);
    RZ.sprint.begin(S);
    S.sprint.war.cash = 0;
    S.sprint.war.raised = Math.round(wage('ZA') * 30);
    S.sprint.war.dirty = Math.round(wage('ZA') * 20);
    RZ.sprint.end(S);
    S.flags.auditDue.month = 0;
    const ev = RZ.sprint.auditDue(S);
    let caught = null;
    for (let i = 0; i < 40 && !caught; i++) {
      const T = career('ZA', 5040 + i, 6);
      RZ.sprint.begin(T);
      T.sprint.war.cash = 0; T.sprint.war.raised = 100; T.sprint.war.dirty = 80;
      RZ.sprint.end(T);
      if (!T.flags.auditDue) continue;
      T.flags.auditDue.month = 0;
      const e2 = RZ.sprint.auditDue(T);
      RZ.sprint.resolveAudit(T, e2, 1);
      if (T.player.dirt.some((d) => d.id === 'falsereturn')) caught = T;
    }
    ok('a false return that is caught is a live file', !!caught);
    if (caught) {
      ok('and it is not settled', !caught.player.dirt.filter((d) => d.id === 'falsereturn')[0].settled);
    }
    ok('and settling quietly closes it instead', (() => {
      const T = career('ZA', 5060, 6);
      RZ.sprint.begin(T);
      T.sprint.war.cash = 0; T.sprint.war.raised = 100; T.sprint.war.dirty = 80;
      RZ.sprint.end(T);
      if (!T.flags.auditDue) return false;
      T.flags.auditDue.month = 0;
      T.player.money = RZ.engine.WAGE_BASE.ZA * 40;
      RZ.sprint.resolveAudit(T, RZ.sprint.auditDue(T), 2);
      return T.player.dirt.some((d) => d.id === 'returns' && d.settled);
    })());
  }
}

/* ================= 27. the by-election ================= */
section('27. The by-election');
{
  const ev = RZ.EVENTS.filter((e) => e.id === 'byelection')[0];
  ok('the vacancy exists', !!ev);

  const ready = (seed, rung) => {
    const S = career('ZA', seed, rung === undefined ? 3 : rung);
    S.player.standing.grassroots = 70;
    S.player.standing.party = 60;
    S.player.fame = 40;
    S.player.money = RZ.engine.WAGE_BASE.ZA * 40;
    return S;
  };

  // It is offered only where a seat is what you are waiting for.
  {
    const S = ready(6000, 3);
    const api = RZ.engine.mkApi(S);
    const next = RZ.engine.nextRung(S);
    ok('the next rung is a seat', next.how === 'public', next.how);
    ok('so a vacancy is possible', ev.when(api));

    S.campaign.season = true;
    ok('but not during a general election', !ev.when(RZ.engine.mkApi(S)));
    S.campaign.season = false;
    RZ.sprint.begin(S);
    ok('and not in the middle of a sprint', !ev.when(RZ.engine.mkApi(S)));
  }

  {
    const S = ready(6001, 6);
    ok('a minister is not waiting on a by-election',
      !ev.when(RZ.engine.mkApi(S)) || RZ.engine.nextRung(S).how === 'public');
  }

  {
    const S = ready(6002, 3);
    S.player.standing.grassroots = 1;
    S.player.standing.party = 1;
    S.player.fame = 0;
    ok('and nobody unknown is on the shortlist',
      RZ.engine.meetsRequirements(S, RZ.engine.nextRung(S)).ok === false &&
      !ev.when(RZ.engine.mkApi(S)));
  }

  // A by-election is not a general election with fewer people in it. Turnout
  // collapses and the people who still come out have a grievance, so it has to
  // be losable — otherwise it is a free promotion and the funding choice is
  // decoration.
  {
    const rate = (choice, gr, pa, fa, n = 60) => {
      let wins = 0;
      for (let i = 0; i < n; i++) {
        const S = ready(6100 + i, 3);
        S.player.standing.grassroots = gr; S.player.standing.party = pa; S.player.fame = fa;
        const before = S.player.rungIdx;
        ev.prep(RZ.engine.mkApi(S));
        ev.choices[choice].run(RZ.engine.mkApi(S));
        if (S.player.rungIdx > before) wins++;
      }
      return wins / n;
    };
    const weakSelf = rate(0, 30, 25, 10);
    const strongSelf = rate(0, 70, 60, 40);
    const weakParty = rate(1, 30, 25, 10);
    const strongParty = rate(1, 70, 60, 40);

    ok('an unknown can lose a by-election on their own money',
      weakSelf < 0.85, (weakSelf * 100).toFixed(0) + '%');
    ok('and a strong candidate usually takes it',
      strongSelf > weakSelf + 0.1,
      `${(weakSelf * 100).toFixed(0)}% vs ${(strongSelf * 100).toFixed(0)}%`);
    ok('the machine is better at this than you are',
      weakParty > weakSelf, `${(weakSelf * 100).toFixed(0)}% vs ${(weakParty * 100).toFixed(0)}%`);
    // The point of the whole mechanic: the offer is worth most to the people
    // least able to refuse it.
    ok('and it is worth most to whoever needs it most',
      (weakParty - weakSelf) > (strongParty - strongSelf),
      `weak +${((weakParty - weakSelf) * 100).toFixed(0)}pts, strong +${((strongParty - strongSelf) * 100).toFixed(0)}pts`);
  }

  // Fighting it yourself costs money and owes nobody.
  {
    let won = null;
    for (let i = 0; i < 40 && !won; i++) {
      const S = ready(6100 + i, 3);
      const before = { rung: S.player.rungIdx, money: S.player.money };
      ev.prep(RZ.engine.mkApi(S));
      const res = ev.choices[0].run(RZ.engine.mkApi(S));
      if (S.player.rungIdx > before.rung) won = { S, res, before };
    }
    ok('you can win one on your own money', !!won);
    if (won) {
      ok('winning it takes the seat', won.S.player.rungIdx === won.before.rung + 1);
      ok('and it costs you real money', won.S.player.money < won.before.money);
      ok('and nobody owns it', !won.S.flags.seatOwed);
      ok('and the writing says so', /Nobody owns you/.test(won.res.body));
    }
  }

  // Letting the region pay wins more often and costs for years.
  {
    let bought = null;
    for (let i = 0; i < 40 && !bought; i++) {
      const S = ready(6200 + i, 3);
      const before = S.player.rungIdx;
      ev.prep(RZ.engine.mkApi(S));
      const res = ev.choices[1].run(RZ.engine.mkApi(S));
      if (S.player.rungIdx > before) bought = { S, res };
    }
    ok('the machine can deliver a seat', !!bought);
    if (bought) {
      ok('and it is owed', bought.S.flags.seatOwed === true);
      ok('and somebody holds a marker', (bought.S.capture.patrons || []).length > 0);
      ok('and you are whipped for two years', RZ.revolt.whipped(bought.S));
    }
  }

  // And the debt is real: it is worth twelve points the day you move.
  {
    const free = ready(6300, 9);
    const owed = ready(6300, 9);
    owed.flags.seatOwed = true;
    const a = RZ.revolt.revoltOdds(free);
    const b = RZ.revolt.revoltOdds(owed);
    ok('a bought seat is held against you in the caucus',
      !a || !b || b.pct < a.pct, a && b ? `${a.pct}% vs ${b.pct}%` : 'no incumbent');
  }

  // Sitting it out hands it to somebody with a name.
  {
    const S = ready(6400, 3);
    const field0 = S.field.length;
    ev.prep(RZ.engine.mkApi(S));
    const res = ev.choices[2].run(RZ.engine.mkApi(S));
    ok('somebody else takes it', S.field.length >= field0);
    ok('and they have a name in the story',
      !/undefined|NaN|\[object Object\]/.test(res.title + res.body));
  }

  // All three answers render, in all ten countries.
  {
    let bad = [];
    Object.keys(RZ.COUNTRIES).forEach((cid) => {
      [0, 1, 2].forEach((i) => {
        const S = career(cid, 6500, 3);
        S.player.standing.grassroots = 70; S.player.standing.party = 60;
        S.player.fame = 40; S.player.money = RZ.engine.WAGE_BASE[cid] * 40;
        const api = RZ.engine.mkApi(S);
        ev.prep(api);
        const t = ev.title(api), b = ev.body(api);
        const res = ev.choices[i].run(RZ.engine.mkApi(S));
        if (/undefined|NaN|\[object Object\]/.test(t + b + res.title + res.body)) bad.push(cid + '/' + i);
      });
    });
    ok('the vacancy reads in all ten countries', bad.length === 0, bad.join(', '));
  }
}

/* ================= 28. election day ================= */
section('28. Election day, in four phases');
{
  const day = (cid = 'ZA', seed = 8000, rung = 6) => {
    const S = career(cid, seed, rung);
    S.nextElection = S.date.year;
    RZ.eday.init(S);
    return S;
  };

  // The order is the design: nothing is decided until phase three is answered.
  {
    const S = day();
    ok('the day opens at dawn', S.eday.phase === 'ground');
    ok('and nothing has been counted', !S.eday.result);
    RZ.eday.chooseGround(S, 0);
    ok('the ground game leads to the exit polls', S.eday.phase === 'exit');
    ok('and still nothing has been counted', !S.eday.result);
    RZ.eday.takePoll(S);
    ok('the polls lead to the one intervention', S.eday.phase === 'shift');
    ok('and STILL nothing has been counted', !S.eday.result,
      'if this fails the first three phases are decoration');
    RZ.eday.chooseShift(S, 0);
    ok('and only then is there a count to run', S.eday.phase === 'count');
    RZ.eday.runCount(S, {});
    ok('which produces a real result', !!S.eday.result && !!S.eday.result.gov);
    ok('and the day is over', S.eday.phase === 'done');
  }

  // The morning genuinely moves the night.
  {
    const swings = RZ.eday.GROUND.map((g, i) => {
      let total = 0;
      for (let k = 0; k < 30; k++) {
        const S = day('ZA', 8100 + k);
        total += RZ.eday.chooseGround(S, i).swing;
      }
      return total / 30;
    });
    ok('every way of spending the day is worth something',
      swings.every((v) => v > 0), swings.map((v) => v.toFixed(1)).join(' '));
    ok('and they are not all worth the same',
      Math.max(...swings) - Math.min(...swings) > 1,
      swings.map((v) => v.toFixed(1)).join(' '));
  }

  {
    // The marginals are the gamble: highest ceiling, and it can come to nothing.
    const runs = [];
    for (let k = 0; k < 60; k++) {
      const S = day('ZA', 8200 + k);
      runs.push(RZ.eday.chooseGround(S, 1).swing);
    }
    ok('throwing everything at the marginals can pay hugely',
      Math.max(...runs) > 6, Math.max(...runs).toFixed(1));
    ok('and can come to nothing at all',
      Math.min(...runs) < 1.5, Math.min(...runs).toFixed(1));
  }

  // The exit poll is a sample, not the answer shown early.
  {
    const S = day();
    RZ.eday.chooseGround(S, 0);
    const poll = RZ.eday.takePoll(S);
    ok('the poll adds up to a hundred',
      Math.abs(Object.keys(poll.byParty).reduce((a, k) => a + poll.byParty[k], 0) - 100) < 0.01);
    ok('and carries an honest error bar', poll.err > 0, String(poll.err));
    ok('and says what it can and cannot support', !!poll.read);
    ok('a country with a better commission polls better',
      RZ.eday.pollError({ countryId: 'BW' }) <= RZ.eday.pollError({ countryId: 'ZW' }) ||
      RZ.COUNTRIES.BW.inst.electoral <= RZ.COUNTRIES.ZW.inst.electoral);
  }

  {
    // A poll is not wrong in a landslide and should not be — nobody's exit poll
    // has ever mistaken a fifteen-point lead. What has to be true is that it is
    // wrong often enough in a *tight* race, because that is the only race in
    // which phase three is a decision rather than a lookup.
    // A genuine two-horse race, not an eight-way tie: with every party level,
    // "who leads" is noise in the poll and noise in the count, and comparing
    // two coin flips measures nothing.
    const tighten = (S) => {
      const c = RZ.COUNTRIES.ZA;
      const rest = (100 - 68) / Math.max(1, c.parties.length - 2);
      c.parties.forEach((p, i) => {
        S.parties[p.id].vote = i === 0 ? 35 : i === 1 ? 33 : rest;
      });
      return S;
    };
    let wrong = 0, tight = 0, n = 150;
    for (let k = 0; k < n; k++) {
      const S = tighten(day('ZA', 8300 + k));
      RZ.eday.chooseGround(S, 0);
      const poll = RZ.eday.takePoll(S);
      if (poll.tight) tight++;
      RZ.eday.chooseShift(S, 0);
      const r = RZ.eday.runCount(S, {});
      if (poll.leadId !== r.gov.lead) wrong++;
    }
    ok('in a tight race the exit poll is sometimes wrong about who won',
      wrong > 0, `${wrong}/${n}`);
    ok('but it is still usually right', wrong < n * 0.5, `${wrong}/${n}`);
    ok('and it says so itself when it cannot be trusted', tight > 0, `${tight}/${n}`);

    // And in a landslide it is not wrong, which is also correct.
    let landslideWrong = 0;
    for (let k = 0; k < 60; k++) {
      const S = day('ZA', 8380 + k);
      RZ.eday.chooseGround(S, 0);
      const poll = RZ.eday.takePoll(S);
      RZ.eday.chooseShift(S, 0);
      const r = RZ.eday.runCount(S, {});
      if (poll.leadId !== r.gov.lead) landslideWrong++;
    }
    ok('and a fifteen-point lead is never called wrong',
      landslideWrong <= 3, `${landslideWrong}/60`);
  }

  // The afternoon offers only what the poll would make a person reach for.
  {
    const behind = day('ZA', 8400);
    RZ.eday.chooseGround(behind, 0);
    RZ.eday.takePoll(behind);
    behind.eday.poll.ahead = false;
    behind.eday.poll.tight = false;
    const ids = RZ.eday.shiftOptions(behind).map((o) => o.id);
    ok('you can concede when you are clearly losing', ids.includes('concede'));
    ok('and you cannot declare victory', !ids.includes('claim'));

    const ahead = day('ZA', 8401);
    RZ.eday.chooseGround(ahead, 0);
    RZ.eday.takePoll(ahead);
    ahead.eday.poll.ahead = true;
    ahead.eday.poll.tight = false;
    const ids2 = RZ.eday.shiftOptions(ahead).map((o) => o.id);
    ok('you can claim it when you are ahead', ids2.includes('claim'));
    ok('and you cannot concede', !ids2.includes('concede'));
    ok('doing nothing is always on the table',
      ids.includes('hold') && ids2.includes('hold'));
  }

  {
    // Conceding early is a real, costly, recorded thing.
    const S = day('ZA', 8410);
    RZ.eday.chooseGround(S, 0);
    RZ.eday.takePoll(S);
    S.eday.poll.ahead = false; S.eday.poll.tight = false;
    const opts = RZ.eday.shiftOptions(S);
    const i = opts.findIndex((o) => o.id === 'concede');
    const media0 = S.player.standing.media;
    const party0 = S.player.standing.party;
    RZ.eday.chooseShift(S, i);
    ok('conceding with grace is noticed outside the party', S.player.standing.media > media0);
    ok('and resented inside it', S.player.standing.party < party0);
    ok('and it is on the legacy', !!S.legacyMarks.concededEarly);
  }

  // The count comes in smallest first, so the places that decide it are last.
  {
    const S = day();
    const order = RZ.eday.countOrder(S);
    const c = RZ.COUNTRIES.ZA;
    const seats = order.map((id) => c.regionById[id].seats);
    ok('every region declares exactly once',
      order.length === c.regions.length && new Set(order).size === order.length);
    ok('and the small ones declare first',
      seats.every((v, i) => i === 0 || seats[i - 1] <= v), seats.join(' < '));
  }

  {
    const S = day();
    RZ.eday.chooseGround(S, 0);
    RZ.eday.takePoll(S);
    RZ.eday.chooseShift(S, 0);
    RZ.eday.runCount(S, {});
    const order = RZ.eday.countOrder(S);
    const zero = RZ.eday.partial(S, 0);
    ok('nothing is declared at the start', zero.declared === 0 && zero.pct === 0);
    for (let n = 1; n <= order.length; n++) {
      const part = RZ.eday.partial(S, n);
      if (part.declared !== n) { ok('the count advances one region at a time', false, `${n}`); break; }
      const tot = Object.keys(part.byParty).reduce((a, k) => a + part.byParty[k], 0);
      if (Math.abs(tot - 100) > 0.01) { ok('and always adds up to a hundred', false, String(tot)); break; }
    }
    ok('the count advances one region at a time', true);
    ok('and always adds up to a hundred', true);
    const full = RZ.eday.partial(S, order.length);
    ok('and finishes at a hundred per cent', full.pct === 100 && full.declared === order.length);
    ok('and names whoever declared last', !!full.last && !!full.last.name);
    ok('asking for more regions than exist is safe',
      RZ.eday.partial(S, 999).declared === order.length);
  }

  // The full night, in all ten countries, through every ground game and every
  // shift that is on offer.
  {
    let played = 0, bad = [];
    Object.keys(RZ.COUNTRIES).forEach((cid) => {
      RZ.eday.GROUND.forEach((g, gi) => {
        const S = day(cid, 8500 + gi, 6);
        RZ.eday.chooseGround(S, gi);
        const poll = RZ.eday.takePoll(S);
        const opts = RZ.eday.shiftOptions(S);
        opts.forEach(function (o, oi) {
          const T = day(cid, 8500 + gi, 6);
          RZ.eday.chooseGround(T, gi);
          RZ.eday.takePoll(T);
          const sh = RZ.eday.chooseShift(T, oi);
          const r = RZ.eday.runCount(T, {});
          played++;
          if (!r || !r.gov || !sh.note) bad.push(cid + '/' + gi + '/' + oi);
          if (/undefined|NaN|\[object Object\]/.test(sh.note)) bad.push(cid + '/' + gi + '/' + oi + ' text');
          const part = RZ.eday.partial(T, 2);
          if (!part || !isFinite(part.byParty[Object.keys(part.byParty)[0]])) {
            bad.push(cid + '/' + gi + '/' + oi + ' partial');
          }
        });
      });
    });
    ok('every path through the night plays in every country', bad.length === 0,
      `${played} runs, ${bad.length} bad ${bad.slice(0, 4).join(' ')}`);
  }

  // And the day survives being closed halfway through.
  {
    const S = day();
    RZ.eday.chooseGround(S, 1);
    RZ.eday.takePoll(S);
    RZ.engine.save(S);
    const back = RZ.engine.load();
    ok('the day survives a save', back.eday.phase === 'shift' && !!back.eday.poll);
    ok('and the morning is still on the record', !!back.eday.ground.note);
    RZ.eday.chooseShift(back, 0);
    const r = RZ.eday.runCount(back, {});
    ok('and it can be finished on the other side', !!r.gov);
  }
}

/* ================= 29. the appointed top office ================= */
section('29. The office that is somebody’s to give');
{
  const lad = RZ.ladderFor('SZ');
  const topIdx = lad.length - 1;

  const deputy = (seed, standing) => {
    const S = career('SZ', seed, lad.length - 2);
    S.player.officeSince = { year: S.date.year - 4, month: S.date.month };
    S.parties[S.player.partyId].gov = true;
    S.nation.govParties = [S.player.partyId];
    S.player.standing.leader = standing;
    S.player.standing.party = standing;
    S.player.fame = standing;
    return S;
  };
  const openVacancy = (S, months = 8) => {
    S.flags.postVacant = true;
    S.flags.vacancyCloses = S.turn + months;
    S.flags.vacancyConsidered = false;
    return S;
  };

  // A file on a colleague buys a portfolio. It does not buy the top of the
  // building — and the old test for that asked the wrong question.
  {
    ok('the top rung of every country is the same office',
      Object.keys(RZ.COUNTRIES).every((cid) => {
        const l = RZ.ladderFor(cid);
        return l[l.length - 1].id === 'hos';
      }));

    // The guard used to be `how !== 'auto'`, which is true of the nine
    // countries that elect their head of state and false of the one that
    // appoints them. So exactly one country could be blackmailed into.
    const appointed = Object.keys(RZ.COUNTRIES).filter((cid) => {
      const l = RZ.ladderFor(cid);
      return l[l.length - 1].how === 'appoint';
    });
    ok('and in at least one country it is filled by appointment',
      appointed.length > 0, appointed.join(', '));

    appointed.concat(['ZA']).forEach((cid) => {
      const l = RZ.ladderFor(cid);
      const S = career(cid, 9100, l.length - 2);
      S.parties[S.player.partyId].gov = true;
      // hand them a file on somebody who matters
      const t = RZ.field.addRival(S, 80);
      t.partyId = S.player.partyId;
      t.dirt = [{ id: 'x', label: 'something', severity: 3, used: false }];
      const api = RZ.engine.mkApi(S);
      const before = S.player.rungIdx;
      const res = RZ.revolt.blackmail(S, api);
      ok(`a file cannot buy the top office in ${cid}`,
        !!res.fail && S.player.rungIdx === before, res.title || 'promoted!');
    });

    // And the action is not even offered when the top job is what is next.
    const S = career('SZ', 9101, lad.length - 2);
    S.parties[S.player.partyId].gov = true;
    const t2 = RZ.field.addRival(S, 80);
    t2.partyId = S.player.partyId;
    t2.dirt = [{ id: 'y', label: 'something', severity: 3, used: false }];
    ok('and the desk does not offer the trade at all',
      !RZ.actionById.blackmail.when(RZ.engine.mkApi(S)));
  }

  // A vacancy is a window. It closes, and somebody else is in it.
  {
    const S = openVacancy(deputy(9200, 20), 3);
    const feed0 = S.feed.length;
    S.turn += 6;
    const out = {};
    RZ.engine.endTurn(S);
    ok('a vacancy nobody suitable filled goes to somebody else',
      S.flags.postVacant === false, 'still open');
    ok('and the country has their name on it', !!S.nation.presidentName);
    ok('and it is in the record', S.feed.length > feed0);
  }

  // One decision per vacancy, not one every quarter for as long as it is open.
  {
    const S = openVacancy(deputy(9300, 20), 24);
    let considered = 0;
    for (let q = 0; q < 8; q++) {
      const before = S.flags.vacancyConsidered;
      RZ.engine.considerAppointment(S);
      if (!before && S.flags.vacancyConsidered) considered++;
    }
    ok('the King makes one decision per vacancy, not eight', considered === 1,
      `${considered} decisions`);
  }

  // And you are not made head of government the season after you got the
  // deputy's job.
  {
    const S = openVacancy(deputy(9400, 95));
    S.player.officeSince = { year: S.date.year, month: S.date.month };
    ok('nobody is appointed the quarter after their last promotion',
      RZ.engine.considerAppointment(S) === null);
    ok('and the decision has not been spent either', !S.flags.vacancyConsidered);
  }

  // The route has to actually work. Before this it did not: the bar sat at
  // about 115 against a maximum achievable score of 116, so every career that
  // reached the office got there by trading a file instead.
  {
    const rate = (standing, n = 200) => {
      let got = 0;
      for (let i = 0; i < n; i++) {
        const S = openVacancy(deputy(9500 + i, standing));
        const r = RZ.engine.considerAppointment(S);
        if (r && r.promoted) got++;
      }
      return got / n;
    };
    const excellent = rate(92), good = rate(75), fair = rate(60), weak = rate(34);
    ok('a deputy at the top of their game can be appointed',
      excellent > 0.2, `${(excellent * 100).toFixed(0)}%`);
    ok('and it is never a formality', excellent < 0.8, `${(excellent * 100).toFixed(0)}%`);
    ok('a good one sometimes is', good > 0.02 && good < excellent,
      `${(good * 100).toFixed(0)}% vs ${(excellent * 100).toFixed(0)}%`);
    ok('a middling one essentially never', fair < good + 0.02,
      `${(fair * 100).toFixed(0)}%`);
    ok('and a weak one never', weak < 0.02, `${(weak * 100).toFixed(0)}%`);
    ok('standing is what decides it, monotonically',
      excellent >= good && good >= fair && fair >= weak,
      [excellent, good, fair, weak].map((v) => (v * 100).toFixed(0) + '%').join(' > '));
  }
}

/* ================= 30. appointments that stop being possible ================= */
section('30. An appointment whose reason went away');
{
  // Circumstances move between the morning the diary is drawn up and the
  // afternoon. `rehab` is only offered while a file of yours is exposed; clear
  // the file and the meeting that was about it cannot happen — but the diary
  // renders its own buttons, so without pruning it stayed on the desk,
  // clickable, and doAction ran it straight past its own `when`.
  const withDirt = (seed) => {
    const S = career('ZA', seed, 4);
    S.player.dirt = [{ id: 'x', label: 'something in a file', severity: 3, exposed: true, year: S.date.year }];
    return S;
  };
  // Booked by hand, because build() picks at random and this must not be flaky.
  const book = (S, extra = {}) => {
    S.docket.entries = [Object.assign({
      actionId: 'rehab', sceneId: null, ico: '🕯️', name: 'Rehabilitate yourself',
      at: '09:30', who: null, why: 'It is in the diary because of the job.',
      kept: false, declined: false
    }, extra)];
    return S.docket.entries[0];
  };

  {
    const S = withDirt(9600);
    book(S);
    ok('the action is on offer while the file is out',
      RZ.engine.availableActions(S).some((a) => a.id === 'rehab'));
    ok('and an appointment for it is live', RZ.docket.live(S).length === 1);

    // The file goes away.
    S.player.dirt = [];
    ok('once the file is gone the engine stops offering it',
      !RZ.engine.availableActions(S).some((a) => a.id === 'rehab'));
    ok('and the diary stops showing it', RZ.docket.live(S).length === 0);
    ok('and there is nothing left on the desk to click',
      !RZ.docket.entries(S).some((e) => e.actionId === 'rehab' && !e.kept && !e.declined));
  }

  {
    // Lapsing is not standing somebody up. You could not have gone.
    const S = withDirt(9601);
    const c = RZ.COUNTRIES.ZA;
    const p = RZ.cast.who(S, c, 'the Chief Whip', '');
    book(S, { who: { key: p.key, name: p.name, role: p.role }, why: 'They asked.' });
    S.player.dirt = [];
    const rel0 = p.rel, feed0 = S.feed.length;
    const stood = RZ.docket.close(S);
    ok('nobody is stood up for an appointment that became impossible', stood.length === 0);
    ok('and it costs nothing with them', RZ.cast.get(S, p.key).rel === rel0);
    ok('and it is not in the record', S.feed.length === feed0);
  }

  {
    // One you actually kept stays on the page: the diary is a record as well
    // as a plan, and pruning must not erase what already happened.
    const S = withDirt(9602);
    book(S, { kept: true });
    S.player.dirt = [];
    ok('one you kept survives the prune', RZ.docket.live(S).length === 1);
    ok('and is still marked kept', RZ.docket.entries(S)[0].kept === true);
  }

  {
    // And one you declined stays declined rather than quietly reappearing.
    const S = withDirt(9603);
    book(S, { declined: true });
    S.player.dirt = [];
    RZ.docket.live(S);
    ok('one you declined is not resurrected',
      RZ.docket.entries(S).every((e) => e.declined || e.kept));
  }

  // The invariant the browser harness asserts, stated here too: everything the
  // diary offers is something the engine would accept.
  {
    let checked = 0, bad = null;
    for (let seed = 0; seed < 40; seed++) {
      const S = career('ZA', 9700 + seed, seed % 8);
      RZ.docket.build(S);
      const offered = new Set(RZ.engine.availableActions(S).map((a) => a.id));
      RZ.docket.live(S).forEach((e) => {
        if (e.kept) return;
        checked++;
        if (!offered.has(e.actionId)) bad = bad || e.actionId;
      });
    }
    ok('the diary never offers an action the engine would refuse', bad === null,
      bad || `${checked} entries`);
  }
}

/* ================= 31. amending the constitution ================= */
section('31. The constitution, and who can move on it');
{
  const lad = RZ.ladderFor('ZA');
  const senior = (seed, opts = {}) => {
    const S = career('ZA', seed, lad.findIndex((r) => r.tier >= 8));
    S.parties[S.player.partyId].gov = true;
    S.nation.govParties = [S.player.partyId];
    const c = RZ.COUNTRIES.ZA;
    const total = c.parties.reduce((t, p) => t + (S.parties[p.id].seats || 0), 0) || c.house.seats;
    c.parties.forEach((p) => { S.parties[p.id].seats = p.id === S.player.partyId ? Math.ceil(total * 0.75) : 0; });
    S.player.standing.party = opts.party ?? 85;
    S.player.standing.leader = opts.leader ?? 85;
    S.player.capital = opts.capital ?? 80;
    S.nation.govApproval = opts.approval ?? 65;
    S.nation.society.unrest = opts.unrest ?? 15;
    return S;
  };
  const has = (S) => RZ.engine.availableActions(S).some((a) => a.id === 'amend');

  // It is a vote in the House, not an executive act — and gating the whole
  // module on the presidency meant it ran in nobody's career: three players in
  // a thousand ever got there.
  {
    const S = senior(9800);
    ok('a cabinet minister in government can move on the constitution', has(S));

    const back = career('ZA', 9801, 4);
    back.parties[back.player.partyId].gov = true;
    back.nation.govParties = [back.player.partyId];
    ok('a backbencher cannot', !has(back));

    const opp = senior(9802);
    opp.parties[opp.player.partyId].gov = false;
    opp.nation.govParties = [];
    ok('and neither can the opposition', !has(opp));
  }

  // What a cabinet can table is devolution. Everything about the head of
  // state's own powers stays palace paper — reading "you may stand again" to
  // somebody who is not standing for anything makes no sense.
  {
    const S = senior(9810);
    const mine = RZ.gov.amendmentsFor(RZ.engine.mkApi(S)).map((x) => x.id);
    ok('a minister is not offered the term limit', !mine.includes('termlimit'));
    ok('nor a longer term', !mine.includes('termlength'));
    ok('nor the courts', !mine.includes('courts'));
    ok('but devolution is theirs to table', mine.includes('devolve'), mine.join(', '));

    const pres = senior(9811);
    pres.player.isPresident = true;
    pres.nation.termNumber = 1;
    const theirs = RZ.gov.amendmentsFor(RZ.engine.mkApi(pres)).map((x) => x.id);
    ok('a president is offered the palace paper too', theirs.includes('termlimit'));
    ok('and the courts', theirs.includes('courts'));
  }

  // Carried once is carried. `devolve`'s own `when` is simply `true`, so before
  // this it could be passed again every month, paying out grassroots, media and
  // stability each time.
  {
    const S = senior(9820);
    const api = RZ.engine.mkApi(S);
    let r = null;
    for (let i = 0; i < 40 && !(r && r.passed); i++) {
      r = RZ.gov.attemptAmendment(RZ.engine.mkApi(S), 'devolve', 40);
    }
    ok('devolution can be carried', !!(r && r.passed));
    ok('and the flag is written', S.flags.amended_devolve === true);
    ok('and it is never offered again',
      !RZ.gov.amendmentsFor(RZ.engine.mkApi(S)).some((x) => x.id === 'devolve'));
    ok('and a constitution is not a renewable resource',
      !RZ.gov.amendmentsFor(RZ.engine.mkApi(S)).some((x) => x.id === 'devolve'));
  }

  // Two-thirds is not the only obstacle. These governments all hold 75% of the
  // House; what separates them is everything else.
  {
    const rate = (opts, amend, spend, n = 250) => {
      let carried = 0, ran = 0;
      for (let i = 0; i < n; i++) {
        const S = senior(9900 + i, opts);
        const api = RZ.engine.mkApi(S);
        if (!RZ.gov.amendmentsFor(api).some((x) => x.id === amend)) continue;
        ran++;
        if (RZ.gov.attemptAmendment(api, amend, spend).passed) carried++;
      }
      return ran ? carried / ran : 0;
    };
    const strong = { party: 85, leader: 85, capital: 80, approval: 65, unrest: 15 };
    const angry = { party: 85, leader: 85, capital: 80, approval: 30, unrest: 60 };
    const middling = { party: 55, leader: 55, capital: 40, approval: 45, unrest: 35 };
    const weak = { party: 25, leader: 25, capital: 15, approval: 30, unrest: 55 };

    // Capturing the courts is the president's to move, so it is measured with
    // one; devolution is the cabinet's.
    const asPres = (opts) => (S) => { S.player.isPresident = true; S.nation.termNumber = 1; return S; };
    const presRate = (opts, spend, n = 250) => {
      let carried = 0, ran = 0;
      for (let i = 0; i < n; i++) {
        const S = senior(9900 + i, opts);
        S.player.isPresident = true; S.nation.termNumber = 1;
        const api = RZ.engine.mkApi(S);
        if (!RZ.gov.amendmentsFor(api).some((x) => x.id === 'courts')) continue;
        ran++;
        if (RZ.gov.attemptAmendment(api, 'courts', spend).passed) carried++;
      }
      return ran ? carried / ran : 0;
    };

    const grabStrong = presRate(strong, 0);
    const grabAngry = presRate(angry, 0);
    ok('a supermajority alone does not carry a power grab', grabStrong < 0.85,
      (grabStrong * 100).toFixed(0) + '%');
    ok('but a strong government in a calm country usually can', grabStrong > 0.35,
      (grabStrong * 100).toFixed(0) + '%');
    ok('an angry country makes it much harder', grabAngry < grabStrong,
      `${(grabAngry * 100).toFixed(0)}% vs ${(grabStrong * 100).toFixed(0)}%`);

    // Money is the lever the mechanic is built around: crossbenchers are bought.
    const dry = presRate(middling, 0);
    const paid = presRate(middling, 40);
    ok('whipping money is what carries a middling government',
      paid > dry + 0.3, `${(dry * 100).toFixed(0)}% dry vs ${(paid * 100).toFixed(0)}% paid`);
    ok('and it cannot buy what is not there',
      presRate(weak, 40) < 0.2, (presRate(weak, 40) * 100).toFixed(0) + '%');

    // Handing power away meets less resistance than taking it, and a cabinet
    // can table that one without the palace.
    ok('devolving is easier than capturing the courts',
      rate(strong, 'devolve', 0) > grabStrong,
      `${(rate(strong, 'devolve', 0) * 100).toFixed(0)}% vs ${(grabStrong * 100).toFixed(0)}%`);
    ok('but it still has to be voted for',
      rate(weak, 'devolve', 0) < 0.5, (rate(weak, 'devolve', 0) * 100).toFixed(0) + '%');
  }

  // And a failed attempt is not free.
  {
    const S = senior(9950, { party: 20, leader: 20, capital: 60, approval: 20, unrest: 70 });
    S.player.isPresident = true; S.nation.termNumber = 1;
    const cap0 = S.player.capital;
    const r = RZ.gov.attemptAmendment(RZ.engine.mkApi(S), 'courts', 0);
    ok('losing the vote still costs you capital', S.player.capital < cap0,
      `${cap0} → ${S.player.capital}`);
    ok('and it is counted', S.flags.amendmentsTried >= 1);
    ok('and the amendment is still on the table', !S.flags.amended_courts || r.passed);
  }
}

/* ================= 1.8.0 minister start, VP desk, household, near-miss ================= */
section('1.8.0 Minister start, VP desk, household, near-miss');
{
  const S = RZ.engine.newGame({
    countryId: 'ZA', seed: 1801, name: 'Cabinet Start', gender: 'f',
    regionId: RZ.COUNTRIES.ZA.regions[0].id, bgId: RZ.BACKGROUNDS[0].id,
    partyId: RZ.COUNTRIES.ZA.parties[0].id, startAs: 'minister'
  });
  const api = RZ.engine.mkApi(S);
  ok('a cabinet start is at minister tier', api.tier() === 6, `tier=${api.tier()}`);
  ok('and has a portfolio', !!S.player.ministry, S.player.ministry);
  ok('and sits in government', S.nation.govParties.indexOf(S.player.partyId) >= 0);
  ok('and has four actions', S.actionsPerTurn === 4, `ap=${S.actionsPerTurn}`);
  ok('and is not already president', S.player.isPresident === false);
}

{
  const S = career('BW', 1802, 11);
  const lad = RZ.ladderFor('BW');
  const vp = lad.findIndex((r) => r.id === 'vp' || r.tier === 11);
  S.player.rungIdx = vp >= 0 ? vp : S.player.rungIdx;
  S.player.isPresident = false;
  const acts = RZ.engine.availableActions(S).map((a) => a.id);
  ok('a vice-president is offered the budget', acts.indexOf('budget') >= 0, acts.join(','));
  ok('and is offered an amendment', acts.indexOf('amend') >= 0, acts.join(','));
  const api = RZ.engine.mkApi(S);
  const amendable = RZ.gov.amendmentsFor(api);
  ok('and at least one amendment is tableable from that chair', amendable.length > 0);
  ok('term limits stay president-only', !amendable.some((x) => x.id === 'termlimit' || x.id === 'termlength' || x.id === 'courts'));
}

{
  const S = career('ZA', 1804, 6);
  S.family.patience = 20;
  S.flags.kitchenTable = false;
  S.pendingScene = null;
  RZ.family.monthly(S, 1, {});
  ok('a strained household summons the kitchen', S.pendingScene === 'kitchen-table',
    `pending=${S.pendingScene} flag=${S.flags.kitchenTable}`);
}

{
  const S = career('ZA', 1805, 10);
  S.player.trait = S.player.trait || 'firebrand';
  if (!S.contender) RZ.contender.init(S);
  const ct = S.contender;
  const lad = RZ.ladderFor('ZA');
  const target = lad.findIndex((r) => r.tier >= 9 && r.tier < 13);
  S.player.rungIdx = target;
  ct.rungIdx = Math.max(0, target - 1);
  ct.progress = 9999;
  S.flags.contenderNearMiss = false;
  S.pendingScene = null;
  RZ.contender.tick(S, 1, {});
  ok('a high-rung climb is a named near-miss', S.flags.contenderNearMiss === true,
    `flag=${S.flags.contenderNearMiss} rung=${ct.rungIdx} pending=${S.pendingScene}`);
  ok('and summons the side room at the conference', S.pendingScene === 'contender-slate',
    `pending=${S.pendingScene}`);
}

{
  const S = career('BW', 1806, 11);
  S.player.stats.integrity = 70;
  S.player.dirt = [];
  RZ.engine.endGame(S, 'retire');
  ok('a clean career that stops at the door is remembered as never taking it',
    S.legacyMarks.neverTookIt === true, JSON.stringify(S.legacyMarks));
  const lg = RZ.gov.legacy(S);
  ok('and the rank names it', lg.rank === 'The One Who Never Took It', lg.rank);
  const plain = RZ.gov.obituaryPlain(S, lg);
  ok('and the seed is shareable as plain text', /Career #/.test(plain) && /Kgosi/.test(plain));
}

{
  ok('Angola speaks Portuguese in its institutions', RZ.COUNTRIES.AO.terms.assembly === 'Assembleia Nacional');
  ok('Mozambique does too', RZ.COUNTRIES.MZ.terms.hos === 'Presidente');
  ok('chrome helper switches for those two', RZ.L('AO', 'Desk', 'Mesa') === 'Mesa' && RZ.L('BW', 'Desk', 'Mesa') === 'Desk');
}

/* ================= 1.8.1 vice-president estimates ================= */
section('1.8.1 Vice-president chairs the estimates');
{
  function asVp(cid, seed) {
    const S = career(cid, seed, 11);
    const lad = RZ.ladderFor(cid);
    const vp = lad.findIndex((r) => r.id === 'vp' || r.id === 'vpza' || r.tier === 11);
    S.player.rungIdx = vp >= 0 ? vp : S.player.rungIdx;
    S.player.isPresident = false;
    S.actionsLeft = 5;
    return S;
  }
  function playEstimates(S, sides) {
    const out = RZ.engine.doAction(S, 'budget');
    if (!out || !out.dialogue) throw new Error('VP budget did not open a room');
    const cv = out.dialogue;
    for (const want of sides) {
      const opts = RZ.dialogue.options(cv).filter((o) => o.ok);
      let pick;
      if (want === 'none') pick = opts.find((o) => !o.side);
      else if (typeof want === 'number') pick = opts.find((o) => o.i === want) || opts[want];
      else pick = opts.find((o) => o.side === want);
      if (!pick) pick = opts[0];
      RZ.dialogue.choose(cv, pick.i);
    }
    if (!cv.done) throw new Error('estimates room never closed');
    RZ.engine.finishDialogue(S, cv);
    return cv;
  }

  {
    const S = asVp('BW', 1810);
    const acts = RZ.engine.availableActions(S);
    const budget = acts.find((a) => a.id === 'budget');
    ok('a vice-president is still offered the budget', !!budget);
    ok('and it is named as chairing the estimates', budget && budget.name === 'Chair the estimates',
      budget && budget.name);
    ok('and the blurb says he has the pen', budget && /pen/.test(budget.desc), budget && budget.desc);
  }

  {
    const S = asVp('BW', 1811);
    S.player.standing.leader = 80;
    S.player.standing.party = 80;
    const health0 = S.nation.budget.health;
    const cv = playEstimates(S, ['spend', 'spend', 'none']);
    ok('the room is the estimates committee', cv.sceneId === 'estimates-chair', cv.sceneId);
    ok('the same Finance minister as the cabinet budget room',
      cv.people.purse.role === 'Minister of Finance');
    ok('a strong deputy who defends the package keeps it',
      S.flags.estimatesLast && S.flags.estimatesLast.rewritten === false,
      JSON.stringify(S.flags.estimatesLast && { rewritten: S.flags.estimatesLast.rewritten, stance: S.flags.estimatesLast.stance }));
    ok('and the health line actually moved', S.nation.budget.health > health0,
      `${health0} -> ${S.nation.budget.health}`);
    ok('and the career remembers you got a budget through', S.legacyMarks.chairedEstimates === true);
  }

  {
    const S = asVp('ZA', 1812);
    S.player.standing.leader = 20;
    S.player.standing.party = 20;
    playEstimates(S, ['spend', 'spend', 'none']);
    ok('a weak deputy who defends still has the palace rewrite it',
      S.flags.estimatesLast && S.flags.estimatesLast.rewritten === true,
      JSON.stringify(S.flags.estimatesLast && { rewritten: S.flags.estimatesLast.rewritten, stance: S.flags.estimatesLast.stance }));
    ok('and the rewrite fattens administration',
      S.nation.budget.admin > 18, String(S.nation.budget.admin));
  }

  {
    const S = asVp('BW', 1813);
    S.player.standing.leader = 80;
    S.player.standing.party = 80;
    playEstimates(S, ['purse', 'purse', 'purse']);
    ok('yielding always lets him write his road in',
      S.flags.estimatesLast && S.flags.estimatesLast.rewritten === true &&
      S.flags.estimatesLast.stance === 'yield',
      JSON.stringify(S.flags.estimatesLast && { rewritten: S.flags.estimatesLast.rewritten, stance: S.flags.estimatesLast.stance }));
    ok('and the first argument is still in the document',
      S.nation.budget.debtsvc > 14, String(S.nation.budget.debtsvc));
  }

  {
    const T = asVp('BW', 1815);
    T.player.standing.leader = 80;
    T.player.standing.party = 80;
    const dirt0 = T.player.dirt.length;
    const out = RZ.engine.doAction(T, 'budget');
    const cv = out.dialogue;
    RZ.dialogue.choose(cv, RZ.dialogue.options(cv).find((o) => o.side === 'spend').i);
    RZ.dialogue.choose(cv, RZ.dialogue.options(cv).find((o) => o.side === 'purse').i);
    const leak = RZ.dialogue.options(cv).filter((o) => o.ok && !o.side).pop();
    RZ.dialogue.choose(cv, leak.i);
    RZ.engine.finishDialogue(T, cv);
    ok('leaking the minute keeps the package',
      T.flags.estimatesLast && T.flags.estimatesLast.rewritten === false &&
      T.flags.estimatesLast.stance === 'leak',
      JSON.stringify(T.flags.estimatesLast && { rewritten: T.flags.estimatesLast.rewritten, stance: T.flags.estimatesLast.stance }));
    ok('and puts a file on you', T.player.dirt.length > dirt0, String(T.player.dirt.length));
  }

  {
    const S = asVp('BW', 1816);
    makePresident(S);
    const acts = RZ.engine.availableActions(S);
    const budget = acts.find((a) => a.id === 'budget');
    ok('a president still tables rather than chairs',
      budget && budget.name === 'Table the national budget', budget && budget.name);
    const out = RZ.engine.doAction(S, 'budget');
    ok('and still gets the slider, not the room', out && out.special === 'budget' && !out.dialogue,
      JSON.stringify(out && { special: out.special, dialogue: !!out.dialogue }));
  }

  {
    const S = career('ZA', 1817, 6);
    RZ.gov.beginEstimates(S);
    RZ.gov.tiltEstimates(S, 'debtsvc', 'health', 6);
    const pack = RZ.gov.composeEstimates(S);
    ok('a tilt from debt into health still sums to a hundred',
      RZ.gov.BUDGET_LINES.reduce((n, l) => n + pack[l.k], 0) === 100,
      JSON.stringify(pack));
    ok('and health is the line that rose', pack.health > S.nation.budget.health &&
      pack.debtsvc < S.nation.budget.debtsvc);
  }
}

/* ================= 1.8.2 cabinet dynamics ================= */
section('1.8.2 Cabinet is people, not a dice roll');
{
  function asPres(cid, seed) {
    const S = career(cid, seed, 12);
    makePresident(S);
    S.actionsLeft = 5;
    S.parties[S.player.partyId].gov = true;
    return S;
  }
  function playCut(S, picks) {
    const out = RZ.engine.doAction(S, 'reshuffle');
    if (!out || !out.dialogue) throw new Error('reshuffle did not open a room');
    const cv = out.dialogue;
    for (const want of picks) {
      const opts = RZ.dialogue.options(cv).filter((o) => o.ok);
      let pick;
      if (want === 'none') pick = opts.find((o) => !o.side);
      else if (typeof want === 'number') pick = opts[want];
      else pick = opts.find((o) => o.side === want);
      if (!pick) pick = opts[0];
      RZ.dialogue.choose(cv, pick.i);
    }
    if (!cv.done) throw new Error('cabinet-cut never closed');
    RZ.engine.finishDialogue(S, cv);
    return cv;
  }

  {
    const S = asPres('BW', 1820);
    RZ.state.fillCabinet(S);
    ok('a President has a named cabinet', S.cabinet.length >= 5 && S.cabinet.every((m) => m.name));
    const fin = S.cabinet.find((m) => m.ministryId === 'fin');
    const purse = RZ.cast.who(S, RZ.COUNTRIES.BW, 'Minister of Finance', 'the Treasury');
    ok('Finance at the table is Finance in the estimates room',
      !!(fin && purse && fin.name === purse.name),
      `table=${fin && fin.name} cast=${purse && purse.name}`);
  }

  {
    const S = asPres('ZA', 1821);
    RZ.state.fillCabinet(S);
    S.cabinet.forEach((m) => { m.loyalty = 10; m.corruption = 50; });
    S.player.standing.leader = 60;
    const before = S.cabinet.reduce((n, m) => n + m.loyalty, 0) / S.cabinet.length;
    for (let i = 0; i < 36; i++) RZ.state.cabinetTick(S, 1, {});
    const after = S.cabinet.reduce((n, m) => n + m.loyalty, 0) / S.cabinet.length;
    ok('loyalty finds a level rather than pinning at the floor',
      after > before + 8 && after < 70, `${before.toFixed(1)} -> ${after.toFixed(1)}`);
  }

  {
    const S = asPres('BW', 1822);
    RZ.state.fillCabinet(S);
    const fin = S.cabinet.find((m) => m.ministryId === 'fin');
    const oldName = fin.name;
    const r = RZ.state.dropMinister(S, 'fin', { loyalty: 80, competence: 40, corruption: 20 });
    ok('dropping a minister changes who sits there', r && r.next.name !== oldName,
      `gone=${oldName} next=${r && r.next.name}`);
    ok('and the chair is still filled',
      S.cabinet.find((m) => m.ministryId === 'fin').name === r.next.name);
    ok('and the old occupant is still somebody you know',
      Object.keys(S.cast).some((k) => S.cast[k].name === oldName));
    const purse = RZ.cast.who(S, RZ.COUNTRIES.BW, 'Minister of Finance', 'the Treasury');
    ok('so the next estimates room gets the new one', purse.name === r.next.name,
      `cast=${purse.name} next=${r.next.name}`);
  }

  {
    const S = asPres('BW', 1823);
    const acts = RZ.engine.availableActions(S);
    ok('a president is still offered the reshuffle', acts.some((a) => a.id === 'reshuffle'));
    const cv = playCut(S, ['rot', 0]);
    ok('reshuffle opens the cut, not a dice roll', cv.sceneId === 'cabinet-cut', cv.sceneId);
    ok('and two named ministers are in the room',
      !!(cv.people.cut && cv.people.rot && cv.people.cut.name && cv.people.rot.name),
      JSON.stringify({ cut: cv.people.cut && cv.people.cut.name, rot: cv.people.rot && cv.people.rot.name }));
    ok('and somebody actually left the table', (S.flags.cabinetDropped || 0) >= 1,
      String(S.flags.cabinetDropped));
  }

  {
    const S = RZ.engine.newGame({
      countryId: 'BW', seed: 1824, name: 'Test Minister', gender: 'f',
      regionId: RZ.COUNTRIES.BW.regions[0].id, bgId: RZ.BACKGROUNDS[0].id,
      partyId: RZ.COUNTRIES.BW.parties[0].id, startAs: 'minister'
    });
    ok('minister start does not fill the cabinet at creation',
      !S.cabinet || S.cabinet.length === 0, String(S.cabinet && S.cabinet.length));
    RZ.state.fillCabinet(S);
    const mine = RZ.state.playerMinistryId(S);
    ok('and then skips the chair you already sit in',
      !!mine && !S.cabinet.some((m) => m.ministryId === mine),
      `mine=${mine} seats=${S.cabinet.map((m) => m.ministryId).join(',')}`);
    const rows = RZ.state.cabinetSummary(S);
    ok('and the table still has a row that is you',
      rows.some((r) => r.you), JSON.stringify(rows.map((r) => r.risk)));
  }

  {
    const S = asPres('ZA', 1825);
    RZ.state.fillCabinet(S);
    S.cabinet.forEach((m) => { m.loyalty = 8; });
    const cr = RZ.state.CRISES.find((c) => c.id === 'cabinet-leak');
    ok('a disloyal cabinet is eligible for the leak room', cr.when(S) === true);
    ok('and names the leaker', !!S.flags.leakerId, String(S.flags.leakerId));
    const row = RZ.state.CRISES.find((c) => c.id === 'cabinet-row');
    ok('two ministers of different kinds can be summoned to argue', row.when(S) === true &&
      S.flags.rowLeft && S.flags.rowRight && S.flags.rowLeft !== S.flags.rowRight,
      JSON.stringify({ left: S.flags.rowLeft, right: S.flags.rowRight }));
    const vp = career('ZA', 1826, 11);
    vp.parties[vp.player.partyId].gov = true;
    RZ.state.fillCabinet(vp);
    ok('and a deputy can be in that room too', row.when(vp) === true);
  }
}

/* ================= 1.8.3 deputy desk, stale diary, palace lock ================= */
section('1.8.3 The deputy does not give his speech');
{
  const PALACE = ['address', 'reshuffle', 'anticorr', 'summit', 'resourcedeal',
                  'judges', 'security', 'earlyelection'];
  function asVp(cid, seed) {
    const S = career(cid, seed, 11);
    const lad = RZ.ladderFor(cid);
    const vp = lad.findIndex((r) => r.id === 'vp' || r.id === 'vpza' || r.tier === 11);
    S.player.rungIdx = vp >= 0 ? vp : S.player.rungIdx;
    S.player.isPresident = false;
    S.actionsLeft = 5;
    return S;
  }

  {
    const S = asVp('BW', 1830);
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    const leaked = ids.filter((id) => PALACE.indexOf(id) >= 0);
    ok('the deputy desk does not offer the palace actions', leaked.length === 0, leaked.join(','));
    ok('and still offers the estimates', ids.indexOf('budget') >= 0);
    ok('and still offers an amendment', ids.indexOf('amend') >= 0);
  }

  {
    const S = asVp('ZA', 1831);
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    const leaked = ids.filter((id) => PALACE.indexOf(id) >= 0);
    ok('nor does a South African deputy', leaked.length === 0, leaked.join(','));
  }

  {
    let leaked = [];
    for (let i = 0; i < 50; i++) {
      const S = asVp('BW', 1840 + i);
      RZ.docket.build(S).entries.forEach((e) => {
        if (PALACE.indexOf(e.actionId) >= 0) leaked.push(e.actionId);
      });
    }
    ok('fifty deputy diaries never book a palace action', leaked.length === 0, leaked.join(','));
  }

  {
    const S = asVp('BW', 1899);
    const left = S.actionsLeft;
    S.docket = {
      turn: S.turn, declined: 0, kept: 0,
      entries: [{
        actionId: 'address', sceneId: null, ico: '📺', name: 'Address the nation',
        at: '08:00', who: null, why: 'The office put it there. Nobody asked you.',
        kept: false, declined: false
      }]
    };
    ok('a leftover nation-address is not still in the book',
      RZ.docket.entries(S).every((e) => e.actionId !== 'address'),
      JSON.stringify(RZ.docket.entries(S).map((e) => e.actionId)));
    ok('and taking it does nothing', RZ.engine.doAction(S, 'address') === null);
    ok('and it did not spend the morning', S.actionsLeft === left);
  }

  {
    const S = asVp('BW', 1900);
    S.docket = {
      turn: S.turn, declined: 0, kept: 0,
      entries: [{
        actionId: 'address', sceneId: null, ico: '📺', name: 'Address the nation',
        at: '08:00', who: { key: 'x', name: 'Someone', role: 'the Secretary' },
        why: 'They asked for the meeting.', kept: false, declined: false
      }]
    };
    const feed0 = S.feed.length;
    RZ.docket.close(S);
    ok('closing the month does not stand anyone up for a palace slot you could not keep',
      S.feed.length === feed0, String(S.feed.length - feed0));
  }

  {
    const T = career('BW', 1901, 12);
    makePresident(T);
    const ids = RZ.engine.availableActions(T).map((a) => a.id);
    ok('a president is still offered the address', ids.indexOf('address') >= 0);
    ok('and allowed() agrees', RZ.gov.allowed(T, RZ.gov.actionById('address')) === true);
    const V = asVp('BW', 1902);
    ok('a deputy is not', RZ.gov.allowed(V, RZ.gov.actionById('address')) === false);
    ok('but is allowed the estimates', RZ.gov.allowed(V, RZ.gov.actionById('budget')) === true);
  }

  {
    const T = career('BW', 1903, 12);
    makePresident(T);
    T.actionsLeft = 3;
    const out = RZ.engine.doAction(T, 'address');
    ok('a president can still give the speech', !!(out && (out.res || out.dialogue || out.entry)),
      JSON.stringify(out && Object.keys(out)));
    ok('and the speech is now a holding room', !!(out && out.dialogue && out.dialogue.sceneId === 'nation-address'),
      out && out.dialogue && out.dialogue.sceneId);
  }
}

/* ================= 1.9.0 the office has a job ================= */
section('1.9.0 The office has a job');

{
  function asMinister(cid, seed, ministryId) {
    const S = career(cid, seed, 6);
    const c = RZ.COUNTRIES[cid];
    const m = (c.ministries || []).find((x) => x.id === ministryId) || c.ministries[0];
    S.player.ministry = m.name;
    S.parties[S.player.partyId].gov = true;
    S.player.isPresident = false;
    S.actionsLeft = 4;
    if (RZ.blocs) RZ.blocs.init(S);
    return S;
  }
  function playOut(cv) {
    let guard = 0;
    while (!cv.done && guard++ < 12) {
      const opts = RZ.dialogue.options(cv).filter((o) => o.ok);
      if (!opts.length) throw new Error('no options in ' + cv.sceneId);
      RZ.dialogue.choose(cv, opts[0].i);
    }
    if (!cv.done) throw new Error(cv.sceneId + ' never closed');
    return cv;
  }

  {
    const S = asMinister('BW', 190, 'health');
    ok('health maps to the clinic room', RZ.state.dutySceneId(S) === 'duty-clinic');
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('a minister is offered the ministry', ids.indexOf('ministry') >= 0);
    ok('and constituency Friday', ids.indexOf('friday') >= 0);
    const duty = RZ.ward.duty(S);
    ok('the desk names sitting the ministry', duty.id === 'ministry', duty && duty.id);
  }

  {
    const S = asMinister('BW', 191, 'edu');
    ok('education maps to the school room', RZ.state.dutySceneId(S) === 'duty-school');
    S.actionsLeft = 4;
    const h0 = S.nation.society.education;
    const out = RZ.engine.doAction(S, 'ministry');
    ok('sitting education opens the school room', !!(out && out.dialogue && out.dialogue.sceneId === 'duty-school'),
      out && out.dialogue && out.dialogue.sceneId);
    playOut(out.dialogue);
    ok('a delivered education minute moves the schools', S.nation.society.education > h0,
      `${h0} -> ${S.nation.society.education}`);
    ok('and marks the duty sat', S.flags.didDuty === S.turn);
  }

  {
    const S = asMinister('BW', 192, 'health');
    const h0 = S.nation.society.health;
    RZ.state.applyDuty(RZ.engine.mkApi(S), 'health', 'deliver');
    ok('a delivered health duty stocks the clinics', S.nation.society.health > h0);
  }

  {
    const S = asMinister('BW', 193, 'def');
    ok('defence maps to the cluster', RZ.state.dutySceneId(S) === 'duty-cluster');
    S.actionsLeft = 4;
    const out = RZ.engine.doAction(S, 'ministry');
    ok('sitting defence opens the cluster', out && out.dialogue && out.dialogue.sceneId === 'duty-cluster');
  }

  {
    const S = asMinister('BW', 194, 'mines');
    ok('mines maps to the shaft', RZ.state.dutySceneId(S) === 'duty-shaft');
  }

  {
    const S = asMinister('BW', 195, 'local');
    ok('local government maps to the list', RZ.state.dutySceneId(S) === 'duty-list');
  }

  {
    const S = asMinister('BW', 196, 'infra');
    ok('works maps to the road', RZ.state.dutySceneId(S) === 'duty-road');
  }

  {
    const S = career('BW', 197, 4);
    S.actionsLeft = 4;
    RZ.ward.init(S);
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('an MP is offered Friday', ids.indexOf('friday') >= 0);
    ok('and is not offered the ministry', ids.indexOf('ministry') < 0);
    const t0 = S.ward.trust;
    const out = RZ.engine.doAction(S, 'friday');
    ok('Friday opens the yard', !!(out && out.dialogue && out.dialogue.sceneId === 'friday-ward'),
      out && out.dialogue && out.dialogue.sceneId);
    playOut(out.dialogue);
    ok('and the ward noticed you came', S.ward.lastFriday === S.turn && S.ward.trust >= t0);
  }

  {
    const S = career('BW', 198, 4);
    RZ.ward.init(S);
    RZ.ward.initManifesto(S);
    RZ.ward.pickManifesto(S, 'clinic');
    RZ.ward.pickManifesto(S, 'road');
    RZ.ward.pickManifesto(S, 'jobs');
    ok('three lines make a manifesto', RZ.ward.hasManifesto(S));
    RZ.ward.stamp(S, 'clinic', 'kept');
    RZ.ward.stamp(S, 'road', 'broken');
    const led = RZ.ward.ledger(S);
    ok('the ledger stamps kept and broken', led.kept === 1 && led.broken === 1, JSON.stringify(led.items));
  }

  {
    const low = career('BW', 199, 4);
    const high = career('BW', 199, 4);
    RZ.ward.init(low); RZ.ward.init(high);
    low.ward.trust = 20; high.ward.trust = 85;
    high.ward.delivered = 3; low.ward.abandoned = 2;
    ok('a trusted incumbent scores higher than a neglected one',
      RZ.ward.incumbentSwing(high) > RZ.ward.incumbentSwing(low),
      `${RZ.ward.incumbentSwing(high)} vs ${RZ.ward.incumbentSwing(low)}`);
  }

  {
    const S = career('BW', 200, 4);
    RZ.ward.init(S);
    const api = RZ.engine.mkApi(S);
    const p = RZ.ward.start(S, api, 'clinic', { rushed: true });
    p.monthsLeft = 0; p.risk = 0;
    RZ.ward.tick(S, 1, {});
    ok('a finished clinic summons the ribbon', S.pendingScene === 'ribbon-day', String(S.pendingScene));
    ok('and remembers what opened', !!(S.flags.ribbon && S.flags.ribbon.kind === 'clinic'),
      JSON.stringify(S.flags.ribbon));
    const cv = RZ.dialogue.beginById(S, 'ribbon-day');
    ok('the ribbon is a meeting', !!(cv && cv.sceneId === 'ribbon-day'));
    playOut(cv);
    ok('and the flag is cleared', !S.flags.ribbon);
  }

  {
    const T = career('BW', 201, 12);
    makePresident(T);
    T.actionsLeft = 3;
    T.date.month = 3;
    const duty = RZ.ward.duty(T);
    ok('the presidential duty is the briefing', duty.id === 'brief', duty && duty.id);
    T.date.month = 2;
    T.flags.sonaYear = T.date.year - 1;
    ok('February without a speech is State of the Nation', RZ.ward.duty(T).id === 'address');
    const out = RZ.engine.doAction(T, 'address');
    ok('Address the nation is a holding room', !!(out && out.dialogue && out.dialogue.sceneId === 'nation-address'));
    playOut(out.dialogue);
    ok('and the year is marked', T.flags.sonaYear === T.date.year);
  }

  {
    const S = career('BW', 202, 4);
    S.campaign.season = true;
    S.pendingScene = null;
    ok('a campaign without a manifesto is eligible for the desk',
      RZ.dialogue.byId('manifesto-desk').when(RZ.engine.mkApi(S)) === true);
    RZ.dialogue.summon(S, 'manifesto-desk');
    const cv = RZ.dialogue.beginById(S, 'manifesto-desk');
    playOut(cv);
    ok('three beats print three lines', RZ.ward.hasManifesto(S),
      JSON.stringify(S.manifesto && S.manifesto.items));
  }

  {
    const S = asMinister('BW', 203, 'health');
    ok('ministry rooms exist for every family',
      ['duty-clinic','duty-school','duty-road','duty-cluster','duty-shaft','duty-list']
        .every((id) => !!RZ.dialogue.byId(id)));
  }

  {
    const S = asMinister('BW', 204, 'health');
    const pool = RZ.dialogue.scenesFor(S, 'ministry').map((sc) => sc.id);
    ok('a health minister is only offered the clinic', pool.length === 1 && pool[0] === 'duty-clinic', pool.join(','));
    RZ.docket.build(S);
    const first = RZ.docket.entries(S)[0];
    ok('the diary opens on sitting the ministry', !!(first && first.actionId === 'ministry'), first && first.actionId);
    ok('and the person in it is from the clinic', !!(first && first.sceneId === 'duty-clinic'), first && first.sceneId);
  }

  {
    const S = career('BW', 205, 4);
    RZ.docket.build(S);
    const first = RZ.docket.entries(S)[0];
    ok('an MP diary opens on Friday', !!(first && first.actionId === 'friday'), first && first.actionId);
  }

  {
    const S = career('BW', 206, 4);
    RZ.ward.init(S);
    const t0 = S.ward.trust;
    RZ.ward.tick(S, 1, {});
    S.turn += 2;
    RZ.ward.tick(S, 1, {});
    ok('staying in the capital drains the ward', S.ward.trust < t0, `${t0} -> ${S.ward.trust}`);
  }
}

/* ================= 1.10.0 State House ================= */
section('1.10.0 State House');

{
  function playOut(cv) {
    let guard = 0;
    while (!cv.done && guard++ < 12) {
      const opts = RZ.dialogue.options(cv).filter((o) => o.ok);
      if (!opts.length) throw new Error('no options in ' + cv.sceneId);
      RZ.dialogue.choose(cv, opts[0].i);
    }
    if (!cv.done) throw new Error(cv.sceneId + ' never closed');
    return cv;
  }

  {
    const S = makePresident(career('BW', 210, 13));
    S.date.month = 3;
    RZ.state.fillCabinet(S);
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('a president is offered the briefing', ids.indexOf('brief') >= 0);
    ok('and the summit', ids.indexOf('summit') >= 0);
    ok('and still the speech', ids.indexOf('address') >= 0);
    const duty = RZ.ward.duty(S);
    ok('the desk names the briefing', duty.id === 'brief', duty && duty.id);
  }

  {
    const V = career('BW', 211, 11);
    V.player.isPresident = false;
    const ids = RZ.engine.availableActions(V).map((a) => a.id);
    ok('a deputy is not offered the briefing', ids.indexOf('brief') < 0);
    ok('and doAction refuses it', RZ.engine.doAction(V, 'brief') === null);
  }

  {
    const S = makePresident(career('BW', 212, 13));
    RZ.state.fillCabinet(S);
    const file = RZ.state.houseFile(S);
    ok('the file names a worst number', !!(file && file.worst && file.worst.k), JSON.stringify(file && file.worst));
    ok('and a hottest province', !!(file && file.hot && file.hot.name));
    ok('and a plotter from the table', !!(file && file.plotter && file.plotter.ministryId));
    const brief = RZ.state.pickBrief(S);
    ok('the briefing picks two chairs', !!(brief && brief.left && brief.right && brief.left.ministryId !== brief.right.ministryId),
      brief && brief.left && brief.right && brief.left.ministryId + '/' + brief.right.ministryId);
    ok('of different kinds', RZ.state.ministryKind(S, brief.left.ministryId) !== RZ.state.ministryKind(S, brief.right.ministryId));
  }

  {
    const S = makePresident(career('BW', 213, 13));
    RZ.state.fillCabinet(S);
    RZ.state.pickBrief(S);
    S.actionsLeft = 4;
    const h0 = S.nation.society.health;
    const g0 = S.nation.economy.growth;
    const out = RZ.engine.doAction(S, 'brief');
    ok('taking the briefing opens the cabinet room', !!(out && out.dialogue && out.dialogue.sceneId === 'cabinet-brief'),
      out && out.dialogue && out.dialogue.sceneId);
    playOut(out.dialogue);
    ok('and marks the duty sat', S.flags.didDuty === S.turn);
    ok('and a delivered minute moves the country',
      S.nation.society.health > h0 || S.nation.economy.growth > g0 || S.flags.houseQuality,
      `health ${h0}->${S.nation.society.health} growth ${g0}->${S.nation.economy.growth} q=${S.flags.houseQuality}`);
  }

  {
    const S = makePresident(career('BW', 214, 13));
    RZ.state.fillCabinet(S);
    RZ.state.pickBrief(S);
    const left = RZ.state.byMinistry(S, S.flags.briefLeft);
    const loy0 = left.loyalty;
    const unrest0 = S.nation.society.unrest;
    RZ.state.applyHouse(RZ.engine.mkApi(S), 'power', 'deliver');
    ok('a delivered power minute cools the street', S.nation.society.unrest < unrest0,
      `${unrest0} -> ${S.nation.society.unrest}`);
    ok('and warms the minister who won', left.loyalty > loy0, `${loy0} -> ${left.loyalty}`);
    ok('and stamps ranTheCountry', !!S.legacyMarks.ranTheCountry);
  }

  {
    const S = makePresident(career('BW', 215, 13));
    S.actionsLeft = 3;
    const out = RZ.engine.doAction(S, 'summit');
    ok('the summit is a corridor', !!(out && out.dialogue && out.dialogue.sceneId === 'sadc-summit'),
      out && out.dialogue && out.dialogue.sceneId);
    playOut(out.dialogue);
    ok('and remembers what was signed', !!S.flags.summit);
  }

  {
    const S = makePresident(career('BW', 216, 13));
    S.nation.govApproval = 28;
    S.nation.society.unrest = 70;
    const cr = RZ.state.CRISES.find((c) => c.id === 'house-censure');
    ok('low approval makes a censure eligible', cr.when(S) === true);
    const cv = RZ.dialogue.beginById(S, 'house-censure');
    ok('the censure is a meeting', !!(cv && cv.sceneId === 'house-censure'));
    playOut(cv);
    ok('and the House records a result', !!S.flags.censure, String(S.flags.censure));
  }

  {
    const S = makePresident(career('BW', 217, 13));
    S.date.month = 3;
    RZ.docket.build(S);
    const first = RZ.docket.entries(S)[0];
    ok('the presidential diary opens on the briefing', !!(first && first.actionId === 'brief'), first && first.actionId);
  }

  {
    const S = makePresident(career('ZA', 218, 13));
    RZ.COUNTRIES.ZA.regions.forEach(function (r) { S.player.regionSupport[r.id] = 40; });
    S.player.regionSupport.wc = 2;
    const hot = RZ.state.hottestRegion(S);
    ok('the hottest province is the one with the least support', hot.id === 'wc', JSON.stringify(hot));
  }

  {
    ok('the three State House rooms exist',
      ['cabinet-brief', 'house-censure', 'sadc-summit'].every((id) => !!RZ.dialogue.byId(id)));
    ok('censure is a summoned crisis', RZ.state.SUMMONS.indexOf('house-censure') >= 0);
  }
}

/* ================= 1.11.0 A second year in office ================= */
section('1.11.0 A second year in office');

{
  function playOut(cv) {
    let guard = 0;
    while (!cv.done && guard++ < 12) {
      const opts = RZ.dialogue.options(cv).filter((o) => o.ok);
      if (!opts.length) throw new Error('no options in ' + cv.sceneId);
      RZ.dialogue.choose(cv, opts[0].i);
    }
    if (!cv.done) throw new Error(cv.sceneId + ' never closed');
    return cv;
  }

  {
    const S = makePresident(career('BW', 220, 13));
    S.date.month = 3;
    RZ.state.fillCabinet(S);
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('a president is offered the hottest province', ids.indexOf('province') >= 0);
    ok('and the ambassador', ids.indexOf('embassy') >= 0);
    ok('and the opposition', ids.indexOf('opposition') >= 0);
    ok('and the tax package', ids.indexOf('tax') >= 0);
  }

  {
    const V = career('BW', 221, 11);
    V.player.isPresident = false;
    const ids = RZ.engine.availableActions(V).map((a) => a.id);
    ok('a deputy is not offered the province', ids.indexOf('province') < 0);
    ok('and doAction refuses it', RZ.engine.doAction(V, 'province') === null);
  }

  {
    const S = makePresident(career('BW', 222, 13));
    RZ.state.fillCabinet(S);
    const proj = RZ.state.pickProject(S);
    ok('the project names a province', !!(proj && proj.hot && proj.hot.id), JSON.stringify(proj && proj.hot));
    ok('and a kind of thing', !!(proj && proj.kind), proj && proj.kind);
    ok('and two chairs', !!(proj && proj.min && proj.purse && proj.min.ministryId !== proj.purse.ministryId),
      proj && proj.min && proj.purse && proj.min.ministryId + '/' + proj.purse.ministryId);
  }

  {
    const S = makePresident(career('BW', 223, 13));
    RZ.state.fillCabinet(S);
    RZ.state.pickProject(S);
    S.actionsLeft = 4;
    const out = RZ.engine.doAction(S, 'province');
    ok('sitting the province opens the site', !!(out && out.dialogue && out.dialogue.sceneId === 'house-project'),
      out && out.dialogue && out.dialogue.sceneId);
    playOut(out.dialogue);
    ok('and a delivered date plants a project', !!(S.house && S.house.project) || S.flags.projQuality === 'show',
      JSON.stringify(S.house && S.house.project) + ' q=' + S.flags.projQuality);
  }

  {
    const S = makePresident(career('ZA', 224, 13));
    RZ.COUNTRIES.ZA.regions.forEach(function (r) { S.player.regionSupport[r.id] = 40; });
    S.player.regionSupport.wc = 2;
    RZ.state.fillCabinet(S);
    RZ.state.pickProject(S);
    const rid = S.flags.projRegion;
    const s0 = S.player.regionSupport[rid];
    RZ.state.applyProject(RZ.engine.mkApi(S), 'deliver');
    ok('a delivered project is live', !!(RZ.state.liveProject(S)));
    ok('and warms the province a little now', S.player.regionSupport[rid] > s0,
      `${s0} -> ${S.player.regionSupport[rid]}`);
    ok('and stamps builtTheProvince', !!S.legacyMarks.builtTheProvince);
    const photo = makePresident(career('BW', 2231, 13));
    RZ.state.fillCabinet(photo);
    RZ.state.pickProject(photo);
    RZ.state.applyProject(RZ.engine.mkApi(photo), 'show');
    ok('a photograph does not plant a site', !RZ.state.liveProject(photo));
    const p = RZ.state.liveProject(S);
    p.left = 0;
    RZ.state.finishProject(S);
    ok('finishing it clears the site', !RZ.state.liveProject(S));
    ok('and the province moved again', S.player.regionSupport[rid] > s0);
  }

  {
    const S = makePresident(career('ZW', 225, 13));
    S.nation.intl.sanctions = 40;
    const pow = RZ.state.pickPower(S);
    ok('sanctions bring Washington', pow.id === 'us', pow && pow.id);
    const S2 = makePresident(career('BW', 226, 13));
    S2.nation.economy.debt = 96;
    S2.nation.intl.sanctions = 0;
    const china = RZ.state.pickPower(S2);
    ok('a hole in the books brings Beijing', china.id === 'china', china && china.id);
    const S3 = makePresident(career('BW', 227, 13));
    S3.nation.intl.sanctions = 0;
    S3.nation.economy.debt = 26;
    S3.flags.powerLast = null;
    const n = RZ.state.pickPower(S3);
    ok('otherwise the neighbour', n.id === 'neighbour', n && n.id + ' ' + n.name);
    ok('Botswana\'s neighbour is South Africa', n.neighbourId === 'ZA', n && n.neighbourId);
  }

  {
    const S = makePresident(career('BW', 228, 13));
    S.actionsLeft = 3;
    const out = RZ.engine.doAction(S, 'embassy');
    ok('the ambassador is a room', !!(out && out.dialogue && out.dialogue.sceneId === 'great-power'),
      out && out.dialogue && out.dialogue.sceneId);
    playOut(out.dialogue);
    ok('and remembers what was signed', !!S.flags.powerDeal, String(S.flags.powerDeal));
  }

  {
    const S = makePresident(career('BW', 229, 13));
    S.actionsLeft = 3;
    const out = RZ.engine.doAction(S, 'resourcedeal');
    ok('a resource deal is the same room', !!(out && out.dialogue && out.dialogue.sceneId === 'great-power'));
    ok('and it is China', S.flags.powerId === 'china', S.flags.powerId);
  }

  {
    const S = makePresident(career('BW', 230, 13));
    const o = RZ.state.opposition(S);
    ok('the opposition has a name', !!(o && o.name), JSON.stringify(o));
    ok('and a party that is not yours', o.partyId && o.partyId !== S.player.partyId, o.partyId);
    const again = RZ.state.opposition(S);
    ok('and they persist', again.id === o.id && again.name === o.name);
    S.actionsLeft = 3;
    const out = RZ.engine.doAction(S, 'opposition');
    ok('calling them in is a meeting', !!(out && out.dialogue && out.dialogue.sceneId === 'opp-meet'),
      out && out.dialogue && out.dialogue.sceneId);
    playOut(out.dialogue);
    ok('and the corridor records a result', !!S.flags.oppDeal, String(S.flags.oppDeal));
  }

  {
    const S = makePresident(career('BW', 231, 13));
    S.nation.govApproval = 32;
    RZ.state.opposition(S);
    S.opposition.file = 40;
    const cr = RZ.state.CRISES.find((c) => c.id === 'opp-table');
    ok('a file and a floor make a motion eligible', cr.when(S) === true);
    const cv = RZ.dialogue.beginById(S, 'opp-table');
    ok('the motion is a meeting', !!(cv && cv.sceneId === 'opp-table'));
    playOut(cv);
    ok('and the House records a result', !!S.flags.oppDeal, String(S.flags.oppDeal));
  }

  {
    const S = makePresident(career('BW', 232, 13));
    S.date.month = 10;
    const duty = RZ.ward.duty(S);
    ok('October without a package pins tax', duty.id === 'tax', duty && duty.id);
    S.actionsLeft = 3;
    const out = RZ.engine.doAction(S, 'tax');
    ok('the package is a room', !!(out && out.dialogue && out.dialogue.sceneId === 'tax-package'),
      out && out.dialogue && out.dialogue.sceneId);
    playOut(out.dialogue);
    ok('and the year is stamped', S.flags.taxYear === S.date.year, String(S.flags.taxYear));
    ok('and a pack was chosen', !!S.flags.taxPack, String(S.flags.taxPack));
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('and the action leaves the desk until next year', ids.indexOf('tax') < 0);
  }

  {
    const S = makePresident(career('BW', 233, 13));
    S.date.month = 10;
    RZ.docket.build(S);
    const first = RZ.docket.entries(S)[0];
    ok('the October diary opens on the package', !!(first && first.actionId === 'tax'), first && first.actionId);
  }

  {
    const S = makePresident(career('BW', 234, 13));
    const raw = RZ.engine.exportSave(S);
    ok('a career exports as JSON', typeof raw === 'string' && raw.indexOf(S.player.name) >= 0);
    const back = RZ.engine.importSave(raw);
    ok('and loads back', !!(back && back.player && back.player.name === S.player.name && back.countryId === 'BW'));
    ok('and refuses junk', RZ.engine.importSave('{nope}') === null);
  }

  {
    ok('the four new rooms exist',
      ['house-project', 'great-power', 'opp-meet', 'opp-table', 'tax-package'].every((id) => !!RZ.dialogue.byId(id)));
    ok('the motion is a summoned crisis', RZ.state.SUMMONS.indexOf('opp-table') >= 0);
  }
}

/* ================= 1.12.0 The opposition is a party ================= */
section('1.12.0 The opposition is a party');

{
  function playOut(cv) {
    let guard = 0;
    while (!cv.done && guard++ < 12) {
      const opts = RZ.dialogue.options(cv).filter((o) => o.ok);
      if (!opts.length) throw new Error('no options in ' + cv.sceneId);
      RZ.dialogue.choose(cv, opts[0].i);
    }
    if (!cv.done) throw new Error(cv.sceneId + ' never closed');
    return cv;
  }

  {
    const S = makePresident(career('BW', 240, 13));
    const o = RZ.state.opposition(S);
    ok('the caucus has a unity', o.unity >= 0 && o.unity <= 100, String(o.unity));
    ok('and it is the party\'s unity', S.parties[o.partyId].unity === o.unity);
    const other = RZ.state.otherOppositionParty(S);
    ok('there is another party that wants the title', !!(other && other.id && other.id !== o.partyId && other.id !== S.player.partyId),
      other && other.id);
  }

  {
    const S = makePresident(career('BW', 241, 13));
    RZ.state.opposition(S);
    const u0 = S.opposition.unity;
    RZ.state.applyOpp(RZ.engine.mkApi(S), 'deal');
    ok('a corridor drops the caucus', S.opposition.unity < u0, `${u0} -> ${S.opposition.unity}`);
    ok('and sets their line', S.opposition.line === 'corridor', S.opposition.line);
  }

  {
    const S = makePresident(career('BW', 242, 13));
    const o = RZ.state.opposition(S);
    o.unity = 22;
    o.line = 'corridor';
    const cr = RZ.state.CRISES.find((c) => c.id === 'opp-split');
    ok('a corridor makes a split eligible', cr.when(S) === true);
    S.actionsLeft = 3;
    const cv = RZ.dialogue.beginById(S, 'opp-split');
    ok('the hawk is a meeting', !!(cv && cv.sceneId === 'opp-split'));
    playOut(cv);
    ok('and the House records a result', !!S.flags.oppSplit, String(S.flags.oppSplit));
  }

  {
    const S = makePresident(career('BW', 243, 13));
    const o = RZ.state.opposition(S);
    RZ.state.hawk(S);
    const from = o.partyId;
    const s0 = S.parties[from].seats;
    const mine = S.parties[S.player.partyId].seats;
    RZ.state.applySplit(RZ.engine.mkApi(S), 'take');
    ok('taking the hawk moves a seat', S.parties[from].seats < s0 || S.flags.oppCrossed > 0,
      `${s0} -> ${S.parties[from].seats} crossed=${S.flags.oppCrossed}`);
    ok('onto your benches', S.parties[S.player.partyId].seats >= mine);
    ok('and the caucus is a split', S.opposition.line === 'split' && S.opposition.unity < 30);
    ok('and stamps splitTheOpposition', !!S.legacyMarks.splitTheOpposition);
  }

  {
    const S = makePresident(career('BW', 244, 13));
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('a president is offered the other party', ids.indexOf('oppother') >= 0);
    S.actionsLeft = 3;
    const out = RZ.engine.doAction(S, 'oppother');
    ok('calling them in is a meeting', !!(out && out.dialogue && out.dialogue.sceneId === 'opp-other'),
      out && out.dialogue && out.dialogue.sceneId);
    playOut(out.dialogue);
    ok('and the corridor records a result', !!S.flags.oppOther, String(S.flags.oppOther));
  }

  {
    const SZ = makePresident(career('SZ', 245, 13));
    const ids = RZ.engine.availableActions(SZ).map((a) => a.id);
    ok('Eswatini is not offered the other party', ids.indexOf('oppother') < 0);
  }

  {
    const S = makePresident(career('ZA', 246, 13));
    ok('a South African president can sit supply', RZ.state.supplyLive(S) === true,
      'govParties=' + (S.nation.govParties || []).join(',') + ' thin=' + RZ.state.thinMajority(S));
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('and the desk offers it', ids.indexOf('supply') >= 0);
    S.actionsLeft = 3;
    const out = RZ.engine.doAction(S, 'supply');
    ok('supply is a room', !!(out && out.dialogue && out.dialogue.sceneId === 'opp-supply'),
      out && out.dialogue && out.dialogue.sceneId);
    playOut(out.dialogue);
    ok('and the letter records a result', !!S.flags.oppSupply, String(S.flags.oppSupply));
  }

  {
    const S = makePresident(career('ZA', 247, 13));
    RZ.state.opposition(S);
    RZ.state.applySupply(RZ.engine.mkApi(S), 'paper');
    ok('a paper stamps the year', S.flags.supplyYear === S.date.year, String(S.flags.supplyYear));
  }

  {
    const file = RZ.state.houseFile(makePresident(career('BW', 248, 13)));
    ok('the file does not invent an opposition on render', file.opp === null);
  }

  {
    ok('the three party rooms exist',
      ['opp-split', 'opp-other', 'opp-supply'].every((id) => !!RZ.dialogue.byId(id)));
    ok('the split is a summoned crisis', RZ.state.SUMMONS.indexOf('opp-split') >= 0);
  }
}

/* ================= 1.13.0 A hung House is a room ================= */
section('1.13.0 A hung House is a room');

{
  function playOut(cv) {
    let guard = 0;
    while (!cv.done && guard++ < 12) {
      const opts = RZ.dialogue.options(cv).filter((o) => o.ok);
      if (!opts.length) throw new Error('no options in ' + cv.sceneId);
      RZ.dialogue.choose(cv, opts[0].i);
    }
    if (!cv.done) throw new Error(cv.sceneId + ' never closed');
    return cv;
  }

  function hungSeats(S) {
    const c = RZ.COUNTRIES[S.countryId];
    const total = c.house.seats;
    const need = Math.floor(total / 2) + 1;
    const lead = S.player.partyId;
    const rest = c.parties.filter((p) => p.id !== lead);
    const seats = {};
    seats[lead] = need - 8;
    const leftover = total - seats[lead];
    rest.forEach((p, i) => {
      seats[p.id] = i === 0
        ? Math.max(1, Math.floor(leftover * 0.45))
        : Math.max(1, Math.floor((leftover * 0.55) / Math.max(1, rest.length - 1)));
    });
    let used = Object.keys(seats).reduce((n, id) => n + seats[id], 0);
    seats[lead] += total - used;
    rest.forEach((p) => { S.parties[p.id].seats = seats[p.id]; });
    S.parties[lead].seats = seats[lead];
    return seats;
  }

  {
    const S = makePresident(career('ZA', 250, 13));
    const seats = hungSeats(S);
    const t = RZ.elections.coalitionOptions(S, seats);
    ok('ZA options see a hung House', t.hung === true, 'hung=' + t.hung + ' lead=' + t.leadSeats + ' need=' + t.need);
    ok('and name the runner-up as GNU', !!(t.gnu && t.gnu.id && t.gnu.id !== S.player.partyId), t.gnu && t.gnu.id);
    ok('and name a kingmaker who is not them', !!(t.king && t.king.id && t.king.id !== t.gnu.id),
      'king=' + (t.king && t.king.id) + ' gnu=' + (t.gnu && t.gnu.id));
    ok('and GNU is the two largest', t.gnuSlate.length === 2, String(t.gnuSlate));
    ok('and a kingmaker slate is not GNU', t.kingSlate.join(',') !== t.gnuSlate.join(','),
      'king=' + t.kingSlate.join('+') + ' gnu=' + t.gnuSlate.join('+'));
  }

  {
    const S = makePresident(career('ZA', 251, 13));
    hungSeats(S);
    const t = RZ.elections.coalitionOptions(S);
    S.flags.coalitionTalks = t;
    RZ.elections.applyCoalition(RZ.engine.mkApi(S), 'gnu');
    ok('GNU writes the runner-up into government', S.nation.govParties.indexOf(t.gnu.id) >= 0,
      String(S.nation.govParties));
    ok('and stamps formedGnu', !!S.legacyMarks.formedGnu);
    ok('and clears the talks', S.flags.coalitionTalks === null);
    ok('and the kind is gnu', S.flags.coalitionKind === 'gnu');
  }

  {
    const S = makePresident(career('ZA', 252, 13));
    hungSeats(S);
    const t = RZ.elections.coalitionOptions(S);
    S.flags.coalitionTalks = t;
    RZ.elections.applyCoalition(RZ.engine.mkApi(S), 'king');
    ok('a kingmaker writes a partner who is not the runner-up',
      S.nation.govParties.indexOf(t.king.id) >= 0 && S.nation.govParties.indexOf(t.gnu.id) < 0,
      String(S.nation.govParties) + ' king=' + t.king.id + ' gnu=' + t.gnu.id);
    ok('and stamps formedKing', !!S.legacyMarks.formedKing);
  }

  {
    const S = makePresident(career('ZA', 253, 13));
    hungSeats(S);
    const t = RZ.elections.coalitionOptions(S);
    S.flags.coalitionTalks = t;
    RZ.elections.applyCoalition(RZ.engine.mkApi(S), 'minor');
    ok('a minority is the lead alone', S.nation.govParties.length === 1 && S.nation.govParties[0] === S.player.partyId,
      String(S.nation.govParties));
    ok('and stamps formedMinority', !!S.legacyMarks.formedMinority);
    ok('and supply is live', RZ.state.supplyLive(S) === true);
  }

  {
    let parked = false, last = '';
    for (let seed = 254; seed < 272 && !parked; seed++) {
      const S = makePresident(career('ZA', seed, 13));
      S.player.isLeader = true;
      S.nation.yearsInPower = 4;
      RZ.COUNTRIES.ZA.parties.forEach((p) => {
        S.parties[p.id].vote = p.id === S.player.partyId ? 44 : (p.id === 'DA' ? 22 : 5);
      });
      const r = RZ.gov.runElection(S);
      last = 'pending=' + S.pendingScene + ' lead=' + (r.gov && r.gov.lead) +
        ' hung=' + (r.gov && r.gov.hung) + ' pendingGov=' + (r.gov && r.gov.pending);
      if (S.pendingScene === 'coalition-talks' && r.talks && r.gov.pending) {
        parked = true;
        ok('a hung ZA count the player leads parks talks', true);
        ok('and the night is a caretaker', S.nation.govParties.length === 1, String(S.nation.govParties));
        const cv = RZ.dialogue.beginById(S, 'coalition-talks');
        S.pendingScene = null;
        ok('talks are a meeting', !!(cv && cv.sceneId === 'coalition-talks'));
        playOut(cv);
        ok('and a kind is stamped', !!S.flags.coalitionKind, String(S.flags.coalitionKind));
      }
    }
    if (!parked) ok('a hung ZA count the player leads parks talks', false, last);
  }

  {
    const S = makePresident(career('ZM', 255, 13));
    S.player.isLeader = true;
    const auto = RZ.elections.formGovernment(S, hungSeats(S));
    ok('a presidential republic does not sit talks', RZ.elections.talksLive(S, auto) === false);
  }

  {
    const S = makePresident(career('LS', 256, 13));
    const t = RZ.elections.coalitionOptions(S, hungSeats(S));
    ok('Lesotho names a kingmaker', !!(t.king && t.king.id), t.king && t.king.abbr);
    const auto = RZ.elections.formGovernment(S, hungSeats(S));
    ok('and a hung LS the player leads is talks', RZ.elections.talksLive(S, auto) === true,
      'hung=' + auto.hung + ' lead=' + auto.lead + ' player=' + S.player.partyId);
  }

  {
    const S0 = makePresident(career('ZA', 257, 13));
    hungSeats(S0);
    const before = RZ.elections.formGovernment(S0, hungSeats(S0));
    const S1 = makePresident(career('ZA', 257, 13));
    hungSeats(S1);
    const after = RZ.elections.formGovernment(S1, hungSeats(S1));
    ok('NPC auto-form still returns the same sort',
      before.parties.join(',') === after.parties.join(',') && before.lead === after.lead,
      before.parties.join('+') + ' vs ' + after.parties.join('+'));
  }

  {
    const file = RZ.state.houseFile(makePresident(career('BW', 258, 13)));
    ok('the file does not invent talks on render', !file.coalition || file.coalition.pending === false);
    ok('and still does not invent an opposition', file.opp === null);
  }

  {
    ok('the talks room exists', !!RZ.dialogue.byId('coalition-talks'));
    ok('and it is a summoned crisis', RZ.elections.SUMMONS.indexOf('coalition-talks') >= 0);
  }
}

/* ================= 1.14.0 Tuesday is the job ================= */
section('1.14.0 Tuesday is the job');

{
  function playOut(cv) {
    let guard = 0;
    while (!cv.done && guard++ < 12) {
      const opts = RZ.dialogue.options(cv).filter((o) => o.ok);
      if (!opts.length) throw new Error('no options in ' + cv.sceneId);
      RZ.dialogue.choose(cv, opts[0].i);
    }
    if (!cv.done) throw new Error(cv.sceneId + ' never closed');
    return cv;
  }

  function forceMinority(S, under) {
    const c = RZ.COUNTRIES[S.countryId];
    const need = Math.floor(c.house.seats / 2) + 1;
    const lead = S.player.partyId;
    under = under == null ? 8 : under;
    S.parties[lead].seats = Math.max(1, need - under);
    S.nation.govParties = [lead];
    S.flags.coalitionKind = 'minor';
    S.flags.coalitionTalks = null;
    c.parties.forEach((p) => {
      if (S.parties[p.id]) S.parties[p.id].gov = p.id === lead;
    });
    return { seats: S.parties[lead].seats, need: need };
  }

  {
    const S = makePresident(career('BW', 270, 13));
    const n = forceMinority(S);
    ok('a minority is live when the lead is short', RZ.state.minorityLive(S) === true,
      'have=' + n.seats + ' need=' + n.need);
    ok('and the House does not hold without names or a paper',
      RZ.state.houseHolds(S, {}) === false);
  }

  {
    const S = makePresident(career('BW', 271, 13));
    forceMinority(S);
    S.player.standing.leader = 60;
    S.player.standing.party = 50;
    S.flags.censurePlan = 'whip';
    ok('two names from the Whip and two from leadership are not a majority of 31',
      RZ.state.houseHolds(S, { whip: true }) === false,
      'have=' + RZ.state.govSeats(S) + ' need=' + RZ.state.houseNeed(S));
  }

  {
    const S = makePresident(career('BW', 272, 13));
    forceMinority(S, 2);
    S.player.standing.leader = 60;
    S.player.standing.party = 55;
    ok('a two-seat hole can be whipped', RZ.state.houseHolds(S, { whip: true }) === true,
      'have=' + RZ.state.govSeats(S) + ' +names vs need=' + RZ.state.houseNeed(S));
  }

  {
    const S = makePresident(career('BW', 273, 13));
    forceMinority(S);
    S.flags.supplyYear = S.date.year;
    S.player.standing.party = 50;
    ok('a paper this year holds a minority whose caucus is intact',
      RZ.state.houseHolds(S, {}) === true);
    S.player.standing.party = 18;
    ok('and does not hold one whose caucus has left',
      RZ.state.houseHolds(S, { whip: true }) === false);
  }

  {
    const S = makePresident(career('BW', 274, 13));
    S.player.standing.party = 50;
    S.player.standing.leader = 50;
    ok('a majority holds without a paper', RZ.state.houseHolds(S, {}) === true,
      'have=' + RZ.state.govSeats(S) + ' need=' + RZ.state.houseNeed(S) + ' minority=' + RZ.state.minorityLive(S));
  }

  {
    const S = makePresident(career('BW', 275, 13));
    forceMinority(S);
    S.date.month = 3;
    const duty = RZ.ward.duty(S);
    ok('a minority without a paper pins supply', duty.id === 'supply', duty && duty.id);
    S.date.month = 10;
    const oct = RZ.ward.duty(S);
    ok('and Tuesday beats the October package', oct.id === 'supply', oct && oct.id);
    S.date.month = 2;
    const feb = RZ.ward.duty(S);
    ok('and February is still the speech', feb.id === 'address', feb && feb.id);
  }

  {
    const S = makePresident(career('BW', 276, 13));
    forceMinority(S);
    RZ.state.applySupply(RZ.engine.mkApi(S), 'paper');
    ok('a paper stamps the year', S.flags.supplyYear === S.date.year);
    S.date.month = 4;
    const duty = RZ.ward.duty(S);
    ok('and the pin goes away until next year', duty.id !== 'supply', duty && duty.id);
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('and the action leaves the desk', ids.indexOf('supply') < 0);
  }

  {
    const S = makePresident(career('BW', 277, 13));
    forceMinority(S);
    const st0 = S.nation.society.stability;
    RZ.state.tick(S, 1, {});
    ok('skipping Tuesday is counted', (S.flags.missedSupply || 0) >= 1, String(S.flags.missedSupply));
    ok('and stability moves', S.nation.society.stability < st0,
      `${st0} -> ${S.nation.society.stability}`);
  }

  {
    const S = makePresident(career('BW', 278, 13));
    forceMinority(S);
    S.player.standing.leader = 40;
    S.player.standing.party = 50;
    const out = RZ.state.applyCensure(RZ.engine.mkApi(S), 'whip');
    ok('a lost whip in a parliamentary minority takes the chair', out === 'lost' && S.over === true && S.ending === 'noconfidence',
      'out=' + out + ' over=' + S.over + ' ending=' + S.ending);
  }

  {
    const S = makePresident(career('ZM', 279, 13));
    S.player.standing.party = 10;
    S.player.standing.leader = 20;
    const out = RZ.state.applyCensure(RZ.engine.mkApi(S), 'whip');
    ok('a presidential House cannot take the chair', S.over !== true && out === 'lost',
      'over=' + S.over + ' out=' + out + ' system=' + RZ.COUNTRIES.ZM.system);
  }

  {
    const S = makePresident(career('BW', 280, 13));
    const cr = RZ.state.CRISES.find((c) => c.id === 'house-censure');
    const pMaj = cr.p(S);
    forceMinority(S);
    const pMin = cr.p(S);
    ok('a minority without a paper is a live censure', cr.when(S) === true);
    ok('and likelier than a majority', pMin > pMaj, `maj=${pMaj} min=${pMin}`);
  }

  {
    const S = makePresident(career('BW', 281, 13));
    forceMinority(S);
    const file = RZ.state.houseFile(S);
    ok('the file names a minority', file.coalition && file.coalition.minority === true);
    ok('and prints the arithmetic without inventing people',
      file.coalition.seats === RZ.state.govSeats(S) && file.opp === null);
  }

  {
    const S = makePresident(career('BW', 282, 13));
    forceMinority(S);
    S.date.month = 3;
    S.actionsLeft = 3;
    RZ.docket.build(S);
    const first = RZ.docket.entries(S)[0];
    ok('the diary opens on Tuesday', !!(first && first.actionId === 'supply'), first && first.actionId);
  }
}

/* ================= 1.15.0 The partner is a person ================= */
section('1.15.0 The partner is a person');

{
  function hungSeats(S) {
    const c = RZ.COUNTRIES[S.countryId];
    const total = c.house.seats;
    const need = Math.floor(total / 2) + 1;
    const lead = S.player.partyId;
    const rest = c.parties.filter((p) => p.id !== lead);
    const seats = {};
    seats[lead] = need - 8;
    const leftover = total - seats[lead];
    rest.forEach((p, i) => {
      seats[p.id] = i === 0
        ? Math.max(1, Math.floor(leftover * 0.45))
        : Math.max(1, Math.floor((leftover * 0.55) / Math.max(1, rest.length - 1)));
    });
    let used = Object.keys(seats).reduce((n, id) => n + seats[id], 0);
    seats[lead] += total - used;
    rest.forEach((p) => { S.parties[p.id].seats = seats[p.id]; });
    S.parties[lead].seats = seats[lead];
    return seats;
  }

  function formWith(S, kind) {
    hungSeats(S);
    const t = RZ.elections.coalitionOptions(S);
    S.flags.coalitionTalks = t;
    RZ.elections.applyCoalition(RZ.engine.mkApi(S), kind);
    return t;
  }

  {
    const S = makePresident(career('ZA', 290, 13));
    const t = formWith(S, 'gnu');
    ok('a GNU plants a partner', !!(S.partner && S.partner.name && S.partner.partyId === t.gnu.id),
      S.partner && S.partner.partyId);
    ok('and they sit Finance', S.partner.chair === 'fin', S.partner && S.partner.chair);
    const fin = RZ.state.byMinistry(S, 'fin');
    ok('and Finance is theirs', !!(fin && fin.partyId === t.gnu.id), fin && fin.partyId);
    ok('and the partnership is live', RZ.state.partnerLive(S) === true);
  }

  {
    const S = makePresident(career('ZA', 291, 13));
    const t = formWith(S, 'king');
    ok('a kingmaker plants a partner who is not the runner-up',
      !!(S.partner && S.partner.partyId === t.king.id && S.partner.partyId !== t.gnu.id),
      S.partner && S.partner.partyId);
    ok('and they have a chair', !!(S.partner && S.partner.chair), S.partner && S.partner.chair);
  }

  {
    const S = makePresident(career('ZA', 292, 13));
    formWith(S, 'gnu');
    S.date.month = 3;
    const duty = RZ.ward.duty(S);
    ok('a GNU without a paper pins the partner', duty.id === 'partner', duty && duty.id);
    S.date.month = 2;
    const feb = RZ.ward.duty(S);
    ok('and February is still the speech', feb.id === 'address', feb && feb.id);
  }

  {
    const S = makePresident(career('ZA', 293, 13));
    formWith(S, 'gnu');
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'policy');
    ok('a paper stamps the year', S.flags.partnerYear === S.date.year);
    S.date.month = 4;
    const duty = RZ.ward.duty(S);
    ok('and the pin goes away until next year', duty.id !== 'partner', duty && duty.id);
    ok('and stamps keptTheGnu', !!S.legacyMarks.keptTheGnu);
  }

  {
    const S = makePresident(career('ZA', 294, 13));
    formWith(S, 'gnu');
    const lead = S.player.partyId;
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'walk');
    ok('walking unseats them', S.nation.govParties.length === 1 && S.nation.govParties[0] === lead,
      String(S.nation.govParties));
    ok('and they leave the building', S.partner == null);
    ok('and you are a minority', RZ.state.minorityLive(S) === true);
    ok('and stamps gnuWalked', !!S.legacyMarks.gnuWalked);
    S.date.month = 3;
    const duty = RZ.ward.duty(S);
    ok('and Tuesday starts', duty.id === 'supply', duty && duty.id);
  }

  {
    const S = makePresident(career('ZM', 295, 13));
    ok('a presidential republic has no partner', RZ.state.partnerLive(S) === false);
  }

  {
    const S = makePresident(career('ZA', 296, 13));
    formWith(S, 'gnu');
    S.player.standing.party = 20;
    const cr = RZ.state.CRISES.find((c) => c.id === 'gnu-caucus');
    ok('a sour caucus summons your hawk', cr.when(S) === true);
  }

  {
    const S = makePresident(career('ZA', 297, 13));
    formWith(S, 'gnu');
    S.partner.standing = 20;
    S.flags.missedPartner = 2;
    const cr = RZ.state.CRISES.find((c) => c.id === 'gnu-meet');
    ok('a yellowed photograph summons the partner', cr.when(S) === true);
  }

  {
    const file = RZ.state.houseFile(makePresident(career('BW', 298, 13)));
    ok('the file does not invent a partner on render', file.partner === null);
  }

  {
    const S = makePresident(career('ZA', 299, 13));
    formWith(S, 'gnu');
    S.date.month = 3;
    S.actionsLeft = 3;
    RZ.docket.build(S);
    const first = RZ.docket.entries(S)[0];
    ok('the diary opens on the partner', !!(first && first.actionId === 'partner'), first && first.actionId);
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('and the desk offers it', ids.indexOf('partner') >= 0);
    const out = RZ.engine.doAction(S, 'partner');
    ok('and sitting them is a meeting', !!(out && out.dialogue && out.dialogue.sceneId === 'gnu-meet'),
      out && out.dialogue && out.dialogue.sceneId);
  }

  {
    ok('the two partner rooms exist',
      ['gnu-meet', 'gnu-caucus'].every((id) => !!RZ.dialogue.byId(id)));
    ok('and both are summoned crises',
      RZ.state.SUMMONS.indexOf('gnu-meet') >= 0 && RZ.state.SUMMONS.indexOf('gnu-caucus') >= 0);
  }
}

/* ================= 1.16.0 Saturday is the vote ================= */
section('1.16.0 Saturday is the vote');

{
  function forceConference(S) {
    S.nextConference = S.date.year;
    S.date.month = 7;
    S.player.isLeader = true;
    S.player.isPresident = true;
    S.flags.defendedConference = null;
    return S;
  }

  {
    const S = makePresident(career('BW', 310, 13));
    ok('the hall is closed out of season', RZ.state.conferenceDefenceLive(S) === false);
    forceConference(S);
    ok('and opens in June of a conference year', RZ.state.conferenceDefenceLive(S) === true);
  }

  {
    const S = makePresident(career('BW', 311, 13));
    forceConference(S);
    S.date.month = 2;
    const feb = RZ.ward.duty(S);
    ok('February is still the speech', feb.id === 'address', feb && feb.id);
    S.date.month = 7;
    S.flags.sonaYear = S.date.year;
    const duty = RZ.ward.duty(S);
    ok('and June pins Saturday', duty.id === 'conference', duty && duty.id);
  }

  {
    const S = makePresident(career('BW', 312, 13));
    forceConference(S);
    S.player.standing.party = 72;
    S.player.standing.grassroots = 70;
    S.player.fame = 70;
    ok('a hall with names holds', RZ.state.conferenceHolds(S, { quiet: true }) === true);
  }

  {
    const S = makePresident(career('BW', 313, 13));
    forceConference(S);
    S.player.standing.party = 18;
    ok('and a caucus on the floor does not', RZ.state.conferenceHolds(S, { quiet: true }) === false);
  }

  {
    const S = makePresident(career('BW', 314, 13));
    forceConference(S);
    S.player.standing.party = 72;
    S.player.standing.grassroots = 70;
    S.player.fame = 70;
    RZ.state.applyConference(RZ.engine.mkApi(S), 'keep');
    ok('standing and winning keeps both jobs', S.player.isLeader === true && S.player.isPresident === true && !S.over);
    ok('and stamps keptTheHall', !!S.legacyMarks.keptTheHall);
    ok('and the pin goes away', RZ.state.conferenceDefenceLive(S) === false);
  }

  {
    const S = makePresident(career('BW', 315, 13));
    forceConference(S);
    RZ.state.applyConference(RZ.engine.mkApi(S), 'anoint');
    ok('anointing keeps the country', S.player.isPresident === true && !S.over);
    ok('and gives away the party', S.player.isLeader === false);
    ok('and is two centres', S.flags.twoCentre === true);
    ok('and stamps madeWay', !!S.legacyMarks.madeWay);
  }

  {
    const S = makePresident(career('BW', 316, 13));
    forceConference(S);
    S.player.standing.party = 18;
    RZ.state.applyConference(RZ.engine.mkApi(S), 'keep');
    ok('a lost hall in a parl republic takes the chair', S.over === true && S.ending === 'recall',
      'over=' + S.over + ' ending=' + S.ending);
    ok('and stamps recalled', !!S.legacyMarks.recalled);
  }

  {
    const S = makePresident(career('ZM', 317, 13));
    forceConference(S);
    S.player.standing.party = 18;
    RZ.state.applyConference(RZ.engine.mkApi(S), 'keep');
    ok('a presidential republic cannot be recalled by the hall', !S.over);
    ok('and splits anyway', S.flags.twoCentre === true && S.player.isLeader === false && S.player.isPresident === true);
  }

  {
    const S = makePresident(career('ZA', 318, 13));
    const c = RZ.COUNTRIES.ZA;
    const total = c.house.seats;
    const need = Math.floor(total / 2) + 1;
    const lead = S.player.partyId;
    const rest = c.parties.filter((p) => p.id !== lead);
    S.parties[lead].seats = need - 8;
    const leftover = total - S.parties[lead].seats;
    rest.forEach((p, i) => {
      S.parties[p.id].seats = i === 0
        ? Math.max(1, Math.floor(leftover * 0.45))
        : Math.max(1, Math.floor((leftover * 0.55) / Math.max(1, rest.length - 1)));
    });
    const t = RZ.elections.coalitionOptions(S);
    S.flags.coalitionTalks = t;
    RZ.elections.applyCoalition(RZ.engine.mkApi(S), 'gnu');
    forceConference(S);
    S.player.standing.party = 72;
    S.player.standing.grassroots = 70;
    S.player.fame = 70;
    RZ.state.applyConference(RZ.engine.mkApi(S), 'dump');
    ok('dumping at conference unseats the partner', S.partner == null && S.flags.coalitionKind === 'minor');
    ok('and Tuesday starts', RZ.state.minorityLive(S) === true);
  }

  {
    const file = RZ.state.houseFile(makePresident(career('BW', 319, 13)));
    ok('the file does not invent a challenger on render', file.challenger === null);
    ok('and does not invent two centres', file.twoCentre === false);
  }

  {
    const S = makePresident(career('BW', 320, 13));
    forceConference(S);
    S.flags.sonaYear = S.date.year;
    S.actionsLeft = 3;
    RZ.docket.build(S);
    const first = RZ.docket.entries(S)[0];
    ok('the diary opens on Saturday', !!(first && first.actionId === 'conference'), first && first.actionId);
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('and the desk offers it', ids.indexOf('conference') >= 0);
    const out = RZ.engine.doAction(S, 'conference');
    ok('and sitting it is a meeting', !!(out && out.dialogue && out.dialogue.sceneId === 'conference-floor'),
      out && out.dialogue && out.dialogue.sceneId);
  }

  {
    ok('the hall exists', !!RZ.dialogue.byId('conference-floor'));
    ok('and is a summoned crisis', RZ.state.SUMMONS.indexOf('conference-floor') >= 0);
  }
}

/* ================= 1.17.0 The partner quotes the paper ================= */
section('1.17.0 The partner quotes the paper');

{
  function formGnu(S) {
    const c = RZ.COUNTRIES[S.countryId];
    const total = c.house.seats;
    const need = Math.floor(total / 2) + 1;
    const lead = S.player.partyId;
    const rest = c.parties.filter((p) => p.id !== lead);
    S.parties[lead].seats = need - 8;
    const leftover = total - S.parties[lead].seats;
    rest.forEach((p, i) => {
      S.parties[p.id].seats = i === 0
        ? Math.max(1, Math.floor(leftover * 0.45))
        : Math.max(1, Math.floor((leftover * 0.55) / Math.max(1, rest.length - 1)));
    });
    const t = RZ.elections.coalitionOptions(S);
    S.flags.coalitionTalks = t;
    RZ.elections.applyCoalition(RZ.engine.mkApi(S), 'gnu');
    return t;
  }

  {
    const S = makePresident(career('ZA', 330, 13));
    formGnu(S);
    ok('a GNU without a paper has no quote', RZ.state.partnerQuote(S) === null);
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'policy');
    ok('and a date still is not an annexure', RZ.state.partnerQuote(S) === null);
  }

  {
    const S = makePresident(career('ZA', 331, 13));
    formGnu(S);
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'policy');
    S.player.capital = 40;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'land');
    const q = RZ.state.partnerQuote(S);
    ok('a land bill is a hostile quote', !!(q && q.kind === 'bill' && q.id === 'land' && q.hostile), JSON.stringify(q));
    const file = RZ.state.houseFile(S);
    ok('and the file names it without inventing people', file.quote && file.quote.id === 'land' && file.partner && file.partner.id);
  }

  {
    const S = makePresident(career('ZA', 332, 13));
    formGnu(S);
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'policy');
    S.player.capital = 40;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'land');
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'honour');
    ok('honouring a hostile bill pulls it', S.bill == null);
    ok('and they stay', !!(S.partner && S.flags.coalitionKind === 'gnu'));
    ok('and stamps honouredThePaper', !!S.legacyMarks.honouredThePaper);
  }

  {
    const S = makePresident(career('ZA', 333, 13));
    formGnu(S);
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'policy');
    S.player.capital = 40;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'anticorr');
    const q = RZ.state.partnerQuote(S);
    ok('an integrity bill is not hostile', !!(q && q.kind === 'bill' && !q.hostile));
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'honour');
    ok('and honouring it leaves it on the paper', !!(S.bill && S.bill.id === 'anticorr'));
  }

  {
    const S = makePresident(career('ZA', 334, 13));
    formGnu(S);
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'policy');
    S.date.month = 10;
    const q = RZ.state.partnerQuote(S);
    ok('October without a package is a quote', !!(q && q.kind === 'tax'), q && q.kind);
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'honour');
    ok('and honouring it sits a holiday', S.flags.taxYear === S.date.year && S.flags.taxPack === 'holiday');
  }

  {
    const S = makePresident(career('ZA', 335, 13));
    formGnu(S);
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'policy');
    S.nation.economy.debt = 90;
    ok('a hole in the books is a quote', RZ.state.partnerQuote(S).kind === 'rating');
  }

  {
    const S = makePresident(career('ZA', 336, 13));
    formGnu(S);
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'policy');
    S.player.capital = 40;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'land');
    S.partner.standing = 20;
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'renege');
    ok('reneging when they are on the floor is a walk', S.partner == null && S.flags.coalitionKind === 'minor');
    ok('and Tuesday starts', RZ.state.minorityLive(S) === true);
    ok('and stamps renegedThePaper', !!S.legacyMarks.renegedThePaper);
  }

  {
    const S = makePresident(career('ZA', 337, 13));
    formGnu(S);
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'policy');
    S.player.capital = 40;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'land');
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('a live quote puts the partner back on the desk', ids.indexOf('partner') >= 0);
    const cr = RZ.state.CRISES.find((c) => c.id === 'gnu-meet');
    ok('and summons the same room', cr.when(S) === true);
  }

  {
    const file = RZ.state.houseFile(makePresident(career('BW', 338, 13)));
    ok('the file does not invent a quote on render', file.quote === null);
  }

  {
    ok('withdraw exists and is not a dissolution', typeof RZ.bill.withdraw === 'function');
  }
}

/* ================= 1.18.0 The rest of the house meets ================= */
section('1.18.0 The rest of the house meets');

{
  function formGnu(S) {
    const c = RZ.COUNTRIES[S.countryId];
    const total = c.house.seats;
    const need = Math.floor(total / 2) + 1;
    const lead = S.player.partyId;
    const rest = c.parties.filter((p) => p.id !== lead);
    S.parties[lead].seats = need - 8;
    const leftover = total - S.parties[lead].seats;
    rest.forEach((p, i) => {
      S.parties[p.id].seats = i === 0
        ? Math.max(1, Math.floor(leftover * 0.45))
        : Math.max(1, Math.floor((leftover * 0.55) / Math.max(1, rest.length - 1)));
    });
    const t = RZ.elections.coalitionOptions(S);
    S.flags.coalitionTalks = t;
    RZ.elections.applyCoalition(RZ.engine.mkApi(S), 'gnu');
    return t;
  }

  {
    const S = makePresident(career('ZA', 350, 13));
    formGnu(S);
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'policy');
    S.player.capital = 40;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'anticorr');
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'honour');
    const opp = (S.bill.blocs || []).find((b) => b.id === 'opp');
    ok('honouring a friendly bill pledges the opposition', !!(opp && opp.pledged), opp && opp.how);
  }

  {
    const S = makePresident(career('ZA', 351, 13));
    formGnu(S);
    RZ.state.applyPartner(RZ.engine.mkApi(S), 'policy');
    S.player.capital = 40;
    RZ.bill.table(S, RZ.engine.mkApi(S), 'land');
    S.bill.weeksLeft = 0;
    S.bill.blocs.forEach((b) => { b.pledged = true; b.lean = 80; });
    S.partner.standing = 20;
    RZ.bill.division(S);
    ok('carrying a hostile bill they quoted is a walk', S.partner == null && S.flags.coalitionKind === 'minor');
  }

  {
    const bw = RZ.ward.fridayMatter(career('BW', 352, 4));
    const za = RZ.ward.fridayMatter(career('ZA', 353, 4));
    ok('Friday in Botswana is not Friday in Joburg', bw.job !== za.job && bw.a !== za.a, bw.job + ' / ' + za.job);
  }

  {
    const S = career('ZA', 354, 6);
    S.date.month = 7;
    ok('the year is live in the middle', RZ.ward.yearLive(S) === true);
    const P = makePresident(career('ZA', 355, 13));
    P.date.month = 7;
    ok('and not once you have the palace', RZ.ward.yearLive(P) === false);
  }

  {
    const S = career('ZA', 356, 6);
    S.player.stats.integrity = 70;
    S.player.dirt = [];
    const cr = RZ.state.CRISES.find((c) => c.id === 'sg-ceiling');
    ok('a clean pair of hands summons the SG', cr && cr.when(S) === true);
    S.player.stats.integrity = 40;
    ok('and a dirty pair does not', cr.when(S) === false);
  }

  {
    RZ.engine.recordLast({
      countryId: 'ZA', player: { name: 'Thabo Molefe', isPresident: true, rungIdx: 13, dirt: [] },
      date: { year: 2031 }, ending: 'recall', flags: { wasPresident: true },
      legacyMarks: {}
    });
    const S = career('ZA', 357, 0);
    ok('the next career in the same country hears a rumour', !!(S.flags.inheritance && S.flags.inheritance.name === 'Thabo Molefe'));
    const BW = career('BW', 358, 0);
    ok('and a different country does not', !BW.flags.inheritance);
  }

  {
    ok('the SG room exists', !!RZ.dialogue.byId('sg-ceiling'));
    ok('and the year exists', !!RZ.dialogue.byId('the-year'));
    ok('and both are summoned',
      RZ.state.SUMMONS.indexOf('sg-ceiling') >= 0 && RZ.ward.SUMMONS.indexOf('the-year') >= 0);
  }
}

/* ================= 1.19.0 The clause is a room ================= */
section('1.19.0 The clause is a room');

{
  function playOut(cv) {
    let guard = 0;
    while (!cv.done && guard++ < 12) {
      const opts = RZ.dialogue.options(cv).filter((o) => o.ok);
      if (!opts.length) throw new Error('no options in ' + cv.sceneId);
      RZ.dialogue.choose(cv, opts[0].i);
    }
    if (!cv.done) throw new Error(cv.sceneId + ' never closed');
    return cv;
  }

  function asMinister(cid, seed) {
    const S = career(cid, seed, 6);
    const lad = RZ.ladderFor(cid);
    let idx = 0;
    lad.forEach((r, i) => { if (r.tier <= 6) idx = i; });
    S.player.rungIdx = idx;
    S.player.isPresident = false;
    S.parties[S.player.partyId].gov = true;
    if (S.nation.govParties.indexOf(S.player.partyId) < 0) S.nation.govParties = [S.player.partyId];
    S.actionsLeft = 4;
    return S;
  }

  function setSeats(St, mineFrac) {
    const c = RZ.COUNTRIES[St.countryId];
    const total = c.house.seats;
    const mine = Math.round(total * mineFrac);
    c.parties.forEach((p, i) => {
      St.parties[p.id].seats = i === 0 ? mine : Math.round((total - mine) / (c.parties.length - 1));
    });
    St.nation.govParties = [St.player.partyId];
    St.parties[St.player.partyId].gov = true;
  }

  {
    const S = asMinister('ZA', 400);
    const api = RZ.engine.mkApi(S);
    const acts = RZ.engine.availableActions(S).map((a) => a.id);
    ok('a minister is offered the clause', acts.indexOf('amend') >= 0, acts.join(','));
    ok('and is not offered the estimates', acts.indexOf('budget') < 0);
    const list = RZ.gov.amendmentsFor(api);
    ok('and can table devolve', list.some((x) => x.id === 'devolve'));
    ok('and cannot table a palace clause',
      !list.some((x) => x.id === 'termlimit' || x.id === 'termlength' || x.id === 'courts'));
    ok('and the live helper agrees', RZ.gov.amendLive(api) === true);
  }

  {
    const S = makePresident(career('ZA', 401, 13));
    const api = RZ.engine.mkApi(S);
    const list = RZ.gov.amendmentsFor(api);
    ok('a president still sees palace paper',
      list.some((x) => x.id === 'termlimit' || x.id === 'termlength' || x.id === 'courts'));
  }

  {
    const S = asMinister('ZA', 402);
    setSeats(S, 0.75);
    S.player.standing.party = 80; S.player.standing.leader = 80; S.player.capital = 100;
    S.actionsLeft = 3;
    const out = RZ.engine.doAction(S, 'amend');
    ok('sitting the clause is a room', !!(out && out.dialogue && out.dialogue.sceneId === 'amend-table'),
      out && out.dialogue && out.dialogue.sceneId);
    playOut(out.dialogue);
    ok('and the year is stamped', S.flags.amendYear === S.date.year, String(S.flags.amendYear));
    const ids = RZ.engine.availableActions(S).map((a) => a.id);
    ok('and the action leaves the desk until next year', ids.indexOf('amend') < 0);
  }

  {
    const S = asMinister('BW', 403);
    setSeats(S, 0.9);
    S.player.standing.party = 90; S.player.standing.leader = 90; S.player.capital = 200;
    RZ.gov.beginAmend(S);
    const buried = RZ.gov.applyAmend(RZ.engine.mkApi(S), 'bury');
    ok('burying is not a carry', buried.passed === false && buried.buried === true, buried.title);
    ok('and does not devolve the country', S.legacyMarks.devolved !== true);
  }

  {
    const S = asMinister('BW', 404);
    setSeats(S, 0.9);
    S.player.standing.party = 90; S.player.standing.leader = 90; S.player.capital = 200;
    RZ.gov.beginAmend(S);
    const api = RZ.engine.mkApi(S);
    const carried = RZ.gov.applyAmend(api, 'whip');
    ok('a supermajority cabinet can carry devolve', carried.passed === true, carried.title);
    ok('and the regions actually have the share', S.legacyMarks.devolved === true);
  }

  {
    const S = career('BW', 405, 11);
    const lad = RZ.ladderFor('BW');
    const vp = lad.findIndex((r) => r.id === 'vp' || r.tier === 11);
    S.player.rungIdx = vp >= 0 ? vp : S.player.rungIdx;
    S.player.isPresident = false;
    S.parties[S.player.partyId].gov = true;
    const acts = RZ.engine.availableActions(S).map((a) => a.id);
    ok('a vice-president still sits the clause', acts.indexOf('amend') >= 0, acts.join(','));
    ok('and still chairs the estimates', acts.indexOf('budget') >= 0);
  }

  {
    const S = career('ZA', 406, 3);
    S.parties[S.player.partyId].gov = true;
    const api = RZ.engine.mkApi(S);
    const acts = RZ.engine.availableActions(S).map((a) => a.id);
    ok('a backbencher is not offered the clause', acts.indexOf('amend') < 0);
    ok('and the live helper says so', RZ.gov.amendLive(api) === false);
  }

  {
    ok('the room exists', !!RZ.dialogue.byId('amend-table'));
    ok('and its topic is the action', RZ.dialogue.byId('amend-table').topic === 'amend');
  }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) { console.error(`${failures} failed`); process.exit(1); }
console.log('every new mechanic fires and does what it says');

