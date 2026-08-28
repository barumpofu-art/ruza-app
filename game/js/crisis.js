/* crisis.js — the things that happen to you rather than the things you do.

   Everything here runs off the monthly loop and needs no player input to fire:
   the body wearing out, a commodity market falling over, a man you took money
   from calling in what he is owed, a promise coming due, and — at the far end —
   a regional army deciding your country is now its problem.

   RZ.crisis.monthly(S, out) is the single entry point from engine.endTurn.
   It returns true when the career has ended, so the loop can stop.
*/
(function () {
  'use strict';
  var C100 = RZ.c100, clamp = RZ.clamp;

  /* =======================================================================
     TEMPORARY STANDING — boosts that fade
     A defection buys you a fortnight of goodwill, not a permanent constituency.
     ======================================================================= */
  function addBuff(S, key, total, months, label) {
    S.buffs = S.buffs || [];
    S.buffs.push({ key: key, per: total / months, left: months, label: label });
  }

  function tickBuffs(S) {
    if (!S.buffs || !S.buffs.length) return;
    var P = S.player, gone = [];
    S.buffs.forEach(function (b) {
      b.left--;
      // Give the boost back a slice at a time. The player keeps whatever the
      // ordinary decay has not already taken.
      if (P.standing[b.key] !== undefined) P.standing[b.key] = C100(P.standing[b.key] - b.per);
      else if (b.key === 'fame') P.fame = C100(P.fame - b.per);
      if (b.left <= 0) gone.push(b);
    });
    S.buffs = S.buffs.filter(function (b) { return gone.indexOf(b) < 0; });
  }

  /* =======================================================================
     1. HEALTH & BURNOUT
     ======================================================================= */
  // The ordinary age drift in endTurn is what the body does on its own. This is
  // what the diary does to it: every action in a month is a flight, a funeral,
  // a rally or a room full of people who all want something.
  function burnout(S) {
    var P = S.player;
    var worked = S.actionsThisMonth || 0;
    if (!worked) return;

    var lad = RZ.ladderFor(S.countryId);
    var rung = lad[P.rungIdx];
    // Seniority does not mean rest. It means the same days with more of them
    // spent being looked at.
    var load = 0.10 + (rung.tier || 0) * 0.02 + P.fame / 700;
    var cost = worked * load * RZ.range(0.75, 1.3);
    if (P.age > 60) cost *= 1.25;
    if (S.campaign.season) cost *= 1.4;

    P.health = C100(P.health - cost);
    P.stats = P.stats || {};
    // Grit is the difference between people who can do this and people who cannot.
    if (P.stats.grit > 60) P.health = C100(P.health + cost * 0.18);
  }

  // Below thirty the body stops asking.
  function medicalCollapse(S) {
    var P = S.player;
    if (P.health >= 30) return false;
    if (S.flags.lastCollapse !== undefined && S.turn - S.flags.lastCollapse < 8) return false;

    S.flags.lastCollapse = S.turn;
    S.flags.collapses = (S.flags.collapses || 0) + 1;

    var api = RZ.engine.mkApi(S);
    // A hospital is rest whether you wanted it or not — and it has to put you
    // back far enough above the line that you are not straight back in it,
    // or a collapse becomes a permanent condition rather than a warning.
    P.health = C100(Math.max(P.health, RZ.range(60, 72)));
    S.skipTurns = (S.skipTurns || 0) + 1;

    // The country is sympathetic. The party starts counting.
    api.add('grassroots', RZ.range(1, 4));
    api.add('leader', -RZ.range(1, 5));
    api.add('party', -RZ.range(2, 6) * (S.flags.collapses > 1 ? 1.6 : 1));
    if (S.flags.collapses >= 2) {
      api.dirt('health', 'A pattern of hospital admissions that the party has started to discuss', 2);
    }

    RZ.engine.pushFeed(S, {
      kind: 'big', alert: true, src: 'Your health',
      title: S.flags.collapses === 1 ? 'You collapsed' : 'You collapsed again',
      body: S.flags.collapses === 1
        ? 'It happened in a corridor between two meetings, and the first thing you said when you woke up was to ask ' +
          'whether anybody had seen. They had. You are signed off for the month and the diary has been cleared by somebody else.'
        : 'The second time is not treated as bad luck. The doctors are careful; your own people are not. ' +
          'Somebody has already been asked, informally, whether they would be available.',
      deltas: api.deltas.slice(), tone: 'bad'
    });
    return true;
  }

  /* =======================================================================
     4. BLACK SWAN ECONOMIC SHOCKS
     ======================================================================= */
  var SHOCKS = [
    {
      id: 'commodity', src: 'Markets',
      title: function (a) { return 'The ' + a.C.econ.staple.split(/[ ,&]/)[0].toLowerCase() + ' price has collapsed'; },
      body: 'It went in a single session and it is not coming back this year. Treasury is rewriting the framework mid-cycle, ' +
            'the currency has followed it down, and every number the government has published since February is now fiction.',
      hit: function (a) {
        a.nation('growth', -RZ.range(2.5, 5.5));
        a.nation('inflation', RZ.range(3, 9));
        a.nation('reserves', -RZ.range(0.6, 2.2));
        a.S.nation.economy.staplePrice = clamp(a.S.nation.economy.staplePrice - RZ.range(18, 40), 30, 190);
        a.nation('unrest', RZ.range(3, 8));
      }
    },
    {
      id: 'currency', src: 'The reserve bank',
      title: 'The currency went in a week',
      body: 'The peg could not be held and the governor stopped trying on Thursday. Importers are quoting daily. ' +
            'Fuel queues formed before the announcement, which tells you who knew.',
      hit: function (a) {
        a.nation('inflation', RZ.range(6, 18));
        a.nation('reserves', -RZ.range(1.0, 3.0));
        a.nation('growth', -RZ.range(1.0, 3.0));
        a.nation('unrest', RZ.range(5, 12));
      }
    },
    {
      id: 'ratesshock', src: 'Abroad',
      title: 'The cost of the debt just doubled',
      body: 'A rate decision on another continent, and the yield on the ten-year moved further in one morning than in the ' +
            'previous two years. Nothing was done wrong here. That will not matter to anybody.',
      when: function (a) { return a.S.nation.economy.debt > 45; },
      hit: function (a) {
        a.nation('debt', RZ.range(6, 16));
        a.nation('growth', -RZ.range(1.2, 3.4));
        a.nation('inflation', RZ.range(1, 4));
        a.add('intl', -RZ.range(1, 5));
      }
    },
    {
      id: 'drought', src: 'The rains',
      title: 'The region has failed, not just the district',
      body: 'The maize crop is gone across four countries at once, which means there is nothing to import and no ' +
            'neighbour to import it from. The relief committee is meeting. It has nothing to distribute.',
      hit: function (a) {
        a.nation('inflation', RZ.range(4, 11));
        a.nation('growth', -RZ.range(1.5, 3.5));
        a.nation('unrest', RZ.range(6, 14));
        a.nation('health', -RZ.range(2, 6));
      }
    },
    {
      id: 'grid', src: 'The utility',
      title: 'The grid has failed',
      body: 'Stage six, indefinitely, and the utility will not say when. Smelters are down, the mines are on diesel, ' +
            'and every small business in the country is losing eight hours a day.',
      hit: function (a) {
        a.nation('growth', -RZ.range(2.0, 4.5));
        a.nation('unemployment', RZ.range(1.5, 4));
        a.nation('infra', -RZ.range(3, 9));
        a.nation('unrest', RZ.range(4, 10));
      }
    },
    {
      id: 'contagion', src: 'Public health',
      title: 'The border districts are closing',
      body: 'It arrived through the border posts before anybody was testing at them. The economy is being shut by ' +
            'circumstance rather than by decision, which is worse, because nobody can be seen to be in charge of it.',
      hit: function (a) {
        a.nation('growth', -RZ.range(2.5, 6.0));
        a.nation('unemployment', RZ.range(2, 6));
        a.nation('health', -RZ.range(4, 12));
        a.nation('deaths', RZ.irange(40, 900));
      }
    }
  ];

  function blackSwan(S) {
    // Roughly one shock every seven or eight years, and likelier where the
    // economy has no cushion.
    var e = S.nation.economy;
    var exposure = 0.010 + (e.reserves < 3 ? 0.005 : 0) + (e.debt > 80 ? 0.004 : 0);
    if (!RZ.chance(exposure)) return false;
    if (S.flags.lastShock !== undefined && S.turn - S.flags.lastShock < 18) return false;

    var api = RZ.engine.mkApi(S);
    var pool = SHOCKS.filter(function (sh) { return !sh.when || sh.when(api); });
    var sh = RZ.pick(pool);
    S.flags.lastShock = S.turn;
    S.flags.shocks = (S.flags.shocks || 0) + 1;
    sh.hit(api);

    // Whoever is in office owns it, deserved or not.
    if (S.parties[S.player.partyId] && S.parties[S.player.partyId].gov) {
      S.nation.govApproval = clamp(S.nation.govApproval - RZ.range(3, 9), 3, 95);
      if (S.player.isPresident) api.add('leader', -RZ.range(2, 6));
    }

    RZ.engine.pushFeed(S, {
      kind: 'big', alert: true, src: sh.src,
      title: typeof sh.title === 'function' ? sh.title(api) : sh.title,
      body: sh.body, deltas: api.deltas.slice(), tone: 'bad'
    });
    return true;
  }

  /* =======================================================================
     6. THE TENDERPRENEUR WEB
     Money taken during a campaign is not a gift and was never priced as one.
     ======================================================================= */
  function owe(S, name, weight) {
    S.capture = S.capture || { patrons: [], granted: 0, refused: 0 };
    // A debt with nobody's name on it cannot come and collect, and the code
    // that collects it says the name out loud. Somebody is always owed.
    if (!name) name = RZ.makeName(RZ.COUNTRIES[S.countryId]);
    var existing = S.capture.patrons.filter(function (p) { return p.name === name; })[0];
    if (existing) { existing.owed += weight; existing.since = S.turn; return existing; }
    var p = { name: name, owed: weight, since: S.turn, asks: 0, granted: 0, refused: 0, lastAsk: -99 };
    S.capture.patrons.push(p);
    return p;
  }

  function captureDemand(S) {
    if (!S.capture || !S.capture.patrons.length) return null;
    // Only somebody with real leverage bothers, and only once they think you
    // are worth something.
    var ready = S.capture.patrons.filter(function (p) {
      return p.owed > 0 && S.turn - p.lastAsk > 8 && S.turn - p.since > 3;
    });
    if (!ready.length) return null;
    var pat = RZ.weighted(ready, function (p) { return p.owed; });
    var tier = RZ.engine.mkApi(S).tier();
    if (tier < 3) return null;               // nothing to award yet
    if (!RZ.chance(0.10 + pat.owed * 0.012)) return null;

    pat.lastAsk = S.turn;
    pat.asks++;
    return pat;
  }

  // Built as an event so it goes through the existing modal and the existing
  // save/resume path rather than inventing a second way to ask a question.
  function demandEvent(S, pat) {
    var a = RZ.engine.mkApi(S);
    var size = Math.round(pat.owed * RZ.range(0.8, 1.6));
    return {
      id: 'capture-' + pat.name.replace(/\W/g, ''),
      kicker: 'A debt', patron: pat.name, size: size,
      title: pat.asks === 1 ? pat.name + ' would like a word'
                            : pat.name + ' is asking again',
      body: (pat.asks === 1
        ? 'He does not mention the money. He does not have to — it is the reason the meeting is in the diary at all. '
        : 'The last one went through, which is precisely why there is another. ') +
        'There is a procurement coming up in a department you can reach. He is not asking you to award it to him. ' +
        'He is asking you to make sure the specification is one that only he can meet.',
      choices: [
        { i: 0, t: 'Write the specification his way', d: 'Quick, quiet, and it compounds.', tag: 'risk', ok: true },
        { i: 1, t: 'Refuse, and say so to his face', d: 'He will not take it well, and he has money.', ok: true },
        { i: 2, t: 'Stall — promise to look at it', d: 'Buys a few months. Costs more later.', ok: true }
      ]
    };
  }

  function resolveDemand(S, ev, idx) {
    var a = RZ.engine.mkApi(S);
    var res = demandOutcome(S, a, ev, idx);
    res.deltas = a.deltas.slice();
    return res;
  }

  function demandOutcome(S, a, ev, idx) {
    var pat = (S.capture.patrons || []).filter(function (p) { return p.name === ev.patron; })[0];
    if (!pat) return { title: 'Nothing came of it', body: 'The meeting was cancelled.', tone: 'flat' };

    if (idx === 0) {
      pat.granted++; S.capture.granted++;
      // Paid, and more deeply owed than before. This is the trap.
      pat.owed = pat.owed * 1.45 + 2;
      a.add('money', a.wage(RZ.range(3, 9)));
      a.add('business', RZ.range(2, 6));
      a.add('stats.integrity', -RZ.range(2, 5));
      a.nation('corruption', RZ.range(0.6, 2.2));
      a.nation('infra', -RZ.range(0.5, 2.5));
      a.dirt('tender-' + pat.name.replace(/\W/g, ''),
        'A tender specification written around a single bidder, at ' + pat.name + '’s request', 3);
      return {
        title: 'The specification went out', tone: 'flat',
        body: 'Three bidders responded and only one of them could ever have qualified. He was grateful, briefly, ' +
              'and then he mentioned the next one. That is how this works: each favour is the collateral for the following favour.'
      };
    }

    if (idx === 2) {
      pat.owed *= 1.2;
      pat.lastAsk = S.turn - 5;              // he will be back sooner
      a.add('stats.cunning', RZ.range(0.4, 1.2));
      a.add('business', -RZ.range(0, 2));
      return {
        title: 'You said you would look at it', tone: 'flat',
        body: 'He has heard that sentence before and knows exactly what it is worth. He smiled and let it go, ' +
              'which means he has decided to spend a little more on you before he decides you are a loss.'
      };
    }

    // Refusal: economic retaliation, which is the only kind he has.
    pat.refused++; S.capture.refused++;
    pat.owed = Math.max(0, pat.owed - 2);
    a.add('business', -RZ.range(6, 14));
    a.add('money', -a.wage(RZ.range(1, 4)));
    a.nation('growth', -RZ.range(0.2, 0.9));
    if (RZ.chance(0.45)) a.makeRival();
    if (RZ.chance(0.35)) {
      // He knows what you took, because he gave it to you.
      a.dirt('funding-' + pat.name.replace(/\W/g, ''),
        'Campaign money from ' + pat.name + ', declared nowhere', 3);
    }
    a.add('stats.integrity', RZ.range(2, 5));
    return {
      title: 'He stopped taking your calls', tone: 'bad',
      body: 'Two projects in your province were paused within the fortnight and neither pause was explained. ' +
            'A journalist rang to ask about a donation from four years ago, using a figure only two people knew.'
    };
  }

  /* =======================================================================
     5. PROMISES COMING DUE
     The ledger itself lives on the player (engine.js). This is the collection.
     ======================================================================= */
  function promiseFallout(S) {
    var P = S.player;
    if (!P.promises || !P.promises.length) return false;
    var a = RZ.engine.mkApi(S);
    var fired = false;

    P.promises.forEach(function (pr) {
      if (pr.settled) return;
      var due = pr.due || 18;
      var age = a.monthsSince(pr);
      if (age < due) return;
      // Escalating, and only every few months so it is pressure rather than noise.
      if (pr.lastBite !== undefined && S.turn - pr.lastBite < 5) return;
      // Six bites is about two and a half years of being asked about it, by
      // which point it has produced a file and a nickname. After that it stops
      // being a recurring bill and becomes what it always really was: a thing
      // on your record. It went on biting every five months forever, which
      // over a long career is a tax nobody could see and nobody could pay off.
      if ((pr.bites || 0) >= 6) { pr.spent = true; return; }
      pr.lastBite = S.turn;
      pr.bites = (pr.bites || 0) + 1;
      fired = true;

      var severity = Math.min(4, pr.bites) * (pr.kind === 'cabinet' ? 1.6 : 1);
      a.add('grassroots', -RZ.range(1, 4) * severity);
      a.add('party', -RZ.range(0.5, 2.5) * severity);
      a.add('stats.integrity', -RZ.range(0.3, 1.2));
      // The country only wobbles for a promise made by somebody the country
      // has heard of. A ward councillor's unbuilt borehole is a personal
      // disgrace, not a national emergency — and charging it to national
      // stability every five months for the rest of a career was quietly
      // destabilising the republic on behalf of one broken borehole.
      var reach = Math.max(0, a.tier() - 5) / 8;
      if (reach > 0) a.nation('stability', -RZ.range(0.3, 1.5) * severity * reach);

      if (pr.bites === 3) {
        a.dirt('broken-' + pr.id,
          'A promise made in public and broken in private: ' + pr.text.toLowerCase(), 3);
      }

      RZ.engine.pushFeed(S, {
        kind: pr.bites >= 3 ? 'big' : 'bad', alert: pr.bites >= 3,
        src: pr.to || 'A promise',
        title: pr.bites === 1 ? 'They have noticed'
             : pr.bites === 2 ? 'It is being raised in public now'
             : 'You are the man who said it and did not do it',
        body: '“' + RZ.esc(pr.text) + '” — ' + age + ' months ago. ' +
          (pr.bites === 1
            ? 'A letter, then a second letter, and now a delegation that did not make an appointment.'
            : pr.bites === 2
            ? 'It was read out on radio this morning, with the date, and the presenter asked listeners to phone in if they remembered it.'
            : 'It is no longer a grievance about a promise. It is the shorthand people use for what you are.'),
        deltas: a.deltas.slice(), tone: 'bad'
      });
    });
    return fired;
  }

  // Cabinet promises are not judged on a timer; they come due the moment the
  // posts are actually handed out.
  function cabinetReckoning(S) {
    var P = S.player;
    if (!P.promises) return;
    var a = RZ.engine.mkApi(S);
    P.promises.forEach(function (pr) {
      if (pr.settled || pr.kind !== 'cabinet') return;
      pr.due = 0;                            // due immediately, from now on
      pr.lastBite = undefined;
    });
  }

  /* =======================================================================
     3. THE CONGRESS PURGE
     ======================================================================= */
  // Run before an election. The list is not decided by the country.
  function congressPurge(S) {
    var P = S.player, c = RZ.COUNTRIES[S.countryId];
    if (S.flags.purgedFor === S.nextElection) return null;   // once per cycle
    if (P.isPresident || P.isLeader) return null;            // you chair it
    var tier = RZ.engine.mkApi(S).tier();
    // The card this produces says "there is no seat to contest this election".
    // That is a candidates' list, and a branch chairperson is not on one — they
    // hold an internal office that no general election touches. The gate was at
    // tier two, which meant a ward councillor could be dropped from a slate they
    // were never on. It only bites from the seat upward.
    if (tier < 4) return null;

    S.flags.purgedFor = S.nextElection;

    // Branches decide the slate, and a machine decides the branches.
    var base = P.standing.grassroots * 0.45 + P.standing.party * 0.45 + P.fame * 0.10;
    // Allies are figures on the ladder with `side === 'ally'`, reached through
    // field.allies(). `P.allies` has never existed, so this term — and the
    // identical one in revoltOdds — silently contributed nothing at all, and
    // every ally anybody ever recruited counted for exactly zero here.
    var allies = RZ.field.allies(S).length * 2.5;
    var enemies = RZ.field.rivals(S).reduce(function (t, r) { return t + r.power * 0.06; }, 0);
    // What it takes to stay on a slate scales with the slate. Comparing an
    // absolute standing score against an absolute bar meant a branch chairperson
    // was being measured against what a cabinet minister needs, and was dropped
    // from a *branch* list for not having national numbers. The bar now rises
    // with the office, which is the thing that was actually intended.
    var threshold = 12 + tier * 3.4 + c.inst.patronage * 0.16;
    var score = base + allies - enemies + RZ.range(-8, 8);
    if (score >= threshold) return null;

    var a = RZ.engine.mkApi(S);
    S.flags.purged = true;
    a.add('party', -RZ.range(5, 12));
    a.add('leader', -RZ.range(2, 8));
    a.makeRival();

    RZ.engine.pushFeed(S, {
      kind: 'big', alert: true, src: 'The ' + c.terms.conference,
      title: 'Your name is not on the list',
      body: 'The nominations closed at midnight and the slate that came out of the provincial general council does not ' +
            'have you on it. Nobody rang. You found out the way everybody else did, from a photograph of a printed page. ' +
            'There is no seat to contest this election, because the party is what puts you on the ballot and the party has not.',
      deltas: a.deltas.slice(), tone: 'bad'
    });
    return { purged: true, score: Math.round(score), threshold: Math.round(threshold) };
  }

  /* =======================================================================
     7. THE LOOMING HEGEMON
     ======================================================================= */
  // A neighbour's army does not arrive because the numbers are bad. It arrives
  // because the numbers are bad AND nobody abroad is willing to argue for you.
  function sadcIntervention(S) {
    var P = S.player, c = RZ.COUNTRIES[S.countryId];
    var s = S.nation.society;
    if (!(s.unrest > 85 && P.standing.intl < 15)) {
      S.flags.sadcWarned = false;
      S.flags.sadcSince = 0;
      return false;
    }

    // Three months of warning, not one. A single month is not a warning: no
    // action in the game lifts international standing from single figures past
    // fifteen in one turn, so a one-month fuse was an announcement that the
    // career was already over. Three turns is enough to work the phones, go to
    // the summit, and put the unrest down — if the player drops everything.
    S.flags.sadcSince = S.flags.sadcSince || 0;
    S.flags.sadcSince++;
    if (!S.flags.sadcWarned) {
      S.flags.sadcWarned = true;
      RZ.engine.pushFeed(S, {
        kind: 'big', alert: true, src: 'Gaborone',
        title: 'The Organ has been convened on ' + c.name,
        body: 'The SADC Organ on Politics, Defence and Security Co-operation met without notice and did not issue the ' +
              'usual communiqué about non-interference. Two heads of state have stopped taking your calls. ' +
              'A standby brigade has been mentioned by name in a document that was not supposed to circulate.',
        tone: 'bad'
      });
      return false;
    }
    if (S.flags.sadcSince < 4) {
      // Still convened, still not moving. Say so once more halfway through, so
      // the player knows the clock is running rather than stopped.
      if (S.flags.sadcSince === 2) {
        RZ.engine.pushFeed(S, {
          kind: 'big', alert: true, src: 'Gaborone',
          title: 'The Organ has not adjourned',
          body: 'A second communiqué, shorter than the first, noting that the situation remains under active ' +
                'consideration. Two more capitals have recalled their high commissioners. There is still time ' +
                'to make this somebody else’s problem, and there is not much of it.',
          tone: 'bad'
        });
      }
      return false;
    }

    var inPower = P.isPresident || (S.parties[P.partyId] && S.parties[P.partyId].gov && RZ.engine.mkApi(S).tier() >= 6);
    if (!inPower) {
      // The government falls; a backbencher's career does not end with it.
      if (S.flags.sadcSurvived) return false;
      S.flags.sadcSurvived = true;
      var a = RZ.engine.mkApi(S);
      a.add('intl', RZ.range(1, 5));
      a.nation('unrest', -RZ.range(10, 25));
      a.nation('stability', -RZ.range(10, 20));
      RZ.engine.pushFeed(S, {
        kind: 'big', alert: true, src: 'Gaborone',
        title: 'The brigade crossed at first light',
        body: 'The government you were not part of has been suspended and a transitional council installed under regional ' +
              'supervision. You were not in it, which today is the most valuable thing about you.',
        deltas: a.deltas.slice(), tone: 'bad'
      });
      return false;
    }

    S.flags.sadcTurn = S.turn;
    P.record.push({ year: S.date.year, text: 'Removed by SADC intervention.' });
    RZ.engine.pushFeed(S, {
      kind: 'big', alert: true, src: 'Gaborone',
      title: 'The brigade crossed at first light',
      body: 'It was framed as a stabilisation mission at the invitation of institutions you no longer control. ' +
            'The airport was taken before the broadcast. You were flown out on somebody else’s aircraft and the ' +
            'communiqué thanked you for your co-operation with the transition.',
      tone: 'bad'
    });
    RZ.engine.endGame(S, 'sadc');
    return true;
  }

  /* =======================================================================
     THE MONTHLY ENTRY POINT
     ======================================================================= */
  function monthly(S, out) {
    S.flags = S.flags || {};
    tickBuffs(S);
    burnout(S);
    if (medicalCollapse(S)) out.collapsed = true;

    blackSwan(S);
    promiseFallout(S);

    // A patron's demand becomes the month's event, unless one is already waiting.
    if (!S.pendingEvent) {
      var pat = captureDemand(S);
      if (pat) S.pendingEvent = demandEvent(S, pat);
    }

    if (sadcIntervention(S)) return true;
    return false;
  }

  RZ.crisis = {
    monthly: monthly,
    addBuff: addBuff, owe: owe,
    congressPurge: congressPurge,
    cabinetReckoning: cabinetReckoning,
    resolveDemand: resolveDemand,
    SHOCKS: SHOCKS
  };
})();
