/*
 * tests/dice.test.js — dice notation and 5e (2014) roll semantics.
 *
 * Cases 1-5 of the reviewer's rules-correctness checklist live here; the rest
 * land in rules.test.js / combat.test.js once those modules exist.
 */
'use strict';
const t = require('./_harness')('dice');
const { RNG } = require('../js/rng.js');
const D = require('../js/engine/dice.js');

/* A stub RNG that returns a scripted sequence, so a "roll" is deterministic
   and the assertion is about the rule, not about luck. */
function scripted(values) {
  let i = 0;
  return {
    int: function (min, max) {
      const v = values[i++];
      if (v === undefined) throw new Error('scripted RNG ran out of values');
      return v;
    },
    next: function () { return 0.5; },
  };
}

/* ------------------------------------------------------------- notation -- */
t.section('notation');
t.deep(D.parse('2d6+3').terms.map(x => x.kind), ['dice', 'flat'], '2d6+3 parses to two terms');
t.eq(D.parse('d20').terms[0].count, 1, 'bare d20 means 1d20');
t.eq(D.parse('4d6kh3').terms[0].keep.n, 3, 'kh3 keeps 3');
t.eq(D.parse('4d6kh3').terms[0].keep.mode, 'high', 'kh keeps the highest');
t.eq(D.parse('4d6dl1').terms[0].keep.n, 3, 'dl1 on 4 dice keeps 3');
t.eq(D.parse('1d8ro2').terms[0].reroll.once, true, 'ro rerolls once');
t.eq(D.parse('1d12r1').terms[0].reroll.once, false, 'r rerolls until');
t.eq(D.parse('2d6-1').terms[1].sign, -1, 'a minus term is negative');
t.throws(() => D.parse('2d6 + banana'), 'junk notation throws rather than silently ignoring');
t.throws(() => D.parse('2x6'), 'unparsable notation throws');

t.section('rolling');
t.eq(D.roll('2d6+3', { rng: scripted([4, 5]) }).total, 12, '2d6+3 with 4,5 totals 12');
t.eq(D.roll('4d6kh3', { rng: scripted([1, 6, 5, 4]) }).total, 15, '4d6kh3 drops the 1');
t.eq(D.roll('1d8ro2', { rng: scripted([2, 7]) }).total, 7, 'ro2 rerolls a 2 exactly once');
t.eq(D.roll('1d8ro2', { rng: scripted([2, 1]) }).total, 1, 'ro2 keeps the second roll even if worse');
t.eq(D.roll('1d6r1', { rng: scripted([1, 1, 4]) }).total, 4, 'r1 rerolls until it is not a 1');
t.eq(D.roll('-1d4', { rng: scripted([3]) }).total, -3, 'a negative dice term subtracts');

t.section('averages');
t.near(D.average('1d6'), 3.5, 0.001, '1d6 averages 3.5');
t.near(D.average('2d6+3'), 10, 0.001, '2d6+3 averages 10');
t.near(D.average('4d6kh3'), 12.24, 0.5, '4d6kh3 averages about 12.24');
t.eq(D.min('2d6+3'), 5, '2d6+3 minimum is 5');
t.eq(D.max('2d6+3'), 15, '2d6+3 maximum is 15');

/* --- checklist 1: advantage and disadvantage never stack, and they cancel -- */
t.section('checklist 1 — advantage never stacks, always cancels');
t.eq(D.netAdvantage(['flanking', 'prone target'], []), 1, 'two sources of advantage is still just advantage');
t.eq(D.netAdvantage(['flanking', 'prone'], ['obscured']), 0,
  'two advantages and one disadvantage cancel to a straight roll');
t.eq(D.netAdvantage([], ['blinded', 'prone']), -1, 'two disadvantages is still just disadvantage');
t.eq(D.netAdvantage(true, true), 0, 'advantage plus disadvantage cancels');
t.eq(D.netAdvantage(false, false), 0, 'neither is a straight roll');

let r = D.d20({ rng: scripted([7]), advantage: ['a', 'b'], disadvantage: ['c'], mod: 3 });
t.eq(r.rolls.length, 1, 'cancelled advantage rolls exactly ONE die (not two, not three)');
t.eq(r.total, 10, 'cancelled advantage totals die + modifier');

r = D.d20({ rng: scripted([7, 15]), advantage: true, mod: 2 });
t.eq(r.rolls.length, 2, 'advantage rolls two dice');
t.eq(r.natural, 15, 'advantage takes the higher die');
t.eq(r.total, 17, 'advantage total uses the higher die');

r = D.d20({ rng: scripted([7, 15]), disadvantage: true, mod: 2 });
t.eq(r.natural, 7, 'disadvantage takes the lower die');

r = D.d20({ rng: scripted([7, 15, 19]), advantage: true, elvenAccuracy: true });
t.eq(r.rolls.length, 3, 'elven accuracy rolls three dice');
t.eq(r.natural, 19, 'elven accuracy takes the highest of three');

r = D.d20({ rng: scripted([7, 15, 19]), elvenAccuracy: true });
t.eq(r.rolls.length, 1, 'elven accuracy does nothing without advantage');

