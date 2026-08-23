import { clamp } from './rng.js';
import { shortName } from './players.js';
import { slotsOf } from './formations.js';

// The match engine. It is a stepper rather than a one-shot function so the UI
// can run a minute at a time, pause, and let the manager make substitutions.

const MENTALITY = {
  defensive: { att: 0.86, def: 1.13, rate: 0.84, quality: 0.94, counter: 1.18 },
  balanced:  { att: 1.00, def: 1.00, rate: 1.00, quality: 1.00, counter: 1.00 },
  attacking: { att: 1.13, def: 0.88, rate: 1.19, quality: 1.04, counter: 0.86 },
};

const PRESS = {
  low:    { mid: 0.96, def: 1.03, drain: 0.86, foul: 0.82, turnover: 0.85 },
  medium: { mid: 1.00, def: 1.00, drain: 1.00, foul: 1.00, turnover: 1.00 },
  high:   { mid: 1.06, def: 0.99, drain: 1.28, foul: 1.26, turnover: 1.25 },
};

const TEMPO = {
  slow:   { rate: 0.88, oppRate: 0.94, quality: 1.06, drain: 0.92 },
  normal: { rate: 1.00, oppRate: 1.00, quality: 1.00, drain: 1.00 },
  fast:   { rate: 1.14, oppRate: 1.07, quality: 0.95, drain: 1.16 },
};

const BASE_CHANCE_RATE = 0.104;   // shots per minute at parity
const HOME_ATT = 1.07;
const HOME_RATE = 1.10;

const INJURY_NOTES = [
  ['knock', 3, 8], ['dead leg', 4, 10], ['hamstring strain', 10, 26], ['twisted ankle', 8, 22],
  ['groin strain', 9, 20], ['bruised ribs', 6, 14], ['shoulder injury', 12, 30], ['knee ligaments', 25, 70],
];

function makeRecord(player, role, started) {
  return {
    id: player.id,
    p: player,
    role,
    started,
    on: started,
    minutes: 0,
    rating: 6.5,
    goals: 0,
    assists: 0,
    shots: 0,
    saves: 0,
    yellow: 0,
    red: 0,
    condition: player.condition,
    injuryDays: 0,
    injuryNote: '',
    offMinute: null,
    onMinute: started ? 0 : null,
  };
}

function buildSide(input, isHome) {
  const slots = slotsOf(input.tactics.formation);
  const records = [];
  input.lineup.forEach((p, i) => {
    if (!p) return;
    records.push(makeRecord(p, slots[i] ? slots[i].role : p.pos, true));
  });
  const bench = (input.bench ?? []).map((p) => makeRecord(p, p.pos, false));
  return {
    key: isHome ? 'home' : 'away',
    teamId: input.teamId,
    name: input.name,
    abbr: input.abbr,
    color: input.color,
    isHome,
    tactics: { ...input.tactics },
    records,
    bench,
    subsUsed: 0,
    isUser: !!input.isUser,
    goals: 0,
    stats: { shots: 0, onTarget: 0, xg: 0, fouls: 0, corners: 0, yellow: 0, red: 0, possTicks: 0 },
  };
}

const onPitch = (side) => side.records.filter((r) => r.on);

// Condition and morale turn a rating into what the player is actually managing today.
function live(rec) {
  const cond = 0.72 + 0.28 * (rec.condition / 100);
  const mor = 0.94 + 0.12 * (rec.p.morale / 100);
  const form = 1 + clamp(rec.p.form ?? 0, -10, 10) * 0.008;
  return cond * mor * form;
}

