/*
 * tests/core.test.js — commands, the event log, state, knowledge and dispatch.
 *
 * These are the invariants everything else rests on: that a command applies
 * exactly once, that a stale one cannot apply at all, that undo rewinds the
 * RNG as well as the world, and that knowledge only ever moves through
 * knowledge events.
 */
'use strict';
const t = require('./_harness')('core');
const { RNG } = require('../js/rng.js');
const Command = require('../js/engine/command.js');
const Events = require('../js/engine/events.js');
const Knowledge = require('../js/engine/knowledge.js');
const State = require('../js/engine/state.js');
const Dispatch = require('../js/engine/dispatch.js');

function actorFixture(id, name, side, hp) {
  return {
    id, name, side, kind: side === 'party' ? 'pc' : 'npc',
    base: { name, abilities: { str: 14, dex: 12, con: 14, int: 10, wis: 12, cha: 10 } },
    progression: { xp: 0, levels: [] },
    runtime: {
      hp: hp, hpMax: hp, tempHp: 0, conditions: {}, exhaustion: 0,
      concentratingOn: null, attuned: [], equipped: {}, inventory: [],
      deathSaves: { successes: 0, failures: 0 }, gold: 10,
      pos: { x: 0, y: 0 }, resources: {},
    },
  };
}

function freshGame() {
  const s = State.create({ seed: 'glass-fen', campaignId: 'shen' });
  State.addActor(s, actorFixture('shen', 'Shen Cooper', 'party', 27));
  State.addActor(s, actorFixture('aldren', 'Sir Aldren Vey', 'party', 24));
  State.addActor(s, actorFixture('gateborn', 'Gate-Born', 'enemy', 40));
  return s;
}

/* ------------------------------------------------------------- commands -- */
t.section('command validation');
let cmd = Command.create({
  actorId: 'shen', family: 'combat',
  primary: Command.makeStep({ verb: 'attack', targetIds: ['gateborn'] }),
});
t.eq(Command.validateStructure(cmd).ok, true, 'a well-formed attack validates');

t.eq(Command.validateStructure(Command.create({
  actorId: 'shen', family: 'combat', primary: Command.makeStep({ verb: 'attack' }),
})).ok, false, 'an attack with no target is rejected');

t.eq(Command.validateStructure(Command.create({
  actorId: 'shen', family: 'combat', primary: Command.makeStep({ verb: 'cast', spellId: 'bless' }),
})).ok, false, 'a cast in the combat family is rejected as the wrong family');

t.eq(Command.validateStructure(Command.create({
  actorId: 'shen', family: 'spell', primary: Command.makeStep({ verb: 'cast' }),
})).ok, false, 'a cast with no spell is rejected');

t.eq(Command.validateStructure(Command.create({
  actorId: 'shen', family: 'combat', primary: Command.makeStep({ verb: 'teleport_behind_you' }),
})).ok, false, 'an invented verb is rejected');

t.eq(Command.validateStructure(Command.create({
  actorId: null, family: 'combat', primary: Command.makeStep({ verb: 'dodge' }),
})).ok, false, 'a command with no actor is rejected');

t.eq(Command.validateStructure(Command.create({
  actorId: 'shen', family: 'meta', needsClarification: true, clarificationQuestion: 'Which door?',
})).ok, true, 'a clarification request needs no step');

t.eq(Command.validateStructure(Command.create({
  actorId: 'shen', family: 'meta', needsClarification: true,
})).ok, false, 'a clarification request with no question is rejected');

/* A follow-up may legitimately be from another family — "drink, then charge". */
const compound = Command.create({
  actorId: 'shen', family: 'item',
  primary: Command.makeStep({ verb: 'drink', itemId: 'potion-healing' }),
  followUp: Command.makeStep({ verb: 'attack', targetIds: ['gateborn'] }),
});
t.eq(Command.validateStructure(compound).ok, true,
  'a compound action (drink then attack) validates across families');
t.ok(/drink potion-healing then attack/.test(Command.describe(compound)),
  'a compound action describes itself', '(' + Command.describe(compound) + ')');

