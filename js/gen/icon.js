/*
 * js/gen/icon.js — procedural item icons.
 *
 * No image assets: every weapon, piece of armour, potion and trinket is a
 * small set of geometric primitives keyed by `visual.iconShape`, tinted by
 * rarity (js/gen/art.js `RARITY_COLORS`), with an optional magical glow halo
 * when `visual.glow` is set. Icons are small and drawn often (inventory
 * grids, tooltips, tokens), so the atlas is built once per (shape, size,
 * genome) via `Art.cached` and reused.
 */
(function (global) {
  'use strict';

  var DND = global.DND = global.DND || {};
  var Art = DND.Art || (typeof require !== 'undefined' ? require('./art.js') : null);
  var RNG = DND.RNG || (typeof require !== 'undefined' ? require('../rng.js').RNG : null);

  var ICON_SHAPES = [
    'sword', 'axe', 'mace', 'bow', 'crossbow', 'staff', 'wand', 'dagger',
    'spear', 'potion', 'ring', 'amulet', 'armor', 'shield', 'helm', 'boots',
    'gloves', 'cloak', 'scroll', 'book', 'gem', 'coin', 'key', 'rope',
    'torch', 'food', 'tool', 'arrow', 'misc',
  ];

  var ITEM_DEFAULTS = { palette: ['#9b8b73', '#d5ccb9'], iconShape: 'misc', glow: false, rarity: 'common' };

  var _data = { ITEMS: {} };
  function setData(data) { data = data || {}; _data.ITEMS = data.ITEMS || _data.ITEMS || {}; }

  /**
   * Build a stable icon genome. `spec` may carry a `visual` block straight
   * from srd_items.js (`{palette, iconShape, glow}`) plus a `rarity` string;
   * anything missing falls back to ITEM_DEFAULTS.
   */
  function genomeForItem(seed, spec) {
    spec = spec || {};
    var real = spec.itemId && _data.ITEMS[spec.itemId];
    var visual = spec.visual || (real && real.visual) || ITEM_DEFAULTS;
    var shape = ICON_SHAPES.indexOf(visual.iconShape) >= 0 ? visual.iconShape : ITEM_DEFAULTS.iconShape;
    var rarity = spec.rarity || (real && real.rarity) || ITEM_DEFAULTS.rarity || 'common';
    var base = Art.makeGenome(seed, { visual: visual, kind: 'icon', scheme: 'complement' });
    var rng = new RNG(seed);
    var material = (visual.palette && visual.palette.length) ? rng.fork('material').pick(visual.palette) : base.primary;

    return {
      seed: base.seed,
      itemId: spec.itemId || null,
      shape: shape,
      rarity: normRarity(rarity),
      glow: !!(spec.glow != null ? spec.glow : visual.glow),
      material: material,
      trim: Art.shade(material, -35),
      variant: base.variant % 3,
    };
  }

  function normRarity(r) {
    r = String(r || 'common').toLowerCase();
    if (Art.RARITY_COLORS[r]) return r;
    if (r === 'very rare' || r === 'veryrare' || r === 'very_rare') return 'very rare';
    return 'common';
  }

  /* ------------------------------------------------------------- drawing -- */

  function drawIconRaw(ctx, gm, size, opts) {
    opts = opts || {};
    var s = size;
    var cx = s / 2, cy = s / 2;
    var rarityColor = Art.RARITY_COLORS[gm.rarity] || Art.RARITY_COLORS.common;
    var tint = Art.mix(gm.material, rarityColor, gm.rarity === 'common' ? 0 : 0.35);

    ctx.save();

    if (gm.glow) {
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.62);
      g.addColorStop(0, Art.alpha(rarityColor, 0.55));
      g.addColorStop(1, Art.alpha(rarityColor, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.62, 0, Math.PI * 2); ctx.fill();
    }

    /* rarity ring beneath the shape — a quiet, always-present tell even
       before the player reads the tooltip. */
    ctx.strokeStyle = Art.alpha(rarityColor, 0.55);
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.46, 0, Math.PI * 2); ctx.stroke();

    ICON_DRAW[gm.shape](ctx, cx, cy, s * 0.34, tint, gm);

    ctx.restore();
  }

  var ICON_DRAW = {
    sword: function (ctx, x, y, r, c) {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.15); ctx.lineTo(x + r * 0.5, y + r * 0.15); ctx.stroke();
      ctx.fillStyle = Art.shade(c, -30); ctx.fillRect(x - r * 0.08, y + r * 0.25, r * 0.16, r * 0.55);
    },
    axe: function (ctx, x, y, r, c) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x - r * 0.05, y - r * 0.1, r * 0.65, Math.PI * 0.9, Math.PI * 1.9);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = Art.shade(c, -50); ctx.lineWidth = r * 0.18;
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.4); ctx.lineTo(x, y + r); ctx.stroke();
    },
    mace: function (ctx, x, y, r, c) {
      ctx.strokeStyle = Art.shade(c, -40); ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.1); ctx.lineTo(x, y + r); ctx.stroke();
      ctx.fillStyle = c; Art.polygon(ctx, x, y - r * 0.5, r * 0.5, 6); ctx.fill();
    },
    bow: function (ctx, x, y, r, c) {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI * 0.35, Math.PI * 0.35); ctx.stroke();
      ctx.strokeStyle = Art.shade(c, 40); ctx.lineWidth = r * 0.05;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(-Math.PI * 0.35) * r, y + Math.sin(-Math.PI * 0.35) * r);
      ctx.lineTo(x + Math.cos(Math.PI * 0.35) * r, y + Math.sin(Math.PI * 0.35) * r);
      ctx.stroke();
    },
    crossbow: function (ctx, x, y, r, c) {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.2); ctx.lineTo(x + r, y - r * 0.2); ctx.stroke();
      ctx.strokeStyle = Art.shade(c, -30); ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.2); ctx.lineTo(x, y + r * 0.9); ctx.stroke();
    },
    staff: function (ctx, x, y, r, c) {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.13;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
      ctx.fillStyle = Art.shade(c, 40);
      ctx.beginPath(); ctx.arc(x, y - r, r * 0.22, 0, Math.PI * 2); ctx.fill();
    },
    wand: function (ctx, x, y, r, c) {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.6); ctx.lineTo(x + r * 0.5, y - r * 0.6); ctx.stroke();
      ctx.fillStyle = Art.shade(c, 50);
      ctx.beginPath(); ctx.arc(x + r * 0.5, y - r * 0.6, r * 0.14, 0, Math.PI * 2); ctx.fill();
    },
    dagger: function (ctx, x, y, r, c) {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.15; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.9); ctx.lineTo(x, y + r * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y + r * 0.1); ctx.lineTo(x + r * 0.3, y + r * 0.1); ctx.stroke();
    },
    spear: function (ctx, x, y, r, c) {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.1;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
      ctx.fillStyle = Art.shade(c, 30);
      Art.polygon(ctx, x, y - r * 0.9, r * 0.22, 3, -Math.PI / 2); ctx.fill();
    },
    potion: function (ctx, x, y, r, c) {
      ctx.fillStyle = '#c8d8e0';
      ctx.beginPath(); ctx.arc(x, y + r * 0.15, r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x, y + r * 0.3, r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = Art.shade(c, -40);
      ctx.fillRect(x - r * 0.12, y - r * 0.8, r * 0.24, r * 0.35);
    },
    ring: function (ctx, x, y, r, c) {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.28;
      ctx.beginPath(); ctx.arc(x, y + r * 0.1, r * 0.5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = Art.shade(c, 60);
      ctx.beginPath(); ctx.arc(x, y - r * 0.4, r * 0.16, 0, Math.PI * 2); ctx.fill();
    },
    amulet: function (ctx, x, y, r, c) {
      ctx.strokeStyle = Art.shade(c, -20); ctx.lineWidth = r * 0.08;
      ctx.beginPath(); ctx.arc(x, y - r * 0.6, r * 0.55, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      ctx.fillStyle = c;
      Art.polygon(ctx, x, y + r * 0.2, r * 0.4, 4); ctx.fill();
    },
    armor: function (ctx, x, y, r, c) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, y - r * 0.7); ctx.lineTo(x + r * 0.6, y - r * 0.7);
      ctx.lineTo(x + r * 0.45, y + r * 0.8); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.45, y + r * 0.8);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = Art.shade(c, -40); ctx.lineWidth = r * 0.05;
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.6); ctx.lineTo(x, y + r * 0.7); ctx.stroke();
    },
    shield: function (ctx, x, y, r, c) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.7, y - r * 0.6); ctx.lineTo(x + r * 0.6, y + r * 0.4);
      ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.6, y + r * 0.4); ctx.lineTo(x - r * 0.7, y - r * 0.6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = Art.shade(c, 40); ctx.lineWidth = r * 0.07;
      ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.stroke();
    },
    helm: function (ctx, x, y, r, c) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x, y - r * 0.05, r * 0.55, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillRect(x - r * 0.5, y - r * 0.05, r, r * 0.3);
      ctx.fillStyle = Art.shade(c, -50); ctx.fillRect(x - r * 0.28, y - r * 0.05, r * 0.56, r * 0.12);
    },
    boots: function (ctx, x, y, r, c) {
      ctx.fillStyle = c;
      [-1, 1].forEach(function (s) {
        ctx.beginPath();
        ctx.moveTo(x + s * r * 0.1, y - r * 0.7);
        ctx.lineTo(x + s * r * 0.35, y - r * 0.7);
        ctx.lineTo(x + s * r * 0.35, y + r * 0.5);
        ctx.lineTo(x + s * r * 0.6, y + r * 0.8);
        ctx.lineTo(x + s * r * 0.05, y + r * 0.8);
        ctx.closePath(); ctx.fill();
      });
    },
    gloves: function (ctx, x, y, r, c) {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.2, r * 0.45, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      for (var i = -2; i <= 2; i++) {
        ctx.fillRect(x + i * r * 0.16 - r * 0.05, y - r * 0.7, r * 0.1, r * 0.5);
      }
    },
    cloak: function (ctx, x, y, r, c) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.7, y + r * 0.9); ctx.lineTo(x - r * 0.7, y + r * 0.9);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = Art.shade(c, 40);
      ctx.beginPath(); ctx.arc(x, y - r * 0.85, r * 0.18, 0, Math.PI * 2); ctx.fill();
    },
    scroll: function (ctx, x, y, r, c) {
      ctx.fillStyle = '#e8e0c8'; ctx.fillRect(x - r * 0.55, y - r * 0.4, r * 1.1, r * 0.8);
      ctx.fillStyle = Art.shade('#e8e0c8', -40);
      ctx.beginPath(); ctx.ellipse(x - r * 0.55, y, r * 0.1, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + r * 0.55, y, r * 0.1, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.05;
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y - r * 0.1); ctx.lineTo(x + r * 0.3, y - r * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y + r * 0.1); ctx.lineTo(x + r * 0.15, y + r * 0.1); ctx.stroke();
    },
    book: function (ctx, x, y, r, c) {
      ctx.fillStyle = c; ctx.fillRect(x - r * 0.5, y - r * 0.65, r, r * 1.3);
      ctx.fillStyle = Art.shade(c, 50); ctx.fillRect(x - r * 0.4, y - r * 0.5, r * 0.8, r);
      ctx.strokeStyle = Art.shade(c, -40); ctx.lineWidth = r * 0.04;
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.5); ctx.lineTo(x, y + r * 0.5); ctx.stroke();
    },
    gem: function (ctx, x, y, r, c) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.6, y - r * 0.2); ctx.lineTo(x + r * 0.35, y + r * 0.8);
      ctx.lineTo(x - r * 0.35, y + r * 0.8); ctx.lineTo(x - r * 0.6, y - r * 0.2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = Art.alpha('#ffffff', 0.6); ctx.lineWidth = r * 0.05;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r * 0.8); ctx.stroke();
    },
    coin: function (ctx, x, y, r, c) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = Art.shade(c, -40); ctx.lineWidth = r * 0.06;
      ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, Math.PI * 2); ctx.stroke();
    },
    key: function (ctx, x, y, r, c) {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - r * 0.2, y - r * 0.7); ctx.lineTo(x - r * 0.2, y + r * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.75, r * 0.28, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.2, y + r * 0.4); ctx.lineTo(x + r * 0.15, y + r * 0.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.2, y + r * 0.65); ctx.lineTo(x + r * 0.1, y + r * 0.65); ctx.stroke();
    },
    rope: function (ctx, x, y, r, c) {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.16;
      ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 1.7); ctx.stroke();
      ctx.strokeStyle = Art.shade(c, -30); ctx.lineWidth = r * 0.06;
      ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 1.7); ctx.stroke();
    },
    torch: function (ctx, x, y, r, c) {
      ctx.fillStyle = Art.LEATHERS.brown; ctx.fillRect(x - r * 0.08, y - r * 0.1, r * 0.16, r * 0.9);
      ctx.fillStyle = c;
      Art.blob(ctx, x, y - r * 0.55, r * 0.32, 7, 0.35, new RNG(1)); ctx.fill();
      ctx.fillStyle = Art.shade(c, 40);
      Art.blob(ctx, x, y - r * 0.65, r * 0.18, 6, 0.3, new RNG(2)); ctx.fill();
    },
    food: function (ctx, x, y, r, c) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = Art.shade(c, -30); ctx.lineWidth = r * 0.05;
      ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.stroke();
    },
    tool: function (ctx, x, y, r, c) {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - r * 0.4, y + r * 0.6); ctx.lineTo(x + r * 0.4, y - r * 0.6); ctx.stroke();
      ctx.fillStyle = Art.shade(c, -30);
      ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.65, r * 0.22, 0, Math.PI * 2); ctx.fill();
    },
    arrow: function (ctx, x, y, r, c) {
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.1;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
      ctx.fillStyle = c;
      Art.polygon(ctx, x, y - r, r * 0.22, 3, -Math.PI / 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.6); ctx.lineTo(x - r * 0.2, y + r); ctx.lineTo(x, y + r * 0.85); ctx.lineTo(x + r * 0.2, y + r);
      ctx.closePath(); ctx.fill();
    },
    misc: function (ctx, x, y, r, c) {
      ctx.fillStyle = c;
      Art.polygon(ctx, x, y, r * 0.6, 6);
      ctx.fill();
    },
  };

  /**
   * Draw an item icon. Builds a cached offscreen atlas entry keyed by shape,
   * size, material and rarity, so repeated draws (inventory grids) are cheap
   * in the browser; in Node this just calls straight through every time.
   */
  function drawIcon(ctx, genome, size, opts) {
    opts = opts || {};
    var gm = genome || genomeForItem('fallback', {});
    var key = 'icon:' + gm.shape + ':' + size + ':' + gm.material + ':' + gm.rarity + ':' + (gm.glow ? 1 : 0);
    var paint = Art.cached(key, size, size, function (offCtx) { drawIconRaw(offCtx, gm, size, opts); });
    paint(ctx, opts.x || 0, opts.y || 0);
  }

  var api = {
    drawIcon: drawIcon,
    drawIconRaw: drawIconRaw,
    genomeForItem: genomeForItem,
    setData: setData,
    ICON_SHAPES: ICON_SHAPES,
  };

  global.DND = global.DND || {};
  global.DND.Icon = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
