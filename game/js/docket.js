/* docket.js — the diary, and the fact that most of it is already spoken for.

   An action grid says: here are forty things you could do, pick three. A diary
   says: two or three of these were arranged without asking you, by people with
   names, and the rest of the month is what is left. That is a different game
   even when the underlying actions are identical, because it is the difference
   between choosing and answering.

   Nothing here changes the economy of a turn. An appointment costs the same
   action it always cost, and the free slots are the same deck. What is new is
   that not going somewhere is now a thing you did, and the person who asked
   for the meeting notices.
*/
(function () {
  'use strict';
  var clamp = RZ.clamp;

  // Times, purely so the diary reads like one. Earlier is more senior, which
  // is a real thing about diaries.
  var SLOTS = ['08:00', '09:30', '11:00', '14:00', '16:30'];

  function init(S) {
    if (!S.docket) S.docket = { turn: -1, entries: [], declined: 0, kept: 0 };
    return S.docket;
  }

  /* =======================================================================
     WHO WANTS WHAT
     ======================================================================= */
  // How much of the month is already spoken for. Never all of it: the free
  // slot is the whole point, and a diary with no room in it is a corridor.
  function slotsFor(S) {
    var per = S.actionsPerTurn || 3;
    if (per <= 1) return 0;
    return Math.max(1, Math.min(3, per - 1));
  }

  // The pickers ask a question before they resolve, and a two-action job is
  // not something somebody else gets to put in your diary. Everything else is
  // bookable; the ones with a person in them are preferred, because a diary is
  // made of people.
  function bookable(S, a) {
    if ((a.ap || 1) > 1) return false;
    var act = RZ.actionById[a.id] || (RZ.gov && RZ.gov.actionById(a.id));
    return !act || !act.special;
  }

  function candidates(S) {
    var api = RZ.engine.mkApi(S);
    return RZ.engine.availableActions(S).filter(function (a) {
      return bookable(S, a);
    }).map(function (a) {
      // The scene is chosen now and written into the entry, so the diary
      // cannot promise one person and produce another when you turn up.
      var pool = RZ.dialogue ? RZ.dialogue.scenesFor(S, a.id) : [];
      var sc = pool.length ? RZ.weighted(pool, function (x) { return x.weight || 5; }) : null;
      return { act: a, scene: sc, person: sc ? sc.speaker(api) : null };
    });
  }

  // Somebody you already know, asking again, beats a stranger — that is what
  // having a cast is for. After that, somebody you have wronged, then anybody.
  function weightFor(S, cand) {
    var p = cand.person;
    if (!p) return 1;
    var w = 3;
    if (p.met > 0) w += 6;                       // you know them
    if (p.memory && p.memory.length) w += 5;     // and they are holding something
    if (p.stoodUp) w += 3;                       // and you have done this before
    if (p.rel <= -25) w += 4;                    // and it did not go well last time
    if (p.rel >= 40) w += 2;                     // or it went very well
    return w;
  }

  // Why it is in the diary. Read off the person rather than picked at random,
  // so the reason is always true of them.
  // Where nobody in particular is behind it, the office is. Four ways of
  // saying so, because the same sentence twice in one month reads like a bug.
  var OFFICE = [
    'It is in the diary because of the job.',
    'The office put it there. Nobody asked you.',
    'A standing arrangement. It has been in the book for months.',
    'Somebody in the constituency office committed you to it.',
    'Inherited from whoever held this desk before you.'
  ];

  function reasonFor(S, cand) {
    var p = cand.person;
    if (!p) return RZ.pick(OFFICE);
    var m = p.memory && p.memory.length ? p.memory[0] : null;
    if (p.stoodUp) return 'Rebooked. You did not come the last time either.';
    if (m && S.date.year > m.year) return 'Still about ' + m.year + '. "' + m.what + '."';
    if (p.rel <= -25) return 'They asked for it, which from them is not a good sign.';
    if (p.rel >= 40) return 'They asked for it, and they do not ask for much.';
    if (p.met > 0) return 'The ' + ordinal(p.met + 1) + ' time. They asked.';
    return 'They asked for the meeting.';
  }
  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* =======================================================================
     BUILDING THE MONTH
     ======================================================================= */
  function build(S) {
    init(S);
    S.docket.turn = S.turn;
    S.docket.entries = [];
    if (S.over) return S.docket;
    // The campaign and a bill in committee already own the diary; a second
    // diary on top of a weekly sprint is noise.
    if (S.tempo === 'week') return S.docket;

    var want = slotsFor(S);
    if (!want) return S.docket;
    var pool = candidates(S);
    if (!pool.length) return S.docket;

    // A diary is made of people. The first slot goes to somebody with a name
    // if anybody in the deck has one; the rest can be the office.
    var picked = [], used = {};
    for (var i = 0; i < want; i++) {
      var open = pool.filter(function (cd) { return !used[cd.act.id]; });
      if (!open.length) break;
      var named = open.filter(function (cd) { return !!cd.person; });
      var from = (i === 0 && named.length) ? named : open;
      var cd = RZ.weighted(from, function (x) { return weightFor(S, x); });
      used[cd.act.id] = true;
      picked.push(cd);
    }

    S.docket.entries = picked.map(function (cd, i) {
      var p = cd.person;
      return {
        actionId: cd.act.id,
        sceneId: cd.scene ? cd.scene.id : null,
        ico: cd.act.ico,
        name: cd.act.name,
        at: SLOTS[i] || SLOTS[SLOTS.length - 1],
        who: p ? { key: p.key || null, name: RZ.cast ? RZ.cast.shortOf(S, p) : p.name, role: p.role } : null,
        why: reasonFor(S, cd),
        kept: false, declined: false
      };
    });
    return S.docket;
  }

  function entries(S) { init(S); return S.docket.entries; }
  function entryFor(S, actionId) {
    return entries(S).filter(function (e) {
      return e.actionId === actionId && !e.kept && !e.declined;
    })[0] || null;
  }
  function open(S) {
    return entries(S).filter(function (e) { return !e.kept && !e.declined; });
  }

  // The scene this appointment was booked against, if it is still a scene that
  // could happen. A month is short, but a promotion inside one can invalidate
  // a room, and then it is better to fall back than to force it.
  function sceneFor(S, actionId) {
    var e = entryFor(S, actionId);
    if (!e || !e.sceneId || !RZ.dialogue) return null;
    var live = RZ.dialogue.scenesFor(S, actionId);
    for (var i = 0; i < live.length; i++) if (live[i].id === e.sceneId) return live[i];
    return null;
  }

  // Turning up to something that was in the diary. The action itself runs
  // through the engine as normal; this only records that you came.
  function keep(S, actionId) {
    var e = entryFor(S, actionId);
    if (!e) return null;
    e.kept = true;
    S.docket.kept = (S.docket.kept || 0) + 1;
    if (e.who && e.who.key && RZ.cast) {
      var p = RZ.cast.get(S, e.who.key);
      if (p) p.rel = clamp(p.rel + 2, -100, 100);
    }
    return e;
  }

  // Sending word. This is the cheap way out and it is meant to be: a person
  // who is told is a person who can use the morning for something else. It
  // costs no action, because not going somewhere never does.
  function decline(S, actionId) {
    var e = entryFor(S, actionId);
    if (!e) return null;
    e.declined = true;
    S.docket.declined = (S.docket.declined || 0) + 1;
    if (e.who && e.who.key && RZ.cast) {
      var p = RZ.cast.get(S, e.who.key);
      if (p) RZ.cast.ding(S, p, RZ.range(2, 6), -45);
    }
    return e;
  }

  // Not going, and not saying so. This is the part an action grid could never
  // express: the meeting existed, somebody arranged it, and you were not there.
  // It costs more than cancelling, it is remembered, and it is in the record.
  function close(S) {
    var missed = open(S), out = [], names = [];
    if (!missed.length) return out;
    var api = RZ.engine.mkApi(S);
    missed.forEach(function (e) {
      e.declined = true;
      out.push(e);
      if (e.who && e.who.key && RZ.cast) {
        var p = RZ.cast.get(S, e.who.key);
        if (p) {
          RZ.cast.ding(S, p, RZ.range(6, 13), -70);
          p.stoodUp = (p.stoodUp || 0) + 1;
          RZ.cast.remember(S, p, 'You did not come, and you did not send anybody', 'bad');
          names.push(RZ.cast.shortOf(S, p));
        }
      }
    });
    api.add('grassroots', -RZ.range(0.5, 2) * missed.length);
    // One card for the month, however many mornings it was. A card each would
    // bury everything else that happened.
    RZ.engine.pushFeed(S, {
      kind: 'flat', src: names.length ? names[0] : 'The diary',
      title: names.length === 1 ? names[0] + ' waited'
           : names.length ? names.length + ' people waited'
           : 'Mornings nobody accounted for',
      body: (names.length
        ? 'The appointments were not cancelled, they were simply not attended. ' +
          names.join(', ') + ' sat for forty minutes each and then left, and somebody in ' +
          'every one of those offices wrote the time down.'
        : 'The slots were in the diary and nothing went into them. Nobody minds once.'),
      deltas: api.deltas.slice(), tone: 'flat'
    });
    return out;
  }

  // The campaign, or a bill in committee, takes the month over entirely. What
  // was in the diary is simply gone, and nobody is stood up for it: an election
  // is a reason everybody in the country accepts.
  function suspend(S) {
    init(S);
    var n = S.docket.entries.length;
    S.docket.entries = [];
    return n;
  }

  function summary(S) {
    init(S);
    return {
      total: S.docket.entries.length,
      open: open(S).length,
      kept: S.docket.entries.filter(function (e) { return e.kept; }).length,
      declined: S.docket.entries.filter(function (e) { return e.declined; }).length
    };
  }

  RZ.docket = {
    SLOTS: SLOTS,
    init: init, build: build, entries: entries, entryFor: entryFor, open: open,
    sceneFor: sceneFor, keep: keep, decline: decline, close: close, suspend: suspend,
    summary: summary, slotsFor: slotsFor, weightFor: weightFor, bookable: bookable
  };
})();
