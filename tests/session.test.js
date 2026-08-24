/*
 * tests/session.test.js — playing a whole session through the actual UI.
 *
 * browser.test.js proves the page boots and the modules load. This one proves
 * the game is playable by a person: it clicks the setup wizard, begins a
 * campaign, types an action into the composer, presses the button, and then
 * checks that the log, the party column, the sheet, the inventory, the journal,
 * undo and export all actually do their jobs.
 *
 * The Dungeon Master is set to Offline on purpose. This is a test of the
 * interface, not of a model, and it has to be deterministic and quick.
 *
 * Assumes the server is running:  .\start.cmd -NoBrowser
 */
'use strict';
const t = require('./_harness')('session');
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
    /* Start clean: another suite may have left a saved game in this origin's
       localStorage, and the wizard behaves differently when it finds one. */
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* nothing to clear */ } });
    await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
    await wait(2500);

    /* ------------------------------------------------------------- setup -- */
    t.section('the setup wizard');
    t.ok(await page.$('#modal-setup'), 'the setup modal is present on a fresh load');

    const campaignCount = await page.$$eval('#campaign-list button', b => b.length);
    t.eq(campaignCount, 3, 'three campaigns are offered');

    /* Pick the sandbox: it needs no canon and starts with a fight, which is
       the most demanding thing the UI has to render. */
    await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#campaign-list button'));
      const sandbox = cards.filter(c => /sandbox/i.test(c.textContent))[0] || cards[2];
      sandbox.click();
    });
    await wait(400);

    /* Offline DM: deterministic and instant. */
    await page.select('#dm-model', '');
    const dmValue = await page.$eval('#dm-model', s => s.value);
    t.eq(dmValue, '', 'the Dungeon Master can be set to Offline');

    const seatCount = await page.$$eval('#seat-list', l => l.length);
    t.ok(seatCount >= 1, 'at least one seat exists by default');

    await page.screenshot({ path: path.join(SHOTS, 'shot-1-setup.png') });

    /* ------------------------------------------------------------- begin -- */
    t.section('beginning a session');
    const beginDisabled = await page.$eval('#btn-begin', b => b.disabled);
    t.eq(beginDisabled, false, 'the Begin button is enabled once a campaign is chosen');

    await page.click('#btn-begin');
    await wait(3000);

    const setupGone = await page.evaluate(() => {
      const m = document.getElementById('modal-setup');
      if (!m) return true;
      const s = window.getComputedStyle(m);
      return s.display === 'none' || s.visibility === 'hidden' || m.hidden;
    });
    t.eq(setupGone, true, 'the setup modal closes and the table is revealed');

    const started = await page.evaluate(() => {
      const D = window.DND;
      const s = D.App && D.App.session;
      if (!s) return { error: 'no session on App' };
      return {
        actors: Object.keys(s.state.actors).length,
        seats: (s.state.seats || []).length,
        campaign: s.campaign && s.campaign.id,
        revision: s.state.revision,
      };
    });
    t.eq(started.error, undefined, 'the app exposes a live session', started.error || '');
    t.ok(started.actors > 1, 'the world has actors in it', '(' + started.actors + ')');
    t.ok(started.seats >= 1, 'and at least one seat');

    t.section('the panels render');
    const party = await page.$$eval('#party-list *', els => els.length);
    t.ok(party > 0, 'the party column has content', '(' + party + ' nodes)');

    const title = await page.$eval('#campaign-title', e => e.textContent.trim());
    t.ok(title.length > 0, 'the campaign is named in the topbar', '(' + title + ')');

    const actions = await page.$$eval('#actionbar button', b => b.map(x => x.textContent.trim()));
    t.ok(actions.length > 0, 'the action bar offers moves', '(' + actions.length + ')');
    t.ok(actions.some(a => /attack/i.test(a)), 'including an attack, since a fight is on',
      '(' + actions.slice(0, 4).join(' / ') + ')');

    /* The action bar must be built from the engine's legal moves, not a
       hand-written list, or the buttons and the rules drift apart. */
    const legal = await page.evaluate(() => {
      const D = window.DND;
      const s = D.App.session;
      const who = s.state.activeActorId || (s.state.seats[0] && s.state.seats[0].actorId);
      return D.Dispatch.legalMoves(s.state, who, {}).length;
    });
    t.ok(legal > 0, 'the engine reports legal moves for the active seat', '(' + legal + ')');

    await page.screenshot({ path: path.join(SHOTS, 'shot-2-table.png') });

    /* ------------------------------------------------------ take a turn -- */
    t.section('taking a turn by clicking a button');
    const before = await page.evaluate(() => window.DND.App.session.state.revision);

    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#actionbar button'))
        .filter(x => /attack/i.test(x.textContent))[0];
      b.click();
    });
    await wait(2500);

    const afterClick = await page.evaluate(() => {
      const s = window.DND.App.session;
      return {
        revision: s.state.revision,
        batches: s.state.log.length,
        lastBeats: s.state.log.length ? s.state.log[s.state.log.length - 1].beats : [],
        transcript: s.state.transcript.length,
      };
    });
    t.ok(afterClick.revision > before, 'clicking an action advances the game state',
      '(' + before + ' -> ' + afterClick.revision + ')');
    t.ok(afterClick.batches > 0, 'and commits an event batch');
    t.ok(afterClick.lastBeats.length > 0, 'which carries beats describing what happened',
      '(' + afterClick.lastBeats[0] + ')');

    const logText = await page.$eval('#log', e => e.textContent);
    t.ok(logText.length > 40, 'the narrative log has text in it');
    t.ok(/hit|miss|swing|attack/i.test(logText), 'and it describes the attack');

    /* The initiative must MOVE. Until the engine grew a turn loop the browser
       had none at all: a player could attack all day, the same character kept
       the initiative for ever, the monsters never hit back, and every effect
       measured in rounds lasted the whole session. The headless playtests hid
       it because the harness carried a turn loop of its own.

       Ending the turn explicitly is how a person actually plays: a character
       who has swung may still have a bonus action, and the game is right not
       to take it away from them. */
    t.section('the turn passes to everyone else');
    await page.evaluate(() => {
      const end = Array.from(document.querySelectorAll('#actionbar button'))
        .filter(b => /end turn/i.test(b.textContent))[0];
      if (end) end.click();
    });
    await wait(3500);

    const turnState = await page.evaluate(() => {
      const s = window.DND.App.session;
      return {
        active: s.state.activeActorId,
        round: s.state.combat && s.state.combat.round,
        epoch: s.state.turnEpoch,
        enemyActed: s.state.log.some(b => {
          const a = s.state.actors[b.actorId];
          return a && a.side === 'enemy';
        }),
        enemyDamage: s.state.log.some(b => (b.events || []).some(e => {
          const t = s.state.actors[e.targetId];
          return e.kind === 'hp' && e.delta < 0 && t && t.side === 'party';
        })),
      };
    });
    t.ok(turnState.epoch > 0, 'the turn epoch advances in the real game, not just in tests',
      '(' + turnState.epoch + ')');
    t.ok(turnState.enemyActed || turnState.enemyDamage,
      'the monsters take their own turns after the player takes theirs');

    t.section('typing a turn in your own words');
    const beforeType = await page.evaluate(() => window.DND.App.session.state.revision);
    await page.click('#say');
    await page.type('#say', 'I look around the chapel for anything worth taking');
    await page.click('#say-btn');
    await wait(3000);

    const afterType = await page.evaluate(() => {
      const s = window.DND.App.session;
      const last = s.state.log[s.state.log.length - 1];
      return {
        revision: s.state.revision,
        family: last && last.commandId ? true : false,
        beats: last ? last.beats : [],
        inputCleared: document.getElementById('say').value === '',
      };
    });
    t.ok(afterType.revision > beforeType, 'free text becomes a real committed turn',
      '(' + beforeType + ' -> ' + afterType.revision + ')');
    t.ok(afterType.beats.length > 0, 'with beats of its own', '(' + afterType.beats[0] + ')');
    t.eq(afterType.inputCleared, true, 'and the composer clears itself');

    await page.screenshot({ path: path.join(SHOTS, 'shot-3-play.png') });

    /* ----------------------------------------------------------- panels -- */
    t.section('the character sheet');
    await page.click('#tab-sheet');
    await wait(600);
    const sheet = await page.$eval('#pane-sheet', e => e.textContent);
    t.ok(/STR|Strength/i.test(sheet), 'the sheet shows ability scores');
    t.ok(/AC|Armor Class/i.test(sheet), 'and armour class');
    t.ok(/\bHP\b|Hit Points/i.test(sheet), 'and hit points');

    t.section('the inventory');
    await page.click('#tab-inventory');
    await wait(600);
    const inv = await page.$eval('#pane-inventory', e => e.textContent);
    t.ok(inv.trim().length > 0, 'the inventory pane renders');
    t.ok(/longsword|potion|gold/i.test(inv), 'and lists what the character is carrying');

    t.section('the journal shows only what is known');
    await page.click('#tab-journal');
    await wait(600);
    const journal = await page.$eval('#pane-journal', e => e.textContent);
    t.ok(journal.trim().length > 0, 'the journal pane renders');
    /* The sandbox has no secrets, so this is a smoke check; campaign.test.js
       does the real per-observer leak auditing. */
    t.eq(/undefined|\[object Object\]/.test(journal), false,
      'and does not leak raw objects into the page');

    t.section('the AI seats panel');
    await page.click('#tab-watch');
    await wait(600);
    const watch = await page.$eval('#pane-watch', e => e.textContent);
    t.ok(watch.trim().length > 0, 'the AI-seats pane renders');

    await page.screenshot({ path: path.join(SHOTS, 'shot-4-panels.png') });

    /* ------------------------------------------------------------- undo -- */
    t.section('undo');
    const preUndo = await page.evaluate(() => {
      const s = window.DND.App.session;
      const foe = Object.keys(s.state.actors).filter(id => s.state.actors[id].side === 'enemy')[0];
      return { revision: s.state.revision, foeHp: foe ? s.state.actors[foe].runtime.hp : null, foe: foe };
    });
    await page.click('#btn-undo');
    await wait(1200);
    const postUndo = await page.evaluate(() => {
      const s = window.DND.App.session;
      const foe = Object.keys(s.state.actors).filter(id => s.state.actors[id].side === 'enemy')[0];
      return { revision: s.state.revision, foeHp: foe ? s.state.actors[foe].runtime.hp : null };
    });
    t.ok(postUndo.revision < preUndo.revision, 'the Undo button rewinds the game state',
      '(' + preUndo.revision + ' -> ' + postUndo.revision + ')');

    /* ------------------------------------------------------------ export -- */
    t.section('export');
    const exportDir = path.join(__dirname, '..', 'exports');
    const filesBefore = new Set(fs.readdirSync(exportDir));
    await page.click('#btn-export');
    await wait(3500);
    const after = fs.readdirSync(exportDir);
    /* Compare by name, not by count: an export that overwrites an existing
       file would leave the count unchanged and look like a pass. */
    const fresh = after.filter(f => !filesBefore.has(f));
    t.ok(fresh.length > 0, 'the Export button writes NEW files to exports/',
      '(' + fresh.join(', ') + ')');

    const newest = fresh
      .map(f => ({ f, m: fs.statSync(path.join(exportDir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m)[0];
    /* Only files this click produced. Looking at the newest file in the whole
       folder made the test depend on whatever else happened to be writing
       there — a playtest log running in another window failed it. */
    t.ok(/\.(json|md)$/.test(newest.f), 'and the newest file is a save or a transcript',
      '(' + newest.f + ')');

    if (/\.json$/.test(newest.f)) {
      const blob = JSON.parse(fs.readFileSync(path.join(exportDir, newest.f), 'utf8'));
      t.eq(blob.format, 'aethertable-save', 'the export is a well-formed save');
      t.ok(!!blob.digest, 'it carries a human-readable digest');
      t.ok(!!blob.digest.sheets, 'including character sheets');
      t.ok(Array.isArray(blob.digest.transcript), 'including the transcript');
      t.ok(!!blob.state.rngState, 'and the RNG position, so it can be resumed exactly');
    }

    /* ------------------------------------------------------------- save --- */
    t.section('save to the browser');
    await page.click('#btn-save');
    await wait(1000);
    const saved = await page.evaluate(() => !!localStorage.getItem(window.DND.Save.STORAGE_KEY));
    t.eq(saved, true, 'the Save button writes a slot to localStorage');

    const reloadable = await page.evaluate(() => {
      try {
        const loaded = window.DND.Save.loadLocal({});
        return { ok: !!loaded, actors: loaded ? Object.keys(loaded.state.actors).length : 0 };
      } catch (e) { return { ok: false, error: String(e.message) }; }
    });
    t.eq(reloadable.ok, true, 'and it loads back cleanly', reloadable.error || '');
    t.ok(reloadable.actors > 1, 'with the world intact', '(' + reloadable.actors + ' actors)');

    /* ------------------------------------------- the built-in campaign --- */
    /* The whole reason this project exists is the recorded Shen Cooper game,
       and the page listed it while quietly starting an empty sandbox instead,
       because the campaign scripts were never loaded. Headless playtests hid
       the fault by requiring the campaign files directly, so this check
       deliberately goes through the wizard like a player would. */
    t.section('resuming the Shen Cooper campaign from the wizard');
    const shen = await page.evaluate(async () => {
      localStorage.clear();
      location.reload();
    }).then(() => wait(3000)).then(async () => {
      await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('#campaign-list button'));
        const c = cards.filter(x => /continuation/i.test(x.textContent))[0];
        if (c) c.click();
      });
      await wait(400);
      await page.select('#dm-model', '');
      await page.click('#btn-begin');
      await wait(3500);
      return page.evaluate(() => {
        const s = window.DND.App.session;
        if (!s) return { error: 'no session' };
        const names = Object.keys(s.state.actors).map(id => s.state.actors[id].name);
        const shen = s.state.actors.shen;
        return {
          campaign: s.campaign && s.campaign.id,
          names: names,
          ac: shen && shen.derivedCache && shen.derivedCache.ac,
          level: shen && shen.progression && shen.progression.levels.length,
          seatActor: s.state.seats[0] && s.state.seats[0].actorId,
          facts: Object.keys(s.state.knowledge || {}).length,
        };
      });
    });

    t.eq(shen.error, undefined, 'the campaign starts', shen.error || '');
    t.ok(/shen/i.test(String(shen.campaign)), 'and it really is the Shen campaign, not a sandbox',
      '(' + shen.campaign + ')');
    t.ok(shen.names.indexOf('Shen Cooper') >= 0, 'Shen Cooper is at the table',
      '(' + shen.names.join(', ') + ')');
    ['Aldren', 'Mara', 'Corvin'].forEach(who => {
      t.ok(shen.names.some(n => n.indexOf(who) >= 0), 'so is ' + who);
    });
    t.eq(shen.seatActor, 'shen', 'and the player is seated as Shen, not a stranger beside him');
    t.eq(shen.ac, 18, 'Shen loads at his canonical AC 18 through the real page load');
    t.eq(shen.level, 3, 'at the level the record leaves him');
    t.ok(shen.facts > 0, 'the campaign knowledge store came with him', '(' + shen.facts + ' facts)');

    await page.screenshot({ path: path.join(SHOTS, 'shot-6-shen.png') });

    /* Leave nothing behind. This test ends with a live Shen campaign saved in
       the browser, and the next browser test opens the same origin expecting a
       fresh table — it failed for exactly that reason, which is a test fault
       rather than a product one. */
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) { /* nothing to clear */ } });

    /* -------------------------------------------------------- no errors --- */
    t.section('nothing broke along the way');
    const realErrors = errors.filter(e => !/favicon|DevTools|Autofill/i.test(e));
    t.eq(realErrors.length, 0, 'no console errors during the whole session',
      realErrors.length ? '\n      ' + realErrors.slice(0, 5).join('\n      ') : '');

    await page.screenshot({ path: path.join(SHOTS, 'shot-5-end.png') });
    console.log('\n  screenshots: shot-1-setup .. shot-6-shen');
  } finally {
    await browser.close();
  }

  t.done();
}

main().catch(e => { console.error(e); process.exit(1); });
