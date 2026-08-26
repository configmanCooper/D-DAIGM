/*
 * tests/ai.test.js — the referee, the prompt builder and the narrator gates.
 *
 * The gate tests matter most. Every one of them corresponds to something a
 * small model does in practice: writing dialogue for the player's character,
 * naming a villain who has not been introduced, breaking character to offer
 * help, and opening four turns running with the same three words.
 */
'use strict';
const t = require('./_harness')('ai');
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
const Offline = require('../js/ai/offline.js');

function actorFixture(id, name, side, hp) {
  return {
    id, name, side,
    base: { name, abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 13, cha: 12 } },
    progression: { xp: 900, levels: [] },
    runtime: {
      hp, hpMax: hp, tempHp: 0, conditions: {}, exhaustion: 0, concentratingOn: null,
      attuned: [], equipped: {}, inventory: [], deathSaves: { successes: 0, failures: 0 },
      gold: 12, pos: { x: 0, y: 0 }, resources: {},
    },
  };
}

function scene() {
  const s = State.create({ seed: 'fen', campaignId: 'shen' });
  State.addActor(s, actorFixture('shen', 'Shen Cooper', 'party', 27));
  State.addActor(s, actorFixture('aldren', 'Sir Aldren Vey', 'party', 24));
  State.addActor(s, actorFixture('lysa', 'Lysa Sells', 'neutral', 9));
  State.addActor(s, actorFixture('gateborn', 'Gate-Born', 'enemy', 40));
  State.addSeat(s, { id: 'p1', name: 'Player One', actorId: 'shen', control: 'human' });
  s.locationId = 'glass-fen';
  return s;
}

function storeWithSecret() {
  const store = Knowledge.makeStore();
  Knowledge.defineFacts(store, [{
    id: 'hollow.king', topic: 'plot',
    claim: 'The Hollow King is the corrupted remnant of a king who tried to abolish loss.',
    partial: 'Something old and deliberate is behind the failing seals.',
    hint: 'The rot in the fen is not natural.',
    forbiddenUntilKnown: ['Hollow King', 'Aerath Vhal'],
    revealWhen: st => !!(st.flags && st.flags.enteredMirrorAbbey),
  }]);
  return store;
}

/* --------------------------------------------------------------- backend -- */
t.section('backend');
t.eq(Backend.NUM_CTX, 8192, 'the context size is pinned');
t.ok(Backend.PROFILES.referee.stream === false, 'the referee call is never streamed');
t.ok(Backend.PROFILES.narrator.stream === true, 'narration is streamed');
t.ok(Backend.PROFILES.referee.temperature < 0.3, 'the referee runs cold');
t.ok(Backend.PROFILES.narrator.temperature <= 0.75,
  'the narrator runs at 0.7 or below — higher derails small models');
t.ok(Backend.PROFILES.narrator.repeat_penalty > 1,
  'the narrator has a repeat penalty');
t.eq(!!Backend.PROFILES.narrator.think, false, 'thinking is off for streamed narration');
t.eq(!!Backend.PROFILES.summary.think, true, 'thinking is on for summarisation');

t.section('backend: prose cleaning');
t.eq(Backend.cleanProse('<think>let me consider</think>The door gives.'), 'The door gives.',
  'reasoning traces are stripped');
t.eq(Backend.cleanProse('Certainly! The door gives.'), 'The door gives.',
  'assistant scaffolding is stripped');
t.eq(Backend.cleanProse('DM: The door gives.'), 'The door gives.',
  'a speaker label is stripped');
t.eq(Backend.cleanProse('The door gives. *he shivers*'), 'The door gives.',
  'asterisk emotes are stripped');
t.eq(Backend.cleanProse('[STAGE DIRECTION - be tense]\nThe door gives.'), 'The door gives.',
  'an echoed stage direction is stripped');
t.eq(Backend.cleanProse('The door gives.\n\nWhat would you like to do next?'), 'The door gives.',
  'a trailing prompt for input is stripped');
t.eq(Backend.cleanProse('```\nThe door gives.\n```'), 'The door gives.',
  'a code fence is stripped');
t.eq(Backend.trimToSentence('The door gives. Beyond it the water is bl'), 'The door gives.',
  'a cut-off sentence is trimmed away');

/* ---------------------------------------------------------------- schema -- */
t.section('schema: enums are built from the observation');
const g = scene();
const store = storeWithSecret();
let obs = Knowledge.getObservation(g, store, 'shen', {});
let options = Schema.optionsFrom(obs, { spellcasting: { available: ['bless', 'cure-wounds'], highestSlot: 1 }, inventory: [{ uid: 'i1', id: 'potion-healing' }] });

t.ok(options.targetIds.indexOf('gateborn') >= 0, 'a visible enemy is targetable');
t.deep(options.spellIds, ['bless', 'cure-wounds'], 'only prepared spells are offered');
t.deep(options.itemIds, ['i1'], 'only carried items are offered');

let sch = Schema.refereeSchema('spell', options);
t.ok(sch.properties.primary.properties.spell.enum.indexOf('bless') >= 0,
  'the spell enum contains a known spell');
t.ok(sch.properties.primary.properties.spell.enum.indexOf('fireball') < 0,
  'and cannot contain a spell the character does not have');
t.ok(sch.properties.primary.properties.spell.enum.indexOf('') >= 0,
  'every id enum includes an explicit empty option');
