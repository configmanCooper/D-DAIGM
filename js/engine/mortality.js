/*
 * mortality.js — what happens when someone dies.
 *
 * 5e is specific about dying and almost silent about what a table does
 * afterwards, because that part is a social contract rather than a rule. So
 * the mechanics here follow the book exactly, and the *consequences* are a
 * campaign setting the player chooses at the start:
 *
 *   heroic       nobody dies by accident. A character who would die is
 *                stabilised at 0 instead. Death only happens if the table
 *                deliberately chooses it.
 *   standard     the book, as written. Death is real, resurrection magic
 *                works, and a character who cannot be brought back is
 *                replaced by a new one the party meets.
 *   gritty       the book, plus no replacement. If you die and cannot be
 *                raised, that seat is empty for good.
 *   ironman      one death ends the campaign. Nothing is raised, nothing is
 *                replaced, and the session is over.
 *
 * The book parts, for reference and because the engine enforces them:
 *   - 0 hit points is unconscious and dying, not dead
 *   - three failed death saves is dead; a natural 20 is 1 hit point and awake
 *   - damage at 0 causes a failure, two on a critical
 *   - damage whose overflow past 0 meets or beats your maximum kills outright
 *   - Revivify: within 1 minute, needs 300gp of diamond, returns you at 1 hp
 *   - Raise Dead: within 10 days, 500gp diamond, and you take a cumulative
 *     penalty that wears off over several long rests
 *   - Resurrection (100 years, 1000gp) and True Resurrection (200 years,
 *     25000gp) exist and are handled the same way
 *   - Gentle Repose adds ten days to the window it is cast within
 */
