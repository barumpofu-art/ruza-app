import { clamp } from './rng.js';
import { FIRST_NAMES, SURNAMES, IMPORT_NAMES } from './data.js';

export const POSITIONS = ['GK', 'DF', 'MF', 'FW'];

// How much each attribute matters to a player's headline ability, per position.
const WEIGHTS = {
  GK: { gk: 0.62, phy: 0.16, pas: 0.10, pac: 0.06, def: 0.06, sht: 0.00 },
  DF: { def: 0.44, phy: 0.24, pac: 0.14, pas: 0.14, sht: 0.04, gk: 0.00 },
  MF: { pas: 0.38, def: 0.18, sht: 0.16, phy: 0.16, pac: 0.12, gk: 0.00 },
  FW: { sht: 0.44, pac: 0.24, phy: 0.14, pas: 0.14, def: 0.04, gk: 0.00 },
};

// Attribute means relative to a player's quality level, per position.
const PROFILE = {
  GK: { gk: 1.00, def: 0.55, pas: 0.70, sht: 0.30, pac: 0.60, phy: 0.90 },
  DF: { gk: 0.20, def: 1.00, pas: 0.78, sht: 0.50, pac: 0.82, phy: 0.95 },
  MF: { gk: 0.20, def: 0.80, pas: 1.00, sht: 0.80, pac: 0.85, phy: 0.85 },
  FW: { gk: 0.20, def: 0.52, pas: 0.80, sht: 1.00, pac: 0.98, phy: 0.85 },
};

let nextId = 1;
export function resetPlayerIds(n = 1) { nextId = n; }
export function peekPlayerId() { return nextId; }

export function ability(player) {
  const w = WEIGHTS[player.pos];
  let total = 0;
  for (const key of Object.keys(w)) total += w[key] * player.att[key];
  return Math.round(total);
}

// Ability once condition, morale and current form are taken into account.
export function effectiveAbility(player) {
  return ability(player) * conditionFactor(player) * moraleFactor(player) * formFactor(player);
}

export const conditionFactor = (p) => 0.74 + 0.26 * (p.condition / 100);
export const moraleFactor = (p) => 0.94 + 0.12 * (p.morale / 100);
export const formFactor = (p) => 1 + clamp(p.form, -10, 10) * 0.008;

export function marketValue(player) {
  const a = ability(player);
  // Value climbs steeply with ability and falls away with age.
  const base = Math.pow(Math.max(0, a - 34) / 10, 3.1) * 42000 + 15000;
  const ageCurve =
    player.age <= 20 ? 1.28 :
    player.age <= 23 ? 1.34 :
    player.age <= 27 ? 1.15 :
    player.age <= 30 ? 0.86 :
    player.age <= 33 ? 0.52 : 0.24;
  const potentialBonus = 1 + clamp(player.potential - a, 0, 25) * 0.014;
  return Math.round((base * ageCurve * potentialBonus) / 5000) * 5000;
}

export function wageFor(player) {
  const a = ability(player);
  return Math.round((280 + Math.pow(Math.max(0, a - 30), 2.05) * 5.2) / 50) * 50;
}

export function makeName(rng) {
  if (rng.chance(0.16)) {
    const [f, s] = rng.pick(IMPORT_NAMES);
    return { first: f, last: s };
  }
  return { first: rng.pick(FIRST_NAMES), last: rng.pick(SURNAMES) };
}

export function shortName(player) {
  return `${player.first[0]}. ${player.last}`;
}

/**
 * quality is roughly the ability we are aiming for (30-90).
 */
