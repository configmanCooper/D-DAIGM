/*
 * tests/resume.test.js — can a player get back into a saved game?
 *
 * The engine has had `Save.saveLocal` and `Save.loadLocal` since the first
 * build, and the top bar has had a Save button. Nothing ever called
 * `loadLocal`, so Save was a one-way door: a player could write a save and had
 * no way in the interface to open it again. These checks go through the real
 * page — the real wizard, the real Save button, a real reload — because the
 * whole bug was that the pieces existed and nothing joined them up.
 */
'use strict';

const t = require('./_harness')('resume');
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
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewport({ width: 1600, height: 1000 });
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* nothing */ } });
    await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
    await wait(2500);

    /* ------------------------------------------------ nothing to resume -- */
    t.section('with no save, only the way in from disk is offered');
    /* This used to assert the step stayed hidden, which was the bug: the step
       is the only place a save FILE can be offered, so hiding it whenever this
       browser held no save meant a player who had exported a game to disk had
       no route back into it. What must be absent is the Resume card; what must
       be present is the file loader. */
    const clean = await page.evaluate(() => {
      const s = document.getElementById('setup-step-resume');
      return {
        stepVisible: !!s && !s.hidden,
        resumeCard: !!document.getElementById('btn-resume'),
        importControl: !!document.getElementById('import-save-file'),
      };
    });
    t.eq(clean.resumeCard, false, 'nothing is offered to resume on a first visit');
    t.eq(clean.stepVisible, true, 'but the step itself is shown');
    t.eq(clean.importControl, true, 'because it carries the way in from a save file');

    /* ------------------------------------------------------ play a bit -- */
    t.section('play, then save');
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#campaign-list button'));
      (cards.filter(c => /sandbox/i.test(c.textContent))[0] || cards[2]).click();
    });
    await wait(400);
    await page.select('#dm-model', '');
    await page.click('#btn-begin');
    await wait(3000);

    // Take a turn so the save has something in it that a fresh game would not.
    const verb = (await Promise.all((await page.$$('#actionbar button')).map(async h =>
      ({ h, text: await page.evaluate(e => e.textContent, h) }))))
      .filter(x => /attack/i.test(x.text))[0];
    if (verb) {
      await verb.h.click();
      await wait(300);
      const targets = await page.$$('#actionbar .target-btn');
      if (targets.length) await targets[0].click();
      await wait(2500);
    }

    const before = await page.evaluate(() => {
      const s = window.DND.App.session;
      return {
        revision: s.state.revision,
        actors: Object.keys(s.state.actors).length,
        campaign: s.campaign && s.campaign.id,
        seed: s.state.seed,
        names: Object.keys(s.state.actors).map(id => s.state.actors[id].name).sort(),
        hp: Object.keys(s.state.actors).map(id => s.state.actors[id].runtime.hp),
        transcript: s.state.transcript.length,
      };
    });
    t.ok(before.revision > 0, 'the game advanced before saving', '(revision ' + before.revision + ')');

    await page.click('#btn-save');
    await wait(1200);
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem(window.DND.Save.STORAGE_KEY);
      if (!raw) return null;
      const b = JSON.parse(raw);
      return {
        title: b.title, savedAt: b.savedAt, campaignId: b.campaignId,
        /* The revision the save ACTUALLY recorded. Comparing against a value
           captured before the click made this a race: an AI seat or a monster
           taking its turn in between advanced the game by one, and the test
           failed for a reason that had nothing to do with resuming. */
        revision: b.state && b.state.revision,
      };
    });
    t.ok(!!saved, 'the Save button writes a slot');
    t.ok(saved && !!saved.title, 'and the slot carries a readable title', '(' + (saved && saved.title) + ')');
    t.ok(saved && !!saved.savedAt, 'and when it was written');

    /* --------------------------------------------------------- resume -- */
    t.section('come back and resume');
    await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
    await wait(2500);

    const offered = await page.evaluate(() => {
      const step = document.getElementById('setup-step-resume');
      const btn = document.getElementById('btn-resume');
      return {
        visible: !!step && !step.hidden,
        text: btn ? btn.textContent.trim() : null,
        /* Nothing may be covering it — an invisible full-screen dialog once
           swallowed every real click in the application. */
        clickable: (() => {
          if (!btn) return false;
          const b = btn.getBoundingClientRect();
          const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return top === btn || btn.contains(top);
        })(),
      };
    });
    t.eq(offered.visible, true, 'the saved game is offered on the next visit');
    t.ok(offered.text && /resume/i.test(offered.text), 'the card says what it does',
      '(' + (offered.text || '').slice(0, 60) + ')');
    t.eq(offered.clickable, true, 'and the card actually receives its own clicks');

    const resumeBtn = await page.$('#btn-resume');
    if (resumeBtn) await resumeBtn.click();
    await wait(3500);

    const after = await page.evaluate(() => {
      const s = window.DND.App.session;
      if (!s) return { error: 'no session' };
      const m = document.getElementById('modal-setup');
      const style = m ? window.getComputedStyle(m) : null;
      return {
        revision: s.state.revision,
        actors: Object.keys(s.state.actors).length,
        campaign: s.campaign && s.campaign.id,
        seed: s.state.seed,
        names: Object.keys(s.state.actors).map(id => s.state.actors[id].name).sort(),
        hp: Object.keys(s.state.actors).map(id => s.state.actors[id].runtime.hp),
        transcript: s.state.transcript.length,
        wizardClosed: !m || style.display === 'none' || m.hidden,
        logText: (document.getElementById('log') || {}).textContent || '',
        moves: window.DND.Dispatch.legalMoves(
          s.state, s.state.activeActorId || (s.state.seats[0] && s.state.seats[0].actorId), {}).length,
      };
    });

    t.eq(after.error, undefined, 'resuming produces a live session', after.error || '');
    t.eq(after.wizardClosed, true, 'and the wizard gets out of the way');
    t.eq(after.seed, before.seed, 'it is the same world, not a new roll of the dice');
    t.eq(after.campaign, before.campaign, 'and the same campaign');
    t.eq(after.actors, before.actors, 'everyone who was there is still there');
    t.deep(after.names, before.names, 'by name');
    t.deep(after.hp, before.hp, 'carrying the hit points they had, not fresh ones');
    /* At LEAST the saved revision, not exactly it. The table is live once it
       loads: an ambient rumour, a companion's aside or the DM finishing a
       narration all commit a batch, and demanding equality asks a running game
       to hold its breath for the length of an assertion. It failed roughly one
       run in ten on a +1 that meant nothing was wrong. Resuming BEHIND the save
       is the real fault — that is state lost — and that is what is checked.
       Identity of the world is proved by the seed, campaign, cast and hit
       points above. */
    t.ok(after.revision >= saved.revision,
      'at or after the revision the game was saved on, never behind it',
      '(saved ' + saved.revision + ' -> resumed ' + after.revision + ')');

    /* The point of resuming is to keep playing. A restored world that offers
       no legal move is a museum piece. */
    t.ok(after.moves > 0, 'and the player can actually act', '(' + after.moves + ' legal moves)');

    /* An empty log above a party mid-fight reads as though the save lost
       everything, so the story that was saved is put back on the page. */
    t.ok(after.logText.length > 40, 'the story so far is back on the page',
      '(' + after.logText.length + ' chars)');

    t.section('discarding a save');
    await page.evaluate(() => { window.DND.Save.clearLocal(); });
    await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
    await wait(2000);
    const goneNow = await page.evaluate(() => ({
      resumeCard: !!document.getElementById('btn-resume'),
      importControl: !!document.getElementById('import-save-file'),
    }));
    t.eq(goneNow.resumeCard, false, 'a discarded save stops being offered');
    t.eq(goneNow.importControl, true,
      'while loading one from disk is still there, because that is a different thing');

    t.section('nothing broke along the way');
    t.eq(errors.length, 0, 'no console errors during the whole flow',
      errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  t.done();
}

main();