(function (global) {
  'use strict';

  function req(p) { return typeof require !== 'undefined' ? require(p) : null; }
  var Events = (global.DND && global.DND.Events) || req('./events.js');
  var Chargen = (global.DND && global.DND.Chargen) || req('../gen/chargen.js');
  var Character = (global.DND && global.DND.Character) || req('./character.js');
  var RNG = (global.DND && global.DND.RNG) || (req('../rng.js') || {}).RNG;

  var POLICIES = {
    heroic: {
      id: 'heroic',
      name: 'Heroic',
      blurb: 'Nobody dies by bad luck. A character who would die is left stable at 0 hit points instead. ' +
        'Fights still hurt and still have stakes \u2014 they just do not end a story by accident.',
      allowDeath: false,
      allowRaise: true,
      replaceOnDeath: 'auto',
      endOnPartyWipe: false,
      note: 'Best for a first campaign, or a table that is here for the story.',
    },
    standard: {
      id: 'standard',
      name: 'Standard',
      blurb: 'The rules as written. Death saves are real and death is real, but resurrection magic works, ' +
        'and a character who cannot be brought back is replaced by someone new the party meets.',
      allowDeath: true,
      allowRaise: true,
      replaceOnDeath: 'offer',
      endOnPartyWipe: false,
      note: 'How most tables actually play.',
    },
    gritty: {
      id: 'gritty',
      name: 'Gritty',
      blurb: 'Death is real and permanent unless someone spends the diamonds. A character who dies for good ' +
        'is gone \u2014 that seat stays empty, and the party is smaller for it.',
      allowDeath: true,
      allowRaise: true,
      replaceOnDeath: 'never',
      endOnPartyWipe: true,
      note: 'For a table that wants losses to cost something.',
    },
    ironman: {
      id: 'ironman',
      name: 'Ironman',
      blurb: 'One death ends the campaign. No raising, no replacements, no second chances. ' +
        'The export is written and the story stops where it stopped.',
      allowDeath: true,
      allowRaise: false,
      replaceOnDeath: 'never',
      endOnPartyWipe: true,
      endOnAnyPlayerDeath: true,
      note: 'Every decision matters. Most campaigns do not survive their first bad round.',
    },
  };

  /* The SRD resurrection ladder, in the order a party would reach for it. */
  var RAISE_SPELLS = [
    {
      id: 'revivify', name: 'Revivify', level: 3,
      windowMinutes: 1,
      material: 'diamonds worth 300 gp', costGp: 300,
      returnsAt: 'one hit point',
      penalty: null,
      text: 'Only within a minute of death, and it does not regrow missing parts.',
    },
    {
      id: 'raise-dead', name: 'Raise Dead', level: 5,
      windowMinutes: 60 * 24 * 10,
      material: 'a diamond worth 500 gp', costGp: 500,
      returnsAt: 'one hit point',
      penalty: { kind: 'raise_dead_penalty', magnitude: -4, wearsOffPerLongRest: 1 },
      text: 'The body must be whole. You return weakened, and it wears off over several long rests.',
    },
    {
      id: 'resurrection', name: 'Resurrection', level: 7,
      windowMinutes: 60 * 24 * 365 * 100,
      material: 'a diamond worth 1,000 gp', costGp: 1000,
      returnsAt: 'full health',
      penalty: { kind: 'raise_dead_penalty', magnitude: -4, wearsOffPerLongRest: 1 },
      text: 'Restores the body as it goes. The caster is exhausted afterwards.',
    },
    {
      id: 'true-resurrection', name: 'True Resurrection', level: 9,
      windowMinutes: 60 * 24 * 365 * 200,
      material: 'holy water and diamonds worth 25,000 gp', costGp: 25000,
      returnsAt: 'full health',
      penalty: null,
      text: 'Needs no body at all, only the name.',
    },
  ];

  function policy(state) {
    var id = (state && state.meta && state.meta.deathPolicy) || 'standard';
    return POLICIES[id] || POLICIES.standard;
  }

  /**
   * Is this someone whose death is a story event?
   *
   * Only the party and named NPCs get the resurrection conversation. Offering
   * to raise an ogre with 300 gp of diamond is both absurd and noise in the
   * log \u2014 a playtest printed exactly that.
   */
  function matters(state, actorId) {
    var a = state.actors && state.actors[actorId];
    if (!a) return false;
    if (a.important) return true;
    return a.side === 'party' || a.side === 'ally';
  }

  function isPlayerCharacter(state, actorId) {
    return (state.seats || []).some(function (s) { return s.actorId === actorId; });
  }

  /* ------------------------------------------------------------- dying ---- */

  /**
   * Decide what a lethal outcome actually does, given the campaign's policy.
   *
   * Called by the combat engine wherever it is about to declare a death — from
   * three failed saves or from massive damage. Returns events, so the decision
   * is logged, replayable and undoable like anything else.
   */
  function resolveLethal(state, actorId, opts) {
    opts = opts || {};
    var p = policy(state);
    var a = state.actors[actorId];
    var name = (a && a.name) || actorId;
    var out = { events: [], beats: [], died: false, campaignOver: false };

    if (!p.allowDeath && (opts.protect !== false)) {
      /* Heroic: the blow that would have killed leaves them stable instead.
         Narrated as a near thing rather than as a rule being applied. */
      out.events.push({ kind: 'stabilise', actorId: actorId });
      out.beats.push(name + ' should not have survived that, and somehow has \u2014 down, ' +
        'and barely breathing, but alive.');
      return out;
    }

    out.died = true;
    out.events.push({ kind: 'death', actorId: actorId });
    out.beats.push(name + ' dies.');

    if (p.allowRaise && matters(state, actorId)) {
      out.events.push({
        kind: 'flag', flag: 'diedAt.' + actorId,
        value: { clock: state.clock || 0, at: new Date().toISOString() },
      });
      var soon = RAISE_SPELLS[0];
      out.beats.push('There is a window: ' + soon.name + ' would still work, but only for ' +
        'about a minute, and it needs ' + soon.material + '.');
    }

    if (isPlayerCharacter(state, actorId)) {
      if (p.endOnAnyPlayerDeath) {
        out.campaignOver = true;
        out.events.push({ kind: 'flag', flag: 'campaignOver', value: 'ironman:' + actorId });
        out.beats.push('That is the end of the campaign.');
      } else if (p.replaceOnDeath !== 'never') {
        out.events.push({ kind: 'flag', flag: 'seatNeedsCharacter.' + actorId, value: true });
      }
    }

    /* A party wipe ends things under any policy that says so \u2014 and under the
       others it is still worth saying out loud. */
    var living = Object.keys(state.actors).filter(function (id) {
      var x = state.actors[id];
      return x.side === 'party' && x.runtime && !x.runtime.dead && id !== actorId;
    });
    if (!living.length) {
      out.partyWiped = true;
      if (p.endOnPartyWipe || p.endOnAnyPlayerDeath) {
        out.campaignOver = true;
        out.events.push({ kind: 'flag', flag: 'campaignOver', value: 'party-wipe' });
        out.beats.push('The whole party is down. This is where the story ends.');
      } else {
        out.beats.push('Everyone is down. Whatever happens next does not happen to them.');
      }
    }
    return out;
  }

  /* -------------------------------------------------------- raising ------- */

  /** Which resurrection options are still open for this body, right now. */
  function raiseOptionsFor(state, actorId) {
    var p = policy(state);
    if (!p.allowRaise) return [];
    var a = state.actors[actorId];
    if (!a || !a.runtime || !a.runtime.dead) return [];
    var diedAt = (state.flags && state.flags['diedAt.' + actorId]) || null;
    var minutesDead = diedAt ? Math.max(0, (state.clock || 0) - (diedAt.clock || 0)) : 0;
    var repose = !!(state.flags && state.flags['gentleRepose.' + actorId]);

    return RAISE_SPELLS.map(function (s) {
      var window = s.windowMinutes + (repose ? 60 * 24 * 10 : 0);
      return {
        id: s.id, name: s.name, level: s.level,
        material: s.material, costGp: s.costGp, text: s.text,
        returnsAt: s.returnsAt,
        available: minutesDead <= window,
        minutesLeft: Math.max(0, window - minutesDead),
        why: minutesDead > window
          ? 'Too long has passed \u2014 ' + s.name + ' needed them within ' + describeWindow(s.windowMinutes) + '.'
          : '',
      };
    });
  }

  function describeWindow(minutes) {
    if (minutes <= 1) return 'a minute';
    if (minutes < 60) return minutes + ' minutes';
    if (minutes < 60 * 24) return Math.round(minutes / 60) + ' hours';
    if (minutes < 60 * 24 * 365) return Math.round(minutes / (60 * 24)) + ' days';
    return Math.round(minutes / (60 * 24 * 365)) + ' years';
  }

  /**
   * Bring someone back. The caller has already confirmed the spell was cast
   * and the material component spent; this applies the consequences.
   */
  function raise(state, actorId, spellId, opts) {
    opts = opts || {};
    var spell = RAISE_SPELLS.filter(function (s) { return s.id === spellId; })[0];
    var a = state.actors[actorId];
    if (!spell || !a) return { ok: false, error: 'unknown spell or character' };

    var options = raiseOptionsFor(state, actorId);
    var opt = options.filter(function (o) { return o.id === spellId; })[0];
    if (!opt || !opt.available) {
      return { ok: false, error: opt ? opt.why : 'that is not available' };
    }

    var name = a.name || actorId;
    var hp = spell.returnsAt === 'full health'
      ? (a.runtime.hpMax || 1)
      : 1;

    var events = [
      { kind: 'revive', actorId: actorId, hp: hp },
      { kind: 'flag', flag: 'diedAt.' + actorId, value: null },
      { kind: 'flag', flag: 'seatNeedsCharacter.' + actorId, value: false },
    ];
    var beats = [name + ' is brought back by ' + spell.name + ', at ' + spell.returnsAt + '.'];

    if (spell.penalty) {
      /* Raise Dead's penalty is a real, wearing-off mechanic, not flavour: a
         -4 on every attack roll, saving throw and ability check, reduced by 1
         on each long rest. Modelled as an effect so effects.js expires it. */
      events.push({
        kind: 'effect_add',
        effect: {
          id: 'raise-penalty-' + actorId + '-' + (state.revision || 0),
          name: 'Returned from death',
          targetId: actorId,
          kind: 'roll_penalty',
          magnitude: spell.penalty.magnitude,
          appliesTo: ['attack', 'save', 'check'],
          duration: { type: 'until_rest', value: Math.abs(spell.penalty.magnitude) },
          wearsOffPerLongRest: spell.penalty.wearsOffPerLongRest,
          tags: ['raise-dead-penalty'],
        },
      });
      beats.push('They come back diminished \u2014 a penalty to everything they try, ' +
        'wearing off a little with each long rest.');
    }
    if (opts.costGp) {
      beats.push('The component is gone: ' + spell.material + '.');
    }
    return { ok: true, events: events, beats: beats };
  }

  /* ---------------------------------------------------- replacement ------- */

  /**
   * Make the character who walks in after the funeral.
   *
   * Built at the party's current level, because a replacement two levels
   * behind is a punishment for having died, which nobody enjoys. The story of
   * how they meet is the Dungeon Master's problem; this just produces someone
   * plausible to hand it.
   */
  function makeReplacement(state, seatId, opts) {
    opts = opts || {};
    var rng = opts.rng || (state.rng ? state.rng.fork('replacement') : new RNG('replacement'));
    var seat = (state.seats || []).filter(function (s) { return s.id === seatId; })[0];

    /* Match the party, or level 1 if there is nobody left to match. */
    var levels = Object.keys(state.actors)
      .filter(function (id) {
        var a = state.actors[id];
        return a.side === 'party' && !(a.runtime && a.runtime.dead);
      })
      .map(function (id) {
        var a = state.actors[id];
        return (a.progression && a.progression.levels && a.progression.levels.length) || 1;
      });
    var level = levels.length
      ? Math.max(1, Math.round(levels.reduce(function (x, y) { return x + y; }, 0) / levels.length))
      : 1;

    var spec = Chargen.generate({
      rng: rng,
      fixed: Object.assign({ levels: level }, opts.fixed || {}),
      method: opts.method || 'array',
    });

    var layers = Character.buildFromSpec({
      name: spec.name, raceId: spec.raceId, subraceId: spec.subraceId,
      classId: spec.classId, levels: level, backgroundId: spec.backgroundId,
      abilities: spec.abilities,
      proficiencies: { skills: spec.skills },
    });
    layers.base.backstory = spec.backstory;

    return {
      seatId: seatId,
      spec: spec,
      layers: layers,
      level: level,
      /* A hook the DM can use rather than an arrival invented from nothing. */
      meeting: rng.pick([
        'They were already here, and had their own reason for it.',
        'They were looking for the person who just died.',
        'They owe someone in the party a favour nobody has mentioned yet.',
        'They were the only one who came when it was shouted for.',
        'They arrived with the bad news, and stayed.',
      ]),
    };
  }

  /** True once the campaign has been declared over. */
  function isOver(state) {
    return !!(state.flags && state.flags.campaignOver);
  }

  function describePolicy(id) {
    return POLICIES[id] || POLICIES.standard;
  }

  var api = {
    POLICIES: POLICIES,
    RAISE_SPELLS: RAISE_SPELLS,
    policy: policy,
    describePolicy: describePolicy,
    resolveLethal: resolveLethal,
    raiseOptionsFor: raiseOptionsFor,
    raise: raise,
    makeReplacement: makeReplacement,
    isOver: isOver,
    isPlayerCharacter: isPlayerCharacter, matters: matters,
    describeWindow: describeWindow,
  };

  global.DND = global.DND || {};
  global.DND.Mortality = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
