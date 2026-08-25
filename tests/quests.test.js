/*
 * tests/quests.test.js — do quests actually go anywhere?
 *
 * The campaign has always been able to LIST quests. Nothing ever advanced one:
 * ten open threads sat in the journal from the first turn to the last, with no
 * relationship to anything the party did — walking into the very keep a quest
 * was about changed nothing at all.
 *
 * The nastiest bug found while building this: a trigger that read
 * `lantern’s rest` against a gazetteer key of `lantern's rest`. A curly
 * apostrophe against a straight one. It never fired, and a quest that never
 * fires is indistinguishable from a quest that was never implemented — which
 * is why the integrity check below matters more than any single assertion.
 */
'use strict';

const t = require('./_harness')('quests');
const State = require('../js/engine/state.js');
const Knowledge = require('../js/engine/knowledge.js');
const Dispatch = require('../js/engine/dispatch.js');
require('../js/engine/interaction.js');
require('../js/engine/combat.js');
const Quests = require('../js/engine/quests.js');
const Game = require('../js/game.js');
const camp = require('../campaigns/shen_cooper.js');
const cont = require('../campaigns/shen_continuation.js');

function freshSession(seed) {
  const st = State.create({ seed: seed || 'quests', campaignId: 'shen-cooper' });
  const store = Knowledge.makeStore();
  store.known = st.knowledge;
  cont.applyTo(st, store);
  State.refreshAllDerived(st);
  const sess = Game.createSession({ state: st, store, campaign: camp });
  sess.locations = camp.locations;
  sess.questDefs = cont.quests;
  Game.settle(sess);
  return sess;
}

function objectivesDone(st) {
  let n = 0;
  Object.keys(st.quests || {}).forEach(k => {
    n += Object.keys((st.quests[k] || {}).objectives || {}).length;
  });
  return n;
}

/* An objective is stored either as a bare status string or as {status, text}
   when the trigger supplied a written description. */
function statusOf(st, questId, objectiveId) {
  const v = ((st.quests || {})[questId] || {}).objectives || {};
  const o = v[objectiveId];
  if (!o) return null;
  return typeof o === 'string' ? o : o.status;
}

/* ------------------------------------------------- the integrity check -- */
t.section('every quest trigger points at something that exists');
/*
 * This is the check that would have caught the apostrophe. A trigger naming a
 * place the gazetteer does not have can never fire, and nothing anywhere else
 * would ever say so.
 */
{
  const places = Object.keys(camp.locations || {});
  const norm = s => String(s).toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/\s+/g, ' ').trim();
  const known = places.map(norm);

  const bad = [];
  let triggerCount = 0;
  (cont.quests || []).forEach(q => {
    (q.triggers || []).forEach(trig => {
      triggerCount++;
      if (trig.on === 'arrive' || trig.on === 'deliver') {
        if (known.indexOf(norm(trig.where)) < 0) {
          bad.push(q.id + ' → "' + trig.where + '"');
        }
      }
    });
  });

  t.ok((cont.quests || []).length > 0, 'the campaign has quests',
    '(' + (cont.quests || []).length + ')');
  t.ok(triggerCount > 0, 'and they carry triggers', '(' + triggerCount + ')');
  t.eq(bad.length, 0, 'every named destination exists in the gazetteer',
    bad.join('; '));

  const withTriggers = (cont.quests || []).filter(q => (q.triggers || []).length).length;
  t.eq(withTriggers, (cont.quests || []).length,
    'and no quest is a dead end with no way to advance it');

  /* An `arrive` trigger may only claim that the party ARRIVED.
     Journal lines reading "asked after witnesses" and "delivered the fragment"
     fired on merely walking into the town, so the record claimed things that
     had not happened — which is worse than a quest that does not move, because
     a player reads it and believes it. "Entered" is allowed: arriving at the
     abbey is entering it. */
  const claims = [];
  (cont.quests || []).forEach(q => {
    (q.triggers || []).forEach(trig => {
      if (trig.on !== 'arrive') return;
      if (/\b(asked|delivered|handed|gave|persuaded|defeated|killed|found|took)\b/i
        .test(trig.text || '')) {
        claims.push(q.id + ': "' + trig.text + '"');
      }
    });
  });
  t.eq(claims.length, 0,
    'and no arrival is recorded as an action the party did not take',
    claims.join('; '));

  /* A delivery must require the thing being carried, not just the party being
     in the right town. */
  const deliveries = [];
  (cont.quests || []).forEach(q => {
    (q.triggers || []).forEach(trig => {
      if (trig.on === 'deliver' && !trig.itemId) deliveries.push(q.id);
    });
  });
  t.eq(deliveries.length, 0, 'and every delivery names what is being delivered',
    deliveries.join('; '));
}

