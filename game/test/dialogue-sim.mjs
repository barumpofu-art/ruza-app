/* Walks every branch of every conversation.

   A scene is data, and data that is only ever exercised by a player tapping
   through it on a phone is data that breaks quietly. This loads the game
   headlessly and plays every answer of every beat of every scene, in a
   handful of different careers, asserting that the exchange is well formed
   and that nothing throws.

   Run: node game/test/dialogue-sim.mjs
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
    const src = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    vm.runInContext(src, sandbox, { filename: `js/${f}` });
  }
  return sandbox;
}

let failures = 0;
function fail(where, msg) {
  failures++;
  console.error(`  ✗ ${where}: ${msg}`);
}

const g = loadGame();
const RZ = g.RZ;

console.log(`loaded ${RZ.DIALOGUE.length} scenes across ${new Set(RZ.DIALOGUE.map(s => s.topic)).size} topics` +
  ` (${RZ.DIALOGUE.filter((s) => s.topic === 'crisis').length} of them summoned rather than chosen)`);

// A topic names an action on the monthly desk, a presidential one, or one of
// the weekly decks that replace the desk during a campaign or a bill.
function actionFor(topic) {
  return RZ.actionById[topic] || RZ.gov.actionById(topic) ||
         (RZ.sprint && RZ.sprint.weekActionById(topic)) ||
         (RZ.bill && RZ.bill.weekActionById(topic)) || null;
}

/* ---- every scene id is unique, and every topic names a real action ---- */
const seen = new Set();
for (const sc of RZ.DIALOGUE) {
  if (seen.has(sc.id)) fail(sc.id, 'duplicate scene id');
  seen.add(sc.id);
  // A scene is reachable either because an action opens it, or because a
  // crisis trigger sends somebody to find you. Anything else is unreachable
  // content, which is the failure this check exists to catch.
  if (sc.topic === 'crisis') {
    const summoned = (RZ.state?.CRISES || []).some((cr) => cr.scene === sc.id) ||
                     (RZ.bill?.VISITS || []).some((v) => v.id === sc.id) ||
                     (RZ.contender?.SUMMONS || []).includes(sc.id) ||
                     (RZ.blocs?.SUMMONS || []).includes(sc.id);
    if (!summoned) fail(sc.id, 'a crisis scene that no trigger ever summons');
  } else if (!actionFor(sc.topic)) {
    fail(sc.id, `topic "${sc.topic}" is not an action id`);
  }
  // A meeting is a conversation, not a single question with a lid on it.
  if (!Array.isArray(sc.beats) || sc.beats.length < 2) fail(sc.id, 'fewer than two questions');
  // Everybody a scene refers to has to actually be standing in the room.
  const cast = new Set(['_', ...Object.keys(sc.others || {})]);
  if (sc.others) {
    if (Object.keys(sc.others).length < 2) fail(sc.id, 'a room with `others` needs at least two of them to argue');
    for (const [k, fn] of Object.entries(sc.others)) {
      if (typeof fn !== 'function') fail(sc.id, `other "${k}" is not a function`);
    }
  }
  for (const [i, b] of (sc.beats || []).entries()) {
    if (!b.q) fail(sc.id, `beat ${i} has no question`);
    if (!Array.isArray(b.answers) || b.answers.length < 3) fail(sc.id, `beat ${i} offers fewer than three answers`);
    if (b.by && !cast.has(b.by)) fail(sc.id, `beat ${i} is asked by "${b.by}", who is not in the room`);
    for (const [k, l] of (b.argument || []).entries()) {
      if (!l.by) fail(sc.id, `beat ${i} argument line ${k} says nothing about who is speaking`);
      if (!cast.has(l.by)) fail(sc.id, `beat ${i} argument line ${k} is spoken by "${l.by}", who is not in the room`);
      if (l.at && !cast.has(l.at)) fail(sc.id, `beat ${i} argument line ${k} is aimed at "${l.at}", who is not in the room`);
      if (!l.t) fail(sc.id, `beat ${i} argument line ${k} has no text`);
    }
    // An argument nobody can take a side in is two people talking near you.
    if ((b.argument || []).length && !(b.answers || []).some((a) => a.side)) {
      fail(sc.id, `beat ${i} stages an argument but no answer takes a side in it`);
    }
    for (const [j, ans] of (b.answers || []).entries()) {
      if (!ans.t) fail(sc.id, `beat ${i} answer ${j} has no text`);
      if (!ans.reply) fail(sc.id, `beat ${i} answer ${j} has no reply`);
      if (typeof ans.mood !== 'number') fail(sc.id, `beat ${i} answer ${j} has no mood`);
      if (ans.side && !cast.has(ans.side)) fail(sc.id, `beat ${i} answer ${j} sides with "${ans.side}", who is not in the room`);
      if (ans.replyBy && !cast.has(ans.replyBy)) fail(sc.id, `beat ${i} answer ${j} is answered by "${ans.replyBy}", who is not in the room`);
    }
  }
  if (sc.only) for (const cid of sc.only) {
    if (!RZ.COUNTRIES[cid]) fail(sc.id, `only: unknown country "${cid}"`);
  }
}