const social = Command.create({
  actorId: 'shen', family: 'social',
  primary: Command.makeStep({
    verb: 'persuade', targetIds: ['lysa'],
    social: Command.makeSocial({ proposition: 'Let us see the abbey', approach: 'earnest', audience: 'private' }),
  }),
});
t.eq(Command.validateStructure(social).ok, true, 'a social command with a proposition validates');
t.ok(/Let us see the abbey/.test(Command.describe(social)), 'social intent survives into the description');

const improv = Command.create({
  actorId: 'shen', family: 'improvised',
  primary: Command.makeStep({
    verb: 'improvise',
    improvised: Command.makeImprovised({ desiredOutcome: 'drop the chandelier on them', method: 'cut the rope' }),
  }),
});
t.eq(Command.validateStructure(improv).ok, true, 'an improvised action validates');
t.eq(Command.validateStructure(Command.create({
  actorId: 'shen', family: 'improvised', primary: Command.makeStep({ verb: 'improvise' }),
})).ok, false, 'improvise with no payload is rejected');

/* ------------------------------------------------------------- freshness -- */
t.section('freshness, staleness and idempotency');
let g = freshGame();
g.revision = 5; g.turnEpoch = 2;

const current = Command.create({ actorId: 'shen', family: 'meta', stateRevision: 5, turnEpoch: 2, primary: Command.makeStep({ verb: 'pass' }) });
t.eq(Command.checkFreshness(current, g).ok, true, 'a command built against the current revision is fresh');

const staleRev = Command.create({ actorId: 'shen', family: 'meta', stateRevision: 3, turnEpoch: 2, primary: Command.makeStep({ verb: 'pass' }) });
t.eq(Command.checkFreshness(staleRev, g).reason, 'stale', 'an old revision is stale');

const staleTurn = Command.create({ actorId: 'shen', family: 'meta', stateRevision: 5, turnEpoch: 1, primary: Command.makeStep({ verb: 'pass' }) });
t.eq(Command.checkFreshness(staleTurn, g).reason, 'stale', 'a command from a previous turn is stale');

g.appliedCommandIds = { 'cmd_already': 4 };
const dupe = Command.create({ commandId: 'cmd_already', actorId: 'shen', family: 'meta', primary: Command.makeStep({ verb: 'pass' }) });
t.eq(Command.checkFreshness(dupe, g).reason, 'duplicate', 'an already-applied command is a duplicate, not stale');

/* ----------------------------------------------------------- event batch -- */
t.section('event batches and atomic commit');
g = freshGame();
let batch = Events.makeBatch({ commandId: 'cmd_1', actorId: 'shen' });
Events.push(batch, 'hp', { targetId: 'gateborn', delta: -12 }, 'Shen hits the Gate-Born for 12.');
Events.push(batch, 'condition_add', { targetId: 'gateborn', condition: 'prone' }, 'It is knocked prone.');
let res = Events.commit(g, batch);
t.eq(res.ok, true, 'a batch commits');
t.eq(g.actors.gateborn.runtime.hp, 28, 'damage applied');
t.eq(g.revision, 1, 'the revision advanced');
t.deep(Object.keys(g.actors.gateborn.runtime.conditions), ['prone'], 'the condition applied');
t.eq(g.log.length, 1, 'the batch is in the log');

res = Events.commit(g, batch);
t.eq(res.duplicate, true, 're-committing the same batch is a no-op duplicate');
t.eq(g.actors.gateborn.runtime.hp, 28, 'and does NOT apply the damage twice');
t.eq(g.revision, 1, 'and does not advance the revision');

t.section('temp HP does not stack (2014)');
g = freshGame();
batch = Events.makeBatch({ commandId: 'c_t1' });
Events.push(batch, 'temp_hp', { targetId: 'shen', amount: 5 });
Events.commit(g, batch);
t.eq(g.actors.shen.runtime.tempHp, 5, 'first temp HP pool is 5');
batch = Events.makeBatch({ commandId: 'c_t2' });
Events.push(batch, 'temp_hp', { targetId: 'shen', amount: 8 });
Events.commit(g, batch);
t.eq(g.actors.shen.runtime.tempHp, 8, 'gaining 8 while holding 5 gives 8, not 13');
batch = Events.makeBatch({ commandId: 'c_t3' });
Events.push(batch, 'temp_hp', { targetId: 'shen', amount: 3 });
Events.commit(g, batch);
t.eq(g.actors.shen.runtime.tempHp, 8, 'a smaller pool does not replace a larger one');

