# Kgosi & Cadre — working notes

State of the build, the conventions it is written to, and what is next. Written so a
fresh session can pick the work up without re-reading the whole tree.

Last updated for 1.19.0.

---

## What it is

A mobile, text-based, conversation-driven political career simulator set in ten
southern African countries. Static vanilla JS, plain `<script>` tags (no ES modules,
so it runs from `file://`), a PWA, and an Android WebView shell.

You start as an unpaid ward activist, a parliamentary candidate, or a cabinet minister,
and try to reach the highest office your country's constitution allows. The meetings
are real conversations: a named person asks you something and you pick one of about
three answers, each with a price. A career that keeps its hands clean ends short of
State House. That is a complete career, not a failed one.

## 1.19.0 — what landed

The clause is a room. The slider was GPS. Cabinet can sit it.

1. **Open it at minister.** `amendLive`: in government, tier ≥ 6. Term limits, term length and the courts stay palace paper. Devolve is what a minister can actually table. Once a year, like the package.
2. **The Whip already has a number.** `amend-table`: Justice, the Whip, the Leader of the Opposition. The clause, the count, the verb. Whip it, count what you have, or bury it. No range input.
3. **The palace still has a pen.** A president sees the same room with different paper on the folder. A vice-president still chairs the estimates; a minister is not offered the budget.
4. **A miss is a ceiling.** `applyAmend` calls the count you already had. Burying is not a carry. The regions that get a share cannot have it taken back.

Helpers live on `RZ.gov` (`amendLive`, `pickAmend`, `beginAmend`, `applyAmend`). One scene. No new JS file.

## 1.18.0 — what landed

The rest of the house meets. The recommendations, as meetings, not as a new game.

1. **Wire.** A hostile bill they quoted, carried, is a renege (`partnerSeesCarried`). Honouring a friendly one pledges the opposition bloc. Two centres walk into `gnu-meet`: *who am I actually in government with?*
2. **Own the clean path.** `sg-ceiling`, once. The SG says how far clean hands go. Integrity is a design, not an accident in the Monte Carlo.
3. **Friday is a country.** `fridayMatter` — kgotla and the public wage, a hostel and a metro, mealie meal at the party price. Not a borehole with different nouns.
4. **The year has a room.** `the-year`: a funeral, a list, a by-election, a commission. Summoned once a year in the climb. The middle is no longer only the diary.
5. **The next career hears a rumour.** `recordLast` / `readLast`. Same country, a name, an ending. Not a save.

Helpers live on `RZ.state.partnerSeesCarried`, `RZ.ward.fridayMatter` / `yearLive` / `pickYearKind`, `RZ.engine.recordLast` / `readLast` / `rumourLine`. Two scenes. No new JS file.

## 1.17.0 — what landed

The partner quotes the paper you signed. GPS would simulate the annexures. This tree already had the rooms.

1. **The cheque is still a date.** Signing the Statement stamps the year. The next time they sit down they do not ask for a date again.
2. **The annexure is on the folder.** `partnerQuote` is whatever is live: a bill on the order paper, October's package, or a hole in the books. Pure. The file may read it. Hostile bills (land, mines, wages) they want pulled; the rest they will own.
3. **Honour, renege, or walk.** Same room (`gnu-meet`). Honouring a hostile bill withdraws it. Honouring the package sits a holiday. Reneging sours them; if they are already on the floor they walk, and Tuesday starts.
4. **Not a tracker.** No NHI flag. No twelve clauses. The photograph and the order paper now know each other because the same person is in a second doorway.

Helpers live on `RZ.state` (`partnerQuote`) and `RZ.bill.withdraw`. `houseFile` still does not create people on render. No new scene.

## 1.16.0 — what landed

Saturday is the vote. Conference year was a toast. The incumbent is now in the hall.

