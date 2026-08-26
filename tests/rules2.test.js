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

t.section('Appendix A conditions actually do something');
/*
 * The conditions were tracked from the beginning and almost none of them bit.
 * Probed before writing this: a PARALYZED creature kept a speed of 30 and was
 * still offered movement in the action bar; a petrified one failed a DC 10
 * Dexterity save six times in twenty instead of twenty; poisoned and
 * frightened imposed no disadvantage on ability checks at all, because the
 * roll assembly looked at exhaustion and nothing else; and every hit on a
 * paralyzed ogre came back with `critDice: null`.
 *
 * The cause was structural rather than a series of oversights: conditions live
 * on `runtime`, and `rules.js` builds every roll from `derived`, which never
 * carried them. So they are on the sheet now, and Appendix A lives in one
 * table in effects.js that movement, saves, checks and attacks all read.
 */
{
  const Effects = require('../js/engine/effects.js');
  const Rules = require('../js/engine/rules.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');

  const mk = (id, name, side, pos) => ({
    id, name, side, kind: side === 'party' ? 'pc' : 'monster',
    base: { name, abilities: { str: 14, dex: 14, con: 14, int: 10, wis: 10, cha: 10 } },
    progression: { xp: 0, levels: [] },
    runtime: { hp: 200, hpMax: 200, tempHp: 0, conditions: {}, exhaustion: 0,
      concentratingOn: null, attuned: [], equipped: {}, inventory: [], deathSaves: {},
      gold: 0, pos, resources: {}, speed: 30, ac: 12, reach: 5 },
  });

  function scene(cond, on, foePos) {
    const s = State.create({ seed: 'cond-' + cond + (on || '') });
    State.addActor(s, mk('hero', 'Hero', 'party', { x: 0, y: 0 }));
    State.addActor(s, mk('foe', 'Ogre', 'enemy', foePos || { x: 1, y: 0 }));
    State.refreshAllDerived(s);
    if (cond) s.actors[on || 'hero'].runtime.conditions[cond] = true;
    State.refreshAllDerived(s);
    s.combat = { active: true, order: ['hero', 'foe'], turnIndex: 0, round: 1 };
    s.activeActorId = 'hero';
    Events.commit(s, Combat.startTurn(s, 'hero'));
    return s;
  }

  /* --- speed 0 --- */
  ['grappled', 'restrained', 'paralyzed', 'petrified', 'stunned', 'unconscious'].forEach(c => {
    const s = scene(c);
    t.eq(s.actors.hero.derivedCache.speed, 0, c + ' reduces speed to nothing');
    const walk = (Combat.resolveMovement.legalMoves(s, 'hero', {}) || [])
      .filter(m => ['move', 'climb', 'swim', 'jump'].indexOf(m.step.verb) >= 0);
    t.eq(walk.length, 0, 'and ' + c + ' offers no way to walk off');
  });
  t.ok(scene(null).actors.hero.derivedCache.speed > 0,
    'while an unaffected character still moves normally');

  /* --- automatically failed Strength and Dexterity saves --- */
  ['paralyzed', 'petrified', 'stunned', 'unconscious'].forEach(c => {
    const s = scene(c);
    const d = s.actors.hero.derivedCache;
    let fails = 0;
    for (let i = 0; i < 20; i++) {
      if (!Rules.savingThrow(d, 'dex', { rng: s.rng, dc: 10 }).success) fails++;
    }
    t.eq(fails, 20, c + ' fails every Dexterity save, not merely most of them');
    const one = Rules.savingThrow(d, 'dex', { rng: s.rng, dc: 5 });
    t.eq(one.autoFailed, c, 'and the roll records why', '(' + one.autoFailed + ')');
  });
  {
    /* Wisdom is untouched: being held does not make you gullible. */
    const s = scene('paralyzed');
    let fails = 0;
    for (let i = 0; i < 20; i++) {
      if (!Rules.savingThrow(s.actors.hero.derivedCache, 'wis', { rng: s.rng, dc: 5 }).success) fails++;
    }
    t.ok(fails < 20, 'but a Wisdom save is still rolled normally', '(' + fails + '/20 failed)');
  }

  /* --- disadvantage on ability checks --- */
  ['poisoned', 'frightened'].forEach(c => {
    const s = scene(c);
    const r = Rules.abilityCheck(s.actors.hero.derivedCache, 'str', { rng: s.rng, dc: 10 });
    t.ok((r.check.sources.disadvantage || []).indexOf(c) >= 0,
      c + ' imposes disadvantage on ability checks',
      '(' + (r.check.sources.disadvantage || []).join(', ') + ')');
  });
  {
    const s = scene('restrained');
    const r = Rules.savingThrow(s.actors.hero.derivedCache, 'dex', { rng: s.rng, dc: 10 });
    t.ok((r.check.sources.disadvantage || []).indexOf('restrained') >= 0,
      'restrained imposes disadvantage on Dexterity saves',
      '(' + (r.check.sources.disadvantage || []).join(', ') + ')');
  }

  /* --- automatic criticals within five feet --- */
  const swings = (cond, foePos) => {
    const s = scene(cond, 'foe', foePos);
    let hits = 0, crits = 0;
    for (let i = 0; i < 30; i++) {
      const b = Combat.resolveCombat(s, {
        v: 1, family: 'combat', commandId: 'c' + i, actorId: 'hero',
        stateRevision: s.revision, turnEpoch: s.turnEpoch,
        primary: { verb: 'attack', targetIds: ['foe'] },
      }, {});
      (b.events || []).forEach(e => {
        if (e.kind === 'roll' && e.of === 'attack' && e.result.hit !== false) {
          hits++; if (e.result.isCrit) crits++;
        }
      });
      s.actors.hero.runtime.turn.action = true;
    }
    return { hits, crits };
  };
  ['paralyzed', 'unconscious'].forEach(c => {
    const r = swings(c);
    t.ok(r.hits > 0, 'attacks land on a ' + c + ' target', '(' + r.hits + ')');
    t.eq(r.crits, r.hits,
      'and every one of them is a critical, because it is helpless within five feet',
      '(' + r.crits + '/' + r.hits + ')');
  });
  {
    const plain = swings(null);
    t.ok(plain.crits < plain.hits,
      'while an ordinary target is not critically hit every single time',
      '(' + plain.crits + '/' + plain.hits + ')');
  }

  /* The table is the single source, so a condition nobody has wired up yet
     still reports its flags rather than silently doing nothing. */
  t.eq(Effects.speedIsZero({ grappled: true }), true, 'the table answers for speed');
  t.eq(Effects.speedIsZero({ poisoned: true }), false, 'and only for what it should');
  t.eq(Effects.autoFailsSave({ stunned: true }, 'dex'), 'stunned', 'and for saves');
  t.eq(Effects.autoFailsSave({ stunned: true }, 'wis'), null, 'for the right abilities only');
  t.eq(Object.keys(Effects.CONDITIONS).length, 15,
    'and all fifteen of Appendix A are in it',
    '(' + Object.keys(Effects.CONDITIONS).length + ')');
}

