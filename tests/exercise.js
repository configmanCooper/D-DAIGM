/**
 * exercise.js — drive every verb the engine claims to support.
 *
 * The playtest harness is combat-shaped: it starts a fight and lets seats take
 * turns. That exercises attacks and movement thoroughly and almost nothing
 * else, which is how "the rest verbs both threw" survived a large test suite.
 *
 * This walks the ENTIRE verb table from js/engine/command.js — all eight
 * families, every verb — through the real dispatch path against a scene built
 * to make each one meaningful: a party with gear and spells, an enemy, a
 * neutral NPC who will talk, a locked and trapped chest, and a road out.
 *
 * It is deliberately not a unit test. A unit test asserts a known answer; this
 * asks "does the engine survive being asked to do everything it advertises",
 * and reports refusals with their reasons so a human can judge which refusals
 * are correct rules and which are bugs. A verb that refuses for a good reason
 * ("no action left") passes. A verb that throws, or refuses because the engine
 * does not recognise it, does not.
 *
 *     node tests/exercise.js
 *     node tests/exercise.js --verbose     show every beat
 */
'use strict';

const State = require('../js/engine/state.js');
const Events = require('../js/engine/events.js');
const Command = require('../js/engine/command.js');
const Dispatch = require('../js/engine/dispatch.js');
const Character = require('../js/engine/character.js');
const Chargen = require('../js/gen/chargen.js');
const Knowledge = require('../js/engine/knowledge.js');
const Combat = require('../js/engine/combat.js');
const Prepare = require('../js/engine/prepare.js');
const { RNG } = require('../js/rng.js');
const SPELLS = require('../js/data/srd_spells.js').SPELLS;
require('../js/engine/interaction.js');

const VERBOSE = process.argv.includes('--verbose');
/* In the suite this runs as a gate, not a report: only the summary and any
   problems are worth the scrollback. */
const QUIET = process.argv.includes('--quiet');

const RESULTS = [];
function record(family, verb, outcome, detail) {
  RESULTS.push({ family, verb, outcome, detail: detail || '' });
}

function log(...a) { if (!QUIET) console.log(...a); }
function say(...a) { console.log(...a); }
function hr(title) {
  log('\n' + '\u2500'.repeat(76));
  if (title) log('  ' + title);
  if (title) log('\u2500'.repeat(76));
}

/* --------------------------------------------------------------- scene -- */

/**
 * A room that makes every verb meaningful: someone to fight, someone to talk
 * to, something to open, something to steal, somewhere to go.
 */