t.section('hit points clamp');
g = freshGame();
batch = Events.makeBatch({ commandId: 'c_h' });
Events.push(batch, 'hp', { targetId: 'shen', delta: -500 });
Events.commit(g, batch);
t.eq(g.actors.shen.runtime.hp, 0, 'hit points never go below zero');
batch = Events.makeBatch({ commandId: 'c_h2' });
Events.push(batch, 'hp', { targetId: 'shen', delta: 500 });
Events.commit(g, batch);
t.eq(g.actors.shen.runtime.hp, 27, 'healing never exceeds the maximum');

t.section('attunement cap');
g = freshGame();
batch = Events.makeBatch({ commandId: 'c_a' });
['a', 'b', 'c', 'd'].forEach(u => Events.push(batch, 'item_attune', { actorId: 'shen', uid: u }));
Events.commit(g, batch);
t.eq(g.actors.shen.runtime.attuned.length, 3, 'a character can attune to at most three items');

t.section('relationships clamp and record why');
g = freshGame();
batch = Events.makeBatch({ commandId: 'c_r' });
Events.push(batch, 'relationship', { fromId: 'aldren', toId: 'shen', affinity: 15, trust: 10, because: 'Shen stood between him and the fen-light.' });
Events.commit(g, batch);
let rel = g.relationships['aldren->shen'];
t.eq(rel.affinity, 15, 'affinity applied');
t.eq(rel.history.length, 1, 'the reason is recorded, not just the number');
batch = Events.makeBatch({ commandId: 'c_r2' });
Events.push(batch, 'relationship', { fromId: 'aldren', toId: 'shen', affinity: 1000 });
Events.commit(g, batch);
t.eq(g.relationships['aldren->shen'].affinity, 100, 'affinity clamps at 100');

t.section('a failing applier leaves the revision alone');
g = freshGame();
const before = g.revision;
batch = Events.makeBatch({ commandId: 'c_bad' });
batch.events.push({ kind: 'hp', targetId: 'shen', delta: -1 });
batch.events.push({ kind: 'no_such_kind', seq: 999 });
res = Events.commit(g, batch);
t.eq(res.ok, false, 'a batch with an unknown event kind fails to commit');
t.eq(g.revision, before, 'and the revision does not move');
t.throws(() => Events.makeEvent('invented_kind', {}), 'makeEvent refuses an unknown kind outright');

/* ------------------------------------------------------------- knowledge -- */
t.section('knowledge: staged, per-observer, one-way');
const store = Knowledge.makeStore();
Knowledge.defineFacts(store, [
  {
    id: 'warden.price', topic: 'plot',
    claim: 'The Warden takes a day of the Keeper\u2019s life for each awakening.',
    partial: 'The Warden exacts some price for waking.',
    hint: 'Something about the Warden feels transactional.',
    forbiddenUntilKnown: ['Hollow King', 'the price of years'],
    revealWhen: st => !!(st.flags && st.flags.touchedTheSteel),
  },
  { id: 'fen.wet', topic: 'place', claim: 'The Glass Fen is waterlogged year round.', spoiler: false },
]);

g = freshGame();
t.eq(Knowledge.stageOf(store, 'shen', 'warden.price'), 'none', 'nobody starts knowing a secret');
t.eq(Knowledge.textFor(store, 'shen', 'warden.price'), null,
  'an unknown fact renders as nothing at all, not as "you do not know"');

batch = Events.makeBatch({ commandId: 'c_k1' });
batch.events.push(Knowledge.learnEvent('shen', 'warden.price', 'hinted', 'the Steel went cold in his hand'));
Events.commit(g, batch);
store.known = g.knowledge;
t.eq(Knowledge.stageOf(store, 'shen', 'warden.price'), 'hinted', 'a hint is recorded');
t.eq(Knowledge.textFor(store, 'shen', 'warden.price'), 'Something about the Warden feels transactional.',
  'a hinted fact renders as the hint, never the full claim');