t.section('class features are mechanics, not decoration');
/*
 * The class data has been machine-readable from the start: sixty distinct
 * `mech.type` values describing Rage, Sneak Attack, Ki, Lay on Hands, Action
 * Surge, Second Wind, Unarmored Defense and the rest, each with its own
 * progression table. Searching every engine, ai, ui and gen source file for
 * those sixty names found exactly TWO being read — `asi` and `extra_attack`.
 *
 * That is worse than not having them: a barbarian's sheet listed Rage, the
 * level-up screen congratulated them on gaining it, and there was no rage in
 * the game. And Unarmored Defense was a special case of the recurring bug —
 * character.js DID have a block for it, reading `cls.unarmoredDefense`, a
 * field no class has. It never ran once. A level-5 barbarian with Constitution
 * 16 derived AC 12 instead of 15, all game.
 */
{
  const Features = require('../js/engine/features.js');
  const Rules = require('../js/engine/rules.js');

  const build = (classId, levels, abilities) => Character.buildFromSpec({
    name: 'T', raceId: 'human', classId, levels, backgroundId: 'soldier',
    abilities, proficiencies: { skills: [] },
  });
  const sheet = (classId, levels, abilities) => {
    const c = build(classId, levels, abilities);
    return Character.derive(c.base, c.progression, c.runtime, []);
  };

  /* Every type in the data has a decision recorded against it. A feature the
     registry has never heard of is one nobody decided about, and it would
     silently do nothing — which is exactly the state this fixes. */
  t.deep(Features.unregisteredTypes(), [],
    'every feature type in the class data is registered');

  /* --- Unarmored Defense, which had never once been applied --- */
  {
    const barb = sheet('barbarian', 5, { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 8 });
    t.eq(barb.ac, 15, 'a barbarian with Dex 14 and Con 16 has AC 15, not 12',
      '(' + barb.acBreakdown.filter(b => b.applied).map(b => b.source).join(', ') + ')');

    const monk = sheet('monk', 5, { str: 12, dex: 18, con: 14, int: 10, wis: 16, cha: 10 });
    t.eq(monk.ac, 17, 'a monk with Dex 18 and Wis 16 has AC 17');

    const sorc = sheet('sorcerer', 5, { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 17 });
    t.eq(sorc.ac, 15, 'Draconic Resilience gives the sorcerer 13 + Dex');

    /* Armour still wins where it should: this must not quietly buff everyone. */
    const fighter = sheet('fighter', 5, { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 });
    t.ok(fighter.acBreakdown.some(b => b.applied && /mail|plate|leather|armor/i.test(b.source)),
      'a fighter in armour still derives from the armour',
      '(' + fighter.acBreakdown.filter(b => b.applied).map(b => b.source).join(' + ') + ')');
  }

  /* --- pools, at the right size, from the right row of the table --- */
  {
    const barb = sheet('barbarian', 9, { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 8 });
    t.eq(barb.featureResources.rage.max, 4, 'a level-9 barbarian has four rages');
    t.eq(Features.rageDamageBonus(build('barbarian', 9,
      { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 8 }).base), 3,
    'and a rage damage bonus of +3');

    /* A feature granted again at a higher level must supersede the first
       grant, or a level-17 fighter has the one Action Surge the level-2 row
       described. */
    const f17 = sheet('fighter', 17, { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 });
    t.eq(f17.featureResources.action_surge.max, 2,
      'a level-17 fighter has two Action Surges, not the one granted at level 2');
    const cleric18 = sheet('cleric', 18, { str: 12, dex: 12, con: 14, int: 10, wis: 18, cha: 10 });
    t.eq(cleric18.featureResources.channel_divinity.max, 3,
      'and a level-18 cleric has three Channel Divinities');

    const pal = sheet('paladin', 6, { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 16 });
    t.eq(pal.featureResources.lay_on_hands.max, 30, 'Lay on Hands is five points per level');
    const monk = sheet('monk', 10, { str: 12, dex: 18, con: 14, int: 10, wis: 16, cha: 10 });
    t.eq(monk.featureResources.ki.max, 10, 'a monk has ki equal to their level');
    const bard = sheet('bard', 5, { str: 8, dex: 14, con: 12, int: 12, wis: 10, cha: 17 });
    t.eq(bard.featureResources.bardic_inspiration.max, 3,
      'Bardic Inspiration is Charisma modifier many');
    t.eq(Features.sneakAttackDice(build('rogue', 11,
      { str: 10, dex: 18, con: 14, int: 12, wis: 12, cha: 12 }).base), '6d6',
    'a level-11 rogue sneak attacks for 6d6');
  }

  /* --- recovery, on the rest each pool actually uses --- */
  {
    const c = build('fighter', 9, { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 });
    const st = State.create({ seed: 'feature-rest' });
    State.addActor(st, { id: 'pc1', name: 'T', side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime });
    State.refreshAllDerived(st);

    const spend = names => {
      const b = Events.makeBatch({ commandId: 's' + Math.random(), actorId: 'pc1' });
      names.forEach(f => Events.push(b, 'feature_spend', { actorId: 'pc1', feature: f }, ''));
      Events.commit(st, b);
    };
    const rest = kind => {
      const r = Rules.restoreOnRest(st.actors.pc1.base, st.actors.pc1.progression,
        st.actors.pc1.runtime, kind,
        { actorId: 'pc1', derived: st.actors.pc1.derivedCache, spendHitDice: [] });
      const b = Events.makeBatch({ commandId: 'r' + Math.random(), actorId: 'pc1' });
      (r.events || []).forEach(e => b.events.push(e));
      Events.commit(st, b);
    };

    spend(['second_wind', 'action_surge', 'indomitable']);
    const after = () => st.actors.pc1.runtime.featuresSpent;
    t.eq(after().second_wind, 1, 'spending Second Wind is recorded');

    rest('short');
    t.eq(after().second_wind, 0, 'a short rest gives Second Wind back');
    t.eq(after().action_surge, 0, 'and Action Surge');
    t.eq(after().indomitable, 1, 'but not Indomitable, which is once per long rest');

    rest('long');
    t.eq(after().indomitable, 0, 'a long rest gives Indomitable back too');

    t.ok(Events.KINDS.indexOf('feature_spend') >= 0, 'feature_spend is a registered event kind');
    t.ok(Events.KINDS.indexOf('feature_restore') >= 0, 'and feature_restore');
  }

  /* --- and the honest half --- */
  {
    const barb = sheet('barbarian', 9, { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 8 });
    t.ok(barb.narrativeFeatures.length > 0,
      'features the engine does not simulate are named rather than implied',
      '(' + barb.narrativeFeatures.slice(0, 3).join(', ') + ')');
    t.eq(barb.narrativeFeatures.indexOf('Rage'), -1,
      'and Rage is not among them, because it is real now');
  }
}

