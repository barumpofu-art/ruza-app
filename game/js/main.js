/* main.js — bootstrap and flow control. */
(function () {
  'use strict';
  var UI = RZ.ui.UI;

  function init() {
    // title
    document.querySelectorAll('[data-act="new-game"]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (RZ.engine.hasSave()) {
          if (!confirm('Starting a new career will overwrite the saved one. Continue?')) return;
        }
        RZ.ui.renderCountries(); RZ.ui.show('country');
      });
    });
    document.querySelectorAll('[data-act="continue"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var S = RZ.engine.load();
        if (!S) { RZ.ui.toast('No saved career found', 'n'); return; }
        UI.S = S;
        if (S.over) { RZ.ui.showEnd(); return; }
        RZ.ui.renderGame(); RZ.ui.show('game');
        // Quitting with a decision on the table leaves it in the save; put it
        // back on screen rather than stranding it there forever.
        if (S.pendingScene) resumePendingScene();
        else if (S.pendingEvent) resumePendingEvent();
      });
    });
    document.querySelectorAll('[data-act="show-about"]').forEach(function (b) {
      b.addEventListener('click', RZ.ui.showAbout);
    });
    document.querySelectorAll('[data-act="back-title"]').forEach(function (b) {
      b.addEventListener('click', function () { RZ.ui.show('title'); });
    });
    document.querySelectorAll('[data-act="back-country"]').forEach(function (b) {
      b.addEventListener('click', function () { RZ.ui.show('country'); });
    });

    // tabs
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () { UI.pane = t.dataset.pane; RZ.ui.renderGame(); });
    });

    // modal scrim dismissal (only for dismissible modals)
    document.getElementById('modal').addEventListener('click', function (e) {
      if (e.target.id === 'modal' && e.currentTarget.dataset.dismissible) RZ.ui.closeModal();
    });

    if (RZ.engine.hasSave()) document.getElementById('btn-continue').hidden = false;

    var build = document.getElementById('build-line');
    if (build) {
      build.textContent = 'Version ' + RZ.VERSION +
        (location.hostname === 'appassets.androidplatform.net' ? ' · Android' : ' · web');
    }

    // Service worker: only meaningful for the web build. Inside the Android APK
    // every asset is already local and served by the shell, so registering one
    // buys nothing and adds a WebView failure surface — its interception layer
    // is fragile across a reload.
    var packaged = location.hostname === 'appassets.androidplatform.net';
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0 && !packaged) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  /* ---------------- start ---------------- */
  function begin() {
    var d = UI.draft;
    var c = RZ.COUNTRIES[d.countryId];
    var name = (d.name || '').trim() || RZ.makeName(c);
    d.name = name;

    // You play the afternoon that got you into this before the first month
    // starts. The answer is the character.
    RZ.ui.showOrigin(d.startAs || 'activist', d, function (originId) {
      UI.S = RZ.engine.newGame({
        countryId: d.countryId, name: name, gender: d.gender || 'f',
        regionId: d.regionId, bgId: d.bgId, partyId: d.partyId,
        age: d.startAs === 'candidate' ? 41 : 34,
        startAs: d.startAs || 'activist',
        origin: originId
      });
      UI.pane = 'desk';
      RZ.ui.renderGame();
      RZ.ui.show('game');
    });
  }

  /* ---------------- actions ---------------- */
  function c() { return RZ.COUNTRIES[UI.S.countryId]; }

  function act(id) {
    var S = UI.S;
    if (S.actionsLeft <= 0) { RZ.ui.toast('No actions left this month', 'n'); return; }

    if (id === 'amend') {
      RZ.ui.showAmend(function (res, api) {
        if (res.fail) { RZ.ui.toast(res.title || 'Not possible', 'n'); return; }
        S.actionsLeft--;
        S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
        var entry = {
          kind: res.passed ? 'big' : 'bad', alert: !res.passed,
          src: 'The ' + c().house.name, title: res.title, body: res.body,
          deltas: api.deltas.slice(), tone: res.tone
        };
        RZ.engine.pushFeed(S, entry);
        RZ.engine.save(S);
        RZ.ui.showOutcome(entry, afterAction);
      });
      return;
    }

    if (id === 'budget') {
      RZ.ui.showBudget(function (b) {
        RZ.gov.applyBudget(S, b);
        S.actionsLeft--;
        RZ.engine.pushFeed(S, { kind: 'big', src: 'The estimates', title: 'The budget was tabled',
          body: 'Read to the House over four hours. Every line in it is somebody’s livelihood and somebody else’s grievance.',
          tone: 'good' });
        RZ.engine.save(S);
        RZ.ui.renderGame();
      });
      return;
    }

    var out = RZ.engine.doAction(S, id);
    if (!out) return;

    // Tabling a bill, working a bloc and dropping a clause all need a choice
    // made in a modal before there is anything to resolve.
    if (out.special === 'draft') {
      RZ.ui.showDraft(function (billId) {
        if (!billId) return;
        var api = RZ.engine.mkApi(S);
        var b = RZ.bill.table(S, api, billId);
        if (!b) return;
        S.actionsLeft--;
        S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
        var t = RZ.bill.count(S);
        var entry = {
          kind: 'big', src: 'The order paper', title: b.name + ' is tabled',
          body: b.blurb + ' Second reading in four weeks. The whips make it <strong>' + t.yes +
                ' of ' + t.needed + '</strong> this morning' +
                (t.short
                  ? ', and the ' + t.short + ' missing are all in rooms you have not been in yet.'
                  : ' — a margin of the kind that does not survive a fortnight of being left alone.'),
          deltas: api.deltas.slice(), tone: 'good'
        };
        RZ.engine.pushFeed(S, entry);
        RZ.engine.save(S);
        RZ.ui.showOutcome(entry, afterAction);
      });
      return;
    }

    if (out.special === 'bloc') {
      RZ.ui.showBloc(function (blocId, how) {
        if (!blocId || !how) return;
        var api = RZ.engine.mkApi(S);
        var r = RZ.bill.workBloc(S, api, blocId, how);
        if (!r) { RZ.ui.toast('Not possible', 'n'); return; }
        S.actionsLeft--;
        S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
        var t = RZ.bill.count(S);
        var entry = {
          kind: r.pledged ? 'good' : (r.moved > 8 ? 'flat' : 'bad'),
          src: r.bloc.name,
          title: r.pledged
            ? r.bloc.name + ' will vote for it'
            : (r.moved > 8 ? 'Movement, and not enough of it' : 'A week for very little'),
          body: 'A week of ' + r.note + '. ' +
            (r.pledged
              ? 'All ' + r.bloc.seats + ' of them, pledged in a room with no minutes taken. ' +
                (how === 'extort' ? 'Nobody in it looked at anybody else.' : 'Which holds until somebody offers them more.')
              : 'They have moved ' + Math.round(r.moved) + ' points and they are still not yours. ') +
            ' The count is ' + t.yes + ' of ' + t.needed + '.',
          deltas: api.deltas.slice(), tone: r.pledged ? 'good' : 'flat'
        };
        RZ.engine.pushFeed(S, entry);
        RZ.engine.save(S);
        RZ.ui.showOutcome(entry, afterAction);
      });
      return;
    }

    if (out.special === 'concede') {
      RZ.ui.showConcede(function (blocId) {
        if (!blocId) return;
        var api = RZ.engine.mkApi(S);
        var r = RZ.bill.concede(S, api, blocId);
        if (!r) return;
        S.actionsLeft--;
        S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
        var t = RZ.bill.count(S);
        var entry = {
          kind: 'flat', src: 'Committee stage',
          title: 'A clause came out for ' + r.bloc.name,
          body: (r.bloc.pledged
            ? r.bloc.name + ' will vote for what is left of it. '
            : r.bloc.name + ' have moved a long way and still have not committed. ') +
            'The drafters were in the room and said nothing, which is how you know it mattered. ' +
            'The count is ' + t.yes + ' of ' + t.needed + '.',
          deltas: api.deltas.slice(), tone: 'flat'
        };
        RZ.engine.pushFeed(S, entry);
        RZ.engine.save(S);
        RZ.ui.showOutcome(entry, afterAction);
      });
      return;
    }

    // Blitzing and surging both need a target before they can resolve.
    if (out.special === 'blitz' || out.special === 'surge') {
      var isSurge = out.special === 'surge';
      RZ.ui.showBlitz(function (wardId) {
        if (!wardId) return;
        var api = RZ.engine.mkApi(S);
        var r = isSurge ? RZ.sprint.surge(S, wardId, api) : RZ.sprint.blitz(S, wardId, api);
        if (!r) return;
        if (isSurge) {
          S.actionsLeft--;
          S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
          var sEntry = {
            kind: 'good', src: r.ward.name,
            title: 'Everything went into ' + r.ward.name,
            body: 'Halls, sound, printing, transport and eleven people on the ground full time for the rest of the ' +
                  'campaign. It is more than you can afford and it will hold — nobody is taking this ward back ' +
                  'in the weeks that are left.',
            deltas: api.deltas.slice(), tone: 'good'
          };
          RZ.engine.pushFeed(S, sEntry);
          RZ.engine.save(S);
          RZ.ui.showOutcome(sEntry, afterAction);
          return;
        }
        S.actionsLeft--;
        S.actionsThisMonth = (S.actionsThisMonth || 0) + 1;
        var entry = {
          kind: r.ok ? 'good' : 'flat', src: r.ward.name,
          title: r.ok ? 'A good week in ' + r.ward.name : 'A hard week in ' + r.ward.name,
          body: (r.ok
            ? 'Four days of doors, two taxi ranks and a hall you had to argue for. They know your name here now, ' +
              'and more importantly they know your face.'
            : 'Long days and thin crowds. You were argued with at the rank and had no good answer about the water. ' +
              'It still moved, a little.') +
            (r.broke ? ' You are spending money the campaign does not have, and it shows in what you could not print.' : ''),
          deltas: api.deltas.slice(), tone: r.ok ? 'good' : 'flat'
        };
        RZ.engine.pushFeed(S, entry);
        RZ.engine.save(S);
        RZ.ui.showOutcome(entry, function () { RZ.ui.renderGame(); });
      });
      return;
    }
    if (out.fail) {
      RZ.ui.toast(out.res ? out.res.title : 'Not possible', 'n');
      return;
    }

    // This one turned out to be a room full of people rather than a die roll.
    // Answers change the state as they are given, so the save is written as
    // the meeting goes, not only when it ends.
    if (out.dialogue) {
      RZ.engine.save(S);
      RZ.ui.renderHud();
      RZ.ui.showDialogue(out.dialogue, function (convo) {
        RZ.engine.finishDialogue(S, convo);
        RZ.engine.save(S);
        afterAction();
      });
      return;
    }

    RZ.engine.save(S);
    RZ.ui.showOutcome(out.entry, afterAction);
    RZ.ui.renderHud();
  }

  // An action can put a decision on the table — a failed revolt summons you to
  // the regional office there and then. Present it as soon as the outcome
  // sheet closes rather than leaving it for the end of the month.
  function afterAction() {
    if (UI.S.pendingScene) { resumePendingScene(); return; }
    if (UI.S.pendingEvent) { resumePendingEvent(); return; }
    RZ.ui.renderGame();
  }

  // Somebody has asked to see you. It is not optional and it is not a card.
  function resumePendingScene() {
    var S = UI.S;
    var convo = RZ.dialogue.beginById(S, S.pendingScene);
    S.pendingScene = null;
    if (!convo) { RZ.ui.renderGame(); return; }
    RZ.engine.save(S);
    RZ.ui.showDialogue(convo, function (c) {
      RZ.engine.finishDialogue(S, c);
      RZ.engine.save(S);
      afterAction();
    });
  }

  /* ---------------- contest ---------------- */
  function contest() {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId];
    var r = RZ.engine.contest(S);
    if (!r) { RZ.ui.toast('Not available yet', 'n'); return; }
    var entry;

    // Who won it instead, and what happened to whoever was sitting there.
    var beaten = r.beatenBy
      ? ' It went to <strong>' + RZ.esc(r.beatenBy.name) + '</strong>, who will now be introduced as ' +
        RZ.esc(r.rung.title) + ' at every function you attend.'
      : '';
    var deposed = r.deposed
      ? (r.deposed.gone
          ? ' <strong>' + RZ.esc(r.deposed.name) + '</strong> did not come back after lunch, and has not been seen at a party function since.'
          : ' <strong>' + RZ.esc(r.deposed.name) + '</strong> kept a seat, one row further back, and has not forgiven you.')
      : '';

    if (r.kind === 'internal') {
      entry = r.won
        ? { src: 'The structures', title: 'You have it', body: 'The ' + RZ.esc(c.terms.branch) + ' chairs counted hands in a hall with no working fan. You are ' + RZ.esc(r.rung.title) + '.' + deposed, deltas: [] }
        : { src: 'The structures', title: 'You were beaten', body: 'The vote went against you by a margin the chairperson announced twice, slowly.' + beaten + ' Rebuild and come back.', deltas: [] };
    } else if (r.kind === 'conference') {
      var d = r.detail;
      entry = r.won
        ? { src: c.terms.conference, title: 'Elected on the floor', body: 'You took <strong>' + Math.round(d.mine) + ' of ' + d.total +
            '</strong> delegates (' + RZ.round(d.pct, 1) + '%). The hall went up, the losing slate walked out, and you are ' + RZ.esc(r.rung.title) + '.' + deposed, deltas: [] }
        : { src: c.terms.conference, title: 'The floor said no', body: 'You took <strong>' + Math.round(d.mine) + ' of ' + d.total +
            '</strong> delegates (' + RZ.round(d.pct, 1) + '%). Delegates were bought months ago and not by you.' + beaten + ' There is another conference in five years.', deltas: [] };
    } else if (r.kind === 'primary') {
      var lost = r.against
        ? ' <strong>' + RZ.esc(r.against.name) + '</strong> had buses at the gate before the hall opened.'
        : ' Somebody else’s buses arrived first.';
      entry = r.won
        ? { src: c.terms.primary, title: 'You are the candidate', body: 'The nomination is yours. ' + RZ.esc(r.note || '') +
            (r.against ? ' <strong>' + RZ.esc(r.against.name) + '</strong> came second and did not stay for the photograph.' : '') +
            ' Now you have to win it in public.', deltas: [] }
        : { src: c.terms.primary, title: 'You lost the nomination', body: lost + ' The party will field them, and you will be expected to campaign for them.', deltas: [] };
    }
    entry.kind = r.won ? 'good' : 'bad';
    RZ.engine.pushFeed(S, entry);
    RZ.engine.save(S);
    RZ.ui.showOutcome(entry, function () { RZ.ui.renderGame(); });
  }

  /* ---------------- turn ---------------- */
  function endTurn() {
    var S = UI.S;
    var out = RZ.engine.endTurn(S);
    RZ.ui.renderHud();
    processTurn(out);
  }

  function processTurn(out) {
    var S = UI.S, c = RZ.COUNTRIES[S.countryId];

    if (S.over) { RZ.ui.showEnd(); return; }

    if (out.promo && out.promo.promoted) {
      RZ.ui.toast('Appointed: ' + out.promo.rung.title, 'p');
    }

    // A collapse costs you the coming month, so say so rather than leaving the
    // player to notice they have no actions.
    if (out.collapsed) RZ.ui.toast('You are signed off — next month is gone', 'n');
    if (out.purge && out.purge.purged) RZ.ui.toast('Purged from the slate', 'n');

    if (out.conference) {
      RZ.engine.pushFeed(S, { kind: 'big', src: c.terms.conference,
        title: 'The ' + c.terms.conference + ' opens in ' + c.capital,
        body: 'Delegates from every ' + c.terms.region + ' are arriving. Leadership positions are on the ballot this year, ' +
              'and everything decided here will hold for five years.', tone: 'good' });
      RZ.ui.toast('Conference year — leadership is contestable', 'p');
    }

    // Four weeks are up and the House has divided. This is the loudest thing
    // that happens outside an election, so it gets the sheet rather than a toast.
    if (out.billResult) {
      var br = out.billResult;
      var bEntry = {
        kind: br.passed ? 'big' : 'bad', alert: !br.passed,
        src: 'The ' + c.house.name, title: br.title, body: br.body,
        deltas: br.deltas || [], tone: br.tone
      };
      RZ.engine.pushFeed(S, bEntry);
      RZ.engine.save(S);
      RZ.ui.showOutcome(bEntry, function () {
        if (S.over) { RZ.ui.showEnd(); return; }
        if (out.election) { runElectionFlow(); return; }
        afterAction();
      });
      return;
    }
    if (out.billLapsed) {
      RZ.ui.toast(out.billLapsed.name + ' fell with the House', 'n');
    }

    if (out.sprintStarted) {
      RZ.ui.toast('Eight weeks to the ballot — turns are now weekly', 'p');
    }

    if (out.election) { runElectionFlow(); return; }

    if (S.pendingScene) { resumePendingScene(); return; }
    if (S.pendingEvent) { resumePendingEvent(); return; }
    RZ.ui.renderGame();
  }

  function resumePendingEvent() {
    var S = UI.S;

    // A situation that is a room rather than a card. It is resumed at the beat
    // it was left on, so closing the app mid-answer does not escape it.
    if (S.pendingEvent.talk) {
      var convo = RZ.dialogue.beginEvent(S, { beat: S.pendingEvent.talkBeat, mood: S.pendingEvent.talkMood });
      if (convo) {
        RZ.ui.showDialogue(convo, function (cv) {
          var entry = RZ.engine.finishEventDialogue(S, cv);
          if (S.over) { RZ.ui.showEnd(); return; }
          RZ.ui.renderGame();
        });
        return;
      }
      // No beats after all — fall through and treat it as an ordinary card.
      S.pendingEvent.talk = false;
    }

    RZ.ui.showEvent(S.pendingEvent, function (i) {
      var entry = RZ.engine.resolveEvent(S, i);
      RZ.ui.closeModal();
      RZ.ui.showOutcome(entry, function () {
        if (S.over) { RZ.ui.showEnd(); return; }
        RZ.ui.renderGame();
      });
    });
  }

  function runElectionFlow() {
    var S = UI.S;
    var go = function (rig) {
      var r = RZ.gov.runElection(S, { rig: rig });
      RZ.engine.pushFeed(S, {
        kind: 'big', src: 'Election ' + r.year,
        title: electionHeadline(S, r),
        body: electionSummary(S, r), tone: 'good'
      });
      RZ.ui.showElection(r, function () {
        if (S.over) { RZ.ui.showEnd(); return; }
        RZ.ui.renderGame();
      });
    };
    if (RZ.gov.canRig(S)) RZ.ui.showRigOffer(go);
    else go(0);
  }

  function electionHeadline(S, r) {
    var c = r.country;
    if (r.personal && r.personal.becamePresident) return S.player.name + ' wins the ' + c.terms.hos + 'cy';
    if (r.personal && r.personal.lostPresidency) return 'Defeated — ' + S.nation.presidentName + ' takes over';
    var lead = c.partyById[r.gov.lead];
    return lead.abbr + (r.gov.majority && r.gov.parties.length === 1 ? ' returned with a majority' : ' leads a coalition government');
  }
  function electionSummary(S, r) {
    var c = r.country;
    var total = RZ.sum(c.parties, function (p) { return r.seats[p.id] || 0; });
    return c.parties.slice().sort(function (a, b) { return (r.seats[b.id] || 0) - (r.seats[a.id] || 0); })
      .map(function (p) { return RZ.esc(p.abbr) + ' ' + (r.seats[p.id] || 0); }).join(' · ') +
      ' (of ' + total + '). ' + (r.personal && r.personal.messages.length ? RZ.esc(r.personal.messages.join(' ')) : '');
  }

  /* ---------------- abandon ---------------- */
  function abandon() {
    if (!confirm('End this career now and see how it is remembered?')) return;
    RZ.engine.endGame(UI.S, 'retire');
    RZ.engine.save(UI.S);
    RZ.ui.showEnd();
  }

  /* ----------------------------------------------------------------
     Android hardware back button. The APK shell calls this before it
     closes the app; returning true means "I handled it, stay open".
     ---------------------------------------------------------------- */
  var lastBack = 0;
  window.__androidBack = function () {
    // A modal is open: close it if it is dismissible, otherwise swallow the
    // press. An event demands a choice and must not be escapable.
    var modal = document.getElementById('modal');
    if (modal && !modal.hidden) {
      if (modal.dataset.dismissible) RZ.ui.closeModal();
      return true;
    }
    var active = document.querySelector('.screen.is-active');
    var id = active ? active.id : '';

    if (id === 'screen-create') { RZ.ui.show('country'); return true; }
    if (id === 'screen-country') { RZ.ui.show('title'); return true; }
    if (id === 'screen-end' || id === 'screen-title') return false;

    if (id === 'screen-game') {
      if (UI.pane !== 'desk') { UI.pane = 'desk'; RZ.ui.renderGame(); return true; }
      // On the desk, ask once before leaving. The career is already saved;
      // this is only to stop a stray press closing the app mid-month.
      var now = Date.now();
      if (now - lastBack < 2000) return false;
      lastBack = now;
      RZ.ui.toast('Press back again to leave');
      return true;
    }
    return false;
  };

  RZ.main = { init: init, begin: begin, act: act, contest: contest, endTurn: endTurn, abandon: abandon };
  document.addEventListener('DOMContentLoaded', init);
})();
