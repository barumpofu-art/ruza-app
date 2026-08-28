/* contender.js — the other one.

   Everything else in this game measures you against a threshold. This measures
   you against a person: somebody who started the same year you did, in the
   same party, with the same ambition and the opposite talent, and who is
   climbing whether or not you spend a month on your health.

   They are generated against your trait, so the thing you are good at is
   precisely the thing they are not, and the thing you cannot do is the thing
   they do easily. A firebrand's contender is a mandarin who has never moved a
   crowd and has never needed to. A schemer's is a firebrand, because you
   cannot blackmail a rally.

   The point is not that they beat you. The point is that a rung you were slow
   about is a rung they are standing on, and that if they reach the top of the
   ladder before you do, the rest of your career is spent underneath somebody
   who knows exactly what you were trying to do.
*/
(function () {
  'use strict';
  var C100 = RZ.c100, clamp = RZ.clamp;

  /* =======================================================================
     WHO THEY ARE
     ======================================================================= */
  // Your opposite, not your equal. The pairing is deliberate: each of these
  // beats the player's trait at the thing the player cannot do.
  var COUNTER = {
    firebrand: 'mandarin',   // you have the hall; he has the minutes of the hall
    mandarin: 'firebrand',   // you have the file; she has forty thousand people
    schemer: 'firebrand',    // a crowd cannot be leaked against
    hustler: 'advocate',     // you have the money; he has the question about it
    advocate: 'hustler',     // you have the credibility; she has the buses
    tycoon: 'advocate'
  };

  // How each kind of contender climbs, and what it looks like when they do.
  var STYLES = {
    firebrand: {
      climbs: 'on crowds',
      pushes: ['grassroots', 'fame'],
      slow: 'party',
      moves: [
        'filled a stadium in {region} on a Tuesday and the footage ran for three days',
        'was carried out of a memorial service on the shoulders of people who had not been told to be there',
        'said the thing about the {currency} that everybody had been thinking and nobody had said'
      ]
    },
    mandarin: {
      climbs: 'on paperwork',
      pushes: ['party', 'leader'],
      slow: 'fame',
      moves: [
        'chaired the subcommittee nobody wanted and came out of it holding the appointments',
        'was thanked by name in a report that decides who runs {region} for five years',
        'has quietly become the person the {leaderTitle}’s office telephones first'
      ]
    },
    hustler: {
      climbs: 'on money',
      pushes: ['party', 'business'],
      slow: 'media',
      moves: [
        'paid for eleven branch conferences and was elected at nine of them',
        'arrived at the {region} conference with four buses and a catering contract',
        'has funded most of the people who will be voting on this'
      ]
    },
    advocate: {
      climbs: 'on credibility',
      pushes: ['media', 'intl'],
      slow: 'party',
      moves: [
        'won the case everybody said could not be won and did the interview afterwards',
        'refused a portfolio in public and gained more from refusing it than the portfolio was worth',
        'is now the person the papers ring for a quotation about people like you'
      ]
    },
    tycoon: {
      climbs: 'on ownership',
      pushes: ['business', 'party'],
      slow: 'grassroots',
      moves: [
        'bought the printing house that does every ballot paper in {region}',
        'put a foundation into six {constituency} offices, all of them marginal',
        'no longer needs the party’s money and everybody in the room knows it'
      ]
    }
  };

  function styleOf(t) { return STYLES[t] || STYLES.mandarin; }

  /* =======================================================================
     MAKING ONE
     ======================================================================= */
  function init(S) {
    if (S.contender) return S.contender;
    var c = RZ.COUNTRIES[S.countryId];
    var P = S.player;
    var trait = COUNTER[P.trait] || 'mandarin';
    var tr = RZ.TRAITS[trait] || {};
    // Same party unless the country only has one worth being in — an internal
    // race is a sharper story than a race across the aisle, and the ladder is
    // an internal one for most of its length.
    var sameParty = c.parties.length < 2 || RZ.chance(0.72);
    var otherParties = c.parties.filter(function (p) { return p.id !== P.partyId; });
    var partyId = sameParty || !otherParties.length ? P.partyId : RZ.pick(otherParties).id;
    // Somewhere else, so the map has two centres of gravity in it.
    var elsewhere = c.regions.filter(function (r) { return r.id !== P.regionId; });
    var npc = RZ.makeNpc(c, {
      partyId: partyId,
      regionId: (elsewhere.length ? RZ.pick(elsewhere) : c.regions[0]).id,
      power: Math.round(RZ.range(30, 48))
    });

    S.contender = {
      id: npc.id, name: npc.name, trait: trait,
      traitName: tr.name || 'Operator', ico: tr.ico || '🎯',
      regionId: npc.regionId, partyId: partyId, sameParty: partyId === P.partyId,
      rungIdx: 0, progress: 0,
      // Competence is fixed at creation and is the whole difficulty dial: a
      // weak contender is scenery, a strong one is the game.
      drive: RZ.range(0.72, 1.30),
      power: npc.power,
      relation: 'none',            // none | allied | hostile
      met: false, beatenYouTo: 0, youBeatThemTo: 0,
      lastMove: null, lastMoveTurn: -99,
      dirt: [], ascended: false
    };
    return S.contender;
  }

  function get(S) { return S.contender || null; }
  function rungOf(S, ct) {
    var lad = RZ.ladderFor(S.countryId);
    return lad[Math.min(ct.rungIdx, lad.length - 1)];
  }
  function tierOf(S, ct) { return rungOf(S, ct).tier; }
  function ahead(S) {
    var ct = get(S);
    return ct ? ct.rungIdx - S.player.rungIdx : 0;
  }

  /* =======================================================================
     THEIR TURN
     ======================================================================= */
  // What it costs them to take the next step. The higher the rung, the longer
  // it takes, which is the same shape the player's own climb has.
  function stepCost(S, ct) {
    var lad = RZ.ladderFor(S.countryId);
    var next = lad[ct.rungIdx + 1];
    if (!next) return Infinity;
    return 8 + next.tier * 5.5;
  }

  // The rate they climb at. Three things move it: their own drive, whether the
  // player is standing on the rung they want, and how visible the player has
  // made themselves — a contender gains most when nobody is watching them.
  function rate(S, ct) {
    var P = S.player;
    var r = ct.drive;
    // Directly blocked: you are on the rung above and not moving off it.
    if (ct.rungIdx + 1 === P.rungIdx) r *= 0.55;
    // You are miles ahead and they are climbing in your shadow.
    if (P.rungIdx - ct.rungIdx >= 3) r *= 1.35;
    // You are miles behind and they have stopped thinking about you.
    if (ct.rungIdx - P.rungIdx >= 3) r *= 0.82;
    // Attention is finite. A player nobody is talking about is a player whose
    // contender is being talked about instead.
    r *= clamp(1.35 - P.fame / 150, 0.75, 1.35);
    // An ally slows down for you. An enemy does not.
    if (ct.relation === 'allied') r *= 0.72;
    if (ct.relation === 'hostile') r *= 1.12;
    // Whatever you are holding over them.
    r *= clamp(1 - ct.dirt.length * 0.18, 0.5, 1);
    return r;
  }

  function tick(S, span, out) {
    var ct = get(S);
    if (!ct || S.over) return null;
    var lad = RZ.ladderFor(S.countryId);
    var res = { climbed: false, move: null };

    if (ct.rungIdx >= lad.length - 1) { res.top = true; return res; }

    ct.progress += rate(S, ct) * span * RZ.range(0.7, 1.35);
    ct.power = clamp(ct.power + RZ.range(-1.2, 1.6) * span, 8, 100);

    if (ct.progress >= stepCost(S, ct)) {
      ct.progress = 0;
      ct.rungIdx++;
      res.climbed = true;
      res.rung = lad[ct.rungIdx];
      if (ct.rungIdx > S.player.rungIdx) ct.beatenYouTo++;
      // The last rung gets one card, not two: the swearing-in says everything
      // the promotion card would have said and says it much louder.
      if (ct.rungIdx >= lad.length - 1) ascend(S, ct, out);
      else announceClimb(S, ct, res.rung);
    } else if (RZ.chance(0.16 * span) && S.turn - ct.lastMoveTurn > 5) {
      res.move = doMove(S, ct);
    }

    if (out) out.contender = res;
    return res;
  }

  function announceClimb(S, ct, rung) {
    var behind = ct.rungIdx > S.player.rungIdx;
    RZ.engine.pushFeed(S, {
      kind: behind ? 'bad' : 'flat',
      src: ct.sameParty ? 'The structures' : RZ.COUNTRIES[S.countryId].partyById[ct.partyId].abbr,
      title: ct.name + ' is now ' + rung.title,
      body: (behind
        ? 'Announced at four o’clock with a photograph you have already seen twice. They are above you now, ' +
          'and every room you walk into for the next while will have somebody in it who has just come from theirs.'
        : 'A step you took some time ago, taken by somebody who started when you did. They are still behind you. ' +
          'They are not as far behind you as they were.'),
      tone: behind ? 'bad' : 'flat'
    });
  }

  // Something visible that is not a promotion. This is most of what they do:
  // the drumbeat that makes the number on the screen feel like a person.
  function doMove(S, ct) {
    var c = RZ.COUNTRIES[S.countryId];
    var st = styleOf(ct.trait);
    var line = RZ.pick(st.moves)
      .replace('{region}', c.regionById[ct.regionId].name)
      .replace('{currency}', c.cur.name || 'currency')
      .replace('{leaderTitle}', c.terms.leaderTitle || 'leader')
      .replace('{constituency}', c.terms.constituency);
    ct.lastMove = line;
    ct.lastMoveTurn = S.turn;
    ct.power = clamp(ct.power + RZ.range(2, 6), 8, 100);

    // It costs the player something real, in the currency the contender trades in.
    var api = RZ.engine.mkApi(S);
    st.pushes.forEach(function (k) {
      if (k === 'fame') api.add('fame', -RZ.range(0.5, 2));
      else api.add(k, -RZ.range(0.8, 2.6));
    });

    RZ.engine.pushFeed(S, {
      kind: 'flat', src: ct.name,
      title: ct.name + ' ' + line.split(' ').slice(0, 6).join(' ') + '…',
      body: cap(ct.name + ' ' + line + '.') + ' Nobody has said anything about you this week, which is ' +
            'not the same as nothing having happened to you.',
      tone: 'flat'
    });
    return line;
  }
  function cap(x) { return x.charAt(0).toUpperCase() + x.slice(1); }

  /* =======================================================================
     IF THEY GET THERE FIRST
     ======================================================================= */
  // The endgame flips. You are not climbing towards an empty office any more;
  // you are working underneath somebody who watched you try.
  function ascend(S, ct, out) {
    if (ct.ascended) return;
    ct.ascended = true;
    ct.relation = 'hostile';
    var c = RZ.COUNTRIES[S.countryId];
    S.flags.contenderPresident = true;
    S.nation.presidentName = ct.name;
    S.nation.presidentParty = ct.partyId;
    S.nation.termNumber = 1;
    S.player.isPresident = false;
    if (S.nation.govParties.indexOf(ct.partyId) < 0) S.nation.govParties = [ct.partyId];

    // They become the incumbent for every mechanic that already knows what an
    // incumbent is, rather than a second thing the code has to remember.
    var npc = RZ.field.addRival(S, 92);
    npc.name = ct.name;
    npc.regionId = ct.regionId;
    npc.partyId = ct.partyId;
    npc.role = cap(c.terms.hos);
    npc.aggression = 100;
    npc.nemesis = true;
    npc.incumbent = true;
    ct.id = npc.id;
    S.flags.nemesisId = npc.id;

    RZ.engine.pushFeed(S, {
      kind: 'big', alert: true, src: c.capital,
      title: ct.name + ' has been sworn in as ' + cap(c.terms.hos),
      body: 'You were in the third row, which is where the cameras find you when they are panning. ' +
            'The two of you started in the same year and there is now a ceiling in this country with a ' +
            'name on it. Everything from here is either done with their permission or done to them.',
      tone: 'bad'
    });
    if (out) out.contenderAscended = true;
    if (RZ.dialogue) RZ.dialogue.summon(S, 'contender-throne');
  }

  /* =======================================================================
     WHAT YOU CAN DO ABOUT THEM
     ======================================================================= */
  function canApproach(S) {
    var ct = get(S);
    return !!(ct && !ct.ascended && ct.relation !== 'allied');
  }

  // An alliance is real and it is not free: they slow down for you, and they
  // are standing next to you in every photograph afterwards.
  function ally(S, api) {
    var ct = get(S);
    if (!ct) return null;
    ct.relation = 'allied';
    api.add('party', RZ.range(4, 9));
    api.add('leader', -RZ.range(1, 4));
    return ct;
  }
  function turnHostile(S) {
    var ct = get(S);
    if (!ct) return null;
    ct.relation = 'hostile';
    return ct;
  }
  // Something on them. Each file is a permanent brake on their climb, which is
  // the only lever that works on somebody who does not want anything you have.
  function fileOn(S, label) {
    var ct = get(S);
    if (!ct) return null;
    ct.dirt.push({ label: label || 'A file nobody has asked for yet', turn: S.turn });
    return ct;
  }
  function spendFile(S, api) {
    var ct = get(S);
    if (!ct || !ct.dirt.length) return null;
    ct.dirt.pop();
    ct.progress = Math.max(0, ct.progress - RZ.range(10, 24));
    ct.power = clamp(ct.power - RZ.range(10, 26), 8, 100);
    ct.relation = 'hostile';
    api.add('media', RZ.range(2, 6));
    api.add('stats.integrity', -RZ.range(1, 4));
    // Knocked far enough back to lose the rung they were standing on.
    var demoted = false;
    if (ct.power < 26 && ct.rungIdx > 0 && RZ.chance(0.45)) { ct.rungIdx--; demoted = true; }
    return { contender: ct, demoted: demoted };
  }

  /* =======================================================================
     FOR THE SCREEN
     ======================================================================= */
  function summary(S) {
    var ct = get(S);
    if (!ct) return null;
    var lad = RZ.ladderFor(S.countryId);
    var rung = rungOf(S, ct);
    var gap = ahead(S);
    return {
      name: ct.name, ico: ct.ico, traitName: ct.traitName,
      title: rung.title, tier: rung.tier,
      regionName: RZ.COUNTRIES[S.countryId].regionById[ct.regionId].name,
      sameParty: ct.sameParty, relation: ct.relation,
      gap: gap,
      standing: gap > 0 ? 'ahead of you' : gap < 0 ? 'behind you' : 'level with you',
      climbs: styleOf(ct.trait).climbs,
      files: ct.dirt.length,
      pct: Math.round((100 * ct.rungIdx) / Math.max(1, lad.length - 1)),
      yourPct: Math.round((100 * S.player.rungIdx) / Math.max(1, lad.length - 1)),
      ascended: !!ct.ascended,
      lastMove: ct.lastMove
    };
  }

  // Scenes this module sends somebody to find you with.
  var SUMMONS = ['contender-throne'];

  RZ.contender = {
    COUNTER: COUNTER, STYLES: STYLES, SUMMONS: SUMMONS,
    init: init, get: get, tick: tick, summary: summary,
    ahead: ahead, tierOf: tierOf, rungOf: rungOf, rate: rate, stepCost: stepCost,
    canApproach: canApproach, ally: ally, turnHostile: turnHostile,
    fileOn: fileOn, spendFile: spendFile
  };
})();
