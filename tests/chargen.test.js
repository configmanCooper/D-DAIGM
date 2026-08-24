/*
 * tests/chargen.test.js — making characters, and advancing them.
 *
 * Covers the three creation routes (manual with advice, guided, fully random),
 * the level-up flow including the choices each level actually presents, and
 * backstory generation. The level tables are checked against the printed 5e
 * progression, because "the paladin has the wrong number of spell slots at
 * level 9" is exactly the kind of thing nobody notices until session twelve.
 */
'use strict';
const t = require('./_harness')('chargen');
const { RNG } = require('../js/rng.js');
const Chargen = require('../js/gen/chargen.js');
const LevelUp = require('../js/engine/levelup.js');
const Character = require('../js/engine/character.js');
const State = require('../js/engine/state.js');
const Events = require('../js/engine/events.js');
const Backstory = require('../js/ai/backstory.js');
const Backend = require('../js/ai/backend.js');
const DATA = {
  RACES: require('../js/data/srd_races.js').RACES,
  CLASSES: require('../js/data/srd_classes.js').CLASSES,
};

/* ------------------------------------------------------------ suggestions -- */
t.section('suggestions teach rather than decide');
const paladinAdvice = Chargen.suggestionsFor({ raceId: 'human', classId: 'paladin' });
t.deep(paladinAdvice.abilityPriority.slice(0, 2), ['str', 'cha'],
  'a paladin is told to lead with Strength and Charisma');
t.ok(paladinAdvice.abilityWhy.length > 20, 'and told why', '(' + paladinAdvice.abilityWhy + ')');
t.ok(paladinAdvice.playstyle.length > 20, 'and what the class actually plays like');
t.ok(paladinAdvice.skills.length >= 2, 'skills are suggested');
t.ok(paladinAdvice.skills.every(s => DATA.CLASSES.paladin.skillChoices.from.indexOf(s) >= 0),
  'and only ones the class may actually take');
t.ok(Object.keys(paladinAdvice.skillWhy).length > 0, 'each suggested skill comes with a reason');
t.ok(/subclass at level 3/i.test(paladinAdvice.classNotes),
  'the class note gives the real subclass level', '(' + paladinAdvice.classNotes + ')');

const wizardAdvice = Chargen.suggestionsFor({ raceId: 'halfOrc', classId: 'wizard' });
t.eq(wizardAdvice.warnings.length, 1, 'a mismatched race produces exactly one gentle note');
t.ok(/Perfectly playable/.test(wizardAdvice.warnings[0]),
  'and it is a note, not a prohibition', '(' + wizardAdvice.warnings[0] + ')');

const barbAdvice = Chargen.suggestionsFor({ raceId: 'halfOrc', classId: 'barbarian' });
t.eq(barbAdvice.warnings.length, 0, 'a good pairing produces no warning');
t.ok(barbAdvice.synergy.length > 10, 'and says what the pairing gives you',
  '(' + barbAdvice.synergy + ')');
t.ok(/\+2 STR/.test(barbAdvice.raceNotes), 'the race note states the actual bonuses');

t.section('suggestions survive a partial character');
t.eq(Chargen.suggestionsFor({}).abilityPriority, null, 'nothing chosen yet gives no ability advice');
t.ok(Chargen.suggestionsFor({ raceId: 'elf' }).raceNotes.length > 0,
  'a race alone still describes itself');
t.ok(Chargen.suggestionsFor({ classId: 'rogue' }).skills.length > 0,
  'a class alone still suggests skills');

/* ------------------------------------------------------- suggested stats -- */
t.section('suggested ability scores');
const pb = Chargen.suggestedPointBuy('wizard');
t.eq(Chargen.pointBuyCost(pb), 27, 'the suggested point-buy spread costs exactly 27');
t.eq(pb.int, 15, 'and puts the highest score in the class\u2019s primary ability');

const shenScores = Chargen.suggestedAbilities('paladin', 'human');
t.ok(shenScores.str >= 15, 'a human paladin\u2019s Strength leads');
t.ok(shenScores.cha >= 14, 'with Charisma close behind');
Object.keys(shenScores).forEach(k => t.ok(shenScores[k] >= 8 && shenScores[k] <= 20,
  k + ' is a legal score', '(' + shenScores[k] + ')'));

const dwarfCleric = Chargen.suggestedAbilities('cleric', 'dwarf', 'hill');
t.ok(dwarfCleric.con >= 15, 'racial bonuses are folded in (hill dwarf Constitution)');

