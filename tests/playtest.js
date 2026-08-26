/*
 * tests/playtest.js — an unattended AI playtest driver.
 *
 * Not a pass/fail gate. This is the harness that produces evidence: it seats
 * one to four AI-controlled players at a real campaign, plays a stretch of it,
 * and writes the whole session out so a person (or a reviewing model) can read
 * what actually happened and judge whether the game works.
 *
 * Everything an AI seat does here goes through the same dispatcher a human
 * click uses, so a clean run is meaningful evidence about the real game rather
 * than about a test-only path.
 *
 *   node tests/playtest.js --campaign shen --turns 20 --model claude-opus-5
 *   node tests/playtest.js --campaign sandbox --seats 4 --turns 30
 *   node tests/playtest.js --campaign shen --dm local --seats 1 --turns 12
 */
'use strict';

const path = require('path');
const RNG = require('../js/rng.js').RNG;
const Command = require('../js/engine/command.js');
const Events = require('../js/engine/events.js');
const Knowledge = require('../js/engine/knowledge.js');
const State = require('../js/engine/state.js');
const Dispatch = require('../js/engine/dispatch.js');
const Character = require('../js/engine/character.js');
const Chargen = require('../js/gen/chargen.js');
const Combat = require('../js/engine/combat.js');
const Rules = require('../js/engine/rules.js');
const Interaction = require('../js/engine/interaction.js');
const Save = require('../js/engine/save.js');
const Backend = require('../js/ai/backend.js');
const PlayerAgent = require('../js/ai/player_agent.js');
const Game = require('../js/game.js');

/* -------------------------------------------------------------------- args */

function parseArgs(argv) {
  const out = {
    campaign: 'shen', turns: 15, seats: 1,
    dm: 'local', dmModel: null,
    model: 'claude-opus-5', backend: 'copilot',
    seed: 'playtest-' + Date.now().toString(36),
    port: process.env.PORT || 8177,
    label: '', quiet: false, noExport: false, encounter: false, levelAt: 0, waves: 1, startLevel: 0, milestone: false,
    expert: false, untilLevel: 0, interlude: 6, expertModel: null, deathPolicy: '',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--campaign') out.campaign = next();
    else if (a === '--turns') out.turns = parseInt(next(), 10);
    else if (a === '--seats') out.seats = parseInt(next(), 10);
    else if (a === '--dm') out.dm = next();
    else if (a === '--dm-model') out.dmModel = next();
    else if (a === '--model') out.model = next();
    else if (a === '--backend') out.backend = next();
    else if (a === '--seed') out.seed = next();
    else if (a === '--label') out.label = next();
    else if (a === '--quiet') out.quiet = true;
    else if (a === '--no-export') out.noExport = true;
    else if (a === '--encounter') out.encounter = true;
    else if (a === '--waves') out.waves = parseInt(next(), 10);
    else if (a === '--milestone') out.milestone = true;
    else if (a === '--start-level') out.startLevel = parseInt(next(), 10);
    else if (a === '--level-at') out.levelAt = parseInt(next(), 10);
    /* An experienced player does more than pick a move off a list: they ask
       the Dungeon Master how a rule works, they ask to amend the record, and
       they change who is travelling with them. `--expert` seats one and lets
       it do all three. */
    else if (a === '--expert') out.expert = true;
    else if (a === '--until-level') out.untilLevel = parseInt(next(), 10);
    else if (a === '--interlude') out.interlude = parseInt(next(), 10);
    else if (a === '--expert-model') out.expertModel = next();
    /* Which mortality rules the campaign is played under. A long unattended
       run to a target level under 'standard' ends the moment the seated
       character rolls three failed death saves, and then grinds on with the
       companions, which measures nothing. 'heroic' is a real campaign setting
       and the honest one for this. */
    else if (a === '--death-policy') out.deathPolicy = next();
  }
  return out;
}

const ARGS = parseArgs(process.argv);
const BASE = 'http://127.0.0.1:' + ARGS.port;

/* The modules normally run in a page and post to relative URLs. Here there is
   no page, so give fetch the absolute origin. */
const origFetch = global.fetch;
global.fetch = function (url, opts) {
  if (typeof url === 'string' && url.charAt(0) === '/') url = BASE + url;
  return origFetch(url, opts);
};

function log() {
  if (!ARGS.quiet) console.log.apply(console, arguments);
}

function hr(title) {
  log('\n' + '\u2500'.repeat(74));
  if (title) log('  ' + title);
  if (title) log('\u2500'.repeat(74));
}

/* ----------------------------------------------------------------- setup */

function loadCampaign(which) {
  if (which === 'shen') {
    const pub = require('../campaigns/shen_cooper.js');
    const bible = require('../campaigns/shen_cooper_bible.js');
    const cont = require('../campaigns/shen_continuation.js');
    return {
      campaign: pub.shenCooper || pub,
      bible: bible.shenCooperBible || bible,
      continuation: cont.shenContinuation || cont,
    };
  }
  return { campaign: null, bible: null, continuation: null };
}

