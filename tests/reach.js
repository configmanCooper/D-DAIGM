/*
 * reach.js — which of the advertised verbs can a player EVER reach?
 *
 * `tests/exercise.js` proves every verb RESOLVES when handed a command. That
 * is a different question from whether a player is ever OFFERED it. A verb the
 * engine handles correctly and the action bar never shows is, from the table's
 * point of view, a verb the game does not have.
 *
 * IMPORTANT — what this measures. This is SCENARIO coverage, not what any one
 * player sees at any one moment. It sweeps several situations (a fight, peace,
 * prone, grappled, mounted, a caster with a spellbook, a character with an
 * attuneable item) and asks whether each verb is offered in AT LEAST ONE of
 * them. That is the right question for "is this verb dead code", and the wrong
 * question for "how much of the game is in front of me right now" — an
 * ordinary scene offers around 25-40 of these, which is as it should be, since
 * you cannot stand up unless you are prone.
 *
 *     node tests/reach.js           the report
 *     node tests/reach.js --quiet   just the counts
 *     node tests/reach.js --strict  exit non-zero if any verb is unreachable
 */
'use strict';

const State = require('../js/engine/state.js');
const Character = require('../js/engine/character.js');
const Dispatch = require('../js/engine/dispatch.js');
const Command = require('../js/engine/command.js');
require('../js/engine/interaction.js');
require('../js/engine/combat.js');
const Game = require('../js/game.js');

const QUIET = process.argv.includes('--quiet');

function allVerbs() {
  const out = [];
  Object.keys(Command.VERBS).forEach(fam => {
    (Command.VERBS[fam] || []).forEach(v => out.push({ family: fam, verb: v }));
  });
  return out;
}

function hero(id, name, opts) {
  opts = opts || {};
  const c = Character.buildFromSpec({
    name, raceId: 'human', classId: opts.classId || 'fighter', levels: opts.levels || 3,
    backgroundId: 'soldier',
    abilities: { str: 16, dex: 14, con: 14, int: 12, wis: 12, cha: 14 },
    proficiencies: { skills: ['athletics', 'perception', 'investigation', 'persuasion'] },
  });
  c.runtime.pos = opts.pos || { x: 2, y: 2 };
  return { id, name, side: opts.side || 'party', kind: 'pc', base: c.base, progression: c.progression, runtime: c.runtime };
}

function foe(id, name, pos) {
  const c = Character.buildFromSpec({
    name, raceId: 'human', classId: 'fighter', levels: 2, backgroundId: 'soldier',
    abilities: { str: 14, dex: 12, con: 12, int: 8, wis: 10, cha: 8 },
    proficiencies: { skills: [] },
  });
  c.runtime.pos = pos || { x: 4, y: 2 };
  return { id, name, side: 'enemy', kind: 'monster', base: c.base, progression: c.progression, runtime: c.runtime };
}

/* A scene with as much going on as the game can express: a fight, an ally, a
   friendly local, a merchant, a locked door, a trap, an animal to ride, a book
   to read, loot on the ground and somewhere to go. If a verb cannot be reached
   HERE it cannot be reached anywhere. */
function richScene() {
  const st = State.create({ seed: 'reach' });
  State.addActor(st, hero('pc1', 'Hero'));
  State.addActor(st, hero('pc2', 'Comrade', { pos: { x: 2, y: 3 } }));
  State.addActor(st, foe('foe1', 'Bandit'));
  State.addActor(st, {
    id: 'npc1', name: 'Merchant', side: 'neutral', kind: 'npc', role: 'trader',
    base: {
      name: 'Merchant', abilities: { str: 10, dex: 10, con: 10, int: 12, wis: 12, cha: 14 },
      proficiencies: { skills: [], saves: [] }, classes: [],
    },
    progression: { xp: 0, levels: [] },
    runtime: {
      hp: 9, hpMax: 9, tempHp: 0, conditions: {}, exhaustion: 0, concentratingOn: null,
      attuned: [], equipped: {}, inventory: [], deathSaves: { successes: 0, failures: 0 },
      resources: {}, gold: 50, pos: { x: 3, y: 3 },
    },
  });
  State.addSeat(st, { id: 'p1', name: 'P1', actorId: 'pc1', control: 'human' });
  State.refreshAllDerived(st);

  st.locationId = 'crossroads';
  st.combat = {
    active: true, round: 1, turnIndex: 0,
    order: [{ id: 'pc1' }, { id: 'pc2' }, { id: 'foe1' }],
  };
  st.actors.pc1.runtime.turn = {
    action: true, bonus: true, reaction: true, objectInteraction: true,
    movementRemaining: 30, surprised: false,
  };
  return st;
}

