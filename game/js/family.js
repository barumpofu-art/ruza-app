/* family.js — the household, which is the one constituency you cannot campaign
   in and cannot resign from.

   Everything else in this game is a ledger you can work on. This one only ever
   asks. A career that rises pulls a household up behind it — more relatives,
   larger obligations, a funeral every second month that everybody expects you
   to carry — and the money for it comes out of the same account the campaign
   does. That is not a side note about African politics, it is most of the
   pressure that makes the rest of the game's compromises make sense.

   Three things live here: what the household costs, what it costs the person
   who married you, and the brother who does not need to be asked twice.
*/
(function () {
  'use strict';
  var clamp = RZ.clamp;

  var TIES = ['brother', 'sister', 'cousin', 'uncle', 'nephew', 'niece'];

  // What each of them is short of. Ordinary, recurring, and impossible to
  // refuse more than twice without becoming a particular kind of person.
  var NEEDS = [
    { id: 'fees',    what: 'school fees for the third term', cost: [0.6, 1.4] },
    { id: 'funeral', what: 'a funeral that the family is expected to carry', cost: [1.0, 2.4] },
    { id: 'car',     what: 'a car, because the taxi to the clinic is two hours', cost: [1.8, 3.6] },
    { id: 'stock',   what: 'stock for a shop that will definitely work this time', cost: [1.2, 2.8] },
    { id: 'medical', what: 'a hospital bill the state scheme would not cover', cost: [1.4, 3.0] },
    { id: 'roof',    what: 'a roof on the house at home, before the rains', cost: [1.0, 2.2] }
  ];

  function init(S) {
    if (S.family) return S.family;
    var c = RZ.COUNTRIES[S.countryId];
    var spouse = RZ.cast.who(S, c, S.player.gender === 'f' ? 'your husband' : 'your wife', '');
    S.family = {
      spouseKey: spouse.key,
      // How much of your absence they will carry before it stops being a
      // marriage and starts being an arrangement.
      patience: Math.round(RZ.range(62, 82)),
      left: false, leftYear: null,
      kin: [], asks: 0, paid: 0, refused: 0,
      askedTurn: -99, pending: null,
      tender: null
    };
    // Two to begin with. The rest attach themselves as you rise.
    addKin(S); addKin(S);
    return S.family;
  }

  function spouse(S) { init(S); return RZ.cast.get(S, S.family.spouseKey); }

  function addKin(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var used = S.family.kin.map(function (k) { return k.tie; });
    var pool = TIES.filter(function (t) { return used.indexOf(t) < 0; });
    if (!pool.length) pool = TIES;
    var tie = RZ.pick(pool);
    var p = RZ.cast.who(S, c, 'your ' + tie, '');
    S.family.kin.push({ key: p.key, tie: tie, given: 0, refused: 0, since: S.date.year });
    return p;
  }

  /* =======================================================================
     WHAT IT COSTS TO BE THE ONE WHO MADE IT
     ======================================================================= */
  // Added to the monthly outgoings in wage units. It is not a tax on winning —
  // it is the reason winning does not make you rich, which is a different and
  // truer thing.
  function drain(S) {
    if (!S.family) return 0;
    var kin = S.family.kin.length;
    var tier = RZ.engine.mkApi(S).tier();
    // Each relative costs more the higher you are, because what they are asking
    // for is scaled to what they think you now have.
    return kin * (0.18 + tier * 0.075) + (S.family.left ? 0 : 0.35);
  }

  /* =======================================================================
     THE PERSON WHO MARRIED A CAREER
     ======================================================================= */
  function monthly(S, span, out) {
    init(S);
    var F = S.family, P = S.player;
    var api = RZ.engine.mkApi(S);
    var tier = api.tier();

    // A household grows to fit the office. Roughly one more person attached to
    // you at every second tier, and they do not detach on the way down.
    var want = Math.min(6, 2 + Math.floor(tier / 2));
    if (F.kin.length < want && RZ.chance(0.10 * span)) addKin(S);

    if (!F.left) {
      // What being married to this costs them: the hours, the travel, and the
      // fact that everybody in the country has an opinion about you. Resting is
      // the only thing that buys it back, which is why rest is not just health.
      var toll = (0.5 + tier * 0.22) * span;
      if (P.health > 72) toll *= 0.6;                 // you are not running yourself down
      if (S.tempo === 'week') toll *= 1.8;            // a campaign is worse than a year
      F.patience = clamp(F.patience - toll + RZ.noise(0.4) * span, 0, 100);

      if (F.patience <= 0 && !F.left) leave(S, api, out);
      else if (!F.left && F.patience < 38 && !S.flags.kitchenTable && !S.pendingScene && RZ.dialogue && RZ.dialogue.byId('kitchen-table')) {
        S.flags.kitchenTable = true;
        RZ.dialogue.summon(S, 'kitchen-table');
      }
    }
    return { patience: F.patience, kin: F.kin.length, left: F.left };
  }

  function mend(S, amount) {
    init(S);
    if (S.family.left) return null;
    S.family.patience = clamp(S.family.patience + amount, 0, 100);
    return S.family.patience;
  }

  function leave(S, api, out) {
    var F = S.family;
    var p = spouse(S);
    var nm = p ? RZ.cast.shortOf(S, p) : 'They';
    F.left = true;
    F.leftYear = S.date.year;
    if (p) {
      p.rel = clamp(p.rel - RZ.range(20, 40), -100, 100);
      RZ.cast.remember(S, p, 'They left in ' + S.date.year, 'bad');
    }
    api.add('media', -RZ.range(1, 4));
    api.add('grassroots', -RZ.range(1, 3));
    api.legacyMark('spouseLeft');
    RZ.engine.pushFeed(S, {
      kind: 'bad', alert: true, src: 'Home',
      title: nm + ' has gone back to ' + (RZ.COUNTRIES[S.countryId].regionById[S.player.regionId] || {}).name,
      body: 'There was no announcement and there will not be one. The house in the capital is yours now, ' +
        'which was always the arrangement on paper. ' + nm + ' put up with eleven years of a diary that had ' +
        'other people in it and stopped putting up with it on an ordinary Tuesday. You were in a committee.',
      deltas: api.deltas.slice(), tone: 'bad'
    });
    if (out) out.spouseLeft = true;
  }

  /* =======================================================================
     THE ASK
     ======================================================================= */
  // Somebody is short of something and you are the one who made it. This is not
  // corruption and it is not charity; it is simply what the money is for.
  function wantsAsk(S) {
    init(S);
    if (S.over || !S.family.kin.length) return false;
    return S.turn - (S.family.askedTurn === undefined ? -99 : S.family.askedTurn) > 8;
  }

  // Stored by key and id rather than by object: `pending` goes into the save,
  // and a saved copy of a person is a second person who stops agreeing with the
  // one in the cast the moment either of them changes.
  function pickAsk(S) {
    init(S);
    var i = Math.floor(RZ.rnd() * S.family.kin.length);
    S.family.pending = { kinIdx: i, needId: RZ.pick(NEEDS).id };
    return readAsk(S);
  }

  function readAsk(S) {
    init(S);
    var pend = S.family.pending;
    if (!pend) return null;
    var k = S.family.kin[pend.kinIdx] || S.family.kin[0];
    if (!k) return null;
    var need = NEEDS.filter(function (n) { return n.id === pend.needId; })[0] || NEEDS[0];
    var p = RZ.cast.get(S, k.key);
    return { kin: k, need: need, person: p, name: p ? RZ.cast.shortOf(S, p) : 'They' };
  }

  function pay(S, api, ask, amount) {
    init(S);
    ask = ask || readAsk(S);
    if (!ask) return null;
    S.family.askedTurn = S.turn;
    S.family.pending = null;
    S.family.paid++;
    ask.kin.given += amount;
    api.add('money', -amount);
    if (ask.person) {
      ask.person.rel = clamp(ask.person.rel + RZ.range(6, 12), -100, 100);
      RZ.cast.remember(S, ask.person, 'You paid for ' + ask.need.what, 'good');
    }
    return ask;
  }

  function refuse(S, api, ask) {
    init(S);
    ask = ask || readAsk(S);
    if (!ask) return null;
    S.family.askedTurn = S.turn;
    S.family.pending = null;
    S.family.refused++;
    ask.kin.refused++;
    if (ask.person) {
      RZ.cast.ding(S, ask.person, RZ.range(8, 16), -60);
      RZ.cast.remember(S, ask.person, 'You said no about ' + ask.need.what, 'bad');
    }
    // Word gets home before you do.
    api.add('grassroots', -RZ.range(0.4, 1.6));
    return ask;
  }

  /* =======================================================================
     THE BROTHER WHO DID NOT NEED TO BE ASKED
     =======================================================================
     The one that actually ends careers. You did not give him the contract. You
     did not have to. Somebody two departments away read the surname and did the
     arithmetic, and now the question is not whether you knew — it is what you
     do on the morning you find out.
  */
  function wantsTender(S) {
    init(S);
    if (S.family.tender || S.over) return false;
    return RZ.engine.mkApi(S).tier() >= 6 && S.family.kin.length > 0;
  }

  function tenderKin(S) {
    init(S);
    var k = S.family.kin[0];
    var p = RZ.cast.get(S, k.key);
    return { kin: k, person: p, name: p ? RZ.cast.shortOf(S, p) : 'A relative',
             full: p ? p.name : 'A relative', tie: k.tie };
  }

  function settleTender(S, kind) {
    init(S);
    S.family.tender = { kind: kind, year: S.date.year };
    return S.family.tender;
  }

  function summary(S) {
    if (!S.family) return null;
    var p = spouse(S);
    return {
      spouse: p ? RZ.cast.shortOf(S, p) : null,
      spouseFull: p ? p.name : null,
      patience: Math.round(S.family.patience),
      left: S.family.left, leftYear: S.family.leftYear,
      kin: S.family.kin.length,
      paid: S.family.paid, refused: S.family.refused,
      tender: S.family.tender,
      read: S.family.left ? 'Gone, and not coming back.'
          : S.family.patience > 70 ? 'Holding, and not by accident.'
          : S.family.patience > 45 ? 'Tired of the diary, and saying so.'
          : S.family.patience > 20 ? 'You are a name on the news in your own house.'
          : 'One more missed anniversary.'
    };
  }

  RZ.family = {
    TIES: TIES, NEEDS: NEEDS,
    init: init, spouse: spouse, addKin: addKin, drain: drain,
    monthly: monthly, mend: mend, leave: leave,
    wantsAsk: wantsAsk, pickAsk: pickAsk, readAsk: readAsk, pay: pay, refuse: refuse,
    wantsTender: wantsTender, tenderKin: tenderKin, settleTender: settleTender,
    summary: summary,
    SUMMONS: ['kitchen-table']
  };
})();
