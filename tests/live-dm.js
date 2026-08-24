/*
 * tests/live-dm.js — a live battery against a real local model.
 *
 * Not part of `npm test`: it needs Ollama actually running and it costs real
 * seconds. It answers the question the offline suite structurally cannot —
 * does a 1.7B-to-4B model, given our schemas and our prompts, actually produce
 * usable output often enough to run a game?
 *
 * It measures rather than asserts pass/fail on prose, because prose is not
 * deterministic. Thresholds are deliberately generous: the deterministic
 * fallback exists precisely so that a model failing sometimes is survivable.
 *
 *   node tests/live-dm.js [model] [rounds]
 */
'use strict';

const { RNG } = require('../js/rng.js');
const Command = require('../js/engine/command.js');
const Events = require('../js/engine/events.js');
const Knowledge = require('../js/engine/knowledge.js');
const State = require('../js/engine/state.js');
const Backend = require('../js/ai/backend.js');
const Schema = require('../js/ai/schema.js');
const Referee = require('../js/ai/referee.js');
const Prompt = require('../js/ai/prompt.js');
const Narrator = require('../js/ai/narrator.js');

const MODEL = process.argv[2] || 'qwen3:1.7b';
const ROUNDS = parseInt(process.argv[3] || '1', 10);
const PORT = process.env.PORT || 8177;
const BASE = 'http://127.0.0.1:' + PORT;

/* The client normally talks to our own server, which proxies to Ollama. Here
   there is no page, so point the backend at the server's absolute URL. */
Backend.configure({ kind: 'ollama', model: MODEL, endpoint: BASE + '/api/chat' });

function actorFixture(id, name, side, hp, extra) {
  return Object.assign({
    id, name, side,
    base: { name, abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 16 } },
    progression: { xp: 0, levels: [] },
    runtime: {
      hp, hpMax: hp, tempHp: 0, conditions: {}, exhaustion: 0, concentratingOn: null,
      attuned: [], equipped: {}, inventory: [], deathSaves: { successes: 0, failures: 0 },
      gold: 12, pos: { x: 0, y: 0 }, resources: {},
    },
  }, extra || {});
}

function buildScene() {
  const state = State.create({ seed: 'live-fen', campaignId: 'shen-cooper' });
  State.addActor(state, actorFixture('shen', 'Shen Cooper', 'party', 28));
  State.addActor(state, actorFixture('aldren', 'Sir Aldren Vey', 'party', 46));
  State.addActor(state, actorFixture('mara', 'Dame Mara Thorne', 'party', 38));
  State.addActor(state, actorFixture('lysa', 'Lysa Sells', 'neutral', 6));
  State.addActor(state, actorFixture('fenlight', 'the fen-light', 'enemy', 33));
  State.addSeat(state, { id: 'p1', name: 'You', actorId: 'shen', control: 'human' });
  state.locationId = 'lanterns-rest';

  const store = Knowledge.makeStore();
  Knowledge.defineFacts(store, [{
    id: 'hollow.king',
    claim: 'The Hollow King is the corrupted remnant of a king who tried to abolish loss.',
    partial: 'Something old and deliberate is behind the failing seals.',
    hint: 'The rot in the fen is not natural.',
    forbiddenUntilKnown: ['Hollow King', 'Aerath Vhal'],
    revealWhen: () => false,
  }]);
  store.known = state.knowledge;
  return { state, store };
}

const CAMPAIGN = {
  title: 'The Divided Steel',
  premise: 'Four ancient seals hold something old in place. One has already failed.',
  tone: 'grim, close, quiet. Rural and damp rather than gothic.',
  openCanon: ['Dunmere is a smithing town.', 'The Glass Fen floods every spring.'],
  hardRules: ['The Warden is not a god.'],
};

/* Things a player would plausibly type, chosen to stress different families
   and to include the awkward ones: compound, improvised and ambiguous. */
