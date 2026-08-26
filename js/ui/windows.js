/*
 * windows.js — floating panels: draggable, resizable, minimisable, closable.
 *
 * The old layout was three fixed columns. The narration — the thing the whole
 * game exists to produce — was squeezed into a strip a few lines tall between
 * the battle map and the action bar, while the character sheet held a third of
 * the screen whether or not anyone was reading it. A player watching the
 * Dungeon Master write got four visible lines and a scrollbar.
 *
 * So the story gets the room now, and everything else is a panel you open when
 * you want it and close when you do not. Each panel is a real window: pick it
 * up by the title bar, drag it anywhere, take a corner and resize it, roll it
 * up to its title bar, or close it altogether. Where you put it is remembered.
 *
 * The panels themselves are the SAME elements as before — this moves them into
 * window frames rather than re-implementing them — so every renderer that
 * writes to `#pane-sheet` or `#party-list` keeps working untouched.
 */
(function (global) {
  'use strict';

  var STORE_KEY = 'aethertable.windows.v1';
  var MIN_W = 260;
  var MIN_H = 120;

  var defs = {};        // id -> definition
  var frames = {};      // id -> {el, body, state}
  var zTop = 30;
  var layer = null;
  var dock = null;

  /* ------------------------------------------------------------ storage -- */

  function readStore() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function writeStore(all) {
    try {
      if (global.localStorage) global.localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch (e) { /* a full or blocked store must never break the game */ }
  }

  function remember(id) {
    var f = frames[id];
    if (!f) return;
    var all = readStore();
    all[id] = {
      x: f.state.x, y: f.state.y, w: f.state.w, h: f.state.h,
      open: f.state.open, min: f.state.min, max: f.state.max,
    };
    writeStore(all);
  }

  function recall(id) { return readStore()[id] || null; }

  /* -------------------------------------------------------------- geometry */

  function viewport() {
    return {
      w: global.innerWidth || document.documentElement.clientWidth || 1280,
      h: global.innerHeight || document.documentElement.clientHeight || 800,
    };
  }

  /* Keep a window on screen. A window dragged off the edge and then reloaded
     used to come back at the same off-screen coordinates and be unreachable
     with no way to get it back short of clearing storage. */
  function clamp(state) {
    var v = viewport();
    state.w = Math.max(MIN_W, Math.min(state.w, v.w));
    state.h = Math.max(MIN_H, Math.min(state.h, v.h));
    state.x = Math.max(8 - state.w + 80, Math.min(state.x, v.w - 60));
    state.y = Math.max(0, Math.min(state.y, v.h - 40));
    return state;
  }

  /* ---------------------------------------------------------- definition -- */

  /**
   * Declare a panel.
   *
   * `mount` is the id of an element already in the document to move into the
   * window body — which is how every existing renderer keeps working without
   * being touched.
   */
  function define(def) {
    defs[def.id] = {
      id: def.id,
      title: def.title || def.id,
      dockLabel: def.dockLabel || def.title || def.id,
      icon: def.icon || '',
      mount: def.mount || null,
      initial: def.initial || { x: 40, y: 80, w: 360, h: 420 },
      openByDefault: !!def.openByDefault,
      onOpen: def.onOpen || null,
    };
  }

  /* -------------------------------------------------------------- frames -- */

  function build(id) {
    var def = defs[id];
    if (!def || frames[id]) return frames[id];

    var saved = recall(id) || {};
    var state = clamp({
      x: typeof saved.x === 'number' ? saved.x : def.initial.x,
      y: typeof saved.y === 'number' ? saved.y : def.initial.y,
      w: typeof saved.w === 'number' ? saved.w : def.initial.w,
      h: typeof saved.h === 'number' ? saved.h : def.initial.h,
      open: typeof saved.open === 'boolean' ? saved.open : def.openByDefault,
      min: !!saved.min,
      max: !!saved.max,
    });

    var el = document.createElement('section');
    el.className = 'win';
    el.id = 'win-' + id;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', def.title);
    el.hidden = !state.open;

    var bar = document.createElement('header');
    bar.className = 'win-bar';
    bar.innerHTML =
      '<span class="win-title">' + escapeHtml(def.title) + '</span>' +
      '<span class="win-btns">' +
      '<button type="button" class="win-btn" data-act="min" title="Roll up" aria-label="Minimise ' + escapeHtml(def.title) + '">–</button>' +
      '<button type="button" class="win-btn" data-act="max" title="Maximise" aria-label="Maximise ' + escapeHtml(def.title) + '">▢</button>' +
      '<button type="button" class="win-btn" data-act="close" title="Close" aria-label="Close ' + escapeHtml(def.title) + '">✕</button>' +
      '</span>';
    el.appendChild(bar);

    var body = document.createElement('div');
    body.className = 'win-body';
    el.appendChild(body);

    var grip = document.createElement('div');
    grip.className = 'win-grip';
    grip.setAttribute('aria-hidden', 'true');
    el.appendChild(grip);

    layer.appendChild(el);

    var f = { el: el, body: body, bar: bar, state: state, def: def };
    frames[id] = f;

    /* Move the existing panel in, so its renderer never knows. */
    if (def.mount) {
      var existing = document.getElementById(def.mount);
      if (existing) { existing.hidden = false; body.appendChild(existing); }
    }

    apply(f);
    wire(f);
    return f;
  }

  function apply(f) {
    var s = f.state;
    var el = f.el;
    el.hidden = !s.open;
    el.classList.toggle('minimised', !!s.min);
    el.classList.toggle('maximised', !!s.max);
    if (s.max) {
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.width = '100%';
      el.style.height = 'calc(100% - 0px)';
    } else {
      el.style.left = s.x + 'px';
      el.style.top = s.y + 'px';
      el.style.width = s.w + 'px';
      el.style.height = s.min ? 'auto' : s.h + 'px';
    }
    var maxBtn = f.bar.querySelector('[data-act="max"]');
    if (maxBtn) maxBtn.textContent = s.max ? '❐' : '▢';
    var minBtn = f.bar.querySelector('[data-act="min"]');
    if (minBtn) minBtn.textContent = s.min ? '▭' : '–';
    syncDock(f.def.id);
  }

  function focus(id) {
    var f = frames[id];
    if (!f) return;
    zTop += 1;
    f.el.style.zIndex = String(zTop);
  }

  /* ------------------------------------------------------------- pointer -- */

  function wire(f) {
    var s = f.state;

    f.el.addEventListener('pointerdown', function () { focus(f.def.id); });

    f.bar.addEventListener('click', function (ev) {
      var btn = ev.target.closest && ev.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'close') close(f.def.id);
      else if (act === 'min') { s.min = !s.min; if (s.min) s.max = false; apply(f); remember(f.def.id); }
      else if (act === 'max') { s.max = !s.max; if (s.max) s.min = false; apply(f); remember(f.def.id); }
    });

    /* Dragging by the title bar. Pointer capture so a fast drag that leaves
       the bar does not drop the window mid-move. */
    var drag = null;
    f.bar.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest && ev.target.closest('[data-act]')) return;
      if (s.max) return;
      drag = { px: ev.clientX, py: ev.clientY, x: s.x, y: s.y };
      f.bar.setPointerCapture(ev.pointerId);
      f.el.classList.add('dragging');
      ev.preventDefault();
    });
    f.bar.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      s.x = drag.x + (ev.clientX - drag.px);
      s.y = drag.y + (ev.clientY - drag.py);
      clamp(s);
      apply(f);
    });
    var endDrag = function (ev) {
      if (!drag) return;
      drag = null;
      f.el.classList.remove('dragging');
      try { f.bar.releasePointerCapture(ev.pointerId); } catch (e) { /* already gone */ }
      remember(f.def.id);
    };
    f.bar.addEventListener('pointerup', endDrag);
    f.bar.addEventListener('pointercancel', endDrag);

    /* Resizing from the corner grip. */
    var grip = f.el.querySelector('.win-grip');
    var size = null;
    grip.addEventListener('pointerdown', function (ev) {
      if (s.max || s.min) return;
      size = { px: ev.clientX, py: ev.clientY, w: s.w, h: s.h };
      grip.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      ev.stopPropagation();
    });
    grip.addEventListener('pointermove', function (ev) {
      if (!size) return;
      s.w = size.w + (ev.clientX - size.px);
      s.h = size.h + (ev.clientY - size.py);
      clamp(s);
      apply(f);
    });
    var endSize = function (ev) {
      if (!size) return;
      size = null;
      try { grip.releasePointerCapture(ev.pointerId); } catch (e) { /* already gone */ }
      remember(f.def.id);
    };
    grip.addEventListener('pointerup', endSize);
    grip.addEventListener('pointercancel', endSize);

    /* Escape closes the window the focus is inside, which is what every other
       dialog on the machine does. */
    f.el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { close(f.def.id); ev.stopPropagation(); }
    });
  }

  /* ---------------------------------------------------------------- api --- */

  function open(id) {
    var f = frames[id] || build(id);
    if (!f) return;
    f.state.open = true;
    f.state.min = false;
    clamp(f.state);
    apply(f);
    focus(id);
    remember(id);
    if (f.def.onOpen) { try { f.def.onOpen(f.body); } catch (e) { /* a panel that throws must not take the app with it */ } }
    var first = f.el.querySelector('button, [tabindex], input, select');
    if (first && first.focus) first.focus();
  }

  function close(id) {
    var f = frames[id];
    if (!f) return;
    f.state.open = false;
    apply(f);
    remember(id);
    var btn = dock && dock.querySelector('[data-win="' + id + '"]');
    if (btn && btn.focus) btn.focus();
  }

  function toggle(id) {
    var f = frames[id];
    if (f && f.state.open && !f.state.min) close(id);
    else open(id);
  }

  function isOpen(id) { return !!(frames[id] && frames[id].state.open); }

  /* ---------------------------------------------------------------- dock -- */

  function syncDock(id) {
    if (!dock) return;
    var btn = dock.querySelector('[data-win="' + id + '"]');
    if (!btn) return;
    var on = isOpen(id);
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function renderDock() {
    if (!dock) return;
    dock.innerHTML = '';
    Object.keys(defs).forEach(function (id) {
      var def = defs[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dock-btn';
      b.setAttribute('data-win', id);
      b.setAttribute('aria-pressed', 'false');
      b.title = def.dockLabel;
      b.innerHTML = (def.icon ? '<span class="dock-icon" aria-hidden="true">' + def.icon + '</span>' : '') +
        '<span class="dock-label">' + escapeHtml(def.dockLabel) + '</span>';
      b.onclick = function () { toggle(id); };
      dock.appendChild(b);
    });
    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'dock-btn ghost';
    reset.id = 'dock-reset';
    reset.title = 'Put every panel back where it started';
    reset.innerHTML = '<span class="dock-label">Reset layout</span>';
    reset.onclick = resetLayout;
    dock.appendChild(reset);
    Object.keys(defs).forEach(syncDock);
  }

  function resetLayout() {
    writeStore({});
    Object.keys(frames).forEach(function (id) {
      var f = frames[id];
      var d = f.def.initial;
      f.state.x = d.x; f.state.y = d.y; f.state.w = d.w; f.state.h = d.h;
      f.state.min = false; f.state.max = false;
      f.state.open = f.def.openByDefault;
      clamp(f.state);
      apply(f);
    });
  }

  /* ---------------------------------------------------------------- boot -- */

  function boot(opts) {
    opts = opts || {};
    layer = document.getElementById(opts.layer || 'windows');
    dock = document.getElementById(opts.dock || 'dock');
    if (!layer) return null;
    Object.keys(defs).forEach(build);
    renderDock();

    /* A window that was off-screen when the browser was resized has to come
       back, or it is lost with no way to reach it. */
    global.addEventListener('resize', function () {
      Object.keys(frames).forEach(function (id) {
        clamp(frames[id].state);
        apply(frames[id]);
      });
    });
    return api;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  var api = {
    define: define, boot: boot,
    open: open, close: close, toggle: toggle, focus: focus, isOpen: isOpen,
    resetLayout: resetLayout,
    bodyOf: function (id) { return frames[id] && frames[id].body; },
    ids: function () { return Object.keys(defs); },
    stateOf: function (id) { return frames[id] ? JSON.parse(JSON.stringify(frames[id].state)) : null; },
  };

  global.DND = global.DND || {};
  global.DND.Windows = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
