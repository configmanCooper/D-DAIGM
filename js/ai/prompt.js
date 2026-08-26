/*
 * prompt.js — building what the Dungeon Master is allowed to see.
 *
 * The split enforced here is not stylistic, it is two separate correctness
 * requirements that happen to have the same answer.
 *
 * Cache: Ollama reuses the KV prefix only while the leading tokens are
 * byte-identical, so anything that changes per turn must live AFTER the system
 * message or every turn pays full prompt cost.
 *
 * Leaks: gated secrets grow as the campaign unlocks them. Putting them in the
 * system prompt would both bust that cache and put a secret in front of the
 * model on every turn including the ones where it is not authorised. So the
 * system prompt holds only what never changes, and everything conditional is
 * appended per turn — present exactly on the turns it is allowed.
 */
(function (global) {
  'use strict';

  var Knowledge = (global.DND && global.DND.Knowledge) ||
    (typeof require !== 'undefined' ? require('../engine/knowledge.js') : null);

  /* -------------------------------------------------------- system prompt -- */

  /**
   * Immutable for the whole session. Identity, tone, and above all the
   * division of authority — a model told plainly that it does not own outcomes
   * argues with them far less often than one merely told to be a good DM.
   */
  function buildSystem(campaign, opts) {
    opts = opts || {};
    var c = campaign || {};
    var lines = [];

    lines.push('You are the Dungeon Master of a Dungeons & Dragons 5th Edition game (2014 rules).');
    lines.push('');
    lines.push('THE DIVISION OF AUTHORITY — this is absolute:');
    lines.push('The game engine has ALREADY decided everything mechanical before you are called.');
    lines.push('Every die has been rolled. Every hit, miss, wound and death is settled.');
    lines.push('You are given the results as facts. Your only job is to describe them well.');
    lines.push('');
    lines.push('You must NEVER:');
    lines.push('- roll, invent, or mention a die result that was not given to you');
    lines.push('- decide whether something hits, succeeds or fails');
    lines.push('- change anyone\u2019s hit points, inventory, gold or position');
    lines.push('- grant an item, a spell, an ally or a piece of information on your own authority');
    lines.push('- describe the outcome of an action the engine has not yet resolved');
    lines.push('- speak or act for a player-controlled character');
    lines.push('- mention being an AI, a model, or a game system');
    lines.push('');
    /* Learned from a playtest: asked repeatedly about a name, the DM had a
       companion confess that the antagonist had been his captain and that he
       had let the man walk into the marsh alone. None of it was true. It was
       excellent writing and it quietly rewrote the campaign.
       A model given a voice card and no facts will fill the silence, so it has
       to be told that silence is an acceptable answer. */
    lines.push('YOU DO NOT INVENT FACTS. This is as important as the dice rule.');
    lines.push('Do not invent history, relationships, motives, names, places or past events');
    lines.push('for any character. You know only what this prompt tells you.');
    lines.push('If someone is asked a question you have not been given the answer to, they do');
    lines.push('NOT suddenly remember it. Have them deflect, hesitate, admit they do not know,');
    lines.push('answer only the part they can, or change the subject. A character refusing to');
    lines.push('answer is good drama. A character inventing an answer breaks the campaign.');
    lines.push('');
    lines.push('If a result seems strange, narrate it anyway. It is what happened.');
    lines.push('');

    if (c.title) {
      lines.push('THE CAMPAIGN: ' + c.title);
      if (c.premise) lines.push(c.premise);
      lines.push('');
    }

    if (c.tone) {
      lines.push('TONE: ' + c.tone);
      lines.push('');
    }

    /* Only canon that is public from the outset. Anything gated arrives per
       turn, if and when it is authorised. */
    if (c.openCanon && c.openCanon.length) {
      lines.push('WHAT IS COMMON KNOWLEDGE IN THIS WORLD:');
      c.openCanon.forEach(function (line) { lines.push('- ' + line); });
      lines.push('');
    }

    if (c.hardRules && c.hardRules.length) {
      lines.push('THINGS THAT ARE TRUE AND CANNOT BE CONTRADICTED:');
      c.hardRules.forEach(function (line) { lines.push('- ' + line); });
      lines.push('');
    }

    lines.push('HOW YOU WRITE:');
    lines.push(c.voice || [
      'Close third person, present tense, plain and concrete.',
      'Lead with what a person would actually notice: sound, weight, temperature, smell.',
      'One image at most per paragraph, then something solid.',
      'Let people speak in their own register. Nobody is eloquent by default.',
      'No headings, no bullet points, no asterisk emotes, no stage directions.',
      'Never ask the player what they do next \u2014 the interface does that.',
    ].join(' '));
    lines.push('');
    lines.push('Write only the narration. No preamble, no commentary, no offers to help.');

    return lines.join('\n');
  }

  /* ------------------------------------------------------ stage direction -- */

  /**
   * The per-turn block. Everything conditional lives here.
   *
   * `intensity` is engine-computed rather than a mood word, because a small
   * model handed "tense" reaches straight for the most extreme reading of
   * tense. A number with an explicit ceiling holds much better.
   */
  function buildStageDirection(ctx) {
    var lines = [];
    lines.push('[SCENE]');
    if (ctx.locationName) lines.push('where: ' + ctx.locationName);
    if (ctx.timeOfDay) lines.push('when: ' + ctx.timeOfDay + (ctx.weather ? ', ' + ctx.weather : ''));
    if (ctx.sceneNote) lines.push('note: ' + ctx.sceneNote);
    lines.push('');

    if (ctx.party && ctx.party.length) {
      lines.push('[WHO IS HERE]');
      ctx.party.forEach(function (p) {
        lines.push('- ' + p.name + (p.role ? ' (' + p.role + ')' : '') +
          (p.condition ? ' \u2014 ' + p.condition : ''));
        /* A player's own backstory is theirs, and the point of writing one is
           that it comes back. The DM is told it so the world can reference it;
           it is deliberately kept short here so it survives context trimming. */
        if (p.backstory) lines.push('    their history: ' + p.backstory);
        if (p.wants) lines.push('    what they want: ' + p.wants);
      });
      lines.push('You may draw on those histories \u2014 a face from their past, a debt called in,');
      lines.push('a place they know. Do NOT contradict them or add to them.');
      lines.push('');
    }

    /* An explicit roster of who is still standing. Without it a model counts
       from the fiction and gets it wrong — a playtest produced "two down, four
       left standing" in a room that had started with three enemies. Numbers in
       the world are the engine's to state, not the narrator's to estimate. */
    if (ctx.enemies) {
      lines.push('[WHO IS STILL STANDING AGAINST THEM]');
      if (!ctx.enemies.length) {
        lines.push('- nobody. Every enemy here is down. Do not imply otherwise, and do');
        lines.push('  not suggest reinforcements unless told to.');
      } else {
        ctx.enemies.forEach(function (e) {
          lines.push('- ' + e.name + ' \u2014 ' + e.health);
        });
        lines.push('That is the complete list. There are no others present, approaching or');
        lines.push('waiting in the dark unless this prompt says so.');
      }
      lines.push('');
    }

    if (ctx.speakers && ctx.speakers.length) {
      lines.push('[VOICES YOU ARE PERFORMING]');
      ctx.speakers.forEach(function (s) {
        lines.push('- ' + s.name + ': ' + s.voice);
        if (s.wants) lines.push('  wants: ' + s.wants);
        if (s.knows) lines.push('  knows: ' + s.knows);
        /* Naming what a character does NOT know is what stops a model filling
           the gap. "Does not know" is a fact it can perform; an empty space is
           an invitation. */
        if (s.doesNotKnow) lines.push('  does NOT know, and will not invent: ' + s.doesNotKnow);
        if (s.holdingBack) lines.push('  is holding something back, but will NOT say what: ' + s.holdingBack);
      });
      lines.push('These characters know nothing beyond what is listed here. If asked about');
      lines.push('anything else, they deflect or admit ignorance \u2014 they do not remember it.');
      lines.push('');
    }

    lines.push('[WHAT JUST HAPPENED \u2014 already resolved, narrate as settled fact]');
    if (ctx.beats && ctx.beats.length) {
      ctx.beats.forEach(function (b) { lines.push('- ' + b); });
    } else {
      lines.push('- nothing mechanical; this is a quiet moment');
    }
    lines.push('');
    /* Observed in the live battery: given one hit, a small model wrote "it
       takes hit after hit" and added a second exchange that never occurred.
       Naming the failure explicitly is what stops it. */
    lines.push('Describe ONLY the events listed above. Do not add further blows, wounds,');
    lines.push('deaths, discoveries, arrivals or outcomes. If the list has one hit, exactly');
    lines.push('one blow lands. If the list says a search failed, nothing is found.');
    lines.push('');

    if (ctx.playerAction) {
      lines.push('[WHAT THE PLAYER DID]');
      lines.push(ctx.playerAction);
      lines.push('');
    }

    lines.push('[HOW TO PLAY IT]');
    lines.push('intensity: ' + describeIntensity(ctx.intensity) +
      ' (' + (ctx.intensity == null ? 0.5 : ctx.intensity).toFixed(2) + ')');
    lines.push('Match that level exactly. Do NOT escalate past it.');
    if (ctx.focusOn) lines.push('give the moment to: ' + ctx.focusOn);
    lines.push('');
    /* Length last, because small models weight the most recent instruction
       most heavily and this is the one they break first. Sentences rather than
       words: a token budget means nothing to a model, a sentence count does. */
    lines.push('[LENGTH \u2014 THIS MATTERS MOST]');
    lines.push('Write at most ' + (ctx.sentences || 4) + ' sentences, in ' +
      (ctx.paragraphs || 2) + ' short paragraph' + ((ctx.paragraphs || 2) === 1 ? '' : 's') +
      '. Under ' + (ctx.maxWords || 130) + ' words.');
    lines.push('Concrete over atmospheric. One image at most, then something solid.');
    lines.push('Do not begin with the weather, the air, the fog, or the silence.');
    lines.push('');

    /* Gated reveals: present only when authorised, absent otherwise. There is
       no "do not mention X" for things the model was never shown. */
    if (ctx.mayReveal && ctx.mayReveal.length) {
      lines.push('[YOU MAY REVEAL, IF THE MOMENT EARNS IT]');
      ctx.mayReveal.forEach(function (r) {
        lines.push('- ' + (r.claim || r));
        if (r.constraint) lines.push('  (must remain true: ' + r.constraint + ')');
      });
      lines.push('');
    }

    /* A backstop only. The forbidden names are deliberately NOT listed here:
       writing "never mention the Hollow King" tells the model there is a
       Hollow King, which is precisely the leak the knowledge model exists to
       prevent. Gating is by omission — the secret is not in this prompt — and
       enforcement is by redaction after the fact, in narrator.js. */

    if (ctx.playerCharacters && ctx.playerCharacters.length) {
      lines.push('[NOT YOURS TO SPEAK FOR]');
      lines.push('Never write dialogue or decisions for: ' + ctx.playerCharacters.join(', ') + '.');
      lines.push('Describe what happens to them. Never what they say, think or choose.');
      lines.push('');
    }

    if (ctx.avoidOpenings && ctx.avoidOpenings.length) {
      lines.push('[DO NOT OPEN WITH THESE AGAIN]');
      lines.push(ctx.avoidOpenings.map(function (o) { return '"' + o + '"'; }).join(', '));
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  function describeIntensity(v) {
    var n = v == null ? 0.5 : v;
    if (n < 0.15) return 'still and quiet';
    if (n < 0.35) return 'low, watchful';
    if (n < 0.55) return 'tense but controlled';
    if (n < 0.75) return 'urgent';
    if (n < 0.9) return 'violent, fast';
    return 'catastrophic';
  }

  /**
   * Intensity from the state rather than from vibes. Combat raises it, low
   * hit points raise it, a quiet room lowers it.
   */
  function computeIntensity(state, observation) {
    var n = 0.25;
    if (observation.combat && observation.combat.active) n = 0.6;
    var party = Object.keys(observation.actors || {}).filter(function (id) {
      return observation.actors[id].side === 'party';
    });
    var hurt = 0, down = 0;
    party.forEach(function (id) {
      var a = observation.actors[id];
      if (a.dead) { down++; return; }
      if (a.hp != null && a.hpMax) {
        if (a.hp <= 0) down++;
        else if (a.hp / a.hpMax < 0.35) hurt++;
      }
    });
    if (party.length) {
      n += 0.2 * (hurt / party.length);
      n += 0.35 * (down / party.length);
    }
    if (state.flags && state.flags.sceneIsQuiet) n = Math.min(n, 0.3);
    return Math.max(0, Math.min(1, n));
  }

  /* ------------------------------------------------------- context budget -- */

  /* Rough but consistent. Exactness does not matter; refusing to grow without
     bound does. */
  function estimateTokens(text) {
    return Math.ceil(String(text || '').length / 3.6);
  }

  /**
   * Assemble the messages under a hard ceiling.
   *
   * Eviction order is fixed and deliberate: raw history goes first because it
   * is the most redundant, then summaries oldest-first. The system prompt and
   * the stage direction are never evicted — without them the model does not
   * know what it is or what just happened, which is worse than having no
   * history at all.
   */
  function assemble(parts, budgetTokens) {
    var budget = budgetTokens || 6400;
    var system = parts.system || '';
    var stage = parts.stage || '';
    var pinned = parts.pinned || [];
    var summaries = (parts.summaries || []).slice();
    var history = (parts.history || []).slice();

    var fixed = estimateTokens(system) + estimateTokens(stage) +
      pinned.reduce(function (n, p) { return n + estimateTokens(p); }, 0);
    var room = budget - fixed - 200;   // headroom for the reply

    while (room < 0 && summaries.length) { summaries.shift(); room += 180; }

    var kept = [];
    for (var i = history.length - 1; i >= 0; i--) {
      var cost = estimateTokens(history[i].content);
      if (cost > room) break;
      room -= cost;
      kept.unshift(history[i]);
    }

    var contextBlock = [];
    if (pinned.length) {
      contextBlock.push('[THINGS THAT MUST NOT BE FORGOTTEN]');
      pinned.forEach(function (p) { contextBlock.push('- ' + p); });
    }
    if (summaries.length) {
      contextBlock.push('');
      contextBlock.push('[EARLIER, IN BRIEF]');
      summaries.forEach(function (s) { contextBlock.push(s); });
    }

    var messages = [{ role: 'system', content: system }];
    if (contextBlock.length) messages.push({ role: 'user', content: contextBlock.join('\n') });
    kept.forEach(function (h) { messages.push(h); });
    messages.push({ role: 'user', content: stage });

    return {
      messages: messages,
      estimatedTokens: fixed + (budget - fixed - 200 - room) + 200,
      droppedSummaries: (parts.summaries || []).length - summaries.length,
      droppedHistory: history.length - kept.length,
    };
  }

  /* ------------------------------------------------------------ assembly --- */

  /** Everything a narration turn needs, built from the DM's observation. */
  function forNarration(state, store, campaign, batchBeats, opts) {
    opts = opts || {};
    var observation = Knowledge.getObservation(state, store, 'dm',
      { mode: 'dm', partyId: opts.partyId || 'party' });

    var playerCharacters = (state.seats || []).map(function (s) {
      var a = state.actors[s.actorId];
      return a ? a.name : null;
    }).filter(Boolean);

    var ctx = {
      locationName: opts.locationName || state.locationId,
      timeOfDay: opts.timeOfDay,
      weather: opts.weather,
      sceneNote: opts.sceneNote,
      party: (opts.party || []),
      /* Built from the DM's own observation rather than passed in, so the
         roster can never drift from the actual state of the room. */
      enemies: opts.enemies || Object.keys(observation.actors || {})
        .filter(function (id) {
          var a = observation.actors[id];
          return a.side === 'enemy' && !a.dead;
        })
        .map(function (id) {
          var a = observation.actors[id];
          return {
            name: a.name,
            health: a.hp != null && a.hpMax
              ? (a.hp <= 0 ? 'down' : Knowledge.healthBand({ runtime: { hp: a.hp, hpMax: a.hpMax } }))
              : (a.health || 'unhurt'),
          };
        }),
      speakers: opts.speakers || [],
      beats: batchBeats || [],
      playerAction: opts.playerAction,
      intensity: opts.intensity != null ? opts.intensity : computeIntensity(state, observation),
      maxWords: opts.maxWords || 110,
      sentences: opts.sentences || 4,
      paragraphs: opts.paragraphs || 2,
      focusOn: opts.focusOn,
      mayReveal: observation.mayReveal || [],
      mustNotName: observation.mustNotName || [],
      playerCharacters: playerCharacters,
      avoidOpenings: opts.avoidOpenings || [],
    };

    return {
      system: buildSystem(campaign, opts),
      stage: buildStageDirection(ctx),
      ctx: ctx,
      observation: observation,
    };
  }

  var api = {
    buildSystem: buildSystem,
    buildStageDirection: buildStageDirection,
    describeIntensity: describeIntensity,
    computeIntensity: computeIntensity,
    estimateTokens: estimateTokens,
    assemble: assemble,
    forNarration: forNarration,
  };

  global.DND = global.DND || {};
  global.DND.Prompt = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
