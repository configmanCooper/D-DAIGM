/*
 * ui/battle.js — DND.Battle
 *
 * Canvas grid combat. Tokens are drawn by gen/tokens.js; the initiative order,
 * positions and health bands all come from Knowledge.getObservation, so a
 * hidden creature is not on the board because it was never in the observation.
 *
 * All geometry — reachable range, line of sight, cover, and every AoE template
 * — is imported verbatim from js/engine/combat.js. None of it is re-derived
 * here. If the picture and the maths ever disagreed the game would be lying to
 * the player about what is safe, so battle.js simply asks combat.js and draws
 * the answer. When combat.js is absent the grid still renders; only the
 * geometry-driven overlays quietly switch off.
 *
 * A role="table" mirror carries the identical grid state for screen readers.
 */
(function (global) {
  'use strict';

  var CELL_PX = 44;
  var sel = null;         // selected own actor id (for movement)
  var aoe = null;         // { kind:'sphere'|'cone', radius, centre }
  var hostReady = false;

  function Combat() { return global.DND && global.DND.Combat; }
  function cell() { var c = Combat(); return (c && c.CELL) || 5; }

  function ensureHost() {
    var host = document.getElementById('battle-view');
    if (!host) return null;
    if (hostReady) return host;
    host.innerHTML =
      '<div class="battle-top">' +
        '<strong id="bt-round">Combat</strong>' +
        '<span id="bt-active" class="turn-indicator"></span>' +
        '<span class="spacer" style="flex:1"></span>' +
        '<button class="chip" id="bt-aoe-sphere" type="button" title="Preview a spherical burst">◯ Burst</button>' +
        '<button class="chip" id="bt-aoe-cone" type="button" title="Preview a cone">◺ Cone</button>' +
        '<button class="chip" id="bt-aoe-clear" type="button">Clear template</button>' +
      '</div>' +
      '<div class="battle-body">' +
        '<div id="battle-canvas-wrap"><canvas id="battle-canvas"></canvas>' +
          '<div id="grid-mirror" class="grid-mirror" role="table" aria-label="Battle grid"></div></div>' +
        '<div class="initiative" id="init-list" aria-label="Initiative order"></div>' +
      '</div>' +
      '<div class="battle-legend">' +
        '<span>▸ acting</span><span>◆ ally</span><span>✦ enemy</span>' +
        '<span id="bt-geom-note"></span></div>';
    var canvas = document.getElementById('battle-canvas');
    canvas.addEventListener('click', onCanvasClick);
    document.getElementById('bt-aoe-sphere').onclick = function () { aoe = { kind: 'sphere', radius: 20, centre: null }; render(); };
    document.getElementById('bt-aoe-cone').onclick = function () { aoe = { kind: 'cone', radius: 15, centre: null }; render(); };
    document.getElementById('bt-aoe-clear').onclick = function () { aoe = null; render(); };
    hostReady = true;
    return host;
  }

  /* Grid extent that comfortably contains everyone on the board. */
  function extent(actors) {
    var xs = [], ys = [];
    Object.keys(actors).forEach(function (id) {
      var p = actors[id].pos;
      if (p) { xs.push(p.x); ys.push(p.y); }
    });
    if (!xs.length) return { minX: 0, minY: 0, w: 12, h: 10 };
    var minX = Math.min.apply(null, xs) - 2, maxX = Math.max.apply(null, xs) + 2;
    var minY = Math.min.apply(null, ys) - 2, maxY = Math.max.apply(null, ys) + 2;
    return { minX: minX, minY: minY, w: (maxX - minX + 1), h: (maxY - minY + 1) };
  }

  var lastGrid = null;

  function render() {
    var App = global.DND && global.DND.App;
    if (!App || !App.session) return;
    var host = ensureHost();
    if (!host) return;

    var obs = App.observationFor(App.viewerId());
    var actors = (obs && obs.actors) || {};
    var combat = (obs && obs.combat) || { active: false };

    var ext = extent(actors);
    lastGrid = ext;
    var canvas = document.getElementById('battle-canvas');
    canvas.width = ext.w * CELL_PX;
    canvas.height = ext.h * CELL_PX;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // occupancy map
    var occ = {};
    Object.keys(actors).forEach(function (id) {
      var p = actors[id].pos;
      if (p) occ[p.x + ',' + p.y] = id;
    });

    drawGrid(ctx, ext);
    drawReachable(ctx, ext, actors, occ);
    drawAoe(ctx, ext, actors);
    drawTokens(ctx, ext, actors, combat);

    // header
    document.getElementById('bt-round').textContent = combat.active ? ('Combat — round ' + (combat.round || 1)) : 'Not in combat';
    var actName = combat.activeActorId ? (App.actorName(combat.activeActorId) || combat.activeActorId) : '';
    document.getElementById('bt-active').textContent = actName ? (actName + ' to act') : '';
    var note = document.getElementById('bt-geom-note');
    if (note) note.textContent = Combat() ? '' : '· geometry overlays unavailable (combat module not loaded)';

    renderInitiative(App, combat, actors);
    renderMirror(App, ext, actors, occ);
  }

  function drawGrid(ctx, ext) {
    ctx.fillStyle = '#141009';
    ctx.fillRect(0, 0, ext.w * CELL_PX, ext.h * CELL_PX);
    ctx.strokeStyle = '#332a1c';
    ctx.lineWidth = 1;
    for (var x = 0; x <= ext.w; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL_PX, 0); ctx.lineTo(x * CELL_PX, ext.h * CELL_PX); ctx.stroke();
    }
    for (var y = 0; y <= ext.h; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL_PX); ctx.lineTo(ext.w * CELL_PX, y * CELL_PX); ctx.stroke();
    }
  }

  /* Reachable-square highlight. The range test is combat.js's Chebyshev
     distance in feet; we do not compute distance here. */
  function drawReachable(ctx, ext, actors, occ) {
    var App = global.DND && global.DND.App;
    var C = Combat();
    if (!C || !sel || !actors[sel] || !actors[sel].pos) return;
    var sv = App.selfView(sel);
    if (!sv) return;
    var from = actors[sel].pos;
    var moveFt = sv.moveFt || 30;
    ctx.fillStyle = 'rgba(111,154,85,0.18)';
    for (var gx = 0; gx < ext.w; gx++) {
      for (var gy = 0; gy < ext.h; gy++) {
        var sq = { x: ext.minX + gx, y: ext.minY + gy };
        if (sq.x === from.x && sq.y === from.y) continue;
        if (occ[sq.x + ',' + sq.y]) continue;
        if (C.chebyshevFt(from, sq) <= moveFt) {
          ctx.fillRect(gx * CELL_PX + 1, gy * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
        }
      }
    }
  }

  /* AoE template preview. The set of included squares is combat.js's, verbatim. */
  function drawAoe(ctx, ext, actors) {
    var C = Combat();
    if (!C || !aoe || !aoe.centre) return;
    var squares = [];
    if (aoe.kind === 'sphere' && C.squaresInSphere) {
      squares = C.squaresInSphere(aoe.centre, aoe.radius);
    } else if (aoe.kind === 'cone' && C.squaresInCone) {
      var origin = (sel && actors[sel] && actors[sel].pos) || aoe.centre;
      var dir = { x: aoe.centre.x - origin.x, y: aoe.centre.y - origin.y };
      squares = C.squaresInCone(origin, dir, aoe.radius);
    }
    ctx.fillStyle = 'rgba(214,143,54,0.28)';
    squares.forEach(function (sq) {
      var gx = sq.x - ext.minX, gy = sq.y - ext.minY;
      if (gx < 0 || gy < 0 || gx >= ext.w || gy >= ext.h) return;
      ctx.fillRect(gx * CELL_PX + 1, gy * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
    });
  }

  function drawTokens(ctx, ext, actors, combat) {
    var Tokens = global.DND && global.DND.Tokens;
    var App = global.DND && global.DND.App;
    Object.keys(actors).forEach(function (id) {
      var a = actors[id];
      if (!a.pos) return;
      var gx = (a.pos.x - ext.minX) * CELL_PX, gy = (a.pos.y - ext.minY) * CELL_PX;
      if (id === sel) {
        ctx.strokeStyle = '#d7a842'; ctx.lineWidth = 3;
        ctx.strokeRect(gx + 2, gy + 2, CELL_PX - 4, CELL_PX - 4);
      }
      if (Tokens && App) {
        try {
          var alle = App.allegianceOf(id);
          var gm = Tokens.genomeForToken('battle:' + id, { kind: a.side === 'party' || a.side === 'ally' ? 'portrait' : 'creature', allegiance: alle });
          var pad = 4;
          var tctx = ctx;
          tctx.save();
          tctx.translate(gx + pad, gy + pad);
          Tokens.drawToken(tctx, gm, CELL_PX - pad * 2, {
            allegiance: alle,
            hp: (a.hp != null && a.hpMax) ? { current: a.hp, max: a.hpMax } : null,
            dead: a.dead,
            conditions: a.conditions || [],
          });
          tctx.restore();
        } catch (e) { fallbackToken(ctx, gx, gy, a); }
      } else { fallbackToken(ctx, gx, gy, a); }
    });
  }

  function fallbackToken(ctx, gx, gy, a) {
    ctx.fillStyle = a.side === 'party' ? '#5d8fc0' : (a.side === 'enemy' ? '#c14b3c' : '#b1a488');
    ctx.beginPath();
    ctx.arc(gx + CELL_PX / 2, gy + CELL_PX / 2, CELL_PX / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#140e03';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((a.name || '?').slice(0, 2), gx + CELL_PX / 2, gy + CELL_PX / 2 + 4);
  }

  function renderInitiative(App, combat, actors) {
    var host = document.getElementById('init-list');
    if (!host) return;
    var order = (combat && combat.order) || [];
    if (!order.length) {
      host.innerHTML = '<p class="empty-note">No initiative order.</p>';
      return;
    }
    host.innerHTML = order.map(function (id) {
      var a = actors[id] || {};
      var isActive = id === combat.activeActorId;
      var sideCls = a.side === 'enemy' ? 'side-enemy' : 'side-ally';
      var hp = (a.hp != null && a.hpMax) ? (a.hp + '/' + a.hpMax) : (a.health || '');
      return '<div class="init-row' + (isActive ? ' active' : '') + '">' +
        '<span class="' + sideCls + '"><span class="nm">' + App.esc(a.name || id) + '</span></span>' +
        '<span>' + App.esc(String(hp)) + '</span></div>';
    }).join('');
  }

  /* The semantic mirror: identical grid state, read as a table. */
  function renderMirror(App, ext, actors, occ) {
    var host = document.getElementById('grid-mirror');
    if (!host) return;
    var rows = '';
    for (var gy = 0; gy < ext.h; gy++) {
      var cells = '';
      for (var gx = 0; gx < ext.w; gx++) {
        var id = occ[(ext.minX + gx) + ',' + (ext.minY + gy)];
        var label = id ? (App.actorName(id) + ' (' + (actors[id].side || 'neutral') + ')') : 'empty';
        cells += '<div role="cell">' + App.esc('col ' + (ext.minX + gx) + ', row ' + (ext.minY + gy) + ': ' + label) + '</div>';
      }
      rows += '<div role="row">' + cells + '</div>';
    }
    host.innerHTML = rows;
  }

  function onCanvasClick(ev) {
    var App = global.DND && global.DND.App;
    if (!App || !lastGrid) return;
    var rect = ev.currentTarget.getBoundingClientRect();
    var gx = Math.floor((ev.clientX - rect.left) / CELL_PX);
    var gy = Math.floor((ev.clientY - rect.top) / CELL_PX);
    var sq = { x: lastGrid.minX + gx, y: lastGrid.minY + gy };

    if (aoe) { aoe.centre = sq; render(); return; }

    var obs = App.observationFor(App.viewerId());
    var actors = (obs && obs.actors) || {};
    var clickedId = null;
    Object.keys(actors).forEach(function (id) {
      var p = actors[id].pos;
      if (p && p.x === sq.x && p.y === sq.y) clickedId = id;
    });

    if (clickedId) {
      var side = actors[clickedId].side;
      if (side === 'party' || side === 'ally') {
        sel = clickedId;               // select own token for movement
        render();
      } else {
        App.battleAttack(sel, clickedId);   // target an enemy through legalMoves
      }
      return;
    }
    // empty square: move the selected token there
    if (sel) App.battleMove(sel, sq);
  }

  function show() { var h = document.getElementById('battle-view'); if (h) h.hidden = false; var n = document.getElementById('narrative-view'); if (n) n.hidden = true; render(); }
  function hide() { var h = document.getElementById('battle-view'); if (h) h.hidden = true; var n = document.getElementById('narrative-view'); if (n) n.hidden = false; }

  var api = { render: render, show: show, hide: hide, select: function (id) { sel = id; } };
  global.DND = global.DND || {};
  global.DND.Battle = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
