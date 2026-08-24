/*
 * tests/progression.test.js — earning a level by playing.
 *
 * Everything here goes through the real dispatcher and the real event log,
 * because the bugs this suite exists to catch were all invisible to unit
 * tests of the parts:
 *
 *   - `xpForCr` existed and nothing ever called it, so no character could
 *     level up by playing at all
 *   - `pendingLevel` said "level 1 is due" for anything with no class, so
 *     every gnoll on the board levelled up
 *   - monsters fell unconscious and rolled death saves instead of dying, so
 *     fights never ended and experience arrived rounds late
 */
'use strict';
const t = require('./_harness')('progression');
const { RNG } = require('../js/rng.js');
const State = require('../js/engine/state.js');
const Events = require('../js/engine/events.js');
const Dispatch = require('../js/engine/dispatch.js');
const Combat = require('../js/engine/combat.js');
const Rules = require('../js/engine/rules.js');
const LevelUp = require('../js/engine/levelup.js');
require('../js/engine/interaction.js');

function pc(id, name, hp) {
  return {
    id, name, side: 'party', kind: 'pc',
    base: {
      name, raceId: 'human', classes: [{ classId: 'fighter', levels: 3 }],
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
      proficiencies: { skills: [], saves: [] },
    },
    progression: {
      xp: 0,
      levels: [1, 2, 3].map(l => ({ level: l, classId: 'fighter', hpGained: l === 1 ? 10 : 6, choice: 'average' })),
    },
    runtime: {
      hp, hpMax: hp, tempHp: 0, conditions: {}, exhaustion: 0, concentratingOn: null,
      attuned: [], equipped: {}, inventory: [{ uid: 'w', id: 'longsword', name: 'Longsword' }],
      deathSaves: { successes: 0, failures: 0 }, resources: {}, gold: 0, pos: { x: 1, y: 1 },
    },
  };
}

function monster(id, name, hp, cr) {
  return {
    id, name, side: 'enemy', kind: 'monster', cr,
    base: {
      name, abilities: { str: 14, dex: 12, con: 12, int: 6, wis: 10, cha: 7 },
      proficiencies: { skills: [], saves: [] }, classes: [],
    },
    progression: { xp: 0, levels: [] },
    runtime: {
      hp, hpMax: hp, tempHp: 0, conditions: {}, exhaustion: 0, concentratingOn: null,
      attuned: [], equipped: {}, inventory: [], deathSaves: { successes: 0, failures: 0 },
      resources: {}, gold: 0, pos: { x: 3, y: 1 }, attacksAuthored: true,
      attacks: [{ name: 'Bite', toHit: 4, damage: '1d6+2', damageType: 'piercing', abilityMod: 2 }],
    },
  };
}

function arena(opts) {
  opts = opts || {};
  const st = State.create({ seed: opts.seed || 'prog' });
  st.meta.deathPolicy = opts.policy || 'standard';
  State.addActor(st, pc('p1', 'Vess', 40));
  if (opts.two) State.addActor(st, pc('p2', 'Bram', 40));
  State.addActor(st, monster('m1', 'Ogre', opts.mhp == null ? 5 : opts.mhp, opts.cr == null ? 2 : opts.cr));
  State.addSeat(st, { id: 's1', name: 'S1', actorId: 'p1', control: 'human' });
  State.refreshAllDerived(st);
  return st;
}

/* ------------------------------------------------------- monsters die ----- */
t.section('a monster dies at zero hit points');
{
  const st = arena();
  const r = Combat.damageEvents(st, 'm1', 20, {});
  t.eq(r.dead, true, 'reducing a monster to 0 kills it outright');
  t.eq(r.beats.some(b => /drops\.$/.test(b)), false,
    'it does not merely "drop" and start rolling death saves');

  const batch = Events.makeBatch({ commandId: 'kill', actorId: 'p1' });
  r.events.forEach(e => batch.events.push(e));
  batch.beats = r.beats;
  Events.commit(st, batch);
  t.eq(st.actors.m1.runtime.dead, true, 'and it is dead in the state');
  t.deep(Dispatch.legalMoves(st, 'm1', {}), [], 'a dead monster has no moves');
}