/* Everything a scene could offer the engine. */
function fullCtx() {
  return {
    exits: [{ id: 'wrenford', name: 'Wrenford' }, { id: 'dunmere', name: 'Dunmere' }],
    groundItems: [{ uid: 'g1', id: 'longsword', name: 'a longsword' }],
    merchants: [{ actorId: 'npc1', name: 'Merchant', sells: ['potion-of-healing'], buys: true }],
    obstacles: [
      { id: 'door1', kind: 'locked', name: 'an iron door' },
      { id: 'trap1', kind: 'trap', name: 'a pressure plate' },
      { id: 'wall1', kind: 'climb', name: 'the chapel wall' },
      { id: 'chasm1', kind: 'jump', name: 'a narrow chasm' },
      { id: 'river1', kind: 'swim', name: 'the millrace' },
    ],
    mounts: [{ id: 'horse1', name: 'a riding horse' }],
    readables: [{ id: 'book1', name: 'a water-stained ledger' }],
    interactables: [{ id: 'lever1', name: 'a rusted lever' }],
    tracks: [{ id: 'trail1', name: 'boot prints in the mud' }],
    forage: true,
  };
}

function reachableVerbs(st, actorId, ctx) {
  const seen = {};
  (Dispatch.legalMoves(st, actorId, ctx) || []).forEach(m => {
    if (m && m.step && m.step.verb) seen[m.step.verb] = true;
  });
  return seen;
}