function buildShenSession() {
  const { campaign, bible, continuation } = loadCampaign('shen');

  const state = State.create({ seed: ARGS.seed, campaignId: 'shen-cooper' });
  const store = Knowledge.makeStore();
  Knowledge.defineFacts(store, (bible.FACTS || []).concat(bible.EARNED || [], bible.SECRETS || []));
  store.known = state.knowledge;

  continuation.applyTo(state, store);

  /* Optionally put something in the water.
     The recorded save-state is an investigation, which is correct and is what
     the campaign should resume into — but it means a playtest of it never
     touches an attack roll, a smite or a death save. This spawns a
     canon-appropriate threat so Shen's actual sheet gets exercised. */
  if (ARGS.encounter) {
    const MONSTERS = (() => {
      try { return require('../js/data/srd_monsters.js').MONSTERS; } catch (e) { return {}; }
    })();
    /* The dossier's recurring threat is the Gate-Born, a construct-like thing
       that comes through a failing seal. Nothing in the SRD is called that, so
       an SRD statblock is dressed in the campaign's name rather than inventing
       mechanics. */
    const dressing = [
      { id: 'gateborn-1', name: 'A Gate-Born', block: 'ghoul', pos: { x: 5, y: 2 } },
      { id: 'gateborn-2', name: 'A lesser Gate-Born', block: 'skeleton', pos: { x: 6, y: 2 } },
      { id: 'gateborn-3', name: 'A lesser Gate-Born', block: 'skeleton', pos: { x: 4, y: 3 } },
    ];
    dressing.forEach(d => {
      const block = MONSTERS[d.block];
      if (!block) return;
      const hp = block.hp || 20;
      State.addActor(state, {
        id: d.id, name: d.name, side: 'enemy', kind: 'monster', statblock: block,
        base: {
          name: d.name,
          abilities: block.abilities || { str: 13, dex: 14, con: 12, int: 6, wis: 10, cha: 6 },
          proficiencies: { skills: [], saves: [] }, classes: [],
        },
        progression: { xp: 0, levels: [] },
        runtime: {
          hp, hpMax: hp, tempHp: 0, conditions: {}, exhaustion: 0, concentratingOn: null,
          attuned: [], equipped: {}, inventory: [], deathSaves: { successes: 0, failures: 0 },
          resources: {}, gold: 0, pos: d.pos, attacksAuthored: true,
          attacks: (block.actions || [])
            .filter(a => a.damage && a.damage.length)
            .map(a => {
              const dm = a.damage[0] || {};
              return {
                name: a.name, toHit: a.toHit != null ? a.toHit : 4,
                damage: (dm.dice || '1d6') + (dm.flat ? '+' + dm.flat : ''),
                damageType: dm.type || 'slashing', abilityMod: 0, reach: a.reach || 5,
              };
            }),
        },
      });
    });
    state.flags = state.flags || {};
    state.flags.mirrorAbbeyApproach = true;
  }

  const session = Game.createSession({ state, store, campaign });
  session.locationName = (campaign.locations &&
    campaign.locations[state.locationId] && campaign.locations[state.locationId].name) ||
    "Lantern's Rest";
  session.timeOfDay = 'dusk';
  session.weather = 'fog';
  return session;
}

function buildSandboxSession(seatCount) {
  const state = State.create({ seed: ARGS.seed, campaignId: 'sandbox' });
  const store = Knowledge.makeStore();
  store.known = state.knowledge;

  /* A deliberately small, self-contained scene: four adventurers, three
     hostiles, one room. Enough to exercise initiative, the action economy,
     targeting, damage and death without depending on world generation. */
  const pcs = [
    { id: 'pc1', name: 'Vess Ardenwold', cls: 'fighter', hp: 30, str: 16, dex: 14, con: 15 },
    { id: 'pc2', name: 'Bramwell Tuck', cls: 'cleric', hp: 24, str: 12, dex: 12, con: 14 },
    { id: 'pc3', name: 'Sable', cls: 'rogue', hp: 22, str: 10, dex: 17, con: 12 },
    { id: 'pc4', name: 'Ysolde Vane', cls: 'wizard', hp: 18, str: 8, dex: 14, con: 12 },
  ].slice(0, Math.max(1, seatCount));

  pcs.forEach((p, i) => {
    /* Three levels of stored hit-point rolls, so derive() produces a maximum
       that matches the intended toughness rather than clamping it down. */
    const perLevel = Math.max(1, Math.round((p.hp - Math.floor((p.con - 10) / 2) * 3) / 3));
    State.addActor(state, {
      id: p.id, name: p.name, side: 'party', kind: 'pc',
      persona: p.name + ', a ' + p.cls + ' who has been doing this long enough to be careful.',
      base: {
        name: p.name, raceId: 'human', classes: [{ classId: p.cls, levels: 3 }],
        abilities: { str: p.str, dex: p.dex, con: p.con, int: 12, wis: 12, cha: 12 },
        proficiencies: { skills: [], saves: [] },
      },
      progression: {
        xp: 900,
        levels: [
          { level: 1, classId: p.cls, hpGained: perLevel, choice: 'average' },
          { level: 2, classId: p.cls, hpGained: perLevel, choice: 'average' },
          { level: 3, classId: p.cls, hpGained: perLevel, choice: 'average' },
        ],
      },
      runtime: {
        hp: p.hp, hpMax: p.hp, tempHp: 0, conditions: {}, exhaustion: 0,
        concentratingOn: null, attuned: [], equipped: {}, gold: 25,
        inventory: [
          { uid: p.id + '-weapon', id: 'longsword', name: 'Longsword' },
          { uid: p.id + '-potion', id: 'potion-of-healing', name: 'Potion of Healing', heal: '2d4+2', consumable: true },
        ],
        deathSaves: { successes: 0, failures: 0 }, resources: {},
        pos: { x: 2 + i, y: 6 },
      },
    });
  });

  [
    { id: 'e1', name: 'Gnoll Pack-Runner', hp: 22, x: 5, y: 2, cr: 0.5 },
    { id: 'e2', name: 'Gnoll Pack-Runner', hp: 22, x: 6, y: 2, cr: 0.5 },
    { id: 'e3', name: 'Gnoll Fang', hp: 33, x: 7, y: 3, cr: 2 },
  ].forEach(e => {
    State.addActor(state, {
      id: e.id, name: e.name, side: 'enemy', kind: 'monster', cr: e.cr,
      base: { name: e.name, abilities: { str: 14, dex: 12, con: 11, int: 6, wis: 10, cha: 7 } },
      progression: { xp: 0, levels: [] },
      runtime: {
        hp: e.hp, hpMax: e.hp, tempHp: 0, conditions: {}, exhaustion: 0,
        concentratingOn: null, attuned: [], equipped: {}, inventory: [], gold: 0,
        deathSaves: { successes: 0, failures: 0 }, resources: {},
        pos: { x: e.x, y: e.y },
      },
    });
  });

  state.locationId = 'the-drowned-chapel';

  const campaign = {
    id: 'sandbox', title: 'The Drowned Chapel',
    premise: 'A chapel half-swallowed by a river, and something denning in it.',
    tone: 'brisk, physical, slightly grim',
    openCanon: ['The river took the lower town two winters ago.'],
    hardRules: [],
  };

  const session = Game.createSession({ state, store, campaign });
  session.locationName = 'the drowned chapel';
  session.timeOfDay = 'afternoon';
  session.weather = 'overcast';
  return session;
}

