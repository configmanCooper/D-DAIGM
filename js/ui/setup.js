/*
 * ui/setup.js — DND.Setup
 *
 * The new-game wizard. It gathers: a campaign, one to four seats (each a person
 * or a model, with the model's backend/model/persona), the Dungeon Master's
 * backend and model and the table's tone/difficulty/content limits, and a
 * character for every seat — either a pregenerated hero (the fast path) or one
 * built race-by-class-by-background with a live portrait and live validation.
 *
 * It never selects a Copilot model on its own: every model picker defaults to
 * a local model, and a Copilot choice only ever happens when a person makes it.
 */
(function (global) {
  'use strict';

  var POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
  var POINT_BUDGET = 27;
  var STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
  var ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  var W = null;        // wizard working state
  var onBeginCb = null;
  var seatSeq = 0;

  function Data() { return global.DND && global.DND.Data; }
  function Mortality() { return global.DND && global.DND.Mortality; }
  function esc(s) { var App = global.DND && global.DND.App; return App ? App.esc(s) : String(s == null ? '' : s); }

  /* --------------------------------------------------------- campaigns -- */
  function campaigns() {
    if (global.DND && global.DND.Campaigns && global.DND.Campaigns.list) {
      try { return global.DND.Campaigns.list(); } catch (e) { /* fall back */ }
    }
    return [
      { id: 'shen_continuation', title: 'Shen Cooper — the continuation',
        desc: 'Pick up the paladin\u2019s story where the campaign record leaves off, at the edge of the Glass Fen.',
        campaignObj: { title: 'Shen Cooper — the continuation', premise: 'A paladin\u2019s oath, tested at the drowned marches.', tone: 'grim' } },
      { id: 'shen_chapter1', title: 'Shen Cooper — from Chapter I',
        desc: 'Begin again at the start of the surviving record and play it forward.',
        campaignObj: { title: 'Shen Cooper — Chapter I', premise: 'The making of a paladin.', tone: 'heroic' } },
      { id: 'sandbox', title: 'A new sandbox',
        desc: 'A fresh world with no prior story. Build your own party and see where the dice take it.',
        campaignObj: { title: 'Sandbox', premise: 'An open road.', tone: 'heroic' } },
    ];
  }

  /* --------------------------------------------------------- pregens ---- */
  function pregens() {
    return [
      { id: 'shen', name: 'Shen Cooper', raceId: 'human', classId: 'paladin', levels: 3, backgroundId: 'soldier',
        abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 15 },
        skills: ['athletics', 'intimidation', 'persuasion'] },
      { id: 'aldren', name: 'Sir Aldren Vey', raceId: 'halfElf', classId: 'fighter', levels: 3, backgroundId: 'noble',
        abilities: { str: 15, dex: 13, con: 14, int: 10, wis: 11, cha: 14 },
        skills: ['athletics', 'perception', 'insight'] },
      { id: 'mora', name: 'Mora Fenwick', raceId: 'halfling', classId: 'rogue', levels: 3, backgroundId: 'criminal',
        abilities: { str: 8, dex: 16, con: 13, int: 12, wis: 12, cha: 14 },
        skills: ['stealth', 'sleightOfHand', 'perception', 'deception'] },
      { id: 'ysolde', name: 'Ysolde', raceId: 'elf', classId: 'wizard', levels: 3, backgroundId: 'sage',
        abilities: { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 },
        skills: ['arcana', 'history', 'investigation'] },
    ];
  }

  /* ------------------------------------------------------------- open --- */
  function open(onBegin) {
    onBeginCb = onBegin;
    W = { campaign: null, seed: '', seats: [] };
    seatSeq = 0;
    renderCampaigns();
    renderDeathPolicies();
    addSeat();      // start with one seat
    var addBtn = document.getElementById('btn-add-seat');
    if (addBtn) addBtn.onclick = function () { if (W.seats.length < 4) { addSeat(); validate(); } };
    var begin = document.getElementById('btn-begin');
    if (begin) begin.onclick = beginGame;
    var modal = document.getElementById('modal-setup');
    if (modal) modal.classList.remove('hidden');
    validate();
  }

  function close() { var m = document.getElementById('modal-setup'); if (m) m.classList.add('hidden'); }

  function renderCampaigns() {
    var host = document.getElementById('campaign-list');
    if (!host) return;
    host.innerHTML = '';
    campaigns().forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'campaign-card';
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<div class="cname">' + esc(c.title) + '</div><div class="cdesc">' + esc(c.desc) + '</div>';
      b.onclick = function () {
        W.campaign = c;
        Array.prototype.forEach.call(host.children, function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        validate();
      };
      host.appendChild(b);
    });
  }

  /* -------------------------------------------------------- death policy - */
  /*
   * The "when someone dies" control. Rendered from Mortality.POLICIES rather
   * than hard-coded, so the blurbs the engine authors for this exact screen
   * are what the player reads. Standard is selected by default, because it is
   * how most tables play and what the engine falls back to anyway.
   */
  function renderDeathPolicies() {
    var host = document.getElementById('dm-death-list');
    if (!host) return;
    host.innerHTML = '';
    var M = Mortality();
    var policies = (M && M.POLICIES) || {};
    var order = ['heroic', 'standard', 'gritty', 'ironman'];
    order.forEach(function (id) {
      var p = policies[id];
      if (!p) return;
      var label = document.createElement('label');
      label.className = 'death-policy';
      label.setAttribute('data-policy', id);
      label.innerHTML =
        '<input type="radio" name="dm-death" value="' + esc(id) + '"' + (id === 'standard' ? ' checked' : '') + '>' +
        '<span class="dp-body">' +
          '<span class="dp-name">' + esc(p.name) + '</span>' +
          '<span class="dp-blurb">' + esc(p.blurb) + '</span>' +
          (p.note ? '<span class="dp-note">' + esc(p.note) + '</span>' : '') +
        '</span>';
      var input = label.querySelector('input');
      input.onchange = function () {
        Array.prototype.forEach.call(host.children, function (x) { x.classList.remove('picked'); });
        if (input.checked) label.classList.add('picked');
      };
      if (id === 'standard') label.classList.add('picked');
      host.appendChild(label);
    });
  }

  /* -------------------------------------------------------------- seats - */
  function addSeat() {
    seatSeq++;
    var seat = {
      id: 'seat' + seatSeq,
      name: 'Seat ' + seatSeq,
      control: 'human',
      model: firstLocalModel(),
      persona: '',
      char: { kind: 'pregen', pregenId: pregens()[Math.min(seatSeq - 1, pregens().length - 1)].id },
      build: null,
    };
    W.seats.push(seat);
    renderSeats();
  }

  function removeSeat(id) {
    W.seats = W.seats.filter(function (s) { return s.id !== id; });
    renderSeats();
    validate();
  }

  function firstLocalModel() {
    var App = global.DND && global.DND.App;
    var m = (App && App.availableModels && App.availableModels()) || [];
    return m[0] || 'llama3.2:3b';
  }

  function modelOptions(current) {
    var App = global.DND && global.DND.App;
    var local = (App && App.availableModels && App.availableModels()) || ['llama3.2:3b', 'qwen3.5:4b', 'qwen3:1.7b'];
    var copilot = (App && App.copilotModels && App.copilotModels()) || ['claude-sonnet-5', 'gpt-5.6-sol'];
    var html = '<optgroup label="Local — the default">';
    local.forEach(function (m) { html += '<option value="' + esc(m) + '"' + (m === current ? ' selected' : '') + '>Local · ' + esc(m) + '</option>'; });
    html += '<option value=""' + (current === '' ? ' selected' : '') + '>Offline · templated</option></optgroup>';
    html += '<optgroup label="Copilot — deliberate choice">';
    copilot.forEach(function (m) { html += '<option value="copilot:' + esc(m) + '"' + (('copilot:' + m) === current ? ' selected' : '') + '>Copilot · ' + esc(m) + '</option>'; });
    html += '</optgroup>';
    return html;
  }

  function renderSeats() {
    var host = document.getElementById('seat-list');
    if (!host) return;
    host.innerHTML = '';
    W.seats.forEach(function (seat) {
      var box = document.createElement('div');
      box.className = 'seat-setup';
      var pregenOpts = pregens().map(function (p) {
        return '<option value="' + p.id + '"' + (seat.char.kind === 'pregen' && seat.char.pregenId === p.id ? ' selected' : '') + '>' +
          esc(p.name) + ' — ' + esc(p.raceId) + ' ' + esc(p.classId) + '</option>';
      }).join('');

      box.innerHTML =
        '<div class="shead"><span class="stitle">' + esc(seat.name) + '</span>' +
          (W.seats.length > 1 ? '<button class="remove" type="button" data-act="remove">Remove</button>' : '') + '</div>' +
        '<div class="fieldrow"><label>Name</label><input data-f="name" value="' + esc(seat.name) + '"></div>' +
        '<div class="fieldrow"><label>Controlled by</label>' +
          '<select data-f="control"><option value="human"' + (seat.control === 'human' ? ' selected' : '') + '>A person</option>' +
          '<option value="ai"' + (seat.control === 'ai' ? ' selected' : '') + '>A model</option></select></div>' +
        '<div class="fieldrow ai-only"' + (seat.control === 'ai' ? '' : ' hidden') + '><label>Model</label>' +
          '<select class="model-select" data-role="seat-model" data-f="model">' + modelOptions(seat.model) + '</select></div>' +
        '<div class="fieldrow ai-only"' + (seat.control === 'ai' ? '' : ' hidden') + '><label>Persona</label>' +
          '<input data-f="persona" value="' + esc(seat.persona) + '" placeholder="Optional. e.g. cautious tactician"></div>' +
        '<div class="fieldrow"><label>Character</label>' +
          '<select data-f="chartype"><option value="pregen"' + (seat.char.kind === 'pregen' ? ' selected' : '') + '>Pregenerated (fast path)</option>' +
          '<option value="build"' + (seat.char.kind === 'build' ? ' selected' : '') + '>Build a character</option></select></div>' +
        '<div class="fieldrow pregen-only"' + (seat.char.kind === 'pregen' ? '' : ' hidden') + '><label>Hero</label>' +
          '<select data-f="pregen">' + pregenOpts + '</select></div>' +
        '<div class="build-host"></div>';

      // wire fields
      box.querySelectorAll('[data-f]').forEach(function (el) {
        el.onchange = function () { onSeatField(seat, el.getAttribute('data-f'), el.value, box); };
        if (el.tagName === 'INPUT') el.oninput = function () { onSeatField(seat, el.getAttribute('data-f'), el.value, box, true); };
      });
      var rm = box.querySelector('[data-act="remove"]');
      if (rm) rm.onclick = function () { removeSeat(seat.id); };

      host.appendChild(box);
      if (seat.char.kind === 'build') renderBuilder(seat, box.querySelector('.build-host'));
    });
  }

  function onSeatField(seat, field, value, box, quiet) {
    if (field === 'name') { seat.name = value; if (!quiet) renderSeats(); }
    else if (field === 'control') {
      seat.control = value;
      box.querySelectorAll('.ai-only').forEach(function (el) { el.hidden = value !== 'ai'; });
    } else if (field === 'model') seat.model = value;
    else if (field === 'persona') seat.persona = value;
    else if (field === 'chartype') {
      if (value === 'pregen') seat.char = { kind: 'pregen', pregenId: pregens()[0].id };
      else { seat.char = { kind: 'build' }; if (!seat.build) seat.build = defaultBuild(); }
      renderSeats();
    } else if (field === 'pregen') seat.char = { kind: 'pregen', pregenId: value };
    validate();
  }

  /* ---------------------------------------------------------- builder --- */
  function defaultBuild() {
    return {
      /* How this character is being made. 'manual' is the race-by-class builder,
         'surprise' pins a chosen subset and generates the rest, 'random' rolls a
         whole hero. All three write into the SAME build object, so whatever a
         generator produces stays fully editable below it. */
      mode: 'manual',
      name: '', raceId: 'human', subraceId: '', classId: 'fighter', backgroundId: 'soldier',
      method: 'pointbuy',
      scores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
      array: { str: null, dex: null, con: null, int: null, wis: null, cha: null },
      skills: [],
      backstory: '', backstoryHint: '', backstorySource: '',
      /* Which fields the player has pinned in 'surprise' mode. */
      pins: {},
      /* A record of the last generation, so the sheet can say what was pinned
         and what the table decided. */
      gen: null,
    };
  }

  function Chargen() { return global.DND && global.DND.Chargen; }
  function Backstory() { return global.DND && global.DND.Backstory; }
  function sign(n) { return (n >= 0 ? '+' : '') + n; }

  function newRng() {
    var RNG = global.DND && global.DND.RNG;
    return RNG ? new RNG(String(Math.random()) + ':' + Date.now()) : null;
  }

  /* The pre-racial base scores a class wants: the standard array laid down the
     class's priority order. Racial bonuses are added later, in specFor, exactly
     as they are for a hand-built character — so a generated hero and a manually
     suggested one reach identical final scores. */
  function baseArrayFor(classId) {
    var C = Chargen();
    var pr = (C && C.BUILDS && (C.BUILDS[classId] || C.BUILDS.fighter).priority) || ABIL;
    var arr = {};
    pr.forEach(function (ab, i) { arr[ab] = STANDARD_ARRAY[i] != null ? STANDARD_ARRAY[i] : 10; });
    return arr;
  }

  function subracesOf(raceId) {
    var race = Data() && Data().RACES && Data().RACES[raceId];
    return (race && race.subraces) || null;
  }

  function renderBuilder(seat, host) {
    if (!host) return;
    var b = seat.build || (seat.build = defaultBuild());
    if (!b.mode) b.mode = 'manual';
    var raceOrder = (global.DND.Portrait && global.DND.Portrait.RACE_ORDER) || Object.keys((Data() && Data().RACES) || {});
    var classOrder = (global.DND.Portrait && global.DND.Portrait.CLASS_ORDER) || Object.keys((Data() && Data().CLASSES) || {});
    var bgs = (Data() && Data().BACKGROUNDS) || {};

    /* --- how are we making this character? Three routes onto one sheet. --- */
    var html = '<div class="make-mode" role="tablist" aria-label="How to create this character">';
    [['manual', 'Build it myself'], ['surprise', 'Surprise me (partly)'], ['random', 'Completely random']].forEach(function (m) {
      html += '<button type="button" class="mode-btn' + (b.mode === m[0] ? ' on' : '') + '" data-mode="' + m[0] + '"' +
        ' aria-pressed="' + (b.mode === m[0] ? 'true' : 'false') + '">' + esc(m[1]) + '</button>';
    });
    html += '</div>';

    /* Generation affordances, shown above the editable sheet. Whatever they
       produce lands in the same fields the manual builder edits. */
    html += '<div class="gen-affordance" data-gen-affordance></div>';

    /* --- the editable sheet, shared by all three routes --- */
    html += '<div class="char-preview"><canvas class="build-portrait" width="120" height="140"></canvas><div style="flex:1 1 auto">';
    html += '<div class="fieldrow"><label>Name</label><input data-b="name" value="' + esc(b.name) + '" placeholder="Their name"></div>';
    html += '<div class="fieldrow"><label>Lineage</label><select data-b="raceId">' +
      raceOrder.map(function (r) { var rd = Data() && Data().RACES && Data().RACES[r]; return '<option value="' + r + '"' + (b.raceId === r ? ' selected' : '') + '>' + esc((rd && rd.name) || r) + '</option>'; }).join('') + '</select></div>';
    var subs = subracesOf(b.raceId);
    if (subs) {
      html += '<div class="fieldrow"><label>Subrace</label><select data-b="subraceId">' +
        Object.keys(subs).map(function (k) { return '<option value="' + k + '"' + (b.subraceId === k ? ' selected' : '') + '>' + esc(subs[k].name || k) + '</option>'; }).join('') + '</select></div>';
    }
    html += '<div class="fieldrow"><label>Class</label><select data-b="classId">' +
      classOrder.map(function (c) { var cd = Data() && Data().CLASSES && Data().CLASSES[c]; return '<option value="' + c + '"' + (b.classId === c ? ' selected' : '') + '>' + esc((cd && cd.name) || c) + '</option>'; }).join('') + '</select></div>';
    html += '<div class="fieldrow"><label>Background</label><select data-b="backgroundId">' +
      Object.keys(bgs).map(function (k) { return '<option value="' + k + '"' + (b.backgroundId === k ? ' selected' : '') + '>' + esc(bgs[k].name) + '</option>'; }).join('') + '</select></div>';
    html += '</div></div>';

    /* Live advice: what the chosen race and class actually want. */
    html += '<div class="advice" data-advice></div>';

    // ability method
    html += '<div class="fieldrow"><label>Abilities</label><select data-b="method">' +
      ['pointbuy', 'standard', 'roll'].map(function (m) { return '<option value="' + m + '"' + (b.method === m ? ' selected' : '') + '>' + (m === 'pointbuy' ? 'Point buy' : m === 'standard' ? 'Standard array' : 'Roll 4d6') + '</option>'; }).join('') + '</select>' +
      '<button class="chip" type="button" data-act="suggest-scores" title="Fill abilities the way this class wants them">Use suggested scores</button></div>';
    html += '<div class="abil-assign" data-abils></div>';
    html += '<div class="pool-note" data-pool></div>';

    // skills
    html += '<div class="fieldrow"><label>Skills</label><div data-skills style="flex:1 1 100%"></div></div>';

    // backstory
    html += renderBackstoryHtml(b);

    // live derived result
    html += '<div class="fieldrow"><label>Result</label><div class="derived-preview" data-derived style="flex:1 1 100%"></div></div>';

    host.innerHTML = html;

    // mode switch
    host.querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.onclick = function () { b.mode = btn.getAttribute('data-mode'); renderBuilder(seat, host); validate(); };
    });

    host.querySelectorAll('[data-b]').forEach(function (el) {
      var change = function () {
        var f = el.getAttribute('data-b');
        b[f] = el.value;
        if (f === 'classId') b.skills = [];
        if (f === 'raceId') b.subraceId = firstSubrace(el.value);
        renderBuilder(seat, host); validate();
      };
      el.onchange = change;
      if (el.tagName === 'INPUT') el.oninput = function () { b.name = el.value; validate(); drawPortrait(seat, host); };
    });

    var suggestBtn = host.querySelector('[data-act="suggest-scores"]');
    if (suggestBtn) suggestBtn.onclick = function () { useSuggestedScores(b); renderAbilities(seat, host); validate(); };

    renderGenAffordance(seat, host);
    renderAdvice(seat, host);
    renderAbilities(seat, host);
    renderSkills(seat, host);
    wireBackstory(seat, host);
    drawPortrait(seat, host);
    renderDerivedPreview(seat, host);
  }

  function firstSubrace(raceId) {
    var subs = subracesOf(raceId);
    return subs ? Object.keys(subs)[0] : '';
  }

  /* ----------------------------------------------------- generation route -- */

  /* Build the `fixed` map for Chargen.generate from whatever is pinned. In
     'random' mode nothing is pinned, so the whole character is the table's. */
  function fixedFor(b) {
    var fixed = {};
    if (b.mode !== 'surprise') return fixed;
    var pins = b.pins || {};
    if (pins.name && b.name && b.name.trim()) fixed.name = b.name.trim();
    if (pins.raceId) { fixed.raceId = b.raceId; if (b.subraceId) fixed.subraceId = b.subraceId; }
    if (pins.classId) fixed.classId = b.classId;
    if (pins.backgroundId) fixed.backgroundId = b.backgroundId;
    return fixed;
  }

  function generateInto(seat, host) {
    var b = seat.build;
    var C = Chargen();
    if (!C) return;
    var fixed = fixedFor(b);
    var g = C.generate({ rng: newRng(), fixed: fixed });
    applyGenerated(b, g, Object.keys(fixed));
    renderBuilder(seat, host); validate();
  }

  /* Fold a generated character back into the editable build object. Abilities
     become an editable standard-array assignment whose final scores match what
     the generator produced, so the sheet stays honest AND adjustable. */
  function applyGenerated(b, g, pinned) {
    b.name = g.name || b.name;
    b.raceId = g.raceId;
    b.subraceId = g.subraceId || '';
    b.classId = g.classId;
    b.backgroundId = g.backgroundId;
    b.skills = (g.skills || []).slice();
    b.method = 'standard';
    b.array = baseArrayFor(g.classId);
    if (g.backstory) { b.backstory = g.backstory; b.backstorySource = 'seed'; }
    b.gen = { pinned: (pinned || []).slice(), classId: g.classId, raceId: g.raceId, synergy: g.generated && g.generated.synergy };
  }

  function renderGenAffordance(seat, host) {
    var b = seat.build;
    var wrap = host.querySelector('[data-gen-affordance]');
    if (!wrap) return;
    if (b.mode === 'manual') { wrap.innerHTML = ''; return; }

    var html = '';
    if (b.mode === 'surprise') {
      html += '<p class="pool-note">Pin anything you care about; the table fills the rest.</p>';
      html += '<div class="pin-row">';
      [['name', 'Name'], ['raceId', 'Lineage'], ['classId', 'Class'], ['backgroundId', 'Background']].forEach(function (p) {
        var on = b.pins && b.pins[p[0]];
        html += '<label class="ctxtoggle"><input type="checkbox" data-pin="' + p[0] + '"' + (on ? ' checked' : '') + '> Pin ' + esc(p[1]) + '</label>';
      });
      html += '</div>';
      html += '<button class="chip" type="button" data-act="generate">Generate the rest</button>';
    } else {
      html += '<button class="chip" type="button" data-act="generate">' + (b.gen ? 'Reroll' : 'Roll a whole character') + '</button>';
    }
    if (b.gen) {
      var pinned = b.gen.pinned || [];
      var label = pinned.length ? 'Pinned: ' + pinned.map(fieldLabel).join(', ') + '. Everything else was generated.'
        : 'Every part of this character was generated. Adjust anything below.';
      html += '<div class="gen-note pool-note">' + esc(label) + (b.gen.synergy ? ' — ' + esc(b.gen.synergy) : '') + '</div>';
    }
    wrap.innerHTML = html;

    wrap.querySelectorAll('[data-pin]').forEach(function (cb) {
      cb.onchange = function () { b.pins = b.pins || {}; b.pins[cb.getAttribute('data-pin')] = cb.checked; };
    });
    var gen = wrap.querySelector('[data-act="generate"]');
    if (gen) gen.onclick = function () { generateInto(seat, host); };
  }

  function fieldLabel(f) {
    return { name: 'name', raceId: 'lineage', subraceId: 'subrace', classId: 'class', backgroundId: 'background' }[f] || f;
  }

  /* ------------------------------------------------------------- advice ---- */

  function renderAdvice(seat, host) {
    var b = seat.build;
    var wrap = host.querySelector('[data-advice]');
    var C = Chargen();
    if (!wrap || !C) { if (wrap) wrap.innerHTML = ''; return; }
    var s = C.suggestionsFor({ raceId: b.raceId, subraceId: b.subraceId || null, classId: b.classId });
    var html = '';
    if (s.abilityPriority) {
      html += '<div class="advice-line"><b>Ability priority:</b> ' + s.abilityPriority.map(function (a) { return a.toUpperCase(); }).join(' › ') + '</div>';
      if (s.abilityWhy) html += '<div class="advice-why">' + esc(s.abilityWhy) + '</div>';
    }
    if (s.playstyle) html += '<div class="advice-line"><b>Plays like:</b> ' + esc(s.playstyle) + '</div>';
    if (s.classNotes) html += '<div class="advice-why">' + esc(s.classNotes) + '</div>';
    if (s.synergy) html += '<div class="advice-line synergy">' + esc(s.synergy) + '</div>';
    (s.warnings || []).forEach(function (w) { html += '<div class="advice-warn">' + esc(w) + '</div>'; });
    wrap.innerHTML = html;
  }

  function suggestedSkillsFor(b) {
    var C = Chargen();
    if (!C) return [];
    var s = C.suggestionsFor({ raceId: b.raceId, subraceId: b.subraceId || null, classId: b.classId });
    return s.skills || [];
  }

  function useSuggestedScores(b) {
    var C = Chargen();
    if (!C) return;
    if (b.method === 'pointbuy') b.scores = C.suggestedPointBuy(b.classId);
    else { b.method = 'standard'; b.array = baseArrayFor(b.classId); }
  }

  /* ---------------------------------------------------------- backstory ---- */

  function renderBackstoryHtml(b) {
    var html = '<div class="backstory-block" data-backstory>';
    html += '<div class="fieldrow"><label>Backstory</label>' +
      '<textarea data-b-text="backstory" rows="4" placeholder="Type their history, ask the GM, or take a seed.">' + esc(b.backstory) + '</textarea></div>';
    html += '<div class="fieldrow"><label>Hint</label>' +
      '<input data-b-text="backstoryHint" value="' + esc(b.backstoryHint) + '" placeholder="Optional. e.g. something to do with the sea"></div>';
    html += '<div class="btnrow">' +
      '<button class="chip" type="button" data-bs="seed">Give me a seed</button>' +
      '<button class="chip" type="button" data-bs="gm">' + (b.backstory ? 'Ask the GM to rewrite it' : 'Ask the GM to write one') + '</button>' +
      '<span class="bs-status" data-bs-status></span></div>';
    html += '<p class="pool-note">The Dungeon Master reads this and may bring it back in play — that is the whole point of writing one.</p>';
    html += '</div>';
    return html;
  }

  function wireBackstory(seat, host) {
    var b = seat.build;
    host.querySelectorAll('[data-b-text]').forEach(function (el) {
      el.oninput = function () { b[el.getAttribute('data-b-text')] = el.value; b.backstorySource = 'typed'; };
    });
    var seedBtn = host.querySelector('[data-bs="seed"]');
    if (seedBtn) seedBtn.onclick = function () {
      var B = Backstory();
      var line = B ? B.seed(newRng()) : '';
      b.backstory = line; b.backstorySource = 'seed';
      var ta = host.querySelector('[data-b-text="backstory"]');
      if (ta) ta.value = line;
    };
    var gmBtn = host.querySelector('[data-bs="gm"]');
    var status = host.querySelector('[data-bs-status]');
    if (gmBtn) gmBtn.onclick = function () {
      var B = Backstory();
      if (!B) return;
      gmBtn.disabled = true;
      if (status) status.textContent = 'The GM is writing…';
      B.generate(backstorySpecFor(seat), { rng: newRng() }).then(function (res) {
        b.backstory = (res && res.text) || b.backstory;
        b.backstorySource = (res && res.source) || 'gm';
        var ta = host.querySelector('[data-b-text="backstory"]');
        if (ta) ta.value = b.backstory;
        if (status) status.textContent = res && res.source === 'seed' ? 'No model available — took a seed instead.' : 'Written by the GM.';
        gmBtn.disabled = false;
        gmBtn.textContent = 'Ask the GM to rewrite it';
      });
    };
  }

  function backstorySpecFor(seat) {
    var s = specFor(seat);
    var b = seat.build || {};
    return {
      name: s.name, raceId: s.raceId, subraceId: b.subraceId || null, classId: s.classId,
      levels: s.levels, backgroundId: s.backgroundId, abilities: s.abilities,
      skills: (s.proficiencies && s.proficiencies.skills) || [], hint: (b.backstoryHint || '').trim() || null,
    };
  }

  /* ------------------------------------------------------- derived result -- */

  function renderDerivedPreview(seat, host) {
    var el = host.querySelector('[data-derived]');
    if (!el) return;
    var Character = global.DND && global.DND.Character;
    if (!Character) { el.textContent = ''; return; }
    try {
      var layers = Character.buildFromSpec(specFor(seat));
      var d = Character.derive(layers.base, layers.progression, layers.runtime, []);
      el.innerHTML = '<span class="dv">HP <b>' + d.hpMax + '</b></span>' +
        '<span class="dv">AC <b>' + d.ac + '</b></span>' +
        '<span class="dv">Init <b>' + sign(d.initiative) + '</b></span>' +
        '<span class="dv">Saves ' + ABIL.map(function (a) { return a.toUpperCase() + ' ' + sign(d.saves[a]); }).join(' · ') + '</span>';
    } catch (e) { el.textContent = ''; }
  }

  function renderAbilities(seat, host) {
    var b = seat.build;
    var wrap = host.querySelector('[data-abils]');
    var pool = host.querySelector('[data-pool]');
    if (!wrap) return;
    var race = Data() && Data().RACES && Data().RACES[b.raceId];
    var C = Chargen();
    var asi = (C && race) ? C.mergedAsi(race, b.subraceId || null) : ((race && race.asi) || {});

    wrap.innerHTML = ABIL.map(function (ab) {
      var base = abilityBase(b, ab);
      var bonus = asi[ab] || 0;
      var total = (base == null ? 0 : base) + bonus;
      var ctrl = '';
      if (b.method === 'pointbuy') {
        ctrl = '<button class="chip" data-abil="' + ab + '" data-dir="-1" type="button">−</button>' +
          '<b>' + base + '</b><button class="chip" data-abil="' + ab + '" data-dir="1" type="button">+</button>';
      } else if (b.method === 'standard') {
        ctrl = '<select data-arr="' + ab + '">' + '<option value="">—</option>' +
          STANDARD_ARRAY.map(function (v) { return '<option value="' + v + '"' + (b.array[ab] === v ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select>';
      } else {
        ctrl = '<b>' + (base == null ? '—' : base) + '</b>';
      }
      return '<div class="aa"><div>' + ab.toUpperCase() + (bonus ? ' <span class="tag">+' + bonus + '</span>' : '') + '</div>' +
        ctrl + '<div class="pool-note">= ' + total + '</div></div>';
    }).join('');

    // point-buy steppers
    wrap.querySelectorAll('[data-abil]').forEach(function (btn) {
      btn.onclick = function () {
        var ab = btn.getAttribute('data-abil'), dir = +btn.getAttribute('data-dir');
        var v = b.scores[ab] + dir;
        if (v < 8 || v > 15) return;
        var next = Object.assign({}, b.scores); next[ab] = v;
        if (pointsUsed(next) > POINT_BUDGET) return;
        b.scores = next; renderAbilities(seat, host); validate();
      };
    });
    wrap.querySelectorAll('[data-arr]').forEach(function (sel) {
      sel.onchange = function () {
        var ab = sel.getAttribute('data-arr');
        b.array[ab] = sel.value ? +sel.value : null;
        renderAbilities(seat, host); validate();
      };
    });

    if (pool) {
      if (b.method === 'pointbuy') pool.textContent = 'Point buy: ' + pointsUsed(b.scores) + ' / ' + POINT_BUDGET + ' spent (each score 8–15).';
      else if (b.method === 'standard') pool.textContent = 'Assign 15, 14, 13, 12, 10, 8 — each exactly once.';
      else pool.textContent = 'Rolled scores. Re-pick the method to reroll.';
    }
    if (b.method === 'roll' && abilityBase(b, 'str') == null) rollScores(b);
    renderDerivedPreview(seat, host);
  }

  function rollScores(b) {
    var RNG = global.DND && global.DND.RNG;
    var rng = RNG ? new RNG(String(Math.random())) : null;
    function d6() { return rng ? (1 + Math.floor(rng.next() * 6)) : (1 + Math.floor(Math.random() * 6)); }
    b.rolled = {};
    ABIL.forEach(function (ab) {
      var r = [d6(), d6(), d6(), d6()].sort(function (x, y) { return x - y; });
      b.rolled[ab] = r[1] + r[2] + r[3];
    });
  }

  function abilityBase(b, ab) {
    if (b.method === 'pointbuy') return b.scores[ab];
    if (b.method === 'standard') return b.array[ab];
    return b.rolled ? b.rolled[ab] : null;
  }

  function pointsUsed(scores) {
    return ABIL.reduce(function (sum, ab) { return sum + (POINT_COST[scores[ab]] || 0); }, 0);
  }

  function renderSkills(seat, host) {
    var b = seat.build;
    var wrap = host.querySelector('[data-skills]');
    if (!wrap) return;
    var cd = Data() && Data().CLASSES && Data().CLASSES[b.classId];
    var choice = cd && cd.skillChoices;
    if (!choice) { wrap.innerHTML = '<span class="pool-note">No class skill choices.</span>'; return; }
    var C = Chargen();
    var suggested = suggestedSkillsFor(b);
    wrap.innerHTML = '<div class="pool-note">Choose ' + choice.count + ':</div>' + choice.from.map(function (sk) {
      var on = b.skills.indexOf(sk) >= 0;
      var reason = (C && C.skillReason(sk, b.classId)) || '';
      var tag = suggested.indexOf(sk) >= 0 ? ' <span class="tag suggested">suggested</span>' : '';
      return '<label class="ctxtoggle skillrow"><input type="checkbox" data-sk="' + sk + '"' + (on ? ' checked' : '') + '> ' +
        '<span class="skname">' + esc(sk) + tag + '</span>' +
        (reason ? '<span class="skwhy">' + esc(reason) + '</span>' : '') + '</label>';
    }).join('');
    wrap.querySelectorAll('[data-sk]').forEach(function (cb) {
      cb.onchange = function () {
        var sk = cb.getAttribute('data-sk');
        if (cb.checked) { if (b.skills.length >= choice.count) { cb.checked = false; return; } b.skills.push(sk); }
        else b.skills = b.skills.filter(function (x) { return x !== sk; });
        validate();
      };
    });
  }

  function drawPortrait(seat, host) {
    var b = seat.build;
    var canvas = host.querySelector('.build-portrait');
    var P = global.DND && global.DND.Portrait;
    if (!canvas || !P) return;
    try {
      var gm = P.genomeForCharacter('build:' + seat.id + ':' + b.raceId + ':' + b.classId, { raceId: b.raceId, classId: b.classId });
      P.drawPortrait(canvas.getContext('2d'), gm, canvas.width, canvas.height, {});
    } catch (e) { /* art must never block setup */ }
  }

  /* --------------------------------------------------------- validate --- */
  function validate() {
    var msgs = [];
    if (!W.campaign) msgs.push('Choose a campaign.');
    if (!W.seats.length) msgs.push('Add at least one seat.');
    W.seats.forEach(function (seat) {
      if (seat.char.kind === 'build') {
        var b = seat.build;
        if (!b.name || !b.name.trim()) msgs.push(seat.name + ': name the character.');
        if (b.method === 'pointbuy' && pointsUsed(b.scores) !== POINT_BUDGET) msgs.push(seat.name + ': spend all ' + POINT_BUDGET + ' points.');
        if (b.method === 'standard') {
          var vals = ABIL.map(function (a) { return b.array[a]; }).filter(function (v) { return v != null; });
          if (vals.length !== 6) msgs.push(seat.name + ': assign every ability.');
          else if (!sameMultiset(vals, STANDARD_ARRAY)) msgs.push(seat.name + ': use each array value once.');
        }
        var cd = Data() && Data().CLASSES && Data().CLASSES[b.classId];
        if (cd && cd.skillChoices && b.skills.length !== cd.skillChoices.count) msgs.push(seat.name + ': choose ' + cd.skillChoices.count + ' skills.');
      }
    });
    var box = document.getElementById('setup-validation');
    var begin = document.getElementById('btn-begin');
    if (msgs.length) {
      if (box) { box.className = 'validation'; box.textContent = msgs[0] + (msgs.length > 1 ? ' (+' + (msgs.length - 1) + ' more)' : ''); }
      if (begin) begin.disabled = true;
    } else {
      if (box) { box.className = 'validation ok'; box.textContent = 'Ready to begin.'; }
      if (begin) begin.disabled = false;
    }
    return !msgs.length;
  }

  function sameMultiset(a, b) {
    var x = a.slice().sort(), y = b.slice().sort();
    return x.length === y.length && x.every(function (v, i) { return v === y[i]; });
  }

  /* ----------------------------------------------------- build session -- */
  function specFor(seat) {
    if (seat.char.kind === 'pregen') {
      var p = pregens().filter(function (x) { return x.id === seat.char.pregenId; })[0] || pregens()[0];
      return {
        name: p.name, raceId: p.raceId, classId: p.classId, levels: p.levels || 1,
        backgroundId: p.backgroundId, abilities: p.abilities,
        proficiencies: { skills: p.skills.slice() },
      };
    }
    var b = seat.build;
    var race = Data() && Data().RACES && Data().RACES[b.raceId];
    var C = Chargen();
    var asi = (C && race) ? C.mergedAsi(race, b.subraceId || null) : ((race && race.asi) || {});
    var finalAb = {};
    ABIL.forEach(function (ab) { finalAb[ab] = (abilityBase(b, ab) || 8) + (asi[ab] || 0); });
    var bg = Data() && Data().BACKGROUNDS && Data().BACKGROUNDS[b.backgroundId];
    var skills = (b.skills || []).slice();
    if (bg && bg.skillProfs) bg.skillProfs.forEach(function (sk) { if (skills.indexOf(sk) < 0) skills.push(sk); });
    return {
      name: (b.name || '').trim(), raceId: b.raceId, subraceId: b.subraceId || null, classId: b.classId, levels: 1,
      backgroundId: b.backgroundId, abilities: finalAb,
      proficiencies: { skills: skills },
      backstory: (b.backstory || '').trim(),
    };
  }

  /* Starting gear now lives in Character.buildFromSpec, so every path that
     makes a character gets it — the wizard, a replacement after a death, an
     AI-generated companion. Keeping a second copy here is how the engine
     came to hand out naked level-5 fighters to everything except this
     screen. */

  function buildSession(dm) {
    var State = global.DND.State, Character = global.DND.Character, Game = global.DND.Game;
    var seed = W.seed || Math.random().toString(36).slice(2);
    var state = State.create({
      seed: seed, campaignId: W.campaign.id,
      tone: dm.tone, difficulty: dm.difficulty, contentLimits: dm.limits,
    });
    /* The mortality engine reads the campaign's death policy from here;
       Mortality.policy() falls back to 'standard' for anything unknown. */
    state.meta = state.meta || {};
    state.meta.deathPolicy = dm.deathPolicy || 'standard';
    W.seats.forEach(function (seat, i) {
      var spec = specFor(seat);
      var layers = Character.buildFromSpec(spec);
      /* The Dungeon Master receives this through partySummary() and may bring
         it back in play; without it a written backstory would be lost between
         the wizard and the table. */
      if (spec.backstory) layers.base.backstory = spec.backstory;
      var actorId = 'pc' + (i + 1);
      State.addActor(state, {
        id: actorId, name: spec.name, side: 'party', kind: 'pc', role: spec.classId,
        base: layers.base, progression: layers.progression, runtime: layers.runtime,
      });
      State.addSeat(state, {
        id: seat.id, name: seat.name, actorId: actorId,
        control: seat.control === 'ai' ? 'playerAI' : 'human',
        agent: seat.control === 'ai' ? agentFor(seat) : null,
      });
      seat.actorId = actorId;
    });
    state.activeActorId = state.seats[0] && state.seats[0].actorId;

    /* A campaign with no prior story still needs somewhere to be. Without
       this, a new sandbox opened onto a single character alone in an empty
       room with nothing to do but "search the area" — which the first UI
       session test caught immediately. */
    var campaign = W.campaign.campaignObj;
    var store = null;
    var Worldgen = global.DND.Worldgen;

    if (W.campaign.id === 'shen_continuation') {
      /* The flagship built-in campaign. The page previously listed it and then
         started an empty sandbox, because the campaign scripts were not loaded
         and nothing ever called applyTo — a labelled empty shell. */
      var built = buildShenContinuation(state, dm);
      if (built) { campaign = built.campaign; store = built.store; }
    } else if (W.campaign.id === 'sandbox' && Worldgen) {
      try {
        var opening = Worldgen.generateOpening(state, {
          tone: dm.tone === 'grim' ? undefined : campaign.tone,
        });
        campaign = opening.campaign;
        W.opening = opening;
      } catch (e) {
        /* A failed generation must not stop the player starting a game; they
           simply begin in an unfurnished room rather than not at all. */
        if (global.console) global.console.warn('world generation failed:', e && e.message);
      }
    }

    var session = Game.createSession({ state: state, store: store, campaign: campaign });
    if (W.opening && W.opening.scene) {
      session.locationName = W.opening.scene.name;
      session.timeOfDay = W.opening.scene.timeOfDay;
      session.weather = W.opening.scene.weather;
    }
    if (W.shenScene) {
      session.locationName = W.shenScene.name;
      session.timeOfDay = W.shenScene.timeOfDay;
      session.weather = W.shenScene.weather;
    }
    return session;
  }

  /**
   * Load the recorded Shen Cooper save-state into a fresh session.
   *
   * The seats built by the wizard are discarded in favour of the campaign's
   * own cast — resuming a campaign means playing the people in it, not
   * standing new strangers next to them.
   */
  function buildShenContinuation(state, dm) {
    var C = global.DND.Campaigns;
    var Knowledge = global.DND.Knowledge;
    var State = global.DND.State;
    if (!C || !C.shenCooper || !C.shenContinuation || !Knowledge) {
      if (global.console) global.console.warn('the Shen campaign data did not load');
      return null;
    }
    try {
      var pub = C.shenCooper;
      var bible = C.shenCooperBible || {};
      var store = Knowledge.makeStore();
      Knowledge.defineFacts(store,
        (bible.FACTS || []).concat(bible.EARNED || [], bible.SECRETS || []));
      store.known = state.knowledge;

      /* Clear the placeholder cast the wizard made. */
      State.clearCast(state);

      C.shenContinuation.applyTo(state, store);
      State.refreshAllDerived(state);

      /* Seat the wizard's players onto the campaign's own characters, in the
         order the campaign lists them, so a solo game plays Shen. */
      var cast = ['shen', 'aldren', 'mara', 'corvin'].filter(function (id) {
        return State.hasActor ? State.hasActor(state, id) : true;
      });
      W.seats.forEach(function (seat, i) {
        var actorId = cast[i];
        if (!actorId) return;
        State.addSeat(state, {
          id: seat.id, name: seat.name, actorId: actorId,
          control: seat.control === 'ai' ? 'playerAI' : 'human',
          agent: seat.control === 'ai' ? agentFor(seat) : null,
        });
        seat.actorId = actorId;
      });
      cast.slice(W.seats.length).forEach(function (id) {
        State.setController(state, id, { kind: 'companionPolicy', seatId: null, agent: null });
      });
      state.activeActorId = (state.seats[0] && state.seats[0].actorId) || cast[0];

      var loc = pub.locations && pub.locations[state.locationId];
      W.shenScene = {
        name: (loc && loc.name) || 'Lantern\u2019s Rest',
        timeOfDay: (loc && loc.timeOfDay) || 'dusk',
        weather: (loc && loc.weather) || 'fog',
      };
      return { campaign: pub, store: store };
    } catch (e) {
      if (global.console) global.console.warn('could not resume the Shen campaign:', e && e.message);
      return null;
    }
  }

  function agentFor(seat) {
    var m = seat.model || '';
    if (m.indexOf('copilot:') === 0) return { backend: 'copilot', model: m.slice(8), persona: seat.persona };
    if (!m) return { backend: 'offline', model: null, persona: seat.persona };
    return { backend: 'ollama', model: m, persona: seat.persona };
  }

  function beginGame() {
    if (!validate()) return;
    var dm = readDmConfig();
    var session;
    try { session = buildSession(dm); }
    catch (e) {
      var box = document.getElementById('setup-validation');
      if (box) { box.className = 'validation'; box.textContent = 'Could not start: ' + (e && e.message); }
      return;
    }
    close();
    if (onBeginCb) onBeginCb(session, dm);
  }

  function readDmConfig() {
    var $ = function (id) { return document.getElementById(id); };
    var death = document.querySelector('input[name="dm-death"]:checked');
    return {
      model: ($('dm-model') && $('dm-model').value) || '',
      tone: ($('dm-tone') && $('dm-tone').value) || 'heroic',
      difficulty: ($('dm-difficulty') && $('dm-difficulty').value) || 'standard',
      deathPolicy: (death && death.value) || 'standard',
      limits: (($('dm-limits') && $('dm-limits').value) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
    };
  }

  var api = { open: open, close: close, buildSession: buildSession, pregens: pregens, POINT_BUDGET: POINT_BUDGET };
  global.DND = global.DND || {};
  global.DND.Setup = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
