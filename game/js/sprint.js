/* sprint.js — the last eight weeks.

   A career is lived in months. A campaign is not. Eight weeks out from a
   ballot the game changes gear: turns become weeks, the constituency breaks
   into named wards you have to win one at a time, and the things that go wrong
   go wrong on a timescale where you can still do something about them.

   The tempo machinery is deliberately generic — engine.endTurn only knows
   about S.tempo and a span — so a state-of-emergency or a budget week can be
   hung off the same hooks later without touching the loop again.
*/
(function () {
  'use strict';
  var C100 = RZ.c100, clamp = RZ.clamp, P = RZ.pick;

  var WEEKS = 8;

  /* =======================================================================
     STARTING AND ENDING
     ======================================================================= */
  // Two months out, in the cycle the player is actually contesting.
  function due(S) {
    if (S.sprint || S.tempo === 'week') return false;
    if (!S.campaign.season) return false;
    var em = RZ.engine.ELECTION_MONTH[S.countryId];
    var months = (S.nextElection - S.date.year) * 12 + (em - S.date.month);
    return months >= 0 && months <= 2;
  }

  function begin(S) {
    S.tempo = 'week';
    S.date.week = 1;
    S.sprint = {
      kind: 'election', weeksLeft: WEEKS, week: 1,
      wards: buildWards(S),
      war: { spent: 0, raised: 0 },
      sabotage: 0, rebuttals: 0
    };
    S.sprint.openTally = tally(S).support;
    var c = RZ.COUNTRIES[S.countryId];
    RZ.engine.pushFeed(S, {
      kind: 'big', src: c.terms.assembly || 'The commission',
      title: 'Eight weeks to the ballot',
      body: 'The proclamation is signed and the date is fixed. From here the diary stops being a month at a time — ' +
            'it is a week at a time, and every one of them is spent somewhere specific. ' +
            'Your ' + c.terms.constituency + ' breaks down into ' + S.sprint.wards.length + ' wards, and they do not all want the same thing.',
      tone: 'good'
    });
    return S.sprint;
  }

  // The wards are the campaign's own record of itself. Rather than teach the
  // election code a second way to count, fold the result back into the two
  // things it already reads: home support and campaign effort.
  function end(S) {
    var sp = S.sprint;
    S.tempo = 'month';
    S.date.week = 1;
    S.sprint = null;
    if (!sp) return null;

    var t = tally(S, sp);
    var home = S.player.regionId;
    // What the eight weeks were worth is the swing, not the level. Folding the
    // level back in would mean each campaign started from the last one's
    // result and ratcheted upward forever.
    var swing = t.support - (sp.openTally || t.support);
    S.player.regionSupport[home] = C100(S.player.regionSupport[home] + swing * 1.6);
    S.campaign.effort = (S.campaign.effort || 0) + Math.max(0, swing) * 2.2;
    if (S.flags.agentsTrained) S.campaign.effort += S.flags.agentsTrained * 4;
    sp.swing = swing;

    sp.finalTally = t;
    S.flags.lastSprint = sp;
    return sp;
  }

  /* =======================================================================
     WARDS — the constituency, broken into places with names
     ======================================================================= */
  var WARD_KINDS = [
    { id: 'township', name: 'Township', lean: -4, turnout: 54, swing: 1.25,
      note: 'Young, angry, and hard to get to the station on the day.' },
    { id: 'village', name: 'Village', lean: 6, turnout: 71, swing: 0.75,
      note: 'Turns out reliably and votes the way the elders indicate.' },
    { id: 'suburb', name: 'Suburb', lean: -2, turnout: 66, swing: 0.9,
      note: 'Reads the papers, resents being canvassed, votes anyway.' },
    { id: 'mine', name: 'Mine compound', lean: 2, turnout: 58, swing: 1.4,
      note: 'Union country. Moves in a block, or not at all.' },
    { id: 'farm', name: 'Farming ward', lean: 8, turnout: 74, swing: 0.6,
      note: 'Far from everything. Nobody campaigns here, which is the opportunity.' },
    { id: 'informal', name: 'Informal settlement', lean: -6, turnout: 42, swing: 1.6,
      note: 'The lowest turnout in the seat and the biggest swing available.' },
    { id: 'cbd', name: 'Town centre', lean: 0, turnout: 61, swing: 1.0,
      note: 'Traders and taxi ranks. Whatever happens here is on the radio by lunchtime.' }
  ];

  function buildWards(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var home = c.regionById[S.player.regionId];
    var n = 5 + RZ.irange(0, 2);
    var kinds = RZ.shuffle(WARD_KINDS).slice(0, n);
    // A seat is won against somebody. The anchor is the party's own share —
    // what the ballot paper is worth before your name is on it — nudged by how
    // well known you personally are here. Anchoring to accumulated regional
    // standing instead produced 90% polls and no contest at all.
    // Where no party contests the ballot — the tinkhundla — there is no party
    // share to anchor to, and the nominal 100% would hand you every ward. You
    // are running against other individuals, so start even.
    var pv = c.parties.length > 1
      ? ((S.parties[S.player.partyId] && S.parties[S.player.partyId].vote) || 35)
      : 45;
    var personal = ((S.player.regionSupport[S.player.regionId] || 10) - 40) * 0.22;
    var base = pv + personal;
    return kinds.map(function (k, i) {
      return {
        id: k.id + '-' + i,
        name: wardName(c, k, home),
        kind: k.id, kindName: k.name, note: k.note,
        // What you are polling here before you have set foot in it.
        support: C100(base + k.lean + RZ.range(-10, 10)),
        turnout: clamp(k.turnout + RZ.range(-6, 6), 25, 92),
        swing: k.swing,
        voters: Math.round(RZ.range(3200, 14000)),
        visits: 0, lastVisit: -99
      };
    });
  }

  function wardName(c, kind, home) {
    var stem = RZ.makeName(c).split(' ').pop();
    if (kind.id === 'cbd') return home.name + ' Central';
    if (kind.id === 'informal') return stem + ' Extension';
    if (kind.id === 'suburb') return stem + ' Park';
    if (kind.id === 'mine') return stem + ' No. ' + RZ.irange(2, 9) + ' Shaft';
    if (kind.id === 'farm') return stem + ' Block';
    if (kind.id === 'township') return stem + 'ville';
    return stem;
  }

  // Where the seat actually stands: turnout-weighted support across the wards.
  function tally(S, sp) {
    var w = ((sp || S.sprint) && (sp || S.sprint).wards) || [];
    if (!w.length) return { support: 0, votes: 0, voters: 0 };
    var votes = 0, voters = 0;
    w.forEach(function (x) {
      var cast = x.voters * (x.turnout / 100);
      votes += cast * (x.support / 100);
      voters += cast;
    });
    return { support: voters ? (100 * votes) / voters : 0, votes: Math.round(votes), voters: Math.round(voters) };
  }

  /* =======================================================================
     BLITZING A WARD
     ======================================================================= */
  function blitz(S, wardId, api) {
    var w = (S.sprint.wards || []).filter(function (x) { return x.id === wardId; })[0];
    if (!w) return null;

    var spend = api.wage(1.2 + api.tier() * 0.35);
    api.add('money', -spend);
    S.sprint.war.spent += spend;

    var broke = api.P.money < 0;
    var fresh = S.turn - w.lastVisit > 2 ? 1 : 0.55;      // the third rally in a fortnight is not the first
    var fatigue = Math.pow(0.82, w.visits);                // and diminishing returns are real
    var ok = api.roll('charisma', 44);

    var gain = RZ.range(3.5, 8) * w.swing * fatigue * fresh * (broke ? 0.5 : 1) * (ok ? 1.25 : 0.7);
    w.support = C100(w.support + gain);
    w.turnout = clamp(w.turnout + RZ.range(0.8, 3.2) * fresh * fatigue, 25, 95);
    w.visits++;
    w.lastVisit = S.turn;

    api.add('health', -RZ.range(2, 5));
    api.add('fame', RZ.range(0.3, 1.2));
    api.addRegion(api.P.regionId, gain * 0.35);
    api.campaignEffort(RZ.range(2, 5) * fresh);

    return { ward: w, gain: gain, ok: ok, spend: spend, broke: broke };
  }

  // Money rather than feet: a bigger jump than a blitz, and the ward is held
  // against the drift for the rest of the campaign, which is what the money
  // is really buying.
  function surge(S, wardId, api) {
    var w = (S.sprint.wards || []).filter(function (x) { return x.id === wardId; })[0];
    if (!w) return null;
    var spend = api.wage(4 + api.tier() * 0.5);
    api.add('money', -spend);
    api.add('capital', -RZ.range(6, 10));
    S.sprint.war.spent += spend;

    var gain = RZ.range(9, 16) * w.swing;
    w.support = C100(w.support + gain);
    w.turnout = clamp(w.turnout + RZ.range(3, 7), 25, 95);
    w.held = true;                        // no further drift here
    w.visits++;
    w.lastVisit = S.turn;
    api.addRegion(api.P.regionId, gain * 0.3);
    api.campaignEffort(RZ.range(4, 9));
    return { ward: w, gain: gain, spend: spend };
  }

  /* =======================================================================
     THE WEEKLY EVENTS — sabotage, money, and the press
     ======================================================================= */
  var WEEKLY = [
    {
      id: 'poster-war', w: 10,
      title: 'Your posters came down overnight',
      body: function (a) {
        return 'Every board on the main road into ' + a.homeName() + ' was stripped between two and four in the morning, ' +
               'and replaced with somebody else’s by six. The company that owns the boards has no record of the booking.';
      },
      choices: [
        { t: 'Put them straight back up, double', d: 'Costs money you were saving for the last week.', tag: 'cost',
          when: function (a) { return a.P.money > a.wage(2); },
          run: function (a) { a.add('money', -a.wage(2.5)); a.add('grassroots', a.rng(1, 3)); a.add('fame', a.rng(1, 3));
            return { title: 'Back up by Friday', body: 'Twice as many, and higher this time. The point was never the posters; it was whether you would answer.', tone: 'good' }; } },
        { t: 'Photograph it and give it to the press', d: 'Free. Makes you the victim, which cuts both ways.',
          run: function (a) { var ok = a.roll('cunning', 48); a.add('media', ok ? a.rng(2, 6) : -a.rng(1, 3)); a.add('grassroots', ok ? a.rng(1, 4) : 0);
            return { title: ok ? 'It led the bulletin' : 'Nobody picked it up',
              body: ok ? 'A photograph of a stripped board at 4am, with a date stamp. Your opponent spent three days denying something nobody had accused him of.'
                       : 'Every candidate in the country claims this every election. The newsroom has a folder of them.', tone: ok ? 'good' : 'flat' }; } },
        { t: 'Do the same to his', d: 'It will escalate. It always escalates.', tag: 'risk',
          run: function (a) { a.add('grassroots', a.rng(0, 2)); a.add('stats.integrity', -a.rng(1, 3));
            if (a.chance(0.4)) a.dirt('postersabotage', 'Campaign workers filmed pulling down an opponent’s boards', 2);
            return { title: 'By Sunday there were no posters left in the seat', body: 'Both sides stripped bare, a great deal of money burned, and the ward committees now openly hostile.', tone: 'flat' }; } }
      ]
    },
    {
      id: 'donor-list', w: 9,
      title: 'A donor list is circulating',
      body: 'A spreadsheet with fourteen names on it, three of which should not be on any list at all, is being ' +
            'passed around on WhatsApp with your logo at the top. It is not a forgery, which is the problem.',
      when: function (a) { return a.P.dirt.length > 0 || (a.S.capture && a.S.capture.patrons.length > 0); },
      choices: [
        { t: 'Publish the whole thing yourself, first', d: 'Takes the sting out. Also confirms it.',
          run: function (a) { a.add('media', a.rng(2, 6)); a.add('stats.integrity', a.rng(2, 4)); a.add('business', -a.rng(2, 6));
            return { title: 'You released it before they could', body: 'All fourteen, with amounts, on a Tuesday morning. Two donors are furious and one has already asked for his money back. The story died in a day.', tone: 'good' }; } },
        { t: 'Refuse to discuss campaign funding', d: 'The oldest answer there is.',
          run: function (a) { a.add('media', -a.rng(3, 7)); a.add('grassroots', -a.rng(1, 4));
            return { title: '“I will not be commenting on that”', body: 'Asked at every event for the rest of the week, and clipped every time. The refusal became the story.', tone: 'bad' }; } },
        { t: 'Return the three worst donations', d: 'Expensive, eight weeks out.', tag: 'cost',
          when: function (a) { return a.P.money > a.wage(4); },
          run: function (a) { a.add('money', -a.wage(4)); a.add('media', a.rng(3, 7)); a.add('stats.integrity', a.rng(3, 6)); a.add('business', -a.rng(3, 7));
            return { title: 'Three cheques went back', body: 'With a letter, copied to the electoral commission. You are now short of money at the worst possible moment and clean at the best possible one.', tone: 'good' }; } }
      ]
    },
    {
      id: 'bussed-in', w: 9,
      title: 'His rally had four thousand people in it',
      body: function (a) {
        return 'Four thousand, in a ward with eleven hundred registered voters. The buses were photographed on the ' +
               'road from the next ' + a.t.region + ' at five in the morning, still full.';
      },
      choices: [
        { t: 'Say nothing and out-organise him', d: 'Answer a crowd with a bigger one.', tag: 'cost',
          when: function (a) { return a.P.money > a.wage(3); },
          run: function (a) { a.add('money', -a.wage(3)); a.add('grassroots', a.rng(3, 7)); a.add('health', -a.rng(3, 6)); a.campaignEffort(a.rng(5, 10));
            return { title: 'Yours had five', body: 'It cost you more than you had and it was the right call. A crowd is an argument that does not need a speech.', tone: 'good' }; } },
        { t: 'Report it to the commission', d: 'Correct, slow, and it makes you look weak.',
          run: function (a) { a.add('media', a.rng(0, 3)); a.add('grassroots', -a.rng(1, 3)); a.add('intl', a.rng(1, 3));
            return { title: 'The complaint was acknowledged', body: 'It will be considered after the election, which is the same as not at all. Your own people wanted a rally, not a letter.', tone: 'flat' }; } },
        { t: 'Mock it, hard, in public', d: 'Cheap, memorable, and it might not land.',
          run: function (a) { var ok = a.roll('oratory', 47); a.add('fame', a.rng(2, 5)); a.add('grassroots', ok ? a.rng(2, 6) : -a.rng(2, 5)); a.add('media', ok ? a.rng(1, 4) : -a.rng(1, 4));
            return { title: ok ? 'The line went everywhere' : 'It came out bitter',
              body: ok ? '“He had to import a crowd because he could not find one here.” It was on every taxi radio by Thursday.'
                       : 'Attacking the size of somebody else’s rally is what a man does when he is worried about his own. That is how it played.', tone: ok ? 'good' : 'bad' }; } }
      ]
    },
    {
      id: 'ward-defect', w: 8,
      title: 'A ward committee has crossed to the other side',
      body: 'The whole structure, chair and all, announced it on Saturday. They were yours three weeks ago and ' +
            'somebody has been talking to them for longer than that.',
      choices: [
        { t: 'Go there yourself, alone, and ask why', d: 'Costs a week. Might get them back.',
          run: function (a) { var ok = a.roll('charisma', 50); a.add('grassroots', ok ? a.rng(3, 7) : -a.rng(2, 5)); a.add('health', -a.rng(2, 4));
            return { title: ok ? 'Most of them came back' : 'They had already been paid',
              body: ok ? 'You sat in a plastic chair for four hours and let them say all of it. Nine of the eleven came back, and they brought the grievance with them, which is more useful than the votes.'
                       : 'The chair would not meet your eye. There is nothing to be said to a structure that has already banked the money.', tone: ok ? 'good' : 'bad' }; } },
        { t: 'Replace them and move on', d: 'Fast. Loses the ward.',
          run: function (a) { a.add('party', a.rng(1, 3)); a.add('grassroots', -a.rng(2, 5));
            return { title: 'A new committee by Wednesday', body: 'Appointed rather than elected, which everybody noticed. The ward is gone but the machine is intact.', tone: 'flat' }; } },
        { t: 'Buy them back', d: 'It works. It also becomes a file.', tag: 'risk',
          when: function (a) { return a.P.money > a.wage(3); },
          run: function (a) { a.add('money', -a.wage(3.5)); a.add('grassroots', a.rng(3, 6)); a.add('stats.integrity', -a.rng(2, 5));
            if (a.chance(0.45)) a.dirt('wardcash', 'Cash paid to a ward committee eight weeks before a ballot', 3);
            return { title: 'They came back on Friday', body: 'For more than the other side paid, in an envelope, in a car park. Two of them will tell somebody about it eventually.', tone: 'flat' }; } }
      ]
    },
    {
      id: 'debate', w: 10,
      title: 'The community radio wants a candidates’ debate',
      body: function (a) {
        return 'Live, ninety minutes, on ' + P(a.C.media) + ', with the other candidates in the room and callers on the line. ' +
               'Refusing is an answer too, and everybody will hear it.';
      },
      choices: [
        { t: 'Do it, and prepare properly', d: 'A whole week of the diary.',
          run: function (a) { var ok = a.roll('intellect', 46); a.add('media', ok ? a.rng(4, 9) : -a.rng(2, 6)); a.add('fame', a.rng(2, 5));
            a.add('grassroots', ok ? a.rng(2, 6) : -a.rng(1, 4)); a.add('health', -a.rng(1, 3));
            return { title: ok ? 'You won it on the numbers' : 'You were caught on your own record',
              body: ok ? 'You had the district figures with you and used them once, at the right moment. The clip of it is still circulating.'
                       : 'A caller asked about something you said in March and you did not remember saying it. He had the recording.', tone: ok ? 'good' : 'bad' }; } },
        { t: 'Do it, unprepared, on instinct', d: 'Cheap. Depends entirely on the day.', tag: 'risk',
          run: function (a) { var ok = a.roll('oratory', 52); a.add('media', ok ? a.rng(3, 8) : -a.rng(4, 9)); a.add('fame', a.rng(2, 6));
            return { title: ok ? 'You were the only human being on the panel' : 'It went badly and it went out live',
              body: ok ? 'No notes, no slogans, and one genuinely funny answer about the state of the road. People rang in afterwards just to say so.'
                       : 'Ninety minutes is a very long time without preparation, and the last twenty were unwatchable.', tone: ok ? 'good' : 'bad' }; } },
        { t: 'Decline — you are ahead', d: 'Front-runners duck debates. Everyone knows why.',
          run: function (a) { a.add('media', -a.rng(4, 9)); a.add('grassroots', -a.rng(1, 4)); a.add('health', a.rng(1, 3));
            return { title: 'They left an empty chair on the stage', body: 'And photographed it, and put your name on it. It ran on the front of the community paper all week.', tone: 'bad' }; } }
      ]
    },
    {
      id: 'broke', w: 12,
      title: 'The campaign has run out of money',
      when: function (a) { return a.P.money < a.wage(1); },
      body: 'The petrol account is closed, the printer wants cash up front, and two of the ward organisers have not ' +
            'been paid since the middle of the month. There are still weeks of this left.',
      choices: [
        { t: 'Go back to the businessman who offered', d: 'He is still offering. He will keep offering.', tag: 'risk',
          run: function (a) { var nm = RZ.makeName(a.C); a.add('money', a.wage(8)); a.add('business', a.rng(2, 5));
            a.add('stats.integrity', -a.rng(2, 5)); a.owePatron(nm, 8);
            a.dirt('latemoney', 'A large late donation from ' + nm + ', taken in the last weeks of a campaign', 3);
            return { title: nm + ' paid the printer directly', body: 'Which means there is no record of it as a donation at all, which is exactly why he did it that way.', tone: 'flat' }; } },
        { t: 'Sell something of your own', d: 'The car, the plot, whatever is left.', tag: 'cost',
          run: function (a) { a.add('money', a.wage(4)); a.add('grassroots', a.rng(1, 4)); a.add('stats.grit', a.rng(0.5, 2));
            return { title: 'The car went on Thursday', body: 'You are campaigning in somebody else’s bakkie and the ward organisers know exactly why. It is worth more than the car was.', tone: 'good' }; } },
        { t: 'Run the last weeks on nothing', d: 'Volunteers, feet, and no printing at all.',
          run: function (a) { a.add('health', -a.rng(4, 9)); a.add('grassroots', a.rng(0, 3)); a.campaignEffort(a.rng(1, 4));
            return { title: 'On foot, then', body: 'No posters, no convoy, no T-shirts. Just you and whoever still turns up, walking. It is slower and it is not nothing.', tone: 'flat' }; } }
      ]
    }
  ];

  function weeklyEvent(S) {
    var api = RZ.engine.mkApi(S);
    var pool = WEEKLY.filter(function (e) {
      if (S.seenEvents['wk-' + e.id] !== undefined) return false;   // once per campaign
      if (e.when && !e.when(api)) return false;
      return true;
    });
    if (!pool.length) return null;
    var e = RZ.weighted(pool, function (x) { return x.w || 5; });
    S.seenEvents['wk-' + e.id] = S.turn;
    return {
      id: 'wk-' + e.id, kicker: 'Week ' + S.sprint.week + ' of ' + WEEKS, weekly: e.id,
      title: typeof e.title === 'function' ? e.title(api) : e.title,
      body: typeof e.body === 'function' ? e.body(api) : e.body,
      choices: e.choices.map(function (ch, i) {
        return { i: i, t: ch.t, d: ch.d, tag: ch.tag, ok: !ch.when || ch.when(api) };
      })
    };
  }

  function resolveWeekly(S, ev, idx) {
    var def = WEEKLY.filter(function (e) { return e.id === ev.weekly; })[0];
    if (!def) return null;
    var api = RZ.engine.mkApi(S);
    var res = def.choices[idx].run(api);
    res.deltas = api.deltas.slice();
    return res;
  }

  /* =======================================================================
     THE WEEK TURNING
     ======================================================================= */
  function tickWeek(S) {
    if (!S.sprint) return null;
    S.sprint.week = WEEKS - S.sprint.weeksLeft + 1;

    // Wards drift back without you: an unvisited ward is one the other side
    // is visiting.
    // Drift is real but it must not outrun what eight weeks of work can win
    // back, or the only possible campaign is a losing one.
    S.sprint.wards.forEach(function (w) {
      if (w.held) return;                 // paid for, and staying paid for
      var untouched = S.turn - w.lastVisit;
      if (untouched > 2) w.support = C100(w.support - RZ.range(0.15, 0.6) * w.swing);
    });

    // Something goes wrong most weeks. This is the whole point of the sprint.
    if (!S.pendingEvent && S.sprint.weeksLeft > 0 && RZ.chance(0.5)) {
      var ev = weeklyEvent(S);
      if (ev) S.pendingEvent = ev;
    }

    return { week: S.sprint.week, weeksLeft: S.sprint.weeksLeft, tally: tally(S) };
  }

  /* =======================================================================
     WEEKLY-ONLY ACTIONS
     ======================================================================= */
  var WEEK_ACTIONS = [
    { id: 'blitz', ico: '📍', ap: 1, special: 'blitz',
      name: 'Blitz a ward',
      desc: 'Pick one, and spend the week in it. Doors, taxi ranks, the lot.' },

    // Emergency money, poured into one contested ward, and held there. An
    // ordinary blitz is a week of your feet; this is the war chest.
    { id: 'surge', ico: '💸', ap: 1, special: 'surge',
      name: 'Surge a contested ward',
      desc: 'Emergency funds into one ward. Expensive, and it holds.',
      when: function (a) { return a.P.money > a.wage(4) && a.P.capital >= 8; } },

    { id: 'dump', ico: '🗞️', ap: 1, risky: true,
      name: 'The Friday news dump',
      desc: 'Put the dossier out at four on a Friday and let it run all weekend.',
      when: function (a) { return a.hasLeverage(); },
      run: function (a) {
        var res = a.doLeak(false);
        // Friday is the point: it runs unanswered for three days.
        a.add('media', a.rng(8, 16));
        RZ.crisis.addBuff(a.S, 'media', a.rng(8, 16), 4, 'the Friday dump');
        a.add('fame', a.rng(2, 6));
        // And it is traced about a third of the time, because somebody in your
        // own office sent the email.
        if (RZ.chance(0.34)) {
          a.add('media', -a.rng(6, 14));
          a.add('stats.integrity', -a.rng(2, 6));
          a.dirt('dump', 'A dossier on an opponent traced back to your own campaign office', 3);
          return {
            title: 'It was traced to your campaign manager by Tuesday', tone: 'bad',
            body: (res && res.body ? res.body + ' ' : '') +
              'The metadata on the document had his name in it. He has resigned, which fools nobody, ' +
              'and the story is now about you rather than about them.'
          };
        }
        return {
          title: 'Four o’clock on a Friday', tone: 'good',
          body: (res && res.body ? res.body + ' ' : '') +
            'Nobody at their office was answering by the time it landed, so it ran unanswered through two ' +
            'bulletins and the Sunday papers. By Monday it was established fact.'
        };
      } },

    { id: 'kgotla', ico: '🌳', ap: 1,
      name: function (a) { return 'Mobilise the ' + a.t.meetingPl; },
      desc: function (a) { return 'The ' + a.t.elder + 's can deliver the rural wards. They will not do it for money.'; },
      when: function (a) { return a.P.stats.integrity >= 52; },
      run: function (a) {
        var ok = a.roll('integrity', 46);
        // No money at all — this is the one thing a broke campaign can still do.
        a.add('health', -a.rng(2, 5));
        var moved = 0;
        a.S.sprint.wards.forEach(function (w) {
          if (w.kind !== 'village' && w.kind !== 'farm') return;
          moved++;
          w.support = C100(w.support + (ok ? RZ.range(5, 11) : RZ.range(1.5, 4)));
          w.turnout = clamp(w.turnout + (ok ? RZ.range(2, 6) : RZ.range(0, 2)), 25, 95);
        });
        a.add('grassroots', ok ? a.rng(2, 5) : a.rng(0, 2));
        a.add('media', -a.rng(0, 2));
        if (!moved) {
          return { title: 'There is no rural ward to deliver', tone: 'flat',
            body: 'You sat under the tree for an afternoon and were listened to politely. This seat is all township ' +
                  'and town centre, and the ' + a.t.elder + 's here have nothing to hand you.' };
        }
        return {
          title: ok ? 'The ' + a.t.elder + 's will say your name' : 'They heard you out and committed to nothing',
          tone: ok ? 'good' : 'flat',
          body: ok
            ? 'Not an endorsement — they are careful about the word — but they will be seen with you on the Sunday, ' +
              'and in ' + moved + ' ward' + (moved === 1 ? '' : 's') + ' that is the same thing. It cost nothing but ' +
              'an afternoon of listening, which is the only currency they take.'
            : 'You were given tea and a great deal of history. Nobody said no. Nobody said anything else either, ' +
              'and the young men at the back were not impressed by any of it.'
        };
      } },

    { id: 'rebut', ico: '📢', ap: 1,
      name: 'Rebut the story of the week',
      desc: 'Get in front of it before it sets.',
      run: function (a) {
        var ok = a.roll('cunning', 46);
        a.add('media', ok ? a.rng(2, 6) : -a.rng(1, 4));
        a.add('health', -a.rng(1, 3));
        a.S.sprint.rebuttals++;
        return { title: ok ? 'Killed before Wednesday' : 'You fed it another day',
          body: ok ? 'One statement, on the record, with a document attached, issued before the second story could be written.'
                   : 'Responding to it put it back on the front page with your name in the headline instead of a source’s.',
          tone: ok ? 'good' : 'bad' };
      } },

    { id: 'transport', ico: '🚐', ap: 1,
      name: 'Book transport for the day',
      desc: 'Turnout is a logistics problem before it is a political one.',
      run: function (a) {
        var spend = a.wage(2.5);
        a.add('money', -spend);
        a.S.sprint.war.spent += spend;
        var lift = a.rng(2.5, 6);
        a.S.sprint.wards.forEach(function (w) { w.turnout = clamp(w.turnout + lift * (w.turnout < 55 ? 1.3 : 0.7), 25, 95); });
        return { title: 'Forty-one taxis, booked and paid',
          body: 'Deposit down on every combi in the ' + a.t.constituency + ' for the Saturday. It is the least glamorous money a campaign spends and the most reliable.',
          tone: 'good' };
      } },

    { id: 'agents', ico: '🗳️', ap: 1,
      name: 'Train your polling agents',
      desc: 'Somebody of yours in every station, who knows the regulations.',
      run: function (a) {
        var spend = a.wage(1.5);
        a.add('money', -spend);
        a.S.sprint.war.spent += spend;
        a.S.flags.agentsTrained = (a.S.flags.agentsTrained || 0) + 1;
        a.add('party', a.rng(1, 3));
        return { title: 'Two days in a church hall with the regulations',
          body: 'Every one of them can now read a results slip, knows what to object to and when, and will not sign anything at 3am because a presiding officer is tired.',
          tone: 'good' };
      } },

    { id: 'sleep', ico: '😴', ap: 1,
      name: 'Sleep for two days',
      desc: 'You cannot campaign from a hospital bed.',
      run: function (a) {
        a.add('health', a.rng(5, 10));
        a.add('grassroots', -a.rng(0, 2));
        return { title: 'Two days, phone off',
          body: 'Your agent handled the diary and told nobody where you were. You are a different person on Wednesday.',
          tone: 'good' };
      } }
  ];

  function weekActions(S) {
    if (!S.sprint) return [];
    var api = RZ.engine.mkApi(S);
    return WEEK_ACTIONS.filter(function (x) { return !x.when || x.when(api); });
  }
  function weekActionById(id) {
    return WEEK_ACTIONS.filter(function (x) { return x.id === id; })[0];
  }

  RZ.sprint = {
    WEEKS: WEEKS,
    due: due, begin: begin, end: end, tickWeek: tickWeek,
    tally: tally, blitz: blitz, surge: surge,
    weekActions: weekActions, weekActionById: weekActionById,
    resolveWeekly: resolveWeekly, WEEKLY: WEEKLY, WARD_KINDS: WARD_KINDS
  };
})();
