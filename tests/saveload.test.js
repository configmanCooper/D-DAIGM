/*
 * tests/saveload.test.js — does a saved game come back the same game?
 *
 * A save is only worth anything if what comes back is what went in. This walks
 * a session through every subsystem the game has — combat, conditions,
 * concentration, spell slots, inventory, gold, attunement, quests, scene
 * contents, knowledge, relationships, the RNG position, the undo history —
 * then serialises, deserialises, and compares the two states field by field.
 *
 * Anything that does not survive is either a save bug or, worse, a field the
 * save layer has never heard of. The check therefore works from the STATE
 * rather than from a list of things to check: a new field added to the engine
 * shows up here automatically the moment it fails to round-trip.
 */
'use strict';

const t = require('./_harness')('saveload');
const State = require('../js/engine/state.js');
const Character = require('../js/engine/character.js');
const Events = require('../js/engine/events.js');
const Knowledge = require('../js/engine/knowledge.js');
const Dispatch = require('../js/engine/dispatch.js');
require('../js/engine/interaction.js');
require('../js/engine/combat.js');
const Save = require('../js/engine/save.js');
const Game = require('../js/game.js');
const camp = require('../campaigns/shen_cooper.js');
const cont = require('../campaigns/shen_continuation.js');

/* --------------------------------------------------------- a full game --- */

/**
 * A session with something going on in every subsystem, so the round trip has
 * something to lose.
 */
function busySession() {
  const st = State.create({ seed: 'saveload', campaignId: 'shen-cooper' });
  const store = Knowledge.makeStore();
  store.known = st.knowledge;
  cont.applyTo(st, store);

  /* A caster with slots spent, a concentration effect running, and a condition. */
  const wiz = Character.buildFromSpec({
    name: 'Ysolde Vane', raceId: 'human', classId: 'wizard', levels: 5,
    backgroundId: 'sage',
    abilities: { str: 8, dex: 15, con: 13, int: 17, wis: 12, cha: 11 },
    proficiencies: { skills: ['arcana', 'investigation'] },
  });
  wiz.runtime.pos = { x: 3, y: 3 };
  wiz.runtime.gold = 137;
  wiz.runtime.slotsSpent = { 1: 2, 2: 1 };
  wiz.runtime.tempHp = 7;
  wiz.runtime.concentratingOn = { spellId: 'haste', targetId: 'shen', rounds: 9 };
  wiz.runtime.conditions = { frightened: { rounds: 2, source: 'foe1' } };
  wiz.runtime.exhaustion = 2;
  wiz.runtime.hitDiceSpent = { d6: 2 };
  wiz.runtime.inventory.push(
    { uid: 'amulet1', id: 'amulet-of-health', name: 'a heavy amulet' },
    { uid: 'potion9', id: 'potion-of-healing', name: 'Potion of Healing' });
  wiz.runtime.attuned = ['amulet1'];
  State.addActor(st, {
    id: 'wiz', name: 'Ysolde Vane', side: 'party', kind: 'pc', role: 'wizard',
    base: wiz.base, progression: wiz.progression, runtime: wiz.runtime,
  });
  State.addSeat(st, { id: 'p2', name: 'Second', actorId: 'wiz', control: 'human' });

  State.refreshAllDerived(st);

  const sess = Game.createSession({ state: st, store, campaign: camp });
  sess.locations = camp.locations;
  sess.questDefs = cont.quests;
  Game.settle(sess);

  /* Put things in motion: a fight, some damage, a learned fact, a changed
     relationship, a quest step, a furnished scene with something taken. */
  const b = Events.makeBatch({ commandId: 'setup', actorId: 'shen' });
  Events.push(b, 'hp', { targetId: 'shen', delta: -6 }, 'A cut.');
  Events.push(b, 'relationship', { from: 'shen', to: 'aldren', delta: 2, why: 'stood by him' }, '');
  Events.push(b, 'flag', { flag: 'testFlag', value: 'kept' }, '');
  Events.push(b, 'time', { minutes: 95 }, '');
  Events.push(b, 'xp', { actorId: 'shen', delta: 450 }, '');
  Events.commit(st, b);

  /* A fight, with initiative and a spent action economy. */
  const foe = Character.buildFromSpec({
    name: 'Bandit', raceId: 'human', classId: 'fighter', levels: 2,
    backgroundId: 'soldier',
    abilities: { str: 14, dex: 12, con: 12, int: 8, wis: 10, cha: 8 },
    proficiencies: { skills: [] },
  });
  foe.runtime.pos = { x: 6, y: 3 };
  State.addActor(st, {
    id: 'foe1', name: 'Bandit', side: 'enemy', kind: 'monster',
    base: foe.base, progression: foe.progression, runtime: foe.runtime,
  });
  State.refreshAllDerived(st);
  Game.ensureEncounter(sess);
  if (st.actors.shen && st.actors.shen.runtime.turn) {
    st.actors.shen.runtime.turn.action = false;
    st.actors.shen.runtime.turn.movementRemaining = 10;
  }

  return sess;
}

