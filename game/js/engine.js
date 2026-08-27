/* engine.js — state, the monthly loop, the action API, and career progression. */
(function () {
  'use strict';

  var C100 = RZ.c100, clamp = RZ.clamp;

  // Monthly reference wage in local currency — everything financial scales off this.
  var WAGE_BASE = { BW: 3200, ZA: 6500, ZW: 450, ZM: 4200, NA: 6800, MW: 340000, MZ: 12500, LS: 4600, SZ: 5200, AO: 190000 };
  var ELECTION_MONTH = { BW: 10, ZA: 5, ZW: 8, ZM: 8, NA: 11, MW: 9, MZ: 10, LS: 10, SZ: 9, AO: 8 };

  var SAVE_KEY = 'kgosi_cadre_save_v1';

  /* =======================================================================
     NEW GAME
     ======================================================================= */
  function newGame(cfg) {
    RZ.seed(cfg.seed || (Date.now() % 2147483647));
    var c = RZ.COUNTRIES[cfg.countryId];
    var bg = RZ.bgById[cfg.bgId];
    var ladder = RZ.ladderFor(c.id);

    var S = {
      v: 1, seed: RZ.getSeed(), countryId: c.id,
      date: { year: c.startYear, month: 2, week: 1 }, turn: 0,
      // One turn is a month, except in the last eight weeks before a ballot,
      // when it is a week. `span` is the fraction of a month a turn covers, so
      // every monthly rate below can be written once and scaled.
      tempo: 'month', sprint: null, bill: null, contender: null, blocs: null, cast: {},
      ladder: ladder.map(function (r) { return r.id; }),
      player: {
        name: cfg.name, gender: cfg.gender, age: cfg.age || 34,
        regionId: cfg.regionId, bgId: cfg.bgId, partyId: cfg.partyId,
        stats: { oratory: 40, charisma: 40, intellect: 40, cunning: 40, grit: 40, integrity: 55 },
        standing: { grassroots: 10, party: 8, leader: 12, media: 6, business: 8, security: 6, intl: 4 },
        regionSupport: {}, money: 0, capital: 4, fame: 3, health: 92,
        rungIdx: 0, officeSince: { year: c.startYear, month: 2 },
        isLeader: false, isPresident: false, ministry: null,
        dirt: [], allies: [], rivals: [], record: [], titles: [], promises: [],
        yearsInOffice: 0, electionsWon: 0, electionsLost: 0
      },
      parties: {}, nation: {}, campaign: { effort: 0, delegateSpend: 0, season: false },
      startAs: cfg.startAs || 'activist',
      // Which answer you gave in the yard, or at the table. It sets the
      // starting position and then keeps mattering.
      origin: cfg.origin || null,
      flags: {}, feed: [], pendingEvent: null, seenEvents: {},
      actionsLeft: 3, actionsPerTurn: 3, skipTurns: 0, actionsThisMonth: 0,
      buffs: [], capture: { patrons: [], granted: 0, refused: 0 },
      // Rises while somebody is actively looking for something on you, and
      // falls back when nobody is. Multiplies the chance a file breaks.
      scandalRisk: 0,
      over: false, ending: null, legacyMarks: {}
    };

    // A candidate has already done the climb; they start where it got them,
    // with a nomination in hand and a ballot eight weeks out.
    if (cfg.startAs === 'candidate') {
      var mpIdx = 0;
      ladder.forEach(function (r, i) { if (r.tier <= 4) mpIdx = i; });
      S.player.rungIdx = Math.max(0, mpIdx - 1);
      S.player.age = cfg.age || 41;
      S.player.standing = { grassroots: 46, party: 34, leader: 18, media: 16, business: 14, security: 8, intl: 6 };
      S.player.stats = { oratory: 48, charisma: 48, intellect: 46, cunning: 45, grit: 47, integrity: 52 };
      S.player.fame = 18; S.player.capital = 10; S.player.health = 84;
      S.player.record = [{ year: c.startYear - RZ.irange(6, 12), text: 'Elected to the branch, and then the region.' }];
    }

    // apply background
    Object.keys(bg.stats || {}).forEach(function (k) { S.player.stats[k] = C100(S.player.stats[k] + bg.stats[k]); });
    Object.keys(bg.standing || {}).forEach(function (k) { S.player.standing[k] = C100(S.player.standing[k] + bg.standing[k]); });
    S.player.money = Math.round(WAGE_BASE[c.id] * (bg.money || 1) * 2);

    c.regions.forEach(function (r) { S.player.regionSupport[r.id] = r.id === cfg.regionId ? 14 : 1; });
    // Eleven years of branch meetings bought a name in the constituency. The
    // campaign opens close, not hopeless — the eight weeks are the argument.
    if (cfg.startAs === 'candidate') S.player.regionSupport[cfg.regionId] = 52;

    // parties
    c.parties.forEach(function (p) {
      S.parties[p.id] = {
        id: p.id, vote: p.vote, seats: 0, gov: !!p.gov, machine: p.machine,
        leaderName: RZ.makeName(c), leaderQuality: Math.round(RZ.range(38, 74)),
        unity: Math.round(RZ.range(45, 78))
      };
    });

    // the state of the country, before we work out who is running it
    S.nation = {
      govApproval: Math.round(RZ.range(40, 58)),
      presidentName: '', presidentParty: c.parties[0].id,
      yearsInPower: c.inst.incumbency > 70 ? RZ.irange(18, 42) : RZ.irange(3, 16),
      termNumber: 1,
      economy: {
        growth: c.econ.growth, inflation: c.econ.inflation, unemployment: c.econ.unemployment,
        debt: c.econ.debt, reserves: c.econ.reserves, staplePrice: 100
      },
      society: {
        unrest: C100(18 + (c.econ.unemployment - 20) * 0.7 + (100 - c.inst.electoral) * 0.12),
        corruption: C100(100 - (c.inst.judiciary * .5 + c.inst.media * .3 + (100 - c.inst.patronage) * .2)),
        health: 45, education: 48, infra: 45, stability: 62, coup: C100(c.inst.security * 0.25),
        deaths: 0, judiciary: c.inst.judiciary, electoral: c.inst.electoral
      },
      intl: { imf: false, sanctions: c.id === 'ZW' ? 45 : 0, donors: 55 },
      budget: { health: 12, education: 17, infra: 14, security: 13, social: 12, debtsvc: 14, admin: 18 },
      govParties: []
    };

    // seed a plausible current parliament
    var v0 = RZ.elections.projectVote(S, { noNoise: true });
    var a0 = RZ.elections.allocateSeats(S, v0);
    c.parties.forEach(function (p) { S.parties[p.id].seats = a0.seats[p.id] || 0; });
    var g0 = RZ.elections.formGovernment(S, a0.seats);
    c.parties.forEach(function (p) { S.parties[p.id].gov = g0.parties.indexOf(p.id) >= 0; });
    S.nation.govParties = g0.parties.slice();
    S.nation.presidentParty = g0.lead;
    S.nation.presidentName = S.parties[g0.lead].leaderName;
    S.nation.presidentPartyPrev = g0.lead;

    S.nextElection = c.nextElection;
    S.nextConference = c.startYear + RZ.irange(1, 4);
    S.lastElectionYear = c.startYear - 1;
    S.lastConferenceYear = c.startYear - 1;

    // A candidate does not wait four years for the good part. Wind the clock
    // to exactly eight weeks out and open on the sprint.
    if (cfg.startAs === 'candidate') {
      var em = ELECTION_MONTH[c.id];
      S.nextElection = c.startYear + (em > 3 ? 0 : 1);
      S.date.year = S.nextElection;
      S.date.month = em - 2;
      if (S.date.month < 1) { S.date.month += 12; S.date.year--; }
      S.date.week = 1;
      S.lastElectionYear = S.nextElection - 1;
      S.player.officeSince = { year: S.date.year, month: S.date.month };
      S.campaign.season = true;
      S.flags.nominatedFor = ladder[S.player.rungIdx + 1] ? ladder[S.player.rungIdx + 1].id : null;
    }

    // rivals & the people above you
    for (var i = 0; i < 4; i++) {
      var n = RZ.makeNpc(c, { partyId: cfg.partyId, power: Math.round(RZ.range(35, 75)) });
      S.player.rivals.push(n);
    }
    S.player.rivals[0].regionId = cfg.regionId;

    // The scene you played before the first month. Applied here rather than
    // with the background because one of the answers is a photograph of
    // somebody, and the rivals have only just been made.
    if (cfg.origin && RZ.ORIGIN_PACKAGES && RZ.ORIGIN_PACKAGES[cfg.origin]) {
      S.player.trait = cfg.origin;
      RZ.ORIGIN_PACKAGES[cfg.origin](S, c, null);
      S.player.money = Math.max(0, Math.round(S.player.money));
      S.player.capital = Math.max(0, Math.round(S.player.capital));
      ['grassroots', 'party', 'leader', 'media', 'business', 'security', 'intl'].forEach(function (k) {
        S.player.standing[k] = C100(S.player.standing[k]);
      });
      Object.keys(S.player.stats).forEach(function (k) { S.player.stats[k] = C100(S.player.stats[k]); });
    }

    // Six electorates rather than one, sized off this country's own numbers
    // and tilted by the room the origin scene put you in.
    if (RZ.blocs) RZ.blocs.init(S);

    // Somebody else started this year too, with the opposite talent. Made
    // after the origin scene, because which one you get is decided by what
    // the answers in it made you.
    if (RZ.contender) {
      RZ.contender.init(S);
      var ct0 = S.contender;
      pushFeed(S, {
        kind: 'flat', src: c.regionById[ct0.regionId].name,
        title: 'A name you will hear again: ' + ct0.name,
        body: (ct0.sameParty
          ? 'Same party card, same year, a ' + c.terms.region + ' away. '
          : 'The other side of the aisle, same year, a ' + c.terms.region + ' away. ') +
          'They climb ' + RZ.contender.STYLES[ct0.trait].climbs + ', which is the one thing you cannot do, ' +
          'and there is exactly one of each of these jobs.',
        tone: 'flat'
      });
    }

    if (cfg.startAs === 'candidate') {
      pushFeed(S, {
        kind: 'big', src: 'The nomination',
        title: cfg.name + ' is the candidate for ' + c.regionById[cfg.regionId].name,
        body: 'It took eleven years of branch meetings and one very long provincial general council to get your name ' +
              'onto that list. The ballot is in eight weeks. Everything before this was the qualifying round.',
        tone: 'good'
      });
      // Open directly on the sprint rather than making the player skip a month
      // into it.
      if (RZ.sprint) RZ.sprint.begin(S);
      S.actionsPerTurn = 2; S.actionsLeft = 2;
    } else {
      pushFeed(S, {
        kind: 'big', src: 'Your first entry in the register',
        title: cfg.name + ' joins the ' + (c.partyById[cfg.partyId] ? c.partyById[cfg.partyId].name : 'movement'),
        body: 'A ' + bg.name.toLowerCase() + ' from ' + c.regionById[cfg.regionId].name + ', signed up at a ' +
              c.terms.branch + ' meeting on a Tuesday evening. Nobody present will remember it.',
        tone: 'good'
      });
    }

    return S;
  }

  /* =======================================================================
     ACTION API
     ======================================================================= */
  function mkApi(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var P = S.player;
    var deltas = [];
    var wageBase = WAGE_BASE[c.id];

    function record(label, amount) {
      if (Math.abs(amount) < 0.05) return;
      deltas.push({ label: label, v: amount });
    }

    var LABELS = {
      grassroots: 'Grassroots', party: 'Party', leader: 'Leadership', media: 'Media',
      business: 'Business', security: 'Security', intl: 'International',
      fame: 'Fame', health: 'Health', capital: 'Capital'
    };

    var api = {
      S: S, C: c, P: P, t: c.terms, wageBase: wageBase,
      rng: RZ.range, chance: RZ.chance, esc: RZ.esc, irange: RZ.irange,
      deltas: deltas,

      wage: function (m) { return Math.round(wageBase * m); },
      tier: function () { return RZ.ladderFor(c.id)[P.rungIdx].tier; },
      trait: function () { return (RZ.TRAITS && RZ.TRAITS[P.trait]) || {}; },
      rung: function () { return RZ.ladderFor(c.id)[P.rungIdx]; },
      month: function () { return S.date.month; },
      homeName: function () { return c.regionById[P.regionId].name; },
      inGov: function () { return !!(S.parties[P.partyId] && S.parties[P.partyId].gov); },
      isLeader: function () { return !!P.isLeader; },
      isPresident: function () { return !!P.isPresident; },
      yearsToElection: function () { return S.nextElection - S.date.year; },
      isCampaignSeason: function () { return S.campaign.season; },

      roll: function (stat, dc) {
        var v = (P.stats[stat] !== undefined) ? P.stats[stat] : P.standing[stat] || 40;
        return (v + RZ.range(-18, 18) + (P.health - 70) * 0.15) >= dc;
      },

      // A trait is not a starting bonus that fades. It bends every gain you
      // make for the rest of the career, in the one place they all pass.
      traitScale: function (key, amt) {
        var t = (RZ.TRAITS && RZ.TRAITS[P.trait]) || null;
        if (!t) return amt;
        if (amt > 0) {
          if (key === 'grassroots' && t.grassrootsGain) return amt * t.grassrootsGain;
          if (key === 'party' && t.partyGain) return amt * t.partyGain;
          if (key === 'media' && t.mediaGain) return amt * t.mediaGain;
          if (key === 'money' && t.moneyGain) return amt * t.moneyGain;
          if (key === 'capital' && t.capitalGain) return amt * t.capitalGain;
        } else {
          if (key === 'stats.integrity' && t.integrityDecay) return amt * t.integrityDecay;
        }
        return amt;
      },

      // A rally is a rally: it moves everybody a little, in proportion to how
      // many of them there are. Naming winners and losers is what api.blocs()
      // is for, and that one comes back through addRaw so the net is counted
      // exactly once.
      add: function (key, amt) {
        var out = api.addRaw(key, amt);
        if (key === 'grassroots' && RZ.blocs && amt) RZ.blocs.drift(S, api.traitScale(key, amt) * 0.34);
        return out;
      },

      // Name who gains and who loses, and let the size of each of them decide
      // what it was worth overall.
      blocs: function (deltas) { return RZ.blocs ? RZ.blocs.move(S, api, deltas) : null; },
      blocMood: function (id) { var b = RZ.blocs && RZ.blocs.get(S, id); return b ? b.mood : 50; },

      addRaw: function (key, amt) {
        amt = api.traitScale(key, amt);
        if (!amt) return;
        if (key.indexOf('stats.') === 0) {
          var k = key.slice(6);
          P.stats[k] = C100(P.stats[k] + amt);
          record(k.charAt(0).toUpperCase() + k.slice(1), amt);
          return;
        }
        if (P.standing[key] !== undefined) {
          P.standing[key] = C100(P.standing[key] + amt); record(LABELS[key] || key, amt); return;
        }
        if (key === 'money') { P.money = Math.round(P.money + amt); record('Money', amt); return; }
        if (key === 'fame') { P.fame = C100(P.fame + amt); record('Fame', amt); return; }
        if (key === 'health') { P.health = C100(P.health + amt); record('Health', amt); return; }
        if (key === 'capital') { P.capital = Math.max(0, Math.round(P.capital + amt)); record('Capital', amt); return; }
      },

      addRegion: function (rid, amt) {
        if (!S.player.regionSupport[rid] && S.player.regionSupport[rid] !== 0) return;
        S.player.regionSupport[rid] = C100(S.player.regionSupport[rid] + amt);
      },

      regionsNear: function () {
        var out = [P.regionId];
        var r = api.rung();
        if (r.reach === 'national') { return c.regions.map(function (x) { return x.id; }); }
        if (r.reach === 'region') {
          var idx = c.regions.findIndex(function (x) { return x.id === P.regionId; });
          [idx - 1, idx + 1].forEach(function (i) { if (c.regions[i]) out.push(c.regions[i].id); });
        }
        return out;
      },

      nation: function (key, amt) {
        var n = S.nation;
        if (n.economy[key] !== undefined) { n.economy[key] = Math.max(0, n.economy[key] + amt); return; }
        if (n.society[key] !== undefined) { n.society[key] = C100(n.society[key] + amt); return; }
        if (key === 'deaths') { n.society.deaths += amt; return; }
        if (key === 'coup') { n.society.coup = C100(n.society.coup + amt); return; }
      },

      /* --- dirt --- */
      dirt: function (id, label, sev) {
        if (P.dirt.some(function (d) { return d.id === id; })) {
          var e = P.dirt.filter(function (d) { return d.id === id; })[0]; e.severity += 1; return;
        }
        P.dirt.push({ id: id, label: label, severity: sev, exposed: false, year: S.date.year });
      },
      worstDirt: function () {
        var un = P.dirt.filter(function (d) { return !d.exposed; });
        var pool = un.length ? un : P.dirt;
        return pool.slice().sort(function (a, b) { return b.severity - a.severity; })[0];
      },
      removeDirt: function (id) { P.dirt = P.dirt.filter(function (d) { return d.id !== id; }); },
      exposeDirt: function (id) {
        P.dirt.forEach(function (d) {
          if (d.id !== id || d.exposed) return;
          d.exposed = true;
          api.add('media', -d.severity * 3);
          api.add('party', -d.severity * 2);
          api.add('leader', -d.severity * 2.5);
          api.add('stats.integrity', -d.severity * 2);
          api.add('fame', d.severity * 1.5);
        });
      },
      clearExposed: function (n) {
        var ex = P.dirt.filter(function (d) { return d.exposed; });
        for (var i = 0; i < n && i < ex.length; i++) api.removeDirt(ex[i].id);
      },

      /* --- people --- */
      rivalCount: function () { return P.rivals.length; },
      aRival: function () { return P.rivals[0]; },
      makeRival: function () { P.rivals.push(RZ.makeNpc(c, { partyId: P.partyId, power: Math.round(RZ.range(45, 85)) })); },
      removeRival: function () { if (P.rivals.length) P.rivals.shift(); },
      makeAlly: function () { P.allies.push(RZ.makeNpc(c, { partyId: P.partyId })); },
      recruitAlly: function () { P.allies.push(RZ.makeNpc(c, { partyId: P.partyId, power: Math.round(RZ.range(25, 65)) })); },

      digOnRival: function () {
        if (!P.rivals.length) return null;
        var r = RZ.pick(P.rivals);
        var digT = ((RZ.TRAITS && RZ.TRAITS[P.trait]) || {}).digBonus || 0;
        if (r.dirt.length > 1 || !RZ.chance(0.55 + c.inst.patronage / 260 + digT)) return null;
        var label = RZ.pick([
          'an undeclared property in the capital', 'a tender awarded to a relative',
          'a maintenance case they settled quietly', 'a payment from a mining company',
          'a fraudulent qualification on their CV', 'a second family nobody knew about',
          'a bank account in another jurisdiction', 'votes bought at their last nomination'
        ]);
        r.dirt.push({ label: label, used: false });
        return { name: r.name, label: label };
      },
      hasLeverage: function () { return P.rivals.some(function (r) { return r.dirt.some(function (d) { return !d.used; }); }); },

      doLeak: function (isDeputy) {
        var pool = P.rivals.filter(function (r) { return r.dirt.some(function (d) { return !d.used; }); });
        if (!pool.length) return { title: 'Nothing to leak', body: 'You have no file worth the risk.', tone: 'flat', fail: true };
        // If one of them is actively hunting you, he is the one the file is for.
        var hunted = pool.filter(function (x) { return x.nemesis; });
        var r = hunted.length ? hunted[0] : RZ.pick(pool);
        var d = r.dirt.filter(function (x) { return !x.used; })[0];
        d.used = true;
        var clean = RZ.rnd() < (0.42 + P.stats.cunning / 260 - c.inst.media / 400);
        r.power = Math.max(5, r.power - RZ.range(15, 40));
        // Breaking the man who has been hunting you is one of the three ways
        // out of a nemesis, and the only one that does not require you to
        // outrank him or leave the party.
        if (clean && r.nemesis && r.power < 45 && RZ.revolt) RZ.revolt.tryNeutralise(S, r, 'expose');
        if (r.power < 22) P.rivals = P.rivals.filter(function (x) { return x !== r; });
        api.add('stats.integrity', -RZ.range(1, 3));
        if (clean) {
          api.add('party', RZ.range(1, 4));
          return { title: 'It ran on Sunday, and it stuck',
            body: '<strong>' + RZ.esc(r.name) + '</strong> is now explaining ' + RZ.esc(d.label) + ' to a room full of cameras. ' +
                  'Nobody has traced the documents. ' + (isDeputy ? 'Your deputy has stopped travelling to the provinces.' : ''),
            tone: 'good' };
        }
        api.add('media', -RZ.range(3, 8)); api.add('party', -RZ.range(2, 6));
        api.dirt('leak', 'A briefing campaign against a colleague traced back to your office', 2);
        return { title: 'It was traced to you',
          body: 'The story ran, and then the story about who supplied it ran. <strong>' + RZ.esc(r.name) +
                '</strong> is damaged; you are now the person who did it, and that is a permanent description.',
          tone: 'bad' };
      },

      doBury: function () {
        var un = P.dirt.filter(function (d) { return !d.exposed; });
        if (!un.length) return { title: 'Nothing outstanding', body: 'There is nothing currently buriable.', tone: 'flat', fail: true };
        var d = un.sort(function (a, b) { return b.severity - a.severity; })[0];
        var cost = api.wage(3 + d.severity * 2.5);
        if (P.money < cost) return { title: 'You cannot afford the lawyers', body: 'Discretion is expensive and you are short.', tone: 'bad', fail: true };
        api.add('money', -cost);
        var ok = RZ.rnd() < (0.62 - c.inst.judiciary / 320 - c.inst.media / 400 + P.stats.cunning / 300);
        if (ok) { api.removeDirt(d.id); api.add('stats.integrity', -RZ.range(1, 3));
          return { title: 'It went away', body: 'A settlement with a confidentiality clause, a witness who has moved to another town, and a file that is now incomplete.', tone: 'good' }; }
        api.exposeDirt(d.id);
        return { title: 'The clean-up became the story', body: 'Somebody kept a copy of the settlement agreement. There is now a paper trail about the paper trail.', tone: 'bad' };
      },

      defect: function () {
        var others = c.parties.filter(function (p) { return p.id !== P.partyId; });
        if (!others.length) return { title: 'Nowhere to go', body: 'There is no other party in this system.', tone: 'flat', fail: true };
        var target = RZ.weighted(others, function (p) { return S.parties[p.id].vote; });
        var old = c.partyById[P.partyId];
        P.partyId = target.id;
        P.standing.party = C100(P.standing.party * 0.45 + 18);
        P.standing.leader = C100(20 + RZ.range(0, 15));
        P.standing.grassroots = C100(P.standing.grassroots * 0.72);
        Object.keys(P.regionSupport).forEach(function (k) { P.regionSupport[k] = C100(P.regionSupport[k] * 0.6); });
        P.fame = C100(P.fame + RZ.range(4, 10));
        P.rivals.push(RZ.makeNpc(c, { partyId: old.id, power: 70 }));
        S.flags.defected = (S.flags.defected || 0) + 1;
        return { title: 'You crossed the floor',
          body: 'You are now a member of <strong>' + RZ.esc(target.abbr) + '</strong>. Your old branch chairs will not speak to you, ' +
                'your new colleagues do not trust you, and everything you ever said about them is on video.',
          tone: 'flat' };
      },

      relocate: function () {
        if (S.flags.lastMove !== undefined && S.turn - S.flags.lastMove < 12) {
          return { title: 'You have only just arrived', body: 'Move again this soon and you are not a candidate, you are a tourist. Give it a year.', tone: 'flat', fail: true };
        }
        // you go where your party's vote actually is
        var vote = RZ.elections.projectVote(S, { noNoise: true });
        var options = c.regions.filter(function (r) { return r.id !== P.regionId; })
          .sort(function (x, y) { return vote.byRegion[y.id][P.partyId] - vote.byRegion[x.id][P.partyId]; })
          .slice(0, 4);
        var target = RZ.weighted(options, function (r) {
          return Math.pow(Math.max(1, vote.byRegion[r.id][P.partyId]), 4);
        });
        S.flags.lastMove = S.turn;
        var oldName = c.regionById[P.regionId].name;
        P.regionId = target.id;
        // your name means nothing here yet
        P.standing.grassroots = C100(P.standing.grassroots * 0.55);
        P.regionSupport[target.id] = C100((P.regionSupport[target.id] || 0) + 12 + P.fame * 0.12);
        api.add('money', -Math.round(wageBase * 2));
        api.add('party', -RZ.range(0, 3));
        P.record.push({ year: S.date.year, text: 'Moved base from ' + oldName + ' to ' + target.name + '.' });
        return {
          title: 'You are a ' + target.name + ' candidate now',
          body: 'You rented a house, joined a ' + c.terms.branch + ', and started appearing at funerals in a district where ' +
                'nobody is related to you. Your party polls <strong>' + RZ.round(vote.byRegion[target.id][P.partyId], 1) +
                '%</strong> here. They will call you a parachute candidate for ten years, and then they will stop.',
          tone: 'flat'
        };
      },

      // how strong is your party where you stand?
      homeViability: function () {
        var vote = RZ.elections.projectVote(S, { noNoise: true });
        var here = vote.byRegion[P.regionId];
        var mine = here[P.partyId], best = 0;
        Object.keys(here).forEach(function (k) { if (k !== P.partyId && here[k] > best) best = here[k]; });
        return { mine: mine, best: best, safe: mine > best };
      },

      otherParty: function () {
        var others = c.parties.filter(function (p) { return p.id !== P.partyId; });
        return others.length ? RZ.weighted(others, function (p) { return S.parties[p.id].vote; }) : c.parties[0];
      },

      demote: function () {
        if (P.rungIdx <= 0) return;
        var lad = RZ.ladderFor(c.id);
        var from = lad[P.rungIdx].title;
        if (P.isPresident) {          // a head of state does not get demoted; they resign
          S.flags.wasPresident = true;
          P.record.push({ year: S.date.year, text: 'Resigned as ' + from + '.' });
          endGame(S, 'stepdown');
          return;
        }
        P.rungIdx = Math.max(0, P.rungIdx - (P.rungIdx > 4 ? 1 : 1));
        P.isLeader = false; P.isPresident = false;
        P.record.push({ year: S.date.year, text: 'Lost the office of ' + from + '.' });
        pushFeed(S, { kind: 'bad', src: 'Politics', title: 'You are out of ' + from,
          body: 'The office is gone. The staff were reassigned within a day and the car was collected on Friday.', tone: 'bad' });
      },

      /* --- things you said in a room, which people remember --- */
      // opts: { due } months before it starts costing you, { kind } 'policy'
      // or 'cabinet' (a cabinet promise comes due when the posts are handed
      // out, not on a timer), { to } who you said it to.
      promise: function (id, label, opts) {
        P.promises = P.promises || [];
        if (P.promises.some(function (x) { return x.id === id; })) return;
        opts = opts || {};
        P.promises.push({
          id: id, text: label, year: S.date.year, month: S.date.month,
          due: opts.due || (opts.kind === 'cabinet' ? 60 : 18),
          kind: opts.kind || 'policy', to: opts.to || null,
          bites: 0, settled: false
        });
      },
      hasPromise: function (id) { return (P.promises || []).some(function (x) { return x.id === id; }); },
      keepPromise: function (id) {
        P.promises = (P.promises || []).filter(function (x) { return x.id !== id; });
      },
      brokenPromises: function () {
        return (P.promises || []).filter(function (x) { return (x.bites || 0) > 0; }).length;
      },
      startProject: function (kindId, opts) {
        return RZ.ward ? RZ.ward.start(S, api, kindId, opts) : null;
      },
      wardTrust: function (n) {
        if (!RZ.ward) return 0;
        RZ.ward.init(S);
        if (n) S.ward.trust = C100(S.ward.trust + n);
        return S.ward.trust;
      },
      whipped: function () { return !!(RZ.revolt && RZ.revolt.whipped(S)); },

      owePatron: function (name, weight) {
        return RZ.crisis ? RZ.crisis.owe(S, name, weight) : null;
      },
      oldestPromise: function () {
        var ps = (P.promises || []).slice().sort(function (x, y) {
          return (x.year * 12 + x.month) - (y.year * 12 + y.month);
        });
        return ps[0] || null;
      },
      monthsSince: function (p) {
        return (S.date.year * 12 + S.date.month) - (p.year * 12 + p.month);
      },

      skipTurns: function (n) { S.skipTurns = (S.skipTurns || 0) + n; },
      campaignEffort: function (n) { S.campaign.effort = (S.campaign.effort || 0) + n; },
      spendOnDelegates: function (n) { S.campaign.delegateSpend = (S.campaign.delegateSpend || 0) + n; },
      legacyMark: function (k) { S.legacyMarks[k] = true; },
      attemptThirdTerm: function () { return RZ.gov.attemptThirdTerm(api); }
    };
    return api;
  }

  /* =======================================================================
     ACTIONS
     ======================================================================= */
  function availableActions(S) {
    var api = mkApi(S);
    var tier = api.tier();
    var list = RZ.ACTIONS.filter(function (act) {
      if (act.tier && (tier < act.tier[0] || tier > act.tier[1])) return false;
      if (act.when && !act.when(api)) return false;
      return true;
    });
    if (S.player.isPresident) list = list.concat(RZ.gov.presidentialActions(S));
    // In the sprint the tactical deck comes first: a week is spent in a ward,
    // not on a five-year plan.
    if (S.tempo === 'week' && RZ.sprint) list = RZ.sprint.weekActions(S).concat(list);
    // A bill in committee runs on the same weekly clock, and while it is
    // running the only thing worth doing is counting and buying.
    if (S.tempo === 'week' && RZ.bill) list = RZ.bill.weekActions(S).concat(list);
    return list.map(function (act) {
      return {
        id: act.id, ico: act.ico,
        name: typeof act.name === 'function' ? act.name(api) : act.name,
        desc: typeof act.desc === 'function' ? act.desc(api) : act.desc,
        risky: !!act.risky, ap: act.ap || 1
      };
    });
  }

  function doAction(S, id) {
    if (S.actionsLeft <= 0) return null;
    var act = (S.tempo === 'week' && RZ.sprint && RZ.sprint.weekActionById(id)) ||
              (S.tempo === 'week' && S.bill && RZ.bill && RZ.bill.weekActionById(id)) ||
              RZ.actionById[id] || RZ.gov.actionById(id);
    if (!act) return null;
    // A ward blitz needs to know which ward; main.js asks, then calls back.
    if (act.special) return { special: act.special, act: act };

    // Some of these are meetings, not dice rolls. If a conversation is waiting
    // on this topic, the player has to sit through it and answer for himself;
    // the feed entry is written when the room empties.
    var scene = RZ.dialogue && RZ.dialogue.sceneFor(S, id);
    if (scene) {
      S.actionsLeft -= (act.ap || 1);
      S.actionsThisMonth = (S.actionsThisMonth || 0) + (act.ap || 1);
      return { dialogue: RZ.dialogue.begin(S, scene, act) };
    }

    var api = mkApi(S);
    var res = act.run(api);
    if (!res || res.fail) return { fail: true, res: res, deltas: [] };
    S.actionsLeft -= (act.ap || 1);
    S.actionsThisMonth = (S.actionsThisMonth || 0) + (act.ap || 1);
    var entry = {
      kind: res.tone === 'good' ? 'good' : (res.tone === 'bad' ? 'bad' : 'flat'),
      src: (typeof act.name === 'function' ? act.name(api) : act.name),
      title: res.title, body: res.body, deltas: api.deltas.slice(), tone: res.tone
    };
    pushFeed(S, entry);
    return { res: res, deltas: api.deltas, entry: entry };
  }

  /* =======================================================================
     TURN ADVANCE
     ======================================================================= */
  function endTurn(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var P = S.player;
    var out = { events: [], election: null, conference: null, promo: null };
    // What fraction of a month this turn covers. Everything below is written as
    // a monthly rate and multiplied by it, so a weekly turn is a quarter of a
    // month in every respect rather than a month that happens to be short.
    var span = S.tempo === 'week' ? 0.25 : 1;
    out.span = span;
    // A mandate won on the floor holds the machine off for a year: party and
    // leadership standing erode at half speed, which is the window the ladder
    // needs to be climbable at all.
    var mandate = (RZ.revolt && RZ.revolt.mandateActive(S)) ? 0.5 : 1;

    // ---- income & costs ----
    var lad = RZ.ladderFor(c.id);
    var rung = lad[P.rungIdx];
    var w = WAGE_BASE[c.id];
    var income = w * (rung.sal || 0);
    var bgIncome = rung.sal ? 0 : w * 1.3;         // the day job you still have
    // constituency office, funerals, school fees, and the relatives who now visit
    var costs = w * (0.85 + (rung.sal || 0) * 0.62 + P.fame / 110 + (rung.tier >= 4 ? 1.1 : 0.15));
    P.money = Math.round(P.money + (income + bgIncome - costs) * span);
    P.capital = Math.min(200, P.capital + (rung.cap || 0) * 0.25 * span);

    // ---- health & decay ----
    // the body recovers between exertions when young, and stops doing so later
    var hDrift = P.age < 45 ? RZ.range(0.7, 1.7)
               : P.age < 58 ? RZ.range(0.1, 1.0)
               : P.age < 68 ? RZ.range(-0.5, 0.4)
               : RZ.range(-1.5, -0.2);
    P.health = C100(P.health + hDrift * span);
    // Standing is rented, not owned: the higher it is, the more it costs to hold.
    ['grassroots', 'media', 'leader', 'business', 'security', 'intl'].forEach(function (k) {
      var tr = (RZ.TRAITS && RZ.TRAITS[P.trait]) || {};
      var hold = (k === 'business' && tr.businessDecay) ? tr.businessDecay : 1;
      P.standing[k] = C100(P.standing[k] -
        (0.15 + P.standing[k] * 0.012) * RZ.range(0.7, 1.3) * span * (k === 'leader' ? mandate : 1) * hold);
    });
    P.standing.party = C100(P.standing.party - (0.06 + P.standing.party * 0.005) * RZ.range(0.7, 1.3) * span * mandate);
    P.fame = C100(P.fame - (0.10 + P.fame * 0.007) * RZ.range(0.7, 1.3) * span);
    Object.keys(P.regionSupport).forEach(function (k) {
      P.regionSupport[k] = C100(P.regionSupport[k] - (0.08 + P.regionSupport[k] * 0.008) * RZ.range(0.7, 1.3) * span);
    });

    // ---- scandals fade (slowly, and more slowly where the press has a memory) ----
    if (P.dirt.length) {
      var forget = 0.022 * (1 - c.inst.media / 260) * span;
      P.dirt.forEach(function (d) { if (d.exposed && RZ.chance(forget)) d.severity -= 1; });
      var before = P.dirt.length;
      P.dirt = P.dirt.filter(function (d) { return d.severity > 0; });
      if (P.dirt.length < before) {
        pushFeed(S, { kind: 'flat', src: 'Time', title: 'Nobody asks about it any more',
          body: 'A story that once looked fatal has stopped being raised at press conferences. It is not forgotten. It is simply no longer news.',
          tone: 'flat' });
      }
    }

    // ---- economy tick ----
    tickEconomy(S, span);

    // ---- rivals move ----
    if (RZ.chance(0.25 * span)) {
      P.rivals.forEach(function (r) { r.power = clamp(r.power + RZ.range(-3, 4), 5, 100); });
    }

    // ---- calendar ----
    if (S.tempo === 'week') {
      // Four weeks to a month. The month only turns when the fourth one does,
      // so every date-based rule downstream still sees an ordinary calendar.
      S.date.week = (S.date.week || 1) + 1;
      if (S.date.week > 4) { S.date.week = 1; advanceMonth(S); }
      if (S.sprint) S.sprint.weeksLeft = Math.max(0, S.sprint.weeksLeft - 1);
      if (S.bill) S.bill.weeksLeft = Math.max(0, S.bill.weeksLeft - 1);
    } else {
      S.date.week = 1;
      advanceMonth(S);
    }
    S.turn++;

    S.campaign.season = isCampaignSeason(S);
    if (!S.campaign.season) { S.campaign.effort *= Math.pow(0.9, span); S.campaign.delegateSpend *= Math.pow(0.85, span); }

    // ---- gear change ----
    // A bill on the order paper owns the weekly clock until it is voted on —
    // unless the House is dissolved out from under it, in which case it falls
    // and the campaign takes the weeks over.
    if (RZ.bill && S.bill) {
      if (S.tempo === 'week') out.billWeek = RZ.bill.tickWeek(S);
      if (RZ.sprint && S.campaign.season && RZ.sprint.dissolves(S)) out.billLapsed = RZ.bill.lapse(S);
      else if (S.bill.weeksLeft <= 0) out.billResult = RZ.bill.division(S);
    }

    // Eight weeks out the game stops being a career and becomes a campaign.
    if (RZ.sprint) {
      if (S.tempo === 'month' && RZ.sprint.due(S)) { RZ.sprint.begin(S); out.sprintStarted = true; }
      else if (S.tempo === 'week') { out.sprintWeek = RZ.sprint.tickWeek(S); }
    }

    // ---- scheduled politics ----
    if (S.lastConferenceYear === undefined) S.lastConferenceYear = c.startYear - 1;
    if (S.lastElectionYear === undefined) S.lastElectionYear = c.startYear - 1;

    var confDue = S.date.year > S.nextConference ||
                  (S.date.year === S.nextConference && S.date.month >= 6);
    if (confDue && S.lastConferenceYear < S.nextConference) {
      S.lastConferenceYear = S.nextConference; out.conference = true;
    }
    if (S.date.year > S.nextConference) RZ.gov.afterConference(S);

    var elecDue = S.date.year > S.nextElection ||
                  (S.date.year === S.nextElection && S.date.month >= ELECTION_MONTH[c.id]);
    if (elecDue && S.lastElectionYear < S.nextElection) {
      S.lastElectionYear = S.nextElection; out.election = true;
      // The campaign is over the moment the polls open; fold the ward result
      // back into the numbers the count actually reads.
      if (S.tempo === 'week' && RZ.sprint) out.sprintResult = RZ.sprint.end(S);
    }

    // ---- the top post falls vacant every few years where it is appointed ----
    if (c.system === 'monarchy') {
      if (S.flags.nextVacancy === undefined) S.flags.nextVacancy = S.turn + RZ.irange(48, 120);
      if (S.turn >= S.flags.nextVacancy) {
        S.flags.postVacant = true;
        S.flags.nextVacancy = S.turn + RZ.irange(84, 168);
        pushFeed(S, { kind: 'big', src: 'Lobamba',
          title: 'The office of ' + c.terms.hos + ' is vacant',
          body: 'The incumbent has been thanked for their service and relieved of it in the same sentence. ' +
                'Names are circulating. None of them are circulating publicly.', tone: 'good' });
      }
    }

    // ---- appointment windows ----
    if ((S.date.month === 1 || S.date.month === 7) && !out.election) {
      out.promo = considerAppointment(S);
    }

    // ---- event roll ----
    if (!out.election && !out.conference && RZ.chance(0.62 * span)) {
      var ev = rollEvent(S);
      if (ev) S.pendingEvent = ev;
    }

    // ---- the things that happen to you ----
    // Burnout, market shocks, patrons calling in what they are owed, promises
    // coming due, and the regional brigade. Returns true when it has ended the
    // career, in which case nothing after it matters.
    if (RZ.crisis && RZ.crisis.monthly(S, out)) { save(S); return out; }
    if (RZ.revolt) out.nemesis = RZ.revolt.nemesisTurn(S);
    // The other one moves whether or not you did anything this month.
    if (RZ.contender) RZ.contender.tick(S, span, out);
    // The electorate reads the same newspaper you do, and six different parts
    // of it draw six different conclusions from it.
    if (RZ.blocs) out.blocs = RZ.blocs.tick(S, span, out);
    // The ward keeps its own opinion of you, and the sites keep building or
    // stop, whether or not you spent an action on them this month.
    if (RZ.ward && mkApi(S).tier() >= 4) RZ.ward.tick(S, span, out);
    // The tiers where the job changes: a cabinet that has its own reasons for
    // being in it, and crises that send somebody to find you.
    if (RZ.state) out.crisis = RZ.state.tick(S, span, out);
    if (RZ.sprint && !S.pendingEvent) {
      var aud = RZ.sprint.auditDue(S);
      if (aud) S.pendingEvent = aud;
    }

    // ---- danger checks ----
    checkDangers(S, out);
    if (S.over) { save(S); return out; }

    // ---- the slate is drawn up before the country votes ----
    if (out.election && RZ.crisis) out.purge = RZ.crisis.congressPurge(S);

    // ---- new turn ----
    var base = Math.max(2, (rung.ap || 3) - (P.health < 40 ? 1 : 0));
    // A week is not a month. Two things a week is more agency than three a
    // month, which is the point of the sprint — but it is paid for in money
    // and health rather than granted free.
    S.actionsPerTurn = S.tempo === 'week' ? Math.max(1, base - 1) : base;
    S.actionsLeft = S.actionsPerTurn;
    if (S.skipTurns > 0) { S.skipTurns--; S.actionsLeft = 0; }
    S.actionsThisMonth = 0;

    save(S);
    return out;
  }

  function advanceMonth(S) {
    var P = S.player;
    S.date.month++;
    if (S.date.month > 12) {
      S.date.month = 1; S.date.year++; P.age++; P.yearsInOffice++;
      if (S.parties[P.partyId] && S.parties[P.partyId].gov) S.nation.yearsInPower++;
    }
  }

  // `span` is the fraction of a month elapsed: the mean-reversion weights and
  // the drifts are both scaled by it, so four weekly ticks land in the same
  // place a single monthly tick would.
  function tickEconomy(S, span) {
    var c = RZ.COUNTRIES[S.countryId];
    var e = S.nation.economy, s = S.nation.society;
    span = span === undefined ? 1 : span;
    var pull = function (w) { return w * span; };

    e.staplePrice = clamp(e.staplePrice + RZ.noise(4) * span, 40, 190);
    var shock = (e.staplePrice - 100) / 100;
    e.growth = clamp(e.growth + (((c.econ.growth + shock * 3.2) - e.growth) * pull(0.10)) + RZ.noise(0.25) * span, -8, 12);
    e.inflation = Math.max(0.5, e.inflation + ((c.econ.inflation - e.inflation) * pull(0.08)) - shock * 0.8 * span + RZ.noise(0.7) * span);
    e.unemployment = clamp(e.unemployment - (e.growth - 2.5) * 0.06 * span + RZ.noise(0.15) * span, 3, 60);
    e.debt = clamp(e.debt + ((S.nation.budget.debtsvc < 10 ? 0.25 : -0.05) - e.growth * 0.05) * span + RZ.noise(0.15) * span, 5, 220);
    e.reserves = clamp(e.reserves + (shock * 0.06 - (e.inflation > 20 ? 0.05 : 0)) * span + RZ.noise(0.05) * span, 0.1, 20);

    s.unrest = C100(s.unrest + ((e.inflation > 15 ? 0.7 : -0.35) + (e.unemployment > 30 ? 0.4 : -0.2) +
                    (S.nation.govApproval < 35 ? 0.5 : -0.3)) * span + RZ.noise(0.5) * span);
    s.corruption = C100(s.corruption + RZ.noise(0.3) * span - (s.judiciary > 65 ? 0.12 : -0.06) * span);
    s.coup = C100(s.coup + ((s.unrest > 60 ? 0.4 : -0.25) + (c.inst.security > 60 ? 0.12 : -0.1)) * span + RZ.noise(0.2) * span);

    var target = C100(52 + (e.growth - 2.5) * 3 - Math.max(0, e.inflation - 6) * 0.7 -
                      Math.max(0, e.unemployment - 20) * 0.35 - s.unrest * 0.15 - s.corruption * 0.12 +
                      (s.health + s.education + s.infra - 135) * 0.06);
    S.nation.govApproval = clamp(S.nation.govApproval + (target - S.nation.govApproval) * pull(0.10), 3, 95);
  }

  function isCampaignSeason(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var em = ELECTION_MONTH[c.id];
    var months = (S.nextElection - S.date.year) * 12 + (em - S.date.month);
    return months >= 0 && months <= 6;
  }

  /* =======================================================================
     EVENTS
     ======================================================================= */
  function rollEvent(S) {
    var api = mkApi(S);
    var c = RZ.COUNTRIES[S.countryId];
    var pool = RZ.EVENTS.filter(function (e) {
      if (e.only && e.only.indexOf(c.id) < 0) return false;
      if (e.once && S.seenEvents[e.id]) return false;
      if (S.seenEvents[e.id] && S.seenEvents[e.id] > S.turn - 24) return false;
      if (e.when && !e.when(api)) return false;
      return true;
    });
    if (!pool.length) return null;
    var ev = RZ.weighted(pool, function (e) { return e.w || 5; });
    S.seenEvents[ev.id] = S.turn;
    if (ev.prep) ev.prep(api);
    return {
      id: ev.id, kicker: ev.kicker,
      title: typeof ev.title === 'function' ? ev.title(api) : ev.title,
      body: typeof ev.body === 'function' ? ev.body(api) : ev.body,
      choices: ev.choices.map(function (ch, i) {
        return { i: i, t: ch.t, d: ch.d, tag: ch.tag, ok: !ch.when || ch.when(api) };
      })
    };
  }

  function resolveEvent(S, choiceIndex) {
    var ev = S.pendingEvent;
    if (!ev) return null;

    // The electoral commission, months after the ballot.
    if (ev.audit) {
      var audRes = RZ.sprint.resolveAudit(S, ev, choiceIndex);
      S.pendingEvent = null;
      var audEntry = {
        kind: audRes.tone === 'bad' ? 'bad' : 'flat', src: 'The commission',
        title: audRes.title, body: audRes.body,
        deltas: audRes.deltas || [], tone: audRes.tone
      };
      pushFeed(S, audEntry);
      save(S);
      return { res: audRes, entry: audEntry };
    }

    // The disciplinary hearing after a failed revolt.
    if (ev.ultimatum) {
      var ultRes = RZ.revolt.resolveUltimatum(S, ev, choiceIndex);
      S.pendingEvent = null;
      var ultEntry = {
        kind: 'big', alert: ultRes.tone === 'bad', src: 'The regional office',
        title: ultRes.title, body: ultRes.body,
        deltas: ultRes.deltas || [], tone: ultRes.tone
      };
      pushFeed(S, ultEntry);
      save(S);
      return { res: ultRes, entry: ultEntry };
    }

    // Campaign-week events live in sprint.js, built when the week turns.
    if (ev.weekly) {
      var wkRes = RZ.sprint.resolveWeekly(S, ev, choiceIndex);
      S.pendingEvent = null;
      var wkEntry = {
        kind: wkRes.tone === 'good' ? 'good' : (wkRes.tone === 'bad' ? 'bad' : 'flat'),
        src: 'Week ' + (S.sprint ? S.sprint.week : '') + ' of the campaign',
        title: wkRes.title, body: wkRes.body,
        deltas: wkRes.deltas || [], tone: wkRes.tone
      };
      pushFeed(S, wkEntry);
      save(S);
      return { res: wkRes, entry: wkEntry };
    }

    // A patron's demand is built at the moment it is asked rather than defined
    // in the events table, so it resolves through crisis.js instead.
    if (ev.patron) {
      var capRes = RZ.crisis.resolveDemand(S, ev, choiceIndex);
      S.pendingEvent = null;
      var capEntry = {
        kind: capRes.tone === 'bad' ? 'bad' : 'flat', src: ev.patron,
        title: capRes.title, body: capRes.body,
        deltas: capRes.deltas || [], tone: capRes.tone
      };
      pushFeed(S, capEntry);
      save(S);
      return { res: capRes, entry: capEntry };
    }

    var def = RZ.EVENTS.filter(function (e) { return e.id === ev.id; })[0];
    var api = mkApi(S);
    var res = def.choices[choiceIndex].run(api);
    S.pendingEvent = null;
    var entry = {
      kind: res.tone === 'good' ? 'good' : (res.tone === 'bad' ? 'bad' : 'flat'),
      src: ev.kicker, title: res.title, body: res.body, deltas: api.deltas.slice(), tone: res.tone
    };
    pushFeed(S, entry);
    save(S);
    return entry;
  }

  /* =======================================================================
     PROMOTION
     ======================================================================= */
  function nextRung(S) {
    var lad = RZ.ladderFor(S.countryId);
    return lad[S.player.rungIdx + 1] || null;
  }

  function meetsRequirements(S, rung) {
    if (!rung || !rung.req) return { ok: true, missing: [] };
    var P = S.player, missing = [];
    Object.keys(rung.req).forEach(function (k) {
      var need = rung.req[k];
      var have = (P.standing[k] !== undefined) ? P.standing[k] : (k === 'fame' ? P.fame : (P.stats[k] || 0));
      if (have < need) missing.push({ k: k, need: need, have: Math.round(have) });
    });
    return { ok: missing.length === 0, missing: missing };
  }

  // Above a certain height there is one of each job, and if somebody else is
  // in it your problem is not your standing, it is them.
  function contestedBy(S, rung) {
    if (!RZ.contender || !rung || rung.tier < 10) return null;
    var ct = RZ.contender.get(S);
    if (!ct || ct.ascended) return null;
    var lad = RZ.ladderFor(S.countryId);
    return (lad[ct.rungIdx] && lad[ct.rungIdx].id === rung.id) ? ct : null;
  }

  // Can you contest the next rung right now?
  function contestStatus(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var rung = nextRung(S);
    if (!rung) return { available: false, reason: 'You have reached the top of this system.' };
    var req = meetsRequirements(S, rung);
    var st = { rung: rung, req: req, available: false, reason: '', how: rung.how };

    if (!req.ok) { st.reason = 'You are not yet credible enough to be considered.'; return st; }
    st.against = contestedBy(S, rung);

    if (rung.how === 'internal') {
      if (S.flags['lastInternal'] && S.turn - S.flags['lastInternal'] < 4) { st.reason = 'The structures have only just met. Wait a few months.'; return st; }
      st.available = true; return st;
    }
    if (rung.how === 'conference') {
      var open = S.date.year === S.nextConference && S.date.month >= 6;
      if (!open) {
        st.reason = 'Contested only at the ' + c.terms.conference + ' — next in ' +
          (S.date.year === S.nextConference ? RZ.monthName(6) + ' this year' : S.nextConference) + '.';
        return st;
      }
      st.available = true; return st;
    }
    if (rung.how === 'auto') {
      st.reason = c.system === 'parl'
        ? 'Not contested separately. Lead your party into the general election and win enough seats for the ' +
          c.house.name + ' to elect you.'
        : 'Not contested separately. Stand as your party’s candidate at the general election and win it outright.';
      return st;
    }
    if (rung.how === 'appoint') {
      st.reason = rung.id === 'hos'
        ? 'The King appoints, from among the elected members, when the post falls vacant. All you can do is be the obvious choice.'
        : 'Not in your gift. Build standing with the leadership and wait for a reshuffle.';
      return st;
    }
    if (rung.how === 'public') {
      if (!S.campaign.season) { st.reason = 'Decided at the general election — ' + S.nextElection + '.'; return st; }
      st.available = true; st.reason = 'You can put your name forward for the ' + c.terms.primary + '.'; return st;
    }
    return st;
  }

  function contest(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var st = contestStatus(S);
    if (!st.available) return null;
    var rung = st.rung;
    var api = mkApi(S);

    if (rung.how === 'internal') {
      S.flags.lastInternal = S.turn;
      var diff = 30 + rung.tier * 9 + (S.parties[S.player.partyId].machine - 50) * 0.45 +
                 c.inst.incumbency * 0.12;
      var r = RZ.elections.primaryContest(S, diff);
      if (r.won) {
        promote(S, 'The ' + c.terms.branch + 'es voted for you.');
        if (RZ.revolt) RZ.revolt.grantMandate(S, RZ.ladderFor(c.id)[S.player.rungIdx]);
      }
      else { api.add('party', -RZ.range(1, 4)); api.add('grassroots', -RZ.range(0, 2)); }
      return { kind: 'internal', won: r.won, rung: rung, detail: r };
    }

    if (rung.how === 'conference') {
      // the higher the rung and the harder the machine, the more delegates you must already own
      var pst = S.parties[S.player.partyId];
      var diff2 = 45 + rung.tier * 4.2 + (pst.machine - 50) * 0.6 +
                  c.inst.incumbency * 0.25 + c.inst.patronage * 0.18;
      if (rung.id === 'leader' || rung.id === 'deputyleader') {
        // you do not beat a strong incumbent. You wait until they are wounded.
        diff2 += (pst.leaderQuality - 50) * 0.85;
        diff2 += pst.gov ? 15 : -8;
        if (pst.gov && S.nation.govApproval < 38) diff2 -= 24;
        if (!pst.gov && S.player.electionsLost > 0) diff2 -= 8;
        if (S.flags.leaderWounded) diff2 -= 18;
      }
      // If the other one already holds it, you are not contesting a vacancy.
      // You are asking a hall to remove somebody who is standing in front of it.
      var held = contestedBy(S, rung);
      if (held) diff2 += 10 + held.power * 0.22;
      var cv = RZ.elections.conferenceVote(S, diff2);
      if (cv.won) {
        promote(S, 'The ' + c.terms.conference + ' elected you' + (held ? ', over ' + held.name + '.' : '.'));
        if (rung.id === 'leader') { S.player.isLeader = true; S.parties[S.player.partyId].leaderName = S.player.name; }
        // There is one of these. Taking it takes it off somebody.
        if (held) {
          held.rungIdx = Math.max(0, held.rungIdx - 1);
          held.progress = 0;
          held.relation = 'hostile';
          held.power = Math.max(8, held.power - RZ.range(8, 20));
          S.player.contenderBeaten = (S.player.contenderBeaten || 0) + 1;
          pushFeed(S, { kind: 'good', src: c.terms.conference,
            title: 'You took it off ' + held.name,
            body: 'They congratulated you at the podium with both hands and one of the photographs of it ' +
                  'will be used against one of you for the rest of your lives.', tone: 'good' });
        }
      } else {
        api.add('party', -RZ.range(3, 8)); api.add('leader', -RZ.range(2, 6));
        S.player.electionsLost++;
      }
      S.campaign.delegateSpend = 0;
      return { kind: 'conference', won: cv.won, rung: rung, detail: cv };
    }

    if (rung.how === 'public') {
      // primary first (where parties exist), then the ballot
      var pdiff = (c.house.method !== 'nonparty' ? 26 : 30) + rung.tier * 7 +
                  (S.parties[S.player.partyId].machine - 50) * 0.3 + c.inst.patronage * 0.1;
      var pr = RZ.elections.primaryContest(S, pdiff);
      if (!pr.won) {
        api.add('party', -RZ.range(2, 6));
        return { kind: 'primary', won: false, rung: rung, detail: pr };
      }
      S.flags.nominatedFor = rung.id;
      return { kind: 'primary', won: true, rung: rung, detail: pr,
               note: 'You are the candidate. The ballot is in ' + RZ.monthName(ELECTION_MONTH[c.id]) + '.' };
    }
    return null;
  }

  function promote(S, why) {
    var c = RZ.COUNTRIES[S.countryId];
    var lad = RZ.ladderFor(c.id);
    S.player.rungIdx = Math.min(lad.length - 1, S.player.rungIdx + 1);
    var r = lad[S.player.rungIdx];
    S.player.officeSince = { year: S.date.year, month: S.date.month };
    // Reaching the rung is not the same as holding the office. Election night
    // used to be the only path that set these, so any other route — a revolt, a
    // traded file, an appointment — left a president who was not president, with
    // every president-gated mechanic still dark.
    if (r.id === 'hos') {
      if (!S.flags.becameHosYear) S.flags.becameHosYear = S.date.year;
      S.player.isPresident = true;
      S.player.isLeader = true;
      S.nation.termNumber = S.nation.termNumber || 1;
      S.nation.presidentName = S.player.name;
      S.nation.presidentParty = S.player.partyId;
      if (S.nation.govParties.indexOf(S.player.partyId) < 0) S.nation.govParties.push(S.player.partyId);
    }
    if (r.id === 'leader') S.player.isLeader = true;
    S.player.titles.push(r.title);
    S.player.record.push({ year: S.date.year, text: 'Became ' + r.title + '.' });
    S.player.fame = C100(S.player.fame + 4 + r.tier * 1.6);
    S.player.capital += 4;
    if (r.id === 'minister' || r.id === 'senmin' || r.id === 'depmin') {
      S.player.ministry = RZ.pick(c.ministries.filter(function (m) { return r.id === 'senmin' ? m.w >= 8 : true; })).name;
    }
    pushFeed(S, { kind: 'big', src: 'Appointment', title: 'You are now ' + r.title,
      body: why + ' ' + r.desc, tone: 'good' });
    S.actionsPerTurn = r.ap || 3;
  }

  function considerAppointment(S) {
    var rung = nextRung(S);
    if (!rung || rung.how !== 'appoint') return null;
    var req = meetsRequirements(S, rung);
    if (!req.ok) return null;
    if (!S.parties[S.player.partyId].gov && rung.tier >= 5) return null; // must be in government
    if (rung.id === 'hos' && !S.flags.postVacant) return null;            // the office must be open
    // Somebody else is already in the chair, and nobody is appointed to a
    // chair that is not empty.
    var occupied = contestedBy(S, rung);
    if (occupied) {
      if (!S.flags.toldBlockedBy || S.turn - S.flags.toldBlockedBy > 24) {
        S.flags.toldBlockedBy = S.turn;
        pushFeed(S, { kind: 'bad', src: 'The appointments list',
          title: 'You were considered for ' + rung.title,
          body: 'Your name went up and came back down again, because ' + occupied.name + ' is already ' +
                'sitting in it and nobody is going to be asked to move. The job comes free when they ' +
                'leave it, and they are not leaving it.', tone: 'bad' });
      }
      return null;
    }
    var P = S.player;
    var scandal = Math.min(34, RZ.sum(P.dirt.filter(function (d) { return d.exposed; }), function (d) { return d.severity * 3.5; }));
    var score = P.standing.leader * 0.5 + P.standing.party * 0.28 + P.fame * 0.22 -
                scandal + RZ.range(-16, 16);
    var need = 46 + rung.tier * 2.6 + (rung.id === 'hos' ? 26 : 0);
    if (score < need) return null;
    if (rung.id === 'hos') S.flags.postVacant = false;
    promote(S, 'The ' + (RZ.COUNTRIES[S.countryId].system === 'monarchy' ? 'King' : 'principal') + ' called you in on a Sunday evening.');
    return { promoted: true, rung: rung };
  }

  /* =======================================================================
     DANGER
     ======================================================================= */
  function checkDangers(S, out) {
    var c = RZ.COUNTRIES[S.countryId];
    var P = S.player;

    if (P.health <= 4) { endGame(S, 'health'); return; }
    if (P.age >= 78 && RZ.chance(0.08)) { endGame(S, 'age'); return; }

    // Pressure decays when nobody is digging. The nemesis puts it back up.
    S.scandalRisk = Math.max(0, (S.scandalRisk || 0) - 0.06);

    // scandal breaking on its own
    var un = P.dirt.filter(function (d) { return !d.exposed; });
    if (un.length) {
      var traitRisk = ((RZ.TRAITS && RZ.TRAITS[P.trait]) || {}).scandalRisk || 1;
      var risk = 0.012 * un.length * (1 + c.inst.media / 90) * (1 + P.fame / 130) *
                 (1 + (S.scandalRisk || 0)) * traitRisk;
      if (RZ.chance(risk)) {
        var api = mkApi(S);
        var d = un.sort(function (a, b) { return b.severity - a.severity; })[0];
        api.exposeDirt(d.id);
        pushFeed(S, { kind: 'bad', src: RZ.pick(c.media), title: 'It has come out',
          body: 'A story you had hoped was dead: ' + RZ.esc(d.label.toLowerCase()) + '. It is on every front page and your phone will not stop.',
          deltas: api.deltas.slice(), tone: 'bad' });
      }
    }

    // coup / palace risk
    if (S.nation.society.coup > 74 && P.isPresident && RZ.chance(0.05)) { endGame(S, 'coup'); return; }

    // the King appoints, and the King dismisses
    if (P.isPresident && c.system === 'monarchy') {
      var risk = 0.016 - P.standing.leader * 0.00009 - P.standing.security * 0.00004;
      if (RZ.chance(Math.max(0.005, risk))) {
        S.flags.wasPresident = true;
        P.record.push({ year: S.date.year, text: 'Dismissed from office by the King.' });
        pushFeed(S, { kind: 'bad', src: 'Lozitha Palace', title: 'You have been relieved of your duties',
          body: 'No reason was given, because none is required. A caretaker was named in the same sentence that removed you.', tone: 'bad' });
        endGame(S, 'dismissed');
        return;
      }
    }

    // no confidence: coalition governments fall between elections
    if (P.isPresident && c.system === 'parl' && S.nation.govParties.length > 1) {
      var fragility = (100 - S.nation.society.stability) * 0.0012 +
                      (S.nation.govApproval < 35 ? 0.010 : 0) +
                      (S.nation.govParties.length - 1) * 0.004;
      if (RZ.chance(fragility)) {
        S.flags.wasPresident = true;
        P.record.push({ year: S.date.year, text: 'Removed by a motion of no confidence.' });
        pushFeed(S, { kind: 'bad', src: 'The ' + c.terms.assembly, title: 'The motion carried',
          body: 'A partner walked, eleven of your own crossed the floor with them, and the Speaker read the result at ten past four. ' +
                'You are no longer ' + c.terms.hos + '.', tone: 'bad' });
        endGame(S, 'noconfidence');
        return;
      }
      S.nation.society.stability = C100(S.nation.society.stability - RZ.range(-0.4, 0.7));
    }

    // debt: the money you owe is the leverage somebody else holds
    if (P.money < -WAGE_BASE[c.id] * 8) {
      if (RZ.chance(0.11)) {
        var api2 = mkApi(S);
        if (RZ.chance(0.5)) {
          api2.add('money', Math.round(-P.money * RZ.range(0.7, 1.0)));
          api2.add('stats.integrity', -RZ.range(2, 5));
          api2.dirt('debt', 'Campaign debts settled by a businessman who has not been repaid', 3);
          pushFeed(S, { kind: 'bad', src: 'Money', title: 'Somebody settled it for you',
            body: 'The bank stopped calling because a man you barely know paid them. He has not asked for anything yet.',
            deltas: api2.deltas.slice(), tone: 'bad' });
        } else {
          api2.add('money', Math.round(-P.money * RZ.range(0.5, 0.9)));
          api2.add('grassroots', -RZ.range(2, 6));
          api2.add('media', -RZ.range(1, 5));
          pushFeed(S, { kind: 'bad', src: 'Money', title: 'The plot in the village was sold',
            body: 'Politics is not paid for by salaries. You sold what your father left you and told nobody, and by Sunday everybody knew.',
            deltas: api2.deltas.slice(), tone: 'bad' });
        }
      }
    }

    // recall / dismissal when you have collapsed inside the party
    if (P.rungIdx >= 4 && P.standing.party < 12 && RZ.chance(0.10)) {
      mkApi(S).demote();
    }
  }

  function endGame(S, reason) {
    S.over = true;
    S.ending = reason;
  }

  /* =======================================================================
     FEED / SAVE
     ======================================================================= */
  // Writes up a finished conversation the same way an action is written up, so
  // it lands in the feed with everything the answers cost or bought.
  function finishDialogue(S, convo) {
    var tone = convo.mood >= 2 ? 'good' : (convo.mood <= -2 ? 'bad' : 'flat');
    // How the room went is what that person now thinks of you, and they keep it.
    if (RZ.cast) RZ.cast.afterMeeting(S, convo);
    var entry = {
      kind: tone === 'good' ? 'good' : (tone === 'bad' ? 'bad' : 'flat'),
      src: convo.speaker.name + ', ' + convo.speaker.role,
      title: convo.scene.headline
        ? convo.scene.headline(convo.api, convo.temp, convo)
        : HEADLINE[convo.temp],
      body: convo.transcript[convo.transcript.length - 1].text,
      deltas: convo.api.deltas.slice(), tone: tone
    };
    pushFeed(S, entry);
    return entry;
  }
  var HEADLINE = {
    warm: 'The room was with you',
    fair: 'A civil hearing',
    cool: 'You were heard out, no more',
    hostile: 'It went badly'
  };

  function pushFeed(S, e) {
    e.turn = S.turn;
    e.date = { year: S.date.year, month: S.date.month };
    S.feed.unshift(e);
    if (S.feed.length > 120) S.feed.length = 120;
  }

  function save(S) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* private mode */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var S = JSON.parse(raw);
      if (!S || S.v !== 1) return null;
      RZ.seed(S.seed + S.turn * 7919);
      return S;
    } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
  function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }

  RZ.engine = {
    newGame: newGame, mkApi: mkApi, availableActions: availableActions, doAction: doAction,
    endTurn: endTurn, rollEvent: rollEvent, resolveEvent: resolveEvent,
    contestStatus: contestStatus, contest: contest, promote: promote, nextRung: nextRung,
    meetsRequirements: meetsRequirements, considerAppointment: considerAppointment,
    contestedBy: contestedBy, pushFeed: pushFeed, endGame: endGame,
    finishDialogue: finishDialogue,
    save: save, load: load, clearSave: clearSave, hasSave: hasSave,
    WAGE_BASE: WAGE_BASE, ELECTION_MONTH: ELECTION_MONTH, isCampaignSeason: isCampaignSeason
  };
})();
