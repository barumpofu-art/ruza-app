import { $, esc, crest, setHTML, toast, openSheet, closeSheet } from './dom.js';
import { CLUBS } from './data.js';
import { ability, isAvailable, shortName } from './players.js';
import * as store from './storage.js';
import {
  newGame, userTeam, setFormation, autoSelect, ensureSelection,
  setTraining, signPlayer, sellPlayer, saleOffer, renewContract, quickPlayRound,
} from './state.js';
import {
  renderScreen, renderTopbar, playerSheet, marketSheet, newsSheet, allNewsSheet,
  clubInfoSheet, sellSheet, gameOverScreen,
} from './screens.js';
import { playMatch } from './matchview.js';

const TABS = [
  { id: 'home', label: 'Home', icon: 'M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z' },
  { id: 'squad', label: 'Squad', icon: 'M9 2L4 4v6h3v12h10V10h3V4l-5-2a3 3 0 01-6 0z' },
  { id: 'tactics', label: 'Tactics', icon: 'M3 4h18v16H3V4zm2 2v12h14V6H5zm6 0h2v12h-2V6z' },
  { id: 'league', label: 'League', icon: 'M4 5h16v3H4zm0 5.5h16v3H4zM4 16h16v3H4z' },
  { id: 'club', label: 'Club', icon: 'M3 8h18v12H3zm5-4h8v4H8zm3 8h2v4h-2z' },
];

const app = {
  state: null,
  route: 'home',
  squadView: 'pitch',
  leagueTab: 'table',
  fixtureRound: null,
  selection: null,
  saveTimer: null,

  go(route) {
    this.route = route;
    this.selection = null;
    render();
    window.scrollTo(0, 0);
  },

  refresh() { render(); },

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => store.save(this.state), 200);
  },
};

// Boot ------------------------------------------------------------------------

function boot() {
  const saved = store.load();
  if (saved) {
    app.state = saved;
    ensureSelection(userTeam(saved));
    render();
  } else {
    startScreen();
  }
  document.addEventListener('click', onClick);
  registerServiceWorker();
  if (!store.persistent()) {
    setTimeout(() => toast('This browser will not let the page save — progress lasts until you close it.'), 1200);
  }
}

// Offline support when the game is served over http(s). A page opened straight
// from a file has no service worker, and does not need one.
function registerServiceWorker() {
  if (!/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker?.register('sw.js').catch(() => { /* offline support is optional */ });
}

function startScreen() {
  const appEl = $('#app');
  appEl.hidden = true;
  const existing = document.querySelector('.start-wrap');
  existing?.remove();

  const wrap = document.createElement('div');
  wrap.className = 'start-wrap';
  wrap.innerHTML = `
    <div class="start">
      <h1>Kalahari <span>Manager</span></h1>
      <p class="lede">Twelve clubs, twenty-two matchdays, one job to keep. Pick the side, set the tactics, live the ninety minutes.</p>

      <div class="field">
        <label for="mgr">Your name</label>
        <input id="mgr" type="text" maxlength="26" placeholder="The Gaffer" autocomplete="off">
      </div>

      <label class="tiny" style="display:block;text-transform:uppercase;letter-spacing:.08em;color:var(--text-faint);font-weight:700;margin-bottom:8px">Choose a club</label>
      <div class="clubpick">
        ${CLUBS.map((c) => `
          <button class="clubopt" aria-pressed="false" data-club="${c.id}">
            ${crest(c)}
            <span class="info">
              <b>${esc(c.name)}</b>
              <small>${esc(c.stadium)} · ${c.capacity.toLocaleString()} seats · ${difficulty(c.rep)}</small>
            </span>
            <span class="pill ${c.rep >= 74 ? 'gold' : ''}">${c.rep}</span>
          </button>`).join('')}
      </div>

      <button class="btn primary wide big" style="margin-top:18px" data-start disabled>Pick a club to begin</button>
      <p class="tiny muted" style="margin-top:12px">Everything is saved on this device. Nothing is uploaded anywhere.</p>
    </div>`;
  document.body.appendChild(wrap);

  let chosen = null;
  wrap.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-club]');
    const start = e.target.closest('[data-start]');
    if (opt) {
      chosen = opt.dataset.club;
      wrap.querySelectorAll('[data-club]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.club === chosen)));
      const btn = wrap.querySelector('[data-start]');
      btn.disabled = false;
      btn.textContent = `Take charge of ${CLUBS.find((c) => c.id === chosen).name}`;
      return;
    }
    if (start && chosen) {
      const name = wrap.querySelector('#mgr').value;
      app.state = newGame({ clubId: chosen, managerName: name, seed: Date.now() % 2147483647 });
      store.save(app.state);
      wrap.remove();
      app.route = 'home';
      render();
    }
  });
}