t.section('d20 features');
r = D.d20({ rng: scripted([3]), minimumRoll: 10, mod: 5 });
t.eq(r.effective, 10, 'Reliable Talent raises a 3 to a 10');
t.eq(r.total, 15, 'the raised die feeds the total');
t.eq(r.isNat1, false, 'a raised 3 is not a natural 1... but');
r = D.d20({ rng: scripted([1]), minimumRoll: 10 });
t.eq(r.natural, 1, 'the natural die is still reported as 1 under Reliable Talent');
t.eq(r.effective, 10, 'while the effective value is raised');

r = D.d20({ rng: scripted([1, 14]), luckyReroll: true });
t.eq(r.natural, 14, 'Halfling Lucky rerolls a natural 1');

r = D.d20({ rng: scripted([10, 3]), mod: 2, bonusDice: '1d4' });
t.eq(r.total, 15, 'Bless adds its 1d4 to the total');

r = D.d20({ rng: scripted([12]), mod: 3, dc: 15 });
t.eq(r.success, true, 'meeting the DC succeeds (15 vs DC 15)');
t.eq(r.margin, 0, 'margin is zero when exactly meeting the DC');
r = D.d20({ rng: scripted([11]), mod: 3, dc: 15 });
t.eq(r.success, false, 'one under the DC fails');

/* --------- checklist 3: crit auto-hit, nat 1 auto-miss, and NOT on checks -- */
t.section('checklist 3 — natural 20 and 1 on attacks only');
let a = D.attack({ rng: scripted([20]), mod: 0, ac: 25 });
t.eq(a.hit, true, 'a natural 20 hits AC 25 with no modifier');
t.eq(a.isCrit, true, 'a natural 20 is a critical hit');

a = D.attack({ rng: scripted([1]), mod: 20, ac: 5 });
t.eq(a.hit, false, 'a natural 1 misses AC 5 even at +20');
t.eq(a.isFumble, true, 'a natural 1 is a fumble');

a = D.attack({ rng: scripted([19]), mod: 0, ac: 10, critRange: 19 });
t.eq(a.isCrit, true, 'Improved Critical crits on a 19');
a = D.attack({ rng: scripted([19]), mod: 0, ac: 10 });
t.eq(a.isCrit, false, 'without Improved Critical a 19 is an ordinary hit');
t.eq(a.hit, true, 'and it still hits');

/* 2014 RAW: ability checks and saving throws have no automatic success or
   failure on a natural 20 or 1. Only attack rolls and death saves do. */
r = D.d20({ rng: scripted([20]), mod: -5, dc: 30 });
t.eq(r.success, false, 'a natural 20 on an ability CHECK does not auto-succeed (2014 RAW)');
r = D.d20({ rng: scripted([1]), mod: 25, dc: 15 });
t.eq(r.success, true, 'a natural 1 on a saving throw does not auto-fail (2014 RAW)');

/* --------- checklist 2 & 4: crits double dice, never flat modifiers -------- */
t.section('checklist 2 — critical hits double dice, not modifiers');
let dmg = D.damage('2d6+3', { rng: scripted([4, 5, 6, 2]), crit: true, type: 'slashing' });
t.eq(dmg.base.total, 12, 'base 2d6+3 with 4,5 is 12');
t.eq(dmg.critDice.total, 8, 'the crit adds another 2d6 (6+2), and no modifier');
t.eq(dmg.total, 20, 'critical total is 12 + 8 = 20, not 24');

/* Greatsword 2d6, +3 Str, plus Divine Smite 2d8. On a crit all the DICE
   double — weapon and smite alike — while the +3 is added once. */
dmg = D.damage('2d6+3+2d8', {
  rng: scripted([3, 3, /*smite*/ 5, 5, /*crit weapon*/ 6, 6, /*crit smite*/ 8, 8]),
  crit: true, type: 'radiant',
});
t.eq(dmg.base.total, 19, 'base greatsword+smite: 3+3+3+5+5 = 19');
t.eq(dmg.critDice.total, 28, 'crit adds 2d6+2d8 (6+6+8+8), modifier not doubled');
t.eq(dmg.total, 47, 'total is 19 + 28 = 47');

dmg = D.damage('1d8+4', { rng: scripted([5]), crit: false });
t.eq(dmg.total, 9, 'a non-crit does not roll extra dice');
t.eq(dmg.critDice, null, 'and reports no crit dice');

dmg = D.damage('1d4-6', { rng: scripted([1]) });
t.eq(dmg.total, 0, 'damage never goes below zero');

/* Brutal Critical adds one more weapon die on a crit. */
dmg = D.damage('1d12+4', { rng: scripted([6, 10, 9]), crit: true, brutal: 1 });
t.eq(dmg.total, 10 + 10 + 9, 'Brutal Critical 1 adds an extra weapon die on the crit');

