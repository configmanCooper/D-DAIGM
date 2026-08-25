/**
 * mortality.js (UI) — what the table does when someone dies.
 *
 * The engine has always known the whole answer: which resurrection spells are
 * still in their window, what they cost in diamonds, whether the campaign's
 * death policy permits any of it, and how to build a replacement character at
 * the party's level. None of it was reachable. A player whose character died
 * under the standard policy was left looking at a seat with no legal actions
 * and no way forward — the game simply stopped for them.
 *
 * This is the conversation that should happen at a real table: here is what
 * you can still try, here is what it costs, and here is what happens if you
 * let them go.
 */
(function (global) {
  'use strict';

  var DND = global.DND = global.DND || {};

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var open = false;

  /**
   * Has anyone died with no resolution yet?
   *
   * The engine raises `seatNeedsCharacter.<id>` when a death leaves a seat
   * without a character. That flag is the whole trigger.
   */
  function pending(session) {
    if (!session) return null;
    var flags = session.state.flags || {};
    var ids = Object.keys(flags).filter(function (k) {
      return k.indexOf('seatNeedsCharacter.') === 0 && flags[k];
    }).map(function (k) { return k.slice('seatNeedsCharacter.'.length); });
    if (!ids.length) return null;

    var actorId = ids[0];
    /* Through the app's own doors, not the raw actor table — the UI is not
       permitted to read that, and a dead character's name is exactly the sort
       of thing the perception layer exists to hand out. */
    if (!DND.State.hasActor(session.state, actorId)) return null;
    var view = DND.App && DND.App.selfView ? DND.App.selfView(actorId) : null;
    var name = (view && view.name) || actorId;
    var seat = (session.state.seats || []).filter(function (s) { return s.actorId === actorId; })[0];
    return { actorId: actorId, name: name, seatId: seat && seat.id };
  }

  /** Show the conversation if one is owed. Safe to call after every turn. */
  function check(session, onDone) {
    if (open) return false;
    var p = pending(session);
    if (!p) return false;
    show(session, p, onDone);
    return true;
  }

  function show(session, p, onDone) {
    var Mortality = DND.Mortality;
    var host = $('modal-death');
    if (!host || !Mortality) return;
    open = true;

    var name = p.name || p.actorId;
    var policy = Mortality.policy(session.state);
    var options = [];
    try { options = Mortality.raiseOptionsFor(session.state, p.actorId) || []; }
    catch (e) { options = []; }

    var gold = partyGold(session.state);

    var h = [];
    h.push('<h2>' + esc(name) + ' is dead.</h2>');
    h.push('<p class="death-policy">' + esc(policy.blurb || '') + '</p>');

    if (options.length) {
      h.push('<h3>What can still be done</h3>');
      h.push('<div class="raise-list">');
      options.forEach(function (o) {
        var afford = !o.costGp || gold >= o.costGp;
        h.push('<button type="button" class="raise-opt" data-spell="' + esc(o.id) + '"' +
          (afford ? '' : ' disabled') + '>' +
          '<span class="ro-name">' + esc(o.name) + '</span>' +
          (o.costGp ? '<span class="ro-cost">' + o.costGp + ' gp in diamonds</span>' : '') +
          (o.window ? '<span class="ro-window">' + esc(o.window) + '</span>' : '') +
          (afford ? '' : '<span class="ro-cant">the party has ' + gold + ' gp</span>') +
          '</button>');
      });
      h.push('</div>');
    } else if (policy.allowRaise) {
      h.push('<p class="hint">No resurrection is still within its window.</p>');
    }

    h.push('<h3>Or carry on</h3>');
    h.push('<div class="death-actions">');
    if (policy.allowReplacement !== false && p.seatId) {
      h.push('<button type="button" id="death-replace">Someone new joins the party</button>');
    }
    h.push('<button type="button" id="death-accept" class="ghost">Let them go</button>');
    h.push('</div>');

    host.innerHTML = '<div class="modal-card death-card">' + h.join('') + '</div>';
    host.hidden = false;

    var close = function () { open = false; host.hidden = true; if (onDone) onDone(); };

    Array.prototype.forEach.call(host.querySelectorAll('.raise-opt'), function (btn) {
      btn.onclick = function () {
        var res = Mortality.raise(session.state, p.actorId, btn.getAttribute('data-spell'),
          { rng: session.state.rng });
        if (!res || !res.ok) {
          if (DND.Log) DND.Log.system('That did not work: ' + ((res && res.error) || 'unknown reason'));
          return;
        }
        commit(session, res.events, name + ' is brought back.');
        close();
      };
    });

    var rep = $('death-replace');
    if (rep) {
      rep.onclick = function () {
        /* `makeReplacement` builds the character and stops there — it returns
           layers and a reason for their arrival, and deliberately commits
           nothing, because who joins a party is a decision and not a
           consequence. Seating them is this screen's job. */
        var made;
        try { made = Mortality.makeReplacement(session.state, p.seatId, { rng: session.state.rng }); }
        catch (e) { made = null; }
        if (!made || !made.layers) {
          if (DND.Log) DND.Log.system('No replacement could be found.');
          return;
        }

        var newId = 'pc_' + session.state.revision + '_' + Math.floor(Math.random() * 1e4);
        DND.State.addActor(session.state, {
          id: newId, name: made.layers.base.name, side: 'party', kind: 'pc',
          base: made.layers.base, progression: made.layers.progression,
          runtime: made.layers.runtime,
        });
        DND.State.refreshDerived(session.state, newId);

        /* Move the seat onto the new character, so the person who was playing
           has someone to play again. */
        var seat = (session.state.seats || []).filter(function (s) { return s.id === p.seatId; })[0];
        if (seat) seat.actorId = newId;
        DND.State.setController(session.state, newId, { kind: 'human', seatId: p.seatId, agent: null });

        /* The spotlight was on the character who died. Leaving it there gives
           the new arrival a seat at a table where it is permanently someone
           else's turn — they had no legal actions at all. */
        if (session.state.activeActorId === p.actorId) {
          session.state.activeActorId = newId;
        }
        /* And if a fight is under way, they take the dead character's place in
           the order rather than waiting for the next one. */
        var order = session.state.combat && session.state.combat.order;
        if (order) {
          order.forEach(function (o) { if (o.id === p.actorId) o.id = newId; });
        }

        commit(session, [
          { kind: 'flag', flag: 'seatNeedsCharacter.' + p.actorId, value: false },
          { kind: 'note', text: 'replacement', actorId: newId },
        ], made.layers.base.name + ' falls in with the party. ' + (made.meeting || ''));
        close();
      };
    }

    var acc = $('death-accept');
    if (acc) {
      acc.onclick = function () {
        /* Clearing the flag is what says "we have dealt with this"; without
           it the conversation would reopen after every single turn. */
        commit(session, [{
          kind: 'flag', flag: 'seatNeedsCharacter.' + p.actorId, value: false,
        }], 'The party goes on without ' + name + '.');
        close();
      };
    }
  }

  function commit(session, events, note) {
    if (!events || !events.length) return;
    var batch = DND.Events.makeBatch({
      commandId: 'death:' + session.state.revision, actorId: null,
    });
    events.forEach(function (e) { batch.events.push(e); });
    if (note) batch.beats.push(note);
    var res = DND.Events.commit(session.state, batch);
    if (res.ok && DND.Log && note) DND.Log.system(note);
    if (DND.App && DND.App.refresh) DND.App.refresh();
  }

  /* What the party can actually spend on diamonds. Read through the app's own
     door rather than the actor table, which the UI may not touch. */
  function partyGold(state) {
    if (!DND.App || !DND.App.selfView) return 0;
    return DND.State.partyIds(state).reduce(function (n, id) {
      var view = DND.App.selfView(id);
      return n + ((view && view.gold) || 0);
    }, 0);
  }

  DND.Mortal = { check: check, pending: pending };
})(typeof window !== 'undefined' ? window : globalThis);
