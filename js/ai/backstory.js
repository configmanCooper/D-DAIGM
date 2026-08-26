/*
 * backstory.js — where a character came from.
 *
 * Three ways to get one, in ascending order of effort:
 *   a seed      one line from a table, enough to start with
 *   the GM      ask the model to write one that fits this exact character
 *   your own    type it, and the GM will read it
 *
 * The model is given the character sheet and told to stay inside it: a
 * blacksmith's son with 8 Intelligence should not turn out to be a former
 * court archivist. It is also told to leave threads loose, because a backstory
 * that answers everything gives the Dungeon Master nothing to pull on.
 */
(function (global) {
  'use strict';

  function req(p) { return typeof require !== 'undefined' ? require(p) : null; }
  var Backend = (global.DND && global.DND.Backend) || req('./backend.js');
  var Chargen = (global.DND && global.DND.Chargen) || req('../gen/chargen.js');
  var RNG = (global.DND && global.DND.RNG) || (req('../rng.js') || {}).RNG;

  var SYSTEM = [
    'You write short character backstories for a Dungeons & Dragons game.',
    '',
    'You are given a finished character sheet. Write the history that produced',
    'exactly that person \u2014 their race, class, ability scores, skills and background',
    'are already decided and are not yours to change.',
    '',
    'Rules:',
    '- 90 to 140 words. Three short paragraphs at most.',
    '- Second person ("You were...") \u2014 this is the player\u2019s own history.',
    '- Concrete and small. A trade, a town, a person, a specific bad afternoon.',
    '- Their ability scores are facts about them. A low Intelligence is not stupidity,',
    '  it is someone who learned by doing. A high Charisma is not beauty.',
    '- Leave exactly one thing unresolved: a debt, a question, someone missing,',
    '  something they did not do. The Dungeon Master will use it.',
    '- No prophecies, no chosen ones, no dead parents unless it earns its place.',
    '- Do not name gods, kingdoms or organisations. The world is not yours to invent.',
    '',
    'Write only the backstory. No headings, no preamble, no commentary.',
  ].join('\n');

  function describeSheet(spec, derived) {
    var D = (global.DND && global.DND.Data) || {};
    var race = (D.RACES && D.RACES[spec.raceId]) || {};
    var cls = (D.CLASSES && D.CLASSES[spec.classId]) || {};
    var bg = (D.BACKGROUNDS && D.BACKGROUNDS[spec.backgroundId]) || {};
    var lines = [];
    lines.push('NAME: ' + (spec.name || 'unnamed'));
    lines.push('RACE: ' + (race.name || spec.raceId) +
      (spec.subraceId ? ' (' + spec.subraceId + ')' : ''));
    lines.push('CLASS: ' + (cls.name || spec.classId) + ', level ' + (spec.levels || 1));
    if (bg.name || spec.backgroundId) lines.push('BACKGROUND: ' + (bg.name || spec.backgroundId));

    var ab = spec.abilities || {};
    lines.push('ABILITY SCORES: ' + ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(function (a) {
      return a.toUpperCase() + ' ' + (ab[a] == null ? '?' : ab[a]) + ' (' + band(ab[a]) + ')';
    }).join(', '));

    if (spec.skills && spec.skills.length) {
      lines.push('TRAINED IN: ' + spec.skills.join(', '));
    }
    var build = Chargen && Chargen.BUILDS && Chargen.BUILDS[spec.classId];
    if (build) lines.push('HOW THEY FIGHT: ' + build.style);
    if (spec.hint) lines.push('THE PLAYER ASKS FOR: ' + spec.hint);
    return lines.join('\n');
  }

  /* Scores mean something specific in play, and saying so stops the model
     writing a 16-Strength character as physically unremarkable. */
  function band(score) {
    if (score == null) return 'unknown';
    if (score <= 7) return 'a real weakness';
    if (score <= 9) return 'below average';
    if (score <= 11) return 'unremarkable';
    if (score <= 13) return 'a little above average';
    if (score <= 15) return 'notably good';
    if (score <= 17) return 'among the best you have met';
    return 'exceptional, the sort people remark on';
  }

  /**
   * Ask the Dungeon Master to write one.
   *
   * Never rejects: a failure returns a seeded line so the player is not left
   * with an empty box because a model was busy.
   */
  function generate(spec, opts) {
    opts = opts || {};
    var rng = opts.rng || new RNG(String(spec.name || '') + (opts.seed || ''));

    function fallback(why) {
      var seed = Chargen && Chargen.BACKSTORY_SEEDS
        ? rng.pick(Chargen.BACKSTORY_SEEDS)
        : 'You came from somewhere small and did not intend to leave.';
      return { text: seed, source: 'seed', why: why || '' };
    }

    if (!Backend || !Backend.available() || opts.forceSeed) {
      return Promise.resolve(fallback('no model available'));
    }

    return Backend.chat({
      /* PROSE, not compression. This used the `summary` profile, which is the
         one place `think: true` is set — it earns its cost when squeezing a
         long transcript down, and is exactly wrong here. A thinking model
         spends the token budget reasoning and returns empty content, so the
         call "succeeded" with no text and the generator fell back to a canned
         seed every single time, reporting "the Dungeon Master could not be
         reached" when it had been reached perfectly well. */
      profile: 'narrator',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: describeSheet(spec, opts.derived) },
      ],
      numPredict: 320,
      signal: opts.signal,
    }).then(function (res) {
      var text = Backend.cleanProse(res.text);
      /* A model that ignores the brief and writes an epic is not usable as a
         backstory; trim it rather than showing the player 600 words. */
      text = Backend.trimToSentence(text, 170);
      if (!text || text.length < 40) return fallback('the model returned nothing usable');
      if (/as an ai|language model/i.test(text)) return fallback('the model broke character');
      return { text: text, source: res.kind };
    }).catch(function (e) {
      return fallback(String((e && e.message) || e));
    });
  }

  /** A one-line seed, no model required. */
  function seed(rng) {
    var r = rng || new RNG(String(Date.now()));
    var seeds = (Chargen && Chargen.BACKSTORY_SEEDS) || ['You came from somewhere small.'];
    return r.pick(seeds);
  }

  var api = {
    SYSTEM: SYSTEM,
    generate: generate,
    seed: seed,
    describeSheet: describeSheet,
    band: band,
  };

  global.DND = global.DND || {};
  global.DND.Backstory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