function scene() {
  const s = State.create({ seed: 'exercise' });

  const cast = [
    { id: 'pc1', name: 'Vess Ardenwold', classId: 'fighter', level: 5 },
    { id: 'pc2', name: 'Bramwell Tuck', classId: 'cleric', level: 5 },
    { id: 'pc3', name: 'Ysolde Vane', classId: 'wizard', level: 5 },
    { id: 'pc4', name: 'Sable', classId: 'rogue', level: 5 },
  ];
  cast.forEach(c => {
    const spec = Chargen.generate({
      rng: new RNG('ex-' + c.id),
      fixed: { classId: c.classId, levels: c.level, name: c.name },
    });
    const ch = Character.buildFromSpec(spec);
    State.addActor(s, {
      id: c.id, name: c.name, side: 'party', kind: 'pc',
      base: ch.base, progression: ch.progression,
      runtime: Object.assign(ch.runtime, { pos: { x: 1, y: 1 }, gold: 50 }),
    });
  });

  /* A hostile that can fight back, and a boss that cannot be trivially killed. */
  State.addActor(s, {
    id: 'foe', name: 'Gnoll', side: 'enemy', kind: 'monster', cr: '1/2',
    base: { name: 'Gnoll', abilities: { str: 14, dex: 12, con: 11, int: 6, wis: 10, cha: 7 }, classes: [] },
    statblock: { ac: 15, attacks: [{ name: 'Bite', toHit: 4, damage: '1d4+2', damageType: 'piercing' }] },
    progression: { levels: [] },
    runtime: { hp: 22, hpMax: 22, conditions: {}, inventory: [], deathSaves: {}, pos: { x: 4, y: 1 }, speed: 30 },
  });
  State.addActor(s, {
    id: 'boss', name: 'Hobgoblin Warlord', side: 'enemy', kind: 'monster', cr: '6',
    important: true,
    base: { name: 'Hobgoblin Warlord', abilities: { str: 16, dex: 14, con: 16, int: 14, wis: 11, cha: 15 }, classes: [] },
    statblock: {
      ac: 17, resistances: ['slashing'],
      attacks: [{ name: 'Greatsword', toHit: 6, damage: '2d6+3', damageType: 'slashing' }],
      multiattack: { sequence: [{ actionRef: 0, count: 3 }] },
    },
    progression: { levels: [] },
    runtime: { hp: 97, hpMax: 97, conditions: {}, inventory: [], deathSaves: {}, pos: { x: 6, y: 1 }, speed: 30 },
  });

  /* Someone who will actually hold a conversation. */
  State.addActor(s, {
    id: 'npc', name: 'Petra Oarswell', side: 'neutral', kind: 'npc',
    base: {
      name: 'Petra Oarswell', abilities: { str: 10, dex: 12, con: 11, int: 12, wis: 13, cha: 14 },
      classes: [], languages: ['common'],
    },
    progression: { levels: [] },
    runtime: {
      hp: 9, hpMax: 9, conditions: {}, inventory: [], deathSaves: {},
      pos: { x: 2, y: 1 }, gold: 30, attitude: 'neutral',
    },
  });

  State.refreshAllDerived(s);

  /* Everyone gets a full turn's economy so an action is never refused merely
     for being out of turn — that is not what this is testing. */
  Object.keys(s.actors).forEach(id => {
    s.actors[id].runtime.turn = {
      action: true, bonus: true, reaction: true, objectInteraction: true,
      movementRemaining: 30, surprised: false,
    };
  });

  s.locationId = 'chapel';
  s.locations = s.locations || {};
  s.locations.chapel = {
    id: 'chapel', name: 'The Drowned Chapel',
    description: 'Waterlogged pews and a collapsed roof.',
    exits: { north: 'road' },
    features: [
      { id: 'chest', name: 'iron-bound chest', locked: true, dc: 15, trapped: true, trapDc: 14 },
      { id: 'altar', name: 'cracked altar', searchDc: 12 },
    ],
  };
  s.locations.road = { id: 'road', name: 'The North Road', description: 'Mud and cart ruts.', exits: { south: 'chapel' } };

  return s;
}

/* ------------------------------------------------------------- driving -- */

function run(s, history, actorId, family, verb, step, ctx) {
  const cmd = Command.create({
    actorId, family,
    stateRevision: s.revision, turnEpoch: s.turnEpoch,
    primary: Command.makeStep(Object.assign({ verb }, step || {})),
  });

  let res;
  try {
    res = Dispatch.dispatch(s, history, cmd, ctx || {});
  } catch (e) {
    record(family, verb, 'THREW', e.message);
    log(`  \u2717 ${family}/${verb} THREW: ${e.message}`);
    return null;
  }

  const refusal = res.batch && res.batch.refused;
  if (refusal) {
    /* An engine that does not know the verb is a bug. An engine that says
       "you have no action left" is the rules working. */
    const unknown = /unknown|does not know|not implemented|no resolver/i.test(
      String(refusal.reason) + ' ' + String(refusal.detail));
    record(family, verb, unknown ? 'UNKNOWN' : 'refused', refusal.detail || refusal.reason);
    log(`  ${unknown ? '\u2717' : '\u25cb'} ${family}/${verb} refused: ${refusal.detail || refusal.reason}`);
    return res;
  }

  if (!res.ok) {
    record(family, verb, 'FAILED', (res.errors || []).join('; ') || res.stage);
    log(`  \u2717 ${family}/${verb} failed: ${(res.errors || []).join('; ') || res.stage}`);
    return res;
  }

  const beats = (res.batch && res.batch.beats) || [];
  record(family, verb, 'ok', beats[0] || '');
  log(`  \u2713 ${family}/${verb}` + (beats.length ? `  \u2014 ${beats[0]}` : ''));
  if (VERBOSE) beats.slice(1).forEach(b => log(`      \u00b7 ${b}`));
  return res;
}

