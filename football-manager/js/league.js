// Fixture list, table and league-wide stat tables.

export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;

/**
 * Double round robin via the circle method. Every club plays every other club
 * home and away; the two halves are shuffled independently so no two seasons
 * look the same.
 */
export function makeFixtures(teamIds, rng) {
  const ids = rng.shuffle(teamIds);
  if (ids.length % 2 === 1) ids.push(null); // bye
  const n = ids.length;
  const rounds = [];

  const rotation = ids.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a == null || b == null) continue;
      // Alternate venues round by round so nobody gets a lopsided calendar.
      pairs.push(r % 2 === 0 ? { homeId: a, awayId: b } : { homeId: b, awayId: a });
    }
    rounds.push(pairs);
    const fixed = rotation[0];
    const rest = rotation.slice(1);
    rest.unshift(rest.pop());
    rotation.splice(0, rotation.length, fixed, ...rest);
  }

  const firstHalf = rng.shuffle(rounds);
  const secondHalf = rng.shuffle(rounds).map((pairs) => pairs.map((p) => ({ homeId: p.awayId, awayId: p.homeId })));

  const fixtures = [];
  [...firstHalf, ...secondHalf].forEach((pairs, index) => {
    for (const pair of pairs) {
      fixtures.push({
        round: index + 1,
        homeId: pair.homeId,
        awayId: pair.awayId,
        played: false,
        homeGoals: null,
        awayGoals: null,
      });
    }
  });
  return fixtures;
}

export const totalRounds = (fixtures) => fixtures.reduce((m, f) => Math.max(m, f.round), 0);

export function blankRow(team) {
  return {
    id: team.id, name: team.name, abbr: team.abbr, color: team.home,
    played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [],
  };
}

export function buildTable(teams, fixtures) {
  const rows = new Map(teams.map((t) => [t.id, blankRow(t)]));

  for (const f of fixtures) {
    if (!f.played) continue;
    const home = rows.get(f.homeId);
    const away = rows.get(f.awayId);
    if (!home || !away) continue;
    home.played++; away.played++;
    home.gf += f.homeGoals; home.ga += f.awayGoals;
    away.gf += f.awayGoals; away.ga += f.homeGoals;
    if (f.homeGoals > f.awayGoals) {
      home.won++; away.lost++; home.points += POINTS_WIN; away.points += 0;
      home.form.push('W'); away.form.push('L');
    } else if (f.homeGoals < f.awayGoals) {
      away.won++; home.lost++; away.points += POINTS_WIN;
      away.form.push('W'); home.form.push('L');
    } else {
      home.drawn++; away.drawn++;
      home.points += POINTS_DRAW; away.points += POINTS_DRAW;
      home.form.push('D'); away.form.push('D');
    }
  }

  const table = [...rows.values()];
  for (const row of table) {
    row.gd = row.gf - row.ga;
    row.form = row.form.slice(-5);
  }
  table.sort(compareRows);
  table.forEach((row, i) => { row.position = i + 1; });
  return table;
}

export function compareRows(a, b) {
  return b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name);
}

export const positionOf = (table, teamId) => (table.findIndex((r) => r.id === teamId) + 1) || table.length;

export function fixturesForRound(fixtures, round) {
  return fixtures.filter((f) => f.round === round);
}

export function nextFixtureFor(fixtures, teamId) {
  return fixtures.find((f) => !f.played && (f.homeId === teamId || f.awayId === teamId)) ?? null;
}

export function resultsFor(fixtures, teamId) {
  return fixtures.filter((f) => f.played && (f.homeId === teamId || f.awayId === teamId));
}

export function topScorers(teams, limit = 12) {
  const players = [];
  for (const team of teams) {
    for (const p of team.squad) {
      if (p.season.goals > 0 || p.season.assists > 0) players.push({ player: p, team });
    }
  }
  players.sort((a, b) =>
    b.player.season.goals - a.player.season.goals ||
    b.player.season.assists - a.player.season.assists ||
    a.player.season.minutes - b.player.season.minutes);
  return players.slice(0, limit);
}

export function bestRated(teams, limit = 10, minApps = 3) {
  const players = [];
  for (const team of teams) {
    for (const p of team.squad) {
      if (p.season.ratedApps >= minApps) {
        players.push({ player: p, team, rating: p.season.ratingSum / p.season.ratedApps });
      }
    }
  }
  players.sort((a, b) => b.rating - a.rating);
  return players.slice(0, limit);
}
