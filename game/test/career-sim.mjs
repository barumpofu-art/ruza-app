/* Plays whole careers, headlessly, in every country.

   The dialogue sim proves the scenes are well formed. This proves the game
   underneath them survives forty years of being played: actions, meetings,
   events, contests, appointments, elections, the presidency and the obituary,
   in a country whose economy and rivals are moving the whole time.

   It plays a fixed set of seeds so a failure is reproducible, asserts hard
   invariants after every single turn, and prints where the careers ended so a
   balance change is visible as a change in the distribution.

   Run: node game/test/career-sim.mjs [--careers N] [--verbose]
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'core.js', 'data-countries.js', 'data-ladder.js', 'data-actions.js',
  'data-events.js', 'data-dialogue.js', 'data-origins.js', 'people.js', 'field.js', 'elections.js',
  'engine.js', 'governance.js', 'dialogue.js', 'crisis.js', 'sprint.js', 'revolt.js',
  'constituency.js', 'statecraft.js', 'legislation.js', 'contender.js', 'blocs.js', 'cast.js'
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
  return sandbox;
}

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const CAREERS = Number(args[args.indexOf('--careers') + 1]) || 3;
// "drift" takes whatever is on the desk; "climb" plays to reach the top. The
// two together bracket the game: if drift reaches State House the ladder is
// too soft, and if climb never does it is impossible.
const STRATEGIES = args.includes('--strategy')
  ? [args[args.indexOf('--strategy') + 1]]
  : ['drift', 'climb'];

const g = loadGame();
const RZ = g.RZ;

let failures = 0;
const seenFail = new Set();
function fail(where, msg) {
  failures++;
  const key = `${where}|${msg}`;
  if (seenFail.has(key)) return;
  seenFail.add(key);
  console.error(`  ✗ ${where}: ${msg}`);
}

/* ------------------------------------------------------------------
   Invariants. Anything here being false is a bug, in any country, at
   any point in any career.
   ------------------------------------------------------------------ */
function finite(where, label, v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(where, `${label} is ${v}`);
}

function checkState(where, S) {
  const c = RZ.COUNTRIES[S.countryId];
  const lad = RZ.ladderFor(c.id);
  const P = S.player;

  if (!(P.rungIdx >= 0 && P.rungIdx < lad.length)) fail(where, `rungIdx ${P.rungIdx} off the ladder`);
  finite(where, 'money', P.money);
  finite(where, 'health', P.health);
  finite(where, 'fame', P.fame);
  finite(where, 'capital', P.capital);
  for (const k of Object.keys(P.stats)) {
    finite(where, `stats.${k}`, P.stats[k]);
    if (P.stats[k] < 0 || P.stats[k] > 100) fail(where, `stats.${k} = ${P.stats[k]} out of 0..100`);
  }
  for (const k of Object.keys(P.standing)) {
    finite(where, `standing.${k}`, P.standing[k]);
    if (P.standing[k] < 0 || P.standing[k] > 100) fail(where, `standing.${k} = ${P.standing[k]} out of 0..100`);
  }
  const e = S.nation.economy;
  for (const k of Object.keys(e)) finite(where, `economy.${k}`, e[k]);
  for (const k of Object.keys(S.nation.society)) finite(where, `society.${k}`, S.nation.society[k]);
  finite(where, 'govApproval', S.nation.govApproval);

  if (!c.partyById[P.partyId]) fail(where, `player party ${P.partyId} is not in ${c.id}`);
  for (const p of c.parties) {
    finite(where, `${p.id}.vote`, S.parties[p.id].vote);
    finite(where, `${p.id}.seats`, S.parties[p.id].seats);
  }

  // ---- the field ----
  const ids = new Set();
  for (const f of S.field || []) {
    if (ids.has(f.id)) fail(where, `duplicate field id ${f.id}`);
    ids.add(f.id);
    if (!(f.rungIdx >= 0 && f.rungIdx < lad.length)) fail(where, `${f.name} sits at rung ${f.rungIdx}`);
    finite(where, `${f.name}.power`, f.power);
    if (!f.name || !f.role) fail(where, `a field figure has no name or role`);
  }
  const li = RZ.field.leaderIdx(S);
  const seated = RZ.field.at(S, li);
  if (P.isLeader && seated.length) fail(where, `you lead the party but ${seated[0].name} also holds the leadership`);
  if (!P.isLeader && seated.length > 1) fail(where, `${seated.length} people hold the party leadership at once`);
  const st = S.parties[P.partyId];
  if (!st.leaderName) fail(where, 'the party has no leader named');
  if (P.isLeader && st.leaderName !== P.name) fail(where, 'you lead the party but it is named for somebody else');
  if (!S.nation.presidentName) fail(where, 'the country has no head of state named');

  // A save has to survive the round trip or a career dies on the train.
  const raw = JSON.stringify(S);
  if (raw.includes('undefined')) fail(where, 'the save serialises an undefined');
}