function sectors(side) {
  let gk = 38;
  let def = 0, mid = 0, att = 0, defW = 0, midW = 0, attW = 0, outfield = 0;

  for (const rec of onPitch(side)) {
    const a = rec.p.att;
    const f = live(rec);
    if (rec.role === 'GK') { gk = a.gk * f; continue; }
    outfield++;
    const dw = rec.role === 'DF' ? 1.0 : rec.role === 'MF' ? 0.5 : 0.16;
    const mw = rec.role === 'DF' ? 0.32 : rec.role === 'MF' ? 1.0 : 0.3;
    const aw = rec.role === 'DF' ? 0.1 : rec.role === 'MF' ? 0.5 : 1.0;
    def += dw * (a.def * 0.72 + a.phy * 0.28) * f; defW += dw;
    mid += mw * (a.pas * 0.6 + a.def * 0.2 + a.phy * 0.2) * f; midW += mw;
    att += aw * (a.sht * 0.55 + a.pac * 0.27 + a.pas * 0.18) * f; attW += aw;
  }

  const men = MENTALITY[side.tactics.mentality] ?? MENTALITY.balanced;
  const press = PRESS[side.tactics.pressing] ?? PRESS.medium;
  // Playing short-handed hurts even though the average of who is left may not move.
  const shortHanded = 0.62 + 0.38 * (outfield / 10);

  return {
    gk,
    def: (defW ? def / defW : 30) * men.def * press.def * shortHanded,
    mid: (midW ? mid / midW : 30) * press.mid * shortHanded,
    att: (attW ? att / attW : 30) * men.att * (0.72 + 0.28 * (outfield / 10)),
    outfield,
  };
}

export class MatchSim {
  constructor({ home, away, rng, neutral = false, competition = 'League' }) {
    this.rng = rng;
    this.neutral = neutral;
    this.competition = competition;
    this.home = buildSide(home, !neutral);
    this.away = buildSide(away, false);
    this.minute = 0;
    this.events = [];
    this.finished = false;
    this.half = 1;
    this.stoppage = { first: rng.int(1, 3), second: rng.int(2, 5) };
    this.firstHalfEnd = 45 + this.stoppage.first;
    this.fullTime = 90 + this.stoppage.first + this.stoppage.second;
    this.pendingHalfTime = false;
    this.pushEvent({ type: 'kickoff', text: `Kick-off at ${home.stadium ?? 'the ground'}. ${this.home.name} in ${describeColour(this.home.color)}.` });
  }

  get score() { return [this.home.goals, this.away.goals]; }

  // The minute as supporters would say it: 45+2, 90+3.
  get clock() {
    if (this.minute <= 45) return String(this.minute);
    if (this.minute <= this.firstHalfEnd) return `45+${this.minute - 45}`;
    const second = this.minute - this.stoppage.first;
    if (second <= 90) return String(second);
    return `90+${second - 90}`;
  }

  pushEvent(ev) {
    const event = { minute: this.minute, clock: this.clock, side: null, ...ev };
    this.events.push(event);
    return event;
  }

  sideOf(key) { return key === 'home' ? this.home : this.away; }
  other(side) { return side === this.home ? this.away : this.home; }

  setTactics(key, patch) {
    const side = this.sideOf(key);
    Object.assign(side.tactics, patch);
    this.pushEvent({ type: 'note', side: side.key, text: `${side.name} change shape: ${side.tactics.formation}, ${side.tactics.mentality}.` });
  }

  canSub(key) {
    const side = this.sideOf(key);
    return side.subsUsed < 5 && side.bench.some((b) => b.on === false && b.offMinute === null && b.onMinute === null);
  }

  substitute(key, outId, inId) {
    const side = this.sideOf(key);
    const out = side.records.find((r) => r.id === outId && r.on);
    const inc = side.bench.find((r) => r.id === inId && !r.on && r.onMinute === null);
    if (!out || !inc || side.subsUsed >= 5) return false;
    out.on = false;
    out.offMinute = this.minute;
    inc.on = true;
    inc.onMinute = this.minute;
    inc.role = out.role;
    side.records.push(inc);
    side.bench = side.bench.filter((b) => b.id !== inId);
    side.subsUsed++;
    this.pushEvent({
      type: 'sub', side: side.key, playerId: inc.id,
      text: `${side.abbr} sub: ${shortName(inc.p)} on for ${shortName(out.p)}.`,
    });
    return true;
  }

  benchFor(key) { return this.sideOf(key).bench; }
  onPitchFor(key) { return onPitch(this.sideOf(key)); }

  step() {
    if (this.finished) return [];
    const before = this.events.length;

    if (this.pendingHalfTime) {
      this.pendingHalfTime = false;
      this.half = 2;
      this.pushEvent({ type: 'note', text: 'Second half under way.' });
    }

    this.minute++;
    this.simulateMinute();

    if (this.minute === this.firstHalfEnd) {
      this.pushEvent({ type: 'halftime', text: `Half-time: ${this.home.abbr} ${this.home.goals}-${this.away.goals} ${this.away.abbr}` });
      this.pendingHalfTime = true;
    }
    if (this.minute >= this.fullTime) this.end();

    return this.events.slice(before);
  }