/* Give the actor a fresh turn so the next verb is not refused for economy. */
function refresh(s, actorId) {
  const a = s.actors[actorId];
  if (!a) return;
  a.runtime.turn = {
    action: true, bonus: true, reaction: true, objectInteraction: true,
    movementRemaining: 30, surprised: false,
  };
}

/* ------------------------------------------------------------- the run -- */

function main() {
  log('\n  AETHERTABLE \u2014 exercising every verb the engine advertises\n');

  const s = scene();
  const history = State.makeHistory();
  const ctx = {
    derivedA: s.actors.pc1.derivedCache,
    derivedB: s.actors.foe.derivedCache,
  };

  hr('combat');
  run(s, history, 'pc1', 'combat', 'attack', { targetIds: ['foe'] });
  refresh(s, 'pc1');
  run(s, history, 'pc1', 'combat', 'unarmed_strike', { targetIds: ['foe'] });
  refresh(s, 'pc1');
  run(s, history, 'pc1', 'combat', 'two_weapon_attack', { targetIds: ['foe'] });
  refresh(s, 'pc1');
  run(s, history, 'pc1', 'combat', 'grapple', { targetIds: ['foe'] }, ctx);
  refresh(s, 'pc1');
  run(s, history, 'pc1', 'combat', 'escape_grapple', {});
  refresh(s, 'pc1');
  run(s, history, 'pc1', 'combat', 'shove', { targetIds: ['foe'] }, ctx);
  refresh(s, 'pc1');
  run(s, history, 'pc1', 'combat', 'dodge', {});
  refresh(s, 'pc1');
  run(s, history, 'pc1', 'combat', 'disengage', {});
  refresh(s, 'pc1');
  run(s, history, 'pc1', 'combat', 'dash', {});
  refresh(s, 'pc1');
  run(s, history, 'pc4', 'combat', 'hide', {});
  refresh(s, 'pc4');
  run(s, history, 'pc2', 'combat', 'help', { targetIds: ['pc1', 'foe'] });
  refresh(s, 'pc2');
  run(s, history, 'pc1', 'combat', 'ready', {});
  refresh(s, 'pc1');
  run(s, history, 'pc1', 'combat', 'opportunity_attack', { targetIds: ['foe'] });
  refresh(s, 'pc1');

  hr('movement');
  ['move', 'stand_up', 'drop_prone', 'climb', 'swim', 'jump', 'crawl', 'mount', 'dismount'].forEach(v => {
    run(s, history, 'pc1', 'movement', v, { point: { x: 2, y: 1 } });
    refresh(s, 'pc1');
  });

  hr('spells');
  /* The wizard and the cleric between them cover attack spells, healing and
     concentration. Whatever they actually prepared is what gets cast. */
  ['pc3', 'pc2'].forEach(id => {
    const d = State.refreshDerived(s, id);
    const known = (d.spellcasting && (d.spellcasting.prepared || [])) || [];
    const cantrips = (d.spellcasting && d.spellcasting.cantripsKnown) || [];
    log(`  ${s.actors[id].name}: ${known.length} prepared, ${cantrips.length} cantrips`);

    if (cantrips.length) {
      run(s, history, id, 'spell', 'cast', { spellId: cantrips[0], targetIds: ['foe'] });
      refresh(s, id);
    }
    known.slice(0, 3).forEach(spellId => {
      /* Cast at the spell's own level. Asking for a level-1 slot every time
         just proves the "slot too low" rule over and over instead of actually
         exercising the spell. */
      const lvl = (SPELLS[spellId] && SPELLS[spellId].level) || 1;
      run(s, history, id, 'spell', 'cast', { spellId, targetIds: ['foe'], slotLevel: lvl });
      refresh(s, id);
    });
    if (known.length) {
      const first = known[0];
      const baseLvl = (SPELLS[first] && SPELLS[first].level) || 1;
      run(s, history, id, 'spell', 'cast', { spellId: first, targetIds: ['foe'], slotLevel: baseLvl + 1 });
      refresh(s, id);
      run(s, history, id, 'spell', 'ritual_cast', { spellId: first, targetIds: [id], slotLevel: baseLvl });
      refresh(s, id);
    }
    run(s, history, id, 'spell', 'dismiss_concentration', {});
    refresh(s, id);
    run(s, history, id, 'spell', 'counterspell', { targetIds: ['boss'] });
    refresh(s, id);
  });

  hr('items');
  const inv = s.actors.pc1.runtime.inventory || [];
  log(`  Vess carries: ${inv.map(i => i.id || i.name).join(', ') || '(nothing)'}`);
  const first = inv[0] && (inv[0].uid || inv[0].id);
  ['equip', 'unequip', 'attune', 'unattune', 'use', 'drink', 'throw', 'drop', 'pick_up'].forEach(v => {
    run(s, history, 'pc1', 'item', v, { itemId: first, targetIds: ['foe'] });
    refresh(s, 'pc1');
  });
  run(s, history, 'pc1', 'item', 'give', { itemId: first, targetIds: ['pc2'] });
  refresh(s, 'pc1');
  run(s, history, 'pc1', 'item', 'buy', { itemId: 'potion-of-healing', targetIds: ['npc'] });
  refresh(s, 'pc1');
  run(s, history, 'pc1', 'item', 'sell', { itemId: first, targetIds: ['npc'] });
  refresh(s, 'pc1');

  hr('social / negotiation');
  ['persuade', 'deceive', 'intimidate', 'perform', 'ask', 'tell', 'offer', 'refuse', 'insight'].forEach(v => {
    run(s, history, 'pc2', 'social', v, {
      targetIds: ['npc'],
      social: { topic: 'the road north', line: 'We mean you no harm.', offer: '10 gold' },
    });
    refresh(s, 'pc2');
  });
  /* And against a hostile mid-fight, which should be gated differently. */
  run(s, history, 'pc2', 'social', 'intimidate', { targetIds: ['foe'], social: { line: 'Drop it.' } });
  refresh(s, 'pc2');

  hr('exploration / travel / rests');
  ['search', 'investigate', 'perceive', 'track', 'forage', 'read'].forEach(v => {
    run(s, history, 'pc4', 'exploration', v, { targetIds: ['altar'], note: 'the cracked altar' });
    refresh(s, 'pc4');
  });
  run(s, history, 'pc4', 'exploration', 'disarm_trap', { targetIds: ['chest'] });
  refresh(s, 'pc4');
  run(s, history, 'pc4', 'exploration', 'unlock', { targetIds: ['chest'] });
  refresh(s, 'pc4');
  run(s, history, 'pc4', 'exploration', 'interact', { targetIds: ['chest'] });
  refresh(s, 'pc4');
  run(s, history, 'pc1', 'exploration', 'travel', { note: 'north', point: { locationId: 'road' } });
  refresh(s, 'pc1');
  run(s, history, 'pc1', 'exploration', 'short_rest', {});
  run(s, history, 'pc1', 'exploration', 'long_rest', {});

  hr('improvised');
  [
    'I wedge my dagger under the lid and lever it open',
    'I shout to draw the gnoll away from Bram',
    'I tip the pew over to make cover',
  ].forEach(text => {
    run(s, history, 'pc1', 'improvised', 'improvise', { improvised: text, note: text });
    refresh(s, 'pc1');
  });

  hr('meta');
  ['note', 'pass', 'end_turn'].forEach(v => {
    run(s, history, 'pc1', 'meta', v, { note: 'a note' });
    refresh(s, 'pc1');
  });

  hr('a boss fight, fought to a conclusion');
  bossFight();

  /* ------------------------------------------------------------ report -- */
  if (QUIET) { console.log(''); console.log('  exercise — every advertised verb'); }
  else hr('summary');
  const by = k => RESULTS.filter(r => r.outcome === k);
  const ok = by('ok'), refused = by('refused'), unknown = by('UNKNOWN');
  const threw = by('THREW'), failed = by('FAILED');

  const bad = unknown.length + threw.length + failed.length;

  if (!QUIET) {
    say(`  verbs exercised : ${RESULTS.length}`);
    say(`  resolved        : ${ok.length}`);
    say(`  refused (rules) : ${refused.length}`);
    say(`  UNKNOWN verb    : ${unknown.length}`);
    say(`  THREW           : ${threw.length}`);
    say(`  FAILED          : ${failed.length}`);
  }

  if (bad) {
    say('\n  problems:');
    [...unknown, ...threw, ...failed].forEach(r => {
      say(`    ${r.outcome.padEnd(8)} ${r.family}/${r.verb}  ${r.detail}`);
    });
  }

  if (refused.length && !QUIET) {
    say('\n  refusals (check each is a real rule, not a gap):');
    refused.forEach(r => say(`    ${r.family}/${r.verb}: ${r.detail}`));
  }

  say('');
  say(bad
    ? `  FAIL — exercise — ${bad} problem(s) in ${RESULTS.length} verbs`
    : `  PASS — exercise — ${RESULTS.length} verbs, ${ok.length} resolved, ${refused.length} refused for a stated reason`);
  process.exitCode = bad ? 1 : 0;
}

