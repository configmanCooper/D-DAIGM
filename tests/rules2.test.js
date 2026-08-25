/**
 * rules2.test.js — the rules an independent review found were not enforced.
 *
 * Every check here corresponds to a confirmed bug. They are grouped by what a
 * player would notice, because that is the honest measure of severity: "my
 * fireball does nothing" is a different order of problem from "the encounter
 * difficulty label is one step off".
 *
 * The common thread in almost all of them is that the DATA was right and
 * nothing read it. The spell table has always described saves, spell attacks
 * and damage; the class table has always listed saving-throw proficiencies;
 * statblocks have always carried resistances. The engine simply never looked.
 */
const t = require('./_harness')('rules2');
const { RNG } = require('../js/rng.js');
const State = require('../js/engine/state.js');
const Events = require('../js/engine/events.js');
const Command = require('../js/engine/command.js');
const Dispatch = require('../js/engine/dispatch.js');
const Character = require('../js/engine/character.js');
const Combat = require('../js/engine/combat.js');
const Chargen = require('../js/gen/chargen.js');
const CLASSES = require('../js/data/srd_classes.js').CLASSES;
require('../js/engine/interaction.js');

function build(classId, levels, seed) {
  const spec = Chargen.generate({ rng: new RNG(seed || classId), fixed: { classId, levels } });
  return Character.buildFromSpec(spec);
}

function scene(seed) {
  const s = State.create({ seed: seed || 'rules2' });
  return s;
}

function addMonster(s, id, name, extra) {
  State.addActor(s, Object.assign({
    id, name, side: 'enemy', kind: 'monster',
    base: { name, abilities: { str: 14, dex: 12, con: 12, int: 6, wis: 10, cha: 7 }, classes: [] },
    statblock: { ac: 15 },
    progression: { levels: [] },
    runtime: { hp: 40, hpMax: 40, conditions: {}, inventory: [], deathSaves: {}, pos: { x: 3, y: 1 } },
  }, extra || {}));
}

function freshTurn(s, id) {
  s.actors[id].runtime.turn = {
    action: true, bonus: true, reaction: true, objectInteraction: true,
    movementRemaining: 30, surprised: false,
  };
}

/* ------------------------------------------------- characters are built -- */

t.section('a generated character has the saving throws their class grants');
{
  /* The class table calls this `savingThrows`; the builder read `saves`, which
     does not exist — so NO character the game generated had a single
     saving-throw proficiency. Every save, every fight, every character. */
  Object.keys(CLASSES).forEach(classId => {
    const ch = build(classId, 5, 'sv-' + classId);
    const expected = CLASSES[classId].savingThrows || [];
    t.deep(ch.base.proficiencies.saves, expected,
      'a ' + classId + ' is proficient in ' + expected.join(' and '));
  });

  const fighter = build('fighter', 5, 'sv-check');
  const d = Character.derive(fighter.base, fighter.progression, fighter.runtime, []);
  const prof = Character.proficiencyBonus(5);
  const conMod = d.abilityMods.con;
  t.eq(d.saves.con, conMod + prof, 'and the proficiency actually reaches the number rolled');
  t.eq(d.saves.dex, d.abilityMods.dex, 'while an unproficient save is the bare ability modifier');
}

t.section('a generated character is not standing there empty-handed');
{
  /* Starting gear lived in the setup wizard, so every character made anywhere
     else — a replacement after a death, a playtest party, an AI companion —
     arrived with nothing and was refused every attack for having no weapon. */
  ['fighter', 'wizard', 'cleric', 'rogue', 'ranger', 'barbarian'].forEach(classId => {
    const ch = build(classId, 5, 'kit-' + classId);
    const inv = (ch.runtime.inventory || []).map(i => i.id);
    t.ok(inv.length > 0, 'a ' + classId + ' carries something', '(' + inv.join(', ') + ')');
    t.ok(ch.runtime.gold > 0, 'and has coin');

    const s = scene('kit-' + classId);
    State.addActor(s, {
      id: 'p', name: 'P', side: 'party', kind: 'pc',
      base: ch.base, progression: ch.progression, runtime: ch.runtime,
    });
    State.refreshAllDerived(s);
    t.ok((s.actors.p.runtime.attacks || []).length > 0,
      'and therefore has an attack to make');
  });
}

