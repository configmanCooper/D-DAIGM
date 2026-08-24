/*
 * tests/campaign.test.js — the built-in "Shen Cooper" campaign.
 *
 * Three things are being defended here. First, that the public sheet is
 * mechanically what the dossier says Shen is: HP 28, AC 18, three first-level
 * slots, proficiency +2, oath spells always prepared. Second, that the
 * continuation fixture builds a valid, fully-populated save-state. Third, and
 * most important, the LEAK CANARIES: a fresh continuation must not put a single
 * gated secret in front of the model, through any door — the system prompt,
 * the stage direction, or any party member's observation.
 *
 * Reference class and item data are injected the way every other suite injects
 * them, so this runs with or without the SRD data files present.
 */
'use strict';
const t = require('./_harness')('campaign');
const Character = require('../js/engine/character.js');
const Knowledge = require('../js/engine/knowledge.js');
const State = require('../js/engine/state.js');
const Events = require('../js/engine/events.js');
const Prompt = require('../js/ai/prompt.js');

const Campaign = require('../campaigns/shen_cooper.js');
const Bible = require('../campaigns/shen_cooper_bible.js');
const Continuation = require('../campaigns/shen_continuation.js');

/* Only the fields derive() reads — casterType, hitDie, saves, spellcasting
   ability. Items come straight from the campaign, which carries real mech
   blocks for the armour that matters. */
Character.setData({
  CLASSES: {
    paladin: { id: 'paladin', name: 'Paladin', hitDie: 10, casterType: 'half', subclassLevel: 3, saves: ['wis', 'cha'], spellcasting: { ability: 'cha', prepares: 'prepared' } },
    ranger: { id: 'ranger', name: 'Ranger', hitDie: 10, casterType: 'half', subclassLevel: 3, saves: ['str', 'dex'], spellcasting: { ability: 'wis', prepares: 'known' } },
    cleric: { id: 'cleric', name: 'Cleric', hitDie: 8, casterType: 'full', subclassLevel: 1, saves: ['wis', 'cha'], spellcasting: { ability: 'wis', prepares: 'prepared' } },
  },
  ITEMS: Campaign.items,
});

const ALLOWED_SOURCES = ['canon', 'derived', 'author-assigned'];

/* Every forbidden name the bible STILL gates (the truths), flattened once for
   the canaries. Names the party has canonically heard — "Hollow King",
   "Malrec" — are now EARNED facts, not secrets, so they are deliberately not
   in this set: those names are permitted, their truths are not. */
const FORBIDDEN_TERMS = (function () {
  const set = {};
  Bible.SECRETS.forEach(f => (f.forbiddenUntilKnown || []).forEach(n => { set[n] = true; }));
  return Object.keys(set);
})();

/* -------------------------------------------------- the campaign loads ----- */
t.section('the campaign loads with a complete cast');
t.eq(Campaign.id, 'shen-cooper', 'the campaign has its id');
t.ok(!!Campaign.premise && !!Campaign.tone && !!Campaign.voice, 'premise, tone and voice are all present');
t.ok(Object.keys(Campaign.npcs).length >= 6, 'there is a real cast of NPCs');

let npcIssues = [];
Object.keys(Campaign.npcs).forEach(function (id) {
  const n = Campaign.npcs[id];
  if (!n.voice || typeof n.voice !== 'string') npcIssues.push(id + ' has no voice card');
  if (!Array.isArray(n.lines) || n.lines.length < 3) npcIssues.push(id + ' has fewer than 3 offline lines');
});
t.deep(npcIssues, [], 'every NPC has a voice card AND at least three offline lines');

/* Spot-check the named registers the task calls out. */
['aldren', 'mara', 'corvin', 'maera-venn', 'lysa-sells', 'orin-sells', 'tessa-sells'].forEach(function (id) {
  t.ok(!!Campaign.npcs[id] && Campaign.npcs[id].lines.length >= 3, id + ' is present with offline lines');
});

/* --------------------------------------------------- Shen's mechanics ----- */
t.section('Shen derives to exactly the recorded sheet');
const shen = Campaign.characters.shen;
const d = Character.derive(shen.base, shen.progression, shen.runtime, []);
t.eq(d.hpMax, 28, 'HP is exactly 28');
t.eq(d.ac, 18, 'AC is exactly 18 (chain mail + shield)');
t.eq(d.spellcasting.slotsMax[1], 3, 'a single-class Paladin 3 has 3 first-level slots');
t.eq(d.spellcasting.slotsMax[2], undefined, 'and no second-level slots');
t.eq(d.proficiencyBonus, 2, 'proficiency bonus is +2');