function difficulty(rep) {
  if (rep >= 80) return 'Expected to win it all';
  if (rep >= 66) return 'Chasing the title';
  if (rep >= 52) return 'Solid mid-table';
  return 'Scrapping to stay up';
}

// Render -----------------------------------------------------------------------

function render() {
  const appEl = $('#app');
  appEl.hidden = false;

  if (app.state.gameOver) {
    $('#topbar').innerHTML = '';
    $('#tabs').innerHTML = '';
    setHTML($('#view'), gameOverScreen(app));
    return;
  }

  ensureSelection(userTeam(app.state));
  setHTML($('#topbar'), renderTopbar(app));
  setHTML($('#view'), renderScreen(app));
  setHTML($('#tabs'), TABS.map((t) => `
    <button class="tab" data-action="tab:${t.id}" ${app.route === t.id ? 'aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24"><path d="${t.icon}" fill-rule="evenodd"/></svg>
      ${t.label}
      ${t.id === 'home' && unread() ? `<span class="badge">${unread()}</span>` : ''}
    </button>`).join(''));
}

const unread = () => app.state.news.filter((n) => !n.read).length;

// Actions -------------------------------------------------------------------------

function onClick(event) {
  const el = event.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const [action, arg] = el.dataset.action.split(':');
  const club = app.state ? userTeam(app.state) : null;

  switch (action) {
    case 'tab': app.go(arg); return;

    case 'play-match':
      closeSheet();
      playMatch(app);
      return;

    case 'quick-match': {
      const result = quickPlayRound(app.state);
      app.save();
      app.go('home');
      if (result) toast(`${result.outcome === 'W' ? 'Won' : result.outcome === 'D' ? 'Drew' : 'Lost'} ${result.own}-${result.opp} ${result.isHome ? 'at home to' : 'away to'} ${result.opponentName}`);
      return;
    }

    case 'news': {
      const item = app.state.news.find((n) => n.id === Number(arg));
      if (!item) return;
      item.read = true;
      app.save();
      openSheet(newsSheet(app, item));
      render();
      return;
    }

    case 'all-news':
      app.state.news.forEach((n) => { n.read = true; });
      app.save();
      openSheet(allNewsSheet(app));
      render();
      return;

    case 'squad-view':
      app.squadView = arg;
      app.selection = null;
      render();
      return;

    case 'auto-pick':
      autoSelect(club);
      app.selection = null;
      app.save();
      render();
      toast('Strongest available eleven picked.');
      return;

    case 'slot': {
      const index = Number(arg);
      const sel = app.selection;
      if (sel?.kind === 'slot' && sel.index === index) {
        const id = club.lineup[index];
        app.selection = null;
        render();
        if (id) openSheet(playerSheet(app, id));
        return;
      }
      if (sel?.kind === 'slot') {
        const j = sel.index;
        [club.lineup[index], club.lineup[j]] = [club.lineup[j], club.lineup[index]];
        app.selection = null;
      } else if (sel?.kind === 'bench') {
        const benchIndex = club.bench.indexOf(sel.id);
        const outId = club.lineup[index];
        club.lineup[index] = sel.id;
        if (benchIndex >= 0) club.bench[benchIndex] = outId;
        app.selection = null;
      } else {
        app.selection = { kind: 'slot', index };
      }
      app.save();
      render();
      return;
    }

    case 'benchpick': {
      const id = Number(arg);
      const sel = app.selection;
      if (sel?.kind === 'bench' && sel.id === id) {
        app.selection = null;
        render();
        openSheet(playerSheet(app, id));
        return;
      }
      if (sel?.kind === 'slot') {
        const benchIndex = club.bench.indexOf(id);
        const outId = club.lineup[sel.index];
        club.lineup[sel.index] = id;
        if (benchIndex >= 0) club.bench[benchIndex] = outId;
        app.selection = null;
      } else if (sel?.kind === 'bench') {
        const a = club.bench.indexOf(sel.id);
        const b = club.bench.indexOf(id);
        [club.bench[a], club.bench[b]] = [club.bench[b], club.bench[a]];
        app.selection = null;
      } else {
        app.selection = { kind: 'bench', id };
      }
      app.save();
      render();
      return;
    }

    case 'player':
      openSheet(playerSheet(app, Number(arg)));
      return;

    case 'select-xi': {
      const id = Number(arg);
      closeSheet();
      if (club.lineup.includes(id)) demote(club, id);
      else promote(club, id);
      app.save();
      render();
      return;
    }

    case 'toggle-bench': {
      const id = Number(arg);
      closeSheet();
      if (club.lineup.includes(id)) { toast('He is in the starting eleven.'); return; }
      if (club.bench.includes(id)) {
        club.bench = club.bench.filter((b) => b !== id);
        toast('Removed from the bench.');
      } else if (club.bench.length >= 7) {
        toast('The bench is full — drop someone first.');
      } else {
        club.bench.push(id);
        toast('Named as a substitute.');
      }
      app.save();
      render();
      return;
    }

    case 'formation':
      setFormation(club, arg);
      app.save();
      render();
      return;

    case 'mentality':
    case 'pressing':
    case 'tempo':
      club.tactics[action] = arg;
      app.save();
      render();
      return;

    case 'toggle-autosubs':
      app.state.settings.autoSubs = !app.state.settings.autoSubs;
      app.save();
      render();
      return;

    case 'league-tab':
      app.leagueTab = arg;
      app.fixtureRound = null;
      render();
      return;

    case 'round':
      app.fixtureRound = Number(arg);
      render();
      return;

    case 'club-info':
      openSheet(clubInfoSheet(app, arg));
      return;

    case 'train-focus':
      setTraining(app.state, { focus: arg });
      app.save();
      render();
      return;

    case 'train-intensity':
      setTraining(app.state, { intensity: arg });
      app.save();
      render();
      return;

    case 'market':
      openSheet(marketSheet(app));
      return;

    case 'sign': {
      const outcome = signPlayer(app.state, Number(arg));
      toast(outcome.message);
      app.save();
      if (outcome.ok) { closeSheet(); render(); openSheet(marketSheet(app)); }
      return;
    }

    case 'sell':
      closeSheet();
      openSheet(sellSheet(app, Number(arg)));
      return;

    case 'confirm-sell': {
      const id = Number(arg);
      const offer = saleOffer(app.state, id);
      const outcome = sellPlayer(app.state, id, offer);
      toast(outcome.message);
      closeSheet();
      app.save();
      render();
      return;
    }

    case 'renew': {
      const outcome = renewContract(app.state, Number(arg));
      toast(outcome.message);
      app.save();
      closeSheet();
      render();
      return;
    }

    case 'new-game':
      openSheet(`
        <h2>Start a new career?</h2>
        <p class="sub">This deletes your current save. There is no way back.</p>
        <button class="btn danger wide" data-action="new-game-now">Delete and start again</button>
        <button class="btn wide ghost" style="margin-top:8px" data-action="close-sheet">Keep playing</button>`);
      return;

    case 'new-game-now':
      closeSheet();
      store.clear();
      app.state = null;
      $('#app').hidden = true;
      startScreen();
      return;

    case 'close-sheet':
      closeSheet();
      return;
  }
}

