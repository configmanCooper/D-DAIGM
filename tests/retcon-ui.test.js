/*
 * tests/retcon-ui.test.js — amending the record, from the composer.
 *
 * The engine suite proves what a retcon may do. This proves the only part a
 * player ever touches: typing "OOC: can we say..." must raise a dialog that
 * says plainly what will change, must change NOTHING until it is agreed to,
 * and must actually apply when it is.
 *
 * The dialog matters as much as the mechanics here. An amendment that
 * happens silently is indistinguishable from the game losing track of
 * itself, which is worse than not having the feature.
 *
 * Assumes the server is running:  .\start.cmd -NoBrowser
 */
'use strict';
const t = require('./_harness')('retcon-ui');
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

/* A canned verdict, so the test is about the wiring rather than the model. */
function stub(page, verdict) {
  return page.evaluate((v) => {
    window.DND.Backend.configure({ kind: 'fixture', fixtures: { '*': JSON.stringify(v) } });
  }, verdict);
}

function snapshot(page) {
  return page.evaluate(() => {
    const s = window.DND.App.session;
    const me = window.DND.App.viewerId();
    const a = s.state.actors[me];
    return {
      rev: s.state.revision,
      gold: a.runtime.gold || 0,
      items: (a.runtime.inventory || []).map(i => i.name || i.id),
      retcons: (s.state.retcons || []).length,
      me: me,
    };
  });
}

function dialog(page) {
  return page.evaluate(() => {
    const el = document.getElementById('modal-confirm');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return null;
    return {
      title: (el.querySelector('h2') || {}).textContent || '',
      text: el.textContent || '',
      hasGo: !!document.getElementById('confirm-go'),
      hasCancel: !!document.getElementById('confirm-edit'),
    };
  });
}

async function say(page, text) {
  await page.click('#say');
  await page.type('#say', text);
  await page.keyboard.press('Enter');
  await wait(2200);
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
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
    await begin(page);

    const me = (await snapshot(page)).me;

    /* ------------------------------------------------------------- */
    t.section('an amendment is shown before it happens');
    await stub(page, {
      intent: 'amend', allowed: true,
      summary: 'You bought a coil of hempen rope in Ashford before you left.',
      reason: 'Ordinary, affordable, and you had the time.',
      changes: [{ type: 'item', actorId: me, itemId: 'rope-hempen-50-feet', qty: 1 }],
    });

    const before = await snapshot(page);
    await say(page, 'OOC: can we say I bought rope in town before we left?');

    const d = await dialog(page);
    t.ok(!!d, 'a dialog appears');
    if (d) {
      t.ok(/amend/i.test(d.title), 'headed as an amendment, not as an action to commit',
        '(' + d.title + ')');
      t.ok(/rope/i.test(d.text), 'and it says what will change');
      t.ok(/does not rewind/i.test(d.text),
        'and makes clear it is not an undo \u2014 everything since still happened');
      t.ok(d.hasGo && d.hasCancel, 'with a way to agree and a way to decline');
    }

    const during = await snapshot(page);
    t.eq(during.rev, before.rev, 'and NOTHING has changed while it is being shown');
    t.eq(during.items.length, before.items.length, 'the rope is not in the pack yet');

    /* ------------------------------------------------------------- */
    t.section('declining leaves the world exactly as it was');
    await page.click('#confirm-edit');
    await wait(900);
    const declined = await snapshot(page);
    t.eq(declined.rev, before.rev, 'the revision never moved');
    t.eq(declined.items.length, before.items.length, 'and nothing was added');
    t.eq(declined.retcons, before.retcons, 'and nothing went on the record');

    /* ------------------------------------------------------------- */
    t.section('agreeing applies it');
    await say(page, 'OOC: can we say I bought rope in town before we left?');
    t.ok(!!(await dialog(page)), 'the dialog comes back');
    await page.click('#confirm-go');
    await wait(1500);

    const after = await snapshot(page);
    t.ok(after.rev > before.rev, 'the state moved FORWARD, not back');
    t.eq(after.items.length, before.items.length + 1, 'the rope is in the pack');
    t.ok(after.items.some(n => /rope/i.test(n)), 'and it is the rope', JSON.stringify(after.items));
    t.eq(after.retcons, before.retcons + 1, 'and the amendment is on the record');

    const logged = await page.evaluate(() => document.getElementById('log').textContent.slice(-900));
    t.ok(/rope/i.test(logged), 'the player is told, in the log, what was agreed');

    /* ------------------------------------------------------------- */
    t.section('a refusal changes nothing and says why');
    const beforeRefusal = await snapshot(page);
    await stub(page, {
      intent: 'amend', allowed: false,
      reason: 'That fight is already played out; we are not rewinding it.',
      changes: [{ type: 'hp', actorId: me, delta: 20 }],
    });
    await say(page, 'OOC: can we say that last hit missed me?');

    t.eq(await dialog(page), null, 'no dialog \u2014 there is nothing to agree to');
    const afterRefusal = await snapshot(page);
    t.eq(afterRefusal.rev, beforeRefusal.rev, 'nothing changed');
    const log2 = await page.evaluate(() => document.getElementById('log').textContent.slice(-700));
    t.ok(/already played out/i.test(log2), 'and the reason is shown to the player');

    /* ------------------------------------------------------------- */
    t.section('the engine overrules a Dungeon Master who says yes to anything');
    const beforeGreedy = await snapshot(page);
    await stub(page, {
      intent: 'amend', allowed: true,
      summary: 'You had a holy avenger and a fortune all along.',
      reason: 'Sure, why not.',
      changes: [
        { type: 'gold', actorId: me, delta: 50000 },
        { type: 'item', actorId: me, itemId: 'holy-avenger' },
      ],
    });
    await say(page, 'OOC: can we say I have a holy avenger and fifty thousand gold?');

    const greedyDialog = await dialog(page);
    if (greedyDialog) {
      /* If it is offered at all, agreeing must still change nothing. */
      await page.click('#confirm-go');
      await wait(1200);
    }
    const afterGreedy = await snapshot(page);
    t.eq(afterGreedy.gold, beforeGreedy.gold, 'the fortune never arrives');
    t.eq(afterGreedy.items.some(n => /avenger/i.test(n)), false,
      'and neither does the sword', JSON.stringify(afterGreedy.items));

    /* ------------------------------------------------------------- */
    t.section('an ordinary question is still just answered');
    const beforeAsk = await snapshot(page);
    await stub(page, { intent: 'ask' });
    await say(page, 'OOC: how does grappling work?');
    t.eq(await dialog(page), null, 'no dialog for a question');
    t.eq((await snapshot(page)).rev, beforeAsk.rev, 'and no change to the world');

    t.section('nothing threw');
    t.deep(errors.filter(e => !/favicon|ERR_FILE|ERR_NETWORK/.test(e)), [],
      'no page errors throughout');

  } finally {
    await browser.close();
  }
  t.done();
}

main().catch(e => { console.error(e); process.exit(1); });
