/*
 * dice.js — dice notation and 5e roll semantics.
 *
 * Every roll returns a structured result rather than a bare number, because
 * the narrator has to be told what actually happened ("rolled 3, +4, total 7,
 * missed by 5") and the log has to be auditable after the fact. A roll that
 * only returns a total cannot be explained, and an unexplained roll is exactly
 * what makes players stop trusting an AI-run game.
 *
 * All randomness comes from an injected RNG so a session replays exactly.
 */
(function (global) {
  'use strict';

  var RNG = (global.DND && global.DND.RNG) ||
    (typeof require !== 'undefined' ? require('../rng.js').RNG : null);

  /* A default stream for callers that genuinely do not care about replay
     (previews, UI shimmer). Real game rolls must pass the session RNG. */
  var ambient = null;
  function defaultRng() {
    if (!ambient) ambient = new RNG(Date.now() ^ 0x5eed);
    return ambient;
  }

  /* --------------------------------------------------------- notation -- */

  /* Matches one term of a dice expression: an optional sign, then either
     `NdM` with optional keep/drop/reroll suffixes, or a flat number. */
  var TERM_RE = /([+-]?)\s*(?:(\d*)d(\d+)((?:(?:kh|kl|dh|dl|ro|r)\d*)*)|(\d+))/gi;
  var MOD_RE = /(kh|kl|dh|dl|ro|r)(\d*)/gi;

  /**
   * Parse dice notation into terms.
   * Supports: `2d6+3`, `1d20`, `4d6kh3` (keep highest 3), `2d20kl1`,
   * `1d8ro2` (reroll 2s once), `1d12r1` (reroll 1s until not 1), `-1d4`.
   */
  function parse(notation) {
    var text = String(notation == null ? '' : notation).replace(/\s+/g, '');
    if (!text) return { terms: [], notation: '' };
    var terms = [];
    var m;
    TERM_RE.lastIndex = 0;
    var consumed = 0;
    while ((m = TERM_RE.exec(text)) !== null) {
      if (m.index !== consumed) break;      // a gap means unparsable junk
      consumed = TERM_RE.lastIndex;
      var sign = m[1] === '-' ? -1 : 1;
      if (m[5] !== undefined) {
        terms.push({ kind: 'flat', sign: sign, value: parseInt(m[5], 10) });
      } else {
        var count = m[2] === '' ? 1 : parseInt(m[2], 10);
        var faces = parseInt(m[3], 10);
        if (!faces || count < 0 || count > 1000) throw new Error('bad dice term: ' + m[0]);
        var term = { kind: 'dice', sign: sign, count: count, faces: faces, keep: null, reroll: null };
        var mods = m[4] || '';
        var mm;
        MOD_RE.lastIndex = 0;
        while ((mm = MOD_RE.exec(mods)) !== null) {
          var n = mm[2] === '' ? null : parseInt(mm[2], 10);
          switch (mm[1].toLowerCase()) {
            case 'kh': term.keep = { mode: 'high', n: n == null ? 1 : n }; break;
            case 'kl': term.keep = { mode: 'low', n: n == null ? 1 : n }; break;
            case 'dh': term.keep = { mode: 'low', n: Math.max(0, count - (n == null ? 1 : n)) }; break;
            case 'dl': term.keep = { mode: 'high', n: Math.max(0, count - (n == null ? 1 : n)) }; break;
            case 'ro': term.reroll = { at: n == null ? 1 : n, once: true }; break;
            case 'r': term.reroll = { at: n == null ? 1 : n, once: false }; break;
          }
        }
        terms.push(term);
      }
    }
    if (consumed !== text.length) throw new Error('could not parse dice notation: ' + notation);
    return { terms: terms, notation: text };
  }

  function die(rng, faces) { return rng.int(1, faces); }

  /**
   * Roll parsed notation.
   * @returns {{total, dice:Array, flat:number, notation:string}}
   */
  function roll(notation, opts) {
    opts = opts || {};
    var rng = opts.rng || defaultRng();
    var parsed = typeof notation === 'object' && notation && notation.terms ? notation : parse(notation);
    var total = 0, flat = 0, allDice = [];

    for (var t = 0; t < parsed.terms.length; t++) {
      var term = parsed.terms[t];
      if (term.kind === 'flat') {
        total += term.sign * term.value;
        flat += term.sign * term.value;
        continue;
      }
      var rolls = [];
      for (var i = 0; i < term.count; i++) {
        var v = die(rng, term.faces);
        var rerolled = null;
        if (term.reroll) {
          if (term.reroll.once) {
            if (v <= term.reroll.at) { rerolled = v; v = die(rng, term.faces); }
          } else {
            /* Bounded: a "reroll until" on a d1-like die would spin forever. */
            var guard = 0;
            while (v <= term.reroll.at && guard++ < 100) { rerolled = v; v = die(rng, term.faces); }
          }
        }
        rolls.push({ faces: term.faces, value: v, rerolledFrom: rerolled, kept: true });
      }
      if (term.keep && term.keep.n < rolls.length) {
        var order = rolls.slice().sort(function (a, b) {
          return term.keep.mode === 'high' ? b.value - a.value : a.value - b.value;
        });
        for (var k = term.keep.n; k < order.length; k++) order[k].kept = false;
      }
      for (var j = 0; j < rolls.length; j++) {
        if (rolls[j].kept) total += term.sign * rolls[j].value;
        rolls[j].sign = term.sign;
      }
      allDice = allDice.concat(rolls);
    }
    return { total: total, dice: allDice, flat: flat, notation: parsed.notation };
  }

  /** Average result of a notation, used for monster statblock damage and for
      the "take the average" option on hit point gain. */
  function average(notation) {
    var parsed = parse(notation);
    var sum = 0;
    for (var i = 0; i < parsed.terms.length; i++) {
      var t = parsed.terms[i];
      if (t.kind === 'flat') { sum += t.sign * t.value; continue; }
      var per = (t.faces + 1) / 2;
      var n = t.keep ? Math.min(t.keep.n, t.count) : t.count;
      /* Keep-highest skews the average upward; this approximation is good
         enough for display and for statblock sanity checks, and exact when
         there is no keep clause. */
      if (t.keep && n < t.count) {
        var skew = (t.keep.mode === 'high' ? 1 : -1) * (t.faces - 1) / (2 * (t.count + 1)) * (t.count - n);
        per += skew;
      }
      sum += t.sign * n * per;
    }
    return sum;
  }

  function minOf(notation) {
    var p = parse(notation), s = 0;
    for (var i = 0; i < p.terms.length; i++) {
      var t = p.terms[i];
      s += t.kind === 'flat' ? t.sign * t.value
        : t.sign * (t.keep ? Math.min(t.keep.n, t.count) : t.count) * 1;
    }
    return s;
  }
  function maxOf(notation) {
    var p = parse(notation), s = 0;
    for (var i = 0; i < p.terms.length; i++) {
      var t = p.terms[i];
      s += t.kind === 'flat' ? t.sign * t.value
        : t.sign * (t.keep ? Math.min(t.keep.n, t.count) : t.count) * t.faces;
    }
    return s;
  }

  /* --------------------------------------------------------- d20 rolls -- */

  /**
   * Resolve advantage and disadvantage.
   *
   * 5e is explicit and frequently got wrong: these do NOT stack. Any number of
   * sources of advantage and any number of sources of disadvantage cancel each
   * other out entirely, leaving a straight roll. So sources are counted only to
   * decide presence, never magnitude.
   */
  function netAdvantage(adv, dis) {
    var a = Array.isArray(adv) ? adv.length > 0 : !!adv;
    var d = Array.isArray(dis) ? dis.length > 0 : !!dis;
    if (a && d) return 0;
    if (a) return 1;
    if (d) return -1;
    return 0;
  }

  /**
   * A d20 roll with modifiers.
   *
   * @param {object} opts
   *   rng, mod (number), advantage, disadvantage,
   *   elvenAccuracy (bool - roll three, keep highest, only with advantage),
   *   luckyReroll (bool - Halfling luck: reroll a natural 1 once),
   *   minimumRoll (number - Reliable Talent etc: treat d20 below n as n),
   *   bonusDice (notation string added after, e.g. Bless '1d4'),
   *   dc (number) — if given, the result reports success and margin.
   */
  function d20(opts) {
    opts = opts || {};
    var rng = opts.rng || defaultRng();
    var net = netAdvantage(opts.advantage, opts.disadvantage);
    var n = net > 0 && opts.elvenAccuracy ? 3 : (net === 0 ? 1 : 2);

    var raw = [];
    for (var i = 0; i < n; i++) raw.push(die(rng, 20));

    /* Halfling Lucky replaces a natural 1 on the die that would be used. It is
       applied per-die before selection, which is how the rule reads. */
    if (opts.luckyReroll) {
      for (var j = 0; j < raw.length; j++) if (raw[j] === 1) raw[j] = die(rng, 20);
    }

    var natural;
    if (net > 0) natural = Math.max.apply(null, raw);
    else if (net < 0) natural = Math.min.apply(null, raw);
    else natural = raw[0];

    /* Reliable Talent / Silver Tongue raise the die, not the total, and they
       do not turn a low roll into a critical. */
    var effective = natural;
    if (typeof opts.minimumRoll === 'number' && effective < opts.minimumRoll) {
      effective = opts.minimumRoll;
    }

    var bonus = null;
    if (opts.bonusDice) bonus = roll(opts.bonusDice, { rng: rng });

    var mod = opts.mod || 0;
    var total = effective + mod + (bonus ? bonus.total : 0);

    var out = {
      kind: 'd20',
      rolls: raw,
      natural: natural,
      effective: effective,
      mod: mod,
      bonus: bonus,
      total: total,
      advantage: net > 0,
      disadvantage: net < 0,
      /* Natural 20/1 are judged on the DIE, never on the total, and never on a
         value raised by a minimum-roll feature. */
      isNat20: natural === 20,
      isNat1: natural === 1,
    };
    if (typeof opts.dc === 'number') {
      out.dc = opts.dc;
      out.success = total >= opts.dc;
      out.margin = total - opts.dc;
    }
    return out;
  }

  /**
   * An attack roll. Critical hits and automatic misses are decided by the die,
   * not the total: a natural 20 hits regardless of AC, a natural 1 misses
   * regardless of bonus.
   *
   * `critRange` supports Champion's Improved Critical (19-20, then 18-20).
   */
  function attack(opts) {
    opts = opts || {};
    var r = d20(opts);
    var critRange = opts.critRange || 20;
    var ac = typeof opts.ac === 'number' ? opts.ac : null;
    r.kind = 'attack';
    r.ac = ac;
    r.isCrit = r.natural >= critRange;
    r.isFumble = r.natural === 1;
    if (r.isFumble) r.hit = false;
    else if (r.isCrit) r.hit = true;
    else r.hit = ac === null ? null : r.total >= ac;
    r.margin = ac === null ? null : r.total - ac;
    return r;
  }

  /**
   * A damage roll.
   *
   * On a critical hit 5e doubles the number of DICE, not the total, and flat
   * modifiers are added once. Extra dice from features (Sneak Attack, Divine
   * Smite, a flaming weapon) are also doubled; that is handled by passing them
   * as part of `notation` or in `extra`.
   */
  function damage(notation, opts) {
    opts = opts || {};
    var rng = opts.rng || defaultRng();
    var parsed = parse(notation);
    var base = roll(parsed, { rng: rng });
    var out = {
      kind: 'damage',
      type: opts.type || 'untyped',
      notation: parsed.notation,
      base: base,
      critDice: null,
      total: base.total,
    };
    if (opts.crit) {
      /* Re-roll only the dice terms; flat modifiers are not doubled. */
      var diceOnly = { terms: parsed.terms.filter(function (t) { return t.kind === 'dice'; }), notation: parsed.notation };
      if (opts.brutal) {
        /* Brutal Critical / Savage Attacks add further dice of the weapon's
           damage die; the caller supplies how many via opts.brutal. */
        var first = diceOnly.terms[0];
        if (first) {
          diceOnly = {
            terms: diceOnly.terms.concat([{ kind: 'dice', sign: first.sign, count: opts.brutal, faces: first.faces, keep: null, reroll: first.reroll }]),
            notation: parsed.notation,
          };
        }
      }
      out.critDice = roll(diceOnly, { rng: rng });
      out.total = base.total + out.critDice.total;
    }
    /* Damage is never negative; a large negative modifier reduces it to 0. */
    if (out.total < 0) out.total = 0;
    out.rolled = out.total;
    return out;
  }

  /**
   * Apply resistance, vulnerability and immunity in the order 5e requires:
   * all additions and subtractions first, then vulnerability (double), then
   * resistance (halve, rounding down). Immunity short-circuits everything.
   */
  function applyDamageModifiers(amount, opts) {
    opts = opts || {};
    var n = Math.max(0, Math.floor(amount));
    if (opts.immune) return { final: 0, applied: ['immune'], from: amount };
    var applied = [];
    if (typeof opts.flatReduction === 'number' && opts.flatReduction) {
      n = Math.max(0, n - opts.flatReduction);
      applied.push('reduced by ' + opts.flatReduction);
    }
    if (opts.vulnerable) { n = n * 2; applied.push('vulnerable'); }
    if (opts.resistant) { n = Math.floor(n / 2); applied.push('resistant'); }
    return { final: Math.max(0, n), applied: applied, from: amount };
  }

  /** Roll initiative for a list of combatants; ties broken by Dex then a roll. */
  function initiative(entries, opts) {
    opts = opts || {};
    var rng = opts.rng || defaultRng();
    var out = entries.map(function (e) {
      var r = d20({ rng: rng, mod: e.mod || 0, advantage: e.advantage, disadvantage: e.disadvantage });
      return { id: e.id, roll: r, total: r.total, dex: e.dex || 0, tiebreak: rng.next() };
    });
    out.sort(function (a, b) {
      if (b.total !== a.total) return b.total - a.total;
      if (b.dex !== a.dex) return b.dex - a.dex;
      return b.tiebreak - a.tiebreak;
    });
    return out;
  }

  /** Roll ability scores: 4d6 keep highest 3, six times. */
  function rollAbilityScores(opts) {
    opts = opts || {};
    var rng = opts.rng || defaultRng();
    var out = [];
    for (var i = 0; i < 6; i++) out.push(roll('4d6kh3', { rng: rng }).total);
    return out;
  }

  /** Render a roll for the log, so every number the game used is explainable. */
  function explain(result) {
    if (!result) return '';
    if (result.kind === 'd20' || result.kind === 'attack') {
      var dice = result.rolls.length > 1
        ? '[' + result.rolls.join(', ') + ' -> ' + result.natural + (result.advantage ? ' adv' : ' dis') + ']'
        : '[' + result.natural + ']';
      var raised = result.effective !== result.natural ? ' raised to ' + result.effective : '';
      var mod = (result.mod >= 0 ? '+' : '') + result.mod;
      var bonus = result.bonus ? ' +' + result.bonus.total + ' (' + result.bonus.notation + ')' : '';
      var tail = '';
      if (result.kind === 'attack' && result.ac !== null) {
        tail = ' vs AC ' + result.ac + ' — ' + (result.isCrit ? 'CRITICAL HIT' : result.isFumble ? 'miss (natural 1)' : (result.hit ? 'hit' : 'miss'));
      } else if (typeof result.dc === 'number') {
        tail = ' vs DC ' + result.dc + ' — ' + (result.success ? 'success' : 'failure') +
          ' by ' + Math.abs(result.margin);
      }
      return 'd20 ' + dice + raised + ' ' + mod + bonus + ' = ' + result.total + tail;
    }
    if (result.kind === 'damage') {
      var kept = result.base.dice.filter(function (d) { return d.kept; }).map(function (d) { return d.value; });
      var crit = result.critDice
        ? ' + crit [' + result.critDice.dice.map(function (d) { return d.value; }).join(', ') + ']'
        : '';
      return result.notation + ' [' + kept.join(', ') + ']' + crit +
        ' = ' + result.total + ' ' + result.type;
    }
    return String(result.total);
  }

  var api = {
    parse: parse, roll: roll, average: average, min: minOf, max: maxOf,
    d20: d20, attack: attack, damage: damage,
    netAdvantage: netAdvantage, applyDamageModifiers: applyDamageModifiers,
    initiative: initiative, rollAbilityScores: rollAbilityScores,
    explain: explain,
  };

  global.DND = global.DND || {};
  global.DND.Dice = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
