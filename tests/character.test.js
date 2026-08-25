/*
 * tests/character.test.js — the three-layer model and the pure derive().
 *
 * Reviewer checklist cases 6, 20, 21 and 22 live here, plus the 2014 exhaustion
 * ladder, ability override/drain, and derive() purity. Fixtures for classes and
 * items are defined inline so the suite passes with or without the SRD data
 * files present — the modules take their data by injection.
 */
'use strict';
const t = require('./_harness')('character');
const Effects = require('../js/engine/effects.js');
const Character = require('../js/engine/character.js');

/* Minimal class data — only the fields derive() actually reads. */
const CLASSES = {
  fighter: { id: 'fighter', name: 'Fighter', hitDie: 10, casterType: 'none', subclassLevel: 3, saves: ['str', 'con'] },
  wizard: { id: 'wizard', name: 'Wizard', hitDie: 6, casterType: 'full', subclassLevel: 2, saves: ['int', 'wis'], spellcasting: { ability: 'int', prepares: 'spellbook' } },
  cleric: { id: 'cleric', name: 'Cleric', hitDie: 8, casterType: 'full', subclassLevel: 1, saves: ['wis', 'cha'], spellcasting: { ability: 'wis', prepares: 'prepared' } },
  sorcerer: { id: 'sorcerer', name: 'Sorcerer', hitDie: 6, casterType: 'full', subclassLevel: 1, saves: ['con', 'cha'], spellcasting: { ability: 'cha', prepares: 'known' } },
  warlock: { id: 'warlock', name: 'Warlock', hitDie: 8, casterType: 'pact', subclassLevel: 1, saves: ['wis', 'cha'], spellcasting: { ability: 'cha', prepares: 'known' } },
  barbarian: { id: 'barbarian', name: 'Barbarian', hitDie: 12, casterType: 'none', subclassLevel: 3, saves: ['str', 'con'], unarmoredDefense: 'con' },
  monk: { id: 'monk', name: 'Monk', hitDie: 8, casterType: 'none', subclassLevel: 3, saves: ['str', 'dex'], unarmoredDefense: 'wis' },
  paladin: { id: 'paladin', name: 'Paladin', hitDie: 10, casterType: 'half', subclassLevel: 3, saves: ['wis', 'cha'], spellcasting: { ability: 'cha', prepares: 'prepared' } },
  ranger: { id: 'ranger', name: 'Ranger', hitDie: 10, casterType: 'half', subclassLevel: 3, saves: ['str', 'dex'], spellcasting: { ability: 'wis', prepares: 'known' } },
};

/* Real srd_items armor shape: baseAC + a dexBonus of 'full'|'max2'|'none'. */
const ITEMS = {
  'plate-armor': { id: 'plate-armor', name: 'Plate Armor', armorType: 'heavy', ac: 18, mech: { baseAC: 18, dexBonus: 'none' } },
  'shield': { id: 'shield', name: 'Shield', armorType: 'shield', ac: 2, mech: { baseAC: 2, dexBonus: 'none' } },
};

Character.setData({ CLASSES: CLASSES, ITEMS: ITEMS });

/* An effect that emits an AC contribution, the way a spell would. */
function mageArmor() {
  return { id: 'mage_armor', name: 'Mage Armor', targetId: 'self', kind: 'ac',
    ac: { type: 'base', source: 'mage_armor', value: function (m) { return 13 + m.dex; }, requires: function (ctx) { return !ctx.hasArmor; } } };
}
function barkskin() {
  return { id: 'barkskin', name: 'Barkskin', targetId: 'self', kind: 'ac', ac: { type: 'floor', source: 'barkskin', value: 16 } };
}

function baseOf(classId, abilities, extra) {
  return Object.assign({
    raceId: null, subraceId: null, classes: [{ classId: classId, levels: (extra && extra.levels) || 1 }],
    backgroundId: null, abilities: abilities, proficiencies: { saves: [], skills: [] }, name: 'T', alignment: 'N',
  }, extra || {});
}
function progOf(classId, hpGained) {
  return { xp: 0, levels: (hpGained || []).map(function (hp, i) { return { level: i + 1, classId: classId, hpGained: hp }; }) };
}

