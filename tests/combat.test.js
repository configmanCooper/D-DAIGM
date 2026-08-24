/*
 * tests/combat.test.js — the turn loop, the action economy, and the geometry
 * the UI is not allowed to reinvent.
 *
 * The reviewer's cases are numbered; the section names keep those numbers so a
 * failure points straight back at the checklist. Rolls are driven by a scripted
 * RNG (the same shape dice.test.js uses) so every outcome here is exact.
 */
'use strict';
const t = require('./_harness')('combat');
const Events = require('../js/engine/events.js');
const State = require('../js/engine/state.js');
const Command = require('../js/engine/command.js');
const Dispatch = require('../js/engine/dispatch.js');
const Rules = require('../js/engine/rules.js');
const Combat = require('../js/engine/combat.js');

/* A deterministic RNG: int() drains a queue, next() is a constant so
   initiative tiebreaks never wobble. */
function scriptRng(ints) {
  let i = 0;
  return {
    int: function () { if (i >= ints.length) throw new Error('rng exhausted at ' + i); return ints[i++]; },
    next: function () { return 0.5; },
  };
}

function mkActor(id, name, side, opts) {
  opts = opts || {};
  return {
    id: id, name: name, side: side, kind: side === 'party' ? 'pc' : 'npc',
    base: { name: name, abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 } },
    progression: { xp: 0, levels: [] },
    runtime: {
      hp: opts.hp != null ? opts.hp : 20, hpMax: opts.hpMax != null ? opts.hpMax : 20,
      tempHp: opts.tempHp || 0, conditions: {}, exhaustion: 0,
      concentratingOn: opts.concentratingOn || null, attuned: [], equipped: {}, inventory: [],
      deathSaves: { successes: 0, failures: 0 }, gold: 0,
      pos: opts.pos || { x: 0, y: 0 }, resources: {},
      speed: opts.speed != null ? opts.speed : 30,
      ac: opts.ac != null ? opts.ac : 12,
      reach: opts.reach || 5,
      attacks: opts.attacks || null,
      statblock: opts.statblock || null,
    },
  };
}

function freshCombat(rngInts, actors) {
  const s = State.create({ seed: 'combat-test' });
  s.rng = scriptRng(rngInts || []);
  (actors || []).forEach(a => State.addActor(s, a));
  return s;
}

function commit(s, batch) { return Events.commit(s, batch); }

/* ============================================================ initiative == */
t.section('initiative, turn order and round advancement');
{
  const s = freshCombat([10, 10], [
    mkActor('hero', 'Shen', 'party'),
    mkActor('ogre', 'Ogre', 'enemy'),
  ]);
  const b = Combat.beginEncounter(s, [
    { id: 'hero', mod: 5, dex: 12 },
    { id: 'ogre', mod: 0, dex: 10 },
  ], { encounterId: 'e1' });
  commit(s, b);
  t.eq(s.combat.active, true, 'combat is active after beginEncounter');
  t.eq(s.combat.order[0].id, 'hero', 'the higher initiative acts first');
  t.eq(s.combat.round, 1, 'the encounter opens on round 1');

  commit(s, Combat.startTurn(s, 'hero'));
  t.eq(s.activeActorId, 'hero', 'the first turn belongs to the winner of initiative');

  commit(s, Combat.advanceTurn(s));
  t.eq(s.combat.turnIndex, 1, 'advancing moves the pointer to the next combatant');
  t.eq(s.activeActorId, 'ogre', 'and starts that combatant\u2019s turn');
  t.eq(s.combat.round, 1, 'still the same round mid-order');

  commit(s, Combat.advanceTurn(s));
  t.eq(s.combat.turnIndex, 0, 'the pointer wraps back to the top');
  t.eq(s.combat.round, 2, 'and the round advances on the wrap');
}

/* ======================================================== action economy == */
t.section('action economy: action, bonus, one reaction, movement');
{
  const s = freshCombat([10], [mkActor('hero', 'Shen', 'party', { speed: 30 })]);
  commit(s, Combat.beginEncounter(s, [{ id: 'hero', mod: 0 }], {}));
  commit(s, Combat.startTurn(s, 'hero'));
  const turn = s.actors.hero.runtime.turn;
  t.eq(turn.action, true, 'a fresh turn has its action');
  t.eq(turn.bonus, true, 'and its bonus action');
  t.eq(turn.reaction, true, 'and its reaction');
  t.eq(turn.objectInteraction, true, 'and its free object interaction');
  t.eq(turn.movementRemaining, 30, 'and its full movement');

  commit(s, Events.push(Events.makeBatch({ commandId: 'spend' }), 'action_economy', { actorId: 'hero', action: false }));
  t.eq(Combat.canAct(s.actors.hero), false, 'spending the action leaves none behind');
  t.eq(Combat.canBonus(s.actors.hero), true, 'but the bonus action is untouched');
}

