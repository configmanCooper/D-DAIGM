/*
 * knowledge.js — who knows what.
 *
 * The original design had one boolean gate per secret: "has the player earned
 * this yet?" Review found that far too coarse, and it was right. A single flag
 * cannot express that Shen suspects something his companion has confirmed, or
 * that an NPC is lying because she genuinely does not know better, and it has
 * no answer at all for the three quiet leak paths:
 *
 *   1. a hidden creature showing up in an enumerated target list,
 *   2. a secret reaching a rolling summary and then living there for ever,
 *   3. an AI-controlled player seat being handed the whole board.
 *
 * So knowledge is per-observer and staged, secrets are atomic claims rather
 * than paragraphs, and there is exactly one function — getObservation() — that
 * anything outside this module may use to find out what someone perceives.
 * Prompts, AI seats, journals and exports all go through it. If it is not in
 * the observation, it cannot leak, because it was never in the room.
 */
(function (global) {
  'use strict';

  /* Stages are ordered. Knowledge advances and never retreats: learning a hint
     about something already understood must not walk it backwards. */
  var STAGES = ['none', 'hinted', 'partial', 'full'];
  var STAGE_RANK = STAGES.reduce(function (a, s, i) { a[s] = i; return a; }, {});

  /**
   * A fact is one atomic claim, not a paragraph. Splitting them this finely is
   * what lets a reveal be partial: the party can know the Warden takes a price
   * long before they know the price is measured in days of life.
   */
  /**
   * Which of the reveals we authorised did the narration actually make?
   *
   * The DM prompt offers a list of facts the campaign says may now come out,
   * and the model chooses whether the moment earns it. Nothing recorded that
   * choice — so a secret could be spoken aloud on Tuesday and still count as
   * unknown on Wednesday: the journal never gained it, and the redactor went
   * on scrubbing a name the party had already heard, which reads as the game
   * forgetting its own story.
   *
   * Detection is deliberately conservative. A fact counts as revealed only if
   * the prose names it unmistakably — one of the names it guards, or a strong
   * majority of the distinctive words of its claim. A missed reveal costs a
   * turn's delay; a false one hands out a secret nobody was told.
   */
  function revealsIn(store, candidateIds, text) {
    var found = [];
    var lower = String(text || '').toLowerCase();
    if (!lower) return found;

    (candidateIds || []).forEach(function (id) {
      var f = store.facts[id];
      if (!f) return;

      var named = (f.forbiddenUntilKnown || []).some(function (n) {
        return lower.indexOf(String(n).toLowerCase()) >= 0;
      });
      if (named) { found.push({ factId: id, stage: 'full', why: 'named in the narration' }); return; }

      /* No guarded name to look for: fall back to the claim's own vocabulary,
         ignoring the small words that appear in any sentence. */
      var words = String(f.claim || '').toLowerCase().match(/[a-z][a-z'-]{3,}/g) || [];
      var distinctive = words.filter(function (w) { return !CLAIM_STOPWORDS[w]; });
      if (distinctive.length < 3) return;
      var hits = distinctive.filter(function (w) { return lower.indexOf(w) >= 0; }).length;
      if (hits / distinctive.length >= 0.75) {
        found.push({ factId: id, stage: 'partial', why: 'the narration describes it' });
      }
    });
    return found;
  }

  var CLAIM_STOPWORDS = {
    that: 1, this: 1, with: 1, from: 1, they: 1, them: 1, their: 1, been: 1,
    have: 1, will: 1, what: 1, when: 1, where: 1, which: 1, were: 1, into: 1,
    some: 1, more: 1, than: 1, then: 1, there: 1, here: 1, only: 1, also: 1,
    still: 1, about: 1, would: 1, could: 1, should: 1, being: 1, other: 1,
  };

  function makeFact(spec) {
    return {
      id: spec.id,
      claim: spec.claim,                       // one sentence, safe to show at `full`
      hint: spec.hint || '',                   // the wording used at `hinted`
      partial: spec.partial || '',             // the wording used at `partial`
      topic: spec.topic || 'lore',             // lore | person | place | item | plot | mechanic
      entities: spec.entities || [],           // ids this fact is about — drives retrieval
      /* A predicate over game state. Purely advisory: it is how the campaign
         says "this may now be revealed", not a claim that anyone knows it. */
      revealWhen: spec.revealWhen || null,
      /* Names that must never appear in prose until this fact is at least
         `partial`. Enforced programmatically by the narrator's gates, because
         a 4B model cannot be trusted with a "please don't mention" request. */
      forbiddenUntilKnown: spec.forbiddenUntilKnown || [],
      /* Hard canon the DM must never contradict. Kept engine-side and only
         put into a prompt once the fact is revealable. */
      constraint: spec.constraint || '',
      spoiler: spec.spoiler !== false,          // false for public common knowledge
    };
  }

  function makeStore() {
    return {
      facts: {},          // id -> fact definition
      known: {},          // observerId -> { factId: {stage, learnedAt, provenance} }
      /* Objective truth about entities: where they are, whether they are
         hidden, what they really want. Never handed out directly. */
      truth: {},
    };
  }

  function defineFacts(store, facts) {
    facts.forEach(function (f) { store.facts[f.id] = makeFact(f); });
    return store;
  }

  function stageOf(store, observerId, factId) {
    var s = store.known[observerId] && store.known[observerId][factId];
    return s ? s.stage : 'none';
  }

  function knows(store, observerId, factId, atLeast) {
    return STAGE_RANK[stageOf(store, observerId, factId)] >= STAGE_RANK[atLeast || 'full'];
  }

  /**
   * The text an observer may be shown for a fact, at whatever stage they hold.
   * Returns null when they hold nothing — and null means the caller must not
   * mention it at all, not that it should say "you don't know".
   */
  function textFor(store, observerId, factId) {
    var fact = store.facts[factId];
    if (!fact) return null;
    var stage = stageOf(store, observerId, factId);
    if (stage === 'none') return null;
    if (stage === 'full') return fact.claim;
    if (stage === 'partial') return fact.partial || fact.claim;
    return fact.hint || fact.partial || null;
  }

  /**
   * Which facts is the campaign currently willing to have surface?
   * This does NOT mean anyone knows them — it is the set a scene is allowed to
   * *offer*, which the engine turns into knowledge events when earned.
   */
  function revealable(store, state) {
    var out = [];
    Object.keys(store.facts).forEach(function (id) {
      var f = store.facts[id];
      if (!f.revealWhen) return;
      try { if (f.revealWhen(state)) out.push(id); } catch (e) { /* a bad predicate must not break a turn */ }
    });
    return out;
  }

  /**
   * Every name that must not appear in prose for this observer yet.
   * The narrator redacts or regenerates on a hit, which turns a soft
   * instruction into a hard gate.
   */
  /**
   * Names the narration must not use yet.
   *
   * A fact that the campaign has *authorised* for reveal is deliberately not
   * on this list. It used to be, which quietly made the whole reveal mechanism
   * unreachable: the prompt invited the Dungeon Master to name the thing when
   * the moment earned it, and the redactor then scrubbed the name back out of
   * the reply — so the secret could never come out, in any campaign, ever.
   *
   * Authorisation is the campaign's own predicate, not the model's whim. The
   * model still chooses whether the moment is right; it simply is no longer
   * silently overruled when it is.
   */
  function forbiddenNames(store, observerId, state) {
    var allowed = {};
    if (state) {
      try {
        revealable(store, state).forEach(function (id) { allowed[id] = true; });
      } catch (e) { /* a bad predicate must not unblock a secret */ }
    }
    var names = [];
    Object.keys(store.facts).forEach(function (id) {
      var f = store.facts[id];
      if (!f.forbiddenUntilKnown.length) return;
      if (allowed[id]) return;
      if (knows(store, observerId, id, 'partial')) return;
      names = names.concat(f.forbiddenUntilKnown);
    });
    /* Longest first, so "the Hollow King" is redacted before "Hollow". */
    return names.filter(function (n, i, a) { return a.indexOf(n) === i; })
      .sort(function (a, b) { return b.length - a.length; });
  }

  /* ------------------------------------------------------- perception ---- */

  /**
   * Can this observer perceive this actor right now?
   *
   * Deliberately conservative: anything not clearly perceivable is excluded.
   * The cost of wrongly hiding a visible goblin is a confused player; the cost
   * of wrongly revealing a hidden assassin is the game spoiling itself.
   */
  function canPerceive(state, observerId, targetId) {
    if (observerId === targetId) return true;
    var obs = state.actors && state.actors[observerId];
    var tgt = state.actors && state.actors[targetId];
    if (!obs || !tgt) return false;
    if (tgt.runtime && tgt.runtime.despawned) return false;

    /* Allies are always known to each other — the party is not sneaking up on
       itself, and hiding a companion's HP from the DM prompt helps nobody. */
    if (obs.side && tgt.side && obs.side === tgt.side) return true;

    var hidden = tgt.runtime && tgt.runtime.hiddenFrom;
    if (hidden && hidden[observerId]) return false;
    if (tgt.runtime && tgt.runtime.invisible) {
      var sees = obs.runtime && obs.runtime.senses && obs.runtime.senses.seeInvisible;
      if (!sees) return false;
    }
    if (tgt.runtime && tgt.runtime.unnoticed) return false;
    return true;
  }

  /**
   * getObservation — the single door.
   *
   * Everything that builds a prompt, drives an AI seat, renders a journal or
   * writes an export calls this and nothing else. It returns what this
   * observer perceives, with facts rendered at their own stage.
   *
   * `mode: 'dm'` returns the Dungeon Master's view, which sees the whole board
   * but still only the facts the *party* has earned, plus the campaign's
   * currently-revealable set marked separately so the DM knows what it may
   * introduce without being told everything it may not.
   */
  function getObservation(state, store, observerId, opts) {
    opts = opts || {};
    var mode = opts.mode || 'actor';
    var isDm = mode === 'dm';

    var actors = {};
    Object.keys(state.actors || {}).forEach(function (id) {
      if (!isDm && !canPerceive(state, observerId, id)) return;
      var a = state.actors[id];
      var own = isDm || id === observerId ||
        (a.side && state.actors[observerId] && a.side === state.actors[observerId].side);
      actors[id] = {
        id: id,
        name: a.name,
        side: a.side,
        pos: a.runtime && a.runtime.pos ? { x: a.runtime.pos.x, y: a.runtime.pos.y } : null,
        /* Exact hit points for your own side; a descriptive band for enemies,
           which is what a character could actually judge by looking. */
        hp: own ? (a.runtime && a.runtime.hp) : null,
        hpMax: own ? (a.runtime && a.runtime.hpMax) : null,
        health: own ? null : healthBand(a),
        conditions: a.runtime && a.runtime.conditions ? Object.keys(a.runtime.conditions) : [],
        dead: !!(a.runtime && a.runtime.dead),
        /* An observer sees what someone is carrying openly, not their pack. */
        visibleGear: own ? null : (a.visibleGear || []),
      };
    });

    var facts = {};
    var known = store.known[isDm ? (opts.partyId || 'party') : observerId] || {};
    Object.keys(known).forEach(function (fid) {
      var text = textFor(store, isDm ? (opts.partyId || 'party') : observerId, fid);
      if (text) facts[fid] = { stage: known[fid].stage, text: text, provenance: known[fid].provenance };
    });

    var out = {
      observerId: observerId,
      mode: mode,
      revision: state.revision,
      turnEpoch: state.turnEpoch,
      locationId: state.locationId,
      clock: state.clock,
      combat: state.combat && state.combat.active ? {
        active: true, round: state.combat.round,
        activeActorId: state.activeActorId,
        order: (state.combat.order || []).map(function (o) { return o.id; }),
      } : { active: false },
      actors: actors,
      facts: facts,
      quests: visibleQuests(state, store, observerId, isDm),
      /* The ids this observer may legally name. Enumerated target lists for the
         referee are built from exactly this, so a hidden creature cannot be
         chosen even by a model that guessed it was there. */
      targetableIds: Object.keys(actors),
    };

    if (isDm) {
      /* The DM gets the campaign's currently-permitted reveals, and nothing
         beyond them. Facts whose predicate is not yet satisfied are absent
         from the prompt entirely rather than present-but-forbidden. */
      out.mayReveal = revealable(store, state).map(function (id) {
        return { id: id, claim: store.facts[id].claim, constraint: store.facts[id].constraint };
      });
      out.mustNotName = forbiddenNames(store, opts.partyId || 'party', state);
    }
    return out;
  }

  function healthBand(a) {
    if (!a.runtime || typeof a.runtime.hp !== 'number' || !a.runtime.hpMax) return 'unknown';
    if (a.runtime.dead) return 'dead';
    var pct = a.runtime.hp / a.runtime.hpMax;
    if (pct <= 0) return 'down';
    if (pct < 0.25) return 'badly wounded';
    if (pct < 0.5) return 'wounded';
    if (pct < 0.9) return 'bloodied';
    return 'unhurt';
  }

  function visibleQuests(state, store, observerId, isDm) {
    var out = {};
    Object.keys(state.quests || {}).forEach(function (qid) {
      var q = state.quests[qid];
      if (!isDm && q.hidden) return;
      out[qid] = { status: q.status, objectives: q.objectives };
    });
    return out;
  }

  /* ------------------------------------------------------ learning ------- */

  /**
   * Build the event that teaches an observer a fact. Emitting an event rather
   * than writing directly is the whole point: knowledge changes are logged,
   * undoable, replayable and — critically — auditable by a test that walks the
   * log looking for a secret that arrived too early.
   */
  function learnEvent(observerId, factId, stage, provenance) {
    return {
      kind: 'knowledge',
      observerId: observerId,
      factId: factId,
      stage: stage || 'full',
      provenance: provenance || '',
      at: new Date().toISOString(),
    };
  }

  /**
   * Summaries are a cache, never a source of truth, and they may only ever be
   * built from events this observer actually witnessed. This is the fix for
   * "a secret leaked into a summary once and lived there for the rest of the
   * campaign": a contaminated summary can simply be thrown away and rebuilt,
   * because nothing depends on it.
   */
  function visibleEvents(state, store, observerId, batches) {
    var out = [];
    (batches || state.log || []).forEach(function (batch) {
      var kept = batch.events.filter(function (e) {
        if (e.kind === 'knowledge') return e.observerId === observerId;
        var subject = e.targetId || e.actorId;
        if (!subject) return true;
        return canPerceive(state, observerId, subject);
      });
      if (kept.length) {
        out.push({ commandId: batch.commandId, at: batch.at, beats: batch.beats, events: kept });
      }
    });
    return out;
  }

  /**
   * Audit hook for the canary tests: given a block of text about to be sent
   * anywhere, report any fact this observer has not earned whose wording or
   * forbidden names appear in it. Used across prompt, narration, summary,
   * journal and export so one test covers the whole chain.
   */
  function auditLeaks(store, observerId, text) {
    var hay = String(text || '').toLowerCase();
    var leaks = [];
    Object.keys(store.facts).forEach(function (id) {
      var f = store.facts[id];
      if (!f.spoiler) return;
      if (knows(store, observerId, id, 'partial')) return;
      f.forbiddenUntilKnown.forEach(function (name) {
        if (name && hay.indexOf(String(name).toLowerCase()) >= 0) {
          leaks.push({ factId: id, term: name, kind: 'forbidden-name' });
        }
      });
      /* A verbatim claim is the most obvious leak and the easiest to catch. */
      if (f.claim && f.claim.length > 24 && hay.indexOf(f.claim.toLowerCase()) >= 0) {
        leaks.push({ factId: id, term: f.claim, kind: 'verbatim-claim' });
      }
    });
    return leaks;
  }

  var api = {
    STAGES: STAGES, STAGE_RANK: STAGE_RANK,
    makeFact: makeFact, makeStore: makeStore, defineFacts: defineFacts,
    stageOf: stageOf, knows: knows, textFor: textFor,
    revealable: revealable, revealsIn: revealsIn, forbiddenNames: forbiddenNames,
    canPerceive: canPerceive, getObservation: getObservation,
    healthBand: healthBand,
    learnEvent: learnEvent, visibleEvents: visibleEvents, auditLeaks: auditLeaks,
  };

  global.DND = global.DND || {};
  global.DND.Knowledge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
