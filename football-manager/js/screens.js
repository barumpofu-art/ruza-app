import { esc, crest, meter, conditionMeter, formRun, ratingBadge } from './dom.js';
import { ability, seasonRating, shortName, isAvailable } from './players.js';
import { FORMATION_NAMES, MENTALITIES, PRESSING, TEMPO, slotsOf } from './formations.js';
import { matchSide } from './lineup.js';
import { strengthPreview } from './engine.js';
import { buildTable, topScorers, bestRated, positionOf } from './league.js';
import {
  getTeam, userTeam, money, roundsInSeason, nextFixture, wageBill, squadValue,
  windowOpen, transferOffer, saleOffer, findPlayer, TRAINING_FOCUS, TRAINING_INTENSITY,
  SQUAD_MAX,
} from './state.js';

const POS_GROUPS = [['GK', 'Goalkeepers'], ['DF', 'Defenders'], ['MF', 'Midfielders'], ['FW', 'Forwards']];

export function renderScreen(app) {
  switch (app.route) {
    case 'squad': return squadScreen(app);
    case 'tactics': return tacticsScreen(app);
    case 'league': return leagueScreen(app);
    case 'club': return clubScreen(app);
    default: return homeScreen(app);
  }
}

export function renderTopbar(app) {
  const s = app.state;
  const club = userTeam(s);
  const standings = buildTable(s.teams, s.fixtures);
  const pos = positionOf(standings, club.id);
  const rounds = roundsInSeason(s);
  const played = standings.find((r) => r.id === club.id)?.played ?? 0;
  return `
    <div class="topbar-row">
      ${crest(club)}
      <div class="topbar-club">
        <div class="topbar-name">${esc(club.name)}</div>
        <div class="topbar-sub">Season ${s.season} · MD ${Math.min(s.round, rounds)}/${rounds} · ${played ? ordinal(pos) : 'Pre-season'}</div>
      </div>
      <div class="topbar-cash">
        <strong>${money(club.finances.balance)}</strong>
        <span>${money(wageBill(club))}/wk wages</span>
      </div>
    </div>`;
}

// Home ------------------------------------------------------------------------

function homeScreen(app) {
  const s = app.state;
  const club = userTeam(s);
  const fixture = nextFixture(s);
  const standings = buildTable(s.teams, s.fixtures);
  const myRow = standings.find((r) => r.id === club.id);

  const injured = club.squad.filter((p) => p.injuryDays > 0);
  const suspended = club.squad.filter((p) => p.suspension > 0);
  const avgCondition = club.squad.reduce((t, p) => t + p.condition, 0) / club.squad.length;
  const avgMorale = club.squad.reduce((t, p) => t + p.morale, 0) / club.squad.length;

  return `
    ${nextMatchCard(app, fixture)}
    ${s.lastResult ? lastResultCard(app) : ''}

    <div class="section-title">Dressing room</div>
    <div class="card">
      <div class="kv"><span>Squad fitness</span><strong>${Math.round(avgCondition)}%</strong></div>
      ${meter(avgCondition)}
      <div class="kv" style="margin-top:10px"><span>Morale</span><strong>${moraleWord(avgMorale)}</strong></div>
      ${meter(avgMorale, 'gold')}
      <hr class="sep">
      <div class="rowwrap">
        <span class="pill ${injured.length ? 'bad' : ''}">${injured.length} injured</span>
        <span class="pill ${suspended.length ? 'warn' : ''}">${suspended.length} suspended</span>
        <span class="pill">${club.squad.length} players</span>
        <span class="pill">${club.tactics.formation}</span>
      </div>
      ${injured.length ? `<p class="tiny muted" style="margin:10px 0 0">${injured.slice(0, 4).map((p) => `${esc(shortName(p))} (${p.injuryDays}d)`).join(' · ')}${injured.length > 4 ? ` +${injured.length - 4} more` : ''}</p>` : ''}
    </div>

    <div class="section-title">Board</div>
    <div class="card">
      <div class="spread"><span class="muted tiny">Confidence</span><strong>${Math.round(s.board.confidence)}%</strong></div>
      ${meter(s.board.confidence, s.board.confidence < 30 ? '' : 'gold')}
      <p class="tiny muted" style="margin:10px 0 0">Target: ${esc(s.board.expectationText)}. ${myRow.played ? `You are ${ordinal(myRow.position)} on ${myRow.points} points.` : 'The season has not kicked off yet.'}</p>
    </div>

    <div class="section-title">Inbox</div>
    <div class="card tight">
      ${s.news.length ? s.news.slice(0, 6).map(newsRow).join('') : '<p class="empty">Nothing new.</p>'}
    </div>
    ${s.news.length > 6 ? `<button class="btn wide ghost" data-action="all-news">All news (${s.news.length})</button>` : ''}
  `;
}