t.eq(sch.properties.primary.properties.slotLevel.maximum, 1,
  'the slot level is capped at what the caster actually has');

g.actors.gateborn.runtime.hiddenFrom = { shen: true };
obs = Knowledge.getObservation(g, store, 'shen', {});
options = Schema.optionsFrom(obs, {});
sch = Schema.refereeSchema('combat', options);
t.eq(sch.properties.primary.properties.target.enum.indexOf('gateborn'), -1,
  'a hidden creature is UNREPRESENTABLE in the target enum, not merely forbidden');
delete g.actors.gateborn.runtime.hiddenFrom;

t.section('schema: semantic validation catches legal-but-wrong');
obs = Knowledge.getObservation(g, store, 'shen', {});
options = Schema.optionsFrom(obs, { spellcasting: { available: ['bless'], highestSlot: 1 } });
t.deep(Schema.validateSemantics({ primary: { verb: 'cast', spell: 'meteor-swarm' }, needsClarification: false }, 'spell', options),
  ['spell "meteor-swarm" is not available to this character'],
  'a spell the character lacks is rejected');
t.deep(Schema.validateSemantics({ primary: { verb: 'attack', target: 'dragon-of-nowhere' }, needsClarification: false }, 'combat', options),
  ['target "dragon-of-nowhere" is not perceivable'],
  'an unperceivable target is rejected');
t.deep(Schema.validateSemantics({ primary: { verb: 'attack', target: '' }, needsClarification: false }, 'combat', options),
  ['attack with no target chosen'], 'an empty attack target is rejected');
t.eq(Schema.validateSemantics({ primary: { verb: 'attack', target: 'gateborn' }, needsClarification: false }, 'combat', options).length,
  0, 'a legal attack passes');
t.deep(Schema.validateSemantics({ needsClarification: true, clarificationQuestion: '' }, 'combat', options),
  ['asked to clarify but gave no question'], 'an empty clarification is rejected');

t.section('schema: the referee is never asked for a DC or narration');
const flat = JSON.stringify(Schema.refereeSchema('combat', options));
t.eq(/narration|prose|describe|"dc"/i.test(flat), false,
  'the referee schema contains no narration or raw DC field');
t.ok(/suggestedDifficulty/.test(flat), 'it may only suggest a difficulty BAND');
t.deep(Schema.refereeSchema('combat', options).properties.primary.properties.suggestedDifficulty.enum.slice(0, 6),
  Schema.BANDS, 'and the band is one of the six named ones');

/* -------------------------------------------------- deterministic referee -- */
t.section('referee: the deterministic parser needs no model');
Backend.configure({ kind: 'offline' });
obs = Knowledge.getObservation(g, store, 'shen', {});
options = Schema.optionsFrom(obs, {
  spellcasting: { available: ['bless', 'cure-wounds'], highestSlot: 1 },
  inventory: [{ uid: 'potion-healing', id: 'potion-healing' }],
});

function parseDet(text) {
  return Referee.parseDeterministic(text, obs, options, { actorId: 'shen', sessionId: g.sessionId });
}

let p = parseDet('I attack the Gate-Born with my sword');
t.eq(p.command.family, 'combat', 'an attack is recognised');
t.eq(p.command.primary.verb, 'attack', 'with the attack verb');
t.deep(p.command.primary.targetIds, ['gateborn'], 'and the right target');

p = parseDet('I try to shove it into the water');
t.eq(p.command.primary.verb, 'shove', 'a shove is recognised');
t.deep(p.command.primary.targetIds, ['gateborn'], 'and "it" resolves to the only enemy present');

p = parseDet('I grapple the thing');
t.eq(p.command.primary.verb, 'grapple', 'a grapple is recognised, not turned into an attack');

p = parseDet('I cast bless on Aldren');
t.eq(p.command.family, 'spell', 'a spell is recognised');
t.eq(p.command.primary.spellId, 'bless', 'the spell is identified');
t.deep(p.command.primary.targetIds, ['aldren'], 'and the ally target found by first name');

p = parseDet('I cast fireball');
t.eq(p.command.family, 'improvised',
  'casting a spell the character does not have becomes improvised, never a wrong spell');

p = parseDet('I drink the potion of healing');
t.eq(p.command.family, 'item', 'drinking is recognised');
t.eq(p.command.primary.itemId, 'potion-healing', 'and the item identified');

p = parseDet('I ask Lysa about the abbey');
t.eq(p.command.family, 'social', 'asking is social');
t.deep(p.command.primary.targetIds, ['lysa'], 'with the right person');
t.eq(p.command.primary.social.truthfulness, 'true', 'and truthful by default');

p = parseDet('I lie to Lysa and say we are pilgrims');
t.eq(p.command.primary.social.truthfulness, 'false', 'a lie is marked as a lie');
t.eq(p.command.primary.social.approach, 'deceptive', 'and the approach is deceptive');

p = parseDet('I threaten her until she talks');
t.eq(p.command.primary.social.approach, 'threatening', 'a threat is marked as threatening');

p = parseDet('I search the altar');
t.eq(p.command.family, 'exploration', 'searching is exploration');
t.eq(p.command.primary.verb, 'search', 'with the search verb');

p = parseDet('I want to cut the rope so the lantern falls into the water');
t.eq(p.command.family, 'improvised', 'an unanticipated action becomes improvised');
t.ok(p.command.primary.improvised.desiredOutcome.length > 10,
  'and carries the player\u2019s own words forward');