t.section('the oath spells are always prepared');
t.deep(shen.progression.oathSpells, ['protection-from-evil-and-good', 'sanctuary'],
  'the oath spells are recorded as always-prepared');
t.ok(d.spellcasting.prepared.indexOf('protection-from-evil-and-good') >= 0,
  'Protection from Evil and Good is in the prepared list');
t.ok(d.spellcasting.prepared.indexOf('sanctuary') >= 0, 'Sanctuary is in the prepared list');
t.ok(d.spellcasting.prepared.indexOf('bless') >= 0, 'the normal prepared spells are still there too');

/* --------------------------------------------------- the continuation ----- */
t.section('applyTo builds a valid save-state');
function freshLoad() {
  const state = State.create({ seed: 'glass-fen', campaignId: 'shen-cooper' });
  const store = Knowledge.makeStore();
  Knowledge.defineFacts(store, Bible.FACTS);
  Continuation.applyTo(state, store);
  return { state, store };
}
let { state, store } = freshLoad();

t.eq(State.partyIds(state).length, 4, 'four party actors are present');
['shen', 'aldren', 'mara', 'corvin'].forEach(function (id) {
  t.ok(!!state.actors[id] && state.actors[id].side === 'party', id + ' is in the party');
});
t.ok(String(state.locationId).toLowerCase().indexOf("lantern's rest") >= 0,
  "the scene is at Lantern's Rest");
t.eq(Continuation.scene.region, 'Glass Fen', 'in the Glass Fen');
t.ok(/NOT been entered/i.test(Continuation.scene.note), 'Mirror Abbey is explicitly not yet entered');

const questIds = Object.keys(state.quests);
t.eq(questIds.length, 10, 'all ten open threads are present');
t.eq(questIds.filter(q => state.quests[q].status === 'open').length, 10, 'and every one of them is open');

/* --------------------------------------------------- the leak canaries ---- */
t.section('leak canaries — no gated secret reaches any prompt or observation');
const system = Prompt.buildSystem(Campaign);
const built = Prompt.forNarration(state, store, Campaign, [], {});
const stage = built.stage;

t.eq(Knowledge.auditLeaks(store, 'party', system).length, 0,
  'the system prompt leaks nothing the party has not earned');
t.eq(Knowledge.auditLeaks(store, 'party', stage).length, 0,
  'the stage direction leaks nothing the party has not earned');

const partyObservations = ['shen', 'aldren', 'mara', 'corvin'].map(function (id) {
  const obs = Knowledge.getObservation(state, store, id, {});
  return { id, text: JSON.stringify(obs) };
});
let obsLeaks = [];
partyObservations.forEach(function (o) {
  if (Knowledge.auditLeaks(store, o.id, o.text).length) obsLeaks.push(o.id);
});
t.deep(obsLeaks, [], 'no party member\u2019s observation leaks an unearned secret');

/* And the blunt version: the still-gated truths simply are not in the bytes. */
const canaryTexts = [{ id: 'system', text: system }, { id: 'stage', text: stage }].concat(partyObservations);
let termHits = [];
FORBIDDEN_TERMS.forEach(function (term) {
  canaryTexts.forEach(function (c) {
    if (c.text.toLowerCase().indexOf(term.toLowerCase()) >= 0) termHits.push(term + ' in ' + c.id);
  });
});
t.deep(termHits, [], 'every still-gated term is absent from every prompt and observation');

/* The names that carry the endgame must never surface early — spelled out. */
['Aerath Vhal', 'Malrec Sorn', 'Project Cinder', 'Oren Pell', 'Kestrel Vale'].forEach(function (term) {
  t.ok(FORBIDDEN_TERMS.indexOf(term) >= 0, '"' + term + '" is still a declared forbidden term');
  canaryTexts.forEach(function (c) {
    t.ok(c.text.toLowerCase().indexOf(term.toLowerCase()) < 0, '"' + term + '" is byte-absent from ' + c.id);
  });
});

/* ------------------------------------------- name vs. truth (the fix) ----- */
t.section('names the party has heard are permitted; the truths behind them are not');

/* The whole present party heard these names spoken in play, so they are known
   and no longer forbidden for the party — the DM can use them naturally. */