function nextMatchCard(app, fixture) {
  const s = app.state;
  const club = userTeam(s);
  if (!fixture) {
    return `<div class="card">
      <div class="section-title" style="margin-top:0">Season complete</div>
      <p class="tiny muted">Every fixture has been played. The board are reviewing the season.</p>
    </div>`;
  }
  const isHome = fixture.homeId === club.id;
  const opponent = getTeam(s, isHome ? fixture.awayId : fixture.homeId);
  const standings = buildTable(s.teams, s.fixtures);
  const oppRow = standings.find((r) => r.id === opponent.id);

  return `
    <div class="card">
      <div class="spread" style="margin-bottom:6px">
        <span class="pill gold">Matchday ${fixture.round}</span>
        <span class="tiny muted">${isHome ? `${esc(club.stadium)}` : `Away at ${esc(opponent.stadium)}`}</span>
      </div>
      <div class="fixture">
        <div class="side">${crest(isHome ? club : opponent, 'sm')}<span>${esc((isHome ? club : opponent).name)}</span></div>
        <div class="score">v</div>
        <div class="side away">${crest(isHome ? opponent : club, 'sm')}<span>${esc((isHome ? opponent : club).name)}</span></div>
      </div>
      <div class="spread tiny muted" style="margin:8px 0 12px">
        <span>${esc(opponent.abbr)}: ${ordinal(oppRow.position)}, ${oppRow.points} pts</span>
        ${formRun(oppRow.form)}
      </div>
      <button class="btn primary wide big" data-action="play-match">Play match</button>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn ghost" data-action="quick-match">Instant result</button>
        <button class="btn ghost" data-action="tab:squad">Team selection</button>
      </div>
    </div>`;
}

function lastResultCard(app) {
  const r = app.state.lastResult;
  const club = userTeam(app.state);
  const opponent = getTeam(app.state, r.opponentId);
  const label = r.outcome === 'W' ? 'good' : r.outcome === 'D' ? '' : 'bad';
  return `
    <div class="section-title">Last match</div>
    <div class="card">
      <div class="spread">
        <span class="pill ${label}">${r.outcome === 'W' ? 'Win' : r.outcome === 'D' ? 'Draw' : 'Defeat'}</span>
        <span class="tiny muted">Matchday ${r.round}${r.isHome ? ' · Home' : ' · Away'}</span>
      </div>
      <div class="fixture" style="margin-top:6px">
        <div class="side">${crest(r.isHome ? club : opponent, 'sm')}<span>${esc((r.isHome ? club : opponent).abbr)}</span></div>
        <div class="score">${r.isHome ? r.own : r.opp}–${r.isHome ? r.opp : r.own}</div>
        <div class="side away">${crest(r.isHome ? opponent : club, 'sm')}<span>${esc((r.isHome ? opponent : club).abbr)}</span></div>
      </div>
    </div>`;
}

function newsRow(item) {
  return `<div class="news-item ${item.read ? '' : 'unread'}" data-action="news:${item.id}">
    <small>Season ${item.season} · MD ${item.round} · ${esc(item.kind)}</small>
    <b>${esc(item.title)}</b>
    <p>${esc(truncate(item.body, 110))}</p>
  </div>`;
}

// Squad -----------------------------------------------------------------------

function squadScreen(app) {
  const club = userTeam(app.state);
  const view = app.squadView ?? 'pitch';
  return `
    <div class="seg" style="margin-bottom:12px">
      <button class="chip" aria-pressed="${view === 'pitch'}" data-action="squad-view:pitch">Selection</button>
      <button class="chip" aria-pressed="${view === 'list'}" data-action="squad-view:list">Full squad</button>
      <button class="chip" data-action="auto-pick">Auto pick</button>
    </div>
    ${view === 'pitch' ? pitchView(app, club) : listView(app, club)}
  `;
}