p = parseDet('I attack');
t.eq(p.command.needsClarification, true,
  'an attack with nobody named asks who, rather than picking at random');
t.ok(/who/i.test(p.command.clarificationQuestion), 'and the question says so');

p = parseDet('I end my turn');
t.eq(p.command.primary.verb, 'end_turn', 'ending a turn is meta');

p = parseDet('we take a long rest');
t.eq(p.command.primary.verb, 'long_rest', 'a long rest is recognised');

t.ok(parseDet('I attack the Gate-Born').command.utterance.length > 0,
  'the original wording is always preserved');
t.ok(Command.validateStructure(parseDet('I attack the Gate-Born').command).ok,
  'every deterministic parse produces a structurally valid command');

t.section('referee: confident patterns never reach a model');
t.ok(parseDet('I attack the Gate-Born with my sword').confidence >= 0.7,
  'a clean pattern match with a resolved target is high confidence');
t.ok(parseDet('I want to cut the rope so the lantern falls').confidence < 0.7,
  'an improvised action is low confidence and is worth a model');
t.ok(parseDet('I attack').confidence < 0.7, 'an unresolved target lowers confidence');
t.ok(parseDet('I cast fireball').confidence < 0.7,
  'a spell that could not be identified lowers confidence');
t.ok(parseDet('I drink the potion and then attack the Gate-Born').confidence < 0.7,
  'a compound action lowers confidence, because the pattern table cannot express it');

Backend.configure({ kind: 'offline' });
return Referee.parse('I attack the Gate-Born', obs, options, { actorId: 'shen' })
  .then(res => {
    t.eq(res.method, 'deterministic', 'a confident parse is deterministic');
    t.eq(res.fellBackBecause, undefined,
      'and is not a fallback \u2014 it is simply the right answer, reached instantly');
    return Referee.parse('I want to wedge the punt against the causeway', obs, options, { actorId: 'shen' });
  })
  .then(res => {
    t.eq(res.method, 'deterministic', 'with no backend even a low-confidence parse stays deterministic');
    t.ok(!!res.fellBackBecause, 'but it records that it wanted a model and could not have one');
    return runFixtureBackend();
  })
  .then(runGateTests)
  .then(runPromptTests)
  .then(runOfflineTests)
  .then(runStreamSafetyTests)
  .then(runSeatSpeechTests)
  .then(runCasterPolicyTests)
  .then(() => t.done())
  .catch(err => { console.error(err); process.exit(1); });

/* ------------------------------------------------ a caster should cast -- */
/**
 * The fallback policy — the one that runs every companion and every seat with
 * no model behind it — went straight for `attack`. A wizard companion
 * therefore spent every fight poking with a quarterstaff while holding Magic
 * Missile, and a cleric never healed anybody who was merely wounded. Across a
 * four-hundred-turn playthrough this produced one spell cast and not a single
 * spell slot spent: the whole magic system, present and unplayed.
 */
function runCasterPolicyTests() {
  const State = require('../js/engine/state.js');
  const Character = require('../js/engine/character.js');
  const Knowledge = require('../js/engine/knowledge.js');
  const Dispatch = require('../js/engine/dispatch.js');
  require('../js/engine/interaction.js');
  require('../js/engine/combat.js');
  const PlayerAgent = require('../js/ai/player_agent.js');
  const MONSTERS = require('../js/data/srd_monsters.js').MONSTERS;

  t.section('a caster companion casts');

  function fight(classId, foeKey, foeHp) {
    const st = State.create({ seed: 'caster-' + classId });
    const c = Character.buildFromSpec({
      name: 'Caster', raceId: 'human', classId, levels: 3, backgroundId: 'sage',
      abilities: { str: 8, dex: 15, con: 13, int: 17, wis: 17, cha: 17 },
      proficiencies: { skills: [] },
    });
    c.runtime.pos = { x: 2, y: 2 };
    State.addActor(st, {
      id: 'pc1', name: 'Caster', side: 'party', kind: 'pc', role: classId,
      base: c.base, progression: c.progression, runtime: c.runtime,
    });
    const sb = MONSTERS[foeKey] || MONSTERS.goblin;
    State.addActor(st, {
      id: 'foe1', name: sb.name, side: 'enemy', kind: 'monster', statblock: sb,
      base: {
        name: sb.name, abilities: sb.abilities || {},
        proficiencies: { skills: [], saves: [] }, classes: [],
      },
      progression: { xp: 0, levels: [] },
      runtime: {
        hp: foeHp, hpMax: sb.hp || foeHp, tempHp: 0, conditions: {}, exhaustion: 0,
        concentratingOn: null, attuned: [], equipped: {}, inventory: [],
        deathSaves: { successes: 0, failures: 0 }, resources: {}, gold: 0,
        pos: { x: 4, y: 2 },
      },
    });
    State.addSeat(st, { id: 'p1', name: 'P', actorId: 'pc1', control: 'human' });
    State.refreshAllDerived(st);
    st.combat = { active: true, round: 1, turnIndex: 0, order: [{ id: 'pc1' }, { id: 'foe1' }] };
    st.activeActorId = 'pc1';
    st.actors.pc1.runtime.turn = {
      action: true, bonus: true, reaction: true, objectInteraction: true,
      movementRemaining: 30, surprised: false, mountedThisMove: false,
    };
    const store = Knowledge.makeStore();
    store.known = st.knowledge;
    return { st, store };
  }

  /* The move list must tell a chooser what kind of spell each one is, or every
     cast looks identical and the first — always a cantrip — always wins. */
  const tagged = fight('wizard', 'orc', 15);
  const casts = (Dispatch.legalMoves(tagged.st, 'pc1', {}) || [])
    .filter(m => m.step && m.step.verb === 'cast');
  t.ok(casts.length > 0, 'a wizard is offered spells', '(' + casts.length + ')');
  t.ok(casts.every(m => typeof m.spellLevel === 'number'),
    'and every spell move says what level it is');
  t.ok(casts.some(m => m.offensive), 'at least one of which can hurt somebody',
    '(' + casts.filter(m => m.offensive).map(m => m.what).join(', ') + ')');

  return PlayerAgent.takeTurn(tagged.st, { past: [], future: [] }, tagged.store, 'pc1',
    { forcePolicy: true })
    .then(turn => {
      const what = (turn.chosen && turn.chosen.move && turn.chosen.move.what) || '';
      t.ok(/^Cast /.test(what), 'a wizard facing a healthy orc casts rather than swings',
        '(' + what + ')');
      t.ok(Object.keys(tagged.st.actors.pc1.runtime.slotsSpent || {}).length > 0,
        'and spends a spell slot doing it',
        '(' + JSON.stringify(tagged.st.actors.pc1.runtime.slotsSpent) + ')');

      /* Against something nearly dead, a cantrip is the right call — no slot. */
      const easy = fight('wizard', 'goblin', 1);
      return PlayerAgent.takeTurn(easy.st, { past: [], future: [] }, easy.store, 'pc1',
        { forcePolicy: true }).then(t2 => {
        const w2 = (t2.chosen && t2.chosen.move && t2.chosen.move.what) || '';
        t.ok(w2.length > 0, 'and it still takes a turn against a dying enemy', '(' + w2 + ')');
      });
    });
}

