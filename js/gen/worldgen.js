/*
 * worldgen.js — somewhere to be, and something to do there.
 *
 * A "new game" that drops a lone character into an empty room is not a game.
 * The first UI session test found exactly that: one actor, no scene, and an
 * action bar offering nothing but "search the area" in a place with no area to
 * search.
 *
 * This is deliberately modest. It is not a world simulator; it builds one
 * coherent opening scene — a place, a reason to be there, a person to talk to,
 * and something that wants the party gone — scaled to the party's level and
 * reproducible from a seed. That is enough to start a campaign, and everything
 * after it can come from play.
 */
(function (global) {
  'use strict';

  function req(p) { return typeof require !== 'undefined' ? require(p) : null; }
  var RNG = (global.DND && global.DND.RNG) || (req('../rng.js') || {}).RNG;
  var State = (global.DND && global.DND.State) || req('../engine/state.js');
  var Rules = (global.DND && global.DND.Rules) || req('../engine/rules.js');
  var Openings = (global.DND && global.DND.Openings) || req('./openings.js');
  var Companions = (global.DND && global.DND.Companions) || req('./companions.js');

  function monsterData() {
    var g = global.DND && global.DND.Data && global.DND.Data.MONSTERS;
    if (g) return g;
    try { return require('../data/srd_monsters.js').MONSTERS; } catch (e) { return null; }
  }

  /* Each opening is a place with a reason to be in it. The threat list names
     SRD monster ids; whichever of them the data actually has is used, so a
     trimmed data file degrades to a smaller bestiary rather than breaking. */
  var OPENINGS = [
    {
      id: 'drowned-chapel', name: 'the drowned chapel', biome: 'ruin',
      timeOfDay: 'afternoon', weather: 'overcast',
      hook: 'A chapel half-swallowed by the river two winters ago. Something has been denning in what is left of the nave.',
      threats: ['gnoll', 'kobold', 'giant-rat', 'skeleton'],
      boss: ['gnoll-pack-lord', 'bugbear', 'ogre'],
      localName: 'Maerin Volk', localRole: 'the last warden of the parish',
      localWants: 'the chapel emptied before the spring flood takes the rest of it',
      localVoice: 'Old, unhurried, and entirely unimpressed by adventurers. Says half of what she means and lets you work out the rest.',
      lines: ['You\u2019ll want boots you don\u2019t mind losing.', 'It was a church once. Try to remember that.', 'Three came before you. Two came back.'],
    },
    {
      id: 'kestrel-mine', name: 'the Kestrel cutting', biome: 'cave',
      timeOfDay: 'morning', weather: 'clear',
      hook: 'A tin working that stopped paying out a month ago. The crew that went down to find out why has not come up.',
      threats: ['kobold', 'giant-spider', 'stirge', 'skeleton'],
      boss: ['ochre-jelly', 'bugbear', 'gelatinous-cube'],
      localName: 'Hew Danning', localRole: 'the mine\u2019s reluctant foreman',
      localWants: 'his people back, and failing that, an honest answer about what took them',
      localVoice: 'Blunt, tired, and carrying more guilt than he will admit to. Counts costs out loud.',
      lines: ['Nine went down. I signed for every one of them.', 'Don\u2019t go past the second gallery. Just don\u2019t.', 'I\u2019ll pay what I have. It isn\u2019t much.'],
    },
    {
      id: 'hollow-barrow', name: 'the hollow barrow', biome: 'crypt',
      timeOfDay: 'dusk', weather: 'fog',
      hook: 'A barrow that has stood shut since anyone can remember, and has lately stopped being shut.',
      threats: ['skeleton', 'zombie', 'giant-rat', 'shadow'],
      boss: ['ghoul', 'wight', 'specter'],
      localName: 'Sister Ilke', localRole: 'a hedge-priest with no congregation left',
      localWants: 'the barrow closed properly, with the rites said over it this time',
      localVoice: 'Gentle and absolutely immovable. Apologises while asking for something enormous.',
      lines: ['I would go myself. I have gone myself. It did not help.', 'They were people. Whatever else they are now, they were that first.', 'Say the words with me before you go down.'],
    },
    {
      id: 'toll-bridge', name: 'the Ashford toll bridge', biome: 'river',
      timeOfDay: 'noon', weather: 'clear',
      hook: 'Someone has started charging a toll on a bridge that never had one, and the road east has gone quiet.',
      threats: ['bandit', 'guard', 'wolf', 'goblin'],
      boss: ['bandit-captain', 'hobgoblin', 'orc'],
      localName: 'Petra Oarswell', localRole: 'a carter who has stopped being able to carry',
      localWants: 'the road open, without a massacre she will have to live beside',
      localVoice: 'Quick, practical, talks with her hands. Negotiates out of habit.',
      lines: ['Four days I\u2019ve been sat here. Four.', 'They\u2019re not soldiers. That\u2019s the trouble \u2014 soldiers you can reason with.', 'I want them gone. I didn\u2019t say dead.'],
    },
  ];

  function pickAvailable(rng, ids, MONSTERS) {
    var have = (ids || []).filter(function (id) { return MONSTERS && MONSTERS[id]; });
    if (!have.length) return null;
    return rng.pick(have);
  }

  /**
   * Size the opposition against the party using the real encounter maths, so
   * the first fight is a fight rather than a formality or a wipe.
   */
  function encounterSize(rng, partyLevels, cr) {
    var n = partyLevels.length;
    var count = cr <= 0.25 ? n + rng.int(1, 2)
      : cr <= 1 ? Math.max(2, n)
        : Math.max(1, Math.ceil(n / 2));
    return Math.max(1, Math.min(6, count));
  }

  function statblockActor(id, statblock, index, side, pos) {
    var hp = statblock.hp || (statblock.hitPoints && statblock.hitPoints.average) || 10;
    var ab = statblock.abilities || {};
    return {
      id: id,
      name: statblock.name + (index != null ? '' : ''),
      side: side,
      kind: 'monster',
      statblock: statblock,
      base: {
        name: statblock.name,
        abilities: {
          str: ab.str || 10, dex: ab.dex || 10, con: ab.con || 10,
          int: ab.int || 10, wis: ab.wis || 10, cha: ab.cha || 10,
        },
        proficiencies: { skills: [], saves: [] },
        classes: [],
      },
      progression: { xp: 0, levels: [] },
      runtime: {
        hp: hp, hpMax: hp, tempHp: 0, conditions: {}, exhaustion: 0,
        concentratingOn: null, attuned: [], equipped: {}, inventory: [],
        deathSaves: { successes: 0, failures: 0 }, resources: {}, gold: 0,
        pos: pos,
        /* Monster actions come from the statblock, so the derived-attack
           builder must not overwrite them with an unarmed strike. */
        attacksAuthored: true,
        attacks: (statblock.actions || [])
          .filter(function (a) { return /weapon/.test(a.type || '') || a.damage; })
          .map(function (a) {
            var d = (a.damage && a.damage[0]) || {};
            return {
              name: a.name,
              toHit: a.toHit != null ? a.toHit : 4,
              damage: (d.dice || '1d6') + (d.flat ? '+' + d.flat : ''),
              damageType: d.type || 'bludgeoning',
              abilityMod: 0,
              reach: a.reach || 5,
            };
          }),
      },
    };
  }

  /**
   * Build an opening scene into an existing state.
   *
   * The party is expected to be present already (the setup wizard makes the
   * characters); this adds the place, the person and the problem.
   */
  function generateOpening(state, opts) {
    opts = opts || {};
    var rng = opts.rng || (state.rng ? state.rng.fork('worldgen') : new RNG(String(Date.now())));
    var MONSTERS = monsterData();

    /* Fill the table to four BEFORE anything else, because everything after
       this depends on who is actually here: which opening suits them, what
       bond they share, and how big the encounter should be if there is one.
       A one-player game used to begin with a lone character and a monster. */
    var companionIds = [];
    if (Companions && opts.fillParty !== false) {
      try { companionIds = Companions.fillParty(state, { rng: rng, size: opts.partySize }); }
      catch (e) { companionIds = []; }
    }

    /* Who the party are, for choosing a scene that belongs to them. */
    var partyIds = State.partyIds(state);
    var who = partyIds.map(function (id) {
      var a = state.actors[id];
      var base = a.base || {};
      return {
        classId: ((base.classes || [{}])[0] || {}).classId,
        raceId: base.raceId, subraceId: base.subraceId,
        backgroundId: base.backgroundId,
      };
    });

    /* Scored against the party rather than drawn at random, so a wizard
       usually gets the library and a soldier the muster yard — and sometimes
       does not, because a generator that always agrees with you is a lookup
       table. */
    var scene = opts.opening ||
      (Openings ? Openings.chooseOpening(rng, who, opts) : rng.pick(OPENINGS));
    var bond = Openings ? Openings.chooseBond(rng, scene, who, opts) : null;

    var levels = partyIds.map(function (id) {
      var a = state.actors[id];
      return (a.progression && a.progression.levels && a.progression.levels.length) || 1;
    });
    if (!levels.length) levels = [1];
    var avg = Math.round(levels.reduce(function (a, b) { return a + b; }, 0) / levels.length);

    /* Place the party along the bottom of a small grid. */
    partyIds.forEach(function (id, i) {
      state.actors[id].runtime.pos = { x: 2 + i, y: 7 };
    });

    var actorsAdded = [];

    /* The local: someone with a reason to talk to strangers. */
    var localId = 'local-' + scene.id;
    State.addActor(state, {
      id: localId,
      name: scene.localName,
      side: 'neutral',
      kind: 'npc',
      role: scene.localRole,
      persona: scene.localRole,
      base: {
        name: scene.localName,
        abilities: { str: 10, dex: 10, con: 10, int: 11, wis: 12, cha: 11 },
        proficiencies: { skills: [], saves: [] }, classes: [],
      },
      progression: { xp: 0, levels: [] },
      runtime: {
        hp: 9, hpMax: 9, tempHp: 0, conditions: {}, exhaustion: 0,
        concentratingOn: null, attuned: [], equipped: {}, inventory: [],
        deathSaves: { successes: 0, failures: 0 }, resources: {}, gold: 4,
        pos: { x: 4, y: 5 },
      },
    });
    actorsAdded.push(localId);

    /* The problem \u2014 if this scene has one standing in front of them.
       Most do not. Twelve of the nineteen openings begin with nobody hostile
       present at all: a taproom, a library after hours, a cart with a bad
       wheel. Spawning monsters unconditionally is what made every generated
       game start by rolling initiative, whatever the scene said it was. */
    var mookId = null, bossId = null;
    var enemies = [];
    var hostile = scene.opens === 'violent' || scene.opens === 'tense';

    if (hostile && (scene.threats || scene.boss)) {
      mookId = pickAvailable(rng, scene.threats, MONSTERS);
      bossId = pickAvailable(rng, scene.boss, MONSTERS);
    }

    if (MONSTERS && mookId) {
      var mook = MONSTERS[mookId];
      var cr = typeof mook.cr === 'number' ? mook.cr : 0.25;
      var count = encounterSize(rng, levels, cr);
      for (var i = 0; i < count; i++) {
        var id = 'foe-' + mookId + '-' + (i + 1);
        var a = statblockActor(id, mook, i, 'enemy', { x: 3 + i, y: 2 });
        a.name = mook.name + (count > 1 ? ' ' + String.fromCharCode(65 + i) : '');
        State.addActor(state, a);
        enemies.push(id);
      }
      if (bossId && avg >= 2 && MONSTERS[bossId]) {
        var bid = 'foe-' + bossId;
        var boss = statblockActor(bid, MONSTERS[bossId], null, 'enemy', { x: 6, y: 1 });
        boss.isBoss = true;
        State.addActor(state, boss);
        enemies.push(bid);
      }
    }

    state.locationId = scene.id;
    state.flags = state.flags || {};
    state.flags.openingScene = scene.id;

    /* One quest, so the journal has something in it and the AI seats have a
       stated objective rather than inferring one from the furniture. */
    state.quests = state.quests || {};
    state.quests['clear-' + scene.id] = {
      id: 'clear-' + scene.id,
      status: 'open',
      title: questTitleFor(scene),
      objectives: { 'find-out': 'open', 'resolve': 'open' },
      notes: [scene.hook],
    };

    State.refreshAllDerived(state);

    return {
      scene: scene,
      bond: bond,
      locationId: scene.id,
      localId: localId,
      enemyIds: enemies,
      companionIds: companionIds,
      /* Whether anything hostile is present when the first line is read. The
         caller decides whether to roll initiative; it must not have to infer
         that from the enemy list, because a tense scene has enemies in it and
         still opens with talking. */
      opens: scene.opens || 'peaceful',
      /* The person with the problem, handed to the narrator so paragraph
         three can name them and say what they want. Authored on every scene
         since the beginning and never once reaching the page. */
      local: {
        id: localId,
        name: scene.localName,
        role: scene.localRole,
        wants: scene.localWants,
        voice: scene.localVoice,
        lines: (scene.lines || []).slice(),
      },
      campaign: campaignFor(scene, opts),
    };
  }

  /** A quest title that fits the kind of scene it came from. */
  function questTitleFor(scene) {
    if (scene.kind === 'combat') return 'Deal with what is in ' + scene.name;
    if (scene.kind === 'mystery') return 'Find out what happened at ' + scene.name;
    if (scene.kind === 'crisis') return 'Get everyone out of ' + scene.name;
    if (scene.kind === 'study') return 'Make sense of what was found at ' + scene.name;
    if (scene.kind === 'work') return 'See the work through at ' + scene.name;
    if (scene.kind === 'travel') return 'Get where you are going';
    return 'See what comes of ' + scene.name;
  }

  /** A campaign object shaped the way prompt.buildSystem expects. */
  /**
   * The country around a generated opening.
   *
   * A sandbox used to be a single location with no connections, so `travel`
   * could never be offered there whatever the verb did — a world you cannot
   * leave is a room. Three neighbours is enough to make the map feel like a
   * place without pretending to be a campaign: somewhere to resupply, somewhere
   * to get into trouble, and somewhere in between.
   */
  var NEIGHBOURS = [
    { suffix: 'crossroads', name: 'the crossroads', biome: 'road',
      description: 'Three roads and a leaning signpost. People pass; few stop.' },
    { suffix: 'hamlet', name: 'Millbrook', biome: 'village',
      description: 'A dozen houses, a mill, and a headman who would rather you moved on.' },
    { suffix: 'wood', name: 'the old wood', biome: 'forest',
      description: 'Older than the road, and less interested in it.' },
    { suffix: 'ford', name: 'the ford', biome: 'river',
      description: 'Shallow in summer. It is not summer.' },
    { suffix: 'workings', name: 'the abandoned workings', biome: 'cave',
      description: 'Someone dug here for something, and stopped.' },
    { suffix: 'barrows', name: 'the barrow field', biome: 'crypt',
      description: 'Low mounds in rows, most of them undisturbed.' },
  ];

  function neighboursFor(scene, opts) {
    opts = opts || {};
    var rng = opts.rng || new RNG('around:' + scene.id);
    var pool = NEIGHBOURS.slice();
    rng.shuffle(pool);
    var chosen = pool.slice(0, 3);
    return chosen.map(function (n, i) {
      var id = scene.id + '-' + n.suffix;
      return {
        id: id, name: n.name, biome: n.biome, description: n.description,
        timeOfDay: scene.timeOfDay, weather: scene.weather,
        /* Everywhere connects back to the opening, and the last two to each
           other, so the map is a loop rather than a star with dead ends. */
        connections: [scene.id].concat(
          chosen[(i + 1) % chosen.length] === n ? [] : [scene.id + '-' + chosen[(i + 1) % chosen.length].suffix]
        ),
      };
    });
  }

  function campaignFor(scene, opts) {
    opts = opts || {};
    /* Computed once: the country around the opening feeds both the map and the
       thread that asks the party to go and look at it. */
    var neighbours = neighboursFor(scene, opts);
    return {
      id: 'sandbox-' + scene.id,
      title: opts.title || ('A matter at ' + scene.name),
      premise: scene.hook,
      tone: opts.tone || 'grounded, physical, a little grim. Ordinary people with ordinary problems that happen to be dangerous.',
      openCanon: [
        'This is a small place at the edge of somewhere larger.',
        /* "Nobody here has been rescued by adventurers before" was meant as
           tone guidance and the model recited it, badly, in three openings
           out of fourteen: "some larger place where nobody has been saved
           before by an adventurer's party", "this quiet corner town where no
           one has been saved by adventurers before". Both "adventurers" and
           "rescued" are words from outside the fiction, in a narrator whose
           entire discipline is staying inside it. Reworded to something that
           cannot be turned meta. */
        'Nothing extraordinary has happened here in living memory.',
      ],
      hardRules: [],
      locations: (function () {
        var m = {};
        /* The opening scene, plus somewhere to go from it.
           A one-location sandbox had no exits at all, which meant travel was
           unreachable there however well the verb worked — and a world you
           cannot leave is a room, not a sandbox. */
        m[scene.id] = {
          id: scene.id, name: scene.name, biome: scene.biome,
          description: scene.hook,
          timeOfDay: scene.timeOfDay, weather: scene.weather,
          connections: neighbours.map(function (n) { return n.id; }),
        };
        neighbours.forEach(function (n) { m[n.id] = n; });
        return m;
      })(),
      npcs: (function () {
        var m = {};
        m['local-' + scene.id] = {
          id: 'local-' + scene.id,
          name: scene.localName,
          role: scene.localRole,
          voice: scene.localVoice,
          wants: scene.localWants,
          lines: scene.lines.slice(),
        };
        return m;
      })(),
      factions: {}, items: {}, characters: {},
      /* A sandbox deserves threads of its own. Without any, the journal read
         "No quests recorded" for the whole of a generated game, and the quest
         engine had nothing to track. */
      quests: [
        {
          id: 'sandbox-' + scene.id + '-hook',
          title: scene.hook || ('Settle the matter at ' + scene.name + '.'),
          status: 'open',
          triggers: [
            { on: 'arrive', where: scene.id, objective: 'be-here',
              text: 'took the matter on at ' + scene.name },
            { on: 'defeat', role: 'monster', objective: 'clear-the-way',
              text: 'put down whatever was waiting', completes: true,
              doneBeat: 'The matter at ' + scene.name + ' is settled.' },
          ],
        },
        {
          id: 'sandbox-' + scene.id + '-around',
          title: 'See what lies around ' + scene.name + '.',
          status: 'open',
          triggers: neighbours.map(function (n) {
            return {
              on: 'arrive', where: n.id, objective: 'seen-' + n.suffix,
              text: 'walked as far as ' + n.name,
            };
          }),
        },
      ],
    };
  }

  var api = {
    OPENINGS: OPENINGS,
    generateOpening: generateOpening,
    campaignFor: campaignFor,
    encounterSize: encounterSize,
  };

  global.DND = global.DND || {};
  global.DND.Worldgen = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
