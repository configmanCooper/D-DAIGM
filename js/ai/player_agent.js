/*
 * player_agent.js — an AI occupying a player's seat.
 *
 * The trust boundary is the whole design. The model is handed an observation
 * (never raw state) and the engine's own list of legal moves, and it replies
 * with an INDEX into that list. It cannot name a move that does not exist,
 * cannot see what its character cannot see, and cannot touch state — because
 * the index is validated and then dispatched through exactly the function a
 * human's click calls.
 *
 * The refusal memory exists because of an observed failure in the sibling
 * project: a model picked the same illegal move five turns running, each time
 * being told no and each time trying again. Remembering a refusal for the rest
 * of the run costs nothing and ends the loop.
 */
(function (global) {
  'use strict';

  var Command = (global.DND && global.DND.Command) ||
    (typeof require !== 'undefined' ? require('../engine/command.js') : null);
  var Dispatch = (global.DND && global.DND.Dispatch) ||
    (typeof require !== 'undefined' ? require('../engine/dispatch.js') : null);
  var Knowledge = (global.DND && global.DND.Knowledge) ||
    (typeof require !== 'undefined' ? require('../engine/knowledge.js') : null);
  var Backend = (global.DND && global.DND.Backend) ||
    (typeof require !== 'undefined' ? require('./backend.js') : null);

  /* Refusals that will never stop being true, as opposed to "not right now".
     Only the permanent kind is worth remembering. */
  var PERMANENT = /already|cannot be|not present|no such|unknown|does not exist|not available|out of range|not perceivable|not carried|not a legal/i;

  function makeMemory() {
    return { refused: {}, log: [], turns: 0 };
  }

  function signature(move) {
    var s = move.step || {};
    return [move.family, s.verb, (s.targetIds || []).join('+'), s.spellId, s.itemId].join('|');
  }

  /** Legal moves minus the ones already refused permanently this run. */
  function usableMoves(moves, memory) {
    if (!memory) return moves;
    return moves.filter(function (m) { return !memory.refused[signature(m)]; });
  }

  /* ------------------------------------------------------------- prompting -- */

  /**
   * Describe the board as this character perceives it.
   *
   * Built from the observation rather than the state, so an AI seat is subject
   * to exactly the same fog as a human player. A model that could see hidden
   * creatures would play better and spoil the game.
   */
  function boardText(observation, opts) {
    opts = opts || {};
    var lines = [];
    var me = observation.actors[observation.observerId];

    lines.push('YOU ARE: ' + ((me && me.name) || observation.observerId));
    if (opts.persona) lines.push('WHO YOU ARE: ' + opts.persona);
    if (opts.goals) lines.push('WHAT YOU WANT: ' + opts.goals);
    lines.push('');

    if (me) {
      lines.push('YOUR CONDITION: ' + me.hp + '/' + me.hpMax + ' hit points' +
        (me.conditions && me.conditions.length ? ', ' + me.conditions.join(', ') : '') + '.');
    }
    if (opts.resources) {
      lines.push('WHAT YOU HAVE LEFT: ' + opts.resources);
    }
    lines.push('');

    lines.push('WHERE YOU ARE: ' + (opts.locationName || observation.locationId || 'somewhere'));
    if (observation.combat && observation.combat.active) {
      lines.push('This is a fight. Round ' + observation.combat.round + '. It is your turn.');
    }
    lines.push('');

    var allies = [], foes = [], others = [];
    Object.keys(observation.actors).forEach(function (id) {
      if (id === observation.observerId) return;
      var a = observation.actors[id];
      var desc = '  ' + a.name + ' (' + id + ')' +
        (a.dead ? ' — dead' : a.hp != null ? ' — ' + a.hp + '/' + a.hpMax + ' hp'
          : a.health ? ' — looks ' + a.health : '') +
        (a.conditions && a.conditions.length ? ' [' + a.conditions.join(', ') + ']' : '');
      if (a.side === 'party' || a.side === 'ally') allies.push(desc);
      else if (a.side === 'enemy') foes.push(desc);
      else others.push(desc);
    });
    if (allies.length) { lines.push('WITH YOU:'); lines = lines.concat(allies); }
    if (foes.length) { lines.push('AGAINST YOU:'); lines = lines.concat(foes); }
    if (others.length) { lines.push('ALSO HERE:'); lines = lines.concat(others); }
    lines.push('');

    var facts = Object.keys(observation.facts || {});
    if (facts.length) {
      lines.push('WHAT YOU KNOW:');
      facts.forEach(function (f) { lines.push('  - ' + observation.facts[f].text); });
      lines.push('');
    }

    var quests = Object.keys(observation.quests || {}).filter(function (q) {
      return observation.quests[q].status === 'open';
    });
    if (quests.length) {
      lines.push('WHAT YOU ARE TRYING TO DO: ' + quests.join(', '));
      lines.push('');
    }
    return lines.join('\n');
  }

  function movesText(moves) {
    return moves.map(function (m, i) {
      var line = '  [' + i + '] ' + (m.what || Command.describeStep(m.step));
      if (m.cost) line += '   (costs: ' + m.cost + ')';
      if (m.warn) line += '   (careful: ' + m.warn + ')';
      return line;
    }).join('\n');
  }

  function buildPrompt(observation, moves, memory, opts) {
    opts = opts || {};
    var lines = [];
    lines.push('You are playing one character in a Dungeons & Dragons game. Play them honestly:');
    lines.push('pursue what they want, respect what they believe, and accept risk when it is in');
    lines.push('character. You are not trying to win — you are trying to be this person.');
    lines.push('');
    lines.push(boardText(observation, opts));

    if (memory && memory.log.length) {
      lines.push('WHAT YOU HAVE DONE SO FAR, AND WHAT CAME OF IT:');
      memory.log.slice(-20).forEach(function (l) { lines.push('  - ' + l); });
      lines.push('');
    }

    if (opts.recentNarration && opts.recentNarration.length) {
      lines.push('WHAT JUST HAPPENED:');
      opts.recentNarration.slice(-3).forEach(function (n) { lines.push('  ' + n); });
      lines.push('');
    }

    if (opts.steer) {
      lines.push('THE PERSON WATCHING ASKS: ' + opts.steer);
      lines.push('');
    }

    lines.push('YOUR OPTIONS RIGHT NOW — you may only choose one of these:');
    lines.push(movesText(moves));
    lines.push('');
    lines.push('You may also SAY something in character, whether or not you act.');
    lines.push('');
    lines.push('Reply with JSON only, in exactly this shape:');
    lines.push('{"move": <index from the list above>, "say": "<what you say aloud, or empty>", ' +
      '"thinking": "<one sentence on why>"}');
    return lines.join('\n');
  }

  /* --------------------------------------------------------------- choosing -- */

  var CHOICE_SCHEMA = {
    type: 'object',
    properties: {
      move: { type: 'integer', minimum: 0 },
      say: { type: 'string' },
      thinking: { type: 'string' },
    },
    required: ['move'],
  };

  /**
   * Ask the model for a move. Falls back to a deterministic policy rather than
   * stalling the turn — an AI seat that cannot decide must still act, or an
   * unattended playtest deadlocks.
   */
  function chooseMove(state, store, actorId, opts) {
    opts = opts || {};
    var memory = opts.memory || makeMemory();
    var observation = Knowledge.getObservation(state, store, actorId, {});
    var all = Dispatch.legalMoves(state, actorId, opts.ctx);
    var moves = usableMoves(all, memory);

    if (!moves.length) {
      return Promise.resolve({ move: null, reason: 'no legal moves', observation: observation, moves: all });
    }

    var prompt = buildPrompt(observation, moves, memory, opts);

    function fallback(why) {
      var idx = defaultPolicy(observation, moves);
      return {
        move: moves[idx], index: idx, moves: moves, observation: observation,
        say: '', thinking: 'fell back to the default policy (' + why + ')',
        method: 'policy',
      };
    }

    if (!Backend.available() || opts.forcePolicy) {
      return Promise.resolve(fallback(opts.forcePolicy ? 'policy-driven' : 'no backend'));
    }

    /* Copilot seats go through the dedicated agent route, which is not on the
       narration path and can afford a long think. */
    var call = opts.viaAgentRoute && typeof fetch !== 'undefined'
      ? fetch('/api/agent/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: opts.model, prompt: prompt }),
        signal: opts.signal,
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.choice) throw new Error(j && j.error ? j.error : 'no choice returned');
        return j.choice;
      })
      : Backend.chat({
        profile: 'agent',
        messages: [{ role: 'user', content: prompt }],
        format: CHOICE_SCHEMA,
        signal: opts.signal,
      }).then(function (res) {
        var parsed = safeJson(res.text);
        if (!parsed) throw new Error('unparsable choice');
        return parsed;
      });

    return call.then(function (choice) {
      var idx = typeof choice.move === 'number' ? choice.move : parseInt(choice.move, 10);
      if (!isFinite(idx) || idx < 0 || idx >= moves.length) {
        /* A model that picks an index off the end has misread the list, not
           chosen something clever. Take the policy move rather than the risk. */
        return fallback('index ' + choice.move + ' out of range');
      }
      return {
        move: moves[idx], index: idx, moves: moves, observation: observation,
        say: String(choice.say || '').slice(0, 400),
        thinking: String(choice.thinking || '').slice(0, 400),
        method: 'model',
      };
    }).catch(function (e) {
      return fallback(String((e && e.message) || e));
    });
  }

  /**
   * What a sensible character does when nobody is telling them what to do.
   *
   * Deliberately simple and deliberately not optimal: this is a safety net so
   * an unattended run keeps moving, not an attempt at tactical AI. But it does
   * have to read the room — an early version picked the first move on the list
   * and so spent an entire investigation scene taking the Dodge action in an
   * empty room, because combat registers its resolvers first.
   */
  /** Does this move look like a heal rather than an attack spell? */
  function isHealingMove(m) {
    return /\b(cure|heal|healing|mend|restor)/i.test((m && m.what) || '');
  }

  /**
   * Should this creature spend a spell rather than swing?
   *
   * Yes if it has one and the swing is feeble — which is the case for every
   * full caster, whose weapon is a stick. Deliberately conservative: a
   * character with a real weapon and one spell left should keep the spell.
   */
  function shouldCast(observation, moves) {
    var self = observation.actors && observation.actors[observation.viewerId];
    var casts = moves.filter(function (m) {
      return m.step && m.step.verb === 'cast' && !isHealingMove(m);
    }).length;
    if (!casts) return false;
    var swings = moves.filter(function (m) {
      return m.step && (m.step.verb === 'attack' || m.step.verb === 'multiattack');
    }).length;
    if (!swings) return true;
    /* A caster with several spells available is a caster; let them cast. */
    return casts >= 2 || !(self && self.role && /fighter|barbarian|rogue|monk|ranger|paladin/i.test(self.role));
  }

  function defaultPolicy(observation, moves) {
    var i;
    function firstWhere(pred) {
      for (var j = 0; j < moves.length; j++) {
        var s = moves[j].step || {};
        if (pred(s, moves[j])) return j;
      }
      return -1;
    }

    var livingEnemies = Object.keys(observation.actors).filter(function (id) {
      var a = observation.actors[id];
      return a.side === 'enemy' && !a.dead;
    });
    var fighting = (observation.combat && observation.combat.active) || livingEnemies.length > 0;

    /* Someone is dying. Nothing else matters. */
    var dyingAlly = Object.keys(observation.actors).filter(function (id) {
      var a = observation.actors[id];
      return (a.side === 'party' || a.side === 'ally') && !a.dead && a.hp != null && a.hp <= 0;
    })[0];
    if (dyingAlly) {
      i = firstWhere(function (s) {
        return (s.verb === 'use' || s.verb === 'drink' || s.verb === 'cast') &&
          (s.targetIds || []).indexOf(dyingAlly) >= 0;
      });
      if (i >= 0) return i;
    }

    if (fighting) {
      var weakest = null, weakestHp = Infinity;
      livingEnemies.forEach(function (id) {
        var a = observation.actors[id];
        var hp = a.hp != null ? a.hp
          : ({ 'badly wounded': 1, wounded: 2, bloodied: 3, unhurt: 4 }[a.health] || 4);
        if (hp < weakestHp) { weakest = id; weakestHp = hp; }
      });

      /* A caster should cast.
         The policy went straight to `attack`, so a wizard companion spent
         every fight poking with a quarterstaff while holding Magic Missile,
         and a cleric never once healed anybody who was merely wounded. Across
         a four-hundred-turn run this produced exactly one spell cast and not a
         single spell slot spent — the whole of the magic system, unexercised
         and unplayed.

         A real spell against a healthy enemy, a cantrip against a nearly-dead
         one. Taking the first `cast` in the list always took a cantrip, since
         cantrips are listed first, so slots were never spent either. */
      /* A real spell against a healthy enemy, a cantrip to finish one off.
         Enemy hit points are BANDED by the perception layer, not exact — an
         unhurt orc reports as "unhurt", which mapped to the number 4 and made
         every fight look nearly over, so the caster always chose the cantrip
         and no slot was ever spent. Read the band. */
      var toughestBand = 'badly wounded';
      var BANDS = ['badly wounded', 'wounded', 'bloodied', 'unhurt'];
      livingEnemies.forEach(function (id) {
        var a = observation.actors[id];
        var band = a.health || (a.hp != null && a.hpMax
          ? (a.hp > a.hpMax * 0.75 ? 'unhurt' : a.hp > a.hpMax * 0.5 ? 'bloodied'
            : a.hp > a.hpMax * 0.25 ? 'wounded' : 'badly wounded')
          : 'unhurt');
        if (BANDS.indexOf(band) > BANDS.indexOf(toughestBand)) toughestBand = band;
      });
      var seriousFight = livingEnemies.length > 1 ||
        toughestBand === 'unhurt' || toughestBand === 'bloodied';

      if (seriousFight) {
        /* Area spells really do catch everyone standing in the blast now, so a
           companion has to look before it throws. Prefer a clean shot; only
           accept one that catches an ally if there is no other offensive spell
           at all — and never accept it when the ally is already hurt. A
           wizard that fireballs its own front line is worse than a wizard that
           swings a quarterstaff. */
        i = firstWhere(function (s, m) {
          return s.verb === 'cast' && m.offensive && !m.cantrip && !isHealingMove(m) &&
            !m.friendlyFire;
        });
        if (i >= 0 && shouldCast(observation, moves)) return i;
      }
      i = firstWhere(function (s, m) {
        return s.verb === 'cast' && m.offensive && !isHealingMove(m) && !m.friendlyFire;
      });
      if (i >= 0 && shouldCast(observation, moves)) return i;

      /* A badly hurt ally is worth a heal even if nobody is at zero yet. */
      var hurtAlly = Object.keys(observation.actors).filter(function (id) {
        var a = observation.actors[id];
        return (a.side === 'party' || a.side === 'ally') && !a.dead &&
          a.hp != null && a.hpMax && a.hp > 0 && a.hp < a.hpMax * 0.4;
      })[0];
      if (hurtAlly) {
        i = firstWhere(function (s, m) {
          return isHealingMove(m) && (s.targetIds || []).indexOf(hurtAlly) >= 0;
        });
        if (i >= 0) return i;
      }

      if (weakest) {
        i = firstWhere(function (s) { return s.verb === 'multiattack' && (s.targetIds || []).indexOf(weakest) >= 0; });
        if (i >= 0) return i;
        i = firstWhere(function (s) { return s.verb === 'attack' && (s.targetIds || []).indexOf(weakest) >= 0; });
        if (i >= 0) return i;
        i = firstWhere(function (s) { return s.verb === 'attack'; });
        if (i >= 0) return i;
        /* Nothing to swing with — a caster out of slots still has cantrips. */
        i = firstWhere(function (s) { return s.verb === 'cast'; });
        if (i >= 0) return i;
        /* Nothing in reach: close the distance. Once weapon reach was enforced
           this became necessary — before it, everyone could hit everyone from
           anywhere, so nobody ever had to walk. A boss fight where the sides
           began apart simply never started: both lines stood still until the
           turn loop ran out of steps. */
        i = firstWhere(function (s) {
          return s.verb === 'move' && (s.path || []).length > 1;
        });
        if (i >= 0) return i;
      }
    } else {
      /* Out of combat, do something that could plausibly advance a scene.
         Ordered by how much a stalled run benefits from it. */
      var peaceful = ['ask', 'search', 'perceive', 'investigate', 'insight', 'persuade', 'travel'];
      for (var p = 0; p < peaceful.length; p++) {
        var verb = peaceful[p];
        i = firstWhere(function (s) { return s.verb === verb; });
        if (i >= 0) return i;
      }
    }

    /* Anything at all rather than nothing — but never a pass, or a stuck agent
       would sit out the entire run. */
    i = firstWhere(function (s) {
      return s.verb !== 'end_turn' && s.verb !== 'pass' &&
        !(!fighting && (s.verb === 'dodge' || s.verb === 'disengage' || s.verb === 'dash'));
    });
    if (i >= 0) return i;
    i = firstWhere(function (s) { return s.verb !== 'end_turn' && s.verb !== 'pass'; });
    return i >= 0 ? i : 0;
  }

  /**
   * Choose and then act. Records refusals so a dead move is never offered
   * twice, and never throws out of the turn loop — a failed AI turn must
   * degrade to a pass, not end the session.
   */
  function takeTurn(state, history, store, actorId, opts) {
    opts = opts || {};
    var memory = opts.memory || makeMemory();
    memory.turns++;

    return chooseMove(state, store, actorId, opts).then(function (chosen) {
      if (!chosen.move) {
        memory.log.push('had nothing legal to do');
        return { ok: false, reason: chosen.reason, chosen: chosen };
      }

      var command = Dispatch.commandFromMove(state, actorId, chosen.move, {
        source: 'playerAI',
        utterance: chosen.say || '',
      });

      var result = Dispatch.dispatch(state, history, command, opts.ctx);

      if (!result.ok) {
        var detail = (result.errors || [result.detail || result.reason || '']).join('; ');
        if (PERMANENT.test(detail)) {
          memory.refused[signature(chosen.move)] = detail;
        }
        memory.log.push('tried to ' + (chosen.move.what || '') + ' but could not: ' + detail);
        return { ok: false, reason: detail, chosen: chosen, command: command, result: result };
      }

      var beats = (result.beats || []).join(' ');
      memory.log.push((chosen.move.what || Command.describeStep(chosen.move.step)) +
        (beats ? ' — ' + beats : ''));

      return {
        ok: true, chosen: chosen, command: command, result: result,
        batch: result.batch, say: chosen.say, thinking: chosen.thinking,
      };
    }).catch(function (e) {
      /* Whatever went wrong, the turn must end rather than hang. */
      memory.log.push('turn failed: ' + String((e && e.message) || e));
      return { ok: false, reason: String((e && e.message) || e) };
    });
  }

  function safeJson(text) {
    var raw = String(text || '').trim();
    var fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) raw = fence[1].trim();
    try { return JSON.parse(raw); } catch (e) { /* fall through */ }
    var brace = raw.match(/\{[\s\S]*\}/);
    if (!brace) return null;
    try { return JSON.parse(brace[0]); } catch (e) { /* fall through */ }
    try {
      return JSON.parse(brace[0].replace(/,\s*([}\]])/g, '$1')
        .replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'"));
    } catch (e) { return null; }
  }

  var api = {
    makeMemory: makeMemory,
    signature: signature,
    usableMoves: usableMoves,
    boardText: boardText,
    movesText: movesText,
    buildPrompt: buildPrompt,
    chooseMove: chooseMove,
    defaultPolicy: defaultPolicy,
    takeTurn: takeTurn,
    safeJson: safeJson,
    CHOICE_SCHEMA: CHOICE_SCHEMA,
    PERMANENT: PERMANENT,
  };

  global.DND = global.DND || {};
  global.DND.PlayerAgent = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