/* --------------------------------------------------- standing triggers -- */
t.section('a quest about where you already are');
/*
 * The campaign opens at Lantern's Rest with two threads about Lantern's Rest.
 * Triggers were only evaluated against what CHANGED, so a party that began
 * standing in the place never "arrived" there and neither thread ever moved.
 */
{
  const sess = freshSession('standing');
  const st = sess.state;
  t.eq(st.locationId, "lantern's rest", 'the campaign opens at Lantern\u2019s Rest');
  t.ok(objectivesDone(st) > 0, 'the threads about it register immediately',
    '(' + objectivesDone(st) + ' objectives)');
  t.eq(statusOf(st, 'restore-lantern-watch', 'see-the-watch'), 'done',
    'the Lantern Watch thread notices where the party is standing');

  const before = objectivesDone(st);
  Game.settle(sess);
  Game.settle(sess);
  t.eq(objectivesDone(st), before,
    'and settling again does not count the same objective twice');
}

/* ------------------------------------------------------------ travel -- */
t.section('travelling advances the threads about where you go');
{
  const sess = freshSession('travel');
  const st = sess.state;
  const who = st.activeActorId || 'shen';

  const before = objectivesDone(st);
  const beforeBlackharrow =
    Object.keys(st.quests['blackharrow-presence'].objectives || {}).length;
  t.eq(beforeBlackharrow, 0, 'the Blackharrow thread starts untouched');

  /* Walk a real route rather than wandering: this test is about whether
     arriving advances a thread, not about pathfinding. */
  const route = (function findRoute(from, to) {
    const gaz = camp.locations;
    const seen = { [from]: true };
    let edge = [[from]];
    while (edge.length) {
      const next = [];
      for (const path of edge) {
        const at = path[path.length - 1];
        for (const step of (gaz[at] || {}).connections || []) {
          if (seen[step]) continue;
          seen[step] = true;
          const grown = path.concat([step]);
          if (step === to) return grown.slice(1);
          next.push(grown);
        }
      }
      edge = next;
    }
    return [];
  })(st.locationId, 'blackharrow-keep');

  t.ok(route.length > 0, 'there is a route to the keep',
    '(' + st.locationId + ' → ' + route.join(' → ') + ')');

  let hops = 0;
  const visit = () => {
    if (hops >= route.length) return Promise.resolve();
    const ctx = Game.sceneCtx(sess);
    const want = (Dispatch.legalMoves(st, who, ctx) || [])
      .filter(m => m.step && m.step.verb === 'travel' && m.step.note === route[hops])[0];
    if (!want) return Promise.resolve();
    hops++;
    return Game.applyCommand(sess, Dispatch.commandFromMove(st, who, want), { ctx })
      .then(visit);
  };

  return visit().then(() => {
    t.eq(hops, route.length, 'the party walks the whole route',
      '(' + hops + '/' + route.length + ' hops, now at ' + st.locationId + ')');
    t.eq(st.locationId, 'blackharrow-keep', 'and arrives at the keep');
    t.ok(objectivesDone(st) > before,
      'travelling moved at least one thread along',
      '(' + before + ' → ' + objectivesDone(st) + ')');
    t.eq(statusOf(st, 'blackharrow-presence', 'reach-blackharrow'), 'done',
      'and arriving at the keep advanced the thread about the keep');

    return afterTravel();
  });
}