function checkEntry(where, entry) {
  if (!entry) return;
  if (!entry.title) fail(where, 'a feed entry has no title');
  if (entry.body === undefined || entry.body === null) fail(where, `"${entry.title}" has no body`);
  if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(String(entry.title) + String(entry.body))) {
    fail(where, `"${entry.title}" renders undefined/NaN: ${String(entry.body).slice(0, 140)}`);
  }
}

/* ------------------------------------------------------------------
   A player. Not a good one — the point is coverage, not skill — but
   one that contests when it can and answers every question put to it.
   ------------------------------------------------------------------ */
/* A player who is actually trying. It reads what the next rung wants and
   spends the month buying it, rests when the body starts to go, and courts
   whoever can appoint it. Nothing clever — just not random. */
const BUYS = {
  grassroots: ['walkabout', 'funerals', 'church', 'youth', 'union', 'radio', 'campaign'],
  party: ['courtleader', 'factions', 'delegates', 'lobbyList', 'parliament', 'policy'],
  leader: ['courtleader', 'lobbyList', 'parliament', 'policy', 'securocrats'],
  fame: ['media', 'social', 'radio', 'book', 'policy'],
  media: ['media', 'social', 'radio'],
  business: ['fundraise', 'patron', 'tender'],
  security: ['securocrats'],
  intl: ['donors', 'diaspora']
};

function climbPick(S, avail) {
  const P = S.player;
  const have = new Set(avail.map((a) => a.id));
  const pickFrom = (ids) => {
    const hits = avail.filter((a) => ids.indexOf(a.id) >= 0);
    return hits.length ? RZ.pick(hits) : null;
  };

  // The body first: a career that ends at 58 reaches nothing.
  if (P.health < 55 && have.has('rest')) return avail.filter((a) => a.id === 'rest')[0];
  // Then the money, because standing costs money to hold.
  if (P.money < 0 && (have.has('fundraise') || have.has('patron'))) {
    const m = pickFrom(['fundraise', 'patron']);
    if (m) return m;
  }
  // Then whatever the next rung is short of.
  const st = RZ.engine.contestStatus(S);
  if (st.req && st.req.missing.length) {
    const worst = st.req.missing.slice().sort((a, b) => (b.need - b.have) - (a.need - a.have))[0];
    const m = pickFrom(BUYS[worst.k] || []);
    if (m) return m;
  }
  // Requirements met but the rung is in somebody's gift: be the obvious choice.
  if (st.rung && st.rung.how === 'appoint') {
    const m = pickFrom(BUYS.leader.concat(BUYS.fame));
    if (m) return m;
  }
  if (S.campaign.season && have.has('campaign')) return avail.filter((a) => a.id === 'campaign')[0];
  return RZ.pick(avail);
}

const shares = [];

