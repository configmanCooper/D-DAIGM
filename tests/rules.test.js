/*
 * tests/rules.test.js — the pure adjudication primitives.
 *
 * Reviewer checklist cases 7, 8, 9, 14 and 16 live here, alongside the DC-band
 * conversion, cover, encounter budgeting and rest events. Rolls are driven by a
 * scripted RNG so every assertion is about the rule, never about luck.
 */
'use strict';
const t = require('./_harness')('rules');
const Effects = require('../js/engine/effects.js');
const Rules = require('../js/engine/rules.js');

/* Same scripted RNG shape as dice.test.js: int() returns the next value. */
function scripted(values) {
  let i = 0;
  return {
    int: function () {
      const v = values[i++];
      if (v === undefined) throw new Error('scripted RNG ran out of values');
      return v;
    },
    next: function () { return 0.5; },
  };
}

/* A hand-built "derived" stub carrying only the fields a primitive reads. */
function derived(spec) {
  return Object.assign({
    exhaustion: 0, proficiencyBonus: 2,
    abilityMods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    saves: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    skills: {},
  }, spec || {});
}

/* -------------------------------- DC bands --------------------------------- */
t.section('DC bands — the engine converts a band to a number');
t.eq(Rules.dcFor('easy'), 10, 'easy is DC 10');
t.eq(Rules.dcFor('medium'), 15, 'medium is DC 15');
t.eq(Rules.dcFor('very_hard'), 25, 'very hard is DC 25');
t.eq(Rules.dcFor('hard', 2), 22, 'a situational +2 raises hard from 20 to 22');
t.eq(Rules.dcFor('nonsense'), 15, 'an unknown band falls back to medium rather than crashing');

/* -------------------------------- checklist 7 — concentration -------------- */
t.section('checklist 7 — concentration DC, recast, and unconsciousness');
t.eq(Effects.concentrationSaveDc(9), 10, '9 damage -> Con save DC 10 (floor is below the minimum)');
t.eq(Effects.concentrationSaveDc(30), 15, '30 damage -> Con save DC 15 (half the damage)');
t.eq(Effects.concentrationSaveDc(22), 11, '22 damage -> DC 11 (floor(22/2))');

let cc = Rules.concentrationCheck(derived({ saves: { con: 2 } }), 30, { rng: scripted([13]) });
t.eq(cc.dc, 15, 'concentrationCheck derives its DC from the damage');
t.eq(cc.success, true, 'a 13 + Con 2 = 15 meets the DC 15');

/* Casting a second concentration spell ends the first. */
let state = { actors: { caster: { runtime: { concentratingOn: null } } }, effects: [] };
Effects.add(state, { id: 'e1', targetId: 'ally' });
Effects.startConcentration(state, 'caster', 'e1', 'bless');
Effects.add(state, { id: 'e2', targetId: 'foe' });
Effects.startConcentration(state, 'caster', 'e2', 'hold_person');
t.eq(state.effects.filter(e => e.id === 'e1').length, 0, 'the first concentration effect is dropped on recast');
t.eq(state.effects.filter(e => e.id === 'e2').length, 1, 'the new concentration effect remains');
t.eq(state.actors.caster.runtime.concentratingOn.spellId, 'hold_person', 'concentration now points at the new spell');

/* Falling unconscious ends concentration. */
let broke = Effects.onConditionApplied(state, 'caster', 'unconscious');
t.ok(broke && broke.dropped.indexOf('e2') >= 0, 'unconsciousness ends concentration and drops its effect');
t.eq(state.actors.caster.runtime.concentratingOn, null, 'the concentration slot is cleared');

/* -------------------------------- checklist 8 — death saves ---------------- */
t.section('checklist 8 — death saves (2014)');
t.eq(Rules.deathSave({ rng: scripted([10]) }).successesDelta, 1, 'a 10 is one success');
t.eq(Rules.deathSave({ rng: scripted([1]) }).failuresDelta, 2, 'a natural 1 counts as two failures');
let revive = Rules.deathSave({ rng: scripted([20]) });
t.eq(revive.revive, true, 'a natural 20 regains consciousness');
t.eq(revive.hp, 1, 'and comes back at 1 hit point');
let stable = Rules.deathSave({ rng: scripted([12]), current: { successes: 2, failures: 0 } });
t.eq(stable.stable, true, 'the third success stabilises');
let dead = Rules.deathSave({ rng: scripted([5]), current: { successes: 0, failures: 2 } });
t.eq(dead.dead, true, 'the third failure is death');
t.eq(Rules.damageWhileDown({ failures: 0 }, false).failuresDelta, 1, 'damage at 0 HP is one failure');
t.eq(Rules.damageWhileDown({ failures: 0 }, true).failuresDelta, 2, 'a critical hit at 0 HP is two failures');
t.eq(Rules.damageWhileDown({ failures: 2 }, false).dead, true, 'a damage failure can be the killing one');

/* -------------------------------- checklist 9 — massive damage ------------- */
t.section('checklist 9 — massive damage is instant death');
let md = Rules.massiveDamage(5, 12, 18);
t.eq(md.overflow, 13, 'overflow past 0 is damage minus current HP (18 - 5 = 13)');
t.eq(md.dead, true, 'overflow 13 >= max 12 kills outright, no saves');
t.eq(Rules.massiveDamage(5, 12, 16).dead, false, 'overflow 11 < max 12 does not (drops to 0, still saving)');