function pitchView(app, club) {
  const slots = slotsOf(club.tactics.formation);
  const selected = app.selection;
  const marks = slots.map((slot, i) => {
    const player = club.squad.find((p) => p.id === club.lineup[i]);
    if (!player) {
      return `<button class="slot" style="left:${slot.x}%;top:${slot.y}%" data-action="slot:${i}">
        <span class="shirt">+</span><span class="nm">Empty</span><span class="lbl">${slot.label}</span></button>`;
    }
    const unavailable = !isAvailable(player);
    const tired = player.condition < 70;
    const isSelected = selected?.kind === 'slot' && selected.index === i;
    return `<button class="slot ${unavailable ? 'unavailable' : tired ? 'tired' : ''}"
        style="left:${slot.x}%;top:${slot.y}%"
        data-selected="${isSelected}"
        data-action="slot:${i}">
      <span class="shirt">${ability(player)}</span>
      <span class="nm">${esc(player.last)}</span>
      <span class="lbl">${slot.label}${unavailable ? ' ⚠' : ''}</span>
    </button>`;
  }).join('');

  const bench = club.bench.map((id) => club.squad.find((p) => p.id === id)).filter(Boolean);
  const benchHTML = bench.map((p) => {
    const isSelected = app.selection?.kind === 'bench' && app.selection.id === p.id;
    return `<button class="benchchip" data-selected="${isSelected}" data-action="benchpick:${p.id}">
      <b>${esc(p.last)}</b>
      <small>${p.pos} · ${ability(p)}${isAvailable(p) ? '' : ' ⚠'}</small>
    </button>`;
  }).join('');

  const xi = club.lineup.map((id) => club.squad.find((p) => p.id === id)).filter(Boolean);
  const problems = xi.filter((p) => !isAvailable(p));

  return `
    <div class="pitch">
      <div class="halfway"></div><div class="circle"></div>
      ${marks}
    </div>
    <p class="tiny muted" style="margin:0 0 10px">Tap a player to pick him up, tap another to swap. Tap the same shirt twice for his profile.</p>
    ${problems.length ? `<div class="card flat"><b class="tiny" style="color:var(--danger)">${problems.length} unavailable player${problems.length > 1 ? 's' : ''} in the XI</b><p class="tiny muted" style="margin:4px 0 0">${problems.map((p) => esc(shortName(p))).join(', ')} will be replaced automatically at kick-off.</p></div>` : ''}
    <div class="section-title">Substitutes</div>
    <div class="benchstrip">${benchHTML || '<p class="empty">No substitutes named.</p>'}</div>
    <div class="section-title">Squad depth</div>
    <div class="card tight">${club.squad
      .filter((p) => !club.lineup.includes(p.id) && !club.bench.includes(p.id))
      .sort((a, b) => ability(b) - ability(a))
      .map((p) => playerRow(app, club, p)).join('') || '<p class="empty">Everyone is involved.</p>'}</div>
  `;
}

function listView(app, club) {
  return POS_GROUPS.map(([pos, label]) => {
    const players = club.squad.filter((p) => p.pos === pos).sort((a, b) => ability(b) - ability(a));
    if (!players.length) return '';
    return `<div class="section-title">${label}</div>
      <div class="card tight">${players.map((p) => playerRow(app, club, p)).join('')}</div>`;
  }).join('') + `
    <div class="card flat">
      <div class="kv"><span>Squad size</span><strong>${club.squad.length} / ${SQUAD_MAX}</strong></div>
      <div class="kv"><span>Squad value</span><strong>${money(squadValue(club))}</strong></div>
      <div class="kv"><span>Wage bill</span><strong>${money(wageBill(club))} / week</strong></div>
      <div class="kv"><span>Average age</span><strong>${(club.squad.reduce((s, p) => s + p.age, 0) / club.squad.length).toFixed(1)}</strong></div>
    </div>`;
}

function playerRow(app, club, p) {
  const inXI = club.lineup.includes(p.id);
  const onBench = club.bench.includes(p.id);
  const rating = seasonRating(p);
  const status = p.injuryDays > 0
    ? `<span class="pill bad">INJ ${p.injuryDays}d</span>`
    : p.suspension > 0 ? '<span class="pill warn">SUS</span>'
    : inXI ? '<span class="pill gold">XI</span>'
    : onBench ? '<span class="pill">SUB</span>' : '';
  return `<button class="prow" data-action="player:${p.id}">
    <span class="pos ${p.pos}">${p.pos}</span>
    <span class="who">
      <b>${esc(p.name)}</b>
      <small>${p.age}y · ${money(p.value)} ${status}</small>
    </span>
    <span class="cond">${conditionMeter(p.condition)}<small class="tiny muted">${Math.round(p.condition)}%</small></span>
    <span class="rating">${ability(p)}${rating ? `<br><small class="tiny muted">${rating.toFixed(1)}</small>` : ''}</span>
  </button>`;
}

