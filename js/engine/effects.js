/*
 * effects.js — every active effect instance, and all the stacking rules.
 *
 * This module exists because durations, save-ends conditions and concentration
 * were previously homeless: each combat feature invented its own bookkeeping,
 * and the disagreements between those private bookkeepings are the root cause
 * of most of the combat-correctness bugs the review found. There is now exactly
 * one place that answers "what is currently affecting this creature, for how
 * long, and under what stacking rule". If a rule about how two effects interact
 * is not enforced here, it is not enforced anywhere.
 *
 * Nothing in here rolls a die and — for anything the caller must persist —
 * nothing here mutates game state. tick() and the modifier collectors return
 * plain data (and event objects shaped like events.js); the caller commits them
 * through the one atomic applier in events.js. The few helpers that do touch
 * state (concentration bookkeeping) are the deliberate exceptions, because a
 * broken concentration is a safety property, not a logged game move.
 */
(function (global) {
  'use strict';

  var Dice = (global.DND && global.DND.Dice) ||
    (typeof require !== 'undefined' ? require('./dice.js') : null);
  var Events = (global.DND && global.DND.Events) ||
    (typeof require !== 'undefined' ? require('./events.js') : null);

  /* Conditions that end concentration the instant they land. Kept here rather
     than in a data file because the concentration guarantee has to hold even if
     the data files are absent or half-written. */
  var CONCENTRATION_BREAKERS = {
    incapacitated: true, unconscious: true, paralyzed: true,
    stunned: true, petrified: true, dead: true,
  };

  /* --------------------------------------------------------- store access -- */

  function effectsOf(state) {
    if (!state.effects) state.effects = [];
    return state.effects;
  }

  var idSeq = 0;
  function newEffectId(prefix) {
    idSeq++;
    return (prefix || 'eff') + '_' + idSeq.toString(36);
  }

  /**
   * Register an effect.
   *
   * Two stacking rules are enforced at the door, because letting a duplicate in
   * and hoping a later pass removes it is exactly how "why do I have Bless
   * twice" happens: a same-named effect on the same target REPLACES the old one
   * and refreshes its duration, and an effect with no id is given one.
   */
  function add(state, effect) {
    var list = effectsOf(state);
    if (!effect.id) effect.id = newEffectId(effect.name ? slug(effect.name) : 'eff');
    if (effect.name) {
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].targetId === effect.targetId && list[i].name === effect.name) {
          list.splice(i, 1);
        }
      }
    }
    list.push(effect);
    return effect;
  }

  function remove(state, effectId) {
    var list = effectsOf(state);
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].id === effectId) { list.splice(i, 1); return true; }
    }
    return false;
  }

  function forTarget(state, targetId) {
    return effectsOf(state).filter(function (e) { return e.targetId === targetId; });
  }

  function byTag(state, tag) {
    return effectsOf(state).filter(function (e) {
      return e.tags && e.tags.indexOf(tag) >= 0;
    });
  }

  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_'); }

  /* ---------------------------------------------------- roll applicability -- */

  /* A skill check is an ability check, so anything that applies to ability
     checks applies to skills too. Everything else matches by name. */
  function rollMatches(appliesTo, rollType) {
    if (appliesTo == null || appliesTo === 'all') return true;
    var types = normalizeApplies(appliesTo);
    if (types.indexOf('all') >= 0) return true;
    if (types.indexOf(rollType) >= 0) return true;
    if (rollType === 'skill' && types.indexOf('ability_check') >= 0) return true;
    /* "check" is the obvious short word and the one the data actually uses —
       Raise Dead's penalty declares `appliesTo: ['attack','save','check']`.
       Matching only the long spelling meant the check third of that penalty
       silently did not apply. */
    if ((rollType === 'ability_check' || rollType === 'skill') &&
        types.indexOf('check') >= 0) return true;
    return false;
  }

  function normalizeApplies(appliesTo) {
    if (typeof appliesTo === 'string') return [appliesTo];
    if (Array.isArray(appliesTo)) return appliesTo;
    if (appliesTo && appliesTo.rollTypes) return appliesTo.rollTypes;
    return ['all'];
  }

  /* --------------------------------------------------------- conditions ----- */

  /**
   * Appendix A, in one table.
   *
   * The conditions were tracked from the beginning and almost none of them
   * actually bit. Probed before this was written: a PARALYZED creature kept a
   * speed of 30 and was offered movement; a petrified one failed a DC 10
   * Dexterity save six times in twenty instead of twenty; poisoned and
   * frightened imposed no disadvantage on ability checks at all, because
   * `advDis` looked at exhaustion and nothing else.
   *
   * Everything that needs to know what a condition does asks here, so the rules
   * live in one place and cannot drift between the character sheet, the combat
   * loop and the movement resolver — which is exactly how they drifted before.
   *
   * Only the mechanical consequences are modelled. "Can see", "can speak" and
   * "drops what it is holding" are narrative for this engine and are left to
   * the Dungeon Master rather than faked.
   */
  var CONDITIONS = {
    blinded: { attackDisadvantage: true, attackedWithAdvantage: true, autoFailSight: true },
    charmed: { cannotTargetCharmer: true, charmerSocialAdvantage: true },
    deafened: { autoFailHearing: true },
    /* The fifteenth. Exhaustion is a six-rung ladder rather than an on/off
       condition, so its mechanics live in `exhaustionEffects` below and it
       carries no flags here — but it belongs in the table, because a reader
       checking whether Appendix A is complete should find it rather than
       conclude it was forgotten. `conditionList` skips it for that reason: on
       the runtime it is a number, not a boolean. */
    exhaustion: { ladder: 'exhaustionEffects' },
    frightened: {
      attackDisadvantage: true, checkDisadvantage: true, cannotApproachSource: true,
    },
    grappled: { speedZero: true },
    incapacitated: { noAction: true, noBonus: true, noReaction: true },
    invisible: { attackAdvantage: true, attackedWithDisadvantage: true },
    paralyzed: {
      noAction: true, noBonus: true, noReaction: true, speedZero: true,
      autoFailStrDexSaves: true, attackedWithAdvantage: true, critWithin5: true,
    },
    petrified: {
      noAction: true, noBonus: true, noReaction: true, speedZero: true,
      autoFailStrDexSaves: true, attackedWithAdvantage: true,
      resistsAllDamage: true, poisonImmune: true,
    },
    poisoned: { attackDisadvantage: true, checkDisadvantage: true },
    prone: { attackDisadvantage: true },
    restrained: {
      speedZero: true, attackDisadvantage: true, attackedWithAdvantage: true,
      dexSaveDisadvantage: true,
    },
    stunned: {
      noAction: true, noBonus: true, noReaction: true, speedZero: true,
      autoFailStrDexSaves: true, attackedWithAdvantage: true,
    },
    unconscious: {
      noAction: true, noBonus: true, noReaction: true, speedZero: true,
      autoFailStrDexSaves: true, attackedWithAdvantage: true, critWithin5: true,
      prone: true,
    },
  };

  /* The conditions currently on a creature, as a plain list of names. Accepts
     either the runtime map ({prone: true}) or an array. */
  function conditionList(conditions) {
    if (!conditions) return [];
    if (Array.isArray(conditions)) return conditions.filter(Boolean).map(String);
    return Object.keys(conditions).filter(function (k) {
      return conditions[k] && k !== 'exhaustion';
    });
  }

  /* Does any condition on this creature set the given flag? */
  function conditionFlag(conditions, flag) {
    return conditionList(conditions).some(function (name) {
      var c = CONDITIONS[name];
      return !!(c && c[flag]);
    });
  }

  /* Which conditions set it — for the log, which should say WHY a roll went
     the way it did rather than only that it did. */
  function conditionsWith(conditions, flag) {
    return conditionList(conditions).filter(function (name) {
      var c = CONDITIONS[name];
      return !!(c && c[flag]);
    });
  }

  /**
   * Is this saving throw automatically failed?
   *
   * Paralyzed, petrified, stunned and unconscious all auto-fail Strength and
   * Dexterity saves — which is the rule that makes being held genuinely
   * dangerous rather than merely inconvenient.
   */
  function autoFailsSave(conditions, ability) {
    if (ability !== 'str' && ability !== 'dex') return null;
    var by = conditionsWith(conditions, 'autoFailStrDexSaves');
    return by.length ? by[0] : null;
  }

  /* Speed drops to nothing while grappled, restrained, or held by any of the
     four conditions that include incapacitation. */
  function speedIsZero(conditions) {
    return conditionFlag(conditions, 'speedZero');
  }

  /* --------------------------------------------------------- exhaustion ----- */

  /* The 2014 six-level ladder, cumulative. Each level below is exactly one rung
     of the SRD table; higher levels inherit every lower rung. Anything that
     needs to know what exhaustion does asks here, so the ladder lives in one
     place and cannot drift between the character sheet and the combat loop. */
  function exhaustionEffects(level) {
    level = Math.max(0, Math.min(6, level || 0));
    return {
      level: level,
      checkDisadvantage: level >= 1,          // 1: disadvantage on ability checks
      speedHalved: level >= 2 && level < 5,   // 2: speed halved (until 5 zeroes it)
      attackDisadvantage: level >= 3,         // 3: disadvantage on attacks
      saveDisadvantage: level >= 3,           // 3: disadvantage on saving throws
      hpMaxHalved: level >= 4,                // 4: hit point maximum halved
      speedZero: level >= 5,                  // 5: speed 0
      dead: level >= 6,                        // 6: death
    };
  }

  /* Which roll types exhaustion imposes disadvantage on, at a given level. */
  function exhaustionDisadvantage(level, rollType) {
    var ex = exhaustionEffects(level);
    if ((rollType === 'ability_check' || rollType === 'skill') && ex.checkDisadvantage) return true;
    if (rollType === 'attack' && ex.attackDisadvantage) return true;
    if (rollType === 'save' && ex.saveDisadvantage) return true;
    return false;
  }

  /* ----------------------------------------------- advantage / disadvantage -- */

  /**
   * The net advantage state for a roll.
   *
   * 5e is emphatic and frequently got wrong: advantage and disadvantage do not
   * stack. Any number of each is still just "present", and one of each cancels
   * to a straight roll. So this collects SOURCES for the log — never a running
   * count that could be mistaken for magnitude — and hands the presence test to
   * the same dice.js resolver every other roll uses.
   */
  function advantageState(state, actorId, rollType, ctx) {
    ctx = ctx || {};
    var adv = [], dis = [];

    forTarget(state, actorId).forEach(function (e) {
      if (!rollMatches(e.appliesTo, rollType)) return;
      if (e.kind === 'advantage') adv.push(e.name || e.id);
      else if (e.kind === 'disadvantage') dis.push(e.name || e.id);
    });

    var exhaustion = ctx.exhaustion != null ? ctx.exhaustion : exhaustionOf(state, actorId);
    if (exhaustionDisadvantage(exhaustion, rollType)) dis.push('exhaustion');

    if (ctx.advantage) adv = adv.concat(asList(ctx.advantage));
    if (ctx.disadvantage) dis = dis.concat(asList(ctx.disadvantage));

    var net = Dice ? Dice.netAdvantage(adv, dis) : (adv.length && dis.length ? 0 : adv.length ? 1 : dis.length ? -1 : 0);
    return {
      advantage: net > 0,
      disadvantage: net < 0,
      net: net,
      sources: { adv: adv, dis: dis },
    };
  }

  function asList(x) { return Array.isArray(x) ? x : [x]; }

  function exhaustionOf(state, actorId) {
    var a = state.actors && state.actors[actorId];
    return (a && a.runtime && a.runtime.exhaustion) || 0;
  }

  /**
   * Numeric and dice modifiers that apply to a roll: Bless (+1d4), Bane (-1d4),
   * Guidance (+1d4 on ability checks), cover (Dex saves), a flat bonus from an
   * item, and exhaustion (surfaced as disadvantage rather than a number).
   *
   * Returns the pieces a caller feeds straight into dice.d20 — a flat total, a
   * list of bonus-dice notations, and the advantage/disadvantage source lists —
   * so the collection lives here and the roll stays dumb.
   */
  function modifiersFor(state, actorId, rollType, ctx) {
    ctx = ctx || {};
    var out = { flat: 0, dice: [], penaltyDice: [], advantage: [], disadvantage: [] };

    forTarget(state, actorId).forEach(function (e) {
      if (!rollMatches(e.appliesTo, rollType)) return;
      switch (e.kind) {
        case 'advantage': out.advantage.push(e.name || e.id); break;
        case 'disadvantage': out.disadvantage.push(e.name || e.id); break;
        case 'bonus_dice': if (e.dice) out.dice.push(e.dice); break;
        /* Bane and its kin subtract a die. Without this the sign was
           dropped and every penalty spell became a bonus. */
        case 'penalty_dice': if (e.dice) out.penaltyDice.push(e.dice); break;
        case 'flat': if (typeof e.magnitude === 'number') out.flat += e.magnitude; break;
        /* A flat penalty that wears off — Raise Dead's -4 to attacks, saves
           and ability checks, reduced by 1 on each long rest. `mortality.raise`
           has created this effect from the beginning and `modifiersFor` had no
           case for it, so a character returned from the dead came back with no
           penalty at all: the entire cost of resurrection was a line of prose.
           Written as its own kind rather than folded into `flat` so the log can
           name it, and the magnitude is used as given (it is already negative)
           rather than negated again. */
        case 'roll_penalty':
          if (typeof e.magnitude === 'number') {
            out.flat += e.magnitude > 0 ? -e.magnitude : e.magnitude;
          }
          break;
        default: break;
      }
    });

    /* Cover helps a target's own Dexterity saving throws (and AC), and nothing
       else — a Wisdom save gets no benefit from crouching behind a wall. */
    if (ctx.cover && rollType === 'save' && ctx.saveAbility === 'dex') {
      out.flat += coverDexBonus(ctx.cover);
    }

    var exhaustion = ctx.exhaustion != null ? ctx.exhaustion : exhaustionOf(state, actorId);
    if (exhaustionDisadvantage(exhaustion, rollType)) out.disadvantage.push('exhaustion');

    if (ctx.advantage) out.advantage = out.advantage.concat(asList(ctx.advantage));
    if (ctx.disadvantage) out.disadvantage = out.disadvantage.concat(asList(ctx.disadvantage));

    return out;
  }

  function coverDexBonus(cover) {
    if (cover === 'half') return 2;
    if (cover === 'three-quarters' || cover === 'threeQuarters') return 5;
    return 0;
  }

  /* --------------------------------------------------------- temporary HP ---- */

  /**
   * Temporary hit points never stack: you keep the larger pool, you never add.
   * Re-exposed here (events.js also enforces it on commit) so callers can reason
   * about the merge before building an event.
   */
  function mergeTempHp(current, incoming) {
    return Math.max(current || 0, incoming || 0);
  }

  /**
   * Apply damage against a temp-HP buffer, 5e order: temp HP absorbs first and
   * is spent down before real hit points are touched. Pure — returns the new
   * pools rather than writing them.
   */
  function applyDamageWithTemp(tempHp, hp, damage) {
    var t = Math.max(0, tempHp || 0);
    var d = Math.max(0, damage || 0);
    var fromTemp = Math.min(t, d);
    var remaining = d - fromTemp;
    return {
      tempHp: t - fromTemp,
      hp: Math.max(0, (hp || 0) - remaining),
      absorbed: fromTemp,
      toHp: remaining,
    };
  }

  /* -------------------------------------------------------- concentration ---- */

  /**
   * The Con save DC to keep concentration after taking damage: half the damage,
   * rounded down, but never below 10.
   */
  function concentrationSaveDc(damage) {
    return Math.max(10, Math.floor((damage || 0) / 2));
  }

  /**
   * Begin concentrating. One concentration at a time is the whole rule, so this
   * first ends any prior concentration for the actor — dropping every effect
   * that prior concentration was holding up — and then records the new one.
   *
   * This is one of the deliberate state-touching helpers: a stale second
   * concentration is a correctness hazard, not a game move to be logged, so it
   * is fixed immediately rather than routed through an event.
   */
  function startConcentration(state, actorId, effectId, spellId) {
    breakConcentration(state, actorId, 'recast');
    var a = state.actors && state.actors[actorId];
    if (a && a.runtime) {
      a.runtime.concentratingOn = { effectId: effectId, spellId: spellId || null, since: state.round || 0 };
    }
    /* Tag the sustaining effect so breaking concentration can find it. */
    var eff = findEffect(state, effectId);
    if (eff) eff.concentrationId = actorId;
    return a && a.runtime ? a.runtime.concentratingOn : null;
  }

  function findEffect(state, effectId) {
    return effectsOf(state).filter(function (e) { return e.id === effectId; })[0] || null;
  }

  /**
   * End an actor's concentration and remove every effect it was sustaining.
   * Called on a failed save, on recast, and whenever an incapacitating
   * condition lands.
   */
  function breakConcentration(state, actorId, reason) {
    var list = effectsOf(state);
    var dropped = [];
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].concentrationId === actorId) {
        dropped.push(list[i].id);
        list.splice(i, 1);
      }
    }
    var a = state.actors && state.actors[actorId];
    if (a && a.runtime) a.runtime.concentratingOn = null;
    return { actorId: actorId, reason: reason || 'ended', dropped: dropped };
  }

  function isConcentrating(state, actorId) {
    var a = state.actors && state.actors[actorId];
    return !!(a && a.runtime && a.runtime.concentratingOn);
  }

  /**
   * When a condition is applied to an actor, some conditions end concentration
   * outright. Returns the break record if it fired, otherwise null.
   */
  function onConditionApplied(state, actorId, condition) {
    if (CONCENTRATION_BREAKERS[condition] && isConcentrating(state, actorId)) {
      return breakConcentration(state, actorId, condition);
    }
    return null;
  }

  /* ------------------------------------------------------------- duration ---- */

  /* How many rounds a duration is worth, for the round-based countdown. */
  function durationRounds(duration) {
    if (!duration) return null;
    switch (duration.type) {
      case 'rounds': return duration.value;
      case 'minutes': return duration.value * 10;
      case 'hours': return duration.value * 600;
      default: return null;   // until_rest / permanent / concentration: not round-counted
    }
  }

  /**
   * Advance durations for one moment in the turn cycle and report what happened.
   *
   * PURE with respect to game state: it returns a fresh effects array with the
   * decremented remainders, the effect_remove events for anything that expired,
   * and the list of save-ends effects that owe a saving throw at this exact
   * moment — the caller rolls those and commits the outcome. Nothing here writes
   * to `state`.
   *
   *   when: 'start_of_turn' | 'end_of_turn'
   */
  function tick(state, when, actorId) {
    var events = [];
    var saves = [];
    var next = [];

    effectsOf(state).forEach(function (e) {
      /* Only the acting creature's own effects tick on its turn. */
      if (e.targetId !== actorId) { next.push(e); return; }

      if (e.saveEnds && e.saveEnds.when === when) {
        saves.push(e);
      }

      var rounds = durationRounds(e.duration);
      var ticksNow = e.duration && (e.duration.tickAt || 'end_of_turn') === when && rounds != null;
      if (!ticksNow) { next.push(e); return; }

      var remaining = (typeof e.duration.remaining === 'number' ? e.duration.remaining : rounds) - 1;
      if (remaining <= 0) {
        events.push(makeEvent('effect_remove', { effectId: e.id, reason: 'expired' }));
      } else {
        var copy = shallowCopy(e);
        copy.duration = shallowCopy(e.duration);
        copy.duration.remaining = remaining;
        next.push(copy);
      }
    });

    return { events: events, saves: saves, effects: next };
  }

  function makeEvent(kind, payload) {
    if (Events && Events.makeEvent) return Events.makeEvent(kind, payload);
    return Object.assign({ kind: kind }, payload || {});
  }

  function shallowCopy(o) {
    var out = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out[k] = o[k];
    return out;
  }

  var api = {
    CONCENTRATION_BREAKERS: CONCENTRATION_BREAKERS,
    add: add, remove: remove, forTarget: forTarget, byTag: byTag,
    newEffectId: newEffectId,
    rollMatches: rollMatches,
    exhaustionEffects: exhaustionEffects, exhaustionDisadvantage: exhaustionDisadvantage,
    CONDITIONS: CONDITIONS,
    conditionList: conditionList, conditionFlag: conditionFlag,
    conditionsWith: conditionsWith,
    autoFailsSave: autoFailsSave, speedIsZero: speedIsZero,
    advantageState: advantageState, modifiersFor: modifiersFor,
    coverDexBonus: coverDexBonus,
    mergeTempHp: mergeTempHp, applyDamageWithTemp: applyDamageWithTemp,
    concentrationSaveDc: concentrationSaveDc,
    startConcentration: startConcentration, breakConcentration: breakConcentration,
    isConcentrating: isConcentrating, onConditionApplied: onConditionApplied,
    durationRounds: durationRounds, tick: tick,
  };

  global.DND = global.DND || {};
  global.DND.Effects = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