/* ------------------------------------------------- streaming is gated -- */
/**
 * Raw model tokens used to be pushed to the screen the instant they arrived,
 * and the quality gates only saw the text afterwards — so a forbidden name was
 * displayed first and corrected second, which a reader cannot un-see. These
 * check the three ways a name can arrive: whole, one character at a time, and
 * deliberately split down the middle.
 */
function runStreamSafetyTests() {
  t.section('nothing ungated reaches the screen while a reply streams');

  const RAW = 'The figure kneels slowly in the dark and the torch gutters low. ' +
    'It is the Hollow King, and he speaks at last to the assembled dead.';

  const realAvailable = Backend.available;
  const realChat = Backend.chat;

  function withChunker(chunker) {
    Backend.available = () => true;
    Backend.chat = o => {
      chunker(RAW, o.onToken);
      return Promise.resolve({ text: RAW, kind: 'local' });
    };
    const s = State.create({ seed: 'stream-safety' });
    State.addActor(s, {
      id: 'p', name: 'Vess', side: 'party', kind: 'pc',
      base: { name: 'Vess', abilities: {}, classes: [] },
      progression: { levels: [] },
      runtime: { hp: 10, hpMax: 10, conditions: {}, inventory: [], deathSaves: {} },
    });
    const store = Knowledge.makeStore();
    Knowledge.defineFacts(store, [{
      id: 'hk', claim: 'A dead king walks.', secret: true,
      forbiddenUntilKnown: ['Hollow King'], stages: { full: 'The Hollow King stirs.' },
    }]);
    store.known = s.knowledge;
    const batch = Events.makeBatch({ commandId: 'c', actorId: 'p' });
    batch.beats.push('Vess searches the room.');

    let shown = '';
    return Narrator.narrate(s, store, { id: 't', title: 'T' }, batch, {
      onToken: piece => { shown += piece; },
      playerAction: 'search', party: [{ name: 'Vess' }], partyId: 'party',
      turnEpoch: s.turnEpoch, mode: 'dm',
    }).then(res => ({ shown, text: res.text }));
  }

  const cases = [
    ['arriving whole', (raw, cb) => cb && cb(raw)],
    ['one character at a time', (raw, cb) => { for (const c of raw) if (cb) cb(c); }],
    ['split across the name', (raw, cb) => {
      const i = raw.indexOf('Hollow King');
      if (cb) { cb(raw.slice(0, i + 6)); cb(raw.slice(i + 6)); }
    }],
  ];

  return cases.reduce((chain, [label, chunker]) => chain.then(() => withChunker(chunker).then(r => {
    t.eq(/Hollow King/.test(r.shown), false, 'a secret ' + label + ' never reaches the screen');
    t.eq(/Hollow King/.test(r.text), false, 'and is absent from the final text too');
    t.ok(r.shown.length > 40, 'while the reply still streams as it is written',
      '(' + r.shown.length + ' chars)');
  })), Promise.resolve()).then(() => {
    Backend.available = realAvailable;
    Backend.chat = realChat;
  });
}

