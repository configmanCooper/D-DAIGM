/**
 * srd_classes.js
 * ---------------------------------------------------------------------------
 * D&D 5e SRD 5.1 (2014 ruleset). CC-BY-4.0 — see srd_license.js.
 * SRD 5.1 character classes (12) each with their one SRD subclass. Subclass
 * choice levels, class features, and spell slot progressions follow the 2014
 * rules exactly (no 2024 weapon mastery, no revised class features):
 *   Barbarian -> Path of the Berserker
 *   Bard -> College of Lore
 *   Cleric -> Life Domain
 *   Druid -> Circle of the Land
 *   Fighter -> Champion
 *   Monk -> Way of the Open Hand
 *   Paladin -> Oath of Devotion
 *   Ranger -> Hunter
 *   Rogue -> Thief
 *   Sorcerer -> Draconic Bloodline
 *   Warlock -> The Fiend
 *   Wizard -> School of Evocation
 *
 * `features[level]` is an array of `{ name, text, mech }` objects describing
 * everything a character of that class gains at that level (empty array if
 * nothing new besides ongoing progressions already granted). Subclass
 * features are folded into the class's own `features` map at the levels the
 * SRD subclass grants them (since each class here only ships one subclass).
 *
 * `mech.type` vocabulary (machine-readable class/subclass feature hooks):
 *   'asi'                  - Ability Score Improvement (or feat). Fields: amount, count (points to distribute, or a feat)
 *   'rage'                 - Barbarian Rage. Fields: usesByLevel (ref RAGE_USES), damageBonusByLevel (ref RAGE_DAMAGE)
 *   'unarmored_defense'    - AC = 10 + Dex mod + another ability mod while unarmored. Fields: secondAbility
 *   'extra_attack'         - attack multiple times with the Attack action. Fields: attacks (total attacks per Attack action)
 *   'fighting_style'       - grants a fighting style choice. Fields: options[]
 *   'action_surge'         - extra action once per rest(s). Fields: uses
 *   'second_wind'          - bonus action self-heal. Fields: dice, flat
 *   'indomitable'          - reroll a failed saving throw. Fields: uses
 *   'ki_points'            - resource pool for monk abilities. Fields: amount (equals monk level)
 *   'martial_arts'         - unarmed strike/monk weapon die and bonus unarmed strike. Fields: die
 *   'sneak_attack'         - extra damage once per turn under conditions. Fields: dice
 *   'expertise'            - double proficiency bonus on chosen skills/tools. Fields: count
 *   'cunning_action'       - bonus action Dash/Disengage/Hide. Fields: none
 *   'uncanny_dodge'        - reaction to halve attack damage. Fields: none
 *   'evasion'              - no damage on successful Dex save, half on failure (from area effects). Fields: none
 *   'channel_divinity'     - resource for divine options. Fields: uses
 *   'divine_smite'         - extra radiant damage on melee hit by spending a slot. Fields: dice_by_slot_level
 *   'lay_on_hands'         - healing pool. Fields: pool (5 * level)
 *   'favored_enemy'        - bonus vs a chosen creature type. Fields: count
 *   'natural_explorer'     - terrain expertise. Fields: count
 *   'wild_shape'           - transform into a beast. Fields: usesByRest, maxCR, restrictions
 *   'spellcasting'         - gain/improve spellcasting; see class.spellcasting block
 *   'pact_magic'           - warlock spell slot system; see class.spellcasting block
 *   'metamagic'            - spend sorcery points to alter spells. Fields: known
 *   'sorcery_points'       - resource pool equal to sorcerer level. Fields: amount
 *   'bardic_inspiration'   - grant an inspiration die to another creature. Fields: die, uses
 *   'song_of_rest'         - extra healing die during a short rest. Fields: die
 *   'jack_of_all_trades'   - add half proficiency bonus to non-proficient checks. Fields: none
 *   'reliable_talent'      - treat d20 rolls of 9 or lower as 10 for proficient checks. Fields: none
 *   'blindsense'           - detect hidden/invisible creatures within range. Fields: range
 *   'stunning_strike'      - spend a ki point to force a Con save or be stunned. Fields: none
 *   'deflect_missiles'     - reduce/catch ranged weapon damage as a reaction. Fields: none
 *   'slow_fall'            - reduce falling damage. Fields: amount (formula)
 *   'stillness_of_mind'    - end own charm/fright as an action. Fields: none
 *   'purity_of_body'       - immunity to disease and poison. Fields: none
 *   'diamond_soul'         - proficiency in all saves, spend ki to reroll a save. Fields: none
 *   'timeless_body'        - no longer age, no food/water/sleep required (druid/monk variants). Fields: none
 *   'perfect_self'         - regain ki on initiative roll if none left. Fields: amount
 *   'brutal_critical'      - extra weapon damage dice on a critical hit. Fields: dice
 *   'relentless_rage'      - stay at 1 hp instead of dropping to 0 while raging. Fields: none
 *   'persistent_rage'      - rage doesn't end early from lack of aggression/damage. Fields: none
 *   'feral_instinct'       - advantage on initiative; act on surprise if raging. Fields: none
 *   'divine_sense'         - detect celestials/fiends/undead. Fields: uses
 *   'aura'                 - passive bonus to nearby allies. Fields: radius, effect
 *   'oath_spells'          - always-prepared bonus spells. Fields: none
 *   'eldritch_invocations' - customizable warlock options. Fields: known
 *   'mystic_arcanum'       - one free casting per day of a fixed high level spell. Fields: spellLevel
 *   'pact_boon'            - warlock pact feature (blade/chain/tome). Fields: options
 *   'beast_spells'         - can cast druid spells while Wild Shaped. Fields: none
 *   'archdruid'            - unlimited Wild Shape uses. Fields: none
 *   'divine_intervention'  - call on deity for aid. Fields: chance
 *   'destroy_undead'       - Channel Divinity auto-destroys low-CR undead. Fields: maxCR
 *   'arcane_recovery'      - recover spell slots on a short rest once per day. Fields: slotLevels
 *   'evocation_savant'     - halved gold/time to copy evocation spells. Fields: none
 *   'sculpt_spells'        - protect allies from your own evocation spell areas. Fields: none
 *   'potent_cantrip'       - half damage to targets who succeed a save vs your cantrip. Fields: none
 *   'empowered_evocation'  - add Int mod to one evocation spell's damage. Fields: none
 *   'overchannel'          - max damage on a spell once, with rising self-harm. Fields: none
 *   'other'                - narrative/complex mechanic not otherwise modeled; see text.
 * ---------------------------------------------------------------------------
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.DND = root.DND || {}; root.DND.Data = root.DND.Data || {};
  Object.assign(root.DND.Data, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PROFICIENCY_BONUS = [null, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];

  // index = character level (spellcaster level for full casters); value = [1st..9th slot counts]
  var SPELL_SLOTS_FULL = {
    1: [2, 0, 0, 0, 0, 0, 0, 0, 0], 2: [3, 0, 0, 0, 0, 0, 0, 0, 0], 3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
    4: [4, 3, 0, 0, 0, 0, 0, 0, 0], 5: [4, 3, 2, 0, 0, 0, 0, 0, 0], 6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
    7: [4, 3, 3, 1, 0, 0, 0, 0, 0], 8: [4, 3, 3, 2, 0, 0, 0, 0, 0], 9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
    10: [4, 3, 3, 3, 2, 0, 0, 0, 0], 11: [4, 3, 3, 3, 2, 1, 0, 0, 0], 12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    13: [4, 3, 3, 3, 2, 1, 1, 0, 0], 14: [4, 3, 3, 3, 2, 1, 1, 0, 0], 15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    16: [4, 3, 3, 3, 2, 1, 1, 1, 0], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
    19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
  };

  // half-casters (Paladin, Ranger): index = class level; value = [1st..5th slot counts]
  var SPELL_SLOTS_HALF = {
    1: [0, 0, 0, 0, 0], 2: [2, 0, 0, 0, 0], 3: [3, 0, 0, 0, 0], 4: [3, 0, 0, 0, 0], 5: [4, 2, 0, 0, 0],
    6: [4, 2, 0, 0, 0], 7: [4, 3, 0, 0, 0], 8: [4, 3, 0, 0, 0], 9: [4, 3, 2, 0, 0], 10: [4, 3, 2, 0, 0],
    11: [4, 3, 3, 0, 0], 12: [4, 3, 3, 0, 0], 13: [4, 3, 3, 1, 0], 14: [4, 3, 3, 1, 0], 15: [4, 3, 3, 2, 0],
    16: [4, 3, 3, 2, 0], 17: [4, 3, 3, 3, 1], 18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2]
  };

  // Warlock Pact Magic: index = warlock level; value = { slots, level }.
  // IMPORTANT: Warlock casterType is 'pact', NOT 'full' or 'half'. WARLOCK_SLOTS is a completely
  // separate table and must NEVER be summed into a multiclass character's SPELL_SLOTS_FULL/HALF
  // total — pact magic slots are tracked independently per SRD 5.1 multiclassing rules.
  var WARLOCK_SLOTS = {
    1: { slots: 1, level: 1 }, 2: { slots: 2, level: 1 }, 3: { slots: 2, level: 2 }, 4: { slots: 2, level: 2 },
    5: { slots: 2, level: 3 }, 6: { slots: 2, level: 3 }, 7: { slots: 2, level: 4 }, 8: { slots: 2, level: 4 },
    9: { slots: 2, level: 5 }, 10: { slots: 2, level: 5 }, 11: { slots: 3, level: 5 }, 12: { slots: 3, level: 5 },
    13: { slots: 3, level: 5 }, 14: { slots: 3, level: 5 }, 15: { slots: 3, level: 5 }, 16: { slots: 3, level: 5 },
    17: { slots: 4, level: 5 }, 18: { slots: 4, level: 5 }, 19: { slots: 4, level: 5 }, 20: { slots: 4, level: 5 }
  };

  function asi(level) { return { name: 'Ability Score Improvement', text: 'You increase one ability score by 2, or two ability scores by 1 each (to a maximum of 20), or you take a feat instead.', mech: { type: 'asi', amount: 2, count: 1 } }; }

  var CLASSES = {

    barbarian: {
      id: 'barbarian', name: 'Barbarian', hitDie: 12, primaryAbility: ['str'], savingThrows: ['str', 'con'],
      subclassLevel: 3, casterType: 'none', prepares: 'none',
      armorProfs: ['light', 'medium', 'shields'], weaponProfs: ['simple', 'martial'], toolProfs: [],
      skillChoices: { count: 2, from: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
      startingEquipment: {
        options: [
          ['greataxe', 'explorers-pack', '4-javelins'],
          ['any-martial-melee-weapon', 'any-simple-weapon', 'explorers-pack', '4-javelins']
        ]
      },
      subclass: { id: 'berserker', name: 'Path of the Berserker' },
      spellcasting: null,
      features: {
        1: [
          { name: 'Rage', text: 'In battle you fight with primal ferocity. On your turn you can enter a rage as a bonus action, gaining advantage on Strength checks/saves, a melee damage bonus, and resistance to bludgeoning, piercing, and slashing damage; you can\'t cast or concentrate on spells while raging.', mech: { type: 'rage', usesByLevel: { 1: 2, 2: 2, 3: 3, 4: 3, 5: 3, 6: 4, 7: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 5, 13: 5, 14: 5, 15: 5, 16: 5, 17: 6, 18: 6, 19: 6, 20: 999 }, damageBonusByLevel: { 1: 2, 9: 3, 16: 4 } } },
          { name: 'Unarmored Defense', text: 'While not wearing armor, your AC equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.', mech: { type: 'unarmored_defense', secondAbility: 'con' } }
        ],
        2: [
          { name: 'Reckless Attack', text: 'You can choose to attack recklessly, giving you advantage on melee weapon attack rolls using Strength during this turn, but attack rolls against you have advantage until your next turn.', mech: { type: 'other' } },
          { name: 'Danger Sense', text: 'You have advantage on Dexterity saving throws against effects you can see, such as traps and spells, as long as you aren\'t blinded, deafened, or incapacitated.', mech: { type: 'other' } }
        ],
        3: [{ name: 'Frenzy', text: 'When you rage, you can choose to frenzy: you can make a single melee weapon attack as a bonus action on each of your turns after this one, but you suffer one level of exhaustion when the rage ends.', mech: { type: 'other' } }],
        4: [asi(4)],
        5: [
          { name: 'Extra Attack', text: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.', mech: { type: 'extra_attack', attacks: 2 } },
          { name: 'Fast Movement', text: 'Your speed increases by 10 feet while you aren\'t wearing heavy armor.', mech: { type: 'other' } }
        ],
        6: [{ name: 'Mindless Rage', text: 'You can\'t be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage.', mech: { type: 'other' } }],
        7: [{ name: 'Feral Instinct', text: 'Your instincts are so honed that you have advantage on initiative rolls, and if you are surprised at the start of combat but aren\'t incapacitated, you can act normally if you enter your rage before doing anything else.', mech: { type: 'feral_instinct' } }],
        8: [asi(8)],
        9: [{ name: 'Brutal Critical', text: 'You can roll one additional weapon damage die when determining the extra damage for a critical hit with a melee attack.', mech: { type: 'brutal_critical', dice: 1 } }],
        10: [{ name: 'Intimidating Presence', text: 'You can use your action to frighten someone with your menacing presence; the target must succeed on a Wisdom saving throw (DC = 8 + proficiency bonus + Charisma modifier) or be frightened of you until the end of your next turn.', mech: { type: 'other' } }],
        11: [{ name: 'Relentless Rage', text: 'If you drop to 0 hit points while raging and don\'t die outright, you can make a DC 10 Constitution save (increasing by 5 each time used since your last short/long rest) to drop to 1 hit point instead.', mech: { type: 'relentless_rage' } }],
        12: [asi(12)],
        13: [{ name: 'Brutal Critical (2 dice)', text: 'You now roll two additional weapon damage dice when determining the extra damage for a critical hit with a melee attack.', mech: { type: 'brutal_critical', dice: 2 } }],
        14: [{ name: 'Retaliation', text: 'When you take damage from a creature within 5 feet of you, you can use your reaction to make a melee weapon attack against that creature.', mech: { type: 'other' } }],
        15: [{ name: 'Persistent Rage', text: 'Your rage is so fierce it only ends early if you fall unconscious or if you choose to end it.', mech: { type: 'persistent_rage' } }],
        16: [asi(16)],
        17: [{ name: 'Brutal Critical (3 dice)', text: 'You now roll three additional weapon damage dice when determining the extra damage for a critical hit with a melee attack.', mech: { type: 'brutal_critical', dice: 3 } }],
        18: [{ name: 'Indomitable Might', text: 'If your total for a Strength check is less than your Strength score, you can use that score in place of the total.', mech: { type: 'other' } }],
        19: [asi(19)],
        20: [{ name: 'Primal Champion', text: 'Your Strength and Constitution scores increase by 4, to a maximum of 24.', mech: { type: 'other' } }]
      },
      visual: { armorSilhouette: 'bare-chested, fur and leather trim', palette: ['#7a3a1a', '#4a2a1a', '#c0602a'], iconicGear: ['greataxe', 'tattoos', 'furs'], notes: 'wild hair, war paint, heavy scarred muscle' }
    },

    bard: {
      id: 'bard', name: 'Bard', hitDie: 8, primaryAbility: ['cha'], savingThrows: ['dex', 'cha'],
      subclassLevel: 3, casterType: 'full', prepares: 'known',
      armorProfs: ['light'], weaponProfs: ['simple', 'hand-crossbow', 'longsword', 'rapier', 'shortsword'], toolProfs: ['three musical instruments of your choice'],
      skillChoices: { count: 3, from: ['any'] },
      startingEquipment: { options: [['rapier', 'diplomats-pack', 'lute', 'leather-armor', 'dagger'], ['longsword', 'entertainers-pack', 'musical-instrument', 'leather-armor', 'dagger']] },
      subclass: { id: 'lore', name: 'College of Lore' },
      spellcasting: {
        ability: 'cha', type: 'known', ritual: true, focus: 'musical instrument',
        cantripsKnown: [null, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
        spellsKnown: [null, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
        slots: 'SPELL_SLOTS_FULL'
      },
      features: {
        1: [
          { name: 'Bardic Inspiration', text: 'As a bonus action, you can inspire another creature within 60 feet who can hear you, giving it a Bardic Inspiration die (d6) it can add to one ability check, attack roll, or saving throw within the next 10 minutes.', mech: { type: 'bardic_inspiration', die: 'd6', uses: 'cha_mod' } },
          { name: 'Spellcasting', text: 'You have learned to cast spells through music and poetry. See the spellcasting block for details.', mech: { type: 'spellcasting' } }
        ],
        2: [
          { name: 'Jack of All Trades', text: 'You can add half your proficiency bonus, rounded down, to any ability check you make that doesn\'t already include your proficiency bonus.', mech: { type: 'jack_of_all_trades' } },
          { name: 'Song of Rest', text: 'You can use soothing music to help revitalize wounded allies during a short rest; they regain an extra 1d6 hit points if they spend Hit Dice to heal.', mech: { type: 'song_of_rest', die: 'd6' } }
        ],
        3: [
          { name: 'Bonus Proficiencies', text: 'You gain proficiency with three skills of your choice.', mech: { type: 'expertise', count: 0 } },
          { name: 'Cutting Words', text: 'You can use your reaction to expend a Bardic Inspiration die to subtract the roll from an attack, ability check, or damage roll made by a creature within 60 feet of you.', mech: { type: 'other' } },
          { name: 'Expertise', text: 'Choose two skill proficiencies; your proficiency bonus is doubled for checks made with them.', mech: { type: 'expertise', count: 2 } }
        ],
        4: [asi(4)],
        5: [
          { name: 'Bardic Inspiration (d8)', text: 'Your Bardic Inspiration die becomes a d8.', mech: { type: 'bardic_inspiration', die: 'd8' } },
          { name: 'Font of Inspiration', text: 'You regain all uses of Bardic Inspiration when you finish a short or long rest.', mech: { type: 'other' } }
        ],
        6: [{ name: 'Additional Magical Secrets', text: 'You learn two spells of your choice from any class\'s spell list; they count as bard spells for you.', mech: { type: 'other' } }],
        7: [],
        8: [asi(8)],
        9: [{ name: 'Song of Rest (d8)', text: 'Your Song of Rest die becomes a d8.', mech: { type: 'song_of_rest', die: 'd8' } }],
        10: [
          { name: 'Bardic Inspiration (d10)', text: 'Your Bardic Inspiration die becomes a d10.', mech: { type: 'bardic_inspiration', die: 'd10' } },
          { name: 'Expertise (additional)', text: 'Choose two more skill proficiencies to gain Expertise in.', mech: { type: 'expertise', count: 2 } },
          { name: 'Magical Secrets', text: 'You learn two spells of your choice from any class\'s spell list.', mech: { type: 'other' } }
        ],
        11: [],
        12: [asi(12)],
        13: [{ name: 'Song of Rest (d10)', text: 'Your Song of Rest die becomes a d10.', mech: { type: 'song_of_rest', die: 'd10' } }],
        14: [{ name: 'Magical Secrets (14th level)', text: 'You learn two more spells of your choice from any class\'s spell list.', mech: { type: 'other' } }],
        15: [{ name: 'Bardic Inspiration (d12)', text: 'Your Bardic Inspiration die becomes a d12.', mech: { type: 'bardic_inspiration', die: 'd12' } }],
        16: [asi(16)],
        17: [{ name: 'Song of Rest (d12)', text: 'Your Song of Rest die becomes a d12.', mech: { type: 'song_of_rest', die: 'd12' } }],
        18: [{ name: 'Magical Secrets (18th level)', text: 'You learn two more spells of your choice from any class\'s spell list.', mech: { type: 'other' } }],
        19: [asi(19)],
        20: [{ name: 'Superior Inspiration', text: 'When you roll initiative and have no uses of Bardic Inspiration left, you regain one use.', mech: { type: 'other' } }]
      },
      visual: { armorSilhouette: 'flowing coats, no heavy armor', palette: ['#6a2a8a', '#c9a227', '#3a1a4a'], iconicGear: ['lute', 'rapier', 'feathered cap'], notes: 'theatrical flair, colorful sashes, an instrument slung across the back' }
    },

    cleric: {
      id: 'cleric', name: 'Cleric', hitDie: 8, primaryAbility: ['wis'], savingThrows: ['wis', 'cha'],
      subclassLevel: 1, casterType: 'full', prepares: 'prepared',
      armorProfs: ['light', 'medium', 'shields'], weaponProfs: ['simple'], toolProfs: [],
      skillChoices: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
      startingEquipment: { options: [['mace', 'scale-mail', 'light-crossbow-20-bolts', 'priests-pack', 'shield', 'holy-symbol'], ['warhammer', 'scale-mail', 'priests-pack', 'shield', 'holy-symbol']] },
      subclass: { id: 'life', name: 'Life Domain' },
      spellcasting: {
        ability: 'wis', type: 'prepared', ritual: true, focus: 'holy symbol',
        cantripsKnown: [null, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        spellsKnown: null,
        slots: 'SPELL_SLOTS_FULL'
      },
      features: {
        1: [
          { name: 'Spellcasting', text: 'You can cast cleric spells, preparing a number equal to your Wisdom modifier + cleric level (minimum 1) each day.', mech: { type: 'spellcasting' } },
          { name: 'Divine Domain: Bonus Proficiency', text: 'You gain proficiency with heavy armor.', mech: { type: 'other' } },
          { name: 'Disciple of Life', text: 'Whenever you use a spell of 1st level or higher to restore hit points, the creature regains additional hit points equal to 2 + the spell\'s level.', mech: { type: 'other' } }
        ],
        2: [
          { name: 'Channel Divinity (1/rest)', text: 'You can channel divine energy to fuel magical effects; you regain the use after a short or long rest. Cleric channel divinity options: Turn Undead.', mech: { type: 'channel_divinity', uses: 1 } },
          { name: 'Preserve Life', text: 'As a Channel Divinity option, you can restore a total number of hit points equal to five times your cleric level, divided among any injured creatures within 30 feet, none brought above half their maximum.', mech: { type: 'other' } }
        ],
        3: [],
        4: [asi(4)],
        5: [{ name: 'Destroy Undead (CR 1/2)', text: 'When an undead fails its save against your Turn Undead, it is destroyed if its challenge rating is 1/2 or lower.', mech: { type: 'destroy_undead', maxCR: 0.5 } }],
        6: [
          { name: 'Channel Divinity (2/rest)', text: 'You can use Channel Divinity twice between rests.', mech: { type: 'channel_divinity', uses: 2 } },
          { name: 'Blessed Healer', text: 'The healing spells you cast on others also heal you for 2 + the spell\'s level.', mech: { type: 'other' } }
        ],
        7: [],
        8: [
          asi(8),
          { name: 'Destroy Undead (CR 1)', text: 'Undead of CR 1 or lower are destroyed by your Turn Undead.', mech: { type: 'destroy_undead', maxCR: 1 } },
          { name: 'Divine Strike', text: 'Once per turn you can deal an extra 1d8 radiant damage to a target you hit with a weapon attack.', mech: { type: 'other' } }
        ],
        9: [],
        10: [{ name: 'Divine Intervention', text: 'You can call on your deity to intervene on your behalf; roll percentile dice, and if you roll equal to or below your cleric level, your deity intervenes.', mech: { type: 'divine_intervention', chance: 'cleric_level_percent' } }],
        11: [{ name: 'Destroy Undead (CR 2)', text: 'Undead of CR 2 or lower are destroyed by your Turn Undead.', mech: { type: 'destroy_undead', maxCR: 2 } }],
        12: [asi(12)],
        13: [],
        14: [{ name: 'Destroy Undead (CR 3)', text: 'Undead of CR 3 or lower are destroyed by your Turn Undead.', mech: { type: 'destroy_undead', maxCR: 3 } }],
        15: [],
        16: [asi(16)],
        17: [
          { name: 'Destroy Undead (CR 4)', text: 'Undead of CR 4 or lower are destroyed by your Turn Undead.', mech: { type: 'destroy_undead', maxCR: 4 } },
          { name: 'Supreme Healing', text: 'When you would normally roll dice to restore hit points with a spell, you instead use the highest number possible for each die.', mech: { type: 'other' } }
        ],
        18: [{ name: 'Channel Divinity (3/rest)', text: 'You can use Channel Divinity three times between rests.', mech: { type: 'channel_divinity', uses: 3 } }],
        19: [asi(19)],
        20: [{ name: 'Divine Intervention (improved)', text: 'Your call for intervention succeeds automatically, no roll required.', mech: { type: 'other' } }]
      },
      visual: { armorSilhouette: 'heavy armor with holy vestments', palette: ['#e8d9a0', '#c9a227', '#f5f5f0'], iconicGear: ['mace', 'holy symbol', 'shield'], notes: 'radiant trim, symbols of faith, calm composed bearing' }
    },

    druid: {
      id: 'druid', name: 'Druid', hitDie: 8, primaryAbility: ['wis'], savingThrows: ['int', 'wis'],
      subclassLevel: 2, casterType: 'full', prepares: 'prepared',
      armorProfs: ['light', 'medium', 'shields (non-metal)'], weaponProfs: ['club', 'dagger', 'dart', 'javelin', 'mace', 'quarterstaff', 'scimitar', 'sickle', 'sling', 'spear'], toolProfs: ['herbalism-kit'],
      skillChoices: { count: 2, from: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
      startingEquipment: { options: [['wooden-shield', 'scimitar', 'leather-armor', 'explorers-pack', 'druidic-focus'], ['any-simple-weapon', 'leather-armor', 'explorers-pack', 'druidic-focus']] },
      subclass: { id: 'land', name: 'Circle of the Land' },
      spellcasting: {
        ability: 'wis', type: 'prepared', ritual: true, focus: 'druidic focus',
        cantripsKnown: [null, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
        spellsKnown: null,
        slots: 'SPELL_SLOTS_FULL'
      },
      features: {
        1: [
          { name: 'Druidic', text: 'You know Druidic, the secret language of druids, and can leave hidden messages that other druidic speakers automatically spot.', mech: { type: 'other' } },
          { name: 'Spellcasting', text: 'You can cast druid spells, preparing a number equal to your Wisdom modifier + druid level (minimum 1) each day.', mech: { type: 'spellcasting' } }
        ],
        2: [
          { name: 'Wild Shape', text: 'You can use your action to magically assume the shape of a beast you have seen before, twice per short/long rest, transforming for a number of hours equal to half your druid level (rounded down).', mech: { type: 'wild_shape', usesByRest: 2, maxCR: 0.25, restrictions: 'no flying/swimming speed at level 2' } },
          { name: 'Bonus Cantrip', text: 'You learn one additional druid cantrip of your choice.', mech: { type: 'other' } },
          { name: 'Natural Recovery', text: 'Once per day when you finish a short rest, you can recover spell slots with a combined level equal to or less than half your druid level (rounded up), none 6th level or higher.', mech: { type: 'other' } }
        ],
        3: [],
        4: [
          { name: 'Wild Shape (improved)', text: 'You can transform into a beast with a swimming speed and CR up to 1/2.', mech: { type: 'wild_shape', maxCR: 0.5 } },
          asi(4)
        ],
        5: [],
        6: [{ name: 'Land\'s Stride', text: 'Moving through nonmagical difficult terrain costs you no extra movement, and you can pass through nonmagical plants without being slowed and without taking damage from them if they have thorns or similar hazards. You also have advantage on saves against magically created or manipulated plants.', mech: { type: 'other' } }],
        7: [],
        8: [
          { name: 'Wild Shape (improved)', text: 'You can transform into a beast with a flying speed and CR up to 1.', mech: { type: 'wild_shape', maxCR: 1 } },
          asi(8)
        ],
        9: [],
        10: [{ name: 'Nature\'s Ward', text: 'You can\'t be charmed or frightened by elementals or fey, and you are immune to poison damage and the poisoned condition.', mech: { type: 'other' } }],
        11: [],
        12: [asi(12)],
        13: [],
        14: [{ name: 'Nature\'s Sanctuary', text: 'Beasts and plant creatures must make a Wisdom saving throw to attack you, and on a success are still hindered; on a failure the creature must choose a different target or forfeit the attack.', mech: { type: 'other' } }],
        15: [],
        16: [asi(16)],
        17: [],
        18: [
          { name: 'Timeless Body', text: 'You age much more slowly: for every 10 years that pass, your body ages only 1 year.', mech: { type: 'timeless_body' } },
          { name: 'Beast Spells', text: 'You can cast many druid spells in any shape you assume with Wild Shape.', mech: { type: 'beast_spells' } }
        ],
        19: [asi(19)],
        20: [{ name: 'Archdruid', text: 'You can use Wild Shape an unlimited number of times, and you can ignore verbal and somatic components of your druid spells as well as material components without a cost that aren\'t consumed by the spell.', mech: { type: 'archdruid' } }]
      },
      visual: { armorSilhouette: 'leathers, furs, wooden ornaments', palette: ['#3a6a2a', '#8a6a3a', '#c9a227'], iconicGear: ['wooden staff', 'leaf-shaped shield', 'antler circlet'], notes: 'earthy tones, natural adornments, animal-hide clothing' }
    },

    fighter: {
      id: 'fighter', name: 'Fighter', hitDie: 10, primaryAbility: ['str', 'dex'], savingThrows: ['str', 'con'],
      subclassLevel: 3, casterType: 'none', prepares: 'none',
      armorProfs: ['light', 'medium', 'heavy', 'shields'], weaponProfs: ['simple', 'martial'], toolProfs: [],
      skillChoices: { count: 2, from: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
      startingEquipment: { options: [['chain-mail', 'martial-weapon-and-shield', 'light-crossbow-20-bolts', 'dungeoneers-pack'], ['leather-armor', 'longbow', '20-arrows', 'two-martial-weapons', 'explorers-pack']] },
      subclass: { id: 'champion', name: 'Champion' },
      spellcasting: null,
      features: {
        1: [
          { name: 'Fighting Style', text: 'You adopt a particular style of fighting as your specialty: Archery, Defense, Dueling, Great Weapon Fighting, Protection, or Two-Weapon Fighting.', mech: { type: 'fighting_style', options: ['archery', 'defense', 'dueling', 'great-weapon-fighting', 'protection', 'two-weapon-fighting'] } },
          { name: 'Second Wind', text: 'On your turn you can use a bonus action to regain 1d10 + your fighter level in hit points. Once used, you must finish a short or long rest before using it again.', mech: { type: 'second_wind', dice: '1d10', flat: 'fighter_level' } }
        ],
        2: [{ name: 'Action Surge', text: 'You can take one additional action on your turn, once per short or long rest.', mech: { type: 'action_surge', uses: 1 } }],
        3: [{ name: 'Improved Critical', text: 'Your weapon attacks score a critical hit on a roll of 19 or 20.', mech: { type: 'other' } }],
        4: [asi(4)],
        5: [{ name: 'Extra Attack', text: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.', mech: { type: 'extra_attack', attacks: 2 } }],
        6: [asi(6)],
        7: [{ name: 'Remarkable Athlete', text: 'You can add half your proficiency bonus (round up) to any Strength, Dexterity, or Constitution check that doesn\'t already use your proficiency bonus. Your running long jump distance increases by a number of feet equal to your Strength modifier.', mech: { type: 'other' } }],
        8: [asi(8)],
        9: [{ name: 'Indomitable', text: 'You can reroll a saving throw that you fail, once per long rest; you must use the new roll.', mech: { type: 'indomitable', uses: 1 } }],
        10: [{ name: 'Additional Fighting Style', text: 'You can choose a second option from the Fighting Style class feature.', mech: { type: 'fighting_style', options: 'second choice' } }],
        11: [{ name: 'Extra Attack (2)', text: 'You attack three times whenever you take the Attack action on your turn.', mech: { type: 'extra_attack', attacks: 3 } }],
        12: [asi(12)],
        13: [{ name: 'Indomitable (2 uses)', text: 'You can use Indomitable twice between long rests.', mech: { type: 'indomitable', uses: 2 } }],
        14: [asi(14)],
        15: [{ name: 'Superior Critical', text: 'Your weapon attacks score a critical hit on a roll of 18-20.', mech: { type: 'other' } }],
        16: [asi(16)],
        17: [
          { name: 'Action Surge (2 uses)', text: 'You can use Action Surge twice before a rest, but only once on the same turn.', mech: { type: 'action_surge', uses: 2 } },
          { name: 'Indomitable (3 uses)', text: 'You can use Indomitable three times between long rests.', mech: { type: 'indomitable', uses: 3 } }
        ],
        18: [{ name: 'Survivor', text: 'At the start of each of your turns, you regain hit points equal to 5 + your Constitution modifier if you have no more than half your hit points left. This doesn\'t function if you have 0 hit points.', mech: { type: 'other' } }],
        19: [asi(19)],
        20: [{ name: 'Extra Attack (3)', text: 'You attack four times whenever you take the Attack action on your turn.', mech: { type: 'extra_attack', attacks: 4 } }]
      },
      visual: { armorSilhouette: 'heavy plate or chain, tabard', palette: ['#8a8a8a', '#c9a227', '#4a2a1a'], iconicGear: ['longsword', 'tower shield', 'tabard with heraldry'], notes: 'well-maintained armor, battle scars, disciplined stance' }
    },

    monk: {
      id: 'monk', name: 'Monk', hitDie: 8, primaryAbility: ['dex', 'wis'], savingThrows: ['str', 'dex'],
      subclassLevel: 3, casterType: 'none', prepares: 'none',
      armorProfs: [], weaponProfs: ['simple', 'shortsword'], toolProfs: ['choice: one artisan tool or musical instrument'],
      skillChoices: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
      startingEquipment: { options: [['shortsword', 'dungeoneers-pack', '10-darts'], ['any-simple-weapon', 'explorers-pack', '10-darts']] },
      subclass: { id: 'openHand', name: 'Way of the Open Hand' },
      spellcasting: null,
      features: {
        1: [
          { name: 'Unarmored Defense', text: 'While not wearing armor or wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.', mech: { type: 'unarmored_defense', secondAbility: 'wis' } },
          { name: 'Martial Arts', text: 'Your unarmed strikes and monk weapons use a d4 for damage (increasing at higher levels), you can use Dexterity instead of Strength for their attack and damage rolls, and you can make one unarmed strike as a bonus action when you take the Attack action with a monk weapon or unarmed strike.', mech: { type: 'martial_arts', die: 'd4' } }
        ],
        2: [
          { name: 'Ki', text: 'You gain ki points equal to your monk level, usable to fuel Flurry of Blows, Patient Defense, and Step of the Wind, regaining all points on a short or long rest.', mech: { type: 'ki_points', amount: 'monk_level' } },
          { name: 'Unarmored Movement', text: 'Your speed increases by 10 feet while you aren\'t wearing armor or wielding a shield.', mech: { type: 'other' } }
        ],
        3: [
          { name: 'Open Hand Technique', text: 'Whenever you hit a creature with one of the attacks granted by Flurry of Blows, you can impose one of the following effects: it must succeed on a Dexterity save or be knocked prone; it must make a Strength save or be pushed 15 feet away; or it can\'t take reactions until the end of your next turn.', mech: { type: 'other' } },
          { name: 'Deflect Missiles', text: 'You can use your reaction to deflect or catch a ranged weapon attack that hits you, reducing the damage by 1d10 + Dex modifier + monk level; if reduced to 0 you can catch the missile and throw it as an attack.', mech: { type: 'deflect_missiles' } }
        ],
        4: [
          asi(4),
          { name: 'Slow Fall', text: 'You can use your reaction when you fall to reduce falling damage by an amount equal to five times your monk level.', mech: { type: 'slow_fall', amount: '5x_monk_level' } }
        ],
        5: [
          { name: 'Extra Attack', text: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.', mech: { type: 'extra_attack', attacks: 2 } },
          { name: 'Stunning Strike', text: 'You can spend 1 ki point when you hit a creature with a melee weapon attack to force a Constitution save; on a failure, the creature is stunned until the end of your next turn.', mech: { type: 'stunning_strike' } }
        ],
        6: [
          { name: 'Ki-Empowered Strikes', text: 'Your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage.', mech: { type: 'other' } },
          { name: 'Wholeness of Body', text: 'You can use your action to regain hit points equal to three times your monk level, once per long rest.', mech: { type: 'other' } }
        ],
        7: [
          { name: 'Evasion', text: 'When subjected to an effect allowing a Dexterity save for half damage, you take no damage on a success and half damage on a failure.', mech: { type: 'evasion' } },
          { name: 'Stillness of Mind', text: 'You can use your action to end one effect on yourself that is causing you to be charmed or frightened.', mech: { type: 'stillness_of_mind' } }
        ],
        8: [asi(8)],
        9: [{ name: 'Unarmored Movement (improved)', text: 'You gain the ability to move along vertical surfaces and across liquids without falling during your turn.', mech: { type: 'other' } }],
        10: [{ name: 'Purity of Body', text: 'You are immune to disease and poison.', mech: { type: 'purity_of_body' } }],
        11: [{ name: 'Tranquility', text: 'At the end of a long rest, you gain the effect of a sanctuary spell that lasts until the start of your next long rest (until you cast a spell or make an attack).', mech: { type: 'other' } }],
        12: [asi(12)],
        13: [{ name: 'Tongue of the Sun and Moon', text: 'You can understand all spoken languages, and any creature that can understand a language can understand what you say.', mech: { type: 'other' } }],
        14: [{ name: 'Diamond Soul', text: 'You gain proficiency in all saving throws, and when you fail a save you can spend 1 ki point to reroll it.', mech: { type: 'diamond_soul' } }],
        15: [{ name: 'Timeless Body', text: 'You no longer need food or water, and you age more slowly: for every 10 years that pass, your body ages only 1 year.', mech: { type: 'timeless_body' } }],
        16: [asi(16)],
        17: [{ name: 'Quivering Palm', text: 'When you hit a creature with an unarmed strike, you can spend 3 ki points to set up vibrations; later you can spend your action to force a Constitution save, dealing massive necrotic damage or reducing the target to 0 hit points on a failure.', mech: { type: 'other' } }],
        18: [{ name: 'Empty Body', text: 'You can spend 4 ki points to become invisible for 1 minute, gaining resistance to all damage but force, or spend 8 ki points to cast astral projection without material components.', mech: { type: 'other' } }],
        19: [asi(19)],
        20: [{ name: 'Perfect Self', text: 'When you roll initiative and have no ki points remaining, you regain 4 ki points.', mech: { type: 'perfect_self', amount: 4 } }]
      },
      visual: { armorSilhouette: 'simple robes, wrapped hands and feet', palette: ['#c9622a', '#e8d9a0', '#3a3a3a'], iconicGear: ['quarterstaff', 'prayer beads', 'sash'], notes: 'lean athletic build, disciplined posture, minimal ornamentation' }
    },

    paladin: {
      id: 'paladin', name: 'Paladin', hitDie: 10, primaryAbility: ['str', 'cha'], savingThrows: ['wis', 'cha'],
      subclassLevel: 3, casterType: 'half', prepares: 'prepared',
      armorProfs: ['light', 'medium', 'heavy', 'shields'], weaponProfs: ['simple', 'martial'], toolProfs: [],
      skillChoices: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
      startingEquipment: { options: [['martial-weapon-and-shield', 'five-javelins', 'priests-pack', 'chain-mail', 'holy-symbol'], ['two-martial-weapons', 'explorers-pack', 'chain-mail', 'holy-symbol']] },
      subclass: { id: 'devotion', name: 'Oath of Devotion' },
      spellcasting: {
        ability: 'cha', type: 'prepared', ritual: false, focus: 'holy symbol',
        cantripsKnown: null, spellsKnown: null,
        slots: 'SPELL_SLOTS_HALF'
      },
      features: {
        1: [
          { name: 'Divine Sense', text: 'As an action, you can detect the presence of celestials, fiends, and undead within 60 feet that aren\'t behind total cover, a number of times equal to 1 + your Charisma modifier per long rest.', mech: { type: 'divine_sense', uses: '1_plus_cha_mod' } },
          { name: 'Lay on Hands', text: 'You have a pool of healing power equal to 5 times your paladin level that replenishes on a long rest; you can restore hit points or cure one disease/poison by touch, expending points from the pool.', mech: { type: 'lay_on_hands', pool: '5x_level' } }
        ],
        2: [
          { name: 'Fighting Style', text: 'You adopt a particular style of fighting as your specialty: Defense, Dueling, Great Weapon Fighting, or Protection.', mech: { type: 'fighting_style', options: ['defense', 'dueling', 'great-weapon-fighting', 'protection'] } },
          { name: 'Spellcasting', text: 'You can cast paladin spells, drawing on divine magic through prayer and meditation.', mech: { type: 'spellcasting' } },
          { name: 'Divine Smite', text: 'When you hit a creature with a melee weapon attack, you can expend one spell slot to deal extra radiant damage (2d8 for a 1st-level slot, plus 1d8 per slot level above 1st, to a max of 5d8; +1d8 more against undead/fiends).', mech: { type: 'divine_smite', dice_by_slot_level: { 1: '2d8', 2: '3d8', 3: '4d8', 4: '5d8', 5: '5d8' } } }
        ],
        3: [
          { name: 'Divine Health', text: 'The divine magic flowing through you makes you immune to disease.', mech: { type: 'other' } },
          { name: 'Oath Spells', text: 'You always have your Oath of Devotion spells prepared and they don\'t count against your number of prepared spells.', mech: { type: 'oath_spells' } },
          { name: 'Channel Divinity (Sacred Weapon & Turn the Unholy)', text: 'You gain two Channel Divinity options: Sacred Weapon (add Charisma modifier to attack rolls with one weapon, and it emits bright light, for 1 minute) and Turn the Unholy (force fiends and undead to make a Wisdom save or be turned).', mech: { type: 'channel_divinity', uses: 1 } }
        ],
        4: [asi(4)],
        5: [{ name: 'Extra Attack', text: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.', mech: { type: 'extra_attack', attacks: 2 } }],
        6: [{ name: 'Aura of Protection', text: 'You and friendly creatures within 10 feet of you gain a bonus to saving throws equal to your Charisma modifier (minimum +1).', mech: { type: 'aura', radius: 10, effect: 'save_bonus_cha_mod' } }],
        7: [{ name: 'Aura of Devotion', text: 'You and friendly creatures within 10 feet of you can\'t be charmed while you are conscious.', mech: { type: 'aura', radius: 10, effect: 'charm_immunity' } }],
        8: [asi(8)],
        9: [],
        10: [{ name: 'Aura of Courage', text: 'You and friendly creatures within 10 feet of you can\'t be frightened while you are conscious.', mech: { type: 'aura', radius: 10, effect: 'fear_immunity' } }],
        11: [{ name: 'Improved Divine Smite', text: 'All of your melee weapon attacks that hit deal an extra 1d8 radiant damage automatically, in addition to any Divine Smite used.', mech: { type: 'other' } }],
        12: [asi(12)],
        13: [],
        14: [{ name: 'Cleansing Touch', text: 'You can use your action to end one spell on yourself or on one willing creature you touch, a number of times equal to your Charisma modifier per long rest.', mech: { type: 'other' } }],
        15: [{ name: 'Purity of Spirit', text: 'You are constantly under the effect of a protection from evil and good spell.', mech: { type: 'other' } }],
        16: [asi(16)],
        17: [],
        18: [{ name: 'Aura Improvements', text: 'The radius of your Auras of Protection, Devotion, and Courage increases to 30 feet.', mech: { type: 'aura', radius: 30, effect: 'range_increase' } }],
        19: [asi(19)],
        20: [{ name: 'Holy Nimbus', text: 'You can emanate an aura of sunlight as an action: enemies within 30 feet take 10 radiant damage if they start their turn there, you have advantage on saves against spells cast by fiends/undead, and the aura sheds bright light. Usable once per long rest.', mech: { type: 'other' } }]
      },
      visual: { armorSilhouette: 'gleaming heavy plate, cape', palette: ['#e8d9a0', '#c9a227', '#f5f5f0'], iconicGear: ['longsword', 'kite shield', 'holy symbol'], notes: 'radiant/polished armor, heraldic devices, unwavering posture' }
    },

    ranger: {
      id: 'ranger', name: 'Ranger', hitDie: 10, primaryAbility: ['dex', 'wis'], savingThrows: ['str', 'dex'],
      subclassLevel: 3, casterType: 'half', prepares: 'known',
      armorProfs: ['light', 'medium', 'shields'], weaponProfs: ['simple', 'martial'], toolProfs: [],
      skillChoices: { count: 3, from: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
      startingEquipment: { options: [['scale-mail', 'two-shortswords', 'dungeoneers-pack', 'longbow-20-arrows'], ['leather-armor', 'two-simple-melee-weapons', 'explorers-pack', 'longbow-20-arrows']] },
      subclass: { id: 'hunter', name: 'Hunter' },
      spellcasting: {
        ability: 'wis', type: 'known', ritual: false, focus: null,
        cantripsKnown: null,
        spellsKnown: [null, 0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
        slots: 'SPELL_SLOTS_HALF'
      },
      features: {
        1: [
          { name: 'Favored Enemy', text: 'You have significant experience studying, tracking, hunting, and even talking to a certain type of enemy, gaining advantage on Wisdom (Survival) checks to track them and Intelligence checks to recall information about them, plus you learn a related language.', mech: { type: 'favored_enemy', count: 1 } },
          { name: 'Natural Explorer', text: 'You are particularly familiar with one type of natural environment, gaining benefits when traveling and foraging there.', mech: { type: 'natural_explorer', count: 1 } }
        ],
        2: [
          { name: 'Fighting Style', text: 'You adopt a particular style of fighting as your specialty: Archery, Defense, Dueling, or Two-Weapon Fighting.', mech: { type: 'fighting_style', options: ['archery', 'defense', 'dueling', 'two-weapon-fighting'] } },
          { name: 'Spellcasting', text: 'You have learned to use the magical essence of nature to cast spells.', mech: { type: 'spellcasting' } }
        ],
        3: [
          { name: 'Hunter\'s Prey', text: 'You gain one of the following options: Colossus Slayer (extra 1d8 damage once per turn to a wounded creature), Giant Killer (reaction attack against a Large+ creature that misses you in melee), or Horde Breaker (extra attack against a second creature within 5 feet of your original target).', mech: { type: 'other' } },
          { name: 'Primeval Awareness', text: 'You can expend a spell slot to sense whether aberrations, celestials, dragons, elementals, fey, fiends, or undead are present within 1 mile (6 miles in favored terrain).', mech: { type: 'other' } }
        ],
        4: [asi(4)],
        5: [{ name: 'Extra Attack', text: 'You can attack twice, instead of once, whenever you take the Attack action on your turn.', mech: { type: 'extra_attack', attacks: 2 } }],
        6: [{ name: 'Favored Enemy and Natural Explorer Improvements', text: 'You gain an additional favored enemy and an additional favored terrain.', mech: { type: 'favored_enemy', count: 2 } }],
        7: [{ name: 'Defensive Tactics', text: 'You gain one of the following options: Escape the Horde (opportunity attacks against you have disadvantage), Multiattack Defense (+4 AC against additional attacks after the first from the same creature in a turn), or Steel Will (advantage on saves against being frightened).', mech: { type: 'other' } }],
        8: [asi(8), { name: 'Land\'s Stride', text: 'Moving through nonmagical difficult terrain costs you no extra movement, and you can pass through nonmagical plants without being slowed by them.', mech: { type: 'other' } }],
        9: [],
        10: [
          { name: 'Natural Explorer (improved)', text: 'You gain a third favored terrain.', mech: { type: 'natural_explorer', count: 3 } },
          { name: 'Hide in Plain Sight', text: 'You can spend 1 minute creating camouflage for yourself, gaining a +10 bonus to Dexterity (Stealth) checks as long as you remain there without moving or taking actions.', mech: { type: 'other' } }
        ],
        11: [{ name: 'Volley', text: 'You can make a ranged attack against any number of creatures within 10 feet of a point you can see within range, making a separate attack roll for each target.', mech: { type: 'other' } }],
        12: [asi(12)],
        13: [],
        14: [
          { name: 'Vanish', text: 'You can take the Hide action as a bonus action, and you can\'t be tracked by nonmagical means unless you choose to leave a trail.', mech: { type: 'other' } }
        ],
        15: [{ name: 'Superior Hunter\'s Defense', text: 'When you take damage, you can use your reaction to gain resistance to that damage type for the triggering damage and until the end of the current turn.', mech: { type: 'other' } }],
        16: [asi(16)],
        17: [],
        18: [{ name: 'Feral Senses', text: 'You gain the ability to attack a hidden or invisible creature within 5 feet without disadvantage, and you are aware of invisible creatures within 30 feet, provided the creature isn\'t hidden from you and you aren\'t blinded or deafened.', mech: { type: 'other' } }],
        19: [asi(19)],
        20: [{ name: 'Foe Slayer', text: 'Once per turn, you can add your Wisdom modifier to an attack roll or damage roll made against one of your favored enemies.', mech: { type: 'other' } }]
      },
      visual: { armorSilhouette: 'leather and cloaks, practical layered gear', palette: ['#3a5a2a', '#6a5a3a', '#2a2a2a'], iconicGear: ['longbow', 'shortswords', 'hooded cloak'], notes: 'weathered travel gear, quiver of arrows, watchful stance' }
    },

    rogue: {
      id: 'rogue', name: 'Rogue', hitDie: 8, primaryAbility: ['dex'], savingThrows: ['dex', 'int'],
      subclassLevel: 3, casterType: 'none', prepares: 'none',
      armorProfs: ['light'], weaponProfs: ['simple', 'hand-crossbow', 'longsword', 'rapier', 'shortsword'], toolProfs: ['thieves-tools'],
      skillChoices: { count: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'] },
      startingEquipment: { options: [['rapier', 'shortbow-20-arrows', 'burglars-pack', 'leather-armor', 'two-daggers', 'thieves-tools'], ['shortsword', 'shortsword', 'dungeoneers-pack', 'leather-armor', 'two-daggers', 'thieves-tools']] },
      subclass: { id: 'thief', name: 'Thief' },
      spellcasting: null,
      features: {
        1: [
          { name: 'Expertise', text: 'Choose two of your skill proficiencies (or one skill and thieves\' tools); your proficiency bonus is doubled for checks made with them.', mech: { type: 'expertise', count: 2 } },
          { name: 'Sneak Attack', text: 'Once per turn, you can deal extra damage to one creature you hit with an attack if you have advantage on the attack roll, or if the target is within 5 feet of another enemy of the target and you don\'t have disadvantage.', mech: { type: 'sneak_attack', dice: { 1: '1d6', 3: '2d6', 5: '3d6', 7: '4d6', 9: '5d6', 11: '6d6', 13: '7d6', 15: '8d6', 17: '9d6', 19: '10d6' } } },
          { name: 'Thieves\' Cant', text: 'You know Thieves\' Cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation.', mech: { type: 'other' } }
        ],
        2: [{ name: 'Cunning Action', text: 'You can use a bonus action on each of your turns to Dash, Disengage, or Hide.', mech: { type: 'cunning_action' } }],
        3: [
          { name: 'Fast Hands', text: 'You can use the bonus action granted by Cunning Action to make a Dexterity (Sleight of Hand) check, use thieves\' tools to disarm a trap or open a lock, or take the Use an Object action.', mech: { type: 'other' } },
          { name: 'Second-Story Work', text: 'You can climb faster than normal, and when you make a running jump the distance you cover increases by a number of feet equal to your Dexterity modifier.', mech: { type: 'other' } }
        ],
        4: [asi(4)],
        5: [{ name: 'Uncanny Dodge', text: 'When an attacker you can see hits you with an attack, you can use your reaction to halve the attack\'s damage against you.', mech: { type: 'uncanny_dodge' } }],
        6: [{ name: 'Expertise (additional)', text: 'Choose two more of your proficiencies to gain Expertise in.', mech: { type: 'expertise', count: 2 } }],
        7: [{ name: 'Evasion', text: 'When subjected to an effect allowing a Dexterity save for half damage, you take no damage on a success and half damage on a failure.', mech: { type: 'evasion' } }],
        8: [asi(8)],
        9: [{ name: 'Supreme Sneak', text: 'You have advantage on Dexterity (Stealth) checks if you move no more than half your speed on the same turn.', mech: { type: 'other' } }],
        10: [asi(10)],
        11: [{ name: 'Reliable Talent', text: 'Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10.', mech: { type: 'reliable_talent' } }],
        12: [asi(12)],
        13: [{ name: 'Use Magic Device', text: 'You ignore all class, race, and level requirements on the use of magic items.', mech: { type: 'other' } }],
        14: [{ name: 'Blindsense', text: 'If you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you.', mech: { type: 'blindsense', range: 10 } }],
        15: [{ name: 'Slippery Mind', text: 'You gain proficiency in Wisdom saving throws.', mech: { type: 'other' } }],
        16: [asi(16)],
        17: [{ name: 'Thief\'s Reflexes', text: 'You can take two turns during the first round of any combat: one at your normal initiative and a second at your initiative minus 10.', mech: { type: 'other' } }],
        18: [{ name: 'Elusive', text: 'No attack roll has advantage against you while you aren\'t incapacitated.', mech: { type: 'other' } }],
        19: [asi(19)],
        20: [{ name: 'Stroke of Luck', text: 'If your attack misses a target within range, you can turn it into a hit; alternatively, if you fail an ability check, you can treat the d20 roll as a 20. Usable once per short/long rest.', mech: { type: 'other' } }]
      },
      visual: { armorSilhouette: 'dark leathers, hooded, close-fitting', palette: ['#2a2a2a', '#4a2a4a', '#8a2a2a'], iconicGear: ['daggers', 'thieves tools', 'hooded cloak'], notes: 'concealed pouches, soft-soled boots, quick furtive movement' }
    },

    sorcerer: {
      id: 'sorcerer', name: 'Sorcerer', hitDie: 6, primaryAbility: ['cha'], savingThrows: ['con', 'cha'],
      subclassLevel: 1, casterType: 'full', prepares: 'known',
      armorProfs: [], weaponProfs: ['dagger', 'dart', 'sling', 'quarterstaff', 'light-crossbow'], toolProfs: [],
      skillChoices: { count: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
      startingEquipment: { options: [['light-crossbow-20-bolts', 'component-pouch', 'dungeoneers-pack', 'two-daggers'], ['any-simple-weapon', 'arcane-focus', 'explorers-pack', 'two-daggers']] },
      subclass: { id: 'draconicBloodline', name: 'Draconic Bloodline' },
      spellcasting: {
        ability: 'cha', type: 'known', ritual: false, focus: 'arcane focus',
        cantripsKnown: [null, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
        spellsKnown: [null, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
        slots: 'SPELL_SLOTS_FULL'
      },
      features: {
        1: [
          { name: 'Spellcasting', text: 'An event in your past left an indelible mark on you, giving you the power to cast spells drawn from the sorcerer spell list.', mech: { type: 'spellcasting' } },
          { name: 'Draconic Resilience', text: 'Your hit point maximum increases by 1 and again every time you gain a level, and when unarmored your AC equals 13 + Dex modifier.', mech: { type: 'hp_per_level_and_ac' } }
        ],
        2: [{ name: 'Font of Magic', text: 'You gain sorcery points equal to your sorcerer level, which you can convert to/from spell slots.', mech: { type: 'sorcery_points', amount: 'sorcerer_level' } }],
        3: [{ name: 'Metamagic', text: 'You gain two Metamagic options of your choice (from Careful, Distant, Empowered, Extended, Heightened, Quickened, Subtle, or Twinned Spell); you learn more at higher levels.', mech: { type: 'metamagic', known: 2 } }],
        4: [asi(4)],
        5: [],
        6: [{ name: 'Elemental Affinity', text: 'When you cast a spell that deals damage of the type associated with your draconic ancestry, add your Charisma modifier to one damage roll; you can also spend 1 sorcery point to gain resistance to that damage type for 1 hour.', mech: { type: 'other' } }],
        7: [],
        8: [asi(8)],
        9: [],
        10: [{ name: 'Metamagic (3rd option)', text: 'You learn a third Metamagic option.', mech: { type: 'metamagic', known: 3 } }],
        11: [],
        12: [asi(12)],
        13: [],
        14: [{ name: 'Dragon Wings', text: 'As a bonus action, you can sprout a pair of spectral dragon wings and gain a flying speed equal to your current speed.', mech: { type: 'other' } }],
        15: [],
        16: [asi(16)],
        17: [{ name: 'Metamagic (4th option)', text: 'You learn a fourth Metamagic option.', mech: { type: 'metamagic', known: 4 } }],
        18: [{ name: 'Draconic Presence', text: 'You can spend an action and 5 sorcery points to exude an aura of awe or fear (your choice), forcing creatures within 60 feet to succeed on a Wisdom save or be charmed/frightened of you for 1 minute.', mech: { type: 'other' } }],
        19: [asi(19)],
        20: [{ name: 'Sorcerous Restoration', text: 'You regain 4 expended sorcery points whenever you finish a short rest.', mech: { type: 'other' } }]
      },
      visual: { armorSilhouette: 'unarmored, draconic accents', palette: ['#8a2020', '#c9a227', '#2a2a2a'], iconicGear: ['ornate staff', 'draconic-scale jewelry'], notes: 'faint scales visible on skin, eyes with reptilian slit pupils, arcane energy crackling at the fingertips' }
    },

    warlock: {
      id: 'warlock', name: 'Warlock', hitDie: 8, primaryAbility: ['cha'], savingThrows: ['wis', 'cha'],
      subclassLevel: 1, casterType: 'pact', prepares: 'known',
      armorProfs: ['light'], weaponProfs: ['simple'], toolProfs: [],
      skillChoices: { count: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
      startingEquipment: { options: [['light-crossbow-20-bolts', 'component-pouch', 'scholars-pack', 'leather-armor', 'any-simple-weapon', 'two-daggers'], ['any-simple-weapon', 'arcane-focus', 'dungeoneers-pack', 'leather-armor', 'two-daggers']] },
      subclass: { id: 'fiend', name: 'The Fiend' },
      spellcasting: {
        ability: 'cha', type: 'known', ritual: true, focus: 'arcane focus',
        cantripsKnown: [null, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
        spellsKnown: [null, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
        slots: 'WARLOCK_SLOTS'
      },
      features: {
        1: [
          { name: 'Otherworldly Patron: The Fiend', text: 'You have made a pact with a fiend from the lower planes, who offers forbidden knowledge or power in exchange for service.', mech: { type: 'other' } },
          { name: 'Dark One\'s Blessing', text: 'When you reduce a hostile creature to 0 hit points, you gain temporary hit points equal to your Charisma modifier + your warlock level (minimum 1).', mech: { type: 'other' } },
          { name: 'Pact Magic', text: 'You can cast spells using a small number of spell slots that are always cast at your maximum slot level and recharge on a short or long rest.', mech: { type: 'pact_magic' } }
        ],
        2: [{ name: 'Eldritch Invocations', text: 'You gain two eldritch invocations of your choice, gaining more as you level, granting special abilities of your choosing (e.g. Agonizing Blast, Devil\'s Sight, Mask of Many Faces).', mech: { type: 'eldritch_invocations', known: 2 } }],
        3: [{ name: 'Pact Boon', text: 'You choose a Pact Boon: Pact of the Chain (special familiar), Pact of the Blade (summon a magic weapon), or Pact of the Tome (a Book of Shadows granting extra cantrips).', mech: { type: 'pact_boon', options: ['chain', 'blade', 'tome'] } }],
        4: [asi(4)],
        5: [],
        6: [{ name: 'Dark One\'s Own Luck', text: 'You can add a d10 to one ability check or saving throw you make, once per short/long rest.', mech: { type: 'other' } }],
        7: [],
        8: [asi(8)],
        9: [],
        10: [{ name: 'Fiendish Resilience', text: 'You can choose a damage type when you finish a short or long rest; you have resistance to that damage type until you choose a different one with this feature again.', mech: { type: 'other' } }],
        11: [{ name: 'Mystic Arcanum (6th level)', text: 'You learn one 6th-level spell from the warlock list that you can cast once per long rest without expending a spell slot.', mech: { type: 'mystic_arcanum', spellLevel: 6 } }],
        12: [asi(12)],
        13: [{ name: 'Mystic Arcanum (7th level)', text: 'You learn one 7th-level spell you can cast once per long rest without a slot.', mech: { type: 'mystic_arcanum', spellLevel: 7 } }],
        14: [{ name: 'Hurl Through Hell', text: 'When you hit a creature with an attack, you can banish it to the lower planes momentarily, dealing 10d10 psychic damage when it returns, usable once per long rest.', mech: { type: 'other' } }],
        15: [{ name: 'Mystic Arcanum (8th level)', text: 'You learn one 8th-level spell you can cast once per long rest without a slot.', mech: { type: 'mystic_arcanum', spellLevel: 8 } }],
        16: [asi(16)],
        17: [{ name: 'Mystic Arcanum (9th level)', text: 'You learn one 9th-level spell you can cast once per long rest without a slot.', mech: { type: 'mystic_arcanum', spellLevel: 9 } }],
        18: [],
        19: [asi(19)],
        20: [{ name: 'Eldritch Master', text: 'You can spend 1 minute entreating your patron for aid to regain all expended Pact Magic spell slots, once per long rest.', mech: { type: 'other' } }]
      },
      visual: { armorSilhouette: 'unarmored or light, occult trappings', palette: ['#3a1a4a', '#8a2020', '#1a1a1a'], iconicGear: ['grimoire', 'pact weapon', 'ritual dagger'], notes: 'unsettling eyes, faint otherworldly markings, an aura of quiet menace' }
    },

    wizard: {
      id: 'wizard', name: 'Wizard', hitDie: 6, primaryAbility: ['int'], savingThrows: ['int', 'wis'],
      subclassLevel: 2, casterType: 'full', prepares: 'spellbook',
      armorProfs: [], weaponProfs: ['dagger', 'dart', 'sling', 'quarterstaff', 'light-crossbow'], toolProfs: [],
      skillChoices: { count: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
      startingEquipment: { options: [['quarterstaff', 'component-pouch', 'scholars-pack', 'spellbook'], ['dagger', 'arcane-focus', 'explorers-pack', 'spellbook']] },
      subclass: { id: 'evocation', name: 'School of Evocation' },
      spellcasting: {
        ability: 'int', type: 'prepared', ritual: true, focus: 'arcane focus or spellbook',
        cantripsKnown: [null, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        spellsKnown: null,
        slots: 'SPELL_SLOTS_FULL'
      },
      features: {
        1: [
          { name: 'Spellcasting', text: 'You can cast wizard spells from your spellbook, preparing a number equal to your Intelligence modifier + wizard level (minimum 1) each day.', mech: { type: 'spellcasting' } },
          { name: 'Arcane Recovery', text: 'Once per day when you finish a short rest, you can recover expended spell slots with a combined level equal to or less than half your wizard level (rounded up), none 6th level or higher.', mech: { type: 'arcane_recovery', slotLevels: 'half_level_rounded_up' } }
        ],
        2: [
          { name: 'Evocation Savant', text: 'The gold and time you must spend to copy an evocation spell into your spellbook is halved.', mech: { type: 'evocation_savant' } },
          { name: 'Sculpt Spells', text: 'When you cast an evocation spell that affects other creatures you can see, you can choose a number of them equal to 1 + the spell\'s level to automatically succeed on their saving throws and take no damage if they would normally take half on a success.', mech: { type: 'sculpt_spells' } }
        ],
        3: [],
        4: [asi(4)],
        5: [],
        6: [{ name: 'Potent Cantrip', text: 'When a creature succeeds on a saving throw against your cantrip, it still takes half the cantrip\'s damage (but suffers no additional effect).', mech: { type: 'potent_cantrip' } }],
        7: [],
        8: [asi(8)],
        9: [],
        10: [{ name: 'Empowered Evocation', text: 'You can add your Intelligence modifier to one damage roll of any wizard evocation spell you cast.', mech: { type: 'empowered_evocation' } }],
        11: [],
        12: [asi(12)],
        13: [],
        14: [{ name: 'Overchannel', text: 'When you cast a 1st- through 5th-level wizard spell that deals damage, you can deal maximum damage with it; doing so a second time before a long rest deals 2d12 necrotic damage to you per spell level, increasing further with each subsequent use.', mech: { type: 'overchannel' } }],
        15: [],
        16: [asi(16)],
        17: [],
        18: [{ name: 'Spell Mastery', text: 'Choose a 1st-level and a 2nd-level wizard spell in your spellbook; you can cast them at their lowest level without expending a spell slot.', mech: { type: 'other' } }],
        19: [asi(19)],
        20: [{ name: 'Signature Spells', text: 'Choose two 3rd-level wizard spells as signature spells; you always have them prepared, and you can cast each once at 3rd level without expending a spell slot, regaining the ability after a short/long rest.', mech: { type: 'other' } }]
      },
      visual: { armorSilhouette: 'robes, no armor', palette: ['#2a3a8a', '#c9a227', '#4a2a6a'], iconicGear: ['spellbook', 'quarterstaff', 'component pouch'], notes: 'ink-stained fingers, layered robes with arcane sigils, a satchel of scrolls' }
    }

  };

  return {
    CLASSES: CLASSES, SPELL_SLOTS_FULL: SPELL_SLOTS_FULL, SPELL_SLOTS_HALF: SPELL_SLOTS_HALF,
    WARLOCK_SLOTS: WARLOCK_SLOTS, PROFICIENCY_BONUS: PROFICIENCY_BONUS
  };
});
