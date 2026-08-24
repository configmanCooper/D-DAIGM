/*
 * tests/browser.test.js — does the game actually run in a browser?
 *
 * Every other suite tests logic in Node, where there is no DOM and no canvas.
 * This one opens the real page in real Chrome and asserts the things only a
 * browser can tell us: that the script tags load in an order that works, that
 * nothing throws on boot, that the canvas generators draw, and that a turn can
 * be taken through the UI rather than through a require().
 *
 * Assumes the server is already running. Start it first:
 *   .\start.cmd -NoBrowser
 */
'use strict';
const t = require('./_harness')('browser');
const fs = require('fs');
const path = require('path');

let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) {
  console.log('  puppeteer-core is not installed; run `npm install`. Skipping.');
  process.exit(0);
}

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const CHROME = CHROME_CANDIDATES.filter(p => { try { return fs.existsSync(p); } catch (e) { return false; } })[0];
const PORT = process.env.PORT || 8177;
const URL = 'http://127.0.0.1:' + PORT + '/';

async function main() {
  if (!CHROME) {
    console.log('  no Chrome found; skipping the browser suite.');
    process.exit(0);
  }

  try {
    const r = await fetch(URL + 'api/status');
    await r.json();
  } catch (e) {
    console.log('  the server is not running at ' + URL + '; start it with .\\start.cmd -NoBrowser');
    process.exit(0);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,1000'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });

    /* Anything the page complains about is collected and asserted on. A game
       that boots but logs a stack trace is not a game that boots. */
    const errors = [];
    const warnings = [];
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    page.on('console', m => {
      const txt = m.text();
      if (m.type() === 'error') errors.push(txt);
      else if (m.type() === 'warning') warnings.push(txt);
    });
    page.on('requestfailed', r => errors.push('request failed: ' + r.url()));

    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
    /* Boot is asynchronous (it polls /api/status); give it a moment to settle. */
    await new Promise(r => setTimeout(r, 2500));

    t.section('the page boots');
    t.eq(errors.length, 0, 'no console errors or page exceptions',
      errors.length ? '\n      ' + errors.slice(0, 6).join('\n      ') : '');

    const fatal = await page.$('#fatal');
    const fatalVisible = fatal ? await page.evaluate(el => {
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && el.textContent.trim().length > 0;
    }, fatal) : false;
    t.eq(fatalVisible, false, 'the fatal-error panel is not showing');

    t.section('the modules are present');
    const globals = await page.evaluate(() => {
      const D = window.DND || {};
      return {
        keys: Object.keys(D),
        hasRng: typeof D.RNG === 'function',
        hasDice: !!(D.Dice && D.Dice.d20),
        hasCommand: !!(D.Command && D.Command.create),
        hasEvents: !!(D.Events && D.Events.commit),
        hasKnowledge: !!(D.Knowledge && D.Knowledge.getObservation),
        hasCharacter: !!(D.Character && D.Character.derive),
        hasCombat: !!(D.Combat && D.Combat.squaresInSphere),
        hasInteraction: !!(D.Interaction),
        hasDispatch: !!(D.Dispatch && D.Dispatch.dispatch),
        hasGame: !!(D.Game && D.Game.createSession),
        hasArt: !!(D.Art && D.Art.shade),
        hasPortrait: !!(D.Portrait && D.Portrait.drawPortrait),
        hasData: !!(D.Data && D.Data.RACES && D.Data.CLASSES),
        spellCount: D.Data && D.Data.SPELLS ? Object.keys(D.Data.SPELLS).length : 0,
        monsterCount: D.Data && D.Data.MONSTERS ? Object.keys(D.Data.MONSTERS).length : 0,
        resolvers: D.Dispatch ? D.Dispatch.registered().sort() : [],
      };
    });
    t.ok(globals.hasRng, 'RNG loaded');
    t.ok(globals.hasDice, 'dice loaded');
    t.ok(globals.hasCommand, 'commands loaded');
    t.ok(globals.hasEvents, 'events loaded');
    t.ok(globals.hasKnowledge, 'knowledge loaded');
    t.ok(globals.hasCharacter, 'characters loaded');
    t.ok(globals.hasCombat, 'combat loaded');
    t.ok(globals.hasInteraction, 'interaction loaded');
    t.ok(globals.hasDispatch, 'dispatch loaded');
    t.ok(globals.hasGame, 'the orchestrator loaded');
    t.ok(globals.hasArt && globals.hasPortrait, 'the art generators loaded');
    t.ok(globals.hasData, 'the SRD data loaded');
    t.ok(globals.spellCount > 250, 'the full spell list is present', '(' + globals.spellCount + ')');
    t.ok(globals.monsterCount > 120, 'the full monster list is present', '(' + globals.monsterCount + ')');
    t.ok(globals.resolvers.indexOf('combat') >= 0, 'the combat resolver registered on load');
    t.ok(globals.resolvers.indexOf('social') >= 0, 'the social resolver registered on load');
    t.ok(globals.resolvers.indexOf('exploration') >= 0, 'the exploration resolver registered on load');

    t.section('the model picker never defaults to Copilot');
    const picker = await page.evaluate(() => {
      const sels = Array.from(document.querySelectorAll('select'));
      return sels.map(s => ({
        id: s.id,
        first: s.options.length ? s.options[0].value : null,
        selected: s.value,
      }));
    });
    const modelSelects = picker.filter(p => /model|dm|backend/i.test(p.id || ''));
    modelSelects.forEach(p => {
      t.eq(/^copilot/i.test(String(p.first || '')), false,
        'select #' + p.id + ' does not offer a Copilot model first');
      t.eq(/^copilot/i.test(String(p.selected || '')), false,
        'select #' + p.id + ' is not defaulted to a Copilot model');
    });
    if (!modelSelects.length) t.ok(true, '(no model selects rendered at this stage)');

    t.section('the canvas art actually draws');
    const drew = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 128;
      const ctx = c.getContext('2d');
      const D = window.DND;
      const out = {};
      try {
        const g = D.Portrait.genomeForCharacter('seed-1', { raceId: 'human', classId: 'paladin' });
        D.Portrait.drawPortrait(ctx, g, 128, 128, {});
        const px = ctx.getImageData(0, 0, 128, 128).data;
        let nonBlank = 0;
        for (let i = 3; i < px.length; i += 4) if (px[i] > 0) nonBlank++;
        out.portraitPixels = nonBlank;
      } catch (e) { out.portraitError = String(e.message); }
      try {
        const c2 = document.createElement('canvas'); c2.width = 96; c2.height = 96;
        const x2 = c2.getContext('2d');
        D.Scene.drawScene(x2, D.Art.makeGenome('fen', { biome: 'marsh' }),
          96, 96, { biome: 'marsh', timeOfDay: 'dusk', weather: 'fog' });
        const px2 = x2.getImageData(0, 0, 96, 96).data;
        let n2 = 0;
        for (let i = 3; i < px2.length; i += 4) if (px2[i] > 0) n2++;
        out.scenePixels = n2;
      } catch (e) { out.sceneError = String(e.message); }
      return out;
    });
    t.eq(drew.portraitError, undefined, 'drawing a portrait does not throw', drew.portraitError || '');
    t.ok(drew.portraitPixels > 2000, 'the portrait actually rendered pixels',
      '(' + drew.portraitPixels + ' opaque)');
    t.eq(drew.sceneError, undefined, 'drawing a scene does not throw', drew.sceneError || '');
    t.ok(drew.scenePixels > 2000, 'the scene actually rendered pixels',
      '(' + drew.scenePixels + ' opaque)');

    t.section('a full turn can be taken in the browser');
    const played = await page.evaluate(async () => {
      const D = window.DND;
      const state = D.State.create({ seed: 'browser-test', campaignId: 'smoke' });
      const mk = (id, name, side, hp, x) => ({
        id, name, side,
        base: { name, raceId: 'human', classes: [{ classId: 'fighter', levels: 3 }],
          abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
          proficiencies: { skills: [], saves: [] } },
        progression: { xp: 900, levels: [{ level: 1, classId: 'fighter', hpGained: 10, choice: 'average' }] },
        runtime: { hp, hpMax: hp, tempHp: 0, conditions: {}, exhaustion: 0, concentratingOn: null,
          attuned: [], equipped: {}, inventory: [], deathSaves: { successes: 0, failures: 0 },
          resources: {}, gold: 0, pos: { x, y: 3 },
          attacks: [{ name: 'longsword', toHit: 5, damage: '1d8+3', abilityMod: 3 }] },
      });
      D.State.addActor(state, mk('hero', 'Test Hero', 'party', 30, 2));
      D.State.addActor(state, mk('foe', 'Test Foe', 'enemy', 20, 3));
      D.State.addSeat(state, { id: 'p1', name: 'P1', actorId: 'hero', control: 'human' });

      const store = D.Knowledge.makeStore();
      store.known = state.knowledge;
      const session = D.Game.createSession({ state, store, campaign: { title: 'Smoke', tone: 'plain' } });

      const moves = D.Dispatch.legalMoves(state, 'hero', {});
      const attack = moves.filter(m => m.step && m.step.verb === 'attack')[0];
      if (!attack) return { error: 'no attack move offered', moveCount: moves.length };

      const cmd = D.Dispatch.commandFromMove(state, 'hero', attack, {});
      const beforeHp = state.actors.foe.runtime.hp;
      const beforeRev = state.revision;
      const res = await D.Game.applyCommand(session, cmd, { skipNarration: true });

      const obs = D.Knowledge.getObservation(state, store, 'hero', {});
      const undo = D.Game.undo(session);

      return {
        moveCount: moves.length,
        ok: res.ok,
        stage: res.stage,
        beats: res.beats || [],
        beforeHp, afterHp: state.actors.foe.runtime.hp,
        beforeRev, afterRev: res.revision,
        undoOk: undo.ok,
        hpAfterUndo: state.actors.foe.runtime.hp,
        observedFoeHp: obs.actors.foe ? obs.actors.foe.hp : 'absent',
        observedFoeHealth: obs.actors.foe ? obs.actors.foe.health : null,
      };
    });

    t.eq(played.error, undefined, 'a turn could be built and run', played.error || '');
    t.ok(played.moveCount > 0, 'legal moves are offered in the browser', '(' + played.moveCount + ')');
    t.eq(played.ok, true, 'the command dispatched successfully');
    t.eq(played.stage, 'committed', 'and reached the committed stage');
    t.ok(played.beats.length > 0, 'and produced beats for the narrator');
    t.ok(played.afterRev > played.beforeRev, 'the revision advanced');
    t.eq(played.observedFoeHp, null, 'an enemy\u2019s exact hit points stay hidden from the player');
    t.ok(!!played.observedFoeHealth, 'but a descriptive health band is shown');
    t.eq(played.undoOk, true, 'undo works in the browser');
    t.eq(played.hpAfterUndo, played.beforeHp, 'and undo restored the enemy\u2019s hit points');

    t.section('accessibility basics');
    const a11y = await page.evaluate(() => {
      const css = Array.from(document.styleSheets)
        .map(s => { try { return Array.from(s.cssRules).map(r => r.cssText).join('\n'); } catch (e) { return ''; } })
        .join('\n');
      return {
        hasLang: !!document.documentElement.lang,
        hasTitle: !!document.title,
        liveRegions: document.querySelectorAll('[aria-live]').length,
        focusVisible: /:focus-visible/.test(css),
        reducedMotion: /prefers-reduced-motion/.test(css),
        landmarks: document.querySelectorAll('main, [role="main"], nav, [role="navigation"]').length,
        buttonsWithoutText: Array.from(document.querySelectorAll('button')).filter(b =>
          !b.textContent.trim() && !b.getAttribute('aria-label') && !b.title).length,
      };
    });
    t.ok(a11y.hasLang, 'the document declares a language');
    t.ok(a11y.hasTitle, 'the document has a title');
    t.ok(a11y.liveRegions > 0, 'there is at least one aria-live region for the log');
    t.ok(a11y.focusVisible, 'the stylesheet defines a visible focus style');
    t.ok(a11y.reducedMotion, 'the stylesheet respects prefers-reduced-motion');
    t.eq(a11y.buttonsWithoutText, 0, 'every button has a label a screen reader can read');

    t.section('no warnings worth worrying about');
    const realWarnings = warnings.filter(w => !/DevTools|Autofill|favicon/i.test(w));
    t.eq(realWarnings.length, 0, 'no unexpected console warnings',
      realWarnings.length ? '\n      ' + realWarnings.slice(0, 4).join('\n      ') : '');

    await page.screenshot({ path: path.join(__dirname, 'shot-boot.png') });
    console.log('\n  screenshot written to tests/shot-boot.png');
  } finally {
    await browser.close();
  }

  t.done();
}

main().catch(e => { console.error(e); process.exit(1); });