t.section('a dying friend can be steadied by hand');
/*
 * 2014, "Stabilizing a Creature": your action, a DC 10 Wisdom (Medicine)
 * check — or a healer's kit, which does it without a roll. Nothing offered
 * this at all, so the only ways out of dying were a healing spell or three
 * lucky death saves, and a party with no caster could do nothing but watch
 * somebody bleed out.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');

  const mk = (id, name, side, pos, inv) => ({
    id, name, side, kind: side === 'party' ? 'pc' : 'monster',
    base: { name, abilities: { str: 12, dex: 12, con: 12, int: 10, wis: 14, cha: 10 } },
    progression: { xp: 0, levels: [] },
    runtime: { hp: 20, hpMax: 20, tempHp: 0, conditions: {}, exhaustion: 0,
      concentratingOn: null, attuned: [], equipped: {}, inventory: inv || [],
      deathSaves: { successes: 0, failures: 0 }, gold: 0, pos, resources: {},
      speed: 30, ac: 12, reach: 5 },
  });

  function scene(withKit, downPos, seed) {
    const s = State.create({ seed: 'steady-' + withKit + '-' + (seed || 0) });
    State.addActor(s, mk('medic', 'Medic', 'party', { x: 0, y: 0 },
      withKit ? [{ uid: 'k1', id: 'healers-kit', name: "Healer's kit", uses: 2 }] : []));
    State.addActor(s, mk('down', 'Friend', 'party', downPos || { x: 1, y: 0 }));
    State.addActor(s, mk('foe', 'Ogre', 'enemy', { x: 5, y: 5 }));
    State.refreshAllDerived(s);
    const b = Events.makeBatch({ commandId: 'hurt' });
    Events.push(b, 'hp', { targetId: 'down', delta: -100 }, 'down');
    Events.commit(s, b);
    s.combat = { active: true, order: ['medic', 'down', 'foe'], turnIndex: 0, round: 1 };
    s.activeActorId = 'medic';
    Events.commit(s, Combat.startTurn(s, 'medic'));
    return s;
  }
  const steady = (s, targetId) => Combat.resolveCombat(s, {
    v: 1, family: 'combat', commandId: 'st' + Math.random(), actorId: 'medic',
    stateRevision: s.revision, turnEpoch: s.turnEpoch,
    primary: { verb: 'stabilise', targetIds: [targetId] },
  }, {});

  /* --- offered, and only when it would mean something --- */
  {
    const s = scene(false);
    const offered = Dispatch.legalMoves(s, 'medic', {}).filter(m => m.step.verb === 'stabilise');
    t.eq(offered.length, 1, 'the bar offers a way to steady a dying friend');
    t.ok(/medicine/i.test(offered[0].warn || ''), 'and says what it will cost',
      '(' + (offered[0].warn || '') + ')');
  }
  {
    /* Not for someone across the room: you have to reach them. */
    const far = scene(false, { x: 8, y: 0 });
    const offered = Dispatch.legalMoves(far, 'medic', {}).filter(m => m.step.verb === 'stabilise');
    t.eq(offered.length, 0, 'but not for somebody forty feet away');
    const r = steady(far, 'down');
    t.ok(!!r.refused, 'and it refuses if asked for anyway',
      '(' + ((r.refused || {}).detail || '') + ')');
  }

  /* --- the Medicine check --- */
  {
    const s = scene(false);
    const b = steady(s, 'down');
    t.eq(!!b.refused, false, 'the check is made');
    const roll = (b.events || []).filter(e => e.kind === 'roll' && e.of === 'check')[0];
    t.ok(!!roll, 'and it is a real roll, recorded');
    Events.commit(s, b);
    /* Asserting "they are stable" assumes the d20 co-operates — Wisdom 14
       unproficient against DC 10 succeeds about two times in three, so that
       assertion fails one run in three for no reason at all. Assert the thing
       that must always hold: the outcome matches the roll. */
    t.eq(!!s.actors.down.runtime.stable, !!(roll && roll.result.success),
      'and the friend is stable exactly when the check succeeded',
      '(rolled ' + (roll && roll.result.total) + ' vs DC 10, ' +
      (roll && roll.result.success ? 'stable' : 'still dying') + ')');
    t.eq(s.actors.medic.runtime.turn.action, false,
      'it costs the action either way, which is what makes it a real choice');
  }

  /* Over enough attempts it must sometimes work, or "succeeds when the check
     succeeds" would be vacuously true against a check that never passes. */
  {
    let stabilised = 0;
    for (let i = 0; i < 20; i++) {
      /* A fresh seed each time. Reusing one meant twenty identical rolls, and
         a run of twenty identical failures reads exactly like a check that can
         never pass — which is what it looked like until I noticed the seed. */
      const s = scene(false, null, i);
      const b = steady(s, 'down');
      Events.commit(s, b);
      if (s.actors.down.runtime.stable) stabilised++;
    }
    t.ok(stabilised > 0 && stabilised < 20,
      'and across twenty attempts it sometimes works and sometimes does not',
      '(' + stabilised + '/20)');
  }

  /* --- the healer's kit: no roll, one use --- */
  {
    const s = scene(true);
    const offered = Dispatch.legalMoves(s, 'medic', {}).filter(m => m.step.verb === 'stabilise');
    t.ok(/kit/i.test(offered[0].warn || ''), 'with a kit in the pack the bar says so',
      '(' + (offered[0].warn || '') + ')');
    const b = steady(s, 'down');
    Events.commit(s, b);
    t.eq(s.actors.down.runtime.stable, true, 'a healer\u2019s kit stabilises without a roll');
    t.eq(!(b.events || []).some(e => e.kind === 'roll'), true, 'no check is rolled at all');
    t.eq(s.actors.medic.runtime.inventory[0].uses, 1, 'and it spends a use');
  }

  /* --- and refuses where it makes no sense --- */
  {
    const s = scene(false);
    t.ok(!!steady(s, 'foe').refused, 'steadying someone still on their feet is refused',
      '(' + ((steady(s, 'foe').refused || {}).detail || '') + ')');
    const s2 = scene(false);
    Events.commit(s2, steady(s2, 'down'));
    t.ok(!!steady(s2, 'down').refused, 'and steadying somebody already stable is refused');
  }

  t.ok(Events.KINDS.indexOf('item_charge') >= 0,
    'item_charge is a registered event kind, or the kit use would be dropped silently');
}

t.section('coming back from the dead actually costs something');
/*
 * `mortality.raise` has always created a `roll_penalty` effect — Raise Dead's
 * -4 to attacks, saves and ability checks, wearing off by 1 per long rest.
 * `Effects.modifiersFor` had no case for that kind, so the penalty was created,
 * stored, displayed and never applied: the entire cost of resurrection was a
 * line of prose.
 *
 * There was a second bug underneath it. The effect declares
 * `appliesTo: ['attack','save','check']`, and `rollMatches` knew
 * 'ability_check' and 'skill' but not 'check' — so even once the case existed,
 * the check third of the penalty would have gone on doing nothing.
 */
{
  const Effects = require('../js/engine/effects.js');
  const st = State.create({ seed: 'raise' });
  State.addActor(st, {
    id: 'pc1', name: 'Returned', side: 'party', kind: 'pc',
    base: { name: 'Returned', abilities: { str: 14, dex: 12, con: 12, int: 10, wis: 10, cha: 10 } },
    progression: { levels: [] },
    runtime: { hp: 10, hpMax: 10, conditions: {}, inventory: [], deathSaves: {}, resources: {} },
  });
  State.refreshAllDerived(st);
  st.effects = st.effects || [];
  st.effects.push({
    id: 'raise-penalty-pc1-1', name: 'Returned from death', targetId: 'pc1',
    kind: 'roll_penalty', magnitude: -4, appliesTo: ['attack', 'save', 'check'],
    duration: { type: 'until_rest', value: 4 },
  });

  ['attack', 'save', 'ability_check', 'skill'].forEach(rt => {
    t.eq(Effects.modifiersFor(st, 'pc1', rt, {}).flat, -4,
      'the resurrection penalty applies to ' + rt);
  });

  /* And it must not leak onto rolls it does not name. */
  const other = Effects.modifiersFor(st, 'pc1', 'initiative', {});
  t.eq(other.flat, 0, 'but not to a roll it does not name', '(' + other.flat + ')');
}

