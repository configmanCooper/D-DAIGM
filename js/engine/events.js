/*
 * events.js — the immutable event log, and the pure resolve/commit split.
 *
 * The rule this file exists to enforce:
 *
 *   resolve(snapshot, command) -> EventBatch     PURE. Rolls every die exactly
 *                                                once. Mutates nothing.
 *   commit(state, batch)       -> newRevision    ATOMIC. Applies the batch or
 *                                                applies none of it.
 *
 * Narration happens after commit, over an already-decided batch. That ordering
 * is what makes "the model crashed halfway through describing the fight" a
 * non-event instead of a corrupted save, and it is why a failed narration
 * retries the *words* and never the dice.
 *
 * State is a fold over this log, which gives checkpoint, undo and exact replay
 * for free.
 */
(function (global) {
  'use strict';

  var LOG_VERSION = 1;

  /* --------------------------------------------------------- event kinds --
     Every kind has exactly one applier. Adding a kind without an applier is a
     hard error rather than a silent no-op: a state change that quietly does
     nothing is the worst possible failure here. */
  var KINDS = [
    'roll',              // a die was rolled; carries the full explanation
    'hp',                // current HP changed (damage or healing)
    'temp_hp',           // temporary HP set (takes-highest, never additive)
    'condition_add', 'condition_remove',
    'effect_add', 'effect_remove',
    'concentration_start', 'concentration_end',
    'encounter_end',     // initiative is put away; exploration time resumes
    'help', 'help_used', 'help_expire', 'hidden',   // the Help grant, and who cannot see whom
    'resource',          // hit dice, ki, rage, channel divinity, lay on hands...
    'slot_spend', 'slot_restore',   // spell slots, kept in their own pool
    'action_economy',    // an action, bonus action, reaction, object interaction or movement was spent this turn
    'move',
    'item_gain', 'item_lose', 'item_equip', 'item_unequip', 'item_attune', 'item_unattune',
    'gold',
    'knowledge',         // an observer learned a fact — the ONLY way knowledge spreads
    'relationship',
    'quest', 'flag',
    'combat_start', 'combat_end', 'initiative', 'turn_start', 'turn_end', 'round',
    'death_save', 'stabilise', 'death', 'revive',
    'position',          // entered/left a location, travelled
    'time',              // minutes/hours/days passed
    'xp', 'level',
    'spawn', 'despawn',
    'narration',         // prose attached to this batch, after the fact
    'note',              // engine commentary for the log; no state change
  ];

  var KIND_SET = KINDS.reduce(function (a, k) { a[k] = true; return a; }, {});

  var seq = 0;
  function makeEvent(kind, payload) {
    if (!KIND_SET[kind]) throw new Error('unknown event kind: ' + kind);
    seq++;
    return Object.assign({ kind: kind, seq: seq }, payload || {});
  }

  /**
   * An EventBatch is everything one command caused. It is the unit of commit,
   * the unit of undo, and the unit the narrator is given.
   */
  function makeBatch(command) {
    return {
      v: LOG_VERSION,
      commandId: command ? command.commandId : null,
      actorId: command ? command.actorId : null,
      at: new Date().toISOString(),
      events: [],
      /* Human-readable one-liners describing what mechanically happened, in
         order. This is what the narrator is told; it never sees raw state. */
      beats: [],
      /* Set when the engine refused the command outright. A refusal is still a
         batch, so it is still logged, undoable and explainable. */
      refused: null,
      /* Filled in after narration so the transcript and the mechanics live
         together in one record. */
      narration: null,
    };
  }

  function push(batch, kind, payload, beat) {
    batch.events.push(makeEvent(kind, payload));
    if (beat) batch.beats.push(beat);
    return batch;
  }

  function refuse(batch, reason, detail) {
    batch.refused = { reason: reason, detail: detail || '' };
    batch.beats.push('refused: ' + (detail || reason));
    return batch;
  }

  /* ------------------------------------------------------------ appliers --
     Each applier mutates the state object in place. They are only ever called
     from commit(), which has already taken a checkpoint, so an applier is free
     to be simple. */

  function actor(state, id) {
    return (state.actors && state.actors[id]) || null;
  }

  var APPLY = {
    roll: function () { /* a record, not a change */ },
    note: function () { },
    narration: function (state, e, batch) { batch.narration = e.text; },

    hp: function (state, e) {
      var a = actor(state, e.targetId);
      if (!a) return;
      var before = a.runtime.hp;
      /* An unknown maximum must not silently clamp healing to zero. Better to
         allow an over-heal than to make a character permanently unhealable
         because their sheet has not been derived yet. */
      var max = typeof a.runtime.hpMax === 'number' ? a.runtime.hpMax
        : (a.derivedCache && a.derivedCache.hpMax) || Infinity;
      a.runtime.hp = Math.max(0, Math.min(max, before + e.delta));

      /* Healing a dying creature above 0 wakes them (PHB 197): the death-save
         tally resets, they are no longer merely "stable", and the
         unconsciousness that came with dropping ends. Without this a healed
         character stood up still carrying two failures, and the next scratch
         killed them — and a "stable" flag left set meant `isDying` reported
         false for someone at full health, so they were skipped in initiative. */
      if (before <= 0 && a.runtime.hp > 0) {
        a.runtime.deathSaves = { successes: 0, failures: 0 };
        a.runtime.stable = false;
        if (a.runtime.conditions) {
          delete a.runtime.conditions.unconscious;
          delete a.runtime.conditions.prone_unconscious;
        }
      }
      e.before = before; e.after = a.runtime.hp;
    },

    temp_hp: function (state, e) {
      var a = actor(state, e.targetId);
      if (!a) return;
      /* Two different things wear the same name. Granting temporary hit points
         follows the 2014 no-stacking rule — you keep the larger pool, you never
         add them. But *spending* them to absorb damage has to be able to lower
         the pool, and routing that through the same max() meant the pool never
         went down: five temporary hit points absorbed every blow in the fight,
         for ever. `set` marks the second kind. */
      if (e.set) {
        a.runtime.tempHp = Math.max(0, e.amount);
        return;
      }
      a.runtime.tempHp = Math.max(a.runtime.tempHp || 0, e.amount);
    },

    condition_add: function (state, e) {
      var a = actor(state, e.targetId);
      if (!a) return;
      a.runtime.conditions = a.runtime.conditions || {};
      a.runtime.conditions[e.condition] = {
        source: e.source || null,
        endsOn: e.endsOn || 'none',
        saveDc: e.saveDc || null,
        saveAbility: e.saveAbility || null,
        rounds: typeof e.rounds === 'number' ? e.rounds : null,
      };
      if (e.condition === 'exhaustion') {
        a.runtime.exhaustion = Math.max(0, Math.min(6, (a.runtime.exhaustion || 0) + (e.levels || 1)));
      }
    },

    condition_remove: function (state, e) {
      var a = actor(state, e.targetId);
      if (!a || !a.runtime.conditions) return;
      delete a.runtime.conditions[e.condition];
      if (e.condition === 'exhaustion') {
        a.runtime.exhaustion = Math.max(0, (a.runtime.exhaustion || 0) - (e.levels || 1));
      }
    },

    effect_add: function (state, e) {
      state.effects = state.effects || [];
      state.effects.push(e.effect);
    },

    effect_remove: function (state, e) {
      state.effects = (state.effects || []).filter(function (x) { return x.id !== e.effectId; });
    },

    concentration_start: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.concentratingOn = { effectId: e.effectId, spellId: e.spellId, since: state.round || 0 };
    },

    concentration_end: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.concentratingOn = null;
      state.effects = (state.effects || []).filter(function (x) { return x.concentrationId !== e.actorId; });
    },

    /* Spell slots live in untime.slotsSpent, which is what derive() and the
       casting check both read. Keeping them out of the generic resource pool
       is the whole point: routing a slot spend through esource wrote it
       somewhere nothing looked, and casters had unlimited magic. */
    slot_spend: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.slotsSpent = a.runtime.slotsSpent || {};
      var lvl = e.level;
      a.runtime.slotsSpent[lvl] = (a.runtime.slotsSpent[lvl] || 0) + (e.count || 1);
    },

    slot_restore: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.slotsSpent = a.runtime.slotsSpent || {};
      if (e.all) { a.runtime.slotsSpent = {}; return; }
      var lvl = e.level;
      a.runtime.slotsSpent[lvl] = Math.max(0, (a.runtime.slotsSpent[lvl] || 0) - (e.count || 1));
    },

    /* The Help action's grant: one ally, one target, consumed by the next
       attack made against that target. Held on the helped creature rather
       than in a global list so it travels with them and disappears when they
       do. */
    help: function (state, e) {
      var ally = actor(state, e.allyId);
      if (!ally) return;
      ally.runtime.helpedAgainst = ally.runtime.helpedAgainst || {};
      ally.runtime.helpedAgainst[e.targetId] = { from: e.actorId, at: state.revision };
    },

    help_expire: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.helpedAgainst = {};
    },

    help_used: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a || !a.runtime.helpedAgainst) return;
      delete a.runtime.helpedAgainst[e.targetId];
    },

    /* Who cannot currently see this creature. The perception layer has always
       consulted hiddenFrom; until now nothing ever wrote to it, so the Hide
       action was decorative. */
    hidden: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      if (e.hidden === false) { a.runtime.hiddenFrom = {}; return; }
      a.runtime.hiddenFrom = a.runtime.hiddenFrom || {};
      (e.from || []).forEach(function (id) { a.runtime.hiddenFrom[id] = true; });
    },

    resource: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;

      /* Hit dice are not a generic counter: they are tracked per class in
         `hitDiceSpent`, because a fighter/wizard has d10s and d6s and cannot
         spend one for the other. A negative delta spends a die; a positive one
         is the half-your-level batch a long rest gives back. */
      if (e.resource === 'hit_dice') {
        var spentMap = a.runtime.hitDiceSpent = a.runtime.hitDiceSpent || {};
        if (e.delta < 0) {
          var cls = e.classId || (a.base.classes && a.base.classes[0] && a.base.classes[0].classId);
          if (!cls) return;
          spentMap[cls] = (spentMap[cls] || 0) + Math.abs(e.delta);
        } else {
          /* Recovering dice: give them back to whichever classes owe them,
             largest debt first, so a multiclass character regains evenly. */
          var back = e.delta;
          Object.keys(spentMap)
            .sort(function (x, y) { return spentMap[y] - spentMap[x]; })
            .forEach(function (id) {
              if (back <= 0) return;
              var give = Math.min(back, spentMap[id]);
              spentMap[id] -= give;
              back -= give;
            });
        }
        return;
      }

      var pool = a.runtime.resources = a.runtime.resources || {};
      var key = e.resource;
      var cur = typeof pool[key] === 'number' ? pool[key] : (e.from || 0);
      pool[key] = Math.max(0, cur + e.delta);
    },

    move: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.pos = { x: e.to.x, y: e.to.y };
      if (typeof e.movementUsed === 'number' && a.runtime.turn) {
        a.runtime.turn.movementRemaining = Math.max(0, a.runtime.turn.movementRemaining - e.movementUsed);
      }
    },

    /* Spending the pieces of a turn. Kept as its own event rather than folded
       into attack/cast appliers so the log can show WHY an actor can no longer
       act — the difference between "already attacked" and "still could" is the
       whole of the action economy, and the AI seat reads it from here. */
    action_economy: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a || !a.runtime.turn) return;
      ['action', 'bonus', 'reaction', 'objectInteraction'].forEach(function (slot) {
        if (typeof e[slot] === 'boolean') a.runtime.turn[slot] = e[slot];
      });
      if (typeof e.movementUsed === 'number') {
        a.runtime.turn.movementRemaining = Math.max(0, a.runtime.turn.movementRemaining - e.movementUsed);
      }
    },

    item_gain: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.inventory = a.runtime.inventory || [];
      a.runtime.inventory.push(e.item);
    },

    item_lose: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a || !a.runtime.inventory) return;
      var i = a.runtime.inventory.findIndex(function (x) { return x.uid === e.uid; });
      if (i >= 0) a.runtime.inventory.splice(i, 1);
    },

    item_equip: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.equipped = a.runtime.equipped || {};
      a.runtime.equipped[e.slot] = e.uid;
    },

    item_unequip: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a || !a.runtime.equipped) return;
      delete a.runtime.equipped[e.slot];
    },

    item_attune: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.attuned = a.runtime.attuned || [];
      /* Three is the hard cap; the engine checks before emitting, but a log
         replayed from an older version must not be able to exceed it. */
      if (a.runtime.attuned.indexOf(e.uid) < 0 && a.runtime.attuned.length < 3) {
        a.runtime.attuned.push(e.uid);
      }
    },

    item_unattune: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a || !a.runtime.attuned) return;
      a.runtime.attuned = a.runtime.attuned.filter(function (u) { return u !== e.uid; });
    },

    gold: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.gold = Math.max(0, (a.runtime.gold || 0) + e.delta);
    },

    /* The ONLY way a fact ever becomes known. Nothing else may write to a
       knowledge store — that is what keeps the disclosure guarantees testable. */
    knowledge: function (state, e) {
      if (!state.knowledge) state.knowledge = {};
      var store = state.knowledge[e.observerId] = state.knowledge[e.observerId] || {};
      var prev = store[e.factId];
      var order = { none: 0, hinted: 1, partial: 2, full: 3 };
      /* Knowledge only ever advances. Learning a hint about something you
         already understand fully must not walk it backwards. */
      if (!prev || order[e.stage] > order[prev.stage]) {
        store[e.factId] = {
          stage: e.stage,
          learnedAt: e.at || null,
          provenance: e.provenance || '',
        };
      }
    },

    relationship: function (state, e) {
      state.relationships = state.relationships || {};
      var key = e.fromId + '->' + e.toId;
      var rel = state.relationships[key] = state.relationships[key] ||
        { affinity: 0, trust: 0, fear: 0, respect: 0, history: [] };
      ['affinity', 'trust', 'fear', 'respect'].forEach(function (axis) {
        if (typeof e[axis] === 'number') {
          rel[axis] = Math.max(-100, Math.min(100, rel[axis] + e[axis]));
        }
      });
      if (e.because) rel.history.push({ at: e.at || null, because: e.because, delta: e.affinity || 0 });
    },

    quest: function (state, e) {
      state.quests = state.quests || {};
      var q = state.quests[e.questId] = state.quests[e.questId] || { id: e.questId, status: 'open', objectives: {} };
      if (e.status) q.status = e.status;
      if (e.objectiveId) q.objectives[e.objectiveId] = e.objectiveStatus || 'done';
      if (e.note) { q.notes = q.notes || []; q.notes.push(e.note); }
    },

    flag: function (state, e) {
      state.flags = state.flags || {};
      state.flags[e.flag] = e.value;
    },

    combat_start: function (state, e) {
      state.combat = { active: true, round: 1, order: e.order || [], turnIndex: 0, encounterId: e.encounterId || null };
    },

    combat_end: function (state) {
      state.combat = { active: false, round: 0, order: [], turnIndex: 0, encounterId: null };
    },

    initiative: function (state, e) {
      state.combat = state.combat || { active: true, round: 1, turnIndex: 0 };
      state.combat.order = e.order;
      /* The initiative pointer rides on this event so advancing a turn needs no
         separate applier for a single integer. */
      if (typeof e.turnIndex === 'number') state.combat.turnIndex = e.turnIndex;
    },

    turn_start: function (state, e) {
      var a = actor(state, e.actorId);
      state.activeActorId = e.actorId;
      if (!a) return;
      if (e.surprised) {
        /* A surprised creature does nothing on its first turn and cannot even
           take a reaction until that turn is over. It still HAS a turn — the
           order does not skip it — it simply spends it doing nothing. */
        a.runtime.turn = {
          action: false, bonus: false, reaction: false, objectInteraction: false,
          movementRemaining: 0, surprised: true,
        };
      } else {
        /* A reaction refreshes at the start of your turn, not the round: this
           is where that happens, so a reaction spent last round is available
           again now. */
        a.runtime.turn = {
          action: true, bonus: true, reaction: true, objectInteraction: true,
          movementRemaining: e.speed != null ? e.speed : 30, surprised: false,
        };
      }
    },

    turn_end: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a || !a.runtime.turn) return;
      a.runtime.turn.action = a.runtime.turn.bonus = false;
      /* A creature that was surprised regains its reaction the instant its
         first turn ends — from then on it fights normally. */
      if (a.runtime.turn.surprised) {
        a.runtime.turn.surprised = false;
        a.runtime.turn.reaction = true;
      }
    },

    encounter_end: function (state, e) {
      if (!state.combat) return;
      state.combat.active = false;
      state.combat.winner = e.winner || null;
      state.combat.order = [];
      state.combat.turnIndex = 0;
    },

    round: function (state, e) {
      if (state.combat) state.combat.round = e.round;
      /* A reaction refreshes at the start of your turn, not the round; the
         turn_start applier owns that. This only advances the counter. */
    },

    death_save: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      var d = a.runtime.deathSaves = a.runtime.deathSaves || { successes: 0, failures: 0 };
      d.successes = Math.min(3, d.successes + (e.successes || 0));
      d.failures = Math.min(3, d.failures + (e.failures || 0));
    },

    stabilise: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.deathSaves = { successes: 0, failures: 0 };
      a.runtime.stable = true;
    },

    death: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.dead = true;
      a.runtime.hp = 0;
      a.runtime.concentratingOn = null;
    },

    revive: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.runtime.dead = false;
      a.runtime.stable = false;
      a.runtime.deathSaves = { successes: 0, failures: 0 };
      a.runtime.hp = Math.max(1, e.hp || 1);
    },

    position: function (state, e) {
      state.locationId = e.locationId;
      if (e.discovered) {
        state.discoveredLocations = state.discoveredLocations || {};
        state.discoveredLocations[e.locationId] = true;
      }
    },

    time: function (state, e) {
      state.clock = (state.clock || 0) + (e.minutes || 0);
    },

    xp: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.progression.xp = Math.max(0, (a.progression.xp || 0) + e.delta);
    },

    level: function (state, e) {
      var a = actor(state, e.actorId);
      if (!a) return;
      a.progression.levels = a.progression.levels || [];
      a.progression.levels.push(e.entry);
      /* The class level lives in `base.classes` because that is what the
         character IS, while `progression.levels` is the log of how they got
         there. Advancing one without the other left a level-4 paladin still
         casting as a level-3 one — spell slots came back undefined. Both move
         together, always. */
      if (e.entry && e.entry.classId) {
        a.base.classes = a.base.classes || [];
        var row = a.base.classes.filter(function (c) { return c.classId === e.entry.classId; })[0];
        if (row) row.levels = (row.levels || 0) + 1;
        else a.base.classes.push({ classId: e.entry.classId, levels: 1 });
      }
      if (e.entry && e.entry.subclassId) {
        var row2 = (a.base.classes || []).filter(function (c) { return c.classId === e.entry.classId; })[0];
        if (row2) row2.subclassId = e.entry.subclassId;
        a.progression.subclassChoices = a.progression.subclassChoices || {};
        a.progression.subclassChoices[e.entry.classId] = e.entry.subclassId;
      }
      if (e.entry && e.entry.spellsLearned) {
        a.progression.spellsKnown = (a.progression.spellsKnown || []).concat(e.entry.spellsLearned);
      }
      if (e.entry && e.entry.fightingStyle) {
        a.progression.fightingStyles = (a.progression.fightingStyles || []).concat([e.entry.fightingStyle]);
      }
      /* Derived maxima change with a level, so the cache must be rebuilt or
         the new hit points never reach the sheet. */
      var State = (global.DND && global.DND.State) ||
        (typeof require !== 'undefined' ? require('./state.js') : null);
      if (State && State.refreshDerived) State.refreshDerived(state, e.actorId);
      /* Gaining hit points should actually heal you by that much, which is
         what every table does and what a player expects to see. */
      if (e.entry && e.entry.hpGained && a.runtime && typeof a.runtime.hp === 'number') {
        var gain = e.entry.hpGained + (e.entry.conModAtLevel || 0);
        a.runtime.hp = Math.min(a.runtime.hpMax || Infinity, a.runtime.hp + Math.max(0, gain));
      }
    },

    spawn: function (state, e) {
      state.actors = state.actors || {};
      state.actors[e.actorId] = e.actor;
    },

    despawn: function (state, e) {
      if (state.actors) delete state.actors[e.actorId];
    },
  };

  /* Fail loudly at load time if a kind has no applier — a silently ignored
     event is far worse than a crash on the first test run. */
  KINDS.forEach(function (k) {
    if (typeof APPLY[k] !== 'function') throw new Error('event kind has no applier: ' + k);
  });

  /**
   * Apply a batch atomically.
   *
   * Atomic here means: if any applier throws, the caller's checkpoint is
   * restored and the revision does not move. commit() itself does not know how
   * to snapshot — state.js owns that — so it reports failure and lets the
   * caller roll back rather than pretending to be transactional on its own.
   */
  /**
   * Apply a batch to the world — all of it, or none of it.
   *
   * The earlier version applied events one at a time and returned an error if
   * one threw, leaving every event before the failure already applied: half a
   * turn, permanently. A monster could be paid its damage and never die, and
   * because the batch was never logged, undo could not reach the wreckage
   * either. Now the events are applied to a copy, and the copy is only swapped
   * in once every last one has succeeded.
   *
   * The copy costs a structural clone per turn. At the scale of a D&D table —
   * a handful of actors, one command at a time, seconds of human thought
   * between turns — that is far cheaper than a corrupt world.
   */
  function commit(state, batch) {
    if (!batch) return { ok: false, error: 'no batch' };
    if (state.appliedCommandIds && batch.commandId && state.appliedCommandIds[batch.commandId]) {
      /* Idempotency: a duplicated command is a no-op success, not an error.
         Double-clicks and retried AI calls both land here. */
      return { ok: true, duplicate: true, revision: state.revision };
    }

    /* An unknown event kind is caught before anything is touched, so a typo in
       a resolver can never half-apply a turn. */
    for (var k = 0; k < batch.events.length; k++) {
      if (typeof APPLY[batch.events[k].kind] !== 'function') {
        return { ok: false, error: 'unknown event kind: ' + batch.events[k].kind, failedAt: k };
      }
    }

    var draft = draftOf(state);
    var i = 0;
    try {
      for (i = 0; i < batch.events.length; i++) {
        var e = batch.events[i];
        APPLY[e.kind](draft, e, batch);
      }
    } catch (err) {
      /* The draft is discarded unread. The real state was never touched. */
      return { ok: false, error: String((err && err.message) || err), failedAt: i, atomic: true };
    }

    adoptDraft(state, draft);
    state.revision = (state.revision || 0) + 1;
    state.log = state.log || [];
    state.log.push(batch);
    if (batch.commandId) {
      state.appliedCommandIds = state.appliedCommandIds || {};
      state.appliedCommandIds[batch.commandId] = state.revision;
    }
    /* Milestones are recorded here, not by whoever happened to call commit.
       They were first written into the session orchestrator, and the playtest
       harness — which levels characters up directly — wrote none, so a long
       run produced a transcript with three level-ups and a death in it and no
       mention of any of them. Every path into the world passes through this
       function; that is the only place the invariant holds. */
    recordMilestones(state, batch);
    return { ok: true, revision: state.revision };
  }

  function recordMilestones(state, batch) {
    if (!state.transcript) return;
    milestonesIn(state, batch).forEach(function (line) {
      state.transcript.push({
        at: state.clock, revision: state.revision,
        speaker: line.speaker, kind: line.kind, text: line.text,
      });
    });
  }

  /* The mutable parts of the world. The log, the RNG and the seed are
     deliberately shared rather than copied: the log is appended to only after
     a successful apply, and the RNG has already been rolled by the time we
     get here — rolling it again on a draft would produce different numbers
     than the ones the resolver reported. */
  var DRAFT_KEYS = ['actors', 'locations', 'combat', 'knowledge', 'clock', 'flags',
    'quests', 'party', 'factions', 'zones', 'effects', 'initiative'];

  function draftOf(state) {
    var draft = Object.create(Object.getPrototypeOf(state) || Object.prototype);
    for (var key in state) {
      if (!Object.prototype.hasOwnProperty.call(state, key)) continue;
      draft[key] = DRAFT_KEYS.indexOf(key) >= 0 ? deepCopy(state[key]) : state[key];
    }
    return draft;
  }

  function adoptDraft(state, draft) {
    for (var key in draft) {
      if (!Object.prototype.hasOwnProperty.call(draft, key)) continue;
      adoptInto(state, key, draft[key]);
    }
    /* An applier may delete a whole branch (a location emptied, an effect
       cleared). Those keys are gone from the draft and must go from the
       state too, or the deletion silently fails to stick. */
    for (var old in state) {
      if (!Object.prototype.hasOwnProperty.call(state, old)) continue;
      if (!(old in draft)) delete state[old];
    }
  }

  /**
   * Move one branch of the draft into the live state, keeping the container's
   * identity where there is one.
   *
   * Replacing `state.knowledge` with a fresh object looks harmless and is not:
   * a knowledge store holds `store.known = state.knowledge` as a live alias, so
   * swapping the reference left the store pointing at the previous turn's
   * object. Reveals were committed to the log and to the state, and the store
   * that everything reads went on insisting nobody knew anything.
   *
   * So containers are refilled in place rather than replaced. Anything holding
   * a reference keeps seeing the current world.
   */
  function adoptInto(state, key, next) {
    var cur = state[key];
    /* Identical object: the draft shares this branch with the live state
       rather than copying it (the log and the RNG are shared on purpose).
       Refilling it "in place" would clear the very array we are copying from,
       which emptied the event log on every single commit — replaying a
       session reproduced only its last turn. */
    if (cur === next) return;
    if (Array.isArray(cur) && Array.isArray(next)) {
      cur.length = 0;
      for (var i = 0; i < next.length; i++) cur.push(next[i]);
      return;
    }
    if (cur && next && typeof cur === 'object' && typeof next === 'object' &&
      !Array.isArray(cur) && !Array.isArray(next)) {
      for (var gone in cur) {
        if (Object.prototype.hasOwnProperty.call(cur, gone) &&
          !Object.prototype.hasOwnProperty.call(next, gone)) delete cur[gone];
      }
      for (var k in next) {
        if (Object.prototype.hasOwnProperty.call(next, k)) cur[k] = next[k];
      }
      return;
    }
    state[key] = next;
  }

  function deepCopy(v) {
    if (v === null || typeof v !== 'object') return v;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(v); } catch (e) { /* falls through */ }
    }
    return JSON.parse(JSON.stringify(v));
  }

  /**
   * Attach prose to an already-committed batch. Narration never changes state.
   */
  function attachNarration(state, commandId, text) {
    var batch = (state.log || []).filter(function (b) { return b.commandId === commandId; }).pop();
    if (!batch) return false;
    batch.narration = text;
    return true;
  }

  /**
   * The milestones a reader will look for in a transcript and, until now,
   * would not find: someone reached a new level, someone died, someone was
   * brought back. The prose usually mentions them, but "usually" is not good
   * enough for a record you are meant to be able to audit — an export is
   * supposed to answer "what happened" without replaying the log.
   *
   * Returns the lines so a caller can put them wherever it keeps its record.
   */
  function milestonesIn(state, batch) {
    var lines = [];
    var xpSeen = false;
    (batch && batch.events || []).forEach(function (e) {
      var who = (state.actors[e.actorId || e.targetId] || {}).name || e.actorId || e.targetId;
      if (e.kind === 'level') {
        /* The new level lives on the entry, which is the record of how the
           character got there — `e.level` does not exist, and reading it
           produced "reaches level undefined" in the transcript. */
        var lv = (e.entry && e.entry.level) != null ? e.entry.level
          : (e.level != null ? e.level : '?');
        lines.push({ kind: 'system', speaker: 'the table', text: who + ' reaches level ' + lv + '.' });
      } else if (e.kind === 'death') {
        lines.push({ kind: 'system', speaker: 'the table', text: who + ' dies.' });
      } else if (e.kind === 'revive') {
        lines.push({ kind: 'system', speaker: 'the table', text: who + ' is brought back.' });
      } else if (e.kind === 'xp' && e.delta && !xpSeen) {
        /* Experience is emitted once per character. The transcript wants the
           award, not four identical copies of it. */
        xpSeen = true;
        lines.push({ kind: 'system', speaker: 'the table', text: 'The party earns ' + e.delta + ' experience each.' });
      }
    });
    return lines;
  }

  /** Rebuild state by folding the log — used by tests and by undo. */
  function fold(initialState, log) {
    var state = JSON.parse(JSON.stringify(initialState));
    state.log = [];
    state.appliedCommandIds = {};
    state.revision = 0;
    for (var i = 0; i < log.length; i++) {
      var copy = Object.assign({}, log[i], { events: log[i].events });
      /* Re-applying must not be short-circuited by the idempotency guard. */
      var id = copy.commandId;
      if (id) delete state.appliedCommandIds[id];
      commit(state, copy);
    }
    return state;
  }

  /** Everything the narrator is allowed to see about what just happened. */
  function beatsFor(batch) {
    if (!batch) return [];
    if (batch.refused) return ['The attempt does not happen: ' + batch.refused.detail];
    return batch.beats.slice();
  }

  var api = {
    LOG_VERSION: LOG_VERSION,
    KINDS: KINDS,
    makeEvent: makeEvent,
    makeBatch: makeBatch,
    push: push,
    refuse: refuse,
    commit: commit,
    attachNarration: attachNarration, milestonesIn: milestonesIn,
    fold: fold,
    beatsFor: beatsFor,
    APPLY: APPLY,
  };

  global.DND = global.DND || {};
  global.DND.Events = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
