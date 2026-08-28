/* revolt.js — the ways past the bottleneck.

   The Monte Carlo said it plainly: no automated policy reaches high office.
   Tier 3 is where careers stop, because the standing a tier-4 appointment
   needs decays faster than an ordinary month can build it, and appointment is
   in somebody else's gift.

   Three ways through, each with its own price:
     the mandate    — win a hard contest and decay halves for a year
     the revolt     — challenge the incumbent directly, and live with losing
     the file       — trade kompromat for the seat, and make an enemy for life

   Failing the revolt is not death. It is an ultimatum, and then a long way
   back — which is exactly the situation the floor-crossing action was built
   for.
*/
(function () {
  'use strict';
  var C100 = RZ.c100, clamp = RZ.clamp;

  // Months are the honest unit here: a sprint week must not age a debuff four
  // times faster than a month of ordinary politics.
  function monthIndex(S) { return S.date.year * 12 + S.date.month; }

  function has(S, key) {
    var until = S.flags[key];
    return until !== undefined && monthIndex(S) < until;
  }
  function grant(S, key, months) { S.flags[key] = monthIndex(S) + months; }

  /* =======================================================================
     1. THE MANDATE
     ======================================================================= */
  // Winning a contested ballot buys you a year in which the machine stops
  // eroding underneath you. It is the window the ladder needs to be climbable.
  function grantMandate(S, rung) {
    if (!rung || (rung.tier || 0) < 2) return null;
    grant(S, 'mandateUntil', 12);
    S.flags.mandates = (S.flags.mandates || 0) + 1;
    RZ.engine.pushFeed(S, {
      kind: 'good', src: 'A mandate',
      title: 'You won it on the floor, and everybody saw',
      body: 'A contested ballot, won in the room, is worth more than an appointment: for about a year nobody in the ' +
            'structures will move against you and the phone gets answered first time. Use it. It does not last.',
      tone: 'good'
    });
    return { months: 12 };
  }
  function mandateActive(S) { return has(S, 'mandateUntil'); }

  // Doubled cost of everything internal, for a year, because your name is now
  // a liability in a corridor.
  function pngActive(S) { return has(S, 'pngUntil'); }

  /* =======================================================================
     THE WHIP
     Obedience is a resource the party buys from you, and it pays out in
     access: a whipped member's calls to a ministry get returned.
     ======================================================================= */
  function whipped(S) { return has(S, 'whippedUntil'); }
  function whip(S, months, why) {
    grant(S, 'whippedUntil', months || 18);
    S.flags.whippedWhy = why || null;
    S.flags.whipCount = (S.flags.whipCount || 0) + 1;
  }
  function unwhip(S) { S.flags.whippedUntil = 0; }

  /* =======================================================================
     2. THE CAUCUS REVOLT
     ======================================================================= */
  function incumbent(S) {
    // The person actually in the way: the strongest rival in your own party,
    // preferring one in your own region.
    var mine = RZ.field.ours(S);
    if (!mine.length) return null;
    // Unless somebody has been explicitly put in the way — the other one, once
    // they have taken the office you were climbing towards.
    var named = mine.filter(function (r) { return r.incumbent; });
    if (named.length) return named[0];
    var home = mine.filter(function (r) { return r.regionId === S.player.regionId; });
    var pool = home.length ? home : mine;
    return pool.slice().sort(function (a, b) { return b.power - a.power; })[0];
  }

  function canRevolt(S) {
    if (S.tempo === 'week') return false;              // not mid-campaign
    if (S.player.isPresident || S.player.isLeader) return false;
    var tier = RZ.engine.mkApi(S).tier();
    if (tier < 2 || tier > 9) return false;
    var next = RZ.engine.nextRung(S);
    if (!next || next.how === 'auto') return false;   // the top office is a ballot, not a caucus
    if (!incumbent(S)) return false;
    if (S.flags.revoltCooldown !== undefined && monthIndex(S) < S.flags.revoltCooldown) return false;
    return S.player.capital >= 12;
  }

  // How the numbers look before you call it. Shown to the player, because a
  // revolt you cannot count is not a gambit, it is a coin toss.
  function revoltOdds(S) {
    var P = S.player, c = RZ.COUNTRIES[S.countryId];
    var inc = incumbent(S);
    if (!inc) return null;
    var mine = P.standing.party * 0.45 + P.standing.grassroots * 0.30 +
               RZ.field.allies(S).length * 3.5 + P.capital * 0.20 +
               (mandateActive(S) ? 10 : 0) -
               // A seat somebody else paid for is a seat somebody else can talk
               // about, and every member of that caucus was told about it.
               (S.flags.seatOwed ? 12 : 0);
    var theirs = inc.power * 0.75 + S.parties[P.partyId].machine * 0.35 +
                 c.inst.incumbency * 0.18 + c.inst.patronage * 0.10;
    var pct = clamp(50 + (mine - theirs) * 0.9, 4, 92);
    return { inc: inc, name: inc.name, mine: Math.round(mine), theirs: Math.round(theirs), pct: Math.round(pct) };
  }

  function revolt(S, api) {
    var odds = revoltOdds(S);
    if (!odds) return null;
    var inc = odds.inc;

    api.add('capital', -12);
    S.flags.revoltCooldown = monthIndex(S) + 18;
    S.flags.revolts = (S.flags.revolts || 0) + 1;

    var won = RZ.rnd() * 100 < odds.pct;
    if (won) {
      // The structures voted. There is nothing to appeal to.
      P_removeRival(S, inc);
      api.add('party', RZ.range(6, 14));
      api.add('leader', -RZ.range(3, 9));         // the leadership never likes this
      api.add('grassroots', RZ.range(2, 6));
      api.add('media', RZ.range(2, 6));
      RZ.engine.promote(S, 'You took it off him on the floor.');
      grantMandate(S, RZ.ladderFor(S.countryId)[S.player.rungIdx]);
      return {
        won: true, odds: odds,
        title: 'You beat him in his own branch',
        body: 'Two hundred and eleven to a hundred and eighty-four, after a credentials fight that ran until midnight. ' +
              inc.name + ' left before the result was read out. The position is yours and so is the grudge.',
        tone: 'good'
      };
    }

    // Losing does not end it here. It ends in a room, with an offer.
    S.pendingEvent = ultimatum(S, inc);
    return {
      won: false, odds: odds, ultimatum: true,
      title: 'The numbers were not there',
      body: 'You lost the credentials fight before you lost the vote. ' + inc.name + ' would like to see you ' +
            'in the regional office on Monday, and it is not a request.',
      tone: 'bad'
    };
  }

  function P_removeRival(S, inc) {
    // He does not vanish from the party; he loses the seat and the standing,
    // which the field already knows how to record.
    RZ.field.retire(S, inc, 'ousted');
  }

  /* =======================================================================
     THE ULTIMATUM
     ======================================================================= */
  function ultimatum(S, inc) {
    var api = RZ.engine.mkApi(S);
    // The third way out only exists if you brought something to the meeting.
    var file = leverageOn(S, inc);
    var cunning = S.player.stats.cunning >= 62;

    var choices = [
      { i: 0, t: 'Apologise, publicly, in the words they give you',
        d: 'You keep your ward and your base. The press keeps the clip.', ok: true },
      { i: 1, t: 'Refuse. You said what you said',
        d: 'They will deploy you somewhere you cannot win.', tag: 'risk', ok: true }
    ];
    if (file || cunning) {
      choices.push({
        i: 2,
        t: file ? 'Put the file on the table' : 'Let him work out what you know',
        d: file
          ? 'Walk out level. Spend the only card you had, and make an enemy for life.'
          : 'You have no file. You have a reputation for having one, which may be enough.',
        tag: 'risk', ok: true
      });
    }

    return {
      id: 'ultimatum', kicker: 'The regional office', ultimatum: true, incId: inc.id,
      title: 'They are not going to let this go',
      body: 'He does not sit down and he does not offer you a chair. “You went for me and you missed. ' +
            'That is a thing that has to be answered for.” There is a statement already typed on the desk between you, ' +
            'in your name, retracting everything. ' +
            (file ? 'In your bag is a folder he does not know you have.' : ''),
      choices: choices
    };
  }

  function leverageOn(S, inc) {
    if (!inc || !inc.dirt) return null;
    return inc.dirt.filter(function (d) { return !d.used; })[0] || null;
  }

  function resolveUltimatum(S, ev, idx) {
    var api = RZ.engine.mkApi(S);
    var inc = RZ.field.byId(S, ev.incId);
    var res = ultimatumOutcome(S, api, inc, idx);
    res.deltas = api.deltas.slice();
    return res;
  }

  function ultimatumOutcome(S, api, inc, idx) {
    var P = S.player;
    var name = inc ? inc.name : 'the chairman';

    if (idx === 0) {
      // Swallow it. You survive, and everybody watched you swallow it.
      api.add('stats.integrity', -25);
      api.add('media', -15);
      api.add('grassroots', -10);
      P.standing.leader = Math.min(P.standing.leader, 5);
      api.add('party', -RZ.range(4, 10));
      if (inc) inc.aggression = Math.max(inc.aggression || 0, 45);
      grant(S, 'pngUntil', 6);
      P.record.push({ year: S.date.year, text: 'Publicly retracted a challenge to ' + name + '.' });
      return {
        title: 'You read it out in front of the cameras', tone: 'bad',
        body: 'Four paragraphs somebody else wrote, about the importance of unity and the regret you feel for ' +
              'remarks that may have been misunderstood. You kept the ward. The clip will be played at you for years, ' +
              'and the people who stood with you watched you do it.'
      };
    }

    if (idx === 1) {
      return exile(S, api, inc);
    }

    // The file. Or the reputation for having one.
    var file = leverageOn(S, inc);
    if (file) {
      file.used = true;
      api.add('stats.cunning', RZ.range(1, 3));
      api.add('stats.integrity', -RZ.range(2, 5));
      if (inc) { inc.aggression = 100; inc.nemesis = true; }
      S.flags.nemesisId = inc ? inc.id : null;
      P.record.push({ year: S.date.year, text: 'Survived a disciplinary hearing that was never minuted.' });
      return {
        title: 'The hearing was adjourned and never reconvened', tone: 'flat',
        body: 'You put the folder on the desk, face down, and said nothing at all about it. He looked at it for a ' +
              'long moment and then said the matter was closed. You keep your ward, your standing and your pride. ' +
              'You have also spent the only card you had, and he now has nothing left to lose with you.'
      };
    }

    // A bluff, on cunning alone.
    var ok = api.roll('cunning', 58);
    if (ok) {
      api.add('stats.cunning', RZ.range(1, 3));
      if (inc) { inc.aggression = 100; inc.nemesis = true; }
      S.flags.nemesisId = inc ? inc.id : null;
      return {
        title: 'He decided not to find out', tone: 'flat',
        body: 'You said one sentence about a company name and let the silence do the rest. You have no idea whether ' +
              'it means anything. He clearly thinks it might, and that was enough to end the meeting. ' +
              'It will not be enough twice.'
      };
    }
    api.add('stats.integrity', -RZ.range(1, 4));
    return exile(S, api, inc, true);
  }

  function exile(S, api, inc, afterBluff) {
    var P = S.player, c = RZ.COUNTRIES[S.countryId];

    P.standing.leader = 0;
    P.standing.party = C100(P.standing.party * 0.2);
    api.add('capital', -Math.min(P.capital, RZ.range(14, 26)));
    api.add('money', -Math.round(Math.max(0, P.money) * RZ.range(0.3, 0.55)));
    api.add('grassroots', RZ.range(1, 4));            // the hardliners respect it
    api.add('stats.grit', RZ.range(1, 3));
    grant(S, 'pngUntil', 12);
    if (inc) { inc.aggression = Math.max(inc.aggression || 0, 80); inc.nemesis = true; }
    S.flags.nemesisId = inc ? inc.id : null;
    S.flags.exiled = true;

    // Deployed somewhere you cannot win. You keep the rung; the ground is gone.
    var away = c.regions.filter(function (r) { return r.id !== P.regionId; });
    if (away.length) {
      var worst = away.slice().sort(function (a, b) {
        return (P.regionSupport[a.id] || 0) - (P.regionSupport[b.id] || 0);
      })[0];
      P.regionId = worst.id;
      P.regionSupport[worst.id] = Math.min(P.regionSupport[worst.id] || 0, RZ.range(3, 9));
      S.flags.exiledTo = worst.id;
    }
    P.record.push({ year: S.date.year, text: 'Deployed to ' + c.regionById[P.regionId].name + ' after a failed challenge.' });

    return {
      title: afterBluff ? 'The bluff was called' : 'You are being deployed',
      tone: 'bad',
      body: (afterBluff
        ? 'He let you finish, then asked you to be specific. You could not be. '
        : 'You did not sign it, and you told him why, at some length. ') +
        'The deployment came through on Thursday: ' + c.regionById[P.regionId].name + ', where the party has never ' +
        'won anything and is not about to. You keep the title. Your branch has been dissolved and reconstituted ' +
        'without you, your donors have stopped answering, and the people who backed you are being removed one at a ' +
        'time. There is a way out of this, and everybody in the building knows what it is.'
    };
  }

  /* =======================================================================
     3. EXECUTIVE BLACKMAIL — the file, traded up
     ======================================================================= */
  function blackmailTarget(S) {
    var tier = RZ.engine.mkApi(S).tier();
    return RZ.field.ours(S).filter(function (r) {
      return r.partyId === S.player.partyId && r.power >= 55 &&
             r.dirt && r.dirt.some(function (d) { return !d.used; });
    }).sort(function (a, b) { return b.power - a.power; })[0] || null;
  }

  function blackmail(S, api) {
    var t = blackmailTarget(S);
    if (!t) return { fail: true, title: 'You have nothing on anybody who matters' };
    var file = leverageOn(S, t);
    file.used = true;

    var rung = RZ.engine.nextRung(S);
    if (!rung) return { fail: true, title: 'There is nothing above you to trade for' };
    // The head of state's office is not in any colleague's gift, whatever the
    // mechanism that fills it. Testing `how === 'auto'` expressed that
    // correctly in the nine countries where the top job is won at an election
    // and got it exactly backwards in the one where it is appointed: in SZ the
    // Prime Ministership is `appoint`, so a single file on a colleague bought
    // it outright, and that one action was the whole reason SZ reached the top
    // office in every career the simulator ran.
    if (rung.id === 'hos') {
      return { fail: true, title: 'That one is not in his gift',
               body: 'He has files of his own and no say at all in who holds that office. Whatever you are ' +
                     'holding over him buys a portfolio, a deployment, or a seat on a board. It does not ' +
                     'buy the top of the building.' };
    }
    if (rung.how === 'auto') return { fail: true, title: 'That one is decided by the country, not by him' };

    api.add('stats.integrity', -RZ.range(6, 12));
    api.add('stats.cunning', RZ.range(2, 4));
    api.add('capital', -RZ.range(4, 9));
    t.aggression = 100; t.nemesis = true;
    S.flags.nemesisId = t.id;
    S.flags.blackmailed = (S.flags.blackmailed || 0) + 1;
    api.dirt('blackmail', 'A promotion obtained by holding a file over ' + t.name, 3);
    RZ.engine.promote(S, t.name + ' recommended you personally, which surprised everybody including him.');

    return {
      title: 'He recommended you himself', tone: 'flat',
      body: 'The conversation took four minutes and neither of you said the thing out loud. His recommendation went ' +
            'in on Monday and the appointment was announced on Friday. You have the seat. You have also burned the ' +
            'only file you had on the one man in this party who now thinks about you every single day.'
    };
  }

  /* =======================================================================
     THE NEMESIS
     An enraged incumbent who does nothing is a broken promise. This is what
     he does with the rest of his career.
     ======================================================================= */
  // By id across the whole field, not only your own party. Crossing the floor
  // is supposed to *end* a nemesis, and it ends it by finding the man and
  // standing him down — which cannot happen if changing your party card has
  // already made him invisible to this lookup.
  function nemesisOf(S) {
    if (!S.flags.nemesisId) return null;
    var n = RZ.field.byId(S, S.flags.nemesisId);
    return (n && n.alive !== false && !n.retired) ? n : null;
  }

  var MOVES = [
    { id: 'branch', w: 10,
      go: function (S, api, n) {
        api.add('grassroots', -RZ.range(2, 6));
        api.add('party', -RZ.range(1, 4));
        return {
          title: n.name + ' has been in your branch again',
          body: 'Two of your ward committee resigned this week and neither would say why on the phone. ' +
                'He is working through them one at a time, and he has more to offer than you do.'
        };
      } },
    { id: 'dig', w: 9,
      go: function (S, api, n) {
        var un = S.player.dirt.filter(function (d) { return !d.exposed; });
        if (un.length && RZ.chance(0.45)) {
          api.exposeDirt(un[0].id);
          return {
            title: 'He found it, and he gave it to a journalist',
            body: 'Something you had stopped worrying about. He has been paying somebody to go through your ' +
                  'branch’s books since the hearing, and they found it.'
          };
        }
        api.dirt('nemesis-' + n.id, 'An allegation circulated by ' + n.name + ', unproven and repeated everywhere', 2);
        return {
          title: 'A story about you is going around',
          body: 'It is not true and it does not need to be. It is being repeated by people who heard it from ' +
                'somebody who heard it from his office.'
        };
      } },
    { id: 'fund', w: 9,
      go: function (S, api, n) {
        api.makeRival();
        api.add('party', -RZ.range(2, 5));
        return {
          title: 'He is funding somebody against you',
          body: 'A younger candidate in your own structure with a sudden and unexplained ability to hire buses. ' +
                'Nobody has said whose money it is and nobody needs to.'
        };
      } },
    { id: 'block', w: 8,
      go: function (S, api, n) {
        api.add('leader', -RZ.range(2, 6));
        api.add('capital', -RZ.range(2, 6));
        return {
          title: 'Your name came off the list again',
          body: 'A delegation, a committee, a study tour — small things, all of them, and all of them decided in ' +
                'a room he sits in. It is not sabotage. It is just that nothing you ask for happens.'
        };
      } }
  ];

  // Called from the monthly loop. He does not act every month, and he is more
  // dangerous the more powerful he is.
  function nemesisTurn(S) {
    var n = nemesisOf(S);
    if (!n) return null;
    if (S.tempo === 'week') return null;                       // not during the campaign
    if (S.flags.nemesisLast !== undefined && monthIndex(S) - S.flags.nemesisLast < 3) return null;
    if (!RZ.chance(0.28 + n.power * 0.003)) return null;

    S.flags.nemesisLast = monthIndex(S);
    var api = RZ.engine.mkApi(S);
    // He has people going through your past every month he is active. The
    // pressure itself is the threat; the events are only where it surfaces.
    S.scandalRisk = Math.min(2.5, (S.scandalRisk || 0) + 0.18 + n.power * 0.002);
    var mv = RZ.weighted(MOVES, function (m) { return m.w; });
    var out = mv.go(S, api, n);

    n.power = clamp(n.power + RZ.range(-2, 3), 5, 100);
    // You cannot wait him out. You can outrank him, and if you have the
    // structures behind you he can be moved sideways.
    var out2 = tryNeutralise(S, n, 'outrank');
    if (out2) return out2;

    RZ.engine.pushFeed(S, {
      kind: 'bad', src: n.name, title: out.title, body: out.body,
      deltas: api.deltas.slice(), tone: 'bad'
    });
    return { move: mv.id, name: n.name };
  }

  // The three ways out, per the design: outrank him, leave the party he has
  // reach in, or break him in public. Waiting is not one of them.
  function tryNeutralise(S, n, how) {
    n = n || nemesisOf(S);
    if (!n) return null;
    var tier = RZ.engine.mkApi(S).tier();
    var done = false, why = '';

    if (how === 'outrank') {
      if (tier >= 9 && RZ.chance(0.35)) {
        done = true;
        why = 'You outrank him now, and rank in this party is the only argument that has ever ended anything. ' +
              'He has been given a parastatal board a long way from any branch of yours.';
      } else if (S.player.standing.party > 70 && RZ.chance(0.10)) {
        done = true;
        why = 'You did not do it directly. You made it obvious to enough people in the structures that it ' +
              'needed doing, and the structures did it.';
      }
    } else if (how === 'defect') {
      done = true;
      why = 'Whatever he had over you was branch machinery, and it is not your branch any more. ' +
            'He cannot reach into another party’s structures, and it is visibly eating him.';
    } else if (how === 'expose') {
      done = true;
      why = 'He resigned on a Thursday, in a statement that used the word "family" four times. ' +
            'The file did what files do.';
    }

    if (!done) return null;
    S.flags.nemesisId = null;
    n.nemesis = false;
    n.aggression = 30;
    S.scandalRisk = Math.max(0, (S.scandalRisk || 0) - 0.6);
    RZ.engine.pushFeed(S, {
      kind: 'good', src: 'The structures',
      title: n.name + ' has stopped being your problem',
      body: why, tone: 'good'
    });
    return { ended: true, how: how, name: n.name };
  }

  RZ.revolt = {
    tryNeutralise: tryNeutralise,
    monthIndex: monthIndex,
    grantMandate: grantMandate, mandateActive: mandateActive, pngActive: pngActive,
    whipped: whipped, whip: whip, unwhip: unwhip,
    canRevolt: canRevolt, revoltOdds: revoltOdds, revolt: revolt, incumbent: incumbent,
    resolveUltimatum: resolveUltimatum,
    blackmailTarget: blackmailTarget, blackmail: blackmail,
    nemesisOf: nemesisOf, nemesisTurn: nemesisTurn, MOVES: MOVES
  };
})();
