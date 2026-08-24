/*
 * js/gen/scene.js — procedural environment backdrops.
 *
 * No image assets: every location is layered parallax bands drawn from a
 * seeded genome — sky gradient, celestial body, far horizon silhouette, mid
 * terrain, near foreground, a weather overlay, then a light/colour grade
 * pass. Driven entirely by {biome, timeOfDay, weather}, which is exactly the
 * vocabulary the Shen Cooper campaign needs (`marsh` + `dusk` + `fog` for the
 * Glass Fen; `abbey`/`chapel` for its cloister scenes), so those two get the
 * most attention below.
 */
(function (global) {
  'use strict';

  var DND = global.DND = global.DND || {};
  var Art = DND.Art || (typeof require !== 'undefined' ? require('./art.js') : null);
  var RNG = DND.RNG || (typeof require !== 'undefined' ? require('../rng.js').RNG : null);

  var BIOMES = [
    'marsh', 'forest', 'mountain', 'plains', 'coast', 'town', 'village',
    'keep', 'dungeon', 'crypt', 'cave', 'ruin', 'road', 'river', 'abbey',
    'chapel', 'interior',
  ];
  var TIMES_OF_DAY = ['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night'];
  var WEATHERS = ['clear', 'overcast', 'rain', 'storm', 'fog', 'snow'];

  /* Sky gradient (top -> bottom), celestial colour + a rough sky position
     (0 = horizon, 1 = zenith), and an ambient grade tint applied last. */
  var SKY = {
    dawn: { stops: ['#2a2a4a', '#6a4a5a', '#e08a6a'], sun: '#ffcf8a', pos: 0.18, grade: '#ff9a6a', gradeAmt: 0.10, stars: 0.15 },
    morning: { stops: ['#3a6ea8', '#8ec6dc', '#eaf3e0'], sun: '#fff2c0', pos: 0.55, grade: '#fff2c0', gradeAmt: 0.05, stars: 0 },
    noon: { stops: ['#2f7bc4', '#a9d8ec'], sun: '#ffffff', pos: 0.85, grade: '#ffffff', gradeAmt: 0.02, stars: 0 },
    afternoon: { stops: ['#3f78b0', '#d7c98a'], sun: '#ffe9a0', pos: 0.6, grade: '#ffcf6a', gradeAmt: 0.06, stars: 0 },
    dusk: { stops: ['#241a3a', '#5a3a52', '#c96a4a'], sun: '#e0673a', pos: 0.14, grade: '#7a3a5a', gradeAmt: 0.16, stars: 0.35 },
    night: { stops: ['#050512', '#101830', '#1c2840'], sun: '#dfe6ff', pos: 0.7, grade: '#0a0e22', gradeAmt: 0.22, stars: 0.95 },
  };

  var WEATHER_DEFAULTS = { clear: {}, overcast: {}, rain: {}, storm: {}, fog: {}, snow: {} };

  var _data = {};
  function setData(data) { _data = data || {}; }

  /* ------------------------------------------------------------- genome -- */

  function genomeForScene(seed, opts) {
    opts = opts || {};
    var biome = BIOMES.indexOf(opts.biome) >= 0 ? opts.biome : 'plains';
    var timeOfDay = TIMES_OF_DAY.indexOf(opts.timeOfDay) >= 0 ? opts.timeOfDay : 'noon';
    var weather = WEATHERS.indexOf(opts.weather) >= 0 ? opts.weather : 'clear';
    var bp = Art.BIOME_PALETTES[biome] || Art.BIOME_PALETTES.plains;
    var base = Art.makeGenome(seed, { visual: { palette: [bp.ground, bp.structure, bp.accent] }, kind: 'scene', scheme: 'analogous' });
    var rng = new RNG(seed);

    return {
      seed: base.seed,
      biome: biome, timeOfDay: timeOfDay, weather: weather,
      ground: bp.ground, structure: bp.structure, accent: bp.accent,
      water: bp.water, fogColor: bp.fog,
      horizonJitter: rng.fork('horizon').int(0, 1e9),
      foliageDensity: rng.fork('foliage').int(9, 16),
      buildingCount: rng.fork('buildings').int(4, 8),
      windowLit: rng.fork('windows').float(0.3, 0.8),
      starSeed: rng.fork('stars').int(0, 1e9),
      rainSeed: rng.fork('rainfall').int(0, 1e9),
    };
  }

  /* ------------------------------------------------------------- drawing -- */

  function drawScene(ctx, genome, w, h, opts) {
    opts = opts || {};
    /* Merge over a complete genome rather than trusting the caller's.
       A partial genome (or one built by the generic Art.makeGenome) leaves
       fields like fogColor undefined, which reaches addColorStop as the string
       "undefined" and throws in a real canvas — the Node stub happily accepted
       it, so this only ever showed up in a browser. A drawing function should
       degrade, never throw. */
    var base = genomeForScene((genome && genome.seed) || (opts && opts.seed) || 'fallback', {
      biome: (genome && genome.biome) || opts.biome,
      timeOfDay: (genome && genome.timeOfDay) || opts.timeOfDay,
      weather: (genome && genome.weather) || opts.weather,
    });
    var gm = genome ? Object.assign({}, base, stripUndefined(genome)) : base;
    if (opts.biome) gm.biome = opts.biome;
    if (opts.timeOfDay) gm.timeOfDay = opts.timeOfDay;
    if (opts.weather) gm.weather = opts.weather;
    var sky = SKY[gm.timeOfDay] || SKY.noon;
    var horizonY = h * 0.62;

    ctx.save();

    drawSky(ctx, gm, sky, w, h, horizonY);
    drawCelestialBody(ctx, gm, sky, w, h, horizonY);
    drawFarHorizon(ctx, gm, w, h, horizonY);
    drawMidTerrain(ctx, gm, w, h, horizonY);
    drawForeground(ctx, gm, w, h, horizonY);
    drawWeather(ctx, gm, w, h);
    drawGrade(ctx, gm, sky, w, h);

    ctx.restore();
  }

  /* A key present but undefined must not shadow a good default. */
  function stripUndefined(obj) {
    var out = {};
    Object.keys(obj || {}).forEach(function (k) {
      if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
    });
    return out;
  }

  function drawSky(ctx, gm, sky, w, h, horizonY) {
    var stops = sky.stops.map(function (c, i) { return [i / (sky.stops.length - 1), c]; });
    Art.gradientFill(ctx, 0, 0, 0, horizonY, stops);
    ctx.fillRect(0, 0, w, horizonY);

    if (sky.stars > 0) {
      var rng = new RNG(gm.starSeed);
      var n = Math.round(60 * sky.stars);
      ctx.fillStyle = Art.alpha('#ffffff', 0.85);
      for (var i = 0; i < n; i++) {
        var x = rng.float(0, w), y = rng.float(0, horizonY * 0.9);
        var r = rng.float(0.5, 1.6);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawCelestialBody(ctx, gm, sky, w, h, horizonY) {
    var cx = w * 0.76, cy = horizonY - horizonY * sky.pos;
    var r = Math.min(w, h) * (gm.timeOfDay === 'night' ? 0.05 : 0.07);
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3.2);
    g.addColorStop(0, Art.alpha(sky.sun, 0.55));
    g.addColorStop(1, Art.alpha(sky.sun, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = sky.sun;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    if (gm.timeOfDay === 'night') {
      /* a crescent bite for the moon */
      ctx.fillStyle = Art.shade(SKY.night.stops[0], -4);
      ctx.beginPath(); ctx.arc(cx + r * 0.4, cy - r * 0.15, r * 0.85, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* Distant silhouette band: shape depends on biome, colour is `structure`
     darkened toward the horizon haze. Interiors have no horizon at all. */
  function drawFarHorizon(ctx, gm, w, h, horizonY) {
    if (gm.biome === 'interior') return;
    var rng = new RNG(gm.horizonJitter);
    ctx.fillStyle = Art.mix(gm.structure, gm.fogColor, 0.35);
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    var segments = 14;
    for (var i = 0; i <= segments; i++) {
      var x = (i / segments) * w;
      var amp = horizonY * 0.16;
      var y;
      switch (gm.biome) {
        case 'mountain': y = horizonY - amp * (1.4 + Math.sin(i * 1.3 + rng.float(0, 1)) * 1.1); break;
        case 'forest': case 'ruin': case 'road': y = horizonY - amp * (0.5 + rng.float(0, 0.6)); break;
        case 'town': case 'village': case 'keep': case 'abbey': case 'chapel': y = horizonY - amp * (0.3 + (i % 3 === 0 ? 0.9 : 0.25)); break;
        case 'coast': case 'river': y = horizonY - amp * 0.05; break;
        default: y = horizonY - amp * (0.15 + rng.float(0, 0.35));
      }
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();
  }

  function drawMidTerrain(ctx, gm, w, h, horizonY) {
    if (gm.biome === 'interior') {
      /* wooden floor/wall interior "terrain" */
      Art.gradientFill(ctx, 0, 0, 0, h, [[0, Art.shade(gm.structure, 10)], [1, Art.shade(gm.structure, -20)]]);
      ctx.fillRect(0, 0, w, horizonY);
      ctx.fillStyle = gm.ground;
      ctx.fillRect(0, horizonY, w, h - horizonY);
      Art.hatch(ctx, 0, horizonY, w, h - horizonY, { spacing: w * 0.03, angle: 0, color: Art.alpha('#000000', 0.12) });
      return;
    }
    var isWater = gm.biome === 'river' || gm.biome === 'coast';
    Art.gradientFill(ctx, 0, horizonY, 0, h, [[0, gm.ground], [1, Art.shade(gm.ground, -18)]]);
    ctx.fillRect(0, horizonY, w, h - horizonY);
    if (isWater) {
      ctx.fillStyle = Art.alpha(gm.water, 0.55);
      ctx.fillRect(0, horizonY, w, (h - horizonY) * 0.7);
      ctx.strokeStyle = Art.alpha('#ffffff', 0.18);
      ctx.lineWidth = Math.max(1, h * 0.004);
      for (var i = 0; i < 5; i++) {
        var y = horizonY + (h - horizonY) * (0.15 + i * 0.12);
        ctx.beginPath(); ctx.moveTo(w * 0.1, y); ctx.lineTo(w * 0.9, y + h * 0.01); ctx.stroke();
      }
    }
    if (gm.biome === 'marsh') {
      ctx.fillStyle = Art.alpha(gm.water, 0.4);
      for (var m = 0; m < 4; m++) {
        ctx.beginPath();
        ctx.ellipse(w * (0.15 + m * 0.22), horizonY + (h - horizonY) * (0.35 + m * 0.1), w * 0.14, h * 0.03, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawForeground(ctx, gm, w, h, horizonY) {
    var rng = new RNG(gm.seed);
    switch (gm.biome) {
      case 'marsh': drawReeds(ctx, gm, w, h, horizonY, rng); break;
      case 'forest': drawTrees(ctx, gm, w, h, horizonY, rng, 6); break;
      case 'mountain': case 'cave': drawRocks(ctx, gm, w, h, horizonY, rng); break;
      case 'plains': case 'road': drawGrasses(ctx, gm, w, h, horizonY, rng); break;
      case 'coast': case 'river': drawShore(ctx, gm, w, h, horizonY, rng); break;
      case 'town': case 'village': drawBuildings(ctx, gm, w, h, horizonY, rng, false); break;
      case 'keep': drawBuildings(ctx, gm, w, h, horizonY, rng, true); break;
      case 'abbey': case 'chapel': drawAbbey(ctx, gm, w, h, horizonY, rng); break;
      case 'dungeon': case 'crypt': case 'ruin': drawRuins(ctx, gm, w, h, horizonY, rng); break;
      case 'interior': drawInteriorProps(ctx, gm, w, h, horizonY, rng); break;
      default: drawGrasses(ctx, gm, w, h, horizonY, rng);
    }
  }

  function drawReeds(ctx, gm, w, h, horizonY, rng) {
    ctx.strokeStyle = Art.shade(gm.accent, -10);
    ctx.lineWidth = Math.max(1, w * 0.004);
    var n = gm.foliageDensity;
    for (var i = 0; i < n; i++) {
      var x = rng.float(0, w);
      var baseY = horizonY + rng.float(0.1, 0.9) * (h - horizonY);
      var reedH = h * rng.float(0.06, 0.16);
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + reedH * 0.15, baseY - reedH * 0.6, x + reedH * 0.05, baseY - reedH);
      ctx.stroke();
    }
  }

  function drawTrees(ctx, gm, w, h, horizonY, rng, count) {
    for (var i = 0; i < count; i++) {
      var x = (i + 0.5) / count * w + rng.float(-w * 0.03, w * 0.03);
      var baseY = h - (h - horizonY) * rng.float(0, 0.3);
      var trunkH = h * rng.float(0.12, 0.22);
      ctx.strokeStyle = Art.shade(gm.structure, -20);
      ctx.lineWidth = Math.max(2, w * 0.01);
      ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, baseY - trunkH); ctx.stroke();
      ctx.fillStyle = gm.accent;
      Art.blob(ctx, x, baseY - trunkH - trunkH * 0.35, trunkH * 0.55, 9, 0.3, rng);
      ctx.fill();
    }
  }

  function drawRocks(ctx, gm, w, h, horizonY, rng) {
    for (var i = 0; i < 5; i++) {
      var x = rng.float(0, w), baseY = h - (h - horizonY) * rng.float(0, 0.4);
      var r = Math.min(w, h) * rng.float(0.05, 0.12);
      ctx.fillStyle = Art.shade(gm.structure, rng.int(-15, 15));
      Art.polygon(ctx, x, baseY - r * 0.4, r, 5 + (i % 3));
      ctx.fill();
    }
  }

  function drawGrasses(ctx, gm, w, h, horizonY, rng) {
    ctx.strokeStyle = Art.shade(gm.accent, -8);
    ctx.lineWidth = Math.max(1, w * 0.003);
    var n = gm.foliageDensity;
    for (var i = 0; i < n; i++) {
      var x = rng.float(0, w), baseY = horizonY + rng.float(0.15, 0.95) * (h - horizonY);
      var bh = h * rng.float(0.02, 0.06);
      ctx.beginPath();
      ctx.moveTo(x, baseY); ctx.lineTo(x + bh * 0.3, baseY - bh); ctx.stroke();
    }
  }

  function drawShore(ctx, gm, w, h, horizonY, rng) {
    ctx.fillStyle = Art.alpha('#ffffff', 0.35);
    for (var i = 0; i < 4; i++) {
      var y = horizonY + (h - horizonY) * (0.1 + i * 0.08);
      ctx.beginPath(); ctx.ellipse(w * rng.float(0.2, 0.8), y, w * 0.12, h * 0.008, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBuildings(ctx, gm, w, h, horizonY, rng, fortified) {
    var n = gm.buildingCount;
    for (var i = 0; i < n; i++) {
      var bw = w / n;
      var x = i * bw + bw * 0.1;
      var bh = h * rng.float(0.1, fortified ? 0.32 : 0.2);
      var y = horizonY - bh + h * 0.02;
      ctx.fillStyle = Art.shade(gm.structure, rng.int(-10, 10));
      ctx.fillRect(x, y, bw * 0.8, bh);
      /* roof */
      ctx.fillStyle = Art.shade(gm.accent, -10);
      ctx.beginPath();
      ctx.moveTo(x - bw * 0.05, y);
      ctx.lineTo(x + bw * 0.4, y - bh * 0.35);
      ctx.lineTo(x + bw * 0.85, y);
      ctx.closePath(); ctx.fill();
      if (rng.chance(gm.windowLit)) {
        ctx.fillStyle = Art.alpha('#ffdf8a', 0.85);
        ctx.fillRect(x + bw * 0.3, y + bh * 0.35, bw * 0.18, bh * 0.18);
      }
    }
  }

  /* Stone facade with an arched door and a rose/stained-glass window — the
     Shen Cooper campaign leans on abbey/chapel scenes so this one gets real
     detail rather than reusing the generic building silhouette. */
  function drawAbbey(ctx, gm, w, h, horizonY, rng) {
    var bw = w * 0.6, x = (w - bw) / 2;
    var bh = h * 0.42, y = horizonY - bh + h * 0.02;
    ctx.fillStyle = Art.shade(gm.structure, 6);
    ctx.fillRect(x, y, bw, bh);
    /* buttresses */
    ctx.fillStyle = Art.shade(gm.structure, -14);
    for (var i = 0; i <= 4; i++) {
      ctx.fillRect(x + (bw / 4) * i - bw * 0.015, y, bw * 0.03, bh);
    }
    /* peaked roof */
    ctx.fillStyle = Art.shade(gm.structure, -25);
    ctx.beginPath();
    ctx.moveTo(x - bw * 0.05, y);
    ctx.lineTo(x + bw * 0.5, y - bh * 0.3);
    ctx.lineTo(x + bw * 1.05, y);
    ctx.closePath(); ctx.fill();
    /* rose window */
    ctx.strokeStyle = gm.accent; ctx.lineWidth = Math.max(1, bw * 0.01);
    ctx.beginPath(); ctx.arc(x + bw * 0.5, y + bh * 0.32, bw * 0.09, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = Art.alpha(gm.accent, gm.timeOfDay === 'night' ? 0.35 : 0.6);
    ctx.beginPath(); ctx.arc(x + bw * 0.5, y + bh * 0.32, bw * 0.075, 0, Math.PI * 2); ctx.fill();
    /* arched door */
    ctx.fillStyle = Art.shade(gm.structure, -40);
    ctx.beginPath();
    ctx.moveTo(x + bw * 0.42, y + bh);
    ctx.lineTo(x + bw * 0.42, y + bh * 0.72);
    ctx.arc(x + bw * 0.5, y + bh * 0.72, bw * 0.08, Math.PI, 0);
    ctx.lineTo(x + bw * 0.58, y + bh);
    ctx.closePath(); ctx.fill();
    /* spire, only for chapel — abbeys read wider/lower, chapels tall/narrow */
    if (gm.biome === 'chapel') {
      ctx.fillStyle = Art.shade(gm.structure, -20);
      ctx.beginPath();
      ctx.moveTo(x + bw * 0.5 - bw * 0.05, y - bh * 0.3);
      ctx.lineTo(x + bw * 0.5, y - bh * 0.65);
      ctx.lineTo(x + bw * 0.5 + bw * 0.05, y - bh * 0.3);
      ctx.closePath(); ctx.fill();
    }
  }

  function drawRuins(ctx, gm, w, h, horizonY, rng) {
    for (var i = 0; i < 5; i++) {
      var x = rng.float(0.05, 0.95) * w;
      var bh = h * rng.float(0.06, 0.18);
      var bw = w * rng.float(0.03, 0.07);
      ctx.fillStyle = Art.shade(gm.structure, rng.int(-20, 10));
      ctx.save();
      ctx.translate(x, h - bh * 0.5);
      ctx.rotate(rng.float(-0.15, 0.15));
      ctx.fillRect(-bw / 2, -bh, bw, bh);
      ctx.restore();
    }
  }

  function drawInteriorProps(ctx, gm, w, h, horizonY, rng) {
    /* a simple table/hearth silhouette so interiors don't read as empty */
    ctx.fillStyle = Art.shade(gm.structure, -30);
    ctx.fillRect(w * 0.3, h * 0.72, w * 0.4, h * 0.05);
    ctx.fillRect(w * 0.32, h * 0.77, w * 0.03, h * 0.15);
    ctx.fillRect(w * 0.65, h * 0.77, w * 0.03, h * 0.15);
  }

  /* --------------------------------------------------------------- weather -- */

  function drawWeather(ctx, gm, w, h) {
    var rng = new RNG(gm.rainSeed);
    switch (gm.weather) {
      case 'overcast':
        ctx.fillStyle = Art.alpha('#9aa0a8', 0.28);
        ctx.fillRect(0, 0, w, h);
        break;
      case 'rain':
        ctx.fillStyle = Art.alpha('#8aa0b8', 0.18);
        ctx.fillRect(0, 0, w, h);
        drawRainStreaks(ctx, w, h, rng, 90, 0.35);
        break;
      case 'storm':
        ctx.fillStyle = Art.alpha('#20242e', 0.4);
        ctx.fillRect(0, 0, w, h);
        drawRainStreaks(ctx, w, h, rng, 150, 0.5);
        if (rng.chance(0.5)) {
          ctx.strokeStyle = Art.alpha('#e8e8ff', 0.6);
          ctx.lineWidth = Math.max(1, w * 0.004);
          var lx = rng.float(w * 0.2, w * 0.8);
          ctx.beginPath();
          ctx.moveTo(lx, 0); ctx.lineTo(lx - w * 0.03, h * 0.3); ctx.lineTo(lx + w * 0.02, h * 0.32); ctx.lineTo(lx - w * 0.05, h * 0.6);
          ctx.stroke();
        }
        break;
      case 'fog':
        /* thick pale mist banked toward the ground — the defining look of
           the Glass Fen at dusk. */
        for (var i = 0; i < 4; i++) {
          var y = h * (0.55 + i * 0.11);
          var g = ctx.createLinearGradient(0, y - h * 0.08, 0, y + h * 0.08);
          g.addColorStop(0, Art.alpha(gm.fogColor, 0));
          g.addColorStop(0.5, Art.alpha(gm.fogColor, 0.35 - i * 0.04));
          g.addColorStop(1, Art.alpha(gm.fogColor, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, y - h * 0.08, w, h * 0.16);
        }
        ctx.fillStyle = Art.alpha(gm.fogColor, 0.18);
        ctx.fillRect(0, 0, w, h);
        break;
      case 'snow':
        ctx.fillStyle = Art.alpha('#dfe8f0', 0.12);
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = Art.alpha('#ffffff', 0.9);
        for (var s = 0; s < 60; s++) {
          var sx = rng.float(0, w), sy = rng.float(0, h), sr = rng.float(0.6, 2);
          ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'clear':
      default:
        break;
    }
  }

  function drawRainStreaks(ctx, w, h, rng, count, alphaAmt) {
    ctx.strokeStyle = Art.alpha('#c8d8e8', alphaAmt);
    ctx.lineWidth = Math.max(1, w * 0.0015);
    for (var i = 0; i < count; i++) {
      var x = rng.float(0, w), y = rng.float(0, h);
      var len = h * rng.float(0.02, 0.05);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * 0.25, y + len);
      ctx.stroke();
    }
  }

  /* Final light/colour grade: a flat wash of the time-of-day tint plus the
     vignette, so every biome shares one consistent "time of day" mood. */
  function drawGrade(ctx, gm, sky, w, h) {
    ctx.fillStyle = Art.alpha(sky.grade, sky.gradeAmt);
    ctx.fillRect(0, 0, w, h);
    Art.vignette(ctx, w, h, { color: '#000000', strength: 0.3 });
  }

  var api = {
    drawScene: drawScene,
    genomeForScene: genomeForScene,
    setData: setData,
    BIOMES: BIOMES, TIMES_OF_DAY: TIMES_OF_DAY, WEATHERS: WEATHERS,
  };

  global.DND = global.DND || {};
  global.DND.Scene = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