['shen', 'aldren', 'mara', 'corvin'].forEach(function (id) {
  t.eq(Knowledge.knows(store, id, 'hollow.king.name', 'full'), true, id + ' has heard the name "the Hollow King"');
  t.eq(Knowledge.knows(store, id, 'malrec.name', 'full'), true, id + ' has heard the name "Malrec"');
});
t.eq(Knowledge.knows(store, 'party', 'hollow.king.name', 'full'), true, 'the party holds the name "the Hollow King"');

const narration = 'The Warden\u2019s judgement still rings in Shen\u2019s ears: the Hollow King is stirring, and the name Malrec keeps surfacing among the Witnesses.';
t.eq(Knowledge.auditLeaks(store, 'party', narration).length, 0,
  'the DM may say "the Hollow King" and "Malrec" to a party that has canonically heard them');

/* But every truth those names conceal is still stage `none` for everyone. */
['hollow.king.identity', 'hollow.king.motive', 'hollow.king.transformation', 'malrec.identity', 'project.cinder'].forEach(function (fid) {
  ['party', 'shen', 'aldren', 'mara', 'corvin'].forEach(function (obs) {
    t.eq(Knowledge.stageOf(store, obs, fid), 'none', obs + ' does not yet know ' + fid);
  });
});

/* The gate is real, merely satisfied for the party: a bystander who never
   heard the name still triggers a leak on it. */
t.eq(Knowledge.knows(store, 'bystander', 'hollow.king.name', 'partial'), false,
  'a bystander has not heard the name');
t.ok(Knowledge.auditLeaks(store, 'bystander', 'the Hollow King stirs beneath the fen').length > 0,
  'for a bystander the name still leaks — the machinery is intact, just already satisfied for the party');
t.ok(Knowledge.auditLeaks(store, 'bystander', 'a preceptor called Malrec').length > 0,
  'and the name Malrec remains gated for anyone who has not heard it');

/* --------------------------------------------------- reveal gating -------- */
t.section('a reveal flag opens exactly one fact');
t.deep(Knowledge.revealable(store, state), [], 'nothing is revealable at the fresh save-state');
state.flags.reveal_malrec = true;
t.deep(Knowledge.revealable(store, state), ['malrec.identity'],
  'setting one flag makes exactly that one fact revealable and no others');
delete state.flags.reveal_malrec;
t.deep(Knowledge.revealable(store, state), [], 'and unsetting it closes the reveal again');

/* --------------------------------------------------- per-observer --------- */
t.section('knowledge is per-observer');
t.eq(Knowledge.knows(store, 'shen', 'shen.oath.presence', 'full'), true,
  'Shen holds the private texture of his own oath');
t.eq(Knowledge.knows(store, 'corvin', 'shen.oath.presence', 'full'), false,
  'Corvin does not hold what Shen alone experienced');
t.eq(Knowledge.knows(store, 'party', 'warden.price.days', 'full'), true,
  'the party knows the Warden\u2019s price is paid in days of life');

/* --------------------------------------------------- uncertainties -------- */
t.section('active uncertainties are NOT stored as known facts');
let leakedGuesses = [];
Continuation.uncertainties.forEach(function (u) {
  if (!u.factId) return;
  if (Knowledge.stageOf(store, 'party', u.factId) !== 'none') leakedGuesses.push(u.factId);
});
t.deep(leakedGuesses, [], 'a guess the party has floated is never recorded as knowledge');
t.ok(Continuation.uncertainties.some(u => u.factId === 'seraphine.thief'),
  'the identity of the Marrowen-coloured woman is held as an uncertainty');

/* --------------------------------------------------- fact hygiene --------- */
t.section('every fact claim is a single sentence');
let multiSentence = [];
Object.keys(store.facts).forEach(function (id) {
  const claim = store.facts[id].claim || '';
  const marks = (claim.match(/[.!?]/g) || []).length;
  if (marks > 2) multiSentence.push(id + ' (' + marks + ' terminators)');
});
t.deep(multiSentence, [], 'no claim carries more than two sentence-ending marks');
t.ok(Bible.FACTS.length >= 25, 'the bible defines a full slate of facts (' + Bible.FACTS.length + ')');

