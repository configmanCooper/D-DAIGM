/*
 * tests/everything.js — do every single thing the game claims to do.
 *
 * The other harnesses each answer one question. `exercise.js` asks whether a
 * verb RESOLVES, `reach.js` whether it is OFFERED. This one plays: it walks a
 * party through a long session and deliberately drives every system the game
 * has — fighting, spells at every level, saves, conditions, concentration,
 * death and dying, resting and re-preparing, levelling, travel, scene
 * interaction, trade, social business and the knowledge layer — and reports
 * what actually happened rather than what was attempted.
 *
 * The point is coverage of OUTCOMES. "Cast a spell" is not evidence that spells
 * work; "a saving throw was failed, and the damage was halved" is.
 *
 *     node tests/everything.js
 *     node tests/everything.js --turns 400
 *     node tests/everything.js --quiet
 */
'use strict';

const State = require('../js/engine/state.js');
const Character = require('../js/engine/character.js');
const Events = require('../js/engine/events.js');
const Dispatch = require('../js/engine/dispatch.js');
require('../js/engine/interaction.js');
require('../js/engine/combat.js');
const Combat = require('../js/engine/combat.js');
const Game = require('../js/game.js');
const LevelUp = require('../js/engine/levelup.js');
const Worldgen = require('../js/gen/worldgen.js');
const camp = require('../campaigns/shen_cooper.js');
const cont = require('../campaigns/shen_continuation.js');

const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet');
const TURNS = (() => {
  const i = argv.indexOf('--turns');
  return i >= 0 ? parseInt(argv[i + 1], 10) : 250;
})();

/* --------------------------------------------------------------- tally --- */
/*
 * Every interesting thing the game can do, and whether it was seen to happen.
 * A count of zero is the finding: it means either the harness never tried, or
 * the system does not work.
 */
const seen = {};
const problems = [];
function note(what, detail) {
  seen[what] = (seen[what] || 0) + 1;
  if (detail && !QUIET && seen[what] === 1) console.log('    first ' + what + ': ' + detail);
}
function problem(what, detail) {
  problems.push(what + (detail ? ' — ' + detail : ''));
}

/**
 * What a committed batch actually did. This is where coverage is measured:
 * outcomes, not intentions.
 */
function readBatch(state, batch, verb) {
  if (!batch) return;
  if (batch.refused) {
    note('refusal:' + (batch.refused.reason || 'unknown'));
    return;
  }
  /* Prefer the verb the BATCH carries. Passing a label of our own meant every
     companion's and every monster's turn was filed under "engine", so a
     wizard casting a spell every round showed up as zero casts. */
  const actual = (batch.command && batch.command.primary && batch.command.primary.verb) || verb;
  note('verb:' + actual);

  (batch.events || []).forEach(e => {
    if (!e || !e.kind) return;
    note('event:' + e.kind);

    switch (e.kind) {
      case 'roll': {
        const of = e.of || e.rollKind || 'roll';
        note('roll:' + of);
        if (e.natural === 20) note('outcome:natural-20');
        if (e.natural === 1) note('outcome:natural-1');
        if (typeof e.success === 'boolean') {
          note('outcome:' + of + '-' + (e.success ? 'success' : 'failure'));
        }
        break;
      }
      case 'hp':
        if (e.delta < 0) {
          note('outcome:damage-dealt');
          if (e.damageType) note('damage-type:' + e.damageType);
        } else if (e.delta > 0) note('outcome:healing');
        break;
      case 'condition_add': note('condition:' + (e.condition || '?')); break;
      case 'death': note('outcome:death'); break;
      case 'death_save': note('outcome:death-save'); break;
      case 'stabilise': note('outcome:stabilised'); break;
      case 'revive': note('outcome:revived'); break;
      case 'slot_spend': note('outcome:spell-slot-spent'); break;
      case 'level': note('outcome:level-up'); break;
      case 'xp': note('outcome:xp-awarded'); break;
      case 'quest': note(e.status ? 'quest:' + e.status : 'quest:objective'); break;
      case 'knowledge': note('outcome:fact-learned'); break;
      case 'relationship': note('outcome:relationship-changed'); break;
      case 'position': note('outcome:travelled'); break;
      case 'item_gain': note('outcome:item-gained'); break;
      case 'gold': note(e.delta < 0 ? 'outcome:gold-spent' : 'outcome:gold-gained'); break;
      case 'scene_clear': note(e.sprung ? 'outcome:trap-sprung' : 'outcome:obstacle-cleared'); break;
      case 'mount': note(e.mountId ? 'outcome:mounted' : 'outcome:dismounted'); break;
      case 'concentration_end': note('outcome:concentration-broken'); break;
      case 'temp_hp': note('outcome:temp-hp'); break;
      case 'prepare_spells': note('outcome:spells-re-prepared'); break;
      case 'combat_start': note('outcome:combat-started'); break;
      case 'encounter_end': note('outcome:combat-ended'); break;
      default: break;
    }
  });
}