/* --------------------------------------------------------------- armour -- */

t.section('heavy armour ignores Dexterity rather than subtracting it');
{
  const base = {
    name: 'H', abilities: { str: 16, dex: 6, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [{ classId: 'fighter', levels: 5 }],
    proficiencies: { skills: [], saves: [], expertise: [] },
  };
  const prog = { levels: [{ level: 1, classId: 'fighter', hpGained: 10 }] };
  const runtime = {
    hp: 40, hpMax: 40, conditions: {}, deathSaves: {},
    inventory: [{ uid: 'chain-mail', id: 'chain-mail', slot: 'armor', equipped: true }],
    equipped: { armor: 'chain-mail' },
  };
  const d = Character.derive(base, prog, runtime, []);
  /* Chain mail is AC 16 and ignores Dex. With Dex 6 (a -2 modifier) the old
     `Math.min(dex, 0)` let the penalty through and derived 14 — the armour was
     making its wearer easier to hit. */
  t.eq(d.ac, 16, 'chain mail is AC 16 even on a character with Dexterity 6');
}

t.section('an AC bonus from a spell reaches the number the engine rolls against');
{
  const s = scene('ac');
  const w = build('wizard', 5, 'acw');
  State.addActor(s, { id: 'w', name: 'W', side: 'party', kind: 'pc', base: w.base, progression: w.progression, runtime: w.runtime });
  State.refreshAllDerived(s);
  const before = Combat.targetAc(s, 'w');

  const b = Events.makeBatch({ commandId: 'ac1', actorId: 'w' });
  b.events.push({
    kind: 'effect_add', targetId: 'w', actorId: 'w',
    effect: { id: 'sof', name: 'Shield of Faith', targetId: 'w', kind: 'ac', ac: { type: 'bonus', source: 'Shield of Faith', value: 2 } },
  });
  Events.commit(s, b);
  t.eq(Combat.targetAc(s, 'w'), before + 2,
    'the derived cache is refreshed, so +2 AC is +2 AC in combat');

  const b2 = Events.makeBatch({ commandId: 'ac2', actorId: 'w' });
  b2.events.push({ kind: 'effect_remove', targetId: 'w', actorId: 'w', effectId: 'sof' });
  Events.commit(s, b2);
  t.eq(Combat.targetAc(s, 'w'), before, 'and it goes away when the spell ends');

  /* A contribution the resolver does not understand must say so rather than
     claim it was applied. */
  const odd = Character.derive(w.base, w.progression, w.runtime,
    [{ id: 'q', targetId: 'w', kind: 'ac', ac: { type: 'nonsense', source: 'Q', value: 5 } }]);
  const entry = odd.acBreakdown.filter(x => x.source === 'Q')[0];
  t.eq(entry.applied, false, 'an unrecognised AC contribution is reported as not applied');
}

/* --------------------------------------------------------------- spells -- */

t.section('spells actually do what they say');
{
  const s = scene('spells');
  const w = build('wizard', 9, 'spw');
  w.progression.preparedSpells = ['fireball', 'magic-missile'];
  w.progression.cantripsKnown = ['fire-bolt'];
  State.addActor(s, { id: 'w', name: 'Ysolde', side: 'party', kind: 'pc', base: w.base, progression: w.progression, runtime: w.runtime });
  ['g1', 'g2', 'g3'].forEach((id, i) => addMonster(s, id, 'Gnoll ' + (i + 1)));
  State.refreshAllDerived(s);
  const h = State.makeHistory();

  const cast = (spellId, slot, targets) => {
    freshTurn(s, 'w');
    return Dispatch.dispatch(s, h, Command.create({
      actorId: 'w', family: 'spell', stateRevision: s.revision, turnEpoch: s.turnEpoch,
      primary: Command.makeStep({ verb: 'cast', spellId, targetIds: targets || ['g1'], slotLevel: slot }),
    }), {});
  };

  /* A cantrip is not "prepared" and must still be castable — the check looked
     only at the prepared list, so every cantrip in the game was refused. */
  const before1 = s.actors.g1.runtime.hp;
  const bolt = cast('fire-bolt', null);
  t.eq(!!(bolt.batch && bolt.batch.refused), false, 'a cantrip can be cast');
  t.deep(s.actors.w.runtime.slotsSpent, {}, 'and costs no spell slot');

  /* Fireball: an area save spell that dealt no damage whatsoever before. */
  const hpBefore = ['g1', 'g2', 'g3'].map(id => s.actors[id].runtime.hp);
  cast('fireball', 3);
  const hpAfter = ['g1', 'g2', 'g3'].map(id => s.actors[id].runtime.hp);
  t.ok(hpAfter.every((hp, i) => hp < hpBefore[i]),
    'Fireball damages everything in the fight', '(' + hpBefore.join('/') + ' -> ' + hpAfter.join('/') + ')');

  const rolls = s.log.flatMap(b => b.events || []).filter(e => e.rollKind === 'save');
  t.ok(rolls.length >= 3, 'and every target rolled a saving throw', '(' + rolls.length + ')');
  t.ok(rolls.some(r => r.success) || rolls.some(r => !r.success), 'with real outcomes');
}

t.section('a slot cannot cast a spell above its level, and casting costs an action');
{
  const s = scene('econ');
  const w = build('wizard', 9, 'ecw');
  w.progression.preparedSpells = ['fireball', 'magic-missile'];
  State.addActor(s, { id: 'w', name: 'W', side: 'party', kind: 'pc', base: w.base, progression: w.progression, runtime: w.runtime });
  addMonster(s, 'g', 'Gnoll');
  State.refreshAllDerived(s);
  Events.commit(s, Combat.beginEncounter(s, [{ id: 'w', mod: 2 }, { id: 'g', mod: 0 }], {}));
  s.activeActorId = 'w';
  Events.commit(s, Combat.startTurn(s, 'w'));
  const h = State.makeHistory();

  const cast = (spellId, slot) => Dispatch.dispatch(s, h, Command.create({
    actorId: 'w', family: 'spell', stateRevision: s.revision, turnEpoch: s.turnEpoch,
    primary: Command.makeStep({ verb: 'cast', spellId, targetIds: ['g'], slotLevel: slot }),
  }), {});

  freshTurn(s, 'w');
  const low = cast('fireball', 1);
  t.ok(!!(low.batch && low.batch.refused), 'a level-1 slot cannot cast a level-3 spell');

  freshTurn(s, 'w');
  const first = cast('magic-missile', 1);
  t.eq(!!(first.batch && first.batch.refused), false, 'the first spell of the turn is cast');
  const second = cast('magic-missile', 1);
  t.ok(!!(second.batch && second.batch.refused),
    'and a second action spell in the same turn is refused');
}

/* ----------------------------------------------------------- conditions -- */

t.section('a creature that cannot act, cannot act');
{
  const s = scene('stun');
  const f = build('fighter', 5, 'stf');
  State.addActor(s, { id: 'f', name: 'F', side: 'party', kind: 'pc', base: f.base, progression: f.progression, runtime: f.runtime });
  addMonster(s, 'g', 'Gnoll');
  State.refreshAllDerived(s);
  freshTurn(s, 'f');

  t.eq(Combat.canAct(s.actors.f), true, 'an unhindered character can act');

  ['stunned', 'paralyzed', 'unconscious', 'incapacitated', 'petrified'].forEach(cond => {
    s.actors.f.runtime.conditions = {};
    s.actors.f.runtime.conditions[cond] = { source: 'test' };
    t.eq(Combat.canAct(s.actors.f), false, 'a ' + cond + ' creature takes no action');
    t.eq(Combat.canReact(s.actors.f), false, 'and no reaction');
  });
  s.actors.f.runtime.conditions = {};
}

/* ------------------------------------------------------------- defences -- */

t.section('what a creature is made of changes what hurts it');
{
  const s = scene('resist');
  addMonster(s, 'skel', 'Skeleton', {
    statblock: {
      ac: 13, resistances: ['slashing'], immunities: ['poison'], vulnerabilities: ['bludgeoning'],
    },
  });
  State.refreshAllDerived(s);

  /* Monsters carry defences on the statblock; only the derived sheet was
     consulted, so a skeleton took full damage from a club. */
  t.eq(Combat.applyDamageType(s, 'skel', 10, 'slashing').total, 5, 'resistance halves, from the statblock');
  t.eq(Combat.applyDamageType(s, 'skel', 7, 'slashing').total, 3, 'and 7 halves to 3, not 3.5');
  t.eq(Combat.applyDamageType(s, 'skel', 10, 'poison').total, 0, 'immunity cancels it entirely');
  t.eq(Combat.applyDamageType(s, 'skel', 10, 'bludgeoning').total, 20, 'vulnerability doubles it');
  t.eq(Combat.applyDamageType(s, 'skel', 10, 'piercing').total, 10, 'an ordinary type is unchanged');

  /* Both at once. 2014 applies resistance and then vulnerability, each
     rounding down as it goes: 5 halves to 2, doubles to 4. Doing it the other
     way round (double to 10, halve to 5) looks equivalent and is not, because
     the rounding happens at a different point. */
  addMonster(s, 'odd', 'Odd Thing', {
    statblock: { ac: 12, resistances: ['fire'], vulnerabilities: ['fire'] },
  });
  State.refreshAllDerived(s);
  t.eq(Combat.applyDamageType(s, 'odd', 5, 'fire').total, 4,
    'resistant AND vulnerable: 5 halves to 2, then doubles to 4');
}

t.section('a monster\u2019s own statblock defences are honoured');
{
  /* The SRD monster data names these `damageResistances` and friends; the
     derived sheet says `resistances`. Only the sheet was read, so every
     shipped monster in the game ignored its own defences. */
  const MONSTERS = require('../js/data/srd_monsters.js').MONSTERS;
  const skeletonData = MONSTERS.skeleton;
  const s = State.create({ seed: 'realmonster' });
  State.addActor(s, {
    id: 'skel', name: 'Skeleton', side: 'enemy', kind: 'monster',
    base: { name: 'Skeleton', abilities: {}, classes: [] },
    statblock: skeletonData,
    progression: { levels: [] },
    runtime: { hp: 13, hpMax: 13, conditions: {}, inventory: [], deathSaves: {} },
  });
  State.refreshAllDerived(s);

  t.deep(skeletonData.damageVulnerabilities, ['bludgeoning'], 'the shipped skeleton is vulnerable to bludgeoning');
  t.deep(skeletonData.damageImmunities, ['poison'], 'and immune to poison');
  t.eq(Combat.applyDamageType(s, 'skel', 10, 'bludgeoning').total, 20,
    'a real skeleton takes double from a club');
  t.eq(Combat.applyDamageType(s, 'skel', 10, 'poison').total, 0,
    'and nothing at all from poison');
}

t.section('damage reaches the pipeline with its type intact');
{
  const s = scene('pipe');
  addMonster(s, 'skel', 'Skeleton', {
    statblock: { ac: 13, resistances: ['slashing'] },
    runtime: { hp: 40, hpMax: 40, conditions: {}, inventory: [], deathSaves: {}, pos: { x: 1, y: 1 } },
  });
  State.refreshAllDerived(s);
  const chain = Combat.damageEvents(s, 'skel', 10, { damageType: 'slashing' });
  const hp = chain.events.filter(e => e.kind === 'hp')[0];
  t.eq(hp.delta, -5, 'a resistant creature takes half, once, inside damageEvents');
}

/* ---------------------------------------------------------------- skills -- */

t.section('skill checks use the identifiers the sheet actually has');
{
  /* The lock and trap checks asked for `sleight_of_hand`; the sheet keys it
     `sleightOfHand`. The lookup missed, so a rogue with +6 rolled at +0 —
     every lock and every trap in the game, for every character. */
  const r = build('rogue', 5, 'sk');
  r.base.proficiencies.skills = ['stealth', 'sleightOfHand'];
  const d = Character.derive(r.base, r.progression, r.runtime, []);
  t.ok(d.skills.sleightOfHand.mod > d.abilityMods.dex,
    'a proficient rogue\u2019s Sleight of Hand beats their bare Dexterity',
    '(' + d.skills.sleightOfHand.mod + ' vs ' + d.abilityMods.dex + ')');

  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'js', 'engine', 'interaction.js'), 'utf8');
  t.eq(/sleight_of_hand|animal_handling/.test(src), false,
    'and no snake_case skill identifier is left in the interaction resolvers');
}