function playCareer(countryId, seed, strategy) {
  const c = RZ.COUNTRIES[countryId];
  RZ.seed(seed);
  const region = RZ.pick(c.regions);
  const party = RZ.pick(c.parties);
  const bg = RZ.pick(RZ.BACKGROUNDS);
  const S = RZ.engine.newGame({
    countryId, name: RZ.makeName(c), gender: 'f',
    regionId: region.id, bgId: bg.id, partyId: party.id, age: 34, seed
  });
  const where = `${countryId}/${seed}`;
  checkState(`${where} @start`, S);

  const stats = { turns: 0, actions: 0, meetings: 0, events: 0, eventRooms: 0, contests: 0, wins: 0,
                  elections: 0, appointments: 0, beatenBy: 0, budgets: 0 };

  for (let turn = 0; turn < 600 && !S.over; turn++) {
    stats.turns++;
    const at = `${where} y${S.date.year}m${S.date.month}`;

    // ---- spend the month ----
    let guard = 0;
    while (S.actionsLeft > 0 && guard++ < 12) {
      const avail = RZ.engine.availableActions(S);
      if (!avail.length) break;
      const pickAct = strategy === 'climb' ? climbPick(S, avail) : RZ.pick(avail);
      if (pickAct.id === 'budget') {
        // the budget screen hands back a set of lines; approximate it
        const b = {};
        RZ.gov.BUDGET_LINES.forEach((l) => { b[l.k] = S.nation.budget[l.k]; });
        RZ.gov.applyBudget(S, b);
        S.actionsLeft--;
        stats.budgets++;
        continue;
      }
      const out = RZ.engine.doAction(S, pickAct.id);
      if (!out) break;
      if (out.fail) continue;
      // Some actions are a question before they are an outcome: the app asks
      // which ward, which bloc, which clause, and only then resolves. Answer
      // them the way the app would rather than counting a missing entry as a
      // fault.
      if (out.special) {
        stats.actions++;
        const api = RZ.engine.mkApi(S);
        if (out.special === 'blitz' || out.special === 'surge') {
          const wards = (S.sprint && S.sprint.wards) || [];
          if (wards.length) {
            const w = RZ.pick(wards);
            if (out.special === 'surge') RZ.sprint.surge(S, w.id, api);
            else RZ.sprint.blitz(S, w.id, api);
          }
        } else if (out.special === 'draft') {
          RZ.bill.table(S, api, RZ.pick(RZ.bill.BILLS).id);
        } else if (out.special === 'bloc' || out.special === 'concede') {
          const open = ((S.bill && S.bill.blocs) || []).filter((x) => !x.pledged);
          if (open.length) {
            const b = RZ.pick(open);
            if (out.special === 'concede') RZ.bill.concede(S, api, b.id);
            else RZ.bill.workBloc(S, api, b.id, api.hasLeverage() && RZ.chance(0.2) ? 'extort' : 'capital');
          }
        }
        S.actionsLeft--;
        S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
        checkState(`${at} after ${pickAct.id}`, S);
        continue;
      }
      if (out.dialogue) {
        stats.meetings++;
        const convo = out.dialogue;
        let beats = 0;
        while (!convo.done && beats++ < 12) {
          const opts = RZ.dialogue.options(convo).filter((o) => o.ok);
          if (!opts.length) { fail(at, `no answerable option in scene ${convo.sceneId}`); break; }
          RZ.dialogue.choose(convo, RZ.pick(opts).i);
        }
        if (!convo.done) fail(at, `scene ${convo.sceneId} never closed`);
        checkEntry(at, RZ.engine.finishDialogue(S, convo));
      } else {
        stats.actions++;
        checkEntry(at, out.entry);
      }
      checkState(`${at} after ${pickAct.id}`, S);
    }

    // ---- contest whatever is contestable ----
    const cs = RZ.engine.contestStatus(S);
    if (cs.available && (strategy === 'climb' || RZ.chance(0.85))) {
      // What the whip count said before committing. The distribution of this
      // across many careers is the real measure of whether a contest is a
      // decision or a formality.
      if (cs.count) shares.push(cs.count.share);
      const r = RZ.engine.contest(S);
      if (r) {
        stats.contests++;
        if (r.won) stats.wins++;
        if (r.beatenBy) stats.beatenBy++;
        if (r.against && (!r.against.name || !r.against.role)) fail(at, 'a contest named an opponent with no name or role');
        checkState(`${at} after contest`, S);
      }
    }

    // ---- the month turns ----
    const out = RZ.engine.endTurn(S);
    checkState(`${at} after endTurn`, S);
    if (S.over) break;
    if (out.promo && out.promo.promoted) stats.appointments++;

    if (out.election) {
      stats.elections++;
      const rig = RZ.gov.canRig(S) && RZ.chance(0.25) ? RZ.range(1, 3) : 0;
      const r = RZ.gov.runElection(S, { rig });
      if (!r || !r.seats) fail(at, 'an election returned no seats');
      const total = RZ.sum(c.parties, (p) => r.seats[p.id] || 0);
      if (total <= 0) fail(at, `election allocated ${total} seats`);
      if (r.personal) r.personal.messages.forEach((m) => {
        if (/undefined|NaN/.test(m)) fail(at, `election message reads "${m}"`);
      });
      checkState(`${at} after election`, S);
      if (S.over) break;
    }

    if (S.pendingEvent) {
      stats.events++;
      const ev = S.pendingEvent;
      if (ev.talk) {
        // A situation that is a room. Half the time, walk out of the app
        // mid-answer and come back, because an event must survive that.
        stats.eventRooms++;
        let convo = RZ.dialogue.beginEvent(S, { beat: ev.talkBeat, mood: ev.talkMood });
        if (!convo) { fail(at, `event ${ev.id} says it is a room and has no beats`); }
        else {
          let beats = 0, interrupted = false;
          while (!convo.done && beats++ < 12) {
            const opts = RZ.dialogue.options(convo).filter((o) => o.ok);
            if (!opts.length) { fail(at, `event ${ev.id} beat ${convo.beat} has no answerable option`); break; }
            RZ.dialogue.choose(convo, RZ.pick(opts).i);
            if (!convo.done && !interrupted && RZ.chance(0.35)) {
              // reopened from the save, exactly as the app would
              interrupted = true;
              const held = S.pendingEvent;
              if (!held || held.id !== ev.id) { fail(at, `event ${ev.id} lost its place mid-room`); break; }
              const again = RZ.dialogue.beginEvent(S, { beat: held.talkBeat, mood: held.talkMood });
              if (!again) { fail(at, `event ${ev.id} could not be resumed`); break; }
              if (again.beat !== convo.beat) fail(at, `event ${ev.id} resumed at beat ${again.beat}, not ${convo.beat}`);
              convo = again;
            }
          }
          if (!convo.done) fail(at, `event room ${ev.id} never closed`);
          else {
            checkEntry(at, RZ.engine.finishEventDialogue(S, convo));
            if (S.pendingEvent) fail(at, `event ${ev.id} is still pending after its room closed`);
          }
        }
      } else {
        if (!ev.choices.length) fail(at, `event ${ev.id} offers no choices`);
        const ok = ev.choices.filter((ch) => ch.ok);
        if (!ok.length) fail(at, `event ${ev.id} offers no allowed choice`);
        checkEntry(at, RZ.engine.resolveEvent(S, RZ.pick(ok).i));
      }
      checkState(`${at} after event ${ev.id}`, S);
    }
  }

  // ---- how it is remembered ----
  if (!S.over) RZ.engine.endGame(S, 'retire');
  const lg = RZ.gov.legacy(S);
  if (!lg || typeof lg.score !== 'number' || !Number.isFinite(lg.score)) fail(where, `legacy score is ${lg && lg.score}`);
  const ob = RZ.gov.obituary(S, lg);
  if (typeof ob !== 'string' || ob.length < 40) fail(where, `the obituary is ${JSON.stringify(ob).slice(0, 80)}`);
  if (/undefined|NaN|\[object Object\]/.test(String(ob))) {
    fail(where, `the obituary reads: ${String(ob).slice(0, 200)}`);
  }

  const lad = RZ.ladderFor(countryId);
  return { stats, ending: S.ending, reached: lad[S.player.rungIdx].title, tier: lad[S.player.rungIdx].tier,
           years: S.date.year - c.startYear, score: Math.round(lg.score) };
}

