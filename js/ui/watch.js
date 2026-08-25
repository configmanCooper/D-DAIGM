/*
 * ui/watch.js — DND.Watch
 *
 * The AI-seats panel. Each seat can be flipped between a person and a model;
 * an AI seat picks a backend, a model and an optional persona. From here you
 * can take a single AI turn, let the table play on until a human is needed, or
 * stop it, and steer the models with a line of free text. Each seat shows the
 * move it actually chose and the reason it gave — the same legal move a human
 * would have clicked, never anything else.
 *
 * The local model is the default in every select the panel builds; a Copilot
 * model is only ever chosen deliberately, never defaulted to.
 */
(function (global) {
  'use strict';

  var AUTOEXPORT_KEY = 'aethertable.autoexport';
  var lastMoves = {};   // actorId -> { move, why }

  function localModels() {
    var App = global.DND && global.DND.App;
    var m = (App && App.availableModels && App.availableModels()) || [];
    if (m.length) return m;
    return ['llama3.2:3b', 'qwen3.5:4b', 'qwen3:1.7b'];
  }

  function copilotModels() {
    var App = global.DND && global.DND.App;
    return (App && App.copilotModels && App.copilotModels()) || [
      'claude-sonnet-5', 'claude-opus-5', 'gpt-5.6-sol', 'gpt-5.4', 'gemini-3.1-pro-preview',
    ];
  }

  /* A model <select> whose FIRST option is always a local model. */
  function modelSelect(seatId, current) {
    var sel = document.createElement('select');
    sel.className = 'model-select';
    sel.setAttribute('data-role', 'seat-model');
    var gLocal = document.createElement('optgroup');
    gLocal.label = 'Local — the default';
    localModels().forEach(function (m) {
      var o = document.createElement('option');
      o.value = m; o.textContent = 'Local · ' + m;
      gLocal.appendChild(o);
    });
    var off = document.createElement('option');
    off.value = ''; off.textContent = 'Offline · templated';
    gLocal.appendChild(off);
    sel.appendChild(gLocal);
    var gCop = document.createElement('optgroup');
    gCop.label = 'Copilot — deliberate choice, uses credits';
    copilotModels().forEach(function (m) {
      var o = document.createElement('option');
      o.value = 'copilot:' + m; o.textContent = 'Copilot · ' + m;
      gCop.appendChild(o);
    });
    sel.appendChild(gCop);
    if (current) sel.value = current;
    return sel;
  }

  function render() {
    var App = global.DND && global.DND.App;
    if (!App) return;
    var host = document.getElementById('pane-watch');
    if (!host) return;
    if (!App.session) { host.innerHTML = '<p class="empty-note">No session.</p>'; return; }
    host.innerHTML = '';

    var intro = document.createElement('p');
    intro.className = 'empty-note';
    intro.textContent = 'Any seat can be a person or a model. A model sees exactly what its seat perceives and picks from the moves the engine says are legal — nothing more.';
    host.appendChild(intro);

    var seats = App.seats();
    seats.forEach(function (seat) { host.appendChild(seatControl(App, seat)); });

    // global run controls
    var runrow = document.createElement('div');
    runrow.className = 'seat-ctl';
    runrow.innerHTML = '<div class="srow"><label for="watch-steer">Steer all models</label></div>';
    var steer = document.createElement('textarea');
    steer.setAttribute('aria-label', 'Steer all models');
    steer.id = 'watch-steer';
    steer.rows = 2;
    steer.placeholder = 'Optional. e.g. "press the attack", "try to talk your way out", "protect the wounded".';
    steer.style.width = '100%';
    runrow.appendChild(steer);
    var btns = document.createElement('div');
    btns.className = 'srow';
    btns.style.marginTop = '.4rem';
    var step = mkBtn('Take one turn', function () { App.aiStep({ steer: steer.value }); });
    var play = mkBtn('Play on', function () { App.aiRun({ steer: steer.value }); });
    var stop = mkBtn('Stop', function () { App.aiStop(); });
    stop.id = 'watch-stop';
    runrow.appendChild(btns);
    btns.appendChild(step); btns.appendChild(play); btns.appendChild(stop);
    var status = document.createElement('span');
    status.id = 'watch-status';
    status.style.cssText = 'font-size:.8rem;color:var(--ink-faint)';
    btns.appendChild(status);
    host.appendChild(runrow);

    // autosave-on-end, persisted
    var autoWrap = document.createElement('label');
    autoWrap.className = 'ctxtoggle';
    autoWrap.style.marginTop = '.5rem';
    var auto = document.createElement('input');
    auto.type = 'checkbox';
    auto.setAttribute('aria-label', 'Export the session automatically when it ends');
    auto.id = 'watch-autoexport';
    try { auto.checked = localStorage.getItem(AUTOEXPORT_KEY) === '1'; } catch (e) { /* private mode */ }
    auto.onchange = function () {
      try { localStorage.setItem(AUTOEXPORT_KEY, auto.checked ? '1' : '0'); } catch (e) { /* ignore */ }
    };
    autoWrap.appendChild(auto);
    autoWrap.appendChild(document.createTextNode(' Export the session automatically when it ends'));
    host.appendChild(autoWrap);

    // live moves
    var moves = document.createElement('div');
    moves.id = 'watch-moves';
    moves.style.marginTop = '.6rem';
    host.appendChild(moves);
    renderMoves();
  }

  function seatControl(App, seat) {
    var box = document.createElement('div');
    box.className = 'seat-ctl';
    var name = App.actorName(seat.actorId) || seat.name || seat.id;
    box.appendChild(row('<strong>' + App.esc(name) + '</strong>'));

    // human / AI
    var ctlRow = document.createElement('div');
    ctlRow.className = 'srow';
    var lbl = document.createElement('label'); lbl.textContent = 'Control';
    var ctlSel = document.createElement('select');
    ['human', 'ai'].forEach(function (k) {
      var o = document.createElement('option'); o.value = k; o.textContent = k === 'human' ? 'Person' : 'Model';
      ctlSel.appendChild(o);
    });
    ctlSel.value = App.isAiSeat(seat) ? 'ai' : 'human';
    ctlRow.appendChild(lbl); ctlRow.appendChild(ctlSel);
    box.appendChild(ctlRow);

    // model + persona (only meaningful when AI)
    var mSel = modelSelect(seat.id, seat.agent && (seat.agent.backend === 'copilot' ? 'copilot:' + seat.agent.model : seat.agent.model));
    var mRow = document.createElement('div');
    mRow.className = 'srow';
    var mLbl = document.createElement('label'); mLbl.textContent = 'Model';
    mRow.appendChild(mLbl); mRow.appendChild(mSel);
    box.appendChild(mRow);

    var pRow = document.createElement('div');
    pRow.className = 'srow';
    var pLbl = document.createElement('label'); pLbl.textContent = 'Persona';
    var persona = document.createElement('input');
      persona.setAttribute('aria-label', 'Persona for this seat');
    persona.type = 'text';
    persona.placeholder = 'Optional. e.g. "cautious tactician", "reckless zealot".';
    persona.value = (seat.agent && seat.agent.persona) || '';
    persona.style.flex = '1 1 8rem';
    pRow.appendChild(pLbl); pRow.appendChild(persona);
    box.appendChild(pRow);

    function applySeat() {
      App.setSeatControl(seat.id, {
        control: ctlSel.value,
        model: mSel.value,
        persona: persona.value,
      });
    }
    ctlSel.onchange = applySeat;
    mSel.onchange = applySeat;
    persona.onchange = applySeat;

    var takeRow = document.createElement('div');
    takeRow.className = 'srow';
    takeRow.appendChild(mkBtn('Take this seat\u2019s turn', function () { App.aiStepSeat(seat.actorId); }));
    box.appendChild(takeRow);
    return box;
  }

  function showMove(actorId, turn) {
    var move = '';
    var why = '';
    if (turn) {
      if (turn.command) move = (global.DND.Command && global.DND.Command.describe(turn.command)) || (turn.command.family + '/' + (turn.command.primary && turn.command.primary.verb));
      why = turn.reasoning || turn.why || turn.rationale || (turn.say ? ('says: ' + turn.say) : '');
    }
    lastMoves[actorId] = { move: move, why: why };
    renderMoves();
  }

  function renderMoves() {
    var App = global.DND && global.DND.App;
    var host = document.getElementById('watch-moves');
    if (!host || !App) return;
    var ids = Object.keys(lastMoves);
    if (!ids.length) { host.innerHTML = ''; return; }
    host.innerHTML = '<h3 style="font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)">Latest moves</h3>' +
      ids.map(function (id) {
        var m = lastMoves[id];
        return '<div class="watch-move"><b>' + App.esc(App.actorName(id) || id) + '</b>: ' + App.esc(m.move || '—') +
          (m.why ? '<div class="why">' + App.esc(m.why) + '</div>' : '') + '</div>';
      }).join('');
  }

  function setStatus(text) {
    var s = document.getElementById('watch-status');
    if (s) s.textContent = text || '';
  }

  function mkBtn(label, fn) {
    var b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.textContent = label; b.onclick = fn;
    return b;
  }
  function row(html) { var d = document.createElement('div'); d.className = 'srow'; d.innerHTML = html; return d; }

  var api = { render: render, showMove: showMove, setStatus: setStatus, AUTOEXPORT_KEY: AUTOEXPORT_KEY };
  global.DND = global.DND || {};
  global.DND.Watch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