t.eq(Knowledge.knows(store, 'shen', 'warden.price', 'full'), false, 'a hint is not full knowledge');

batch = Events.makeBatch({ commandId: 'c_k2' });
batch.events.push(Knowledge.learnEvent('shen', 'warden.price', 'full', 'the Warden said so plainly'));
Events.commit(g, batch);
store.known = g.knowledge;
t.eq(Knowledge.textFor(store, 'shen', 'warden.price').indexOf('day of the Keeper') > 0, true,
  'full knowledge renders the full claim');

batch = Events.makeBatch({ commandId: 'c_k3' });
batch.events.push(Knowledge.learnEvent('shen', 'warden.price', 'hinted', 'a rumour'));
Events.commit(g, batch);
store.known = g.knowledge;
t.eq(Knowledge.stageOf(store, 'shen', 'warden.price'), 'full',
  'knowledge only advances — a later hint cannot walk it backwards');

t.eq(Knowledge.stageOf(store, 'aldren', 'warden.price'), 'none',
  'knowledge is per-observer: Aldren did not learn what Shen learned');

t.section('knowledge: revealability is not knowledge');
t.deep(Knowledge.revealable(store, g), [], 'nothing is revealable while the predicate is unmet');
g.flags.touchedTheSteel = true;
t.deep(Knowledge.revealable(store, g), ['warden.price'], 'the predicate opens the reveal');
t.eq(Knowledge.stageOf(store, 'aldren', 'warden.price'), 'none',
  'but becoming revealable did NOT teach anyone anything');

t.section('knowledge: forbidden names and leak auditing');
const names = Knowledge.forbiddenNames(store, 'aldren');
t.ok(names.indexOf('Hollow King') >= 0, 'a name stays forbidden for someone who has not earned the fact');
t.ok(names[0].length >= names[names.length - 1].length, 'forbidden names are longest-first for safe redaction');
t.eq(Knowledge.forbiddenNames(store, 'shen').indexOf('Hollow King'), -1,
  'and is released once that observer knows the fact');

let leaks = Knowledge.auditLeaks(store, 'aldren', 'The fog thickened, and the Hollow King stirred.');
t.eq(leaks.length, 1, 'a forbidden name in prose is caught by the audit');
t.eq(leaks[0].kind, 'forbidden-name', 'and is reported as a forbidden name');
t.eq(Knowledge.auditLeaks(store, 'shen', 'The fog thickened, and the Hollow King stirred.').length, 0,
  'the same prose is fine for an observer who has earned it');
t.eq(Knowledge.auditLeaks(store, 'aldren', 'The fen is waterlogged year round.').length, 0,
  'non-spoiler facts are never treated as leaks');

/* ----------------------------------------------------------- observation -- */
t.section('observation: the single door');
g = freshGame();
g.knowledge = { shen: { 'fen.wet': { stage: 'full' } } };
store.known = g.knowledge;

let obs = Knowledge.getObservation(g, store, 'shen', {});
t.ok(obs.actors.shen && obs.actors.aldren && obs.actors.gateborn, 'a visible enemy appears in the observation');
t.eq(obs.actors.shen.hp, 27, 'you see your own exact hit points');
t.eq(obs.actors.gateborn.hp, null, 'you do NOT see an enemy\u2019s exact hit points');
t.eq(obs.actors.gateborn.health, 'unhurt', 'you see a descriptive band instead');
t.eq(obs.actors.aldren.hp, 24, 'you see an ally\u2019s exact hit points');

g.actors.gateborn.runtime.hp = 8;
obs = Knowledge.getObservation(g, store, 'shen', {});
t.eq(obs.actors.gateborn.health, 'badly wounded', 'the band tracks actual health');