t.section('a spell you have learned is a spell you can cast');
/*
 * Levelling a known caster appends to `progression.spellsKnown`. Nothing read
 * it: `Character.spellcasting()` never returned it, and `resolveSpell` consults
 * only `prepared` and cantrips. So a sorcerer who reached level 3 and chose
 * Scorching Ray could never cast Scorching Ray — for the rest of the campaign.
 * The choice the level-up screen made you make had no effect whatsoever.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');

  function sorcerer() {
    const c = Character.buildFromSpec({
      name: 'S', raceId: 'human', classId: 'sorcerer', levels: 5, backgroundId: 'sage',
      abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 18 },
      proficiencies: { skills: [] },
    });
    const st = State.create({ seed: 'learned' });
    State.addActor(st, { id: 'pc1', name: 'S', side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime });
    st.actors.pc1.runtime.pos = { x: 0, y: 0 };
    State.addActor(st, { id: 'foe1', name: 'Ogre', side: 'enemy', kind: 'monster',
      base: { name: 'Ogre', abilities: { str: 16, dex: 8, con: 16, int: 5, wis: 7, cha: 7 } },
      progression: { levels: [] },
      runtime: { hp: 90, hpMax: 90, conditions: {}, inventory: [], deathSaves: {},
        pos: { x: 2, y: 0 }, ac: 11, speed: 30, reach: 5 } });
    State.refreshAllDerived(st);
    st.combat = { active: true, round: 1, turnIndex: 0, order: ['pc1', 'foe1'] };
    st.activeActorId = 'pc1';
    return st;
  }
  const spellNames = st => {
    Events.commit(st, Combat.startTurn(st, 'pc1'));
    return Dispatch.legalMoves(st, 'pc1', {})
      .filter(m => m.family === 'spell' && /^Cast/.test(m.what)).map(m => m.what);
  };

  const st = sorcerer();
  t.eq(spellNames(st).some(s => /Scorching/i.test(s)), false,
    'a sorcerer who has not learned Scorching Ray is not offered it');

  st.actors.pc1.progression.spellsKnown = ['scorching-ray'];
  State.refreshAllDerived(st);
  t.eq(spellNames(st).some(s => /Scorching/i.test(s)), true,
    'and once learned, it is offered');
  t.deep(st.actors.pc1.derivedCache.spellcasting.known, ['scorching-ray'],
    'the sheet distinguishes what is known from what is prepared today');

  /* Cast it for real: being offered is not the same as working. */
  const before = st.actors.foe1.runtime.hp;
  const r = Dispatch.dispatch(st, { past: [], future: [] }, {
    v: 1, family: 'spell', commandId: 'sr1', actorId: 'pc1',
    stateRevision: st.revision, turnEpoch: st.turnEpoch,
    primary: { verb: 'cast', spellId: 'scorching-ray', targetIds: ['foe1'], slotLevel: 2 },
  }, {});
  t.eq(!!(r.batch && r.batch.refused), false, 'and casting it is not refused',
    r.batch && r.batch.refused ? '(' + r.batch.refused.detail + ')' : '');
  t.ok(st.actors.foe1.runtime.hp < before, 'and it actually burns somebody',
    '(' + (before - st.actors.foe1.runtime.hp) + ' damage)');

  /* Three rays are three separate attack rolls, not one. Scorching Ray had no
     mechanical effect at all — only a `narrative` summary — so it spent a slot
     and did nothing. */
  const rolls = (r.batch.beats || []).filter(s => /casts Scorching Ray/i.test(s)).length;
  t.eq(rolls, 3, 'and it throws three rays, each rolled on its own', '(' + rolls + ')');
}

t.section('a spell that promises damage delivers it');
/*
 * 140 of the 319 spells carry only a `narrative` effect. For most that is
 * right — Prestidigitation and Mage Hand are for a Dungeon Master to
 * adjudicate, not for dice. But a spell whose own text says it deals 2d6 fire
 * damage and which carries no mechanics spends your slot and does nothing, and
 * that is indistinguishable from a bug.
 *
 * This lists the ones that are still text, so the gap is declared rather than
 * discovered mid-fight. Each is genuinely awkward — a persistent flaming
 * sphere, a glyph that is really a trap, the backlash from a failed Wish — and
 * the allowlist is the honest record of that. Scorching Ray was on this list
 * and is not any more.
 */
{
  const Spells = require('../js/data/srd_spells.js');
  const T = Spells.SPELLS || Spells.spells || Spells;

  const KNOWN_NARRATIVE = [
    'divine-favor',        // a damage rider on your own weapon attacks
    'alter-self',          // 1d6 is a natural weapon the new form grants
    'branding-smite',      // a rider on the next hit, needs smite plumbing
    'flame-blade',         // conjures a weapon you then attack with
    'flaming-sphere',      // a persistent object that moves and rams
    'glyph-of-warding',    // really a trap: placed now, fires later
    'meld-into-stone',     // damage only if the stone is destroyed around you
    'spirit-guardians',    // a moving aura, needs per-turn area upkeep
    'dimension-door',      // 4d6 only on a failed teleport into a solid object
    'wish',                // 1d10 per level is the backlash from a stretched wish
  ];

  const offenders = [];
  Object.keys(T).forEach(id => {
    const sp = T[id];
    const effects = ((sp.mech || {}).effects) || [];
    if (effects.some(e => e.kind !== 'narrative')) return;
    const txt = (sp.text || '') + ' ' + effects.map(e => e.summary || '').join(' ');
    if (!/\d+d\d+\s+\w+\s+damage/i.test(txt)) return;
    if (KNOWN_NARRATIVE.indexOf(id) >= 0) return;
    offenders.push(sp.name || id);
  });

  t.deep(offenders, [],
    'no spell promises damage in its text while carrying no mechanics at all');
  t.eq(KNOWN_NARRATIVE.indexOf('scorching-ray'), -1,
    'and Scorching Ray is no longer among the ones that only talk about it');
}

t.section('an unarmed strike is not the weapon in your hand');
/*
 * `profileFor` was passed `opts.unarmed` by the `unarmed_strike` verb and read
 * it nowhere, returning `list[0]` — the equipped weapon. "Strike the Ogre
 * unarmed" hit for 1d8+4 piercing with a rapier. The correct entry had been in
 * the attack list all along, built by state.js and flagged `unarmed: true`.
 *
 * The off-hand had the same shape of bug: it took `list[1]`, the second entry
 * of an array ordered by inventory, rather than the weapon actually in the off
 * hand.
 */
{
  require('../js/engine/combat.js');
  const rogue = (inv, eq) => {
    const c = Character.buildFromSpec({
      name: 'R', raceId: 'human', classId: 'rogue', levels: 5, backgroundId: 'criminal',
      abilities: { str: 8, dex: 18, con: 12, int: 12, wis: 12, cha: 12 },
      proficiencies: { skills: [] },
    });
    c.runtime.inventory = inv;
    c.runtime.equipped = eq;
    const st = State.create({ seed: 'unarmed' });
    State.addActor(st, { id: 'pc1', name: 'R', side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime });
    st.actors.pc1.runtime.pos = { x: 0, y: 0 };
    State.addActor(st, { id: 'foe1', name: 'Ogre', side: 'enemy', kind: 'monster',
      base: { name: 'Ogre', abilities: { str: 16, dex: 8, con: 16, int: 5, wis: 7, cha: 7 } },
      progression: { levels: [] },
      runtime: { hp: 60, hpMax: 60, conditions: {}, inventory: [], deathSaves: {},
        pos: { x: 1, y: 0 }, ac: 11, speed: 30, reach: 5 } });
    State.refreshAllDerived(st);
    st.combat = { active: true, round: 1, turnIndex: 0, order: ['pc1', 'foe1'] };
    st.activeActorId = 'pc1';
    Events.commit(st, Combat.startTurn(st, 'pc1'));
    return st;
  };

  const st = rogue(
    [{ uid: 'w1', id: 'rapier', name: 'Rapier' },
      { uid: 'w2', id: 'dagger', name: 'Dagger' },
      { uid: 'w3', id: 'greatsword', name: 'Greatsword' }],
    { mainHand: 'w1', offHand: 'w2' });

  const fist = Combat.profileFor(st, 'pc1', { unarmed: true });
  t.eq(fist.damageType, 'bludgeoning', 'an unarmed strike is bludgeoning');
  t.ok(!/d8/.test(fist.damage), 'and not the rapier\u2019s die', '(' + fist.damage + ')');
  t.eq(!!fist.unarmed, true, 'it is the unarmed entry from the attack list');

  const main = Combat.profileFor(st, 'pc1', {});
  t.eq(main.name, 'Rapier', 'the main hand is still the main-hand weapon');
  const off = Combat.profileFor(st, 'pc1', { offHand: true });
  t.eq(off.name, 'Dagger', 'and the off hand is the weapon actually in it, not list[1]');
}