/* ---- events that are rooms are held to the same shape ---- */
const eventRooms = RZ.EVENTS.filter((e) => e.beats);
console.log(`${eventRooms.length} of ${RZ.EVENTS.length} events are rooms rather than cards`);
const argued = RZ.DIALOGUE.filter((sc) => sc.others);
const sides = argued.reduce((n, sc) => n + sc.beats.reduce((m, b) => m + (b.answers || []).filter((a) => a.side).length, 0), 0);
console.log(`${argued.length} rooms hold more than one person, offering ${sides} ways to take a side`);
for (const ev of eventRooms) {
  if (ev.choices) fail(ev.id, 'an event has both beats and choices; it can only be one');
  if (typeof ev.speaker !== 'function') fail(ev.id, 'an event room has no speaker');
  if (!ev.where) fail(ev.id, 'an event room has no place');
  if (ev.beats.length < 2) fail(ev.id, 'an event room asks fewer than two questions');
  for (const [i, b] of ev.beats.entries()) {
    if (!b.q) fail(ev.id, `beat ${i} has no question`);
    if (!Array.isArray(b.answers) || b.answers.length < 3) fail(ev.id, `beat ${i} offers fewer than three answers`);
    for (const [j, ans] of (b.answers || []).entries()) {
      if (!ans.t) fail(ev.id, `beat ${i} answer ${j} has no text`);
      if (!ans.reply) fail(ev.id, `beat ${i} answer ${j} has no reply`);
      if (typeof ans.mood !== 'number') fail(ev.id, `beat ${i} answer ${j} has no mood`);
    }
  }
}

/* ---- play every answer of every beat, in several careers ---- */
// A career is set up rich, senior and well connected so that answers gated on
// money or office are reachable; the gates themselves are checked separately.
function career(countryId, seed, tier) {
  const S = RZ.engine.newGame({
    countryId, seed,
    name: 'Test Candidate', gender: 'f',
    regionId: RZ.COUNTRIES[countryId].regions[0].id,
    bgId: RZ.BACKGROUNDS[0].id,
    partyId: RZ.COUNTRIES[countryId].parties[0].id
  });
  const P = S.player;
  P.rungIdx = Math.min(tier, RZ.ladderFor(countryId).length - 1);
  P.money = 8_000_000;
  P.capital = 120;
  P.fame = 60;
  Object.keys(P.standing).forEach(k => { P.standing[k] = 55; });
  Object.keys(P.stats).forEach(k => { P.stats[k] = 60; });
  return S;
}

// Some meetings only exist inside a machine that is already running — you
// cannot be asked how the count is going with nothing on the order paper.
// Build that machine rather than making the scene defensive about a state the
// game never actually produces.
function prepare(S, sc) {
  // A deputation is always a specific deputation; without one named, the scene
  // is being asked who walked through the door and nobody did.
  if (sc.id === 'bloc-deputation' && RZ.blocs) {
    // Seeded per career, so across the whole sweep all six of them get a turn
    // at walking through the door.
    S.flags.blocAngryWho = RZ.pick(RZ.blocs.BLOCS).id;
    RZ.blocs.init(S);
  }
  if (RZ.contender && !S.contender) { S.player.trait = S.player.trait || 'firebrand'; RZ.contender.init(S); }
  const needsBill = sc.topic === 'billcount' || sc.id.indexOf('bill-') === 0;
  if (needsBill && RZ.bill) {
    S.player.capital = 120;
    RZ.bill.table(S, RZ.engine.mkApi(S), RZ.bill.BILLS[0].id);
    S.player.capital = 120;
  }
}