  runToEnd() {
    let guard = 0;
    while (!this.finished && guard++ < 400) this.step();
    return this.result();
  }

  simulateMinute() {
    const H = sectors(this.home);
    const A = sectors(this.away);

    // Possession is a midfield battle, with a nudge for the home crowd.
    let possHome = H.mid / Math.max(1, H.mid + A.mid);
    if (!this.neutral) possHome += 0.025;
    possHome = clamp(possHome, 0.22, 0.78);
    this.home.stats.possTicks += possHome;
    this.away.stats.possTicks += 1 - possHome;

    this.tryChance(this.home, this.away, H, A, possHome);
    this.tryChance(this.away, this.home, A, H, 1 - possHome);

    this.tryFoul(possHome);
    this.drainStamina();
    this.tryInjury();
    this.autoSubs();
  }

  chanceRate(side, opp, S, O, possShare) {
    const men = MENTALITY[side.tactics.mentality] ?? MENTALITY.balanced;
    const tempo = TEMPO[side.tactics.tempo] ?? TEMPO.normal;
    const oppTempo = TEMPO[opp.tactics.tempo] ?? TEMPO.normal;
    const ratio = S.att / Math.max(1, S.att + O.def);
    let rate = BASE_CHANCE_RATE * Math.pow(ratio / 0.5, 1.9) * men.rate * tempo.rate * oppTempo.oppRate;
    rate *= 0.55 + 0.9 * possShare;
    if (side.isHome) rate *= HOME_RATE;
    // Chasing a game late opens things up.
    const deficit = opp.goals - side.goals;
    if (this.minute > 55 && deficit > 0) rate *= 1 + Math.min(0.35, deficit * 0.12);
    if (this.minute > 70 && deficit < 0) rate *= 0.92;
    return rate;
  }

  tryChance(side, opp, S, O, possShare) {
    const rng = this.rng;
    if (!rng.chance(this.chanceRate(side, opp, S, O, possShare))) return;

    const men = MENTALITY[side.tactics.mentality] ?? MENTALITY.balanced;
    const tempo = TEMPO[side.tactics.tempo] ?? TEMPO.normal;
    const shooter = this.pickShooter(side);
    if (!shooter) return;

    // Chance quality: mostly half-openings, occasionally a sitter.
    const q = rng.next();
    const attackEdge = clamp(S.att / Math.max(1, O.def), 0.6, 1.7);
    let xg = (0.014 + 0.40 * Math.pow(q, 3)) * men.quality * tempo.quality * (0.75 + 0.35 * attackEdge);
    if (side.isHome) xg *= HOME_ATT;
    xg = clamp(xg, 0.01, 0.92);

    side.stats.shots++;
    side.stats.xg += xg;
    shooter.shots++;

    const keeper = onPitch(opp).find((r) => r.role === 'GK');
    const keeperSkill = keeper ? keeper.p.att.gk * live(keeper) : 34;
    const finishing = 0.82 + 0.36 * (shooter.p.att.sht * live(shooter)) / 82;
    const keeping = 0.84 + 0.32 * keeperSkill / 82;
    const goalChance = clamp((xg * finishing) / keeping, 0.005, 0.95);

    if (rng.chance(goalChance)) {
      this.scoreGoal(side, opp, shooter, xg, keeper);
      return;
    }

    // No goal: was it on target, blocked, or dragged wide?
    const onTargetChance = clamp(0.24 + xg * 0.5, 0.18, 0.62);
    if (rng.chance(onTargetChance)) {
      side.stats.onTarget++;
      if (keeper) {
        keeper.saves++;
        keeper.rating += xg > 0.3 ? 0.3 : 0.1;
      }
      if (xg > 0.22 || rng.chance(0.35)) {
        this.pushEvent({
          type: 'save', side: side.key, playerId: shooter.id,
          text: pick(rng, [
            `${shortName(shooter.p)} works ${keeper ? shortName(keeper.p) : 'the keeper'} with a low drive — saved.`,
            `Save! ${keeper ? shortName(keeper.p) : 'The keeper'} turns ${shortName(shooter.p)}'s effort away.`,
            `${shortName(shooter.p)} makes the keeper earn it, ${side.abbr} come again.`,
          ]),
        });
      }
    } else if (rng.chance(0.28)) {
      side.stats.corners++;
      if (rng.chance(0.4)) {
        this.pushEvent({ type: 'chance', side: side.key, text: `Deflected behind. Corner ${side.abbr}.` });
      }
    } else {
      shooter.rating -= xg > 0.35 ? 0.25 : 0.04;
      if (xg > 0.3 || rng.chance(0.22)) {
        this.pushEvent({
          type: 'miss', side: side.key, playerId: shooter.id,
          text: xg > 0.3
            ? pick(rng, [
                `Big chance! ${shortName(shooter.p)} pulls it wide with the goal at his mercy.`,
                `${shortName(shooter.p)} should score — over the bar from twelve yards.`,
              ])
            : pick(rng, [
                `${shortName(shooter.p)} tries his luck from distance, wide.`,
                `Ambitious from ${shortName(shooter.p)}, into the crowd.`,
              ]),
        });
      }
    }
  }