/* ------------------------------------------------------- fixture backend -- */
function runFixtureBackend() {
  t.section('referee: a model is consulted only for what patterns cannot do');
  /* A phrasing with no pattern match, so the deterministic parser is not
     confident and the model is genuinely earning its latency. */
  const novel = 'I wedge the punt across the channel to slow whatever that is';
  Backend.configure({
    kind: 'fixture',
    fixtures: {
      'referee:PLAYER TYPED:':
        JSON.stringify({ family: 'combat', compound: false, ambiguous: false }),
      'referee:PLAYER (Shen Cooper) TYPED:':
        JSON.stringify({
          primary: { verb: 'shove', target: 'gateborn', suggestedSkill: '', suggestedDifficulty: 'medium' },
          needsClarification: false, goal: 'put it in the water',
        }),
    },
  });

  t.ok(Referee.parseDeterministic(novel, obs, options, { actorId: 'shen' }).confidence < 0.7,
    'the novel phrasing is indeed low confidence');

  return Referee.parse(novel, obs, options, {
    actorId: 'shen', actorName: 'Shen Cooper', sessionId: g.sessionId,
    stateRevision: g.revision, turnEpoch: g.turnEpoch,
  }).then(res => {
    t.eq(res.method, 'model', 'a low-confidence parse escalates to the model');
    t.eq(res.command.family, 'combat', 'the classified family is used');
    t.eq(res.command.primary.verb, 'shove', 'the verb comes through');
    t.deep(res.command.primary.targetIds, ['gateborn'], 'and the target');
    t.eq(res.command.primary.suggestion.difficulty, 'medium',
      'the suggested band survives as a hint');
    t.ok(Command.validateStructure(res.command).ok, 'and the command is valid');
  }).then(() => {
    t.section('referee: a confident pattern is not overridden by a model');
    let called = 0;
    const realChat = Backend.chat;
    Backend.chat = function () { called++; return realChat.apply(null, arguments); };
    return Referee.parse('I attack the Gate-Born with my sword', obs, options, {
      actorId: 'shen', actorName: 'Shen Cooper',
    }).then(res => {
      Backend.chat = realChat;
      t.eq(called, 0, 'a confident pattern match makes NO model call at all');
      t.eq(res.method, 'deterministic', 'and is answered deterministically');
      t.deep(res.command.primary.targetIds, ['gateborn'], 'with the right target');
    });
  }).then(() => {
    /* A model naming something not in the enum must not reach the engine. */
    Backend.configure({
      kind: 'fixture',
      fixtures: {
        'referee:PLAYER TYPED:': JSON.stringify({ family: 'combat', compound: false, ambiguous: false }),
        'referee:PLAYER (Shen Cooper) TYPED:': JSON.stringify({
          primary: { verb: 'attack', target: 'the-drowned-god' }, needsClarification: false,
        }),
      },
    });
    return Referee.parse('I wedge myself against the drowned thing under the causeway', obs, options, {
      actorId: 'shen', actorName: 'Shen Cooper',
    });
  }).then(res => {
    t.eq(res.method, 'deterministic',
      'a model naming a target that does not exist falls through to the deterministic parser');
    t.ok(/not perceivable/.test(res.fellBackBecause || ''),
      'and the reason names the invalid target');
  });
}