let played = 0, lines = 0;
const countries = RZ.COUNTRY_ORDER;

// Event rooms are played through the pending-event path so the resume
// bookkeeping is exercised too, not only the beats.
for (const ev of eventRooms) {
  const widest = Math.max(...ev.beats.map((b) => b.answers.length));
  for (let pick = 0; pick < widest; pick++) {
    for (const cid of countries) {
      if (ev.only && ev.only.indexOf(cid) < 0) continue;
      const S = career(cid, 5000 + pick * 13, 12);
      S.player.isLeader = true;
      S.player.isPresident = true;
      S.nation.termNumber = 2;
      S.pendingEvent = { id: ev.id, kicker: ev.kicker, talk: true, talkBeat: 0, talkMood: 0 };
      let convo;
      try {
        convo = RZ.dialogue.beginEvent(S, { beat: 0, mood: 0 });
      } catch (e) {
        fail(ev.id, `beginEvent threw in ${cid}: ${e.message}`);
        continue;
      }
      if (!convo) { fail(ev.id, `beginEvent returned nothing in ${cid}`); continue; }
      try {
        let guard = 0;
        while (!convo.done && guard++ < 20) {
          const opts = RZ.dialogue.options(convo);
          if (!opts.length) { fail(ev.id, `no options at beat ${convo.beat} in ${cid}`); break; }
          const allowed = opts.filter((o) => o.ok);
          if (!allowed.length) { fail(ev.id, `no allowed option at beat ${convo.beat} in ${cid}`); break; }
          const want = allowed[Math.min(pick, allowed.length - 1)];
          RZ.dialogue.choose(convo, want.i);
          lines += 2;
        }
        if (!convo.done) fail(ev.id, `never closed in ${cid}`);
        else {
          if (S.pendingEvent) fail(ev.id, `still pending after closing in ${cid}`);
          const entry = RZ.engine.finishEventDialogue(S, convo);
          if (!entry || !entry.title || !entry.body) fail(ev.id, `wrote no feed entry in ${cid}`);
          if (/undefined|NaN|\[object Object\]/.test(String(entry.title) + String(entry.body))) {
            fail(ev.id, `feed entry reads: ${String(entry.body).slice(0, 120)}`);
          }
        }
        played++;
      } catch (e) {
        fail(ev.id, `threw in ${cid}: ${e.message}`);
      }
      break;   // one country per path is enough; `only` events pick their own
    }
  }
}

for (const sc of RZ.DIALOGUE) {
  // How many distinct paths: play each answer index at each beat.
  const widest = Math.max(...sc.beats.map(b => b.answers.length));
  for (let pick = 0; pick < widest; pick++) {
    let done = false;
    for (const cid of countries) {
      if (sc.only && sc.only.indexOf(cid) < 0) continue;
      for (const tier of [3, 8, 12]) {
        const S = career(cid, 1000 + pick * 7 + tier, tier);
        prepare(S, sc);
        // Force the scene rather than waiting for its `when` to come true.
        let convo;
        try {
          convo = RZ.dialogue.begin(S, sc, actionFor(sc.topic));
        } catch (e) {
          fail(sc.id, `begin threw in ${cid} tier ${tier}: ${e.message}`);
          continue;
        }
        try {
          let guard = 0;
          while (!convo.done && guard++ < 20) {
            const opts = RZ.dialogue.options(convo);
            if (!opts.length) { fail(sc.id, `beat ${convo.beat} offered no answers`); break; }
            const usable = opts.filter(o => o.ok);
            if (!usable.length) { fail(sc.id, `beat ${convo.beat} offered nothing the player could say`); break; }
            const chosen = usable[Math.min(pick, usable.length - 1)];
            for (const o of opts) {
              if (typeof o.t !== 'string' || !o.t.trim()) fail(sc.id, `beat ${convo.beat} rendered an empty answer`);
            }
            RZ.dialogue.choose(convo, chosen.i);
          }
          if (!convo.done) fail(sc.id, `never reached a closing line (path ${pick})`);
        } catch (e) {
          fail(sc.id, `answer ${pick} threw in ${cid} tier ${tier}: ${e.message}`);
          continue;
        }

        for (const l of convo.transcript) {
          lines++;
          if (typeof l.text !== 'string' || !l.text.trim()) fail(sc.id, 'an empty line in the transcript');
          if (/undefined|NaN|\[object Object\]/.test(l.text)) fail(sc.id, `bad interpolation: "${l.text.slice(0, 90)}"`);
        }
        if (!convo.transcript.some(l => l.closing)) fail(sc.id, 'no closing line');
        if (!convo.speaker || !convo.speaker.name || !convo.speaker.role) fail(sc.id, 'speaker has no name or role');

        // The meeting must have cost or bought something.
        if (!convo.api.deltas.length) fail(sc.id, `path ${pick} changed nothing at all`);
        for (const d of convo.api.deltas) {
          if (!Number.isFinite(d.v)) fail(sc.id, `delta "${d.label}" is not a number`);
        }
        try { RZ.engine.finishDialogue(S, convo); }
        catch (e) { fail(sc.id, `finishDialogue threw: ${e.message}`); }
        if (!S.feed.length) fail(sc.id, 'nothing reached the feed');

        played++;
        done = true;
        break;
      }
      if (done) break;
    }
  }
}

