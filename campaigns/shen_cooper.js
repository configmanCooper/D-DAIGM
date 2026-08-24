/*
 * shen_cooper.js — the public, spoiler-free definition of the built-in
 * "Shen Cooper" campaign ("The Divided Steel").
 *
 * This file holds ONLY what a new player, or the AI DM on turn one, is allowed
 * to see. It is the layer prompt.buildSystem() reads from: premise, tone,
 * voice, open canon, the non-spoiler hard rules, and the world's people and
 * places. Nothing from the DM Bible's §12 secrets lives here — every gated
 * truth is defined in shen_cooper_bible.js as an atomic fact with its own
 * reveal condition, so a secret cannot leak simply by being loaded.
 *
 * Characters are materialised through Character.buildFromSpec with explicit
 * per-level hit points, which means this module does NOT depend on the SRD
 * data files being present: the rolls are supplied, so no hit die is looked
 * up. The consumer injects class/item data before calling derive(); this file
 * only holds the sheet.
 */
(function (global) {
  'use strict';

  var Character = (global.DND && global.DND.Character) ||
    (typeof require !== 'undefined' ? require('../js/engine/character.js') : null);

  /* ------------------------------------------------------------ people ----
     Every companion and NPC is built as a voice card the AI DM performs from,
     with a handful of VERBATIM lines the offline narrator falls back on when
     there is no model. The registers are lifted straight from the play
     records (dossier §14): Aldren corrects without stripping agency, Mara
     answers with evidence and dry alarm, Corvin jokes to stay upright. */

  var npcs = {
    aldren: {
      id: 'aldren', name: 'Sir Aldren Vey', role: 'Veteran paladin, field mentor', side: 'party',
      voice: 'Direct and corrective, warm underneath. Fixes a plan without taking it away from you; teaches by naming the mistake, not the person. Speaks in short declaratives, rarely raises his voice.',
      wants: 'To see Shen become genuinely capable — and to keep the order from treating the boy as a strategic asset.',
      speech: 'Plain soldier\u2019s cadence; tactical nouns; the occasional grim joke that lands like an order.',
      lines: [
        'Bravery and usefulness are different things. Learn the difference before it costs someone.',
        'Never chase a wounded thing alone. That is how the second trap gets you.',
        'You did well. Now tell me what you would do differently, because there is always something.',
        'Stand where you can be reached, not where you look bravest.',
        'Burning the mill would have felt decisive. It would also have killed the people still inside it.',
      ],
      visual: 'Age 48, broad-shouldered, greying dark beard, worn order plate that has clearly been repaired more than once.',
    },

    mara: {
      id: 'mara', name: 'Dame Mara Thorne', role: 'Scout, ranged overwatch', side: 'party',
      voice: 'Terse and evidence-based, with a dry humour that surfaces at the worst moments. Distrusts ambition until it is proven cautious. States what she saw, not what she hopes.',
      wants: 'To be proven wrong about the danger, and to never again be talked out of a withdrawal she knew was right.',
      speech: 'Clipped observations, ledger-precise. Counts things. Reports rather than reassures.',
      lines: [
        'The ledger was rewritten. Same hand, different ink, three days apart. Somebody wanted a story.',
        'He throws sacred relics at monsters. It keeps working. I have decided to find that reassuring.',
        'I count six ways out of this room and I would like us to keep four of them.',
        'You want my honest read? We are being herded. Politely, but herded.',
        'Slow down. The confident ones are the ones who die first out here.',
      ],
      visual: 'Age 32, severe features, disciplined bearing, practical hide-and-leather kit built for a bow and a quiet approach.',
    },

    corvin: {
      id: 'corvin', name: 'Brother Corvin Hale', role: 'Cleric, healer', side: 'party',
      voice: 'Humour under pressure and a practical, un-romantic faith. Believes divine power supports human responsibility rather than replacing medicine or caution. Uneasy with doctrines that promise perfect protection.',
      wants: 'To keep everyone breathing without pretending prayer is a substitute for a splint — and, lately, to understand what the Warden is quietly costing Shen.',
      speech: 'Warm, wry, quietly theological; reaches for a bandage and a bad joke in the same breath.',
      lines: [
        'Hold still. This will hurt, and then it will hurt less, which is the whole of my theology.',
        'The gods help. They do not do the work for you. Anyone who tells you otherwise is selling something.',
        'I have prayed over a fever before and lost. So forgive me if I also boil the water.',
        'Radiance of the Dawn, and then we run. In that order. Please.',
        'You keep paying for these blessings, Shen. I would like to know the price in plain coin.',
      ],
      visual: 'Age 27, mail under white traveling robes, a plain mace at his belt and a satchel that rattles with field supplies.',
    },

    'maera-venn': {
      id: 'maera-venn', name: 'Maera Venn', role: 'Lantern Keeper of Lantern\u2019s Rest', side: 'ally',
      voice: 'The keeper of an inherited custom she only half understands, spoken in worn maxims. Grave, hospitable, exact about ritual and honest about what she cannot explain. Grief and duty in equal measure.',
      wants: 'To keep the lanterns lit and the Fen\u2019s truth intact, even as households forget it ever existed.',
      speech: 'Old sayings and lantern-lore; the plain speech of a working custodian, not a priest.',
      lines: [
        'One flame may lie. Three flames may differ. The Fen remembers what all have seen.',
        'Truth spoken together must first be seen apart. That is the whole of the craft, and we have forgotten it.',
        'Seven households have let their lanterns go cold. Ask them why and they will tell you there was never a lantern at all.',
        'We light a flame when a child is born, and when one dies, and every night between. Nobody remembers why. I light mine anyway.',
        'The seventh stone burns black on the Abbey path tonight. That has always meant: do not go yet.',
      ],
      visual: 'Weathered, lantern-scarred hands; a heavy iron key-ring; a keeper\u2019s oil-lamp she never sets down.',
    },

    'lysa-sells': {
      id: 'lysa-sells', name: 'Lysa Sells', role: 'Fen villager, mother of the Sells household', side: 'neutral',
      voice: 'Sincere and defensive, certain of a past that the evidence contradicts. Not lying — she genuinely does not remember, and resents the implication that she should.',
      wants: 'To be left alone by strangers implying her family is something it is not.',
      speech: 'Guarded hospitality curdling into offence; short, firm denials.',
      lines: [
        'We have never kept a lantern. My mother did not, and hers did not. You have the wrong house.',
        'I do not know what a Lantern Kin is, and I would thank you not to say it at my table.',
        'That carving is not ours. I do not care whose initials you think you see.',
        'You are frightening my daughter with old ghost-talk. Please go.',
      ],
      visual: 'Careworn, roughspun clothes, a lantern-hook by her door with no lantern on it and a paler patch of wood where one clearly once hung.',
    },

    'orin-sells': {
      id: 'orin-sells', name: 'Orin Sells', role: 'Fen villager, father of the Sells household', side: 'neutral',
      voice: 'Stolid, literal, unmoved by suggestion. Answers exactly what he is asked and nothing more. His certainty is the flat kind that does not argue.',
      wants: 'To finish his work and have the outsiders gone by dark.',
      speech: 'Few words, all of them plain; no ornament, no doubt.',
      lines: [
        'No lantern. Never was. Ask my wife.',
        'I mend nets. I do not mind old stones or old stories.',
        'The Abbey is half a mile of bad water. Nobody goes there. Why would they.',
        'You can look all you like. You will find the same nothing I do.',
      ],
      visual: 'Broad hands stained with net-tar, a stubborn set to his jaw, eyes that slide past the empty lantern-hook without seeing it.',
    },

    'tessa-sells': {
      id: 'tessa-sells', name: 'Tessa Sells', role: 'Fen villager, the Sells\u2019 daughter (17)', side: 'neutral',
      voice: 'Young, sharp, and unsettled — the one member of the family who can sometimes catch the seam between what she remembers and what she is seeing. Frightened by her own moments of clarity.',
      wants: 'To understand why her own hands seem to know things her memory denies.',
      speech: 'Quick, questioning, occasionally trailing off mid-certainty as a doubt surfaces.',
      lines: [
        'I have never carved a lantern. But that is my mark. I would know my own cuts anywhere. I do not understand.',
        'For a moment the flame was yellow, and then it was not, and you all saw something different, and I want to go home.',
        'Ask me again, apart from my parents. I think I remember differently when they are not sure with me.',
        'Something is wrong with the way we remember here. I can feel it, like a word on the tip of a tongue that keeps moving.',
      ],
      visual: 'Restless, ink-and-woodshaving hands, a whittling knife she carries without quite knowing why.',
    },

    elowen: {
      id: 'elowen', name: 'Sister Elowen Veyra', role: 'Veiled Witness leader at Saint Orien\u2019s (reforming)', side: 'ally',
      voice: 'Measured and authoritative, doctrinal turning toward conscience. Speaks like someone re-examining a faith in public. Will not be commanded, but recognises what Shen is.',
      wants: 'To reform the Witnesses toward transparency, and to stand between Shen and any of her order who would kill him for what he might one day do.',
      speech: 'Careful, weighed clauses; the cadence of an oath being reconsidered aloud.',
      lines: [
        'We were founded so that no one would be trusted merely because their role is sacred. That includes you, Keeper.',
        'If my order decides you should die for an error you have not yet made, they will come through me first.',
        'I break this cord myself. Watching was never meant to become deciding.',
        'I will stay and rebuild the Watch here. Someone let the rot in from inside, and I intend to find the door.',
      ],
      visual: 'Around 50, silver hair, a swordfighter\u2019s economy of movement, a frayed red wrist-cord she has cut but not removed.',
    },

    'darren-cooper': {
      id: 'darren-cooper', name: 'Darren Cooper', role: 'Blacksmith, Shen\u2019s father', side: 'ally',
      voice: 'Proud, protective, plainspoken, uneasy about an inheritance he never wanted for his son. Says important things while working, not looking up. Love expressed in steel, not words.',
      wants: 'For Shen to remain a person, not become only a Keeper.',
      speech: 'Forge-plain; metaphors of metal and fire; the occasional line that lands harder than he meant it to.',
      lines: [
        'Being chosen by something does not mean you owe it obedience.',
        'I made you a sword, a shield, and armour. That is the only prophecy I trust.',
        'I reinforced the rim after the mill. Steel remembers where it was struck. So should you.',
        'I am proud of you. I would be proud of you at the forge too. Both can be true.',
      ],
      visual: 'Weathered, forge-strong, soot in the creases of his hands, an old smith\u2019s mark he has stopped explaining.',
    },

    'commander-vale': {
      id: 'commander-vale', name: 'Commander Seraphine Vale', role: 'Senior officer, Dunmere Order of Aurelion', side: 'ally',
      voice: 'Controlled, pragmatic, institutional. Thinks in procedures and secure custody. Impressed by Shen and instinctively wants to formalise everything around him — which is itself a tension, not a comfort.',
      wants: 'Accountable coordination and secured fragments; not personal power, though her love of procedure can look like it.',
      speech: 'Command register; verbs of authorisation, escort, and record.',
      lines: [
        'Fragment One is secure under divided access. Your parents are safe. Say it back to me so I know you heard.',
        'I will authorise the escort. I will not authorise heroics. Those are different requisitions.',
        'Everything you have learned goes in the record. A secret held by one person is a single point of failure.',
        'I have seen what unaccountable protectors become. Let us not become it efficiently.',
      ],
      visual: 'Formal order regalia, command insignia, a locked dispatch-case never far from her hand.',
    },

    warden: {
      id: 'warden', name: 'The Warden', role: 'Ancient guardian bound in the Divided Steel', side: 'neutral',
      voice: 'Vast, detached, evaluative, almost mechanical. Speaks in terse capitalised declaratives, never conversational, never warm. Judges the hand before it accepts the Steel.',
      wants: 'To stand only where a Keeper chooses; to remain divided until need truly outweighs risk.',
      speech: 'ALL CAPITALS, oracular, minimal. States, confirms, refuses. Does not persuade.',
      lines: [
        'THE KEEPER DOES NOT COMMAND. THE KEEPER CHOOSES WHERE THE WARDEN STANDS.',
        'CORRECT.',
        'SECOND SEAL RESTORED. TWO REMAIN. WELL CHOSEN, KEEPER.',
        'DO NOT MAKE THE STEEL WHOLE FOR CURIOSITY. DO NOT MAKE IT WHOLE FOR POWER.',
        'I JUDGE THE HAND BEFORE I ACCEPT THE STEEL.',
      ],
      visual: 'A seven-foot suit of black-and-silver armour, hands resting on the hilt of an incomplete sword driven into stone; its metal is the exact dark-silver of the Cooper fragment.',
    },
  };

  /* ---------------------------------------------------------- locations --- */

  var locations = {
    dunmere: {
      name: 'Dunmere', biome: 'town', timeOfDay: 'day', weather: 'clear',
      description: 'Shen\u2019s home: a prosperous but unremarkable trade town, the emotional centre of the campaign. Forge, chapel, and the buildings of the Dunmere Order of Aurelion.',
      connections: ['wrenford', 'saint-oriens', 'redwater-crossing'],
      visual: 'Warm, lived-in medieval streets; the ring of a working forge; order banners over a modest chapter house.',
    },
    wrenford: {
      name: 'Wrenford', biome: 'village', timeOfDay: 'dawn', weather: 'overcast',
      description: 'A village twelve miles north of Dunmere, and the site of Shen\u2019s first mission. Its old mill stood over far older stone; after that night the mill sank fifteen feet into the earth and the passages beneath collapsed.',
      connections: ['dunmere'],
      visual: 'A rural crime scene: a burned house, slaughtered livestock, and beneath the ruined mill, ancient carvings of a smith at an anvil.',
    },
    'saint-oriens': {
      name: 'Saint Orien\u2019s Watch', biome: 'monastery', timeOfDay: 'day', weather: 'cold wind',
      description: 'A monastery built into a rocky hill, publicly abandoned to plague but secretly holding a small Vigil of Orien. Site of the Second Seal, restored by Shen.',
      connections: ['dunmere', 'redwater-crossing'],
      visual: 'A broken, empty bell tower over an unseen underground bell; smoke from an eastern forge; a deep Hall of the Vigil with a marked stone altar.',
    },
    'redwater-crossing': {
      name: 'Redwater Crossing', biome: 'town', timeOfDay: 'day', weather: 'clear',
      description: 'A busy river market town on the eastern road, home to the Copper Heron inn, where the eastern trail first crossed the party\u2019s path.',
      connections: ['dunmere', 'saint-oriens', 'blackharrow-keep', 'hearthmere'],
      visual: 'Crowded quays, barge-noise, the smell of river mud and frying fish; a coaching inn at the heart of it.',
    },
    'blackharrow-keep': {
      name: 'Blackharrow Keep', biome: 'ruin', timeOfDay: 'night', weather: 'fog',
      description: 'An abandoned fortress north of the eastern road, lately a staging point for a hostile faction. Something genuinely old and Warden-linked lies beneath it.',
      connections: ['redwater-crossing', 'hearthmere'],
      visual: 'A collapsed eastern wall, a central tower lit orange from within at night, a grim staging-ground quiet.',
    },
    greyhaven: {
      name: 'Greyhaven', biome: 'fortress', timeOfDay: 'day', weather: 'clear',
      description: 'A small fortified Aurelion chapter house, destination for a fragment under a new three-party divided-custody arrangement.',
      connections: ['hearthmere'],
      visual: 'Squat grey walls, a disciplined garrison, a vault whose keys deliberately do not all live in one place.',
    },
    hearthmere: {
      name: 'Hearthmere', biome: 'town', timeOfDay: 'evening', weather: 'clear',
      description: 'A town where the party rested and held a strategic council; home of Master Pellan, factor to the Veyron family.',
      connections: ['redwater-crossing', 'blackharrow-keep', 'greyhaven', 'glass-fen'],
      visual: 'Comfortable inns, a merchant\u2019s discreet townhouse, the ordinary warmth that makes the road\u2019s dangers feel earned.',
    },
    'glass-fen': {
      name: 'Glass Fen', biome: 'marsh', timeOfDay: 'grey noon', weather: 'mist',
      description: 'A misty, waterlogged marsh northeast of the main road, reached by old iron lantern-marked pilgrim roads.',
      connections: ['hearthmere', "lantern's rest"],
      visual: 'Standing water and reed-banks under low grey light; iron lanterns on posts along the causeways.',
    },
    "lantern's rest": {
      name: 'Lantern\u2019s Rest', biome: 'village', timeOfDay: 'grey noon', weather: 'mist',
      description: 'A Fen village of some one hundred and fifty souls, built atop pale-grey foundations carved with three concentric circles divided by vertical lines. A lantern hangs at every home.',
      connections: ['glass-fen', 'mirror-abbey'],
      visual: 'Warm lantern-light against the mist; older stone beneath newer timber; a seventh stone on the Abbey path that sometimes burns with a wrong black flame.',
    },
    'mirror-abbey': {
      name: 'Mirror Abbey', biome: 'ruin', timeOfDay: 'grey noon', weather: 'mist',
      description: 'A half-submerged ruined abbey half a mile into the Fen, strongly suspected to hold the Third Seal and its chamber of three black mirrors. NOT yet entered.',
      connections: ["lantern's rest"],
      visual: 'Broken towers standing in black water; a drowned nave; three tall mirrors of dark glass waiting in the dark.',
    },
  };

  /* ----------------------------------------------------------- factions --- */

  var factions = {
    'dunmere-order': {
      name: 'Dunmere Order of Aurelion', emblem: 'A watchfire above an open road',
      summary: 'A respected protective order: escorts, patrols, monster-hunts, disaster response. Newly and reluctantly entangled in matters older than itself.',
      note: 'Not a monolith \u2014 it holds members who would shield Shen as one of their own and members who would use him as an asset.',
    },
    'veiled-witnesses': {
      name: 'The Veiled Witnesses', emblem: 'A closed eye pierced vertically by a line',
      summary: 'A secretive watching society that monitors Keepers, Vigils, rulers, and churches on the principle that no one is trustworthy merely because their role is sacred.',
      note: 'Deeply divided between reformers, traditionalists, and factions the party has only glimpsed. Their besetting sin is paternalism.',
    },
    'vigils-of-orien': {
      name: 'The Vigils of Orien', emblem: 'A lantern suspended above an open hand',
      summary: 'A local seal-custodian tradition that maintains the Watch at Saint Orien\u2019s. Deep but narrow knowledge \u2014 they understand their own Seal well and little beyond it.',
      note: 'Its members can disagree in good faith; caution and urgency are both represented, and both are sometimes right.',
    },
    'house-marrowen': {
      name: 'House Marrowen', emblem: 'Deep green and gold',
      summary: 'An old, politically connected noble house of collectors and antiquarians east of Dunmere. Its goals are reputation, influence, and acquisition.',
      note: 'A house is not a conspiracy; its retainers are not uniformly involved in anything.',
    },
    'lantern-kin': {
      name: 'The Lantern Kin', emblem: 'A lit lantern, a coming-of-age flame, a death-flame',
      summary: 'Lay custodians of Glass Fen who keep inherited lantern-rituals and three-witness truth customs, largely without knowing their true purpose.',
      note: 'Under ideological, not military, attack: households are being argued out of remembering their own traditions.',
    },
  };

  /* -------------------------------------------------------------- items --- */

  var items = {
    'fathers-blade': {
      id: 'fathers-blade', name: 'Father\u2019s Blade', type: 'weapon',
      description: 'A custom longsword forged by Darren Cooper, bearing the Cooper smith\u2019s mark beneath the crossguard. Explicitly mundane \u2014 ordinary craftsmanship made with love.',
      mech: { weaponCategory: 'martial', damage: '1d8', damageType: 'slashing' },
    },
    'chain-mail': {
      id: 'chain-mail', name: 'Shen\u2019s Chain Mail', type: 'armor', armorType: 'heavy',
      description: 'Custom-fitted chain mail made largely by Darren. High quality, but mundane.',
      mech: { baseAC: 16, dexBonus: 'none' },
    },
    'shield': {
      id: 'shield', name: 'Shen\u2019s Shield', type: 'armor', armorType: 'shield',
      description: 'The order\u2019s emblem on the outside, Shen\u2019s initials hidden within. Clawed at Wrenford; its upper rim reinforced by Darren after a heavy cleaver-strike at the mill.',
      mech: { baseAC: 2, dexBonus: 'none' },
    },
    'longbow': {
      id: 'longbow', name: 'Longbow', type: 'weapon',
      description: 'Standard issue. Shen is competent with it, not specialised.',
      mech: { weaponCategory: 'martial', damage: '1d8', damageType: 'piercing', range: [150, 600] },
    },
    'smiths-tools': {
      id: 'smiths-tools', name: 'Smith\u2019s Tools', type: 'tool',
      description: 'A real proficiency, used again and again for locks, mechanisms, forged clues, and ritual ironwork.',
    },
  };

  /* --------------------------------------------------------- characters ---
     Each is a full three-layer {base, progression, runtime} object. Explicit
     per-level hit points are supplied so this build needs no SRD data. Extra
     descriptive fields are hung on `base` after the fact; derive() ignores
     anything it does not read. */

  /**
   * Materialise the gear a character is described as wearing.
   *
   * `equipped` names item ids, but `derive` resolves armour through the
   * character's inventory — so a paladin described as wearing chain mail with
   * an empty pack derives as unarmoured. Shen's AC came out as 13 instead of
   * the canonical 18, which no unit test caught because they asserted against
   * hand-built fixtures rather than against what the campaign actually loads.
   *
   * Named campaign items (Father's Blade, his shield) carry their own
   * description and history; anything else is looked up in the SRD table.
   */
  function equipGear(c, spec, named) {
    var ITEMS = (typeof require !== 'undefined' ? tryRequireItems() : null) ||
      (global.DND && global.DND.Data && global.DND.Data.ITEMS) || {};
    c.runtime.inventory = c.runtime.inventory || [];
    var seen = {};
    Object.keys(spec.equipped || {}).forEach(function (slot) {
      var id = spec.equipped[slot];
      if (!id || seen[id]) return;
      seen[id] = true;
      var custom = named && named[id];
      var srd = ITEMS[id] || ITEMS[id.replace(/-/g, '')] ||
        (id === 'chain-mail' ? ITEMS['chain-mail-armor'] : null);
      var base = custom || srd || { id: id, name: id };
      c.runtime.inventory.push({
        uid: id,
        id: (srd && srd.id) || (custom && custom.baseItem) || id,
        name: base.name || id,
        slot: slot,
        equipped: true,
        damage: base.damage || (srd && srd.damage) || null,
        ac: base.ac || (srd && srd.ac) || null,
        properties: base.properties || (srd && srd.properties) || [],
        description: base.description || base.text || '',
        history: base.history || '',
      });
    });
    (spec.carrying || []).forEach(function (entry) {
      var srd = ITEMS[entry.id] || {};
      c.runtime.inventory.push(Object.assign({
        uid: entry.uid || entry.id,
        name: srd.name || entry.id,
        damage: srd.damage || null,
        ac: srd.ac || null,
        properties: srd.properties || [],
      }, entry));
    });
    return c;
  }

  var _itemCache;
  function tryRequireItems() {
    if (_itemCache !== undefined) return _itemCache;
    try { _itemCache = require('../js/data/srd_items.js').ITEMS; }
    catch (e) { _itemCache = null; }
    return _itemCache;
  }

  function build(spec, extraBase, oathSpells) {
    var c = Character.buildFromSpec(spec);
    if (extraBase) Object.keys(extraBase).forEach(function (k) { c.base[k] = extraBase[k]; });
    if (oathSpells && oathSpells.length) {
      /* Oath spells are ALWAYS prepared and never count against the normal
         prepared list; storing them both in a dedicated field and in the
         prepared list is what makes "always prepared" true at derive time. */
      c.progression.oathSpells = oathSpells.slice();
      oathSpells.forEach(function (s) {
        if (c.progression.preparedSpells.indexOf(s) < 0) c.progression.preparedSpells.push(s);
      });
    }
    equipGear(c, spec, NAMED_GEAR);
    return c;
  }

  /* Gear with a story attached. These are the objects the campaign record
     describes in its own words, so they carry that wording rather than the
     generic SRD entry. */
  var NAMED_GEAR = {
    'fathers-blade': {
      name: 'Father\u2019s Blade', baseItem: 'longsword',
      damage: { dice: '1d8', versatileDice: '1d10', type: 'slashing' },
      properties: ['versatile'],
      description: 'A longsword forged by Darren Cooper, the Cooper smith\u2019s mark struck beneath the crossguard.',
      history: 'Made for Shen rather than sold. His father\u2019s way of saying something he did not say.',
    },
    'shield': {
      name: 'Shen\u2019s Shield', baseItem: 'shield',
      ac: { mode: 'add', value: 2 },
      description: 'The order\u2019s emblem on the outside; Shen\u2019s initials scratched where only he would look.',
      history: 'Clawed at Wrenford. The top rim reinforced by Darren after a cleaver caught it at the mill.',
    },
    'chain-mail': {
      name: 'Fitted Chain Mail', baseItem: 'chain-mail',
      ac: { base: 16, maxDex: 0, category: 'heavy', stealthDisadvantage: true, strRequirement: 13 },
      description: 'Made to measure by his father, and altered twice since as he grew into it.',
    },
  };

  var characters = {
    shen: build({
      name: 'Shen Cooper', raceId: 'human',
      classId: 'paladin', subclassId: 'oath-devotion', levels: 3,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 16 },
      hpRolls: [10, 6, 6],
      proficiencies: {
        saves: ['wis', 'cha'],
        skills: ['athletics', 'persuasion', 'animalHandling'],
        tools: ['smiths-tools'],
        armor: ['light', 'medium', 'heavy', 'shields'],
        weapons: ['simple', 'martial'],
        languages: ['common'],
      },
      fightingStyles: ['protection'],
      preparedSpells: ['bless', 'shield-of-faith', 'command', 'compelled-duel'],
      equipped: { armor: 'chain-mail', shield: 'shield', mainHand: 'fathers-blade' },
      runtime: { resources: { 'lay-on-hands': 15, 'channel-divinity': 1 }, gold: 0 },
    }, {
      age: 21, alignment: 'LG', deity: 'Aurelion, Light of the Vigil', oath: 'Oath of Devotion',
      background: 'Blacksmith\u2019s child, trained by the Dunmere paladin order from age sixteen',
      appearance: 'No fixed face or build recorded. Fitted chain mail; a shield marked outside and hidden-marked within; Father\u2019s Blade; a birthmark of the Keeper sigil on the inside of the left forearm.',
      mount: { name: 'Bracken', kind: 'a calm chestnut gelding' },
      channelDivinity: ['Sacred Weapon (+3 to attack rolls, weapon glows and counts as magical)', 'Turn the Unholy'],
    }, ['protection-from-evil-and-good', 'sanctuary']),

    aldren: build({
      name: 'Sir Aldren Vey', raceId: 'human',
      classId: 'paladin', subclassId: 'oath-devotion', levels: 6,
      abilities: { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 14 },
      hpRolls: [10, 6, 6, 6, 6, 6],
      proficiencies: {
        saves: ['wis', 'cha'],
        skills: ['athletics', 'insight', 'intimidation'],
        armor: ['light', 'medium', 'heavy', 'shields'], weapons: ['simple', 'martial'], languages: ['common'],
      },
      fightingStyles: ['protection'],
      preparedSpells: ['bless', 'shield-of-faith', 'command', 'lesser-restoration', 'aid'],
      equipped: { armor: 'chain-mail', shield: 'shield' },
      runtime: { gold: 40 },
    }, { age: 48, alignment: 'LG', deity: 'Aurelion, Light of the Vigil',
      background: 'Career paladin; recommended Shen for recruitment at sixteen',
      powerBand: 'DM-Bible hidden band: roughly a level-6 paladin' },
      ['protection-from-evil-and-good', 'sanctuary']),

    mara: build({
      name: 'Dame Mara Thorne', raceId: 'human',
      classId: 'ranger', subclassId: 'hunter', levels: 5,
      abilities: { str: 12, dex: 16, con: 14, int: 12, wis: 14, cha: 10 },
      hpRolls: [10, 6, 6, 6, 6],
      proficiencies: {
        saves: ['str', 'dex'],
        skills: ['stealth', 'perception', 'survival', 'investigation'],
        armor: ['light', 'medium', 'shields'], weapons: ['simple', 'martial'], languages: ['common'],
      },
      fightingStyles: ['archery'],
      preparedSpells: ['hunters-mark', 'cure-wounds'],
      equipped: {},
      runtime: { gold: 25 },
    }, { age: 32, alignment: 'LN',
      background: 'Disciplined scout and archer; tactician of positioning and overwatch',
      powerBand: 'DM-Bible hidden band: roughly a level-5 martial ranger-rogue' }),

    corvin: build({
      name: 'Brother Corvin Hale', raceId: 'human',
      classId: 'cleric', subclassId: 'life-domain', levels: 5,
      abilities: { str: 12, dex: 10, con: 14, int: 12, wis: 16, cha: 12 },
      hpRolls: [8, 5, 5, 5, 5],
      proficiencies: {
        saves: ['wis', 'cha'],
        skills: ['medicine', 'religion', 'insight'],
        armor: ['light', 'medium', 'shields'], weapons: ['simple'], languages: ['common'],
      },
      preparedSpells: ['cure-wounds', 'shield-of-faith', 'bless', 'lesser-restoration', 'spiritual-weapon'],
      equipped: { armor: 'chain-mail' },
      runtime: { gold: 18, resources: { 'channel-divinity': 1 } },
    }, { age: 27, alignment: 'NG', deity: 'Aurelion, Light of the Vigil',
      background: 'Entered the clergy in grief; a healer who trusts preparation as much as prayer',
      powerBand: 'DM-Bible hidden band: roughly a level-5 cleric' }),
  };

  /* ------------------------------------------------------------ campaign -- */

  var shenCooper = {
    id: 'shen-cooper',
    title: 'The Divided Steel',
    premise: 'You are Shen Cooper, a young paladin and a blacksmith\u2019s son, lately sworn to the Oath of Devotion. An ancient guardian sleeps in a sword broken into four fragments, and something is prying at the old seals that keep a far older danger asleep. You are following the scattered Steel east and north, trying to protect people without becoming the kind of protector you would have to fear.',
    tone: 'Heroic fantasy that oscillates between warmth and danger: grounded people, moral choices, tactical combat, institutional politics, and old mysteries. Ordinary life \u2014 meals, repairs, teasing, frightened villagers \u2014 matters as much as the cosmic stakes and is what makes them feel earned.',
    voice: [
      'Close third person, present tense, plain and concrete; lead with what a person would actually notice.',
      'Let people speak in their own register \u2014 Aldren corrects, Mara reports, Corvin jokes to stay upright \u2014 and keep NPC lines short and diagnostic rather than speechy.',
      'Keep the central question alive under the action: how much power can a protector accept before protection becomes control?',
      'Teach the rules in the fiction when Shen\u2019s training would know something the player might not, and never open with cosmic prophecy when a meal, a repair, or a frightened traveller would ground the scene better.',
    ].join(' '),

    openCanon: [
      'Aurelion, the Light of the Vigil, is the worshipped patron of guardians, watchfires, and lawful mercy; the Dunmere Order of Aurelion does mundane, admirable protective work across the region.',
      'The dead have been rising at old ruined sites, and worse things than the dead; this is new, and it frightens people who thought such stories were folklore.',
      'Shen Cooper is a paladin and the son of the Dunmere smith Darren Cooper; he was recruited at sixteen and trained five years before his first mission.',
      'Old noble houses, a river-market economy, and a network of chapels and chapter houses knit the region together along a few well-travelled roads.',
      'Glass Fen is a misty marsh of lantern-keepers, reached by old pilgrim causeways lined with iron lanterns; its people light a flame at every home.',
      'A person\u2019s knowledge has a source: nobody knows what their life could not have taught them.',
    ],

    /* Only the NON-spoiler hard rules live here. The spoiler-bearing "do not
       change" instructions (do not make Cassian guilty, do not rewrite Malrec,
       and the rest) are attached to their facts in the bible and enter a
       prompt only once the underlying secret is revealable. */
    hardRules: [
      'Aurelion is a genuine divine presence and answers those who keep faith; the church is imperfect and politically divided, but the deity is not a fraud.',
      'Not every threat is scaled to the party; some dangers are too strong to fight, and retreat, negotiation, scouting, and preparation are always legitimate.',
      'Civilians are people, not props: they have names, needs, fear, and courage, rescued people can recur, and deaths matter.',
      'The Keeper is chosen for a function, not because events are predestined; Shen\u2019s choices are meant to stay morally real, so avoid leaning on prophecy.',
      'Companions are not static: their trust and opinion of Shen persist and are never reset between chapters.',
      'Shen\u2019s gear carries its history \u2014 the clawed shield, the reinforced rim \u2014 and Father\u2019s Blade is ordinary steel unless deeds earn it more.',
      'When a player tries something that breaks the expected plan, answer with real consequences rather than an impossible "no".',
      'Tell the player when Shen would obviously know a rule or a fact, even if the player does not; never punish the player for lacking Shen\u2019s training.',
    ],

    locations: locations,
    factions: factions,
    npcs: npcs,
    items: items,
    characters: characters,
  };

  global.DND = global.DND || {};
  global.DND.Campaigns = global.DND.Campaigns || {};
  global.DND.Campaigns.shenCooper = shenCooper;
  if (typeof module !== 'undefined' && module.exports) module.exports = shenCooper;
})(typeof window !== 'undefined' ? window : globalThis);