// Tactics ---------------------------------------------------------------------

function tacticsScreen(app) {
  const club = userTeam(app.state);
  const t = club.tactics;
  const side = matchSide(club, { isUser: true });
  const strength = strengthPreview(side);
  const opponentFixture = nextFixture(app.state);
  const opponent = opponentFixture
    ? getTeam(app.state, opponentFixture.homeId === club.id ? opponentFixture.awayId : opponentFixture.homeId)
    : null;
  const oppStrength = opponent ? strengthPreview(matchSide(opponent)) : null;

  const bar = (label, mine, theirs) => `
    <div style="margin-bottom:10px">
      <div class="spread tiny"><span class="muted">${label}</span><strong>${Math.round(mine)}${theirs ? ` <span class="muted">vs ${Math.round(theirs)}</span>` : ''}</strong></div>
      ${meter((mine / 90) * 100, 'gold')}
      ${theirs ? meter((theirs / 90) * 100) : ''}
    </div>`;

  return `
    <div class="section-title">Formation</div>
    <div class="seg">${FORMATION_NAMES.map((f) => `<button class="chip" aria-pressed="${t.formation === f}" data-action="formation:${f}">${f}</button>`).join('')}</div>

    <div class="section-title">Mentality</div>
    <div class="card">
      <div class="seg">${MENTALITIES.map((m) => `<button class="chip" aria-pressed="${t.mentality === m.id}" data-action="mentality:${m.id}">${m.name}</button>`).join('')}</div>
      <p class="tiny muted" style="margin:10px 0 0">${esc(MENTALITIES.find((m) => m.id === t.mentality).blurb)}</p>
    </div>

    <div class="section-title">Pressing</div>
    <div class="card">
      <div class="seg">${PRESSING.map((m) => `<button class="chip" aria-pressed="${t.pressing === m.id}" data-action="pressing:${m.id}">${m.name}</button>`).join('')}</div>
      <p class="tiny muted" style="margin:10px 0 0">${esc(PRESSING.find((m) => m.id === t.pressing).blurb)}</p>
    </div>

    <div class="section-title">Tempo</div>
    <div class="card">
      <div class="seg">${TEMPO.map((m) => `<button class="chip" aria-pressed="${t.tempo === m.id}" data-action="tempo:${m.id}">${m.name}</button>`).join('')}</div>
      <p class="tiny muted" style="margin:10px 0 0">${esc(TEMPO.find((m) => m.id === t.tempo).blurb)}</p>
    </div>

    <div class="section-title">Strength of the eleven${opponent ? ` v ${esc(opponent.name)}` : ''}</div>
    <div class="card">
      ${bar('Attack', strength.att, oppStrength?.def)}
      ${bar('Midfield', strength.mid, oppStrength?.mid)}
      ${bar('Defence', strength.def, oppStrength?.att)}
      ${bar('Goalkeeper', strength.gk, oppStrength?.gk)}
      <p class="tiny muted" style="margin:2px 0 0">Gold is your side${opponent ? `, green is ${esc(opponent.name)}` : ''}. Ratings include fitness, form and morale.</p>
    </div>

    <div class="card">
      <div class="spread">
        <div><b class="tiny">Automatic substitutions</b><p class="tiny muted" style="margin:2px 0 0">Let the bench make changes for tired legs.</p></div>
        <button class="chip" aria-pressed="${app.state.settings.autoSubs}" data-action="toggle-autosubs">${app.state.settings.autoSubs ? 'On' : 'Off'}</button>
      </div>
    </div>`;
}

// League ------------------------------------------------------------------------

function leagueScreen(app) {
  const tab = app.leagueTab ?? 'table';
  return `
    <div class="seg" style="margin-bottom:12px">
      <button class="chip" aria-pressed="${tab === 'table'}" data-action="league-tab:table">Table</button>
      <button class="chip" aria-pressed="${tab === 'fixtures'}" data-action="league-tab:fixtures">Fixtures</button>
      <button class="chip" aria-pressed="${tab === 'stats'}" data-action="league-tab:stats">Stats</button>
    </div>
    ${tab === 'table' ? tableView(app) : tab === 'fixtures' ? fixturesView(app) : statsView(app)}`;
}

