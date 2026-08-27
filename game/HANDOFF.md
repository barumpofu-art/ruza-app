# Kgosi & Cadre — working notes

State of the build, the conventions it is written to, and what is next. Written so a
fresh session can pick the work up without re-reading the whole tree.

Last updated at commit `89f410d` plus the persistent cast.

---

## What it is

A mobile, text-based, conversation-driven political career simulator set in ten
southern African countries. Static vanilla JS, plain `<script>` tags (no ES modules,
so it runs from `file://`), a PWA, and an Android WebView shell.

You start as an unpaid ward activist or a parliamentary candidate and try to reach the
highest office your country's constitution allows. The meetings are real conversations:
a named person asks you something and you pick one of about three answers, each with a
price.

## Where things live

| File | What it holds |
|---|---|
| `js/core.js` | RNG (seeded mulberry32 via `RZ.seed`/`RZ.rnd`), helpers, formatting |
| `js/data-countries.js` | Ten countries: institutions, economy, regions, parties, terminology |
| `js/data-ladder.js` | The 14-rung career ladder, `RZ.ladderFor(cid)` (memoised) |
| `js/data-actions.js` | The monthly action deck |
| `js/data-events.js` | The event cards |
| `js/data-dialogue.js` | **39 scenes, ~936 lines of dialogue.** The bulk of the writing |
| `js/data-origins.js` | Two origin scenes, six traits, per-country staples |
| `js/people.js` | `makeNpc`, `makeName`, backgrounds, factions |
| `js/elections.js` | National vote, seat contests, primaries, conference votes |
| `js/engine.js` | State, the action API (`mkApi`), `endTurn`, promotion, save/load |
| `js/governance.js` | Budget, constitutional amendments, presidential actions |
| `js/dialogue.js` | The conversation engine: `begin`, `options`, `choose`, `summon` |
| `js/crisis.js` | Burnout, black swans, purges, promises, state capture, SADC |
| `js/sprint.js` | The eight-week election sprint: wards, war chest, weekly actions |
| `js/revolt.js` | Mandate, caucus revolt, blackmail, the nemesis |
| `js/constituency.js` | Ward trust, projects, lobbying, delivery and abandonment |
| `js/statecraft.js` | Cabinet, and the crises that summon you at minister/VP/president |
| `js/legislation.js` | Drafting a bill and the four-week whipping sprint |
| `js/contender.js` | The rival who starts the same year and climbs the same ladder |
| `js/blocs.js` | Six demographic blocs cutting across the regions |
| `js/cast.js` | The persistent cast: the same people, meeting after meeting |
| `js/ui.js` | All rendering. One module, no framework |
| `js/main.js` | Bootstrap and flow control |

The conversation engine also hands each scene `a.them` (the person opposite),
`a.remember(what, tone)`, `a.recalls(tone)` and `a.rel()`.

## Conventions that matter

- **No ES modules.** Everything is an IIFE hanging things off the global `RZ`.
- **Load order is significant** and set in `index.html`; every cross-module reference is
  guarded (`if (RZ.blocs)`) so each module degrades rather than throwing.
- **Registering a new module means five places:** `index.html`, `sw.js` (and bump
  `CACHE`), the workflow's APK-content assertion list, and the `FILES` array in all
  three test harnesses.
- **All player-visible strings go through `esc()`** in `ui.js`.
- **Every rate is written as a monthly rate** and multiplied by `span` (0.25 in a weekly
  turn). See the tempo engine below.
- **Commit messages are prose**, present the finding as well as the change, and never
  name a model.

## The tempo engine

`S.tempo` is `'month'` or `'week'`. `endTurn` computes `span = S.tempo === 'week' ? 0.25 : 1`
and multiplies every rate by it, so four weekly turns land exactly where one monthly turn
would. Two things claim the weekly clock:

- **The election sprint** (`sprint.js`) — the last eight weeks before a ballot.
- **A bill in committee** (`legislation.js`) — four weeks to a second reading.

They cannot overlap: a bill cannot be tabled during a campaign, and a dissolution kills a
bill in flight (`RZ.bill.lapse`).

## The action API (`mkApi` in engine.js)

The surface every action, scene answer and bill effect is written against:

```
a.add(key, amt)        a.addRaw(key, amt)     a.blocs({youth: 5, rural: -3})
a.nation(key, amt)     a.addRegion(id, amt)   a.blocMood(id)
a.wage(n)              a.rng(lo, hi)          a.chance(p)      a.roll(stat, dc)
a.tier()               a.homeName()           a.inGov()        a.isLeader()
a.dirt(id, label, sev) a.removeDirt()         a.exposeDirt()   a.hasLeverage()
a.makeRival()          a.recruitAlly()        a.digOnRival()   a.doLeak()
a.promise(id, label, opts)  a.keepPromise()   a.owePatron()
a.startProject()       a.wardTrust(n)         a.whipped()      a.traitScale()
a.legacyMark(k)        a.spendOnDelegates()   a.campaignEffort()
a.t (terms)  a.C (country)  a.P (player)  a.S (state)
```

`add()` and `addRaw()` differ in one way: `add('grassroots', x)` also spreads a little
across all six blocs; `addRaw` does not. `blocs()` comes back through `addRaw` so the net
is counted exactly once. If you are writing bloc code, use `addRaw`.