console.log(`played ${played} conversations, ${lines} lines of dialogue`);

/* ---- the action loop actually hands these out ---- */
{
  let opened = 0, dryRuns = 0;
  for (const cid of countries) {
    const S = career(cid, 42, 9);
    for (let i = 0; i < 120; i++) {
      const topics = [...new Set(RZ.DIALOGUE.map(s => s.topic))];
      const id = topics[i % topics.length];
      if (!RZ.actionById[id]) continue;
      S.actionsLeft = 3;
      const out = RZ.engine.doAction(S, id);
      if (!out) continue;
      if (out.dialogue) {
        opened++;
        let guard = 0;
        while (!out.dialogue.done && guard++ < 20) {
          const usable = RZ.dialogue.options(out.dialogue).filter(o => o.ok);
          RZ.dialogue.choose(out.dialogue, usable[0].i);
        }
        RZ.engine.finishDialogue(S, out.dialogue);
      } else dryRuns++;
      S.turn++;
    }
  }
  console.log(`through doAction: ${opened} meetings, ${dryRuns} fell back to the plain roll`);
  if (!opened) fail('doAction', 'never opened a conversation');
  if (!dryRuns) fail('doAction', 'never fell back once every scene was on cooldown');
}

/* ---- promises are recorded, surface, and can be settled ---- */
{
  const S = career('ZA', 7, 9);
  const a = RZ.engine.mkApi(S);
  a.promise('water-tank', 'A tank on the hill before the next rains');
  a.promise('water-tank', 'A duplicate that must not be stored twice');
  if (S.player.promises.length !== 1) fail('promises', `expected one promise, got ${S.player.promises.length}`);
  if (!a.hasPromise('water-tank')) fail('promises', 'hasPromise did not see it');
  S.date.year += 2;
  if (a.monthsSince(a.oldestPromise()) !== 24) fail('promises', 'monthsSince is wrong');
  const ev = RZ.EVENTS.find(e => e.id === 'promiseDue');
  if (!ev) fail('promises', 'no promiseDue event');
  else {
    if (!ev.when(a)) fail('promises', 'promiseDue did not become due after two years');
    const body = ev.body(a);
    if (!body.includes('A tank on the hill')) fail('promises', 'the event does not quote what was promised');
    for (const [i, ch] of ev.choices.entries()) {
      const S2 = career('ZA', 7, 9);
      const a2 = RZ.engine.mkApi(S2);
      a2.promise('water-tank', 'A tank on the hill before the next rains');
      S2.date.year += 2;
      if (ch.when && !ch.when(a2)) continue;
      try {
        const r = ch.run(a2);
        if (!r || !r.title || !r.body) fail('promiseDue', `choice ${i} returned nothing usable`);
      } catch (e) { fail('promiseDue', `choice ${i} threw: ${e.message}`); }
    }
  }
  a.keepPromise('water-tank');
  if (a.hasPromise('water-tank')) fail('promises', 'keepPromise did not clear it');
}

if (failures) {
  console.error(`\n${failures} problem${failures === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log('\nall conversations hold up');