function tableView(app) {
  const s = app.state;
  const standings = buildTable(s.teams, s.fixtures);
  const rows = standings.map((row, i) => `
    <tr class="${row.id === s.clubId ? 'me' : ''} ${i === 0 ? 'up' : i >= standings.length - 2 ? 'down' : ''}" data-action="club-info:${row.id}">
      <td>${i + 1}</td>
      <td><div class="team-cell">${crest(getTeam(s, row.id), 'sm')}<span>${esc(row.name)}</span></div></td>
      <td>${row.played}</td>
      <td>${row.gd > 0 ? '+' : ''}${row.gd}</td>
      <td><strong>${row.points}</strong></td>
    </tr>`).join('');
  return `
    <div class="card tight">
      <table class="grid">
        <thead><tr><th>#</th><th>Club</th><th>P</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="tiny muted">Champions at the top, the bottom two go down. Tap a club for their record.</p>`;
}

function fixturesView(app) {
  const s = app.state;
  const rounds = roundsInSeason(s);
  const round = Math.min(Math.max(app.fixtureRound ?? s.round, 1), rounds);
  const fixtures = s.fixtures.filter((f) => f.round === round);
  return `
    <div class="spread" style="margin-bottom:10px">
      <button class="btn ghost" data-action="round:${round - 1}" ${round <= 1 ? 'disabled' : ''}>‹</button>
      <b>Matchday ${round}</b>
      <button class="btn ghost" data-action="round:${round + 1}" ${round >= rounds ? 'disabled' : ''}>›</button>
    </div>
    <div class="card">
      ${fixtures.map((f) => {
        const home = getTeam(s, f.homeId);
        const away = getTeam(s, f.awayId);
        const mine = f.homeId === s.clubId || f.awayId === s.clubId;
        return `<div class="fixture" style="${mine ? 'background:rgba(242,193,78,.07);border-radius:8px;padding:6px 4px' : ''}">
          <div class="side">${crest(home, 'sm')}<span>${esc(home.abbr)}</span></div>
          <div class="score small">${f.played ? `${f.homeGoals}–${f.awayGoals}` : 'v'}</div>
          <div class="side away">${crest(away, 'sm')}<span>${esc(away.abbr)}</span></div>
        </div>`;
      }).join('')}
    </div>`;
}

function statsView(app) {
  const s = app.state;
  const scorers = topScorers(s.teams, 10);
  const rated = bestRated(s.teams, 10, 3);
  return `
    <div class="section-title">Leading scorers</div>
    <div class="card tight">
      <table class="grid">
        <thead><tr><th></th><th>Player</th><th>Gls</th><th>Ast</th></tr></thead>
        <tbody>${scorers.length ? scorers.map((e, i) => `
          <tr class="${e.team.id === s.clubId ? 'me' : ''}">
            <td>${i + 1}</td>
            <td><div class="team-cell">${crest(e.team, 'sm')}<span>${esc(e.player.name)}</span></div></td>
            <td><strong>${e.player.season.goals}</strong></td>
            <td>${e.player.season.assists}</td>
          </tr>`).join('') : '<tr><td colspan="4" class="empty">No goals yet this season.</td></tr>'}
        </tbody>
      </table>
    </div>
    <div class="section-title">Best rated</div>
    <div class="card tight">
      <table class="grid">
        <thead><tr><th></th><th>Player</th><th>Apps</th><th>Avg</th></tr></thead>
        <tbody>${rated.length ? rated.map((e, i) => `
          <tr class="${e.team.id === s.clubId ? 'me' : ''}">
            <td>${i + 1}</td>
            <td><div class="team-cell">${crest(e.team, 'sm')}<span>${esc(e.player.name)}</span></div></td>
            <td>${e.player.season.ratedApps}</td>
            <td><strong>${ratingBadge(e.rating)}</strong></td>
          </tr>`).join('') : '<tr><td colspan="4" class="empty">Not enough matches played.</td></tr>'}
        </tbody>
      </table>
    </div>`;
}

// Club --------------------------------------------------------------------------

