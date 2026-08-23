// Sanity checks on the match engine: scoreline distribution, home advantage,
// discipline and stamina should all land in believable ranges.
import { makeRng } from '../js/rng.js';
import { generateSquad, ability } from '../js/players.js';
import { CLUBS } from '../js/data.js';
import { DEFAULT_TACTICS } from '../js/formations.js';
import { autoPickXI, autoPickBench, matchSide } from '../js/lineup.js';
import { MatchSim } from '../js/engine.js';

const rng = makeRng(20240823);

const teams = CLUBS.map((c) => {
  const squad = generateSquad(rng, c.rep);
  const team = { ...c, squad, tactics: { ...DEFAULT_TACTICS }, lineup: [], bench: [] };
  const xi = autoPickXI(squad, team.tactics.formation);
  team.lineup = xi.map((p) => p.id);
  team.bench = autoPickBench(squad, xi).map((p) => p.id);
  team.xiRating = xi.reduce((s, p) => s + ability(p), 0) / 11;
  return team;
});

const N = Number(process.argv[2] ?? 600);
let homeGoals = 0, awayGoals = 0, homeWin = 0, draw = 0, awayWin = 0;
let shots = 0, onTarget = 0, yellows = 0, reds = 0, injuries = 0, fouls = 0;
let condSum = 0, condCount = 0;
const dist = {};
const strongerWins = { count: 0, total: 0 };

for (let i = 0; i < N; i++) {
  const a = teams[rng.int(0, teams.length - 1)];
  let b = teams[rng.int(0, teams.length - 1)];
  while (b === a) b = teams[rng.int(0, teams.length - 1)];
  const sim = new MatchSim({ home: matchSide(a), away: matchSide(b), rng });
  const r = sim.runToEnd();

  homeGoals += r.homeGoals; awayGoals += r.awayGoals;
  if (r.homeGoals > r.awayGoals) homeWin++; else if (r.homeGoals === r.awayGoals) draw++; else awayWin++;
  shots += r.home.shots + r.away.shots;
  onTarget += r.home.onTarget + r.away.onTarget;
  yellows += r.home.yellow + r.away.yellow;
  reds += r.home.red + r.away.red;
  fouls += r.home.fouls + r.away.fouls;
  for (const side of [r.home, r.away]) {
    for (const p of side.players) {
      if (p.injuryDays > 0) injuries++;
      if (p.minutes > 80 && p.role !== 'GK') { condSum += p.condition; condCount++; }
    }
  }
  const key = `${r.homeGoals}-${r.awayGoals}`;
  dist[key] = (dist[key] ?? 0) + 1;

  const gap = a.xiRating - b.xiRating;
  if (Math.abs(gap) > 8) {
    strongerWins.total++;
    const strongerIsHome = gap > 0;
    const won = strongerIsHome ? r.homeGoals > r.awayGoals : r.awayGoals > r.homeGoals;
    if (won) strongerWins.count++;
  }
}

const f = (x) => (x / N).toFixed(2);
console.log(`matches: ${N}`);
console.log(`goals/game: ${((homeGoals + awayGoals) / N).toFixed(2)}  (home ${f(homeGoals)} / away ${f(awayGoals)})`);
console.log(`results: home ${(homeWin / N * 100).toFixed(0)}%  draw ${(draw / N * 100).toFixed(0)}%  away ${(awayWin / N * 100).toFixed(0)}%`);
console.log(`shots/game ${f(shots)}  on target ${f(onTarget)}  (${(onTarget / shots * 100).toFixed(0)}% accuracy)`);
console.log(`fouls/game ${f(fouls)}  yellows ${f(yellows)}  reds ${f(reds)}`);
console.log(`injuries per match ${(injuries / N).toFixed(3)}  avg condition of 80+ min outfielder ${(condSum / condCount).toFixed(1)}`);
console.log(`clear favourite (8+ rating gap) win rate: ${(strongerWins.count / Math.max(1, strongerWins.total) * 100).toFixed(0)}% of ${strongerWins.total}`);
const top = Object.entries(dist).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, v]) => `${k}:${(v / N * 100).toFixed(1)}%`);
console.log('common scores:', top.join('  '));
