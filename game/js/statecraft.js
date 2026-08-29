/* statecraft.js — the tiers where the job changes.

   A backbencher worries about a clinic. A minister worries about a budget
   vote and whether the President has been asking about him. A deputy worries
   about the succession. A President worries about the treasury, the generals,
   and the people he himself appointed.

   Nothing here is an alert card. Every crisis summons a named person into a
   room with you, through the same dialogue engine everything else uses.
*/
(function () {
  'use strict';
  var C100 = RZ.c100, clamp = RZ.clamp;

  function monthIndex(S) { return S.date.year * 12 + S.date.month; }
  function tierOf(S) { return RZ.engine.mkApi(S).tier(); }

  /* =======================================================================
     THE CABINET
     Once you appoint people, they are the government — and they have their
     own reasons for being in it. A leak is a room, a reshuffle is a room,
     and the table on the Nation pane is the same six people you keep meeting.
     ======================================================================= */
  function initCabinet(S) {
    if (S.cabinet) return S.cabinet;
    S.cabinet = [];
    return S.cabinet;
  }

  function sitsInCabinet(S) {
    var t = tierOf(S);
    var st = S.parties[S.player.partyId];
    return !!(S.player.isPresident || (t >= 6 && st && st.gov));
  }

  function playerMinistryId(S) {
    var name = S.player.ministry;
    if (!name) return null;
    var list = RZ.COUNTRIES[S.countryId].ministries || [];
    var m = list.filter(function (x) { return x.name === name || x.id === name; })[0];
    return m ? m.id : null;
  }

  function ministryById(S, id) {
    return (RZ.COUNTRIES[S.countryId].ministries || []).filter(function (x) { return x.id === id; })[0] || null;
  }

  function ministryName(S, id) {
    var m = ministryById(S, id);
    return m ? m.name : id;
  }

  function ministryKind(S, id) {
    var m = ministryById(S, id);
    return (m && m.kind) || 'service';
  }

  function ministerRole(S, id) { return 'Minister of ' + ministryName(S, id); }
  function ministerOrg(id) { return id === 'fin' ? 'the Treasury' : ''; }

  function fillCabinet(S) {
    initCabinet(S);
    var c = RZ.COUNTRIES[S.countryId];
    if (S.cabinet.length) return S.cabinet;
    var skip = playerMinistryId(S);
    var list = (c.ministries || []).filter(function (m) {
      return !(skip && m.id === skip && !S.player.isPresident);
    });
    // One of each kind first, so the briefing can bring the person whose
    // number is on top of the folder — Health, not a second security chair.
    var seen = {}, pick = [];
    list.forEach(function (m) {
      var k = m.kind || 'service';
      if (!seen[k]) { seen[k] = true; pick.push(m); }
    });
    list.forEach(function (m) {
      if (pick.indexOf(m) < 0) pick.push(m);
    });
    pick.slice(0, 6).forEach(function (m) {
      S.cabinet.push(makeMinister(S, m.id));
    });
    return S.cabinet;
  }

  function makeMinister(S, ministryId, opts) {
    var c = RZ.COUNTRIES[S.countryId];
    opts = opts || {};
    var role = ministerRole(S, ministryId);
    var partyId = opts.partyId || S.player.partyId;
    var org = (partyId && partyId !== S.player.partyId) ? partyId : ministerOrg(ministryId);
    var p;
    if (RZ.cast) {
      p = (opts.replace && partyId === S.player.partyId && RZ.cast.succeed)
        ? RZ.cast.succeed(S, c, role, org)
        : RZ.cast.who(S, c, role, org);
    } else {
      p = RZ.makeNpc(c, { partyId: partyId });
    }
    return {
      id: p.key || p.id,
      name: p.name,
      ministryId: ministryId,
      partyId: partyId,
      regionId: opts.regionId || S.player.regionId,
      // The three numbers that make a cabinet a problem rather than a team.
      competence: opts.competence !== undefined ? opts.competence : Math.round(RZ.range(20, 85)),
      loyalty: opts.loyalty !== undefined ? opts.loyalty : Math.round(RZ.range(25, 85)),
      corruption: opts.corruption !== undefined ? opts.corruption : Math.round(RZ.range(15, 80)),
      months: 0
    };
  }

  function byMinistry(S, id) {
    return (S.cabinet || []).filter(function (m) { return m.ministryId === id; })[0] || null;
  }

  function dropMinister(S, ministryId, opts) {
    fillCabinet(S);
    var i = -1;
    S.cabinet.forEach(function (m, k) { if (m.ministryId === ministryId) i = k; });
    if (i < 0) return null;
    var gone = S.cabinet[i];
    S.cabinet[i] = makeMinister(S, ministryId, Object.assign({ replace: true }, opts || {}));
    S.flags.cabinetDropped = (S.flags.cabinetDropped || 0) + 1;
    return { gone: gone, next: S.cabinet[i] };
  }

  function choppingBlock(S) {
    fillCabinet(S);
    if (!S.cabinet.length) return null;
    var byLoy = S.cabinet.slice().sort(function (a, b) { return a.loyalty - b.loyalty; });
    var byRot = S.cabinet.slice().sort(function (a, b) { return b.corruption - a.corruption; });
    var cut = byLoy[0];
    var rot = byRot[0];
    if (rot === cut) rot = byRot[1] || byLoy[1] || cut;
    S.flags.cabinetCut = cut.ministryId;
    S.flags.cabinetRot = rot.ministryId;
    return { cut: cut, rot: rot };
  }

  function pairRow(S) {
    fillCabinet(S);
    if (!S.cabinet || S.cabinet.length < 2) return null;
    var left = S.cabinet[0], right = S.cabinet[1];
    for (var i = 0; i < S.cabinet.length; i++) {
      for (var j = i + 1; j < S.cabinet.length; j++) {
        if (ministryKind(S, S.cabinet[i].ministryId) !== ministryKind(S, S.cabinet[j].ministryId)) {
          left = S.cabinet[i]; right = S.cabinet[j];
          i = S.cabinet.length;
          break;
        }
      }
    }
    S.flags.rowLeft = left.ministryId;
    S.flags.rowRight = right.ministryId;
    return { left: left, right: right };
  }

  /* =======================================================================
     THE FILE — what the country actually is, this month
     A president does not need six hundred numbers. They need the worst one,
     the province that is hottest, and the minister who is already writing
     a different minute. That is the briefing.
     ======================================================================= */
  var KIND_FOR_WORST = {
    unrest: 'power', debt: 'money', jobless: 'service',
    health: 'service', infra: 'money', rot: 'prestige'
  };

  function hottestRegion(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var worst = c.regions[0], worstV = 999;
    c.regions.forEach(function (r) {
      var v = S.player.regionSupport[r.id];
      if (v === undefined) v = 0;
      if (v < worstV) { worstV = v; worst = r; }
    });
    return { id: worst.id, name: worst.name, support: Math.round(worstV) };
  }

  function houseFile(S) {
    fillCabinet(S);
    var n = S.nation;
    var items = [
      { k: 'unrest',  label: 'Unrest',        v: n.society.unrest,       worse: 'high' },
      { k: 'debt',    label: 'Debt',          v: n.economy.debt,         worse: 'high' },
      { k: 'jobless', label: 'Unemployment',  v: n.economy.unemployment, worse: 'high' },
      { k: 'health',  label: 'Clinics',       v: n.society.health,       worse: 'low'  },
      { k: 'infra',   label: 'Roads',         v: n.society.infra,        worse: 'low'  },
      { k: 'rot',     label: 'Corruption',    v: n.society.corruption,   worse: 'high' }
    ];
    items.forEach(function (it) {
      it.score = it.worse === 'high' ? it.v : (100 - it.v);
      it.shown = it.k === 'debt' ? Math.round(it.v) + '% of GDP' : Math.round(it.v) + '';
    });
    items.sort(function (a, b) { return b.score - a.score; });
    var plotter = (S.cabinet || []).slice().sort(function (a, b) { return a.loyalty - b.loyalty; })[0] || null;
    return {
      worst: items[0],
      items: items.slice(0, 4),
      plotter: plotter,
      hot: hottestRegion(S),
      approval: Math.round(n.govApproval),
      growth: n.economy.growth,
      project: liveProject(S),
      opp: S.opposition || null,
      other: otherOppositionParty(S),
      partner: S.partner || null,
      quote: partnerQuote(S),
      challenger: S.challenger || null,
      twoCentre: !!(S.flags && S.flags.twoCentre),
      power: S.flags.powerId ? powerOf(S, S.flags.powerId) : null,
      coalition: (function () {
        var talks = S.flags && S.flags.coalitionTalks;
        var parties = talks ? [S.player.partyId] : (S.nation.govParties || []).slice();
        var seats = govSeats(S);
        var need = houseNeed(S);
        var out = {
          pending: !!talks,
          kind: talks ? null : (S.flags.coalitionKind || (parties.length > 1 ? 'coalition' : null)),
          parties: parties,
          seats: seats,
          need: need,
          paper: S.flags.supplyYear === S.date.year,
          minority: !talks && seats < need
        };
        if (talks) { out.gnu = talks.gnu; out.king = talks.king; }
        return out;
      })()
    };
  }

  function pickBrief(S) {
    fillCabinet(S);
    if (!S.cabinet || S.cabinet.length < 2) return null;
    var file = houseFile(S);
    var want = KIND_FOR_WORST[file.worst.k] || 'service';
    var left = null, right = null, i;
    for (i = 0; i < S.cabinet.length; i++) {
      if (ministryKind(S, S.cabinet[i].ministryId) === want) { left = S.cabinet[i]; break; }
    }
    if (!left) left = S.cabinet[0];
    for (i = 0; i < S.cabinet.length; i++) {
      if (S.cabinet[i] !== left && ministryKind(S, S.cabinet[i].ministryId) !== ministryKind(S, left.ministryId)) {
        right = S.cabinet[i];
        break;
      }
    }
    if (!right) right = S.cabinet[1] || S.cabinet[0];
    S.flags.briefLeft = left.ministryId;
    S.flags.briefRight = right.ministryId;
    S.flags.briefWorst = file.worst.k;
    return { left: left, right: right, worst: file.worst };
  }

  function bumpMinister(S, ministryId, loyalty, competence) {
    var m = byMinistry(S, ministryId);
    if (!m) return;
    if (loyalty) m.loyalty = clamp(m.loyalty + loyalty, 0, 100);
    if (competence) m.competence = clamp(m.competence + competence, 0, 100);
  }

  // The president's minute. Kind is the portfolio that won the briefing;
  // quality is whether you actually funded it, announced it, or sold it.
  function applyHouse(a, kind, quality) {
    var S = a.S;
    S.flags.didDuty = S.turn;
    S.flags.houseKind = kind;
    S.flags.houseQuality = quality;
    S.nation.govApproval = clamp(S.nation.govApproval + (
      quality === 'deliver' ? a.rng(1, 4) :
      quality === 'rot' ? -a.rng(1, 4) : a.rng(0, 2)
    ), 3, 95);
    var won = S.flags.briefLeft;
    if (quality === 'deliver') {
      if (kind === 'money') {
        a.nation('growth', a.rng(0.2, 0.6)); a.nation('debt', -a.rng(0.4, 1.4));
        a.nation('reserves', a.rng(0.1, 0.4));
        a.blocs({ traders: a.rng(2, 6), middle: a.rng(1, 4) });
      } else if (kind === 'service') {
        a.nation('health', a.rng(2, 6)); a.nation('education', a.rng(1, 4));
        a.nation('unrest', -a.rng(1, 4));
        a.blocs({ rural: a.rng(3, 7), youth: a.rng(2, 6) });
      } else if (kind === 'power') {
        a.nation('unrest', -a.rng(3, 8)); a.nation('coup', -a.rng(2, 6));
        a.add('security', a.rng(2, 6));
        a.blocs({ middle: a.rng(2, 6), youth: -a.rng(1, 4) });
      } else if (kind === 'machine') {
        a.add('party', a.rng(3, 8)); a.add('grassroots', a.rng(2, 6));
        var hot = hottestRegion(S);
        a.addRegion(hot.id, a.rng(2, 5));
        a.blocs({ chiefs: a.rng(2, 6), labour: a.rng(1, 4) });
      } else {
        a.add('intl', a.rng(3, 8)); a.add('business', a.rng(2, 6));
        if (S.nation.intl.sanctions > 0) {
          S.nation.intl.sanctions = Math.max(0, S.nation.intl.sanctions - a.rng(3, 10));
        }
      }
      bumpMinister(S, won, 7, 2);
      if (S.flags.briefRight && S.flags.briefRight !== won) bumpMinister(S, S.flags.briefRight, -5, 0);
      a.legacyMark('ranTheCountry');
    } else if (quality === 'rot') {
      a.nation('corruption', a.rng(1, 4));
      a.add('money', a.wage(a.rng(6, 16)));
      a.add('stats.integrity', -a.rng(2, 6));
      a.dirt('house-' + kind, 'A briefing that became a tender', 3);
      bumpMinister(S, won, 4, -3);
    } else {
      a.add('fame', a.rng(1, 3)); a.add('media', a.rng(1, 4));
      a.add('grassroots', a.rng(0, 2));
      bumpMinister(S, won, 2, 0);
    }
    return quality;
  }

  /* =======================================================================
     THE HOTTEST PROVINCE
     GPS builds with a construction menu. This game sits the province.
     One project at a time, assembled from the region that is calling and
     the minister who owns the kind of thing it needs.
     ======================================================================= */
  var KIND_FOR_PROJECT = {
    unrest: 'clinic', debt: 'power', jobless: 'road',
    health: 'clinic', infra: 'road', rot: 'housing'
  };
  var PROJECT_LABEL = {
    clinic: 'a clinic', road: 'a tarred road', power: 'an electrification line',
    housing: 'a housing allocation', school: 'a secondary school'
  };
  var PROJECT_MINISTRY = {
    clinic: 'health', road: 'infra', power: 'mines', housing: 'local', school: 'edu'
  };

  function liveProject(S) {
    var p = S.house && S.house.project;
    return p && !p.done ? p : null;
  }

  function pickProject(S) {
    fillCabinet(S);
    var live = liveProject(S);
    var hot = live
      ? { id: live.regionId, name: (RZ.COUNTRIES[S.countryId].regionById[live.regionId] || {}).name || live.regionId, support: Math.round(S.player.regionSupport[live.regionId] || 0) }
      : hottestRegion(S);
    var file = houseFile(S);
    var kind = live ? live.kind : (KIND_FOR_PROJECT[(file.worst || {}).k] || 'road');
    var mid = PROJECT_MINISTRY[kind] || 'infra';
    var min = byMinistry(S, mid) || (S.cabinet && S.cabinet[0]) || null;
    var purse = byMinistry(S, 'fin');
    if (purse && min && purse.ministryId === min.ministryId) {
      purse = (S.cabinet || []).filter(function (m) { return m !== min; })[0] || purse;
    }
    if (!purse) purse = (S.cabinet && S.cabinet[1]) || min;
    S.flags.projRegion = hot.id;
    S.flags.projKind = kind;
    S.flags.projMin = min ? min.ministryId : mid;
    S.flags.projPurse = purse ? purse.ministryId : 'fin';
    return { hot: hot, kind: kind, min: min, purse: purse, live: live, label: PROJECT_LABEL[kind] || kind };
  }

  function applyProject(a, quality) {
    var S = a.S;
    var kind = S.flags.projKind || 'road';
    var rid = S.flags.projRegion || S.player.regionId;
    S.house = S.house || {};
    var live = liveProject(S);
    if (quality === 'show') {
      a.add('fame', a.rng(1, 4)); a.add('media', a.rng(1, 3));
      a.addRegion(rid, a.rng(0, 2));
      bumpMinister(S, S.flags.projMin, 1, 0);
      S.flags.projQuality = 'show';
      return quality;
    }
    if (live && quality === 'deliver') {
      live.left = Math.max(1, (live.left || live.months) - a.rng(1, 2));
      live.quality = 'deliver';
      a.add('capital', -2);
      a.addRegion(rid, a.rng(1, 3));
      bumpMinister(S, S.flags.projMin, 4, 1);
      S.flags.projQuality = 'deliver';
      return quality;
    }
    if (live && quality === 'rot') {
      live.quality = 'rot';
      a.add('money', a.wage(a.rng(6, 14)));
      a.add('stats.integrity', -a.rng(1, 4));
      a.nation('corruption', a.rng(1, 3));
      S.flags.projQuality = 'rot';
      return quality;
    }
    var months = quality === 'rot' ? a.irange(6, 11) : a.irange(4, 8);
    S.house.project = {
      regionId: rid, kind: kind, months: months, left: months,
      quality: quality, started: S.turn, done: false
    };
    S.flags.projQuality = quality;
    if (quality === 'deliver') {
      a.add('capital', -4);
      a.addRegion(rid, a.rng(1, 4));
      bumpMinister(S, S.flags.projMin, 5, 2);
      if (S.flags.projPurse && S.flags.projPurse !== S.flags.projMin) bumpMinister(S, S.flags.projPurse, -3, 0);
      a.legacyMark('builtTheProvince');
    } else {
      a.add('money', a.wage(a.rng(8, 20)));
      a.add('stats.integrity', -a.rng(2, 6));
      a.dirt('proj-' + kind, 'A provincial tender that was never published', 3);
      a.nation('corruption', a.rng(1, 3));
      bumpMinister(S, S.flags.projMin, 3, -2);
    }
    return quality;
  }

  function finishProject(S) {
    var p = S.house && S.house.project;
    if (!p || p.done) return null;
    p.done = true;
    var api = RZ.engine.mkApi(S);
    var r = RZ.COUNTRIES[S.countryId].regionById[p.regionId];
    var name = r ? r.name : 'the province';
    var label = PROJECT_LABEL[p.kind] || p.kind;
    if (p.quality === 'deliver') {
      api.addRegion(p.regionId, api.rng(4, 9));
      if (p.kind === 'clinic') api.nation('health', api.rng(2, 6));
      else if (p.kind === 'school') api.nation('education', api.rng(2, 6));
      else if (p.kind === 'road') { api.nation('infra', api.rng(2, 6)); api.nation('growth', api.rng(0.1, 0.4)); }
      else if (p.kind === 'power') { api.nation('infra', api.rng(1, 4)); api.nation('growth', api.rng(0.2, 0.5)); }
      else { api.nation('unrest', -api.rng(1, 4)); }
      S.nation.govApproval = clamp(S.nation.govApproval + api.rng(1, 4), 3, 95);
      if (RZ.ward && RZ.ward.stamp) RZ.ward.stamp(S, p.kind, 'kept');
      RZ.engine.pushFeed(S, {
        title: 'Opened in ' + name,
        body: 'The ' + label + ' you signed is standing. The province will remember the date.',
        tone: 'good'
      });
    } else if (p.quality === 'rot') {
      api.addRegion(p.regionId, -api.rng(1, 4));
      api.nation('corruption', api.rng(1, 3));
      RZ.engine.pushFeed(S, {
        title: 'A site in ' + name + ' that is not a site',
        body: 'The tender was paid. The ground has not moved. Somebody has a company.',
        tone: 'bad'
      });
    }
    S.house.project = null;
    return p;
  }

  function projectTick(S, span) {
    var p = liveProject(S);
    if (!p) return;
    p.left = (p.left || p.months) - span;
    if (p.left <= 0) finishProject(S);
  }

  /* =======================================================================
     A NAMED GREAT POWER
     Not a world map. China, Washington, or the neighbour, one at a time,
     in a room, when a deal or a listing is live.
     ======================================================================= */
  var NEIGHBOUR = {
    BW: 'ZA', ZA: 'ZW', ZW: 'ZA', ZM: 'ZW', MW: 'ZM',
    MZ: 'ZA', AO: 'NA', NA: 'ZA', LS: 'ZA', SZ: 'ZA'
  };

  function powerOf(S, which) {
    var c = RZ.COUNTRIES[S.countryId];
    which = which || 'neighbour';
    if (which === 'china') {
      return {
        id: 'china', name: 'the People\'s Republic', short: 'Beijing',
        envoy: 'the Ambassador of the People\'s Republic', org: 'the Embassy',
        want: 'a mine, a road, and a loan that outlives this parliament'
      };
    }
    if (which === 'us') {
      return {
        id: 'us', name: 'the United States', short: 'Washington',
        envoy: 'the Ambassador of the United States', org: 'the Embassy',
        want: 'a listing, a vote, and a clause about the next election'
      };
    }
    var nid = NEIGHBOUR[c.id] || 'ZA';
    var n = RZ.COUNTRIES[nid] || RZ.COUNTRIES.ZA;
    return {
      id: 'neighbour', name: n.name, short: n.capital,
      envoy: 'the High Commissioner of ' + n.name, org: n.name,
      want: 'a corridor, a vote in the Organ, and a sentence that will not appear in a communiqué',
      neighbourId: nid
    };
  }

  function pickPower(S, prefer) {
    var which = prefer || 'neighbour';
    if (!prefer) {
      if (S.nation.intl.sanctions > 18) which = 'us';
      else if (S.nation.intl.imf || S.nation.economy.debt > 88) which = 'china';
      else which = 'neighbour';
      if (S.flags.powerLast === which) {
        which = which === 'china' ? 'neighbour' : (which === 'us' ? 'china' : 'us');
      }
    }
    S.flags.powerId = which;
    S.flags.powerLast = which;
    return powerOf(S, which);
  }

  function applyPower(a, quality) {
    var S = a.S;
    var which = S.flags.powerId || 'neighbour';
    S.flags.powerDeal = quality;
    if (quality === 'deal') {
      a.add('intl', a.rng(3, 8)); a.add('business', a.rng(2, 6));
      a.nation('growth', a.rng(0.2, 0.7)); a.nation('reserves', a.rng(0.1, 0.5));
      if (which === 'china') {
        a.nation('debt', a.rng(0.4, 1.4)); a.nation('infra', a.rng(2, 6));
      } else if (which === 'us') {
        if (S.nation.intl.sanctions > 0) {
          S.nation.intl.sanctions = Math.max(0, S.nation.intl.sanctions - a.rng(6, 16));
        }
        a.add('media', a.rng(1, 4));
      } else {
        a.addRegion(hottestRegion(S).id, a.rng(1, 4));
        a.add('intl', a.rng(1, 3));
      }
      a.legacyMark('goodDeal');
    } else if (quality === 'clause') {
      a.add('money', a.wage(a.rng(12, 22))); a.add('business', a.rng(3, 8));
      a.add('stats.integrity', -a.rng(3, 7));
      a.dirt('power-' + which, 'A clause with ' + powerOf(S, which).short + ' that was never published', 4);
      a.owePatron(RZ.makeName(a.C), 8);
      a.nation('growth', a.rng(0.3, 0.8));
      if (which === 'us' && S.nation.intl.sanctions > 0) {
        S.nation.intl.sanctions = Math.max(0, S.nation.intl.sanctions - a.rng(4, 10));
      }
    } else {
      a.add('grassroots', a.rng(2, 5)); a.add('media', a.rng(1, 4));
      a.add('intl', -a.rng(2, 6)); a.add('stats.integrity', a.rng(1, 3));
    }
    return quality;
  }

  /* =======================================================================
     THE LEADER OF THE OPPOSITION
     Already in the censure room. Persist them. They table, they leak,
     they primary. They have a name, a party, a file, and a standing.
     ======================================================================= */
  function oppositionParty(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var best = null, bestSeats = -1;
    c.parties.forEach(function (p) {
      if (p.id === S.player.partyId) return;
      if (S.parties[p.id] && S.parties[p.id].gov) return;
      var seats = (S.parties[p.id] && S.parties[p.id].seats) || 0;
      if (seats > bestSeats) { bestSeats = seats; best = p; }
    });
    return best || c.parties.filter(function (p) { return p.id !== S.player.partyId; })[0] || c.parties[0];
  }

  function opposition(S) {
    if (S.opposition && S.opposition.id) return S.opposition;
    var c = RZ.COUNTRIES[S.countryId];
    var party = oppositionParty(S);
    var p = RZ.cast
      ? RZ.cast.who(S, c, 'Leader of the Opposition', '')
      : RZ.makeNpc(c, { partyId: party && party.id });
    S.opposition = {
      id: p.key || p.id,
      name: p.name,
      partyId: party ? party.id : null,
      standing: Math.round(RZ.range(28, 62)),
      file: 0,
      months: 0,
      unity: (party && S.parties[party.id] && S.parties[party.id].unity != null)
        ? S.parties[party.id].unity : Math.round(RZ.range(40, 72)),
      line: 'street'
    };
    syncOppUnity(S);
    return S.opposition;
  }

  function syncOppUnity(S) {
    var o = S.opposition;
    if (!o) return;
    if (o.unity == null) o.unity = 52;
    o.unity = clamp(o.unity, 0, 100);
    if (o.partyId && S.parties[o.partyId]) S.parties[o.partyId].unity = o.unity;
  }

  function otherOppositionParty(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var main = oppositionParty(S);
    var best = null, bestSeats = -1;
    (c.parties || []).forEach(function (p) {
      if (p.id === S.player.partyId) return;
      if (main && p.id === main.id) return;
      if (S.parties[p.id] && S.parties[p.id].gov) return;
      var seats = (S.parties[p.id] && S.parties[p.id].seats) || 0;
      if (seats > bestSeats) { bestSeats = seats; best = p; }
    });
    return best;
  }

  function hawk(S) {
    var o = opposition(S);
    var c = RZ.COUNTRIES[S.countryId];
    return RZ.cast
      ? RZ.cast.who(S, c, 'the Opposition hawk', o.partyId || '')
      : RZ.makeNpc(c, { partyId: o.partyId });
  }

  function govSeats(S) {
    var n = 0;
    (S.nation.govParties || []).forEach(function (id) {
      n += (S.parties[id] && S.parties[id].seats) || 0;
    });
    return n;
  }

  function houseNeed(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var total = (c.house && c.house.seats) || 1;
    return Math.floor(total / 2) + 1;
  }

  // A minority is the lead, alone, short of the House. A caretaker waiting
  // on talks is not one yet — the paper has not been written.
  function minorityLive(S) {
    var c = RZ.COUNTRIES[S.countryId];
    if (!S.player || !S.player.isPresident) return false;
    if (!c || c.system !== 'parl') return false;
    if (S.flags && S.flags.coalitionTalks) return false;
    return govSeats(S) < houseNeed(S);
  }

  function thinMajority(S) {
    var have = govSeats(S);
    var need = houseNeed(S);
    return have < need + Math.max(2, Math.round(need * 0.08));
  }

  function supplyLive(S) {
    var c = RZ.COUNTRIES[S.countryId];
    if (!S.player.isPresident || c.system !== 'parl') return false;
    return (S.nation.govParties || []).length > 1 || thinMajority(S);
  }

  // Deterministic. Leadership buys two names. It cannot invent a majority.
  // A paper this year means they do not vote you out; your own benches still can.
  function houseHolds(S, opts) {
    opts = opts || {};
    var have = govSeats(S);
    var need = houseNeed(S);
    var party = (S.player.standing && S.player.standing.party) || 0;
    var leader = (S.player.standing && S.player.standing.leader) || 0;
    var names = 0;
    if (opts.whip || (S.flags && S.flags.censurePlan === 'whip')) names += 2;
    if (leader >= 55) names += 2;
    else if (leader > 42) names += 1;
    if (party < 22) return false;
    if (S.flags && S.flags.supplyYear === S.date.year && party >= 35) return true;
    return have + names >= need;
  }

  function crossSeats(S, fromId, toId, n) {
    var from = S.parties[fromId], to = S.parties[toId];
    if (!from || !to || fromId === toId || n <= 0) return 0;
    n = Math.min(Math.round(n), Math.max(0, (from.seats || 0) - 1));
    if (n <= 0) return 0;
    from.seats -= n;
    to.seats = (to.seats || 0) + n;
    from.vote = Math.max(1, (from.vote || 0) - n * 0.35);
    to.vote = (to.vote || 0) + n * 0.35;
    return n;
  }

  function applyOpp(a, quality) {
    var S = a.S;
    var o = opposition(S);
    S.flags.oppDeal = quality;
    if (quality === 'deal') {
      o.standing = clamp(o.standing - a.rng(4, 10), 0, 100);
      o.file = clamp(o.file - a.rng(6, 14), 0, 100);
      o.unity = clamp((o.unity || 52) - a.rng(8, 16), 0, 100);
      o.line = 'corridor';
      a.add('party', -a.rng(2, 6)); a.add('media', a.rng(1, 4));
      a.add('leader', a.rng(1, 3));
      S.nation.govApproval = clamp(S.nation.govApproval + a.rng(0, 3), 3, 95);
    } else if (quality === 'cut') {
      fillCabinet(S);
      var block = choppingBlock(S);
      if (block && block.cut) dropMinister(S, block.cut.ministryId);
      o.standing = clamp(o.standing - a.rng(2, 6), 0, 100);
      o.unity = clamp((o.unity || 52) - a.rng(2, 8), 0, 100);
      a.add('party', -a.rng(3, 8)); a.add('leader', a.rng(1, 4));
    } else if (quality === 'leak') {
      o.file = clamp(o.file + a.rng(8, 16), 0, 100);
      o.unity = clamp((o.unity || 52) + a.rng(4, 10), 0, 100);
      o.line = 'street';
      a.add('media', -a.rng(3, 8)); a.add('leader', -a.rng(2, 6));
      var open = (S.player.dirt || []).filter(function (d) { return !d.exposed; })[0];
      if (open) a.exposeDirt(open.id);
      S.nation.govApproval = clamp(S.nation.govApproval - a.rng(2, 6), 3, 95);
    } else {
      a.add('leader', a.rng(2, 6)); a.add('party', a.rng(1, 4));
      o.standing = clamp(o.standing + a.rng(1, 4), 0, 100);
      o.unity = clamp((o.unity || 52) + a.rng(2, 8), 0, 100);
      o.line = 'street';
    }
    syncOppUnity(S);
    return quality;
  }

  function applySplit(a, quality) {
    var S = a.S;
    var o = opposition(S);
    hawk(S);
    S.flags.oppSplit = quality;
    if (quality === 'take') {
      var n = crossSeats(S, o.partyId, S.player.partyId, Math.max(1, a.irange(1, 4)));
      S.flags.oppCrossed = (S.flags.oppCrossed || 0) + n;
      o.unity = clamp((o.unity || 52) - a.rng(18, 32), 0, 22);
      o.standing = clamp(o.standing - a.rng(6, 14), 0, 100);
      o.line = 'split';
      a.add('party', -a.rng(4, 10)); a.add('media', a.rng(3, 8)); a.add('leader', a.rng(1, 4));
      a.add('stats.cunning', a.rng(1, 3));
      S.nation.govApproval = clamp(S.nation.govApproval + a.rng(0, 3), 3, 95);
      a.legacyMark('splitTheOpposition');
    } else if (quality === 'back') {
      o.unity = clamp((o.unity || 52) + a.rng(10, 20), 40, 88);
      o.standing = clamp(o.standing - a.rng(1, 5), 0, 100);
      o.line = 'street';
      a.add('party', a.rng(1, 4)); a.add('leader', a.rng(1, 3)); a.add('media', a.rng(0, 2));
    } else {
      o.unity = clamp((o.unity || 52) - a.rng(10, 18), 8, 28);
      o.standing = clamp(o.standing - a.rng(2, 6), 0, 100);
      o.file = clamp(o.file + a.rng(4, 10), 0, 100);
      o.line = 'split';
      a.add('media', a.rng(3, 8)); a.add('leader', -a.rng(0, 3));
    }
    syncOppUnity(S);
    return quality;
  }

  function applyOther(a, quality) {
    var S = a.S;
    var o = opposition(S);
    var other = otherOppositionParty(S);
    S.flags.oppOther = quality;
    S.flags.otherOppId = other ? other.id : null;
    if (quality === 'recognize') {
      o.standing = clamp(o.standing - a.rng(4, 10), 0, 100);
      o.unity = clamp((o.unity || 52) - a.rng(4, 10), 0, 100);
      if (other && S.parties[other.id]) {
        S.parties[other.id].vote = (S.parties[other.id].vote || 0) + a.rng(0.4, 1.4);
        S.parties[other.id].unity = clamp((S.parties[other.id].unity || 50) + a.rng(2, 6), 0, 100);
      }
      a.add('media', a.rng(2, 6)); a.add('party', -a.rng(1, 4)); a.add('leader', a.rng(0, 3));
    } else if (quality === 'play') {
      o.standing = clamp(o.standing - a.rng(2, 6), 0, 100);
      o.unity = clamp((o.unity || 52) - a.rng(6, 14), 0, 100);
      o.file = clamp(o.file + a.rng(2, 8), 0, 100);
      if (other && S.parties[other.id]) {
        S.parties[other.id].unity = clamp((S.parties[other.id].unity || 50) - a.rng(4, 10), 0, 100);
      }
      a.add('stats.cunning', a.rng(1, 3)); a.add('media', a.rng(1, 4));
      a.add('stats.integrity', -a.rng(0, 2));
    } else {
      o.standing = clamp(o.standing + a.rng(1, 4), 0, 100);
      o.unity = clamp((o.unity || 52) + a.rng(1, 5), 0, 100);
      a.add('party', a.rng(1, 4)); a.add('leader', a.rng(1, 3));
    }
    syncOppUnity(S);
    return quality;
  }

  function applySupply(a, quality) {
    var S = a.S;
    var o = opposition(S);
    S.flags.oppSupply = quality;
    S.flags.didSupply = S.turn;
    if (quality === 'chair') {
      fillCabinet(S);
      var block = choppingBlock(S);
      if (block && block.cut) dropMinister(S, block.cut.ministryId);
      o.unity = clamp((o.unity || 52) - a.rng(10, 18), 0, 100);
      o.standing = clamp(o.standing - a.rng(3, 8), 0, 100);
      o.line = 'corridor';
      a.add('party', -a.rng(5, 12)); a.add('leader', a.rng(1, 4));
      S.nation.society.stability = clamp(S.nation.society.stability + a.rng(6, 14), 3, 95);
      S.flags.supplyYear = S.date.year;
      S.flags.missedSupply = 0;
      a.legacyMark('boughtTheHouse');
    } else if (quality === 'paper') {
      o.unity = clamp((o.unity || 52) - a.rng(6, 12), 0, 100);
      o.line = 'corridor';
      a.add('party', -a.rng(2, 6)); a.add('capital', -4); a.add('intl', a.rng(0, 3));
      S.nation.society.stability = clamp(S.nation.society.stability + a.rng(3, 8), 3, 95);
      S.flags.supplyYear = S.date.year;
      S.flags.missedSupply = 0;
    } else {
      a.add('leader', a.rng(1, 4)); a.add('party', a.rng(1, 3)); a.add('media', a.rng(0, 3));
      S.nation.society.stability = clamp(S.nation.society.stability - a.rng(1, 4), 3, 95);
    }
    syncOppUnity(S);
    return quality;
  }

  function applyCensure(a, quality) {
    var S = a.S;
    var c = RZ.COUNTRIES[S.countryId];
    S.flags.censure = quality;
    if (quality === 'cut') {
      fillCabinet(S);
      var block = choppingBlock(S);
      if (block && block.cut) dropMinister(S, block.cut.ministryId);
      a.add('media', a.rng(2, 6)); a.add('intl', a.rng(1, 3));
      S.nation.govApproval = clamp(S.nation.govApproval + a.rng(0, 3), 3, 95);
      return quality;
    }
    if (quality === 'dissolve') {
      if (S.nextElection - S.date.year > 0 && RZ.engine && RZ.engine.ELECTION_MONTH) {
        var em = RZ.engine.ELECTION_MONTH[c.id];
        S.nextElection = S.date.month < em - 1 ? S.date.year : S.date.year + 1;
        S.lastElectionYear = S.nextElection - 1;
        S.campaign.season = true;
      }
      a.add('fame', a.rng(3, 7)); a.add('grassroots', a.rng(2, 6));
      a.add('party', -a.rng(2, 6));
      S.nation.govApproval = clamp(S.nation.govApproval + a.rng(-2, 5), 3, 95);
      return quality;
    }
    var held = houseHolds(S, { whip: S.flags.censurePlan === 'whip' || quality === 'whip' });
    if (held) {
      a.add('leader', a.rng(3, 7));
      S.nation.govApproval = clamp(S.nation.govApproval + a.rng(1, 4), 3, 95);
      a.nation('unrest', -a.rng(1, 3));
      S.flags.censure = 'whip';
      return 'held';
    }
    S.flags.censure = 'lost';
    a.add('leader', -a.rng(4, 9));
    S.nation.govApproval = clamp(S.nation.govApproval - a.rng(4, 10), 3, 95);
    if (c.system === 'parl') {
      S.nation.society.stability = C100(S.nation.society.stability - a.rng(4, 10));
      S.flags.wasPresident = true;
      S.player.record = S.player.record || [];
      S.player.record.push({ year: S.date.year, text: 'Removed by a motion of no confidence.' });
      if (RZ.engine && RZ.engine.endGame) RZ.engine.endGame(S, 'noconfidence');
    }
    return 'lost';
  }

  function oppTick(S, span) {
    if (!S.player.isPresident) return;
    var o = opposition(S);
    if (o.unity == null) {
      o.unity = (o.partyId && S.parties[o.partyId] && S.parties[o.partyId].unity != null)
        ? S.parties[o.partyId].unity : 52;
    }
    if (!o.line) o.line = 'street';
    o.months += span;
    var tgt = clamp(32 + (48 - S.nation.govApproval) * 0.45, 12, 82);
    o.standing = clamp(o.standing + (tgt - o.standing) * 0.04 * span, 0, 100);
    var dirt = (S.player.dirt || []).filter(function (d) { return !d.exposed; }).length;
    o.file = clamp(o.file + dirt * 0.35 * span - 0.12 * span, 0, 100);
    var uTgt = o.line === 'split' ? 18
      : o.line === 'corridor' ? 30
      : clamp(48 + (o.standing - 50) * 0.2 - o.file * 0.08, 16, 78);
    o.unity = clamp(o.unity + (uTgt - o.unity) * 0.04 * span, 0, 100);
    syncOppUnity(S);
  }

  // Tuesday that nobody sat. A paper buys the year; walking still sat the room.
  function supplyTick(S, span) {
    if (!minorityLive(S)) return;
    if (S.flags.supplyYear === S.date.year) return;
    if (S.flags.didSupply === S.turn) return;
    S.flags.missedSupply = (S.flags.missedSupply || 0) + span;
    S.nation.society.stability = C100(S.nation.society.stability - RZ.range(2, 5) * span);
    S.nation.govApproval = clamp(S.nation.govApproval - RZ.range(1, 3) * span, 3, 95);
  }

  /* =======================================================================
     THE PARTNER
     A GNU is a person who spent the campaign calling you a thief, then
     sat down. A kingmaker is a chair. Both persist. Walking is how a
     majority becomes Tuesday, which 1.14 already knows how to count.
     houseFile reads S.partner || null — never plant on render.
     ======================================================================= */
  function partnerLive(S) {
    var c = RZ.COUNTRIES[S.countryId];
    if (!S.player || !S.player.isPresident) return false;
    if (!c || c.system !== 'parl') return false;
    if (S.flags && S.flags.coalitionTalks) return false;
    var kind = S.flags && S.flags.coalitionKind;
    if (kind !== 'gnu' && kind !== 'king') return false;
    if (!S.flags.coalitionPartner) return false;
    return (S.nation.govParties || []).length > 1;
  }

  // The annexure is whatever is on the folder, not a clause list. Pure: the
  // file may read this. A paper this year is the cheque; this is what they fill.
  var QUOTE_HOSTILE = { land: 1, mines: 1, wages: 1 };

  function partnerQuote(S) {
    if (!partnerLive(S)) return null;
    if (!S.flags || S.flags.partnerYear !== S.date.year) return null;
    if (S.bill && S.bill.id) {
      return {
        kind: 'bill',
        id: S.bill.id,
        name: S.bill.name,
        hostile: !!QUOTE_HOSTILE[S.bill.id]
      };
    }
    if (S.date.month >= 9 && S.flags.taxYear !== S.date.year) {
      return { kind: 'tax', id: 'tax', name: 'the package', hostile: false };
    }
    if (S.nation && S.nation.economy && S.nation.economy.debt > 78) {
      return { kind: 'rating', id: 'rating', name: 'the rating', hostile: false };
    }
    return null;
  }

  function plantPartner(S, partyId, chair) {
    var c = RZ.COUNTRIES[S.countryId];
    var party = (c.partyById && c.partyById[partyId]) || null;
    if (!party) {
      (c.parties || []).forEach(function (p) { if (p.id === partyId) party = p; });
    }
    if (!party) return null;
    var p = RZ.cast
      ? RZ.cast.who(S, c, 'Leader of the ' + (party.abbr || 'partner'), party.id)
      : RZ.makeNpc(c, { partyId: party.id });
    S.partner = {
      id: p.key || p.id,
      name: p.name,
      partyId: party.id,
      standing: Math.round(RZ.range(40, 62)),
      file: 0,
      months: 0,
      line: 'corridor',
      chair: chair || 'fin'
    };
    return S.partner;
  }

  function partner(S) {
    if (S.partner && S.partner.id) return S.partner;
    if (!partnerLive(S)) return null;
    var id = S.flags.coalitionPartner;
    if (!id) return null;
    return plantPartner(S, id, 'fin');
  }

  function seatPartner(S, quality, talks) {
    talks = talks || {};
    if (quality === 'minor') {
      S.partner = null;
      return null;
    }
    var partyId = quality === 'gnu'
      ? (talks.gnu && talks.gnu.id)
      : (talks.king && talks.king.id);
    if (!partyId) return null;
    fillCabinet(S);
    var chair = 'fin';
    if (quality === 'king') {
      var block = choppingBlock(S);
      if (block && block.cut) chair = block.cut.ministryId;
    } else if (!byMinistry(S, 'fin') && S.cabinet && S.cabinet[0]) {
      chair = S.cabinet[0].ministryId;
    }
    dropMinister(S, chair, { partyId: partyId });
    return plantPartner(S, partyId, chair);
  }

  function walkPartner(S) {
    var lead = S.player.partyId;
    var chair = S.partner && S.partner.chair;
    if (chair) dropMinister(S, chair, { partyId: lead });
    if (RZ.elections && RZ.elections.seatGovernment) RZ.elections.seatGovernment(S, [lead]);
    else {
      S.nation.govParties = [lead];
      var c = RZ.COUNTRIES[S.countryId];
      (c.parties || []).forEach(function (p) {
        if (S.parties[p.id]) S.parties[p.id].gov = p.id === lead;
      });
    }
    S.flags.coalitionKind = 'minor';
    S.flags.coalitionPartner = null;
    S.flags.partnerYear = null;
    S.partner = null;
    S.opposition = null;
  }

  function applyPartner(a, quality) {
    var S = a.S;
    var o = partner(S);
    S.flags.didPartner = S.turn;
    S.flags.partnerDeal = quality;
    if (quality === 'policy') {
      if (o) {
        o.standing = clamp((o.standing || 50) + a.rng(4, 10), 0, 100);
        o.line = 'corridor';
      }
      a.add('party', -a.rng(2, 6));
      a.add('media', a.rng(2, 6));
      a.add('intl', a.rng(1, 4));
      S.nation.society.stability = clamp(S.nation.society.stability + a.rng(2, 6), 3, 95);
      S.flags.partnerYear = S.date.year;
      S.flags.missedPartner = 0;
      a.legacyMark('keptTheGnu');
    } else if (quality === 'chair') {
      if (o) {
        o.standing = clamp((o.standing || 50) + a.rng(6, 12), 0, 100);
        o.line = 'corridor';
        fillCabinet(S);
        var m = byMinistry(S, o.chair);
        if (m) m.loyalty = clamp((m.loyalty || 40) + a.rng(8, 16), 0, 100);
      }
      a.add('party', -a.rng(4, 10));
      a.add('leader', a.rng(1, 4));
      S.flags.partnerYear = S.date.year;
      S.flags.missedPartner = 0;
    } else if (quality === 'keep') {
      a.add('party', -a.rng(3, 8));
      a.add('leader', a.rng(1, 3));
      if (o) o.standing = clamp((o.standing || 50) + a.rng(2, 6), 0, 100);
    } else if (quality === 'honour') {
      var q = partnerQuote(S);
      S.flags.partnerHonour = q ? q.kind : null;
      if (o) {
        o.standing = clamp((o.standing || 50) + a.rng(4, 10), 0, 100);
        o.line = 'corridor';
      }
      a.add('party', -a.rng(3, 8));
      a.add('media', a.rng(1, 4));
      if (q && q.kind === 'bill') {
        if (q.hostile && RZ.bill && RZ.bill.withdraw) RZ.bill.withdraw(S);
        else if (S.bill) {
          S.flags.partnerBackedBill = S.bill.id;
          (S.bill.blocs || []).forEach(function (b) {
            if (b.id === 'opp' || b.id === 'small') {
              b.pledged = true;
              b.how = 'photograph';
              b.lean = clamp((b.lean || 0) + 40, -95, 95);
            }
          });
        }
      } else if (q && q.kind === 'tax' && RZ.gov && RZ.gov.applyTax) {
        RZ.gov.applyTax(a, 'holiday');
      } else {
        a.add('intl', a.rng(2, 6));
        S.nation.society.stability = clamp(S.nation.society.stability + a.rng(1, 4), 3, 95);
      }
      a.legacyMark('honouredThePaper');
    } else if (quality === 'renege') {
      if (o) {
        o.standing = clamp((o.standing || 50) - a.rng(8, 16), 0, 100);
        o.line = 'street';
      }
      a.add('party', a.rng(1, 4));
      a.add('leader', -a.rng(1, 4));
      a.legacyMark('renegedThePaper');
      if (o && o.standing < 24) {
        a.add('media', -a.rng(3, 8));
        S.nation.society.stability = clamp(S.nation.society.stability - a.rng(4, 10), 3, 95);
        a.legacyMark('gnuWalked');
        walkPartner(S);
        S.flags.partnerDeal = 'walk';
        return 'walk';
      }
    } else {
      a.add('party', a.rng(3, 8));
      a.add('media', -a.rng(3, 8));
      a.add('leader', a.rng(1, 4));
      S.nation.society.stability = clamp(S.nation.society.stability - a.rng(4, 10), 3, 95);
      a.legacyMark('gnuWalked');
      walkPartner(S);
    }
    return quality;
  }

  function partnerTick(S, span) {
    if (!partnerLive(S) || !S.partner) return;
    var o = S.partner;
    o.months += span;
    var tgt = clamp(42 + (S.nation.govApproval - 50) * 0.25 -
      (50 - ((S.player.standing && S.player.standing.party) || 50)) * 0.35, 12, 78);
    o.standing = clamp(o.standing + (tgt - o.standing) * 0.04 * span, 0, 100);
    if (S.flags.partnerYear === S.date.year) return;
    if (S.flags.didPartner === S.turn) return;
    S.flags.missedPartner = (S.flags.missedPartner || 0) + span;
    o.standing = clamp(o.standing - RZ.range(2, 5) * span, 0, 100);
    if (o.standing < 28) o.line = 'street';
  }

  /* =======================================================================
     SATURDAY
     Conference year is not a toast. The hall is a room; the last beat is a
     count; a parl republic can recall you. Anointing is how two centres
     begin: you keep the country, they have the party.
     houseFile reads S.challenger || null — never plant on render.
     ======================================================================= */
  function conferenceDefenceLive(S) {
    if (!S.player || !S.player.isPresident || !S.player.isLeader) return false;
    if (S.flags && S.flags.coalitionTalks) return false;
    if (S.date.year !== S.nextConference || S.date.month < 6) return false;
    if (S.flags && S.flags.defendedConference === S.nextConference) return false;
    return true;
  }

  function plantChallenger(S) {
    if (S.challenger && S.challenger.id) return S.challenger;
    var c = RZ.COUNTRIES[S.countryId];
    var p = null;
    if (RZ.cast) p = RZ.cast.who(S, c, 'the person who wants the job', S.player.partyId);
    if (!p) p = RZ.makeNpc(c, { partyId: S.player.partyId });
    S.challenger = {
      id: p.key || p.id,
      name: p.name,
      partyId: p.partyId || S.player.partyId,
      regionId: p.regionId || S.player.regionId,
      standing: Math.round(RZ.range(44, 68))
    };
    return S.challenger;
  }

  function challenger(S) {
    if (S.challenger && S.challenger.id) return S.challenger;
    if (!conferenceDefenceLive(S)) return null;
    return plantChallenger(S);
  }

  function splitLeadership(S) {
    S.player.isLeader = false;
    S.flags.twoCentre = true;
    var ch = S.challenger || plantChallenger(S);
    if (ch && S.parties[S.player.partyId]) S.parties[S.player.partyId].leaderName = ch.name;
    if (RZ.field && RZ.field.syncLeadership) RZ.field.syncLeadership(S);
  }

  function conferenceHolds(S, opts) {
    opts = opts || {};
    var party = (S.player.standing && S.player.standing.party) || 0;
    if (party < 28) return false;
    if (!RZ.elections || !RZ.elections.conferenceVote) return party >= 48;
    var bonus = 0;
    if (opts.dump) bonus += 10;
    if (S.flags && S.flags.coalitionKind === 'gnu') bonus -= 6;
    var cv = RZ.elections.conferenceVote(S, null, { noNoise: !!opts.quiet, bonus: bonus });
    S.flags.conferenceTally = { mine: cv.mine, total: cv.total, pct: cv.pct };
    return !!cv.won;
  }

  function recallFromHall(S, a) {
    var c = RZ.COUNTRIES[S.countryId];
    splitLeadership(S);
    if (a) a.legacyMark('recalled');
    else if (S.legacyMarks) S.legacyMarks.recalled = true;
    if (c.system === 'parl' && S.player.isPresident && RZ.engine && RZ.engine.endGame) {
      S.flags.wasPresident = true;
      S.player.record = S.player.record || [];
      S.player.record.push({
        year: S.date.year, title: 'Recalled',
        note: 'The hall had the names.'
      });
      RZ.engine.endGame(S, 'recall');
    }
  }

  function applyConference(a, quality) {
    var S = a.S;
    plantChallenger(S);
    S.flags.didConference = S.turn;
    S.flags.defendedConference = S.nextConference;
    S.flags.conferenceDeal = quality;
    if (quality === 'anoint') {
      a.add('party', a.rng(2, 6));
      a.add('leader', -a.rng(2, 6));
      a.add('media', a.rng(1, 4));
      splitLeadership(S);
      a.legacyMark('madeWay');
      S.flags.conference = 'anoint';
      return 'anoint';
    }
    if (quality === 'dump' && partnerLive(S)) {
      a.add('party', a.rng(2, 6));
      walkPartner(S);
    }
    var held = conferenceHolds(S, { dump: quality === 'dump' });
    if (held) {
      a.add('party', a.rng(2, 6));
      a.add('leader', a.rng(1, 4));
      a.legacyMark('keptTheHall');
      S.flags.conference = 'kept';
      return 'kept';
    }
    S.flags.conference = 'lost';
    a.add('party', -a.rng(4, 10));
    a.add('leader', -a.rng(3, 8));
    recallFromHall(S, a);
    return 'lost';
  }

  function partnerSeesCarried(S, bill) {
    if (!bill || !partnerLive(S)) return null;
    if (!S.flags || S.flags.partnerYear !== S.date.year) return null;
    if (!QUOTE_HOSTILE[bill.id]) return null;
    var a = RZ.engine.mkApi(S);
    return applyPartner(a, 'renege');
  }

  function partnerSeesCarried(S, bill) {
    if (!bill || !partnerLive(S)) return null;
    if (!S.flags || S.flags.partnerYear !== S.date.year) return null;
    if (!QUOTE_HOSTILE[bill.id]) return null;
    var a = RZ.engine.mkApi(S);
    return applyPartner(a, 'renege');
  }

  function conferenceTick(S, span) {
    if (!conferenceDefenceLive(S)) return;
    if (S.flags.didConference === S.turn) return;
    S.flags.missedConference = (S.flags.missedConference || 0) + span;
  }

  /* =======================================================================
     THE MINISTRY AS A JOB
     Six rooms, one family of portfolios. Sitting it is how a minister moves
     the nation — not a walkabout with a better car.
     ======================================================================= */
  var DUTY_SCENE = {
    health: 'duty-clinic', labour: 'duty-clinic', water: 'duty-clinic',
    edu: 'duty-school', youth: 'duty-school',
    infra: 'duty-road',
    def: 'duty-cluster', home: 'duty-cluster', ict: 'duty-cluster', foreign: 'duty-cluster',
    mines: 'duty-shaft', trade: 'duty-shaft', fin: 'duty-shaft',
    local: 'duty-list', agric: 'duty-list'
  };

  function dutySceneId(S) {
    var id = playerMinistryId(S);
    if (!id) return 'duty-clinic';
    return DUTY_SCENE[id] || 'duty-clinic';
  }

  function applyDuty(a, port, quality) {
    var S = a.S;
    S.flags.didDuty = S.turn;
    S.flags.dutyPort = port;
    S.flags.dutyQuality = quality;
    S.nation.govApproval = clamp(S.nation.govApproval + (
      quality === 'deliver' ? a.rng(1, 4) :
      quality === 'rot' ? -a.rng(1, 3) : a.rng(0, 2)
    ), 3, 95);
    if (quality === 'deliver') {
      if (port === 'health') {
        a.nation('health', a.rng(2, 6)); a.nation('deaths', -a.irange(0, 4));
        a.blocs({ rural: a.rng(3, 8), labour: a.rng(2, 6) });
      } else if (port === 'edu') {
        a.nation('education', a.rng(2, 6));
        a.blocs({ youth: a.rng(4, 9), middle: a.rng(1, 4) });
      } else if (port === 'infra') {
        a.nation('infra', a.rng(2, 6)); a.nation('growth', a.rng(0.1, 0.4));
        a.blocs({ rural: a.rng(3, 7), traders: a.rng(2, 6) });
      } else if (port === 'security') {
        a.nation('unrest', -a.rng(3, 8));
        a.blocs({ middle: a.rng(2, 6), youth: -a.rng(1, 5) });
      } else if (port === 'mines') {
        a.nation('growth', a.rng(0.2, 0.6)); a.nation('reserves', a.rng(0.1, 0.4));
        a.blocs({ labour: a.rng(2, 6), traders: a.rng(1, 4) });
      } else if (port === 'local') {
        a.nation('unrest', -a.rng(1, 4));
        a.blocs({ youth: a.rng(3, 7), chiefs: a.rng(-2, 4) });
        if (a.wardTrust) a.wardTrust(a.rng(2, 5));
      }
      a.legacyMark('satTheMinistry');
      if (RZ.ward && RZ.ward.stamp) {
        var kind = { health: 'clinic', edu: 'school', infra: 'road', local: 'housing', mines: 'power' }[port];
        if (kind) RZ.ward.stamp(S, kind, 'kept');
        if (port === 'edu' || port === 'health') RZ.ward.stamp(S, 'wages', 'kept');
      }
    } else if (quality === 'rot') {
      a.nation('corruption', a.rng(1, 3));
      a.add('money', a.wage(a.rng(4, 12)));
      a.add('stats.integrity', -a.rng(2, 6));
      a.dirt('duty-' + port, 'A tender in your own ministry that was never published', 3);
    } else {
      a.add('fame', a.rng(1, 3)); a.add('media', a.rng(1, 4));
      a.add('grassroots', a.rng(0, 2));
    }
    return quality;
  }

  function loyaltyTarget(S, m) {
    return clamp(42 + S.player.standing.leader * 0.25 - (m.corruption - 50) * 0.08, 12, 88);
  }

  // What the people you appointed are doing to the country, and to you.
  function cabinetTick(S, span, out) {
    if (!S.player.isPresident || !S.cabinet || !S.cabinet.length) return;
    var meanComp = 0, meanRot = 0;
    S.cabinet.forEach(function (m) {
      m.months += span;
      meanComp += m.competence;
      meanRot += m.corruption;
      // Loyalty finds a level. A shock (a leak, a drop) is a push; this is the pull.
      var tgt = loyaltyTarget(S, m);
      m.loyalty = clamp(m.loyalty + (tgt - m.loyalty) * 0.02 * span, 0, 100);
    });
    meanComp /= S.cabinet.length;
    meanRot /= S.cabinet.length;

    // Competence is growth; corruption is rot. Both slowly, both every month.
    S.nation.economy.growth = clamp(S.nation.economy.growth + (meanComp - 50) * 0.004 * span, -8, 12);
    S.nation.society.corruption = C100(S.nation.society.corruption + (meanRot - 50) * 0.02 * span);
  }

  function cabinetSummary(S) {
    fillCabinet(S);
    var rows = S.cabinet.map(function (m) {
      return {
        name: m.name, ministry: ministryName(S, m.ministryId), ministryId: m.ministryId,
        competence: m.competence, loyalty: m.loyalty, corruption: m.corruption,
        you: false,
        risk: m.loyalty < 32 ? 'positioning' : m.corruption > 68 ? 'expensive' :
              m.competence > 68 ? 'the one who works' : 'holding'
      };
    });
    var mine = playerMinistryId(S);
    if (mine && !S.player.isPresident) {
      rows.unshift({
        name: S.player.name, ministry: ministryName(S, mine), ministryId: mine,
        competence: 0, loyalty: 0, corruption: 0, you: true, risk: 'you'
      });
    }
    return rows;
  }

  /* =======================================================================
     THE CRISES THAT SUMMON YOU
     Each is a dialogue scene id. The trigger decides when somebody sends for
     you; the scene is the meeting.
     ======================================================================= */
  var CRISES = [
    {
      // A minister is only ever one rumour away from a backbencher.
      id: 'reshuffle-rumour', scene: 'reshuffle-rumour', cool: 20,
      when: function (S) {
        var t = tierOf(S);
        return t >= 5 && t <= 9 && !S.player.isPresident &&
               S.parties[S.player.partyId] && S.parties[S.player.partyId].gov;
      },
      p: function (S) { return 0.05 + (60 - Math.min(60, S.player.standing.leader)) * 0.002; }
    },
    {
      // The portfolio nobody else would take, handed over as an honour.
      id: 'chalice', scene: 'poisoned-chalice', cool: 40,
      when: function (S) {
        var t = tierOf(S);
        return t >= 5 && t <= 8 && S.parties[S.player.partyId] && S.parties[S.player.partyId].gov;
      },
      p: function (S) { return 0.035 + S.player.standing.leader * 0.0006; }
    },
    {
      // You are one office away and the old man has started saying "we".
      id: 'succession', scene: 'succession-trap', cool: 36,
      when: function (S) {
        var t = tierOf(S);
        return t >= 10 && t <= 12 && !S.player.isPresident;
      },
      p: function (S) { return 0.07; }
    },
    {
      // The treasury is empty and both of the people offering to fill it want
      // something you would rather not give.
      id: 'debt', scene: 'debt-ultimatum', cool: 48,
      when: function (S) {
        return S.player.isPresident &&
               (S.nation.economy.reserves < 2.2 || S.nation.economy.debt > 95);
      },
      p: function (S) { return 0.12; }
    },
    {
      // They do not knock during office hours.
      id: 'generals', scene: 'midnight-generals', cool: 30,
      when: function (S) {
        return S.player.isPresident && S.nation.society.unrest > 62;
      },
      p: function (S) { return 0.06 + (S.nation.society.unrest - 62) * 0.004; }
    },
    {
      // Six provincial resolutions, after ten, at the residence.
      id: 'sg-midnight', scene: 'sg-midnight', cool: 28,
      when: function (S) {
        var t = tierOf(S);
        return t >= 8 && t <= 12 && !S.player.isPresident;
      },
      p: function (S) { return 0.055; }
    },
    {
      // The deputy sits down before he is asked to.
      id: 'deputy-sits', scene: 'deputy-sits', cool: 40,
      when: function (S) {
        var t = tierOf(S);
        return t >= 10 && !S.player.isPresident;
      },
      p: function (S) { return 0.07; }
    },
    {
      // A disloyal minister is not idle. He is positioning — and then the
      // Sunday paper has a detail that was said in a room with eight people.
      id: 'cabinet-leak', scene: 'cabinet-leak', cool: 4,
      when: function (S) {
        if (!S.player.isPresident) return false;
        fillCabinet(S);
        var worst = (S.cabinet || []).slice().sort(function (a, b) { return a.loyalty - b.loyalty; })[0];
        if (!worst || worst.loyalty >= 32) return false;
        S.flags.leakerId = worst.ministryId;
        return true;
      },
      p: function (S) { return 0.07; }
    },
    {
      // Two of them have already decided, and they have decided opposite things.
      id: 'cabinet-row', scene: 'cabinet-row', cool: 14,
      when: function (S) {
        var t = tierOf(S);
        if (!(S.player.isPresident || t >= 11)) return false;
        return !!pairRow(S);
      },
      p: function (S) { return S.player.isPresident ? 0.06 : 0.04; }
    },
    {
      // GPS 2026's regime censure, as a room. The House has the numbers.
      // A parliamentary system can actually take the chair; a presidential
      // one can only make the rest of the term a trial. Same meeting.
      id: 'house-censure', scene: 'house-censure', cool: 8,
      when: function (S) {
        if (!S.player.isPresident) return false;
        if (S.nation.govApproval < 40 || S.nation.society.unrest > 58) return true;
        var c = RZ.COUNTRIES[S.countryId];
        if (!c || c.system !== 'parl') return false;
        if (minorityLive(S) && S.flags.supplyYear !== S.date.year) return true;
        if ((S.flags.missedSupply || 0) >= 1) return true;
        if ((S.nation.govParties || []).length > 1 && S.nation.society.stability < 48) return true;
        return false;
      },
      p: function (S) {
        var a = Math.max(0, 40 - S.nation.govApproval);
        var u = Math.max(0, S.nation.society.unrest - 58);
        var p = 0.07 + a * 0.003 + u * 0.002;
        var c = RZ.COUNTRIES[S.countryId];
        if (c && c.system === 'parl') {
          if (minorityLive(S) && S.flags.supplyYear !== S.date.year) {
            p += 0.10 + (S.flags.missedSupply || 0) * 0.05;
          } else if (S.flags.twoCentre) {
            p += 0.06;
          } else if (S.flags.coalitionKind === 'gnu') {
            p += 0.015;
          } else if (S.flags.coalitionKind === 'king' || (S.nation.govParties || []).length > 1) {
            p += 0.04;
          }
        }
        return p;
      }
    },
    {
      // China, Washington, or the neighbour: a listing, a loan, a corridor.
      id: 'power-deal', scene: 'great-power', cool: 18,
      when: function (S) {
        if (!S.player.isPresident) return false;
        return S.nation.intl.sanctions > 15 || S.nation.intl.imf || S.nation.economy.debt > 90;
      },
      p: function (S) {
        var s = Math.max(0, S.nation.intl.sanctions - 15);
        var d = Math.max(0, S.nation.economy.debt - 90);
        return 0.06 + s * 0.002 + d * 0.002 + (S.nation.intl.imf ? 0.04 : 0);
      }
    },
    {
      // They table. They leak. They primary. Same person as the censure room.
      id: 'opp-table', scene: 'opp-table', cool: 14,
      when: function (S) {
        if (!S.player.isPresident) return false;
        var o = opposition(S);
        return S.nation.govApproval < 50 || o.file > 18 || o.standing > 58;
      },
      p: function (S) {
        var o = S.opposition || { file: 0, standing: 40 };
        var a = Math.max(0, 50 - S.nation.govApproval);
        return 0.055 + a * 0.002 + o.file * 0.0015 + Math.max(0, o.standing - 50) * 0.001;
      }
    },
    {
      // A deal with the leader is a betrayal of their caucus. The hawk walks.
      id: 'opp-split', scene: 'opp-split', cool: 16,
      when: function (S) {
        if (!S.player.isPresident) return false;
        var c = RZ.COUNTRIES[S.countryId];
        if (!c.parties || c.parties.length < 2) return false;
        var o = opposition(S);
        return (o.unity || 52) < 36 || o.line === 'corridor';
      },
      p: function (S) {
        var o = S.opposition || { unity: 50, line: 'street' };
        return 0.05 + Math.max(0, 36 - (o.unity || 50)) * 0.003 + (o.line === 'corridor' ? 0.04 : 0);
      }
    },
    {
      // The photograph has yellowed. They want a paper, a chair, or the door.
      id: 'gnu-meet', scene: 'gnu-meet', cool: 10,
      when: function (S) {
        if (!partnerLive(S)) return false;
        if (partnerQuote(S)) return true;
        if (S.flags && S.flags.twoCentre) return true;
        if ((S.flags.missedPartner || 0) >= 1) return true;
        return !!(S.partner && S.partner.standing < 32);
      },
      p: function (S) {
        if (partnerQuote(S)) return 0.14;
        var m = S.flags.missedPartner || 0;
        var st = (S.partner && S.partner.standing) || 50;
        return 0.06 + m * 0.05 + Math.max(0, 32 - st) * 0.004;
      }
    },
    {
      // Your own hawk. Inverse of the opposition split.
      id: 'gnu-caucus', scene: 'gnu-caucus', cool: 12,
      when: function (S) {
        if (!partnerLive(S)) return false;
        return S.player.standing.party < 32;
      },
      p: function (S) {
        return 0.05 + Math.max(0, 32 - S.player.standing.party) * 0.004;
      }
    },
    {
      // Saturday that nobody sat. The hall does not wait.
      id: 'conference-floor', scene: 'conference-floor', cool: 8,
      when: function (S) {
        if (!conferenceDefenceLive(S)) return false;
        return (S.flags.missedConference || 0) >= 1 || S.date.month >= 10;
      },
      p: function (S) {
        return 0.08 + (S.flags.missedConference || 0) * 0.05;
      }
    },
    {
      // A clean pair of hands. Once, so it is a design, not a rumour.
      id: 'sg-ceiling', scene: 'sg-ceiling', cool: 99,
      when: function (S) {
        if (!S.player || S.player.isPresident) return false;
        if (S.flags && S.flags.heardTheCeiling) return false;
        var t = tierOf(S);
        if (t < 3 || t > 11) return false;
        var dirty = (S.player.dirt || []).filter(function (d) { return d.exposed; }).length;
        return (S.player.stats && S.player.stats.integrity >= 58) && dirty === 0;
      },
      p: function (S) {
        var t = tierOf(S);
        return t >= 8 ? 0.10 : 0.045;
      }
    }
  ];

  function tick(S, span, out) {
    if (S.tempo === 'week') return null;          // not during a campaign
    if (S.pendingScene || S.pendingEvent) return null;
    S.flags.crisisSeen = S.flags.crisisSeen || {};

    if (sitsInCabinet(S)) fillCabinet(S);
    cabinetTick(S, span, out);
    projectTick(S, span);
    if (S.player.isPresident) {
      oppTick(S, span);
      supplyTick(S, span);
      partnerTick(S, span);
      conferenceTick(S, span);
    }

    var pool = CRISES.filter(function (cr) {
      var last = S.flags.crisisSeen[cr.id];
      if (last !== undefined && monthIndex(S) - last < cr.cool) return false;
      if (!cr.when(S)) return false;
      return RZ.dialogue && !!RZ.dialogue.byId(cr.scene);
    });
    if (!pool.length) return null;

    for (var i = 0; i < pool.length; i++) {
      var cr = pool[i];
      if (RZ.chance(cr.p(S) * span)) {
        S.flags.crisisSeen[cr.id] = monthIndex(S);
        RZ.dialogue.summon(S, cr.scene);
        return { crisis: cr.id, scene: cr.scene };
      }
    }
    return null;
  }

  RZ.state = {
    CRISES: CRISES, SUMMONS: ['cabinet-leak', 'cabinet-row', 'house-censure', 'opp-table', 'opp-split', 'gnu-meet', 'gnu-caucus', 'conference-floor', 'sg-ceiling'],
    initCabinet: initCabinet, fillCabinet: fillCabinet, makeMinister: makeMinister,
    cabinetTick: cabinetTick, cabinetSummary: cabinetSummary, ministryName: ministryName,
    ministerRole: ministerRole, ministerOrg: ministerOrg, ministryKind: ministryKind,
    sitsInCabinet: sitsInCabinet, playerMinistryId: playerMinistryId,
    byMinistry: byMinistry, dropMinister: dropMinister,
    choppingBlock: choppingBlock, pairRow: pairRow,
    hottestRegion: hottestRegion, houseFile: houseFile, pickBrief: pickBrief,
    applyHouse: applyHouse, bumpMinister: bumpMinister,
    liveProject: liveProject, pickProject: pickProject, applyProject: applyProject,
    finishProject: finishProject, PROJECT_LABEL: PROJECT_LABEL,
    powerOf: powerOf, pickPower: pickPower, applyPower: applyPower, NEIGHBOUR: NEIGHBOUR,
    opposition: opposition, oppositionParty: oppositionParty, applyOpp: applyOpp,
    otherOppositionParty: otherOppositionParty, hawk: hawk, thinMajority: thinMajority,
    govSeats: govSeats, houseNeed: houseNeed, minorityLive: minorityLive, houseHolds: houseHolds,
    supplyLive: supplyLive, crossSeats: crossSeats,
    applySplit: applySplit, applyOther: applyOther, applySupply: applySupply, applyCensure: applyCensure,
    partner: partner, partnerLive: partnerLive, plantPartner: plantPartner, seatPartner: seatPartner,
    applyPartner: applyPartner, walkPartner: walkPartner, partnerQuote: partnerQuote,
    partnerSeesCarried: partnerSeesCarried,
    conferenceDefenceLive: conferenceDefenceLive, plantChallenger: plantChallenger,
    challenger: challenger, conferenceHolds: conferenceHolds, applyConference: applyConference,
    splitLeadership: splitLeadership,
    dutySceneId: dutySceneId, applyDuty: applyDuty, DUTY_SCENE: DUTY_SCENE,
    tick: tick
  };
})();
