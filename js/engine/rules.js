/*
 * rules.js — pure adjudication primitives, with no state of their own.
 *
 * This is the rulebook as a set of functions: given an already-derived
 * character and some options, what does a check, a save, a contest, a death
 * save or an encounter budget come out to? Every function here takes what it
 * needs and returns a result; none of them own a turn, a combatant or a clock.
 * combat.js — built later — is the stateful loop that threads these together,
 * which is exactly why they must stay stateless: the same skillCheck() has to
 * be reachable from the combat loop, from an out-of-combat skill challenge and
 * from a test, and give the same answer every time.
 *
 * A design rule the review insisted on and this module enforces: the model
 * never supplies a raw DC. It picks a difficulty BAND; dcFor() turns the band
 * into a number. That keeps a language model from quietly inventing a DC 32
 * lock or a DC 4 dragon.
 */
(function (global) {
  'use strict';

  var Dice = (global.DND && global.DND.Dice) ||
    (typeof require !== 'undefined' ? require('./dice.js') : null);
  var Character = (global.DND && global.DND.Character) ||
    (typeof require !== 'undefined' ? require('./character.js') : null);
  var Effects = (global.DND && global.DND.Effects) ||
    (typeof require !== 'undefined' ? require('./effects.js') : null);
  var Events = (global.DND && global.DND.Events) ||
    (typeof require !== 'undefined' ? require('./events.js') : null);

  var SKILL_ABILITY = (Character && Character.SKILL_ABILITY) || {};

  /* ------------------------------------------------------------- DC bands ---- */

  var DC_BANDS = { trivial: 5, easy: 10, medium: 15, hard: 20, very_hard: 25, nearly_impossible: 30 };

  /**
   * Convert a difficulty band into a number, optionally nudged by situational
   * modifiers. Passing an unknown band falls back to medium rather than
   * throwing, because a missed classification should make a task ordinary, not
   * crash a turn.
   */
  function dcFor(band, modifiers) {
    var dc = DC_BANDS[band];
    if (dc == null) dc = DC_BANDS.medium;
    if (typeof modifiers === 'number') dc += modifiers;
    else if (Array.isArray(modifiers)) modifiers.forEach(function (m) { dc += (m || 0); });
    return dc;
  }

  /* ------------------------------------------------------- roll assembly ----- */

  /* Build the advantage/disadvantage source lists for a roll from the options
     plus exhaustion, which imposes disadvantage on different roll types at
     different ladder rungs. Returns arrays so the log can show why. */
  function advDis(derived, rollType, opts) {
    var adv = [], dis = [];
    if (opts.advantage) adv = adv.concat(Array.isArray(opts.advantage) ? opts.advantage : [opts.advantage]);
    if (opts.disadvantage) dis = dis.concat(Array.isArray(opts.disadvantage) ? opts.disadvantage : [opts.disadvantage]);
    var ex = derived.exhaustion || 0;
    if (Effects && Effects.exhaustionDisadvantage(ex, rollType)) dis.push('exhaustion');
    return { advantage: adv, disadvantage: dis };
  }

  function rollD20(flat, ad, opts) {
    return Dice.d20({
      rng: opts.rng,
      mod: flat,
      advantage: ad.advantage.length ? ad.advantage : false,
      disadvantage: ad.disadvantage.length ? ad.disadvantage : false,
      bonusDice: opts.bonusDice || null,
      dc: typeof opts.dc === 'number' ? opts.dc : undefined,
      minimumRoll: opts.minimumRoll,
      elvenAccuracy: opts.elvenAccuracy,
      luckyReroll: opts.luckyReroll,
    });
  }

  /**
   * A raw ability check: the ability modifier, proficiency only if the caller
   * says so, and any flat bonus. 2014 RAW — no natural-20 auto-success on a
   * check, which is inherited straight from dice.js.
   */
  function abilityCheck(derived, ability, opts) {
    opts = opts || {};
    var flat = derived.abilityMods[ability] + (opts.proficient ? derived.proficiencyBonus : 0) + (opts.bonus || 0);
    var ad = advDis(derived, 'ability_check', opts);
    var r = rollD20(flat, ad, opts);
    r.check = { kind: 'ability', ability: ability, flat: flat, sources: ad };
    return r;
  }

  function skillCheck(derived, skill, opts) {
    opts = opts || {};
    var s = derived.skills[skill];
    var ability = s ? s.ability : SKILL_ABILITY[skill];
    var flat = (s ? s.mod : (derived.abilityMods[ability] || 0)) + (opts.bonus || 0);
    var ad = advDis(derived, 'ability_check', opts);
    var r = rollD20(flat, ad, opts);
    r.check = { kind: 'skill', skill: skill, ability: ability, flat: flat, proficient: s && s.proficient, sources: ad };
    return r;
  }

  /**
   * A saving throw. Cover is the one situational bonus folded in here, and only
   * for Dexterity saves — crouching behind a wall does nothing for a Wisdom
   * save against a mind-flayer.
   */
  function savingThrow(derived, ability, opts) {
    opts = opts || {};
    var flat = derived.saves[ability] + (opts.bonus || 0);
    if (opts.cover && ability === 'dex') flat += coverBonus(opts.cover).dexSave;
    var ad = advDis(derived, 'save', opts);
    var r = rollD20(flat, ad, opts);
    r.check = { kind: 'save', ability: ability, flat: flat, sources: ad };
    return r;
  }

  /* ------------------------------------------------------------- contest ----- */

  function modForCheck(derived, check) {
    if (!check) return 0;
    if (check.skill) return (derived.skills[check.skill] || { mod: 0 }).mod;
    if (check.options) {
      /* The defender picks whichever of the allowed skills serves them best —
         RAW for grapple, where the target chooses Athletics or Acrobatics. */
      var best = -Infinity;
      check.options.forEach(function (sk) {
        var m = (derived.skills[sk] || { mod: 0 }).mod;
        if (m > best) best = m;
      });
      return best === -Infinity ? 0 : best;
    }
    if (check.save) return derived.saves[check.ability] || 0;
    if (check.ability) return (derived.abilityMods[check.ability] || 0) + (check.proficient ? derived.proficiencyBonus : 0);
    return 0;
  }

  /**
   * An opposed check. The initiator must BEAT the responder outright — a tie
   * means the contest fails and the status quo holds, which is the 2014 RAW for
   * grapple and shove alike.
   */
  function contest(derivedA, checkA, derivedB, checkB, opts) {
    opts = opts || {};
    var modA = modForCheck(derivedA, checkA);
    var modB = modForCheck(derivedB, checkB);
    var rollA = rollD20(modA, advDis(derivedA, 'ability_check', { advantage: opts.advantageA, disadvantage: opts.disadvantageA }), opts);
    var rollB = rollD20(modB, advDis(derivedB, 'ability_check', { advantage: opts.advantageB, disadvantage: opts.disadvantageB }), opts);
    var tie = rollA.total === rollB.total;
    return {
      success: rollA.total > rollB.total,   // strictly greater; ties favour the defender
      tie: tie,
      initiator: rollA,
      responder: rollB,
      marginBy: rollA.total - rollB.total,
    };
  }

  /**
   * Grapple: an Athletics check contested by the target's choice of Athletics or
   * Acrobatics. It is NOT an attack roll, and it spends one attack of the Attack
   * action — both facts are surfaced so the turn loop bills it correctly.
   */
  function grapple(derivedA, derivedB, opts) {
    var out = contest(derivedA, { skill: 'athletics' }, derivedB, { options: ['athletics', 'acrobatics'] }, opts);
    out.action = 'attack';
    out.consumesAttack = true;
    out.isAttackRoll = false;
    out.condition = out.success ? 'grappled' : null;
    return out;
  }

  /** Shove: same contest; on success the target is knocked prone or pushed 5ft. */
  function shove(derivedA, derivedB, opts) {
    opts = opts || {};
    var out = contest(derivedA, { skill: 'athletics' }, derivedB, { options: ['athletics', 'acrobatics'] }, opts);
    out.action = 'attack';
    out.consumesAttack = true;
    out.isAttackRoll = false;
    out.effect = out.success ? (opts.mode === 'push' ? 'pushed_5ft' : 'prone') : null;
    return out;
  }

  /* ------------------------------------------------------------- passive ----- */

  function passiveScore(derived, skill, opts) {
    opts = opts || {};
    var base = 10 + (derived.skills[skill] || { mod: 0 }).mod;
    var adv = opts.advantage ? 5 : 0;
    var dis = opts.disadvantage ? 5 : 0;
    /* Exhaustion imposes disadvantage on ability checks, which for a passive
       score is a flat -5. */
    if ((derived.exhaustion || 0) >= 1 && SKILL_ABILITY[skill]) dis = 5;
    return base + adv - dis;
  }

  /* -------------------------------------------------------------- cover ------ */

  function coverBonus(coverLevel) {
    switch (coverLevel) {
      case 'half': return { ac: 2, dexSave: 2, untargetable: false };
      case 'three-quarters':
      case 'threeQuarters': return { ac: 5, dexSave: 5, untargetable: false };
      case 'total': return { ac: 0, dexSave: 0, untargetable: true };
      default: return { ac: 0, dexSave: 0, untargetable: false };
    }
  }

  /* --------------------------------------------------------- death saves ----- */

  /**
   * A death saving throw, 2014 rules. A natural 20 brings the creature back with
   * 1 hit point; a natural 1 counts as TWO failures; 10 or better is a success;
   * below 10 a failure. Three successes stabilise, three failures kill. The
   * running totals in opts.current are folded in so the caller learns the
   * outcome, not just this roll.
   */
  function deathSave(opts) {
    opts = opts || {};
    var r = Dice.d20({ rng: opts.rng, advantage: opts.advantage, disadvantage: opts.disadvantage });
    var cur = opts.current || { successes: 0, failures: 0 };
    var successes = cur.successes || 0, failures = cur.failures || 0;
    var out = { roll: r, natural: r.natural, revive: false, successesDelta: 0, failuresDelta: 0 };

    if (r.natural === 20) {
      out.revive = true; out.hp = 1;
      successes = 0; failures = 0;                 // conscious again; slate wiped
    } else if (r.natural === 1) {
      out.failuresDelta = 2; failures += 2;
    } else if (r.total >= 10) {
      out.successesDelta = 1; successes += 1;
    } else {
      out.failuresDelta = 1; failures += 1;
    }

    successes = Math.min(3, successes);
    failures = Math.min(3, failures);
    out.successes = successes;
    out.failures = failures;
    out.stable = !out.revive && successes >= 3;
    out.dead = failures >= 3;
    out.result = out.revive ? 'revived' : out.dead ? 'dead' : out.stable ? 'stable'
      : (out.successesDelta ? 'success' : 'failure');
    return out;
  }

  /**
   * A failed death save forced by taking damage while at 0 HP: one failure
   * normally, two on a critical hit. No die is rolled.
   */
  function damageWhileDown(current, crit) {
    var cur = current || { successes: 0, failures: 0 };
    var add = crit ? 2 : 1;
    var failures = Math.min(3, (cur.failures || 0) + add);
    return {
      failuresDelta: add,
      successes: cur.successes || 0,
      failures: failures,
      dead: failures >= 3,
      result: failures >= 3 ? 'dead' : 'failure',
    };
  }

  /* ------------------------------------------------------- massive damage ---- */

  /**
   * Instant death: if the damage that drops a creature to 0 has enough left over
   * to equal or exceed its hit point maximum, it dies outright with no saving
   * throws. The overflow is measured past 0, not past current HP.
   */
  function massiveDamage(currentHp, maxHp, damage) {
    var overflow = damage - currentHp;
    var dead = overflow >= maxHp;
    return {
      dead: dead,
      overflow: overflow,
      remainingHp: Math.max(0, currentHp - damage),
      reason: dead ? 'massive damage (overflow ' + overflow + ' >= max ' + maxHp + ')' : null,
    };
  }

  /* ----------------------------------------------------- concentration ------- */

  function concentrationCheck(derived, damage, opts) {
    opts = opts || {};
    var dc = Effects ? Effects.concentrationSaveDc(damage) : Math.max(10, Math.floor(damage / 2));
    var save = savingThrow(derived, 'con', Object.assign({}, opts, { dc: dc }));
    return { dc: dc, save: save, success: save.total >= dc };
  }

  /* ------------------------------------------------------------ resting ------ */

  /**
   * Rest outcomes as EVENTS, never mutations, so a rest is committed, logged and
   * undoable like everything else. A long rest restores all HP, resets spell
   * slots, hands back half the character's Hit Dice (rounded down, minimum one)
   * and steps exhaustion down by one; a short rest optionally spends Hit Dice.
   */
  function restoreOnRest(base, progression, runtime, type, opts) {
    opts = opts || {};
    var derived = opts.derived || (Character ? Character.derive(base, progression, runtime, opts.activeEffects || []) : null);
    var actorId = opts.actorId || (runtime && runtime.actorId) || null;
    var events = [];
    var mk = function (kind, payload) { return Events ? Events.makeEvent(kind, payload) : Object.assign({ kind: kind }, payload); };
    var level = Character ? Character.characterLevel(base, progression) : (progression.levels || []).length;

    if (type === 'long') {
      if (derived) {
        var heal = derived.hpMax - (runtime.hp || 0);
        if (heal > 0) events.push(mk('hp', { targetId: actorId, delta: heal, reason: 'long rest' }));
      }
      /* Spell slots live in `slotsSpent`, and a long rest empties that pool.
         This used to emit a generic `resource` named "slot_1", which the
         applier wrote to `runtime.resources` — somewhere nothing reads — so a
         caster woke from a full night's sleep with every slot still spent. */
      if (Object.keys(runtime.slotsSpent || {}).length) {
        events.push(mk('slot_restore', { actorId: actorId, all: true, reason: 'long rest' }));
      }
      if (runtime.pactSlotsSpent) {
        events.push(mk('resource', { actorId: actorId, resource: 'pact_slot', delta: runtime.pactSlotsSpent, reason: 'long rest' }));
      }
      var regain = Math.max(1, Math.floor(level / 2));
      events.push(mk('resource', { actorId: actorId, resource: 'hit_dice', delta: regain, reason: 'long rest' }));
      if ((runtime.exhaustion || 0) > 0) {
        events.push(mk('condition_remove', { targetId: actorId, condition: 'exhaustion', levels: 1, reason: 'long rest' }));
      }
    } else {
      var spend = opts.spendHitDice || [];
      spend.forEach(function (hd) {
        events.push(mk('resource', {
          actorId: actorId, resource: 'hit_dice', delta: -1,
          /* The class matters: hit dice are tracked per class so a
             fighter/wizard cannot spend d10s they never had. */
          classId: hd.classId || null, reason: 'short rest',
        }));
        if (typeof hd.heal === 'number') events.push(mk('hp', { targetId: actorId, delta: hd.heal, reason: 'short rest hit die' }));
      });
    }
    return { events: events, type: type };
  }

  /* --------------------------------------------------- encounter budgeting --- */

  var XP_BY_CR = {
    '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
    '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900,
    '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000,
    '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000,
    '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
    '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
  };

  var XP_THRESHOLDS = {
    1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500],
    5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100],
    9: [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
    13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400], 16: [1600, 3200, 4800, 7200],
    17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500], 19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700],
  };

  var XP_BY_LEVEL = (Character && Character.XP_BY_LEVEL) ||
    [null, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
      85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

  function xpForCr(cr) {
    var key = String(cr);
    if (XP_BY_CR[key] != null) return XP_BY_CR[key];
    var n = Number(cr);
    return XP_BY_CR[String(n)] != null ? XP_BY_CR[String(n)] : 0;
  }

  function encounterMultiplier(count) {
    if (count <= 1) return 1;
    if (count === 2) return 1.5;
    if (count <= 6) return 2;
    if (count <= 10) return 2.5;
    if (count <= 14) return 3;
    return 4;
  }

  /**
   * Rate an encounter against the 2014 XP budget: sum the party's per-character
   * thresholds, total the monster XP, multiply by the count-based fudge factor
   * and report which band the adjusted total lands in.
   */
  function encounterDifficulty(partyLevels, monsterCRs) {
    var thresholds = { easy: 0, medium: 0, hard: 0, deadly: 0 };
    (partyLevels || []).forEach(function (lv) {
      var row = XP_THRESHOLDS[Math.max(1, Math.min(20, lv))];
      thresholds.easy += row[0]; thresholds.medium += row[1];
      thresholds.hard += row[2]; thresholds.deadly += row[3];
    });
    var rawXp = 0;
    (monsterCRs || []).forEach(function (cr) { rawXp += xpForCr(cr); });
    var multiplier = encounterMultiplier((monsterCRs || []).length);
    var adjusted = Math.round(rawXp * multiplier);

    var difficulty = 'trivial';
    if (adjusted >= thresholds.deadly) difficulty = 'deadly';
    else if (adjusted >= thresholds.hard) difficulty = 'hard';
    else if (adjusted >= thresholds.medium) difficulty = 'medium';
    else if (adjusted >= thresholds.easy) difficulty = 'easy';

    return {
      difficulty: difficulty,
      xp: rawXp,
      adjustedXp: adjusted,
      multiplier: multiplier,
      thresholds: thresholds,
    };
  }

  var api = {
    SKILL_ABILITY: SKILL_ABILITY,
    DC_BANDS: DC_BANDS,
    dcFor: dcFor,
    abilityCheck: abilityCheck,
    skillCheck: skillCheck,
    savingThrow: savingThrow,
    contest: contest,
    grapple: grapple,
    shove: shove,
    passiveScore: passiveScore,
    coverBonus: coverBonus,
    deathSave: deathSave,
    damageWhileDown: damageWhileDown,
    massiveDamage: massiveDamage,
    concentrationCheck: concentrationCheck,
    restoreOnRest: restoreOnRest,
    encounterDifficulty: encounterDifficulty,
    xpForCr: xpForCr,
    XP_BY_CR: XP_BY_CR,
    XP_THRESHOLDS: XP_THRESHOLDS,
    XP_BY_LEVEL: XP_BY_LEVEL,
  };

  global.DND = global.DND || {};
  global.DND.Rules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
