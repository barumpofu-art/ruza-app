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
    if (ANON[role]) {
      return { name: RZ.makeName(c), role: role, org: org, anon: true };
    }
    init(S);
    var key = keyFor(role, org);
    var p = S.cast[key];
    if (!p) {
      p = S.cast[key] = {
        key: key, name: RZ.makeName(c), role: role, org: org,
        temper: RZ.pick(TEMPERS),
        // Nobody starts neutral about anybody, but nobody starts decided either.
        rel: Math.round(RZ.range(-12, 12)),
        met: 0, firstMet: null, lastSeen: null,
        memory: [], alive: true
      };
    }
    return p;
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
    var p = convo.speaker;
    if (!p || p.anon || !p.key) return null;
    init(S);
    if (!S.cast[p.key]) S.cast[p.key] = p;
    p.met++;
    if (p.firstMet === null) p.firstMet = S.date.year;
    p.lastSeen = S.turn;
    p.rel = clamp(p.rel + (SWING[convo.temp] || 0), -100, 100);
    return p;
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
    init: init, who: who, get: get, byRole: byRole, all: all, keyFor: keyFor,
    afterMeeting: afterMeeting, remember: remember, recalls: recalls,
    standing: standing, greeting: greeting, summary: summary
  };
})();
