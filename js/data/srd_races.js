/**
 * srd_races.js
 * ---------------------------------------------------------------------------
 * D&D 5e SRD 5.1 (2014 ruleset). CC-BY-4.0 — see srd_license.js.
 * SRD 5.1 player races and subraces. Ability score increases are fixed per
 * race/subrace (2014 rules), not floating 2024-style bonuses, and no race
 * grants a feat.
 *
 * `traits[].mech.type` vocabulary (machine-readable trait hooks consumed by
 * the rules engine):
 *   'save_adv'            - advantage on saving throws vs a given tag. Fields: vs (e.g. 'poison','charmed','magic','all')
 *   'damage_resist'       - resistance to a damage type. Fields: dtype
 *   'damage_immune'       - immunity to a damage type. Fields: dtype
 *   'condition_immune'    - immunity to a condition. Fields: condition
 *   'hp_per_level'        - bonus hit points gained per character level. Fields: amount
 *   'skill_prof'          - grants proficiency in a skill. Fields: skill (or 'choice' + count)
 *   'skill_expertise'     - doubles proficiency bonus on a skill under a condition. Fields: skill, condition
 *   'weapon_prof'         - grants weapon proficiencies. Fields: weapons[]
 *   'armor_prof'          - grants armor proficiencies. Fields: armor[]
 *   'tool_prof'           - grants tool proficiencies. Fields: tools[]
 *   'language'            - grants a language. Fields: language
 *   'cantrip'             - grants a spell known usable at will. Fields: spell, ability, uses ('at_will'|'long_rest')
 *   'innate_spell'        - grants a spell usable a limited number of times. Fields: spell, perDay, minLevel, ability
 *   'darkvision_bonus'    - increases darkvision range. Fields: amount
 *   'speed_bonus'         - increases walking speed. Fields: amount
 *   'sleep_immune'        - immune to magical sleep. Fields: none
 *   'extra_language'      - may learn N additional languages of choice. Fields: amount
 *   'extra_skill'         - may choose N additional skill proficiencies. Fields: amount
 *   'extra_feat'          - grants a feat at character creation. Fields: amount
 *   'asi_flex'            - variant ASI: +1 to N abilities of choice. Fields: amount, count
 *   'other'               - narrative or complex mechanic not otherwise modeled; see text.
 * ---------------------------------------------------------------------------
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.DND = root.DND || {}; root.DND.Data = root.DND.Data || {};
  Object.assign(root.DND.Data, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var RACES = {

    dwarf: {
      id: 'dwarf', name: 'Dwarf', size: 'Medium', speed: 25,
      asi: { con: 2 },
      age: 'Dwarves reach adulthood around age 50 and can live to be 350 years old.',
      alignmentHint: 'Most dwarves are lawful, believing firmly in the benefits of a well-ordered society, and are good, with a strong sense of fair play and a belief in the honor of a just cause.',
      description: 'Bold and hardy, dwarves are known as skilled warriors, miners, and workers of stone and metal. They can live to be more than 400 years old, and their commitment to a life of steady labor shapes their culture.',
      darkvision: 60, languages: ['Common', 'Dwarvish'], extraLanguages: 0,
      traits: [
        { name: 'Darkvision', text: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.', mech: { type: 'other' } },
        { name: 'Dwarven Resilience', text: 'You have advantage on saving throws against poison, and you have resistance against poison damage.', mech: { type: 'save_adv', vs: 'poison' } },
        { name: 'Dwarven Resilience (resistance)', text: 'You have resistance to poison damage.', mech: { type: 'damage_resist', dtype: 'poison' } },
        { name: 'Dwarven Combat Training', text: 'You have proficiency with the battleaxe, handaxe, light hammer, and warhammer.', mech: { type: 'weapon_prof', weapons: ['battleaxe', 'handaxe', 'light-hammer', 'warhammer'] } },
        { name: 'Tool Proficiency', text: 'You gain proficiency with one type of artisan\'s tools of your choice: smith\'s tools, brewer\'s supplies, or mason\'s tools.', mech: { type: 'tool_prof', tools: ['choice:smith', 'choice:brewer', 'choice:mason'] } },
        { name: 'Stonecunning', text: 'Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient and add double your proficiency bonus.', mech: { type: 'skill_expertise', skill: 'history', condition: 'stonework' } }
      ],
      profs: { weapons: ['battleaxe', 'handaxe', 'light-hammer', 'warhammer'], tools: ['choice:smith:brewer:mason'], armor: [], skills: [] },
      resistances: ['poison'],
      subraces: {
        hill: {
          id: 'hill', name: 'Hill Dwarf', asi: { wis: 1 },
          traits: [{ name: 'Dwarven Toughness', text: 'Your hit point maximum increases by 1, and increases by 1 again whenever you gain a level.', mech: { type: 'hp_per_level', amount: 1 } }]
        },
        mountain: {
          id: 'mountain', name: 'Mountain Dwarf', asi: { str: 2 },
          traits: [{ name: 'Dwarven Armor Training', text: 'You have proficiency with light and medium armor.', mech: { type: 'armor_prof', armor: ['light', 'medium'] } }]
        }
      },
      visual: { palette: ['#8a6a4a', '#c9a227', '#5c4632'], build: 'stocky', heightRange: [48, 56], hairStyles: ['braided beard', 'thick plaits', 'close crop'], notes: 'broad shoulders, thick limbs, elaborately braided beards, heavy boots' }
    },

    elf: {
      id: 'elf', name: 'Elf', size: 'Medium', speed: 30,
      asi: { dex: 2 },
      age: 'Elves reach physical maturity around the same age as humans, but their elven souls are more patient, and they can live to be 750 years old.',
      alignmentHint: 'Elves love freedom, variety, and self-expression, leaning strongly towards the gentler aspects of chaos.',
      description: 'Elves are a magical people of otherworldly grace, living in the world but not entirely part of it. They are more slender than humans, with sharply angular features and pointed ears.',
      darkvision: 60, languages: ['Common', 'Elvish'], extraLanguages: 0,
      traits: [
        { name: 'Darkvision', text: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.', mech: { type: 'other' } },
        { name: 'Keen Senses', text: 'You have proficiency in the Perception skill.', mech: { type: 'skill_prof', skill: 'perception' } },
        { name: 'Fey Ancestry', text: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.', mech: { type: 'save_adv', vs: 'charmed' } },
        { name: 'Fey Ancestry (sleep)', text: 'Magic can\'t put you to sleep.', mech: { type: 'sleep_immune' } },
        { name: 'Trance', text: 'Elves don\'t need to sleep. Instead, they meditate deeply for 4 hours a day, gaining the same benefit a human does from 8 hours of sleep.', mech: { type: 'other' } }
      ],
      profs: { weapons: [], tools: [], armor: [], skills: ['perception'] },
      resistances: [],
      subraces: {
        high: {
          id: 'high', name: 'High Elf', asi: { int: 1 },
          traits: [
            { name: 'Elf Weapon Training', text: 'You have proficiency with the longsword, shortsword, shortbow, and longbow.', mech: { type: 'weapon_prof', weapons: ['longsword', 'shortsword', 'shortbow', 'longbow'] } },
            { name: 'Cantrip', text: 'You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.', mech: { type: 'cantrip', spell: 'choice:wizard', ability: 'int', uses: 'at_will' } },
            { name: 'Extra Language', text: 'You can speak, read, and write one extra language of your choice.', mech: { type: 'extra_language', amount: 1 } }
          ]
        },
        wood: {
          id: 'wood', name: 'Wood Elf', asi: { wis: 1 },
          traits: [
            { name: 'Elf Weapon Training', text: 'You have proficiency with the longsword, shortsword, shortbow, and longbow.', mech: { type: 'weapon_prof', weapons: ['longsword', 'shortsword', 'shortbow', 'longbow'] } },
            { name: 'Fleet of Foot', text: 'Your base walking speed increases to 35 feet.', mech: { type: 'speed_bonus', amount: 5 } },
            { name: 'Mask of the Wild', text: 'You can attempt to hide even when only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.', mech: { type: 'other' } }
          ]
        },
        drow: {
          id: 'drow', name: 'Dark Elf (Drow)', asi: { cha: 1 },
          darkvisionOverride: 120,
          traits: [
            { name: 'Superior Darkvision', text: 'Your darkvision has a radius of 120 feet.', mech: { type: 'darkvision_bonus', amount: 60 } },
            { name: 'Sunlight Sensitivity', text: 'You have disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight when you, the target, or anything between you and the target is in direct sunlight.', mech: { type: 'other' } },
            { name: 'Drow Magic', text: 'You know the dancing lights cantrip. At 3rd level you can cast faerie fire once per long rest, and at 5th level darkness once per long rest. Charisma is your spellcasting ability for these.', mech: { type: 'innate_spell', spell: 'dancing-lights', perDay: 'at_will', minLevel: 1, ability: 'cha' } },
            { name: 'Drow Weapon Training', text: 'You have proficiency with rapiers, shortswords, and hand crossbows.', mech: { type: 'weapon_prof', weapons: ['rapier', 'shortsword', 'hand-crossbow'] } }
          ]
        }
      },
      visual: { palette: ['#e8d9b5', '#d4b483', '#4a3f6b'], build: 'slender', heightRange: [60, 74], hairStyles: ['long straight', 'braided crown', 'undercut'], notes: 'angular features, pointed ears, graceful posture; drow have obsidian-dark skin and white or pale hair' }
    },

    halfling: {
      id: 'halfling', name: 'Halfling', size: 'Small', speed: 25,
      asi: { dex: 2 },
      age: 'Halflings reach adulthood at 20 and generally live into their second century.',
      alignmentHint: 'Most halflings are lawful good, being inclined toward kindness and decency and having a strong respect for the bonds of family and community.',
      description: 'The comforts of home are the goals of most halflings\' lives: a place to settle in peace and quiet, far from marauding monsters and clashing armies. Halflings are cheerful, practical folk who value simple pleasures.',
      darkvision: 0, languages: ['Common', 'Halfling'], extraLanguages: 0,
      traits: [
        { name: 'Lucky', text: 'When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.', mech: { type: 'other' } },
        { name: 'Brave', text: 'You have advantage on saving throws against being frightened.', mech: { type: 'save_adv', vs: 'frightened' } },
        { name: 'Halfling Nimbleness', text: 'You can move through the space of any creature that is of a size larger than yours.', mech: { type: 'other' } }
      ],
      profs: { weapons: [], tools: [], armor: [], skills: [] },
      resistances: [],
      subraces: {
        lightfoot: {
          id: 'lightfoot', name: 'Lightfoot Halfling', asi: { cha: 1 },
          traits: [{ name: 'Naturally Stealthy', text: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.', mech: { type: 'other' } }]
        },
        stout: {
          id: 'stout', name: 'Stout Halfling', asi: { con: 1 },
          traits: [
            { name: 'Stout Resilience', text: 'You have advantage on saving throws against poison, and you have resistance against poison damage.', mech: { type: 'save_adv', vs: 'poison' } },
            { name: 'Stout Resilience (resistance)', text: 'You have resistance to poison damage.', mech: { type: 'damage_resist', dtype: 'poison' } }
          ]
        }
      },
      visual: { palette: ['#d99a5b', '#8b5e34', '#f0c987'], build: 'small and round', heightRange: [33, 40], hairStyles: ['curly crop', 'short bob'], notes: 'ruddy cheeks, curly hair, bare or lightly-shod feet, cheerful expression' }
    },

    human: {
      id: 'human', name: 'Human', size: 'Medium', speed: 30,
      asi: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
      age: 'Humans reach adulthood in their late teens and live less than a century.',
      alignmentHint: 'Humans tend toward no particular alignment; the best and the worst are found among them.',
      description: 'In the reckonings of most other races, humans are the youngest, arriving on the world scene rather recently, but human ambition and drive for accomplishment make them the most dominant race in most of the world.',
      darkvision: 0, languages: ['Common'], extraLanguages: 1,
      traits: [
        { name: 'Extra Language', text: 'You can speak, read, and write one extra language of your choice.', mech: { type: 'extra_language', amount: 1 } }
      ],
      profs: { weapons: [], tools: [], armor: [], skills: [] },
      resistances: [],
      subraces: {
        variant: {
          id: 'variant', name: 'Variant Human', asi: null,
          traits: [
            { name: 'Ability Score Increase (Variant)', text: 'Two different ability scores of your choice increase by 1.', mech: { type: 'asi_flex', amount: 1, count: 2 } },
            { name: 'Skill Versatility', text: 'You gain proficiency in one skill of your choice.', mech: { type: 'extra_skill', amount: 1 } },
            { name: 'Feat', text: 'You gain one feat of your choice.', mech: { type: 'extra_feat', amount: 1 } }
          ]
        }
      },
      visual: { palette: ['#c68863', '#e8b98a', '#8a5a3c'], build: 'average', heightRange: [58, 76], hairStyles: ['varied'], notes: 'wide variety of appearances; no single unifying physical trait, reflecting many cultures and ethnicities' }
    },

    dragonborn: {
      id: 'dragonborn', name: 'Dragonborn', size: 'Medium', speed: 30,
      asi: { str: 2, cha: 1 },
      age: 'Dragonborn reach adulthood by age 15 and live to about 80 years.',
      alignmentHint: 'Dragonborn tend to extremes, favoring good or evil in equal measure, and between law and chaos, they lean toward law.',
      description: 'Dragonborn are proud, honorable people descended from dragons, born in scattered clans, bearing scaled skin and draconic features. Their scale color and breath weapon are tied to their draconic ancestry.',
      darkvision: 0, languages: ['Common', 'Draconic'], extraLanguages: 0,
      traits: [
        { name: 'Draconic Ancestry', text: 'You have draconic ancestry which determines the damage type of your breath weapon and resistances. Choose one from the ancestries table.', mech: { type: 'other' } },
        { name: 'Breath Weapon', text: 'You can use your action to exhale destructive energy in an area determined by your ancestry. Creatures in the area must make a saving throw (DC = 8 + CON mod + proficiency bonus), taking 2d6 damage (increasing at higher levels) on a failure, half as much on a success. You can use this once per short or long rest.', mech: { type: 'other' } },
        { name: 'Damage Resistance', text: 'You have resistance to the damage type associated with your draconic ancestry.', mech: { type: 'damage_resist', dtype: 'choice:ancestry' } }
      ],
      profs: { weapons: [], tools: [], armor: [], skills: [] },
      resistances: [],
      ancestries: {
        black: { damage: 'acid', breath: { shape: 'line', size: '5 by 30 ft', save: 'dex' } },
        blue: { damage: 'lightning', breath: { shape: 'line', size: '5 by 30 ft', save: 'dex' } },
        brass: { damage: 'fire', breath: { shape: 'line', size: '5 by 30 ft', save: 'dex' } },
        bronze: { damage: 'lightning', breath: { shape: 'line', size: '5 by 30 ft', save: 'dex' } },
        copper: { damage: 'acid', breath: { shape: 'line', size: '5 by 30 ft', save: 'dex' } },
        gold: { damage: 'fire', breath: { shape: 'cone', size: '15 ft', save: 'dex' } },
        green: { damage: 'poison', breath: { shape: 'cone', size: '15 ft', save: 'con' } },
        red: { damage: 'fire', breath: { shape: 'cone', size: '15 ft', save: 'dex' } },
        silver: { damage: 'cold', breath: { shape: 'cone', size: '15 ft', save: 'con' } },
        white: { damage: 'cold', breath: { shape: 'cone', size: '15 ft', save: 'con' } }
      },
      subraces: {},
      visual: { palette: ['#8a2020', '#c9a227', '#3a5a8a', '#2a6b3a', '#c0c0c0'], build: 'tall and reptilian', heightRange: [72, 82], hairStyles: [], notes: 'scaled skin in colors matching draconic ancestry, clawed hands, faint horns, reptilian snout' }
    },

    gnome: {
      id: 'gnome', name: 'Gnome', size: 'Small', speed: 25,
      asi: { int: 2 },
      age: 'Gnomes mature at the same rate humans do, but they are expected to settle into adulthood by 40 and can live 350 to 500 years.',
      alignmentHint: 'Gnomes are most often good, with a strong bent toward the chaotic side of the alignment spectrum.',
      description: 'A gnome\'s energy and enthusiasm for living shines through every inch of a gnome\'s tiny body. Gnomes average slightly over 3 feet tall and weigh 40 to 45 pounds.',
      darkvision: 60, languages: ['Common', 'Gnomish'], extraLanguages: 0,
      traits: [
        { name: 'Darkvision', text: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.', mech: { type: 'other' } },
        { name: 'Gnome Cunning', text: 'You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.', mech: { type: 'save_adv', vs: 'magic' } }
      ],
      profs: { weapons: [], tools: [], armor: [], skills: [] },
      resistances: [],
      subraces: {
        forest: {
          id: 'forest', name: 'Forest Gnome', asi: { dex: 1 },
          traits: [
            { name: 'Natural Illusionist', text: 'You know the minor illusion cantrip. Intelligence is your spellcasting ability for it.', mech: { type: 'cantrip', spell: 'minor-illusion', ability: 'int', uses: 'at_will' } },
            { name: 'Speak with Small Beasts', text: 'Through sounds and gestures, you can communicate simple ideas with Small or smaller beasts.', mech: { type: 'other' } }
          ]
        },
        rock: {
          id: 'rock', name: 'Rock Gnome', asi: { con: 1 },
          traits: [
            { name: 'Artificer\'s Lore', text: 'Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you add double your proficiency bonus.', mech: { type: 'skill_expertise', skill: 'history', condition: 'magic-items' } },
            { name: 'Tinker', text: 'You have proficiency with artisan\'s tools (tinker\'s tools). Using them, you can spend 1 hour and 10 gp of materials to construct a Tiny clockwork device (AC 5, 1 hp) that lasts until you use this feature again or die: a clockwork toy, a fire starter, or a music box.', mech: { type: 'tool_prof', tools: ['tinker'] } }
          ]
        }
      },
      visual: { palette: ['#c99a4a', '#8a6a3a', '#d4c4a0'], build: 'small and wiry', heightRange: [35, 42], hairStyles: ['wild curls', 'tufted', 'braided'], notes: 'bright inquisitive eyes, wild hair, often soot-stained hands (rock gnome) or leaf-flecked clothes (forest gnome)' }
    },

    halfElf: {
      id: 'halfElf', name: 'Half-Elf', size: 'Medium', speed: 30,
      asi: { cha: 2 },
      age: 'Half-elves mature at the same rate humans do and reach adulthood around 20. They live much longer than humans, however, often exceeding 180 years.',
      alignmentHint: 'Half-elves share the chaotic bent of their elven heritage, valuing both personal freedom and creative expression, and are not tied to the rigid traditions of either parent culture.',
      description: 'Walking in two worlds but truly belonging to neither, half-elves combine what some say are the best qualities of their elf and human parents: human curiosity and ambition tempered by elven grace and sensibility.',
      darkvision: 60, languages: ['Common', 'Elvish'], extraLanguages: 1,
      traits: [
        { name: 'Darkvision', text: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.', mech: { type: 'other' } },
        { name: 'Fey Ancestry', text: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.', mech: { type: 'save_adv', vs: 'charmed' } },
        { name: 'Skill Versatility', text: 'You gain proficiency in two skills of your choice.', mech: { type: 'extra_skill', amount: 2 } },
        { name: 'Extra Language', text: 'You can speak, read, and write one extra language of your choice.', mech: { type: 'extra_language', amount: 1 } },
        { name: 'Ability Score Flexibility', text: 'Two other ability scores of your choice increase by 1 each.', mech: { type: 'asi_flex', amount: 1, count: 2 } }
      ],
      profs: { weapons: [], tools: [], armor: [], skills: [] },
      resistances: [],
      subraces: {},
      visual: { palette: ['#d9b18a', '#e8d9b5', '#b58a5a'], build: 'lithe', heightRange: [57, 74], hairStyles: ['long wavy', 'loose braid'], notes: 'faintly angular features and pointed ears less pronounced than a full elf, otherwise resembling human variety' }
    },

    halfOrc: {
      id: 'halfOrc', name: 'Half-Orc', size: 'Medium', speed: 30,
      asi: { str: 2, con: 1 },
      age: 'Half-orcs mature a little faster than humans, reaching adulthood around age 14. They age noticeably faster and rarely live longer than 75 years.',
      alignmentHint: 'Half-orcs inherit a tendency toward chaos from their orc parents and are not strongly inclined toward good or evil.',
      description: 'Half-orcs\' grayish pigmentation, prominent teeth, and towering builds make their orcish heritage plain for all to see. Half-orcs are keenly aware of how they are perceived and sometimes struggle to belong.',
      darkvision: 60, languages: ['Common', 'Orc'], extraLanguages: 0,
      traits: [
        { name: 'Darkvision', text: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.', mech: { type: 'other' } },
        { name: 'Menacing', text: 'You gain proficiency in the Intimidation skill.', mech: { type: 'skill_prof', skill: 'intimidation' } },
        { name: 'Relentless Endurance', text: 'When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can\'t use this feature again until you finish a long rest.', mech: { type: 'other' } },
        { name: 'Savage Attacks', text: 'When you score a critical hit with a melee weapon attack, you can roll one of the weapon\'s damage dice one additional time and add it to the extra damage of the critical hit.', mech: { type: 'other' } }
      ],
      profs: { weapons: [], tools: [], armor: [], skills: ['intimidation'] },
      resistances: [],
      subraces: {},
      visual: { palette: ['#7a8a6a', '#5a6a4a', '#8a9a7a'], build: 'towering and muscular', heightRange: [58, 79], hairStyles: ['shaved', 'short bristle'], notes: 'grayish-green skin, prominent lower canines, heavy brow ridge, powerful build' }
    },

    tiefling: {
      id: 'tiefling', name: 'Tiefling', size: 'Medium', speed: 30,
      asi: { int: 1, cha: 2 },
      age: 'Tieflings mature at the same rate as humans but live a few years longer.',
      alignmentHint: 'Tieflings might not have an innate tendency toward evil, but many of them end up there. Evil or not, an independent nature inclines many tieflings toward a chaotic alignment.',
      description: 'To be greeted with stares and whispers, to see mistrust in every eye: this is the lot of the tiefling, born with a fiendish heritage that shows in their horns, tail, and infernal eyes.',
      darkvision: 60, languages: ['Common', 'Infernal'], extraLanguages: 0,
      traits: [
        { name: 'Darkvision', text: 'You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.', mech: { type: 'other' } },
        { name: 'Hellish Resistance', text: 'You have resistance to fire damage.', mech: { type: 'damage_resist', dtype: 'fire' } },
        { name: 'Infernal Legacy', text: 'You know the thaumaturgy cantrip. At 3rd level you can cast hellish rebuke once per long rest, and at 5th level darkness once per long rest. Charisma is your spellcasting ability for these.', mech: { type: 'cantrip', spell: 'thaumaturgy', ability: 'cha', uses: 'at_will' } }
      ],
      profs: { weapons: [], tools: [], armor: [], skills: [] },
      resistances: ['fire'],
      subraces: {},
      visual: { palette: ['#8a2a2a', '#4a1a3a', '#2a1a1a'], build: 'lithe', heightRange: [57, 76], hairStyles: ['straight', 'slicked back'], notes: 'small horns, a long pointed tail, solid-colored eyes (often red, gold, or black), skin tones from human ranges to deep red' }
    }

  };

  return { RACES: RACES };
});
