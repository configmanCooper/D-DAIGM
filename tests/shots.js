/**
 * shots.js — photograph the interface.
 *
 * Screenshots of every screen and panel, so a review can judge what a player
 * actually sees rather than what the markup implies. A UI review done by
 * reading CSS is a review of intentions.
 *
 *     node tests/shots.js            the default sweep
 *     node tests/shots.js --dir out  somewhere else
 */
'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const URL = 'http://127.0.0.1:8177/index.html';
const CHROME = process.env.CHROME ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const argDir = process.argv.indexOf('--dir');
const OUT = path.join(__dirname, '..', argDir > 0 ? process.argv[argDir + 1] : 'shots');

const wait = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME,
    defaultViewport: { width: 1600, height: 1000 },
  });

  const notes = [];
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e.message)));

  async function shot(name, note) {
    const file = path.join(OUT, name + '.png');
    await page.screenshot({ path: file });
    notes.push({ name, note });
    console.log('  ' + name.padEnd(28) + (note || ''));
  }

  try {
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* nothing */ } });
    await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
    await wait(2500);

    console.log('\n  photographing the interface\n');

    /* ---------------------------------------------------------- setup -- */
    await shot('01-setup-campaign', 'the first thing anyone sees');

    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#campaign-list button'));
      (cards.filter(c => /sandbox/i.test(c.textContent))[0] || cards[2]).click();
    });
    await wait(500);
    await shot('02-setup-chosen', 'a campaign selected');

    /* The character builder, in each of its three modes. */
    const opened = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button'))
        .filter(x => /build|create|character/i.test(x.textContent))[0];
      if (b) { b.click(); return b.textContent.trim(); }
      return null;
    });
    await wait(800);
    if (opened) await shot('03-builder', 'the character builder (' + opened + ')');

    /* --------------------------------------------------------- table -- */
    await page.evaluate(() => {
      const m = document.getElementById('modal-chargen');
      if (m) { const c = m.querySelector('[data-act="cancel"], .close, #btn-cg-cancel'); if (c) c.click(); }
    });
    await wait(400);
    await page.select('#dm-model', '').catch(() => {});
    await page.click('#btn-begin');
    await wait(3500);
    await shot('04-table', 'the table, mid-encounter');

    /* Each context tab. */
    for (const tab of ['sheet', 'inventory', 'journal', 'watch']) {
      const ok = await page.evaluate(id => {
        const el = document.getElementById('tab-' + id);
        if (!el) return false;
        el.click(); return true;
      }, tab);
      if (!ok) continue;
      await wait(700);
      await shot('05-tab-' + tab, 'the ' + tab + ' panel');
    }

    /* A turn taken, so the log has content and the battle map has moved. */
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#actionbar button'))
        .filter(x => /^Attack/i.test(x.textContent.trim()))[0];
      if (b) b.click();
    });
    await wait(3000);
    await shot('06-after-a-turn', 'after attacking');

    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#actionbar button'))
        .filter(x => /end turn/i.test(x.textContent))[0];
      if (b) b.click();
    });
    await wait(4000);
    await shot('07-monsters-replied', 'after the monsters have had their turn');

    /* The action bar on its own, which is where most of the interaction is. */
    const bar = await page.$('#actionbar');
    if (bar) {
      await bar.screenshot({ path: path.join(OUT, '08-actionbar.png') });
      notes.push({ name: '08-actionbar', note: 'the action bar close up' });
      console.log('  08-actionbar                 the action bar close up');
    }

    /* ------------------------------------------------------ responsive -- */
    for (const [w, h, label] of [[1280, 800, 'laptop'], [1024, 720, 'small'], [820, 900, 'tablet']]) {
      await page.setViewport({ width: w, height: h });
      await wait(700);
      await shot('09-size-' + label, w + 'x' + h);
    }
    await page.setViewport({ width: 1600, height: 1000 });

    /* --------------------------------------------------------- a11y -- */
    const audit = await page.evaluate(() => {
      const out = {};
      const q = s => Array.from(document.querySelectorAll(s));

      out.buttonsWithoutText = q('button')
        .filter(b => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.title)
        .length;
      out.imagesWithoutAlt = q('img').filter(i => !i.alt).length;
      out.inputsWithoutLabel = q('input,select,textarea').filter(i => {
        if (i.getAttribute('aria-label') || i.getAttribute('aria-labelledby')) return false;
        if (i.id && document.querySelector('label[for="' + i.id + '"]')) return false;
        return !i.closest('label');
      }).length;
      out.landmarks = q('main,nav,aside,header,footer,[role]').length;
      out.liveRegions = q('[aria-live]').length;
      out.focusable = q('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])').length;
      out.headings = q('h1,h2,h3,h4').map(h => h.tagName + ': ' + h.textContent.trim().slice(0, 40));
      out.canvases = q('canvas').map(c => ({
        id: c.id, w: c.width, h: c.height,
        label: c.getAttribute('aria-label') || c.getAttribute('role') || null,
      }));
      /* Anything that has scrolled off its own box. */
      out.overflowing = q('*').filter(el => {
        if (!el.getBoundingClientRect().width) return false;
        return el.scrollWidth > el.clientWidth + 4 && getComputedStyle(el).overflowX === 'visible';
      }).map(el => el.id || el.className || el.tagName).slice(0, 10);
      return out;
    });

    fs.writeFileSync(path.join(OUT, 'audit.json'),
      JSON.stringify({ audit, errors, shots: notes }, null, 2));

    console.log('\n  accessibility and layout audit');
    Object.keys(audit).forEach(k => {
      const v = audit[k];
      console.log('    ' + k.padEnd(22) + (Array.isArray(v) ? v.length + (v.length ? ': ' + JSON.stringify(v).slice(0, 90) : '') : v));
    });
    console.log('\n  console errors: ' + (errors.length ? errors.slice(0, 3).join(' | ') : 'none'));
    console.log('  written to ' + OUT);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