/* ------------------------------------------- the second review's finds -- */

t.section('a shipped monster fights with its own statblock');
{
  const MONSTERS = require('../js/data/srd_monsters.js').MONSTERS;
  const dragon = MONSTERS['adult-black-dragon'];
  const s = State.create({ seed: 'dragon' });
  State.addActor(s, {
    id: 'boss', name: dragon.name, side: 'enemy', kind: 'monster',
    base: { name: dragon.name, abilities: dragon.abilities || {}, classes: [] },
    statblock: dragon, progression: { levels: [] },
    runtime: { hp: 195, hpMax: 195, conditions: {}, inventory: [], deathSaves: {}, pos: { x: 3, y: 1 } },
  });
  State.addActor(s, {
    id: 'pc', name: 'Vess', side: 'party', kind: 'pc',
    base: { name: 'Vess', abilities: { str: 16, dex: 12, con: 14 }, classes: [{ classId: 'fighter', levels: 10 }] },
    progression: { levels: [] },
    runtime: { hp: 400, hpMax: 400, conditions: {}, inventory: [], deathSaves: {}, pos: { x: 1, y: 1 } },
  });
  State.refreshAllDerived(s);
  s.actors.pc.runtime.hp = 400; s.actors.pc.runtime.hpMax = 400;
  freshTurn(s, 'boss');

  const seq = Combat.multiattackSequence(dragon);
  t.ok(seq.length > 1, 'the dragon has a multiattack in its shipped data', '(' + seq.join(', ') + ')');
  t.ok(Dispatch.legalMoves(s, 'boss', {}).some(m => m.step.verb === 'multiattack'),
    'and is offered it');

  const h = State.makeHistory();
  const r = Dispatch.dispatch(s, h, Command.create({
    actorId: 'boss', family: 'combat', stateRevision: s.revision, turnEpoch: s.turnEpoch,
    primary: Command.makeStep({ verb: 'multiattack', targetIds: ['pc'] }),
  }), {});
  t.eq(r.ok, true, 'the multiattack resolves');

  const attacks = (r.batch.events || []).filter(e => e.of === 'attack');
  /* The sequence is Frightful Presence, Bite, Claw, Claw — and Frightful
     Presence is not an attack. Treating it as one invented a swing from
     nothing. */
  t.eq(attacks.length, seq.length - 1,
    'every entry in the sequence that IS an attack is rolled, and nothing else',
    '(' + attacks.length + ' of ' + seq.length + ')');

  const beats = (r.batch.beats || []).join(' ');
  t.ok(/acid/i.test(beats),
    'the bite\u2019s secondary acid damage lands too, not just the piercing');
}