## Testing discipline

Three harnesses, and they answer different questions. Run all three before committing.

```
node game/test/dialogue-sim.mjs     # is the content well-formed and reachable?
node game/test/mechanics.mjs        # does each system fire and do what it says?
node game/test/monte-carlo.mjs      # what do the rules do at scale?
```

- **dialogue-sim** plays every answer of every beat in several countries and tiers. It
  enforces: unique scene ids, at least two beats, at least three answers per beat, every
  topic reachable through an action or a summon. If a scene needs state to exist, build
  it in `prepare()` rather than making the scene defensive about a state the game never
  produces.
- **mechanics** builds the exact state each system needs. 474 checks in 20 sections.
  This is where anything gated on high office gets tested, because no automated policy
  reaches the presidency reliably.
- **monte-carlo** runs 1,000 seeded careers in two cohorts — `random` (a coin, the honest
  null hypothesis) and `directed` (the least clever competent player I could write). Any
  seed replays with `--replay <seed>`. `--strict` fails on a warning. It has found more
  real bugs than either of the others; treat its warnings as findings, not noise.
- **apk-smoke** plays a career end to end in the packaged Android app on an emulator.
  Rehearse it against desktop Chromium:
  `PAGE_ORIGIN=127.0.0.1 CDP_ENDPOINT=http://127.0.0.1:9222 node test/apk-smoke.mjs`

Two traps that have cost time:

- **Never `pkill -f` a pattern that matches your own shell** — it kills the shell (exit
  144). Use `fuser -k -9 <port>/tcp` or kill by pid.
- **Seeded tests are brittle to any change anywhere.** Adding an `RZ.range()` call in
  `newGame` shifts the stream under every later seed. Write tests that *ask* for the
  outcome they need (loop seeds until a revolt is lost) rather than assuming a given
  seed produces it.

## What is built

Working and tested: the ten countries and their electoral systems · the origin scenes
and six persistent traits · the monthly action deck and event cards · 39 conversation
scenes and a persistent cast that remembers them · elections at every level · the eight-week campaign sprint with a war chest that
cannot be filled cleanly · constituency projects, trust and abandonment · MP duties ·
tier-distinct phases for minister, VP and president · burnout, black swans, purges,
promises, state capture and SADC intervention · the caucus revolt with a non-fatal
ultimatum · the nemesis · proactive legislation with a four-bloc House · the climbing
contender · six demographic blocs.

## What is next

The direction agreed with the user is **towards Suzerain**: a scene-based narrative
engine rather than a dashboard with prose on it. Build order, highest leverage first:

1. ~~**A persistent named cast.**~~ **Done** (`js/cast.js`). `who()` resolves a role to a
   permanent person with a relationship score, a meeting count and a short memory. Roles
   that genuinely are a stranger each time are listed in `RZ.cast.ANON`. No scene had to
   be rewritten — the change is entirely inside the helper they all already called.
2. ~~**Scenes that remember.**~~ **Mostly done.** `a.remember(what, tone)` files
   something said in front of somebody; `RZ.cast.greeting()` opens a later meeting by
   quoting it back. Seven answers are seeded so far — *more scenes should call
   `a.remember()`*, which is the cheapest remaining writing task in the game.
3. **Multi-speaker rooms.** `convo.speaker` is singular today. An `argument` beat type
   where two NPCs trade lines and your answer sides with one of them.
4. **The Docket.** Replace the action grid with a scheduled day of named appointments
   plus a free slot.
5. **The dramatic pause.** Player choice nodes open on a beat of silence.

Decision still open on 3: whether cabinet arguments are authored (few, hand-written,
Suzerain-quality) or assembled from each minister's faction and interests (infinite,
blander). The suggestion on the table is authored for the six or seven pivotal rooms and
assembled for the rest.

### Backlog carried from earlier

- Carry-over of leftover campaign money into personal wealth. **The threshold must be in
  wage units, not an absolute figure** — wage bases span 450 to 340,000 across the ten
  countries.
- Unify the commission audit with the post-election injunction, so a player is not
  scrutinised twice for the same money.
- The by-election, offered as a choice: fight it broke and free, or let the party fund it
  and owe them every vote.
- The trenches at the bottom: the branch gatekeeper and the nomination list, the youth
  league hustle, the first Faustian bargain, carrying chairs.
- The family legacy: a spouse and siblings consuming wealth, and the brother who wins a
  tender.
- Election Day as four phases (ground game, exit polls, tactical shift, live count).
  **Needs the staggered animated count screen built first — it does not exist.**

### Standing findings, recorded rather than fixed

- **The route that reaches the presidency is the corrupt one.** The clean directed policy
  caps at tier 11. That may be the right politics, but it is a design choice nobody has
  explicitly made.
- **Medical collapse fires often** in long careers — about one every three and a half
  years over a 600-month run, which trips the Monte Carlo's own threshold. Predates the
  recent work; the horizon may simply be longer than the threshold was calibrated for.
- **The contender rarely reaches the top** (0% in short runs). The throne ending is
  covered by mechanics.mjs but may be too rare to matter at scale.
