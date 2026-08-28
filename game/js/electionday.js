/* electionday.js — the one day in five years that decides the other four.

   Until now a general election was a function call and a results sheet: you
   pressed a button and the country had voted. Everything that made the day
   itself worth playing — not knowing, finding out slowly, and being able to do
   exactly one thing about it while the polls are still open — was missing.

   Four phases, in order, and the order is the whole design:

     1. THE GROUND GAME   Dawn. Where your people go. Nothing is known yet.
     2. THE EXIT POLLS    Midday. A number, from a sample, which may be wrong —
                          and it is deliberately wrong often enough that acting
                          on it is a gamble rather than a lookup.
     3. THE TACTICAL SHIFT Afternoon. One intervention, chosen while the polls
                          are still open, on the strength of a number you cannot
                          verify.
     4. THE COUNT         Night. Region by region, staggered, no way to hurry it.

   The true result is not computed until phase three has been answered, so the
   first three phases genuinely move it. The exit poll is derived from the same
   state, sampled: it is an honest preview with honest sampling error, not the
   answer shown early.
*/
(function () {
  'use strict';
  var clamp = RZ.clamp;

  var PHASES = ['ground', 'exit', 'shift', 'count'];

  function init(S) {
    S.eday = {
      phase: 'ground', year: S.date.year,
      ground: null, shift: null,
      poll: null, swingBonus: 0, turnout: 0,
      rig: 0, result: null, revealed: []
    };
    return S.eday;
  }

  /* =======================================================================
     1. THE GROUND GAME
     ======================================================================= */
  // Everybody has the same number of cars and the same number of people
  // willing to drive them. What differs is where you send them, and you are
  // sending them before you know anything.
  var GROUND = [
    {
      id: 'strongholds',
      t: 'Work your strongholds',
      d: 'Bring out the people who already agree with you. Safe, and it is never enough on its own.',
      run: function (S, api) {
        var g = RZ.range(2.0, 4.5);
        api.add('grassroots', RZ.range(0.5, 1.5));
        if (RZ.blocs) RZ.blocs.drift(S, 1.2);
        return { swing: g, turnout: RZ.range(3, 7),
          note: 'Cars all day in the wards that were never in doubt. Turnout there is the best it has been ' +
                'in fifteen years and it does not, by itself, win anything.' };
      }
    },
    {
      id: 'marginals',
      t: 'Throw everything at the marginals',
      d: 'The seats that decide it. If the read was wrong, you spent the day in the wrong places.',
      run: function (S, api) {
        // High variance on purpose: this is the choice that can win or lose a
        // day, and it is made before the exit polls exist.
        var right = RZ.chance(0.55 + (api.P.standing.party + api.P.standing.grassroots) / 500);
        return right
          ? { swing: RZ.range(4.5, 8.5), turnout: RZ.range(2, 5),
              note: 'Your organisers picked the right eleven wards. By four in the afternoon the queues in ' +
                    'them were the longest in the country.' }
          : { swing: RZ.range(-1.5, 1.0), turnout: RZ.range(0, 2),
              note: 'The eleven wards your organisers picked were not the eleven that mattered. Nobody will ' +
                    'ever be able to prove that, and everybody will always say it.' };
      }
    },
    {
      id: 'transport',
      t: 'Put every vehicle on the rural routes',
      d: 'Two hours to the nearest station. Nobody walks that twice.',
      run: function (S, api) {
        api.add('money', -api.wage(RZ.range(1.5, 4)));
        return { swing: RZ.range(3.0, 6.0), turnout: RZ.range(5, 11),
          note: 'Sixty vehicles, most of them borrowed, running from before six. The stations that normally ' +
                'close at four were still queueing at seven.' };
      }
    },
    {
      id: 'observers',
      t: 'Put your people inside the stations as agents',
      d: 'Not a vote gained. A vote that cannot be quietly removed later.',
      run: function (S, api) {
        api.add('stats.integrity', RZ.range(0.5, 2));
        api.nation('electoral', RZ.range(0.5, 2));
        return { swing: RZ.range(1.0, 3.0), turnout: RZ.range(0, 2), guarded: true,
          note: 'An agent in every station you could staff, with the forms, staying until the boxes were ' +
                'sealed. It is not a campaign. It is an insurance policy.' };
      }
    }
  ];

  function groundOptions(S) {
    return GROUND.map(function (g, i) { return { i: i, id: g.id, t: g.t, d: g.d, ok: true }; });
  }

  function chooseGround(S, i) {
    var E = S.eday;
    var api = RZ.engine.mkApi(S);
    var g = GROUND[clamp(i, 0, GROUND.length - 1)];
    var res = g.run(S, api);
    E.ground = { id: g.id, swing: res.swing, turnout: res.turnout, note: res.note, guarded: !!res.guarded };
    E.swingBonus += res.swing;
    E.turnout += res.turnout;
    E.phase = 'exit';
    E.deltas = api.deltas.slice();
    return E.ground;
  }

  /* =======================================================================
     2. THE EXIT POLLS
     =======================================================================
     A sample, not the answer. It is drawn from the same state the real count
     will be drawn from — so it is honest — and then a sampling error is added
     that is large enough to be wrong about the outcome maybe one time in five.
     That is roughly how often exit polls in tight elections are wrong, and it
     is exactly what makes phase three a decision rather than a lookup.
  */
  function pollError(S) {
    // Better electoral administration means better polling, mostly because it
    // means it is legal to stand outside a station and ask.
    var c = RZ.COUNTRIES[S.countryId];
    return clamp(9 - (c.inst.electoral || 50) * 0.06, 3.5, 9);
  }

  function takePoll(S) {
    var E = S.eday;
    var c = RZ.COUNTRIES[S.countryId];
    // The provisional read, from where the country actually is right now plus
    // whatever this morning bought.
    var vote = RZ.elections.projectVote(S);
    var err = pollError(S);
    var sampled = {}, tot = 0;
    c.parties.forEach(function (p) {
      var v = vote.byParty[p.id] + RZ.noise(err);
      if (p.id === S.player.partyId) v += E.swingBonus * 0.5;
      sampled[p.id] = Math.max(0.5, v);
      tot += sampled[p.id];
    });
    c.parties.forEach(function (p) { sampled[p.id] = sampled[p.id] / tot * 100; });

    var order = c.parties.slice().sort(function (a, b) { return sampled[b.id] - sampled[a.id]; });
    var mine = sampled[S.player.partyId];
    var lead = sampled[order[0].id] - sampled[order[1] ? order[1].id : order[0].id];
    E.poll = {
      byParty: sampled, err: Math.round(err * 10) / 10,
      leadId: order[0].id, lead: lead, mine: mine,
      ahead: order[0].id === S.player.partyId,
      tight: lead < err,
      read: lead < err * 0.6 ? 'inside the margin of error, which means it says nothing at all'
          : lead < err ? 'a lead the sample cannot really support'
          : lead < 6 ? 'a lead, and a narrow one'
          : 'a lead that would take a bad night to lose'
    };
    E.phase = 'shift';
    return E.poll;
  }

  /* =======================================================================
     3. THE TACTICAL SHIFT
     ======================================================================= */
  // One intervention, on the strength of a number you cannot check, while the
  // stations are still open. Each of these is available only when the poll says
  // something that would make a person reach for it.
  var SHIFTS = [
    {
      id: 'hold',
      t: 'Nothing. Let the day finish.',
      d: 'The hardest one, and free.',
      when: function () { return true; },
      run: function (S, api, E) {
        return { swing: 0, note: 'You watched the afternoon from an office with the sound off, and did not ' +
          'telephone anybody. There is a particular kind of authority that comes from having done that, ' +
          'and it is only visible afterwards.' };
      }
    },
    {
      id: 'surge',
      t: 'Last-hour surge in the wards you are losing',
      d: 'Every car, every loudhailer, the final two hours.',
      when: function (S, E) { return !E.poll.ahead || E.poll.tight; },
      run: function (S, api, E) {
        api.add('money', -api.wage(RZ.range(2, 5)));
        api.add('health', -RZ.range(2, 6));
        var got = RZ.chance(0.62);
        return got
          ? { swing: RZ.range(2.0, 4.5),
              note: 'Two hours of pure noise and forty vehicles. The queues at half past six were people who ' +
                    'had not intended to come out at all.' }
          : { swing: RZ.range(-0.5, 1.0),
              note: 'Two hours of noise, in the rain, at stations that were already emptying. It cost what it ' +
                    'cost and moved almost nothing.' };
      }
    },
    {
      id: 'concede',
      t: 'Call it early and concede with grace',
      d: 'You lose tonight and you keep something for next time.',
      when: function (S, E) { return !E.poll.ahead && !E.poll.tight; },
      run: function (S, api, E) {
        api.add('media', RZ.range(4, 9));
        api.add('intl', RZ.range(3, 7));
        api.add('stats.integrity', RZ.range(2, 5));
        api.add('party', -RZ.range(2, 6));
        api.nation('electoral', RZ.range(1, 3));
        api.legacyMark('concededEarly');
        return { swing: -RZ.range(0.5, 2.0), conceded: true,
          note: 'You went on air at twenty past eight, before a single official result, and congratulated ' +
                'them by name. Half your own party has not forgiven you. Everybody outside it noticed.' };
      }
    },
    {
      id: 'challenge',
      t: 'Challenge the roll in the districts you are losing',
      d: 'Lawyers at the returning officer’s door before the boxes move.',
      when: function (S, E) { return !E.poll.ahead || E.poll.tight; },
      run: function (S, api, E) {
        api.add('money', -api.wage(RZ.range(3, 7)));
        api.add('media', -RZ.range(2, 6));
        var stuck = RZ.chance(0.4);
        if (stuck) {
          return { swing: RZ.range(1.5, 3.5),
            note: 'Two districts’ results were held for four hours while a magistrate read an affidavit. ' +
                  'When they were released they had changed, slightly, in the way these things do.' };
        }
        api.dirt('rollchallenge', 'A last-minute challenge to a voters’ roll that the court threw out', 2);
        return { swing: -RZ.range(0, 1.5),
          note: 'The magistrate read it, asked one question your counsel could not answer, and dismissed it ' +
                'with costs. It was on the news before the first result was.' };
      }
    },
    {
      id: 'claim',
      t: 'Declare victory now, on the exit poll',
      d: 'If the sample is right you own the night. If it is wrong you own that too.',
      when: function (S, E) { return E.poll.ahead; },
      run: function (S, api, E) {
        api.add('fame', RZ.range(3, 7));
        return { swing: RZ.range(0, 1.5), claimed: true,
          note: 'You said the word "victory" at nine o’clock in front of a room that wanted to hear it, ' +
                'with eleven per cent of the count in.' };
      }
    }
  ];

  function shiftOptions(S) {
    var E = S.eday;
    return SHIFTS.map(function (sh, i) {
      return { i: i, id: sh.id, t: sh.t, d: sh.d, ok: !sh.when || sh.when(S, E) };
    }).filter(function (o) { return o.ok; });
  }

  function chooseShift(S, i) {
    var E = S.eday;
    var api = RZ.engine.mkApi(S);
    var sh = SHIFTS.filter(function (x) { return !x.when || x.when(S, E); })[
      clamp(i, 0, SHIFTS.length - 1)] || SHIFTS[0];
    var res = sh.run(S, api, E);
    E.shift = { id: sh.id, swing: res.swing, note: res.note,
                conceded: !!res.conceded, claimed: !!res.claimed };
    E.swingBonus += res.swing;
    E.deltas = (E.deltas || []).concat(api.deltas);
    E.phase = 'count';
    return E.shift;
  }

  /* =======================================================================
     4. THE COUNT
     ======================================================================= */
  // Everything the day bought is folded into campaign effort — the one input
  // the existing election code already reads — so there is exactly one place
  // where votes are decided, and this is not it.
  function runCount(S, opts) {
    var E = S.eday;
    S.campaign.effort = (S.campaign.effort || 0) + Math.max(0, E.swingBonus) * 2.4;
    if (E.swingBonus < 0) S.campaign.effort = Math.max(0, (S.campaign.effort || 0) + E.swingBonus * 1.6);
    E.result = RZ.gov.runElection(S, opts || {});
    E.phase = 'done';
    return E.result;
  }

  // The count comes in region by region, and the order is not random: the small
  // districts have a few thousand ballots and declare before midnight, and the
  // metros take until the morning. That ordering is most of why election nights
  // feel the way they do — the shape of the result is visible for hours before
  // the places that actually decide it have said anything.
  function countOrder(S) {
    var c = RZ.COUNTRIES[S.countryId];
    return c.regions.slice().sort(function (a, b) {
      return (a.seats || 1) - (b.seats || 1);
    }).map(function (r) { return r.id; });
  }

  // A running total after `n` regions have declared, for the animated screen.
  function partial(S, n) {
    var E = S.eday, c = RZ.COUNTRIES[S.countryId];
    if (!E.result) return null;
    var order = countOrder(S);
    var done = order.slice(0, clamp(n, 0, order.length));
    var acc = {}, tot = 0;
    c.parties.forEach(function (p) { acc[p.id] = 0; });
    done.forEach(function (rid) {
      var shares = E.result.vote.byRegion[rid];
      if (!shares) return;
      var w = (c.regionById[rid].seats || 1);
      c.parties.forEach(function (p) { acc[p.id] += (shares[p.id] || 0) * w; tot += (shares[p.id] || 0) * w; });
    });
    var out = {};
    c.parties.forEach(function (p) { out[p.id] = tot > 0 ? acc[p.id] / tot * 100 : 0; });
    return {
      declared: done.length, of: order.length, byParty: out,
      last: done.length ? c.regionById[done[done.length - 1]] : null,
      pct: Math.round((done.length / order.length) * 100)
    };
  }

  function summary(S) {
    var E = S.eday;
    if (!E) return null;
    return {
      phase: E.phase, year: E.year,
      ground: E.ground, poll: E.poll, shift: E.shift,
      swing: Math.round(E.swingBonus * 10) / 10,
      turnout: Math.round(E.turnout * 10) / 10,
      // Was the exit poll right about who won? Worth recording, because a
      // player who acted on a wrong one should be able to see that they did.
      pollWrong: !!(E.result && E.poll &&
        (E.poll.leadId !== E.result.gov.lead))
    };
  }

  RZ.eday = {
    PHASES: PHASES, GROUND: GROUND, SHIFTS: SHIFTS,
    init: init, groundOptions: groundOptions, chooseGround: chooseGround,
    pollError: pollError, takePoll: takePoll,
    shiftOptions: shiftOptions, chooseShift: chooseShift,
    runCount: runCount, countOrder: countOrder, partial: partial, summary: summary
  };
})();