function main() {
  const verbs = allVerbs();
  const st = richScene();
  const ctx = fullCtx();

  /* In a fight, and out of it, and prone, and grappled, and mounted: some
     verbs only exist in one of those. */
  const seen = {};
  const merge = s => Object.keys(s).forEach(k => { seen[k] = true; });

  merge(reachableVerbs(st, 'pc1', ctx));

  const peace = richScene();
  peace.combat = { active: false, round: 0, order: [], turnIndex: 0 };
  merge(reachableVerbs(peace, 'pc1', ctx));

  const prone = richScene();
  prone.actors.pc1.runtime.conditions.prone = { rounds: null };
  merge(reachableVerbs(prone, 'pc1', ctx));

  const grappled = richScene();
  grappled.actors.pc1.runtime.conditions.grappled = { rounds: null, by: 'foe1' };
  merge(reachableVerbs(grappled, 'pc1', ctx));

  const mounted = richScene();
  mounted.actors.pc1.runtime.mountedOn = 'horse1';
  merge(reachableVerbs(mounted, 'pc1', ctx));

  const caster = State.create({ seed: 'reach-caster' });
  State.addActor(caster, hero('pc1', 'Mage', { classId: 'wizard', levels: 5 }));
  /* An enemy who can cast, so counterspell has something to answer. */
  const enemyMage = hero('foe1', 'Cult Adept', { classId: 'wizard', levels: 3, side: 'enemy', pos: { x: 4, y: 2 } });
  State.addActor(caster, enemyMage);
  State.addSeat(caster, { id: 'p1', name: 'P1', actorId: 'pc1', control: 'human' });
  /* Counterspell and a ritual spell in the book, and something to attune to. */
  caster.actors.pc1.progression.preparedSpells =
    (caster.actors.pc1.progression.preparedSpells || []).concat(['counterspell', 'detect-magic']);
  caster.actors.pc1.runtime.inventory.push({
    uid: 'amulet1', id: 'amulet-of-health', name: 'a heavy amulet',
  });
  State.refreshAllDerived(caster);
  caster.combat = { active: true, round: 1, turnIndex: 0, order: [{ id: 'pc1' }, { id: 'foe1' }] };
  caster.actors.pc1.runtime.turn = {
    action: true, bonus: true, reaction: true, objectInteraction: true,
    movementRemaining: 30, surprised: false,
  };
  caster.actors.pc1.runtime.concentratingOn = { spellId: 'bless' };
  merge(reachableVerbs(caster, 'pc1', ctx));

  /* Rituals and attunement are both out-of-combat business. */
  const quiet = State.create({ seed: 'reach-quiet' });
  State.addActor(quiet, hero('pc1', 'Mage', { classId: 'wizard', levels: 5 }));
  State.addSeat(quiet, { id: 'p1', name: 'P1', actorId: 'pc1', control: 'human' });
  quiet.actors.pc1.progression.preparedSpells =
    (quiet.actors.pc1.progression.preparedSpells || []).concat(['detect-magic', 'identify']);
  quiet.actors.pc1.runtime.inventory.push({
    uid: 'amulet1', id: 'amulet-of-health', name: 'a heavy amulet',
  });
  State.refreshAllDerived(quiet);
  quiet.combat = { active: false, round: 0, order: [], turnIndex: 0 };
  merge(reachableVerbs(quiet, 'pc1', ctx));

  /* And once attuned, ending it. */
  const bonded = State.create({ seed: 'reach-bonded' });
  State.addActor(bonded, hero('pc1', 'Mage', { classId: 'wizard', levels: 5 }));
  State.addSeat(bonded, { id: 'p1', name: 'P1', actorId: 'pc1', control: 'human' });
  bonded.actors.pc1.runtime.inventory.push({
    uid: 'amulet1', id: 'amulet-of-health', name: 'a heavy amulet',
  });
  bonded.actors.pc1.runtime.attuned = ['amulet1'];
  State.refreshAllDerived(bonded);
  bonded.combat = { active: false, round: 0, order: [], turnIndex: 0 };
  merge(reachableVerbs(bonded, 'pc1', ctx));

  /* Verbs that are reachable by their nature rather than through the bar. */
  const byNature = {
    opportunity_attack: 'a reaction the engine takes for you',
    improvise: 'anything typed that is not a known verb',
    clarify: 'the engine asking you what you meant',
    undo: 'the Undo button',
    pass: 'the Do nothing button',
    note: 'a journal note, not a turn',
    multiattack: 'monsters only',
  };

  const missing = verbs.filter(v => !seen[v.verb] && !byNature[v.verb]);
  const natural = verbs.filter(v => !seen[v.verb] && byNature[v.verb]);

  if (!QUIET) {
    console.log('\n  reachable from the action bar\n');
    const byFam = {};
    verbs.forEach(v => {
      byFam[v.family] = byFam[v.family] || [];
      byFam[v.family].push(v);
    });
    Object.keys(byFam).forEach(fam => {
      const list = byFam[fam];
      const got = list.filter(v => seen[v.verb]).length;
      console.log('  ' + fam.padEnd(12) + got + '/' + list.length);
      list.forEach(v => {
        const mark = seen[v.verb] ? '   ok  ' : (byNature[v.verb] ? '   --  ' : '  MISS ');
        const why = seen[v.verb] ? '' : (byNature[v.verb] ? '(' + byNature[v.verb] + ')' : '');
        console.log(mark + v.verb.padEnd(22) + why);
      });
    });
    console.log('');
  }

  console.log('  reachable  ' + verbs.filter(v => seen[v.verb]).length + '/' + verbs.length +
    '   (across all situations swept, NOT in any one scene)');
  console.log('  by nature  ' + natural.length);
  console.log('  MISSING    ' + missing.length +
    (missing.length ? ': ' + missing.map(v => v.verb).join(', ') : ''));

  /* And what one ordinary scene actually offers, which is the number that
     describes a player's experience rather than the engine's coverage. */
  const quietScene = richScene();
  quietScene.combat = { active: false, round: 0, order: [], turnIndex: 0 };
  const inPeace = Object.keys(reachableVerbs(quietScene, 'pc1', ctx)).length;
  const inFight = Object.keys(reachableVerbs(richScene(), 'pc1', ctx)).length;
  console.log('  in one scene: ' + inFight + ' mid-fight, ' + inPeace + ' out of combat');

  return missing.length;
}

const n = main();
if (process.argv.includes('--strict') && n > 0) process.exit(1);