  scoreGoal(side, opp, shooter, xg, keeper) {
    const rng = this.rng;
    side.goals++;
    side.stats.onTarget++;
    shooter.goals++;
    shooter.rating += shooter.role === 'GK' ? 2 : shooter.role === 'DF' ? 1.4 : shooter.role === 'MF' ? 1.25 : 1.1;

    let assist = null;
    const mates = onPitch(side).filter((r) => r.id !== shooter.id && r.role !== 'GK');
    if (mates.length && rng.chance(0.68)) {
      assist = rng.weighted(mates, (r) => (r.p.att.pas * (r.role === 'MF' ? 1.6 : r.role === 'FW' ? 1.2 : 0.6)));
      assist.assists++;
      assist.rating += 0.7;
    }

    for (const rec of onPitch(opp)) {
      if (rec.role === 'GK') rec.rating -= 0.3;
      else if (rec.role === 'DF') rec.rating -= 0.16;
      else if (rec.role === 'MF') rec.rating -= 0.05;
    }

    const finish = xg > 0.45
      ? pick(rng, ['taps it into an empty net', 'cannot miss from there', 'slots it past the keeper'])
      : xg > 0.18
        ? pick(rng, ['sweeps it into the bottom corner', 'buries it first time', 'heads it home', 'turns and finishes'])
        : pick(rng, ['lashes it in from range', 'curls a beauty into the top corner', 'finishes from an impossible angle']);

    this.pushEvent({
      type: 'goal', side: side.key, playerId: shooter.id,
      text: `GOAL! ${side.abbr} ${this.home === side ? '' : ''}${shortName(shooter.p)} ${finish}${assist ? `, set up by ${shortName(assist.p)}` : ''}. ${this.home.abbr} ${this.home.goals}-${this.away.goals} ${this.away.abbr}`,
    });
  }

  pickShooter(side) {
    const players = onPitch(side).filter((r) => r.role !== 'GK');
    if (!players.length) return null;
    return this.rng.weighted(players, (r) => {
      const base = r.role === 'FW' ? 3.2 : r.role === 'MF' ? 1.35 : 0.32;
      return base * (0.5 + (r.p.att.sht * live(r)) / 100);
    });
  }

