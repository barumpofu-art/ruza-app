/* blocs.js — the electorate, which is not one number.

   "Grassroots support" is a convenient lie. There is no such constituency.
   There are smallholders who want the maize price up and traders who want it
   down; there are public servants who want the wage bill to grow and
   ratepayers who want it cut; there is a traditional authority that holds land
   in trust and a generation of unemployed twenty-four-year-olds who would like
   that land sold.

   Every one of them votes. So the interesting question is never "did that make
   me popular" — it is "who did that make me popular with, and what did it cost
   me with everybody else". These six blocs cut across the regions rather than
   sitting inside them, which is what makes a policy a trade instead of a
   button.

   They are defined by material interest rather than by ethnicity: a
   smallholder in Kgatleng and a smallholder in Manicaland want the same three
   things, and neither of them is the same voter as the person who sells them
   fertiliser.
*/
(function () {
  'use strict';
  var C100 = RZ.c100, clamp = RZ.clamp;

  /* =======================================================================
     WHO THEY ARE
     ======================================================================= */
  var BLOCS = [
    {
      id: 'rural', name: 'The smallholders', ico: '🌾',
      note: 'Land, inputs, the price of maize and whether the road is passable in February.',
      // What moves them month to month without anybody doing anything.
      reads: function (n, c) {
        return (n.economy.staplePrice - 100) * 0.05 +
               (n.society.infra - 45) * 0.03 -
               (n.economy.inflation - 5) * 0.10;
      },
      turnout: 1.15
    },
    {
      id: 'youth', name: 'The urban young', ico: '🛵',
      note: 'Unemployed or underemployed, online, and entirely uninterested in what the party did in 1987.',
      reads: function (n, c) {
        return -(n.economy.unemployment - 24) * 0.09 +
               (n.economy.growth - 2) * 0.10 +
               (n.society.education - 48) * 0.02;
      },
      turnout: 0.72
    },
    {
      id: 'labour', name: 'Organised labour', ico: '🦺',
      note: 'The public service and what is left of the industrial unions. Disciplined, and they turn out.',
      reads: function (n, c) {
        return -(n.economy.inflation - 5) * 0.14 +
               (n.budget.admin - 16) * 0.06 +
               (n.budget.health + n.budget.education - 29) * 0.03;
      },
      turnout: 1.30
    },
    {
      id: 'traders', name: 'The informal traders', ico: '🧺',
      note: 'By-laws, permits, the border and the exchange rate. Nothing they earn appears in any account.',
      reads: function (n, c) {
        return -(n.economy.inflation - 5) * 0.11 -
               (n.society.corruption - 40) * 0.03 +
               (n.economy.growth - 2) * 0.06;
      },
      turnout: 0.88
    },
    {
      id: 'chiefs', name: 'The traditional authority', ico: '🪶',
      note: 'Customary land, allowances, precedence at funerals, and who is allowed to speak first.',
      reads: function (n, c) {
        return (n.society.stability - 60) * 0.04 -
               (n.society.unrest - 20) * 0.03;
      },
      turnout: 1.22
    },
    {
      id: 'middle', name: 'The salaried middle', ico: '🏘️',
      note: 'Rates, school fees, the currency, and a passport application they have not told you about.',
      reads: function (n, c) {
        return -(n.economy.debt - 55) * 0.03 -
               (n.society.corruption - 40) * 0.05 +
               (n.economy.growth - 2) * 0.12 -
               (n.economy.inflation - 5) * 0.08;
      },
      turnout: 1.34
    }
  ];
  var byId = {};
  BLOCS.forEach(function (b) { byId[b.id] = b; });

  /* =======================================================================
     HOW BIG EACH ONE IS HERE
     ======================================================================= */
  // Sized off the country's own numbers rather than a hand-written table, so
  // Angola and Lesotho get different electorates for the reasons they actually
  // have different electorates.
  function sizes(c) {
    var e = c.econ, inst = c.inst;
    // No urbanisation figure in the data, so derive one: richer economies are
    // more urban, and it is a good enough proxy at this resolution.
    var urban = clamp(26 + e.gdppc / 210, 24, 70);
    var raw = {
      rural: (100 - urban) * 0.62,
      youth: urban * 0.30 + (e.unemployment - 20) * 0.55,
      labour: (100 - e.informal) * 0.24,
      traders: e.informal * 0.50,
      chiefs: (100 - urban) * 0.20 + inst.ethnic * 0.14,
      middle: urban * 0.20 + e.gdppc / 900
    };
    var total = 0;
    Object.keys(raw).forEach(function (k) { raw[k] = Math.max(3, raw[k]); total += raw[k]; });
    var out = {};
    Object.keys(raw).forEach(function (k) { out[k] = (100 * raw[k]) / total; });
    return out;
  }

  function init(S) {
    if (S.blocs) return S.blocs;
    var c = RZ.COUNTRIES[S.countryId];
    var sz = sizes(c);
    var base = S.player.standing.grassroots;
    S.blocs = {};
    BLOCS.forEach(function (b) {
      S.blocs[b.id] = {
        id: b.id,
        size: RZ.round(sz[b.id], 2),
        // Nobody starts neutral about anybody. Where you come from decides who
        // was already inclined to listen.
        mood: C100(base + RZ.range(-14, 14)),
        moved: 0
      };
    });
    homeAdvantage(S);
    return S.blocs;
  }

  // The origin scene decides which room you were in before you were anybody.
  function homeAdvantage(S) {
    var t = S.player.trait;
    var gift = {
      firebrand: 'youth', hustler: 'traders', schemer: 'chiefs',
      tycoon: 'middle', mandarin: 'labour', advocate: 'middle'
    }[t];
    var cost = {
      firebrand: 'chiefs', hustler: 'labour', schemer: 'youth',
      tycoon: 'rural', mandarin: 'youth', advocate: 'traders'
    }[t];
    if (gift && S.blocs[gift]) S.blocs[gift].mood = C100(S.blocs[gift].mood + RZ.range(8, 16));
    if (cost && S.blocs[cost]) S.blocs[cost].mood = C100(S.blocs[cost].mood - RZ.range(5, 12));
    // Where you are from is a bloc too: a rural seat starts you with the
    // smallholders and a city one with the young.
    var c = RZ.COUNTRIES[S.countryId];
    var reg = c.regionById[S.player.regionId];
    var urbanish = /gaut|greater|city|urban|harare|luanda|maputo|windhoek|lusaka|blantyre|maseru|hhohho|gaborone|west/i.test(reg.name);
    var local = urbanish ? 'youth' : 'rural';
    if (S.blocs[local]) S.blocs[local].mood = C100(S.blocs[local].mood + RZ.range(4, 10));
  }

  function get(S, id) { init(S); return S.blocs[id] || null; }
  function all(S) { init(S); return BLOCS.map(function (b) { return S.blocs[b.id]; }); }

  /* =======================================================================
     MOVING THEM
     ======================================================================= */
  // The whole point. A policy names winners and losers in the same call, and
  // the net — weighted by how many of each there are — is what "grassroots"
  // was pretending to be all along.
  function move(S, api, deltas) {
    init(S);
    var net = 0, moved = [];
    Object.keys(deltas || {}).forEach(function (id) {
      var b = S.blocs[id];
      if (!b) return;
      var amt = deltas[id];
      b.mood = C100(b.mood + amt);
      b.moved = amt;
      net += (amt * b.size) / 100;
      moved.push({ id: id, name: byId[id].name, ico: byId[id].ico, amt: amt, size: b.size });
    });
    // One visible number for the HUD, arrived at honestly.
    if (api && net) (api.addRaw || api.add).call(api, 'grassroots', net);
    return { net: net, moved: moved };
  }

  // An ordinary grassroots gain — a rally, a funeral, a radio interview — is
  // not free of the blocs, it is simply spread thinly across all of them.
  function drift(S, amt) {
    init(S);
    BLOCS.forEach(function (b) {
      var x = S.blocs[b.id];
      x.mood = C100(x.mood + amt * (0.5 + x.size / 100));
    });
  }

  /* =======================================================================
     WHAT THEY NOTICE ON THEIR OWN
     ======================================================================= */
  function tick(S, span, out) {
    init(S);
    var c = RZ.COUNTRIES[S.countryId];
    var n = S.nation;
    var worst = null;
    BLOCS.forEach(function (b) {
      var x = S.blocs[b.id];
      // What the conditions alone would make them think of you. This is a
      // ceiling and a floor, not a push: an unbounded monthly drift meant that
      // in any country with unemployment over thirty the young sat at zero
      // permanently and nothing the player did could hold them, which is not a
      // trade, it is a tax. Bad conditions now make a bloc expensive to keep
      // rather than impossible to have.
      var target = clamp(48 + b.reads(n, c) * 9, 14, 84);
      x.target = RZ.round(target, 1);
      x.mood = C100(x.mood + (target - x.mood) * 0.05 * span);
      x.moved = 0;
      if (!worst || x.mood < worst.mood) worst = x;
    });

    // Somebody who has decided you are not on their side comes to say so, once.
    if (worst && worst.mood < 22 && !S.pendingScene && !S.pendingEvent && RZ.dialogue) {
      S.flags.blocAngry = S.flags.blocAngry || {};
      // `in`, not truthiness: a deputation on turn zero stores a 0 and would
      // otherwise be able to come back every month for the rest of the career.
      if (!(worst.id in S.flags.blocAngry) && RZ.chance(0.5 * span) && RZ.engine.mkApi(S).tier() >= 2) {
        S.flags.blocAngry[worst.id] = S.turn;
        S.flags.blocAngryWho = worst.id;
        RZ.dialogue.summon(S, 'bloc-deputation');
        if (out) out.blocAngry = worst.id;
      }
    }
    return { worst: worst ? worst.id : null };
  }

  /* =======================================================================
     WHAT IT IS WORTH ON THE DAY
     ======================================================================= */
  // Weighted by size and by how likely each of them is to actually go and vote.
  // A bloc that loves you and stays at home is worth less than one that
  // tolerates you and turns out, which is the whole tragedy of the youth vote.
  function turnoutWeighted(S) {
    init(S);
    var num = 0, den = 0;
    BLOCS.forEach(function (b) {
      var x = S.blocs[b.id];
      var w = x.size * b.turnout;
      num += x.mood * w;
      den += w;
    });
    return den ? num / den : 50;
  }
  function plainWeighted(S) {
    init(S);
    var num = 0, den = 0;
    BLOCS.forEach(function (b) { var x = S.blocs[b.id]; num += x.mood * x.size; den += x.size; });
    return den ? num / den : 50;
  }
  // What the blocs are worth to you on the ballot, as a swing in points either
  // side of nothing.
  function swing(S) {
    return clamp((turnoutWeighted(S) - 50) * 0.22, -11, 11);
  }

  function summary(S) {
    init(S);
    return {
      swing: RZ.round(swing(S), 1),
      weighted: Math.round(turnoutWeighted(S)),
      rows: BLOCS.map(function (b) {
        var x = S.blocs[b.id];
        return {
          id: b.id, name: b.name, ico: b.ico, note: b.note,
          size: Math.round(x.size), mood: Math.round(x.mood),
          // Where the country's own numbers are pulling them, regardless of you.
          target: Math.round(x.target === undefined ? 48 : x.target),
          turnout: b.turnout,
          mood_label: x.mood >= 68 ? 'with you' : x.mood >= 52 ? 'winnable' :
                      x.mood >= 36 ? 'drifting' : x.mood >= 22 ? 'lost to you' : 'hostile'
        };
      }).sort(function (p, q) { return q.size - p.size; })
    };
  }

  // Scenes this module sends somebody to find you with.
  var SUMMONS = ['bloc-deputation'];

  RZ.blocs = {
    BLOCS: BLOCS, byId: byId, sizes: sizes, SUMMONS: SUMMONS,
    init: init, get: get, all: all, move: move, drift: drift, tick: tick,
    turnoutWeighted: turnoutWeighted, plainWeighted: plainWeighted,
    swing: swing, summary: summary
  };
})();