/* ------------------------------------------------------------------- seats */

function seatUp(session, count, backendKind, model) {
  const party = State.partyIds(session.state);
  const chosen = party.slice(0, Math.max(1, Math.min(4, count)));
  chosen.forEach((actorId, i) => {
    const actor = session.state.actors[actorId];
    State.addSeat(session.state, {
      id: 'p' + (i + 1),
      name: 'AI seat ' + (i + 1),
      actorId: actorId,
      control: 'ai',
      agent: {
        backend: backendKind, model: model,
        persona: actor.persona || (actor.name + ' plays honestly and in character.'),
      },
    });
  });
  /* Anyone in the party without a seat is a companion the DM runs. */
  party.filter(id => chosen.indexOf(id) < 0).forEach(id => {
    State.setController(session.state, id, { kind: 'companionPolicy', seatId: null, agent: null });
  });
  return chosen;
}

/* ------------------------------------------------------- the expert player

   Picking a move off a list is the least of what an experienced player does.
   They interrupt to ask how a rule works, they ask the Dungeon Master to
   amend something that was skipped over, they recruit and part with
   companions, and they try things the designer did not think of.

   None of that was ever exercised by an unattended run, so none of it was
   ever evidence of anything. This seats a large model as that player. */

const EXPERT = {
  asked: 0, answered: 0, badAnswers: [],
  amendsAsked: 0, amendsAllowed: 0, amendsRefused: 0, amendsApplied: 0,
  recruited: 0, dismissed: 0,
  improvised: 0,
  notes: [],
};