/* ---------------------------------------------------------- comparison --- */

/**
 * Every leaf in an object, as a flat map of path → value.
 *
 * Working from the state rather than from a list of things to check is the
 * point: a field the save layer has never heard of shows up the moment it
 * fails to come back, without anyone remembering to add it here.
 */
function flatten(value, path, out, depth) {
  out = out || {};
  path = path || '';
  depth = depth || 0;
  if (depth > 12) return out;
  if (value == null || typeof value !== 'object') {
    out[path] = value;
    return out;
  }
  if (Array.isArray(value)) {
    out[path + '.length'] = value.length;
    value.forEach((v, i) => flatten(v, path + '[' + i + ']', out, depth + 1));
    return out;
  }
  Object.keys(value).forEach(k => {
    flatten(value[k], path ? path + '.' + k : k, out, depth + 1);
  });
  return out;
}

/* Things that are EXPECTED to differ, with the reason. Anything not on this
   list that changes is a bug. */
const EXPECTED_TO_DIFFER = [
  /^rng\b/,          // restored from rngState, so the object differs
  /^rngState\b/,     // stripped on load, having been used to rebuild the RNG
  /^derivedCache\b/, // recomputed, never saved
  /\.derivedCache\b/,
  /^log\b/,          // the batch log is trimmed on save by design
  /^history\b/,      // undo history is session, not state
];

function tolerated(path) {
  return EXPECTED_TO_DIFFER.some(re => re.test(path));
}

function roundTrip(sess) {
  const blob = JSON.parse(JSON.stringify(Save.serialize(sess, { title: 'audit' })));
  return { blob, loaded: Save.deserialize(blob, {}) };
}

/* ---------------------------------------------------------------- tests --- */

t.section('a saved game comes back the same game');
{
  const sess = busySession();
  const before = flatten(sess.state);
  const { blob, loaded } = roundTrip(sess);
  const after = flatten(loaded.state);

  const missing = [];
  const changed = [];
  Object.keys(before).forEach(k => {
    if (tolerated(k)) return;
    /* A key that exists holding `undefined` is not data: JSON drops it, and
       reading it back gives `undefined` either way. Counting those as losses
       reported five phantom failures for fields that were never set. */
    if (before[k] === undefined) return;
    if (!(k in after)) { missing.push(k + ' = ' + JSON.stringify(before[k])); return; }
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changed.push(k + ': ' + JSON.stringify(before[k]) + ' → ' + JSON.stringify(after[k]));
    }
  });
  const added = Object.keys(after).filter(k =>
    !(k in before) && !tolerated(k) && after[k] !== undefined);

  t.ok(Object.keys(before).length > 300, 'the session under test is a busy one',
    '(' + Object.keys(before).length + ' fields)');
  t.eq(missing.length, 0, 'nothing is lost in the round trip',
    missing.slice(0, 12).join(' | '));
  t.eq(changed.length, 0, 'and nothing comes back different',
    changed.slice(0, 8).join('; '));
  t.eq(added.length, 0, 'and nothing is invented on the way back',
    added.slice(0, 8).join('; '));
}