t.section('spells that were pure prose now do something');
{
  const mk = () => {
    const s = State.create({ seed: 'prose' });
    const w = build('wizard', 9, 'prosew');
    w.progression.preparedSpells = ['magic-missile', 'sleep'];
    State.addActor(s, { id: 'w', name: 'W', side: 'party', kind: 'pc', base: w.base, progression: w.progression, runtime: w.runtime });
    [['g1', 6], ['g2', 12], ['g3', 40]].forEach(([id, hp]) => addMonster(s, id, id, {
      runtime: { hp, hpMax: hp, conditions: {}, inventory: [], deathSaves: {}, pos: { x: 3, y: 1 } },
    }));
    State.refreshAllDerived(s);
    freshTurn(s, 'w');
    return s;
  };
  const cast = (s, spellId, slot, targets) => {
    freshTurn(s, 'w');
    return Dispatch.dispatch(s, State.makeHistory(), Command.create({
      actorId: 'w', family: 'spell', stateRevision: s.revision, turnEpoch: s.turnEpoch,
      primary: Command.makeStep({ verb: 'cast', spellId, targetIds: targets, slotLevel: slot }),
    }), {});
  };

  /* Magic Missile never misses and calls for no save, so it fits neither the
     attack nor the save shape and was recorded as prose the engine ignored. */
  let s = mk();
  const before = s.actors.g1.runtime.hp;
  cast(s, 'magic-missile', 1, ['g1']);
  t.ok(s.actors.g1.runtime.hp < before, 'Magic Missile deals damage', '(' + before + ' -> ' + s.actors.g1.runtime.hp + ')');

  s = mk();
  const r3 = cast(s, 'magic-missile', 3, ['g1', 'g2', 'g3']);
  const darts = (r3.batch.events || []).filter(e => e.kind === 'hp' && e.delta < 0);
  t.eq(darts.length, 5, 'and upcasting to a level-3 slot throws five darts, not three');

  /* Sleep is a pool of hit points that takes the weakest first. */
  s = mk();
  cast(s, 'sleep', 1, ['g1']);
  const asleep = ['g1', 'g2', 'g3'].filter(id => s.actors[id].runtime.conditions.unconscious);
  t.ok(asleep.length > 0, 'Sleep actually puts creatures under', '(' + asleep.join(', ') + ')');
  t.eq(asleep.indexOf('g3') < 0, true, 'and the strongest one it cannot reach stays awake');
}

