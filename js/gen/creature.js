/*
 * js/gen/creature.js — procedural monster and boss art.
 *
 * Silhouette-first with bilateral symmetry: a coarse half-grid is filled by
 * weighted rules keyed off the monster's `visual.silhouette` archetype (plus
 * seeded jitter), mirrored across the centre line, smoothed into a blob path,
 * then feature layers (`visual.features`) are drawn on top and a two-tone
 * shade pass (body colour + a shaded underside) ties it together. No image
 * assets: this is the same layered-Canvas2D technique as portrait.js and the
 * NegotiatorGame art reference, applied to monster silhouettes instead of
 * faces.
 */
(function (global) {
  'use strict';

  var DND = global.DND = global.DND || {};
  var Art = DND.Art || (typeof require !== 'undefined' ? require('./art.js') : null);
  var RNG = DND.RNG || (typeof require !== 'undefined' ? require('../rng.js').RNG : null);

  var SILHOUETTES = [
    'humanoid', 'beast', 'dragon', 'ooze', 'undead', 'aberration', 'construct',
    'elemental', 'plant', 'swarm', 'giant', 'fiend', 'celestial', 'fey', 'monstrosity',
  ];

  var SIZE_SCALE = {
    tiny: 0.5, small: 0.72, medium: 1.0, large: 1.32,
    huge: 1.68, gargantuan: 2.15,
  };
  var SIZE_ORDER = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];

  var MONSTER_DEFAULTS = {
    palette: ['#6a7a5a', '#3a4a34'], silhouette: 'beast', size: 'medium', features: [],
  };

  var _data = { MONSTERS: {} };
  function setData(data) { data = data || {}; _data.MONSTERS = data.MONSTERS || _data.MONSTERS || {}; }

  /**
   * The monster table, however this file is running.
   *
   * `setData` was never called in production, so `_data.MONSTERS` was always
   * empty and every `monsterId` lookup missed: a dragon, a zombie and a
   * goblin all fell through to the default silhouette and were drawn as the
   * same grey beast. The same lazy-load gap has now bitten this project three
   * times, so this looks the data up itself rather than waiting to be handed
   * it. `setData` still wins when a caller supplies one.
   */
  function monsters() {
    if (Object.keys(_data.MONSTERS).length) return _data.MONSTERS;
    var g = global.DND || {};
    if (g.MONSTERS && Object.keys(g.MONSTERS).length) return g.MONSTERS;
    if (typeof require !== 'undefined') {
      try {
        var m = require('../data/srd_monsters.js').MONSTERS;
        if (m) { _data.MONSTERS = m; return m; }
      } catch (e) { /* the browser path is the global above */ }
    }
    return _data.MONSTERS;
  }

  function normSize(s) {
    s = String(s || 'medium').toLowerCase();
    return SIZE_SCALE[s] ? s : 'medium';
  }

  /**
   * Build a stable genome for a monster/boss. `spec` may carry a `visual`
   * block straight from srd_monsters.js (`{palette, silhouette, features,
   * size}`); anything missing falls back to MONSTER_DEFAULTS so any silhouette
   * and any monster id — known or not — always renders.
   */
  function genomeForMonster(seed, spec) {
    spec = spec || {};
    var real = spec.monsterId && monsters()[spec.monsterId];
    var visual = spec.visual || (real && real.visual) || MONSTER_DEFAULTS;
    var silhouette = SILHOUETTES.indexOf(visual.silhouette) >= 0 ? visual.silhouette : MONSTER_DEFAULTS.silhouette;
    var base = Art.makeGenome(seed, { visual: visual, kind: 'creature', scheme: 'split' });
    var rng = new RNG(seed);
    var bodyPool = (visual.palette && visual.palette.length) ? visual.palette : base.palette;
    var body = rng.fork('body').pick(bodyPool) || base.primary;

    return {
      seed: base.seed,
      monsterId: spec.monsterId || null,
      silhouette: silhouette,
      size: normSize(visual.size || spec.size),
      features: Array.isArray(visual.features) ? visual.features.slice() : [],
      body: body,
      shadow: Art.shade(body, -38),
      highlight: Art.shade(body, 30),
      accent: base.accent,
      jitterSeed: rng.fork('jitter').int(0, 1e9),
      eyeColor: Art.hsl(rng.fork('eye').float(0, 360), 70, 55),
      symmetryPoints: rng.fork('mass').int(7, 11),
    };
  }

  /* --------------------------------------------------- silhouette masses -- */
  /* Each archetype returns a list of half-body "blobs" (relative to a unit
     bounding box centred at 0,0, x in [0,1] where 0 is the centre line) that
     get mirrored to build the other half. Coarse but instantly distinct
     silhouettes at a glance, which is the point at token scale. */
  function massesFor(sil) {
    switch (sil) {
      case 'humanoid': return [
        { x: 0.10, y: -0.55, r: 0.20 }, /* head */
        { x: 0.22, y: -0.10, r: 0.34 }, /* torso/shoulder */
        { x: 0.16, y: 0.45, r: 0.20 },  /* hip/leg */
      ];
      case 'beast': return [
        { x: 0.30, y: -0.15, r: 0.22 }, /* head/muzzle */
        { x: 0.05, y: 0.05, r: 0.42 },  /* body */
        { x: 0.25, y: 0.40, r: 0.22 },  /* haunch */
      ];
      case 'dragon': return [
        { x: 0.55, y: -0.35, r: 0.20 }, /* head on long neck */
        { x: 0.15, y: 0.0, r: 0.44 },   /* body */
        { x: 0.35, y: 0.4, r: 0.24 },   /* tail base */
      ];
      case 'ooze': return [
        { x: 0.0, y: 0.15, r: 0.5 },
        { x: 0.20, y: -0.1, r: 0.3 },
      ];
      case 'undead': return [
        { x: 0.08, y: -0.5, r: 0.17 },
        { x: 0.12, y: 0.0, r: 0.26 },
        { x: 0.06, y: 0.42, r: 0.16 },
      ];
      case 'aberration': return [
        { x: 0.0, y: -0.1, r: 0.46 },
        { x: 0.30, y: 0.25, r: 0.18 },
        { x: 0.35, y: -0.35, r: 0.15 },
      ];
      case 'construct': return [
        { x: 0.06, y: -0.5, r: 0.16 },
        { x: 0.24, y: -0.05, r: 0.36 },
        { x: 0.20, y: 0.45, r: 0.22 },
      ];
      case 'elemental': return [
        { x: 0.0, y: -0.2, r: 0.38 },
        { x: 0.25, y: 0.2, r: 0.30 },
        { x: 0.10, y: 0.5, r: 0.18 },
      ];
      case 'plant': return [
        { x: 0.0, y: -0.4, r: 0.30 },
        { x: 0.10, y: 0.1, r: 0.34 },
        { x: 0.05, y: 0.5, r: 0.20 },
      ];
      case 'swarm': return [
        { x: 0.30, y: -0.3, r: 0.14 },
        { x: 0.10, y: 0.0, r: 0.18 },
        { x: 0.35, y: 0.15, r: 0.13 },
        { x: 0.05, y: 0.35, r: 0.15 },
      ];
      case 'giant': return [
        { x: 0.08, y: -0.5, r: 0.20 },
        { x: 0.25, y: -0.05, r: 0.40 },
        { x: 0.18, y: 0.48, r: 0.26 },
      ];
      case 'fiend': return [
        { x: 0.10, y: -0.5, r: 0.18 },
        { x: 0.24, y: -0.05, r: 0.32 },
        { x: 0.18, y: 0.45, r: 0.20 },
      ];
      case 'celestial': return [
        { x: 0.06, y: -0.5, r: 0.19 },
        { x: 0.15, y: 0.0, r: 0.30 },
        { x: 0.10, y: 0.45, r: 0.19 },
      ];
      case 'fey': return [
        { x: 0.08, y: -0.5, r: 0.16 },
        { x: 0.14, y: 0.0, r: 0.24 },
        { x: 0.08, y: 0.42, r: 0.15 },
      ];
      case 'monstrosity':
      default: return [
        { x: 0.20, y: -0.25, r: 0.24 },
        { x: 0.10, y: 0.1, r: 0.38 },
        { x: 0.28, y: 0.4, r: 0.22 },
      ];
    }
  }

  /* ------------------------------------------------------------- drawing -- */

  function drawCreature(ctx, genome, w, h, opts) {
    opts = opts || {};
    var gm = genome || genomeForMonster('fallback', {});
    var boss = !!opts.boss;
    var scale = SIZE_SCALE[gm.size] || 1;
    if (boss) scale *= 1.35;

    ctx.save();
    var cx = w / 2, cy = h * (boss ? 0.58 : 0.55);
    var unit = Math.min(w, h) * 0.44 * scale;

    if (boss) {
      /* aura: soft radial glow behind the mass, richer palette ring */
      var g = ctx.createRadialGradient(cx, cy, unit * 0.2, cx, cy, unit * 1.6);
      g.addColorStop(0, Art.alpha(gm.accent, 0.35));
      g.addColorStop(1, Art.alpha(gm.accent, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    /* ground contact shadow, so the mass reads as standing on something */
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + unit * 0.92, unit * 0.62, unit * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    var rng = new RNG(gm.jitterSeed);
    var masses = massesFor(gm.silhouette);
    var points = gm.symmetryPoints || 9;

    /* two-tone shade pass: shadow half drawn first and offset, body colour
       mass drawn on top slightly inset — a cheap but effective "form" cue
       without full lighting. */
    ctx.fillStyle = gm.shadow;
    drawMassMirrored(ctx, masses, cx + unit * 0.05, cy + unit * 0.04, unit, points, rng.fork('shadow-blob'));
    ctx.fillStyle = gm.body;
    drawMassMirrored(ctx, masses, cx, cy, unit, points, rng.fork('body-blob'));

    /* subtle highlight spine down the centreline for legibility */
    ctx.strokeStyle = Art.alpha(gm.highlight, 0.5);
    ctx.lineWidth = Math.max(1, unit * 0.03);
    ctx.beginPath();
    ctx.moveTo(cx, cy - unit * 0.6);
    ctx.quadraticCurveTo(cx + unit * 0.05, cy, cx, cy + unit * 0.6);
    ctx.stroke();

    var featureCount = boss ? gm.features.length : Math.min(gm.features.length, gm.features.length);
    for (var i = 0; i < gm.features.length; i++) {
      drawFeature(ctx, gm.features[i], gm, cx, cy, unit, rng.fork('feat' + i));
    }
    if (boss) {
      /* bosses get one extra emphasised pass of their own features (richer,
         larger) plus a crown-like accent flourish so they read as elite. */
      for (var j = 0; j < gm.features.length; j++) {
        drawFeature(ctx, gm.features[j], gm, cx, cy, unit * 1.12, rng.fork('bossfeat' + j), true);
      }
      ctx.strokeStyle = Art.alpha(gm.accent, 0.8);
      ctx.lineWidth = Math.max(1, unit * 0.04);
      ctx.beginPath();
      ctx.arc(cx, cy - unit * 0.02, unit * 1.05, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    ctx.restore();
    return featureCount;
  }

  function drawMassMirrored(ctx, masses, cx, cy, unit, points, rng) {
    for (var i = 0; i < masses.length; i++) {
      var m = masses[i];
      Art.blob(ctx, cx + m.x * unit, cy + m.y * unit, m.r * unit, points, 0.22, rng);
      ctx.fill();
      if (m.x > 0.001) {
        Art.blob(ctx, cx - m.x * unit, cy + m.y * unit, m.r * unit, points, 0.22, rng);
        ctx.fill();
      }
    }
  }

  /* ---------------------------------------------------------- feature layers -- */

  function drawFeature(ctx, name, gm, cx, cy, unit, rng, big) {
    var k = big ? 1.25 : 1;
    switch (name) {
      case 'horns':
        ctx.fillStyle = Art.shade(gm.body, -50);
        [-1, 1].forEach(function (s) {
          ctx.beginPath();
          ctx.moveTo(cx + s * unit * 0.18, cy - unit * 0.55);
          ctx.quadraticCurveTo(cx + s * unit * 0.42 * k, cy - unit * 0.95 * k, cx + s * unit * 0.30 * k, cy - unit * 1.15 * k);
          ctx.lineTo(cx + s * unit * 0.20, cy - unit * 0.62);
          ctx.closePath(); ctx.fill();
        });
        break;
      case 'wings':
        ctx.fillStyle = Art.alpha(Art.shade(gm.body, -20), 0.9);
        [-1, 1].forEach(function (s) {
          ctx.beginPath();
          ctx.moveTo(cx + s * unit * 0.15, cy - unit * 0.1);
          ctx.quadraticCurveTo(cx + s * unit * 0.95 * k, cy - unit * 0.55 * k, cx + s * unit * 1.15 * k, cy + unit * 0.05);
          ctx.quadraticCurveTo(cx + s * unit * 0.6, cy + unit * 0.15, cx + s * unit * 0.15, cy + unit * 0.35);
          ctx.closePath(); ctx.fill();
        });
        break;
      case 'tail':
        ctx.strokeStyle = Art.shade(gm.body, -25);
        ctx.lineWidth = Math.max(1, unit * 0.14 * k);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, cy + unit * 0.6);
        ctx.quadraticCurveTo(cx + unit * 0.5, cy + unit * 0.9, cx + unit * 0.85 * k, cy + unit * 1.25 * k);
        ctx.stroke();
        break;
      case 'carapace':
        ctx.fillStyle = Art.alpha(Art.shade(gm.body, -15), 0.85);
        ctx.beginPath();
        ctx.ellipse(cx, cy - unit * 0.05, unit * 0.55 * k, unit * 0.42 * k, 0, 0, Math.PI * 2);
        ctx.fill();
        Art.hatch(ctx, cx - unit * 0.5, cy - unit * 0.4, unit, unit * 0.7, { spacing: unit * 0.12, color: Art.alpha('#000000', 0.2) });
        break;
      case 'tentacles':
        ctx.strokeStyle = Art.shade(gm.body, -10);
        ctx.lineWidth = Math.max(1, unit * 0.06);
        ctx.lineCap = 'round';
        for (var i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * unit * 0.12, cy + unit * 0.3);
          ctx.quadraticCurveTo(cx + i * unit * 0.3, cy + unit * 0.8, cx + i * unit * 0.18, cy + unit * (1.1 * k));
          ctx.stroke();
        }
        break;
      case 'claws':
        ctx.fillStyle = '#e8e4da';
        [-1, 1].forEach(function (s) {
          for (var c = 0; c < 3; c++) {
            ctx.beginPath();
            ctx.moveTo(cx + s * unit * (0.3 + c * 0.05), cy + unit * 0.3);
            ctx.lineTo(cx + s * unit * (0.42 + c * 0.05) * k, cy + unit * 0.42 * k);
            ctx.lineTo(cx + s * unit * (0.26 + c * 0.05), cy + unit * 0.34);
            ctx.closePath(); ctx.fill();
          }
        });
        break;
      case 'mandibles':
        ctx.strokeStyle = Art.shade(gm.body, -40);
        ctx.lineWidth = Math.max(1, unit * 0.06 * k);
        [-1, 1].forEach(function (s) {
          ctx.beginPath();
          ctx.moveTo(cx + s * unit * 0.1, cy - unit * 0.3);
          ctx.quadraticCurveTo(cx + s * unit * 0.35 * k, cy - unit * 0.2, cx + s * unit * 0.3 * k, cy - unit * 0.02);
          ctx.stroke();
        });
        break;
      case 'glow':
        var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.9 * k);
        glow.addColorStop(0, Art.alpha(gm.accent, 0.55));
        glow.addColorStop(1, Art.alpha(gm.accent, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, unit * 0.9 * k, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'manyEyes':
        ctx.fillStyle = gm.eyeColor;
        for (var e = 0; e < 6; e++) {
          var a = rng.float(0, Math.PI * 2), rr = rng.float(0.1, 0.4) * unit;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * rr, cy - unit * 0.1 + Math.sin(a) * rr * 0.6, unit * 0.045, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'skeletal':
        ctx.strokeStyle = Art.alpha('#e8e4da', 0.85);
        ctx.lineWidth = Math.max(1, unit * 0.03);
        for (var r = -2; r <= 2; r++) {
          ctx.beginPath();
          ctx.moveTo(cx - unit * 0.3, cy + r * unit * 0.12);
          ctx.lineTo(cx + unit * 0.3, cy + r * unit * 0.12);
          ctx.stroke();
        }
        break;
      default:
        /* unrecognised feature strings (data may describe narrative-only
           traits like "alien-shape") are silently ignored: they still
           contribute to the silhouette via `visual.silhouette` and never
           throw. */
        break;
    }
  }

  var api = {
    drawCreature: drawCreature,
    genomeForMonster: genomeForMonster,
    setData: setData,
    SILHOUETTES: SILHOUETTES,
    SIZE_SCALE: SIZE_SCALE, SIZE_ORDER: SIZE_ORDER,
  };

  global.DND = global.DND || {};
  global.DND.Creature = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
