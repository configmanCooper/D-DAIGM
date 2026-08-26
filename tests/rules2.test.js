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
    /* Adjacent to the dragon. Weapon reach is enforced now, and the dragon's
       claws reach only five feet — from two squares away it could bite and
       lash with its tail and not claw, which is correct, and not what this
       test is about. */
    runtime: { hp: 400, hpMax: 400, conditions: {}, inventory: [], deathSaves: {}, pos: { x: 2, y: 1 } },
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


/* ---------------------------------------------------------------------- */
t.section('a ritual costs no spell slot');
/*
 * The whole point of the ritual tag in the 2014 rules: ten extra minutes buys
 * the casting for free, so a cleric can Detect Magic all afternoon without
 * touching their slots. Ritual casting went through the ordinary spend path,
 * so it cost a slot AND was refused outright once the slots ran out — which is
 * precisely the situation the rule exists to cover.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');
  const Character = require('../js/engine/character.js');

  const st = State.create({ seed: 'ritual' });
  const c = Character.buildFromSpec({
    name: 'Sister Aud', raceId: 'human', classId: 'cleric', levels: 5,
    backgroundId: 'acolyte',
    abilities: { str: 10, dex: 12, con: 14, int: 12, wis: 17, cha: 12 },
    proficiencies: { skills: ['religion'] },
  });
  c.runtime.pos = { x: 2, y: 2 };
  /* Named explicitly rather than left to the generator: this test is about
     what a ritual COSTS, and it should not also depend on which spells a
     particular cleric happened to prepare. */
  c.progression.preparedSpells = ['detect-magic', 'cure-wounds'];
  State.addActor(st, {
    id: 'pc1', name: 'Sister Aud', side: 'party', kind: 'pc',
    base: c.base, progression: c.progression, runtime: c.runtime,
  });
  State.addSeat(st, { id: 'p1', name: 'P1', actorId: 'pc1', control: 'human' });
  State.refreshAllDerived(st);
  st.combat = { active: false, round: 0, order: [], turnIndex: 0 };

  const moves = Dispatch.legalMoves(st, 'pc1', {}) || [];
  const rituals = moves.filter(m => m.step && m.step.verb === 'ritual_cast');
  t.ok(rituals.length > 0, 'a prepared caster is offered their rituals',
    '(' + rituals.slice(0, 2).map(m => m.what).join(' / ') + ')');

  if (rituals.length) {
    /* Burn every slot the character has. */
    const sc = st.actors.pc1.derivedCache && st.actors.pc1.derivedCache.spellcasting;
    const maxes = (sc && sc.slotsMax) || {};
    st.actors.pc1.runtime.slotsSpent = {};
    Object.keys(maxes).forEach(L => { st.actors.pc1.runtime.slotsSpent[L] = maxes[L]; });
    const burned = JSON.stringify(st.actors.pc1.runtime.slotsSpent);
    t.ok(Object.keys(maxes).length > 0, 'the cleric has slots to burn', burned);

    const cmd = Dispatch.commandFromMove(st, 'pc1', rituals[0]);
    const r = Dispatch.dispatch(st, { past: [], future: [] }, cmd, {});
    t.eq(r.ok, true, 'the ritual still casts with every slot spent',
      r.ok ? '' : JSON.stringify(r.errors || r.detail));
    t.eq(JSON.stringify(st.actors.pc1.runtime.slotsSpent), burned,
      'and it spends no slot of its own');
    t.ok(st.clock >= 10, 'but it does cost the ten extra minutes',
      '(' + st.clock + ' min)');
  }

  /* And a spell without the ritual tag cannot be cast as one. A refusal is
     COMMITTED rather than thrown away — it is part of the record, and replays
     — so the refusal lives on the batch, not on `ok`. */
  const notRitual = Dispatch.dispatch(st, { past: [], future: [] }, {
    v: 1, family: 'spell', commandId: 'nr', actorId: 'pc1',
    stateRevision: st.revision, turnEpoch: st.turnEpoch,
    primary: { verb: 'ritual_cast', spellId: 'cure-wounds', targetIds: ['pc1'] },
  }, {});
  t.ok(notRitual.batch && notRitual.batch.refused,
    'a spell with no ritual tag cannot be cast as a ritual',
    notRitual.batch && notRitual.batch.refused
      ? '(' + notRitual.batch.refused.detail + ')' : '(it was allowed)');
}