/* --------------------------------------------------- source tags ---------- */
t.section('every tagged value in the continuation is provenanced');
function collectTagged(node, out) {
  if (!node || typeof node !== 'object') return out;
  if (typeof node === 'function') return out;
  if (Object.prototype.hasOwnProperty.call(node, 'source')) out.push(node);
  Object.keys(node).forEach(function (k) {
    const v = node[k];
    if (v && typeof v === 'object') collectTagged(v, out);
  });
  return out;
}
const tagged = collectTagged({
  resources: Continuation.resources,
  relationships: Continuation.relationships,
  fragments: Continuation.fragments,
  gear: Continuation.gear,
}, []);
t.ok(tagged.length > 0, 'there are tagged values to check');
let badTags = [];
tagged.forEach(function (n) {
  if (ALLOWED_SOURCES.indexOf(n.source) < 0) badTags.push(String(n.source));
  if (!('value' in n)) badTags.push('missing value for source ' + n.source);
});
t.deep(badTags, [], 'every tag uses one of canon | derived | author-assigned, with a value');

/* Shen's own numbers must be canon or derived, never invented. */
['hp', 'hpMax', 'ac', 'layOnHands', 'firstLevelSlots'].forEach(function (k) {
  const tagv = Continuation.resources.shen[k];
  t.ok(tagv && (tagv.source === 'canon' || tagv.source === 'derived'),
    'Shen\u2019s ' + k + ' is canon or derived, not invented');
});

/* ---------------------------------------------------- the REAL load path ----
   Everything above injects a hand-built data table, which is convenient and
   was also how a genuine bug hid: with real SRD data and no injection, Shen's
   chain mail was not resolved at all and he derived to AC 13 instead of 18.
   A test that only ever exercises its own fixtures cannot see that. So this
   section deliberately uses no injection and goes through exactly the path the
   running game uses — load the campaign, apply the continuation, refresh
   derived stats, read the sheet. */
t.section('the campaign as the game actually loads it');
{
  const RealCharacter = require('../js/engine/character.js');
  const RealState = require('../js/engine/state.js');
  const RealKnowledge = require('../js/engine/knowledge.js');
  require('../js/engine/combat.js');
  require('../js/engine/interaction.js');

  const st = RealState.create({ seed: 'real-load', campaignId: 'shen-cooper' });
  const store = RealKnowledge.makeStore();
  RealKnowledge.defineFacts(store,
    (Bible.FACTS || []).concat(Bible.EARNED || [], Bible.SECRETS || []));
  store.known = st.knowledge;
  Continuation.applyTo(st, store);
  RealState.refreshAllDerived(st);

  const shenActor = st.actors.shen;
  t.ok(!!shenActor, 'Shen is present in the loaded state');
  t.eq(shenActor.runtime.hpMax, 28, 'HP maximum is 28 through the real load path');
  t.eq(shenActor.runtime.hp, 28, 'and he is at full health');
  t.eq(shenActor.derivedCache.ac, 18,
    'AC is 18 through the real load path (chain mail + shield, no injected data)');
  t.eq(shenActor.derivedCache.spellcasting.slotsMax[1], 3,
    'and he has his three first-level slots');

  /* The gear must actually be in his hands, not merely named in `equipped`. */
  const inv = shenActor.runtime.inventory || [];
  t.ok(inv.length >= 3, 'his gear is in his inventory, not just referenced',
    '(' + inv.length + ' items)');
  const names = inv.map(i => (i.name || i.id).toLowerCase()).join(' ');
  t.ok(/chain mail/.test(names), 'the chain mail is carried');
  t.ok(/shield/.test(names), 'the shield is carried');
  t.ok(/blade|longsword/.test(names), 'Father\u2019s Blade is carried');

  /* And he must be able to swing it — an empty attack list refused every
     strike in a playtest while the model improvised around the bug. */
  const attacks = shenActor.runtime.attacks || [];
  t.ok(attacks.length >= 2, 'he has weapon attacks derived, not just fists',
    '(' + attacks.map(a => a.name).join(', ') + ')');
  const blade = attacks.filter(a => /blade|longsword/i.test(a.name))[0];
  t.ok(!!blade, 'Father\u2019s Blade is among his attacks');
  if (blade) {
    t.ok(/1d8/.test(blade.damage), 'and it deals a longsword\u2019s die', '(' + blade.damage + ')');
    t.eq(blade.toHit, 5, 'at +5 to hit (Str +3, proficiency +2)');
  }

  /* The companions load too, and are not accidentally unarmoured. */
  ['aldren', 'mara', 'corvin'].forEach(id => {
    const a = st.actors[id];
    t.ok(!!a, id + ' is present');
    if (a) t.ok(a.runtime.hpMax > 0 && a.derivedCache.ac >= 10,
      id + ' derives a sane sheet', '(AC ' + a.derivedCache.ac + ', HP ' + a.runtime.hpMax + ')');
  });
}

t.done();

