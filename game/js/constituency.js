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
    var t = RZ.engine.mkApi(S).tier();

    // A Member who does not go home is not a rumour. The borehole keeps count.
    if (t >= 4 && t <= 8 && !S.player.isPresident && S.tempo !== 'week') {
      var lastHome = w.lastFriday !== undefined ? w.lastFriday
                   : (w.fridayClock !== undefined ? w.fridayClock : (w.fridayClock = S.turn));
      if (S.turn - lastHome >= 2) {
        w.missedFriday = (w.missedFriday || 0) + months;
        w.trust = C100(w.trust - RZ.range(3, 6) * months);
      }
    }

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
        stamp(S, p.kind, 'broken');
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
      stamp(S, p.kind, 'kept');
      S.player.record.push({ year: S.date.year, text: 'Opened ' + p.name + ' in the ' + RZ.COUNTRIES[S.countryId].terms.constituency + '.' });
      S.flags.ribbon = { kind: p.kind, name: p.name, ico: p.ico, crony: !!p.crony };
      if (!S.pendingScene && RZ.dialogue && RZ.dialogue.byId('ribbon-day')) {
        RZ.dialogue.summon(S, 'ribbon-day');
      } else {
        RZ.engine.pushFeed(S, {
          kind: 'big', src: 'Your ' + RZ.COUNTRIES[S.countryId].terms.constituency,
          title: p.ico + ' ' + cap(p.name) + ' has opened',
          body: 'A ribbon, a tent, four speeches and a great many photographs. The thing exists now, which is a ' +
                'different category of fact from having promised it. People who did not vote for you came anyway.',
          deltas: api.deltas.slice(), tone: 'good'
        });
      }
    });

    // Trust drifts toward what your record actually justifies.
    var target = 50 + w.delivered * 7 - w.abandoned * 9 - openBroken(S) * 6 - w.crises * 3;
    w.trust = C100(w.trust + (clamp(target, 2, 96) - w.trust) * 0.06 * months);

    // And the ward's opinion is what the ballot is made of.
    var home = S.player.regionId;
    S.player.regionSupport[home] = C100(S.player.regionSupport[home] + (w.trust - 50) * 0.022 * months);

    if (S.flags.ribbon && !S.pendingScene && RZ.dialogue && RZ.dialogue.byId('ribbon-day')) {
      RZ.dialogue.summon(S, 'ribbon-day');
    }

    if (!S.pendingScene && yearLive(S) && RZ.chance(0.14 * months) &&
        RZ.dialogue && RZ.dialogue.byId('the-year')) {
      S.flags.yearKind = pickYearKind(S);
      S.flags.yearRoom = S.date.year;
      RZ.dialogue.summon(S, 'the-year');
    }
  }

  function fridayMatter(S) {
    var c = RZ.COUNTRIES[S.countryId] || {};
    var table = {
      BW: { a: 'the public wage they have not paid', b: 'a standpipe the mine still has not connected', job: 'the kgotla' },
      ZA: { a: 'the hostel lights that went in March', b: 'a metro that has not collected in three months', job: 'the branch' },
      ZW: { a: 'mealie meal at the party price', b: 'forex for the clinic fridge', job: 'the cell' },
      ZM: { a: 'load shedding at the clinic', b: 'the copper bonus that never came', job: 'the section' },
      NA: { a: 'the farm gate and who holds it', b: 'water for the location', job: 'the branch' },
      MW: { a: 'the tobacco floor', b: 'the lake clinic boat', job: 'the branch' },
      MZ: { a: 'the neighbourhood cell', b: 'the road the rains took', job: 'the cell' },
      LS: { a: 'the textile shift', b: 'the mountain clinic', job: 'the pitso' },
      SZ: { a: 'the tinkhundla list', b: 'the king\'s field', job: 'the umphakatsi' },
      AO: { a: 'the kwanza in the market', b: 'the oil neighbourhood that still has no water', job: 'the cell' }
    };
    var row = table[c.id];
    if (row) return row;
    var issues = c.issues || [];
    return {
      a: issues[0] || 'the clinic',
      b: issues[1] || 'the borehole',
      job: (c.terms && c.terms.ward) || 'the ward'
    };
  }

  function yearLive(S) {
    if (!S.player || S.player.isPresident) return false;
    if (S.tempo === 'week') return false;
    var t = RZ.engine.mkApi(S).tier();
    if (t < 4 || t > 12) return false;
    if (S.flags && S.flags.yearRoom === S.date.year) return false;
    if (S.date.month < 5 || S.date.month > 10) return false;
    return true;
  }

  function pickYearKind(S) {
    var t = RZ.engine.mkApi(S).tier();
    var gov = S.parties[S.player.partyId] && S.parties[S.player.partyId].gov;
    if (t >= 8 && gov) return 'commission';
    if (t >= 7) return 'byelection';
    if (t >= 5) return 'list';
    return 'funeral';
  }

  function openBroken(S) {
    return (S.player.promises || []).filter(function (p) { return !p.settled && (p.bites || 0) > 0; }).length;
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* =======================================================================
     THE LEDGER
     Three things you said you would do. Election night reads the stamps.
     ======================================================================= */
  var MANIFESTO = [
    { id: 'clinic', kind: 'clinic', text: 'A clinic that actually has drugs in it' },
    { id: 'school', kind: 'school', text: 'A secondary school that opens on time' },
    { id: 'road',   kind: 'road',   text: 'A tarred road out of the ward' },
    { id: 'water',  kind: 'water',  text: 'Water that runs more than twice a week' },
    { id: 'jobs',   kind: 'jobs',   text: 'Work for the young people who have stopped asking' },
    { id: 'wages',  kind: 'wages',  text: 'Nurses and teachers paid on the date they were promised' },
    { id: 'housing',kind: 'housing',text: 'A housing list that is not a family tree' },
    { id: 'power',  kind: 'power',  text: 'Light that stays on after six' }
  ];
  function manifestoById(id) {
    return MANIFESTO.filter(function (m) { return m.id === id; })[0] || null;
  }

  function initManifesto(S) {
    if (S.manifesto && S.manifesto.items) return S.manifesto;
    S.manifesto = { items: [], year: S.date.year };
    return S.manifesto;
  }

  function hasManifesto(S) {
    return !!(S.manifesto && S.manifesto.items && S.manifesto.items.length >= 3);
  }

  function pickManifesto(S, id) {
    initManifesto(S);
    if (S.manifesto.items.some(function (x) { return x.id === id; })) return S.manifesto;
    var def = manifestoById(id);
    if (!def) return S.manifesto;
    if (S.manifesto.items.length >= 3) return S.manifesto;
    S.manifesto.items.push({
      id: def.id, kind: def.kind, text: def.text,
      status: 'open', year: S.date.year, month: S.date.month
    });
    return S.manifesto;
  }

  function stamp(S, kind, status) {
    if (!S.manifesto || !S.manifesto.items) return;
    S.manifesto.items.forEach(function (it) {
      if (it.kind !== kind) return;
      if (it.status === 'kept' && status !== 'broken') return;
      it.status = status;
    });
  }

  function ageManifesto(S) {
    if (!hasManifesto(S)) return;
    var now = S.date.year * 12 + S.date.month;
    S.manifesto.items.forEach(function (it) {
      if (it.status !== 'open') return;
      var age = now - (it.year * 12 + it.month);
      if (age >= 18) it.status = 'late';
    });
  }

  function ledger(S) {
    init(S);
    ageManifesto(S);
    var items = (S.manifesto && S.manifesto.items) || [];
    var kept = items.filter(function (i) { return i.status === 'kept'; }).length;
    var broken = items.filter(function (i) { return i.status === 'broken'; }).length;
    var late = items.filter(function (i) { return i.status === 'late'; }).length;
    var open = items.filter(function (i) { return i.status === 'open'; }).length;
    return {
      items: items, kept: kept, broken: broken, late: late, open: open,
      trust: Math.round((S.ward && S.ward.trust) || 50),
      delivered: (S.ward && S.ward.delivered) || 0,
      abandoned: (S.ward && S.ward.abandoned) || 0
    };
  }

  // What the ballot actually reads, on top of the machine.
  function incumbentSwing(S) {
    init(S);
    var led = ledger(S);
    var n = (led.trust - 50) * 0.28;
    n += led.kept * 4;
    n -= led.broken * 6;
    n -= led.late * 2;
    n += led.delivered * 2.5;
    n -= led.abandoned * 4;
    return n;
  }

  function markFriday(S) {
    init(S);
    S.ward.lastFriday = S.turn;
    S.ward.missedFriday = 0;
    S.ward.trust = C100(S.ward.trust + RZ.range(3, 7));
  }

  function duty(S) {
    var t = RZ.engine.mkApi(S).tier();
    var P = S.player;
    if (P.isPresident || t >= 13) {
      var sonaDue = S.date.month === 2 && S.flags.sonaYear !== S.date.year;
      if (sonaDue) {
        return { id: 'address', ico: '📺', title: 'State of the Nation',
          blurb: 'The holding room first. The speech is the last beat.' };
      }
      var supplyDue = RZ.state && RZ.state.minorityLive && RZ.state.minorityLive(S) &&
                      S.flags.supplyYear !== S.date.year;
      if (supplyDue) {
        return { id: 'supply', ico: '🤝', title: 'Sit a supply meeting',
          blurb: 'The House lives on a letter. Sit it, or Tuesday sits you.' };
      }
      var confDue = RZ.state && RZ.state.conferenceDefenceLive && RZ.state.conferenceDefenceLive(S);
      if (confDue) {
        return { id: 'conference', ico: '🎤', title: 'Sit the conference',
          blurb: 'The hall is the vote. Keep it, make way, or the buses take it.' };
      }
      var partnerDue = RZ.state && RZ.state.partnerLive && RZ.state.partnerLive(S) &&
                       S.flags.partnerYear !== S.date.year;
      if (partnerDue) {
        return { id: 'partner', ico: '✒️', title: 'Sit the partner',
          blurb: 'The photograph is a meeting. A paper, a chair, or they walk.' };
      }
      var taxDue = S.date.month === 10 && S.flags.taxYear !== S.date.year;
      if (taxDue) {
        return { id: 'tax', ico: '📑', title: 'Sit with Finance on the package',
          blurb: 'One conversation a year. Not thirty taxes.' };
      }
      return { id: 'brief', ico: '📁', title: 'Take the briefing',
        blurb: 'The cabinet has already decided. You have the minute.' };
    }
    if (t >= 11) {
      return { id: 'budget', ico: '💰', title: 'Chair the estimates',
        blurb: 'The ministers have already decided. You have the chair. He has the pen.' };
    }
    if (t >= 6 && P.ministry && !P.isPresident) {
      return { id: 'ministry', ico: '🏛️', title: 'Sit the ministry',
        blurb: 'A director-general, a union, and a tender. This is the job.' };
    }
    if (t >= 4) {
      return { id: 'friday', ico: '🚗', title: 'Constituency Friday',
        blurb: 'The borehole does not know you have a diary in the capital.' };
    }
    if (t <= 1) {
      return { id: 'chairs', ico: '🪑', title: 'Carry the chairs',
        blurb: 'Nobody thanks you. Somebody notices.' };
    }
    return { id: 'walkabout', ico: '👣', title: 'Hold a meeting',
      blurb: 'Sit with people until it hurts.' };
  }

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
    KINDS: KINDS, kindById: kindById, MANIFESTO: MANIFESTO,
    SUMMONS: ['ribbon-day', 'manifesto-desk', 'the-year'],
    init: init, tick: tick, start: start, summary: summary,
    canLobby: canLobby, lobbyCost: lobbyCost, needs: needs,
    initManifesto: initManifesto, hasManifesto: hasManifesto,
    pickManifesto: pickManifesto, stamp: stamp, ledger: ledger,
    incumbentSwing: incumbentSwing, markFriday: markFriday, duty: duty,
    fridayMatter: fridayMatter, yearLive: yearLive, pickYearKind: pickYearKind
  };
})();