t.section('the things a player would notice');
{
  const sess = busySession();
  const st = sess.state;
  const { loaded } = roundTrip(sess);
  const back = loaded.state;

  const w0 = st.actors.wiz.runtime;
  const w1 = back.actors.wiz.runtime;

  t.deep(w1.slotsSpent, w0.slotsSpent, 'spent spell slots stay spent');
  t.deep(w1.conditions, w0.conditions, 'conditions survive, with their rounds');
  t.deep(w1.concentratingOn, w0.concentratingOn, 'and so does what you are concentrating on');
  t.eq(w1.exhaustion, w0.exhaustion, 'exhaustion survives');
  t.eq(w1.tempHp, w0.tempHp, 'temporary hit points survive');
  t.deep(w1.hitDiceSpent, w0.hitDiceSpent, 'spent hit dice stay spent');
  t.deep(w1.attuned, w0.attuned, 'attunement survives');
  t.eq(w1.gold, w0.gold, 'gold survives');
  t.eq(w1.inventory.length, w0.inventory.length, 'the pack survives');

  t.eq(back.actors.shen.runtime.hp, st.actors.shen.runtime.hp, 'wounds survive');
  t.eq(back.actors.shen.progression.xp, st.actors.shen.progression.xp, 'experience survives');

  t.eq(!!(back.combat && back.combat.active), !!(st.combat && st.combat.active),
    'a fight that was on is still on');
  t.eq((back.combat.order || []).length, (st.combat.order || []).length,
    'with the same initiative order');
  t.eq(back.combat.round, st.combat.round, 'in the same round');
  t.deep(back.actors.shen.runtime.turn, st.actors.shen.runtime.turn,
    'and the action economy exactly where it was');

  t.eq(back.locationId, st.locationId, 'the party is where it was');
  t.eq(back.clock, st.clock, 'the clock survives');
  t.eq(back.flags.testFlag, 'kept', 'flags survive');
  t.eq(Object.keys(back.quests || {}).length, Object.keys(st.quests || {}).length,
    'every quest survives');
  t.deep(back.relationships, st.relationships, 'relationships survive');
  t.eq((back.seats || []).length, (st.seats || []).length, 'the seats survive');
}

t.section('the dice come back where they were');
/*
 * A save that restores the world but not the RNG is not the same game: replay
 * it and every roll from here differs. This is what makes a session
 * reproducible from a seed.
 */
{
  const sess = busySession();
  const { loaded } = roundTrip(sess);

  const a = [];
  const b = [];
  for (let i = 0; i < 20; i++) {
    a.push(sess.state.rng.next());
    b.push(loaded.state.rng.next());
  }
  t.deep(b, a, 'the next twenty rolls are identical after a reload');
}

t.section('a scene remembers what was taken');
{
  const sess = busySession();
  const st = sess.state;
  /* Go somewhere with something in it, take it, then reload. */
  const move = Events.makeBatch({ commandId: 'goto' });
  Events.push(move, 'position', { locationId: 'blackharrow-keep', discovered: true }, '');
  Events.commit(st, move);
  Game.settle(sess);

  const ctx = Game.sceneCtx(sess);
  const floor = (ctx.groundItems || []).length;
  t.ok(floor > 0, 'the keep has something lying in it', '(' + floor + ')');

  const take = Events.makeBatch({ commandId: 'take' });
  Events.push(take, 'location_item_remove',
    { locationId: 'blackharrow-keep', uid: ctx.groundItems[0].uid }, '');
  Events.commit(st, take);

  const { loaded } = roundTrip(sess);
  const backFloor = ((loaded.state.locations || {})['blackharrow-keep'] || {}).items || [];
  t.eq(backFloor.length, floor - 1, 'and what was taken is still gone after a reload');
  t.eq(Object.keys(loaded.state.locations || {}).length,
    Object.keys(st.locations || {}).length,
    'every place the party has been is remembered');
}

t.section('what the party knows, and only that');
{
  const sess = busySession();
  const st = sess.state;
  const factCount = Object.keys(st.knowledge || {}).length;
  t.ok(factCount > 0, 'the campaign gave the party something to know',
    '(' + factCount + ' facts)');

  const { blob, loaded } = roundTrip(sess);
  t.eq(Object.keys(loaded.state.knowledge || {}).length, factCount,
    'and it all comes back');

  /* Definitions are NOT saved — they are rebuilt from the campaign. A save
     that carried them would be a save that could not be patched. */
  t.eq(!!blob.knowledgeFacts, true, 'the save records which facts were known');
  const carriedText = JSON.stringify(blob.knowledgeFacts || {});
  t.ok(carriedText.length < 20000,
    'by id rather than by carrying the campaign text with it',
    '(' + carriedText.length + ' chars)');
}

