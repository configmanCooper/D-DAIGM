/*
 * js/gen/art.js — shared procedural-art toolkit.
 *
 * Zero image assets. Every race, class, monster, item, scene and battle token
 * is drawn on a canvas from a seeded "genome" object built by the higher-level
 * gen/* modules. This file is the toolkit they all share: colour derivation
 * from one base hex, canvas primitive helpers, named palettes, and the
 * offscreen-canvas cache. Everything here must run identically whether a real
 * `CanvasRenderingContext2D` is supplied (browser) or a recording stub is
 * supplied (Node tests) — nothing here ever touches `document` except inside
 * `cached()`, and only after checking it exists.
 */
(function (global) {
  'use strict';

  var DND = global.DND = global.DND || {};
  var RNG = DND.RNG || (typeof require !== 'undefined' ? require('../rng.js').RNG : null);
  var hashString = DND.hashString || (RNG && RNG.hashString) ||
    (typeof require !== 'undefined' ? require('../rng.js').hashString : null);

  /* ------------------------------------------------------------- colour -- */

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function clamp255(v) { return clamp(Math.round(v), 0, 255); }

  /** Parse '#rgb' or '#rrggbb' (with or without '#') into {r,g,b}. Never
      throws on garbage input — falls back to mid-grey so a bad data string
      degrades to a visible-but-wrong colour instead of crashing a render. */
  function parseHex(hex) {
    var h = String(hex == null ? '#888888' : hex).trim();
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) h = '888888';
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
  }

  function toHex(r, g, b) {
    r = clamp255(r); g = clamp255(g); b = clamp255(b);
    var n = (r << 16) | (g << 8) | b;
    var s = n.toString(16);
    while (s.length < 6) s = '0' + s;
    return '#' + s;
  }

  /** The workhorse: every light/dark tone anywhere in this system is derived
      from one base colour by offsetting each channel by `amt` (can be
      negative) and clamping. Same input always gives the same output. */
  function shade(hex, amt) {
    var c = parseHex(hex);
    return toHex(c.r + amt, c.g + amt, c.b + amt);
  }

  /** Linear-interpolate between two hex colours; t in [0,1]. */
  function mix(hexA, hexB, t) {
    t = clamp(t == null ? 0.5 : t, 0, 1);
    var a = parseHex(hexA), b = parseHex(hexB);
    return toHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
  }

  /** Hex -> 'rgba(...)' string at the given alpha, for glows/washes/fog. */
  function alpha(hex, a) {
    var c = parseHex(hex);
    a = clamp(a == null ? 1 : a, 0, 1);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (Math.round(a * 1000) / 1000) + ')';
  }

  /** HSL (h in degrees, s/l in 0..100) -> hex. */
  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  /**
   * Build a small harmonious palette from a seeded RNG. Saturation and
   * lightness are clamped to a band that never comes out mud (too low sat)
   * or neon (too high) or unreadable (too dark/light).
   * scheme: 'triad' | 'complement' | 'analogous' | 'split'
   */
  function paletteFrom(rng, scheme) {
    rng = rng || new RNG(1);
    scheme = scheme || 'triad';
    var h0 = rng.float(0, 360);
    var s = rng.float(42, 70);
    var l = rng.float(36, 58);
    var hues;
    switch (scheme) {
      case 'complement': hues = [h0, h0 + 180]; break;
      case 'analogous': hues = [h0, h0 + 30, h0 - 30]; break;
      case 'split': hues = [h0, h0 + 150, h0 - 150]; break;
      case 'triad':
      default: hues = [h0, h0 + 120, h0 + 240];
    }
    return hues.map(function (h, i) {
      var ss = clamp(s - i * 3, 30, 78);
      var ll = clamp(l + (i === 0 ? 0 : (i % 2 ? 10 : -10)), 22, 74);
      return hsl(h, ss, ll);
    });
  }

  /* -------------------------------------------------------- named palettes -- */

  var SKIN_TONES = [
    '#ffe0bd', '#f1c27d', '#e0ac69', '#c68863', '#a9744f',
    '#8d5524', '#6b4226', '#4a2e1e', '#3a2417', '#e8c8a0',
  ];

  var HAIR_COLORS = [
    '#0b0b0d', '#241a14', '#3d2b1f', '#6b4a2f', '#8a5a2c',
    '#b5813a', '#d4a94a', '#e8d9a0', '#c9c9c9', '#f2f2f2',
    '#7a3a2a', '#5a3a7a', '#3a5a7a', '#3a7a5a',
  ];

  var METALS = {
    iron: '#7d828a', steel: '#c4cad2', darksteel: '#4a4d54',
    bronze: '#a97142', copper: '#b5723a', brass: '#c9a24a',
    gold: '#d4af37', silver: '#c8c8ce', mithral: '#dbe6ea',
    adamantine: '#2a2a33',
  };

  var LEATHERS = {
    tan: '#a97c50', brown: '#6b4a2f', dark: '#3d2b1f',
    black: '#231810', red: '#7a3b2e', oxblood: '#5a2020',
  };

  var CLOTH = {
    red: '#8a2020', crimson: '#6b1a2a', blue: '#2a4a7a', navy: '#1c2c47',
    green: '#2a6b3a', forest: '#1f4a2a', purple: '#5a2a7a', violet: '#452a6b',
    brown: '#6b4a2f', black: '#232323', white: '#e8e4da', grey: '#7a7a7a',
    gold: '#c9a227', teal: '#1f6b6b', orange: '#b5602a',
  };

  /* common -> legendary, grey -> orange, plus artifact past legendary. */
  var RARITY_COLORS = {
    common: '#9a9a9a', uncommon: '#3fae4a', rare: '#3f8fd6',
    'very rare': '#a768e0', veryRare: '#a768e0', legendary: '#e08a2e',
    artifact: '#e0483f',
  };

  var DAMAGE_COLORS = {
    fire: '#e0672e', cold: '#7fd6e0', acid: '#8fd63f', necrotic: '#4a2a52',
    radiant: '#f5e6a0', lightning: '#e0d63f', thunder: '#7a7ad6',
    poison: '#5a8a3a', psychic: '#c04fae', force: '#d6affa',
    bludgeoning: '#8a8a8a', piercing: '#b0b0b0', slashing: '#c0c0c0',
    untyped: '#9a9a9a',
  };

  /* Base ground/structure/accent colours per biome; scene.js layers its own
     bespoke silhouettes on top of these but every biome starts from here so
     recolouring the mood only ever means touching one table. */
  var BIOME_PALETTES = {
    marsh: { ground: '#3a4a34', structure: '#4a5a44', accent: '#8a9a5a', water: '#3a4a3f', fog: '#a8b8a0' },
    forest: { ground: '#2e4a2a', structure: '#1f3620', accent: '#5a8a3a', water: '#2a4a54', fog: '#c8d8c0' },
    mountain: { ground: '#6a6a70', structure: '#4a4a52', accent: '#dfe6ea', water: '#3a5a6a', fog: '#d8e0e6' },
    plains: { ground: '#8a9a4a', structure: '#6a7a3a', accent: '#d9c15a', water: '#3a6a8a', fog: '#e8e4c8' },
    coast: { ground: '#d9c896', structure: '#8a7a5a', accent: '#3a7a8a', water: '#2f6f88', fog: '#dce8ec' },
    town: { ground: '#8a7a68', structure: '#6b5a45', accent: '#b5602a', water: '#3a5a6a', fog: '#c8c0b0' },
    village: { ground: '#7a8a5a', structure: '#6b5a45', accent: '#c9a227', water: '#3a5a6a', fog: '#d0d8c0' },
    keep: { ground: '#5a5a62', structure: '#3a3a44', accent: '#8a2020', water: '#2a3a4a', fog: '#c0c4cc' },
    dungeon: { ground: '#2a2a30', structure: '#1a1a20', accent: '#4a6a7a', water: '#152025', fog: '#3a3a44' },
    crypt: { ground: '#2a2830', structure: '#1c1a22', accent: '#5a7a6a', water: '#141418', fog: '#4a4854' },
    cave: { ground: '#3a342e', structure: '#241f1a', accent: '#5a6a7a', water: '#1a2226', fog: '#2e2a28' },
    ruin: { ground: '#5a5648', structure: '#403c32', accent: '#7a8a5a', water: '#2a3a44', fog: '#c8c4b0' },
    road: { ground: '#8a7a5a', structure: '#6b5a45', accent: '#5a8a3a', water: '#3a5a6a', fog: '#d8d4c0' },
    river: { ground: '#5a6a4a', structure: '#4a5a44', accent: '#2f6f88', water: '#2a5a72', fog: '#c8d8dc' },
    abbey: { ground: '#8a8478', structure: '#6b6458', accent: '#c9a227', water: '#3a5a6a', fog: '#d8d4c8' },
    chapel: { ground: '#7a7468', structure: '#5b5448', accent: '#e8d9a0', water: '#3a5a6a', fog: '#d8d4c8' },
    interior: { ground: '#5a4a38', structure: '#3a2e22', accent: '#c9a227', water: '#3a5a6a', fog: '#d0c8b8' },
  };

  /* --------------------------------------------------------- primitives -- */

  /** Build (not fill/stroke) a rounded-rect path. `r` may be a number or
      {tl,tr,br,bl}. Caller fills/strokes afterward. */
  function roundRect(ctx, x, y, w, h, r) {
    if (r == null) r = Math.min(Math.abs(w), Math.abs(h)) * 0.18;
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    var tl = Math.min(r.tl, Math.abs(w) / 2, Math.abs(h) / 2);
    var tr = Math.min(r.tr, Math.abs(w) / 2, Math.abs(h) / 2);
    var br = Math.min(r.br, Math.abs(w) / 2, Math.abs(h) / 2);
    var bl = Math.min(r.bl, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h);
    ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl);
    ctx.arcTo(x, y, x + tl, y, tl);
    ctx.closePath();
    return ctx;
  }

  /** Build a regular polygon path, `sides` >= 3, apex up by default. */
  function polygon(ctx, cx, cy, radius, sides, rotation) {
    sides = Math.max(3, sides | 0);
    rotation = rotation == null ? -Math.PI / 2 : rotation;
    ctx.beginPath();
    for (var i = 0; i < sides; i++) {
      var a = rotation + i * (Math.PI * 2 / sides);
      var x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    return ctx;
  }

  /** Build a `points`-pointed star path. */
  function star(ctx, cx, cy, outerR, innerR, points, rotation) {
    points = Math.max(2, points | 0);
    rotation = rotation == null ? -Math.PI / 2 : rotation;
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var r = (i % 2 === 0) ? outerR : innerR;
      var a = rotation + i * (Math.PI / points);
      var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    return ctx;
  }

  /** Build an irregular rounded blob path — the basis of creature masses,
      clouds, foliage clumps and ink-blot heraldry. `rng` supplies the jitter
      so the same seed always yields the same silhouette. */
  function blob(ctx, x, y, r, points, irregularity, rng) {
    points = Math.max(5, points || 9);
    irregularity = irregularity == null ? 0.28 : irregularity;
    rng = rng || new RNG(1);
    var pts = [];
    for (var i = 0; i < points; i++) {
      var a = (i / points) * Math.PI * 2;
      var rr = r * (1 + rng.float(-1, 1) * irregularity);
      pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
    }
    ctx.beginPath();
    var first = { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2 };
    ctx.moveTo(first.x, first.y);
    for (var j = 0; j < pts.length; j++) {
      var p0 = pts[j], p1 = pts[(j + 1) % pts.length];
      var mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
      ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
    }
    ctx.closePath();
    return ctx;
  }

  /** Create + apply a linear gradient fillStyle across (x0,y0)-(x1,y1) from
      `stops` = [[offset, color], ...]. Returns the gradient object. */
  function gradientFill(ctx, x0, y0, x1, y1, stops) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    ctx.fillStyle = g;
    return g;
  }

  /** Radial darkening ring toward the edges of a w x h canvas — used on
      portraits, tokens and the scene light/colour grade. */
  function vignette(ctx, w, h, opts) {
    opts = opts || {};
    var strength = opts.strength == null ? 0.5 : opts.strength;
    var color = opts.color || '#000000';
    var inner = opts.inner == null ? Math.min(w, h) * 0.32 : opts.inner;
    var outer = opts.outer == null ? Math.max(w, h) * 0.75 : opts.outer;
    var g = ctx.createRadialGradient(w / 2, h / 2, Math.max(0, inner), w / 2, h / 2, Math.max(1, outer));
    g.addColorStop(0, alpha(color, 0));
    g.addColorStop(1, alpha(color, strength));
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /** Build a path with `pathFn(ctx)` then stroke it with colour/width,
      restoring prior stroke state afterward. */
  function outline(ctx, color, width, pathFn) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    pathFn(ctx);
    ctx.stroke();
    ctx.restore();
  }

  /** Run `drawFn(ctx)` with a drop shadow applied, then restore. */
  function dropShadow(ctx, color, blur, ox, oy, drawFn) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = ox || 0;
    ctx.shadowOffsetY = oy || 0;
    drawFn(ctx);
    ctx.restore();
  }

  /** Diagonal hatch-line texture clipped to a rectangle — cheap shading for
      armour, scales, wood grain, stone coursing. */
  function hatch(ctx, x, y, w, h, opts) {
    opts = opts || {};
    var spacing = opts.spacing || 6;
    var angle = opts.angle == null ? Math.PI / 4 : opts.angle;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = opts.color || 'rgba(0,0,0,0.22)';
    ctx.lineWidth = opts.lineWidth || 1;
    var cx = x + w / 2, cy = y + h / 2;
    var diag = Math.sqrt(w * w + h * h);
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    for (var i = -diag; i < diag; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(i, -diag);
      ctx.lineTo(i, diag);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------- caching -- */

  var _cache = {};

  function hasCanvas() {
    return typeof document !== 'undefined' && typeof document.createElement === 'function';
  }

  /**
   * Draw once into an offscreen w x h canvas keyed by `key`, and reuse it on
   * every subsequent call — cheap for item-icon atlases and repeated tokens.
   * Returns a `paint(ctx, x, y)` function. In Node (no `document`) there is
   * nothing to cache into, so it degrades gracefully to just calling
   * `drawFn(ctx, w, h)` translated to (x,y) every time: correct output,
   * no crash, no benefit — exactly the tradeoff of not having a canvas.
   */
  function cached(key, w, h, drawFn) {
    return function paint(ctx, x, y) {
      x = x || 0; y = y || 0;
      if (hasCanvas()) {
        var entry = _cache[key];
        if (!entry || entry.w !== w || entry.h !== h) {
          var off = document.createElement('canvas');
          off.width = w; off.height = h;
          var octx = off.getContext('2d');
          drawFn(octx, w, h);
          entry = _cache[key] = { canvas: off, w: w, h: h };
        }
        ctx.drawImage(entry.canvas, x, y);
      } else {
        ctx.save();
        ctx.translate(x, y);
        drawFn(ctx, w, h);
        ctx.restore();
      }
    };
  }

  /** Drop everything cached — tests use this so caches from one seed cannot
      leak visual state into a differently-seeded assertion. */
  function clearCache() { _cache = {}; }

  /* -------------------------------------------------------------- genome -- */

  /**
   * Build the common substrate every genome starts from: a deterministic
   * palette (from `spec.visual.palette` if the data supplied one, else
   * derived from the seed) plus a few generic derived fields. Domain modules
   * (Portrait/Creature/Icon/Scene/Tokens) layer their own seeded fields on
   * top of this using their own forked RNG streams — see each module's
   * `genomeForX`. The return value is plain, JSON-serialisable data (no
   * functions, no RNG instance) so genomes remain diffable and replayable.
   */
  function makeGenome(seed, spec) {
    spec = spec || {};
    var visual = spec.visual || {};
    var rng = new RNG(seed);
    var scheme = spec.scheme || visual.scheme || 'triad';
    var basePalette = (visual.palette && visual.palette.length) ? visual.palette.slice()
      : paletteFrom(rng.fork('palette'), scheme);
    var seedNum = (typeof seed === 'number') ? (seed >>> 0) : hashString(String(seed));
    return {
      seed: seedNum,
      kind: spec.kind || 'generic',
      palette: basePalette,
      primary: basePalette[0],
      secondary: basePalette[1] || shade(basePalette[0], -28),
      accent: basePalette[2] || shade(basePalette[0], 42),
      variant: rng.int(0, 9999),
      detail: rng.float(0, 1),
      flip: rng.chance(0.5),
    };
  }

  var api = {
    shade: shade, mix: mix, alpha: alpha, hsl: hsl, paletteFrom: paletteFrom,
    SKIN_TONES: SKIN_TONES, HAIR_COLORS: HAIR_COLORS, METALS: METALS,
    LEATHERS: LEATHERS, CLOTH: CLOTH, RARITY_COLORS: RARITY_COLORS,
    DAMAGE_COLORS: DAMAGE_COLORS, BIOME_PALETTES: BIOME_PALETTES,
    roundRect: roundRect, polygon: polygon, star: star, blob: blob,
    gradientFill: gradientFill, vignette: vignette, outline: outline,
    dropShadow: dropShadow, hatch: hatch,
    cached: cached, clearCache: clearCache, hasCanvas: hasCanvas,
    makeGenome: makeGenome, clamp: clamp,
  };

  global.DND = global.DND || {};
  global.DND.Art = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
