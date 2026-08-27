'use strict';
/*
 * tests/sample-openings.js — write out real generated openings for review.
 *
 *   node tests/sample-openings.js [count]
 *
 * Not a test. Produces the artefact a Dungeon Master reads to judge whether
 * these are starts worth sitting down to.
 */
const fs = require('fs');
const path = require('path');
const { RNG } = require('../js/rng.js');
const State = require('../js/engine/state.js');
const Knowledge = require('../js/engine/knowledge.js');
const Character = require('../js/engine/character.js');
const Chargen = require('../js/gen/chargen.js');
const Worldgen = require('../js/gen/worldgen.js');
const Backend = require('../js/ai/backend.js');
const Narrator = require('../js/ai/narrator.js');

Backend.configure({ kind: 'ollama', endpoint: 'http://127.0.0.1:11434/api/chat', model: 'qwen3.5:4b' });

const COUNT = parseInt(process.argv[2], 10) || 10;
/* A spread of player characters, because the whole point is that the opening
   should belong to whoever is playing. */
const PLAYERS = [
  { classId: 'wizard', levels: 3 }, { classId: 'barbarian', levels: 3 },
  { classId: 'rogue', levels: 3 }, { classId: 'cleric', levels: 3 },
  { classId: 'paladin', levels: 3 }, { classId: 'druid', levels: 3 },
  { classId: 'bard', levels: 3 }, { classId: 'ranger', levels: 3 },
  { classId: 'warlock', levels: 3 }, { classId: 'monk', levels: 3 },
];

(async () => {
  const out = ['# Generated openings\n',
    'Each is a fresh one-player game: the seated character, the three companions ',
    'the Dungeon Master supplied to make a party of four, the bond between them, ',
    'and the opening the Dungeon Master actually wrote.\n'];

  for (let i = 0; i < COUNT; i++) {
    const spec = PLAYERS[i % PLAYERS.length];
    const s = State.create({ seed: 'sample' + i });
    const built = Character.buildFromSpec(Chargen.generate({ rng: new RNG('pc' + i), fixed: spec }));
    State.addActor(s, {
      id: 'pc1', name: built.base.name || 'The player', side: 'party', kind: 'pc',
      base: built.base, progression: built.progression, runtime: built.runtime,
    });
    State.addSeat(s, { id: 'seat', name: 'Player', actorId: 'pc1', control: 'human' });
    State.refreshAllDerived(s);

    const o = Worldgen.generateOpening(s, { rng: new RNG('open' + i) });
    const store = Knowledge.makeStore();

    const party = State.partyIds(s).map(id => {
      const a = s.actors[id];
      const d = a.derivedCache || {};
      return a.name + ' (' + ((a.base.classes || [{}])[0] || {}).classId +
        ' ' + (d.level || 1) + (id === 'pc1' ? ', the player' : '') + ')';
    });

    let prose = '(no model)';
    try {
      const res = await Narrator.opening(s, store, o.campaign, {
        locationName: o.scene.name,
        timeOfDay: o.scene.timeOfDay,
        weather: o.scene.weather,
        bond: o.bond,
        opens: o.opens,
        local: o.local,
      });
      prose = res.text + '\n\n*(' + res.source + ')*';
    } catch (e) { prose = 'FAILED: ' + e.message; }

    out.push('\n---\n');
    out.push('## ' + (i + 1) + '. ' + o.scene.name + '\n');
    out.push('- **player**: ' + spec.classId +
      ' / ' + (built.base.backgroundId || '?') + ' / ' + (built.base.subraceId || built.base.raceId));
    out.push('- **kind**: ' + o.scene.kind + '  ·  **opens**: ' + o.opens +
      '  ·  **enemies present**: ' + State.livingEnemies(s).length);
    out.push('- **party**: ' + party.join(', '));
    out.push('- **bond**: ' + o.bond.id + ' — ' + o.bond.short +
      (o.bond.strangers ? '  *(strangers)*' : ''));
    out.push('- **hook**: ' + o.scene.hook);
    if (o.scene.outs) out.push('- **ways out without a fight**: ' + o.scene.outs.length);
    out.push('\n' + prose + '\n');
    console.log((i + 1) + '/' + COUNT + '  ' + o.scene.id + '  (' + o.opens + ')');
  }

  const file = path.join(__dirname, '..', 'exports', 'sample-openings.md');
  fs.writeFileSync(file, out.join('\n'), 'utf8');
  console.log('\nwrote ' + file);
})();