/* ------------------------------------------------------------------
   Balance: how hard is a contest for somebody who has only just become
   eligible for it?

   This is the number that decides whether the ladder is a decision or a
   formality, and it is not the same as the win rate the careers above
   report — those players grind every month with nothing else to do, so
   they arrive at a contest far past the bar. This sets up a player who has
   exactly what the rung asks for and no more, and asks what share of the
   room they would take. Somewhere near half is the target: qualifying gets
   you into the contest, it does not win it.
   ------------------------------------------------------------------ */
function marginalContests() {
  const rows = [];
  for (const cid of Object.keys(RZ.COUNTRIES)) {
    const c = RZ.COUNTRIES[cid];
    for (let seed = 0; seed < 5; seed++) {
      RZ.seed(4000 + seed * 131);
      const S = RZ.engine.newGame({
        countryId: cid, name: 'Marginal', gender: 'f',
        regionId: RZ.pick(c.regions).id, bgId: RZ.pick(RZ.BACKGROUNDS).id,
        partyId: c.parties[0].id, age: 34, seed: 4000 + seed * 131
      });
      const L = RZ.ladderFor(cid);
      for (let idx = 1; idx < L.length; idx++) {
        const rung = L[idx];
        if (!['internal', 'public', 'conference'].includes(rung.how)) continue;
        S.player.rungIdx = idx - 1;
        const req = rung.req || {};
        // exactly the bar, nothing above it
        S.player.standing.grassroots = Math.max(S.player.standing.grassroots, req.grassroots || 0);
        S.player.standing.party = Math.max(S.player.standing.party, req.party || 0);
        S.player.fame = Math.max(S.player.fame, req.fame || 0);
        S.player.regionSupport[S.player.regionId] = Math.min(100, 24 + idx * 4);
        RZ.field.syncLeadership(S);
        const con = RZ.field.contender(S, idx);
        const r = rung.how === 'conference'
          ? RZ.elections.conferenceVote(S, con, { noNoise: true })
          : RZ.elections.primaryContest(S, con, { noNoise: true });
        if (!Number.isFinite(r.pct)) fail(`${cid} rung ${rung.id}`, `marginal share is ${r.pct}`);
        rows.push({ tier: rung.tier, how: rung.how, share: r.pct });
      }
    }
  }
  return rows;
}

