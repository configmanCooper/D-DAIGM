/*
 * command.js — GameCommand: the only way game state ever changes.
 *
 * Human clicks, human free text, AI player seats, companion policies and NPC
 * policies all produce one of these. There is exactly one validator and one
 * dispatcher, so an AI seat cannot reach any code path a human cannot, and a
 * human cannot reach any path the tests do not cover.
 *
 * A command is a REQUEST, not an outcome. It says what the actor is trying to
 * do. Whether it works, and what it costs, is decided by the engine in
 * events.js. Nothing here rolls a die.
 */
(function (global) {
  'use strict';

  var SCHEMA_VERSION = 1;

  /* Families exist so the referee can use a small, targeted schema per kind of
     action rather than one enormous universal one — a 1.7B model handles six
     fields with enums far better than twenty free strings. */
  var FAMILIES = [
    'combat',       // attack, grapple, shove, dodge, disengage, dash, help, hide, ready
    'movement',     // move to a square/landmark, stand, mount, climb, jump
    'spell',        // cast, upcast, concentrate, dismiss
    'item',         // use, equip, unequip, attune, drink, throw, give, drop
    'social',       // persuade, deceive, intimidate, ask, offer, refuse
    'exploration',  // search, investigate, perceive, unlock, disarm, travel, rest
    'improvised',   // the interesting one: anything the rules did not anticipate
    'meta',         // end turn, undo, pass, clarify — never narrated as fiction
  ];

  /* The verbs the engine actually knows how to resolve. The referee is
     constrained to this list by enum, so it cannot invent a mechanic. */
  var VERBS = {
    combat: ['attack', 'multiattack', 'grapple', 'shove', 'dodge', 'disengage', 'dash', 'help', 'hide',
      'ready', 'opportunity_attack', 'two_weapon_attack', 'unarmed_strike', 'escape_grapple',
      /* Steadying a dying creature. Added with the action itself; without it
         here the resolver and the action bar both knew the verb and the
         referee's enum did not, so an AI Dungeon Master could never choose it
         and a typed "I stabilise him" had nowhere to land. */
      'stabilise'],
    movement: ['move', 'stand_up', 'drop_prone', 'climb', 'swim', 'jump', 'crawl', 'mount', 'dismount'],
    spell: ['cast', 'dismiss_concentration', 'counterspell', 'ritual_cast'],
    item: ['use', 'equip', 'unequip', 'attune', 'unattune', 'drink', 'throw', 'give', 'drop', 'pick_up', 'buy', 'sell'],
    social: ['persuade', 'deceive', 'intimidate', 'perform', 'ask', 'tell', 'offer', 'refuse', 'insight'],
    exploration: ['search', 'investigate', 'perceive', 'unlock', 'disarm_trap', 'travel',
      'short_rest', 'long_rest', 'interact', 'track', 'forage', 'read'],
    improvised: ['improvise'],
    meta: ['end_turn', 'pass', 'clarify', 'undo', 'note',
      /* Amending the record. Registered here as well as in the resolver
         because VERBS is the referee's enum: a verb missing from it can be
         performed from the interface and yet never chosen by the Dungeon
         Master, which is how `stabilise` came to work from the action bar and
         nowhere else. */
      'retcon'],
  };

  var ALL_VERBS = Object.keys(VERBS).reduce(function (acc, f) { return acc.concat(VERBS[f]); }, []);

  var idCounter = 0;
  function newCommandId(prefix) {
    idCounter++;
    return (prefix || 'cmd') + '_' + Date.now().toString(36) + '_' + idCounter.toString(36);
  }

  /**
   * Build a command. Callers supply intent; this fills in the bookkeeping that
   * makes replay, idempotency and staleness detection possible.
   */
  function create(spec) {
    spec = spec || {};
    return {
      v: SCHEMA_VERSION,
      commandId: spec.commandId || newCommandId(spec.source),
      sessionId: spec.sessionId || null,
      /* Captured at build time and re-checked at commit. If the state moved on
         between a model being asked and it answering, the command is stale and
         must be discarded rather than applied to a world it never saw. */
      stateRevision: typeof spec.stateRevision === 'number' ? spec.stateRevision : null,
      turnEpoch: typeof spec.turnEpoch === 'number' ? spec.turnEpoch : null,
      at: spec.at || new Date().toISOString(),

      actorId: spec.actorId || null,
      source: spec.source || 'human',   // human | playerAI | companionPolicy | npcPolicy | system
      family: spec.family || 'meta',
      primary: spec.primary || null,
      /* Deliberately ONE optional follow-up, not an array. "Drink the potion
         then charge the ogre" is a real and common request; "do these nine
         things" is a script, and a script cannot be adjudicated a step at a
         time with the player able to react. */
      followUp: spec.followUp || null,
      condition: spec.condition || '',
      goal: spec.goal || '',
      /* The player's exact words, kept so the narrator can honour phrasing the
         schema had to throw away, and so a bad parse is diagnosable. */
      utterance: spec.utterance || '',
      needsClarification: !!spec.needsClarification,
      clarificationQuestion: spec.clarificationQuestion || '',
      /* Set by the referee when it had to guess, so the UI can offer a
         "that's not what I meant" affordance before anything is committed. */
      confidence: typeof spec.confidence === 'number' ? spec.confidence : 1,
    };
  }

  /** A step is `primary` or `followUp`: one verb plus its arguments. */
  function makeStep(spec) {
    spec = spec || {};
    return {
      verb: spec.verb || null,
      targetIds: spec.targetIds ? spec.targetIds.slice() : [],
      spellId: spec.spellId || null,
      slotLevel: typeof spec.slotLevel === 'number' ? spec.slotLevel : null,
      itemId: spec.itemId || null,
      /* Grid point for AoE origin or movement destination. */
      point: spec.point || null,
      path: spec.path || null,
      /* Social payload — a persuasion attempt is not adequately described by a
         target and a skill; what is being proposed, and with what leverage,
         changes both the DC and the NPC's reaction. */
      social: spec.social || null,
      /* Improvised payload — what they want to happen and how. The engine
         picks the check; the model only describes the attempt. */
      improvised: spec.improvised || null,
      /* The referee MAY suggest an adjudication; the engine clamps it and is
         free to ignore it entirely. It is a hint, never an authority. */
      suggestion: spec.suggestion || null,
      note: spec.note || '',
    };
  }

  function makeSocial(spec) {
    spec = spec || {};
    return {
      proposition: spec.proposition || '',
      goal: spec.goal || '',
      approach: spec.approach || 'earnest',   // earnest|flattering|threatening|deceptive|logical|emotional
      leverage: spec.leverage || '',
      truthfulness: spec.truthfulness || 'true',  // true|misleading|false
      audience: spec.audience || 'private',   // private|party|public
    };
  }

  function makeImprovised(spec) {
    spec = spec || {};
    return {
      desiredOutcome: spec.desiredOutcome || '',
      method: spec.method || '',
      objectsUsed: spec.objectsUsed ? spec.objectsUsed.slice() : [],
      resourcesRisked: spec.resourcesRisked ? spec.resourcesRisked.slice() : [],
    };
  }

  /* ------------------------------------------------------------ validate -- */

  /**
   * Structural validation: is this a well-formed command at all?
   * Semantic validation (does this actor exist, is that target visible, does
   * she know that spell) belongs to the engine, which has the state.
   */
  function validateStructure(cmd) {
    var errors = [];
    if (!cmd || typeof cmd !== 'object') return { ok: false, errors: ['not an object'] };
    if (cmd.v !== SCHEMA_VERSION) errors.push('unknown command version: ' + cmd.v);
    if (!cmd.commandId) errors.push('missing commandId');
    if (!cmd.actorId) errors.push('missing actorId');
    if (FAMILIES.indexOf(cmd.family) < 0) errors.push('unknown family: ' + cmd.family);

    if (cmd.needsClarification) {
      if (!cmd.clarificationQuestion) errors.push('clarification requested with no question');
      /* A clarification request is allowed to carry no step at all — it is a
         question, not an action. */
      return { ok: errors.length === 0, errors: errors };
    }

    if (!cmd.primary) errors.push('missing primary step');
    else errors = errors.concat(validateStep(cmd.primary, cmd.family, 'primary'));
    if (cmd.followUp) errors = errors.concat(validateStep(cmd.followUp, cmd.family, 'followUp'));

    return { ok: errors.length === 0, errors: errors };
  }

  function validateStep(step, family, label) {
    var errors = [];
    if (!step || typeof step !== 'object') return [label + ': not an object'];
    if (!step.verb) { errors.push(label + ': missing verb'); return errors; }
    if (ALL_VERBS.indexOf(step.verb) < 0) { errors.push(label + ': unknown verb ' + step.verb); return errors; }
    /* A follow-up may legitimately belong to a different family from the
       primary ("drink a potion, then attack"), so the family check applies to
       the primary step only. */
    if (label === 'primary' && VERBS[family] && VERBS[family].indexOf(step.verb) < 0) {
      errors.push(label + ': verb ' + step.verb + ' does not belong to family ' + family);
    }
    if (step.verb === 'cast' && !step.spellId) errors.push(label + ': cast with no spellId');
    if (step.verb === 'use' && !step.itemId) errors.push(label + ': use with no itemId');
    if (step.verb === 'attack' && (!step.targetIds || !step.targetIds.length)) {
      errors.push(label + ': attack with no target');
    }
    if (step.verb === 'improvise' && !step.improvised) {
      errors.push(label + ': improvise with no improvised payload');
    }
    if (step.slotLevel !== null && step.slotLevel !== undefined &&
      (step.slotLevel < 0 || step.slotLevel > 9)) {
      errors.push(label + ': slot level out of range');
    }
    return errors;
  }

  /**
   * Is this command still applicable to the state it will be committed to?
   *
   * Three distinct failures, deliberately distinguished because they need
   * different handling: a duplicate is silently fine (the click was double),
   * a stale command must be discarded and re-decided, and a wrong-turn command
   * is a bug worth surfacing.
   */
  function checkFreshness(cmd, state) {
    if (!state) return { ok: true };
    if (state.appliedCommandIds && state.appliedCommandIds[cmd.commandId]) {
      return { ok: false, reason: 'duplicate', detail: 'this command was already applied' };
    }
    if (cmd.turnEpoch !== null && typeof state.turnEpoch === 'number' && cmd.turnEpoch !== state.turnEpoch) {
      return { ok: false, reason: 'stale', detail: 'decided during turn ' + cmd.turnEpoch + ', now ' + state.turnEpoch };
    }
    if (cmd.stateRevision !== null && typeof state.revision === 'number' && cmd.stateRevision !== state.revision) {
      return { ok: false, reason: 'stale', detail: 'built against revision ' + cmd.stateRevision + ', now ' + state.revision };
    }
    return { ok: true };
  }

  /** A short human-readable form, used in logs, the journal and AI prompts. */
  function describe(cmd) {
    if (!cmd) return '(nothing)';
    if (cmd.needsClarification) return 'asks: ' + cmd.clarificationQuestion;
    var parts = [describeStep(cmd.primary)];
    if (cmd.followUp) parts.push('then ' + describeStep(cmd.followUp));
    if (cmd.condition) parts.unshift('if ' + cmd.condition + ',');
    return parts.join(' ');
  }

  function describeStep(step) {
    if (!step) return '(nothing)';
    var s = step.verb.replace(/_/g, ' ');
    if (step.spellId) s += ' ' + step.spellId + (step.slotLevel ? ' at level ' + step.slotLevel : '');
    if (step.itemId) s += ' ' + step.itemId;
    if (step.targetIds && step.targetIds.length) s += ' -> ' + step.targetIds.join(', ');
    if (step.point) s += ' @ (' + step.point.x + ',' + step.point.y + ')';
    if (step.social && step.social.proposition) s += ': "' + step.social.proposition + '"';
    if (step.improvised && step.improvised.desiredOutcome) s += ': ' + step.improvised.desiredOutcome;
    return s;
  }

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    FAMILIES: FAMILIES,
    VERBS: VERBS,
    ALL_VERBS: ALL_VERBS,
    create: create,
    makeStep: makeStep,
    makeSocial: makeSocial,
    makeImprovised: makeImprovised,
    validateStructure: validateStructure,
    checkFreshness: checkFreshness,
    describe: describe,
    describeStep: describeStep,
    newCommandId: newCommandId,
  };

  global.DND = global.DND || {};
  global.DND.Command = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
