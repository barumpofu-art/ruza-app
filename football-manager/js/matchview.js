import { esc, crest, openSheet, closeSheet, toast, ratingBadge } from './dom.js';
import { ability } from './players.js';
import { startMatch, completeMatch, getTeam } from './state.js';
import { MENTALITIES } from './formations.js';

const SPEEDS = [
  { label: '1×', ms: 620 },
  { label: '2×', ms: 300 },
  { label: '4×', ms: 130 },
];

export function playMatch(app) {
  const sim = startMatch(app.state);
  if (!sim) { toast('No fixture to play.'); return; }

  const state = app.state;
  const userKey = sim.home.teamId === state.clubId ? 'home' : 'away';
  const homeTeam = getTeam(state, sim.home.teamId);
  const awayTeam = getTeam(state, sim.away.teamId);

  const root = document.createElement('div');
  root.className = 'match';
  root.innerHTML = shell(homeTeam, awayTeam);
  document.body.appendChild(root);
  document.body.style.overflow = 'hidden';

  const feed = root.querySelector('.feed');
  const view = {
    speed: 1,
    playing: true,
    timer: null,
    finished: false,
  };

  const els = {
    goals: root.querySelector('[data-goals]'),
    clock: root.querySelector('[data-clock]'),
    poss: root.querySelector('[data-poss]'),
    shots: root.querySelector('[data-shots]'),
    controls: root.querySelector('.match-controls'),
  };

  function paintHead() {
    els.goals.textContent = `${sim.home.goals}–${sim.away.goals}`;
    els.clock.textContent = sim.finished ? 'Full time' : `${sim.clock}'`;
    const hp = Math.round((sim.home.stats.possTicks / Math.max(1, sim.minute)) * 100);
    els.poss.innerHTML = `<span>Possession ${hp}% – ${100 - hp}%</span>
      <div class="bar"><i style="width:${hp}%"></i><i style="width:${100 - hp}%"></i></div>`;
    const hs = sim.home.stats.shots, as = sim.away.stats.shots;
    const total = Math.max(1, hs + as);
    els.shots.innerHTML = `<span>Shots ${hs} – ${as}</span>
      <div class="bar"><i style="width:${(hs / total) * 100}%"></i><i style="width:${(as / total) * 100}%"></i></div>`;
  }

  function addEvents(events) {
    for (const ev of events) {
      if (ev.type === 'chance' && Math.random() > 0.7) continue;
      const line = document.createElement('div');
      line.className = `ev ${ev.type}`;
      line.innerHTML = `<span class="min">${ev.type === 'kickoff' ? '' : `${ev.clock}'`}</span><span>${esc(ev.text)}</span>`;
      feed.appendChild(line);
    }
    while (feed.children.length > 220) feed.removeChild(feed.firstChild);
    feed.scrollTop = feed.scrollHeight;
  }

  function tick() {
    if (sim.finished) return;
    const events = sim.step();
    addEvents(events);
    paintHead();
    if (events.some((e) => e.type === 'halftime')) {
      pause();
      renderControls('halftime');
      return;
    }
    if (sim.finished) {
      finish();
    }
  }

  function play() {
    view.playing = true;
    clearInterval(view.timer);
    view.timer = setInterval(tick, SPEEDS[view.speed].ms);
    renderControls();
  }

  function pause() {
    view.playing = false;
    clearInterval(view.timer);
    view.timer = null;
    renderControls();
  }

  function skip() {
    pause();
    while (!sim.finished) {
      const events = sim.step();
      addEvents(events);
    }
    paintHead();
    finish();
  }

  function finish() {
    clearInterval(view.timer);
    view.finished = true;
    paintHead();
    addEvents([]);
    renderSummary();
    renderControls('fulltime');
  }

  function renderSummary() {
    const result = sim.result();
    const side = userKey === 'home' ? result.home : result.away;
    const opp = userKey === 'home' ? result.away : result.home;
    const rows = side.players
      .filter((p) => p.minutes > 0)
      .sort((a, b) => b.rating - a.rating)
      .map((p) => `
        <div class="prow" style="cursor:default">
          <span class="pos ${p.pos}">${p.role}</span>
          <span class="who"><b>${esc(p.name)}</b><small>${p.minutes}'${p.goals ? ` · ${p.goals} goal${p.goals > 1 ? 's' : ''}` : ''}${p.assists ? ` · ${p.assists} assist${p.assists > 1 ? 's' : ''}` : ''}${p.yellow ? ' · booked' : ''}${p.red ? ' · sent off' : ''}${p.injuryDays ? ` · ${esc(p.injuryNote)}` : ''}</small></span>
          <span></span>
          <span class="rating">${ratingBadge(p.rating)}</span>
        </div>`).join('');

    const summary = document.createElement('div');
    summary.innerHTML = `
      <div class="section-title">Your ratings</div>
      <div class="card tight">${rows}</div>
      <div class="section-title">Match stats</div>
      <div class="card">
        <div class="kv"><span>Possession</span><strong>${side.possession}% – ${opp.possession}%</strong></div>
        <div class="kv"><span>Shots (on target)</span><strong>${side.shots} (${side.onTarget}) – ${opp.shots} (${opp.onTarget})</strong></div>
        <div class="kv"><span>Expected goals</span><strong>${side.xg.toFixed(2)} – ${opp.xg.toFixed(2)}</strong></div>
        <div class="kv"><span>Fouls</span><strong>${side.fouls} – ${opp.fouls}</strong></div>
        <div class="kv"><span>Cards</span><strong>${side.yellow}Y ${side.red}R – ${opp.yellow}Y ${opp.red}R</strong></div>
      </div>`;
    feed.appendChild(summary);
    feed.scrollTop = feed.scrollHeight;
  }

  function renderControls(mode) {
    if (mode === 'fulltime') {
      els.controls.innerHTML = `<button class="btn primary" data-match="continue">Continue</button>`;
      return;
    }
    if (mode === 'halftime') {
      els.controls.innerHTML = `
        <button class="btn" data-match="subs">Subs</button>
        <button class="btn" data-match="shout">Talk</button>
        <button class="btn primary" data-match="resume">Second half</button>`;
      return;
    }
    els.controls.innerHTML = `
      <button class="btn" data-match="playpause">${view.playing ? 'Pause' : 'Play'}</button>
      <button class="btn" data-match="speed">${SPEEDS[view.speed].label}</button>
      <button class="btn" data-match="subs">Subs</button>
      <button class="btn" data-match="skip">Skip</button>`;
  }

  function subsSheet() {
    const wasPlaying = view.playing;
    pause();
    const on = sim.onPitchFor(userKey);
    const bench = sim.benchFor(userKey);
    let out = null;

    const render = () => `
      <h2>Substitutions</h2>
      <p class="sub">${sim.sideOf(userKey).subsUsed}/5 used. Pick a player to come off, then his replacement.</p>
      <div class="section-title">On the pitch</div>
      <div class="card tight">${on.map((r) => `
        <button class="prow" data-sub-out="${r.id}" ${out === r.id ? 'style="background:rgba(242,193,78,.12)"' : ''}>
          <span class="pos ${r.p.pos}">${r.role}</span>
          <span class="who"><b>${esc(r.p.name)}</b><small>${Math.round(r.condition)}% fit${r.yellow ? ' · booked' : ''}${r.injuryDays ? ' · injured' : ''}</small></span>
          <span></span>
          <span class="rating">${Math.round(r.rating * 10) / 10}</span>
        </button>`).join('')}</div>
      <div class="section-title">Bench</div>
      <div class="card tight">${bench.length ? bench.map((r) => `
        <button class="prow" data-sub-in="${r.id}">
          <span class="pos ${r.p.pos}">${r.p.pos}</span>
          <span class="who"><b>${esc(r.p.name)}</b><small>${Math.round(r.condition)}% fit · ability ${ability(r.p)}</small></span>
          <span></span>
          <span class="rating">${ability(r.p)}</span>
        </button>`).join('') : '<p class="empty">Nobody left on the bench.</p>'}</div>
      <button class="btn wide ghost" data-match="close">Back to the match</button>`;

    const sheet = openSheet(render(), (el) => {
      el.addEventListener('click', (e) => {
        const outBtn = e.target.closest('[data-sub-out]');
        const inBtn = e.target.closest('[data-sub-in]');
        const close = e.target.closest('[data-match="close"]');
        if (close) { closeSheet(); if (wasPlaying) play(); return; }
        if (outBtn) {
          out = Number(outBtn.dataset.subOut);
          el.querySelectorAll('[data-sub-out]').forEach((b) => {
            b.style.background = Number(b.dataset.subOut) === out ? 'rgba(242,193,78,.12)' : '';
          });
          toast('Now choose his replacement.');
          return;
        }
        if (inBtn) {
          if (!out) { toast('Choose who comes off first.'); return; }
          const ok = sim.substitute(userKey, out, Number(inBtn.dataset.subIn));
          if (!ok) { toast('That change cannot be made.'); return; }
          addEvents(sim.events.slice(-1));
          closeSheet();
          if (wasPlaying) play(); else renderControls(sim.pendingHalfTime ? 'halftime' : undefined);
        }
      });
    });
    return sheet;
  }

  function shoutSheet() {
    const current = sim.sideOf(userKey).tactics.mentality;
    openSheet(`
      <h2>Team talk</h2>
      <p class="sub">Change the approach for the rest of the match.</p>
      <div class="seg">${MENTALITIES.map((m) => `
        <button class="chip" aria-pressed="${m.id === current}" data-shout="${m.id}">${m.name}</button>`).join('')}</div>
      <p class="tiny muted" style="margin-top:10px">This only applies to today. Your saved tactics are untouched.</p>
      <button class="btn wide ghost" style="margin-top:12px" data-match="close">Back</button>
    `, (el) => {
      el.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-shout]');
        if (chip) {
          sim.setTactics(userKey, { mentality: chip.dataset.shout });
          addEvents(sim.events.slice(-1));
          toast(`Approach: ${chip.textContent}`);
          closeSheet();
          renderControls(sim.pendingHalfTime ? 'halftime' : undefined);
          return;
        }
        if (e.target.closest('[data-match="close"]')) closeSheet();
      });
    });
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-match]');
    if (!btn) return;
    switch (btn.dataset.match) {
      case 'playpause': view.playing ? pause() : play(); break;
      case 'speed': view.speed = (view.speed + 1) % SPEEDS.length; if (view.playing) play(); else renderControls(); break;
      case 'skip': skip(); break;
      case 'subs': subsSheet(); break;
      case 'shout': shoutSheet(); break;
      case 'resume': play(); break;
      case 'continue': close(); break;
    }
  });

  function close() {
    clearInterval(view.timer);
    closeSheet();
    root.remove();
    document.body.style.overflow = '';
    completeMatch(app.state, sim);
    app.save(true);   // ninety minutes is too much to lose to a debounce
    app.go('home');
  }

  paintHead();
  addEvents(sim.events);
  renderControls();
  play();
}

function shell(homeTeam, awayTeam) {
  return `
    <div class="match-head">
      <div class="scoreline">
        <div class="club">${crest(homeTeam)}<b>${esc(homeTeam.name)}</b></div>
        <div>
          <div class="goals" data-goals>0–0</div>
          <div class="clock" data-clock>0'</div>
        </div>
        <div class="club">${crest(awayTeam)}<b>${esc(awayTeam.name)}</b></div>
      </div>
      <div class="matchstats">
        <div data-poss></div>
        <div data-shots></div>
      </div>
    </div>
    <div class="feed"></div>
    <div class="match-controls"></div>`;
}