/* ------------------------------------------------------------- the gates -- */
function runGateTests() {
  t.section('gate: writing as the player character');
  let r = Narrator.applyGates(
    'The causeway shudders. "Get behind me," Shen said, raising the shield.',
    { playerCharacters: ['Shen Cooper'] });
  t.ok(r.report.issues.indexOf('player_voice') >= 0, 'dialogue attributed to the player is caught');
  t.eq(/Get behind me/.test(r.text), false, 'and the offending sentence is removed');
  t.ok(r.text.length > 0, 'while the rest of the paragraph survives');

  r = Narrator.applyGates('Shen decides the abbey is a trap and turns back.',
    { playerCharacters: ['Shen Cooper'] });
  t.ok(r.report.issues.indexOf('player_voice') >= 0,
    'deciding for the player is caught as well as speaking for them');

  r = Narrator.applyGates('The water closes over Shen\u2019s boots, cold as a coin.',
    { playerCharacters: ['Shen Cooper'] });
  t.eq(r.report.issues.indexOf('player_voice'), -1,
    'but merely describing the player character is fine');

  r = Narrator.applyGates('"You should not have come," Lysa says.',
    { playerCharacters: ['Shen Cooper'] });
  t.eq(r.report.issues.indexOf('player_voice'), -1, 'and NPCs may speak freely');

  t.section('gate: forbidden names are redacted, not regenerated');
  r = Narrator.applyGates('Reeds part along the causeway, and the Hollow King is waiting.',
    { mustNotName: ['Hollow King', 'Aerath Vhal'] });
  t.ok(r.report.issues.indexOf('forbidden_name') >= 0, 'a forbidden name is caught');
  t.eq(/Hollow King/.test(r.text), false, 'and does not survive into the prose');
  t.ok(r.text.length > 10, 'while the sentence still reads');
  t.deep(r.report.redacted, ['Hollow King'], 'and the redaction is reported');
  t.eq(r.report.regenerate, false,
    'redaction does not force a regeneration — the model would only reach for it again');

  r = Narrator.applyGates('Reeds part along the causeway and something waits.', { mustNotName: ['Hollow King'] });
  t.eq(r.report.issues.indexOf('forbidden_name'), -1, 'clean prose is left alone');

  t.section('gate: tired openings');
  r = Narrator.applyGates('The fog closes over the causeway and nothing moves.', {});
  t.ok(r.report.issues.indexOf('tired_opening') >= 0,
    'opening on the weather is caught — small models reach for it relentlessly');
  t.eq(r.report.usable, true, 'but it is still usable prose, so it never forces a fallback');
  r = Narrator.applyGates('Lysa will not look at the door.', {});
  t.eq(r.report.issues.indexOf('tired_opening'), -1, 'opening on a person is fine');

  t.section('gate: a repeated four-word run');
  r = Narrator.applyGates('Lysa waits, and the very air is holding its breath.',
    { recent: ['Nothing moves in the reeds; the air itself is holding its breath.'] });
  t.ok(r.report.issues.indexOf('repeated_phrasing') >= 0,
    'a distinctive four-word run reused across turns is caught');
  t.eq(r.report.repeatedPhrase, 'is holding its breath', 'and the phrase is named');
  r = Narrator.applyGates('Lysa waits by the door, out of the water and shivering.',
    { recent: ['Shen steps out of the water and onto the boards.'] });
  t.eq(r.report.issues.indexOf('repeated_phrasing'), -1,
    'but an ordinary phrase like "out of the water" does not trip it');

  t.section('gate: breaking character');
  r = Narrator.applyGates('As an AI, I cannot describe violence in detail.', {});
  t.ok(r.report.issues.indexOf('breaks_character') >= 0, 'an AI disclaimer is caught');
  t.eq(r.report.usable, false, 'and the reply is unusable');
  t.eq(r.report.regenerate, true, 'so it is regenerated');

  r = Narrator.applyGates('The door gives. Let me know if you would like more detail.', {});
  t.ok(r.report.issues.indexOf('meta_talk') >= 0, 'an offer to help is caught');

  r = Narrator.applyGates('   ', {});
  t.ok(r.report.issues.indexOf('empty') >= 0, 'empty output is caught');
  t.eq(r.report.usable, false, 'and is unusable');

  t.section('gate: repetition');
  const prior = [
    'The air thickens over the causeway, and something in the reeds goes still.',
    'The water is a hand deep and colder than it should be.',
  ];
  r = Narrator.applyGates('The air thickens over the causeway, and something in the reeds goes still.',
    { recent: prior });
  t.ok(r.report.repetition > 0.5, 'near-identical prose scores high on repetition');
  t.eq(r.report.regenerate, true, 'and is regenerated');

  r = Narrator.applyGates('Lysa will not look at the abbey door. Her hands are full of nothing.',
    { recent: prior });
  t.ok(r.report.repetition < 0.2, 'genuinely new prose scores low');
  t.eq(r.report.regenerate, false, 'and passes');

  r = Narrator.applyGates('The air tastes of iron here, and nothing in the fen is moving.',
    { recent: prior });
  t.ok(r.report.issues.indexOf('repeated_opening') >= 0,
    'reusing an opening phrase is caught even when the rest differs');

  t.section('gate: length');
  const longText = new Array(120).join('The reeds bend. ');
  r = Narrator.applyGates(longText, { maxWords: 40 });
  t.ok(r.report.issues.indexOf('too_long') >= 0, 'over-long prose is caught');
  t.ok(r.text.split(/\s+/).length <= 45, 'and is trimmed to about the budget');

  t.section('gate: corrections name the specific failure');
  const corr = Narrator.correctionFor({ issues: ['player_voice'] }, { playerCharacters: ['Shen Cooper'] });
  t.ok(/Shen Cooper/.test(corr), 'the correction names the character it must not voice');
  t.ok(/Rewrite/.test(corr), 'and asks for a rewrite');
  return Promise.resolve();
}