const marginal = marginalContests();
{
  const sorted = marginal.map((r) => r.share).sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  console.log(`marginal contests (a player who has only just qualified): median share ${med.toFixed(1)}%`);
  const byHow = {};
  for (const r of marginal) (byHow[r.how] ||= []).push(r.share);
  for (const how of Object.keys(byHow).sort()) {
    const g = byHow[how].sort((a, b) => a - b);
    console.log(`  ${how.padEnd(11)} median ${g[Math.floor(g.length / 2)].toFixed(1)}%  (n=${g.length})`);
  }
  // Qualifying must neither win the contest nor be hopeless. If a change
  // pushes this out of range the ladder has stopped being a decision, and
  // that is worth failing over rather than discovering months later.
  if (med > 55) fail('balance', `qualifying all but wins the contest (median ${med.toFixed(1)}%) — the ladder is a formality`);
  if (med < 32) fail('balance', `qualifying leaves you hopeless (median ${med.toFixed(1)}%) — the requirements and the contest are both walls`);
  console.log('');
}

const ids = Object.keys(RZ.COUNTRIES);
console.log(`playing ${CAREERS} careers in each of ${ids.length} countries, as ${STRATEGIES.join(' and ')}\n`);

const totals = { turns: 0, actions: 0, meetings: 0, events: 0, eventRooms: 0, contests: 0, wins: 0,
                 elections: 0, appointments: 0, beatenBy: 0, budgets: 0 };
const endings = {};
const ceilings = {};

for (const strategy of STRATEGIES) {
  console.log(`— ${strategy} —`);
  for (const id of ids) {
    const rows = [];
    for (let k = 0; k < CAREERS; k++) {
      const r = playCareer(id, 1000 + k * 7717, strategy);
      rows.push(r);
      for (const key of Object.keys(totals)) totals[key] += r.stats[key];
      endings[r.ending] = (endings[r.ending] || 0) + 1;
      const bucket = `${strategy}:${r.tier}`;
      ceilings[bucket] = (ceilings[bucket] || 0) + 1;
    }
    const best = rows.reduce((a, b) => (b.tier > a.tier ? b : a));
    console.log(
      `  ${RZ.COUNTRIES[id].flag} ${id}  best: ${best.reached} (${best.years}y, ${best.ending}, legacy ${best.score})` +
      (VERBOSE ? '\n' + rows.map((r) => `        ${r.reached} — ${r.ending}, ${r.years}y`).join('\n') : '')
    );
  }
  console.log('');
}

console.log(`\n  ${totals.turns} months played, ${totals.actions} actions, ${totals.meetings} meetings,`);
console.log(`  ${totals.events} events (${totals.eventRooms} of them rooms), ${totals.contests} contests (${totals.wins} won, ${totals.beatenBy} lost to a named rival),`);
console.log(`  ${totals.elections} general elections, ${totals.appointments} appointments, ${totals.budgets} budgets.`);
if (shares.length) {
  const sorted = shares.slice().sort((a, b) => a - b);
  const at = (q) => sorted[Math.floor(sorted.length * q)].toFixed(0);
  const tight = shares.filter((v) => v >= 40 && v <= 60).length / shares.length * 100;
  console.log(`  whip count when contesting: median ${at(0.5)}%, ` +
    `quartiles ${at(0.25)}%-${at(0.75)}%; ${tight.toFixed(0)}% entered within 40-60%.`);
}
console.log('  endings: ' + Object.entries(endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
for (const strategy of STRATEGIES) {
  const rows = Object.keys(ceilings).filter((k) => k.startsWith(strategy + ':'))
    .sort((a, b) => Number(a.split(':')[1]) - Number(b.split(':')[1]));
  console.log(`  ${strategy} ceilings: ` + rows.map((k) => `t${k.split(':')[1]}:${ceilings[k]}`).join(' '));
}

if (failures) {
  console.error(`\n${failures} problem${failures === 1 ? '' : 's'} across the careers played`);
  process.exit(1);
}
console.log('\nevery career held up');