/* -------------------------------- checklist 6 — temporary HP never stacks -- */
t.section('checklist 6 — temporary HP takes the highest, never adds');
t.eq(Effects.mergeTempHp(5, 8), 8, '5 temp HP then gain 8 becomes 8, not 13');
t.eq(Effects.mergeTempHp(8, 5), 8, 'a smaller incoming temp pool does not lower the current one');
let absorbed = Effects.applyDamageWithTemp(8, 20, 6);
t.eq(absorbed.tempHp, 2, '6 damage spends temp HP first (8 -> 2)');
t.eq(absorbed.hp, 20, 'real HP is untouched while temp HP absorbs the hit');
t.eq(absorbed.absorbed, 6, 'the temp pool reports how much it absorbed');
let overrun = Effects.applyDamageWithTemp(8, 20, 11);
t.eq(overrun.tempHp, 0, 'damage past the temp pool empties it');
t.eq(overrun.hp, 17, 'and the remaining 3 carries through to real HP');

/* -------------------------------- checklist 20 — AC contribution model ----- */
t.section('checklist 20 — AC scenarios resolve with no special cases');

let d = Character.derive(baseOf('wizard', { str: 10, dex: 14, con: 10, int: 16, wis: 10, cha: 10 }),
  progOf('wizard', [6]), { equipped: { shield: true } }, [mageArmor()]);
t.eq(d.ac, 17, '(a) Wizard Dex 14 + Mage Armor + shield = 17');

d = Character.derive(baseOf('barbarian', { str: 14, dex: 16, con: 16, int: 10, wis: 10, cha: 10 }),
  progOf('barbarian', [12]), { equipped: { shield: true } }, []);
t.eq(d.ac, 18, '(b) Barbarian Dex 16 / Con 16, no armour, shield = 18');

d = Character.derive(baseOf('monk', { str: 12, dex: 16, con: 12, int: 10, wis: 14, cha: 10 }),
  progOf('monk', [8]), { equipped: {} }, []);
t.eq(d.ac, 15, '(c) Monk Dex 16 / Wis 14, no armour = 15');

d = Character.derive(baseOf('fighter', { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 }),
  progOf('fighter', [10]), { equipped: {} }, [barkskin()]);
t.eq(d.ac, 16, '(d) Barkskin floors a computed AC of 12 up to 16');

let plateBase = baseOf('fighter', { str: 16, dex: 20, con: 12, int: 10, wis: 10, cha: 10 });
let plateProg = progOf('fighter', [10]);
plateProg.fightingStyles = ['defense'];
d = Character.derive(plateBase, plateProg, { equipped: { armor: 'plate-armor' } }, []);
t.eq(d.ac, 19, '(e) Plate (base 18, maxDex 0) + Defense style = 19 regardless of Dex');
t.ok(Array.isArray(d.acBreakdown) && d.acBreakdown.length > 0, 'derive returns an acBreakdown for the log');

/* -------------------------------- checklist 21 — max HP from stored rolls --- */
t.section('checklist 21 — max HP from stored per-level rolls, Con retroactive');
let hpSpec = Character.buildFromSpec({ classId: 'fighter', levels: 3, abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, hpRolls: [10, 6, 7] });
let hpD = Character.derive(hpSpec.base, hpSpec.progression, hpSpec.runtime, []);
t.eq(hpD.hpMax, 29, 'Fighter 3, Con 14, rolls [10,6,7]: 23 + 3x2 = 29');
hpSpec.base.abilities.con = 16;
let hpD2 = Character.derive(hpSpec.base, hpSpec.progression, hpSpec.runtime, []);
t.eq(hpD2.hpMax, 32, 'raising Con to 16 adds one HP per level (+3 total) = 32');

/* -------------------------------- checklist 22 — multiclass vs pact slots --- */
t.section('checklist 22 — multiclass slots, Warlock pact stays separate');
let cw = Character.derive(
  baseOf('cleric', { str: 10, dex: 10, con: 12, int: 10, wis: 16, cha: 10 }, { classes: [{ classId: 'cleric', levels: 3 }, { classId: 'wizard', levels: 2 }] }),
  { levels: new Array(5).fill(0).map((_, i) => ({ level: i + 1, classId: i < 3 ? 'cleric' : 'wizard', hpGained: 5 })) },
  {}, []);