t.section('a reaction refreshes at the START of your turn, not the round');
{
  const s = freshCombat([10], [mkActor('hero', 'Shen', 'party')]);
  commit(s, Combat.beginEncounter(s, [{ id: 'hero', mod: 0 }], {}));
  commit(s, Combat.startTurn(s, 'hero'));
  commit(s, Events.push(Events.makeBatch({ commandId: 'react' }), 'action_economy', { actorId: 'hero', reaction: false }));
  t.eq(Combat.canReact(s.actors.hero), false, 'the reaction is spent');
  commit(s, Combat.startTurn(s, 'hero'));
  t.eq(Combat.canReact(s.actors.hero), true, 'a new turn hands the reaction back');
}

/* ============================================================ Case 10 ===== */
t.section('Case 10 — surprise skips the first turn and denies reactions, not a free round');
{
  const s = freshCombat([15, 15, 6, 6], [
    mkActor('rogue', 'Ambusher', 'party'),
    mkActor('guard', 'Guard', 'enemy'),
  ]);
  commit(s, Combat.beginEncounter(s, [
    { id: 'rogue', mod: 5 }, { id: 'guard', mod: 0 },
  ], { surprised: ['guard'] }));
  commit(s, Combat.startTurn(s, 'rogue'));
  t.eq(Combat.isSurprised(s.actors.rogue), false, 'the ambusher is NOT surprised and acts normally');
  t.eq(Combat.canAct(s.actors.rogue), true, 'the ambusher keeps a full turn — surprise is not a free round for everyone');

  commit(s, Combat.startTurn(s, 'guard'));
  t.eq(Combat.isSurprised(s.actors.guard), true, 'the surprised guard is flat-footed on its first turn');
  t.eq(Combat.canAct(s.actors.guard), false, 'and can take no action');
  t.eq(Combat.movementLeft(s.actors.guard), 0, 'and cannot move');
  t.eq(Combat.canReact(s.actors.guard), false, 'and cannot even react while surprised');

  commit(s, Combat.endTurn(s, 'guard'));
  t.eq(Combat.canReact(s.actors.guard), true, 'once its first turn ends, the reaction becomes available');
}

/* ============================================================ Case 11 ===== */
t.section('Case 11 — casting Shield as a reaction blocks the opportunity attack');
{
  const s = freshCombat([10], [
    mkActor('hero', 'Shen', 'party'),
    mkActor('ogre', 'Ogre', 'enemy', { ac: 10 }),
  ]);
  commit(s, Combat.beginEncounter(s, [{ id: 'hero', mod: 0 }], {}));
  commit(s, Combat.startTurn(s, 'hero'));
  /* The reaction is spent to cast Shield. */
  commit(s, Events.push(Events.makeBatch({ commandId: 'shield' }), 'action_economy', { actorId: 'hero', reaction: false }));
  const oa = Combat.resolveCombat(s, Command.create({
    actorId: 'hero', family: 'combat',
    primary: Command.makeStep({ verb: 'opportunity_attack', targetIds: ['ogre'] }),
  }), { targetId: 'ogre' });
  t.ok(!!oa.refused, 'no opportunity attack is possible with the reaction already spent');
  t.eq(oa.refused.reason, 'no-reaction', 'and the refusal names the spent reaction');
}

/* ============================================================ Case 12 ===== */
t.section('Case 12 — opportunity attacks are provoked by leaving reach only');
{
  const enemy = { x: 5, y: 5 };
  t.eq(Combat.provokesOpportunity({ x: 4, y: 5 }, { x: 2, y: 5 }, enemy, { reachFt: 5 }), true,
    'stepping out of an enemy\u2019s reach provokes');
  t.eq(Combat.provokesOpportunity({ x: 4, y: 5 }, { x: 6, y: 5 }, enemy, { reachFt: 5 }), false,
    'moving from one adjacent square to another does NOT provoke');
  t.eq(Combat.provokesOpportunity({ x: 4, y: 5 }, { x: 2, y: 5 }, enemy, { reachFt: 5, disengage: true }), false,
    'Disengage suppresses the opportunity attack entirely');
}

