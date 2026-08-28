/* trenches.js — the bottom of the ladder, where the game is not about standing
   but about whether anybody will let you stand at all.

   Above tier four a career is a contest: you have standing, a record, a rival
   with a name, and the question is whether you are strong enough. Below it none
   of that is true yet. There is one person — the secretary who keeps the branch
   register — and a list, and your name is on the list or it is not. Nobody in
   that room cares what your oratory is.

   Three things live here: what it takes to get onto the list, the unglamorous
   work that is the only honest way to earn it, and the offer that comes when you
   are close and short, which is the first time this career asks you to pay for
   something with something other than money.
*/
(function () {
  'use strict';
  var clamp = RZ.clamp;

  // Above this the branch secretary is somebody you used to need. They do not
  // stop existing — that is the point of a persistent cast — they stop being
  // the door.
  var TOP_TIER = 3;

  function init(S) {
    if (!S.trenches) {
      S.trenches = {
        favour: Math.round(RZ.range(-6, 10)),   // nobody starts owed anything
        chairs: 0, hustles: 0,
        bargain: null, offered: false, refusals: 0,
        listedAt: -1
      };
    }
    return S.trenches;
  }

  function active(S) {
    return RZ.engine.mkApi(S).tier() <= TOP_TIER;
  }

  /* =======================================================================
     THE PERSON WITH THE REGISTER
     ======================================================================= */
  // One person, in your own region, for the whole climb. They are resolved
  // through the cast, so the relationship survives into the years when you no
  // longer need them — which is when it starts being interesting.
  function keeper(S) {
    var c = RZ.COUNTRIES[S.countryId];
    var where = (c.regionById[S.player.regionId] || {}).name || '';
    return RZ.cast.who(S, c, 'the ' + c.terms.branch + ' secretary', where);
  }

  // What the next rung's list costs in favour. A branch chair is a handful of
  // people in a hall; a constituency chair is a slate, and slates are guarded.
  function need(S) {
    var t = RZ.engine.mkApi(S).tier();
    return t <= 0 ? 18 : t === 1 ? 30 : t === 2 ? 42 : 54;
  }

  function onList(S) {
    init(S);
    if (!active(S)) return true;
    return S.trenches.favour >= need(S);
  }

  // How much the secretary's goodwill is worth in the hall on the day. Being on
  // the list is most of it; being liked on top of that is worth a little more.
  function listBonus(S, regionId) {
    if (!S.trenches || !active(S) || regionId !== S.player.regionId) return 0;
    var f = S.trenches.favour;
    if (f < need(S)) return -Math.min(14, (need(S) - f) * 0.45);
    return Math.min(12, 3 + (f - need(S)) * 0.22);
  }

  /* =======================================================================
     WHAT MOVES IT
     ======================================================================= */
  // Favour is a push like any other, so it needs something pulling back or it
  // becomes a grind with no tension: a branch that does not see you forgets you
  // at about three per cent a month.
  function tick(S, span, out) {
    init(S);
    var T = S.trenches;
    if (!active(S)) return null;
    var before = T.favour;
    T.favour = clamp(T.favour - T.favour * 0.03 * span, -100, 100);
    if (Math.abs(T.favour) < 0.5) T.favour = 0;

    return { favour: T.favour, moved: T.favour - before };
  }

  function earn(S, amount, why) {
    init(S);
    var T = S.trenches;
    T.favour = clamp(T.favour + amount, -100, 100);
    var p = keeper(S);
    if (p && why) RZ.cast.remember(S, p, why, amount > 0 ? 'good' : 'bad');
    return T.favour;
  }

  /* =======================================================================
     THE OFFER
     =======================================================================
     Somewhere in the second or third year somebody notices that you are doing
     everything right and it is not working, and explains why. The event itself
     lives in data-events.js with everything else that happens to you; this is
     only the question of whether it is time.

     The band matters. Too early and it is not a short cut, because there was
     nothing to cut short; too late and you were going to get there anyway.
  */
  function wantsOffer(S) {
    init(S);
    if (!active(S)) return false;
    if (S.trenches.bargain || S.trenches.refusals) return false;
    var n = need(S);
    return S.trenches.favour >= n * 0.45 && S.trenches.favour < n * 0.92;
  }

  // What you agreed to, or that you were asked and would not. Either way it is
  // on the record: a career has a first compromise or it conspicuously has not.
  function mark(S, kind) {
    init(S);
    if (kind) S.trenches.bargain = { kind: kind, who: keeper(S).key, year: S.date.year };
    else S.trenches.refusals++;
    S.trenches.offered = true;
    return S.trenches.bargain;
  }

  /* =======================================================================
     WHERE IT SHOWS
     ======================================================================= */
  function status(S) {
    init(S);
    if (!active(S)) return null;
    var p = keeper(S);
    var f = S.trenches.favour, n = need(S);
    return {
      name: RZ.cast.shortOf(S, p), full: p.name, role: p.role,
      favour: Math.round(f), need: n, on: f >= n,
      pct: clamp((f / n) * 100, 0, 100),
      chairs: S.trenches.chairs, hustles: S.trenches.hustles,
      bargain: S.trenches.bargain,
      read: f >= n * 1.3 ? 'You are on the list, and high enough on it to be worth beating.'
          : f >= n ? 'Your name is on the list. It is at the bottom, but it is on it.'
          : f >= n * 0.7 ? 'Close. One more season of showing up would do it.'
          : f >= n * 0.35 ? 'They know your face. That is not the same as knowing your name.'
          : 'Nobody in that office would recognise you in the street.'
    };
  }

  RZ.trenches = {
    TOP_TIER: TOP_TIER,
    init: init, active: active, keeper: keeper, need: need, onList: onList,
    listBonus: listBonus, tick: tick, earn: earn, wantsOffer: wantsOffer,
    mark: mark, status: status
  };
})();