g.actors.gateborn.runtime.hiddenFrom = { shen: true };
obs = Knowledge.getObservation(g, store, 'shen', {});
t.eq(obs.actors.gateborn, undefined, 'a creature hidden from you is absent from your observation');
t.eq(obs.targetableIds.indexOf('gateborn'), -1,
  'and therefore cannot appear in an enumerated target list');

g.actors.gateborn.runtime.hiddenFrom = {};
g.actors.gateborn.runtime.invisible = true;
obs = Knowledge.getObservation(g, store, 'shen', {});
t.eq(obs.actors.gateborn, undefined, 'an invisible creature is not observed');
g.actors.shen.runtime.senses = { seeInvisible: true };
obs = Knowledge.getObservation(g, store, 'shen', {});
t.ok(!!obs.actors.gateborn, 'unless the observer can see invisible creatures');
g.actors.gateborn.runtime.invisible = false;

t.section('observation: the DM view');
g.flags.touchedTheSteel = true;
let dm = Knowledge.getObservation(g, store, 'dm', { mode: 'dm', partyId: 'shen' });
t.eq(dm.actors.gateborn.hp, 8, 'the DM sees exact enemy hit points');
t.ok(Array.isArray(dm.mayReveal), 'the DM is told what it may reveal');
t.ok(Array.isArray(dm.mustNotName), 'and what it must not name');
t.eq(dm.facts['warden.price'], undefined,
  'a fact the party has not earned is ABSENT from the DM prompt, not present-but-forbidden');

/* ---------------------------------------------------------------- state --- */
t.section('checkpoint, undo and redo');
g = freshGame();
const history = State.makeHistory();
t.eq(State.canUndo(history), false, 'nothing to undo at the start');

State.checkpoint(history, g, 'cmd_x');
batch = Events.makeBatch({ commandId: 'cmd_x' });
Events.push(batch, 'hp', { targetId: 'shen', delta: -10 });
Events.commit(g, batch);
t.eq(g.actors.shen.runtime.hp, 17, 'damage applied');

State.undo(history, g);
t.eq(g.actors.shen.runtime.hp, 27, 'undo restores hit points');
t.eq(g.revision, 0, 'undo restores the revision');
t.eq(g.log.length, 0, 'undo removes the batch from the log');

State.redo(history, g);
t.eq(g.actors.shen.runtime.hp, 17, 'redo re-applies');

t.section('undo rewinds the RNG, not just the world');
g = freshGame();
const h2 = State.makeHistory();
const firstDraws = [];
for (let i = 0; i < 3; i++) firstDraws.push(g.rng.int(1, 20));
State.checkpoint(h2, g, 'roll-point');
const afterA = [g.rng.int(1, 20), g.rng.int(1, 20)];
State.undo(h2, g);
const afterB = [g.rng.int(1, 20), g.rng.int(1, 20)];
t.deep(afterA, afterB,
  'rolls after an undo repeat exactly — the RNG rewound with the world');

t.section('branch-aware undo discards a stale redo');
g = freshGame();
const h3 = State.makeHistory();
State.checkpoint(h3, g, 'a');
Events.commit(g, (() => { const b = Events.makeBatch({ commandId: 'a' }); Events.push(b, 'hp', { targetId: 'shen', delta: -5 }); return b; })());
State.undo(h3, g);
t.eq(State.canRedo(h3), true, 'redo is available after an undo');
State.checkpoint(h3, g, 'b');
t.eq(State.canRedo(h3), false, 'taking a new action abandons the redo branch');

t.section('digest');
g = freshGame();
State.say(g, 'DM', 'The causeway is under a hand of water.', 'narration');
const dg = State.digest(g);
t.eq(dg.party.length, 2, 'the digest lists the party');
t.eq(dg.transcriptLines, 1, 'the digest counts transcript lines');
t.eq(dg.campaignId, 'shen', 'the digest names the campaign');

/* -------------------------------------------------------------- dispatch -- */
t.section('dispatch: the single door');
g = freshGame();
const h4 = State.makeHistory();

