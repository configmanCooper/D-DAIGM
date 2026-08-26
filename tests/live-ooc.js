/*
 * tests/live-ooc.js — ask the REAL model real questions.
 *
 * Not part of `npm test`: it needs a model running. The fixture suite proves
 * the plumbing; this proves the answers are worth reading, which is the only
 * thing the player actually experiences.
 *
 *   node tests/live-ooc.js
 */
'use strict';

const { RNG } = require('../js/rng.js');
const State = require('../js/engine/state.js');
const Character = require('../js/engine/character.js');
const Chargen = require('../js/gen/chargen.js');
const Knowledge = require('../js/engine/knowledge.js');
const Backend = require('../js/ai/backend.js');
const Game = require('../js/game.js');

if (typeof fetch === 'undefined') { console.error('needs node 18+'); process.exit(1); }

function build(classId, levels, seed) {
  const spec = Chargen.generate({ rng: new RNG(seed), fixed: { classId, levels } });
  return Character.buildFromSpec(spec);
}

const s = State.create({ seed: 'live-ooc' });
const w = build('wizard', 5, 'lw');
State.addActor(s, {
  id: 'vera', name: 'Vera Ashlock', side: 'party', kind: 'pc',
  base: w.base, progression: w.progression, runtime: w.runtime,
});
State.addActor(s, {
  id: 'ogre', name: 'Ogre', side: 'enemy', kind: 'monster',
  base: { abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 } },
  runtime: { hp: 59, hpMax: 59, ac: 11, speed: 40, pos: { x: 2, y: 0 }, inventory: [] },
});
State.refreshAllDerived(s);

const session = {
  state: s, store: Knowledge.makeStore(),
  campaign: { title: 'The Toll Bridge', reveals: [] },
  locationName: 'the Ashford toll bridge',
  recentNarration: [], listeners: [],
};

Backend.configure({
  kind: 'ollama',
  endpoint: 'http://127.0.0.1:11434/api/chat',
  model: 'qwen3.5:4b',
});

const QUESTIONS = [
  ['a core rule',        'how does grappling actually work?'],
  ['a rule about me',    'what is my armour class and how did I get it?'],
  ['my resources',       'how many spell slots do I have left?'],
  ['my options',         'what can I actually do right now?'],
  ['concentration',      'if I take damage while concentrating, what happens?'],
  ['death saves',        'what happens when I drop to 0 hit points?'],
  ['the program itself', 'how do I save my game and get the file onto another computer?'],
  ['out of knowledge',   'what is the ogre\u2019s exact hit point total?'],
];

const derived = s.actors.vera.derivedCache;
console.log('\nVera Ashlock — AC ' + derived.ac + ', HP ' + s.actors.vera.runtime.hp +
  '/' + derived.hpMax + ', save DC ' + derived.spellcasting.dc +
  ', slots ' + JSON.stringify(derived.spellcasting.slotsRemaining) + '\n');

(async () => {
  let bad = 0;
  for (const [kind, q] of QUESTIONS) {
    const t0 = Date.now();
    let res;
    try {
      res = await Game.askDm(session, q, { actorId: 'vera', stallMs: 60000, totalMs: 180000 });
    } catch (e) {
      console.log('  [' + kind + '] THREW: ' + e.message); bad++; continue;
    }
    const ms = Date.now() - t0;
    console.log('Q (' + kind + '): ' + q);
    console.log('A [' + res.source + ', ' + ms + 'ms]: ' + res.text.replace(/\n/g, '\n   '));

    /* The two failures that would make the feature useless. */
    if (res.source !== 'ollama') { console.log('   !! not the model'); bad++; }
    if (/\bthe (?:air|light|wind|smoke|mist|sound)\b/i.test(res.text.slice(0, 90))) {
      console.log('   !! opened with scene-setting instead of the answer'); bad++;
    }
    console.log('');
  }
  console.log(bad ? '\n' + bad + ' problem(s) above.' : '\nAll answers came from the model and led with the answer.');
})();