/* -------------------------------- checklist 14 — grapple is a contest ------ */
t.section('checklist 14 — grapple is a contest, not an attack roll');
let strongA = derived({ skills: { athletics: { mod: 5 }, acrobatics: { mod: 0 } } });
let nimbleB = derived({ skills: { athletics: { mod: 0 }, acrobatics: { mod: 3 } } });
let g = Rules.grapple(strongA, nimbleB, { rng: scripted([10, 10]) });
t.eq(g.isAttackRoll, false, 'a grapple is not an attack roll');
t.eq(g.consumesAttack, true, 'it consumes one attack of the Attack action');
t.eq(g.action, 'attack', 'and is billed against the Attack action');
t.eq(g.success, true, 'Athletics 15 beats the defender\'s best of Athletics/Acrobatics (13)');
t.eq(g.condition, 'grappled', 'success applies the grappled condition');
/* Ties fail: attacker +5 on an 8, defender +3 on a 10 -> 13 vs 13. */
let tie = Rules.grapple(strongA, nimbleB, { rng: scripted([8, 10]) });
t.eq(tie.tie, true, 'equal totals are a tie');
t.eq(tie.success, false, 'a tie means the contest fails and the status quo holds');
t.eq(tie.condition, null, 'no condition is applied on a failed grapple');

/* -------------------------------- checklist 16 — cover --------------------- */
t.section('checklist 16 — cover applies to AC and Dex saves only');
let tq = Rules.coverBonus('three-quarters');
t.eq(tq.ac, 5, 'three-quarters cover is +5 AC');
t.eq(tq.dexSave, 5, 'three-quarters cover is +5 to Dexterity saves');
t.eq(Rules.coverBonus('half').ac, 2, 'half cover is +2 AC');
t.eq(Rules.coverBonus('total').untargetable, true, 'total cover makes the target untargetable');
let covD = derived({ saves: { dex: 0, wis: 0 } });
t.eq(Rules.savingThrow(covD, 'dex', { rng: scripted([10]), cover: 'three-quarters' }).total, 15,
  'a Dexterity save gets the +5 from three-quarters cover');
t.eq(Rules.savingThrow(covD, 'wis', { rng: scripted([10]), cover: 'three-quarters' }).total, 10,
  'a Wisdom save gets NOTHING from cover');

/* -------------------------------- checks and passives ---------------------- */
t.section('checks, saves and passive scores');
let athlete = derived({ skills: { athletics: { ability: 'str', mod: 5, proficient: true } } });
t.eq(Rules.skillCheck(athlete, 'athletics', { rng: scripted([10]) }).total, 15, 'a skill check adds the skill modifier');
t.eq(Rules.abilityCheck(derived({ abilityMods: { str: 3 } }), 'str', { rng: scripted([10]) }).total, 13, 'a raw ability check adds the ability modifier');
t.eq(Rules.passiveScore(derived({ skills: { perception: { mod: 4 } } }), 'perception'), 14, 'passive is 10 + modifier');
t.eq(Rules.passiveScore(derived({ skills: { perception: { mod: 4 } } }), 'perception', { advantage: true }), 19, 'advantage adds +5 to a passive');
t.eq(Rules.passiveScore(derived({ exhaustion: 1, skills: { perception: { mod: 4 } } }), 'perception'), 9, 'exhaustion imposes -5 on a passive check');

/* Exhaustion 3 imposes disadvantage on a saving throw. */
let exhausted = derived({ exhaustion: 3, saves: { dex: 2 } });
let exSave = Rules.savingThrow(exhausted, 'dex', { rng: scripted([15, 4]) });
t.eq(exSave.natural, 4, 'exhaustion 3 rolls a save at disadvantage (keeps the lower die)');

/* -------------------------------- encounter budgeting ---------------------- */
t.section('encounter difficulty (2014 XP budget)');
t.eq(Rules.xpForCr('1/2'), 100, 'CR 1/2 is worth 100 XP');
t.eq(Rules.xpForCr(5), 1800, 'CR 5 is worth 1800 XP');
let easy = Rules.encounterDifficulty([3, 3, 3, 3], ['1/4', '1/4']);
t.eq(easy.multiplier, 1.5, 'two monsters carry a x1.5 multiplier');
let deadly = Rules.encounterDifficulty([1, 1], ['3']);
t.eq(deadly.difficulty, 'deadly', 'a CR 3 against two level-1 characters is deadly');

/* -------------------------------- resting ---------------------------------- */
t.section('resting returns events, not mutations');
let rest = Rules.restoreOnRest(
  { classes: [{ classId: 'x', levels: 4 }], abilities: { con: 10 } },
  { levels: [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 4 }] },
  { hp: 5, slotsSpent: { 1: 2 }, exhaustion: 1 },
  'long', { derived: { hpMax: 30 }, actorId: 'hero' });
t.ok(Array.isArray(rest.events) && rest.events.length > 0, 'a long rest produces a batch of events');
t.ok(rest.events.some(e => e.kind === 'hp' && e.delta === 25), 'it heals to full (30 - 5 = 25)');
t.ok(rest.events.some(e => e.kind === 'condition_remove' && e.condition === 'exhaustion'), 'it steps exhaustion down by one');
/* The old assertion checked for a `resource` event named "slot_1" — which is
   precisely the bug: the applier wrote that to `runtime.resources`, a pool
   nothing reads, while the casting check looked at `runtime.slotsSpent`. The
   test passed and casters woke with every slot still spent. Assert on the
   event that actually empties the pool. */
t.ok(rest.events.some(e => e.kind === 'slot_restore' && e.all), 'it restores spent spell slots');

t.done();
