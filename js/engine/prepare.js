/**
 * prepare.js — choosing which spells a prepared caster has ready today.
 *
 * D&D 5e (2014) splits casters in two. A sorcerer or a bard *knows* a fixed
 * list and that list only changes when they level. A cleric, druid, paladin or
 * wizard *prepares* a list after a long rest, and may prepare a completely
 * different one tomorrow — that daily choice is most of what makes them
 * interesting to play.
 *
 * Until now the game only implemented the first half. A cleric was built with
 * a spell list and kept it for the entire campaign, which quietly turned every
 * prepared caster into a worse sorcerer.
 *
 * Who prepares, and how many:
 *
 *   cleric, druid    ability modifier + class level        (from the whole class list)
 *   paladin          ability modifier + half class level   (from the whole class list)
 *   wizard           ability modifier + class level        (from their spellbook only)
 *
 * Always at least one. Cantrips are never prepared — they are always ready.
 *
 * As everywhere else in this engine, the rules are computed here and the
 * choice can be made by a person or handed to `autoChoose`.
 */
(function (global) {
  'use strict';

  function req(path) { return typeof require !== 'undefined' ? require(path) : null; }
  var Character = (global.DND && global.DND.Character) || req('./character.js');
  var Events = (global.DND && global.DND.Events) || req('./events.js');

  /* Half-casters prepare from half their level; full preparers from all of it. */
  var PREPARE_DIVISOR = { paladin: 2 };

  /* A spellbook is a wizard's own property; every other preparer draws on the
     whole class list, which is why only the wizard needs one. */
  var USES_SPELLBOOK = { wizard: true };

  var _data = null;
  function Data() {
    if (_data) return _data;
    var g = global.DND || {};
    _data = { CLASSES: g.CLASSES, SPELLS: g.SPELLS };
    if (typeof require !== 'undefined') {
      try { if (!_data.CLASSES) _data.CLASSES = require('../data/srd_classes.js').CLASSES; } catch (e) { /* optional */ }
      try { if (!_data.SPELLS) _data.SPELLS = require('../data/srd_spells.js').SPELLS; } catch (e) { /* optional */ }
    }
    _data.CLASSES = _data.CLASSES || {};
    _data.SPELLS = _data.SPELLS || {};
    return _data;
  }

  /**
   * Does this character prepare spells at all, and from what?
   *
   * Returns null for anyone who does not — a fighter, a sorcerer, a level-1
   * paladin — so callers can simply skip them.
   */
  function preparationFor(base, progression, derived) {
    var D = Data();
    var classes = (base.classes || []).filter(function (c) {
      var cd = D.CLASSES[c.classId];
      if (!cd || !cd.spellcasting) return false;
      var how = cd.prepares || cd.spellcasting.prepares || cd.spellcasting.type;
      return how === 'prepared' || how === 'spellbook';
    });
    if (!classes.length) return null;

    /* Multiclassed preparers prepare separately for each class; the first is
       the one the sheet leads with, and is what the UI asks about. */
    var c = classes[0];
    var cd = D.CLASSES[c.classId];
    var levels = c.levels || 0;
    var divisor = PREPARE_DIVISOR[c.classId] || 1;
    var effective = Math.floor(levels / divisor);
    if (effective < 1) return null;      // a level-1 paladin prepares nothing

    var ability = cd.spellcasting.ability;
    var mod = (derived && derived.abilityMods && derived.abilityMods[ability]) || 0;
    var count = Math.max(1, mod + effective);

    var maxLevel = highestCastableLevel(cd, levels);
    if (maxLevel < 1) return null;

    var fromBook = !!USES_SPELLBOOK[c.classId];
    var pool = fromBook
      ? (progression.spellbook || progression.preparedSpells || []).filter(function (id) {
        var sp = D.SPELLS[id];
        return sp && sp.level > 0 && sp.level <= maxLevel;
      })
      : Object.keys(D.SPELLS).filter(function (id) {
        var sp = D.SPELLS[id];
        return sp && sp.level > 0 && sp.level <= maxLevel &&
          (sp.classes || []).indexOf(c.classId) >= 0;
      });

    return {
      classId: c.classId,
      className: cd.name || c.classId,
      count: Math.min(count, pool.length),
      limit: count,
      maxSpellLevel: maxLevel,
      ability: ability,
      source: fromBook ? 'spellbook' : 'list',
      pool: pool,
      prepared: (progression.preparedSpells || []).slice(),
    };
  }

  /**
   * The highest spell level this class can cast at this level (2014).
   * Half-casters have nothing at level 1; above that both half- and
   * third-casters behave like a full caster of half (or a third of) their level.
   */
  function highestCastableLevel(cd, classLevel) {
    var type = cd.casterType;
    if (type === 'pact') return Math.min(5, Math.ceil(Math.min(classLevel, 9) / 2));
    if (type === 'half') {
      return classLevel < 2 ? 0 : Math.min(5, Math.ceil(Math.ceil(classLevel / 2) / 2));
    }
    if (type === 'third') {
      return classLevel < 3 ? 0 : Math.min(4, Math.ceil(Math.ceil(classLevel / 3) / 2));
    }
    return Math.min(9, Math.ceil(classLevel / 2));
  }

  /**
   * Prepare a sensible list without asking anybody.
   *
   * Used by the "prepare for me" button, by AI-controlled seats, and by a long
   * rest that nobody is watching — an unattended playtest must not stall on a
   * spell menu.
   *
   * What "sensible" means here: keep what was already prepared where it is
   * still legal, because a player who chose those spells meant to have them;
   * then fill the remaining room with the most useful thing available, which
   * this engine defines honestly as "spells it can actually resolve
   * mechanically", highest level first — a prepared slate of spells that do
   * nothing is worse than a smaller one that works.
   */
  function autoChoose(plan, opts) {
    opts = opts || {};
    var D = Data();
    if (!plan) return [];

    var chosen = [];
    var seen = {};
    var keep = plan.prepared.filter(function (id) { return plan.pool.indexOf(id) >= 0; });
    keep.forEach(function (id) {
      if (chosen.length >= plan.count || seen[id]) return;
      seen[id] = true; chosen.push(id);
    });

    var rest = plan.pool.filter(function (id) { return !seen[id]; }).sort(function (a, b) {
      var sa = D.SPELLS[a], sb = D.SPELLS[b];
      var ma = sa && sa.mech ? 1 : 0, mb = sb && sb.mech ? 1 : 0;
      if (ma !== mb) return mb - ma;                       // resolvable first
      if (sa.level !== sb.level) return sb.level - sa.level; // then the biggest
      return String(sa.name).localeCompare(String(sb.name));
    });
    if (opts.rng && opts.shuffle) opts.rng.shuffle(rest);

    for (var i = 0; i < rest.length && chosen.length < plan.count; i++) {
      chosen.push(rest[i]);
    }
    return chosen;
  }

  /**
   * Is this a legal slate? Returns a list of complaints, empty when it is.
   *
   * Checked in the engine rather than trusted from the interface, because the
   * same call is made by AI seats and by anything replaying a saved game.
   */
  function validate(plan, chosen) {
    var errors = [];
    if (!plan) return ['this character does not prepare spells'];
    if (!Array.isArray(chosen)) return ['nothing was chosen'];
    if (chosen.length > plan.count) {
      errors.push('only ' + plan.count + ' spells can be prepared, not ' + chosen.length);
    }
    var seen = {};
    chosen.forEach(function (id) {
      if (plan.pool.indexOf(id) < 0) {
        errors.push('"' + id + '" cannot be prepared' +
          (plan.source === 'spellbook' ? ' — it is not in the spellbook' : ' — it is not on the class list, or is too high a level'));
      }
      if (seen[id]) errors.push('"' + id + '" was prepared twice');
      seen[id] = true;
    });
    return errors;
  }

  /**
   * The events that make a slate real. Nothing is applied here — the caller
   * commits them, so preparation is undoable and replayable like any other
   * change to the world.
   */
  function eventsFor(actorId, plan, chosen) {
    if (!plan || !chosen) return [];
    var mk = Events ? Events.makeEvent : function (kind, p) { return Object.assign({ kind: kind }, p); };
    return [mk('prepare_spells', {
      actorId: actorId,
      classId: plan.classId,
      spells: chosen.slice(),
      source: plan.source,
    })];
  }

  /**
   * A wizard's spellbook, materialised the first time anyone asks.
   *
   * Characters built before spellbooks existed carry their spells in
   * `preparedSpells` and nothing else, and a wizard with an empty book can
   * prepare nothing at all — so the book is seeded from what they already know
   * rather than leaving them mute.
   */
  function ensureSpellbook(base, progression) {
    var D = Data();
    var wiz = (base.classes || []).filter(function (c) { return USES_SPELLBOOK[c.classId]; })[0];
    if (!wiz) return null;
    if (progression.spellbook && progression.spellbook.length) return progression.spellbook;
    progression.spellbook = (progression.preparedSpells || []).filter(function (id) {
      var sp = D.SPELLS[id];
      return sp && sp.level > 0;
    });
    return progression.spellbook;
  }

  var api = {
    preparationFor: preparationFor,
    autoChoose: autoChoose,
    validate: validate,
    eventsFor: eventsFor,
    ensureSpellbook: ensureSpellbook,
    highestCastableLevel: highestCastableLevel,
  };

  global.DND = global.DND || {};
  global.DND.Prepare = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