/* ------------------------------------------------------------- prompting -- */
function runPromptTests() {
  t.section('prompt: authority and the system block');
  const campaign = {
    title: 'The Divided Steel', premise: 'Four seals hold.', tone: 'grim, close, quiet',
    openCanon: ['Dunmere is a smithing town.'],
    hardRules: ['The Warden is not a god.'],
  };
  const sys = Prompt.buildSystem(campaign);
  t.ok(/NEVER/.test(sys), 'the system prompt states hard prohibitions');
  t.ok(/roll, invent, or mention a die result/.test(sys), 'it forbids inventing dice');
  t.ok(/never (?:speak or act|write)/i.test(sys) || /speak or act for a player-controlled/.test(sys),
    'it forbids speaking for player characters');
  t.ok(/Dunmere is a smithing town/.test(sys), 'open canon is included');
  t.ok(/The Warden is not a god/.test(sys), 'hard rules are included');

  t.section('prompt: gated secrets never enter the system prompt');
  const g2 = scene();
  const store2 = storeWithSecret();
  const sys2 = Prompt.buildSystem(campaign);
  t.eq(/Hollow King/.test(sys2), false,
    'an unrevealed secret is absent from the immutable system prompt');
  t.eq(/Aerath Vhal/.test(sys2), false, 'as is its forbidden name');

  /* The system prompt must be byte-identical turn to turn, or the KV prefix
     cache is rebuilt every time and every turn pays full prompt cost. */
  g2.actors.shen.runtime.hp = 4;
  g2.combat = { active: true, round: 3, order: [], turnIndex: 0 };
  t.eq(Prompt.buildSystem(campaign), sys2,
    'the system prompt is unchanged by game state — the prefix cache survives');

  t.section('prompt: the stage direction carries the dynamic parts');
  const built = Prompt.forNarration(g2, store2, campaign, ['Shen hits the Gate-Born for 9 damage.'], {
    locationName: 'The Glass Fen causeway', timeOfDay: 'dusk', weather: 'fog',
    playerAction: 'Shen swings at the shape in the water.',
  });
  t.ok(/Glass Fen causeway/.test(built.stage), 'the scene is in the stage direction');
  t.ok(/9 damage/.test(built.stage), 'the committed result is in the stage direction');
  t.ok(/already resolved/.test(built.stage),
    'and is explicitly labelled as settled, so the model narrates rather than decides');
  t.ok(/Shen Cooper/.test(built.stage), 'the player character is named in the not-yours-to-speak-for block');
  t.eq(/Hollow King/.test(built.stage), false,
    'and the unrevealed secret is absent from the stage direction too');

  t.section('prompt: reveals appear only once authorised');
  t.eq((built.ctx.mayReveal || []).length, 0, 'nothing is revealable before the predicate');
  g2.flags.enteredMirrorAbbey = true;
  const built2 = Prompt.forNarration(g2, store2, campaign, [], {});
  t.eq(built2.ctx.mayReveal.length, 1, 'the predicate opens exactly one reveal');
  t.ok(/YOU MAY REVEAL/.test(built2.stage), 'and it reaches the stage direction');
  t.ok(/Hollow King/.test(built2.stage), 'now the name may appear');

  t.section('prompt: intensity is computed, not guessed');
  const calm = scene();
  let ob = Knowledge.getObservation(calm, storeWithSecret(), 'dm', { mode: 'dm' });
  const calmI = Prompt.computeIntensity(calm, ob);
  calm.combat = { active: true, round: 1, order: [], turnIndex: 0 };
  ob = Knowledge.getObservation(calm, storeWithSecret(), 'dm', { mode: 'dm' });
  const fightI = Prompt.computeIntensity(calm, ob);
  t.ok(fightI > calmI, 'combat raises intensity above a quiet scene');
  calm.actors.shen.runtime.hp = 2;
  calm.actors.aldren.runtime.hp = 1;
  ob = Knowledge.getObservation(calm, storeWithSecret(), 'dm', { mode: 'dm' });
  t.ok(Prompt.computeIntensity(calm, ob) > fightI, 'a hurt party raises it further');
  t.ok(Prompt.computeIntensity(calm, ob) <= 1, 'and it never exceeds one');
  t.ok(/still|low|tense|urgent|violent|catastrophic/.test(Prompt.describeIntensity(0.1)),
    'intensity renders as words for the prompt');

  t.section('prompt: the context budget is enforced');
  const history = [];
  for (let i = 0; i < 200; i++) {
    history.push({ role: 'user', content: 'Turn ' + i + ': ' + new Array(60).join('words ') });
  }
  const asm = Prompt.assemble({
    system: sys2, stage: built.stage,
    pinned: ['Shen promised Lysa he would come back for her brother.'],
    summaries: ['Chapter II: the second seal was restored.', 'Chapter III: two fragments were stolen.'],
    history: history,
  }, 6400);
  t.ok(asm.estimatedTokens <= 6400, 'the assembled prompt fits the budget',
    '(' + asm.estimatedTokens + ' tokens)');
  t.ok(asm.droppedHistory > 0, 'old raw turns were evicted');
  t.eq(asm.messages[0].role, 'system', 'the system prompt is first');
  t.eq(asm.messages[0].content, sys2, 'and is never evicted');
  t.eq(asm.messages[asm.messages.length - 1].content, built.stage,
    'the stage direction is last, so the most important constraint is most recent');
  t.ok(/must not be forgotten/i.test(JSON.stringify(asm.messages)),
    'pinned facts survive eviction');
  return Promise.resolve();
}

