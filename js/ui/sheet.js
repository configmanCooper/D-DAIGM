/*
 * ui/sheet.js — DND.Sheet
 *
 * The full 5e character sheet for the viewer's own hero, recomputed from
 * Character.derive (never stored, so it can never drift from the three layers).
 * AC carries its acBreakdown on expand; Warlock pact slots are shown as a
 * separate pool from the Vancian table, because they refresh differently and a
 * player who thinks a pact slot is "just a 3rd-level slot" will plan the fight
 * wrong.
 */
(function (global) {
  'use strict';

  var ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  var ABIL_NAME = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
  var SKILL_NAME = {
    acrobatics: 'Acrobatics', animalHandling: 'Animal Handling', arcana: 'Arcana', athletics: 'Athletics',
    deception: 'Deception', history: 'History', insight: 'Insight', intimidation: 'Intimidation',
    investigation: 'Investigation', medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
    performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion', sleightOfHand: 'Sleight of Hand',
    stealth: 'Stealth', survival: 'Survival',
  };

  function sign(n) { return (n >= 0 ? '+' : '') + n; }

  function classLine(App, base) {
    var Data = global.DND && global.DND.Data;
    return (base.classes || []).map(function (c) {
      var cd = Data && Data.CLASSES && Data.CLASSES[c.classId];
      var name = (cd && cd.name) || c.classId || '?';
      var sub = c.subclassId ? ' (' + c.subclassId + ')' : '';
      return name + sub + ' ' + c.levels;
    }).join(' / ');
  }

  function raceLine(base) {
    var Data = global.DND && global.DND.Data;
    var rid = base.subraceId || base.raceId;
    var r = Data && Data.RACES && (Data.RACES[base.raceId]);
    return (r && r.name) || base.raceId || 'unknown lineage';
  }

  function gatherFeatures(base) {
    var Data = global.DND && global.DND.Data;
    var out = [];
    (base.classes || []).forEach(function (c) {
      var cd = Data && Data.CLASSES && Data.CLASSES[c.classId];
      if (!cd || !cd.features) return;
      for (var lv = 1; lv <= c.levels; lv++) {
        (cd.features[lv] || []).forEach(function (f) {
          out.push({ level: lv, cls: cd.name, name: f.name, text: f.text });
        });
      }
    });
    return out;
  }

  function render() {
    var App = global.DND && global.DND.App;
    if (!App) return;
    var host = document.getElementById('pane-sheet');
    if (!host) return;
    if (!App.session) { host.innerHTML = '<p class="empty-note">No session.</p>'; return; }

    var id = App.viewerId();
    var sv = App.selfView(id);
    var d = App.derivedFor(id);
    if (!sv || !d) { host.innerHTML = '<p class="empty-note">No character in this seat.</p>'; return; }
    var base = sv.base;

    var html = '<div class="sheet">';
    html += '<div class="idline">' + App.esc(sv.name) + '</div>';
    html += '<div class="idsub">' + App.esc(raceLine(base)) + ' · ' + App.esc(classLine(App, base)) +
      ' · level ' + d.level + '</div>';

    // level-up availability
    if (App.canLevelUp(id)) {
      html += '<button class="chip" id="btn-levelup" style="margin-bottom:.5rem">▲ Level up available</button>';
    }

    // abilities
    html += '<h3>Abilities</h3><div class="abilities">';
    ABIL.forEach(function (ab) {
      html += '<div class="abil" title="' + ABIL_NAME[ab] + '"><div class="k">' + ab + '</div>' +
        '<div class="m">' + sign(d.abilityMods[ab]) + '</div><div class="s">' + d.abilities[ab] + '</div></div>';
    });
    html += '</div>';

    // core stats
    html += '<h3>Combat</h3><div class="statgrid">';
    html += '<div class="stat" data-expand="ac" title="Click to see the AC breakdown"><div class="k">Armour Class</div><div class="v">' + d.ac + '</div></div>';
    html += '<div class="stat"><div class="k">Initiative</div><div class="v">' + sign(d.initiative) + '</div></div>';
    html += '<div class="stat"><div class="k">Speed</div><div class="v">' + d.speed + ' ft</div></div>';
    html += '<div class="stat"><div class="k">Proficiency</div><div class="v">' + sign(d.proficiencyBonus) + '</div></div>';
    html += '<div class="stat"><div class="k">Hit Points</div><div class="v">' + sv.hp + '/' + d.hpMax +
      (sv.tempHp ? ' (+' + sv.tempHp + ')' : '') + '</div></div>';
    html += '<div class="stat"><div class="k">Hit Dice</div><div class="v">' + hitDiceText(App, base, sv) + '</div></div>';
    html += '</div>';
    html += '<ul class="acbreak" id="acbreak" hidden></ul>';

    // saves
    html += '<h3>Saving Throws</h3><div class="statgrid">';
    var saveProfs = (base.proficiencies && base.proficiencies.saves) || [];
    ABIL.forEach(function (ab) {
      var prof = saveProfs.indexOf(ab) >= 0;
      html += '<div class="stat"><div class="k">' + (prof ? '● ' : '○ ') + ab + '</div><div class="v">' + sign(d.saves[ab]) + '</div></div>';
    });
    html += '</div>';

    // senses
    html += '<h3>Senses</h3><div class="statgrid">';
    html += '<div class="stat"><div class="k">Passive Perception</div><div class="v">' + d.passives.perception + '</div></div>';
    html += '<div class="stat"><div class="k">Passive Insight</div><div class="v">' + d.passives.insight + '</div></div>';
    if (d.senses && d.senses.darkvision) html += '<div class="stat"><div class="k">Darkvision</div><div class="v">' + d.senses.darkvision + ' ft</div></div>';
    html += '</div>';

    // skills
    html += '<h3>Skills</h3><ul class="skills">';
    Object.keys(SKILL_NAME).forEach(function (sk) {
      var s = d.skills[sk] || { mod: 0, proficient: false, expertise: false };
      var cls = s.expertise ? 'expert' : (s.proficient ? '' : 'none');
      var mark = (s.proficient || s.expertise) ? '<span class="prof"></span>' : '<span class="none"></span>';
      html += '<li class="' + cls + '">' + mark + '<span>' + SKILL_NAME[sk] + '</span><span>' + sign(s.mod) +
        ' <span class="tag">' + s.ability + '</span></span></li>';
    });
    html += '</ul>';

    // spellcasting
    var sc = d.spellcasting;
    if (sc && (sc.ability || (sc.slotsMax && Object.keys(sc.slotsMax).length) || sc.pactSlots)) {
      html += '<h3>Spellcasting</h3>';
      if (sc.ability) {
        html += '<div class="statgrid">';
        html += '<div class="stat"><div class="k">Ability</div><div class="v">' + sc.ability + '</div></div>';
        html += '<div class="stat"><div class="k">Save DC</div><div class="v">' + (sc.dc == null ? '—' : sc.dc) + '</div></div>';
        html += '<div class="stat"><div class="k">Attack</div><div class="v">' + (sc.attackBonus == null ? '—' : sign(sc.attackBonus)) + '</div></div>';
        html += '</div>';
      }
      // Vancian slots
      Object.keys(sc.slotsMax || {}).sort(function (a, b) { return a - b; }).forEach(function (lv) {
        var max = sc.slotsMax[lv], rem = (sc.slotsRemaining && sc.slotsRemaining[lv]) || 0;
        html += '<div class="slotrow">Level ' + lv + ' ';
        for (var i = 0; i < max; i++) html += '<span class="slot-dot' + (i >= rem ? ' spent' : '') + '"></span>';
        html += ' <span class="tag">' + rem + '/' + max + '</span></div>';
      });
      // Warlock pact magic — a separate pool
      if (sc.pactSlots) {
        var p = sc.pactSlots;
        html += '<div class="slotrow"><span class="pact">Pact slots (level ' + p.level + ')</span> ';
        for (var j = 0; j < p.max; j++) html += '<span class="slot-dot' + (j >= p.remaining ? ' spent' : '') + '"></span>';
        html += ' <span class="tag">' + p.remaining + '/' + p.max + '</span></div>';
      }
      if (sc.cantripsKnown && sc.cantripsKnown.length) {
        html += '<div class="pool-note">Cantrips: ' + sc.cantripsKnown.map(App.esc).join(', ') + '</div>';
      }
      if (sc.prepared && sc.prepared.length) {
        html += '<div class="pool-note">' + (sc.prepares === 'known' ? 'Known' : 'Prepared') + ': ' +
          sc.prepared.map(App.esc).join(', ') + '</div>';
      }
    }

    // defences
    var res = d.resistances || [], imm = d.immunities || [], vul = d.vulnerabilities || [];
    if (res.length || imm.length || vul.length) {
      html += '<h3>Defences</h3><div>';
      if (res.length) html += '<div class="pool-note">Resistant: ' + res.map(App.esc).join(', ') + '</div>';
      if (imm.length) html += '<div class="pool-note">Immune: ' + imm.map(App.esc).join(', ') + '</div>';
      if (vul.length) html += '<div class="pool-note">Vulnerable: ' + vul.map(App.esc).join(', ') + '</div>';
      html += '</div>';
    }

    // features
    var feats = gatherFeatures(base);
    if (feats.length) {
      html += '<h3>Features</h3>';
      feats.forEach(function (f) {
        html += '<div class="feature"><div class="fname">' + App.esc(f.name) +
          ' <span class="tag">' + App.esc(f.cls) + ' ' + f.level + '</span></div>' +
          '<div class="ftext">' + App.esc(f.text) + '</div></div>';
      });
    }

    html += '</div>';
    host.innerHTML = html;

    // AC breakdown reveal
    var acStat = host.querySelector('.stat[data-expand="ac"]');
    var acBreak = host.querySelector('#acbreak');
    if (acStat && acBreak) {
      acStat.style.cursor = 'pointer';
      acStat.tabIndex = 0;
      var toggle = function () {
        if (acBreak.hidden) {
          acBreak.innerHTML = (d.acBreakdown || []).map(function (b) {
            var val = b.value != null ? b.value : (b.add != null ? '+' + b.add : '');
            return '<li>' + App.esc(b.source || b.type || 'AC') + (b.type ? ' <span class="tag">' + App.esc(b.type) + '</span>' : '') +
              ' ' + App.esc(String(val)) + (b.applied === false ? ' <span class="tag">not applied</span>' : '') + '</li>';
          }).join('') || '<li>Base rules only.</li>';
          acBreak.hidden = false;
        } else { acBreak.hidden = true; }
      };
      acStat.onclick = toggle;
      acStat.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
    }
    var lu = host.querySelector('#btn-levelup');
    if (lu) lu.onclick = function () { App.levelUp(id); };
  }

  function hitDiceText(App, base, sv) {
    var Data = global.DND && global.DND.Data;
    var byDie = {};
    (base.classes || []).forEach(function (c) {
      var cd = Data && Data.CLASSES && Data.CLASSES[c.classId];
      var die = 'd' + ((cd && cd.hitDie) || 8);
      byDie[die] = (byDie[die] || 0) + c.levels;
    });
    var spent = sv.hitDiceSpent || {};
    return Object.keys(byDie).map(function (die) {
      var used = spent[die] || 0;
      return (byDie[die] - used) + '/' + byDie[die] + die;
    }).join(', ') || '—';
  }

  var api = { render: render };
  global.DND = global.DND || {};
  global.DND.Sheet = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