Dispatch.register('combat', function resolveCombat(state, command) {
  const b = Events.makeBatch(command);
  const roll = state.rng.int(1, 20);
  if (roll < 8) {
    Events.push(b, 'note', { text: 'miss' }, 'The blow goes wide.');
  } else {
    Events.push(b, 'hp', { targetId: command.primary.targetIds[0], delta: -6 },
      'A solid hit for 6 damage.');
  }
  return b;
});
Dispatch.register('meta', function resolveMeta(state, command) {
  const b = Events.makeBatch(command);
  Events.push(b, 'note', { text: command.primary.verb }, 'passes');
  return b;
});

t.deep(Dispatch.registered().sort(), ['combat', 'meta'], 'resolvers register per family');

let out = Dispatch.dispatch(g, h4, Command.create({
  sessionId: g.sessionId, stateRevision: g.revision, turnEpoch: g.turnEpoch,
  actorId: 'shen', family: 'combat',
  primary: Command.makeStep({ verb: 'attack', targetIds: ['gateborn'] }),
}), {});
t.eq(out.ok, true, 'a valid command dispatches');
t.eq(out.stage, 'committed', 'and reaches the committed stage');
t.ok(out.beats.length > 0, 'and produces beats for the narrator');
t.eq(g.revision, 1, 'and advances the revision');

out = Dispatch.dispatch(g, h4, Command.create({
  actorId: 'shen', family: 'combat', primary: Command.makeStep({ verb: 'attack' }),
}), {});
t.eq(out.ok, false, 'an invalid command is rejected');
t.eq(out.stage, 'validate', 'at the validation stage');
t.eq(g.revision, 1, 'and changes nothing');

out = Dispatch.dispatch(g, h4, Command.create({
  actorId: 'shen', family: 'combat', stateRevision: 0, turnEpoch: 0,
  primary: Command.makeStep({ verb: 'attack', targetIds: ['gateborn'] }),
}), {});
t.eq(out.ok, false, 'a stale command is rejected');
t.eq(out.stage, 'stale', 'at the staleness stage');
t.eq(g.revision, 1, 'and changes nothing');

out = Dispatch.dispatch(g, h4, Command.create({
  actorId: 'shen', family: 'exploration',
  primary: Command.makeStep({ verb: 'search' }),
}), {});
t.eq(out.ok, false, 'a family with no resolver is rejected rather than silently ignored');

t.section('dispatch: a throwing resolver leaves no trace');
Dispatch.register('improvised', function () { throw new Error('boom'); });
const revBefore = g.revision;
const hpBefore = g.actors.shen.runtime.hp;
out = Dispatch.dispatch(g, h4, Command.create({
  actorId: 'shen', family: 'improvised', stateRevision: g.revision, turnEpoch: g.turnEpoch,
  primary: Command.makeStep({ verb: 'improvise', improvised: Command.makeImprovised({ desiredOutcome: 'x' }) }),
}), {});
t.eq(out.ok, false, 'a resolver that throws fails the dispatch');
t.eq(g.revision, revBefore, 'the revision is untouched');
t.eq(g.actors.shen.runtime.hp, hpBefore, 'and the world is untouched');

t.section('dispatch: clarification never touches state');
const revB = g.revision;
out = Dispatch.dispatch(g, h4, Command.create({
  actorId: 'shen', family: 'meta',
  needsClarification: true, clarificationQuestion: 'The near door or the far one?',
}), {});
t.eq(out.ok, true, 'a clarification request is a successful non-action');
t.eq(out.stage, 'clarify', 'reported as a clarification');
t.eq(out.batch, null, 'with no batch');
t.eq(g.revision, revB, 'and no state change');

t.section('narration is not a state change');
g = freshGame();
const h5 = State.makeHistory();
out = Dispatch.dispatch(g, h5, Command.create({
  sessionId: g.sessionId, stateRevision: g.revision, turnEpoch: g.turnEpoch,
  actorId: 'shen', family: 'combat',
  primary: Command.makeStep({ verb: 'attack', targetIds: ['gateborn'] }),
}), {});
const revAfterCommit = g.revision;
Dispatch.narrate(g, out.batch.commandId, 'The blade meets something that does not bleed.');
t.eq(g.revision, revAfterCommit, 'narrating does not advance the revision');
t.eq(g.log[0].narration, 'The blade meets something that does not bleed.', 'the prose attaches to the batch');
t.eq(g.transcript[g.transcript.length - 1].kind, 'narration', 'and reaches the transcript');

