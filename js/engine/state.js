/*
 * state.js — the game-state object, and checkpoint / undo / rewind.
 *
 * State is deliberately a plain mutable object with no reactivity system: the
 * UI re-renders panels explicitly, and every change arrives through
 * events.commit(). That combination is what makes undo cheap — the state is
 * just data, so a checkpoint is a structured clone and a rollback is an
 * assignment.
 *
 * The `turnEpoch` here is what stops a slow model response from landing in a
 * world that has already moved on. Every model request captures it; anything
 * that comes back holding a stale one is discarded rather than applied.
 */
(function (global) {
  'use strict';

  var STATE_VERSION = 1;

  var RNG = (global.DND && global.DND.RNG) ||
    (typeof require !== 'undefined' ? require('../rng.js').RNG : null);
  var Events = (global.DND && global.DND.Events) ||
    (typeof require !== 'undefined' ? require('./events.js') : null);
  var Knowledge = (global.DND && global.DND.Knowledge) ||
    (typeof require !== 'undefined' ? require('./knowledge.js') : null);

  function create(spec) {
    spec = spec || {};
    var seed = spec.seed == null ? String(Date.now()) : spec.seed;
    return {
      v: STATE_VERSION,
      sessionId: spec.sessionId || ('s_' + Date.now().toString(36)),
      campaignId: spec.campaignId || 'sandbox',
      createdAt: new Date().toISOString(),

      seed: seed,
      rng: new RNG(seed),

      /* Bumped by every successful commit. A command built against an older
         revision is stale and must be re-decided. */
      revision: 0,
      /* Bumped whenever the initiative turn or the narrative spotlight moves.
         Coarser than `revision` on purpose: a model deciding an action does
         not care that someone else's hit points changed, only that it is still
         its turn to act. */
      turnEpoch: 0,

      /* Every actor in play: player characters, companions, NPCs, monsters.
         Keyed by id, each { id, name, side, kind, base, progression, runtime }. */
      actors: {},
      /* Seats are ownership; controllers are who decides. A seat has a
         controller; an NPC has a controller and no seat. */
      seats: [],
      controllers: {},

      activeActorId: null,
      combat: { active: false, round: 0, order: [], turnIndex: 0, encounterId: null },

      effects: [],
      locationId: spec.locationId || null,
      discoveredLocations: {},
      clock: 0,                      // minutes since campaign start
      quests: {},
      flags: {},
      relationships: {},
      knowledge: {},                 // observerId -> { factId: {stage,...} }

      log: [],                       // committed EventBatches, in order
      appliedCommandIds: {},
      transcript: [],                // { at, speaker, kind, text } — what was actually said

      /* Session-scoped bookkeeping that is not part of the fiction. */
      meta: {
        ruleset: '5e-2014',
        difficulty: spec.difficulty || 'standard',
        tone: spec.tone || 'heroic',
        contentLimits: spec.contentLimits || [],
      },
    };
  }

  /* ------------------------------------------------------- checkpointing -- */

  /* A ring of recent snapshots. Deep clones are not free, but a state object
     is small next to a model call, and being able to undo an AI turn the
     player disliked is worth far more than the microseconds. */
  var DEFAULT_DEPTH = 30;

  function snapshot(state) {
    /* The RNG is a live object with a closure, so it is captured by its
       serialisable state and rebuilt on restore. Everything else is data. */
    var rngState = state.rng ? state.rng.state() : null;
    var clone = JSON.parse(JSON.stringify(Object.assign({}, state, { rng: undefined })));
    clone.rngState = rngState;
    return clone;
  }

  function restore(state, snap) {
    Object.keys(state).forEach(function (k) { delete state[k]; });
    Object.assign(state, snap);
    state.rng = snap.rngState ? RNG.fromState(snap.rngState) : new RNG(snap.seed);
    delete state.rngState;
    return state;
  }

  function makeHistory(depth) {
    return { depth: depth || DEFAULT_DEPTH, past: [], future: [] };
  }

  /**
   * Take a checkpoint before applying a command. Called by the dispatcher, not
   * by callers, so it can never be forgotten.
   */
  function checkpoint(history, state, label) {
    history.past.push({ label: label || '', at: Date.now(), snap: snapshot(state) });
    if (history.past.length > history.depth) history.past.shift();
    /* Any new action abandons the redo branch — this is branch-aware undo, not
       a linear tape. Keeping a stale future would let a player redo into a
       world that no longer exists. */
    history.future.length = 0;
    return history;
  }

  function canUndo(history) { return history.past.length > 0; }
  function canRedo(history) { return history.future.length > 0; }

  function undo(history, state) {
    if (!history.past.length) return { ok: false, reason: 'nothing to undo' };
    var entry = history.past.pop();
    history.future.push({ label: entry.label, at: Date.now(), snap: snapshot(state) });
    restore(state, entry.snap);
    return { ok: true, label: entry.label };
  }

  function redo(history, state) {
    if (!history.future.length) return { ok: false, reason: 'nothing to redo' };
    var entry = history.future.pop();
    history.past.push({ label: entry.label, at: Date.now(), snap: snapshot(state) });
    restore(state, entry.snap);
    return { ok: true, label: entry.label };
  }

  /**
   * Rewind to just before a specific command — "that whole exchange went
   * wrong, take it back". Walks the checkpoint ring rather than replaying the
   * log, because replay would re-roll every die and produce a different world.
   */
  function rewindTo(history, state, commandId) {
    for (var i = history.past.length - 1; i >= 0; i--) {
      if (history.past[i].label === commandId) {
        var entry = history.past[i];
        history.future.length = 0;
        history.past.length = i;
        restore(state, entry.snap);
        return { ok: true };
      }
    }
    return { ok: false, reason: 'no checkpoint for ' + commandId };
  }

  /* ------------------------------------------------------ derived cache --- */

  /**
   * Recompute an actor's derived stats and cache the few that other systems
   * need to read cheaply.
   *
   * The three-layer model deliberately does not store maximum hit points — it
   * derives them from the per-level rolls plus Constitution, so that raising
   * Constitution retroactively does the right thing. But the damage applier
   * has to clamp healing against a maximum, and an observation has to describe
   * how hurt someone looks, and neither of those can afford to run a full
   * derive. So the answer is cached here, and refreshed whenever something
   * that feeds it changes.
   *
   * Missing it entirely is not fatal — clamps fall back to permissive — but it
   * showed up as "28/undefined hp" in a playtest, which is exactly the kind of
   * quiet wrongness worth closing.
   */
  function refreshDerived(state, actorId) {
    var Character = (global.DND && global.DND.Character) ||
      (typeof require !== 'undefined' ? require('./character.js') : null);
    var a = state.actors[actorId];
    if (!a || !Character || typeof Character.derive !== 'function') return null;
    var derived;
    try {
      derived = Character.derive(a.base, a.progression, a.runtime,
        (state.effects || []).filter(function (e) { return e.targetId === actorId; }));
    } catch (e) {
      return null;
    }
    a.derivedCache = derived;
    if (typeof derived.hpMax === 'number' && derived.hpMax > 0) {
      a.runtime.hpMax = derived.hpMax;
      if (typeof a.runtime.hp !== 'number') a.runtime.hp = derived.hpMax;
      /* A fixture or an older save can carry more current hit points than the
         sheet supports; a playtest printed "30/12 hp". Current can never
         exceed maximum. */
      if (a.runtime.hp > derived.hpMax) a.runtime.hp = derived.hpMax;
    }
    if (typeof derived.speed === 'number') a.runtime.speed = derived.speed;
    ensureAttacks(state, a, derived);
    return derived;
  }

  /**
   * Make sure an actor has something to attack with.
   *
   * Combat reads `runtime.attacks`, but that list is assembled from equipment,
   * and nothing was assembling it — a playtest produced a fighter with a
   * longsword in her pack whose every swing was refused with "nothing to
   * attack with", while the model gamely improvised its way around the bug for
   * twelve turns. Derived attacks are rebuilt here from what the character is
   * actually carrying, and an unarmed strike is always available, because a
   * character with empty hands still has hands.
   */
  /**
   * The SRD item table, however this file happens to be running.
   *
   * In the browser `index.html` loads the data before this file, so the global
   * is already populated. Under Node nothing has required it, and reading the
   * global alone silently produced characters armed with nothing but their
   * fists — which is precisely what a playtest found. Cached after the first
   * successful lookup so the require cost is paid once.
   */
  var itemCache = null;
  function itemData() {
    if (itemCache) return itemCache;
    var fromGlobal = global.DND && global.DND.Data && global.DND.Data.ITEMS;
    if (fromGlobal) { itemCache = fromGlobal; return itemCache; }
    if (typeof require !== 'undefined') {
      try { itemCache = require('../data/srd_items.js').ITEMS; } catch (e) { itemCache = null; }
    }
    return itemCache;
  }

  /**
   * Is this character proficient with this weapon?
   *
   * The class data has always listed `weaponProfs` — either broad categories
   * ("simple", "martial") or specific weapons ("rapier", "hand-crossbow") — and
   * every item carries a `subcategory` of "simple-melee", "martial-ranged" and
   * so on. Nothing compared them: `toHit` was `mod + prof` for every weapon a
   * character happened to be holding, so a wizard who picked up a greatsword
   * swung it with full proficiency. Being able to use any weapon well is most
   * of what separates a fighter from a wizard.
   *
   * Races and backgrounds can grant weapons too (an elf's longsword, a dwarf's
   * battleaxe), so anything gathered onto `base.proficiencies.weapons` counts
   * as well.
   */
  function proficientWithWeapon(base, item, entry) {
    var granted = [];
    var CLASSES = classData();
    (base.classes || []).forEach(function (c) {
      var cd = CLASSES && CLASSES[c.classId];
      if (cd && cd.weaponProfs) granted = granted.concat(cd.weaponProfs);
    });
    var own = (base.proficiencies && base.proficiencies.weapons) || [];
    granted = granted.concat(own);
    if (!granted.length) return false;

    var lower = granted.map(function (g) { return String(g).toLowerCase(); });
    var id = String((item && item.id) || (entry && entry.id) || '').toLowerCase();
    if (id && lower.indexOf(id) >= 0) return true;

    /* "simple" covers simple-melee and simple-ranged; likewise martial. */
    var sub = String((item && item.subcategory) || '').toLowerCase();
    if (sub) {
      var family = sub.split('-')[0];
      if (family && lower.indexOf(family) >= 0) return true;
      if (lower.indexOf(sub) >= 0) return true;
    }
    return false;
  }

  var classCache = null;
  function classData() {
    if (classCache) return classCache;
    var fromGlobal = global.DND && global.DND.Data && global.DND.Data.CLASSES;
    if (fromGlobal) { classCache = fromGlobal; return classCache; }
    if (typeof require !== 'undefined') {
      try { classCache = require('../data/srd_classes.js').CLASSES; } catch (e) { classCache = null; }
    }
    return classCache;
  }

  function ensureAttacks(state, a, derived) {
    if (a.runtime.attacksAuthored) return;          // a statblock supplied its own
    var ITEMS = itemData();
    var mods = (derived && derived.abilityMods) || {};
    var str = mods.str || 0, dex = mods.dex || 0;
    var prof = (derived && derived.proficiencyBonus) || 2;

    var attacks = [];
    (a.runtime.inventory || []).forEach(function (entry) {
      var item = (ITEMS && (ITEMS[entry.id] || ITEMS[entry.uid])) || entry;
      var dmg = item && (item.damage || (item.mech && item.mech.damage));
      if (!dmg) return;
      var dice = typeof dmg === 'string' ? dmg : (dmg.dice || dmg.damageDice);
      if (!dice) return;
      var props = (item.properties || []).map(String);
      var finesse = props.indexOf('finesse') >= 0;
      var ranged = props.indexOf('ammunition') >= 0 || props.indexOf('thrown') >= 0 ||
        (item.subcategory && /ranged/i.test(item.subcategory));
      var mod = (finesse || ranged) ? Math.max(str, dex) : str;
      /* A creature with no class at all — a hand-placed NPC, a campaign
         fixture — is assumed to know its own weapons; refusing proficiency to
         everything without a class list would quietly weaken every NPC in the
         game rather than fix anything. */
      var classed = (a.base.classes || []).length > 0;
      var isProf = !classed || proficientWithWeapon(a.base, item, entry);
      attacks.push({
        name: item.name || entry.name || entry.id,
        uid: entry.uid || entry.id,
        toHit: mod + (isProf ? prof : 0),
        proficient: isProf,
        damage: dice + (mod >= 0 ? '+' + mod : String(mod)),
        damageType: (dmg && dmg.type) || 'slashing',
        abilityMod: mod,
        properties: props,
        ranged: !!ranged,
      });
    });

    attacks.push({
      name: 'Unarmed strike',
      toHit: str + prof,
      damage: String(1 + str),
      damageType: 'bludgeoning',
      abilityMod: str,
      properties: [],
      unarmed: true,
    });

    a.runtime.attacks = attacks;
  }

  function refreshAllDerived(state) {
    Object.keys(state.actors || {}).forEach(function (id) { refreshDerived(state, id); });
    return state;
  }

  /* ------------------------------------------------------------- turns --- */

  function advanceTurnEpoch(state) {
    state.turnEpoch = (state.turnEpoch || 0) + 1;
    return state.turnEpoch;
  }

  /* ------------------------------------------------------------ actors --- */

  function addActor(state, actor) {
    state.actors[actor.id] = actor;
    return actor;
  }

  function partyIds(state) {
    return Object.keys(state.actors).filter(function (id) {
      return state.actors[id].side === 'party';
    });
  }

  function livingEnemies(state) {
    return Object.keys(state.actors).filter(function (id) {
      var a = state.actors[id];
      return a.side === 'enemy' && a.runtime && !a.runtime.dead;
    });
  }

  /** Seats own characters; controllers decide for them. */
  /**
   * Empty the cast, seats and controllers.
   *
   * Used when a session is about to be replaced wholesale by a loaded
   * campaign: the wizard has already built a placeholder party, and resuming
   * a recorded campaign means playing the people in it, not standing new
   * strangers next to them. The UI must not reach into `state.actors` itself —
   * the perception layer is the only door for reading it — so the operation
   * lives here, where the rest of the world model can be kept consistent.
   */
  /** Is this actor in the world at all? Lets callers ask without reading the
      raw actor table, which is reserved for the perception layer. */
  function hasActor(state, id) {
    return !!(state.actors && state.actors[id]);
  }

  function clearCast(state) {    state.actors = {};
    state.seats = [];
    state.controllers = {};
    state.activeActorId = null;
    state.initiative = null;
    if (state.combat) state.combat.active = false;
    return state;
  }

  function addSeat(state, spec) {    var seat = {
      id: spec.id || ('p' + (state.seats.length + 1)),
      name: spec.name || 'Player ' + (state.seats.length + 1),
      actorId: spec.actorId,
      control: spec.control || 'human',        // human | playerAI
      agent: spec.agent || null,               // { backend, model, persona }
    };
    state.seats.push(seat);
    state.controllers[seat.actorId] = { kind: seat.control, seatId: seat.id, agent: seat.agent };
    return seat;
  }

  function setController(state, actorId, controller) {
    state.controllers[actorId] = controller;
    return controller;
  }

  function controllerFor(state, actorId) {
    return state.controllers[actorId] ||
      /* Anything without an explicit controller belongs to the DM. In a
         one-player game that is every companion, every NPC and every monster. */
      { kind: 'npcPolicy', seatId: null, agent: null };
  }

  /* ------------------------------------------------------- transcript ---- */

  function say(state, speaker, text, kind) {
    state.transcript.push({
      at: state.clock,
      revision: state.revision,
      speaker: speaker,
      kind: kind || 'speech',        // speech | narration | player | system | ooc
      text: text,
    });
    return state.transcript[state.transcript.length - 1];
  }

  /* ------------------------------------------------------------ digest --- */

  /**
   * A compact, independently readable summary of where the session stands.
   * Written into every export so a saved game can be judged — by a person or
   * by a reviewing model — without replaying it.
   */
  function digest(state) {
    var party = partyIds(state).map(function (id) {
      var a = state.actors[id];
      return {
        id: id, name: a.name,
        classes: a.base && a.base.classes,
        hp: a.runtime && a.runtime.hp, hpMax: a.runtime && a.runtime.hpMax,
        conditions: a.runtime && a.runtime.conditions ? Object.keys(a.runtime.conditions) : [],
        gold: a.runtime && a.runtime.gold,
        items: (a.runtime && a.runtime.inventory || []).length,
      };
    });
    return {
      sessionId: state.sessionId,
      campaignId: state.campaignId,
      revision: state.revision,
      clock: state.clock,
      locationId: state.locationId,
      inCombat: !!(state.combat && state.combat.active),
      party: party,
      openQuests: Object.keys(state.quests).filter(function (q) { return state.quests[q].status === 'open'; }),
      relationships: state.relationships,
      knownFactCounts: Object.keys(state.knowledge).reduce(function (acc, obs) {
        acc[obs] = Object.keys(state.knowledge[obs]).length;
        return acc;
      }, {}),
      transcriptLines: state.transcript.length,
      committedBatches: state.log.length,
    };
  }

  var api = {
    STATE_VERSION: STATE_VERSION,
    create: create,
    snapshot: snapshot, restore: restore,
    makeHistory: makeHistory, checkpoint: checkpoint,
    canUndo: canUndo, canRedo: canRedo, undo: undo, redo: redo, rewindTo: rewindTo,
    advanceTurnEpoch: advanceTurnEpoch,
    refreshDerived: refreshDerived, refreshAllDerived: refreshAllDerived,
    ensureAttacks: ensureAttacks,
    addActor: addActor, partyIds: partyIds, livingEnemies: livingEnemies,
    clearCast: clearCast, hasActor: hasActor,
    addSeat: addSeat, setController: setController, controllerFor: controllerFor,
    say: say, digest: digest,
  };

  global.DND = global.DND || {};
  global.DND.State = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
