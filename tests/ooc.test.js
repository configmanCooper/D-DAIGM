/*
 * tests/ooc.test.js — asking the Dungeon Master a question costs nothing.
 *
 * "OOC:" is a player leaning back and asking the referee how grappling works.
 * At a real table that is free, and it has to be free here too: the whole
 * feature is worthless if asking a rules question can cost you your action.
 *
 * So the central assertion is a negative one, and it is checked against the
 * things that would actually move if a turn had been spent — revision,
 * turn epoch, whose turn it is, and the asker's own action economy — rather
 * than against the absence of an error.
 *
 * The second half is about the answer being *grounded*. A Dungeon Master that
 * invents your Armour Class is worse than one that refuses to guess, so the
 * facts handed to the model are checked for real numbers taken from the
 * engine, and checked to still be right after the sheet changes underneath.
 */
'use strict';

const t = require('./_harness')('ooc');
const { RNG } = require('../js/rng.js');
const State = require('../js/engine/state.js');
const Events = require('../js/engine/events.js');
const Character = require('../js/engine/character.js');
const Chargen = require('../js/gen/chargen.js');
const Combat = require('../js/engine/combat.js');
const Backend = require('../js/ai/backend.js');
const Knowledge = require('../js/engine/knowledge.js');
const Narrator = require('../js/ai/narrator.js');
const Game = require('../js/game.js');

function build(classId, levels, seed) {
  const spec = Chargen.generate({ rng: new RNG(seed || classId), fixed: { classId, levels } });
  return Character.buildFromSpec(spec);
}

/* A wizard, a fighter and something to fight, mid-combat, so that the action
   economy is real and there is something for a turn to cost. */
function table() {
  const s = State.create({ seed: 'ooc' });
  const w = build('wizard', 5, 'oocw');
  const f = build('fighter', 5, 'oocf');
  State.addActor(s, {
    id: 'vera', name: 'Vera', side: 'party', kind: 'pc',
    base: w.base, progression: w.progression, runtime: w.runtime,
  });
  State.addActor(s, {
    id: 'bram', name: 'Bram', side: 'party', kind: 'pc',
    base: f.base, progression: f.progression, runtime: f.runtime,
  });
  State.addActor(s, {
    id: 'ogre', name: 'Ogre', side: 'enemy', kind: 'monster',
    base: { abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 } },
    runtime: { hp: 59, hpMax: 59, ac: 11, speed: 40, pos: { x: 2, y: 0 }, inventory: [] },
  });
  State.refreshAllDerived(s);
  return {
    state: s,
    store: Knowledge.makeStore(),
    campaign: { title: 'A Test', reveals: [] },
    locationName: 'the toll bridge',
    recentNarration: [],
    listeners: [],
  };
}

function snapshot(s) {
  const t0 = (s.actors.vera.runtime.turn) || {};
  return JSON.stringify({
    revision: s.revision,
    turnEpoch: s.turnEpoch,
    active: s.activeActorId,
    round: s.combat && s.combat.round,
    action: t0.action,
    bonus: t0.bonus,
    reaction: t0.reaction,
    movement: t0.movementRemaining,
    hp: s.actors.vera.runtime.hp,
    slots: JSON.stringify(s.actors.vera.runtime.slotsSpent || {}),
    transcript: (s.transcript || []).length,
  });
}

