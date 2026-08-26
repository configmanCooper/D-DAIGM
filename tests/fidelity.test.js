/*
 * tests/fidelity.test.js — the narrator must not contradict the dice.
 *
 * Every case here is a verbatim failure from a live playthrough, found by an
 * independent Dungeon Master reading the transcripts rather than by any test.
 * They share one shape: the engine settled what happened, and the prose said
 * something else. That is the worst thing this layer can do, because the
 * player reads the prose and acts on it — told an enemy fell silent, they
 * play as though it is dead, and the table desyncs from the engine.
 *
 * The prompt forbids all of it. A 4B model does it anyway, perhaps one turn in
 * five, which is why each rule is asked for AND checked.
 */
'use strict';

const t = require('./_harness')('fidelity');
const Narrator = require('../js/ai/narrator.js');

const gate = (text, beats) => Narrator.applyGates(text, { beats: beats || [] });
const has = (r, issue) => r.report.issues.indexOf(issue) >= 0;

/* ------------------------------------------------------------------ */
t.section('a setup is not a hit');
{
  /* Verbatim. Beat: "Shen Cooper distracts A Gate-Born; Sir Aldren Vey has
     the opening." Help grants advantage — no attack was rolled, nothing died.
     The model completed the implied attack, killed the enemy, and invented
     two more actions on top. */
  const r = gate(
    "Aldren drives his blade into the first Gate-Born's chest as it shrieks in pain " +
    "and falls silent. The second creature lunges blindly toward Mara.",
    ['Shen Cooper distracts A Gate-Born; Sir Aldren Vey has the opening.']);

  t.eq(has(r, 'phantom_outcome'), true,
    'prose that kills somebody off a Help beat is caught');
  t.eq(r.report.usable, false, 'and is not usable');
  t.eq(r.report.regenerate, true, 'so it is written again');
}

t.section('but the same prose is fine when the blow really landed');
{
  const r = gate(
    "Aldren drives his blade into the first Gate-Born's chest as it shrieks and falls silent.",
    ['Sir Aldren Vey swings at A Gate-Born.', 'Sir Aldren Vey hits for 9.', 'A Gate-Born dies.']);
  t.eq(has(r, 'phantom_outcome'), false,
    'a death the engine rolled may be narrated as a death');
  t.eq(r.report.usable, true, 'and passes');
}

/* ------------------------------------------------------------------ */
t.section('a miss draws no blood');
{
  /* Verbatim. Beat: "It goes wide." The prose drew blood, which tells the
     player the enemy is hurt when it is not — false information driving a
     real decision about whether to press or retreat. */
  const r = gate(
    "The ghostly spear vanishes into mist before its throat; blood sprays dark against the iron lanterns.",
    ['Brother Corvin Hale casts Spiritual Weapon at A Gate-Born.', 'It goes wide.']);
  t.eq(has(r, 'phantom_wound'), true, 'blood on a miss is caught');
  t.eq(r.report.usable, false, 'and rejected');
}

t.section('a clean miss passes');
{
  const r = gate(
    "The ghostly spear passes wide of its throat and breaks apart against the lantern iron.",
    ['Brother Corvin Hale casts Spiritual Weapon at A Gate-Born.', 'It goes wide.']);
  t.eq(r.report.usable, true, 'steel meeting air is exactly right');
  t.deep(r.report.issues, [], 'and nothing is flagged');
}

/* ------------------------------------------------------------------ */
t.section('the dice are not read aloud');
{
  /* "five points of damage settle into its flesh" is a character sheet read
     in a funny voice. The numbers are in the prompt so the model can judge
     how hard a blow landed, not so it can recite them. */
  const all = gate(
    "A sharp cry breaks as five points of damage settle into its flesh. Seven hit points return to Shen.",
    ['hits for 5', 'Shen Cooper recovers 7 hit points.']);
  t.eq(has(all, 'reads_numbers'), true, 'arithmetic in the prose is caught');
  t.eq(all.report.regenerate, true, 'and when it is ALL arithmetic, it is rewritten');

  const some = gate(
    "The axe comes down and the goblin folds around it. Five points of damage settle into its flesh. " +
    "Aldren steps up beside her, shield raised.",
    ['Dame Mara Thorne hits for 5.']);
  t.eq(has(some, 'reads_numbers'), true, 'one offending sentence among three is caught');
  t.eq(some.report.usable, true, 'the rest of the paragraph survives');
  t.eq(/points|damage/i.test(some.text), false, 'with the arithmetic gone');
  t.ok(/axe comes down/.test(some.text) && /shield raised/.test(some.text),
    'and the good sentences kept, whole', some.text);
  /* Cutting the words out mid-clause left "as settle into its flesh", which
     reads worse than the problem. Sentences, not words. */
  t.eq(/\bas settle\b/.test(some.text), false, 'not butchered mid-sentence');
}

/* ------------------------------------------------------------------ */
t.section('the narration never says "you"');
{
  /* Two failures at once: the point of view is third person by design, and
     "you feel no shock" decides what the player's character feels — which is
     the player's to say and nobody else's. */
  const r = gate(
    "The wolf's jaws snap shut on your ribs, and you feel no shock at all as the iron holds.",
    ['Wolf swings at Shen Cooper.', 'Wolf hits for 8.']);
  t.eq(has(r, 'second_person'), true, 'second person is caught');
  t.eq(r.report.usable, false, 'and rejected rather than patched');
}

/* ------------------------------------------------------------------ */
t.section('the prompt\u2019s own vocabulary stays out of the fiction');
{
  /* The model dramatised the stage direction's wording as in-world thought:
     characters consciously aware of the game's bookkeeping. */
  const r = gate(
    "Shen watches, aware that Mara's success is solid fact but knowing nothing of why she struck twice.",
    ['Dame Mara Thorne hits for 6.']);
  t.eq(has(r, 'meta_talk'), true, '"solid fact" is caught as scaffolding');
  t.eq(r.report.usable, false, 'and rejected');
}

/* ------------------------------------------------------------------ */
t.section('ordinary good narration passes untouched');
{
  /* The control. Gates that reject everything would pass every test above
     and make the game unplayable. */
  const good = [
    ["Mara's spear takes the goblin under the arm and it folds into the mud. Aldren shifts a pace left, shield up.",
      ['Dame Mara Thorne swings at Goblin A.', 'Dame Mara Thorne hits for 7.', 'Goblin A dies.']],
    ["Shen sets his shoulder behind the shield and the wolf's charge breaks on it. Mud sprays across the lantern glass.",
      ['Wolf swings at Shen Cooper.', 'The blow misses.', 'Shen Cooper takes the Dodge action.']],
    ["The lock gives with a dry click. Beyond the door the stair goes down into cold air.",
      ['Shen Cooper picks the lock.', 'The lock opens.']],
  ];
  good.forEach(([text, beats], i) => {
    const r = gate(text, beats);
    t.deep(r.report.issues, [], 'good narration ' + (i + 1) + ' passes with nothing flagged',
      r.report.issues.join(', '));
    t.eq(r.text.trim(), text.trim(), 'and is returned unchanged');
  });
}

t.section('the gates are registered as fatal or repairable');
{
  const fatal = Narrator.GATES.fatal;
  ['phantom_outcome', 'phantom_wound', 'second_person'].forEach(g => {
    t.ok(fatal.indexOf(g) >= 0, g + ' is fatal \u2014 prose that contradicts the dice is rewritten, not patched');
  });
  t.ok(Narrator.GATES.repairable.indexOf('reads_numbers') >= 0,
    'reads_numbers is repairable \u2014 the sentence goes, the paragraph stays');
}

t.done();