/* ============================================================ Case 13 ===== */
t.section('Case 13 — two-weapon off-hand adds the weapon die only, no ability modifier');
{
  t.eq(Combat.twoWeaponDamageBonus(3, {}), 0, 'a positive modifier is dropped from the off-hand');
  t.eq(Combat.twoWeaponDamageBonus(3, { twoWeaponFightingStyle: true }), 3, 'unless the fighting style restores it');
  t.eq(Combat.twoWeaponDamageBonus(-1, {}), -1, 'a negative modifier always applies');

  /* Through the resolver: main-hand damage is 1d6+3; the off-hand strike must
     deal only the die. Scripted d20 = 18 (hits), d6 = 4. */
  const s = freshCombat([10, 18, 4], [
    mkActor('hero', 'Shen', 'party', {
      attacks: [{ name: 'Shortsword', toHit: 5, damage: '1d6+3', abilityMod: 3, reach: 5 }],
    }),
    mkActor('ogre', 'Ogre', 'enemy', { ac: 12, hp: 20, hpMax: 20 }),
  ]);
  commit(s, Combat.beginEncounter(s, [{ id: 'hero', mod: 0 }], {}));
  commit(s, Combat.startTurn(s, 'hero'));
  const b = Combat.resolveCombat(s, Command.create({
    actorId: 'hero', family: 'combat',
    primary: Command.makeStep({ verb: 'two_weapon_attack', targetIds: ['ogre'] }),
  }), { targetId: 'ogre' });
  commit(s, b);
  t.eq(s.actors.ogre.runtime.hp, 16, 'the off-hand deals the 4 from the die, not 4+3');
  t.eq(Combat.canBonus(s.actors.hero), false, 'and the off-hand strike spent the bonus action');
}

/* ============================================================ Case 15 ===== */
t.section('Case 15 — area templates include exactly the right squares');
{
  const sphere = Combat.squaresInSphere({ x: 0, y: 0 }, 20);
  const set = {}; sphere.forEach(q => { set[q.x + ',' + q.y] = true; });
  t.eq(sphere.length, 52, 'a 20-ft sphere on a grid intersection covers 52 squares');
  t.ok(set['0,0'], 'the squares hugging the centre are in');
  t.ok(set['3,0'] && set['-4,0'], 'the far edge squares whose centre is within 20 ft are in');
  t.ok(set['2,2'], 'a near-corner square within range is in');
  t.ok(!set['3,3'], 'a far-corner square whose centre is beyond 20 ft is out');
  t.ok(!set['2,3'], 'and so is the square just past the diagonal edge');

  const cone = Combat.squaresInCone({ x: 0, y: 0 }, { x: 1, y: 0 }, 15);
  const cset = cone.map(q => q.x + ',' + q.y).sort().join(' ');
  t.eq(cone.length, 4, 'a 15-ft cone from a corner is a 4-square wedge');
  t.eq(cset, '1,-1 1,0 2,-1 2,0', 'and it is exactly that wedge');
}

