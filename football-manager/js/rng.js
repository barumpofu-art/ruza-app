// Small deterministic RNG so a saved game replays the same way it was played.
// mulberry32: fast, 32-bit state, good enough for a football game.

export function makeRng(seed = Date.now()) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    get state() { return state; },
    set state(v) { state = v >>> 0; },

    // float in [min, max)
    range(min, max) { return min + next() * (max - min); },

    // integer in [min, max] inclusive
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },

    chance(p) { return next() < p; },

    pick(arr) { return arr[Math.floor(next() * arr.length)]; },

    // Bell-shaped draw, clamped to +-3 sd. Used for player attributes.
    gauss(mean, sd) {
      const u = Math.max(next(), 1e-9);
      const v = next();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      return mean + sd * Math.max(-3, Math.min(3, z));
    },

    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },

    // items: array, weightOf: item => positive number
    weighted(items, weightOf) {
      let total = 0;
      for (const it of items) total += Math.max(0, weightOf(it));
      if (total <= 0) return items[Math.floor(next() * items.length)];
      let r = next() * total;
      for (const it of items) {
        r -= Math.max(0, weightOf(it));
        if (r <= 0) return it;
      }
      return items[items.length - 1];
    },
  };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