t.eq(cw.spellcasting.slotsMax[1], 4, 'Cleric 3 / Wizard 2 -> caster level 5 -> 4 first-level slots');
t.eq(cw.spellcasting.slotsMax[2], 3, 'caster level 5 -> 3 second-level slots');
t.eq(cw.spellcasting.slotsMax[3], 2, 'caster level 5 -> 2 third-level slots');
t.eq(cw.spellcasting.pactSlots, null, 'a non-warlock multiclass has no pact slots');

let ws = Character.derive(
  baseOf('warlock', { str: 10, dex: 12, con: 12, int: 10, wis: 10, cha: 16 }, { classes: [{ classId: 'warlock', levels: 2 }, { classId: 'sorcerer', levels: 2 }] }),
  { levels: new Array(4).fill(0).map((_, i) => ({ level: i + 1, classId: i < 2 ? 'warlock' : 'sorcerer', hpGained: 5 })) },
  {}, []);
t.eq(ws.spellcasting.slotsMax[1], 3, 'Warlock 2 / Sorcerer 2: only the Sorcerer 2 feeds the table -> 3 first-level slots');
t.eq(ws.spellcasting.slotsMax[2], undefined, 'the pact levels are NOT summed into the multiclass table');
t.eq(ws.spellcasting.pactSlots.max, 2, 'Warlock 2 pact magic is a separate pool of 2 slots');
t.eq(ws.spellcasting.pactSlots.level, 1, 'Warlock 2 pact slots are first level');

/* -------------------------------- half-caster slots (single vs multiclass) - */
t.section('half-caster slots — single-class uses its own table, multiclass rounds down');
function slotsOf(classes, levelRows) {
  var b = baseOf(classes[0].classId, { str: 12, dex: 12, con: 12, int: 10, wis: 14, cha: 16 }, { classes: classes });
  var d = Character.derive(b, { levels: levelRows }, {}, []);
  return d.spellcasting.slotsMax;
}
function levelRows(classes) {
  var rows = [], lvl = 0;
  classes.forEach(function (c) { for (var i = 0; i < c.levels; i++) { lvl++; rows.push({ level: lvl, classId: c.classId, hpGained: 6 }); } });
  return rows;
}
let pal3 = slotsOf([{ classId: 'paladin', levels: 3 }], levelRows([{ classId: 'paladin', levels: 3 }]));
t.eq(pal3[1], 3, 'Paladin 3 (single class, this is Shen) has 3 first-level slots, not 2');
t.eq(pal3[2], undefined, 'Paladin 3 has no second-level slots');

let pal5 = slotsOf([{ classId: 'paladin', levels: 5 }], levelRows([{ classId: 'paladin', levels: 5 }]));
t.eq(pal5[1], 4, 'Paladin 5 (single class) has 4 first-level slots');
t.eq(pal5[2], 2, 'Paladin 5 (single class) has 2 second-level slots');

let pal9 = slotsOf([{ classId: 'paladin', levels: 9 }], levelRows([{ classId: 'paladin', levels: 9 }]));
t.deep([pal9[1], pal9[2], pal9[3]], [4, 3, 2], 'Paladin 9 (single class) has 4 / 3 / 2');

let ran5 = slotsOf([{ classId: 'ranger', levels: 5 }], levelRows([{ classId: 'ranger', levels: 5 }]));
t.eq(ran5[1], 4, 'Ranger 5 (single class) has 4 first-level slots');
t.eq(ran5[2], 2, 'Ranger 5 (single class) has 2 second-level slots');

/* Multiclass path: floor(5/2) = 2 caster levels -> 3 first-level slots only. */
let palFighter = slotsOf([{ classId: 'paladin', levels: 5 }, { classId: 'fighter', levels: 2 }],
  levelRows([{ classId: 'paladin', levels: 5 }, { classId: 'fighter', levels: 2 }]));
t.eq(palFighter[1], 3, 'Paladin 5 / Fighter 2 uses floor(5/2)=2 for the multiclass table -> 3 first-level slots');
t.eq(palFighter[2], undefined, 'the multiclass Paladin has no second-level slots at caster level 2');

/* The two paths MUST disagree for Paladin 5, so a refactor cannot silently
   merge them. */
t.ok(pal5[1] !== palFighter[1] || pal5[2] !== palFighter[2],
  'single-class and multiclass Paladin 5 give DIFFERENT slot arrays (4/2 vs 3/-)');

