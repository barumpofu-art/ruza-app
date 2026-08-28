/* dialogue.js — conversations.
   Some actions are not a dice roll, they are a meeting: somebody with a name
   and a grievance asks you something, and you have to answer in front of them.

   A scene is a short exchange — an opening, two or three questions, a closing —
   where every answer costs or buys something and the room keeps score. The
   running total is `mood`: how the meeting went, which decides the closing line
   and a final swing on top of the individual answers.
*/
(function () {
  'use strict';

  // How warm the room is, from the running mood.
  function temperature(mood) {
    if (mood >= 4) return 'warm';
    if (mood >= 1) return 'fair';
    if (mood >= -1) return 'cool';
    return 'hostile';
  }

  function scenesFor(S, topic) {
    var api = RZ.engine.mkApi(S);
    return (RZ.DIALOGUE || []).filter(function (sc) {
      if (sc.topic !== topic) return false;
      if (sc.only && sc.only.indexOf(S.countryId) < 0) return false;
      if (sc.when && !sc.when(api)) return false;
      // Don't repeat a scene the player saw recently.
      var seen = S.seenScenes && S.seenScenes[sc.id];
      if (seen !== undefined && S.turn - seen < 30) return false;
      return true;
    });
  }

  function sceneFor(S, topic) {
    var pool = scenesFor(S, topic);
    if (!pool.length) return null;
    return RZ.weighted(pool, function (sc) { return sc.weight || 5; });
  }

  // `resume` reopens a meeting that was interrupted — the app was closed with a
  // question on the table. The answers already given have already changed the
  // state and are not replayed: the room is simply picked up where it was.
  function begin(S, scene, act, resume) {
    var api = RZ.engine.mkApi(S);
    S.seenScenes = S.seenScenes || {};
    S.seenScenes[scene.id] = S.turn;

    var speaker = scene.speaker(api);
    // A room can hold more than one person. `others` names them, and every
    // line in the scene says who is speaking, so two of them can argue with
    // each other in front of you and you have to come down on a side.
    var people = { _: speaker };
    if (scene.others) {
      Object.keys(scene.others).forEach(function (k) { people[k] = scene.others[k](api); });
    }
    var convo = {
      sceneId: scene.id, scene: scene, api: api, speaker: speaker,
      people: people, act: act || null, eventId: scene.eventId || null,
      where: text(scene.where, api, null),
      beat: 0, mood: 0, done: false, transcript: []
    };
    // Four things the answers need, and they need the speaker to be resolved
    // first, which is why they are attached here rather than in mkApi.
    api.them = speaker;
    api.remember = function (what, tone) { return RZ.cast && RZ.cast.remember(S, speaker, what, tone); };
    api.recalls = function (tone) { return RZ.cast && RZ.cast.recalls(S, speaker, tone); };
    api.rel = function () { return speaker && speaker.rel !== undefined ? speaker.rel : 0; };
    // In a room with several people in it, the answers need to be able to
    // reach the one who is not doing the asking.
    api.who = function (k) { return people[k] || speaker; };

    if (resume && resume.beat > 0 && resume.beat < scene.beats.length) {
      convo.beat = resume.beat;
      convo.mood = resume.mood || 0;
      convo.transcript.push({ who: 'them', text: 'You were halfway through this. They are still waiting.' });
    } else {
      // A meeting with somebody you have met before does not start from
      // nothing. Only on a fresh start: you do not get greeted twice for
      // having closed the app halfway through.
      var hello = RZ.cast ? RZ.cast.greeting(S, speaker) : '';
      if (hello) convo.transcript.push({ who: 'them', text: hello });
      convo.transcript.push({ who: 'them', text: text(scene.opening, api, convo) });
    }
    pushQuestion(convo);
    return convo;
  }

  // An event that is a room rather than a card. The event definition carries
  // the beats itself, so the whole situation stays in one place in data-events.
  function beginEvent(S, resume) {
    var ev = S.pendingEvent;
    if (!ev || !ev.talk) return null;
    var def = (RZ.EVENTS || []).filter(function (e) { return e.id === ev.id; })[0];
    if (!def || !def.beats) return null;
    var scene = {
      id: 'event:' + def.id, eventId: def.id, topic: 'event',
      speaker: def.speaker, where: def.where, opening: def.opening || def.body,
      beats: def.beats, close: def.close, settles: def.settles,
      settleOn: def.settleOn, headline: def.headline
    };
    return begin(S, scene, null, resume);
  }

  function pushQuestion(convo) {
    var beat = convo.scene.beats[convo.beat];
    if (!beat) return;
    // They have this out between themselves first. You are in the room and
    // nobody is talking to you yet, which is the whole effect being aimed at.
    (beat.argument || []).forEach(function (l) {
      convo.transcript.push({
        who: 'them', by: l.by,
        text: text(l.t, convo.api, convo),
        at: l.at || null
      });
    });
    convo.transcript.push({
      who: 'them', by: beat.by || null,
      text: text(beat.q, convo.api, convo)
    });
  }

  function text(v, api, convo) {
    return typeof v === 'function' ? v(api, convo) : v;
  }

  // The answers on offer for the current question, filtered by what the player
  // can actually say — you cannot promise money you do not have.
  function options(convo) {
    var beat = convo.scene.beats[convo.beat];
    if (!beat) return [];
    return beat.answers.map(function (ans, i) {
      return {
        i: i, t: text(ans.t, convo.api, convo), tag: ans.tag,
        // Which of the people in the room this answer comes down for, so the
        // screen can say whose side you are taking before you take it.
        side: ans.side || null,
        ok: !ans.when || ans.when(convo.api)
      };
    });
  }

  function choose(convo, index) {
    if (convo.done) return;
    var beat = convo.scene.beats[convo.beat];
    var ans = beat.answers[index];
    if (!ans || (ans.when && !ans.when(convo.api))) return;

    convo.transcript.push({ who: 'me', text: text(ans.t, convo.api, convo) });
    convo.mood += (ans.mood || 0);
    if (ans.run) ans.run(convo.api, convo);

    // Coming down on one side of an argument is not free: the person you
    // backed remembers it, and so does the one you did not.
    if (ans.side && convo.people && RZ.cast) {
      var backed = convo.people[ans.side];
      // Only the people who were actually arguing are cooled by losing. The
      // parties to an argument are exactly the ones some answer in this beat
      // comes down for — a chair who put the question is not one of them, and
      // should not pay for a decision they asked you to make.
      var parties = {};
      (beat.answers || []).forEach(function (x) { if (x.side) parties[x.side] = true; });
      var others = Object.keys(parties)
        .filter(function (k) { return k !== ans.side && convo.people[k] && convo.people[k] !== backed; })
        .map(function (k) { return convo.people[k]; });
      RZ.cast.sideWith(convo.api.S, backed, others, ans.sideWeight);
    }

    // The reply comes from whoever the answer was aimed at, or from whoever
    // asked, or from the person whose room it is.
    convo.transcript.push({
      who: 'them', by: ans.replyBy || ans.side || beat.by || null,
      text: text(ans.reply, convo.api, convo)
    });

    convo.beat++;
    if (convo.beat < convo.scene.beats.length) {
      pushQuestion(convo);
    } else {
      close(convo);
    }
    // Each answer has already changed the state, so hold it now: leaving the
    // app halfway through a meeting should not undo what you just said. For an
    // event the position in the room is held too, because an event is not
    // escapable and has to be resumable exactly where it was left.
    var S = convo.api.S;
    if (convo.eventId && S.pendingEvent && S.pendingEvent.id === convo.eventId) {
      if (convo.done) S.pendingEvent = null;
      else { S.pendingEvent.talkBeat = convo.beat; S.pendingEvent.talkMood = convo.mood; }
    }
    RZ.engine.save(S);
  }

  function close(convo) {
    var temp = temperature(convo.mood);
    convo.temp = temp;
    var closing = convo.scene.close
      ? convo.scene.close(convo.api, temp, convo)
      : defaultClose(convo.api, temp);
    convo.transcript.push({ who: 'them', text: closing, closing: true });

    // The meeting as a whole, on top of what each answer already did.
    var swing = { warm: 1, fair: 0.4, cool: -0.3, hostile: -1 }[temp];
    if (convo.scene.settles) convo.scene.settles(convo.api, temp, convo);
    else defaultSettle(convo.api, convo.scene, swing);

    convo.done = true;
  }

  function defaultClose(a, temp) {
    return {
      warm: 'They stand, shake your hand properly, and walk you to the door.',
      fair: 'They thank you for coming. Nothing is promised either way.',
      cool: 'They gather their papers before you have finished speaking.',
      hostile: 'They leave without shaking your hand. Somebody will be told about this.'
    }[temp];
  }

  function defaultSettle(a, scene, swing) {
    var field = scene.settleOn || 'grassroots';
    a.add(field, swing * a.rng(2, 4));
  }

  // A crisis that summons you is a conversation too. The engine parks a scene
  // id on the state; main.js presents it the way it presents any other, so a
  // reshuffle rumour arrives as the chief of staff in a corridor rather than
  // as an alert card with three buttons.
  function byId(id) {
    return (RZ.DIALOGUE || []).filter(function (sc) { return sc.id === id; })[0] || null;
  }
  function beginById(S, id) {
    var sc = byId(id);
    return sc ? begin(S, sc, null) : null;
  }
  // Queue one for the next time the player is looking at the desk.
  function summon(S, id) {
    if (!byId(id)) return false;
    S.pendingScene = id;
    return true;
  }

  RZ.dialogue = {
    byId: byId, beginById: beginById, summon: summon,
    sceneFor: sceneFor, scenesFor: scenesFor, begin: begin, beginEvent: beginEvent,
    options: options, choose: choose, temperature: temperature
  };
})();
