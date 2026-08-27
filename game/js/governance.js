/* governance.js — the presidency: budgets, national decisions, election night, and legacy. */
(function () {
  'use strict';
  var C100 = RZ.c100, clamp = RZ.clamp, P = RZ.pick;

  /* ================= presidential action deck ================= */
  var PRES = [
    { id: 'address', ico: '📺', ap: 1, name: 'Address the nation',
      desc: 'Prime time, all channels, one message.',
      run: function (a) {
        var ok = a.roll('oratory', 50);
        a.add('fame', a.rng(1, 3));
        if (ok) { a.nation('unrest', -a.rng(3, 7)); a.S.nation.govApproval = clamp(a.S.nation.govApproval + a.rng(2, 6), 3, 95); a.add('media', a.rng(2, 5));
          return { title: 'The country listened', body: 'You named the problem, gave a date, and did not blame anyone. Approval moved for the first time in a year.', tone: 'good' }; }
        a.S.nation.govApproval = clamp(a.S.nation.govApproval - a.rng(1, 4), 3, 95); a.add('media', -a.rng(1, 4));
        return { title: 'Forty minutes of nothing', body: 'You announced a task team and a summit. The country has seen eleven task teams and is counting.', tone: 'bad' };
      } },

    { id: 'reshuffle', ico: '🔀', ap: 1, name: 'Reshuffle the cabinet',
      desc: 'Remove the dead weight and the disloyal, in that order.',
      run: function (a) {
        var ok = a.roll('cunning', 48);
        a.add('capital', -6);
        if (ok) { a.add('leader', a.rng(2, 6)); a.add('party', a.rng(1, 4)); a.nation('corruption', -a.rng(.5, 2)); a.S.nation.govApproval = clamp(a.S.nation.govApproval + a.rng(1, 4), 3, 95);
          return { title: 'Announced at 10pm, sworn in at 8am', body: 'Six changes, no vacuum, and the two who were briefing against you are now backbenchers with nothing to brief with.', tone: 'good' }; }
        a.add('party', -a.rng(3, 8)); a.makeRival();
        return { title: 'The province is in revolt', body: 'You removed a minister with a regional base and forgot that the base was the point. Their provincial executive has issued a statement.', tone: 'bad' };
      } },

    { id: 'anticorr', ico: '🧾', ap: 1, name: 'Launch an anti-corruption drive',
      desc: 'Real arrests, including on your own side. Or not.',
      run: function (a) {
        var real = a.P.stats.integrity > 50;
        if (real) {
          a.nation('corruption', -a.rng(3, 8)); a.add('media', a.rng(4, 9)); a.add('intl', a.rng(4, 9));
          a.add('party', -a.rng(4, 10)); a.makeRival(); a.legacyMark('foughtCorruption');
          return { title: 'Two of your own were arrested', body: 'The unit was given real independence and used it immediately, on your side. The country is astonished. Your party is not amused.', tone: 'good' };
        }
        a.nation('corruption', -a.rng(0, 2)); a.add('media', -a.rng(1, 4)); a.add('party', a.rng(1, 4));
        return { title: 'The usual suspects', body: 'Four arrests, all of them from the faction that opposed you. Nobody was fooled, and the exercise is now itself a scandal.', tone: 'flat' };
      } },

    { id: 'summit', ico: '🌍', ap: 1, name: 'Attend the regional summit',
      desc: 'SADC, the AU, and a corridor conversation that matters more than the communiqué.',
      run: function (a) {
        a.add('intl', a.rng(3, 8)); a.add('fame', a.rng(1, 3)); a.add('grassroots', -a.rng(0, 2));
        if (a.S.nation.intl.sanctions > 20 && a.roll('charisma', 50)) { a.S.nation.intl.sanctions = Math.max(0, a.S.nation.intl.sanctions - a.rng(4, 12));
          return { title: 'Movement on the listings', body: 'A quiet conversation on a balcony did more than three years of communiqués. Two names came off the list.', tone: 'good' }; }
        return { title: 'A communiqué was issued', body: 'Solidarity was expressed, concern was noted, and nothing binding was signed. Regional diplomacy in one sentence.', tone: 'flat' };
      } },

    { id: 'resourcedeal', ico: '⛏️', ap: 1, name: 'Sign a resource deal',
      desc: 'Lithium, gas, uranium, copper — whoever is offering.',
      risky: true,
      run: function (a) {
        var clean = a.roll('intellect', 52);
        a.nation('growth', a.rng(.3, 1.1)); a.nation('reserves', a.rng(.2, .8));
        if (clean) { a.add('intl', a.rng(2, 6)); a.add('business', a.rng(3, 7)); a.legacyMark('goodDeal');
          return { title: 'Terms that survive publication', body: 'Local beneficiation, a published royalty schedule, and a sovereign fund clause. It took nine months and it will outlive you.', tone: 'good' }; }
        a.add('money', a.wage(20)); a.add('business', a.rng(4, 9)); a.add('stats.integrity', -a.rng(3, 7));
        a.dirt('resource', 'A resource concession signed on terms that were never published', 4);
        return { title: 'Signed, and sealed', body: 'The agreement is confidential on the grounds of commercial sensitivity. So is the clause about the intermediary company.', tone: 'flat' };
      } },

    { id: 'judges', ico: '⚖️', ap: 1, name: 'Appoint to the bench',
      desc: 'Vacancies on the highest court. This is the longest lever you will ever pull.',
      run: function (a) {
        var indep = a.P.stats.integrity > 48;
        if (indep) { a.nation('judiciary', a.rng(3, 8)); a.add('intl', a.rng(3, 7)); a.add('media', a.rng(2, 6)); a.add('capital', -4); a.legacyMark('independentCourts');
          return { title: 'You appointed people who will rule against you', body: 'Two of the three were on record criticising your government. It is the single most durable thing you have done.', tone: 'good' }; }
        a.nation('judiciary', -a.rng(3, 8)); a.add('capital', a.rng(3, 7)); a.add('intl', -a.rng(2, 6));
        return { title: 'Safe hands', body: 'Three appointments, all reliable. Your successor will inherit a court that owes you nothing and them everything.', tone: 'flat' };
      } },

    { id: 'security', ico: '🚨', ap: 1, name: 'Deploy the security services',
      desc: 'Curfews, roadblocks, and a great deal of quiet.',
      risky: true,
      run: function (a) {
        a.nation('unrest', -a.rng(6, 14)); a.add('security', a.rng(3, 8));
        a.add('media', -a.rng(3, 8)); a.add('intl', -a.rng(3, 9)); a.add('stats.integrity', -a.rng(2, 6));
        a.nation('deaths', a.irange(0, 9));
        return { title: 'The streets are clear', body: 'Order arrived quickly and left a residue. Somebody is counting, and eventually somebody will publish the count.', tone: 'flat' };
      } },

    { id: 'earlyelection', ico: '🗳️', ap: 1, name: 'Call an early election',
      desc: 'Go now, while your numbers are up.', risky: true,
      when: function (a) { return a.S.nextElection - a.S.date.year > 1; },
      run: function (a) {
        var em = RZ.engine.ELECTION_MONTH[a.C.id];
        a.S.nextElection = a.S.date.month < em - 1 ? a.S.date.year : a.S.date.year + 1;
        a.S.lastElectionYear = a.S.nextElection - 1;
        a.S.campaign.season = true;
        return { title: 'Parliament dissolved', body: 'The proclamation was signed this morning. Everybody in the country now has one job and about five months to do it.', tone: 'flat' };
      } },

    { id: 'budget', ico: '💰', ap: 1, name: 'Table the national budget', special: 'budget',
      desc: 'Divide a fixed amount between things that all matter.',
      run: function (a) { return { title: '', body: '', special: 'budget' }; } }
  ];

  function presidentialActions(S) { 
    var api = RZ.engine.mkApi(S);
    return PRES.filter(function (x) { return !x.when || x.when(api); });
  }
  function actionById(id) { return PRES.filter(function (x) { return x.id === id; })[0]; }

  /* ================= budget ================= */
  var BUDGET_LINES = [
    { k: 'health', name: 'Health', note: 'clinics, drugs, nurses' },
    { k: 'education', name: 'Education', note: 'schools, teachers, fees' },
    { k: 'infra', name: 'Infrastructure', note: 'roads, power, water' },
    { k: 'security', name: 'Security', note: 'army, police, intelligence' },
    { k: 'social', name: 'Social grants', note: 'pensions, food relief' },
    { k: 'debtsvc', name: 'Debt service', note: 'interest, arrears, the Fund' },
    { k: 'admin', name: 'Administration', note: 'the wage bill and the state itself' }
  ];

  function applyBudget(S, b) {
    var n = S.nation;
    n.budget = b;
    var s = n.society, e = n.economy;
    s.health = C100(s.health + (b.health - 12) * 0.9);
    s.education = C100(s.education + (b.education - 17) * 0.8);
    s.infra = C100(s.infra + (b.infra - 14) * 0.9);
    s.unrest = C100(s.unrest - (b.social - 12) * 1.1 + (b.security - 13) * 0.25);
    s.coup = C100(s.coup - (b.security - 13) * 1.3);
    e.debt = Math.max(4, e.debt - (b.debtsvc - 14) * 0.7);
    e.growth = clamp(e.growth + (b.infra - 14) * 0.05 - (b.admin - 18) * 0.04, -8, 12);
    e.inflation = Math.max(0.5, e.inflation + (b.social + b.admin - 30) * 0.05);
    S.player.standing.intl = C100(S.player.standing.intl + (b.debtsvc - 14) * 0.4);
    S.player.standing.security = C100(S.player.standing.security + (b.security - 13) * 0.7);
    S.player.standing.grassroots = C100(S.player.standing.grassroots + (b.social - 12) * 0.5 + (b.health - 12) * 0.3);
  }

  /* ================= third term ================= */
  function attemptThirdTerm(a) {
    var S = a.S, c = a.C;
    var support = a.P.standing.party * 0.4 + a.P.standing.security * 0.3 +
                  (100 - c.inst.judiciary) * 0.2 + (100 - c.inst.media) * 0.1 + RZ.range(-15, 15);
    S.flags.triedThirdTerm = true;
    if (support > 52) {
      S.flags.termLimitRemoved = true;
      a.add('intl', -RZ.range(10, 22)); a.add('media', -RZ.range(8, 18));
      a.nation('unrest', RZ.range(8, 18)); a.nation('judiciary', -RZ.range(4, 12));
      a.add('stats.integrity', -RZ.range(6, 12));
      a.legacyMark('removedTermLimit');
      return { title: 'The amendment passed', body: 'Two-thirds of the House, a constitutional court that found no difficulty, and a country that watched it happen on television. You may stand again. Something has been spent that cannot be earned back.', tone: 'flat' };
    }
    a.add('party', -RZ.range(8, 18)); a.add('leader', -RZ.range(5, 12));
    a.nation('unrest', RZ.range(4, 12)); a.add('media', -RZ.range(4, 10));
    a.makeRival();
    return { title: 'It failed on the floor', body: 'Eleven of your own MPs abstained and the amendment died. You are now a lame duck who tried, which is the weakest thing a president can be.', tone: 'bad' };
  }

  /* ================= election night ================= */
  function canRig(S) {
    var c = RZ.COUNTRIES[S.countryId];
    if (c.inst.electoral > 72) return false;
    return S.player.isPresident || S.player.isLeader ||
           (S.parties[S.player.partyId].gov && S.player.standing.party > 55);
  }

  function runElection(S, opts) {
    opts = opts || {};
    var c = RZ.COUNTRIES[S.countryId];
    var api = RZ.engine.mkApi(S);
    var out = { country: c, year: S.date.year, rigged: null, personal: null, presidency: null };

    var vote = RZ.elections.projectVote(S);
    if (opts.rig) {
      out.rigged = RZ.elections.rigElection(S, vote, opts.rig);
      if (out.rigged.caught) {
        api.add('media', -RZ.range(6, 14)); api.add('intl', -RZ.range(8, 18));
        api.nation('unrest', RZ.range(8, 20)); api.nation('electoral', -RZ.range(3, 9));
        api.dirt('rigging', 'Ballot-stuffing traced to structures under your control', 4);
      } else {
        api.nation('electoral', -RZ.range(1, 4));
      }
    }

    var alloc = RZ.elections.allocateSeats(S, vote);
    var gov = RZ.elections.formGovernment(S, alloc.seats);

    out.vote = vote; out.seats = alloc.seats; out.regionSeats = alloc.regionSeats; out.gov = gov;

    c.parties.forEach(function (p) {
      S.parties[p.id].vote = vote.byParty[p.id];
      S.parties[p.id].seats = alloc.seats[p.id] || 0;
      S.parties[p.id].gov = gov.parties.indexOf(p.id) >= 0;
    });
    S.nation.govParties = gov.parties.slice();

    // ---- head of state ----
    if (c.system === 'pres') {
      out.presidency = RZ.elections.presidentialRace(S, vote);
      var w = out.presidency.winner;
      S.nation.presidentParty = w.partyId;
      S.nation.presidentName = w.name;
    } else if (c.system === 'monarchy') {
      out.presidency = { appointed: true };
    } else {
      var leadP = gov.lead;
      S.nation.presidentParty = leadP;
      S.nation.presidentName = (leadP === S.player.partyId && S.player.isLeader) ? S.player.name : S.parties[leadP].leaderName;
      out.presidency = { indirect: true, winnerParty: leadP, name: S.nation.presidentName };
    }

    // ---- the player ----
    out.personal = resolvePlayerElection(S, out, api);

    // ---- a bad result wounds the incumbent leader, and opens the succession ----
    c.parties.forEach(function (p) {
      var st = S.parties[p.id];
      var delta = st.vote - p.vote;
      st.leaderQuality = RZ.clamp(st.leaderQuality + delta * 1.4, 8, 96);
      if (p.id === S.player.partyId && !S.player.isLeader) {
        S.flags.leaderWounded = delta < -2.5 || (st.gov === false && p.gov === true);
      }
    });

    // ---- consequences ----
    // An election moves offices around. Whatever it did, the party leadership
    // and the head of state must still name real, single people afterwards.
    RZ.field.syncLeadership(S);

    if (S.nation.presidentParty !== S.nation.presidentPartyPrev) S.nation.yearsInPower = 0;
    S.nation.presidentPartyPrev = S.nation.presidentParty;
    S.nextElection = S.date.year + c.houseTerm;
    S.campaign.effort = 0; S.campaign.delegateSpend = 0; S.campaign.season = false;
    S.flags.nominatedFor = null;
    RZ.engine.save(S);
    return out;
  }

  function resolvePlayerElection(S, out, api) {
    var c = RZ.COUNTRIES[S.countryId];
    var pl = S.player;
    var lad = RZ.ladderFor(c.id);
    var rung = lad[pl.rungIdx];
    var res = { messages: [] };

    // 1) Did the player become head of state?
    var becameHos = false;
    if (c.system === 'pres' && out.presidency && out.presidency.winner && out.presidency.winner.isPlayer) becameHos = true;
    if (c.system === 'parl' && pl.isLeader && out.gov.lead === pl.partyId) becameHos = true;
    if (c.system === 'monarchy' && rung.id === 'deputyleader' &&
        pl.standing.leader > 74 && pl.fame > 68 && pl.standing.security > 40 &&
        RZ.chance(0.10)) becameHos = true;

    if (becameHos && rung.id !== 'hos') {
      pl.rungIdx = lad.length - 1;
      pl.isPresident = true; pl.isLeader = true;
      pl.officeSince = { year: S.date.year, month: S.date.month };
      S.nation.termNumber = 1;
      S.nation.presidentName = pl.name;
      S.nation.presidentParty = pl.partyId;
      pl.titles.push(lad[lad.length - 1].title);
      if (!S.flags.becameHosYear) S.flags.becameHosYear = S.date.year;
      pl.record.push({ year: S.date.year, text: 'Elected ' + lad[lad.length - 1].title + '.' });
      pl.electionsWon++;
      res.becamePresident = true;
      res.messages.push('You are ' + lad[lad.length - 1].title + '.');
      return res;
    }

    if (rung.id === 'hos' && pl.isPresident) {
      var held = (c.system === 'pres') ? (out.presidency.winner && out.presidency.winner.isPlayer)
               : (out.gov.lead === pl.partyId);
      if (held) {
        S.nation.termNumber++;
        pl.electionsWon++;
        res.heldPresidency = true;
        res.messages.push('Returned for a ' + RZ.ordinal(S.nation.termNumber) + ' term.');
        if (c.termLimit && S.nation.termNumber > c.termLimit && !S.flags.termLimitRemoved) {
          res.messages.push('This term is your last under the constitution.');
        }
      } else {
        pl.electionsLost++;
        pl.isPresident = false;
        S.flags.wasPresident = true;
        res.lostPresidency = true;
        var lad2 = RZ.ladderFor(c.id);
        var leaderIdx = lad2.map(function (r) { return r.id; }).indexOf('leader');
        var canFightOn = leaderIdx >= 0 && pl.age < 70 && pl.standing.party > 35;
        if (canFightOn) {
          pl.rungIdx = leaderIdx;
          pl.record.push({ year: S.date.year, text: 'Lost the presidency; stayed on as party leader.' });
          res.messages.push('You have lost the presidency. The movement has kept you as leader — for now.');
          api.add('party', -RZ.range(6, 16));
          api.add('leader', -RZ.range(4, 10));
        } else {
          res.messages.push('You have lost the presidency, and the movement has moved on.');
          RZ.engine.endGame(S, 'defeated');
        }
      }
      return res;
    }

    // 2) Ordinary seat contests. The top office is never won this way.
    var nominated = (S.flags.nominatedFor && S.flags.nominatedFor !== 'hos') ? S.flags.nominatedFor : null;
    if (rung.tier >= 4 || nominated) {
      var contestRung = nominated ? lad.filter(function (r) { return r.id === nominated; })[0] : rung;
      var win;
      if (c.house.method === 'pr') {
        // the list decides, not the voters
        var seatsWon = out.seats[pl.partyId] || 0;
        var listRank = Math.max(1, Math.round((100 - pl.standing.party) * (c.house.elected / 130)));
        win = listRank <= seatsWon;
        res.listRank = listRank; res.partySeats = seatsWon;
      } else {
        var sc = RZ.elections.seatContest(S, out.vote);
        win = sc.won; res.seat = sc;
      }
      res.contested = contestRung.title;
      if (win) {
        pl.electionsWon++;
        if (nominated && contestRung.idx > pl.rungIdx) {
          RZ.engine.promote(S, 'You won the ballot.');
          res.promoted = true;
        } else {
          res.messages.push('You held your seat.');
        }
        api.add('fame', RZ.range(1, 4));
      } else {
        pl.electionsLost++;
        res.lost = true;
        if (rung.tier >= 4) {
          api.demote();
          res.messages.push('You lost your seat.');
        } else {
          res.messages.push('You did not win the ballot.');
        }
      }
    }
    return res;
  }

  /* ================= conference (party leadership) ================= */
  function conferenceDue(S) { return S.date.year === S.nextConference; }
  function afterConference(S) {
    var c = RZ.COUNTRIES[S.countryId];
    S.nextConference = S.nextConference + 5;
    // rival leaders may change
    c.parties.forEach(function (p) {
      if (p.id === S.player.partyId && S.player.isLeader) return;
      if (RZ.chance(0.3)) {
        S.parties[p.id].leaderName = RZ.makeName(c);
        S.parties[p.id].leaderQuality = Math.round(RZ.range(35, 80));
      }
    });
  }

  /* ================= legacy ================= */
  function legacy(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var pl = S.player;
    var lad = RZ.ladderFor(c.id);
    var rung = lad[pl.rungIdx];
    var e = S.nation.economy, s = S.nation.society;

    var score = 0;
    score += rung.tier * 22;                                     // how high you climbed
    if (pl.isPresident || S.flags.wasPresident) score += 60;
    score += Math.min(60, (pl.electionsWon || 0) * 8);
    score -= (pl.electionsLost || 0) * 4;

    var wasHead = pl.titles.indexOf(lad[lad.length - 1].title) >= 0 || !!S.flags.wasPresident;
    var yearsHead = wasHead ? Math.max(0, S.date.year - (S.flags.becameHosYear || S.date.year)) : 0;
    if (wasHead) {
      // you are judged on the country only to the extent that you had time to change it
      var own = Math.min(1, (yearsHead + 1) / 7);
      score += Math.min(36, yearsHead * 3);
      score += ((e.growth - c.econ.growth) * 14) * own;
      score -= ((e.inflation - c.econ.inflation) * 1.3) * own;
      score -= ((e.unemployment - c.econ.unemployment) * 2.2) * own;
      score -= ((e.debt - c.econ.debt) * 0.7) * own;
      score += ((s.health - 45) * 0.8 + (s.education - 48) * 0.8 + (s.infra - 45) * 0.8) * own;
      score -= s.corruption * 0.5 * own;
      score -= s.unrest * 0.4 * own;
      score += (s.judiciary - c.inst.judiciary) * 0.9;
      score += (s.electoral - c.inst.electoral) * 0.9;
      score -= s.deaths * 2.0;
    }
    score += (pl.stats.integrity - 50) * 0.8;
    score -= pl.dirt.filter(function (d) { return d.exposed; }).length * 9;
    if (S.legacyMarks.respectedTermLimit) score += 45;
    if (S.legacyMarks.removedTermLimit) score -= 55;
    if (S.legacyMarks.independentCourts) score += 25;
    if (S.legacyMarks.foughtCorruption) score += 25;
    if (S.legacyMarks.goodDeal) score += 18;
    if (S.flags.defected) score -= S.flags.defected * 8;

    score = Math.round(score);

    var head = c.terms.hos;   // "President" or "Prime Minister"
    var rank;
    if (!wasHead && rung.tier < 4) rank = 'A Footnote';
    else if (!wasHead && rung.tier < 6) rank = 'A Constituency Name';
    else if (!wasHead && rung.tier < 9) rank = 'A Serious Figure';
    else if (!wasHead) rank = 'Nearly';
    else if (score > 470) rank = 'Founder of the Second Republic';
    else if (score > 395) rank = 'A Great ' + head;
    else if (score > 325) rank = 'A Good ' + head;
    else if (score > 255) rank = 'A Competent Caretaker';
    else if (score > 175) rank = 'A Disappointment';
    else if (score > 90) rank = 'A Wasted Decade';
    else rank = 'A Warning to Others';

    return { score: score, rank: rank, wasHead: wasHead, rung: rung, yearsHead: yearsHead };
  }

  function obituary(S, lg) {
    var c = RZ.COUNTRIES[S.countryId];
    var pl = S.player, e = S.nation.economy, s = S.nation.society;
    var out = [];
    var end = {
      health: 'Your heart gave out in an office in ' + c.capital + '.',
      age: 'You died at ' + pl.age + ', at home, with the television on.',
      coup: 'Soldiers surrounded the residence at 4am. The broadcast came at six, read by a colonel nobody had heard of.',
      defeated: 'The country voted you out. You conceded, eventually.',
      retire: 'You stood down at the end of the term, having said a year before that you would.',
      stepdown: 'You resigned, and handed over the instruments of state on a Tuesday morning.',
      noconfidence: 'The House removed you on a Thursday afternoon, by six votes.',
      dismissed: 'The King relieved you of your duties. No reason was given, and none was required.',
      termlimit: 'You served your terms, and then you left.'
    }[S.ending] || 'The career ended.';

    out.push('<p class="lede">' + RZ.esc(pl.name) + ' of ' + RZ.esc(c.regionById[pl.regionId].name) +
      ', ' + RZ.esc(lg.rung.title) + (lg.yearsHead ? ' for ' + lg.yearsHead + ' year' + (lg.yearsHead === 1 ? '' : 's') : '') +
      '. ' + end + '</p>');

    if (lg.wasHead) {
      var growthD = e.growth - c.econ.growth, unD = e.unemployment - c.econ.unemployment;
      out.push('<p>You held the office for ' + (lg.yearsHead || 'less than a') + ' year' +
        (lg.yearsHead === 1 ? '' : 's') + '. The country had growth at ' + RZ.round(c.econ.growth, 1) + '% and unemployment at ' +
        Math.round(c.econ.unemployment) + '% when you arrived. You left them at ' + RZ.round(e.growth, 1) + '% and ' +
        Math.round(e.unemployment) + '%. ' +
        (growthD > 0.6 ? 'The economy was better for your having been there.'
          : growthD < -0.6 ? 'It was not.' : 'The difference is within the margin of error, which is its own verdict.') + '</p>');

      out.push('<p>' + (s.corruption < 35 ? 'Procurement was cleaner when you left than when you arrived — a rarer sentence than it should be.'
        : s.corruption > 65 ? 'The looting accelerated on your watch, and some of it was yours.'
        : 'Corruption was neither defeated nor invented by you. It simply continued.') +
        (s.deaths > 0 ? ' ' + s.deaths + ' people died in confrontations with the state during your time in office.' : '') + '</p>');

      if (S.legacyMarks.respectedTermLimit) out.push('<p>You left when the constitution said to. In this region that single fact will outrank everything else in the first paragraph of every obituary written about you.</p>');
      if (S.legacyMarks.removedTermLimit) out.push('<p>You changed the constitution so that you could stay. Whatever else you built, this is the sentence that survives.</p>');
      if (S.legacyMarks.independentCourts) out.push('<p>The judges you appointed ruled against your own government, repeatedly, and you let them. That is a kind of monument.</p>');
    } else {
      out.push('<p>You reached ' + RZ.esc(lg.rung.title.toLowerCase()) + ' and no further. ' +
        (pl.electionsLost > pl.electionsWon ? 'The ballots were rarely kind.'
          : 'The ladder simply ran out of time.') + '</p>');

      // The rung above you was never empty, and somebody is sitting in it now.
      var above = RZ.field.contender(S, Math.min(pl.rungIdx + 1, RZ.ladderFor(c.id).length - 1));
      if (above) {
        out.push('<p>' + RZ.esc(above.fig.name) + ' is ' + RZ.esc(above.fig.role) +
          '. They were ' + (above.fig.since <= (pl.officeSince ? pl.officeSince.year : S.date.year)
            ? 'there before you arrived and they are there still'
            : 'behind you once') + ', and they will be in the room when the next one is decided.</p>');
      }
    }

    if (S.legacyMarks.leftOnOwnTerms) {
      out.push('<p>You chose the day. Almost nobody in this region does, and the ones who do are remembered for it long after the arguments they won have been forgotten.</p>');
    }

    var exposed = pl.dirt.filter(function (d) { return d.exposed; });
    if (exposed.length) {
      out.push('<p>' + exposed.length + ' matter' + (exposed.length > 1 ? 's' : '') + ' became public: ' +
        exposed.map(function (d) { return RZ.esc(d.label.toLowerCase()); }).join('; ') + '.</p>');
    } else if (pl.stats.integrity > 65) {
      out.push('<p>Nothing was ever proved against you, and — unusually — there was nothing to prove.</p>');
    } else {
      out.push('<p>Nothing was ever proved against you. Several people know why.</p>');
    }

    if (pl.record.length) {
      out.push('<p class="dim">' + pl.record.slice(-6).map(function (r) { return r.year + ' — ' + RZ.esc(r.text); }).join('<br>') + '</p>');
    }
    return out.join('');
  }

  RZ.gov = {
    presidentialActions: presidentialActions, actionById: actionById,
    BUDGET_LINES: BUDGET_LINES, applyBudget: applyBudget,
    attemptThirdTerm: attemptThirdTerm, canRig: canRig, runElection: runElection,
    conferenceDue: conferenceDue, afterConference: afterConference,
    legacy: legacy, obituary: obituary
  };
})();