/* ------------------------------------------------------ generation modes -- */
t.section('fully random characters');
const seen = {};
for (let i = 0; i < 25; i++) {
  const c = Chargen.generate({ rng: new RNG('rand' + i) });
  seen[c.classId] = true;
  t.ok(!!c.name && c.name.length > 1, 'character ' + i + ' has a name', '(' + c.name + ')');
  t.ok(!!DATA.RACES[c.raceId], 'and a real race');
  t.ok(!!DATA.CLASSES[c.classId], 'and a real class');
  t.ok(c.skills.length > 0, 'and skills');
  t.ok(!!c.backstory, 'and a backstory seed');
  const pool = DATA.CLASSES[c.classId].skillChoices.from;
  t.ok(c.skills.every(s => pool.indexOf(s) >= 0), 'whose skills are legal for the class');
}
t.ok(Object.keys(seen).length >= 5, 'random generation actually varies the class',
  '(' + Object.keys(seen).length + ' distinct in 25)');

t.section('guided generation: fix what you care about');
const dwarfOnly = Chargen.generate({ rng: new RNG('g1'), fixed: { raceId: 'dwarf' } });
t.eq(dwarfOnly.raceId, 'dwarf', 'a fixed race is honoured');
t.ok(!!dwarfOnly.classId, 'and everything else is filled in');

const namedPaladin = Chargen.generate({
  rng: new RNG('g2'),
  fixed: { classId: 'paladin', name: 'Shen Cooper', backgroundId: 'soldier' },
});
t.eq(namedPaladin.name, 'Shen Cooper', 'a fixed name is honoured');
t.eq(namedPaladin.classId, 'paladin', 'a fixed class is honoured');
t.eq(namedPaladin.backgroundId, 'soldier', 'a fixed background is honoured');
t.ok(namedPaladin.abilities.str >= 15, 'and the generated stats suit the fixed class');
t.deep(namedPaladin.generated.fixedFields.sort(), ['backgroundId', 'classId', 'name'],
  'and it reports exactly what the player pinned');

t.section('generation is reproducible');
t.deep(Chargen.generate({ rng: new RNG('same') }), Chargen.generate({ rng: new RNG('same') }),
  'the same seed makes the same character');
t.ok(JSON.stringify(Chargen.generate({ rng: new RNG('a') })) !==
  JSON.stringify(Chargen.generate({ rng: new RNG('b') })),
  'different seeds make different characters');

t.section('rolled statistics stay in range');
for (let i = 0; i < 20; i++) {
  const rolled = Chargen.rolledAbilities(new RNG('roll' + i), 'fighter', 'human');
  Object.keys(rolled).forEach(k => {
    t.ok(rolled[k] >= 3 && rolled[k] <= 20, 'rolled ' + k + ' is within 3..20',
      rolled[k] < 3 || rolled[k] > 20 ? '(' + rolled[k] + ')' : '');
  });
}

/* ----------------------------------------------------------- levelling ----- */
function freshPaladin(level) {
  const spec = {
    name: 'Test Paladin', raceId: 'human', classId: 'paladin', levels: level || 3,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 16 },
    proficiencies: { skills: ['athletics', 'persuasion'], saves: ['wis', 'cha'] },
    hpRolls: [10, 6, 6],
  };
  return Character.buildFromSpec(spec);
}

t.section('when a level is due');
{
  const c = freshPaladin(3);
  c.progression.xp = 900;
  t.eq(LevelUp.pendingLevel(c.base, c.progression), null, '900 xp is not enough for level 4');
  c.progression.xp = 2700;
  const p = LevelUp.pendingLevel(c.base, c.progression);
  t.ok(!!p, '2700 xp is');
  t.eq(p.to, 4, 'and it is level 4 that is due');
  t.eq(p.reason, 'xp', 'earned through experience');

  const m = freshPaladin(3);
  m.progression.levelGranted = 4;
  t.eq(LevelUp.pendingLevel(m.base, m.progression).reason, 'milestone',
    'milestone campaigns can grant a level without experience');
}

t.section('what each level asks you to decide');
{
  const c = freshPaladin(3);
  const four = LevelUp.optionsFor(c.base, c.progression, { classId: 'paladin' });
  const ids = four.groups.map(g => g.id);
  t.ok(ids.indexOf('hp') >= 0, 'every level asks about hit points');
  t.ok(ids.indexOf('asi') >= 0, 'level 4 offers an ability score improvement');
  t.eq(four.hitDie, 10, 'and knows a paladin uses a d10');
  const hp = four.groups.filter(g => g.id === 'hp')[0];
  t.eq(hp.choices.filter(c2 => c2.id === 'average')[0].value, 6,
    'the average of a d10 is 6, per the rules');
  const asi = four.groups.filter(g => g.id === 'asi')[0];
  t.ok(!!asi.recommended, 'the improvement comes with a recommendation');
  t.ok(asi.recommended.why.length > 10, 'and a reason for it');
}

