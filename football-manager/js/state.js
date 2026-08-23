import { makeRng, clamp } from './rng.js';
import { CLUBS, PROMOTION_POOL } from './data.js';
import {
  generateSquad, generatePlayer, ability, marketValue, wageFor, blankSeasonStats,
  recover, ageUp, applyGrowth, resetPlayerIds, peekPlayerId, isAvailable, shortName,
} from './players.js';
import { DEFAULT_TACTICS } from './formations.js';
import { autoPickXI, autoPickBench, matchSide } from './lineup.js';
import { MatchSim } from './engine.js';
import { makeFixtures, buildTable, totalRounds, nextFixtureFor, positionOf } from './league.js';

export const SAVE_VERSION = 3;
export const SQUAD_MIN = 16;
export const SQUAD_MAX = 30;
export const TICKET_PRICE = 45;

export const TRAINING_FOCUS = [
  { id: 'balanced', name: 'Balanced', blurb: 'A bit of everything.', keys: ['pac', 'pas', 'sht', 'def', 'phy'] },
  { id: 'attack', name: 'Attacking', blurb: 'Finishing and movement.', keys: ['sht', 'pac'] },
  { id: 'defence', name: 'Defending', blurb: 'Shape, tackling, heading.', keys: ['def', 'phy'] },
  { id: 'possession', name: 'Possession', blurb: 'Passing and control.', keys: ['pas'] },
  { id: 'fitness', name: 'Fitness', blurb: 'Legs for the run-in. Recover faster.', keys: ['phy'] },
];

export const TRAINING_INTENSITY = [
  { id: 'light', name: 'Light', recovery: 1.35, growth: 0.55, injury: 0.002 },
  { id: 'normal', name: 'Normal', recovery: 1.0, growth: 1.0, injury: 0.008 },
  { id: 'hard', name: 'Hard', recovery: 0.74, growth: 1.5, injury: 0.022 },
];

const EXPECTATIONS = [
  { minRep: 80, id: 'title', text: 'Win the league', maxPos: 2 },
  { minRep: 66, id: 'europe', text: 'Finish in the top four', maxPos: 5 },
  { minRep: 52, id: 'tophalf', text: 'Finish in the top half', maxPos: 8 },
  { minRep: 0, id: 'survive', text: 'Stay in the division', maxPos: 10 },
];

const PRIZE_MONEY = [6000000, 4200000, 3200000, 2600000, 2200000, 1900000, 1650000, 1450000, 1250000, 1100000, 950000, 800000];

let newsId = 1;

// New game ------------------------------------------------------------------

export function newGame({ clubId, managerName, seed = Date.now() }) {
  resetPlayerIds(1);
  newsId = 1;
  const rng = makeRng(seed);

  const teams = CLUBS.map((club) => makeTeam(club, rng));
  const state = {
    version: SAVE_VERSION,
    seed,
    rngState: rng.state,
    createdAt: Date.now(),
    managerName: managerName?.trim() || 'The Gaffer',
    clubId,
    season: 1,
    round: 1,                 // the matchday about to be played
    teams,
    fixtures: makeFixtures(teams.map((t) => t.id), rng),
    freeAgents: [],
    market: [],
    news: [],
    history: [],
    lastResult: null,
    training: { focus: 'balanced', intensity: 'normal' },
    settings: { autoSubs: true, speed: 'normal' },
    board: null,
    gameOver: null,
    reserveClubs: PROMOTION_POOL.map((c) => c.id),
    nextPlayerId: peekPlayerId(),
  };

  const club = teams.find((t) => t.id === clubId);
  state.board = makeBoard(club);
  refreshMarket(state);
  saveRng(state, rng);

  pushNews(state, {
    kind: 'board',
    title: `Welcome to ${club.name}`,
    body: `The board have handed you the job on a two-year deal. Their expectation for the season: ${state.board.expectationText.toLowerCase()}. You start with ${money(club.finances.balance)} in the bank and a wage bill of ${money(wageBill(club))} a week.`,
  });
  return state;
}

function makeTeam(club, rng) {
  const squad = generateSquad(rng, club.rep);
  const team = {
    ...club,
    squad,
    tactics: { ...DEFAULT_TACTICS },
    lineup: [],
    bench: [],
    finances: {
      balance: Math.round((club.rep * 62000 + rng.int(-400, 400) * 1000) / 50000) * 50000,
      sponsorship: Math.round(club.rep * 780),
    },
    seasonStats: { transfersIn: 0, transfersOut: 0, spent: 0, received: 0 },
  };
  const xi = autoPickXI(squad, team.tactics.formation);
  team.lineup = xi.map((p) => p.id);
  team.bench = autoPickBench(squad, xi).map((p) => p.id);
  return team;
}

