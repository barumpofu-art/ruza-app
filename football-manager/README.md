# Kalahari Manager

A football management game that runs in a phone browser. No install, no account,
no network calls — the whole game is static files and a save in `localStorage`.

Play it by opening `index.html` from a web server (ES modules will not load from
`file://`).

```sh
npx http-server -p 8899 -c-1 .    # then open http://localhost:8899/
```

## The game

You take over one of twelve clubs in the Kalahari Premiership and try to keep
the job. A season is 22 matchdays, home and away against everyone else. Finish
in the bottom two and you go down — and go home.

- **Selection** — a pitch view for the eleven and the bench. Tap a player to
  pick him up, tap another to swap. Ability, fitness and availability are on
  every shirt.
- **Tactics** — six formations, plus mentality, pressing and tempo, each of
  which the match engine actually reads. The strength bars compare your eleven
  with the next opponent's.
- **Matches** — simulated minute by minute with running commentary, live
  possession and shot counts, substitutions and a half-time talk. Watch at three
  speeds, skip to the end, or take the instant result.
- **The squad** — players have six attributes, condition, morale, form,
  contracts and a market value. They tire, get injured, get suspended, improve
  in training when they are young, and decline when they are not.
- **The club** — gate receipts, sponsorship, the wage bill, prize money, a
  transfer market that opens in pre-season and mid-season, and a board whose
  confidence you can watch drain away.

Seasons roll over: players age, some retire, contracts expire, the bottom two
are replaced by promoted clubs, and the board sets a new target.

## Layout

```
index.html          app shell
styles.css          all styling, dark and phone-first
js/rng.js           seeded random number generator
js/data.js          clubs and name pools
js/players.js       player generation, ratings, value, development
js/formations.js    formation shapes and the tactical options
js/lineup.js        automatic team selection
js/engine.js        the match engine (a stepper, so matches can be watched)
js/league.js        fixtures, table, stat tables
js/state.js         the game itself: seasons, money, training, transfers, board
js/storage.js       localStorage save/load
js/dom.js           small DOM helpers
js/screens.js       screen rendering
js/matchview.js     the live match view
js/main.js          bootstrap, routing, actions
```

## Tests

```sh
node test/engine-test.mjs 1000   # scoreline, discipline and fatigue distributions
node test/season-test.mjs 5      # plays whole seasons and checks league integrity
node test/ui-smoke.mjs           # drives the real UI in Chromium (needs a server on :8899)
```

`engine-test` is a calibration check rather than a pass/fail test: it should
report roughly 2.7–2.9 goals a game, a home win share in the low forties, about
21 shots, three or four yellows and around one red every ten games.