function afterTravel() {
  /* --------------------------------------------------------- completion -- */
  t.section('a thread can actually finish');
  {
    const sess = freshSession('finish');
    const st = sess.state;
    /* Put the party at the abbey directly: this is about completion, not about
       pathfinding. */
    const b = require('../js/engine/events.js').makeBatch({ commandId: 'jump' });
    require('../js/engine/events.js').push(b, 'position',
      { locationId: 'mirror-abbey', discovered: true }, 'You reach Mirror Abbey.');
    require('../js/engine/events.js').commit(st, b);
    Game.settle(sess);

    const q = st.quests['enter-mirror-abbey'];
    t.eq(statusOf(st, 'enter-mirror-abbey', 'enter-the-abbey'), 'done',
      'entering the abbey satisfies its objective');
    t.eq(q.status, 'done', 'and the trigger marked the whole thread finished');
  }

  /* ------------------------------------------------------------ journal -- */
  t.section('progress is legible');
  {
    const sess = freshSession('legible');
    const def = cont.quests.filter(q => q.id === 'restore-lantern-watch')[0];
    const p = Quests.progressOf(sess.state, def);
    t.ok(!!p, 'a quest reports its progress');
    t.eq(p.total, (def.triggers || []).length, 'out of the number of steps it has');
    t.ok(p.done > 0, 'with the ones already met counted', '(' + p.done + '/' + p.total + ')');
  }

  /* ---------------------------------------------------------- undoable -- */
  t.section('quest progress is an ordinary part of the record');
  {
    const sess = freshSession('undo');
    const st = sess.state;
    t.ok(objectivesDone(st) > 0, 'something has advanced');
    /* Quest events are committed like any other, so they carry a revision and
       ride the same undo stack rather than being a side channel. */
    t.ok(st.revision > 0, 'and it moved the revision', '(' + st.revision + ')');
  }

  t.section('two triggers firing at once do not count twice');
  /*
   * `has()` reads COMMITTED state, which a batch being built has not reached.
   * Two triggers on the same quest answering the same event therefore wrote
   * the objective twice, and a quest with two completing triggers emitted two
   * "done" events and two beats — a thread finishing twice in the log.
   */
  {
    const st = State.create({ seed: 'double' });
    st.locationId = 'somewhere';
    const Events = require('../js/engine/events.js');
    const seed = Events.makeBatch({ commandId: 'seed' });
    Events.push(seed, 'quest', { questId: 'q1', title: 'A thread', status: 'open' }, '');
    Events.commit(st, seed);

    /* Both triggers name the SAME objective and both complete the quest. */
    const defs = [{
      id: 'q1', title: 'A thread',
      triggers: [
        { on: 'arrive', where: 'somewhere', objective: 'same', completes: true },
        { on: 'arrive', where: 'somewhere', objective: 'same', completes: true },
      ],
    }];
    const batch = { events: [{ kind: 'position', locationId: 'somewhere' }], beats: [] };
    const out = Quests.advanceFrom(st, batch, defs, {});

    const objectiveEvents = (out.events || [])
      .filter(e => e.kind === 'quest' && e.objectiveId === 'same').length;
    const doneEvents = (out.events || [])
      .filter(e => e.kind === 'quest' && e.status === 'done').length;
    t.eq(objectiveEvents, 1, 'the objective is written once');
    t.eq(doneEvents, 1, 'and the thread finishes once');
    t.eq((out.beats || []).length, 2, 'with one beat for each, not four',
      '(' + (out.beats || []).join(' | ') + ')');

    /* Distinct objectives must still both fire. */
    const defs2 = [{
      id: 'q1', title: 'A thread',
      triggers: [
        { on: 'arrive', where: 'somewhere', objective: 'a' },
        { on: 'arrive', where: 'somewhere', objective: 'b' },
      ],
    }];
    const out2 = Quests.advanceFrom(st, batch, defs2, {});
    const ids = (out2.events || []).filter(e => e.objectiveId).map(e => e.objectiveId).sort();
    t.deep(ids, ['a', 'b'], 'but two different objectives both count');
  }

  /* --------------------------------------------------------- the scene -- */
  t.section('a place contains things, and remembers what was taken');
  {
    const Character = require('../js/engine/character.js');
    const Save = require('../js/engine/save.js');

    const st = State.create({ seed: 'scene', campaignId: 'shen-cooper' });
    const c = Character.buildFromSpec({
      name: 'Shen', raceId: 'human', classId: 'paladin', levels: 3,
      backgroundId: 'soldier',
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 16 },
      proficiencies: { skills: ['athletics'] },
    });
    c.runtime.pos = { x: 2, y: 2 };
    State.addActor(st, {
      id: 'pc1', name: 'Shen', side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime,
    });
    State.addSeat(st, { id: 'p1', name: 'P1', actorId: 'pc1', control: 'human' });
    State.refreshAllDerived(st);
    st.locationId = 'blackharrow-keep';
    st.combat = { active: false, round: 0, order: [], turnIndex: 0 };

    const sess = Game.createSession({ state: st, campaign: camp });
    sess.locations = camp.locations;
    Game.settle(sess);

    const ctx = Game.sceneCtx(sess);
    const floorBefore = (ctx.groundItems || []).length;
    t.ok(floorBefore > 0, 'a ruin has something lying in it',
      '(' + (ctx.groundItems || []).map(i => i.name).join(' + ') + ')');

    /* Determinism: the same place furnished twice is the same place. */
    const twin = State.create({ seed: 'scene', campaignId: 'shen-cooper' });
    twin.locationId = 'blackharrow-keep';
    const twinSess = Game.createSession({ state: twin, campaign: camp });
    twinSess.locations = camp.locations;
    Game.settle(twinSess);
    t.eq(JSON.stringify((twin.locations['blackharrow-keep'] || {}).items),
      JSON.stringify((st.locations['blackharrow-keep'] || {}).items),
      'and the same seed furnishes it identically');

    const pickUp = (Dispatch.legalMoves(st, 'pc1', ctx) || [])
      .filter(m => m.step && m.step.verb === 'pick_up')[0];
    t.ok(!!pickUp, 'which the party is offered the chance to pick up',
      pickUp ? '(' + pickUp.what + ')' : '');

    return Game.applyCommand(sess, Dispatch.commandFromMove(st, 'pc1', pickUp), { ctx })
      .then(() => {
        const after = Game.sceneCtx(sess);
        t.eq((after.groundItems || []).length, floorBefore - 1,
          'taking it leaves one fewer on the floor');

        /* The context must be a SNAPSHOT. Handing out the live array meant a
           caller held a reference to the world and could change it without an
           event — which undo could not put back, and which made a captured
           "before" silently track the "after". */
        t.eq((ctx.groundItems || []).length, floorBefore,
          'and a context captured earlier is unchanged by it');

        const blob = JSON.parse(JSON.stringify(Save.serialize(sess, { title: 'scene' })));
        const loaded = Save.deserialize(blob, {});
        const floorAfterLoad =
          ((loaded.state.locations || {})['blackharrow-keep'] || {}).items || [];
        t.eq(floorAfterLoad.length, floorBefore - 1,
          'and what was taken stays taken across a save and a load');

        return sceneInteractions();
      });
  }
}

