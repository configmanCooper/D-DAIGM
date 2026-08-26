/*
 * tests/chapter1.test.js — the third campaign, and getting about the world.
 *
 * "Shen Cooper — from Chapter I" was offered on the front screen from the
 * first build and was never implemented: it fell through to the generic path
 * and produced a single pregenerated Shen standing in an unnamed void with no
 * NPCs, no locations, no quests and an empty log.
 *
 * The same gap disabled travel everywhere. The engine's `travel` verb reads
 * its destinations from `ctx.exits`, the browser supplied `{}` as the context
 * for every command in the game, and so `travel` was never offered by the
 * action bar and never resolved from typed text — in a campaign with ten
 * named, connected places.
 */
'use strict';

const t = require('./_harness')('chapter1');
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

async function startCampaign(page, match) {
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* nothing */ } });
  await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
  await wait(2500);
  await page.evaluate(m => {
    const cards = Array.from(document.querySelectorAll('#campaign-list button'));
    const want = cards.filter(c => new RegExp(m, 'i').test(c.textContent))[0];
    (want || cards[0]).click();
  }, match);
  await wait(400);
  await page.select('#dm-model', '');
  await page.click('#btn-begin');
  await wait(3500);
}

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

    /* ------------------------------------------------------- chapter I -- */
    t.section('Chapter I is a real campaign, not a labelled empty shell');
    await startCampaign(page, 'chapter i');

    const ch1 = await page.evaluate(() => {
      const s = window.DND.App.session;
      if (!s) return { error: 'no session' };
      const ids = Object.keys(s.state.actors);
      return {
        campaign: s.campaign && s.campaign.id,
        actors: ids.length,
        names: ids.map(id => s.state.actors[id].name),
        locationId: s.state.locationId,
        gazetteer: s.locations ? Object.keys(s.locations).length : 0,
        seats: (s.state.seats || []).length,
        seatedOn: (s.state.seats[0] || {}).actorId,
        shenLevel: s.state.actors.shen
          ? (s.state.actors.shen.base.classes || []).reduce((n, c) => n + c.levels, 0) : null,
        moves: window.DND.Dispatch.legalMoves(
          s.state, s.state.activeActorId, window.DND.Game.sceneCtx(s)).length,
      };
    });

    t.eq(ch1.error, undefined, 'Chapter I starts', ch1.error || '');
    t.ok(ch1.actors > 1, 'the world has more than one person in it',
      '(' + ch1.actors + ': ' + (ch1.names || []).join(', ') + ')');
    t.eq((ch1.names || []).filter(n => !n || !n.trim()).length, 0,
      'and every one of them has a name');
    t.ok((ch1.names || []).some(n => /Shen/i.test(n || '')), 'Shen among them');
    t.ok(!!ch1.locationId, 'the party is somewhere named', '(' + ch1.locationId + ')');
    t.ok(ch1.gazetteer >= 5, 'and the world has places to go', '(' + ch1.gazetteer + ' locations)');
    t.eq(ch1.seatedOn, 'shen', 'the player is Shen, as the card promises');
    t.eq(ch1.shenLevel, 1, 'at first level — this is the START of the record');
    t.ok(ch1.moves > 0, 'and there is something to do', '(' + ch1.moves + ' legal moves)');

    /* ---------------------------------------------------------- travel -- */
    t.section('you can actually go somewhere');
    const travel = await page.evaluate(() => {
      const s = window.DND.App.session;
      const c = window.DND.Game.sceneCtx(s);
      const moves = window.DND.Dispatch.legalMoves(s.state, s.state.activeActorId, c);
      const t = moves.filter(m => m.step && m.step.verb === 'travel');
      return {
        exits: (c.exits || []).map(e => e.name),
        offered: t.length,
        labels: t.map(m => m.what),
      };
    });
    t.ok(travel.exits.length > 0, 'the scene knows its exits',
      '(' + travel.exits.join(', ') + ')');
    t.ok(travel.offered > 0, 'and travel is actually offered in the action bar',
      '(' + travel.labels.slice(0, 3).join(' / ') + ')');

    /* Offering it is not the same as it working. Take one. */
    const went = await page.evaluate(async () => {
      const s = window.DND.App.session;
      const c = window.DND.Game.sceneCtx(s);
      const moves = window.DND.Dispatch.legalMoves(s.state, s.state.activeActorId, c);
      const mv = moves.filter(m => m.step && m.step.verb === 'travel')[0];
      const from = s.state.locationId;
      const cmd = window.DND.Dispatch.commandFromMove(s.state, s.state.activeActorId, mv);
      const r = await window.DND.Game.applyCommand(s, cmd, { ctx: c });
      return { ok: !!(r && r.ok !== false), from, to: s.state.locationId };
    });
    t.ok(went.to && went.to !== went.from, 'and travelling actually moves the party',
      '(' + went.from + ' → ' + went.to + ')');

    const onward = await page.evaluate(() => {
      const s = window.DND.App.session;
      return (window.DND.Game.sceneCtx(s).exits || []).length;
    });
    t.ok(onward > 0, 'the new place has exits of its own — the map is connected',
      '(' + onward + ')');

    /* ------------------------------------------ the flagship still works -- */
    t.section('the continuation still has its world');
    await startCampaign(page, 'continuation');
    const cont = await page.evaluate(() => {
      const s = window.DND.App.session;
      return {
        seats: (s.state.seats || []).length,
        shenSeats: (s.state.seats || []).filter(x => x.actorId === 'shen').length,
        gazetteer: s.locations ? Object.keys(s.locations).length : 0,
        exits: (window.DND.Game.sceneCtx(s).exits || []).length,
      };
    });
    t.eq(cont.seats, 1, 'one seat was asked for and one seat exists');
    t.eq(cont.shenSeats, 1, 'and Shen is seated exactly once');
    t.ok(cont.gazetteer >= 5, 'the continuation has the same gazetteer',
      '(' + cont.gazetteer + ')');
    t.ok(cont.exits > 0, 'and somewhere to go from where it starts', '(' + cont.exits + ')');

    t.section('nothing broke along the way');
    t.eq(errors.length, 0, 'no console errors during the whole flow',
      errors.slice(0, 3).join(' | '));

    /* ----------------------------------------- the narrow-screen drawer -- */
    t.section('the character sheet is reachable on a narrow screen');
    /*
     * The tablet drawer is gone, and so is the fixed three-column layout it
     * existed to rescue. Panels float now and every one of them has a dock
     * button, so "unreachable on a tablet" is answered by the dock rather than
     * by a special case — and a window dragged off a narrow screen is clamped
     * back onto it instead of being lost.
     *
     * What still has to be true is the thing the old test was really about: on
     * a tablet, a player can reach the character sheet, and it has their
     * character in it.
     */
    await page.setViewport({ width: 820, height: 900 });
    await startCampaign(page, 'sandbox');

    const shut = await page.evaluate(() => {
      const dock = document.getElementById('dock');
      const btn = dock && dock.querySelector('[data-win="sheet"]');
      if (!btn) return { error: 'no dock button for the sheet' };
      const bx = btn.getBoundingClientRect();
      const top = document.elementFromPoint(bx.left + bx.width / 2, bx.top + bx.height / 2);
      return {
        visible: getComputedStyle(btn).display !== 'none',
        receivesClick: top === btn || btn.contains(top),
        open: window.DND.Windows.isOpen('sheet'),
        pressed: btn.getAttribute('aria-pressed'),
      };
    });
    t.eq(shut.error, undefined, 'the dock offers the sheet at tablet width', shut.error || '');
    t.eq(shut.visible, true, 'and its button is visible');
    t.eq(shut.receivesClick, true, 'and nothing is covering it');
    t.eq(shut.open, false, 'the panel starts closed, so the story has the page');
    t.eq(shut.pressed, 'false', 'and says so to a screen reader');

    const btn = await page.$('#dock [data-win="sheet"]');
    if (btn) await btn.click();
    await wait(500);
    const open = await page.evaluate(() => {
      const win = document.getElementById('win-sheet');
      const b = win.getBoundingClientRect();
      return {
        onScreen: b.left < window.innerWidth && b.right > 0 &&
          b.top < window.innerHeight && b.bottom > 0,
        pressed: document.querySelector('#dock [data-win="sheet"]').getAttribute('aria-pressed'),
        sheetText: (document.getElementById('pane-sheet') || {}).textContent || '',
        hasChrome: !!win.querySelector('[data-act="min"]') &&
          !!win.querySelector('[data-act="max"]') &&
          !!win.querySelector('[data-act="close"]'),
      };
    });
    t.eq(open.onScreen, true, 'clicking it brings the panel onto the screen');
    t.eq(open.pressed, 'true', 'and says so to a screen reader');
    t.ok(/STR|Strength/i.test(open.sheetText), 'with the character sheet actually in it');
    t.eq(open.hasChrome, true, 'and it can be rolled up, maximised or closed');

    /* Escape must close it, or a keyboard player is trapped behind it. */
    await page.evaluate(() => {
      const win = document.getElementById('win-sheet');
      win.focus();
      win.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await wait(400);
    const closed = await page.evaluate(() => ({
      open: window.DND.Windows.isOpen('sheet'),
      pressed: document.querySelector('#dock [data-win="sheet"]').getAttribute('aria-pressed'),
    }));
    t.eq(closed.open, false, 'and Escape closes it again');
    t.eq(closed.pressed, 'false', 'saying so too');
  } finally {
    await browser.close();
  }
  t.done();
}

main();
