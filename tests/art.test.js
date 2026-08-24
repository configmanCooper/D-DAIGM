/*
 * tests/art.test.js — procedural art system: genomes never throw, never
 * produce NaN colours, are deterministic per seed, and every draw call
 * actually issues drawing operations (a silently blank render is a failure).
 *
 * No real canvas exists in Node, so every assertion here runs against a
 * recording stub built from a Proxy: any CanvasRenderingContext2D method the
 * art modules call becomes a no-op that records its name, gradient factories
 * return an addColorStop-capable stub, and plain property assignment
 * (fillStyle, lineWidth, font, ...) just works because it's a plain object
 * underneath. This is deliberately more permissive than hand-listing every
 * method: it guarantees the stub can never be the reason a draw call throws,
 * so a thrown error always means a real bug in the art code.
 */
'use strict';
const t = require('./_harness')('art');
const { RNG } = require('../js/rng.js');
const Art = require('../js/gen/art.js');
const Portrait = require('../js/gen/portrait.js');
const Creature = require('../js/gen/creature.js');
const Icon = require('../js/gen/icon.js');
const Scene = require('../js/gen/scene.js');
const Tokens = require('../js/gen/tokens.js');

/* ------------------------------------------------------------ stub ctx -- */

function makeStubCtx() {
  const calls = [];
  const gradientStub = { addColorStop: function () { calls.push('addColorStop'); } };
  const base = {
    canvas: { width: 0, height: 0 },
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    lineCap: 'butt', lineJoin: 'miter', font: '10px sans-serif',
    textAlign: 'left', textBaseline: 'alphabetic',
    shadowColor: 'transparent', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
  };
  const handler = {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createConicGradient') {
        return function () { calls.push(String(prop)); return gradientStub; };
      }
      if (prop === 'createPattern') return function () { calls.push('createPattern'); return {}; };
      if (prop === 'measureText') return function (text) { calls.push('measureText'); return { width: String(text == null ? '' : text).length * 6 }; };
      if (prop === 'getImageData') return function () { calls.push('getImageData'); return { data: [], width: 0, height: 0 }; };
      if (prop === 'getContext') return function () { calls.push('getContext'); return proxy; };
      if (typeof prop === 'symbol') return undefined;
      /* any other method the art code calls: record + no-op */
      return function () { calls.push(prop); return undefined; };
    },
    set(target, prop, value) { target[prop] = value; return true; },
  };
  const proxy = new Proxy(base, handler);
  return { ctx: proxy, calls };
}

/* a minimal `document.createElement('canvas')` stand-in, so Art.cached's
   browser branch is also exercised (not just its Node degrade branch) */
function installFakeDocument() {
  global.document = {
    createElement: function (tag) {
      if (tag !== 'canvas') throw new Error('unexpected element: ' + tag);
      const stub = makeStubCtx();
      return { width: 0, height: 0, getContext: function () { return stub.ctx; } };
    },
  };
}
function removeFakeDocument() { delete global.document; }