/* --------------------------------------------------------------- offline -- */
function runOfflineTests() {
  t.section('offline narrator: always produces usable prose');
  const g3 = scene();
  let batch = Events.makeBatch({ commandId: 'c1', actorId: 'shen' });
  batch.events.push({ kind: 'roll', rollKind: 'attack', targetId: 'gateborn', hit: true, isCrit: false, seq: 1 });
  batch.events.push({ kind: 'hp', targetId: 'gateborn', delta: -9, damageType: 'radiant', seq: 2 });
  let text = Offline.narrate(g3, batch, { rng: new RNG('a') });
  t.ok(text.length > 10, 'a hit produces prose', '(' + text + ')');
  t.ok(/9 radiant damage/.test(text), 'and reports the actual damage');

  batch = Events.makeBatch({ commandId: 'c2', actorId: 'shen' });
  batch.events.push({ kind: 'roll', rollKind: 'attack', targetId: 'gateborn', hit: false, seq: 1 });
  text = Offline.narrate(g3, batch, { rng: new RNG('b') });
  t.ok(text.length > 10, 'a miss produces prose', '(' + text + ')');
  t.eq(/damage/.test(text), false, 'and does not mention damage');

  batch = Events.makeBatch({ commandId: 'c3', actorId: 'shen' });
  batch.events.push({ kind: 'death', actorId: 'gateborn', seq: 1 });
  text = Offline.narrate(g3, batch, { rng: new RNG('c') });
  t.ok(/Gate-Born/.test(text), 'a death names the creature', '(' + text + ')');

  batch = Events.makeBatch({ commandId: 'c4', actorId: 'shen' });
  Events.push(batch, 'note', { text: 'x' }, 'Shen finds nothing but silt.');
  text = Offline.narrate(g3, batch, { rng: new RNG('d') });
  t.eq(text, 'Shen finds nothing but silt.',
    'an event with no phrasing falls back to the engine beat rather than to silence');

  batch = Events.makeBatch({ commandId: 'c5', actorId: 'shen' });
  Events.refuse(batch, 'no_target', 'there is nothing within reach');
  text = Offline.narrate(g3, batch, {});
  t.ok(/cannot happen/.test(text) && /within reach/.test(text),
    'a refusal explains itself', '(' + text + ')');

  t.eq(Offline.narrate(g3, null, { rng: new RNG('e') }).length > 5, true,
    'even a missing batch produces something');

  t.section('offline narrator: deterministic for a given seed');
  batch = Events.makeBatch({ commandId: 'c6', actorId: 'shen' });
  batch.events.push({ kind: 'roll', rollKind: 'attack', targetId: 'gateborn', hit: true, seq: 1 });
  batch.events.push({ kind: 'hp', targetId: 'gateborn', delta: -5, seq: 2 });
  t.eq(Offline.narrate(g3, batch, { rng: new RNG('same') }),
    Offline.narrate(g3, batch, { rng: new RNG('same') }),
    'the same seed narrates identically');

  t.section('offline: scene description');
  const ob = Knowledge.getObservation(g3, storeWithSecret(), 'shen', {});
  const desc = Offline.describeScene(g3, ob, { locationName: 'the Glass Fen', timeOfDay: 'dusk' });
  t.ok(/Glass Fen/.test(desc), 'the scene names the place');
  t.ok(/Gate-Born/.test(desc), 'and what you are facing', '(' + desc + ')');
  t.ok(/Aldren/.test(desc), 'and who is with you');

  t.section('offline prose passes its own gates');
  /* `plainSummary` because the offline narrator is the ENGINE speaking, not
     the model dramatising: "Shen Cooper takes 5 damage" is exactly what it is
     for. The gate that keeps arithmetic out of narration would otherwise
     delete every sentence of it and leave the last-resort fallback empty,
     which is the one thing a fallback may never be. Every other gate — and in
     particular every fatal one — still applies to it. */
  const offlineText = Offline.narrate(g3, batch, { rng: new RNG('g') });
  const gated = Narrator.applyGates(offlineText,
    { playerCharacters: ['Shen Cooper'], mustNotName: ['Hollow King'], recent: [], plainSummary: true });
  t.eq(gated.report.usable, true, 'offline prose is always usable');
  t.deep(gated.report.issues, [], 'and trips no gates');

  /* And it must never trip a FATAL gate even without that exemption, or the
     fallback could be rejected at the moment everything else has failed. */
  const strict = Narrator.applyGates(offlineText,
    { playerCharacters: ['Shen Cooper'], mustNotName: ['Hollow King'], recent: [] });
  const fatalHit = strict.report.issues.filter(i => Narrator.GATES.fatal.indexOf(i) >= 0);
  t.deep(fatalHit, [], 'and trips no fatal gate under any circumstances');
  return Promise.resolve();
}


/* ------------------------------------------- what an AI seat may say -- */
/**
 * A player agent's dialogue is written straight into the transcript, and it
 * used to go in unexamined — no forbidden-name check, no character-break
 * check, none of the gates the Dungeon Master's own prose has to pass. The
 * agent is only handed its character's observation, so it should not know the
 * secret; "should not" is not a guarantee worth a campaign.
 */
function runSeatSpeechTests() {
  const Game = require('../js/game.js');
  t.section('an AI seat\u2019s speech passes the same gates as the narrator\u2019s prose');

  const s = State.create({ seed: 'seat-speech' });
  [['a', 'Vess'], ['b', 'Bram']].forEach(([id, name]) => State.addActor(s, {
    id, name, side: 'party', kind: 'pc',
    base: { name, abilities: {}, classes: [] },
    progression: { levels: [] },
    runtime: { hp: 10, hpMax: 10, conditions: {}, inventory: [], deathSaves: {} },
  }));
  const store = Knowledge.makeStore();
  Knowledge.defineFacts(store, [{
    id: 'hk', claim: 'A dead king walks.', secret: true,
    forbiddenUntilKnown: ['Hollow King'], stages: { full: 'The Hollow King stirs.' },
  }]);
  store.known = s.knowledge;
  const session = Game.createSession({ state: s, store: store, campaign: { id: 'c', title: 'C' } });

  const plain = Game.gateSpeech(session, 'a', 'We hold the door. Move.');
  t.eq(plain, 'We hold the door. Move.', 'an ordinary line passes through untouched');

  const secret = Game.gateSpeech(session, 'a', 'The Hollow King is behind this, I know it.');
  t.eq(/Hollow King/.test(secret), false,
    'a seat cannot name a secret its character has not learned');
  t.ok(secret.length > 0, 'but the line survives, redacted, rather than vanishing');

  t.eq(Game.gateSpeech(session, 'a', 'As an AI language model, I cannot roleplay that.'), '',
    'a line that breaks character is dropped rather than spoken');

  t.eq(/\u76fe/.test(Game.gateSpeech(session, 'a', 'I raise my \u76fe and hold the line.')), false,
    'a stray foreign-script token never reaches the transcript');

  return Promise.resolve();
}