/* ------------------------------------------------------------- helpers --- */

function makeParty(st) {
  const specs = [
    { id: 'pc1', name: 'Bryn Halloway', classId: 'fighter', levels: 3,
      abilities: { str: 17, dex: 14, con: 15, int: 10, wis: 12, cha: 10 },
      skills: ['athletics', 'perception'], bg: 'soldier' },
    { id: 'pc2', name: 'Sister Wren', classId: 'cleric', levels: 3,
      abilities: { str: 12, dex: 12, con: 14, int: 11, wis: 17, cha: 13 },
      skills: ['religion', 'insight'], bg: 'acolyte' },
    { id: 'pc3', name: 'Ysolde Vane', classId: 'wizard', levels: 3,
      abilities: { str: 8, dex: 15, con: 13, int: 17, wis: 12, cha: 11 },
      skills: ['arcana', 'investigation'], bg: 'sage' },
    { id: 'pc4', name: 'Pike', classId: 'rogue', levels: 3,
      abilities: { str: 10, dex: 17, con: 13, int: 13, wis: 12, cha: 14 },
      skills: ['stealth', 'sleightOfHand', 'perception', 'persuasion'], bg: 'criminal' },
  ];
  specs.forEach((s, i) => {
    const c = Character.buildFromSpec({
      name: s.name, raceId: 'human', classId: s.classId, levels: s.levels,
      backgroundId: s.bg, abilities: s.abilities,
      proficiencies: { skills: s.skills },
    });
    c.runtime.pos = { x: 2, y: 2 + i };
    c.runtime.gold = 150;
    State.addActor(st, {
      id: s.id, name: s.name, side: 'party', kind: 'pc', role: s.classId,
      base: c.base, progression: c.progression, runtime: c.runtime,
    });
  });
  State.addSeat(st, { id: 'p1', name: 'Player', actorId: 'pc1', control: 'human' });
  ['pc2', 'pc3', 'pc4'].forEach(id => {
    State.setController(st, id, { kind: 'companionPolicy', seatId: null, agent: null });
  });
}

function act(sess, actorId, move, ctx) {
  const st = sess.state;
  const cmd = Dispatch.commandFromMove(st, actorId, move);
  const res = Dispatch.dispatch(st, sess.history, cmd, ctx);
  readBatch(st, res.batch, (move.step && move.step.verb) || '?');
  /* Dispatch does not furnish scenes or advance quests — that is the session's
     job. Going straight to Dispatch meant quest progress happened and was
     never counted, so a working quest engine reported as a broken one. */
  if (Game.settle) Game.settle(sess);
  return res;
}

/**
 * Watch the session itself, so anything the ENGINE commits on its own — quest
 * progress, an AI seat's turn, a monster's attack — is counted too. The
 * harness taking its own turns is only half of what happens in a session.
 */
function watch(sess) {
  Game.on(sess, 'committed', p => {
    if (!p || !p.batch) return;
    /* The verb comes from the PAYLOAD's command, not the batch — a batch
       carries only a commandId. Labelling these "engine" filed every
       companion's and every monster's turn under one heading, so a wizard
       casting every round showed up as zero casts. */
    const verb = (p.command && p.command.primary && p.command.primary.verb) || 'engine';
    readBatch(sess.state, p.batch, verb);
  });
  Game.on(sess, 'quests', p => {
    if (p && p.batch) readBatch(sess.state, p.batch, 'quest-engine');
  });
  Game.on(sess, 'npcTurn', p => {
    if (p && p.turn && p.turn.chosen && p.turn.chosen.method) {
      note('seat-method:' + p.turn.chosen.method);
    }
  });
  Game.on(sess, 'seatError', p => {
    problem('a seat failed', (p && p.error) || '');
  });
  Game.on(sess, 'refused', p => {
    note('refusal:' + (((p || {}).errors || [])[0] || 'unknown'));
  });
  Game.on(sess, 'partyRecovered', p => {
    note('outcome:party-recovered', (p && p.hours) + ' hours');
  });
}

