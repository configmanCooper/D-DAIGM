/*
 * levelup.js — advancing a character, with the choices that entails.
 *
 * Levelling in 5e is not one decision, it is a small pile of them that vary by
 * class and level: how much health you gained, whether this is an ability
 * score improvement, whether a subclass is due, which new spells you know or
 * can prepare, and occasionally a fighting style. The previous build surfaced
 * an honest "not wired yet" rather than pretend, which was the right call at
 * the time and is what this file replaces.
 *
 * Every choice can be made by hand or handed to `autoChoose`, which picks what
 * the class wants. Nothing is applied until `applyLevel` returns events, so a
 * level-up can be previewed, cancelled, or undone like any other turn.
 */
(function (global) {
  'use strict';

  function req(p) { return typeof require !== 'undefined' ? require(p) : null; }
  var RNG = (global.DND && global.DND.RNG) || (req('../rng.js') || {}).RNG;
  var Dice = (global.DND && global.DND.Dice) || req('./dice.js');
  /* Resolved on use, not at load: chargen.js comes after this file in the
     page's script order, so an alias taken here is null for the whole session
     and the level-up recommendations silently vanish in the browser while
     working perfectly under Node. 	ests/ui.test.js checks that no module
     re-introduces this. */
  function chargen() {
    return (global.DND && global.DND.Chargen) ||
      (typeof require !== 'undefined' ? req('../gen/chargen.js') : null);
  }

  var _data;
  function Data() {
    if (_data) return _data;
    var g = (global.DND && global.DND.Data) || {};
    /* Merge rather than choose. Another module requiring srd_classes.js
       populates the global with CLASSES but not necessarily XP_BY_LEVEL, and
       taking the global wholesale left the experience table undefined — so
       `pendingLevel` quietly answered "no" no matter how much experience the
       character had. Fill any gap from a direct require. */
    _data = { CLASSES: g.CLASSES, SPELLS: g.SPELLS, XP_BY_LEVEL: g.XP_BY_LEVEL };
    if (typeof require !== 'undefined') {
      try { if (!_data.CLASSES) _data.CLASSES = require('../data/srd_classes.js').CLASSES; } catch (e) { /* optional */ }
      try { if (!_data.SPELLS) _data.SPELLS = require('../data/srd_spells.js').SPELLS; } catch (e) { /* optional */ }
      try { if (!_data.XP_BY_LEVEL) _data.XP_BY_LEVEL = require('../data/srd_rules.js').XP_BY_LEVEL; } catch (e) { /* optional */ }
    }
    _data.CLASSES = _data.CLASSES || {};
    _data.SPELLS = _data.SPELLS || {};
    _data.XP_BY_LEVEL = _data.XP_BY_LEVEL || [];
    return _data;
  }

  var ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  /* Ability score improvements land at these levels for every SRD class, with
     Fighter and Rogue getting extras. */
  var ASI_LEVELS = [4, 8, 12, 16, 19];
  var EXTRA_ASI = { fighter: [6, 14], rogue: [10] };

  function classLevel(progression, classId) {
    return (progression.levels || []).filter(function (l) { return l.classId === classId; }).length;
  }

  function totalLevel(progression) {
    return (progression.levels || []).length;
  }

  /** Is there enough experience for another level? */
  function pendingLevel(base, progression) {
    var D = Data();
    var table = D.XP_BY_LEVEL || [];
    /* Only characters with a class advance. A monster has an empty `classes`
       list and an empty level log, and the naive check ("0 experience is
       enough for level 1") happily levelled up every gnoll on the board. */
    if (!base || !base.classes || !base.classes.length) return null;

    var lvl = totalLevel(progression);
    if (lvl >= 20) return null;
    /* A character built with class levels but no level log is already at that
       level; there is nothing pending. */
    var declared = base.classes.reduce(function (n, c) { return n + (c.levels || 0); }, 0);
    if (lvl === 0 && declared > 0) return null;

    var need = table[lvl + 1];
    /* Milestone campaigns set `progression.levelGranted` instead of tracking
       experience, so both routes reach the same place. */
    if (progression.levelGranted && progression.levelGranted > lvl) {
      return { to: lvl + 1, reason: 'milestone' };
    }
    if (need == null) return null;
    if ((progression.xp || 0) >= need) return { to: lvl + 1, reason: 'xp', need: need };
    return null;
  }

  /**
   * Everything this level asks the player to decide.
   *
   * Returns a list of option groups; each has an `id`, a human `prompt`, a
   * `kind` the UI can render, and the legal `choices`. A level with nothing to
   * decide returns only the hit-point group, which is still a choice (roll or
   * take the average).
   */
  function optionsFor(base, progression, opts) {
    opts = opts || {};
    var D = Data();
    var classId = opts.classId || (base.classes && base.classes[0] && base.classes[0].classId);
    var cls = (D.CLASSES || {})[classId] || {};
    var newTotal = totalLevel(progression) + 1;
    var newClassLevel = classLevel(progression, classId) + 1;
    var groups = [];

    /* ------------------------------------------------------- hit points -- */
    var die = cls.hitDie || 8;
    groups.push({
      id: 'hp',
      kind: 'choice',
      prompt: 'Hit points for level ' + newTotal,
      note: 'Roll a d' + die + ', or take the fixed average. Most tables allow either; ' +
        'the average is steadier, the roll can be better or worse.',
      choices: [
        { id: 'average', label: 'Take the average (' + (Math.floor(die / 2) + 1) + ')', value: Math.floor(die / 2) + 1 },
        { id: 'roll', label: 'Roll a d' + die, value: null },
      ],
      required: true,
      recommended: 'average',
    });

    /* --------------------------------------------------------- subclass -- */
    if (cls.subclassLevel && newClassLevel === cls.subclassLevel &&
        !(progression.subclassChoices && progression.subclassChoices[classId])) {
      var subs = subclassesFor(cls);
      if (subs.length) {
        groups.push({
          id: 'subclass',
          kind: 'choice',
          prompt: 'Choose your ' + (cls.subclassLabel || 'subclass'),
          note: 'This is permanent, and shapes the rest of the class.',
          choices: subs,
          required: true,
          recommended: subs[0] && subs[0].id,
        });
      }
    }

    /* ------------------------------------------------ ability or a feat -- */
    var asiLevels = ASI_LEVELS.concat(EXTRA_ASI[classId] || []);
    if (asiLevels.indexOf(newClassLevel) >= 0) {
      groups.push({
        id: 'asi',
        kind: 'asi',
        prompt: 'Ability Score Improvement',
        note: 'Raise one ability by 2, or two abilities by 1 each. No score may exceed 20.' +
          (opts.allowFeats ? ' You may take a feat instead.' : ''),
        choices: ABIL.map(function (a) {
          var cur = currentScore(base, progression, a);
          return { id: a, label: a.toUpperCase() + ' (' + cur + ')', value: cur, atCap: cur >= 20 };
        }),
        allowFeats: !!opts.allowFeats,
        required: true,
        recommended: recommendedAsi(base, progression, classId),
      });
    }

    /* ---------------------------------------------------- fighting style -- */
    if (newClassLevel === 1 && cls.fightingStyles && !((progression.fightingStyles || []).length)) {
      groups.push({
        id: 'fightingStyle',
        kind: 'choice',
        prompt: 'Choose a fighting style',
        choices: cls.fightingStyles.map(function (s) {
          return { id: s.id || s, label: s.name || s, note: s.text || '' };
        }),
        required: true,
        recommended: (cls.fightingStyles[0] && (cls.fightingStyles[0].id || cls.fightingStyles[0])),
      });
    }

    /* ------------------------------------------------------------ spells -- */
    var spellGroup = spellChoicesFor(cls, classId, base, progression, newClassLevel);
    if (spellGroup) groups.push(spellGroup);

    /* --------------------------------------------------- what you gain --- */
    var gained = featuresAt(cls, newClassLevel);

    return {
      toLevel: newTotal,
      classId: classId,
      classLevel: newClassLevel,
      hitDie: die,
      groups: groups,
      gains: gained,
      summary: describeGains(cls, newClassLevel, gained),
    };
  }

  function subclassesFor(cls) {
    if (Array.isArray(cls.subclasses)) {
      return cls.subclasses.map(function (s) {
        return { id: s.id || s, label: s.name || s, note: s.description || s.text || '' };
      });
    }
    if (cls.subclass) {
      var s = cls.subclass;
      return [{ id: s.id || 'subclass', label: s.name || 'Subclass', note: s.description || s.text || '' }];
    }
    return [];
  }

  function featuresAt(cls, level) {
    var f = cls.features && (cls.features[level] || cls.features[String(level)]);
    if (!f) return [];
    return (Array.isArray(f) ? f : [f]).map(function (x) {
      return { name: x.name || String(x), text: x.text || '' };
    });
  }

  function describeGains(cls, level, gained) {
    if (!gained.length) return 'More hit points, and a step closer to what comes next.';
    return gained.map(function (g) { return g.name; }).join(', ') + '.';
  }

  function currentScore(base, progression, ability) {
    var score = (base.abilities && base.abilities[ability]) || 10;
    (progression.levels || []).forEach(function (l) {
      if (l.asi) Object.keys(l.asi).forEach(function (a) { if (a === ability) score += l.asi[a]; });
    });
    return score;
  }

  /**
   * Which ability to raise, if nobody wants to think about it.
   *
   * Round the primary ability up to an even number first (odd scores are dead
   * weight in 5e), then move to the next priority. This is what an experienced
   * player does almost every time.
   */
  function recommendedAsi(base, progression, classId) {
    var Chargen = chargen();
    var build = (Chargen && Chargen.BUILDS && Chargen.BUILDS[classId]) || null;
    var order = build ? build.priority : ABIL;
    for (var i = 0; i < order.length; i++) {
      var a = order[i];
      var cur = currentScore(base, progression, a);
      if (cur < 20 && cur % 2 === 1) return { mode: 'plus2', abilities: [a], why: 'Rounds ' + a.toUpperCase() + ' up to an even number, which is where the modifier actually changes.' };
    }
    for (var j = 0; j < order.length; j++) {
      var b = order[j];
      if (currentScore(base, progression, b) < 20) {
        return { mode: 'plus2', abilities: [b], why: 'Your highest-priority ability that is not yet capped.' };
      }
    }
    return { mode: 'plus2', abilities: ['con'], why: 'Everything else is at 20; Constitution is never wasted.' };
  }

  function spellChoicesFor(cls, classId, base, progression, newClassLevel) {
    var D = Data();
    var sc = cls.spellcasting;
    if (!sc) return null;
    var known = sc.spellsKnown && (sc.spellsKnown[newClassLevel] != null ? sc.spellsKnown[newClassLevel] : null);
    var have = (progression.spellsKnown || []).length;
    if (known == null) {
      /* Prepared casters do not learn a fixed list; they re-prepare on a long
         rest, so there is nothing to decide here. */
      return null;
    }
    var toPick = known - have;
    if (toPick <= 0) return null;

    /* Only spells this character can actually cast, and only ones they do not
       already know. Filtering by class alone offered a level-2 bard
       fourth-level spells, and offered spells already on the sheet — both of
       which produce a legal-looking choice that cannot be used. */
    var maxLevel = highestCastableLevel(cls, newClassLevel);
    var already = {};
    (progression.spellsKnown || []).concat(progression.preparedSpells || [])
      .forEach(function (id) { already[id] = true; });

    var pool = Object.keys(D.SPELLS || {}).filter(function (id) {
      var sp = D.SPELLS[id];
      if (!sp || already[id]) return false;
      if ((sp.classes || []).indexOf(classId) < 0) return false;
      return sp.level > 0 && sp.level <= maxLevel;
    }).sort(function (a, b) {
      /* Newly-available levels first: that is what a player is levelling up
         for, and burying it under sixty first-level spells hides it. */
      return (D.SPELLS[b].level - D.SPELLS[a].level) ||
        String(D.SPELLS[a].name).localeCompare(String(D.SPELLS[b].name));
    });
    if (!pool.length) return null;

    return {
      id: 'spells',
      kind: 'multi',
      prompt: 'Learn ' + toPick + ' new spell' + (toPick === 1 ? '' : 's'),
      note: 'Known spells are permanent until you swap one on a later level.',
      count: toPick,
      maxSpellLevel: maxLevel,
      choices: pool.slice(0, 60).map(function (id) {
        return { id: id, label: (D.SPELLS[id].name || id), note: 'Level ' + D.SPELLS[id].level };
      }),
      required: true,
    };
  }

  /**
   * The highest spell level a class of this level can cast (2014).
   *
   * Half-casters have no spellcasting at level 1 and third-casters none below
   * level 3; above that both behave like a full caster of half (or a third of)
   * their level, rounded up.
   */
  function highestCastableLevel(cls, classLevel) {
    var type = cls.casterType;
    if (type === 'pact') return Math.min(5, Math.ceil(Math.min(classLevel, 9) / 2));
    if (type === 'half') {
      return classLevel < 2 ? 0 : Math.min(5, Math.ceil(Math.ceil(classLevel / 2) / 2));
    }
    if (type === 'third') {
      return classLevel < 3 ? 0 : Math.min(4, Math.ceil(Math.ceil(classLevel / 3) / 2));
    }
    return Math.min(9, Math.ceil(classLevel / 2));
  }

  /* -------------------------------------------------------- auto-choose --- */

  /**
   * Make every decision the way the class would want it made.
   * Used by the "level me up" button and by AI-controlled seats, which must
   * never stall a session waiting for a human to pick a spell.
   */
  function autoChoose(base, progression, options, opts) {
    opts = opts || {};
    var rng = opts.rng;
    var out = {};
    options.groups.forEach(function (g) {
      if (g.id === 'hp') {
        out.hp = opts.rollHp ? 'roll' : 'average';
      } else if (g.id === 'asi') {
        var rec = g.recommended || { mode: 'plus2', abilities: ['con'] };
        out.asi = { mode: rec.mode, abilities: rec.abilities.slice() };
      } else if (g.kind === 'multi') {
        var picks = g.choices.slice();
        if (rng) rng.shuffle(picks);
        out[g.id] = picks.slice(0, g.count).map(function (c) { return c.id; });
      } else if (g.choices && g.choices.length) {
        out[g.id] = g.recommended || g.choices[0].id;
      }
    });
    return out;
  }

  /* ------------------------------------------------------------- apply ---- */

  /**
   * Turn a set of choices into events. Nothing here mutates: the caller
   * commits the batch, so a level-up is undoable exactly like a turn.
   */
  function applyLevel(base, progression, options, choices, opts) {
    opts = opts || {};
    var rng = opts.rng || new RNG('levelup');
    var errors = validate(options, choices);
    if (errors.length) return { ok: false, errors: errors };

    var die = options.hitDie;
    var conMod = Math.floor((currentScore(base, progression, 'con') - 10) / 2);
    var hpGained, hpRoll = null;
    if (choices.hp === 'roll') {
      hpRoll = Dice.roll('1d' + die, { rng: rng });
      /* A roll of 1 on a hit die is miserable and most tables house-rule it;
         we do not, but we do record the roll so the log can explain the number. */
      hpGained = hpRoll.total;
    } else {
      hpGained = Math.floor(die / 2) + 1;
    }

    var entry = {
      level: options.toLevel,
      classId: options.classId,
      hpGained: hpGained,
      hpRoll: hpRoll ? hpRoll.total : null,
      choice: choices.hp === 'roll' ? 'roll' : 'average',
      conModAtLevel: conMod,
      at: new Date().toISOString(),
    };
    if (choices.asi) entry.asi = asiToDelta(choices.asi);
    if (choices.subclass) entry.subclassId = choices.subclass;
    if (choices.fightingStyle) entry.fightingStyle = choices.fightingStyle;
    if (choices.spells) entry.spellsLearned = choices.spells.slice();

    var events = [
      { kind: 'level', actorId: opts.actorId, entry: entry },
    ];
    var beats = [
      (opts.actorName || 'The character') + ' reaches level ' + options.toLevel + '.',
      'Hit points increase by ' + hpGained + (hpRoll ? ' (rolled ' + hpRoll.total + ' on a d' + die + ')' : ' (average)') +
        (conMod ? ', plus ' + conMod + ' from Constitution' : '') + '.',
    ];
    if (entry.asi) {
      beats.push('Ability scores rise: ' + Object.keys(entry.asi).map(function (a) {
        return '+' + entry.asi[a] + ' ' + a.toUpperCase();
      }).join(', ') + '.');
    }
    if (entry.subclassId) beats.push('Chosen path: ' + entry.subclassId + '.');
    if (entry.spellsLearned && entry.spellsLearned.length) {
      beats.push('New spells learned: ' + entry.spellsLearned.join(', ') + '.');
    }
    (options.gains || []).forEach(function (g) { beats.push('Gains ' + g.name + '.'); });

    return { ok: true, events: events, beats: beats, entry: entry };
  }

  function asiToDelta(asi) {
    var out = {};
    if (asi.mode === 'plus2') { out[asi.abilities[0]] = 2; }
    else { (asi.abilities || []).forEach(function (a) { out[a] = (out[a] || 0) + 1; }); }
    return out;
  }

  function validate(options, choices) {
    var errors = [];
    (options.groups || []).forEach(function (g) {
      if (!g.required) return;
      var v = choices[g.id];
      if (g.id === 'asi') {
        if (!v || !v.abilities || !v.abilities.length) { errors.push('choose an ability score improvement'); return; }
        if (v.mode === 'plus2' && v.abilities.length !== 1) errors.push('a +2 goes to exactly one ability');
        if (v.mode === 'plus1' && v.abilities.length !== 2) errors.push('two abilities take +1 each');
        var caps = (options.groups.filter(function (x) { return x.id === 'asi'; })[0] || {}).choices || [];
        v.abilities.forEach(function (a) {
          var c = caps.filter(function (x) { return x.id === a; })[0];
          var add = v.mode === 'plus2' ? 2 : 1;
          if (c && c.value + add > 20) errors.push(a.toUpperCase() + ' cannot go above 20');
        });
        return;
      }
      if (g.kind === 'multi') {
        if (!Array.isArray(v) || v.length !== g.count) {
          errors.push('choose exactly ' + g.count + ' for ' + g.prompt);
          return;
        }
        /* Count alone was the whole check, so any three strings passed — a
           duplicate, a spell from another class, or an id that does not exist.
           The choices must be real options, and each may be taken once. */
        var legal = {};
        (g.choices || []).forEach(function (c) { legal[c.id] = true; });
        var seen = {};
        v.forEach(function (id) {
          if (!legal[id]) errors.push('"' + id + '" is not one of the options for ' + g.prompt);
          if (seen[id]) errors.push('"' + id + '" was chosen twice');
          seen[id] = true;
        });
        return;
      }
      if (v == null || v === '') { errors.push('choose an option for: ' + g.prompt); return; }
      if (g.choices && g.choices.length &&
        !g.choices.some(function (c) { return c.id === v; })) {
        errors.push('"' + v + '" is not one of the options for ' + g.prompt);
      }
    });
    return errors;
  }

  var api = {
    ASI_LEVELS: ASI_LEVELS, EXTRA_ASI: EXTRA_ASI,
    pendingLevel: pendingLevel,
    optionsFor: optionsFor,
    autoChoose: autoChoose,
    applyLevel: applyLevel,
    validate: validate,
    currentScore: currentScore,
    recommendedAsi: recommendedAsi,
    totalLevel: totalLevel,
    classLevel: classLevel,
    featuresAt: featuresAt,
  };

  global.DND = global.DND || {};
  global.DND.LevelUp = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