  tryFoul(possHome) {
    const rng = this.rng;
    const homePress = PRESS[this.home.tactics.pressing] ?? PRESS.medium;
    const awayPress = PRESS[this.away.tactics.pressing] ?? PRESS.medium;
    const rate = 0.26 * ((homePress.foul + awayPress.foul) / 2);
    if (!rng.chance(rate)) return;

    // The side without the ball does most of the fouling.
    const side = rng.chance(possHome) ? this.away : this.home;
    const candidates = onPitch(side).filter((r) => r.role !== 'GK');
    if (!candidates.length) return;
    const offender = rng.weighted(candidates, (r) =>
      (r.role === 'DF' ? 1.6 : r.role === 'MF' ? 1.4 : 0.7) * (1 + (100 - r.p.att.def) / 140) * (r.yellow ? 0.5 : 1));
    side.stats.fouls++;

    const press = PRESS[side.tactics.pressing] ?? PRESS.medium;
    // A booked player is warier, and the bench is warned to be ready.
    const cardChance = 0.145 * press.foul * (offender.yellow ? 0.3 : 1);
    if (!rng.chance(cardChance)) return;

    if (rng.chance(0.018)) {
      offender.red = 1;
      offender.rating -= 1.6;
      offender.on = false;
      offender.offMinute = this.minute;
      side.stats.red++;
      this.pushEvent({ type: 'red', side: side.key, playerId: offender.id, text: `RED CARD. ${shortName(offender.p)} is sent off. ${side.abbr} down to ${onPitch(side).length}.` });
      return;
    }

    offender.yellow++;
    offender.rating -= 0.3;
    side.stats.yellow++;
    if (offender.yellow >= 2) {
      offender.red = 1;
      offender.rating -= 1.1;
      offender.on = false;
      offender.offMinute = this.minute;
      side.stats.red++;
      this.pushEvent({ type: 'red', side: side.key, playerId: offender.id, text: `Second yellow — ${shortName(offender.p)} is off. ${side.abbr} down to ${onPitch(side).length}.` });
    } else {
      this.pushEvent({ type: 'yellow', side: side.key, playerId: offender.id, text: `Booked: ${shortName(offender.p)} for a late one.` });
    }
  }

  drainStamina() {
    for (const side of [this.home, this.away]) {
      const press = PRESS[side.tactics.pressing] ?? PRESS.medium;
      const tempo = TEMPO[side.tactics.tempo] ?? TEMPO.normal;
      const short = onPitch(side).length < 11 ? 1.15 : 1;
      for (const rec of onPitch(side)) {
        rec.minutes++;
        const base = rec.role === 'GK' ? 0.12 : 0.55;
        const fitness = 0.72 + 0.5 * (1 - rec.p.att.phy / 100);
        rec.condition = clamp(rec.condition - base * fitness * press.drain * tempo.drain * short, 4, 100);
      }
    }
  }

  tryInjury() {
    const rng = this.rng;
    for (const side of [this.home, this.away]) {
      if (!rng.chance(0.0016)) continue;
      const players = onPitch(side);
      if (!players.length) continue;
      const victim = rng.weighted(players, (r) => 1 + (100 - r.condition) / 55);
      const [note, lo, hi] = rng.pick(INJURY_NOTES);
      victim.injuryNote = note;
      victim.injuryDays = rng.int(lo, hi);
      victim.condition = clamp(victim.condition - 25, 4, 100);
      this.pushEvent({ type: 'injury', side: side.key, playerId: victim.id, text: `${shortName(victim.p)} is down — looks like a ${note}.` });
      // Straight off if the bench allows it.
      if (victim.injuryDays > 5 && side.subsUsed < 5 && side.bench.length) {
        const replacement = this.bestBenchFor(side, victim.role);
        if (replacement) this.substitute(side.key, victim.id, replacement.id);
        else if (rng.chance(0.5)) { victim.on = false; victim.offMinute = this.minute; }
      }
    }
  }

  bestBenchFor(side, role) {
    const exact = side.bench.filter((b) => b.p.pos === role);
    const pool = exact.length ? exact : side.bench.filter((b) => b.p.pos !== 'GK' || role === 'GK');
    if (!pool.length) return null;
    return pool.reduce((best, b) => (rate(b) > rate(best) ? b : best));
    function rate(b) { return b.p.att.pas + b.p.att.def + b.p.att.sht + b.p.att.pac + b.p.att.phy + (b.p.pos === role ? 60 : 0); }
  }

  // Computer-managed sides look after themselves. The user's side only gets
  // help if they asked for it.
  autoSubs() {
    for (const side of [this.home, this.away]) {
      if (side.isUser && !side.autoSubs) continue;
      if (side.subsUsed >= 3 || !side.bench.length) continue;
      if (![58, 65, 72, 79].includes(this.minute)) continue;
      const tired = onPitch(side)
        .filter((r) => r.role !== 'GK' && r.condition < 62)
        .sort((a, b) => a.condition - b.condition)[0];
      if (!tired) continue;
      const replacement = this.bestBenchFor(side, tired.role);
      if (replacement && replacement.p.att.phy > 0) this.substitute(side.key, tired.id, replacement.id);
    }

    // A losing computer side rolls the dice late on.
    for (const side of [this.home, this.away]) {
      if (side.isUser) continue;
      if (this.minute !== 70) continue;
      const opp = this.other(side);
      if (opp.goals > side.goals && side.tactics.mentality !== 'attacking') {
        side.tactics.mentality = 'attacking';
        this.pushEvent({ type: 'note', side: side.key, text: `${side.name} throw men forward.` });
      } else if (side.goals - opp.goals >= 2 && side.tactics.mentality === 'attacking') {
        side.tactics.mentality = 'balanced';
      }
    }
  }

