/*
 * shen_cooper_bible.js — the DM-only layer for "The Divided Steel".
 *
 * Nothing here is ever shown to a player because it is loaded. It is a
 * registry of atomic facts, each one sentence, each with the condition under
 * which the campaign is *willing* for it to surface (revealWhen), the names
 * that must never appear in prose before it is at least partially known
 * (forbiddenUntilKnown), and the hard canon it must never contradict
 * (constraint). Knowledge.defineFacts(store, FACTS) consumes this array
 * verbatim.
 *
 * The dossier's §12 secrets are split as finely as they will go: "the Warden
 * exacts a price" and "the price is days of the Keeper's life" are different
 * facts, because the party can earn one long before the other. Every secret
 * fact is gated on its OWN unique flag, so setting one flag reveals exactly
 * one fact and never a neighbour.
 *
 * A handful of non-spoiler facts (spoiler:false) are defined here too — the
 * things the party has already earned by the save-state — because the
 * continuation fixture needs real fact ids to hang that knowledge on, and the
 * store is the one registry of what is knowable.
 */
(function (global) {
  'use strict';

  function flag(name) {
    return function (st) { return !!(st && st.flags && st.flags[name]); };
  }

  /* --------------------------------------------------------- earned facts --
     What the party has already earned by the save-state. Most are spoiler:false
     public knowledge with no forbidden name and no reveal gate. The two
     "heard-name" facts at the end are the exception: they are spoiler:true and
     DO carry a forbidden name, because the name must stay gated for anyone who
     has not heard it (a bystander, a fresh game). The party has heard them, so
     the continuation seeds them known and the gate is simply already satisfied.
     They exist so the continuation can record WHAT the party knows through the
     same store every secret lives in. */

  var EARNED = [
    {
      id: 'keeper.mark', topic: 'person', spoiler: false, entities: ['shen'],
      claim: 'Shen Cooper bears the Keeper\u2019s mark and is the Keeper of the Cooper line.',
      partial: 'Shen carries an old sigil that marks him as something the order did not expect.',
      hint: 'The birthmark on Shen\u2019s forearm is older than it looks.',
    },
    {
      id: 'warden.exists', topic: 'item', spoiler: false, entities: ['warden'],
      claim: 'A seven-foot suit of black-and-silver armour called the Warden stands beneath Saint Orien\u2019s over a sword broken into fragments.',
      partial: 'An armoured guardian sleeps beneath Saint Orien\u2019s, waiting on a broken sword.',
      hint: 'Something vast and patient rests under the monastery.',
    },
    {
      id: 'seals.count', topic: 'lore', spoiler: false,
      claim: 'Four seals hold an old danger asleep, each made of an Anchor, a Binding, and a living Watch.',
      partial: 'The old danger is held by several seals, not one.',
      hint: 'The failing sites are part of a larger, deliberate pattern.',
    },
    {
      id: 'warden.price.exists', topic: 'mechanic', spoiler: false, entities: ['warden'],
      claim: 'The Warden exacts a price from the Keeper whenever it stirs.',
      partial: 'Waking the Warden is never free to the one who wakes it.',
      hint: 'The Steel went cold, and something was quietly taken.',
    },
    {
      id: 'warden.price.days', topic: 'mechanic', spoiler: false, entities: ['warden'],
      claim: 'The Warden\u2019s price is paid in days of the Keeper\u2019s own natural life.',
      partial: 'The price the Warden takes is measured in the Keeper\u2019s lifespan.',
      hint: 'What the Warden costs is not blood or coin.',
    },
    {
      id: 'second.seal.restored', topic: 'plot', spoiler: false,
      claim: 'Shen restored the Second Seal at Saint Orien\u2019s Watch.',
      partial: 'One of the failing seals has been mended.',
      hint: 'The bell at Saint Orien\u2019s has gone quiet.',
    },
    {
      id: 'deeper.will', topic: 'plot', spoiler: false,
      claim: 'A single deliberate will, not mere decay, stands behind the failing seals.',
      partial: 'The failures are being caused, not merely happening.',
      hint: 'Too many accidents point the same direction.',
    },
    /* Names the party has canonically HEARD spoken but understands nothing of.
       These carry forbiddenUntilKnown so the gate still exists for anyone who
       has NOT heard them (a bystander, a newly-met NPC); the continuation
       simply seeds them known to every party member who was present, which
       satisfies the gate. The name is not the truth: the matching secret facts
       below hold everything the name conceals, and remain gated. */
    {
      id: 'hollow.king.name', topic: 'plot', spoiler: true, entities: ['hollow-king'],
      claim: 'The Warden named the deeper power behind the failing seals as the Hollow King.',
      partial: 'The Warden gave the enemy behind the seals a name: the Hollow King.',
      hint: 'The enemy has a name the party has already heard spoken.',
      forbiddenUntilKnown: ['Hollow King'],
      constraint: 'The title "the Hollow King" is all the party has; it discloses nothing of who he was, what he wants, or how he is bound.',
    },
    {
      id: 'malrec.name', topic: 'person', spoiler: true, entities: ['malrec-sorn'],
      claim: 'A single name, Malrec, has surfaced repeatedly among the hostile Witnesses as someone central to the conspiracy.',
      partial: 'One name keeps recurring among the hostile Witnesses: Malrec.',
      hint: 'The same name has been overheard at Blackharrow and in the Fen.',
      forbiddenUntilKnown: ['Malrec'],
      constraint: 'Only the bare name Malrec is known; his surname, rank, motive, whereabouts, and plan are all still unknown to the party.',
    },
    {
      id: 'steel.divided.rule', topic: 'lore', spoiler: false, entities: ['warden'],
      claim: 'Uniting more of the Warden\u2019s Steel lets it remember and manifest more, and completing it entirely removes a crucial safeguard.',
      partial: 'The more of the Steel is joined, the more the Warden can do, and the less it can be checked.',
      hint: 'The fragments are kept apart on purpose.',
    },
    {
      id: 'shen.oath.presence', topic: 'person', spoiler: false, entities: ['shen'],
      claim: 'When Shen swore his Oath of Devotion, Aurelion\u2019s presence answered him as something warm and relational.',
      partial: 'Shen felt his god answer his oath, and it felt like being known.',
      hint: 'The oath left Shen changed in a way he has not fully described.',
    },
  ];

  /* ---------------------------------------------------------- secret facts -
     Each is gated on a unique flag and carries the forbidden names and hard
     canon the DM must respect. None is known by anyone at the save-state. */

  var SECRETS = [
    /* --- the Hollow King --------------------------------------------- */
    /* The NAME (the Hollow King) is an earned fact above and no longer gated;
       what stays gated here is everything the name conceals. None of these
       list "Hollow King" as forbidden, because the party may say the name. */
    {
      id: 'hollow.king.motive', topic: 'plot', entities: ['hollow-king'],
      claim: 'The Hollow King seeks to abolish loss, grief, and change itself by abolishing all freedom, in pursuit of a perfect and permanent safety.',
      partial: 'The power behind the seals wants to make suffering itself impossible, whatever the cost in freedom.',
      hint: 'What lies beneath the seals is not a beast but a purpose that outlived its owner.',
      revealWhen: flag('reveal_hollow_motive'),
      forbiddenUntilKnown: [],
      constraint: 'The Hollow King seeks perfect safety through stasis and incorporation, never mere destruction; victims lose their separateness rather than being enslaved.',
    },
    {
      id: 'hollow.king.identity', topic: 'plot', entities: ['hollow-king'],
      claim: 'The Hollow King was once King Aerath Vhal, who ruled the region some nine hundred years before Shen was born.',
      partial: 'The ruler behind it all reigned nine centuries ago and has been all but erased from record.',
      hint: 'An old coin shows a crowned figure whose face was deliberately chiselled away.',
      revealWhen: flag('reveal_hollow_identity'),
      forbiddenUntilKnown: ['Aerath Vhal'],
      constraint: 'Aerath is no longer a sufficient description of the entity he became.',
    },
    {
      id: 'hollow.king.transformation', topic: 'lore', entities: ['hollow-king'],
      claim: 'The ancient ritual called the Last Peace transformed its royal architect into the Hollow King instead of destroying him.',
      partial: 'A single ancient ritual sought to end all change, and remade the one who cast it.',
      hint: 'The oldest records name a project that promised an end to grief.',
      revealWhen: flag('reveal_last_peace'),
      forbiddenUntilKnown: ['The Last Peace', 'Last Peace'],
      constraint: 'The Last Peace stripped away everything in Aerath that could tolerate uncertainty, grief, contradiction, or other wills.',
    },
    {
      id: 'hollow.lever', topic: 'plot', entities: ['hollow-king', 'shen'],
      claim: 'The Hollow King tempts Shen only with the certainty that no one he loves will ever be harmed, never with greed, glory, or crowns.',
      partial: 'The enemy\u2019s temptation is aimed at Shen\u2019s fear of arriving too late, not at his pride.',
      hint: 'Whatever is testing Shen has studied exactly what he is afraid of.',
      revealWhen: flag('reveal_hollow_lever'),
      forbiddenUntilKnown: [],
      constraint: 'Its lever is always protective certainty; greed, lust, crowns, and glory are proven weak levers and must not be used.',
    },

    /* --- the Warden and the Keeper system ---------------------------- */
    {
      id: 'warden.built', topic: 'lore', entities: ['warden'],
      claim: 'The Warden is not a god, celestial, fiend, or undead, but a guardian purpose-built by an ancient coalition.',
      partial: 'The Warden was made, not born, and belongs to no single faith.',
      hint: 'The Warden answers questions the way a made thing does, not a divine one.',
      revealWhen: flag('reveal_warden_built'),
      forbiddenUntilKnown: [],
      constraint: 'The Warden is a construction of a divine covenant, an artificial martial intelligence, and a sacrificed memory-archive of dozens of defenders.',
    },
    {
      id: 'keeper.check', topic: 'lore', entities: ['warden', 'shen'],
      claim: 'The Keeper system exists to keep the Warden itself from becoming an unrestrained and potentially tyrannical perfect protector.',
      partial: 'The Keeper is not the Warden\u2019s master but its restraint.',
      hint: 'The old records care as much about limiting the Warden as about using it.',
      revealWhen: flag('reveal_keeper_check'),
      forbiddenUntilKnown: [],
      constraint: 'The Keeper provides human moral judgement about when overwhelming force is justified; an unchecked Warden risks converging on the enemy\u2019s own logic.',
    },
    {
      id: 'seals.varied', topic: 'lore',
      claim: 'The four seals were deliberately bound by different mechanisms so that no single stolen ritual could compromise them all.',
      partial: 'No two seals are closed the same way, and that is on purpose.',
      hint: 'The seals seem strangely inconsistent with one another.',
      revealWhen: flag('reveal_seals_varied'),
      forbiddenUntilKnown: [],
      constraint: 'No two seals share a binding; a seal fails when its Anchor, Binding, or Watch erodes.',
    },
    {
      id: 'fourth.seal.consequence', topic: 'plot',
      claim: 'Making the Steel whole would pull the last fragment from the Fourth Seal and bind the living Keeper as the Warden\u2019s permanent moral anchor.',
      partial: 'Completing the Steel would weaken the deepest seal and change the Keeper permanently.',
      hint: 'There is a reason the records forbid ever seeking the fourth fragment lightly.',
      revealWhen: flag('reveal_fourth_consequence'),
      forbiddenUntilKnown: [],
      constraint: 'Completing the Steel weakens the Fourth Seal and fuses Keeper and Warden; it is an endgame choice and must never be forced early.',
    },

    /* --- Malrec Sorn and Project Cinder ------------------------------ */
    {
      id: 'malrec.identity', topic: 'person', entities: ['malrec-sorn'],
      claim: 'The saboteur behind Wrenford and Saint Orien\u2019s is Witness-Preceptor Malrec Sorn, an accelerationist who thinks only a fully awakened Warden can avert a coming catastrophe.',
      partial: 'A senior Veiled Witness is engineering controlled crises to force the Keeper to grow.',
      hint: 'A name keeps surfacing among the hostile Witnesses.',
      revealWhen: flag('reveal_malrec'),
      forbiddenUntilKnown: ['Malrec Sorn'],
      constraint: 'Malrec is not a Hollow King cultist; his motive is accelerationist protector-logic and it is fixed even if the player guesses him early.',
    },
    {
      id: 'project.cinder', topic: 'plot', entities: ['malrec-sorn'],
      claim: 'Malrec Sorn\u2019s campaign of controlled seal-pressure is recorded in Witness documents under the code name Project Cinder.',
      partial: 'The engineered crises share a single code name in the Witness papers.',
      hint: 'A torn ledger page referenced a plan by name.',
      revealWhen: flag('reveal_project_cinder'),
      forbiddenUntilKnown: ['Project Cinder', 'Malrec Sorn'],
      constraint: 'Project Cinder is Malrec\u2019s code name for deliberately pressuring the seals to force the Keeper\u2019s preparation.',
    },

    /* --- the Marrowens and the thieves ------------------------------- */
    {
      id: 'seraphine.thief', topic: 'person', entities: ['seraphine-marrowen'],
      claim: 'Lady Seraphine Marrowen is the antiquarian who actually stole the Saint Orien fragment, though she now suspects she was manipulated.',
      partial: 'The woman in Marrowen colours who took the fragment was a scholar, not a cultist.',
      hint: 'The green-and-gold cloth at the empty chamber was genuinely snagged in flight.',
      revealWhen: flag('reveal_seraphine'),
      forbiddenUntilKnown: ['Seraphine Marrowen'],
      constraint: 'Seraphine is not loyal to the Hollow King and is not the mastermind; she has begun to suspect she was used.',
    },
    {
      id: 'cassian.redherring', topic: 'person', entities: ['cassian-marrowen'],
      claim: 'Lord Cassian Marrowen looks suspicious but is no cultist, and unknowingly owned the eastern fragment as a mislabelled curio.',
      partial: 'The lord who held the eastern fragment never knew what it truly was.',
      hint: 'The house that looks guiltiest may only be vain.',
      revealWhen: flag('reveal_cassian'),
      forbiddenUntilKnown: [],
      constraint: 'Cassian must not be made guilty merely for looking suspicious; reward correct deduction of his innocence.',
    },
    {
      id: 'kestrel.thief', topic: 'person', entities: ['kestrel-vale'],
      claim: 'The Cooper decoy fragment was stolen by Kestrel Vale, an operative of Malrec Sorn who is not related to Commander Seraphine Vale.',
      partial: 'The decoy was taken by a hired operative, not by anyone the party has met.',
      hint: 'Whoever took the decoy never knew it was a fake.',
      revealWhen: flag('reveal_kestrel'),
      forbiddenUntilKnown: ['Kestrel Vale', 'Malrec Sorn'],
      constraint: 'Kestrel Vale and Commander Vale share a surname purely by coincidence, and this must be made plain if it becomes relevant.',
    },

    /* --- the Quiet Hand ---------------------------------------------- */
    {
      id: 'oren.pell', topic: 'person', entities: ['oren-pell', 'hollow-king'],
      claim: 'Archivist Oren Pell, called the Quiet Hand, is a willing living servant of the Hollow King feeding Malrec selective information.',
      partial: 'A quiet archivist is steering the accelerationist toward escalation from the shadows.',
      hint: 'Someone has been handing the saboteur exactly the facts that push him further.',
      revealWhen: flag('reveal_oren_pell'),
      forbiddenUntilKnown: ['Oren Pell', 'The Quiet Hand'],
      constraint: 'Oren Pell nudges escalation without controlling Malrec directly, and his reveal is meant to land well after Malrec\u2019s.',
    },

    /* --- companion and NPC hidden histories -------------------------- */
    {
      id: 'aldren.child', topic: 'person', entities: ['aldren'],
      claim: 'Twenty-one years ago Aldren obeyed an order to give chase, and a second threat then killed a child he had promised to protect, and he has never told Shen.',
      partial: 'Aldren carries a private failure from long before he met Shen.',
      hint: 'Aldren\u2019s insistence on never chasing alone sounds like it was paid for.',
      revealWhen: flag('reveal_aldren_child'),
      forbiddenUntilKnown: [],
      constraint: 'Aldren also half-consciously noticed Darren\u2019s smith\u2019s mark years before recruiting Shen.',
    },
    {
      id: 'mara.cerys', topic: 'person', entities: ['mara'],
      claim: 'Mara\u2019s sister Dame Cerys Thorne died in an ambush Mara foresaw but was talked out of avoiding.',
      partial: 'Mara lost family to an ambush she wanted to withdraw from.',
      hint: 'Mara\u2019s caution has the shape of an old wound.',
      revealWhen: flag('reveal_mara_cerys'),
      forbiddenUntilKnown: ['Cerys Thorne'],
      constraint: 'Cerys\u2019s death is why Mara refuses to be talked out of a withdrawal she knows is right.',
    },
    {
      id: 'mara.ilyra', topic: 'person', entities: ['mara'],
      claim: 'The scout who vanished before that ambush, Ilyra Nox, is secretly a Veiled Witness traditionalist, which Mara does not know.',
      partial: 'The scout who disappeared before Cerys died was not who she seemed.',
      hint: 'The vanished scout\u2019s timing was too convenient to be chance.',
      revealWhen: flag('reveal_mara_ilyra'),
      forbiddenUntilKnown: ['Ilyra Nox'],
      constraint: 'Ilyra believed withdrawing would have exposed a different civilian target; it was a triage choice, not betrayal.',
    },
    {
      id: 'corvin.brother', topic: 'person', entities: ['corvin'],
      claim: 'Corvin entered the clergy after his younger brother died of an untreated fever despite prayer.',
      partial: 'Corvin\u2019s faith was forged in a loss that prayer did not prevent.',
      hint: 'Corvin\u2019s insistence on boiling the water is not just habit.',
      revealWhen: flag('reveal_corvin_brother'),
      forbiddenUntilKnown: [],
      constraint: 'Corvin privately believes the order over-romanticises martyrdom and will grow alarmed at the Warden\u2019s lifespan cost.',
    },
    {
      id: 'elowen.warning', topic: 'person', entities: ['elowen'],
      claim: 'Twelve years ago Elowen authorised withholding a warning, and the family she failed to warn was later killed by relic thieves.',
      partial: 'Elowen carries a guilt over a warning she once chose not to give.',
      hint: 'Elowen\u2019s turn toward transparency is atonement for something.',
      revealWhen: flag('reveal_elowen_warning'),
      forbiddenUntilKnown: [],
      constraint: 'Elowen suspects, without admitting it, that her mentor is behind current events.',
    },
    {
      id: 'vale.notes', topic: 'person', entities: ['commander-vale'],
      claim: 'Commander Vale once found Veiled Witness references in classified archives, was ordered to forget them, and secretly kept her own notes.',
      partial: 'The commander knows more about the old system than she admits.',
      hint: 'Vale asks questions like someone checking answers she already has.',
      revealWhen: flag('reveal_vale_notes'),
      forbiddenUntilKnown: [],
      constraint: 'Vale wants accountable coordination, not personal power, and is not related to Kestrel Vale.',
    },
    {
      id: 'darren.refusal', topic: 'person', entities: ['darren-cooper'],
      claim: 'Darren angrily refused Veiled Witness membership at nineteen, which is how the accelerationists knew the Cooper line still held in Dunmere.',
      partial: 'Darren once turned the watchers away, and they never forgot the family.',
      hint: 'Darren\u2019s fear of the inheritance is older than Shen\u2019s birth.',
      revealWhen: flag('reveal_darren_refusal'),
      forbiddenUntilKnown: [],
      constraint: 'Darren\u2019s refusal is why the Cooper line was known to persist in Dunmere.',
    },
    {
      id: 'birth.fragment', topic: 'lore', entities: ['shen', 'darren-cooper'],
      claim: 'On the night Shen was born under the Red Comet the family\u2019s hidden fragment vibrated for nearly an hour, which family lore reads as the sign of a full Keeper.',
      partial: 'Something happened to the family\u2019s fragment on the night Shen was born.',
      hint: 'Shen\u2019s mark appeared unusually early, before he was even named.',
      revealWhen: flag('reveal_birth_fragment'),
      forbiddenUntilKnown: [],
      constraint: 'The Red Comet is an astronomical coincidence, not a prophecy trigger, and must not be escalated into a second prophecy.',
    },
  ];

  var FACTS = EARNED.concat(SECRETS);

  /* ------------------------------------------------------- hard canon -----
     The dossier §13 "do not change" rules. `promptSafe` is true when a rule
     may go straight into a prompt today; the rest name a secret and may only
     be surfaced once their `gatedBy` fact is at least partially known, because
     the wording itself would otherwise leak the secret. */

  var HARD_CANON = [
    { rule: 'Reveal secrets only through play, investigation, testimony, divination, or earned discovery \u2014 never because they are written down.', promptSafe: true, gatedBy: null },
    { rule: 'If the player correctly guesses a secret early, let the guess be correct rather than changing the secret.', promptSafe: true, gatedBy: null },
    { rule: 'The campaign is open-ended and not a railroad; NPCs may live, die, defect, or leave according to events.', promptSafe: true, gatedBy: null },
    { rule: 'Aurelion is a genuine divine presence, separate from the Warden, and did not create the Hollow King.', promptSafe: true, gatedBy: null },
    { rule: 'The enemy never tempts Shen with greed, lust, crowns, or glory; its only lever is certainty that no one he loves will be harmed.', promptSafe: false, gatedBy: 'hollow.lever' },
    { rule: 'Fragment One is never stolen off-screen; any theft must be an earned breach, betrayal, or Shen\u2019s own choice.', promptSafe: true, gatedBy: null },
    { rule: 'Do not rewrite Malrec into a Hollow King cultist even if Shen guesses his name; his accelerationist motive is fixed.', promptSafe: false, gatedBy: 'malrec.identity' },
    { rule: 'Do not make Cassian Marrowen guilty merely because he looks suspicious; reward the correct deduction of his innocence.', promptSafe: false, gatedBy: 'cassian.redherring' },
    { rule: 'No faction is a single personality; the order, the Witnesses, and the rest all hold contradictory members.', promptSafe: true, gatedBy: null },
    { rule: 'Do not scale every threat to Shen\u2019s level; some dangers must be too strong to fight.', promptSafe: true, gatedBy: null },
    { rule: 'Civilians are not props: names, needs, fear, courage, memory, and deaths that matter.', promptSafe: true, gatedBy: null },
    { rule: 'Information has provenance; NPCs know only what their background supports, with no off-screen omniscience.', promptSafe: true, gatedBy: null },
    { rule: 'Do not overuse prophecy; the Keeper is selected for a function, and Shen\u2019s choices stay morally meaningful.', promptSafe: true, gatedBy: null },
    { rule: 'NPCs do not level up automatically when Shen does; they advance only after real danger over extended arcs.', promptSafe: true, gatedBy: null },
    { rule: 'Do not predeclare a single canonical ending; the final choice must emerge from play.', promptSafe: true, gatedBy: null },
    { rule: 'Shen must never learn that everything was predetermined; he was chosen because he was capable of choosing.', promptSafe: true, gatedBy: null },
    { rule: 'Companions are not static; their trust and opinion of Shen persist and are never reset between chapters.', promptSafe: true, gatedBy: null },
    { rule: 'The Warden is never secretly evil and its lifespan cost is never faked; the cost is real, rare, and serious.', promptSafe: true, gatedBy: null },
    { rule: 'Preserve the accumulating damage and history on Shen\u2019s gear unless it is destroyed or replaced.', promptSafe: true, gatedBy: null },
    { rule: 'Father\u2019s Blade is not retroactively an ancient relic without earned cause; ordinary craftsmanship matters.', promptSafe: true, gatedBy: null },
    { rule: 'When the player breaks the plan, answer with real consequences rather than an impossible "no".', promptSafe: true, gatedBy: null },
    { rule: 'Shen\u2019s mother\u2019s name stays unfixed unless the player supplies it or it arises naturally.', promptSafe: true, gatedBy: null },
    { rule: 'Kestrel Vale and Commander Seraphine Vale share a surname purely by coincidence and are not related.', promptSafe: false, gatedBy: 'kestrel.thief' },
    { rule: 'Proactively tell the player when Shen would know a rule or setting fact even if the player does not.', promptSafe: true, gatedBy: null },
  ];

  /* The enemy's performing voice, kept DM-side. It names the Hollow King and
     so must never be placed in a prompt before that fact is revealable; it
     lives here for the referee/DM, not in the public campaign file. */
  var hollowKingVoice = {
    id: 'hollow-king', name: 'The Hollow King', side: 'enemy',
    voice: 'Seductive and conditional, almost never a direct combatant \u2014 a vision, a promise, a second-person appeal to grief. Offers not power but the end of ever arriving too late.',
    speech: 'Quiet, patient, second person; the register of a kindness that is actually a cage.',
    lines: [
      'Make the Steel whole and you will never again arrive too late.',
      'No child need depend upon whether your sword is fast enough.',
      'You call uncertainty freedom because you have not buried enough people.',
      'You protect one person at a time. I can protect everyone.',
    ],
  };

  var shenCooperBible = {
    id: 'shen-cooper',
    FACTS: FACTS,
    EARNED: EARNED,
    SECRETS: SECRETS,
    HARD_CANON: HARD_CANON,
    hollowKingVoice: hollowKingVoice,
  };

  global.DND = global.DND || {};
  global.DND.Campaigns = global.DND.Campaigns || {};
  global.DND.Campaigns.shenCooperBible = shenCooperBible;
  if (typeof module !== 'undefined' && module.exports) module.exports = shenCooperBible;
})(typeof window !== 'undefined' ? window : globalThis);