t.section('a player character does NOT die at zero \u2014 they go down');
{
  const st = arena();
  /* Exactly enough to reach zero. More than this and the massive-damage rule
     applies, which is a different (and correct) outcome. */
  const exact = st.actors.p1.runtime.hp;
  const r = Combat.damageEvents(st, 'p1', exact, {});
  const batch = Events.makeBatch({ commandId: 'down', actorId: 'm1' });
  r.events.forEach(e => batch.events.push(e));
  Events.commit(st, batch);
  t.eq(st.actors.p1.runtime.hp, 0, 'they are at zero');
  t.eq(!!st.actors.p1.runtime.dead, false, 'but not dead');
  t.eq(Combat.diesAtZero(st.actors.p1), false, 'the engine knows they roll saves instead');
  t.eq(Combat.diesAtZero(st.actors.m1), true, 'and that the monster does not');
}

t.section('massive damage still kills a player character outright');
{
  const st = arena();
  const hpMax = st.actors.p1.runtime.hpMax;
  const r = Combat.damageEvents(st, 'p1', st.actors.p1.runtime.hp + hpMax, {});
  t.eq(r.dead, true,
    'overflow past zero equal to the maximum is instant death, with no saves');
  t.ok(r.beats.some(b => /dies|killed|destroyed|outright/i.test(b)),
    'and the log says what happened', '(' + r.beats[0] + ')');
  t.eq(r.beats.some(b => /drops\.$/.test(b)), false,
    'with no "drops" and no death saves in between');
}

t.section('a named NPC can be marked to roll saves like a character');
{
  const st = arena();
  st.actors.m1.important = true;
  st.actors.m1.alwaysDeathSaves = true;
  t.eq(Combat.diesAtZero(st.actors.m1), false,
    'a campaign can mark a death worth playing out');
}

/* ------------------------------------------------------------- the xp ----- */
t.section('killing something awards experience');
{
  const st = arena({ two: true });
  const before = st.actors.p1.progression.xp;
  const r = Combat.damageEvents(st, 'm1', 20, {});
  const batch = Events.makeBatch({ commandId: 'k', actorId: 'p1' });
  r.events.forEach(e => batch.events.push(e));
  batch.beats = r.beats;
  Events.commit(st, batch);

  const expected = Math.floor(Rules.xpForCr(2) / 2);
  t.eq(st.actors.p1.progression.xp, before + expected,
    'experience is split among the party', '(' + expected + ' each from ' + Rules.xpForCr(2) + ')');
  t.eq(st.actors.p2.progression.xp, expected, 'both members receive their share');
  t.ok(r.beats.some(b => /experience each/.test(b)),
    'and the log says so', '(' + r.beats.filter(b => /experience/.test(b))[0] + ')');
}

t.section('the party does not resurrect its enemies');
{
  const st = arena();
  const r = Combat.damageEvents(st, 'm1', 20, {});
  t.eq(r.beats.some(b => /Revivify/.test(b)), false,
    'no resurrection window is offered for a monster');

  const party = arena();
  party.actors.p1.runtime.hp = 1;
  const dead = require('../js/engine/mortality.js').resolveLethal(party, 'p1', {});
  t.ok(dead.beats.some(b => /Revivify/.test(b)),
    'but it IS offered when a party member dies');
}

t.section('experience is not awarded for killing your own side');
{
  const st = arena();
  st.actors.m1.side = 'party';
  const r = Combat.damageEvents(st, 'm1', 20, {});
  t.eq(r.beats.some(b => /experience/.test(b)), false,
    'a friendly-fire kill awards nothing');
}

/* --------------------------------------------------- monsters do not level */
t.section('monsters never level up');
{
  const st = arena();
  const m = st.actors.m1;
  t.eq(LevelUp.pendingLevel(m.base, m.progression), null,
    'a creature with no class has no level pending, however much experience it has');
  m.progression.xp = 999999;
  t.eq(LevelUp.pendingLevel(m.base, m.progression), null,
    'and that stays true at any amount');
}