/* ---- checklist 5: resistance / vulnerability / flat reduction ordering ---- */
t.section('checklist 5 — damage modifier ordering');
t.eq(D.applyDamageModifiers(10, { resistant: true }).final, 5, '10 slashing resisted is 5');
t.eq(D.applyDamageModifiers(11, { resistant: true }).final, 5, 'resistance rounds down (11 -> 5)');
t.eq(D.applyDamageModifiers(10, { vulnerable: true }).final, 20, 'vulnerability doubles');
t.eq(D.applyDamageModifiers(10, { vulnerable: true, resistant: true }).final, 10,
  'vulnerable and resistant cancel out (double then halve)');
t.eq(D.applyDamageModifiers(50, { immune: true }).final, 0, 'immunity is zero');
t.eq(D.applyDamageModifiers(10, { immune: true, vulnerable: true }).final, 0,
  'immunity beats vulnerability');
/* Heavy Armor Master: flat reduction applies BEFORE doubling/halving in our
   defined pipeline (bonuses -> flat -> x2 vuln -> /2 resist). */
t.eq(D.applyDamageModifiers(10, { flatReduction: 3 }).final, 7, 'flat reduction subtracts');
t.eq(D.applyDamageModifiers(10, { flatReduction: 3, resistant: true }).final, 3,
  'flat reduction then resistance: (10-3)/2 = 3');
t.eq(D.applyDamageModifiers(2, { flatReduction: 5 }).final, 0, 'flat reduction cannot go below zero');
t.eq(D.applyDamageModifiers(1, { resistant: true }).final, 0, '1 damage resisted rounds down to 0');

/* -------------------------------------------------------- determinism ---- */
t.section('determinism and replay');
const seedA = new RNG('glass-fen');
const seedB = new RNG('glass-fen');
const runA = [], runB = [];
for (let i = 0; i < 50; i++) runA.push(D.roll('1d20+3', { rng: seedA }).total);
for (let i = 0; i < 50; i++) runB.push(D.roll('1d20+3', { rng: seedB }).total);
t.deep(runA, runB, 'the same seed produces the same 50 rolls');

const mid = new RNG('glass-fen');
for (let i = 0; i < 20; i++) D.roll('1d20+3', { rng: mid });
const restored = RNG.fromState(mid.state());
const tailA = [], tailB = [];
for (let i = 0; i < 10; i++) tailA.push(D.roll('1d20+3', { rng: mid }).total);
for (let i = 0; i < 10; i++) tailB.push(D.roll('1d20+3', { rng: restored }).total);
t.deep(tailA, tailB, 'an RNG restored from state continues the same sequence');

const forkA = new RNG('x').fork('loot');
const forkB = new RNG('x').fork('loot');
t.eq(forkA.next(), forkB.next(), 'forked streams are reproducible from the parent seed');
t.ok(new RNG('x').fork('loot').next() !== new RNG('x').fork('encounter').next(),
  'differently-labelled forks diverge');

t.section('distribution sanity');
const rng = new RNG(12345);
const counts = new Array(21).fill(0);
for (let i = 0; i < 60000; i++) counts[D.roll('1d20', { rng }).total]++;
let minC = Infinity, maxC = 0;
for (let f = 1; f <= 20; f++) { minC = Math.min(minC, counts[f]); maxC = Math.max(maxC, counts[f]); }
t.ok(minC > 2600 && maxC < 3400, 'd20 faces are roughly uniform over 60k rolls',
  '(min ' + minC + ', max ' + maxC + ')');

const advRng = new RNG(999);
let advSum = 0, flatSum = 0;
for (let i = 0; i < 20000; i++) advSum += D.d20({ rng: advRng, advantage: true }).natural;
for (let i = 0; i < 20000; i++) flatSum += D.d20({ rng: advRng }).natural;
t.near(advSum / 20000, 13.825, 0.25, 'advantage averages about 13.83 on a d20');
t.near(flatSum / 20000, 10.5, 0.25, 'a straight d20 averages about 10.5');

t.section('initiative');
const order = D.initiative([
  { id: 'shen', mod: 1, dex: 12 },
  { id: 'gate-born', mod: 3, dex: 16 },
  { id: 'aldren', mod: 0, dex: 10 },
], { rng: new RNG('init') });
t.eq(order.length, 3, 'initiative returns every combatant');
t.ok(order[0].total >= order[1].total && order[1].total >= order[2].total,
  'initiative is sorted highest first');
t.ok(order.every(o => o.roll && typeof o.roll.natural === 'number'),
  'every initiative entry keeps its roll for the log');

t.section('explain');
a = D.attack({ rng: scripted([18]), mod: 5, ac: 16 });
t.ok(/d20 \[18\] \+5 = 23 vs AC 16 — hit/.test(D.explain(a)),
  'an attack explains itself in full', '(' + D.explain(a) + ')');
r = D.d20({ rng: scripted([9, 14]), mod: 2, advantage: true, dc: 15 });
t.ok(/adv/.test(D.explain(r)) && /success/.test(D.explain(r)),
  'a check shows advantage and the outcome', '(' + D.explain(r) + ')');
dmg = D.damage('2d6+3', { rng: scripted([4, 5, 6, 2]), crit: true, type: 'slashing' });
t.ok(/crit/.test(D.explain(dmg)) && /20 slashing/.test(D.explain(dmg)),
  'damage explains its crit dice and type', '(' + D.explain(dmg) + ')');

t.done();
