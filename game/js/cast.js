/* cast.js — the people you keep meeting.

   Until this file existed, every scene generated a fresh random name. The
   General Secretary who made you promise an above-inflation settlement in 2029
   was a different woman in 2031, with no memory of it and no opinion of you.
   That is the difference between a game about politics and a spreadsheet with
   prose on top: you cannot betray somebody you have never met twice.

   So there is now a cast. Roughly two dozen slots, filled lazily the first time
   a scene asks for one, and permanent afterwards. Each of them keeps a
   relationship score, a count of how many times you have sat down together, and
   a short memory of the things you said in front of them. Scenes can read all
   three.

   Not everybody is in it. The elderly woman at the front of a kgotla and the
   caller on the radio phone-in are genuinely strangers, and pretending
   otherwise would be worse than the problem this file solves. Those stay
   anonymous, by name, in ANON below.
*/
(function () {
  'use strict';
  var clamp = RZ.clamp;

  // Roles that really are a different person every time. Matched on the exact
  // role string the scene asks for.
  var ANON = {
    'an elderly woman at the front': 1,
    'a nurse, still in uniform': 1,
    'a caller, live on air': 1,
    'the family spokesman': 1,
    'a student leader': 1
  };

  // How much of themselves each kind of person brings into the room. Purely
  // for colour in the scenes that want it; nothing reads it mechanically.
  var TEMPERS = [
    'does not raise their voice and has never needed to',
    'talks over you and always has',
    'writes everything down, including this',
    'is friendly in a way that is entirely professional',
    'has been doing this since before you could vote',
    'is younger than you and in a hurry',
    'never quite looks at you directly',
    'laughs first and means none of it'
  ];

  function keyFor(role, org) { return (role || '') + '|' + (org || ''); }
  function first(n) { return String(n || '').split(' ')[0]; }

  // Almost everywhere in the game a person is referred to by their first name
  // alone — "Backs Mandla", "THANDI to MANDLA". So a cast member who shares a
  // first name with the player, or with somebody already in the cast, is not a
  // flavour problem, it is an ambiguous sentence. Try again a few times, and
  // fall back to the full name rather than looping forever.
  function freshName(S, c) {
    var taken = takenFirstNames(S);
    var full = {};
    Object.keys(S.cast || {}).forEach(function (k) { full[S.cast[k].name] = true; });
    full[S.player && S.player.name] = true;
    var n = RZ.makeName(c);
    for (var i = 0; i < 20 && (taken[first(n)] || full[n]); i++) n = RZ.makeName(c);
    // A small pool can run out of first names; it must never run out of whole
    // ones, or two people become the same person.
    for (var j = 0; j < 40 && full[n]; j++) n = RZ.makeName(c);
    return n;
  }
  function takenFirstNames(S) {
    var taken = {};
    taken[first(S.player && S.player.name)] = true;
    Object.keys(S.cast || {}).forEach(function (k) { taken[first(S.cast[k].name)] = true; });
    return taken;
  }

  // What to call them on screen. A first name almost always, because that is
  // how these rooms actually sound — but a country with a small pool of names
  // will eventually hand you two Siphos, and "Backs Sipho" has to mean one
  // person. Where the first name is already spoken for, the whole name is used.
  // Identity is the key, never the name: two people can be handed the same
  // name, and comparing by name means each of them filters the other out and
  // both decide they are unambiguous.
  function shortOf(S, p) {
    if (!p) return '';
    var f = first(p.name);
    if (first(S.player && S.player.name) === f) return p.name;
    var others = Object.keys(S.cast || {})
      .filter(function (k) { return k !== p.key; })
      .map(function (k) { return S.cast[k]; });
    for (var i = 0; i < others.length; i++) {
      if (first(others[i].name) === f) return p.name;
    }
    return f;
  }

  function init(S) {
    if (!S.cast) S.cast = {};
    return S.cast;
  }

  /* =======================================================================
     RESOLVING A PERSON
     ======================================================================= */
  // The one function the scenes go through. Same signature as the helper it
  // replaced, so no scene had to be rewritten: pass a role and an organisation,
  // get back somebody. The difference is that now it is the *same* somebody.
  function who(S, c, role, org) {
    init(S);
    if (ANON[role]) {
      return { name: freshName(S, c), role: role, org: org, anon: true };
    }
    var key = keyFor(role, org);
    var p = S.cast[key];
    if (!p) {
      p = S.cast[key] = {
        key: key, name: freshName(S, c), role: role, org: org,
        temper: RZ.pick(TEMPERS),
        // Nobody starts neutral about anybody, but nobody starts decided either.
        rel: Math.round(RZ.range(-12, 12)),
        met: 0, firstMet: null, lastSeen: null, bornTurn: S.turn,
        memory: [], alive: true
      };
    }
    return p;
  }

  // A chair changes hands. The person who had it stays in the cast — you still
  // know them — but they no longer occupy the role, so the next scene that
  // asks for the Minister of Finance gets somebody else.
  function succeed(S, c, role, org) {
    init(S);
    var key = keyFor(role, org);
    var old = S.cast[key];
    if (old) {
      var n = 1, formerKey;
      do {
        formerKey = 'former ' + role + '|' + (org || '') + '|' + n;
        n++;
      } while (S.cast[formerKey]);
      old.key = formerKey;
      old.role = 'former ' + role;
      S.cast[formerKey] = old;
      delete S.cast[key];
    }
    return who(S, c, role, org);
  }

  function get(S, key) { init(S); return S.cast[key] || null; }
  function byRole(S, role, org) { return get(S, keyFor(role, org)); }
  function all(S) {
    init(S);
    return Object.keys(S.cast).map(function (k) { return S.cast[k]; })
      .filter(function (p) { return p.met > 0; });
  }

  /* =======================================================================
     WHAT A MEETING DOES TO THEM
     ======================================================================= */
  // Called when a conversation closes. The temperature of the room is already
  // computed from the answers given, so this is simply the record of it.
  var SWING = { warm: 9, fair: 2, cool: -5, hostile: -14 };

  function afterMeeting(S, convo) {
    init(S);
    // Everybody who was in the room has now been met, not only whoever was
    // doing the asking: sitting through two ministers arguing and coming down
    // on one of them is how you come to know both of them.
    var seen = convo.people
      ? Object.keys(convo.people).map(function (k) { return convo.people[k]; })
      : [convo.speaker];
    var counted = [];
    seen.forEach(function (p) {
      if (!p || p.anon || !p.key || counted.indexOf(p) >= 0) return;
      counted.push(p);
      if (!S.cast[p.key]) S.cast[p.key] = p;
      p.met++;
      if (p.firstMet === null) p.firstMet = S.date.year;
      p.lastSeen = S.turn;
      // The temperature of the room is the primary's to read. The others have
      // already been moved by whichever way you went in front of them.
      if (p === convo.speaker) p.rel = clamp(p.rel + (SWING[convo.temp] || 0), -100, 100);
    });
    return convo.speaker && convo.speaker.key ? convo.speaker : null;
  }

  /* =======================================================================
     WHAT TIME DOES TO THEM
     ======================================================================= */
  // Nobody stays furious forever about somebody they never see, and nobody
  // stays grateful either. A relationship that is not being fed drifts back
  // toward the middle.
  //
  // This is not decoration. Everything that moves `rel` — a meeting, a side
  // taken, an appointment not kept — is a push in one direction, and a push
  // with nothing pulling the other way runs to the floor and stays there. The
  // half-life here is about three years, which is slow enough that a career's
  // worth of neglect still shows and fast enough that it finds a level.
  var IDLE = 6;                  // months before it starts to fade at all
  function drift(S, span) {
    init(S);
    var sp = span === undefined ? 1 : span;
    Object.keys(S.cast).forEach(function (k) {
      var p = S.cast[k];
      if (!p || p.rel === 0) return;
      var idle = S.turn - (p.lastSeen === null ? (p.bornTurn || 0) : p.lastSeen);
      if (idle < IDLE) return;
      p.rel = clamp(p.rel + (0 - p.rel) * 0.02 * sp, -100, 100);
      if (Math.abs(p.rel) < 0.4) p.rel = 0;
    });
  }

  // Being let down has a floor, and it is not -100. Somebody you have never
  // met and never turned up for ends up cold, not homicidal; only things you
  // actually did in front of them take it further than that.
  function ding(S, p, amount, floor) {
    if (!p) return null;
    init(S);
    if (!S.cast[p.key]) S.cast[p.key] = p;
    if (p.rel <= floor) return p;
    p.rel = clamp(Math.max(floor, p.rel - amount), -100, 100);
    return p;
  }

  // You were asked to choose between two people in the same room and you did.
  // The one you backed gains more than the ones you did not lose, because
  // being chosen is louder than not being chosen — but nobody in that room
  // forgets which way you went.
  function sideWith(S, backed, against, weight) {
    var w = weight === undefined ? 1 : weight;
    init(S);
    if (backed && !backed.anon && backed.key) {
      if (!S.cast[backed.key]) S.cast[backed.key] = backed;
      backed.rel = clamp(backed.rel + 11 * w, -100, 100);
      backed.sidedWith = (backed.sidedWith || 0) + 1;
    }
    (against || []).forEach(function (p) {
      if (!p || p.anon || !p.key || p === backed) return;
      if (!S.cast[p.key]) S.cast[p.key] = p;
      p.rel = clamp(p.rel - 7 * w, -100, 100);
      p.sidedAgainst = (p.sidedAgainst || 0) + 1;
    });
    return backed;
  }

  // Something specific, said in front of them, that they are entitled to bring
  // up later. Kept short on purpose: a memory nobody ever reads is a leak.
  function remember(S, p, what, tone) {
    if (!p || p.anon || !p.key) return null;
    init(S);
    if (!S.cast[p.key]) S.cast[p.key] = p;
    p.memory.push({ year: S.date.year, turn: S.turn, what: what, tone: tone || 'flat' });
    if (p.memory.length > 6) p.memory.shift();
    return p;
  }

  // The oldest thing they still hold against you, or the oldest thing they are
  // still grateful for. Scenes use this to quote you back at yourself.
  function recalls(S, p, tone) {
    if (!p || !p.memory || !p.memory.length) return null;
    var pool = tone ? p.memory.filter(function (m) { return m.tone === tone; }) : p.memory;
    return pool.length ? pool[0] : null;
  }

  /* =======================================================================
     HOW THEY DESCRIBE YOU
     ======================================================================= */
  function standing(p) {
    if (!p) return 'unknown';
    if (p.rel >= 55) return 'owes you and knows it';
    if (p.rel >= 25) return 'on your side';
    if (p.rel >= 8) return 'warm enough';
    if (p.rel > -8) return 'undecided';
    if (p.rel > -25) return 'cool';
    if (p.rel > -55) return 'against you';
    return 'will not be in a room with you';
  }

  // One line of preamble a scene can drop into its opening so the meeting
  // starts where the last one ended rather than from nothing.
  function greeting(S, p) {
    if (!p || p.anon || !p.met) return '';
    var gap = p.firstMet === null ? 0 : S.date.year - p.firstMet;

    // The best opening line is one you wrote yourself, some years ago, in this
    // room. Putting it here rather than in the scenes means every one of them
    // gets it without a word being rewritten.
    var m = p.memory.length ? p.memory[0] : null;
    if (m && S.date.year > m.year && RZ.chance(0.55)) {
      if (m.tone === 'promise') {
        return 'Before you sit down: "' + m.what + '." ' + m.year + '. ' +
          (S.date.year - m.year === 1 ? 'Last year.' : (S.date.year - m.year) + ' years ago.') +
          ' They have it written down and they have brought the paper.';
      }
      if (m.tone === 'bad') {
        return 'They let you get as far as the chair. "' + m.what + '. ' + m.year + '. ' +
          'I have not raised it since and I am raising it now."';
      }
      return 'They mention it before you do — "' + m.what + '", ' + m.year + ' — and it is not clear ' +
        'whether it is being offered as a credit or filed as a debt.';
    }

    if (p.rel >= 40) {
      return 'They stand up when you come in, which they did not do the first time.';
    }
    if (p.rel <= -40) {
      return 'They do not stand, and they have arranged the chairs so that you are further away than last time.';
    }
    if (p.met >= 4) {
      return 'The ' + ordinal(p.met + 1) + ' time in this room, and neither of you bothers with the preamble any more.';
    }
    if (gap >= 4) {
      return 'It has been ' + gap + ' years. They have not changed and you have, and both of you notice.';
    }
    return '';
  }
  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function summary(S) {
    return all(S).slice().sort(function (a, b) { return b.met - a.met; }).map(function (p) {
      return {
        key: p.key, name: p.name, role: p.role, org: p.org,
        rel: Math.round(p.rel), met: p.met, standing: standing(p),
        since: p.firstMet, memory: p.memory.length
      };
    });
  }

  RZ.cast = {
    ANON: ANON, TEMPERS: TEMPERS, SWING: SWING,
    init: init, who: who, succeed: succeed, freshName: freshName, shortOf: shortOf, get: get, byRole: byRole, all: all, keyFor: keyFor,
    afterMeeting: afterMeeting, remember: remember, recalls: recalls, sideWith: sideWith,
    drift: drift, ding: ding, IDLE: IDLE,
    standing: standing, greeting: greeting, summary: summary
  };
})();
