/*
 * referee.js — free text in, a validated GameCommand out.
 *
 * The referee has exactly one job and is deliberately bad at everything else.
 * It does not narrate, it does not roll, it does not know what a DC is. It
 * reads "I try to get under the thing's guard and shove it into the water" and
 * decides: family `combat`, verb `shove`, target `gateborn`. That is all.
 *
 * Three layers of safety, in decreasing order of preference:
 *   1. constrained decoding, so illegal choices cannot be emitted at all;
 *   2. semantic validation and one repair attempt with the error fed back;
 *   3. a deterministic keyword parser that needs no model whatsoever.
 *
 * Layer 3 is not a formality. It is the offline mode's only parser, it is what
 * runs when a model times out mid-combat, and it is fast enough that the
 * common cases ("attack the goblin") never reach a model at all.
 */
(function (global) {
  'use strict';

  var Command = (global.DND && global.DND.Command) ||
    (typeof require !== 'undefined' ? require('../engine/command.js') : null);
  var Schema = (global.DND && global.DND.Schema) ||
    (typeof require !== 'undefined' ? require('./schema.js') : null);
  var Backend = (global.DND && global.DND.Backend) ||
    (typeof require !== 'undefined' ? require('./backend.js') : null);

  var SYSTEM = [
    'You are the parsing layer of a Dungeons & Dragons engine. You are NOT the Dungeon Master.',
    '',
    'Your only job is to read what a player typed and say which mechanical action they mean.',
    '',
    'You must NOT:',
    '- narrate anything, or describe any outcome',
    '- decide whether the action succeeds',
    '- roll or invent any number',
    '- set a difficulty class',
    '',
    'Choose only from the options given to you. If the player wants something you were not',
    'offered, use the improvised family and describe what they want in plain words.',
    'If two readings are genuinely different actions, set needsClarification and ask which.',
    'Reply with JSON only.',
  ].join('\n');

  /* ------------------------------------------------- deterministic parser -- */

  /* Ordered: the first pattern that matches wins, so specific phrasings are
     listed before general ones ("sneak attack" before "attack"). */
  var PATTERNS = [
    { re: /\b(?:end (?:my )?turn|i'?m done|pass(?: my turn)?)\b/i, family: 'meta', verb: 'end_turn' },
    { re: /\b(?:long rest|make camp|sleep (?:for the night|until morning))\b/i, family: 'exploration', verb: 'long_rest' },
    { re: /\b(?:short rest|catch (?:my|our) breath|rest (?:for )?an hour)\b/i, family: 'exploration', verb: 'short_rest' },

    { re: /\b(?:grapple|grab hold of|wrestle|seize)\b/i, family: 'combat', verb: 'grapple' },
    { re: /\b(?:shove|push|knock (?:it |him |her |them )?(?:back|over|prone)|barge)\b/i, family: 'combat', verb: 'shove' },
    { re: /\b(?:dodge|take the dodge|defend myself|go on the defensive)\b/i, family: 'combat', verb: 'dodge' },
    { re: /\b(?:disengage|back away carefully|withdraw)\b/i, family: 'combat', verb: 'disengage' },
    { re: /\b(?:dash|sprint|run (?:as fast|flat out))\b/i, family: 'combat', verb: 'dash' },
    { re: /\b(?:help|assist|aid)\b/i, family: 'combat', verb: 'help' },
    { re: /\b(?:hide|take cover out of sight|conceal myself)\b/i, family: 'combat', verb: 'hide' },
    { re: /\bready (?:an? )?(?:action|attack|spell)\b/i, family: 'combat', verb: 'ready' },
    { re: /\b(?:attack|strike|swing at|hit|stab|slash|shoot|fire at|loose at|smite)\b/i, family: 'combat', verb: 'attack' },

    { re: /\b(?:cast|invoke|channel|call upon)\b/i, family: 'spell', verb: 'cast' },
    { re: /\bconcentrat/i, family: 'spell', verb: 'cast' },

    { re: /\b(?:drink|quaff|swig)\b/i, family: 'item', verb: 'drink' },
    { re: /\b(?:equip|draw|ready|wield|put on|don)\b/i, family: 'item', verb: 'equip' },
    { re: /\b(?:throw|hurl|lob|fling)\b/i, family: 'item', verb: 'throw' },
    { re: /\b(?:give|hand|pass) (?:the |my )?\w+ to\b/i, family: 'item', verb: 'give' },
    { re: /\b(?:use|apply|activate)\b/i, family: 'item', verb: 'use' },

    { re: /\b(?:persuade|convince|reason with|talk (?:him|her|them) (?:in)?to|plead)\b/i, family: 'social', verb: 'persuade' },
    { re: /\b(?:lie|deceive|bluff|pretend|claim falsely)\b/i, family: 'social', verb: 'deceive' },
    { re: /\b(?:intimidate|threaten|menace|loom over)\b/i, family: 'social', verb: 'intimidate' },
    { re: /\b(?:read (?:his|her|their) face|sense motive|gauge|size (?:him|her|them) up)\b/i, family: 'social', verb: 'insight' },
    { re: /\b(?:ask|enquire|inquire|question)\b/i, family: 'social', verb: 'ask' },
    { re: /\b(?:tell|say to|speak to|greet|answer)\b/i, family: 'social', verb: 'tell' },

    { re: /\b(?:search|look (?:around|through)|rummage|check for)\b/i, family: 'exploration', verb: 'search' },
    { re: /\b(?:investigate|examine|inspect|study|read)\b/i, family: 'exploration', verb: 'investigate' },
    { re: /\b(?:listen|watch|keep an eye|perceive|look at)\b/i, family: 'exploration', verb: 'perceive' },
    { re: /\b(?:pick the lock|unlock|force the (?:door|lock))\b/i, family: 'exploration', verb: 'unlock' },
    { re: /\b(?:disarm|defuse)\b/i, family: 'exploration', verb: 'disarm_trap' },
    { re: /\b(?:travel|set out|head (?:to|for)|journey)\b/i, family: 'exploration', verb: 'travel' },
    { re: /\b(?:track|follow the trail)\b/i, family: 'exploration', verb: 'track' },

    { re: /\b(?:stand(?: up)?|get up|rise)\b/i, family: 'movement', verb: 'stand_up' },
    { re: /\b(?:climb|scale)\b/i, family: 'movement', verb: 'climb' },
    { re: /\b(?:swim|wade)\b/i, family: 'movement', verb: 'swim' },
    { re: /\b(?:jump|leap|vault)\b/i, family: 'movement', verb: 'jump' },
    { re: /\b(?:move|walk|step|go|advance|approach|retreat|cross)\b/i, family: 'movement', verb: 'move' },
  ];

  /** Find which perceivable entity the text is talking about. */
  function matchTarget(text, observation, options) {
    var hay = String(text || '').toLowerCase();
    var best = null, bestLen = 0;
    (options.targetIds || []).forEach(function (id) {
      var a = observation.actors[id];
      if (!a) return;
      var candidates = [a.name, id].concat(a.aliases || []);
      candidates.forEach(function (c) {
        if (!c) return;
        var needle = String(c).toLowerCase();
        if (needle.length > 2 && hay.indexOf(needle) >= 0 && needle.length > bestLen) {
          best = id; bestLen = needle.length;
        }
        /* A surname or first name alone is how people actually refer to each
           other — "ask Aldren" should find Sir Aldren Vey. */
        String(c).toLowerCase().split(/\s+/).forEach(function (word) {
          if (word.length > 3 && hay.indexOf(word) >= 0 && word.length > bestLen) {
            best = id; bestLen = word.length;
          }
        });
      });
    });
    /* "it", "him", "them" mean the only enemy in the room, if there is one. */
    if (!best && /\b(?:it|him|her|them|the thing)\b/i.test(hay)) {
      var enemies = (options.enemyIds || []).filter(function (id) {
        return observation.actors[id] && !observation.actors[id].dead;
      });
      if (enemies.length === 1) best = enemies[0];
    }
    return best;
  }

  /**
   * Match an id from a list against loose player wording.
   *
   * A plain substring test fails on the way people actually write: "the potion
   * of healing" does not contain "potion-healing". So an id is matched when
   * every one of its significant words appears somewhere in the text, and the
   * most specific such id wins.
   */
  function matchFromList(text, ids, labelOf) {
    var hay = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ') + ' ';
    var best = null, bestScore = 0;
    (ids || []).forEach(function (id) {
      var label = String(labelOf ? labelOf(id) : id).toLowerCase().replace(/[-_]/g, ' ');
      var words = label.split(/\s+/).filter(function (w) {
        /* "of", "the" and friends carry no identifying information and would
           match everything. */
        return w.length > 2 && ['the', 'and', 'for', 'with', 'was'].indexOf(w) < 0;
      });
      if (!words.length) return;
      var found = words.filter(function (w) { return hay.indexOf(' ' + w) >= 0; });
      if (found.length !== words.length) return;
      /* More words matched means a more specific identification: prefer
         "potion of greater healing" over "potion". */
      var score = words.join('').length;
      if (score > bestScore) { best = id; bestScore = score; }
    });
    return best;
  }

  /**
   * Parse without a model. Always returns something usable — worst case an
   * improvised action carrying the player's own words, which the engine can
   * still adjudicate as an ability check.
   */
  function parseDeterministic(text, observation, options, opts) {
    opts = opts || {};
    var raw = String(text || '').trim();
    var hit = null;
    for (var i = 0; i < PATTERNS.length; i++) {
      if (PATTERNS[i].re.test(raw)) { hit = PATTERNS[i]; break; }
    }

    var family = hit ? hit.family : 'improvised';
    var verb = hit ? hit.verb : 'improvise';
    var step = Command.makeStep({ verb: verb });

    var target = matchTarget(raw, observation, options);
    if (target) step.targetIds = [target];

    if (family === 'spell') {
      step.spellId = matchFromList(raw, options.spellIds, opts.spellLabel);
      /* A cast with no identifiable spell is not a cast. Better to treat it as
         an improvised attempt than to guess which spell they meant. */
      if (!step.spellId) { family = 'improvised'; verb = 'improvise'; step = Command.makeStep({ verb: 'improvise' }); }
    }
    if (family === 'item') {
      step.itemId = matchFromList(raw, options.itemIds, opts.itemLabel);
      if (!step.itemId) { family = 'improvised'; verb = 'improvise'; step = Command.makeStep({ verb: 'improvise' }); }
    }
    if (family === 'combat' && verb === 'attack' && !target) {
      /* An attack with nobody to attack is a genuine ambiguity, not a parse
         failure — ask rather than swing at random. */
      return {
        command: Command.create({
          actorId: opts.actorId, family: 'meta', utterance: raw,
          needsClarification: true,
          clarificationQuestion: 'Who do you want to attack?',
          source: opts.source || 'human',
        }),
        method: 'deterministic', confidence: 0.4,
      };
    }
    if (family === 'social') {
      step.social = Command.makeSocial({
        proposition: raw,
        approach: /\b(?:threaten|intimidate|menace)\b/i.test(raw) ? 'threatening'
          : /\b(?:lie|bluff|pretend|deceive)\b/i.test(raw) ? 'deceptive' : 'earnest',
        truthfulness: /\b(?:lie|bluff|pretend|deceive)\b/i.test(raw) ? 'false' : 'true',
        audience: 'private',
      });
    }
    if (family === 'improvised') {
      step.improvised = Command.makeImprovised({ desiredOutcome: raw, method: raw });
    }

    /* Confidence drives whether a model is consulted at all, so it has to mean
       something. A pattern hit whose objects all resolved is as good as this
       gets; a hit with a dangling reference is worth a second opinion. */
    var confidence;
    if (!hit) {
      confidence = 0.3;
    } else if (family === 'improvised') {
      confidence = 0.35;
    } else {
      confidence = 0.9;
      var needsTarget = ['attack', 'grapple', 'shove', 'help', 'persuade', 'deceive',
        'intimidate', 'ask', 'tell', 'insight'].indexOf(verb) >= 0;
      if (needsTarget && !target) confidence = 0.5;
      if (family === 'spell' && !step.spellId) confidence = 0.4;
      if (family === 'item' && !step.itemId) confidence = 0.4;
      /* Two clauses joined by "and then" or "then" is usually a compound
         action, which the pattern table cannot express. Worth a model. */
      if (/\b(?:and then|then|after that|before that)\b/i.test(raw)) confidence = Math.min(confidence, 0.55);
    }

    return {
      command: Command.create({
        sessionId: opts.sessionId, stateRevision: opts.stateRevision, turnEpoch: opts.turnEpoch,
        actorId: opts.actorId, source: opts.source || 'human',
        family: family, primary: step, utterance: raw,
        confidence: confidence,
      }),
      method: 'deterministic',
      confidence: confidence,
    };
  }

  /* ------------------------------------------------------- model-assisted -- */

  function buildUserPrompt(text, observation, options, opts) {
    var lines = [];
    lines.push('PLAYER (' + (opts.actorName || opts.actorId) + ') TYPED:');
    lines.push('"' + String(text).replace(/"/g, "'") + '"');
    lines.push('');
    lines.push('WHO IS PRESENT (you may only choose from these ids):');
    (options.targetIds || []).forEach(function (id) {
      var a = observation.actors[id];
      if (!a) return;
      lines.push('  ' + id + ' — ' + a.name + ' (' + a.side +
        (a.dead ? ', dead' : a.health ? ', ' + a.health : '') + ')');
    });
    if (!options.targetIds || !options.targetIds.length) lines.push('  (nobody)');
    if (options.spellIds && options.spellIds.length) {
      lines.push('');
      lines.push('SPELLS THIS CHARACTER CAN CAST RIGHT NOW: ' + options.spellIds.join(', '));
    }
    if (options.itemIds && options.itemIds.length) {
      lines.push('');
      lines.push('ITEMS CARRIED: ' + options.itemIds.slice(0, 40).join(', '));
    }
    if (opts.inCombat) {
      lines.push('');
      lines.push('This is a combat turn. The character has an action, a bonus action and movement.');
    }
    lines.push('');
    lines.push('Say which mechanical action this is. JSON only.');
    return lines.join('\n');
  }

  /**
   * Parse a player's free text into a command.
   *
   * Deterministic FIRST, model second — the reverse of the obvious ordering,
   * and the reverse of what this originally did.
   *
   * The live battery (tests/live-dm.js) settled it. On ordinary phrasings a
   * 1.7B model scored 38% against the pattern table's 100%, and took seven
   * seconds to do it: "I end my turn" came back as `escape_grapple`, "I search
   * the lantern housing" as `cast command`. A regex that reads "drink" and
   * finds the potion is not a lesser tool here, it is simply the right one.
   *
   * So the model is reserved for what patterns genuinely cannot do: unusual
   * phrasing, compound actions, and improvisation. That is where its judgement
   * is worth seven seconds, and it is the only place it is asked for it.
   */
  function parse(text, observation, options, opts) {
    opts = opts || {};

    var det = parseDeterministic(text, observation, options, opts);

    if (opts.forceModel) return escalate(text, observation, options, opts, det);

    /* A confident pattern match is authoritative. No model call, no latency,
       no chance of a creative misreading. */
    if (det.confidence >= 0.7 && !det.command.needsClarification) {
      return Promise.resolve(det);
    }

    /* Everything else — an unmatched phrasing, an ambiguous target, an
       improvised attempt — is worth asking a model about, if there is one. */
    if (!Backend.available() || opts.forceDeterministic) {
      det.fellBackBecause = Backend.isOffline() ? 'no model backend' : 'forced';
      return Promise.resolve(det);
    }
    return escalate(text, observation, options, opts, det);
  }

  /** Ask the model, and keep the deterministic parse as the safety net. */
  function escalate(text, observation, options, opts, det) {
    var fallback = function (why) {
      det.fellBackBecause = why;
      return Promise.resolve(det);
    };

    var classifyMsgs = [
      { role: 'system', content: SYSTEM },
      {
        role: 'user', content: 'PLAYER TYPED: "' + String(text).replace(/"/g, "'") + '"\n\n' +
          'Which family of action is this? Set compound if they described two actions in sequence. ' +
          'Set ambiguous only if two genuinely DIFFERENT actions are equally likely. JSON only.',
      },
    ];

    return Backend.chat({
      profile: 'referee',
      messages: classifyMsgs,
      format: Schema.classifierSchema(),
      numPredict: 60,
      signal: opts.signal,
    }).then(function (res) {
      var cls = safeJson(res.text);
      if (!cls || Command.FAMILIES.indexOf(cls.family) < 0) throw new Error('classifier failed');

      var schema = Schema.refereeSchema(cls.family, Object.assign({}, options, {
        allowFollowUp: !!cls.compound,
      }));

      return Backend.chat({
        profile: 'referee',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: buildUserPrompt(text, observation, options, opts) },
        ],
        format: schema,
        signal: opts.signal,
      }).then(function (r2) {
        return finish(r2.text, cls, 0);
      });

      function finish(rawText, cls, attempt) {
        var raw = safeJson(rawText);
        var errors = Schema.validateSemantics(raw, cls.family, options);
        if (errors.length) {
          /* One repair, with the specific complaint fed back. A second repair
             on a small model reliably produces the same mistake again, so the
             deterministic parser is a better use of the time. */
          if (attempt >= 1) throw new Error('validation failed: ' + errors.join('; '));
          return Backend.chat({
            profile: 'referee',
            messages: [
              { role: 'system', content: SYSTEM },
              { role: 'user', content: buildUserPrompt(text, observation, options, opts) },
              { role: 'assistant', content: rawText },
              {
                role: 'user', content: 'That was not valid: ' + errors.join('; ') +
                  '. Choose only from the ids listed above. Try again. JSON only.',
              },
            ],
            format: Schema.refereeSchema(cls.family, options),
            signal: opts.signal,
          }).then(function (r3) { return finish(r3.text, cls, attempt + 1); });
        }
        return build(raw, cls.family);
      }

      function build(raw, family) {
        if (raw.needsClarification) {
          return {
            command: Command.create({
              sessionId: opts.sessionId, stateRevision: opts.stateRevision, turnEpoch: opts.turnEpoch,
              actorId: opts.actorId, source: opts.source || 'human',
              family: 'meta', utterance: text,
              needsClarification: true,
              clarificationQuestion: raw.clarificationQuestion,
            }),
            method: 'model', confidence: 0.5,
          };
        }
        var primary = Schema.toStep(raw.primary, family, options);
        var followUp = (raw.hasFollowUp && raw.followUp && raw.followUp.verb)
          ? Schema.toStep(raw.followUp, family, options) : null;
        var cmd = Command.create({
          sessionId: opts.sessionId, stateRevision: opts.stateRevision, turnEpoch: opts.turnEpoch,
          actorId: opts.actorId, source: opts.source || 'human',
          family: family, primary: primary, followUp: followUp,
          condition: raw.condition || '',
          goal: raw.goal || '',
          utterance: text,
          confidence: 0.9,
        });
        var structural = Command.validateStructure(cmd);
        if (!structural.ok) throw new Error('structure: ' + structural.errors.join('; '));
        return { command: cmd, method: 'model', confidence: 0.9 };
      }
    }).catch(function (e) {
      return fallback(String((e && e.message) || e));
    });
  }

  /** Recover JSON from output that may be fenced or padded with prose. */
  function safeJson(text) {
    var raw = String(text || '').trim();
    var fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) raw = fence[1].trim();
    try { return JSON.parse(raw); } catch (e) { /* keep trying */ }
    var brace = raw.match(/\{[\s\S]*\}/);
    if (!brace) return null;
    try { return JSON.parse(brace[0]); } catch (e) { /* one repair pass */ }
    var patched = brace[0]
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");
    try { return JSON.parse(patched); } catch (e) { return null; }
  }

  var api = {
    SYSTEM: SYSTEM,
    PATTERNS: PATTERNS,
    parse: parse,
    parseDeterministic: parseDeterministic,
    matchTarget: matchTarget,
    safeJson: safeJson,
    buildUserPrompt: buildUserPrompt,
  };

  global.DND = global.DND || {};
  global.DND.Referee = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
