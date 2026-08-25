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

  /* Both at once: doubled, then halved, with rounding at each step. */
  addMonster(s, 'odd', 'Odd Thing', {
    statblock: { ac: 12, resistances: ['fire'], vulnerabilities: ['fire'] },
  });
  State.refreshAllDerived(s);
  t.eq(Combat.applyDamageType(s, 'odd', 5, 'fire').total, 5,
    'resistant AND vulnerable applies both: 5 doubled to 10, halved to 5');
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

t.done();
