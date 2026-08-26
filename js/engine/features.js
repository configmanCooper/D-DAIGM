/*
 * features.js — what a class feature actually DOES.
 *
 * The class data has been machine-readable from the beginning. Sixty distinct
 * `mech.type` values describe Rage, Sneak Attack, Ki, Lay on Hands, Action
 * Surge, Second Wind, Unarmored Defense, Divine Smite and the rest, each with
 * its own progression table. A search of every engine, ai, ui and gen source
 * file for those sixty names found exactly TWO being read: `asi` and
 * `extra_attack`. Fifty-eight feature types were description.
 *
 * That is worse than not having them. A barbarian's sheet listed Rage, the
 * level-up screen congratulated them on gaining it, and there was no rage in
 * the game — the player is told they have a thing they do not have.
 *
 * So this is the registry the audit asked for, keyed by `mech.type`. Every
 * type in the data has an entry, and each entry says what the engine does with
 * it. A type that is not simulated says so out loud through `implemented:
 * false`, which is what lets the character sheet distinguish "you have Rage,
 * here are your two uses" from "Danger Sense is described in your features and
 * the Dungeon Master will adjudicate it".
 *
 * Adding a feature means adding it here, not threading a new special case
 * through derivation, rest and the action bar.
 */
(function (global) {
  'use strict';

  function data() {
    if (global.DND && global.DND.Data) return global.DND.Data;
    if (typeof require !== 'undefined') {
      try { return require('../data/srd_classes.js'); } catch (e) { return null; }
    }
    return null;
  }

  function classTable() {
    var d = data();
    if (!d) return {};
    return d.CLASSES || d.classes || d;
  }

  /* ------------------------------------------------------- the registry --- */

  /* Resolve a value the data expresses as a word: "monk_level", "5x_level",
     "cha_mod". Keeping these in one place stops each reader inventing its own
     spelling of the same idea. */
  function amountFrom(spec, classLevel, mods) {
    if (typeof spec === 'number') return spec;
    if (typeof spec !== 'string') return 0;
    if (/^\d+x_level$/.test(spec)) return parseInt(spec, 10) * classLevel;
    if (/_level$/.test(spec)) return classLevel;
    var m = /^(str|dex|con|int|wis|cha)_mod$/.exec(spec);
    if (m) return Math.max(1, (mods && mods[m[1]]) || 0);
    var n = parseInt(spec, 10);
    return isFinite(n) ? n : 0;
  }

  /* Pick the entry of a {level: value} table that applies at this class level:
     the highest key at or below it. */
  function byLevel(tableObj, classLevel) {
    if (!tableObj) return null;
    var best = null, bestKey = -1;
    Object.keys(tableObj).forEach(function (k) {
      var lv = parseInt(k, 10);
      if (lv <= classLevel && lv > bestKey) { bestKey = lv; best = tableObj[k]; }
    });
    return best;
  }

  /**
   * Every feature type the data uses.
   *
   * `resource` describes a pool: how big, and which rest refills it. `ac` adds
   * a contribution to Armour Class. `implemented: false` means the engine
   * carries the text and nothing more — deliberately declared, so nothing
   * silently pretends.
   */
  var FEATURES = {
    /* ---- pools, all derived from the class level ---- */
    rage: {
      implemented: true, label: 'Rage',
      resource: function (mech, lv) {
        var uses = byLevel(mech.usesByLevel, lv);
        return { id: 'rage', max: uses === 999 ? Infinity : (uses || 0), per: 'long' };
      },
      damageBonus: function (mech, lv) { return byLevel(mech.damageBonusByLevel, lv) || 0; },
    },
    second_wind: {
      implemented: true, label: 'Second Wind',
      resource: function () { return { id: 'second_wind', max: 1, per: 'short' }; },
    },
    action_surge: {
      implemented: true, label: 'Action Surge',
      resource: function (mech) { return { id: 'action_surge', max: mech.uses || 1, per: 'short' }; },
    },
    ki_points: {
      implemented: true, label: 'Ki',
      resource: function (mech, lv) { return { id: 'ki', max: amountFrom(mech.amount, lv), per: 'short' }; },
    },
    sorcery_points: {
      implemented: true, label: 'Sorcery Points',
      resource: function (mech, lv) { return { id: 'sorcery', max: amountFrom(mech.amount, lv), per: 'long' }; },
    },
    lay_on_hands: {
      implemented: true, label: 'Lay on Hands',
      resource: function (mech, lv) { return { id: 'lay_on_hands', max: amountFrom(mech.pool, lv), per: 'long' }; },
    },
    bardic_inspiration: {
      implemented: true, label: 'Bardic Inspiration',
      resource: function (mech, lv, mods) {
        return { id: 'bardic_inspiration', max: amountFrom(mech.uses || 'cha_mod', lv, mods), per: 'long' };
      },
      die: function (mech) { return mech.die || 'd6'; },
    },
    channel_divinity: {
      implemented: true, label: 'Channel Divinity',
      resource: function (mech) { return { id: 'channel_divinity', max: mech.uses || 1, per: 'short' }; },
    },
    indomitable: {
      implemented: true, label: 'Indomitable',
      resource: function (mech) { return { id: 'indomitable', max: mech.uses || 1, per: 'long' }; },
    },
    arcane_recovery: {
      implemented: true, label: 'Arcane Recovery',
      resource: function () { return { id: 'arcane_recovery', max: 1, per: 'long' }; },
    },
    divine_intervention: {
      implemented: true, label: 'Divine Intervention',
      resource: function () { return { id: 'divine_intervention', max: 1, per: 'long' }; },
    },
    divine_sense: {
      implemented: true, label: 'Divine Sense',
      resource: function (mech, lv, mods) {
        return { id: 'divine_sense', max: 1 + Math.max(0, (mods && mods.cha) || 0), per: 'long' };
      },
    },

    /* ---- Armour Class ---- */
    unarmored_defense: {
      implemented: true, label: 'Unarmored Defense',
      /* 10 + Dexterity + the class's second ability, and only with no armour.
         The barbarian (Constitution) may hold a shield; the monk (Wisdom) may
         not, and the data distinguishes them by `secondAbility` alone.

         character.js already had a block for this. It read `cls.unarmoredDefense`,
         a field that does not exist on any class — the data expresses it as a
         level-1 feature with `mech.type: 'unarmored_defense'` — so the block
         never ran once. A level-5 barbarian with Constitution 16 derived AC 12
         instead of 15, for the whole game. */
      ac: function (mech) {
        var second = mech.secondAbility || 'con';
        var monkStyle = second === 'wis';
        return {
          type: 'base', source: 'unarmored_defense_' + second,
          value: function (mods) { return 10 + (mods.dex || 0) + (mods[second] || 0); },
          requires: function (ctx) {
            return !ctx.hasArmor && (!monkStyle || !ctx.hasShield);
          },
        };
      },
    },
    hp_per_level_and_ac: {
      implemented: true, label: 'Draconic Resilience',
      ac: function (mech) {
        return {
          type: 'base', source: 'draconic_resilience',
          value: function (mods) { return (mech.acBase || 13) + (mods.dex || 0); },
          requires: function (ctx) { return !ctx.hasArmor; },
        };
      },
    },

    /* ---- damage riders, read at the point of the attack ---- */
    sneak_attack: {
      implemented: true, label: 'Sneak Attack',
      dice: function (mech, lv) { return byLevel(mech.dice, lv) || '1d6'; },
    },
    divine_smite: {
      implemented: true, label: 'Divine Smite',
      dice: function (mech, slotLevel) {
        return (mech.dice_by_slot_level || {})[slotLevel] || '2d8';
      },
    },
    martial_arts: {
      implemented: true, label: 'Martial Arts',
      dice: function (mech, lv) { return byLevel(mech.dice, lv) || '1d4'; },
    },
    brutal_critical: {
      implemented: true, label: 'Brutal Critical',
      extraCritDice: function (mech) { return mech.dice || 1; },
    },

    /* ---- already handled elsewhere in the engine ---- */
    extra_attack: { implemented: true, label: 'Extra Attack', handledBy: 'character.extraAttacks' },
    asi: { implemented: true, label: 'Ability Score Improvement', handledBy: 'levelup' },
    spellcasting: { implemented: true, label: 'Spellcasting', handledBy: 'character.spellcasting' },
    pact_magic: { implemented: true, label: 'Pact Magic', handledBy: 'character.spellcasting' },
    oath_spells: { implemented: true, label: 'Oath Spells', handledBy: 'character.spellcasting' },
    expertise: { implemented: true, label: 'Expertise', handledBy: 'character.skills' },
    fighting_style: { implemented: true, label: 'Fighting Style', handledBy: 'character.resolveAc' },

    /* ---- carried as text, adjudicated by the Dungeon Master ----
       Declared rather than omitted. A feature missing from this table is a
       feature nobody decided about; a feature listed here with
       `implemented: false` is one we have looked at and chosen not to
       simulate, and the sheet can say so honestly. */
    cunning_action: { implemented: false, label: 'Cunning Action' },
    uncanny_dodge: { implemented: false, label: 'Uncanny Dodge' },
    evasion: { implemented: false, label: 'Evasion' },
    reliable_talent: { implemented: false, label: 'Reliable Talent' },
    blindsense: { implemented: false, label: 'Blindsense' },
    jack_of_all_trades: { implemented: false, label: 'Jack of All Trades' },
    song_of_rest: { implemented: false, label: 'Song of Rest' },
    metamagic: { implemented: false, label: 'Metamagic' },
    eldritch_invocations: { implemented: false, label: 'Eldritch Invocations' },
    pact_boon: { implemented: false, label: 'Pact Boon' },
    mystic_arcanum: { implemented: false, label: 'Mystic Arcanum' },
    wild_shape: { implemented: false, label: 'Wild Shape' },
    beast_spells: { implemented: false, label: 'Beast Spells' },
    archdruid: { implemented: false, label: 'Archdruid' },
    timeless_body: { implemented: false, label: 'Timeless Body' },
    favored_enemy: { implemented: false, label: 'Favored Enemy' },
    natural_explorer: { implemented: false, label: 'Natural Explorer' },
    aura: { implemented: false, label: 'Aura' },
    destroy_undead: { implemented: false, label: 'Destroy Undead' },
    stunning_strike: { implemented: false, label: 'Stunning Strike' },
    deflect_missiles: { implemented: false, label: 'Deflect Missiles' },
    slow_fall: { implemented: false, label: 'Slow Fall' },
    purity_of_body: { implemented: false, label: 'Purity of Body' },
    stillness_of_mind: { implemented: false, label: 'Stillness of Mind' },
    diamond_soul: { implemented: false, label: 'Diamond Soul' },
    perfect_self: { implemented: false, label: 'Perfect Self' },
    feral_instinct: { implemented: false, label: 'Feral Instinct' },
    relentless_rage: { implemented: false, label: 'Relentless Rage' },
    persistent_rage: { implemented: false, label: 'Persistent Rage' },
    sculpt_spells: { implemented: false, label: 'Sculpt Spells' },
    potent_cantrip: { implemented: false, label: 'Potent Cantrip' },
    empowered_evocation: { implemented: false, label: 'Empowered Evocation' },
    evocation_savant: { implemented: false, label: 'Evocation Savant' },
    overchannel: { implemented: false, label: 'Overchannel' },
    other: { implemented: false, label: 'Class feature' },
  };

  /* --------------------------------------------------------- gathering --- */

  /**
   * Every feature a character has actually gained, with the class level it was
   * gained at — which is what the progression tables are indexed by.
   */
  function gained(base) {
    var out = [];
    var T = classTable();
    (base.classes || []).forEach(function (c) {
      var cd = T[c.classId];
      if (!cd || !cd.features) return;
      var levels = c.levels || 0;
      for (var lv = 1; lv <= levels; lv++) {
        var list = cd.features[lv] || cd.features[String(lv)] || [];
        (Array.isArray(list) ? list : [list]).forEach(function (f) {
          if (!f) return;
          out.push({
            classId: c.classId, classLevel: levels, gainedAt: lv,
            name: f.name, text: f.text || '',
            mech: f.mech || null,
            type: (f.mech && f.mech.type) || null,
          });
        });
      }
    });
    return out;
  }

  /**
   * The pools a character has, at their sizes.
   *
   * A feature that appears at several levels (Action Surge at 2 and again at
   * 17, Channel Divinity at 2, 6 and 18) must use the LATEST entry, not the
   * first — otherwise a level-18 cleric has one use of Channel Divinity
   * because that is what the level-2 row said.
   */
  function resources(base, mods) {
    var out = {};
    gained(base).forEach(function (f) {
      var def = f.type && FEATURES[f.type];
      if (!def || !def.resource) return;
      var r = def.resource(f.mech || {}, f.classLevel, mods || {});
      if (!r || !r.id) return;
      var prev = out[r.id];
      /* Later grants supersede earlier ones for the same pool. */
      if (!prev || f.gainedAt >= prev.gainedAt) {
        out[r.id] = {
          id: r.id, max: r.max, per: r.per,
          label: def.label, gainedAt: f.gainedAt, classId: f.classId,
        };
      }
    });
    return out;
  }

  /* Armour Class contributions from class features. */
  function acContributions(base) {
    var out = [];
    gained(base).forEach(function (f) {
      var def = f.type && FEATURES[f.type];
      if (!def || !def.ac) return;
      out.push(def.ac(f.mech || {}));
    });
    return out;
  }

  /* The highest Sneak Attack dice this character has. */
  function sneakAttackDice(base) {
    var best = null;
    gained(base).forEach(function (f) {
      if (f.type !== 'sneak_attack') return;
      best = FEATURES.sneak_attack.dice(f.mech || {}, f.classLevel);
    });
    return best;
  }

  /* The rage damage bonus at this character's barbarian level. */
  function rageDamageBonus(base) {
    var bonus = 0;
    gained(base).forEach(function (f) {
      if (f.type !== 'rage') return;
      bonus = FEATURES.rage.damageBonus(f.mech || {}, f.classLevel);
    });
    return bonus;
  }

  /* Which of a character's features the engine does not simulate. Used by the
     sheet so a player is told what the Dungeon Master will be adjudicating
     rather than being left to discover it by trying. */
  function narrativeOnly(base) {
    return gained(base).filter(function (f) {
      var def = f.type && FEATURES[f.type];
      return !def || def.implemented === false;
    }).map(function (f) { return f.name; });
  }

  /* Every mech.type present in the data that this registry has no entry for.
     A test asserts this is empty, so a feature added to the data cannot
     silently do nothing. */
  function unregisteredTypes() {
    var T = classTable();
    var missing = {};
    Object.keys(T).forEach(function (cid) {
      var byLvl = (T[cid] && T[cid].features) || {};
      Object.keys(byLvl).forEach(function (lv) {
        (byLvl[lv] || []).forEach(function (f) {
          var t = f && f.mech && f.mech.type;
          if (t && !FEATURES[t]) missing[t] = true;
        });
      });
    });
    return Object.keys(missing).sort();
  }

  var api = {
    FEATURES: FEATURES,
    gained: gained,
    resources: resources,
    acContributions: acContributions,
    sneakAttackDice: sneakAttackDice,
    rageDamageBonus: rageDamageBonus,
    narrativeOnly: narrativeOnly,
    unregisteredTypes: unregisteredTypes,
    amountFrom: amountFrom,
    byLevel: byLevel,
  };

  global.DND = global.DND || {};
  global.DND.Features = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
