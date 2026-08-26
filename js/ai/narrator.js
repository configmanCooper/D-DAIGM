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
  };

  global.DND = global.DND || {};
  global.DND.Narrator = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