/* ---------------------------------------------------------------------- */
t.section('movement costs what the 2014 rules say it costs');
/*
 * Every one of these was found by an independent reviewer running the engine
 * rather than reading it, and every one of them made a character faster or
 * freer than the rules allow.
 */
{
  const Combat = require('../js/engine/combat.js');
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  const Character = require('../js/engine/character.js');

  const scene = (opts) => {
    opts = opts || {};
    const st = State.create({ seed: opts.seed || 'move' });
    const c = Character.buildFromSpec({
      name: 'Walker', raceId: 'human', classId: 'fighter', levels: 3,
      backgroundId: 'soldier',
      abilities: { str: opts.str || 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
      proficiencies: { skills: ['athletics'] },
    });
    c.runtime.pos = { x: 2, y: 2 };
    State.addActor(st, {
      id: 'pc1', name: 'Walker', side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime,
    });
    State.addActor(st, {
      id: 'foe1', name: 'Foe', side: 'enemy', kind: 'monster',
      base: c.base, progression: c.progression,
      runtime: Object.assign({}, c.runtime, { pos: { x: 9, y: 9 } }),
    });
    State.addSeat(st, { id: 'p1', name: 'P1', actorId: 'pc1', control: 'human' });
    State.refreshAllDerived(st);
    st.combat = { active: true, round: 1, turnIndex: 0, order: [{ id: 'pc1' }, { id: 'foe1' }] };
    st.actors.pc1.runtime.turn = {
      action: true, bonus: true, reaction: true, objectInteraction: true,
      movementRemaining: opts.speed || 30, surprised: false, mountedThisMove: false,
    };
    return st;
  };

  const run = (st, primary, ctx) => Dispatch.dispatch(st, { past: [], future: [] }, {
    v: 1, family: primary.family || 'movement', commandId: 'm' + Math.random(),
    actorId: 'pc1', stateRevision: st.revision, turnEpoch: st.turnEpoch,
    primary: primary.step,
  }, ctx || {});

  /* --- climbing through difficult terrain is THREE feet per foot, not four */
  {
    const st = scene({ seed: 'climb-difficult', speed: 30 });
    const ctx = { difficult: () => true };
    run(st, { step: { verb: 'climb', path: [{ x: 2, y: 2 }, { x: 3, y: 2 }] } }, ctx);
    const left = st.actors.pc1.runtime.turn.movementRemaining;
    t.eq(30 - left, 15,
      'one square of climbing through difficult terrain costs 15 ft, not 20',
      '(spent ' + (30 - left) + ')');
  }

  /* --- ordinary climbing is still two feet per foot */
  {
    const st = scene({ seed: 'climb-plain', speed: 30 });
    run(st, { step: { verb: 'climb', path: [{ x: 2, y: 2 }, { x: 3, y: 2 }] } }, {});
    const left = st.actors.pc1.runtime.turn.movementRemaining;
    t.eq(30 - left, 10, 'and one square of ordinary climbing costs 10 ft');
  }

  /* --- a long jump needs a ten-foot run-up */
  {
    const st = scene({ seed: 'jump-standing', str: 16, speed: 30 });
    const r = run(st, { step: { verb: 'jump' } }, {});
    const beat = ((r.batch || {}).beats || []).join(' ');
    t.ok(/8 ft/.test(beat) && /from standing/.test(beat),
      'a jump with no run-up covers half your Strength score',
      '(' + beat.trim() + ')');
  }
  {
    const st = scene({ seed: 'jump-running', str: 16, speed: 30 });
    /* Spend ten feet first, which is what a running start IS. */
    st.actors.pc1.runtime.turn.movementRemaining = 20;
    const r = run(st, { step: { verb: 'jump' } }, {});
    const beat = ((r.batch || {}).beats || []).join(' ');
    t.ok(/16 ft/.test(beat), 'and a full Strength score with one',
      '(' + beat.trim() + ')');
  }

  /* --- mounting is once per move */
  {
    const st = scene({ seed: 'mount', speed: 60 });
    const ctx = { mounts: [{ id: 'horse1', name: 'a horse' }] };
    const first = run(st, { step: { verb: 'mount', targetIds: ['horse1'] } }, ctx);
    t.ok(!(first.batch && first.batch.refused), 'you can get on a horse');
    t.eq(st.actors.pc1.runtime.mountedOn, 'horse1', 'and you are on it');

    const second = run(st, { step: { verb: 'dismount' } }, ctx);
    t.ok(second.batch && second.batch.refused,
      'but not get straight back off in the same move',
      second.batch && second.batch.refused
        ? '(' + second.batch.refused.detail + ')' : '(it was allowed)');
  }

  /* --- standing up costs half your speed */
  {
    const st = scene({ seed: 'stand', speed: 30 });
    st.actors.pc1.runtime.conditions.prone = { rounds: null };
    run(st, { step: { verb: 'stand_up' } }, {});
    t.eq(st.actors.pc1.runtime.turn.movementRemaining, 15,
      'standing up costs half your speed');
    t.eq(!!st.actors.pc1.runtime.conditions.prone, false, 'and you are on your feet');
  }
}

t.section('only a class with Ritual Casting gets rituals');
/*
 * The class table has always carried the ritual flag and nothing read it: the
 * move list tested `sc.ritualCasting`, a field that does not exist, so the
 * check was vacuously true and a PALADIN — who has no ritual casting at all in
 * 2014 — was offered rituals. A wizard, meanwhile, rituals from the SPELLBOOK
 * and needs nothing prepared, and could not.
 */
{
  const Character = require('../js/engine/character.js');
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');

  const ritualsFor = (classId) => {
    const st = State.create({ seed: 'rit-' + classId });
    const c = Character.buildFromSpec({
      name: 'T', raceId: 'human', classId, levels: 5, backgroundId: 'sage',
      abilities: { str: 12, dex: 14, con: 13, int: 16, wis: 16, cha: 16 },
      proficiencies: { skills: [] },
    });
    c.runtime.pos = { x: 2, y: 2 };
    State.addActor(st, {
      id: 'pc1', name: 'T', side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime,
    });
    State.addSeat(st, { id: 'p1', name: 'P', actorId: 'pc1', control: 'human' });
    State.refreshAllDerived(st);
    st.combat = { active: false, round: 0, order: [], turnIndex: 0 };
    return {
      st,
      moves: (Dispatch.legalMoves(st, 'pc1', {}) || [])
        .filter(m => m.step && m.step.verb === 'ritual_cast'),
    };
  };

  t.eq(ritualsFor('paladin').moves.length, 0,
    'a paladin is offered no rituals, having no Ritual Casting');
  t.eq(ritualsFor('sorcerer').moves.length, 0, 'and neither is a sorcerer');
  t.ok(ritualsFor('cleric').moves.length > 0, 'a cleric is');
  const wiz = ritualsFor('wizard');
  t.ok(wiz.moves.length > 0, 'and so is a wizard',
    '(' + wiz.moves.length + ')');

  /* A wizard's rituals come from the BOOK, not the prepared list. */
  const sc = wiz.st.actors.pc1.derivedCache.spellcasting;
  t.ok((sc.ritualFrom || []).length >= (sc.spellbook || []).length,
    'a wizard may ritual anything in the spellbook, prepared or not',
    '(' + (sc.ritualFrom || []).length + ' from a book of ' + (sc.spellbook || []).length + ')');
}


/* ---------------------------------------------------------------------- */
t.section('the Attack action is not the same thing as one attack');
/*
 * Extra Attack: two swings at fifth level, three at eleventh and four at
 * twentieth for a fighter, and two at fifth for a barbarian, paladin, ranger
 * or monk. The class table has carried `mech.type === "extra_attack"` from the
 * beginning and nothing ever read it, so a level-twenty fighter attacked once
 * — a quarter of the character, quietly missing, in the single most-used
 * action in the game.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');
  const Character = require('../js/engine/character.js');
  const MONSTERS = require('../js/data/srd_monsters.js').MONSTERS;

  const swingsFor = (classId, levels) => {
    const st = State.create({ seed: 'ea-' + classId + levels });
    const c = Character.buildFromSpec({
      name: 'Swinger', raceId: 'human', classId, levels, backgroundId: 'soldier',
      abilities: { str: 17, dex: 14, con: 15, int: 10, wis: 12, cha: 10 },
      proficiencies: { skills: [] },
    });
    c.runtime.pos = { x: 2, y: 2 };
    State.addActor(st, {
      id: 'pc1', name: 'Swinger', side: 'party', kind: 'pc', role: classId,
      base: c.base, progression: c.progression, runtime: c.runtime,
    });
    /* Something big enough that it will not die mid-flurry and cut the count
       short — a dead target is not a missing swing. */
    const sb = MONSTERS['adult-red-dragon'] || MONSTERS['adult-black-dragon'];
    State.addActor(st, {
      id: 'foe1', name: 'Dragon', side: 'enemy', kind: 'monster', statblock: sb,
      base: { name: 'Dragon', abilities: sb.abilities || {}, proficiencies: { skills: [], saves: [] }, classes: [] },
      progression: { xp: 0, levels: [] },
      runtime: {
        hp: 500, hpMax: 500, tempHp: 0, conditions: {}, exhaustion: 0,
        concentratingOn: null, attuned: [], equipped: {}, inventory: [],
        deathSaves: { successes: 0, failures: 0 }, resources: {}, gold: 0,
        pos: { x: 3, y: 2 },
      },
    });
    State.addSeat(st, { id: 'p1', name: 'P', actorId: 'pc1', control: 'human' });
    State.refreshAllDerived(st);
    st.combat = { active: true, round: 1, turnIndex: 0, order: [{ id: 'pc1' }, { id: 'foe1' }] };
    st.activeActorId = 'pc1';
    st.actors.pc1.runtime.turn = {
      action: true, bonus: true, reaction: true, objectInteraction: true,
      movementRemaining: 30, surprised: false, mountedThisMove: false,
    };
    const attack = (Dispatch.legalMoves(st, 'pc1', {}) || [])
      .filter(m => m.step && m.step.verb === 'attack')[0];
    if (!attack) return { rolls: 0, derived: st.actors.pc1.derivedCache.attacksPerAction };
    const r = Dispatch.dispatch(st, { past: [], future: [] },
      Dispatch.commandFromMove(st, 'pc1', attack), {});
    return {
      rolls: ((r.batch || {}).events || [])
        .filter(e => e.kind === 'roll' && e.of === 'attack').length,
      derived: st.actors.pc1.derivedCache.attacksPerAction,
      actionLeft: st.actors.pc1.runtime.turn.action,
    };
  };

  const f1 = swingsFor('fighter', 1);
  t.eq(f1.derived, 1, 'a first-level fighter has one attack');
  t.eq(f1.rolls, 1, 'and makes one attack roll');

  const f5 = swingsFor('fighter', 5);
  t.eq(f5.derived, 2, 'a fifth-level fighter has two');
  t.eq(f5.rolls, 2, 'and makes two attack rolls for one action');
  t.eq(f5.actionLeft, false, 'which costs a single action, not two');

  t.eq(swingsFor('fighter', 11).rolls, 3, 'an eleventh-level fighter makes three');
  t.eq(swingsFor('fighter', 20).rolls, 4, 'and a twentieth-level fighter four');

  t.eq(swingsFor('paladin', 5).rolls, 2, 'a fifth-level paladin gets Extra Attack too');
  t.eq(swingsFor('barbarian', 5).rolls, 2, 'and a barbarian');
  t.eq(swingsFor('rogue', 20).rolls, 1, 'a rogue never does, at any level');
  t.eq(swingsFor('wizard', 20).rolls, 1, 'and neither does a wizard');
}