1. **The diary pins it.** A president who still leads the party, from June of `nextConference`, pins `Sit the conference` the way February pins the speech. After Tuesday, before the photograph.
2. **The last beat is a count.** `conference-floor`: the SG, a provincial chair, the person who wants the job. Stand and keep the photograph, stand and dump them (the hawk's buses), or make way. `conferenceHolds` reads the delegate map you already had. Not a roll.
3. **A lost hall takes the chair.** `applyConference` on a parliamentary republic that does not hold ends the career (`recall`). A presidential republic splits: you keep the country, they have the party (`twoCentre`). Anointing is that split on purpose.
4. **The GNU walks in with the buses.** Dumping the partner is a beat in the same room. Walking is 1.15. The hall is 1.16.

Helpers live on `RZ.state` (`conferenceDefenceLive`, `plantChallenger`, `challenger`, `conferenceHolds`, `applyConference`, `splitLeadership`). `houseFile` still does not create people on render. No new JS file.

## 1.15.0 — what landed

A GNU is a person. `formGovernment` still sorts the nights you are not in it; the partner now stays in the building.

1. **They sit down.** `S.partner` is the runner-up (GNU) or the smaller paper (a kingmaker) — name, party, standing, a chair. Finance for a GNU. The chair they were given, for a kingmaker. The briefing can bring them when that number is on the folder.
2. **The GNU is a meeting.** `Sit the partner` (`gnu-meet`): a paper (Statement of Intent, stamps the year), the chair stays theirs, or they walk. Walking unseats them. You are a minority. Tuesday starts, which 1.14 already knew how to count.
3. **Your hawk.** When the caucus is on the floor, `gnu-caucus` is summoned. Keep them, dump them, or a statement. Dumping is a walk with a party bonus.
4. **Pin it like tax, until you sit it.** A parl president with a live partner and no paper this year pins `partner` after Tuesday and before October. Missing it sours them and summons the room. Not a silent walk.

Helpers live on `RZ.state` (`partner`, `partnerLive`, `plantPartner`, `seatPartner`, `applyPartner`, `walkPartner`). `houseFile` still does not create people on render. Ministers can carry a `partyId`.

## 1.14.0 — what landed

A minority lives on Tuesday. Forming alone was the safest parliamentary government in the tree, because the silent no-confidence only looked at partner-count. That roll is gone. The room is the vote.

1. **Tuesday is the job.** A parl president short of the House pins supply the way February pins the speech. A paper stamps the year and the pin goes away. Missing it is counted (`missedSupply`) and makes the censure likelier. Not an optional corridor.
2. **The count is a count.** `houseHolds` reads seats, two names from the Whip, two from leadership, and whether there is a paper this year. Leadership cannot invent a majority. A paper means they do not vote you out; your own benches still can (`party < 22`).
3. **A lost whip takes the chair.** `applyCensure` on a parliamentary House that does not hold ends the career (`noconfidence`). A presidential House still only makes the rest of the term a trial. Same meeting.
4. **Fragility is the form of government.** Minority without a paper is live every month. A paper buys Tuesdays. A kingmaker is medium. GNU is the most stable to the country.

Helpers live on `RZ.state` (`govSeats`, `houseNeed`, `minorityLive`, `houseHolds`, `applyCensure`). `houseFile` still does not create people on render. No new scene.

## 1.13.0 — what landed

A hung House is a room. `formGovernment` still sorts the nights you are not in it.

1. **GNU.** Sit with the runner-up (`coalition-talks`). The country looks whole. Your caucus hates it. The Leader of the Opposition walks into government and a new one is named later.
2. **A kingmaker.** Sit with the smallest paper that is not them — IFP after DA, AD after DC, AP after BDP. They take a chair. Fragile, which 1.12 already knew how to count.
3. **Alone.** A minority. The House lives on supply. Tuesday is the whole mechanic.

After a parliamentary count the player is invited to form, the night copy says talks begin Monday, a caretaker (the lead, alone) sits until the room writes the paper. NPC nights and `newGame` still auto-form.

Helpers live on `RZ.elections` (`coalitionOptions`, `talksLive`, `parkTalks`, `applyCoalition`, `seatGovernment`). `RZ.elections.SUMMONS` is `coalition-talks`. `houseFile` still does not create people on render.

## 1.12.0 — what landed

The opposition is a party. The Leader is still a person; the caucus is now a number, a hawk, and a second party that wants the title.

1. **A deal is a split.** Sitting a corridor with the Leader (`opp-meet`) drops caucus unity and sets their line to `corridor`. When unity is on the floor, the hawk walks into your office (`opp-split`, summoned). Take them (they cross, seats move), send them back, or let them fight. GPS floor-crossing, written as a room.
2. **The other party.** `Call in the other party` (`opp-other`) is the second-largest out of government. Name them, freeze them, or play them against the Leader. BCP after BDP, EFF after DA, PODEMOS after RENAMO. Not a vote share.
3. **Supply.** Parliamentary systems with a thin majority or a coalition sit `opp-supply`: a chair, a paper, or the door. A paper stamps the year and makes a no-confidence harder. Not a coalition spreadsheet.

`S.parties[id].unity` was stored and never read. It is now the same number as the Leader's caucus. `houseFile` still does not create people on render.

Helpers live on `RZ.state` (`otherOppositionParty`, `hawk`, `applySplit`, `applyOther`, `applySupply`, `supplyLive`, `thinMajority`, `crossSeats`). `RZ.state.SUMMONS` now includes `opp-split`.

## 1.11.0 — what landed

A second year in office is a different job. Four rooms, all meetings:

1. **The hottest province.** `Sit the hottest province` opens `house-project`: the premier, the minister who owns the kind of thing it needs, and Finance. One project at a time (`S.house.project`). A delivered date plants it; months later it opens and the province moves. GPS construction, written as a room.
2. **A named great power.** `Receive the ambassador` (and the old resource deal) open `great-power`. China if the books are a hole, Washington if there is a listing, otherwise the neighbour. Summoned (`power-deal`) when a listing or a loan is live. Not a world map.
3. **Opposition as a person.** `S.opposition` persists the Leader of the Opposition — the same person as the censure room. `Call them in` (`opp-meet`) is a corridor; a motion (`opp-table`) is summoned when they have a file or the floor. They table, they leak, they take a chair.
4. **Taxes, once a year.** `Sit with Finance on the package` (`tax-package`) is VAT, a royalty, or a holiday. October without a package pins it, the way February pins the speech. Not thirty taxes.

The desk at 900px is a desk: diary left, file / project / opposition right. 1 / 2 / 3 answers, Enter leaves the room, N turns the month. A career exports as a file from the You pane. That is the PC edition of this tree. Wrapping it in Tauri is the same `public/play` folder inside a window.

Helpers live on `RZ.state` (`pickProject`, `applyProject`, `liveProject`, `pickPower`, `applyPower`, `opposition`, `applyOpp`) and `RZ.gov` (`beginTax`, `applyTax`). `RZ.state.SUMMONS` now includes `opp-table`. `RZ.engine.exportSave` / `importSave` are the save file.

## 1.10.0 — what landed

State House is a job. A president's month is a briefing, not a walkabout: two
ministers of different kinds bring the worst number on the file, and the minute
you sign moves the country (`applyHouse`, same shape as `applyDuty`). The diary
pins `brief`. February without a speech is still State of the Nation.

The Nation pane prints the file: the worst number, the hottest province, the
minister already writing a different minute. A censure (`house-censure`) is a
summoned room when approval is on the floor; a parliamentary system can actually
lose the chair's stability, a presidential one can only make the rest of the
term a trial. The regional summit is a corridor (`sadc-summit`), not a dice roll.

This is the Rogue State lesson, written as meetings: the cabinet is the toolbox.
It is not Geo-Political Simulator. GPS has a thousand actions and a spreadsheet
for a soul. Do not add a thousand actions.

Helpers live on `RZ.state` (`houseFile`, `hottestRegion`, `pickBrief`, `applyHouse`).
`RZ.state.SUMMONS` now includes `house-censure`.

## 1.9.0 — what landed

The office has a job. A minister sits one of six rooms (`duty-clinic`,
`duty-school`, `duty-road`, `duty-cluster`, `duty-shaft`, `duty-list`) mapped
from the chair they actually hold, and the nation moves from that minute.
`doAction('ministry')` always opens the mapped room; `scenesFor` only offers
that room, so the diary cannot name the mines DG for a health minister.

An MP drives home on Friday (`friday-ward`). Missing two months drains ward
trust. A finished project summons `ribbon-day` instead of a feed card. Three
manifesto lines (`manifesto-desk`, summoned once a campaign starts without
one) are stamped kept / late / broken; `incumbentSwing` is what election
night adds on top of the machine; the Nation pane prints the ledger.

The desk carries a paper naming this month's duty, and the diary pins it
first (ministry / Friday / estimates / briefing / State of the Nation). Walkabout is
still there. It is no longer the thing the month is for.

State of the Nation is a holding-room conversation (`nation-address`), not a
dice roll. The speech is the last beat.

Helpers live on `RZ.ward` (`duty`, `markFriday`, `stamp`, `ledger`,
`incumbentSwing`, `pickManifesto`) and `RZ.state` (`dutySceneId`, `applyDuty`,
`DUTY_SCENE`). Summoned rooms: `RZ.ward.SUMMONS` (`ribbon-day`,
`manifesto-desk`).

## 1.8.3 — what landed

The deputy diary no longer offers the palace. A leftover `Address the nation`
(or any president-only action) is pruned from the book, `doAction` refuses it,
and `bookable` will not put it there. The Grok preview pill no longer sits on
the last answer: when the game is framed, the sheet and the tab bar lift, and
a meeting keeps its choices on the sheet while the transcript scrolls.

## 1.8.2 — what landed

The cabinet is people. Six named ministers sit on the Nation pane, the same
people you meet in the estimates room and in a leak. A reshuffle is two names
and a chair (`cabinet-cut`), not a dice roll: whoever you drop is gone, and
the next meeting with that portfolio is somebody else. A leak is summoned
(`cabinet-leak`) when loyalty is on the floor; two ministers of different
kinds can be summoned to argue (`cabinet-row`) and the argument is assembled
from what their ministry actually is. Loyalty finds a level (2% a month toward
a target). The minister start skips the chair you already sit in. `cast.succeed`
is what makes a drop a different person.

## 1.8.1 — what landed

The vice-president's budget is a room, not a slider. `Chair the estimates` opens
`estimates-chair`: Finance and Health argue, you pick a package, a note arrives
from the palace. Standing is what decides whether the minute you sent is the
minute that is tabled. Yielding always lets him write his road in; leaking the
original keeps the package and puts a file on you. The president still has the
pen — `Table the national budget` is the slider it always was.

Helpers live on `RZ.gov` (`beginEstimates`, `tiltEstimates`, `composeEstimates`,
`palaceAmend`, `sealEstimates`). `doAction('budget')` for a deputy always opens
this room, ignoring the thirty-turn scene skip, because a budget is annual.

---

## 1.8.0 — what landed

Presidency thesis C: the clean path caps below the top office. `endGame` marks
`neverTookIt` (integrity ≥ 62, no exposed dirt, tier ≥ 10) or `kingmaker` (made
way, or allied the contender). Legacy ranks and the obituary name both.

Three ways in. `startAs: 'minister'` is a new origin (mandarin / advocate / schemer),
tier 6, four actions, a portfolio, and the governing rooms from month one.

Eight rooms added to `data-dialogue.js` (not a new module): `kraal`, `sg-midnight`,
`live-tv`, `deputy-sits`, `kitchen-table`, `miners-hall`, `collapse-bed`,
`contender-slate`. Crisis scenes are summoned: `RZ.crisis.SUMMONS`, `RZ.family.SUMMONS`,
`RZ.state.CRISES`, `RZ.contender.SUMMONS`. Answers can set `memory` / `memoryTone`;
`dialogue.choose` writes them through `a.remember` so existing `run()` functions
did not have to be rewritten.

The first activist month pins the branch secretary into the diary, and a tutorial
paper sits on the desk until it is dismissed. The obituary carries a seed hex and
can be copied or shared. Angola and Mozambique speak Portuguese in `T()` and in
HUD / tabs / create chrome via `RZ.L`. A vice-president (tier ≥ 11) is offered
`amend` and `budget`; term limits, term length and the courts stay president-only.

Medical collapse is a room now (`collapse-bed`), not a card that ends the run.
A contender who climbs onto a high rung is a named near-miss once.

Do not collapse `field.js` and `contender.js`. Do not add ES modules. Registering
a new JS file is still five places.

## Where things live

| File | What it holds |
|---|---|
| `js/core.js` | RNG (seeded mulberry32 via `RZ.seed`/`RZ.rnd`), helpers, formatting |
| `js/data-countries.js` | Ten countries: institutions, economy, regions, parties, terminology |
| `js/data-ladder.js` | The 14-rung career ladder, `RZ.ladderFor(cid)` (memoised) |
| `js/data-actions.js` | The monthly action deck |
| `js/data-events.js` | The event cards |
| `js/data-dialogue.js` | **105 scenes.** Eight rooms in 1.8.0; estimates and cabinet rooms in 1.8.x; six ministry rooms, Friday, the ribbon, the manifesto desk and State of the Nation in 1.9.0; `cabinet-brief`, `house-censure`, `sadc-summit` in 1.10.0; `house-project`, `great-power`, `opp-meet`, `opp-table`, `tax-package` in 1.11.0; `opp-split`, `opp-other`, `opp-supply` in 1.12.0; `coalition-talks` in 1.13.0; `gnu-meet`, `gnu-caucus` in 1.15.0; `conference-floor` in 1.16.0; `sg-ceiling`, `the-year` in 1.18.0; `amend-table` in 1.19.0 |
| `js/data-origins.js` | Three origin scenes, six traits, per-country staples |
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
| `js/field.js` | Everybody else on the ladder: party figures with careers of their own |
| `js/contender.js` | *One* named rival who starts the same year — see the note below |
| `js/blocs.js` | Six demographic blocs cutting across the regions |
| `js/cast.js` | The persistent cast: the same people, meeting after meeting, and who is called what on screen |
| `js/docket.js` | The diary: appointments somebody else booked, and the cost of not turning up |
| `js/trenches.js` | The bottom of the ladder: the register, the list, and whoever keeps them |
| `js/family.js` | The household — a spouse, the relatives, and the brother in the gazette |
| `js/electionday.js` | Election day in four phases, and the count that comes in region by region |
| `js/ui.js` | All rendering. One module, no framework |
| `js/main.js` | Bootstrap and flow control |

The conversation engine also hands each scene `a.them` (the person opposite),
`a.who(key)` (anybody else in the room), `a.remember(what, tone)`, `a.recalls(tone)`
and `a.rel()`.

**Names on screen go through `RZ.cast.shortOf(S, person)`**, never `name.split(' ')[0]`.
A room prints first names, so a minister who happens to share the player's first name
makes "Backs Thandi" ambiguous; `shortOf` falls back to the full name when a first name
is spoken for. Identity is compared by `key`, never by name.

## Two systems of rivals, on purpose

`field.js` (from main) and `contender.js` (from this branch) both put people on
the ladder and both climb it. **They are deliberately kept separate** — this was
asked and answered, so do not collapse them:

- **`field.js` is the establishment.** Every rung has a holder, contests are
  scored against whoever is actually in the doorway, and people are deposed,
  wounded and retired as careers run. It answers *who is in my way this month*.
- **`contender.js` is the one you are told about at character creation.** A
  single named rival generated against your origin trait, with a personal
  relationship, a file you can keep on them, and an ending of its own if they
  reach the top before you do. It answers *who is the story about*.

Where they touch: an ascended contender takes a seat in the field
(`RZ.field.addRival`) and becomes the nemesis, so every mechanic that already
understands an incumbent understands them too.

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
node game/test/dialogue-sim.mjs       # is the content well-formed and reachable?
node game/test/mechanics.mjs          # does each system fire and do what it says?
node game/test/career-sim.mjs --careers 4   # whole careers, invariants every turn
bash game/test/page-smoke.sh          # the real page in a real browser
node game/test/monte-carlo.mjs        # what do the rules do at scale?
```

- **dialogue-sim** plays every answer of every beat in several countries and tiers. It
  enforces: unique scene ids, at least two beats, at least three answers per beat, every
  topic reachable through an action or a summon. If a scene needs state to exist, build
  it in `prepare()` rather than making the scene defensive about a state the game never
  produces.
- **mechanics** builds the exact state each system needs. 511 checks in 21 sections.
  This is where anything gated on high office gets tested, because no automated policy
  reaches the presidency reliably.
- **monte-carlo** runs 1,000 seeded careers in two cohorts — `random` (a coin, the honest
  null hypothesis) and `directed` (the least clever competent player I could write). Any
  seed replays with `--replay <seed>`. `--strict` fails on a warning. It has found more
  real bugs than either of the others; treat its warnings as findings, not noise.
- **career-sim** (from main) plays whole careers in every country and asserts every
  invariant after every turn — including that every feed entry has a title and a body,
  which is what caught four kinds of event rendering a blank outcome sheet. When you add
  an action that asks a question before it resolves (a ward, a bloc, a clause), teach its
  `out.special` branch here or it will be counted as a missing outcome.
- **page-smoke** (from main) is the only harness that loads `ui.js` and `main.js`. It
  plays the origin scene, every pane, a year of months, a reload and the obituary.
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
contender · six demographic blocs · the diary of appointments somebody else booked.

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
3. ~~**Multi-speaker rooms.**~~ **Done.** A scene declares `others: { key: fn }` alongside
   its `speaker`; a beat can carry `argument: [{ by, at, t }]` that the NPCs say to each
   other before anybody turns to you; an answer can carry `side: 'key'`, which warms the
   person backed and cools the other parties to *that* argument (not the chair). Four
   authored rooms so far — `cabinet-budget`, `war-room`, `whip-corridor`,
   `security-table`. `dialogue-sim` enforces the structure: everybody referred to must be
   in the room, and an argument with no answer that takes a side is a failure.

   **Adding one:** authored is the house style for pivotal rooms. Assembled-from-faction
   arguments are possible on the same engine. `cabinet-cut` and `cabinet-leak` are
   authored; `cabinet-row` is assembled from each minister's `kind`. That is the split.
4. ~~**The Docket.**~~ **Done** (`js/docket.js`). The month no longer opens as an empty
   menu: `build(S)` writes two or three appointments into `S.docket.entries`, each one an
   action from the same deck, each with a time, a named person from the cast, and a reason
   read off that person rather than picked at random. The grid underneath becomes "the rest
   of the month".

   Three rules hold it together and none of them should be quietly relaxed:
   - **It never fills the month.** `slotsFor` returns `actionsPerTurn - 1`, capped at three.
     The free slot is the whole point; a diary with no room in it is a corridor.
   - **It costs nothing extra.** An appointment is the same action at the same AP. What is
     new is only that *not* going is now a recorded act.
   - **The diary cannot lie.** The scene is chosen when the appointment is booked and its id
     is stored on the entry; `RZ.docket.sceneFor` hands it back to `doAction`, so the person
     who was promised is the person in the room. Fall back to a fresh `sceneFor` only when
     the booked scene has stopped being reachable.

   Three ways an appointment ends, at three prices, and **the order matters**: keeping it
   (`keep`, +2 rel, called from `doAction`), cancelling it (`decline`, -2..6 rel, no action
   spent because not going somewhere never does), and simply not turning up (`close`, run
   from `endTurn`, -6..13 rel, a bad memory filed against you, grassroots, and one feed card
   naming everybody who sat there). Silence has to be the expensive one. The first draft had
   it backwards, which made the Cancel button a trap — a player who read the numbers would
   never touch it and would let every month run out instead. A campaign sprint or a bill in committee calls `suspend`, which clears the diary
   with no cost to anybody: an election is a reason the whole country accepts.
5. ~~**The dramatic pause.**~~ **Done.** A question no longer lands with its answers
   already on the table. `RZ.dialogue.pauseFor(convo, beat)` writes a one-line stage
   direction for the silence after the question — read off the room's temperature, the
   asker's `temper` from the cast, and whether two people in the room have just
   disagreed — and `pushQuestion` stores it as `convo.pause`. `showDialogue` renders it
   with three pulsing dots and veils the `.choices` block for `RZ.ui.PAUSE_MS` (850ms).

   Four rules, and the tests hold all four:
   - **It is written once, when the question is asked**, not at render time. The modal
     repaints on every answer; a silence that re-rolled each repaint would flicker.
   - **The answers stay in the DOM the whole time.** The veil is `opacity:0` plus
     `pointer-events:none`, so nothing reflows when it lifts and a script can still
     reach the buttons. `page-smoke` asserts the *computed* `pointer-events`, because
     a veil that does not actually block a tap is not a veil.
   - **Any tap ends it**, and the tap that ends it must not also answer the question.
     A click on an answer bubbles to the skip handler *after* the modal has repainted,
     so `release()` is guarded on the beat it was painted for. That guard is the whole
     bug; without it the next question never holds.
   - **It is off where it should be**: `RZ.ui.setPause(0)` for the harnesses, and
     `prefers-reduced-motion` for a player who has asked their phone not to animate.

   Mechanically it is nothing — no state, no cost, the same answers underneath.

Decision closed on 3: authored for the pivotal rooms (`cabinet-cut`, `cabinet-leak`,
the estimates, the war room) and assembled for the rest (`cabinet-row`, from ministry
kind). Do not invert that.

### The backlog, now cleared

All six items carried from the early sessions are built and tested. What each of
them turned out to be:

- **The trenches** (`js/trenches.js`). Below tier four the question is not whether you
  are strong enough, it is whether one person has written your name down. A single
  persistent cast member — the branch secretary, in your own region, for the whole
  climb — keeps a `favour` score; `RZ.trenches.listBonus` feeds straight into
  `field.playerSide().here`, so being off the list costs up to fourteen points in the
  hall and being well on it is worth twelve. `chairs` and `hustle` are the two actions
  the bottom of the ladder is actually made of, and they exist nowhere above tier three.
  Favour decays 3%/month — see the ratchet note below; it is the same lesson again.
  The first Faustian bargain (`trench-list` in data-events) arrives only in the band
  where it is genuinely a short cut: close enough to want the list, years off earning it.
- **The family** (`js/family.js`). `drain()` is added to the monthly outgoings in wage
  units and scales with both the office and the number of relatives, which is the reason
  rising never makes anybody rich. The spouse has `patience`, spent by the job and bought
  back only by `rest`; at zero they leave, once, with a legacy mark. `kin-ask` is the
  ordinary recurring ask; `kin-tender` is the brother whose company appears in the
  gazette, which is the one that ends careers.
- **Campaign money carry-over.** `sprint.end()` no longer evaporates the chest.
  **The threshold is `PETTY = 2.5` wage units and must stay in wage units** — the bases
  span 450 to 340,000, so any absolute figure is a rounding error in one country and a
  fortune in another. Below it, absorbed silently; above it, `S.flags.pocketedChest` and
  a feed card.
- **The audit and the injunction, unified.** One chest, one letter: `auditDue` now covers
  where the money came from *and* what was left of it, in one set of questions. Filing
  honestly returns the balance and calls `api.settleDirt('returns')`; the general
  `commission` event now gates on `api.openFiles()` rather than on any exposed dirt, so a
  file the electoral commission has closed cannot be the subject of a second inquiry.
  A false return that is *caught* is deliberately left unsettled — that one is a live
  case number and should come back.
- **The by-election** (`byelection` in data-events). Offered when the next rung is a
  `public` one, which is exactly the off-cycle version of the wait those rungs otherwise
  face. The design point is in `byProtest()`: turnout collapses and the people who still
  come out have a grievance, so a governing party loses seats it holds comfortably.
  Measured across sixty runs: a weak candidate wins 62% self-funded and 78% with the
  region's money; a strong one wins 95% either way. **The machine's offer is worth most
  to whoever can least afford to refuse it**, which is the whole mechanic. A bought seat
  sets `S.flags.seatOwed`, worth −12 on `revoltOdds` for the rest of the career.
- **Election day in four phases** (`js/electionday.js`). Dawn, the exit polls, one
  intervention, and the count. **The result is not computed until phase three has been
  answered** — `runCount()` folds the day's swing into `campaign.effort` and only then
  calls `runElection`, so the first three phases genuinely move it. The exit poll is a
  *sample*: honest inputs plus sampling error sized off `inst.electoral`, which makes it
  wrong about the winner often enough in a tight race to make phase three a bet, and
  never wrong in a landslide, which is also correct. The count declares smallest region
  first, so the places that decide it speak last. `RZ.ui.setCount(0)` turns off the
  stagger for the harnesses and `prefers-reduced-motion`.

### Two dead terms and a bar set at the wrong height

Chasing "the congress purge hits nearly everybody" turned up three separate faults, none
of which was the one guessed at first. Method that found them, since it is the reusable
part: instrument the function, run the same probe on the *previous release's tree*
(`git archive <sha> game | tar -x -C /tmp/old`), and compare. 1.6.0 reached the purge
check 0 times in 120 careers; 1.7.0 reached it 21 times. That delta is what made the
cause findable.

1. **`P.allies` has never existed.** Allies are figures in `S.field` with
   `side === 'ally'`, reached through `RZ.field.allies(S)`. Both `congressPurge` and
   `revoltOdds` read `(P.allies || []).length`, which is always zero — so every ally
   anybody has ever recruited counted for exactly nothing in the two places the game
   says they matter. The instrumentation made it obvious: `mean allies 0.0`, in every
   sample, in every country.
2. **The purge was gated at tier 2.** Its own card says *"there is no seat to contest
   this election"* — that is a candidates' list, and the offices below the seat are
   internal ones no general election touches. A ward councillor was being dropped from a
   slate they were never on. It is gated at tier 4 now.
3. **The bar was absolute where it should have scaled.** `threshold = 26 + patronage*0.16`
   compared a branch chairperson's standing against what a cabinet minister needs. It is
   `12 + tier*3.4 + patronage*0.16` now, so what it takes to stay on a list rises with the
   value of the list.

Why 1.7.0 surfaced it: the trenches gave low-tier players a route to actually win internal
contests, so many more careers reached tiers 2–3 — and at tiers 2–3 the purge fired on
essentially everybody it was asked about. The mechanic had been fine for releases only
because nobody was ever getting far enough to be asked.

### Eswatini's top office, and what it was actually made of

SZ was reaching the top office in 58% of careers against 0–4% everywhere else. The
diagnosis written here first — "the monarchy's appointment route has no election in the
way" — was wrong, and instrumenting `promote()` to record *why* it fired said so in one
run: every single one arrived via **"X recommended you personally, which surprised
everybody"**, which is `revolt.blackmail`.

`blackmail` refused only when `rung.how === 'auto'`. That is true of the nine countries
that elect their head of state and false of the one that appoints them — so in SZ a
single file on a colleague bought the Prime Ministership outright. The guard was
expressing "you cannot blackmail your way into the top job" and testing the mechanism
instead of the office. It tests `rung.id === 'hos'` now, in both `revolt.blackmail` and
the action's own `when`.

Closing that exposed the second half: **the intended path had never worked.** For `hos`
the bar was `46 + 13*2.6 + 26 + pressure*12` ≈ 115 against a maximum achievable score of
116, so the appointed route was unreachable in practice and the exploit was the only way
through. Three changes make it a real route:

- a vacancy is a **window** (`S.flags.vacancyCloses`), not a state that waits for you;
  when it closes, `closeVacancy()` seats somebody else and it is years before the next;
- **one decision per vacancy** (`S.flags.vacancyConsidered`), not one every quarter —
  eight rolls at 20% is an 80% chance nobody chose to take;
- the bar drops to `+2` and the spread widens to ±26 for that office only, because with
  ±16 the standing bands are further apart than the noise and the office is a step
  rather than a slope.

Measured on a Deputy PM during an open vacancy: **92 standing → 46%, 75 → 14%, 60 → 0%,
34 → 0%.** Demanding, reachable, and decided by standing.

### Standing finding: the top office is rare everywhere, and one mechanic is behind it

With SZ's exploit closed, careers reaching the top office across 1,000 Monte Carlo runs
sit at **3 in 1,000 (0.3%)** — statistically where it was before any of this work (5 in
1,000). The 67 in 1,000 briefly reported at 1.7.2 was almost entirely the SZ hole, not a
real gain; the genuine gain from the purge fix is in the *mid* ladder, where career-sim's
climb ceilings now spread out to t10 and t11 instead of clustering at t3–t4.

The knock-on was a Monte Carlo warning: **no constitutional amendment is ever attempted
in either cohort**, because amendments were president-only and nobody is president.
**1.19 opened the clause at cabinet.** Term limits stay palace paper. Devolve is what a
minister can table. The slider is gone. The coverage hole is a room.

### A shape to watch for: the one-way ratchet

Twice now a quantity meant to find a level has been written as a permanent
push, and both times it quietly wrecked something far away:

- `blocs.reads()` applied an unbounded monthly drift, so in any country with
  unemployment over thirty the young sat at zero for ever.
- `society.unrest`, `society.coup` and `society.stability` were step
  accumulators. South Africa opens at 32% unemployment, so unrest's "+0.4 while
  over thirty" never switched off and it pinned at 100; stability was only ever
  pushed *down*, by shocks and by broken promises, with one presidential action
  as the sole way back.

The economy block next to them had it right all along — `growth` and
`inflation` mean-revert toward the country's own figures via `pull()`, and
`govApproval` reverts toward a computed target. **If you are adding a national
quantity, give it a target and revert toward it.** A shock should hurt for a
year and be recoverable by fixing its cause; it should not be a tax nobody can
pay off.

Third instance, caught building the docket: `cast.rel` had nothing pulling it
back. That was harmless while the only thing that moved a relationship was
actually meeting somebody — you cannot meet the Chief Whip forty months running
— but the diary pushes 2–3 relationships *down every single month* whether or
not you engage with it, and a career is three hundred months. `cast.drift()` now
reverts every relationship toward zero at 2% a month once it has been six months
since you last sat with that person, and neglect has a floor: `cast.ding(S, p,
amount, floor)` will not push past −45 for silence or −70 for a cancellation.
Only things you did in front of somebody take it further than that.
Fourth instance, caught the same week: `trenches.favour` is pushed up by every
month of grinding and would otherwise never come down, which would make the
list a stopwatch rather than a relationship. It reverts 3% a month, so a branch
that stops seeing you forgets you.

**The general rule: before adding a per-turn push to any quantity, ask what the
equal and opposite pull is.**

Related: charge a *personal* failure to a national number only in proportion to
how national the player is. A broken promise used to take national stability
every five months for the rest of the career, at any tier — one ward
councillor's unbuilt borehole destabilising the republic about 126 times.

### Standing findings, recorded rather than fixed

- ~~The new content made the average career dirtier, and the purge noticed.~~
  **Wrong on both counts, and worth leaving here as a worked example of guessing instead
  of measuring.** `congressPurge` does not read `dirt` at all — it reads standing, allies
  and rival power — and the Monte Carlo picks event choices *uniformly at random* in both
  cohorts, so it takes the clean answer exactly as often as the dirty one. Neither half of
  that explanation survived a probe. What the probe actually found is written up under
  "Two dead terms and a bar set at the wrong height" below.

- **The route that reaches the presidency is the corrupt one.** The clean directed policy
  caps at tier 11. That may be the right politics, but it is a design choice nobody has
  explicitly made.
- **Medical collapse fires often** in long careers — about one every three and a half
  years over a 600-month run, which trips the Monte Carlo's own threshold. Predates the
  recent work; the horizon may simply be longer than the threshold was calibrated for.
- **The contender rarely reaches the top** (0% in short runs). The throne ending is
  covered by mechanics.mjs but may be too rare to matter at scale.

## After 1.19.0 — what is left

The clause met. The PC wrap that remains is a window around this tree, not a rewrite:

- Tauri (preferred: small binary, no Chrome bundle) or Electron
- Steam: one save directory, one window, one `.desktop`
- the same `localStorage` seed, already exportable as a file

Do not add ES modules. Do not add a new JS file unless the next system cannot
live on `RZ.state` / `RZ.gov`. Registering a new file is still five places.

The rule that holds all of this together: if it is not a meeting, it is not in
this game. GPS already exists, and people do not love it. This one they can finish.


