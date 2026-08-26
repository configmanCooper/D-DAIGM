/*
 * rulebook.js — the rules, in the Dungeon Master's hand.
 *
 * A 4B model asked "how does grappling work?" answers from memory, and its
 * memory is wrong. Observed, verbatim, from the model this game ships with:
 *
 *   "a Strength (Athletics) check against their AC minus any Dexterity
 *    bonuses ... the Ogre becomes restrained"
 *
 * Three errors in one sentence — a grapple is a contest, not a check against
 * AC, and it imposes `grappled`, not `restrained`. It said death saves happen
 * "while she is conscious", and turned 4+3+2 spell slots into "4 and a total
 * of 7 higher level". None of that is fixable by prompting harder, because
 * the model is not being careless; it simply does not know.
 *
 * So it is not asked to know. This file is the topical index into the SRD:
 * `lookup()` finds the passages a question is actually about and they are put
 * in the prompt, and the model's job drops from recall to paraphrase, which
 * is a thing small models are good at.
 *
 * Everything already in `srd_rules.js` — conditions, death saves, rests,
 * cover, exhaustion, skills — is pulled from there rather than restated, so
 * there is exactly one copy of each rule in the project and the Dungeon
 * Master quotes the same text the engine enforces.
 *
 * D&D 5e SRD 5.1 (2014 ruleset). CC-BY-4.0 — see srd_license.js.
 */
