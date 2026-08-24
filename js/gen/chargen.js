/*
 * chargen.js — making a character, with help.
 *
 * Three ways in, and they share one engine:
 *
 *   manual      you choose everything, and the game tells you what each choice
 *               is good for and which options fit what you have already picked
 *   guided      you fix the parts you care about ("a dwarf, and nothing else")
 *               and everything unset is filled in to suit
 *   random      nothing is fixed; roll a whole person
 *
 * The suggestions are opinions, not rules. They exist because "which of these
 * eighteen skills should a paladin take" is a real question for someone new,
 * and because an experienced player wants to skip it. Nothing here is
 * enforced — every recommendation can be ignored.
 */
(function (global) {
  'use strict';

  function req(p) { return typeof require !== 'undefined' ? require(p) : null; }
  var RNG = (global.DND && global.DND.RNG) || (req('../rng.js') || {}).RNG;

  var _data;
  function Data() {
    if (_data) return _data;
    var g = global.DND && global.DND.Data;
    if (g && g.RACES && g.CLASSES) { _data = g; return _data; }
    if (typeof require !== 'undefined') {
      try {
        _data = {
          RACES: require('../data/srd_races.js').RACES,
          CLASSES: require('../data/srd_classes.js').CLASSES,
          ITEMS: require('../data/srd_items.js').ITEMS,
          SPELLS: require('../data/srd_spells.js').SPELLS,
        };
        var rules = require('../data/srd_rules.js');
        _data.SKILLS = rules.SKILLS; _data.BACKGROUNDS = rules.BACKGROUNDS;
      } catch (e) { _data = g || {}; }
    }
    return _data || {};
  }

  var ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  var STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

  /* ------------------------------------------------------ recommendations -- */

  /**
   * What each class actually wants, in the order it wants it.
   *
   * `priority` drives ability assignment: the highest score goes to the first
   * entry, and so on. `skills` and `background` are opening suggestions a
   * player can take or leave, and `why` is the one-line reason shown next to
   * the pick — the point is to teach, not to decide.
   */
  var BUILDS = {
    barbarian: {
      priority: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
      skills: ['athletics', 'survival'], background: 'outlander',
      why: 'Strength swings the axe; Constitution keeps you standing while you rage.',
      style: 'Wade in, soak the hits nobody else can, and stay angry.',
    },
    bard: {
      priority: ['cha', 'dex', 'con', 'wis', 'int', 'str'],
      skills: ['persuasion', 'performance', 'deception'], background: 'entertainer',
      why: 'Charisma is your spellcasting, your negotiating and your bluffing all at once.',
      style: 'Talk first. Support the party. Be surprisingly good at everything.',
    },
    cleric: {
      priority: ['wis', 'con', 'str', 'cha', 'dex', 'int'],
      skills: ['religion', 'insight'], background: 'acolyte',
      why: 'Wisdom sets your spell save DC; Constitution keeps concentration when you are hit.',
      style: 'Heal, buff, and hit undead considerably harder than they expect.',
    },
    druid: {
      priority: ['wis', 'con', 'dex', 'int', 'cha', 'str'],
      skills: ['nature', 'perception'], background: 'hermit',
      why: 'Wisdom drives every spell you cast and every shape you take.',
      style: 'Control the battlefield, then become something with more teeth.',
    },
    fighter: {
      priority: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
      skills: ['athletics', 'perception'], background: 'soldier',
      why: 'Strength and Constitution: hit hard, keep hitting.',
      style: 'The most attacks of anyone. Reliable in a way nothing else is.',
    },
    monk: {
      priority: ['dex', 'wis', 'con', 'str', 'cha', 'int'],
      skills: ['acrobatics', 'insight'], background: 'hermit',
      why: 'Dexterity and Wisdom both raise your armour class \u2014 you wear none.',
      style: 'Fast, mobile, and hard to pin down. Many small hits.',
    },
    paladin: {
      priority: ['str', 'cha', 'con', 'wis', 'dex', 'int'],
      skills: ['athletics', 'persuasion'], background: 'noble',
      why: 'Strength to fight, Charisma for your oath, your spells and your presence.',
      style: 'Stand between people and what is coming. Smite what deserves it.',
    },
    ranger: {
      priority: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
      skills: ['survival', 'perception', 'stealth'], background: 'outlander',
      why: 'Dexterity for the bow, Wisdom for tracking and spells.',
      style: 'Scout ahead, shoot from range, know the ground.',
    },
    rogue: {
      priority: ['dex', 'con', 'wis', 'cha', 'int', 'str'],
      skills: ['stealth', 'perception', 'sleightOfHand', 'investigation'], background: 'criminal',
      why: 'Dexterity is everything: attacks, armour class, stealth and escapes.',
      style: 'Be somewhere unexpected, hit something once, very hard.',
    },
    sorcerer: {
      priority: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
      skills: ['arcana', 'persuasion'], background: 'noble',
      why: 'Charisma is your magic; Constitution keeps concentration alive.',
      style: 'Fewer spells than a wizard, but bent to your will mid-cast.',
    },
    warlock: {
      priority: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
      skills: ['arcana', 'deception'], background: 'charlatan',
      why: 'Charisma powers a bargain you did not entirely read.',
      style: 'Few slots, always at the highest level, back after a short rest.',
    },
    wizard: {
      priority: ['int', 'con', 'dex', 'wis', 'cha', 'str'],
      skills: ['arcana', 'investigation', 'history'], background: 'sage',
      why: 'Intelligence is your whole craft. Constitution is what keeps you alive to use it.',
      style: 'The widest spell list in the game, and the fewest hit points.',
    },
  };

  /* Races that pair especially well with a class, and the honest reason why.
     Absence is not a warning — any race plays any class. */
  var SYNERGY = {
    barbarian: { halfOrc: 'Relentless Endurance keeps you up at 0 hit points.', dwarf: 'Constitution and poison resistance suit a front line.' },
    bard: { halfElf: 'Charisma plus two free skills is the bard package exactly.' },
    cleric: { dwarf: 'Wisdom and toughness; hill dwarves gain hit points every level.', human: 'Even scores fit a class that wants three of them.' },
    druid: { elf: 'Wisdom and keen senses.', gnome: 'Advantage on saves against magic.' },
    fighter: { human: 'A little of everything, which is what a fighter uses.', dwarf: 'Armour proficiency and hit points.', dragonborn: 'Strength, plus a breath weapon for crowds.' },
    monk: { elf: 'Dexterity and a walking speed bonus stack with Unarmored Movement.', halfling: 'Dexterity and Lucky, on a class that rolls a lot of dice.' },
    paladin: { human: 'Needs Strength and Charisma both \u2014 an even spread helps.', dragonborn: 'Strength and Charisma, and a breath weapon.', halfElf: 'Charisma for the oath, plus skills.' },
    ranger: { elf: 'Dexterity, darkvision and Perception proficiency.', halfling: 'Dexterity and Lucky.' },
    rogue: { halfling: 'Dexterity, Lucky, and the ability to hide behind an ally.', elf: 'Dexterity and Perception; drow gain darkvision.' },
    sorcerer: { tiefling: 'Charisma and innate magic already in the blood.', halfElf: 'Charisma and extra skills.' },
    warlock: { tiefling: 'Charisma and a fiendish flavour that writes itself.', halfElf: 'Charisma and skills.' },
    wizard: { gnome: 'Intelligence and advantage on saves against magic.', elf: 'High elves gain a cantrip and Intelligence.' },
  };

  /* Backstory prompts, so a blank box is never the only thing on offer. */
  var BACKSTORY_SEEDS = [
    'You left somewhere in a hurry, and you have not been back.',
    'Someone taught you this trade and you have not forgiven them for it.',
    'You are looking for a person. You are not sure you want to find them.',
    'You owe a debt that cannot be paid in coin.',
    'You were there when it happened, and everyone thinks you were not.',
    'You did the right thing once and it cost more than you expected.',
    'You are the last of something \u2014 a house, a craft, an order.',
    'You promised a dying person you would do a specific, inconvenient thing.',
    'Nobody where you come from believes you made it this far.',
    'You are running an experiment on yourself and telling no one.',
  ];

  /* ----------------------------------------------------------- suggestions -- */

  /**
   * Everything the builder can usefully say about a partial character.
   * Safe to call at any point: fields that are not chosen yet simply produce
   * no advice about themselves.
   */
  function suggestionsFor(pick) {
    pick = pick || {};
    var D = Data();
    var out = {
      abilityPriority: null, abilityWhy: '', playstyle: '',
      skills: [], skillWhy: {}, background: null, backgroundWhy: '',
      raceNotes: '', synergy: '', warnings: [], classNotes: '',
    };

    var build = pick.classId && BUILDS[pick.classId];
    if (build) {
      out.abilityPriority = build.priority.slice();
      out.abilityWhy = build.why;
      out.playstyle = build.style;
      out.background = build.background;
      out.skills = build.skills.slice();
      var cls = D.CLASSES && D.CLASSES[pick.classId];
      if (cls) {
        out.classNotes = 'Hit die d' + cls.hitDie + '. Saving throws: ' +
          (cls.savingThrows || []).map(upper).join(' and ') + '.' +
          (cls.subclassLevel ? ' You choose a subclass at level ' + cls.subclassLevel + '.' : '');
        /* Only recommend skills the class can actually take. */
        var allowed = cls.skillChoices && cls.skillChoices.from;
        if (allowed) {
          out.skills = out.skills.filter(function (s) { return allowed.indexOf(s) >= 0; });
          while (out.skills.length < (cls.skillChoices.count || 2)) {
            var next = allowed.filter(function (s) { return out.skills.indexOf(s) < 0; })[0];
            if (!next) break;
            out.skills.push(next);
          }
          out.skills = out.skills.slice(0, cls.skillChoices.count || 2);
        }
      }
      out.skills.forEach(function (s) { out.skillWhy[s] = skillReason(s, pick.classId); });
    }

    if (pick.raceId) {
      var race = D.RACES && D.RACES[pick.raceId];
      if (race) {
        var asi = mergedAsi(race, pick.subraceId);
        out.raceNotes = Object.keys(asi).map(function (a) {
          return '+' + asi[a] + ' ' + upper(a);
        }).join(', ') + '. Speed ' + race.speed + ' ft' +
          (race.darkvision ? ', darkvision ' + race.darkvision + ' ft' : '') + '.';
      }
      if (pick.classId) {
        var syn = SYNERGY[pick.classId] && SYNERGY[pick.classId][pick.raceId];
        if (syn) out.synergy = syn;
        /* A gentle note, never a block: the game does not stop anyone. */
        if (build && race) {
          var primary = build.priority[0];
          var asi2 = mergedAsi(race, pick.subraceId);
          if (!asi2[primary]) {
            out.warnings.push('This race gives no bonus to ' + upper(primary) +
              ', which ' + (D.CLASSES[pick.classId] || {}).name + 's lean on. Perfectly playable \u2014 just a slower start.');
          }
        }
      }
    }

    if (pick.classId && !out.background && D.BACKGROUNDS) {
      out.background = Object.keys(D.BACKGROUNDS)[0];
    }
    if (out.background && D.BACKGROUNDS && D.BACKGROUNDS[out.background]) {
      out.backgroundWhy = D.BACKGROUNDS[out.background].feature &&
        (D.BACKGROUNDS[out.background].feature.name || '') || '';
    }
    return out;
  }

  function skillReason(skill, classId) {
    var reasons = {
      athletics: 'Grappling, shoving, climbing \u2014 the physical problems.',
      acrobatics: 'Keeping your feet, escaping a grapple, moving through a fight.',
      stealth: 'Not being seen is the strongest position in the game.',
      perception: 'The most-rolled skill there is. Someone in the party needs it.',
      investigation: 'Working out what a scene means, rather than noticing it.',
      insight: 'Reading whether you are being lied to.',
      persuasion: 'Getting what you want without drawing a weapon.',
      deception: 'Getting what you want without telling the truth.',
      intimidation: 'Getting what you want quickly, at a cost.',
      survival: 'Tracking, foraging, and not dying outdoors.',
      arcana: 'Recognising magic before it goes off.',
      religion: 'Knowing what you are fighting, when it used to be holy.',
      nature: 'Knowing what lives here and whether it is hungry.',
      history: 'Old grudges explain most present ones.',
      medicine: 'Stabilising someone without spending a spell.',
      performance: 'A living, and occasionally a distraction.',
      sleightOfHand: 'Pockets, locks, and things that should not move.',
      animalHandling: 'Horses, hounds, and anything with a temper.',
    };
    return reasons[skill] || '';
  }

  function mergedAsi(race, subraceId) {
    var asi = Object.assign({}, race.asi || {});
    var sub = subraceId && race.subraces && race.subraces[subraceId];
    if (sub && sub.asi) Object.keys(sub.asi).forEach(function (a) {
      asi[a] = (asi[a] || 0) + sub.asi[a];
    });
    return asi;
  }

  function upper(a) { return String(a || '').toUpperCase(); }

  /* -------------------------------------------------------- auto-creation -- */

  /**
   * Assign the standard array according to the class's priority, then add the
   * racial bonuses. This is the "suggested stats" a player can accept with one
   * click, and it is what the random generator uses.
   */
  function suggestedAbilities(classId, raceId, subraceId, opts) {
    opts = opts || {};
    var D = Data();
    var build = BUILDS[classId] || BUILDS.fighter;
    var array = (opts.array || STANDARD_ARRAY).slice().sort(function (a, b) { return b - a; });
    var scores = {};
    build.priority.forEach(function (ab, i) { scores[ab] = array[i] != null ? array[i] : 10; });

    var race = D.RACES && D.RACES[raceId];
    if (race) {
      var asi = mergedAsi(race, subraceId);
      Object.keys(asi).forEach(function (a) {
        if (a === 'all') ABIL.forEach(function (x) { scores[x] += asi.all; });
        else scores[a] = (scores[a] || 10) + asi[a];
      });
    }
    return scores;
  }

  /** 4d6 keep highest 3, assigned by class priority. */
  function rolledAbilities(rng, classId, raceId, subraceId) {
    var rolls = [];
    for (var i = 0; i < 6; i++) {
      var d = [rng.int(1, 6), rng.int(1, 6), rng.int(1, 6), rng.int(1, 6)].sort(function (a, b) { return b - a; });
      rolls.push(d[0] + d[1] + d[2]);
    }
    return suggestedAbilities(classId, raceId, subraceId, { array: rolls });
  }

  /**
   * Fill in everything the player did not choose.
   *
   * `fixed` may specify any subset — race, subrace, class, background, name,
   * abilities, skills, backstory. Whatever is absent is generated to suit
   * whatever is present, which is what makes "a dwarf, surprise me" work.
   */
  function generate(opts) {
    opts = opts || {};
    var fixed = opts.fixed || {};
    var rng = opts.rng || new RNG(opts.seed == null ? String(Date.now()) : opts.seed);
    var D = Data();

    var raceIds = Object.keys(D.RACES || {});
    var classIds = Object.keys(D.CLASSES || {}).filter(function (c) { return BUILDS[c]; });
    var bgIds = Object.keys(D.BACKGROUNDS || {});

    var classId = fixed.classId || rng.pick(classIds) || 'fighter';

    /* If a class is fixed but a race is not, weight the roll toward a race
       that actually complements it — a "surprise me" character should still
       feel like somebody chose it. */
    var raceId = fixed.raceId;
    if (!raceId) {
      var liked = Object.keys(SYNERGY[classId] || {}).filter(function (r) { return raceIds.indexOf(r) >= 0; });
      raceId = (liked.length && rng.chance(0.6)) ? rng.pick(liked) : rng.pick(raceIds);
    }
    raceId = raceId || 'human';

    var race = (D.RACES || {})[raceId] || {};
    var subraceIds = Object.keys(race.subraces || {});
    var subraceId = fixed.subraceId || (subraceIds.length ? rng.pick(subraceIds) : null);

    var build = BUILDS[classId] || BUILDS.fighter;
    var backgroundId = fixed.backgroundId ||
      (rng.chance(0.65) && bgIds.indexOf(build.background) >= 0 ? build.background : rng.pick(bgIds)) ||
      bgIds[0];

    var abilities = fixed.abilities ||
      (opts.method === 'roll'
        ? rolledAbilities(rng, classId, raceId, subraceId)
        : suggestedAbilities(classId, raceId, subraceId));

    var cls = (D.CLASSES || {})[classId] || {};
    var skills = fixed.skills;
    if (!skills) {
      var pool = (cls.skillChoices && cls.skillChoices.from) || [];
      var want = (cls.skillChoices && cls.skillChoices.count) || 2;
      skills = build.skills.filter(function (s) { return pool.indexOf(s) >= 0; }).slice(0, want);
      var rest = pool.filter(function (s) { return skills.indexOf(s) < 0; });
      rng.shuffle(rest);
      while (skills.length < want && rest.length) skills.push(rest.shift());
    }

    var name = fixed.name || randomName(rng, raceId, D);
    var backstory = fixed.backstory || rng.pick(BACKSTORY_SEEDS);
    var levels = fixed.levels || opts.level || opts.levels || 1;

    /* A caster who knows no spells is not a character, it is a sheet with an
       empty page. Every generated wizard, cleric, bard, sorcerer, warlock and
       druid used to arrive with a full complement of slots and nothing to
       spend them on — the class was chosen, the magic never was. */
    var magic = fixed.spells || chooseSpells(D, classId, levels, rng);

    return {
      name: name,
      raceId: raceId, subraceId: subraceId, classId: classId,
      backgroundId: backgroundId,
      abilities: abilities,
      skills: skills,
      backstory: backstory,
      levels: levels,
      cantrips: magic.cantrips,
      spells: magic.spells,
      generated: {
        method: opts.method || 'array',
        fixedFields: Object.keys(fixed),
        synergy: (SYNERGY[classId] || {})[raceId] || '',
        playstyle: build.style,
      },
    };
  }

  /**
   * Pick a legal, playable set of cantrips and spells for a new caster.
   *
   * Two rules matter and both were being skipped. A spell must be on the
   * class's own list — a wizard cannot prepare *cure wounds* — and it must be
   * of a level the character can actually cast, which is capped by their
   * slots, not by their character level. A level-2 bard was previously offered
   * fourth-level spells.
   *
   * Preference goes to spells the engine can genuinely resolve, so a new
   * caster's spell list is a list of things that work rather than a list of
   * things that produce "the engine does not know that spell".
   */
  function chooseSpells(D, classId, levels, rng) {
    var empty = { cantrips: [], spells: [] };
    var cls = (D.CLASSES || {})[classId];
    if (!cls || !cls.spellcasting) return empty;
    var SPELLS = D.SPELLS || {};
    if (!Object.keys(SPELLS).length) return empty;

    var maxSpellLevel = highestSlotLevel(cls, levels);
    var onList = Object.keys(SPELLS).filter(function (id) {
      var sp = SPELLS[id];
      return sp && (sp.classes || []).indexOf(classId) >= 0;
    });

    var cantripCount = countFrom(cls.spellcasting.cantripsKnown, levels);
    var cantrips = choose(onList.filter(function (id) { return SPELLS[id].level === 0; }),
      cantripCount, rng, SPELLS);

    /* How many spells to know. A "known" caster has a fixed table; a prepared
       caster prepares ability modifier + level, which we approximate at
       generation time and let the sheet re-derive later. */
    var spellCount = countFrom(cls.spellcasting.spellsKnown, levels);
    if (!spellCount) spellCount = Math.max(2, Math.ceil(levels / 2) + 2);

    var pool = onList.filter(function (id) {
      var lv = SPELLS[id].level;
      return lv > 0 && lv <= maxSpellLevel;
    });
    var spells = choose(pool, spellCount, rng, SPELLS);

    return { cantrips: cantrips, spells: spells };
  }

  /**
   * The highest spell level this class can cast at this character level.
   *
   * 2014 half-casters (paladin, ranger) have no spellcasting at all at level 1
   * and third-casters none below level 3 — an easy thing to miss, and missing
   * it handed brand-new paladins a first-level spell list they could not cast
   * a single one of. Above that, both are equivalent to a full caster of half
   * (or a third of) their level, rounded up.
   */
  function highestSlotLevel(cls, levels) {
    var type = cls.casterType;
    if (type === 'pact') return Math.min(5, Math.ceil(Math.min(levels, 9) / 2));
    if (type === 'half') {
      if (levels < 2) return 0;
      return Math.min(5, Math.ceil(Math.ceil(levels / 2) / 2));
    }
    if (type === 'third') {
      if (levels < 3) return 0;
      return Math.min(4, Math.ceil(Math.ceil(levels / 3) / 2));
    }
    return Math.min(9, Math.ceil(levels / 2));
  }

  function countFrom(table, levels) {
    if (!Array.isArray(table)) return 0;
    var n = table[Math.max(0, Math.min(table.length - 1, levels))];
    return typeof n === 'number' ? n : 0;
  }

  /* Prefer spells the engine resolves mechanically, then fill from the rest,
     so a starting list is useful before it is exotic. */
  function choose(ids, count, rng, SPELLS) {
    if (!count || !ids.length) return [];
    var supported = ids.filter(function (id) { return SPELLS[id] && SPELLS[id].mech; });
    var rest = ids.filter(function (id) { return !(SPELLS[id] && SPELLS[id].mech); });
    rng.shuffle(supported); rng.shuffle(rest);
    return supported.concat(rest).slice(0, count);
  }

  /* Name pools kept small and evocative rather than exhaustive; a player who
     cares about the name will type one. */
  var NAMES = {
    human: { first: ['Aldric', 'Mira', 'Ceren', 'Tobin', 'Halden', 'Wren', 'Josse', 'Elena', 'Garrow', 'Petra'], last: ['Vance', 'Coole', 'Marsh', 'Hale', 'Dunning', 'Ashford', 'Rook', 'Venn'] },
    dwarf: { first: ['Borin', 'Hedda', 'Duric', 'Thrain', 'Gerda', 'Valdr', 'Rurik', 'Sigrun'], last: ['Ironhand', 'Stonewell', 'Deepdelve', 'Coalbrow', 'Anvilborn'] },
    elf: { first: ['Aelin', 'Thalor', 'Miriel', 'Faelen', 'Sylvi', 'Erevan', 'Naeris'], last: ['Moonwhisper', 'Silverbough', 'Duskvale', 'Nightbreeze'] },
    halfling: { first: ['Pip', 'Rosamund', 'Milo', 'Tansy', 'Bram', 'Nell', 'Corry'], last: ['Goodbarrel', 'Underbough', 'Tealeaf', 'Highhill'] },
    gnome: { first: ['Fizwick', 'Nyx', 'Bimble', 'Ellivera', 'Zook', 'Wren'], last: ['Cogsworth', 'Glitterspark', 'Bramblefoot'] },
    halfElf: { first: ['Sennen', 'Ilka', 'Doran', 'Aveline', 'Kellen'], last: ['Vale', 'Ashvane', 'Harrow', 'Lightfoot'] },
    halfOrc: { first: ['Grosh', 'Ruk', 'Mazha', 'Thokk', 'Enna', 'Karg'], last: ['Skullsplitter', 'Ironjaw', 'of the Broken Tooth'] },
    dragonborn: { first: ['Rhogar', 'Sora', 'Kriv', 'Nadarr', 'Akra', 'Balasar'], last: ['Clethtinthiallor', 'Kerrhylon', 'Myastan'] },
    tiefling: { first: ['Ash', 'Sorrow', 'Kael', 'Nemeia', 'Damaris', 'Quiet'], last: ['of No House', 'Vane', 'Hollow', 'Undersworn'] },
  };

  function randomName(rng, raceId, D) {
    var pool = NAMES[raceId] || NAMES.human;
    var first = rng.pick(pool.first);
    var last = rng.chance(0.85) ? ' ' + rng.pick(pool.last) : '';
    return first + last;
  }

  /* --------------------------------------------------------- point buy ----- */

  var POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

  function pointBuyCost(scores) {
    var total = 0;
    ABIL.forEach(function (a) {
      var v = scores[a];
      total += POINT_COST[v] == null ? 99 : POINT_COST[v];
    });
    return total;
  }

  /** A legal, class-appropriate 27-point spread. */
  function suggestedPointBuy(classId) {
    var build = BUILDS[classId] || BUILDS.fighter;
    var spread = [15, 14, 13, 12, 10, 8];   // exactly 27 points
    var scores = {};
    build.priority.forEach(function (ab, i) { scores[ab] = spread[i]; });
    return scores;
  }

  var api = {
    ABIL: ABIL, STANDARD_ARRAY: STANDARD_ARRAY,
    BUILDS: BUILDS, SYNERGY: SYNERGY, BACKSTORY_SEEDS: BACKSTORY_SEEDS,
    POINT_COST: POINT_COST,
    suggestionsFor: suggestionsFor,
    suggestedAbilities: suggestedAbilities,
    rolledAbilities: rolledAbilities,
    suggestedPointBuy: suggestedPointBuy,
    pointBuyCost: pointBuyCost,
    generate: generate,
    randomName: randomName,
    mergedAsi: mergedAsi,
    skillReason: skillReason,
  };

  global.DND = global.DND || {};
  global.DND.Chargen = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