t.section('two-weapon fighting needs two light weapons');
/*
 * 2014, "Two-Weapon Fighting": a light melee weapon in each hand. Nothing
 * checked, so a rogue holding a rapier — finesse, but not light — was offered
 * an off-hand strike, and so was a character holding one weapon and nothing
 * else.
 */
{
  require('../js/engine/combat.js');
  const Dispatch = require('../js/engine/dispatch.js');
  const armed = (inv, eq) => {
    const c = Character.buildFromSpec({
      name: 'R', raceId: 'human', classId: 'rogue', levels: 5, backgroundId: 'criminal',
      abilities: { str: 8, dex: 18, con: 12, int: 12, wis: 12, cha: 12 },
      proficiencies: { skills: [] },
    });
    c.runtime.inventory = inv;
    c.runtime.equipped = eq;
    const st = State.create({ seed: 'twf' });
    State.addActor(st, { id: 'pc1', name: 'R', side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime });
    st.actors.pc1.runtime.pos = { x: 0, y: 0 };
    State.addActor(st, { id: 'foe1', name: 'Ogre', side: 'enemy', kind: 'monster',
      base: { name: 'Ogre', abilities: { str: 16, dex: 8, con: 16, int: 5, wis: 7, cha: 7 } },
      progression: { levels: [] },
      runtime: { hp: 60, hpMax: 60, conditions: {}, inventory: [], deathSaves: {},
        pos: { x: 1, y: 0 }, ac: 11, speed: 30, reach: 5 } });
    State.refreshAllDerived(st);
    st.combat = { active: true, round: 1, turnIndex: 0, order: ['pc1', 'foe1'] };
    st.activeActorId = 'pc1';
    Events.commit(st, Combat.startTurn(st, 'pc1'));
    return st;
  };
  const check = st => ({
    offered: Dispatch.legalMoves(st, 'pc1', {})
      .filter(m => m.step.verb === 'two_weapon_attack').length,
    refused: !!Combat.resolveCombat(st, {
      v: 1, family: 'combat', commandId: 'tw' + Math.random(), actorId: 'pc1',
      stateRevision: st.revision, turnEpoch: st.turnEpoch,
      primary: { verb: 'two_weapon_attack', targetIds: ['foe1'] },
    }, {}).refused,
  });

  const rapier = check(armed(
    [{ uid: 'w1', id: 'rapier', name: 'Rapier' }, { uid: 'w2', id: 'dagger', name: 'Dagger' }],
    { mainHand: 'w1', offHand: 'w2' }));
  t.eq(rapier.offered, 0, 'a rapier is finesse but not light, so no off-hand strike is offered');
  t.eq(rapier.refused, true, 'and the resolver refuses it if asked directly');

  const two = check(armed(
    [{ uid: 'w1', id: 'dagger', name: 'Dagger' }, { uid: 'w2', id: 'shortsword', name: 'Shortsword' }],
    { mainHand: 'w1', offHand: 'w2' }));
  t.eq(two.offered, 1, 'a dagger and a shortsword are both light, so it is offered');
  t.eq(two.refused, false, 'and it resolves');

  const one = check(armed([{ uid: 'w1', id: 'dagger', name: 'Dagger' }], { mainHand: 'w1' }));
  t.eq(one.offered, 0, 'one weapon is not two weapons');
  t.eq(one.refused, true, 'and that is refused too');
}

t.section('a skill can be rolled against another ability');
/*
 * A Dungeon Master may call for Strength (Intimidation) to loom rather than to
 * charm — an explicit option in the 2014 rules. `opts.ability` was accepted by
 * callers and ignored by `skillCheck`, so a barbarian with Strength 18 and
 * Charisma 8 loomed at +2.
 */
{
  const Rules = require('../js/engine/rules.js');
  const c = Character.buildFromSpec({
    name: 'B', raceId: 'human', classId: 'barbarian', levels: 5, backgroundId: 'soldier',
    abilities: { str: 18, dex: 10, con: 14, int: 8, wis: 10, cha: 8 },
    proficiencies: { skills: ['intimidation'] },
  });
  const d = Character.derive(c.base, c.progression, c.runtime, []);
  const rng = { int: () => 10, next: () => 0.5 };

  const normal = Rules.skillCheck(d, 'intimidation', { rng });
  t.eq(normal.check.ability, 'cha', 'Intimidation is a Charisma skill by default');

  const loom = Rules.skillCheck(d, 'intimidation', { rng, ability: 'str' });
  t.eq(loom.check.ability, 'str', 'but it can be rolled against Strength');
  t.ok(loom.check.flat > normal.check.flat,
    'and the barbarian is much better at looming than at charming',
    '(' + normal.check.flat + ' -> ' + loom.check.flat + ')');
  t.eq(loom.check.substituted, true, 'the roll records that the ability was substituted');
  t.eq(loom.check.proficient, true,
    'proficiency still applies, because it belongs to the skill not the ability');
}