t.section('a save from an older build still loads');
/*
 * The migration path is the difference between a save file and a save file you
 * can never open again.
 */
{
  const sess = busySession();
  const { blob } = roundTrip(sess);

  const older = JSON.parse(JSON.stringify(blob));
  older.version = 1;
  delete older.state.locations;
  delete older.state.quests;
  delete older.state.relationships;

  let loaded = null;
  let threw = null;
  try { loaded = Save.deserialize(older, {}); } catch (e) { threw = e; }
  t.eq(threw, null, 'a save missing whole subsystems still opens',
    threw ? String(threw.message) : '');
  if (loaded) {
    t.ok(!!loaded.state.actors, 'with its actors intact');
    t.ok(Array.isArray(loaded.warnings), 'and a list of what it had to assume',
      '(' + (loaded.warnings || []).length + ' warnings)');
  }

  /* A save from a NEWER build must be refused rather than half-read. */
  const newer = JSON.parse(JSON.stringify(blob));
  newer.version = 999;
  let refused = false;
  try { Save.deserialize(newer, {}); } catch (e) { refused = /newer version/i.test(e.message); }
  t.eq(refused, true, 'and a save from a newer build is refused, not half-read');
}

t.section('the same game, saved twice, is the same save');
{
  const sess = busySession();
  const one = Save.serialize(sess, { title: 'x' });
  const two = Save.serialize(sess, { title: 'x' });
  /* `savedAt` is a timestamp and is expected to differ. */
  delete one.savedAt; delete two.savedAt;
  t.eq(JSON.stringify(one), JSON.stringify(two),
    'serialising twice with no play in between produces an identical save');
}

t.section('a round trip can be round-tripped');
/*
 * Load, save, load again. If the second save differs from the first then
 * something is being lost or added on every cycle, and a game saved often
 * enough would drift away from itself.
 */
{
  const sess = busySession();
  const first = roundTrip(sess);

  const reloaded = Game.createSession({
    state: first.loaded.state, store: first.loaded.store, campaign: camp,
  });
  reloaded.locations = camp.locations;
  reloaded.questDefs = cont.quests;

  const second = roundTrip(reloaded);

  const a = JSON.parse(JSON.stringify(first.blob));
  const b = JSON.parse(JSON.stringify(second.blob));
  delete a.savedAt; delete b.savedAt;
  delete a.digest; delete b.digest;

  const fa = flatten(a.state);
  const fb = flatten(b.state);
  const drift = Object.keys(fa).filter(k =>
    !tolerated(k) && JSON.stringify(fa[k]) !== JSON.stringify(fb[k]));
  t.eq(drift.length, 0, 'a second save of a loaded game is identical to the first',
    drift.slice(0, 6).map(k => k + ': ' + JSON.stringify(fa[k]) + ' → ' + JSON.stringify(fb[k])).join('; '));
}

t.section('the pools a class actually spends survive a save');
/*
 * Both of these are new state, and new state is exactly what a save quietly
 * drops. `pactSlotsSpent` is the warlock's whole resource game and
 * `featuresSpent` is rage, ki, action surge, lay on hands and the rest — a
 * save that lost either would hand a player back a character with everything
 * refilled, which looks like generosity and is actually the resource system
 * not existing.
 */
{
  const sess = busySession();
  const who = Object.keys(sess.state.actors).filter(
    id => sess.state.actors[id].side === 'party')[0];

  const b = Events.makeBatch({ commandId: 'pools', actorId: who });
  Events.push(b, 'pact_slot_spend', { actorId: who, level: 2 }, '');
  Events.push(b, 'feature_spend', { actorId: who, feature: 'rage' }, '');
  Events.push(b, 'feature_spend', { actorId: who, feature: 'second_wind' }, '');
  Events.commit(sess.state, b);

  const rt = sess.state.actors[who].runtime;
  t.eq(rt.pactSlotsSpent, 1, 'a pact slot is spent before saving');
  t.eq(rt.featuresSpent.rage, 1, 'and a rage');

  const { loaded } = roundTrip(sess);
  const back = loaded.state.actors[who].runtime;
  t.eq(back.pactSlotsSpent, 1, 'the spent pact slot comes back spent');
  t.eq(back.featuresSpent.rage, 1, 'the spent rage comes back spent');
  t.eq(back.featuresSpent.second_wind, 1, 'and so does Second Wind');
}

t.done();