let palRanger = slotsOf([{ classId: 'paladin', levels: 6 }, { classId: 'ranger', levels: 6 }],
  levelRows([{ classId: 'paladin', levels: 6 }, { classId: 'ranger', levels: 6 }]));
t.deep([palRanger[1], palRanger[2], palRanger[3]], [4, 3, 3],
  'Paladin 6 / Ranger 6 -> floor(6/2)+floor(6/2)=6 -> full-caster L6 slots 4/3/3');

/* restoreOnRest brings a single-class Paladin back to a full slate. */
const Rules = require('../js/engine/rules.js');
let palBase = baseOf('paladin', { str: 12, dex: 12, con: 12, int: 10, wis: 14, cha: 16 }, { classes: [{ classId: 'paladin', levels: 5 }] });
let palProg = { levels: levelRows([{ classId: 'paladin', levels: 5 }]) };
let palRun = { slotsSpent: { 1: 3, 2: 1 } };
let palDerived = Character.derive(palBase, palProg, palRun, []);
let palRest = Rules.restoreOnRest(palBase, palProg, palRun, 'long', { derived: palDerived, actorId: 'shen' });
/* Assert the outcome, not the wire format. The previous version checked for a
   `resource` event named "slot_1" and passed happily while the applier filed
   it under `runtime.resources` — a pool no rule consults — so the paladin woke
   from a full night with every slot still spent. Commit the events and look at
   the pool the casting check actually reads. */
{
  const EventsMod = require('../js/engine/events.js');
  const StateMod = require('../js/engine/state.js');
  const s = StateMod.create({ seed: 'paladin-rest' });
  StateMod.addActor(s, {
    id: 'shen', name: 'Shen', side: 'party', kind: 'pc',
    base: palBase, progression: palProg,
    runtime: Object.assign({
      hp: 10, hpMax: 44, conditions: {}, inventory: [], deathSaves: {},
    }, JSON.parse(JSON.stringify(palRun))),
  });
  const batch = EventsMod.makeBatch({ commandId: 'rest', actorId: 'shen' });
  palRest.events.forEach(e => batch.events.push(e));
  const res = EventsMod.commit(s, batch);
  t.eq(res.ok, true, 'the long rest commits cleanly');
  t.deep(s.actors.shen.runtime.slotsSpent, {},
    'a long rest leaves the Paladin with no spent slots at all');
}
t.eq(palDerived.spellcasting.slotsMax[1], 4, 'confirming the single-class Paladin 5 max is 4 first-level slots');

/* -------------------------------- 2014 exhaustion ladder ------------------- */
t.section('2014 exhaustion ladder — six distinct cumulative rungs');
t.eq(Effects.exhaustionDisadvantage(1, 'ability_check'), true, 'level 1: disadvantage on ability checks');
t.eq(Effects.exhaustionDisadvantage(1, 'attack'), false, 'level 1 does not touch attack rolls yet');
let exBase = baseOf('fighter', { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, { speed: 30 });
let exProg = progOf('fighter', [10, 6, 6, 6]);
t.eq(Character.derive(exBase, exProg, { exhaustion: 2 }, []).speed, 15, 'level 2: speed halved (30 -> 15)');
t.eq(Effects.exhaustionDisadvantage(3, 'attack'), true, 'level 3: disadvantage on attack rolls');
t.eq(Effects.exhaustionDisadvantage(3, 'save'), true, 'level 3: disadvantage on saving throws');
t.eq(Character.derive(exBase, exProg, { exhaustion: 0 }, []).hpMax, 36, 'baseline hpMax is 36');
t.eq(Character.derive(exBase, exProg, { exhaustion: 4 }, []).hpMax, 18, 'level 4: hit point maximum halved (36 -> 18)');
t.eq(Character.derive(exBase, exProg, { exhaustion: 5 }, []).speed, 0, 'level 5: speed reduced to 0');
t.eq(Character.derive(exBase, exProg, { exhaustion: 6 }, []).dead, true, 'level 6: death');

/* -------------------------------- ability override and drain --------------- */
t.section('ability override (Feeblemind) and drain (Shadow)');
let fbBase = baseOf('wizard', { str: 10, dex: 12, con: 12, int: 16, wis: 12, cha: 14 });
fbBase.proficiencies.saves = ['int', 'wis'];
let fb = Character.derive(fbBase, progOf('wizard', [6]), { abilityOverride: { int: 1 } }, []);
t.eq(fb.abilityMods.int, -5, 'Feeblemind sets Intelligence to 1, giving a -5 modifier');
t.eq(fb.saves.int, -3, 'the Intelligence save modifier follows the override (-5 + proficiency 2)');
t.eq(fb.abilities.int, 1, 'the derived Intelligence score is exactly 1');

let drained = Character.derive(baseOf('fighter', { str: 16, dex: 12, con: 12, int: 10, wis: 10, cha: 10 }),
  progOf('fighter', [10]), { abilityDrain: { str: 4 } }, []);
t.eq(drained.abilities.str, 12, 'Shadow drains Strength by 4 (16 -> 12)');
t.eq(drained.abilityMods.str, 1, 'the drained Strength modifier is +1');

/* -------------------------------- derive() purity -------------------------- */
t.section('derive() is pure — identical output, no mutation of arguments');
function deepFreeze(o) {
  if (o && typeof o === 'object') { Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); Object.freeze(o); }
  return o;
}
let pBase = deepFreeze(baseOf('barbarian', { str: 14, dex: 16, con: 16, int: 10, wis: 10, cha: 10 }));
let pProg = deepFreeze(progOf('barbarian', [12]));
let pRun = deepFreeze({ equipped: { shield: true }, exhaustion: 1 });
let pEff = deepFreeze([mageArmor()]);
let first = Character.derive(pBase, pProg, pRun, pEff);
let second = Character.derive(pBase, pProg, pRun, pEff);
t.deep(second, first, 'two calls with the same inputs give identical output');
t.ok(Object.isFrozen(pBase) && Object.isFrozen(pRun), 'inputs stayed frozen (derive never wrote to them)');