const INPUTS = [
  { text: 'I attack the fen-light with my sword', expect: { family: 'combat', verb: 'attack', target: 'fenlight' } },
  { text: 'I try to shove it back into the water', expect: { family: 'combat', verb: 'shove', target: 'fenlight' } },
  { text: 'I cast bless on Aldren and Mara', expect: { family: 'spell', verb: 'cast', spell: 'bless' } },
  { text: 'I kneel down and ask Lysa what she saw last night', expect: { family: 'social', target: 'lysa' } },
  { text: 'I search the lantern housing for anything that does not belong', expect: { family: 'exploration' } },
  { text: 'I drink the potion of healing', expect: { family: 'item', item: 'potion-healing' } },
  { text: 'I want to cut the mooring rope so the punt drifts between us and the thing', expect: { family: 'improvised' } },
  { text: 'I put myself between Lysa and the water', expect: { family: null } },
  { text: 'I step back and ready my shield in case it comes at Mara', expect: { family: null } },
  { text: 'I end my turn', expect: { family: 'meta', verb: 'end_turn' } },
];

async function main() {
  console.log('\n=== live DM battery ===');
  console.log('model: ' + MODEL + '   rounds: ' + ROUNDS + '   server: ' + BASE + '\n');

  try {
    const r = await fetch(BASE + '/api/status');
    const s = await r.json();
    if (!s.ollama) {
      console.log('Ollama is not up. Start the game first:  .\\start.cmd -NoBrowser');
      process.exit(2);
    }
    console.log('server reports: ' + (s.loaded || 'nothing') + ' loaded, ' +
      (s.measured ? s.measured.tokPerSec + ' tok/s' : 'speed unknown'));
    if (s.hint) console.log('hint: ' + s.hint);
    console.log('');
  } catch (e) {
    console.log('Could not reach the server at ' + BASE + '. Start it first:  .\\start.cmd -NoBrowser');
    process.exit(2);
  }

  const { state, store } = buildScene();
  const observation = Knowledge.getObservation(state, store, 'shen', {});
  const options = Schema.optionsFrom(observation, {
    spellcasting: { available: ['bless', 'shield-of-faith', 'command', 'compelled-duel'], highestSlot: 1 },
    inventory: [{ uid: 'potion-healing', id: 'potion-healing' }],
  });

  /* --------------------------------------------------------------- referee */
  console.log('--- referee: free text to a structured command ---\n');
  let parsed = 0, viaModel = 0, viaFallback = 0, correct = 0, checked = 0;
  const latencies = [];

  for (let round = 0; round < ROUNDS; round++) {
    for (const input of INPUTS) {
      const t0 = Date.now();
      const res = await Referee.parse(input.text, observation, options, {
        actorId: 'shen', actorName: 'Shen Cooper',
        sessionId: state.sessionId, stateRevision: state.revision, turnEpoch: state.turnEpoch,
        inCombat: true,
      });
      const ms = Date.now() - t0;
      latencies.push(ms);
      parsed++;
      if (res.method === 'model') viaModel++; else viaFallback++;

      const cmd = res.command;
      const step = cmd.primary || {};
      const structural = Command.validateStructure(cmd);

      let verdict = '';
      if (input.expect.family) {
        checked++;
        const okFamily = cmd.family === input.expect.family || cmd.needsClarification;
        const okVerb = !input.expect.verb || step.verb === input.expect.verb;
        const okTarget = !input.expect.target || (step.targetIds || []).indexOf(input.expect.target) >= 0;
        const okSpell = !input.expect.spell || step.spellId === input.expect.spell;
        const okItem = !input.expect.item || step.itemId === input.expect.item;
        const all = okFamily && okVerb && okTarget && okSpell && okItem;
        if (all) correct++;
        verdict = all ? 'ok  ' : 'MISS';
      } else {
        verdict = '    ';
      }

      console.log('  ' + verdict + ' [' + String(ms).padStart(5) + 'ms ' + res.method.padEnd(13) + '] ' +
        '"' + input.text.slice(0, 46) + (input.text.length > 46 ? '..' : '') + '"');
      console.log('         -> ' + cmd.family + ': ' + Command.describe(cmd) +
        (structural.ok ? '' : '   [INVALID: ' + structural.errors.join('; ') + ']'));
    }
  }

  latencies.sort((a, b) => a - b);
  const median = latencies[Math.floor(latencies.length / 2)];
  console.log('\n  parses: ' + parsed + '   via model: ' + viaModel + '   via fallback: ' + viaFallback);
  console.log('  accuracy on checked cases: ' + correct + '/' + checked +
    ' (' + Math.round(100 * correct / Math.max(1, checked)) + '%)');
  console.log('  median referee latency: ' + median + 'ms');

  /* -------------------------------------------------------------- narrator */
  console.log('\n--- narrator: prose over a committed batch ---\n');

  const scenarios = [
    {
      label: 'a hit in combat',
      beats: ['Shen attacks the fen-light: rolled 18 vs AC 14 — hit.', 'The fen-light takes 9 slashing damage and is bloodied.'],
      action: 'Shen swings at the shape rising out of the reeds.',
    },
    {
      label: 'a failed search',
      beats: ['Shen rolls Investigation 8 vs DC 15 — failure.', 'Nothing is found in the lantern housing.'],
      action: 'Shen searches the lantern housing.',
    },
    {
      label: 'a quiet social beat',
      beats: ['Shen rolls Persuasion 16 vs DC 12 — success.', 'Lysa agrees to say what she saw.'],
      action: 'Shen kneels and asks Lysa what she saw last night.',
    },
  ];

  let clean = 0, gated = 0, fellBack = 0;
  const issueCounts = {};
  const narrationMs = [];
  const produced = [];

  for (let round = 0; round < ROUNDS; round++) {
    for (const sc of scenarios) {
      const batch = Events.makeBatch({ commandId: 'live_' + Math.random().toString(36).slice(2), actorId: 'shen' });
      batch.beats = sc.beats;
      const t0 = Date.now();
      const res = await Narrator.narrate(state, store, CAMPAIGN, batch, {
        locationName: "Lantern's Rest, on the Glass Fen",
        timeOfDay: 'dusk', weather: 'fog',
        playerAction: sc.action,
        party: [{ name: 'Sir Aldren Vey' }, { name: 'Dame Mara Thorne' }],
        recent: produced.slice(-3),
        partyId: 'shen',
      });
      const ms = Date.now() - t0;
      narrationMs.push(ms);

      if (res.source === 'offline') fellBack++;
      else if (res.report && res.report.issues && res.report.issues.length) gated++;
      else clean++;
      (res.report && res.report.issues || []).forEach(i => { issueCounts[i] = (issueCounts[i] || 0) + 1; });
      produced.push(res.text);

      console.log('  [' + String(ms).padStart(6) + 'ms ' + String(res.source).padEnd(8) + '] ' + sc.label +
        (res.report && res.report.issues && res.report.issues.length
          ? '   gates: ' + res.report.issues.join(', ') : ''));
      console.log('    ' + res.text.replace(/\n+/g, '\n    '));
      console.log('');

      /* The leak canary. This is the check that matters most: the secret was
         never in the prompt, so it must never be in the output. */
      const leaks = Knowledge.auditLeaks(store, 'shen', res.text);
      if (leaks.length) {
        console.log('    *** LEAK: ' + leaks.map(l => l.term).join(', ') + ' ***');
      }
    }
  }

  narrationMs.sort((a, b) => a - b);
  console.log('  clean: ' + clean + '   gated-but-usable: ' + gated + '   fell back to offline: ' + fellBack);
  if (Object.keys(issueCounts).length) {
    console.log('  gate hits: ' + Object.keys(issueCounts).map(k => k + ' x' + issueCounts[k]).join(', '));
  }
  console.log('  median narration latency: ' + narrationMs[Math.floor(narrationMs.length / 2)] + 'ms');

  /* ---------------------------------------------------------------- verdict */
  console.log('\n--- verdict ---');
  const accuracy = correct / Math.max(1, checked);
  const usable = (clean + gated) / Math.max(1, clean + gated + fellBack);
  const notes = [];
  if (accuracy < 0.6) notes.push('referee accuracy is low; the deterministic parser is carrying this model');
  if (usable < 0.7) notes.push('narration falls back often; consider a larger model');
  if (median > 8000) notes.push('referee latency is high; the GPU may be contended');
  console.log('  referee accuracy      ' + Math.round(accuracy * 100) + '%');
  console.log('  narration usable      ' + Math.round(usable * 100) + '%');
  notes.forEach(n => console.log('  note: ' + n));
  console.log('\n  ' + (accuracy >= 0.5 && usable >= 0.6
    ? 'This model can run a game.'
    : 'This model is weak here, but the game is still playable via the fallbacks.'));
  console.log('');
}

main().catch(e => { console.error(e); process.exit(1); });