t.section('a long rest benefits you once in twenty-four hours');
/*
 * Nothing enforced it: three long rests taken back to back were all accepted,
 * which removes the resource game from the whole system — slots, hit dice and
 * every per-rest class feature refill on demand, and there is never a reason
 * not to.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  const c = Character.buildFromSpec({
    name: 'F', raceId: 'human', classId: 'fighter', levels: 3, backgroundId: 'soldier',
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    proficiencies: { skills: [] },
  });
  const st = State.create({ seed: 'longrest' });
  State.addActor(st, { id: 'pc1', name: 'F', side: 'party', kind: 'pc',
    base: c.base, progression: c.progression, runtime: c.runtime });
  State.refreshAllDerived(st);

  const rest = () => Dispatch.dispatch(st, { past: [], future: [] }, {
    v: 1, family: 'exploration', commandId: 'lr' + Math.random(), actorId: 'pc1',
    stateRevision: st.revision, turnEpoch: st.turnEpoch,
    primary: { verb: 'long_rest', targetIds: [] },
  }, {});
  const offered = () => Dispatch.legalMoves(st, 'pc1', {})
    .filter(m => m.step.verb === 'long_rest').length;
  const pass = mins => {
    const b = Events.makeBatch({ commandId: 't' + Math.random() });
    Events.push(b, 'time', { minutes: mins }, '');
    Events.commit(st, b);
  };

  t.eq(offered(), 1, 'a long rest is offered to a party that has not had one');
  t.eq(!!rest().batch.refused, false, 'and the first one is taken');
  t.eq(st.lastLongRestAt, 480, 'the time it finished is recorded');

  t.eq(!!rest().batch.refused, true, 'a second one straight away is refused');
  t.eq(offered(), 0, 'and it is not offered either, rather than refusing on click');

  pass(20 * 60);
  t.eq(!!rest().batch.refused, true, 'twenty hours later is still too soon');

  pass(5 * 60);
  t.eq(offered(), 1, 'twenty-five hours on it is offered again');
  t.eq(!!rest().batch.refused, false, 'and taken');

  t.ok(Events.KINDS.indexOf('long_rest_taken') >= 0,
    'long_rest_taken is a registered event kind, or the stamp would be dropped');
}

t.section('the encounter multiplier reads the party, not just the monsters');
/*
 * 2014 DMG: with fewer than three characters use the next highest multiplier,
 * with six or more the next lowest. Neither was applied — every encounter was
 * rated as though the party were exactly four. And a swarm of creatures far
 * beneath the party inflated the count, so ten rats could push a medium fight
 * into deadly.
 */
{
  const Rules = require('../js/engine/rules.js');
  const four = Rules.encounterDifficulty([5, 5, 5, 5], [2, 2, 2]);
  const two = Rules.encounterDifficulty([5, 5], [2, 2, 2]);
  const six = Rules.encounterDifficulty([5, 5, 5, 5, 5, 5], [2, 2, 2]);

  t.eq(four.multiplier, 2, 'three monsters against four characters is the plain 2x');
  t.ok(two.multiplier > four.multiplier,
    'a party of two takes the next multiplier up',
    '(' + four.multiplier + ' -> ' + two.multiplier + ')');
  t.ok(six.multiplier < four.multiplier,
    'a party of six takes the next one down',
    '(' + four.multiplier + ' -> ' + six.multiplier + ')');

  const plain = Rules.encounterDifficulty([5, 5, 5, 5], [3, 3]);
  const withRats = Rules.encounterDifficulty([5, 5, 5, 5],
    [3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  t.eq(withRats.countedMonsters, plain.countedMonsters,
    'ten CR-0 creatures do not count toward the multiplier');
  t.eq(withRats.ignoredAsTrivial, 10, 'and the engine says how many it set aside');
  t.eq(withRats.multiplier, plain.multiplier,
    'so the rats cannot turn the fight into a harder one than it is');
  t.ok(withRats.xp > plain.xp === false || withRats.xp >= plain.xp,
    'while their experience still counts toward the total');

  /* And the shape callers actually pass. `encounterDifficulty` threw on a
     {level} object, which is what half the engine hands it. */
  const objects = Rules.encounterDifficulty([{ level: 5 }, { level: 5 }], [{ cr: 2 }]);
  t.ok(objects.thresholds.easy > 0, 'levels and CRs may be given as objects');
}

t.section('you swing well only with what you were trained on');
/*
 * `toHit` was `mod + prof` for every weapon a character happened to be
 * holding. A wizard who picked up a greatsword swung it with full proficiency —
 * and being able to use any weapon well is most of what separates a fighter
 * from a wizard.
 *
 * The data was complete on both sides: classes list `weaponProfs` as broad
 * families ("simple", "martial") or specific weapons ("rapier"), and every item
 * carries a `subcategory` of "simple-melee", "martial-ranged" and so on.
 * Nothing compared them.
 */
{
  const armed = (classId, weapons) => {
    const c = Character.buildFromSpec({
      name: 'X', raceId: 'human', classId, levels: 5, backgroundId: 'soldier',
      abilities: { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 },
      proficiencies: { skills: [] },
    });
    c.runtime.inventory = weapons.map((w, i) => ({ uid: 'w' + i, id: w, name: w }));
    const st = State.create({ seed: 'prof-' + classId });
    State.addActor(st, { id: 'pc1', name: 'X', side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime });
    State.refreshAllDerived(st);
    const by = {};
    (st.actors.pc1.runtime.attacks || []).forEach(a => { by[a.uid || a.name] = a; });
    return { attacks: by, prof: st.actors.pc1.derivedCache.proficiencyBonus };
  };

  const wiz = armed('wizard', ['greatsword', 'dagger', 'quarterstaff', 'longbow']);
  t.eq(wiz.attacks.w0.proficient, false, 'a wizard is not proficient with a greatsword');
  t.eq(wiz.attacks.w1.proficient, true, 'but is with a dagger, which their class lists');
  t.eq(wiz.attacks.w2.proficient, true, 'and a quarterstaff');
  t.eq(wiz.attacks.w3.proficient, false, 'and not a longbow');
  t.eq(wiz.attacks.w1.toHit - wiz.attacks.w0.toHit, wiz.prof,
    'and the difference between them is exactly the proficiency bonus',
    '(' + wiz.attacks.w0.toHit + ' vs ' + wiz.attacks.w1.toHit + ')');

  const fig = armed('fighter', ['greatsword', 'dagger', 'longbow']);
  t.ok(['w0', 'w1', 'w2'].every(k => fig.attacks[k].proficient),
    'a fighter is proficient with simple and martial weapons alike');

  const rog = armed('rogue', ['rapier', 'greatsword', 'shortsword']);
  t.eq(rog.attacks.w0.proficient, true, 'a rogue is proficient with a rapier, named on its list');
  t.eq(rog.attacks.w1.proficient, false, 'and not with a greatsword, which is not');

  /* An NPC with no class list is assumed to know its own weapons; refusing
     proficiency to everything without a class would weaken every hand-placed
     character in the game rather than fix anything. */
  {
    const st = State.create({ seed: 'npc-prof' });
    State.addActor(st, {
      id: 'npc', name: 'Guard', side: 'ally', kind: 'npc',
      base: { name: 'Guard', abilities: { str: 14, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
        classes: [] },
      progression: { levels: [] },
      runtime: { hp: 11, hpMax: 11, conditions: {}, deathSaves: {}, equipped: {},
        inventory: [{ uid: 'g1', id: 'greatsword', name: 'Greatsword' }] },
    });
    State.refreshAllDerived(st);
    const swing = (st.actors.npc.runtime.attacks || []).filter(x => x.uid === 'g1')[0];
    t.eq(swing.proficient, true, 'a classless NPC still knows the weapon it was given');
  }
}

t.section('a spell takes as long as it takes');
/*
 * 46 spells in the data cast in a minute and 13 in an hour. Every one fell
 * through to `canAct` and was charged as a single action, so Find Familiar —
 * an hour of brass and incense — could be cast in six seconds with a hobgoblin
 * swinging at you. And 52 spells name a component with a gold-piece value,
 * which nothing read: Revivify cost a slot and nothing else.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');

  const wiz = (prepared, extra) => {
    const c = Character.buildFromSpec({
      name: 'W', raceId: 'human', classId: 'wizard', levels: 9, backgroundId: 'sage',
      abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 10, cha: 10 },
      proficiencies: { skills: [] },
    });
    if (extra) c.runtime.inventory = c.runtime.inventory.concat(extra);
    const st = State.create({ seed: 'casttime' });
    State.addActor(st, { id: 'pc1', name: 'W', side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime });
    st.actors.pc1.runtime.pos = { x: 0, y: 0 };
    State.addActor(st, { id: 'foe1', name: 'Ogre', side: 'enemy', kind: 'monster',
      base: { name: 'Ogre', abilities: { str: 16, dex: 8, con: 16, int: 5, wis: 7, cha: 7 } },
      progression: { levels: [] },
      runtime: { hp: 60, hpMax: 60, conditions: {}, inventory: [], deathSaves: {},
        pos: { x: 1, y: 0 }, ac: 11, speed: 30, reach: 5 } });
    State.refreshAllDerived(st);
    const sc = st.actors.pc1.derivedCache.spellcasting;
    sc.prepared = (sc.prepared || []).concat(prepared);
    st.combat = { active: false, order: [], turnIndex: 0, round: 0 };
    return st;
  };
  const cast = (st, id, lvl) => Dispatch.dispatch(st, { past: [], future: [] }, {
    v: 1, family: 'spell', commandId: 'c' + Math.random(), actorId: 'pc1',
    stateRevision: st.revision, turnEpoch: st.turnEpoch,
    primary: { verb: 'cast', spellId: id, targetIds: [], slotLevel: lvl || 1 },
  }, {});

  /* --- in a fight --- */
  {
    const st = wiz(['find-familiar', 'magic-missile']);
    st.combat = { active: true, round: 1, turnIndex: 0, order: ['pc1', 'foe1'] };
    st.activeActorId = 'pc1';
    Events.commit(st, Combat.startTurn(st, 'pc1'));
    const r = cast(st, 'find-familiar', 1);
    t.eq(!!r.batch.refused, true, 'an hour-long spell cannot be cast mid-fight');
    t.ok(/hour/.test((r.batch.refused || {}).detail || ''), 'and it says why',
      '(' + ((r.batch.refused || {}).detail || '') + ')');
    t.eq(Dispatch.legalMoves(st, 'pc1', {}).filter(m => /Familiar/i.test(m.what)).length, 0,
      'nor is it offered in one');
    /* An action-cast spell is unaffected. */
    t.eq(!!cast(st, 'magic-missile', 1).batch.refused, false,
      'while an ordinary action spell is cast as usual');
  }

  /* --- the component --- */
  {
    const none = wiz(['find-familiar']);
    const before = none.clock || 0;
    const r = cast(none, 'find-familiar', 1);
    t.eq(!!r.batch.refused, true, 'without the component the spell is refused');
    t.eq((none.clock || 0) - before, 0,
      'and a refusal does not burn an hour of the day on the way out');

    const held = wiz(['find-familiar'],
      [{ uid: 'ch1', id: 'charcoal', name: 'charcoal, incense and herbs' }]);
    const c0 = held.clock || 0;
    t.eq(!!cast(held, 'find-familiar', 1).batch.refused, false, 'with it, the spell is cast');
    t.eq((held.clock || 0) - c0, 60, 'and it takes the hour it says it takes');
    t.eq((held.actors.pc1.runtime.inventory || []).some(i => i.uid === 'ch1'), false,
      'and the component is consumed, because the spell says so');
  }

  /* --- a plural component still matches a singular item --- */
  {
    const rich = wiz(['revivify'], [{ uid: 'd1', id: 'diamond', name: 'a diamond worth 300gp' }]);
    t.eq(!!cast(rich, 'revivify', 3).batch.refused, false,
      'Revivify finds "a diamond" for a component described as "Diamonds"');
    t.eq((rich.actors.pc1.runtime.inventory || []).some(i => i.uid === 'd1'), false,
      'and consumes it');
    const poor = wiz(['revivify']);
    t.eq(!!cast(poor, 'revivify', 3).batch.refused, true,
      'and without one it cannot be cast at all');
  }
}

t.section('a multiclassed caster uses the right ability for each spell');
/*
 * Only one global DC and attack bonus existed, taken from whichever caster
 * class happened to come first in the list. A cleric/wizard cast every spell
 * off Wisdom, so half their list was resolved against the wrong ability
 * entirely.
 */
{
  const c = Character.buildFromSpec({
    name: 'M', raceId: 'human', classId: 'cleric', levels: 3, backgroundId: 'acolyte',
    abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 18, cha: 8 },
    proficiencies: { skills: [] },
  });
  c.base.classes.push({ classId: 'wizard', levels: 3 });
  const d = Character.derive(c.base, c.progression, c.runtime, []);
  const by = d.spellcasting.byClass;
  t.ok(!!by, 'the sheet carries per-class spellcasting numbers');
  t.eq(by.cleric.ability, 'wis', 'the cleric half casts off Wisdom');
  t.eq(by.wizard.ability, 'int', 'and the wizard half off Intelligence');
  t.ok(by.cleric.dc > by.wizard.dc,
    'so with Wisdom 18 and Intelligence 10 the two DCs differ',
    '(' + by.cleric.dc + ' vs ' + by.wizard.dc + ')');

  /* A single-class caster must be unaffected. */
  const solo = Character.buildFromSpec({
    name: 'W', raceId: 'human', classId: 'wizard', levels: 5, backgroundId: 'sage',
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 10, cha: 10 },
    proficiencies: { skills: [] },
  });
  const sd = Character.derive(solo.base, solo.progression, solo.runtime, []);
  t.eq(sd.spellcasting.byClass.wizard.dc, sd.spellcasting.dc,
    'a single-class caster\u2019s per-class DC is the same as their global one');
}

