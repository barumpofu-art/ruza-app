/* constituency.js — the burden of having won.

   An activist is judged on what they say. A Member of Parliament is judged on
   whether the clinic exists. That is a completely different game, and this is
   it: a Trust figure that is the ward's opinion of you, projects that take
   months and can be abandoned halfway, and a lobbying process in which you
   have no chequebook at all — only influence, spent on people who do.

   Nothing here builds a road. You persuade a ministry to build a road, and
   then you wait, and the contractor may or may not still be there in March.
*/
(function () {
  'use strict';
  var C100 = RZ.c100, clamp = RZ.clamp;

  var KINDS = [
    // `serves` is who is standing at the ribbon. A road is for the people who
    // have to get produce to a market; a housing allocation is not.
    { id: 'road',    name: 'a tarred road',        ico: '🛣️', ministry: 'infra',  cost: 14, months: [5, 9], trust: 16,
      serves: { rural: 9, traders: 6, chiefs: 3 } },
    { id: 'clinic',  name: 'a clinic',             ico: '🏥', ministry: 'health', cost: 12, months: [4, 8], trust: 18,
      serves: { rural: 7, labour: 5, middle: 3 } },
    { id: 'school',  name: 'a secondary school',   ico: '🏫', ministry: 'edu',    cost: 13, months: [5, 9], trust: 17,
      serves: { youth: 10, middle: 5, chiefs: -2 } },
    { id: 'water',   name: 'a water reticulation scheme', ico: '🚰', ministry: 'infra', cost: 10, months: [3, 6], trust: 15,
      serves: { rural: 8, traders: 4 } },
    { id: 'power',   name: 'an electrification line', ico: '⚡', ministry: 'mines', cost: 11, months: [4, 7], trust: 13,
      serves: { traders: 8, youth: 5, rural: 4 } },
    { id: 'housing', name: 'a housing allocation', ico: '🏘️', ministry: 'local',  cost: 9,  months: [3, 6], trust: 11,
      serves: { youth: 7, middle: 4, chiefs: -3 } }
  ];
  function kindById(id) { return KINDS.filter(function (k) { return k.id === id; })[0]; }

  function init(S) {
    if (S.ward) return S.ward;
    S.ward = {
      trust: 50, projects: [], delivered: 0, abandoned: 0,
      lastLobby: -99, crises: 0
    };
    return S.ward;
  }

  /* =======================================================================
     WHAT IT COSTS TO ASK
     ======================================================================= */
  // A backbencher has no budget. What they have is standing with people who
  // do, and it is spent, not lent.
  function lobbyCost(S, kind) {
    var P = S.player, c = RZ.COUNTRIES[S.countryId];
    var k = kindById(kind) || KINDS[0];
    var base = k.cost;
    // The whip's price for your obedience is paid back here, in access.
    if (RZ.revolt && RZ.revolt.whipped && RZ.revolt.whipped(S)) base *= 0.6;
    // A rebel in the wilderness is not returning the minister's calls, because
    // the minister is not making them.
    if (S.flags.exiled) base *= 1.8;
    if (P.standing.party < 25) base *= 1.5;
    if (RZ.revolt && RZ.revolt.pngActive(S)) base *= 1.6;
    base *= (1 + c.inst.patronage / 260);
    return Math.round(base);
  }

  function canLobby(S) {
    if (!S.ward) init(S);
    var api = RZ.engine.mkApi(S);
    if (api.tier() < 4) return false;                    // you need the seat first
    if (S.tempo === 'week') return false;                // not mid-campaign
    if (S.turn - S.ward.lastLobby < 3) return false;
    // Nothing left worth asking for is a real state: six kinds, and a
    // long-serving member can have delivered or started all of them.
    if (!needs(S).length) return false;
    return S.ward.projects.filter(function (p) { return p.status === 'building'; }).length < 3;
  }

  // What the ward is short of, worst first, so the choice is a real one.
  function needs(S) {
    init(S);
    var have = {};
    (S.ward.projects || []).forEach(function (p) { if (p.status !== 'abandoned') have[p.kind] = true; });
    return KINDS.filter(function (k) { return !have[k.id]; });
  }

  /* =======================================================================
     STARTING ONE
     ======================================================================= */
  function start(S, api, kindId, opts) {
    init(S);
    opts = opts || {};
    var k = kindById(kindId);
    if (!k) return null;
    var c = RZ.COUNTRIES[S.countryId];

    // Corruption is not a moral abstraction here: it is the probability that
    // the money reaches the site.
    var rot = S.nation.society.corruption / 100;
    var p = {
      id: k.id + '-' + S.turn,
      kind: k.id, name: k.name, ico: k.ico,
      ministry: k.ministry,
      started: S.turn,
      monthsLeft: RZ.irange(k.months[0], k.months[1]) + (opts.rushed ? -1 : 0),
      status: 'building',
      // A contractor chosen on merit turns up. One chosen as a favour is a
      // different proposition, and cheaper to secure.
      risk: clamp(0.03 + rot * 0.11 + (opts.crony ? 0.10 : 0) - (opts.audited ? 0.04 : 0), 0.01, 0.30),
      crony: !!opts.crony,
      trustOnDone: k.trust + (opts.rushed ? -3 : 0)
    };
    S.ward.projects.push(p);
    S.ward.lastLobby = S.turn;
    // The announcement is worth something on its own, which is why so many
    // are announced.
    api.add('grassroots', RZ.range(1.5, 4));
    S.ward.trust = C100(S.ward.trust + RZ.range(2, 5));
    return p;
  }

  /* =======================================================================
     THE MONTHS AFTERWARDS
     ======================================================================= */
  function tick(S, span, out) {
    init(S);
    var w = S.ward, api = null;
    var months = span === undefined ? 1 : span;

    w.projects.forEach(function (p) {
      if (p.status !== 'building') return;

      // The site is abandoned when the money stops arriving. A shock makes
      // that far likelier, which is how a distant commodity price ends up
      // being a half-built clinic in your ward.
      var shocked = S.flags.lastShock !== undefined && S.turn - S.flags.lastShock < 4;
      var chance = p.risk * months * (shocked ? 2.4 : 1);
      if (RZ.chance(chance)) {
        p.status = 'abandoned';
        w.abandoned++;
        api = api || RZ.engine.mkApi(S);
        w.trust = C100(w.trust - RZ.range(9, 16));
        api.add('grassroots', -RZ.range(2, 6));
        api.dirt('stalled-' + p.id, 'A half-built ' + p.kind + ' in your own ' + RZ.COUNTRIES[S.countryId].terms.constituency, 2);
        RZ.engine.pushFeed(S, {
          kind: 'big', alert: true, src: 'Your ' + RZ.COUNTRIES[S.countryId].terms.constituency,
          title: 'The site has been abandoned',
          body: 'The contractor’s people took the generator and the container office on a Sunday and did not come ' +
                'back. What is left is a slab, some reinforcing bar going orange in the rain, and a sign with your ' +
                'name on it that nobody has taken down.' +
                (shocked ? ' Treasury stopped releasing against the vote when the markets turned.' : ''),
          deltas: api.deltas.slice(), tone: 'bad'
        });
        return;
      }

      p.monthsLeft -= months;
      if (p.monthsLeft > 0) return;

      p.status = 'done';
      w.delivered++;
      api = api || RZ.engine.mkApi(S);
      w.trust = C100(w.trust + p.trustOnDone);
      api.add('grassroots', RZ.range(3, 7));
      api.addRegion(S.player.regionId, RZ.range(3, 8));
      api.add('fame', RZ.range(0.5, 2));
      // Somebody specific cuts the ribbon, and somebody specific notices that
      // the money went there instead of where they asked for it.
      var kd = kindById(p.kind);
      if (kd && kd.serves && RZ.blocs) {
        var d = {};
        Object.keys(kd.serves).forEach(function (k) { d[k] = kd.serves[k] * RZ.range(0.6, 1.2); });
        RZ.blocs.move(S, null, d);
      }
      if (p.crony) {
        api.nation('corruption', RZ.range(0.4, 1.4));
        api.add('stats.integrity', -RZ.range(0.5, 2));
      }
      // Delivering the thing you promised is the only way a promise is closed.
      (S.player.promises || []).forEach(function (pr) {
        if (pr.settled) return;
        if (pr.text.toLowerCase().indexOf(p.kind) >= 0 || (pr.kind === 'project' && pr.projectKind === p.kind)) {
          pr.settled = true;
          api.add('stats.integrity', RZ.range(1, 3));
        }
      });
      S.player.record.push({ year: S.date.year, text: 'Opened ' + p.name + ' in the ' + RZ.COUNTRIES[S.countryId].terms.constituency + '.' });
      RZ.engine.pushFeed(S, {
        kind: 'big', src: 'Your ' + RZ.COUNTRIES[S.countryId].terms.constituency,
        title: p.ico + ' ' + cap(p.name) + ' has opened',
        body: 'A ribbon, a tent, four speeches and a great many photographs. The thing exists now, which is a ' +
              'different category of fact from having promised it. People who did not vote for you came anyway.',
        deltas: api.deltas.slice(), tone: 'good'
      });
    });

    // Trust drifts toward what your record actually justifies.
    var target = 50 + w.delivered * 7 - w.abandoned * 9 - openBroken(S) * 6 - w.crises * 3;
    w.trust = C100(w.trust + (clamp(target, 2, 96) - w.trust) * 0.06 * months);

    // And the ward's opinion is what the ballot is made of.
    var home = S.player.regionId;
    S.player.regionSupport[home] = C100(S.player.regionSupport[home] + (w.trust - 50) * 0.022 * months);
  }

  function openBroken(S) {
    return (S.player.promises || []).filter(function (p) { return !p.settled && (p.bites || 0) > 0; }).length;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function summary(S) {
    init(S);
    var w = S.ward;
    return {
      trust: Math.round(w.trust),
      building: w.projects.filter(function (p) { return p.status === 'building'; }),
      done: w.delivered, abandoned: w.abandoned,
      mood: w.trust >= 70 ? 'they will carry you' :
            w.trust >= 55 ? 'they are with you, for now' :
            w.trust >= 40 ? 'they are waiting to see' :
            w.trust >= 25 ? 'they have started saying it out loud' :
                            'they will not vote for you again'
    };
  }

  RZ.ward = {
    KINDS: KINDS, kindById: kindById,
    init: init, tick: tick, start: start, summary: summary,
    canLobby: canLobby, lobbyCost: lobbyCost, needs: needs
  };
})();