t.section('level 3 offers the subclass, level 5 does not');
{
  const two = Character.buildFromSpec({
    name: 'T', raceId: 'human', classId: 'paladin', levels: 2,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 16 },
    proficiencies: { skills: [], saves: [] }, hpRolls: [10, 6],
  });
  const three = LevelUp.optionsFor(two.base, two.progression, { classId: 'paladin' });
  t.ok(three.groups.map(g => g.id).indexOf('subclass') >= 0,
    'reaching level 3 asks a paladin to choose their oath');
}

t.section('the ability improvement obeys the rules');
{
  const c = freshPaladin(3);
  const opts = LevelUp.optionsFor(c.base, c.progression, { classId: 'paladin' });
  t.ok(LevelUp.validate(opts, { hp: 'average', asi: { mode: 'plus2', abilities: ['str'] } }).length === 0,
    '+2 to one ability is legal');
  t.ok(LevelUp.validate(opts, { hp: 'average', asi: { mode: 'plus2', abilities: ['str', 'cha'] } }).length > 0,
    '+2 split across two abilities is rejected');
  t.ok(LevelUp.validate(opts, { hp: 'average', asi: { mode: 'plus1', abilities: ['str', 'cha'] } }).length === 0,
    '+1 to each of two abilities is legal');
  t.ok(LevelUp.validate(opts, { hp: 'average' }).length > 0,
    'skipping a required choice is rejected');

  const capped = freshPaladin(3);
  capped.base.abilities.str = 20;
  const cappedOpts = LevelUp.optionsFor(capped.base, capped.progression, { classId: 'paladin' });
  t.ok(LevelUp.validate(cappedOpts, { hp: 'average', asi: { mode: 'plus2', abilities: ['str'] } }).length > 0,
    'and no score may be pushed above 20');
}

t.section('auto-levelling makes sensible choices');
{
  const c = freshPaladin(3);
  const opts = LevelUp.optionsFor(c.base, c.progression, { classId: 'paladin' });
  const auto = LevelUp.autoChoose(c.base, c.progression, opts, { rng: new RNG('auto') });
  t.eq(auto.hp, 'average', 'it takes the average hit points by default \u2014 steadier');
  t.eq(auto.asi.mode, 'plus2', 'and puts the full +2 into one ability');
  t.eq(auto.asi.abilities[0], 'str', 'the class\u2019s primary ability');
  t.eq(LevelUp.validate(opts, auto).length, 0, 'and its choices always validate');
}

t.section('the full paladin progression matches the printed tables');
{
  const st = State.create({ seed: 'levels' });
  const c = freshPaladin(3);
  State.addActor(st, { id: 'p', name: 'Test Paladin', side: 'party', base: c.base, progression: c.progression, runtime: c.runtime });
  State.refreshAllDerived(st);
  const a = () => st.actors.p;

  t.eq(a().runtime.hpMax, 28, 'level 3 starts at 28 hit points');
  t.deep(a().derivedCache.spellcasting.slotsMax, { 1: 3 }, 'with 3 first-level slots');

  /* Printed Paladin table, levels 4-11. */
  const expected = {
    4: { prof: 2, slots: { 1: 3 } },
    5: { prof: 3, slots: { 1: 4, 2: 2 } },
    6: { prof: 3, slots: { 1: 4, 2: 2 } },
    7: { prof: 3, slots: { 1: 4, 2: 3 } },
    8: { prof: 3, slots: { 1: 4, 2: 3 } },
    9: { prof: 4, slots: { 1: 4, 2: 3, 3: 2 } },
    10: { prof: 4, slots: { 1: 4, 2: 3, 3: 2 } },
    11: { prof: 4, slots: { 1: 4, 2: 3, 3: 3 } },
  };
  const xpFor = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000];

  for (let lvl = 4; lvl <= 11; lvl++) {
    a().progression.xp = xpFor[lvl];
    const pending = LevelUp.pendingLevel(a().base, a().progression);
    t.ok(!!pending, 'level ' + lvl + ' becomes available at ' + xpFor[lvl] + ' xp');
    if (!pending) break;
    const opts = LevelUp.optionsFor(a().base, a().progression, { classId: 'paladin' });
    const auto = LevelUp.autoChoose(a().base, a().progression, opts, { rng: new RNG('l' + lvl) });
    const res = LevelUp.applyLevel(a().base, a().progression, opts, auto,
      { rng: new RNG('l' + lvl), actorId: 'p', actorName: 'Test Paladin' });
    t.eq(res.ok, true, 'level ' + lvl + ' applies cleanly');
    const batch = Events.makeBatch({ commandId: 'lvl' + lvl, actorId: 'p' });
    res.events.forEach(e => batch.events.push(e));
    batch.beats = res.beats;
    Events.commit(st, batch);

    const d = a().derivedCache;
    t.eq(LevelUp.totalLevel(a().progression), lvl, 'the character is level ' + lvl);
    t.eq(d.proficiencyBonus, expected[lvl].prof,
      'proficiency bonus at level ' + lvl + ' is +' + expected[lvl].prof);
    t.deep(d.spellcasting.slotsMax, expected[lvl].slots,
      'spell slots at level ' + lvl + ' match the printed table');
    t.eq(a().runtime.hp, a().runtime.hpMax,
      'gaining a level heals you by the hit points you gained');
  }

  t.eq(a().derivedCache.abilities.str, 20,
    'two ability improvements took Strength from 16 to 20');
  t.eq(a().base.classes[0].levels, 11,
    'and the class level advanced alongside the progression log');
}