function clubScreen(app) {
  const s = app.state;
  const club = userTeam(s);
  const focus = TRAINING_FOCUS.find((f) => f.id === s.training.focus);
  const intensity = TRAINING_INTENSITY.find((i) => i.id === s.training.intensity);
  const weekly = club.finances.sponsorship - wageBill(club);
  const open = windowOpen(s);

  return `
    <div class="section-title">Finances</div>
    <div class="card">
      <div class="kv"><span>Balance</span><strong style="color:var(--gold)">${money(club.finances.balance)}</strong></div>
      <div class="kv"><span>Sponsorship</span><strong>+${money(club.finances.sponsorship)}/wk</strong></div>
      <div class="kv"><span>Wages</span><strong>−${money(wageBill(club))}/wk</strong></div>
      <div class="kv"><span>Net</span><strong style="color:${weekly >= 0 ? 'var(--good)' : 'var(--danger)'}">${weekly >= 0 ? '+' : ''}${money(weekly)}/wk</strong></div>
      <div class="kv"><span>Spent this season</span><strong>${money(club.seasonStats.spent)}</strong></div>
      <div class="kv"><span>Received this season</span><strong>${money(club.seasonStats.received)}</strong></div>
      <p class="tiny muted" style="margin:10px 0 0">Home gates are paid in on matchday: ${esc(club.stadium)} holds ${club.capacity.toLocaleString()}.</p>
    </div>

    <div class="section-title">Transfers</div>
    <div class="card">
      <div class="spread">
        <div>
          <b class="tiny">${open ? 'Window open' : 'Window closed'}</b>
          <p class="tiny muted" style="margin:2px 0 0">${open
            ? 'Deals can be done until the next match kicks off.'
            : 'The window reopens at the midway point of the season and in pre-season.'}</p>
        </div>
        <span class="pill ${open ? 'good' : ''}">${s.market.length} listed</span>
      </div>
      <button class="btn wide ${open ? 'primary' : ''}" style="margin-top:12px" data-action="market">Transfer market</button>
    </div>

    <div class="section-title">Training</div>
    <div class="card">
      <div class="seg">${TRAINING_FOCUS.map((f) => `<button class="chip sm" aria-pressed="${f.id === focus.id}" data-action="train-focus:${f.id}">${f.name}</button>`).join('')}</div>
      <p class="tiny muted" style="margin:8px 0 12px">${esc(focus.blurb)}</p>
      <div class="seg">${TRAINING_INTENSITY.map((i) => `<button class="chip sm" aria-pressed="${i.id === intensity.id}" data-action="train-intensity:${i.id}">${i.name}</button>`).join('')}</div>
      <p class="tiny muted" style="margin:8px 0 0">${intensity.id === 'hard'
        ? 'Fastest improvement, slowest recovery, most injuries.'
        : intensity.id === 'light' ? 'Legs stay fresh but nobody gets much better.' : 'A sensible balance.'}</p>
    </div>

    <div class="section-title">Record</div>
    <div class="card tight">
      ${s.history.length ? `<table class="grid">
        <thead><tr><th>Season</th><th>Club</th><th>Pos</th><th>Pts</th></tr></thead>
        <tbody>${s.history.slice().reverse().map((h) => `
          <tr><td>${h.season}</td><td>${esc(h.clubName)}</td><td>${h.position === 1 ? '🏆 1' : h.position}</td><td>${h.points}</td></tr>`).join('')}
        </tbody></table>` : '<p class="empty">Your first season in charge.</p>'}
    </div>

    <div class="section-title">Game</div>
    <div class="card">
      <p class="tiny muted" style="margin:0 0 12px">Progress saves to this device automatically after every match.</p>
      <button class="btn wide danger" data-action="new-game">Start a new career</button>
    </div>`;
}

// Sheets --------------------------------------------------------------------------