t.section('a weapon only reaches as far as it reaches');
/*
 * Nothing checked distance at all, so a longsword hit a target sixty feet away
 * and a melee fight could be conducted from opposite corners of the room. The
 * whole point of closing to melee is that you have to close.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');
  const Character = require('../js/engine/character.js');

  const swingAt = (squares, weaponId) => {
    const st = State.create({ seed: 'reach-' + squares + weaponId });
    const c = Character.buildFromSpec({
      name: 'Reacher', raceId: 'human', classId: 'fighter', levels: 3,
      backgroundId: 'soldier',
      abilities: { str: 17, dex: 16, con: 15, int: 10, wis: 12, cha: 10 },
      proficiencies: { skills: [] },
    });
    c.runtime.pos = { x: 2, y: 2 };
    c.runtime.inventory = [{ uid: 'w1', id: weaponId, name: weaponId }];
    c.runtime.equipped = { mainHand: 'w1' };
    State.addActor(st, {
      id: 'pc1', name: 'Reacher', side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime,
    });
    const f = Character.buildFromSpec({
      name: 'Target', raceId: 'human', classId: 'fighter', levels: 1,
      backgroundId: 'soldier',
      abilities: { str: 12, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
      proficiencies: { skills: [] },
    });
    f.runtime.pos = { x: 2 + squares, y: 2 };
    State.addActor(st, {
      id: 'foe1', name: 'Target', side: 'enemy', kind: 'monster',
      base: f.base, progression: f.progression, runtime: f.runtime,
    });
    State.addSeat(st, { id: 'p1', name: 'P', actorId: 'pc1', control: 'human' });
    State.refreshAllDerived(st);
    st.combat = { active: true, round: 1, turnIndex: 0, order: [{ id: 'pc1' }, { id: 'foe1' }] };
    st.activeActorId = 'pc1';
    st.actors.pc1.runtime.turn = {
      action: true, bonus: true, reaction: true, objectInteraction: true,
      movementRemaining: 30, surprised: false, mountedThisMove: false,
    };
    const r = Dispatch.dispatch(st, { past: [], future: [] }, {
      v: 1, family: 'combat', commandId: 'r' + Math.random(), actorId: 'pc1',
      stateRevision: st.revision, turnEpoch: st.turnEpoch,
      primary: { verb: 'attack', targetIds: ['foe1'] },
    }, {});
    return !(r.batch && r.batch.refused);
  };

  t.eq(swingAt(1, 'longsword'), true, 'a longsword reaches five feet');
  t.eq(swingAt(2, 'longsword'), false, 'and not ten');
  t.eq(swingAt(12, 'longsword'), false, 'and certainly not sixty');

  t.eq(swingAt(1, 'glaive'), true, 'a glaive reaches five feet');
  t.eq(swingAt(2, 'glaive'), true, 'and ten, having the reach property');
  t.eq(swingAt(3, 'glaive'), false, 'but not fifteen');

  t.eq(swingAt(12, 'longbow'), true, 'a longbow reaches sixty feet easily');
  t.eq(swingAt(100, 'longbow'), true, 'and five hundred');
  t.eq(swingAt(130, 'longbow'), false, 'but not past its long range of six hundred');

  /* And the bar must not offer a swing that cannot land: a button that always
     refuses teaches a player that the verb is broken. */
  const st = State.create({ seed: 'reach-offer' });
  const c = Character.buildFromSpec({
    name: 'Reacher', raceId: 'human', classId: 'fighter', levels: 3,
    backgroundId: 'soldier',
    abilities: { str: 17, dex: 16, con: 15, int: 10, wis: 12, cha: 10 },
    proficiencies: { skills: [] },
  });
  c.runtime.pos = { x: 2, y: 2 };
  c.runtime.inventory = [{ uid: 'w1', id: 'longsword', name: 'longsword' }];
  c.runtime.equipped = { mainHand: 'w1' };
  State.addActor(st, {
    id: 'pc1', name: 'Reacher', side: 'party', kind: 'pc',
    base: c.base, progression: c.progression, runtime: c.runtime,
  });
  const far = Character.buildFromSpec({
    name: 'Far', raceId: 'human', classId: 'fighter', levels: 1, backgroundId: 'soldier',
    abilities: { str: 12, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    proficiencies: { skills: [] },
  });
  far.runtime.pos = { x: 6, y: 2 };
  State.addActor(st, {
    id: 'far1', name: 'Far', side: 'enemy', kind: 'monster',
    base: far.base, progression: far.progression, runtime: far.runtime,
  });
  State.addSeat(st, { id: 'p1', name: 'P', actorId: 'pc1', control: 'human' });
  State.refreshAllDerived(st);
  st.combat = { active: true, round: 1, turnIndex: 0, order: [{ id: 'pc1' }, { id: 'far1' }] };
  st.activeActorId = 'pc1';
  st.actors.pc1.runtime.turn = {
    action: true, bonus: true, reaction: true, objectInteraction: true,
    movementRemaining: 30, surprised: false, mountedThisMove: false,
  };
  const moves = Dispatch.legalMoves(st, 'pc1', {}) || [];
  t.eq(moves.some(m => m.step && m.step.verb === 'attack'), false,
    'no swing is offered at something twenty feet away');

  /* But a way to CLOSE is — otherwise a fight where the sides start apart
     could never begin, which is exactly what happened: a boss fight ran to the
     step limit with both lines standing still. */
  const closing = moves.filter(m => m.step && m.step.verb === 'move' && (m.step.path || []).length > 1);
  t.ok(closing.length > 0, 'but a way to close the distance is',
    '(' + closing.map(m => m.what).join(', ') + ')');
  t.ok(/close on/i.test(closing[0].what), 'and it says so plainly',
    '(' + closing[0].what + ')');
}