t.section('levelling is undoable like any other turn');
{
  const st = State.create({ seed: 'undo-level' });
  const c = freshPaladin(3);
  State.addActor(st, { id: 'p', name: 'P', side: 'party', base: c.base, progression: c.progression, runtime: c.runtime });
  State.refreshAllDerived(st);
  const history = State.makeHistory();
  st.actors.p.progression.xp = 2700;

  const before = st.actors.p.runtime.hpMax;
  State.checkpoint(history, st, 'level');
  const opts = LevelUp.optionsFor(st.actors.p.base, st.actors.p.progression, { classId: 'paladin' });
  const auto = LevelUp.autoChoose(st.actors.p.base, st.actors.p.progression, opts, { rng: new RNG('u') });
  const res = LevelUp.applyLevel(st.actors.p.base, st.actors.p.progression, opts, auto,
    { rng: new RNG('u'), actorId: 'p' });
  const batch = Events.makeBatch({ commandId: 'lv', actorId: 'p' });
  res.events.forEach(e => batch.events.push(e));
  Events.commit(st, batch);
  t.ok(st.actors.p.runtime.hpMax > before, 'the level raised the maximum');

  State.undo(history, st);
  t.eq(st.actors.p.runtime.hpMax, before, 'and undo took it back');
  t.eq(LevelUp.totalLevel(st.actors.p.progression), 3, 'along with the level itself');
}

/* ----------------------------------------------------------- backstory ----- */
t.section('backstory');
t.ok(Chargen.BACKSTORY_SEEDS.length >= 8, 'there are seeds to draw from');
t.ok(Backstory.seed(new RNG('s')).length > 20, 'a seed is a usable line');

const sheetText = Backstory.describeSheet({
  name: 'Shen Cooper', raceId: 'human', classId: 'paladin', levels: 3,
  backgroundId: 'soldier', abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 16 },
  skills: ['athletics', 'persuasion'],
});
t.ok(/Shen Cooper/.test(sheetText), 'the sheet handed to the model names the character');
t.ok(/STR 16/.test(sheetText), 'and gives the actual scores');
t.ok(/among the best/.test(sheetText),
  'described in words the model can use, not just numbers');
t.ok(/HOW THEY FIGHT/.test(sheetText), 'and how the class plays');
t.ok(/90 to 140 words/.test(Backstory.SYSTEM), 'the brief sets a length');
t.ok(/one thing unresolved/.test(Backstory.SYSTEM),
  'and asks for a loose thread the DM can pull');
t.ok(/not yours to change/.test(Backstory.SYSTEM),
  'and forbids contradicting the sheet');

Backend.configure({ kind: 'offline' });
Backstory.generate({ name: 'Test', raceId: 'human', classId: 'fighter', abilities: { str: 15 } }, { rng: new RNG('b') })
  .then(res => {
    t.eq(res.source, 'seed', 'with no model, a seed is returned rather than an error');
    t.ok(res.text.length > 20, 'and it is still usable text');

    Backend.configure({
      kind: 'fixture',
      fixtures: { '*': 'You were the third son of a smith, and the least useful of them.' },
    });
    return Backstory.generate({ name: 'T', raceId: 'human', classId: 'fighter', abilities: { str: 15 } }, {});
  })
  .then(res => {
    t.eq(res.source, 'fixture', 'with a model, the model writes it');
    t.ok(/third son of a smith/.test(res.text), 'and the text comes through');

    Backend.configure({ kind: 'fixture', fixtures: { '*': 'As an AI language model I cannot write fiction.' } });
    return Backstory.generate({ name: 'T', raceId: 'human', classId: 'fighter', abilities: {} }, { rng: new RNG('c') });
  })
  .then(res => {
    t.eq(res.source, 'seed', 'a model that breaks character falls back to a seed');
    Backend.configure({ kind: 'offline' });
    runCasterTests();
    t.done();
  })
  .catch(e => { console.error(e); process.exit(1); });