export function playerSheet(app, playerId) {
  const s = app.state;
  const found = findPlayer(s, playerId);
  if (!found) return '<p class="empty">Player not found.</p>';
  const { player: p, team } = found;
  const club = userTeam(s);
  const mine = team && team.id === club.id;
  const rating = seasonRating(p);
  const inXI = club.lineup.includes(p.id);
  const onBench = club.bench.includes(p.id);

  const attr = (label, key) => `
    <div class="attr">
      <span>${label}</span><b>${Math.round(p.att[key])}</b>
      ${meter(p.att[key], key === 'gk' ? 'gold' : '')}
    </div>`;

  return `
    <h2>${esc(p.name)}</h2>
    <p class="sub">${p.pos} · ${p.age} years · ${esc(team ? team.name : 'Free agent')} · ability ${ability(p)}${p.potential > ability(p) ? ` <span class="muted">(potential ${p.potential})</span>` : ''}</p>

    <div class="rowwrap" style="margin-bottom:12px">
      ${p.injuryDays > 0 ? `<span class="pill bad">Out ${p.injuryDays} days · ${esc(p.injuryNote)}</span>` : ''}
      ${p.suspension > 0 ? '<span class="pill warn">Suspended</span>' : ''}
      ${inXI ? '<span class="pill gold">Starting XI</span>' : onBench ? '<span class="pill">Substitute</span>' : ''}
      <span class="pill ${p.form > 2 ? 'good' : p.form < -2 ? 'bad' : ''}">${formWord(p.form)}</span>
      <span class="pill">${moraleWord(p.morale)}</span>
    </div>

    <div class="attr-grid">
      ${attr('Pace', 'pac')}
      ${attr('Passing', 'pas')}
      ${attr('Shooting', 'sht')}
      ${attr('Defending', 'def')}
      ${attr('Physical', 'phy')}
      ${p.pos === 'GK' ? attr('Goalkeeping', 'gk') : attr('Fitness', 'phy')}
    </div>

    <div class="card flat">
      <div class="kv"><span>Condition</span><strong>${Math.round(p.condition)}%</strong></div>
      <div class="kv"><span>Season</span><strong>${p.season.apps + p.season.subs} apps · ${p.season.goals} goals · ${p.season.assists} assists</strong></div>
      <div class="kv"><span>Average rating</span><strong>${rating ? ratingBadge(rating) : '—'}</strong></div>
      <div class="kv"><span>Career</span><strong>${p.career.apps} apps · ${p.career.goals} goals</strong></div>
      <div class="kv"><span>Value</span><strong>${money(p.value)}</strong></div>
      <div class="kv"><span>Wage</span><strong>${money(p.wage)}/wk</strong></div>
      <div class="kv"><span>Contract</span><strong>${p.contract > 0 ? `${p.contract} season${p.contract > 1 ? 's' : ''} left` : 'Expiring'}</strong></div>
    </div>

    ${mine ? `
      <div class="btn-row" style="margin-bottom:8px">
        <button class="btn" data-action="select-xi:${p.id}">${inXI ? 'Move to bench' : 'Into the XI'}</button>
        <button class="btn" data-action="toggle-bench:${p.id}">${onBench ? 'Drop from bench' : 'Name as sub'}</button>
      </div>
      <div class="btn-row">
        <button class="btn" data-action="renew:${p.id}">Renew contract</button>
        <button class="btn danger" data-action="sell:${p.id}">Sell</button>
      </div>` : ''}
  `;
}

export function marketSheet(app) {
  const s = app.state;
  const club = userTeam(s);
  const open = windowOpen(s);
  const listings = s.market
    .map((m) => ({ listing: m, found: findPlayer(s, m.playerId) }))
    .filter((x) => x.found)
    .sort((a, b) => ability(b.found.player) - ability(a.found.player));

  return `
    <h2>Transfer market</h2>
    <p class="sub">${open ? 'Window open — deals close when the next match kicks off.' : 'Window shut. You can look, but nothing can be signed.'} Budget ${money(club.finances.balance)}.</p>
    <div class="card tight">
      ${listings.length ? listings.map(({ listing, found }) => {
        const p = found.player;
        const offer = transferOffer(s, p.id);
        return `<div class="prow" style="cursor:default">
          <span class="pos ${p.pos}">${p.pos}</span>
          <span class="who">
            <b>${esc(p.name)}</b>
            <small>${p.age}y · ${ability(p)} · ${esc(found.team ? found.team.abbr : 'Free agent')} · ${money(offer?.wage ?? p.wage)}/wk</small>
          </span>
          <span class="tiny" style="text-align:right;min-width:56px">${listing.fee ? money(listing.fee) : 'Free'}</span>
          <button class="btn chip sm" data-action="sign:${p.id}" ${offer && offer.canSign ? '' : 'disabled'}>Sign</button>
        </div>`;
      }).join('') : '<p class="empty">No players available right now.</p>'}
    </div>
    <p class="tiny muted">Squad ${club.squad.length}/${SQUAD_MAX}. Tap a name in your squad list to sell.</p>`;
}

export function newsSheet(app, item) {
  return `
    <h2>${esc(item.title)}</h2>
    <p class="sub">Season ${item.season} · Matchday ${item.round}</p>
    <p style="font-size:.92rem;line-height:1.55">${esc(item.body)}</p>
    <button class="btn wide" style="margin-top:14px" data-action="close-sheet">Close</button>`;
}

export function allNewsSheet(app) {
  return `
    <h2>Inbox</h2>
    <p class="sub">Everything the club has told you.</p>
    <div class="card tight">${app.state.news.map(newsRow).join('')}</div>`;
}

