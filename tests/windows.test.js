/*
 * tests/windows.test.js — the floating panels, driven the way a player uses
 * them, in a real browser.
 *
 * Every check here corresponds to something an independent UI review found
 * wrong with the first version of the window manager. They are grouped by what
 * a player would notice, because a panel that covers the text box you type
 * into is a different order of problem from a button whose label is stale.
 *
 * Assumes the server is running:  .\start.cmd -NoBrowser
 */
'use strict';
const t = require('./_harness')('windows');
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
].filter(p => { try { return fs.existsSync(p); } catch (e) { return false; } })[0];

const PORT = process.env.PORT || 8177;
const URL = 'http://127.0.0.1:' + PORT + '/';
const wait = ms => new Promise(r => setTimeout(r, ms));

async function begin(page) {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* nothing */ } });
  await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
  await wait(2200);
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#campaign-list .campaign-card'));
    if (cards.length) cards[0].click();
  });
  await wait(400);
  try { await page.select('#dm-model', ''); } catch (e) { /* offline anyway */ }
  await page.evaluate(() => { const b = document.getElementById('btn-begin'); if (b) b.click(); });
  await wait(4500);
}

async function main() {
  if (!CHROME) { console.log('  no Chrome found; skipping.'); process.exit(0); }
  try { await (await fetch(URL + 'api/status')).json(); }
  catch (e) { console.log('  server not running at ' + URL); process.exit(0); }

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
    await begin(page);

    /* ------------------------------------------------------ the story --- */
    t.section('the narration gets the page');
    const room = await page.evaluate(() => {
      const log = document.getElementById('log').getBoundingClientRect();
      return { logH: Math.round(log.height), viewH: window.innerHeight };
    });
    t.ok(room.logH > room.viewH * 0.5,
      'the log fills more than half the window, rather than being a strip',
      '(' + room.logH + ' of ' + room.viewH + ')');

    /* ----------------------------------------------------- the panels --- */
    t.section('opening and closing a panel');
    const dock = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#dock .dock-btn[data-win]')).map(b => b.getAttribute('data-win')));
    t.ok(dock.length >= 4, 'every panel has a dock button', '(' + dock.join(', ') + ')');

    await page.evaluate(() => window.DND.Windows.open('sheet'));
    await wait(400);
    const opened = await page.evaluate(() => ({
      open: window.DND.Windows.isOpen('sheet'),
      pressed: document.querySelector('#dock [data-win="sheet"]').getAttribute('aria-pressed'),
    }));
    t.eq(opened.open, true, 'the sheet opens');
    t.eq(opened.pressed, 'true', 'and the dock button says so to a screen reader');

    /* --- the finding that mattered most: a panel must not cover the controls
       that dismiss it, or the text box the player types into --- */
    t.section('a panel never covers the composer or the dock');
    const overlap = await page.evaluate(() => {
      const W = window.DND.Windows;
      W.ids().forEach(id => W.open(id));
      const composer = document.getElementById('composer').getBoundingClientRect();
      const dockBox = document.getElementById('dock').getBoundingClientRect();
      const hits = [];
      W.ids().forEach(id => {
        const el = document.getElementById('win-' + id);
        if (!el || el.hidden) return;
        const b = el.getBoundingClientRect();
        const over = (o) => !(b.right <= o.left || b.left >= o.right ||
          b.bottom <= o.top || b.top >= o.bottom);
        if (over(composer)) hits.push(id + ' over the composer');
        if (over(dockBox)) hits.push(id + ' over the dock');
      });
      return hits;
    });
    t.deep(overlap, [], 'with every panel open, none of them sits on the controls');

    /* ------------------------------------------------- window controls --- */
    t.section('a window can be moved, resized, rolled up and closed');
    const ops = await page.evaluate(() => {
      const W = window.DND.Windows;
      const win = document.getElementById('win-sheet');
      const bar = win.querySelector('.win-bar');
      const before = W.stateOf('sheet');
      const b = bar.getBoundingClientRect();
      const send = (type, x, y) => bar.dispatchEvent(new PointerEvent(type, {
        bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true,
      }));
      /* Up and to the left, which is where the room is. Dragging DOWN is
         correctly refused — the clamp keeps a window off the composer — so a
         test that insisted on downward movement would be asserting the bug
         rather than the fix. */
      send('pointerdown', b.left + 40, b.top + 8);
      send('pointermove', b.left + 40 - 150, b.top + 8 - 120);
      send('pointerup', b.left + 40 - 150, b.top + 8 - 120);
      const moved = W.stateOf('sheet');

      win.querySelector('[data-act="min"]').click();
      const min = W.stateOf('sheet');
      const minLabel = win.querySelector('[data-act="min"]').getAttribute('aria-label');
      win.querySelector('[data-act="min"]').click();

      win.querySelector('[data-act="max"]').click();
      const max = W.stateOf('sheet');
      const maxLabel = win.querySelector('[data-act="max"]').getAttribute('aria-label');
      win.querySelector('[data-act="max"]').click();

      win.querySelector('[data-act="close"]').click();
      return {
      movedX: moved.x !== before.x, movedY: moved.y !== before.y,
        min: min.min, minLabel, max: max.max, maxLabel,
        openAfterClose: W.isOpen('sheet'),
      };
    });
    t.ok(ops.movedX && ops.movedY, 'dragging the title bar moves it');
    t.eq(ops.min, true, 'the minimise button rolls it up');
    t.ok(/restore/i.test(ops.minLabel),
      'and then calls itself Restore, not Minimise', '(' + ops.minLabel + ')');
    t.eq(ops.max, true, 'the maximise button maximises it');
    t.ok(/restore/i.test(ops.maxLabel),
      'and then calls itself Restore too', '(' + ops.maxLabel + ')');
    t.eq(ops.openAfterClose, false, 'and the close button closes it');

    /* ----------------------------------------------------- the keyboard -- */
    t.section('a window can be driven from the keyboard alone');
    const keys = await page.evaluate(() => {
      const W = window.DND.Windows;
      W.open('sheet');
      const bar = document.querySelector('#win-sheet .win-bar');
      const before = W.stateOf('sheet');
      const key = (k, shift) => bar.dispatchEvent(new KeyboardEvent('keydown', {
        key: k, shiftKey: !!shift, bubbles: true, cancelable: true,
      }));
      key('ArrowLeft'); key('ArrowUp');
      const moved = W.stateOf('sheet');
      key('ArrowRight', true);
      const sized = W.stateOf('sheet');
      return {
        focusable: bar.getAttribute('tabindex') === '0',
        movedLeft: moved.x < before.x,
        movedUp: moved.y < before.y,
        widened: sized.w > moved.w,
        labelled: (bar.getAttribute('aria-label') || ''),
      };
    });
    t.eq(keys.focusable, true, 'the title bar takes focus');
    t.ok(keys.movedLeft && keys.movedUp, 'arrow keys move the window');
    t.eq(keys.widened, true, 'and shift with an arrow resizes it');
    t.ok(/arrow/i.test(keys.labelled),
      'and it says how', '(' + keys.labelled.slice(0, 60) + ')');

    /* --------------------------------------------------------- z-order --- */
    t.section('focus brings a window to the front');
    const z = await page.evaluate(() => {
      const W = window.DND.Windows;
      W.open('party'); W.open('sheet');
      const partyEl = document.getElementById('win-party');
      const sheetEl = document.getElementById('win-sheet');
      const sheetZ = parseInt(sheetEl.style.zIndex || '0', 10);
      partyEl.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      return {
        raised: parseInt(partyEl.style.zIndex || '0', 10) > sheetZ,
        activeClass: partyEl.classList.contains('active'),
        otherNotActive: !sheetEl.classList.contains('active'),
      };
    });
    t.eq(z.raised, true, 'tabbing into a window behind another raises it');
    t.eq(z.activeClass, true, 'and it is marked as the active one');
    t.eq(z.otherNotActive, true, 'while the other is not');

    /* ----------------------------------------------------- persistence --- */
    t.section('the layout is remembered');
    await page.evaluate(() => {
      const W = window.DND.Windows;
      W.open('sheet');
      W.close('party');
    });
    await wait(300);
    const wanted = await page.evaluate(() => window.DND.Windows.stateOf('sheet'));
    await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
    await wait(2500);
    const recalled = await page.evaluate(() => ({
      sheet: window.DND.Windows.stateOf('sheet'),
      party: window.DND.Windows.isOpen('party'),
    }));
    t.eq(recalled.sheet.x, wanted.x, 'a window comes back where it was left');
    t.eq(recalled.sheet.w, wanted.w, 'at the size it was left');
    t.eq(recalled.party, false, 'and a closed panel stays closed');

    /* A window dragged off the screen must come back, or it is lost. */
    t.section('a window cannot be lost off the edge');
    const rescued = await page.evaluate(() => {
      const W = window.DND.Windows;
      W.open('sheet');
      const bar = document.querySelector('#win-sheet .win-bar');
      const b = bar.getBoundingClientRect();
      const send = (type, x, y) => bar.dispatchEvent(new PointerEvent(type, {
        bubbles: true, clientX: x, clientY: y, pointerId: 2, isPrimary: true,
      }));
      send('pointerdown', b.left + 20, b.top + 8);
      send('pointermove', -4000, -4000);
      send('pointerup', -4000, -4000);
      const s = W.stateOf('sheet');
      const box = document.getElementById('win-sheet').getBoundingClientRect();
      return {
        onScreen: box.right > 0 && box.left < window.innerWidth &&
          box.bottom > 0 && box.top < window.innerHeight,
        x: s.x, y: s.y,
      };
    });
    t.eq(rescued.onScreen, true,
      'dragged to the far corner of nowhere, it is clamped back',
      '(' + rescued.x + ',' + rescued.y + ')');

    /* ------------------------------------------------------- the phone --- */
    t.section('on a phone, one panel at a time');
    const phone = await browser.newPage();
    await phone.setViewport({ width: 420, height: 860 });
    await phone.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
    await begin(phone);
    const small = await phone.evaluate(() => {
      const W = window.DND.Windows;
      const openCount = () => W.ids().filter(id => W.isOpen(id)).length;
      const atBoot = openCount();
      W.open('sheet');
      const afterSheet = W.ids().filter(id => W.isOpen(id));
      W.open('party');
      const afterParty = W.ids().filter(id => W.isOpen(id));
      const composer = document.getElementById('composer').getBoundingClientRect();
      const win = document.getElementById('win-party').getBoundingClientRect();
      return {
        atBoot, afterSheet, afterParty,
        coversComposer: !(win.bottom <= composer.top || win.top >= composer.bottom),
      };
    });
    t.eq(small.atBoot, 0, 'no panel opens itself on a phone \u2014 the story has the screen');
    t.deep(small.afterSheet, ['sheet'], 'opening one shows exactly that one');
    t.deep(small.afterParty, ['party'],
      'and opening another replaces it, rather than hiding behind it');
    t.eq(small.coversComposer, false, 'and it never sits on the text box');

    t.section('nothing broke along the way');
    t.eq(errors.length, 0, 'no console errors', errors.slice(0, 3).join(' | '));
    if (errors.length) console.log('  ERRORS: ' + JSON.stringify(errors.slice(0,5), null, 1));
  } finally {
    await browser.close();
  }
  t.done();
}

main();
