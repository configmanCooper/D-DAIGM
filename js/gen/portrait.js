/*
 * js/gen/portrait.js — procedural player/NPC portraits.
 *
 * No image assets: every face is layered Canvas2D primitives driven by a
 * seeded genome built from SRD race/class `visual` blocks (or, absent that
 * data, small built-in fallback defaults so the whole pipeline still renders
 * with zero content loaded — see `setData`). Layer order is silhouette
 * first, detail last, exactly like js/gen/art.js's `cached()` offscreen
 * technique and the NegotiatorGame portrait reference: backdrop -> vignette
 * -> shoulders/armour -> neck -> head -> hair -> eyes/brow/mouth -> race
 * features -> class emblem.
 */
(function (global) {
  'use strict';

  var DND = global.DND = global.DND || {};
  var Art = DND.Art || (typeof require !== 'undefined' ? require('./art.js') : null);
  var RNG = DND.RNG || (typeof require !== 'undefined' ? require('../rng.js').RNG : null);

  /* ---------------------------------------------------------- fallback data -- */
  /* Used whenever the real SRD data files haven't loaded yet (or a race/class
     id is missing from what did load). Kept intentionally small: just enough
     per race/class to make every combination render distinctly. Real data
     (with richer `visual` blocks) always wins via setData(). */

  var RACE_DEFAULTS = {
    dwarf: { visual: { palette: ['#8a6a4a', '#c9a227', '#5c4632'], build: 'stocky', heightRange: [48, 56] }, faceShape: 'square', earType: 'round', feature: 'beard' },
    elf: { visual: { palette: ['#e8d9b5', '#d4b483', '#4a3f6b'], build: 'slender', heightRange: [60, 74] }, faceShape: 'long', earType: 'pointed', feature: 'ears' },
    halfling: { visual: { palette: ['#d99a5b', '#8b5e34', '#f0c987'], build: 'small', heightRange: [33, 40] }, faceShape: 'round', earType: 'round', feature: 'curls' },
    human: { visual: { palette: ['#c68863', '#e8b98a', '#8a5a3c'], build: 'average', heightRange: [58, 76] }, faceShape: 'oval', earType: 'round', feature: 'none' },
    dragonborn: { visual: { palette: ['#8a2020', '#c9a227', '#3a5a8a', '#2a6b3a', '#c0c0c0'], build: 'tall', heightRange: [72, 82] }, faceShape: 'angular', earType: 'none', feature: 'snout' },
    gnome: { visual: { palette: ['#c99a4a', '#8a6a3a', '#d4c4a0'], build: 'small', heightRange: [35, 42] }, faceShape: 'heart', earType: 'pointed', feature: 'nose' },
    halfElf: { visual: { palette: ['#d9b18a', '#e8d9b5', '#b58a5a'], build: 'lithe', heightRange: [57, 74] }, faceShape: 'oval', earType: 'slightly-pointed', feature: 'ears' },
    halfOrc: { visual: { palette: ['#7a8a6a', '#5a6a4a', '#8a9a7a'], build: 'towering', heightRange: [58, 79] }, faceShape: 'square', earType: 'pointed', feature: 'tusks' },
    tiefling: { visual: { palette: ['#8a2a2a', '#4a1a3a', '#2a1a1a'], build: 'lithe', heightRange: [57, 76] }, faceShape: 'angular', earType: 'pointed', feature: 'horns' },
  };
  var RACE_ORDER = ['dwarf', 'elf', 'halfling', 'human', 'dragonborn', 'gnome', 'halfElf', 'halfOrc', 'tiefling'];

  var CLASS_DEFAULTS = {
    barbarian: { visual: { palette: ['#7a3a2a', '#c9a227'], silhouette: 'fur' }, emblem: 'axe' },
    bard: { visual: { palette: ['#5a2a7a', '#c9a227'], silhouette: 'studded' }, emblem: 'star' },
    cleric: { visual: { palette: ['#e8d9a0', '#8a8478'], silhouette: 'chain' }, emblem: 'sun' },
    druid: { visual: { palette: ['#2a6b3a', '#6b4a2f'], silhouette: 'natural' }, emblem: 'leaf' },
    fighter: { visual: { palette: ['#c4cad2', '#8a2020'], silhouette: 'plate' }, emblem: 'sword' },
    monk: { visual: { palette: ['#b5602a', '#e8d9a0'], silhouette: 'wrap' }, emblem: 'circle' },
    paladin: { visual: { palette: ['#d4af37', '#e8e4da'], silhouette: 'plate' }, emblem: 'cross' },
    ranger: { visual: { palette: ['#2a6b3a', '#6b4a2f'], silhouette: 'leather' }, emblem: 'arrow' },
    rogue: { visual: { palette: ['#232323', '#5a2a7a'], silhouette: 'leather' }, emblem: 'dagger' },
    sorcerer: { visual: { palette: ['#8a2020', '#5a2a7a'], silhouette: 'robe' }, emblem: 'spark' },
    warlock: { visual: { palette: ['#452a6b', '#232323'], silhouette: 'robe' }, emblem: 'eye' },
    wizard: { visual: { palette: ['#2a4a7a', '#c4cad2'], silhouette: 'robe' }, emblem: 'star' },
  };
  var CLASS_ORDER = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'];

  var _data = { RACES: {}, CLASSES: {} };

  /** Inject real SRD data. Anything not present falls back to the built-in
      defaults above, so the module never depends on load order. */
  function setData(data) {
    data = data || {};
    _data.RACES = data.RACES || _data.RACES || {};
    _data.CLASSES = data.CLASSES || _data.CLASSES || {};
  }

  function raceSpec(raceId) {
    var real = _data.RACES && _data.RACES[raceId];
    var fallback = RACE_DEFAULTS[raceId] || RACE_DEFAULTS.human;
    return {
      visual: (real && real.visual) || fallback.visual,
      faceShape: fallback.faceShape,
      earType: fallback.earType,
      feature: fallback.feature,
    };
  }

  function classSpec(classId) {
    var real = _data.CLASSES && _data.CLASSES[classId];
    var fallback = CLASS_DEFAULTS[classId] || CLASS_DEFAULTS.fighter;
    var visual = (real && real.visual) || fallback.visual;
    return {
      visual: visual,
      silhouette: visual.silhouette || fallback.visual.silhouette,
      emblem: (real && real.visual && real.visual.emblem) || fallback.emblem,
    };
  }

  /* -------------------------------------------------------------- genome -- */

  var HAIR_STYLES = ['short', 'long', 'tied', 'swept', 'shaved', 'braided', 'curly'];
  var BROW_STYLES = ['level', 'arched', 'heavy', 'thin', 'angled'];
  var MOUTH_STYLES = ['neutral', 'thin', 'full', 'set'];

  /**
   * Build a stable genome from a seed plus character context. Same seed and
   * spec always produce the same genome (see js/gen/art.js `makeGenome`);
   * different seeds diverge because every random field is drawn from an RNG
   * forked off the seed by a distinct label.
   */
  function genomeForCharacter(seed, opts) {
    opts = opts || {};
    var raceId = opts.raceId || 'human';
    var classId = opts.classId || 'fighter';
    var rs = raceSpec(raceId);
    var cs = classSpec(classId);
    var visual = opts.visual || rs.visual || {};
    var base = Art.makeGenome(seed, { visual: visual, kind: 'portrait', scheme: 'analogous' });
    var rng = new RNG(seed);
    var skinPool = (visual.palette && visual.palette.length) ? visual.palette : Art.SKIN_TONES;

    var sex = opts.sex || rng.fork('sex').pick(['female', 'male']);
    var gm = {
      seed: base.seed,
      race: raceId,
      subrace: opts.subraceId || null,
      classId: classId,
      sex: sex,
      ageBand: opts.ageBand || 'adult',
      faceShape: rs.faceShape,
      earType: rs.earType,
      feature: rs.feature,
      skin: rng.fork('skin').pick(skinPool.length ? skinPool : Art.SKIN_TONES) || Art.SKIN_TONES[0],
      hair: rng.fork('hair').pick(Art.HAIR_COLORS),
      hairStyle: rng.fork('hairstyle').pick(HAIR_STYLES),
      eyes: Art.hsl(rng.fork('eyes').float(0, 360), rng.fork('eyes2').float(35, 65), rng.fork('eyes3').float(30, 45)),
      browStyle: rng.fork('brow').pick(BROW_STYLES),
      mouthStyle: rng.fork('mouth').pick(MOUTH_STYLES),
      lines: opts.ageBand === 'elder' ? rng.fork('lines').float(0.5, 1) : (opts.ageBand === 'young' ? 0 : rng.fork('lines').float(0, 0.35)),
      facialHair: (rs.feature === 'beard') ? 'full' : gmFacialHairChance(rng, sex),
      silhouette: cs.silhouette,
      emblem: cs.emblem,
      attireColor: (cs.visual.palette && cs.visual.palette[0]) || base.primary,
      attireAccent: (cs.visual.palette && cs.visual.palette[1]) || base.accent,
      accent: base.accent,
    };
    return gm;
  }

  function gmFacialHairChance(rng, sex) {
    if (sex === 'female') return 'none';
    var r = rng.fork('facialhair');
    return r.pick(['none', 'none', 'stubble', 'moustache', 'goatee', 'full']);
  }

  /* -------------------------------------------------------------- drawing -- */

  function drawPortrait(ctx, genome, w, h, opts) {
    opts = opts || {};
    var mood = Art.clamp(opts.mood == null ? 0 : opts.mood, -1, 1);
    var gm = genome || genomeForCharacter('fallback', {});
    ctx.save();

    var cx = w / 2, cy = h * 0.46;
    var fw = w * 0.30, fh = h * 0.32;

    /* backdrop gradient */
    Art.gradientFill(ctx, 0, 0, 0, h, [[0, Art.shade(gm.accent, -60)], [1, Art.shade(gm.accent, -90)]]);
    ctx.fillRect(0, 0, w, h);

    /* vignette ring */
    Art.vignette(ctx, w, h, { color: '#000000', strength: 0.45 });
    ctx.strokeStyle = Art.alpha(gm.attireAccent, 0.25);
    ctx.lineWidth = Math.max(1, w * 0.006);
    ctx.beginPath(); ctx.arc(cx, cy + h * 0.05, w * 0.42, 0, Math.PI * 2); ctx.stroke();

    /* shoulders / armour silhouette, chosen by class */
    drawShoulders(ctx, gm, cx, cy, w, h, fw, fh);

    /* neck */
    ctx.fillStyle = Art.shade(gm.skin, -22);
    ctx.fillRect(cx - fw * 0.28, cy + fh * 0.58, fw * 0.56, fh * 0.55);

    /* head shape, chosen by race */
    drawHead(ctx, gm, cx, cy, fw, fh);

    /* hair / headwear */
    drawHair(ctx, gm, cx, cy, fw, fh);

    /* eyes / brow / mouth, mood-driven */
    drawFace(ctx, gm, cx, cy, fw, fh, mood);

    /* race features */
    drawRaceFeatures(ctx, gm, cx, cy, fw, fh);

    /* class emblem */
    drawEmblem(ctx, gm, cx, cy + fh * 1.5, w, h);

    ctx.restore();
  }

  function drawShoulders(ctx, gm, cx, cy, w, h, fw, fh) {
    var shoulderY = cy + fh * 1.1;
    var sil = gm.silhouette || 'leather';
    ctx.fillStyle = gm.attireColor;
    ctx.beginPath();
    var spread = sil === 'plate' ? 0.50 : sil === 'fur' ? 0.48 : sil === 'chain' ? 0.44 : 0.40;
    ctx.moveTo(cx - w * spread, h);
    ctx.quadraticCurveTo(cx - w * spread * 0.7, shoulderY, cx, shoulderY - h * 0.01);
    ctx.quadraticCurveTo(cx + w * spread * 0.7, shoulderY, cx + w * spread, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = Art.shade(gm.attireColor, sil === 'plate' ? 35 : 18);
    if (sil === 'plate') {
      /* articulated pauldrons */
      [-1, 1].forEach(function (s) {
        ctx.beginPath();
        ctx.arc(cx + s * w * 0.30, shoulderY + h * 0.01, w * 0.09, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = gm.attireAccent;
      ctx.fillRect(cx - w * 0.03, shoulderY + h * 0.02, w * 0.06, (h - shoulderY) * 0.3);
    } else if (sil === 'fur') {
      ctx.save();
      ctx.fillStyle = Art.shade(gm.attireColor, 30);
      for (var i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * w * 0.05, shoulderY);
        ctx.lineTo(cx + i * w * 0.05 - w * 0.02, shoulderY + h * 0.05);
        ctx.lineTo(cx + i * w * 0.05 + w * 0.02, shoulderY + h * 0.05);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (sil === 'chain') {
      Art.hatch(ctx, cx - fw * 0.5, shoulderY, fw, h - shoulderY, { spacing: 4, color: Art.alpha('#000000', 0.25) });
    } else if (sil === 'robe' || sil === 'wrap') {
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.12, shoulderY); ctx.lineTo(cx, h);
      ctx.lineTo(cx + w * 0.12, shoulderY); ctx.closePath(); ctx.fill();
    } else if (sil === 'natural') {
      ctx.fillStyle = Art.shade(gm.attireColor, -10);
      ctx.beginPath(); ctx.arc(cx - w * 0.18, shoulderY + h * 0.05, w * 0.05, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + w * 0.18, shoulderY + h * 0.05, w * 0.05, 0, Math.PI * 2); ctx.fill();
    } else if (sil === 'studded') {
      var n = 5;
      for (var j = 0; j < n; j++) {
        ctx.beginPath();
        ctx.arc(cx - fw * 0.5 + fw * (j / (n - 1)), shoulderY + h * 0.03, w * 0.012, 0, Math.PI * 2);
        ctx.fill();
      }
    } else { /* leather, default */
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.13, shoulderY); ctx.lineTo(cx - w * 0.02, h);
      ctx.lineTo(cx - w * 0.20, h); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + w * 0.13, shoulderY); ctx.lineTo(cx + w * 0.02, h);
      ctx.lineTo(cx + w * 0.20, h); ctx.closePath(); ctx.fill();
    }
  }

  function drawHead(ctx, gm, cx, cy, fw, fh) {
    ctx.fillStyle = gm.skin;
    ctx.beginPath();
    switch (gm.faceShape) {
      case 'square':
        ctx.moveTo(cx - fw, cy - fh * 0.75);
        ctx.lineTo(cx + fw, cy - fh * 0.75);
        ctx.lineTo(cx + fw * 0.95, cy + fh * 0.72);
        ctx.quadraticCurveTo(cx, cy + fh * 1.02, cx - fw * 0.95, cy + fh * 0.72);
        ctx.closePath();
        break;
      case 'long':
        ctx.ellipse(cx, cy, fw * 0.84, fh * 1.16, 0, 0, Math.PI * 2);
        break;
      case 'round':
        ctx.ellipse(cx, cy, fw * 1.08, fh * 0.94, 0, 0, Math.PI * 2);
        break;
      case 'heart':
        ctx.moveTo(cx - fw, cy - fh * 0.55);
        ctx.quadraticCurveTo(cx, cy - fh * 1.05, cx + fw, cy - fh * 0.55);
        ctx.quadraticCurveTo(cx + fw * 0.75, cy + fh * 0.55, cx, cy + fh * 1.08);
        ctx.quadraticCurveTo(cx - fw * 0.75, cy + fh * 0.55, cx - fw, cy - fh * 0.55);
        ctx.closePath();
        break;
      case 'angular':
        ctx.moveTo(cx, cy - fh);
        ctx.lineTo(cx + fw, cy - fh * 0.22);
        ctx.lineTo(cx + fw * 0.6, cy + fh * 0.9);
        ctx.lineTo(cx - fw * 0.6, cy + fh * 0.9);
        ctx.lineTo(cx - fw, cy - fh * 0.22);
        ctx.closePath();
        break;
      default:
        ctx.ellipse(cx, cy, fw, fh, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function drawHair(ctx, gm, cx, cy, fw, fh) {
    if (gm.hairStyle === 'shaved' && gm.feature !== 'beard') return;
    ctx.fillStyle = gm.hair;
    var top = cy - fh * 1.02;
    ctx.beginPath();
    if (gm.hairStyle === 'long') {
      ctx.moveTo(cx - fw * 1.05, cy + fh * 0.75);
      ctx.quadraticCurveTo(cx - fw * 1.15, top, cx, top - fh * 0.05);
      ctx.quadraticCurveTo(cx + fw * 1.15, top, cx + fw * 1.05, cy + fh * 0.75);
      ctx.quadraticCurveTo(cx, cy - fh * 0.6, cx - fw * 1.05, cy + fh * 0.75);
    } else if (gm.hairStyle === 'tied') {
      ctx.ellipse(cx, cy - fh * 0.6, fw * 1.0, fh * 0.5, 0, Math.PI, 0);
    } else if (gm.hairStyle === 'swept') {
      ctx.moveTo(cx - fw * 1.0, cy - fh * 0.2);
      ctx.quadraticCurveTo(cx - fw * 0.7, top, cx + fw * 0.4, top + fh * 0.05);
      ctx.quadraticCurveTo(cx + fw * 1.0, top + fh * 0.2, cx + fw * 1.0, cy - fh * 0.1);
      ctx.quadraticCurveTo(cx + fw * 0.5, cy - fh * 0.55, cx - fw * 1.0, cy - fh * 0.2);
    } else if (gm.hairStyle === 'braided') {
      ctx.ellipse(cx, cy - fh * 0.5, fw * 1.02, fh * 0.55, 0, Math.PI, 0);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - fw * 0.06, cy - fh * 0.2);
      ctx.lineTo(cx + fw * 0.06, cy - fh * 0.2);
      ctx.lineTo(cx + fw * 0.06, cy + fh);
      ctx.lineTo(cx - fw * 0.06, cy + fh);
    } else if (gm.hairStyle === 'curly') {
      var n = 7;
      for (var i = 0; i < n; i++) {
        var a = Math.PI + (i / (n - 1)) * Math.PI;
        ctx.moveTo(cx + Math.cos(a) * fw * 1.0, cy - fh * 0.3 + Math.sin(a) * fh * 0.75);
        ctx.arc(cx + Math.cos(a) * fw * 1.0, cy - fh * 0.3 + Math.sin(a) * fh * 0.75, fw * 0.16, 0, Math.PI * 2);
      }
    } else { /* short */
      ctx.ellipse(cx, cy - fh * 0.5, fw * 1.03, fh * 0.55, 0, Math.PI, 0);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawFace(ctx, gm, cx, cy, fw, fh, mood) {
    var angry = mood < -0.25, pleased = mood > 0.3;

    /* brows */
    var browY = cy - fh * 0.24;
    var browW = fw * 0.34;
    ctx.strokeStyle = Art.shade(gm.hair, -18);
    ctx.lineWidth = Math.max(1.5, fh * (gm.browStyle === 'heavy' ? 0.12 : gm.browStyle === 'thin' ? 0.05 : 0.08));
    ctx.lineCap = 'round';
    [-1, 1].forEach(function (s) {
      var x0 = cx + s * fw * 0.20, x1 = cx + s * (fw * 0.20 + browW);
      var y0 = browY, y1 = browY;
      if (gm.browStyle === 'arched') y1 -= fh * 0.05;
      if (gm.browStyle === 'angled') y1 += fh * 0.04;
      if (angry) { y0 -= fh * 0.06; y1 += fh * 0.03; }
      if (pleased) { y0 += fh * 0.02; y1 -= fh * 0.04; }
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, y1 - fh * 0.05, x1, y1);
      ctx.stroke();
    });

    /* eyes */
    var eyeY = cy - fh * 0.04;
    [-1, 1].forEach(function (s) {
      var ex = cx + s * fw * 0.38;
      var eh = fh * 0.08 * (angry ? 0.75 : 1);
      ctx.fillStyle = '#f2ece2';
      ctx.beginPath(); ctx.ellipse(ex, eyeY, fw * 0.18, eh, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = gm.eyes;
      ctx.beginPath(); ctx.arc(ex, eyeY, Math.min(fw * 0.09, eh * 1.05), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0d0d10';
      ctx.beginPath(); ctx.arc(ex, eyeY, Math.min(fw * 0.04, eh * 0.5), 0, Math.PI * 2); ctx.fill();
    });

    /* nose */
    ctx.strokeStyle = Art.shade(gm.skin, -40);
    ctx.lineWidth = Math.max(1, fh * 0.028);
    ctx.beginPath();
    ctx.moveTo(cx - fw * 0.03, cy - fh * 0.02);
    ctx.lineTo(cx - fw * 0.08, cy + fh * 0.28);
    ctx.stroke();

    /* mouth — expression driven by mood */
    var mY = cy + fh * 0.55;
    var mW = fw * (gm.mouthStyle === 'thin' ? 0.28 : gm.mouthStyle === 'full' ? 0.40 : 0.34);
    var curve = mood * fh * 0.14;
    if (gm.mouthStyle === 'set') curve *= 0.5;
    ctx.strokeStyle = Art.shade(gm.skin, -70);
    ctx.lineWidth = Math.max(1.6, fh * (gm.mouthStyle === 'full' ? 0.07 : 0.045));
    ctx.beginPath();
    ctx.moveTo(cx - mW, mY);
    ctx.quadraticCurveTo(cx, mY + curve + fh * 0.05, cx + mW, mY);
    ctx.stroke();

    /* facial hair (independent of race beard feature, drawn under it) */
    if (gm.facialHair && gm.facialHair !== 'none' && gm.feature !== 'beard') {
      ctx.fillStyle = gm.hair;
      ctx.globalAlpha = gm.facialHair === 'stubble' ? 0.3 : 0.9;
      if (gm.facialHair === 'moustache') {
        ctx.beginPath(); ctx.ellipse(cx, mY - fh * 0.13, mW, fh * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      } else if (gm.facialHair === 'goatee') {
        ctx.beginPath(); ctx.ellipse(cx, mY + fh * 0.2, mW * 0.6, fh * 0.16, 0, 0, Math.PI * 2); ctx.fill();
      } else if (gm.facialHair === 'full') {
        ctx.beginPath();
        ctx.moveTo(cx - fw * 0.9, cy + fh * 0.15);
        ctx.quadraticCurveTo(cx, cy + fh * 1.15, cx + fw * 0.9, cy + fh * 0.15);
        ctx.quadraticCurveTo(cx, cy + fh * 0.6, cx - fw * 0.9, cy + fh * 0.15);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* age lines */
    if (gm.lines > 0.15) {
      ctx.strokeStyle = Art.alpha('#000000', 0.1 + gm.lines * 0.2);
      ctx.lineWidth = Math.max(1, fh * 0.016);
      [-1, 1].forEach(function (s) {
        ctx.beginPath();
        ctx.moveTo(cx + s * fw * 0.6, cy + fh * 0.28);
        ctx.quadraticCurveTo(cx + s * fw * 0.5, cy + fh * 0.5, cx + s * fw * 0.4, cy + fh * 0.6);
        ctx.stroke();
      });
    }
  }

  function drawRaceFeatures(ctx, gm, cx, cy, fw, fh) {
    switch (gm.feature) {
      case 'beard':
        ctx.fillStyle = gm.hair;
        ctx.beginPath();
        ctx.moveTo(cx - fw * 0.85, cy + fh * 0.1);
        ctx.quadraticCurveTo(cx, cy + fh * 1.55, cx + fw * 0.85, cy + fh * 0.1);
        ctx.quadraticCurveTo(cx, cy + fh * 0.7, cx - fw * 0.85, cy + fh * 0.1);
        ctx.fill();
        break;
      case 'ears':
        ctx.fillStyle = Art.shade(gm.skin, -8);
        [-1, 1].forEach(function (s) {
          ctx.beginPath();
          ctx.moveTo(cx + s * fw * 0.95, cy - fh * 0.15);
          ctx.lineTo(cx + s * fw * 1.35, cy - fh * 0.5);
          ctx.lineTo(cx + s * fw * 1.0, cy + fh * 0.05);
          ctx.closePath(); ctx.fill();
        });
        break;
      case 'horns':
        ctx.fillStyle = Art.shade(gm.hair, -30);
        [-1, 1].forEach(function (s) {
          ctx.beginPath();
          ctx.moveTo(cx + s * fw * 0.4, cy - fh * 0.85);
          ctx.quadraticCurveTo(cx + s * fw * 0.9, cy - fh * 1.4, cx + s * fw * 0.75, cy - fh * 1.7);
          ctx.lineTo(cx + s * fw * 0.55, cy - fh * 1.55);
          ctx.quadraticCurveTo(cx + s * fw * 0.6, cy - fh * 1.1, cx + s * fw * 0.25, cy - fh * 0.85);
          ctx.closePath(); ctx.fill();
        });
        break;
      case 'snout':
        ctx.fillStyle = Art.shade(gm.skin, -18);
        ctx.beginPath();
        ctx.moveTo(cx - fw * 0.3, cy + fh * 0.15);
        ctx.quadraticCurveTo(cx, cy + fh * 0.55, cx + fw * 0.3, cy + fh * 0.15);
        ctx.quadraticCurveTo(cx, cy + fh * 0.32, cx - fw * 0.3, cy + fh * 0.15);
        ctx.fill();
        ctx.fillStyle = Art.shade(gm.skin, -40);
        ctx.beginPath(); ctx.arc(cx - fw * 0.08, cy + fh * 0.32, fw * 0.03, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + fw * 0.08, cy + fh * 0.32, fw * 0.03, 0, Math.PI * 2); ctx.fill();
        break;
      case 'tusks':
        ctx.fillStyle = '#e8e4da';
        [-1, 1].forEach(function (s) {
          ctx.beginPath();
          ctx.moveTo(cx + s * fw * 0.18, cy + fh * 0.5);
          ctx.lineTo(cx + s * fw * 0.24, cy + fh * 0.7);
          ctx.lineTo(cx + s * fw * 0.12, cy + fh * 0.62);
          ctx.closePath(); ctx.fill();
        });
        break;
      case 'nose':
        ctx.fillStyle = Art.shade(gm.skin, -14);
        ctx.beginPath();
        ctx.ellipse(cx, cy + fh * 0.12, fw * 0.12, fh * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'curls':
        ctx.fillStyle = gm.hair;
        for (var i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(cx - fw * 0.9 + fw * 1.8 * (i / 4), cy - fh * 0.85, fw * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      default:
        break;
    }
  }

  var EMBLEM_DRAW = {
    sword: function (ctx, x, y, r, c) { ctx.strokeStyle = c; ctx.lineWidth = r * 0.22; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r * 0.6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r * 0.1); ctx.lineTo(x + r * 0.5, y + r * 0.1); ctx.stroke(); },
    axe: function (ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * 0.7, Math.PI * 0.2, Math.PI * 1.3); ctx.closePath(); ctx.fill(); },
    mace: function (ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 0.5, 0, Math.PI * 2); ctx.fill(); },
    sun: function (ctx, x, y, r, c) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = r * 0.1;
      for (var i = 0; i < 8; i++) {
        var a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
        ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
        ctx.stroke();
      }
    },
    leaf: function (ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, r * 0.35, r * 0.75, Math.PI / 4, 0, Math.PI * 2); ctx.fill(); },
    cross: function (ctx, x, y, r, c) { ctx.fillStyle = c; ctx.fillRect(x - r * 0.15, y - r * 0.7, r * 0.3, r * 1.4); ctx.fillRect(x - r * 0.5, y - r * 0.15, r, r * 0.3); },
    arrow: function (ctx, x, y, r, c) { ctx.strokeStyle = c; ctx.lineWidth = r * 0.15; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.moveTo(x - r * 0.4, y - r * 0.55); ctx.lineTo(x, y - r); ctx.lineTo(x + r * 0.4, y - r * 0.55); ctx.stroke(); },
    dagger: function (ctx, x, y, r, c) { ctx.strokeStyle = c; ctx.lineWidth = r * 0.18; ctx.beginPath(); ctx.moveTo(x, y - r * 0.8); ctx.lineTo(x, y + r * 0.6); ctx.stroke(); },
    spark: function (ctx, x, y, r, c) { ctx.fillStyle = c; Art.star(ctx, x, y, r * 0.7, r * 0.3, 5); ctx.fill(); },
    eye: function (ctx, x, y, r, c) { ctx.strokeStyle = c; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.ellipse(x, y, r * 0.7, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * 0.2, 0, Math.PI * 2); ctx.fill(); },
    star: function (ctx, x, y, r, c) { ctx.fillStyle = c; Art.star(ctx, x, y, r * 0.75, r * 0.32, 5); ctx.fill(); },
    circle: function (ctx, x, y, r, c) { ctx.strokeStyle = c; ctx.lineWidth = r * 0.14; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.stroke(); },
  };

  function drawEmblem(ctx, gm, x, y, w, h) {
    var r = Math.min(w, h) * 0.05;
    var fn = EMBLEM_DRAW[gm.emblem] || EMBLEM_DRAW.circle;
    ctx.save();
    fn(ctx, x, Math.min(y, h * 0.94), r, gm.attireAccent);
    ctx.restore();
  }

  var api = {
    drawPortrait: drawPortrait,
    genomeForCharacter: genomeForCharacter,
    setData: setData,
    RACE_DEFAULTS: RACE_DEFAULTS, CLASS_DEFAULTS: CLASS_DEFAULTS,
    RACE_ORDER: RACE_ORDER, CLASS_ORDER: CLASS_ORDER,
  };

  global.DND = global.DND || {};
  global.DND.Portrait = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