/* ------------------------------------------------ casters can cast -- */
/**
 * Every generated wizard, cleric, bard, sorcerer, warlock and druid used to
 * arrive with a full complement of spell slots and an entirely empty spell
 * list — a character sheet with the magic left blank. These check that the
 * generator picks spells at all, and that what it picks is legal: on the
 * class's own list, of a level the character can actually cast, and not
 * repeated.
 */
function runCasterTests() {
  const SPELLS = require('../js/data/srd_spells.js').SPELLS;
  const CASTERS = ['wizard', 'cleric', 'bard', 'sorcerer', 'warlock', 'druid'];

  t.section('a generated caster knows spells, and legal ones');
  CASTERS.forEach(classId => {
    [3, 9].forEach(level => {
      const spec = Chargen.generate({ rng: new RNG('c-' + classId + level), fixed: { classId, levels: level } });
      const ch = Character.buildFromSpec(spec);
      const d = Character.derive(ch.base, ch.progression, ch.runtime, []);
      const sc = d.spellcasting || {};
      const known = sc.prepared || [];
      const cantrips = sc.cantripsKnown || [];

      let cap = Math.max(0, ...Object.keys(sc.slotsMax || {})
        .filter(k => sc.slotsMax[k] > 0).map(Number));
      /* A warlock's magic is pact slots, which live in their own field. */
      if (sc.pactSlots) cap = Math.max(cap, sc.pactSlots.level);

      const label = classId + ' ' + level;
      t.ok(known.length > 0, label + ' knows at least one spell', '(' + known.length + ')');
      t.eq(known.filter(id => SPELLS[id] && (SPELLS[id].classes || []).indexOf(classId) < 0).length, 0,
        label + ' knows nothing off its own class list');
      t.eq(known.filter(id => SPELLS[id] && SPELLS[id].level > cap).length, 0,
        label + ' knows nothing above spell level ' + cap + ', which is all it can cast');
      t.eq(known.filter((id, i) => known.indexOf(id) !== i).length, 0,
        label + ' knows no spell twice');
      t.eq(cantrips.filter(id => !SPELLS[id] || SPELLS[id].level !== 0).length, 0,
        label + '\u2019s cantrips are actually cantrips');
    });
  });

  t.section('half-casters get no spells at level 1');
  ['paladin', 'ranger'].forEach(classId => {
    const spec = Chargen.generate({ rng: new RNG('h-' + classId), fixed: { classId, levels: 1 } });
    t.eq((spec.spells || []).length, 0,
      'a level-1 ' + classId + ' is offered no spells, because it has none in 2014');
    const two = Chargen.generate({ rng: new RNG('h2-' + classId), fixed: { classId, levels: 2 } });
    t.ok((two.spells || []).length > 0, 'but a level-2 ' + classId + ' does');
  });

  t.section('level-up offers only spells that can be cast');
  {
    const spec = Chargen.generate({ rng: new RNG('lvl-bard'), fixed: { classId: 'bard', levels: 1 } });
    const ch = Character.buildFromSpec(spec);
    ch.progression.levelGranted = 2;
    const options = LevelUp.optionsFor(ch.base, ch.progression, {});
    const group = (options.groups || []).filter(g => g.id === 'spells')[0];
    t.ok(!!group, 'a bard reaching level 2 is asked to learn spells');
    if (group) {
      const levels = group.choices.map(c => SPELLS[c.id].level);
      t.eq(Math.max(...levels), 1, 'and is offered nothing above first level');
      t.eq(group.choices.filter(c => (SPELLS[c.id].classes || []).indexOf('bard') < 0).length, 0,
        'and nothing that is not a bard spell');

      const auto = LevelUp.autoChoose(ch.base, ch.progression, options, {});
      t.eq(LevelUp.validate(options, auto).length, 0, '"choose for me" produces a legal set');

      const dup = Object.assign({}, auto, { spells: new Array(group.count).fill(group.choices[0].id) });
      t.ok(LevelUp.validate(options, dup).length > 0, 'the same spell chosen twice is rejected');

      const bogus = Object.assign({}, auto, { spells: new Array(group.count).fill('not-a-real-spell') });
      t.ok(LevelUp.validate(options, bogus).length > 0, 'a spell that does not exist is rejected');
    }
  }
}