/*
 * tests/mortality.test.js — dying, death, and what a campaign does about it.
 *
 * The rules half is the 5e death rules as written. The policy half is the
 * table's choice, and the point of these tests is that the choice is actually
 * enforced: a heroic campaign must not be able to kill a player character by
 * accident, and an ironman campaign must genuinely stop.
 */
'use strict';
const t = require('./_harness')('mortality');
const { RNG } = require('../js/rng.js');
const State = require('../js/engine/state.js');
const Events = require('../js/engine/events.js');
const Combat = require('../js/engine/combat.js');
const Rules = require('../js/engine/rules.js');
const Dispatch = require('../js/engine/dispatch.js');
const Mortality = require('../js/engine/mortality.js');
require('../js/engine/interaction.js');

function actorFixture(id, name, side, hp, extra) {
  return Object.assign({
    id, name, side,
    base: {
      name, raceId: 'human', classes: [{ classId: 'fighter', levels: 3 }],
      abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
      proficiencies: { skills: [], saves: [] },
    },
    progression: { xp: 900, levels: [{ level: 1, classId: 'fighter', hpGained: 10, choice: 'average' }] },
    runtime: {
      hp, hpMax: hp, tempHp: 0, conditions: {}, exhaustion: 0, concentratingOn: null,
      attuned: [], equipped: {}, inventory: [], deathSaves: { successes: 0, failures: 0 },
      resources: {}, gold: 0, pos: { x: 1, y: 1 },
    },
  }, extra || {});
}

function scene(policy, opts) {
  opts = opts || {};
  const st = State.create({ seed: opts.seed || 'mort' });
  st.meta.deathPolicy = policy;
  State.addActor(st, actorFixture('hero', 'Hero', 'party', opts.heroHp == null ? 20 : opts.heroHp));
  if (!opts.solo) State.addActor(st, actorFixture('ally', 'Ally', 'party', 20));
  State.addActor(st, actorFixture('foe', 'Foe', 'enemy', 20));
  State.addSeat(st, { id: 'p1', name: 'P1', actorId: 'hero', control: 'human' });
  State.refreshAllDerived(st);
  return st;
}

/* -------------------------------------------------------- the rules half -- */
t.section('zero hit points is unconscious, not dead');
{
  const st = scene('standard');
  const b = Events.makeBatch({ commandId: 'k' });
  Events.push(b, 'hp', { targetId: 'hero', delta: -100 }, 'down');
  Events.commit(st, b);
  t.eq(st.actors.hero.runtime.hp, 0, 'hit points stop at zero');
  t.eq(!!st.actors.hero.runtime.dead, false, 'and the character is not dead');
  t.deep(Dispatch.legalMoves(st, 'hero', {}), [],
    'an unconscious character has no legal actions at all');
}

t.section('death saves run themselves at the start of the turn');
{
  const st = scene('standard');
  const b = Events.makeBatch({ commandId: 'k' });
  Events.push(b, 'hp', { targetId: 'hero', delta: -100 }, 'down');
  Events.commit(st, b);

  let turns = 0, resolved = null;
  while (turns++ < 12) {
    Events.commit(st, Combat.startTurn(st, 'hero'));
    const r = st.actors.hero.runtime;
    if (r.dead) { resolved = 'dead'; break; }
    if (r.stable) { resolved = 'stable'; break; }
    if (r.hp > 0) { resolved = 'revived'; break; }
  }
  t.ok(!!resolved, 'death saves always resolve within a few turns', '(' + resolved + ')');
  t.ok(turns <= 6, 'and do not run forever', '(' + turns + ' turns)');
  const d = st.actors.hero.runtime.deathSaves;
  t.ok(d.successes <= 3 && d.failures <= 3, 'the counters never exceed three');
}

t.section('the 2014 death-save rules');
{
  const rng = { int: () => 10, next: () => 0.5 };
  const ten = Rules.deathSave({ rng });
  t.eq(ten.successesDelta, 1, 'a 10 succeeds');

  const one = Rules.deathSave({ rng: { int: () => 1, next: () => 0 } });
  t.eq(one.failuresDelta, 2, 'a natural 1 fails, and counts twice');
  t.eq(one.natural, 1, 'and is reported as a natural 1');

  const twenty = Rules.deathSave({ rng: { int: () => 20, next: () => 0.99 } });
  t.eq(twenty.revive, true, 'a natural 20 brings you back at one hit point');
  t.eq(twenty.hp, 1, 'with exactly one hit point');

  const st = scene('standard');
  Events.commit(st, (() => { const b = Events.makeBatch({ commandId: 'z' }); Events.push(b, 'hp', { targetId: 'hero', delta: -100 }); return b; })());
  st.rng = { int: () => 1, next: () => 0, state: () => ({ seed: 0, count: 0 }) };
  Events.commit(st, Combat.startTurn(st, 'hero'));
  t.eq(st.actors.hero.runtime.deathSaves.failures, 2,
    'a natural 1 on a death save counts as TWO failures');
}

