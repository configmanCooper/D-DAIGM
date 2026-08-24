/*
 * rng.js - seeded, serialisable random number generator.
 *
 * Every random decision in the game flows through one of these so that a whole
 * session can be replayed exactly from (seed + input log). Serialisation stores
 * the seed and the draw count; restoring replays the draws rather than trying to
 * snapshot internal state, which keeps the format stable across versions.
 */
(function (global) {
  'use strict';

  function hashString(str) {
    var h = 2166136261 >>> 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function RNG(seed) {
    if (!(this instanceof RNG)) return new RNG(seed);
    this.seed = (typeof seed === 'number') ? (seed >>> 0) : hashString(seed == null ? String(Date.now()) : seed);
    this.count = 0;
    this._next = mulberry32(this.seed);
  }

  RNG.prototype.next = function () {
    this.count++;
    return this._next();
  };

  /** float in [min, max) */
  RNG.prototype.float = function (min, max) {
    if (min == null) { min = 0; max = 1; }
    if (max == null) { max = min; min = 0; }
    return min + this.next() * (max - min);
  };

  /** integer in [min, max] inclusive */
  RNG.prototype.int = function (min, max) {
    if (max == null) { max = min; min = 0; }
    min = Math.ceil(min); max = Math.floor(max);
    if (max < min) { var t = min; min = max; max = t; }
    return min + Math.floor(this.next() * (max - min + 1));
  };

  /** true with probability p */
  RNG.prototype.chance = function (p) {
    return this.next() < p;
  };

  RNG.prototype.pick = function (arr) {
    if (!arr || !arr.length) return undefined;
    return arr[this.int(0, arr.length - 1)];
  };

  /** pick n distinct entries (or fewer if the array is short) */
  RNG.prototype.sample = function (arr, n) {
    var copy = (arr || []).slice();
    this.shuffle(copy);
    return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
  };

  /** in-place Fisher-Yates */
  RNG.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = this.int(0, i);
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  /**
   * Weighted pick.
   * Accepts either [{weight, ...}] or a parallel weights array via `weightOf`.
   */
  RNG.prototype.weighted = function (arr, weightOf) {
    if (!arr || !arr.length) return undefined;
    var get = weightOf || function (x) { return (x && x.weight) || 0; };
    var total = 0, i;
    for (i = 0; i < arr.length; i++) total += Math.max(0, get(arr[i], i));
    if (total <= 0) return this.pick(arr);
    var roll = this.next() * total;
    for (i = 0; i < arr.length; i++) {
      roll -= Math.max(0, get(arr[i], i));
      if (roll <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  };

  /** approximately normal via sum of 3 uniforms; clamped to +/-1 then scaled */
  RNG.prototype.gauss = function (mean, sd) {
    var s = (this.next() + this.next() + this.next()) / 3;
    return (mean || 0) + ((s - 0.5) * 2) * (sd == null ? 1 : sd);
  };

  /** A derived, independent stream - same parent seed + label always gives the same child. */
  RNG.prototype.fork = function (label) {
    return new RNG((this.seed ^ hashString(String(label))) >>> 0);
  };

  RNG.prototype.state = function () {
    return { seed: this.seed, count: this.count };
  };

  RNG.fromState = function (st) {
    var r = new RNG((st && typeof st.seed === 'number') ? st.seed : 0);
    var n = (st && st.count) || 0;
    for (var i = 0; i < n; i++) r.next();
    return r;
  };

  RNG.hashString = hashString;

  var api = { RNG: RNG, hashString: hashString, mulberry32: mulberry32 };
  global.DND = global.DND || {};
  global.DND.RNG = RNG;
  global.DND.hashString = hashString;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
