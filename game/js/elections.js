/* elections.js — vote projection, seat allocation, government formation, and the
   internal contests (primaries, conference floors) that decide careers. */
(function () {
  'use strict';

  var C100 = RZ.c100, clamp = RZ.clamp;

  /* ---------- national vote projection ---------- */
  // Returns { byParty:{id:share}, byRegion:{rid:{id:share}} }
  function projectVote(S, opts) {
    opts = opts || {};
    var c = RZ.COUNTRIES[S.countryId];
    var raw = {}, tot = 0;

    c.parties.forEach(function (p) {
      var st = S.parties[p.id];
      var v = st.vote;

      // government parties carry the economy on their back
      if (st.gov) {
        var e = S.nation.economy;
        v += (e.growth - 2.5) * 1.5;
        v -= Math.max(0, e.inflation - 6) * 0.35;
        v -= Math.max(0, e.unemployment - 20) * 0.16;
        v += (S.nation.govApproval - 50) * 0.20;
        v -= S.nation.society.unrest * 0.06;
        v -= S.nation.society.corruption * 0.05;
        v += (c.inst.incumbency - 50) * 0.10;           // machine advantage
        v -= Math.max(0, S.nation.yearsInPower - 15) * 0.10; // fatigue
      } else {
        v += S.nation.society.unrest * 0.03;
        v += S.nation.society.corruption * 0.025;
      }

      // leader effect
      var lead = leaderQuality(S, p.id);
      v += (lead - 50) * 0.14;

      // the player's own campaigning, if this is the player's party
      if (p.id === S.player.partyId) v += (S.campaign.effort || 0) * 0.05;

      // party machine keeps a floor under it
      v = v * 0.86 + p.vote * 0.14;
      if (!opts.noNoise) v += RZ.noise(1.6);
      raw[p.id] = Math.max(0.4, v);
      tot += raw[p.id];
    });

    var byParty = {};
    Object.keys(raw).forEach(function (k) { byParty[k] = raw[k] / tot * 100; });

    var byRegion = {};
    c.regions.forEach(function (r) {
      var rr = {}, rt = 0;
      c.parties.forEach(function (p) {
        var bias = (r.bias && r.bias[p.id] !== undefined) ? r.bias[p.id] : 1;
        var v = byParty[p.id] * bias;
        // ethnic/regional salience sharpens the bias
        v *= 1 + (bias - 1) * (c.inst.ethnic / 220);
        if (p.id === S.player.partyId) v *= 1 + (S.player.regionSupport[r.id] || 0) / 420;
        if (!opts.noNoise) v = Math.max(0.2, v + RZ.noise(1.1));
        rr[p.id] = Math.max(0.2, v); rt += rr[p.id];
      });
      Object.keys(rr).forEach(function (k) { rr[k] = rr[k] / rt * 100; });
      byRegion[r.id] = rr;
    });

    return { byParty: byParty, byRegion: byRegion };
  }

  function leaderQuality(S, pid) {
    if (pid === S.player.partyId && S.player.isLeader) {
      var p = S.player;
      return C100(30 + p.stats.charisma * 0.28 + p.stats.oratory * 0.24 + p.fame * 0.22 +
                  p.standing.media * 0.12 - (p.dirt.filter(function (d) { return d.exposed; }).length * 5));
    }
    var st = S.parties[pid];
    return st.leaderQuality;
  }

  /* ---------- seat allocation ---------- */
  function dhondt(shares, seats, threshold) {
    var ids = Object.keys(shares).filter(function (k) { return shares[k] >= (threshold || 0); });
    if (!ids.length) ids = Object.keys(shares);
    var out = {}; ids.forEach(function (k) { out[k] = 0; });
    for (var s = 0; s < seats; s++) {
      var best = null, bv = -1;
      ids.forEach(function (k) {
        var q = shares[k] / (out[k] + 1);
        if (q > bv) { bv = q; best = k; }
      });
      out[best]++;
    }
    return out;
  }

  // FPTP within a region approximated with a cube-law style seat bonus
  function fptpRegion(shares, seats, sharpness) {
    var k = sharpness || 2.7, pw = {}, tot = 0;
    Object.keys(shares).forEach(function (id) { pw[id] = Math.pow(Math.max(shares[id], 0.1), k); tot += pw[id]; });
    var exact = {}, out = {}, used = 0;
    Object.keys(pw).forEach(function (id) {
      exact[id] = pw[id] / tot * seats;
      out[id] = Math.floor(exact[id]); used += out[id];
    });
    var rem = Object.keys(exact).sort(function (a, b) { return (exact[b] - out[b]) - (exact[a] - out[a]); });
    for (var i = 0; used < seats; i++, used++) out[rem[i % rem.length]]++;
    return out;
  }

  function allocateSeats(S, vote) {
    var c = RZ.COUNTRIES[S.countryId];
    var seats = {}, regionSeats = {};
    c.parties.forEach(function (p) { seats[p.id] = 0; });

    if (c.house.method === 'nonparty') {
      c.parties.forEach(function (p) { seats[p.id] = c.house.elected; });
      return { seats: seats, regionSeats: regionSeats };
    }

    if (c.house.method === 'pr') {
      if (c.id === 'MZ' || c.id === 'AO') {
        // provincial lists
        c.regions.forEach(function (r) {
          var got = dhondt(vote.byRegion[r.id], r.seats, c.house.threshold || 0);
          regionSeats[r.id] = got;
          Object.keys(got).forEach(function (k) { seats[k] += got[k]; });
        });
      } else {
        var got = dhondt(vote.byParty, c.house.elected, c.house.threshold || 0);
        seats = got;
        c.regions.forEach(function (r) { regionSeats[r.id] = dhondt(vote.byRegion[r.id], r.seats, 0); });
      }
      return { seats: seats, regionSeats: regionSeats };
    }

    if (c.house.method === 'mmp') {
      var con = {};
      c.parties.forEach(function (p) { con[p.id] = 0; });
      c.regions.forEach(function (r) {
        var g = fptpRegion(vote.byRegion[r.id], r.seats, 2.4);
        regionSeats[r.id] = g;
        Object.keys(g).forEach(function (k) { con[k] += g[k]; });
      });
      // compensatory top-up: entitlement over the whole house, floored at seats already won
      var ent = dhondt(vote.byParty, c.house.seats, 0);
      c.parties.forEach(function (p) { seats[p.id] = Math.max(con[p.id], ent[p.id] || 0); });
      // overhang: the house is fixed, so trim list seats from the most over-represented
      var totalNow = RZ.sum(c.parties, function (p) { return seats[p.id]; });
      var guard = 0;
      while (totalNow > c.house.seats && guard++ < 400) {
        var worst = null, worstGap = -Infinity;
        c.parties.forEach(function (p) {
          if (seats[p.id] <= con[p.id]) return;            // cannot take back a won constituency
          var gap = seats[p.id] - (ent[p.id] || 0);
          if (gap > worstGap) { worstGap = gap; worst = p.id; }
        });
        if (worst === null) break;
        seats[worst]--; totalNow--;
      }
      return { seats: seats, regionSeats: regionSeats, constituency: con, overhang: totalNow > c.house.seats };
    }

    // fptp
    c.regions.forEach(function (r) {
      var g = fptpRegion(vote.byRegion[r.id], r.seats, 2.7);
      regionSeats[r.id] = g;
      Object.keys(g).forEach(function (k) { seats[k] += g[k]; });
    });
    return { seats: seats, regionSeats: regionSeats };
  }

  /* ---------- government formation ---------- */
  function formGovernment(S, seats) {
    var c = RZ.COUNTRIES[S.countryId];
    var total = RZ.sum(c.parties, function (p) { return seats[p.id] || 0; });
    var need = Math.floor(total / 2) + 1;
    var order = c.parties.slice().sort(function (a, b) { return (seats[b.id] || 0) - (seats[a.id] || 0); });
    var lead = order[0];
    var coalition = [lead.id], have = seats[lead.id] || 0;
    if (have >= need) return { parties: coalition, lead: lead.id, majority: true, need: need, total: total, hung: false };

    // partners: prefer smaller parties that are not the runner-up, then anyone
    var pool = order.slice(1);
    var runnerUp = pool.length ? pool[0].id : null;
    var ranked = pool.slice().sort(function (a, b) {
      var pa = (a.id === runnerUp ? -60 : 0) + (seats[a.id] || 0) * 0.6 + (a.kind === 'coalition' ? 25 : 0);
      var pb = (b.id === runnerUp ? -60 : 0) + (seats[b.id] || 0) * 0.6 + (b.kind === 'coalition' ? 25 : 0);
      return pb - pa;
    });
    for (var i = 0; i < ranked.length && have < need; i++) {
      coalition.push(ranked[i].id); have += seats[ranked[i].id] || 0;
    }
    return { parties: coalition, lead: lead.id, majority: have >= need, need: need, total: total,
             hung: coalition.length > 1, seatsHeld: have };
  }

  /* ---------- presidential ballot (direct-election countries) ---------- */
  function presidentialRace(S, vote) {
    var c = RZ.COUNTRIES[S.countryId];
    var cands = [], tot = 0;
    c.parties.forEach(function (p) {
      var personal = leaderQuality(S, p.id);
      var v = vote.byParty[p.id] * (0.80 + personal / 250) + RZ.noise(1.4);
      v = Math.max(0.3, v);
      cands.push({ partyId: p.id, name: candidateName(S, p.id), share: v, isPlayer: (p.id === S.player.partyId && S.player.isLeader) });
      tot += v;
    });
    cands.forEach(function (x) { x.share = x.share / tot * 100; });
    cands.sort(function (a, b) { return b.share - a.share; });

    var res = { round1: cands.slice(), runoff: null, winner: cands[0] };
    if (c.runoff && cands[0].share < 50 && cands.length > 1) {
      var a = cands[0], b = cands[1];
      // second-round transfers: everyone else splits against the leader if the leader is the incumbent party
      var rest = 100 - a.share - b.share;
      var toB = rest * (S.parties[a.partyId].gov ? RZ.range(0.55, 0.75) : RZ.range(0.35, 0.55));
      var A = a.share + (rest - toB), B = b.share + toB;
      var t = A + B;
      res.runoff = [{ partyId: a.partyId, name: a.name, share: A / t * 100, isPlayer: a.isPlayer },
                    { partyId: b.partyId, name: b.name, share: B / t * 100, isPlayer: b.isPlayer }];
      res.runoff.sort(function (x, y) { return y.share - x.share; });
      res.winner = res.runoff[0];
    }
    return res;
  }

  function candidateName(S, pid) {
    if (pid === S.player.partyId && S.player.isLeader) return S.player.name;
    return S.parties[pid].leaderName;
  }

  /* ---------- rigging ---------- */
  // Returns {shifted, caught}
  function rigElection(S, vote, magnitude) {
    var c = RZ.COUNTRIES[S.countryId];
    var head = 100 - c.inst.electoral;               // how riggable the count is
    var eff = magnitude * (head / 100);
    var pid = S.player.partyId;
    var gain = eff * RZ.range(0.6, 1.3);
    var others = c.parties.filter(function (p) { return p.id !== pid; });
    vote.byParty[pid] += gain;
    others.forEach(function (p) { vote.byParty[p.id] -= gain / others.length; });
    c.regions.forEach(function (r) {
      var g = gain * RZ.range(0.5, 1.5);
      vote.byRegion[r.id][pid] += g;
      others.forEach(function (p) { vote.byRegion[r.id][p.id] = Math.max(0.2, vote.byRegion[r.id][p.id] - g / others.length); });
    });
    var caught = RZ.rnd() < (c.inst.electoral / 100) * 0.55 + (c.inst.media / 100) * 0.25;
    return { shifted: gain, caught: caught };
  }

  /* ---------- internal contests ---------- */
  // Delegate-weighted conference vote. Returns {won, playerVotes, rivalVotes, rivalName, byRegion}
  function conferenceVote(S, difficulty) {
    var c = RZ.COUNTRIES[S.countryId];
    var P = S.player;
    var totalD = 0, mine = 0, byRegion = {};
    c.regions.forEach(function (r) {
      var d = Math.max(4, Math.round(r.seats * 4 + 8));
      var support = (P.regionSupport[r.id] || 0);
      var pull = support * 0.9 + P.standing.party * 0.55 + P.fame * 0.30 +
                 P.standing.leader * 0.10 + P.stats.charisma * 0.16;
      // where the barracks are a faction, their blessing is worth delegates
      pull += P.standing.security * (c.inst.security / 170);
      // a slate votes together
      pull += Math.min(8, P.allies.length) * 2.5;
      // patronage-heavy parties respond to money already spent
      pull += (S.campaign.delegateSpend || 0) * 0.5;
      pull -= difficulty;
      pull += RZ.noise(9);
      var frac = 1 / (1 + Math.exp(-(pull - 45) / 12));
      var got = Math.round(d * clamp(frac, 0.02, 0.98));
      byRegion[r.id] = { delegates: d, mine: got };
      mine += got; totalD += d;
    });
    return { won: mine > totalD / 2, mine: mine, total: totalD, byRegion: byRegion,
             pct: mine / totalD * 100 };
  }

  // A candidate-selection contest inside one constituency / region.
  function primaryContest(S, difficulty) {
    var P = S.player;
    var mine = (P.regionSupport[P.regionId] || 0) * 1.15 + P.standing.grassroots * 0.65 +
               P.standing.party * 0.45 + P.fame * 0.25 + P.stats.charisma * 0.16 +
               (S.campaign.delegateSpend || 0) * 0.6 + RZ.noise(10);
    // Delegates are drawn from the same six electorates, and a bloc that has
    // decided against you does not send people to fill a hall for you either.
    if (RZ.blocs) mine += RZ.blocs.swing(S) * 0.8;
    var theirs = difficulty + RZ.noise(10);
    return { won: mine > theirs, mine: mine, theirs: theirs, margin: mine - theirs };
  }

  // Winning an actual constituency seat under FPTP.
  function seatContest(S, vote) {
    var c = RZ.COUNTRIES[S.countryId];
    var P = S.player;
    var r = c.regionById[P.regionId];
    var shares = vote.byRegion[r.id];
    // A region contains many constituencies; a candidate picks the best one open to them,
    // and how good that seat is depends on how much of the machine they control.
    var skew = 0.10 + Math.min(0.55, (P.standing.party + (P.regionSupport[r.id] || 0)) / 340);
    var mine = shares[P.partyId] * (1 + (P.standing.grassroots + (P.regionSupport[r.id] || 0)) / 300) * (1 + skew);
    // "Grassroots" is an average of six electorates who want different things.
    // On the day, what counts is who among them actually goes and votes.
    if (RZ.blocs) mine += RZ.blocs.swing(S);
    var best = 0, bestId = null;
    Object.keys(shares).forEach(function (k) {
      if (k === P.partyId) return;
      if (shares[k] > best) { best = shares[k]; bestId = k; }
    });
    best *= (1 - skew * 0.35);
    // a single constituency is far noisier than a whole region
    mine += RZ.noise(9); best += RZ.noise(9);
    return { won: mine > best, mine: mine, best: best, rivalParty: bestId };
  }

  RZ.elections = {
    projectVote: projectVote, allocateSeats: allocateSeats, formGovernment: formGovernment,
    presidentialRace: presidentialRace, rigElection: rigElection,
    conferenceVote: conferenceVote, primaryContest: primaryContest, seatContest: seatContest,
    leaderQuality: leaderQuality, dhondt: dhondt
  };
})();
