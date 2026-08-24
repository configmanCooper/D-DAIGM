/**
 * srd_rules.js
 * ---------------------------------------------------------------------------
 * D&D 5e SRD 5.1 (2014 ruleset). CC-BY-4.0 — see srd_license.js.
 * Core rules reference data drawn from the SRD 5.1: skills, conditions,
 * damage types, alignments, languages, backgrounds, feats, XP tables and
 * assorted subsystem rules (death saves, resting, cover, travel, exhaustion).
 * Conditions use 2014 wording/effects; EXHAUSTION is the 2014 six-level
 * ladder with a distinct effect per level (not the 2024 flat d20-penalty
 * model); backgrounds grant no feats or ability score increases (2014 style).
 *
 * `CONDITIONS[x].effects` vocabulary (machine-readable, consumed by the rules
 * engine to apply automatic effects):
 *   'attacks_against_have_advantage'   - attacks against the creature have advantage
 *   'attacks_against_have_disadvantage'- attacks against the creature have disadvantage
 *   'attacks_have_disadvantage'        - the creature's own attacks have disadvantage
 *   'attacks_have_advantage'           - the creature's own attacks have advantage (melee only unless noted)
 *   'auto_fail_str_dex_saves'          - automatically fails Strength and Dexterity saves
 *   'cant_take_actions'                - cannot take actions
 *   'cant_take_reactions'              - cannot take reactions
 *   'cant_move'                        - speed becomes 0
 *   'cant_speak'                       - cannot speak
 *   'crit_if_hit_within_5ft'           - melee attacks that hit become critical hits
 *   'drops_what_it_holds'              - drops anything held
 *   'fails_hearing_checks'             - automatically fails ability checks that require hearing
 *   'incapacitated'                    - treated as also having the Incapacitated condition
 *   'prone_on_end'                     - falls prone when condition is applied
 *   'speed_zero'                       - speed reduces to 0
 *   'checks_have_disadvantage'         - ability checks made with disadvantage
 *   'checks_have_disadvantage_near_source' - ability checks have disadvantage while fear source is visible
 *   'cant_approach_source'             - can't willingly move closer to the source
 *   'cant_harm_charmer'                - can't attack or target the charmer with harmful effects
 *   'disadvantage_on_dex_saves'        - disadvantage on Dexterity saving throws
 *   'attacks_against_have_advantage_melee'    - melee attacks against the creature have advantage
 *   'attacks_against_have_disadvantage_ranged'- ranged attacks against the creature have disadvantage
 *   'resist_all_damage'                - resistance to all damage types
 *   'unaware_of_surroundings'          - unaware of surroundings (for stealth purposes vs the creature)
 *   'exhaustion_levels'                - see EXHAUSTION table for cumulative tiered effects
 * ---------------------------------------------------------------------------
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.DND = root.DND || {}; root.DND.Data = root.DND.Data || {};
  Object.assign(root.DND.Data, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SKILLS = {
    acrobatics: { id: 'acrobatics', name: 'Acrobatics', ability: 'dex', description: 'Stay on your feet in a tricky situation, or perform an acrobatic stunt.' },
    animalHandling: { id: 'animalHandling', name: 'Animal Handling', ability: 'wis', description: 'Calm down a domesticated animal, keep a mount from bolting, or intuit an animal\'s intentions.' },
    arcana: { id: 'arcana', name: 'Arcana', ability: 'int', description: 'Recall lore about spells, magic items, eldritch symbols, and the planes of existence.' },
    athletics: { id: 'athletics', name: 'Athletics', ability: 'str', description: 'Climb, jump, swim, or perform other physically demanding feats.' },
    deception: { id: 'deception', name: 'Deception', ability: 'cha', description: 'Convincingly hide the truth, either verbally or through actions.' },
    history: { id: 'history', name: 'History', ability: 'int', description: 'Recall lore about historical events, legendary people, ancient kingdoms and wars.' },
    insight: { id: 'insight', name: 'Insight', ability: 'wis', description: 'Determine the true intentions of a creature, such as detecting a lie.' },
    intimidation: { id: 'intimidation', name: 'Intimidation', ability: 'cha', description: 'Influence someone through overt threats, hostile actions, and physical violence.' },
    investigation: { id: 'investigation', name: 'Investigation', ability: 'int', description: 'Look around for clues and make deductions based on those clues.' },
    medicine: { id: 'medicine', name: 'Medicine', ability: 'wis', description: 'Try to stabilize a dying companion or diagnose an illness.' },
    nature: { id: 'nature', name: 'Nature', ability: 'int', description: 'Recall lore about terrain, plants, animals, and weather.' },
    perception: { id: 'perception', name: 'Perception', ability: 'wis', description: 'Spot, hear, or otherwise detect the presence of something.' },
    performance: { id: 'performance', name: 'Performance', ability: 'cha', description: 'Delight an audience with music, dance, acting, storytelling, or another form of entertainment.' },
    persuasion: { id: 'persuasion', name: 'Persuasion', ability: 'cha', description: 'Influence someone or a group with tact, social graces, or good nature.' },
    religion: { id: 'religion', name: 'Religion', ability: 'int', description: 'Recall lore about deities, rites, prayers, religious hierarchies, holy symbols, and the practices of secret cults.' },
    sleightOfHand: { id: 'sleightOfHand', name: 'Sleight of Hand', ability: 'dex', description: 'Perform manual trickery, such as planting something on someone or lifting a coin purse.' },
    stealth: { id: 'stealth', name: 'Stealth', ability: 'dex', description: 'Conceal yourself from enemies, slink past guards, slip away without notice.' },
    survival: { id: 'survival', name: 'Survival', ability: 'wis', description: 'Follow tracks, hunt wild game, guide a group through the wilderness, identify signs of nearby creatures.' }
  };

  // CONDITIONS[x].endsOn vocabulary: 'save_end_of_turn' (creature repeats a save at the end of each of
  // its turns to end the condition early, if the source allows it), 'duration' (ends only when the
  // fixed duration of the effect that imposed it expires), 'action' (ends when a specific action is
  // taken, e.g. standing up from prone, or a successful Escape the Grapple action/check), 'none' (the
  // condition itself has no built-in end trigger and only ends via an external effect removing it).
  // CONDITIONS[x].escape, when present, describes the check used to escape/end the condition:
  // { dc: <number|null>, ability: 'str'|'dex'|'str_or_dex' } — dc is null when the DC is contested
  // (e.g. equal to the grappler's Athletics check result) rather than a fixed number.
  var CONDITIONS = {
    blinded: { id: 'blinded', name: 'Blinded', text: 'A blinded creature can\'t see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage.', effects: ['attacks_against_have_advantage', 'attacks_have_disadvantage'], endsOn: 'duration' },
    charmed: { id: 'charmed', name: 'Charmed', text: 'A charmed creature can\'t attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature.', effects: ['cant_harm_charmer'], endsOn: 'duration' },
    deafened: { id: 'deafened', name: 'Deafened', text: 'A deafened creature can\'t hear and automatically fails any ability check that requires hearing.', effects: ['fails_hearing_checks'], endsOn: 'duration' },
    exhaustion: { id: 'exhaustion', name: 'Exhaustion', text: 'Exhaustion is measured in six levels, each worse than the last, and is gained via special abilities and environmental effects such as starvation or extreme cold. See EXHAUSTION table.', effects: ['exhaustion_levels'], endsOn: 'none' },
    frightened: { id: 'frightened', name: 'Frightened', text: 'A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can\'t willingly move closer to the source of its fear.', effects: ['attacks_have_disadvantage', 'checks_have_disadvantage_near_source', 'cant_approach_source'], endsOn: 'duration' },
    grappled: { id: 'grappled', name: 'Grappled', text: 'A grappled creature\'s speed becomes 0, and it can\'t benefit from any bonus to its speed. The condition ends if the grappler is incapacitated or if the creature is removed from the grappler\'s reach.', effects: ['speed_zero'], endsOn: 'action', escape: { dc: null, ability: 'str_or_dex' } },
    incapacitated: { id: 'incapacitated', name: 'Incapacitated', text: 'An incapacitated creature can\'t take actions or reactions.', effects: ['cant_take_actions', 'cant_take_reactions'], endsOn: 'duration' },
    invisible: { id: 'invisible', name: 'Invisible', text: 'An invisible creature is impossible to see without special sense or magic. Attack rolls against the creature have disadvantage, and its attack rolls have advantage.', effects: ['attacks_against_have_disadvantage', 'attacks_have_advantage', 'unaware_of_surroundings'], endsOn: 'duration' },
    paralyzed: { id: 'paralyzed', name: 'Paralyzed', text: 'A paralyzed creature is incapacitated and can\'t move or speak. It automatically fails Strength and Dexterity saves. Attack rolls against the creature have advantage, and any attack that hits from within 5 feet is a critical hit.', effects: ['incapacitated', 'cant_move', 'cant_speak', 'auto_fail_str_dex_saves', 'attacks_against_have_advantage', 'crit_if_hit_within_5ft'], endsOn: 'duration' },
    petrified: { id: 'petrified', name: 'Petrified', text: 'A petrified creature is transformed, along with any nonmagical objects it carries, into a solid substance. It is incapacitated, can\'t move or speak, is unaware of its surroundings, automatically fails Strength and Dexterity saves, has resistance to all damage, and is immune to poison and disease.', effects: ['incapacitated', 'cant_move', 'cant_speak', 'auto_fail_str_dex_saves', 'unaware_of_surroundings', 'resist_all_damage'], endsOn: 'duration' },
    poisoned: { id: 'poisoned', name: 'Poisoned', text: 'A poisoned creature has disadvantage on attack rolls and ability checks.', effects: ['attacks_have_disadvantage', 'checks_have_disadvantage'], endsOn: 'duration' },
    prone: { id: 'prone', name: 'Prone', text: 'A prone creature\'s only movement option is to crawl unless it stands up. The creature has disadvantage on attack rolls. An attack roll against the creature has advantage if the attacker is within 5 feet, otherwise disadvantage.', effects: ['attacks_have_disadvantage', 'attacks_against_have_advantage_melee', 'attacks_against_have_disadvantage_ranged'], endsOn: 'action' },
    restrained: { id: 'restrained', name: 'Restrained', text: 'A restrained creature\'s speed becomes 0. Attack rolls against the creature have advantage, and its own attack rolls have disadvantage. It has disadvantage on Dexterity saving throws.', effects: ['speed_zero', 'attacks_against_have_advantage', 'attacks_have_disadvantage', 'disadvantage_on_dex_saves'], endsOn: 'action', escape: { dc: null, ability: 'str_or_dex' } },
    stunned: { id: 'stunned', name: 'Stunned', text: 'A stunned creature is incapacitated, can\'t move, and can speak only falteringly. It automatically fails Strength and Dexterity saves. Attack rolls against the creature have advantage.', effects: ['incapacitated', 'cant_move', 'auto_fail_str_dex_saves', 'attacks_against_have_advantage'], endsOn: 'duration' },
    unconscious: { id: 'unconscious', name: 'Unconscious', text: 'An unconscious creature is incapacitated, can\'t move or speak, and is unaware of its surroundings. It drops what it\'s holding and falls prone. It automatically fails Strength and Dexterity saves. Attack rolls against it have advantage, and any attack that hits from within 5 feet is a critical hit.', effects: ['incapacitated', 'cant_move', 'cant_speak', 'unaware_of_surroundings', 'drops_what_it_holds', 'prone_on_end', 'auto_fail_str_dex_saves', 'attacks_against_have_advantage', 'crit_if_hit_within_5ft'], endsOn: 'duration' }
  };

  var DAMAGE_TYPES = [
    { id: 'acid', name: 'Acid' }, { id: 'bludgeoning', name: 'Bludgeoning' }, { id: 'cold', name: 'Cold' },
    { id: 'fire', name: 'Fire' }, { id: 'force', name: 'Force' }, { id: 'lightning', name: 'Lightning' },
    { id: 'necrotic', name: 'Necrotic' }, { id: 'piercing', name: 'Piercing' }, { id: 'poison', name: 'Poison' },
    { id: 'psychic', name: 'Psychic' }, { id: 'radiant', name: 'Radiant' }, { id: 'slashing', name: 'Slashing' },
    { id: 'thunder', name: 'Thunder' }
  ];

  var ALIGNMENTS = [
    { id: 'LG', name: 'Lawful Good' }, { id: 'NG', name: 'Neutral Good' }, { id: 'CG', name: 'Chaotic Good' },
    { id: 'LN', name: 'Lawful Neutral' }, { id: 'N', name: 'Neutral' }, { id: 'CN', name: 'Chaotic Neutral' },
    { id: 'LE', name: 'Lawful Evil' }, { id: 'NE', name: 'Neutral Evil' }, { id: 'CE', name: 'Chaotic Evil' }
  ];

  var LANGUAGES = {
    standard: ['Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc'],
    exotic: ['Abyssal', 'Celestial', 'Draconic', 'Deep Speech', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon']
  };

  // LICENSING NOTE: SRD 5.1 defines exactly ONE background (Acolyte). Every other background below
  // is popular-PHB-style homebrew content re-derived in our own words for flavor/completeness, and is
  // explicitly tagged source:'homebrew' so it is never mistaken for CC-BY-4.0 SRD content. Only
  // `acolyte` is tagged source:'srd'.
  var BACKGROUNDS = {
    acolyte: {
      id: 'acolyte', name: 'Acolyte', source: 'srd',
      skillProfs: ['insight', 'religion'], toolProfs: [], languages: 2,
      equipment: ['Holy symbol', 'Prayer book or prayer wheel', '5 sticks of incense', 'Vestments', 'Common clothes', 'Belt pouch with 15 gp'],
      feature: { name: 'Shelter of the Faithful', text: 'You and your companions can receive free healing and care at temples of your faith, and you can perform religious ceremonies of your faith.' }
    },
    charlatan: {
      id: 'charlatan', name: 'Charlatan', source: 'homebrew',
      skillProfs: ['deception', 'sleightOfHand'], toolProfs: ['Disguise kit', 'Forgery kit'], languages: 0,
      equipment: ['Fine clothes', 'Disguise kit', 'Tools of the con of your choice', 'Belt pouch with 15 gp'],
      feature: { name: 'False Identity', text: 'You have created a second identity complete with documentation, established acquaintances, and disguises that allow you to assume that persona.' }
    },
    criminal: {
      id: 'criminal', name: 'Criminal', source: 'homebrew',
      skillProfs: ['deception', 'stealth'], toolProfs: ['One type of gaming set', 'Thieves\' tools'], languages: 0,
      equipment: ['Crowbar', 'Dark common clothes with hood', 'Belt pouch with 15 gp'],
      feature: { name: 'Criminal Contact', text: 'You have a reliable and trustworthy contact who acts as your liaison to a network of other criminals.' }
    },
    entertainer: {
      id: 'entertainer', name: 'Entertainer', source: 'homebrew',
      skillProfs: ['acrobatics', 'performance'], toolProfs: ['Disguise kit', 'One type of musical instrument'], languages: 0,
      equipment: ['A musical instrument', 'The favor of an admirer', 'Costume', 'Belt pouch with 15 gp'],
      feature: { name: 'By Popular Demand', text: 'You can always find a place to perform, usually in exchange for food and lodging of a modest or comfortable standard.' }
    },
    folkHero: {
      id: 'folkHero', name: 'Folk Hero', source: 'homebrew',
      skillProfs: ['animalHandling', 'survival'], toolProfs: ['One type of artisan\'s tools', 'Vehicles (land)'], languages: 0,
      equipment: ['A set of artisan\'s tools', 'A shovel', 'An iron pot', 'Common clothes', 'Belt pouch with 10 gp'],
      feature: { name: 'Rustic Hospitality', text: 'Common folk will shelter you from the law or those who hunt you, though they won\'t risk their lives for you.' }
    },
    guildArtisan: {
      id: 'guildArtisan', name: 'Guild Artisan', source: 'homebrew',
      skillProfs: ['insight', 'persuasion'], toolProfs: ['One type of artisan\'s tools'], languages: 1,
      equipment: ['A set of artisan\'s tools', 'A letter of introduction from your guild', 'Traveler\'s clothes', 'Belt pouch with 15 gp'],
      feature: { name: 'Guild Membership', text: 'Your guild membership grants you lodging and food if necessary, and political connections in the city your guild is based.' }
    },
    hermit: {
      id: 'hermit', name: 'Hermit', source: 'homebrew',
      skillProfs: ['medicine', 'religion'], toolProfs: ['Herbalism kit'], languages: 1,
      equipment: ['A scroll case stuffed with notes', 'A winter blanket', 'Common clothes', 'Herbalism kit', '5 gp'],
      feature: { name: 'Discovery', text: 'The quiet seclusion of your hermitage gave you access to a unique and powerful discovery.' }
    },
    noble: {
      id: 'noble', name: 'Noble', source: 'homebrew',
      skillProfs: ['history', 'persuasion'], toolProfs: ['One type of gaming set'], languages: 1,
      equipment: ['A set of fine clothes', 'A signet ring', 'A scroll of pedigree', 'Purse with 25 gp'],
      feature: { name: 'Position of Privilege', text: 'People are inclined to think the best of you and treat you with respect due to your noble birth.' }
    },
    outlander: {
      id: 'outlander', name: 'Outlander', source: 'homebrew',
      skillProfs: ['athletics', 'survival'], toolProfs: ['One type of musical instrument'], languages: 1,
      equipment: ['A staff', 'A hunting trap', 'A trophy from an animal you killed', 'Traveler\'s clothes', 'Belt pouch with 10 gp'],
      feature: { name: 'Wanderer', text: 'You have an excellent memory for maps and geography, and can always recall the general layout of terrain and find food and fresh water for yourself and others.' }
    },
    sage: {
      id: 'sage', name: 'Sage', source: 'homebrew',
      skillProfs: ['arcana', 'history'], toolProfs: [], languages: 2,
      equipment: ['A bottle of black ink', 'A quill', 'A small knife', 'A letter of introduction', 'Common clothes', 'Belt pouch with 10 gp'],
      feature: { name: 'Researcher', text: 'You know how and where to obtain information, even if you don\'t already know the answer to a question yourself.' }
    },
    sailor: {
      id: 'sailor', name: 'Sailor', source: 'homebrew',
      skillProfs: ['athletics', 'perception'], toolProfs: ['Navigator\'s tools', 'Vehicles (water)'], languages: 0,
      equipment: ['A belaying pin', 'A silk rope', 'A lucky charm', 'Common clothes', 'Belt pouch with 10 gp'],
      feature: { name: 'Ship\'s Passage', text: 'You can secure free passage on a sailing ship for yourself and your companions, in exchange for labor.' }
    },
    soldier: {
      id: 'soldier', name: 'Soldier', source: 'homebrew',
      skillProfs: ['athletics', 'intimidation'], toolProfs: ['One type of gaming set', 'Vehicles (land)'], languages: 0,
      equipment: ['An insignia of rank', 'A trophy from a fallen enemy', 'A set of bone dice or deck of cards', 'Common clothes', 'Belt pouch with 10 gp'],
      feature: { name: 'Military Rank', text: 'You have a military rank from your career as a soldier, and soldiers loyal to your former organization still recognize your authority.' }
    },
    urchin: {
      id: 'urchin', name: 'Urchin', source: 'homebrew',
      skillProfs: ['sleightOfHand', 'stealth'], toolProfs: ['Disguise kit', 'Thieves\' tools'], languages: 0,
      equipment: ['A small knife', 'A map of your home city', 'A pet mouse', 'A token from your parents', 'Common clothes', 'Belt pouch with 10 gp'],
      feature: { name: 'City Secrets', text: 'You know the secret patterns and flow of cities, and can find passages through the urban sprawl that others would miss.' }
    }
  };

  // LICENSING NOTE: SRD 5.1 contains exactly ONE feat: Grappler. FEATS below therefore contains only
  // Grappler, tagged source:'srd'. All other feats commonly found in the 2014 Player's Handbook
  // (Athlete, Actor, Healer, Keen Mind, Linguist, Lightly Armored, Lucky, Mobile, Tavern Brawler, Tough)
  // are NOT part of the SRD and are NOT licensed under CC-BY-4.0 here — they are provided separately
  // in HOMEBREW_FEATS, each explicitly tagged source:'homebrew', re-written in our own words for
  // completeness. Do not represent HOMEBREW_FEATS content as SRD/CC-BY-4.0 licensed.
  var FEATS = {
    grappler: { id: 'grappler', name: 'Grappler', source: 'srd', prerequisite: 'Strength 13 or higher', text: 'You have advantage on attack rolls against a creature you are grappling. You can use your action to try to pin a grappled creature; if you succeed, the creature is restrained until the grapple ends.', mech: { type: 'combat_option' } }
  };

  var HOMEBREW_FEATS = {
    athlete: { id: 'athlete', name: 'Athlete', source: 'homebrew', prerequisite: null, text: 'You gain +1 to Strength or Dexterity (max 20). When prone, standing up uses only 5 feet of movement. Climbing no longer costs extra movement. You can make a running long or high jump after moving only 5 feet.', mech: { type: 'asi_choice', amount: 1, options: ['str', 'dex'] } },
    actor: { id: 'actor', name: 'Actor', source: 'homebrew', prerequisite: null, text: 'You gain +1 to Charisma (max 20). You have advantage on Deception and Performance checks to pass yourself off as a different person. You can mimic the speech or sounds of others you have heard.', mech: { type: 'asi_fixed', ability: 'cha', amount: 1 } },
    healer: { id: 'healer', name: 'Healer', source: 'homebrew', prerequisite: null, text: 'Using a healer\'s kit to stabilize a dying creature also restores 1 hit point. As an action, you can spend one use of a healer\'s kit to tend to a creature and restore 1d6+4 hit points, plus more equal to its maximum number of Hit Dice.', mech: { type: 'heal_kit_bonus' } },
    keenMind: { id: 'keenMind', name: 'Keen Mind', source: 'homebrew', prerequisite: null, text: 'You gain +1 Intelligence (max 20). You always know which way is north, the number of hours left before the next sunrise or sunset, and can accurately recall anything you have seen or heard within the past month.', mech: { type: 'asi_fixed', ability: 'int', amount: 1 } },
    linguist: { id: 'linguist', name: 'Linguist', source: 'homebrew', prerequisite: null, text: 'You gain +1 Intelligence (max 20), learn three languages, and can ably create written ciphers.', mech: { type: 'asi_fixed', ability: 'int', amount: 1 } },
    lightlyArmored: { id: 'lightlyArmored', name: 'Lightly Armored', source: 'homebrew', prerequisite: 'Not proficient with light armor', text: 'You gain proficiency with light armor and +1 to Strength or Dexterity (max 20).', mech: { type: 'proficiency_and_asi', profs: { armor: ['light'] }, options: ['str', 'dex'], amount: 1 } },
    lucky: { id: 'lucky', name: 'Lucky', source: 'homebrew', prerequisite: null, text: 'You have 3 luck points. Whenever you make an attack roll, ability check, or saving throw, you can spend one luck point to roll an additional d20 and choose which to use. You regain expended luck points after a long rest.', mech: { type: 'luck_points', amount: 3 } },
    mobile: { id: 'mobile', name: 'Mobile', source: 'homebrew', prerequisite: null, text: 'Your speed increases by 10 feet. When you make a melee attack against a creature, you don\'t provoke opportunity attacks from that creature for the rest of the turn. Difficult terrain doesn\'t cost you extra movement when you Dash.', mech: { type: 'speed_bonus', amount: 10 } },
    tavernBrawler: { id: 'tavernBrawler', name: 'Tavern Brawler', source: 'homebrew', prerequisite: null, text: 'You gain +1 Strength or Constitution (max 20), proficiency with improvised weapons, your unarmed strike uses a d4 for damage, and when you hit with an unarmed strike or improvised weapon on your turn you can grapple the target as a bonus action.', mech: { type: 'brawler', options: ['str', 'con'], amount: 1, unarmedDie: 'd4' } },
    tough: { id: 'tough', name: 'Tough', source: 'homebrew', prerequisite: null, text: 'Your hit point maximum increases by an amount equal to twice your level when you gain this feat. Whenever you gain a level thereafter, your hit point maximum increases by an additional 2 hit points.', mech: { type: 'hp_per_level', amount: 2 } }
  };

  var PROFICIENCY_BONUS = [null, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];

  var XP_BY_LEVEL = [null, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

  // Encounter-building XP thresholds per character, by level: [easy, medium, hard, deadly]
  var XP_THRESHOLDS = {
    1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500],
    5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100],
    9: [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
    13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400], 16: [1600, 3200, 4800, 7200],
    17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500], 19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700]
  };

  var ENCOUNTER_MULTIPLIERS = [
    { monsters: 1, multiplier: 1 }, { monsters: 2, multiplier: 1.5 }, { monsters: '3-6', multiplier: 2 },
    { monsters: '7-10', multiplier: 2.5 }, { monsters: '11-14', multiplier: 3 }, { monsters: '15+', multiplier: 4 }
  ];

  var DEATH_SAVE_RULES = {
    roll: 'd20', success: 10, failuresToDie: 3, successesToStabilize: 3,
    naturalOne: 'counts as two failures', naturalTwenty: 'creature regains 1 hit point and becomes conscious',
    damageAtZero: 'a failed death save is caused automatically if the creature takes damage while at 0 HP; a critical hit against a creature at 0 HP causes two failures instead of one',
    massiveDamage: 'if damage taken at 0 HP equals or exceeds the creature\'s hit point maximum, it dies instantly'
  };

  var REST_RULES = {
    shortRest: { duration: '1 hour minimum', benefits: 'may spend Hit Dice to regain HP (roll die + CON modifier per die spent); some class features recharge' },
    longRest: { duration: '8 hours minimum (at least 6 sleeping)', benefits: 'regain all lost HP and up to half of total Hit Dice (minimum 1); most class features recharge', limit: 'one long rest per 24-hour period; must have at least 1 hit point at the start' }
  };

  var COVER = {
    half: { acBonus: 2, dexSaveBonus: 2, text: 'A target has half cover if an obstacle blocks at least half of its body, such as a low wall or another creature.' },
    threeQuarters: { acBonus: 5, dexSaveBonus: 5, text: 'A target has three-quarters cover if about three-quarters of it is covered, such as by an arrow slit.' },
    total: { acBonus: null, dexSaveBonus: null, text: 'A target with total cover can\'t be targeted directly by an attack or spell, if it is fully concealed by an obstacle.' }
  };

  var TRAVEL_PACE = {
    fast: { perMinute: 400, perHour: 4, perDay: 30, effect: '-5 penalty to passive Wisdom (Perception)' },
    normal: { perMinute: 300, perHour: 3, perDay: 24, effect: null },
    slow: { perMinute: 200, perHour: 2, perDay: 18, effect: 'able to use Stealth' }
  };

  var EXHAUSTION = {
    levels: [
      { level: 1, effect: 'Disadvantage on ability checks' },
      { level: 2, effect: 'Speed halved' },
      { level: 3, effect: 'Disadvantage on attack rolls and saving throws' },
      { level: 4, effect: 'Hit point maximum halved' },
      { level: 5, effect: 'Speed reduced to 0' },
      { level: 6, effect: 'Death' }
    ],
    notes: 'Effects are cumulative. A long rest reduces exhaustion by 1 level, provided the creature has also had food and drink.'
  };

  return {
    SKILLS: SKILLS, CONDITIONS: CONDITIONS, DAMAGE_TYPES: DAMAGE_TYPES, ALIGNMENTS: ALIGNMENTS,
    LANGUAGES: LANGUAGES, BACKGROUNDS: BACKGROUNDS, FEATS: FEATS, HOMEBREW_FEATS: HOMEBREW_FEATS, PROFICIENCY_BONUS: PROFICIENCY_BONUS,
    XP_BY_LEVEL: XP_BY_LEVEL, XP_THRESHOLDS: XP_THRESHOLDS, ENCOUNTER_MULTIPLIERS: ENCOUNTER_MULTIPLIERS,
    DEATH_SAVE_RULES: DEATH_SAVE_RULES, REST_RULES: REST_RULES, COVER: COVER, TRAVEL_PACE: TRAVEL_PACE,
    EXHAUSTION: EXHAUSTION
  };
});
