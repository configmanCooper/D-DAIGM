/**
 * contents.js — what a place actually contains.
 *
 * The engine has always been able to pick a lock, disarm a trap, pull a lever,
 * read a book, follow a trail, forage, climb, swim, buy and sell. What it never
 * had was anywhere to do any of it: `legalMoves` reads the scene from a context
 * object, and nothing ever described a scene. Twenty-odd verbs were therefore
 * unreachable in a finished game — the rules were all there and the world was
 * an empty room.
 *
 * Rather than hand-authoring contents for every location — which does not scale
 * to a generated sandbox, and would turn campaign prose into a database — a
 * place is furnished from its BIOME. A ruin has a barred door and something
 * under the rubble; a marsh has a channel to swim and tracks in the mud; a town
 * has somebody selling things and a stable. The result is deterministic in the
 * location id, so the same place is the same place on every visit and across
 * every reload, and it is stored in `state.locations` so that what the party
 * takes away stays taken.
 *
 * Not to be confused with `gen/scene.js`, which draws a scene; this one decides
 * what is in it.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DND = root.DND || {};
  root.DND.Contents = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* Seeded, so this module owns no randomness of its own. */
  function RNGFor(seed) {
    var g = (typeof globalThis !== 'undefined' ? globalThis : this);
    var R = (g.DND && g.DND.RNG) ||
      (typeof require !== 'undefined' ? require('../rng.js').RNG : null);
    return new R(seed);
  }

  function items() {
    var g = (typeof globalThis !== 'undefined' ? globalThis : this);
    if (g.DND && g.DND.Data && g.DND.Data.ITEMS) return g.DND.Data.ITEMS;
    if (typeof require !== 'undefined') {
      try { return require('../data/srd_items.js').ITEMS; } catch (e) { /* browser */ }
    }
    return {};
  }

  /**
   * What each kind of place tends to hold. `chance` is out of one.
   *
   * Everything is optional: a place with nothing in it is a legitimate place,
   * and a game where every room has a trap is a worse game than one where a
   * trap means something.
   */
  var BIOME_PROFILE = {
    town: {
      merchants: 1, mounts: 0.8, readables: 0.7, interactables: 0.5,
      loot: 0.2, locked: 0.15, trap: 0, forage: 0, tracks: 0.1,
      climb: 0.2, swim: 0, jump: 0,
    },
    village: {
      merchants: 0.7, mounts: 0.5, readables: 0.4, interactables: 0.5,
      loot: 0.25, locked: 0.2, trap: 0, forage: 0.5, tracks: 0.3,
      climb: 0.2, swim: 0.1, jump: 0,
    },
    monastery: {
      merchants: 0.1, mounts: 0.2, readables: 1, interactables: 0.6,
      loot: 0.3, locked: 0.5, trap: 0.1, forage: 0.2, tracks: 0.1,
      climb: 0.3, swim: 0, jump: 0.1,
    },
    fortress: {
      merchants: 0.3, mounts: 0.6, readables: 0.5, interactables: 0.7,
      loot: 0.3, locked: 0.6, trap: 0.2, forage: 0, tracks: 0.2,
      climb: 0.6, swim: 0, jump: 0.2,
    },
    ruin: {
      merchants: 0, mounts: 0, readables: 0.6, interactables: 0.8,
      loot: 0.7, locked: 0.6, trap: 0.5, forage: 0.2, tracks: 0.5,
      climb: 0.7, swim: 0.2, jump: 0.5,
    },
    crypt: {
      merchants: 0, mounts: 0, readables: 0.7, interactables: 0.8,
      loot: 0.8, locked: 0.7, trap: 0.7, forage: 0, tracks: 0.3,
      climb: 0.4, swim: 0.1, jump: 0.4,
    },
    cave: {
      merchants: 0, mounts: 0, readables: 0.15, interactables: 0.5,
      loot: 0.6, locked: 0.2, trap: 0.4, forage: 0.4, tracks: 0.6,
      climb: 0.8, swim: 0.4, jump: 0.5,
    },
    marsh: {
      merchants: 0, mounts: 0, readables: 0.1, interactables: 0.3,
      loot: 0.4, locked: 0.1, trap: 0.3, forage: 0.8, tracks: 0.8,
      climb: 0.2, swim: 0.9, jump: 0.6,
    },
    river: {
      merchants: 0.3, mounts: 0.3, readables: 0.2, interactables: 0.5,
      loot: 0.3, locked: 0.2, trap: 0.2, forage: 0.7, tracks: 0.6,
      climb: 0.3, swim: 0.9, jump: 0.5,
    },
    forest: {
      merchants: 0, mounts: 0.1, readables: 0.1, interactables: 0.3,
      loot: 0.4, locked: 0.05, trap: 0.3, forage: 0.9, tracks: 0.9,
      climb: 0.8, swim: 0.3, jump: 0.5,
    },
    road: {
      merchants: 0.4, mounts: 0.4, readables: 0.3, interactables: 0.3,
      loot: 0.3, locked: 0.1, trap: 0.2, forage: 0.5, tracks: 0.7,
      climb: 0.2, swim: 0.2, jump: 0.3,
    },
  };
  var DEFAULT_PROFILE = BIOME_PROFILE.road;

  /* Names, so a scene reads as a place rather than a list of affordances. */
  var FLAVOUR = {
    locked: {
      town: ['a strongbox behind the counter', 'the warehouse door'],
      village: ['the miller\u2019s store room', 'a banded chest'],
      monastery: ['the reliquary grille', 'a scriptorium cabinet'],
      fortress: ['the armoury door', 'a barred postern'],
      ruin: ['a rusted iron door', 'a chest wedged under fallen masonry'],
      crypt: ['a sealed sarcophagus', 'the vault grille'],
      cave: ['a miner\u2019s padlocked cage', 'a wedged strongbox'],
      marsh: ['a swollen chest half in the water', 'a bound coffer'],
      river: ['the lockkeeper\u2019s box', 'a chained cabinet'],
      forest: ['a hunter\u2019s cache', 'a strapped trunk'],
      road: ['an abandoned strongbox', 'a locked toll chest'],
    },
    trap: {
      monastery: ['a pressure plate under the flagstones'],
      fortress: ['a tripwire across the passage', 'a murder-hole mechanism'],
      ruin: ['a pressure plate under the rubble', 'a rigged lintel'],
      crypt: ['a scythe blade set in the wall', 'a dart mechanism in the lintel'],
      cave: ['a covered pit', 'a deadfall of loose rock'],
      marsh: ['a hunter\u2019s snare', 'a staked pit under the reeds'],
      river: ['a snare set on the bank'],
      forest: ['a poacher\u2019s snare', 'a covered pit'],
      road: ['a tripwire across the verge'],
    },
    interactables: {
      town: ['the well winch', 'a shuttered notice board'],
      village: ['the mill sluice', 'a hand pump'],
      monastery: ['a prayer wheel', 'the bell rope'],
      fortress: ['the portcullis winch', 'a signal brazier'],
      ruin: ['a rusted lever', 'a cracked altar stone'],
      crypt: ['a stone lever set in the wall', 'a shifted slab'],
      cave: ['a wedged support beam', 'a miner\u2019s windlass'],
      marsh: ['a rotted sluice gate', 'a leaning marker post'],
      river: ['the ferry capstan', 'a mooring cleat'],
      forest: ['a fallen bough across the path', 'a hunter\u2019s blind'],
      road: ['a milestone', 'a broken cart axle'],
    },
    readables: {
      town: ['a proclamation nailed to the post', 'the tollhouse ledger'],
      village: ['a parish register', 'a notice about missing sheep'],
      monastery: ['an illuminated psalter', 'the abbey\u2019s day-book'],
      fortress: ['the watch roster', 'a dispatch left half-burned'],
      ruin: ['a water-stained ledger', 'an inscription cut into the lintel'],
      crypt: ['a name cut into the slab', 'a funerary inscription'],
      cave: ['a name scratched into the rock'],
      marsh: ['a boundary stone, mostly sunk'],
      river: ['the lock-keeper\u2019s log'],
      forest: ['a trail marker carved into bark'],
      road: ['a weathered signpost'],
    },
    tracks: {
      town: ['fresh cart ruts leaving the square'],
      village: ['boot prints in the mud'],
      monastery: ['sandal prints in the cloister dust'],
      fortress: ['bootprints on the wall walk'],
      ruin: ['something dragged through the dust'],
      crypt: ['bare footprints in the dust, going in only'],
      cave: ['clawed prints in the silt'],
      marsh: ['deep prints filling with water'],
      river: ['prints in the mud at the ford'],
      forest: ['a game trail, recently used'],
      road: ['hoofprints leaving the road'],
    },
    climb: {
      town: ['the warehouse roof'], village: ['the mill wall'],
      monastery: ['the chapel wall'], fortress: ['the curtain wall'],
      ruin: ['a collapsed wall'], crypt: ['a shaft of fitted stone'],
      cave: ['a chimney in the rock'], marsh: ['a leaning dead tree'],
      river: ['the bridge abutment'], forest: ['a tall oak'],
      road: ['the cutting\u2019s bank'],
    },
    swim: {
      village: ['the millrace'], monastery: ['the cistern'],
      ruin: ['a flooded undercroft'], crypt: ['a flooded stair'],
      cave: ['a sump'], marsh: ['a black channel'],
      river: ['the current'], forest: ['a deep pool'],
      road: ['the ford, running high'], town: ['the harbour steps'],
      fortress: ['the moat'],
    },
    jump: {
      monastery: ['a gap in the cloister roof'], fortress: ['a gap in the parapet'],
      ruin: ['a collapsed floor'], crypt: ['a cracked chasm in the floor'],
      cave: ['a fissure'], marsh: ['a channel between hummocks'],
      river: ['the broken span'], forest: ['a fallen trunk over a gully'],
      road: ['a washed-out culvert'], town: ['a gap between roofs'],
      village: ['the leat'],
    },
  };

  function pickFlavour(kind, biome, rng, fallback) {
    var byBiome = FLAVOUR[kind] || {};
    var list = byBiome[biome] || byBiome.road || [];
    if (!list.length) return fallback;
    return list[rng.int(0, list.length - 1)];
  }

  var LOOT_COMMON = ['rations-1-day', 'rope-hempen-50-feet', 'torch', 'tinderbox',
    'crowbar', 'healers-kit', 'lantern-hooded'];
  var LOOT_GOOD = ['potion-of-healing', 'thieves-tools', 'holy-water-flask',
    'alchemists-fire-flask', 'oil-flask', 'antitoxin-vial'];
  var STOCK = ['potion-of-healing', 'rations-1-day', 'rope-hempen-50-feet', 'torch',
    'thieves-tools', 'healers-kit', 'crowbar', 'oil-flask', 'lantern-hooded',
    'antitoxin-vial', 'tinderbox'];

  var MERCHANT_NAMES = ['Halden Marsh', 'Perrin Ott', 'Sella Crowe', 'Bram Tull',
    'Odile Vance', 'Corin Applewhite', 'Nessa Fold', 'Garrick Small'];
  var MOUNT_NAMES = ['a stocky riding horse', 'a patient mule', 'a lean courser',
    'a shaggy pony'];

  /**
   * Furnish a location.
   *
   * @param def   {name, biome, description, connections}
   * @param opts  {seed, locationId}
   * @returns     the live scene, ready to live in state.locations
   */
  function furnish(def, opts) {
    opts = opts || {};
    def = def || {};
    var id = opts.locationId || def.id || 'here';
    var biome = def.biome || 'road';
    var profile = BIOME_PROFILE[biome] || DEFAULT_PROFILE;
    var rng = RNGFor(String(opts.seed || ('scene:' + id)));
    var ITEMS = items();
    var n = 0;

    var scene = {
      id: id, name: def.name || id, biome: biome,
      items: [], obstacles: [], interactables: [], readables: [], tracks: [],
      merchants: [], mounts: [], forage: false, furnished: true,
    };

    function roll(p) { return p > 0 && rng.next() < p; }
    function uid(prefix) { n += 1; return prefix + ':' + id + ':' + n; }

    if (roll(profile.loot)) {
      var pool = roll(0.3) ? LOOT_GOOD : LOOT_COMMON;
      var howMany = 1 + (roll(0.35) ? 1 : 0);
      for (var i = 0; i < howMany; i++) {
        var itemId = pool[rng.int(0, pool.length - 1)];
        var idef = ITEMS[itemId];
        scene.items.push({ uid: uid('loot'), id: itemId, name: (idef && idef.name) || itemId });
      }
    }
    if (roll(profile.locked)) {
      scene.obstacles.push({
        id: uid('lock'), kind: 'locked',
        name: pickFlavour('locked', biome, rng, 'a locked door'),
        dc: 12 + rng.int(0, 5), skill: 'sleightOfHand',
      });
    }
    if (roll(profile.trap)) {
      scene.obstacles.push({
        id: uid('trap'), kind: 'trap',
        name: pickFlavour('trap', biome, rng, 'a tripwire'),
        dc: 12 + rng.int(0, 5), skill: 'sleightOfHand',
        damage: '2d6', damageType: 'piercing',
      });
    }
    if (roll(profile.climb)) {
      scene.obstacles.push({
        id: uid('climb'), kind: 'climb',
        name: pickFlavour('climb', biome, rng, 'the wall'),
        distanceFt: 10 * rng.int(1, 3),
        dc: roll(0.4) ? 10 + rng.int(0, 5) : null, skill: 'athletics',
      });
    }
    if (roll(profile.swim)) {
      scene.obstacles.push({
        id: uid('swim'), kind: 'swim',
        name: pickFlavour('swim', biome, rng, 'the water'),
        distanceFt: 10 * rng.int(1, 4),
        dc: roll(0.4) ? 10 + rng.int(0, 5) : null, skill: 'athletics',
      });
    }
    if (roll(profile.jump)) {
      scene.obstacles.push({
        id: uid('jump'), kind: 'jump',
        name: pickFlavour('jump', biome, rng, 'the gap'),
        distanceFt: 5 * rng.int(1, 4),
      });
    }
    if (roll(profile.interactables)) {
      scene.interactables.push({
        id: uid('thing'), name: pickFlavour('interactables', biome, rng, 'a mechanism'),
      });
    }
    if (roll(profile.readables)) {
      scene.readables.push({
        id: uid('read'), name: pickFlavour('readables', biome, rng, 'a written page'),
      });
    }
    if (roll(profile.tracks)) {
      scene.tracks.push({
        id: uid('trail'), name: pickFlavour('tracks', biome, rng, 'tracks in the dirt'),
      });
    }
    scene.forage = roll(profile.forage);

    if (roll(profile.merchants)) {
      var stock = [];
      var howMuch = 3 + rng.int(0, 3);
      for (var s = 0; s < howMuch; s++) {
        var pick = STOCK[rng.int(0, STOCK.length - 1)];
        if (stock.indexOf(pick) < 0) stock.push(pick);
      }
      scene.merchants.push({
        id: uid('trader'),
        name: MERCHANT_NAMES[rng.int(0, MERCHANT_NAMES.length - 1)],
        sells: stock, buys: true,
      });
    }
    if (roll(profile.mounts)) {
      scene.mounts.push({
        id: uid('mount'),
        name: MOUNT_NAMES[rng.int(0, MOUNT_NAMES.length - 1)],
        speed: 60,
      });
    }
    return scene;
  }

  return { BIOME_PROFILE: BIOME_PROFILE, furnish: furnish };
});
