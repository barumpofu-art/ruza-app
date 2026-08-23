import { ability, isAvailable } from './players.js';
import { slotsOf } from './formations.js';

// Picks the strongest legal XI for a formation: fill every slot with the best
// available player for that role, then plug gaps with whoever is left.
export function autoPickXI(squad, formationName) {
  const slots = slotsOf(formationName);
  const pool = squad.filter(isAvailable);
  const used = new Set();
  const xi = new Array(slots.length).fill(null);

  const bestFor = (role, penaltyFor) => {
    const options = pool.filter((p) => !used.has(p.id));
    if (!options.length) return null;
    return options.reduce((best, p) => (score(p, role, penaltyFor) > score(best, role, penaltyFor) ? p : best));
  };

  // Fill goalkeeper first, then the rest by how scarce the role is.
  const order = slots
    .map((s, i) => ({ i, role: s.role }))
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role));

  for (const { i, role } of order) {
    const p = bestFor(role, true);
    if (!p) continue;
    xi[i] = p;
    used.add(p.id);
  }

  // Any empty slot (a squad decimated by injuries) takes the best body left.
  for (let i = 0; i < xi.length; i++) {
    if (xi[i]) continue;
    const spare = squad.find((p) => !used.has(p.id) && isAvailable(p)) ?? squad.find((p) => !used.has(p.id));
    if (spare) { xi[i] = spare; used.add(spare.id); }
  }

  return xi;
}

function roleOrder(role) { return role === 'GK' ? 0 : role === 'DF' ? 1 : role === 'MF' ? 2 : 3; }

// Out-of-position players lose a chunk of their ability.
export function score(player, role, applyPenalty = true) {
  if (!player) return -Infinity;
  const a = ability(player);
  if (!applyPenalty || player.pos === role) return a;
  if (player.pos === 'GK' || role === 'GK') return a * 0.45;
  const distance = Math.abs(roleOrder(player.pos) - roleOrder(role));
  return a * (distance === 1 ? 0.86 : 0.72);
}

export function autoPickBench(squad, xi, size = 7) {
  const inXI = new Set(xi.filter(Boolean).map((p) => p.id));
  const rest = squad.filter((p) => !inXI.has(p.id) && isAvailable(p));
  const gk = rest.filter((p) => p.pos === 'GK').sort((a, b) => ability(b) - ability(a))[0];
  const others = rest
    .filter((p) => p !== gk)
    .sort((a, b) => ability(b) - ability(a));
  const bench = gk ? [gk, ...others] : others;
  return bench.slice(0, size);
}

export function xiIsValid(xi) {
  return Array.isArray(xi) && xi.filter(Boolean).length === 11 && new Set(xi.filter(Boolean).map((p) => p.id)).size === 11;
}

// The side object the engine expects.
export function matchSide(team, { isUser = false, autoSubs = true } = {}) {
  const formation = team.tactics.formation;
  let xi = (team.lineup ?? []).map((id) => team.squad.find((p) => p.id === id) ?? null);
  if (!xiIsValid(xi) || xi.some((p) => p && !isAvailable(p))) xi = autoPickXI(team.squad, formation);
  let bench = (team.bench ?? []).map((id) => team.squad.find((p) => p.id === id)).filter((p) => p && isAvailable(p));
  if (bench.length < 5) bench = autoPickBench(team.squad, xi);
  return {
    teamId: team.id,
    name: team.name,
    abbr: team.abbr,
    color: team.home,
    stadium: team.stadium,
    tactics: { ...team.tactics },
    lineup: xi,
    bench,
    isUser,
    autoSubs,
  };
}