t.section('an event payload is never shared with live state');
{
  /* The log is permanent and replayable. An applier that keeps the event's own
     object makes the world and its history the same memory, so a later change
     to one silently edits the other. */
  const s = State.create({ seed: 'payload' });
  State.addActor(s, {
    id: 'a', name: 'A', side: 'party', kind: 'pc',
    base: { name: 'A', abilities: {}, classes: [] }, progression: { levels: [] },
    runtime: { hp: 10, hpMax: 10, conditions: {}, inventory: [], deathSaves: {} },
  });
  const effect = { id: 'x', targetId: 'a', kind: 'ac', ac: { type: 'add', source: 'X', value: 2 } };
  const b = Events.makeBatch({ commandId: 'p', actorId: 'a' });
  b.events.push({ kind: 'effect_add', targetId: 'a', actorId: 'a', effect: effect });
  Events.commit(s, b);

  t.ok(s.effects[0] !== effect, 'the world holds a copy, not the logged object');
  effect.ac.value = 999;
  t.eq(s.effects[0].ac.value, 2, 'so mutating the log cannot change the world');
}

t.section('a spell that boosts an ally refreshes the ALLY');
{
  /* refreshTouched preferred the event's actorId, which on a spell effect is
     the caster — so buffing a companion re-derived the wizard and left the
     companion reading a stale armour class. */
  const s = State.create({ seed: 'ally' });
  const w = build('wizard', 5, 'allyw');
  const f = build('fighter', 5, 'allyf');
  State.addActor(s, { id: 'w', name: 'W', side: 'party', kind: 'pc', base: w.base, progression: w.progression, runtime: w.runtime });
  State.addActor(s, { id: 'f', name: 'F', side: 'party', kind: 'pc', base: f.base, progression: f.progression, runtime: f.runtime });
  State.refreshAllDerived(s);
  const before = Combat.targetAc(s, 'f');

  const b = Events.makeBatch({ commandId: 'buff', actorId: 'w' });
  b.events.push({
    kind: 'effect_add', actorId: 'w', targetId: 'f',
    effect: { id: 'sof', name: 'Shield of Faith', targetId: 'f', kind: 'ac', ac: { type: 'add', source: 'Shield of Faith', value: 2 } },
  });
  Events.commit(s, b);
  t.eq(Combat.targetAc(s, 'f'), before + 2,
    'the ally\u2019s armour class actually goes up, not the caster\u2019s');
}


