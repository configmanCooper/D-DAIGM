/*
 * game.js — the session orchestrator.
 *
 * Everything else is a part; this is the loop that runs them in the right
 * order. It owns the sequence that the whole design rests on:
 *
 *   input -> referee -> dispatch (checkpoint, resolve, commit) -> narrate
 *
 * and it owns the fact that narration is optional. If the model is slow, the
 * player has already seen their hit points change. If the model dies, the turn
 * still happened. If the player hits undo, the mechanics rewind and the prose
 * goes with them.
 *
 * The UI subscribes to events from here rather than reaching into state, so
 * that a headless playtest and a browser session run the identical loop.
 */
(function (global) {
  'use strict';

  function req(path) { return typeof require !== 'undefined' ? require(path) : null; }
  var State = (global.DND && global.DND.State) || req('./engine/state.js');
  var Events = (global.DND && global.DND.Events) || req('./engine/events.js');
  var Command = (global.DND && global.DND.Command) || req('./engine/command.js');
  var Dispatch = (global.DND && global.DND.Dispatch) || req('./engine/dispatch.js');
  var Knowledge = (global.DND && global.DND.Knowledge) || req('./engine/knowledge.js');
  var Schema = (global.DND && global.DND.Schema) || req('./ai/schema.js');
  var Referee = (global.DND && global.DND.Referee) || req('./ai/referee.js');
  var Narrator = (global.DND && global.DND.Narrator) || req('./ai/narrator.js');
  var Offline = (global.DND && global.DND.Offline) || req('./ai/offline.js');
  var PlayerAgent = (global.DND && global.DND.PlayerAgent) || req('./ai/player_agent.js');
  var Character = (global.DND && global.DND.Character) || req('./engine/character.js');
  var LevelUp = (global.DND && global.DND.LevelUp) || req('./engine/levelup.js');
  var Mortality = (global.DND && global.DND.Mortality) || req('./engine/mortality.js');
  var Combat = (global.DND && global.DND.Combat) || req('./engine/combat.js');
  var Prepare = (global.DND && global.DND.Prepare) || req('./engine/prepare.js');
  var Preview = (global.DND && global.DND.Preview) || req('./engine/preview.js');
  var RNG = (global.DND && global.DND.RNG) || (req('./rng.js') || {}).RNG;

  function createSession(spec) {
    spec = spec || {};
    var state = spec.state || State.create(spec);
    var store = spec.store || Knowledge.makeStore();
    /* Derive once at session start so hit-point maxima, AC and speed are
       available to the appliers and the observation layer from the first turn
       rather than the first level-up. */
    if (State.refreshAllDerived) State.refreshAllDerived(state);
    return {
      state: state,
      store: store,
      history: State.makeHistory(spec.undoDepth),
      campaign: spec.campaign || { title: 'Untitled', premise: '', tone: 'heroic' },
      /* Narration the model has recently produced, so the repetition gate has
         something to compare against. Capped: only the last few matter. */
      recentNarration: [],
      /* Facts that must survive context eviction — promises made, secrets
         learned, relationships that turned. */
      pinned: [],
      summaries: [],
      agentMemory: {},
      listeners: {},
      pending: null,
      busy: false,
    };
  }

  /**
   * Furnish the party's current location if it has not been furnished yet.
   *
   * Called at session start and after anything that can move them. The opening
   * scene used to be the one place in the game with nothing in it, because
   * furnishing only ever happened on arrival somewhere else.
   */
  function settle(session) {
    if (session && session.state && session.state.locationId) {
      ensureScene(session, session.state.locationId);
      seedQuests(session);
      /* A quest about where the party ALREADY IS has no arrival to notice.
         The Shen campaign opens at Lantern's Rest with a thread about Lantern's
         Rest, and it stayed untouched because the party never travelled there
         — they were simply standing in it from the first turn. */
      checkStanding(session);
    }
    seatTheInitiative(session);
    return session;
  }

  /**
   * Somebody has to be up, even when nobody has rolled initiative.
   *
   * Out of combat a fresh session left `activeActorId` null, and null is not a
   * neutral value here — it is read as "no one is up", so the browser's
   * `humanActed` bailed before passing the turn and `currentController`
   * returned nothing. Ending your turn in a peaceful scene did nothing at all:
   * the epoch never moved, companions never spoke, and the table sat still
   * until a fight happened to start. Combat owns the initiative while it is
   * running, so this only fills a vacancy and never overrules an order.
   */
  function seatTheInitiative(session) {
    if (!session || !session.state) return session;
    var state = session.state;
    if (state.combat && state.combat.active) return session;
    if (state.activeActorId && state.actors[state.activeActorId]) return session;
    state.activeActorId = outOfCombatHolder(session) || null;
    return session;
  }

  /**
   * Put the campaign's quests on the board.
   *
   * A quest the state has never heard of cannot advance, and a generated
   * sandbox had no quests in state at all — so its journal read "No quests
   * recorded" for the whole game while its definitions sat unused. Only
   * missing ones are added, so this is safe to call on every settle and never
   * overwrites progress.
   */
  function seedQuests(session) {
    var defs = questDefsFor(session);
    if (!defs || !defs.length) return;
    var state = session.state;
    var missing = defs.filter(function (d) {
      return d && d.id && !(state.quests || {})[d.id];
    });
    if (!missing.length) return;

    var b = Events.makeBatch({ commandId: 'quests:seed:' + state.revision, actorId: null });
    missing.forEach(function (d) {
      Events.push(b, 'quest', {
        questId: d.id, title: d.title, status: d.status || 'open',
      }, 'Open thread: ' + d.title);
    });
    Events.commit(state, b);
  }

  function questDefsFor(session) {
    return (session.campaign && session.campaign.quests) || session.questDefs || null;
  }

  /**
   * Evaluate quest triggers against where things STAND, not what just changed.
   *
   * Repeats are harmless: an objective already marked done is skipped, so this
   * can be called on every settle without accumulating anything.
   */
  function checkStanding(session) {
    var state = session.state;
    if (!state.locationId) return null;
    return advanceQuests(session, {
      events: [{ kind: 'position', locationId: state.locationId }],
      beats: [],
    });
  }

  /**
   * Did anything that just happened move a quest along?
   *
   * The campaign has always been able to LIST quests and never to advance one:
   * ten open threads sat in the journal from the first turn to the last, with
   * no relationship to anything the party did — walking into the very keep a
   * quest was about changed nothing. Quest progress is committed as ordinary
   * events, so it is logged, replayable and undoable like everything else.
   */
  function advanceQuests(session, batch) {
    var Q = (global.DND && global.DND.Quests) ||
      (typeof require !== 'undefined' ? (function () {
        try { return require('./engine/quests.js'); } catch (e) { return null; }
      })() : null);
    if (!Q || !batch) return null;
    var defs = questDefsFor(session);
    if (!defs || !defs.length) return null;

    var out = Q.advanceFrom(session.state, batch, defs, {
      commandId: 'quest:' + session.state.revision,
    });
    if (!out) return null;
    var res = Events.commit(session.state, out);
    if (res.ok) {
      emit(session, 'quests', { batch: out, beats: out.beats || [] });
    }
    return out;
  }

  /* --------------------------------------------------------------- events -- */

  function on(session, name, fn) {
    (session.listeners[name] = session.listeners[name] || []).push(fn);
    return function off() {
      session.listeners[name] = (session.listeners[name] || []).filter(function (f) { return f !== fn; });
    };
  }

  function emit(session, name, payload) {
    (session.listeners[name] || []).forEach(function (fn) {
      /* A broken listener is a UI bug, not a reason to lose the turn. */
      try { fn(payload); } catch (e) {
        if (typeof console !== 'undefined') console.error('listener ' + name + ' failed:', e);
      }
    });
  }

  /* ---------------------------------------------------------- observations -- */

  function observationFor(session, actorId) {
    return Knowledge.getObservation(session.state, session.store, actorId, {});
  }

  function derivedFor(session, actorId) {
    var a = session.state.actors[actorId];
    if (!a || !Character) return null;
    try {
      return Character.derive(a.base, a.progression, a.runtime,
        (session.state.effects || []).filter(function (e) { return e.targetId === actorId; }));
    } catch (e) { return null; }
  }

  /**
   * The private, own-character view: the runtime facts a player legitimately
   * knows about their OWN hero but which are not "perceived" and so are not in
   * getObservation — current/temp HP, concentration, death saves, inspiration,
   * carried inventory, equipped and attuned items, gold.
   *
   * This exists so the sheet, party and inventory panels never reach into
   * `state.actors` themselves. It is meant for the viewer's own side; callers
   * that pass a hostile id simply get that actor's private sheet, which is the
   * caller's responsibility to gate (the UI only ever asks about its own seats).
   */
  function selfView(session, actorId) {
    var a = session.state.actors[actorId];
    if (!a) return null;
    var r = a.runtime || {};
    return {
      id: actorId,
      name: a.name,
      side: a.side,
      role: a.role || '',
      base: a.base,
      progression: a.progression,
      hp: r.hp, hpMax: r.hpMax, tempHp: r.tempHp || 0,
      conditions: r.conditions ? Object.keys(r.conditions) : [],
      concentratingOn: r.concentratingOn || null,
      deathSaves: r.deathSaves || { successes: 0, failures: 0 },
      stable: !!r.stable, dead: !!r.dead,
      inspiration: !!r.inspiration,
      exhaustion: r.exhaustion || 0,
      xp: r.xp || 0,
      slotsSpent: r.slotsSpent || {},
      pactSlotsSpent: r.pactSlotsSpent || 0,
      hitDiceSpent: r.hitDiceSpent || {},
      resources: r.resources || {},
      inventory: (r.inventory || []).slice(),
      equipped: r.equipped || {},
      attuned: (r.attuned || []).slice(),
      gold: r.gold || 0,
      pos: r.pos || null,
      /* Movement left this turn, in feet, computed by combat.js when it is
         present so the UI never re-derives movement geometry itself. */
      moveFt: (function () {
        if (Combat && Combat.movementLeft) { try { return Combat.movementLeft(a); } catch (e) { /* fall through */ } }
        return (r.speed != null ? r.speed : 30);
      })(),
    };
  }

  function optionsFor(session, actorId) {
    var observation = observationFor(session, actorId);
    var derived = derivedFor(session, actorId);
    var actor = session.state.actors[actorId];
    var opts = Schema.optionsFrom(observation, derived || {}, {
      skills: session.skills || [],
      landmarkIds: session.landmarkIds || [],
    });
    /* The observation cannot know about inventory, which is private to the
       character rather than perceived, so it is added here. */
    if (actor && actor.runtime && actor.runtime.inventory) {
      opts.itemIds = actor.runtime.inventory.map(function (i) { return i.uid || i.id; });
    }
    return { observation: observation, derived: derived, options: opts };
  }

  /* ------------------------------------------------------------ the turn --- */

  /**
   * A human (or an AI seat writing in character) submits free text.
   *
   * Returns as soon as the MECHANICS are committed. Narration continues in the
   * background and arrives via the 'narration' event, because a player should
   * see their hit points move immediately rather than after the model has
   * finished writing about it.
   */
  function submitText(session, actorId, text, opts) {
    opts = opts || {};
    if (session.busy) return Promise.resolve({ ok: false, reason: 'a turn is already resolving' });
    session.busy = true;
    emit(session, 'thinking', { actorId: actorId, stage: 'parsing' });

    var ctx = optionsFor(session, actorId);
    var actor = session.state.actors[actorId];

    return Referee.parse(text, ctx.observation, ctx.options, {
      actorId: actorId,
      actorName: actor && actor.name,
      sessionId: session.state.sessionId,
      stateRevision: session.state.revision,
      turnEpoch: session.state.turnEpoch,
      source: opts.source || 'human',
      inCombat: !!(session.state.combat && session.state.combat.active),
      signal: opts.signal,
      spellLabel: opts.spellLabel,
      itemLabel: opts.itemLabel,
    }).then(function (parsed) {
      emit(session, 'parsed', parsed);

      if (parsed.command.needsClarification) {
        session.busy = false;
        emit(session, 'clarify', {
          actorId: actorId,
          question: parsed.command.clarificationQuestion,
          utterance: text,
        });
        return { ok: true, clarify: parsed.command.clarificationQuestion, command: parsed.command };
      }

      /* A low-confidence parse is offered rather than applied, so a player is
         never silently committed to an action they did not mean. */
      if (opts.confirmBelow && parsed.confidence < opts.confirmBelow) {
        session.busy = false;
        emit(session, 'confirm', {
          actorId: actorId,
          command: parsed.command,
          description: Command.describe(parsed.command),
          utterance: text,
        });
        return { ok: true, confirm: parsed.command };
      }

      return applyCommand(session, parsed.command, opts);
    }).catch(function (e) {
      session.busy = false;
      emit(session, 'error', { where: 'submitText', error: String((e && e.message) || e) });
      return { ok: false, reason: String((e && e.message) || e) };
    });
  }

  /**
   * Read a sentence into a command WITHOUT doing it.
   *
   * The confirmation step needs the parse and nothing else: no dice, no state,
   * no action spent. `submitText` used to be the only way in, and it committed
   * the moment the referee returned — so the first a player heard about how
   * their sentence had been read was the narration afterwards, by which time
   * the turn was gone and the model's misreading was already history.
   *
   * Deliberately does not set `session.busy`: nothing has happened yet, and
   * holding the session while a player reads a dialog would block the table.
   */
  function interpret(session, actorId, text, opts) {
    opts = opts || {};
    var ctx = optionsFor(session, actorId);
    var actor = session.state.actors[actorId];

    /* A deadline here too. The referee runs before anything is committed and
       the composer is locked while it thinks, so a model that stops answering
       leaves a player unable to type OR act — the worst of the two failures.
       Falling back to "I could not read that" at least hands control back. */
    var controller = null;
    if (!opts.signal && typeof AbortController !== 'undefined') {
      try { controller = new AbortController(); } catch (e) { controller = null; }
    }
    var signal = opts.signal || (controller && controller.signal) || null;

    var work = Referee.parse(text, ctx.observation, ctx.options, {
      actorId: actorId,
      actorName: actor && actor.name,
      sessionId: session.state.sessionId,
      stateRevision: session.state.revision,
      turnEpoch: session.state.turnEpoch,
      source: opts.source || 'human',
      inCombat: !!(session.state.combat && session.state.combat.active),
      signal: signal,
    }).then(function (parsed) {
      var preview = null;
      if (Preview && Preview.forCommand) {
        try {
          preview = Preview.forCommand(session.state, actorId, parsed.command, sceneCtx(session));
        } catch (e) { preview = null; }
      }
      return {
        ok: true,
        command: parsed.command,
        confidence: parsed.confidence,
        clarify: parsed.command.needsClarification ? parsed.command.clarificationQuestion : null,
        preview: preview,
        utterance: text,
      };
    }).catch(function (e) {
      return { ok: false, reason: String((e && e.message) || e), utterance: text };
    });

    return withDeadline(work, {
      stallMs: opts.stallMs || 45000,
      totalMs: opts.totalMs || 60000,
      onProgress: function () { /* the referee does not stream */ },
      abort: function () { if (controller) controller.abort(); },
      onGiveUp: function (why) {
        return {
          ok: false, utterance: text,
          reason: 'the Dungeon Master did not answer (' + why + ') \u2014 ' +
            'try again, or pick an action from the list',
        };
      },
    });
  }

  /**
   * Commit a command and set narration going.
   *
   * Used by free text, by UI buttons, and by AI seats — the single path the
   * whole trust model depends on.
   */
  /**
   * What the resolvers need to know about the scene that is not in the state.
   *
   * Built here rather than at each call site so every path gets it — a button
   * press, a typed sentence, an AI seat's decision. When only the UI supplied
   * it (and it supplied nothing), `travel` was never offered and never
   * resolved, in campaigns with ten connected locations.
   *
   * Exits come from the campaign's gazetteer, which is a DEFINITION and is
   * rebuilt on load. Everything else comes from `state.locations`, which is
   * live and saved — because what the party has already taken off the floor
   * must stay taken.
   */
  function sceneCtx(session) {
    var out = {};
    var state = session.state;
    var locId = state.locationId;
    if (!locId) return out;

    var gaz = session.locations;
    var here = gaz && gaz[locId];
    if (here && here.connections) {
      out.exits = here.connections.map(function (id) {
        var to = gaz[id];
        return { id: id, name: (to && to.name) || id };
      });
    }

    var live = (state.locations || {})[locId];
    if (live) {
      /* Copies, not the live arrays.
         Handing `state.locations[here].items` straight out meant a caller held
         a reference to the world: anything that mutated it changed the game
         without an event, which is precisely what the event system exists to
         prevent, and would leave undo unable to put it back. It also made a
         captured context silently track later changes, so a test comparing
         "before" and "after" compared the same array with itself. */
      out.groundItems = copyList(live.items);
      out.obstacles = copyList(live.obstacles).filter(function (o) { return !o.cleared; });
      out.interactables = copyList(live.interactables);
      out.readables = copyList(live.readables);
      out.tracks = copyList(live.tracks);
      out.merchants = copyList(live.merchants);
      out.mounts = copyList(live.mounts);
      out.forage = !!live.forage;
      out.sceneName = live.name;
      out.biome = live.biome;
    }
    return out;
  }

  function copyList(list) {
    if (!list || !list.length) return [];
    return list.map(function (x) {
      return (x && typeof x === 'object') ? JSON.parse(JSON.stringify(x)) : x;
    });
  }

  /**
   * Furnish a location the first time the party stands in it.
   *
   * Deterministic in the campaign seed and the location id, so the same place
   * is the same place on every visit and across every reload — and stored in
   * state, so what is taken stays taken.
   */
  function ensureScene(session, locationId) {
    var state = session.state;
    var id = locationId || state.locationId;
    if (!id) return null;
    state.locations = state.locations || {};
    if (state.locations[id] && state.locations[id].furnished) return state.locations[id];

    var Contents = (global.DND && global.DND.Contents) ||
      (typeof require !== 'undefined' ? (function () {
        try { return require('./gen/contents.js'); } catch (e) { return null; }
      })() : null);
    if (!Contents) return state.locations[id] || null;

    var def = (session.locations && session.locations[id]) || { name: id, biome: 'road' };
    var scene = Contents.furnish(def, {
      locationId: id,
      seed: (state.seed || '') + ':' + id,
    });
    /* Anything already recorded for this place (a campaign's hand-placed items,
       or a previous partial visit) outranks what is generated for it. */
    var existing = state.locations[id];
    if (existing) {
      Object.keys(existing).forEach(function (k) {
        if (existing[k] != null && !(Array.isArray(existing[k]) && !existing[k].length)) {
          scene[k] = existing[k];
        }
      });
    }
    state.locations[id] = scene;
    materialiseMerchants(session, scene);
    return scene;
  }

  /**
   * Give a generated trader a body.
   *
   * The buy and sell resolvers trade with an ACTOR — they need somebody who
   * can be perceived, talked to and haggled with. A merchant that existed only
   * as scene data meant Buy and Sell were offered and then immediately
   * refused with "there is nobody here selling anything", which is worse than
   * not offering them: it teaches a player that the verb does not work.
   *
   * Making them real also means they can be asked about the town, persuaded,
   * and remembered — which is what a shopkeeper is for.
   */
  function materialiseMerchants(session, scene) {
    var state = session.state;
    (scene.merchants || []).forEach(function (m) {
      if (m.actorId && State.hasActor && State.hasActor(state, m.actorId)) return;
      var actorId = m.actorId || ('trader-' + m.id);
      m.actorId = actorId;
      if (State.hasActor && State.hasActor(state, actorId)) return;
      State.addActor(state, {
        id: actorId, name: m.name, side: 'neutral', kind: 'npc',
        role: 'trader', persona: 'a trader at ' + (scene.name || scene.id),
        base: {
          name: m.name,
          abilities: { str: 10, dex: 10, con: 10, int: 11, wis: 12, cha: 13 },
          proficiencies: { skills: ['persuasion'], saves: [] }, classes: [],
        },
        progression: { xp: 0, levels: [] },
        runtime: {
          hp: 9, hpMax: 9, tempHp: 0, conditions: {}, exhaustion: 0,
          concentratingOn: null, attuned: [], equipped: {}, inventory: [],
          deathSaves: { successes: 0, failures: 0 }, resources: {},
          gold: 60, pos: null,
        },
      });
    });
    if ((scene.merchants || []).length && State.refreshAllDerived) {
      State.refreshAllDerived(state);
    }
  }

  function withScene(session, ctx) {
    var scene = sceneCtx(session);
    if (!ctx) return scene;
    Object.keys(scene).forEach(function (k) { if (ctx[k] == null) ctx[k] = scene[k]; });
    return ctx;
  }

  function applyCommand(session, command, opts) {
    opts = opts || {};
    session.busy = true;
    emit(session, 'thinking', { actorId: command.actorId, stage: 'resolving' });

    var result = Dispatch.dispatch(session.state, session.history, command,
      withScene(session, opts.ctx));
    session.busy = false;

    if (!result.ok) {
      emit(session, 'refused', {
        command: command,
        stage: result.stage,
        errors: result.errors || [result.detail],
      });
      return Promise.resolve(result);
    }

    if (result.stage === 'duplicate' || result.stage === 'clarify') {
      return Promise.resolve(result);
    }

    /* The mechanical truth is now settled and visible. Everything after this
       point is presentation. */
    /* If that command moved the party, the place they have arrived in needs
       furnishing before anyone asks what they can do here. */
    settle(session);
    /* And anything that happened may have moved a quest along. */
    advanceQuests(session, result.batch);
    emit(session, 'committed', {
      command: command,
      batch: result.batch,
      beats: result.beats,
      revision: result.revision,
      state: session.state,
    });

    /* Levels, deaths and revivals reach the transcript from Events.commit, so
       every path into the world records them — including the ones that never
       come through here. This only surfaces them to the interface. */
    Events.milestonesIn(session.state, result.batch).forEach(function (line) {
      emit(session, 'milestone', line);
    });

    var narrationPromise = narrateBatch(session, command, result.batch, opts);
    return narrationPromise.then(function (narration) {
      return Object.assign({}, result, { narration: narration });
    });
  }

  /**
   * Produce prose for a committed batch. Never rejects.
   */
  /**
   * How long the table waits for prose before carrying on without it.
   *
   * A stalled model used to hang the whole game. `narrateBatch` awaits the
   * narration, `applyCommand` awaits `narrateBatch`, and the browser passes
   * the turn only after that resolves — so a local model that stopped
   * producing tokens left the initiative frozen, the composer waiting and no
   * way forward but reloading the page. Reported as "the GM is taking forever
   * to write", which is exactly what it looked like.
   *
   * Two limits, because they catch different failures. STALL is the useful
   * one: a narration that is streaming steadily is healthy however long it
   * runs, and one that has produced nothing for half a minute is not. TOTAL is
   * the backstop for a model that dribbles a token every few seconds forever.
   */
  var NARRATION_STALL_MS = 30000;
  var NARRATION_TOTAL_MS = 120000;

  /**
   * Give a promise a deadline that resets whenever progress is reported.
   *
   * Resolves with `onGiveUp()` rather than rejecting, because prose failing
   * must never look like the turn failing — the mechanical result was settled
   * before any of this started.
   */
  function withDeadline(promise, opts) {
    var stallMs = opts.stallMs || NARRATION_STALL_MS;
    var totalMs = opts.totalMs || NARRATION_TOTAL_MS;
    var settled = false;
    var stallTimer = null;
    var totalTimer = null;

    return new Promise(function (resolve) {
      var finish = function (value) {
        if (settled) return;
        settled = true;
        if (stallTimer) clearTimeout(stallTimer);
        if (totalTimer) clearTimeout(totalTimer);
        resolve(value);
      };
      var giveUp = function (why) {
        if (settled) return;
        try { if (opts.abort) opts.abort(); } catch (e) { /* already gone */ }
        finish(opts.onGiveUp ? opts.onGiveUp(why) : null);
      };

      opts.onProgress(function () {
        if (settled) return;
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = setTimeout(function () { giveUp('stalled'); }, stallMs);
      });

      stallTimer = setTimeout(function () { giveUp('stalled'); }, stallMs);
      totalTimer = setTimeout(function () { giveUp('too slow'); }, totalMs);

      promise.then(finish, function () { finish(null); });
    });
  }

  function narrateBatch(session, command, batch, opts) {
    opts = opts || {};
    if (opts.skipNarration) return Promise.resolve(null);

    var epoch = session.state.turnEpoch;
    emit(session, 'thinking', { actorId: command.actorId, stage: 'narrating' });

    /* Somewhere to hang up from, if the model stops answering. */
    var controller = null;
    if (!opts.signal && typeof AbortController !== 'undefined') {
      try { controller = new AbortController(); } catch (e) { controller = null; }
    }
    var signal = opts.signal || (controller && controller.signal) || null;

    var noteProgress = function () { /* replaced by withDeadline */ };
    var streamed = '';

    var work = Narrator.narrate(session.state, session.store, session.campaign, batch, {
      locationName: opts.locationName || session.locationName,
      timeOfDay: opts.timeOfDay || session.timeOfDay,
      weather: opts.weather || session.weather,
      playerAction: command.utterance || Command.describe(command),
      party: partySummary(session),
      speakers: opts.speakers || speakersFor(session, command),
      recent: session.recentNarration.slice(-3),
      pinned: session.pinned,
      summaries: session.summaries,
      history: opts.history || [],
      partyId: opts.partyId || 'party',
      turnEpoch: epoch,
      signal: signal,
      seed: opts.seed,
      onToken: function (piece) {
        streamed += piece;
        noteProgress();
        emit(session, 'narrationToken', { actorId: command.actorId, piece: piece, soFar: streamed });
      },
    }).then(function (res) {
      if (res.stale) {
        emit(session, 'narrationDropped', { reason: 'stale' });
        return null;
      }
      Dispatch.narrate(session.state, command.commandId, res.text);
      recordReveals(session, command, res.text);
      session.recentNarration.push(res.text);
      if (session.recentNarration.length > 8) session.recentNarration.shift();
      emit(session, 'narration', {
        actorId: command.actorId,
        text: res.text,
        source: res.source,
        report: res.report,
      });
      return res;
    }).catch(function () {
      /* Prose failing must never look like the turn failing. */
      var text = Offline.narrate(session.state, batch, {});
      Dispatch.narrate(session.state, command.commandId, text);
      emit(session, 'narration', { actorId: command.actorId, text: text, source: 'offline', report: { issues: ['error'] } });
      return { text: text, source: 'offline' };
    });

    return withDeadline(work, {
      stallMs: opts.stallMs,
      totalMs: opts.totalMs,
      onProgress: function (fn) { noteProgress = fn; },
      abort: function () { if (controller) controller.abort(); },
      onGiveUp: function (why) {
        /* Whatever the model managed before it stopped is better than nothing,
           and the engine's own summary is better than a blank turn. */
        var text = (streamed && streamed.trim().length > 40)
          ? streamed.trim()
          : Offline.narrate(session.state, batch, {});
        Dispatch.narrate(session.state, command.commandId, text);
        emit(session, 'narration', {
          actorId: command.actorId, text: text, source: 'offline',
          report: { issues: ['fallback:' + why] },
        });
        return { text: text, source: 'offline', gaveUp: why };
      },
    });
  }

  /**
   * Answer a question asked out of character, without spending a turn.
   *
   * This is deliberately NOT a command. Nothing is dispatched, no events are
   * committed, the revision does not move and the initiative does not pass —
   * the player has simply stopped play to ask the referee something, the way
   * anyone does at a real table. A question about the rules must never cost
   * the asker their action.
   *
   * It gets the same deadline as narration for the same reason: a stalled
   * model must not leave the composer locked with no way out but a reload.
   */
  function askDm(session, question, opts) {
    opts = opts || {};
    var controller = null;
    if (!opts.signal && typeof AbortController !== 'undefined') {
      try { controller = new AbortController(); } catch (e) { controller = null; }
    }
    var signal = opts.signal || (controller && controller.signal) || null;
    var noteProgress = function () { /* replaced by withDeadline */ };
    var streamed = '';

    var work = Promise.resolve(Narrator.answer(
      session.state, session.store, session.campaign, question, {
        locationName: opts.locationName || session.locationName,
        timeOfDay: opts.timeOfDay || session.timeOfDay,
        actorId: opts.actorId || session.state.activeActorId,
        signal: signal,
        onToken: function (piece) { streamed += piece; noteProgress(); },
      }
    ));

    return withDeadline(work, {
      stallMs: opts.stallMs,
      totalMs: opts.totalMs,
      onProgress: function (fn) { noteProgress = fn; },
      abort: function () { if (controller) controller.abort(); },
      onGiveUp: function (why) {
        return {
          text: (streamed && streamed.trim().length > 30)
            ? streamed.trim()
            : 'The Dungeon Master did not answer in time \u2014 the model stopped ' +
              'responding. Your turn is untouched; ask again, or check the ' +
              'model in setup.',
          source: 'offline',
          gaveUp: why,
        };
      },
    });
  }

  /**
   * Write down what the DM just let out.
   *
   * The campaign authorises a set of reveals each turn and the model decides
   * whether the moment earned one. That decision was never recorded anywhere,
   * so the party could be told a secret out loud and still not know it: the
   * journal stayed empty and the redactor kept scrubbing a name they had
   * already heard. A revealed fact is a change to the world, so it goes
   * through the event log like every other change — replayable, undoable, and
   * visible in an export.
   */
  function recordReveals(session, command, text) {
    var store = session.store;
    if (!store || !Knowledge.revealsIn || !Knowledge.revealable) return;
    var candidates;
    try { candidates = Knowledge.revealable(store, session.state); }
    catch (e) { return; }
    if (!candidates || !candidates.length) return;

    var landed = Knowledge.revealsIn(store, candidates, text);
    if (!landed.length) return;

    var batch = Events.makeBatch({ commandId: command.commandId + ':reveal', actorId: command.actorId });
    landed.forEach(function (r) {
      /* Recorded against the party rather than one character: the table heard
         the Dungeon Master say it, so the table knows it. */
      Events.push(batch, 'knowledge', {
        observerId: 'party', factId: r.factId, stage: r.stage,
        at: session.state.revision, provenance: 'the DM revealed it: ' + r.why,
      }, '');
      State.partyIds(session.state).forEach(function (id) {
        Events.push(batch, 'knowledge', {
          observerId: id, factId: r.factId, stage: r.stage,
          at: session.state.revision, provenance: 'heard it happen',
        }, '');
      });
    });
    var res = Events.commit(session.state, batch);
    if (res.ok) emit(session, 'revealed', { facts: landed.map(function (r) { return r.factId; }) });
  }

  /**
   * Build voice cards for whoever is being spoken to or about this turn.
   *
   * Without these the DM performs a name and a vibe, and a model handed a name
   * and no facts will invent the facts — a playtest produced a companion
   * confessing a relationship with the antagonist that does not exist in the
   * campaign. Saying explicitly what a character knows, and what they do NOT
   * know, gives the model something true to perform instead of a gap to fill.
   */
  function speakersFor(session, command) {
    var campaign = session.campaign || {};
    var involved = {};
    if (command && command.primary) {
      (command.primary.targetIds || []).forEach(function (id) { involved[id] = true; });
    }
    /* Companions present are performed too — they interject, and an unbriefed
       interjection is exactly where invention creeps in. */
    State.partyIds(session.state).forEach(function (id) {
      if (id !== (command && command.actorId)) involved[id] = true;
    });

    var playerControlled = {};
    (session.state.seats || []).forEach(function (s) { playerControlled[s.actorId] = true; });

    return Object.keys(involved).slice(0, 5).map(function (id) {
      /* Never hand the DM a voice card for a character a player is running. */
      if (playerControlled[id]) return null;
      var actor = session.state.actors[id];
      if (!actor) return null;
      var card = (campaign.npcs && campaign.npcs[id]) ||
        (campaign.characters && campaign.characters[id]) || {};

      var known = (session.store.known && session.store.known[id]) || {};
      var knowsList = Object.keys(known).map(function (fid) {
        return Knowledge.textFor(session.store, id, fid);
      }).filter(Boolean).slice(0, 6);

      /* Anything this character has NOT learned is stated as an absence, so
         the model performs ignorance rather than filling it in. */
      var unknownIds = Object.keys(session.store.facts || {}).filter(function (fid) {
        return !known[fid] && session.store.facts[fid].spoiler;
      });
      var holding = unknownIds.length
        ? 'things they have never heard of \u2014 do not have them recall any of it'
        : '';

      return {
        name: actor.name || card.name || id,
        voice: card.voice || card.speech || (actor.persona || 'plain, unremarkable speech'),
        wants: card.wants || '',
        knows: knowsList.length ? knowsList.join('; ') : 'only what has happened in front of them',
        doesNotKnow: holding,
        holdingBack: card.holdingBack || '',
      };
    }).filter(Boolean);
  }

  function partySummary(session) {
    return State.partyIds(session.state).map(function (id) {
      var a = session.state.actors[id];
      var conditions = a.runtime.conditions ? Object.keys(a.runtime.conditions) : [];
      return {
        name: a.name,
        role: a.role || '',
        /* Trimmed: a long backstory would crowd out the scene it is meant to
           colour, and the full text stays on the sheet either way. */
        backstory: (a.base && a.base.backstory) ? trimTo(a.base.backstory, 260) : '',
        wants: (a.base && a.base.wants) || a.goals || '',
        condition: a.runtime.hp <= 0 ? 'down'
          : (a.runtime.hpMax && a.runtime.hp / a.runtime.hpMax < 0.4) ? 'badly hurt'
            : conditions.length ? conditions.join(', ') : '',
      };
    });
  }

  function trimTo(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (s.length <= n) return s;
    var cut = s.slice(0, n);
    var stop = cut.lastIndexOf('. ');
    return (stop > n * 0.5 ? cut.slice(0, stop + 1) : cut) + '\u2026';
  }

  /* -------------------------------------------------------------- AI seats -- */

  /**
   * Run one turn for an AI-controlled seat.
   *
   * The seat chooses from the engine's legal moves, acts through the same
   * dispatcher a human uses, and optionally says something in character which
   * is spoken as that character rather than narrated by the DM.
   */
  function runAiSeat(session, actorId, opts) {
    opts = opts || {};
    var memory = session.agentMemory[actorId] = session.agentMemory[actorId] || PlayerAgent.makeMemory();
    var seat = (session.state.seats || []).filter(function (s) { return s.actorId === actorId; })[0];
    var actor = session.state.actors[actorId];

    /* A model seat levels itself the moment a level is owed, before it acts, so
       an unattended table never waits on a human to click through a modal. */
    autoLevelIfPending(session, actorId, opts);

    emit(session, 'thinking', { actorId: actorId, stage: 'deciding' });

    return PlayerAgent.takeTurn(session.state, session.history, session.store, actorId, {
      memory: memory,
      persona: (seat && seat.agent && seat.agent.persona) || (actor && actor.persona) || '',
      goals: (actor && actor.goals) || '',
      model: seat && seat.agent && seat.agent.model,
      viaAgentRoute: !!(seat && seat.agent && seat.agent.backend === 'copilot'),
      recentNarration: session.recentNarration.slice(-3),
      locationName: opts.locationName || session.locationName,
      steer: opts.steer,
      signal: opts.signal,
      ctx: opts.ctx,
    }).then(function (turn) {
      emit(session, 'aiTurn', { actorId: actorId, turn: turn });

      if (!turn.ok) return turn;

      if (turn.say) {
        /* An AI seat's dialogue goes into the transcript exactly like the
           narrator's prose, and until now it went in unexamined: no
           forbidden-name check, no foreign-script check, no character break.
           A player agent is handed its own character's observation, so it
           should not know a secret — but "should not" is not a guarantee, and
           the gates are cheap. */
        var clean = gateSpeech(session, actorId, turn.say);
        if (clean) {
          State.say(session.state, (actor && actor.name) || actorId, clean, 'speech');
          emit(session, 'speech', { actorId: actorId, name: actor && actor.name, text: clean });
        }
      }

      emit(session, 'committed', {
        command: turn.command, batch: turn.batch,
        beats: turn.result.beats, revision: turn.result.revision, state: session.state,
      });

      return narrateBatch(session, turn.command, turn.batch, opts).then(function (n) {
        return Object.assign({}, turn, { narration: n });
      });
    });
  }

  /**
   * Run one turn for a controller that is NOT a player seat — a companion the
   * DM is running, or a monster.
   *
   * Deterministic on purpose. A four-seat combat round already costs four
   * model calls for the players and four narrations; spending another call per
   * goblin would make a round take minutes and add nothing a policy cannot do.
   * Monsters attack, companions support, and the prose still comes from the DM.
   */
  function runNpcTurn(session, actorId, opts) {
    opts = opts || {};
    var memory = session.agentMemory[actorId] = session.agentMemory[actorId] || PlayerAgent.makeMemory();
    var actor = session.state.actors[actorId];

    /* Companions the DM runs level themselves too — same reason. */
    autoLevelIfPending(session, actorId, opts);

    return PlayerAgent.takeTurn(session.state, session.history, session.store, actorId, {
      memory: memory,
      forcePolicy: true,
      recentNarration: session.recentNarration.slice(-2),
      ctx: opts.ctx,
    }).then(function (turn) {
      emit(session, 'npcTurn', { actorId: actorId, turn: turn });
      if (!turn.ok) return turn;
      emit(session, 'committed', {
        command: turn.command, batch: turn.batch,
        beats: turn.result.beats, revision: turn.result.revision, state: session.state,
      });
      return narrateBatch(session, turn.command, turn.batch, opts).then(function (n) {
        return Object.assign({}, turn, { narration: n });
      });
    });
  }

  /** Whose turn is it, and who decides for them? */
  /**
   * Close the acting creature's turn and open the next one.
   *
   * This is the piece the browser was missing entirely. Only the playtest
   * harness had a turn loop, so a real player could take an action and the
   * initiative never moved: the same character acted for ever, monsters never
   * got a turn, rounds never ticked, and every duration measured in rounds was
   * permanent. Turn order belongs to the engine, not to the test that happened
   * to need it first.
   *
   * Out of combat there is no initiative to advance, but somebody still has to
   * be "up" so the AI seats take it in turns to speak rather than one of them
   * monologuing; there the pointer simply walks the party.
   */
  function advanceTurn(session, opts) {
    opts = opts || {};
    var state = session.state;

    if (state.combat && state.combat.active) {
      var over = Combat.encounterOver && Combat.encounterOver(state);
      if (over && over.over) return endEncounter(session, over);

      var batch = Combat.advanceTurn(state, opts);
      var res = Events.commit(state, batch);
      if (!res.ok) return { ok: false, error: res.error };
      State.advanceTurnEpoch(state);
      emit(session, 'turn', { actorId: state.activeActorId, round: state.combat.round });

      /* Death saves, ongoing damage and expiring effects all belong to the
         start of a turn, and startTurn is where they live. */
      var open = Combat.startTurn(state, state.activeActorId, { alreadyStarted: true });
      if (open && open.events.length) Events.commit(state, open);

      /* The blow that opened this turn may have finished the fight. */
      var after = Combat.encounterOver && Combat.encounterOver(state);
      if (after && after.over) return endEncounter(session, after);
      return { ok: true, actorId: state.activeActorId, round: state.combat.round };
    }

    var ring = explorationOrder(session);
    if (!ring.length) {
      /* Nobody is on their feet. Hand the turn to whoever is still rolling
         death saves so the scene resolves; if everyone left is stable or dead,
         there is nothing to resolve by taking turns. */
      var dying = dyingOrder(session);
      if (!dying.length) {
        /* A party lying stable at zero hit points is not a stalemate in the
           2014 rules: a stable creature that takes no further damage regains
           one hit point after 1d4 hours. Sitting on the initiative waiting for
           it burned forty loop steps a call and a thousand revisions a minute
           while nothing whatever happened. Let the time pass. */
        var down = downedParty(session);
        if (down.length) return wakeTheStable(session, down);
        state.activeActorId = null;
        State.advanceTurnEpoch(state);
        emit(session, 'turn', { actorId: null, round: null });
        return { ok: true, actorId: null };
      }
      state.activeActorId = dying[(dying.indexOf(state.activeActorId) + 1) % dying.length];
      State.advanceTurnEpoch(session.state);
      if (state.activeActorId) {
        var open = Combat.startTurn(state, state.activeActorId, { alreadyStarted: true });
        if (open && open.events.length) Events.commit(state, open);
      }
      emit(session, 'turn', { actorId: state.activeActorId, round: null });
      return { ok: true, actorId: state.activeActorId };
    }
    var at = ring.indexOf(state.activeActorId);
    state.activeActorId = ring[(at + 1) % ring.length];
    State.advanceTurnEpoch(state);
    emit(session, 'turn', { actorId: state.activeActorId, round: null });
    return { ok: true, actorId: state.activeActorId };
  }

  /* Who gets to act when no one has rolled initiative: everyone at the table
     who is still on their feet, seats first so the players lead. */
  function explorationOrder(session) {
    var state = session.state;
    var seated = (state.seats || []).map(function (s) { return s.actorId; });
    var party = State.partyIds(state).filter(function (id) { return seated.indexOf(id) < 0; });
    return seated.concat(party).filter(function (id) {
      var a = state.actors[id];
      return a && !a.runtime.dead && a.runtime.hp > 0;
    });
  }

  /**
   * Party members who are down but not yet dead, and who still have something
   * to resolve — that is, who are still rolling death saves.
   *
   * When a fight ends with everyone on the floor, `explorationOrder` is empty
   * — nobody has hit points — and the initiative had nowhere to go, so it
   * stayed with whatever was holding it: the monster that put them there. The
   * loop then asked that monster to act, over and over, out of combat, where
   * there is no action economy to spend and no initiative to advance.
   *
   * STABLE characters are excluded. A stabilised creature rolls no more death
   * saves, so handing it the turn achieves nothing at all — and a party that
   * was entirely stable at zero hit points span the loop for ever, burning
   * forty steps a call and climbing a thousand revisions a minute while
   * absolutely nothing happened.
   */
  function dyingOrder(session) {
    var state = session.state;
    var seated = (state.seats || []).map(function (s) { return s.actorId; });
    var party = State.partyIds(state).filter(function (id) { return seated.indexOf(id) < 0; });
    return seated.concat(party).filter(function (id) {
      var a = state.actors[id];
      return a && !a.runtime.dead && a.runtime.hp <= 0 && !a.runtime.stable;
    });
  }

  /**
   * Everyone who is down, whether or not they are still rolling.
   */
  function downedParty(session) {
    var state = session.state;
    return State.partyIds(state).filter(function (id) {
      var a = state.actors[id];
      return a && !a.runtime.dead && a.runtime.hp <= 0;
    });
  }

  /**
   * Who should hold the initiative out of combat.
   *
   * Anyone on their feet first; failing that, whoever is bleeding out, so
   * their death saves resolve; failing that nobody, which stops the loop
   * cleanly instead of parking it on a monster.
   */
  function outOfCombatHolder(session) {
    var up = explorationOrder(session);
    if (up.length) return up[0];
    var dying = dyingOrder(session);
    return dying.length ? dying[0] : null;
  }

  /**
   * Hours pass, and the stable wake at one hit point.
   *
   * PHB, "Stabilizing a Creature": a stable creature that takes no further
   * damage regains 1 hit point after 1d4 hours. It is the rule that stops a
   * party lying unconscious in a field from being the permanent end of a
   * campaign — and without it the turn loop had nothing to advance and span.
   */
  function wakeTheStable(session, down) {
    var state = session.state;
    var hours = 1 + Math.floor((state.rng ? state.rng.next() : Math.random()) * 4);
    var batch = Events.makeBatch({ commandId: 'wake:' + state.revision, actorId: null });
    Events.push(batch, 'time', { minutes: hours * 60 },
      'Hours pass. ' + (hours === 1 ? 'An hour' : hours + ' hours') + ', by the light.');
    down.forEach(function (id) {
      var a = state.actors[id];
      if (!a || a.runtime.dead) return;
      Events.push(batch, 'revive', { actorId: id, hp: 1 },
        (a.name || id) + ' comes round, barely.');
    });
    Events.commit(state, batch);
    State.refreshAllDerived(state);

    var ring = explorationOrder(session);
    state.activeActorId = ring.length ? ring[0] : null;
    State.advanceTurnEpoch(state);
    emit(session, 'turn', { actorId: state.activeActorId, round: null });
    emit(session, 'partyRecovered', { hours: hours, who: down.slice() });
    return { ok: true, actorId: state.activeActorId, recovered: down.length };
  }

  function endEncounter(session, over) {
    var state = session.state;
    var batch = Combat.endEncounter
      ? Combat.endEncounter(state, { winner: over.winner })
      : null;
    if (batch) Events.commit(state, batch);
    else if (state.combat) state.combat.active = false;
    State.advanceTurnEpoch(state);

    /* Whoever is up next out of combat should be a player, not the last
       monster standing in the initiative order — and if nobody is on their
       feet, whoever is bleeding out, so their death saves still resolve. */
    state.activeActorId = outOfCombatHolder(session) || null;
    emit(session, 'encounterEnd', { winner: over.winner });
    return { ok: true, encounterOver: true, winner: over.winner, actorId: state.activeActorId };
  }

  /**
   * Has this creature finished what it can do this turn?
   *
   * The obvious test — "action and bonus action both spent" — deadlocks the
   * loop, because most creatures never have a bonus action worth taking, so
   * `bonus` stays true for ever and the initiative never moves. A measured run
   * of a two-on-two fight burned all four hundred steps inside round one.
   *
   * So: the action is what ends a turn. `passes` lets the caller offer one
   * extra go round after the action is spent, which is where a bonus-action
   * heal or a second wind gets taken before the turn closes.
   */
  /**
   * Roll initiative if there are enemies present and no fight underway.
   *
   * The opening scene deliberately puts hostiles in the room, the action bar
   * duly offered "Attack" — and no encounter was ever started, so there was no
   * initiative, no action economy, and no turn to end. A player could attack
   * indefinitely while nothing attacked back. The playtest harness called
   * `beginEncounter` itself, which is exactly why this never showed up.
   */
  function ensureEncounter(session) {
    var state = session.state;
    if (state.combat && state.combat.active) return false;
    var foes = State.livingEnemies(state);
    if (!foes.length) return false;

    var combatants = Object.keys(state.actors).filter(function (id) {
      var a = state.actors[id];
      return a && a.runtime && !a.runtime.dead && a.runtime.hp > 0;
    }).map(function (id) {
      var d = state.actors[id].derivedCache || {};
      return {
        id: id,
        mod: d.initiative || 0,
        dex: (state.actors[id].base && state.actors[id].base.abilities &&
          state.actors[id].base.abilities.dex) || 10,
      };
    });
    if (combatants.length < 2) return false;

    var res = Events.commit(state, Combat.beginEncounter(state, combatants, {}));
    if (!res.ok) return false;

    /* beginEncounter sets the order but opens nobody's turn, so the first
       combatant would have no action economy and no legal attacks. */
    var first = (state.combat.order || [])[0];
    if (first) Events.commit(state, Combat.startTurn(state, first.id));
    emit(session, 'encounterStart', { order: state.combat.order });
    return true;
  }

  function turnIsSpent(session, actorId, passes) {
    var a = session.state.actors[actorId];
    if (!a) return true;
    if (a.runtime.dead) return true;
    var t = a.runtime.turn;
    if (!t) {
      /* No action economy at all. In a fight that means the turn was never
         opened and something is wrong. Out of combat there is no economy by
         design — but answering "spent" unconditionally meant every AI seat was
         judged finished BEFORE it acted, so exploration seats never got a turn
         and the loop walked the table for ever looking for someone who could.
         Out of combat a seat gets exactly one go, then the spotlight moves. */
      if (session.state.combat && session.state.combat.active) return true;
      return (passes || 0) >= 1;
    }
    if (t.surprised) return true;
    if (t.action) return false;

    /* The action is gone. A bonus action only holds the turn open if there is
       something to spend it on — most creatures have nothing, and treating the
       unspendable bonus as "not finished yet" is what deadlocked the loop: a
       two-on-two fight burned four hundred steps inside round one, and in the
       browser the initiative simply never left the player. */
    if (!t.bonus) return true;
    if ((passes || 0) >= 1) return true;
    return !hasBonusMove(session, actorId);
  }

  /* Is there anything this creature could actually do with a bonus action? */
  function hasBonusMove(session, actorId) {
    if (!Dispatch || !Dispatch.legalMoves) return false;
    try {
      return (Dispatch.legalMoves(session.state, actorId, {}) || []).some(function (m) {
        return m.cost === 'bonus';
      });
    } catch (e) {
      /* If the move list cannot be built, do not hold the table hostage. */
      return false;
    }
  }

  /**
   * Run a seat's spoken line through the same gates the narrator's prose gets.
   *
   * Returns the cleaned line, or an empty string if it cannot be salvaged —
   * a seat that says nothing is a far smaller problem than a seat that says
   * the antagonist's name three sessions early, or drops a stray CJK token
   * mid-sentence, or announces that it is an AI language model.
   */
  function gateSpeech(session, actorId, text) {
    if (!Narrator || !Narrator.applyGates) return text;
    var forbidden = [];
    if (session.store && Knowledge.forbiddenNames) {
      /* Judged against what THIS character knows, not what the party knows:
         a companion who has not been told the secret must not say it even if
         someone else at the table has heard it. */
      try { forbidden = Knowledge.forbiddenNames(session.store, actorId, session.state); }
      catch (e) { forbidden = []; }
    }
    var gated = Narrator.applyGates(text, {
      mustNotName: forbidden,
      /* The speaker is allowed to speak as themselves; everyone else is not. */
      playerCharacters: State.partyIds(session.state)
        .filter(function (id) { return id !== actorId; })
        .map(function (id) { return (session.state.actors[id] || {}).name; })
        .filter(Boolean),
      recent: session.recentNarration.slice(-2),
      maxWords: 60,
    });
    if (!gated.report.usable) {
      emit(session, 'speechDropped', { actorId: actorId, issues: gated.report.issues });
      return '';
    }
    return gated.text;
  }

  /**
   * What this character may prepare, and how many.
   *
   * Null for anyone who does not prepare spells. A long rest re-prepares
   * automatically so an unattended game never stalls on a menu; this is the
   * door for a player who wants to choose the slate themselves.
   */
  function preparationFor(session, actorId) {
    var a = session.state.actors[actorId];
    if (!a || !Prepare) return null;
    Prepare.ensureSpellbook(a.base, a.progression);
    return Prepare.preparationFor(a.base, a.progression, derivedFor(session, actorId));
  }

  /**
   * Commit a chosen slate. Rejects an illegal one rather than quietly
   * trimming it — a player who picked a spell they cannot prepare should be
   * told, not silently overruled.
   */
  function applyPreparation(session, actorId, chosen) {
    var plan = preparationFor(session, actorId);
    if (!plan) return { ok: false, errors: ['this character does not prepare spells'] };
    var errors = Prepare.validate(plan, chosen);
    if (errors.length) return { ok: false, errors: errors };

    var batch = Events.makeBatch({ commandId: 'prepare:' + actorId + ':' + session.state.revision, actorId: actorId });
    Prepare.eventsFor(actorId, plan, chosen).forEach(function (e) { batch.events.push(e); });
    var a = session.state.actors[actorId];
    batch.beats.push((a && a.name ? a.name : actorId) + ' prepares their spells.');

    var res = Events.commit(session.state, batch);
    if (!res.ok) return { ok: false, errors: [res.error] };
    State.refreshDerived(session.state, actorId);
    emit(session, 'prepared', { actorId: actorId, spells: chosen.slice() });
    return { ok: true, revision: res.revision, spells: chosen.slice() };
  }

  /** Choose a sensible slate without asking. Used by the "prepare for me"
      button and by AI-controlled seats. */
  function autoPreparation(session, actorId) {
    var plan = preparationFor(session, actorId);
    if (!plan) return { ok: false, errors: ['this character does not prepare spells'] };
    return applyPreparation(session, actorId, Prepare.autoChoose(plan, {}));
  }

  function currentController(session) {
    var actorId = session.state.activeActorId;
    if (!actorId) return null;
    return { actorId: actorId, controller: State.controllerFor(session.state, actorId) };
  }

  /**
   * Advance until a human is needed.
   *
   * This is what makes a fully-AI playtest possible and what makes a mixed
   * table pleasant: AI seats, companions and monsters resolve without anyone
   * clicking, and the loop stops the moment a person has to decide.
   */
  function advanceUntilHuman(session, opts) {
    opts = opts || {};
    /* A fresh request clears any earlier Stop. Without this, pressing Stop
       once left the flag set for the rest of the session and Play never
       worked again. */
    session.__stopRequested = false;
    var limit = opts.maxSteps || 40;
    /* How many goes the creature holding the initiative has already had. A
       creature that acts, and acts, and never finishes is the loop's worst
       failure mode — it looks like the game is running while the round never
       turns over — so passes are counted and spent. */
    var passes = 0;
    var holder = null;

    function step(n) {
      if (n <= 0) return Promise.resolve({ stopped: 'step limit' });
      /* A person asked the table to stop. Checked between every seat, because
         a Stop that only takes effect when the loop happens to finish is not
         a Stop: pressing it during an all-AI run still committed twenty turns
         in under two seconds. */
      if (session.__stopRequested) return Promise.resolve({ stopped: 'asked to stop' });
      var cur = currentController(session);
      if (!cur) return Promise.resolve({ stopped: 'nobody is acting' });

      if (cur.actorId !== holder) { holder = cur.actorId; passes = 0; }

      /* Anyone who cannot act is passed over rather than asked to decide. A
         dead actor left holding the initiative used to stall the whole loop;
         a dying one has already rolled its death save in the turn upkeep. */
      var a = session.state.actors[cur.actorId];
      var cannotAct = !a || a.runtime.dead || a.runtime.hp <= 0;

      /* A person is asked BEFORE the turn is judged spent. Out of combat there
         is no action economy at all, so "spent" is vacuously true — checking it
         first skipped straight past the player, walked the whole table, ran out
         of steps, and started again. The browser locked up in exactly that
         loop. Only an inability to act passes a human by. */
      if (!cannotAct && cur.controller.kind === 'human') {
        emit(session, 'awaitingHuman', { actorId: cur.actorId });
        return Promise.resolve({ stopped: 'human', actorId: cur.actorId });
      }

      if (cannotAct || turnIsSpent(session, cur.actorId, passes)) {
        var moved = advanceTurn(session, opts);
        if (moved.encounterOver) return Promise.resolve({ stopped: 'encounter over', winner: moved.winner });
        if (!moved.ok) return Promise.resolve({ stopped: moved.error || 'could not advance' });
        return step(n - 1);
      }

      var before = session.state.revision;
      var run = cur.controller.kind === 'playerAI'
        ? runAiSeat(session, cur.actorId, opts)
        : runNpcTurn(session, cur.actorId, opts);
      return run.then(function () {
        passes++;
        /* A controller that changed nothing at all has nothing to say; giving
           it another go would only produce the same nothing. */
        if (session.state.revision === before) passes = 99;
        return step(n - 1);
      }, function (err) {
        /* One seat's failure must not take the table down with it: the turn
           passes and play continues. */
        emit(session, 'seatError', { actorId: cur.actorId, error: String((err && err.message) || err) });
        passes = 99;
        return step(n - 1);
      });
    }
    return step(limit);
  }

  /**
   * A human has acted; move the table on if they are done.
   *
   * The UI calls this after a player's command so the initiative does not sit
   * on someone who has already spent their turn — and so the monsters get to
   * hit back without anyone pressing a button.
   */
  function endHumanTurn(session, opts) {
    var actorId = session.state.activeActorId;
    if (actorId && !turnIsSpent(session, actorId, 99)) {
      var b = Combat.endTurn(session.state, actorId, opts || {});
      Events.commit(session.state, b);
    }
    var moved = advanceTurn(session, opts);
    if (moved.encounterOver) return Promise.resolve({ stopped: 'encounter over', winner: moved.winner });
    return advanceUntilHuman(session, opts);
  }

  /* ------------------------------------------------------------ undo/redo -- */

  function undo(session) {
    var r = State.undo(session.history, session.state);
    if (r.ok) {
      session.recentNarration.pop();
      emit(session, 'undone', { label: r.label, state: session.state });
    }
    return r;
  }

  function redo(session) {
    var r = State.redo(session.history, session.state);
    if (r.ok) emit(session, 'redone', { label: r.label, state: session.state });
    return r;
  }

  /** "That whole exchange went wrong" — rewind to before a specific command. */
  function rewindTo(session, commandId) {
    var r = State.rewindTo(session.history, session.state, commandId);
    if (r.ok) emit(session, 'undone', { label: commandId, state: session.state });
    return r;
  }

  /**
   * Retry the words without retrying the dice.
   *
   * The single most useful affordance when a model writes something the player
   * dislikes: the fiction changes, the mechanics do not move at all.
   */
  function retryNarration(session, commandId, opts) {
    var batch = (session.state.log || []).filter(function (b) { return b.commandId === commandId; }).pop();
    if (!batch) return Promise.resolve(null);
    var command = { commandId: commandId, actorId: batch.actorId, utterance: '' };
    /* Feed the rejected version in as something to avoid, so the retry is
       actually different rather than a resample of the same thing. */
    var previous = batch.narration;
    if (previous) session.recentNarration.push(previous);
    return narrateBatch(session, command, batch, opts || {});
  }

  /* ------------------------------------------------------------ level-up -- */

  /** The campaign's death policy, resolved from state.meta (defaults sanely). */
  function deathPolicy(session) {
    if (!Mortality || !session || !session.state) return null;
    return Mortality.policy(session.state);
  }

  /** Is a level owed for this actor? Cheap enough for the panels to poll. */
  function pendingLevel(session, actorId) {
    if (!LevelUp) return null;
    var a = session.state.actors[actorId];
    if (!a) return null;
    try { return LevelUp.pendingLevel(a.base, a.progression); } catch (e) { return null; }
  }

  /** Is a level owed, and if so what does it ask the character to decide? */
  function levelUpFor(session, actorId, opts) {
    opts = opts || {};
    if (!LevelUp) return null;
    var a = session.state.actors[actorId];
    if (!a) return null;
    var pending = LevelUp.pendingLevel(a.base, a.progression);
    if (!pending) return null;
    var classId = opts.classId || (a.base.classes && a.base.classes[0] && a.base.classes[0].classId);
    var options = LevelUp.optionsFor(a.base, a.progression, { classId: classId, allowFeats: !!opts.allowFeats });
    return { pending: pending, options: options };
  }

  /**
   * Commit a level-up as an ordinary, undoable turn.
   *
   * The choices become events, the events are committed inside a checkpoint —
   * so the existing Undo button rewinds a level exactly as it rewinds an
   * attack — and the beats reach the log through the same 'committed' event
   * every other turn uses. Nothing here mutates state directly.
   */
  function applyLevelUp(session, actorId, options, choices, opts) {
    opts = opts || {};
    var a = session.state.actors[actorId];
    if (!a) return { ok: false, errors: ['no such actor'] };

    var commandId = 'levelup:' + actorId + ':' + options.toLevel + ':' + (session.state.revision || 0);
    /* A fresh RNG for any hit-die roll: the rolled value is stored on the level
       entry and the applier reads it back, so re-folding the log is
       deterministic and undo does not have to rewind the session RNG. */
    var res = LevelUp.applyLevel(a.base, a.progression, options, choices, {
      rng: RNG ? new RNG(commandId) : undefined,
      actorId: actorId, actorName: a.name,
    });
    if (!res.ok) return res;

    var batch = Events.makeBatch({ commandId: commandId, actorId: actorId });
    res.events.forEach(function (e) { batch.events.push(e); });
    batch.beats = (res.beats || []).slice();

    /* Checkpoint before the commit, like the dispatcher does, so this turn sits
       on the undo stack. */
    State.checkpoint(session.history, session.state, commandId);
    var commit = Events.commit(session.state, batch);
    if (!commit.ok) {
      State.undo(session.history, session.state);
      return { ok: false, errors: [commit.error] };
    }

    emit(session, 'committed', {
      command: { commandId: commandId, actorId: actorId },
      batch: batch, beats: batch.beats, revision: commit.revision, state: session.state,
    });
    /* Close the streaming narration paragraph the log opens for every committed
       turn — a level-up is not narrated by the model, but it should read as a
       finished beat rather than one that is forever "writing…". */
    emit(session, 'narration', {
      actorId: actorId, source: 'system',
      text: (a.name || 'The character') + ' advances to level ' + options.toLevel + '. ' + (options.summary || ''),
    });
    return { ok: true, batch: batch, revision: commit.revision, entry: res.entry };
  }

  /**
   * Level a seat up without asking, choosing the way the class would.
   *
   * AI-controlled seats and DM-run companions must never stall an unattended
   * playtest on a level-up prompt, so the turn path calls this before they act.
   */
  function autoLevelIfPending(session, actorId, opts) {
    opts = opts || {};
    var applied = [];
    /* A big experience award can owe more than one level; resolve them all. */
    for (var guard = 0; guard < 20; guard++) {
      var lu = levelUpFor(session, actorId, opts);
      if (!lu) break;
      var choices = LevelUp.autoChoose(a(session, actorId).base, a(session, actorId).progression, lu.options, {
        rng: RNG ? new RNG('auto:' + actorId + ':' + guard) : undefined,
        rollHp: !!opts.rollHp,
      });
      var r = applyLevelUp(session, actorId, lu.options, choices, opts);
      if (!r.ok) break;
      applied.push(lu.options.toLevel);
    }
    return applied;
  }

  function a(session, actorId) { return session.state.actors[actorId]; }

  var api = {
    createSession: createSession,
    on: on, emit: emit,
    observationFor: observationFor,
    derivedFor: derivedFor,
    selfView: selfView,
    optionsFor: optionsFor,
    /* Exposed so the browser offers moves with the same scene context the
       engine resolves them with. Two copies of this drifted apart once. */
    sceneCtx: sceneCtx,
    ensureScene: ensureScene,
    seatTheInitiative: seatTheInitiative,
    settle: settle,
    submitText: submitText,
    interpret: interpret,
    askDm: askDm,
    applyCommand: applyCommand,
    narrateBatch: narrateBatch,
    partySummary: partySummary,
    speakersFor: speakersFor,
    runAiSeat: runAiSeat,
    runNpcTurn: runNpcTurn,
    currentController: currentController,
    advanceUntilHuman: advanceUntilHuman,
    advanceTurn: advanceTurn, endHumanTurn: endHumanTurn, turnIsSpent: turnIsSpent,
    ensureEncounter: ensureEncounter, gateSpeech: gateSpeech,
    preparationFor: preparationFor, applyPreparation: applyPreparation,
    autoPreparation: autoPreparation,
    explorationOrder: explorationOrder,
    undo: undo, redo: redo, rewindTo: rewindTo,
    retryNarration: retryNarration,
    pendingLevel: pendingLevel,
    levelUpFor: levelUpFor,
    applyLevelUp: applyLevelUp,
    autoLevelIfPending: autoLevelIfPending,
    deathPolicy: deathPolicy,
  };

  global.DND = global.DND || {};
  global.DND.Game = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
