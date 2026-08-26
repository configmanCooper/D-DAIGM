/*
 * narrator.js — turning a committed event batch into prose, safely.
 *
 * By the time this runs the turn has already happened: dice rolled, damage
 * applied, revision bumped, save consistent. Narration cannot change any of
 * it, cannot fail the turn, and can be retried or abandoned freely. That is
 * the whole reason the pipeline is ordered this way.
 *
 * What this file mostly contains is gates. Telling a 4B model not to write as
 * the player, not to name the villain and not to repeat itself works perhaps
 * four times in five, and one failure in five is a campaign-ruining leak. So
 * each instruction has a matching programmatic check, and a failed check
 * redacts, regenerates, or falls back to the offline narrator.
 */
(function (global) {
  'use strict';

  var Backend = (global.DND && global.DND.Backend) ||
    (typeof require !== 'undefined' ? require('./backend.js') : null);
  var Prompt = (global.DND && global.DND.Prompt) ||
    (typeof require !== 'undefined' ? require('./prompt.js') : null);
  var Knowledge = (global.DND && global.DND.Knowledge) ||
    (typeof require !== 'undefined' ? require('../engine/knowledge.js') : null);
  var Offline = (global.DND && global.DND.Offline) ||
    (typeof require !== 'undefined' ? require('./offline.js') : null);
  var Rulebook = (global.DND && global.DND.Rulebook) ||
    (typeof require !== 'undefined' ? require('./rulebook.js') : null);
  var Retcon = (global.DND && global.DND.Retcon) ||
    (typeof require !== 'undefined' ? require('../engine/retcon.js') : null);
  /* Resolved lazily inside tableFacts, not here: dispatch.js pulls in every
     resolver, and those require knowledge.js, which requires this file. Taking
     the reference at load time closes that circle and one of the two modules
     gets a half-built export. */
  function dispatch() {
    return (global.DND && global.DND.Dispatch) ||
      (typeof require !== 'undefined' ? require('../engine/dispatch.js') : null);
  }

  /* Phrases that mean the model has stopped being a narrator. */
  var BREAKS_CHARACTER = /\b(?:as an ai|as a language model|i'?m an ai|i cannot (?:fulfil|fulfill|comply)|i'?m sorry,? but i|as a large language model|i don'?t have (?:personal|the ability))\b/i;

  /* Scaffolding that means it answered a question instead of telling a story. */
  var META_TALK = /\b(?:in this scenario|the (?:player|user) (?:can|could|should|might)|as the dungeon master,? i|let me know (?:if|what)|would you like me to|feel free to)\b/i;

  var GATES = {
    /* Any one of these makes the whole reply unusable, so it is regenerated
       once and then replaced with deterministic prose. */
    fatal: ['breaks_character', 'meta_talk', 'empty'],
    /* These are repaired in place. */
    repairable: ['player_voice', 'forbidden_name', 'too_long', 'repeated_opening'],
  };

  /* ---------------------------------------------------------------- gates -- */

  /**
   * Did the model write dialogue or thought for a character the player
   * controls? Detecting attributed speech is the tractable version of this:
   * '"Get behind me," Shen said' is a clear violation, while a line that only
   * describes Shen is fine and desirable.
   */
  function findPlayerVoice(text, playerNames) {
    if (!playerNames || !playerNames.length) return [];
    var hits = [];
    playerNames.forEach(function (name) {
      if (!name) return;
      var first = String(name).split(/\s+/)[0];
      [name, first].forEach(function (n) {
        var esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        /* "…," Shen said  /  Shen says, "…"  /  Shen thinks: … */
        var patterns = [
          new RegExp('["\u201d]\\s*,?\\s*' + esc + '\\s+(?:said|says|replied|replies|answered|answers|murmurs?|mutters?|shouts?|whispers?|adds?|asks?)', 'i'),
          new RegExp('\\b' + esc + '\\s+(?:said|says|replies|replied|answers|answered|murmurs?|mutters?|shouts?|whispers?|asks?|adds?)\\s*,?\\s*["\u201c]', 'i'),
          new RegExp('\\b' + esc + '\\s+(?:thinks?|decides?|feels? certain|realis|realiz|wants? to|intends? to)', 'i'),
        ];
        patterns.forEach(function (re) {
          var m = text.match(re);
          if (m) hits.push({ name: n, match: m[0] });
        });
      });
    });
    return hits;
  }

  /**
   * Redact forbidden names rather than regenerating for them.
   *
   * Regeneration is the wrong reflex: the model reached for the name because
   * the scene evokes it, so it will usually reach again. Replacing the words
   * with something the narration can survive is both cheaper and more
   * reliable, and the substitutions read as deliberate withholding.
   */
  function redactNames(text, forbidden) {
    if (!forbidden || !forbidden.length) return { text: text, redacted: [] };
    var out = text, redacted = [];
    forbidden.forEach(function (name) {
      if (!name) return;
      var esc = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp('\\b' + esc + '\\b', 'gi');
      if (re.test(out)) {
        out = out.replace(re, 'something it does not name');
        redacted.push(name);
      }
    });
    /* The substitution reads badly if it lands twice in one sentence. */
    out = out.replace(/(something it does not name)([^.!?]*)\1/gi, '$1$2it');
    return { text: out, redacted: redacted };
  }

  function firstWords(text, n) {
    return String(text || '').trim().split(/\s+/).slice(0, n || 2).join(' ').toLowerCase()
      .replace(/[^a-z\s]/g, '');
  }

  /** Rolling n-gram overlap against recent turns, to catch a model looping. */
  function repetitionScore(text, recent) {
    if (!recent || !recent.length) return 0;
    var grams = function (s) {
      var w = String(s || '').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
      var out = {};
      for (var i = 0; i + 3 <= w.length; i++) out[w.slice(i, i + 3).join(' ')] = true;
      return out;
    };
    var mine = grams(text);
    var keys = Object.keys(mine);
    if (!keys.length) return 0;
    var worst = 0;
    recent.forEach(function (prev) {
      var theirs = grams(prev);
      var shared = keys.filter(function (k) { return theirs[k]; }).length;
      worst = Math.max(worst, shared / keys.length);
    });
    return worst;
  }

  var STOPWORDS = {
    the: 1, a: 1, an: 1, and: 1, or: 1, but: 1, of: 1, to: 1, in: 1, on: 1, at: 1, is: 1,
    it: 1, its: 1, as: 1, with: 1, for: 1, from: 1, that: 1, this: 1, into: 1, over: 1,
    was: 1, were: 1, be: 1, been: 1, are: 1, his: 1, her: 1, their: 1, he: 1, she: 1, they: 1,
    /* Directional and degree particles read as content to a naive filter but
       carry no distinctive phrasing: "out of the water" is how anyone would
       say it, and flagging it as self-repetition wastes a regeneration. */
    out: 1, up: 1, down: 1, back: 1, off: 1, then: 1, there: 1, here: 1, not: 1, no: 1,
    all: 1, one: 1, like: 1, so: 1, very: 1, just: 1, still: 1, own: 1, more: 1, some: 1,
  };

  /**
   * A repeated four-word run, which the aggregate overlap score misses.
   *
   * The live battery produced "the very air is holding its breath" and then,
   * two turns later, "the air itself is holding its breath". Trigram overlap
   * across the whole paragraph stayed low because everything around it
   * differed — but a reader notices immediately. Requiring two content words
   * in the run keeps ordinary phrasing ("out of the water") from tripping it.
   */
  function repeatedPhrase(text, recent) {
    if (!recent || !recent.length) return null;
    var words = function (s) {
      return String(s || '').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
    };
    var mine = words(text);
    var seen = {};
    recent.forEach(function (prev) {
      var w = words(prev);
      for (var i = 0; i + 4 <= w.length; i++) seen[w.slice(i, i + 4).join(' ')] = true;
    });
    for (var i = 0; i + 4 <= mine.length; i++) {
      var run = mine.slice(i, i + 4);
      if (!seen[run.join(' ')]) continue;
      var content = run.filter(function (w) { return !STOPWORDS[w]; }).length;
      if (content >= 2) return run.join(' ');
    }
    return null;
  }

  /* Small models open on the weather with striking consistency. The stage
     direction asks them not to; this is what happens when they do anyway. */
  var TIRED_OPENERS = /^(?:the (?:air|fog|mist|silence|wind|rain|water|night|darkness)\b|you feel\b|there is a\b|a (?:cold|thick|heavy|damp) )/i;

  /* Models occasionally emit a token from another script mid-sentence —
     "shield\u89d2\u5ea6" appeared in a playtest. Rare, jarring, and trivially
     detectable, so it is worth a regeneration. Covers CJK, Cyrillic, Greek,
     Arabic, Hebrew, Hangul and Devanagari. */
  var FOREIGN_SCRIPT = /[\u0370-\u03ff\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u0900-\u097f\u1100-\u11ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;

  /**
   * Run every gate. Returns cleaned text plus what had to be done to it, so a
   * test can assert on the gate rather than on the prose.
   */
  function applyGates(raw, opts) {
    opts = opts || {};
    var report = { issues: [], redacted: [], regenerate: false, usable: true };
    var text = Backend.cleanProse(raw);

    if (!text || text.length < 12) {
      report.issues.push('empty');
      report.regenerate = true;
      report.usable = false;
      return { text: text, report: report };
    }

    if (BREAKS_CHARACTER.test(text)) {
      report.issues.push('breaks_character');
      report.regenerate = true;
      report.usable = false;
    }
    if (META_TALK.test(text)) {
      report.issues.push('meta_talk');
      report.regenerate = true;
      report.usable = false;
    }

    var voice = findPlayerVoice(text, opts.playerCharacters);
    if (voice.length) {
      report.issues.push('player_voice');
      report.playerVoice = voice;
      /* Drop the offending sentences rather than the whole reply — usually
         only one line in an otherwise good paragraph speaks for the player. */
      text = text.split(/(?<=[.!?])\s+/).filter(function (sentence) {
        return !findPlayerVoice(sentence, opts.playerCharacters).length;
      }).join(' ');
      if (text.trim().length < 12) { report.regenerate = true; report.usable = false; }
    }

    var red = redactNames(text, opts.mustNotName);
    if (red.redacted.length) {
      report.issues.push('forbidden_name');
      report.redacted = red.redacted;
      text = red.text;
    }

    if (opts.recent && opts.recent.length) {
      var score = repetitionScore(text, opts.recent);
      report.repetition = score;
      if (score > 0.35) {
        report.issues.push('repeated_phrasing');
        report.regenerate = true;
      }
      var phrase = repeatedPhrase(text, opts.recent);
      if (phrase) {
        report.issues.push('repeated_phrasing');
        report.repeatedPhrase = phrase;
        report.regenerate = true;
      }
      var opener = firstWords(text, 2);
      var openers = opts.recent.map(function (r) { return firstWords(r, 2); });
      if (opener && openers.indexOf(opener) >= 0) {
        report.issues.push('repeated_opening');
        report.regenerate = true;
      }
    }

    if (TIRED_OPENERS.test(text)) {
      report.issues.push('tired_opening');
      /* Worth one retry but never a fallback: a weather opener is dull, not
         wrong, and dull prose still describes the turn correctly. */
      report.regenerate = true;
    }

    if (FOREIGN_SCRIPT.test(text)) {
      report.issues.push('foreign_script');
      report.regenerate = true;
      /* Strip it as well as regenerating, so that if the retry also fails the
         player still gets readable English rather than a stray glyph. */
      text = text.replace(new RegExp(FOREIGN_SCRIPT.source, 'g'), '').replace(/\s{2,}/g, ' ');
    }

    if (opts.maxWords) {
      var words = text.split(/\s+/);
      if (words.length > opts.maxWords * 1.4) {
        report.issues.push('too_long');
        text = Backend.trimToSentence(text, opts.maxWords);
      }
    }

    return { text: text.trim(), report: report };
  }

  /* --------------------------------------------------------- the call ----- */

  /**
   * Narrate one committed batch.
   *
   * Never rejects. Every failure path ends in usable prose, because a turn
   * that has already been committed mechanically must not be left without
   * words describing it.
   */
  function narrate(state, store, campaign, batch, opts) {
    opts = opts || {};
    var beats = (batch && batch.beats) || [];
    var built = Prompt.forNarration(state, store, campaign, beats, opts);
    var gateOpts = {
      playerCharacters: built.ctx.playerCharacters,
      mustNotName: built.ctx.mustNotName,
      recent: opts.recent || [],
      maxWords: built.ctx.maxWords,
    };

    function offlineFallback(why) {
      var text = Offline
        ? Offline.narrate(state, batch, Object.assign({}, opts, { reason: why }))
        : beats.join(' ');
      return { text: text, source: 'offline', report: { issues: ['fallback:' + why] } };
    }

    if (!Backend.available()) return Promise.resolve(offlineFallback('no backend'));

    var assembled = Prompt.assemble({
      system: built.system,
      stage: built.stage,
      pinned: opts.pinned || [],
      summaries: opts.summaries || [],
      history: opts.history || [],
    }, opts.budgetTokens);

    /**
     * Stream tokens without letting an ungated word reach the screen.
     *
     * Raw tokens used to go straight to the UI, and only afterwards did the
     * gates get a look — so a forbidden name, a line spoken in the player's
     * own voice, or an invented event was displayed first and quietly
     * corrected second. A reader who saw it cannot un-see it, which makes the
     * secrecy guarantee ornamental.
     *
     * Two things fix it without giving up the feel of live writing:
     *   · every emitted piece is passed through the same name redaction the
     *     final gate applies, and
     *   · a trailing window is held back, longer than the longest forbidden
     *     name, so a name split across token boundaries is still caught
     *     before any part of it is shown.
     * The gated text replaces the streamed draft when the reply completes.
     */
    function guardedStream(onToken) {
      if (!onToken) return null;
      var forbidden = (gateOpts && gateOpts.mustNotName) || [];
      var longest = forbidden.reduce(function (m, s) { return Math.max(m, String(s).length); }, 0);
      var hold = Math.max(24, longest + 8);
      var buffer = '', shown = 0;
      return function (piece) {
        buffer += piece;
        /* Redact the WHOLE buffer every time, not just the new piece. A name
           arriving as "Hollow" then " King" is invisible to a filter that only
           ever sees one chunk, which is how the first version of this still
           leaked: the two halves were clean, the join was not. */
        var red = redactNames(buffer, forbidden);
        var safe = (red && typeof red === 'object' ? red.text : red) || '';
        /* Never show the last `hold` characters. Anything still growing into a
           forbidden name is inside that tail, so it cannot already be on
           screen by the time it becomes recognisable. */
        var upTo = safe.length - hold;
        if (upTo <= shown) return;
        var chunk = safe.slice(shown, upTo);
        shown = upTo;
        if (chunk) onToken(chunk);
      };
    }

    function attempt(n, extraInstruction) {
      var messages = assembled.messages.slice();
      if (extraInstruction) {
        messages = messages.concat([{ role: 'user', content: extraInstruction }]);
      }
      return Backend.chat({
        profile: 'narrator',
        messages: messages,
        onToken: n === 0 ? guardedStream(opts.onToken) : null,   // only stream the first try
        signal: opts.signal,
        seed: opts.seed,
        numPredict: opts.numPredict,
      }).then(function (res) {
        /* A model can return long after its turn ended. Applying that would
           describe a moment that has already been superseded. */
        if (opts.turnEpoch != null && state.turnEpoch !== opts.turnEpoch) {
          return { text: '', source: 'stale', report: { issues: ['stale'] }, stale: true };
        }
        var gated = applyGates(res.text, gateOpts);
        if (gated.report.usable && !gated.report.regenerate) {
          return { text: gated.text, source: res.kind, report: gated.report };
        }
        if (n >= 1) {
          /* One regeneration is the budget. A second attempt on a small model
             reproduces the same failure often enough that the deterministic
             narrator is the better use of the player's patience. */
          if (gated.report.usable && gated.text) {
            return { text: gated.text, source: res.kind, report: gated.report };
          }
          return offlineFallback(gated.report.issues.join(','));
        }
        return attempt(n + 1, correctionFor(gated.report, built.ctx));
      }).catch(function (e) {
        return offlineFallback(String((e && e.message) || e));
      });
    }

    return attempt(0, null);
  }

  /** Turn a gate failure into the shortest instruction that fixes it. */
  function correctionFor(report, ctx) {
    var notes = [];
    if (report.issues.indexOf('breaks_character') >= 0 || report.issues.indexOf('meta_talk') >= 0) {
      notes.push('You broke character. Write only what happens in the world, as a story. ' +
        'Never refer to yourself, the player, the game, or being an assistant.');
    }
    if (report.issues.indexOf('player_voice') >= 0) {
      notes.push('You wrote words or thoughts for ' + (ctx.playerCharacters || []).join(' or ') +
        '. Never do that. Describe what happens around and to them only.');
    }
    if (report.issues.indexOf('repeated_phrasing') >= 0 || report.issues.indexOf('repeated_opening') >= 0) {
      notes.push('That was too close to what you already wrote' +
        (report.repeatedPhrase ? ' ("' + report.repeatedPhrase + '")' : '') +
        '. Start somewhere completely different \u2014 a different sense, a different person, ' +
        'a different detail. Do not reuse that phrasing.');
    }
    if (report.issues.indexOf('tired_opening') >= 0) {
      notes.push('Do not open with the air, the fog, the mist, the silence or the weather. ' +
        'Open on a person, an object, or an action.');
    }
    if (report.issues.indexOf('empty') >= 0) {
      notes.push('You wrote nothing usable. Describe the moment plainly in two short paragraphs.');
    }
    notes.push('Rewrite it. Narration only.');
    return notes.join(' ');
  }

  /**
   * The opening scene: where you are, who you are, and what is in front of you.
   *
   * The game used to begin with two system lines — "The table is set. A matter
   * at the Ashford toll bridge." and then "Roll for initiative." — and drop
   * straight into a fight. A player who had just built a character was given
   * no world, no place, no sense of who was standing next to them and no idea
   * why anyone was drawing steel. That is not how a session starts at a table;
   * a Dungeon Master sets a scene first.
   *
   * Written through the same knowledge-gated path as every other narration, so
   * it can describe only what the party could actually perceive: no secrets, no
   * foreshadowing of anything the campaign has not revealed, no naming of
   * something nobody has seen.
   */
  function opening(state, store, campaign, opts) {
    opts = opts || {};
    /* The roster is built HERE rather than passed in from the UI. app.js has a
       standing rule that it never reads `state.actors` for display — the one
       sanctioned door is `App.layersFor`, and that deliberately covers only
       human-controlled seats, which is not the party. The narrator is engine
       side and already receives the state and the knowledge store, so this is
       where the question belongs. */
    var party = opts.party || partyRoster(state);
    var built = Prompt.forNarration(state, store, campaign, [], Object.assign({}, opts, {
      party: party,
      maxWords: opts.maxWords || 220,
      sentences: 10,
      paragraphs: 3,
    }));

    var roster = party.map(function (p) {
      return '- ' + p.name + (p.race || p.klass
        ? ' (' + [p.race, p.klass].filter(Boolean).join(' ') +
          (p.level ? ', level ' + p.level : '') + ')'
        : '') +
        (p.backstory ? ' — their own history: ' + p.backstory : '');
    }).join('\n');

    var stage = built.stage +
      '\n\n[NOW — THE OPENING OF THE SESSION]\n' +
      'This is the first thing anyone reads. Nobody has been told anything yet.\n' +
      'Write three short paragraphs:\n' +
      '1. The world and the moment — where this is, what kind of place it is, the ' +
      'hour and the weather, in a couple of sentences. Concrete and physical.\n' +
      '2. The party, by name. One clause each, describing how they LOOK and carry ' +
      'themselves — not their statistics. Use these people and no others:\n' +
      roster + '\n' +
      '3. What is in front of them right now, and why it matters enough to stop for.\n\n' +
      'Rules: reveal nothing the party has not learned. No prophecy, no hints at ' +
      'what is really going on, no villain the party has not met. Do not mention ' +
      'dice, rules, levels, hit points or classes. Do not tell anyone what they ' +
      'feel or decide. End on the situation, not on a question.\n' +
      'Separate the three paragraphs with a blank line. Keep sentences short — ' +
      'two clauses at most. Around 180 words in total, and never more than 250.';

    if (!Backend.available()) {
      return Promise.resolve({
        text: offlineOpening(state, campaign, party, built.ctx),
        source: 'offline', report: { issues: ['fallback:no backend'] },
      });
    }

    return Backend.chat({
      profile: 'narrator',
      messages: [{ role: 'system', content: built.system }, { role: 'user', content: stage }],
      numPredict: 420,
      onToken: opts.onToken,
      signal: opts.signal,
    }).then(function (res) {
      var gated = applyGates(res.text, {
        playerCharacters: built.ctx.playerCharacters,
        mustNotName: built.ctx.mustNotName,
        recent: [],
        maxWords: 260,
      });
      var text = gated.text;
      if (!text || text.length < 60) {
        return { text: offlineOpening(state, campaign, party, built.ctx), source: 'offline',
          report: { issues: ['fallback:too short'] } };
      }
      return { text: text, source: res.kind, report: gated.report };
    }).catch(function () {
      return { text: offlineOpening(state, campaign, party, built.ctx), source: 'offline',
        report: { issues: ['fallback:error'] } };
    });
  }

  /**
   * Everyone at the table, as the Dungeon Master would describe them: name,
   * what they visibly are, and whatever history the player wrote for them.
   */
  function partyRoster(state) {
    return Object.keys((state && state.actors) || {})
      .filter(function (id) {
        var a = state.actors[id];
        return a && a.side === 'party' && a.runtime && !a.runtime.dead;
      })
      .map(function (id) {
        var a = state.actors[id];
        var base = a.base || {};
        var cls = (base.classes && base.classes[0] && base.classes[0].classId) || null;
        return {
          name: a.name || id,
          race: base.subraceId || base.raceId || null,
          klass: cls,
          level: (a.derivedCache && a.derivedCache.level) || null,
          /* A backstory the player wrote is theirs, and the Dungeon Master was
             given it for exactly this moment. */
          backstory: (base.backstory || '').slice(0, 240) || null,
        };
      });
  }

  /**
   * An opening with no model at all.
   *
   * Still a scene rather than a stub: the place, the cast and what is waiting.
   * A player running offline deserves to know where they are standing.
   */
  function offlineOpening(state, campaign, party, ctx) {
    var where = (ctx && ctx.locationName) || (state && state.locationId) || 'somewhere unmarked';
    var title = (campaign && campaign.title) || 'this business';
    var lines = [];

    lines.push('You are at ' + where + '. ' +
      (campaign && campaign.premise ? campaign.premise : 'The matter at hand is ' + title + '.'));

    if (party.length) {
      var who = party.map(function (p) {
        var bits = [p.name];
        var kind = [p.race, p.klass].filter(Boolean).join(' ');
        if (kind) bits.push('the ' + kind.toLowerCase());
        return bits.join(', ');
      });
      lines.push('With you: ' + who.join('; ') + '.');
    }

    var foes = (ctx && ctx.enemies) || [];
    if (foes.length) {
      lines.push('Ahead of you: ' + foes.map(function (e) { return e.name; }).join(', ') +
        '. Nobody has moved yet.');
    } else {
      lines.push('Nothing is threatening you yet. What you do next is yours to choose.');
    }
    return lines.join('\n\n');
  }

  /**
   * A single NPC line, used when the DM is voicing one character rather than
   * describing a scene. Same gates, shorter budget.
   */
  function speak(state, store, campaign, speaker, opts) {
    opts = opts || {};
    var built = Prompt.forNarration(state, store, campaign, opts.beats || [], Object.assign({}, opts, {
      speakers: [speaker],
      maxWords: opts.maxWords || 45,
      paragraphs: 1,
    }));
    var stage = built.stage + '\n\n[NOW]\nWrite only what ' + speaker.name +
      ' says aloud. One or two sentences. No description, no quotation marks around the whole line.';

    if (!Backend.available()) {
      return Promise.resolve({
        text: Offline ? Offline.speak(speaker, opts) : '...',
        source: 'offline', report: { issues: ['fallback:no backend'] },
      });
    }

    return Backend.chat({
      profile: 'voice',
      messages: [{ role: 'system', content: built.system }, { role: 'user', content: stage }],
      onToken: opts.onToken,
      signal: opts.signal,
    }).then(function (res) {
      var gated = applyGates(res.text, {
        playerCharacters: built.ctx.playerCharacters,
        mustNotName: built.ctx.mustNotName,
        recent: opts.recent || [],
        maxWords: opts.maxWords || 45,
      });
      var text = gated.text.replace(/^["\u201c]|["\u201d]$/g, '').trim();
      if (!text) return { text: Offline ? Offline.speak(speaker, opts) : '...', source: 'offline', report: gated.report };
      return { text: text, source: res.kind, report: gated.report };
    }).catch(function () {
      return { text: Offline ? Offline.speak(speaker, opts) : '...', source: 'offline', report: { issues: ['error'] } };
    });
  }

  /**
   * A question to the Dungeon Master, out of character.
   *
   * "OOC: can I see the far bank from here?" or "OOC: how does grappling
   * work?" — the two things a player at a table asks between turns, and
   * neither of them is a move. Answered as the referee rather than as the
   * fiction: plain, brief, and with no dice rolled and no turn spent.
   *
   * The knowledge gate still applies. A player asking "OOC: who is really
   * behind this?" gets what their character could know and nothing else — an
   * out-of-character question is not a back door into the campaign's secrets,
   * and the same `mustNotName` list that governs narration governs this.
   */
  function answer(state, store, campaign, question, opts) {
    opts = opts || {};
    var built = Prompt.forNarration(state, store, campaign, [], Object.assign({}, opts, {
      maxWords: opts.maxWords || 110,
      sentences: 4,
      paragraphs: 1,
    }));

    /* Real numbers, so it never has to guess at the player's own sheet.
       Without these the model answers "what is my Armour Class?" by inventing
       a plausible number, which is worse than refusing. */
    var facts = tableFacts(state, opts.actorId);

    /* And the actual rule, so it never has to remember one. A 4B model asked
       about grappling recalled "a check against their AC" and "restrained";
       handed the SRD passage it paraphrases it correctly. */
    var rules = Rulebook ? Rulebook.forPrompt(question, 3) : '';

    var stage =
      'A player has stopped play to ask you something directly:\n\n' +
      '  "' + String(question).slice(0, 400) + '"\n\n' +
      (rules ? '=== THE RULES THAT APPLY ===\n' +
        'Quoted from the rulebook. These are authoritative. Use them, and do ' +
        'not contradict them from memory.\n\n' + rules + '\n\n' : '') +
      '=== THE SITUATION, for your reference only ===\n' + built.stage + '\n\n' +
      /* The facts go LAST, immediately before the question is repeated,
         because that is the position a small model actually attends to. With
         them earlier in the prompt the model read "level 3: 2 of 2" and still
         answered that those slots were spent. */
      (facts ? '=== THE FACTS ===\n' +
        'Taken directly from the game right now. Every number here is correct. ' +
        'If the question is about any of it, READ THE NUMBER OUT rather than ' +
        'working it out or recalling it:\n' + facts + '\n\n' : '') +
      'The question again: "' + String(question).slice(0, 400) + '"\n\n' +
      'Answer it in two or three plain sentences, beginning with the answer.';

    if (!Backend.available()) {
      return Promise.resolve({
        text: offlineAnswer(question, built.ctx, facts, rules),
        source: 'offline', report: { issues: ['fallback:no backend'] },
      });
    }

    /* A referee's system prompt, NOT the narrator's.
       Handing this the narration persona produced exactly what that persona is
       built to produce: a paragraph of scene-setting about iron smoke and the
       light over Glass Fen, and then, eventually, the answer about grappling.
       The player asked a question and had to read a mood piece to find the
       reply in it. */
    var system = 'You are the Dungeon Master of a Dungeons & Dragons 5th Edition ' +
      'game (2014 rules), answering a player\u2019s question between turns. ' +
      'You are talking to a person, not narrating a scene.\n\n' +
      'You can and should answer ANY question about:\n' +
      '  \u2022 the D&D 5e rules \u2014 how grappling, concentration, saving throws, ' +
      'spell slots, opportunity attacks, death saves, resting or anything else ' +
      'actually works;\n' +
      '  \u2022 this character \u2014 their statistics, what they are carrying, what ' +
      'they can cast, what they are able to do right now;\n' +
      '  \u2022 the situation \u2014 where they are, who is present, what they can see;\n' +
      '  \u2022 this program itself \u2014 the panels along the bottom (Actions, Party, ' +
      'Sheet, Map) open and close and can be dragged and resized; Save keeps the ' +
      'game in this browser and Export downloads it as a file; typing anything ' +
      'shows you what it will cost before it happens; and starting a line with ' +
      '"OOC:" is how they are talking to you now, which never spends a turn.\n\n' +
      'Use the FACTS given below for anything about this character or this ' +
      'scene, and the RULES given below for anything about how the game works, ' +
      'in preference to your own memory, which is less reliable than the text ' +
      'you are given.\n\n' +
      'THREE THINGS YOU MUST NOT DO:\n' +
      '  1. Do not state a number that is not in the facts. If you are asked ' +
      'something numerical and the number is written below, read it out exactly ' +
      'as written; do not recompute it, and do not add it up.\n' +
      '  2. Do not tell the player an enemy\u2019s hit points, Armour Class, ' +
      'saving throws or statistics, and do not guess at them. Say that they ' +
      'would have to find out in play.\n' +
      '  3. Do not offer them spells, items, gold or abilities that are not ' +
      'listed in the facts below. If it is not listed, they do not have it.\n\n' +
      'Answer in two or three plain sentences. No scene-setting, no atmosphere, ' +
      'no description of the room or the weather, no fiction of any kind. ' +
      'Begin with the answer itself.\n' +
      'You must not invent events, advance the story, or reveal anything the ' +
      'party has not learned.';

    return Backend.chat({
      profile: 'rules',
      messages: [{ role: 'system', content: system }, { role: 'user', content: stage }],
      numPredict: 320,
      signal: opts.signal,
      /* Forwarded so the caller's stall deadline can see tokens arriving.
         Without it a long but perfectly healthy answer reports no progress at
         all and gets cut off at the stall limit. */
      onToken: opts.onToken,
    }).then(function (res) {
      /* Gated for leaks, but NOT for the in-character rules: this is the DM
         speaking as themselves, so "you" and rules talk are exactly right
         here and would be stripped by the narration gates.
         `redactNames` returns {text, redacted}, not a string — taking it for
         a string put "[object Object]" on the page where the answer should
         have been. */
      var scrubbed = redactNames(String(res.text || '').trim(), built.ctx.mustNotName || []);
      var text = (scrubbed && scrubbed.text ? scrubbed.text : '').trim();
      if (!text) return { text: offlineAnswer(question, built.ctx, facts, rules), source: 'offline',
        report: { issues: ['fallback:empty'] } };
      return { text: text, source: res.kind, report: { issues: [], redacted: scrubbed.redacted } };
    }).catch(function (err) {
      /* Say what actually went wrong. Reporting "there is no model running"
         when a model IS configured and the request failed sends the player to
         the setup screen to fix something that is not broken — which is
         exactly the dead end the "No model available" message created. */
      var why = (err && err.message) || String(err);
      return {
        text: 'The Dungeon Master could not be reached, so this is the engine ' +
          'answering instead of the model.\n\nReason: ' + why + '\n\n' +
          offlineAnswer(question, built.ctx, facts, rules),
        source: 'offline',
        report: { issues: ['fallback:error'], error: why },
      };
    });
  }

  /**
   * Decide whether an out-of-character message is a question or a request to
   * amend the record, and if the latter, rule on it.
   *
   * Kept as one call rather than two so that a stalled model costs one wait
   * rather than two, and so the Dungeon Master answers in one voice. The
   * classification is done by the model because the phrasings are endless
   * ("can we say...", "I'd have bought...", "wait, didn't I already...",
   * "hang on, you said the door was locked") and a regular expression over
   * that space is a guessing game. But the model only ever CLASSIFIES and
   * PROPOSES: what a retcon may actually do is decided in retcon.js, in code.
   */
  function adjudicate(state, store, campaign, message, opts) {
    opts = opts || {};
    var actorId = opts.actorId || state.activeActorId;
    var facts = tableFacts(state, actorId);
    var who = (state.actors || {})[actorId];
    var limits = Retcon ? Retcon.LIMITS : { gold: 250, items: 3, itemGoldValue: 150, hp: 20 };

    var system = 'You are the Dungeon Master of a D&D 5th Edition game (2014 ' +
      'rules). A player has said something to you out of character. Decide ' +
      'which of two things it is.\n\n' +
      'ASK \u2014 they want to know something: a rule, their own statistics, ' +
      'what they can do, how this program works.\n\n' +
      'AMEND \u2014 they want to change or add to what has already happened. ' +
      '"Can we say I bought rope in town?", "I\u2019d have filled my waterskin", ' +
      '"wait, you said that door was unlocked", "shouldn\u2019t that have been ' +
      'at advantage?". This is a retcon: establishing that something was ' +
      'already true, or correcting a mistake.\n\n' +
      'If it is an AMEND, rule on it the way a fair Dungeon Master would. ' +
      'Say yes to anything ordinary that the character plausibly had the time, ' +
      'money and opportunity to do, and to genuine corrections. Say no to ' +
      'anything that would rewrite a scene the party has already played ' +
      'through, undo a consequence they did not like, or hand them something ' +
      'they could not have got.\n\n' +
      'What a retcon may do at most: ' + limits.gold + ' gp, ' + limits.items +
      ' ordinary items worth up to ' + limits.itemGoldValue + ' gp each, and ' +
      limits.hp + ' hit points of correction. It can never grant levels, ' +
      'raise ability scores, or bring back the dead.\n\n' +
      'Reply with JSON only.';

    var schema = {
      type: 'object',
      properties: {
        intent: { type: 'string', enum: ['ask', 'amend'] },
        allowed: { type: 'boolean' },
        summary: { type: 'string' },
        reason: { type: 'string' },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['item', 'gold', 'hp', 'fact', 'note', 'flag', 'condition'] },
              actorId: { type: 'string' },
              itemId: { type: 'string' },
              qty: { type: 'integer' },
              delta: { type: 'integer' },
              text: { type: 'string' },
              op: { type: 'string' },
            },
            required: ['type'],
          },
        },
      },
      required: ['intent'],
    };

    var prompt =
      'The player said:\n\n  "' + String(message).slice(0, 400) + '"\n\n' +
      'They are playing ' + ((who && who.name) || 'the party') +
      ' (id "' + actorId + '"), and any change should name that id as actorId ' +
      'unless they clearly mean someone else.\n\n' +
      (facts ? 'Where things stand:\n' + facts + '\n\n' : '') +
      'If this is a question, answer with {"intent":"ask"} and nothing else.\n' +
      'If it is an amendment, give intent "amend", whether you allow it, a ' +
      'one-sentence summary written as settled fact ("You bought a fifty-foot ' +
      'rope in Ashford before you left"), your reason, and the mechanical ' +
      'changes. Use itemId slugs like "rope-hempen-50-feet" or plain item ' +
      'names. A purchase should include the gold spent as a negative delta.';

    if (!Backend.available()) {
      return Promise.resolve({ intent: 'ask', source: 'offline' });
    }

    return Backend.chat({
      profile: 'referee',
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      format: schema,
      numPredict: 400,
      signal: opts.signal,
    }).then(function (res) {
      var parsed = null;
      try { parsed = JSON.parse(String(res.text || '').trim()); } catch (e) { parsed = null; }
      if (!parsed || parsed.intent !== 'amend') return { intent: 'ask', source: res.kind };
      return {
        intent: 'amend',
        allowed: parsed.allowed !== false,
        summary: parsed.summary || '',
        reason: parsed.reason || '',
        changes: Array.isArray(parsed.changes) ? parsed.changes : [],
        source: res.kind,
      };
    }).catch(function () {
      /* A failed classification must fall back to answering, never to
         silently amending the world. */
      return { intent: 'ask', source: 'offline' };
    });
  }

  /**
   * The numbers a player might ask about, straight from the engine.
   *
   * Supplied so the Dungeon Master never has to guess at its own game. Asked
   * "what is my Armour Class?" without these, a model invents a plausible
   * number, which is worse than refusing to answer.
   */
  function tableFacts(state, actorId) {
    var id = actorId || state.activeActorId ||
      ((state.seats || [])[0] || {}).actorId;
    var a = id && state.actors ? state.actors[id] : null;
    if (!a) return null;
    var d = a.derivedCache || {};
    var rt = a.runtime || {};
    var L = [];

    L.push(a.name + ' \u2014 ' +
      [(a.base && (a.base.subraceId || a.base.raceId)),
        ((a.base && a.base.classes) || []).map(function (c) {
          return c.classId + ' ' + c.levels;
        }).join('/')].filter(Boolean).join(' ') +
      (d.level ? ', level ' + d.level : ''));
    L.push('  Hit points ' + rt.hp + '/' + d.hpMax +
      ' \u00b7 Armour Class ' + d.ac +
      ' \u00b7 Speed ' + d.speed + ' ft' +
      ' \u00b7 Proficiency +' + d.proficiencyBonus +
      (rt.inspiration ? ' \u00b7 has Inspiration' : ''));
    if (d.abilityMods && d.abilities) {
      L.push('  Abilities: ' + Object.keys(d.abilityMods).map(function (k) {
        return k.toUpperCase() + ' ' + d.abilities[k] +
          ' (' + (d.abilityMods[k] >= 0 ? '+' : '') + d.abilityMods[k] + ')';
      }).join(', '));
    }
    if (d.saves && d.abilityMods) {
      /* `saves` is a flat map of final modifiers with no proficiency flag on
         it, so proficiency is inferred by comparing against the bare ability
         modifier. Printing a "* = proficient" legend and then never marking
         anything, which is what happened first, is worse than not saying. */
      L.push('  Saving throws: ' + Object.keys(d.saves).map(function (k) {
        var n = d.saves[k];
        var prof = n !== d.abilityMods[k];
        return k.toUpperCase() + ' ' + (n >= 0 ? '+' : '') + n + (prof ? '*' : '');
      }).join(', ') + '   (* = proficient in that save)');
    }
    if (d.skills) {
      var profSkills = Object.keys(d.skills).filter(function (k) {
        return d.skills[k].proficient || d.skills[k].expertise;
      });
      if (profSkills.length) {
        L.push('  Proficient skills: ' + profSkills.map(function (k) {
          var sk = d.skills[k];
          return k + ' ' + (sk.mod >= 0 ? '+' : '') + sk.mod +
            (sk.expertise ? ' (expertise)' : '');
        }).join(', '));
      }
      if (d.passives && d.passives.perception != null) {
        L.push('  Passive Perception ' + d.passives.perception);
      }
    }
    var conds = Object.keys(rt.conditions || {}).filter(function (k) { return rt.conditions[k]; });
    if (conds.length) L.push('  Currently: ' + conds.join(', '));
    if (d.exhaustion) L.push('  Exhaustion level ' + d.exhaustion);
    if (rt.concentratingOn) {
      L.push('  Concentrating on ' + (rt.concentratingOn.name || rt.concentratingOn.spellId ||
        rt.concentratingOn) + ' \u2014 taking damage forces a Constitution save.');
    }

    var sc = d.spellcasting;
    if (sc && sc.ability) {
      L.push('  Spellcasting: ' + sc.ability.toUpperCase() +
        ', save DC ' + sc.dc + ', spell attack +' + sc.attackBonus +
        ', ' + (sc.prepares === 'prepared' ? 'prepares spells daily' : 'knows a fixed list'));
      /* `slotsRemaining` and `pactSlots.remaining` are computed by derive();
         recomputing them here from `slotsSpent` would be a second source of
         truth able to drift from the sheet the player is looking at. */
      var slots = Object.keys(sc.slotsRemaining || {}).map(function (lv) {
        return 'level ' + lv + ': ' + sc.slotsRemaining[lv] + ' of ' + sc.slotsMax[lv];
      });
      if (sc.pactSlots) {
        slots.push('Pact Magic: ' + sc.pactSlots.remaining + ' of ' + sc.pactSlots.max +
          ' at spell level ' + sc.pactSlots.level);
      }
      L.push('  Spell slots left: ' + (slots.length ? slots.join(', ') : 'none'));
      if ((sc.cantripsKnown || []).length) {
        L.push('  Cantrips: ' + sc.cantripsKnown.join(', '));
      }
      var castable = (sc.prepared || []).concat(sc.known || []);
      if (castable.length) L.push('  Can cast: ' + castable.slice(0, 18).join(', '));
      if ((sc.ritual || []).length) {
        L.push('  Can cast as a ritual, without spending a slot: ' + sc.ritual.join(', '));
      }
    }

    if (d.featureResources && Object.keys(d.featureResources).length) {
      L.push('  Class features with uses: ' + Object.keys(d.featureResources).map(function (k) {
        var pool = d.featureResources[k];
        var used = (rt.featuresSpent || {})[k] || 0;
        return (pool.label || k) + ' ' + Math.max(0, pool.max - used) + ' of ' + pool.max +
          ' (returns on a ' + pool.per + ' rest)';
      }).join(', '));
    }
    if ((d.narrativeFeatures || []).length) {
      L.push('  Features the engine does not simulate, which YOU adjudicate ' +
        'by ruling on them: ' + d.narrativeFeatures.slice(0, 10).join(', '));
    }
    if ((d.resistances || []).length) L.push('  Resistant to: ' + d.resistances.join(', '));
    if ((d.immunities || []).length) L.push('  Immune to: ' + d.immunities.join(', '));

    var inv = (rt.inventory || []).slice(0, 16).map(function (i) { return i.name || i.id; });
    L.push('  Carrying: ' + (inv.length ? inv.join(', ') : 'nothing of note') +
      ' \u00b7 ' + (rt.gold || 0) + ' gp');

    /* What the rules will actually let them do this instant. "What can I do?"
       is the commonest question at any table, and the engine already knows the
       answer exactly — there is no reason for the model to guess at it. */
    var D = dispatch();
    if (D && D.legalMoves) {
      var moves = [];
      try { moves = D.legalMoves(state, id, {}) || []; } catch (e) { moves = []; }
      if (moves.length) {
        L.push('  Able to do right now: ' + moves.slice(0, 26).map(function (m) {
          return m.what + (m.cost ? ' [' + m.cost + ']' : '');
        }).join('; '));
      }
    }

    if (state.combat && state.combat.active) {
      var t = rt.turn;
      L.push('  In combat, round ' + state.combat.round +
        (t ? ' \u2014 action ' + (t.action ? 'available' : 'spent') +
          ', bonus action ' + (t.bonus ? 'available' : 'spent') +
          ', reaction ' + (t.reaction ? 'available' : 'spent') +
          ', ' + t.movementRemaining + ' ft of movement left' : ''));
    } else {
      L.push('  Not in combat.');
    }

    /* Who else is here. Without this the model answered "what can I do?" with
       a list of attacks on the ogre and then said "no one else is present" in
       the same breath, because it had the legal moves but not the cast. */
    var others = Object.keys(state.actors || {}).filter(function (k) {
      return k !== id && !(state.actors[k].runtime || {}).dead;
    }).map(function (k) {
      var o = state.actors[k];
      var side = o.side === 'party' ? 'ally' : (o.side === 'enemy' ? 'hostile' : 'neutral');
      var down = (o.runtime || {}).hp <= 0 ? ', unconscious' : '';
      return o.name + ' (' + side + down + ')';
    });
    L.push('  Also here: ' + (others.length ? others.join(', ') : 'nobody else'));

    return L.join('\n');
  }

  /**
   * The answer with no model at all.
   *
   * Worth more than an apology: the rulebook lookup and the character sheet
   * are both local, so a question like "how does grappling work?" can be
   * answered completely and correctly with nothing running. Only questions
   * about the fiction actually need the model.
   */
  function offlineAnswer(question, ctx, facts, rules) {
    var where = (ctx && ctx.locationName) || 'where you are';
    if (rules) {
      return 'The Dungeon Master model is not running, so this is the rulebook ' +
        'itself rather than the Dungeon Master in their own words:\n\n' + rules +
        (facts ? '\n\nAnd where you stand right now:\n' + facts : '');
    }
    return 'There is no Dungeon Master model running, so I cannot answer that in ' +
      'words \u2014 pick one in the setup screen and I can. That question needs ' +
      'the Dungeon Master; rules questions I can answer without one. What I can ' +
      'tell you from the engine is that you are at ' + where + '.' +
      (facts ? '\n\n' + facts : '');
  }

  var api = {
    GATES: GATES,
    BREAKS_CHARACTER: BREAKS_CHARACTER,
    META_TALK: META_TALK,
    findPlayerVoice: findPlayerVoice,
    redactNames: redactNames,
    repetitionScore: repetitionScore,
    repeatedPhrase: repeatedPhrase,
    TIRED_OPENERS: TIRED_OPENERS,
    FOREIGN_SCRIPT: FOREIGN_SCRIPT,
    firstWords: firstWords,
    applyGates: applyGates,
    correctionFor: correctionFor,
    narrate: narrate,
    speak: speak,
    opening: opening,
    answer: answer,
    adjudicate: adjudicate,
  };

  global.DND = global.DND || {};
  global.DND.Narrator = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
