/*
 * ui/levelup.js — DND.LevelUpUI
 *
 * The guided level-up. Everything shown here is built from the engine's
 * `LevelUp.optionsFor().groups`, never from a hard-coded per-class list: a
 * choice group is a radio list, an ability score improvement is a +2/+1
 * chooser that respects the 20 cap, and a "learn N spells" group is a
 * pick-exactly-N list. The confirm button follows `LevelUp.validate()` live,
 * so it is only ever enabled on a legal, complete set of choices.
 *
 * Nothing is applied until Confirm. The commit goes through Game.applyLevelUp,
 * which checkpoints and emits like any other turn — so the level is undoable
 * with the ordinary Undo button, and the beats land in the log.
 */
(function (global) {
  'use strict';

  var DND = global.DND = global.DND || {};

  var M = null;   // the modal element, created once and reused
  var ctx = null; // { session, actorId, options, choices }

  function esc(s) { var App = DND.App; return App ? App.esc(s) : String(s == null ? '' : s); }
  function LU() { return DND.LevelUp; }

  /* The raw character layers, only ever through the App door. Level-up edits
     the character definition, so it is right that this refuses any seat the
     local client does not control. */
  function layers(actorId) {
    return DND.App && DND.App.layersFor ? DND.App.layersFor(actorId) : null;
  }

  function ensureModal() {
    if (M) return M;
    M = document.createElement('div');
    M.className = 'modal hidden';
    M.id = 'modal-levelup';
    M.setAttribute('role', 'dialog');
    M.setAttribute('aria-modal', 'true');
    M.setAttribute('aria-labelledby', 'levelup-title');
    M.innerHTML =
      '<div class="box levelup-box">' +
        '<h1 id="levelup-title">Level up</h1>' +
        '<p class="sub" id="levelup-sub"></p>' +
        '<div id="levelup-gains" class="levelup-gains"></div>' +
        '<div id="levelup-groups"></div>' +
        '<div id="levelup-errors" class="validation" role="status" aria-live="polite"></div>' +
        '<div class="setup-foot levelup-foot">' +
          '<button class="chip" type="button" id="levelup-auto" title="Fill the form the way this class would">Choose for me</button>' +
          '<span class="spacer" style="flex:1 1 auto"></span>' +
          '<button class="chip" type="button" id="levelup-cancel">Cancel</button>' +
          '<button class="wide levelup-confirm" type="button" id="levelup-confirm">Confirm</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(M);
    M.querySelector('#levelup-cancel').onclick = close;
    M.querySelector('#levelup-confirm').onclick = confirm;
    M.querySelector('#levelup-auto').onclick = chooseForMe;
    return M;
  }

  /** Is a level owed for this actor? Returns the engine's pending descriptor. */
  function available(session, actorId) {
    var G = DND.Game;
    if (!session || !G || !G.pendingLevel) return null;
    return G.pendingLevel(session, actorId);
  }

  function open(session, actorId) {
    var G = DND.Game;
    if (!G || !G.levelUpFor) return;
    var lu = G.levelUpFor(session, actorId, {});
    if (!lu) return;
    ctx = { session: session, actorId: actorId, options: lu.options, choices: {} };
    /* Seed the form with the class's own recommendations, so opening it already
       shows a legal, sensible plan the player can accept or overrule. The raw
       base/progression layers come through the sanctioned App.layersFor door,
       which refuses any seat this client does not control. */
    var ly = layers(actorId);
    if (!ly) return;
    ctx.choices = LU().autoChoose(ly.base, ly.progression, lu.options, {});
    ensureModal();
    render();
    M.classList.remove('hidden');
  }

  function close() { if (M) M.classList.add('hidden'); ctx = null; }

  function render() {
    if (!ctx) return;
    var o = ctx.options;
    var sv = DND.Game.selfView(ctx.session, ctx.actorId);
    M.querySelector('#levelup-sub').textContent =
      (sv && sv.name ? sv.name + ' ' : '') + 'reaches level ' + o.toLevel + '. ' + (o.summary || '');

    var gains = M.querySelector('#levelup-gains');
    if (o.gains && o.gains.length) {
      gains.innerHTML = '<div class="gains-head">This level grants</div>' + o.gains.map(function (g) {
        return '<div class="gain"><b>' + esc(g.name) + '</b>' + (g.text ? ' <span class="gain-text">' + esc(g.text) + '</span>' : '') + '</div>';
      }).join('');
    } else { gains.innerHTML = ''; }

    var host = M.querySelector('#levelup-groups');
    host.innerHTML = '';
    o.groups.forEach(function (g) { host.appendChild(renderGroup(g)); });
    validateLive();
  }

  function renderGroup(g) {
    var box = document.createElement('div');
    box.className = 'levelup-group';
    var head = '<div class="lg-prompt">' + esc(g.prompt) + '</div>';
    if (g.note) head += '<div class="lg-note">' + esc(g.note) + '</div>';
    box.innerHTML = head;
    if (g.kind === 'asi') box.appendChild(renderAsi(g));
    else if (g.kind === 'multi') box.appendChild(renderMulti(g));
    else box.appendChild(renderChoice(g));
    return box;
  }

  /* kind:'choice' — a radio list, the recommended option marked. */
  function renderChoice(g) {
    var wrap = document.createElement('div');
    wrap.className = 'lg-choices';
    (g.choices || []).forEach(function (c) {
      var id = 'lg-' + g.id + '-' + c.id;
      var label = document.createElement('label');
      label.className = 'lg-opt';
      var rec = (g.recommended === c.id);
      label.innerHTML =
        '<input type="radio" name="lg-' + g.id + '" value="' + esc(c.id) + '"' + (ctx.choices[g.id] === c.id ? ' checked' : '') + '>' +
        '<span class="lg-optlabel">' + esc(c.label) + (rec ? ' <span class="tag suggested">recommended</span>' : '') + '</span>' +
        (c.note ? '<span class="lg-optnote">' + esc(c.note) + '</span>' : '');
      label.querySelector('input').onchange = function () { ctx.choices[g.id] = c.id; validateLive(); };
      wrap.appendChild(label);
    });
    return wrap;
  }

  /* kind:'asi' — +2 to one ability, or +1 to two. Scores at 20 are disabled,
     and the class's recommendation (and why) is surfaced. */
  function renderAsi(g) {
    var wrap = document.createElement('div');
    wrap.className = 'lg-asi';
    var cur = ctx.choices.asi || { mode: 'plus2', abilities: [] };
    if (!ctx.choices.asi) ctx.choices.asi = cur;

    var modeRow = document.createElement('div');
    modeRow.className = 'lg-asi-mode';
    modeRow.innerHTML =
      '<label class="ctxtoggle"><input type="radio" name="asi-mode" value="plus2"' + (cur.mode === 'plus2' ? ' checked' : '') + '> +2 to one ability</label>' +
      '<label class="ctxtoggle"><input type="radio" name="asi-mode" value="plus1"' + (cur.mode === 'plus1' ? ' checked' : '') + '> +1 to two abilities</label>';
    wrap.appendChild(modeRow);

    var grid = document.createElement('div');
    grid.className = 'lg-asi-grid';
    wrap.appendChild(grid);

    function paintGrid() {
      var mode = ctx.choices.asi.mode;
      grid.innerHTML = (g.choices || []).map(function (c) {
        var picked = ctx.choices.asi.abilities.indexOf(c.id) >= 0;
        var kind = mode === 'plus2' ? 'radio' : 'checkbox';
        return '<label class="lg-abil' + (c.atCap ? ' capped' : '') + '">' +
          '<input type="' + kind + '" name="asi-ab" value="' + esc(c.id) + '"' +
          (picked ? ' checked' : '') + (c.atCap ? ' disabled' : '') + '>' +
          '<span class="ab-k">' + c.id.toUpperCase() + '</span>' +
          '<span class="ab-v">' + c.value + (c.atCap ? ' <span class="tag">max</span>' : '') + '</span></label>';
      }).join('');
      grid.querySelectorAll('input[name="asi-ab"]').forEach(function (input) {
        input.onchange = function () { onAsiPick(g, input.value); paintGrid(); validateLive(); };
      });
    }

    modeRow.querySelectorAll('input[name="asi-mode"]').forEach(function (input) {
      input.onchange = function () {
        ctx.choices.asi = { mode: input.value, abilities: [] };
        paintGrid(); validateLive();
      };
    });
    paintGrid();

    if (g.recommended && g.recommended.why) {
      var why = document.createElement('div');
      why.className = 'lg-note';
      why.textContent = 'Recommended: ' + (g.recommended.abilities || []).map(function (x) { return x.toUpperCase(); }).join(', ') +
        ' — ' + g.recommended.why;
      wrap.appendChild(why);
    }
    return wrap;
  }

  function onAsiPick(g, ability) {
    var asi = ctx.choices.asi;
    if (asi.mode === 'plus2') { asi.abilities = [ability]; return; }
    var i = asi.abilities.indexOf(ability);
    if (i >= 0) asi.abilities.splice(i, 1);
    else {
      /* Two at most; the third pick pushes the oldest out so the checkbox
         behaves the way a player expects rather than silently refusing. */
      asi.abilities.push(ability);
      while (asi.abilities.length > 2) asi.abilities.shift();
    }
  }

  /* kind:'multi' — pick exactly `count`. */
  function renderMulti(g) {
    var wrap = document.createElement('div');
    wrap.className = 'lg-multi';
    var chosen = ctx.choices[g.id] || (ctx.choices[g.id] = []);
    wrap.innerHTML = '<div class="lg-note">Pick exactly ' + g.count + '.</div>' + (g.choices || []).map(function (c) {
      var on = chosen.indexOf(c.id) >= 0;
      return '<label class="ctxtoggle"><input type="checkbox" value="' + esc(c.id) + '"' + (on ? ' checked' : '') + '> ' +
        esc(c.label) + (c.note ? ' <span class="tag">' + esc(c.note) + '</span>' : '') + '</label>';
    }).join('');
    wrap.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
      input.onchange = function () {
        var list = ctx.choices[g.id];
        var i = list.indexOf(input.value);
        if (input.checked) { if (i < 0) list.push(input.value); }
        else if (i >= 0) list.splice(i, 1);
        validateLive();
      };
    });
    return wrap;
  }

  function validateLive() {
    var errBox = M.querySelector('#levelup-errors');
    var confirmBtn = M.querySelector('#levelup-confirm');
    var errors = LU().validate(ctx.options, ctx.choices);
    if (errors.length) {
      errBox.className = 'validation';
      errBox.textContent = 'Still to decide: ' + errors[0] + (errors.length > 1 ? ' (+' + (errors.length - 1) + ' more)' : '');
      confirmBtn.disabled = true;
    } else {
      errBox.className = 'validation ok';
      errBox.textContent = 'Ready.';
      confirmBtn.disabled = false;
    }
  }

  /* "Choose for me": fill the form with the class's own picks and let the
     player review them before confirming, rather than committing behind their
     back. The confirm path is identical either way. */
  function chooseForMe() {
    if (!ctx) return;
    var ly = layers(ctx.actorId);
    if (!ly) return;
    ctx.choices = LU().autoChoose(ly.base, ly.progression, ctx.options, {});
    render();
  }

  function confirm() {
    if (!ctx) return;
    var G = DND.Game;
    var errors = LU().validate(ctx.options, ctx.choices);
    if (errors.length) { validateLive(); return; }
    var r = G.applyLevelUp(ctx.session, ctx.actorId, ctx.options, ctx.choices, {});
    close();
    if (DND.App && DND.App.afterLevelUp) DND.App.afterLevelUp(r);
  }

  var api = { available: available, open: open, close: close };
  DND.LevelUpUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
