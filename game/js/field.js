/* field.js — the other people on the ladder.

   Until now a rival was a name attached to a number, useful only as something
   to leak about. This is the rest of the party: two dozen invented politicians
   who hold the rungs you want, climb them while you are climbing, and are the
   reason a contest is lost. You do not lose a conference to a difficulty
   rating. You lose it to somebody, and then you watch them do the job.

   Every figure sits at a rung index on the same ladder the player is on.
   `contender()` answers the only question that matters at a contest: who is
   standing in the doorway, and how strong are they today?
*/
(function () {
  'use strict';

  var C100 = RZ.c100, clamp = RZ.clamp;

  // The offices there can only ever be one of. Below this, a rung is a class of
  // people — there are ninety MPs — and contesting it means beating a peer to
  // an opening, not unseating an incumbent.
  function isSingular(rung) { return rung.tier >= 9; }

  function lad(S) { return RZ.ladderFor(S.countryId); }

  /* ---------------------------------------------------------------
     Making people
     --------------------------------------------------------------- */
  function mk(S, rungIdx, opts) {
    opts = opts || {};
    var c = RZ.COUNTRIES[S.countryId];
    var L = lad(S);
    rungIdx = clamp(rungIdx, 0, L.length - 1);
    var f = RZ.makeNpc(c, {
      partyId: opts.partyId || S.player.partyId,
      regionId: opts.regionId,
      // seniority is earned: nobody arrives at the top weak
      power: opts.power !== undefined ? opts.power
           : Math.round(clamp(24 + rungIdx * 4.4 + RZ.range(-9, 12), 8, 96))
    });
    f.rungIdx = rungIdx;
    f.role = L[rungIdx].title;
    f.side = opts.side || 'neutral';   // neutral | rival | ally
    f.since = S.date.year;
    f.wounded = 0;                     // decays; a wounded figure is beatable
    f.retired = false;
    f.fate = null;
    return dress(S, f);
  }

  // How hard this person is to beat, right now.
  function strength(f) {
    return f.power + f.ambition * 0.22 - f.wounded * 9;
  }

  /* ---------------------------------------------------------------
     What they have, in the same currencies the player has it in

     A contest used to compare the player's six growing standings against a
     single scalar difficulty, which is why the player won ninety per cent of
     them: one side of the comparison grew all career and the other did not.
     Figures carry the same three standings and a local base, and the scoring
     below is deliberately the same arithmetic for both sides.
     --------------------------------------------------------------- */

  // A politician is not strong at everything. What a figure is made of follows
  // from the faction they belong to: the machine man has the register, the
  // radical has the street, the reformer has the newspapers.
  var SHAPE = {
    machine:  { party: 1.22, grassroots: 0.92, fame: 0.72 },
    radical:  { party: 0.78, grassroots: 1.24, fame: 1.00 },
    reform:   { party: 0.86, grassroots: 0.82, fame: 1.26 },
    old:      { party: 1.14, grassroots: 1.06, fame: 0.84 },
    business: { party: 0.98, grassroots: 0.70, fame: 1.06 }
  };

  // Standing is derived, not stored. It was stored, and that was a bug: wounding
  // a rival lowered their `power` while the standing a contest actually reads
  // stayed frozen at the value they were created with, so leaking a file
  // changed nothing about beating them. Deriving it means power, seniority and
  // damage all flow through to the vote.
  //
  // Only the per-person jitter is kept, so a figure stays recognisably
  // themselves between one month and the next.
  function dress(S, f) {
    f.jitter = { party: RZ.range(-7, 7), grassroots: RZ.range(-7, 7),
                 fame: RZ.range(-7, 7), base: RZ.range(-6, 10) };
    return f;
  }

  function standingOf(S, f) {
    var m = SHAPE[f.faction] || SHAPE.machine;
    var L = lad(S);
    var j = f.jitter || { party: 0, grassroots: 0, fame: 0, base: 0 };
    // Somebody holding an office cleared the bar that office demands — that is
    // what makes them a peer of a player who has only just cleared it too.
    var req = (L[f.rungIdx] || {}).req || {};
    var bar = Math.max(req.grassroots || 0, req.party || 0, req.fame || 0);
    var lvl = Math.max(20 + f.rungIdx * 3.2 + (f.power - 50) * 0.45, bar * 0.95);
    var hurt = (f.wounded || 0) * 5;          // a damaged politician commands less

    // The faction shape says what somebody is *made of*, but it must not put
    // them below what their own office demanded of them: a sitting member has
    // the grassroots of a sitting member whatever their faction, or a
    // challenger walks into a constituency held by a man with no branches.
    // That was the single biggest reason contests were a formality.
    function axis(mult, floor, jit) {
      return C100(Math.max(lvl * mult, floor * 0.92) - hurt + jit);
    }
    return {
      party: axis(m.party, req.party || 0, j.party),
      grassroots: axis(m.grassroots, req.grassroots || 0, j.grassroots),
      fame: axis(m.fame, req.fame || 0, j.fame),
      // Where they are from they are known, and if they hold the seat they are
      // known well. Everywhere else they are a name.
      base: C100(Math.max(lvl * 1.35, (req.grassroots || 0) * 0.95) - hurt + j.base)
    };
  }

  // Older saves from before figures carried a jitter.
  function ensureDressed(S, f) {
    if (!f.jitter) dress(S, f);
    return f;
  }

  // How much of a figure's local base counts in a given region.
  function baseIn(f, st, regionId) {
    return f.regionId === regionId ? st.base : st.base * 0.26;
  }

  /* --- the two scoring functions, each used for both sides --- */

  // A selection contest inside one constituency: branch chairs, a nomination.
  function primaryScore(who, regionId) {
    return who.here * 1.15 + who.grassroots * 0.65 + who.party * 0.45 +
           who.fame * 0.25 + who.charisma * 0.16 + who.spend * 0.6;
  }

  // A national delegate contest: how many of one region's delegates come to you.
  function conferencePull(who) {
    return who.here * 0.9 + who.party * 0.55 + who.fame * 0.30 +
           who.leader * 0.10 + who.charisma * 0.16 + who.security +
           who.slate + who.spend * 0.5;
  }

  // The player, expressed in the shape the scorers above expect.
  function playerSide(S, regionId) {
    var c = RZ.COUNTRIES[S.countryId], P = S.player;
    return {
      // Away from your own district you are whatever your name is worth. A
      // national figure has a floor everywhere, which is most of what fame is
      // for at a conference: delegates from a province you have never worked
      // still know who you are.
      // Low down the ladder, most of what "here" means is whether the person
      // who keeps the register has put your name on the list.
      here: Math.max(P.regionSupport[regionId] || 0, P.fame * 0.28) +
            (RZ.trenches ? RZ.trenches.listBonus(S, regionId) : 0),
      // "Grassroots" is an average of six electorates who want different
      // things. What counts in a hall is which of them actually turned up, so
      // the bloc swing is folded in here rather than at each contest.
      grassroots: P.standing.grassroots + (RZ.blocs ? RZ.blocs.swing(S) : 0),
      party: P.standing.party, fame: P.fame,
      leader: P.standing.leader, charisma: P.stats.charisma,
      security: P.standing.security * (c.inst.security / 170),
      slate: Math.min(8, allies(S).length) * 2.5,
      spend: S.campaign.delegateSpend || 0
    };
  }

  // A figure, expressed the same way. Where the player has allies and money,
  // an incumbent has the machine and the years — so those are what fill the
  // same slots.
  // A party does not put up a nobody against somebody strong. When a challenger
  // is visibly ahead of what the office asks for, the people who would
  // otherwise have split the vote stand aside and the machine consolidates
  // behind one candidate. This is why running the score up has diminishing
  // returns: past a point you are not buying a bigger margin, you are buying a
  // better-organised opponent.
  function consolidation(S, targetIdx) {
    if (targetIdx === undefined) return 0;
    var L = lad(S), P = S.player;
    var req = (L[targetIdx] || {}).req || {};
    var bar = Math.max(req.grassroots || 0, req.party || 0, req.fame || 0, 20);
    var mine = Math.max(P.standing.grassroots, P.standing.party, P.fame);
    return clamp((mine - bar) * 0.55, 0, 26);
  }

  function figureSide(S, f, regionId, incumbent, targetIdx) {
    var c = RZ.COUNTRIES[S.countryId];
    ensureDressed(S, f);
    var st = standingOf(S, f);
    var machine = (S.parties[f.partyId] ? S.parties[f.partyId].machine : 50) - 50;
    return {
      here: baseIn(f, st, regionId),
      grassroots: st.grassroots, party: st.party, fame: st.fame,
      leader: incumbent ? 70 : 40, charisma: 40 + f.ambition * 0.2,
      security: (incumbent ? c.inst.security : c.inst.security * 0.4) / 170 * 40,
      // The organisation an incumbent inherits with the office, against the
      // slate the player had to build by hand. Kept modest: it is meant to be
      // an advantage, not a wall.
      slate: (incumbent ? 10 : 3) + machine * 0.16 + c.inst.incumbency * 0.07 +
             consolidation(S, targetIdx),
      spend: (c.inst.patronage / 100) * (incumbent ? 14 : 6)
    };
  }

  RZ._contestScorers = { primaryScore: primaryScore, conferencePull: conferencePull };

  function live(S) {
    return (S.field || []).filter(function (f) { return f.alive && !f.retired; });
  }
  function ours(S) {
    var pid = S.player.partyId;
    return live(S).filter(function (f) { return f.partyId === pid; });
  }
  function byId(S, id) {
    return (S.field || []).filter(function (f) { return f.id === id; })[0] || null;
  }
  function at(S, rungIdx) {
    return ours(S).filter(function (f) { return f.rungIdx === rungIdx; });
  }
  function strongestFirst(list) {
    return list.slice().sort(function (a, b) { return strength(b) - strength(a); });
  }

  /* ---------------------------------------------------------------
     Populating the party
     --------------------------------------------------------------- */
  // A party is a pyramid: crowded at the bottom, one chair at the top.
  function seatsAt(L, i) {
    if (i >= L.length - 1) return 1;
    return isSingular(L[i]) ? 1 : 2;
  }

  function populate(S) {
    var L = lad(S);
    S.field = [];
    var home = S.player.regionId;
    var top = L.length - 1, li0 = leaderIdx(S);
    for (var i = 1; i < L.length; i++) {
      var n = seatsAt(L, i);
      // The head of state's rung is not a separate person: where our party
      // governs, the party leader holds it. Only where there is no party
      // leadership at all (an absolute monarchy) is the top rung seated.
      if (i === top && li0 !== top) n = 0;
      for (var k = 0; k < n; k++) {
        // the person one rung above you is, by definition, in your way, and
        // most often they are in your way in your own district
        var opts = {};
        if (i <= 4 && k === 0) opts.regionId = home;
        S.field.push(mk(S, i, opts));
      }
    }
    // The one directly above you has noticed you, and does not like it.
    var above = strongestFirst(at(S, 1))[0];
    if (above) { above.side = 'rival'; above.regionId = home; }
    syncLeadership(S);
    return S.field;
  }

  // Called when the player crosses the floor: a new party is a new cast, and
  // the people you left behind become the people who want you finished.
  function repopulate(S, oldPartyId) {
    var keep = live(S).filter(function (f) { return f.partyId === oldPartyId; })
      .sort(function (a, b) { return strength(b) - strength(a); }).slice(0, 3);
    keep.forEach(function (f) { f.side = 'rival'; });
    populate(S);
    S.field = keep.concat(S.field);
    syncLeadership(S);
  }

  /* ---------------------------------------------------------------
     Leadership — the two chairs that have names attached elsewhere
     --------------------------------------------------------------- */
  function leaderIdx(S) {
    var L = lad(S);
    for (var i = L.length - 1; i >= 0; i--) if (L[i].id === 'leader') return i;
    return L.length - 1;   // where there is no party leadership, the top job is it
  }

  // One chair, one occupant. When two people end up holding the same singular
  // office — a promotion and a demotion landing in the same month — the weaker
  // one goes back a step, or out altogether if there is nowhere to go.
  function enforceSingular(S) {
    var L = lad(S);
    for (var i = 1; i < L.length; i++) {
      if (!isSingular(L[i])) continue;
      var sitting = strongestFirst(at(S, i));
      // The player counts as an occupant. Where there is no separate party
      // leadership — Eswatini, where the top rung is the whole of it — this is
      // the only thing standing between the player holding an office and
      // somebody in the field being recorded as holding it as well.
      var keep = S.player.rungIdx === i ? 0 : 1;
      for (var k = keep; k < sitting.length; k++) {
        var f = sitting[k], placed = false;
        for (var j = i - 1; j >= 1; j--) {
          if (at(S, j).length < seatsAt(L, j) && S.player.rungIdx !== j) {
            f.rungIdx = j; f.role = L[j].title; placed = true; break;
          }
        }
        if (!placed) retire(S, f, 'squeezed');
      }
    }
  }

  // Keeps the party leadership pointing at a real person, promoting from below
  // when the chair falls empty.
  //
  // Nobody from our party is ever seated on the head of state's rung: where our
  // party governs, the leader IS the head of state, and a person holds exactly
  // one office. Seating them twice was how two leaders appeared at once.
  function syncLeadership(S) {
    var L = lad(S), P = S.player, pid = P.partyId;
    var li = leaderIdx(S), hi = L.length - 1;
    var st = S.parties[pid];
    if (!st) return;

    if (hi !== li) at(S, hi).forEach(function (f) { f.rungIdx = li; f.role = L[li].title; });
    enforceSingular(S);

    // You hold it — either by winning the party leadership, or because in this
    // system the leadership is not a separate office from the one you are in.
    if (P.isLeader || P.rungIdx === li) {
      // Anybody still sitting in that chair is moved out of it.
      at(S, li).forEach(function (f) {
        f.rungIdx = Math.max(1, li - 1);
        f.role = L[f.rungIdx].title;
      });
      st.leaderId = null;
      st.leaderName = P.name;
    } else {
      var held = strongestFirst(at(S, li))[0];
      if (!held) {
        // the deputy steps up, or the strongest person left standing does
        var next = strongestFirst(ours(S).filter(function (f) {
          return f.rungIdx < li && f.rungIdx >= li - 3;
        }))[0];
        if (next) { next.rungIdx = li; next.role = L[li].title; next.since = S.date.year; held = next; }
      }
      if (held) {
        st.leaderId = held.id;
        st.leaderName = held.name;
        st.leaderQuality = Math.round(clamp(held.power * 0.9 + 8 - held.wounded * 6, 8, 96));
        held.role = L[li].title;
        S.flags.leaderWounded = held.wounded > 0;
      }
    }

    // The head of state's name, where the office is held by our party and not
    // by the player personally.
    if (!P.isPresident && S.nation.presidentParty === pid && st.leaderName) {
      S.nation.presidentName = st.leaderName;
    }
  }

  /* ---------------------------------------------------------------
     Who is in your way
     --------------------------------------------------------------- */
  // The person you are actually up against for `rungIdx`. For a singular
  // office that is whoever holds it; for everything else it is the peer most
  // likely to take the opening ahead of you.
  function contender(S, rungIdx) {
    var L = lad(S);
    if (rungIdx < 0 || rungIdx >= L.length) return null;
    var sitting = at(S, rungIdx);

    if (isSingular(L[rungIdx]) && sitting.length) {
      return { fig: strongestFirst(sitting)[0], incumbent: true, targetIdx: rungIdx };
    }
    var pool = sitting.concat(at(S, rungIdx - 1));
    if (!pool.length) return null;
    var best = pool.slice().sort(function (a, b) {
      return (strength(b) + b.ambition * 0.3) - (strength(a) + a.ambition * 0.3);
    })[0];
    return { fig: best, incumbent: best.rungIdx === rungIdx, targetIdx: rungIdx };
  }

  // How much of a problem the person in the doorway is, on a scale where 0 is
  // an open field and about 1.3 is a strong incumbent at the top of their
  // powers. Each kind of contest scales this into its own arithmetic, because a
  // branch vote and a national conference do not run on the same numbers.
  function pressure(S, rungIdx) {
    var con = contender(S, rungIdx);
    if (!con) return -0.15;                    // an open field is easier than a contested one
    var f = con.fig;
    var v = (strength(f) - 30) / 70;
    if (con.incumbent) v += 0.28;              // possession is most of the argument
    // a file you have not used is not leverage; a file you have used is
    v -= Math.min(0.45, f.wounded * 0.16);
    return clamp(v, -0.2, 1.35);
  }

  /* ---------------------------------------------------------------
     Consequences
     --------------------------------------------------------------- */
  // You lost. Somebody won, and now they have the job.
  function winsAgainstPlayer(S, rungIdx) {
    var con = contender(S, rungIdx);
    if (!con) return null;
    var f = con.fig;
    if (!con.incumbent) { f.rungIdx = rungIdx; f.role = lad(S)[rungIdx].title; f.since = S.date.year; }
    f.power = clamp(f.power + RZ.range(3, 9), 5, 100);
    f.side = 'rival';
    return f;
  }

  // You won. The person who held it has to go somewhere, and it is never
  // quietly back to the branch that sent them.
  // `known` is the contender resolved *before* the player was promoted. It
  // matters: promoting the player runs enforceSingular, which quietly moves
  // whoever was in a singular chair out of it — so by the time this is called
  // after a win, looking the incumbent up again finds an empty room and the
  // person you actually beat is never recorded as having been beaten.
  function losesToPlayer(S, rungIdx, known) {
    var con = known || contender(S, rungIdx);
    if (!con || !con.incumbent) return null;
    var f = con.fig;
    f.power = clamp(f.power - RZ.range(8, 20), 4, 100);
    f.side = 'rival';
    if (f.power < 20 || RZ.chance(0.3)) {
      retire(S, f, 'beaten');
      return { fig: f, gone: true };
    }
    f.rungIdx = Math.max(1, rungIdx - 1);
    f.role = lad(S)[f.rungIdx].title;
    return { fig: f, gone: false };
  }

  /* ---------------------------------------------------------------
     Sides — who is against you, and who is with you
     --------------------------------------------------------------- */
  function rivals(S) { return strongestFirst(ours(S).filter(function (f) { return f.side === 'rival'; })); }
  function allies(S) { return strongestFirst(ours(S).filter(function (f) { return f.side === 'ally'; })); }

  // Where a new figure can actually stand. A singular office already has an
  // occupant — the player included — so a newcomer walks down the ladder until
  // there is a chair free. This is the only place new people are seated.
  function vacancyNear(S, preferred) {
    var L = lad(S);
    preferred = clamp(preferred, 1, L.length - 2);
    for (var i = preferred; i >= 1; i--) {
      var taken = at(S, i).length + (S.player.rungIdx === i ? 1 : 0);
      if (taken < seatsAt(L, i)) return i;
    }
    return 1;
  }

  // Someone decides you are the problem. Where possible this is a person who
  // already exists — the enemy you make is usually one you already knew.
  function addRival(S, power) {
    var near = ours(S).filter(function (f) {
      return f.side === 'neutral' && f.rungIdx >= S.player.rungIdx && f.rungIdx <= S.player.rungIdx + 3;
    });
    var f;
    if (near.length) {
      f = strongestFirst(near)[0];
    } else {
      f = mk(S, vacancyNear(S, S.player.rungIdx + 1), { power: power });
      S.field.push(f);
    }
    f.side = 'rival';
    if (power !== undefined) f.power = clamp(power, 5, 100);
    syncLeadership(S);
    return f;
  }

  function addAlly(S, power) {
    var near = ours(S).filter(function (f) {
      return f.side === 'neutral' && f.rungIdx <= S.player.rungIdx + 1;
    });
    var f;
    if (near.length) {
      f = strongestFirst(near)[0];
    } else {
      f = mk(S, vacancyNear(S, Math.max(1, S.player.rungIdx - 1)), { power: power });
      S.field.push(f);
    }
    f.side = 'ally';
    f.loyalty = clamp(f.loyalty + RZ.range(8, 22), 0, 100);
    syncLeadership(S);
    return f;
  }

  // A rival stops being a problem: they lose the seat, the case, or the will.
  function dropRival(S) {
    var r = rivals(S);
    if (!r.length) return null;
    var f = r[r.length - 1];
    retire(S, f, 'quit');
    syncLeadership(S);
    return f;
  }

  function wound(S, f, amount) {
    if (!f) return;
    f.wounded = clamp((f.wounded || 0) + amount, 0, 6);
    f.power = clamp(f.power - amount * RZ.range(4, 9), 3, 100);
    if (f.power < 14) retire(S, f, 'disgrace');
    syncLeadership(S);
  }

  function retire(S, f, why) {
    f.retired = true;
    f.fate = why;
    f.retiredYear = S.date.year;
  }

  /* ---------------------------------------------------------------
     Their careers, which run whether you are watching or not
     --------------------------------------------------------------- */
  function tick(S, out) {
    if (!S.field || !S.field.length) return;
    var L = lad(S), moves = [];

    // Monthly: standing drifts, wounds heal, the ambitious work at it.
    live(S).forEach(function (f) {
      f.power = clamp(f.power + RZ.range(-1.4, 1.4) + (f.ambition - 50) * 0.008, 3, 100);
      if (f.wounded > 0 && RZ.chance(0.06)) f.wounded--;
    });

    // Careers move once a year, in the reshuffle season.
    if (S.date.month === 1) {
      strongestFirst(ours(S)).forEach(function (f) {
        if (f.retired) return;
        var target = f.rungIdx + 1;
        if (target >= L.length) return;
        if (target === S.player.rungIdx + 1 && RZ.chance(0.5)) return;   // you are also in that queue
        var room = seatsAt(L, target) - at(S, target).length;
        if (S.player.rungIdx === target) room--;                        // the seat you are in is not free
        if (room <= 0) return;
        var odds = clamp((strength(f) - 46) / 150 + f.ambition / 900, 0.01, 0.30);
        if (!RZ.chance(odds)) return;
        f.rungIdx = target; f.role = L[target].title; f.since = S.date.year;
        f.power = clamp(f.power + RZ.range(1, 5), 5, 100);
        moves.push(f);
      });

      // The weak fall out, and new people arrive at the bottom to replace them.
      live(S).forEach(function (f) {
        if (f.power < 16 && RZ.chance(0.35)) retire(S, f, 'faded');
        else if (f.rungIdx >= L.length - 3 && RZ.chance(0.02)) retire(S, f, 'died');
      });
      var short = 0;
      for (var i = 1; i < L.length - 1; i++) short += Math.max(0, seatsAt(L, i) - at(S, i).length);
      for (var k = 0; k < Math.min(3, short); k++) {
        var lo = vacancyNear(S, RZ.irange(1, Math.max(1, Math.min(4, L.length - 2))));
        S.field.push(mk(S, lo));
      }
      // Don't let the cast grow without limit across a forty-year career.
      var dead = (S.field || []).filter(function (f) { return f.retired || !f.alive; });
      if (dead.length > 24) {
        var drop = dead.slice(0, dead.length - 24);
        S.field = S.field.filter(function (f) { return drop.indexOf(f) < 0; });
      }
    }

    syncLeadership(S);
    if (out && moves.length) out.fieldMoves = moves;
    return moves;
  }

  RZ.field = {
    populate: populate, repopulate: repopulate, syncLeadership: syncLeadership,
    contender: contender, pressure: pressure,
    playerSide: playerSide, figureSide: figureSide, ensureDressed: ensureDressed,
    consolidation: consolidation,
    primaryScore: primaryScore, conferencePull: conferencePull, dress: dress,
    standingOf: standingOf,
    winsAgainstPlayer: winsAgainstPlayer, losesToPlayer: losesToPlayer,
    wound: wound, retire: retire, tick: tick,
    rivals: rivals, allies: allies, addRival: addRival, addAlly: addAlly, dropRival: dropRival,
    vacancyNear: vacancyNear, enforceSingular: enforceSingular,
    live: live, ours: ours, byId: byId, at: at, strength: strength,
    strongestFirst: strongestFirst, isSingular: isSingular, leaderIdx: leaderIdx, mk: mk
  };
})();
