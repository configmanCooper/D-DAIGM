/*
 * ui/app.js — DND.App
 *
 * Boot and wiring. This is the one module that knows about all the others: it
 * reads /api/status, configures the backend, runs the setup wizard, holds the
 * single UI-state object `S`, subscribes to every Game event and routes it to
 * the right panel, and exposes the small `App.*` surface the panels call back
 * into. Every risky boot step is wrapped so a missing optional module shows a
 * readable error panel instead of a white screen.
 *
 * The local model is the default everywhere. No code path here selects a
 * Copilot model on its own.
 */
(function (global) {
  'use strict';

  var DND = global.DND = global.DND || {};

  /* The whole of the UI's mutable state lives here, in one object, the way the
     sibling game does it — so any panel can read it and there is one place to
     look when the screen and the truth disagree. */
  var S = {
    view: 'sheet',          // which context tab is showing
    viewerId: null,         // whose eyes we see through
    status: null,           // last /api/status payload
    localModels: [],
    copilotModels: [],
    playing: false,         // "play on" loop is running
    booted: false,
  };

  var session = null;
  var unsubscribers = [];

  function $(id) { return document.getElementById(id); }

  /* HTML-escape everything that reaches innerHTML. Every panel routes user- and
     model-provided text through here. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ============================================================== boot === */

  function boot() {
    try {
      wireChrome();
      reportMissing();
      /* Combat self-registers on load, but be explicit and idempotent so a
         future load-order change cannot silently leave actors with no moves. */
      if (DND.Combat && DND.Combat.register) { try { DND.Combat.register(); } catch (e) { /* already done */ } }
      loadStatus();                       // async; the wizard does not wait on it
      DND.Setup && DND.Setup.open(onBegin);
      S.booted = true;
    } catch (e) {
      fatal(e);
    }
  }

  /* A boot or runtime failure becomes a readable panel, never a blank page. */
  function fatal(e) {
    var box = $('fatal');
    var msg = (e && (e.stack || e.message)) || String(e);
    if (box) {
      box.hidden = false;
      box.innerHTML = '<h2>Something broke while starting the table.</h2>' +
        '<p>The rest of the app is still here; this panel is so the screen is never blank.</p>' +
        '<pre>' + esc(msg) + '</pre>' +
        '<button class="chip" id="fatal-dismiss" type="button">Dismiss</button>';
      var d = $('fatal-dismiss');
      if (d) d.onclick = function () { box.hidden = true; };
    }
    if (typeof console !== 'undefined') console.error('AETHERTABLE boot error:', e);
  }

  /* If any optional <script> 404'd, its tag pushed a note. Surface it quietly
     rather than pretending everything loaded. */
  function reportMissing() {
    var miss = global.__dndMissing || [];
    if (miss.length && typeof console !== 'undefined') {
      console.info('AETHERTABLE: optional modules absent (degrading gracefully): ' + miss.join(', '));
    }
  }

  /* =========================================================== status === */

  function loadStatus() {
    setAiStatus('checking…');
    fetchJson('/api/status').then(function (st) {
      S.status = st || {};
      S.localModels = (st && st.models) || [];
      S.copilotModels = (st && st.copilot && st.copilot.models) || [];
      seedModelPickers();
      var ollamaUp = st && st.ollama;
      setAiStatus(ollamaUp ? ('local ready' + (st.recommended ? ' · ' + st.recommended : '')) : 'local offline — templated narration');
    }).catch(function () {
      /* No server, or it declined: the game still runs fully offline. */
      S.status = { ok: false, models: [] };
      setAiStatus('offline — templated narration');
    });
  }

  /* Make sure the DM picker's local optgroup reflects what the server actually
     has, WITHOUT ever making a Copilot option the first/default one. */
  function seedModelPickers() {
    var sel = $('dm-model');
    if (!sel || !S.localModels.length) return;
    var group = sel.querySelector('optgroup');
    if (!group) return;
    /* Emptying the group drops whatever was selected, and the browser then
       falls through to the first option still standing — which, with the local
       group momentarily empty, is a Copilot model. The picker silently
       defaulted to a paid hosted model, which is exactly what must never
       happen. Remember the selection and put it back deliberately. */
    var previous = sel.value;
    // keep the existing hand-authored local options if the server list is empty;
    // otherwise rebuild the local group from the server, local-first.
    group.innerHTML = '';
    S.localModels.forEach(function (m, i) {
      var o = document.createElement('option');
      o.value = m; o.textContent = 'Local · ' + m + (i === 0 ? ' (recommended)' : '');
      group.appendChild(o);
    });
    var off = document.createElement('option');
    off.value = ''; off.textContent = 'Offline · no model, templated narration';
    group.appendChild(off);

    var stillThere = Array.prototype.some.call(sel.options, function (o) { return o.value === previous; });
    if (previous && stillThere && !isCopilotValue(previous)) {
      sel.value = previous;
    } else {
      sel.value = S.localModels[0];
    }
    /* Belt and braces: if anything above still left a Copilot model selected,
       force it back to local. The default is never the paid option. */
    if (isCopilotValue(sel.value)) sel.value = S.localModels[0];
  }

  function isCopilotValue(v) { return String(v || '').indexOf('copilot:') === 0; }

  function setAiStatus(text) { var el = $('ai-status'); if (el) el.textContent = text; }

  function fetchJson(url, opts) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
    return fetch(url, opts).then(function (r) { if (!r.ok) throw new Error('status ' + r.status); return r.json(); });
  }

  /* ========================================================= session === */

  function onBegin(sess, dm) {
    try {
      session = sess;
      configureBackend((dm && dm.model) || '');
      subscribe();
      S.viewerId = firstHumanSeat() || firstSeat();
      if (DND.Log) DND.Log.reset();
      if (DND.Log) DND.Log.system('The table is set. ' + (session.campaign && session.campaign.title ? session.campaign.title + '.' : ''));
      /* The opening scene puts hostiles in the room. Roll for initiative
         before anyone is asked to act, so the first turn has an action economy
         and the monsters are in the order rather than watching from it. */
      if (DND.Game.ensureEncounter(session) && DND.Log) {
        DND.Log.system('Roll for initiative.');
      }
      renderAll();
      // If the opening turn belongs to AI seats, let them go until a human is up.
      maybeAutoAdvance();
    } catch (e) {
      fatal(e);
    }
  }

  function configureBackend(model) {
    if (!DND.Backend || !DND.Backend.configure) return;
    var cfg = backendCfg(model);
    try { DND.Backend.configure(cfg); } catch (e) { /* offline fallback is automatic */ }
  }

  /* A model string -> a backend config. '' is offline, a 'copilot:' prefix is
     Copilot, anything else is a local Ollama model. */
  function backendCfg(model) {
    if (!model) return { kind: 'offline', model: null };
    if (model.indexOf('copilot:') === 0) return { kind: 'copilot', model: model.slice(8) };
    return { kind: 'ollama', model: model };
  }

  /* --------------------------------------------------------- events --- */

  function subscribe() {
    unsubscribe();
    var G = DND.Game;
    function on(name, fn) { unsubscribers.push(G.on(session, name, fn)); }

    on('thinking', function (p) { setTurnHint(p); });
    on('parsed', function () { /* no UI beat needed; committed is the truth */ });
    on('clarify', function (p) {
      if (DND.Log) DND.Log.system('The DM needs to know: ' + (p && p.question));
      setHint(p && p.question ? p.question : '');
    });
    on('confirm', function (p) { setHint((p && p.description) || 'Confirm that action.'); });
    on('refused', function (p) {
      var errs = (p && p.errors) || [];
      if (DND.Log) DND.Log.system('That does not work: ' + (errs.length ? errs.join('; ') : 'not a legal move right now') + '.');
    });
    on('committed', function (p) {
      if (DND.Log) DND.Log.committed(p);
      afterTurn();
    });
    on('narrationToken', function (p) { if (DND.Log) DND.Log.narrationToken(p); });
    on('narration', function (p) { if (DND.Log) DND.Log.narration(p); });
    on('narrationDropped', function () { if (DND.Log) DND.Log.narrationDropped(); });
    on('speech', function (p) { if (DND.Log) DND.Log.speech(p.actorId, p.name, p.text); });
    on('aiTurn', function (p) { if (DND.Watch) DND.Watch.showMove(p.actorId, p.turn); });
    on('awaitingHuman', function (p) {
      S.playing = false;
      if (DND.Watch) DND.Watch.setStatus('waiting for ' + (actorName(p.actorId) || 'a person'));
      updateTurnIndicator();
      refreshActionBar();
    });
    on('undone', function () { if (DND.Log) DND.Log.system('— the last turn was taken back —'); afterTurn(); });
    on('redone', function () { if (DND.Log) DND.Log.system('— redone —'); afterTurn(); });
    on('error', function (p) { if (DND.Log) DND.Log.system('Engine error: ' + ((p && p.message) || 'unknown') + '.'); });
  }

  function unsubscribe() {
    unsubscribers.forEach(function (u) { try { u(); } catch (e) { /* ignore */ } });
    unsubscribers = [];
  }

  /* Runs after any state-changing event: re-render the panels that depend on
     state and refresh the turn/undo chrome. */
  function afterTurn() {
    renderAll();
    updateTopbar();
    toggleCombatView();
    /* A death used to leave a seat with no character and no way forward: no
       legal actions, no offer of resurrection, no replacement, nothing. The
       engine raises a flag when that happens; this is what answers it. */
    if (DND.Mortal && session) {
      DND.Mortal.check(session, function () { renderAll(); updateTopbar(); });
    }
  }

  function setTurnHint(p) {
    if (!p) return;
    var who = actorName(p.actorId) || 'someone';
    var stage = p.stage || '';
    if (stage === 'narrating') setHint('The DM is writing…');
    else if (stage === 'deciding') setHint(who + ' is deciding…');
    else if (stage === 'resolving') setHint('Resolving…');
    else setHint(who + '…');
  }

  function setHint(text) { var el = $('say-hint'); if (el) el.textContent = text || ''; }

  /* ========================================================== render === */

  function renderAll() {
    safe(function () { DND.Party && DND.Party.render(); });
    safe(function () { DND.Sheet && DND.Sheet.render(); });
    safe(function () { DND.Inventory && DND.Inventory.render(); });
    safe(function () { DND.Journal && DND.Journal.render(); });
    safe(function () { DND.Watch && DND.Watch.render(); });
    refreshActionBar();
    updateTopbar();
    updateTurnIndicator();
    toggleCombatView();
  }

  function safe(fn) { try { fn(); } catch (e) { if (typeof console !== 'undefined') console.error('panel render failed:', e); } }

  function updateTopbar() {
    var title = $('campaign-title');
    if (title) title.textContent = (session && session.campaign && session.campaign.title) || 'no session';
    var undo = $('btn-undo'), redo = $('btn-redo');
    if (session && session.history) {
      if (undo) undo.disabled = !(session.history.past && session.history.past.length);
      if (redo) redo.disabled = !(session.history.future && session.history.future.length);
    }
  }

  function updateTurnIndicator() {
    var el = $('turn-indicator');
    if (!el || !session) return;
    var cur = DND.Game.currentController(session);
    if (!cur) { el.textContent = ''; return; }
    var lbl = controllerLabel(cur.actorId);
    el.textContent = (actorName(cur.actorId) || '') + ' — ' + lbl.text;
  }

  /**
   * Put the buttons a player is most likely to want first.
   *
   * The bar is capped, and the raw legal-move list is ordered by whichever
   * resolver registered first. With four creatures in the room that meant
   * twenty conversation options crowded "Attack" off the end entirely — the
   * engine offered it, the player simply could not see it. Ordering is a
   * display concern, so it is fixed here rather than in the engine, and the
   * underlying list is left untouched so the AI seats still see everything.
   *
   * Reads the observation rather than the actor table, so the bar cannot be
   * reordered by an enemy this character has not noticed yet.
   */
  function orderForDisplay(moves, obs) {
    var actors = (obs && obs.actors) || {};
    var fighting = !!(obs && obs.combat && obs.combat.active) ||
      Object.keys(actors).some(function (id) {
        return actors[id].side === 'enemy' && !actors[id].dead;
      });

    var rank = fighting
      ? { combat: 0, spell: 1, item: 2, movement: 3, social: 4, exploration: 5, meta: 6 }
      : { social: 0, exploration: 1, item: 2, spell: 3, movement: 4, combat: 5, meta: 6 };

    /* Cap each family so no one of them can swamp the bar. */
    var perFamily = fighting ? { social: 4, exploration: 4 } : { social: 10, combat: 3 };
    var counts = {};
    var kept = [];
    moves.slice()
      .sort(function (a, b) {
        var ra = rank[a.family] == null ? 9 : rank[a.family];
        var rb = rank[b.family] == null ? 9 : rank[b.family];
        return ra - rb;
      })
      .forEach(function (m) {
        var cap = perFamily[m.family];
        counts[m.family] = (counts[m.family] || 0) + 1;
        if (cap && counts[m.family] > cap) return;
        kept.push(m);
      });
    return kept;
  }

  /* Every action button is built from the engine's legal moves; nothing here is
     hard-coded. Canvas clicks in the battle map are the only other action path,
     and they too go back through legalMoves. */
  /**
   * The action bar: what this character can do, right now.
   *
   * It used to be one flat button per legal move, which is a combinatorial
   * explosion — every verb times every target. A fight with three wolves and a
   * hobgoblin produced twenty-five buttons: "Attack Wolf A", "Attack Wolf B",
   * "Grapple Wolf A", "Off-hand strike Wolf C"… a wall with no hierarchy, in
   * which the one thing a player almost always wants (attack the nearest
   * thing) looked exactly like the thing they almost never want.
   *
   * So it is two steps now: pick the VERB, then pick the TARGET. A verb with
   * one possible target skips the second step entirely, which is the common
   * case out of combat and in a duel. Grouping also means the bar stays the
   * same size whether there is one enemy or six.
   */
  function refreshActionBar() {
    var bar = $('actionbar');
    if (!bar || !session) return;
    bar.innerHTML = '';
    pendingVerb = null;
    var actorId = actingId();
    if (!actorId) return;
    var ctrl = DND.State ? DND.State.controllerFor(session.state, actorId) : { kind: 'human' };
    if (ctrl.kind !== 'human') return;   // do not offer buttons for an AI/DM turn

    var moves = legalMovesFor(actorId);
    if (!moves.length) {
      var note = document.createElement('span');
      note.className = 'hint';
      note.textContent = 'No engine-legal actions right now — try describing what you do.';
      bar.appendChild(note);
      return;
    }

    var groups = groupMoves(orderForDisplay(moves, observationFor(actorId)));
    groups.forEach(function (g, i) {
      bar.appendChild(verbButton(actorId, g, i));
    });
  }

  /* Which verb is waiting for a target, if any. */
  var pendingVerb = null;

  /**
   * Collapse moves that differ only by target into one entry.
   *
   * The label is taken from the verb rather than from any one move, so a group
   * reads "Attack" and not "Attack Wolf A".
   */
  function groupMoves(moves) {
    var byKey = {}, order = [];
    moves.forEach(function (m) {
      var verb = (m.step && m.step.verb) || m.family;
      var key = m.family + ':' + verb;
      if (!byKey[key]) {
        byKey[key] = {
          key: key, verb: verb, family: m.family,
          label: verbLabel(m, verb), cost: m.cost, warn: m.warn,
          moves: [],
        };
        order.push(byKey[key]);
      }
      byKey[key].moves.push(m);
    });
    return order;
  }

  /* "Attack Wolf A" -> "Attack". A move with no target keeps its own words. */
  function verbLabel(move, verb) {
    var what = move.what || verb;
    var targets = (move.step && move.step.targetIds) || [];
    if (!targets.length) return what;
    var name = actorName(targets[0]);
    if (!name) return what;
    var trimmed = what.replace(new RegExp('\\s*' + escapeRe(name) + '\\s*$'), '').trim();
    return trimmed || what;
  }

  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function verbButton(actorId, group, index) {
    var b = document.createElement('button');
    b.className = 'action-btn' + (group.warn ? ' warn' : '') + ' fam-' + esc(group.family);
    b.type = 'button';
    var many = group.moves.length > 1;
    b.innerHTML = esc(group.label) +
      (many ? ' <span class="count">' + group.moves.length + '</span>' : '') +
      (group.cost ? ' <span class="cost">' + esc(group.cost) + '</span>' : '') +
      (group.warn ? ' <span class="warn-mark" aria-hidden="true">\u26a0</span>' : '');
    if (group.warn) b.setAttribute('title', group.warn);
    /* The first nine are reachable from the keyboard, which is how anyone who
       plays more than one session will want to use this. */
    if (index < 9) b.setAttribute('data-key', String(index + 1));
    b.setAttribute('aria-label', group.label +
      (many ? ' — ' + group.moves.length + ' targets' : '') +
      (group.cost ? ', costs a ' + group.cost : ''));

    b.onclick = function () {
      if (!many) { applyMove(actorId, group.moves[0]); return; }
      showTargets(actorId, group, b);
    };
    return b;
  }

  /**
   * The second step: which of them.
   *
   * Rendered inline under the bar rather than as a floating menu, because a
   * menu that can be positioned wrongly is worse than a row that cannot.
   */
  function showTargets(actorId, group, sourceBtn) {
    var bar = $('actionbar');
    var existing = bar.querySelector('.target-row');
    if (existing) existing.parentNode.removeChild(existing);
    if (pendingVerb === group.key) { pendingVerb = null; return; }   // click again to close
    pendingVerb = group.key;

    var row = document.createElement('div');
    row.className = 'target-row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', group.label + ' — choose a target');

    var lead = document.createElement('span');
    lead.className = 'target-lead';
    lead.textContent = group.label + ':';
    row.appendChild(lead);

    group.moves.forEach(function (m, i) {
      var t = document.createElement('button');
      t.className = 'target-btn';
      t.type = 'button';
      var ids = (m.step && m.step.targetIds) || [];
      var name = ids.map(actorName).filter(Boolean).join(' & ') || m.what;
      t.innerHTML = esc(name) + healthTag(ids[0]);
      if (i < 9) t.setAttribute('data-key', String(i + 1));
      t.onclick = function () { applyMove(actorId, m); };
      row.appendChild(t);
    });

    var cancel = document.createElement('button');
    cancel.className = 'target-btn cancel';
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.onclick = function () { pendingVerb = null; refreshActionBar(); };
    row.appendChild(cancel);

    bar.appendChild(row);
    var first = row.querySelector('.target-btn');
    if (first) first.focus();
  }

  /* How badly hurt a target looks, so choosing one is an informed decision
     rather than a guess at a name. Bands, never exact numbers, for anyone who
     is not on your own side. */
  function healthTag(id) {
    if (!id || !session) return '';
    var obs = observationFor(actingId());
    var seen = obs && obs.actors && obs.actors[id];
    if (!seen) return '';
    if (seen.hp != null && seen.hpMax) {
      return ' <span class="tgt-hp">' + seen.hp + '/' + seen.hpMax + '</span>';
    }
    if (seen.health) return ' <span class="tgt-hp">' + esc(seen.health) + '</span>';
    return '';
  }

  /**
   * Playing without the mouse.
   *
   * Holding Alt reveals a number on each action, and Alt+number takes it. The
   * numbers are hidden until asked for because a permanent badge on every
   * button is clutter for the majority who point and click, and invisible
   * shortcuts are no shortcuts at all — the reveal is what teaches them.
   *
   * Escape backs out of a target choice, which is the one place the interface
   * can otherwise trap you mid-decision.
   */
  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Alt') document.body.classList.add('show-keys');

      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');

      if (e.key === 'Escape') {
        var row = document.querySelector('.target-row');
        if (row) { refreshActionBar(); e.preventDefault(); return; }
      }

      if (typing) return;

      if (e.altKey && /^[1-9]$/.test(e.key)) {
        /* A target row, if one is open, owns the numbers — otherwise the
           choice you are in the middle of would be ignored in favour of
           starting a different one. */
        var scope = document.querySelector('.target-row') || $('actionbar');
        if (!scope) return;
        var btn = scope.querySelector('[data-key="' + e.key + '"]');
        if (btn) { btn.click(); e.preventDefault(); }
        return;
      }

      /* Enter from anywhere focuses the composer, which is where a player
         who wants to say something in their own words is heading. */
      if (e.key === 'Enter' && !e.shiftKey) {
        var say = $('say');
        if (say && document.activeElement !== say) { say.focus(); e.preventDefault(); }
      }
    });

    document.addEventListener('keyup', function (e) {
      if (e.key === 'Alt') document.body.classList.remove('show-keys');
    });
    /* Alt-tabbing away leaves the key stuck down otherwise. */
    window.addEventListener('blur', function () { document.body.classList.remove('show-keys'); });
  }

  function legalMovesFor(actorId) {
    if (!DND.Dispatch || !DND.Dispatch.legalMoves) return [];
    try { return DND.Dispatch.legalMoves(session.state, actorId, ctx()) || []; }
    catch (e) { return []; }
  }

  function ctx() { return {}; }

  function applyMove(actorId, move) {
    var command = DND.Dispatch.commandFromMove(session.state, actorId, move, { source: 'human' });
    DND.Game.applyCommand(session, command).then(humanActed);
  }

  /**
   * A person has finished acting; let the table carry on.
   *
   * Without this the initiative sat on whoever just acted for ever: monsters
   * never hit back, rounds never turned over, and every effect measured in
   * rounds lasted the whole game. The engine grew a turn loop; this is the
   * door the browser walks through it.
   *
   * The turn is only passed once they have nothing left to spend, so a bonus
   * action is not stolen from someone who has merely taken their action.
   */
  function humanActed() {
    afterTurn();
    /* A fight nobody opened has no initiative to pass. */
    if (session && DND.Game.ensureEncounter(session)) afterTurn();
    if (!session) return;
    var actorId = session.state.activeActorId;
    if (!actorId) return;
    if (!DND.Game.turnIsSpent(session, actorId, 0)) return;
    DND.Game.endHumanTurn(session, {}).then(function () {
      afterTurn();
      /* The loop stops at a human, at the end of a fight, or when it runs
         out of steps. Only the first of those means it is anyone's move. */
      maybeAutoAdvance();
    });  }

  /* Which actor is a human currently able to act as? The active actor if a
     person controls it, otherwise the seat we are viewing. */
  function actingId() {
    if (!session) return null;
    var cur = DND.Game.currentController(session);
    if (cur && cur.controller && cur.controller.kind === 'human') return cur.actorId;
    return S.viewerId;
  }

  /* ---------------------------------------------------- combat view --- */

  function toggleCombatView() {
    if (!session || !DND.Battle) return;
    var obs = DND.Game.observationFor(session, S.viewerId);
    var inCombat = obs && obs.combat && obs.combat.active;
    if (inCombat) DND.Battle.show();
    else DND.Battle.hide();
  }

  /* ============================================================ AI ===== */

  /**
   * Hand the table back to the machine whenever no person can act.
   *
   * Called after every turn, not only at the start of a session. The loop used
   * to stop the moment `advanceUntilHuman` returned — including when it
   * returned because it had run out of steps, or because the only human at the
   * table was lying at zero hit points. A solo player who went down watched the
   * game freeze around them instead of rolling their death saves while the
   * monsters finished the fight.
   *
   * `S.playing` is the guard: the loop is never started on top of itself.
   */
  function maybeAutoAdvance() {
    if (!session || S.playing) return;
    var cur = DND.Game.currentController(session);
    if (!cur) return;
    if (cur.controller && cur.controller.kind === 'human') {
      /* A human who cannot act does not get to hold the table up. Asked
         through the engine rather than by reading the actor table, which the
         UI is not allowed to touch — the perception layer is the door. */
      if (!DND.Game.turnIsSpent(session, cur.actorId, 0)) return;
    }
    aiRun({});
  }

  function aiStep(opts) {
    if (!session) return;
    var cur = DND.Game.currentController(session);
    if (!cur) return;
    DND.Game.runAiSeat(session, cur.actorId, opts || {}).then(afterTurn);
  }

  function aiStepSeat(actorId, opts) {
    if (!session || !actorId) return;
    DND.Game.runAiSeat(session, actorId, opts || {}).then(afterTurn);
  }

  /* How many times the loop has re-armed itself without a human ever coming
     up. An all-AI table legitimately runs for a long time, so this is not a
     hard cap on play — it is a cap on *consecutive step-limit restarts*, which
     is the shape a runaway takes. Reset whenever the table actually stops for
     someone or the player asks for a turn. */
  var autoRestarts = 0;
  var MAX_AUTO_RESTARTS = 40;

  function aiRun(opts) {
    if (!session) return;
    if (S.playing) return;              // never start the loop on top of itself
    S.playing = true;
    if (DND.Watch) DND.Watch.setStatus('playing…');
    DND.Game.advanceUntilHuman(session, opts || {}).then(function (r) {
      S.playing = false;
      var stopped = r && r.stopped;
      if (DND.Watch) DND.Watch.setStatus(stopped === 'human' ? 'stopped — your turn' : 'stopped');
      afterTurn();

      if (stopped === 'human') { autoRestarts = 0; return; }

      /* Ran out of steps rather than reaching a person: carry on — but not for
         ever. Before this was bounded, a table with no human up (an all-AI
         watch, or any exploration scene) re-armed itself on every step limit
         and pegged the CPU, flooding the log and freezing the page. */
      if (stopped === 'step limit' && !session.__stopRequested) {
        if (autoRestarts++ < MAX_AUTO_RESTARTS) { maybeAutoAdvance(); return; }
        autoRestarts = 0;
        if (DND.Watch) DND.Watch.setStatus('paused — press Play to continue');
        if (DND.Log) DND.Log.system('The table has been running a while. Press Play to continue.');
        return;
      }
      autoRestarts = 0;
    }, function (err) {
      /* A rejected loop must still release the flag, or Play is dead until
         the page is reloaded. */
      S.playing = false;
      autoRestarts = 0;
      if (DND.Watch) DND.Watch.setStatus('stopped');
      if (DND.Log) DND.Log.system('The table stopped: ' + ((err && err.message) || err));
      afterTurn();
    });
  }

  function aiStop() {
    // The loop yields between seats; clearing the flag stops further auto-steps.
    S.playing = false;
    autoRestarts = 0;
    if (session) session.__stopRequested = true;
    if (DND.Watch) DND.Watch.setStatus('stopped');
  }

  function setSeatControl(seatId, cfg) {
    if (!session) return;
    var seat = seatsList().filter(function (s) { return s.id === seatId; })[0];
    if (!seat) return;
    seat.control = cfg.control === 'ai' ? 'playerAI' : 'human';
    seat.agent = cfg.control === 'ai' ? agentFromModel(cfg.model, cfg.persona) : null;
    // keep the controller table in step with the seat.
    if (DND.State && DND.State.setController) {
      DND.State.setController(session.state, seat.actorId, { kind: seat.control, seatId: seat.id, agent: seat.agent });
    }
    renderAll();
  }

  function agentFromModel(model, persona) {
    model = model || '';
    if (model.indexOf('copilot:') === 0) return { backend: 'copilot', model: model.slice(8), persona: persona || '' };
    if (!model) return { backend: 'offline', model: null, persona: persona || '' };
    return { backend: 'ollama', model: model, persona: persona || '' };
  }

  /* ======================================================= App API ==== */

  function seatsList() { return (session && session.state && session.state.seats) || []; }

  function firstHumanSeat() {
    var s = seatsList().filter(function (x) { return x.control === 'human'; })[0];
    return s ? s.actorId : null;
  }
  function firstSeat() { var s = seatsList()[0]; return s ? s.actorId : null; }

  function partyIds() {
    if (session && DND.State && DND.State.partyIds) return DND.State.partyIds(session.state);
    return [];
  }

  function viewerId() { return S.viewerId; }

  function viewerName() { return actorName(S.viewerId) || 'the party'; }

  function setViewer(id) { S.viewerId = id; renderAll(); }

  function actorName(id) {
    if (!id || !session) return '';
    var sv = DND.Game.selfView(session, id);
    if (sv && sv.name) return sv.name;
    var obs = DND.Game.observationFor(session, S.viewerId);
    if (obs && obs.actors && obs.actors[id]) return obs.actors[id].name;
    return id;
  }

  function selfView(id) { return session ? DND.Game.selfView(session, id) : null; }
  function derivedFor(id) { return session ? DND.Game.derivedFor(session, id) : null; }
  function observationFor(id) { return session ? DND.Game.observationFor(session, id) : null; }

  function roleLine(sv) {
    if (!sv) return '';
    var d = derivedFor(sv.id);
    var lvl = d ? d.level : (sv.progression && sv.progression.level) || 1;
    var role = sv.role || (sv.progression && sv.progression.classId) || '';
    return (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Adventurer') + ' · level ' + lvl;
  }

  function controllerLabel(id) {
    if (!session || !DND.State) return { ai: false, text: '' };
    var c = DND.State.controllerFor(session.state, id);
    if (!c || c.kind === 'human') return { ai: false, text: 'Person' };
    if (c.kind === 'playerAI') {
      var m = c.agent && (c.agent.backend === 'copilot' ? 'copilot · ' + c.agent.model : (c.agent.model || 'offline'));
      return { ai: true, text: 'Model · ' + (m || 'offline') };
    }
    return { ai: true, text: 'DM' };
  }

  function isAiSeat(seat) { return seat && seat.control === 'playerAI'; }

  function allegianceOf(id) {
    var obs = observationFor(S.viewerId);
    var a = obs && obs.actors && obs.actors[id];
    var side = a ? a.side : (selfView(id) && selfView(id).side);
    if (side === 'party') return 'party';
    if (side === 'ally') return 'ally';
    if (side === 'enemy') return 'enemy';
    return 'neutral';
  }

  function availableModels() { return S.localModels.slice(); }
  function copilotModels() { return S.copilotModels.slice(); }

  function seats() { return seatsList(); }

  /* ------------------------------------------------- turn affordances - */

  function retryNarration(commandId) {
    if (session) DND.Game.retryNarration(session, commandId, {});
  }

  function undoTurn(commandId) {
    if (!session) return;
    // A specific command rewinds to before it; no argument is a plain undo.
    if (commandId && DND.Game.rewindTo) DND.Game.rewindTo(session, commandId);
    else DND.Game.undo(session);
    afterTurn();
  }

  /* ------------------------------------------------------ inventory --- */

  function itemAction(id, item, action) {
    if (!session || !DND.Command) return;
    var st = session.state;
    var command = DND.Command.create({
      sessionId: st.sessionId, stateRevision: st.revision, turnEpoch: st.turnEpoch,
      actorId: id, source: 'human', family: 'item',
      primary: { verb: action, itemId: item.uid || item.id, target: item.uid || item.id },
      goal: action,
    });
    DND.Game.applyCommand(session, command).then(afterTurn);
  }

  /* ----------------------------------------------------- level-up ---- */

  function canLevelUp(id) {
    if (!session || !DND.LevelUpUI) return false;
    return !!DND.LevelUpUI.available(session, id);
  }

  function levelUp(id) {
    if (!session || !DND.LevelUpUI) return;
    DND.LevelUpUI.open(session, id);
  }

  /* Called by the level-up modal once a level has been committed, so the
     panels reflect the new hit points, features and the vanished affordance. */
  function afterLevelUp(result) {
    afterTurn();
    if (result && result.ok && DND.Log) {
      /* The beats already reached the log through the committed event; this is
         just a friendly confirmation line. */
    }
  }

  /* Level-up needs the raw character layers, which an observation deliberately
     withholds: base and progression define the character rather than describe
     what is perceived of them. This is the one sanctioned way to reach them,
     and only for a seat this client actually controls, so it cannot become a
     general back door into the actor table. */
  function layersFor(actorId) {
    if (!session || !actorId) return null;
    var mine = seatsList().some(function (s) {
      return s.actorId === actorId && s.control === 'human';
    });
    if (!mine) return null;
    var a = session.state.actors[actorId];   /* sanctioned: App.layersFor door */
    if (!a) return null;
    return { base: a.base, progression: a.progression, runtime: a.runtime };
  }

  /* The campaign's death policy, so a quiet badge can keep it in view — a
     player in an ironman game should never be surprised by it. */
  function deathPolicy() {
    return session && DND.Game.deathPolicy ? DND.Game.deathPolicy(session) : null;
  }

  /* --------------------------------------------------------- battle --- */

  /**
   * An attack made by clicking the map.
   *
   * Three things were wrong here and each was invisible:
   *
   *   · The clicked target was ignored. The resolver reads `targetIds`; this
   *     set `target` and `targetId`, neither of which anything consults, so
   *     clicking the wolf on the right attacked whichever enemy happened to be
   *     first in the legal-move list.
   *   · Anybody could act. The map lets you select any ally, so a player could
   *     click a companion and take a turn with them while the initiative sat
   *     on someone else entirely.
   *   · It ended with `afterTurn`, which repaints, rather than `humanActed`,
   *     which passes the turn. Attacking from the map therefore never let the
   *     monsters reply.
   */
  function battleAttack(sel, targetId) {
    if (!session || !sel || !targetId) return;

    if (!isMyTurn(sel)) {
      if (DND.Log) DND.Log.system('It is not ' + (actorName(sel) || 'their') + '\u2019s turn.');
      return;
    }

    var moves = legalMovesFor(sel).filter(function (m) { return m.family === 'combat'; });
    /* Prefer a move that already names this target, so a multiattack or a
       special strike aimed at that creature is used in preference to a
       generic one aimed elsewhere. */
    var m = moves.filter(function (x) {
      var ids = (x.step && x.step.targetIds) || [];
      return ids.indexOf(targetId) >= 0 && x.step.verb === 'attack';
    })[0] || moves.filter(function (x) { return x.step && x.step.verb === 'attack'; })[0] || moves[0];

    if (!m) { if (DND.Log) DND.Log.system('No attack is available from here.'); return; }

    var step = Object.assign({}, m.step, { targetIds: [targetId] });
    var move = Object.assign({}, m, { step: step });
    var command = DND.Dispatch.commandFromMove(session.state, sel, move, { source: 'human' });
    DND.Game.applyCommand(session, command).then(humanActed);
  }

  /**
   * Is it this character's turn, and is this seat a person's to play?
   *
   * Out of combat the spotlight is soft and anyone the player controls may
   * speak; in a fight the initiative decides, and clicking a companion's token
   * must not let you take their turn.
   */
  function isMyTurn(id) {
    if (!session) return false;
    var st = session.state;
    if (st.combat && st.combat.active && st.activeActorId !== id) return false;
    var ctrl = DND.State ? DND.State.controllerFor(st, id) : { kind: 'human' };
    return !ctrl || ctrl.kind === 'human';
  }

  function battleMove(sel, sq) {
    if (!session || !sel || !sq) return;
    /* Same turn check as attacking: the map lets you select any ally, and
       moving someone else's token on their behalf is no more legal than
       swinging their sword. */
    if (!isMyTurn(sel)) {
      if (DND.Log) DND.Log.system('It is not ' + (actorName(sel) || 'their') + '\u2019s turn.');
      return;
    }
    var moves = legalMovesFor(sel).filter(function (m) { return m.family === 'movement'; });
    if (!moves.length) return;
    var m = moves[0];
    var step = Object.assign({}, m.step, { point: sq });
    var move = Object.assign({}, m, { step: step });
    var command = DND.Dispatch.commandFromMove(session.state, sel, move, { source: 'human' });
    /* Moving does not usually end a turn, so this repaints rather than
       passing the initiative on — but it must go through the same door, or a
       move that DID spend the last of the economy would strand the table. */
    DND.Game.applyCommand(session, command).then(humanActed);
  }

  /* ============================================================ chrome = */

  function wireChrome() {
    var form = $('say-form');
    if (form) form.onsubmit = function (e) {
      e.preventDefault();
      var input = $('say');
      var text = input ? input.value.trim() : '';
      if (!text || !session) return;
      var actorId = actingId();
      if (!actorId) { setHint('It is not a human seat\u2019s turn.'); return; }
      if (DND.Log) DND.Log.player(actorName(actorId), text);
      if (input) input.value = '';
      DND.Game.submitText(session, actorId, text, {}).then(humanActed);
    };

    // context tabs
    Array.prototype.forEach.call(document.querySelectorAll('#context-tabs [role="tab"]'), function (tab) {
      tab.onclick = function () { selectTab(tab.getAttribute('data-tab')); };
    });

    bindKeyboard();

    bindClick('btn-undo', function () { if (session) { DND.Game.undo(session); afterTurn(); } });    bindClick('btn-redo', function () { if (session) { DND.Game.redo(session); afterTurn(); } });
    bindClick('btn-save', function () { doSave(); });
    bindClick('btn-export', function () { doExport(); });
    bindClick('btn-new', function () { DND.Setup && DND.Setup.open(onBegin); });
  }

  function bindClick(id, fn) { var el = $(id); if (el) el.onclick = fn; }

  function selectTab(name) {
    S.view = name;
    Array.prototype.forEach.call(document.querySelectorAll('#context-tabs [role="tab"]'), function (tab) {
      var on = tab.getAttribute('data-tab') === name;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    ['sheet', 'inventory', 'journal', 'watch'].forEach(function (n) {
      var pane = $('pane-' + n);
      if (pane) { pane.hidden = n !== name; pane.classList.toggle('on', n === name); }
    });
  }

  function doSave() {
    if (!session || !DND.Save) return;
    try {
      DND.Save.saveLocal(session, { title: session.campaign && session.campaign.title });
      if (DND.Log) DND.Log.system('Saved to this browser.');
    } catch (e) { if (DND.Log) DND.Log.system('Save failed: ' + (e && e.message)); }
  }

  function doExport() {
    if (!session || !DND.Save) return;
    var meta = { title: session.campaign && session.campaign.title };
    var fn = DND.Save.exportToServer || DND.Save.saveLocal;
    try {
      var r = fn(session, meta);
      Promise.resolve(r).then(function () {
        if (DND.Log) DND.Log.system('Session exported.');
      }).catch(function (e) { if (DND.Log) DND.Log.system('Export failed: ' + (e && e.message)); });
    } catch (e) { if (DND.Log) DND.Log.system('Export failed: ' + (e && e.message)); }
  }

  /* ============================================================ export = */

  var api = {
    boot: boot,
    S: S,
    $: $, esc: esc,
    get session() { return session; },
    // identity / viewing
    viewerId: viewerId, viewerName: viewerName, setViewer: setViewer,
    partyIds: partyIds, seats: seats,
    actorName: actorName, roleLine: roleLine,
    // data doors (all through Game, never the raw actor table)
    selfView: selfView, derivedFor: derivedFor, observationFor: observationFor,
    controllerLabel: controllerLabel, isAiSeat: isAiSeat, allegianceOf: allegianceOf,
    // the one sanctioned door to a controlled character's raw layers
    layersFor: layersFor, deathPolicy: deathPolicy,
    // models
    availableModels: availableModels,
    refresh: function () { afterTurn(); }, copilotModels: copilotModels,
    // turn affordances
    retryNarration: retryNarration, undoTurn: undoTurn,
    // inventory / level
    itemAction: itemAction, canLevelUp: canLevelUp, levelUp: levelUp, afterLevelUp: afterLevelUp,
    // battle
    battleAttack: battleAttack, battleMove: battleMove,
    // AI seats
    aiStep: aiStep, aiStepSeat: aiStepSeat, aiRun: aiRun, aiStop: aiStop,
    setSeatControl: setSeatControl,
  };
  // `session` is exposed as a live getter above; define it explicitly for
  // environments where getters on object literals are fine (all modern ones).

  DND.App = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