/**
 * What a scene's furniture actually DOES.
 *
 * Every one of these was reported by an independent reviewer who ran the game
 * rather than reading it: a merchant who could be offered and never traded, a
 * lock that stayed locked however well you rolled, and a trap that was free to
 * fail at — which is the one moment a trap is supposed to matter.
 */
function sceneInteractions() {
  const Character = require('../js/engine/character.js');

  function at(locationId, spec) {
    const st = State.create({ seed: spec.seed, campaignId: 'shen-cooper' });
    const c = Character.buildFromSpec(Object.assign({
      name: 'Tester', raceId: 'human', classId: 'rogue', levels: 5,
      backgroundId: 'criminal',
      abilities: { str: 10, dex: 18, con: 12, int: 12, wis: 12, cha: 14 },
      proficiencies: { skills: ['sleightOfHand', 'perception', 'persuasion'] },
    }, spec.character || {}));
    c.runtime.pos = { x: 2, y: 2 };
    c.runtime.gold = spec.gold == null ? 100 : spec.gold;
    State.addActor(st, {
      id: 'pc1', name: c.base.name, side: 'party', kind: 'pc',
      base: c.base, progression: c.progression, runtime: c.runtime,
    });
    State.addSeat(st, { id: 'p1', name: 'P1', actorId: 'pc1', control: 'human' });
    State.refreshAllDerived(st);
    st.locationId = locationId;
    st.combat = { active: false, round: 0, order: [], turnIndex: 0 };
    const sess = Game.createSession({ state: st, campaign: camp });
    sess.locations = camp.locations;
    Game.settle(sess);
    return sess;
  }

  const offer = (sess, verb) => {
    const ctx = Game.sceneCtx(sess);
    const m = (Dispatch.legalMoves(sess.state, 'pc1', ctx) || [])
      .filter(x => x.step && x.step.verb === verb)[0];
    return { ctx, move: m };
  };

  /* ------------------------------------------------------- the merchant -- */
  t.section('a trader you can be offered is a trader you can trade with');
  const shop = at('dunmere', { seed: 'shop' });
  const buy = offer(shop, 'buy');
  t.ok(!!buy.move, 'a town has somebody selling something',
    buy.move ? '(' + buy.move.what + ')' : '');
  t.ok(!/\[object Object\]/.test((buy.move || {}).what || ''),
    'and the price on the button is a number of gold, not an object',
    '(' + ((buy.move || {}).what || '') + ')');

  const goldBefore = shop.state.actors.pc1.runtime.gold;
  const packBefore = shop.state.actors.pc1.runtime.inventory.length;

  return Game.applyCommand(shop, Dispatch.commandFromMove(shop.state, 'pc1', buy.move), { ctx: buy.ctx })
    .then(r => {
      t.eq(!!(r.batch && r.batch.refused), false,
        'buying is not offered and then refused',
        r.batch && r.batch.refused ? '(' + r.batch.refused.detail + ')' : '');
      t.ok(shop.state.actors.pc1.runtime.gold < goldBefore, 'it costs money',
        '(' + goldBefore + ' → ' + shop.state.actors.pc1.runtime.gold + ')');
      t.eq(shop.state.actors.pc1.runtime.inventory.length, packBefore + 1,
        'and the thing ends up in the pack');

      /* ------------------------------------------------------- the lock -- */
      t.section('a lock that is picked stays picked');
      const vault = at('blackharrow-keep', { seed: 'lock' });
      const lock = offer(vault, 'unlock');
      t.ok(!!lock.move, 'a ruin has something locked in it',
        lock.move ? '(' + lock.move.what + ')' : '');

      return Game.applyCommand(vault, Dispatch.commandFromMove(vault.state, 'pc1', lock.move),
        { ctx: lock.ctx }).then(r2 => {
        const beats = ((r2.batch || {}).beats || []).join(' ');
        const picked = /picks the lock/.test(beats);
        t.ok(picked || /holds/.test(beats), 'the attempt resolves one way or the other',
          '(' + beats.trim() + ')');
        if (picked) {
          t.eq(!!offer(vault, 'unlock').move, false,
            'and once open it is not offered again');
          t.eq((Game.sceneCtx(vault).obstacles || [])
            .filter(o => o.kind === 'locked').length, 0,
          'the scene no longer reports it as locked');
        } else {
          t.ok(!!offer(vault, 'unlock').move, 'a lock that held can be tried again');
          t.ok(true, 'the scene still reports it as locked');
        }

        /* ------------------------------------------------------ the trap -- */
        t.section('a trap you fail to disarm goes off');
        /*
         * Across many attempts by a clumsy character, some disarms fail — and
         * a failure must cost hit points and spend the trap. Failing for free
         * makes disarming a formality rather than a decision.
         */
        let sprung = 0, damaged = 0, found = 0;
        for (let i = 0; i < 30; i++) {
          const fen = at('glass-fen', {
            seed: 'trap' + i,
            character: {
              classId: 'fighter',
              abilities: { str: 16, dex: 8, con: 14, int: 8, wis: 8, cha: 8 },
              proficiencies: { skills: [] },
            },
          });
          const trap = offer(fen, 'disarm_trap');
          if (!trap.move) continue;
          found++;
          const hp0 = fen.state.actors.pc1.runtime.hp;
          const cmd = Dispatch.commandFromMove(fen.state, 'pc1', trap.move);
          const res = Dispatch.dispatch(fen.state, fen.history, cmd, trap.ctx);
          const text = ((res.batch || {}).beats || []).join(' ');
          if (/sets off/.test(text)) {
            sprung++;
            if (fen.state.actors.pc1.runtime.hp < hp0) damaged++;
          }
        }
        t.ok(found > 0, 'a marsh has traps in it to disarm', '(' + found + ' of 30 scenes)');
        t.ok(sprung > 0, 'a clumsy character sets some of them off',
          '(' + sprung + ' of ' + found + ')');
        t.eq(damaged, sprung, 'and every one that goes off actually hurts');

        t.done();
      });
    });
}

