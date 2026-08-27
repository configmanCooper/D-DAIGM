/*
 * companions.js — the other three people at the table.
 *
 * A one-player game used to start with one character standing alone in a room
 * with a stranger and something that wanted to eat them. That is not a party,
 * and D&D played alone is a different and much harsher game than the one the
 * rules are balanced for: no one to heal you, no one to open the lock, no one
 * to talk to.
 *
 * A table has four. However many people are actually here, the party adds up
 * to four: one player and three companions the Dungeon Master runs, two and
 * two, three and one, or four and none. That is the whole rule.
 *
 * The three are not random. They are chosen to cover what the seated players
 * cannot — a party of four wizards is a funny idea for exactly one session —
 * and matched to the level of the people they are travelling with, because a
 * level-1 companion in a level-5 party is a casualty waiting for a turn.
 */
(function (global) {
  'use strict';

  function req(p) { return typeof require !== 'undefined' ? require(p) : null; }
  var RNG = (global.DND && global.DND.RNG) || (req('../rng.js') || {}).RNG;
  var State = (global.DND && global.DND.State) || req('../engine/state.js');

  /* Resolved when used, not when loaded. In the page, chargen.js comes AFTER
     worldgen.js in the script order, so taking the reference at load time
     bound `undefined` and every companion silently failed to be created —
     leaving the one-player game with the party of one this file exists to
     prevent. */
  function chargen() {
    return (global.DND && global.DND.Chargen) || req('./chargen.js');
  }
  function character() {
    return (global.DND && global.DND.Character) || req('../engine/character.js');
  }

  var PARTY_SIZE = 4;

  /* What each class brings, so the gaps can be seen rather than guessed at.
     Deliberately coarse: this is about not fielding four of the same person,
     not about optimising a build. */
  var ROLES = {
    barbarian: ['front'], fighter: ['front'], paladin: ['front', 'heal'],
    monk: ['front', 'skirmish'], ranger: ['skirmish', 'wilds'],
    rogue: ['skirmish', 'locks', 'scout'],
    cleric: ['heal', 'faith'], druid: ['heal', 'wilds', 'magic'],
    bard: ['heal', 'talk', 'magic'], sorcerer: ['magic'], warlock: ['magic', 'talk'],
    wizard: ['magic', 'lore'],
  };

  /* The order a Dungeon Master fills gaps in. Somebody to stand in front and
     somebody to put you back together come before somebody who reads
     Draconic. */
  var PRIORITY = ['front', 'heal', 'magic', 'skirmish', 'locks', 'talk', 'lore', 'wilds', 'scout'];

  function rolesOf(classId) { return ROLES[classId] || []; }

  /** Which classes would best cover what this party has not got? */
  function gapsFor(classIds) {
    var have = {};
    (classIds || []).forEach(function (c) {
      rolesOf(c).forEach(function (r) { have[r] = (have[r] || 0) + 1; });
    });
    return PRIORITY.filter(function (r) { return !have[r]; });
  }

  /**
   * Pick the class that best fills the party's biggest gap.
   *
   * Weighted rather than decided, so two runs of the same party do not always
   * produce the same three companions and the occasional second fighter is
   * still possible. `must` narrows the field to classes that cover a
   * particular role, for the two roles a party cannot really do without.
   */
  function pickClass(rng, classIds, must) {
    var gaps = gapsFor(classIds);
    var candidates = Object.keys(ROLES);
    if (must) {
      var able = candidates.filter(function (c) { return rolesOf(c).indexOf(must) >= 0; });
      if (able.length) candidates = able;
    }
    var weights = candidates.map(function (c) {
      var mine = rolesOf(c);
      var w = 1;
      gaps.forEach(function (gap, i) {
        if (mine.indexOf(gap) >= 0) w += (gaps.length - i) * 2;
      });
      /* Discourage, without forbidding, a duplicate. */
      if ((classIds || []).indexOf(c) >= 0) w = Math.max(1, Math.round(w / 4));
      return w;
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var roll = (rng && rng.next ? rng.next() : Math.random()) * total;
    for (var i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  /* The two a four-person party genuinely cannot do without: somebody who can
     stand in the front rank, and somebody who can put the others back
     together. Weighting alone left one or the other missing in about one
     party in ten — a lone wizard given three companions who could all read
     Draconic and none of whom could hold a door. */
  var ESSENTIAL = ['front', 'heal'];

  /** Does this name collide with one already at the table, in whole or in first name? */
  function nameClashes(name, taken) {
    if (!name) return true;
    var full = String(name).trim().toLowerCase();
    if (taken[full]) return true;
    return !!taken[full.split(/\s+/)[0]];
  }

  /**
   * Fill the party up to four.
   *
   * Returns the ids of everyone added. Adding nobody — because four people
   * are already seated — is a perfectly good outcome and not a failure.
   */
  function fillParty(state, opts) {
    opts = opts || {};
    var size = opts.size || PARTY_SIZE;
    var rng = opts.rng || (state.rng && state.rng.fork ? state.rng.fork('companions') : new RNG('companions'));

    var existing = State.partyIds(state);
    var need = Math.max(0, size - existing.length);
    var Chargen = chargen(), Character = character();
    if (!need || !Chargen || !Character) return [];

    /* Match the people already here. A companion two levels adrift is either
       a liability or the whole answer to every problem. */
    var levels = existing.map(function (id) {
      var a = state.actors[id];
      return ((a.progression && a.progression.levels) || []).length || 1;
    });
    var level = levels.length
      ? Math.max(1, Math.round(levels.reduce(function (a, b) { return a + b; }, 0) / levels.length))
      : 1;

    var classIds = existing.map(function (id) {
      var a = state.actors[id];
      return ((a.base && a.base.classes) || [{}])[0].classId;
    }).filter(Boolean);

    var added = [];
    /* Names already at the table, so no two companions share one. A party
       containing Faelen Duskvale and Faelen Nightbreeze is confusing to read
       and impossible to talk to: "Faelen, get the door" has two answers.
       Generated names collide surprisingly often because the name lists are
       small and drawn from the same race. */
    var taken = {};
    existing.forEach(function (id) {
      var n = (state.actors[id].name || '').trim();
      if (n) {
        taken[n.toLowerCase()] = true;
        taken[n.split(/\s+/)[0].toLowerCase()] = true;
      }
    });

    for (var i = 0; i < need; i++) {
      /* Cover the essentials while there are still slots to cover them with,
         and leave the last one free so the party is not always the same four
         archetypes in the same order. */
      var slotsLeft = need - i;
      var uncovered = ESSENTIAL.filter(function (role) {
        return gapsFor(classIds).indexOf(role) >= 0;
      });
      var must = uncovered.length >= slotsLeft ? uncovered[0] : null;

      var classId = pickClass(rng, classIds, must);
      var spec, built;
      /* Try a few times for a name nobody at the table already answers to. */
      var attempt = 0;
      do {
        try {
          spec = Chargen.generate({
            rng: rng.fork ? rng.fork('c' + i + '-' + attempt) : rng,
            fixed: { classId: classId, levels: level },
          });
        } catch (e) { spec = null; }
        attempt++;
      } while (spec && attempt < 8 && nameClashes(spec.name, taken));
      if (!spec) continue;
      try { built = Character.buildFromSpec(spec); } catch (e) { continue; }

      /* Eight tries and still a clash: keep the person, drop the surname
         collision by using the family name alone rather than shipping two
         Faelens. */
      var name = spec.name;
      if (nameClashes(name, taken)) {
        var parts = String(name).trim().split(/\s+/);
        name = parts.length > 1 ? parts.slice(1).join(' ') : name + ' the ' + classId;
      }
      taken[String(name).toLowerCase()] = true;
      taken[String(name).trim().split(/\s+/)[0].toLowerCase()] = true;

      var id = 'companion-' + (i + 1) + '-' + classId;
      State.addActor(state, {
        id: id,
        name: name,
        side: 'party',
        kind: 'npc',
        /* Run by the Dungeon Master, like every other companion. */
        persona: name + ' travels with the party.',
        base: built.base,
        progression: built.progression,
        runtime: built.runtime,
        backstory: spec.backstory || null,
      });
      State.setController(state, id, { kind: 'companionPolicy', seatId: null, agent: null });
      classIds.push(classId);
      added.push(id);
    }

    State.refreshAllDerived(state);
    return added;
  }

  /** A short line about each companion, for the Dungeon Master's opening. */
  function describe(state, ids) {
    return (ids || []).map(function (id) {
      var a = state.actors[id];
      if (!a) return null;
      var d = a.derivedCache || {};
      var cls = ((a.base && a.base.classes) || [{}])[0].classId;
      return {
        id: id, name: a.name, klass: cls,
        race: (a.base && (a.base.subraceId || a.base.raceId)) || null,
        level: d.level || 1,
        backstory: a.backstory || null,
      };
    }).filter(Boolean);
  }

  var api = {
    PARTY_SIZE: PARTY_SIZE, ROLES: ROLES,
    fillParty: fillParty, gapsFor: gapsFor, pickClass: pickClass, describe: describe,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  global.DND = global.DND || {};
  global.DND.Companions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
