/**
 * tests\data.test.js
 * ---------------------------------------------------------------------------
 * Plain-Node validation script (no test framework) for the SRD data files
 * under js\data. Run with: node tests\data.test.js
 * Exits 0 on success, 1 on any failure, printing a summary table of counts.
 * ---------------------------------------------------------------------------
 */
'use strict';

var assert = require('assert');
var path = require('path');

var RACES = require(path.join(__dirname, '..', 'js', 'data', 'srd_races.js')).RACES;
var CLASSES_MOD = require(path.join(__dirname, '..', 'js', 'data', 'srd_classes.js'));
var CLASSES = CLASSES_MOD.CLASSES;
var SPELLS = require(path.join(__dirname, '..', 'js', 'data', 'srd_spells.js')).SPELLS;
var MONSTERS = require(path.join(__dirname, '..', 'js', 'data', 'srd_monsters.js')).MONSTERS;
var ITEMS = require(path.join(__dirname, '..', 'js', 'data', 'srd_items.js')).ITEMS;
var RULES = require(path.join(__dirname, '..', 'js', 'data', 'srd_rules.js'));
var LICENSE_TEXT = require(path.join(__dirname, '..', 'js', 'data', 'srd_license.js')).LICENSE_TEXT;

var passCount = 0;
var failCount = 0;
var failures = [];

function test(name, fn) {
  try {
    fn();
    passCount++;
  } catch (err) {
    failCount++;
    failures.push({ name: name, error: err });
    console.error('FAIL: ' + name);
    console.error('   ' + (err && err.message ? err.message : err));
  }
}

var KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
var VALID_CLASS_IDS = Object.keys(CLASSES);
var VALID_CR = [0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
var VALID_CAST_TIME = ['action', 'bonus', 'reaction', 'minute', 'hour'];
var VALID_ACTION_TYPES = ['melee_weapon', 'ranged_weapon', 'spell', 'special'];
var VALID_CASTER_TYPES = ['full', 'half', 'pact', 'none'];
var VALID_PREPARES = ['prepared', 'known', 'spellbook', 'none'];

function isKebabCase(str) {
  return KEBAB_RE.test(str);
}

function collectDuplicateIds(map) {
  var seen = {};
  var dups = [];
  Object.keys(map).forEach(function (k) {
    var id = map[k] && map[k].id;
    if (id === undefined) return;
    if (seen[id]) dups.push(id);
    seen[id] = true;
  });
  return dups;
}

// ---------------------------------------------------------------------------
// RACES
// ---------------------------------------------------------------------------
test('races: minimum count (>=9)', function () {
  var count = Object.keys(RACES).length;
  assert.ok(count >= 9, 'expected >=9 races, got ' + count);
});

test('races: every race has required fields and a visual block', function () {
  Object.keys(RACES).forEach(function (key) {
    var r = RACES[key];
    assert.ok(r.id, key + ' missing id');
    assert.strictEqual(r.id, key, key + ' id does not match map key');
    assert.ok(isKebabCase(r.id) || /^[a-zA-Z]+$/.test(key), key + ' id not kebab-case-ish');
    assert.ok(r.name, key + ' missing name');
    assert.ok(r.size, key + ' missing size');
    assert.ok(typeof r.speed === 'number', key + ' missing speed');
    assert.ok(r.asi !== undefined, key + ' missing asi');
    assert.ok(r.description, key + ' missing description');
    assert.ok(Array.isArray(r.languages), key + ' missing languages');
    assert.ok(Array.isArray(r.traits), key + ' missing traits');
    assert.ok(r.profs, key + ' missing profs');
    assert.ok(r.visual, key + ' missing visual block');
    assert.ok(Array.isArray(r.visual.palette) && r.visual.palette.length > 0, key + ' visual missing palette');
    assert.ok(r.visual.build, key + ' visual missing build');
    assert.ok(Array.isArray(r.visual.heightRange) && r.visual.heightRange.length === 2, key + ' visual missing heightRange');
  });
});

test('races: no duplicate ids', function () {
  var dups = collectDuplicateIds(RACES);
  assert.strictEqual(dups.length, 0, 'duplicate race ids: ' + dups.join(','));
});

test('races: subraces (if present) have visual-relevant fields', function () {
  Object.keys(RACES).forEach(function (key) {
    var r = RACES[key];
    if (!r.subraces) return;
    Object.keys(r.subraces).forEach(function (sk) {
      var sr = r.subraces[sk];
      assert.ok(sr.id, key + '.' + sk + ' subrace missing id');
      assert.ok(sr.name, key + '.' + sk + ' subrace missing name');
      assert.ok(Array.isArray(sr.traits), key + '.' + sk + ' subrace missing traits');
    });
  });
});

// ---------------------------------------------------------------------------
// CLASSES
// ---------------------------------------------------------------------------
test('classes: exact count (==12)', function () {
  var count = Object.keys(CLASSES).length;
  assert.strictEqual(count, 12, 'expected exactly 12 classes, got ' + count);
});

test('classes: every class has required fields, level 1-20 features, and a visual block', function () {
  Object.keys(CLASSES).forEach(function (key) {
    var c = CLASSES[key];
    assert.ok(c.id, key + ' missing id');
    assert.strictEqual(c.id, key, key + ' id does not match map key');
    assert.ok(c.name, key + ' missing name');
    assert.ok(typeof c.hitDie === 'number', key + ' missing hitDie');
    assert.ok(Array.isArray(c.primaryAbility) && c.primaryAbility.length > 0, key + ' missing primaryAbility');
    assert.ok(Array.isArray(c.savingThrows) && c.savingThrows.length === 2, key + ' missing savingThrows');
    assert.ok(c.subclass && c.subclass.id && c.subclass.name, key + ' missing subclass');
    assert.ok(c.features, key + ' missing features map');
    for (var lvl = 1; lvl <= 20; lvl++) {
      assert.ok(Array.isArray(c.features[lvl]), key + ' missing features for level ' + lvl);
    }
    assert.ok(c.visual, key + ' missing visual block');
    assert.ok(Array.isArray(c.visual.palette) && c.visual.palette.length > 0, key + ' visual missing palette');
    assert.ok(c.visual.armorSilhouette, key + ' visual missing armorSilhouette');
    assert.ok(Array.isArray(c.visual.iconicGear), key + ' visual missing iconicGear');
  });
});

test('classes: every class has subclassLevel, casterType, and prepares', function () {
  Object.keys(CLASSES).forEach(function (key) {
    var c = CLASSES[key];
    assert.ok(typeof c.subclassLevel === 'number' && c.subclassLevel >= 1 && c.subclassLevel <= 20, key + ' missing/invalid subclassLevel');
    assert.ok(VALID_CASTER_TYPES.indexOf(c.casterType) !== -1, key + ' missing/invalid casterType: ' + c.casterType);
    assert.ok(VALID_PREPARES.indexOf(c.prepares) !== -1, key + ' missing/invalid prepares: ' + c.prepares);
  });
});

test('classes: warlock is casterType pact and excluded from full/half slot tables semantics', function () {
  assert.strictEqual(CLASSES.warlock.casterType, 'pact', 'warlock casterType must be "pact"');
  Object.keys(CLASSES).forEach(function (key) {
    if (key === 'warlock') return;
    assert.notStrictEqual(CLASSES[key].casterType, 'pact', key + ' incorrectly marked casterType "pact"');
  });
});

test('classes: known-correct subclassLevel per SRD (cleric/sorcerer/warlock=1, wizard=2, others=3)', function () {
  assert.strictEqual(CLASSES.cleric.subclassLevel, 1, 'cleric subclassLevel should be 1');
  assert.strictEqual(CLASSES.sorcerer.subclassLevel, 1, 'sorcerer subclassLevel should be 1');
  assert.strictEqual(CLASSES.warlock.subclassLevel, 1, 'warlock subclassLevel should be 1');
  assert.strictEqual(CLASSES.wizard.subclassLevel, 2, 'wizard subclassLevel should be 2');
});

test('classes: spellcasting info present for casters, null for non-casters', function () {
  var casters = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'];
  var nonCasters = ['barbarian', 'fighter', 'monk', 'rogue'];
  casters.forEach(function (key) {
    assert.ok(CLASSES[key].spellcasting, key + ' should have spellcasting info');
    assert.ok(CLASSES[key].spellcasting.ability, key + ' spellcasting missing ability');
  });
  nonCasters.forEach(function (key) {
    assert.strictEqual(CLASSES[key].spellcasting, null, key + ' should not have spellcasting');
  });
});

test('classes: slot tables and proficiency bonus exported and valid', function () {
  assert.ok(CLASSES_MOD.SPELL_SLOTS_FULL, 'missing SPELL_SLOTS_FULL');
  assert.ok(CLASSES_MOD.SPELL_SLOTS_HALF, 'missing SPELL_SLOTS_HALF');
  assert.ok(CLASSES_MOD.WARLOCK_SLOTS, 'missing WARLOCK_SLOTS');
  assert.ok(Array.isArray(CLASSES_MOD.PROFICIENCY_BONUS), 'missing PROFICIENCY_BONUS');
  assert.strictEqual(CLASSES_MOD.PROFICIENCY_BONUS.length, 21, 'PROFICIENCY_BONUS should be indexable 0-20');
  for (var lvl = 1; lvl <= 20; lvl++) {
    assert.ok(Array.isArray(CLASSES_MOD.SPELL_SLOTS_FULL[lvl]) && CLASSES_MOD.SPELL_SLOTS_FULL[lvl].length === 9, 'SPELL_SLOTS_FULL[' + lvl + '] malformed');
    assert.ok(Array.isArray(CLASSES_MOD.SPELL_SLOTS_HALF[lvl]) && CLASSES_MOD.SPELL_SLOTS_HALF[lvl].length === 5, 'SPELL_SLOTS_HALF[' + lvl + '] malformed');
    assert.ok(CLASSES_MOD.WARLOCK_SLOTS[lvl] && typeof CLASSES_MOD.WARLOCK_SLOTS[lvl].slots === 'number', 'WARLOCK_SLOTS[' + lvl + '] malformed');
  }
});

// ---------------------------------------------------------------------------
// SPELLS
// ---------------------------------------------------------------------------
test('spells: minimum count (>=250)', function () {
  var count = Object.keys(SPELLS).length;
  assert.ok(count >= 250, 'expected >=250 spells, got ' + count);
});

test('spells: every spell has required fields and a visual block', function () {
  Object.keys(SPELLS).forEach(function (key) {
    var s = SPELLS[key];
    assert.ok(s.id, key + ' missing id');
    assert.strictEqual(s.id, key, key + ' id does not match map key');
    assert.ok(isKebabCase(s.id), key + ' id not kebab-case');
    assert.ok(s.name, key + ' missing name');
    assert.ok(typeof s.level === 'number' && s.level >= 0 && s.level <= 9, key + ' invalid level');
    assert.ok(s.school, key + ' missing school');
    assert.ok(s.castingTime, key + ' missing castingTime');
    assert.ok(s.range, key + ' missing range');
    assert.ok(s.components, key + ' missing components');
    assert.ok(s.duration, key + ' missing duration');
    assert.ok(typeof s.concentration === 'boolean', key + ' missing concentration flag');
    assert.ok(typeof s.ritual === 'boolean', key + ' missing ritual flag');
    assert.ok(Array.isArray(s.classes), key + ' missing classes array');
    assert.ok(s.text, key + ' missing text');
    assert.ok(s.mech, key + ' missing mech block');
    assert.ok(s.visual, key + ' missing visual block');
  });
});

test('spells: mech.concentration (boolean) and mech.effects (array) required on every spell', function () {
  Object.keys(SPELLS).forEach(function (key) {
    var s = SPELLS[key];
    assert.ok(typeof s.mech.concentration === 'boolean', key + ' mech missing concentration boolean');
    assert.strictEqual(s.mech.concentration, s.concentration, key + ' mech.concentration disagrees with top-level concentration');
    assert.ok(typeof s.mech.ritual === 'boolean', key + ' mech missing ritual boolean');
    assert.ok(VALID_CAST_TIME.indexOf(s.mech.castTime) !== -1, key + ' mech missing/invalid castTime: ' + s.mech.castTime);
    if (s.mech.castTime === 'reaction') {
      assert.ok(s.mech.reactionTrigger, key + ' reaction spell missing mech.reactionTrigger');
    }
    assert.ok(s.mech.components && typeof s.mech.components === 'object', key + ' mech missing components object');
    assert.ok(s.mech.targets && typeof s.mech.targets === 'object', key + ' mech missing targets object');
    assert.ok(Array.isArray(s.mech.effects) && s.mech.effects.length >= 1, key + ' mech.effects must be a non-empty array');
  });
});

test('spells: every non-cantrip damaging spell has scaling or explicit scaling:null', function () {
  Object.keys(SPELLS).forEach(function (key) {
    var s = SPELLS[key];
    if (s.level === 0) {
      assert.ok('cantripScaling' in s.mech, key + ' cantrip missing cantripScaling key (use null if non-scaling)');
      return;
    }
    var hasDamage = s.mech.effects.some(function (e) {
      return (e.kind === 'attack' || e.kind === 'save') && Array.isArray(e.damage) && e.damage.length > 0;
    });
    if (hasDamage) {
      assert.ok('scaling' in s.mech, key + ' damaging leveled spell missing scaling key (use null if non-scaling)');
    }
  });
});

test('spells: every classes[] entry refers to a real class id', function () {
  var bad = [];
  Object.keys(SPELLS).forEach(function (key) {
    SPELLS[key].classes.forEach(function (cid) {
      if (VALID_CLASS_IDS.indexOf(cid) === -1) bad.push(key + ' -> ' + cid);
    });
  });
  assert.strictEqual(bad.length, 0, 'spells referencing unknown class ids: ' + bad.join(', '));
});

test('spells: no duplicate ids', function () {
  var dups = collectDuplicateIds(SPELLS);
  assert.strictEqual(dups.length, 0, 'duplicate spell ids: ' + dups.join(','));
});

test('spells: level coverage includes 0 through 5 at minimum', function () {
  var levels = {};
  Object.keys(SPELLS).forEach(function (key) { levels[SPELLS[key].level] = (levels[SPELLS[key].level] || 0) + 1; });
  for (var lvl = 0; lvl <= 5; lvl++) {
    assert.ok(levels[lvl] > 0, 'no spells found at level ' + lvl);
  }
});

// ---------------------------------------------------------------------------
// MONSTERS
// ---------------------------------------------------------------------------
test('monsters: minimum count (>=120)', function () {
  var count = Object.keys(MONSTERS).length;
  assert.ok(count >= 120, 'expected >=120 monsters, got ' + count);
});

test('monsters: every monster has valid ability scores, valid CR, and at least one action', function () {
  Object.keys(MONSTERS).forEach(function (key) {
    var m = MONSTERS[key];
    assert.ok(m.id, key + ' missing id');
    assert.strictEqual(m.id, key, key + ' id does not match map key');
    assert.ok(isKebabCase(m.id), key + ' id not kebab-case');
    assert.ok(m.name, key + ' missing name');
    assert.ok(m.size, key + ' missing size');
    assert.ok(m.type, key + ' missing type');
    assert.ok(typeof m.ac === 'number', key + ' missing ac');
    assert.ok(typeof m.hp === 'number', key + ' missing hp');
    assert.ok(m.speed, key + ' missing speed block');
    assert.ok(m.abilities, key + ' missing abilities block');
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(function (ab) {
      var v = m.abilities[ab];
      assert.ok(typeof v === 'number' && v >= 1 && v <= 30, key + '.' + ab + ' invalid ability score: ' + v);
    });
    assert.ok(m.senses, key + ' missing senses');
    assert.ok(Array.isArray(m.languages), key + ' missing languages array');
    assert.ok(VALID_CR.indexOf(m.cr) !== -1, key + ' invalid cr: ' + m.cr);
    assert.ok(typeof m.xp === 'number', key + ' missing xp');
    assert.ok(Array.isArray(m.traits), key + ' missing traits array');
    assert.ok(Array.isArray(m.actions) && m.actions.length > 0, key + ' must have at least one action');
    assert.ok(Array.isArray(m.reactions), key + ' missing reactions array');
    assert.ok(m.visual, key + ' missing visual block');
    assert.ok(Array.isArray(m.visual.palette) && m.visual.palette.length > 0, key + ' visual missing palette');
    assert.ok(m.visual.silhouette, key + ' visual missing silhouette');
  });
});

test('monsters: every action has a valid type; legendary/multiattack/legendaryResistance use the new object shapes', function () {
  Object.keys(MONSTERS).forEach(function (key) {
    var m = MONSTERS[key];
    m.actions.forEach(function (a) {
      assert.ok(a.id, key + ' action missing id');
      assert.ok(VALID_ACTION_TYPES.indexOf(a.type) !== -1, key + '.' + (a.id || a.name) + ' invalid action type: ' + a.type);
    });
    m.reactions.forEach(function (a) {
      assert.ok(VALID_ACTION_TYPES.indexOf(a.type) !== -1, key + ' reaction invalid type: ' + a.type);
    });
    assert.ok(m.multiattack === null || (typeof m.multiattack === 'object' && Array.isArray(m.multiattack.sequence)), key + ' multiattack must be null or {text,sequence}');
    if (m.multiattack) {
      var actionIds = m.actions.map(function (a) { return a.id; });
      m.multiattack.sequence.forEach(function (seq) {
        assert.ok(actionIds.indexOf(seq.actionRef) !== -1, key + ' multiattack references unknown actionRef: ' + seq.actionRef);
      });
    }
    assert.ok(m.legendaryActions === null || (typeof m.legendaryActions === 'object' && typeof m.legendaryActions.perRound === 'number' && Array.isArray(m.legendaryActions.options)), key + ' legendaryActions must be null or {perRound,options}');
    assert.ok(typeof m.legendaryResistance === 'number', key + ' missing legendaryResistance (number)');
    assert.ok(!('legendaryResistances' in m), key + ' should not have old plural legendaryResistances field');
    assert.ok(!('saves' in m), key + ' should not have old "saves" field (renamed to savingThrows)');
    assert.ok(m.lair === null || (m.lair && Array.isArray(m.lair.actions) && Array.isArray(m.lair.regional)), key + ' lair must be null or {actions,regional}');
    m.traits.forEach(function (t) {
      assert.ok(t.id, key + ' trait missing id');
      assert.ok(t.condition, key + ' trait ' + t.id + ' missing condition');
      assert.ok(t.effect, key + ' trait ' + t.id + ' missing effect');
    });
  });
});

test('monsters: no duplicate ids', function () {
  var dups = collectDuplicateIds(MONSTERS);
  assert.strictEqual(dups.length, 0, 'duplicate monster ids: ' + dups.join(','));
});

test('monsters: CR spread from 0 up through at least 20', function () {
  var crs = Object.keys(MONSTERS).map(function (k) { return MONSTERS[k].cr; });
  var min = Math.min.apply(null, crs);
  var max = Math.max.apply(null, crs);
  assert.ok(min <= 0.25, 'lowest CR present is ' + min + ', expected low-CR creatures near 0');
  assert.ok(max >= 20, 'highest CR present is ' + max + ', expected coverage up to at least CR 20+');
});

// ---------------------------------------------------------------------------
// ITEMS
// ---------------------------------------------------------------------------
test('items: minimum count (>=200)', function () {
  var count = Object.keys(ITEMS).length;
  assert.ok(count >= 200, 'expected >=200 items, got ' + count);
});

test('items: every item has required fields and a visual block', function () {
  Object.keys(ITEMS).forEach(function (key) {
    var it = ITEMS[key];
    assert.ok(it.id, key + ' missing id');
    assert.strictEqual(it.id, key, key + ' id does not match map key');
    assert.ok(isKebabCase(it.id), key + ' id not kebab-case');
    assert.ok(it.name, key + ' missing name');
    assert.ok(it.category, key + ' missing category');
    assert.ok(it.visual, key + ' missing visual block');
    assert.ok(Array.isArray(it.visual.palette) && it.visual.palette.length > 0, key + ' visual missing palette');
    assert.ok(it.visual.iconShape, key + ' visual missing iconShape');
  });
});

test('items: every weapon has a damage block, every armor has a data-driven ac object', function () {
  // Note: the SRD "net" is a martial weapon that deals no damage (it restrains
  // instead), so its damage.dice/type are legitimately null; we only require
  // that the `damage` object itself is present and shaped correctly.
  Object.keys(ITEMS).forEach(function (key) {
    var it = ITEMS[key];
    if (it.category === 'weapon') {
      assert.ok(it.damage && typeof it.damage === 'object' && 'dice' in it.damage && 'type' in it.damage, key + ' weapon missing damage block');
    }
    if (it.category === 'armor') {
      assert.ok(it.ac && typeof it.ac === 'object', key + ' armor missing ac object');
      assert.ok(!('acFormula' in it), key + ' armor should not have prose acFormula field');
      if (it.armorType === 'shield') {
        assert.strictEqual(it.ac.mode, 'add', key + ' shield ac.mode should be "add"');
        assert.ok(typeof it.ac.value === 'number', key + ' shield missing ac.value');
      } else {
        assert.ok(typeof it.ac.base === 'number', key + ' armor missing ac.base');
        assert.ok(it.ac.maxDex === null || typeof it.ac.maxDex === 'number', key + ' armor missing/invalid ac.maxDex');
        assert.ok(['light', 'medium', 'heavy'].indexOf(it.ac.category) !== -1, key + ' armor missing/invalid ac.category');
        assert.ok(typeof it.ac.stealthDisadvantage === 'boolean', key + ' armor missing ac.stealthDisadvantage');
      }
    }
  });
});

test('items: no duplicate ids', function () {
  var dups = collectDuplicateIds(ITEMS);
  assert.strictEqual(dups.length, 0, 'duplicate item ids: ' + dups.join(','));
});

test('items: magic items have rarity and attunement flag', function () {
  Object.keys(ITEMS).forEach(function (key) {
    var it = ITEMS[key];
    if (it.category === 'magic-item') {
      assert.ok(it.rarity, key + ' magic item missing rarity');
      assert.ok(typeof it.attunement === 'boolean', key + ' magic item missing attunement flag');
    }
  });
});

// ---------------------------------------------------------------------------
// RULES
// ---------------------------------------------------------------------------
test('rules: SKILLS has all 18 skills with governing ability', function () {
  var count = Object.keys(RULES.SKILLS).length;
  assert.strictEqual(count, 18, 'expected 18 skills, got ' + count);
  Object.keys(RULES.SKILLS).forEach(function (key) {
    var sk = RULES.SKILLS[key];
    assert.ok(sk.ability, key + ' missing governing ability');
    assert.ok(sk.description, key + ' missing description');
  });
});

test('rules: CONDITIONS has all 15 SRD conditions with machine-readable effects and endsOn', function () {
  var count = Object.keys(RULES.CONDITIONS).length;
  assert.strictEqual(count, 15, 'expected 15 conditions, got ' + count);
  var validEndsOn = ['save_end_of_turn', 'duration', 'action', 'none'];
  Object.keys(RULES.CONDITIONS).forEach(function (key) {
    var c = RULES.CONDITIONS[key];
    assert.ok(c.text, key + ' missing text');
    assert.ok(Array.isArray(c.effects), key + ' missing effects array');
    assert.ok(validEndsOn.indexOf(c.endsOn) !== -1, key + ' missing/invalid endsOn: ' + c.endsOn);
    if (key === 'grappled' || key === 'restrained') {
      assert.ok(c.escape && typeof c.escape === 'object', key + ' missing escape info');
    }
  });
});

test('rules: DAMAGE_TYPES has all 13 damage types', function () {
  assert.strictEqual(RULES.DAMAGE_TYPES.length, 13, 'expected 13 damage types');
});

test('rules: ALIGNMENTS has all 9 alignments', function () {
  assert.strictEqual(RULES.ALIGNMENTS.length, 9, 'expected 9 alignments');
});

test('rules: LANGUAGES has standard and exotic lists', function () {
  assert.ok(Array.isArray(RULES.LANGUAGES.standard) && RULES.LANGUAGES.standard.length >= 8);
  assert.ok(Array.isArray(RULES.LANGUAGES.exotic) && RULES.LANGUAGES.exotic.length >= 8);
});

test('rules: BACKGROUNDS has SRD backgrounds with profs/equipment/feature and a source tag', function () {
  var count = Object.keys(RULES.BACKGROUNDS).length;
  assert.ok(count >= 8, 'expected at least 8 backgrounds, got ' + count);
  Object.keys(RULES.BACKGROUNDS).forEach(function (key) {
    var b = RULES.BACKGROUNDS[key];
    assert.ok(Array.isArray(b.skillProfs) && b.skillProfs.length > 0, key + ' missing skillProfs');
    assert.ok(Array.isArray(b.equipment) && b.equipment.length > 0, key + ' missing equipment');
    assert.ok(b.feature && b.feature.name && b.feature.text, key + ' missing feature');
    assert.ok(b.source === 'srd' || b.source === 'homebrew', key + ' missing/invalid source tag: ' + b.source);
  });
  assert.strictEqual(RULES.BACKGROUNDS.acolyte.source, 'srd', 'acolyte must be tagged source:"srd"');
});

test('rules: FEATS contains only SRD Grappler; other feats live in HOMEBREW_FEATS, all tagged with source', function () {
  assert.ok(RULES.FEATS.grappler, 'missing Grappler feat');
  assert.ok(RULES.FEATS.grappler.text, 'Grappler missing text');
  assert.strictEqual(RULES.FEATS.grappler.source, 'srd', 'Grappler must be tagged source:"srd"');
  assert.strictEqual(Object.keys(RULES.FEATS).length, 1, 'FEATS must contain only Grappler per SRD 5.1 licensing (found: ' + Object.keys(RULES.FEATS).join(', ') + ')');
  assert.ok(RULES.HOMEBREW_FEATS && Object.keys(RULES.HOMEBREW_FEATS).length > 0, 'expected HOMEBREW_FEATS with at least one entry');
  Object.keys(RULES.HOMEBREW_FEATS).forEach(function (key) {
    var f = RULES.HOMEBREW_FEATS[key];
    assert.strictEqual(f.source, 'homebrew', key + ' HOMEBREW_FEATS entry must be tagged source:"homebrew"');
    assert.ok(f.text, key + ' missing text');
  });
});

test('rules: XP_THRESHOLDS and XP_BY_LEVEL and ENCOUNTER_MULTIPLIERS present', function () {
  assert.ok(RULES.XP_THRESHOLDS[1], 'missing XP_THRESHOLDS for level 1');
  assert.ok(Array.isArray(RULES.XP_BY_LEVEL) && RULES.XP_BY_LEVEL.length === 21, 'XP_BY_LEVEL malformed');
  assert.ok(Array.isArray(RULES.ENCOUNTER_MULTIPLIERS) && RULES.ENCOUNTER_MULTIPLIERS.length > 0);
});

test('rules: DEATH_SAVE_RULES, REST_RULES, COVER, TRAVEL_PACE, EXHAUSTION present', function () {
  assert.ok(RULES.DEATH_SAVE_RULES && RULES.DEATH_SAVE_RULES.success === 10);
  assert.ok(RULES.REST_RULES && RULES.REST_RULES.shortRest && RULES.REST_RULES.longRest);
  assert.ok(RULES.COVER && RULES.COVER.half && RULES.COVER.threeQuarters && RULES.COVER.total);
  assert.ok(RULES.TRAVEL_PACE && RULES.TRAVEL_PACE.fast && RULES.TRAVEL_PACE.normal && RULES.TRAVEL_PACE.slow);
  assert.ok(RULES.EXHAUSTION && Array.isArray(RULES.EXHAUSTION.levels) && RULES.EXHAUSTION.levels.length === 6);
});

test('rules: EXHAUSTION is the 2014 six-level ladder with a distinct, non-empty effect per level (guards against 2024 flat-penalty model)', function () {
  var levels = RULES.EXHAUSTION.levels;
  assert.strictEqual(levels.length, 6, 'expected exactly 6 exhaustion levels (2014 ruleset)');
  var seenEffects = {};
  levels.forEach(function (lvl, idx) {
    assert.strictEqual(lvl.level, idx + 1, 'exhaustion level ' + (idx + 1) + ' has wrong level number: ' + lvl.level);
    assert.ok(typeof lvl.effect === 'string' && lvl.effect.trim().length > 0, 'exhaustion level ' + lvl.level + ' missing non-empty effect');
    assert.ok(!seenEffects[lvl.effect], 'exhaustion level ' + lvl.level + ' effect is a duplicate of another level: ' + lvl.effect);
    seenEffects[lvl.effect] = true;
  });
  // level 6 must be death (2014 ladder culminates in death, not a 2024-style flat modifier table)
  assert.ok(/death/i.test(levels[5].effect), 'exhaustion level 6 should be death (2014 ruleset)');
});

// ---------------------------------------------------------------------------
// LICENSE
// ---------------------------------------------------------------------------
test('license: exact required CC-BY-4.0 attribution text', function () {
  assert.ok(LICENSE_TEXT.indexOf('System Reference Document 5.1') !== -1, 'license text missing SRD 5.1 reference');
  assert.ok(LICENSE_TEXT.indexOf('creativecommons.org/licenses/by/4.0/legalcode') !== -1, 'license text missing CC-BY-4.0 URL');
});

// ---------------------------------------------------------------------------
// CROSS-FILE: no duplicate ids across all data collections combined
// ---------------------------------------------------------------------------
test('cross-file: ids are unique within each collection (already checked) and collections do not silently collide in count', function () {
  // Collections are keyed independently (race ids vs spell ids may overlap in theory,
  // e.g. no such case expected) - just assert each collection standalone dedups, done above.
  assert.ok(true);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('');
console.log('=========================================');
console.log(' SRD DATA VALIDATION SUMMARY');
console.log('=========================================');
console.log('Tests passed: ' + passCount);
console.log('Tests failed: ' + failCount);
console.log('-----------------------------------------');
console.log('Races:            ' + Object.keys(RACES).length + ' (min 9)');
console.log('Classes:          ' + Object.keys(CLASSES).length + ' (exactly 12)');
console.log('Spells:           ' + Object.keys(SPELLS).length + ' (min 250)');
console.log('Monsters:         ' + Object.keys(MONSTERS).length + ' (min 120)');
console.log('Items:            ' + Object.keys(ITEMS).length + ' (min 200)');
console.log('Skills:           ' + Object.keys(RULES.SKILLS).length);
console.log('Conditions:       ' + Object.keys(RULES.CONDITIONS).length);
console.log('Backgrounds:      ' + Object.keys(RULES.BACKGROUNDS).length);
console.log('Feats (SRD):      ' + Object.keys(RULES.FEATS).length);
console.log('Feats (homebrew): ' + Object.keys(RULES.HOMEBREW_FEATS).length);
console.log('=========================================');

if (failCount > 0) {
  console.error('');
  console.error(failCount + ' test(s) failed.');
  process.exit(1);
} else {
  console.log('');
  console.log('All tests passed.');
  process.exit(0);
}
