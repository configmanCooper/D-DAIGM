/*
 * tests/ui.test.js — cross-file invariants for the browser front end.
 *
 * The UI is plain script-tag JavaScript with no build step and no DOM in CI, so
 * this suite reads the source files as text and asserts the contracts that keep
 * the front end honest: scripts load in a valid dependency order, the local
 * model is always the default, no panel reaches past the perception layer, no
 * panel re-derives combat geometry, action buttons come from the engine's legal
 * moves, and the stylesheet meets the accessibility floor.
 *
 * It is deliberately regex-over-text rather than a headless browser: a test that
 * needs a browser to run is a test that will not be run.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const harness = require('./_harness');

const ROOT = path.join(__dirname, '..');
const t = harness('ui — front-end invariants');

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function uiFiles() {
  const dir = path.join(ROOT, 'js', 'ui');
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).map(f => 'js/ui/' + f);
}

const html = read('index.html');
const css = read('css/style.css');
const ui = uiFiles();

/* --------------------------------------------- script dependency order -- */
t.section('index.html loads scripts in a valid dependency order');
{
  const srcs = [];
  const re = /<script[^>]*\ssrc="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) srcs.push(m[1]);

  const firstIdx = pred => srcs.findIndex(pred);
  const lastIdx = pred => { let i = -1; srcs.forEach((s, k) => { if (pred(s)) i = k; }); return i; };

  const isRng = s => s === 'js/rng.js';
  const isData = s => /^js\/data\//.test(s);
  const isEngine = s => /^js\/engine\//.test(s);
  const isGen = s => /^js\/gen\//.test(s);
  const isAi = s => /^js\/ai\//.test(s);
  const isGame = s => s === 'js/game.js';
  const isUi = s => /^js\/ui\//.test(s);

  t.ok(srcs.length > 20, 'the page loads the full script set', '(' + srcs.length + ' tags)');
  t.ok(firstIdx(isRng) === 0, 'rng.js is loaded first');
  t.ok(firstIdx(isRng) < firstIdx(isData), 'rng before data');
  t.ok(lastIdx(isData) < firstIdx(isEngine), 'all data before engine');
  t.ok(lastIdx(isEngine) < firstIdx(isGen), 'all engine before gen');
  t.ok(lastIdx(isGen) < firstIdx(isAi), 'all gen before ai');
  t.ok(lastIdx(isAi) < firstIdx(isGame), 'all ai before game');
  t.ok(firstIdx(isGame) < firstIdx(isUi), 'game before ui');
  t.ok(lastIdx(isUi) === srcs.length - 1 || isUi(srcs[srcs.length - 1]), 'ui panels load last');
  // app.js must be the very last ui script so it can wire the others.
  t.ok(/js\/ui\/app\.js/.test(srcs[srcs.length - 1]), 'app.js is the final script');
}

/* ----------------------------------------------- local model is default -- */
t.section('the local model is always the default');
{
  const selRe = /<select[^>]*class="model-select"[^>]*>([\s\S]*?)<\/select>/g;
  let m, count = 0, allLocalFirst = true;
  while ((m = selRe.exec(html))) {
    count++;
    const opt = /<option[^>]*value="([^"]*)"/.exec(m[1]);
    const val = opt ? opt[1] : '(none)';
    const local = !!opt && val.indexOf('copilot:') !== 0;
    if (!local) allLocalFirst = false;
    t.ok(local, 'model <select> #' + count + ' opens on a local model', '(first = "' + val + '")');
  }
  t.ok(count >= 1, 'at least one model <select> exists in index.html');
  t.ok(allLocalFirst, 'every model <select> in index.html is local-first');

  // No source file may pin a Copilot model as a default/constant value. A
  // complete quoted "copilot:<model>" literal is a default; the "'copilot:' +"
  // prefix used for concatenation and .indexOf('copilot:') guards are fine.
  const copilotDefault = /['"]copilot:[A-Za-z0-9][\w.\-]*['"]/;
  ui.forEach(f => {
    t.ok(!copilotDefault.test(read(f)), path.basename(f) + ' assigns no copilot model as a default');
  });
  // ...and the local optgroup is authored before the copilot one wherever a
  // picker is built in JS (a structural guarantee of local-first). Scope the
  // search to optgroup labels so prose in the file header does not skew it.
  ['js/ui/setup.js', 'js/ui/watch.js'].forEach(f => {
    const src = read(f);
    const li = src.search(/label[^\n]*Local/);
    const ci = src.search(/label[^\n]*Copilot/);
    if (li >= 0 && ci >= 0) t.ok(li < ci, path.basename(f) + ' lists local models before copilot ones');
  });
}