// Selection helpers --------------------------------------------------------------

function promote(club, id) {
  const player = club.squad.find((p) => p.id === id);
  if (!player) return;
  const xi = club.lineup.map((pid) => club.squad.find((p) => p.id === pid));
  // Replace the weakest player in the same position, or the weakest overall.
  let index = -1;
  let worst = Infinity;
  xi.forEach((p, i) => {
    if (!p) { index = i; worst = -Infinity; return; }
    const samePos = p.pos === player.pos;
    const value = ability(p) + (samePos ? 0 : 40) + (isAvailable(p) ? 0 : -60);
    if (value < worst) { worst = value; index = i; }
  });
  if (index < 0) return;
  const outId = club.lineup[index];
  club.lineup[index] = id;
  club.bench = club.bench.filter((b) => b !== id);
  if (outId && !club.bench.includes(outId) && club.bench.length < 7) club.bench.push(outId);
  toast(`${shortName(player)} starts.`);
}

function demote(club, id) {
  const index = club.lineup.indexOf(id);
  if (index < 0) return;
  const player = club.squad.find((p) => p.id === id);
  const replacement = club.bench
    .map((bid) => club.squad.find((p) => p.id === bid))
    .filter((p) => p && isAvailable(p))
    .sort((a, b) => (b.pos === player.pos ? 1 : 0) - (a.pos === player.pos ? 1 : 0) || ability(b) - ability(a))[0];
  if (!replacement) { toast('Nobody on the bench to replace him.'); return; }
  club.lineup[index] = replacement.id;
  club.bench = club.bench.map((b) => (b === replacement.id ? id : b));
  toast(`${shortName(player)} drops to the bench.`);
}

boot();