t.section('using an item costs what using an item costs');
/*
 * `resolveItem` committed its events and never looked at the turn record, so
 * the action economy simply did not apply to items. Probed before writing this:
 * a character on 5 hit points drank three healing potions in one turn and came
 * out on 23 with their action still untouched.
 *
 * 2014, "Other Activity on Your Turn" and "Use an Object": one free object
 * interaction a turn, anything past that costs the Use an Object action, and an
 * item whose activation is an action costs the action outright.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');

  const potion = uid => ({ uid, id: 'potion_healing', name: 'Potion of Healing',
    heal: '2d4+2', consumable: true });

  function scene() {
    const st = State.create({ seed: 'item-economy' });
    State.addActor(st, {
      id: 'pc1', name: 'Drinker', side: 'party', kind: 'pc',
      base: { name: 'Drinker', abilities: { str: 12, dex: 12, con: 12, int: 10, wis: 10, cha: 10 } },
      progression: { xp: 0, levels: [] },
      runtime: {
        hp: 5, hpMax: 40, tempHp: 0, conditions: {}, exhaustion: 0,
        concentratingOn: null, attuned: [], equipped: {}, deathSaves: {},
        gold: 0, pos: { x: 0, y: 0 }, resources: {}, speed: 30, ac: 12, reach: 5,
        inventory: [potion('p1'), potion('p2'), potion('p3'),
          { uid: 's1', id: 'longsword', name: 'Longsword', category: 'weapon' }],
      },
    });
    State.addActor(st, {
      id: 'foe1', name: 'Ogre', side: 'enemy', kind: 'monster',
      base: { name: 'Ogre', abilities: { str: 16, dex: 8, con: 16, int: 5, wis: 7, cha: 7 } },
      progression: { levels: [] },
      runtime: { hp: 30, hpMax: 30, conditions: {}, inventory: [], deathSaves: {},
        pos: { x: 1, y: 0 }, ac: 11, speed: 30, reach: 5 },
    });
    State.refreshAllDerived(st);
    st.combat = { active: true, round: 1, turnIndex: 0, order: ['pc1', 'foe1'] };
    st.activeActorId = 'pc1';
    Events.commit(st, Combat.startTurn(st, 'pc1'));
    return st;
  }

  const act = (st, verb, itemId) => Dispatch.dispatch(st, { past: [], future: [] }, {
    v: 1, family: 'item', commandId: 'i' + Math.random(), actorId: 'pc1',
    stateRevision: st.revision, turnEpoch: st.turnEpoch,
    primary: { verb, itemId, targetIds: [] },
  }, {});

  {
    const st = scene();
    const first = act(st, 'drink', 'p1');
    t.eq(!!(first.batch && first.batch.refused), false, 'the first potion goes down');
    t.ok(st.actors.pc1.runtime.hp > 5, 'and heals', '(5 -> ' + st.actors.pc1.runtime.hp + ')');
    t.eq(st.actors.pc1.runtime.turn.action, false, 'and it costs the action');

    const healed = st.actors.pc1.runtime.hp;
    const second = act(st, 'drink', 'p2');
    t.eq(!!(second.batch && second.batch.refused), true,
      'the second potion in the same turn is refused');
    t.eq(st.actors.pc1.runtime.hp, healed, 'and heals nothing');
    t.eq(st.actors.pc1.runtime.inventory.filter(i => i.uid === 'p2').length, 1,
      'and is not consumed by the attempt');
  }

  /* Drawing a weapon is the free object interaction; a second one is not. */
  {
    const st = scene();
    const draw = act(st, 'equip', 's1');
    t.eq(!!(draw.batch && draw.batch.refused), false, 'drawing a sword is free the first time');
    t.eq(st.actors.pc1.runtime.turn.objectInteraction, false,
      'and spends the turn\u2019s one object interaction');
    t.eq(st.actors.pc1.runtime.turn.action, true, 'without touching the action');

    const stow = act(st, 'unequip', 's1');
    t.eq(!!(stow.batch && stow.batch.refused), false,
      'a second interaction is allowed as the Use an Object action');
    t.eq(st.actors.pc1.runtime.turn.action, false, 'and that is what it spends');
  }

  /* Dropping something is explicitly free, however much else you have done. */
  {
    const st = scene();
    act(st, 'drink', 'p1');
    const drop = act(st, 'drop', 'p2');
    t.eq(!!(drop.batch && drop.batch.refused), false,
      'dropping an item is free even with the action gone');
  }

  /* And none of it may be offered once it cannot be paid for. */
  {
    const st = scene();
    act(st, 'drink', 'p1');
    const offered = Dispatch.legalMoves(st, 'pc1', {})
      .filter(m => m.family === 'item' && /drink/i.test(m.step.verb));
    t.eq(offered.length, 0,
      'and with the action spent, no potion is offered that would only refuse');
  }

  /* Out of combat nobody is counting. */
  {
    const st = scene();
    st.combat = { active: false, order: [], turnIndex: 0, round: 1 };
    st.actors.pc1.runtime.turn = null;
    act(st, 'drink', 'p1');
    const after = st.actors.pc1.runtime.hp;
    act(st, 'drink', 'p2');
    t.ok(st.actors.pc1.runtime.hp > after,
      'two potions out of combat are both drunk, because no turn is being counted',
      '(-> ' + st.actors.pc1.runtime.hp + ')');
  }
}

