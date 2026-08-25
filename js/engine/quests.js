/**
 * quests.js — how a quest gets anywhere.
 *
 * The campaign has always been able to LIST quests. Nothing ever advanced one:
 * ten open threads sat in the journal from the first turn to the last, with no
 * relationship to anything the party did. Travelling to the keep the quest was
 * about changed nothing; learning the fact it asked for changed nothing.
 *
 * A quest here is a title plus a list of TRIGGERS — declarative statements of
 * the form "when the party arrives at Blackharrow Keep, that objective is met".
 * After every committed batch the engine asks each open quest whether anything
 * in that batch answers one of its triggers, and emits quest events if so. The
 * quest data therefore stays prose-with-hooks rather than code, and the same
 * machinery serves a hand-written campaign and a generated sandbox.
 *
 * Trigger kinds:
 *   arrive   { where }            the party is standing in a place
 *   learn    { factId }           somebody learned a specific fact
 *   defeat   { actorId | role }   a named enemy went down
 *   acquire  { itemId }           somebody picked the thing up
 *   flag     { flag, value }      the world state says so
 *   deliver  { itemId, where }    the thing and the party are in the same place
 *
 * Each trigger names the `objective` it satisfies, and may set `completes: true`
 * to finish the whole quest.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DND = root.DND || {};
  root.DND.Quests = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (global) {
  'use strict';

  function Events() {
    return (global.DND && global.DND.Events) ||
      (typeof require !== 'undefined' ? require('./events.js') : null);
  }

  /**
   * Everything a batch of events says happened, in the shape the triggers ask
   * about. Reading the batch once and asking questions of the summary is a lot
   * cheaper — and a lot easier to follow — than each trigger walking the events.
   */
  function summarise(state, batch) {
    var s = {
      arrived: null, learned: {}, defeated: {}, acquired: {}, flags: {},
    };
    (batch && batch.events || []).forEach(function (e) {
      if (!e || !e.kind) return;
      switch (e.kind) {
        case 'position':
          if (e.locationId) s.arrived = e.locationId;
          break;
        case 'knowledge':
          if (e.factId) s.learned[e.factId] = true;
          break;
        case 'death':
          if (e.actorId) s.defeated[e.actorId] = true;
          break;
        case 'item_gain':
          if (e.item) s.acquired[e.item.id || e.item.uid] = true;
          break;
        case 'flag':
          if (e.flag) s.flags[e.flag] = e.value;
          break;
        default: break;
      }
    });
    return s;
  }

  /**
   * Is this objective already met?
   *
   * An objective is stored either as a bare status string or as
   * `{status, text}` when the trigger supplied a written description. Reading
   * only the string form made every objective with text look unmet, so
   * `progressOf` reported zero and triggers would have fired again for ever.
   */
  function has(state, questId, objectiveId) {
    var q = (state.quests || {})[questId];
    var v = q && q.objectives && q.objectives[objectiveId];
    if (!v) return false;
    var status = typeof v === 'string' ? v : v.status;
    return status === 'done' || status === 'complete';
  }

  function carrying(state, itemId) {
    var actors = state.actors || {};
    return Object.keys(actors).some(function (id) {
      var a = actors[id];
      if (!a || a.side !== 'party') return false;
      return ((a.runtime && a.runtime.inventory) || []).some(function (it) {
        return it.id === itemId || it.uid === itemId;
      });
    });
  }

  /**
   * Compare two location ids forgivingly.
   *
   * The gazetteer has ids like `lantern's rest` — with a straight apostrophe
   * and a space — and prose written elsewhere in the campaign naturally uses a
   * typographic one. A trigger that read `lantern’s rest` silently never fired,
   * and a quest that never fires looks exactly like a quest that is not
   * implemented. Normalising the punctuation is narrow enough to be safe and
   * removes the whole class of near-miss.
   */
  function sameplace(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    return norm(a) === norm(b);
  }

  function norm(s) {
    return String(s).toLowerCase()
      .replace(/[\u2018\u2019\u02bc]/g, "'")
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Does this trigger fire, given what just happened and where things stand?
   *
   * Both are needed: `arrive` is about the batch (the party moved just now),
   * but `deliver` is about the standing situation (the thing is here and so are
   * they), which may become true because of a move OR because of a pickup.
   */
  function fires(state, trig, s) {
    switch (trig.on) {
      case 'arrive':
        return sameplace(s.arrived, trig.where);
      case 'learn':
        return !!s.learned[trig.factId];
      case 'defeat':
        if (trig.actorId) return !!s.defeated[trig.actorId];
        if (trig.role) {
          return Object.keys(s.defeated).some(function (id) {
            var a = (state.actors || {})[id];
            return a && (a.role === trig.role || a.kind === trig.role);
          });
        }
        return false;
      case 'acquire':
        return !!s.acquired[trig.itemId] || carrying(state, trig.itemId);
      case 'flag':
        return (state.flags || {})[trig.flag] === (trig.value === undefined ? true : trig.value);
      case 'deliver':
        return sameplace(state.locationId, trig.where) && carrying(state, trig.itemId);
      default:
        return false;
    }
  }

  /**
   * What a batch of events did to the party's quests.
   *
   * Returns a batch of quest events, or null if nothing moved. The caller
   * commits it, so quest progress is an ordinary part of the record: logged,
   * replayable and undoable like everything else.
   */
  function advanceFrom(state, batch, definitions, opts) {
    opts = opts || {};
    var E = Events();
    if (!E || !definitions || !definitions.length) return null;
    var s = summarise(state, batch);

    var out = E.makeBatch({ commandId: opts.commandId || ('quest:' + state.revision), actorId: null });
    var moved = false;
    /* Two triggers on the same quest can both fire from a single batch — kill
       the last cultist while standing in the shrine and both `defeat` and
       `arrive` answer at once. `has()` reads COMMITTED state, which this batch
       has not reached yet, so without these the same objective was written
       twice and a quest with two completing triggers emitted two "done"
       events and two beats. */
    var claimedObjectives = {};
    var claimedQuests = {};

    definitions.forEach(function (def) {
      if (!def || !def.triggers || !def.triggers.length) return;
      var live = (state.quests || {})[def.id];
      /* A quest nobody has heard of yet cannot progress, and a finished one
         cannot progress again. */
      if (!live || live.status === 'done' || live.status === 'failed') return;

      def.triggers.forEach(function (trig) {
        var objId = trig.objective || (trig.on + ':' + (trig.where || trig.factId || trig.itemId || trig.flag || 'x'));
        var claimKey = def.id + '/' + objId;
        if (claimedObjectives[claimKey]) return;
        if (has(state, def.id, objId)) return;
        if (!fires(state, trig, s)) return;

        claimedObjectives[claimKey] = true;
        moved = true;
        E.push(out, 'quest', {
          questId: def.id, title: def.title,
          objectiveId: objId, objectiveStatus: 'done',
          objectiveText: trig.text || null,
        }, trig.beat || (def.title + ' — ' + (trig.text || 'a step forward.')));

        if (trig.completes && !claimedQuests[def.id]) {
          claimedQuests[def.id] = true;
          E.push(out, 'quest', { questId: def.id, title: def.title, status: 'done' },
            trig.doneBeat || ('That settles it: ' + def.title));
        }
        if (trig.fails && !claimedQuests[def.id]) {
          claimedQuests[def.id] = true;
          E.push(out, 'quest', { questId: def.id, title: def.title, status: 'failed' },
            trig.failBeat || ('That closes the door on it: ' + def.title));
        }
      });
    });

    return moved ? out : null;
  }

  /**
   * How far along a quest is, for the journal.
   */
  function progressOf(state, def) {
    var live = (state.quests || {})[def.id];
    if (!live) return null;
    var total = (def.triggers || []).length;
    var done = (def.triggers || []).filter(function (t) {
      var objId = t.objective || (t.on + ':' + (t.where || t.factId || t.itemId || t.flag || 'x'));
      return has(state, def.id, objId);
    }).length;
    return { done: done, total: total, status: live.status };
  }

  return {
    summarise: summarise,
    advanceFrom: advanceFrom,
    progressOf: progressOf,
  };
});
