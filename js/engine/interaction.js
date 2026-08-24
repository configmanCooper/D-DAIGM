/*
 * interaction.js — the half of D&D that is not a fight.
 *
 * Combat has an engine; exploration, conversation, items and spellcasting did
 * not, and a playtest of an investigation scene found the party with nothing
 * legal to do but Dodge. Most of a campaign happens here: asking a frightened
 * villager what she saw, searching a lantern housing, deciding whether to
 * hand over a relic.
 *
 * The same contract as combat. Resolvers are pure, roll from `state.rng`, and
 * return events; `legalMoves` is the single list the UI buttons, the AI seats
 * and the referee's enums are all built from.
 *
 * The engine picks every difficulty. A referee may *suggest* a band, and that
 * suggestion is clamped here to within one step of what the engine thinks —
 * a model is good at "this feels hard" and bad at knowing that hard is 20.
 */
(function (global) {
  'use strict';

  function req(p) { return typeof require !== 'undefined' ? require(p) : null; }
  var Dice = (global.DND && global.DND.Dice) || req('./dice.js');
  var Events = (global.DND && global.DND.Events) || req('./events.js');
  var Rules = (global.DND && global.DND.Rules) || req('./rules.js');
  var Command = (global.DND && global.DND.Command) || req('./command.js');
  var Dispatch = (global.DND && global.DND.Dispatch) || req('./dispatch.js');
  var Character = (global.DND && global.DND.Character) || req('./character.js');
  var Knowledge = (global.DND && global.DND.Knowledge) || req('./knowledge.js');

  var BANDS = ['trivial', 'easy', 'medium', 'hard', 'very_hard', 'nearly_impossible'];

  function actor(state, id) { return (state.actors && state.actors[id]) || null; }

  /* At zero hit points you are unconscious: no talking, no searching, no
     rummaging. The combat engine rolls your death saves. */
  function downed(a) {
    return !a || !a.runtime || a.runtime.dead || a.runtime.hp <= 0;
  }

  /**
   * Can this actor perceive that one?
   *
   * Move lists are shown to players and handed to AI seats, so every name in
   * one has been disclosed. Naming a creature nobody has noticed yet gives the
   * secret away through the interface rather than through the story, which is
   * the one thing the perception layer exists to prevent.
   */
  function perceives(state, observerId, targetId) {
    var K = (global.DND && global.DND.Knowledge) ||
      (typeof require !== 'undefined' ? require('./knowledge.js') : null);
    if (!K || !K.canPerceive) return true;
    return K.canPerceive(state, observerId, targetId);
  }

  /**
   * The spell table, however this file is running.
   *
   * `ctx.spells` was the only source, and nothing was passing it — so a cleric
   * with Cure Wounds prepared was offered "Cast cure-wounds" with no target and
   * no effect, and stood over a dying paladin poking a monster for 2 damage
   * instead. Loading the data here is what makes healing actually reachable.
   */
  var spellCache;
  function spellData(ctx) {
    if (ctx && ctx.spells) return ctx.spells;
    if (spellCache !== undefined) return spellCache;
    var g = global.DND && global.DND.Data && global.DND.Data.SPELLS;
    if (g) { spellCache = g; return spellCache; }
    if (typeof require !== 'undefined') {
      try { spellCache = require('../data/srd_spells.js').SPELLS; } catch (e) { spellCache = null; }
    } else { spellCache = null; }
    return spellCache;
  }

  /** Does this spell put hit points back, or hand out temporary ones? */
  function isHealing(spell) {
    if (!spell || !spell.mech) return false;
    return (spell.mech.effects || []).some(function (e) {
      return e.kind === 'heal' || e.kind === 'temp_hp';
    });
  }

  function derivedOf(state, id) {
    var a = actor(state, id);
    if (!a) return null;
    if (a.derivedCache) return a.derivedCache;
    if (!Character || !Character.derive) return null;
    try {
      return Character.derive(a.base, a.progression, a.runtime,
        (state.effects || []).filter(function (e) { return e.targetId === id; }));
    } catch (e) { return null; }
  }

  /**
   * Turn a difficulty band into a number, honouring a referee's suggestion
   * only so far.
   *
   * The clamp is the point. Left unclamped, a model asked how hard something
   * felt would reach for "nearly impossible" whenever the prose was tense,
   * and a scene's mood would start setting DCs.
   */
  function difficultyFor(baseBand, suggestion) {
    var base = BANDS.indexOf(baseBand);
    if (base < 0) base = 2;
    var band = base;
    if (suggestion && suggestion.difficulty) {
      var want = BANDS.indexOf(suggestion.difficulty);
      if (want >= 0) band = Math.max(base - 1, Math.min(base + 1, want));
    }
    return { band: BANDS[band], dc: Rules.dcFor(BANDS[band]) };
  }

  /** Roll a skill check and record it so the log can explain the number. */
  function check(state, batch, actorId, skill, band, suggestion, why) {
    var d = derivedOf(state, actorId);
    var a = actor(state, actorId);
    var diff = difficultyFor(band, suggestion);
    var result = Rules.skillCheck(d, skill, { rng: state.rng, dc: diff.dc });
    Events.push(batch, 'roll', {
      rollKind: 'check', actorId: actorId, skill: skill,
      dc: diff.dc, band: diff.band,
      total: result.total, natural: result.natural, success: result.success,
      explain: Dice.explain(result),
    }, (a ? a.name : actorId) + ' rolls ' + skill + ': ' + Dice.explain(result) +
      (why ? ' (' + why + ')' : ''));
    return result;
  }

  /* ==================================================== exploration ========= */

  /* What a given exploration verb actually tests, and how hard it is before
     the scene adjusts it. */
  var EXPLORE = {
    search: { skill: 'investigation', band: 'medium', verbing: 'searching' },
    investigate: { skill: 'investigation', band: 'medium', verbing: 'examining' },
    perceive: { skill: 'perception', band: 'medium', verbing: 'watching' },
    unlock: { skill: 'sleight_of_hand', band: 'hard', verbing: 'picking the lock' },
    disarm_trap: { skill: 'sleight_of_hand', band: 'hard', verbing: 'disarming it' },
    track: { skill: 'survival', band: 'medium', verbing: 'tracking' },
    forage: { skill: 'survival', band: 'easy', verbing: 'foraging' },
    read: { skill: 'investigation', band: 'easy', verbing: 'reading' },
    interact: { skill: null, band: 'trivial', verbing: 'handling it' },
  };

  function resolveExploration(state, command, ctx) {
    ctx = ctx || {};
    var b = Events.makeBatch(command);
    var a = actor(state, command.actorId);
    if (!a) return Events.refuse(b, 'no-actor', 'nobody is there to do that');
    if (a.runtime && a.runtime.dead) return Events.refuse(b, 'dead', a.name + ' is dead');

    var verb = command.primary.verb;

    if (verb === 'short_rest' || verb === 'long_rest') {
      return resolveRest(state, command, b, verb);
    }

    if (verb === 'travel') {
      var dest = command.primary.note || (command.primary.targetIds || [])[0] || '';
      if (!dest) return Events.refuse(b, 'no-destination', 'there is nowhere named to travel to');
      Events.push(b, 'position', { locationId: dest, discovered: true },
        a.name + ' travels to ' + dest + '.');
      Events.push(b, 'time', { minutes: ctx.travelMinutes || 120 }, 'The journey takes a while.');
      return b;
    }

    var spec = EXPLORE[verb];
    if (!spec) return Events.refuse(b, 'unknown-verb', 'exploration does not handle ' + verb);

    if (!spec.skill) {
      Events.push(b, 'note', { text: verb, actorId: command.actorId },
        a.name + ' ' + spec.verbing + '.');
      return b;
    }

    var focus = command.primary.note || command.primary.suggestion && command.primary.suggestion.focus || '';
    var band = (ctx.difficulty && ctx.difficulty[verb]) || spec.band;
    var result = check(state, b, command.actorId, spec.skill, band,
      command.primary.suggestion, focus || undefined);

    if (result.success) {
      /* A successful search is only meaningful if the scene has something to
         find. The engine decides what, from the scene's own contents — never
         the narrator, which would otherwise invent treasure. */
      var findings = (ctx.findings && ctx.findings[verb]) || [];
      if (findings.length) {
        findings.forEach(function (f) {
          if (f.factId && Knowledge) {
            b.events.push(Knowledge.learnEvent(command.actorId, f.factId, f.stage || 'full',
              (a.name + ' ' + spec.verbing)));
            b.beats.push(a.name + ' works something out.');
          }
          if (f.item) {
            Events.push(b, 'item_gain', { actorId: command.actorId, item: f.item },
              a.name + ' finds ' + (f.item.name || f.item.id) + '.');
          }
          if (f.flag) Events.push(b, 'flag', { flag: f.flag, value: true }, '');
        });
      } else {
        Events.push(b, 'note', { text: 'nothing-here', actorId: command.actorId },
          'There is nothing more here to find.');
      }
    } else {
      Events.push(b, 'note', { text: 'failed-' + verb, actorId: command.actorId },
        a.name + ' finds nothing.');
    }
    return b;
  }

  function resolveRest(state, command, b, verb) {
    var a = actor(state, command.actorId);
    if (state.combat && state.combat.active) {
      return Events.refuse(b, 'in-combat', 'there is no resting in the middle of a fight');
    }
    var isLong = verb === 'long_rest';
    var d = derivedOf(state, command.actorId);

    /* The whole party rests, not just whoever said so. A short rest where only
       the speaker got their breath back made resting nearly pointless and led
       AI seats to call for one over and over. */
    var resting = restingParty(state, command.actorId);

    resting.forEach(function (id) {
      var who = actor(state, id);
      if (!who || who.runtime.dead) return;
      var derived = derivedOf(state, id);
      var restore = Rules.restoreOnRest
        ? Rules.restoreOnRest(who.base, who.progression, who.runtime, isLong ? 'long' : 'short', {
          /* Without actorId every event was addressed to `null` and applied to
             nobody: rests appeared to work and healed no one. */
          actorId: id,
          derived: derived,
          spendHitDice: isLong ? [] : hitDiceToSpend(state, who, derived),
        })
        : null;
      /* restoreOnRest returns {events, type}, not an array. Calling .forEach on
         the wrapper threw, so BOTH rest verbs failed at dispatch and nobody in
         the game could ever rest. Accept either shape rather than depend on
         which one a future refactor settles on. */
      var events = !restore ? []
        : (Array.isArray(restore) ? restore : (restore.events || []));
      events.forEach(function (e) { b.events.push(e); });
    });

    Events.push(b, 'time', { minutes: isLong ? 480 : 60 }, '');
    b.beats.push(isLong
      ? 'The party takes a long rest. Wounds close, spells return.'
      : 'The party catches its breath for an hour.');
    return b;
  }

  /* Everyone who is resting together: the party, minus the dead. */
  function restingParty(state, actorId) {
    var self = actor(state, actorId);
    if (!self) return [];
    return Object.keys(state.actors).filter(function (id) {
      var o = state.actors[id];
      return o.side === self.side && o.runtime && !o.runtime.dead;
    });
  }

  /**
   * Which hit dice to spend on a short rest.
   *
   * The rules make this a player choice, and a menu asking "spend how many d10s?"
   * every hour of game time is worse than the decision is interesting. So the
   * engine spends what it takes to get back to roughly three-quarters health
   * and no more, which is what a cautious party does — dice are the resource
   * that makes the next fight survivable, and burning all of them on a scratch
   * is the mistake this avoids.
   */
  function hitDiceToSpend(state, who, derived) {
    var rt = who.runtime;
    var hpMax = (derived && derived.hpMax) || rt.hpMax || 0;
    var missing = hpMax - (rt.hp || 0);
    if (missing <= 0) return [];
    var target = Math.max(0, Math.ceil(hpMax * 0.75) - (rt.hp || 0));
    if (target <= 0) return [];

    var conMod = (derived && derived.abilityMods && derived.abilityMods.con) || 0;
    var out = [];
    var healed = 0;
    (who.base.classes || []).forEach(function (c) {
      var die = hitDieFor(c.classId);
      var levels = c.levels || 0;
      var spent = (rt.hitDiceSpent && rt.hitDiceSpent[c.classId]) || 0;
      var left = Math.max(0, levels - spent);
      for (var i = 0; i < left && healed < target; i++) {
        var roll = Dice.roll('1d' + die, { rng: state.rng });
        var gain = Math.max(1, roll.total + conMod);
        out.push({ classId: c.classId, die: die, heal: gain });
        healed += gain;
      }
    });
    return out;
  }

  var HIT_DICE = {
    barbarian: 12, fighter: 10, paladin: 10, ranger: 10,
    bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
    sorcerer: 6, wizard: 6,
  };
  function hitDieFor(classId) { return HIT_DICE[classId] || 8; }

  resolveExploration.legalMoves = function (state, actorId, ctx) {
    var a = actor(state, actorId);
    if (!a || downed(a)) return [];
    var inCombat = !!(state.combat && state.combat.active);
    var moves = [
      mv('search', 'Search the area', 'action'),
      mv('perceive', 'Look and listen', 'action'),
    ];
    if (!inCombat) {
      moves.push(mv('investigate', 'Examine something closely', 'time'));
      moves.push(mv('short_rest', 'Take a short rest', 'an hour'));
      moves.push(mv('long_rest', 'Take a long rest', 'eight hours'));
      ((ctx && ctx.exits) || []).forEach(function (exit) {
        moves.push(mv('travel', 'Travel to ' + (exit.name || exit.id), 'hours', { note: exit.id }));
      });
    }
    return moves;
  };

  /* ======================================================== social ========== */

  var SOCIAL = {
    persuade: { skill: 'persuasion', band: 'medium' },
    deceive: { skill: 'deception', band: 'medium' },
    intimidate: { skill: 'intimidation', band: 'medium' },
    perform: { skill: 'performance', band: 'medium' },
    insight: { skill: 'insight', band: 'medium' },
    ask: { skill: null, band: 'trivial' },
    tell: { skill: null, band: 'trivial' },
    offer: { skill: 'persuasion', band: 'easy' },
    refuse: { skill: null, band: 'trivial' },
  };

  /**
   * How a conversation lands.
   *
   * Disposition shifts the difficulty, which is the whole reason relationships
   * are tracked: an NPC who trusts you is easier to convince, and one you have
   * threatened before is harder. Approach matters too — a threat that works on
   * a bandit hardens a priest.
   */
  function socialModifier(state, actorId, targetId, social) {
    var rel = (state.relationships || {})[actorId + '->' + targetId] ||
      (state.relationships || {})[targetId + '->' + actorId];
    var affinity = rel ? rel.affinity : 0;
    var fear = rel ? rel.fear : 0;
    var mod = 0;
    mod += Math.round(affinity / 25);            // +/- 4 at the extremes
    if (social && social.approach === 'threatening') mod += Math.round(fear / 30);
    return mod;
  }

  function resolveSocial(state, command, ctx) {
    ctx = ctx || {};
    var b = Events.makeBatch(command);
    var a = actor(state, command.actorId);
    if (!a) return Events.refuse(b, 'no-actor', 'nobody is there to speak');
    var verb = command.primary.verb;
    var spec = SOCIAL[verb];
    if (!spec) return Events.refuse(b, 'unknown-verb', 'social does not handle ' + verb);

    var targetId = (command.primary.targetIds || [])[0];
    var target = targetId ? actor(state, targetId) : null;
    if (spec.skill && !target) {
      return Events.refuse(b, 'no-target', 'there is nobody there to say that to');
    }
    if (target && target.runtime && target.runtime.dead) {
      return Events.refuse(b, 'dead-target', target.name + ' is beyond talking to');
    }

    var social = command.primary.social || {};

    /* Simply speaking is not a check. Most conversation is not a contest, and
       making a player roll to say hello is how a game stops feeling like one. */
    if (!spec.skill) {
      Events.push(b, 'note', { text: verb, actorId: command.actorId, targetId: targetId },
        a.name + (verb === 'ask' ? ' asks ' : ' speaks to ') +
        (target ? target.name : 'the room') +
        (social.proposition ? ': ' + trim(social.proposition, 120) : '.'));
      return b;
    }

    var mod = socialModifier(state, command.actorId, targetId, social);
    var band = (ctx.difficulty && ctx.difficulty[verb]) || spec.band;
    /* A hostile disposition makes a hard ask harder, a friendly one easier. */
    var idx = BANDS.indexOf(band) - Math.max(-1, Math.min(1, mod > 2 ? 1 : mod < -2 ? -1 : 0));
    band = BANDS[Math.max(0, Math.min(BANDS.length - 1, idx))];

    var result = check(state, b, command.actorId, spec.skill, band, command.primary.suggestion,
      trim(social.proposition, 60));

    if (targetId) {
      /* Every attempt moves the relationship, successful or not. A failed
         intimidation is not neutral — it is remembered. */
      var delta = { affinity: 0, trust: 0, fear: 0, respect: 0 };
      if (verb === 'intimidate') {
        delta.fear += result.success ? 8 : 3;
        delta.affinity -= result.success ? 4 : 7;
      } else if (verb === 'deceive') {
        if (result.success) { delta.trust += 2; }
        else { delta.trust -= 12; delta.affinity -= 8; }
      } else if (verb === 'persuade' || verb === 'offer') {
        delta.affinity += result.success ? 5 : -1;
        delta.respect += result.success ? 3 : 0;
      } else if (verb === 'insight') {
        delta.affinity += 0;
      }
      if (social.truthfulness === 'false' && !result.success) delta.trust -= 5;

      if (delta.affinity || delta.trust || delta.fear || delta.respect) {
        Events.push(b, 'relationship', {
          fromId: targetId, toId: command.actorId,
          affinity: delta.affinity, trust: delta.trust, fear: delta.fear, respect: delta.respect,
          because: (result.success ? 'succeeded at ' : 'failed at ') + verb +
            (social.proposition ? ': ' + trim(social.proposition, 80) : ''),
        }, '');
      }
    }

    /* Information is the usual prize, and it is granted by the engine from the
       scene's own gated facts — never by the narrator. */
    if (result.success) {
      var yields = (ctx.yields && ctx.yields[targetId]) || [];
      yields.forEach(function (y) {
        if (!y.factId || !Knowledge) return;
        if (y.requiresBand && BANDS.indexOf(band) < BANDS.indexOf(y.requiresBand)) return;
        b.events.push(Knowledge.learnEvent(command.actorId, y.factId, y.stage || 'partial',
          'told by ' + (target ? target.name : targetId)));
        b.beats.push((target ? target.name : targetId) + ' tells ' + a.name + ' something.');
      });
    }
    return b;
  }

  /**
   * Can this creature be reasoned with at all?
   *
   * A playtest offered the player "Try to persuade Ochre Jelly" and "Lie to
   * Giant Spider B". Talking is not a universal affordance: it needs something
   * on the other side that has language and enough mind to use it. Creatures
   * below this bar can still be intimidated in the animal sense, which is why
   * that one verb survives.
   */
  function canConverse(target) {
    if (!target) return false;
    var block = target.statblock || {};
    var int = (target.base && target.base.abilities && target.base.abilities.int) ||
      (block.abilities && block.abilities.int) || 10;
    var langs = block.languages;
    if (typeof langs === 'string') langs = langs.trim() ? [langs] : [];
    var speaks = !langs || (Array.isArray(langs) && langs.length &&
      !(langs.length === 1 && /^(?:\u2014|-|none)$/i.test(String(langs[0]).trim())));
    /* People and NPCs have no statblock and are assumed to talk. */
    if (!target.statblock) return int >= 4;
    return int >= 4 && !!speaks;
  }

  /** Frightening a beast is possible in a way that lying to one is not. */
  function canBeCowed(target) {
    if (!target) return false;
    var block = target.statblock || {};
    var int = (target.base && target.base.abilities && target.base.abilities.int) ||
      (block.abilities && block.abilities.int) || 10;
    var type = String(block.type || '').toLowerCase();
    if (/ooze|construct|undead|plant/.test(type)) return false;
    return int >= 2;
  }

  resolveSocial.legalMoves = function (state, actorId, ctx) {
    var a = actor(state, actorId);
    if (!a || downed(a)) return [];
    var moves = [];
    Object.keys(state.actors || {}).forEach(function (id) {
      if (id === actorId) return;
      var o = state.actors[id];
      if (!o.runtime || o.runtime.dead) return;
      /* You cannot strike up a conversation with someone you have not noticed.
         Offering "Persuade the Hooded Figure" was itself the reveal. */
      if (!perceives(state, actorId, id)) return;
      /* You can talk to anyone who is not actively trying to kill you, and to
         some who are. Enemies are excluded only mid-combat. */
      if (o.side === 'enemy' && state.combat && state.combat.active) return;
      /* You cannot hold a conversation with someone who is unconscious. */
      if (downed(o)) return;
      var who = o.name || id;
      var talks = canConverse(o);
      if (talks) {
        moves.push(mv('ask', 'Ask ' + who + ' about something', 'a moment', { targetIds: [id] }));
        moves.push(mv('persuade', 'Try to persuade ' + who, 'a moment', { targetIds: [id] }));
      }
      /* Reading a creature's manner works on anything with a manner to read. */
      if (talks || canBeCowed(o)) {
        moves.push(mv('insight', 'Read ' + who + '\u2019s manner', 'a moment', { targetIds: [id] }));
      }
      if (o.side !== 'party' && canBeCowed(o)) {
        moves.push(mv('intimidate', 'Lean on ' + who, 'a moment', { targetIds: [id] },
          'frightening people is remembered'));
      }
      if (o.side !== 'party' && talks) {
        moves.push(mv('deceive', 'Lie to ' + who, 'a moment', { targetIds: [id] },
          'being caught costs trust badly'));
      }
    });
    return moves;
  };

  /* ========================================================== items ========= */

  function resolveItem(state, command, ctx) {
    ctx = ctx || {};
    var b = Events.makeBatch(command);
    var a = actor(state, command.actorId);
    if (!a) return Events.refuse(b, 'no-actor', 'nobody is there');
    var verb = command.primary.verb;
    var uid = command.primary.itemId;
    var inv = (a.runtime && a.runtime.inventory) || [];
    var entry = uid ? inv.filter(function (i) { return (i.uid || i.id) === uid; })[0] : null;

    if (['use', 'drink', 'equip', 'unequip', 'attune', 'throw', 'give', 'drop'].indexOf(verb) >= 0 && !entry) {
      return Events.refuse(b, 'not-carried', 'that is not something ' + a.name + ' is carrying');
    }
    var label = entry ? (entry.name || entry.id) : 'it';

    switch (verb) {
      case 'drink':
      case 'use': {
        var heal = entry && entry.heal;
        if (heal) {
          var roll = Dice.roll(heal, { rng: state.rng });
          Events.push(b, 'roll', { rollKind: 'heal', actorId: command.actorId, total: roll.total, explain: Dice.explain(roll) }, '');
          Events.push(b, 'hp', { targetId: command.actorId, delta: roll.total },
            a.name + ' drinks ' + label + ' and recovers ' + roll.total + ' hit points.');
        } else {
          Events.push(b, 'note', { text: 'use', actorId: command.actorId, itemId: uid },
            a.name + ' uses ' + label + '.');
        }
        if (entry && entry.consumable !== false && (verb === 'drink' || entry.consumable)) {
          Events.push(b, 'item_lose', { actorId: command.actorId, uid: uid }, '');
        }
        return b;
      }
      case 'equip':
        Events.push(b, 'item_equip', { actorId: command.actorId, slot: entry.slot || 'hand', uid: uid },
          a.name + ' readies ' + label + '.');
        return b;
      case 'unequip':
        Events.push(b, 'item_unequip', { actorId: command.actorId, slot: entry.slot || 'hand' },
          a.name + ' puts ' + label + ' away.');
        return b;
      case 'attune': {
        var attuned = (a.runtime.attuned || []).length;
        if (attuned >= 3) return Events.refuse(b, 'attunement-full', a.name + ' is already attuned to three items');
        Events.push(b, 'item_attune', { actorId: command.actorId, uid: uid },
          a.name + ' attunes to ' + label + '.');
        return b;
      }
      case 'drop':
        Events.push(b, 'item_lose', { actorId: command.actorId, uid: uid }, a.name + ' drops ' + label + '.');
        return b;
      case 'give': {
        var toId = (command.primary.targetIds || [])[0];
        var to = toId ? actor(state, toId) : null;
        if (!to) return Events.refuse(b, 'no-target', 'there is nobody to hand it to');
        Events.push(b, 'item_lose', { actorId: command.actorId, uid: uid }, '');
        Events.push(b, 'item_gain', { actorId: toId, item: entry },
          a.name + ' hands ' + label + ' to ' + to.name + '.');
        /* Giving something away is an act of trust and is remembered. */
        Events.push(b, 'relationship', {
          fromId: toId, toId: command.actorId, affinity: 4, trust: 3,
          because: a.name + ' gave them ' + label,
        }, '');
        return b;
      }
      default:
        return Events.refuse(b, 'unknown-verb', 'items do not handle ' + verb);
    }
  }

  resolveItem.legalMoves = function (state, actorId) {
    var a = actor(state, actorId);
    if (!a || downed(a)) return [];
    var inv = (a.runtime && a.runtime.inventory) || [];
    var moves = [];
    inv.slice(0, 12).forEach(function (i) {
      var uid = i.uid || i.id;
      var label = i.name || i.id;
      if (i.heal || i.consumable) {
        moves.push(mv('drink', 'Drink ' + label, 'action', { itemId: uid }));
      } else {
        moves.push(mv('use', 'Use ' + label, 'action', { itemId: uid }));
      }
    });
    return moves;
  };

  /* ========================================================= spells ========= */

  function resolveSpell(state, command, ctx) {
    ctx = ctx || {};
    var b = Events.makeBatch(command);
    var a = actor(state, command.actorId);
    if (!a) return Events.refuse(b, 'no-actor', 'nobody is there to cast');
    if (command.primary.verb === 'dismiss_concentration') {
      Events.push(b, 'concentration_end', { actorId: command.actorId },
        a.name + ' lets the spell go.');
      return b;
    }
    var spellId = command.primary.spellId;
    if (!spellId) return Events.refuse(b, 'no-spell', 'no spell was named');

    var d = derivedOf(state, command.actorId);
    var known = (d && d.spellcasting && (d.spellcasting.available || d.spellcasting.prepared)) || [];
    if (known.length && known.indexOf(spellId) < 0) {
      return Events.refuse(b, 'not-prepared', a.name + ' does not have ' + spellId + ' prepared');
    }

    var spell = spellData(ctx) && spellData(ctx)[spellId];
    var level = command.primary.slotLevel != null ? command.primary.slotLevel : (spell ? spell.level : 1);

    if (level > 0) {
      var spent = (a.runtime.slotsSpent && a.runtime.slotsSpent[level]) || 0;
      var maxSlots = (d && d.spellcasting && d.spellcasting.slotsMax && d.spellcasting.slotsMax[level]) || 0;
      if (maxSlots && spent >= maxSlots) {
        return Events.refuse(b, 'no-slot', a.name + ' has no level ' + level + ' slots left');
      }
      if (!maxSlots) {
        return Events.refuse(b, 'no-slot', a.name + ' has no level ' + level + ' slots at all');
      }
      /* A dedicated slot event, so the spend lands in `slotsSpent` — the very
         pool the check above reads. It previously emitted a generic resource
         called "slot1", which the applier wrote to `runtime.resources`, so the
         check never saw it and every caster had unlimited slots. */
      Events.push(b, 'slot_spend', { actorId: command.actorId, level: level },
        a.name + ' spends a level ' + level + ' slot (' + (spent + 1) + ' of ' + maxSlots + ' used).');
    }

    var name = (spell && spell.name) || spellId;
    var targetId = (command.primary.targetIds || [])[0];
    var target = targetId ? actor(state, targetId) : null;

    if (spell && spell.mech && spell.mech.concentration) {
      if (a.runtime.concentratingOn) {
        Events.push(b, 'concentration_end', { actorId: command.actorId },
          a.name + '\u2019s earlier spell ends.');
      }
      Events.push(b, 'concentration_start', {
        actorId: command.actorId, spellId: spellId, effectId: 'eff_' + spellId + '_' + state.revision,
      }, a.name + ' begins concentrating on ' + name + '.');
    }

    /* Healing and damage are the two effects worth resolving generically here;
       everything else is narrated from the spell's own text with the slot
       correctly spent, which is honest about what the engine models. */
    var handled = false;
    var effects = (spell && spell.mech && spell.mech.effects) || [];
    effects.forEach(function (e) {
      if (e.kind === 'heal' && target) {
        var roll = Dice.roll(e.dice || '1d8', { rng: state.rng });
        var mod = (d && d.spellcasting && d.spellcasting.mod) || 0;
        var total = roll.total + (e.mod === 'spell' ? mod : (e.flat || 0));
        Events.push(b, 'roll', { rollKind: 'heal', actorId: command.actorId, total: total, explain: Dice.explain(roll) }, '');
        Events.push(b, 'hp', { targetId: targetId, delta: total },
          a.name + ' casts ' + name + '; ' + target.name + ' recovers ' + total + ' hit points.');
        handled = true;
      }
      if (e.kind === 'temp_hp' && target) {
        var r2 = Dice.roll(e.dice || '1d4', { rng: state.rng });
        Events.push(b, 'temp_hp', { targetId: targetId, amount: r2.total + (e.flat || 0) },
          target.name + ' gains ' + (r2.total + (e.flat || 0)) + ' temporary hit points.');
        handled = true;
      }
    });

    if (!handled) {
      Events.push(b, 'note', { text: 'cast', actorId: command.actorId, spellId: spellId },
        a.name + ' casts ' + name +
        (target ? ' on ' + target.name : '') + '.');
    }
    return b;
  }

  resolveSpell.legalMoves = function (state, actorId, ctx) {
    var a = actor(state, actorId);
    if (!a || downed(a)) return [];
    var d = derivedOf(state, actorId);
    var known = (d && d.spellcasting && (d.spellcasting.available || d.spellcasting.prepared)) || [];
    if (!known.length) return [];
    var SPELLS = spellData(ctx);
    var moves = [];
    var allies = Object.keys(state.actors || {}).filter(function (id) {
      var o = state.actors[id];
      return o.side === a.side && o.runtime && !o.runtime.dead &&
        perceives(state, actorId, id);
    });
    /* Someone at zero hit points is the most important target on the board, so
       heals are offered against them first. */
    allies.sort(function (x, y) {
      return (state.actors[x].runtime.hp || 0) - (state.actors[y].runtime.hp || 0);
    });

    known.slice(0, 12).forEach(function (spellId) {
      var spell = SPELLS && SPELLS[spellId];
      var name = (spell && spell.name) || spellId;
      if (isHealing(spell)) {
        allies.forEach(function (id) {
          var target = state.actors[id];
          var hurt = target.runtime.hpMax && target.runtime.hp < target.runtime.hpMax;
          if (!hurt && allies.length > 1) return;    // no point healing the unhurt
          var dying = target.runtime.hp <= 0;
          moves.push(mv('cast', 'Cast ' + name + ' on ' + (target.name || id) +
            (dying ? ' \u2014 they are dying' : ''), 'action',
            { spellId: spellId, targetIds: [id] },
            dying ? 'they are at zero hit points and making death saves' : null));
        });
      } else {
        moves.push(mv('cast', 'Cast ' + name, 'action', { spellId: spellId }));
      }
    });
    if (a.runtime && a.runtime.concentratingOn) {
      moves.push(mv('dismiss_concentration', 'Let the spell go', 'free'));
    }
    return moves;
  };

  /* ===================================================== improvised ========= */

  /**
   * Anything the rules did not anticipate.
   *
   * The engine cannot know what "cut the mooring rope so the punt drifts
   * between us and the thing" does, but it can decide which ability it tests
   * and how hard it is, roll it honestly, and hand the narrator a result to
   * describe. That is far better than refusing, and it is the difference
   * between a game and a menu.
   */
  var IMPROV_HINTS = [
    { re: /\b(?:lift|haul|force|smash|break|shove|heave|pull|drag|hold)\b/i, skill: 'athletics' },
    { re: /\b(?:balance|tumble|squeeze|slip|dodge|leap|climb down|catch)\b/i, skill: 'acrobatics' },
    { re: /\b(?:cut|tie|pick|rig|wedge|jam|fiddle|palm|pocket)\b/i, skill: 'sleight_of_hand' },
    { re: /\b(?:sneak|creep|hide|quietly|unseen)\b/i, skill: 'stealth' },
    { re: /\b(?:remember|recall|recognise|recognize|identify|know)\b/i, skill: 'history' },
    { re: /\b(?:pray|holy|blessed|divine|rite|ritual)\b/i, skill: 'religion' },
    { re: /\b(?:track|weather|forage|camp|trail)\b/i, skill: 'survival' },
    { re: /\b(?:calm|soothe|handle|horse|animal|dog)\b/i, skill: 'animal_handling' },
    { re: /\b(?:examine|deduce|work out|figure out|inspect)\b/i, skill: 'investigation' },
    { re: /\b(?:listen|watch|spot|notice|scan)\b/i, skill: 'perception' },
  ];

  function skillForImprovised(improvised) {
    var text = ((improvised && improvised.method) || '') + ' ' +
      ((improvised && improvised.desiredOutcome) || '');
    for (var i = 0; i < IMPROV_HINTS.length; i++) {
      if (IMPROV_HINTS[i].re.test(text)) return IMPROV_HINTS[i].skill;
    }
    return 'athletics';
  }

  function resolveImprovised(state, command, ctx) {
    ctx = ctx || {};
    var b = Events.makeBatch(command);
    var a = actor(state, command.actorId);
    if (!a) return Events.refuse(b, 'no-actor', 'nobody is there');
    var improvised = command.primary.improvised || {};
    var skill = (command.primary.suggestion && command.primary.suggestion.skill) ||
      skillForImprovised(improvised);

    /* Improvised actions default one step harder than a standard task: they
       are, by definition, not what the tools were made for. */
    var result = check(state, b, command.actorId, skill, 'hard', command.primary.suggestion,
      trim(improvised.desiredOutcome, 70));

    Events.push(b, 'note', {
      text: result.success ? 'improvised-success' : 'improvised-failure',
      actorId: command.actorId, attempt: improvised.desiredOutcome,
    }, result.success
      ? a.name + ' manages it: ' + trim(improvised.desiredOutcome, 90)
      : a.name + ' cannot make it work.');
    return b;
  }

  resolveImprovised.legalMoves = function () {
    /* Improvisation is never offered as a button — it exists precisely for the
       things a button list could not contain. It reaches the engine only
       through free text. */
    return [];
  };

  /* ---------------------------------------------------------------- utils -- */

  function mv(verb, what, cost, extra, warn) {
    var step = Command
      ? Command.makeStep(Object.assign({ verb: verb }, extra || {}))
      : Object.assign({ verb: verb, targetIds: [] }, extra || {});
    var out = { step: step, what: what, cost: cost };
    if (warn) out.warn = warn;
    return out;
  }

  function trim(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '\u2026' : s;
  }

  var api = {
    EXPLORE: EXPLORE, SOCIAL: SOCIAL, BANDS: BANDS,
    difficultyFor: difficultyFor,
    socialModifier: socialModifier,
    skillForImprovised: skillForImprovised,
    canConverse: canConverse, canBeCowed: canBeCowed,
    resolveExploration: resolveExploration,
    resolveSocial: resolveSocial,
    resolveItem: resolveItem,
    resolveSpell: resolveSpell,
    resolveImprovised: resolveImprovised,
    register: function () {
      if (!Dispatch) return api;
      Dispatch.register('exploration', resolveExploration);
      Dispatch.register('social', resolveSocial);
      Dispatch.register('item', resolveItem);
      Dispatch.register('spell', resolveSpell);
      Dispatch.register('improvised', resolveImprovised);
      return api;
    },
  };

  global.DND = global.DND || {};
  global.DND.Interaction = api;
  api.register();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
