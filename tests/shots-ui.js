/*
 * tests/shots-ui.js — capture the reworked interface for review.
 *
 * Not a gate. This produces the evidence a person (or a reviewing model) needs
 * to judge whether the thing is actually usable, at the sizes people use.
 *
 *   node tests/shots-ui.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
let puppeteer;
try { puppeteer = require('puppeteer-core'); } catch (e) { console.log('no puppeteer'); process.exit(0); }

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
].filter(p => { try { return fs.existsSync(p); } catch (e) { return false; } })[0];
const URL = 'http://127.0.0.1:' + (process.env.PORT || 8177) + '/';
const OUT = path.join(__dirname, '..', 'shots');
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
  try { await page.select('#dm-model', ''); } catch (e) { /* offline is the default anyway */ }
  await page.evaluate(() => { const b = document.getElementById('btn-begin'); if (b) b.click(); });
  await wait(5000);
}

(async () => {
  if (!CHROME) { console.log('no Chrome'); process.exit(0); }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,1000'],
  });
  const shots = [];
  const shoot = async (page, name) => {
    const f = path.join(OUT, name + '.png');
    await page.screenshot({ path: f });
    shots.push(name);
  };

  try {
    /* ---- desktop ---- */
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
    await shoot(page, 'ui-01-setup');

    await begin(page);
    await shoot(page, 'ui-02-opening');

    await page.evaluate(() => window.DND.Windows.open('sheet'));
    await wait(600);
    await shoot(page, 'ui-03-sheet-open');

    await page.evaluate(() => window.DND.Windows.ids().forEach(id => window.DND.Windows.open(id)));
    await wait(700);
    await shoot(page, 'ui-04-all-panels');

    await page.evaluate(() => {
      const w = document.getElementById('win-party');
      w.querySelector('[data-act="min"]').click();
    });
    await wait(400);
    await shoot(page, 'ui-05-minimised');

    /* The confirm dialog: the thing a player sees on every typed turn. */
    await page.evaluate(() => window.DND.Windows.ids().forEach(id => {
      if (id !== 'actions') window.DND.Windows.close(id);
    }));
    await page.click('#say');
    await page.type('#say', 'I draw my sword and swing at the nearest bandit');
    await page.click('#say-btn');
    await wait(6000);
    await shoot(page, 'ui-06-confirm');

    /* ---- tablet ---- */
    const tab = await browser.newPage();
    await tab.setViewport({ width: 820, height: 1000 });
    await tab.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
    await begin(tab);
    await shoot(tab, 'ui-07-tablet');
    await tab.evaluate(() => window.DND.Windows.open('sheet'));
    await wait(600);
    await shoot(tab, 'ui-08-tablet-sheet');

    /* ---- phone ---- */
    const phone = await browser.newPage();
    await phone.setViewport({ width: 420, height: 860 });
    await phone.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 });
    await begin(phone);
    await shoot(phone, 'ui-09-phone');
    await phone.evaluate(() => window.DND.Windows.open('sheet'));
    await wait(600);
    await shoot(phone, 'ui-10-phone-sheet');

    console.log('wrote ' + shots.length + ' screenshots to ' + OUT);
    shots.forEach(s => console.log('  ' + s + '.png'));
  } finally {
    await browser.close();
  }
})();