  end() {
    this.finished = true;
    const homeWin = this.home.goals > this.away.goals;
    const draw = this.home.goals === this.away.goals;

    for (const side of [this.home, this.away]) {
      const opp = this.other(side);
      const won = side.goals > opp.goals;
      const clean = opp.goals === 0;
      for (const rec of side.records) {
        if (rec.minutes === 0) continue;
        if (clean) {
          if (rec.role === 'GK') rec.rating += 0.5;
          else if (rec.role === 'DF') rec.rating += 0.35;
        }
        rec.rating += won ? 0.22 : side.goals === opp.goals ? 0 : -0.22;
        // Cameos regress towards a neutral mark.
        if (rec.minutes < 25) rec.rating = 6.5 + (rec.rating - 6.5) * (0.45 + rec.minutes / 50);
        rec.rating = clamp(Math.round(rec.rating * 10) / 10, 3, 10);
      }
    }

    this.pushEvent({
      type: 'fulltime',
      text: `Full time. ${this.home.name} ${this.home.goals}-${this.away.goals} ${this.away.name}.` +
        (draw ? ' A point apiece.' : ` ${homeWin ? this.home.name : this.away.name} take it.`),
    });
  }

  result() {
    const pack = (side) => ({
      teamId: side.teamId,
      goals: side.goals,
      possession: Math.round((side.stats.possTicks / Math.max(1, this.minute)) * 100),
      shots: side.stats.shots,
      onTarget: side.stats.onTarget,
      xg: Math.round(side.stats.xg * 100) / 100,
      fouls: side.stats.fouls,
      corners: side.stats.corners,
      yellow: side.stats.yellow,
      red: side.stats.red,
      players: side.records.map((r) => ({
        id: r.id,
        name: r.p.name,
        pos: r.p.pos,
        role: r.role,
        started: r.started,
        minutes: r.minutes,
        rating: r.rating,
        goals: r.goals,
        assists: r.assists,
        saves: r.saves,
        yellow: r.yellow,
        red: r.red,
        condition: Math.round(r.condition),
        injuryDays: r.injuryDays,
        injuryNote: r.injuryNote,
      })),
    });

    const home = pack(this.home);
    const away = pack(this.away);
    // Possession is rounded per side; make the pair add up.
    away.possession = 100 - home.possession;

    return {
      homeId: this.home.teamId,
      awayId: this.away.teamId,
      homeGoals: this.home.goals,
      awayGoals: this.away.goals,
      home,
      away,
      events: this.events,
      scorers: this.events.filter((e) => e.type === 'goal').map((e) => ({ minute: e.minute, clock: e.clock, side: e.side, playerId: e.playerId })),
    };
  }
}

function pick(rng, arr) { return arr[Math.floor(rng.next() * arr.length)]; }

function describeColour(hex) {
  if (!hex) return 'their usual kit';
  const map = [
    ['#f2c14e', 'gold'], ['#3d7bd6', 'blue'], ['#2f9e6b', 'green'], ['#c0562f', 'rust'],
    ['#d94f4f', 'red'], ['#7d5bbe', 'purple'], ['#2ba3a3', 'teal'], ['#e0873c', 'orange'],
    ['#4bb2e8', 'sky blue'], ['#9aa63f', 'olive'], ['#c9a227', 'yellow'], ['#b8804f', 'sand'],
  ];
  const found = map.find(([h]) => h === hex);
  return found ? found[1] : 'their usual kit';
}

/** Attack / midfield / defence ratings for a side, for the tactics screen. */
export function strengthPreview(sideInput) {
  return sectors(buildSide(sideInput, false));
}

/** Convenience for simulating a fixture with no interaction. */
export function quickMatch(home, away, rng, opts = {}) {
  const sim = new MatchSim({ home, away, rng, ...opts });
  return sim.runToEnd();
}