function makeBoard(club) {
  const exp = EXPECTATIONS.find((e) => club.rep >= e.minRep);
  return {
    confidence: 62,
    expectation: exp.id,
    expectationText: exp.text,
    maxPos: exp.maxPos,
    seasonsInCharge: 0,
  };
}

// Accessors ------------------------------------------------------------------

export const getTeam = (state, id) => state.teams.find((t) => t.id === id);
export const userTeam = (state) => getTeam(state, state.clubId);
export const table = (state) => buildTable(state.teams, state.fixtures);
export const roundsInSeason = (state) => totalRounds(state.fixtures);
export const nextFixture = (state) => nextFixtureFor(state.fixtures, state.clubId);
export const findPlayer = (state, playerId) => {
  for (const team of state.teams) {
    const p = team.squad.find((x) => x.id === playerId);
    if (p) return { player: p, team };
  }
  const free = state.freeAgents.find((x) => x.id === playerId);
  return free ? { player: free, team: null } : null;
};
export const wageBill = (team) => team.squad.reduce((s, p) => s + p.wage, 0);
export const squadValue = (team) => team.squad.reduce((s, p) => s + p.value, 0);
export const seasonOver = (state) => state.fixtures.every((f) => f.played);

function withRng(state, fn) {
  const rng = makeRng(state.seed);
  rng.state = state.rngState;
  const out = fn(rng);
  saveRng(state, rng);
  return out;
}
function saveRng(state, rng) { state.rngState = rng.state; }

