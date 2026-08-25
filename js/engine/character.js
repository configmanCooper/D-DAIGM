/*
 * character.js — the three-layer character model and the pure derive().
 *
 * The single most consequential error in the original design was collapsing a
 * character into one flat sheet. It cannot be one sheet, because the three
 * things a sheet conflates change on completely different clocks:
 *
 *   base        — who they are: race, class, background, starting scores.
 *                 Chosen once, edited almost never.
 *   progression — how they grew: the ACTUAL per-level hit points rolled, the
 *                 ASIs and feats taken, the spells learned. Append-only.
 *   runtime     — where they are right now: current HP, expended slots, active
 *                 conditions, a Feeblemind overriding their Intelligence, a bear
 *                 form overriding their whole body. Rewritten constantly.
 *
 * derive(base, progression, runtime, activeEffects) is PURE: same inputs, same
 * output, and it never writes to any of them. Save/load stays exact by
 * serialising the three layers plus the effect list and recomputing everything
 * derived. Raising Constitution retroactively granting HP per level is not a
 * special case here — it simply falls out of recomputing from the stored rolls.
 */
(function (global) {
  'use strict';

  var Effects = (global.DND && global.DND.Effects) ||
    (typeof require !== 'undefined' ? require('./effects.js') : null);

  var ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  /* The governing ability for each of the 18 skills. Single source of truth —
     rules.js re-exports this rather than keeping a second copy that could
     drift. */
  var SKILL_ABILITY = {
    acrobatics: 'dex', animalHandling: 'wis', arcana: 'int', athletics: 'str',
    deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
    investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
    performance: 'cha', persuasion: 'cha', religion: 'int', sleightOfHand: 'dex',
    stealth: 'dex', survival: 'wis',
  };

  var PROFICIENCY_BONUS = [null, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];

  /* PHB multiclass spellcasting table: combined caster level -> slots by level.
     Full casters single-classed land on exactly these rows too, so there is one
     table, not two. Warlock Pact Magic is deliberately NOT in here. */
  var MULTICLASS_SLOTS = [
    null,
    [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
    [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
    [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
    [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
  ];

  /* Warlock Pact Magic: level -> {count, level}. A separate, self-refreshing
     pool that never merges into the table above. */
  var PACT_SLOTS = [
    null,
    { count: 1, level: 1 }, { count: 2, level: 1 }, { count: 2, level: 2 }, { count: 2, level: 2 },
    { count: 2, level: 3 }, { count: 2, level: 3 }, { count: 2, level: 4 }, { count: 2, level: 4 },
    { count: 2, level: 5 }, { count: 2, level: 5 }, { count: 3, level: 5 }, { count: 3, level: 5 },
    { count: 3, level: 5 }, { count: 3, level: 5 }, { count: 3, level: 5 }, { count: 3, level: 5 },
    { count: 4, level: 5 }, { count: 4, level: 5 }, { count: 4, level: 5 }, { count: 4, level: 5 },
  ];

  /* ------------------------------------------------------------ data --------
     Reference data is injected so the module works before the SRD files exist
     and can be driven by test fixtures. Anything already loaded onto DND.Data
     is picked up as a convenience, but nothing depends on it being there. */
  var DATA = { RACES: {}, CLASSES: {}, ITEMS: {}, SPELLS: {} };

  function setData(d) {
    if (!d) return;
    ['RACES', 'CLASSES', 'ITEMS', 'SPELLS'].forEach(function (k) {
      if (d[k]) DATA[k] = d[k];
    });
  }
  if (global.DND && global.DND.Data) setData(global.DND.Data);

  function cls(id) { return table('CLASSES')[id] || null; }
  /**
   * Item lookup.
   *
   * `setData` is the explicit path and tests use it, but nothing in the real
   * application was calling it — so the table stayed empty and a paladin in
   * chain mail derived as unarmoured, AC 13 instead of 18. Falling back to the
   * loaded data (the global in a browser, a require under Node) means the
   * common case works without ceremony, while an injected table still wins.
   */
  function lookupItem(ref) {
    if (!ref) return null;
    if (typeof ref === 'object') return ref;
    if (DATA.ITEMS && DATA.ITEMS[ref]) return DATA.ITEMS[ref];
    var fallback = ambientItems();
    return (fallback && fallback[ref]) || null;
  }

  var ambientCache;
  function ambientItems() {
    var d = ambientData();
    return (d && d.ITEMS) || null;
  }

  /**
   * The loaded data tables, however this file happens to be running.
   *
   * `setData` is the explicit path and tests use it, but nothing in the real
   * application was calling it — so the tables stayed empty. For items that
   * meant a paladin in chain mail deriving as unarmoured; for classes it meant
   * a caster with no spell slots at all, because `casterType` was unknown.
   * Falling back to the loaded data (the global in a browser, a require under
   * Node) makes the common case work without ceremony, while an injected table
   * still wins.
   */
  function ambientData() {
    if (ambientCache !== undefined) return ambientCache;
    var g = (typeof globalThis !== 'undefined' ? globalThis : this);
    if (g && g.DND && g.DND.Data && g.DND.Data.CLASSES) { ambientCache = g.DND.Data; return ambientCache; }
    if (typeof require !== 'undefined') {
      try {
        ambientCache = {
          RACES: require('../data/srd_races.js').RACES,
          CLASSES: require('../data/srd_classes.js').CLASSES,
          ITEMS: require('../data/srd_items.js').ITEMS,
          SPELLS: require('../data/srd_spells.js').SPELLS,
        };
      } catch (e) { ambientCache = (g && g.DND && g.DND.Data) || null; }
    } else {
      ambientCache = (g && g.DND && g.DND.Data) || null;
    }
    return ambientCache;
  }

  /** Read a data table, preferring anything explicitly injected. */
  function table(kind) {
    if (DATA[kind] && Object.keys(DATA[kind]).length) return DATA[kind];
    var amb = ambientData();
    return (amb && amb[kind]) || DATA[kind] || {};
  }

  /**
   * Resolve an equipment slot, preferring what the character is actually
   * carrying. A campaign item with its own history and its own AC block (a
   * shield reinforced after a fight, say) must win over the generic SRD entry
   * of the same name.
   */
  function equippedItem(runtime, ref) {
    if (!ref) return null;
    if (typeof ref === 'object') return ref;
    var inv = (runtime && runtime.inventory) || [];
    for (var i = 0; i < inv.length; i++) {
      var entry = inv[i];
      if ((entry.uid === ref || entry.id === ref) && (entry.ac || entry.damage || entry.mech)) return entry;
    }
    return lookupItem(ref);
  }

  /* ------------------------------------------------------- small helpers ---- */

  function abilityMod(score) { return Math.floor((score - 10) / 2); }

  function characterLevel(base, progression) {
    if (progression && progression.levels && progression.levels.length) return progression.levels.length;
    return (base.classes || []).reduce(function (n, c) { return n + (c.levels || 0); }, 0);
  }

  function proficiencyBonus(level) {
    return PROFICIENCY_BONUS[Math.max(1, Math.min(20, level))];
  }

  /* --------------------------------------------------------- abilities ------
     Order matters and is deliberate: ability score improvements from levelling
     are part of the true score, drain then subtracts from it, an override SETS
     it outright (Feeblemind pins Intelligence to 1 no matter what drained it),
     a wild-shape/polymorph form replaces the physical trio wholesale, and
     item/effect setters land last. Everything downstream — save DCs, skill
     mods, carrying capacity — reads only the result. */
  function computeAbilities(base, runtime, activeEffects, progression) {
    /* ASIs live in the progression log because they are a record of choices
       made, not part of the character's starting definition. Omitting them
       here meant a level-4 ability score improvement raised nothing at all:
       the log said +2 Strength and the sheet still read 16. */
    var improvements = {};
    ((progression && progression.levels) || []).forEach(function (l) {
      if (!l || !l.asi) return;
      Object.keys(l.asi).forEach(function (ab) {
        improvements[ab] = (improvements[ab] || 0) + l.asi[ab];
      });
    });

    var scores = {};
    ABILITIES.forEach(function (ab) {
      var s = base.abilities[ab] + (improvements[ab] || 0);
      /* 20 is the hard ceiling for ordinary advancement. */
      if (improvements[ab]) s = Math.min(20, s);
      if (runtime.abilityDrain && runtime.abilityDrain[ab]) s -= runtime.abilityDrain[ab];
      if (runtime.abilityOverride && runtime.abilityOverride[ab] != null) s = runtime.abilityOverride[ab];
      scores[ab] = s;
    });

    if (runtime.activeForm && runtime.activeForm.abilities) {
      ['str', 'dex', 'con'].forEach(function (ab) {
        var v = runtime.activeForm.abilities[ab];
        if (v != null) scores[ab] = v;
      });
    }

    (activeEffects || []).forEach(function (e) {
      if (e.kind === 'ability_score_set' && e.ability && e.magnitude != null) scores[e.ability] = e.magnitude;
      else if (e.kind === 'ability_bonus' && e.ability && typeof e.magnitude === 'number') scores[e.ability] += e.magnitude;
    });

    ABILITIES.forEach(function (ab) { scores[ab] = Math.max(1, scores[ab]); });
    return scores;
  }

  /* --------------------------------------------------------- hit points ------ */

  function hpBonusPerLevel(base) {
    var bonus = 0;
    var r = (function () { var T = table('RACES'); return T[base.subraceId] || T[base.raceId]; })();
    /* Hill Dwarf toughness and similar: a flat HP bump per character level,
       expressed in the race data as a machine-readable trait. */
    if (r && r.traits) {
      r.traits.forEach(function (tr) {
        if (tr.mech && tr.mech.type === 'hp_per_level') bonus += tr.mech.amount || 0;
      });
    }
    return bonus;
  }

  function computeHpMax(base, progression, mods, level, exhaustion, runtime) {
    if (runtime.activeForm && runtime.activeForm.hpMax != null) {
      /* A form is a separate hit point pool: while shaped, this IS the max. */
      return Math.max(0, runtime.activeForm.hpMax);
    }
    var sum = 0;
    (progression.levels || []).forEach(function (l) { sum += (l.hpGained || 0); });
    var hp = sum + mods.con * level + hpBonusPerLevel(base) * level;
    if (exhaustion >= 4) hp = Math.floor(hp / 2);   // exhaustion 4: hit point maximum halved
    return Math.max(0, hp);
  }

  /* --------------------------------------------------------- armor class -----
     The contribution model, implemented with no special cases. Every source of
     AC emits {type:'base'|'add'|'set'|'floor', value, requires, source}; the
     resolver then takes the best base, sums the adds, applies a set, and floors.
     A worn breastplate, an unarmoured barbarian and Mage Armor all reach the
     resolver as ordinary 'base' contributions and the largest simply wins. */
  function armorProfile(item) {
    if (!item) return null;
    var type = item.armorType || (item.mech && item.mech.armorType) ||
      (item.ac && item.ac.category === 'shield' ? 'shield' : null) ||
      (item.ac && item.ac.mode === 'add' ? 'shield' : null);

    /* Two shapes are in circulation and both are legitimate: the SRD table
       carries `mech.baseAC` + `mech.dexBonus`, while the data schema and the
       campaign items carry a structured `ac` block. Reading only the first
       silently ignored every hand-authored piece of gear. */
    var acBlock = (item.ac && typeof item.ac === 'object') ? item.ac : null;
    var baseAC = (item.mech && item.mech.baseAC != null) ? item.mech.baseAC
      : acBlock ? (acBlock.base != null ? acBlock.base : acBlock.value)
        : (typeof item.ac === 'number' ? item.ac : null);
    if (baseAC == null) return null;

    if (type === 'shield' || (acBlock && acBlock.mode === 'add')) {
      return { shield: true, add: baseAC };
    }

    var maxDex;
    if (item.mech && item.mech.dexBonus !== undefined) {
      var dexBonus = item.mech.dexBonus;
      maxDex = dexBonus === 'none' ? 0 : dexBonus === 'max2' ? 2 : Infinity;
    } else if (acBlock && acBlock.maxDex !== undefined) {
      maxDex = acBlock.maxDex === null ? Infinity : acBlock.maxDex;
    } else {
      maxDex = Infinity;
    }
    return { shield: false, base: baseAC, maxDex: maxDex };
  }

  function acContributions(base, progression, runtime, mods, activeEffects, equip) {
    var contribs = [];
    var armorItem = equippedItem(runtime, equip.armor);
    var armorP = armorItem ? armorProfile(armorItem) : null;
    var wornArmor = armorP && !armorP.shield ? armorP : null;

    var shieldRef = equip.shield;
    var shieldItem = typeof shieldRef === 'string' ? equippedItem(runtime, shieldRef) : null;
    var shieldAdd = shieldItem ? (armorProfile(shieldItem) || {}).add : (shieldRef ? 2 : 0);
    var hasShield = !!shieldRef;

    if (wornArmor) {
      contribs.push({
        type: 'base', source: armorItem.id || 'armor',
        /* Heavy armour ignores Dexterity ENTIRELY — it does not cap the bonus
           at zero. `Math.min(dex, 0)` let a negative modifier through, so a
           Strength-built fighter in plate with Dex 6 derived AC 16 instead of
           18: the armour was actively making them easier to hit. */
        value: wornArmor.maxDex === 0
          ? wornArmor.base
          : wornArmor.base + Math.min(mods.dex, wornArmor.maxDex),
        requires: function () { return true; },
      });
    }

    /* Unarmoured baseline is always offered; its requires() keeps it out of the
       running the moment real armour is worn, so the max() never sees it. */
    contribs.push({
      type: 'base', source: 'unarmored',
      value: 10 + mods.dex,
      requires: function (ctx) { return !ctx.hasArmor; },
    });

    (base.classes || []).forEach(function (c) {
      var cd = cls(c.classId);
      if (!cd || !cd.unarmoredDefense) return;
      var ab = cd.unarmoredDefense;               // 'con' (Barbarian) or 'wis' (Monk)
      var monkStyle = ab === 'wis';
      contribs.push({
        type: 'base', source: c.classId + '_unarmored_defense',
        value: 10 + mods.dex + mods[ab],
        /* The Barbarian may hold a shield; the Monk may not. */
        requires: function (ctx) { return !ctx.hasArmor && (!monkStyle || !ctx.hasShield); },
      });
    });

    if (hasShield) {
      contribs.push({ type: 'add', source: 'shield', value: shieldAdd || 2, requires: function () { return true; } });
    }

    (progression.fightingStyles || runtime.fightingStyles || []).forEach(function (style) {
      if (style === 'defense') {
        contribs.push({ type: 'add', source: 'defense_style', value: 1, requires: function (ctx) { return ctx.hasArmor; } });
      }
    });

    /* Rings and cloaks of protection and similar flat AC items. */
    gatherEquippedItems(runtime).forEach(function (it) {
      if (it && it.mech && it.mech.type === 'ac_bonus' && it.mech.amount) {
        contribs.push({ type: 'add', source: it.id || 'item', value: it.mech.amount, requires: function () { return true; } });
      }
    });

    /* Spells and magical effects: Mage Armor (base), Shield (add +5), Barkskin
       (floor 16). They arrive already shaped as contributions on the effect. */
    (activeEffects || []).forEach(function (e) {
      if (e.kind === 'ac' && e.ac) {
        contribs.push({
          type: e.ac.type, source: e.ac.source || e.name || e.id,
          value: e.ac.value,
          requires: e.ac.requires || function () { return true; },
        });
      }
    });

    return { contribs: contribs, hasArmor: !!wornArmor, hasShield: hasShield };
  }

  function gatherEquippedItems(runtime) {
    var out = [];
    var eq = runtime.equipped || {};
    Object.keys(eq).forEach(function (slot) {
      var it = lookupItem(eq[slot]);
      if (it) out.push(it);
    });
    (runtime.attuned || []).forEach(function (ref) { var it = lookupItem(ref); if (it) out.push(it); });
    return out;
  }

  function resolveAc(contribs, ctx, mods, equip, activeForm) {
    if (activeForm && activeForm.ac != null) {
      return { ac: activeForm.ac, breakdown: [{ source: 'active_form', type: 'set', value: activeForm.ac, applied: true }] };
    }
    var bases = [], adds = [], sets = [], floors = [], breakdown = [];
    contribs.forEach(function (c) {
      if (c.requires && !c.requires(ctx)) return;
      var val = typeof c.value === 'function' ? c.value(mods, equip) : c.value;
      var entry = { source: c.source, type: c.type, value: val, applied: true };
      breakdown.push(entry);
      if (c.type === 'base') bases.push({ v: val, e: entry });
      else if (c.type === 'add' || c.type === 'bonus') adds.push(val);
      else if (c.type === 'set') sets.push(val);
      else if (c.type === 'floor') floors.push(val);
      else {
        /* A contribution nobody knows how to apply must SAY it was not
           applied. Silently marking it `applied: true` and then ignoring it is
           how a +2 AC spell came to change the breakdown, read correctly on
           the sheet, and leave the number the engine rolls against untouched.
           "bonus" is now understood — it is the obvious word and was the one
           actually being used — and anything still unrecognised is flagged. */
        entry.applied = false;
        entry.ignored = 'unknown AC contribution type: ' + c.type;
      }
    });

    var best = null;
    bases.forEach(function (b) { if (!best || b.v > best.v) best = b; });
    var computed = best ? best.v : 10 + mods.dex;
    /* Mark which base actually won, so the log can say "AC 17 = Mage Armor 15
       + shield 2" rather than leaving the reader to guess. */
    bases.forEach(function (b) { if (b !== best) b.e.applied = false; });

    adds.forEach(function (a) { computed += a; });
    sets.forEach(function (s) { computed = s; });
    floors.forEach(function (f) { computed = Math.max(computed, f); });

    return { ac: computed, breakdown: breakdown };
  }

  /* --------------------------------------------------------- spellcasting ---- */

  /* Effective full-caster level for a SINGLE-class half/third caster reading its
     own class table: nothing until the class actually gains spellcasting, then
     the level rounded UP by the divisor (Paladin 3 -> full-caster 2 -> 3 slots).
     Multiclassing uses floor() instead and is handled at the call site. */
  function ownTableLevel(classLevel, divisor) {
    return classLevel < divisor ? 0 : Math.ceil(classLevel / divisor);
  }

  function spellcasting(base, progression, runtime, mods, level, prof) {
    var combined = 0;
    var warlockLevels = 0;
    var primary = null;

    /* Half- and third-casters use two DIFFERENT calculations in 2014, and
       conflating them shorts a lone Paladin/Ranger a slot at every odd level
       (a level-3 Paladin should have 3 first-level slots, not 2). A SINGLE-class
       half-caster uses its own class table — equivalent to a full caster of
       ceil(level/2), except levels 1 have no spellcasting at all. Only when
       MULTICLASSED do the halves round down and add together. */
    var singleClass = (base.classes || []).length === 1;
    (base.classes || []).forEach(function (c) {
      var cd = cls(c.classId);
      if (!cd) return;
      var type = cd.casterType;
      if (type === 'full') combined += c.levels;
      else if (type === 'half') combined += singleClass ? ownTableLevel(c.levels, 2) : Math.floor(c.levels / 2);
      else if (type === 'third') combined += singleClass ? ownTableLevel(c.levels, 3) : Math.floor(c.levels / 3);
      else if (type === 'pact') warlockLevels += c.levels;
      if (!primary && cd.spellcasting && cd.spellcasting.ability) primary = { cd: cd, c: c };
    });

    var slotsMax = {};
    var row = MULTICLASS_SLOTS[Math.max(0, Math.min(20, combined))] || [];
    row.forEach(function (n, i) { slotsMax[i + 1] = n; });

    var slotsRemaining = {};
    var spent = runtime.slotsSpent || {};
    Object.keys(slotsMax).forEach(function (lv) {
      slotsRemaining[lv] = Math.max(0, slotsMax[lv] - (spent[lv] || 0));
    });

    var pactSlots = null;
    if (warlockLevels > 0) {
      var p = PACT_SLOTS[Math.max(1, Math.min(20, warlockLevels))];
      var pactSpent = (runtime.pactSlotsSpent || 0);
      pactSlots = { max: p.count, level: p.level, remaining: Math.max(0, p.count - pactSpent) };
    }

    var ability = primary ? primary.cd.spellcasting.ability : null;
    var mod = ability ? mods[ability] : 0;
    return {
      ability: ability,
      dc: ability ? 8 + prof + mod : null,
      attackBonus: ability ? prof + mod : null,
      casterLevel: combined,
      slotsMax: slotsMax,
      slotsRemaining: slotsRemaining,
      pactSlots: pactSlots,
      /* The class data carries this as `prepares` at the top level and as
         `spellcasting.type` inside; reading only the latter meant every caster
         in the game — cleric, druid, wizard, paladin — reported as a "known"
         caster, so nothing could tell a prepared caster from a sorcerer. */
      prepares: primary
        ? (primary.cd.prepares || primary.cd.spellcasting.prepares ||
          primary.cd.spellcasting.type || 'known')
        : null,
      cantripsKnown: (progression.cantripsKnown || []).slice(),
      prepared: (progression.preparedSpells || []).slice(),
      /* A wizard's spellbook is the pool they prepare FROM, and is not the
         same thing as what they have prepared today. Everyone else prepares
         from their class list, so they have no book. */
      spellbook: (progression.spellbook || []).slice(),
    };
  }

  /* --------------------------------------------------------------- derive ---- */

  /**
   * The one pure recomputation. Given the three stored layers and the currently
   * active effects, produce everything a rule needs to adjudicate: scores and
   * modifiers after every override, max HP, AC (with a breakdown), saves,
   * skills, passives, spellcasting and so on. It reads its arguments and writes
   * to none of them.
   */
  function derive(base, progression, runtime, activeEffects) {
    progression = progression || { levels: [] };
    runtime = runtime || {};
    activeEffects = activeEffects || [];

    var level = characterLevel(base, progression);
    var prof = proficiencyBonus(level);
    var exhaustion = runtime.exhaustion || 0;

    var abilities = computeAbilities(base, runtime, activeEffects, progression);
    var abilityMods = {};
    ABILITIES.forEach(function (ab) { abilityMods[ab] = abilityMod(abilities[ab]); });

    var hpMax = computeHpMax(base, progression, abilityMods, level, exhaustion, runtime);

    var equip = runtime.equipped || {};
    var acData = acContributions(base, progression, runtime, abilityMods, activeEffects, equip);
    var ac = resolveAc(acData.contribs, { hasArmor: acData.hasArmor, hasShield: acData.hasShield },
      abilityMods, equip, runtime.activeForm);

    var saveProfs = (base.proficiencies && base.proficiencies.saves) || [];
    var saves = {};
    ABILITIES.forEach(function (ab) {
      saves[ab] = abilityMods[ab] + (saveProfs.indexOf(ab) >= 0 ? prof : 0);
    });

    var skillProfs = (base.proficiencies && base.proficiencies.skills) || [];
    var expertise = (progression.expertise || (base.proficiencies && base.proficiencies.expertise) || []);
    var skills = {};
    Object.keys(SKILL_ABILITY).forEach(function (sk) {
      var ab = SKILL_ABILITY[sk];
      var isProf = skillProfs.indexOf(sk) >= 0;
      var isExpert = expertise.indexOf(sk) >= 0;
      var bonus = isExpert ? prof * 2 : (isProf ? prof : 0);
      skills[sk] = { ability: ab, mod: abilityMods[ab] + bonus, proficient: isProf, expertise: isExpert };
    });

    var passives = {
      perception: 10 + skills.perception.mod,
      investigation: 10 + skills.investigation.mod,
      insight: 10 + skills.insight.mod,
    };

    var speed = deriveSpeed(base, runtime, exhaustion);

    var sc = spellcasting(base, progression, runtime, abilityMods, level, prof);

    return {
      level: level,
      proficiencyBonus: prof,
      abilities: abilities,
      abilityMods: abilityMods,
      hpMax: hpMax,
      ac: ac.ac,
      acBreakdown: ac.breakdown,
      initiative: abilityMods.dex + (runtime.initiativeBonus || 0),
      speed: speed,
      saves: saves,
      skills: skills,
      passives: passives,
      spellcasting: sc,
      attacks: deriveAttacks(runtime),
      senses: deriveSenses(base, runtime),
      resistances: gatherDamageKeys(base, activeEffects, 'resist'),
      immunities: gatherDamageKeys(base, activeEffects, 'immune'),
      vulnerabilities: gatherDamageKeys(base, activeEffects, 'vulnerable'),
      carryCapacity: abilities.str * 15,
      exhaustion: exhaustion,
      dead: exhaustion >= 6 || !!(runtime.dead),
    };
  }

  function deriveSpeed(base, runtime, exhaustion) {
    if (runtime.activeForm && runtime.activeForm.speed != null) return runtime.activeForm.speed;
    var r = (function () { var T = table('RACES'); return T[base.subraceId] || T[base.raceId]; })();
    var speed = (r && r.speed) || base.speed || 30;
    if (exhaustion >= 5) return 0;                 // exhaustion 5: speed 0
    if (exhaustion >= 2) speed = Math.floor(speed / 2); // exhaustion 2: speed halved
    return speed;
  }

  function deriveAttacks(runtime) {
    if (runtime.activeForm && runtime.activeForm.attacks) return runtime.activeForm.attacks.slice();
    return [];
  }

  function deriveSenses(base, runtime) {
    var r = (function () { var T = table('RACES'); return T[base.subraceId] || T[base.raceId]; })();
    var senses = { darkvision: (r && r.darkvision) || 0 };
    if (runtime.senses) Object.assign(senses, runtime.senses);
    return senses;
  }

  function gatherDamageKeys(base, activeEffects, which) {
    var set = {};
    var r = (function () { var T = table('RACES'); return T[base.subraceId] || T[base.raceId]; })();
    if (r) {
      if (which === 'resist' && r.resistances) r.resistances.forEach(function (d) { set[d] = true; });
    }
    (activeEffects || []).forEach(function (e) {
      if (which === 'resist' && e.kind === 'damage_resist' && e.dtype) set[e.dtype] = true;
      if (which === 'immune' && e.kind === 'damage_immune' && e.dtype) set[e.dtype] = true;
      if (which === 'vulnerable' && e.kind === 'damage_vulnerable' && e.dtype) set[e.dtype] = true;
    });
    return Object.keys(set);
  }

  /* ------------------------------------------------------------ levelUp ------
     Validate and append exactly one level. Subclass timing is read from the
     class data (Cleric/Sorcerer/Warlock at 1, Wizard at 2, most at 3) and never
     hard-coded, so homebrew and errata cannot desync from it. */
  function levelUp(base, progression, choice) {
    choice = choice || {};
    var classId = choice.classId;
    if (!classId) throw new Error('levelUp: choice.classId is required');
    var cd = cls(classId);
    if (!cd) throw new Error('levelUp: unknown class ' + classId);

    var newBase = cloneJson(base);
    var newProg = cloneJson(progression || { levels: [] });
    newProg.levels = newProg.levels || [];

    var existing = newBase.classes.filter(function (c) { return c.classId === classId; })[0];
    var classLevelAfter = (existing ? existing.levels : 0) + 1;
    var globalLevelAfter = newProg.levels.length + 1;
    if (globalLevelAfter > 20) throw new Error('levelUp: character is already level 20');

    var subclassLevel = cd.subclassLevel || 3;
    var hasSubclass = existing ? !!existing.subclassId : false;
    if (choice.subclassId) {
      if (classLevelAfter < subclassLevel) throw new Error('levelUp: subclass chosen before class level ' + subclassLevel);
      hasSubclass = true;
    }
    if (classLevelAfter >= subclassLevel && !hasSubclass && !choice.subclassId) {
      throw new Error('levelUp: ' + classId + ' must choose a subclass at class level ' + subclassLevel);
    }

    var hitDie = cd.hitDie || 8;
    var hpGained;
    if (typeof choice.hpGained === 'number') hpGained = choice.hpGained;
    else if (globalLevelAfter === 1) hpGained = hitDie;           // first level is always the max die
    else if (choice.choice === 'roll' && typeof choice.roll === 'number') hpGained = choice.roll;
    else hpGained = Math.floor(hitDie / 2) + 1;                    // "take the average"

    if (existing) existing.levels = classLevelAfter;
    else newBase.classes.push({ classId: classId, subclassId: choice.subclassId || null, levels: 1 });
    if (choice.subclassId && existing) existing.subclassId = choice.subclassId;

    newProg.levels.push({
      level: globalLevelAfter, classId: classId,
      hpGained: hpGained,
      choice: choice.choice || (typeof choice.hpGained === 'number' ? 'fixed' : 'average'),
      asi: choice.asi || null, feat: choice.feat || null,
      spellsLearned: choice.spellsLearned || [],
    });
    newProg.xp = XP_BY_LEVEL[globalLevelAfter] != null ? XP_BY_LEVEL[globalLevelAfter] : (newProg.xp || 0);

    return { base: newBase, progression: newProg };
  }

  var XP_BY_LEVEL = [null, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

  /* ---------------------------------------------------------- buildFromSpec --
     Convenience constructor for fixtures and campaign seeds: a compact spec in,
     the three fully-formed layers out. Per-level hit points are materialised
     here — the actual numbers, stored — so derive() never has to re-decide them. */
  /**
   * The gear a new character starts with.
   *
   * This lived in the setup wizard, which meant it only applied to characters
   * made by clicking through the browser. Anything else that built a
   * character from a spec — a replacement after a death, a playtest party, an
   * AI-generated companion — got a level-5 fighter carrying nothing at all,
   * who was then refused every attack for having no weapon.
   *
   * It belongs here, in the one function every path goes through.
   *
   * These are the SRD starting kits reduced to what actually matters
   * mechanically: something to fight with, something to wear, and a way back
   * from a bad roll.
   */
  var STARTING_KITS = {
    barbarian: { weapon: 'greataxe', armor: null, extra: ['handaxe'] },
    bard: { weapon: 'rapier', armor: 'leather-armor', extra: [] },
    cleric: { weapon: 'mace', armor: 'scale-mail', shield: 'shield', extra: [] },
    druid: { weapon: 'scimitar', armor: 'leather-armor', shield: 'shield', extra: [] },
    fighter: { weapon: 'longsword', armor: 'chain-mail', shield: 'shield', extra: [] },
    monk: { weapon: 'shortsword', armor: null, extra: ['dart'] },
    paladin: { weapon: 'longsword', armor: 'chain-mail', shield: 'shield', extra: [] },
    ranger: { weapon: 'longbow', armor: 'studded-leather-armor', extra: ['shortsword'] },
    rogue: { weapon: 'shortsword', armor: 'leather-armor', extra: ['dagger'] },
    sorcerer: { weapon: 'dagger', armor: null, extra: ['quarterstaff'] },
    warlock: { weapon: 'dagger', armor: 'leather-armor', extra: [] },
    wizard: { weapon: 'quarterstaff', armor: null, extra: ['dagger'] },
  };

  function grantStartingKit(runtime, classId) {
    var ITEMS = table('ITEMS') || {};
    var kit = STARTING_KITS[classId] || STARTING_KITS.fighter;
    var inv = runtime.inventory = runtime.inventory || [];
    var equipped = runtime.equipped = runtime.equipped || {};

    function give(id, slot) {
      if (!id) return;
      var item = ITEMS[id];
      if (!item) return;
      if (inv.some(function (x) { return x.id === id; })) return;
      inv.push({
        uid: id, id: id, name: item.name || id,
        slot: slot || null, equipped: !!slot,
        damage: item.damage || null, ac: item.ac || null,
        properties: item.properties || [], weight: item.weight || 0,
      });
      if (slot) equipped[slot] = id;
    }

    give(kit.weapon, 'mainHand');
    give(kit.armor, 'armor');
    give(kit.shield, 'shield');
    (kit.extra || []).forEach(function (id) { give(id, null); });

    /* One healing potion, because a first fight that ends in a dead character
       because nobody thought to sell them one is nobody's idea of fun. */
    if (ITEMS['potion-of-healing'] && !inv.some(function (x) { return x.id === 'potion-of-healing'; })) {
      inv.push({
        uid: 'potion-of-healing', id: 'potion-of-healing',
        name: ITEMS['potion-of-healing'].name || 'Potion of Healing',
        heal: '2d4+2', consumable: true, weight: 0.5,
      });
    }
    if (!runtime.gold) runtime.gold = 15;
    return runtime;
  }

  function buildFromSpec(spec) {
    spec = spec || {};
    var classesIn = spec.classes || (spec.classId ? [{ classId: spec.classId, levels: spec.levels || 1, subclassId: spec.subclassId }] : []);
    var classes = classesIn.map(function (c) {
      var cd = cls(c.classId);
      var subclassId = c.subclassId || null;
      /* A cleric, sorcerer or warlock chooses at FIRST level in the 2014
         rules, and nothing in the builder ever asked — so they arrived with
         no subclass and none of its features, and the level-up prompt only
         fires when a new class level exactly equals the subclass level, so the
         choice was skipped permanently rather than deferred. The SRD carries a
         single subclass per class, so there is one legal answer; taking it is
         strictly better than leaving the character without one. */
      if (!subclassId && cd && cd.subclassLevel && (c.levels || 1) >= cd.subclassLevel && cd.subclass) {
        subclassId = cd.subclass.id || null;
      }
      return { classId: c.classId, subclassId: subclassId, levels: c.levels || 1 };
    });

    var firstClass = classes[0] ? cls(classes[0].classId) : null;
    var base = {
      raceId: spec.raceId || null,
      subraceId: spec.subraceId || null,
      classes: classes,
      backgroundId: spec.backgroundId || null,
      abilities: Object.assign({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, spec.abilities || {}),
      proficiencies: Object.assign(
        { skills: [], tools: [], languages: [], weapons: [], armor: [], saves: [], expertise: [] },
        spec.proficiencies || {}),
      name: spec.name || 'Unnamed',
      alignment: spec.alignment || 'N',
      speed: spec.speed,
    };
    /* The class data calls this savingThrows; this read saves, which does
       not exist, so NO generated character ever had a saving-throw
       proficiency. A level-5 fighter rolled Strength saves at +3 instead of
       +6 — every save in every fight, for every character the game made
       itself. Both spellings are accepted so a hand-written campaign
       character using either still works. */
    var classSaves = firstClass && (firstClass.savingThrows || firstClass.saves);
    if ((!base.proficiencies.saves || !base.proficiencies.saves.length) && classSaves) {
      base.proficiencies.saves = classSaves.slice();
    }

    /* Materialise the per-level HP in the order the classes were taken; the very
       first character level takes the maximum hit die, the rest use the supplied
       rolls or the average. */
    var levels = [];
    var globalIndex = 0;
    var rolls = spec.hpRolls || null;
    classes.forEach(function (c) {
      var cd = cls(c.classId);
      var hitDie = (cd && cd.hitDie) || 8;
      for (var i = 0; i < c.levels; i++) {
        var hpGained;
        if (rolls && rolls[globalIndex] != null) hpGained = rolls[globalIndex];
        else if (globalIndex === 0) hpGained = hitDie;
        else if (spec.hp === 'max') hpGained = hitDie;
        else hpGained = Math.floor(hitDie / 2) + 1;
        levels.push({ level: globalIndex + 1, classId: c.classId, hpGained: hpGained, choice: rolls ? 'roll' : (spec.hp || 'average') });
        globalIndex++;
      }
    });

    var progression = {
      xp: spec.xp != null ? spec.xp : (XP_BY_LEVEL[globalIndex] || 0),
      levels: levels,
      subclassChoices: spec.subclassChoices || {},
      /* Accept both the engine's own field names and the shorter ones the
         character generator produces. A generated wizard carried its spells in
         `spec.spells` and this only ever read `spec.preparedSpells`, so every
         auto-created caster reached the table with a full set of slots and an
         empty spell list. */
      preparedSpells: (spec.preparedSpells || spec.spells || []).slice(),
      /* A wizard prepares from their book, not from the class list, so the
         book has to exist from the moment the character does — otherwise
         their first long rest finds an empty pool and prepares nothing.

         Every list is COPIED, never aliased. Falling through to the same
         source array left `preparedSpells` and `spellbook` as one array
         wearing two names: preparing today's spells silently rewrote the
         spellbook, and a merge that visited both keys fought itself and
         reverted the change entirely. */
      spellbook: (spec.spellbook || spec.spells || spec.preparedSpells || []).slice(),
      cantripsKnown: (spec.cantripsKnown || spec.cantrips || []).slice(),
      fightingStyles: spec.fightingStyles || [],
      expertise: spec.expertise || [],
    };

    var conMod = abilityMod(base.abilities.con);
    var hpMax = 0;
    levels.forEach(function (l) { hpMax += l.hpGained; });
    hpMax += conMod * levels.length;

    var runtime = Object.assign({
      hp: hpMax, tempHp: 0, hitDiceSpent: {}, slotsSpent: {}, resources: {}, conditions: {},
      exhaustion: 0, concentratingOn: null, attuned: [], equipped: spec.equipped || {}, inventory: [],
      abilityOverride: {}, abilityDrain: {}, activeForm: null,
      deathSaves: { successes: 0, failures: 0 }, stable: false, dead: false, inspiration: false,
      gold: spec.gold || 0, pos: spec.pos || null, turn: null,
    }, spec.runtime || {});

    /* Unless the caller is explicitly supplying gear (a saved game, a campaign
       character with a hand-written loadout), give them the class kit. alse
       opts out; anything else opts in. */
    if (spec.startingKit !== false && !(spec.runtime && spec.runtime.inventory && spec.runtime.inventory.length)) {
      grantStartingKit(runtime, classes[0] && classes[0].classId);
    }

    /* And a caster with no spells is not a caster. The generator picks a legal
       list, but a character built by hand — or by any other path that did not
       think to ask — arrived with a full set of slots and an empty page. Same
       reasoning as the gear above: this belongs in the one function every
       character goes through, not in whichever screen last remembered. */
    if (spec.startingSpells !== false &&
        !progression.preparedSpells.length && !progression.cantripsKnown.length) {
      grantStartingSpells(base, progression, classes[0]);
    }

    return { base: base, progression: progression, runtime: runtime };
  }

  /**
   * Give a caster who was handed none a legal opening spell list.
   *
   * Defers to the character generator, which already knows each class's list,
   * which levels it can actually cast, and how big a wizard's book should be.
   * Resolved on call rather than aliased at load, because chargen.js loads
   * after this file in the page.
   */
  function grantStartingSpells(base, progression, firstClass) {
    if (!firstClass || !firstClass.classId) return;
    var cd = cls(firstClass.classId);
    if (!cd || !cd.spellcasting) return;

    var Chargen = (global.DND && global.DND.Chargen) || null;
    if (!Chargen && typeof require !== 'undefined') {
      try { Chargen = require('../gen/chargen.js'); } catch (e) { Chargen = null; }
    }
    if (!Chargen || !Chargen.generate) return;

    try {
      var spec = Chargen.generate({
        fixed: {
          classId: firstClass.classId,
          levels: firstClass.levels || 1,
          raceId: base.raceId || undefined,
        },
      });
      if (!spec) return;
      progression.preparedSpells = (spec.spells || []).slice();
      progression.cantripsKnown = (spec.cantrips || []).slice();
      progression.spellbook = (spec.spellbook || spec.spells || []).slice();
    } catch (e) { /* an empty caster is bad; a crash on character creation is worse */ }
  }

  function cloneJson(o) { return JSON.parse(JSON.stringify(o)); }

  var api = {
    ABILITIES: ABILITIES,
    SKILL_ABILITY: SKILL_ABILITY,
    PROFICIENCY_BONUS: PROFICIENCY_BONUS,
    MULTICLASS_SLOTS: MULTICLASS_SLOTS,
    PACT_SLOTS: PACT_SLOTS,
    XP_BY_LEVEL: XP_BY_LEVEL,
    setData: setData,
    abilityMod: abilityMod,
    characterLevel: characterLevel,
    proficiencyBonus: proficiencyBonus,
    derive: derive,
    levelUp: levelUp,
    buildFromSpec: buildFromSpec,
    grantStartingKit: grantStartingKit,
    STARTING_KITS: STARTING_KITS,
  };

  global.DND = global.DND || {};
  global.DND.Character = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
