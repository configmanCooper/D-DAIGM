/*
 * tests/ui-chargen.test.js — the three creation routes, backstory, and level-up
 * driven through the real UI.
 *
 * session.test.js proves a pregenerated party is playable. This one proves the
 * front end for the three engine layers wired in this change: character
 * creation (build / surprise / random), the backstory affordances, and the
 * guided, undoable level-up.
 *
 * The Dungeon Master is Offline on purpose — deterministic and quick — and the
 * GM-written-backstory control is only asserted to exist, never clicked, so no
 * live model is called.
 *
 * Assumes the server is running:  .\start.cmd -NoBrowser
 */
'use strict';
const t = require('./_harness')('ui-chargen');
const fs = require('fs');
const path = require('path');

let puppeteer;
try { puppeteer = require('puppeteer-core'); }
catch (e) { console.log('  puppeteer-core not installed; run `npm install`. Skipping.'); process.exit(0); }

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(p => { try { return fs.existsSync(p); } catch (e) { return false; } })[0];

const PORT = process.env.PORT || 8177;
const URL = 'http://127.0.0.1:' + PORT + '/';
const SHOTS = __dirname;

const wait = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  if (!CHROME) { console.log('  no Chrome found; skipping.'); process.exit(0); }
  try { await (await fetch(URL + 'api/status')).json(); }
  catch (e) { console.log('  server not running at ' + URL + '; start it with .\\start.cmd -NoBrowser'); process.exit(0); }

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,1000'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });
    const errors = [];
    page.on('pageerror', e => errors.push(String((e && e.message) || e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
    /* Start from a clean slate. Another suite may have left a saved game in
       this origin's localStorage, and the wizard behaves differently when it
       finds one — which made this suite pass alone and fail inside `npm test`. */
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* nothing to clear */ } });
    await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
    await wait(2000);

    /* A tiny in-page helper: set a control's value and fire the change setup
       listens for. Re-queried on every call because the builder rebuilds its
       own DOM on each edit. */
    await page.evaluate(() => {
      window.__set = (sel, val) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        el.value = val;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
      window.__check = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };
    });

    /* --------------------------------------------------------- setup -- */
    t.section('reaching the character builder');
    t.ok(await page.$('#modal-setup'), 'the setup modal is present');

    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#campaign-list button'));
      const sandbox = cards.filter(c => /sandbox/i.test(c.textContent))[0] || cards[2];
      sandbox.click();
    });
    await page.select('#dm-model', '');
    await wait(200);

    /* Turn the first seat into a built character. */
    await page.evaluate(() => window.__set('[data-f="chartype"]', 'build'));
    await wait(400);
    t.ok(await page.$('.build-host'), 'switching a seat to "build" reveals the builder');

    /* --------------------------------------------------- three modes -- */
    t.section('the three creation modes');
    const modes = await page.$$eval('.make-mode .mode-btn', b => b.map(x => x.textContent.trim()));
    t.eq(modes.length, 3, 'three creation modes are offered');
    t.ok(/myself/i.test(modes[0]), 'build-it-myself is one', '(' + modes[0] + ')');
    t.ok(modes.some(m => /surprise/i.test(m)), 'surprise-me is another');
    t.ok(modes.some(m => /random/i.test(m)), 'completely-random is the third');

    /* Every mode is reachable. */
    for (const m of ['surprise', 'random', 'manual']) {
      await page.evaluate((mode) => {
        Array.from(document.querySelectorAll('.mode-btn')).filter(b => b.getAttribute('data-mode') === mode)[0].click();
      }, m);
      await wait(200);
      const on = await page.$eval('.mode-btn[data-mode="' + m + '"]', b => b.classList.contains('on'));
      t.eq(on, true, 'the "' + m + '" mode is reachable and selectable');
    }

    /* ---------------------------------------------- live suggestions -- */
    t.section('live advice while building');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.mode-btn')).filter(b => b.getAttribute('data-mode') === 'manual')[0].click();
    });
    await wait(200);
    await page.evaluate(() => window.__set('[data-b="classId"]', 'fighter'));
    await wait(200);
    const advice = await page.$eval('[data-advice]', e => e.textContent);
    t.ok(/priority/i.test(advice), 'picking a class shows an ability priority', '(' + advice.slice(0, 40) + '…)');
    t.ok(advice.length > 30, 'and a real block of advice');

    /* A race that gives its class no help earns a gentle warning. */
    await page.evaluate(() => window.__set('[data-b="classId"]', 'wizard'));
    await wait(150);
    await page.evaluate(() => window.__set('[data-b="raceId"]', 'halfOrc'));
    await wait(200);
    const warn = await page.$eval('[data-advice]', e => (e.querySelector('.advice-warn') || {}).textContent || '');
    t.ok(/INT/i.test(warn), 'a mismatched race/class pair shows a warning', '(' + warn.slice(0, 50) + '…)');

    /* Suggested skills are tagged. */
    const suggestedTag = await page.$$eval('[data-skills] .tag.suggested', els => els.length);
    t.ok(suggestedTag > 0, 'recommended skills carry a "suggested" tag', '(' + suggestedTag + ')');

    /* ---------------------------------------- use suggested scores -- */
    t.section('use suggested scores');
    await page.evaluate(() => document.querySelector('[data-act="suggest-scores"]').click());
    await wait(200);
    const pool = await page.$eval('[data-pool]', e => e.textContent);
    t.ok(/27\s*\/\s*27/.test(pool), 'the button fills a legal 27-point spread', '(' + pool.trim() + ')');

    /* ------------------------------------------------- random hero -- */
    t.section('completely random');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.mode-btn')).filter(b => b.getAttribute('data-mode') === 'random')[0].click();
    });
    await wait(200);
    await page.evaluate(() => document.querySelector('[data-act="generate"]').click());
    await wait(300);

    const sig = () => page.evaluate(() => {
      const nm = document.querySelector('[data-b="name"]');
      const rc = document.querySelector('[data-b="raceId"]');
      const cl = document.querySelector('[data-b="classId"]');
      return [(nm && nm.value) || '', (rc && rc.value) || '', (cl && cl.value) || ''].join('|');
    });

    const first = await sig();
    t.ok(first.split('|')[0].length > 0, 'a whole character is generated, with a name', '(' + first + ')');
    /* Wait for the button to settle rather than assuming 300ms was enough.
       The builder revalidates asynchronously, and a fixed delay makes this
       assertion depend on how loaded the machine happens to be. */
    const beginEnabled = await page.waitForFunction(
      () => { const b = document.getElementById('btn-begin'); return b && !b.disabled; },
      { timeout: 5000 },
    ).then(() => true).catch(() => false);
    t.eq(beginEnabled, true, 'the generated character is valid — Begin is enabled');

    /* Reroll changes it (allow a few tries — the roll can repeat). */
    let changed = false;
    for (let i = 0; i < 6 && !changed; i++) {
      await page.evaluate(() => document.querySelector('[data-act="generate"]').click());
      await wait(250);
      if ((await sig()) !== first) changed = true;
    }
    t.eq(changed, true, 'Reroll produces a different character');

    /* ------------------------------------------------ pinning a race -- */
    t.section('surprise me, with a pin');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.mode-btn')).filter(b => b.getAttribute('data-mode') === 'surprise')[0].click();
    });
    await wait(200);
    await page.evaluate(() => window.__set('[data-b="raceId"]', 'dwarf'));
    await wait(200);
    await page.evaluate(() => window.__check('[data-pin="raceId"]'));
    await wait(100);
    await page.evaluate(() => document.querySelector('[data-act="generate"]').click());
    await wait(300);
    const pinnedRace = await page.$eval('[data-b="raceId"]', e => e.value);
    t.eq(pinnedRace, 'dwarf', 'a pinned lineage survives generation');

    /* ------------------------------------------------- backstory ---- */
    t.section('backstory affordances');
    t.ok(await page.$('[data-bs="gm"]'), 'the "ask the GM" control exists and is wired (not clicked here)');
    await page.evaluate(() => document.querySelector('[data-bs="seed"]').click());
    await wait(200);
    const seedText = await page.$eval('[data-b-text="backstory"]', e => e.value);
    t.ok(seedText.trim().length > 0, 'the seed button fills the backstory field', '(' + seedText.slice(0, 40) + '…)');

    await page.screenshot({ path: path.join(SHOTS, 'shot-cg-1-builder.png') });

    /* ------------------------------------------- death policy ------ */
    t.section('the campaign death policy picker');
    const policies = await page.evaluate(() => {
      const list = document.getElementById('dm-death-list');
      if (!list) return null;
      const opts = Array.from(list.querySelectorAll('.death-policy'));
      const checked = list.querySelector('input[name="dm-death"]:checked');
      return {
        count: opts.length,
        ids: opts.map(o => o.getAttribute('data-policy')),
        haveBlurbs: opts.every(o => (o.querySelector('.dp-blurb') || {}).textContent),
        defaultChecked: checked && checked.value,
      };
    });
    t.ok(policies, 'the "when someone dies" control is rendered');
    t.eq(policies.count, 4, 'all four policies are offered', '(' + policies.ids.join(', ') + ')');
    t.ok(policies.haveBlurbs, 'each policy shows an explanatory blurb');
    t.eq(policies.defaultChecked, 'standard', 'Standard is the default');
    /* Choose a non-default policy so the stored value proves the wiring. */
    await page.evaluate(() => {
      const g = document.querySelector('.death-policy[data-policy="gritty"] input');
      g.checked = true; g.dispatchEvent(new Event('change', { bubbles: true }));
    });

    /* ------------------------------------------------ reach play ---- */
    t.section('a built character reaches the table');
    /* Make sure the seat is valid: it was generated in surprise mode with a
       pinned dwarf, and a seed backstory is set. */
    const canBegin = await page.$eval('#btn-begin', b => !b.disabled);
    t.eq(canBegin, true, 'the built character is ready to play');
    await page.click('#btn-begin');
    await wait(3000);

    const play = await page.evaluate(() => {
      const s = window.DND.App && window.DND.App.session;
      if (!s) return { error: 'no session' };
      const a = s.state.actors.pc1;
      const badge = document.getElementById('death-policy-badge');
      return {
        actors: Object.keys(s.state.actors).length,
        backstory: a && a.base && a.base.backstory,
        name: a && a.name,
        levels: a && a.progression && a.progression.levels.length,
        deathPolicy: s.state.meta && s.state.meta.deathPolicy,
        badgeText: badge && !badge.hidden ? badge.textContent : '',
      };
    });
    t.eq(play.error, undefined, 'a live session exists', play.error || '');
    t.ok(typeof play.backstory === 'string' && play.backstory.length > 0,
      'the character reaches play with base.backstory set', '(' + String(play.backstory).slice(0, 40) + '…)');
    t.eq(play.deathPolicy, 'gritty', 'the chosen death policy reaches state.meta');
    t.ok(/gritty/i.test(play.badgeText), 'the party panel shows the death-policy badge', '(' + play.badgeText + ')');

    /* -------------------------------------------------- level-up ---- */
    t.section('the guided level-up');
    const levelsBefore = play.levels;
    t.eq(levelsBefore, 1, 'the built character starts at level 1');

    /* Grant enough experience for one level and re-render the panels. */
    await page.evaluate(() => {
      window.DND.App.session.state.actors.pc1.progression.xp = 500;
      window.DND.Party.render();
      window.DND.Sheet.render();
    });
    await wait(300);
    const chip = await page.$('#party-list .levelup-chip');
    t.ok(chip, 'a "level up" affordance appears on the party panel');

    /* Open the modal from the affordance. */
    await page.evaluate(() => document.querySelector('#party-list .levelup-chip').click());
    await wait(400);
    const modalOpen = await page.evaluate(() => {
      const m = document.getElementById('modal-levelup');
      return !!m && !m.classList.contains('hidden');
    });
    t.eq(modalOpen, true, 'the level-up modal opens');

    /* Every group in the modal comes from optionsFor — not a hard-coded list. */
    const groupCheck = await page.evaluate(() => {
      const engine = window.DND.Game.levelUpFor(window.DND.App.session, 'pc1', {}).options.groups.length;
      const dom = document.querySelectorAll('#levelup-groups .levelup-group').length;
      return { engine, dom };
    });
    t.ok(groupCheck.dom > 0, 'the modal renders option groups', '(' + groupCheck.dom + ')');
    t.eq(groupCheck.dom, groupCheck.engine, 'and exactly the groups optionsFor produced');

    /* "Choose for me" fills a legal set; confirm then becomes available. */
    await page.evaluate(() => document.getElementById('levelup-auto').click());
    await wait(300);
    const confirmReady = await page.$eval('#levelup-confirm', b => !b.disabled);
    t.eq(confirmReady, true, '"Choose for me" fills a valid, confirmable set of choices');

    await page.screenshot({ path: path.join(SHOTS, 'shot-cg-2-levelup.png') });

    await page.evaluate(() => document.getElementById('levelup-confirm').click());
    await wait(1200);
    const afterLevel = await page.evaluate(() =>
      window.DND.Game.selfView(window.DND.App.session, 'pc1').progression.levels.length);
    t.eq(afterLevel, levelsBefore + 1, 'confirming actually advances the level', '(' + levelsBefore + ' -> ' + afterLevel + ')');

    /* And it is undoable with the ordinary Undo button. */
    const undoEnabled = await page.$eval('#btn-undo', b => !b.disabled);
    t.eq(undoEnabled, true, 'the Undo button is enabled after a level-up');
    await page.click('#btn-undo');
    await wait(1000);
    const afterUndo = await page.evaluate(() =>
      window.DND.Game.selfView(window.DND.App.session, 'pc1').progression.levels.length);
    t.eq(afterUndo, levelsBefore, 'Undo takes the level back', '(' + afterLevel + ' -> ' + afterUndo + ')');

    /* -------------------------------------------------- no errors --- */
    t.section('nothing broke along the way');
    const realErrors = errors.filter(e => !/favicon|DevTools|Autofill/i.test(e));
    t.eq(realErrors.length, 0, 'no console errors during the whole flow',
      realErrors.length ? '\n      ' + realErrors.slice(0, 5).join('\n      ') : '');

    await page.screenshot({ path: path.join(SHOTS, 'shot-cg-3-end.png') });
    console.log('\n  screenshots: shot-cg-1-builder .. shot-cg-3-end');
  } finally {
    await browser.close();
  }

  t.done();
}

main().catch(e => { console.error(e); process.exit(1); });
