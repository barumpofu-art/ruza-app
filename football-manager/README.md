# Kalahari Manager

A football management game that runs in a phone browser. No install, no account,
no network calls — the whole game is static files and a save in `localStorage`.

## Getting it onto a phone

**One file, no server.** `kalahari-manager.html` is the whole game — markup,
styling and code — in a single 157kb file. Save it to a phone's Downloads and
open it; it plays offline and keeps your save in the browser. Rebuild it after
changing anything with `node build/build-offline.mjs`.

**Install it like an app.** Served over http(s), the game is a PWA: a manifest,
an icon and a service worker that caches everything. In Chrome on Android use
*Install app* (or *Add to Home screen*); it gets its own icon, opens full screen
and runs with no connection. On iOS, Share → *Add to Home Screen*.

**An APK.** `android/` is a WebView wrapper around exactly these files: one
activity, no libraries, no Kotlin, and the game copied in as assets by Gradle.
The GitHub Actions workflow `.github/workflows/android-apk.yml` builds it on
every push and uploads `kalahari-manager.apk` as a run artifact — download it
from the run's Artifacts section and sideload it (Android will ask you to allow
installs from that source). Locally, with the Android SDK installed:

```sh
cd android && ./gradlew assembleDebug     # app/build/outputs/apk/debug/
```

The APK carries no code of its own beyond the shell: assets are served to the
WebView from a virtual `https://appassets.androidplatform.net` origin, so the
page is a secure context with a real, persistent `localStorage` for your save.
It asks for `INTERNET` because WebView needs it to load that origin; the game
never makes a request that leaves the APK.

**Running it locally** needs a web server, because ES modules will not load from
`file://` (the single-file build above is the exception — it has no imports):

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
manifest.webmanifest, sw.js, icon-*.png   installable, offline-capable PWA
kalahari-manager.html                     single-file offline build
build/              offline bundle and icon generation
android/            WebView wrapper project for the APK
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
node test/offline-test.mjs       # opens the single-file build over file:// and plays a match
```

`engine-test` is a calibration check rather than a pass/fail test: it should
report roughly 2.7–2.9 goals a game, a home win share in the low forties, about
21 shots, three or four yellows and around one red every ten games.