/* ---------------------------------------------------------------------- */
t.section('a subclass chosen at first level is actually granted');
/*
 * Cleric, sorcerer and warlock all choose at FIRST level in the 2014 rules.
 * The character builder never asked, so they arrived with `subclassId: null`
 * and none of the subclass's features — and because the level-up prompt only
 * fires when a new class level exactly EQUALS the subclass level, the choice
 * was skipped permanently rather than deferred to the next level.
 */
{
  /* The real SRD tables, not this file's fixture. The fixture class table has
     no subclasses at all, so testing against it would prove only that the
     fixture is empty — which is very close to how a character with no subclass
     went unnoticed in the first place. */
  Character.setData({
    CLASSES: require('../js/data/srd_classes.js').CLASSES,
    ITEMS: require('../js/data/srd_items.js').ITEMS,
  });

  const at1 = ['cleric', 'sorcerer', 'warlock'];
  at1.forEach(classId => {
    const c = Character.buildFromSpec({
      name: 'Test', raceId: 'human', classId, levels: 1, backgroundId: 'acolyte',
      abilities: { str: 12, dex: 12, con: 14, int: 12, wis: 15, cha: 15 },
      proficiencies: { skills: [] },
    });
    t.ok(!!c.base.classes[0].subclassId,
      'a first-level ' + classId + ' has a subclass',
      '(' + c.base.classes[0].subclassId + ')');
  });

  /* And not before it is due: a fighter picks at third. */
  const f1 = Character.buildFromSpec({
    name: 'Test', raceId: 'human', classId: 'fighter', levels: 1, backgroundId: 'soldier',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    proficiencies: { skills: [] },
  });
  t.eq(f1.base.classes[0].subclassId, null,
    'a first-level fighter has none, because none is due until third');

  const f3 = Character.buildFromSpec({
    name: 'Test', raceId: 'human', classId: 'fighter', levels: 3, backgroundId: 'soldier',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    proficiencies: { skills: [] },
  });
  t.ok(!!f3.base.classes[0].subclassId, 'and a third-level fighter does',
    '(' + f3.base.classes[0].subclassId + ')');

  /* A caller who has already chosen keeps their choice. */
  const chosen = Character.buildFromSpec({
    name: 'Test', raceId: 'human', classId: 'cleric', levels: 1, backgroundId: 'acolyte',
    abilities: { str: 12, dex: 12, con: 14, int: 12, wis: 15, cha: 15 },
    proficiencies: { skills: [] }, subclassId: 'war',
  });
  t.eq(chosen.base.classes[0].subclassId, 'war',
    'an explicit choice is never overwritten by the default');
}

t.done();