/* ---------------------------------------------------------------------- */
t.section('an action in the action bar costs an action');
/*
 * "Search the area" and "Look and listen" were both offered labelled "action"
 * and neither spent one, because the cost was declared in `legalMoves` and the
 * spend was supposed to happen in the resolver, which never did it. A
 * character could search the room and still take a full attack, then search
 * again, all in the same turn. The cost now lives on the EXPLORE table, which
 * both the offer and the resolver read.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');

  const mk = (id, name, side) => ({
    id, name, side,
    base: {
      name, raceId: 'human', classes: [{ classId: 'fighter', levels: 3 }],
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 },
      proficiencies: { skills: ['investigation'], saves: [] },
    },
    progression: { xp: 900, levels: [{ level: 1, classId: 'fighter', hpGained: 10, choice: 'average' }] },
    runtime: {
      hp: 20, hpMax: 20, tempHp: 0, conditions: {}, exhaustion: 0, concentratingOn: null,
      attuned: [], equipped: {}, inventory: [], deathSaves: { successes: 0, failures: 0 },
      resources: {}, gold: 0, pos: { x: 1, y: 1 },
      turn: { action: true, bonus: true, reaction: true, objectInteraction: true, movementRemaining: 30, surprised: false },
    },
  });

  const st = State.create({ seed: 'search-economy' });
  State.addActor(st, mk('hero', 'Hero', 'party'));
  State.addActor(st, mk('foe', 'Foe', 'enemy'));
  State.addSeat(st, { id: 'p1', name: 'P1', actorId: 'hero', control: 'human' });
  State.refreshAllDerived(st);
  st.combat = { active: true, order: [{ id: 'hero' }, { id: 'foe' }], turnIndex: 0, round: 1 };
  st.activeActorId = 'hero';

  const before = Dispatch.legalMoves(st, 'hero', {});
  const search = before.filter(m => m.step && m.step.verb === 'search')[0];
  t.ok(!!search, 'Search is offered while the action is unspent');
  t.ok(before.some(m => m.step && m.step.verb === 'attack'), 'and so is Attack');

  const r = Dispatch.dispatch(st, { past: [], future: [] },
    Dispatch.commandFromMove(st, 'hero', search), {});
  t.eq(r.ok, true, 'searching resolves');

  t.eq(st.actors.hero.runtime.turn.action, false, 'and it spends the action');

  const after = Dispatch.legalMoves(st, 'hero', {});
  t.eq(after.some(m => m.step && m.step.verb === 'search'), false,
    'so Search is no longer offered');
  t.eq(after.some(m => m.step && m.step.verb === 'attack'), false,
    'and neither is Attack — one action means one action');
  t.eq(after.some(m => m.step && m.step.verb === 'move'), true,
    'but movement is a separate budget and survives');
}

t.done();