t.section('a warlock can actually cast, and gets it back on a short rest');
/*
 * Pact Magic is a SEPARATE pool. `resolveSpell` read `slotsMax` alone, and a
 * warlock has no ordinary slots at all, so probing a level-3 warlock produced
 * "Vex has no level 2 slots at all" for Shatter, Darkness, Enthrall and Mirror
 * Image — every levelled spell they knew was offered in the bar and refused on
 * click. The character could cast nothing but cantrips for the whole campaign.
 *
 * The recovery half was equally dead: pact slots were restored on a LONG rest
 * only, and through a generic `resource` event whose applier writes to
 * `runtime.resources` — a field nothing reads — so a pact slot never actually
 * came back. In 2014 they come back on a short rest, which is the entire shape
 * of the class.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');
  const Rules = require('../js/engine/rules.js');

  function warlock() {
    const c = Character.buildFromSpec({
      name: 'Vex', raceId: 'human', classId: 'warlock', levels: 3,
      backgroundId: 'charlatan',
      abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 10, cha: 17 },
      proficiencies: { skills: [] },
    });
    const st = State.create({ seed: 'pact-magic' });
    State.addActor(st, { id: 'pc1', name: 'Vex', side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime });
    State.addActor(st, { id: 'foe1', name: 'Ogre', side: 'enemy', kind: 'monster',
      base: { name: 'Ogre', abilities: { str: 16, dex: 8, con: 16, int: 5, wis: 7, cha: 7 } },
      progression: { levels: [] },
      runtime: { hp: 40, hpMax: 40, conditions: {}, inventory: [], deathSaves: {},
        pos: { x: 1, y: 0 }, ac: 11, speed: 30, reach: 5 } });
    State.refreshAllDerived(st);
    st.combat = { active: true, round: 1, turnIndex: 0, order: ['pc1', 'foe1'] };
    st.activeActorId = 'pc1';
    return st;
  }

  const st = warlock();
  const sc = st.actors.pc1.derivedCache.spellcasting || {};
  t.eq(Object.keys(sc.slotsMax || {}).length, 0,
    'a pure warlock has no ordinary spell slots at all');
  t.eq((sc.pactSlots || {}).max, 2, 'but two Pact Magic slots at level 3');
  t.eq((sc.pactSlots || {}).level, 2, 'and they are level 2 slots');

  const castShatter = () => {
    Events.commit(st, Combat.startTurn(st, 'pc1'));
    return Dispatch.dispatch(st, { past: [], future: [] }, {
      v: 1, family: 'spell', commandId: 's' + Math.random(), actorId: 'pc1',
      stateRevision: st.revision, turnEpoch: st.turnEpoch,
      primary: { verb: 'cast', spellId: 'shatter', targetIds: ['foe1'], slotLevel: null },
    }, {});
  };

  const one = castShatter();
  t.eq(!!(one.batch && one.batch.refused), false, 'Shatter is cast, not refused',
    one.batch && one.batch.refused ? '(' + one.batch.refused.detail + ')' : '');
  t.eq(st.actors.pc1.runtime.pactSlotsSpent, 1, 'and it spends a pact slot');
  t.eq(Object.keys(st.actors.pc1.runtime.slotsSpent || {}).length, 0,
    'not an ordinary one, which they do not have');

  const two = castShatter();
  t.eq(!!(two.batch && two.batch.refused), false, 'the second is cast too');
  t.eq(st.actors.pc1.runtime.pactSlotsSpent, 2, 'spending the last slot');

  const three = castShatter();
  t.eq(!!(three.batch && three.batch.refused), true,
    'the third is refused, because there are only two');
  t.ok(/pact/i.test((three.batch.refused || {}).detail || ''),
    'and it says why in the language of the class',
    '(' + ((three.batch.refused || {}).detail || '') + ')');

  /* The short rest is the whole point. */
  const rest = Rules.restoreOnRest(
    st.actors.pc1.base, st.actors.pc1.progression, st.actors.pc1.runtime, 'short',
    { actorId: 'pc1', derived: st.actors.pc1.derivedCache, spendHitDice: [] });
  const kinds = (rest.events || []).map(e => e.kind);
  t.ok(kinds.indexOf('pact_slot_restore') >= 0,
    'a short rest gives Pact Magic back', '(' + kinds.join(', ') + ')');

  const b = Events.makeBatch({ commandId: 'rest1', actorId: 'pc1' });
  (rest.events || []).forEach(e => b.events.push(e));
  Events.commit(st, b);
  t.eq(st.actors.pc1.runtime.pactSlotsSpent, 0,
    'and the slots are genuinely back in the pool, not written somewhere nothing reads');

  const again = castShatter();
  t.eq(!!(again.batch && again.batch.refused), false,
    'so the warlock can cast again after an hour\u2019s rest');

  /* The event kinds have to be on the whitelist or commit silently drops them —
     which is exactly how the first version of this fix appeared to work while
     changing nothing. */
  t.ok(Events.KINDS.indexOf('pact_slot_spend') >= 0,
    'pact_slot_spend is a registered event kind');
  t.ok(Events.KINDS.indexOf('pact_slot_restore') >= 0,
    'and so is pact_slot_restore');

  /* And nothing may be offered that could only refuse. A caster out of slots
     was still shown every levelled spell they knew. */
  const offeredWith = spentSlots => {
    const s2 = warlock();
    s2.actors.pc1.runtime.pactSlotsSpent = spentSlots;
    s2.actors.pc1.runtime.turn = { action: true, bonus: true, reaction: true,
      objectInteraction: true, movementRemaining: 30 };
    return Dispatch.legalMoves(s2, 'pc1', {})
      .filter(m => m.family === 'spell' && /^Cast /.test(m.what))
      .map(m => m.what.replace(/^Cast /, ''));
  };
  /* Matched by mention, not by exact label: an offensive spell is offered as
     "Cast Shatter at Ogre" now that an area spell needs an origin to measure
     its blast from. */
  const mentions = (list, name) => list.some(s => s.indexOf(name) >= 0);
  t.ok(mentions(offeredWith(0), 'Shatter'), 'with slots in hand, Shatter is offered',
    '(' + offeredWith(0).join(', ') + ')');
  t.eq(mentions(offeredWith(2), 'Shatter'), false,
    'with the pact pool empty it is not offered at all',
    '(' + offeredWith(2).join(', ') + ')');
  t.ok(offeredWith(2).length > 0,
    'but the cantrips remain, which is what a spent caster falls back on',
    '(' + offeredWith(2).join(', ') + ')');

  /* The same filter must not break ordinary casters. */
  {
    const w = Character.buildFromSpec({
      name: 'Wiz', raceId: 'human', classId: 'wizard', levels: 3, backgroundId: 'sage',
      abilities: { str: 8, dex: 14, con: 14, int: 17, wis: 10, cha: 12 },
      proficiencies: { skills: [] },
    });
    const ws = State.create({ seed: 'wiz-slots' });
    State.addActor(ws, { id: 'pc1', name: 'Wiz', side: 'party', kind: 'pc',
      base: w.base, progression: w.progression, runtime: w.runtime });
    State.refreshAllDerived(ws);
    ws.combat = { active: true, round: 1, turnIndex: 0, order: ['pc1'] };
    ws.activeActorId = 'pc1';
    ws.actors.pc1.runtime.turn = { action: true, bonus: true, reaction: true,
      objectInteraction: true, movementRemaining: 30 };
    const fresh = Dispatch.legalMoves(ws, 'pc1', {})
      .filter(m => m.family === 'spell' && /^Cast /.test(m.what)).length;
    ws.actors.pc1.runtime.slotsSpent = { 1: 4, 2: 3 };
    const drained = Dispatch.legalMoves(ws, 'pc1', {})
      .filter(m => m.family === 'spell' && /^Cast /.test(m.what)).length;
    t.ok(fresh > drained, 'a wizard out of slots is offered fewer spells than a rested one',
      '(' + fresh + ' -> ' + drained + ')');
    t.ok(drained > 0, 'and still has cantrips', '(' + drained + ')');
  }
}