function movesFor(sess, actorId) {
  const ctx = Game.sceneCtx(sess);
  return { ctx, moves: Dispatch.legalMoves(sess.state, actorId, ctx) || [] };
}

function pick(moves, verb, filter) {
  const list = moves.filter(m => m.step && m.step.verb === verb &&
    (!filter || filter(m)));
  return list.length ? list[0] : null;
}

/* ------------------------------------------------------------- the run --- */

async function main() {
  if (!QUIET) console.log('\n  playing everything\n');

  const st = State.create({ seed: 'everything', campaignId: 'shen-cooper' });
  makeParty(st);
  State.refreshAllDerived(st);
  st.locationId = "lantern's rest";
  st.combat = { active: false, round: 0, order: [], turnIndex: 0 };

  const sess = Game.createSession({ state: st, campaign: camp });
  sess.locations = camp.locations;
  sess.questDefs = cont.quests;
  watch(sess);
  Game.settle(sess);

  let turn = 0;
  let travelled = 0;

  while (turn < TURNS) {
    turn++;

    if (!QUIET && turn % 25 === 0) {
      const alive = ['pc1', 'pc2', 'pc3', 'pc4']
        .filter(id => st.actors[id] && !st.actors[id].runtime.dead && st.actors[id].runtime.hp > 0).length;
      const foes = Object.keys(st.actors).filter(id =>
        st.actors[id].side === 'enemy' && !st.actors[id].runtime.dead).length;
      console.log('    turn ' + String(turn).padStart(4) + '  at ' + st.locationId +
        '  fight:' + (st.combat && st.combat.active ? 'yes' : 'no ') +
        '  party:' + alive + '/4  foes:' + foes +
        '  active:' + st.activeActorId + '  rev:' + st.revision);
    }

    /* Whoever the game says is up. Driving a fixed rotation of our own meant
       acting out of initiative and leaving the monsters to never move — the
       first version of this harness spent 157 of 200 turns pressing End Turn
       into a fight that could not progress. */
    const actorId = st.activeActorId ||
      (st.seats[0] && st.seats[0].actorId) || 'pc1';
    const a = st.actors[actorId];
    if (!a || a.runtime.dead || a.runtime.hp <= 0) {
      await passTurn(sess);
      continue;
    }

    const { ctx, moves } = movesFor(sess, actorId);
    if (!moves.length) {
      if (!(st.combat && st.combat.active) && a.runtime.hp > 0) note('state:no-legal-moves');
      await passTurn(sess);
      continue;
    }

    const took = (st.combat && st.combat.active)
      ? chooseInFight(moves, turn)
      : chooseInPeace(moves, turn, st);

    if (took) {
      if (took.step && took.step.verb === 'travel') travelled++;
      act(sess, actorId, took, ctx);
    }

    /* The real turn loop: hand off, let every AI seat and monster resolve, and
       come back when a person is needed. This is the door the browser walks
       through, so the harness walks through it too. */
    await passTurn(sess);

    if (!(st.combat && st.combat.active)) regroup(sess);
    if (turn % 18 === 0 && !(st.combat && st.combat.active)) spawnFight(sess, turn);
    if (turn % 20 === 0) tryLevelUp(sess);
  }

  report(sess, { turns: turn, travelled });
}

async function passTurn(sess) {
  try {
    const r = await Game.endHumanTurn(sess, { maxSteps: 40 });
    if (r && r.stopped === 'encounter over') note('outcome:encounter-resolved');
  } catch (e) {
    problem('the turn loop threw', String(e && e.message));
  }
}

function chooseInFight(moves, turn) {
  const order = [
    () => pick(moves, 'cast', m => /Cure|Heal/i.test(m.what)),
    () => (turn % 7 === 0 ? pick(moves, 'cast') : null),
    () => (turn % 11 === 0 ? pick(moves, 'grapple') : null),
    () => (turn % 13 === 0 ? pick(moves, 'shove') : null),
    () => (turn % 17 === 0 ? pick(moves, 'hide') : null),
    () => (turn % 19 === 0 ? pick(moves, 'dodge') : null),
    () => (turn % 23 === 0 ? pick(moves, 'help') : null),
    () => (turn % 29 === 0 ? pick(moves, 'ready') : null),
    () => (turn % 31 === 0 ? pick(moves, 'unarmed_strike') : null),
    () => (turn % 37 === 0 ? pick(moves, 'two_weapon_attack') : null),
    () => (turn % 41 === 0 ? pick(moves, 'drop_prone') : null),
    () => (turn % 43 === 0 ? pick(moves, 'drink') : null),
    () => pick(moves, 'multiattack'),
    () => pick(moves, 'attack'),
  ];
  for (const f of order) { const m = f(); if (m) return m; }
  return null;
}

