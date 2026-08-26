# Kgosi & Cadre

A text-based political career simulator set in southern Africa. You start as an unpaid
ward activist and try to reach the highest office your country's constitution allows.

Built as a single static, offline-capable web app. No build step, no dependencies, no
network calls. Open `index.html` — or serve the folder and add it to a phone's home screen.

## Countries

Ten states, each with its own constitution, electoral system, economy and ceiling:

| | System | Legislature | Head of state | Climb |
|---|---|---|---|---|
| 🇧🇼 Botswana | Parliamentary | 61 seats, FPTP | Elected by the Assembly | Hard |
| 🇿🇦 South Africa | Parliamentary | 400 seats, closed-list PR | Elected by the Assembly | Brutal |
| 🇿🇲 Zambia | Presidential | 156 seats, FPTP | Direct, 50%+1 with run-off | Brutal |
| 🇳🇦 Namibia | Presidential | 96 seats, national-list PR | Direct, 50%+1 with run-off | Brutal |
| 🇿🇼 Zimbabwe | Presidential | 210 seats, FPTP | Direct, 50%+1 with run-off | Merciless |
| 🇲🇼 Malawi | Presidential | 193 seats, FPTP | Direct, 50%+1 with re-run | Hard |
| 🇱🇸 Lesotho | Parliamentary monarchy | 120 seats, MMP | Prime Minister | Reachable |
| 🇲🇿 Mozambique | Presidential | 250 seats, provincial-list PR | Direct | Brutal |
| 🇦🇴 Angola | Presidential | 220 seats, list PR | Head of the winning list | Merciless |
| 🇸🇿 Eswatini | Absolute monarchy | 59 Tinkhundla seats, non-party | Appointed by the King | Hard |

The electoral system is not decoration. Under closed-list PR you never face a voter —
you face a list committee, and the party can end your career without consulting anyone.
Under FPTP a ruling-party activist in an opposition stronghold cannot win a seat at all,
so you move, or you defect. Under the Tinkhundla system there are no parties and the top
job is never yours to contest.

## The loop

One turn is one month. You get three to five actions, then the month turns: the economy
moves, rivals move, and something happens to you.

**Climbing.** Thirteen rungs, from ward activist to head of state. Each is won a different
way — a show of hands in a branch meeting, a delegate count at national conference, a
public ballot, or a phone call from the principal on a Sunday evening that you can only
make more likely, never demand.

**Standing** (grassroots, party, leadership, media, business, security, international) is
rented, not owned: the higher it is, the more it costs each month to hold. You cannot
maintain all seven.

**Scandal.** Everything you do that would embarrass you goes into a file with a severity.
Files come out — faster where the press is free and the courts work. Exposure blocks
appointments, and appointments are how the middle of the ladder works. Scandals fade with
time and can be worked off, but the ledger is long.

**Elections** are simulated properly: regional vote projection from economy, approval,
leader quality and campaign effort; seats allocated by cube-law FPTP, D'Hondt PR, or MMP
top-up; coalition formation when nobody wins; presidential run-offs with second-round
transfers. Where the count is riggable and you control enough of the machine, you will be
offered the chance — with a real probability of being caught.

**Governing.** As head of state you table a budget, appoint judges, reshuffle, negotiate
with the Fund, and eventually face the question of whether to leave when the constitution
says to. The answer is worth more to your legacy than anything else you do.

## Files

```
index.html            screens and shell
app.css               all styling; dark, mobile-first
manifest.webmanifest  installable to a phone home screen
sw.js                 offline cache (bump CACHE on release)
js/core.js            seeded RNG (mulberry32) and helpers
js/data-countries.js  the ten countries: regions, seats, parties, institutions, economies
js/data-ladder.js     the thirteen rungs and their per-country titles
js/data-actions.js    the monthly action deck
js/data-events.js     the event deck
js/people.js          invented politicians, name pools, starting backgrounds
js/elections.js       vote projection, seat allocation, coalitions, internal contests
js/engine.js          state, the monthly loop, the action API, promotion and danger
js/governance.js      the presidency, budgets, election night, legacy and obituary
js/ui.js              rendering
js/main.js            bootstrap and flow control
```

Careers are saved to `localStorage` after every turn. The RNG is seeded, so a career is
reproducible from its seed.

## A note on realism

Countries, institutions, electoral systems and party names are real. **Every person in
this game is invented** — the rivals, patrons, journalists and party leaders are generated
from name pools, and nothing here describes or alleges anything about a real individual.

Numeric values (vote shares, institutional indices, growth rates) are simulation
parameters chosen so the model behaves plausibly. They are tuned for play and should not
be read as reported statistics.