/* ------------------------------------------ perception layer is the door -- */
t.section('no UI file reads the raw actor table for display');
{
  // The perception layer (getObservation / selfView) is the door for display.
  // The one sanctioned exception is App.layersFor, which the level-up modal
  // needs because base/progression are real character layers an observation
  // deliberately withholds. That door gates on a seat this client controls, so
  // it is not a general back door — the line implementing it is marked
  // `/* sanctioned:` and excluded here; everything else must stay clean.
  ui.forEach(f => {
    const guarded = read(f).replace(/^.*\/\* sanctioned:[^\n]*$/gm, '');
    t.ok(!/state\.actors/.test(guarded),
      path.basename(f) + ' never touches state.actors outside the sanctioned App.layersFor door');
  });
  // ...and that sanctioned door really exists, is exported, and is gated.
  const app = read('js/ui/app.js');
  t.ok(/function layersFor\s*\(/.test(app), 'app.js defines the sanctioned layersFor door');
  t.ok(/layersFor:\s*layersFor/.test(app), 'app.js exports layersFor on DND.App');
  t.ok(/s\.control === 'human'/.test(app), 'layersFor gates on a seat this client controls');
  // ...and the level-up modal reaches the raw layers only through that door.
  const lu = read('js/ui/levelup.js');
  t.ok(!/state\.actors/.test(lu), 'levelup.js never touches state.actors');
  t.ok(/App\.layersFor|layersFor\(/.test(lu), 'levelup.js reads character layers through App.layersFor');
}

/* -------------------------------------------- geometry lives in combat.js -- */
t.section('no UI file re-implements AoE / line-of-sight geometry');
{
  const tells = /Math\.sqrt|Math\.hypot|Math\.atan2|bresenham|\bdx\s*\*\s*dx\b|\bdy\s*\*\s*dy\b|function\s+(?:chebyshev|euclid|lineOfSight|squaresInCone|squaresInSphere)/;
  ui.forEach(f => {
    t.ok(!tells.test(read(f)), path.basename(f) + ' contains no geometry maths');
  });
  // ...and the battle map does import the geometry it needs.
  t.ok(/DND\.Combat|Combat\./.test(read('js/ui/battle.js')),
    'battle.js imports geometry from the combat engine');
}

/* ------------------------------------------ actions come from legalMoves -- */
t.section('every action button is built from Dispatch.legalMoves');
{
  const app = read('js/ui/app.js');
  t.ok(/Dispatch\.legalMoves/.test(app), 'app.js builds the action bar from Dispatch.legalMoves');
  t.ok(/commandFromMove/.test(app), 'app.js turns a chosen legal move back into a command');
  // A hard-coded action menu would be an array of verb strings; none should exist.
  const hardCoded = /\[\s*['"](attack|move|dash|dodge|disengage)['"]\s*,/i;
  ui.forEach(f => {
    t.ok(!hardCoded.test(read(f)), path.basename(f) + ' hard-codes no action list');
  });
}

/* ---------------------------------------------------- css accessibility -- */
t.section('css meets the accessibility floor');
{
  t.ok(/@media\s*\(\s*prefers-reduced-motion/.test(css), 'style.css honours prefers-reduced-motion');
  t.ok(/:focus-visible/.test(css), 'style.css has a :focus-visible rule');
  t.ok(/@media\s*\(\s*prefers-contrast/.test(css), 'style.css supports prefers-contrast');
  // No colour-only status: colour must be paired with a glyph/shape/label. As a
  // proxy, assert status glyphs are emitted via ::before content somewhere.
  t.ok(/::before[\s\S]{0,160}content\s*:/.test(css),
    'style.css pairs colour with a ::before glyph/label (no colour-only indicators)');
}

/* -------------------------------------------- module load order is safe -- */
/**
 * A module that takes `var X = global.DND.X` at load time gets `undefined` if
 * its provider's script tag comes LATER in the page. There is no build step to
 * catch it and no error at the time: the alias is simply null for the whole
 * session, and whatever depends on it silently does nothing. It behaves
 * perfectly under Node, where `require` resolves on demand — so the tests pass
 * and the game is broken.
 *
 * That is exactly how building a replacement character after a death came to
 * throw "Cannot read properties of null", and how the level-up recommendations
 * came to be missing in the browser while every suite was green.
 */
t.section('no module aliases something that loads after it');
{
  const html = read('index.html');
  const order = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const position = {};
  order.forEach((file, i) => { position[file] = i; });

  const problems = [];
  order.forEach(file => {
    if (file.indexOf('js/') !== 0) return;
    let src;
    try { src = read(file); } catch (e) { return; }
    /* Only the head matters. An alias taken inside a function body resolves
       when that function runs, which is always late enough. */
    const head = src.slice(0, 3000);
    [...head.matchAll(/var (\w+) = \(global\.DND && global\.DND\.(\w+)\)/g)].forEach(m => {
      const prop = m[2];
      const owner = order.filter(o => {
        if (o.indexOf('js/') !== 0) return false;
        try { return read(o).indexOf('global.DND.' + prop + ' =') >= 0; } catch (e) { return false; }
      })[0];
      if (owner && position[owner] > position[file]) {
        problems.push(file + ' aliases DND.' + prop + ', but ' + owner + ' loads later');
      }
    });
  });

  t.deep(problems, [],
    'every module-scope DND alias is provided by a script that loads earlier');
}

t.section('every script the page loads is actually in the repository');
/*
 * `.gitignore` carried an unanchored `ai/`, meant for the gigabytes of model
 * weights. Unanchored, it matches a directory of that name at ANY depth, so it
 * silently swallowed js/ai/ — the DM narrator, the referee, the prompt builder,
 * the offline DM, the backstory generator, the model backend, the schema and
 * the player agent. Eight source files, the entire AI layer, never committed.
 *
 * A clone of the repository could not run the game, and nothing said so:
 * ignored files are not reported as untracked, so `git status` was clean all
 * the way through. The only way to see it is to ask git, file by file, whether
 * it has what the page asks for.
 */
{
  const { execFileSync } = require('child_process');

  const scripts = [];
  const re = /<script[^>]+src="([^"?]+)/g;
  let m;
  while ((m = re.exec(html))) scripts.push(m[1]);
  t.ok(scripts.length > 10, 'index.html loads a plausible number of scripts',
    '(' + scripts.length + ')');

  const onDisk = scripts.filter(f => fs.existsSync(path.join(ROOT, f)));
  t.deep(scripts.filter(f => !fs.existsSync(path.join(ROOT, f))), [],
    'and every one of them exists on disk');

  let tracked = null;
  try {
    tracked = new Set(execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').map(s => s.trim()).filter(Boolean));
  } catch (e) { /* not a git checkout; nothing to assert */ }

  if (!tracked) {
    t.ok(true, 'not a git checkout, so there is nothing to compare against');
  } else {
    const untracked = onDisk.filter(f => !tracked.has(f));
    t.deep(untracked, [],
      'and git has every one of them, so a fresh clone can actually run the game');

    /* The weights themselves must still be excluded — that is what the rule is
       for, and loosening it to fix the above would be the opposite mistake. */
    const weights = [...tracked].filter(f => /\.(gguf|bin|safetensors)$/.test(f));
    t.deep(weights, [], 'while no model weights have crept in');
  }
}

t.section('every way in and out of a save is actually wired up');
/*
 * The game could write a save file and had no way to read one back: the
 * "Carry on" step was hidden outright whenever this browser held no save, and
 * that step was the only place a file could have been offered. Export wrote to
 * the server's exports folder and told the player "Session exported" without
 * saying where, so the file existed somewhere they had never been told about.
 */
{
  const need = ['btn-save', 'btn-export', 'btn-transcript', 'btn-load', 'btn-new'];
  need.forEach(id => {
    t.ok(html.indexOf('id="' + id + '"') >= 0,
      'index.html has ' + id);
  });

  const app = read('js/ui/app.js');
  need.forEach(id => {
    t.ok(new RegExp("bindClick\\('" + id + "'").test(app),
      'and app.js binds a handler to ' + id);
  });

  /* Export has to reach the player, not only the server. */
  t.ok(/downloadFile\(/.test(app),
    'exporting downloads a file rather than only writing to the server');
  t.ok(/createObjectURL/.test(app),
    'and does it with an object URL, which survives a large save');

  /* And the setup screen has to offer a way in from disk. */
  const setup = read('js/ui/setup.js');
  t.ok(/import-save-file/.test(setup), 'the setup screen has a file input for a save');
  t.ok(/accept = 'application\/json,\.json'/.test(setup), 'accepting a .json save');
  t.ok(/function importSaveFile/.test(setup), 'and a reader for it');
  t.ok(/function beginFromLoaded/.test(setup),
    'sharing one path with Resume, so a browser save and a file cannot drift apart');
  t.eq(/step\.hidden = true; return;/.test(setup), false,
    'and the step is never hidden outright, which is what hid the only way in');
}

t.section('the backstory writer is told which Dungeon Master was chosen');
/*
 * `Backend.configure` was called in `onBegin` — when the GAME starts — and the
 * character builder runs before that. So `Backend.available()` was false for
 * the whole of setup and "Ask the GM to rewrite it" always fell back to a
 * canned seed, however good a model the player had just chosen. Reported live
 * as "No model available", which is untrue and unhelpful in the same breath.
 */
{
  const setup = read('js/ui/setup.js');
  t.ok(/function useChosenDm/.test(setup),
    'setup can point the backend at the selected Dungeon Master');
  t.ok(/useChosenDm\(\)/.test(setup),
    'and the backstory button does so before asking');
  t.ok(/No Dungeon Master chosen yet/.test(setup),
    'and distinguishes "you picked none" from "the model failed"');
  t.ok(/could not be reached/.test(setup),
    'which is a different sentence from the other case');
}

t.done();