t.section('massive damage kills outright');
{
  const st = scene('standard', { heroHp: 12 });
  st.actors.hero.runtime.hp = 5;
  const r = Rules.massiveDamage(5, 12, 18);
  t.eq(r.dead, true, 'overflow past zero of 13 against a maximum of 12 is instant death');
  t.eq(Rules.massiveDamage(5, 12, 10).dead, false, 'a smaller overflow is not');
}

/* ------------------------------------------------------ the policy half -- */
t.section('heroic: a player character cannot die by accident');
{
  const st = scene('heroic');
  const res = Mortality.resolveLethal(st, 'hero', {});
  t.eq(res.died, false, 'a lethal outcome does not kill');
  t.eq(res.campaignOver, false, 'and does not end the campaign');
  t.ok(res.events.some(e => e.kind === 'stabilise'), 'the character is stabilised instead');
  t.ok(/somehow has/.test(res.beats[0]),
    'and it is narrated as a near thing, not as a rule', '(' + res.beats[0] + ')');
}

t.section('standard: death is real, and the seat gets a new character');
{
  const st = scene('standard');
  const res = Mortality.resolveLethal(st, 'hero', {});
  t.eq(res.died, true, 'the character dies');
  t.eq(res.campaignOver, false, 'the campaign continues');
  t.ok(res.events.some(e => e.kind === 'death'), 'a death event is emitted');
  t.ok(res.events.some(e => e.flag === 'seatNeedsCharacter.hero'),
    'and the seat is flagged as needing someone new');
  t.ok(res.beats.some(b => /Revivify/.test(b)),
    'the party is told the resurrection window is open', '(' + res.beats.join(' ') + ')');
}

t.section('gritty: death is real and the seat stays empty');
{
  const st = scene('gritty');
  const res = Mortality.resolveLethal(st, 'hero', {});
  t.eq(res.died, true, 'the character dies');
  t.eq(res.events.some(e => e.flag === 'seatNeedsCharacter.hero'), false,
    'and no replacement is offered');
}

t.section('ironman: one death ends everything');
{
  const st = scene('ironman');
  const res = Mortality.resolveLethal(st, 'hero', {});
  t.eq(res.died, true, 'the character dies');
  t.eq(res.campaignOver, true, 'and the campaign is over');
  t.ok(res.events.some(e => e.flag === 'campaignOver'), 'which is recorded as a flag');
  res.events.forEach(e => { if (e.kind === 'flag' && e.flag === 'campaignOver') Events.commit(st, (() => { const b = Events.makeBatch({ commandId: 'over' }); b.events.push(Events.makeEvent('flag', { flag: e.flag, value: e.value })); return b; })()); });
  t.eq(Mortality.isOver(st), true, 'and the session reports itself as over');
  t.deep(Mortality.raiseOptionsFor(st, 'hero'), [],
    'nothing can be raised under ironman');
}

t.section('a party wipe ends a gritty campaign');
{
  const st = scene('gritty', { solo: true });
  const res = Mortality.resolveLethal(st, 'hero', {});
  t.eq(res.partyWiped, true, 'losing the last member is a wipe');
  t.eq(res.campaignOver, true, 'and ends the campaign');

  const soft = scene('standard', { solo: true });
  const softRes = Mortality.resolveLethal(soft, 'hero', {});
  t.eq(softRes.partyWiped, true, 'a standard campaign notices the wipe');
  t.eq(softRes.campaignOver, false, 'but does not end on it');
}

/* --------------------------------------------------------- resurrection -- */
t.section('the resurrection ladder follows the book');
{
  const st = scene('standard');
  st.actors.hero.runtime.dead = true;
  st.flags['diedAt.hero'] = { clock: 0 };
  st.clock = 0;

  let opts = Mortality.raiseOptionsFor(st, 'hero');
  t.eq(opts.length, 4, 'four options exist');
  t.ok(opts.every(o => o.available), 'all are open the moment someone dies');
  const revivify = opts.filter(o => o.id === 'revivify')[0];
  t.eq(revivify.costGp, 300, 'Revivify costs 300 gp of diamond');
  t.eq(revivify.level, 3, 'and is a third-level spell');

  st.clock = 5;
  opts = Mortality.raiseOptionsFor(st, 'hero');
  t.eq(opts.filter(o => o.id === 'revivify')[0].available, false,
    'Revivify closes after one minute');
  t.eq(opts.filter(o => o.id === 'raise-dead')[0].available, true,
    'Raise Dead is still open five minutes later');

  st.clock = 60 * 24 * 11;
  opts = Mortality.raiseOptionsFor(st, 'hero');
  t.eq(opts.filter(o => o.id === 'raise-dead')[0].available, false,
    'Raise Dead closes after ten days');
  t.eq(opts.filter(o => o.id === 'resurrection')[0].available, true,
    'Resurrection reaches much further back');

  st.flags['gentleRepose.hero'] = true;
  st.clock = 60 * 24 * 15;
  t.eq(Mortality.raiseOptionsFor(st, 'hero').filter(o => o.id === 'raise-dead')[0].available, true,
    'Gentle Repose extends the Raise Dead window by ten days');
}

