/*
 * preview.js — "here is what you just asked for, in D&D terms".
 *
 * A player types "I swing at the one on the left" and the engine turns that
 * into a command. Until now it was applied immediately: the dice were rolled,
 * the action was spent, and the first the player heard of how their sentence
 * had been read was the narration afterwards. When the model read it wrongly —
 * and it does — the turn was already gone.
 *
 * So this says, before anything is committed: this is the action you are
 * taking, this is what it costs you, these are the dice that are about to be
 * rolled, and this is what it will spend. It is a translation, not a
 * prediction: no roll is made here and no state is touched.
 *
 * Everything below is read from the same places the resolvers read, so what it
 * promises and what happens cannot drift. Where it genuinely cannot know
 * something — an improvised action the DM will adjudicate — it says so rather
 * than inventing a number.
 */
(function (global) {
  'use strict';

  function mod(n) { return (n >= 0 ? '+' : '') + n; }

  function dep(name) {
    if (global.DND && global.DND[name]) return global.DND[name];
    return null;
  }
  function req(path) {
    if (typeof require === 'undefined') return null;
    try { return require(path); } catch (e) { return null; }
  }
  function Combat() { return dep('Combat') || req('./combat.js'); }
  function Dispatch() { return dep('Dispatch') || req('./dispatch.js'); }
  function Spells() { return dep('Data') || req('../data/srd_spells.js'); }

  function spellTable() {
    var S = Spells();
    if (!S) return {};
    return S.SPELLS || S.spells || S;
  }

  function actorName(state, id) {
    var a = state.actors && state.actors[id];
    return (a && a.name) || id;
  }

  /* The cost words the action bar already uses, in a sentence a player reads
     rather than a token. */
  var COST_TEXT = {
    action: 'your action',
    bonus: 'your bonus action',
    reaction: 'your reaction',
    movement: 'movement',
    object: 'your free object interaction',
    free: 'nothing — it is free',
    'a moment': 'a moment of talk',
    time: 'time, out of combat',
    hours: 'hours of travel',
    'an hour': 'an hour',
    'eight hours': 'eight hours',
    'ten minutes': 'ten minutes',
  };

  /**
   * Find the legal move this command corresponds to, which is where the cost
   * and any warning already live. Matching on verb plus target rather than on
   * identity, because the command was rebuilt by the referee and is not the
   * same object the move list handed out.
   */
  function matchingMove(state, actorId, command, ctx) {
    var D = Dispatch();
    if (!D || !D.legalMoves) return null;
    var moves = [];
    try { moves = D.legalMoves(state, actorId, ctx || {}) || []; } catch (e) { return null; }
    var step = command.primary || {};
    var want = String(step.verb || '');
    var wantTarget = (step.targetIds || [])[0] || null;

    var sameVerb = moves.filter(function (m) { return m.step.verb === want; });
    if (!sameVerb.length) return null;
    if (!wantTarget) return sameVerb[0];
    return sameVerb.filter(function (m) {
      return (m.step.targetIds || [])[0] === wantTarget;
    })[0] || sameVerb[0];
  }

  /* ------------------------------------------------------------- rolls --- */

  function attackRolls(state, actorId, command, out) {
    var C = Combat();
    if (!C || !C.profileFor) return;
    var step = command.primary || {};
    var profile = null;
    try {
      profile = C.profileFor(state, actorId, {
        unarmed: step.verb === 'unarmed_strike',
        offHand: step.verb === 'two_weapon_attack',
      });
    } catch (e) { profile = null; }
    if (!profile) return;

    var targetId = (step.targetIds || [])[0];
    var against = targetId ? ' against ' + actorName(state, targetId) + '\u2019s Armour Class' : '';
    out.rolls.push({
      what: 'Attack roll',
      detail: 'd20 ' + mod(profile.toHit || 0) + ' with your ' +
        (profile.name || 'weapon') + against,
    });
    out.rolls.push({
      what: 'Damage, on a hit',
      detail: (profile.damage || '?') + ' ' + (profile.damageType || '') + ' damage',
    });

    var a = state.actors[actorId];
    var perAction = (a && a.derivedCache && a.derivedCache.attacksPerAction) || 1;
    if (step.verb === 'attack' && perAction > 1) {
      out.notes.push('Extra Attack: this action is ' + perAction + ' attacks, not one.');
    }
    if (profile.proficient === false) {
      out.notes.push('You are not proficient with the ' + (profile.name || 'weapon') +
        ', so your proficiency bonus does not apply.');
    }
  }

  function spellRolls(state, actorId, command, out) {
    var step = command.primary || {};
    var spell = spellTable()[step.spellId];
    if (!spell) {
      out.summary = 'Cast ' + (step.spellId || 'a spell');
      return;
    }
    var a = state.actors[actorId];
    var sc = (a && a.derivedCache && a.derivedCache.spellcasting) || {};
    var level = step.slotLevel != null ? step.slotLevel : spell.level;

    out.summary = 'Cast ' + (spell.name || step.spellId) +
      (step.targetIds && step.targetIds.length
        ? ' at ' + step.targetIds.map(function (id) { return actorName(state, id); }).join(' and ')
        : '');

    if (spell.level > 0) {
      var pact = sc.pactSlots;
      var usingPact = pact && pact.max && !(sc.slotsMax && sc.slotsMax[level]);
      out.spends.push(usingPact
        ? 'a Pact Magic slot (level ' + pact.level + ')'
        : 'a level ' + level + ' spell slot');
      if (level > spell.level) {
        out.notes.push('Cast at level ' + level + ', above its own level of ' + spell.level + '.');
      }
    } else {
      out.notes.push('A cantrip \u2014 it costs no slot.');
    }

    (((spell.mech || {}).effects) || []).forEach(function (e) {
      if (e.kind === 'attack') {
        out.rolls.push({
          what: 'Spell attack' + (e.count > 1 ? ' \u00d7 ' + e.count : ''),
          detail: 'd20 ' + mod(sc.attackBonus || 0) + ' against their Armour Class',
        });
        (e.damage || []).forEach(function (d) {
          out.rolls.push({ what: 'Damage, on a hit', detail: d.dice + ' ' + (d.type || '') });
        });
      } else if (e.kind === 'save') {
        out.rolls.push({
          what: 'Saving throw — they roll, not you',
          detail: (e.ability || '').toUpperCase() + ' save against your spell save DC ' +
            (sc.dc || '?') +
            (e.saveEffect === 'half' ? ', half damage on a success'
              : e.saveEffect === 'negates' ? ', nothing on a success' : ''),
        });
        (e.damage || []).forEach(function (d) {
          out.rolls.push({ what: 'Damage', detail: d.dice + ' ' + (d.type || '') });
        });
      } else if (e.kind === 'heal') {
        out.rolls.push({ what: 'Healing', detail: (e.dice || '') + (e.bonus ? ' + ' + e.bonus : '') });
      } else if (e.kind === 'area') {
        out.notes.push('An area effect: a ' + (e.size || '?') + '-foot ' + (e.shape || 'burst') +
          ' — it catches everyone standing in it, including your own people.');
      }
    });

    if ((spell.mech || {}).concentration) {
      out.notes.push('Concentration: casting this ends any other spell you are concentrating on.');
    }
    var comps = (spell.mech || {}).components;
    if (comps && comps.costGp > 0) {
      out.spends.push(comps.m + (comps.consumed ? ' (consumed)' : ''));
    }
  }

  function checkRolls(state, actorId, command, out) {
    var step = command.primary || {};
    var skillish = {
      persuade: 'Persuasion', deceive: 'Deception', intimidate: 'Intimidation',
      perform: 'Performance', insight: 'Insight', search: 'Perception',
      perceive: 'Perception', investigate: 'Investigation', track: 'Survival',
      forage: 'Survival', hide: 'Stealth', unlock: 'Sleight of Hand',
      disarm_trap: 'Sleight of Hand', stabilise: 'Medicine',
    };
    var skill = skillish[step.verb];
    if (!skill) return;
    var a = state.actors[actorId];
    var key = skill.toLowerCase().replace(/\s+/g, '');
    var sk = (a && a.derivedCache && a.derivedCache.skills) || {};
    var entry = sk[key] || sk[skill.toLowerCase()];
    out.rolls.push({
      what: skill + ' check',
      detail: 'd20 ' + (entry ? mod(entry.mod) : '') +
        (step.verb === 'stabilise' ? ' against DC 10' : ' against a DC the DM sets'),
    });
  }

  function contestRolls(state, actorId, command, out) {
    var step = command.primary || {};
    if (step.verb !== 'grapple' && step.verb !== 'shove' && step.verb !== 'escape_grapple') return;
    out.rolls.push({
      what: 'Contested check',
      detail: 'your Athletics against their Athletics or Acrobatics \u2014 ' +
        'a contest, not an attack roll',
    });
  }

  /* --------------------------------------------------------------- api --- */

  /**
   * Translate a command into what a player would want to be told before
   * agreeing to it.
   */
  function forCommand(state, actorId, command, ctx) {
    var out = {
      summary: '',
      cost: null,
      rolls: [],
      spends: [],
      notes: [],
      warnings: [],
      family: command && command.family,
      verb: (command && command.primary && command.primary.verb) || null,
      utterance: (command && command.utterance) || '',
      unknown: false,
    };
    if (!state || !command || !command.primary) {
      out.summary = 'Nothing the engine could read.';
      out.unknown = true;
      return out;
    }

    var step = command.primary;
    var move = matchingMove(state, actorId, command, ctx);

    /* The label the action bar would have used, which is already written for a
       player rather than for a log. */
    out.summary = (move && move.what) ||
      String(step.verb || '').replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
    if (move && move.warn) out.warnings.push(move.warn);
    var costKey = move && move.cost;
    out.cost = costKey ? (COST_TEXT[costKey] || costKey) : null;

    if (command.family === 'combat') {
      if (step.verb === 'attack' || step.verb === 'unarmed_strike' ||
          step.verb === 'two_weapon_attack' || step.verb === 'opportunity_attack') {
        attackRolls(state, actorId, command, out);
      }
      contestRolls(state, actorId, command, out);
      checkRolls(state, actorId, command, out);
    } else if (command.family === 'spell') {
      spellRolls(state, actorId, command, out);
    } else if (command.family === 'movement') {
      var path = step.path || [];
      if (path.length > 1) {
        out.notes.push('Moving ' + ((path.length - 1) * 5) + ' feet.');
      }
    } else {
      checkRolls(state, actorId, command, out);
    }

    if (command.family === 'improvised' || step.verb === 'improvise') {
      out.unknown = true;
      out.notes.push('The engine has no rule for this, so the Dungeon Master will ' +
        'decide what it takes and what it costs.');
    }

    if (!out.rolls.length && !out.unknown && command.family !== 'social') {
      out.notes.push('No dice for this one.');
    }
    return out;
  }

  var api = { forCommand: forCommand, COST_TEXT: COST_TEXT };

  global.DND = global.DND || {};
  global.DND.Preview = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
