/* core.js — namespace, seeded RNG, small helpers */
var RZ = (function () {
  'use strict';

  // Kept in step with game/VERSION, which CI also stamps into the APK.
  var VERSION = '1.2.0';

  var _seed = 1;
  function seed(n) { _seed = (n >>> 0) || 1; }
  // mulberry32 — deterministic, so a career can be replayed from its seed
  function rnd() {
    _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
    var t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function getSeed() { return _seed >>> 0; }
  function range(a, b) { return a + rnd() * (b - a); }
  function irange(a, b) { return Math.floor(a + rnd() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function chance(p) { return rnd() < p; }
  function weighted(items, keyFn) {
    var tot = 0, i;
    for (i = 0; i < items.length; i++) tot += Math.max(0, keyFn(items[i]));
    if (tot <= 0) return pick(items);
    var r = rnd() * tot;
    for (i = 0; i < items.length; i++) { r -= Math.max(0, keyFn(items[i])); if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
  // normal-ish noise, mean 0
  function noise(sd) { return ((rnd() + rnd() + rnd() + rnd() - 2) / 2) * (sd || 1) * 2; }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function c100(v) { return clamp(v, 0, 100); }
  function round(v, d) { var m = Math.pow(10, d || 0); return Math.round(v * m) / m; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sum(arr, f) { var t = 0; for (var i = 0; i < arr.length; i++) t += f ? f(arr[i]) : arr[i]; return t; }

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function monthName(m) { return MONTHS[(m - 1) % 12]; }
  function monthShort(m) { return MONTHS_S[(m - 1) % 12]; }
  function dateLabel(d) { return monthShort(d.month) + ' ' + d.year; }

  // money is stored in whole local-currency units
  function money(v, sym) {
    var s = sym || '';
    var n = Math.abs(v), sign = v < 0 ? '-' : '';
    if (n >= 1e9) return sign + s + round(n / 1e9, 2) + 'bn';
    if (n >= 1e6) return sign + s + round(n / 1e6, 2) + 'm';
    if (n >= 1e3) return sign + s + round(n / 1e3, 0) + 'k';
    return sign + s + Math.round(n);
  }
  function pct(v, d) { return round(v, d === undefined ? 1 : d) + '%'; }
  function signed(v, d) { var r = round(v, d || 0); return (r > 0 ? '+' : '') + r; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(sel) { return document.querySelector(sel); }
  function els(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function ordinal(n) {
    var s = ['th','st','nd','rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  return {
    VERSION: VERSION,
    seed: seed, getSeed: getSeed, rnd: rnd, range: range, irange: irange, pick: pick,
    shuffle: shuffle, chance: chance, weighted: weighted, noise: noise,
    clamp: clamp, c100: c100, round: round, lerp: lerp, sum: sum,
    monthName: monthName, monthShort: monthShort, dateLabel: dateLabel, MONTHS: MONTHS,
    money: money, pct: pct, signed: signed, esc: esc, el: el, els: els, ordinal: ordinal
  };
})();