/* Scenery verbs are not consumed by doing them: you can follow the same tracks
   all day. Left unchecked, `track` took 27 of 200 turns and nothing else ever
   got a look in. Remember what has been done where. */
const doneHere = {};
function once(st, verb, move) {
  if (!move) return null;
  const key = (st.locationId || '?') + '/' + verb + '/' + ((move.step && move.step.note) || '');
  if (doneHere[key]) return null;
  doneHere[key] = true;
  return move;
}

function chooseInPeace(moves, turn, st) {
  const party = ['pc1', 'pc2', 'pc3', 'pc4'];

  /* Healing and rest come FIRST. A harness that never rests simply kills the
     party and then reports that nothing else works — the first version of this
     ended every run 0/4 alive with most systems untouched. */
  const wounded = party.map(id => st.actors[id]).filter(p => p && !p.runtime.dead);
  const anyDown = wounded.some(p => p.runtime.hp <= 0);
  const anyHurt = wounded.some(p => p.runtime.hpMax && p.runtime.hp < p.runtime.hpMax * 0.7);

  if (anyDown || anyHurt) {
    const heal = pick(moves, 'cast', m => /Cure|Heal/i.test(m.what));
    if (heal) return heal;
    const rest = pick(moves, 'long_rest') || pick(moves, 'short_rest');
    if (rest) return rest;
  }

  /* Rest on a schedule as well as on need.
     Resting used to happen only when somebody happened to be below 70% out of
     combat, which across a whole 250-turn run occurred exactly ONCE in 207
     opportunities — so `verb:long_rest`, a required outcome, was being reached
     by luck. Any change that shifted the balance of a fight by a hair tipped it
     to zero and this harness reported a broken long rest that was working
     perfectly. A party that adventures for thirty turns without sleeping is the
     unrealistic case; make it deliberate. */
  if (turn % 30 === 0) {
    const scheduled = pick(moves, 'long_rest');
    if (scheduled) return scheduled;
  }
  if (turn % 45 === 0) {
    const breather = pick(moves, 'short_rest');
    if (breather) return breather;
  }

  /* Then whatever this place affords that has not been used yet. */
  const scenery = [
    'pick_up', 'unlock', 'disarm_trap', 'interact', 'read', 'track', 'forage',
  ];
  for (const v of scenery) {
    const m = once(st, v, pick(moves, v));
    if (m) return m;
  }

  const occasional = [
    [3, 'buy'], [4, 'search'], [5, 'ask'], [6, 'persuade'], [8, 'insight'],
    [9, 'sell'], [10, 'perform'], [12, 'tell'], [14, 'intimidate'],
    [15, 'deceive'], [16, 'ritual_cast'], [18, 'equip'], [20, 'mount'],
    [21, 'climb'], [22, 'swim'], [24, 'jump'], [26, 'give'], [28, 'attune'],
    [30, 'perceive'], [32, 'investigate'], [34, 'drink'], [36, 'dismount'],
  ];
  for (const [n, v] of occasional) {
    if (turn % n !== 0) continue;
    const m = pick(moves, v);
    if (m) return m;
  }

  if (turn % 25 === 0) {
    const rest = pick(moves, 'short_rest');
    if (rest) return rest;
  }
  /* Otherwise move on. Travel is the engine of this harness: it is what puts
     the party in front of new scenery. */
  return pick(moves, 'travel') || pick(moves, 'search') || pick(moves, 'perceive');
}


/**
 * Put something hostile in the room, so combat, death and XP all get
 * exercised rather than only the opening scene.
 *
 * Monsters are added HERE, at the party's own location. Using
 * `Worldgen.generateOpening` for this rewrote `state.locationId` and dropped
 * the party into a generated sandbox scene, so a run meant to walk the Shen
 * campaign spent three hundred turns in a barrow it had never travelled to.
 *
 * Only when the field is clear. Spawning regardless piled a new encounter on
 * top of the last every eighteen turns, so the party fought an ever-growing
 * horde and never rested.
 */
