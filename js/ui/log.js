/*
 * ui/log.js — DND.Log
 *
 * The narrative column. It renders four visually distinct kinds of line —
 * DM narration, spoken lines (with the speaker's token), the player's own
 * input, and system notes — and under every committed turn it hangs a
 * collapsible "what actually happened" block built from batch.beats and the
 * raw roll events. Every die the engine rolled is inspectable there, because
 * an unexplained roll is what makes a player stop trusting an AI DM.
 *
 * Narration streams token by token into a live paragraph; the mechanics are
 * already on screen before the first word of prose arrives.
 */
(function (global) {
  'use strict';

  var active = null;   // the turn entry currently receiving narration tokens

  function logEl() { return document.getElementById('log'); }

  /**
   * Follow the text, but only if the reader is already at the bottom.
   *
   * The log used to be yanked to the bottom on every token the Dungeon Master
   * produced. Scroll up to re-read what happened two turns ago and the next
   * token snatched the page away again — you could not read the story while
   * the story was being written, which is most of the time.
   *
   * So it follows when you are at the bottom (the ordinary case: you are
   * watching it arrive) and leaves you alone the moment you scroll away. The
   * threshold is generous because a half-line of overshoot should still count
   * as "at the bottom".
   */
  var STICK_PX = 64;

  function atBottom(l) {
    if (!l) return true;
    return (l.scrollHeight - l.scrollTop - l.clientHeight) <= STICK_PX;
  }

  /**
   * Do something that adds text, then follow it only if the reader was at the
   * bottom BEFORE it was added.
   *
   * Sampling afterwards is the obvious mistake and it is wrong every time:
   * appending grows `scrollHeight`, so a reader who was pinned to the bottom
   * is suddenly "away from the bottom" by exactly the height of what just
   * arrived, and the log never follows anything.
   */
  function follow(fn, opts) {
    var l = logEl();
    var was = !l || atBottom(l);
    var out = fn();
    if (!l) return out;
    if ((opts && opts.force) || was) {
      l.scrollTop = l.scrollHeight;
      markUnread(l, false);
    } else {
      markUnread(l, true);
    }
    return out;
  }

  function scroll(opts) {
    var l = logEl();
    if (!l) return;
    if ((opts && opts.force) || atBottom(l)) {
      l.scrollTop = l.scrollHeight;
      markUnread(l, false);
    } else {
      markUnread(l, true);
    }
  }

  /* A quiet marker when there is new text below the fold, so nobody wonders
     whether the Dungeon Master has stopped writing. */
  function markUnread(l, on) {
    var host = l.parentNode;
    if (!host) return;
    var pip = document.getElementById('log-more');
    if (!on) { if (pip) pip.hidden = true; return; }
    if (!pip) {
      pip = document.createElement('button');
      pip.id = 'log-more';
      pip.type = 'button';
      pip.className = 'log-more';
      pip.textContent = 'New text below \u2193';
      pip.onclick = function () { scroll({ force: true }); };
      host.appendChild(pip);
    }
    pip.hidden = false;
  }

  function reset() {
    active = null;
    var l = logEl();
    if (l) l.innerHTML = '';
  }

  function esc(s) {
    var App = global.DND && global.DND.App;
    return App ? App.esc(s) : String(s == null ? '' : s);
  }

  function append(el, opts) {
    var l = logEl();
    if (!l) return el;
    return follow(function () { l.appendChild(el); return el; }, opts);
  }

  function system(text) {
    var e = document.createElement('div');
    e.className = 'entry system';
    e.innerHTML = '<div class="body">' + esc(text) + '</div>';
    return append(e);
  }

  function player(name, text) {
    var e = document.createElement('div');
    e.className = 'entry player';
    e.innerHTML = '<div class="speaker">' + esc(name) + '</div><div class="body">' + esc(text) + '</div>';
    /* Your own turn is worth jumping to, wherever you had scrolled to. */
    return append(e, { force: true });
  }

  /* ------------------------------------------------------------- out of
     character. A question to the Dungeon Master and their reply, set apart
     from the story so nobody mistakes either for something that happened. */
  function ooc(name, text) {
    var e = document.createElement('div');
    e.className = 'entry ooc ooc-ask';
    e.innerHTML = '<div class="speaker">' + esc(name) + ' \u2014 out of character</div>' +
      '<div class="body">' + esc(text) + '</div>';
    return append(e, { force: true });
  }

  function oocAnswer(text) {
    var e = document.createElement('div');
    e.className = 'entry ooc ooc-reply';
    e.innerHTML = '<div class="speaker">The Dungeon Master</div>' +
      '<div class="body">' + esc(text) + '</div>';
    return append(e, { force: true });
  }

  function speech(actorId, name, text) {    var e = document.createElement('div');
    e.className = 'entry speech';
    var App = global.DND && global.DND.App;
    var c = document.createElement('canvas');
    c.width = 40; c.height = 40;
    var Tokens = global.DND && global.DND.Tokens;
    if (Tokens && App) {
      try {
        var gm = Tokens.genomeForToken('speak:' + actorId, { kind: 'portrait', allegiance: App.allegianceOf(actorId) });
        Tokens.drawToken(c.getContext('2d'), gm, 40, { allegiance: App.allegianceOf(actorId) });
      } catch (err) { /* ignore art failure */ }
    }
    var wrap = document.createElement('div');
    wrap.innerHTML = '<div class="speaker who">' + esc(name || actorId) + '</div><div class="body">' + esc(text) + '</div>';
    e.appendChild(c);
    e.appendChild(wrap);
    return append(e);
  }

  /* A committed turn: mechanics first, then an (initially empty) narration
     paragraph that the streaming tokens will fill. */
  function committed(payload) {
    var App = global.DND && global.DND.App;
    var command = payload.command || {};
    var beats = payload.beats || [];
    var batch = payload.batch || {};
    var commandId = command.commandId;

    var e = document.createElement('div');
    e.className = 'entry narration streaming';
    e.setAttribute('data-command', commandId || '');

    var speakerName = App ? App.actorName(command.actorId) : (command.actorId || 'The DM');
    var narr = document.createElement('div');
    narr.className = 'body';
    e.innerHTML = '<div class="speaker">' + esc(speakerName ? speakerName + '\u2019s turn' : 'The DM') + '</div>';
    e.appendChild(narr);
    e._narr = narr;

    // mechanics: every beat and every die
    var det = document.createElement('details');
    det.className = 'beats';
    var sum = document.createElement('summary');
    /* Terse, because this label sits under EVERY turn. "What actually
       happened (3 steps)" is a sentence where a word will do; three of them
       stacked made the log read as more chrome than story. */
    sum.textContent = beats.length + ' roll' + (beats.length === 1 ? '' : 's');
    det.appendChild(sum);

    beats.forEach(function (b) {
      var d = document.createElement('div');
      d.className = 'beat';
      d.textContent = b;
      det.appendChild(d);
    });

    (batch.events || []).filter(function (ev) { return ev.kind === 'roll'; }).forEach(function (ev) {
      det.appendChild(rollBlock(ev));
    });

    /* Per-turn tools live beside the roll count rather than on their own row.
       They matter, but they are a rare click and were taking a third of the
       column: two full-width buttons under every single line of prose. They
       are icon-sized now, and only reveal their words on hover or focus. */
    var tools = document.createElement('div');
    tools.className = 'turn-tools';
    tools.appendChild(det);

    var retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'turn-tool';
    retry.innerHTML = '\u21bb<span class="tt-label">Retry the words</span>';
    retry.title = 'Rewrite the prose \u2014 the dice do not move';
    retry.setAttribute('aria-label', 'Retry narration');
    retry.onclick = function () { if (App) App.retryNarration(commandId); };

    var undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'turn-tool';
    undo.innerHTML = '\u21b6<span class="tt-label">Undo this turn</span>';
    undo.title = 'Take this turn back';
    undo.setAttribute('aria-label', 'Undo this turn');
    undo.onclick = function () { if (App) App.undoTurn(commandId); };

    tools.appendChild(retry);
    tools.appendChild(undo);
    e.appendChild(tools);

    if (batch.refused) e.className = 'entry narration refused';

    active = e;
    return append(e);
  }

  function rollBlock(ev) {
    var App = global.DND && global.DND.App;
    var r = ev.result || {};
    var d = document.createElement('div');
    d.className = 'roll';
    var of = ev.of || 'roll';
    var total = (r.total != null) ? r.total : (typeof r === 'number' ? r : '');
    var natClass = r.isNat20 ? 'nat20' : (r.isNat1 ? 'nat1' : '');
    var breakdown = '';
    if (r.rolls) breakdown = ' (d20: ' + r.rolls.join(', ') + (r.mod ? (r.mod >= 0 ? ' +' : ' ') + r.mod : '') + ')';
    else if (r.terms) breakdown = ' ' + summariseTerms(r);
    d.innerHTML = '<span class="of">' + esc(of) + '</span>: <span class="total ' + natClass + '">' + esc(String(total)) + '</span>' + esc(breakdown);

    // the full record, so no die is ever hidden
    var det = document.createElement('details');
    var sm = document.createElement('summary');
    sm.style.cursor = 'pointer';
    sm.style.fontSize = '0.72rem';
    sm.style.color = 'var(--ink-faint)';
    sm.textContent = 'exact roll';
    var pre = document.createElement('pre');
    try { pre.textContent = JSON.stringify(ev.result, null, 1); } catch (e) { pre.textContent = String(ev.result); }
    det.appendChild(sm);
    det.appendChild(pre);
    d.appendChild(det);
    return d;
  }

  function summariseTerms(r) {
    try {
      return '(' + (r.notation || '') + ' = ' + (r.rolls || (r.terms || []).map(function (t) { return t.rolls; }).join('+')) + ')';
    } catch (e) { return ''; }
  }

  function narrationToken(payload) {
    if (!active || !active._narr) return;
    /* A polite live region plus token-by-token replacement means a screen
       reader re-reads the growing paragraph on every token — a stream of
       half-sentences for the whole of a narration. Mark it busy while it is
       being written and announce the finished text once, below. */
    var log = document.getElementById('log');
    if (log && log.getAttribute('aria-busy') !== 'true') log.setAttribute('aria-busy', 'true');
    follow(function () {
      active._narr.textContent = payload.soFar != null
        ? payload.soFar
        : (active._narr.textContent + (payload.piece || ''));
    });
  }

  function narration(payload) {
    var log = document.getElementById('log');
    if (log) log.removeAttribute('aria-busy');   // the stream has finished; announce it
    if (!active || !active._narr) {
      // narration with no committed turn (rare) — show it as a plain DM line
      var e = document.createElement('div');
      e.className = 'entry narration';
      e.innerHTML = '<div class="body">' + esc(payload.text) + '</div>';
      return append(e);
    }
    active._narr.textContent = payload.text || active._narr.textContent;
    active.classList.remove('streaming');
    /* Mechanical resolution and authored prose are not the same thing and
       should not look the same. When no model wrote the line, what is on the
       page is the engine's own summary — "Bandit A swings. The blow misses." —
       and giving that the parchment-serif treatment reserved for the DM's
       voice meant nothing on screen said "this is the story". */
    if (payload.source === 'offline' || payload.source === 'system') {
      active.classList.add('mechanical');
    } else {
      active.classList.remove('mechanical');
    }
    if (payload.source && payload.source !== 'ollama' && payload.source !== 'copilot') {
      active.setAttribute('data-source', payload.source);
    }
    scroll();
  }

  function narrationDropped() {
    var log = document.getElementById('log');
    if (log) log.removeAttribute('aria-busy');
    if (active) active.classList.remove('streaming');
  }

  var api = {
    reset: reset,
    system: system,
    player: player,
    ooc: ooc,
    oocAnswer: oocAnswer,
    speech: speech,
    committed: committed,
    narrationToken: narrationToken,
    narration: narration,
    narrationDropped: narrationDropped,
  };
  global.DND = global.DND || {};
  global.DND.Log = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