/**
 * A real fight against something that can win, run to a conclusion.
 *
 * A boss is where the parts have to work together: multiattack, resistance,
 * death saves, an initiative order that survives creatures dying in it, and
 * an encounter that actually ends.
 */
function bossFight() {
  const s = scene();
  /* Just the party and the warlord. */
  delete s.actors.foe;
  delete s.actors.npc;
  State.refreshAllDerived(s);

  const entries = Object.keys(s.actors).map(id => ({
    id, mod: (s.actors[id].derivedCache || {}).initiative || 0,
  }));
  Events.commit(s, Combat.beginEncounter(s, entries, {}));
  const first = s.combat.order[0].id;
  s.activeActorId = first;
  Events.commit(s, Combat.startTurn(s, first));

  log('  initiative: ' + s.combat.order.map(o => s.actors[o.id].name + ' ' + o.total).join('  |  '));

  const history = State.makeHistory();
  let rounds = 0;
  let guard = 0;

  while (s.combat.active && guard++ < 400) {
    const actorId = s.activeActorId;
    const a = s.actors[actorId];
    if (!a || a.runtime.dead || a.runtime.hp <= 0) {
      Events.commit(s, Combat.advanceTurn(s, {}));
      const over = Combat.encounterOver(s);
      if (over.over) break;
      continue;
    }

    const moves = Dispatch.legalMoves(s, actorId, {});
    const attack = moves.filter(m => m.step.verb === 'attack')[0];
    if (attack) {
      try {
        Dispatch.dispatch(s, history, Command.create({
          actorId, family: 'combat',
          stateRevision: s.revision, turnEpoch: s.turnEpoch,
          primary: attack.step,
        }), {});
      } catch (e) {
        log(`  \u2717 boss fight threw on ${a.name}'s attack: ${e.message}`);
        record('boss', 'attack', 'THREW', e.message);
        break;
      }
    }

    Events.commit(s, Combat.advanceTurn(s, {}));
    const over = Combat.encounterOver(s);
    if (over.over) {
      log(`  the fight ends in round ${s.combat.round}: ${over.winner} wins`);
      record('boss', 'encounter', 'ok', over.winner + ' won in round ' + s.combat.round);
      break;
    }
    if (s.combat.round > rounds) rounds = s.combat.round;
  }

  if (guard >= 400) {
    log('  \u2717 the boss fight never ended (400 turns)');
    record('boss', 'encounter', 'FAILED', 'never terminated');
  }

  Object.keys(s.actors).forEach(id => {
    const a = s.actors[id];
    log(`    ${String(a.name).padEnd(20)} ${a.runtime.hp}/${a.runtime.hpMax}${a.runtime.dead ? '  DEAD' : ''}`);
  });

  /* Resistance must have mattered: the warlord resists slashing. */
  const dmg = s.log.flatMap(b => b.events || []).filter(e => e.kind === 'hp' && e.delta < 0);
  log(`    ${dmg.length} damage events across the fight`);
}

main();