const BESTIARY = ['goblin', 'kobold', 'wolf', 'skeleton', 'bandit', 'giant-rat',
  'orc', 'zombie', 'giant-spider', 'hobgoblin'];

function spawnFight(sess, turn) {
  const st = sess.state;
  const living = Object.keys(st.actors).filter(id => {
    const a = st.actors[id];
    return a && a.side === 'enemy' && a.runtime && !a.runtime.dead && a.runtime.hp > 0;
  });
  if (living.length) return;

  /* Clear the fallen away, or the actor table grows without bound and every
     perception check walks a graveyard. */
  Object.keys(st.actors).forEach(id => {
    const a = st.actors[id];
    if (a && a.side === 'enemy') delete st.actors[id];
  });

  try {
    const MONSTERS = require('../js/data/srd_monsters.js').MONSTERS;
    const pickable = BESTIARY.filter(k => MONSTERS[k]);
    if (!pickable.length) { problem('no monsters in the bestiary to fight'); return; }
    const kind = pickable[turn % pickable.length];
    const sb = MONSTERS[kind];
    const howMany = 1 + (turn % 3);

    for (let i = 0; i < howMany; i++) {
      const id = 'foe-' + turn + '-' + i;
      const ab = sb.abilities || {};
      State.addActor(st, {
        id, name: sb.name + ' ' + String.fromCharCode(65 + i),
        side: 'enemy', kind: 'monster', statblock: sb,
        base: {
          name: sb.name,
          abilities: {
            str: ab.str || 10, dex: ab.dex || 10, con: ab.con || 10,
            int: ab.int || 10, wis: ab.wis || 10, cha: ab.cha || 10,
          },
          proficiencies: { skills: [], saves: [] }, classes: [],
        },
        progression: { xp: 0, levels: [] },
        runtime: {
          hp: sb.hp || 10, hpMax: sb.hp || 10, tempHp: 0, conditions: {},
          exhaustion: 0, concentratingOn: null, attuned: [], equipped: {},
          inventory: [], deathSaves: { successes: 0, failures: 0 },
          resources: {}, gold: 0, pos: { x: 6 + i, y: 3 },
        },
      });
    }
    State.refreshAllDerived(st);
    note('outcome:encounter-spawned');
    if (Game.ensureEncounter(sess)) note('outcome:initiative-rolled');
  } catch (e) {
    problem('spawning a fight threw', String(e && e.message));
  }
}

/**
 * Between fights, put the party back together — which is what a table does,
 * and what keeps a long run exercising the whole game rather than the last
 * survivor's options.
 */
function regroup(sess) {
  const st = sess.state;
  const down = ['pc1', 'pc2', 'pc3', 'pc4'].filter(id => {
    const a = st.actors[id];
    return a && !a.runtime.dead && a.runtime.hp <= 0;
  });
  if (!down.length) return;
  const b = Events.makeBatch({ commandId: 'regroup:' + st.revision });
  down.forEach(id => {
    Events.push(b, 'revive', { actorId: id, hp: 1 }, (st.actors[id].name) + ' is brought round.');
  });
  Events.commit(st, b);
  note('outcome:revived');
}

/**
 * Level anyone who has the experience for it, through the real level-up path.
 */
function tryLevelUp(sess) {
  const st = sess.state;
  const XP_BY_LEVEL = require('../js/data/srd_rules.js').XP_BY_LEVEL || [];
  Object.keys(st.actors).forEach(id => {
    const a = st.actors[id];
    if (!a || a.side !== 'party' || a.runtime.dead) return;
    try {
      const level = (a.base.classes || []).reduce((n, c) => n + c.levels, 0);
      if (level >= 6) return;
      /* Top them up to the next threshold. XP_BY_LEVEL is 1-indexed with a
         null at [0], so the requirement for the NEXT level is [level + 1] —
         reading [level] gave the threshold they had already passed, so nothing
         ever levelled and nothing ever complained. */
      const need = XP_BY_LEVEL[level + 1] || null;
      if (need != null && (a.progression.xp || 0) < need) {
        const b = Events.makeBatch({ commandId: 'grant-xp:' + id + ':' + st.revision });
        Events.push(b, 'xp', { actorId: id, delta: need - (a.progression.xp || 0) }, '');
        Events.commit(st, b);
      }

      const pending = LevelUp.pendingLevel(a.base, a.progression);
      if (!pending) return;
      const options = LevelUp.optionsFor(a.base, a.progression, {});
      const choices = LevelUp.autoChoose(a.base, a.progression, options, {});
      const errs = LevelUp.validate(options, choices);
      if (errs.length) { problem('auto level-up produced an illegal set', errs.join('; ')); return; }
      const batch = LevelUp.applyLevel(a.base, a.progression, options, choices,
        { actorId: id, rng: st.rng });
      if (!batch) { problem('applyLevel returned nothing for ' + id); return; }
      const res = Events.commit(st, batch);
      if (!res.ok) { problem('level-up would not commit', res.error || ''); return; }
      State.refreshAllDerived(st);
      readBatch(st, batch, 'level_up');
    } catch (e) {
      problem('levelling ' + id + ' threw', String(e && e.message));
    }
  });
}