t.section('a character built at level 3 is not immediately owed level 1');
{
  const st = arena();
  const c = st.actors.p1;
  t.eq(LevelUp.pendingLevel(c.base, c.progression), null,
    'zero experience owes nothing');
  const bare = { base: { classes: [{ classId: 'fighter', levels: 3 }] }, progression: { xp: 0, levels: [] } };
  t.eq(LevelUp.pendingLevel(bare.base, bare.progression), null,
    'and a character with declared class levels but no level log is not owed one either');
}

/* ------------------------------------------------ kill your way to level 4 */
t.section('a party can earn a level by fighting');
{
  const st = arena({ two: true, seed: 'grind' });
  const history = State.makeHistory();
  let kills = 0;

  /* Repeatedly spawn an ogre and kill it, exactly as combat would. */
  for (let i = 0; i < 14; i++) {
    const id = 'ogre' + i;
    State.addActor(st, monster(id, 'Ogre ' + i, 5, 2));
    State.refreshDerived(st, id);
    const r = Combat.damageEvents(st, id, 30, {});
    const batch = Events.makeBatch({ commandId: 'k' + i, actorId: 'p1' });
    r.events.forEach(e => batch.events.push(e));
    batch.beats = r.beats;
    Events.commit(st, batch);
    kills++;
    if (LevelUp.pendingLevel(st.actors.p1.base, st.actors.p1.progression)) break;
  }

  const pending = LevelUp.pendingLevel(st.actors.p1.base, st.actors.p1.progression);
  t.ok(!!pending, 'enough kills eventually earns a level',
    '(' + kills + ' ogres, ' + st.actors.p1.progression.xp + ' xp)');
  t.eq(pending && pending.to, 4, 'and it is level 4 that is owed');

  /* Take it, the way an AI seat would. */
  const options = LevelUp.optionsFor(st.actors.p1.base, st.actors.p1.progression, { classId: 'fighter' });
  const choices = LevelUp.autoChoose(st.actors.p1.base, st.actors.p1.progression, options, { rng: new RNG('lv') });
  const applied = LevelUp.applyLevel(st.actors.p1.base, st.actors.p1.progression, options, choices,
    { rng: new RNG('lv'), actorId: 'p1', actorName: 'Vess' });
  t.eq(applied.ok, true, 'the level applies');

  const hpBefore = st.actors.p1.runtime.hpMax;
  State.checkpoint(history, st, 'levelup');
  const batch = Events.makeBatch({ commandId: 'lvl', actorId: 'p1' });
  applied.events.forEach(e => batch.events.push(e));
  batch.beats = applied.beats;
  Events.commit(st, batch);

  t.eq(LevelUp.totalLevel(st.actors.p1.progression), 4, 'the character is level 4');
  t.ok(st.actors.p1.runtime.hpMax > hpBefore, 'with more hit points',
    '(' + hpBefore + ' -> ' + st.actors.p1.runtime.hpMax + ')');
  t.eq(st.actors.p1.base.classes[0].levels, 4, 'and the class level moved with it');
  t.eq(st.actors.p1.derivedCache.abilities.str, 18,
    'the ability improvement reached the derived sheet');

  State.undo(history, st);
  t.eq(LevelUp.totalLevel(st.actors.p1.progression), 3, 'and undo takes the level back');
  t.eq(st.actors.p1.runtime.hpMax, hpBefore, 'along with the hit points');
}

t.section('experience survives a save and reload');
{
  const Save = require('../js/engine/save.js');
  const Game = require('../js/game.js');
  const st = arena({ two: true, seed: 'persist' });
  const r = Combat.damageEvents(st, 'm1', 20, {});
  const batch = Events.makeBatch({ commandId: 'k', actorId: 'p1' });
  r.events.forEach(e => batch.events.push(e));
  Events.commit(st, batch);
  const xp = st.actors.p1.progression.xp;
  t.ok(xp > 0, 'experience was earned');

  const session = { state: st, store: { facts: {}, known: {} }, campaign: { title: 'T' }, recentNarration: [], pinned: [], summaries: [] };
  const blob = JSON.parse(JSON.stringify(Save.serialize(session, {})));
  const loaded = Save.deserialize(blob, {});
  t.eq(loaded.state.actors.p1.progression.xp, xp, 'and it survives a save/load round trip');
}

t.done();