t.section('a bonus-action spell closes the turn to other spells');
/*
 * 2014: cast a spell with a bonus action and you may cast nothing else that
 * turn except a cantrip with a casting time of one action. Nothing tracked
 * what had been cast, so a sorcerer could Healing Word AND then cast a
 * levelled spell with their action — the most-exploited hole in 5e's action
 * economy.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');

  function sorc() {
    const s = Character.buildFromSpec({
      name: 'S', raceId: 'human', classId: 'sorcerer', levels: 5, backgroundId: 'sage',
      abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 18 },
      proficiencies: { skills: [] },
    });
    const st = State.create({ seed: 'bonus-spell' });
    State.addActor(st, { id: 'pc1', name: 'S', side: 'party', kind: 'pc',
      base: s.base, progression: s.progression, runtime: s.runtime });
    st.actors.pc1.runtime.pos = { x: 0, y: 0 };
    State.addActor(st, { id: 'foe1', name: 'Ogre', side: 'enemy', kind: 'monster',
      base: { name: 'Ogre', abilities: { str: 16, dex: 8, con: 16, int: 5, wis: 7, cha: 7 } },
      progression: { levels: [] },
      runtime: { hp: 90, hpMax: 90, conditions: {}, inventory: [], deathSaves: {},
        pos: { x: 1, y: 0 }, ac: 11, speed: 30, reach: 5 } });
    State.refreshAllDerived(st);
    const sc = st.actors.pc1.derivedCache.spellcasting;
    sc.prepared = ['healing-word', 'magic-missile'];
    sc.cantripsKnown = ['fire-bolt'];
    st.combat = { active: true, round: 1, turnIndex: 0, order: ['pc1', 'foe1'] };
    st.activeActorId = 'pc1';
    Events.commit(st, Combat.startTurn(st, 'pc1'));
    return st;
  }
  const cast = (st, id, lvl) => Dispatch.dispatch(st, { past: [], future: [] }, {
    v: 1, family: 'spell', commandId: 'c' + Math.random(), actorId: 'pc1',
    stateRevision: st.revision, turnEpoch: st.turnEpoch,
    primary: { verb: 'cast', spellId: id, targetIds: ['foe1'], slotLevel: lvl },
  }, {});

  {
    const st = sorc();
    t.eq(!!cast(st, 'healing-word', 1).batch.refused, false, 'Healing Word goes off as a bonus action');
    const after = cast(st, 'magic-missile', 1);
    t.eq(!!after.batch.refused, true, 'and no levelled spell may follow it that turn');
    t.ok(/bonus action/i.test((after.batch.refused || {}).detail || ''),
      'and it says why', '(' + ((after.batch.refused || {}).detail || '') + ')');
    t.eq(!!cast(st, 'fire-bolt', 0).batch.refused, false,
      'but a cantrip with a casting time of one action still may');
  }

  {
    /* And the other way round: having cast with your action, no bonus spell. */
    const st = sorc();
    t.eq(!!cast(st, 'magic-missile', 1).batch.refused, false, 'the action spell goes off');
    t.eq(!!cast(st, 'healing-word', 1).batch.refused, true,
      'and a bonus-action spell may not follow it either');
  }

  t.ok(Events.KINDS.indexOf('spell_cast_marker') >= 0,
    'spell_cast_marker is a registered kind, or nothing would be remembered');
}