/** Ask the expert's own model for a line of free text. */
async function expertSays(system, user, opts) {
  opts = opts || {};
  const model = ARGS.expertModel || ARGS.model;
  const body = {
    model: model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    json: !!opts.json,
  };
  const r = await fetch('/api/copilot/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('copilot ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const raw = await r.text();
  /* NDJSON, one object per line, same shape the Ollama proxy returns. */
  let text = '';
  raw.split('\n').filter(Boolean).forEach(line => {
    try {
      const j = JSON.parse(line);
      text += (j.message && j.message.content) || j.response || '';
    } catch (e) { /* a partial line at the end */ }
  });
  return text.trim();
}

/** What the expert can see right now, in words, for its own prompts. */
function expertBriefing(session, actorId) {
  const s = session.state;
  const a = s.actors[actorId];
  const d = (a && a.derivedCache) || {};
  const rt = (a && a.runtime) || {};
  const party = State.partyIds(s).map(id => {
    const p = s.actors[id];
    return p.name + ' (' + p.runtime.hp + '/' + ((p.derivedCache || {}).hpMax || p.runtime.hpMax) + ' hp)';
  });
  const foes = State.livingEnemies(s).map(id => s.actors[id].name);
  const recent = (s.transcript || []).slice(-6)
    .map(l => (typeof l === 'string' ? l : (l.text || l.narration || '')))
    .filter(Boolean).join('\n');
  return [
    'You are playing ' + (a ? a.name : actorId) + '.',
    'Level ' + (d.level || 1) + ', ' + rt.hp + '/' + (d.hpMax || rt.hpMax) + ' hit points, AC ' + d.ac + '.',
    'Party: ' + party.join(', '),
    foes.length ? 'Enemies present: ' + foes.join(', ') : 'No enemies present.',
    'Where: ' + (session.locationName || s.locationId || 'somewhere'),
    recent ? 'Recently:\n' + recent : '',
  ].filter(Boolean).join('\n');
}

const EXPERT_PERSONA =
  'You are an experienced Dungeons & Dragons 5th Edition player \u2014 the ' +
  'kind who has run and played for years, knows the 2014 rules well, and ' +
  'plays their character with commitment. You are at a table right now.';

/** Interrupt play to ask the Dungeon Master something. */
async function expertAsks(session, actorId) {
  EXPERT.asked++;
  let question;
  try {
    question = await expertSays(EXPERT_PERSONA,
      expertBriefing(session, actorId) + '\n\n' +
      'Ask the Dungeon Master ONE question, out of character, of the kind a ' +
      'real player asks mid-session: how a rule works, what your own ' +
      'character can do right now, whether something you want to try is ' +
      'possible, or what you can see. Vary it \u2014 do not always ask about ' +
      'the same thing. Reply with the question only, one sentence.');
  } catch (e) {
    log('  ! expert could not compose a question: ' + e.message);
    return;
  }
  if (!question) return;
  log('\n  [OOC] ' + question);

  const out = await Game.askOrAmend(session, question, {
    actorId: actorId, locationName: session.locationName,
    stallMs: 120000, totalMs: 300000,
  });

  const text = out.text || out.describe || '';
  log('  [DM ] ' + String(text).replace(/\n/g, '\n        ').slice(0, 700));

  if (out.kind === 'answer' && text) {
    EXPERT.answered++;
    /* The two failures that would make the feature worthless. */
    if (/there is no dungeon master model/i.test(text)) {
      EXPERT.badAnswers.push({ question, why: 'fell back to offline', text: text.slice(0, 160) });
    } else if (text.length < 25) {
      EXPERT.badAnswers.push({ question, why: 'no real answer', text });
    }
  } else if (out.kind === 'amend') {
    /* It asked for a change while being told to ask a question. Fine — the
       classifier is doing its job; take it as an amendment. */
    await resolveAmendment(session, actorId, question, out);
  }
}

/** Ask the Dungeon Master to amend the record, and apply it if allowed. */
async function expertAmends(session, actorId) {
  EXPERT.amendsAsked++;
  let request;
  try {
    request = await expertSays(EXPERT_PERSONA,
      expertBriefing(session, actorId) + '\n\n' +
      'Ask the Dungeon Master to retcon something \u2014 to establish that ' +
      'something was already true, or to correct something that was skipped. ' +
      'The kind of thing a real player says: "can we say I bought rope in ' +
      'town before we left?", "I\u2019d have filled my waterskin", "wait, ' +
      'shouldn\u2019t I have had advantage on that?", "can we say my character ' +
      'already knew her?". Keep it modest and plausible. Reply with the ' +
      'request only, one sentence.');
  } catch (e) {
    log('  ! expert could not compose an amendment: ' + e.message);
    return;
  }
  if (!request) return;
  log('\n  [OOC/retcon] ' + request);

  const out = await Game.askOrAmend(session, request, {
    actorId: actorId, locationName: session.locationName,
    stallMs: 120000, totalMs: 300000,
  });
  await resolveAmendment(session, actorId, request, out);
}

async function resolveAmendment(session, actorId, request, out) {
  if (out.kind === 'refused') {
    EXPERT.amendsRefused++;
    /* In full. Truncating this to 300 characters hid the actual reason during
       a live run: the Dungeon Master had ALLOWED a healer's kit and the
       engine refused it over an apostrophe, and the log showed only the
       ruling saying yes, which read as the classifier misfiring. */
    log('  [DM ] refused:\n        ' + String(out.text).replace(/\n/g, '\n        '));
    EXPERT.notes.push('amendment refused: ' + String(out.text).replace(/\n/g, ' ').slice(0, 200));
    return;
  }
  if (out.kind !== 'amend') {
    log('  [DM ] answered instead: ' + String(out.text || '').slice(0, 250));
    return;
  }
  EXPERT.amendsAllowed++;
  log('  [DM ] ' + String(out.describe).replace(/\n/g, '\n        '));

  const before = JSON.stringify(State.digest(session.state).party);
  const applied = Game.applyRetcon(session, out.proposal, { actorId, request });
  if (applied.ok) {
    EXPERT.amendsApplied++;
    const after = JSON.stringify(State.digest(session.state).party);
    log('  [   ] applied' + (before === after ? ' (story only)' : ' \u2014 the sheets moved'));
  } else {
    log('  [   ] could not apply: ' + applied.reason);
    EXPERT.notes.push('retcon failed to apply: ' + applied.reason);
  }
}

/**
 * Someone joins, or someone leaves.
 *
 * Party composition changing mid-campaign is ordinary at a table and was
 * never exercised: every previous run started with a fixed party and ended
 * with the same one, so nothing proved that adding or removing a member
 * leaves the initiative, the seats and the roster consistent.
 */
function expertChangesParty(session, join) {
  const s = session.state;
  const party = State.partyIds(s);

  if (join) {
    const level = Math.max(1, (s.actors[party[0]].derivedCache || {}).level || 1);
    const spec = Chargen.generate({
      rng: new RNG('recruit-' + party.length + '-' + s.revision),
      fixed: { levels: level },
    });
    const built = Character.buildFromSpec(spec);
    const id = 'ally-' + s.revision;
    /* Through a spawn EVENT rather than State.addActor, so a recruit is
       replayable and undoable like everything else. A companion who appears
       by direct mutation is invisible to the log and vanishes on a rewind. */
    const batch = Events.makeBatch({ commandId: 'recruit-' + id, actorId: party[0] });
    Events.push(batch, 'spawn', {
      actorId: id,
      actor: {
        id, name: spec.name, side: 'party', kind: 'npc',
        base: built.base, progression: built.progression, runtime: built.runtime,
        persona: spec.name + ' has thrown in with the party.',
      },
    });
    Events.commit(s, batch);
    State.setController(s, id, { kind: 'companionPolicy', seatId: null, agent: null });
    State.refreshAllDerived(s);
    EXPERT.recruited++;
    log('\n  [party] ' + spec.name + ' joins the party (level ' + level + ').');
    return id;
  }

  /* Part with a companion — never a seated player, and never the last one. */
  const seatedIds = (s.seats || []).map(x => x.actorId);
  const spare = party.filter(id => seatedIds.indexOf(id) < 0);
  if (!spare.length || party.length <= 2) return null;
  const goes = spare[spare.length - 1];
  const name = s.actors[goes].name;

  /* Not mid-fight. Removing a combatant whose turn is in the initiative order
     leaves the order pointing at somebody who no longer exists. */
  if (s.combat && s.combat.active) return null;

  const batch = Events.makeBatch({ commandId: 'part-' + goes, actorId: party[0] });
  Events.push(batch, 'despawn', { actorId: goes });
  Events.commit(s, batch);
  if (s.activeActorId === goes) s.activeActorId = party[0];
  State.refreshAllDerived(s);
  EXPERT.dismissed++;
  log('\n  [party] ' + name + ' parts ways with the party.');
  return goes;
}

/** Has everyone who is seated reached the level we are playing towards? */
function partyAtLevel(session, want) {
  const ids = State.partyIds(session.state);
  if (!ids.length) return false;
  return ids.every(id => {
    const d = session.state.actors[id].derivedCache || {};
    return (d.level || 1) >= want;
  });
}

function lowestLevel(session) {
  const ids = State.partyIds(session.state);
  return ids.reduce((lo, id) => {
    const d = session.state.actors[id].derivedCache || {};
    return Math.min(lo, d.level || 1);
  }, 99);
}

/* ------------------------------------------------------------------ report */

const REPORT = {
  turns: 0, committed: 0, refused: 0, stale: 0, errors: 0,
  narrations: 0, offlineNarrations: 0, gated: 0, gateHits: {},
  leaks: [], modelChoices: 0, policyChoices: 0,
  bySeat: {}, latencies: [], startedAt: Date.now(),
};

function wire(session) {
  Game.on(session, 'committed', e => {
    REPORT.committed++;
    log('  \u2713 ' + (e.command.actorId || '') + ': ' + Command.describe(e.command));
    (e.beats || []).forEach(b => log('      \u00b7 ' + b));
  });
  Game.on(session, 'refused', e => {
    REPORT.refused++;
    if (e.stage === 'stale') REPORT.stale++;
    log('  \u2717 refused (' + e.stage + '): ' + (e.errors || []).join('; '));
  });
  Game.on(session, 'speech', e => log('  \u201c' + e.text + '\u201d  \u2014 ' + e.name));
  Game.on(session, 'narration', e => {
    REPORT.narrations++;
    if (e.source === 'offline') REPORT.offlineNarrations++;
    const issues = (e.report && e.report.issues) || [];
    if (issues.length) {
      REPORT.gated++;
      issues.forEach(i => { REPORT.gateHits[i] = (REPORT.gateHits[i] || 0) + 1; });
    }
    log('\n  ' + e.text.replace(/\n+/g, '\n  ') + '\n');

    /* The canary. The secret was never in the prompt, so it must never be in
       the output — and if it is, that is the single most important thing this
       harness can tell us. */
    State.partyIds(session.state).forEach(id => {
      const leaks = Knowledge.auditLeaks(session.store, id, e.text);
      leaks.forEach(l => {
        REPORT.leaks.push({ observer: id, term: l.term, factId: l.factId, text: e.text.slice(0, 120) });
        log('  *** LEAK for ' + id + ': "' + l.term + '" (' + l.factId + ') ***');
      });
    });
  });
  Game.on(session, 'aiTurn', e => {
    const m = e.turn && e.turn.chosen && e.turn.chosen.method;
    if (m === 'model') REPORT.modelChoices++;
    else if (m === 'policy') REPORT.policyChoices++;
    const seat = REPORT.bySeat[e.actorId] = REPORT.bySeat[e.actorId] || { turns: 0, ok: 0, failed: 0 };
    seat.turns++;
    if (e.turn && e.turn.ok) seat.ok++; else seat.failed++;
    if (e.turn && e.turn.chosen && e.turn.chosen.thinking) {
      log('    (' + e.actorId + ' reasons: ' + e.turn.chosen.thinking + ')');
    }
  });
  Game.on(session, 'error', e => { REPORT.errors++; log('  ! error in ' + e.where + ': ' + e.error); });
}

/* -------------------------------------------------------------------- main */

async function main() {
  hr('AETHERTABLE playtest');
  log('  campaign: ' + ARGS.campaign + '   seats: ' + ARGS.seats + '   turns: ' + ARGS.turns);
  log('  players:  ' + ARGS.backend + ' / ' + ARGS.model);
  log('  dm:       ' + ARGS.dm + (ARGS.dmModel ? ' / ' + ARGS.dmModel : ''));
  log('  seed:     ' + ARGS.seed);

  let status = null;
  try {
    status = await fetch('/api/status').then(r => r.json());
  } catch (e) {
    console.error('\n  Could not reach the server at ' + BASE +
      '.\n  Start it first:  .\\start.cmd -NoBrowser\n');
    process.exit(2);
  }
  log('  server:   ollama=' + status.ollama + ' model=' + (status.loaded || 'none') +
    ' copilot=' + (status.copilot && status.copilot.available));

  if (ARGS.dm === 'copilot') {
    if (!status.copilot || !status.copilot.available) {
      log('  ! Copilot CLI is unavailable; the DM falls back to the local model.');
      Backend.configure({ kind: 'ollama', model: ARGS.dmModel || status.recommended });
    } else {
      Backend.configure({ kind: 'copilot', model: ARGS.dmModel || 'claude-sonnet-5' });
      /* Pay the CLI's cold start now rather than on the first narration. */
      try { await fetch('/api/copilot/warm?model=' + encodeURIComponent(ARGS.dmModel || 'claude-sonnet-5'), { method: 'POST' }); } catch (e) { }
    }
  } else if (ARGS.dm === 'offline') {
    Backend.configure({ kind: 'offline' });
  } else {
    Backend.configure({ kind: 'ollama', model: ARGS.dmModel || status.recommended });
  }

  const session = ARGS.campaign === 'shen'
    ? buildShenSession()
    : buildSandboxSession(ARGS.seats);

  const seated = seatUp(session, ARGS.seats, ARGS.backend, ARGS.model);
  wire(session);

  if (ARGS.deathPolicy) {
    session.state.meta = session.state.meta || {};
    session.state.meta.deathPolicy = ARGS.deathPolicy;
    log('  death:    ' + ARGS.deathPolicy);
  }

  hr('opening state');
  const d0 = State.digest(session.state);
  log('  location: ' + d0.locationId);
  d0.party.forEach(p => log('  ' + p.name.padEnd(22) + ' ' + p.hp + '/' + p.hpMax + ' hp'));
  log('  open quests: ' + d0.openQuests.length);
  log('  seats: ' + seated.map(id => session.state.actors[id].name).join(', '));

  /* If nothing has the initiative, hand it to the first seat so the loop has
     somewhere to start. Out of combat this is simply whose turn to speak. */
  if (!session.state.activeActorId) session.state.activeActorId = seated[0];

  /* Successive waves, each a step harder, so a long run is a session rather
     than one fight followed by eighty turns of standing about. */
  let wavesFought = 0;
  let expertTurns = 0;
  function spawnWave(session, n) {
    const MONSTERS = (() => {
      try { return require('../js/data/srd_monsters.js').MONSTERS; } catch (e) { return {}; }
    })();
    const ladder = [
      ['kobold', 'goblin'], ['goblin', 'wolf'], ['orc', 'hobgoblin'],
      ['gnoll', 'bugbear'], ['ogre', 'wight'],
    ];
    const tier = ladder[Math.min(n, ladder.length - 1)];
    const partySize = State.partyIds(session.state).length;
    const spawned = [];
    tier.forEach((mid, i) => {
      const block = MONSTERS[mid];
      if (!block) return;
      const count = i === 0 ? Math.max(2, partySize) : 1;
      for (let k = 0; k < count; k++) {
        const id = 'w' + n + '-' + mid + '-' + k;
        const hp = block.hp || 10;
        State.addActor(session.state, {
          id, name: block.name + (count > 1 ? ' ' + String.fromCharCode(65 + k) : ''),
          side: 'enemy', kind: 'monster', statblock: block, cr: block.cr,
          base: {
            name: block.name, abilities: block.abilities || { str: 12, dex: 12, con: 12, int: 8, wis: 10, cha: 8 },
            proficiencies: { skills: [], saves: [] }, classes: [],
          },
          progression: { xp: 0, levels: [] },
          runtime: {
            hp, hpMax: hp, tempHp: 0, conditions: {}, exhaustion: 0, concentratingOn: null,
            attuned: [], equipped: {}, inventory: [], deathSaves: { successes: 0, failures: 0 },
            resources: {}, gold: 0, pos: { x: 3 + k, y: 1 + i }, attacksAuthored: true,
            attacks: (block.actions || []).filter(a => a.damage && a.damage.length).map(a => {
              const dm = a.damage[0] || {};
              return {
                name: a.name, toHit: a.toHit != null ? a.toHit : 4,
                damage: (dm.dice || '1d6') + (dm.flat ? '+' + dm.flat : ''),
                damageType: dm.type || 'slashing', abilityMod: 0, reach: a.reach || 5,
              };
            }),
          },
        });
        State.refreshDerived(session.state, id);
        spawned.push(id);
      }
    });
    return spawned;
  }

  /** Everyone still standing catches their breath and spends hit dice. */
  /**
   * A night's rest between waves.
   *
   * Through the engine's own rest rules rather than a hand-rolled heal. The
   * hand-rolled version put everyone back to three-quarters hit points and
   * restored NO SPELL SLOTS, so across a long run the cleric emptied out and
   * the party went into the next wave with no healing at all. That is exactly
   * how the first campaign ended: "You have no slots left, Keeper", and then
   * a wipe to four goblins and a wolf. A party that has just cleared a fight
   * and has time makes camp, and the rules say what that gives back.
   */
  function restBetweenWaves(session) {
    const rested = [];
    State.partyIds(session.state).forEach(id => {
      const a = session.state.actors[id];
      if (!a.runtime || a.runtime.dead) return;

      const batch = Events.makeBatch({ commandId: 'longrest-' + id + '-' + session.state.revision });
      /* Someone at zero has to be on their feet before a rest does anything:
         the rules require at least 1 hit point to benefit from a long rest. */
      if (a.runtime.hp <= 0) {
        Events.push(batch, 'revive', { actorId: id, hp: 1 }, a.name + ' is brought round.');
      }
      let events = [];
      try {
        /* `restoreOnRest` returns { events, type } — not an array. */
        const rest = Rules.restoreOnRest(a.base, a.progression, a.runtime, 'long', {
          actorId: id, derived: a.derivedCache,
        });
        events = (rest && rest.events) || [];
      } catch (e) { events = []; }
      events.forEach(ev => {
        const payload = Object.assign({}, ev);
        delete payload.kind;
        delete payload.seq;
        Events.push(batch, ev.kind, payload);
      });
      Events.push(batch, 'time', { minutes: 480 }, '');
      try {
        Events.commit(session.state, batch);
        rested.push(a.name);
      } catch (e) { log('  ! rest failed for ' + a.name + ': ' + ((e && e.message) || e)); }
    });
    State.refreshAllDerived(session.state);
    if (rested.length) {
      log('  \u2014 the party makes camp and takes a long rest: ' + rested.join(', '));
      log('    ' + State.partyIds(session.state).map(id => {
        const p = session.state.actors[id];
        const sc = (p.derivedCache || {}).spellcasting;
        const slots = sc && sc.slotsRemaining
          ? Object.keys(sc.slotsRemaining).map(l => sc.slotsRemaining[l]).join('/')
          : '\u2014';
        return p.name + ' ' + p.runtime.hp + '/' + ((p.derivedCache || {}).hpMax || p.runtime.hpMax) +
          ' hp, slots ' + slots;
      }).join('   '));
    }
  }

  hr('play');

  /* Start a real encounter for the sandbox so initiative, the action economy
     and — crucially — the monsters' own turns are exercised. Without this the
     party takes turns hitting things that never hit back, which is a poor test
     of a combat engine. */
  let inEncounter = false;
  if (ARGS.campaign !== 'shen' || ARGS.encounter) {
    const combatants = Object.keys(session.state.actors).map(id => ({
      id,
      mod: (session.state.actors[id].derivedCache &&
        session.state.actors[id].derivedCache.initiative) || 0,
      dex: (session.state.actors[id].base &&
        session.state.actors[id].base.abilities &&
        session.state.actors[id].base.abilities.dex) || 10,
    }));
    try {
      const batch = Combat.beginEncounter(session.state, combatants, {});
      Events.commit(session.state, batch);
      inEncounter = !!(session.state.combat && session.state.combat.active);
      if (inEncounter) {
        log('  initiative: ' + (session.state.combat.order || [])
          .map(o => (session.state.actors[o.id] || {}).name + ' ' + o.total).join('  |  '));
        /* beginEncounter sets the order but does not open anybody's turn, so
           the first combatant has no action economy and no legal attacks. The
           loop owns turn boundaries; make the first one explicit. */
        const first = (session.state.combat.order || [])[0];
        if (first) {
          session.state.activeActorId = first.id;
          Events.commit(session.state, Combat.startTurn(session.state, first.id));
        }
      }
    } catch (e) {
      log('  ! could not start the encounter: ' + ((e && e.message) || e));
    }
  }

  /** Close this actor's turn and open the next one in the initiative order.
      Delegates to the engine, so the harness and the browser advance turns
      the same way — the harness having its own private turn loop is exactly
      how the product came to ship without one at all. */
  function nextInitiative(state, currentId) {
    try { Events.commit(state, Combat.endTurn(state, currentId)); } catch (e) { /* already closed */ }
    const r = Game.advanceTurn(session, {});
    return r && r.actorId;
  }

  for (let turn = 0; turn < ARGS.turns; turn++) {
    REPORT.turns++;

    /* Have we played far enough? Checked at the top so a run that reaches the
       target stops there rather than grinding out the remaining turns. */
    if (ARGS.untilLevel && partyAtLevel(session, ARGS.untilLevel)) {
      log('\n  the whole party has reached level ' + ARGS.untilLevel + '. That is what we came for.');
      break;
    }

    const actorId = session.state.activeActorId || seated[turn % seated.length];
    const actor = session.state.actors[actorId];
    if (!actor) break;

    const controller = State.controllerFor(session.state, actorId);
    const isSeat = seated.indexOf(actorId) >= 0;
    log('\n--- turn ' + (turn + 1) + ' \u2014 ' + actor.name +
      (isSeat ? '' : ' (' + controller.kind + ')') + ' ---');

    const t0 = Date.now();
    try {
      if (actor.runtime.dead) {
        log('  (down, skipped)');
      } else if (isSeat) {
        await Game.runAiSeat(session, actorId, {
          locationName: session.locationName,
          timeOfDay: session.timeOfDay,
          weather: session.weather,
          partyId: actorId,
        });
      } else {
        await Game.runNpcTurn(session, actorId, {
          locationName: session.locationName,
          timeOfDay: session.timeOfDay,
          weather: session.weather,
          partyId: seated[0],
        });
      }
    } catch (e) {
      REPORT.errors++;
      log('  ! turn threw: ' + ((e && e.message) || e));
    }
    REPORT.latencies.push(Date.now() - t0);

    /* ------------------------------------------------- expert interludes --
       Between turns, the things a real player does that are not moves: ask
       the Dungeon Master a question, ask to amend the record, and change who
       is travelling with them. Deliberately OUT of combat where possible, and
       never so often that the run becomes a chat. */
    if (ARGS.expert && isSeat && ARGS.interlude > 0) {
      /* Counted in the seat's OWN turns, not the absolute turn index. Keyed
         to the loop counter, an interlude only landed when the initiative
         happened to be on the player at that exact turn, so in a fight the
         amendment beat was skipped entirely and the run never exercised it. */
      expertTurns++;
      if (expertTurns % ARGS.interlude === 0) {
        const beat = expertTurns / ARGS.interlude;
        try {
          if (beat % 3 === 1) {
            await expertAsks(session, actorId);
          } else if (beat % 3 === 2) {
            await expertAmends(session, actorId);
          } else {
            /* Alternate joining and parting, so both paths are exercised. */
            const joining = (beat % 6 === 0);
            const changed = expertChangesParty(session, joining);
            if (!changed && !joining) log('\n  [party] nobody to part with just now.');
            await expertAsks(session, actorId);
          }
        } catch (e) {
          REPORT.errors++;
          log('  ! interlude threw: ' + ((e && e.message) || e));
        }
      }
    }

    /* Advance the initiative order if we are in an encounter; otherwise rotate
       the narrative spotlight between the seats. */
    if (inEncounter && session.state.combat && session.state.combat.active) {
      nextInitiative(session.state, actorId);
      State.advanceTurnEpoch(session.state);
    } else {
      const next = seated[(seated.indexOf(actorId) + 1) % seated.length];
      session.state.activeActorId = next;
      State.advanceTurnEpoch(session.state);
    }

    const alive = State.partyIds(session.state)
      .filter(id => session.state.actors[id].runtime.hp > 0).length;
    if (!alive) { log('\n  the party is down. Ending the run.'); break; }

    /* If the character we are actually playing is dead for good, the run is
       over as a test of playing them. Grinding on with the companions looks
       like progress in the log and measures nothing: the previous run spent
       seventy turns that way and reported the seated character stuck at a
       level they could no longer leave. */
    const deadSeat = seated.filter(id => {
      const a = session.state.actors[id];
      return !a || (a.runtime && a.runtime.dead);
    });
    if (deadSeat.length === seated.length) {
      log('\n  ' + deadSeat.map(id => (session.state.actors[id] || {}).name || id).join(', ') +
        ' is dead, and that is who we came to play. Ending the run.' +
        (ARGS.deathPolicy === 'heroic' ? '' :
          '\n  (a campaign played under --death-policy heroic would have left them stable instead)'));
      break;
    }
    const foes = State.livingEnemies(session.state).length;
    if (inEncounter && !foes) {
      log('\n  every enemy is down. The fight is over.');
      /* A long run needs more than one fight, both to be a plausible session
         and because a single encounter cannot award enough experience to
         reach a level. Each wave is a little harder than the last. */
      if (ARGS.waves > 1) {
        wavesFought++;
        if (wavesFought < ARGS.waves) {
          /* A short rest between waves. Without it the party is ground down
             by attrition and wipes on wave three, which tests nothing except
             that damage accumulates. Spending hit dice between fights is what
             a real party does and what the rules expect. */
          restBetweenWaves(session);
          /* Milestone levelling: a level for surviving the wave.
             This is how most tables actually run it, and it is explicitly how
             the Shen campaign was played ("milestone levelling, no XP
             tracked"). Experience is still awarded and still works; this just
             does not make a long run depend on grinding enough of it. */
          if (ARGS.milestone) {
            State.partyIds(session.state).forEach(id => {
              const a = session.state.actors[id];
              if (!a.progression || !a.base.classes || !a.base.classes.length) return;
              const current = (a.progression.levels || []).length;
              a.progression.levelGranted = Math.max(a.progression.levelGranted || 0, current + 1);
            });
            log('  \u2014 milestone: everyone who survived that has earned a level.');
          }
          const spawned = spawnWave(session, wavesFought);
          if (spawned.length) {
            log('  \u2014 something else is coming: ' +
              spawned.map(id => session.state.actors[id].name).join(', '));
            const combatants2 = Object.keys(session.state.actors)
              .filter(id => !session.state.actors[id].runtime.dead)
              .map(id => ({
                id,
                mod: (session.state.actors[id].derivedCache &&
                  session.state.actors[id].derivedCache.initiative) || 0,
                dex: (session.state.actors[id].base && session.state.actors[id].base.abilities &&
                  session.state.actors[id].base.abilities.dex) || 10,
              }));
            try {
              Events.commit(session.state, Combat.beginEncounter(session.state, combatants2, {}));
              const first = (session.state.combat.order || [])[0];
              if (first) {
                session.state.activeActorId = first.id;
                Events.commit(session.state, Combat.startTurn(session.state, first.id));
              }
              inEncounter = true;
              continue;
            } catch (e) { log('  ! could not start the next wave: ' + ((e && e.message) || e)); }
          }
        } else {
          log('  that was the last of them.');
        }
      }
      inEncounter = false;
    }
  }

  /* ------------------------------------------------------------- reporting */
  hr('result');
  const d = State.digest(session.state);
  d.party.forEach(p => {
    log('  ' + p.name.padEnd(22) + ' ' + String(p.hp).padStart(3) + '/' + p.hpMax + ' hp' +
      (p.conditions.length ? '   [' + p.conditions.join(', ') + ']' : '') +
      '   ' + p.items + ' items, ' + p.gold + ' gold');
  });
  log('');
  log('  turns attempted     ' + REPORT.turns);
  log('  commands committed  ' + REPORT.committed);
  log('  refused             ' + REPORT.refused + (REPORT.stale ? ' (' + REPORT.stale + ' stale)' : ''));
  log('  errors              ' + REPORT.errors);
  log('  narrations          ' + REPORT.narrations +
    ' (' + REPORT.offlineNarrations + ' offline, ' + REPORT.gated + ' gated)');
  if (Object.keys(REPORT.gateHits).length) {
    log('  gate hits           ' + Object.keys(REPORT.gateHits)
      .map(k => k + ' x' + REPORT.gateHits[k]).join(', '));
  }
  log('  seat decisions      ' + REPORT.modelChoices + ' by model, ' +
    REPORT.policyChoices + ' by fallback policy');
  REPORT.latencies.sort((a, b) => a - b);
  log('  median turn         ' + (REPORT.latencies[Math.floor(REPORT.latencies.length / 2)] || 0) + 'ms');
  log('  transcript lines    ' + d.transcriptLines);
  log('');

  if (ARGS.expert) {
    hr('what the expert did besides taking turns');
    log('  questions asked     ' + EXPERT.asked + ' (' + EXPERT.answered + ' answered by the DM)');
    log('  amendments asked    ' + EXPERT.amendsAsked +
      ' \u2014 ' + EXPERT.amendsAllowed + ' allowed, ' + EXPERT.amendsRefused + ' refused, ' +
      EXPERT.amendsApplied + ' applied');
    log('  companions joined   ' + EXPERT.recruited);
    log('  companions parted   ' + EXPERT.dismissed);
    log('  levels reached      ' + State.partyIds(session.state).map(id => {
      const p = session.state.actors[id];
      return p.name + ' ' + ((p.derivedCache || {}).level || 1);
    }).join(', '));
    log('  amendments on record ' + (session.state.retcons || []).length);
    (session.state.retcons || []).forEach(r => log('    \u00b7 ' + r.summary));
    if (EXPERT.badAnswers.length) {
      log('');
      log('  *** ' + EXPERT.badAnswers.length + ' POOR ANSWER(S) ***');
      EXPERT.badAnswers.forEach(b => log('    - (' + b.why + ') ' + b.question + '\n      ' + b.text));
    } else if (EXPERT.asked) {
      log('  every question got a real answer from the model \u2713');
    }
    if (EXPERT.notes.length) EXPERT.notes.forEach(n => log('  note: ' + n));
    log('');
  }
  if (REPORT.leaks.length) {
    log('  *** ' + REPORT.leaks.length + ' SECRET LEAK(S) DETECTED ***');
    REPORT.leaks.forEach(l => log('    - ' + l.observer + ': "' + l.term + '" from ' + l.factId));
  } else {
    log('  no secret leaks detected \u2713');
  }

  /* ---------------------------------------------------------------- export */
  if (!ARGS.noExport) {
    hr('export');
    try {
      const res = await Save.exportToServer(session, {
        note: 'playtest ' + ARGS.campaign + ' seats=' + ARGS.seats + ' turns=' + REPORT.turns +
          ' players=' + ARGS.backend + '/' + ARGS.model + ' dm=' + ARGS.dm +
          (ARGS.label ? ' [' + ARGS.label + ']' : ''),
        filename: 'playtest-' + ARGS.campaign + '-' + ARGS.seats + 'p' +
          (ARGS.label ? '-' + ARGS.label : '') + '-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16),
      });
      if (res && res.ok) {
        (res.written || []).forEach(w => log('  wrote ' + w.file + '  (' + w.bytes + ' bytes)'));
        log('  in ' + res.dir);
      } else {
        log('  export failed: ' + JSON.stringify(res));
      }
    } catch (e) {
      log('  export failed: ' + ((e && e.message) || e));
    }
  }

  hr();
  const healthy = REPORT.errors === 0 && REPORT.leaks.length === 0 && REPORT.committed > 0;
  log('  ' + (healthy ? 'Run completed cleanly.' : 'Run completed WITH PROBLEMS \u2014 see above.'));
  log('');
  /* Set the code and let the process end on its own. Calling process.exit()
     here tore the loop down while stdout still had buffered writes in flight,
     and on Windows that surfaces as a libuv assertion —
     "!(handle->flags & UV_HANDLE_CLOSING)" — and an exit code of 0xC0000409.
     It looked exactly like the run had crashed after reporting success, and it
     only happened when the output was piped, which is how it is usually read. */
  process.exitCode = healthy ? 0 : 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
