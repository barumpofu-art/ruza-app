// Plays whole seasons with no UI, checking the league stays internally
// consistent and the world keeps making sense year after year.
import * as S from '../js/state.js';
import { buildTable } from '../js/league.js';
import { ability } from '../js/players.js';

const seasons = Number(process.argv[2] ?? 3);
const state = S.newGame({ clubId: 'ser', managerName: 'Test Manager', seed: 99 });
const problems = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };

console.log(`club: ${S.userTeam(state).name}, target: ${state.board.expectationText}`);

for (let season = 0; season < seasons; season++) {
  const startingSeason = state.season;
  let guard = 0;
  while (state.season === startingSeason && !state.gameOver && guard++ < 40) {
    S.quickPlayRound(state);
  }

  const history = state.history[state.history.length - 1];
  const club = S.userTeam(state);
  console.log(
    `season ${history.season}: ${history.clubName} ${history.position}${history.position === 1 ? 'st (CHAMPIONS)' : ''} ` +
    `pts ${history.points} (${history.won}-${history.drawn}-${history.lost}) gf ${history.gf} ga ${history.ga} | ` +
    `champion ${history.champion} | balance ${S.money(club.finances.balance)} | squad ${club.squad.length} ` +
    `avg age ${(club.squad.reduce((s, p) => s + p.age, 0) / club.squad.length).toFixed(1)} ` +
    `avg ability ${(club.squad.reduce((s, p) => s + ability(p), 0) / club.squad.length).toFixed(1)} | ` +
    `conf ${Math.round(state.board.confidence)}`
  );

  check(history.won + history.drawn + history.lost === 22, 'each club should play 22 matches');
  for (const team of state.teams) {
    check(team.squad.length >= S.SQUAD_MIN, `${team.name} squad too small (${team.squad.length})`);
    check(team.squad.filter((p) => p.pos === 'GK').length >= 1, `${team.name} has no keeper`);
    check(team.squad.every((p) => p.age >= 16 && p.age <= 40), `${team.name} has an impossible age`);
    check(team.squad.every((p) => Number.isFinite(ability(p)) && ability(p) > 5), `${team.name} has a broken rating`);
  }
  if (state.gameOver) { console.log('sacked:', state.gameOver.reason); break; }
}

// Table integrity on the season in progress (or the last completed one).
const t = buildTable(state.teams, state.fixtures);
const gf = t.reduce((s, r) => s + r.gf, 0);
const ga = t.reduce((s, r) => s + r.ga, 0);
check(gf === ga, `goals for (${gf}) must equal goals against (${ga})`);
const pts = t.reduce((s, r) => s + r.points, 0);
const games = t.reduce((s, r) => s + r.played, 0) / 2;
check(pts <= games * 3 && pts >= games * 2, `points total ${pts} out of range for ${games} games`);

// Top scorers should look like a football season, not a video game.
const scorers = state.teams.flatMap((x) => x.squad).sort((a, b) => b.season.goals - a.season.goals).slice(0, 3);
console.log('current-season leading scorers:', scorers.map((p) => `${p.name} ${p.season.goals}`).join(', '));
console.log('news items:', state.news.length, '| market size:', state.market.length);

const savedSize = JSON.stringify(state).length;
console.log('save size:', (savedSize / 1024).toFixed(0) + 'kb');
check(savedSize < 3_000_000, 'save is too large for localStorage');

if (problems.length) {
  console.error('\nFAILURES:');
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log('\nall season checks passed');
