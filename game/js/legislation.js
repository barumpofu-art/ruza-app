/* legislation.js — writing the law instead of being asked about it.

   A member who only ever votes on other people's bills is a spectator with a
   salary. This is the other side of it: you draft the thing, and then you
   spend four weeks finding fifty-one per cent in a House that was not
   assembled with your bill in mind.

   The House is not one number. It is four blocs that want different things
   and answer to different pressure — your own loyalists, the faction in your
   party that is not yours, the opposition, and the small parties who will
   trade anything for a road. Each of them is bought differently, and every
   concession you make to win one costs you something in the bill itself.
*/
(function () {
  'use strict';
  var C100 = RZ.c100, clamp = RZ.clamp;

  var WEEKS = 4;

  /* =======================================================================
     WHAT YOU CAN PUT ON THE ORDER PAPER
     ======================================================================= */
  var BILLS = [
    {
      id: 'mines', name: 'The Mineral Resources Bill',
      blurb: 'A state shareholding in every new mining licence, and a beneficiation requirement.',
      lean: { loyal: 25, faction: -10, opp: -45, small: 0 },
      pass: function (a) {
        a.nation('growth', -RZ.range(0.3, 1.2));
        a.nation('debt', -RZ.range(2, 6));
        a.add('grassroots', RZ.range(8, 16)); a.add('business', -RZ.range(10, 20));
        a.add('intl', -RZ.range(4, 12)); a.add('fame', RZ.range(4, 9));
        a.legacyMark('nationalised');
        return 'The state now sits on the board of every new licence. The rand went first and the ' +
               'editorials followed it, and in the mining towns they played music in the street.';
      }
    },
    {
      id: 'tax', name: 'The Corporate Tax Amendment Bill',
      blurb: 'Cut the headline rate by eight points and widen the investment allowance.',
      lean: { loyal: -15, faction: 20, opp: 30, small: -10 },
      pass: function (a) {
        a.nation('growth', RZ.range(0.4, 1.4));
        a.nation('debt', RZ.range(2, 6));
        a.add('business', RZ.range(10, 20)); a.add('intl', RZ.range(4, 10));
        a.add('grassroots', -RZ.range(5, 12));
        a.add('money', a.wage(RZ.range(2, 8)));
        return 'Three announcements within a month and a great many photographs on building sites. ' +
               'The revenue hole is somebody else’s problem in about four years.';
      }
    },
    {
      id: 'education', name: 'The Free Secondary Education Bill',
      blurb: 'Abolish fees to the end of secondary, funded from the consolidated fund.',
      lean: { loyal: 30, faction: 5, opp: -10, small: 20 },
      pass: function (a) {
        a.nation('education', RZ.range(6, 14));
        a.nation('debt', RZ.range(3, 8));
        a.add('grassroots', RZ.range(10, 20)); a.add('media', RZ.range(4, 10));
        a.add('fame', RZ.range(4, 10));
        a.wardTrust(RZ.range(5, 12));
        a.legacyMark('freeEducation');
        return 'Every child to Form Five without a fee. It will be in the first line of the obituary ' +
               'and it will be unaffordable within a decade, and both of those things are true at once.';
      }
    },
    {
      id: 'land', name: 'The Land Redistribution Bill',
      blurb: 'Expropriation with compensation determined by a tribunal rather than the market.',
      lean: { loyal: 20, faction: -20, opp: -50, small: 15 },
      pass: function (a) {
        a.add('grassroots', RZ.range(12, 22)); a.add('business', -RZ.range(12, 24));
        a.add('intl', -RZ.range(8, 18)); a.nation('growth', -RZ.range(0.5, 1.8));
        a.nation('unrest', -RZ.range(2, 8));
        a.legacyMark('landReform');
        return 'The tribunal sat for the first time in October. Two farms in the first year, and a ' +
               'queue of eleven thousand claims behind them.';
      }
    },
    {
      id: 'wages', name: 'The Public Service Remuneration Bill',
      blurb: 'A three-year above-inflation settlement, written into statute.',
      lean: { loyal: 20, faction: 10, opp: -20, small: 10 },
      pass: function (a) {
        a.nation('debt', RZ.range(4, 10)); a.nation('inflation', RZ.range(0.5, 2));
        a.add('grassroots', RZ.range(8, 16)); a.add('party', RZ.range(4, 10));
        a.add('intl', -RZ.range(3, 9));
        return 'Signed at a ceremony with the federations present. Treasury did not send anybody, ' +
               'which everybody in the room understood perfectly.';
      }
    },
    {
      id: 'anticorr', name: 'The Public Integrity Commission Bill',
      blurb: 'A commission with its own prosecutors, its own budget, and no minister above it.',
      lean: { loyal: -25, faction: -30, opp: 40, small: 5 },
      pass: function (a) {
        a.nation('corruption', -RZ.range(6, 14));
        a.nation('judiciary', RZ.range(4, 10));
        a.add('intl', RZ.range(6, 14)); a.add('media', RZ.range(6, 14));
        a.add('party', -RZ.range(8, 18)); a.makeRival();
        a.add('stats.integrity', RZ.range(3, 7));
        a.legacyMark('builtTheCommission');
        return 'It made its first arrest in March and the second one was a member of your own caucus. ' +
               'You built the thing that will one day come for the people who made you.';
      }
    }
  ];
  function billById(id) { return BILLS.filter(function (b) { return b.id === id; })[0]; }

  /* =======================================================================
     THE HOUSE, AS FOUR ROOMS
     ======================================================================= */
  function buildBlocs(S, bill) {
    var c = RZ.COUNTRIES[S.countryId];
    var P = S.player;
    var mine = (S.parties[P.partyId] && S.parties[P.partyId].seats) || Math.round(c.house.seats * 0.45);
    var total = 0;
    c.parties.forEach(function (p) { total += (S.parties[p.id] && S.parties[p.id].seats) || 0; });
    if (!total) total = c.house.seats;
    var others = Math.max(1, total - mine);

    // Your own benches split by whether they are yours or somebody else's.
    var loyalShare = clamp(0.35 + P.standing.party / 240, 0.25, 0.75);
    return [
      { id: 'loyal', name: 'Your own people',
        note: 'They will follow you, up to the point where it costs them a seat.',
        seats: Math.round(mine * loyalShare),
        lean: clamp(bill.lean.loyal + P.standing.leader * 0.25 - 20, -95, 95),
        pledged: false, worked: 0, how: null },
      { id: 'faction', name: 'The other faction',
        note: 'Yours by party card and nobody else’s by inclination.',
        seats: mine - Math.round(mine * loyalShare),
        lean: clamp(bill.lean.faction + P.standing.party * 0.12 - 25, -95, 95),
        pledged: false, worked: 0, how: null },
      { id: 'opp', name: 'The opposition',
        note: 'They will vote for it only if it embarrasses somebody they dislike more than you.',
        seats: Math.round(others * 0.72),
        lean: clamp(bill.lean.opp + P.standing.media * 0.10 - 15, -95, 95),
        pledged: false, worked: 0, how: null },
      { id: 'small', name: 'The small parties and independents',
        note: 'Eleven members who each want one specific thing for one specific district.',
        seats: others - Math.round(others * 0.72),
        lean: clamp(bill.lean.small + 5, -95, 95),
        pledged: false, worked: 0, how: null }
    ].filter(function (b) { return b.seats > 0; });
  }

  function houseTotal(S) {
    var c = RZ.COUNTRIES[S.countryId], total = 0;
    c.parties.forEach(function (p) { total += (S.parties[p.id] && S.parties[p.id].seats) || 0; });
    return total || c.house.seats;
  }

  function count(S) {
    var b = S.bill;
    if (!b) return null;
    var yes = 0, total = 0;
    b.blocs.forEach(function (x) {
      total += x.seats;
      if (x.pledged) yes += x.seats;
      // An unpledged bloc still breaks roughly with its lean on the day.
      else if (x.lean > 25) yes += Math.round(x.seats * 0.55);
      else if (x.lean > 0) yes += Math.round(x.seats * 0.25);
    });
    return { yes: yes, total: total, needed: b.needed, short: Math.max(0, b.needed - yes) };
  }

  /* =======================================================================
     TABLING IT
     ======================================================================= */
  function canDraft(S) {
    if (S.bill) return false;
    if (S.tempo === 'week') return false;
    var api = RZ.engine.mkApi(S);
    if (api.tier() < 4) return false;
    if (S.flags.billCool !== undefined && S.turn - S.flags.billCool < 10) return false;
    return S.player.capital >= 12;
  }

  function table(S, api, billId) {
    var bill = billById(billId);
    if (!bill) return null;
    var total = houseTotal(S);
    S.bill = {
      id: bill.id, name: bill.name, blurb: bill.blurb,
      weeksLeft: WEEKS, week: 1,
      needed: Math.floor(total / 2) + 1,
      blocs: buildBlocs(S, bill),
      spent: 0, concessions: 0, extorted: 0
    };
    S.tempo = 'week';
    S.date.week = 1;
    api.add('capital', -RZ.range(8, 14));
    api.add('media', RZ.range(2, 6));
    // The feed entry is written by the caller, which knows the opening count.
    return S.bill;
  }

  /* =======================================================================
     THE FOUR WEEKS
     ======================================================================= */
  var WEEK_ACTIONS = [
    { id: 'billwhip', ico: '🗳️', ap: 1, special: 'bloc',
      name: 'Work a bloc',
      desc: 'Rooms, promises and a great deal of listening. Pick one and spend the week in it.' },

    { id: 'billconcede', ico: '✂️', ap: 1, special: 'concede',
      name: 'Amend the bill to win them',
      desc: 'Every clause you drop buys votes and costs the thing you came to do.' },

    { id: 'billcount', ico: '🧮', ap: 1,
      name: 'Have the tellers count it properly',
      desc: 'Find out where you actually are rather than where you hope you are.',
      run: function (a) {
        var t = count(a.S);
        a.add('capital', -a.rng(0, 2));
        a.S.bill.counted = true;
        return {
          title: t.short ? 'You are ' + t.short + ' short' : 'You have it, on today’s numbers',
          body: 'The whips went through it name by name overnight: ' + t.yes + ' of ' + t.total +
            ', and ' + t.needed + ' needed. ' +
            (t.short ? 'Four of the names in the yes column would not look you in the eye while saying so.'
                     : 'Which is not the same as having it on the day, and everybody in the room knows it.'),
          tone: t.short ? 'flat' : 'good'
        };
      } }
  ];

  function weekActions(S) {
    if (!S.bill) return [];
    return WEEK_ACTIONS;
  }
  function weekActionById(id) { return WEEK_ACTIONS.filter(function (x) { return x.id === id; })[0]; }

  // Working a bloc: what persuades them depends entirely on who they are.
  function workBloc(S, api, blocId, how) {
    var b = (S.bill.blocs || []).filter(function (x) { return x.id === blocId; })[0];
    if (!b) return null;
    b.worked++;
    var moved = 0, note = '';

    if (how === 'capital') {
      var spend = RZ.range(8, 16);
      api.add('capital', -spend);
      S.bill.spent += spend;
      moved = RZ.range(18, 34) / Math.sqrt(b.worked);
      note = 'positions, committee places and a road in somebody’s district';
    } else if (how === 'charm') {
      var ok = api.roll(b.id === 'opp' ? 'oratory' : 'charisma', 48);
      moved = ok ? RZ.range(16, 30) / Math.sqrt(b.worked) : RZ.range(0, 6);
      api.add('health', -RZ.range(1, 4));
      note = ok ? 'four evenings, no officials, and a genuine argument' : 'four evenings and a polite nothing';
    } else if (how === 'extort') {
      if (!api.hasLeverage()) return null;
      api.doLeak(false);
      S.bill.extorted++;
      moved = RZ.range(28, 48) / Math.sqrt(b.worked);
      api.add('stats.integrity', -RZ.range(2, 6));
      note = 'a conversation nobody will ever describe';
    }

    b.lean = clamp(b.lean + moved, -95, 95);
    if (b.lean > 55 && !b.pledged) { b.pledged = true; b.how = how; }
    return { bloc: b, moved: moved, how: how, note: note, pledged: b.pledged };
  }

  // A concession wins a bloc outright and takes something out of the bill.
  function concede(S, api, blocId) {
    var b = (S.bill.blocs || []).filter(function (x) { return x.id === blocId; })[0];
    if (!b) return null;
    b.lean = clamp(b.lean + RZ.range(35, 60), -95, 95);
    if (b.lean > 45) { b.pledged = true; b.how = 'concession'; }
    S.bill.concessions++;
    api.add('media', -RZ.range(1, 5));
    return { bloc: b, concessions: S.bill.concessions };
  }

// A bill dies when the House it was tabled in stops sitting. Dissolution is
  // not a defeat and it does not go on the record as one; it is simply gone,
  // along with everything you spent getting it to the second reading.
  function lapse(S) {
    var b = S.bill;
    if (!b) return null;
    var api = RZ.engine.mkApi(S);
    api.add('media', -RZ.range(1, 4));
    S.tempo = 'month';
    S.date.week = 1;
    S.flags.billCool = S.turn;
    S.bill = null;
    RZ.engine.pushFeed(S, {
      kind: 'flat', src: 'The order paper',
      title: b.name + ' fell with the House',
      body: 'The proclamation dissolves the House and everything on the order paper falls with it. ' +
            'Four weeks of rooms and promises, and it will have to be tabled again from the first line ' +
            'by whoever is sitting here afterwards.',
      tone: 'flat'
    });
    return { name: b.name, spent: b.spent, concessions: b.concessions };
  }

  /* =======================================================================
     THE DIVISION
     ======================================================================= */
  // Somebody comes to find you about your own bill. There are only two of
  // these and each happens at most once, because a bill that summons a meeting
  // every week is a bill nobody has time to whip.
  var VISITS = [
    { id: 'bill-lobby', flag: 'metLobby', p: 0.55,
      when: function (S) { return S.bill.week >= 2; } },
    { id: 'bill-faction', flag: 'metFaction', p: 0.5,
      when: function (S) {
        return S.bill.week >= 2 &&
          S.bill.blocs.some(function (b) { return b.id === 'faction' && !b.pledged; });
      } }
  ];

  function tickWeek(S) {
    if (!S.bill) return null;
    S.bill.week = WEEKS - S.bill.weeksLeft + 1;
    // The room drifts back when you are not in it.
    S.bill.blocs.forEach(function (b) {
      if (b.pledged) return;
      b.lean = clamp(b.lean - RZ.range(1, 4), -95, 95);
    });

    // Not on the last week — that one belongs to the division — and never on
    // top of a decision already waiting on the desk.
    var summoned = null;
    if (S.bill.weeksLeft > 0 && !S.pendingScene && !S.pendingEvent && RZ.dialogue) {
      var open = VISITS.filter(function (v) { return !S.bill[v.flag] && v.when(S); });
      for (var i = 0; i < open.length; i++) {
        if (!RZ.chance(open[i].p)) continue;
        if (RZ.dialogue.summon(S, open[i].id)) {
          S.bill[open[i].flag] = true;
          summoned = open[i].id;
        }
        break;
      }
    }

    return { week: S.bill.week, weeksLeft: S.bill.weeksLeft, summoned: summoned };
  }

  function division(S) {
    var b = S.bill;
    if (!b) return null;
    var api = RZ.engine.mkApi(S);
    var t = count(S);
    // The floor is noisier than the whips' list.
    var yes = t.yes + Math.round(RZ.noise(Math.max(3, t.total * 0.03)));
    var passed = yes >= b.needed;
    var bill = billById(b.id);
    // Every concession takes a bite out of what passing is worth.
    var potency = Math.max(0.35, 1 - b.concessions * 0.22);

    var res = {
      passed: passed, yes: yes, needed: b.needed, total: t.total,
      concessions: b.concessions, extorted: b.extorted, potency: potency, name: b.name
    };

    if (passed) {
      var line = bill.pass(scaled(api, potency));
      S.player.record.push({ year: S.date.year, text: b.name + ' — carried.' });
      api.add('fame', RZ.range(3, 8));
      api.add('leader', RZ.range(2, 7));
      S.flags.billsPassed = (S.flags.billsPassed || 0) + 1;
      res.title = 'Carried, ' + yes + ' to ' + (t.total - yes);
      res.body = line + (b.concessions
        ? ' It is a smaller thing than the one you tabled — ' + b.concessions +
          ' clause' + (b.concessions === 1 ? '' : 's') + ' went out to get it through.'
        : ' Exactly as drafted, which almost never happens.');
      res.tone = 'good';
    } else {
      api.add('leader', -RZ.range(4, 10));
      api.add('party', -RZ.range(3, 8));
      api.add('media', -RZ.range(2, 6));
      api.add('capital', -RZ.range(2, 6));
      S.flags.billsLost = (S.flags.billsLost || 0) + 1;
      res.title = 'Lost, ' + yes + ' to ' + (t.total - yes);
      res.body = 'You needed ' + b.needed + ' and you had ' + yes + '. ' +
        (b.spent > 20 ? 'A great deal of capital went into a bill that is now a footnote. ' : '') +
        'A member who tables and loses is a member everybody now knows the ceiling of.';
      res.tone = 'bad';
    }
    res.deltas = api.deltas.slice();

    S.tempo = 'month';
    S.date.week = 1;
    S.flags.billCool = S.turn;
    S.bill = null;
    return res;
  }

  // A conceded bill does less. Rather than rewrite six effect functions, scale
  // what they hand to the api.
  function scaled(api, k) {
    if (k >= 0.999) return api;
    var proxy = Object.create(api);
    proxy.add = function (key, amt) { return api.add(key, amt * k); };
    proxy.nation = function (key, amt) { return api.nation(key, amt * k); };
    return proxy;
  }

  RZ.bill = {
    WEEKS: WEEKS, BILLS: BILLS, billById: billById,
    canDraft: canDraft, table: table, count: count, tickWeek: tickWeek, division: division,
    lapse: lapse, VISITS: VISITS,
    weekActions: weekActions, weekActionById: weekActionById,
    workBloc: workBloc, concede: concede, houseTotal: houseTotal
  };
})();