function isHexColor(s) { return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s); }
function isColorish(s) {
  return typeof s === 'string' && (isHexColor(s) || /^rgba?\(/.test(s));
}
function hasNaN(str) { return /NaN/.test(String(str)); }

/* ------------------------------------------------------------- colour -- */
t.section('colour helpers');
t.ok(isHexColor(Art.shade('#8a6a4a', 20)), 'shade returns a valid hex colour');
t.ok(!hasNaN(Art.shade('#8a6a4a', 20)), 'shade never produces NaN');
t.eq(Art.shade('#ffffff', 50), '#ffffff', 'shade clamps at 255 without wrapping');
t.eq(Art.shade('#000000', -50), '#000000', 'shade clamps at 0 without wrapping');
t.ok(isHexColor(Art.mix('#ff0000', '#0000ff', 0.5)), 'mix returns a valid hex colour');
t.ok(!hasNaN(Art.mix('#ff0000', '#0000ff', 0.5)), 'mix never produces NaN');
t.eq(Art.mix('#112233', '#445566', 0), '#112233', 'mix at t=0 is the first colour');
t.eq(Art.mix('#112233', '#445566', 1), '#445566', 'mix at t=1 is the second colour');
t.ok(isColorish(Art.alpha('#112233', 0.4)), 'alpha returns an rgba() string');
t.ok(!hasNaN(Art.alpha('#112233', 0.4)), 'alpha never produces NaN');
t.ok(isHexColor(Art.hsl(200, 60, 50)), 'hsl returns a valid hex colour');
t.ok(!hasNaN(Art.hsl(0, 0, 0)) && !hasNaN(Art.hsl(360, 100, 100)), 'hsl never produces NaN at extremes');
t.ok(isHexColor(Art.shade('not-a-color', 10)), 'garbage hex input degrades to a valid colour rather than throwing');

const pal = Art.paletteFrom(new RNG('palette-seed'), 'triad');
t.ok(Array.isArray(pal) && pal.length === 3, 'paletteFrom(triad) returns three colours');
t.ok(pal.every(isHexColor), 'every palette colour is a valid hex colour');
['triad', 'complement', 'analogous', 'split'].forEach(scheme => {
  const p = Art.paletteFrom(new RNG('scheme-' + scheme), scheme);
  t.ok(p.length > 0 && p.every(isHexColor), `paletteFrom('${scheme}') returns valid colours`);
});

t.section('named palettes');
['SKIN_TONES', 'HAIR_COLORS'].forEach(name => {
  t.ok(Array.isArray(Art[name]) && Art[name].every(isHexColor), `Art.${name} is a list of valid hex colours`);
});
['METALS', 'LEATHERS', 'CLOTH', 'RARITY_COLORS', 'DAMAGE_COLORS'].forEach(name => {
  const values = Object.keys(Art[name]).map(k => Art[name][k]);
  t.ok(values.length > 0 && values.every(isHexColor), `Art.${name} values are all valid hex colours`);
});
t.ok(Art.RARITY_COLORS.common !== Art.RARITY_COLORS.legendary, 'common and legendary rarity colours differ');
Object.keys(Art.BIOME_PALETTES).forEach(biome => {
  const bp = Art.BIOME_PALETTES[biome];
  t.ok(isHexColor(bp.ground) && isHexColor(bp.structure) && isHexColor(bp.accent), `BIOME_PALETTES.${biome} has valid colours`);
});

/* -------------------------------------------------------------- genome -- */
t.section('genome determinism');
const gA1 = Art.makeGenome('seed-a', { visual: { palette: ['#112233'] } });
const gA2 = Art.makeGenome('seed-a', { visual: { palette: ['#112233'] } });
const gB = Art.makeGenome('seed-b', { visual: { palette: ['#112233'] } });
t.deep(gA1, gA2, 'Art.makeGenome: same seed + spec produces an identical genome');
t.ok(JSON.stringify(gA1) !== JSON.stringify(gB), 'Art.makeGenome: different seeds produce different genomes');

const pA1 = Portrait.genomeForCharacter('shen-cooper', { raceId: 'human', classId: 'paladin' });
const pA2 = Portrait.genomeForCharacter('shen-cooper', { raceId: 'human', classId: 'paladin' });
const pB = Portrait.genomeForCharacter('other-seed', { raceId: 'human', classId: 'paladin' });
t.deep(pA1, pA2, 'Portrait.genomeForCharacter: same seed always produces an identical genome');
t.ok(JSON.stringify(pA1) !== JSON.stringify(pB), 'Portrait.genomeForCharacter: different seeds diverge');

const cA1 = Creature.genomeForMonster('goblin-1', { visual: { silhouette: 'humanoid', size: 'small' } });
const cA2 = Creature.genomeForMonster('goblin-1', { visual: { silhouette: 'humanoid', size: 'small' } });
t.deep(cA1, cA2, 'Creature.genomeForMonster: same seed always produces an identical genome');

const iA1 = Icon.genomeForItem('longsword-1', { visual: { iconShape: 'sword' } });
const iA2 = Icon.genomeForItem('longsword-1', { visual: { iconShape: 'sword' } });
t.deep(iA1, iA2, 'Icon.genomeForItem: same seed always produces an identical genome');

const sA1 = Scene.genomeForScene('glass-fen', { biome: 'marsh', timeOfDay: 'dusk', weather: 'fog' });
const sA2 = Scene.genomeForScene('glass-fen', { biome: 'marsh', timeOfDay: 'dusk', weather: 'fog' });
t.deep(sA1, sA2, 'Scene.genomeForScene: same seed always produces an identical genome');

/* -------------------------------------------------------------- drawing -- */

function countDrawCalls(calls) {
  const drawy = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage', 'fillText', 'strokeText']);
  return calls.filter(c => drawy.has(c)).length;
}

t.section('portraits — every race x class combination');
let portraitCount = 0;
Portrait.RACE_ORDER.forEach(raceId => {
  Portrait.CLASS_ORDER.forEach(classId => {
    const { ctx, calls } = makeStubCtx();
    const gm = Portrait.genomeForCharacter('char-' + raceId + '-' + classId, { raceId, classId });
    let threw = null;
    try { Portrait.drawPortrait(ctx, gm, 96, 96, { mood: 0 }); } catch (e) { threw = e; }
    t.ok(!threw, `portrait ${raceId}/${classId} does not throw`, threw ? '(' + threw.message + ')' : '');
    t.ok(countDrawCalls(calls) > 0, `portrait ${raceId}/${classId} issues real drawing operations`);
    portraitCount++;
  });
});
t.eq(portraitCount, Portrait.RACE_ORDER.length * Portrait.CLASS_ORDER.length, 'every race x class portrait combination was exercised');

t.section('portraits — mood range does not throw');
[-1, -0.5, 0, 0.5, 1].forEach(mood => {
  const { ctx } = makeStubCtx();
  const gm = Portrait.genomeForCharacter('mood-seed', { raceId: 'tiefling', classId: 'warlock' });
  let threw = null;
  try { Portrait.drawPortrait(ctx, gm, 96, 96, { mood }); } catch (e) { threw = e; }
  t.ok(!threw, `portrait at mood=${mood} does not throw`);
});

t.section('creatures — every silhouette x size combination');
let creatureCount = 0;
Creature.SILHOUETTES.forEach(sil => {
  Creature.SIZE_ORDER.forEach(size => {
    const { ctx, calls } = makeStubCtx();
    const gm = Creature.genomeForMonster('mon-' + sil + '-' + size, {
      visual: { silhouette: sil, size: size, features: ['horns', 'wings', 'tail', 'carapace', 'tentacles', 'claws', 'mandibles', 'glow', 'manyEyes', 'skeletal'] },
    });
    let threw = null;
    try { Creature.drawCreature(ctx, gm, 96, 96, {}); } catch (e) { threw = e; }
    t.ok(!threw, `creature ${sil}/${size} does not throw`, threw ? '(' + threw.message + ')' : '');
    t.ok(countDrawCalls(calls) > 0, `creature ${sil}/${size} issues real drawing operations`);
    creatureCount++;
  });
});
t.eq(creatureCount, Creature.SILHOUETTES.length * Creature.SIZE_ORDER.length, 'every silhouette x size creature combination was exercised');

t.section('creatures — boss pass does not throw');
Creature.SILHOUETTES.forEach(sil => {
  const { ctx, calls } = makeStubCtx();
  const gm = Creature.genomeForMonster('boss-' + sil, { visual: { silhouette: sil, size: 'huge', features: ['horns', 'glow'] } });
  let threw = null;
  try { Creature.drawCreature(ctx, gm, 128, 128, { boss: true }); } catch (e) { threw = e; }
  t.ok(!threw, `boss creature ${sil} does not throw`, threw ? '(' + threw.message + ')' : '');
  t.ok(countDrawCalls(calls) > 0, `boss creature ${sil} issues real drawing operations`);
});

t.section('creatures — unrecognised feature strings are ignored, not fatal');
{
  const { ctx } = makeStubCtx();
  const gm = Creature.genomeForMonster('weird-features', { visual: { silhouette: 'aberration', size: 'medium', features: ['alien-shape', 'gaunt-face', 'roiling-energy'] } });
  let threw = null;
  try { Creature.drawCreature(ctx, gm, 64, 64, {}); } catch (e) { threw = e; }
  t.ok(!threw, 'unrecognised feature strings do not throw');
}

t.section('icons — every iconShape');
let iconCount = 0;
Icon.ICON_SHAPES.forEach(shape => {
  [false, true].forEach(glow => {
    const { ctx, calls } = makeStubCtx();
    const gm = Icon.genomeForItem('item-' + shape, { visual: { iconShape: shape, palette: ['#9b8b73', '#d5ccb9'], glow }, rarity: glow ? 'legendary' : 'common' });
    let threw = null;
    try { Icon.drawIcon(ctx, gm, 32, {}); } catch (e) { threw = e; }
    t.ok(!threw, `icon ${shape} (glow=${glow}) does not throw`, threw ? '(' + threw.message + ')' : '');
    t.ok(countDrawCalls(calls) > 0, `icon ${shape} (glow=${glow}) issues real drawing operations`);
    iconCount++;
  });
});
t.eq(iconCount, Icon.ICON_SHAPES.length * 2, 'every icon shape was exercised with and without glow');

t.section('icons — every rarity tints without throwing');
Object.keys(Art.RARITY_COLORS).forEach(rarity => {
  const { ctx } = makeStubCtx();
  const gm = Icon.genomeForItem('rarity-' + rarity, { visual: { iconShape: 'sword' }, rarity });
  let threw = null;
  try { Icon.drawIcon(ctx, gm, 32, {}); } catch (e) { threw = e; }
  t.ok(!threw, `icon at rarity=${rarity} does not throw`);
});

t.section('icons — Art.cached atlas reuse in a browser-like environment');
{
  installFakeDocument();
  Art.clearCache();
  const { ctx, calls } = makeStubCtx();
  const gm = Icon.genomeForItem('cached-sword', { visual: { iconShape: 'sword' } });
  Icon.drawIcon(ctx, gm, 32, {});
  Icon.drawIcon(ctx, gm, 32, {});
  t.ok(calls.filter(c => c === 'drawImage').length === 2, 'a cached icon is drawn via drawImage on repeat calls');
  removeFakeDocument();
  Art.clearCache();
}

t.section('scenes — every biome x timeOfDay x weather combination');
let sceneCount = 0;
Scene.BIOMES.forEach(biome => {
  Scene.TIMES_OF_DAY.forEach(timeOfDay => {
    Scene.WEATHERS.forEach(weather => {
      const { ctx, calls } = makeStubCtx();
      const gm = Scene.genomeForScene('scene-' + biome + '-' + timeOfDay + '-' + weather, { biome, timeOfDay, weather });
      let threw = null;
      try { Scene.drawScene(ctx, gm, 160, 100, {}); } catch (e) { threw = e; }
      t.ok(!threw, `scene ${biome}/${timeOfDay}/${weather} does not throw`, threw ? '(' + threw.message + ')' : '');
      t.ok(countDrawCalls(calls) > 0, `scene ${biome}/${timeOfDay}/${weather} issues real drawing operations`);
      sceneCount++;
    });
  });
});
t.eq(sceneCount, Scene.BIOMES.length * Scene.TIMES_OF_DAY.length * Scene.WEATHERS.length, 'every biome x time x weather combination was exercised');

t.section('scenes — the Glass Fen (marsh/dusk/fog) and abbey/chapel render distinctly');
{
  const fen = Scene.genomeForScene('glass-fen-check', { biome: 'marsh', timeOfDay: 'dusk', weather: 'fog' });
  t.eq(fen.biome, 'marsh', 'Glass Fen genome carries the marsh biome');
  t.eq(fen.weather, 'fog', 'Glass Fen genome carries fog weather');
  const { ctx: fenCtx, calls: fenCalls } = makeStubCtx();
  Scene.drawScene(fenCtx, fen, 200, 120, {});
  t.ok(countDrawCalls(fenCalls) > 0, 'the Glass Fen scene issues real drawing operations');

  const abbeyGm = Scene.genomeForScene('abbey-check', { biome: 'abbey', timeOfDay: 'morning', weather: 'clear' });
  const chapelGm = Scene.genomeForScene('chapel-check', { biome: 'chapel', timeOfDay: 'morning', weather: 'clear' });
  const { ctx: abbeyCtx } = makeStubCtx();
  const { ctx: chapelCtx } = makeStubCtx();
  let threwAbbey = null, threwChapel = null;
  try { Scene.drawScene(abbeyCtx, abbeyGm, 160, 100, {}); } catch (e) { threwAbbey = e; }
  try { Scene.drawScene(chapelCtx, chapelGm, 160, 100, {}); } catch (e) { threwChapel = e; }
  t.ok(!threwAbbey && !threwChapel, 'abbey and chapel scenes both render without throwing');
}

t.section('tokens — every allegiance, portrait and creature kinds');
Tokens.ALLEGIANCES.forEach(allegiance => {
  ['portrait', 'creature'].forEach(kind => {
    const { ctx, calls } = makeStubCtx();
    const gm = Tokens.genomeForToken('token-' + allegiance + '-' + kind, kind === 'creature'
      ? { kind, visual: { silhouette: 'beast', size: 'medium' }, allegiance }
      : { kind, raceId: 'human', classId: 'fighter', allegiance });
    let threw = null;
    try { Tokens.drawToken(ctx, gm, 32, { allegiance, hp: { current: 7, max: 10 } }); } catch (e) { threw = e; }
    t.ok(!threw, `token ${kind}/${allegiance} does not throw`, threw ? '(' + threw.message + ')' : '');
    t.ok(countDrawCalls(calls) > 0, `token ${kind}/${allegiance} issues real drawing operations`);
  });
});

t.section('tokens — conditions, dead overlay, zero/full HP edge cases');
{
  const gm = Tokens.genomeForToken('cond-seed', { kind: 'portrait', raceId: 'dwarf', classId: 'cleric', allegiance: 'party' });
  [
    { conditions: ['poisoned', 'prone', 'stunned'] },
    { dead: true },
    { hp: { current: 0, max: 10 } },
    { hp: { current: 10, max: 10 } },
    { conditions: [], dead: true, hp: { current: 0, max: 1 } },
  ].forEach((opts, i) => {
    const { ctx, calls } = makeStubCtx();
    let threw = null;
    try { Tokens.drawToken(ctx, gm, 32, opts); } catch (e) { threw = e; }
    t.ok(!threw, `token edge case #${i} does not throw`, threw ? '(' + threw.message + ')' : '');
    t.ok(countDrawCalls(calls) > 0, `token edge case #${i} issues real drawing operations`);
  });
}

t.section('Art.cached degrades gracefully with no document (Node)');
{
  t.ok(!Art.hasCanvas(), 'no document is present in this test process, so hasCanvas() is false');
  const { ctx, calls } = makeStubCtx();
  let ran = 0;
  const paint = Art.cached('degrade-key', 10, 10, function (c) { ran++; c.fillRect(0, 0, 10, 10); });
  paint(ctx, 0, 0);
  paint(ctx, 0, 0);
  t.eq(ran, 2, 'without a canvas, cached() just calls drawFn every time (no crash, no caching benefit)');
  t.ok(calls.includes('fillRect'), 'the degrade path still issues the underlying drawing operations');
}

t.done();