export function clubInfoSheet(app, teamId) {
  const s = app.state;
  const team = getTeam(s, teamId);
  const standings = buildTable(s.teams, s.fixtures);
  const row = standings.find((r) => r.id === teamId);
  const best = team.squad.slice().sort((a, b) => ability(b) - ability(a)).slice(0, 5);
  return `
    <h2>${esc(team.name)}</h2>
    <p class="sub">${esc(team.stadium)} · ${team.capacity.toLocaleString()} capacity · reputation ${team.rep}</p>
    <div class="card flat">
      <div class="kv"><span>Position</span><strong>${ordinal(row.position)}</strong></div>
      <div class="kv"><span>Record</span><strong>${row.won}W ${row.drawn}D ${row.lost}L</strong></div>
      <div class="kv"><span>Goals</span><strong>${row.gf} for · ${row.ga} against</strong></div>
      <div class="kv"><span>Form</span><strong>${formRun(row.form)}</strong></div>
      <div class="kv"><span>Squad value</span><strong>${money(squadValue(team))}</strong></div>
    </div>
    <div class="section-title">Key players</div>
    <div class="card tight">${best.map((p) => `
      <div class="prow" style="cursor:default">
        <span class="pos ${p.pos}">${p.pos}</span>
        <span class="who"><b>${esc(p.name)}</b><small>${p.age}y · ${p.season.goals} goals this season</small></span>
        <span></span>
        <span class="rating">${ability(p)}</span>
      </div>`).join('')}</div>`;
}

export function sellSheet(app, playerId) {
  const offer = saleOffer(app.state, playerId);
  if (!offer) return '<p class="empty">No offer.</p>';
  const p = offer.player;
  return `
    <h2>Sell ${esc(p.name)}?</h2>
    <p class="sub">${offer.buyer ? `${esc(offer.buyer.name)} are interested.` : 'No club has shown an interest.'}</p>
    <div class="card flat">
      <div class="kv"><span>Valuation</span><strong>${money(p.value)}</strong></div>
      <div class="kv"><span>Offer on the table</span><strong style="color:var(--gold)">${money(offer.fee)}</strong></div>
      <div class="kv"><span>Wage saved</span><strong>${money(p.wage)}/wk</strong></div>
    </div>
    ${offer.canSell
      ? `<button class="btn primary wide" data-action="confirm-sell:${p.id}">Accept ${money(offer.fee)}</button>`
      : `<p class="tiny" style="color:var(--danger)">${esc(offer.reason)}</p>`}
    <button class="btn wide ghost" style="margin-top:8px" data-action="close-sheet">Keep him</button>`;
}

export function gameOverScreen(app) {
  const over = app.state.gameOver;
  const titles = app.state.history.filter((h) => h.position === 1).length;
  return `
    <div class="start">
      <h1>The <span>end</span> of the road</h1>
      <p class="lede">${esc(over.reason)}</p>
      <div class="card">
        <div class="kv"><span>Club</span><strong>${esc(over.club)}</strong></div>
        <div class="kv"><span>Seasons</span><strong>${app.state.history.length}</strong></div>
        <div class="kv"><span>League titles</span><strong>${titles}</strong></div>
      </div>
      ${app.state.history.length ? `<div class="card tight"><table class="grid">
        <thead><tr><th>Season</th><th>Club</th><th>Pos</th><th>Pts</th></tr></thead>
        <tbody>${app.state.history.map((h) => `<tr><td>${h.season}</td><td>${esc(h.clubName)}</td><td>${h.position}</td><td>${h.points}</td></tr>`).join('')}</tbody>
      </table></div>` : ''}
      <button class="btn primary wide big" data-action="new-game-now">Take another job</button>
    </div>`;
}

// Helpers -------------------------------------------------------------------------

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function moraleWord(m) {
  if (m >= 85) return 'Delighted';
  if (m >= 70) return 'Good';
  if (m >= 55) return 'Settled';
  if (m >= 40) return 'Uneasy';
  if (m >= 25) return 'Poor';
  return 'Mutinous';
}

function formWord(f) {
  if (f >= 5) return 'Flying';
  if (f >= 2) return 'In form';
  if (f > -2) return 'Steady';
  if (f > -5) return 'Off colour';
  return 'Out of sorts';
}

function truncate(text, len) {
  return text.length > len ? `${text.slice(0, len - 1)}…` : text;
}
