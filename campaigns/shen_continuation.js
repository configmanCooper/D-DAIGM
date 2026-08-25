/*
 * shen_continuation.js — the hand-authored save-state fixture.
 *
 * The dossier is explicit (§11) that the play records do NOT give exact
 * companion resources, so this file follows one iron rule: every number is
 * tagged with where it came from.
 *
 *   { value: 28, source: 'canon' }           stated in the records
 *   { value: 4,  source: 'derived' }          computed from the stated rules
 *   { value: 52, source: 'author-assigned' }  a reasonable invention, flagged
 *
 * The scene endpoint is fixed and load-bearing: Lantern's Rest, Glass Fen,
 * immediately after examining the Sells family and confirming the
 * perception-distortion phenomenon. Mirror Abbey has NOT been entered.
 *
 * applyTo(state, store) populates a State.create() game with all of the below,
 * routing every knowledge change through Knowledge.learnEvent + Events.commit
 * (the only sanctioned path) and every relationship, quest, flag, and position
 * through an Events batch. It never writes to the knowledge store directly.
 */
(function (global) {
  'use strict';

  var Knowledge = (global.DND && global.DND.Knowledge) ||
    (typeof require !== 'undefined' ? require('../js/engine/knowledge.js') : null);
  var Events = (global.DND && global.DND.Events) ||
    (typeof require !== 'undefined' ? require('../js/engine/events.js') : null);
  var State = (global.DND && global.DND.State) ||
    (typeof require !== 'undefined' ? require('../js/engine/state.js') : null);
  var Campaign = (global.DND && global.DND.Campaigns && global.DND.Campaigns.shenCooper) ||
    (typeof require !== 'undefined' ? require('./shen_cooper.js') : null);
  var Bible = (global.DND && global.DND.Campaigns && global.DND.Campaigns.shenCooperBible) ||
    (typeof require !== 'undefined' ? require('./shen_cooper_bible.js') : null);

  function tag(value, source) { return { value: value, source: source }; }
  function val(x) { return (x && typeof x === 'object' && 'value' in x) ? x.value : x; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ----------------------------------------------------------- the scene -- */

  var scene = {
    locationId: "lantern's rest",
    region: 'Glass Fen',
    timeOfDay: 'grey noon',
    weather: 'cold mist',
    note: 'Immediately after examining the Sells family and confirming that the Fen distorts real-time perception, not only memory. Mirror Abbey has NOT been entered; the Third Seal Binding has NOT been attempted. This is the immediate next scene.',
  };

  /* The last ~10 beats, player-safe, in order. */
  var recap = [
    'The party learned that the enemy has been tracking the stolen Cooper decoy, not the true fragment, and followed its trace east and then north.',
    'At Redwater Crossing, Ser Garrick Vael\u2019s fragment was confirmed to be the genuine eastern fragment; Shen refused to concentrate the Steel and arranged a three-party divided custody to Greyhaven, covered by a decoy departure.',
    'The decoy\u2019s trace split, and Shen took his own party north to Blackharrow Keep while Vale\u2019s team went east.',
    'Infiltrating Blackharrow through a collapsed wall, the party overheard that the enemy knows the Cooper fragment is a decoy and is deliberately exploiting its trace.',
    'They rescued the prisoner Lady Adriana Veyron, who had seen black-silver Steel handed to a woman in Marrowen colours; the hostile faction let the party escape on purpose.',
    'At Hearthmere the party reasoned that the enemy wants Shen moving and learning, not dead, and recommitted to keeping fragment custody distributed.',
    'Travelling into Glass Fen, Shen\u2019s mark warmed as they neared Lantern\u2019s Rest, where he met the Lantern Keeper Maera Venn privately and revealed his mark.',
    'Shen and Maera concluded that Mirror Abbey is almost certainly the Third Seal, with the Lantern Kin as its Watch, and that its renewal has not succeeded in thirty-one years.',
    'The party found dangerous wording-drift in the Lantern Kin ritual texts, a torn ledger page, and seven households who now deny the tradition ever existed.',
    'They ran controlled perception tests and then examined the Sells family directly, confirming the Fen distorts real-time perception, and devised a rigorous Six-Witness Protocol before daring Mirror Abbey.',
  ];

  /* ----------------------------------------------------------- the party -- */

  var party = [
    { id: 'shen', name: 'Shen Cooper', role: 'the Keeper, Paladin 3' },
    { id: 'aldren', name: 'Sir Aldren Vey', role: 'field mentor' },
    { id: 'mara', name: 'Dame Mara Thorne', role: 'scout and overwatch' },
    { id: 'corvin', name: 'Brother Corvin Hale', role: 'healer' },
  ];

  var elsewhere = [
    { id: 'elowen', name: 'Sister Elowen Veyra', where: 'Saint Orien\u2019s Watch', why: 'rebuilding the Second Seal\u2019s Watch and hunting the internal saboteur.' },
    { id: 'matthias', name: 'Brother Matthias', where: 'Saint Orien\u2019s Watch', why: 'recovering the Vigil after the breach.' },
    { id: 'eamon', name: 'Brother Eamon', where: 'Saint Orien\u2019s Watch', why: 'recovering after captivity.' },
    { id: 'commander-vale', name: 'Commander Seraphine Vale', where: 'Dunmere', why: 'coordinating security and holding Fragment One.' },
    { id: 'garrick', name: 'Ser Garrick Vael', where: 'the road to Greyhaven', why: 'carrying the eastern fragment in a warded case.' },
    { id: 'calen', name: 'Calen Rusk', where: 'the eastern trail', why: 'independently tailing a Witness courier.' },
    { id: 'adriana', name: 'Lady Adriana Veyron', where: 'Hearthmere', why: 'safe with Master Pellan after her rescue.' },
  ];

  /* ------------------------------------------------------- known clues ----
     Every clue the party publicly holds, with who learned it and how. None of
     these name a gated secret; the deductions they point at are recorded as
     uncertainties below and are NOT stored as known facts. */

  var clues = [
    { text: 'The stolen Saint Orien fragment is believed to have been carried to Mirror Abbey by a woman in Marrowen colours.', provenance: { who: 'Lady Adriana Veyron and Maera Venn', how: 'eyewitness testimony, timelines matched \u2014 unconfirmed.' } },
    { text: 'A recurring personal name and a code-word surface in the hostile Witnesses\u2019 papers, pointing to an internal conspiracy.', provenance: { who: 'the party', how: 'overheard at Blackharrow and read on a torn ledger page.' } },
    { text: 'The eastern fragment is genuine and is en route to Greyhaven under a three-party divided custody.', provenance: { who: 'Calen Rusk and the party', how: 'break and dimensions confirmed it was not the Saint Orien piece.' } },
    { text: 'The enemy knows the Cooper fragment they are tracking is a decoy and is exploiting its trace on purpose.', provenance: { who: 'the party', how: 'overheard directly at Blackharrow Keep.' } },
    { text: 'Seven Lantern\u2019s Rest households now deny that the lantern tradition, or even Mirror Abbey, ever existed.', provenance: { who: 'Maera Venn', how: 'reported by the Lantern Keeper and verified door to door.' } },
    { text: 'The Glass Fen distorts living memory and real-time perception, not merely written records.', provenance: { who: 'the party', how: 'controlled tests, then the Sells family perceived mutually exclusive states of one lantern.' } },
    { text: 'Mirror Abbey\u2019s Binding needs three independent witnesses stating the same observed truth and is vulnerable to false consensus.', provenance: { who: 'Maera Venn and the party', how: 'Lantern Kin lore reconciled with the Anchor / Binding / Watch framework.' } },
    { text: 'Something genuinely Warden-linked lies beneath Blackharrow Keep, since Shen\u2019s mark reacted where a mere decoy should not.', provenance: { who: 'the party', how: 'Shen\u2019s mark reacted, and the continuity was corrected in-session.' } },
  ];

  /* The safety procedure the party devised before daring Mirror Abbey. */
  var sixWitnessProtocol = [
    'Six independent witnesses, screened before entry.',
    'Each observes alone, with no pre-discussion of what they expect to see.',
    'Every observation is tied to a physical anchor that can be checked afterward.',
    'Reserves are held back and never all committed at once.',
    'Any disagreement halts the ritual immediately rather than being reconciled on the spot.',
    'Truth spoken together must first be seen apart.',
  ];

  /* ------------------------------------------------------ fragment table -- */

  var fragments = {
    one: { name: 'Cooper Fragment', status: tag('real piece secure in the Dunmere reliquary under divided access; the decoy was stolen and its trace is being exploited.', 'canon') },
    two: { name: 'Saint Orien Fragment', status: tag('stolen before Shen arrived; believed but not confirmed to have been carried to Mirror Abbey.', 'canon') },
    three: { name: 'Eastern Fragment', status: tag('recovered at Redwater Crossing; en route to Greyhaven under three-party divided custody.', 'canon') },
    four: { name: 'Crownless Fragment', status: tag('not encountered; whereabouts unknown to the party.', 'canon') },
  };

  /* ------------------------------------------------------------ quests ----
     All ten open threads from §11. Titles are fixture-side only; the engine's
     observation exposes quest status, never titles. */

  var quests = [
    { id: 'screen-witnesses', title: 'Screen and select witnesses for a safe Third Seal Binding.', status: 'open' },
    { id: 'restore-lantern-watch', title: 'Determine whether the Lantern Kin Watch can be restored.', status: 'open' },
    { id: 'locate-fragment-two', title: 'Locate the exact current position of the Saint Orien fragment.', status: 'open' },
    { id: 'identify-conspiracy', title: 'Identify the internal Veiled Witness conspiracy.', status: 'open' },
    { id: 'identify-marrowen-woman', title: 'Determine the identity of the woman in Marrowen colours.', status: 'open' },
    { id: 'blackharrow-presence', title: 'Investigate the Warden-linked presence beneath Blackharrow Keep.', status: 'open' },
    { id: 'deliver-fragment-three', title: 'Complete the eastern fragment\u2019s safe delivery to Greyhaven.', status: 'open' },
    { id: 'saint-oriens-saboteur', title: 'Support Elowen\u2019s hunt for the Saint Orien\u2019s saboteur.', status: 'open' },
    { id: 'secure-fragment-four', title: 'Long term: locate and secure the last fragment and understand a whole Steel.', status: 'open' },
    { id: 'enter-mirror-abbey', title: 'Enter Mirror Abbey and attempt the Third Seal Binding \u2014 not yet begun.', status: 'open' },
  ];

  /* --------------------------------------------------------- resources ----
     Shen's are canon or derive from stated rules. Companion pools are tagged
     author-assigned exactly because the records withhold them (§11). */

  var resources = {
    shen: {
      hp: tag(28, 'canon'), hpMax: tag(28, 'canon'),
      ac: tag(18, 'canon'),
      layOnHands: tag(15, 'canon'),
      firstLevelSlots: tag(3, 'canon'),
      channelDivinity: tag(1, 'derived'),
      lifespanDaysSpent: tag(1, 'canon'),
    },
    aldren: {
      hp: tag(52, 'author-assigned'), hpMax: tag(52, 'author-assigned'),
      layOnHands: tag(30, 'derived'),
      firstLevelSlots: tag(4, 'derived'), secondLevelSlots: tag(2, 'derived'),
      channelDivinity: tag(1, 'derived'),
    },
    mara: {
      hp: tag(44, 'author-assigned'), hpMax: tag(44, 'author-assigned'),
      firstLevelSlots: tag(4, 'derived'), secondLevelSlots: tag(2, 'derived'),
    },
    corvin: {
      hp: tag(38, 'author-assigned'), hpMax: tag(38, 'author-assigned'),
      firstLevelSlots: tag(4, 'derived'), secondLevelSlots: tag(3, 'derived'), thirdLevelSlots: tag(2, 'derived'),
      channelDivinity: tag(1, 'derived'),
    },
  };

  /* ------------------------------------------------------ relationships ---
     Directional companion regard for Shen. The records give the shape of these
     bonds but no numbers, so every axis is author-assigned; the `because` is
     drawn from the play record. */

  var relationships = [
    {
      fromId: 'aldren', toId: 'shen',
      affinity: tag(45, 'author-assigned'), trust: tag(50, 'author-assigned'),
      respect: tag(55, 'author-assigned'), fear: tag(0, 'author-assigned'),
      because: 'Mentor turned believer: Aldren has watched Shen grow from a nervous recruit into a real paladin, witnessed his oath, and now worries the order will treat him as an asset.',
    },
    {
      fromId: 'mara', toId: 'shen',
      affinity: tag(30, 'author-assigned'), trust: tag(40, 'author-assigned'),
      respect: tag(45, 'author-assigned'), fear: tag(0, 'author-assigned'),
      because: 'Won over from suspicion by Shen\u2019s civilian-first caution; she still reserves the right to challenge an overbold plan, and does.',
    },
    {
      fromId: 'corvin', toId: 'shen',
      affinity: tag(50, 'author-assigned'), trust: tag(45, 'author-assigned'),
      respect: tag(40, 'author-assigned'), fear: tag(0, 'author-assigned'),
      because: 'Friend and healer; central to the supernatural investigations and increasingly, quietly alarmed at what the Warden keeps costing Shen.',
    },
  ];

  /* -------------------------------------------------------- who knows what -
     Which facts each observer holds at the save-state, and the party aggregate
     used by the DM view. Only earned, non-spoiler facts appear here; every
     gated secret is absent by construction. Shen and Aldren additionally hold
     the private texture of the oath, which Corvin and Mara do not. */

  var earnedGeneral = [
    'keeper.mark', 'warden.exists', 'seals.count', 'warden.price.exists',
    'warden.price.days', 'second.seal.restored', 'deeper.will', 'steel.divided.rule',
    /* Names the whole present party heard spoken but cannot yet explain: the
       Warden named the Hollow King at Saint Orien\u2019s, and hostile Witnesses
       named "Malrec" within the party\u2019s hearing at Blackharrow. Everything
       those names conceal stays gated in the bible. */
    'hollow.king.name', 'malrec.name',
  ];

  var knowledge = {
    party: earnedGeneral.slice(),
    shen: earnedGeneral.concat(['shen.oath.presence']),
    aldren: earnedGeneral.concat(['shen.oath.presence']),
    mara: earnedGeneral.slice(),
    corvin: earnedGeneral.slice(),
  };

  /* Per-companion sense of what they do and do not know, for the DM's voice. */
  var npcKnowledge = {
    shen: {
      knows: 'That he is the Keeper, that waking the Warden cost him a day of his life, that the Warden named the enemy behind the seals the Hollow King, that a name \u2014 Malrec \u2014 recurs among the hostile Witnesses, and that Mirror Abbey is almost certainly the Third Seal.',
      doesNotKnow: 'Who the Hollow King once was, who Malrec is or what he wants, the identity of the woman in Marrowen colours, or the true nature of what he is walking toward.',
    },
    aldren: {
      knows: 'The tactical picture, the Keeper history since Wrenford, and the weight Shen is carrying; he witnessed the oath.',
      doesNotKnow: 'He has never told Shen about the child he failed to protect twenty-one years ago.',
    },
    mara: {
      knows: 'That the Lantern Kin ledgers were tampered with and that the Fen distorts perception itself.',
      doesNotKnow: 'That the scout who vanished before her sister died was tied to the very order now circling Shen.',
    },
    corvin: {
      knows: 'The holy and medical picture of the party\u2019s wounds, and that each Warden blessing is quietly expensive.',
      doesNotKnow: 'The full mechanism of the lifespan cost, which he means to research before it is spent again.',
    },
  };

  /* --------------------------------------------------- active uncertainties
     Deductions the party has floated but NOT confirmed. Each names the gated
     fact it must not prematurely become; applyTo never stores these as known,
     and a test asserts they remain unknown. */

  var uncertainties = [
    { claim: 'The woman in Marrowen colours is only guessed, from voice and bearing, to be a particular Marrowen noble.', factId: 'seraphine.thief' },
    { claim: 'The recurring name in the Witness papers is not yet tied to any person the party can point to.', factId: 'malrec.identity' },
    { claim: 'The exact current location of the Saint Orien fragment is unconfirmed.', factId: null },
    { claim: 'The nature of the Warden-linked presence beneath Blackharrow Keep is unknown.', factId: null },
  ];

  /* -------------------------------------------------------------- gear ----
     Accumulated damage and history, which hard canon forbids resetting. */

  var gear = [
    { owner: 'shen', item: 'Shen\u2019s Shield', history: tag('Clawed at Wrenford; upper rim reinforced by Darren after a heavy cleaver-strike at the mill.', 'canon') },
    { owner: 'shen', item: 'Father\u2019s Blade', history: tag('Mundane custom longsword; the Cooper smith\u2019s mark sits beneath the crossguard.', 'canon') },
    { owner: 'shen', item: 'Shen\u2019s Chain Mail', history: tag('Custom-fitted, forged largely by Darren; high quality but mundane.', 'canon') },
  ];

  /* ------------------------------------------------------------- applyTo ---
     Populate a fresh State.create() game. Actors are added directly (they are
     structure, not events); everything that is fiction \u2014 position, flags,
     quests, relationships, and above all knowledge \u2014 flows through an
     Events batch, so the whole save-state is logged, replayable, and auditable.
  */

  function applyTo(state, store) {
    if (!state) throw new Error('applyTo: a State.create() game is required');

    /* Make sure the store knows the facts before we teach anyone. Defining is
       idempotent; a store that already has them is left as-is. */
    if (store) {
      if (!store.facts || !store.facts['hollow.king.identity']) {
        Knowledge.defineFacts(store, Bible.FACTS);
      }
    }

    state.campaignId = Campaign.id;

    /* Party actors. Runtime is cloned so re-applying to another game cannot
       alias a shared object. */
    party.forEach(function (p) {
      var c = Campaign.characters[p.id];
      State.addActor(state, {
        id: p.id, name: c.base.name, side: 'party',
        kind: p.id === 'shen' ? 'pc' : 'companion',
        base: c.base, progression: c.progression, runtime: clone(c.runtime),
      });
      /* Re-affirm the tagged current resources onto the runtime pool. */
      var r = resources[p.id];
      if (r) {
        var pool = state.actors[p.id].runtime.resources = state.actors[p.id].runtime.resources || {};
        if (r.layOnHands) pool['lay-on-hands'] = val(r.layOnHands);
        if (r.channelDivinity) pool['channel-divinity'] = val(r.channelDivinity);
        if (r.hp != null) state.actors[p.id].runtime.hp = val(r.hp);
      }
    });
    State.addSeat(state, { id: 'p1', name: 'Player One', actorId: 'shen', control: 'human' });

    var batch = Events.makeBatch({ commandId: 'shen-continuation-load', actorId: 'shen' });

    /* Where and when. */
    Events.push(batch, 'position', { locationId: scene.locationId, discovered: true },
      'The party stands in Lantern\u2019s Rest, in the Glass Fen.');

    /* Progress flags. Deliberately, NONE of the reveal_* flags are set: no
       gated secret is revealable at the save-state. */
    [
      ['sworeOathOfDevotion', true],
      ['secondSealRestored', true],
      ['reachedGlassFen', true],
      ['metLanternKeeper', true],
      ['examinedSellsFamily', true],
      ['mirrorAbbeyEntered', false],
      ['thirdSealBindingAttempted', false],
    ].forEach(function (f) {
      Events.push(batch, 'flag', { flag: f[0], value: f[1] });
    });

    /* Ten open quests. */
    quests.forEach(function (q) {
      /* The title and the notes travel with the event. Sending only the id
         left the journal printing "screen-witnesses  open" — a slug and a
         status — for a campaign whose threads all have written names. */
      Events.push(batch, 'quest', {
        questId: q.id, status: q.status, title: q.title,
        objectives: q.objectives, note: q.note,
      }, 'Open thread: ' + q.title);
    });

    /* Companion regard for Shen, with the reason recorded alongside the number. */
    relationships.forEach(function (rel) {
      Events.push(batch, 'relationship', {
        fromId: rel.fromId, toId: rel.toId,
        affinity: val(rel.affinity), trust: val(rel.trust),
        respect: val(rel.respect), fear: val(rel.fear),
        because: rel.because,
      });
    });

    /* Knowledge \u2014 the only sanctioned path is a knowledge event per
       observer per fact. Everything here is earned and non-spoiler. */
    Object.keys(knowledge).forEach(function (observerId) {
      knowledge[observerId].forEach(function (factId) {
        batch.events.push(Knowledge.learnEvent(observerId, factId, 'full',
          'known at the save-state (Glass Fen, before Mirror Abbey).'));
      });
    });

    var res = Events.commit(state, batch);
    if (!res.ok) throw new Error('applyTo: failed to commit save-state batch: ' + res.error);

    /* The store's `known` view reads from state.knowledge; point it at the
       freshly-populated store so observations and audits see the truth. */
    if (store) store.known = state.knowledge;

    return state;
  }

  var shenContinuation = {
    campaignId: 'shen-cooper',
    scene: scene,
    recap: recap,
    party: party,
    elsewhere: elsewhere,
    clues: clues,
    sixWitnessProtocol: sixWitnessProtocol,
    fragments: fragments,
    quests: quests,
    resources: resources,
    relationships: relationships,
    knowledge: knowledge,
    npcKnowledge: npcKnowledge,
    uncertainties: uncertainties,
    gear: gear,
    applyTo: applyTo,
  };

  global.DND = global.DND || {};
  global.DND.Campaigns = global.DND.Campaigns || {};
  global.DND.Campaigns.shenContinuation = shenContinuation;
  if (typeof module !== 'undefined' && module.exports) module.exports = shenContinuation;
})(typeof window !== 'undefined' ? window : globalThis);