async function main() {
  /* ---------------------------------------------------------------- */
  t.section('asking a question does not spend a turn');
  {
    const session = table();
    const s = session.state;

    /* Put it in combat, on Vera's turn, so a spent turn would be obvious. */
    Events.commit(s, Combat.beginEncounter(s, [
      { id: 'vera', mod: 2 }, { id: 'bram', mod: 1 }, { id: 'ogre', mod: -1 },
    ], { encounterId: 'e1' }));
    Events.commit(s, Combat.startTurn(s, 'vera'));
    State.refreshAllDerived(s);

    const before = snapshot(s);
    t.ok(/"action":true/.test(before), 'Vera starts her turn with her action in hand');

    Backend.configure({
      kind: 'fixture',
      fixtures: { '*': 'Grappling is a special melee attack: you make a Strength (Athletics) check contested by the target\u2019s Athletics or Acrobatics.' },
    });

    const res = await Game.askDm(session, 'how does grappling work?', { actorId: 'vera' });

    t.ok(!!(res && res.text && res.text.length > 10), 'the question gets an answer');
    t.ok(/Strength \(Athletics\)/.test(res.text),
      'and it is the model\u2019s answer, not the offline fallback \u2014 so this is ' +
      'testing the real path');
    t.eq(snapshot(s), before,
      'and NOTHING about the game state moved \u2014 not the revision, not the turn ' +
      'epoch, not whose turn it is, not her action, bonus action, reaction or movement');
    t.eq(s.activeActorId, 'vera', 'it is still her turn afterwards');
    t.eq(s.revision, JSON.parse(before).revision,
      'the revision is untouched, so no event was committed');

    /* Negative control. An assertion that nothing changed is worthless unless
       the same snapshot demonstrably DOES change when something really is
       spent — otherwise it passes because it cannot see, not because the
       feature is free. */
    Events.commit(s, Events.push(
      Events.makeBatch({ commandId: 'ctl', actorId: 'vera' }),
      'action_economy', { actorId: 'vera', action: false }
    ));
    State.refreshAllDerived(s);
    t.ok(snapshot(s) !== before,
      'CONTROL: actually spending the action does move the snapshot, so the ' +
      'check above can genuinely fail');
  }

  /* ---------------------------------------------------------------- */
  t.section('a question can be asked when it is somebody else\u2019s turn');
  {
    const session = table();
    const s = session.state;
    Events.commit(s, Combat.beginEncounter(s, [
      { id: 'vera', mod: 2 }, { id: 'bram', mod: 1 }, { id: 'ogre', mod: -1 },
    ], { encounterId: 'e2' }));
    Events.commit(s, Combat.startTurn(s, 'ogre'));
    State.refreshAllDerived(s);
    const before = snapshot(s);

    Backend.configure({ kind: 'fixture', fixtures: { '*': 'You can ready an action.' } });
    const res = await Game.askDm(session, 'what can I do on my turn?', { actorId: 'vera' });

    t.ok(!!(res && res.text), 'the answer comes back even though it is the ogre\u2019s turn');
    t.eq(s.activeActorId, 'ogre', 'and the initiative did not jump to the asker');
    t.eq(snapshot(s), before, 'again nothing moved');
  }

  /* ---------------------------------------------------------------- */
  t.section('the answer is grounded in the real sheet, not invented');
  {
    const session = table();
    const s = session.state;
    const d = s.actors.vera.derivedCache;

    let seen = '';
    Backend.configure({ kind: 'fixture', fixtures: { '*': 'ok' } });
    const realChat = Backend.chat;
    Backend.chat = function (req) {
      seen = req.messages.map(m => m.content).join('\n');
      return realChat(req);
    };
    await Narrator.answer(s, session.store, session.campaign, 'what is my AC?', { actorId: 'vera' });
    Backend.chat = realChat;

    t.ok(seen.indexOf('Armour Class ' + d.ac) >= 0,
      'the model is told the real Armour Class (' + d.ac + ') rather than left to guess');
    t.ok(seen.indexOf('Hit points ' + s.actors.vera.runtime.hp + '/' + d.hpMax) >= 0,
      'and the real hit points');
    t.ok(seen.indexOf('save DC ' + d.spellcasting.dc) >= 0,
      'and the real spell save DC (' + d.spellcasting.dc + ')');
    t.ok(/Spell slots left:.*level 3: 2 of 2/.test(seen),
      'and the real remaining spell slots');
    t.ok(/Able to do right now:/.test(seen),
      'and the list of things the rules actually permit this instant');
    t.ok(/D&D|Dungeons & Dragons/.test(seen) && /5th Edition|5e/.test(seen),
      'the referee is told which rules set it is adjudicating');
    t.ok(/OOC:/.test(seen),
      'and that it can answer questions about the program itself');
  }

  /* ---------------------------------------------------------------- */
  t.section('the facts follow the character when the sheet changes');
  {
    const session = table();
    const s = session.state;

    /* Spend a third-level slot and take a wound. */
    Events.commit(s, {
      commandId: 'spend', actorId: 'vera',
      events: [
        { kind: 'slot_spend', actorId: 'vera', level: 3, count: 1 },
        { kind: 'hp', targetId: 'vera', delta: -9, reason: 'ogre' },
      ],
    });
    State.refreshAllDerived(s);

    let seen = '';
    Backend.configure({ kind: 'fixture', fixtures: { '*': 'ok' } });
    const realChat = Backend.chat;
    Backend.chat = function (req) { seen = req.messages.map(m => m.content).join('\n'); return realChat(req); };
    await Narrator.answer(s, session.store, session.campaign, 'how am I doing?', { actorId: 'vera' });
    Backend.chat = realChat;

    t.ok(/level 3: 1 of 2/.test(seen),
      'the spent slot is reflected \u2014 the facts are read live, not cached from setup');
    t.ok(seen.indexOf('Hit points ' + s.actors.vera.runtime.hp + '/') >= 0,
      'and so is the damage taken');
  }

  /* ---------------------------------------------------------------- */
  t.section('a question about a different character asks about THAT character');
  {
    const session = table();
    const s = session.state;
    const vera = s.actors.vera.derivedCache;
    const bram = s.actors.bram.derivedCache;
    t.ok(vera.ac !== bram.ac, 'the wizard and the fighter have different AC to tell apart');

    let seen = '';
    Backend.configure({ kind: 'fixture', fixtures: { '*': 'ok' } });
    const realChat = Backend.chat;
    Backend.chat = function (req) { seen = req.messages.map(m => m.content).join('\n'); return realChat(req); };
    await Narrator.answer(s, session.store, session.campaign, 'what is my AC?', { actorId: 'bram' });
    Backend.chat = realChat;

    t.ok(seen.indexOf('Armour Class ' + bram.ac) >= 0,
      'asking as Bram describes Bram\u2019s sheet (' + bram.ac + ')');
    t.ok(seen.indexOf('Bram') >= 0, 'and names him');
  }

  /* ---------------------------------------------------------------- */
  t.section('a stalled model does not leave the question hanging');
  {
    const session = table();
    const s = session.state;
    const before = snapshot(s);

    /* A backend that never answers, standing in for the local model that
       stopped mid-token and froze the interface. */
    const realChat = Backend.chat;
    let aborted = false;
    Backend.chat = function (req) {
      if (req.signal) req.signal.addEventListener('abort', () => { aborted = true; });
      return new Promise(() => { /* deliberately never settles */ });
    };

    const t0 = Date.now();
    const res = await Game.askDm(session, 'what is my AC?', {
      actorId: 'vera', stallMs: 250, totalMs: 900,
    });
    const took = Date.now() - t0;
    Backend.chat = realChat;

    t.ok(!!(res && res.text), 'a stalled Dungeon Master still returns something to show');
    t.eq(res.gaveUp, 'stalled', 'and reports why it gave up');
    t.ok(took < 800, 'within the deadline rather than hanging forever (' + took + 'ms)');
    t.ok(aborted, 'and the request is actually hung up on, not left running');
    t.eq(snapshot(s), before, 'a stalled question still costs the player nothing');
  }

  /* ---------------------------------------------------------------- */
  t.section('with no model at all the answer is honest');
  {
    const session = table();
    Backend.configure({ kind: 'offline' });
    const res = await Game.askDm(session, 'what is my AC?', { actorId: 'vera' });
    t.eq(res.source, 'offline', 'it reports that it is not the model talking');
    t.ok(/no Dungeon Master model/i.test(res.text),
      'and says so plainly rather than inventing a ruling');
    t.ok(res.text.indexOf('Armour Class ' + session.state.actors.vera.derivedCache.ac) >= 0,
      'while still showing the numbers the engine does know');
  }

  t.done();
}

main().catch(e => {
  console.error('\nooc suite threw:', e && e.stack || e);
  process.exit(1);
});
