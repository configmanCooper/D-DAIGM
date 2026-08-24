/*
 * dispatch.js — the single door every action passes through.
 *
 * A human clicking "Attack", a human typing "I swing at the thing in the
 * water", an AI-controlled seat picking move #14, a companion policy deciding
 * to heal, and an NPC policy deciding to flee all arrive here as a GameCommand
 * and leave as a committed EventBatch. There is no second path. That is what
 * makes "the AI can only do what a player could do" a structural fact rather
 * than a promise, and it is why the test suite can cover every actor in the
 * game by covering this function.
 *
 * Resolvers are registered per family rather than hard-wired, so combat, magic
 * and social play can be built and tested independently.
 */
(function (global) {
  'use strict';

  var Command = (global.DND && global.DND.Command) ||
    (typeof require !== 'undefined' ? require('./command.js') : null);
  var Events = (global.DND && global.DND.Events) ||
    (typeof require !== 'undefined' ? require('./events.js') : null);
  var State = (global.DND && global.DND.State) ||
    (typeof require !== 'undefined' ? require('./state.js') : null);

  var resolvers = {};

  /**
   * Register a resolver for a family.
   * A resolver is `fn(snapshotState, command, ctx) -> EventBatch` and MUST be
   * pure: it may read state and roll dice from `state.rng`, but it must not
   * mutate anything. Everything it decides goes in the batch.
   */
  function register(family, fn) {
    resolvers[family] = fn;
    return fn;
  }

  function registered() { return Object.keys(resolvers); }

  /**
   * Run one command end to end.
   *
   * The ordering is the whole point and is worth stating plainly:
   *   validate -> freshness -> checkpoint -> resolve (pure, dice roll HERE)
   *   -> commit (atomic) -> return.
   * Narration happens afterwards, outside this function, over a batch that is
   * already decided and already saved. If the model then fails, dies, or
   * produces nonsense, the mechanical turn has still happened exactly once.
   */
  function dispatch(state, history, command, ctx) {
    ctx = ctx || {};

    var structure = Command.validateStructure(command);
    if (!structure.ok) {
      return { ok: false, stage: 'validate', errors: structure.errors };
    }

    /* A clarification request never touches state. It is the engine saying
       "which of these did you mean?" and waiting. */
    if (command.needsClarification) {
      return { ok: true, stage: 'clarify', clarify: command.clarificationQuestion, batch: null };
    }

    var fresh = Command.checkFreshness(command, state);
    if (!fresh.ok) {
      /* A duplicate is success — the click was double, or a retry landed twice.
         Stale is a real rejection: the world moved while a model was thinking,
         and whatever it decided was decided about a world that no longer is. */
      if (fresh.reason === 'duplicate') {
        return { ok: true, stage: 'duplicate', batch: null, detail: fresh.detail };
      }
      return { ok: false, stage: 'stale', reason: fresh.reason, detail: fresh.detail };
    }

    var resolve = resolvers[command.family];
    if (!resolve) {
      return { ok: false, stage: 'resolve', errors: ['no resolver for family: ' + command.family] };
    }

    /* Checkpoint BEFORE resolving, not before committing: resolve draws from
       the RNG, and an undo that did not rewind the RNG would silently change
       every subsequent roll in the session. */
    State.checkpoint(history, state, command.commandId);

    var batch;
    try {
      batch = resolve(state, command, ctx);
    } catch (err) {
      /* A resolver that throws has decided nothing, so there is nothing to
         undo — but the checkpoint consumed a history slot and the RNG may have
         advanced partway through. Roll back to be certain. */
      State.undo(history, state);
      return { ok: false, stage: 'resolve', errors: [String((err && err.message) || err)] };
    }

    if (!batch) {
      State.undo(history, state);
      return { ok: false, stage: 'resolve', errors: ['resolver returned nothing'] };
    }

    var result = Events.commit(state, batch);
    if (!result.ok) {
      State.undo(history, state);
      return { ok: false, stage: 'commit', errors: [result.error], failedAt: result.failedAt };
    }

    return {
      ok: true,
      stage: 'committed',
      batch: batch,
      revision: result.revision,
      refused: batch.refused || null,
      beats: Events.beatsFor(batch),
    };
  }

  /**
   * Attach narration to a committed batch.
   *
   * Separate from dispatch on purpose. Narration is not a state change, it
   * cannot fail the turn, and it can be retried, replaced or skipped entirely
   * without the mechanics noticing.
   */
  function narrate(state, commandId, text) {
    var attached = Events.attachNarration(state, commandId, text);
    if (attached) State.say(state, 'DM', text, 'narration');
    return attached;
  }

  /**
   * Enumerate everything an actor could legally do right now.
   *
   * Used three ways, and it matters that they are the same list: the UI builds
   * its buttons from it, an AI seat picks an index into it, and the referee's
   * schema enums are built from it. When they were allowed to diverge in the
   * sibling project, the autopilot was told a move was safe while the UI was
   * warning the player it was the worst thing they could do.
   */
  function legalMoves(state, actorId, ctx) {
    var out = [];
    Object.keys(resolvers).forEach(function (family) {
      var fn = resolvers[family];
      if (typeof fn.legalMoves !== 'function') return;
      var moves = fn.legalMoves(state, actorId, ctx) || [];
      moves.forEach(function (m) {
        out.push(Object.assign({ family: family }, m));
      });
    });
    return out;
  }

  /** Turn a chosen legal move back into a command, ready for dispatch. */
  function commandFromMove(state, actorId, move, opts) {
    opts = opts || {};
    return Command.create({
      sessionId: state.sessionId,
      stateRevision: state.revision,
      turnEpoch: state.turnEpoch,
      actorId: actorId,
      source: opts.source || 'human',
      family: move.family,
      primary: move.step,
      followUp: move.followUp || null,
      goal: move.what || '',
      utterance: opts.utterance || '',
    });
  }

  var api = {
    register: register,
    registered: registered,
    dispatch: dispatch,
    narrate: narrate,
    legalMoves: legalMoves,
    commandFromMove: commandFromMove,
  };

  global.DND = global.DND || {};
  global.DND.Dispatch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
