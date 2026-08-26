/*
 * schema.js — the referee's output shapes.
 *
 * Two ideas do all the work here.
 *
 * First: classify, then use a SMALL schema. Asking a 1.7B model to fill twenty
 * fields covering every possible action produces confident nonsense. Asking it
 * "which of eight kinds of thing is this?" and then filling five fields for
 * that kind produces something usable.
 *
 * Second: every id field is an enum built LIVE from the observation. Ollama's
 * constrained decoding then makes an illegal answer physically impossible to
 * emit — the model cannot target a creature that is hidden, cast a spell it
 * does not know, or use an item it is not carrying, because those tokens are
 * not in the grammar. This is far stronger than validating afterwards, and it
 * is the reason the enums are rebuilt every turn rather than cached.
 */
(function (global) {
  'use strict';

  var Command = (global.DND && global.DND.Command) ||
    (typeof require !== 'undefined' ? require('../engine/command.js') : null);

  /* Difficulty is expressed as a BAND, never a number. The model is being
     asked "how hard does this feel?", which is a narrative judgement it is
     good at; the engine turns the band into a DC, which is a rules decision it
     is not. */
  var BANDS = ['trivial', 'easy', 'medium', 'hard', 'very_hard', 'nearly_impossible'];

  var APPROACHES = ['earnest', 'flattering', 'threatening', 'deceptive', 'logical', 'emotional', 'pleading'];
  var TRUTHFULNESS = ['true', 'misleading', 'false'];
  var AUDIENCES = ['private', 'party', 'public'];

  /* --------------------------------------------------------- classifier --- */

  /**
   * Stage one: what KIND of thing is the player trying to do?
   * Three fields. Deliberately tiny — this call has to be nearly free and
   * nearly always right, because everything downstream depends on it.
   */
  function classifierSchema() {
    return {
      type: 'object',
      properties: {
        family: { type: 'string', enum: Command.FAMILIES },
        compound: { type: 'boolean' },
        ambiguous: { type: 'boolean' },
      },
      required: ['family', 'compound', 'ambiguous'],
    };
  }

  /* ------------------------------------------------------ family schemas --- */

  function withEmpty(ids) {
    /* An explicit empty string has to be a member, or a constrained model with
       nothing sensible to say will pick a wrong id rather than none. */
    var out = (ids || []).slice();
    if (out.indexOf('') < 0) out.push('');
    return out;
  }

  /**
   * Build the schema for one family against the current legal options.
   *
   * @param {string} family
   * @param {object} opts  { targetIds, allyIds, spellIds, itemIds, landmarkIds, skills }
   */
  function stepSchema(family, opts) {
    opts = opts || {};
    var verbs = Command.VERBS[family] || Command.ALL_VERBS;
    var targets = withEmpty(opts.targetIds);
    var props = {
      verb: { type: 'string', enum: verbs },
    };
    var required = ['verb'];

    switch (family) {
      case 'combat':
        props.target = { type: 'string', enum: targets };
        props.twoHanded = { type: 'boolean' };
        required.push('target');
        break;

      case 'movement':
        props.destination = { type: 'string', enum: withEmpty(opts.landmarkIds) };
        props.towardTarget = { type: 'string', enum: targets };
        break;

      case 'spell':
        props.spell = { type: 'string', enum: withEmpty(opts.spellIds) };
        props.target = { type: 'string', enum: targets };
        /* Slot level is bounded by what the caster actually has available, so
           a model cannot upcast into a slot that does not exist. */
        props.slotLevel = { type: 'integer', minimum: 0, maximum: opts.maxSlot || 9 };
        required.push('spell');
        break;

      case 'item':
        props.item = { type: 'string', enum: withEmpty(opts.itemIds) };
        props.target = { type: 'string', enum: targets };
        required.push('item');
        break;

      case 'social':
        props.target = { type: 'string', enum: targets };
        props.proposition = { type: 'string' };
        props.approach = { type: 'string', enum: APPROACHES };
        props.truthfulness = { type: 'string', enum: TRUTHFULNESS };
        props.audience = { type: 'string', enum: AUDIENCES };
        props.leverage = { type: 'string' };
        required.push('target', 'proposition', 'approach', 'truthfulness');
        break;

      case 'exploration':
        props.target = { type: 'string', enum: targets };
        props.focus = { type: 'string' };
        break;

      case 'improvised':
        props.desiredOutcome = { type: 'string' };
        props.method = { type: 'string' };
        props.objectsUsed = { type: 'array', items: { type: 'string' } };
        required.push('desiredOutcome', 'method');
        break;

      case 'meta':
      default:
        break;
    }

    /* The referee MAY suggest how to adjudicate. The engine treats this as a
       hint and clamps it — the model is good at "this feels like Athletics and
       it feels hard", and bad at knowing that hard means 20. */
    props.suggestedSkill = { type: 'string', enum: withEmpty(opts.skills || []) };
    props.suggestedDifficulty = { type: 'string', enum: withEmpty(BANDS) };

    return { type: 'object', properties: props, required: required };
  }

  /**
   * The full referee schema for a turn: one step, an optional follow-up, and
   * the escape hatches.
   *
   * `needsClarification` exists so that a genuinely ambiguous request produces
   * a question rather than a coin-flip. Two plausible readings resolved
   * silently is worse than one honest "which door?".
   */
  function refereeSchema(family, opts) {
    opts = opts || {};
    var step = stepSchema(family, opts);
    var props = {
      primary: step,
      goal: { type: 'string' },
      needsClarification: { type: 'boolean' },
      clarificationQuestion: { type: 'string' },
    };
    if (opts.allowFollowUp !== false) {
      /* A follow-up may be a different family — "drink the potion, then charge
         the ogre" is two families in one sentence and is completely normal. */
      props.followUp = stepSchema(opts.followUpFamily || family, opts);
      props.hasFollowUp = { type: 'boolean' };
    }
    if (opts.allowCondition !== false) {
      props.condition = { type: 'string' };
    }
    return {
      type: 'object',
      properties: props,
      required: ['primary', 'needsClarification'],
    };
  }

  /* -------------------------------------------------- observation -> enums -- */

  /**
   * Derive every enum from an observation.
   *
   * This is the single most important function for leak-safety: the target
   * list comes from what the actor can PERCEIVE, so an invisible or hidden
   * creature is not merely forbidden, it is unrepresentable.
   */
  function optionsFrom(observation, derived, opts) {
    opts = opts || {};
    var targetIds = (observation.targetableIds || []).slice();
    var allyIds = [], enemyIds = [], neutralIds = [];
    Object.keys(observation.actors || {}).forEach(function (id) {
      var a = observation.actors[id];
      /* Three buckets, not two. Lumping neutrals in with enemies broke "it" —
         a pronoun means the only *hostile* thing in the room, and a frightened
         villager standing nearby should not make that ambiguous. */
      if (a.side === 'party' || a.side === 'ally') allyIds.push(id);
      else if (a.side === 'enemy') enemyIds.push(id);
      else neutralIds.push(id);
    });

    var spellIds = [];
    if (derived && derived.spellcasting) {
      spellIds = (derived.spellcasting.available || derived.spellcasting.prepared || []).slice();
    }
    var itemIds = [];
    if (derived && derived.inventory) {
      itemIds = derived.inventory.map(function (i) { return i.uid || i.id; });
    }

    return {
      targetIds: targetIds,
      allyIds: allyIds,
      enemyIds: enemyIds,
      neutralIds: neutralIds,
      spellIds: spellIds,
      itemIds: itemIds,
      landmarkIds: opts.landmarkIds || [],
      skills: opts.skills || [],
      maxSlot: (derived && derived.spellcasting && derived.spellcasting.highestSlot) || 9,
      allowFollowUp: opts.allowFollowUp !== false,
      allowCondition: opts.allowCondition !== false,
      followUpFamily: opts.followUpFamily,
    };
  }

  /* -------------------------------------------------- raw -> GameCommand --- */

  /**
   * Convert validated referee output into a step. Anything the model got
   * wrong-but-legal is caught here rather than downstream: an id that is not
   * in the option list is dropped, not passed on.
   */
  function toStep(raw, family, options) {
    if (!raw || !raw.verb) return null;
    var opts = options || {};
    function legal(value, list) {
      if (!value) return null;
      return (list || []).indexOf(value) >= 0 ? value : null;
    }
    var targetId = legal(raw.target, opts.targetIds);
    var step = Command.makeStep({
      verb: raw.verb,
      targetIds: targetId ? [targetId] : [],
      spellId: legal(raw.spell, opts.spellIds),
      itemId: legal(raw.item, opts.itemIds),
      slotLevel: typeof raw.slotLevel === 'number' ? raw.slotLevel : null,
      suggestion: (raw.suggestedSkill || raw.suggestedDifficulty) ? {
        skill: legal(raw.suggestedSkill, opts.skills),
        difficulty: BANDS.indexOf(raw.suggestedDifficulty) >= 0 ? raw.suggestedDifficulty : null,
      } : null,
    });
    if (family === 'social') {
      step.social = Command.makeSocial({
        proposition: raw.proposition || '',
        goal: raw.goal || '',
        approach: APPROACHES.indexOf(raw.approach) >= 0 ? raw.approach : 'earnest',
        leverage: raw.leverage || '',
        truthfulness: TRUTHFULNESS.indexOf(raw.truthfulness) >= 0 ? raw.truthfulness : 'true',
        audience: AUDIENCES.indexOf(raw.audience) >= 0 ? raw.audience : 'private',
      });
    }
    if (family === 'improvised') {
      step.improvised = Command.makeImprovised({
        desiredOutcome: raw.desiredOutcome || '',
        method: raw.method || '',
        objectsUsed: Array.isArray(raw.objectsUsed) ? raw.objectsUsed : [],
      });
    }
    if (family === 'movement' && raw.destination) step.note = raw.destination;
    if (family === 'exploration' && raw.focus) step.note = raw.focus;
    return step;
  }

  /**
   * Semantic validation, which constrained decoding cannot do for us.
   * Syntactically legal is not the same as sensible: a model will happily
   * choose a real spell it has no slot for, or attack an ally.
   */
  function validateSemantics(raw, family, options) {
    var errors = [];
    if (!raw) return ['no output'];
    if (raw.needsClarification && !raw.clarificationQuestion) {
      errors.push('asked to clarify but gave no question');
    }
    if (raw.needsClarification) return errors;
    if (!raw.primary || !raw.primary.verb) { errors.push('no primary verb'); return errors; }

    var p = raw.primary;
    if (p.target && (options.targetIds || []).indexOf(p.target) < 0) {
      errors.push('target "' + p.target + '" is not perceivable');
    }
    if (p.spell && (options.spellIds || []).indexOf(p.spell) < 0) {
      errors.push('spell "' + p.spell + '" is not available to this character');
    }
    if (p.item && (options.itemIds || []).indexOf(p.item) < 0) {
      errors.push('item "' + p.item + '" is not carried');
    }
    if (p.verb === 'cast' && !p.spell) errors.push('cast with no spell chosen');
    if (p.verb === 'attack' && !p.target) errors.push('attack with no target chosen');
    if (typeof p.slotLevel === 'number' && p.slotLevel > (options.maxSlot || 9)) {
      errors.push('slot level ' + p.slotLevel + ' exceeds the highest available');
    }
    return errors;
  }

  var api = {
    BANDS: BANDS,
    APPROACHES: APPROACHES,
    TRUTHFULNESS: TRUTHFULNESS,
    AUDIENCES: AUDIENCES,
    classifierSchema: classifierSchema,
    stepSchema: stepSchema,
    refereeSchema: refereeSchema,
    optionsFrom: optionsFrom,
    toStep: toStep,
    validateSemantics: validateSemantics,
  };

  global.DND = global.DND || {};
  global.DND.Schema = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
