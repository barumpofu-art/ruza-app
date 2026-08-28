/* ui.js — rendering and interaction. */
(function () {
  'use strict';
  var esc = RZ.esc, el = RZ.el, els = RZ.els;

  var UI = { S: null, draft: {}, pane: 'desk' };

  /* ---------------- screens ---------------- */
  function show(id) {
    els('.screen').forEach(function (s) { s.classList.toggle('is-active', s.id === 'screen-' + id); });
    window.scrollTo(0, 0);
    var g = el('#screen-game'); if (g) g.scrollTop = 0;
  }

  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    el('#toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, 2700);
  }

  function modal(html, opts) {
    var m = el('#modal'), inner = el('#modal-inner');
    inner.innerHTML = html;
    m.hidden = false;
    m.dataset.dismissible = (opts && opts.dismissible) ? '1' : '';
    return inner;
  }
  function closeModal() { el('#modal').hidden = true; el('#modal-inner').innerHTML = ''; }

  /* ---------------- country select ---------------- */
  function renderCountries() {
    var host = el('#country-list');
    host.innerHTML = RZ.COUNTRY_ORDER.map(function (id) {
      var c = RZ.COUNTRIES[id];
      var hardTxt = ['', 'Forgiving', 'Reachable', 'Hard', 'Brutal', 'Merciless'][c.hard];
      var hardCls = c.hard <= 2 ? 'easy' : (c.hard === 3 ? 'mid' : 'hard');
      var sysTxt = c.system === 'parl' ? 'Parliamentary' : (c.system === 'pres' ? 'Presidential' : 'Monarchy');
      return '<button class="ccard" data-country="' + id + '" style="--accent:' + c.accent + '">' +
        '<div class="ccard-top"><span class="ccard-flag">' + c.flag + '</span>' +
        '<span class="ccard-name">' + esc(c.name) + '</span>' +
        '<span class="ccard-sys">' + sysTxt + '</span></div>' +
        '<p class="ccard-desc"><em>' + esc(c.tagline) + '</em> — ' + esc(c.brief) + '</p>' +
        '<div class="ccard-meta">' +
        '<span class="pill ' + hardCls + '">' + hardTxt + '</span>' +
        '<span class="pill">' + methodLabel(c) + '</span>' +
        c.notes.map(function (n) { return '<span class="pill">' + esc(n) + '</span>'; }).join('') +
        '</div></button>';
    }).join('');
    host.querySelectorAll('[data-country]').forEach(function (b) {
      b.addEventListener('click', function () { UI.draft = { countryId: b.dataset.country }; renderCreate(); show('create'); });
    });
  }

  function methodLabel(c) {
    return { fptp: 'First-past-the-post', pr: 'Proportional list', mmp: 'Mixed-member PR', nonparty: 'Non-party ballot' }[c.house.method];
  }

  /* ---------------- character creation ---------------- */
  function renderCreate() {
    var c = RZ.COUNTRIES[UI.draft.countryId];
    var d = UI.draft;
    d.gender = d.gender || 'f';
    d.regionId = d.regionId || c.regions[0].id;
    d.bgId = d.bgId || 'teacher';
    d.partyId = d.partyId || c.parties[0].id;
    d.name = d.name || '';

    el('#create-title').textContent = c.flag + ' ' + c.name;

    var html = '';
    html += '<div><p class="field-label">Your name</p>' +
      '<input class="text-input" id="in-name" maxlength="34" placeholder="' + esc(RZ.makeName(c)) + '" value="' + esc(d.name) + '">' +
      '<p class="field-help">Leave it blank and one will be chosen for you.</p></div>';

    html += '<div><p class="field-label">You are</p><div class="chip-row" id="row-gender">' +
      [['f', 'A woman'], ['m', 'A man'], ['x', 'Neither']].map(function (g) {
        return '<button class="chip' + (d.gender === g[0] ? ' is-on' : '') + '" data-g="' + g[0] + '">' + g[1] + '</button>';
      }).join('') + '</div></div>';

    html += '<div><p class="field-label">Where you are from</p><div class="chip-row" id="row-region">' +
      c.regions.map(function (r) {
        return '<button class="chip' + (d.regionId === r.id ? ' is-on' : '') + '" data-r="' + r.id + '">' +
          esc(r.name) + ' <span style="opacity:.6;margin-left:5px">' + r.seats + '</span></button>';
      }).join('') + '</div>' +
      '<p class="field-help">Seat counts shown. A big home region is a bigger base — and a bigger fight.</p></div>';

    if (c.parties.length > 1) {
      html += '<div><p class="field-label">Your party</p><div class="opt-grid" id="row-party">' +
        c.parties.map(function (p) {
          var st = p.gov ? 'In government' : 'Opposition';
          return '<button class="opt' + (d.partyId === p.id ? ' is-on' : '') + '" data-p="' + p.id + '">' +
            '<div class="opt-name"><span class="row-dot" style="background:' + p.color + '"></span>' + esc(p.abbr) + '</div>' +
            '<div class="opt-desc">' + esc(p.name) + ' — ' + esc(p.ideo) + '.</div>' +
            '<div class="opt-stats">' + st + ' · ~' + Math.round(p.vote) + '% · machine ' + p.machine + '</div>' +
            '</button>';
        }).join('') + '</div></div>';
    } else {
      html += '<div class="card"><p class="note">' + esc(c.name) + ' has no party politics. You will stand as an individual, ' +
        'nominated at a ' + esc(c.terms.primary) + ', and every office above ' + esc(c.terms.mpShort) + ' is in the gift of the King.</p></div>';
    }

    html += '<div><p class="field-label">What you did before politics</p><div class="opt-grid" id="row-bg">' +
      RZ.BACKGROUNDS.map(function (b) {
        var mods = [];
        Object.keys(b.stats || {}).forEach(function (k) { mods.push(RZ.signed(b.stats[k]) + ' ' + k); });
        Object.keys(b.standing || {}).forEach(function (k) { mods.push(RZ.signed(b.standing[k]) + ' ' + k); });
        return '<button class="opt' + (d.bgId === b.id ? ' is-on' : '') + '" data-b="' + b.id + '">' +
          '<div class="opt-name">' + b.ico + ' ' + esc(b.name) + '</div>' +
          '<div class="opt-desc">' + esc(b.desc) + '</div>' +
          '<div class="opt-stats">' + esc(mods.join(' · ')) + '</div>' +
          '<div class="opt-desc" style="margin-top:6px;opacity:.75"><em>' + esc(b.note) + '</em></div>' +
          '</button>';
      }).join('') + '</div></div>';

    d.startAs = d.startAs || 'activist';
    html += '<div><p class="field-label">Where you come in</p><div class="opt-grid" id="row-start">' +
      [['activist', '🚩', 'Party activist',
        'Start at the bottom in ' + c.regionById[d.regionId].name + ', unpaid and unknown. Twenty years, a month at a time.',
        'The full climb · monthly turns'],
       ['candidate', '🗳️', 'Parliamentary candidate',
        'The branch years are behind you and your name is on the list. The ballot is in eight weeks.',
        'Straight into the campaign · weekly turns']]
      .map(function (o) {
        return '<button class="opt' + (d.startAs === o[0] ? ' is-on' : '') + '" data-s="' + o[0] + '">' +
          '<div class="opt-name">' + o[1] + ' ' + esc(o[2]) + '</div>' +
          '<div class="opt-desc">' + esc(o[3]) + '</div>' +
          '<div class="opt-stats">' + esc(o[4]) + '</div></button>';
      }).join('') + '</div></div>';

    html += '<button class="btn btn-gold btn-lg btn-block" id="btn-begin">Begin the career</button>' +
            '<p class="note center"></p>';

    el('#create-body').innerHTML = html;

    el('#in-name').addEventListener('input', function (e) { UI.draft.name = e.target.value; });
    bindChips('#row-gender', 'g', 'gender');
    bindChips('#row-region', 'r', 'regionId');
    bindChips('#row-party', 'p', 'partyId');
    bindChips('#row-bg', 'b', 'bgId');
    bindChips('#row-start', 's', 'startAs');
    refreshStartNote();
    el('#btn-begin').addEventListener('click', RZ.main.begin);
  }

  // The line under the Begin button has to answer both questions at once:
  // where you are from, and which end of the career you are coming in at.
  function refreshStartNote() {
    var host = el('#create-body'); if (!host) return;
    var note = host.querySelector('.note.center'); if (!note) return;
    var c = RZ.COUNTRIES[UI.draft.countryId];
    var region = c.regionById[UI.draft.regionId].name;
    note.textContent = UI.draft.startAs === 'candidate'
      ? 'You are the candidate for ' + region + ', eight weeks out.'
      : 'You start as an unpaid activist in ' + region + '.';
  }

  function bindChips(sel, attr, key) {
    var host = el(sel); if (!host) return;
    host.querySelectorAll('[data-' + attr + ']').forEach(function (b) {
      b.addEventListener('click', function () {
        UI.draft[key] = b.dataset[attr];
        host.querySelectorAll('[data-' + attr + ']').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        if (key === 'regionId' || key === 'startAs') refreshStartNote();
      });
    });
  }

  /* ---------------- HUD ---------------- */
  function renderHud() {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId], P = S.player;
    var lad = RZ.ladderFor(c.id), rung = lad[P.rungIdx];
    var initials = P.name.split(/\s+/).map(function (x) { return x[0]; }).slice(0, 2).join('').toUpperCase();
    el('#hud').innerHTML =
      '<div class="hud-row">' +
        '<div class="hud-portrait">' + esc(initials) + '</div>' +
        '<div class="hud-id"><div class="hud-name">' + esc(P.name) + '</div>' +
        '<div class="hud-office">' + esc(rung.title) + (P.ministry ? ' · ' + esc(P.ministry) : '') + '</div></div>' +
        '<div class="hud-date">' +
          (S.sprint
            ? '<div class="hud-month sprinting">' + S.sprint.weeksLeft + ' week' + (S.sprint.weeksLeft === 1 ? '' : 's') + ' left</div>'
            : '<div class="hud-month">' + RZ.monthShort(S.date.month) + ' ' + S.date.year + '</div>') +
        '<div class="hud-ap">' + S.actionsLeft + '/' + S.actionsPerTurn + ' actions</div></div>' +
      '</div>' +
      '<div class="hud-res">' +
        res('Money', RZ.money(P.money, c.cur.sym), P.money < 0 ? 'down' : '') +
        res('Capital', Math.round(P.capital), '') +
        res('Fame', Math.round(P.fame), '') +
        res('Health', Math.round(P.health), P.health < 45 ? 'down' : '') +
      '</div>';
  }
  function res(k, v, cls) {
    return '<div class="res"><div class="res-k">' + k + '</div><div class="res-v ' + cls + '">' + v + '</div></div>';
  }

  /* ---------------- desk pane ---------------- */
  function renderDesk() {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId];
    var h = '';

    if (S.bill) {
      h += billBoard(S, c);
    }
    if (S.sprint) {
      h += wardBoard(S, c);
    } else if (RZ.ward && RZ.engine.mkApi(S).tier() >= 4) {
      h += constituencyCard(S, c);
    }
    if (!S.sprint && S.campaign.season) {
      h += '<div class="card" style="border-color:#54452a;background:linear-gradient(180deg,#241f14,#161c25)">' +
        '<div class="block-h" style="margin:0 0 6px">Campaign season</div>' +
        '<p class="note">The general election is in ' + RZ.monthName(RZ.engine.ELECTION_MONTH[c.id]) + ' ' + S.nextElection +
        '. Everything you do now is worth more, and costs more.</p></div>';
    }

    h += listCard(S);
    h += contestCard();

    h += docketBoard(S);

    // Only appointments that are *still open* are held back from the grid. A
    // kept one has become a "kept" line in the diary with nothing to click, so
    // counting it as booked took the action off the desk entirely for the rest
    // of the month — you went to one funeral and could not go to another, and
    // the action simply vanished with no explanation.
    var booked = {};
    if (RZ.docket) RZ.docket.live(S).forEach(function (e) {
      if (!e.kept) booked[e.actionId] = true;
    });
    var hasDiary = RZ.docket ? RZ.docket.live(S).length > 0 : false;

    h += '<div class="block"><div class="block-h">' + (hasDiary ? 'The rest of the month' : 'This month') +
         '<span class="sub">' + S.actionsLeft + ' of ' + S.actionsPerTurn + ' left</span></div>';
    var acts = RZ.engine.availableActions(S).filter(function (a) { return !booked[a.id]; });
    h += '<div class="acts">' + acts.map(function (a) {
      return '<button class="act" data-action="' + a.id + '"' + (S.actionsLeft <= 0 ? ' disabled' : '') + '>' +
        '<span class="act-ico">' + a.ico + '</span>' +
        '<span class="act-txt"><span class="act-n">' + esc(a.name) + (a.risky ? ' <span style="color:#e08a86">◆</span>' : '') + '</span>' +
        '<span class="act-d">' + esc(a.desc) + '</span></span>' +
        '</button>';
    }).join('') + '</div></div>';

    var unit = S.tempo === 'week' ? 'week' : 'month';
    h += '<div class="block"><button class="btn ' + (S.actionsLeft <= 0 ? 'btn-gold' : 'btn-ghost') +
         ' btn-lg btn-block" data-act="end-turn">' +
         (S.actionsLeft <= 0 ? 'Next ' + unit + ' →' : 'Skip to next ' + unit + ' →') + '</button></div>';

    h += '<div class="block"><div class="block-h">The record</div>' +
      S.feed.slice(0, 22).map(paperCard).join('') + '</div>';

    el('#pane-desk').innerHTML = h;
    el('#pane-desk').querySelectorAll('[data-ward]').forEach(function (b) {
      b.addEventListener('click', function () { RZ.main.act('blitz'); });
    });
    bindDesk();
  }

  // The diary. Two or three of these were arranged by somebody else, for a
  // reason that is true of them, and the month is what is left over after
  // them. Cancelling is a button because saying so is the courteous half of
  // not coming; the expensive half is letting the month run out in silence.
  function docketBoard(S) {
    if (!RZ.docket) return '';
    var all = RZ.docket.entries(S);
    if (!all.length) return '';
    // Only appointments that are still possible get a button. One whose action
    // the engine has stopped offering would otherwise sit there clickable and
    // run past its own `when`.
    var live = RZ.docket.live(S);
    var stood = all.filter(function (e) { return e.declined; }).length;
    if (!live.length && !stood) return '';

    var kept = live.filter(function (e) { return e.kept; }).length;
    var h = '<div class="block"><div class="block-h">In the diary' +
      '<span class="sub">' + (live.length - kept) + ' still to keep</span></div>';

    h += '<div class="acts">' + live.map(function (e) {
      var who = e.who ? '<strong>' + esc(e.who.name) + ', ' + esc(e.who.role) + '</strong><br>' : '';
      if (e.kept) {
        return '<div class="act dk done">' +
          '<span class="act-ico">\u2713</span>' +
          '<span class="act-txt">' +
            '<span class="dk-head"><span class="act-n">' + esc(e.name) + '</span>' +
              '<span class="dk-at">kept</span></span>' +
            '<span class="act-d">' + (e.who ? esc(e.who.name) + ' \u00b7 ' : '') + e.at + '</span>' +
          '</span></div>';
      }
      return '<div class="dk-row">' +
        '<button class="act dk" data-action="' + e.actionId + '"' + (S.actionsLeft <= 0 ? ' disabled' : '') + '>' +
          '<span class="act-ico">' + e.ico + '</span>' +
          '<span class="act-txt">' +
            '<span class="dk-head"><span class="act-n">' + esc(e.name) + '</span>' +
              '<span class="dk-at">' + e.at + '</span></span>' +
            '<span class="act-d">' + who + esc(e.why) + '</span>' +
          '</span>' +
        '</button>' +
        '<button class="dk-x" data-decline="' + e.actionId + '" title="Send word that you are not coming">' +
          'Cancel</button>' +
        '</div>';
    }).join('') + '</div>';

    if (stood) {
      h += '<p class="note" style="margin:9px 0 0">' + stood + ' appointment' + (stood === 1 ? '' : 's') +
        ' cancelled. They were told, which costs you far less than letting them sit there.</p>';
    }
    return h + '</div>';
  }

  // A bill is an arithmetic problem wearing a title. The four rooms it has to
  // pass through are not equally persuadable and they are not persuaded by the
  // same things, so show each one's number rather than a single House bar.
  function billBoard(S, c) {
    var b = S.bill;
    var t = RZ.bill.count(S);
    var wk = Math.min(b.week, RZ.bill.WEEKS);
    var pct = Math.min(100, (100 * t.yes) / Math.max(1, t.total));
    var need = Math.min(100, (100 * t.needed) / Math.max(1, t.total));
    var have = t.yes >= t.needed;

    var h = '<div class="bill">' +
      '<div class="sprint-top">' +
        '<div><div class="sprint-k">Second reading in ' + Math.max(0, b.weeksLeft) +
          ' week' + (b.weeksLeft === 1 ? '' : 's') + '</div>' +
        '<div class="sprint-h">' + esc(b.name) + '</div></div>' +
        '<div class="bill-count ' + (have ? 'up' : 'down') + '">' + t.yes +
        '<small>of ' + t.needed + ' needed</small></div>' +
      '</div>' +
      '<div class="sprint-bar" style="position:relative">' +
        '<span class="' + (have ? 'up' : '') + '" style="width:' + Math.max(2, pct) + '%"></span>' +
        '<i style="position:absolute;top:-2px;bottom:-2px;left:' + need + '%;width:2px;background:#e8e2d4;opacity:.85"></i>' +
      '</div>' +
      '<p class="note" style="margin:8px 0 0">' +
        (t.short
          ? '<strong>' + t.short + ' short</strong> on the whips\u2019 own count, with ' + t.total +
            ' members sitting. A bloc that has not pledged drifts back every week you spend somewhere else.'
          : 'You have it on today\u2019s count, which is not the same as having it on the day.') +
        (b.concessions
          ? ' ' + b.concessions + ' clause' + (b.concessions === 1 ? '' : 's') + ' already gone.'
          : '') +
      '</p>' +
      '<div class="blocs">' + b.blocs.map(blocRow).join('') + '</div>' +
      '</div>';
    return h;
  }

  function blocRow(x) {
    var cls = x.pledged ? 'yes' : (x.lean > 0 ? 'lean' : 'no');
    var w = Math.max(2, Math.min(100, (x.lean + 100) / 2));
    return '<div class="bloc ' + cls + '">' +
      '<div class="bloc-top"><span class="bloc-n">' + esc(x.name) +
        (x.pledged ? '<span class="bloc-tag">pledged</span>' : '') + '</span>' +
        '<span class="bloc-s">' + x.seats + '</span></div>' +
      '<div class="bloc-bar"><span class="' + (x.pledged ? 'yes' : (x.lean > 0 ? '' : 'no')) +
        '" style="width:' + w + '%"></span></div>' +
      '<div class="bloc-d">' + esc(x.note) +
        (x.worked ? ' \u00b7 worked ' + x.worked + ' time' + (x.worked === 1 ? '' : 's') : '') +
        (x.how === 'concession' ? ' \u00b7 bought with a clause' : '') +
        (x.how === 'extort' ? ' \u00b7 they had no choice' : '') + '</div>' +
      '</div>';
  }

  // The seat, broken into the places it is actually made of. This is the whole
  // reason the sprint exists: a number for the constituency tells you nothing
  // about which afternoon to spend where.
  function wardBoard(S, c) {
    var sp = S.sprint;
    var t = RZ.sprint.tally(S);
    var wk = RZ.sprint.WEEKS - sp.weeksLeft + 1;
    var lead = t.support >= 50;

    var h = '<div class="sprint">' +
      '<div class="sprint-top">' +
        '<div><div class="sprint-k">Week ' + Math.min(wk, RZ.sprint.WEEKS) + ' of ' + RZ.sprint.WEEKS + '</div>' +
        '<div class="sprint-h">' + esc(c.regionById[S.player.regionId].name) + '</div></div>' +
        '<div class="sprint-poll ' + (lead ? 'up' : 'down') + '">' + RZ.round(t.support, 1) + '%' +
        '<small>' + (lead ? 'ahead' : 'behind') + '</small></div>' +
      '</div>' +
      '<div class="sprint-bar"><span style="width:' + Math.max(2, Math.min(100, t.support)) + '%"></span></div>' +
      '<p class="note" style="margin:8px 0 0">' + t.voters.toLocaleString() + ' likely voters across ' +
        sp.wards.length + ' wards. A ward you do not visit is one somebody else is visiting.</p>' +
      warChest(S, c, sp) +
      '<div class="wards">' + sp.wards.slice().sort(function (a, b) { return a.support - b.support; })
        .map(function (w) { return wardRow(S, w); }).join('') + '</div>' +
      '</div>';
    return h;
  }

  // What is left, where it came from, and how much of it will survive being
  // looked at afterwards.
  function warChest(S, c, sp) {
    var w = sp.war;
    var sym = c.cur.sym;
    var dirtyPct = w.raised ? Math.round((100 * w.dirty) / w.raised) : 0;
    var low = w.cash < RZ.engine.mkApi(S).wage(1.5);
    return '<div class="chest">' +
      '<div class="chest-row">' +
        '<div class="chest-k">War chest</div>' +
        '<div class="chest-v ' + (low ? 'low' : '') + '">' + esc(RZ.money(w.cash, sym)) + '</div>' +
      '</div>' +
      '<div class="chest-d">' +
        'raised ' + esc(RZ.money(w.raised, sym)) + ' · spent ' + esc(RZ.money(w.spent, sym)) +
        (w.personal ? ' · <span class="chest-own">' + esc(RZ.money(w.personal, sym)) + ' of it your own</span>' : '') +
      '</div>' +
      (w.dirty
        ? '<div class="chest-d chest-warn">' + dirtyPct + '% of it is money the return has no line for</div>'
        : '') +
      '</div>';
  }

  // Once you hold the seat, the ward's opinion of you is the whole game, and
  // it is made of things that either exist or do not.
  function constituencyCard(S, c) {
    var sum = RZ.ward.summary(S);
    var cls = sum.trust >= 60 ? 'good' : sum.trust >= 38 ? 'mid' : 'bad';
    var h = '<div class="consty">' +
      '<div class="consty-top">' +
        '<div><div class="sprint-k">' + esc(c.regionById[S.player.regionId].name) + '</div>' +
        '<div class="consty-mood">' + esc(sum.mood) + '</div></div>' +
        '<div class="consty-t ' + cls + '">' + sum.trust + '<small>trust</small></div>' +
      '</div>' +
      '<div class="sprint-bar"><span class="' + cls + '" style="width:' + Math.max(2, sum.trust) + '%"></span></div>';

    if (sum.building.length) {
      h += '<div class="rows" style="margin-top:11px">' + sum.building.map(function (p) {
        var left = Math.max(0, Math.ceil(p.monthsLeft));
        return '<div class="row"><span class="row-dot" style="background:' +
          (p.risk > 0.14 ? '#d8a53f' : '#4bab84') + '"></span>' +
          '<span class="row-n">' + p.ico + ' ' + esc(cap1(p.name)) + '<small>' +
            (left ? left + ' month' + (left === 1 ? '' : 's') + ' to go' : 'due any week now') +
            (p.crony ? ' · a contractor you named' : '') + '</small></span></div>';
      }).join('') + '</div>';
    } else {
      h += '<p class="note" style="margin:10px 0 0">Nothing is under construction. ' +
        'You have no budget of your own — you have to go and ask somebody who does.</p>';
    }

    if (sum.done || sum.abandoned) {
      h += '<div class="consty-tally">' +
        (sum.done ? '<span class="dlt p">' + sum.done + ' delivered</span>' : '') +
        (sum.abandoned ? '<span class="dlt n">' + sum.abandoned + ' abandoned</span>' : '') +
        '</div>';
    }
    return h + '</div>';
  }
  function cap1(x) { return x.charAt(0).toUpperCase() + x.slice(1); }

  function wardRow(S, w) {
    var cls = w.support >= 55 ? 'safe' : w.support >= 45 ? 'close' : 'losing';
    var cold = S.turn - w.lastVisit;
    return '<button class="ward ' + cls + '" data-ward="' + esc(w.id) + '">' +
      '<div class="ward-top"><span class="ward-n">' + esc(w.name) + '</span>' +
        '<span class="ward-p">' + Math.round(w.support) + '%</span></div>' +
      '<div class="ward-bar"><span style="width:' + Math.max(2, Math.min(100, w.support)) + '%"></span></div>' +
      '<div class="ward-d">' + esc(w.kindName) + ' · ' + Math.round(w.turnout) + '% turnout · ' +
        w.voters.toLocaleString() + ' voters' +
        (w.visits ? ' · visited ' + w.visits + 'x' : '') +
        (cold > 3 && w.visits ? ' · going cold' : '') + '</div>' +
      '</button>';
  }

  function paperCard(e) {
    var cls = e.kind === 'good' ? 'good' : (e.kind === 'bad' ? 'bad' : (e.kind === 'big' ? 'big' : ''));
    // A shock, a collapse, a purge, a brigade on the border: big and bad at
    // once, which is a louder card than either on its own.
    if (e.alert) cls = 'big bad';
    return '<div class="paper ' + cls + '">' +
      '<div class="paper-src"><span>' + esc(e.src || '') + '</span><span class="when">' +
        RZ.monthShort(e.date.month) + ' ' + e.date.year + '</span></div>' +
      '<h3 class="paper-h">' + esc(e.title) + '</h3>' +
      '<p class="paper-b">' + e.body + '</p>' +
      (e.deltas && e.deltas.length
        ? '<div class="paper-delta">' + e.deltas.map(function (d) {
            return '<span class="dlt ' + (d.v > 0 ? 'p' : 'n') + '">' + esc(d.label) + ' ' + RZ.signed(d.v) + '</span>';
          }).join('') + '</div>' : '') +
      '</div>';
  }

  // At the bottom of the ladder the question is not whether you are strong
  // enough, it is whether one person has written your name down. Show that
  // person, and show how far off you are, because it is the whole game down
  // here and it is invisible otherwise.
  function listCard(S) {
    if (!RZ.trenches) return '';
    var st = RZ.trenches.status(S);
    if (!st) return '';
    var tone = st.on ? 'var(--green)' : st.pct > 60 ? 'var(--gold)' : 'var(--red)';
    var h = '<div class="block"><div class="block-h">The list' +
      '<span class="sub">' + (st.on ? 'your name is on it' : 'your name is not on it') + '</span></div>' +
      '<div class="card"><div class="list-who">' +
        '<span class="list-nm">' + esc(st.full) + '</span>' +
        '<span class="list-role">' + esc(st.role) + '</span></div>' +
      '<div class="sprint-bar" style="margin:9px 0 8px">' +
        '<span style="width:' + Math.max(2, st.pct) + '%;background:' + tone + '"></span></div>' +
      '<p class="note">' + esc(st.read) + '</p>';
    if (st.bargain) {
      h += '<p class="note mt" style="color:var(--gold)">' +
        (st.bargain.kind === 'signed'
          ? 'You signed something in ' + st.bargain.year + ' that put you here.'
          : 'You pledged the ward in ' + st.bargain.year + ' to get here.') + '</p>';
    }
    if (st.chairs || st.hustles) {
      h += '<p class="note mt" style="opacity:.75">' + st.chairs + ' night' + (st.chairs === 1 ? '' : 's') +
        ' stacking chairs, ' + st.hustles + ' errand' + (st.hustles === 1 ? '' : 's') + ' run out of pocket.</p>';
    }
    return h + '</div></div>';
  }

  function contestCard() {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId];
    var st = RZ.engine.contestStatus(S);
    if (!st.rung) return '';
    var r = st.rung;
    var body;
    if (st.available) {
      body = '<p class="note">' + esc(r.desc) + '</p>' +
        '<button class="btn btn-gold btn-block mt" data-act="contest">Contest it</button>';
    } else if (st.req && !st.req.ok) {
      body = '<p class="note">' + esc(r.desc) + '</p><div class="bars mt">' +
        st.req.missing.map(function (m) {
          return barRow(labelFor(m.k), m.have, m.need);
        }).join('') + '</div>';
    } else {
      body = '<p class="note">' + esc(r.desc) + '</p><p class="note mt gold">' + esc(st.reason) + '</p>';
    }
    var viability = '';
    if (r.how === 'public' && c.house.method !== 'pr') {
      var v = RZ.engine.mkApi(S).homeViability();
      viability = '<p class="note mt" style="border-top:1px solid var(--line-soft);padding-top:9px">' +
        'In <strong>' + esc(c.regionById[S.player.regionId].name) + '</strong> your party polls ' +
        '<strong style="color:' + (v.safe ? 'var(--green)' : 'var(--red)') + '">' + RZ.round(v.mine, 1) + '%</strong>' +
        ' against ' + RZ.round(v.best, 1) + '% for the strongest rival. ' +
        (v.safe ? 'This is winnable ground.' : 'You cannot win a seat here. Move, or change party.') + '</p>';
    }
    // What your people think they can deliver. The point of showing it is that
    // contesting becomes a decision you can get wrong in either direction:
    // going too early, or waiting while somebody else gets stronger.
    var count = '';
    if (st.count) {
      var sh = st.count.share;
      var tone = sh >= 55 ? 'var(--green)' : sh >= 45 ? 'var(--gold)' : 'var(--red)';
      var read = sh >= 62 ? 'That is comfortable, if the count is honest.'
               : sh >= 52 ? 'That wins it, narrowly, and narrow counts have been wrong before.'
               : sh >= 45 ? 'That is too close to call, and the room will decide it on the day.'
               : sh >= 35 ? 'That loses. Not by enough to be hopeless — by enough to be humiliating.'
               : 'That is not a contest, it is a demonstration.';
      count = '<div class="whip"><div class="whip-h">The count' +
        '<span class="sub">' + (st.count.soft ? 'thin, from people who guess' : 'firm, from people who know') + '</span></div>' +
        '<div class="whip-bar"><span style="width:' + RZ.clamp(sh, 0, 100) + '%;background:' + tone + '"></span></div>' +
        '<p class="note">Your organisers count <strong style="color:' + tone + '">' +
        (st.count.soft ? 'somewhere around ' : 'roughly ') + Math.round(sh) + '%</strong>. ' + read +
        (st.count.soft ? ' Build the party structures and a slate, and the counting itself gets better.' : '') +
        '</p></div>';
    }

    // The rung is not empty and never was. Say whose chair it is.
    var against = '';
    if (st.against && r.how !== 'auto') {
      var a = st.against;
      var line = a.incumbent
        ? '<strong>' + esc(a.name) + '</strong> holds it' + (a.region ? ', out of ' + esc(a.region) : '') + '.'
        : '<strong>' + esc(a.name) + '</strong>, ' + esc(a.role) + ', wants it too.';
      var read = a.wounded ? 'They are wounded, and a wounded incumbent is a beatable one.'
               : a.strength > 74 ? 'They are strong. Taking this off them now would be a surprise.'
               : a.strength > 55 ? 'They are solid, but not untouchable.'
               : 'They are weaker than the office they are sitting in.';
      against = '<p class="note mt" style="border-top:1px solid var(--line-soft);padding-top:9px">' +
        line + ' ' + read + (a.file ? ' <span class="gold">You hold a file on them.</span>' : '') + '</p>';
    }
    return '<div class="card" style="border-left:3px solid var(--gold)">' +
      '<div class="block-h" style="margin:0 0 8px">Next rung<span class="sub">' + howLabel(r.how, c) + '</span></div>' +
      '<div style="font-family:var(--serif);font-size:1.12rem;font-weight:600;margin-bottom:6px">' + esc(r.title) + '</div>' +
      body + count + against + viability + '</div>';
  }

  function howLabel(how, c) {
    return { internal: 'branch vote', conference: c.terms.conference, appoint: 'in the leader’s gift', public: 'public ballot', auto: '' }[how] || '';
  }
  function labelFor(k) {
    return { grassroots: 'Grassroots', party: 'Party standing', leader: 'Leadership', fame: 'Public profile',
             media: 'Media', business: 'Business', security: 'Security', intl: 'International' }[k] || k;
  }
  function barRow(label, have, need, cls) {
    var pctv = Math.min(100, have / (need || 100) * 100);
    return '<div class="bar-row"><span class="bar-k">' + esc(label) + '</span>' +
      '<span class="bar-t"><span class="bar-f ' + (cls || (pctv >= 100 ? 'g' : '')) + '" style="width:' + pctv + '%"></span></span>' +
      '<span class="bar-v">' + Math.round(have) + (need ? '/' + need : '') + '</span></div>';
  }
  function plainBar(label, v, cls) {
    return '<div class="bar-row"><span class="bar-k">' + esc(label) + '</span>' +
      '<span class="bar-t"><span class="bar-f ' + (cls || '') + '" style="width:' + RZ.clamp(v, 0, 100) + '%"></span></span>' +
      '<span class="bar-v">' + Math.round(v) + '</span></div>';
  }

  function bindDesk() {
    var host = el('#pane-desk');
    host.querySelectorAll('[data-action]').forEach(function (b) {
      b.addEventListener('click', function () { RZ.main.act(b.dataset.action); });
    });
    host.querySelectorAll('[data-decline]').forEach(function (b) {
      b.addEventListener('click', function () { RZ.main.decline(b.dataset.decline); });
    });
    host.querySelectorAll('[data-act="end-turn"]').forEach(function (b) {
      b.addEventListener('click', RZ.main.endTurn);
    });
    host.querySelectorAll('[data-act="contest"]').forEach(function (b) {
      b.addEventListener('click', RZ.main.contest);
    });
  }

  /* ---------------- nation pane ---------------- */
  function renderCountry() {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId], n = S.nation;
    var h = '';

    h += '<div class="block"><div class="block-h">' + esc(c.name) + '<span class="sub">' +
      esc(n.presidentName) + ', ' + esc(c.terms.hos) + '</span></div>' +
      '<div class="sgrid">' +
        sbox('Approval', Math.round(n.govApproval) + '%', 'of the government') +
        sbox('Growth', RZ.round(n.economy.growth, 1) + '%', 'GDP, annual') +
        sbox('Inflation', RZ.round(n.economy.inflation, 1) + '%', 'headline') +
        sbox('Unemployed', Math.round(n.economy.unemployment) + '%', 'official rate') +
        sbox('Debt', Math.round(n.economy.debt) + '%', 'of GDP') +
        sbox('Reserves', RZ.round(n.economy.reserves, 1), 'months of imports') +
      '</div></div>';

    h += blocBoard(S);

    h += '<div class="block"><div class="block-h">Condition of the state</div><div class="card"><div class="bars">' +
      plainBar('Health system', n.society.health, 'g') +
      plainBar('Schools', n.society.education, 'g') +
      plainBar('Infrastructure', n.society.infra, 'g') +
      plainBar('Courts', n.society.judiciary, 'b') +
      plainBar('Clean count', n.society.electoral, 'b') +
      plainBar('Corruption', n.society.corruption, 'r') +
      plainBar('Unrest', n.society.unrest, 'r') +
      (c.inst.security > 45 ? plainBar('Coup risk', n.society.coup, 'r') : '') +
      '</div></div></div>';

    var totalSeats = RZ.sum(c.parties, function (p) { return S.parties[p.id].seats; });
    h += '<div class="block"><div class="block-h">' + esc(c.house.name) +
      '<span class="sub">' + totalSeats + ' seats · next election ' + S.nextElection + '</span></div><div class="card"><div class="rows">' +
      c.parties.slice().sort(function (a, b) { return S.parties[b.id].seats - S.parties[a.id].seats; }).map(function (p) {
        var st = S.parties[p.id];
        return '<div class="row"><span class="row-dot" style="background:' + p.color + '"></span>' +
          '<span class="row-n">' + esc(p.abbr) + (st.gov ? ' <span class="gold">· in government</span>' : '') +
          '<small>' + esc(st.leaderName) + (p.id === S.player.partyId ? ' — your party' : '') + '</small></span>' +
          '<span class="row-v">' + st.seats + ' · ' + RZ.round(st.vote, 1) + '%</span></div>';
      }).join('') + '</div></div></div>';

    h += '<div class="block"><div class="block-h">Your strength by ' + esc(c.terms.region) + '</div><div class="card"><div class="bars">' +
      c.regions.map(function (r) {
        return plainBar(r.name, S.player.regionSupport[r.id] || 0, r.id === S.player.regionId ? '' : 'b');
      }).join('') + '</div></div></div>';

    if (n.intl.imf || n.intl.sanctions > 0) {
      h += '<div class="block"><div class="card"><p class="note">' +
        (n.intl.imf ? '<strong>Under an IMF programme.</strong> Conditionality applies to every budget line. ' : '') +
        (n.intl.sanctions > 0 ? '<strong>Sanctions in force</strong> against individuals and entities (' + Math.round(n.intl.sanctions) + '/100 severity).' : '') +
        '</p></div></div>';
    }

    el('#pane-country').innerHTML = h;
  }
  // Six electorates rather than one bar. The size is how many of them there
  // are; the mood is what they currently think; and the swing at the top is
  // what the two of those together are worth on the day.
  function blocBoard(S) {
    if (!RZ.blocs) return '';
    var sm = RZ.blocs.summary(S);
    var cls = sm.swing >= 2 ? 'good' : sm.swing <= -2 ? 'bad' : 'mid';
    return '<div class="block"><div class="block-h">The electorate' +
      '<span class="sub">' + (sm.swing >= 0 ? '+' : '') + sm.swing + ' pts on the ballot</span></div>' +
      '<div class="card">' +
      '<p class="note" style="margin:0 0 12px">There is no such thing as the grassroots. There are six of these ' +
      'and they want different things, and every one of them votes.</p>' +
      '<div class="rows">' + sm.rows.map(function (r) {
        var mc = r.mood >= 62 ? 'good' : r.mood >= 42 ? 'mid' : 'bad';
        return '<div class="bloc-row">' +
          '<div class="bloc-row-t"><span class="bloc-row-n">' + r.ico + ' ' + esc(r.name) + '</span>' +
            '<span class="bloc-row-s">' + r.size + '%</span></div>' +
          '<div class="bloc-bar"><span class="' + (mc === 'good' ? 'yes' : mc === 'bad' ? 'no' : '') +
            '" style="width:' + Math.max(2, r.mood) + '%"></span></div>' +
          '<div class="bloc-row-d">' + esc(r.mood_label) + ' · ' + esc(r.note) +
            (r.turnout >= 1.2 ? ' <span class="gold">They turn out.</span>' :
             r.turnout <= 0.8 ? ' <span class="dim">Half of them will not vote.</span>' : '') +
          '</div></div>';
      }).join('') + '</div>' +
      '<p class="note" style="margin:12px 0 0">Weighted for who actually goes to the polling station: ' +
      '<strong class="' + cls + '">' + sm.weighted + '</strong> out of a hundred.</p>' +
      '</div></div>';
  }

  function sbox(k, v, n) {
    return '<div class="sbox"><div class="sbox-k">' + esc(k) + '</div><div class="sbox-v">' + esc(v) + '</div><div class="sbox-n">' + esc(n) + '</div></div>';
  }

  /* ---------------- party pane ---------------- */
  function renderParty() {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId], P = S.player;
    var lad = RZ.ladderFor(c.id);
    var mine = c.partyById[P.partyId];
    var h = '';

    h += '<div class="block"><div class="block-h">' + esc(mine.abbr) +
      '<span class="sub">' + (S.parties[P.partyId].gov ? 'in government' : 'in opposition') + '</span></div>' +
      '<div class="card"><p class="note">' + esc(mine.name) + ' — ' + esc(mine.ideo) + '.</p>' +
      '<div class="bars mt">' +
        plainBar('Vote share', S.parties[P.partyId].vote) +
        plainBar('Machine', S.parties[P.partyId].machine, 'b') +
        plainBar('Your standing', P.standing.party, 'g') +
        plainBar('The leader’s regard', P.standing.leader, 'g') +
      '</div>' +
      '<p class="note mt">Led by <strong>' + esc(P.isLeader ? P.name : S.parties[P.partyId].leaderName) + '</strong>.</p>' +
      '</div></div>';

    h += raceCard(S, c);

    h += '<div class="block"><div class="block-h">The ladder<span class="sub">' + esc(c.name) + '</span></div><div class="card"><div class="ladder">' +
      lad.map(function (r, i) {
        var cls = i < P.rungIdx ? 'done' : (i === P.rungIdx ? 'now' : 'future');
        return '<div class="rung ' + cls + '"><div class="rung-mark"><div class="rung-dot"></div>' +
          (i < lad.length - 1 ? '<div class="rung-line"></div>' : '') + '</div>' +
          '<div class="rung-body"><div class="rung-t">' + esc(r.title) + '</div>' +
          (i <= P.rungIdx + 1 ? '<div class="rung-d">' + esc(r.desc) + '</div>' : '') + '</div></div>';
      }).join('') + '</div></div></div>';

    h += castCard(S);

    // The field: the people holding the rungs above you, and the ones coming
    // up behind. A rung with a name on it is the whole game.
    var field = RZ.field.ours(S);
    if (field.length) {
      var shown = RZ.field.strongestFirst(field)
        .filter(function (f) { return f.rungIdx >= P.rungIdx - 1; })
        .sort(function (a, b) { return b.rungIdx - a.rungIdx; })
        .slice(0, 12);
      h += '<div class="block"><div class="block-h">The field<span class="sub">' + field.length +
        ' in the movement</span></div><div class="card"><div class="rows">' +
        shown.map(function (f) {
          var tags = [];
          if (f.side === 'rival') tags.push('<span class="red">against you</span>');
          if (f.side === 'ally') tags.push('<span class="green">on your slate</span>');
          if (f.dirt.some(function (d) { return !d.used; })) tags.push('<span class="gold">you hold a file</span>');
          if (f.wounded > 0) tags.push('wounded');
          var dot = f.side === 'rival' ? '#d4453f' : (f.side === 'ally' ? '#4bab84' : '#6b7787');
          return '<div class="row"><span class="row-dot" style="background:' + dot + '"></span>' +
            '<span class="row-n">' + esc(f.name) + '<small>' + esc(f.role) +
            (f.regionId && c.regionById[f.regionId] ? ' · ' + esc(c.regionById[f.regionId].name) : '') +
            (tags.length ? ' · ' + tags.join(' · ') : '') + '</small></span>' +
            '<span class="row-v">' + Math.round(f.power) + '</span></div>';
        }).join('') + '</div>' +
        '<p class="note mt">Strength is what they can bring to a vote. It is not fixed: ' +
        'it is spent, lost and rebuilt exactly like yours.</p></div></div>';
    }

    var gone = (S.field || []).filter(function (f) { return f.retired; }).slice(-5).reverse();
    if (gone.length) {
      var FATE = { beaten: 'beaten by you', disgrace: 'destroyed by a story', faded: 'faded out',
                   died: 'died in office', quit: 'walked away' };
      h += '<div class="block"><div class="block-h">Off the board</div><div class="card"><div class="rows">' +
        gone.map(function (f) {
          return '<div class="row"><span class="row-dot" style="background:#3a4250"></span>' +
            '<span class="row-n">' + esc(f.name) + '<small>' + esc(f.role) + ' · ' +
            esc(FATE[f.fate] || 'gone') + ', ' + f.retiredYear + '</small></span></div>';
        }).join('') + '</div></div></div>';
    }

    el('#pane-party').innerHTML = h;
  }

  /* ---------------- self pane ---------------- */
  // Two bars on one axis. A number for your own climb tells you nothing; a
  // number next to somebody else's tells you everything.
  // The people you keep going back to. Sorted by how often you have sat down
  // with them, because that is the order in which they matter.
  function castCard(S) {
    if (!RZ.cast) return '';
    var rows = RZ.cast.summary(S);
    if (!rows.length) return '';
    return '<div class="block"><div class="block-h">People you know' +
      '<span class="sub">' + rows.length + ' of them</span></div>' +
      '<div class="card"><div class="rows">' + rows.slice(0, 14).map(function (p) {
        var col = p.rel >= 25 ? '#4bab84' : p.rel <= -25 ? '#d4453f' : '#8a8578';
        return '<div class="row"><span class="row-dot" style="background:' + col + '"></span>' +
          '<span class="row-n">' + esc(p.name) + '<small>' + esc(p.role) +
            (p.org ? ', ' + esc(p.org) : '') + ' · ' + esc(p.standing) +
            (p.met > 1 ? ' · ' + p.met + ' meetings since ' + p.since : '') +
            (p.memory ? ' · <span class="gold">remembers ' + p.memory + '</span>' : '') +
          '</small></span>' +
          '<span class="row-v">' + (p.rel > 0 ? '+' : '') + p.rel + '</span></div>';
      }).join('') + '</div></div></div>';
  }

  function raceCard(S, c) {
    if (!RZ.contender) return '';
    var sm = RZ.contender.summary(S);
    if (!sm) return '';
    var cls = sm.gap > 0 ? 'bad' : sm.gap < 0 ? 'good' : 'mid';
    var rel = sm.ascended ? 'they got there first'
      : sm.relation === 'allied' ? 'running together, for now'
      : sm.relation === 'hostile' ? 'openly against you'
      : sm.sameParty ? 'same party card, same year' : 'the other side, same year';

    return '<div class="block"><div class="block-h">The other one' +
      '<span class="sub">' + esc(rel) + '</span></div>' +
      '<div class="card race">' +
        '<div class="race-top">' +
          '<div><div class="race-n">' + sm.ico + ' ' + esc(sm.name) + '</div>' +
          '<div class="race-r">' + esc(sm.title) + ' · ' + esc(sm.regionName) + '</div></div>' +
          '<div class="race-gap ' + cls + '">' + (sm.gap > 0 ? '+' + sm.gap : sm.gap) +
          '<small>' + esc(sm.standing) + '</small></div>' +
        '</div>' +
        '<div class="race-lane"><span class="me" style="width:' + Math.max(2, sm.yourPct) + '%"></span>' +
          '<b>you</b></div>' +
        '<div class="race-lane"><span class="them" style="width:' + Math.max(2, sm.pct) + '%"></span>' +
          '<b>' + esc(sm.name.split(' ')[0]) + '</b></div>' +
        '<p class="note" style="margin:10px 0 0">They climb ' + esc(sm.climbs) + ', which is the one thing ' +
          'you cannot do.' + (sm.files ? ' You are holding <span class="gold">' + sm.files +
          ' file' + (sm.files === 1 ? '' : 's') + '</span> on them.' : '') + '</p>' +
        (sm.lastMove ? '<p class="note" style="margin:6px 0 0;opacity:.8">Last month: ' + esc(sm.lastMove) + '.</p>' : '') +
      '</div></div>';
  }

  // The household. It is on the "You" pane rather than the desk because it is
  // not something you do — it is something that is happening to you while you
  // do everything else.
  function familyBlock(S) {
    if (!RZ.family) return '';
    var f = RZ.family.summary(S);
    if (!f) return '';
    var tone = f.left ? 'r' : f.patience > 60 ? 'g' : f.patience > 30 ? '' : 'r';
    var h = '<div class="block"><div class="block-h">Home' +
      '<span class="sub">' + f.kin + ' depending on you</span></div><div class="card">';
    if (f.spouse) {
      h += '<div class="list-who"><span class="list-nm">' + esc(f.spouseFull) + '</span>' +
        '<span class="list-role">' + (f.left ? 'left in ' + f.leftYear : 'married to this career') +
        '</span></div>';
      if (!f.left) {
        h += '<div class="bars mt">' + plainBar('Patience', f.patience, tone) + '</div>';
      }
    }
    h += '<p class="note mt">' + esc(f.read) + '</p>';
    if (f.paid || f.refused) {
      h += '<p class="note" style="opacity:.75">' + f.paid + ' asked and paid, ' +
        f.refused + ' turned away.</p>';
    }
    if (f.tender) {
      h += '<p class="note mt" style="color:' +
        (f.tender.kind === 'cancelled' ? 'var(--green)' : 'var(--red)') + '">' +
        ({ stood: 'You let the contract stand in ' + f.tender.year + '.',
           cancelled: 'You cancelled the contract in ' + f.tender.year + '.',
           denied: 'You said you knew nothing about it, in ' + f.tender.year + '.' }[f.tender.kind] || '') +
        '</p>';
    }
    return h + '</div></div>';
  }

  function renderSelf() {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId], P = S.player;
    var lad = RZ.ladderFor(c.id), rung = lad[P.rungIdx];
    var bg = RZ.bgById[P.bgId];
    var h = '';

    h += '<div class="block"><div class="card">' +
      '<div style="font-family:var(--serif);font-size:1.3rem;font-weight:600">' + esc(P.name) + '</div>' +
      '<p class="note">' + esc(rung.title) + ' · age ' + P.age + ' · ' + bg.ico + ' former ' + esc(bg.name.toLowerCase()) +
      ' from ' + esc(c.regionById[P.regionId].name) + '</p></div></div>';

    h += familyBlock(S);

    h += '<div class="block"><div class="block-h">Attributes</div><div class="card"><div class="bars">' +
      plainBar('Oratory', P.stats.oratory) + plainBar('Charisma', P.stats.charisma) +
      plainBar('Intellect', P.stats.intellect) + plainBar('Cunning', P.stats.cunning) +
      plainBar('Grit', P.stats.grit) + plainBar('Integrity', P.stats.integrity, P.stats.integrity > 55 ? 'g' : 'r') +
      '</div></div></div>';

    h += '<div class="block"><div class="block-h">Standing</div><div class="card"><div class="bars">' +
      plainBar('Grassroots', P.standing.grassroots, 'g') +
      plainBar('Party', P.standing.party, 'g') +
      plainBar('Leadership', P.standing.leader, 'g') +
      plainBar('Media', P.standing.media, 'b') +
      plainBar('Business', P.standing.business, 'b') +
      plainBar('Security', P.standing.security, 'b') +
      plainBar('International', P.standing.intl, 'b') +
      '</div></div></div>';

    // Where you stand inside the machine right now: the window a mandate buys,
    // the year a failed revolt costs, and the man who has not forgotten.
    var status = [];
    if (S.flags.seatOwed) {
      status.push('The region paid for your seat in ' + S.flags.seatOwedYear +
        '. Everybody in that caucus knows it, and it is worth twelve points against you ' +
        'the day you try to move on the leadership.');
    }
    if (RZ.revolt) {
      var now = RZ.revolt.monthIndex(S);
      if (RZ.revolt.mandateActive(S)) {
        status.push(['#4bab84', 'Mandate', (S.flags.mandateUntil - now) + ' months left · party and leadership hold at half decay']);
      }
      if (RZ.revolt.pngActive(S)) {
        status.push(['#d4453f', 'Persona non grata', (S.flags.pngUntil - now) + ' months left · your name is a liability in the corridors']);
      }
      if (S.flags.exiled) {
        status.push(['#d8a53f', 'Deployed', 'Reassigned to ' + esc(c.regionById[P.regionId].name) + ' after a failed challenge']);
      }
      var nem = RZ.revolt.nemesisOf(S);
      if (nem) status.push(['#d4453f', 'Nemesis: ' + esc(nem.name), 'Spends his own turns on you, and will until one of you is gone']);
    }
    if (status.length) {
      h += '<div class="block"><div class="block-h">Where you stand</div><div class="card"><div class="rows">' +
        status.map(function (x) {
          return '<div class="row"><span class="row-dot" style="background:' + x[0] + '"></span>' +
            '<span class="row-n">' + x[1] + '<small>' + x[2] + '</small></span></div>';
        }).join('') + '</div></div></div>';
    }

    // Everything you said out loud in a meeting, still outstanding.
    var proms = P.promises || [];
    if (proms.length) {
      h += '<div class="block"><div class="block-h">What you promised<span class="sub">' +
        proms.length + ' outstanding</span></div><div class="card"><div class="rows">' +
        proms.map(function (pr) {
          var months = (S.date.year * 12 + S.date.month) - (pr.year * 12 + pr.month);
          return '<div class="row"><span class="row-dot" style="background:' +
            (months >= 10 ? '#d4453f' : months >= 5 ? '#d8a53f' : '#4bab84') + '"></span>' +
            '<span class="row-n">' + esc(pr.text) + '<small>' + RZ.monthShort(pr.month) + ' ' + pr.year + '</small></span>' +
            '<span class="row-v">' + months + 'mo</span></div>';
        }).join('') + '</div></div></div>';
    }

    // Money taken during a campaign, and what is still owed on it.
    var pats = (S.capture && S.capture.patrons || []).filter(function (x) { return x.owed > 0.5; });
    if (pats.length) {
      h += '<div class="block"><div class="block-h">Who owns a piece of you<span class="sub">' +
        pats.length + '</span></div><div class="card"><div class="rows">' +
        pats.slice().sort(function (a, b) { return b.owed - a.owed; }).map(function (x) {
          var hot = x.owed > 8 ? '#d4453f' : x.owed > 4 ? '#d8a53f' : '#4bab84';
          return '<div class="row"><span class="row-dot" style="background:' + hot + '"></span>' +
            '<span class="row-n">' + esc(x.name) + '<small>' +
              (x.granted ? x.granted + ' favour' + (x.granted === 1 ? '' : 's') + ' done' : 'nothing asked yet') +
              (x.refused ? ' · ' + x.refused + ' refused' : '') + '</small></span>' +
            '<span class="row-v">' + '◆'.repeat(Math.min(5, Math.ceil(x.owed / 3))) + '</span></div>';
        }).join('') + '</div></div></div>';
    }

    h += '<div class="block"><div class="block-h">What could destroy you<span class="sub">' + P.dirt.length + ' item' + (P.dirt.length === 1 ? '' : 's') + '</span></div>';
    if (!P.dirt.length) {
      h += '<div class="card"><p class="note">Nothing. For now.</p></div>';
    } else {
      h += '<div class="card"><div class="rows">' + P.dirt.map(function (d) {
        return '<div class="row"><span class="row-dot" style="background:' + (d.exposed ? '#d4453f' : '#d8a53f') + '"></span>' +
          '<span class="row-n">' + esc(d.label) + '<small>' + (d.exposed ? 'public' : 'not yet public') + ' · ' + d.year + '</small></span>' +
          '<span class="row-v">' + '◆'.repeat(Math.min(5, d.severity)) + '</span></div>';
      }).join('') + '</div></div>';
    }
    h += '</div>';

    if (P.record.length) {
      h += '<div class="block"><div class="block-h">Career</div><div class="card"><div class="rows">' +
        P.record.slice().reverse().map(function (r) {
          return '<div class="row"><span class="row-n">' + esc(r.text) + '</span><span class="row-v">' + r.year + '</span></div>';
        }).join('') + '</div></div></div>';
    }

    h += '<div class="block"><button class="btn btn-danger btn-block" data-act="abandon">Abandon this career</button></div>';

    el('#pane-self').innerHTML = h;
    el('#pane-self').querySelectorAll('[data-act="abandon"]').forEach(function (b) {
      b.addEventListener('click', RZ.main.abandon);
    });
  }

  /* ---------------- event modal ---------------- */
  function showEvent(ev, onChoose) {
    var html = '<div class="modal-kicker">' + esc(ev.kicker || 'Situation') + '</div>' +
      '<h2 class="modal-h">' + esc(ev.title) + '</h2>' +
      '<p class="modal-b">' + ev.body + '</p>' +
      '<div class="choices">' + ev.choices.map(function (ch) {
        return '<button class="choice" data-i="' + ch.i + '"' + (ch.ok ? '' : ' disabled') + '>' +
          '<div class="choice-t">' + esc(ch.t) + '</div>' +
          '<div class="choice-d">' + esc(ch.d || '') + '</div>' +
          (ch.tag ? '<span class="choice-tag ' + (ch.tag === 'risk' ? 'risk' : 'cost') + '">' + esc(ch.tag) + '</span>' : '') +
          '</button>';
      }).join('') + '</div>';
    var inner = modal(html);
    inner.querySelectorAll('[data-i]').forEach(function (b) {
      b.addEventListener('click', function () { onChoose(parseInt(b.dataset.i, 10)); });
    });
  }

  function showOutcome(entry, onClose) {
    var html = '<div class="modal-kicker">' + esc(entry.src || 'Outcome') + '</div>' +
      '<h2 class="modal-h">' + esc(entry.title) + '</h2>' +
      '<p class="modal-b">' + entry.body + '</p>' +
      (entry.deltas && entry.deltas.length ? '<div class="paper-delta" style="margin-bottom:16px">' +
        entry.deltas.map(function (d) { return '<span class="dlt ' + (d.v > 0 ? 'p' : 'n') + '">' + esc(d.label) + ' ' + RZ.signed(d.v) + '</span>'; }).join('') +
        '</div>' : '') +
      '<button class="btn btn-gold btn-block" data-close>Continue</button>';
    var inner = modal(html);
    inner.querySelector('[data-close]').addEventListener('click', function () { closeModal(); if (onClose) onClose(); });
  }

  /* ---------------- the origin scene ---------------- */
  // Character creation as an afternoon rather than a menu. Rendered with the
  // conversation styles, because that is what it is.
  function showOrigin(startAs, draft, onDone) {
    var c = RZ.COUNTRIES[draft.countryId];
    var o = RZ.ORIGINS[startAs === 'candidate' ? 'candidate' : 'activist'];
    var kingmaker = RZ.makeName(c);
    var priceLine = RZ.money(RZ.engine.WAGE_BASE[c.id] * 0.5, c.cur.sym);
    var inner = modal('');
    var chosen = null;

    paint();

    function paint() {
      var h = '<div class="modal-kicker">' + esc(o.kicker) + '</div>' +
        '<h2 class="modal-h">' + esc(o.title(c)) + '</h2>' +
        '<div class="talk">' +
          para(o.opening(c, draft.name, kingmaker)) +
          (chosen ? '' : para(o.question(c))) +
        '</div>';

      if (!chosen) {
        h += '<div class="choices">' + o.answers.map(function (a, i) {
          return '<button class="choice" data-i="' + i + '">' +
            '<div class="choice-t">' + esc(a.t) + '</div>' +
            '<div class="choice-d">' + esc(a.d) + '</div></button>';
        }).join('') + '</div>';
      } else {
        var tr = RZ.TRAITS[chosen.trait];
        h += '<div class="talk">' + para(chosen.reply(c, c.cur.sym, priceLine), 'me') + '</div>' +
          '<div class="origin-trait">' +
            '<div class="origin-trait-n">' + tr.ico + ' ' + esc(tr.name) + '</div>' +
            '<div class="origin-trait-d">' + esc(tr.note) + '</div>' +
          '</div>' +
          // The answer decides who else is starting this year. You are told
          // now, so that the first feed entry about them is not a surprise.
          counterNote(chosen.trait) +
          '<button class="btn btn-gold btn-block" data-go>This is where it starts</button>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:8px" data-back>Answer differently</button>';
      }

      inner.innerHTML = h;
      inner.querySelectorAll('[data-i]').forEach(function (b) {
        b.addEventListener('click', function () {
          chosen = o.answers[parseInt(b.dataset.i, 10)];
          paint();
          inner.scrollTop = inner.scrollHeight;
        });
      });
      var back = inner.querySelector('[data-back]');
      if (back) back.addEventListener('click', function () { chosen = null; paint(); });
      var go = inner.querySelector('[data-go]');
      if (go) go.addEventListener('click', function () { closeModal(); onDone(chosen.id); });
    }

    // The scenes are written as prose with blank lines between paragraphs.
    function para(text, who) {
      return String(text).split(/\n\n+/).map(function (p) {
        return '<div class="talk-l ' + (who === 'me' ? 'me closing' : 'them') + '">' +
          '<div class="talk-tx">' + esc(p) + '</div></div>';
      }).join('');
    }
  }

  /* ---------------- the ward blitz ---------------- */
  // Which afternoon, in which place. The list is sorted worst-first, because
  // the ward you are losing is the one worth the argument.
  // What the answer just made somebody else. There is one of each of the jobs
  // at the top and there are two of you starting today.
  function counterNote(trait) {
    if (!RZ.contender) return '';
    var other = RZ.TRAITS[RZ.contender.COUNTER[trait]];
    if (!other) return '';
    var climbs = RZ.contender.STYLES[other.id] ? RZ.contender.STYLES[other.id].climbs : '';
    return '<p class="note" style="margin:12px 0 0">And somewhere else in the country, in a ' +
      'different ' + esc(RZ.COUNTRIES[UI.draft.countryId].terms.region) + ', somebody the same age as you is ' +
      'starting today as a <strong>' + other.ico + ' ' + esc(other.name) + '</strong> — they climb ' +
      esc(climbs) + ', which is the one thing you have just decided you cannot do. ' +
      'You will hear the name within the month.</p>';
  }

  function showBlitz(onDone, mode) {
    var S = UI.S;
    var api = RZ.engine.mkApi(S);
    var wards = S.sprint.wards.slice().sort(function (a, b) { return a.support - b.support; });
    var surge = mode === 'surge';
    var cost = api.wage(surge ? 4 + api.tier() * 0.5 : 1.2 + api.tier() * 0.35);

    var h = '<div class="modal-kicker">Week ' + S.sprint.week + ' of ' + RZ.sprint.WEEKS + '</div>' +
      '<h2 class="modal-h">' + (surge ? 'Which ward gets the war chest?' : 'Where are you spending the week?') + '</h2>' +
      '<p class="modal-b">' + (surge
        ? 'Everything at one ward, and it stays held for the rest of the campaign. About ' +
          esc(RZ.money(cost, RZ.COUNTRIES[S.countryId].cur.sym)) + ' and a good deal of political capital.'
        : 'Doors, taxi ranks, a hall if you can get one. About ' +
          esc(RZ.money(cost, RZ.COUNTRIES[S.countryId].cur.sym)) + ' a ward, and you cannot be in two places at once.') +
      '</p>' +
      '<div class="choices">' + wards.map(function (w) {
        var cold = S.turn - w.lastVisit;
        return '<button class="choice" data-w="' + esc(w.id) + '">' +
          '<div class="choice-t">' + esc(w.name) + ' <span style="float:right;opacity:.8">' + Math.round(w.support) + '%</span></div>' +
          '<div class="choice-d">' + esc(w.note) + '</div>' +
          '<div class="choice-d" style="opacity:.75;margin-top:4px">' +
            Math.round(w.turnout) + '% turnout · ' + w.voters.toLocaleString() + ' voters' +
            (w.visits ? ' · you have been ' + w.visits + ' time' + (w.visits === 1 ? '' : 's') : ' · never visited') +
            (w.visits && cold <= 2 && !surge ? ' · still warm, less to gain' : '') +
            (w.held ? ' · held' : '') + '</div>' +
          (w.swing >= 1.25 ? '<span class="choice-tag">swings hard</span>' : '') +
          '</button>';
      }).join('') + '</div>' +
      '<button class="btn btn-ghost btn-block" style="margin-top:10px" data-cancel>Not this week</button>';

    var inner = modal(h);
    inner.querySelectorAll('[data-w]').forEach(function (b) {
      b.addEventListener('click', function () { closeModal(); onDone(b.dataset.w); });
    });
    inner.querySelector('[data-cancel]').addEventListener('click', function () { closeModal(); onDone(null); });
  }

  /* ---------------- constitutional amendment ---------------- */
  // The arithmetic is shown before the decision, because a president who tries
  // this and misses should have been able to count first.
  function showAmend(onDone) {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId];
    var api = RZ.engine.mkApi(S);
    var sup = RZ.gov.assemblySupport(S);
    var list = RZ.gov.amendmentsFor(api);
    var pickId = list[0] && list[0].id;
    var spend = 0;
    var inner = modal('');

    paint();

    function paint() {
      var gap = Math.max(0, sup.needed - sup.gov);
      var h = '<div class="modal-kicker">The ' + esc(c.house.name) + '</div>' +
        '<h2 class="modal-h">Amend the constitution</h2>' +
        '<p class="modal-b">An amendment needs <strong>' + sup.needed + ' of ' + sup.total + '</strong> — two-thirds. ' +
        'The government benches carry <strong>' + sup.gov + '</strong>' +
        (gap ? ', which leaves you <strong>' + gap + '</strong> short before anybody on your own side abstains.'
             : ', which is enough on paper. Your own side is the risk.') + '</p>' +
        '<div class="choices" style="margin-bottom:16px">' + list.map(function (am) {
          return '<button class="choice' + (am.id === pickId ? ' is-on' : '') + '" data-am="' + esc(am.id) + '">' +
            '<div class="choice-t">' + esc(am.name) + '</div>' +
            '<div class="choice-d">' + esc(am.blurb) + '</div></button>';
        }).join('') + '</div>' +
        '<div class="block-h">The whipping operation<span class="sub">' +
          (spend ? RZ.money(api.wage(spend), c.cur.sym) : 'nothing yet') + '</span></div>' +
        '<input id="amend-spend" type="range" min="0" max="40" step="2" value="' + spend + '" ' +
          'style="width:100%;accent-color:#d9a441">' +
        '<p class="note" style="margin:6px 0 16px">Constituency offices, provincial conferences, and a great many ' +
        'flights. It buys crossbenchers. It is also the thing that gets written about afterwards.</p>' +
        '<button class="btn btn-gold btn-block" data-go>Put it to the House</button>' +
        '<button class="btn btn-ghost btn-block" style="margin-top:8px" data-cancel>Not yet</button>';
      inner.innerHTML = h;

      inner.querySelectorAll('[data-am]').forEach(function (b) {
        b.addEventListener('click', function () { pickId = b.dataset.am; paint(); });
      });
      var sl = inner.querySelector('#amend-spend');
      sl.addEventListener('input', function () { spend = parseInt(sl.value, 10); paint(); });
      inner.querySelector('[data-cancel]').addEventListener('click', function () { closeModal(); });
      inner.querySelector('[data-go]').addEventListener('click', function () {
        var res = RZ.gov.attemptAmendment(api, pickId, spend);
        closeModal();
        onDone(res, api);
      });
    }
  }

  /* ---------------- the order paper ---------------- */
  function showDraft(onDone) {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId];
    var total = RZ.bill.houseTotal(S);
    var needed = Math.floor(total / 2) + 1;
    var h = '<div class="modal-kicker">The ' + esc(c.house.name) + '</div>' +
      '<h2 class="modal-h">What are you putting your name to?</h2>' +
      '<p class="modal-b">A private member gets one of these every few years and is remembered for it either way. ' +
      'You will need <strong>' + needed + ' of ' + total + '</strong>, and four weeks to find them. ' +
      'From the moment it is tabled the diary goes week by week.</p>' +
      '<div class="choices">' + RZ.bill.BILLS.map(function (b) {
        return '<button class="choice" data-b="' + esc(b.id) + '">' +
          '<div class="choice-t">' + esc(b.name) + '</div>' +
          '<div class="choice-d">' + esc(b.blurb) + '</div>' +
          '<div class="choice-d" style="opacity:.75;margin-top:4px">' + esc(leanLine(b)) + '</div>' +
          blocLine(b) +
          '</button>';
      }).join('') + '</div>' +
      '<button class="btn btn-ghost btn-block" style="margin-top:10px" data-cancel>Not this session</button>';
    var inner = modal(h);
    inner.querySelectorAll('[data-b]').forEach(function (btn) {
      btn.addEventListener('click', function () { closeModal(); onDone(btn.dataset.b); });
    });
    inner.querySelector('[data-cancel]').addEventListener('click', function () { closeModal(); onDone(null); });
  }

  // Who is out in the country, as opposed to who is in the House. A bill can
  // be easy to pass and expensive to have passed.
  function blocLine(bill) {
    if (!RZ.blocs || (!bill.wins && !bill.costs)) return '';
    var nm = function (id) { var b = RZ.blocs.byId[id]; return b ? b.ico + ' ' + b.name.toLowerCase() : id; };
    var parts = [];
    if (bill.wins && bill.wins.length) parts.push('Wins ' + bill.wins.map(nm).join(' and '));
    if (bill.costs && bill.costs.length) parts.push('loses ' + bill.costs.map(nm).join(' and '));
    return '<div class="choice-d" style="margin-top:4px;color:#c9a86a">' + esc(parts.join(', ')) + '.</div>';
  }

  // Who is going to hate it, said in one line, before it is too late to choose
  // a different fight.
  function leanLine(b) {
    var names = { loyal: 'your own benches', faction: 'the other faction', opp: 'the opposition', small: 'the small parties' };
    var friends = [], enemies = [];
    Object.keys(b.lean).forEach(function (k) {
      if (b.lean[k] >= 15) friends.push(names[k]);
      else if (b.lean[k] <= -15) enemies.push(names[k]);
    });
    var out = [];
    if (friends.length) out.push('With you: ' + friends.join(', '));
    if (enemies.length) out.push('Against: ' + enemies.join(', '));
    return out.join('. ') || 'Nobody has a settled view of it yet.';
  }

  // Which room, and what you are going to use in it. The lever is the whole
  // decision — the same bloc costs capital, an evening, or a reputation.
  function showBloc(onDone) {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId];
    var api = RZ.engine.mkApi(S);
    var pick = null;
    var inner = modal('');
    paint();

    function paint() {
      var t = RZ.bill.count(S);
      var h = '<div class="modal-kicker">Week ' + Math.min(S.bill.week, RZ.bill.WEEKS) +
          ' of ' + RZ.bill.WEEKS + ' \u00b7 ' + t.yes + ' of ' + t.needed + '</div>' +
        '<h2 class="modal-h">' + (pick ? 'How are you going to do it?' : 'Which room are you spending the week in?') + '</h2>';
      if (!pick) {
        h += '<p class="modal-b">You cannot work all four. Whoever you leave alone drifts back.</p>' +
          '<div class="choices">' + S.bill.blocs.map(function (x) {
            return '<button class="choice" data-x="' + esc(x.id) + '">' +
              '<div class="choice-t">' + esc(x.name) +
                '<span style="float:right;opacity:.8">' + x.seats + '</span></div>' +
              '<div class="choice-d">' + esc(x.note) + '</div>' +
              '<div class="choice-d" style="opacity:.75;margin-top:4px">' +
                (x.pledged ? 'Pledged already \u2014 nothing more to win here'
                           : (x.lean > 25 ? 'Leaning your way' : x.lean > -20 ? 'Genuinely undecided' : 'Hostile')) +
                (x.worked ? ' \u00b7 worked ' + x.worked + ' time' + (x.worked === 1 ? '' : 's') +
                            ', and the third conversation is worth less than the first' : '') +
              '</div>' +
              (x.pledged ? '<span class="choice-tag">pledged</span>' : '') +
              '</button>';
          }).join('') + '</div>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:10px" data-cancel>Not this week</button>';
      } else {
        var b = S.bill.blocs.filter(function (x) { return x.id === pick; })[0];
        var lev = [
          { how: 'capital', t: 'Trade positions and projects',
            d: 'Committee places, a deputy chair, a road in somebody\u2019s district. Costs political capital ' +
               'and you have ' + Math.round(S.player.capital) + '.', ok: S.player.capital >= 8 },
          { how: 'charm', t: 'Four evenings and an argument',
            d: 'No officials, no minutes. It works on the people it works on, and it costs you sleep.', ok: true },
          { how: 'extort', t: 'Remind them what you know',
            d: api.hasLeverage()
              ? 'You are holding something. Using it here spends it on a bill instead of on a career.'
              : 'You are not holding anything on anybody.',
            ok: api.hasLeverage(), risky: true }
        ];
        h += '<p class="modal-b">' + esc(b.name) + ' \u2014 ' + b.seats + ' members. ' + esc(b.note) + '</p>' +
          '<div class="choices">' + lev.map(function (l) {
            return '<button class="choice"' + (l.ok ? ' data-l="' + l.how + '"' : ' disabled style="opacity:.45"') + '>' +
              '<div class="choice-t">' + esc(l.t) + (l.risky ? ' <span style="color:#e08a86">\u25c6</span>' : '') + '</div>' +
              '<div class="choice-d">' + esc(l.d) + '</div></button>';
          }).join('') + '</div>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:10px" data-back>Somebody else</button>';
      }
      inner.innerHTML = h;
      inner.querySelectorAll('[data-x]').forEach(function (btn) {
        btn.addEventListener('click', function () { pick = btn.dataset.x; paint(); });
      });
      inner.querySelectorAll('[data-l]').forEach(function (btn) {
        btn.addEventListener('click', function () { closeModal(); onDone(pick, btn.dataset.l); });
      });
      var back = inner.querySelector('[data-back]');
      if (back) back.addEventListener('click', function () { pick = null; paint(); });
      var cx = inner.querySelector('[data-cancel]');
      if (cx) cx.addEventListener('click', function () { closeModal(); onDone(null); });
    }
  }

  // The other way to win a room. It always works and it always costs the bill
  // something, which is stated in the number before the button is pressed.
  function showConcede(onDone) {
    var S = UI.S;
    var next = Math.max(0.35, 1 - (S.bill.concessions + 1) * 0.22);
    var now = Math.max(0.35, 1 - S.bill.concessions * 0.22);
    var h = '<div class="modal-kicker">Amendments in committee</div>' +
      '<h2 class="modal-h">What are you taking out, and for whom?</h2>' +
      '<p class="modal-b">A clause goes and a room comes with you. The bill that passes will do ' +
      '<strong>' + Math.round(next * 100) + '%</strong> of what it was drafted to do, down from ' +
      Math.round(now * 100) + '%. Nobody outside this building will ever know which clause it was.</p>' +
      '<div class="choices">' + S.bill.blocs.map(function (x) {
        return '<button class="choice"' + (x.pledged ? ' disabled style="opacity:.45"' : ' data-x="' + esc(x.id) + '"') + '>' +
          '<div class="choice-t">' + esc(x.name) + '<span style="float:right;opacity:.8">' + x.seats + '</span></div>' +
          '<div class="choice-d">' + (x.pledged ? 'Already with you. Save the clause.' : esc(x.note)) + '</div></button>';
      }).join('') + '</div>' +
      '<button class="btn btn-ghost btn-block" style="margin-top:10px" data-cancel>The bill stands as drafted</button>';
    var inner = modal(h);
    inner.querySelectorAll('[data-x]').forEach(function (btn) {
      btn.addEventListener('click', function () { closeModal(); onDone(btn.dataset.x); });
    });
    inner.querySelector('[data-cancel]').addEventListener('click', function () { closeModal(); onDone(null); });
  }

  /* ---------------- conversation ---------------- */
  // How long the room holds a question before the answers are on the table.
  // Exposed so the harnesses can turn it off — a simulation that waits is a
  // simulation that times out — and so a player who has asked their phone not
  // to animate things does not get held anywhere.
  var PAUSE_MS = 850;
  // How long the night takes, per declaring region. Same reasoning as the
  // dialogue pause: a simulation that waits is a simulation that times out, and
  // a player who asked their phone not to animate should not be made to sit
  // through a staggered count.
  var COUNT_MS = 900;
  function countMs() {
    if (!COUNT_MS) return 0;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    } catch (e) { /* no matchMedia: animate anyway */ }
    return COUNT_MS;
  }
  function pauseMs() {
    if (!PAUSE_MS) return 0;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    } catch (e) { /* no matchMedia: hold anyway */ }
    return PAUSE_MS;
  }

  // A meeting runs inside one modal that keeps growing: their questions and your
  // answers stay on screen, so by the closing line you can read back what you
  // committed yourself to in front of them.
  function showDialogue(convo, onDone) {
    var inner = modal('');
    var holdTimer = null;
    paint();

    function paint() {
      var sp = convo.speaker;
      var others = otherPeople(convo);
      // One silence per question, and only the first time that question is
      // painted: answering repaints the modal, and re-holding a room you have
      // already sat in is padding rather than drama.
      var holding = !convo.done && !!convo.pause && convo.pauseSeen !== convo.beat &&
                    pauseMs() > 0;
      // Which question this painting is of. A click on an answer bubbles up to
      // the skip handler *after* the answer has already been taken and the
      // modal repainted, so without this the skip would mark the next question
      // as already sat through.
      var atBeat = convo.beat;
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      var html = '<div class="modal-kicker">' + esc(convo.where || 'A meeting') + '</div>' +
        '<h2 class="modal-h">' + esc(sp.name) + '</h2>' +
        '<div class="talk-role">' + esc(sp.role) +
          (sp.org ? ' <span class="talk-org">' + esc(sp.org) + '</span>' : '') + '</div>' +
        // Who else is in the room, before anybody has said anything. A room
        // you are mediating should look like one on the way in.
        (others.length
          ? '<div class="talk-room">' + others.map(function (p, i) {
              return '<span class="talk-who s' + ((i % 3) + 1) + '">' + esc(p.name) +
                '<small>' + esc(p.role) + '</small></span>';
            }).join('') + '</div>'
          : '') +
        '<div class="talk">' + convo.transcript.map(line).join('') + '</div>';

      if (convo.done) {
        var d = convo.api.deltas;
        html += (d && d.length ? '<div class="paper-delta talk-delta">' + d.map(function (x) {
          return '<span class="dlt ' + (x.v > 0 ? 'p' : 'n') + '">' + esc(x.label) + ' ' + RZ.signed(x.v) + '</span>';
        }).join('') + '</div>' : '') +
          '<button class="btn btn-gold btn-block" data-close>Leave the room</button>';
      } else {
        // The room holds for a moment before the answers are on the table.
        // Nothing turns on it — the same answers are underneath and they are in
        // the DOM the whole time — but a question you are given no time to sit
        // with is a menu item, and this game is trying not to be a menu.
        if (holding) {
          html += '<div class="talk-hold"><em>' + esc(convo.pause) + '</em>' +
            '<span class="hold-dots"><i></i><i></i><i></i></span></div>';
        }
        html += '<div class="choices' + (holding ? ' veiled' : '') + '">' +
          RZ.dialogue.options(convo).map(function (o) {
          var sided = o.side && convo.people && convo.people[o.side];
          return '<button class="choice' + (sided ? ' sided s' + slotOf(convo, o.side) : '') +
            '" data-i="' + o.i + '"' + (o.ok ? '' : ' disabled') + '>' +
            '<div class="choice-t">' + esc(o.t) + '</div>' +
            (sided ? '<div class="choice-d">Backs ' + esc(shortOf(sided)) + '</div>' : '') +
            (o.tag ? '<span class="choice-tag ' + (o.tag === 'risk' ? 'risk' : 'cost') + '">' + esc(o.tag) + '</span>' : '') +
            '</button>';
        }).join('') + '</div>';
      }

      inner.innerHTML = html;
      if (convo.done) {
        inner.querySelector('[data-close]').addEventListener('click', function () {
          closeModal(); if (onDone) onDone(convo);
        });
      } else {
        inner.querySelectorAll('[data-i]').forEach(function (b) {
          b.addEventListener('click', function () {
            RZ.dialogue.choose(convo, parseInt(b.dataset.i, 10));
            paint();
          });
        });
        if (holding) {
          // A silence you cannot end is a loading screen. Any tap ends it, and
          // it ends by itself if nobody touches anything.
          holdTimer = setTimeout(release, pauseMs());
          inner.addEventListener('click', release, { once: true });
        }
      }

      function release() {
        if (convo.done || convo.beat !== atBeat) return;
        if (convo.pauseSeen === convo.beat) return;
        convo.pauseSeen = convo.beat;
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        var box = inner.querySelector('.choices');
        var held = inner.querySelector('.talk-hold');
        if (box) box.classList.remove('veiled');
        if (held) held.classList.add('over');
        if (box && box.scrollIntoView) box.scrollIntoView({ block: 'nearest' });
      }
      // Keep the newest exchange in view rather than the top of the meeting —
      // and once it is over, what it cost you.
      var focus = convo.done
        ? inner.querySelector('.talk-delta') || inner.querySelector('[data-close]')
        : inner.querySelector('.talk-l:last-child');
      if (focus && focus.scrollIntoView) focus.scrollIntoView({ block: 'nearest' });
    }

    // Everybody in the room except whoever's room it is, in a stable order so
    // a person keeps the same colour for the whole meeting.
    // What this person is called on screen: their first name, unless somebody
    // else in the career answers to it too.
    function shortOf(p) {
      if (!p) return '';
      return (RZ.cast && UI.S ? RZ.cast.shortOf(UI.S, p) : p.name.split(' ')[0]);
    }

    function otherPeople(convo) {
      if (!convo.people) return [];
      return Object.keys(convo.people)
        .filter(function (k) { return k !== '_' && convo.people[k] !== convo.speaker; })
        .map(function (k) { return convo.people[k]; });
    }
    function slotOf(convo, key) {
      if (!key || key === '_' || !convo.people) return 0;
      var keys = Object.keys(convo.people).filter(function (k) { return k !== '_'; });
      var i = keys.indexOf(key);
      return i < 0 ? 0 : (i % 3) + 1;
    }

    function line(l) {
      var speaking = (l.by && convo.people && convo.people[l.by]) || convo.speaker;
      var slot = l.who === 'me' ? 0 : slotOf(convo, l.by);
      return '<div class="talk-l ' + (l.who === 'me' ? 'me' : 'them') +
        (slot ? ' s' + slot : '') + (l.closing ? ' closing' : '') + '">' +
        '<div class="talk-nm">' +
          (l.who === 'me' ? 'You' : esc(shortOf(speaking))) +
          (l.at && convo.people[l.at] ? ' <span class="talk-at">to ' +
            esc(shortOf(convo.people[l.at])) + '</span>' : '') +
        '</div>' +
        '<div class="talk-tx">' + esc(l.text) + '</div></div>';
    }
  }

  /* ---------------- election night ---------------- */
  /* ---------------- election day ---------------- */
  // Four screens, in order, and the result is not computed until the third has
  // been answered — so what the player does in the first three genuinely moves
  // it, rather than decorating a number that was decided when the day loaded.
  function showElectionDay(onDone) {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId];
    RZ.eday.init(S);
    ground();

    function head(kicker, title, sub) {
      return '<div class="modal-kicker">' + esc(kicker) + '</div>' +
        '<h2 class="modal-h">' + esc(title) + '</h2>' +
        (sub ? '<p class="modal-b">' + sub + '</p>' : '');
    }

    // ---- 1. dawn ----
    function ground() {
      var opts = RZ.eday.groundOptions(S);
      var h = head('Election day · ' + S.date.year + ' · 05:40',
        'The stations open in twenty minutes',
        'Every party in this country has the same number of cars and the same number of people willing to ' +
        'drive them all day for nothing. The only thing that separates you is where you send them, and you ' +
        'are sending them now, before anybody knows anything.') +
        '<div class="choices">' + opts.map(function (o) {
          return '<button class="choice" data-i="' + o.i + '">' +
            '<div class="choice-t">' + esc(o.t) + '</div>' +
            '<div class="choice-d">' + esc(o.d) + '</div></button>';
        }).join('') + '</div>';
      var inner = modal(h);
      inner.querySelectorAll('[data-i]').forEach(function (b) {
        b.addEventListener('click', function () {
          var g = RZ.eday.chooseGround(S, parseInt(b.dataset.i, 10));
          exit(g);
        });
      });
    }

    // ---- 2. midday ----
    function exit(g) {
      var poll = RZ.eday.takePoll(S);
      var mine = c.partyById[S.player.partyId];
      var lead = c.partyById[poll.leadId];
      var h = head('Election day · 13:20', 'The first exit polls',
        esc(g.note)) +
        '<div class="eres">' + c.parties.slice()
          .sort(function (a, b) { return poll.byParty[b.id] - poll.byParty[a.id]; })
          .slice(0, 5).map(function (p) {
            var v = poll.byParty[p.id];
            return '<div class="eres-row"><div class="eres-top">' +
              '<span class="row-dot" style="background:' + p.color + '"></span>' +
              '<span class="eres-ab">' + esc(p.abbr) + '</span>' +
              (p.id === S.player.partyId ? '<span class="gold" style="font-size:.72rem">yours</span>' : '') +
              '<span class="eres-pc">' + RZ.round(v, 1) + '%</span></div>' +
              '<div class="eres-bar"><span class="eres-fill" style="width:' +
                Math.min(100, v * 1.6) + '%;background:' + p.color + '"></span></div></div>';
          }).join('') + '</div>' +
        '<p class="note mt"><strong>' + esc(lead.abbr) + '</strong> ' +
          (poll.ahead ? 'ahead' : 'ahead of you') + ' by ' + RZ.round(poll.lead, 1) +
          ' points — ' + esc(poll.read) + '. The sample carries an error of about ' +
          RZ.round(poll.err, 1) + ' points either way, and exit polls in this country have been ' +
          'confidently wrong before.</p>' +
        '<button class="btn btn-gold btn-block mt" data-go>What do you do about it?</button>';
      var inner = modal(h);
      inner.querySelector('[data-go]').addEventListener('click', function () { shift(poll); });
    }

    // ---- 3. afternoon ----
    function shift(poll) {
      var opts = RZ.eday.shiftOptions(S);
      var h = head('Election day · 15:05', 'The polls close in four hours',
        'One thing. Whatever you do now is done on the strength of a number nobody can check until ' +
        'tonight, and it cannot be undone once the stations close.') +
        '<div class="choices">' + opts.map(function (o, n) {
          return '<button class="choice" data-i="' + n + '">' +
            '<div class="choice-t">' + esc(o.t) + '</div>' +
            '<div class="choice-d">' + esc(o.d) + '</div></button>';
        }).join('') + '</div>';
      var inner = modal(h);
      inner.querySelectorAll('[data-i]').forEach(function (b) {
        b.addEventListener('click', function () {
          var sh = RZ.eday.chooseShift(S, parseInt(b.dataset.i, 10));
          rig(sh);
        });
      });
    }

    // The existing offer, kept where it always was in the night: after you have
    // stopped campaigning and before anybody counts anything.
    function rig(sh) {
      if (RZ.gov.canRig(S)) showRigOffer(function (r) { count(sh, r); });
      else count(sh, 0);
    }

    // ---- 4. the night ----
    function count(sh, rigLevel) {
      var res = RZ.eday.runCount(S, { rig: rigLevel });
      var order = RZ.eday.countOrder(S);
      var n = 0, timer = null, done = false;
      var inner = modal('');
      draw();

      function draw() {
        var part = RZ.eday.partial(S, n);
        var rows = c.parties.slice()
          .sort(function (a, b) { return part.byParty[b.id] - part.byParty[a.id]; })
          .slice(0, 6);
        var h = head('The count · ' + S.date.year,
          part.declared === 0 ? 'The boxes are moving' : part.pct + '% declared',
          esc(sh.note));
        h += '<div class="count-meter"><span style="width:' + Math.max(2, part.pct) + '%"></span></div>' +
          '<p class="note" style="margin:6px 0 12px">' +
            (part.last ? '<strong>' + esc(part.last.name) + '</strong> has declared. ' : '') +
            part.declared + ' of ' + part.of + ' ' + esc(c.terms.region) + 's in.</p>';
        h += '<div class="eres">' + rows.map(function (p) {
          var v = part.byParty[p.id] || 0;
          return '<div class="eres-row"><div class="eres-top">' +
            '<span class="row-dot" style="background:' + p.color + '"></span>' +
            '<span class="eres-ab">' + esc(p.abbr) + '</span>' +
            (p.id === S.player.partyId ? '<span class="gold" style="font-size:.72rem">yours</span>' : '') +
            '<span class="eres-pc">' + RZ.round(v, 1) + '%</span></div>' +
            '<div class="eres-bar"><span class="eres-fill count-fill" style="width:' +
              Math.min(100, v * 1.6) + '%;background:' + p.color + '"></span></div></div>';
        }).join('') + '</div>';
        h += done
          ? '<button class="btn btn-gold btn-block mt" data-final>The full result</button>'
          : '<button class="btn btn-ghost btn-block mt" data-skip>Skip to the declaration</button>';
        inner.innerHTML = h;
        if (done) {
          inner.querySelector('[data-final]').addEventListener('click', function () {
            closeModal(); showElection(res, onDone);
          });
        } else {
          inner.querySelector('[data-skip]').addEventListener('click', finish);
        }
      }

      function step() {
        n++;
        draw();
        if (n >= order.length) { finish(); return; }
        timer = setTimeout(step, countMs());
      }
      function finish() {
        if (timer) { clearTimeout(timer); timer = null; }
        n = order.length; done = true;
        draw();
      }
      if (countMs() > 0) timer = setTimeout(step, countMs());
      else finish();
    }
  }

  function showElection(r, onClose) {
    var S = UI.S, c = r.country;
    var parties = c.parties.slice().sort(function (a, b) { return r.vote.byParty[b.id] - r.vote.byParty[a.id]; });
    var totalSeats = RZ.sum(c.parties, function (p) { return r.seats[p.id] || 0; });

    var h = '<div class="modal-kicker">Election night · ' + r.year + '</div>' +
      '<h2 class="enight-h">' + esc(c.house.name) + '</h2>' +
      '<p class="enight-s">' + totalSeats + ' seats · ' + methodLabel(c) + '</p>' +
      '<div class="eres">' + parties.map(function (p, i) {
        var v = r.vote.byParty[p.id], s = r.seats[p.id] || 0;
        return '<div class="eres-row" style="animation-delay:' + (i * 70) + 'ms">' +
          '<div class="eres-top"><span class="row-dot" style="background:' + p.color + '"></span>' +
          '<span class="eres-ab">' + esc(p.abbr) + '</span>' +
          (p.id === S.player.partyId ? '<span class="gold" style="font-size:.72rem">yours</span>' : '') +
          '<span class="eres-pc">' + RZ.round(v, 1) + '%</span><span class="eres-st">' + s + ' seats</span></div>' +
          '<div class="eres-bar"><span class="eres-fill" style="width:' + Math.min(100, v * 1.6) + '%;background:' + p.color + '"></span></div>' +
          '</div>';
      }).join('') + '</div>';

    if (r.presidency && r.presidency.round1) {
      var pr = r.presidency;
      h += '<hr class="hr"><div class="modal-kicker">Presidential ballot</div>' +
        '<div class="eres">' + pr.round1.slice(0, 4).map(function (x) {
          var p = c.partyById[x.partyId];
          return '<div class="eres-row"><div class="eres-top">' +
            '<span class="row-dot" style="background:' + p.color + '"></span>' +
            '<span class="eres-ab">' + esc(x.name) + '</span>' +
            '<span class="eres-pc">' + RZ.round(x.share, 1) + '%</span></div>' +
            '<div class="eres-bar"><span class="eres-fill" style="width:' + Math.min(100, x.share * 1.6) + '%;background:' + p.color + '"></span></div></div>';
        }).join('') + '</div>';
      if (pr.runoff) {
        h += '<p class="note mt">No candidate reached 50%. In the run-off, <strong>' + esc(pr.runoff[0].name) +
          '</strong> took ' + RZ.round(pr.runoff[0].share, 1) + '% against ' + RZ.round(pr.runoff[1].share, 1) + '%.</p>';
      }
    }

    h += '<hr class="hr"><p class="modal-b">';
    if (r.gov.majority && r.gov.parties.length === 1) {
      h += '<strong>' + esc(c.partyById[r.gov.lead].abbr) + '</strong> has an outright majority (' +
        r.seats[r.gov.lead] + ' of ' + totalSeats + ').';
    } else {
      h += 'No overall majority. A coalition of <strong>' +
        r.gov.parties.map(function (id) { return esc(c.partyById[id].abbr); }).join(' + ') +
        '</strong> holds ' + (r.gov.seatsHeld || 0) + ' of ' + totalSeats + '.';
    }
    if (c.system !== 'monarchy') {
      h += ' <strong>' + esc(S.nation.presidentName) + '</strong> is ' + esc(c.terms.hos) + '.';
    }
    h += '</p>';

    if (r.rigged) {
      h += '<p class="modal-b" style="color:#e8b26f">You moved the count by roughly ' + RZ.round(r.rigged.shifted, 1) + ' points. ' +
        (r.rigged.caught ? 'It was noticed. Observers, the opposition and at least one foreign capital have said so publicly.'
                         : 'So far, nobody has been able to prove anything.') + '</p>';
    }

    if (r.personal && (r.personal.messages.length || r.personal.becamePresident)) {
      h += '<div class="card" style="border-color:var(--gold)"><div class="block-h" style="margin:0 0 6px">You</div><p class="note">' +
        (r.personal.becamePresident ? '<strong class="gold">You have won the highest office in ' + esc(c.name) + '.</strong> '
          : '') +
        esc(r.personal.messages.join(' ')) +
        (r.personal.seat ? ' Your seat: ' + RZ.round(r.personal.seat.mine, 1) + '% against ' + RZ.round(r.personal.seat.best, 1) + '%.' : '') +
        (r.personal.listRank ? ' You were number ' + r.personal.listRank + ' on the list; the party won ' + r.personal.partySeats + ' seats.' : '') +
        '</p></div>';
    }

    h += '<button class="btn btn-gold btn-block mt" data-close>Continue</button>';
    var inner = modal(h);
    inner.querySelector('[data-close]').addEventListener('click', function () { closeModal(); if (onClose) onClose(); });
  }

  function showRigOffer(onChoose) {
    var c = RZ.COUNTRIES[UI.S.countryId];
    var h = '<div class="modal-kicker">Before the count</div>' +
      '<h2 class="modal-h">There are things that can be done</h2>' +
      '<p class="modal-b">Presiding officers are appointed, not elected. The roll has names on it that belong to nobody. ' +
      'The commission is chaired by somebody you know. Nothing has to be crude — it rarely is.</p>' +
      '<div class="choices">' +
      '<button class="choice" data-r="0"><div class="choice-t">Let it run clean</div><div class="choice-d">Whatever the country decides, it decides.</div></button>' +
      '<button class="choice" data-r="4"><div class="choice-t">A light thumb on the scale</div><div class="choice-d">Transport, state media, a few convenient constituencies.</div><span class="choice-tag risk">risk</span></button>' +
      '<button class="choice" data-r="10"><div class="choice-t">Manage the result</div><div class="choice-d">The roll, the presiding officers, and the transmission of results.</div><span class="choice-tag risk">high risk</span></button>' +
      '</div>';
    var inner = modal(h);
    inner.querySelectorAll('[data-r]').forEach(function (b) {
      b.addEventListener('click', function () { closeModal(); onChoose(parseInt(b.dataset.r, 10)); });
    });
  }

  /* ---------------- budget modal ---------------- */
  function showBudget(onDone) {
    var S = UI.S;
    var b = Object.assign({}, S.nation.budget);
    function total() { return RZ.gov.BUDGET_LINES.reduce(function (a, l) { return a + b[l.k]; }, 0); }
    function draw() {
      var t = total();
      var h = '<div class="modal-kicker">The estimates</div>' +
        '<h2 class="modal-h">Table the national budget</h2>' +
        '<p class="modal-b">One hundred points of expenditure. Everything you give to one line comes out of another. ' +
        'Currently allocated: <strong style="color:' + (t === 100 ? 'var(--green)' : 'var(--red)') + '">' + t + '</strong> / 100.</p>' +
        '<div class="bars">' + RZ.gov.BUDGET_LINES.map(function (l) {
          return '<div style="margin-bottom:12px"><div style="display:flex;font-size:.85rem;margin-bottom:4px">' +
            '<span>' + esc(l.name) + ' <span class="note">— ' + esc(l.note) + '</span></span>' +
            '<span style="margin-left:auto;font-family:var(--mono);color:var(--gold)">' + b[l.k] + '</span></div>' +
            '<input type="range" min="0" max="40" value="' + b[l.k] + '" data-k="' + l.k + '" style="width:100%;accent-color:#d9a441"></div>';
        }).join('') + '</div>' +
        '<button class="btn btn-gold btn-block mt" data-done' + (t === 100 ? '' : ' disabled') + '>Table the budget</button>';
      var inner = modal(h);
      inner.querySelectorAll('input[type=range]').forEach(function (i) {
        i.addEventListener('input', function () { b[i.dataset.k] = parseInt(i.value, 10); draw(); });
      });
      var d = inner.querySelector('[data-done]');
      if (d) d.addEventListener('click', function () { closeModal(); onDone(b); });
    }
    draw();
  }

  /* ---------------- end screen ---------------- */
  function showEnd() {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId];
    var lg = RZ.gov.legacy(S);
    var h = '<div class="end-wrap">' +
      '<div class="crest" style="width:56px;height:56px;margin:0 auto 8px"><svg viewBox="0 0 100 100"><use href="#crest-sym"/></svg></div>' +
      '<div class="modal-kicker" style="text-align:center">' + esc(c.name) + ' · ' + S.date.year + '</div>' +
      '<div class="end-rank">' + esc(lg.rank) + '</div>' +
      '<div class="end-score">Legacy score ' + lg.score + '</div>' +
      '<div class="obit">' + RZ.gov.obituary(S, lg) + '</div>' +
      '<button class="btn btn-gold btn-lg btn-block" data-act="restart">Begin another career</button>' +
      '</div>';
    el('#screen-end').innerHTML = h;
    el('#screen-end').querySelector('[data-act="restart"]').addEventListener('click', function () {
      RZ.engine.clearSave(); location.reload();
    });
    show('end');
  }

  /* ---------------- about ---------------- */
  function showAbout() {
    modal('<div class="modal-kicker">How it works</div>' +
      '<h2 class="modal-h">A career, one month at a time</h2>' +
      '<p class="modal-b">Each month you get a handful of actions. Spend them on the ground game, on the party machine, ' +
      'on money, on the press — or on the things you would not want printed. Then the month turns, the economy moves, ' +
      'and something happens to you.</p>' +
      '<p class="modal-b">You climb by <strong>contesting</strong> the next rung. Some rungs are won in branch meetings, ' +
      'some at the national conference, some at a public ballot, and some are simply in the leader’s gift — for those, ' +
      'all you can do is make yourself impossible to overlook.</p>' +
      '<p class="modal-b">Every country runs its own constitution: first-past-the-post, closed-list PR, mixed-member, ' +
      'or a non-party ballot under a monarchy. That decides what your career actually looks like. In a list system the ' +
      'party can end you without a single voter being consulted.</p>' +
      '<p class="modal-b">Corruption works. It also accumulates. Everything you do that would embarrass you goes into a ' +
      'file, and files come out — sooner where the courts and the press are strong.</p>' +
      '<p class="modal-b"><em>All characters are fictional. Countries, institutions, electoral systems and party names ' +
      'are real; the numbers are tuned for play, not reported as fact.</em></p>' +
      '<button class="btn btn-gold btn-block" data-close>Close</button>', { dismissible: true })
      .querySelector('[data-close]').addEventListener('click', closeModal);
  }

  /* ---------------- top level ---------------- */
  function renderGame() {
    renderHud();
    renderDesk(); renderCountry(); renderParty(); renderSelf();
    els('.pane').forEach(function (p) { p.classList.toggle('is-active', p.id === 'pane-' + UI.pane); });
    els('.tab').forEach(function (t) { t.classList.toggle('is-active', t.dataset.pane === UI.pane); });
  }

  function setPause(ms) { PAUSE_MS = Math.max(0, ms | 0); return PAUSE_MS; }
  function setCount(ms) { COUNT_MS = Math.max(0, ms | 0); return COUNT_MS; }

  RZ.ui = {
    UI: UI, show: show, toast: toast, modal: modal, closeModal: closeModal,
    renderCountries: renderCountries, renderCreate: renderCreate, renderGame: renderGame, renderHud: renderHud,
    showEvent: showEvent, showOutcome: showOutcome, showDialogue: showDialogue, showElection: showElection,
    showAmend: showAmend, showBlitz: showBlitz, showOrigin: showOrigin,
    showDraft: showDraft, showBloc: showBloc, showConcede: showConcede,
    showRigOffer: showRigOffer, showBudget: showBudget, showEnd: showEnd, showAbout: showAbout,
    paperCard: paperCard, setPause: setPause, setCount: setCount,
    showElectionDay: showElectionDay,
    pauseMs: function () { return PAUSE_MS; },
    countMs: function () { return COUNT_MS; }
  };
})();
