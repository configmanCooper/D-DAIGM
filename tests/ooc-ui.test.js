/*
 * tests/ooc-ui.test.js — the OOC question, driven in a real browser.
 *
 * The unit suite proves the engine never moves when a question is asked. This
 * proves the part the player actually touches: typing "OOC: ..." into the
 * composer must reach the Dungeon Master, must NOT raise the confirm dialog
 * that every real action raises, and must not cost the turn.
 *
 * Assumes the server is running:  .\start.cmd -NoBrowser
 */
'use strict';
const t = require('./_harness')('ooc-ui');
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

/* "Visible" measured by the box the player could actually see. Checking
   `offsetParent` or `hidden` proved unreliable here: the page keeps several
   permanently-mounted modal shells (#modal-confirm, #modal-setup) that are
   display:none with a zero-sized rect, and they were being counted. */
function openDialogCount(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.modal, #modal, [role="dialog"]'))
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
      }).length);
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

    /* A canned answer, so this test is about the wiring rather than latency. */
    await page.evaluate(() => {
      window.DND.Backend.configure({
        kind: 'fixture',
        fixtures: { '*': 'A grapple is a contest of Athletics, and asking never costs a turn.' },
      });
    });

    const before = await page.evaluate(() => {
      const s = window.DND.App.session;
      return {
        rev: s.state.revision,
        epoch: s.state.turnEpoch,
        active: s.state.activeActorId,
        batches: s.state.log.length,
      };
    });
    /* Whatever is already on screen when the question is asked. Asserting an
       absolute zero here was wrong: the opening scene leaves panels mounted,
       so the meaningful claim is that asking a question opens NOTHING NEW. */
    const dialogsBefore = await openDialogCount(page);

    /* Typed exactly as a player would type it. */
    await page.click('#say');
    await page.type('#say', 'OOC: how does grappling work?');
    await page.keyboard.press('Enter');
    await wait(2500);

    const after = await page.evaluate(() => {
      const s = window.DND.App.session;
      const log = document.getElementById('log');
      return {
        rev: s.state.revision,
        epoch: s.state.turnEpoch,
        active: s.state.activeActorId,
        batches: s.state.log.length,
        oocEntries: document.querySelectorAll('.entry.ooc').length,
        logText: log ? log.textContent.slice(-1500) : '',
        inputValue: document.getElementById('say').value,
        composerDisabled: !!document.getElementById('say').disabled,
      };
    });
    const dialogsAfterOoc = await openDialogCount(page);

    t.section('asking a question never reaches the engine');
    t.eq(after.rev, before.rev, 'the state revision did not move');
    t.eq(after.epoch, before.epoch, 'the turn epoch did not move');
    t.eq(after.active, before.active, 'it is still the same character\u2019s turn');
    t.eq(after.batches, before.batches, 'no event batch was committed');

    t.section('and it is not treated as an action');
    t.eq(dialogsAfterOoc, dialogsBefore,
      'asking opened no new dialog \u2014 a question is not an action to approve',
      '(' + dialogsBefore + ' before, ' + dialogsAfterOoc + ' after)');
    t.ok(after.oocEntries > 0, 'the question is shown in the log as an aside');
    t.ok(/grapple is a contest/i.test(after.logText),
      'and the Dungeon Master\u2019s answer arrives in the log');
    t.eq(after.inputValue, '', 'the composer is cleared, ready for the next thing');
    t.eq(after.composerDisabled, false, 'and unlocked again afterwards');

    t.section('the spellings and spacing a player will really use');
    const forms = ['ooc: what is my AC?', 'OOC:no space', '   OOC:   padded   ', 'Ooc, casual'];
    for (const typed of forms) {
      const q = await page.evaluate(
        (text) => (window.DND.App.oocQuestion ? window.DND.App.oocQuestion(text) : null),
        typed).catch(() => null);
      t.ok(!!q, JSON.stringify(typed) + ' is recognised as a question', '(got ' + JSON.stringify(q) + ')');
    }
    const notOoc = await page.evaluate(
      () => window.DND.App.oocQuestion('I look for the ooc: marking on the crate'));
    t.eq(notOoc, null, 'but "OOC:" in the MIDDLE of a sentence is still an action');

    t.section('a normal action is still confirmed \u2014 the control');
    {
      const revBefore = await page.evaluate(() => window.DND.App.session.state.revision);
      await page.click('#say');
      await page.type('#say', 'I look around the room');
      await page.keyboard.press('Enter');
      await wait(3000);
      const dialogs = await openDialogCount(page);
      const revAfter = await page.evaluate(() => window.DND.App.session.state.revision);
      /* Without this the OOC checks prove nothing in particular: if ordinary
         input ALSO opened no dialog and moved nothing, every assertion above
         would pass on a page that simply ignores the composer entirely. */
      t.ok(dialogs > dialogsBefore || revAfter !== revBefore,
        'ordinary typed input does something \u2014 it opens a confirm dialog, or ' +
        'it resolves \u2014 so the OOC checks above mean what they say',
        '(dialogs ' + dialogsBefore + '\u2192' + dialogs +
        ', revision ' + revBefore + '\u2192' + revAfter + ')');
    }

    t.section('nothing threw');
    t.deep(errors.filter(e => !/favicon|ERR_FILE|ERR_NETWORK/.test(e)), [],
      'no page errors during the exchange');

  } finally {
    await browser.close();
  }
  t.done();
}

main().catch(e => { console.error(e); process.exit(1); });