export function generatePlayer(rng, { pos, quality, age }) {
  const { first, last } = makeName(rng);
  const realAge = age ?? rng.int(17, 35);
  const profile = PROFILE[pos];

  // Young players sit below their eventual level; veterans have already peaked.
  const ageDip = realAge < 21 ? (21 - realAge) * 2.4 : 0;
  const target = clamp(rng.gauss(quality, 4.5) - ageDip, 22, 94);

  const att = {};
  for (const key of Object.keys(profile)) {
    const mean = 24 + (target - 24) * profile[key];
    att[key] = Math.round(clamp(rng.gauss(mean, 5), 12, 96));
  }

  const player = {
    id: nextId++,
    first, last,
    name: `${first} ${last}`,
    pos,
    age: realAge,
    att,
    potential: 0,
    condition: rng.int(88, 100),
    morale: rng.int(58, 82),
    form: 0,
    injuryDays: 0,
    injuryNote: '',
    yellowSeason: 0,
    suspension: 0,
    contract: rng.int(1, 4),
    wage: 0,
    value: 0,
    season: blankSeasonStats(),
    career: { apps: 0, goals: 0, assists: 0 },
    transferListed: false,
  };

  // Nudge the attributes so the headline ability actually lands on target.
  applyGrowth(player, target - ability(player));

  const now = ability(player);
  const headroom = realAge <= 19 ? rng.int(6, 22) : realAge <= 23 ? rng.int(3, 14) : realAge <= 27 ? rng.int(0, 5) : 0;
  player.potential = clamp(now + headroom, now, 96);
  player.wage = wageFor(player);
  player.value = marketValue(player);
  return player;
}

export function blankSeasonStats() {
  return { apps: 0, subs: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, yellow: 0, red: 0, ratingSum: 0, ratedApps: 0 };
}

export function seasonRating(p) {
  if (!p.season.ratedApps) return null;
  return p.season.ratingSum / p.season.ratedApps;
}

// A squad that covers every position with sensible depth.
const SQUAD_PLAN = [
  ['GK', 3], ['DF', 8], ['MF', 8], ['FW', 5],
];

// How far below the first choice each successive player in a position sits.
const DEPTH_PENALTY = { GK: 8, DF: 2.4, MF: 2.4, FW: 2.8 };

export function generateSquad(rng, reputation) {
  // Reputation 40-88 maps onto first-choice players of roughly 52-72 ability.
  const base = 52 + (reputation - 40) * 0.42;
  const squad = [];
  for (const [pos, count] of SQUAD_PLAN) {
    for (let i = 0; i < count; i++) {
      // Depth players are weaker than the first choice in their position.
      const depthPenalty = i * DEPTH_PENALTY[pos];
      const age = rng.chance(0.18) ? rng.int(17, 20) : rng.int(21, 34);
      squad.push(generatePlayer(rng, { pos, quality: base - depthPenalty + rng.range(-2, 6), age }));
    }
  }
  return squad;
}

export const isAvailable = (p) => p.injuryDays <= 0 && p.suspension <= 0;

export function positionRank(pos) { return POSITIONS.indexOf(pos); }

export function sortSquad(squad) {
  return squad.slice().sort((a, b) => positionRank(a.pos) - positionRank(b.pos) || ability(b) - ability(a));
}

// Rest, recovery and ageing --------------------------------------------------

export function recover(player, rng, days = 7, restBoost = 1) {
  if (player.injuryDays > 0) {
    player.injuryDays = Math.max(0, player.injuryDays - days);
    if (player.injuryDays === 0) player.injuryNote = '';
  }
  const rate = (5.2 + player.att.phy * 0.055) * days * restBoost;
  player.condition = clamp(player.condition + rate, 0, 100);
}

export function ageUp(player, rng) {
  player.age += 1;
  const a = ability(player);
  const room = player.potential - a;
  let delta = 0;
  if (player.age <= 23) delta = rng.range(0.4, 1.0) * Math.max(0.4, room * 0.22);
  else if (player.age <= 27) delta = rng.range(0.1, 0.6) * Math.max(0.2, room * 0.15);
  else if (player.age <= 30) delta = rng.range(-0.8, 0.6);
  else if (player.age <= 33) delta = rng.range(-2.6, -0.2);
  else delta = rng.range(-4.5, -1.2);
  applyGrowth(player, delta);
  player.contract = Math.max(0, player.contract - 1);
  player.value = marketValue(player);
  player.wage = wageFor(player);
}

// Spreads a change in ability across the attributes that matter for the role.
export function applyGrowth(player, delta) {
  const w = WEIGHTS[player.pos];
  const keys = Object.keys(w).filter((k) => w[k] > 0.03);
  for (const key of keys) {
    player.att[key] = clamp(player.att[key] + delta * (w[key] / 0.3), 8, 97);
  }
  player.value = marketValue(player);
}