/* -------------------------------------------------------------- report --- */

/*
 * What a working game must have done at least once. A zero here is a finding.
 */
const MUST = [
  'verb:attack', 'verb:cast', 'verb:travel', 'verb:search',
  'verb:long_rest',
  'roll:attack', 'roll:damage', 'roll:check',
  'outcome:damage-dealt', 'outcome:healing',
  'outcome:spell-slot-spent', 'outcome:travelled',
  'outcome:initiative-rolled', 'outcome:xp-awarded',
  'quest:objective',
];

/*
 * Things a full session ought to reach, but which depend on the dice. Reported
 * separately so a run that happens not to roll a natural 20 is not a failure.
 */
const HOPED = [
  'outcome:natural-20', 'outcome:natural-1', 'outcome:death',
  'outcome:death-save', 'outcome:level-up', 'outcome:item-gained',
  'outcome:gold-spent', 'outcome:obstacle-cleared', 'outcome:trap-sprung',
  'outcome:fact-learned', 'outcome:combat-ended', 'outcome:spells-re-prepared',
  'verb:buy', 'verb:persuade', 'verb:pick_up', 'verb:unlock', 'verb:ritual_cast',
  'verb:short_rest', 'verb:end_turn', 'outcome:party-recovered',
  'verb:grapple', 'verb:hide', 'verb:dodge', 'verb:forage', 'verb:read',
];

function report(sess, stats) {
  const st = sess.state;
  const keys = Object.keys(seen).sort();

  if (!QUIET) {
    console.log('\n  what happened\n');
    const groups = {};
    keys.forEach(k => {
      const g = k.split(':')[0];
      (groups[g] = groups[g] || []).push(k);
    });
    Object.keys(groups).sort().forEach(g => {
      console.log('  ' + g);
      groups[g].forEach(k => {
        console.log('    ' + String(seen[k]).padStart(5) + '  ' + k.slice(g.length + 1));
      });
    });
  }

  const missing = MUST.filter(k => !seen[k]);
  const unreached = HOPED.filter(k => !seen[k]);

  console.log('\n  ---------------------------------------------------------');
  console.log('  turns              ' + stats.turns);
  console.log('  distinct outcomes  ' + keys.length);
  console.log('  travels            ' + stats.travelled);
  console.log('  party alive        ' +
    ['pc1', 'pc2', 'pc3', 'pc4'].filter(id => st.actors[id] && !st.actors[id].runtime.dead).length + '/4');
  console.log('  quests touched     ' +
    Object.keys(st.quests || {}).filter(q =>
      Object.keys((st.quests[q].objectives) || {}).length).length +
    '/' + Object.keys(st.quests || {}).length);
  console.log('  errors             ' + problems.length);

  if (problems.length) {
    console.log('\n  PROBLEMS');
    problems.slice(0, 20).forEach(p => console.log('    - ' + p));
  }
  if (unreached.length) {
    console.log('\n  not reached this run (dice-dependent):');
    console.log('    ' + unreached.join(', '));
  }
  if (missing.length) {
    console.log('\n  MISSING — these must happen in any working session:');
    missing.forEach(k => console.log('    - ' + k));
  }

  const ok = !missing.length && !problems.length;
  console.log('\n  ' + (ok ? 'PASS' : 'FAIL') + ' — everything — ' +
    keys.length + ' distinct outcomes, ' + problems.length + ' errors, ' +
    missing.length + ' required outcomes missing\n');
  process.exit(ok ? 0 : 1);
}

main();
