/* statecraft.js — the tiers where the job changes.

   A backbencher worries about a clinic. A minister worries about a budget
   vote and whether the President has been asking about him. A deputy worries
   about the succession. A President worries about the treasury, the generals,
   and the people he himself appointed.

   Nothing here is an alert card. Every crisis summons a named person into a
   room with you, through the same dialogue engine everything else uses.
*/
(function () {
  'use strict';
  var C100 = RZ.c100, clamp = RZ.clamp;

  function monthIndex(S) { return S.date.year * 12 + S.date.month; }
  function tierOf(S) { return RZ.engine.mkApi(S).tier(); }

  /* =======================================================================
     THE CABINET
     Once you appoint people, they are the government — and they have their
     own reasons for being in it.
     ======================================================================= */
  function initCabinet(S) {
    if (S.cabinet) return S.cabinet;
    S.cabinet = [];
    return S.cabinet;
  }

  function fillCabinet(S) {
    initCabinet(S);
    var c = RZ.COUNTRIES[S.countryId];
    if (S.cabinet.length) return S.cabinet;
    // The people you inherit rather than choose.
    c.ministries.slice(0, 6).forEach(function (m) {
      S.cabinet.push(makeMinister(S, m.id));
    });
    return S.cabinet;
  }

  function makeMinister(S, ministryId, opts) {
    var c = RZ.COUNTRIES[S.countryId];
    opts = opts || {};
    var n = RZ.makeNpc(c, { partyId: S.player.partyId });
    return {
      id: n.id, name: n.name, ministryId: ministryId,
      // The three numbers that make a cabinet a problem rather than a team.
      competence: opts.competence !== undefined ? opts.competence : Math.round(RZ.range(20, 85)),
      loyalty: opts.loyalty !== undefined ? opts.loyalty : Math.round(RZ.range(25, 85)),
      corruption: opts.corruption !== undefined ? opts.corruption : Math.round(RZ.range(15, 80)),
      months: 0
    };
  }

  function ministryName(S, id) {
    var m = RZ.COUNTRIES[S.countryId].ministries.filter(function (x) { return x.id === id; })[0];
    return m ? m.name : id;
  }

  // What the people you appointed are doing to the country, and to you.
  function cabinetTick(S, span, out) {
    if (!S.player.isPresident || !S.cabinet || !S.cabinet.length) return;
    var api = null;
    var meanComp = 0, meanRot = 0;
    S.cabinet.forEach(function (m) { m.months += span; meanComp += m.competence; meanRot += m.corruption; });
    meanComp /= S.cabinet.length;
    meanRot /= S.cabinet.length;

    // Competence is growth; corruption is rot. Both slowly, both every month.
    S.nation.economy.growth = clamp(S.nation.economy.growth + (meanComp - 50) * 0.004 * span, -8, 12);
    S.nation.society.corruption = C100(S.nation.society.corruption + (meanRot - 50) * 0.02 * span);

    // A disloyal minister is not idle. He is positioning.
    var worst = S.cabinet.slice().sort(function (a, b) { return a.loyalty - b.loyalty; })[0];
    if (worst && worst.loyalty < 32 && RZ.chance(0.07 * span) &&
        (S.flags.leakLast === undefined || monthIndex(S) - S.flags.leakLast >= 4)) {
      S.flags.leakLast = monthIndex(S);
      api = RZ.engine.mkApi(S);
      api.add('media', -RZ.range(3, 8));
      api.add('party', -RZ.range(1, 5));
      S.scandalRisk = Math.min(2.5, (S.scandalRisk || 0) + 0.2);
      worst.loyalty = clamp(worst.loyalty - RZ.range(0, 6), 0, 100);
      RZ.engine.pushFeed(S, {
        kind: 'bad', src: worst.name + ', ' + ministryName(S, worst.ministryId),
        title: 'It came from inside the cabinet',
        body: 'A detail of a discussion that happened in a room with eight people in it is in the Sunday paper, ' +
              'attributed to "a senior government source". You know which eight. So does everybody else.',
        deltas: api.deltas.slice(), tone: 'bad'
      });
    }
  }

  function cabinetSummary(S) {
    initCabinet(S);
    return S.cabinet.map(function (m) {
      return {
        name: m.name, ministry: ministryName(S, m.ministryId),
        competence: m.competence, loyalty: m.loyalty, corruption: m.corruption,
        risk: m.loyalty < 32 ? 'positioning' : m.corruption > 68 ? 'expensive' :
              m.competence > 68 ? 'the one who works' : 'holding'
      };
    });
  }

  /* =======================================================================
     THE CRISES THAT SUMMON YOU
     Each is a dialogue scene id. The trigger decides when somebody sends for
     you; the scene is the meeting.
     ======================================================================= */
  var CRISES = [
    {
      // A minister is only ever one rumour away from a backbencher.
      id: 'reshuffle-rumour', scene: 'reshuffle-rumour', cool: 20,
      when: function (S) {
        var t = tierOf(S);
        return t >= 5 && t <= 9 && !S.player.isPresident &&
               S.parties[S.player.partyId] && S.parties[S.player.partyId].gov;
      },
      p: function (S) { return 0.05 + (60 - Math.min(60, S.player.standing.leader)) * 0.002; }
    },
    {
      // The portfolio nobody else would take, handed over as an honour.
      id: 'chalice', scene: 'poisoned-chalice', cool: 40,
      when: function (S) {
        var t = tierOf(S);
        return t >= 5 && t <= 8 && S.parties[S.player.partyId] && S.parties[S.player.partyId].gov;
      },
      p: function (S) { return 0.035 + S.player.standing.leader * 0.0006; }
    },
    {
      // You are one office away and the old man has started saying "we".
      id: 'succession', scene: 'succession-trap', cool: 36,
      when: function (S) {
        var t = tierOf(S);
        return t >= 10 && t <= 12 && !S.player.isPresident;
      },
      p: function (S) { return 0.07; }
    },
    {
      // The treasury is empty and both of the people offering to fill it want
      // something you would rather not give.
      id: 'debt', scene: 'debt-ultimatum', cool: 48,
      when: function (S) {
        return S.player.isPresident &&
               (S.nation.economy.reserves < 2.2 || S.nation.economy.debt > 95);
      },
      p: function (S) { return 0.12; }
    },
    {
      // They do not knock during office hours.
      id: 'generals', scene: 'midnight-generals', cool: 30,
      when: function (S) {
        return S.player.isPresident && S.nation.society.unrest > 62;
      },
      p: function (S) { return 0.06 + (S.nation.society.unrest - 62) * 0.004; }
    }
  ];

  function tick(S, span, out) {
    if (S.tempo === 'week') return null;          // not during a campaign
    if (S.pendingScene || S.pendingEvent) return null;
    S.flags.crisisSeen = S.flags.crisisSeen || {};

    if (S.player.isPresident) { fillCabinet(S); }
    cabinetTick(S, span, out);

    var pool = CRISES.filter(function (cr) {
      var last = S.flags.crisisSeen[cr.id];
      if (last !== undefined && monthIndex(S) - last < cr.cool) return false;
      if (!cr.when(S)) return false;
      return RZ.dialogue && !!RZ.dialogue.byId(cr.scene);
    });
    if (!pool.length) return null;

    for (var i = 0; i < pool.length; i++) {
      var cr = pool[i];
      if (RZ.chance(cr.p(S) * span)) {
        S.flags.crisisSeen[cr.id] = monthIndex(S);
        RZ.dialogue.summon(S, cr.scene);
        return { crisis: cr.id, scene: cr.scene };
      }
    }
    return null;
  }

  RZ.state = {
    CRISES: CRISES,
    initCabinet: initCabinet, fillCabinet: fillCabinet, makeMinister: makeMinister,
    cabinetTick: cabinetTick, cabinetSummary: cabinetSummary, ministryName: ministryName,
    tick: tick
  };
})();