export function money(amount) {
  const n = Math.round(amount);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${sign}P${(abs / 1000000).toFixed(abs >= 10000000 ? 1 : 2)}m`;
  if (abs >= 1000) return `${sign}P${Math.round(abs / 1000)}k`;
  return `${sign}P${abs}`;
}

export function pushNews(state, item) {
  state.news.unshift({
    id: newsId++,
    season: state.season,
    round: state.round,
    read: false,
    ...item,
  });
  state.news = state.news.slice(0, 60);
}

export const unreadNews = (state) => state.news.filter((n) => !n.read).length;

// Matchday -------------------------------------------------------------------

/** Builds the live match for the user's next fixture. */
export function startMatch(state) {
  const fixture = nextFixture(state);
  if (!fixture) return null;
  const rng = makeRng(state.seed);
  rng.state = state.rngState;
  const home = getTeam(state, fixture.homeId);
  const away = getTeam(state, fixture.awayId);
  const sim = new MatchSim({
    home: matchSide(home, { isUser: home.id === state.clubId, autoSubs: state.settings.autoSubs }),
    away: matchSide(away, { isUser: away.id === state.clubId, autoSubs: state.settings.autoSubs }),
    rng,
  });
  sim.fixture = fixture;
  sim.saveRngTo = state;
  return sim;
}

/** Applies the user's finished match, then plays the rest of the matchday. */
export function completeMatch(state, sim) {
  saveRng(state, sim.rng);
  const result = sim.result();
  applyResult(state, sim.fixture, result);
  state.lastResult = summariseResult(state, sim.fixture, result);
  simulateRound(state, state.round, sim.fixture);
  finishRound(state);
  return state.lastResult;
}

/** Plays the user's fixture without watching it. */
export function quickPlayRound(state) {
  const fixture = nextFixture(state);
  if (fixture) {
    const sim = startMatch(state);
    sim.runToEnd();
    return completeMatch(state, sim);
  }
  simulateRound(state, state.round, null);
  finishRound(state);
  return null;
}

export function simulateRound(state, round, skipFixture) {
  withRng(state, (rng) => {
    for (const fixture of state.fixtures) {
      if (fixture.round !== round || fixture.played || fixture === skipFixture) continue;
      const home = getTeam(state, fixture.homeId);
      const away = getTeam(state, fixture.awayId);
      const sim = new MatchSim({ home: matchSide(home), away: matchSide(away), rng });
      applyResult(state, fixture, sim.runToEnd());
    }
  });
}

export function applyResult(state, fixture, result) {
  fixture.played = true;
  fixture.homeGoals = result.homeGoals;
  fixture.awayGoals = result.awayGoals;
  fixture.homeScorers = result.home.players.filter((p) => p.goals > 0).map((p) => ({ name: p.name, goals: p.goals }));
  fixture.awayScorers = result.away.players.filter((p) => p.goals > 0).map((p) => ({ name: p.name, goals: p.goals }));

  for (const [side, teamId, opponentGoals, ownGoals] of [
    [result.home, fixture.homeId, result.awayGoals, result.homeGoals],
    [result.away, fixture.awayId, result.homeGoals, result.awayGoals],
  ]) {
    const team = getTeam(state, teamId);
    if (!team) continue;
    const won = ownGoals > opponentGoals;
    const drew = ownGoals === opponentGoals;

    for (const line of side.players) {
      const player = team.squad.find((p) => p.id === line.id);
      if (!player || line.minutes === 0) continue;
      player.condition = line.condition;
      player.season.minutes += line.minutes;
      if (line.started) player.season.apps++; else player.season.subs++;
      player.season.goals += line.goals;
      player.season.assists += line.assists;
      player.season.yellow += line.yellow;
      player.season.red += line.red;
      player.season.ratingSum += line.rating;
      player.season.ratedApps++;
      player.career.apps++;
      player.career.goals += line.goals;
      player.career.assists += line.assists;
      if (line.role === 'GK' && opponentGoals === 0 && line.minutes > 60) player.season.cleanSheets++;

      // Form is a rolling memory of recent ratings.
      player.form = clamp(player.form * 0.72 + (line.rating - 6.5) * 3.4, -10, 10);
      const moraleShift = (won ? 5 : drew ? 1 : -4) + (line.rating - 6.5) * 2.5;
      player.morale = clamp(player.morale + moraleShift, 5, 100);
      if (line.injuryDays > 0) {
        player.injuryDays = line.injuryDays;
        player.injuryNote = line.injuryNote;
        player.morale = clamp(player.morale - 8, 5, 100);
      }
      // Two here: the weekly tick below takes one off, leaving the next match banned.
      if (line.red > 0) player.suspension = 2;
      player.yellowSeason += line.yellow;
      if (player.yellowSeason >= 5) { player.yellowSeason = 0; player.suspension = Math.max(player.suspension, 2); }
    }

    // Unused players sulk a little.
    const involved = new Set(side.players.filter((p) => p.minutes > 0).map((p) => p.id));
    for (const p of team.squad) {
      if (involved.has(p.id) || !isAvailable(p)) continue;
      p.morale = clamp(p.morale - 1.6, 5, 100);
    }
  }

  if (fixture.homeId === state.clubId || fixture.awayId === state.clubId) {
    applyMatchdayFinances(state, fixture, result);
  }
}

function applyMatchdayFinances(state, fixture, result) {
  const club = userTeam(state);
  if (fixture.homeId !== club.id) return;
  const opponent = getTeam(state, fixture.awayId);
  const standings = buildTable(state.teams, state.fixtures);
  const pos = positionOf(standings, club.id);
  const pull = clamp(0.42 + club.rep / 240 + opponent.rep / 400 + (12 - pos) * 0.014, 0.3, 0.98);
  const attendance = Math.round(club.capacity * pull);
  const gate = attendance * TICKET_PRICE;
  club.finances.balance += gate;
  state.lastGate = { attendance, gate };
}

function summariseResult(state, fixture, result) {
  const club = userTeam(state);
  const isHome = fixture.homeId === club.id;
  const own = isHome ? result.homeGoals : result.awayGoals;
  const opp = isHome ? result.awayGoals : result.homeGoals;
  const opponent = getTeam(state, isHome ? fixture.awayId : fixture.homeId);
  return {
    season: state.season,
    round: fixture.round,
    isHome,
    opponentId: opponent.id,
    opponentName: opponent.name,
    own, opp,
    outcome: own > opp ? 'W' : own === opp ? 'D' : 'L',
    result,
  };
}

/** Post-matchday housekeeping: money, recovery, training, board, news. */
function finishRound(state) {
  const club = userTeam(state);
  const standings = buildTable(state.teams, state.fixtures);
  const pos = positionOf(standings, club.id);

  // Wages and sponsorship land every matchweek.
  const wages = wageBill(club);
  club.finances.balance += club.finances.sponsorship - wages;

  if (state.lastResult) {
    const r = state.lastResult;
    const scoreline = `${r.own}-${r.opp}`;
    pushNews(state, {
      kind: 'result',
      title: `${r.outcome === 'W' ? 'Win' : r.outcome === 'D' ? 'Draw' : 'Defeat'} ${r.isHome ? 'v' : 'away to'} ${r.opponentName} ${scoreline}`,
      body: `${club.name} are ${ordinal(pos)} after ${standings.find((row) => row.id === club.id).played} matches.` +
        (state.lastGate ? ` ${state.lastGate.attendance.toLocaleString()} through the gates, ${money(state.lastGate.gate)} taken.` : ''),
    });
    state.lastGate = null;
    updateBoard(state, r, pos);
  }

  runTrainingWeek(state);
  injuryReport(state);

  state.round++;
  if (seasonOver(state)) endSeason(state);
  else if (state.round === Math.floor(roundsInSeason(state) / 2) + 1) openMidseasonWindow(state);
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

// Training and recovery -------------------------------------------------------

function runTrainingWeek(state) {
  const focus = TRAINING_FOCUS.find((f) => f.id === state.training.focus) ?? TRAINING_FOCUS[0];
  const intensity = TRAINING_INTENSITY.find((i) => i.id === state.training.intensity) ?? TRAINING_INTENSITY[1];

  withRng(state, (rng) => {
    for (const team of state.teams) {
      const isUser = team.id === state.clubId;
      const teamFocus = isUser ? focus : TRAINING_FOCUS[0];
      const teamIntensity = isUser ? intensity : TRAINING_INTENSITY[1];

      for (const player of team.squad) {
        recover(player, rng, 7, teamIntensity.recovery * (focus.id === 'fitness' && isUser ? 1.12 : 1));
        player.morale = clamp(player.morale + (player.morale < 55 ? 1.1 : -0.4), 5, 100);
        player.suspension = Math.max(0, player.suspension - 1);

        // Development: young players with headroom improve fastest.
        const now = ability(player);
        const room = player.potential - now;
        if (room > 0) {
          const ageFactor = player.age <= 21 ? 1 : player.age <= 25 ? 0.6 : player.age <= 29 ? 0.25 : 0.08;
          const gain = 0.055 * ageFactor * teamIntensity.growth * (0.5 + Math.min(1, room / 12));
          if (rng.chance(0.55)) growFocused(player, gain, teamFocus.keys);
        } else if (player.age >= 31 && rng.chance(0.12)) {
          applyGrowth(player, -0.12);
        }

        if (isUser && isAvailable(player) && rng.chance(teamIntensity.injury)) {
          player.injuryDays = rng.int(4, 21);
          player.injuryNote = rng.pick(['strain in training', 'tweaked a hamstring', 'rolled an ankle in a small-sided game']);
          pushNews(state, {
            kind: 'injury',
            title: `${player.name} injured in training`,
            body: `${shortName(player)} ${player.injuryNote} and is out for around ${player.injuryDays} days.`,
          });
        }
      }
      for (const player of team.squad) player.value = marketValue(player);
    }
  });
}

function growFocused(player, gain, keys) {
  applyGrowth(player, gain * 0.4);
  for (const key of keys) {
    player.att[key] = clamp(player.att[key] + (gain * 1.6) / keys.length, 8, 97);
  }
  player.value = marketValue(player);
}

function injuryReport(state) {
  const club = userTeam(state);
  const fresh = club.squad.filter((p) => p.injuryDays > 0 && p.injuryDays <= 7 && p.injuryNote);
  if (!fresh.length) return;
  const back = fresh.map((p) => `${shortName(p)} (${p.injuryDays}d)`).join(', ');
  pushNews(state, { kind: 'injury', title: 'Treatment room', body: `Close to a return: ${back}.` });
}

// Board ----------------------------------------------------------------------

function updateBoard(state, result, position) {
  const board = state.board;
  const target = board.maxPos;
  const positional = clamp((target - position) * 0.7, -5, 4);
  const resultShift = result.outcome === 'W' ? 3.0 : result.outcome === 'D' ? 0.4 : -2.4;
  board.confidence = clamp(board.confidence + positional * 0.35 + resultShift, 0, 100);

  const played = state.fixtures.filter((f) => f.played && (f.homeId === state.clubId || f.awayId === state.clubId)).length;
  if (board.confidence < 8 && played >= 10 && !state.gameOver) {
    sack(state, `${played} matches in, ${ordinal(position)} in the table, and the board have run out of patience.`);
  } else if (board.confidence < 25 && played >= 6 && !board.warned) {
    board.warned = true;
    pushNews(state, {
      kind: 'board',
      title: 'The board want to see improvement',
      body: `Sitting ${ordinal(position)} is not what was agreed. The target remains: ${board.expectationText.toLowerCase()}. Results need to turn quickly.`,
    });
  }
}

function sack(state, reason) {
  state.gameOver = {
    reason,
    season: state.season,
    club: userTeam(state).name,
    honours: state.history.filter((h) => h.position === 1).length,
  };
  pushNews(state, { kind: 'board', title: 'You have been relieved of your duties', body: reason });
}

// Transfers ------------------------------------------------------------------

export const windowOpen = (state) => state.round === 1 || state.round === Math.floor(roundsInSeason(state) / 2) + 1;

export function refreshMarket(state) {
  withRng(state, (rng) => {
    state.freeAgents = [];
    const club = userTeam(state);
    const level = clamp(52 + (club.rep - 40) * 0.42, 45, 74);

    // A handful of free agents, tuned to roughly the level of your squad.
    for (let i = 0; i < 6; i++) {
      const pos = rng.pick(['GK', 'DF', 'DF', 'MF', 'MF', 'FW', 'FW']);
      // Free agents are useful depth rather than instant first-teamers.
      const p = generatePlayer(rng, { pos, quality: level + rng.range(-12, 3), age: rng.int(18, 34) });
      p.contract = 0;
      state.freeAgents.push(p);
    }

    // Plus players the other clubs are willing to let go.
    const listed = [];
    for (const team of state.teams) {
      if (team.id === state.clubId) continue;
      const candidates = team.squad
        .filter((p) => isAvailable(p))
        .sort((a, b) => ability(a) - ability(b));
      const surplus = candidates.filter((p) => team.squad.filter((q) => q.pos === p.pos).length > (p.pos === 'GK' ? 2 : 4));
      const pool = surplus.length ? surplus : candidates;
      const count = rng.int(1, 2);
      for (let i = 0; i < count && i < pool.length; i++) {
        const p = rng.pick(pool);
        if (listed.some((l) => l.playerId === p.id)) continue;
        p.transferListed = true;
        listed.push({ playerId: p.id, teamId: team.id, fee: Math.round(p.value * rng.range(1.05, 1.45) / 5000) * 5000 });
      }
    }
    state.market = [
      ...state.freeAgents.map((p) => ({ playerId: p.id, teamId: null, fee: 0 })),
      ...rng.shuffle(listed).slice(0, 14),
    ];
    state.nextPlayerId = peekPlayerId();
  });
}

function openMidseasonWindow(state) {
  refreshMarket(state);
  pushNews(state, {
    kind: 'transfer',
    title: 'The mid-season window is open',
    body: 'Agents are working the phones. The window closes when the next round of fixtures kicks off.',
  });
}

export function transferOffer(state, playerId) {
  const listing = state.market.find((m) => m.playerId === playerId);
  if (!listing) return null;
  const found = findPlayer(state, playerId);
  if (!found) return null;
  const club = userTeam(state);
  const wage = Math.round(wageFor(found.player) * 1.08);
  const fee = listing.fee;
  const reasons = [];
  if (!windowOpen(state)) reasons.push('The transfer window is shut.');
  if (fee > club.finances.balance) reasons.push(`You cannot cover ${money(fee)}.`);
  if (club.squad.length >= SQUAD_MAX) reasons.push('Your squad is full.');
  if (wage + wageBill(club) > club.finances.sponsorship * 2.6) reasons.push('That wage would break the budget.');
  return { listing, player: found.player, fromTeam: found.team, fee, wage, canSign: reasons.length === 0, reasons };
}

export function signPlayer(state, playerId) {
  const offer = transferOffer(state, playerId);
  if (!offer || !offer.canSign) return { ok: false, message: offer ? offer.reasons[0] : 'That player is no longer available.' };
  const club = userTeam(state);
  const { player, fromTeam, fee, wage } = offer;

  if (fromTeam) {
    fromTeam.squad = fromTeam.squad.filter((p) => p.id !== player.id);
    fromTeam.lineup = fromTeam.lineup.filter((id) => id !== player.id);
    fromTeam.bench = fromTeam.bench.filter((id) => id !== player.id);
    fromTeam.finances.balance += fee;
    fromTeam.seasonStats.received += fee;
    if (fromTeam.squad.length < SQUAD_MIN) restockSquad(state, fromTeam);
  } else {
    state.freeAgents = state.freeAgents.filter((p) => p.id !== player.id);
  }

  player.transferListed = false;
  player.contract = 3;
  player.wage = wage;
  player.morale = clamp(player.morale + 12, 5, 100);
  player.season = blankSeasonStats();
  club.squad.push(player);
  club.finances.balance -= fee;
  club.seasonStats.transfersIn++;
  club.seasonStats.spent += fee;
  state.market = state.market.filter((m) => m.playerId !== playerId);

  pushNews(state, {
    kind: 'transfer',
    title: `${player.name} signs`,
    body: `${player.name} (${player.pos}, ${player.age}) joins ${fee ? `for ${money(fee)}` : 'on a free transfer'} from ${fromTeam ? fromTeam.name : 'free agency'}, on ${money(wage)} a week.`,
  });
  return { ok: true, message: `${player.name} signed.` };
}

/** What another club would pay for one of your players right now. */
export function saleOffer(state, playerId) {
  const club = userTeam(state);
  const player = club.squad.find((p) => p.id === playerId);
  if (!player) return null;
  return withRng(state, (rng) => {
    const interest = state.teams.filter((t) => t.id !== club.id && t.finances.balance > player.value * 0.9 && t.squad.length < SQUAD_MAX);
    if (!interest.length) return { player, fee: 0, buyer: null, canSell: false, reason: 'Nobody can afford him at the moment.' };
    const buyer = rng.pick(interest);
    const fee = Math.round((player.value * rng.range(0.72, 1.12)) / 5000) * 5000;
    const canSell = club.squad.length > SQUAD_MIN && windowOpen(state);
    const reason = !windowOpen(state) ? 'The transfer window is shut.' : club.squad.length <= SQUAD_MIN ? 'Your squad is already at the minimum.' : '';
    return { player, fee, buyer, canSell, reason };
  });
}

export function sellPlayer(state, playerId, offer) {
  const club = userTeam(state);
  const player = club.squad.find((p) => p.id === playerId);
  if (!player || !offer || !offer.canSell) return { ok: false, message: offer?.reason ?? 'Cannot sell that player.' };

  club.squad = club.squad.filter((p) => p.id !== playerId);
  club.lineup = club.lineup.filter((id) => id !== playerId);
  club.bench = club.bench.filter((id) => id !== playerId);
  club.finances.balance += offer.fee;
  club.seasonStats.transfersOut++;
  club.seasonStats.received += offer.fee;

  const buyer = offer.buyer;
  buyer.squad.push(player);
  buyer.finances.balance -= offer.fee;
  player.transferListed = false;
  player.morale = clamp(player.morale + 6, 5, 100);

  // Morale hit if you sell someone the dressing room rated.
  const a = ability(player);
  for (const p of club.squad) if (ability(p) < a) p.morale = clamp(p.morale - 2, 5, 100);

  pushNews(state, {
    kind: 'transfer',
    title: `${player.name} sold to ${buyer.name}`,
    body: `${money(offer.fee)} banked. The squad is down to ${club.squad.length} players.`,
  });
  ensureSelection(club);
  return { ok: true, message: `${player.name} sold for ${money(offer.fee)}.` };
}

function restockSquad(state, team) {
  withRng(state, (rng) => {
    while (team.squad.length < SQUAD_MIN + 4) {
      const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
      for (const p of team.squad) counts[p.pos]++;
      const need = counts.GK < 2 ? 'GK' : counts.DF < 5 ? 'DF' : counts.MF < 5 ? 'MF' : 'FW';
      team.squad.push(generatePlayer(rng, { pos: need, quality: 44 + (team.rep - 40) * 0.4, age: rng.int(18, 31) }));
    }
    state.nextPlayerId = peekPlayerId();
  });
}

export function renewContract(state, playerId) {
  const club = userTeam(state);
  const player = club.squad.find((p) => p.id === playerId);
  if (!player) return { ok: false, message: 'Player not found.' };
  const newWage = Math.round(wageFor(player) * (player.contract === 0 ? 1.25 : 1.12) / 50) * 50;
  if (newWage + wageBill(club) - player.wage > club.finances.sponsorship * 2.6) {
    return { ok: false, message: `${money(newWage)} a week would break the wage budget.` };
  }
  player.wage = newWage;
  player.contract = 3;
  player.morale = clamp(player.morale + 8, 5, 100);
  return { ok: true, message: `${shortName(player)} signs on until ${state.season + 3}, ${money(newWage)} a week.` };
}

// Selection ------------------------------------------------------------------

export function ensureSelection(team) {
  const ids = new Set(team.squad.map((p) => p.id));
  team.lineup = (team.lineup ?? []).filter((id) => ids.has(id));
  team.bench = (team.bench ?? []).filter((id) => ids.has(id) && !team.lineup.includes(id));
  const xi = team.lineup.map((id) => team.squad.find((p) => p.id === id));
  const broken = xi.length !== 11 || xi.some((p) => !p || !isAvailable(p));
  if (broken) autoSelect(team);
  if (team.bench.length < 5) {
    const picked = autoPickBench(team.squad, team.lineup.map((id) => team.squad.find((p) => p.id === id)).filter(Boolean));
    team.bench = picked.map((p) => p.id);
  }
}

export function autoSelect(team) {
  const xi = autoPickXI(team.squad, team.tactics.formation);
  team.lineup = xi.map((p) => p && p.id).filter(Boolean);
  team.bench = autoPickBench(team.squad, xi).map((p) => p.id);
  return team;
}

export function setFormation(team, formation) {
  team.tactics.formation = formation;
  autoSelect(team);
}

/** Swap two shirts, or move a bench player into the XI. */
export function swapSelection(team, aId, bId) {
  const inXI = (id) => team.lineup.indexOf(id);
  const ai = inXI(aId), bi = inXI(bId);
  if (ai >= 0 && bi >= 0) {
    [team.lineup[ai], team.lineup[bi]] = [team.lineup[bi], team.lineup[ai]];
    return true;
  }
  if (ai >= 0 && bi < 0) {
    team.lineup[ai] = bId;
    team.bench = team.bench.map((id) => (id === bId ? aId : id));
    if (!team.bench.includes(aId)) team.bench.push(aId);
    return true;
  }
  if (bi >= 0 && ai < 0) return swapSelection(team, bId, aId);
  const abi = team.bench.indexOf(aId), bbi = team.bench.indexOf(bId);
  if (abi >= 0 && bbi >= 0) {
    [team.bench[abi], team.bench[bbi]] = [team.bench[bbi], team.bench[abi]];
    return true;
  }
  return false;
}

export function toggleBench(team, playerId) {
  if (team.bench.includes(playerId)) {
    team.bench = team.bench.filter((id) => id !== playerId);
    return false;
  }
  if (team.lineup.includes(playerId)) return false;
  team.bench.push(playerId);
  team.bench = team.bench.slice(0, 7);
  return true;
}

// End of season --------------------------------------------------------------

export function endSeason(state) {
  const standings = buildTable(state.teams, state.fixtures);
  const club = userTeam(state);
  const row = standings.find((r) => r.id === club.id);
  const position = row.position;
  const champion = standings[0];

  club.finances.balance += PRIZE_MONEY[position - 1] ?? 800000;

  state.history.push({
    season: state.season,
    clubId: club.id,
    clubName: club.name,
    position,
    points: row.points,
    won: row.won, drawn: row.drawn, lost: row.lost,
    gf: row.gf, ga: row.ga,
    champion: champion.name,
  });

  pushNews(state, {
    kind: 'board',
    title: `Season ${state.season} is over — ${ordinal(position)} place`,
    body: `${champion.name} are champions. ${club.name} finish ${ordinal(position)} on ${row.points} points and collect ${money(PRIZE_MONEY[position - 1] ?? 800000)} in prize money.`,
  });

  const board = state.board;
  board.seasonsInCharge++;
  const met = position <= board.maxPos;
  // Goodwill fades between seasons: last year's cup of tea buys you less than you think.
  board.confidence = 60 + (board.confidence - 60) * 0.6;
  board.confidence = clamp(board.confidence + (met ? 22 : -16) + (board.maxPos - position) * 2.2, 0, 100);

  if (position === 1) {
    pushNews(state, { kind: 'board', title: 'CHAMPIONS', body: `${club.name} win the Kalahari Premiership. The city has not slept.` });
  }

  if (position > 10) {
    sack(state, `${club.name} finish ${ordinal(position)} and go down. The board thank you for your service.`);
    return state;
  }
  // One bad year is survivable. Two, or a disaster, is not.
  const disaster = position >= board.maxPos + 4;
  if (!met && board.confidence < 22 && (board.seasonsInCharge >= 2 || disaster)) {
    sack(state, `A ${ordinal(position)} place finish against a target of ${board.expectationText.toLowerCase()} has cost you the job.`);
    return state;
  }
  if (!met) {
    pushNews(state, {
      kind: 'board',
      title: 'The board expect better next season',
      body: `${ordinal(position)} is short of ${board.expectationText.toLowerCase()}. You keep the job, but another season like it will not be tolerated.`,
    });
  }

  rollOverSeason(state, standings);
  return state;
}

function rollOverSeason(state, standings) {
  withRng(state, (rng) => {
    // Reputation drifts towards how clubs actually performed.
    for (const row of standings) {
      const team = getTeam(state, row.id);
      const expected = 6.5;
      team.rep = clamp(Math.round(team.rep + (expected - row.position) * 0.9), 34, 95);
    }

    // Relegate the bottom two, promote two clubs from the pool.
    const goingDown = standings.slice(-2).map((r) => r.id).filter((id) => id !== state.clubId);
    for (const id of goingDown) {
      const poolId = state.reserveClubs.shift();
      const template = PROMOTION_POOL.find((c) => c.id === poolId);
      const oldIndex = state.teams.findIndex((t) => t.id === id);
      if (!template || oldIndex < 0) continue;
      state.reserveClubs.push(id);
      const promoted = makeTeam({ ...template, rep: clamp(template.rep + rng.int(-2, 4), 36, 60) }, rng);
      state.teams[oldIndex] = promoted;
      pushNews(state, {
        kind: 'league',
        title: `${promoted.name} promoted`,
        body: `${getTeam(state, id)?.name ?? 'A club'} go down; ${promoted.name} come up in their place.`,
      });
    }

    for (const team of state.teams) {
      const retiring = [];
      for (const player of team.squad) {
        player.season = blankSeasonStats();
        player.form = 0;
        player.yellowSeason = 0;
        player.suspension = 0;
        player.condition = rng.int(84, 98);
        ageUp(player, rng);
        if (player.age >= 34 && (rng.chance(0.35) || ability(player) < 42)) retiring.push(player.id);
      }
      if (retiring.length) {
        team.squad = team.squad.filter((p) => !retiring.includes(p.id));
        if (team.id === state.clubId) {
          pushNews(state, {
            kind: 'squad',
            title: `${retiring.length} player${retiring.length > 1 ? 's' : ''} retire`,
            body: 'Time catches everyone. Replacements have been added to the academy intake.',
          });
        }
      }

      // Contracts that ran out walk away. Computer clubs simply re-sign theirs;
      // yours leave on a free unless you renewed them in time.
      if (team.id !== state.clubId) {
        for (const p of team.squad) if (p.contract <= 0) { p.contract = rng.int(1, 3); p.wage = wageFor(p); }
      } else {
        // Settled players you can afford will sign again themselves. Anyone
        // unhappy, or beyond the wage budget, walks away for nothing.
        const expired = team.squad.filter((p) => p.contract <= 0);
        const leaving = [];
        const stayed = [];
        for (const p of expired) {
          const newWage = Math.round(wageFor(p) * 1.1 / 50) * 50;
          const affordable = wageBill(team) - p.wage + newWage <= team.finances.sponsorship * 2.6;
          if (p.morale >= 45 && affordable) {
            p.contract = rng.int(2, 3);
            p.wage = newWage;
            stayed.push(p);
          } else {
            leaving.push(p);
          }
        }
        if (leaving.length) {
          const ids = new Set(leaving.map((p) => p.id));
          team.squad = team.squad.filter((p) => !ids.has(p.id));
          pushNews(state, {
            kind: 'squad',
            title: `${leaving.length} player${leaving.length > 1 ? 's' : ''} leave on a free`,
            body: `${leaving.map((p) => p.name).join(', ')} would not sign again. Renew contracts from a player's profile before the final year runs out.`,
          });
        }
        if (stayed.length) {
          pushNews(state, {
            kind: 'squad',
            title: `${stayed.length} new contract${stayed.length > 1 ? 's' : ''} agreed`,
            body: `${stayed.map((p) => shortName(p)).join(', ')} have signed on again.`,
          });
        }
        const expiring = team.squad.filter((p) => p.contract === 1);
        if (expiring.length) {
          pushNews(state, {
            kind: 'squad',
            title: `${expiring.length} player${expiring.length > 1 ? 's' : ''} in the final year`,
            body: `${expiring.map((p) => shortName(p)).join(', ')} will be out of contract at the end of this season.`,
          });
        }
      }

      // Academy intake keeps every squad viable.
      while (team.squad.length < SQUAD_MIN + 4) {
        const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
        for (const p of team.squad) counts[p.pos]++;
        const need = counts.GK < 2 ? 'GK' : counts.DF < 6 ? 'DF' : counts.MF < 6 ? 'MF' : 'FW';
        team.squad.push(generatePlayer(rng, { pos: need, quality: 46 + (team.rep - 40) * 0.44, age: rng.int(17, 20) }));
      }
      ensureSelection(team);
    }

    state.season++;
    state.round = 1;
    state.fixtures = makeFixtures(state.teams.map((t) => t.id), rng);
    state.lastResult = null;
    state.board.warned = false;
    state.nextPlayerId = peekPlayerId();

    const club = userTeam(state);
    const exp = EXPECTATIONS.find((e) => club.rep >= e.minRep);
    state.board.expectation = exp.id;
    state.board.expectationText = exp.text;
    state.board.maxPos = exp.maxPos;
  });

  refreshMarket(state);
  const club = userTeam(state);
  pushNews(state, {
    kind: 'board',
    title: `Season ${state.season} — the board's target`,
    body: `${state.board.expectationText}. Budget available: ${money(club.finances.balance)}. Pre-season transfer window is open until the first match.`,
  });
}

export function setTraining(state, patch) {
  Object.assign(state.training, patch);
}
