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
    /* Guidance, exhaustion, and anything else currently on this character are
       folded in here. The effect system computed them correctly and nothing
       ever asked, so Guidance was a line of prose. */
    var result = Rules.skillCheck(d, skill,
      withEffects(state, actorId, 'ability_check', { rng: state.rng, dc: diff.dc }));
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
  /* `cost` is what the move claims in the action bar AND what the resolver
     spends. They used to be declared in two places — the label in legalMoves,
     the (absent) spend in the resolver — so "Search the area · action" cost
     nothing and a character could search the room and still attack. */
  var EXPLORE = {
    search: { skill: 'investigation', band: 'medium', verbing: 'searching', cost: 'action' },
    investigate: { skill: 'investigation', band: 'medium', verbing: 'examining', cost: 'time' },
    perceive: { skill: 'perception', band: 'medium', verbing: 'watching', cost: 'action' },
    unlock: { skill: 'sleightOfHand', band: 'hard', verbing: 'picking the lock', cost: 'action' },
    disarm_trap: { skill: 'sleightOfHand', band: 'hard', verbing: 'disarming it', cost: 'action' },
    track: { skill: 'survival', band: 'medium', verbing: 'tracking', cost: 'time' },
    forage: { skill: 'survival', band: 'easy', verbing: 'foraging', cost: 'time' },
    read: { skill: 'investigation', band: 'easy', verbing: 'reading', cost: 'action' },
    interact: { skill: null, band: 'trivial', verbing: 'handling it', cost: 'object' },
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

    /* In a fight, an action costs an action. Search and Look-and-listen are
       both offered labelled "action" and neither spent one, so a character
       could search the room and still take a full attack — and keep searching
       all round. Out of combat there is no economy to spend. */
    if (state.combat && state.combat.active && spec.cost === 'action') {
      Events.push(b, 'action_economy', { actorId: command.actorId, action: false }, '');
    }

    if (!spec.skill) {
      Events.push(b, 'note', { text: verb, actorId: command.actorId },
        a.name + ' ' + spec.verbing + '.');
      return b;
    }

    var focus = command.primary.note || command.primary.suggestion && command.primary.suggestion.focus || '';
    var band = (ctx.difficulty && ctx.difficulty[verb]) || spec.band;

    /* A named obstacle sets its own difficulty and has its own consequences.
       Picking a lock and disarming a trap used to roll a generic check against
       nothing in particular: the lock stayed locked however well you rolled,
       the trap stayed armed, and failing to disarm one was free. */
    var obstacle = null;
    if (verb === 'unlock' || verb === 'disarm_trap') {
      var wantId = command.primary.targetId || (command.primary.targetIds || [])[0] || focus;
      var kind = verb === 'unlock' ? 'locked' : 'trap';
      obstacle = ((ctx.obstacles) || []).filter(function (o) {
        return !o.cleared && (o.id === wantId || o.kind === kind);
      })[0];
      if (!obstacle) {
        return Events.refuse(b, 'nothing-to-' + verb,
          verb === 'unlock' ? 'there is nothing locked here' : 'there is no trap here to disarm');
      }
    }

    var result = obstacle && obstacle.dc
      ? checkAgainstDc(state, b, command.actorId, obstacle.skill || spec.skill, obstacle.dc,
        obstacle.name)
      : check(state, b, command.actorId, spec.skill, band,
        command.primary.suggestion, focus || undefined);

    if (obstacle) return resolveObstacle(state, command, b, a, verb, obstacle, result);

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

  /**
   * A check against a specific difficulty, rather than a difficulty band.
   *
   * A lock has a DC of its own; asking "how hard is picking a lock in general"
   * throws that away.
   */
  function checkAgainstDc(state, b, actorId, skill, dc, what) {
    var a = actor(state, actorId);
    var d = derivedOf(state, actorId);
    var roll = Rules.skillCheck(d, skill, { rng: state.rng });
    var success = roll.total >= dc;
    Events.push(b, 'roll', {
      rollKind: 'skill', of: skill, actorId: actorId, dc: dc,
      total: roll.total, natural: roll.natural, success: success,
      explain: Dice.explain(roll),
    }, a.name + ' works at ' + (what || 'it') + ': ' + roll.total + ' against DC ' + dc +
      (success ? ' \u2014 it gives.' : ' \u2014 it does not.'));
    return { success: success, roll: roll, dc: dc };
  }

  /**
   * What actually happens to a lock or a trap.
   *
   * Both used to be pure theatre: a successful pick left the door locked and
   * the option to pick it offered for ever, and a failed disarm — the one
   * moment in the game where a trap is supposed to bite — cost nothing at all.
   */
  function resolveObstacle(state, command, b, a, verb, obstacle, result) {
    if (result.success) {
      Events.push(b, 'scene_clear', {
        locationId: state.locationId, obstacleId: obstacle.id, by: command.actorId,
      }, verb === 'unlock'
        ? a.name + ' picks the lock on ' + obstacle.name + '.'
        : a.name + ' disarms ' + obstacle.name + '.');
      return b;
    }

    if (verb === 'unlock') {
      Events.push(b, 'note', { text: 'lock-held', actorId: command.actorId },
        obstacle.name + ' holds.');
      return b;
    }

    /* A trap that goes off. This is the whole reason disarming one is a
       decision rather than a formality. */
    var dmgSpec = obstacle.damage || '2d6';
    var roll = Dice.roll(dmgSpec, { rng: state.rng });
    var amount = roll.total != null ? roll.total : 0;
    Events.push(b, 'roll', {
      rollKind: 'damage', of: 'trap', actorId: command.actorId,
      total: amount, explain: Dice.explain(roll),
    }, '');
    Events.push(b, 'hp', {
      targetId: command.actorId, delta: -amount,
      damageType: obstacle.damageType || 'piercing',
    }, a.name + ' sets off ' + obstacle.name + ' \u2014 ' + amount + ' damage.');
    /* A sprung trap is spent, which is why setting one off is a cost and not
       a loop. */
    Events.push(b, 'scene_clear', {
      locationId: state.locationId, obstacleId: obstacle.id, by: command.actorId, sprung: true,
    }, '');
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

      /* A long rest is when a cleric, druid, paladin or wizard chooses which
         spells they have ready for the day. Without this they kept the list
         they were built with for the whole campaign, which quietly turned
         every prepared caster into a worse sorcerer.

         Prepared automatically here so an unattended game never stalls on a
         spell menu; a player who wants to choose for themselves does it
         through Game.preparationFor before resting, or revises afterwards. */
      if (isLong) preparedSlateFor(state, id, b);
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
   * Re-prepare one character's spells over a long rest.
   *
   * Silent for anyone who does not prepare — a fighter, a sorcerer, a
   * level-1 paladin — so the caller can hand it the whole party.
   */
  function preparedSlateFor(state, actorId, b) {
    var Prepare = (global.DND && global.DND.Prepare) ||
      (typeof require !== 'undefined' ? require('./prepare.js') : null);
    if (!Prepare) return;
    var a = actor(state, actorId);
    if (!a || !a.base || !a.progression) return;

    try {
      Prepare.ensureSpellbook(a.base, a.progression);
      var plan = Prepare.preparationFor(a.base, a.progression, derivedOf(state, actorId));
      if (!plan || !plan.count) return;

      var chosen = Prepare.autoChoose(plan, {});
      if (!chosen.length) return;

      /* Say so only when the slate actually changed; "prepares the same spells
         again" is noise in a transcript every single night. */
      var before = (a.progression.preparedSpells || []).slice().sort().join(',');
      Prepare.eventsFor(actorId, plan, chosen).forEach(function (e) { b.events.push(e); });
      if (chosen.slice().sort().join(',') !== before) {
        b.beats.push(a.name + ' studies and prepares a different slate of spells.');
      }
    } catch (e) {
      /* A failure to re-prepare must not cost the party their rest. */
      if (global.console) global.console.warn('could not re-prepare for ' + actorId + ': ' + e.message);
    }
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
    /* Both cost an action, so neither may be offered once the action is
       spent — the bar used to keep offering Search after an attack, and the
       resolver used to let it through. */
    var spent = inCombat && a.runtime && a.runtime.turn && a.runtime.turn.action === false;
    var moves = spent ? [] : [
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

      /* What this particular place actually contains. Six verbs the engine has
         always resolved lived here with nothing describing the scene, so a
         locked door could never be picked, a trap never disarmed, a lever
         never pulled and a book never read — the game had the rules for all of
         it and no way to reach any of it. */
      ((ctx && ctx.obstacles) || []).forEach(function (o) {
        if (o.kind === 'locked') {
          moves.push(mv('unlock', 'Pick the lock on ' + o.name, 'time',
            { note: o.id, targetIds: [o.id] }, 'thieves\u2019 tools, against the lock'));
        } else if (o.kind === 'trap') {
          moves.push(mv('disarm_trap', 'Disarm ' + o.name, 'time',
            { note: o.id, targetIds: [o.id] }, 'getting it wrong sets it off'));
        }
      });
      ((ctx && ctx.interactables) || []).forEach(function (i) {
        moves.push(mv('interact', 'Try ' + (i.name || i.id), 'object', { note: i.id, targetIds: [i.id] }));
      });
      ((ctx && ctx.readables) || []).forEach(function (r) {
        moves.push(mv('read', 'Read ' + (r.name || r.id), 'time', { note: r.id, targetIds: [r.id] }));
      });
      ((ctx && ctx.tracks) || []).forEach(function (tr) {
        moves.push(mv('track', 'Follow ' + (tr.name || tr.id), 'time', { note: tr.id, targetIds: [tr.id] }));
      });
      if (ctx && ctx.forage) {
        moves.push(mv('forage', 'Forage for food and water', 'time'));
      }
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
      /* Telling someone something, rather than asking. The whole half of a
         conversation where the party volunteers what it knows had no button. */
      if (talks) {
        moves.push(mv('tell', 'Tell ' + who + ' something', 'a moment', { targetIds: [id] },
          'what you say is remembered, and repeated'));
        moves.push(mv('offer', 'Offer ' + who + ' a deal', 'a moment', { targetIds: [id] }));
        moves.push(mv('refuse', 'Refuse ' + who, 'a moment', { targetIds: [id] },
          'refusing is remembered too'));
      }
    });

    /* Performing is for the room, not for one person: it needs an audience,
       any audience, and it is how a bard earns a bed for the night. */
    var audience = Object.keys(state.actors || {}).filter(function (id) {
      var o = state.actors[id];
      return id !== actorId && o.runtime && !o.runtime.dead && !downed(o) &&
        perceives(state, actorId, id) && canConverse(o);
    });
    if (audience.length && !(state.combat && state.combat.active)) {
      moves.push(mv('perform', 'Perform for the room', 'time', { targetIds: audience.slice(0, 4) }));
    }
    return moves;
  };

  /* ========================================================== items ========= */

  /**
   * The healing an item restores, expressed as a dice string.
   *
   * Looks the item up in the real table rather than trusting the inventory
   * entry to carry a copy, because an item picked up in play carries only its
   * id — which is why drinking a found Potion of Healing quietly did nothing.
   */
  /**
   * Who a spell actually lands on.
   *
   * A single-target spell hits what the caster named. An area spell hits
   * everyone hostile who is present — the engine has no positional geometry
   * for blast radii, and silently treating a fireball as a single-target
   * spell would be a much worse lie than treating it as "everyone in the
   * fight". Allies are spared, which is generous and keeps an AI seat from
   * wiping its own party with a spell it does not understand.
   */
  function spellTargets(state, command, spell, effects) {
    var named = (command.primary.targetIds || []).filter(function (id) { return actor(state, id); });
    var isArea = (effects || []).some(function (e) { return e.kind === 'area'; }) ||
      (spell && spell.mech && spell.mech.targets && spell.mech.targets.type === 'area');
    if (!isArea) return named.length ? named : [];

    var caster = actor(state, command.actorId);
    var focus = named[0] ? actor(state, named[0]) : null;
    var enemySide = focus ? focus.side : (caster && caster.side === 'party' ? 'enemy' : 'party');
    var hit = Object.keys(state.actors).filter(function (id) {
      var o = state.actors[id];
      return o.side === enemySide && o.runtime && !o.runtime.dead && o.runtime.hp > 0;
    });
    return hit.length ? hit : named;
  }

  /**
   * Upcasting: an extra die per slot level above the spell's own.
   *
   * `scaling: {per:'slot', mode:'damage', addDice:'1d6'}` is the SRD's own
   * shape. Only damage scaling changes the dice string; more targets or a
   * longer duration are handled where those matter.
   */
  function scaleDice(dice, spell, upcastBy) {
    var sc = spell && spell.mech && spell.mech.scaling;
    if (!upcastBy || !sc || sc.mode !== 'damage' || !sc.addDice) return dice;
    var add = /^(\d+)d(\d+)$/.exec(String(sc.addDice));
    var base = /^(\d+)d(\d+)(.*)$/.exec(String(dice));
    if (!add || !base || add[2] !== base[2]) return dice;
    return (parseInt(base[1], 10) + parseInt(add[1], 10) * upcastBy) + 'd' + base[2] + (base[3] || '');
  }

  function rollSpellDamage(state, e, spell, upcastBy) {
    var total = 0, parts = [], type = null;
    (e.damage || []).forEach(function (dmg) {
      var roll = Dice.roll(scaleDice(dmg.dice, spell, upcastBy), { rng: state.rng });
      total += roll.total;
      parts.push(Dice.explain(roll));
      type = type || dmg.type;
    });
    return { total: total, explain: parts.join(' + '), type: type };
  }

  /** A spell attack: the caster's attack bonus against the target's AC. */
  function resolveSpellAttack(state, b, command, a, d, spell, e, tid, name, upcastBy) {
    var t = actor(state, tid);
    if (!t) return false;
    var Combat = combatModule();
    var ac = Combat && Combat.targetAc ? Combat.targetAc(state, tid) : 10;
    var bonus = (d && d.spellcasting && d.spellcasting.attackBonus) || 0;
    var roll = Dice.attack({ rng: state.rng, mod: bonus, ac: ac });
    Events.push(b, 'roll', { of: 'spell_attack', actorId: command.actorId, targetId: tid, result: roll },
      a.name + ' casts ' + name + ' at ' + t.name + '.');
    if (!roll.hit) { b.beats.push('It goes wide.'); return true; }

    var dmg = rollSpellDamage(state, e, spell, upcastBy);
    if (roll.isCrit) dmg.total += rollSpellDamage(state, e, spell, upcastBy).total;
    applySpellDamage(state, b, tid, dmg, t, name, roll.isCrit);
    return true;
  }

  /**
   * A spell that calls for a saving throw.
   *
   * `saveEffect` is the SRD's own vocabulary: `negates` (nothing on a success),
   * `half` (half damage), `partial` (damage lands, the rider does not).
   */
  function resolveSpellSave(state, b, command, a, d, spell, e, tid, name, upcastBy) {
    var t = actor(state, tid);
    if (!t) return;
    var dc = (d && d.spellcasting && d.spellcasting.dc) || 10;
    var td = derivedOf(state, tid);
    var save = Rules.savingThrow
      ? Rules.savingThrow(td, e.ability, { rng: state.rng, dc: dc })
      : { success: false, total: 0 };

    Events.push(b, 'roll', {
      rollKind: 'save', actorId: tid, ability: e.ability, dc: dc,
      total: save.total, success: save.success, explain: Dice.explain(save),
    }, t.name + ' rolls a ' + String(e.ability).toUpperCase() + ' save against ' + name +
      ' (DC ' + dc + '): ' + (save.success ? 'success.' : 'failure.'));

    if (e.damage && e.damage.length) {
      var dmg = rollSpellDamage(state, e, spell, upcastBy);
      if (save.success) {
        if (e.saveEffect === 'negates') {
          b.beats.push(t.name + ' takes nothing.');
          return;
        }
        if (e.saveEffect === 'half') dmg.total = Math.floor(dmg.total / 2);
      }
      applySpellDamage(state, b, tid, dmg, t, name, false);
    }

    /* A rider condition only lands on a failure — except under `partial`,
       where the damage lands and the condition is what the save avoids. */
    if (e.condition && !save.success) {
      Events.push(b, 'condition_add', {
        targetId: tid, condition: e.condition, source: name,
        endsOn: e.saveRepeat && e.saveRepeat !== 'none' ? 'save' : 'end_of_next_turn',
        saveDc: dc, saveAbility: e.ability,
      }, t.name + ' is ' + e.condition + '.');
    }
  }

  function applySpellDamage(state, b, tid, dmg, t, name, crit) {
    var Combat = combatModule();
    if (Combat && Combat.damageEvents) {
      /* Through the ordinary damage pipeline, so resistances, temporary hit
         points, concentration checks and death all behave exactly as they do
         for a sword. */
      var chain = Combat.damageEvents(state, tid, dmg.total, { crit: !!crit, damageType: dmg.type });
      b.events = b.events.concat(chain.events);
      b.beats = b.beats.concat(chain.beats);
      return;
    }
    Events.push(b, 'hp', { targetId: tid, delta: -dmg.total },
      t.name + ' takes ' + dmg.total + ' damage from ' + name + '.');
  }

  /** Fold active effects into a roll's options. Delegates to combat.js so
      there is one implementation, not two that drift. */
  function withEffects(state, actorId, rollType, opts, ctx) {
    var Combat = combatModule();
    if (!Combat || !Combat.withEffects) return opts;
    return Combat.withEffects(state, actorId, rollType, opts, ctx);
  }

  /**
   * The AC contribution type a spell's mode means.
   *
   * set fixes a base (Mage Armor is 13 + Dex), loor guarantees a minimum
   * (Barkskin is "your AC cannot be less than 16"), dd stacks on top
   * (Shield is +5). Collapsing floor into add granted +16 armour class.
   */
  function acTypeFor(mode) {
    if (mode === 'set') return 'base';
    if (mode === 'floor') return 'floor';
    return 'add';
  }

  /** How many rounds a spell lasts, for conditions that ride on it. */
  function durationRoundsOf(spell) {
    var Effects = (global.DND && global.DND.Effects) ||
      (typeof require !== 'undefined' ? require('./effects.js') : null);
    if (Effects && Effects.durationRounds && spell) {
      try {
        var r = Effects.durationRounds(spell.duration || (spell.mech && spell.mech.duration));
        if (typeof r === 'number' && r > 0) return r;
      } catch (e) { /* fall through to a sane default */ }
    }
    return 10;   // one minute, the commonest spell duration
  }

  function combatModule() {
    return (global.DND && global.DND.Combat) ||
      (typeof require !== 'undefined' ? require('./combat.js') : null);
  }

  /** The item table, however this file is running. */
  function itemTable(ctx) {
    /* The data modules publish to DND.Data, not to DND directly. Reading
       DND.ITEMS found nothing in the BROWSER — and the Node equire
       fallback below quietly saved every test, so buying, selling and
       drinking a healing potion all worked in the suite and did nothing in
       the actual game. The same fixture-versus-reality trap as the armour
       bug, one namespace deeper. */
    return (ctx && ctx.data && ctx.data.ITEMS) ||
      (global.DND && global.DND.Data && global.DND.Data.ITEMS) ||
      (global.DND && global.DND.ITEMS) ||
      (typeof require !== 'undefined' ? require('../data/srd_items.js').ITEMS : null);
  }

  function itemDef(id, ctx) {
    var T = itemTable(ctx);
    return (T && T[id]) || null;
  }

  /**
   * What a merchant asks for something.
   *
   * SRD costs are {quantity, unit} in copper, silver, electrum, gold or
   * platinum, and are frequently null for magic items. Everything is converted
   * to gold so a purse is a single number; an unpriced item is treated as
   * priceless rather than free, because free is the answer that empties a
   * shop.
   */
  var COIN_IN_GOLD = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };
  function priceOf(def) {
    if (!def) return Infinity;
    var c = def.cost;
    if (!c) return RARITY_PRICE[def.rarity] != null ? RARITY_PRICE[def.rarity] : Infinity;
    if (typeof c === 'number') return c;
    var rate = COIN_IN_GOLD[String(c.unit || 'gp').toLowerCase()] || 1;
    /* The data writes qty; reading quantity gave undefined and priced
       every item in the game at zero gold. */
    var qty = c.qty != null ? c.qty : c.quantity;
    return Math.max(0, Math.round((qty || 0) * rate));
  }

  /* Rough going rates for magic items, which the SRD deliberately does not
     price. These are the widely-used DMG guideline midpoints. */
  var RARITY_PRICE = {
    common: 50, uncommon: 400, rare: 4000, 'very-rare': 40000, legendary: 200000,
  };

  /** A table entry turned into something that can sit in a pack. */
  function inventoryEntry(def) {
    return {
      uid: def.id, id: def.id, name: def.name || def.id,
      slot: null, equipped: false,
      damage: def.damage || null, ac: def.ac || null,
      properties: def.properties || [], weight: def.weight || 0,
      consumable: !!(def.mech && def.mech.consumable),
    };
  }

  /** Something lying in this room that could be picked up. */
  function groundItem(state, wantId, ctx) {
    var loc = (state.locations || {})[state.locationId];
    var lying = (loc && loc.items) || [];
    for (var i = 0; i < lying.length; i++) {
      var it = lying[i];
      if (it.uid === wantId || it.id === wantId ||
        String(it.name || '').toLowerCase() === String(wantId).toLowerCase()) return it;
    }
    /* Nothing was placed by hand, but the id may still name a real item — a
       player reaching for something the fiction has just described. */
    var def = itemDef(wantId, ctx);
    return def ? inventoryEntry(def) : null;
  }

  function healDiceFor(entry, ctx) {
    if (!entry) return null;
    var ITEMS = itemTable(ctx);
    var def = ITEMS && ITEMS[entry.id];
    var mech = def && def.mech;
    if (!mech || mech.type !== 'healing') return null;
    var dice = mech.dice || '';
    var bonus = mech.bonus || 0;
    if (!dice) return bonus ? String(bonus) : null;
    return bonus ? dice + '+' + bonus : dice;
  }

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
        /* Healing can be written on the inventory entry (a hand-placed item in
           a campaign) or, far more usually, live in the item table as
           `mech: {type:'healing', dice, bonus}`. Only the first was read, so
           every healing potion picked up in play did nothing at all. */
        var heal = (entry && entry.heal) || healDiceFor(entry, ctx);
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
      case 'unattune':
        Events.push(b, 'item_unattune', { actorId: command.actorId, uid: uid },
          a.name + ' releases their attunement to ' + label + '.');
        return b;

      case 'pick_up': {
        /* Something on the ground, not in a pack. The id is enough to look it
           up; a player who says "pick up the sword" has not been handed a uid. */
        var wantId = command.primary.itemId || (command.primary.targetIds || [])[0];
        if (!wantId) return Events.refuse(b, 'no-item', 'there is nothing named to pick up');
        var ground = groundItem(state, wantId, ctx);
        if (!ground) return Events.refuse(b, 'not-here', 'there is no ' + wantId + ' within reach');
        Events.push(b, 'item_gain', { actorId: command.actorId, item: ground },
          a.name + ' picks up ' + (ground.name || wantId) + '.');
        Events.push(b, 'location_item_remove', { locationId: state.locationId, uid: ground.uid || ground.id }, '');
        return b;
      }

      case 'buy': {
        var sellerId = (command.primary.targetIds || [])[0];
        var seller = sellerId ? actor(state, sellerId) : null;
        if (!seller) return Events.refuse(b, 'no-merchant', 'there is nobody here selling anything');
        if (!canConverse(seller)) {
          return Events.refuse(b, 'no-merchant', (seller.name || 'they') + ' is in no position to trade');
        }
        var wantBuy = command.primary.itemId;
        if (!wantBuy) return Events.refuse(b, 'no-item', 'nothing was named to buy');
        var def = itemDef(wantBuy, ctx);
        if (!def) return Events.refuse(b, 'no-such-item', 'no such thing as ' + wantBuy);
        var price = priceOf(def);
        var purse = a.runtime.gold || 0;
        if (purse < price) {
          return Events.refuse(b, 'too-poor',
            a.name + ' has ' + purse + ' gold and ' + (def.name || wantBuy) + ' costs ' + price);
        }
        Events.push(b, 'gold', { actorId: command.actorId, delta: -price }, '');
        Events.push(b, 'gold', { actorId: sellerId, delta: price }, '');
        Events.push(b, 'item_gain', { actorId: command.actorId, item: inventoryEntry(def) },
          a.name + ' buys ' + (def.name || wantBuy) + ' for ' + price + ' gold.');
        return b;
      }

      case 'sell': {
        var buyerId = (command.primary.targetIds || [])[0];
        var buyer = buyerId ? actor(state, buyerId) : null;
        if (!buyer) return Events.refuse(b, 'no-merchant', 'there is nobody here buying');
        if (!entry) return Events.refuse(b, 'not-carried', 'that is not something ' + a.name + ' is carrying');
        var sellDef = itemDef(entry.id, ctx);
        /* Half price. A merchant who pays full price for used adventuring gear
           is not a merchant, and it is the convention every table already
           expects. */
        var paid = Math.floor(priceOf(sellDef) / 2);
        var theirPurse = buyer.runtime.gold || 0;
        if (theirPurse < paid) {
          return Events.refuse(b, 'they-cannot-pay',
            (buyer.name || 'they') + ' cannot afford that \u2014 they have ' + theirPurse + ' gold');
        }
        Events.push(b, 'item_lose', { actorId: command.actorId, uid: uid }, '');
        Events.push(b, 'gold', { actorId: command.actorId, delta: paid }, '');
        Events.push(b, 'gold', { actorId: buyerId, delta: -paid }, '');
        Events.push(b, 'item_gain', { actorId: buyerId, item: entry },
          a.name + ' sells ' + label + ' for ' + paid + ' gold.');
        return b;
      }

      default:
        return Events.refuse(b, 'unknown-verb', 'items do not handle ' + verb);
    }
  }

  resolveItem.legalMoves = function (state, actorId, ctx) {
    var a = actor(state, actorId);
    if (!a || downed(a)) return [];
    ctx = ctx || {};
    var inv = (a.runtime && a.runtime.inventory) || [];
    var equipped = (a.runtime && a.runtime.equipped) || {};
    var attuned = (a.runtime && a.runtime.attuned) || [];
    var moves = [];
    var table = itemTable(ctx) || {};

    function equippedUids() {
      var out = {};
      Object.keys(equipped).forEach(function (slot) {
        var v = equipped[slot];
        if (!v) return;
        if (Array.isArray(v)) v.forEach(function (x) { out[x] = slot; });
        else out[v] = slot;
      });
      return out;
    }
    var onBody = equippedUids();

    inv.slice(0, 16).forEach(function (i) {
      var uid = i.uid || i.id;
      var label = i.name || i.id;
      var def = table[i.id] || table[uid] || i;
      if (i.heal || i.consumable || (def && def.consumable)) {
        moves.push(mv('drink', 'Drink ' + label, 'action', { itemId: uid }));
      } else {
        moves.push(mv('use', 'Use ' + label, 'action', { itemId: uid }));
      }

      /* Wearing and wielding. Neither was ever offered, so a character could
         pick a sword up and had no way to draw it. */
      var wearable = def && (def.slot || def.armor || def.weapon ||
        def.category === 'weapon' || def.category === 'armor' || def.category === 'shield');
      if (wearable) {
        if (onBody[uid]) {
          moves.push(mv('unequip', 'Put away ' + label, 'object', { itemId: uid }));
        } else {
          moves.push(mv('equip', 'Equip ' + label, 'object', { itemId: uid }));
        }
      }

      /* Attunement. Three items at a time, and the limit is worth saying out
         loud rather than discovering by refusal. */
      if (def && def.attunement) {
        if (attuned.indexOf(uid) >= 0 || attuned.indexOf(i.id) >= 0) {
          moves.push(mv('unattune', 'End attunement to ' + label, 'time', { itemId: uid }));
        } else if (attuned.length < 3) {
          moves.push(mv('attune', 'Attune to ' + label, 'time',
            { itemId: uid, warn: 'a short rest spent with it; three items at once' }));
        }
      }

      /* Throwing, giving away, putting down. */
      if (def && (def.thrown || def.range || def.category === 'weapon')) {
        perceivedFoes(state, actorId).forEach(function (foeId) {
          moves.push(mv('throw', 'Throw ' + label + ' at ' + nameOf(state, foeId), 'action',
            { itemId: uid, targetIds: [foeId] }));
        });
      }
      alliesOf(state, actorId).forEach(function (allyId) {
        moves.push(mv('give', 'Give ' + label + ' to ' + nameOf(state, allyId), 'object',
          { itemId: uid, targetIds: [allyId] }));
      });
      moves.push(mv('drop', 'Drop ' + label, 'free', { itemId: uid }));

      /* Selling, when there is somebody here who buys. */
      (ctx.merchants || []).forEach(function (m) {
        if (m.buys === false) return;
        moves.push(mv('sell', 'Sell ' + label + ' to ' + (m.name || 'the trader'), 'time',
          { itemId: uid, targetIds: m.actorId ? [m.actorId] : [] }));
      });
    });

    /* Anything lying on the ground here. */
    (ctx.groundItems || []).forEach(function (g) {
      moves.push(mv('pick_up', 'Pick up ' + (g.name || g.id), 'object',
        { itemId: g.uid || g.id }));
    });

    /* Anything for sale. */
    (ctx.merchants || []).forEach(function (m) {
      (m.sells || []).forEach(function (id) {
        var def = table[id] || {};
        /* priceOf, not the raw `cost` field: the data stores cost as
           `{qty, unit}`, which stringified to "[object Object]" in the button
           and told a player nothing about what they were about to spend. */
        var gp = priceOf(def);
        var price = (gp != null && isFinite(gp)) ? gp + ' gp' : null;
        moves.push(mv('buy', 'Buy ' + (def.name || id) +
          (price ? ' (' + price + ')' : '') + ' from ' + (m.name || 'the trader'), 'time',
        { itemId: id, targetIds: m.actorId ? [m.actorId] : [] }));
      });
    });

    return moves;
  };

  function nameOf(state, id) {
    var a = state.actors[id];
    return (a && a.name) || id;
  }

  function alliesOf(state, actorId) {
    var a = state.actors[actorId];
    if (!a) return [];
    return Object.keys(state.actors).filter(function (id) {
      var o = state.actors[id];
      return id !== actorId && o.side === a.side && o.runtime && !o.runtime.dead;
    });
  }

  function perceivedFoes(state, actorId) {
    var a = state.actors[actorId];
    if (!a) return [];
    return Object.keys(state.actors).filter(function (id) {
      var o = state.actors[id];
      return o.side && a.side && o.side !== a.side && o.side !== 'neutral' &&
        o.runtime && !o.runtime.dead;
    });
  }

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
    var spell = spellData(ctx) && spellData(ctx)[spellId];

    /* Cantrips are not prepared. They are always available, cost no slot, and
       are the most frequently cast spells at any table — and this check looked
       only at the prepared list, so a wizard's fire bolt and a cleric's sacred
       flame were both refused as "not prepared". Every cantrip in the game was
       uncastable. */
    var sc = (d && d.spellcasting) || {};
    var isCantrip = (spell && spell.level === 0) ||
      (sc.cantripsKnown || []).indexOf(spellId) >= 0;

    var known = (sc.available || sc.prepared || []).concat(sc.cantripsKnown || []);
    /* A wizard rituals from the SPELLBOOK, and needs nothing prepared for it —
       so the ritual pool counts as available when the command IS a ritual. */
    if (command.primary.verb === 'ritual_cast') known = known.concat(sc.ritualFrom || []);
    if (known.length && known.indexOf(spellId) < 0) {
      return Events.refuse(b, 'not-prepared', a.name + ' does not have ' + spellId + ' prepared');
    }

    var level = isCantrip ? 0
      : (command.primary.slotLevel != null ? command.primary.slotLevel : (spell ? spell.level : 1));

    /* Casting costs the action economy the spell asks for. Nothing checked or
       spent it, so a wizard could cast every spell they had prepared in a
       single turn — which is not a small imbalance, it removes the entire
       resource game from spellcasting. Only enforced in a fight; out of
       combat there is no economy and a ritual takes as long as it takes. */
    var castTime = (spell && spell.mech && spell.mech.castTime) || 'action';
    var inCombat = !!(state.combat && state.combat.active) && command.primary.verb !== 'ritual_cast';
    if (inCombat) {
      var Combat = combatModule();
      var free = Combat && (castTime === 'bonus' ? Combat.canBonus : castTime === 'reaction' ? Combat.canReact : Combat.canAct);
      if (free && !free(a)) {
        return Events.refuse(b, 'no-' + castTime,
          a.name + ' has no ' + castTime + ' left this turn');
      }
    }

    /* A ritual costs no spell slot. That is the entire point of the ritual tag
       in the 2014 rules: ten extra minutes buys you the casting for free, so a
       cleric can Detect Magic all afternoon without touching their slots. This
       went through the ordinary spend path, which meant a ritual cost a slot
       AND was refused outright once the slots ran out — the one situation the
       rule exists to cover. */
    var asRitual = command.primary.verb === 'ritual_cast';
    if (asRitual) {
      if (!spell || !spell.ritual) {
        return Events.refuse(b, 'not-a-ritual',
          (spell && spell.name || spellId) + ' cannot be cast as a ritual');
      }
      /* Only a class with the Ritual Casting feature. A paladin has none. */
      if (!sc.ritual) {
        return Events.refuse(b, 'no-ritual-casting',
          a.name + ' has no ritual casting');
      }
      /* And it must be somewhere they can ritual from — the spellbook for a
         wizard, the prepared list for everyone else. */
      if ((sc.ritualFrom || []).indexOf(spellId) < 0) {
        return Events.refuse(b, 'ritual-not-available',
          a.name + ' cannot ritual ' + (spell.name || spellId) + ' from anything they carry');
      }
      if (state.combat && state.combat.active) {
        return Events.refuse(b, 'in-combat',
          'a ritual takes ten minutes longer than the spell \u2014 not in the middle of a fight');
      }
      Events.push(b, 'time', { minutes: 10 }, 'The ritual takes ten minutes longer.');
    }

    if (level > 0 && !asRitual) {
      var spent = (a.runtime.slotsSpent && a.runtime.slotsSpent[level]) || 0;
      var maxSlots = (d && d.spellcasting && d.spellcasting.slotsMax && d.spellcasting.slotsMax[level]) || 0;
      if (maxSlots && spent >= maxSlots) {
        return Events.refuse(b, 'no-slot', a.name + ' has no level ' + level + ' slots left');
      }
      if (!maxSlots) {
        return Events.refuse(b, 'no-slot', a.name + ' has no level ' + level + ' slots at all');
      }
      /* You cannot cast a spell with a slot lower than its own level. Nothing
         compared the two, so a level-1 slot cast Fireball. */
      if (spell && spell.level > level) {
        return Events.refuse(b, 'slot-too-low',
          (spell.name || spellId) + ' is a level ' + spell.level +
          ' spell and cannot be cast with a level ' + level + ' slot');
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

    if (inCombat) {
      var econ = { actorId: command.actorId };
      if (castTime === 'bonus') econ.bonus = false;
      else if (castTime === 'reaction') econ.reaction = false;
      else econ.action = false;
      Events.push(b, 'action_economy', econ, '');
    }

    var concentrating = !!(spell && spell.mech && spell.mech.concentration);
    if (concentrating) {
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
    /* Every effect the SRD data actually describes, resolved mechanically.
       This used to handle `heal` and `temp_hp` alone — nine spells out of
       three hundred and nineteen — so Fireball spent a slot, printed a line
       and dealt no damage to anybody. The data has always carried saves,
       spell attacks, conditions and AC changes; nothing read them. */
    var handled = false;
    var effects = (spell && spell.mech && spell.mech.effects) || [];
    var targets = spellTargets(state, command, spell, effects);
    var upcastBy = Math.max(0, level - (spell ? spell.level : level));

    effects.forEach(function (e) {
      if (e.kind === 'heal') {
        targets.forEach(function (tid) {
          var t = actor(state, tid);
          if (!t) return;
          var roll = Dice.roll(scaleDice(e.dice || '1d8', spell, upcastBy), { rng: state.rng });
          var mod = (d && d.spellcasting && d.spellcasting.mod) || 0;
          var total = roll.total + (e.mod === 'spell' ? mod : (e.flat || 0));
          Events.push(b, 'roll', { rollKind: 'heal', actorId: command.actorId, total: total, explain: Dice.explain(roll) }, '');
          Events.push(b, 'hp', { targetId: tid, delta: total },
            a.name + ' casts ' + name + '; ' + t.name + ' recovers ' + total + ' hit points.');
        });
        handled = true;
        return;
      }

      if (e.kind === 'temp_hp') {
        targets.forEach(function (tid) {
          var t = actor(state, tid);
          if (!t) return;
          var r2 = Dice.roll(scaleDice(e.dice || '1d4', spell, upcastBy), { rng: state.rng });
          var amount = r2.total + (e.flat || 0);
          Events.push(b, 'temp_hp', { targetId: tid, amount: amount },
            t.name + ' gains ' + amount + ' temporary hit points.');
        });
        handled = true;
        return;
      }

      if (e.kind === 'attack') {
        targets.forEach(function (tid) {
          if (resolveSpellAttack(state, b, command, a, d, spell, e, tid, name, upcastBy)) handled = true;
        });
        handled = true;
        return;
      }

      if (e.kind === 'save') {
        targets.forEach(function (tid) {
          resolveSpellSave(state, b, command, a, d, spell, e, tid, name, upcastBy);
        });
        handled = true;
        return;
      }

      if (e.kind === 'ac') {
        targets.forEach(function (tid) {
          var t = actor(state, tid);
          if (!t) return;
          Events.push(b, 'effect_add', {
            targetId: tid, actorId: command.actorId,
            effect: {
              id: 'eff_' + spellId + '_' + tid, name: name, targetId: tid,
              kind: 'ac', spellId: spellId,
              concentrationId: concentrating ? command.actorId : null,
              /* The data's `mode` maps onto the AC resolver's `type`, and the
                 mapping is not cosmetic: Barkskin sets a FLOOR of 16, and
                 treating that as an addition granted +16 armour class. */
              ac: {
                type: acTypeFor(e.mode),
                source: name,
                value: e.value,
                dexApplies: e.dexApplies !== false,
              },
            },
          }, name + ' settles over ' + t.name + '.');
        });
        handled = true;
        return;
      }

      if (e.kind === 'auto') {
        /* Damage that simply lands: no attack roll, no save. Magic Missile is
           the archetype — it never misses, which is why it fits neither the
           attack nor the save shape and was left as prose that did nothing. */
        var darts = (e.darts || 1) + (spell && spell.mech && spell.mech.scaling &&
          spell.mech.scaling.mode === 'targets' ? (spell.mech.scaling.addTargets || 1) * upcastBy : 0);
        var per = e.perDart || { dice: '1d4', flat: 0, type: 'force' };
        var order = targets.length ? targets : [];
        for (var dart = 0; dart < darts && order.length; dart++) {
          var tid = order[dart % order.length];
          var t = actor(state, tid);
          if (!t || t.runtime.dead) continue;
          var dr = Dice.roll(per.dice, { rng: state.rng });
          var amount = dr.total + (per.flat || 0);
          applySpellDamage(state, b, tid, { total: amount, type: per.type }, t, name, false);
        }
        handled = true;
        return;
      }

      if (e.kind === 'hp_pool') {
        /* Sleep and Colour Spray: a pool of hit points that takes creatures
           out of the fight, weakest first, until it runs out. Neither spell
           did anything at all before — Sleep was a slot spent on a sentence. */
        var poolRoll = Dice.roll(scaleDice(e.dice || '5d8', spell, upcastBy), { rng: state.rng });
        var pool = poolRoll.total;
        Events.push(b, 'roll', { rollKind: 'hp_pool', actorId: command.actorId, total: pool, explain: Dice.explain(poolRoll) },
          a.name + ' casts ' + name + ' \u2014 ' + pool + ' hit points of it.');

        var rider = effects.filter(function (x) { return x.kind === 'condition'; })[0];
        var byHp = targets.slice().sort(function (x, y) {
          return (actor(state, x).runtime.hp || 0) - (actor(state, y).runtime.hp || 0);
        });
        byHp.forEach(function (tid) {
          var t = actor(state, tid);
          if (!t || t.runtime.dead) return;
          var hp = t.runtime.hp || 0;
          if (hp > pool) return;            // too strong; the pool stops here
          pool -= hp;
          if (rider) {
            Events.push(b, 'condition_add', {
              targetId: tid, condition: rider.condition, source: name,
              endsOn: 'duration', rounds: durationRoundsOf(spell),
            }, t.name + ' succumbs to ' + name + '.');
          }
        });
        handled = true;
        return;
      }

      if (e.kind === 'hp_threshold') {
        /* Power Word Kill and its kin: it works, or it does not, on a hit
           point count alone. No save, no roll. */
        targets.forEach(function (tid) {
          var t = actor(state, tid);
          if (!t) return;
          if ((t.runtime.hp || 0) > e.threshold) {
            b.beats.push(t.name + ' is too strong for ' + name + '; nothing happens.');
            return;
          }
          if (e.effect === 'death' || e.condition === 'dead') {
            Events.push(b, 'death', { actorId: tid }, t.name + ' simply stops.');
          } else if (e.condition) {
            Events.push(b, 'condition_add', {
              targetId: tid, condition: e.condition, source: name,
              endsOn: 'duration', rounds: durationRoundsOf(spell),
            }, t.name + ' is ' + e.condition + '.');
          }
        });
        handled = true;
        return;
      }

      if (e.kind === 'condition') {
        /* A rider on a save is applied by the save branch, which rolls first.
           A condition with no save of its own lands outright. */
        if (effects.some(function (x) { return x.kind === 'save' || x.kind === 'hp_pool'; })) {
          handled = true;
          return;
        }
        targets.forEach(function (tid) {
          var t = actor(state, tid);
          if (!t) return;
          Events.push(b, 'condition_add', {
            targetId: tid, condition: e.condition, source: name,
            endsOn: e.escapeAbility ? 'save' : 'duration',
            saveAbility: e.escapeAbility || null,
            saveDc: (d && d.spellcasting && d.spellcasting.dc) || null,
            rounds: durationRoundsOf(spell),
          }, t.name + ' is ' + e.condition + '.');
        });
        handled = true;
        return;
      }

      if (e.kind === 'modifier') {
        targets.forEach(function (tid) {
          var t = actor(state, tid);
          if (!t) return;
          Events.push(b, 'effect_add', {
            targetId: tid, actorId: command.actorId,
            effect: {
              id: 'eff_' + spellId + '_' + tid, name: name, targetId: tid,
              /* `sign: -1` is how Bane is written. Dropping it turned every
                 penalty into a bonus, so Bane HELPED the creature it was cast
                 on. A negative modifier is a disadvantage-shaped die, not a
                 bonus one. */
              kind: (e.sign < 0) ? 'penalty_dice' : 'bonus_dice',
              appliesTo: e.appliesTo, dice: e.die, sign: e.sign || 1,
              spellId: spellId,
              concentrationId: concentrating ? command.actorId : null,
            },
          }, t.name + ' is touched by ' + name + '.');
        });
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
    var sc = (d && d.spellcasting) || {};
    /* Cantrips are not "prepared" and were therefore never offered, so the one
       thing a caster can do every single round without spending anything was
       missing from the action bar entirely. They come first: at low levels a
       cantrip IS the caster's attack. */
    var known = (sc.cantripsKnown || []).concat(sc.available || sc.prepared || []);
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

    /* Rituals: ten extra minutes, no spell slot, and only for a class that
       actually has the Ritual Casting feature. A wizard rituals from the
       SPELLBOOK and needs nothing prepared; everyone else works from what they
       have prepared or know. This used to test `sc.ritualCasting`, a field
       that does not exist — so the check was vacuously true and a paladin, who
       has no ritual casting at all in 2014, was offered rituals. */
    if (sc.ritual && !(state.combat && state.combat.active)) {
      (sc.ritualFrom || []).slice(0, 24).forEach(function (spellId) {
        var spell = SPELLS && SPELLS[spellId];
        if (!spell || !spell.ritual) return;
        moves.push(mv('ritual_cast', 'Cast ' + (spell.name || spellId) + ' as a ritual',
          'ten minutes', { spellId: spellId }, 'costs no spell slot'));
      });
    }
    if (a.runtime && a.runtime.concentratingOn) {
      moves.push(mv('dismiss_concentration', 'Let the spell go', 'free'));
    }

    /* Counterspell is a reaction taken on somebody else's turn. It belongs in
       the bar whenever the reaction is unspent and there is an enemy caster to
       use it against — offering it only at the instant of casting meant it was
       never offered at all. */
    if (known.indexOf('counterspell') >= 0 && canReact(a)) {
      Object.keys(state.actors || {}).forEach(function (id) {
        var o = state.actors[id];
        if (!o || o.side === a.side || !o.runtime || o.runtime.dead) return;
        if (!perceives(state, actorId, id)) return;
        var theirs = derivedOf(state, id);
        if (!theirs || !theirs.spellcasting) return;
        moves.push(mv('counterspell', 'Ready counterspell against ' + (o.name || id), 'reaction',
          { spellId: 'counterspell', targetIds: [id] },
          'spent when they cast, not now'));
      });
    }
    return moves;
  };

  function canReact(a) {
    var t = a && a.runtime && a.runtime.turn;
    return !t || t.reaction !== false;
  }

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
    { re: /\b(?:cut|tie|pick|rig|wedge|jam|fiddle|palm|pocket)\b/i, skill: 'sleightOfHand' },
    { re: /\b(?:sneak|creep|hide|quietly|unseen)\b/i, skill: 'stealth' },
    { re: /\b(?:remember|recall|recognise|recognize|identify|know)\b/i, skill: 'history' },
    { re: /\b(?:pray|holy|blessed|divine|rite|ritual)\b/i, skill: 'religion' },
    { re: /\b(?:track|weather|forage|camp|trail)\b/i, skill: 'survival' },
    { re: /\b(?:calm|soothe|handle|horse|animal|dog)\b/i, skill: 'animalHandling' },
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