t.section('replay: folding the log reproduces the world');
g = freshGame();
const h6 = State.makeHistory();
const pristine = State.snapshot(g);
for (let i = 0; i < 6; i++) {
  Dispatch.dispatch(g, h6, Command.create({
    sessionId: g.sessionId, stateRevision: g.revision, turnEpoch: g.turnEpoch,
    actorId: 'shen', family: 'combat',
    primary: Command.makeStep({ verb: 'attack', targetIds: ['gateborn'] }),
  }), {});
}
const liveHp = g.actors.gateborn.runtime.hp;
const base = JSON.parse(JSON.stringify(pristine));
delete base.rngState;
const folded = Events.fold(base, g.log);
t.eq(folded.actors.gateborn.runtime.hp, liveHp,
  'folding the event log reproduces the same hit points');
t.eq(folded.revision, g.revision, 'and the same revision');

/* ------------------------------------------------ commit is trustworthy -- */
/* These are the invariants the whole engine rests on. Each one has been
   violated at least once, and each failure was silent. */
t.section('committing a batch keeps the world consistent');
{
  const Ch = require('../js/engine/character.js');
  const CG = require('../js/gen/chargen.js');
  const { RNG: R } = require('../js/rng.js');

  /* A cleric built by the generator, because the bug that prompted this only
     appeared with real data: preparedSpells and spellbook were the SAME array,
     so merging one key rewrote the other straight back and preparing spells
     silently did nothing. */
  const c = Ch.buildFromSpec(CG.generate({ rng: new R('commit'), fixed: { classId: 'cleric', levels: 5 } }));
  t.ok(c.progression.preparedSpells !== c.progression.spellbook,
    'a built character\u2019s prepared list and spellbook are separate arrays');

  const s = State.create({ seed: 'commit' });
  State.addActor(s, {
    id: 'a', name: 'A', side: 'party', kind: 'pc',
    base: c.base, progression: c.progression, runtime: c.runtime,
  });
  const b = Events.makeBatch({ commandId: 'p1', actorId: 'a' });
  b.events.push({ kind: 'prepare_spells', actorId: 'a', spells: ['NEW'] });
  Events.commit(s, b);
  t.deep(s.actors.a.progression.preparedSpells, ['NEW'], 'a committed change is actually in the world');

  /* And the merge must not depend on nobody ever aliasing again. */
  const shared = ['old'];
  const s2 = State.create({ seed: 'alias' });
  State.addActor(s2, {
    id: 'a', name: 'A', side: 'party', kind: 'pc',
    base: { name: 'A', abilities: {}, classes: [] },
    progression: { levels: [], preparedSpells: shared, spellbook: shared },
    runtime: { hp: 9, hpMax: 9, conditions: {}, inventory: [], deathSaves: {} },
  });
  const b2 = Events.makeBatch({ commandId: 'p2', actorId: 'a' });
  b2.events.push({ kind: 'prepare_spells', actorId: 'a', spells: ['NEW'] });
  Events.commit(s2, b2);
  t.deep(s2.actors.a.progression.preparedSpells, ['NEW'],
    'two keys sharing one array cannot make a commit undo itself');

  /* Anything holding a reference across a commit must see the new world.
     Nothing does today; it reads as obviously correct and would fail
     silently, which is the worst combination. */
  const held = s2.actors.a;
  const heldRuntime = s2.actors.a.runtime;
  const b3 = Events.makeBatch({ commandId: 'p3', actorId: 'a' });
  b3.events.push({ kind: 'hp', targetId: 'a', delta: -3 });
  Events.commit(s2, b3);
  t.eq(held, s2.actors.a, 'an actor keeps its identity across a commit');
  t.eq(heldRuntime, s2.actors.a.runtime, 'and so does its runtime');
  t.eq(held.runtime.hp, 6, 'so a held reference sees the change');
}

t.done();