t.section('being raised has consequences');
{
  const st = scene('standard');
  st.actors.hero.runtime.dead = true;
  st.actors.hero.runtime.hp = 0;
  st.flags['diedAt.hero'] = { clock: 0 };
  st.clock = 0;

  const bad = Mortality.raise(st, 'hero', 'revivify');
  t.eq(bad.ok, true, 'Revivify works inside its window');
  t.ok(bad.events.some(e => e.kind === 'revive'), 'and revives the character');
  t.eq(bad.events.filter(e => e.kind === 'effect_add').length, 0,
    'Revivify carries no penalty');

  const st2 = scene('standard');
  st2.actors.hero.runtime.dead = true;
  st2.flags['diedAt.hero'] = { clock: 0 };
  st2.clock = 60;
  const raised = Mortality.raise(st2, 'hero', 'raise-dead');
  t.eq(raised.ok, true, 'Raise Dead works an hour later');
  const penalty = raised.events.filter(e => e.kind === 'effect_add')[0];
  t.ok(!!penalty, 'and applies the returning penalty');
  t.eq(penalty.effect.magnitude, -4, 'which is -4');
  t.deep(penalty.effect.appliesTo, ['attack', 'save', 'check'],
    'on attacks, saves and checks');
  t.ok(/wearing off/.test(raised.beats.join(' ')),
    'and the log says it wears off');

  st2.clock = 60 * 24 * 20;
  t.eq(Mortality.raise(st2, 'hero', 'raise-dead').ok, false,
    'and it refuses once the window has closed');
}

/* ---------------------------------------------------------- replacement -- */
t.section('a replacement character joins at the party\u2019s level');
{
  const st = scene('standard');
  [st.actors.ally, st.actors.hero].forEach(x => { x.progression.levels = [1, 2, 3, 4, 5].map(l =>
    ({ level: l, classId: 'fighter', hpGained: 6, choice: 'average' })); });
  const rep = Mortality.makeReplacement(st, 'p1', { rng: new RNG('rep') });
  t.eq(rep.level, 5, 'built at the surviving party\u2019s level, not level 1');
  t.ok(!!rep.spec.name, 'they have a name', '(' + rep.spec.name + ')');
  t.ok(!!rep.layers.base.classes.length, 'and a real class');
  t.ok(!!rep.layers.base.backstory, 'and a backstory');
  t.ok(rep.meeting.length > 10, 'and a reason to be here', '(' + rep.meeting + ')');

  const pinned = Mortality.makeReplacement(st, 'p1', { rng: new RNG('r2'), fixed: { classId: 'cleric' } });
  t.eq(pinned.spec.classId, 'cleric', 'and the player can pin what they play next');
}

t.section('policies are described for the player, not just enumerated');
Object.keys(Mortality.POLICIES).forEach(id => {
  const p = Mortality.POLICIES[id];
  t.ok(p.name && p.name.length > 2, id + ' has a name');
  t.ok(p.blurb && p.blurb.length > 60, id + ' explains itself in plain language');
  t.ok(p.note && p.note.length > 10, id + ' says who it is for');
});
t.eq(Mortality.policy({}).id, 'standard', 'the default policy is Standard');
t.eq(Mortality.policy({ meta: { deathPolicy: 'nonsense' } }).id, 'standard',
  'and an unknown policy falls back to Standard rather than throwing');

/* ------------------------------------------------- end-to-end enforcement -- */
t.section('the policy is actually enforced through combat, not just described');
{
  /* Three failed death saves under a heroic campaign must NOT kill. */
  const st = scene('heroic');
  Events.commit(st, (() => { const b = Events.makeBatch({ commandId: 'd' }); Events.push(b, 'hp', { targetId: 'hero', delta: -100 }); return b; })());
  st.rng = { int: () => 1, next: () => 0, state: () => ({ seed: 0, count: 0 }) };
  for (let i = 0; i < 4; i++) Events.commit(st, Combat.startTurn(st, 'hero'));
  t.eq(!!st.actors.hero.runtime.dead, false,
    'natural 1s on every death save still do not kill under a heroic campaign');
  t.eq(!!st.actors.hero.runtime.stable, true, 'they are stabilised instead');

  const grim = scene('gritty');
  Events.commit(st, (() => { const b = Events.makeBatch({ commandId: 'd2' }); Events.push(b, 'hp', { targetId: 'hero', delta: -100 }); return b; })());
  grim.rng = { int: () => 1, next: () => 0, state: () => ({ seed: 0, count: 0 }) };
  Events.commit(grim, (() => { const b = Events.makeBatch({ commandId: 'd3' }); Events.push(b, 'hp', { targetId: 'hero', delta: -100 }); return b; })());
  for (let i = 0; i < 4; i++) Events.commit(grim, Combat.startTurn(grim, 'hero'));
  t.eq(!!grim.actors.hero.runtime.dead, true,
    'the same rolls under a gritty campaign do kill');
}

t.done();
