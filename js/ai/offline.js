/*
 * offline.js — the Dungeon Master that needs no model at all.
 *
 * This is not a stub. It is load-bearing three times over: it is what narrates
 * when Ollama is missing, what narrates when a model times out or trips a
 * gate mid-combat, and what the test suite uses to get deterministic prose out
 * of the whole pipeline. The claim "the game is fully playable with no AI"
 * lives or dies here.
 *
 * It is honest about what it is. It composes from the engine's own facts, so
 * it is never wrong — only plainer than a model would be. Variety comes from
 * the seeded RNG, so the same seed narrates the same way twice, which is
 * exactly what a replayable test needs.
 */
(function (global) {
  'use strict';

  var RNG = (global.DND && global.DND.RNG) ||
    (typeof require !== 'undefined' ? require('../rng.js').RNG : null);

  /* Phrasings are grouped by what actually happened rather than by mood, so a
     selection is always factually safe whichever one is drawn. */
  var HIT = [
    '{a} lands the blow. {d}.',
    '{a} gets through {t}\u2019s guard \u2014 {d}.',
    'The strike tells. {d}.',
    '{a} finds the opening. {d}.',
  ];
  var MISS = [
    '{a} swings and finds nothing but air.',
    '{t} turns the blow aside.',
    '{a} is a hand\u2019s width short.',
    'The blow goes wide.',
  ];
  var CRIT = [
    '{a} does not merely hit \u2014 {d}.',
    'Everything lines up at once. {d}.',
    'It is a clean, terrible strike. {d}.',
  ];
  var SUCCESS = [
    'It works.',
    'That does it.',
    'It comes good.',
  ];
  var FAILURE = [
    'It does not work.',
    'Nothing gives.',
    'That gets nowhere.',
  ];
  var DEATH = [
    '{t} goes down and does not get up.',
    '{t} folds, and stays folded.',
    'That is the end of {t}.',
  ];
  var DOWN = [
    '{t} drops, still breathing \u2014 barely.',
    '{t} goes down hard.',
  ];
  var QUIET = [
    'Nothing moves that was not already moving.',
    'The moment holds.',
    'For a breath, nothing happens at all.',
  ];

  /**
   * A prose-only random stream.
   *
   * Forked from the session seed plus the batch identity, so the same turn is
   * always described the same way, a retry with a different attempt number
   * varies the wording, and none of it advances the dice.
   */
  function proseRng(state, batch, attempt) {
    var seed = 'prose:' + ((state && state.seed) || 'x') + ':' +
      ((batch && batch.commandId) || (batch && batch.at) || 'none') + ':' + (attempt || 0);
    return new RNG(seed);
  }

  function pick(rng, list) {
    return list[(rng ? rng.int(0, list.length - 1) : 0)];
  }

  function fill(template, vars) {
    return String(template).replace(/\{(\w)\}/g, function (m, k) {
      return vars[k] == null ? '' : String(vars[k]);
    });
  }

  function nameOf(state, id) {
    var a = state && state.actors && state.actors[id];
    return (a && a.name) || id || 'someone';
  }

  /**
   * Narrate a committed batch from its events.
   *
   * Reads the events rather than the beats where it can, because the events
   * carry the numbers and the beats are already prose. Falls back to the beats
   * for anything it has no phrasing for, which means a new event kind degrades
   * to plain description rather than to silence.
   */
  function narrate(state, batch, opts) {
    opts = opts || {};
    /* Prose must never touch the mechanical RNG.
       This used to fall back to `state.rng`, so choosing the offline narrator —
       or merely clicking "retry narration" — advanced the dice and changed
       every roll that followed. The whole promise of retrying the words is
       that the numbers do not move, so wording draws from its own stream,
       derived from the batch so it stays reproducible. */
    var rng = opts.rng || proseRng(state, batch, opts.attempt);
    if (!batch) return pick(rng, QUIET);

    if (batch.refused) {
      return 'That cannot happen: ' + batch.refused.detail;
    }

    var actorName = nameOf(state, batch.actorId);
    var out = [];
    var events = batch.events || [];
    var handled = 0;

    events.forEach(function (e) {
      switch (e.kind) {
        case 'roll': {
          if (e.rollKind === 'attack') {
            handled++;
            var target = nameOf(state, e.targetId);
            if (e.isCrit) out.push(fill(pick(rng, CRIT), { a: actorName, t: target, d: damageClause(events, e.targetId) }));
            else if (e.hit) out.push(fill(pick(rng, HIT), { a: actorName, t: target, d: damageClause(events, e.targetId) }));
            else out.push(fill(pick(rng, MISS), { a: actorName, t: target }));
          } else if (e.rollKind === 'check' || e.rollKind === 'save') {
            handled++;
            out.push(e.success ? pick(rng, SUCCESS) : pick(rng, FAILURE));
          }
          break;
        }
        case 'death':
          handled++;
          out.push(fill(pick(rng, DEATH), { t: nameOf(state, e.actorId) }));
          break;
        case 'condition_add':
          if (e.condition === 'unconscious') {
            handled++;
            out.push(fill(pick(rng, DOWN), { t: nameOf(state, e.targetId) }));
          } else if (e.condition) {
            handled++;
            out.push(nameOf(state, e.targetId) + ' is ' + e.condition + '.');
          }
          break;
        case 'item_gain':
          handled++;
          out.push(actorName + ' takes ' + ((e.item && (e.item.name || e.item.id)) || 'it') + '.');
          break;
        case 'gold':
          handled++;
          out.push(e.delta >= 0
            ? actorName + ' is ' + e.delta + ' gold richer.'
            : actorName + ' parts with ' + Math.abs(e.delta) + ' gold.');
          break;
        case 'knowledge':
          handled++;
          out.push('Something becomes clearer.');
          break;
        case 'quest':
          handled++;
          if (e.status === 'done') out.push('That is settled.');
          break;
        default:
          break;
      }
    });

    /* Anything with no phrasing falls through to the engine's own beats, which
       are always accurate even when they are dry. */
    if (!handled) {
      var beats = (batch.beats || []).filter(Boolean);
      if (beats.length) return beats.join(' ');
      return pick(rng, QUIET);
    }

    /* Two sentences of mechanical description is enough; more reads like a
       receipt. The rest stays in the log where a player can look it up. */
    return out.slice(0, 3).join(' ');
  }

  function damageClause(events, targetId) {
    var total = 0, type = null;
    events.forEach(function (e) {
      if (e.kind === 'hp' && e.targetId === targetId && e.delta < 0) {
        total += -e.delta;
        if (e.damageType && !type) type = e.damageType;
      }
    });
    if (!total) return 'the blow tells';
    return total + (type ? ' ' + type : '') + ' damage';
  }

  /** A line for an NPC, composed from their voice card rather than invented. */
  function speak(speaker, opts) {
    opts = opts || {};
    var rng = opts.rng || new RNG('voice:' + String(speaker && speaker.name) + ':' + (opts.seed || ''));
    if (speaker && speaker.lines && speaker.lines.length) {
      return pick(rng, speaker.lines);
    }
    var fallbacks = [
      'Say that again.',
      'Aye.',
      'I have nothing for you.',
      'Not here.',
      'Go on, then.',
    ];
    return pick(rng, fallbacks);
  }

  /**
   * A scene description with no model. Deliberately terse: it establishes
   * where you are and what you can act on, which is the minimum a player needs
   * to make a decision.
   */
  function describeScene(state, observation, opts) {
    opts = opts || {};
    var rng = opts.rng || new RNG('scene:' + ((state && state.seed) || 'x') + ':' + ((state && state.locationId) || ''));
    var parts = [];
    if (opts.locationName) parts.push('You are at ' + opts.locationName + '.');
    if (opts.timeOfDay || opts.weather) {
      parts.push([opts.timeOfDay, opts.weather].filter(Boolean).join(', ') + '.');
    }
    var others = Object.keys(observation.actors || {}).filter(function (id) {
      return id !== observation.observerId && !observation.actors[id].dead;
    });
    if (others.length) {
      var enemies = others.filter(function (id) { return observation.actors[id].side === 'enemy'; });
      var allies = others.filter(function (id) { return observation.actors[id].side !== 'enemy'; });
      if (allies.length) parts.push('With you: ' + allies.map(function (id) { return observation.actors[id].name; }).join(', ') + '.');
      if (enemies.length) parts.push('Facing you: ' + enemies.map(function (id) {
        var a = observation.actors[id];
        return a.name + (a.health && a.health !== 'unhurt' ? ' (' + a.health + ')' : '');
      }).join(', ') + '.');
    }
    if (!parts.length) parts.push(pick(rng, QUIET));
    return parts.join(' ');
  }

  var api = {
    narrate: narrate,
    proseRng: proseRng,
    speak: speak,
    describeScene: describeScene,
    damageClause: damageClause,
    _tables: { HIT: HIT, MISS: MISS, CRIT: CRIT, SUCCESS: SUCCESS, FAILURE: FAILURE, DEATH: DEATH, DOWN: DOWN, QUIET: QUIET },
  };

  global.DND = global.DND || {};
  global.DND.Offline = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
