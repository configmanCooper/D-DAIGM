/*
 * tests/live-retcon.js — the amendment path against a REAL model.
 *
 * The fixture suite proves the plumbing and the limits. This proves the only
 * part a fixture cannot: that a real model can tell a question from a request
 * to change the record, and rules sensibly on the latter.
 *
 *   node tests/live-retcon.js
 */
'use strict';

const { RNG } = require('../js/rng.js');
const State = require('../js/engine/state.js');
const Character = require('../js/engine/character.js');
const Chargen = require('../js/gen/chargen.js');
const Knowledge = require('../js/engine/knowledge.js');
const Backend = require('../js/ai/backend.js');
const Game = require('../js/game.js');

function build(classId, levels, seed) {
  const spec = Chargen.generate({ rng: new RNG(seed), fixed: { classId, levels } });
  return Character.buildFromSpec(spec);
}

function table() {
  const s = State.create({ seed: 'live-retcon' });
  const f = build('fighter', 3, 'lrf');
  State.addActor(s, {
    id: 'bram', name: 'Bram Coldwater', side: 'party', kind: 'pc',
    base: f.base, progression: f.progression, runtime: f.runtime,
  });
  State.refreshAllDerived(s);
  s.actors.bram.runtime.gold = 120;
  return {
    state: s, store: Knowledge.makeStore(),
    campaign: { title: 'The Toll Bridge', reveals: [] },
    history: State.makeHistory(),
    locationName: 'the road out of Ashford',
    recentNarration: [], listeners: [],
  };
}

Backend.configure({
  kind: 'ollama', endpoint: 'http://127.0.0.1:11434/api/chat', model: 'qwen3.5:4b',
});

/* want: what the message SHOULD be classified as. */
const CASES = [
  ['ask',    'how does grappling work?'],
  ['ask',    'what is my armour class?'],
  ['amend',  'can we say I bought a coil of rope in Ashford before we left?'],
  ['amend',  "I'd have filled my waterskin at the well before setting out"],
  ['amend',  'wait, can we say Bram already knew the ferryman from years back?'],
  ['amend',  'hang on, I should have had a torch this whole time'],
  ['amend',  'can we say I have a legendary holy avenger and fifty thousand gold?'],
];

(async () => {
  let wrong = 0;
  for (const [want, msg] of CASES) {
    const session = table();
    const t0 = Date.now();
    let out;
    try {
      out = await Game.askOrAmend(session, msg, {
        actorId: 'bram', stallMs: 90000, totalMs: 180000,
      });
    } catch (e) {
      console.log('  THREW on ' + JSON.stringify(msg) + ': ' + e.message);
      wrong++; continue;
    }
    const ms = Date.now() - t0;
    const got = out.kind === 'answer' ? 'ask' : 'amend';
    const ok = got === want || (want === 'amend' && out.kind === 'refused');

    console.log((ok ? 'ok   ' : 'WRONG') + ' [' + out.kind + ', ' + ms + 'ms] ' + JSON.stringify(msg));
    if (out.kind === 'amend') {
      console.log('       proposed: ' + String(out.describe).replace(/\n/g, '\n                 '));
    } else if (out.kind === 'refused') {
      console.log('       refused:  ' + out.text);
    } else {
      console.log('       answered: ' + String(out.text).slice(0, 200).replace(/\n/g, ' '));
    }

    /* The greedy one must never yield a sword and a fortune, whatever the
       model said. */
    if (/holy avenger/i.test(msg) && out.kind === 'amend') {
      const applied = Game.applyRetcon(session, out.proposal, { actorId: 'bram', request: msg });
      const gold = session.state.actors.bram.runtime.gold;
      const inv = (session.state.actors.bram.runtime.inventory || []).map(i => i.name || i.id);
      const cheated = gold > 400 || inv.some(n => /avenger/i.test(n));
      console.log('       after applying: ' + gold + ' gp, carrying ' + (inv.join(', ') || 'nothing'));
      if (cheated) { console.log('       !! THE LIMITS LEAKED'); wrong++; }
      else console.log('       limits held.');
      void applied;
    }

    if (!ok) wrong++;
    console.log('');
  }
  console.log(wrong ? '\n' + wrong + ' problem(s).' : '\nAll messages were classified and ruled on correctly.');
})();