/* ============================================================ Case 19 ===== */
t.section('Case 19 — difficult terrain doubles cost; Chebyshev diagonals are consistent');
{
  const straight = Combat.pathCost([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
  const diagonal = Combat.pathCost([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]);
  t.eq(straight.cost, 15, 'three orthogonal steps cost 15 ft');
  t.eq(diagonal.cost, 15, 'three diagonal steps cost the same 15 ft under Chebyshev');
  const difficult = Combat.pathCost([{ x: 0, y: 0 }, { x: 1, y: 0 }], { difficult: sq => sq.x === 1 });
  t.eq(difficult.cost, 10, 'entering a difficult-terrain square costs double');
  const leap = Combat.pathCost([{ x: 0, y: 0 }, { x: 3, y: 0 }]);
  t.eq(leap.illegal, true, 'a jump of more than one square is not a walkable step');
}

/* ============================================================ Case 23 ===== */
t.section('Case 23 — recharge, legendary resistance and legendary actions');
{
  const notYet = Combat.rollRecharge(freshCombat([4]), [5, 6]);
  t.eq(notYet.ready, false, 'a d6 of 4 does not recharge a 5-6 ability');
  const back = Combat.rollRecharge(freshCombat([5]), [5, 6]);
  t.eq(back.ready, true, 'a d6 of 5 brings it back');

  const lr = Combat.useLegendaryResistance(3);
  t.eq(lr.used, true, 'legendary resistance fires while uses remain');
  t.eq(lr.save, 'success', 'and turns the failed save into a success');
  t.eq(lr.remaining, 2, 'and spends one use');
  t.eq(Combat.useLegendaryResistance(0).used, false, 'with none left it cannot fire');

  const sb = { legendaryActions: { perRound: 3, options: [] } };
  t.eq(Combat.legendaryReset(sb), 3, 'legendary actions reset to the per-round budget');
  const spent = Combat.spendLegendaryAction(3, 2);
  t.eq(spent.ok, true, 'a 2-cost legendary action is affordable with 3 points');
  t.eq(spent.remaining, 1, 'leaving one point');
  t.eq(Combat.spendLegendaryAction(1, 2).ok, false, 'but not a second 2-cost action');
}

/* ============================================================ cover ======= */
t.section('line of sight and cover via corner-to-corner rays');
{
  const att = { x: 0, y: 0 };
  t.eq(Combat.lineOfSightCover(att, { x: 5, y: 0 }, []).level, 'none', 'a clear line gives no cover');
  const half = Combat.lineOfSightCover(att, { x: 3, y: -2 }, [{ x: 2, y: -1 }]);
  t.eq(half.blockedCorners, 2, 'two blocked corners is half cover');
  t.eq(half.ac, 2, 'half cover is +2 AC');
  const tq = Combat.lineOfSightCover(att, { x: 3, y: 3 }, [{ x: 2, y: 2 }]);
  t.eq(tq.blockedCorners, 3, 'three blocked corners is three-quarters cover');
  t.eq(tq.ac, 5, 'three-quarters cover is +5 AC');
  const total = Combat.lineOfSightCover(att, { x: 3, y: -2 }, [{ x: 2, y: -2 }, { x: 2, y: -1 }]);
  t.eq(total.level, 'total', 'four blocked corners is total cover');
  t.eq(total.untargetable, true, 'and a totally covered creature cannot be targeted directly');
  t.eq(Combat.hasLineOfSight(att, { x: 3, y: -2 }, [{ x: 2, y: -2 }, { x: 2, y: -1 }]), false,
    'total cover means no line of sight');
}

/* ==================================================== concentration/damage = */
t.section('concentration checks ride on the damage pipeline');
{
  /* 9 damage -> DC max(10, floor(9/2)) = 10. Scripted con save = 3, a failure. */
  const s = freshCombat([3], [mkActor('mage', 'Mage', 'party', { hp: 20, hpMax: 20, concentratingOn: { spellId: 'bless' } })]);
  const chain = Combat.damageEvents(s, 'mage', 9, {
    concentrationDerived: { saves: { con: 0 }, abilityMods: { con: 2 }, exhaustion: 0 },
  });
  const conRoll = chain.events.filter(e => e.kind === 'roll' && e.of === 'concentration')[0];
  t.eq(conRoll.dc, 10, '9 damage sets a DC 10 concentration save');
  t.ok(chain.events.some(e => e.kind === 'concentration_end'), 'a failed save ends concentration');
  const big = Combat.damageEvents(freshCombat([3], [mkActor('mage', 'Mage', 'party', { hp: 40, hpMax: 40, concentratingOn: { spellId: 'bless' } })]),
    'mage', 30, { concentrationDerived: { saves: { con: 0 }, abilityMods: {}, exhaustion: 0 } });
  t.eq(big.events.filter(e => e.of === 'concentration')[0].dc, 15, '30 damage sets a DC 15 concentration save');
}

t.section('massive damage kills outright, and hits while down burn death saves');
{
  const s = freshCombat([], [mkActor('hero', 'Shen', 'party', { hp: 5, hpMax: 12 })]);
  const chain = Combat.damageEvents(s, 'hero', 18, {});
  t.eq(chain.massive, true, 'overflow past 0 that meets max HP is massive damage');
  commit(s, (() => { const b = Events.makeBatch({ commandId: 'm' }); b.events = chain.events; b.beats = chain.beats; return b; })());
  t.eq(s.actors.hero.runtime.dead, true, 'and it kills with no saving throws');

  const d = freshCombat([], [mkActor('down', 'Fallen', 'party', { hp: 0, hpMax: 12 })]);
  const oneFail = Combat.damageEvents(d, 'down', 4, {});
  t.eq(oneFail.events.filter(e => e.kind === 'death_save')[0].failures, 1, 'a hit while at 0 HP is one death-save failure');
  const critFail = Combat.damageEvents(d, 'down', 4, { crit: true });
  t.eq(critFail.events.filter(e => e.kind === 'death_save')[0].failures, 2, 'a critical hit while down is two failures');
}

/* ============================================================ grapple ===== */
t.section('Case 14 (loop) — grapple routes through Rules.contest, not an attack roll');
{
  /* Athletics +5 vs Athletics +0 / Acrobatics +2. Scripted d20s: 12 then 8. */
  const s = freshCombat([10, 12, 8], [
    mkActor('hero', 'Shen', 'party'),
    mkActor('ogre', 'Ogre', 'enemy'),
  ]);
  commit(s, Combat.beginEncounter(s, [{ id: 'hero', mod: 0 }], {}));
  commit(s, Combat.startTurn(s, 'hero'));
  const b = Combat.resolveCombat(s, Command.create({
    actorId: 'hero', family: 'combat',
    primary: Command.makeStep({ verb: 'grapple', targetIds: ['ogre'] }),
  }), {
    targetId: 'ogre',
    derivedA: { skills: { athletics: { mod: 5 } } },
    derivedB: { skills: { athletics: { mod: 0 }, acrobatics: { mod: 2 } } },
  });
  const roll = b.events.filter(e => e.kind === 'roll')[0];
  t.eq(roll.result.isAttackRoll, false, 'a grapple is explicitly NOT an attack roll');
  t.eq(roll.result.consumesAttack, true, 'it spends one attack of the Attack action');
  t.ok(roll.result.initiator && roll.result.responder, 'it is an opposed contest with two rolls');
  commit(s, b);
  t.ok(!!s.actors.ogre.runtime.conditions.grappled, 'winning the contest applies the grappled condition');
  t.eq(Combat.canAct(s.actors.hero), false, 'and the attempt spent the action');
}

/* ============================================================ multiattack = */
t.section('multiattack unrolls the statblock sequence under one action');
{
  const statblock = {
    actions: [{ id: 'claw', name: 'Claw', toHit: 6, reach: 5, damage: [{ dice: '1d6', flat: 2, type: 'slashing' }] }],
    multiattack: { sequence: [{ actionRef: 'claw', count: 2 }] },
  };
  t.deep(Combat.multiattackSequence(statblock), ['claw', 'claw'], 'the sequence expands by count');
  /* Two claws: d20=15, d6=4, d20=17, d6=3. */
  const s = freshCombat([10, 15, 4, 17, 3], [
    mkActor('beast', 'Beast', 'enemy', { statblock: statblock }),
    mkActor('hero', 'Shen', 'party', { ac: 12, hp: 30, hpMax: 30 }),
  ]);
  commit(s, Combat.beginEncounter(s, [{ id: 'beast', mod: 0 }], {}));
  commit(s, Combat.startTurn(s, 'beast'));
  const b = Combat.monsterMultiattack(s, Command.create({
    actorId: 'beast', family: 'combat',
    primary: Command.makeStep({ verb: 'attack', targetIds: ['hero'] }),
  }), { targetId: 'hero' });
  const attackRolls = b.events.filter(e => e.kind === 'roll' && e.of === 'attack');
  t.eq(attackRolls.length, 2, 'both claws roll to hit');
  commit(s, b);
  t.eq(s.actors.hero.runtime.hp, 30 - 6 - 5, 'both claws land for 6 and 5');
  t.eq(Combat.canAct(s.actors.beast), false, 'and the whole multiattack was a single action');
}

/* ============================================================ dispatch ==== */
t.section('the single door: resolvers register and dispatch commits');
{
  Combat.register();
  t.ok(Dispatch.registered().indexOf('combat') >= 0, 'the combat resolver is registered');
  t.ok(Dispatch.registered().indexOf('movement') >= 0, 'the movement resolver is registered');
  t.ok(Dispatch.registered().indexOf('meta') >= 0, 'the meta resolver is registered');

  const s = State.create({ seed: 'door' });
  State.addActor(s, mkActor('hero', 'Shen', 'party', {
    attacks: [{ name: 'Sword', toHit: 8, damage: '1d8+4', abilityMod: 4, reach: 5 }],
  }));
  State.addActor(s, mkActor('ogre', 'Ogre', 'enemy', { ac: 5, hp: 30, hpMax: 30 }));
  const h = State.makeHistory();
  commit(s, Combat.startTurn(s, 'hero'));
  const out = Dispatch.dispatch(s, h, Command.create({
    sessionId: s.sessionId, stateRevision: s.revision, turnEpoch: s.turnEpoch,
    actorId: 'hero', family: 'combat',
    primary: Command.makeStep({ verb: 'attack', targetIds: ['ogre'] }),
  }), { targetId: 'ogre' });
  t.eq(out.ok, true, 'a real attack command dispatches end to end');
  t.ok(out.beats.length > 0, 'and produces beats for the narrator');
  t.eq(out.beats.join(' ').indexOf('AC'), -1, 'the beats never leak the enemy\u2019s Armour Class');
}

t.section('meta resolver handles end_turn and pass');
{
  const s = freshCombat([10], [mkActor('hero', 'Shen', 'party')]);
  commit(s, Combat.beginEncounter(s, [{ id: 'hero', mod: 0 }], {}));
  commit(s, Combat.startTurn(s, 'hero'));
  const end = Combat.resolveMeta(s, Command.create({ actorId: 'hero', family: 'meta', primary: Command.makeStep({ verb: 'end_turn' }) }));
  commit(s, end);
  t.eq(Combat.canAct(s.actors.hero), false, 'end_turn closes out the action');
  const pass = Combat.resolveMeta(s, Command.create({ actorId: 'hero', family: 'meta', primary: Command.makeStep({ verb: 'pass' }) }));
  t.ok(!pass.refused, 'pass is a legal non-action');
}

t.section('legalMoves is one aggregated list for UI, AI seat and referee alike');
{
  const s = freshCombat([10], [
    mkActor('hero', 'Shen', 'party', { attacks: [{ name: 'A', toHit: 5, damage: '1d6+3', abilityMod: 3 }, { name: 'B', toHit: 5, damage: '1d6+3', abilityMod: 3 }] }),
    mkActor('ogre', 'Ogre', 'enemy'),
  ]);
  Combat.register();
  commit(s, Combat.beginEncounter(s, [{ id: 'hero', mod: 0 }], {}));
  commit(s, Combat.startTurn(s, 'hero'));
  const moves = Dispatch.legalMoves(s, 'hero', {});
  /* A move's `step` must be a real step object, because Dispatch.commandFromMove
     drops it straight into a command's `primary`. A bare verb string parses as
     a legal-looking move and then fails validation on dispatch, which is how an
     AI seat ends up silently doing nothing. */
  t.ok(moves.every(m => m.step && typeof m.step === 'object' && typeof m.step.verb === 'string'),
    'every move carries a step OBJECT, not a verb string');
  t.ok(moves.every(m => Array.isArray(m.step.targetIds)),
    'and every step has a targetIds array, as makeStep guarantees');
  const steps = moves.map(m => m.step.verb);
  t.ok(steps.indexOf('attack') >= 0, 'attacking an enemy is offered');
  t.ok(steps.indexOf('grapple') >= 0, 'grappling is offered as its own move');
  t.ok(steps.indexOf('two_weapon_attack') >= 0, 'the off-hand strike is offered while a bonus action remains');
  t.ok(steps.indexOf('end_turn') >= 0, 'and ending the turn is always available');

  /* Every offered move must survive the round trip into a command, or the list
     is lying to the UI and to the AI seats alike. */
  const bad = moves.filter(m => {
    const cmd = Dispatch.commandFromMove(s, 'hero', m, {});
    return !Command.validateStructure(cmd).ok;
  });
  t.eq(bad.length, 0, 'every legal move converts to a structurally valid command',
    bad.length ? '(' + bad.map(m => m.step.verb).join(', ') + ')' : '');
}

t.section('legalMoves works outside an encounter');
{
  /* Out of combat nobody is counting actions. Treating a missing runtime.turn
     as "may do nothing" left exploring characters with an empty move list,
     which stalled every AI seat that was not already in a fight. */
  const s = freshCombat([10], [
    mkActor('hero', 'Shen', 'party'),
    mkActor('ogre', 'Ogre', 'enemy'),
  ]);
  s.combat = { active: false, round: 0, order: [], turnIndex: 0, encounterId: null };
  delete s.actors.hero.runtime.turn;
  const moves = Dispatch.legalMoves(s, 'hero', {});
  t.ok(moves.length > 0, 'a character outside combat still has legal moves');
  t.ok(moves.map(m => m.step.verb).indexOf('attack') >= 0,
    'including attacking, since a fight can start at any moment');
}

t.section('the dead have no moves');
{
  const s = freshCombat([10], [
    mkActor('hero', 'Shen', 'party'),
    mkActor('ogre', 'Ogre', 'enemy'),
  ]);
  s.actors.hero.runtime.dead = true;
  const moves = Dispatch.legalMoves(s, 'hero', {});
  t.eq(moves.filter(m => m.family === 'combat').length, 0,
    'a dead character is offered no combat moves');
}

/* ------------------------------------------------ the perception layer -- */
/* Every one of these goes through the REAL load path with no injected data.
   The two worst bugs this project has had — Shen loading at AC 13 while the
   sheet said 18, and every attack in the game resolving against AC 10 — both
   survived a passing test suite because the tests handed the engine their own
   fixtures. */
t.section('armour class comes from the sheet, not from a default');
{
  const s = State.create({ seed: 'ac-real' });
  const P = require('../campaigns/shen_cooper.js');
  const shen = JSON.parse(JSON.stringify((P.shenCooper || P).characters.shen));
  State.addActor(s, {
    id: 'shen', name: 'Shen Cooper', side: 'party', kind: 'pc',
    base: shen.base, progression: shen.progression, runtime: shen.runtime,
  });
  State.refreshAllDerived(s);
  /* Deliberately NOT setting runtime.ac: that override is exactly what used to
     mask the fault. */
  t.eq(s.actors.shen.runtime.ac, undefined, 'no runtime AC override is present');
  t.eq(s.actors.shen.derivedCache.ac, 18, 'the derived sheet says 18 (chain + shield + defence)');
  t.eq(Combat.targetAc(s, 'shen'), 18, 'and an attack against Shen is resolved against 18, not 10');

  State.addActor(s, {
    id: 'gnoll', name: 'Gnoll', side: 'enemy', kind: 'monster',
    base: { name: 'Gnoll', abilities: {}, classes: [] },
    statblock: { ac: 15 },
    progression: { levels: [] },
    runtime: { hp: 22, hpMax: 22, conditions: {}, inventory: [], deathSaves: {} },
  });
  t.eq(Combat.targetAc(s, 'gnoll'), 15, 'a monster is defended by its statblock AC');
}

t.section('a creature nobody has noticed is not named in the move list');
{
  const s = State.create({ seed: 'hidden' });
  State.addActor(s, {
    id: 'p', name: 'Vess', side: 'party', kind: 'pc',
    base: {
      name: 'Vess', abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 14 },
      classes: [{ classId: 'fighter', levels: 3 }], items: [{ id: 'longsword' }],
    },
    progression: { levels: [{ level: 1, classId: 'fighter' }] },
    runtime: {
      hp: 20, hpMax: 20, conditions: {}, inventory: [{ id: 'longsword' }],
      deathSaves: {}, pos: { x: 0, y: 0 },
    },
  });
  const foe = (id, name, extra) => State.addActor(s, {
    id: id, name: name, side: 'enemy', kind: 'monster',
    base: { name: name, abilities: {}, classes: [] },
    statblock: { ac: 12 }, progression: { levels: [] },
    runtime: Object.assign({
      hp: 11, hpMax: 11, conditions: {}, inventory: [], deathSaves: {}, pos: { x: 1, y: 0 },
    }, extra || {}),
  });
  foe('seen', 'Bandit');
  foe('lurker', 'Hooded Figure', { unnoticed: true });
  State.refreshAllDerived(s);
  s.actors.p.runtime.turn = {
    action: true, bonus: true, reaction: true, objectInteraction: true, movementRemaining: 30,
  };

  const moves = JSON.stringify(Dispatch.legalMoves(s, 'p', {}));
  t.ok(/Bandit/.test(moves), 'the bandit standing in plain sight can be attacked');
  t.eq(/Hooded Figure/.test(moves), false,
    'but the figure nobody has noticed is not offered as a target');
  t.eq(/lurker/.test(moves), false, 'nor named by id anywhere in the move list');
}

/* ------------------------------------------------ tactics that matter -- */
/* Dodge, Help and Hide each cost a whole action, and each used to print a line
   of prose and change nothing — which makes them strictly worse than swinging
   a sword and teaches players to ignore them. */
t.section('the tactical actions have mechanical weight');
{
  const s = State.create({ seed: 'tactics' });
  const mk = (id, name, side) => State.addActor(s, {
    id: id, name: name, side: side, kind: side === 'party' ? 'pc' : 'monster',
    base: {
      name: name, abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 },
      classes: side === 'party' ? [{ classId: 'fighter', levels: 3 }] : [],
      items: [{ id: 'longsword' }],
    },
    statblock: side === 'enemy' ? { ac: 13 } : null,
    progression: { levels: [{ level: 1, classId: 'fighter' }] },
    runtime: {
      hp: 30, hpMax: 30, conditions: {}, inventory: [{ id: 'longsword' }],
      deathSaves: {}, pos: { x: 0, y: 0 },
    },
  });
  mk('vess', 'Vess', 'party'); mk('bram', 'Bram', 'party'); mk('gob', 'Goblin', 'enemy');
  State.refreshAllDerived(s);
  ['vess', 'bram', 'gob'].forEach(id => {
    s.actors[id].runtime.turn = {
      action: true, bonus: true, reaction: true, objectInteraction: true, movementRemaining: 30,
    };
  });

  const plain = Combat.attackAdvantage(s, s.actors.gob, s.actors.vess, {});
  t.eq(plain.advantage, false, 'an ordinary attack has neither advantage nor disadvantage');
  t.eq(plain.disadvantage, false, '');

  s.actors.vess.runtime.conditions.dodging = {};
  t.eq(Combat.attackAdvantage(s, s.actors.gob, s.actors.vess, {}).disadvantage, true,
    'Dodge actually imposes disadvantage on attacks against you');

  /* 2014: advantage and disadvantage cancel, however many of each there are. */
  s.actors.gob.runtime.conditions.invisible = {};
  const both = Combat.attackAdvantage(s, s.actors.gob, s.actors.vess, {});
  t.eq(both.advantage, false, 'advantage and disadvantage cancel rather than stacking');
  t.eq(both.disadvantage, false, '');
  delete s.actors.vess.runtime.conditions.dodging;
  delete s.actors.gob.runtime.conditions.invisible;

  s.actors.vess.runtime.hp = 0;
  t.eq(Combat.attackAdvantage(s, s.actors.gob, s.actors.vess, {}).advantage, true,
    'a creature at zero hit points is helpless and easy to hit');
  s.actors.vess.runtime.hp = 30;

  const h = State.makeHistory();
  const moves = Dispatch.legalMoves(s, 'bram', {});
  t.ok(moves.some(m => m.step.verb === 'help'), 'Help is offered when there is someone to help');
  t.ok(moves.some(m => m.step.verb === 'hide'), 'so is Hide');

  const helpMove = moves.filter(m => m.step.verb === 'help')[0];
  const helped = Dispatch.dispatch(s, h, Command.create({
    actorId: 'bram', family: 'combat', stateRevision: s.revision, turnEpoch: s.turnEpoch,
    primary: helpMove.step,
  }), {});
  t.eq(helped.ok, true, 'Help resolves');
  const withHelp = Combat.attackAdvantage(s, s.actors.vess, s.actors.gob, {});
  t.eq(withHelp.advantage, true, 'and gives the helped ally advantage on that target');

  Dispatch.dispatch(s, h, Command.create({
    actorId: 'vess', family: 'combat', stateRevision: s.revision, turnEpoch: s.turnEpoch,
    primary: Command.makeStep({ verb: 'attack', targetIds: ['gob'] }),
  }), {});
  s.actors.vess.runtime.turn.action = true;
  t.eq(Combat.attackAdvantage(s, s.actors.vess, s.actors.gob, {}).advantage, false,
    'the Help is spent by that attack, not kept for the rest of the fight');
}

