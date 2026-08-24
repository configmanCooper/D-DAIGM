/*
 * js/gen/tokens.js — circular battle-map tokens.
 *
 * No image assets: a token composites whichever art the combatant already
 * has (a portrait genome for PCs/NPCs, a creature genome for monsters),
 * clips it to a disc, then layers state on the rim — an allegiance ring,
 * condition pips, an HP arc, and a "dead" cross — so the whole thing reads
 * at a glance even at 32px on a crowded grid.
 */
(function (global) {
  'use strict';

  var DND = global.DND = global.DND || {};
  var Art = DND.Art || (typeof require !== 'undefined' ? require('./art.js') : null);
  var RNG = DND.RNG || (typeof require !== 'undefined' ? require('../rng.js').RNG : null);
  var Portrait = DND.Portrait || (typeof require !== 'undefined' ? require('./portrait.js') : null);
  var Creature = DND.Creature || (typeof require !== 'undefined' ? require('./creature.js') : null);

  var ALLEGIANCE_COLORS = {
    party: '#3f8fd6', ally: '#3fae4a', neutral: '#c9c9c9',
    enemy: '#c0392b', boss: '#a768e0',
  };
  var ALLEGIANCES = ['party', 'ally', 'neutral', 'enemy', 'boss'];

  /**
   * Build a token genome by delegating to Portrait or Creature for the
   * actual figure, then wrapping it with the token-specific bits (which
   * inner renderer to call, and the allegiance default). `opts.kind` is
   * 'portrait' (default) or 'creature'.
   */
  function genomeForToken(seed, opts) {
    opts = opts || {};
    var kind = opts.kind === 'creature' ? 'creature' : 'portrait';
    var inner = kind === 'creature'
      ? Creature.genomeForMonster(seed, opts)
      : Portrait.genomeForCharacter(seed, opts);
    return {
      seed: inner.seed,
      kind: kind,
      inner: inner,
      allegiance: ALLEGIANCES.indexOf(opts.allegiance) >= 0 ? opts.allegiance : 'neutral',
    };
  }

  function hashColor(str) {
    var h = DND.hashString ? DND.hashString(str) : 0;
    return Art.hsl(h % 360, 65, 55);
  }

  /* ------------------------------------------------------------- drawing -- */

  function drawToken(ctx, genome, size, opts) {
    opts = opts || {};
    var gm = genome || genomeForToken('fallback', {});
    var s = size;
    var cx = s / 2, cy = s / 2;
    var ringW = Math.max(1.5, s * 0.07);
    var discR = s / 2 - ringW * 1.3;

    ctx.save();

    /* disc backdrop so a transparent inner render never looks like a hole */
    ctx.fillStyle = '#14141a';
    ctx.beginPath(); ctx.arc(cx, cy, discR, 0, Math.PI * 2); ctx.fill();

    /* clip the inner art to the disc, then render it scaled to fill a
       square bounding box centred on the token. */
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, discR, 0, Math.PI * 2);
    ctx.clip();
    var artSize = discR * 2.05;
    ctx.translate(cx - artSize / 2, cy - artSize / 2);
    if (gm.kind === 'creature') {
      Creature.drawCreature(ctx, gm.inner, artSize, artSize, { boss: gm.allegiance === 'boss' || opts.boss });
    } else {
      Portrait.drawPortrait(ctx, gm.inner, artSize, artSize, { mood: opts.mood || 0 });
    }
    ctx.restore();

    /* allegiance ring */
    var allegiance = opts.allegiance || gm.allegiance || 'neutral';
    var ringColor = ALLEGIANCE_COLORS[allegiance] || ALLEGIANCE_COLORS.neutral;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = ringW;
    ctx.beginPath(); ctx.arc(cx, cy, discR + ringW * 0.6, 0, Math.PI * 2); ctx.stroke();
    if (allegiance === 'boss') {
      /* a second, thinner gold ring — elite tell at a glance */
      ctx.strokeStyle = '#e08a2e';
      ctx.lineWidth = ringW * 0.4;
      ctx.beginPath(); ctx.arc(cx, cy, discR + ringW * 1.15, 0, Math.PI * 2); ctx.stroke();
    }

    /* HP arc: a coloured arc traced over the top of the ring, green -> red
       as the fraction drops, starting at 12 o'clock and sweeping clockwise. */
    if (opts.hp && typeof opts.hp.max === 'number' && opts.hp.max > 0) {
      var frac = Art.clamp((opts.hp.current == null ? opts.hp.max : opts.hp.current) / opts.hp.max, 0, 1);
      var hpColor = frac > 0.5 ? Art.mix('#e0c93f', '#3fae4a', (frac - 0.5) * 2)
        : Art.mix('#c0392b', '#e0c93f', frac * 2);
      ctx.strokeStyle = hpColor;
      ctx.lineWidth = ringW * 0.55;
      ctx.beginPath();
      ctx.arc(cx, cy, discR + ringW * 0.6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.stroke();
    }

    /* condition pips around the rim, one per active condition, coloured
       deterministically from the condition name so the same condition
       always reads the same colour across every token. */
    var conditions = opts.conditions || [];
    if (conditions.length) {
      var pipR = Math.max(1.2, s * 0.045);
      var orbit = discR + ringW * 1.9;
      for (var i = 0; i < conditions.length; i++) {
        var a = -Math.PI / 2 + (i / conditions.length) * Math.PI * 2;
        var px = cx + Math.cos(a) * orbit, py = cy + Math.sin(a) * orbit;
        ctx.fillStyle = hashColor(String(conditions[i]));
        ctx.beginPath(); ctx.arc(px, py, pipR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0a0a0d'; ctx.lineWidth = Math.max(0.5, pipR * 0.25);
        ctx.stroke();
      }
    }

    /* dead overlay: a desaturating wash plus a red X, unambiguous even when
       every other layer above is still drawn underneath it. */
    if (opts.dead) {
      ctx.fillStyle = 'rgba(10,10,10,0.55)';
      ctx.beginPath(); ctx.arc(cx, cy, discR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e04040';
      ctx.lineWidth = Math.max(1.5, s * 0.08);
      ctx.lineCap = 'round';
      var m = discR * 0.62;
      ctx.beginPath(); ctx.moveTo(cx - m, cy - m); ctx.lineTo(cx + m, cy + m); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + m, cy - m); ctx.lineTo(cx - m, cy + m); ctx.stroke();
    }

    ctx.restore();
  }

  var api = {
    drawToken: drawToken,
    genomeForToken: genomeForToken,
    ALLEGIANCE_COLORS: ALLEGIANCE_COLORS,
    ALLEGIANCES: ALLEGIANCES,
  };

  global.DND = global.DND || {};
  global.DND.Tokens = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