t.section('an area spell hits what is in the area, friend or foe');
/*
 * `spellTargets` took every hostile creature in the encounter and spared every
 * ally, with no radius and no positions at all. A Fireball caught a goblin two
 * hundred feet away and never singed the fighter standing beside the blast.
 *
 * The comment defending it said the engine had no positional geometry for
 * blast radii. That was true when it was written and untrue since weapon reach
 * was enforced — `squaresInSphere` and `squaresInCone` were already in
 * combat.js, implementing the 2014 grid rulings correctly, and nothing called
 * them. The data was right, the geometry was right, and nothing read either.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');

  const mk = (id, name, side, pos) => ({
    id, name, side, kind: side === 'party' ? 'pc' : 'monster',
    base: { name, abilities: { str: 12, dex: 12, con: 12, int: 10, wis: 10, cha: 10 } },
    progression: { levels: [] },
    runtime: { hp: 60, hpMax: 60, conditions: {}, inventory: [], deathSaves: {},
      pos, ac: 12, speed: 30, reach: 5, equipped: {}, attuned: [], resources: {} },
  });

  function blastScene() {
    const c = Character.buildFromSpec({
      name: 'Pyro', raceId: 'human', classId: 'wizard', levels: 5, backgroundId: 'sage',
      abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 10, cha: 10 },
      proficiencies: { skills: [] },
    });
    const st = State.create({ seed: 'fireball-geometry' });
    State.addActor(st, { id: 'pc1', name: 'Pyro', side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime });
    st.actors.pc1.runtime.pos = { x: 0, y: 0 };
    State.addActor(st, mk('ally1', 'Fighter', 'party', { x: 11, y: 0 }));   // beside the blast
    State.addActor(st, mk('foe1', 'Goblin A', 'enemy', { x: 10, y: 0 }));   // the mark, 50 ft out
    State.addActor(st, mk('foe2', 'Goblin B', 'enemy', { x: 11, y: 1 }));   // beside it
    State.addActor(st, mk('faraway', 'Goblin Z', 'enemy', { x: 40, y: 40 })); // 200 ft away
    State.refreshAllDerived(st);
    const sc = st.actors.pc1.derivedCache.spellcasting;
    sc.prepared = (sc.prepared || []).concat(['fireball']);
    st.combat = { active: true, round: 1, turnIndex: 0, order: ['pc1'] };
    st.activeActorId = 'pc1';
    Events.commit(st, Combat.startTurn(st, 'pc1'));
    return st;
  }

  const st = blastScene();
  const before = {};
  Object.keys(st.actors).forEach(id => { before[id] = st.actors[id].runtime.hp; });

  const r = Dispatch.dispatch(st, { past: [], future: [] }, {
    v: 1, family: 'spell', commandId: 'fb1', actorId: 'pc1',
    stateRevision: st.revision, turnEpoch: st.turnEpoch,
    primary: { verb: 'cast', spellId: 'fireball', targetIds: ['foe1'], slotLevel: 3 },
  }, {});
  t.eq(!!(r.batch && r.batch.refused), false, 'the Fireball goes off',
    r.batch && r.batch.refused ? '(' + r.batch.refused.detail + ')' : '');

  const hurt = id => before[id] - st.actors[id].runtime.hp;
  t.ok(hurt('foe1') > 0, 'the goblin at the centre is burned', '(' + hurt('foe1') + ')');
  t.ok(hurt('foe2') > 0, 'and the one beside it', '(' + hurt('foe2') + ')');
  t.ok(hurt('ally1') > 0,
    'and so is the fighter standing five feet away, because fire does not pick sides',
    '(' + hurt('ally1') + ')');
  t.eq(hurt('faraway'), 0,
    'the goblin two hundred feet away is untouched, which was the other half of the bug');
  t.eq(hurt('pc1'), 0, 'and the caster, fifty feet back, is outside their own blast');

  /* A cone or cube emanating from you starts at your square: you are not in
     your own Burning Hands. */
  {
    const st2 = blastScene();
    const sc = st2.actors.pc1.derivedCache.spellcasting;
    sc.prepared = (sc.prepared || []).concat(['burning-hands']);
    st2.actors.ally1.runtime.pos = { x: 1, y: 0 };   // right beside the caster
    const hpBefore = { pc1: st2.actors.pc1.runtime.hp, ally1: st2.actors.ally1.runtime.hp };
    Dispatch.dispatch(st2, { past: [], future: [] }, {
      v: 1, family: 'spell', commandId: 'bh1', actorId: 'pc1',
      stateRevision: st2.revision, turnEpoch: st2.turnEpoch,
      primary: { verb: 'cast', spellId: 'burning-hands', targetIds: ['ally1'], slotLevel: 1 },
    }, {});
    t.eq(st2.actors.pc1.runtime.hp, hpBefore.pc1,
      'a cone that comes out of your hands does not burn you');
    t.ok(st2.actors.ally1.runtime.hp < hpBefore.ally1,
      'but it does burn whoever is standing in front of them');
  }

  /* The bar has to say so, and a companion has to look before it throws. */
  {
    const st3 = blastScene();
    const offers = Dispatch.legalMoves(st3, 'pc1', {})
      .filter(m => m.family === 'spell' && /Fireball/.test(m.what));
    const atA = offers.filter(m => /Goblin A/.test(m.what))[0];
    const atZ = offers.filter(m => /Goblin Z/.test(m.what))[0];
    t.ok(!!atA && !!atZ, 'an area spell is offered against each enemy, so it has somewhere to land');
    if (atA && atZ) {
      t.ok(atA.friendlyFire > 0, 'aiming at the goblin next to the fighter is flagged',
        '(' + (atA.warn || '') + ')');
      t.ok(/Fighter/.test(atA.warn || ''), 'and names who would be caught');
      t.eq(atZ.friendlyFire || 0, 0, 'the clean shot across the field is not flagged');
    }
  }
}

t.done();