t.section('what a creature is made of changes what hurts it');
{
  const s = State.create({ seed: 'resist' });
  State.addActor(s, {
    id: 'skel', name: 'Skeleton', side: 'enemy', kind: 'monster',
    base: { name: 'Skeleton', abilities: {}, classes: [] },
    statblock: { ac: 13 }, progression: { levels: [] },
    runtime: { hp: 13, hpMax: 13, conditions: {}, inventory: [], deathSaves: {} },
  });
  State.refreshAllDerived(s);
  s.actors.skel.derivedCache.resistances = ['slashing'];
  s.actors.skel.derivedCache.immunities = ['poison'];
  s.actors.skel.derivedCache.vulnerabilities = ['bludgeoning'];

  t.eq(Combat.applyDamageType(s, 'skel', 10, 'slashing').total, 5, 'resistance halves, rounding down');
  t.eq(Combat.applyDamageType(s, 'skel', 7, 'slashing').total, 3, 'and 7 halves to 3, not 3.5');
  t.eq(Combat.applyDamageType(s, 'skel', 10, 'poison').total, 0, 'immunity cancels the damage entirely');
  t.eq(Combat.applyDamageType(s, 'skel', 10, 'bludgeoning').total, 20, 'vulnerability doubles it');
  t.eq(Combat.applyDamageType(s, 'skel', 10, 'piercing').total, 10, 'and an ordinary type is unchanged');
}

t.done();
