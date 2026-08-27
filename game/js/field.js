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
    return f;
  }

  // How hard this person is to beat, right now.
  function strength(f) {
    return f.power + f.ambition * 0.22 - f.wounded * 9;
  }

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
      for (var k = 1; k < sitting.length; k++) {
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

    if (P.isLeader) {
      // You hold it. Anybody still sitting in that chair is moved out of it.
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
      return { fig: strongestFirst(sitting)[0], incumbent: true };
    }
    var pool = sitting.concat(at(S, rungIdx - 1));
    if (!pool.length) return null;
    var best = pool.slice().sort(function (a, b) {
      return (strength(b) + b.ambition * 0.3) - (strength(a) + a.ambition * 0.3);
    })[0];
    return { fig: best, incumbent: best.rungIdx === rungIdx };
  }

  // What that person adds to the difficulty of taking the rung off them.
  function difficulty(S, rungIdx) {
    var con = contender(S, rungIdx);
    if (!con) return -6;                       // an open field is easier than a contested one
    var d = (strength(con.fig) - 52) * 0.62;
    if (con.incumbent) d += 12;                // possession is most of the argument
    // a file you have not used is not leverage; a file you have used is
    d -= Math.min(18, con.fig.wounded * 9);
    return d;
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
  function losesToPlayer(S, rungIdx) {
    var con = contender(S, rungIdx);
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
    contender: contender, difficulty: difficulty,
    winsAgainstPlayer: winsAgainstPlayer, losesToPlayer: losesToPlayer,
    wound: wound, retire: retire, tick: tick,
    rivals: rivals, allies: allies, addRival: addRival, addAlly: addAlly, dropRival: dropRival,
    vacancyNear: vacancyNear, enforceSingular: enforceSingular,
    live: live, ours: ours, byId: byId, at: at, strength: strength,
    strongestFirst: strongestFirst, isSingular: isSingular, leaderIdx: leaderIdx, mk: mk
  };
})();