(function (root, factory) {
  var api = factory(
    (typeof module === 'object' && module.exports)
      ? require('../data/srd_rules.js')
      : (root.DND && root.DND.Data) || {}
  );
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.DND = root.DND || {}; root.DND.Rulebook = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Data) {
  'use strict';

  var CONDITIONS = Data.CONDITIONS || {};
  var DEATH = Data.DEATH_SAVE_RULES || {};
  var REST = Data.REST_RULES || {};
  var COVER = Data.COVER || {};
  var EXHAUSTION = Data.EXHAUSTION || {};
  var SKILLS = Data.SKILLS || {};

  /**
   * One entry per rule. `keys` are matched against the player's question.
   *
   * Keys are deliberately generous — a player asks "how do I grab him", not
   * "explain the grapple special attack" — and a wrong extra passage in the
   * prompt costs a few tokens, whereas a missing one costs a wrong answer.
   */
  var ENTRIES = [
    {
      id: 'grapple',
      title: 'Grappling',
      keys: ['grapple', 'grappling', 'grab', 'grabbing', 'wrestle', 'hold them', 'restrain', 'pin'],
      text:
        'When you want to grab a creature or wrestle with it, you can use the Attack ' +
        'action to make a special melee attack, a grapple. If you are able to make ' +
        'multiple attacks with the Attack action, this attack replaces one of them.\n' +
        'The target of your grapple must be no more than one size larger than you, and ' +
        'it must be within your reach. Using at least one free hand, you try to seize ' +
        'the target by making a grapple check instead of an attack roll: a Strength ' +
        '(Athletics) check contested by the target\u2019s Strength (Athletics) or ' +
        'Dexterity (Acrobatics) check (the target chooses which). You succeed ' +
        'automatically if the target is incapacitated. If you succeed, the target is ' +
        'subjected to the GRAPPLED condition. The condition specifies the things that ' +
        'end it, and you can release the target whenever you like (no action required).\n' +
        'ESCAPING A GRAPPLE: A grappled creature can use its action to escape. To do ' +
        'so, it must succeed on a Strength (Athletics) or Dexterity (Acrobatics) check ' +
        'contested by your Strength (Athletics) check.\n' +
        'MOVING A GRAPPLED CREATURE: When you move, you can drag or carry the grappled ' +
        'creature with you, but your speed is halved, unless the creature is two or ' +
        'more sizes smaller than you.\n' +
        'NOTE: a grapple imposes the GRAPPLED condition, NOT the restrained condition, ' +
        'and it is a contest, NOT a check against the target\u2019s Armour Class.',
    },
    {
      id: 'shove',
      title: 'Shoving a creature',
      keys: ['shove', 'shoving', 'push', 'knock down', 'knock prone', 'trip', 'topple'],
      text:
        'Using the Attack action, you can make a special melee attack to shove a ' +
        'creature, either to knock it prone or push it away from you. If you are able ' +
        'to make multiple attacks with the Attack action, this attack replaces one of ' +
        'them.\nThe target must be no more than one size larger than you and must be ' +
        'within your reach. Instead of making an attack roll, you make a Strength ' +
        '(Athletics) check contested by the target\u2019s Strength (Athletics) or ' +
        'Dexterity (Acrobatics) check (the target chooses). You succeed automatically ' +
        'if the target is incapacitated. If you succeed, you either knock the target ' +
        'prone or push it 5 feet away from you.',
    },
    {
      id: 'actions',
      title: 'Actions in combat',
      keys: ['what can i do', 'my options', 'actions in combat', 'action economy',
        'what actions', 'list of actions', 'my turn', 'on my turn', 'dodge', 'dash',
        'disengage', 'help', 'hide', 'use an object', 'ready', 'readying', 'search'],
      text:
        'On your turn you can MOVE up to your speed and take ONE action. You may also ' +
        'take one BONUS ACTION, but only if some feature, spell or ability says you ' +
        'can \u2014 you never simply "have" a bonus action to spend. You also get one ' +
        'REACTION per round, which you can take on anyone\u2019s turn, and one free ' +
        'object interaction (drawing a weapon, opening a door).\n' +
        'The actions available to everyone are:\n' +
        '\u2022 ATTACK \u2014 one melee or ranged attack (more if you have Extra Attack).\n' +
        '\u2022 CAST A SPELL \u2014 if its casting time is 1 action.\n' +
        '\u2022 DASH \u2014 gain extra movement equal to your speed for this turn.\n' +
        '\u2022 DISENGAGE \u2014 your movement provokes no opportunity attacks this turn.\n' +
        '\u2022 DODGE \u2014 until your next turn, attacks against you have disadvantage ' +
        'if you can see the attacker, and you make Dexterity saves with advantage. You ' +
        'lose this benefit if you are incapacitated or your speed drops to 0.\n' +
        '\u2022 HELP \u2014 give an ally advantage on one ability check, or on their next ' +
        'attack roll against a creature within 5 feet of you, before your next turn.\n' +
        '\u2022 HIDE \u2014 make a Dexterity (Stealth) check to become hidden.\n' +
        '\u2022 READY \u2014 choose a trigger and a response now; the response uses your ' +
        'REACTION when the trigger occurs, and a readied spell must be cast with a ' +
        '1-action casting time and held with concentration.\n' +
        '\u2022 SEARCH \u2014 devote your attention to finding something.\n' +
        '\u2022 USE AN OBJECT \u2014 for a second interaction, or one that needs an action.',
    },
    {
      id: 'opportunity',
      title: 'Opportunity attacks',
      keys: ['opportunity attack', 'attack of opportunity', 'leave melee', 'run away',
        'move away', 'provoke', 'flee'],
      text:
        'You can make an opportunity attack when a hostile creature that you can see ' +
        'moves out of your reach. To make the attack, you use your REACTION to make ' +
        'one melee attack against the provoking creature. The attack occurs right ' +
        'before the creature leaves your reach.\n' +
        'You can avoid provoking an opportunity attack by taking the Disengage action. ' +
        'You also don\u2019t provoke one when someone or something moves you without ' +
        'using your movement, action or reaction, nor when a creature teleports.',
    },
    {
      id: 'concentration',
      title: 'Concentration',
      keys: ['concentration', 'concentrating', 'concentrate', 'lose the spell',
        'maintain the spell', 'keep the spell up'],
      text:
        'Some spells require you to maintain concentration to keep their magic active. ' +
        'You lose concentration if any of the following happens:\n' +
        '\u2022 CASTING ANOTHER CONCENTRATION SPELL. You cannot concentrate on two ' +
        'spells at once.\n' +
        '\u2022 TAKING DAMAGE. You must make a CONSTITUTION saving throw to maintain ' +
        'concentration. The DC equals 10 or half the damage you take, WHICHEVER NUMBER ' +
        'IS HIGHER. If you take damage from multiple sources at once, you make a ' +
        'separate saving throw for each source.\n' +
        '\u2022 BEING INCAPACITATED OR KILLED.\n' +
        'The GM may also rule that a violently disruptive environment (a wave crashing ' +
        'over you) requires a DC 10 Constitution save.',
    },
    {
      id: 'deathsaves',
      title: 'Dropping to 0 hit points, and death saving throws',
      keys: ['0 hit points', 'zero hit points', 'death save', 'death saving',
        'dying', 'die', 'death', 'downed', 'knocked out', 'unconscious', 'stabilize',
        'stabilise', 'bleeding out'],
      text:
        'When you drop to 0 hit points, you either die outright or fall UNCONSCIOUS.\n' +
        'INSTANT DEATH: if damage reduces you to 0 hit points and there is damage ' +
        'remaining, you die if the remainder equals or exceeds your hit point maximum.\n' +
        'FALLING UNCONSCIOUS: otherwise you fall unconscious and are dying. You are ' +
        'NOT conscious \u2014 the unconscious condition applies: you are incapacitated, ' +
        'cannot move or speak, are unaware of your surroundings, drop what you are ' +
        'holding and fall prone, automatically fail Strength and Dexterity saves, and ' +
        'attacks against you have advantage; any attack that hits you from within 5 ' +
        'feet is a critical hit.\n' +
        'DEATH SAVING THROWS: at the start of each of your turns while at 0 hit ' +
        'points, you make a death saving throw \u2014 roll a d20, with no modifier of ' +
        'any kind. On a 10 or higher you succeed, otherwise you fail. On your THIRD ' +
        'success you become stable. On your THIRD failure you DIE. The successes and ' +
        'failures need not be consecutive, and both reset to zero once you are stable ' +
        'or regain any hit points.\n' +
        'ROLLING 1 OR 20: a roll of 1 counts as TWO failures. A roll of 20 means you ' +
        'regain 1 hit point immediately and are conscious again.\n' +
        'DAMAGE AT 0 HIT POINTS: taking any damage while at 0 hit points causes one ' +
        'death saving throw failure, or two if it was a critical hit.\n' +
        'STABILISING: another creature can use its action to administer first aid, ' +
        'succeeding on a DC 10 Wisdom (Medicine) check to make you stable. A stable ' +
        'creature makes no more death saves, remains unconscious, and regains 1 hit ' +
        'point after 1d4 hours. ANY amount of healing brings you back to consciousness.',
    },
    {
      id: 'advantage',
      title: 'Advantage and disadvantage',
      keys: ['advantage', 'disadvantage', 'roll twice'],
      text:
        'When you have advantage or disadvantage, you roll a SECOND d20 and use the ' +
        'higher roll for advantage, or the lower for disadvantage.\n' +
        'If circumstances give both advantage and disadvantage, you have NEITHER, and ' +
        'you roll one d20 \u2014 this is true even if several things give advantage and ' +
        'only one gives disadvantage. They do not stack: having advantage from two ' +
        'sources is no better than one.\n' +
        'If you have advantage or disadvantage and something lets you reroll or choose ' +
        'between rolls, you can reroll only one of the dice.',
    },
    {
      id: 'checks',
      title: 'Ability checks, saving throws and difficulty',
      keys: ['ability check', 'skill check', 'saving throw', 'save dc', 'difficulty class',
        'what do i roll', 'how do i roll', 'passive', 'proficiency bonus', 'modifier',
        'contest', 'contested'],
      text:
        'An ability check is d20 + the relevant ability modifier + your proficiency ' +
        'bonus if you are proficient in the skill or tool being used. It succeeds if ' +
        'the total meets or beats the Difficulty Class.\n' +
        'TYPICAL DCs: very easy 5, easy 10, medium 15, hard 20, very hard 25, nearly ' +
        'impossible 30.\n' +
        'SAVING THROWS: d20 + the ability modifier + your proficiency bonus if you are ' +
        'proficient in that saving throw. Your class grants proficiency in two.\n' +
        'SPELL SAVE DC = 8 + proficiency bonus + spellcasting ability modifier.\n' +
        'SPELL ATTACK BONUS = proficiency bonus + spellcasting ability modifier.\n' +
        'PASSIVE CHECKS: 10 + all the modifiers that normally apply, +5 with advantage ' +
        'or \u22125 with disadvantage. Passive Perception is the common one.\n' +
        'CONTESTS: both sides make an ability check and compare totals; the higher wins, ' +
        'and on a tie the situation is unchanged.',
    },
    {
      id: 'slots',
      title: 'Spell slots, casting, and cantrips',
      keys: ['spell slot', 'slots', 'higher level', 'upcast', 'cantrip', 'ritual',
        'prepare', 'prepared spell', 'known spell', 'component', 'somatic', 'verbal',
        'material', 'casting time', 'cast a spell'],
      text:
        'Casting a spell of 1st level or higher expends a slot of that spell\u2019s ' +
        'level or higher; you regain all expended slots on a LONG rest (a warlock\u2019s ' +
        'Pact Magic slots return on a SHORT rest).\n' +
        'CASTING AT A HIGHER LEVEL: when you use a slot higher than the spell\u2019s ' +
        'level, the spell takes on that higher level; only spells that say "At Higher ' +
        'Levels" gain an extra effect from it.\n' +
        'CANTRIPS are cast at will, without a slot, and cannot be cast at a higher level.\n' +
        'RITUALS: a spell with the ritual tag can be cast as a ritual if the caster has ' +
        'the Ritual Casting feature. It takes 10 minutes longer and expends NO slot, ' +
        'but cannot be cast at a higher level that way.\n' +
        'CASTING TIME: most spells take 1 action. A spell cast as a BONUS action ' +
        'restricts you: if you cast a spell with a bonus action, you can cast no other ' +
        'spell during that turn except a CANTRIP with a casting time of 1 action.\n' +
        'COMPONENTS: V requires speech, S requires a free hand, M requires the ' +
        'material listed \u2014 a component pouch or spellcasting focus replaces any ' +
        'material with no cost, but a material with a stated gold cost must be had, ' +
        'and one the spell says is consumed is used up.\n' +
        'CONCENTRATION: you can concentrate on only one spell at a time.',
    },
    {
      id: 'rests',
      title: 'Short and long rests',
      keys: ['rest', 'short rest', 'long rest', 'hit dice', 'recover', 'heal up',
        'sleep', 'camp', 'regain hit points'],
      text:
        'SHORT REST: at least 1 hour of light activity. You may spend any number of ' +
        'HIT DICE, rolling each and adding your Constitution modifier, to regain that ' +
        'many hit points (a roll can never restore less than 0). Features that recharge ' +
        'on a short rest return.\n' +
        'LONG REST: at least 8 hours, of which at least 6 are sleep and no more than 2 ' +
        'are light activity. You regain ALL hit points and half your total Hit Dice ' +
        '(minimum one). All spell slots and long-rest features return, and one level of ' +
        'exhaustion is removed.\n' +
        'A long rest is INTERRUPTED by 1 hour or more of walking, fighting, casting ' +
        'spells or similar strenuous activity, and must be begun again.\n' +
        'You cannot benefit from more than ONE long rest in any 24-hour period, and you ' +
        'must have at least 1 hit point at the start of a long rest to gain its benefit.',
    },
    {
      id: 'twoweapon',
      title: 'Two-weapon fighting and unarmed strikes',
      keys: ['two weapon', 'dual wield', 'off hand', 'offhand', 'two-weapon',
        'unarmed', 'punch', 'fist', 'improvised weapon'],
      text:
        'TWO-WEAPON FIGHTING: when you take the Attack action and attack with a LIGHT ' +
        'melee weapon held in one hand, you can use a BONUS action to attack with a ' +
        'different light melee weapon in the other hand. You do NOT add your ability ' +
        'modifier to the damage of the bonus attack, unless that modifier is negative. ' +
        'If either weapon has the thrown property, you can throw it instead.\n' +
        'UNARMED STRIKE: an unarmed strike is an attack using your body. On a hit it ' +
        'deals 1 + your Strength modifier bludgeoning damage, and it is not a weapon, ' +
        'so it cannot be used for two-weapon fighting.\n' +
        'IMPROVISED WEAPONS: an object not designed as a weapon deals 1d4 damage; if it ' +
        'resembles a real weapon, the GM may let it use that weapon\u2019s damage die ' +
        'and properties. You are not proficient unless a feature says so.',
    },
    {
      id: 'crits',
      title: 'Attack rolls, critical hits, and damage',
      keys: ['critical', 'crit', 'natural 20', 'natural 1', 'attack roll', 'to hit',
        'damage roll', 'resistance', 'vulnerable', 'vulnerability', 'temporary hit points',
        'temp hp'],
      text:
        'ATTACK ROLL: d20 + ability modifier + proficiency bonus if proficient with the ' +
        'weapon. It hits if it equals or exceeds the target\u2019s Armour Class. A ' +
        'natural 20 ALWAYS hits, and a natural 1 ALWAYS misses, whatever the modifiers.\n' +
        'CRITICAL HIT: on a natural 20 you roll all of the attack\u2019s DAMAGE DICE ' +
        'twice and add them together, then add your modifiers as normal. Only the dice ' +
        'are doubled, never the flat modifier.\n' +
        'RESISTANCE AND VULNERABILITY: resistance halves the damage, vulnerability ' +
        'doubles it. Multiple instances of resistance to the same damage type count ' +
        'only once. Resistance is applied AFTER all other modifiers; then round down.\n' +
        'TEMPORARY HIT POINTS are lost first and do not stack \u2014 taking a new lot ' +
        'means choosing which to keep. They are not healing, cannot exceed your maximum, ' +
        'and are lost on a long rest.',
    },
    {
      id: 'movement',
      title: 'Movement, difficult terrain, climbing, jumping and falling',
      keys: ['movement', 'move', 'speed', 'difficult terrain', 'climb', 'swim',
        'jump', 'jumping', 'fall', 'falling', 'crawl', 'prone', 'stand up', 'squeeze'],
      text:
        'You can move up to your speed on your turn, breaking it up around your action.\n' +
        'DIFFICULT TERRAIN: every foot of movement costs 1 extra foot, so you cover ' +
        'half the distance. It does not stack \u2014 terrain that is difficult for two ' +
        'reasons still costs only double.\n' +
        'CLIMBING, SWIMMING and CRAWLING each cost 1 extra foot per foot moved, unless ' +
        'you have a climbing or swimming speed.\n' +
        'STANDING UP from prone costs half your speed. Dropping prone is free.\n' +
        'LONG JUMP: your Strength score in feet with a 10-foot run-up, half that from ' +
        'standing. HIGH JUMP: 3 + your Strength modifier in feet with a run-up, half ' +
        'from standing.\n' +
        'FALLING: 1d6 bludgeoning damage per 10 feet fallen, to a maximum of 20d6, and ' +
        'you land prone unless the fall was avoided or you take no damage.',
    },
    {
      id: 'initiative',
      title: 'Initiative, rounds and surprise',
      keys: ['initiative', 'surprise', 'surprised', 'round', 'turn order', 'ambush',
        'who goes first'],
      text:
        'When combat starts, every participant makes a DEXTERITY check for initiative ' +
        '\u2014 d20 + Dexterity modifier \u2014 and acts in descending order. A round ' +
        'represents about 6 seconds and everyone gets one turn in it.\n' +
        'SURPRISE: the GM compares the Dexterity (Stealth) checks of anyone hiding ' +
        'against the passive Wisdom (Perception) of the others. Any creature that ' +
        'notices no threat is surprised. A surprised creature cannot move or take an ' +
        'action on its FIRST turn, and cannot take a reaction until that turn ENDS. ' +
        'Surprise is per creature: members of a group can be surprised while others ' +
        'are not, and being surprised is not a free round for the ambushers.',
    },
    {
      id: 'vision',
      title: 'Vision, light and being hidden',
      keys: ['darkvision', 'darkness', 'dark', 'light', 'obscured', 'blind', 'see',
        'hidden', 'stealth', 'invisible', 'sneak'],
      text:
        'A LIGHTLY OBSCURED area \u2014 dim light, patchy fog, moderate foliage \u2014 ' +
        'gives disadvantage on Wisdom (Perception) checks that rely on sight.\n' +
        'A HEAVILY OBSCURED area \u2014 darkness, opaque fog, dense foliage \u2014 ' +
        'blocks vision entirely: a creature there is effectively BLINDED when trying to ' +
        'see through it.\n' +
        'BRIGHT LIGHT lets most see normally; DIM LIGHT is lightly obscured; DARKNESS ' +
        'is heavily obscured.\n' +
        'DARKVISION lets a creature treat dim light as bright and darkness as dim, out ' +
        'to its range, but it cannot discern colour in darkness \u2014 only shades of grey.\n' +
        'UNSEEN ATTACKERS: attacking from a place the target cannot see gives you ' +
        'ADVANTAGE; attacking a target you cannot see gives you DISADVANTAGE. If you ' +
        'are hidden when you attack, you give away your position whether you hit or miss.',
    },
    {
      id: 'multiclass',
      title: 'Levelling up and multiclassing',
      keys: ['level up', 'levelling', 'leveling', 'multiclass', 'multiclassing',
        'experience', 'xp', 'new class', 'ability score improvement', 'asi', 'feat'],
      text:
        'When you gain a level you gain the new class features listed, roll or take the ' +
        'average of your class\u2019s Hit Die and add your Constitution modifier to ' +
        'increase your hit point maximum, and gain a Hit Die. Your PROFICIENCY BONUS is ' +
        'set by your TOTAL character level, not by any one class.\n' +
        'ABILITY SCORE IMPROVEMENT comes at 4th, 8th, 12th, 16th and 19th level in most ' +
        'classes: raise one score by 2 or two scores by 1, to a maximum of 20. A feat ' +
        'may be taken instead if the GM allows feats.\n' +
        'MULTICLASSING: you must have at least 13 in the primary ability of BOTH your ' +
        'current class and the new one (with a few classes requiring two such scores). ' +
        'You gain only a subset of the new class\u2019s proficiencies, and you do not ' +
        'get its starting equipment.\n' +
        'MULTICLASS SPELL SLOTS come from a single combined table based on your levels ' +
        'in each casting class, but the spells you know or prepare are still determined ' +
        'class by class. Warlock Pact Magic slots stay separate.',
    },
    {
      id: 'items',
      title: 'Magic items, attunement and carrying capacity',
      keys: ['attune', 'attunement', 'magic item', 'carry', 'carrying capacity',
        'encumbered', 'encumbrance', 'weight', 'inventory', 'potion', 'equip'],
      text:
        'ATTUNEMENT: some magic items work only if you are attuned. Attuning takes a ' +
        'SHORT REST focused on the item, and you can be attuned to no more than THREE ' +
        'items at once. Ending attunement takes another short rest, or happens ' +
        'automatically if the item is more than 100 feet away for 24 hours, if you die, ' +
        'or if another creature attunes to it.\n' +
        'CARRYING CAPACITY: your Strength score \u00d7 15 pounds. You can push, drag or ' +
        'lift up to twice that, but moving more than your capacity halves your speed.\n' +
        'POTIONS: drinking one is an ACTION; administering one to another creature is ' +
        'also an action.',
    },
    {
      id: 'cover',
      title: 'Cover',
      keys: ['cover', 'behind a wall', 'shield myself', 'obstacle'],
      text: 'Cover is not cumulative \u2014 a target benefits only from the most ' +
        'protective degree that applies.\n' +
        Object.keys(COVER).map(function (k) {
          var c = COVER[k];
          var label = k === 'threeQuarters' ? 'Three-quarters cover'
            : (k.charAt(0).toUpperCase() + k.slice(1) + ' cover');
          var bonus = (c.acBonus == null)
            ? 'The target cannot be targeted directly by an attack or a spell, ' +
              'though an area effect may still reach it.'
            : '+' + c.acBonus + ' to AC and +' + c.dexSaveBonus +
              ' to Dexterity saving throws.';
          return label + ': ' + (c.text || '') + ' ' + bonus;
        }).join('\n'),
    },
    {
      id: 'social',
      title: 'Social interaction and the skills',
      keys: ['persuade', 'persuasion', 'deception', 'lie', 'intimidate', 'intimidation',
        'insight', 'talk', 'negotiate', 'convince', 'skill list', 'what skills'],
      text:
        'Social approaches are resolved with Charisma checks: PERSUASION for good faith ' +
        'appeals, DECEPTION for lies, INTIMIDATION for threats and PERFORMANCE for ' +
        'entertaining. INSIGHT (Wisdom) reads intentions. The GM sets the DC from the ' +
        'creature\u2019s attitude \u2014 friendly, indifferent or hostile \u2014 and a ' +
        'single check rarely overrides a creature\u2019s core motivations.\n' +
        'THE SKILLS AND THEIR ABILITIES: ' +
        Object.keys(SKILLS).map(function (k) {
          var s = SKILLS[k];
          return (s.name || k) + ' (' + String(s.ability || '').toUpperCase() + ')';
        }).join(', ') + '.',
    },
    {
      id: 'inspiration',
      title: 'Inspiration',
      keys: ['inspiration', 'reroll', 're-roll'],
      text:
        'Inspiration is a reward the GM gives for playing your traits, ideals, bonds or ' +
        'flaws well. You either have it or you do not \u2014 it does not accumulate. ' +
        'You can spend it to give yourself ADVANTAGE on one attack roll, ability check ' +
        'or saving throw, or give it to another player who deserves it.',
    },
  ];

  /* Conditions come straight from the data the engine enforces. */
  ENTRIES.push({
    id: 'conditions',
    title: 'The conditions',
    keys: ['condition', 'blinded', 'charmed', 'deafened', 'frightened', 'grappled',
      'incapacitated', 'paralyzed', 'paralysed', 'petrified', 'poisoned',
      'restrained', 'stunned', 'exhaustion', 'exhausted'],
    text: Object.keys(CONDITIONS).map(function (k) {
      var c = CONDITIONS[k];
      return (c.name || k).toUpperCase() + ': ' + (c.text || '');
    }).join('\n'),
  });

  if (EXHAUSTION.levels) {
    ENTRIES.push({
      id: 'exhaustion',
      title: 'Exhaustion',
      keys: ['exhaustion', 'exhausted', 'tired', 'no sleep', 'starving', 'forced march'],
      text: 'Exhaustion is measured in six levels, and the effects are cumulative \u2014 ' +
        'a creature at level 2 also suffers level 1.\n' +
        (EXHAUSTION.levels || []).map(function (l, i) {
          return 'Level ' + (typeof l === 'object' ? (l.level || i + 1) : i + 1) + ': ' +
            (typeof l === 'object' ? (l.effect || l.text || '') : l);
        }).join('\n') +
        '\nA long rest removes one level, provided the creature has also had food and drink.',
    });
  }

  /* ------------------------------------------------------------- lookup --- */

  function norm(s) { return ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ') + ' '; }

  /**
   * The rules a question is about, best match first.
   *
   * Scored rather than first-match: "what happens if I take damage while
   * concentrating and drop to 0 hit points" is genuinely two rules, and
   * answering only the first half is the kind of half-answer that sends a
   * player back to ask again.
   */
  function lookup(question, limit) {
    var q = norm(question);
    var scored = [];
    ENTRIES.forEach(function (e) {
      var score = 0;
      e.keys.forEach(function (k) {
        if (q.indexOf(' ' + k) >= 0 || q.indexOf(k + ' ') >= 0) {
          /* Longer keys are more specific, so "death save" beats "save". */
          score += 1 + k.length / 20;
        }
      });
      if (score > 0) scored.push({ entry: e, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, limit || 3).map(function (s) { return s.entry; });
  }

  /** The matched rules as a block ready to drop into a prompt. */
  function forPrompt(question, limit) {
    var hits = lookup(question, limit);
    if (!hits.length) return '';
    return hits.map(function (e) {
      return '### ' + e.title + '\n' + e.text;
    }).join('\n\n');
  }

  function topics() { return ENTRIES.map(function (e) { return e.id; }); }
  function byId(id) {
    return ENTRIES.filter(function (e) { return e.id === id; })[0] || null;
  }

  return { ENTRIES: ENTRIES, lookup: lookup, forPrompt: forPrompt, topics: topics, byId: byId };
});