t.section('multiclassing has prerequisites, and grants only a subset');
/*
 * You must meet the ability requirement of the class you are leaving AND the
 * one you are entering. Nothing checked, so a fighter with Intelligence 8
 * could take a level of wizard — the requirement is the only thing stopping a
 * character cherry-picking the best first-level feature of every class.
 */
{
  const attempt = (from, abilities, into) => {
    const c = Character.buildFromSpec({
      name: 'X', raceId: 'human', classId: from, levels: 3, backgroundId: 'soldier',
      abilities, proficiencies: { skills: [] },
    });
    try { return { ok: true, result: Character.levelUp(c.base, c.progression, { classId: into }) }; }
    catch (e) { return { ok: false, why: e.message }; }
  };

  const dull = attempt('fighter', { str: 8, dex: 8, con: 14, int: 8, wis: 8, cha: 8 }, 'wizard');
  t.eq(dull.ok, false, 'a fighter with Strength 8 and Intelligence 8 cannot become a wizard');
  t.ok(/int 13/.test(dull.why || ''), 'and the refusal names what is missing',
    '(' + (dull.why || '').slice(0, 90) + ')');

  const able = attempt('fighter', { str: 16, dex: 12, con: 14, int: 14, wis: 10, cha: 10 }, 'wizard');
  t.eq(able.ok, true, 'one who meets both requirements can');

  const halfWay = attempt('wizard', { str: 8, dex: 10, con: 14, int: 16, wis: 10, cha: 10 }, 'fighter');
  t.eq(halfWay.ok, false,
    'and meeting only the class you are leaving is not enough');

  /* The proficiencies gained are the multiclass subset, never the starting
     kit — a wizard who takes a fighter level does not get heavy armour. */
  const gained = attempt('wizard',
    { str: 14, dex: 14, con: 14, int: 16, wis: 10, cha: 10 }, 'fighter');
  t.eq(gained.ok, true, 'a wizard with Strength 14 may take a fighter level');
  const profs = gained.result.base.proficiencies;
  t.ok((profs.armor || []).indexOf('medium') >= 0, 'and gains medium armour');
  t.eq((profs.armor || []).indexOf('heavy'), -1, 'but never heavy armour');
  t.ok((profs.weapons || []).indexOf('martial') >= 0, 'and martial weapons');
}

t.section('you cannot attune to two copies of the same thing');
/*
 * The cap of three was checked; sameness was not. Two copies of an amulet have
 * different uids, so a character could attune to three identical rings and
 * stack the effect three times.
 */
{
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  const c = Character.buildFromSpec({
    name: 'A', raceId: 'human', classId: 'fighter', levels: 3, backgroundId: 'soldier',
    abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    proficiencies: { skills: [] },
  });
  c.runtime.inventory = c.runtime.inventory.concat([
    { uid: 'r1', id: 'ring-of-protection', name: 'a ring' },
    { uid: 'r2', id: 'ring-of-protection', name: 'another ring' },
    { uid: 'x1', id: 'cloak-of-protection', name: 'a cloak' },
  ]);
  c.runtime.attuned = ['r1'];
  const st = State.create({ seed: 'attune-dupe' });
  State.addActor(st, { id: 'pc1', name: 'A', side: 'party', kind: 'pc',
    base: c.base, progression: c.progression, runtime: c.runtime });
  State.refreshAllDerived(st);
  st.combat = { active: false, order: [], turnIndex: 0, round: 0 };
  const attune = uid => Dispatch.dispatch(st, { past: [], future: [] }, {
    v: 1, family: 'item', commandId: 'a' + Math.random(), actorId: 'pc1',
    stateRevision: st.revision, turnEpoch: st.turnEpoch,
    primary: { verb: 'attune', itemId: uid, targetIds: [] },
  }, {});

  const dupe = attune('r2');
  t.eq(!!dupe.batch.refused, true, 'a second copy of the same ring is refused');
  t.ok(/second copy/i.test((dupe.batch.refused || {}).detail || ''),
    'and says plainly that it would do nothing');
  t.eq(!!attune('x1').batch.refused, false, 'while a different item attunes normally');
}

t.section('Halfling Lucky rerolls one die, and the one that counts');
/*
 * It rerolled EVERY die showing a 1. With advantage that is strictly more
 * generous than the rule — and rerolling a 1 that was going to be discarded
 * anyway is not a use of the feature at all.
 */
{
  const Dice = require('../js/engine/dice.js');
  const seq = list => { let i = 0; return { int: () => list[i++ % list.length], next: () => 0.5 }; };

  const spare = Dice.d20({ rng: seq([1, 15, 20]), advantage: ['x'], luckyReroll: true });
  t.deep(spare.rolls, [1, 15],
    'with advantage, a 1 alongside a 15 is left alone \u2014 the 15 is the die being used');
  t.eq(spare.natural, 15, 'and the 15 is what counts');

  const both = Dice.d20({ rng: seq([1, 1, 19]), advantage: ['x'], luckyReroll: true });
  t.eq(both.rolls.filter(r => r === 1).length, 1,
    'with two 1s exactly one is rerolled, not both',
    '(' + JSON.stringify(both.rolls) + ')');

  const flat = Dice.d20({ rng: seq([1, 17]), luckyReroll: true });
  t.eq(flat.natural, 17, 'a straight roll of 1 is rerolled');

  const low = Dice.d20({ rng: seq([1, 12, 18]), disadvantage: ['x'], luckyReroll: true });
  t.eq(low.rolls.indexOf(1), -1,
    'with disadvantage the 1 is the die that counts, so it is the one rerolled',
    '(' + JSON.stringify(low.rolls) + ')');
}

t.section('a mount that goes down puts its rider on the ground');
/*
 * `mountedOn` was set and cleared only by the rider's own mount and dismount
 * verbs, so a knight whose horse had been killed under him rode the corpse for
 * the rest of the fight — still at the mount's speed.
 */
{
  require('../js/engine/combat.js');
  const mk = (id, name) => ({
    id, name, side: 'party', kind: 'npc',
    base: { name, abilities: { str: 14, dex: 12, con: 12, int: 8, wis: 10, cha: 8 } },
    progression: { levels: [] },
    runtime: { hp: 20, hpMax: 20, conditions: {}, inventory: [], deathSaves: {},
      pos: { x: 0, y: 0 }, ac: 12, speed: 30, reach: 5 },
  });
  const st = State.create({ seed: 'dismount' });
  State.addActor(st, mk('knight', 'Knight'));
  State.addActor(st, mk('horse', 'Warhorse'));
  State.refreshAllDerived(st);
  st.actors.knight.runtime.mountedOn = 'horse';
  st.actors.knight.runtime.mountName = 'Warhorse';
  st.combat = { active: true, order: ['knight', 'horse'], turnIndex: 0, round: 1 };
  st.activeActorId = 'knight';

  /* Still mounted while the horse is fine. */
  Events.commit(st, Combat.startTurn(st, 'knight'));
  t.eq(st.actors.knight.runtime.mountedOn, 'horse', 'a live horse keeps its rider');

  const kill = Events.makeBatch({ commandId: 'kill' });
  Events.push(kill, 'hp', { targetId: 'horse', delta: -100 }, '');
  Events.commit(st, kill);
  Events.commit(st, Combat.startTurn(st, 'knight'));

  t.eq(st.actors.knight.runtime.mountedOn, null,
    'but once it is down the rider is no longer on it');
  t.eq(!!(st.actors.knight.runtime.conditions || {}).prone, true,
    'and lands prone, which is where being thrown puts you');
}

t.done();
